const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const j=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.toISOString().slice(0,10);};
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,slotsEnabled:false,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  patientOrder:{"A":["p1"]},tours:["A"],curTour:"A",
  patients:[{id:"p1",nom:"Démo-Un",prenom:"Renée",dob:"1938-04-12",genre:"F",address:"",contacts:{},
    tours:["A"],plan:["Toilette"],archived:null,bilans:[],tags:[],infos:[],visits:[],
    docs:[{id:"ph1",name:"a",mime:"image/jpeg",date:j(47),type:"plaie",precision:"Sacrum"},
          {id:"ph2",name:"b",mime:"image/jpeg",date:j(20),type:"plaie",precision:"Sacrum"},
          {id:"ph3",name:"c",mime:"image/jpeg",date:j(2), type:"plaie",precision:"Sacrum"}],
    plaies:[{id:"pl1",type:"escarre",loc:"Sacrum",stade:"2",mesures:"3 cm × 2 cm",
             depuis:j(47),cicatriseeLe:null,docIds:["ph1","ph2","ph3"]},
            {id:"pl2",type:"ulcere",loc:"Jambe gauche",stade:"",mesures:"",
             depuis:j(90),cicatriseeLe:j(58),docIds:[]}]}],
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
  w.URL.createObjectURL=()=>'blob:x';w.confirm=()=>true;
  let errs=[];w.addEventListener('error',e=>errs.push(e.message));
  w.eval(appjs + '\n;window.__P = { PLAIE_TYPES, PLAIE_REGIONS, plaieRegionsSVG, plaieNom, plaieJours, plaiePhotos, plaiesOuvertes, docPlaieOuverte, plaieTexteReleve, plaieToutesZones, plaieRegionDe, plaieSilhouette, sheetPlaies, getP };');
  const d=w.document,q=s=>d.querySelector(s);
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  (async()=>{
    await wait(1400);
    const P=w.__P, p=P.getP("p1");
    console.log('═══ LOCALISATIONS ═══');
    const z = P.plaieToutesZones();
    console.log('  total :', z.length);
    ['Main gauche','Main droite','Genou gauche','Genou droit','Talon gauche','Pied droit'].forEach(n =>
      console.log(`  ${z.includes(n)?'✓':'✗'} ${n}`));
    console.log('  régions :', P.PLAIE_REGIONS.map(r=>r.lbl).join(' · '));

    console.log('\n═══ RÉGIONS CLIQUABLES DU CORPS ═══');
    ['dos','face'].forEach(v => {
      const rs = P.plaieRegionsSVG('F', v).filter(r => !r.zone.startsWith('__'));
      const inconnues = rs.filter(x => !z.includes(x.zone)).map(x=>x.zone);
      console.log(`  ${v.padEnd(5)} ${rs.length} régions`,
        inconnues.length ? '⚠ hors liste : '+inconnues : '✓ toutes dans la liste');
    });
    // Chaque région doit avoir un tracé valide
    const sansTrace = P.plaieRegionsSVG('F','dos').filter(r => !r.d || r.d.length < 10);
    console.log('  tracés valides :', sansTrace.length === 0 ? '✓' : '⚠ ' + sansTrace.map(x=>x.zone));

    console.log('\n═══ SILHOUETTES ═══');
    ['F','M','N'].forEach(g => {
      const svg = P.plaieSilhouette(g, 'dos', null, false);
      console.log(`  ${g} : ${svg.length} car.`, svg.includes('<svg') ? '✓' : '⚠');
    });
    const f = P.plaieSilhouette('F','dos',null,false), m = P.plaieSilhouette('M','dos',null,false);
    console.log('  femme ≠ homme :', f !== m ? '✓ distinctes' : '⚠ identiques');
    console.log('  cheveux femme :', f.includes('M35 12') ? '✓' : '⚠');
    console.log('  mains dessinées :', f.includes('ellipse') ? '✓' : '⚠');

    console.log('\n═══ UNE PLAIE ═══');
    const pl = p.plaies[0];
    console.log('  nom      :', P.plaieNom(pl));
    console.log('  jours    :', P.plaieJours(pl), '(attendu 47)');
    console.log('  photos   :', P.plaiePhotos(p, pl).length);
    console.log('  ouvertes :', P.plaiesOuvertes(p).length, '(attendu 1)');
    const fermee = p.plaies[1];
    console.log('  cicatrisée, durée :', P.plaieJours(fermee), '(attendu 32)');

    console.log('\n═══ GARDE-FOU DU MÉNAGE ═══');
    console.log('  photo de plaie ouverte :', P.docPlaieOuverte(p,"ph1") ? '✓ protégée' : '⚠');
    console.log('  photo quelconque       :', !P.docPlaieOuverte(p,"zzz") ? '✓ non protégée' : '⚠');

    console.log('\n═══ RELÈVE ═══');
    P.plaieTexteReleve(p).forEach(t => console.log('  🩹', t));
    const txt = P.plaieTexteReleve(p).join(" ");
    console.log('  sans jugement clinique :',
      !/aggrav|dégrad|alerte|inquiét/i.test(txt) ? '✓' : '⚠ INTERPRÉTATION');

    console.log('\n═══ ÉCRAN ═══');
    P.sheetPlaies("p1"); await wait(700);
    console.log('  cartes    :', d.querySelectorAll('.plcard').length);
    console.log('  en cours  :', d.querySelectorAll('.plcard.on').length);
    console.log('  fermées   :', d.querySelectorAll('.plcard.ok').length);
    console.log('  vignettes :', d.querySelectorAll('.plv').length);
    console.log('  bouton nouvelle :', !!q('#pl-new'));
    console.log('\nERREURS:', errs.length?errs:'aucune');
  })();
}
