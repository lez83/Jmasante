// Sous-rubriques d'« Autre » et catalogue « Autonomie & comportement ».
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  tours:["A"],curTour:"A",patientOrder:{"A":["p1"]},
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],tags:[],docs:[],plaies:[],
    infos:[{id:"t1",type:"traitement",txt:"Kardégic 75",show:false},
           {id:"a1",type:"acces",txt:"Code 1234",show:true}],
    visits:[{uid:"v1",date:iso,at:"08:15",soins:["Toilette"],consts:{},note:"",soinNotes:{}}]}],
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
  w.eval(appjs + '\n;window.__T={catParse,catCompose,catPret,autoCat,AUTO_CAT_DEF,recueilSetRub,recueilInfoRub,infoLabel,buildReleve,getP,autreRubs};');
  setTimeout(()=>{
    const T=w.__T; let ko=[];
    const ck=(lbl,c)=>{ console.log(`  ${c?'✓':'⚠'} ${lbl}`); if(!c) ko.push(lbl); };
    console.log('═══ NOTATION ═══');
    const C=(l,v)=>T.catCompose(T.catParse(l),v);
    ck('choix simple', C("Transferts [autonomes | avec aide]",{1:["avec aide"]})==="Transferts avec aide");
    ck('connecteur retiré si vide', C("Marche [1 soignant | 2 soignants] avec [guidage | soutien]",{1:["1 soignant"]})==="Marche 1 soignant");
    ck('plusieurs choix, séparés par « , »', C("Agressivité [insultes | cris / vociférations]",{1:["insultes","cris / vociférations"]})==="Agressivité insultes, cris / vociférations");
    ck('champ libre, espace avant « : »', C("Risque [faible | élevé] — Dernier épisode : [date]",{1:["élevé"],3:"12/09"})==="Risque élevé — Dernier épisode : 12/09");
    ck('rien choisi → pas prêt', !T.catPret(T.catParse("X [a | b]"),{}));
    console.log('\n═══ CATALOGUE ═══');
    const cat=T.autoCat();
    ck('4 sections pré-remplies', cat.length===4);
    const n=cat.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.items.length,0),0);
    ck(`${n} phrases`, n>=40);
    // Aucune phrase avec un « | » hors crochets ou crochets imbriqués
    const malformes=[]; cat.forEach(s=>s.groups.forEach(g=>g.items.forEach(l=>{
      if (/\[[^\]]*\[/.test(l) || l.replace(/\[[^\]]*\]/g,'').includes('|')) malformes.push(l);})));
    ck('notation bien formée partout', !malformes.length);
    console.log('\n═══ SOUS-RUBRIQUES ═══');
    const p=T.getP("p1");
    ck('3 sous-rubriques par défaut', T.autreRubs().map(r=>r.cle).join(",")==="appareillage,autonomie,libre");
    T.recueilSetRub(p,"autonomie","Alitement lié à l'état général\nTransferts avec aide");
    const inf=p.infos.find(i=>i.rub==="autonomie");
    ck('écrite avec sa sous-rubrique', inf && inf.type==="autre");
    ck('hors relève par défaut', inf && inf.show===false);
    ck('libellé de sous-rubrique', T.infoLabel(inf).lbl==="Autonomie & comportement");
    ck('relue ligne à ligne', T.recueilInfoRub(p,"autonomie").split("\n").length===2);
    ck('« autre » sans rubrique → Libre', T.infoLabel({type:"autre",txt:"x"}).lbl==="Libre");
    console.log('\n═══ RELÈVE ═══');
    const base={start:iso,end:iso,layout:"structure",withRaps:false};
    let r=T.buildReleve({...base,mode:"full"});
    ck('complète : autonomie absente', !r.includes("Alitement"));
    ck('complète : accès 👁 présent', r.includes("Code 1234"));
    r=T.buildReleve({...base,mode:"select",keep:new Set(["v1"]),tour:"A",
      pOpts:{p1:{consts:true,notes:true,bilans:true,raps:true,docs:false,infos:{t1:true,[inf.id]:true,a1:false}}}});
    ck('sélection : traitement coché inclus', r.includes("Kardégic"));
    ck('sélection : autonomie cochée incluse, sur une ligne', /Autonomie & comportement : Alitement[^\n]* · Transferts/.test(r));
    ck('sélection : accès décoché exclu', !r.includes("Code 1234"));
    ck('la fiche n\'est pas modifiée', inf.show===false && p.infos.find(i=>i.id==="a1").show===true);
    console.log('\nERREURS:', ko.length||errs.length ? (ko.concat(errs)).join(' · ') : 'aucune');
    process.exit(ko.length?1:0);
  }, 1500);
}
