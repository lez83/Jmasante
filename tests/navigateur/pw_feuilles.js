// LA MENTION EN BAS DES FEUILLES DE DOMICILE, SA TAILLE, ET LES
// DOCUMENTS VIERGES.
//
// ⚠️ ÉCRITE AVANT LA CORRECTION, et vérifiée en rouge en remettant le code
//    d'avant : le pied portait les NORMES en dur (« TA > 16 ou < 9 · Pouls
//    > 100… »), en 7 pt, et la mention saisie ne pouvait que les remplacer
//    le temps d'un tirage — l'écran rouvert repartait du texte d'origine.
//    Les trois contrôles qui tombent alors : le pied contient les normes,
//    la mention n'est pas proposée à la réouverture, le pied est à 7 pt.
//
// ⚠️ LA PAGINATION EST MESURÉE, PAS DÉDUITE. La hauteur rendue de `.pg` est
//    comparée à la hauteur utile d'une A4 (277 mm) pour chacune des trois
//    tailles. C'est ce qui autorise l'avertissement de l'écran à 10 pt — et
//    c'est ce qui a corrigé une affirmation fausse : le tableau ne perd
//    JAMAIS de ligne, les 31 jours sont toujours là, c'est la page qui
//    déborde.
//
// ⚠️ UNE SEULE MENTION POUR LES TROIS FEUILLES. Enregistrée depuis le poids,
//    elle doit être proposée sur les constantes. Un contrôle par sens.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8220,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8220/index.html'); await pg.waitForTimeout(2700);

 const pid = await pg.evaluate(() => {
   S.confidentialityAck=true; S.firstRun=false;
   delete S.feuilleMention; delete S.feuillePiedPt;
   openId=null; render();
   return S.patients[0].id;
 });

 /* ═══ ① LE PIED NE PORTE PLUS LES NORMES ═══ */
 console.log('═══ LE PIED NE PORTE QUE SA MENTION ═══');
 const sansMention = await pg.evaluate(id => {
   delete S.feuilleMention;
   return { c:feuilleHtml(getP(id),"constantes","serre",null),
            g:feuilleHtml(getP(id),"glycemies","serre",null),
            p:feuilleHtml(getP(id),"poids","serre",null) };
 }, pid);
 /* ⚠️ LES DEUX FORMES DU CHEVRON : les normes passaient par `esc()` sur un
    chemin (`&gt;`) et pas sur l'autre (`>`). Cherché sous une seule forme,
    le contrôle des constantes restait vert sur le code d'avant. */
 const NORME = /Pouls\s*(&gt;|>)\s*100|TA\s*(&gt;|>)\s*1|Hypoglyc|prise de plus de 2 kg|Douleur ≥/;
 ok('constantes : aucune norme en bas de feuille', !NORME.test(sansMention.c));
 ok('glycémies : aucune norme en bas de feuille',  !NORME.test(sansMention.g));
 ok('poids : aucune norme en bas de feuille',      !NORME.test(sansMention.p));
 /* ⚠️ DEPUIS LE FILIGRANE, LA LIGNE DU PIED EXISTE TOUJOURS : elle porte
    la signature. Ce qui doit être vide sans mention, c'est son texte. */
 ok('sans mention, le texte du pied est vide',
    /class="pd-t"><\/span>/.test(sansMention.c.replace(/\s+/g," ")),
    (sansMention.c.match(/class="pd-t">[^<]{0,40}/)||[""])[0]);

 /* La fonction des normes reste accessible — elle n'est plus posée d'office. */
 const normeDispo = await pg.evaluate(id =>
   typeof normesDefaut === "function" && /Pouls/.test(normesDefaut(getP(id),"constantes")), pid);
 ok('les normes restent disponibles pour qui veut les recopier', normeDispo === true);

 /* ═══ ② LA MENTION S'IMPRIME, SUR LES TROIS FEUILLES ═══ */
 console.log('═══ LA MENTION, LA MÊME POUR LES TROIS ═══');
 const MENTION = "Cabinet des Oliviers — 06 00 00 00 00";
 const avec = await pg.evaluate(([id, m]) => {
   S.feuilleMention = m;
   const r = {};
   ["constantes","poids","glycemies"].forEach(t => {
     const h = feuilleHtml(getP(id), t, "serre", null);
     r[t] = h.indexOf(m) > 0 && /class="pd"/.test(h);
   });
   /* Une consigne passée à la volée l'emporte sur la mémorisée. */
   r.volee = feuilleHtml(getP(id),"constantes","serre","Joyeuses fêtes !").indexOf("Joyeuses fêtes") > 0;
   r.videe = /class="pd-t"><\/span>/.test(feuilleHtml(getP(id),"constantes","serre","").replace(/\s+/g," "));
   return r;
 }, [pid, MENTION]);
 ok('la mention s\'imprime sur les constantes', avec.constantes === true);
 ok('… sur le poids',      avec.poids === true);
 ok('… sur les glycémies', avec.glycemies === true);
 ok('une mention ponctuelle l\'emporte sur la mémorisée', avec.volee === true);
 ok('champ vidé → aucune mention imprimée', avec.videe === true);

 /* Un chevron tapé dans la mention ne doit pas casser la mise en page. */
 const echap = await pg.evaluate(id =>
   feuilleHtml(getP(id),"constantes","serre",'<b>x</b> & "y"').indexOf("<b>x</b>") < 0, pid);
 ok('le texte saisi est échappé (pas de HTML injecté)', echap === true);

 /* ═══ ③ LA TAILLE DU PIED ═══ */
 console.log('═══ LA TAILLE DU PIED ═══');
 const tailles = await pg.evaluate(id => {
   const lire = h => (h.match(/\.pd\{[^}]*font-size:([\d.]+)pt/)||[])[1];
   delete S.feuillePiedPt;
   const def = lire(feuilleHtml(getP(id),"constantes","serre",null));
   const r = { def };
   [7,8.5,10].forEach(v => { S.feuillePiedPt = v;
     r["t"+v] = lire(feuilleHtml(getP(id),"constantes","serre",null)); });
   delete S.feuillePiedPt;
   return r;
 }, pid);
 ok('par défaut le pied est à 8,5 pt, plus à 7 pt', tailles.def === "8.5", tailles.def);
 ok('7 pt est respecté',   tailles.t7 === "7",    tailles.t7);
 ok('8,5 pt est respecté', tailles["t8.5"] === "8.5", tailles["t8.5"]);
 ok('10 pt est respecté',  tailles.t10 === "10",  tailles.t10);

 /* ═══ ④ LA PAGINATION, MESURÉE À L'IMPRESSION ═══ */
 /* ⚠️ PREMIÈRE MESURE FAUSSE, GARDÉE EN MÉMOIRE : mesurer la hauteur de
    `.pg` dans un iframe donnait 305 mm à TOUTES les tailles et faisait
    croire que même 7 pt débordait. C'était le `padding` de l'aperçu écran
    (18 mm) et le `min-height:277mm` qu'on mesurait, pas la pagination.
    Seul le nombre de pages du PDF dit ce qui sort de l'imprimante. */
 console.log('═══ CE QUI TIENT SUR UNE PAGE (pages du PDF) ═══');
 const feuille = (pt, mention) => pg.evaluate(([id, p, m]) => {
   S.feuillePiedPt = p;
   const h = feuilleHtml(getP(id), "constantes", "serre", m);
   delete S.feuillePiedPt;
   return h;
 }, [pid, pt, mention]);
 const ctx2 = await nav.newContext();
 const pg2 = await ctx2.newPage();
 await pg2.emulateMedia({ media:'print' });
 const nbPages = async (html) => {
   await pg2.setContent(html, { waitUntil:'load' });
   const buf = await pg2.pdf({ printBackground:true, preferCSSPageSize:true });
   return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
 };
 const M1 = MENTION;
 const M2 = MENTION + "\nSignalez toute valeur hors norme avant d'appeler le médecin.";
 const M4 = M2 + "\nMerci de garder la feuille à portée de main.\nQuatrième ligne.";
 const M5 = M4 + "\nCinquième ligne de mention.";
 const r = {};
 for (const pt of [7, 8.5, 10]) for (const [n, m] of [["1",M1],["2",M2],["4",M4],["5",M5]])
   r[pt + "x" + n] = await nbPages(await feuille(pt, m));
 r.vide = await nbPages(await feuille(8.5, ""));
 console.log("     lignes de mention →      1   2   4   5");
 [7, 8.5, 10].forEach(pt => console.log(`     ${String(pt).padEnd(4)} pt              ` +
   ["1","2","4","5"].map(n => "  " + r[pt+"x"+n]).join(" ")));
 /* ⚠️ CE SONT CES QUATRE CHIFFRES QUI ONT COMMANDÉ LA CORRECTION : à 8,1 mm
    de hauteur de ligne, les colonnes « 2 » et « 4 » valaient 2 pages à
    TOUTES les tailles. Une mention de deux lignes renvoyait la feuille
    serrée au verso. */
 ok('1 ligne de mention : une page aux trois tailles',
    r["7x1"]===1 && r["8.5x1"]===1 && r["10x1"]===1, [r["7x1"],r["8.5x1"],r["10x1"]].join("/"));
 ok('2 lignes : une page aux trois tailles — c\'est la correction',
    r["7x2"]===1 && r["8.5x2"]===1 && r["10x2"]===1, [r["7x2"],r["8.5x2"],r["10x2"]].join("/"));
 ok('4 lignes : une page aux trois tailles',
    r["7x4"]===1 && r["8.5x4"]===1 && r["10x4"]===1, [r["7x4"],r["8.5x4"],r["10x4"]].join("/"));
 ok('5 lignes à 10 pt : deux pages — c\'est ce que l\'écran annonce', r["10x5"] >= 2, r["10x5"]);
 ok('aucune mention : une page', r.vide === 1, r.vide);
 /* La hauteur de ligne ne se resserre QUE s'il y a un pied. */
 const hauteurs = await pg.evaluate(([id]) => {
   const lire = h => (h.match(/td\{[^}]*height:([\d.]+mm)/)||[])[1];
   return { sans: lire(feuilleHtml(getP(id),"constantes","serre","")),
            avec: lire(feuilleHtml(getP(id),"constantes","serre","x")),
            confort: lire(feuilleHtml(getP(id),"constantes","confort","x")) };
 }, [pid]);
 /* ⚠️ LE RESSERREMENT N'EST PLUS CONDITIONNEL : la ligne du pied porte la
    signature du filigrane, donc elle est là même sans mention. L'épreuve
    a trouvé le défaut — vidé, le champ faisait déborder la feuille. */
 ok('la ligne serrée est à 7,6 mm, avec ou sans mention',
    hauteurs.sans === "7.6mm" && hauteurs.avec === "7.6mm", hauteurs.sans + " / " + hauteurs.avec);
 ok('la densité confortable n\'est pas touchée', hauteurs.confort === "15.5mm", hauteurs.confort);
 /* ⚠️ L'affirmation à ne pas répéter : le tableau ne perd pas de ligne. */
 const lignes = await pg.evaluate(([id]) => {
   const n = pt => { S.feuillePiedPt = pt;
     const h = feuilleHtml(getP(id),"constantes","serre","x"); delete S.feuillePiedPt;
     return (h.match(/<tr[ >]/g)||[]).length; };
   return [n(7), n(10)];
 }, [pid]);
 ok('le tableau garde ses 31 jours à toutes les tailles',
    lignes[0] === lignes[1] && lignes[0] >= 32, lignes.join(" vs "));
 await ctx2.close();

 /* ═══ ⑤ LA FEUILLE VIERGE, SANS DOSSIER ═══ */
 console.log('═══ LA FEUILLE VIERGE ═══');
 const vg = await pg.evaluate(id => {
   const v = feuilleHtml({ nom:"", prenom:"", dob:"", thresholds:{}, _vierge:true }, "constantes", "serre", null);
   const p = getP(id);
   return { lignes: /class="lg"/.test(v), nom: /Nom\s*:/.test(v),
            pasDeNom: v.indexOf(p.nom.replace("Demo-","").toUpperCase()) < 0,
            table: (v.match(/<tr[ >]/g)||[]).length,
            dossier: /class="lg"/.test(feuilleHtml(p,"constantes","serre",null)) };
 }, pid);
 ok('la feuille vierge porte des lignes à remplir', vg.lignes === true);
 ok('… avec « Nom : » en en-tête', vg.nom === true);
 ok('… et aucun nom de patient', vg.pasDeNom === true);
 ok('… et le même tableau de 31 jours', vg.table >= 32, vg.table);
 ok('une feuille de dossier garde son nom imprimé, pas de ligne vide', vg.dossier === false);

 /* ═══ ⑥ LE PARCOURS : RÉGLAGES → DOCUMENTS VIERGES ═══ */
 console.log('═══ DOCUMENTS VIERGES DEPUIS MES OUTILS ═══');
 await pg.evaluate(() => { S.menuMode = "list"; sheetTours(); });
 await pg.waitForTimeout(400);
 const entree = await pg.evaluate(() => {
   const b = [...document.querySelectorAll('#sheet [data-sec="vierges"]')];
   return { present: b.length === 1, libelle: b[0] ? b[0].textContent.trim() : "" };
 });
 ok('« Mes outils » porte l\'entrée en mode liste', entree.present === true, entree.libelle);
 await pg.evaluate(() => { S.menuMode = "tiles"; sheetTours(); });
 await pg.waitForTimeout(400);
 ok('… et en mode tuiles',
    await pg.evaluate(() => document.querySelectorAll('#sheet [data-sec="vierges"]').length === 1));

 await pg.evaluate(() => { menuGo("vierges"); });
 await pg.waitForTimeout(400);
 const liste = await pg.evaluate(() => ({
   ouvert: !!document.querySelector('#veil.on'),
   docs: [...document.querySelectorAll('#sheet [data-dv]')].map(b => b.dataset.dv),
   /* ⚠️ SUR LES ENTRÉES, PAS SUR LE TEXTE DE L'ÉCRAN : le réglage du
      filigrane énumère les documents concernés, « relève » comprise, et
      un contrôle posé sur tout le texte tombait sur sa propre explication. */
   pasDeReleve: ![...document.querySelectorAll('#sheet [data-dv]')]
       .some(b => /relève|releve/i.test(b.textContent))
 }));
 ok('l\'écran s\'ouvre', liste.ouvert === true);
 ok('les trois feuilles y sont', ["c","p","g"].every(k => liste.docs.includes(k)), liste.docs.join(","));
 ok('la relève vierge n\'y est pas — « elle ne sert pas »', liste.pasDeReleve === true);

 /* La feuille s'ouvre sans dossier, et sans erreur. */
 await pg.click('#sheet [data-dv="c"]'); await pg.waitForTimeout(400);
 const ecran = await pg.evaluate(() => {
   const t = document.querySelector('#fe2-cons');
   return { textarea: !!t, valeur: t ? t.value : null,
            vierge: /vierge/i.test(document.querySelector('#sheet').textContent),
            tailles: document.querySelectorAll('#sheet [data-fpt]').length };
 });
 ok('la feuille vierge s\'ouvre sans dossier', ecran.textarea === true);
 ok('… et se dit vierge à l\'écran', ecran.vierge === true);
 ok('… avec le réglage de taille', ecran.tailles === 3, ecran.tailles);
 ok('la dernière mention est proposée', ecran.valeur === MENTION, JSON.stringify(ecran.valeur));

 /* Le retour d'une feuille vierge ramène à la liste, pas à un dossier vide. */
 await pg.evaluate(() => { const b = document.getElementById('nav-back'); if (b) b.click(); });
 await pg.waitForTimeout(400);
 ok('le retour ramène aux documents vierges, pas à un dossier vide',
    await pg.evaluate(() => document.querySelectorAll('#sheet [data-dv]').length === 3 ||
      /Documents vierges/.test(document.querySelector('#sheet').textContent)));
 await pg.click('#sheet [data-dv="c"]'); await pg.waitForTimeout(350);

 /* ═══ ⑦ CE QU'ON TIRE EST CE QUI REVIENT ═══ */
 console.log('═══ LA MENTION MÉMORISÉE AU TIRAGE ═══');
 await pg.fill('#fe2-cons', "Joyeuses fêtes — cabinet fermé le 25");
 const avantTirage = await pg.evaluate(() => S.feuilleMention);
 ok('taper ne suffit pas à l\'enregistrer', avantTirage === MENTION, avantTirage);
 await pg.click('#fe2-show'); await pg.waitForTimeout(700);
 const apres = await pg.evaluate(() => S.feuilleMention);
 ok('l\'aperçu l\'enregistre', apres === "Joyeuses fêtes — cabinet fermé le 25", apres);

 /* ⚠️ L'aperçu laisse `#fichePrev` par-dessus l'écran : sans l'enlever, les
    clics suivants portent sur l'iframe de l'aperçu et l'épreuve attend
    trente secondes un bouton pourtant visible. */
 await pg.evaluate(() => { const e = document.getElementById("fichePrev"); if (e) e.remove(); });

 /* Rouvert depuis une autre feuille : la même mention est proposée. */
 await pg.evaluate(() => { closeSheet(); sheetFeuilles(null, "poids"); });
 await pg.waitForTimeout(400);
 const repris = await pg.evaluate(() => {
   const t = document.querySelector('#fe2-cons'); return t ? t.value : null; });
 ok('la feuille de poids propose la même mention', repris === "Joyeuses fêtes — cabinet fermé le 25", JSON.stringify(repris));

 /* Et depuis un dossier patient, aussi : une seule mention pour tout. */
 await pg.evaluate(id => { closeSheet(); sheetFeuilles(id); }, pid);
 await pg.waitForTimeout(400);
 const depuisDossier = await pg.evaluate(() => {
   const t = document.querySelector('#fe2-cons'); return t ? t.value : null; });
 ok('depuis un dossier patient aussi', depuisDossier === "Joyeuses fêtes — cabinet fermé le 25", JSON.stringify(depuisDossier));

 /* Le bouton « Aucune mention » vide vraiment la feuille. */
 await pg.click('#fe2-cvide'); await pg.waitForTimeout(250);
 const vide = await pg.evaluate(() => {
   const t = document.querySelector('#fe2-cons'); return t ? t.value : null; });
 ok('« Aucune mention » vide le champ', vide === "", JSON.stringify(vide));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
