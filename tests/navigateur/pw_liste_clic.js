// LES LIGNES DU LISTING S'OUVRENT, DANS TOUTES LES VUES (v1.27.1)
//
// ⚠️ CONSTATÉ AU CHEVET : « si je mets liste, mon patient n'est pas
//    cliquable et je peux pas ouvrir sa fiche ». Mesuré avant correction,
//    tournée à créneaux, vue Journée en mode Liste :
//
//      six lignes affichées · ZÉRO écoutée · le clic ne fait rien
//
// ⚠️ LA CAUSE : le gestionnaire de `data-pli` vivait dans UNE SEULE
//    branche de `render()` — celle du listing simple — alors que la vue
//    Journée dessine elle aussi des lignes, par la même fonction
//    `listeDe()`. Il est remonté avec les autres gestes qui ne dépendent
//    d'aucune vue.
//
// ⚠️ CE QUE CETTE ÉPREUVE GARDE N'EST PAS LA PRÉSENCE DU GESTIONNAIRE,
//    C'EST L'OUVERTURE. Un contrôle « les lignes ont un onclick » serait
//    resté vert le jour où le gestionnaire existe mais pointe à côté. On
//    clique pour de bon, et on regarde si la fiche s'ouvre.
//
// ⚠️ ET IL FAUT BALAYER LES QUATRE SITUATIONS, pas seulement celle qui
//    était cassée : sans créneaux, avec créneaux sur un créneau précis,
//    en vue Journée, et en tournée « Toutes ». C'est le croisement
//    vue × tournée qui avait laissé passer le trou — une seule des
//    combinaisons était branchée.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
const J = v => JSON.stringify(v);

