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

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length === 0, errs[0]);

 console.log(ko.length ? `\n⚠ ${ko.length} point(s)` : '\n✓ tout tourne');
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})();
