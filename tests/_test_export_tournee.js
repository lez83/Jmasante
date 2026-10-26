// ⚠️ Une sauvegarde complète emporte TOUS les cabinets. Pour un premier
// échange avec un remplaçant qui n'a rien, la synchro ne transmet rien
// (elle ne porte que les changements) — d'où cet export par tournée.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const mk=(i,nom,tours)=>({id:`p${i}`,nom:`Démo-${nom}`,prenom:"P",dob:"1940-01-01",genre:"F",
  address:"",contacts:{},tours,plan:["Toilette"],archived:null,bilans:[],tags:[],infos:[],
  docs:[],plaies:[],visits:[{uid:`v${i}`,date:iso,at:"08:15",soins:["Toilette"],consts:{},note:"",soinNotes:{}}]});
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"D",prenom:"Titulaire",uid:"u1"},bkAvertiVu:true,
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  tours:["Cabinet A","Cabinet B"],curTour:"Cabinet A",
  patientOrder:{"Cabinet A":["p1","p2"],"Cabinet B":["p3"]},
  patients:[mk(1,"Un-A",["Cabinet A"]),mk(2,"Deux-A",["Cabinet A"]),mk(3,"Trois-B",["Cabinet B"])],
  rappels:[{id:"r1",pid:"p1",type:"ordo",text:"Ordonnance A",done:false},
           {id:"r2",perso:true,type:"autre",text:"PERSONNEL",done:false},
           {id:"r3",tour:"Cabinet B",type:"autre",text:"Cabinet B seulement",done:false},
           {id:"r4",tour:"Cabinet A",type:"autre",text:"Cabinet A seulement",done:false}],
  noVisit:{},trash:[],drafts:{}};
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
  // Intercepter le fichier produit
  // Capturer le Blob au lieu de laisser le navigateur télécharger
  w.eval(appjs + `
    ;window.__cap = null;
    const _Blob = window.Blob;
    window.Blob = function(parts, opts){
      try { window.__cap = String(parts[0]); } catch(e){}
      return new _Blob(parts, opts);
    };
    window.URL.createObjectURL = () => "blob:x";
    window.URL.revokeObjectURL = () => {};
    window.__export = (t) => exportBackup("save", t);
    /* ⚠️ POSÉ ICI, DANS LE SCRIPT DE LA PAGE : \`S\` vit dans la portée du
       script et n'est visible ni depuis le harnais ni depuis un eval
       externe. */
    window.__cloisonSync = () => {
      const A = S.patients.find(p => (p.tours||[]).includes('Cabinet A'));
      const B = S.patients.find(p => (p.tours||[]).includes('Cabinet B'));
      if (!A || !B || typeof buildSyncFile !== 'function') return { saute:true };
      S.identity = S.identity || { nom:'T', prenom:'T', uid:'u1' };
      S.changeLog = [
        { seq:1, ts:Date.now(), type:'update', ent:'patient', id:A.id, data:{ note:'SECRET-A' } },
        { seq:2, ts:Date.now(), type:'update', ent:'patient', id:B.id, data:{ note:'SECRET-B' } }
      ];
      const f = buildSyncFile('Cabinet A', [], false, false);
      return { a:f.includes('SECRET-A'), b:f.includes('SECRET-B'), idB:f.includes(B.id) };
    };`);
  setTimeout(async ()=>{
    console.log('═══ EXPORT DE « CABINET A » ═══');
    try { await w.__export("Cabinet A"); } catch(e){ console.log('  err', e.message); }
    await new Promise(r=>setTimeout(r,900));
    if (!w.__cap){ console.log('  ⚠ aucun fichier produit'); console.log('\nERREURS: échec'); return; }
    const d = JSON.parse(w.__cap);
    console.log('\n  ═══ CE QUE CONTIENT LE FICHIER ═══');
    console.log('  patients :', d.patients.map(p=>p.nom).join(' · '));
    console.log('  tournées :', JSON.stringify(d.tours));
    console.log('  rappels  :', d.rappels.map(r=>r.text).join(' · ') || '(aucun)');
    const txt = JSON.stringify(d);
    console.log('\n  ═══ CLOISONNEMENT ═══');
    const ck = (lbl, cond) => console.log(`  ${cond?'✓':'⚠ FUITE'} ${lbl}`);
    ck('patient du Cabinet B absent', !txt.includes('Trois-B'));
    ck('rappel personnel absent',     !txt.includes('PERSONNEL'));
    ck('rappel Cabinet B absent',     !txt.includes('Cabinet B seulement'));
    ck('patients du Cabinet A présents', d.patients.length===2);
    ck('rappel Cabinet A présent',    txt.includes('Cabinet A seulement'));
    ck('marqueur de tournée',         d._tourneeSeule==='Cabinet A');
    /* ⚠️ LE JOURNAL DE SYNCHRO AUSSI, PAS SEULEMENT L'EXPORT. Le cahier
       portait encore « buildSyncFile envoie TOUT le journal : un collègue
       du Cabinet A reçoit aussi les modifications des Cabinets B et C —
       violation du secret », en priorité haute. Le filtre a été posé
       depuis, mais rien ne le gardait : une ligne de code n'est pas un
       comportement. Mesuré ici sur le fichier lui-même. */
    try {
      const res = w.__cloisonSync ? w.__cloisonSync() : null;
      if (res && !res.saute){
        ck('journal de synchro : le changement du Cabinet A part', res.a);
        ck('journal de synchro : celui du Cabinet B ne part PAS', !res.b);
        ck('journal de synchro : l identifiant du patient B ne part pas', !res.idB);
      } else console.log('  · journal de synchro : non mesurable ici');
    } catch(e){ console.log('  ⚠ FUITE journal de synchro : ' + String(e).slice(0,70)); }
    const ok = !txt.includes('Trois-B') && !txt.includes('PERSONNEL')
            && !txt.includes('Cabinet B seulement') && d.patients.length===2;

    console.log('\n═══ EXPORT COMPLET (sans filtre) ═══');
    w.__cap = null;
    try { await w.__export(null); } catch(e){}
    await new Promise(r=>setTimeout(r,900));
    const d2 = w.__cap ? JSON.parse(w.__cap) : null;
    console.log('  patients :', d2 ? d2.patients.length : '?', '(attendu 3)');
    console.log('  tournées :', d2 ? JSON.stringify(d2.tours) : '?');

    console.log('\nERREURS:', (ok && d2 && d2.patients.length===3) ? 'aucune' : 'cloisonnement à revoir');
  }, 1600);
}