(async()=>{
 await new Promise(r=>srv.listen(8228,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8228/index.html'); await pg.waitForTimeout(2700);

 const TOUR = "Cabinet A";
 await pg.evaluate(t=>{
   S.confidentialityAck=true; S.firstRun=false; openId=null;
   S.tours = S.tours || []; if (!S.tours.includes(t)) S.tours.push(t);
   activeP().forEach(p => { p.tours=[t]; p.visits=[]; });
   S.noVisit={}; S.drafts={};
 }, TOUR);

 /* Poser une situation : créneaux ou non, quelle tournée, quel créneau. */
 const poser = (tour, creneaux, slot) => pg.evaluate(async ([t, cr, sl])=>{
   S.slotsTours = S.slotsTours || {};
   if (cr) S.slotsTours[t] = true; else delete S.slotsTours[t];
   S.curTour = t;
   if (typeof _viewSlot !== "undefined") _viewSlot = sl;
   openId = null; render();
   await new Promise(r=>setTimeout(r,250));
   return { creneaux:(typeof slotsOn==="function")?slotsOn():null,
            slot:(typeof activeSlot==="function")?activeSlot():null };
 }, [tour, creneaux, slot]);

 const vue = v => pg.evaluate(async x=>{
   S.boardListe = (x==="liste"); S.compactBoard = (x==="compact");
   openId = null; render(); await new Promise(r=>setTimeout(r,300));
 }, v);

 const etat = () => pg.evaluate(()=>{
   const b=document.getElementById('board');
   const pli=[...b.querySelectorAll('[data-pli]')];
   const cartes=[...b.querySelectorAll('.pcard[data-id]')];
   return { board:b.className, sections:b.querySelectorAll('.slotsec').length,
            lignes:pli.length, cles:pli.map(e=>e.dataset.pli),
            cartes:cartes.length };
 });

 /* ⚠️ ON CLIQUE, ON NE REGARDE PAS LES GESTIONNAIRES. Un `onclick`
    présent mais branché sur la mauvaise clé laisserait vert un contrôle
    de présence, et le patient resterait injoignable. */
 const clic = async () => {
   const avant = await pg.evaluate(()=>openId);
   let err = null;
   try { await pg.click('#board [data-pli]', { timeout:3500 }); }
   catch(e){ err = String(e).split('\n')[0].slice(0,46); }
   await pg.waitForTimeout(450);
   const r = await pg.evaluate(()=>({ openId, liste:!!S.boardListe,
     carteOuverte:!!document.querySelector('.pcard.open') }));
   return { avant, ...r, err };
 };

 const SITUATIONS = [
   ["sans créneaux, une tournée",        TOUR,  false, null],
   ["avec créneaux, créneau du matin",   TOUR,  true,  "matin"],
   ["avec créneaux, vue Journée",        TOUR,  true,  "jour"],
   ["toutes les tournées",               "all", false, null]
 ];

 for (const [nom, tour, cr, sl] of SITUATIONS){
   const ctx = await poser(tour, cr, sl);
   await vue("liste");
   const e = await etat();
   console.log(`\n═══ ${nom.toUpperCase()} ═══`);
   console.log(`     créneaux ${ctx.creneaux ? 'oui' : 'non'} · slot ${J(ctx.slot)} · plateau « ${e.board} »`
     + ` · ${e.sections} section(s) · ${e.lignes} ligne(s)`);
   ok(`① ${nom} : la vue Liste dessine bien des lignes`, e.lignes > 0, J(e));
   if (e.lignes > 0){
     const c = await clic();
     console.log('     openId ' + J(c.avant) + ' → ' + J(c.openId)
       + (c.err ? '  ⚠ ' + c.err : ''));
     ok(`② ${nom} : toucher une ligne ouvre la fiche`,
        !!c.openId && c.openId !== c.avant, c.err || J(c.openId));
     ok(`③ ${nom} : et on revient aux cartes, dépliée sur ce patient`,
        c.liste === false && c.carteOuverte === true,
        'liste=' + c.liste + ' carte ouverte=' + c.carteOuverte);
   } else {
     ok(`② ${nom} : toucher une ligne ouvre la fiche`, false, 'aucune ligne');
     ok(`③ ${nom} : et on revient aux cartes, dépliée sur ce patient`, false, 'aucune ligne');
   }
 }

 /* ═══ LE PASSAGE SUPPLÉMENTAIRE ═══ */
 console.log('\n═══ UNE LIGNE DE 2ᵉ PASSAGE S\'OUVRE AUSSI ═══');
 /* ⚠️ SA CLÉ PORTE UN RANG (« p1#2 »), PAS UN IDENTIFIANT DE DOSSIER.
    Si l'ouverture cherchait `getP(cle)`, elle ne trouverait rien et la
    ligne resterait muette — exactement le défaut qu'on répare, déplacé
    d'un cran. */
 const sup = await pg.evaluate(async t=>{
   S.curTour = t; S.slotsTours = S.slotsTours || {}; delete S.slotsTours[t];
   if (typeof _viewSlot !== "undefined") _viewSlot = null;
   const p = activeP()[0];
   if (typeof extraSet === "function")
     extraSet(p, t, (typeof defaultSlot === "function") ? defaultSlot() : "matin");
   S.boardListe = true; S.compactBoard = false; openId = null; render();
   await new Promise(r=>setTimeout(r,350));
   const pli=[...document.querySelectorAll('#board [data-pli]')];
   return { cles:pli.map(e=>e.dataset.pli), pid:p.id };
 }, TOUR);
 console.log('     lignes : ' + J(sup.cles));
 ok('④ le 2ᵉ passage a sa propre ligne',
    sup.cles.some(c => String(c).includes('#2')), J(sup.cles));
 const i2 = sup.cles.findIndex(c => String(c).includes('#2'));
 if (i2 >= 0){
   const avant = await pg.evaluate(()=>openId);
   await pg.evaluate(i=>document.querySelectorAll('#board [data-pli]')[i].click(), i2);
   await pg.waitForTimeout(500);
   const r = await pg.evaluate(()=>({ openId, carte:!!document.querySelector('.pcard.open'),
     carteId:(document.querySelector('.pcard.open')||{}).dataset
       ? document.querySelector('.pcard.open').dataset.id : null }));
   console.log('     openId ' + J(avant) + ' → ' + J(r.openId) + ' · carte ouverte ' + J(r.carteId));
   ok('④ sa ligne ouvre bien SA carte, pas celle du 1ᵉʳ',
      r.openId === sup.cles[i2] && r.carteId === sup.cles[i2], J(r));
 } else {
   ok('④ sa ligne ouvre bien SA carte, pas celle du 1ᵉʳ', false, 'aucune ligne de rang 2');
 }

 /* ═══ CE QUI NE DOIT PAS AVOIR BOUGÉ ═══ */
 console.log('\n═══ LES AUTRES GESTES DE LA LIGNE ═══');
 /* ⚠️ LE 📞 RÉPONDAIT DÉJÀ AVANT LE CORRECTIF — son gestionnaire était
    au bon endroit. C'est ce qui rendait le défaut si déroutant : sur la
    même ligne, l'icône répondait et le nom non. On garde qu'il répond
    toujours, et qu'il n'ouvre PAS la fiche au passage. */
 const tel = await pg.evaluate(async t=>{
   const p = activeP()[0];
   p.tel = p.tel || {}; p.tel.mobile = "0600000000";
   if (typeof extraSet === "function") extraSet(p, t, null);
   S.boardListe = true; openId = null; render();
   await new Promise(r=>setTimeout(r,350));
   const b = document.querySelector('#board [data-cann]');
   if (!b) return { present:false };
   const av = openId; b.click();
   await new Promise(r=>setTimeout(r,450));
   const feuille = !!document.querySelector('#sheet');
   const ouvert = document.querySelector('#sheet') &&
     document.querySelector('#sheet').innerHTML.length > 0;
   if (typeof closeSheet === "function") closeSheet();
   return { present:true, avant:av, apres:openId, feuille:!!ouvert };
 }, TOUR);
 console.log('     ' + J(tel));
 ok('⑤ le 📞 de la ligne répond toujours', tel.present === true && tel.feuille === true, J(tel));
 ok('⑤ et il n\'ouvre pas la fiche au passage', tel.apres === tel.avant, J(tel));

 /* La vue Cartes n'a pas bougé non plus. */
 await poser(TOUR, false, null);
 await vue("cartes");
 /* ⚠️ UN VRAI CLIC, PAS UN `.click()` SUR LE CONTENEUR. Le gestionnaire
    des cartes vit sur un ENFANT (`[data-toggle]`) : appeler `.click()`
    sur la carte elle-même ne l'atteint pas, et le contrôle tombait en
    accusant l'application d'un défaut qu'elle n'a pas. Un doigt, lui,
    touche bien l'enfant — on clique donc comme un doigt. */
 const presenteCarte = await pg.evaluate(()=>!!document.querySelector('#board .pcard[data-id]'));
 const avantC = await pg.evaluate(()=>openId);
 if (presenteCarte){ try { await pg.click('#board .pcard[data-id]', { timeout:3500 }); } catch(e){} }
 await pg.waitForTimeout(450);
 const cartes = { present:presenteCarte, avant:avantC,
                  apres: await pg.evaluate(()=>openId) };
 ok('⑥ la vue Cartes ouvre toujours la fiche',
    cartes.present === true && !!cartes.apres && cartes.apres !== cartes.avant, J(cartes));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
