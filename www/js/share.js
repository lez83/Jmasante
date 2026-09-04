/* ============================================================
   [MODULE DE PARTAGE]
   En version Capacitor, shareFiles()
     basculera sur le plugin @capacitor/share sans rien changer
     d'autre.
============================================================ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n=0; n<256; n++){ let c=n; for (let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); t[n]=c; }
  return t;
})();
function crc32(u8){
  let c = 0xFFFFFFFF;
  for (let i=0;i<u8.length;i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/* ZIP sans compression (method 0) — suffisant et universellement lisible */
function zipStore(entries){ // entries: [{name, data:Uint8Array}]
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const u16 = v => new Uint8Array([v&255, (v>>8)&255]);
  const u32 = v => new Uint8Array([v&255, (v>>8)&255, (v>>16)&255, (v>>>24)&255]);
  entries.forEach(e => {
    const name = enc.encode(e.name), crc = crc32(e.data), sz = e.data.length;
    const head = [u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                  u32(crc), u32(sz), u32(sz), u16(name.length), u16(0)];
    chunks.push(...head, name, e.data);
    central.push({name, crc, sz, offset});
    offset += head.reduce((n,a)=>n+a.length,0) + name.length + sz;
  });
  const cdStart = offset;
  central.forEach(c => {
    chunks.push(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(c.crc), u32(c.sz), u32(c.sz), u16(c.name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(c.offset), c.name);
    offset += 46 + c.name.length;
  });
  chunks.push(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(offset - cdStart), u32(cdStart), u16(0));
  let total = 0; chunks.forEach(c => total += c.length);
  const out = new Uint8Array(total); let p = 0;
  chunks.forEach(c => { out.set(c, p); p += c.length; });
  return out;
}
function textToDocx(text){
  const enc = new TextEncoder();
  const xml = s => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const RPR = '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr>';
  const paras = text.split("\n").map(l =>
    `<w:p><w:pPr>${RPR}</w:pPr><w:r>${RPR}<w:t xml:space="preserve">${xml(l)}</w:t></w:r></w:p>`).join("");
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr/></w:body></w:document>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return zipStore([
    { name:"[Content_Types].xml", data: enc.encode(contentTypes) },
    { name:"_rels/.rels", data: enc.encode(rels) },
    { name:"word/document.xml", data: enc.encode(document) }
  ]);
}
/* DOCX avec annexes : images intégrées, signets et hyperliens internes */
function docxWithAnnexes(text, annexData){
  // annexData : [{ num, name, patientLabel, mime, dataUrl (images only) }]
  const enc = new TextEncoder();
  const xml = t => String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr>';
  const RPR_B = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="24"/><w:color w:val="005A50"/></w:rPr>';
  const RPR_LINK = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/><w:color w:val="1450DC"/><w:u w:val="single"/></w:rPr>';

  const P  = (t)     => `<w:p><w:r>${RPR}<w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`;
  const PB = (t)     => `<w:p><w:r>${RPR_B}<w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`;
  const PLINK = (t, anchor) => `<w:p><w:hyperlink w:anchor="${anchor}"><w:r>${RPR_LINK}<w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:hyperlink></w:p>`;
  const BOOKMARK = (id, name, content) => `<w:p><w:bookmarkStart w:id="${id}" w:name="${name}"/><w:r>${RPR_B}<w:t xml:space="preserve">${xml(content)}</w:t></w:r><w:bookmarkEnd w:id="${id}"/></w:p>`;

  // Images : chaque annexe image ajoute un fichier media + une relation
  const media = [], imgRels = [];
  let relIdx = 10;
  const IMG = (annexNum, dataUrl, mime) => {
    const ext = mime.includes("png") ? "png" : "jpeg";
    const fname = `image_annexe${annexNum}.${ext}`;
    const rid = "rIdImg"+(relIdx++);
    media.push({ name:"word/media/"+fname, data: dataUrlToU8(dataUrl) });
    imgRels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fname}"/>`);
    // 4200000 EMU ≈ 11 cm de large, 3150000 ≈ 8,3 cm de haut
    return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
      <wp:extent cx="4200000" cy="3150000"/><wp:docPr id="${annexNum}" name="Annexe${annexNum}"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr><pic:cNvPr id="${annexNum}" name="Annexe${annexNum}"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4200000" cy="3150000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };

  // Corps : texte principal ligne par ligne, en repérant les lignes "Voir :" pour les hyperliens
  let body = "";
  const cleanLine = l => l.replace(/[│┌└─╔╗╚╝║═]+/g,"").trim();
  text.split("\n").forEach(l => {
    const c = cleanLine(l);
    if (!c){ body += P(""); return; }
    // Ligne "Voir : X (Annexe N)" → hyperlien vers annexeN
    const m = c.match(/Voir\s*:\s*.+\(Annexe\s*(\d+)\)/i);
    if (m){ body += PLINK("📎 "+c, "annexe"+m[1]); return; }
    if (l.includes("👤") || l.includes("\uD83D\uDC64")){ body += PB(c); return; }
    body += P(c);
  });

  // Annexes
  if (annexData.length){
    body += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    body += PB("═══ ANNEXES ═══");
    annexData.forEach(a => {
      body += BOOKMARK(100+a.num, "annexe"+a.num, "ANNEXE "+a.num+" — "+a.name+" — "+a.patientLabel);
      if (a.dataUrl && a.mime && a.mime.startsWith("image/")){
        body += IMG(a.num, a.dataUrl, a.mime);
      } else {
        body += P("→ Document joint séparément : "+a.name);
      }
      body += P("");
    });
  }

  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    imgRels.join("") + `</Relationships>`;

  const files = [
    { name:"[Content_Types].xml", data: enc.encode(contentTypes) },
    { name:"_rels/.rels", data: enc.encode(rootRels) },
    { name:"word/document.xml", data: enc.encode(document) },
    { name:"word/_rels/document.xml.rels", data: enc.encode(docRels) },
    ...media
  ];
  return zipStore(files);
}

