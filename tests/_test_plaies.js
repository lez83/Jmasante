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
  w.eval(appjs + '\n;window.__P = { PLAIE_TYPES, PLAIE_REGIONS, plaieRegionsSVG, plaieNom, plaieJours, plaiePhotos, plaiesOuvertes, docPlaieOuverte, plaieTexteReleve, plaieToutesZones, plaieRegionDe, plaieSilhouette, sheetPlaies, getP, plaieFil, plaieDerniereNote, plaieBlocReleve, plaiePhotosPeriode, buildReleve, PLAIE_VUES, plaieSilhouette, plaieVueDe, plaieZoneInfo, LOC_ANCIENNES };');
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

    console.log('\n═══ JOURNAL DE SUIVI ═══');
    const pl2 = p.plaies[0];
    pl2.suivi = [{ id:"n1", date:j(10), txt:"Fibrine", mesures:"4 cm × 3 cm", stade:"2" }];
    p.visits = [{ uid:"vx", date:j(5), soins:["Pansement"], consts:{}, note:"",
      soinNotes:{ "Pansement":"plaie propre" }, soinNotesPlaie:{ "Pansement":pl2.id } }];
    const fil = P.plaieFil(p, pl2);
    const types = fil.map(e => e.t).join(",");
    console.log('  entrées du fil :', fil.length, '·', types);
    console.log('  ordre décroissant :', fil.every((e,i) => i===0 || fil[i-1].d >= e.d) ? '✓' : '⚠');
    console.log('  ouverture et photos repris :', /ouv/.test(types) && /photo/.test(types) ? '✓' : '⚠');
    console.log('  commentaire de passage rattaché :', /soin/.test(types) ? '✓' : '⚠');
    console.log('  dernière observation :', (P.plaieDerniereNote(p, pl2)||{}).txt);
    // Un commentaire rattaché à une AUTRE plaie ne doit pas remonter
    p.visits[0].soinNotesPlaie = { "Pansement":"autre" };
    console.log('  cloisonné entre plaies :', !P.plaieFil(p, pl2).some(e => e.t === "soin") ? '✓' : '⚠');

    console.log('\n═══ NOTES DANS LA RELÈVE ═══');
    const P2 = p.plaies[0];
    P2.suivi = [{ id:"a", date:j(20), txt:"Ancienne", rel:true },
                { id:"b", date:j(5),  txt:"Retenue", mesures:"3 cm × 2 cm", stade:"2", rel:true },
                { id:"c", date:j(4),  txt:"Non cochée" }];
    const bl = P.plaieBlocReleve(p, j(10), j(0));
    const nts = bl[0] ? bl[0].notes.map(n=>n.txt) : [];
    console.log('  notes retenues :', JSON.stringify(nts));
    console.log('  cochée dans la période :', nts.includes("Retenue") ? '✓' : '⚠');
    console.log('  cochée hors période exclue :', !nts.includes("Ancienne") ? '✓' : '⚠');
    console.log('  non cochée exclue :', !nts.includes("Non cochée") ? '✓' : '⚠');
    const rel = P.buildReleve({start:j(10), end:j(0), mode:"full", layout:"structure", withRaps:false});
    console.log('  section [ PLAIES ] :', /\[ PLAIES \]/.test(rel) ? '✓' : '⚠');
    console.log('  coupée par la case Sélection :',
      !/\[ PLAIES \]/.test(P.buildReleve({start:j(10), end:j(0), mode:"full", layout:"structure",
        withRaps:false, pOpts:{ [p.id]:{ consts:true, notes:true, bilans:true, raps:true, docs:false, plaies:false } }})) ? '✓' : '⚠');
    // La dernière photo de la période est proposée
    const ph = P.plaiePhotosPeriode(p, j(10), j(0));
    console.log('  photo proposée :', ph.length===1 ? '✓ la dernière de la période' : '⚠ ' + ph.length);

    console.log('\n═══ CARTOGRAPHIE — 5 VUES ═══');
    console.log('  vues :', P.PLAIE_VUES.map(v=>v.lbl).join(' · '));
    P.PLAIE_VUES.forEach(v => {
      const svg = P.plaieSilhouette('F', v.cle, null, false);
      const n = (svg.match(/data-zone=/g)||[]).length;
      console.log(`  ${'ok'} ${v.cle.padEnd(9)} ${n} zones · découpe ${/clip-path/.test(svg)?'✓':'⚠'}`);
    });
    // ⚠️ Convention du soin : de FACE, la droite du patient est à gauche de l'image
    const face = P.plaieSilhouette('F','face',null,false);
    console.log('  côtés présents de face :', /Thorax droit/.test(face) && /Thorax gauche/.test(face) ? '✓' : '⚠');
    // Deux genres réellement distincts
    console.log('  femme ≠ homme :', P.plaieSilhouette('F','face') !== P.plaieSilhouette('M','face') ? '✓' : '⚠');
    // Les anciennes localisations retrouvent leur zone
    const anc = [["Coccyx","Sacrum"],["Fessier droit","Fesse droite"],["Crâne (vertex)","Cuir chevelu"]];
    anc.forEach(([vieux, neuf]) => {
      const ok = P.plaieZoneInfo(vieux) || P.LOC_ANCIENNES[vieux] === neuf;
      console.log(`  « ${vieux} » → ${P.LOC_ANCIENNES[vieux]||vieux}`, ok ? '✓' : '⚠');
    });
    console.log('  une localisation connue sait sa vue :', P.plaieVueDe('Sacrum') === 'dos' ? '✓' : '⚠ ' + P.plaieVueDe('Sacrum'));

    console.log('\n═══ LOCALISATIONS ═══');
    const tt = P.plaieToutesZones();
    ["Menton","Nez","Front","Joue gauche","Cuir chevelu","Œil droit","Arcade sourcilière gauche","Nuque",
     "Sacrum","Épigastre","Creux poplité droit","Talon gauche","Trochanter droit","Malléole gauche"]
      .forEach(z => { if (!tt.includes(z)) console.log('  ⚠ manque', z); });
    console.log('  visage et tête :', tt.filter(z=>/Menton|Nez|Front|Joue|chevelu|Œil|Arcade|Nuque|Tempe|Oreille|Lèvre|Pommette|Mâchoire|Paupière/.test(z)).length, 'zones');

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
