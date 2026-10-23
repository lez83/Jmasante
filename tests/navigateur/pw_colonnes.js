// LES COLONNES DE LA FEUILLE DE CONSTANTES SE COMPOSENT (v1.25.0)
//
// ⚠️ ÉCRITE AVANT LA CORRECTION, et vérifiée en rouge en restaurant le
//    `www/` de la v1.24.0 livrée : les colonnes y étaient écrites en dur
//    dans `entetesTable.constantes`, aucune des fonctions `fcol*`
//    n'existait, et l'écran de composition non plus.
//
// ⚠️ L'ÉPREUVE DOIT TOMBER, PAS PLANTER, sur le code d'avant. Tous les
//    appels aux fonctions neuves passent par `typeof … === "function"` et
//    par `?.` : une épreuve qui jette une exception au premier contrôle
//    ne dit rien des quarante suivants, et ne garde donc rien.
//
// ⚠️ LE PREMIER CONTRÔLE EST CELUI QUI COMPTE LE PLUS, ET IL DOIT PASSER
//    SUR LES DEUX VERSIONS : une fiche où rien n'a été composé sort
//    l'en-tête d'origine, mot pour mot. C'est la promesse faite au
//    chevet — « rien ne doit bouger chez mes patients tant que je n'y
//    touche pas » — et le seul contrôle de cette épreuve dont l'échec
//    signifierait une régression chez les quarante dossiers existants.
//
// ⚠️ LES LARGEURS SONT MESURÉES EN PIXELS RENDUS, PAS LUES DANS LE HTML.
//    Un `width:14%` dans l'attribut ne prouve pas que la case fait 14 %
//    de la page : `table-layout:fixed` peut l'écraser, et une case de
//    trop sort de la page sans un mot. On rend la feuille à la largeur
//    d'une A4 et on mesure `getBoundingClientRect`.
//
// ⚠️ LA PAGINATION EST COMPTÉE DANS LE PDF. La hauteur de `.pg` vaut
//    305 mm partout dans un aperçu (padding + min-height) : elle ne dit
//    rien. Seul le nombre de pages du PDF le dit.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
const n = s => String(s==null?"":s).replace(/\s+/g,' ').replace(/>\s+</g,'><').trim();

/* L'en-tête d'origine, recopié de la v1.24.0 livrée. */
const ENTETE_ORIGINE = n(`<tr>
        <th style="width:6%">J</th>
        <th style="width:11%">TA</th><th style="width:9%">Pouls</th>
        <th style="width:9%">T°</th><th style="width:8%">Sat</th>
        <th style="width:9%" class="dl">Doul.<span>/10</span></th>
        <th style="width:36%">Observations</th><th style="width:12%">Init.</th>
      </tr>`);

