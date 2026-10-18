const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"Démo",prenom:"Jean-Marie",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Leroy",prenom:"Colette",dob:"1941-06-30",genre:"F",
    address:"1 rue de la Démonstration, 00000 Villeneuve",
    nir:"2 41 06 83 137 025 44",
    prevenir:{nom:"Mme Martin (fille)",tel:"06 12 34 56 78"},
    appareillages:"Pacemaker (2021)",
    contacts:{med:{nom:"Dr Démo",tel:"00 00 00 00 00"},pharma:{nom:"Pharmacie du Port",tel:"00 00 11 11 11"}},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],
    infos:[{id:"i1",type:"vigilance",txt:"Allergie pénicilline",show:true},
           {id:"i2",type:"traitement",txt:"Furosémide 40 (1-0-0) · Eliquis 2,5 (1-0-1)",show:false},
           {id:"i3",type:"atcd",txt:"HTA, insuffisance cardiaque, PTH droite 2019",show:false},
           {id:"i4",type:"acces",txt:"Code 0000, 2e étage sans ascenseur",show:true}],
    visits:[]}],
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
        console.log('═══ FICHE PATIENT ═══');
        console.log('① Champ n° sécu:', !!q('#f-nir'), '| valeur:', JSON.stringify(q('#f-nir')?.value||''));
        console.log('② Personne à prévenir:', !!q('#f-pap-nom'), JSON.stringify(q('#f-pap-nom')?.value||''));
        console.log('③ Appareillages:', !!q('#f-appar'), JSON.stringify(q('#f-appar')?.value||''));
        console.log('④ Bouton DLU rouge:', !!q('#f-dlu'), '|', q('#f-dlu')?.textContent.trim());
        q('#f-dlu').click();
        setTimeout(()=>{
          console.log('\n═══ ÉCRAN DLU ═══');
          const t=q('#sheet').textContent||'';
          console.log('⑤ Repris de la fiche:', t.includes('Repris de la fiche'));
          console.log('   Allergie visible:', t.includes('pénicilline'));
          console.log('   Traitement:', t.includes('Furosémide'));
          console.log('   Accès:', t.includes('0000'));
          console.log('   À prévenir:', t.includes('Mme Martin'));
          console.log('⑥ Champs manquants signalés:', t.includes('À compléter') ? 'oui' : 'non (tout est rempli)');
          console.log('⑦ Autonomie VIERGE:', JSON.stringify(q('#dlu-auto-txt')?.value||''), '(attendu "")');
          console.log('⑧ Constantes du jour:', d.querySelectorAll('.dlu-cst input').length, 'champs');
          console.log('⑨ Trois sorties:', !!q('#dlu-show'), !!q('#dlu-share'), !!q('#dlu-print'));
          // Remplir et générer
          q('#dlu-auto-txt').value="Marche avec déambulateur, orientée, vit seule";
          q('#dlu-ta').value="17/10"; q('#dlu-puls').value="112"; q('#dlu-sat').value="91";
          q('#dlu-motif').value="Chute vers 14h dans la salle de bain. Douleur vive hanche droite, impossible de se relever.";
          ['#dlu-auto-txt','#dlu-ta','#dlu-puls','#dlu-sat','#dlu-motif'].forEach(s=>
            q(s).dispatchEvent(new w.Event('input',{bubbles:true})));
          setTimeout(()=>{
            q('#dlu-show').click();
            setTimeout(()=>{
              const doc=q('#fp-frame')?.srcdoc||'';
              console.log('\n═══ DOCUMENT GÉNÉRÉ ═══');
              console.log('⑩ Affiché dans l app:', !!q('#fichePrev'), '| bouton retour:', !!q('#fp-back'));
              console.log('   Titre DLU:', doc.includes("DOSSIER DE LIAISON D'URGENCE"));
              console.log('   Identité + n° sécu:', doc.includes('DÉMO-LEROY') && doc.includes('137 025 44'));
              console.log('   ⚠ Vigilances:', doc.includes('Vigilances') && doc.includes('pénicilline'));
              console.log('   Anticoagulant détecté:', doc.includes('anticoagulant'), '(Eliquis reconnu)');
              console.log('   Pacemaker:', doc.includes('Pacemaker'));
              console.log('   Motif du jour:', doc.includes('salle de bain'));
              console.log('   Constantes anormales en rouge:', (doc.match(/class="cbad"/g)||[]).length, '(TA, pouls, sat)');
              console.log('   Autonomie:', doc.includes('déambulateur'));
              console.log('   Accès domicile:', doc.includes('0000'));
              console.log('   À prévenir + médecin:', doc.includes('Mme Martin') && doc.includes('Dr Démo'));
              console.log('   Signature IDEL:', doc.includes('Démo'));
              console.log('\nERREURS:', errs.length?errs:'aucune');
            },700);
          },300);
        },600);
      },500);
    },400);
  },900);
}
