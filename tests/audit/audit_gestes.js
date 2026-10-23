/* ============================================================
   AUDIT — LES GESTES : BOUTONS, ATTRIBUTS, GESTIONNAIRES
   ─────────────────────────────────────────────────────────
   ⚠️ CE QUI SE CHERCHE ICI NE SE VOIT PAS DANS LE DOM. Le défaut de la
   v1.28.1 — un `<button>` dans un `<button>` — était invisible à
   `querySelectorAll` : l'analyseur du navigateur referme le bouton
   extérieur AVANT que l'épreuve ne regarde. On lit donc LA SOURCE.

   ⚠️ UN DÉTECTEUR SIGNALE, IL NE CONDAMNE PAS. Chaque trouvaille doit
   être confirmée à l'écran avant d'être appelée un défaut.
============================================================ */
const fs = require("fs"), path = require("path");
const DIR = path.join(__dirname, "..", "..", "www", "js");
const ORDRE = ['globals','uikit','storage','seed','ui','sheets','nav','engine','share','fiche','dlu',
 'feuilles','menage','traitement','tendances','dossier','vocal','recueil','docs','plaies','dictate',
 'features','seq','cabinet','guide','guide26','modeles','dispositifs','calculs','bilans','bilans_fiches',
 'medicaments_base','medicaments','narratif','notes','alertes','detente','eggs','essais','sync','pwa','init'];

/* ⚠️ LES DÉTECTEURS DE CODE NE DOIVENT PAS LIRE LA PROSE. Premier jet :
   508 « fonctions introuvables », dont « Docs », « involontaire »,
   « Hypothermie » — des mots de commentaires français suivis d'une
   parenthèse. Ce dépôt est très commenté : sans neutralisation, le
   détecteur n'est que du bruit.
   ⚠️ ON REMPLACE PAR DES ESPACES, on ne supprime pas : les numéros de
   ligne doivent rester justes pour que la trouvaille soit trouvable. */
function codeSeul(src){
  const out = src.split("");
  let i = 0, n = src.length;
  const blanchir = (a, b) => { for (let k = a; k < b && k < n; k++)
    if (out[k] !== "\n") out[k] = " "; };
  while (i < n){
    const c = src[i], d = src[i+1];
    if (c === "/" && d === "*"){ const j = src.indexOf("*/", i+2);
      blanchir(i, j < 0 ? n : j+2); i = (j < 0 ? n : j+2); continue; }
    if (c === "/" && d === "/"){ const j = src.indexOf("\n", i);
      blanchir(i, j < 0 ? n : j); i = (j < 0 ? n : j); continue; }
    if (c === '"' || c === "'" || c === "`"){
      let j = i + 1;
      while (j < n){
        if (src[j] === "\\"){ j += 2; continue; }
        if (src[j] === c) break;
        /* Dans un gabarit, `${…}` est du CODE : on le laisse lisible. */
        if (c === "`" && src[j] === "$" && src[j+1] === "{"){
          let prof = 1, k = j + 2;
          while (k < n && prof){ if (src[k] === "{") prof++;
            else if (src[k] === "}") prof--; k++; }
          blanchir(i + 1, j);          // le texte avant l'expression
          i = j; j = k;                // on saute l'expression, gardée
          continue;
        }
        j++;
      }
      blanchir(i + 1, j); i = (j < n ? j + 1 : n); continue;
    }
    i++;
  }
  return out.join("");
}

const SRC = {};                       // module → source
ORDRE.forEach(m => { const f = path.join(DIR, m + ".js");
  if (fs.existsSync(f)) SRC[m] = fs.readFileSync(f, "utf8"); });
const TOUT = Object.values(SRC).join("\n");
/* Version sans prose ni littéraux, pour les détecteurs de CODE (④⑤⑥). */
const CODE = {}; Object.keys(SRC).forEach(m => CODE[m] = codeSeul(SRC[m]));
const TOUT_CODE = Object.values(CODE).join("\n");
/* ⚠️ ET UNE VERSION SANS COMMENTAIRES MAIS AVEC LES CHAÎNES, pour les
   détecteurs de BALISAGE (①②③) : le HTML vit dans des gabarits, on ne
   peut pas les blanchir. Sans ça, ① accusait le commentaire qui DÉCRIT
   le défaut réparé en v1.28.1 — un détecteur qui signale sa propre
   documentation. */
