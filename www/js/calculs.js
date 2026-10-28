/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   CALCULS — des mathématiques, rien d'autre
   ─────────────────────────────────────────────────────────
   ⚠️ AUCUNE RECOMMANDATION. Ces outils convertissent et divisent. Ils
   ne disent jamais quelle dose donner, ni si un débit est raisonnable.
   C'est ce qui les distingue d'une aide à la décision : une division
   n'est pas un conseil.

   ⚠️ LE CALCUL EST AFFICHÉ SOUS CHAQUE RÉSULTAT. Un nombre seul ne se
   vérifie pas ; un nombre accompagné de son opération se refait de
   tête. C'est la seule garantie utile au chevet d'un patient.

   ⚠️ FORMULES RECOUPÉES sur plusieurs sources, dont les applications
   que l'utilisateur emploie :
     · Outils Infirmiers (Youssef El Koutami) — dosage per os, débit IV
       en gouttes/min, µg/kg/min vers ml/h, débit SAP, conversion
       glycémie ;
     · Pocket Infusion Calculator (iMedical Apps) — débit, volume
       total, durée, dose pédiatrique ;
     · Memo IDE (Rémy T.) — normes et repères ;
     · Guide du calcul de doses et de débits médicamenteux, CHU de
       Nancy — source écrite.
   Les cas de test de la batterie emploient des valeurs dont le
   résultat est connu : 500 ml en 4 h à 20 gouttes/ml font 42 gouttes
   par minute, et 125 ml/h.

   ⚠️ RÈGLE DE SÉCURITÉ : un résultat n'est affiché que si TOUTES les
   valeurs nécessaires sont saisies. Pas de résultat partiel, pas de
   zéro trompeur — une valeur manquante doit se voir. C'est elle qui
   fait tout le travail sur l'écran des héparines : la concentration
   est demandée EN PREMIER, et rien ne se calcule sans elle.
============================================================ */

const CALC_ONGLETS = [
  { k:"debit",  ic:"💧", t:"Débit" },
  { k:"dose",   ic:"💊", t:"Dose" },
  { k:"dilu",   ic:"🧪", t:"Dilution" },
  { k:"conv",   ic:"🔁", t:"Conversions" }
];

/* ⚠️ SOUS-ONGLETS plutôt qu'une cinquième tuile en haut : la barre
   principale en compte déjà quatre, une de plus la ferait passer sur
   deux lignes et l'écran commencerait par un sommaire. */
const CONV_SOUS = [
  { k:"masse", ic:"⚖️",  t:"Masse" },
  { k:"vol",   ic:"💧",  t:"Volume" },
  { k:"conc",  ic:"🧪",  t:"Concentration" },
  { k:"hep",   ic:"🩸",  t:"Héparines" },
  { k:"gly",   ic:"🍬",  t:"Glycémie" },
  { k:"imc",   ic:"📏",  t:"IMC" }
];

let _calcOnglet = "debit";
let _calcSous   = "masse";
let _calcV = {};

/* Unités choisies par les pastilles (état d'écran, pas de donnée). */
let _uMasse = "mg", _uVol = "mL", _uConc = "%";
let _uSap   = "ugkgmin";          // unité de prescription de la seringue
let _doseSens = "versML";         // mg → mL, ou l'inverse
let _hepMg = false;               // le dépliant des milligrammes est replié

const _cv = k => {
  const v = (_calcV[k] || "").toString().replace(",", ".").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* ── ÉCRIRE UN NOMBRE QU'ON PUISSE LIRE ──
   ⚠️ `toPrecision` bascule en notation scientifique sous 1e-6 :
   « 2.5e-4 » n'est pas un nombre qu'on lit au chevet d'un patient.
   ⚠️ Et 250000 doit s'écrire 250 000 : c'est l'espace des milliers qui
   évite de compter les zéros du doigt sur une dose d'héparine. */
function calcNb(n){
  if (n === null || !Number.isFinite(n)) return "—";
  if (n === 0) return "0";
  const a = Math.abs(n);
  let s;
  if (a >= 1e12 || a < 1e-9) s = n.toExponential(3);
  else {
    const dec = a >= 1000 ? 1 : a >= 100 ? 2 : a >= 1 ? 3 : a >= 0.001 ? 5 : 9;
    s = n.toFixed(dec).replace(/0+$/, "").replace(/\.$/, "");
  }
  const p = s.split(".");
  return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, " ") + (p[1] ? "," + p[1] : "");
}

/* ── LES ÉCHELLES D'UNITÉS ──
   ⚠️ On rend TOUTE l'échelle, pas une conversion. Voir les échelons
   côte à côte est ce qui ancre le rapport de mille ; un résultat isolé
   ne l'apprend pas, et oblige à régler deux listes au lieu d'une. */
const ECH_MASSE = [["µg", 1e-6], ["mg", 1e-3], ["g", 1], ["kg", 1e3]];
const ECH_VOL   = [["µL", 1e-6], ["mL", 1e-3], ["cL", 1e-2], ["L", 1]];
function echelle(table, unite, valeur){
  const base = table.find(x => x[0] === unite);
  if (!base || valeur === null) return null;
  const enBase = valeur * base[1];
  return table.map(([u, f]) => ({ u, v: enBase / f, on: u === unite }));
}

