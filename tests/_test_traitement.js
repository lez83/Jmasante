const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"Démo",prenom:"Jean-Marie",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"",
    contacts:{med:{nom:"Dr Démo",tel:"00 00 00"}},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],
    infos:[{id:"i1",type:"vigilance",txt:"Allergie pénicilline",show:true},
           {id:"i2",type:"traitement",txt:"Furosémide 40 (1-0-0) · Eliquis 2,5 (1-0-1)",show:false}],
    visits:[]}],
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
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s),qa=s=>d.querySelectorAll(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1000);
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(600);
    q('[data-edit]')?.click(); await wait(800);
    q('[data-tab="info"]')?.click(); await wait(400);
    console.log('① Bouton Fiche de traitement:', !!q('#f-trait'));
    console.log('   Libellé:', q('#f-trait')?.textContent.replace(/\s+/g,' ').trim());
    q('#f-trait')?.click(); await wait(800);
    console.log('\n═══ FICHE DE TRAITEMENT ═══');
    let t=q('#sheet')?.textContent||'';
    console.log('② Écran ouvert:', !!q('#tr-add'));
    console.log('③ Ancien texte libre RAPPELÉ:', t.includes('Furosémide 40 (1-0-0)'), '(conservé)');
    // Ajouter un médicament
    q('#tr-add')?.click(); await wait(700);
    console.log('\n═══ SAISIE ═══');
    console.log('④ Champs:', !!q('#te-nom'), '| posologies:', qa('.teposo input').length, '(attendu 4)');
    console.log('⑤ Formes:', qa('[data-tf]').length, '(attendu 5)');
    console.log('⑥ Bascule si besoin:', !!q('#te-sib'));
    q('#te-nom').value='Eliquis 2,5 mg';
    q('#te-m').value='1'; q('#te-s').value='1';
    q('#te-note').value='Pendant le repas';
    q('#te-ok')?.click(); await wait(800);
    t=q('#sheet')?.textContent||'';
    console.log('\n═══ APRÈS AJOUT ═══');
    console.log('⑦ Grille affichée:', !!q('.trgrid'), '| lignes:', qa('.tr-r').length);
    console.log('⑧ Anticoagulant détecté:', !!q('.tr-w'), '(Eliquis)');
    console.log('⑨ Posologie 1-0-1:', qa('.tr-d.on').length, 'doses (attendu 2)');
    console.log('⑩ Remarque:', t.includes('Pendant le repas'));
    console.log('⑪ Date de mise à jour:', /mise à jour/.test(t));
    // Un « si besoin »
    q('#tr-add')?.click(); await wait(600);
    q('#te-nom').value='Doliprane 1g';
    q('#te-sib')?.click(); await wait(400);
    q('#te-nom').value='Doliprane 1g';
    q('#te-note').value='si douleur > 4, max 3/jour';
    q('#te-ok')?.click(); await wait(800);
    t=q('#sheet')?.textContent||'';
    console.log('\n⑫ Section « Si besoin »:', t.includes('Si besoin'));
    console.log('   Mention sur la ligne:', !!q('.tr-sb'));
    // Imprimable
    q('#tr-print')?.click(); await wait(1000);
    const doc=q('#fp-frame')?.srcdoc||'';
    console.log('\n═══ FICHE IMPRIMABLE ═══');
    console.log('⑬ Titre:', doc.includes('FICHE DE TRAITEMENT'));
    console.log('⑭ Identité + naissance:', doc.includes('DÉMO-LEROY')&&doc.includes('30/06/1941'));
    console.log('⑮ Colonnes:', ['Matin','Midi','Soir','Coucher'].every(x=>doc.includes(x)));
    console.log('⑯ Eliquis en gras (anticoag):', doc.includes('<b>Eliquis'));
    console.log('⑰ Avertissement anticoagulant:', doc.includes('surveiller les saignements'));
    console.log('⑱ Section Si besoin:', doc.includes('Si besoin'));
    console.log('⑲ Vigilance + prescripteur:', doc.includes('pénicilline')&&doc.includes('Dr Démo'));
    console.log('⑳ Mention légale:', doc.includes('remplace pas la prescription'));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
