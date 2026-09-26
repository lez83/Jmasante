// v1.0.59 — Clé locale v2 : des données écrites avec l'ancienne clé
// (sel fixe, 100 000 it.) sont lues, puis migrées en arrière-plan vers
// la clé v2 (sel aléatoire, 600 000 it.) ; relecture après redémarrage.
const fs=require('fs');const {JSDOM}=require('jsdom');
const {IDBFactory}=require('fake-indexeddb');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const idb=new IDBFactory();
const b64=u=>Buffer.from(u).toString('base64');
async function ancienneCle(secret){
  const m=await webcrypto.subtle.importKey("raw",new TextEncoder().encode(secret),"PBKDF2",false,["deriveKey"]);
  return webcrypto.subtle.deriveKey({name:"PBKDF2",salt:new TextEncoder().encode("jmsante_v1"),iterations:100000,hash:"SHA-256"},m,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function chiffreV1(key,obj){ const iv=webcrypto.getRandomValues(new Uint8Array(12));
  const c=await webcrypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(obj)));
  return {_enc:true,iv:b64(iv),data:b64(new Uint8Array(c))}; }
const state={version:1,theme:"original",retention:12,pin:null,lastGreeting:iso,avertLu:true,pinNudge:5,
  identity:{nom:"N",prenom:"P",uid:"u"},catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Martin",prenom:"Josette",dob:"1940-01-01",genre:"F",address:"",contacts:{},tours:["A"],plan:[],archived:null,bilans:[],
    docs:[{id:"d1",name:"ordo.pdf"},{id:"d2",name:"photo.jpg"}],tags:[],infos:[],visits:[]}],rappels:[],noVisit:{},trash:[],drafts:{}};
function ecrire(pairs){ return new Promise(res=>{ const rq=idb.open("transm_d2",1);
  rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
  rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
    for (const [k,v] of pairs) tx.objectStore("kv").put(v,k);
    tx.oncomplete=()=>{db.close();res();}}; }); }
function lire(k){ return new Promise(res=>{ const rq=idb.open("transm_d2",1);
  rq.onsuccess=()=>{const db=rq.result;const r=db.transaction("kv").objectStore("kv").get(k);r.onsuccess=()=>{db.close();res(r.result);}}; }); }
function lancer(){ return new Promise(res=>{
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
     .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window; w.indexedDB=idb;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x'; w.__errs=[]; w.addEventListener('error',e=>w.__errs.push(e.message));
  w.eval(appjs+'\n;window.__B={getS:()=>S, idbGet};');
  res(w);
});}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
let errs=[]; const ok=(c,m)=>{ console.log((c?'  ✓ ':'  ✗ ')+m); if(!c) errs.push(m); };
(async()=>{
  const secret=b64(webcrypto.getRandomValues(new Uint8Array(32)));
  const k1=await ancienneCle(secret);
  await ecrire([["__secret__",secret],["state",await chiffreV1(k1,state)],
    ["doc_d1",await chiffreV1(k1,"data:application/pdf;base64,AAAA")],["doc_d2","data:image/jpeg;base64,BBBB"]]);
  console.log('═══ PREMIER LANCEMENT (données en ancienne clé) ═══');
  let w=await lancer(); await wait(2500);
  ok(w.__B.getS() && w.__B.getS().patients[0].nom==="Martin",'état lu avec l\'ancienne clé');
  ok(await w.__B.idbGet("doc_d1")==="data:application/pdf;base64,AAAA",'document ancien lisible');
  await wait(7000);
  const kdf=await lire("__kdf__");
  ok(kdf && kdf.salt && kdf.it===600000,'sel aléatoire créé, 600 000 itérations');
  const st=await lire("state"), d1=await lire("doc_d1"), d2=await lire("doc_d2");
  ok(st.k===2 && d1.k===2,'état et document réécrits avec la clé v2');
  ok(d2._enc && d2.k===2,'document resté en clair : chiffré au passage');
  ok(w.__B.getS().kdfMigre===true,'migration marquée terminée');
  errs.push(...w.__errs);
  console.log('═══ REDÉMARRAGE ═══');
  w=await lancer(); await wait(3000);
  ok(w.__B.getS() && w.__B.getS().patients[0].prenom==="Josette",'état relu avec la clé v2');
  ok(await w.__B.idbGet("doc_d2")==="data:image/jpeg;base64,BBBB",'document relu avec la clé v2');
  ok(JSON.stringify(await lire("__kdf__"))===JSON.stringify(kdf),'le sel ne change pas d\'un lancement à l\'autre');
  errs.push(...w.__errs);
  console.log('\nERREURS:', errs.length? errs.join(' | ') : 'aucune');
  process.exit(0);
})();
