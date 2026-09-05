/* ============================================================
   FEUILLES — export des constantes + feuilles vierges domicile
   ─────────────────────────────────────────────────────────
   ① Export de l'historique des constantes : courbes + tableau
      (PDF / HTML / Word / Texte), aussi joignable au médecin.
   ② Trois feuilles VIERGES à laisser au domicile, pré-remplies
      à l'en-tête du patient : Constantes (avec douleur),
      Poids, Glycémies.

   Format A4 portrait, grille mensuelle 1 → 31.
   Deux densités : "serre" (tout au recto) ou "confort"
   (1-16 recto, 17-31 verso, en-tête répété).
============================================================ */

/* ─────────────────────────────────────────────────────────
   RÉGLAGES DE MISE EN PAGE
   Tout ce qui touche à la densité est ici : si les lignes
   sont trop serrées ou la police trop petite à l'impression,
   ces valeurs sont les seules à changer.
   ───────────────────────────────────────────────────────── */
const FEUILLE_CSS = {
  serre:   { row:"8.1mm",  font:"8pt",   head:"7.6pt", title:"12pt", ident:"9.5pt" },
  confort: { row:"15.5mm", font:"10pt",  head:"9pt",   title:"13pt", ident:"10.5pt" }
};

/* ---------- Point d'entrée : choix de la feuille ---------- */
function sheetFeuilles(pid){
  const p = getP(pid);
  if (!p) { toast("Dossier introuvable", "danger"); return; }
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  let type = "constantes";
  let dens = "serre";

  const TYPES = [
    ["constantes", "📊", "Constantes",  "TA · pouls · T° · sat · douleur"],
    ["poids",      "⚖️", "Poids",       "date libre · écart · observations"],
    ["glycemies",  "🩸", "Glycémies",   "matin · midi · soir + insuline"]
  ];

  const draw = () => {
    openSheet(`
      ${navHeader("Fiche", true)}
      <h3 style="margin-bottom:2px">🖨️ Feuilles à laisser au domicile</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b> — feuilles vierges, déjà à son nom, à remplir à la main par tous les intervenants</p>

      <div class="lab">Quelle feuille ?</div>
      <div class="srcgrid" style="grid-template-columns:1fr;margin-bottom:14px">
        ${TYPES.map(([k,ic,lbl,sub])=>`
          <button class="srcbtn ${k===type?"on":""}" data-ft="${k}" style="flex-direction:row;align-items:center;gap:11px;text-align:left;padding:11px 13px">
            <span class="src-ic" style="margin:0">${ic}</span>
            <span style="flex:1;display:flex;flex-direction:column">
              <span class="src-lbl">${lbl}</span>
              <span class="src-sub">${sub}</span>
            </span>
            ${k===type?'<span style="color:var(--accent);font-size:15px">✓</span>':""}
          </button>`).join("")}
      </div>

      <div class="lab">Densité <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— à tester à l'impression</span></div>
      <div class="chips" style="margin-bottom:8px">
        <button class="chip ${dens==="serre"?"on":""}"   data-fd2="serre"   style="flex:1;justify-content:center">Serrée</button>
        <button class="chip ${dens==="confort"?"on":""}" data-fd2="confort" style="flex:1;justify-content:center">Confortable</button>
      </div>
      <p class="small muted" style="margin-bottom:16px">
        ${dens==="serre"
          ? "Les 31 jours sur une seule face. Lignes de 7 mm — compact."
          : "Jours 1 à 16 au recto, 17 à 31 au verso. Lignes de 13 mm — bien plus facile à remplir. <b>Imprimer en recto-verso</b> : une seule feuille pour le mois."}
      </p>

      <button class="btn btn-primary" id="fe2-show" style="width:100%">👁 Aperçu &amp; impression</button>
      <div class="rowb" style="margin-top:8px">
        <button class="btn btn-ghost" id="fe2-print">🖨️ Imprimer</button>
        <button class="btn btn-ghost" id="fe2-share">📤 Partager</button>
      </div>`);

    bindNav(() => sheetPatient(p));
    $$("#sheet [data-ft]").forEach(b => b.onclick = () => { type = b.dataset.ft; draw(); });
    $$("#sheet [data-fd2]").forEach(b => b.onclick = () => { dens = b.dataset.fd2; draw(); });

    const out = mode => {
      const html = feuilleHtml(p, type, dens);
      const base = "Feuille_" + type + "_" + p.nom.replace("Demo-","").replace(/\s+/g,"_");
      if (mode === "share"){ shareText(html, base + ".html", "text/html"); return; }
      showFichePreview(html, base);
      if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
    };
    $("#fe2-show").onclick  = () => out("show");
    $("#fe2-print").onclick = () => out("print");
    $("#fe2-share").onclick = () => out("share");
  };
  draw();
}

