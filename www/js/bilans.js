/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   BILANS — tubes et valeurs de référence
   ─────────────────────────────────────────────────────────
   Un aide-mémoire pour le prélèvement : quel tube, dans quel ordre, et
   à quoi ressemble une valeur usuelle.

   ⚠️ LES VALEURS SONT INDICATIVES. Chaque laboratoire publie ses
   propres intervalles de référence, qui dépendent de sa technique
   d'analyse, et ils varient avec l'âge, le sexe, la grossesse. CE SONT
   LES VALEURS DU COMPTE RENDU QUI FONT FOI, jamais celles-ci. Le
   module le répète à l'écran, pas seulement ici.

   ⚠️ LES COULEURS DE BOUCHON NE SONT PAS UNIVERSELLES : elles varient
   d'un fabricant et d'un laboratoire à l'autre. L'ordre de prélèvement
   lui-même peut être précisé par le laboratoire. En cas de doute, c'est
   lui qu'on suit.

   ⚠️ L'APPLICATION N'INTERPRÈTE RIEN. Elle n'a jamais dit « cette
   kaliémie est basse, fais ceci » et ne le dira pas. Elle affiche un
   mémo, le soignant lit son compte rendu et décide. Même ligne que
   pour les constantes, les plaies et le guide de prescription.

   ⚠️ Rien n'entre dans un dossier : aucune valeur de patient n'est
   saisie ici. C'est une lecture.

   ⚠️ Modifiable comme les autres modèles : l'original reste en dur et
   revient quand on le demande.
============================================================ */

/* L'ordre de prélèvement : une seule liste, parce que c'est le point
   où une erreur se paie en résultat faussé. */
const BILAN_TUBES = [
  { n:"Hémocultures", c:"flacons", p:"Toujours en premier, avant tout autre tube.",
    u:"Recherche de germes dans le sang." },
  { n:"Tube citraté", c:"bouchon bleu", p:"Remplissage complet impératif : le rapport sang/anticoagulant fausse le résultat s'il manque.",
    u:"Coagulation : TP, INR, TCA, fibrinogène." },
  { n:"Tube sec ou gel séparateur", c:"bouchon rouge ou jaune", p:"Laisser coaguler avant centrifugation.",
    u:"Sérologies, bilan hépatique, lipidique, thyroïdien, marqueurs." },
  { n:"Tube hépariné", c:"bouchon vert", p:"Retourner doucement, 8 à 10 fois.",
    u:"Ionogramme, bilan rénal selon le laboratoire." },
  { n:"Tube EDTA", c:"bouchon violet", p:"Retourner doucement, 8 à 10 fois. Ne jamais agiter.",
    u:"NFS, plaquettes, HbA1c, groupage." },
  { n:"Tube fluoré", c:"bouchon gris", p:"Pour la glycémie si le délai avant analyse est long.",
    u:"Glycémie, lactates." }
];