function sansCommentaires(src){
  const out = src.split(""); let i = 0; const n = src.length;
  const blanchir = (a,b)=>{ for (let k=a;k<b&&k<n;k++) if (out[k] !== "\n") out[k]=" "; };
  while (i < n){
    const c = src[i], d = src[i+1];
    if (c === "/" && d === "*"){ const j = src.indexOf("*/", i+2);
      blanchir(i, j<0?n:j+2); i = (j<0?n:j+2); continue; }
    if (c === "/" && d === "/"){ const j = src.indexOf("\n", i);
      blanchir(i, j<0?n:j); i = (j<0?n:j); continue; }
    if (c === '"' || c === "'" || c === "`"){            // on saute la chaîne entière
      let j = i+1; while (j < n){ if (src[j]==="\\"){ j+=2; continue; }
        if (src[j]===c) break; j++; }
      i = (j<n?j+1:n); continue; }
    i++;
  }
  return out.join("");
}
const BAL = {}; Object.keys(SRC).forEach(m => BAL[m] = sansCommentaires(SRC[m]));

const ligneDe = (mod, idx) => SRC[mod].slice(0, idx).split("\n").length;
const R = {};                         // rubrique → trouvailles
const note = (rub, o) => { (R[rub] = R[rub] || []).push(o); };

/* ── ① ÉLÉMENTS INTERACTIFS IMBRIQUÉS ─────────────────────────
   On suit l'ouverture d'un `<button` dans un gabarit et on regarde si un
   autre élément interactif apparaît avant son `</button>`. Les gabarits
   sont des chaînes JS : on travaille au texte, sans analyser le HTML. */
const INTERACTIF = /<(button|a\s[^>]*href|input|select|textarea)\b/gi;
Object.keys(SRC).forEach(mod => {
  const s = BAL[mod];
  const re = /<button\b/gi; let m;
  while ((m = re.exec(s))){
    const fin = s.indexOf("</button>", m.index);
    if (fin < 0) continue;
    const bloc = s.slice(m.index + 7, fin);
    INTERACTIF.lastIndex = 0;
    let n;
    while ((n = INTERACTIF.exec(bloc))){
      /* Un `</button>` plus proche voudrait dire qu'on a quitté le
         premier bouton : on ne garde que ce qui est VRAIMENT dedans. */
      if (bloc.slice(0, n.index).includes("</button>")) break;
      note("① élément interactif imbriqué dans un bouton", {
        mod, ligne: ligneDe(mod, m.index + 7 + n.index),
        quoi: bloc.slice(n.index, n.index + 70).replace(/\s+/g, " ")
      });
    }
  }
});

/* ── ② `data-xxx` ÉMIS MAIS JAMAIS ÉCOUTÉ ─────────────────────
   Un attribut posé dans un gabarit sans aucun `[data-xxx]` ailleurs : le
   bouton existe, il a l'air cliquable, et rien ne l'écoute. C'est le
   défaut de la v1.27.1, vu d'un autre angle. */
