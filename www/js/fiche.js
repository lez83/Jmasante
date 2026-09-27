/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
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
    ${navHeader("Fiche", true)}
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

    bindNav(() => sheetPatient(p));   // ⚠️ « Fiche » restait inerte sans ceci
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
  /* ⚠️ Avec srcdoc l'iframe n'a PAS d'URL de base : un lien de sommaire
     « #intro » sort du cadre et recharge l'application — l'utilisateur se
     retrouve sur l'écran principal. <base target="_self"> garde la
     navigation à l'intérieur, et le script résout les ancres à la main. */
  const ancrage = `<base target="_self">
    <script>
      document.addEventListener("click", function(e){
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        e.preventDefault();
        var id = a.getAttribute("href").slice(1);
        var c = id && (document.getElementById(id) ||
                       document.querySelector('[name="' + id + '"]'));
        if (c) c.scrollIntoView({ behavior:"smooth", block:"start" });
      }, true);
    <\/script>`;
  fr.srcdoc = /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, "<head$1>" + ancrage)
    : ancrage + html;

  const close = () => el.remove();
  el.querySelector("#fp-back").onclick = close;
  el.querySelector("#fp-print").onclick = () => imprimerDocument(html, base);
  el.querySelector("#fp-share").onclick = () => shareText(html, base + ".html", "text/html");
  // Sécurité : la touche retour Android ferme l'aperçu
  const onBack = ev => { if (ev.key === "Escape"){ close(); document.removeEventListener("keydown", onBack); } };
  document.addEventListener("keydown", onBack);
}

