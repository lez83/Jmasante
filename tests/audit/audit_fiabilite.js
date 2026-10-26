/* ============================================================
   AUDIT — LA FIABILITÉ : NE JAMAIS PERDRE UNE SAISIE
   ─────────────────────────────────────────────────────────
   ⚠️ CE QUI EST CHERCHÉ ICI N'EST PAS UN PLANTAGE, C'EST UN SILENCE :
   un écran qu'on quitte et qui n'avait rien à dire, une écriture en
   mémoire que personne n'a rangée, un enregistrement qui échoue sans que
   personne ne le sache. Un plantage se voit ; une saisie perdue, non.
============================================================ */
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "..", "www", "js");
const MODS = fs.readdirSync(DIR).filter(f => f.endsWith(".js") && f !== "app.js");
const SRC = {}; MODS.forEach(f => SRC[f.replace(".js","")] = fs.readFileSync(path.join(DIR,f), "utf8"));
const TOUT = Object.values(SRC).join("\n");
const ligneDe = (m,i) => SRC[m].slice(0,i).split("\n").length;
const R = {}; const note = (r,o) => { (R[r]=R[r]||[]).push(o); };

/* ── ① ÉCRANS DE SAISIE SANS GARDE DE SORTIE ──────────────────
   Un panneau qui contient des champs mais ne déclare pas `sheetGarder` :
   la flèche de retour le referme sans un mot, et ce qui était tapé part
   avec lui. C'est la perte la plus coûteuse — longue, silencieuse. */
