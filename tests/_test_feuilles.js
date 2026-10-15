const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const d=n=>new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:true,
  identity:{nom:"Démo",prenom:"Jean-Marie",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],
    thresholds:{taHigh:15,satLow:94},
    visits:[
      {uid:"v1",date:d(1),at:"08:00",slot:"am",soins:["Toilette"],consts:{ta:"17/10",puls:"112",sat:"91",temp:"36.8"},note:""},
      {uid:"v2",date:d(3),at:"08:05",slot:"am",soins:["Toilette"],consts:{ta:"14/8",puls:"78",sat:"97",temp:"36.6"},note:""},
      {uid:"v3",date:d(5),at:"08:10",slot:"am",soins:["Toilette"],consts:{ta:"13/8",puls:"82",sat:"98",glyc:"1.24"},note:""},
      {uid:"v4",date:d(7),at:"08:02",slot:"am",soins:["Toilette"],consts:{ta:"14/9",puls:"75",sat:"96"},note:""},
      {uid:"v5",date:d(9),at:"08:15",slot:"am",soins:["Toilette"],consts:{ta:"15/9",puls:"88",sat:"95"},note:""}]}],
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
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs);
  const doc=w.document,q=s=>doc.querySelector(s);
  setTimeout(()=>{
    const c=doc.querySelector('.pcard'); c?.querySelector('[data-toggle]')?.click();
    setTimeout(()=>{
      doc.querySelector('[data-edit]')?.click();
      setTimeout(()=>{
        console.log('① Bouton Feuilles domicile:', !!q('#f-feuilles'));
        q('#f-feuilles').click();
        setTimeout(()=>{
          console.log('\n═══ FEUILLES DOMICILE ═══');
          console.log('② Trois feuilles:', [...doc.querySelectorAll('[data-ft]')].map(b=>b.dataset.ft).join(' · '));
          console.log('③ Deux densités:', [...doc.querySelectorAll('[data-fd2]')].map(b=>b.dataset.fd2).join(' · '));
          q('#fe2-show').click();
          setTimeout(()=>{
            const s=q('#fp-frame')?.srcdoc||'';
            console.log('\n④ FEUILLE CONSTANTES (serrée) :');
            console.log('   Titre:', s.includes('SURVEILLANCE DES CONSTANTES'));
            console.log('   Identité:', s.includes('DÉMO-LEROY') && s.includes('30/06/1941'));
            console.log('   Jours 1 à 31:', (s.match(/class="jr">/g)||[]).length, '(attendu 31)');
            console.log('   Colonne Douleur:', s.includes('Doul.'));
            console.log('   Pas de colonne Heure:', !s.includes('>H.<'));
            console.log('   Seuil PERSONNALISÉ du patient:', s.includes('&gt; 15'), '(taHigh=15, pas 16)');
            console.log('   Sat personnalisée:', s.includes('&lt; 94'), '(satLow=94)');
            console.log('   Pas de mention cabinet:', !s.includes('Cabinet'));
            console.log('   Une seule page:', !s.includes('class="pg brk"'));
            // Densité confortable
            q('#fp-back').click();
            setTimeout(()=>{
              doc.querySelector('[data-fd2="confort"]')?.click();
              setTimeout(()=>{
                q('#fe2-show').click();
                setTimeout(()=>{
                  const s2=q('#fp-frame')?.srcdoc||'';
                  console.log('\n⑤ DENSITÉ CONFORTABLE (recto-verso) :');
                  console.log('   Deux pages:', s2.includes('class="pg brk"'));
                  console.log('   En-tête répété au verso:', (s2.match(/SURVEILLANCE DES CONSTANTES/g)||[]).length, '(attendu 2)');
                  console.log('   Mention (suite):', s2.includes('(suite)'));
                  console.log('   Note « suite au verso »:', s2.includes('Suite au verso'));
                  console.log('   Jours 1-16 puis 17-31:', (s2.match(/class="jr">/g)||[]).length, '(attendu 31 au total)');
                  // Feuille POIDS : date libre
                  q('#fp-back').click();
                  setTimeout(()=>{
                    doc.querySelector('[data-ft="poids"]')?.click();
                    setTimeout(()=>{
                      q('#fe2-show').click();
                      setTimeout(()=>{
                        const s3=q('#fp-frame')?.srcdoc||'';
                        console.log('\n⑥ FEUILLE POIDS :');
                        console.log('   Date LIBRE (pas de jours):', (s3.match(/class="jr">/g)||[]).length===0, '(attendu true)');
                        console.log('   Colonne Date:', s3.includes('>Date<'));
                        console.log('   Pas d œdèmes:', !s3.includes('dèmes'));
                        console.log('   Courbe présente:', s3.includes('class="crb"'));
                        console.log('   Poids de référence:', s3.includes('Poids de référence'));
                        // GLYCÉMIES
                        q('#fp-back').click();
                        setTimeout(()=>{
                          doc.querySelector('[data-ft="glycemies"]')?.click();
                          setTimeout(()=>{
                            q('#fe2-show').click();
                            setTimeout(()=>{
                              const s4=q('#fp-frame')?.srcdoc||'';
                              console.log('\n⑦ FEUILLE GLYCÉMIES :');
                              console.log('   Matin/Midi/Soir:', s4.includes('Matin')&&s4.includes('Midi')&&s4.includes('Soir'));
                              console.log('   PAS de Coucher:', !s4.includes('Coucher'), '(attendu true)');
                              console.log('   Colonnes UI:', (s4.match(/>UI</g)||[]).length, '(attendu 3)');
                              console.log('\nERREURS:', errs.length?errs:'aucune');
                            },600);
                          },400);
                        },300);
                      },600);
                    },400);
                  },300);
                },600);
              },400);
            },300);
          },700);
        },500);
      },400);
    },400);
  },900);
}
