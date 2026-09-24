// Une sauvegarde faite sur l'appareil A est-elle lisible sur l'appareil B ?
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"Démo",prenom:"JM",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Martin",prenom:"Renée",dob:"1938-04-12",genre:"F",
    address:"1 rue de la Démonstration",cp:"00000",ville:"Villeneuve",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],
    docs:[{id:"d1",name:"Ordonnance.pdf",date:iso}],tags:[],
    infos:[{id:"i1",type:"vigilance",txt:"Allergie pénicilline",show:true}],
    visits:[{uid:"v1",date:iso,at:"06:29",soins:["Toilette"],consts:{ta:"14/8"},note:"RAS"}]}],
  rappels:[],noVisit:{},trash:[],drafts:{}};
function ouvrir(seed, docData, cb){
  const rq=indexedDB.open("transm_d2",1);
  rq.onupgradeneeded=e=>{try{e.target.result.createObjectStore("kv")}catch(x){}};
  rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
    const o=tx.objectStore("kv");
    if(seed) o.put(seed,"state");
    if(docData) o.put(docData,"doc_d1");
    tx.oncomplete=()=>{db.close();cb();};};
}
function lancer(cb){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  w.eval(appjs + '\n;window.__P = { etat:()=>S, importBackupText, idbGet, idbSet };');
  setTimeout(()=>cb(w), 1300);
}
ouvrir(state, "data:application/pdf;base64,JVBERi0xLjQK", ()=>{
  lancer(w1=>{
    const P1=w1.__P, S1=P1.etat();
    // Le fichier tel qu'il serait écrit sur l'appareil A
    P1.idbGet("doc_d1").then(doc=>{
      const fichier = JSON.stringify({...S1, _docs:{ d1: doc }}, null, 1);
      console.log('═══ APPAREIL A — sauvegarde produite ═══');
      console.log('  taille :', Math.round(fichier.length/1024), 'Ko');
      console.log('  lisible en texte :', fichier.includes('Démo-Martin'), '(pas chiffrée)');
      console.log('  documents inclus :', fichier.includes('JVBERi0'));

      // ── APPAREIL B : base vierge, clé différente ──
      global.indexedDB = new (require('fake-indexeddb/lib/FDBFactory'))();
      ouvrir(null, null, ()=>{
        lancer(w2=>{
          const P2=w2.__P;
          console.log('\n═══ APPAREIL B — base vierge ═══');
          console.log('  patients avant import :', P2.etat().patients.length);
          P2.importBackupText(fichier);
          setTimeout(()=>{
            // L'import propose Fusionner / Remplacer : on choisit Remplacer
            const d=w2.document;
            const btn = d.getElementById("imp-replace");
            console.log('  écran de choix affiché :', !!btn);
            if (btn) btn.click();
            setTimeout(()=>{
              // Depuis la v58, un dialogue confirme le remplacement
              const oui = w2.document.querySelector('.dlg-veil [data-yes]');
              console.log('  confirmation demandée :', !!oui);
              if (oui) oui.click();
            }, 400);
            setTimeout(async ()=>{
              const found = P2.etat().patients.find(x=>x.nom==="Démo-Martin");
              const S2=P2.etat();
              const p = found || S2.patients.find(x=>x.nom==="Démo-Martin");
              console.log('\n═══ APRÈS IMPORT ═══');
              console.log('  ① patient :', p ? p.prenom+' '+p.nom : 'AUCUN');
              console.log('  ② adresse :', p && p.address, p&&p.cp, p&&p.ville);
              console.log('  ③ vigilance :', p && p.infos[0] && p.infos[0].txt);
              console.log('  ④ passage :', p && p.visits[0] && (p.visits[0].at+' — TA '+p.visits[0].consts.ta));
              const d = await P2.idbGet("doc_d1").catch(()=>null);
              console.log('  ⑤ document restauré :', d ? '✓ ('+String(d).slice(0,22)+'…)' : '✗ PERDU');
              console.log('\n>>> Restauration sur un autre appareil :',
                (p && d) ? '✓ FONCTIONNE' : '✗ INCOMPLÈTE');
            }, 2000);
          }, 700);
        });
      });
    });
  });
});