Object.keys(SRC).forEach(mod => {
  const s = SRC[mod];
  const re = /function\s+(sheet[A-Z]\w*)\s*\(/g; let m;
  while ((m = re.exec(s))){
    const nom = m[1];
    /* Le corps : jusqu'à la prochaine fonction de même rang. */
    const suite = s.slice(m.index);
    const fin = suite.slice(1).search(/\n(?:async\s+)?function\s/);
    const corps = fin < 0 ? suite : suite.slice(0, fin + 1);
    const champs = (corps.match(/<(input|textarea|select)\b/g) || []).length;
    if (champs < 2) continue;                       // pas un écran de saisie
    if (/sheetGarder\s*\(/.test(corps)) continue;   // garde déclarée
    /* Un écran qui écrit à chaque frappe n'a rien à défendre. */
    const ecritAuFil = /\boninput\s*=|\bonchange\s*=|addEventListener\(\s*["']input/.test(corps)
                       && /\bsave\s*\(/.test(corps);
    note("① écran de saisie sans garde de sortie", {
      mod, ligne: ligneDe(mod, m.index), ecran: nom, champs,
      ecritAuFil: ecritAuFil ? "oui" : "NON"
    });
  }
});

/* ── ② MUTATION DE S SANS ENREGISTREMENT ─────────────────────
   `S.xxx = …` ou `S.patients.push(…)` sans `save()` dans les lignes qui
   suivent : la donnée vit en mémoire et meurt à la fermeture. */
Object.keys(SRC).forEach(mod => {
  const s = SRC[mod];
  const re = /\bS\.([a-zA-Z_]\w*)\s*(?:=[^=]|\.(?:push|splice|unshift|pop|shift)\s*\()/g;
  let m;
  while ((m = re.exec(s))){
    const cle = m[1];
    if (/^(curTour|curSlot|_|patients$)/.test(cle) && false) continue;
    const apres = s.slice(m.index, m.index + 600);
    if (/\bsave\s*\(|\bflushSave\s*\(|_doSave\s*\(/.test(apres)) continue;
    /* Beaucoup d'écritures sont des brouillons d'affichage rendus juste
       après : on ne garde que les clés qui portent des DONNÉES. */
    const DONNEES = /^(patients|tours|rappels|bilans|drafts|noVisit|annul|changeLog|sendLog|trash|slotMembers|slotsTours|orderBy|cabinets|modeles|dispositifs|phrases|identity|moi|seqPos|feuille|aides)/;
    if (!DONNEES.test(cle)) continue;
    note("② donnée écrite en mémoire sans enregistrement proche", {
      mod, ligne: ligneDe(mod, m.index), cle: "S." + cle,
      contexte: s.slice(Math.max(0,m.index-40), m.index+60).replace(/\s+/g," ").trim()
    });
  }
});

/* ── ③ `JSON.parse` : UN INVENTAIRE RELU, PAS UNE DEVINETTE ───
   Une donnée abîmée — import, synchro, reprise — et l'écran entier
   tombe. Reste à savoir lesquels sont déjà protégés.

   ⚠️ TROIS TENTATIVES AUTOMATIQUES ONT ÉCHOUÉ, et c'est pourquoi ce
   détecteur ne ressemble pas aux autres :
   ① Compter `try {` et `} catch` dans les 400 caractères précédents :
      un `} catch` d'une fonction d'avant annulait le `try` de la ligne
      juste au-dessus. storage.js était accusé à tort.
   ② Remonter les accolades jusqu'au bloc englobant : juste sur sept cas
      d'école, aveugle sur le vrai code. Cause mesurée — chaque module
      finit par le mot-clé `function` qui complète la 1ʳᵉ ligne du
      suivant, donc un module SEUL n'a pas ses accolades équilibrées.
   ③ Même marche sur le programme assemblé : les gabarits imbriqués
      (`${...` + `` ` `` + `...}`) débordent le blanchisseur, et les
      soldes repartent de -3 à +6.
   Écrire un analyseur lexical JS à la main pour DEUX occurrences dans
   tout le code n'a pas de sens. On inventorie donc, on relit à la main
   une fois, et le détecteur garde l'inventaire : toute occurrence
   nouvelle ou déplacée ressort pour être relue. Ce qu'il garde est
   vrai ; ce qu'il ne sait pas faire est écrit ici.

   Les commentaires sont blanchis (ils ne s'imbriquent pas en JS, c'est
   sûr) ; une occurrence citée dans une chaîne ressortira pour relecture,
   ce qui est le bon sens de l'erreur. */
/* La copie profonde relit ce qu'on vient d'écrire soi-même : elle ne
   peut pas échouer sur une donnée abîmée. Seul un objet circulaire ferait
   tomber le `stringify` d'avant — et ce serait un défaut ailleurs, pas
   ici. 20 des 28 occurrences du code sont de cette forme. */
const COPIE_PROFONDE = "JSON.parse(JSON.stringify(";
/* Les autres, relues une par une le 22/10/2026 (v1.29.0). */
const RELUS = [
  { mod:"init",    signe:"JSON.parse(txt)",             verdict:"protégé — catch, fichier ignoré" },
  { mod:"menage",  signe:"JSON.parse(txt)",             verdict:"protégé — catch, « Fichier illisible »" },
  { mod:"storage", signe:"JSON.parse(r.values[0].v)",   verdict:"protégé — catch sans paramètre, rend la valeur brute" },
  { mod:"storage", signe:"JSON.parse(new TextDecoder",  verdict:"protégé — catch, rend null" },
  { mod:"storage", signe:"JSON.parse(raw)",             verdict:"protégé ×2 — catch, « pas une sauvegarde valide »" },
  { mod:"sync",    signe:"JSON.parse(text)",            verdict:"protégé — catch, « fichier de synchro illisible »" },
  { mod:"sync",    signe:"JSON.parse(_unb64u(",         verdict:"protégé — catch, jeton rejeté" },
  { mod:"sync",    signe:"JSON.parse(buildSyncFile(",   verdict:"protégé en v1.29.0 — échec annoncé, partage interrompu" }
];
function sansCom(s){
  let o="", i=0, n=s.length; const esp=t=>t.replace(/[^\n]/g," ");
  while(i<n){
    const c=s[i], d=s[i+1];
    if(c==="/"&&d==="/"){ let j=s.indexOf("\n",i); if(j<0)j=n; o+=esp(s.slice(i,j)); i=j; continue; }
    if(c==="/"&&d==="*"){ let j=s.indexOf("*/",i+2); j=j<0?n:j+2; o+=esp(s.slice(i,j)); i=j; continue; }
    o+=c; i++;
  }
  return o;
}
Object.keys(SRC).forEach(mod => {
  const s = sansCom(SRC[mod]); const re = /JSON\.parse\s*\(/g; let m;
  while ((m = re.exec(s))){
    const extrait = s.slice(m.index, m.index + 70).replace(/\s+/g," ");
    if (extrait.indexOf(COPIE_PROFONDE) === 0) continue;
    const connu = RELUS.some(r => r.mod === mod && extrait.indexOf(r.signe) === 0);
    if (connu) continue;
    note("③ JSON.parse hors inventaire — à relire", { mod, ligne: ligneDe(mod, m.index),
      contexte: extrait.slice(0, 60) });
  }
});


/* ── ④ CONTENU PERDU EN SILENCE ──────────────────────────────
   ⚠️ CE DÉTECTEUR EN MÉLANGEAIT DEUX, ET LE MÉLANGE LE RENDAIT MUET :
   il comptait 30 alertes où 2 seulement faisaient perdre du travail.
   Noyées dans 28 bénignes, elles sont restées là des mois.

   Ce qui fait perdre du travail, c'est l'écriture d'un CONTENU dont
   l'échec n'est pas dit : `idbSet(...)` qui rate, et la pièce jointe
   n'existe nulle part. Ce détecteur-là doit rester à ZÉRO.

   Ce qui n'en fait pas perdre, et qui vit dans ⑥ : un EFFACEMENT qui
   rate (un orphelin coûte de la place, pas du travail) et un DRAPEAU
   D'AFFICHAGE qui rate (l'astuce se remontre demain). */
Object.keys(SRC).forEach(mod => {
  /* ⚠️ SANS COMMENTAIRES. Le détecteur signalait sa PROPRE documentation :
     le défaut corrigé est cité mot pour mot dans le commentaire qui
     l'explique, et il se comptait lui-même. Déjà rencontré au détecteur
     ① de l'audit des gestes. */
  const s = sansCom(SRC[mod]);
  const re = /idbSet\s*\([^)]*\)\s*\.catch\s*\(\s*\(?\s*\w*\s*\)?\s*=>\s*\{\s*\}/g;
  let m;
  while ((m = re.exec(s)))
    note("④ contenu écrit en base dont l'échec est avalé", {
      mod, ligne: ligneDe(mod, m.index),
      contexte: m[0].replace(/\s+/g," ").slice(0, 70) });
  /* Un `try { idbSet(...) } catch {}` ne garde rien non plus : `idbSet`
     rend une promesse, et le bloc est déjà sorti quand le refus arrive.
     C'était le cas de sync.js — un document reçu, une ligne au dossier,
     et rien derrière. */
  const re3 = /try\s*\{[^{}]*idbSet\s*\([^;]*;?\s*\}\s*catch/g;
  while ((m = re3.exec(s)))
    note("④ contenu écrit en base dont l'échec est avalé", {
      mod, ligne: ligneDe(mod, m.index),
      contexte: "try/catch autour d'un idbSet : n'attrape rien (promesse)" });
});

/* ── ⑥ ÉCHEC AVALÉ SANS PERTE DE TRAVAIL — INVENTAIRE ────────
   Relus le 22/10/2026. On ne les corrige pas : un effacement raté
   coûte de la place, un drapeau raté remontre une astuce. Mais on
   compte, par module : si un module en gagne un, il ressort — c'est
   peut-être une écriture de contenu déguisée. */
/* pwa passe de 3 à 4 en v1.32.0 : l'enregistrement du drapeau
   `S.stockageDurable`, qui ne porte qu'un affichage. Le compteur l'a
   signalé comme NOUVEAU — c'est exactement son travail, et la relecture
   conclut qu'il est bénin. */
const AVALES_RELUS = { dossier:1, features:3, init:5, plaies:1, pwa:4, share:1,
  sheets:2, storage:1, sync:3, ui:2, uikit:4, vocal:3 };
{
  const vus = {};
  Object.keys(SRC).forEach(mod => {
    const s = sansCom(SRC[mod]); let n = 0, m;
    const re = /(idbDel|idbGet)\s*\([^)]*\)\s*\.catch\s*\(\s*\(?\s*\w*\s*\)?\s*=>\s*\{\s*\}/g;
    while ((m = re.exec(s))) n++;
    const re2 = /catch\s*\(?\s*\w*\s*\)?\s*\{\s*\}/g;
    while ((m = re2.exec(s))){
      const avant = s.slice(Math.max(0, m.index - 200), m.index);
      if (/idbDel|save\s*\(/.test(avant)) n++;
    }
    if (n) vus[mod] = n;
  });
  Object.keys(vus).forEach(mod => {
    const relu = AVALES_RELUS[mod] || 0;
    if (vus[mod] > relu)
      note("⑥ échec avalé NOUVEAU — à relire", { mod, ligne: 0,
        contexte: vus[mod] + " trouvés, " + relu + " relus" });
  });
  Object.keys(AVALES_RELUS).forEach(mod => {
    if ((vus[mod] || 0) < AVALES_RELUS[mod])
      note("⑥ échec avalé corrigé — mettre l'inventaire à jour", { mod, ligne: 0,
        contexte: (vus[mod] || 0) + " restants, " + AVALES_RELUS[mod] + " à l'inventaire" });
  });
}

/* ── ⑦ UN PANNEAU LIÉ À UN DOSSIER QUI NE LE DIT PAS ─────────
   ⚠️ LE DÉFAUT QU'IL GARDE ÉTAIT ENTIER ET INVISIBLE : les
   identifiants de champs sont les mêmes pour tous les patients
   (`or-nom`, `f-nom`…), donc l'empreinte d'écran du brouillon l'était
   aussi. Le brouillon commencé chez un patient se proposait chez un
   autre, avec son nom et sa date de naissance. Les NEUF écrans
   concernés laissaient passer, et le mécanisme prévu pour l'empêcher
   (`sheetBrouillonPour`) n'était appelé par personne.

   Ce détecteur existe pour le DIXIÈME écran, celui qui sera écrit
   demain : un panneau qui va chercher un patient (`getP(`) et ouvre un
   gabarit doit y poser `brDossier(...)`. Sinon son brouillon retombe
   dans le casier commun. */
Object.keys(SRC).forEach(mod => {
  const s = sansCom(SRC[mod]);
  const re = /\nfunction (sheet[A-Za-z0-9_$]*)\s*\(([^)]*)\)/g;
  let m;
  while ((m = re.exec(s))){
    const nom = m[1], deb = m.index + 1;
    const suiv = s.slice(deb + 10).search(/\nfunction [A-Za-z_$]/);
    const corps = s.slice(deb, suiv < 0 ? s.length : deb + 10 + suiv);
    if (!/openSheet\s*\(\s*`/.test(corps)) continue;     // pas un panneau
    /* Un `getP(` sans paramètre de dossier est incidentel : le panneau
       va chercher le patient courant, il n'en reçoit pas un. */
    if (!/\bp?id\b|\bpid\b|\bcle\b/.test(m[2])) continue;
    if (!/getP\s*\(|pById\s*\(/.test(corps)) continue;    // pas lié à un dossier
    /* ⚠️ UN PANNEAU SANS CHAMP NE PEUT PAS PRODUIRE DE BROUILLON : le
       moteur n'ouvre un casier que s'il trouve au moins un champ à
       nommer. Sans ce filtre le détecteur signalait 24 panneaux dont la
       plupart ne font que LIRE un dossier — du bruit qui aurait fini
       par faire ignorer les vrais. */
    if (!/<\s*(input|textarea|select)\b/.test(corps)) continue;
    if (/brDossier\s*\(|sheetBrouillonPour\s*\(/.test(corps)) continue;
    note("⑦ panneau lié à un dossier sans cloisonnement du brouillon", {
      mod, ligne: ligneDe(mod, deb),
      contexte: nom + "(" + m[2].trim().slice(0, 40) + ")" });
  }
});

/* ── ⑤ BROUILLON : QUELS FORMULAIRES SONT COUVERTS ───────────
   La saisie gardée est le filet le plus précieux de l'app. On regarde
   quels écrans savent la poser. */
const posent = new Set(), lisent = new Set();
Object.keys(SRC).forEach(mod => {
  if (/_saveDraft\s*\(|S\.drafts\s*\[/.test(SRC[mod])) posent.add(mod);
  if (/oublierBrouillon|_formDraft/.test(SRC[mod])) lisent.add(mod);
});
note("⑤ le filet « saisie gardée »", {
  posent: [...posent].join(" · ") || "aucun",
  lisent: [...lisent].join(" · ") || "aucun" });

/* ── SORTIE ───────────────────────────────────────────────── */
Object.keys(R).sort().forEach(rub => {
  console.log("\n═══ " + rub.toUpperCase() + " — " + R[rub].length + " ═══");
  R[rub].slice(0, 30).forEach(o =>
    console.log("   " + Object.entries(o).map(([k,v]) => k+"="+v).join("  ")));
  if (R[rub].length > 30) console.log("   … et " + (R[rub].length-30) + " de plus");
});
console.log("\n──────────────────────────────────────────");
Object.keys(R).sort().forEach(r => console.log("  " + String(R[r].length).padStart(4) + "  " + r));
