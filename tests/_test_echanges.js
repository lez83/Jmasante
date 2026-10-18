// v1.0.58 — Échanges protégés : enveloppe multi-serrures, mot de passe,
// appairage sécurisé (ECDH) et rapide, réception, oubli d'un collègue.
// Deux instances de l'app (A et B) dans deux navigateurs simulés.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const base=(nom)=>({version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,
  identity:{nom:nom,prenom:nom,uid:"u-"+nom},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Secret-Patient",prenom:"Z",dob:"1940-01-01",genre:"F",address:"",contacts:{},tours:["A"],plan:[],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
  rappels:[],noVisit:{},trash:[],drafts:{}});
function app(nom){ return new Promise(res=>{
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'+nom});
  const w=dom.window;
  const {IDBFactory}=require('fake-indexeddb'); w.indexedDB=new IDBFactory();
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  w.__errs=[]; w.addEventListener('error',e=>w.__errs.push(e.message));
  // état initial dans l'IndexedDB propre à cette fenêtre
  const rq=w.indexedDB.open("transm_d2",1);
  rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
  rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
    tx.objectStore("kv").put(base(nom),"state");tx.oncomplete=()=>{db.close();
      w.__fichiers=[];
      w.eval(appjs + `\n;window.__B={ getS:()=>S, chiffrerPaquet, dechiffrerPaquet, nouvelleSessionSecure, recevoirCodeAppairage, lireCodeAppairage, genMotDePasse, ouvrirTexteRecu, sheetProtectionEnvoi, codeControle, sheetCollegues };
        partagerTexte = async (f,t)=>{ window.__fichiers.push({f,t}); return true; };`);
      setTimeout(()=>res(w),1400);
    }};
});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let errs=[]; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
(async()=>{
  const A=await app("Alice"), B=await app("Bruno");
  const a=A.__B, b=B.__B;
  console.log('═══ MOT DE PASSE ═══');
  const pw=a.genMotDePasse();
  ok(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d\d$/.test(pw),'mot de passe généré dictable ('+pw+')');
  const secret='{"_jmsync":1,"contenu":"Secret-Patient"}';
  const env1=await a.chiffrerPaquet(secret,{pw,pairs:[],tour:"A"});
  ok(!env1.includes('Secret-Patient'),'contenu illisible dans le fichier protégé');
  const e1=JSON.parse(env1);
  ok(e1.locks.length===1 && e1.locks[0].it===600000 && e1.locks[0].salt,'PBKDF2 600 000 itérations, sel aléatoire');
  ok(await b.dechiffrerPaquet(e1,pw)===secret,'bon mot de passe → contenu retrouvé');
  ok(await b.dechiffrerPaquet(e1,'mauvais')===null,'mauvais mot de passe → rien');
  const e1b=JSON.parse(await a.chiffrerPaquet(secret,{pw,pairs:[],tour:"A"}));
  ok(e1b.locks[0].salt!==e1.locks[0].salt,'sel différent à chaque fichier');

  console.log('═══ APPAIRAGE SÉCURISÉ (deux scans) ═══');
  const sa=await a.nouvelleSessionSecure(), sb=await b.nouvelleSessionSecure();
  ok(!/"k"/.test(Buffer.from(sa.code.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'),'base64').toString()),'le code sécurisé ne contient aucune clé secrète');
  const rA=await a.recevoirCodeAppairage(sb.code,sa);   // A scanne B
  const rB=await b.recevoirCodeAppairage(sa.code,sb);   // B scanne A
  const cA=a.getS().collegues[0], cB=b.getS().collegues[0];
  ok(cA && cB && cA.key===cB.key && cA.id===cB.id,'même clé et même identifiant des deux côtés');
  ok(rA.cc===rB.cc,'codes de contrôle identiques ('+rA.cc+')');
  ok(cA.nom==="Bruno Bruno" && cB.nom==="Alice Alice",'noms échangés par les codes');
  ok((await a.recevoirCodeAppairage(sa.code,sa))===null,'scanner son propre code est refusé');

  console.log('═══ APPAIRAGE RAPIDE (un scan) ═══');
  const C=await app("Chloe"); const c=C.__B;
  // Alice montre un code rapide à Chloé (simulé comme l'écran le fait)
  const key=Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), id='abcd1234abcd1234';
  const code='JMS1K.'+Buffer.from(JSON.stringify({n:"Alice Alice",k:key,i:id})).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  a.getS().collegues.push({id,nom:"Chloé",key,methode:"rapide",date:new Date().toISOString()});
  const rC=await c.recevoirCodeAppairage(code,null);
  ok(rC && c.getS().collegues[0].key===key,'un seul scan suffit en mode rapide');

  console.log('═══ UN FICHIER, PLUSIEURS SERRURES ═══');
  const S_A=a.getS();
  const pairs=S_A.collegues.map(x=>({id:x.id,key:x.key}));
  const env2=JSON.parse(await a.chiffrerPaquet(secret,{pw,pairs,tour:"A"}));
  ok(env2.locks.length===3,'3 serrures : mot de passe + Bruno + Chloé');
  ok(await b.dechiffrerPaquet(env2)===secret,'Bruno ouvre par son appairage, sans rien taper');
  ok(await c.dechiffrerPaquet(env2)===secret,'Chloé ouvre par son appairage');
  const D=await app("Dora"); const dd=D.__B;
  ok(await dd.dechiffrerPaquet(env2)===null,'un appareil non appairé ne peut pas ouvrir sans mot de passe');
  ok(await dd.dechiffrerPaquet(env2,pw)===secret,'… mais le mot de passe ouvre');

  console.log('═══ RÉCEPTION PAR L\'APP ═══');
  // fichier réservé aux appairés, reçu par Dora → message, rien importé
  const env3=await a.chiffrerPaquet(JSON.stringify(base("x")),{pw:null,pairs,tour:"A"});
  const nav=D.getS? null:null;
  dd.ouvrirTexteRecu(env3); await wait(400);
  ok(/réservé à des collègues appairés/.test(D.document.body.textContent),'appareil non appairé : message clair, pas de demande de mot de passe inutile');
  D.document.querySelectorAll('.dlg-veil [data-yes]').forEach(x=>x.click()); await wait(300);
  ok(D.__B.getS().patients.length===1,'rien importé chez Dora');
  // mot de passe retenu : 2e fichier ouvert sans rien demander
  b.getS().pwRecus={"Alice Alice|A":pw}; b.getS().collegues=[];
  const env4=await a.chiffrerPaquet(JSON.stringify({_jmsync:1,x:1}),{pw,pairs:[],tour:"A"});
  b.ouvrirTexteRecu(env4); await wait(2500);
  ok(!B.document.querySelector('#mdp-in'),'mot de passe retenu → aucune saisie demandée');
  ok(/synchro/i.test(B.document.querySelector('#toast').textContent),'… et la synchro est traitée normalement ('+B.document.querySelector('#toast').textContent.trim()+')');

  console.log('═══ ÉCRAN D\'ENVOI ═══');
  { const S=a.getS(); S.tourPw={}; S.envoiTour={A:{dest:[
    {id:"d1",nom:"Bruno",mode:"pair",cid:S.collegues[0].id},
    {id:"d2",nom:"Yann",mode:"libre",cid:null},
    {id:"d3",nom:"Zoé",mode:"pw",cid:null}]}}; S.aides={"envoi-protege":true,"libre-avert":true}; }
  a.sheetProtectionEnvoi("A",{json:secret,base:"synchro_test",titre:"T",texte:""}); await wait(300);
  const doc=A.document;
  ok(!!doc.querySelector('#pe-pwin'),'mot de passe demandé car Zoé est en 🔑');
  ok(/Bruno, Zoé/.test(doc.querySelector('#pe-prot').textContent) && /Yann/.test(doc.querySelector('#pe-lib').textContent),'X+Z dans le fichier protégé, Y dans le libre');
  doc.querySelector('#pe-pwin').value='court'; doc.querySelector('#pe-prot').click(); await wait(200);
  ok(!A.__fichiers.length,'mot de passe trop court refusé');
  doc.querySelector('#pe-pwin').value=pw; doc.querySelector('#pe-prot').click(); await wait(2500);
  const fp=A.__fichiers.find(f=>/_PROTEGE\.json$/.test(f.f));
  ok(!!fp && !fp.t.includes('Secret-Patient'),'fichier …_PROTEGE.json produit, chiffré');
  ok(a.getS().tourPw.A && a.getS().tourPw.A.pw===pw,'mot de passe retenu pour la tournée');
  doc.querySelector('#pe-lib').click(); await wait(300);
  const fl=A.__fichiers.find(f=>/_LIBRE\.json$/.test(f.f));
  ok(!!fl && fl.t===secret,'fichier …_LIBRE.json produit en clair (avertissement masqué)');

  console.log('═══ OUBLIER UN COLLÈGUE ═══');
  a.sheetCollegues(); await wait(200);
  doc.querySelector('[data-oubli]').click(); await wait(250);
  doc.querySelector('.dlg-veil [data-yes]').click(); await wait(300);
  const dB=a.getS().envoiTour.A.dest.find(d=>d.nom==="Bruno");
  ok(!a.getS().collegues.find(x=>x.nom==="Bruno Bruno") && dB.mode==="pw" && !dB.cid,'collègue oublié → passe en mot de passe dans la tournée');

  [A,B,C,D].forEach(w=>errs.push(...w.__errs));
  console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
  process.exit(0);
})();