function dataUrlToU8(dataUrl){
  const bin = atob(dataUrl.split(",")[1]);
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function downloadBlob(name, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
/* Rappel déontologique — affiché une seule fois, avant le premier partage.
   Information, pas conseil juridique : l'app n'est pas un service HDS. */
function confidentialityNotice(){
  return new Promise(resolve => {
    if (S.confidentialityAck){ resolve(true); return; }
    openSheet(`
      <h3>🔐 Avant de partager</h3>
      <p class="small" style="line-height:1.55;margin-bottom:12px">
        Les relèves contiennent des <b>données de santé nominatives</b>.
        Les messageries grand public (WhatsApp, SMS, mail classique) ne sont
        pas conçues pour ce type d'échange.
      </p>
      <div style="background:var(--accent-soft,rgba(43,179,163,.10));border-left:4px solid var(--accent);border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:12px">
        <p class="small" style="margin:0;line-height:1.55">
          Privilégie une <b>messagerie sécurisée de santé</b> — MSSanté, Apicrypt
          ou équivalent — pour transmettre des exports nominatifs.
        </p>
      </div>
      <p class="small muted" style="margin-bottom:14px">
        Autre possibilité : <b>anonymiser la relève</b> avant l'envoi (option dans
        l'écran de génération), ou remettre le document en main propre.
      </p>
      <p class="small muted" style="margin-bottom:14px">
        JM@Santé conserve tes données uniquement sur ton appareil et n'héberge rien.
        Le choix du canal de transmission relève de ta responsabilité professionnelle.
      </p>
      <button class="btn btn-primary" id="cn-ok" style="width:100%">J'ai compris — continuer</button>
      <button class="btn btn-ghost" id="cn-cancel" style="width:100%;margin-top:8px">Annuler l'envoi</button>`);
    $("#cn-ok").onclick = () => {
      S.confidentialityAck = true; try { save(); } catch(e){}
      closeSheet(); resolve(true);
    };
    $("#cn-cancel").onclick = () => { closeSheet(); resolve(false); };
  });
}

async function shareFiles(files, title, text=""){
  // Rappel déontologique au premier partage
  if (!S.confidentialityAck){
    const ok = await confidentialityNotice();
    if (!ok) return;
  }
  /* ── Capacitor Share (Android natif) ─────────────────────────────────
     Quand on est dans l'APK, window.Capacitor est défini et on passe
     par @capacitor/share qui utilise le vrai Intent Android.
     Le fichier est d'abord écrit dans le cache Filesystem puis partagé
     via son URI content://.
     En dehors de l'APK (navigateur), repli sur Web Share Level 2 puis
     téléchargement.
  ──────────────────────────────────────────────────────────────────── */
  const inCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform
                         && window.Capacitor.isNativePlatform());

  if (inCapacitor){
    try {
      const { Share, Filesystem } = window.Capacitor.Plugins;
      // Écrire les fichiers dans le répertoire cache
      const uris = [];
      for (const f of files){
        const ab = await f.arrayBuffer();
        // Conversion ArrayBuffer → base64 par chunks (évite les erreurs mémoire)
        const bytes = new Uint8Array(ab);
        let b64 = "";
        const CHUNK = 8192;
        for (let i=0; i<bytes.length; i+=CHUNK)
          b64 += String.fromCharCode(...bytes.subarray(i, i+CHUNK));
        const res = await Filesystem.writeFile({ path: f.name, data: btoa(b64), directory: "CACHE" });
        uris.push(res.uri);
      }
      if (uris.length === 1){
        await Share.share({ title, text, url: uris[0] });
      } else {
        // Capacitor Share 5+ supporte files[]
        await Share.share({ title, files: uris });
      }
      return true;
    } catch(e){
      if (e && (e.message||"").match(/cancel|dismiss/i)) return true;
      console.warn("Capacitor share failed, repli Web Share:", e);
    }
  }

  // Repli 1 : Web Share Level 2 (Chrome Android hors APK)
  if (navigator.canShare && navigator.canShare({ files })){
    try { await navigator.share({ files, title }); return true; }
    catch(e){ if (e && e.name === "AbortError") return true; }
  }

  // Repli 2 : téléchargement direct
  files.forEach(f => downloadBlob(f.name, f));
  toast("Partage natif indisponible ici — fichier(s) téléchargé(s).");
  return false;
}

/* Convertir un PDF (dataURL) en images de pages via pdf.js.
   Indispensable : le WebView Android bloque les data:/blob: dans
   <iframe> et <embed>, donc on rend les PDF en images. */
async function pdfToImagesGlobal(dataUrl, maxPages=5){
  if (!window.pdfjsLib) return null;
  try {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdfjs.worker.js";
    const raw = atob(String(dataUrl).split(",")[1] || dataUrl);
    const arr = new Uint8Array(raw.length);
    for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
    const pdf = await window.pdfjsLib.getDocument({ data:arr }).promise;
    const imgs = [];
    const n = Math.min(pdf.numPages, maxPages);
    for (let p=1; p<=n; p++){
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale:1.6 });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext:cv.getContext("2d"), viewport:vp }).promise;
      imgs.push({ dataUrl: cv.toDataURL("image/jpeg",0.82), w:vp.width, h:vp.height, page:p, total:pdf.numPages });
    }
    return imgs;
  } catch(e){ console.warn("pdfToImages:", e); return null; }
}

let _lastReport = null; // relève courante, pour la rouvrir après message/signature

/* Retire l'encart texte du message : PDF et HTML le rendent eux-mêmes
   avec leur propre mise en forme (sinon il apparaît deux fois, et collé
   au dernier patient à cause du découpage par bloc). */
