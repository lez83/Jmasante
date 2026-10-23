const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:true,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  slotMembers:{"A":{matin:["p1"],soir:["p1"]}},
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"",contacts:{},
    tours:["A"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    plan:["Toilette","Pilulier","Bas de contention","Injection insuline"],
    planSlots:{},visits:[]}],
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
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>false;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s),qa=s=>d.querySelectorAll(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  const onglet=()=>q('.ftab.on')?.dataset.tab;
  const coche=(soin,sl)=>[...qa('[data-ps]')].find(b=>b.dataset.ps===soin&&b.dataset.sl===sl);
  (async()=>{
    await wait(1000);
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(600);
    q('[data-edit]')?.click(); await wait(800);
    q('[data-tab="soins"]')?.click(); await wait(400);
    console.log('═══ COCHAGE EN SÉRIE ═══');
    console.log('① Onglet Soins actif:', onglet());
    // Cocher 4 cases d'affilée SANS revenir
    coche('Toilette','matin')?.click(); await wait(250);
    console.log('② Après 1re case — onglet:', onglet(), '| grille encore là:', !!q('.plangrid'));
    coche('Injection insuline','soir')?.click(); await wait(250);
    coche('Bas de contention','matin')?.click(); await wait(250);
    coche('Bas de contention','soir')?.click(); await wait(250);
    console.log('③ Après 4 cases — onglet:', onglet(), '(doit rester « soins »)');
    console.log('④ Cases cochées:', qa('.pg-b.on').length, '(attendu 4)');
    console.log('   Toilette ☀️:', coche('Toilette','matin')?.classList.contains('on'));
    console.log('   Injection 🌙:', coche('Injection insuline','soir')?.classList.contains('on'));
    console.log('   Bas ☀️ et 🌙:', coche('Bas de contention','matin')?.classList.contains('on') && coche('Bas de contention','soir')?.classList.contains('on'));
    // Décocher
    coche('Toilette','matin')?.click(); await wait(250);
    console.log('⑤ Décochage:', !coche('Toilette','matin')?.classList.contains('on'), '| onglet:', onglet());
    coche('Toilette','matin')?.click(); await wait(250);
    // Ajouter un soin à la volée
    q('#f-newplan').value = 'Pansement simple';
    q('#f-addplan')?.click(); await wait(500);
    console.log('\n═══ AJOUT À LA VOLÉE ═══');
    console.log('⑥ Onglet inchangé:', onglet());
    console.log('⑦ Nouvelle LIGNE (pas un chip):', qa('.pg-r').length, '(attendu 5)');
    const nv=[...qa('.pg-r')].find(r=>r.dataset.p==='Pansement simple');
    console.log('⑧ Avec ses 2 cases:', nv?.querySelectorAll('[data-ps]').length, '(attendu 2)');
    // Cocher le nouveau
    coche('Pansement simple','soir')?.click(); await wait(300);
    console.log('⑨ Case du nouveau soin fonctionne:', coche('Pansement simple','soir')?.classList.contains('on'));
    // Retirer un soin
    [...qa('[data-pdel]')].find(b=>b.dataset.pdel==='Pilulier')?.click(); await wait(400);
    console.log('⑩ Après retrait — lignes:', qa('.pg-r').length, '(attendu 4) | onglet:', onglet());
    // Enregistrer et vérifier la persistance
    q('#f-save')?.click(); await wait(800);
    d.querySelector('.pcard [data-toggle]')?.click(); await wait(500);
    q('[data-edit]')?.click(); await wait(800);
    q('[data-tab="soins"]')?.click(); await wait(400);
    console.log('\n═══ APRÈS ENREGISTREMENT ═══');
    console.log('⑪ Lignes:', qa('.pg-r').length, '(attendu 4)');
    console.log('⑫ Cases conservées:', qa('.pg-b.on').length, '(attendu 5)');
    console.log('⑬ Pansement présent:', !![...qa('.pg-r')].find(r=>r.dataset.p==='Pansement simple'));
    console.log('⑭ Pilulier retiré:', ![...qa('.pg-r')].find(r=>r.dataset.p==='Pilulier'));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