const emis = {}, ecoutes = new Set();
Object.keys(SRC).forEach(mod => {
  let m;
  const reE = /\sdata-([a-z0-9-]+)\s*=/gi;
  while ((m = reE.exec(SRC[mod]))){
    const k = m[1].toLowerCase();
    (emis[k] = emis[k] || []).push({ mod, ligne: ligneDe(mod, m.index) });
  }
});
{ let m;
  const reL = /\[data-([a-z0-9-]+)[\]=]/gi;
  while ((m = reL.exec(TOUT))) ecoutes.add(m[1].toLowerCase());
  /* `dataset.xxx` compte aussi comme une écoute. */
  const reD = /\.dataset\.([a-zA-Z0-9_]+)/g;
  while ((m = reD.exec(TOUT))){
    const k = m[1].replace(/[A-Z]/g, c => "-" + c.toLowerCase()).toLowerCase();
    ecoutes.add(k);
  }
  /* ⚠️ ET LE NOM D'ATTRIBUT PASSÉ EN CHAÎNE : `qEl(f, "data-raps")`,
     `getAttribute("data-x")`, `removeAttribute(…)`. Sans ça, le
     détecteur déclarait morts les cinq boutons d'outils de la fiche —
     Docs, Bilans, Rappels, J-1, Historique — qui répondent très bien. */
  const reS = /["'`](data-[a-z0-9-]+)["'`]/gi;
  while ((m = reS.exec(TOUT))) ecoutes.add(m[1].slice(5).toLowerCase());
}
/* Attributs HTML standards ou purement décoratifs : hors sujet. */
const DECOR = new Set(["app-theme","cards","moniteur","scene","fili","bs-theme","toggle-target"]);
/* ⚠️ CE QUI FAIT MAL, C'EST UN ÉLÉMENT QUI INVITE AU GESTE. Un `data-*`
   posé sur un `<div>` pour le repérer n'a jamais promis de répondre ;
   un `<button>` qui n'écoute personne, si — c'est le défaut de la
   disquette (v1.30.0) et celui du bouton de la vue Liste (v1.27.1).
   Les trois alertes restantes étaient toutes des `<div>` : `data-gpart`
   sur les sections du guide (lues par leur classe), `data-catbox` sur un
   bloc repliable, `data-vn` sur une carte de note vocale. Du bruit qui
   aurait fini par faire ignorer le jour où un bouton tombe dedans. */
const surBouton = {};
Object.keys(BAL).forEach(mod => {
  let m; const re = /<\s*(button|a)\b[^>]*?\bdata-([a-z0-9-]+)\s*=/gi;
  while ((m = re.exec(BAL[mod]))) surBouton[m[2].toLowerCase()] = true;
});
Object.keys(emis).forEach(k => {
  if (ecoutes.has(k) || DECOR.has(k)) return;
  if (!surBouton[k]) return;          // posé sur un div : il ne promet rien
  note("② data-* posé mais jamais écouté", {
    cle: "data-" + k, n: emis[k].length,
    ou: emis[k].slice(0, 3).map(x => x.mod + ":" + x.ligne).join(" · ")
  });
});


/* Relus le 23/10/2026. Tous gardés par un `if (x)`, donc aucun plantage :
   le gestionnaire ne se pose simplement jamais. Onze sont des restes de
   l'ancienne barre de panneau, remplacée par `navHeader` et ses
   `nav-back` / `nav-home`. Les cinq autres sont nommés pour ce qu'ils
   coûtent. On ne les supprime pas — retirer du code dans ce projet a
   cassé la compilation deux fois dans l'après-midi, le module se
   terminant par le mot-clé `function` qui complète le suivant — mais le
   compteur ne signale plus qu'un identifiant NOUVEAU. */
const IDS_RELUS = {
  "guide-close":"reste de l'ancienne barre", "php-close":"reste", "ph-back":"reste",
  "sl-back":"reste", "cat-back":"reste", "rp-close":"reste", "gal-back":"reste",
  "srch-close":"reste", "bt-close":"reste", "gcl":"reste — fermeture d'un aperçu",
  "f-ordo":"reste — le bouton d'ordonnance de la fiche a été renommé",
  "go-couleurs":"reste — les couleurs s'atteignent par Personnaliser",
  "rc-dob":"reste — la date de naissance du recueil vient de la fiche",
  "aides-reset":"PERDU — plus aucun moyen de faire réapparaître les bulles d'aide masquées"
};
/* ── ③ `#id` RÉFÉRENCÉ MAIS JAMAIS PRODUIT ───────────────────
   `$("#x").onclick = …` sur un identifiant qu'aucun gabarit n'écrit :
   au mieux une garde qui ne sert jamais, au pire un plantage. */
const idsProduits = new Set();
{ let m; const re = /\sid\s*=\s*["'`]([a-zA-Z0-9_-]+)/g;
  while ((m = re.exec(TOUT))) idsProduits.add(m[1]);
  const re2 = /\sid\s*=\s*["'`]\$\{/g;          // id calculé : on ne sait pas
  if (re2.test(TOUT)) idsProduits.add("__calcules__");
}
const idsHtml = new Set();
{ const f = path.join(DIR, "..", "index.html");
  if (fs.existsSync(f)){ let m; const re = /\sid\s*=\s*["']([a-zA-Z0-9_-]+)/g;
    const h = fs.readFileSync(f, "utf8");
    while ((m = re.exec(h))) idsHtml.add(m[1]); } }
Object.keys(SRC).forEach(mod => {
  let m; const re = /\$\(\s*["'`]#([a-zA-Z0-9_-]+)["'`]\s*\)/g;
  while ((m = re.exec(BAL[mod]))){
    const id = m[1];
    if (idsProduits.has(id) || idsHtml.has(id)) continue;
    if (IDS_RELUS[id]) continue;
    note("③ #id NOUVEAU consulté mais jamais écrit", { mod, ligne: ligneDe(mod, m.index), id });
  }
});


/* L'inventaire des fonctions mortes relues. Trois familles :
   « reste » = vestige sans danger · « gardée » = volontairement
   disponible · « à rebrancher » = elle marche, personne ne l'atteint. */
const MORTES_RELUES = {
  uiListRow:"reste — ancien composant de liste", uiActions:"reste", uiCat:"reste",
  importBackup:"reste — doublon de importBackupText, qui est le chemin vivant",
  sheetSlots:"reste — alias d'un écran renommé", sheetTheme:"reste — alias",
  sheetBackup:"reste — alias", sheetSecurity:"reste — alias", sheetNewRappel:"reste — alias",
  navPush:"gardée — API de la pile de navigation",
  normesDefaut:"gardée — un commentaire dit qu'elle reste disponible pour recopie",
  textToDocx:"reste — remplacé par la génération .docx actuelle",
  formeLbl:"reste", ouvrirCatAutonomie:"reste", seqPatient:"reste",
  plaieToutesZones:"reste", plaieVueDe:"reste", docPlaieOuverte:"reste", plaieTexteReleve:"reste",
  sheetWelcome:"reste — remplacé par renderWelcomeInline au premier lancement",
  contactsPourPatient:"reste", dispoFamilles:"reste", calcNomsResultats:"reste",
  jeunResume:"reste", medTotalBase:"reste",
  /* Les trois « à rebrancher » l'ont été en v1.31.0 : elles ne sont plus
     mortes, donc plus signalées, et leur ligne ici n'a plus lieu d'être.
     On la retire — un inventaire qui garde des noms périmés redevient du
     bruit, et c'est le bruit qu'on vient de chasser. */
};

/* ── ④ FONCTIONS DÉFINIES ET JAMAIS APPELÉES ─────────────────── */
/* ⚠️ RECENSER TOUTES LES FORMES DE DÉFINITION, SINON LE DÉTECTEUR CRIE
   AU LOUP. Premier jet : `^function nom` ancré en début de ligne — il
   manquait les fonctions imbriquées (indentées), les `const nom = …`,
   les flèches et les méthodes d'objet. Résultat : 532 « introuvables »
   dont la quasi-totalité existaient. Un détecteur qui se trompe cinq
   cents fois ne sera plus jamais lu. */
const defs = {}, defsAutres = new Set();
Object.keys(SRC).forEach(mod => {
  let m;
  const re = /(?:^|[^.\w$])(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(CODE[mod]))) if (!defs[m[1]]) defs[m[1]] = { mod, ligne: ligneDe(mod, m.index) };
});
{ let m;
  /* const/let/var nom = … (flèche, function, ou valeur quelconque) */
  const re = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g;
  while ((m = re.exec(TOUT_CODE))) defsAutres.add(m[1]);
  /* nom: function  ·  nom(…){ dans un objet  ·  nom = (…) => */
  const re2 = /([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?(?:function|\()/g;
  while ((m = re2.exec(TOUT_CODE))) defsAutres.add(m[1]);
  const re3 = /([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)/g;
  while ((m = re3.exec(TOUT_CODE))) defsAutres.add(m[1]);
  /* ⚠️ Méthode abrégée d'objet — `debitGouttes(){ … }`. Sa DÉFINITION
     ressemble à un appel : sans ça, le détecteur accusait d'absence des
     fonctions écrites deux lignes plus haut. */
  const re3b = /(?:^|[,{]\s*)([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;
  while ((m = re3b.exec(TOUT_CODE))) defsAutres.add(m[1]);
  /* paramètres de fonction : un rappel passé en argument est défini ailleurs */
  const re4 = /function\s*[A-Za-z_$\w]*\s*\(([^)]*)\)/g;
  while ((m = re4.exec(TOUT_CODE)))
    m[1].split(",").forEach(p => { const n=p.trim().split(/[=\s]/)[0]; if (n) defsAutres.add(n); });
  const re5 = /\(([^)]*)\)\s*=>/g;
  while ((m = re5.exec(TOUT_CODE)))
    m[1].split(",").forEach(p => { const n=p.trim().split(/[=\s]/)[0]; if (n) defsAutres.add(n); });
}
Object.keys(defs).forEach(nom => {
  /* On compte les mentions hors sa propre définition. */
  /* ⚠️ COMPTER DANS LA VERSION SANS COMMENTAIRES, PAS SANS CHAÎNES.
     L'essentiel des appels de ce dépôt vit DANS des gabarits — uiRow,
     navHeader, vitalTilesHtml, filigraneCss. Comptés sur le code nu,
     ils passaient tous pour morts : 82 fausses alertes, dont les briques
     les plus utilisées de l'interface. */
  const re = new RegExp("\\b" + nom.replace(/\$/g, "\\$") + "\\b", "g");
  const n = Object.values(BAL).join("\n").match(re);
  const nn = n ? n.length : 0;
  if (nn > 1) return;
  /* ⚠️ UNE FONCTION AUTO-APPELÉE N'EST PAS MORTE. Le journal d'erreurs
     et le branchement des alertes sont écrits ainsi — une parenthèse
     ouvrante avant le mot-clé, un appel juste après l'accolade. Signalés
     comme morts, ils auraient envoyé chercher un défaut là où il n'y en
     a pas, et fait douter du reste de la liste. */
  const d = defs[nom];
  const avant = BAL[d.mod].slice(Math.max(0, SRC[d.mod].split("\n").slice(0, d.ligne-1).join("\n").length - 4), 
                                SRC[d.mod].split("\n").slice(0, d.ligne-1).join("\n").length + 40);
  if (/\(\s*(?:async\s+)?function\s/.test(avant)) return;
  /* ⚠️ RELUES UNE PAR UNE LE 23/10/2026 — et PAS SUPPRIMÉES, après deux
     tentatives qui ont cassé la compilation. La raison est propre à ce
     projet : chaque module se termine par le mot-clé `function` qui
     complète la 1ʳᵉ ligne du suivant, donc retirer la dernière fonction
     d'un fichier emporte ce mot-clé. Et la découpe « jusqu'à la ligne
     qui ne contient qu'une accolade fermante » se trompe dès qu'un
     gabarit en contient une : `sheetWelcome` (112 lignes) s'est fait
     couper à 32, laissant son corps sans sa tête — et la compilation
     passait quand même.
     184 lignes sur 34 000 ne valent pas ce risque. Ce qui valait le
     chantier, c'est que le compteur redevienne parlant : il ne signale
     désormais que les NOUVELLES, celles qui n'ont pas été relues. La
     mort de `sheetBrouillonPour` cachait une fuite entre dossiers —
     c'est cette alerte-là qu'il faut pouvoir lire. */
  if (MORTES_RELUES[nom]) return;
  note("④ fonction morte NOUVELLE — à relire", { nom, ...d });
});
/* Si une relue reprend du service ou disparaît, l'inventaire ment : on le dit. */
Object.keys(MORTES_RELUES).forEach(nom => {
  if (!defs[nom]) note("④ inventaire périmé — fonction absente du code", { nom, mod:"—", ligne:0,
    contexte: MORTES_RELUES[nom] });
});

/* ── ⑤ FONCTIONS APPELÉES ET JAMAIS DÉFINIES ─────────────────
   Le plantage certain. On écarte tout ce qui vient du navigateur, des
   librairies chargées à la demande, et les méthodes d'objets. */
const CONNUES = new Set(["require","eval","parseInt","parseFloat","isNaN","isFinite","encodeURIComponent",
 "decodeURIComponent","setTimeout","setInterval","clearTimeout","clearInterval","fetch","alert","confirm",
 "prompt","Number","String","Boolean","Array","Object","Date","Math","JSON","Promise","Map","Set","WeakMap",
 "RegExp","Error","Symbol","Proxy","Reflect","BigInt","Intl","URL","Blob","File","FileReader","FormData",
 "Image","Audio","Worker","TextEncoder","TextDecoder","AbortController","Uint8Array","Uint16Array",
 "Uint32Array","Int8Array","Float32Array","Float64Array","ArrayBuffer","DataView","atob","btoa",
 "structuredClone","queueMicrotask","requestAnimationFrame","cancelAnimationFrame","getComputedStyle",
 "matchMedia","scrollTo","scrollBy","open","close","print","focus","blur","if","for","while","switch",
 "catch","return","typeof","function","new","delete","void","await","async","Capacitor","jsQR","qrcode",
 "QRCode","ExcelJS","jspdf","pdfjsLib","CSS","customElements","IntersectionObserver","MutationObserver",
 "ResizeObserver","PerformanceObserver","Notification","speechSynthesis","SpeechSynthesisUtterance",
 "webkitSpeechRecognition","SpeechRecognition","MediaRecorder","indexedDB","localStorage","sessionStorage",
 "crypto","navigator","document","window","console","history","location","screen","performance","caches"]);
/* ⚠️ NEUF ALERTES, NEUF FAUSSES — relevé le 23/10/2026, et c'est pire
   qu'inutile : un détecteur qui se trompe neuf fois sur neuf n'est plus
   lu, et c'est ainsi qu'une vraie se cache. Les causes, une par une :
   `Event` (un `new Event(…)`), `jsPDF` (une bibliothèque externe),
   `of` et `else` (des mots-clés attrapés par la parenthèse qui suit),
   `resolve` (le paramètre d'un `new Promise(resolve => …)`),
   `_fini` (déclaré par `let _fini;` puis assigné dans une promesse),
   `u26A0` et `JMS1` (des morceaux d'échappement et de motif que le
   blanchiment n'avait pas couverts), `cm` (une unité dans un gabarit).
   On reconnaît donc aussi : les déclarations sans valeur, les
   paramètres, et quelques globales de plus. */
{ let m;
  /* let/var nom;  —  déclaré ici, assigné ailleurs */
  const reDecl = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[;,\n]/g;
  while ((m = reDecl.exec(TOUT_CODE))) defsAutres.add(m[1]);
  /* les paramètres : function nom(a, b) et (a, b) => */
  const reP = /(?:function\s*[A-Za-z_$\w$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>)/g;
  while ((m = reP.exec(TOUT_CODE))){
    (m[1] || m[2] || "").split(",").forEach(x => {
      const n = x.trim().replace(/[=.].*$/, "").replace(/[{}\[\]\s]/g, "");
      if (/^[A-Za-z_$][\w$]*$/.test(n)) defsAutres.add(n);
    });
  }
  /* un paramètre unique sans parenthèses : x => … */
  const reP1 = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*=>/g;
  while ((m = reP1.exec(TOUT_CODE))) defsAutres.add(m[2]);
}
["of","in","else","do","try","finally","case","yield","jsPDF","docx","Chart","L","io",
 "require","module","exports","process","Buffer","global",
 "Event","CustomEvent","Blob","File","FileReader","FormData","Image","Audio","Worker",
 "AbortController","TextEncoder","TextDecoder","Intl"].forEach(x => CONNUES.add(x));
/* ⚠️ `cm` vient d'un MOTIF, pas d'un appel : `/([\d.,]+)\s*cm(?:\s*×…` —
   la parenthèse qui suit le fait passer pour une fonction. Blanchir les
   littéraux de motif serait le vrai correctif, mais le blanchisseur de
   ce projet butte déjà sur les gabarits imbriqués, et le rendre plus
   gourmand ferait plus de dégâts que ce seul faux positif. On le nomme. */
const APPELS_RELUS = { cm: "motif /…cm(?:…)/ dans plaies.js, pas un appel" };

const appels = {};
Object.keys(SRC).forEach(mod => {
  let m; const re = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
  while ((m = re.exec(CODE[mod]))){
    const nom = m[2];
    if (CONNUES.has(nom) || defs[nom] || defsAutres.has(nom)) continue;
    /* Un reste d'échappement (`\u26A0`) ou de motif n'est pas un appel. */
    if (/^u[0-9A-Fa-f]{4}$/.test(nom) || /^[A-Z]+\d+$/.test(nom)) continue;
    (appels[nom] = appels[nom] || []).push({ mod, ligne: ligneDe(mod, m.index) });
  }
});
Object.keys(appels).forEach(nom => {
  if (APPELS_RELUS[nom]) return;
  note("⑤ appelée mais introuvable", { nom, n: appels[nom].length,
    ou: appels[nom].slice(0, 3).map(x => x.mod + ":" + x.ligne).join(" · ") });
});

/* ── ⑥ `async` APPELÉE SANS `await` ──────────────────────────
   Le défaut déjà rencontré sur `commitVisit` : sans `await`, l'écran se
   ferme avant que l'enregistrement n'ait eu lieu. */
const asyncs = new Set();
{ let m; const re = /\basync\s+function\s+([A-Za-z_$][\w$]*)/g;
  while ((m = re.exec(TOUT_CODE))) asyncs.add(m[1]);
  const re2 = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*async\b/g;
  while ((m = re2.exec(TOUT_CODE))) asyncs.add(m[1]);
}
Object.keys(SRC).forEach(mod => {
  asyncs.forEach(nom => {
    const re = new RegExp("(^|[^.\\w$])(" + nom.replace(/\$/g,"\\$") + ")\\s*\\(", "g");
    let m;
    while ((m = re.exec(CODE[mod]))){
      /* ⚠️ ON NE GARDE QUE LES APPELS DONT LE RÉSULTAT EST JETÉ. Un
         `await f()`, un `return f()`, un `x = f()`, un `f().then(…)` ou
         un passage en argument gèrent tous la promesse — les signaler
         noyait les vrais oublis sous 188 lignes. Reste le cas qui fait
         mal : l'appel posé comme une instruction, suivi d'un `;`, dont
         personne n'attend la fin. */
      const avant = CODE[mod].slice(Math.max(0, m.index - 70), m.index + m[1].length);
      const apres = CODE[mod].slice(m.index, m.index + 400);
      if (/\b(await|return|=|\.then|yield|typeof|&&|\|\||\?)\s*$/.test(avant)) continue;
      if (/function\s+$/.test(avant)) continue;
      if (/[(,[:]\s*$/.test(avant)) continue;            // passée en argument
      if (/\b(if|while|for|switch)\s*\($/.test(avant)) continue;
      /* L'appel se referme-t-il sur un `;` ou une fin de ligne ? */
      let prof = 0, i = apres.indexOf("("), fin = -1;
      for (let j = i; j < apres.length && j < 350; j++){
        if (apres[j] === "(") prof++;
        else if (apres[j] === ")"){ prof--; if (!prof){ fin = j; break; } }
      }
      if (fin < 0) continue;
      /* ⚠️ UN CHAÎNAGE ÉCRIT À LA LIGNE RESTE UN CHAÎNAGE. Le test
         s'arrêtait au premier `\n` et déclarait « jeté » un
         `idbSet(…)` suivi d'un `.then(…).catch(…)` sur la ligne
         suivante — c'est-à-dire le correctif de la v1.29.0 qui avait
         justement sauvé les pièces jointes. Le détecteur accusait ce
         qu'il aurait dû approuver. */
      const suite = apres.slice(fin + 1, fin + 60);
      if (/^\s*\.\s*(then|catch|finally)\b/.test(suite)) continue;   // la suite est gardée
      if (!/^\s*[;}\n]/.test(suite)) continue;           // chaîné, pas jeté
      /* ⚠️ « TIRE ET OUBLIE » N'EST PAS UN DÉFAUT. Ouvrir un écran depuis
         un `onclick` sans attendre la fin est le geste normal : personne
         n'attend qu'un panneau soit ouvert pour continuer. Ce qui fait
         mal, c'est l'appel SUIVI D'AUTRE CHOSE — `commitVisit(); closeSheet();`
         ferme avant que l'enregistrement n'ait eu lieu. On ne garde donc
         que les appels qui ont une suite dans leur bloc. */
      /* ⚠️ LA SUITE DU BLOC ENGLOBANT N'EST PAS LA SUITE DE L'APPEL.
         `onclick = () => shareText(…)` n'a AUCUNE suite : la fonction
         fléchée se termine là. Le détecteur lisait l'instruction
         suivante du bloc d'autour et criait au défaut sur six partages,
         la garde de sortie et le déverrouillage par empreinte — tous
         corrects. Deux formes à reconnaître : le corps d'une fléchée
         sans accolades, et l'appel immédiatement suivi d'un `return`,
         où l'appelant s'arrête précisément pour laisser faire. */
      if (/=>\s*$/.test(avant)) continue;                 // corps d'une fléchée
      const reste = apres.slice(fin + 1).replace(/^\s*;?\s*/, "");
      if (/^return\b/.test(reste)) continue;              // l'appelant s'arrête là
      if (/^[}\)]/.test(reste) || reste.trim() === "") continue;
      note("⑥ fonction asynchrone appelée sans await", {
        mod, ligne: ligneDe(mod, m.index), nom,
        contexte: SRC[mod].slice(Math.max(0,m.index-45), m.index+35).replace(/\s+/g," ").trim()
      });
    }
  });
});

/* ── ⑦ APOSTROPHE INVERSE DANS UN COMMENTAIRE DE GABARIT ──────
   ⚠️ CE PIÈGE A CASSÉ LA COMPILATION DEUX FOIS CETTE SEMAINE, et
   l'analyseur de cet audit une troisième. Un commentaire posé dans une
   expression de gabarit, et qui contient une apostrophe inverse, referme
   le gabarit au milieu du commentaire. Le module ne compile plus, et le
   message d'erreur pointe ailleurs.
   ⚠️ ET CE COMMENTAIRE-CI A CASSÉ L'ANALYSEUR À SON TOUR : j'y avais
   écrit la séquence qui ferme un commentaire de bloc, en voulant citer
   la forme fautive. On ne cite pas un délimiteur à l'intérieur de ce
   qu'il délimite — c'est la même erreur, d'un cran au-dessus. */
Object.keys(SRC).forEach(mod => {
  const s = SRC[mod];
  const re = /\$\{\s*\/\*/g; let m;
  while ((m = re.exec(s))){
    const fin = s.indexOf("*/", m.index);
    if (fin < 0) continue;
    const bloc = s.slice(m.index, fin);
    const n = (bloc.match(/`/g) || []).length;
    if (n) note("⑦ apostrophe inverse dans un commentaire de gabarit", {
      mod, ligne: ligneDe(mod, m.index), combien: n,
      extrait: bloc.slice(0, 60).replace(/\s+/g, " ")
    });
  }
});

/* ── ⑧ BOUTON PORTANT UN id, QUE PERSONNE NE CONSULTE ────────
   ⚠️ C'EST LE DÉTECTEUR LE PLUS PROCHE DE SA PLAINTE : un bouton qui
   s'affiche, qu'on touche, et qui ne fait rien. Le défaut de la v1.27.1
   (les lignes du listing) et celui de la v1.28.0 (le témoin 💾) sont
   tous deux de cette famille.
   ⚠️ ON NE GARDE QUE LES BOUTONS : un id sur un conteneur sert souvent
   à le remplir, pas à l'écouter. */
{
  const consultes = new Set();
  let m;
  const re1 = /\$\(\s*["'`]#([a-zA-Z0-9_-]+)/g;
  while ((m = re1.exec(TOUT))) consultes.add(m[1]);
  const re2 = /getElementById\(\s*["'`]([a-zA-Z0-9_-]+)/g;
  while ((m = re2.exec(TOUT))) consultes.add(m[1]);
  const re3 = /querySelector(?:All)?\(\s*["'`][^"'`]*#([a-zA-Z0-9_-]+)/g;
  while ((m = re3.exec(TOUT))) consultes.add(m[1]);
  Object.keys(SRC).forEach(mod => {
    const s2 = BAL[mod];
    const reB = /<button\b[^>]*\sid\s*=\s*["']([a-zA-Z0-9_-]+)["'][^>]*>/g;
    let b2;
    while ((b2 = reB.exec(s2))){
      const id = b2[1];
      if (consultes.has(id)) continue;
      /* Un bouton peut aussi être atteint par sa classe ou un data-*. */
      const bloc = b2[0];
      if (/\sdata-[a-z0-9-]+\s*=/.test(bloc)) continue;
      if (/\sonclick\s*=/.test(bloc)) continue;
      note("⑧ bouton avec un id que personne ne consulte", {
        mod, ligne: ligneDe(mod, b2.index), id,
        extrait: bloc.slice(0, 80).replace(/\s+/g, " ")
      });
    }
  });
}

/* ── SORTIE ───────────────────────────────────────────────── */
let total = 0;
Object.keys(R).sort().forEach(rub => {
  console.log("\n═══ " + rub.toUpperCase() + " — " + R[rub].length + " ═══");
  R[rub].slice(0, 40).forEach(o => { total++;
    console.log("   " + Object.entries(o).map(([k,v]) => k + "=" + v).join("  ")); });
  if (R[rub].length > 40) console.log("   … et " + (R[rub].length - 40) + " de plus");
});
console.log("\n──────────────────────────────────────────");
Object.keys(R).sort().forEach(r => console.log("  " + String(R[r].length).padStart(4) + "  " + r));
console.log("  " + String(Object.values(R).reduce((s,a)=>s+a.length,0)).padStart(4) + "  TOTAL");
