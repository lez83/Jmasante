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
   zéro trompeur — une valeur manquante doit se voir.
============================================================ */

const CALC_ONGLETS = [
  { k:"debit",  ic:"💧", t:"Débit" },
  { k:"dose",   ic:"💊", t:"Dose" },
  { k:"dilu",   ic:"🧪", t:"Dilution" },
  { k:"conv",   ic:"🔁", t:"Conversions" }
];

let _calcOnglet = "debit";
let _calcV = {};

const _cv = k => {
  const v = (_calcV[k] || "").toString().replace(",", ".").trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  /* ml/h = (µg/kg/min × poids × 60) ÷ (concentration en µg/ml)
     concentration = (mg dans la poche × 1000) ÷ volume */
  debitGamma(){
    const g = _cv("g_gamma"), p = _cv("g_poids"), mg = _cv("g_mg"), vol = _cv("g_vol");
    if (g === null || p === null || mg === null || vol === null || vol <= 0) return null;
    const concUg = (mg * 1000) / vol;
    if (concUg <= 0) return null;
    const mlh = (g * p * 60) / concUg;
    return { r: (Math.round(mlh * 100) / 100) + " ml/h",
      detail: "(" + g + " × " + p + " × 60) ÷ " + Math.round(concUg) + " µg/ml",
      sous: "concentration : (" + mg + " × 1000) ÷ " + vol + " = " + Math.round(concUg) + " µg/ml" };
  },
  /* volume à prélever = dose voulue ÷ concentration */
  doseVolume(){
    const d = _cv("v_dose"), c = _cv("v_conc"), q = _cv("v_qte");
    if (d === null || c === null || q === null || c <= 0 || q <= 0) return null;
    const concParMl = c / q;
    const ml = d / concParMl;
    return { r: (Math.round(ml * 100) / 100) + " ml",
      detail: d + " ÷ (" + c + " ÷ " + q + ") = " + d + " ÷ " + (Math.round(concParMl * 100) / 100) + " par ml" };
  },
  /* dose = posologie × poids */
  dosePoids(){
    const mgkg = _cv("p_mgkg"), p = _cv("p_poids");
    if (mgkg === null || p === null) return null;
    return { r: (Math.round(mgkg * p * 100) / 100) + " mg",
      detail: mgkg + " × " + p };
  },
  /* concentration après reconstitution = quantité ÷ volume final */
  diluConc(){
    const q = _cv("r_qte"), v = _cv("r_vol");
    if (q === null || v === null || v <= 0) return null;
    return { r: (Math.round((q / v) * 1000) / 1000) + " mg/ml",
      detail: q + " ÷ " + v };
  },
  /* volume final = (quantité × volume voulu) ÷ concentration voulue */
  diluCible(){
    const q = _cv("c_qte"), c = _cv("c_conc");
    if (q === null || c === null || c <= 0) return null;
    return { r: (Math.round((q / c) * 100) / 100) + " ml au total",
      detail: q + " ÷ " + c };
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

/* ── L'écran ── */
function sheetCalculs(pid){
  const champ = (k, lbl, unite, mode) => `
    <div class="ca-f">
      <span class="ca-l">${esc(lbl)}</span>
      <input class="rec-in" data-cav="${k}" value="${esc(_calcV[k] || "")}"
        inputmode="${mode || "decimal"}" placeholder="—">
      <span class="ca-u">${esc(unite || "")}</span>
    </div>`;
  const res = (titre, calc) => {
    const r = CALCULS[calc]();
    return `<div class="ca-r ${r ? "ok" : ""}">
      <div class="ca-rt">${esc(titre)}</div>
      ${r ? `<div class="ca-rv">${esc(r.r)}</div>
             <div class="ca-rd">${esc(r.detail)}</div>
             ${r.sous ? `<div class="ca-rd">${esc(r.sous)}</div>` : ""}`
          : `<div class="ca-rv vide">—</div>
             <div class="ca-rd">il manque une valeur</div>`}
    </div>`;
  };

  let corps = "";
  if (_calcOnglet === "debit"){
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
      <div class="lab" style="margin-top:14px">Seringue électrique — µg/kg/min</div>
      ${champ("g_gamma", "Posologie", "µg/kg/min")}
      ${champ("g_poids", "Poids", "kg")}
      ${champ("g_mg", "Quantité dans la seringue", "mg")}
      ${champ("g_vol", "Volume final", "ml")}
      ${res("Débit", "debitGamma")}`;
  }
  else if (_calcOnglet === "dose"){
    corps = `
      <div class="lab">Volume à prélever</div>
      ${champ("v_dose", "Dose voulue", "mg")}
      ${champ("v_conc", "Quantité de l'ampoule", "mg")}
      ${champ("v_qte", "Volume de l'ampoule", "ml")}
      ${res("Prélever", "doseVolume")}
      <div class="lab" style="margin-top:14px">Dose selon le poids</div>
      ${champ("p_mgkg", "Posologie", "mg/kg")}
      ${champ("p_poids", "Poids", "kg")}
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
    corps = `
      <div class="lab">Glycémie</div>
      ${champ("gly_mmol", "mmol/L", "→ g/L")}
      ${champ("gly_gl", "g/L", "→ mmol/L")}
      <p class="small muted" style="margin:2px 0 8px">Remplis l'un <b>ou</b> l'autre.</p>
      ${res("Conversion", "convGly")}
      <div class="lab" style="margin-top:14px">Indice de masse corporelle</div>
      ${champ("i_poids", "Poids", "kg")}
      ${champ("i_taille", "Taille", "m ou cm")}
      ${res("IMC", "convImc")}
      <p class="small muted" style="margin-top:6px">Un indice, pas un diagnostic.</p>`;
  }

  openSheet(`
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
  const blocs = $$("#sheet .ca-r");
  const noms = {
    debit:["debitGouttes","debitDuree","debitGamma"],
    dose:["doseVolume","dosePoids"],
    dilu:["diluConc","diluCible"],
    conv:["convGly","convImc"]
  }[_calcOnglet] || [];
  blocs.forEach((el, i) => {
    const r = CALCULS[noms[i]] ? CALCULS[noms[i]]() : null;
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
}
