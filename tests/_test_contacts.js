// Médecins et entourage en listes, prescripteur par médicament,
// catalogues antécédents et appareillage.
const fs=require('fs');const {JSDOM}=require('jsdom');require('fake-indexeddb/auto');
const {webcrypto}=require('crypto');
const html=fs.readFileSync('../jmsante/www/index.html','utf-8');
const appjs=fs.readFileSync('../jmsante/www/js/app.js','utf-8');
const iso=new Date().toISOString().slice(0,10);
const state={version:1,theme:"hopital",retention:12,pin:null,lastGreeting:iso,
  identity:{nom:"D",prenom:"I",uid:"u1"},
  catalog:{overrides:{},protocols:{},custom:[],disabled:[],variants:{},catNames:{}},
  tours:["A"],curTour:"A",patientOrder:{"A":["p1"]},
  patients:[{id:"p1",nom:"Démo-Un",prenom:"P",dob:"1940-01-01",genre:"F",address:"",tours:["A"],
    plan:["Toilette"],archived:null,bilans:[],tags:[],infos:[],docs:[],plaies:[],
    // Données à l'ancienne : deux personnes « à prévenir » dans deux champs
    contacts:{med:{nom:"Dr Démo-Blanc",tel:"0400"},fam:{nom:"Mme Démo-Fille",tel:"0600"},pharma:{nom:"Pharma",tel:"0409"}},
    prevenir:{nom:"M. Démo-Voisin",tel:"0611"},
    traitement:{lignes:[{id:"t1",nom:"Bisoprolol",m:"1",forme:"cp"}]},
    visits:[{uid:"v1",date:iso,at:"08:15",soins:["Toilette"],consts:{},note:"",soinNotes:{}}]}],
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
  w.eval(appjs + '\n;window.__T={getP,medecinsDe,entourageDe,aPrevenir,medecinTraitant,personnesConfiance,majContactsLegacy,nettoyerContacts,prescDe,traitHtml,ficheHtml,ficheTexte,catDe,catParse,CATS};');
  setTimeout(()=>{
    const T=w.__T, p=T.getP("p1"); let ko=[];
    const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
    console.log('═══ REPRISE DES ANCIENNES DONNÉES ═══');
    ck('médecin traitant repris', T.medecinTraitant(p) && T.medecinTraitant(p).nom==="Dr Démo-Blanc");
    ck('les deux personnes à prévenir gardées', T.aPrevenir(p).map(e=>e.nom).join("|")==="Mme Démo-Fille|M. Démo-Voisin");
    ck('confiance jamais supposée', T.personnesConfiance(p).length===0);
    console.log('\n═══ LISTES ═══');
    T.medecinsDe(p).push({id:"m2",spec:"Cardiologue",nom:"Dr Démo-Noir",tel:"0401"});
    T.entourageDe(p)[0].confiance=true;
    T.entourageDe(p).push({id:"x",lien:"",nom:"",tel:"",prevenir:false,confiance:false,_aut:true});
    const net=T.nettoyerContacts(T.entourageDe(p));
    ck('ligne vide écartée', net.length===2 && !net.some(x=>"_aut" in x));
    T.majContactsLegacy(p);
    ck('miroir contacts.med', p.contacts.med.nom==="Dr Démo-Blanc");
    ck('miroir p.prevenir', p.prevenir.nom==="Mme Démo-Fille");
    ck('pharmacie intacte', p.contacts.pharma.nom==="Pharma");
    console.log('\n═══ PRESCRIPTEUR ═══');
    const l=p.traitement.lignes[0];
    ck('sans étiquette = traitant', T.prescDe(p,l)===null);
    l.presc="m2";
    ck('étiquette cardiologue', T.prescDe(p,l) && T.prescDe(p,l).spec==="Cardiologue");
    ck('imprimé dans la fiche', T.traitHtml(p).includes("Prescrit par : Cardiologue"));
    l.presc="inconnu";
    ck('médecin retiré → pas d\'étiquette morte', T.prescDe(p,l)===null);
    console.log('\n═══ EXPORT DE FICHE ═══');
    let okx=true, out="";
    try { out = T.ficheHtml(p,{contacts:true},[],"x") + T.ficheTexte(p,{contacts:true},[],"x"); } catch(e){ okx=false; }
    ck('ne plante plus sur des contacts objets', okx);
    ck('tous les contacts exportés', /Cardiologue/.test(out) && /personne de confiance/.test(out) && /Démo-Voisin/.test(out));
    console.log('\n═══ CATALOGUES ═══');
    for (const k of ["atcd","appareillage"]){
      const c=T.catDe(k), n=c.reduce((a,s)=>a+s.groups.reduce((b,g)=>b+g.items.length,0),0);
      const mal=[]; c.forEach(s=>s.groups.forEach(g=>g.items.forEach(x=>{
        if (/\[[^\]]*\[/.test(x) || x.replace(/\[[^\]]*\]/g,'').includes('|')) mal.push(x);})));
      ck(`${k} : ${c.length} sections, ${n} phrases, notation valide`, !mal.length && n>20);
    }
    const atcd=T.catDe("atcd");
    ck('allergies isolées (dest vigilance)', atcd.filter(s=>s.dest==="vigilance").length===1);
    ck('phrases sans crochets ajoutables seules', T.CATS.atcd.libre && T.CATS.appareillage.libre && !T.CATS.autonomie.libre);
    console.log('\n═══ APPELS ET DICTÉE ═══');
const ui2 = fs.readFileSync('../jmsante/www/js/ui.js','utf-8');
const sh2 = fs.readFileSync('../jmsante/www/js/sheets.js','utf-8');
const di2 = fs.readFileSync('../jmsante/www/js/dictate.js','utf-8');
// ⚠️ Le patient manquait dans sa PROPRE liste d'appels
ck('le numéro du patient ouvre le bouton Appels', /\(p\.tel\|\|\{\}\)\.mobile \|\| \(p\.tel\|\|\{\}\)\.fixe/.test(ui2));
ck('mobile et fixe du patient dans l\'annuaire', /lbl:"📱 Mobile"/.test(sh2) && /lbl:"☎️ Fixe"/.test(sh2));
ck('le patient figure en TÊTE de l\'annuaire',
   sh2.indexOf('lbl:"📱 Mobile"') < sh2.indexOf('medecinsDe(p).filter(m => m.nom||m.tel).map'));
// ⚠️ La reconnaissance vocale du navigateur lâchait une fois sur deux
ck('plus de reconnaissance vocale', !/SpeechRecognition/.test(di2));
ck('le micro ouvre le clavier sur le champ', /t\.focus\(/.test(di2) && /setSelectionRange/.test(di2));
ck('message d\'aide une seule fois par session', /_dictHintVu/.test(di2));
ck('le message vocal (fichier son) est intact', fs.existsSync('../jmsante/www/js/vocal.js') && /MediaRecorder/.test(fs.readFileSync('../jmsante/www/js/vocal.js','utf-8')));

// ⚠️ Troisième fois que .btn (width:100%) écrase une mise en page :
// ici le bouton Appeler comprimait le texte, qui se repliait mot à mot.
ck('bouton Appeler hors de la classe .btn', /class="an-call"/.test(sh2) && !/an-l[\s\S]{0,200}class="btn btn-primary"/.test(sh2));
ck('colonne de texte compressible (min-width:0)', /flex:1;min-width:0/.test(sh2));
ck('largeur du bouton libre', /\.an-call\{[^}]*width:auto/.test(fs.readFileSync('../jmsante/www/css/app.css','utf-8')));
ck('étiquettes courtes (le nom est déjà au titre)', /lbl:"📱 Mobile"/.test(sh2) && /lbl:"☎️ Fixe"/.test(sh2));

console.log('\nERREURS:', ko.length||errs.length ? ko.concat(errs).join(' · ') : 'aucune');
    process.exit(ko.length?1:0);
  }, 1500);
}
