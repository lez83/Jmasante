/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   MES DISPOSITIFS — un catalogue à soi, pour écrire moins
   ─────────────────────────────────────────────────────────
   Le but est simple : qu'une ordonnance de matériel porte des noms
   exacts et des dimensions justes, imprimés, plutôt qu'un manuscrit
   que le pharmacien devra déchiffrer.

   ⚠️ NI CODE LPP, NI TARIF, NI MENTION DE REMBOURSEMENT. C'est la
   consigne de l'utilisateur, et c'est aussi ce qui écarte le plus gros
   risque de péremption : un nom de gamme bouge lentement, un code et un
   tarif changent sans prévenir.

   ⚠️ SOCLE MODESTE, ENRICHI PAR L'UTILISATEUR. Une cinquantaine de
   références courantes, relevées des captures qu'il a fournies. Ce
   n'est pas un catalogue exhaustif et ne prétend pas l'être : une liste
   vivante qu'on complète vaut mieux qu'un pavé de six cents lignes qui
   périme sans que personne ne s'en aperçoive.

   ⚠️ L'APP NE SUGGÈRE AUCUN PANSEMENT. Elle n'a jamais dit « pour cette
   plaie, prends un alginate » et ne le dira pas. Elle range ce que
   l'utilisateur utilise, il choisit.

   ⚠️ Données rangées dans l'essai (`essaiData("dispositifs")`) :
   effaçables sans toucher à un dossier.
============================================================ */

const DISPO_FAMILLES = [
  "Hydrocellulaires", "Hydrocolloïdes", "Alginates et hydrofibres",
  "Interfaces et tulles", "Pansements spécifiques", "Compresses et gazes",
  "Fixation et bandes", "Nettoyage et antiseptiques", "Contention",
  "Sondage et urologie", "Perfusion", "Surveillance glycémique",
  "Prévention d'escarre", "Autre"
];