function stripFinalMsg(t){
  return String(t).replace(/\n?\u2550{5,}\n\uD83D\uDCAC MESSAGE DE L'INFIRMIER[\s\S]*?\u2550{5,}\n?/g, "\n")
                  .replace(/\n?[\u2500\u2550-]{10,}\n\s*\uD83D\uDCAC MESSAGE DE L'INFIRMIER[\s\S]*$/g, "\n");
}
let _sigData = null;    // signature manuscrite (dataURL) pour les exports
let _finalMsg = "";     // message libre de fin de relève

function richPreview(text){
  // L'encart de message est rendu à part, sinon il s'imbrique dans le
  // cadre du dernier patient (le texte est découpé aux blocs ┌).
  const parts = ("\n"+stripFinalMsg(text)).split(/\n(?=┌)/);
  const body = parts.map(part=>{
    if (!part.trim()) return "";
    const nameLine = part.split("\n").find(l=>l.includes("👤"));
    if (!nameLine) return `<div class="rp-head">${esc(part.trim())}</div>`;
    const lines = part.split("\n").filter(l=>l.trim() && !l.match(/[┌└│]/));
    return `<div class="rp-pat"><div class="rp-nm">${esc(nameLine.replace(/[│┌└─]/g,"").trim())}</div>${
      lines.map(l=>`<div class="rp-ln">${esc(l.trim())}</div>`).join("")}</div>`;
  }).join("");
  const encart = _finalMsg ? `<div class="rp-msg">
      <div class="rp-msg-t">💬 Message de l'infirmier</div>
      <div class="rp-msg-b">${esc(_finalMsg)}</div>
      <div class="rp-msg-s">${S.identity?esc(whoami())+" — ":""}${fmtFR(todayISO())} à ${nowHM()}</div>
    </div>` : "";
  return body + encart;
}

function showReport(text, opts, keepExtras){
  // Nouvelle relève → message et signature repartent à zéro.
  // keepExtras=true → simple réaffichage après ajout d'un message/signature.
  if (!keepExtras){ _finalMsg = ""; _sigData = null; }
  _lastReport = { text, opts };
  const { tour } = opts;
  const label = (tour==="all"?"toutes":tour).replace(/\s+/g,"_");
  const baseName = "Releve_JMSante_"+label+"_"+(opts.start||todayISO());
  const pool = relevePool(tour);

  // Documents disponibles, regroupés par patient.
  // On ne propose que les patients qui figurent réellement dans la relève :
  // inutile d'afficher les documents de quelqu'un qui n'y apparaît pas.
  const inReport = new Set();
  try {
    (text||"").split(/\n(?=┌)/).forEach(part => {
      const nl = part.split("\n").find(l => l.includes("👤"));
      if (nl) inReport.add(nl.replace(/[│┌└─👤]/g,"").trim().toLowerCase());
    });
  } catch(e){}
  const inReleve = p => {
    if (!inReport.size) return true;            // sécurité : si le parsing échoue, on montre tout
    const n = (p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom).toLowerCase();
    const n2 = (p.prenom+" "+p.nom.replace("Demo-","").toUpperCase()).toLowerCase();
    return [...inReport].some(x => x.includes(n.split(",")[0]) || x.includes(n2.split(",")[0])
                                || n.includes(x.split(",")[0]) || n2.includes(x.split(",")[0]));
  };

  const docMeta = [];
  const docGroups = [];                          // [{ p, items:[{i, d}] }]
  pool.forEach(p => {
    const docs = p.docs || [];
    if (!docs.length || !inReleve(p)) return;
    const items = [];
    docs.forEach(d => {
      const i = docMeta.length;
      docMeta.push({ p, d, label: p.nom.replace("Demo-","").toUpperCase()+" — "+d.name+(d.date?" ("+fmtFR(d.date)+")":"") });
      items.push({ i, d });
    });
    docGroups.push({ p, items });
  });

  let fmt = "txt";
  const checked = new Set();

  openSheet(`
    <h3>📤 Envoyer la relève</h3>
    <div class="rp-rich" id="rp-preview">${richPreview(text)}</div>
    <textarea id="rp-edit" style="display:none;width:100%;min-height:30vh;font-family:monospace;font-size:12px">${esc(text)}</textarea>
    <button class="chip" id="rp-editbtn" style="margin-top:6px;font-size:12px">✏️ Modifier le texte avant envoi</button>
    <div class="field" style="margin-top:10px">
      <span class="lab">Format</span>
      <div class="chips" id="fmt-chips">
        <button class="chip on" data-fm="txt">🗒️ Texte</button>
        <button class="chip" data-fm="pdf">📑 PDF <span class="small muted">(photos intégrées)</span></button>
        <button class="chip" data-fm="html">🌐 HTML <span class="small muted">(photos intégrées)</span></button>
        <button class="chip" data-fm="docx">📝 Word</button>
      </div>
    </div>
    ${docMeta.length ? `<div class="field">
      <span class="lab">📎 Docs à joindre</span>
      <div class="small muted" style="margin-bottom:8px">Choisis document par document. Photos et PDF sont intégrés dans les formats PDF/HTML, et envoyés en pièces jointes pour Texte/Word.</div>
      <div id="attlist" style="max-height:34vh;overflow-y:auto">
        ${docGroups.map(g=>`
          <div class="doc-grp">
            <div class="doc-grp-h">
              <span>👤 ${esc(g.p.nom.replace("Demo-","").toUpperCase())} ${esc(g.p.prenom)}</span>
              ${g.items.length>1?`<button class="chip doc-all" data-attall="${g.items.map(x=>x.i).join(",")}" style="font-size:11px">Tout</button>`:""}
            </div>
            ${g.items.map(({i,d})=>`<button class="selv" data-att="${i}">
              <span class="box"></span>
              <span class="sv">${/^image\//.test(d.mime||"")?"🖼":"📄"} ${esc(d.name)}${d.date?` <span class="small muted">${fmtFR(d.date)}</span>`:""}</span>
            </button>`).join("")}
          </div>`).join("")}
      </div></div>` : ""}
    <button class="btn btn-primary" id="rp-send" style="width:100%;margin-top:12px;font-size:15px">
      📤 Envoyer<span id="rp-count"></span>
    </button>
    <div class="rowb" style="margin-top:8px;gap:8px">
      <button class="btn btn-ghost" id="rp-save" style="flex:1">💾 Enregistrer</button>
      <button class="btn btn-ghost" id="rp-sig"  style="flex:1">${_sigData?"✍️ Signé ✓":"✍️ Signer"}</button>
      <button class="btn btn-ghost" id="rp-msg"  style="flex:1">${_finalMsg?"💬 Message ✓":"💬 Message"}</button>
    </div>
    <button class="btn btn-ghost" id="rp-close" style="margin-top:8px;width:100%">Fermer</button>`);

  // ── Édition à la volée ──
  let editing = false;
  $("#rp-editbtn").onclick = () => {
    editing = !editing;
    if (editing){
      $("#rp-edit").style.display = "block";
      $("#rp-preview").style.display = "none";
      $("#rp-editbtn").textContent = "✓ Terminer la modification";
      $("#rp-editbtn").classList.add("on");
    } else {
      text = $("#rp-edit").value; // le texte modifié devient LA relève
      $("#rp-preview").innerHTML = richPreview(text);
      $("#rp-edit").style.display = "none";
      $("#rp-preview").style.display = "block";
      $("#rp-editbtn").textContent = "✏️ Modifier le texte avant envoi";
      $("#rp-editbtn").classList.remove("on");
      toast("Relève modifiée ✓ (le PDF/HTML/Word reprendra ce texte)");
    }
  };
  $$("#fmt-chips .chip").forEach(c => c.onclick = () => {
    fmt = c.dataset.fm;
    $$("#fmt-chips .chip").forEach(x => x.classList.toggle("on", x===c));
  });
  const updCount = () => {
    const n = checked.size;
    $("#rp-count").textContent = n ? " + "+n+" doc"+(n>1?"s":"") : "";
  };
  const paintAtt = () => {
    $$("#attlist [data-att]").forEach(b => {
      const on = checked.has(+b.dataset.att);
      b.classList.toggle("on", on);
      b.querySelector(".box").textContent = on ? "✓" : "";
    });
    $$("#attlist [data-attall]").forEach(b => {
      const ids = b.dataset.attall.split(",").map(Number);
      b.classList.toggle("on", ids.every(i => checked.has(i)));
    });
    updCount();
  };
  $$("#attlist [data-att]").forEach(b => b.onclick = () => {
    const i = +b.dataset.att;
    checked.has(i) ? checked.delete(i) : checked.add(i);
    paintAtt();
  });
  // « Tout » : coche ou décoche tous les documents de CE patient
  $$("#attlist [data-attall]").forEach(b => b.onclick = () => {
    const ids = b.dataset.attall.split(",").map(Number);
    const allOn = ids.every(i => checked.has(i));
    ids.forEach(i => allOn ? checked.delete(i) : checked.add(i));
    paintAtt();
  });

  // ── Charger un doc depuis IDB ──
  const loadDoc = id => idbGet("doc_"+id).catch(()=>null);

  // ── Trouver les docs d'un patient parmi les cases cochées ──
  const checkedDocsFor = (pid, imgOnly) => [...checked].map(i=>docMeta[i])
    .filter(x => x.p.id===pid && (!imgOnly || (x.d.mime&&x.d.mime.startsWith("image/"))));

  // ══════════════════════════════════════════════
  // SYSTÈME D'ANNEXES : docs numérotés en bas + liens
  // ══════════════════════════════════════════════
  const getAnnexes = () => [...checked].map((i,k)=>({ ...docMeta[i], num:k+1 }));

  // Convertir un PDF (dataURL) en images de pages via pdf.js
  const pdfToImages = async (dataUrl, maxPages=5) => {
    if (!window.pdfjsLib) return null;
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdfjs.worker.js";
      const raw = atob(dataUrl.split(",")[1]);
      const arr = new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
      const pdf = await window.pdfjsLib.getDocument({data:arr}).promise;
      const imgs = [];
      const n = Math.min(pdf.numPages, maxPages);
      for (let p=1; p<=n; p++){
        const page = await pdf.getPage(p);
        const vp = page.getViewport({scale:1.6});
        const cv = document.createElement("canvas");
        cv.width=vp.width; cv.height=vp.height;
        await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
        imgs.push({ dataUrl: cv.toDataURL("image/jpeg",0.82), w:vp.width, h:vp.height });
      }
      return { imgs, total: pdf.numPages };
    } catch(e){ console.warn("pdfToImages:", e); return null; }
  };

  // ── PDF avec liens internes vers annexes ──
  const buildPdf = async () => {
    if (!window.jspdf) throw new Error("jsPDF absent");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
    const M=14, maxW=182, pageH=297;
    let y=M;
    const annexes = getAnnexes();
    const linkSources = []; // { num, page, x, y, w, h }
    const linkTargets = {}; // num -> { page, y }

    const chk=(n=6)=>{ if(y+n>pageH-14){ doc.addPage(); y=M; } };
    const cl = t => (t||"")
      .replace(/\u2705/g,"+").replace(/\uD83D\uDCCA/g,"").replace(/\uD83D\uDCDD/g,"")
      .replace(/\u26A0(?:\uFE0F)?/g,"! ").replace(/\uD83D\uDCCC/g,"*")
      .replace(/\uD83E\uDDEA/g,"").replace(/\uD83D\uDCCE/g,"").replace(/\u{1F4C5}/gu,"")
      .replace(/\uD83D\uDC64/g,"").replace(/[╔╗╚╝║═╠╣]+/g,"=")
      .replace(/[┌┐└┘│├┤─]+/g,"-").replace(/[^\x00-\xFF]/g,"").trim();
    const C={ head:[0,90,80], soins:[40,160,60], consts:[60,100,200],
              note:[200,120,0], alerte:[200,0,0], rappel:[160,120,0],
              bilan:[120,60,160], link:[20,80,220], dim:[130,130,130] };
    const rgb=c=>doc.setTextColor(c[0],c[1],c[2]);

    // Bandeau
    doc.setFillColor(0,90,80); doc.rect(0,0,210,13,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
    doc.text("RELEVE INFIRMIERE - JM@Sante", M, 8);
    doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(168,222,210);
    doc.text("Tout est dans la cigale", M, 11.6);
    doc.setTextColor(0,0,0); y=24;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); rgb(C.dim);
    doc.text("Periode : "+fmtFR(opts.start||todayISO())+"   |   Tournee : "+(tour==="all"?"Toutes":cl(tour)), M, y); y+=8;
    doc.setTextColor(0,0,0);

    const parts = ("\n"+stripFinalMsg(text)).split(/\n(?=┌)/);
    for (const part of parts){
      const lines = part.split("\n").filter(l=>l.trim());
      const nameLine = lines.find(l=>l.match(/\uD83D\uDC64|👤/));
      if (!nameLine){
        lines.forEach(l=>{ const c=cl(l); if(!c||c.match(/^[-=]+$/)) return;
          chk(); doc.setFont("helvetica","normal"); doc.setFontSize(8); rgb(C.dim);
          doc.text(c,M,y); y+=5.2; });
        doc.setTextColor(0,0,0); y+=3; continue;   // respiration avant le 1er patient
      }
      // Entête patient — on descend d'abord pour que le rectangle (dessiné
      // 5.5 mm au-dessus de y) ne remonte pas sur la ligne précédente.
      chk(18);
      y += 6;
      const nameClean = cl(nameLine.replace(/[│┌└─\-]/g,""));
      doc.setFillColor(235,248,246); doc.rect(M-2,y-5.5,maxW+4,9,"F");
      doc.setFillColor(0,90,80); doc.rect(M-2,y-5.5,3.5,9,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(11); rgb(C.head);
      doc.text(nameClean, M+4, y); doc.setTextColor(0,0,0); y+=7;

      lines.forEach(l=>{
        if (l.match(/\uD83D\uDC64|👤|[│┌└─]/)) return;
        const raw = cl(l); if (!raw) return;
        let color=C.dim, prefix="  ", bold=false;
        if (l.match(/\u2705|Soins/)){ color=C.soins; prefix="  + "; }
        else if (l.match(/\uD83D\uDCCA|Constantes/)){ color=C.consts; prefix="  ~ "; }
        else if (l.match(/\u26A0|elev|basse/)){ color=C.alerte; prefix="  ! "; bold=true; }
        else if (l.match(/\uD83D\uDCDD/)){ color=C.note; prefix="  > "; }
        else if (l.match(/RAS|R\u00C0S/)){ color=C.soins; bold=true; prefix="  + "; }
        else if (l.match(/\uD83E\uDDEA|Bilan/)){ color=C.bilan; prefix="  # "; }
        else if (l.match(/\uD83D\uDCCC|Rappel/)){ color=C.rappel; prefix="  * "; }
        const val = raw.replace(/^[\s\-\+\*\|~#>!]+/,"").trim();
        if (!val || val.match(/^[-=]{3,}$/)) return;
        chk();
        doc.setFont("helvetica",bold?"bold":"normal"); doc.setFontSize(9.5);
        doc.setTextColor(color[0],color[1],color[2]);
        doc.splitTextToSize(prefix+val, maxW-6).forEach(ll=>{ chk(); doc.text(ll,M+3,y); y+=5; });
        doc.setTextColor(0,0,0);
      });

      // Liens "Voir : X (Annexe N)" pour ce patient
      let pid=null;
      const nameRaw=nameClean.toUpperCase();
      pool.forEach(p=>{ if(nameRaw.includes(p.nom.replace("Demo-","").toUpperCase().slice(0,5))) pid=p.id; });
      if (pid){
        annexes.filter(a=>a.p.id===pid).forEach(a=>{
          chk(6);
          doc.setFont("helvetica","normal"); doc.setFontSize(9); rgb(C.link);
          const linkTxt = ">> Voir : "+cl(a.d.name)+" (Annexe "+a.num+")";
          doc.text(linkTxt, M+3, y);
          const w = doc.getTextWidth(linkTxt);
          linkSources.push({ num:a.num, page:doc.internal.getCurrentPageInfo().pageNumber, x:M+3, y:y-4, w, h:5 });
          doc.setTextColor(0,0,0);
          y+=5.5;
        });
      }
      doc.setDrawColor(200,200,200); chk(4); doc.line(M,y,M+maxW,y); y+=6;
    }

    // ── ANNEXES ──
    if (annexes.length){
      doc.addPage(); y=M;
      doc.setFillColor(0,90,80); doc.rect(0,0,210,13,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
      doc.text("RELEVE INFIRMIERE - JM@Sante", M, 9); doc.setTextColor(0,0,0);
      doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
      doc.text("ANNEXES", M, 9); doc.setTextColor(0,0,0); y=22;

      for (const a of annexes){
        chk(14);
        linkTargets[a.num] = { page:doc.internal.getCurrentPageInfo().pageNumber, y:Math.max(0,y-8) };
        // Titre annexe
        doc.setFillColor(240,240,245); doc.rect(M-2,y-5,maxW+4,8,"F");
        doc.setFont("helvetica","bold"); doc.setFontSize(10); rgb(C.head);
        doc.text("ANNEXE "+a.num+" - "+cl(a.d.name)+" - "+cl(a.p.nom.replace("Demo-","").toUpperCase()+" "+a.p.prenom), M, y);
        doc.setTextColor(0,0,0); y+=8;

        const data = await loadDoc(a.d.id);
        if (!data){ doc.setFontSize(9); rgb(C.alerte); doc.text("Document introuvable.", M, y); y+=6; doc.setTextColor(0,0,0); continue; }

        if (a.d.mime && a.d.mime.startsWith("image/")){
          chk(95);
          try {
            const ext=(a.d.mime.split("/")[1]||"jpeg").toUpperCase().replace("JPEG","JPG");
            doc.addImage(data, ext, M, y, 120, 90); y+=95;
          } catch(e){ doc.setFontSize(9); doc.text("[Image non affichable]", M, y); y+=6; }
        } else if (a.d.mime === "application/pdf"){
          // Convertir les pages en images via pdf.js
          const res = await pdfToImages(data, 4);
          if (res && res.imgs.length){
            for (const im of res.imgs){
              const ratio = im.h/im.w;
              const w = Math.min(150, maxW), h = w*ratio;
              chk(h+6);
              try { doc.addImage(im.dataUrl, "JPG", M, y, w, h); y+=h+4; }
              catch(e){ break; }
            }
            if (res.total > res.imgs.length){
              doc.setFont("helvetica","italic"); doc.setFontSize(8); rgb(C.dim);
              doc.text("("+res.total+" pages au total - "+res.imgs.length+" affichees - document complet en piece jointe)", M, y); y+=6;
              doc.setTextColor(0,0,0);
            }
          } else {
            doc.setFont("helvetica","italic"); doc.setFontSize(9); rgb(C.dim);
            doc.text("Document PDF joint separement : "+cl(a.d.name), M, y); y+=6;
            doc.setTextColor(0,0,0);
          }
        } else {
          doc.setFont("helvetica","italic"); doc.setFontSize(9); rgb(C.dim);
          doc.text("Document joint separement : "+cl(a.d.name), M, y); y+=6;
          doc.setTextColor(0,0,0);
        }
        y+=4;
      }
    }

    // ── Poser les liens cliquables ──
    linkSources.forEach(ls => {
      const t = linkTargets[ls.num];
      if (!t) return;
      doc.setPage(ls.page);
      doc.link(ls.x, ls.y, ls.w, ls.h, { pageNumber: t.page, top: t.y });
    });

    // ── Encart message de fin (option A : barre verte à gauche) ──
    if (_finalMsg){
      if (y > pageH - 50){ doc.addPage(); y = 24; }
      y += 6;
      const msgLines = doc.splitTextToSize(cl(_finalMsg), 168);
      const boxH = 16 + msgLines.length * 5;
      doc.setFillColor(245,250,248); doc.rect(M, y, 178, boxH, "F");
      doc.setFillColor(15,110,86);   doc.rect(M, y, 2.5, boxH, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(15,110,86);
      doc.text("MESSAGE DE L'INFIRMIER", M+7, y+7);
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(30,30,30);
      doc.text(msgLines, M+7, y+13);
      doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(110,110,110);
      const sigName = (S.identity ? whoami() : "");
      doc.text(sigName + (sigName?" — ":"") + fmtFR(todayISO()) + " à " + nowHM(), M+7, y+boxH-3.5);
      doc.setTextColor(0,0,0);
      y += boxH + 6;
    }

    // ── Signature manuscrite ──
    if (_sigData){
      if (y > pageH - 40){ doc.addPage(); y = 24; }
      y += 4;
      doc.setFont("helvetica","normal"); doc.setFontSize(8); rgb(C.dim);
      doc.text("Signature :", M, y); doc.setTextColor(0,0,0);
      try { doc.addImage(_sigData, "PNG", M, y+2, 52, 20); } catch(e){}
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      if (S.identity) doc.text(whoami(), M+58, y+14);
      y += 26;
    }

    // Pied de page
    const pages=doc.internal.pages.length-1;
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      doc.setFont("helvetica","italic"); doc.setFontSize(7.5); rgb(C.dim);
      doc.text("JM@Sante - "+fmtFR(todayISO())+" "+nowHM()+" | Page "+i+"/"+pages, M, pageH-9);
      doc.text("JM@Sante by JmCve83 - Toulon production", M, pageH-5.5);
      doc.setTextColor(0,0,0);
    }
    return doc.output("arraybuffer");
  };

  // ── HTML avec ancres vers annexes ──
  const buildHtml = async () => {
    const annexes = getAnnexes();
    const css = `body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;padding:16px;max-width:780px;margin:0 auto;line-height:1.55;color:#222}
      .ps{border:1px solid #d5dfe0;border-radius:10px;padding:14px;margin:14px 0;page-break-inside:avoid}
      .ph{font-weight:700;font-size:12pt;color:#005A50;border-bottom:2px solid #005A50;margin-bottom:8px;padding-bottom:5px}
      pre{white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit}
      .doclink{display:inline-block;margin:4px 0;padding:5px 12px;background:#e8f5f2;color:#005A50;border-radius:8px;text-decoration:none;font-weight:600;font-size:10pt}
      .doclink:hover{background:#d0ebe5}
      .annexe{border:2px solid #005A50;border-radius:10px;padding:14px;margin:18px 0;page-break-inside:avoid}
      .annexe h3{color:#005A50;margin:0 0 10px;font-size:11pt}
      .annexe img{max-width:100%;border-radius:6px;border:1px solid #ccc;display:block;margin:6px 0}
      .annexe embed{width:100%;height:520px;border:1px solid #ccc;border-radius:6px}
      .backtop{font-size:9pt;color:#888;text-decoration:none}
      h1{font-size:15pt;color:#005A50;border-bottom:3px solid #005A50;padding-bottom:6px}
      h2{font-size:13pt;color:#005A50;margin-top:28px;border-bottom:2px solid #005A50;padding-bottom:4px}
      @media print{@page{margin:12mm}.annexe,.ps{page-break-inside:avoid}}`;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relève JM@Santé</title><style>${css}</style></head><body>`;
    html += `<div id="top" style="background:#005A50;padding:12px 16px;margin:-16px -16px 16px;display:flex;align-items:center;gap:11px">
      <svg viewBox="0 0 100 100" width="30" height="30" style="flex-shrink:0"><g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/><ellipse cx="50" cy="30" rx="15" ry="12"/><path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/><path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/><path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g><circle cx="43" cy="29" r="3" fill="#fff"/><circle cx="57" cy="29" r="3" fill="#fff"/></svg>
      <div><div style="color:#fff;font-size:15pt;font-weight:700">Relève JM@Santé — ${fmtFR(todayISO())}</div>
      <div style="color:#a8ded2;font-size:9pt;font-style:italic;margin-top:1px">Tout est dans la cigale</div></div>
    </div>`;

    const parts = ("\n"+stripFinalMsg(text)).split(/\n(?=┌)/);
    for (const part of parts){
      if (!part.trim()) continue;
      const nameLine = part.split("\n").find(l=>l.match(/\uD83D\uDC64|👤/));
      if (!nameLine){ html += `<pre style="color:#777;font-size:9pt">${esc(part.trim())}</pre>`; continue; }
      let pid=null;
      const raw=nameLine.replace(/[│┌└─\s]/g,"").replace(/👤/g,"").toUpperCase();
      pool.forEach(p=>{ if(raw.startsWith(p.nom.replace("Demo-","").toUpperCase().slice(0,5))) pid=p.id; });
      html += `<div class="ps"><div class="ph">${esc(nameLine.replace(/[│┌└─]/g,"").trim())}</div>`;
      html += `<pre>${esc(part.split("\n").filter(l=>!l.match(/[│┌└─]/)).join("\n").trim())}</pre>`;
      if (pid){
        annexes.filter(a=>a.p.id===pid).forEach(a=>{
          html += `<a class="doclink" href="#annexe-${a.num}">📎 Voir : ${esc(a.d.name)} (Annexe ${a.num})</a><br>`;
        });
      }
      html += `</div>`;
    }

    // Annexes
    if (annexes.length){
      html += `<h2 id="annexes">📎 ANNEXES</h2>`;
      for (const a of annexes){
        const data = await loadDoc(a.d.id);
        html += `<div class="annexe" id="annexe-${a.num}">`;
        html += `<h3>ANNEXE ${a.num} — ${esc(a.d.name)} — ${esc(a.p.nom.replace("Demo-","").toUpperCase())} ${esc(a.p.prenom)}${a.d.date?" · "+fmtFR(a.d.date):""}</h3>`;
        if (!data){ html += `<p style="color:#c00">Document introuvable.</p>`; }
        else if (a.d.mime && a.d.mime.startsWith("image/")){
          html += `<img src="${data}" alt="${esc(a.d.name)}">`;
        } else if (a.d.mime === "application/pdf"){
          // Rendu en images : <embed src="data:…"> est bloqué par le WebView
          // Android et laisse un cadre blanc chez le destinataire.
          const pages = await pdfToImagesGlobal(data, 8);
          if (pages && pages.length){
            pages.forEach(pg => { html += `<img src="${pg.dataUrl}" alt="${esc(a.d.name)}">`; });
            if (pages[0].total > pages.length)
              html += `<p style="font-size:9pt;color:#666">${pages[0].total - pages.length} page(s) non affichée(s) — <a href="${data}" download="${esc(a.d.name)}">télécharger le PDF complet</a></p>`;
          } else {
            html += `<p style="font-size:9pt;color:#666"><a href="${data}" download="${esc(a.d.name)}">Télécharger ${esc(a.d.name)}</a></p>`;
          }
        } else {
          html += `<p><a href="${data}" download="${esc(a.d.name)}">Télécharger ${esc(a.d.name)}</a></p>`;
        }
        html += `<a class="backtop" href="#top">↑ Retour en haut</a></div>`;
      }
    }
    if (_finalMsg){
      html += `<div style="background:#f5faf8;border:1px solid #dbe8e3;border-left:4px solid #0F6E56;padding:14px 16px;margin:24px 0 10px">
        <div style="font-size:10.5pt;letter-spacing:.06em;text-transform:uppercase;color:#0F6E56;font-weight:700;margin-bottom:7px">💬 Message de l'infirmier</div>
        <div style="font-size:11pt;line-height:1.6;color:#1a2420;white-space:pre-wrap">${esc(_finalMsg)}</div>
        <div style="font-size:9pt;color:#6b7a75;margin-top:9px">${S.identity?esc(whoami())+" — ":""}${fmtFR(todayISO())} à ${nowHM()}</div>
      </div>`;
    }
    if (_sigData){
      html += `<div style="margin:20px 0 6px">
        <div style="font-size:9pt;color:#6b7a75;margin-bottom:4px">Signature :</div>
        <img src="${_sigData}" alt="Signature" style="height:64px;border-bottom:1px solid #dbe8e3">
        ${S.identity?`<div style="font-size:9.5pt;color:#3a4a45;margin-top:4px">${esc(whoami())}</div>`:""}
      </div>`;
    }
    html += `<hr><p style="font-size:8pt;color:#999">Généré par JM@Santé le ${fmtFR(todayISO())} à ${nowHM()}</p>
      <p style="font-size:8pt;color:#aaa;text-align:center;margin-top:4px">JM@Santé by JmCve83 — Toulon production · <i>« Tout est dans la cigale »</i></p></body></html>`;
    return html;
  };

  // ── Pièces jointes séparées (non-image ou format txt/docx) ──
  const buildAtts = async () => {
    const files=[];
    const embedded=(fmt==="pdf"||fmt==="html"); // en pdf/html tout est intégré
    for (const i of [...checked]){
      const {d}=docMeta[i];
      // En PDF/HTML : images intégrées, PDF intégrés (pages converties) → seuls les autres types sont joints
      if (embedded && d.mime && (d.mime.startsWith("image/")||d.mime==="application/pdf")) continue;
      const data=await loadDoc(d.id); if(!data) continue;
      files.push(new File([dataUrlToU8(data)], d.name, {type:d.mime||"application/octet-stream"}));
    }
    return files;
  };

  // ── Construire le fichier principal ──
  const buildMain = async () => {
    if (fmt==="pdf"){
      const ab=await buildPdf();
      return new File([ab], baseName+".pdf", {type:"application/pdf"});
    }
    if (fmt==="html"){
      const hc=await buildHtml();
      return new File([hc], baseName+".html", {type:"text/html"});
    }
    if (fmt==="docx"){
      const annexes = getAnnexes();
      const annexData = [];
      for (const a of annexes){
        const data = await loadDoc(a.d.id);
        annexData.push({
          num: a.num, name: a.d.name,
          patientLabel: a.p.nom.replace("Demo-","").toUpperCase()+" "+a.p.prenom,
          mime: a.d.mime||"", dataUrl: (data && a.d.mime && a.d.mime.startsWith("image/")) ? data : null
        });
      }
      // Injecter les lignes "Voir : X (Annexe N)" dans le texte avant conversion
      let textWithLinks = text;
      const parts2 = ("\n"+text).split(/\n(?=┌)/);
      let rebuilt = "";
      for (const part of parts2){
        rebuilt += part;
        const nameLine = part.split("\n").find(l=>l.match(/👤/));
        if (nameLine){
          let pid=null;
          const raw=nameLine.replace(/[│┌└─\s]/g,"").replace(/👤/g,"").toUpperCase();
          pool.forEach(p=>{ if(raw.startsWith(p.nom.replace("Demo-","").toUpperCase().slice(0,5))) pid=p.id; });
          if (pid) annexes.filter(x=>x.p.id===pid).forEach(x=>{
            rebuilt += "\n  Voir : "+x.d.name+" (Annexe "+x.num+")";
          });
        }
        rebuilt += "\n";
      }
      return new File([docxWithAnnexes(rebuilt, annexData)], baseName+".docx",
        {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    }
    return new File([text], baseName+".txt", {type:"text/plain"});
  };

  // ── 📤 Envoyer ──
  $("#rp-send").onclick = async () => {
    const btn=$("#rp-send"); btn.disabled=true; btn.textContent="Préparation…";
    try {
      const main=await buildMain();
      const atts=await buildAtts();
      // Journal des envois (traçabilité)
      S.sendLog = S.sendLog || [];
      S.sendLog.unshift({ ts:Date.now(), tour:(tour==="all"?"Toutes":tour), fmt, n:pool.length, docs:checked.size, text });
      if (S.sendLog.length > 60) S.sendLog.length = 60;
      S.sendLog.forEach((e,i)=>{ if (i>=20) delete e.text; }); // texte conservé pour les 20 dernières
      save();
      // Message automatique adapté au format
      const fmtHint = fmt==="pdf" ? "Ouvrir avec Adobe Acrobat ou tout lecteur PDF"
        : fmt==="html" ? "Ouvrir dans Chrome ou n'importe quel navigateur"
        : fmt==="docx" ? "Ouvrir avec WPS Office, Word ou Google Docs"
        : "Fichier texte — ouvrir avec n'importe quelle app";
      const nbPats = pool.length;
      const nbAlerts = pool.reduce((n,p)=>n+p.visits.filter(v=>v.date>=(opts.start||todayISO())&&v.date<=(opts.end||todayISO())).reduce((a,v)=>a+alertes(v.consts,p.thresholds).length,0),0);
      const nbRaps = (S.rappels||[]).filter(r=>!r.done&&r.due&&daysUntil(r.due)<=1).length;
      const tourLbl=tour==="all"?"Toutes tournees":tour;
      const dateLbl=fmtFR(opts.start||todayISO())+(opts.end&&opts.end!==opts.start?" au "+fmtFR(opts.end):"");
      const st=nbPats+" patient(s)"+(nbAlerts?" - "+nbAlerts+" alerte(s)":"")+(nbRaps?" - "+nbRaps+" rappel(s) urgent(s)":"");
      const autoMsg="Releve JM@Sante - "+tourLbl+" - "+dateLbl+"\n"+st+"\n\n> "+fmtHint;
      await shareFiles([main,...atts], "Relève JM@Santé", autoMsg);
    } catch(e){ toast("Échec : "+e.message); }
    finally {
      btn.disabled=false;
      const n=checked.size;
      btn.innerHTML='📤 Envoyer'+(n?' <span id="rp-count"> + '+n+' doc'+(n>1?'s':'')+'</span>':'<span id="rp-count"></span>');
    }
  };

  // ── 💾 Enregistrer ──
  $("#rp-save").onclick = async () => {
    try {
      const main=await buildMain();
      const cap=window.Capacitor;
      if(cap&&cap.isNativePlatform&&cap.isNativePlatform()){
        const ab=await main.arrayBuffer(); const bytes=new Uint8Array(ab);
        let b64=""; for(let i=0;i<bytes.length;i+=8192) b64+=String.fromCharCode(...bytes.subarray(i,i+8192));
        const where = await saveToDevice(main.name, btoa(b64), { base64:true });
        toast("💾 Enregistré : "+where); return;
      }
      downloadBlob(main.name, main); toast("Téléchargé 💾");
    } catch(e){ toast("Erreur : "+e.message); }
  };

  // ── ✍️ Signer ──
  $("#rp-sig").onclick = () => openSignature(sig => {
    _sigData = sig || null;                       // conservée pour les exports
    const b = document.getElementById("rp-sig");
    if (b) b.textContent = sig ? "✍️ Signé ✓" : "✍️ Signer";
    else if (_lastReport) setTimeout(() => showReport(_lastReport.text, _lastReport.opts, true), 60);
    toast(sig ? "Signature ajoutée aux documents ✓" : "Signature retirée");
  });

  // ── 💬 Message de fin de relève ──
  $("#rp-msg").onclick = () => {
    openSheet(`
      <h3>💬 Message de fin de relève</h3>
      <p class="small muted" style="margin-bottom:10px">Un mot libre qui apparaîtra dans un encart en fin de document (texte, PDF, HTML et Word).</p>
      <div class="micwrap">
        <textarea id="fm-txt" rows="4" placeholder="Ex : penser à récupérer les compresses chez Mme X · portail du 12 en panne, passer par le jardin…">${esc(_finalMsg||"")}</textarea>
        <button class="micbtn" id="fm-mic" title="Dicter">🎤</button>
      </div>
      <button class="btn btn-primary" id="fm-ok" style="width:100%;margin-top:10px">Valider</button>
      ${_finalMsg?`<button class="btn btn-ghost" id="fm-del" style="width:100%;margin-top:8px">Retirer le message</button>`:""}`);
    const fmMic = $("#fm-mic");
    if (fmMic) fmMic.onclick = () => { try { dictate($("#fm-txt"), fmMic); } catch(e){ toast("Dictée indisponible"); } };
    const reopen = () => {
      // Régénérer la relève avec le message, puis revenir à l'aperçu
      closeSheet();
      if (_lastReport){
        const o = _lastReport.opts || {};
        let txt = _lastReport.text;
        try { if (o.regen) txt = o.regen(); } catch(e){}
        setTimeout(() => showReport(txt, o, true), 60);
      }
    };
    $("#fm-ok").onclick = () => {
      _finalMsg = $("#fm-txt").value.trim();
      toast(_finalMsg ? "Message ajouté — il figurera en fin de relève ✓" : "Message retiré");
      reopen();
    };
    const del = $("#fm-del");
    if (del) del.onclick = () => { _finalMsg = ""; toast("Message retiré"); reopen(); };
  };

  $("#rp-close").onclick = closeSheet;
}


/* ---------- Feuille de route de tournée (imprimable) ---------- */
async function shareFeuilleRoute(){
  const tour = S.curTour;
  const slot = activeSlot();
  const pool = activeP().filter(p => inTourSlot(p, tour, slot));
  if (!pool.length){ toast("Aucun patient dans la tournée courante."); return; }
  const sorted = sortBySlot(pool, tour, slot);
  const rows = sorted.map((p,i)=>`
    <tr>
      <td class="num">${i+1}</td>
      <td><b>${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}</b>${shownInfos(p).map(it=>`<br><span class="ctx">${infoType(it.type).ic} ${esc(it.txt)}</span>`).join("")}
        ${(p.tags||[]).length?`<br><span class="tags">${p.tags.map(t=>PATIENT_TAGS[t]?PATIENT_TAGS[t].ic+" "+PATIENT_TAGS[t].lbl:t).join(" · ")}</span>`:""}</td>
      <td>${esc(p.address||"—")}</td>
      <td>${(p.plan||[]).map(esc).join("<br>")||"—"}</td>
      <td class="chk">☐</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Feuille de route</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;padding:10mm;color:#222}
    h1{font-size:14pt;color:#005A50;border-bottom:2px solid #005A50;padding-bottom:4px;margin:0 0 4px}
    .sub{color:#777;font-size:9pt;margin-bottom:10px}
    table{width:100%;border-collapse:collapse}
    th{background:#005A50;color:#fff;padding:6px 8px;text-align:left;font-size:9pt}
    td{border:1px solid #cfdedd;padding:6px 8px;vertical-align:top}
    .num{width:24px;text-align:center;font-weight:700;color:#005A50}
    .chk{width:30px;text-align:center;font-size:14pt}
    .ctx{color:#b35c00;font-size:8.5pt}
    .tags{color:#666;font-size:8.5pt}
    tr:nth-child(even) td{background:#f4faf9}
    @media print{@page{margin:8mm}}
  </style></head><body>
  <h1>🗺️ Feuille de route — ${esc(tour==="all"?"Toutes tournées":tour)}</h1>
  <div class="sub">${fmtFR(todayISO())} · ${sorted.length} patient(s) · JM@Santé</div>
  <table><tr><th>#</th><th>Patient</th><th>Adresse</th><th>Soins prévus</th><th>✓</th></tr>${rows}</table>
  </body></html>`;
  const file = new File([html], "Feuille_route_"+(tour==="all"?"toutes":tour).replace(/\s+/g,"_")+"_"+todayISO()+".html", { type:"text/html" });
  await shareFiles([file], "Feuille de route", "Feuille de route "+(tour==="all"?"":tour)+" — "+fmtFR(todayISO())+"\nOuvrir dans Chrome puis Imprimer pour la version papier.");
}

/* ---------- Gestionnaire global des boutons [data-a] ---------- */
document.addEventListener("click", e => {
  const a = e.target.closest("[data-a]");
  if (!a) return;
  switch (a.dataset.a){
    case "tours":       sheetTours(); break;
    case "search":      sheetSearch(); break;
    case "seq":         toggleSeqMode(); break;
    case "new-patient": sheetPatient(null); break;
    case "new-rappel":  sheetRappels(null); break;
    case "releve":      sheetReleve(); break;
    case "quickdictate": sheetQuickDictate(); break;
    case "endtour":     terminerTournee(); break;
    case "seed":
      if (confirm("Charger les données de démonstration ?")){ seedDemo(); save(); render(); }
      break;
    case "wipe":
      if (confirm("Effacer TOUTES les données ? Cette action est irréversible.")){ S=defaultState(); save(); render(); }
      break;
  }
});