/* ── LES HÉPARINES ──
   ⚠️ VÉRIFIÉ LE 11/10/2026 sur les textes officiels :
     · RCP Héparine sodique Panpharma 5 000 UI/mL (ANSM) — ampoule 1 mL
       = 5 000 UI, flacon 5 mL = 25 000 UI, et cette phrase : « Toutes
       les héparines n'étant pas à la même concentration, les
       prescriptions doivent être rédigées en U.I. » ;
     · ANSM, héparine calcique en seringue préremplie — 25 000 UI/mL,
       seringues 5 000 UI/0,2 mL et 7 500 UI/0,3 mL ARRÊTÉES et plus
       disponibles en ville ; restent les ampoules 12 500 UI/0,5 mL et
       20 000 UI/0,8 mL ;
     · MSF, héparine injectable — 1 000 et 5 000 UI/mL en IV, 25 000
       UI/mL en SC, « Bien vérifier la concentration avant utilisation ».

   ⚠️ C'EST TOUTE LA RAISON D'ÊTRE DE CET ÉCRAN. Un tableau de
   conversion figé porte sa concentration EN CREUX : « 1 mL = 5 000 UI »
   n'est vrai que pour la sodique. Devant une ampoule de calcique, le
   même millilitre fait 25 000 UI — CINQ FOIS la dose. Un calculateur
   demande la concentration en premier et refuse de calculer sans elle.

   ⚠️ AUCUN RCP FRANÇAIS NE DONNE D'ÉQUIVALENCE UI ↔ mg pour
   l'héparine : les seuls milligrammes du RCP concernent les excipients.
   La convention « 1 mg = 100 UI » est un héritage de l'étiquetage
   ancien. Elle reste disponible, REPLIÉE et ÉTIQUETÉE — jamais au même
   niveau que les UI.

   ⚠️ CE QUI N'EST PAS ICI, ET NE LE SERA PAS : passer d'une héparine à
   une autre. Aucune équivalence officielle n'existe entre HBPM, et
   c'est une décision de prescription. */
const HEP_VERIF = "11/10/2026";
const HEP_UI_PAR_MG = 100;       // convention ancienne, voir ci-dessus
const HEP_PRES = [
  { c:5000,  nom:"Héparine sodique",  voie:"IV",
    sous:"ampoule 1 mL = 5 000 UI · flacon 5 mL = 25 000 UI" },
  { c:1000,  nom:"Héparine sodique",  voie:"IV",
    sous:"dosage faible" },
  { c:25000, nom:"Héparine calcique", voie:"SC",
    sous:"ampoule 0,5 mL = 12 500 UI · 0,8 mL = 20 000 UI" },
  { c:0,     nom:"Autre — je lis l'étiquette", voie:"",
    sous:"saisie libre" }
];

/* Les unités de prescription d'une seringue électrique.
   `vers` rend le débit en mL/h à partir de la posologie, du poids et de
   la concentration en mg/mL. ⚠️ Le poids n'est exigé QUE par les
   unités qui le portent dans leur nom : réclamer un poids pour des
   mg/h bloquerait un calcul qui n'en a pas besoin. */
const SAP_UNITES = {
  ugkgmin: { lbl:"µg/kg/min", poids:true,
    vers:(d, p, cmgml) => (d * p * 60) / (cmgml * 1000),
    detail:(d, p, cmgml) => "(" + calcNb(d) + " × " + calcNb(p) + " × 60) ÷ " + calcNb(cmgml * 1000) + " µg/mL" },
  mgh:     { lbl:"mg/h", poids:false,
    vers:(d, p, cmgml) => d / cmgml,
    detail:(d, p, cmgml) => calcNb(d) + " ÷ " + calcNb(cmgml) + " mg/mL" },
  mgkgh:   { lbl:"mg/kg/h", poids:true,
    vers:(d, p, cmgml) => (d * p) / cmgml,
    detail:(d, p, cmgml) => "(" + calcNb(d) + " × " + calcNb(p) + ") ÷ " + calcNb(cmgml) + " mg/mL" },
  uih:     { lbl:"UI/h", poids:false,
    vers:(d, p, cmgml) => d / cmgml,
    detail:(d, p, cmgml) => calcNb(d) + " ÷ " + calcNb(cmgml) + " UI/mL" }
};

