/* ============================================================
   FICHE DE TRAITEMENT STRUCTURÉE
   ─────────────────────────────────────────────────────────
   Une ligne par médicament, quatre moments de prise, plus les
   traitements « si besoin ». Remplace avantageusement le texte
   libre : le DLU affiche un vrai tableau, la détection des
   anticoagulants devient fiable, et la fiche s'imprime.

   Modèle : p.traitement = {
     lignes: [{ id, nom, m, mi, s, c, sibesoin, forme, note }],
     maj: "YYYY-MM-DD", prescripteur: "" }

   L'ancien texte libre (info de type « traitement ») est
   CONSERVÉ tel quel tant que l'IDEL n'a pas ressaisi.
============================================================ */

const FORMES = [
  ["cp",   "💊", "Comprimé"],
  ["inj",  "💉", "Injectable"],
  ["got",  "🥄", "Gouttes"],
  ["patch","🩹", "Patch"],
  ["aut",  "📦", "Autre"]
];
function formeIc(k){ const f = FORMES.find(x => x[0] === k); return f ? f[1] : ""; }

/* Molécules à signaler — sert au DLU et à la fiche imprimée */
const RX_ANTICOAG = /anticoag|eliquis|xarelto|previscan|coumadin|sintrom|kard[ée]gic|lovenox|innohep|apixaban|rivaroxaban|warfarine|h[ée]parine|plavix|clopidogrel|aspirine|aspegic/i;

function traitLignes(p){ return ((p.traitement||{}).lignes) || []; }

/* Texte compact pour la relève, le DLU et l'export de fiche.
   Reprend le texte libre si la fiche structurée est vide. */
function traitTexte(p){
  const L = traitLignes(p);
  if (!L.length){
    return (p.infos||[]).filter(i => i.type === "traitement" && (i.txt||"").trim())
                        .map(i => i.txt.trim()).join(" · ");
  }
  return L.map(l => {
    const pos = l.sibesoin ? "si besoin"
              : [l.m, l.mi, l.s, l.c].map(x => x || "0").join("-");
    return l.nom + " (" + pos + ")";
  }).join(" · ");
}