/* ---------- Génération d'une feuille vierge ---------- */
function feuilleHtml(p, type, dens){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const dob = p.dob ? p.dob.split("-").reverse().join("/") : "";
  const D = FEUILLE_CSS[dens] || FEUILLE_CSS.serre;
  const th = p.thresholds || {};

  // Seuils : ceux du patient s'ils sont définis, sinon repères généraux
  const seuil = (k, def) => (th[k] !== undefined && th[k] !== null) ? th[k] : def;
  const rappels = {
    constantes: `TA &gt; ${seuil("taHigh",16)} ou &lt; ${seuil("taLow",9)} · Pouls &gt; 100 ou &lt; 50 · T° &gt; 38 · Sat &lt; ${seuil("satLow",92)}` +
                ` · <b>Douleur ≥ 4 : antalgique et transmission</b>`,
    poids:      `Prévenir le médecin si prise de plus de 2 kg en 3 jours ou 3 kg en une semaine`,
    glycemies:  `Hypoglycémie &lt; ${seuil("glycLow",0.70)} g/L : resucrer et alerter · Hyperglycémie &gt; 2,50 g/L : prévenir le médecin`
  };

  const TITRES = {
    constantes: "SURVEILLANCE DES CONSTANTES",
    poids:      "SUIVI DU POIDS",
    glycemies:  "SURVEILLANCE GLYCÉMIQUE"
  };

  /* En-tête, répété au verso en mode confortable */
  const entete = (suite) => `
    <div class="hd">
      <div class="hd-l">
        <div class="tt">${TITRES[type]}${suite?' <span class="sui">(suite)</span>':""}</div>
        <div class="id"><b>${esc(nom)}</b>${dob?` — née le ${dob}`:""}</div>
        ${type==="poids"     ? `<div class="sub">Poids de référence : ________ kg</div>` : ""}
        ${type==="glycemies" ? `<div class="sub">Protocole : _______________________________________________</div>` : ""}
      </div>
      <div class="mois">Mois : ________ 20___</div>
    </div>`;

  /* Lignes du tableau */
  const nbCols = { constantes:8, poids:5, glycemies:9 }[type];
  const ligne = (j) => {
    const jour = (type === "poids")
      ? `<td class="dt"></td>`                        // date libre : pesée non quotidienne
      : `<td class="jr">${j}</td>`;
    const cells = new Array(nbCols - 1).fill('<td></td>').join("");
    return `<tr>${jour}${cells}</tr>`;
  };

  const entetesTable = {
    constantes: `<tr>
        <th style="width:6%">${"J"}</th>
        <th style="width:11%">TA</th><th style="width:9%">Pouls</th>
        <th style="width:9%">T°</th><th style="width:8%">Sat</th>
        <th style="width:9%" class="dl">Doul.<span>/10</span></th>
        <th style="width:36%">Observations</th><th style="width:12%">Init.</th>
      </tr>`,
    poids: `<tr>
        <th style="width:13%">Date</th><th style="width:13%">Poids</th>
        <th style="width:11%">Écart</th><th style="width:49%">Observations</th>
        <th style="width:14%">Init.</th>
      </tr>`,
    glycemies: `<tr>
        <th rowspan="2" style="width:6%">J</th>
        <th colspan="2" style="width:17%">Matin</th>
        <th colspan="2" style="width:17%">Midi</th>
        <th colspan="2" style="width:17%">Soir</th>
        <th rowspan="2" style="width:31%">Observations</th>
        <th rowspan="2" style="width:12%">Init.</th>
      </tr>
      <tr class="sub-h">
        <th>g/L</th><th>UI</th><th>g/L</th><th>UI</th><th>g/L</th><th>UI</th>
      </tr>`
  };

  const table = (from, to) => `<table>
      ${entetesTable[type]}
      ${Array.from({length: to-from+1}, (_,i) => ligne(from+i)).join("")}
    </table>`;

  const pied = `<div class="sp"></div><div class="pd">${rappels[type]}</div>`;

  // Courbe uniquement sur la feuille de poids
  const courbe = type !== "poids" ? "" : `
    <svg class="crb" viewBox="0 0 310 ${dens==="serre"?70:90}" preserveAspectRatio="none">
      ${[...Array(5)].map((_,i)=>`<line x1="0" y1="${(i+1)*(dens==="serre"?12:16)}" x2="310" y2="${(i+1)*(dens==="serre"?12:16)}" stroke="#e4ece9" stroke-width="0.4"/>`).join("")}
      ${[...Array(9)].map((_,i)=>`<line x1="${(i+1)*31}" y1="0" x2="${(i+1)*31}" y2="${dens==="serre"?70:90}" stroke="#eef3f1" stroke-width="0.3"/>`).join("")}
      <text x="2" y="8" font-size="5" fill="#8a9a95">kg</text>
    </svg>`;

  const corps = (dens === "serre")
    ? `<div class="pg">${entete(false)}${courbe}${table(1,31)}${pied}</div>`
    : `<div class="pg">${entete(false)}${courbe}${table(1,16)}${pied}
         <div class="verso-note">Suite au verso →</div></div>
       <div class="pg brk">${entete(true)}${table(17,31)}${pied}</div>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${TITRES[type]} — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:9mm 8mm; }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0}
 .pg{ display:flex; flex-direction:column; min-height:277mm; }
 .sp{ flex:1 }   /* pousse le pied de page en bas sans étirer le tableau */
 .brk{ page-break-before:always; }
 .hd{ display:flex; justify-content:space-between; align-items:flex-end;
      border-bottom:2px solid #005A50; padding-bottom:4px; margin-bottom:5px; flex-shrink:0 }
 .hd .tt{ font-size:${D.title}; font-weight:800; color:#005A50; letter-spacing:.02em }
 .hd .sui{ font-weight:400; font-size:9pt; color:#6b7a75 }
 .hd .id{ font-size:${D.ident}; margin-top:1px }
 .hd .sub{ font-size:8.5pt; color:#5a6a65; margin-top:2px }
 .hd .mois{ font-size:8.5pt; color:#5a6a65; border:1px solid #c8d8d3;
            padding:2px 8px; border-radius:3px; white-space:nowrap }
 .crb{ width:100%; height:${dens==="serre"?"22mm":"30mm"}; border:1px solid #c8d8d3;
       margin-bottom:4px; flex-shrink:0 }
 table{ width:100%; border-collapse:collapse; font-size:${D.font};
        table-layout:fixed }
 th{ border:1px solid #b8ccc6; background:#eef3f1; padding:3px 1px;
     font-size:${D.head}; font-weight:700; text-align:center;
     height:auto; line-height:1.15 }
 thead th, table > tr:first-child th{ height:6mm }
 th span{ display:block; font-weight:400; font-size:.8em; color:#5a6a65 }
 th.dl{ background:#fdf0e6 }
 tr.sub-h th{ background:#f5f8f7; font-weight:400; font-size:.85em }
 td{ border:1px solid #dde7e3; height:${D.row} }
 td.jr{ text-align:center; color:#7a8a85; font-weight:600; background:#f7faf9; font-size:.95em }
 td.dt{ background:#fafcfb }
 tbody tr:nth-child(even) td{ background:#fbfdfc }
 tr:nth-child(even) td.jr{ background:#f1f6f4 }
 .pd{ border-top:1px solid #d8e3df; margin-top:4px; padding-top:3px;
      font-size:7pt; color:#5a6a65; flex-shrink:0 }
 .verso-note{ text-align:right; font-size:7.5pt; color:#8a9a95; margin-top:2px; font-style:italic }
 @media screen{ body{ background:#e8eeec; padding:10px }
   .pg{ background:#fff; padding:9mm 8mm; margin:0 auto 12px; max-width:210mm;
        box-shadow:0 2px 12px rgba(0,0,0,.15) } }
</style></head><body>${corps}</body></html>`;
}