/* Le socle : nom de gamme, dimensions courantes, famille. */
const DISPO_SOCLE = [
  { n:"Mepilex Border", d:"7,5×7,5 · 10×10 · 12,5×12,5 · 15×15", f:"Hydrocellulaires" },
  { n:"Mepilex Border Lite", d:"5×5 · 7,5×7,5 · 10×10", f:"Hydrocellulaires" },
  { n:"Mepilex", d:"10×10 · 10×20 · 15×15", f:"Hydrocellulaires" },
  { n:"Mepilex Heel", d:"talon", f:"Hydrocellulaires" },
  { n:"Allevyn Adhesive", d:"7,5×7,5 · 12,5×12,5 · 17,5×17,5", f:"Hydrocellulaires" },
  { n:"Allevyn Gentle Border", d:"7,5×7,5 · 10×10 · 12,5×12,5", f:"Hydrocellulaires" },
  { n:"Allevyn Life", d:"10,3×10,3 · 12,9×12,9 · 15,4×15,4", f:"Hydrocellulaires" },
  { n:"Biatain Silicone", d:"7,5×7,5 · 10×10 · 12,5×12,5", f:"Hydrocellulaires" },
  { n:"Aquacel Foam", d:"10×10 · 12,5×12,5 · 17,5×17,5", f:"Hydrocellulaires" },
  { n:"UrgoTul Absorb", d:"10×12 · 15×20", f:"Hydrocellulaires" },

  { n:"DuoDERM E", d:"10×10 · 15×15 · 20×20", f:"Hydrocolloïdes" },
  { n:"DuoDERM Extra Thin", d:"7,5×7,5 · 10×10 · 15×15", f:"Hydrocolloïdes" },
  { n:"Comfeel Plus Transparent", d:"5×7 · 10×10 · 15×15", f:"Hydrocolloïdes" },
  { n:"Algoplaque", d:"10×10 · 15×15", f:"Hydrocolloïdes" },

  { n:"Algostéril compresse", d:"5×5 · 10×10", f:"Alginates et hydrofibres" },
  { n:"Algostéril mèche", d:"30 cm", f:"Alginates et hydrofibres" },
  { n:"Urgosorb", d:"5×5 · 10×10 · mèche", f:"Alginates et hydrofibres" },
  { n:"Aquacel Extra", d:"5×5 · 10×10 · 15×15", f:"Alginates et hydrofibres" },
  { n:"Aquacel mèche", d:"2×45 cm", f:"Alginates et hydrofibres" },
  { n:"Biatain Alginate", d:"10×10 · mèche", f:"Alginates et hydrofibres" },

  { n:"Mepitel One", d:"5×7,5 · 10×18 · 13×15", f:"Interfaces et tulles" },
  { n:"Adaptic Touch", d:"5×7,6 · 7,6×11 · 12,7×15", f:"Interfaces et tulles" },
  { n:"Urgotul", d:"10×12 · 15×20", f:"Interfaces et tulles" },
  { n:"Physiotulle", d:"10×10 · 15×15", f:"Interfaces et tulles" },
  { n:"Jelonet / tulle gras", d:"10×10 · 10×40", f:"Interfaces et tulles" },

  { n:"Pansement au charbon actif", d:"10×10 · 10×20", f:"Pansements spécifiques" },
  { n:"Pansement à l'argent", d:"10×10 · 15×15", f:"Pansements spécifiques" },
  { n:"Super-absorbant", d:"10×20 · 20×20", f:"Pansements spécifiques" },
  { n:"Film polyuréthane transparent", d:"6×7 · 10×12 · 15×20", f:"Pansements spécifiques" },

  { n:"Compresses stériles non tissées", d:"7,5×7,5 · 10×10", f:"Compresses et gazes" },
  { n:"Compresses stériles de gaze", d:"7,5×7,5 · 10×10", f:"Compresses et gazes" },
  { n:"Compresses non stériles", d:"10×10, boîte de 100", f:"Compresses et gazes" },
  { n:"Set à pansement stérile", d:"à l'unité", f:"Compresses et gazes" },

  { n:"Sparadrap microporeux", d:"2,5 cm · 5 cm", f:"Fixation et bandes" },
  { n:"Bande de crêpe", d:"5 cm · 7 cm · 10 cm", f:"Fixation et bandes" },
  { n:"Bande cohésive", d:"6 cm · 8 cm · 10 cm", f:"Fixation et bandes" },
  { n:"Filet tubulaire de maintien", d:"doigt · main · bras · jambe", f:"Fixation et bandes" },
  { n:"Jersey tubulaire", d:"2,5 cm · 5 cm · 7,5 cm", f:"Fixation et bandes" },

  { n:"Sérum physiologique NaCl 0,9 %", d:"dosettes 5 ml · 10 ml · 20 ml", f:"Nettoyage et antiseptiques" },
  { n:"Eau stérile pour irrigation", d:"flacon 250 ml · 500 ml", f:"Nettoyage et antiseptiques" },
  { n:"Antiseptique à large spectre", d:"flacon", f:"Nettoyage et antiseptiques" },

  { n:"Bas de compression", d:"classe à préciser · mesures à prendre", f:"Contention" },
  { n:"Chaussettes de compression", d:"classe à préciser", f:"Contention" },
  { n:"Bande à allongement court", d:"8 cm · 10 cm", f:"Contention" },

  { n:"Sonde vésicale à demeure", d:"CH 14 · CH 16 · CH 18", f:"Sondage et urologie" },
  { n:"Sonde d'autosondage", d:"CH 12 · CH 14", f:"Sondage et urologie" },
  { n:"Étui pénien", d:"petit · moyen · grand", f:"Sondage et urologie" },
  { n:"Poche de recueil à urines", d:"jambe · nuit", f:"Sondage et urologie" },

  { n:"Perfuseur stérile", d:"à l'unité", f:"Perfusion" },
  { n:"Aiguille de Huber", d:"20G · 22G", f:"Perfusion" },
  { n:"Prolongateur", d:"10 cm · 25 cm", f:"Perfusion" },
  { n:"Robinet à trois voies", d:"à l'unité", f:"Perfusion" },
  { n:"Pansement de cathéter central", d:"8,5×11,5 · 10×12", f:"Perfusion" },

  { n:"Bandelettes d'autosurveillance", d:"boîte de 50", f:"Surveillance glycémique" },
  { n:"Lancettes", d:"boîte de 100", f:"Surveillance glycémique" },
  { n:"Aiguilles pour stylo injecteur", d:"4 mm · 5 mm · 6 mm · 8 mm", f:"Surveillance glycémique" },

  { n:"Coussin anti-escarre", d:"mousse · gel · air", f:"Prévention d'escarre" },
  { n:"Matelas anti-escarre", d:"mousse · air statique · air dynamique", f:"Prévention d'escarre" }
];