/* ---------- Écran principal ---------- */
function sheetTraitement(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable", "danger"); return; }
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();

  const draw = () => {
    const T = p.traitement || {};
    const L = T.lignes || [];
    const reg = L.filter(l => !l.sibesoin);
    const sib = L.filter(l => l.sibesoin);
    const ancien = (p.infos||[]).filter(i => i.type === "traitement" && (i.txt||"").trim());

    const ligne = l => `<div class="tr-r" data-tid="${esc(l.id)}">
      <span class="tr-n">${esc(l.nom)}${l.forme?` <span class="tr-f">${formeIc(l.forme)}</span>`:""}${
        RX_ANTICOAG.test(l.nom) ? ` <span class="tr-w">anticoag.</span>` : ""}
        ${l.note?`<span class="tr-note">${esc(l.note)}</span>`:""}</span>
      ${l.sibesoin
        ? `<span class="tr-sb">si besoin</span>`
        : ["m","mi","s","c"].map(k => `<span class="tr-d ${l[k]?"on":""}">${l[k]?esc(String(l[k])):"—"}</span>`).join("")}
      <button class="tr-e" data-ted="${esc(l.id)}" title="Modifier">✏️</button>
    </div>`;

    openSheet(`
      ${navHeader("Fiche", true)}
      <h3 style="margin-bottom:2px">💊 Fiche de traitement</h3>
      <p class="small muted" style="margin-bottom:12px"><b>${esc(nom)}</b>${
        T.maj ? ` · mise à jour le ${fmtFR(T.maj)}` : ""}</p>

      ${ancien.length && !L.length ? `<div class="tip" style="margin-bottom:12px">
        <b>Traitement actuellement en texte libre :</b><br>
        <span class="small">${ancien.map(i=>esc(i.txt)).join("<br>")}</span>
        <p class="small muted" style="margin:7px 0 0">Ressaisis-le ci-dessous pour obtenir un tableau imprimable. Le texte reste en place tant que tu ne l'effaces pas.</p>
      </div>` : ""}

      ${reg.length ? `<div class="trgrid">
        <div class="tr-h">
          <span class="tr-n">Médicament</span>
          <span class="tr-d">M</span><span class="tr-d">Mi</span><span class="tr-d">S</span><span class="tr-d">C</span>
          <span class="tr-e"></span>
        </div>
        ${reg.map(ligne).join("")}
      </div>` : `<p class="small muted" style="padding:10px 0">Aucun médicament — ajoute le premier ci-dessous.</p>`}

      ${sib.length ? `<div class="rowlab am" style="margin-top:14px"><span>Si besoin</span><i></i></div>
        <div class="trgrid">${sib.map(ligne).join("")}</div>` : ""}

      <button class="btn btn-ghost" id="tr-add" style="width:100%;margin-top:10px;border-style:dashed">＋ Ajouter un médicament</button>

      <div class="field" style="margin-top:14px"><span class="lab">Prescripteur <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></span>
        <input id="tr-presc" placeholder="Dr Blanc — ordonnance du 03/09" value="${esc(T.prescripteur||"")}"></div>

      ${L.length ? `<div class="rowb" style="margin-top:12px">
        <button class="btn btn-ghost" id="tr-print">🖨️ Imprimer</button>
        <button class="btn btn-ghost" id="tr-share">📤 Partager</button>
      </div>` : ""}`);

    bindNav(() => sheetPatient(p));
    $$("#sheet [data-ted]").forEach(b => b.onclick = () => editLigne(b.dataset.ted));
    $("#tr-add").onclick = () => editLigne(null);
    { const e = $("#tr-presc"); if (e) e.onchange = () => {
      p.traitement = p.traitement || { lignes:[] };
      p.traitement.prescripteur = e.value.trim(); save(); }; }
    { const b = $("#tr-print"); if (b) b.onclick = () => sortirTrait(p, "print"); }
    { const b = $("#tr-share"); if (b) b.onclick = () => sortirTrait(p, "share"); }
  };

  /* ---------- Saisie d'une ligne ---------- */
  const editLigne = (tid) => {
    const L = traitLignes(p);
    const l = tid ? L.find(x => x.id === tid) : { id:uid(), nom:"", m:"", mi:"", s:"", c:"", sibesoin:false, forme:"cp", note:"" };
    if (!l) return;
    let forme = l.forme || "cp";
    let sib = !!l.sibesoin;

    const drawEdit = () => {
      openSheet(`
        ${navHeader("Traitement", false)}
        <h3 style="margin-bottom:12px">${tid ? "Modifier" : "Nouveau médicament"}</h3>

        <div class="field"><span class="lab">Médicament et dosage</span>
          <input id="te-nom" placeholder="Eliquis 2,5 mg" value="${esc(l.nom)}" autocapitalize="sentences"></div>

        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${sib?"":"on"}" id="te-reg" style="flex:1;justify-content:center">Posologie fixe</button>
          <button class="chip ${sib?"on":""}" id="te-sib" style="flex:1;justify-content:center">Si besoin</button>
        </div>

        ${sib ? `<p class="small muted" style="margin-bottom:12px">Traitement conditionnel — précise la conduite dans les remarques (« si douleur &gt; 4 », « si T° &gt; 38 »).</p>`
        : `<div class="rowlab ac"><span>Posologie</span><i></i></div>
      <div class="rowbox ac" style="display:block;margin-bottom:12px">
        <div class="teposo">
          ${[["m","Matin"],["mi","Midi"],["s","Soir"],["c","Coucher"]].map(([k,lbl])=>`
            <div><span>${lbl}</span>
              <input id="te-${k}" inputmode="decimal" placeholder="0" value="${esc(l[k]||"")}"></div>`).join("")}
        </div>
        <p class="small muted" style="margin:5px 0 12px">Laisse vide ou 0 si aucune prise à ce moment.</p>`}

        </div><div class="rowlab bl"><span>Forme</span><i></i></div>
      <div class="rowbox bl" style="display:block;margin-bottom:12px">
        <div class="chips" style="margin-bottom:12px">
          ${FORMES.map(([k,ic,lbl])=>`<button class="chip ${forme===k?"on":""}" data-tf="${k}" style="font-size:11.5px">${ic} ${lbl}</button>`).join("")}
        </div>

        </div><div class="field"><span class="lab">Remarques <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></span>
          <input id="te-note" placeholder="À jeun · pendant le repas · surveiller…" value="${esc(l.note||"")}"></div>

        <div class="uiact" style="margin-top:6px">
          <button class="btn btn-ghost" id="te-cancel">Annuler</button>
          <button class="btn btn-primary" id="te-ok">${tid?"Enregistrer":"Ajouter"}</button>
        </div>
        ${tid ? `<button class="btn" id="te-del" style="width:100%;margin-top:8px;background:transparent;border-color:var(--danger);color:var(--danger)">🗑 Retirer ce médicament</button>` : ""}`);

      bindNav(draw);
      $$("#sheet [data-tf]").forEach(b => b.onclick = () => { forme = b.dataset.tf; grab(); drawEdit(); });
      $("#te-reg").onclick = () => { sib = false; grab(); drawEdit(); };
      $("#te-sib").onclick = () => { sib = true;  grab(); drawEdit(); };
      $("#te-cancel").onclick = draw;
      $("#te-ok").onclick = () => {
        grab();
        if (!l.nom.trim()){ toast("Indique au moins le nom du médicament"); return; }
        p.traitement = p.traitement || { lignes:[] };
        p.traitement.lignes = p.traitement.lignes || [];
        l.forme = forme; l.sibesoin = sib;
        if (sib){ l.m = l.mi = l.s = l.c = ""; }
        if (!tid) p.traitement.lignes.push(l);
        p.traitement.maj = todayISO();
        if (typeof logChange==="function") logChange("update","patient", p.id, { traitement:p.traitement });
        save(true); draw();
        toast(tid ? "Médicament modifié 💊" : "Médicament ajouté 💊");
      };
      { const b = $("#te-del"); if (b) b.onclick = async () => {
        if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Retirer ce médicament ?", sub:esc(l.nom), oui:"🗑 Retirer" })) return;
        p.traitement.lignes = (p.traitement.lignes||[]).filter(x => x.id !== tid);
        p.traitement.maj = todayISO(); save(true); draw();
        toast("Médicament retiré");
      }; }
    };
    const grab = () => {
      l.nom  = ($("#te-nom")?.value || "").trim();
      l.note = ($("#te-note")?.value || "").trim();
      if (!sib) ["m","mi","s","c"].forEach(k => l[k] = ($("#te-"+k)?.value || "").trim());
    };
    drawEdit();
  };

  draw();
}

