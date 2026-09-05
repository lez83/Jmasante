/* ============================================================
   EXPORT DE LA FICHE PATIENT
   ─────────────────────────────────────────────────────────
   L'IDEL choisit ce qui figure dans le document (identité,
   informations par type, plan de soins, contacts, bilans,
   rappels, documents, historique) et le format de sortie.
   Les documents cochés sont INTÉGRÉS (photos et PDF) dans les
   sorties PDF et HTML, listés en Word.
============================================================ */

const FICHE_BLOCS = [
  ["identite",   "Identité",        true ],
  ["acces",      "🔑 Accès",        true ],
  ["vigilance",  "⚠️ Vigilance",    true ],
  ["traitement", "💊 Traitement",   true ],
  ["atcd",       "📋 Antécédents",  true ],
  ["entourage",  "👨‍👩‍👧 Entourage", false],
  ["autre",      "📌 Autres infos", false],
  ["plan",       "Plan de soins",   true ],
  ["contacts",   "📞 Contacts",     true ],
  ["bilans",     "🧪 Bilans / RDV", false],
  ["rappels",    "📌 Rappels",      false],
  ["historique", "🕑 Historique",   false]
];

function sheetExportFiche(pid){
  const p = getP(pid);
  if (!p) return;
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();

  // Configuration par défaut, modifiable à la volée
  const inc = {};
  FICHE_BLOCS.forEach(([k,,def]) => inc[k] = def);
  const docsSel = new Set();          // documents cochés (aucun par défaut)
  let fmt = "pdf";

  const draw = () => {
    const docs = p.docs || [];
    openSheet(`
      <h3>🖨️ Exporter la fiche</h3>
      <p class="small muted" style="margin-bottom:13px"><b>${esc(nom)}</b> — choisis ce qui doit y figurer.</p>

      <div class="lab">Contenu</div>
      <div class="chips" style="margin-bottom:14px">
        ${FICHE_BLOCS.map(([k,l])=>`<button class="chip ${inc[k]?"on":""}" data-fb="${k}" style="font-size:12.5px">${inc[k]?"✓ ":""}${l}</button>`).join("")}
      </div>

      ${docs.length ? `
        <div class="lab">📎 Documents à intégrer</div>
        <div class="small muted" style="margin-bottom:7px">Photos et PDF sont intégrés au document ; en Word ils sont listés.</div>
        <div style="max-height:22vh;overflow-y:auto;margin-bottom:14px">
          ${docs.map(d=>`<button class="selv" data-fd="${esc(d.id)}">
            <span class="box">${docsSel.has(d.id)?"✓":""}</span>
            <span class="sv">${docIcon(d)} ${esc(d.name)}${d.date?` <span class="small muted">${fmtFR(d.date)}</span>`:""}</span>
          </button>`).join("")}
        </div>` : ""}

      <div class="lab">Format</div>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip ${fmt==="pdf" ?"on":""}" data-ff="pdf"  style="flex:1;justify-content:center">📑 PDF</button>
        <button class="chip ${fmt==="html"?"on":""}" data-ff="html" style="flex:1;justify-content:center">🌐 HTML</button>
        <button class="chip ${fmt==="docx"?"on":""}" data-ff="docx" style="flex:1;justify-content:center">📝 Word</button>
      </div>

      <button class="btn btn-primary" id="fe-go" style="width:100%">📤 Exporter / Partager</button>
      <button class="btn btn-ghost" id="fe-print" style="width:100%;margin-top:8px">🖨️ Imprimer</button>
      <button class="btn btn-ghost" id="fe-cancel" style="width:100%;margin-top:8px">Annuler</button>`);

    $$("#sheet [data-fb]").forEach(b => b.onclick = () => { inc[b.dataset.fb] = !inc[b.dataset.fb]; draw(); });
    $$("#sheet [data-ff]").forEach(b => b.onclick = () => { fmt = b.dataset.ff; draw(); });
    $$("#sheet [data-fd]").forEach(b => b.onclick = () => {
      const id = b.dataset.fd;
      docsSel.has(id) ? docsSel.delete(id) : docsSel.add(id);
      draw();
    });
    $("#fe-cancel").onclick = () => sheetPatient(pid);
    $("#fe-go").onclick    = () => buildFiche(p, inc, [...docsSel], fmt, false);
    $("#fe-print").onclick = () => buildFiche(p, inc, [...docsSel], "html", true);
  };
  draw();
}