/* Chaque calcul rend { r, detail } ou null si une valeur manque. */
const CALCULS = {
  /* gouttes/min = (volume × facteur) ÷ (durée en minutes)
     ml/h = volume ÷ durée en heures */
  debitGouttes(){
    const v = _cv("d_vol"), h = _cv("d_h"), f = _cv("d_fac") || 20;
    if (v === null || h === null || h <= 0) return null;
    const min = h * 60;
    const g = (v * f) / min;
    return { r: Math.round(g) + " gouttes / min",
      detail: "(" + v + " × " + f + ") ÷ (" + h + " × 60) = " + (Math.round(g * 10) / 10),
      sous: Math.round((v / h) * 10) / 10 + " ml/h" };
  },
  /* ml/h = volume ÷ durée */
  debitMlh(){
    const v = _cv("d_vol"), h = _cv("d_h");
    if (v === null || h === null || h <= 0) return null;
    return { r: (Math.round((v / h) * 10) / 10) + " ml/h",
      detail: v + " ÷ " + h };
  },
  /* durée = volume ÷ débit */
  debitDuree(){
    const v = _cv("t_vol"), q = _cv("t_mlh");
    if (v === null || q === null || q <= 0) return null;
    const h = v / q;
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return { r: hh + " h " + String(mm).padStart(2, "0"),
      detail: v + " ÷ " + q + " = " + (Math.round(h * 100) / 100) + " h" };
  },

  /* ── LA SERINGUE ÉLECTRIQUE, EN TROIS TEMPS ──
     ⚠️ Les quatre champs venaient de TROIS SOURCES différentes — la
     seringue qu'on prépare, le patient, l'ordonnance — et se suivaient
     au même niveau. Ils sont désormais groupés par provenance.
     ⚠️ La CONCENTRATION se calcule et s'affiche dès les deux premiers
     champs, avant même le poids : c'est l'étape où l'erreur se glisse,
     elle n'apparaissait qu'en petit sous le résultat une fois tout
     rempli. */
  sapConc(){
    const mg = _cv("g_mg"), vol = _cv("g_vol");
    if (mg === null || vol === null || vol <= 0) return null;
    const c = mg / vol;
    return { r: calcNb(c) + " mg/mL",
      detail: calcNb(mg) + " ÷ " + calcNb(vol),
      sous: "soit " + calcNb(c * 1000) + " µg/mL" };
  },
  sapDebit(){
    const U = SAP_UNITES[_uSap] || SAP_UNITES.ugkgmin;
    const d = _cv("g_dose"), p = _cv("g_poids"), mg = _cv("g_mg"), vol = _cv("g_vol");
    if (d === null || mg === null || vol === null || vol <= 0) return null;
    if (U.poids && (p === null || p <= 0)) return null;
    const cmgml = mg / vol;
    if (cmgml <= 0) return null;
    const mlh = U.vers(d, p, cmgml);
    if (!Number.isFinite(mlh) || mlh <= 0) return null;
    /* ⚠️ LA DURÉE DE TENUE : « je repasse quand ? » est la vraie
       question en tournée, et c'est une division de plus, pas un avis. */
    const h = vol / mlh;
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
    return { r: calcNb(mlh) + " mL/h",
      detail: U.detail(d, p, cmgml) + " = " + calcNb(mlh),
      sous: "la seringue de " + calcNb(vol) + " mL tient " + hh + " h " + String(mm).padStart(2, "0") };
  },

  /* ── LE VOLUME À PRÉLEVER ──
     ⚠️ « Quantité de l'ampoule » et « Volume de l'ampoule », l'un sous
     l'autre en mg puis en mL, c'est exactement la paire qu'on
     intervertit. Le libellé recopie désormais ce qui est IMPRIMÉ SUR LE
     VERRE : « il y a ___ mg dans ___ mL ». On recopie, on ne traduit
     pas. Le calcul, lui, n'a pas changé. */
  doseConc(){
    const q = _cv("v_conc"), vol = _cv("v_qte");
    if (q === null || vol === null || vol <= 0) return null;
    return { r: calcNb(q / vol) + " mg par mL",
      detail: calcNb(q) + " ÷ " + calcNb(vol) };
  },
  doseVolume(){
    const d = _cv("v_dose"), q = _cv("v_conc"), vol = _cv("v_qte");
    if (d === null || q === null || vol === null || q <= 0 || vol <= 0) return null;
    const parMl = q / vol;
    if (_doseSens === "versMG"){
      /* L'autre sens : j'ai prélevé tant de mL, ça fait combien de mg ? */
      return { r: calcNb(d * parMl) + " mg",
        detail: calcNb(d) + " × " + calcNb(parMl) + " mg/mL" };
    }
    return { r: calcNb(d / parMl) + " mL",
      detail: calcNb(d) + " ÷ " + calcNb(parMl) + " mg/mL" };
  },
  /* dose = posologie × poids */
  dosePoids(){
    const mgkg = _cv("p_mgkg"), p = _cv("p_poids");
    if (mgkg === null || p === null) return null;
    const tot = mgkg * p;
    const n = _cv("p_prises");
    return { r: calcNb(tot) + " mg",
      detail: calcNb(mgkg) + " × " + calcNb(p),
      /* ⚠️ La division par le nombre de prises est l'erreur la plus
         banale du calcul de dose — et c'est une division, pas un avis. */
      sous: (n !== null && n > 0) ? "soit " + calcNb(tot / n) + " mg par prise ( ÷ " + calcNb(n) + " )" : "" };
  },

  /* concentration après reconstitution = quantité ÷ volume final */
  diluConc(){
    const q = _cv("r_qte"), v = _cv("r_vol");
    if (q === null || v === null || v <= 0) return null;
    return { r: (Math.round((q / v) * 1000) / 1000) + " mg/ml",
      detail: q + " ÷ " + v };
  },
  /* volume final = quantité ÷ concentration voulue */
  diluCible(){
    const q = _cv("c_qte"), c = _cv("c_conc");
    if (q === null || c === null || c <= 0) return null;
    return { r: (Math.round((q / c) * 100) / 100) + " ml au total",
      detail: q + " ÷ " + c };
  },

  /* ── LES CONVERSIONS D'UNITÉS ── */
  convMasse(){
    const v = _cv("m_val");
    const e = echelle(ECH_MASSE, _uMasse, v);
    if (!e) return null;
    return { r: e.map(x => calcNb(x.v) + " " + x.u).join("  ·  "),
      detail: "chaque échelon vaut mille fois le précédent", echelle: e };
  },
  convVolume(){
    const v = _cv("vo_val");
    const e = echelle(ECH_VOL, _uVol, v);
    if (!e) return null;
    return { r: e.map(x => calcNb(x.v) + " " + x.u).join("  ·  "),
      detail: "1 L = 100 cL = 1 000 mL = 1 000 000 µL", echelle: e };
  },
  /* ⚠️ LE POURCENTAGE D'UN SOLUTÉ est une masse pour cent millilitres :
     1 % = 1 g pour 100 mL = 10 g/L = 10 mg/mL. C'est l'unité des
     étiquettes — sérum physiologique 0,9 %, glucosé 5 % — et celle
     qu'on relit deux fois. */
  convConc(){
    const v = _cv("cc_val");
    if (v === null) return null;
    const gl = _uConc === "%" ? v * 10 : _uConc === "g/L" ? v : v;   // mg/mL = g/L
    const e = [
      { u:"%",     v: gl / 10, on: _uConc === "%" },
      { u:"g/L",   v: gl,      on: _uConc === "g/L" },
      { u:"mg/mL", v: gl,      on: _uConc === "mg/mL" }
    ];
    return { r: e.map(x => calcNb(x.v) + " " + x.u).join("  ·  "),
      detail: "1 % = 1 g pour 100 mL = 10 g/L = 10 mg/mL", echelle: e };
  },
  convPoche(){
    const v = _cv("cc_val"), p = _cv("cc_poche");
    if (v === null || p === null || p <= 0) return null;
    const gl = _uConc === "%" ? v * 10 : v;
    const g = gl * (p / 1000);
    return { r: calcNb(g) + " g",
      detail: calcNb(gl) + " g/L × " + calcNb(p / 1000) + " L" };
  },

  /* ── HÉPARINES ── */
  hepVolume(){
    const c = _cv("h_conc"), d = _cv("h_dose");
    if (c === null || d === null || c <= 0) return null;
    const nom = (HEP_PRES.find(x => x.c === c) || {});
    /* ⚠️ LE RÉSULTAT REDIT SA CONCENTRATION. Un nombre seul ne permet
       pas de voir qu'on s'est trompé d'ampoule ; un nombre qui rappelle
       son hypothèse, si. C'est la seule sécurité possible ici, et elle
       ne coûte qu'une ligne. */
    return { r: calcNb(d / c) + " mL",
      detail: calcNb(d) + " ÷ " + calcNb(c),
      sous: "avec une concentration de " + calcNb(c) + " UI/mL"
            + (nom.nom && nom.c ? " — " + nom.nom.toLowerCase() : "") };
  },
  hepUI(){
    const c = _cv("h_conc"), ml = _cv("h_ml");
    if (c === null || ml === null || c <= 0) return null;
    return { r: calcNb(ml * c) + " UI",
      detail: calcNb(ml) + " × " + calcNb(c),
      sous: "avec une concentration de " + calcNb(c) + " UI/mL" };
  },
  /* ⚠️ Convention ANCIENNE, repliée et étiquetée. Voir le bloc de
     commentaire des héparines plus haut. */
  hepMgUI(){
    const ui = _cv("h_ui"), mg = _cv("h_mg");
    if (ui !== null) return { r: calcNb(ui / HEP_UI_PAR_MG) + " mg",
      detail: calcNb(ui) + " ÷ " + HEP_UI_PAR_MG };
    if (mg !== null) return { r: calcNb(mg * HEP_UI_PAR_MG) + " UI",
      detail: calcNb(mg) + " × " + HEP_UI_PAR_MG };
    return null;
  },
  /* ⚠️ L'ÉNOXAPARINE EST LA SEULE à porter les deux unités sur sa
     boîte : « LOVENOX 10 000 UI (100 mg)/1 mL ». Sa conversion est donc
     proposée NOMMÉMENT, dans son propre bloc, et surtout pas comme une
     règle qui vaudrait pour les autres héparines. */
  enoxa(){
    const mg = _cv("e_mg"), ui = _cv("e_ui");
    if (mg !== null) return { r: calcNb(mg * 100) + " UI anti-Xa",
      detail: calcNb(mg) + " × 100" };
    if (ui !== null) return { r: calcNb(ui / 100) + " mg",
      detail: calcNb(ui) + " ÷ 100" };
    return null;
  },

  /* g/L = mmol/L × 0,18 (masse molaire du glucose 180 g/mol) */
  convGly(){
    const m = _cv("gly_mmol"), g = _cv("gly_gl");
    if (m !== null) return { r: (Math.round(m * 0.18 * 100) / 100) + " g/L",
      detail: m + " × 0,18  (glucose : 180 g/mol)" };
    if (g !== null) return { r: (Math.round((g / 0.18) * 100) / 100) + " mmol/L",
      detail: g + " ÷ 0,18" };
    return null;
  },
  /* IMC = poids ÷ taille² */
  convImc(){
    const p = _cv("i_poids"), t = _cv("i_taille");
    if (p === null || t === null || t <= 0) return null;
    const m = t > 3 ? t / 100 : t;   // 170 ou 1,70 : les deux acceptés
    return { r: (Math.round((p / (m * m)) * 10) / 10),
      detail: p + " ÷ (" + m + " × " + m + ")" };
  }
};

