// LIRE ET EXPORTER UN HISTORIQUE DE CONSTANTES.
//
// ⚠️ LES BORNES DE MOIS SONT LE VRAI SUJET. « Octobre » doit donner le
//    1ᵉʳ au 31, février 2026 le 1ᵉʳ au 28, février 2028 au 29, et décembre
//    doit basculer sur janvier de l'année suivante sans se décaler d'un
//    jour. Un `new Date(an, mo+1, 0)` donne le dernier jour du mois, mais
//    une conversion en ISO par le fuseau UTC le ramène au 30 à 23 h à
//    Toulon — d'où des bornes justes à l'écran et fausses dans le filtre.
//    C'est ce décalage que cette épreuve cherche, pas l'affichage.
//
// ⚠️ UNE SÉRIE SANS MESURE DOIT RESTER VISIBLE. Elle était masquée, et
//    l'absence se lisait « l'application ne sait pas tracer la glycémie ».
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8203,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8203/index.html'); await pg.waitForTimeout(2600);

 const pid = await pg.evaluate(() => {
   S.confidentialityAck = true; S.firstRun = false;
   const p = S.patients[0];
   p.visits = []; p.mesures = [];
   /* Trois jours de relevés, avec tension, pouls et glycémie — mais
      JAMAIS de saturation : c'est elle qui doit rester visible et éteinte. */
   [["2026-10-14","08:10",{ta:"13/8",puls:"72",glyc:"1.10"}],
    ["2026-10-14","19:05",{ta:"14/9",puls:"78",glyc:"1.42"}],
    ["2026-10-15","08:05",{ta:"12/7",puls:"68",glyc:"0.98"}]]
     .forEach(([d,at,c],i) => p.visits.push({ uid:"h"+i, date:d, at, soins:[], consts:c, note:"" }));
   return p.id;
 });

 /* ── Les bornes de période, là où les dates dérapent ── */
 console.log('═══ LES BORNES DE PÉRIODE ═══');
 const b = await pg.evaluate(() => ({
   oct26  : periodeBornes("mois", { an:2026, mo:9 }),
   fev26  : periodeBornes("mois", { an:2026, mo:1 }),
   fev28  : periodeBornes("mois", { an:2028, mo:1 }),   // bissextile
   dec26  : periodeBornes("mois", { an:2026, mo:11 }),
   jan27  : periodeBornes("mois", { an:2027, mo:0 }),
   libre  : periodeBornes("libre",{ du:"2026-10-15", au:"2026-09-01" }), // à l'envers exprès
 }));
 ok('octobre 2026 = du 01 au 31',
    b.oct26.debut === "2026-10-01" && b.oct26.fin === "2026-10-31",
    b.oct26.debut + " → " + b.oct26.fin);
 ok('février 2026 s\'arrête au 28',
    b.fev26.fin === "2026-02-28", b.fev26.fin);
 ok('février 2028 va au 29 (bissextile)',
    b.fev28.fin === "2028-02-29", b.fev28.fin);
 ok('décembre 2026 = du 01 au 31',
    b.dec26.debut === "2026-12-01" && b.dec26.fin === "2026-12-31",
    b.dec26.debut + " → " + b.dec26.fin);
 ok('janvier 2027 = du 01 au 31',
    b.jan27.debut === "2027-01-01" && b.jan27.fin === "2027-01-31",
    b.jan27.debut + " → " + b.jan27.fin);
 /* Deux mois qui se suivent se rangent bout à bout : c'est toute la
    raison d'être du mois calendaire face au glissant. */
 ok('décembre finit la veille du début de janvier',
    b.dec26.fin === "2026-12-31" && b.jan27.debut === "2027-01-01");
 ok('du/au à l\'envers est remis dans l\'ordre',
    b.libre.debut === "2026-09-01" && b.libre.fin === "2026-10-15",
    b.libre.debut + " → " + b.libre.fin);
 ok('le libellé du mois est en français', /Octobre 2026/i.test(b.oct26.lbl||""), b.oct26.lbl);

 /* ── L'écran de lecture ── */
 console.log('\n═══ COURBE, PUIS LES TROIS LECTURES EN CHIFFRES ═══');
 const vues = await pg.evaluate(async id => {
   sheetGraphConstantes(id);
   await new Promise(r=>setTimeout(r,400));
   const lire = () => ({
     series : [...document.querySelectorAll('#sheet [data-gk]')]
                .map(b => b.dataset.gk + (b.classList.contains('vide') ? ':vide' : '')),
     sousVues: [...document.querySelectorAll('#sheet [data-gs]')].map(b=>b.dataset.hv),
     texte  : (document.querySelector('#sheet .hl, #sheet .hp, #sheet .ht') ? true : false),
     courbe : !!document.querySelector('#sheet svg .graph-line, #sheet svg polyline'),
   });
   const dep = lire();
   const bl = [...document.querySelectorAll('#sheet [data-gv]')].find(b=>b.dataset.gv==='liste');
   if (bl) bl.click(); await new Promise(r=>setTimeout(r,320));
   const enListe = lire();
   const res = { depart:dep, liste:enListe, parVue:{} };
   for (const v of ['serie','passage','tableau']){
     const b = [...document.querySelectorAll('#sheet [data-gs]')].find(x=>x.dataset.gs===v);
     if (b){ b.click(); await new Promise(r=>setTimeout(r,320)); }
     res.parVue[v] = {
       lignes : document.querySelectorAll('#sheet .hl-r').length,
       blocs  : document.querySelectorAll('#sheet .hp').length,
       rangs  : document.querySelectorAll('#sheet .ht tbody tr').length,
     };
   }
   return res;
 }, pid);

 ok('on arrive sur la courbe', vues.depart.courbe === true);
 ok('la saturation jamais mesurée reste affichée, éteinte',
    vues.depart.series.includes('sat:vide'), JSON.stringify(vues.depart.series));
 ok('une série mesurée n\'est pas éteinte',
    vues.depart.series.includes('glyc'), JSON.stringify(vues.depart.series));
 ok('le second cran n\'apparaît qu\'en Liste',
    vues.depart.sousVues.length === 0 && vues.liste.sousVues.length === 3,
    `courbe ${vues.depart.sousVues.length} · liste ${vues.liste.sousVues.length}`);
 /* 3 relevés : la vue Série n'en montre que ceux de SA série, la vue
    Passage un bloc par passage, le Tableau une ligne par passage. */
 ok('vue Série : une ligne par mesure de la série',
    vues.parVue.serie.lignes === 3, JSON.stringify(vues.parVue.serie));
 ok('vue Passage : un bloc par passage',
    vues.parVue.passage.blocs === 3, JSON.stringify(vues.parVue.passage));
 ok('vue Tableau : une ligne par passage',
    vues.parVue.tableau.rangs === 3, JSON.stringify(vues.parVue.tableau));

 /* ── Le document imprimé : courbes, tableau, ou les deux ── */
 console.log('\n═══ CE QU\'ON IMPRIME ═══');
 const doc = await pg.evaluate(id => {
   const p = getP(id);
   const vs = mesuresDe(p);
   const faire = c => {
     const h = constHtml(p, vs, null, { contenu:c });
     return { svg: (h.match(/<svg/g)||[]).length, tbl: (h.match(/<table/g)||[]).length };
   };
   return { courbes:faire("courbes"), tableau:faire("tableau"), deux:faire("deux") };
 }, pid);
 ok('« Courbes » : des courbes, pas de tableau',
    doc.courbes.svg > 0 && doc.courbes.tbl === 0, JSON.stringify(doc.courbes));
 ok('« Tableau » : un tableau, pas de courbe',
    doc.tableau.tbl > 0 && doc.tableau.svg === 0, JSON.stringify(doc.tableau));
 ok('« Les deux » : les deux',
    doc.deux.svg > 0 && doc.deux.tbl > 0, JSON.stringify(doc.deux));

 /* ── LE REPÉRAGE DES DOUBLONS ──
    ⚠️ ÉCRITE AVANT LA FONCTION. L'origine est connue et datée : avant la
    v1.15.1, dans le déroulé, valider avec le bouton du bas puis appuyer
    une seule fois sur → créait un SECOND passage. Le formulaire restant
    rempli, ce doublon portait les mêmes constantes, à l'heure de la
    navigation — « même valeur, même jour, heure différente ».

    ⚠️ CE QU'UNE FAUSSE DÉTECTION COÛTERAIT : un relevé effacé à tort ne
    se retrouve pas. Les contrôles ci-dessous portent donc autant sur ce
    qu'il faut NE PAS proposer que sur ce qu'il faut trouver. ── */
 console.log('\n═══ LES DOUBLONS ═══');
 const dbl = await pg.evaluate(() => {
   const J = (at, c) => ({ date:"2026-10-12", at, consts:c });
   const cle = v => v.date + "|" + v.at;
   const test = (titre, vs, attendu) => {
     const trouve = [...doublonsConsts(vs, 5)].sort();
     return { titre, trouve, attendu:attendu.sort(),
              ok: JSON.stringify(trouve) === JSON.stringify(attendu.sort()) };
   };
   return [
     test("deux relevés identiques à 2 min",
          [J("08:10",{ta:"13/8",puls:"72"}), J("08:12",{ta:"13/8",puls:"72"})],
          ["2026-10-12|08:12"]),
     test("trois identiques d'affilée — on n'en garde qu'un",
          [J("08:10",{ta:"13/8"}), J("08:11",{ta:"13/8"}), J("08:13",{ta:"13/8"})],
          ["2026-10-12|08:11","2026-10-12|08:13"]),
     test("mêmes valeurs mais 6 min d'écart — AU-DELÀ du seuil",
          [J("08:10",{ta:"13/8"}), J("08:16",{ta:"13/8"})], []),
     test("2 min d'écart mais une valeur diffère",
          [J("08:10",{ta:"13/8",puls:"72"}), J("08:12",{ta:"13/8",puls:"75"})], []),
     test("2 min d'écart, l'un a une constante de plus",
          [J("08:10",{ta:"13/8"}), J("08:12",{ta:"13/8",glyc:"1.10"})], []),
     test("jours différents, mêmes valeurs et même heure",
          [{date:"2026-10-12",at:"08:10",consts:{ta:"13/8"}},
           {date:"2026-10-13",at:"08:10",consts:{ta:"13/8"}}], []),
     test("passages sans aucune constante",
          [J("08:10",{}), J("08:12",{})], []),
     test("l'ordre d'arrivée ne change rien — le plus TÔT est gardé",
          [J("08:12",{ta:"13/8"}), J("08:10",{ta:"13/8"})],
          ["2026-10-12|08:12"]),
     test("minuit : 23:58 et 00:01 le lendemain ne sont pas un doublon",
          [{date:"2026-10-12",at:"23:58",consts:{ta:"13/8"}},
           {date:"2026-10-13",at:"00:01",consts:{ta:"13/8"}}], []),
   ];
 });
 dbl.forEach(t => ok(t.titre, t.ok, `trouvé ${JSON.stringify(t.trouve)} · attendu ${JSON.stringify(t.attendu)}`));

 /* ── CHOISIR, REPÉRER, SUPPRIMER — dans l'écran réel ── */
 console.log('\n═══ L\'ÉCRAN DE NETTOYAGE ═══');
 const net = await pg.evaluate(async id => {
   const p = getP(id);
   /* Deux vrais passages, plus deux doublons à 2 minutes. */
   p.visits = []; p.mesures = [];
   const J = (date, at, c) => ({ uid:"n"+date+at, date, at, soins:[], consts:c, note:"" });
   p.visits.push(J("2026-10-12","08:02",{ta:"14/8",puls:"74"}));
   p.visits.push(J("2026-10-13","08:12",{ta:"13/8",puls:"70"}));
   p.visits.push(J("2026-10-13","08:14",{ta:"13/8",puls:"70"}));   // doublon
   p.visits.push(J("2026-10-14","08:10",{ta:"12/7",puls:"66"}));   // seul
   /* ⚠️ UNE MESURE ARCHIVÉE, SANS SON PASSAGE — c'est la situation réelle :
      un doublon supprimé autrefois par le 🗑 ordinaire a laissé sa mesure
      derrière lui, et elle pollue toujours les courbes. Le repérage doit la
      voir comme les autres, et la suppression doit l'emporter. */
   p.mesures = [{ id:"m1", date:"2026-10-12", at:"08:03", consts:{ta:"14/8",puls:"74"} }];

   sheetGraphConstantes(id); await new Promise(r=>setTimeout(r,420));
   document.querySelector('#sheet [data-gv="liste"]').click(); await new Promise(r=>setTimeout(r,280));
   document.querySelector('#sheet [data-gs="tableau"]').click(); await new Promise(r=>setTimeout(r,280));
   const res = { barre: !!document.querySelector('#sheet .htb'),
                 casesEnLecture: document.querySelectorAll('#sheet .ht .cb').length };

   document.querySelector('#sheet [data-hm="choisir"]').click(); await new Promise(r=>setTimeout(r,280));
   res.casesEnChoisir = document.querySelectorAll('#sheet .ht td.cb').length;
   res.cochesEnChoisir = document.querySelectorAll('#sheet .ht tr.sel').length;

   document.querySelector('#sheet [data-hm="doublons"]').click(); await new Promise(r=>setTimeout(r,320));
   res.marques = document.querySelectorAll('#sheet .ht tr.dbl').length;
   res.precoches = document.querySelectorAll('#sheet .ht tr.sel').length;
   res.compteur = (document.querySelector('#sheet .htb .cpt')||{}).textContent || "";

   /* On décoche une ligne : l'utilisateur garde la main. */
   const prem = document.querySelector('#sheet .ht tr.dbl');
   if (prem) prem.click(); await new Promise(r=>setTimeout(r,280));
   res.apresDecochage = document.querySelectorAll('#sheet .ht tr.sel').length;
   return res;
 }, pid);
 ok('une barre d\'outils en vue Tableau', net.barre === true);
 ok('aucune case tant qu\'on n\'a rien demandé', net.casesEnLecture === 0, String(net.casesEnLecture));
 ok('« Choisir » fait apparaître une case par relevé', net.casesEnChoisir === 5, String(net.casesEnChoisir));
 ok('… et n\'en coche aucune', net.cochesEnChoisir === 0, String(net.cochesEnChoisir));
 ok('« Repérer » marque les 2 doublons', net.marques === 2, String(net.marques));
 ok('… et les pré-coche', net.precoches === 2, String(net.precoches));
 ok('le compteur les annonce', /2 doublons/.test(net.compteur), net.compteur);
 ok('décocher une ligne la retire de la sélection', net.apresDecochage === 1, String(net.apresDecochage));

 /* La suppression : elle doit emporter la mesure archivée du même horodatage. */
 const sup = await pg.evaluate(async id => {
   const p = getP(id);
   const avant = { visits:p.visits.length, mesures:(p.mesures||[]).length };
   if (!document.querySelector('#sheet')) return { err:'pas de feuille' };
   /* On rejoue le repérage proprement, puis on supprime les deux. */
   sheetGraphConstantes(id); await new Promise(r=>setTimeout(r,400));
   document.querySelector('#sheet [data-gv="liste"]').click(); await new Promise(r=>setTimeout(r,250));
   document.querySelector('#sheet [data-gs="tableau"]').click(); await new Promise(r=>setTimeout(r,250));
   document.querySelector('#sheet [data-hm="doublons"]').click(); await new Promise(r=>setTimeout(r,320));
   document.querySelector('#sheet [data-hdel]').click(); await new Promise(r=>setTimeout(r,500));
   /* ⚠️ Le bouton de confirmation porte `data-yes` et vit hors de #sheet :
      le chercher par son libellé attrapait le bouton de l'écran lui-même. */
   const oui = document.querySelector('[data-yes]');
   if (oui){ oui.click(); await new Promise(r=>setTimeout(r,800)); }
   
   return { avant, apres:{ visits:p.visits.length, mesures:(p.mesures||[]).length },
            restants:p.visits.map(v=>v.date+" "+v.at) };
 }, pid);
 ok('le passage en double est supprimé',
    sup.apres.visits === sup.avant.visits - 1, JSON.stringify(sup));
 ok('la mesure archivée en double part aussi',
    sup.apres.mesures === 0, JSON.stringify(sup.apres));
 ok('les vrais passages restent',
    sup.restants.length === 3 && sup.restants.includes("2026-10-14 08:10"),
    JSON.stringify(sup.restants));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length === 0, errs[0]);

 console.log(ko.length ? `\n⚠ ${ko.length} point(s)` : '\n✓ tout tourne');
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})();