/* ── Les données de l'utilisateur ──
   `ajouts` : ses propres références. `retires` : les lignes du socle
   qu'il ne veut pas voir — on ne touche jamais au socle lui-même. */
function dispoData(){
  const d = essaiData("dispositifs");
  d.ajouts = d.ajouts || [];
  d.retires = d.retires || [];
  return d;
}
function dispoListe(){
  const d = dispoData();
  const socle = DISPO_SOCLE
    .filter(x => !d.retires.includes(x.n))
    .map(x => ({ ...x, socle:true }));
  return [...socle, ...d.ajouts.map(x => ({ ...x, socle:false }))];
}
function dispoFamilles(){
  const l = dispoListe();
  return DISPO_FAMILLES
    .map(f => ({ f, items:l.filter(x => x.f === f) }))
    .filter(g => g.items.length);
}

/* ── L'écran du catalogue ── */
let _dispoOuvert = null, _dispoQ = "";
function sheetDispositifs(pid){
  const q = (_dispoQ || "").trim().toLowerCase();
  const groupes = dispoFamilles()
    .map(g => ({ ...g, items: q ? g.items.filter(x =>
        (x.n + " " + (x.d||"") + " " + x.f).toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length);
  const total = dispoListe().length;

  openSheet(`
    ${navHeader(pid ? "Fiche" : "Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("dispositifs") : ""}
    <h3>🩹 Mes dispositifs</h3>
    <p class="small muted" style="margin-bottom:10px">${total} référence(s). Ajoute ce que tu utilises, retire ce qui ne te sert pas.</p>

    <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-bottom:10px">
      <span>🔍</span>
      <input id="di-q" class="rec-in" placeholder="Chercher une référence…" value="${esc(_dispoQ)}" style="flex:1;min-width:0">
      ${_dispoQ ? `<button class="lien-x" id="di-qx" aria-label="Effacer">✕</button>` : ""}
    </div>

    ${groupes.map(g => {
      const ouvert = q ? true : _dispoOuvert === g.f;
      return `<div class="di-g ${ouvert ? "on" : ""}">
        <button class="di-gh" data-dif="${esc(g.f)}">
          <span style="flex:1;min-width:0;text-align:left">${esc(g.f)}</span>
          <span class="di-n">${g.items.length}</span>
          <span class="di-fl">${ouvert ? "⌄" : "›"}</span>
        </button>
        ${ouvert ? g.items.map(x => `
          <div class="di-i">
            <span style="flex:1;min-width:0">
              <b>${esc(x.n)}</b>${x.socle ? "" : `<span class="di-tag">à moi</span>`}
              ${x.d ? `<br><span class="small muted">${esc(x.d)}</span>` : ""}
            </span>
            ${pid ? `<button class="btn btn-ghost btn-sm" data-dipick="${esc(x.n)}" style="width:auto;flex:0 0 auto">＋</button>`
                  : `<button class="lien-x" data-dirm="${esc(x.n)}" aria-label="Retirer">✕</button>`}
          </div>`).join("") : ""}
      </div>`;
    }).join("")}

    ${!groupes.length ? `<p class="small muted">Rien ne correspond à « ${esc(_dispoQ)} ».</p>` : ""}

    <button class="btn btn-ghost" id="di-add" style="width:100%;margin-top:10px">＋ Ajouter une référence</button>
    <button class="btn btn-ghost" id="di-xls" style="width:100%;margin-top:7px">📊 Classeur — exporter / importer</button>
    ${pid ? `<button class="btn btn-primary" id="di-ordo" style="width:100%;margin-top:10px">✍️ Composer une ordonnance</button>` : ""}
    <div class="tip" style="margin-top:12px">Ni code, ni tarif, ni mention de remboursement : seulement des noms et des dimensions, pour que la pharmacie lise sans déchiffrer.</div>`);
  bindNav(() => pid ? sheetPatient(getP(pid), "act") : sheetTours());
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();

  { const e = $("#di-q");
    if (e) e.oninput = () => { _dispoQ = e.value; const p2 = e.selectionStart;
      sheetDispositifs(pid); const n = $("#di-q"); if (n){ n.focus(); n.setSelectionRange(p2, p2); } }; }
  { const e = $("#di-qx"); if (e) e.onclick = () => { _dispoQ = ""; sheetDispositifs(pid); }; }
  $$("#sheet [data-dif]").forEach(b => b.onclick = () => {
    _dispoOuvert = (_dispoOuvert === b.dataset.dif) ? null : b.dataset.dif;
    sheetDispositifs(pid);
  });
  $$("#sheet [data-dirm]").forEach(b => b.onclick = async () => {
    const nom = b.dataset.dirm;
    const d = dispoData();
    const perso = d.ajouts.findIndex(x => x.n === nom);
    if (!await askDialog({ ic:"✕", titre:"Retirer « " + nom + " » ?",
      sub:perso >= 0 ? "C'est une de tes références." : "Elle disparaît de ta liste. Tu pourras la remettre par le classeur.",
      oui:"Retirer" })) return;
    if (perso >= 0) d.ajouts.splice(perso, 1);
    else d.retires.push(nom);
    save(true); sheetDispositifs(pid);
  });
  { const b = $("#di-add"); if (b) b.onclick = () => dispoAjouter(pid); }
  { const b = $("#di-xls"); if (b) b.onclick = () => sheetDispoClasseur(pid); }
  { const b = $("#di-ordo"); if (b) b.onclick = () => sheetOrdoDispo(pid); }
  $$("#sheet [data-dipick]").forEach(b => b.onclick = () => {
    _ordoPanier = _ordoPanier || [];
    const nom = b.dataset.dipick;
    const ref = dispoListe().find(x => x.n === nom);
    if (!_ordoPanier.some(x => x.n === nom)) _ordoPanier.push({ n:nom, d:ref ? ref.d : "", q:"1 boîte" });
    toast(nom + " ajouté");
  });
}

async function dispoAjouter(pid){
  const nom = await askText("Nouvelle référence", { ic:"🩹", ph:"Nom — ex. Mepilex Border" });
  if (!nom || !nom.trim()) return;
  const dim = await askText("Dimensions", { ic:"📏", ph:"ex. 10×10 · 15×15", sub:"Facultatif." });
  const fam = await askChoice({ ic:"📂", titre:"Dans quelle famille ?",
    options: DISPO_FAMILLES.map(f => ({ lbl:f, val:f })) });
  if (!fam) return;
  dispoData().ajouts.push({ n:nom.trim(), d:(dim || "").trim(), f:fam });
  save(true);
  _dispoOuvert = fam;
  toast("Référence ajoutée");
  sheetDispositifs(pid);
}

/* ── Le classeur ──
   ⚠️ Même principe que l'annuaire : on remplit au clavier sur un vrai
   écran, et l'import ne remplace jamais sans montrer ce qui change. */
function sheetDispoClasseur(pid){
  openSheet(`
    ${navHeader("Mes dispositifs", true)}
    <h3>📊 Le classeur</h3>
    <p class="small muted" style="margin-bottom:12px">Saisir trente références au pouce est pénible. Exporte, remplis au clavier, réimporte.</p>
    <button class="btn btn-ghost" id="dx-exp" style="width:100%;margin-bottom:7px">⬇️ Exporter mes dispositifs</button>
    <button class="btn btn-ghost" id="dx-imp" style="width:100%">⬆️ Importer un classeur</button>
    <!-- ⚠️ Un champ de fichier caché : c'est le seul moyen d'ouvrir le
         sélecteur du système. Même mécanisme que le classeur du cabinet. -->
    <input type="file" id="dx-file" accept=".xlsx" style="display:none">
    <div class="tip" style="margin-top:12px">Trois colonnes : <b>Nom</b>, <b>Dimensions</b>, <b>Famille</b>. Ne renomme pas l'onglet et ne déplace pas les colonnes.</div>
    <div class="warn" style="margin-top:9px">L'import <b>ajoute</b> ce qui manque et te montre ce qui diffère. Rien n'est écrasé sans que tu le voies.</div>`);
  bindNav(() => sheetDispositifs(pid));
  { const b = $("#dx-exp"); if (b) b.onclick = () => dispoExport(); }
  { const b = $("#dx-imp"), f = $("#dx-file");
    if (b && f){
      b.onclick = () => f.click();
      f.onchange = () => { const x = f.files && f.files[0]; if (x) dispoImport(x, pid); };
    } }
}

async function dispoExport(){
  let XL;
  toast("Préparation du classeur…");
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  wb.creator = "JM@Santé"; wb.created = new Date();
  const ws = wb.addWorksheet("Dispositifs");
  ws.getRow(1).values = ["Nom", "Dimensions", "Famille"];
  ws.getRow(1).eachCell(c => {
    c.font = { bold:true, color:{ argb:"FFFFFFFF" }, size:11 };
    c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF1D9E75" } };
  });
  ws.columns = [{ width:34 }, { width:34 }, { width:26 }];
  dispoListe().forEach((x, i) => {
    const r = i + 2;
    ws.getCell("A" + r).value = x.n;
    ws.getCell("B" + r).value = x.d || "";
    ws.getCell("C" + r).value = x.f;
  });
  /* La liste des familles, pour que la saisie reste cohérente */
  const wf = wb.addWorksheet("Familles");
  wf.getRow(1).values = ["Familles possibles"];
  DISPO_FAMILLES.forEach((f, i) => { wf.getCell("A" + (i + 2)).value = f; });
  wf.columns = [{ width:30 }];

  const buf = await wb.xlsx.writeBuffer();
  const b64 = _b64(new Uint8Array(buf));
  const nom = "Mes_dispositifs_" + new Date().toISOString().slice(0, 10) + ".xlsx";
  try {
    const ou = await saveToDevice(nom,
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + b64,
      { mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64:true });
    toast("Enregistré — " + ou);
    if (typeof partagerFichier === "function"){ try { await partagerFichier(nom); } catch(e){} }
  } catch(e){ toast("Export impossible", "danger"); }
}

async function dispoImport(fichier, pid){
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  let wb;
  try {
    wb = new XL.Workbook();
    await wb.xlsx.load(await fichier.arrayBuffer());
  } catch(e){ toast("Fichier illisible", "danger"); return; }
  const ws = wb.getWorksheet("Dispositifs");
  if (!ws){ toast("Onglet « Dispositifs » introuvable", "danger"); return; }

  const lus = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values || [];
    const txt = x => (x && x.text ? x.text : (x == null ? "" : String(x))).trim();
    const n = txt(v[1]); if (!n) return;
    lus.push({ n, d:txt(v[2]), f:DISPO_FAMILLES.includes(txt(v[3])) ? txt(v[3]) : "Autre" });
  });
  if (!lus.length){ toast("Aucune référence dans le classeur"); return; }

  /* ⚠️ Trois piles, comme pour l'annuaire : on montre avant d'appliquer. */
  const actuel = dispoListe();
  const nouveaux = lus.filter(x => !actuel.some(a => a.n.toLowerCase() === x.n.toLowerCase()));
  const differents = lus.filter(x => actuel.some(a =>
    a.n.toLowerCase() === x.n.toLowerCase() && ((a.d||"") !== (x.d||"") || a.f !== x.f)));

  if (!nouveaux.length && !differents.length){ toast("Rien de nouveau dans ce classeur"); return; }

  const choix = await askChoice({ ic:"📊", titre:"Classeur lu",
    sub: nouveaux.length + " nouvelle(s) · " + differents.length + " différente(s)",
    options:[
      { ic:"＋", lbl:"Ajouter les nouvelles seulement", sub:nouveaux.length + " référence(s)", val:"new" },
      { ic:"✓", lbl:"Ajouter et mettre à jour", sub:"les différences sont reprises", val:"tout" }
    ] });
  if (!choix) return;

  const d = dispoData();
  nouveaux.forEach(x => d.ajouts.push(x));
  if (choix === "tout"){
    differents.forEach(x => {
      const i = d.ajouts.findIndex(a => a.n.toLowerCase() === x.n.toLowerCase());
      if (i >= 0) d.ajouts[i] = x;
      else { d.retires.push(actuel.find(a => a.n.toLowerCase() === x.n.toLowerCase()).n); d.ajouts.push(x); }
    });
  }
  save(true);
  toast(nouveaux.length + " ajoutée(s)" + (choix === "tout" && differents.length ? " · " + differents.length + " mise(s) à jour" : ""));
  sheetDispositifs(pid);
}

/* ── Composer une ordonnance ── */
let _ordoPanier = [];
function sheetOrdoDispo(pid){
  const p = getP(pid);
  _ordoPanier = _ordoPanier || [];
  openSheet(`
    ${navHeader("Mes dispositifs", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("dispositifs") : ""}
    <h3>✍️ Ordonnance de dispositifs</h3>
    <p class="small muted" style="margin-bottom:10px">Pour ${esc(p ? (p.prenom||"") + " " + (p.nom||"").replace("Demo-","").toUpperCase() : "")}.</p>

    ${_ordoPanier.length ? _ordoPanier.map((x, i) => `
      <div class="di-i">
        <span style="flex:1;min-width:0"><b>${esc(x.n)}</b>
          ${x.d ? `<br><span class="small muted">${esc(x.d)}</span>` : ""}</span>
        <input class="rec-in" data-oq="${i}" value="${esc(x.q)}" style="flex:0 0 108px;min-width:0">
        <button class="lien-x" data-orm="${i}" aria-label="Retirer">✕</button>
      </div>`).join("")
      : `<p class="small muted">Rien pour l'instant. Ajoute des références depuis ton catalogue.</p>`}

    <button class="btn btn-ghost" id="od-pick" style="width:100%;margin-top:9px">＋ Prendre dans mon catalogue</button>
    <button class="btn btn-ghost" id="od-libre" style="width:100%;margin-top:7px">✏️ Ajouter une ligne libre</button>

    <div class="lab" style="margin-top:12px">Précisions pour la pharmacie</div>
    <textarea id="od-note" class="rec-in" rows="2" placeholder="Renouvelable, durée, remarques…">${esc((dispoData().note)||"")}</textarea>

    ${_ordoPanier.length ? `<button class="btn btn-primary" id="od-go" style="width:100%;margin-top:12px">📄 Préparer le document</button>` : ""}
    <div class="warn" style="margin-top:10px">Un brouillon à relire : <b>rien n'est signé</b> tant que tu n'as pas imprimé et signé toi-même.</div>`);
  bindNav(() => sheetDispositifs(pid));
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();
  $$("#sheet [data-oq]").forEach(e => e.onchange = () => { _ordoPanier[+e.dataset.oq].q = e.value.trim(); });
  $$("#sheet [data-orm]").forEach(b => b.onclick = () => { _ordoPanier.splice(+b.dataset.orm, 1); sheetOrdoDispo(pid); });
  { const b = $("#od-pick"); if (b) b.onclick = () => sheetDispositifs(pid); }
  { const b = $("#od-libre");
    if (b) b.onclick = async () => {
      const n = await askText("Ligne libre", { ic:"✏️", ph:"Ce que tu veux écrire" });
      if (!n || !n.trim()) return;
      _ordoPanier.push({ n:n.trim(), d:"", q:"" });
      sheetOrdoDispo(pid);
    }; }
  { const e = $("#od-note"); if (e) e.onchange = () => { dispoData().note = e.value.trim(); save(true); }; }
  { const b = $("#od-go"); if (b) b.onclick = () => ordoDispoProduire(pid); }
}

async function ordoDispoProduire(pid){
  if (!(await pdfPret())){ toast("Impossible de préparer le PDF ici", "danger"); return; }
  const p = getP(pid);
  const C = (typeof cabinet === "function") ? cabinet() : {};
  const sig = (typeof signatureChoix === "function" && C.id) ? signatureChoix(C.id) : { mode:"moi" };
  const E = (typeof enteteDocument === "function") ? enteteDocument(sig) : {};

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const MG = 18, L = 210 - MG * 2, V = [29, 122, 102], G = [85, 99, 94];
  const tete = pdfEnTete(doc, E, "Ordonnance de dispositifs medicaux", "");
  let y = Math.max(tete.y + 2, 56);

  if (E.mention){
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...G);
    doc.text(sansEmoji(E.mention), MG, y); y += 6;
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(26, 36, 32);
  if (p){
    const nom = ((p.prenom||"") + " " + (p.nom||"").replace("Demo-","").toUpperCase()).trim();
    doc.text(sansEmoji(nom), MG, y);
    if (p.dob) doc.text("Ne(e) le " + p.dob.split("-").reverse().join("/"), MG + 100, y);
    y += 6;
    if (p.nir){ doc.setFontSize(9.5); doc.setTextColor(...G);
      doc.text("N° " + p.nir, MG, y); y += 6; }
  }
  y += 3;
  doc.setDrawColor(...V); doc.setLineWidth(0.4);
  doc.line(MG, y, MG + L, y); y += 7;

  _ordoPanier.forEach(x => {
    if (y > 258){ doc.addPage(); y = 22; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(26, 36, 32);
    doc.text("- " + sansEmoji(x.n) + (x.q ? "  —  " + sansEmoji(x.q) : ""), MG, y);
    y += 4.6;
    if (x.d){
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
      doc.text(sansEmoji(x.d), MG + 4, y); y += 4.4;
    }
    y += 1.6;
  });

  const note = (dispoData().note || "").trim();
  if (note){
    y += 3;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
    doc.splitTextToSize(sansEmoji(note), L).forEach(l => {
      if (y > 272){ doc.addPage(); y = 22; }
      doc.text(l, MG, y); y += 4.4;
    });
  }

  y = Math.max(y + 10, 240);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...G);
  doc.text("Fait le :", MG, y);
  doc.setDrawColor(190, 198, 195);
  doc.line(MG + 15, y + 0.8, MG + 60, y + 0.8);
  y += 9;
  doc.text("Signature :", MG, y);
  doc.setDrawColor(210, 216, 213);
  doc.rect(MG, y + 2, L, 22);

  const base = "Ordonnance_dispositifs" + (p ? "_" + (p.prenom||"") + "_" + (p.nom||"").replace("Demo-","") : "")
    + "_" + new Date().toISOString().slice(0, 10);
  await pdfLivrer(doc, base);
}