/* ============================================================
   EXPORT DE L'HISTORIQUE DES CONSTANTES — courbes + tableau
============================================================ */

function sheetExportConst(pid){
  const p = getP(pid);
  if (!p) return;
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  let jours = 30, fmt = "pdf";

  const draw = () => {
    const cut = new Date(Date.now() - jours*864e5).toISOString().slice(0,10);
    const vs = (p.visits||[]).filter(v => v.date >= cut && v.consts && Object.keys(v.consts).length);
    openSheet(`
      ${navHeader("Courbes", true)}
      <h3 style="margin-bottom:2px">📄 Exporter l'historique</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b> — courbes d'évolution puis tableau détaillé</p>

      <div class="lab">Période</div>
      <div class="chips" style="margin-bottom:12px">
        ${[[15,"15 jours"],[30,"1 mois"],[90,"3 mois"],[365,"1 an"]].map(([d,l])=>
          `<button class="chip ${jours===d?"on":""}" data-fj="${d}">${l}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:14px">${vs.length} relevé(s) sur la période.</p>

      <div class="lab">Format</div>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip ${fmt==="pdf" ?"on":""}" data-ff2="pdf"  style="flex:1;justify-content:center">📑 PDF</button>
        <button class="chip ${fmt==="html"?"on":""}" data-ff2="html" style="flex:1;justify-content:center">🌐 HTML</button>
        <button class="chip ${fmt==="txt" ?"on":""}" data-ff2="txt"  style="flex:1;justify-content:center">🗒️ Texte</button>
      </div>

      <button class="btn btn-primary" id="ec-go" style="width:100%">${fmt==="pdf"?"👁 Aperçu &amp; impression":"📤 Exporter"}</button>`);

    bindNav(() => { closeSheet(); const b = document.querySelector(`[data-graph="${p.id}"]`); if (b) b.click(); });
    $$("#sheet [data-fj]").forEach(b => b.onclick = () => { jours = +b.dataset.fj; draw(); });
    $$("#sheet [data-ff2]").forEach(b => b.onclick = () => { fmt = b.dataset.ff2; draw(); });
    $("#ec-go").onclick = () => {
      const base = "Constantes_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();
      if (fmt === "txt"){ shareText(constTexte(p, vs, jours), base + ".txt", "text/plain"); return; }
      const html = constHtml(p, vs, jours);
      if (fmt === "html"){ shareText(html, base + ".html", "text/html"); return; }
      showFichePreview(html, base);
    };
  };
  draw();
}

/* ---------- Document : courbes puis tableau ---------- */
function constHtml(p, vs, jours){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const th = p.thresholds || {};
  const sorted = [...vs].sort((a,b) => (a.date+a.at).localeCompare(b.date+b.at));

  const DEFS = [
    { key:"ta",   lbl:"Tension artérielle", unit:"cmHg", hi:th.taHigh||16, lo:th.taLow||9 },
    { key:"puls", lbl:"Pouls",              unit:"bpm",  hi:100,           lo:50 },
    { key:"sat",  lbl:"Saturation",         unit:"%",    hi:null,          lo:th.satLow||92 },
    { key:"temp", lbl:"Température",        unit:"°C",   hi:38,            lo:35.5 },
    { key:"glyc", lbl:"Glycémie",           unit:"g/L",  hi:2.5,           lo:th.glycLow||0.7 }
  ];
  const num = (v, k) => {
    if (v == null || v === "") return null;
    if (k === "ta"){ const s = parseFloat(String(v).split("/")[0]); return isNaN(s)?null:s; }
    const n = parseFloat(String(v).replace(",",".")); return isNaN(n)?null:n;
  };
  const horsSeuil = (v, d) => {
    const n = num(v, d.key); if (n === null) return false;
    return (d.hi !== null && n >= d.hi) || (d.lo !== null && n <= d.lo);
  };

  // Courbes SVG
  let courbes = "";
  DEFS.forEach(d => {
    const pts = sorted.map(v => ({ n:num((v.consts||{})[d.key], d.key), date:v.date }))
                      .filter(x => x.n !== null);
    if (pts.length < 2) return;
    const W = 560, H = 90, PAD = 6;
    const vals = pts.map(x => x.n);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (d.hi) mx = Math.max(mx, d.hi); if (d.lo) mn = Math.min(mn, d.lo);
    const span = (mx - mn) || 1;
    const X = i => PAD + i * (W - 2*PAD) / Math.max(pts.length-1, 1);
    const Y = n => H - PAD - ((n - mn) / span) * (H - 2*PAD);
    const line = pts.map((x,i) => `${X(i).toFixed(1)},${Y(x.n).toFixed(1)}`).join(" ");
    const seuils = [
      d.hi ? `<line x1="0" y1="${Y(d.hi).toFixed(1)}" x2="${W}" y2="${Y(d.hi).toFixed(1)}" stroke="#e8a0a0" stroke-width="1" stroke-dasharray="4 3"/>` : "",
      d.lo ? `<line x1="0" y1="${Y(d.lo).toFixed(1)}" x2="${W}" y2="${Y(d.lo).toFixed(1)}" stroke="#e8a0a0" stroke-width="1" stroke-dasharray="4 3"/>` : ""
    ].join("");
    const dots = pts.map((x,i) => horsSeuil((sorted.find(v=>v.date===x.date)||{}).consts?.[d.key], d)
      ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(x.n).toFixed(1)}" r="3" fill="#a01c1c"/>` : "").join("");
    courbes += `<div class="crb-b">
      <div class="crb-t">${d.lbl} <span>(${d.unit})</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${seuils}
        <polyline points="${line}" fill="none" stroke="#005A50" stroke-width="2"/>
        ${dots}
      </svg>
      <div class="crb-x"><span>${fmtFR(pts[0].date)}</span><span>${fmtFR(pts[pts.length-1].date)}</span></div>
    </div>`;
  });

  // Tableau
  const lignes = [...sorted].reverse().map(v => {
    const c = v.consts || {};
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
    const cell = d => {
      const val = c[d.key];
      if (val == null || val === "") return "<td>—</td>";
      return `<td class="${horsSeuil(val, d)?"bad":""}">${esc(String(val))}</td>`;
    };
    return `<tr><td class="dt">${fmtFR(v.date)}${sl} ${esc(v.at||"")}</td>${DEFS.map(cell).join("")}</tr>`;
  }).join("");

  // Synthèse
  const nHors = sorted.filter(v => DEFS.some(d => horsSeuil((v.consts||{})[d.key], d))).length;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Constantes — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 header{background:#005A50;color:#fff;padding:9px 13px;margin-bottom:11px}
 header .t{font-size:12.5pt;font-weight:800}
 header .s{font-size:8.5pt;color:#a8ded2;margin-top:1px}
 .alert{background:#fdeaea;border-left:3px solid #a01c1c;padding:6px 10px;font-size:9.5pt;margin-bottom:10px}
 .crb-b{margin-bottom:9px;page-break-inside:avoid}
 .crb-t{font-size:8.5pt;color:#5a6a65;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
 .crb-t span{text-transform:none;letter-spacing:0}
 .crb-b svg{width:100%;height:22mm;background:#fafcfb;border:1px solid #e4ece9}
 .crb-x{display:flex;justify-content:space-between;font-size:7.5pt;color:#8a9a95;margin-top:1px}
 table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}
 th{background:#eef3f1;border:1px solid #c8d8d3;padding:4px 3px;font-size:8.5pt}
 td{border:1px solid #eef3f1;padding:3px;text-align:center}
 td.dt{text-align:left;color:#5a6a65;white-space:nowrap}
 td.bad{color:#a01c1c;font-weight:700}
 footer{margin-top:12px;padding-top:7px;border-top:1px solid #d8e3df;font-size:8pt;color:#8a9a95;
   display:flex;justify-content:space-between}
 @media screen{ body{background:#e8eeec;padding:12px}
   header{margin:-12px -12px 11px} }
</style></head><body>
<header>
  <div class="t">SURVEILLANCE DES CONSTANTES</div>
  <div class="s">${esc(nom)}${p.dob?` — née le ${p.dob.split("-").reverse().join("/")}`:""} · ${jours} derniers jours · ${sorted.length} relevé(s)</div>
</header>
${nHors ? `<div class="alert"><b>${nHors} relevé(s) hors seuils</b> sur la période — repérés en rouge.</div>` : ""}
${courbes || "<p style='color:#8a9a95;font-size:9.5pt'>Pas assez de relevés pour tracer une courbe.</p>"}
<table>
  <tr><th>Date</th>${DEFS.map(d=>`<th>${d.lbl.split(" ")[0]}</th>`).join("")}</tr>
  ${lignes || `<tr><td colspan="6" style="color:#8a9a95;padding:10px">Aucun relevé sur la période.</td></tr>`}
</table>
<footer>
  <span>${S.identity ? esc(whoami()) + ", IDEL" : "IDEL"} — édité le ${todayISO().split("-").reverse().join("/")}</span>
  <span>Document confidentiel — données de santé</span>
</footer>
</body></html>`;
}

/* ---------- Version texte ---------- */
function constTexte(p, vs, jours){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const L = "──────────────────────────────";
  let o = "SURVEILLANCE DES CONSTANTES\n" + nom + "\n" + jours + " derniers jours · " + vs.length + " relevé(s)\n" + L + "\n";
  [...vs].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).forEach(v => {
    const parts = constParts(v.consts);
    if (!parts.length) return;
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
    o += fmtFR(v.date) + sl + " " + (v.at||"") + " — " + parts.join(" · ") + "\n";
  });
  o += L + "\nÉdité le " + todayISO().split("-").reverse().join("/") +
       (S.identity ? " par " + whoami() : "") + "\nDocument confidentiel — données de santé.\n";
  return o;
}
