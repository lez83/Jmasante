/* ══════════════════════════════════════════════════════════════
   ÉPREUVE — LE FILET « BROUILLON D'ÉCRAN »            (v1.29.0)
   ─────────────────────────────────────────────────────────────
   CE QU'ELLE GARDE, et pourquoi elle existe :

   On remplit un écran de saisie, on touche la flèche de retour
   sans valider, on ROUVRE l'écran. La saisie doit être là, ou
   une étiquette doit proposer de la reprendre.

   ⚠️ C'EST LA RÉOUVERTURE QUI COMPTE, PAS LA FERMETURE. La
   première version de cette mesure regardait si le texte restait
   dans un panneau DÉJÀ FERMÉ : elle déclarait « ma fiche »
   perdue (faux) et laissait passer le bloc-notes (vrai défaut).
   Une mesure qui ne voit pas ce qu'elle mesure ne dit rien.

   ⚠️ ON TAPE DANS UN CHAMP QUE LE MOTEUR SAIT NOMMER — `id` ou
   premier attribut `data-*`, exactement comme `_brRef`. Taper
   dans un champ anonyme mesurait la survie d'un champ que le
   filet ne regarde pas : trois lignes du tableau ne valaient
   rien et s'affichaient en vert.

   ⚠️ UN ÉCRAN SANS CHAMP TROUVÉ EST UN ÉCHEC, pas un succès.
   Une clé de modèle invalide ouvrait un écran vide et l'épreuve
   le comptait bon.

   ⚠️ LE DÉFAUT QU'ELLE A ATTRAPÉ était une CORRUPTION, pas un
   oubli : `brouillonForcer()` tournait depuis `_brInstaller`,
   donc APRÈS le remplacement du contenu de l'écran. Il écrivait
   les champs du NOUVEL écran sous la clé de l'ANCIEN. Mesuré :
   la saisie de l'ordonnance remplacée par `f-nom`/`f-prenom` de
   la fiche patient, sous la clé de l'ordonnance. L'étiquette
   « saisie gardée » s'affichait et ne restaurait rien — aucun de
   ses champs n'existait là. Une perte déguisée en filet.
   D'où le contrôle `repris` : la présence de l'étiquette ne
   prouve rien, seul le retour du texte le prouve.
══════════════════════════════════════════════════════════════ */
const { chromium } = require("playwright");
const http = require("http"), fs = require("fs"), path = require("path");

const RACINE = path.join(__dirname, "..", "..", "www");
const PORT = 8231;
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
  ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml",
  ".webmanifest":"application/manifest+json", ".ico":"image/x-icon" };

const ECRANS = [
  ["fiche patient",      "sheetPatient(getP(i))"],
  ["ordonnance",         "sheetOrdonnance(i)"],
  ["courrier",           'sheetCourrier({dest:"",objet:""})'],
  ["ma fiche",           "sheetMoi()"],
  ["DLU",                "sheetDLU(i)"],
  ["recueil",            "sheetRecueil(i)"],
  ["note (bloc-notes)",  "sheetNoteEdit(null, i)"],
  ["modèle de document", "sheetModeleEdit(DOC_MODELES[0].cle, i)"],
  ["aide-mémoire",       "sheetAideEdit(i)"],
  ["médicament perso",   'sheetMedEdit("", null)'],
  ["nouveau bilan",      "sheetNewBilan(i)"],
  ["en-tête ordo dispo", "sheetOrdoEntete(i)"],
  ["ordonnance dispo",   "sheetOrdoDispo(i)"],
  ["contact du cabinet", 'sheetCabContact(null, "med")'],
  ["rappel",             "sheetEditRappel(i, null)"],
  ["nouveau soin",       "sheetNewSoin()"]
];

let ok = 0, ko = 0;
function vrai(cond, quoi, detail){
  if (cond){ ok++; console.log("  ✓ " + quoi); }
  else { ko++; console.log("  ✗ " + quoi + (detail ? "  → " + detail : "")); }
}

