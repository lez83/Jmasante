const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const d=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const vis=(u,dt,c)=>({uid:u,date:dt,at:"08:00",soins:["Toilette"],consts:c||{},note:""});
const mk=(id,nom,visits)=>({id,nom,prenom:"X",dob:"1950-01-01",genre:"F",address:"",contacts:{},
  tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"C",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1","p2"]},tours:["A"],curTour:"A",
  patients:[
    // p1 : 3 vieux (>6 mois) + 1 récent
    mk("p1","Ancien",[vis("a1",d(220),{ta:"14/8"}),vis("a2",d(210),{ta:"15/9"}),vis("a3",d(200)),vis("a4",d(2),{ta:"13/8"})]),
    // p2 : 2 vieux — sera DÉCOCHÉ
    mk("p2","Garde",[vis("b1",d(215),{glyc:"1.2"}),vis("b2",d(205),{glyc:"1.4"})])],
  rappels:[],noVisit:{},trash:[]};
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
  let saved=null;
  const OB=w.Blob; w.Blob=function(pr,o){ if(pr&&pr[0]) saved=String(pr[0]); return new OB(pr,o); };
  w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
  let cnf=[]; w.confirm=m=>{cnf.push(m);return true;};
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs);
  const doc=w.document,q=s=>doc.querySelector(s),qa=s=>doc.querySelectorAll(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1000);
    q('[data-a="tours"]')?.click(); await wait(700);
    doc.querySelector('[data-sec="app"]')?.click(); await wait(600);
    console.log('① Bouton Ménage:', !!q('#go-menage'));
    q('#go-menage')?.click(); await wait(700);
    console.log('\n═══ ÉCRAN MÉNAGE ═══');
    console.log('② Étape 1 — quoi:', qa('[data-mw]').length, '(passages + constantes)');
    console.log('③ Étape 2 — périodes:', qa('[data-mp]').length, '(3m/6m/1a/libre)');
    console.log('④ Étape 3 — patients:', qa('[data-mpp]').length, '(attendu 2)');
    console.log('⑤ Étape 4 — formats:', [...qa('[data-mf]')].map(b=>b.dataset.mf).join(' · '));
    let t=q('#sheet').textContent||'';
    console.log('⑥ Récapitulatif:', (q('.mn-recap')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,60));
    console.log('⑦ Suppression BLOQUÉE:', q('#mn-del')?.disabled===true, '(attendu true)');
    console.log('   Libellé:', q('#mn-del')?.textContent.trim());
    console.log('⑧ Lien « sans archiver »:', !!q('#mn-skip'));
    // Décocher p2
    [...qa('[data-mpp]')].find(b=>b.dataset.mpp==='p2')?.click(); await wait(400);
    t=q('#sheet').textContent||'';
    console.log('\n⑨ Après décochage de GARDE:', (q('.mn-recap')?.textContent||'').replace(/\s+/g,' ').trim().slice(0,60), '(attendu 3)');
    // Archiver
    q('#mn-arch')?.click(); await wait(900);
    console.log('\n═══ ARCHIVE ═══');
    console.log('⑩ Fichier produit:', !!saved, '|', saved?Math.round(saved.length/1024)+' Ko':'');
    console.log('   Contient ANCIEN:', (saved||'').includes('ANCIEN'));
    console.log('   Contient GARDE (décoché):', (saved||'').includes('GARDE'), '(attendu false)');
    console.log('⑪ Suppression maintenant ACTIVE:', q('#mn-del')?.disabled===false);
    // Supprimer
    cnf=[];
    q('#mn-del')?.click(); await wait(900);
    console.log('\n═══ APRÈS SUPPRESSION ═══');
    console.log('⑫ Confirmation demandée:', cnf.length>0);
    if(cnf[0]) console.log('   « '+cnf[0].split('\n')[0]+' »');
    await wait(600);
    // Ouvrir l'historique de chaque patient pour compter
    const openHist = async (nom)=>{
      const c=[...qa('.pcard')].find(x=>x.textContent.toUpperCase().includes(nom));
      c?.querySelector('[data-toggle]')?.click(); await wait(500);
      doc.querySelector('[data-hist]')?.click(); await wait(600);
      const n=qa('#sheet .selv').length;
      q('#veil')?.classList.remove('on'); await wait(300);
      return n;
    };
    console.log('⑬ ANCIEN : passages restants:', await openHist('ANCIEN'), '(attendu 1 — le récent)');
    console.log('⑭ GARDE (décoché) : intact:', await openHist('GARDE'), '(attendu 2)');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