const BILAN_GROUPES = [
  { g:"Numération formule sanguine", items:[
    { n:"Hémoglobine", h:"13 – 17 g/dL", f:"12 – 16 g/dL" },
    { n:"Hématocrite", h:"40 – 52 %", f:"36 – 48 %" },
    { n:"Globules rouges", h:"4,5 – 5,9 T/L", f:"4,0 – 5,2 T/L" },
    { n:"VGM", v:"80 – 100 fL" },
    { n:"Leucocytes", v:"4 – 10 G/L" },
    { n:"Polynucléaires neutrophiles", v:"1,5 – 7 G/L" },
    { n:"Lymphocytes", v:"1 – 4 G/L" },
    { n:"Plaquettes", v:"150 – 400 G/L" }
  ]},
  { g:"Ionogramme sanguin", items:[
    { n:"Sodium", v:"135 – 145 mmol/L" },
    { n:"Potassium", v:"3,5 – 5,0 mmol/L" },
    { n:"Chlore", v:"95 – 105 mmol/L" },
    { n:"Bicarbonates", v:"22 – 29 mmol/L" },
    { n:"Calcium total", v:"2,20 – 2,60 mmol/L" },
    { n:"Magnésium", v:"0,70 – 1,00 mmol/L" },
    { n:"Phosphore", v:"0,80 – 1,45 mmol/L" }
  ]},
  { g:"Fonction rénale", items:[
    { n:"Créatinine", h:"65 – 115 µmol/L", f:"50 – 100 µmol/L" },
    { n:"Urée", v:"2,5 – 7,5 mmol/L" },
    { n:"DFG estimé", v:"≥ 90 mL/min/1,73 m² (normal)" },
    { n:"Albuminurie / créatininurie", v:"< 3 mg/mmol" }
  ]},
  { g:"Fonction hépatique", items:[
    { n:"ASAT (SGOT)", v:"< 40 UI/L" },
    { n:"ALAT (SGPT)", v:"< 40 UI/L" },
    { n:"Gamma-GT", h:"< 55 UI/L", f:"< 38 UI/L" },
    { n:"Phosphatases alcalines", v:"40 – 130 UI/L" },
    { n:"Bilirubine totale", v:"< 17 µmol/L" },
    { n:"Albumine", v:"35 – 50 g/L" }
  ]},
  { g:"Glycémie et diabète", items:[
    { n:"Glycémie à jeun", v:"3,9 – 5,5 mmol/L — soit 0,70 – 1,00 g/L" },
    { n:"HbA1c", v:"< 6 % chez le non-diabétique ; cible individualisée chez le diabétique" }
  ]},
  { g:"Bilan lipidique", items:[
    { n:"Cholestérol total", v:"< 5,2 mmol/L — soit < 2 g/L" },
    { n:"LDL", v:"cible selon le risque cardiovasculaire" },
    { n:"HDL", h:"> 1,0 mmol/L", f:"> 1,3 mmol/L" },
    { n:"Triglycérides", v:"< 1,7 mmol/L — soit < 1,5 g/L" }
  ]},
  { g:"Coagulation", items:[
    { n:"TP", v:"70 – 100 %" },
    { n:"INR (hors traitement)", v:"0,8 – 1,2" },
    { n:"INR sous AVK", v:"cible fixée par le prescripteur, souvent 2 – 3" },
    { n:"TCA (ratio)", v:"0,8 – 1,2" },
    { n:"Fibrinogène", v:"2 – 4 g/L" }
  ]},
  { g:"Inflammation", items:[
    { n:"CRP", v:"< 5 mg/L" },
    { n:"VS à la 1ʳᵉ heure", h:"< 15 mm", f:"< 20 mm" },
    { n:"Procalcitonine", v:"< 0,5 µg/L" }
  ]},
  { g:"Thyroïde", items:[
    { n:"TSH", v:"0,4 – 4,0 mUI/L" },
    { n:"T4 libre", v:"10 – 23 pmol/L" }
  ]},
  { g:"Autres repères", items:[
    { n:"Ferritine", h:"30 – 300 µg/L", f:"20 – 200 µg/L" },
    { n:"Vitamine B12", v:"200 – 900 ng/L" },
    { n:"Vitamine D (25-OH)", v:"≥ 30 ng/mL souhaitable" },
    { n:"Protéines totales", v:"65 – 80 g/L" }
  ]}
];

function bilanData(){ return essaiData("bilans"); }
function bilanGroupes(){
  const perso = bilanData().groupes;
  return perso || BILAN_GROUPES;
}
function bilanModifie(){ return !!bilanData().groupes; }

let _bilOnglet = "normes", _bilOuvert = null, _bilQ = "";