(async () => {
  const srv = http.createServer((q, r) => {
    let u = decodeURIComponent(q.url.split("?")[0]);
    if (u === "/") u = "/index.html";
    const f = path.join(RACINE, u);
    if (!f.startsWith(RACINE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){
      r.writeHead(404); r.end("404"); return;
    }
    r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" });
    r.end(fs.readFileSync(f));
  });
  await new Promise(r => srv.listen(PORT, r));

  const nav = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
  const ctx = await nav.newContext({ viewport: { width: 430, height: 950 } });
  const pg = await ctx.newPage();
  const erreurs = [];
  pg.on("pageerror", e => erreurs.push(String(e).slice(0, 90)));

  console.log("\n═══ LE FILET « BROUILLON D'ÉCRAN » ═══\n");
  await pg.goto("http://localhost:" + PORT + "/index.html");
  await pg.waitForTimeout(2700);

  const pid = await pg.evaluate(() => {
    S.confidentialityAck = true; S.firstRun = false; S.essaisDeverrouille = true;
    openId = null; render(); return S.patients[0].id;
  });

  /* ── Le moteur existe-t-il ? Sans cela le reste n'a pas de sens ── */
  const moteur = await pg.evaluate(() => ({
    ref: typeof _brRef === "function",
    forcer: typeof brouillonForcer === "function",
    purger: typeof brouillonsPurger === "function",
    base: !!S.brouillons
  }));
  vrai(moteur.ref, "le moteur sait nommer un champ (_brRef)");
  vrai(moteur.forcer, "la saisie peut être gardée à la demande (brouillonForcer)");
  vrai(moteur.purger, "les vieux brouillons se purgent (brouillonsPurger)");
  vrai(moteur.base, "l'état porte un casier à brouillons");

  /* ── L'ORDRE D'ÉCRITURE : garder AVANT d'effacer l'écran ──
     C'est le défaut exact de la première version. On le garde
     par la source, parce qu'aucune mesure de comportement ne
     distinguait « gardé avant » de « gardé après ». */
  const src = await pg.evaluate(() => String(openSheet));
  const posF = src.indexOf("brouillonForcer");
  const posH = src.indexOf("innerHTML");
  vrai(posF > -1 && posH > -1 && posF < posH,
    "openSheet garde la saisie AVANT de remplacer l'écran",
    "forcer@" + posF + " innerHTML@" + posH);

  /* ── Les écrans, un par un ── */
  console.log("");
  for (const [nom, ouvrir] of ECRANS){
    const r = await pg.evaluate(async ([o, i]) => {
      const MARQUE = "EPREUVE-BROUILLON-83";
      S.brouillons = {};
      if (typeof closeSheet === "function") closeSheet(true);
      await new Promise(r => setTimeout(r, 250));
      try { eval(o); } catch(e){ return { err: String(e).slice(0, 60) }; }
      await new Promise(r => setTimeout(r, 700));

      const nomme = e => (typeof _brRef === "function") ? _brRef(e) : (e.id || "");
      const vus = [...document.querySelectorAll(
        "#sheet input[type=text], #sheet input:not([type]), #sheet textarea")]
        .filter(e => e.offsetParent !== null && nomme(e));
      if (!vus.length) return { champs: 0 };

      const c0 = vus[0], ref = nomme(c0);
      c0.value = MARQUE;
      ["input", "change", "blur"].forEach(t => c0.dispatchEvent(new Event(t, { bubbles:true })));
      await new Promise(r => setTimeout(r, 400));

      const back = document.getElementById("nav-back");
      if (!back) return { retour: "absent" };
      back.click();
      await new Promise(r => setTimeout(r, 650));

      /* Un écran peut déjà poser sa propre question : c'est un filet
         aussi, et le meilleur. On y répond « non » pour éprouver
         malgré tout la reprise. */
      const question = !!document.querySelector(".dlg-veil, .dlg-card");
      if (question){
        const no = document.querySelector(".dlg-veil [data-no], .dlg-cancel");
        if (no) no.click();
        await new Promise(r => setTimeout(r, 300));
        if (typeof closeSheet === "function") closeSheet(true);
        await new Promise(r => setTimeout(r, 250));
      }

      /* ON ROUVRE : la seule question qui compte. */
      try { eval(o); } catch(e){ return { err2: String(e).slice(0, 60) }; }
      await new Promise(r => setTimeout(r, 700));
      const porte = () => [...document.querySelectorAll("#sheet input, #sheet textarea")]
        .some(e => String(e.value || "").includes(MARQUE));

      let retrouve = porte(), repris = false;
      const prop = document.getElementById("br-reprendre");
      if (!retrouve && prop){
        prop.click();
        await new Promise(r => setTimeout(r, 400));
        repris = porte();
        retrouve = repris;
      }
      if (typeof closeSheet === "function") closeSheet(true);
      return { champs: vus.length, ref, question, etiquette: !!prop, repris, retrouve };
    }, [ouvrir, pid]);

    const detail = JSON.stringify(r);
    vrai(!r.err && !r.err2 && !r.retour && r.champs > 0,
      nom + " — l'épreuve a bien de quoi mesurer", detail);
    if (r.champs > 0) vrai(r.retrouve, nom + " — la saisie survit au retour", detail);
  }

  /* ── Le brouillon ne doit pas survivre au geste principal ──
     Sinon on produit son ordonnance, on rouvre la semaine
     suivante, et le texte de l'autre fois revient se proposer. */
  console.log("");
  const consomme = await pg.evaluate(async i => {
    S.brouillons = {}; closeSheet(true);
    await new Promise(r => setTimeout(r, 250));
    sheetNewSoin(); await new Promise(r => setTimeout(r, 600));
    const c = document.querySelector("#sheet input#ns-nom");
    if (!c) return { pasDeChamp: true };
    c.value = "SOIN-TEMOIN";
    c.dispatchEvent(new Event("input", { bubbles:true }));
    await new Promise(r => setTimeout(r, 1100));
    const avant = JSON.stringify(S.brouillons).includes("SOIN-TEMOIN");
    const b = document.querySelector("#sheet .btn-primary");
    if (!b) return { pasDeBouton: true, avant };
    b.click();
    await new Promise(r => setTimeout(r, 600));
    /* ⚠️ ON SUIT LE TÉMOIN, PAS LE NOMBRE DE CLÉS. Le bouton principal
       enchaîne souvent sur un autre panneau, qui garde à son tour : le
       casier n'est donc pas vide, et compter les clés accusait l'app à
       tort tout en laissant passer le vrai défaut — l'ancien brouillon
       conservé, le nouveau effacé. */
    return { avant, apres: JSON.stringify(S.brouillons).includes("SOIN-TEMOIN"),
             cles: Object.keys(S.brouillons || {}).length };
  }, pid);
  vrai(consomme.avant === true, "la saisie en cours est bien gardée", JSON.stringify(consomme));
  vrai(consomme.apres === false, "le bouton principal consomme le brouillon de SON écran", JSON.stringify(consomme));

  /* ── LE CLOISONNEMENT ENTRE DOSSIERS ──
     ⚠️ CE CONTRÔLE N'EXISTAIT PAS, ET LE DÉFAUT ÉTAIT ENTIER : les
     identifiants de champs sont les mêmes pour tous les patients, donc
     l'empreinte de l'écran l'était aussi. Mesuré avant correction : les
     NEUF écrans liés à un dossier proposaient le brouillon d'un patient
     chez un autre, texte repris à l'appui — avec son nom et sa date de
     naissance. Le mécanisme prévu pour cela (`sheetBrouillonPour`)
     existait et n'était appelé par personne. */
  console.log("");
  const paires = [
    ["fiche patient",      "sheetPatient(getP(P))"],
    ["ordonnance",         "sheetOrdonnance(P)"],
    ["DLU",                "sheetDLU(P)"],
    ["recueil",            "sheetRecueil(P)"],
    ["note",               "sheetNoteEdit(null, P)"],
    ["nouveau bilan",      "sheetNewBilan(P)"],
    ["en-tête ordo dispo", "sheetOrdoEntete(P)"],
    ["ordonnance dispo",   "sheetOrdoDispo(P)"],
    ["rappel",             "sheetEditRappel(P, null)"],
    ["calculs",            "sheetCalculs(P)"],
    ["dispositifs",        "sheetDispositifs(P)"],
    ["feuilles",           "sheetFeuilles(P)"],
    ["traitement",         "sheetTraitement(P)"],
    ["historique",         "sheetHist(P)"]
  ];
  const deux = await pg.evaluate(() => (S.patients || []).slice(0, 2).map(p => p.id));
  vrai(deux.length === 2, "deux dossiers disponibles pour éprouver le cloisonnement");
  for (const [nom, ouvrir] of paires){
    const r = await pg.evaluate(async ([o, a, b]) => {
      const M = "CLOISON-83";
      S.brouillons = {}; closeSheet(true);
      await new Promise(r => setTimeout(r, 250));
      let P = a;
      try { eval(o); } catch(e){ return { err: String(e).slice(0, 50) }; }
      await new Promise(r => setTimeout(r, 650));
      /* ⚠️ `_brRef` N'EXISTE PAS DANS LA VERSION D'AVANT : l'appel nu
         faisait sauter tout le processus, et la vérification en rouge ne
         disait plus rien des contrôles suivants. Une épreuve doit
         tomber, pas planter. */
      const nomme = e => (typeof _brRef === "function") ? _brRef(e) : (e.id || "");
      const ch = [...document.querySelectorAll(
        "#sheet input[type=text], #sheet input:not([type]), #sheet textarea")]
        .filter(e => e.offsetParent !== null && nomme(e));
      if (!ch.length) return { champs: 0 };
      ch[0].value = M; ch[0].dispatchEvent(new Event("input", { bubbles:true }));
      await new Promise(r => setTimeout(r, 1100));
      const cleA = (typeof _brCle !== "undefined") ? _brCle : null;
      closeSheet(true); await new Promise(r => setTimeout(r, 300));
      P = b;
      try { eval(o); } catch(e){ return { err2: String(e).slice(0, 50) }; }
      await new Promise(r => setTimeout(r, 700));
      const etiq = !!document.getElementById("br-reprendre");
      let repris = false;
      if (etiq){
        document.getElementById("br-reprendre").click();
        await new Promise(r => setTimeout(r, 400));
        repris = [...document.querySelectorAll("#sheet input, #sheet textarea")]
          .some(e => String(e.value || "").includes(M));
      }
      closeSheet(true);
      const cleB = (typeof _brCle !== "undefined") ? _brCle : null;
      return { memeCle: cleA === cleB, sansCle: cleA === null,
               etiquette: etiq, repris, champs: ch.length,
               moteur: typeof _brCle !== "undefined" };
    }, [ouvrir, deux[0], deux[1]]);
    /* ⚠️ UN ÉCRAN SANS CLÉ N'EST PAS UN ÉCRAN QUI FUIT. Depuis que les
       champs de recherche sont exclus, « dispositifs » et « historique »
       n'ont plus aucun champ à garder : le moteur ne leur ouvre pas de
       casier, les deux clés valent null, et `memeCle` devient vrai sans
       qu'il se soit rien passé. Ce qui compte reste le fait : aucune
       étiquette, aucun texte repris chez l'autre patient. */
    vrai(r.moteur === true && !r.err && !r.err2 && r.champs > 0 &&
         (r.sansCle || r.memeCle === false) && r.etiquette === false && r.repris === false,
      nom + " — le brouillon d'un patient ne se propose pas chez un autre", JSON.stringify(r));
  }

  /* ── L'AXE N'EST PAS TOUJOURS LE PATIENT ──
     L'écran « modifier un modèle de document » ne dépend d'aucun
     dossier : son brouillon DOIT revenir quel que soit le patient d'où
     l'on vient. Son axe à lui est le MODÈLE — et sans cloisonnement, le
     brouillon du modèle A se proposait en modifiant le modèle B, mêmes
     identifiants de champs. Le défaut est le même, l'axe est autre. */
  console.log("");
  const axeModele = await pg.evaluate(async () => {
    const M = "MODELE-83";
    if (typeof DOC_MODELES === "undefined" || DOC_MODELES.length < 2) return { pasAssez: true };
    if (typeof sheetModeleEdit !== "function" || typeof _brCle === "undefined") return { pasDeMoteur: true };
    const pid = S.patients[0].id, a = DOC_MODELES[0].cle, b = DOC_MODELES[1].cle;
    S.brouillons = {}; closeSheet(true);
    await new Promise(r => setTimeout(r, 250));
    sheetModeleEdit(a, pid); await new Promise(r => setTimeout(r, 650));
    const c = document.getElementById("dc-nom");
    if (!c) return { pasDeChamp: true };
    c.value = M; c.dispatchEvent(new Event("input", { bubbles:true }));
    await new Promise(r => setTimeout(r, 1100));
    const cleA = _brCle;
    closeSheet(true); await new Promise(r => setTimeout(r, 300));
    sheetModeleEdit(b, pid); await new Promise(r => setTimeout(r, 700));
    const chezB = !!document.getElementById("br-reprendre");
    closeSheet(true); await new Promise(r => setTimeout(r, 250));
    /* …et il revient bien sur SON modèle. */
    sheetModeleEdit(a, pid); await new Promise(r => setTimeout(r, 700));
    const chezA = !!document.getElementById("br-reprendre");
    closeSheet(true);
    return { cleDifferente: cleA !== _brCle, chezB, chezA };
  });
  vrai(!axeModele.pasDeMoteur && !axeModele.pasAssez && !axeModele.pasDeChamp && axeModele.chezB === false,
    "le brouillon d'un modèle ne se propose pas en modifiant un autre", JSON.stringify(axeModele));
  vrai(!axeModele.pasDeMoteur && axeModele.chezA === true,
    "mais il revient bien sur son propre modèle", JSON.stringify(axeModele));

  /* ── Le ménage : au-delà d'une semaine, un brouillon ne vaut rien ── */
  /* ⚠️ UNE ÉPREUVE DOIT TOMBER, PAS PLANTER. Sur le `www/` de la version
     d'avant, `brouillonsPurger` n'existe pas : l'appel nu faisait sauter
     tout le processus, et la vérification en rouge ne disait plus rien
     des contrôles suivants. */
  const purge = await pg.evaluate(() => {
    if (typeof brouillonsPurger !== "function") return { absent: true };
    S.brouillons = {
      vieux: { at: Date.now() - 9 * 864e5, champs: { a: "x" } },
      frais: { at: Date.now(), champs: { a: "x" } }
    };
    try { brouillonsPurger(); } catch(e){ return { err: String(e).slice(0, 60) }; }
    return { restants: Object.keys(S.brouillons) };
  });
  vrai(!!purge.restants && !purge.restants.includes("vieux") && purge.restants.includes("frais"),
    "un brouillon de plus de 7 jours est jeté, le frais est gardé", JSON.stringify(purge));

  vrai(erreurs.length === 0, "aucune erreur JS pendant l'épreuve", erreurs.slice(0, 2).join(" | "));

  console.log("\n>>> " + ok + "/" + (ok + ko) + " vérifications\n");
  await nav.close(); srv.close();
  process.exit(ko ? 1 : 0);
})();