/* ---------- Rendu HTML de la fiche ---------- */
function ficheHtml(p, inc, docs, nom){
  const infosOf = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim());
  const sec = (titre, corps) => corps ? `<section><h2>${titre}</h2>${corps}</section>` : "";
  const lignes = arr => arr.map(i => `<p>${i.type==="autre" ? "<b>"+esc(infoLabel(i).lbl)+"</b><br>" : ""}${esc(i.txt).replace(/\n/g,"<br>")}</p>`).join("");

  let body = "";

  if (inc.identite){
    const age = ageOf(p.dob);
    body += sec("Identité", `<table class="kv">
      <tr><td>Nom</td><td><b>${esc(nom)}</b></td></tr>
      ${p.dob?`<tr><td>Naissance</td><td>${fmtFR(p.dob)}${age!=null?` (${age} ans)`:""}</td></tr>`:""}
      ${p.genre?`<tr><td>Sexe</td><td>${esc(p.genre)}</td></tr>`:""}
      ${p.address?`<tr><td>Adresse</td><td>${esc(adresseComplete(p))}</td></tr>`:""}
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
    /* ⚠️ Avant : (v||"").trim() sur des objets {nom,tel} — l'export
       plantait dès qu'un contact était saisi. */
    const lg = [
      ...medecinsDe(p).filter(m=>m.nom||m.tel).map(m => [medLabel(m), contactTexte(m)]),
      ...entourageDe(p).filter(e=>e.nom||e.tel).map(e => [(e.lien||"Entourage")
          + (e.prevenir?" · à prévenir":"") + (e.confiance?" · personne de confiance":""), contactTexte(e)]),
      ...[["pharma","Pharmacie"],["cabinet","Cabinet titulaire"]]
          .filter(([k]) => ((p.contacts||{})[k]||{}).nom || ((p.contacts||{})[k]||{}).tel)
          .map(([k,l]) => [l, contactTexte(p.contacts[k])]),
    ];
    if (lg.length) body += sec("📞 Contacts", `<table class="kv">${lg.map(([k,v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`);
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
    if (adresseComplete(p)) o += "Adresse : " + adresseComplete(p) + "\n";
    if ((p.tours||[]).length) o += "Tournée(s) : " + p.tours.join(" · ") + "\n";
    if (p.pec) o += "Prise en charge terminée le " + fmtFR(p.pec.end) + (p.pec.motif?" — "+p.pec.motif:"") + "\n";
    o += L + "\n";
  }
  ["acces","vigilance","traitement","atcd","entourage","autre"].forEach(t => {
    if (!inc[t]) return;
    const arr = infosOf(t);
    if (!arr.length) return;
    o += infoType(t).ic + " " + infoType(t).lbl.toUpperCase() + "\n";
    arr.forEach(i => o += (i.type==="autre" ? "  " + infoLabel(i).lbl + " :\n" : "")
                        + "  " + i.txt.replace(/\n/g,"\n  ") + "\n");
    o += L + "\n";
  });
  if (inc.plan && (p.plan||[]).length){
    o += "PLAN DE SOINS\n" + p.plan.map(x=>"  · "+x).join("\n") + "\n" + L + "\n";
  }
  if (inc.contacts){
    /* ⚠️ Avant : (v||"").trim() sur des objets {nom,tel} — l'export
       plantait dès qu'un contact était saisi. */
    const lg = [
      ...medecinsDe(p).filter(m=>m.nom||m.tel).map(m => [medLabel(m), contactTexte(m)]),
      ...entourageDe(p).filter(e=>e.nom||e.tel).map(e => [(e.lien||"Entourage")
          + (e.prevenir?" · à prévenir":"") + (e.confiance?" · personne de confiance":""), contactTexte(e)]),
      ...[["pharma","Pharmacie"],["cabinet","Cabinet titulaire"]]
          .filter(([k]) => ((p.contacts||{})[k]||{}).nom || ((p.contacts||{})[k]||{}).tel)
          .map(([k,l]) => [l, contactTexte(p.contacts[k])]),
    ];
    if (lg.length){ o += "CONTACTS\n" + lg.map(([k,v]) => "  " + k + " : " + v).join("\n") + "\n" + L + "\n"; }
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

/* ============================================================
   IMPRESSION
   ─────────────────────────────────────────────────────────
   ⚠️ Le WebView Android n'implémente PAS window.print() : l'appel
   ne fait rien et ne lève aucune erreur. Le bouton restait donc
   muet dans l'app installée, alors qu'il marchait en navigateur.

   Dans l'app : on écrit le document sur l'appareil et on l'ouvre
   avec le système, qui propose alors ses imprimantes et
   « Enregistrer en PDF ».
   En navigateur : window.print() convient.
============================================================ */
async function imprimerDocument(html, base){
  const cap = window.Capacitor;
  const natif = cap && cap.isNativePlatform && cap.isNativePlatform();

  if (!natif){
    // Navigateur : une fenêtre dédiée s'imprime mieux qu'une iframe
    try {
      const w = window.open("", "_blank");
      if (w){
        w.document.write(html); w.document.close();
        w.focus();
        setTimeout(() => { try { w.print(); } catch(e){} }, 400);
        toast("Choisis « Enregistrer en PDF » dans la boîte d'impression 📑");
        return;
      }
      const fr = document.querySelector("#fp-frame");
      if (fr && fr.contentWindow){ fr.contentWindow.focus(); fr.contentWindow.print(); return; }
    } catch(e){ logIncident("print", "Impression navigateur impossible", e); }
    toast("Impression indisponible — utilise « Partager »", "danger");
    return;
  }

  /* Android : passer par le système. On écrit le HTML puis on
     l'ouvre — le service d'impression prend le relais. */
  const fname = (base || "document") + ".html";
  try {
    const { Filesystem } = cap.Plugins;
    const f = await Filesystem.writeFile({
      path: fname, data: html, directory: "CACHE", encoding: "utf8" });
    const opener = cap.Plugins.FileOpener;
    if (opener && f && f.uri){
      await opener.open({ filePath:f.uri, contentType:"text/html" });
      toast("Choisis « Imprimer » dans le menu qui s'ouvre 🖨️");
      return;
    }
    // Sans FileOpener : le partage permet au moins d'atteindre une imprimante
    if (cap.Plugins.Share && f && f.uri){
      await cap.Plugins.Share.share({ title:"Imprimer", url:f.uri });
      return;
    }
  } catch(e){
    if (!(e && (e.message||"").match(/cancel/i)))
      logIncident("print", "Impression Android impossible", e);
  }
  toast("Impression indisponible ici — utilise « Partager » 📤", "danger");
}

/* ============================================================
   EXPORT DU DOSSIER D'UN PATIENT (droit d'accès — RGPD)
   ─────────────────────────────────────────────────────────
   Un patient a le droit d'obtenir TOUT ce que tu détiens sur lui, dans
   un format lisible et réutilisable. Ce n'est pas la fiche imprimable —
   celle-ci choisit ce qu'elle montre. Ici on ne choisit rien : tout y est.

   Deux fichiers au choix :
     · LISIBLE (HTML)  → ce que le patient lira
     · DONNÉES (JSON)  → format réutilisable, pour transmettre à un
                         confrère ou à un autre logiciel (portabilité)

   ⚠️ Le fichier sort EN CLAIR : c'est le but, il est destiné au patient.
   Rappelé à l'écran, et à remettre en main propre ou par un canal sûr.
============================================================ */
async function sheetExportDossier(pid){
  const p = getP(pid); if (!p) return;
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  let fmt = "html", avecDocs = true;

  const compte = () => ({
    visites: (p.visits||[]).length,
    plaies:  (p.plaies||[]).length,
    docs:    (p.docs||[]).length,
    infos:   (p.infos||[]).length,
    bilans:  (p.bilans||[]).length
  });

  const draw = () => {
    const c = compte();
    openSheet(`
      ${navHeader("Fiche", true)}
      <h3>📤 Remettre son dossier au patient</h3>
      <p class="small muted" style="margin-bottom:12px"><b>${esc(nom)}</b> — tout ce que l'application détient sur cette personne.</p>

      <div class="rowlab vi"><span>Contenu du dossier</span><i></i></div>
      <div class="rowbox vi" style="display:block;margin-bottom:12px">
        <p class="small" style="margin:0">Identité et contacts · ${c.infos} information(s) · traitement ·
        ${c.plaies} plaie(s) avec leur suivi · ${c.visites} passage(s) · ${c.bilans} bilan(s) ·
        ${c.docs} document(s)</p>
      </div>

      <div class="lab">Format</div>
      <div class="chips" style="margin-bottom:12px">
        <button class="chip ${fmt==="html"?"on":""}" data-xf="html" style="font-size:12.5px">📄 Lisible (HTML)</button>
        <button class="chip ${fmt==="json"?"on":""}" data-xf="json" style="font-size:12.5px">🗂 Données (JSON)</button>
      </div>
      <p class="small muted" style="margin-bottom:12px">${fmt==="html"
        ? "Un document à ouvrir dans un navigateur, ou à imprimer en PDF. C'est ce que le patient lira."
        : "Le format réutilisable : un confrère ou un autre logiciel peut le relire. C'est ce qu'exige le droit à la portabilité."}</p>

      <label class="screl" style="margin-bottom:12px">
        <input type="checkbox" id="xd-docs" ${avecDocs?"checked":""}>
        <span>Joindre les documents (ordonnances, comptes rendus, photos)</span>
      </label>

      <div class="warn">Ce fichier sort <b>en clair</b> : c'est son but, il est destiné à la personne concernée.
      Remets-le en main propre, ou par un canal que tu juges sûr.</div>

      <button class="btn btn-primary" id="xd-go" style="width:100%;margin-top:12px">📤 Produire le dossier</button>`);
    bindNav();
    $$("#sheet [data-xf]").forEach(b => b.onclick = () => { fmt = b.dataset.xf; draw(); });
    { const c2 = $("#xd-docs"); if (c2) c2.onchange = () => { avecDocs = c2.checked; }; }
    { const g = $("#xd-go"); if (g) g.onclick = () => produireDossier(p, fmt, avecDocs); }
  };
  draw();
}

async function produireDossier(p, fmt, avecDocs){
  toast("Préparation du dossier…");
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  /* ⚠️ Les accents ne sont pas remplacés par « _ » mais TRANSPOSÉS :
     « Dossier_D_mo-Martin_Ren_e » est illisible pour le patient qui
     reçoit le fichier. */
  const sansAccent = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = "Dossier_" + sansAccent(p.nom.replace("Demo-","") + "_" + p.prenom)
                 .replace(/[^\w-]/g,"_").replace(/_+/g,"_")
             + "_" + new Date().toISOString().slice(0,10);

  /* Les contenus des documents vivent hors de l'état (clés doc_<id>) */
  const contenus = {};
  if (avecDocs){
    for (const d of (p.docs||[])){
      try { const data = await idbGet("doc_"+d.id); if (data) contenus[d.id] = data; } catch(e){}
    }
  }

  if (fmt === "json"){
    const paquet = {
      _format: "JM@Santé — dossier patient (droit d'accès RGPD)",
      _date: new Date().toISOString(),
      patient: p,
      documents: avecDocs ? contenus : "non joints"
    };
    await livrerDossier(base + ".json", JSON.stringify(paquet, null, 2), "application/json");
    return;
  }

  /* ── Version lisible ── */
  const l = (t, v) => v ? `<tr><th>${esc(t)}</th><td>${esc(String(v))}</td></tr>` : "";
  const sect = (t, c) => c ? `<h2>${esc(t)}</h2>${c}` : "";
  const T = p.traitement || {};
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Dossier — ${esc(nom)}</title><style>
body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:820px;margin:0 auto;padding:24px;color:#1a2420;line-height:1.6}
h1{font-size:24px;margin:0 0 4px} h2{font-size:17px;margin:26px 0 10px;padding-bottom:5px;border-bottom:2px solid #2BB3A3;color:#177f74}
table{width:100%;border-collapse:collapse;margin-bottom:10px} th{text-align:left;width:190px;vertical-align:top;padding:5px 8px 5px 0;color:#55635e;font-weight:600}
td{padding:5px 0;border-bottom:1px solid #eceeed} ul{margin:6px 0;padding-left:20px} li{margin:3px 0}
.entete{background:#f4f8f7;border-left:4px solid #2BB3A3;padding:12px 16px;border-radius:0 8px 8px 0;margin-bottom:18px;font-size:14px}
.pied{margin-top:34px;padding-top:12px;border-top:1px solid #dde3e1;font-size:12px;color:#77837e}
img{max-width:320px;border-radius:8px;margin:6px 0;display:block}
</style></head><body>
<h1>Dossier de soins — ${esc(nom)}</h1>
<p class="entete">Ce document réunit l'ensemble des informations enregistrées dans l'application
JM@Santé au ${esc(fmtFR(new Date().toISOString().slice(0,10)))}. Il vous est remis à votre demande,
au titre de votre droit d'accès à vos données.</p>

${sect("Identité", `<table>
  ${l("Nom", p.nom.replace("Demo-",""))}${l("Prénom", p.prenom)}${l("Date de naissance", p.dob ? fmtFR(p.dob) : "")}
  ${l("Adresse", p.address)}${l("Téléphone mobile", (p.tel||{}).mobile)}${l("Téléphone fixe", (p.tel||{}).fixe)}
  ${l("Numéro de sécurité sociale", p.nir)}</table>`)}

${sect("Médecins et entourage", ((p.medecins||[]).length || (p.entourage||[]).length) ? `<ul>
  ${(p.medecins||[]).map(m => `<li>${esc(m.spec||"médecin")} : ${esc(m.nom||"")} ${esc(m.tel||"")}</li>`).join("")}
  ${(p.entourage||[]).map(e => `<li>${esc(e.lien||"proche")} : ${esc(e.nom||"")} ${esc(e.tel||"")}</li>`).join("")}
</ul>` : "")}

${sect("Informations du dossier", (p.infos||[]).length ? `<ul>
  ${(p.infos||[]).map(i => `<li><b>${esc(i.rub||i.type||"note")}</b> — ${esc(i.txt||"")}</li>`).join("")}</ul>` : "")}

${sect("Traitement", (T.lignes||[]).length ? `<ul>
  ${(T.lignes||[]).map(x => `<li>${esc(x.nom||"")} ${x.sibesoin ? "— si besoin"
    : "— matin " + (x.m||0) + " · midi " + (x.mi||0) + " · soir " + (x.s||0) + " · coucher " + (x.c||0)}</li>`).join("")}
</ul>` : "")}

${sect("Plaies et pansements", (p.plaies||[]).length ? (p.plaies||[]).map(pl => `
  <h3 style="font-size:15px;margin:14px 0 6px">${esc(plaieNom(pl))}</h3>
  <table>${l("Localisation", pl.loc)}${l("Depuis le", pl.depuis ? fmtFR(pl.depuis) : "")}
  ${l("Stade", pl.stade)}${l("Mesures", pl.mesures)}
  ${l("Cicatrisée le", pl.cicatriseeLe ? fmtFR(pl.cicatriseeLe) : "")}</table>
  ${(pl.suivi||[]).length ? `<ul>${(pl.suivi||[]).map(n =>
    `<li><b>${esc(fmtFR(n.date))}</b> — ${esc(n.txt||"")}${n.mesures?" ("+esc(n.mesures)+")":""}</li>`).join("")}</ul>` : ""}
`).join("") : "")}

${sect("Passages", (p.visits||[]).length ? `<ul>${
  [...(p.visits||[])].sort((a,b)=>String(b.date+b.at).localeCompare(a.date+a.at)).map(v => {
    const c = v.consts||{}; const cs = [];
    if(c.ta)cs.push("TA "+c.ta); if(c.temp)cs.push("T° "+c.temp); if(c.sat)cs.push("Sat "+c.sat+"%");
    if(c.puls)cs.push("Pouls "+c.puls); if(c.glyc)cs.push("Glycémie "+c.glyc); if(c.douleur)cs.push("Douleur "+c.douleur);
    return `<li><b>${esc(fmtFR(v.date))} ${esc(v.at||"")}</b> — ${esc((v.soins||[]).join(", "))}` +
           (cs.length ? `<br><i>${esc(cs.join(" · "))}</i>` : "") +
           (v.note ? `<br>${esc(v.note)}` : "") + `</li>`;
  }).join("")}</ul>` : "")}

${sect("Bilans et rendez-vous", (p.bilans||[]).length ? `<ul>
  ${(p.bilans||[]).map(b => `<li>${esc(b.type||"")} — ${esc(b.date ? fmtFR(b.date) : "")} ${esc(b.statut||"")}</li>`).join("")}</ul>` : "")}

${sect("Documents", (p.docs||[]).length ? `<ul>${(p.docs||[]).map(d => {
    const img = avecDocs && contenus[d.id] && /^image\//.test(d.mime||"");
    return `<li>${esc(d.type||"document")}${d.precision?" — "+esc(d.precision):""} · ${esc(d.date?fmtFR(d.date):"")}
      ${img ? `<img src="${contenus[d.id]}" alt="${esc(d.name||"")}">` : ""}</li>`;
  }).join("")}</ul>${avecDocs ? "" : "<p><i>Les documents n'ont pas été joints à ce dossier.</i></p>"}` : "")}

<p class="pied">Produit par JM@Santé le ${esc(fmtFR(new Date().toISOString().slice(0,10)))}.
Les données de ce dossier sont enregistrées sur l'appareil du professionnel, sans hébergement extérieur.
Pour toute demande de rectification ou de suppression, adressez-vous à lui directement.</p>
</body></html>`;
  await livrerDossier(base + ".html", html, "text/html");
}

/* Enregistrer puis proposer le partage — même voie que les autres exports */
async function livrerDossier(nomFichier, contenu, mime){
  try {
    const ou = await saveToDevice(nomFichier, contenu, { mime });
    toast("Dossier enregistré — " + ou);
  } catch(e){
    /* Pas d'enregistrement possible (navigateur) : téléchargement direct */
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([contenu], { type:mime }));
      a.download = nomFichier; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Dossier téléchargé");
    } catch(e2){ toast("Export impossible", "danger"); logIncident("dossier", "Export impossible", e2); }
  }
}