function sheetBilans(){
  const q = (_bilQ || "").trim().toLowerCase();
  const groupes = bilanGroupes()
    .map(g => ({ ...g, items: q ? g.items.filter(x =>
        (x.n + " " + (x.v || "") + " " + (x.h || "") + " " + (x.f || "")).toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length);

  const vals = x => x.v
    ? `<span class="bi-v">${esc(x.v)}</span>`
    : `<span class="bi-v">♂ ${esc(x.h || "—")}</span><span class="bi-v">♀ ${esc(x.f || "—")}</span>`;

  openSheet(`
    ${navHeader("Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("bilans") : ""}
    <h3>🧪 Bilans — tubes et repères</h3>

    <div class="ca-tabs">
      <button class="ca-tab ${_bilOnglet === "normes" ? "on" : ""}" data-bit="normes">📊 Valeurs</button>
      <button class="ca-tab ${_bilOnglet === "tubes" ? "on" : ""}" data-bit="tubes">🩸 Tubes</button>
    </div>

    <div class="warn" style="margin-bottom:12px">Valeurs <b>indicatives</b>. Chaque laboratoire a les siennes, et elles varient avec l'âge, le sexe et la grossesse : <b>ce sont celles du compte rendu qui font foi</b>.</div>

    ${_bilOnglet === "tubes" ? `
      <p class="small muted" style="margin-bottom:10px">Ordre de prélèvement. Les couleurs de bouchon varient selon le fabricant : en cas de doute, suis ton laboratoire.</p>
      ${BILAN_TUBES.map((t, i) => `
        <div class="bi-t">
          <div class="bi-th"><span class="bi-n">${i + 1}</span>
            <span style="flex:1;min-width:0"><b>${esc(t.n)}</b>
              <br><span class="small muted">${esc(t.c)}</span></span></div>
          <p class="bi-u">${esc(t.u)}</p>
          <p class="bi-p">${esc(t.p)}</p>
        </div>`).join("")}
      <div class="tip" style="margin-top:10px">Un tube citraté mal rempli fausse l'INR : c'est l'erreur la plus fréquente, et la plus lourde de conséquences sous AVK.</div>
    ` : `
      <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-bottom:10px">
        <span>🔍</span>
        <input id="bi-q" class="rec-in" placeholder="Chercher — kaliémie, INR, TSH…" value="${esc(_bilQ)}" style="flex:1;min-width:0">
        ${_bilQ ? `<button class="lien-x" id="bi-qx" aria-label="Effacer">✕</button>` : ""}
      </div>
      ${groupes.map(g => {
        const ouvert = q ? true : _bilOuvert === g.g;
        return `<div class="di-g ${ouvert ? "on" : ""}">
          <button class="di-gh" data-big="${esc(g.g)}">
            <span style="flex:1;min-width:0;text-align:left">${esc(g.g)}</span>
            <span class="di-n">${g.items.length}</span>
            <span class="di-fl">${ouvert ? "⌄" : "›"}</span>
          </button>
          ${ouvert ? g.items.map(x => `
            <div class="bi-i">
              <span class="bi-nm">${esc(x.n)}</span>
              <span class="bi-vs">${vals(x)}</span>
            </div>`).join("") : ""}
        </div>`;
      }).join("")}
      ${!groupes.length ? `<p class="small muted">Rien ne correspond à « ${esc(_bilQ)} ».</p>` : ""}
      <button class="btn btn-ghost" id="bi-edit" style="width:100%;margin-top:10px">✏️ Ajuster aux valeurs de mon laboratoire${
        bilanModifie() ? ` <span class="small muted">— ajusté</span>` : ""}</button>
    `}

    <div class="tip" style="margin-top:12px">L'application <b>n'interprète aucun résultat</b> : elle affiche des repères, tu lis le compte rendu.</div>`);
  bindNav();
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();

  $$("#sheet [data-bit]").forEach(b => b.onclick = () => { _bilOnglet = b.dataset.bit; sheetBilans(); });
  $$("#sheet [data-big]").forEach(b => b.onclick = () => {
    _bilOuvert = (_bilOuvert === b.dataset.big) ? null : b.dataset.big;
    sheetBilans();
  });
  { const e = $("#bi-q");
    if (e) e.oninput = () => { _bilQ = e.value; const p = e.selectionStart;
      sheetBilans(); const n = $("#bi-q"); if (n){ n.focus(); n.setSelectionRange(p, p); } }; }
  { const e = $("#bi-qx"); if (e) e.onclick = () => { _bilQ = ""; sheetBilans(); }; }
  { const b = $("#bi-edit"); if (b) b.onclick = () => sheetBilansEdit(); }
}

/* ⚠️ L'ajustement sert à coller aux intervalles du laboratoire
   habituel : c'est l'usage attendu, pas une invention de valeurs. */
function sheetBilansEdit(){
  const G = JSON.parse(JSON.stringify(bilanGroupes()));
  openSheet(`
    ${navHeader("Bilans", true)}
    <h3>✏️ Ajuster les valeurs</h3>
    <div class="warn" style="margin-bottom:12px">Reporte ici les intervalles de <b>ton</b> laboratoire. L'application ne vérifie rien : ce que tu écris s'affichera tel quel.</div>
    ${G.map((g, i) => `
      <div class="lab" style="margin-top:12px">${esc(g.g)}</div>
      ${g.items.map((x, k) => `
        <div class="bi-e">
          <span class="bi-nm">${esc(x.n)}</span>
          <input class="rec-in" data-biv="${i}.${k}" value="${esc(x.v || ((x.h||"") + (x.f ? " · ♀ " + x.f : "")))}"
            placeholder="intervalle">
        </div>`).join("")}`).join("")}
    <button class="btn btn-primary" id="be-ok" style="width:100%;margin-top:14px">✓ Enregistrer</button>
    ${bilanModifie() ? `<button class="btn btn-ghost" id="be-raz" style="width:100%;margin-top:7px">↺ Revenir aux repères d'origine</button>` : ""}`);
  bindNav(() => sheetBilans());
  { const b = $("#be-ok");
    if (b) b.onclick = () => {
      $$("#sheet [data-biv]").forEach(e => {
        const [i, k] = e.dataset.biv.split(".").map(Number);
        const t = e.value.trim();
        G[i].items[k] = { n:G[i].items[k].n, v:t };
      });
      bilanData().groupes = G; save(true);
      toast("Valeurs ajustées");
      sheetBilans();
    }; }
  { const b = $("#be-raz");
    if (b) b.onclick = async () => {
      if (!await askDialog({ ic:"↺", titre:"Revenir aux repères d'origine ?",
        sub:"Tes ajustements seront perdus.", oui:"Revenir à l'origine" })) return;
      delete bilanData().groupes; save(true);
      toast("Repères d'origine rétablis");
      sheetBilans();
    }; }
}