/* Quels résultats sont dessinés, dans l'ordre, pour l'onglet courant.
   ⚠️ UN SEUL ENDROIT : `calcMajResultats` relit cette liste pour
   remettre les blocs à jour sans redessiner l'écran. Deux listes
   auraient divergé au premier ajout. */
function calcNomsResultats(){
  if (_calcOnglet === "debit") return ["debitGouttes", "debitDuree", "sapConc", "sapDebit"];
  if (_calcOnglet === "dose")  return ["doseConc", "doseVolume", "dosePoids"];
  if (_calcOnglet === "dilu")  return ["diluConc", "diluCible"];
  if (_calcSous === "masse") return ["convMasse"];
  if (_calcSous === "vol")   return ["convVolume"];
  if (_calcSous === "conc")  return ["convConc", "convPoche"];
  if (_calcSous === "hep")   return ["hepVolume", "hepUI"].concat(_hepMg ? ["hepMgUI"] : []).concat(["enoxa"]);
  if (_calcSous === "gly")   return ["convGly"];
  return ["convImc"];
}

/* ── L'écran ── */
function sheetCalculs(pid){
  /* ⚠️ `lbl` n'est PAS échappé : certains libellés portent un <b> pour
     souligner le mot qui lève l'ambiguïté (« Volume TOTAL après
     dilution »). Tous sont des littéraux de ce fichier — aucune donnée
     de dossier n'y entre, et il ne faut pas que ça change. */
  const champ = (k, lbl, unite, mode) => `
    <div class="ca-f">
      <span class="ca-l">${lbl}</span>
      <input class="rec-in" data-cav="${k}" value="${esc(_calcV[k] || "")}"
        inputmode="${mode || "decimal"}" placeholder="—">
      <span class="ca-u">${esc(unite || "")}</span>
    </div>`;
  const res = (titre, calc) => {
    const r = CALCULS[calc]();
    return `<div class="ca-r ${r ? "ok" : ""}" data-cr="${calc}">
      <div class="ca-rt">${esc(titre)}</div>
      ${r ? `<div class="ca-rv">${esc(r.r)}</div>
             <div class="ca-rd">${esc(r.detail)}</div>
             <div class="ca-rd">${esc(r.sous || "")}</div>`
          : `<div class="ca-rv vide">—</div>
             <div class="ca-rd">il manque une valeur</div>
             <div class="ca-rd"></div>`}
    </div>`;
  };
  /* L'échelle d'unités : une bande de colonnes, celle qu'on a saisie
     mise en avant. Redessinée par `calcMajResultats` comme un résultat. */
  const bande = (calc) => {
    const r = CALCULS[calc]();
    const e = r && r.echelle;
    return `<div class="ca-ech" data-cech="${calc}">${
      e ? e.map(x => `<div class="${x.on ? "on" : ""}"><span>${esc(x.u)}</span><b>${esc(calcNb(x.v))}</b></div>`).join("")
        : `<div class="vide">saisis une valeur</div>`}</div>`;
  };
  const pastilles = (groupe, liste, courant) =>
    `<div class="chips" style="margin-bottom:8px">${liste.map(([v, l]) =>
      `<button class="chip sm ${v === courant ? "on" : ""}" data-cau="${groupe}|${esc(v)}">${esc(l)}</button>`).join("")}</div>`;

  let corps = "";
  if (_calcOnglet === "debit"){
    const U = SAP_UNITES[_uSap] || SAP_UNITES.ugkgmin;
    corps = `
      <div class="lab">Perfusion — volume et durée</div>
      ${champ("d_vol", "Volume à passer", "ml")}
      ${champ("d_h", "Durée", "h")}
      ${champ("d_fac", "Perfuseur", "gouttes/ml")}
      <p class="small muted" style="margin:2px 0 8px">Sans précision, 20 gouttes par ml.</p>
      ${res("Débit", "debitGouttes")}

      <div class="lab" style="margin-top:14px">Durée restante</div>
      ${champ("t_vol", "Volume restant", "ml")}
      ${champ("t_mlh", "Débit réglé", "ml/h")}
      ${res("Il reste", "debitDuree")}

      <div class="rowlab vi" style="margin-top:16px"><span>💉 Seringue électrique</span><i></i></div>
      <div class="ca-etape e1">
        <div class="ca-en">1 · Ce que tu prépares</div>
        ${champ("g_mg", "Produit dans la seringue", "mg")}
        ${champ("g_vol", "Volume <b>total</b> après dilution", "mL")}
      </div>
      ${res("Concentration", "sapConc")}
      <div class="ca-etape e2" style="margin-top:12px">
        <div class="ca-en">2 · Ton patient</div>
        ${champ("g_poids", "Poids", "kg")}
        ${U.poids ? "" : `<p class="small muted" style="margin:2px 0 0">Le poids n'entre pas dans un calcul en ${esc(U.lbl)}.</p>`}
      </div>
      <div class="ca-etape e3" style="margin-top:12px">
        <div class="ca-en">3 · Ce qui est prescrit</div>
        ${pastilles("sap", Object.entries(SAP_UNITES).map(([k, v]) => [k, v.lbl]), _uSap)}
        ${champ("g_dose", "Posologie", U.lbl)}
      </div>
      ${res("Régler la seringue sur", "sapDebit")}
      <div class="tip" style="margin-top:10px"><b>Exemple</b> — 250 mg de dobutamine complétés à 50 mL, patient de 70 kg, prescrit à 5 µg/kg/min : la concentration est de 5 mg/mL, et le débit de <b>4,2 mL/h</b>.</div>`;
  }
  else if (_calcOnglet === "dose"){
    corps = `
      <div class="ca-etape e1">
        <div class="ca-en">1 · Ce qui est écrit sur l'ampoule</div>
        ${champ("v_conc", "Il y a", "mg")}
        ${champ("v_qte", "… dans", "mL")}
      </div>
      ${res("Soit", "doseConc")}
      <div class="ca-etape e3" style="margin-top:12px">
        <div class="ca-en">2 · Ce que tu veux donner</div>
        ${pastilles("sens", [["versML", "mg → mL"], ["versMG", "mL → mg"]], _doseSens)}
        ${champ("v_dose", _doseSens === "versMG" ? "Volume prélevé" : "Dose prescrite",
                _doseSens === "versMG" ? "mL" : "mg")}
      </div>
      ${res(_doseSens === "versMG" ? "Cela fait" : "Prélever", "doseVolume")}

      <div class="lab" style="margin-top:16px">Dose selon le poids</div>
      ${champ("p_mgkg", "Posologie", "mg/kg")}
      ${champ("p_poids", "Poids", "kg")}
      ${champ("p_prises", "Nombre de prises <span style='color:var(--faint)'>— facultatif</span>", "par jour")}
      ${res("Dose", "dosePoids")}
      <div class="warn" style="margin-top:12px">Le calcul ne vérifie ni l'indication, ni la dose maximale, ni les contre-indications.</div>`;
  }
  else if (_calcOnglet === "dilu"){
    corps = `
      <div class="lab">Concentration après reconstitution</div>
      ${champ("r_qte", "Quantité", "mg")}
      ${champ("r_vol", "Volume final", "ml")}
      ${res("Concentration", "diluConc")}
      <div class="lab" style="margin-top:14px">Volume pour une concentration voulue</div>
      ${champ("c_qte", "Quantité", "mg")}
      ${champ("c_conc", "Concentration voulue", "mg/ml")}
      ${res("Diluer jusqu'à", "diluCible")}`;
  }
  else {
    const sous = `<div class="ca-tabs ca-sous">${CONV_SOUS.map(o =>
      `<button class="ca-tab ${o.k === _calcSous ? "on" : ""}" data-cas="${o.k}">${o.ic} ${esc(o.t)}</button>`).join("")}</div>`;
    let c = "";
    if (_calcSous === "masse"){
      c = `<div class="lab">Masse</div>
        ${champ("m_val", "Je saisis", "")}
        ${pastilles("masse", ECH_MASSE.map(x => [x[0], x[0]]), _uMasse)}
        ${bande("convMasse")}
        <p class="small muted" style="margin:6px 0 0">Chaque échelon vaut mille fois le précédent.</p>`;
    } else if (_calcSous === "vol"){
      c = `<div class="lab">Volume</div>
        ${champ("vo_val", "Je saisis", "")}
        ${pastilles("vol", ECH_VOL.map(x => [x[0], x[0]]), _uVol)}
        ${bande("convVolume")}
        <p class="small muted" style="margin:6px 0 0">1 L = 100 cL = 1 000 mL = 1 000 000 µL.</p>`;
    } else if (_calcSous === "conc"){
      c = `<div class="lab">Concentration d'un soluté</div>
        ${champ("cc_val", "Je saisis", "")}
        ${pastilles("conc", [["%", "%"], ["g/L", "g/L"], ["mg/mL", "mg/mL"]], _uConc)}
        ${bande("convConc")}
        <p class="small muted" style="margin:6px 0 10px">1 % = 1 g pour 100 mL = 10 g/L = 10 mg/mL.</p>
        <div class="lab">Et dans une poche</div>
        ${champ("cc_poche", "Volume de la poche", "mL")}
        ${res("Elle contient", "convPoche")}
        <div class="tip" style="margin-top:10px">Sérum physiologique <b>0,9 %</b> · glucosé <b>5 %</b> · xylocaïne <b>1 %</b> : le pourcentage est sur l'étiquette, rarement la quantité.</div>`;
    } else if (_calcSous === "hep"){
      const cc = _cv("h_conc");
      const choisie = HEP_PRES.find(x => x.c && x.c === cc);
      c = `
        <div class="ca-etape e1">
          <div class="ca-en">1 · Qu'as-tu en main ?</div>
          <div class="hep-pres">
            ${HEP_PRES.map(p => `<button class="hep-b ${p.c && p.c === cc ? "on" : ""}" data-cahp="${p.c}">
              <span class="hp-n"><b>${esc(p.nom)}</b><span>${p.voie ? esc(p.voie) + " · " : ""}${esc(p.sous)}</span></span>
              <span class="hp-c">${p.c ? calcNb(p.c) + " UI/mL" : "… UI/mL"}</span>
            </button>`).join("")}
          </div>
          ${champ("h_conc", "Concentration", "UI/mL")}
          <!-- ⚠️ Le facteur 5 est écrit EN PERMANENCE, pas en pied de
               page : c'est la seule chose qui distingue les deux
               ampoules, et l'habitude est le piège. -->
          <div class="warn" style="margin-top:8px">Sodique <b>5 000</b> et calcique <b>25 000</b> UI/mL : un facteur <b>5</b> pour le même volume. Vérifie l'ampoule, pas l'habitude.</div>
        </div>
        <div class="ca-etape e3" style="margin-top:12px">
          <div class="ca-en">2 · Dose prescrite</div>
          ${champ("h_dose", "Dose", "UI")}
        </div>
        ${res("Prélever", "hepVolume")}
        <div class="lab" style="margin-top:14px">Dans l'autre sens</div>
        ${champ("h_ml", "J'ai prélevé", "mL")}
        ${res("Cela fait", "hepUI")}

        <button class="btn btn-ghost btn-sm" id="ca-hepmg" style="width:100%;margin-top:14px;border-style:dashed;font-size:12px">${_hepMg ? "▾" : "▸"} Convertir en milligrammes <span style="color:var(--faint)">— ancien étiquetage</span></button>
        ${_hepMg ? `
        <div class="warn" style="margin-top:8px"><b>Les prescriptions d'héparine se rédigent en UI</b>, parce que toutes les héparines n'ont pas la même concentration — c'est le texte du résumé officiel du produit. <b>Aucun RCP français ne donne de correspondance UI ↔ mg</b> pour l'héparine.</div>
        ${champ("h_ui", "UI", "→ mg")}
        ${champ("h_mg", "mg", "→ UI")}
        <p class="small muted" style="margin:2px 0 0">Remplis l'un <b>ou</b> l'autre. Convention 1 mg = 100 UI, héritée de l'étiquetage ancien : à n'employer que pour relire un document.</p>
        ${res("Conversion", "hepMgUI")}` : ""}

        <div class="rowlab ac" style="margin-top:16px"><span>Énoxaparine — mg ↔ UI anti-Xa</span><i></i></div>
        <div class="rowbox ac" style="display:block">
          <p class="small muted" style="margin:0 0 7px">L'énoxaparine est la <b>seule</b> héparine dont la boîte porte les deux unités : « LOVENOX 10 000 UI (100 mg)/1 mL ». <b>1 mg = 100 UI anti-Xa.</b></p>
          ${champ("e_mg", "mg", "→ UI")}
          ${champ("e_ui", "UI anti-Xa", "→ mg")}
          ${res("Conversion", "enoxa")}
        </div>

        <div class="warn" style="margin-top:14px"><b>Cet écran ne fait passer d'une héparine à aucune autre.</b> Aucune équivalence de dose entre HBPM n'existe officiellement — l'ANSM donne les posologies spécialité par spécialité et ne publie aucune table de conversion. Changer d'héparine est une prescription.</div>
        <p class="small muted" style="margin-top:8px">Présentations vérifiées le <b>${esc(HEP_VERIF)}</b> sur les RCP de l'ANSM et le guide des médicaments essentiels de MSF. ${
          choisie ? "" : "Saisis la concentration lue sur ton ampoule si elle ne figure pas ci-dessus."}</p>`;
    } else if (_calcSous === "gly"){
      c = `<div class="lab">Glycémie</div>
        ${champ("gly_mmol", "mmol/L", "→ g/L")}
        ${champ("gly_gl", "g/L", "→ mmol/L")}
        <p class="small muted" style="margin:2px 0 8px">Remplis l'un <b>ou</b> l'autre.</p>
        ${res("Conversion", "convGly")}`;
    } else {
      c = `<div class="lab">Indice de masse corporelle</div>
        ${champ("i_poids", "Poids", "kg")}
        ${champ("i_taille", "Taille", "m ou cm")}
        ${res("IMC", "convImc")}
        <p class="small muted" style="margin-top:6px">Un indice, pas un diagnostic.</p>`;
    }
    corps = sous + c;
  }

  openSheet(`${brDossier(pid)}
    ${navHeader(pid ? "Fiche" : "Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("calculs") : ""}
    <h3>🧮 Calculs</h3>
    <div class="ca-tabs">
      ${CALC_ONGLETS.map(o => `<button class="ca-tab ${o.k === _calcOnglet ? "on" : ""}"
        data-cat="${o.k}">${o.ic} ${esc(o.t)}</button>`).join("")}
    </div>
    ${corps}
    <button class="btn btn-ghost" id="ca-raz" style="width:100%;margin-top:14px">↺ Effacer les valeurs</button>
    <div class="tip" style="margin-top:10px">Le calcul est écrit sous chaque résultat : refais-le de tête, c'est la seule vérification qui vaille.</div>
    <div class="warn" style="margin-top:9px">Ces outils <b>ne recommandent rien</b>. Ils divisent et convertissent, tu décides.</div>`);
  bindNav(() => pid ? sheetPatient(getP(pid), "act") : sheetTours());
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();

  $$("#sheet [data-cat]").forEach(b => b.onclick = () => { _calcOnglet = b.dataset.cat; sheetCalculs(pid); });
  $$("#sheet [data-cas]").forEach(b => b.onclick = () => { _calcSous = b.dataset.cas; sheetCalculs(pid); });
  /* ⚠️ Changer d'unité REDESSINE l'écran : les libellés des champs et
     la présence même du champ « poids » en dépendent. Ce n'est pas le
     cas d'une frappe, qui ne touche que les résultats. */
  $$("#sheet [data-cau]").forEach(b => b.onclick = () => {
    const [g, v] = b.dataset.cau.split("|");
    if (g === "masse") _uMasse = v;
    else if (g === "vol") _uVol = v;
    else if (g === "conc") _uConc = v;
    else if (g === "sap") _uSap = v;
    else if (g === "sens") _doseSens = v;
    sheetCalculs(pid);
  });
  /* Un raccourci de présentation remplit le champ de concentration ;
     « Autre » (c = 0) le vide pour qu'on y lise son ampoule. */
  $$("#sheet [data-cahp]").forEach(b => b.onclick = () => {
    const c = Number(b.dataset.cahp);
    _calcV.h_conc = c ? String(c) : "";
    sheetCalculs(pid);
  });
  { const b = $("#ca-hepmg"); if (b) b.onclick = () => { _hepMg = !_hepMg; sheetCalculs(pid); }; }

  $$("#sheet [data-cav]").forEach(e => e.oninput = () => {
    _calcV[e.dataset.cav] = e.value;
    /* ⚠️ On ne redessine que les résultats : redessiner l'écran entier
       ferait perdre le curseur à chaque chiffre tapé. */
    calcMajResultats();
  });
  { const b = $("#ca-raz");
    if (b) b.onclick = () => { _calcV = {}; sheetCalculs(pid); }; }
}

