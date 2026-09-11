const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"",contacts:{},
    tours:["A"],plan:[],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
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
  w.URL.createObjectURL=()=>'blob:x';
  let cnf=[],prm=[],rep="";
  w.confirm=(m)=>{cnf.push(m);return true;};
  w.prompt=(m)=>{prm.push(m);return rep;};
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s);
  const open=()=>{const c=d.querySelector('.pcard'); c?.querySelector('[data-toggle]')?.click();};
  setTimeout(()=>{
    open();
    setTimeout(()=>{
      d.querySelector('[data-edit]')?.click();
      setTimeout(()=>{
        console.log('═══ DISPOSITION ═══');
        console.log('① Liste d actions:', d.querySelectorAll('.factions').length, '(attendu 2)');
        console.log('② Séparateur:', !!q('.fsep'), '| intitulé « Retirer ce dossier »:', (q('#sheet').textContent||'').includes('Retirer ce dossier'));
        console.log('③ Libellé adouci:', q('#f-del')?.textContent.trim());
        // Tentative de suppression avec MAUVAIS nom
        rep="nimportequoi";
        q('#f-del').click();
        setTimeout(()=>{
          console.log('\n═══ GARDE-FOU ═══');
          console.log('④ Confirmation demandée:', cnf.length>0);
          if(cnf[0]) console.log('   « '+cnf[0].split('\n')[0]+' »');
          console.log('⑤ Saisie du nom demandée:', prm.length>0, '(2e barrière)');
          const restant=d.querySelectorAll('.pcard').length;
          console.log('⑥ Mauvais nom → patient CONSERVÉ:', restant===1, '(attendu true)');
          // Bon nom
          rep="DÉMO-LEROY"; cnf=[];prm=[];
          d.querySelector('[data-edit]')?.click();
          setTimeout(()=>{
            q('#f-del')?.click();
            setTimeout(()=>{
              console.log('⑦ Bon nom → suppression effective:', d.querySelectorAll('.pcard').length===0);
              console.log('\nERREURS:', errs.length?errs:'aucune');
            },500);
          },500);
        },500);
      },500);
    },400);
  },900);
}
