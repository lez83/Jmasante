const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const j = n => new Date(Date.now()-n*864e5).toISOString().slice(0,10);
const iso=j(0);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],docs:[],tags:[],infos:[],visits:[]}],
  rappels:[],noVisit:{},trash:[],drafts:{},
  voiceRetention:"7",
  voiceNotes:[
    { id:"vA", dur:72, taille:290000, mime:"audio/mp4", at:new Date(Date.now()-10*864e5).toISOString() },
    { id:"vB", dur:30, taille:120000, mime:"audio/mp4", at:new Date(Date.now()-2*864e5).toISOString() }]};
const rq=indexedDB.open("transm_d2",1);
rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
rq.onsuccess=()=>{const db=rq.result;const tx=db.transaction("kv","readwrite");
  const o=tx.objectStore("kv"); o.put(state,"state");
  o.put("data:audio/mp4;base64,AAAA","voice_vA"); o.put("data:audio/mp4;base64,BBBB","voice_vB");
  tx.oncomplete=()=>{db.close();run();}};
function run(){
  const full=html.replace('<script src="js/app.js"></script>',`<script>${appjs}</script>`)
               .replace(/<script src="js\/libs\/[^"]+"><\/script>/g,'').replace('<script src="capacitor.js"></script>','');
  const dom=new JSDOM(full,{runScripts:'outside-only',url:'https://localhost/'});
  const w=dom.window;w.indexedDB=global.indexedDB;
  Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.defineProperty(w,'localStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  Object.defineProperty(w,'sessionStorage',{value:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}});
  w.URL.createObjectURL=()=>'blob:x'; w.URL.revokeObjectURL=()=>{};
  w.confirm=()=>true;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs + '\n;window.__V = { etat:()=>S, voicePossible, voiceFmt, voiceExt, voicePurge, voiceUrl, VOICE_MENTION, VOICE_MAX_S, VOICE_MAX_NB };');
  setTimeout(async ()=>{
    const V=w.__V;
    console.log('═══ FORMAT ET LIMITES ═══');
    console.log('  durée max :', V.VOICE_MAX_S, 's =', V.voiceFmt(V.VOICE_MAX_S), V.VOICE_MAX_S===180?'✓':'⚠');
    console.log('  notes max :', V.VOICE_MAX_NB, V.VOICE_MAX_NB===2?'✓':'⚠');
    console.log('  chrono    :', V.voiceFmt(72), V.voiceFmt(72)==='1:12'?'✓':'⚠');
    console.log('  extensions:', V.voiceExt('audio/mp4'), '|', V.voiceExt('audio/webm;codecs=opus'));

    console.log('\n═══ MENTION JOINTE À L ENVOI ═══');
    const m = V.VOICE_MENTION;
    console.log('  secret professionnel :', /secret professionnel/i.test(m) ? '✓' : '✗');
    console.log('  ne pas rediffuser    :', /rediffuser/i.test(m) ? '✓' : '✗');
    console.log('  effacer après écoute :', /effacer/i.test(m) ? '✓' : '✗');

    console.log('\n═══ MÉNAGE (réglage : 7 jours) ═══');
    console.log('  avant :', V.etat().voiceNotes.length, 'notes');
    const n = await V.voicePurge();
    const reste = V.etat().voiceNotes;
    console.log('  effacées :', n, n===1?'✓ (la note de 10 jours)':'⚠');
    console.log('  reste    :', reste.length, reste.length===1 && reste[0].id==='vB' ? '✓ (celle de 2 jours)' : '⚠');
    const orphelin = await V.voiceUrl('vA');
    console.log('  fichier effacé aussi :', orphelin===null ? '✓' : '⚠ RESTE EN BASE');
    const garde = await V.voiceUrl('vB');
    console.log('  fichier conservé     :', garde ? '✓ réécoutable' : '⚠ PERDU');
    console.log('\nERREURS:', errs.length?errs:'aucune');
  }, 1500);
}
