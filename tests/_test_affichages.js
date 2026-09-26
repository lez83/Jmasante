// v1.0.58 — Tuiles de constantes, cartes à bande, légende, code de secours,
// incitation au code. Charge l'app, bascule les réglages, vérifie le DOM.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const d0=new Date(); const iso=d0.toISOString().slice(0,10);
const vieux=new Date(Date.now()-3*86400000).toISOString().slice(0,10);
const state={version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,avertLu:true,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2"]},tours:["A"],curTour:"A",
  patients:[
   {id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"1 rue X",cp:"83000",ville:"Toulon",contacts:{},tel:{mobile:"0600000000"},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    visits:[{id:"v1",date:vieux,at:"08:00",soins:[],consts:{sat:"91"}},
            {id:"v2",date:iso,at:"08:12",soins:[],consts:{ta:"128/78",glyc:"2.5"}}]},
   {id:"p2",nom:"Démo-Deux",prenom:"Q",dob:"1950-01-01",genre:"M",address:"",contacts:{},
    tours:["A"],plan:[],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
  rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(state,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs + '\n;window.__B = { sheetPatient, sheetAppPanel, sheetPersoZone, getS:()=>S, render, applyTheme, hashSecours, genCodeSecours, normSecours, sensConst, derniereConst, showLock, pinKey, codeOublie };');
  const d=w.document; const B=w.__B;
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
  (async()=>{
    await wait(1400);
    // fermer les dialogues éventuels (incitation au code)
    d.querySelectorAll('.dlg-veil [data-no]').forEach(b=>b.click()); await wait(300);
    const S=B.getS();
    console.log('═══ INCITATION AU CODE ═══');
    ok(S.pinNudge===1, 'compteur d\'incitation = 1 au premier lancement ('+S.pinNudge+')');

    console.log('═══ AFFICHAGE CLASSIQUE (défaut) ═══');
    ok(d.documentElement.dataset.cards==='classique','html[data-cards=classique]');
    ok(!!d.querySelector('#legende .legende'),'légende affichée par défaut');
    ok(d.querySelector('.pcard.st-alert') && d.querySelector('.pcard.st-todo'),'classes st-* posées sur les cartes');
    ok(!d.querySelector('.pc-act'),'pas de 📞📍 en mode pastille');
    const v1=d.querySelector('.pcard.st-alert .vitals').innerHTML;
    ok(/↑/.test(v1),'flèche ↑ sur la glycémie hors seuil (ligne compacte)');

    console.log('═══ TUILES ═══');
    S.constStyle='tableau'; S.cardStyle='bande'; B.applyTheme(); B.render(); await wait(100);
    d.querySelector('[data-toggle="p1"]').click(); await wait(400);
    const tiles=d.querySelectorAll('.pcard.open .vtile');
    ok(tiles.length===6,'6 tuiles dans la carte ouverte ('+tiles.length+')');
    ok(!!d.querySelector('.vtile.hi'),'glycémie en tuile HAUT');
    ok(!!d.querySelector('.vtile.lo'),'SpO2 91 en tuile BAS');
    ok(!!d.querySelector('.vt-d.old'),'date ambre pour une valeur de 3 jours');
    ok(d.querySelectorAll('.vtile.none').length===3,'3 constantes jamais mesurées estompées');
    ok(B.derniereConst(S.patients[0],'sat').date,'dernière SpO2 retrouvée dans un passage antérieur');
    console.log('═══ TUILES CLIQUABLES (v1.0.61) ═══');
    d.querySelector('.pcard.open [data-vtile="glyc"]').click(); await wait(80);
    ok(d.activeElement && d.activeElement.dataset.c==='glyc','tuile Glycémie → curseur dans le champ Glycémie');
    d.querySelector('.pcard.open [data-vtile="ta"]').click(); await wait(80);
    ok(d.activeElement && d.activeElement.hasAttribute('data-ta-s'),'tuile TA → curseur dans la systolique');
    ok(!!d.querySelector('.pcard.open [data-vtile="douleur"]').onclick,'tuile jamais mesurée aussi cliquable');
    B.sheetPatient(S.patients[0]); await wait(300);
    const tf=d.querySelector('#sheet [data-vtile="sat"]');
    ok(!!tf && !!tf.onclick,'tuiles de la fiche câblées');
    tf.click(); await wait(300);
    ok(!d.querySelector('#sheet .ftabs'),'tuile de la fiche → écran des courbes');

    console.log('═══ CARTES À BANDE ═══');
    ok(d.documentElement.dataset.cards==='bande','html[data-cards=bande]');
    d.querySelectorAll('.pcard.open [data-toggle]').forEach(b=>b.click()); await wait(300);
    ok(!!d.querySelector('.pcard [data-cann="p1"]') && !!d.querySelector('.pcard [data-cgps="p1"]'),'📞 et 📍 présents quand numéro et adresse existent');
    ok(!d.querySelector('[data-cann="p2"]') && !d.querySelector('[data-cgps="p2"]'),'aucun bouton sans numéro ni adresse');
    ok(!!d.querySelector('[data-cann="p1"]').onclick,'📞 câblé');
    ok(d.querySelector('.legende .lg-sw.bar'),'légende en rectangles pour la bande');

    console.log('═══ TAILLE DES PASTILLES (v1.0.61) ═══');
    S.cardStyle='classique'; B.applyTheme(); B.sheetPersoZone('cartes'); await wait(100);
    ok(!!d.querySelector('#pz-dot'),'choix de taille visible en mode Pastille');
    d.querySelector('[data-dot="grande"]').click(); await wait(100);
    ok(d.documentElement.dataset.dot==='grande' && S.dotSize==='grande','taille Grande appliquée');
    S.cardStyle='bande'; B.applyTheme(); B.sheetPersoZone('cartes'); await wait(100);
    ok(!d.querySelector('#pz-dot'),'choix de taille masqué en mode Bande');
    B.render(); await wait(100);
    console.log('═══ LÉGENDE ═══');
    d.querySelector('#lg-hide').click(); await wait(50);
    ok(!!d.querySelector('#lg-open') && !d.querySelector('.legende'),'« Ne plus afficher » replie en ⓘ');
    d.querySelector('#lg-open').click(); await wait(50);
    ok(!!d.querySelector('.legende'),'ⓘ rouvre la légende');

    console.log('═══ CODE DE SECOURS ═══');
    const c=B.genCodeSecours();
    ok(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/.test(c),'format XXXX-XXXX-XXXX sans ambigus ('+c+')');
    ok(await B.hashSecours(c)===await B.hashSecours(c.toLowerCase().replace(/-/g,' ')),'saisie tolérante (minuscules, espaces)');
    // PIN 6 chiffres
    B.showLock('set'); await wait(50);
    ok(d.querySelectorAll('#lockdots .d').length===6,'6 points pour un nouveau code');
    for (const k of '123456') await B.pinKey(k);
    for (const k of '12345') await B.pinKey(k);
    B.pinKey('6'); await wait(600);
    const rc=d.querySelector('.rescue-code');
    ok(!!rc,'code de secours montré après création');
    const code=rc? rc.textContent.trim():'';
    ok(S.pin && S.pinLen===6 && S.pinRescue && S.pinRescue.length===64,'code 6 chiffres + empreinte du code de secours enregistrés');
    ok(!JSON.stringify(S).includes(code.replace(/-/g,'')),'le code de secours n\'est pas stocké en clair');
    d.querySelectorAll('.dlg-veil [data-yes]').forEach(b=>b.click()); await wait(300);
    // Oubli → secours
    B.showLock('unlock'); await wait(50);
    ok(d.querySelector('#lock-oubli').style.display!=='none','« Code oublié ? » visible au déverrouillage');
    B.codeOublie(); await wait(250);
    const opt=[...d.querySelectorAll('.dlg-opt')].find(b=>/secours/.test(b.textContent)); opt.click(); await wait(250);
    d.querySelector('#dlg-in').value=code.toLowerCase(); d.querySelector('.dlg-veil [data-yes]').click(); await wait(500);
    ok(!S.pin && d.querySelectorAll('#lockdots .d').length===6,'code de secours accepté → nouveau code demandé');
    ok(S.patients.length===2,'données intactes après oubli du code');
    // Ancien code à 4 chiffres toujours valable
    S.pin=await (async()=>{const b=await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode('jmsante:1234'));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');})();
    S.pinLen=undefined; B.showLock('unlock'); await wait(50);
    ok(d.querySelectorAll('#lockdots .d').length===4,'un ancien code garde 4 points');
    for (const k of '1234') await B.pinKey(k); await wait(100);
    ok(!d.querySelector('#lock').classList.contains('on'),'ancien code à 4 chiffres accepté');

    console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
  })();
}