/* ---------- Fiche imprimable ---------- */
function sortirTrait(p, mode){
  const html = traitHtml(p);
  const base = "Traitement_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();
  if (mode === "share"){ shareText(html, base + ".html", "text/html"); return; }
  showFichePreview(html, base);
  if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
}

function traitHtml(p){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const T = p.traitement || {};
  const L = T.lignes || [];
  const reg = L.filter(x => !x.sibesoin), sib = L.filter(x => x.sibesoin);
  const vig = (p.infos||[]).filter(i => i.type === "vigilance" && (i.txt||"").trim())
                           .map(i => i.txt.trim()).join(" · ");
  const med = (p.contacts||{}).med;

  const row = l => `<tr>
    <td class="nm">${RX_ANTICOAG.test(l.nom)?`<b>${esc(l.nom)}</b>`:esc(l.nom)}${l.forme&&l.forme!=="cp"?` ${formeIc(l.forme)}`:""}</td>
    ${l.sibesoin
      ? `<td colspan="4" class="sb">si besoin</td>`
      : ["m","mi","s","c"].map(k => `<td class="d">${l[k] ? `<b>${esc(String(l[k]))}</b>` : "—"}</td>`).join("")}
    <td class="rm">${esc(l.note||"")}${RX_ANTICOAG.test(l.nom)?`<span class="ac">Anticoagulant — surveiller les saignements</span>`:""}</td>
  </tr>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Traitement — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 .hd{ display:flex;justify-content:space-between;align-items:flex-end;
      border-bottom:2px solid #005A50;padding-bottom:5px;margin-bottom:9px }
 .hd .t{ font-size:12.5pt;font-weight:800;color:#005A50;letter-spacing:.02em }
 .hd .id{ font-size:11pt;margin-top:2px }
 .hd .mj{ font-size:8.5pt;color:#6b7a75;text-align:right;white-space:nowrap }
 table{ width:100%;border-collapse:collapse;font-size:10pt;table-layout:fixed }
 th{ background:#eef3f1;border:1px solid #c8d8d3;padding:5px 4px;font-size:9pt }
 th.nm{ text-align:left }
 td.nm{ word-break:normal;overflow-wrap:break-word }
 td{ border:1px solid #dde7e3;padding:6px 5px;vertical-align:top }
 td.nm{ width:26% }
 td.d{ text-align:center;width:8% }
 td.d b{ font-size:11pt }
 td.sb{ text-align:center;color:#a06a10;font-style:italic }
 td.rm{ width:26%;font-size:9pt;color:#3a4a45 }
 td.rm .ac{ display:block;color:#a01c1c;font-size:8.5pt;margin-top:2px }
 tr:nth-child(even) td{ background:#fafcfb }
 h2{ font-size:10pt;color:#005A50;margin:14px 0 5px;text-transform:uppercase;letter-spacing:.04em }
 .vig{ background:#fdeaea;border-left:3px solid #a01c1c;padding:6px 10px;font-size:9.5pt;margin-top:11px }
 footer{ margin-top:12px;padding-top:7px;border-top:1px solid #d8e3df;
         font-size:8pt;color:#8a9a95;text-align:center }
 @media screen{ body{background:#e8eeec;padding:14px} }
</style></head><body>
<div class="hd">
  <div>
    <div class="t">FICHE DE TRAITEMENT</div>
    <div class="id"><b>${esc(nom)}</b>${p.dob?` — née le ${p.dob.split("-").reverse().join("/")}`:""}</div>
  </div>
  <div class="mj">${T.maj?`Mise à jour<br>${T.maj.split("-").reverse().join("/")}`:""}</div>
</div>

${reg.length ? `<table>
  <tr><th class="nm">Médicament</th><th>Matin</th><th>Midi</th><th>Soir</th><th>Coucher</th><th>Précisions</th></tr>
  ${reg.map(row).join("")}
</table>` : "<p>Aucun traitement à posologie fixe.</p>"}

${sib.length ? `<h2>Si besoin</h2><table>
  <tr><th class="nm">Médicament</th><th colspan="4">Conduite</th><th>Précisions</th></tr>
  ${sib.map(row).join("")}
</table>` : ""}

${vig ? `<div class="vig"><b>⚠ ${esc(vig)}</b>${med?` — prescripteur : ${esc(med.nom||"")}${med.tel?", "+esc(med.tel):""}`:""}</div>`
      : (med?`<p style="font-size:9pt;color:#5a6a65;margin-top:10px">Prescripteur : ${esc(med.nom||"")}${med.tel?" — "+esc(med.tel):""}</p>`:"")}
${T.prescripteur?`<p style="font-size:9pt;color:#5a6a65;margin-top:6px">${esc(T.prescripteur)}</p>`:""}

<footer>
  Document établi par ${S.identity ? esc(whoami()) + ", IDEL" : "l'IDEL"} le ${todayISO().split("-").reverse().join("/")}<br>
  Ne remplace pas la prescription médicale — données de santé, document confidentiel
</footer>
</body></html>`;
}
