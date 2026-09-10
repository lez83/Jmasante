const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const PNG="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,menuMode:"tiles",
  identity:{nom:"Démo",prenom:"Jean-Marie",uid:"u1"},confidentialityAck:true,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2"]},tours:["A","B"],curTour:"A",
  patients:[
   {id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"12 rue X",
    nir:"2 41 06",prevenir:{nom:"Fille",tel:"06 12"},appareillages:"Pacemaker",
    contacts:{med:{nom:"Dr Démo",tel:"00 00 00"},pharma:{nom:"Pharma",tel:"00 00 11"}},
    thresholds:{ta_h:15,sat_b:94},tours:["A"],plan:["Toilette","Pilulier"],planRythme:{"Pilulier":"lundi"},
    archived:null,bilans:[{id:"b1",type:"PdS",date:iso,statut:"À faire",res:""}],
    docs:[{id:"d1",name:"Ordo.png",mime:"image/png",date:iso}],tags:[],
    infos:[{id:"i1",type:"vigilance",txt:"Allergie",show:true},{id:"i2",type:"traitement",txt:"Eliquis",show:false}],
    visits:[]},
   {id:"p2",nom:"Démo-Bernard",prenom:"Marcel",dob:"1948-01-22",genre:"M",address:"",contacts:{},
    tours:["A"],plan:["Injection"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
  rappels:[{id:"r1",pid:"p1",tour:"A",perso:false,type:"ordonnance",text:"Ordo",due:iso,done:false}],
  noVisit:{},trash:[],slotFold:{},drafts:{},syncHistory:[],sendLog:[]};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  const st=tx.objectStore("kv"); st.put(state,"state"); st.put(PNG,"doc_d1");
  tx.oncomplete=()=>{db.close();run();}};

function run(){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.URL.revokeObjectURL=()=>{};w.confirm=()=>true;w.prompt=()=>"DÉMO-LEROY";
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s),qa=s=>d.querySelectorAll(s);
  const R=[]; const ok=(n,v)=>R.push([n,!!v]);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const closeAll=()=>{q('#veil')?.classList.remove('on');
    ['typepick','fichePrev'].forEach(i=>d.getElementById(i)?.remove());
    const dv=q('#docview'); if(dv){dv.style.display='none';dv.innerHTML='';}};
  const openP=n=>{const c=[...qa('.pcard')].find(x=>x.textContent.toUpperCase().includes(n));
    c?.querySelector('[data-toggle]')?.click(); return !!c;};

  (async()=>{
    await wait(1000);
    // ── MONITEUR ──
    ok('Moniteur affiche les patients', qa('.pcard').length===2);
    ok('4 compteurs', qa('.spill').length===4);
    ok('Filtres de statut', qa('[data-f]').length>=5);
    ok('Barre d outils', qa('[data-a]').length>=5);
    ok('Sélecteur de tournée', qa('#tourbar .fchip').length>=2 || qa('[data-t]').length>0);

    // ── CARTE + SAISIE ──
    openP('DÉMO-LEROY'); await wait(700);
    ok('Carte s ouvre', !!q('[data-save]'));
    ok('Soins du plan proposés', qa('.chip[data-s]').length>=2);
    ok('Rythme « lundi » affiché', (q('#board')?.textContent||'').includes('lundi'));
    ok('Champs constantes', qa('[data-c]').length>=3);
    ok('Zone transmission', !!q('[data-note]'));
    ok('3 boutons de fin', !!q('[data-cancel]')&&!!q('[data-keep]')&&!!q('[data-save]'));
    ok('Outils patient', qa('[data-docs],[data-bilans],[data-raps]').length>=3);
    ok('Historique/Courbes', qa('[data-graph],[data-hist]').length>=2);
    ok('Bouton Fiche', !!q('[data-edit]'));

    // ── FICHE EN ONGLETS ──
    q('[data-edit]')?.click(); await wait(800);
    ok('Fiche s ouvre', !!q('#f-nom'));
    ok('4 onglets', qa('.ftab').length===4);
    const champs=['f-nom','f-prenom','f-dob','f-nir','f-addr','f-pap-nom','f-pap-tel','f-appar',
                  'f-infos','f-plan','f-newplan','f-addplan','f-tours','f-save','f-cancel'];
    const manque=champs.filter(i=>!q('#'+i));
    ok('15 champs présents'+(manque.length?' — manque '+manque.join(','):''), !manque.length);
    ok('Contacts (annuaire)', qa('.f-contact-name').length>=4);
    ok('Seuils personnalisés', qa('.f-th').length>=6);
    ok('Valeurs chargées', q('#f-nom')?.value==='Démo-Leroy' && !!q('#f-nir')?.value && !!q('#f-appar')?.value);
    ok('Contact médecin chargé', qa('.f-contact-name')[0]?.value==='Dr Démo');
    ok('6 boutons d action', ['f-dlu','f-feuilles','f-export','f-pec','f-arch','f-del'].every(i=>!!q('#'+i)));
    ok('Infos typées', qa('.info-row').length===2);

    // Enregistrer depuis l'onglet Soins
    q('[data-tab="soins"]')?.click(); await wait(400);
    ok('Bascule vers Soins', q('.fpane.on')?.dataset.pane==='soins');
    q('#f-save')?.click(); await wait(800);
    openP('DÉMO-LEROY'); await wait(600);
    q('[data-edit]')?.click(); await wait(800);
    ok('PERSISTANCE : nom', q('#f-nom')?.value==='Démo-Leroy');
    ok('PERSISTANCE : n° sécu', !!q('#f-nir')?.value);
    ok('PERSISTANCE : appareillages', !!q('#f-appar')?.value);
    ok('PERSISTANCE : contacts', qa('.f-contact-name')[0]?.value==='Dr Démo');
    ok('PERSISTANCE : seuils', [...qa('.f-th')].filter(x=>x.value).length===2);
    ok('PERSISTANCE : plan de soins', qa('#f-plan .chip').length===2);
    ok('PERSISTANCE : infos typées', qa('.info-row').length===2);

    // ── DLU ──
    q('[data-tab="act"]')?.click(); await wait(400);
    q('#f-dlu')?.click(); await wait(800);
    const tdlu=q('#sheet')?.textContent||'';
    ok('DLU s ouvre', !!q('#dlu-show'));
    ok('DLU reprend la fiche', tdlu.includes('Allergie')&&tdlu.includes('Eliquis')&&tdlu.includes('Dr Démo'));
    ok('DLU : 3 sorties', !!q('#dlu-show')&&!!q('#dlu-share')&&!!q('#dlu-print'));

    // ── FEUILLES ──
    closeAll(); openP('DÉMO-LEROY'); await wait(600);
    q('[data-edit]')?.click(); await wait(700);
    q('[data-tab="act"]')?.click(); await wait(400);
    q('#f-feuilles')?.click(); await wait(800);
    ok('Feuilles : 3 types', qa('[data-ft]').length===3);
    ok('Feuilles : 2 densités', qa('[data-fd2]').length===2);

    // ── RELÈVE ──
    closeAll(); q('[data-a="releve"]')?.click(); await wait(700);
    ok('Écran relève', !!q('#rl-gen'));
    q('#rl-gen')?.click(); await wait(900);
    const txt=q('#rp-edit')?.value||q('#rp-preview')?.textContent||'';
    ok('Relève générée', txt.includes('DÉMO-LEROY'));
    ok('4 formats', qa('[data-fm]').length===4);
    ok('Message + signature', !!q('#rp-msg')&&!!q('#rp-sig'));

    // ── MENU ──
    closeAll(); q('[data-a="tours"]')?.click(); await wait(800);
    ok('Menu : 6 tuiles', qa('.mtile').length===6);
    q('[data-mm="list"]')?.click(); await wait(600);
    ok('Menu liste', qa('.mrow').length>=15);
    q('[data-mm="tiles"]')?.click(); await wait(400);
    q('[data-sec="share"]')?.click(); await wait(700);
    ok('Rubrique Partage', !!q('#sync-send'));
    q('#sync-send')?.click(); await wait(800);
    ok('Synchro cloisonnée', qa('[data-st]').length===2);

    // ── DÉROULÉ ──
    closeAll(); q('[data-a="seq"]')?.click(); await wait(800);
    ok('Mode déroulé', !!q('[class*=sq-]')||!!q('#sq-next')||(d.body.textContent||'').includes('sur 2'));

    const ko=R.filter(x=>!x[1]);
    console.log('═══ NON-RÉGRESSION v44 → v45 ═══\n');
    R.forEach(([n,v])=>console.log((v?'  ✓ ':'  ✗ ')+n));
    console.log('\n>>> '+(R.length-ko.length)+'/'+R.length+' vérifications'+(ko.length?' ❌':' ✅'));
    console.log('ERREURS JS:', errs.length?errs:'aucune');
  })();
}
