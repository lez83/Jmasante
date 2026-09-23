const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const j=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
const st={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:j(0),
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  tours:["A"],curTour:"A",patientOrder:{A:["p1"]},
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],tags:[],infos:[],docs:[],plaies:[],
    visits:[
      {uid:"v1",date:j(2),at:"08:00",soins:["Toilette"],consts:{ta:"13/7",puls:"70"},constRel:true,note:"",soinNotes:{}},
      {uid:"v2",date:j(1),at:"08:00",soins:["Toilette"],consts:{ta:"14/8",puls:"72"},note:"",soinNotes:{}},
      {uid:"v3",date:j(0),at:"08:00",soins:["Toilette"],consts:{ta:"160/95",puls:"71"},constRel:true,note:"",soinNotes:{}}]}],
  rappels:[],noVisit:{},trash:[],drafts:{}};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  tx.objectStore("kv").put(st,"state");tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>','').replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  w.eval(appjs+';window.__T={buildReleve,alertes,taSysDia,taIncoherente,tendanceDe:(typeof tendance!=="undefined"?tendance:null),getP};');
  setTimeout(()=>{
    const T=w.__T;
    let ko=[]; const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
    console.log('═══ ① CONSTANTES : SEULEMENT LES JOURS COCHÉS ═══');
    const r=T.buildReleve({start:j(2),end:j(0),mode:"full",layout:"structure",withRaps:false});
    ck('13/7 du jour coché : présente', r.includes("13/7"));
    ck('14/8 du jour NON coché : absente', !r.includes("14/8"));
    ck('160/95 du jour coché : présente', r.includes("160/95"));
    console.log('\n═══ ② TENSION EN mm Hg ═══');
    [["13/7",13,7],["130/70",13,7],["160/95",16,9.5],["13/77",13,7.7]].forEach(([v,sy,di])=>{
      const x=T.taSysDia(v);
      ck(`${v} lu ${x.sys}/${x.dia}`, x.sys===sy && Math.abs(x.dia-di)<0.01);
    });
    ck('alerte identique en mm et en cm',
       T.alertes({ta:"160/95"}).length===1 && T.alertes({ta:"16/9.5"}).length===1);
    ck('tension normale : aucune alerte', T.alertes({ta:"130/70"}).length===0);
    ck('mélange 13/77 signalé, 130/77 accepté', T.taIncoherente("13/77") && !T.taIncoherente("130/77"));

    console.log('\n═══ ③ SAISIE GARDÉE : EFFACÉE À LA VALIDATION ═══');
    const ui = require('fs').readFileSync('../jmsante/www/js/ui.js','utf-8');
    const seq = require('fs').readFileSync('../jmsante/www/js/seq.js','utf-8');
    // Chaque chemin de validation supprime le brouillon, et l'état est enregistré
    ck('tous les chemins de validation l\'effacent', (ui.match(/oublierBrouillon\(p\.id\)/g)||[]).length >= 4);
    ck('effacement par clé ET par pid', /d\[k\] && d\[k\]\.pid === pid/.test(ui));
    ck('« pas de passage » l\'efface aussi', /noVisit\[p\.id\][\s\S]{0,260}oublierBrouillon\(p\.id\)/.test(seq));
    ck('étiquette ouvrable et datée', /data-draft=/.test(ui) && /saisie gardée\$\{/.test(ui));
    ck('carte : enregistrement après validation', /commitVisit\(false\)[\s\S]{0,200}save\(true\)/.test(ui));
    ck('déroulé : enregistrement après validation', /_commitVisit\(true\)[\s\S]{0,120}save\(true\)/.test(seq));

    console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
    process.exit(ko.length?1:0);
  },1500);
}
