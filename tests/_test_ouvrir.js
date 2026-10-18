// « Ouvrir avec JM@Santé » : un fichier touché dans WhatsApp ouvre l'app.
// ① côté page : lecture, aiguillage, attente du déverrouillage, doublons
// ② côté Android : filtres du manifeste et conversion SEND → VIEW
const fs=require('fs'), path=require('path'), os=require('os'), cp=require('child_process');
const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
let ko=[]; const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };

console.log('═══ ANDROID (postcap.js sur un projet simulé) ═══');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pc-'));
fs.mkdirSync(path.join(tmp,'scripts')); fs.copyFileSync('../jmsante/scripts/postcap.js', path.join(tmp,'scripts/postcap.js'));
const main=path.join(tmp,'android/app/src/main'); fs.mkdirSync(path.join(main,'java/fr/jmsante/app'),{recursive:true});
fs.writeFileSync(path.join(main,'AndroidManifest.xml'),`<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application>
<activity android:name=".MainActivity" android:launchMode="singleTask" android:exported="true">
<intent-filter><action android:name="android.intent.action.MAIN" /><category android:name="android.intent.category.LAUNCHER" /></intent-filter>
</activity></application></manifest>`);
try { cp.execSync('node scripts/postcap.js',{cwd:tmp,stdio:'pipe'}); cp.execSync('node scripts/postcap.js',{cwd:tmp,stdio:'pipe'}); } catch(e){ ko.push('postcap'); }
const m=fs.readFileSync(path.join(main,'AndroidManifest.xml'),'utf-8');
const j=fs.readFileSync(path.join(main,'java/fr/jmsante/app/MainActivity.java'),'utf-8');
ck('filtres VIEW et SEND, une seule fois', (m.match(/jmsante-ouvrir/g)||[]).length===1 && m.includes('action.VIEW') && m.includes('action.SEND'));
ck('dans l\'activité principale', m.indexOf('jmsante-ouvrir') < m.indexOf('</activity>'));
ck('type application/json déclaré', m.includes('application/json'));
ck('Java : SEND converti avant le démarrage', j.includes('envoiVersVue') && j.indexOf('envoiVersVue(getIntent())') < j.indexOf('super.onCreate'));
ck('Java : accolades équilibrées', j.split('{').length===j.split('}').length);

console.log('\n═══ PAGE ═══');
const iso=new Date().toISOString().slice(0,10);
const run=(pin)=>new Promise(res=>{
  const nom='transm_d2';
  const st={version:1,theme:"hopital",retention:12,pin,lastGreeting:iso,identity:{nom:"D",prenom:"I",uid:"u2"},
    catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
    tours:[],curTour:null,patientOrder:{},patients:[],rappels:[],noVisit:{},trash:[],drafts:{}};
  const rq=indexedDB.open(nom,1);
  rq.onupgradeneeded=e=>{ try{e.target.result.createObjectStore("kv")}catch(x){} };
  rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");tx.objectStore("kv").put(st,"state");
   tx.oncomplete=()=>{db.close();
    const full=html.replace('<script src="js/app.js"></script>','').replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
    const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
    const w=dom.window; w.indexedDB=global.indexedDB;
    Object.defineProperty(w,'crypto',{value:webcrypto});
    Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
    Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
    w.URL.createObjectURL=()=>'blob:x'; w.confirm=()=>true;
    const lu=[]; let ecoute=null;
    const TXT=JSON.stringify({version:1,tours:["A"],patientOrder:{A:["p1"]},rappels:[],
      patients:[{id:"p1",nom:"Démo-Reçu",prenom:"P",tours:["A"],plan:[],visits:[],infos:[],docs:[]}]});
    w.Capacitor={isNativePlatform:()=>false,Plugins:{
      App:{addListener:(n,cb)=>{ if(n==='appUrlOpen') ecoute=cb; return {remove(){}}; },
           getLaunchUrl:async()=>({url:'content://com.whatsapp.provider.media/item/7'})},
      Filesystem:{readFile:async({path})=>{ lu.push(path); return {data:TXT}; }}}};
    w.eval(appjs + ';window.__verrou=()=>_estVerrouillee();');
    setTimeout(()=>{
      const h3=()=> (w.document.querySelector('#sheet h3')||{}).textContent||'';
      const r={ lu:lu.length, h3Avant:h3(), verrou:w.__verrou() };
      if (pin) w.document.getElementById('lock').classList.remove('on');
      setTimeout(()=>{
        r.h3=h3(); r.lu2=lu.length;
        ecoute && ecoute({url:'content://com.whatsapp.provider.media/item/7'});   // doublon
        ecoute && ecoute({url:'https://exemple.fr'});                            // pas un fichier
        setTimeout(()=>{ r.lu3=lu.length; res(r); }, 1200);
      }, 1500);
    }, 1800);
   };};
});
(async()=>{
  const a=await run(null);
  ck('fichier lu à l\'ouverture', a.lu===1);
  ck('écran « Importer » affiché, rien d\'écrit sans choix', /Importer une sauvegarde/.test(a.h3));
  ck('doublon et lien web ignorés', a.lu3===1);
  const b=await run("1234");
  ck('verrouillée : rien de lu avant le code', b.verrou && b.lu===0 && !/Importer/.test(b.h3Avant));
  ck('déverrouillée : l\'import reprend', b.lu2===1 && /Importer une sauvegarde/.test(b.h3));
  console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
  process.exit(ko.length?1:0);
})();