(async()=>{
 await new Promise(r=>srv.listen(8225,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8225/index.html'); await pg.waitForTimeout(2700);

 const pid = await pg.evaluate(() => {
   S.confidentialityAck=true; S.firstRun=false;
   delete S.feuilleColsVierge;
   S.patients.forEach(p => { delete p.feuilleCols; });
   openId=null; render();
   return S.patients[0].id;
 });

 /* ═══ ① RIEN NE BOUGE CHEZ QUI N'A RIEN COMPOSÉ ═══ */
 console.log('═══ L\'INVARIANT : UNE FICHE NON COMPOSÉE SORT LA FEUILLE D\'AVANT ═══');
 const brut = await pg.evaluate(id => feuilleHtml(getP(id), "constantes", "serre", ""), pid);
 const entete = (n(brut).match(/<tr><th style="width:6%">J<\/th>.*?<\/tr>/) || [""])[0];
 ok('① l\'en-tête par défaut est celui d\'origine, mot pour mot',
    entete === ENTETE_ORIGINE, entete.slice(0, 200));
 ok('① bis le titre reste « SURVEILLANCE DES CONSTANTES »',
    /SURVEILLANCE DES CONSTANTES/.test(brut));
 /* Autant de cases que d'en-têtes : une de plus sort de la page sans un mot. */
 const compte = html => {
   const t = n(html);
   const nth = (t.match(/<tr><th style="width:6%">J<\/th>.*?<\/tr>/)||[""])[0].split("<th").length - 1;
   const m = t.match(/<tr(?: class="g5")?><td class="jr">1<\/td>(.*?)<\/tr>/);
   const ntd = m ? m[1].split("<td").length - 1 + 1 : -1;
   return { nth, ntd };
 };
 { const c = compte(brut);
   ok('① ter autant de cases que de colonnes', c.nth === 8 && c.ntd === 8,
      c.nth + ' en-têtes / ' + c.ntd + ' cases'); }

 /* ═══ ② LE MOTEUR EST LÀ ═══ */
 console.log('═══ LE MOTEUR DE COMPOSITION ═══');
 const api = await pg.evaluate(() => ["fcolMes","fcolDefaut","fcolLire","fcolEcrire",
   "fcolLargeurs","fcolEnteteHtml","fcolTitre","fcolNb","fcolEstDefaut","fcolTh","fcolUnite",
   "sheetFeuilleColonnes"].filter(k => typeof window[k] !== "function"));
 ok('② toutes les fonctions de composition existent', api.length === 0, 'manquent : ' + api.join(', '));
 const catalogue = await pg.evaluate(() =>
   (typeof FCOL_MES !== "undefined" && Array.isArray(FCOL_MES))
     ? FCOL_MES.map(m => m.k + ":" + m.u.join("/")) : null);
 ok('② le catalogue propose au moins dix mesures',
    !!catalogue && catalogue.length >= 10, catalogue ? catalogue.length : 'absent');
 if (catalogue) console.log('     ' + catalogue.join('  '));
 /* Le choix d'unité n'a de sens que si plusieurs mesures en offrent plusieurs. */
 const plusieurs = await pg.evaluate(() =>
   (typeof FCOL_MES !== "undefined") ? FCOL_MES.filter(m => m.u.length > 1).map(m=>m.k) : []);
 ok('② plusieurs mesures offrent un choix d\'unité',
    plusieurs.length >= 4, plusieurs.join(', ') || 'aucune');

 /* ═══ ③ RENOMMER UNE COLONNE CHANGE LE PAPIER ═══ */
 console.log('═══ ÉCHANGER LA DOULEUR CONTRE LE POIDS ═══');
 const compose = (id, d) => pg.evaluate(([id, d]) => {
   if (typeof fcolEcrire !== "function") return null;
   const p = getP(id); fcolEcrire(p, false, d);
   return feuilleHtml(p, "constantes", "serre", "");
 }, [id, d]);
 const h_poids = await compose(pid, { cols:[{k:"ta",u:""},{k:"puls",u:""},{k:"temp",u:""},
   {k:"sat",u:""},{k:"poids",u:"kg"}], jour:true, obs:true, init:true });
 ok('③ « Poids » s\'imprime en en-tête', !!h_poids && /<th[^>]*>Poids<span>kg<\/span>/.test(n(h_poids)));
 ok('③ « Doul. » a disparu de la feuille', !!h_poids && !/Doul\./.test(n(h_poids)));
 ok('③ le titre devient « SURVEILLANCE QUOTIDIENNE »',
    !!h_poids && /SURVEILLANCE QUOTIDIENNE/.test(h_poids));
 ok('③ la colonne ajoutée est marquée', !!h_poids && /class="perso">Poids/.test(n(h_poids)));
 { const c = h_poids ? compte(h_poids) : {nth:-1,ntd:-1};
   ok('③ le compte des cases suit', c.nth === 8 && c.ntd === 8, c.nth + ' / ' + c.ntd); }

 /* ═══ ④ TOUT SUR LA MÊME FEUILLE ═══ */
 console.log('═══ SIX MESURES SUR UNE SEULE FEUILLE ═══');
 const h6 = await compose(pid, { cols:[{k:"ta",u:"cmHg"},{k:"puls",u:""},{k:"temp",u:""},
   {k:"sat",u:""},{k:"poids",u:"kg"},{k:"glyc",u:"mmol/L"}], jour:true, obs:true, init:true });
 ok('④ les six en-têtes sortent', !!h6 &&
    ["TA","Pouls","T°","Sat","Poids","Glyc."].every(x => n(h6).indexOf('>'+x) >= 0));
 ok('④ l\'unité choisie — mmol/L, pas g/L — est celle qui s\'imprime',
    !!h6 && /Glyc\.<span>mmol\/L<\/span>/.test(n(h6)) && !/<span>g\/L<\/span>/.test(n(h6)));
 ok('④ une unité vide n\'ajoute pas de second rang',
    !!h6 && /<th[^>]*>Pouls<\/th>/.test(n(h6)));
 { const c = h6 ? compte(h6) : {nth:-1,ntd:-1};
   ok('④ neuf colonnes, neuf cases', c.nth === 9 && c.ntd === 9, c.nth + ' / ' + c.ntd); }
 const au_dela = await pg.evaluate(id => {
   if (typeof fcolLire !== "function") return null;
   const p = getP(id);
   p.feuilleCols = { cols:"ta puls temp sat doul poids glyc diur".split(" ").map(k=>({k,u:""})),
                     jour:true, obs:true, init:true };
   return fcolLire(p, false).cols.length;
 }, pid);
 ok('④ au-delà de six, les surnuméraires sont écartées', au_dela === 6, au_dela);

 /* ═══ ⑤ RETIRER DES COLONNES ÉLARGIT LES CASES — MESURÉ ═══ */
 console.log('═══ LA PLACE RENDUE VA AUSSI AUX CASES DE MESURE ═══');
 const pg2 = await (await nav.newContext({viewport:{width:1000,height:1300}})).newPage();
 /* ⚠️ 1000 px DE LARGE : la feuille est bornée à 210 mm (794 px) par son
    propre CSS d'écran. À 430 px elle serait comprimée et toutes les
    mesures seraient fausses — le piège exact de la hauteur de `.pg`. */
 const mesurer = async (html) => {
   if (!html) return null;
   await pg2.setContent(html, { waitUntil:'load' });
   return await pg2.evaluate(() => {
     const ths = [...document.querySelectorAll('table th')];
     const tw = document.querySelector('table').getBoundingClientRect().width;
     return { tw:Math.round(tw), cells: ths.map(t => ({
       lbl: (t.childNodes[0] && t.childNodes[0].textContent || "").trim(),
       px: Math.round(t.getBoundingClientRect().width) })) };
   });
 };
 const px = (m, lbl) => { const c = m && m.cells.find(c => c.lbl === lbl); return c ? c.px : -1; };
 const m6 = await mesurer(h6);
 const h3 = await compose(pid, { cols:[{k:"ta",u:"cmHg"},{k:"puls",u:"bpm"},{k:"temp",u:"°C"}],
   jour:true, obs:true, init:true });
 const m3 = await mesurer(h3);
 const h2 = await compose(pid, { cols:[{k:"ta",u:"cmHg"},{k:"puls",u:"bpm"}],
   jour:true, obs:true, init:false });
 const m2 = await mesurer(h2);
 if (m6 && m3 && m2){
   console.log('     tableau rendu : ' + m6.tw + ' px (A4 utile ≈ 755 px)');
   console.log('     case « Pouls » : ' + px(m6,'Pouls') + ' px à 6 mesures · '
     + px(m3,'Pouls') + ' px à 3 · ' + px(m2,'Pouls') + ' px à 2 sans initiales');
   console.log('     observations   : ' + px(m6,'Observations') + ' → '
     + px(m3,'Observations') + ' → ' + px(m2,'Observations') + ' px');
 }
 ok('⑤ à 3 mesures, la case est au moins 1,3 fois plus large qu\'à 6',
    !!m3 && px(m3,'Pouls') >= px(m6,'Pouls') * 1.3,
    m3 ? px(m6,'Pouls') + ' → ' + px(m3,'Pouls') + ' px' : 'non mesuré');
 ok('⑤ à 2 mesures sans initiales, elle s\'élargit encore',
    !!m2 && px(m2,'Pouls') > px(m3,'Pouls'),
    m2 ? px(m3,'Pouls') + ' → ' + px(m2,'Pouls') + ' px' : 'non mesuré');
 /* ⚠️ CE CONTRÔLE EST LE CŒUR DE LA DEMANDE : « histoire d'avoir de la
    place pour une meilleure lisibilité ». Une version où seule la colonne
    des observations s'allonge le ferait tomber — c'est exactement l'erreur
    que la première maquette contenait. */
 ok('⑤ les observations gagnent AUSSI de la place',
    !!m2 && px(m2,'Observations') > px(m6,'Observations'),
    m2 ? px(m6,'Observations') + ' → ' + px(m2,'Observations') + ' px' : 'non mesuré');
 ok('⑤ les observations ne descendent jamais sous 22 % de la page',
    !!m6 && px(m6,'Observations') >= m6.tw * 0.22,
    m6 ? Math.round(px(m6,'Observations') / m6.tw * 100) + ' %' : 'non mesuré');
 /* La somme des cases fait la largeur du tableau : aucune ne sort. */
 if (m6){
   const somme = m6.cells.reduce((s,c) => s + c.px, 0);
   ok('⑤ aucune colonne ne sort du tableau',
      Math.abs(somme - m6.tw) <= 2, somme + ' px de cases pour ' + m6.tw + ' px de tableau');
 } else ok('⑤ aucune colonne ne sort du tableau', false, 'non mesuré');

 /* ═══ ⑥ RETIRER LES COLONNES FIXES ═══ */
 console.log('═══ LES COLONNES FIXES SE RETIRENT ═══');
 const hNoInit = await compose(pid, { cols:[{k:"ta",u:""},{k:"puls",u:""},{k:"temp",u:""}],
   jour:true, obs:true, init:false });
 ok('⑥ sans initiales, « Init. » ne s\'imprime plus',
    !!hNoInit && !/Init\./.test(n(hNoInit)));
 { const c = hNoInit ? compte(hNoInit) : {nth:-1,ntd:-1};
   ok('⑥ et le compte des cases suit', c.nth === 5 && c.ntd === 5, c.nth + ' / ' + c.ntd); }
 const hNoObs = await compose(pid, { cols:[{k:"ta",u:""},{k:"puls",u:""},{k:"temp",u:""}],
   jour:true, obs:false, init:true });
 ok('⑥ sans observations, la colonne disparaît',
    !!hNoObs && !/Observations/.test(n(hNoObs)));
 const mNoObs = await mesurer(hNoObs);
 if (mNoObs){
   const somme = mNoObs.cells.reduce((s,c) => s + c.px, 0);
   ok('⑥ et sa place va aux mesures, sans déborder',
      Math.abs(somme - mNoObs.tw) <= 2 && px(mNoObs,'TA') > px(m3,'TA'),
      'TA ' + px(m3,'TA') + ' → ' + px(mNoObs,'TA') + ' px, somme ' + somme + '/' + mNoObs.tw);
 } else ok('⑥ et sa place va aux mesures, sans déborder', false, 'non mesuré');
 /* ⚠️ JAMAIS ZÉRO MESURE : `fcolLire` doit rattraper un descripteur vidé,
    sinon l'utilisateur retrouve une feuille sans colonne à remplir. */
 const vide = await pg.evaluate(id => {
   if (typeof fcolLire !== "function") return null;
   const p = getP(id); p.feuilleCols = { cols:[], jour:true, obs:true, init:true };
   return fcolLire(p, false).cols.length;
 }, pid);
 ok('⑥ une composition vidée retombe sur le modèle d\'origine', vide === 5, vide);

 /* ═══ ⑦ LA COLONNE LIBRE ═══ */
 console.log('═══ LA COLONNE LIBRE ═══');
 const hLib = await compose(pid, { cols:[{k:"ta",u:""},{k:"poids",u:"kg"},
   {k:"libre",lbl:"Appétit",u:"— / + / ++"},{k:"libre",lbl:"Pansement",u:""}],
   jour:true, obs:true, init:true });
 ok('⑦ son nom s\'imprime en en-tête',
    !!hLib && /<th[^>]*>Appétit<span>— \/ \+ \/ \+\+<\/span>/.test(n(hLib)));
 ok('⑦ deux colonnes libres cohabitent', !!hLib && /Pansement/.test(n(hLib)));
 ok('⑦ sans unité, elle n\'a pas de second rang',
    !!hLib && /<th[^>]*>Pansement<\/th>/.test(n(hLib)));
 /* ⚠️ LE NOM EST ÉCHAPPÉ : il vient d'un champ libre. Un « < » non échappé
    casserait la feuille entière, et un « & » la mise en page. */
 const hEsc = await compose(pid, { cols:[{k:"ta",u:""},
   {k:"libre",lbl:'<b>Pl&ies</b>',u:'<i>n</i>'}], jour:true, obs:true, init:true });
 ok('⑦ un nom avec des chevrons est échappé, pas interprété',
    !!hEsc && /&lt;b&gt;Pl&amp;ies/.test(n(hEsc)) && !/<b>Pl/.test(n(hEsc)),
    hEsc ? (n(hEsc).match(/<th[^>]*>[^<]*Pl[^<]*/)||[""])[0] : 'non mesuré');

 /* ═══ ⑧ LES FEUILLES POIDS ET GLYCÉMIES NE BOUGENT PAS ═══ */
 console.log('═══ LES DEUX AUTRES FEUILLES SONT INTACTES ═══');
 const autres = await pg.evaluate(id => {
   const p = getP(id);
   return { po:feuilleHtml(p,"poids","serre",""), gl:feuilleHtml(p,"glycemies","serre","") };
 }, pid);
 ok('⑧ la feuille de poids garde ses dates libres et son écart',
    /SUIVI DU POIDS/.test(autres.po) && /width:11%">Écart/.test(n(autres.po))
    && /class="dt"/.test(autres.po));
 ok('⑧ la feuille des glycémies garde ses trois moments sur deux rangs',
    /SURVEILLANCE GLYCÉMIQUE/.test(autres.gl) && /rowspan="2"/.test(autres.gl)
    && /Matin/.test(autres.gl) && /class="sub-h"/.test(autres.gl));
 ok('⑧ la composition ne les contamine pas',
    !/Appétit|Pansement/.test(autres.po + autres.gl));

 /* ═══ ⑨ L'ÉCRAN DE COMPOSITION ═══ */
 console.log('═══ L\'ÉCRAN DE COMPOSITION ═══');
 await pg.evaluate(id => {
   const p = getP(id);
   if (typeof fcolEcrire === "function") fcolEcrire(p, false, fcolDefaut());
   closeSheet(); sheetFeuilles(id, "constantes");
 }, pid);
 await pg.waitForTimeout(450);
 const entree = await pg.evaluate(() => !!document.querySelector('#fe2-cols'));
 ok('⑨ la feuille des constantes propose de composer ses colonnes', entree === true);
 /* ⚠️ ET SEULEMENT ELLE : la proposer sur le poids promettrait quelque
    chose qui n'existe pas. */
 await pg.evaluate(id => { closeSheet(); sheetFeuilles(id, "poids"); }, pid);
 await pg.waitForTimeout(400);
 const pasSurPoids = await pg.evaluate(() => !!document.querySelector('#fe2-cols'));
 ok('⑨ la feuille de poids ne la propose pas', pasSurPoids === false);

 await pg.evaluate(id => { closeSheet(); sheetFeuilles(id, "constantes"); }, pid);
 await pg.waitForTimeout(400);
 if (entree){ await pg.click('#fe2-cols'); await pg.waitForTimeout(450); }
 const ecran = await pg.evaluate(() => ({
   palette: document.querySelectorAll('#sheet [data-fcm]').length,
   libre:   !!document.querySelector('#sheet [data-fclib]'),
   lignes:  document.querySelectorAll('#sheet [data-fcu]').length,
   fleches: document.querySelectorAll('#sheet [data-fcup]').length,
   croix:   document.querySelectorAll('#sheet [data-fcx]').length,
   fixes:   document.querySelectorAll('#sheet [data-fcf]').length,
   apercu:  document.querySelectorAll('#sheet table.fc-apr th').length,
   raz:     !!document.querySelector('#fc-raz'),
   fin:     !!document.querySelector('#fc-ok')
 }));
 console.log('     ' + JSON.stringify(ecran));
 ok('⑨ la palette montre toutes les mesures', ecran.palette >= 10, ecran.palette);
 ok('⑨ la colonne libre s\'ajoute depuis la palette', ecran.libre === true);
 ok('⑨ les cinq colonnes du modèle sont listées avec leur unité', ecran.lignes === 5, ecran.lignes);
 ok('⑨ chaque colonne a ses flèches et sa croix',
    ecran.fleches === 5 && ecran.croix === 5, ecran.fleches + ' / ' + ecran.croix);
 ok('⑨ les deux colonnes fixes sont des interrupteurs', ecran.fixes === 2, ecran.fixes);
 ok('⑨ l\'aperçu de l\'en-tête montre les huit colonnes', ecran.apercu === 8, ecran.apercu);
 ok('⑨ le retour au modèle d\'origine est proposé', ecran.raz === true);

 /* Un clic sur la palette doit se voir sur le papier, pas seulement à l'écran. */
 if (ecran.palette >= 10){
   await pg.click('#sheet [data-fcm="poids"]'); await pg.waitForTimeout(350);
   const apres = await pg.evaluate(id => ({
     lignes: document.querySelectorAll('#sheet [data-fcu]').length,
     html:   feuilleHtml(getP(id), "constantes", "serre", "")
   }), pid);
   ok('⑨ ajouter « Poids » d\'un clic l\'écrit sur la feuille',
      apres.lignes === 6 && /<th[^>]*class="perso">Poids/.test(n(apres.html)),
      apres.lignes + ' colonnes');
   /* ⚠️ ENREGISTRÉ TOUT DE SUITE, PAS AU TIRAGE : l'écran se referme par la
      flèche de retour aussi bien que par « Terminé ». Un enregistrement
      différé perdrait la composition sur le chemin le plus courant. */
   const persiste = await pg.evaluate(id => {
     const p = getP(id); return (p.feuilleCols && p.feuilleCols.cols || []).length; }, pid);
   ok('⑨ la composition est enregistrée sur la fiche sans attendre', persiste === 6, persiste);
   await pg.click('#sheet [data-fcx="5"]'); await pg.waitForTimeout(300);
   const retire = await pg.evaluate(() => document.querySelectorAll('#sheet [data-fcu]').length);
   ok('⑨ la croix retire la colonne', retire === 5, retire);

   /* ⚠️ LA TUILE DOIT DIRE CE QUE LA FEUILLE CONTIENT. Laissée en dur,
      elle annonçait « TA · pouls · T° · sat · douleur » sur une feuille
      où la douleur avait été remplacée par le poids : un écran qui mentait
      sur son propre contenu. */
   await pg.evaluate(id => {
     const p = getP(id);
     fcolEcrire(p, false, { cols:[{k:"ta",u:""},{k:"poids",u:"kg"}],
                            jour:true, obs:true, init:true });
     closeSheet(); sheetFeuilles(id, "constantes");
   }, pid);
   await pg.waitForTimeout(450);
   const tuile = await pg.evaluate(() => {
     const b = document.querySelector('#sheet [data-ft="constantes"] .src-sub');
     return b ? b.textContent.trim() : null; });
   ok('⑨ la tuile annonce les colonnes réellement composées',
      !!tuile && /poids/i.test(tuile) && !/doul/i.test(tuile), JSON.stringify(tuile));
   const resume = await pg.evaluate(() => {
     const p = [...document.querySelectorAll('#sheet p.small.muted')]
       .find(e => /poids/i.test(e.textContent) && !/densit/i.test(e.textContent));
     return p ? p.textContent.trim() : null; });
   ok('⑨ et le rappel sous le bouton aussi', !!resume, JSON.stringify(resume));
 } else {
   ok('⑨ ajouter « Poids » d\'un clic l\'écrit sur la feuille', false, 'écran absent');
   ok('⑨ la composition est enregistrée sur la fiche sans attendre', false, 'écran absent');
   ok('⑨ la croix retire la colonne', false, 'écran absent');
   ok('⑨ la tuile annonce les colonnes réellement composées', false, 'écran absent');
   ok('⑨ et le rappel sous le bouton aussi', false, 'écran absent');
 }

 /* ═══ ⑨ bis LES FEUILLES VIERGES ONT LEUR PROPRE COMPOSITION ═══ */
 console.log('═══ LES FEUILLES VIERGES, SANS DOSSIER ═══');
 /* ⚠️ DEUX RANGEMENTS DISTINCTS : la composition d'un patient vit sur sa
    fiche, celle des feuilles vierges dans les réglages. Un seul des deux
    et composer une feuille vierge aurait réécrit le dernier patient
    ouvert — ou l'inverse, selon le sens du raccourci. */
 const vg = await pg.evaluate(id => {
   if (typeof fcolEcrire !== "function") return null;
   const p = getP(id);
   fcolEcrire(p, false, { cols:[{k:"ta",u:""},{k:"doul",u:"/10"}], jour:true, obs:true, init:true });
   fcolEcrire({ _vierge:true }, true, { cols:[{k:"poids",u:"kg"},{k:"diur",u:"mL"}],
                                        jour:true, obs:true, init:false });
   return {
     patient: feuilleHtml(p, "constantes", "serre", ""),
     vierge:  feuilleHtml({ nom:"", prenom:"", dob:"", thresholds:{}, _vierge:true },
                          "constantes", "serre", ""),
     surFiche: (p.feuilleCols && p.feuilleCols.cols || []).map(c => c.k).join(","),
     surReglage: (S.feuilleColsVierge && S.feuilleColsVierge.cols || []).map(c => c.k).join(",")
   };
 }, pid);
 ok('⑨ bis la feuille vierge suit sa propre composition',
    !!vg && /Poids/.test(n(vg.vierge)) && /Diurèse/.test(n(vg.vierge))
    && !/Doul\./.test(n(vg.vierge)), vg ? vg.surReglage : 'non mesuré');
 ok('⑨ bis et celle du patient n\'a pas bougé',
    !!vg && /Doul\./.test(n(vg.patient)) && !/Diurèse/.test(n(vg.patient)),
    vg ? vg.surFiche : 'non mesuré');
 ok('⑨ bis les deux compositions sont rangées séparément',
    !!vg && vg.surFiche === "ta,doul" && vg.surReglage === "poids,diur",
    vg ? vg.surFiche + ' | ' + vg.surReglage : 'non mesuré');
 ok('⑨ bis la feuille vierge garde ses lignes à remplir à la main',
    !!vg && /class="lg"/.test(vg.vierge) && !/class="lg"/.test(vg.patient));
 /* L'écran de composition s'ouvre aussi sans dossier. */
 await pg.evaluate(() => {
   if (typeof sheetFeuilleColonnes === "function"){ closeSheet(); sheetFeuilleColonnes(null, "constantes"); }
 });
 await pg.waitForTimeout(450);
 const ecranVierge = await pg.evaluate(() => ({
   lignes: document.querySelectorAll('#sheet [data-fcu]').length,
   texte:  (document.querySelector('#sheet p.small.muted') || {}).textContent || ""
 }));
 ok('⑨ bis l\'écran s\'ouvre sans dossier, sur la composition des vierges',
    ecranVierge.lignes === 2 && /vierge/i.test(ecranVierge.texte),
    ecranVierge.lignes + ' colonnes · ' + JSON.stringify(ecranVierge.texte.slice(0, 60)));
 /* On repart d'une ardoise propre pour la suite de l'épreuve. */
 await pg.evaluate(id => {
   delete S.feuilleColsVierge;
   if (typeof fcolEcrire === "function") fcolEcrire(getP(id), false, fcolDefaut());
 }, pid);

 /* ═══ ⑩ L'ÉCRAN SUIT LES THÈMES ═══ */
 console.log('═══ L\'ÉCRAN SUIT LES THÈMES, SANS RÈGLE EN PLUS ═══');
 /* ⚠️ ON ROUVRE L'ÉCRAN DE COMPOSITION AVANT DE MESURER. Les contrôles
    précédents sont repassés par la feuille : mesurer sans rouvrir ne
    trouve aucune ligne et accuse tous les thèmes d'un contraste de 0 —
    une mesure qui ne voit pas ce qu'elle mesure ne dit rien. */
 await pg.evaluate(id => {
   if (typeof sheetFeuilleColonnes === "function"){ closeSheet(); sheetFeuilleColonnes(id, "constantes"); }
 }, pid);
 await pg.waitForTimeout(450);
 const lignePresente = await pg.evaluate(() => !!document.querySelector('#sheet .fc-n'));
 ok('⑩ l\'écran de composition est bien ouvert pour la mesure', lignePresente === true);
 /* ⚠️ MESURÉ SUR LES THÈMES CLAIRS AUTANT QUE SOMBRES : c'est un clair —
    Bureau 2001 — qui avait fait sortir l'écran des médicaments en blanc
    sur blanc. On vérifie le contraste réel du texte des lignes. */
 const themes = await pg.evaluate(() =>
   (typeof APP_THEMES !== "undefined") ? Object.keys(APP_THEMES) : []);
 const lum = c => { const [r,g,b] = c.match(/\d+(\.\d+)?/g).slice(0,3).map(Number);
   const f = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
   return .2126*f(r) + .7152*f(g) + .0722*f(b); };
 let pireT = null, pireV = 99;
 for (const t of themes){
   const r = await pg.evaluate(k => {
     S.theme = k; if (typeof applyTheme === "function") applyTheme();
     const row = document.querySelector('#sheet .fc-n');
     if (!row) return null;
     /* ⚠️ ON REMONTE JUSQU'AU PREMIER FOND RÉELLEMENT PEINT. `.rowbox` et
        `.fc-l` sont transparents : retomber sur `document.body` mesurait
        le DÉCOR du thème Réunion — un ardoise foncé derrière une feuille
        crème — et accusait l'écran d'un défaut qu'il n'a pas. C'est le
        piège même que `--inset` existe pour éviter. */
     let fond = null, el = row;
     while (el && el !== document.documentElement){
       const bg = getComputedStyle(el).backgroundColor;
       if (!/rgba\(0, 0, 0, 0\)|transparent/.test(bg)){ fond = bg; break; }
       el = el.parentElement;
     }
     if (!fond) fond = getComputedStyle(document.body).backgroundColor;
     return { txt:getComputedStyle(row).color, fond, sur:el ? (el.id || el.className) : "body" };
   }, t);
   if (!r){ pireT = t; pireV = 0; break; }
   const L1 = lum(r.txt), L2 = lum(r.fond);
   const c = (Math.max(L1,L2) + .05) / (Math.min(L1,L2) + .05);
   if (c < pireV){ pireV = c; pireT = t + ' (sur ' + r.sur + ')'; }
 }
 ok('⑩ le texte des lignes reste lisible sur les ' + themes.length + ' thèmes',
    pireV >= 4.5, 'pire : ' + pireT + ' à ' + pireV.toFixed(2) + ':1');
 /* L'aperçu, lui, doit rester en couleurs de PAPIER quel que soit le thème. */
 const apercuPapier = await pg.evaluate(() => {
   S.theme = "cosmos"; if (typeof applyTheme === "function") applyTheme();
   const th = document.querySelector('#sheet table.fc-apr th');
   if (!th) return null;
   const cs = getComputedStyle(th);
   return { bg:cs.backgroundColor, fg:cs.color };
 });
 ok('⑩ l\'aperçu reste en couleurs de papier, même en thème sombre',
    !!apercuPapier && lum(apercuPapier.bg) > 0.6 && lum(apercuPapier.fg) < 0.3,
    JSON.stringify(apercuPapier));

 /* ═══ ⑪ LA FEUILLE COMPOSÉE TIENT SUR UNE PAGE ═══ */
 console.log('═══ LA PAGINATION, COMPTÉE DANS LE PDF ═══');
 await pg.evaluate(() => { S.theme = "original"; if (typeof applyTheme==="function") applyTheme(); });
 const pg3 = await (await nav.newContext()).newPage();
 await pg3.emulateMedia({ media:'print' });
 const nbPages = async (html) => {
   if (!html) return -1;
   await pg3.setContent(html, { waitUntil:'load' });
   const buf = await pg3.pdf({ printBackground:true, preferCSSPageSize:true });
   return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
 };
 const MENTION = "Cabinet JmCve83 — 06 00 00 00 00\nAppeler en cas de valeur inhabituelle.";
 const hMax = await compose(pid, { cols:[{k:"ta",u:"cmHg"},{k:"puls",u:"bpm"},{k:"temp",u:"°C"},
   {k:"sat",u:"%"},{k:"poids",u:"kg"},{k:"glyc",u:"mmol/L"}], jour:true, obs:true, init:true });
 const hMaxM = await pg.evaluate(id => feuilleHtml(getP(id),"constantes","serre",
   "Cabinet JmCve83 — 06 00 00 00 00\nAppeler en cas de valeur inhabituelle."), pid);
 const p6 = await nbPages(hMax), p6m = await nbPages(hMaxM), pDef = await nbPages(brut);
 console.log('     modèle d\'origine : ' + pDef + ' page(s) · six mesures : ' + p6
   + ' · six mesures + mention de 2 lignes : ' + p6m);
 ok('⑪ six colonnes tiennent sur une seule face', p6 === 1, p6 + ' pages');
 ok('⑪ et avec une mention de deux lignes aussi', p6m === 1, p6m + ' pages');
 ok('⑪ le modèle d\'origine tient toujours sur une face', pDef === 1, pDef + ' pages');
 /* Les 31 jours sont là dans tous les cas — c'est la page qui déborde, jamais le tableau. */
 const jours = (n(hMax).match(/<td class="jr">\d+<\/td>/g) || []).length;
 ok('⑪ les 31 jours sont tous là', jours === 31, jours);

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
