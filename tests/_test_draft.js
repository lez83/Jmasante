const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:true,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Martin",prenom:"Colette",dob:"1950-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette","Pilulier"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
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
  w.URL.createObjectURL=()=>'blob:x';
  let asked=[]; w.confirm=(m)=>{asked.push(m);return true;};
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs);
  const d=w.document,q=s=>d.querySelector(s);
  const openCard=()=>{const c=[...d.querySelectorAll('.pcard')].find(x=>x.textContent.includes('MARTIN'));
    c?.querySelector('[data-toggle]')?.click();};
  setTimeout(()=>{
    openCard();
    setTimeout(()=>{
      console.log('═══ LES TROIS BOUTONS ═══');
      console.log('Annuler:', !!q('[data-cancel]'), '| Enregistrer:', !!q('[data-keep]'), '| Valider:', !!q('[data-save]'));
      // Cocher un soin + note, puis ENREGISTRER
      [...d.querySelectorAll('.chip[data-s]')][0]?.click();
      q('[data-note]').value = "Dr Démo a appele, changement de traitement";
      setTimeout(()=>{
        q('[data-keep]').click();
        setTimeout(()=>{
          console.log('\n═══ APRÈS ENREGISTRER ═══');
          const nm=[...d.querySelectorAll('.pcard')].map(x=>x.textContent).join(' ');
          console.log('① Patient toujours « à voir »:', !nm.includes('vu aujourd'), '(attendu true)');
          console.log('② Repère « saisie en attente »:', nm.includes('saisie en attente'));
          console.log('③ Compteur À voir:', q('.spill .n')?.textContent, '(attendu 1)');
          // Rouvrir : la saisie doit être là
          openCard();
          setTimeout(()=>{
            const note=q('[data-note]')?.value||'';
            const soins=[...d.querySelectorAll('.chip[data-s].on')].length;
            console.log('\n═══ RÉOUVERTURE ═══');
            console.log('④ Note retrouvée:', note.includes('Dr Démo'), '|', JSON.stringify(note.slice(0,30)));
            console.log('⑤ Soin toujours coché:', soins>0);
            // Valider maintenant
            q('[data-save]').click();
            setTimeout(()=>{
              const nm2=[...d.querySelectorAll('.pcard')].map(x=>x.textContent).join(' ');
              console.log('\n═══ APRÈS VALIDATION ═══');
              console.log('⑥ Patient vu:', nm2.includes('vu aujourd'));
              console.log('⑦ Repère effacé:', !nm2.includes('saisie en attente'));
              // DOUBLON : revalider
              asked=[];
              openCard();
              setTimeout(()=>{
                [...d.querySelectorAll('.chip[data-s]')][1]?.click();
                setTimeout(()=>{
                  q('[data-save]').click();
                  setTimeout(()=>{
                    console.log('\n═══ DOUBLON ═══');
                    console.log('⑧ Question posée:', asked.length>0);
                    if(asked[0]) console.log('   « '+asked[0].split('\n')[0]+' »');
                    console.log('\nERREURS:', errs.length?errs:'aucune');
                  },500);
                },300);
              },400);
            },600);
          },500);
        },500);
      },300);
    },500);
  },900);
}