function calcMajResultats(){
  /* ⚠️ ON VISE CHAQUE BLOC PAR SON NOM DE CALCUL (`data-cr`), plus par
     sa position. L'ancienne version appariait une liste de noms à
     l'ordre des blocs à l'écran : ajouter un résultat au milieu
     décalait tous les suivants, et chaque bloc affichait le résultat
     de son voisin — sans rien casser de visible. */
  $$("#sheet .ca-r").forEach(el => {
    const nom = el.dataset.cr;
    const r = (nom && CALCULS[nom]) ? CALCULS[nom]() : null;
    const v = el.querySelector(".ca-rv"), d = el.querySelectorAll(".ca-rd");
    if (!v) return;
    if (r){
      el.classList.add("ok"); v.classList.remove("vide"); v.textContent = r.r;
      if (d[0]) d[0].textContent = r.detail;
      if (d[1]) d[1].textContent = r.sous || "";
    } else {
      el.classList.remove("ok"); v.classList.add("vide"); v.textContent = "—";
      if (d[0]) d[0].textContent = "il manque une valeur";
      if (d[1]) d[1].textContent = "";
    }
  });
  /* Les bandes d'échelle suivent la frappe de la même façon. */
  $$("#sheet .ca-ech").forEach(el => {
    const nom = el.dataset.cech;
    const r = (nom && CALCULS[nom]) ? CALCULS[nom]() : null;
    const e = r && r.echelle;
    el.innerHTML = e
      ? e.map(x => `<div class="${x.on ? "on" : ""}"><span>${esc(x.u)}</span><b>${esc(calcNb(x.v))}</b></div>`).join("")
      : `<div class="vide">saisis une valeur</div>`;
  });
}