/* ---------- Génération du document ---------- */
async function buildFiche(p, inc, docIds, fmt, printIt){
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  const base = "Fiche_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();

  // Charger les documents cochés
  const docs = [];
  for (const id of docIds){
    const meta = (p.docs||[]).find(d => d.id === id);
    if (!meta) continue;
    try {
      const data = await idbGet("doc_"+id);
      if (!data) continue;
      // Les PDF sont rendus en IMAGES : <embed src="data:..."> est bloqué
      // par le WebView Android et donnait un encart blanc.
      if ((meta.mime||"").includes("pdf") || /\.pdf$/i.test(meta.name||"")){
        const pages = await pdfToImagesGlobal(data, 8);
        docs.push({ ...meta, data, pages: pages || null });
      } else {
        docs.push({ ...meta, data });
      }
    } catch(e){ /* document illisible : on l'ignore */ }
  }

  const infosOf = type => (p.infos||[]).filter(i => i.type === type && (i.txt||"").trim());

  if (fmt === "docx"){
    const txt = ficheTexte(p, inc, docs, nom);
    try { await shareDocx(txt, base + ".docx"); }
    catch(e){ await shareText(txt, base + ".txt", "text/plain"); }
    return;
  }

  const html = ficheHtml(p, inc, docs, nom);

  if (fmt === "html" && !printIt){
    await shareText(html, base + ".html", "text/html");
    return;
  }

  // PDF et impression : aperçu DANS l'app (un onglet séparé piège
  // l'utilisateur dans le WebView Android, sans retour possible).
  showFichePreview(html, base);
}

/* ---------- Aperçu de la fiche, avec sortie toujours possible ---------- */
function showFichePreview(html, base){
  const old = document.getElementById("fichePrev");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "fichePrev";
  el.className = "fiche-prev";
  el.innerHTML = `
    <div class="fp-bar">
      <button class="fp-back" id="fp-back">← Retour</button>
      <span class="fp-t">Aperçu de la fiche</span>
    </div>
    <iframe class="fp-frame" id="fp-frame"></iframe>
    <div class="fp-actions">
      <button class="btn btn-primary" id="fp-print">🖨️ Imprimer / PDF</button>
      <button class="btn btn-ghost" id="fp-share">📤 Partager</button>
    </div>`;
  document.body.appendChild(el);

  // srcdoc plutôt qu'une URL : accepté par le WebView, contrairement à data:/blob:
  const fr = el.querySelector("#fp-frame");
  fr.srcdoc = html;

  const close = () => el.remove();
  el.querySelector("#fp-back").onclick = close;
  el.querySelector("#fp-print").onclick = () => {
    try {
      const w = fr.contentWindow;
      w.focus(); w.print();
      toast("Choisis « Enregistrer en PDF » dans la boîte d'impression 📑");
    } catch(e){ toast("Impression indisponible — utilise « Partager »", "danger"); }
  };
  el.querySelector("#fp-share").onclick = () => shareText(html, base + ".html", "text/html");
  // Sécurité : la touche retour Android ferme l'aperçu
  const onBack = ev => { if (ev.key === "Escape"){ close(); document.removeEventListener("keydown", onBack); } };
  document.addEventListener("keydown", onBack);
}

