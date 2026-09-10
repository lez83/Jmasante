const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{},tours:["A","B"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",
    address:"1 rue de la Démonstration",nir:"2 41 06 83 137 025 44",
    prevenir:{nom:"Mme Martin (fille)",tel:"06 12 34 56 78"},
    appareillages:"Pacemaker (2021)",
    contacts:{med:{nom:"Dr Démo",tel:"00 00 00 00 00"},pharma:{nom:"Pharmacie du Port",tel:"00 00 11"}},
    thresholds:{ta_h:15,sat_b:94},
    tours:["A"],plan:["Toilette","Pilulier"],archived:null,bilans:[],docs:[],tags:[],
    infos:[{id:"i1",type:"vigilance",txt:"Allergie pénicilline",show:true}],visits:[]}],
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
  const d=w.document,q=s=>d.querySelector(s);
  setTimeout(()=>{
    const c=d.querySelector('.pcard'); c?.querySelector('[data-toggle]')?.click();
    setTimeout(()=>{
      d.querySelector('[data-edit]')?.click();
      setTimeout(()=>{
        console.log('═══ ONGLETS ═══');
        const tabs=[...d.querySelectorAll('.ftab')];
        console.log('① Onglets:', tabs.map(t=>t.dataset.tab).join(' · '), '(attendu 4)');
        console.log('② Actif au départ:', d.querySelector('.ftab.on')?.dataset.tab);
        console.log('\n═══ AUCUNE DONNÉE PERDUE ═══');
        const champs={'f-nom':'Nom','f-prenom':'Prénom','f-dob':'Naissance','f-nir':'N° sécu',
          'f-addr':'Adresse','f-pap-nom':'À prévenir','f-appar':'Appareillages',
          'f-infos':'Infos typées','f-plan':'Plan de soins','f-tours':'Tournées'};
        let ok=0;
        for(const [id,lbl] of Object.entries(champs)){
          const e=q('#'+id); if(e) ok++; else console.log('   ✗ MANQUANT:', lbl);
        }
        console.log('③ Champs présents:', ok+'/'+Object.keys(champs).length);
        console.log('   Valeurs conservées — nom:', JSON.stringify(q('#f-nom')?.value),
          '| sécu:', JSON.stringify(q('#f-nir')?.value?.slice(0,8)+'…'));
        console.log('④ Contacts (annuaire):', d.querySelectorAll('.f-contact-name').length, 'champs');
        console.log('⑤ Seuils personnalisés:', d.querySelectorAll('.f-th').length, 'champs');
        console.log('⑥ Boutons d action:', !!q('#f-dlu'), !!q('#f-feuilles'), !!q('#f-export'), !!q('#f-pec'), !!q('#f-arch'), !!q('#f-del'));
        // Basculer entre onglets
        d.querySelector('[data-tab="soins"]')?.click();
        setTimeout(()=>{
          console.log('\n⑦ Après bascule vers Soins :');
          console.log('   Onglet actif:', d.querySelector('.ftab.on')?.dataset.tab);
          console.log('   Panneau visible:', d.querySelector('.fpane.on')?.dataset.pane);
          // Enregistrement : les données des autres onglets doivent survivre
          q('#f-save').click();
          setTimeout(()=>{
            // Rouvrir la fiche : si les données sont perdues, ça se verra
            const c2=d.querySelector('.pcard'); c2?.querySelector('[data-toggle]')?.click();
            setTimeout(()=>{
              d.querySelector('[data-edit]')?.click();
              setTimeout(()=>{
                const pp={nom:q('#f-nom')?.value, nir:q('#f-nir')?.value,
                  address:q('#f-addr')?.value, prevenir:{nom:q('#f-pap-nom')?.value},
                  appareillages:q('#f-appar')?.value,
                  contacts:{n:d.querySelectorAll('.f-contact-name').length},
                  thresholds:{n:[...d.querySelectorAll('.f-th')].filter(i=>i.value).length},
                  plan:[...d.querySelectorAll('#f-plan .chip')].map(x=>x.textContent),
                  infos:[...d.querySelectorAll('.info-row')]};
                console.log('\n⑧ APRÈS ENREGISTREMENT (depuis l onglet Soins) :');
                console.log('   Nom:', pp.nom, '| n° sécu conservé:', !!pp.nir);
                console.log('   Adresse:', !!pp.address, '| À prévenir:', !!(pp.prevenir||{}).nom);
                console.log('   Appareillages:', !!pp.appareillages, '| Contacts:', pp.contacts.n);
                console.log('   Seuils remplis:', pp.thresholds.n, '| Plan:', pp.plan.length, 'soins');
                console.log('   Infos typées:', (pp.infos||[]).length);
                console.log('\nERREURS:', errs.length?errs:'aucune');
              },500);
            },400);
          },600);
        },400);
      },500);
    },400);
  },900);
}