/* ---------- Rendu HTML de la fiche ---------- */
function ficheHtml(p, inc, docs, nom){
  const infosOf = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim());
  const sec = (titre, corps) => corps ? `<section><h2>${titre}</h2>${corps}</section>` : "";
  const lignes = arr => arr.map(i => `<p>${esc(i.txt).replace(/\n/g,"<br>")}</p>`).join("");

  let body = "";

  if (inc.identite){
    const age = ageOf(p.dob);
    body += sec("Identité", `<table class="kv">
      <tr><td>Nom</td><td><b>${esc(nom)}</b></td></tr>
      ${p.dob?`<tr><td>Naissance</td><td>${fmtFR(p.dob)}${age!=null?` (${age} ans)`:""}</td></tr>`:""}
      ${p.genre?`<tr><td>Sexe</td><td>${esc(p.genre)}</td></tr>`:""}
      ${p.address?`<tr><td>Adresse</td><td>${esc(p.address)}</td></tr>`:""}
      ${(p.tours||[]).length?`<tr><td>Tournée(s)</td><td>${esc(p.tours.join(" · "))}</td></tr>`:""}
      ${p.pec?`<tr><td>Prise en charge</td><td>Terminée le ${fmtFR(p.pec.end)}${p.pec.motif?" — "+esc(p.pec.motif):""}</td></tr>`:""}
    </table>`);
  }
  ["acces","vigilance","traitement","atcd","entourage","autre"].forEach(t => {
    if (!inc[t]) return;
    const arr = infosOf(t);
    if (arr.length) body += sec(infoType(t).ic + " " + infoType(t).lbl, lignes(arr));
  });
  if (inc.plan && (p.plan||[]).length)
    body += sec("Plan de soins", `<ul>${p.plan.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`);
  if (inc.contacts){
    const c = p.contacts || {};
    const rows = Object.entries(c).filter(([,v]) => (v||"").trim())
      .map(([k,v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
    if (rows) body += sec("📞 Contacts", `<table class="kv">${rows}</table>`);
  }
  if (inc.bilans && (p.bilans||[]).length)
    body += sec("🧪 Bilans / RDV", `<ul>${p.bilans.map(b=>`<li>${esc(bilanLine(b))}</li>`).join("")}</ul>`);
  if (inc.rappels){
    const rs = (S.rappels||[]).filter(r => !r.done && r.pid === p.id);
    if (rs.length) body += sec("📌 Rappels", `<ul>${rs.map(r=>
      `<li>${esc(rapType(r.type).lbl)} : ${esc(r.text||"")}${r.due?` (${fmtFR(r.due)})`:""}</li>`).join("")}</ul>`);
  }
  if (inc.historique && (p.visits||[]).length){
    const vs = [...p.visits].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).slice(0,40);
    body += sec("🕑 Historique des passages", `<ul>${vs.map(v=>{
      const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
      const sn = v.soinNotes || {};
      const soins = (v.soins||[]).map(x => sn[x] ? `${esc(x)} <i>(${esc(sn[x])})</i>` : esc(x)).join(", ");
      const cp = constParts(v.consts);
      return `<li><b>${fmtFR(v.date)}${sl} ${esc(v.at||"")}</b> — ${soins || "—"}${
        cp.length?` · ${esc(cp.join(" · "))}`:""}${v.note?`<br><i>${esc(v.note)}</i>`:""}</li>`;
    }).join("")}</ul>`);
  }
  // Documents intégrés
  if (docs.length){
    body += `<section class="docs"><h2>📎 Documents (${docs.length})</h2>` +
      docs.map(d => {
        if ((d.mime||"").startsWith("image/"))
          return `<figure><img src="${d.data}" alt="${esc(d.name)}"><figcaption>${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""}</figcaption></figure>`;
        if ((d.mime||"").includes("pdf") || /\.pdf$/i.test(d.name||"")){
          if (d.pages && d.pages.length)
            return `<figure>${d.pages.map(pg=>`<img src="${pg.dataUrl}" alt="${esc(d.name)}">`).join("")}` +
                   `<figcaption>${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""}` +
                   `${d.pages[0].total>d.pages.length?` (${d.pages.length}/${d.pages[0].total} pages)`:""}</figcaption></figure>`;
          return `<p class="doclink">${docIcon(d)} ${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""} <i>(aperçu indisponible)</i></p>`;
        }
        return `<p class="doclink">${docIcon(d)} ${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""} <i>(joint séparément)</i></p>`;
      }).join("") + `</section>`;
  }

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche — ${esc(nom)}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;line-height:1.55;margin:0;padding:22px;font-size:11pt}
 header{background:#005A50;color:#fff;padding:14px 18px;margin:-22px -22px 20px;display:flex;align-items:center;gap:12px}
 header .t{font-size:15pt;font-weight:700}
 header .s{font-size:9pt;color:#a8ded2;font-style:italic;margin-top:1px}
 h2{font-size:11.5pt;color:#005A50;border-bottom:2px solid #d8e3df;padding-bottom:4px;margin:20px 0 8px}
 section{page-break-inside:avoid}
 p{margin:5px 0}
 ul{margin:5px 0;padding-left:20px} li{margin:3px 0}
 table.kv{width:100%;border-collapse:collapse;margin:4px 0}
 table.kv td{padding:4px 8px;border-bottom:1px solid #eef3f1;vertical-align:top}
 table.kv td:first-child{color:#6b7a75;width:34%;font-size:10pt}
 figure{margin:12px 0;page-break-inside:avoid}
 figure img{max-width:100%;max-height:420px;border:1px solid #d8e3df;border-radius:6px}
 figure embed{width:100%;height:520px;border:1px solid #d8e3df;border-radius:6px}
 figcaption{font-size:9pt;color:#6b7a75;margin-top:4px}
 .doclink{font-size:10pt;color:#3a4a45}
 footer{margin-top:26px;padding-top:10px;border-top:1px solid #d8e3df;font-size:8.5pt;color:#8a9a95;text-align:center}
 @media print{ body{padding:14px} header{margin:-14px -14px 16px} }
</style></head><body>
<header>
  <svg viewBox="0 0 100 100" width="28" height="28"><g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/><ellipse cx="50" cy="30" rx="15" ry="12"/><path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/><path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/><path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g><circle cx="43" cy="29" r="3" fill="#fff"/><circle cx="57" cy="29" r="3" fill="#fff"/></svg>
  <div><div class="t">Fiche patient — ${esc(nom)}</div><div class="s">Tout est dans la cigale</div></div>
</header>
${body || "<p>Aucun élément sélectionné.</p>"}
<footer>Éditée le ${fmtFR(todayISO())} à ${nowHM()}${S.identity?` par ${esc(whoami())}`:""}<br>
JM@Santé by JmCve83 — document confidentiel, à transmettre par un canal sécurisé.</footer>
</body></html>`;
}

/* ---------- Rendu texte (base du Word) ---------- */
function ficheTexte(p, inc, docs, nom){
  const L = "──────────────────────────────";
  const infosOf = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim());
  let o = "FICHE PATIENT — " + nom + "\n" + L + "\n";

  if (inc.identite){
    const age = ageOf(p.dob);
    if (p.dob) o += "Naissance : " + fmtFR(p.dob) + (age!=null?` (${age} ans)`:"") + "\n";
    if (p.genre) o += "Sexe : " + p.genre + "\n";
    if (p.address) o += "Adresse : " + p.address + "\n";
    if ((p.tours||[]).length) o += "Tournée(s) : " + p.tours.join(" · ") + "\n";
    if (p.pec) o += "Prise en charge terminée le " + fmtFR(p.pec.end) + (p.pec.motif?" — "+p.pec.motif:"") + "\n";
    o += L + "\n";
  }
  ["acces","vigilance","traitement","atcd","entourage","autre"].forEach(t => {
    if (!inc[t]) return;
    const arr = infosOf(t);
    if (!arr.length) return;
    o += infoType(t).ic + " " + infoType(t).lbl.toUpperCase() + "\n";
    arr.forEach(i => o += "  " + i.txt.replace(/\n/g,"\n  ") + "\n");
    o += L + "\n";
  });
  if (inc.plan && (p.plan||[]).length){
    o += "PLAN DE SOINS\n" + p.plan.map(x=>"  · "+x).join("\n") + "\n" + L + "\n";
  }
  if (inc.contacts){
    const rows = Object.entries(p.contacts||{}).filter(([,v])=>(v||"").trim());
    if (rows.length){ o += "CONTACTS\n" + rows.map(([k,v])=>"  "+k+" : "+v).join("\n") + "\n" + L + "\n"; }
  }
  if (inc.bilans && (p.bilans||[]).length)
    o += "BILANS / RDV\n" + p.bilans.map(b=>"  · "+bilanLine(b)).join("\n") + "\n" + L + "\n";
  if (inc.rappels){
    const rs = (S.rappels||[]).filter(r=>!r.done && r.pid===p.id);
    if (rs.length) o += "RAPPELS\n" + rs.map(r=>"  · "+rapType(r.type).lbl+" : "+(r.text||"")+(r.due?" ("+fmtFR(r.due)+")":"")).join("\n") + "\n" + L + "\n";
  }
  if (inc.historique && (p.visits||[]).length){
    const vs = [...p.visits].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).slice(0,40);
    o += "HISTORIQUE DES PASSAGES\n";
    vs.forEach(v => {
      const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
      const sn = v.soinNotes || {};
      o += "  " + fmtFR(v.date) + sl + " " + (v.at||"") + " — "
         + ((v.soins||[]).map(x => sn[x] ? `${x} (${sn[x]})` : x).join(", ") || "—") + "\n";
      const cp = constParts(v.consts); if (cp.length) o += "     " + cp.join(" · ") + "\n";
      if (v.note) o += "     " + v.note + "\n";
    });
    o += L + "\n";
  }
  if (docs.length){
    o += "DOCUMENTS JOINTS (" + docs.length + ")\n";
    docs.forEach(d => o += "  " + docIcon(d) + " " + d.name + (d.date?" — "+fmtFR(d.date):"") + "\n");
    o += L + "\n";
  }
  o += "Éditée le " + fmtFR(todayISO()) + " à " + nowHM() + (S.identity?" par "+whoami():"") + "\n";
  o += "JM@Santé by JmCve83 — document confidentiel.\n";
  return o;
}

/* ---------- Partage d'un contenu texte ---------- */
async function shareText(content, filename, mime){
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    try {
      const { Filesystem, Share } = cap.Plugins;
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const r = await Filesystem.writeFile({ path: filename, data: b64, directory: "CACHE" });
      await Share.share({ title: filename, url: r.uri });
      return;
    } catch(e){ if ((e.message||"").match(/cancel/i)) return; console.warn("shareText:", e); }
  }
  const blob = new Blob([content], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
  toast("Fiche exportée 📤");
}

/* ---------- Word minimal à partir du texte ---------- */
async function shareDocx(text, filename){
  const paras = text.split("\n").map(l =>
    `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr/></w:body></w:document>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": doc
  };
  const enc = new TextEncoder();
  const zip = zipStore(Object.entries(files).map(([name,content]) => ({ name, data: enc.encode(content) })));
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    const { Filesystem, Share } = cap.Plugins;
    let bin = ""; zip.forEach(b => bin += String.fromCharCode(b));
    const r = await Filesystem.writeFile({ path: filename, data: btoa(bin), directory: "CACHE" });
    await Share.share({ title: filename, url: r.uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([zip], { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
  toast("Fiche Word exportée 📤");
}
