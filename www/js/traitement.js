/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   FICHE DE TRAITEMENT STRUCTURÉE
   ─────────────────────────────────────────────────────────
   Une ligne par médicament, quatre moments de prise, plus les
   traitements « si besoin ». Remplace avantageusement le texte
   libre : le DLU affiche un vrai tableau, la détection des
   anticoagulants devient fiable, et la fiche s'imprime.

   Modèle : p.traitement = {
     lignes: [{ id, nom, m, mi, s, c, sibesoin, forme, note, presc }],
     presc : id d'un médecin de p.medecins — absent = médecin traitant
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

/* Prescripteur d'une ligne. null = médecin traitant, ou spécialiste
   retiré de la fiche depuis (la ligne ne garde pas une étiquette morte). */
/* ============================================================
   DOCUMENTS RATTACHÉS — ordonnances du traitement, comptes rendus
   des antécédents
   ─────────────────────────────────────────────────────────
   p.liens = { traitement:[docId…], atcd:[docId…] } — 5 au maximum.
   ⚠️ Un lien EXPLICITE vers un document précis, pas une devinette
   par type : un patient a souvent plusieurs ordonnances (kiné,
   biologie, matériel) et la bonne n'est pas la plus récente.
   Le bouton pointe vers les Documents du patient : aucun doublon.
============================================================ */
const LIENS_MAX = 5;
function liensDe(p, cle){
  p.liens = p.liens || {};
  p.liens[cle] = (p.liens[cle] || []).filter(id => (p.docs||[]).some(d => d.id === id));
  return p.liens[cle];
}
function blocOrdos(p, cle){
  const ids = liensDe(p, cle);
  const quoi = cle === "traitement" ? "Ordonnances" : "Documents";
  return `
    <div class="rowlab vi" style="margin-top:14px"><span>📄 ${quoi} rattaché${ids.length>1?"s":""}</span><i></i>
      <em>${ids.length ? ids.length + " / " + LIENS_MAX : "aucun"}</em></div>
    <div class="rowbox vi" style="display:block">
      ${ids.map(id => { const d = (p.docs||[]).find(x => x.id === id) || {};
        return `<div class="lien-l">
          <span style="flex:1;min-width:0">
            <span class="lien-t">${docIcon(d)} ${esc(d.precision || d.name || "document")}</span>
            <span class="lien-s">${d.date ? fmtFR(d.date) : ""}${d.type ? " · " + esc(d.type) : ""}</span>
          </span>
          <button class="chip sm" data-lienvoir="${esc(id)}">Voir</button>
          <button class="lien-x" data-liendel="${esc(id)}" title="Détacher">✕</button>
        </div>`; }).join("")}
      ${ids.length >= LIENS_MAX
        ? `<p class="small muted" style="margin:6px 0 0">Maximum atteint : détaches-en un pour en rattacher un autre.</p>`
        : `<button class="lc-add" data-lienadd="${esc(cle)}">📎 Rattacher un document</button>`}
    </div>`;
}
function lierOrdos(p, cle, redraw){
  $$("#sheet [data-lienvoir]").forEach(b => b.onclick = () => {
    const d = (p.docs||[]).find(x => x.id === b.dataset.lienvoir);
    if (d) viewDoc(d); else toast("Document introuvable — il a été supprimé.");
  });
  $$("#sheet [data-liendel]").forEach(b => b.onclick = () => {
    p.liens[cle] = liensDe(p, cle).filter(id => id !== b.dataset.liendel);
    save(true); redraw(); toast("Document détaché");
  });
  $$("#sheet [data-lienadd]").forEach(b => b.onclick = () => choisirDocLien(p, cle, redraw));
}
/* Choisir parmi les documents DU PATIENT — jamais un nouvel import */
function choisirDocLien(p, cle, redraw){
  const deja = liensDe(p, cle);
  const docs = (p.docs||[]).filter(d => !deja.includes(d.id));
  if (!docs.length){ toast("Aucun document disponible — ajoute-le d'abord dans 📎 Documents."); return; }
  const rang = d => (cle === "traitement" && /ordonnance/i.test(d.type||"")) ? 0 : 1;
  docs.sort((a, b) => rang(a) - rang(b) || String(b.date||"").localeCompare(String(a.date||"")));
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📎 Rattacher un document</h3>
    <p class="small muted" style="margin-bottom:10px">Documents de ${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}.
      ${cle === "traitement" ? "Les ordonnances sont proposées en premier." : ""}</p>
    <div class="fc-list">
      ${docs.map(d => `<button class="lien-l" data-lienpick="${esc(d.id)}" style="width:100%;text-align:left;cursor:pointer">
        <span style="flex:1;min-width:0">
          <span class="lien-t">${docIcon(d)} ${esc(d.precision || d.name || "document")}</span>
          <span class="lien-s">${d.date ? fmtFR(d.date) : ""}${d.type ? " · " + esc(d.type) : ""}</span>
        </span></button>`).join("")}
    </div>
    <button class="btn btn-ghost" id="lien-cancel" style="width:100%;margin-top:12px">Annuler</button>`);
  bindNav(redraw);
  $$("#sheet [data-lienpick]").forEach(b => b.onclick = () => {
    liensDe(p, cle).push(b.dataset.lienpick);
    save(true); redraw(); toast("Document rattaché ✓");
  });
  { const b = $("#lien-cancel"); if (b) b.onclick = redraw; }
}

function prescDe(p, l){
  if (!l || !l.presc) return null;
  return medecinsDe(p).find(m => m.id === l.presc) || null;
}

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

  /* ⚠️ Ces trois états vivent DANS l'ouverture de la fiche, pas au niveau
     du module : ouverts sur un autre patient, ils repartent à zéro. Une
     sélection qui survivrait d'un dossier à l'autre ferait supprimer les
     lignes du mauvais. */
  let selMode = false;          // cases à cocher affichées
  const pris = new Set();       // identifiants cochés
  let soigOn = false;           // toutes les notes soignantes dépliées
  const deplie = new Set();     // notes dépliées une par une

  const draw = () => {
    const T = p.traitement || {};
    const L = T.lignes || [];
    const reg = L.filter(l => !l.sibesoin);
    const sib = L.filter(l => l.sibesoin);
    const ancien = (p.infos||[]).filter(i => i.type === "traitement" && (i.txt||"").trim());
    const avecSoig = L.filter(l => (l.soig||"").trim()).length;

    const ligne = l => {
      const ouvert = soigOn || deplie.has(l.id);
      const soig = (l.soig||"").trim();
      return `<div class="tr-r ${pris.has(l.id)?"on":""}" data-tid="${esc(l.id)}">
      ${selMode ? `<span class="tr-box">✓</span>` : ""}
      <span class="tr-n ${soig && !selMode ? "ouvrable" : ""}" ${soig && !selMode ? `data-tsoig="${esc(l.id)}"` : ""}>${
        esc(l.nom)}${l.forme?` <span class="tr-f">${formeIc(l.forme)}</span>`:""}${
        RX_ANTICOAG.test(l.nom) ? ` <span class="tr-w">anticoag.</span>` : ""}${
        soig ? `<span class="tr-i" title="Une note soignante existe">i</span>` : ""}
        ${l.note?`<span class="tr-note">${esc(l.note)}</span>`:""}${
        prescDe(p, l) ? `<span class="tr-presc">🩺 ${esc(medLabel(prescDe(p, l)))}</span>` : ""}</span>
      ${l.sibesoin
        ? `<span class="tr-sb">si besoin</span>`
        : ["m","mi","s","c"].map(k => `<span class="tr-d ${l[k]?"on":""}">${l[k]?esc(String(l[k])):"—"}</span>`).join("")}
      ${selMode ? "" : `<button class="tr-e" data-ted="${esc(l.id)}" title="Modifier">✏️</button>`}
      ${soig && ouvert && !selMode
        ? `<div class="tr-soig"><span class="t">🔒 note soignante</span>${esc(soig)}</div>` : ""}
    </div>`;
    };

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

      ${L.length ? `<div class="rowb" style="gap:7px;margin-bottom:9px">
        <button class="chip sm ${selMode?"on":""}" id="tr-sel">☑︎ ${selMode?"Quitter la sélection":"Sélectionner"}</button>
        ${selMode ? "" : `<button class="chip sm" id="tr-neuve">📋 Nouvelle ordonnance</button>`}
        ${avecSoig && !selMode ? `<button class="chip sm ${soigOn?"on":""}" id="tr-soigall">👁 Notes soignantes</button>` : ""}
      </div>` : ""}

      ${reg.length ? `<div class="trgrid ${selMode?"trsel":""}">
        <div class="tr-h">
          ${selMode ? `<span></span>` : ""}
          <span class="tr-n">Médicament</span>
          <span class="tr-d">M</span><span class="tr-d">Mi</span><span class="tr-d">S</span><span class="tr-d">C</span>
          ${selMode ? "" : `<span class="tr-e"></span>`}
        </div>
        ${reg.map(ligne).join("")}
      </div>` : `<p class="small muted" style="padding:10px 0">Aucun médicament — ajoute le premier ci-dessous.</p>`}

      ${sib.length ? `<div class="rowlab am" style="margin-top:14px"><span>Si besoin</span><i></i></div>
        <div class="trgrid ${selMode?"trsel":""}">${sib.map(ligne).join("")}</div>` : ""}

      ${selMode ? `<div class="trbar">
        <span class="n"><b>${pris.size}</b> sur ${L.length} coché${pris.size>1?"s":""}</span>
        <button class="btn btn-ghost btn-sm" id="tr-all">${pris.size===L.length?"Tout décocher":"Tout cocher"}</button>
        <button class="btn btn-sm" id="tr-del" ${pris.size?"":"disabled"}
          style="background:var(--danger-soft);border-color:var(--danger);color:var(--danger)">🗑 Supprimer</button>
      </div>` : ""}

      <button class="btn btn-ghost" id="tr-add" style="width:100%;margin-top:10px;border-style:dashed">＋ Ajouter un médicament</button>

      <div class="rowlab bl" style="margin-top:14px"><span>Depuis un classeur</span><i></i></div>
      <div class="rowbox bl" style="display:block">
        <p class="small muted" style="margin:0 0 8px">Un fichier Excel d'une ligne par médicament se reprend d'un coup. Tu relis tout avant que ça n'entre au dossier.</p>
        <div class="rowb" style="gap:8px">
          <button class="btn btn-ghost btn-sm" id="tr-xls-in" style="flex:1">📥 Importer</button>
          <button class="btn btn-ghost btn-sm" id="tr-xls-mod" style="flex:1">📄 Modèle vierge</button>
        </div>
      </div>
      <input type="file" id="tr-xls-file" accept=".xlsx" style="display:none">

      ${blocOrdos(p, "traitement")}

      <div class="field" style="margin-top:14px"><span class="lab">Note sur l'ordonnance <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></span>
        <input id="tr-presc" placeholder="Ordonnance du 03/09, renouvellement en décembre…" value="${esc(T.prescripteur||"")}"></div>

      ${L.length ? `<div class="rowb" style="margin-top:12px">
        <button class="btn btn-ghost" id="tr-print">🖨️ Imprimer</button>
        <button class="btn btn-ghost" id="tr-share">📤 Partager</button>
      </div>` : ""}`);

    bindNav(() => sheetPatient(p));
    $$("#sheet [data-ted]").forEach(b => b.onclick = () => editLigne(b.dataset.ted));
    lierOrdos(p, "traitement", () => sheetTraitement(p.id));
    $("#tr-add").onclick = () => editLigne(null);

    /* ---- Le pli de la note soignante ----
       ⚠️ `stopPropagation` : en mode sélection la rangée entière est
       cliquable, et sans ça ouvrir une note cocherait la ligne. */
    $$("#sheet [data-tsoig]").forEach(e => e.onclick = ev => {
      ev.stopPropagation();
      const id = e.dataset.tsoig;
      deplie.has(id) ? deplie.delete(id) : deplie.add(id);
      draw();
    });
    { const b = $("#tr-soigall"); if (b) b.onclick = () => {
      soigOn = !soigOn; deplie.clear(); draw(); }; }

    /* ---- Sélection multiple ---- */
    { const b = $("#tr-sel"); if (b) b.onclick = () => {
      selMode = !selMode; pris.clear(); draw(); }; }
    if (selMode){
      $$("#sheet .trgrid .tr-r").forEach(r => r.onclick = () => {
        const id = r.dataset.tid;
        pris.has(id) ? pris.delete(id) : pris.add(id);
        draw();
      });
      $("#tr-all").onclick = () => {
        if (pris.size === (p.traitement.lignes||[]).length) pris.clear();
        else (p.traitement.lignes||[]).forEach(l => pris.add(l.id));
        draw();
      };
      { const b = $("#tr-del"); if (b) b.onclick = () => supprimerLot(); }
    }

    /* ---- Le raccourci « Nouvelle ordonnance » ----
       Il n'ajoute AUCUNE mécanique : il entre dans le mode sélection avec
       tout coché, donc un seul chemin de suppression à maintenir. */
    { const b = $("#tr-neuve"); if (b) b.onclick = async () => {
      const n = (p.traitement.lignes||[]).length;
      const r = await askDialog({ ic:"📋", titre:"Nouvelle ordonnance",
        sub:`Le traitement compte <b>${n} médicament${n>1?"s":""}</b>. Que veux-tu en faire ?`,
        oui:"Tout effacer", non:"Choisir ce que je garde" });
      selMode = true; pris.clear();
      (p.traitement.lignes||[]).forEach(l => pris.add(l.id));
      draw();
      if (r) supprimerLot();      // sinon : tout est coché, il décoche ce qu'il garde
    }; }

    /* ⚠️ Suppression TOUJOURS annulable : une ordonnance entière effacée
       par erreur, c'est une saisie complète à refaire. On garde une copie
       de la liste d'avant, comme pour un passage validé. */
    function supprimerLot(){
      const L = p.traitement.lignes || [];
      const avant = L.map(l => ({ ...l }));
      const n = pris.size;
      if (!n) return;
      p.traitement.lignes = L.filter(l => !pris.has(l.id));
      p.traitement.maj = todayISO();
      pris.clear(); selMode = false;
      save();
      toast(n + " médicament" + (n>1?"s":"") + " retiré" + (n>1?"s":""), {
        label:"Annuler", ms:8000,
        action: () => { p.traitement.lignes = avant; save(); sheetTraitement(p.id); }
      });
      draw();
    }
    { const e = $("#tr-presc"); if (e) e.onchange = () => {
      p.traitement = p.traitement || { lignes:[] };
      p.traitement.prescripteur = e.value.trim(); save(); }; }
    { const b = $("#tr-print"); if (b) b.onclick = () => sortirTrait(p, "print"); }
    { const b = $("#tr-share"); if (b) b.onclick = () => sortirTrait(p, "share"); }
    { const b = $("#tr-xls-mod"); if (b) b.onclick = () => traitModeleXlsx(); }
    { const b = $("#tr-xls-in"), f = $("#tr-xls-file");
      if (b && f){
        b.onclick = () => { f.value = ""; f.click(); };
        /* ⚠️ `f.value = ""` avant chaque ouverture : sans ça, réimporter
           DEUX FOIS le même fichier ne déclenche aucun `change`. */
        f.onchange = () => { const x = f.files && f.files[0]; if (x) traitImportXlsx(x, p.id); };
      } }
  };

  /* ---------- Saisie d'une ligne ---------- */
  const editLigne = (tid) => {
    const L = traitLignes(p);
    const l = tid ? L.find(x => x.id === tid) : { id:uid(), nom:"", m:"", mi:"", s:"", c:"", sibesoin:false, forme:"cp", note:"" };
    if (!l) return;
    let forme = l.forme || "cp";
    let sib = !!l.sibesoin;
    let presc = l.presc || "";
    /* Seuls les médecins autres que le traitant : sans étiquette, c'est lui */
    const specs = medecinsDe(p).filter(m => m.spec !== "traitant" && (m.nom||m.tel));

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

        </div>
      <!-- ⚠️ Ce bloc était MASQUÉ tant qu'aucun spécialiste n'était
           enregistré : on ne pouvait pas deviner qu'un médicament peut
           porter son propre prescripteur. Il est désormais toujours là. -->
      <div class="rowlab vi"><span>Prescripteur de ce médicament</span><i></i>
        <em>${specs.length ? "facultatif" : "aucun spécialiste enregistré"}</em></div>
      <div class="rowbox vi" style="display:block;margin-bottom:12px">
        <div class="chips">
          <button class="chip ${!presc?"on":""}" data-tpr="" style="font-size:11.5px">🩺 Médecin traitant</button>
          ${specs.map(m => `<button class="chip ${presc===m.id?"on":""}" data-tpr="${esc(m.id)}" style="font-size:11.5px">🩺 ${esc(medLabel(m))}${m.nom?" · "+esc(m.nom):""}</button>`).join("")}
        </div>
        ${specs.length
          ? `<p class="small muted" style="margin:7px 0 0">Le pneumologue prescrit l'inhalateur, le généraliste le reste : chaque ligne garde son prescripteur.</p>`
          : `<p class="small muted" style="margin:7px 0 0">Ajoute d'abord le spécialiste dans <b>Fiche → Identité → Médecins</b> : il apparaîtra ici.</p>`}
      </div><div class="field"><span class="lab">Remarques <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— figurent sur la fiche du patient</span></span>
          <input id="te-note" placeholder="À jeun · pendant le repas · surveiller…" value="${esc(l.note||"")}"></div>

        <!-- ⚠️ DEUX REMARQUES, DEUX DESTINATIONS. Celle du dessus part sur la
             fiche remise au patient ; celle-ci reste au dossier. Le liseré bleu
             et le cadenas sont là pour qu'on ne se trompe pas en saisissant. -->
        <div class="field"><span class="lab" style="color:var(--blue)">🔒 Note soignante <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— à quoi sert ce médicament</span></span>
          <textarea id="te-soig" class="te-soig" rows="2"
            placeholder="Antalgique — douleurs du genou depuis la chute de juin">${esc(l.soig||"")}</textarea>
          <p class="small muted" style="margin:5px 0 0;font-size:10.5px">
            <b style="color:var(--blue)">Reste dans le dossier.</b> N'apparaît pas sur la fiche remise
            au patient, ni dans la relève, ni dans le DLU. À l'impression, seule la
            <b>version soignant</b> la fait sortir.</p></div>

        <div class="uiact" style="margin-top:6px">
          <button class="btn btn-ghost" id="te-cancel">Annuler</button>
          <button class="btn btn-primary" id="te-ok">${tid?"Enregistrer":"Ajouter"}</button>
        </div>
        ${tid ? `<button class="btn" id="te-del" style="width:100%;margin-top:8px;background:transparent;border-color:var(--danger);color:var(--danger)">🗑 Retirer ce médicament</button>` : ""}`);

      bindNav(draw);
      $$("#sheet [data-tf]").forEach(b => b.onclick = () => { forme = b.dataset.tf; grab(); drawEdit(); });
      $$("#sheet [data-tpr]").forEach(b => b.onclick = () => { presc = b.dataset.tpr; grab(); drawEdit(); });
      $("#te-reg").onclick = () => { sib = false; grab(); drawEdit(); };
      $("#te-sib").onclick = () => { sib = true;  grab(); drawEdit(); };
      $("#te-cancel").onclick = draw;
      $("#te-ok").onclick = () => {
        grab();
        if (!l.nom.trim()){ toast("Indique au moins le nom du médicament"); return; }
        p.traitement = p.traitement || { lignes:[] };
        p.traitement.lignes = p.traitement.lignes || [];
        l.forme = forme; l.sibesoin = sib;
        if (presc) l.presc = presc; else delete l.presc;
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
      l.soig = ($("#te-soig")?.value || "").trim();
      if (!sib) ["m","mi","s","c"].forEach(k => l[k] = ($("#te-"+k)?.value || "").trim());
    };
    drawEdit();
  };

  draw();
}

/* ---------- Fiche imprimable ---------- */
/* ⚠️ DEUX VERSIONS, ET LA QUESTION EST POSÉE AVANT DE SORTIR LA FICHE.
   La même fiche sert à deux choses : on la laisse chez le patient, et on la
   transmet à un collègue. La note soignante n'a rien à faire dans le premier
   cas. La version patient est proposée EN PREMIER : il faut demander la
   version soignant, elle n'arrive jamais par distraction.
   Sans note soignante dans le dossier, la question ne se pose pas. */
async function sortirTrait(p, mode){
  const aSoig = traitLignes(p).some(l => (l.soig||"").trim());
  let soignant = false;
  if (aSoig){
    soignant = await askDialog({ ic:"💊", titre:"Quelle version ?",
      sub:"Ce traitement porte des <b>notes soignantes</b>. Elles n'ont pas à figurer "
        + "sur la fiche laissée au patient.",
      non:"👤 Version patient", oui:"🩺 Version soignant" });
  }
  const html = traitHtml(p, { soignant });
  const base = "Traitement_" + (soignant ? "soignant_" : "")
             + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();
  if (mode === "share"){ shareText(html, base + ".html", "text/html"); return; }
  showFichePreview(html, base);
  if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
}

function traitHtml(p, opts){
  /* ⚠️ `soignant` n'est VRAI que si on l'a explicitement demandé : le défaut
     d'un paramètre absent doit être la version la plus sûre. */
  const soignant = !!(opts && opts.soignant);
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const T = p.traitement || {};
  const L = T.lignes || [];
  const reg = L.filter(x => !x.sibesoin), sib = L.filter(x => x.sibesoin);
  const vig = (p.infos||[]).filter(i => i.type === "vigilance" && (i.txt||"").trim())
                           .map(i => i.txt.trim()).join(" · ");
  const med = medecinTraitant(p);

  const row = l => `<tr>
    <td class="nm">${RX_ANTICOAG.test(l.nom)?`<b>${esc(l.nom)}</b>`:esc(l.nom)}${l.forme&&l.forme!=="cp"?` ${formeIc(l.forme)}`:""}</td>
    ${l.sibesoin
      ? `<td colspan="4" class="sb">si besoin</td>`
      : ["m","mi","s","c"].map(k => `<td class="d">${l[k] ? `<b>${esc(String(l[k]))}</b>` : "—"}</td>`).join("")}
    <td class="rm">${esc(l.note||"")}${soignant && (l.soig||"").trim()
      ? `<span class="sg">🔒 ${esc(l.soig.trim())}</span>` : ""}${prescDe(p, l)
      ? `<span class="pr">Prescrit par : ${esc(medLabel(prescDe(p, l)))}${prescDe(p, l).nom ? " — " + esc(prescDe(p, l).nom) : ""}</span>` : ""}${RX_ANTICOAG.test(l.nom)?`<span class="ac">Anticoagulant — surveiller les saignements</span>`:""}</td>
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
 td.rm .pr{ display:block;color:#3a5a90;font-size:8.5pt;margin-top:2px }
 td.rm .sg{ display:block;color:#14506e;background:#eaf3f8;border-left:2px solid #14506e;
            padding:2px 5px;margin-top:3px;font-size:8.5pt }
 .vso{ background:#eaf3f8;border-left:3px solid #14506e;padding:5px 10px;font-size:8.5pt;
       color:#14506e;margin-bottom:9px }
 tr:nth-child(even) td{ background:#fafcfb }
 h2{ font-size:10pt;color:#005A50;margin:14px 0 5px;text-transform:uppercase;letter-spacing:.04em }
 .vig{ background:#fdeaea;border-left:3px solid #a01c1c;padding:6px 10px;font-size:9.5pt;margin-top:11px }
 footer{ margin-top:12px;padding-top:7px;border-top:1px solid #d8e3df;
         font-size:8pt;color:#8a9a95;text-align:center }
 @media screen{ body{background:#e8eeec;padding:14px} }
</style></head><body>
<div class="hd">
  <div>
    <div class="t">FICHE DE TRAITEMENT${soignant ? " — VERSION SOIGNANT" : ""}</div>
    <div class="id"><b>${esc(nom)}</b>${p.dob?` — née le ${p.dob.split("-").reverse().join("/")}`:""}</div>
  </div>
  <div class="mj">${T.maj?`Mise à jour<br>${T.maj.split("-").reverse().join("/")}`:""}</div>
</div>

${soignant ? `<div class="vso"><b>🔒 Version soignant.</b> Elle porte les notes réservées à l'équipe
  — à ne pas laisser au domicile. La version patient s'obtient depuis le même bouton.</div>` : ""}

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

/* ============================================================
   IMPORT D'UN CLASSEUR DE TRAITEMENT
   ─────────────────────────────────────────────────────────
   Ressaisir vingt lignes de traitement chez le patient prend
   dix minutes. Un classeur Excel normé les pose d'un coup.

   ⚠️ CE N'EST PAS UNE RECONNAISSANCE AUTOMATIQUE. L'application
   ne devine jamais une posologie : ce qu'elle ne sait pas lire,
   elle le signale et le laisse à compléter à la main. Rien
   n'entre dans le dossier avant l'écran de relecture.

   ⚠️ L'import N'EFFACE JAMAIS. Un médicament déjà présent est
   proposé en « à mettre à jour », décochable ligne par ligne.

   LA NORME — premier onglet du classeur, ligne 1 = en-têtes.
   L'ordre des colonnes est libre, la casse et les accents sont
   indifférents, les colonnes inconnues sont ignorées.

     Médicament   obligatoire   DOLIPRANE
     Dosage                     1000 mg
     Forme                      comprimé | injectable | gouttes
                                | patch | autre
     Matin Midi Soir Coucher    1 · 0,5 · vide
     Fréquence                  à la place des quatre colonnes :
                                « 1-0-1-0 », « 1 matin et 1 soir »,
                                « si besoin »
     Remarques                  si douleur > 4

   Les quatre colonnes de moment, dès qu'une seule est remplie,
   l'emportent sur « Fréquence » : ce sont elles qui sont sûres.
============================================================ */

const _traitSa = t => String(t||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().trim();
const _traitNb  = v => String(v).replace(",",".");

/* Les en-têtes acceptés. Un classeur venu d'une pharmacie ou d'une
   sortie d'hôpital ne porte pas les mêmes mots que le nôtre. */
const TRAIT_XLS_COLS = {
  nom:   /^(medicament|medicaments|nom|nom du medicament|produit|specialite|dci|molecule|traitement)$/,
  dose:  /^(dosage|dose|force|posologie unitaire)$/,
  forme: /^(forme|forme galenique|galenique|presentation)$/,
  m:     /^(matin|m)$/,
  mi:    /^(midi|mi)$/,
  s:     /^(soir|s)$/,
  c:     /^(coucher|nuit|c)$/,
  freq:  /^(frequence|posologie|rythme|prise|prises|schema)$/,
  note:  /^(remarque|remarques|note|notes|commentaire|commentaires|observation|observations)$/,
  sib:   /^(si besoin|sibesoin|conditionnel|a la demande)$/
};

const TRAIT_MOMENTS_RX = [
  ["m",  /^(matin|matinal|pdj|petit *dejeuner|reveil|8h)$/],
  ["mi", /^(midi|dejeuner|12h)$/],
  ["s",  /^(soir|soiree|diner|dinner|18h|19h|20h)$/],
  ["c",  /^(coucher|couche|nuit|22h)$/]
];
const _TRAIT_MOTS = "matin|matinal|pdj|petit *dejeuner|reveil|midi|dejeuner|soir|soiree|diner|dinner|coucher|couche|nuit";
const _traitMoment = mot => {
  const m = _traitSa(mot).replace(/s$/,"");
  for (const [k, rx] of TRAIT_MOMENTS_RX) if (rx.test(m)) return k;
  return null;
};

/* Lecture d'une fréquence écrite en clair.
   `lu:false` = non comprise : la ligne entrera SANS posologie et sera
   marquée à compléter. On préfère un blanc visible à une invention. */
function traitFreqLire(txt){
  const r = { m:"", mi:"", s:"", c:"", sibesoin:false, lu:false };
  const t = _traitSa(txt);
  if (!t) return r;

  if (/si *besoin|a la demande|au besoin|\bsb\b|conditionnel|ponctuel/.test(t)){
    r.sibesoin = true; r.lu = true; return r;
  }
  /* Suite chiffrée « 1-0-1-0 » : la notation la plus répandue sur les
     ordonnances. Trois valeurs = matin, midi, soir. */
  if (/^\d+(?:[.,]\d+)?(?:\s*[-\/|·]\s*\d+(?:[.,]\d+)?){1,3}$/.test(t)){
    const n = t.split(/\s*[-\/|·]\s*/).map(_traitNb);
    if (n.length === 3 || n.length === 4){
      ["m","mi","s","c"].forEach((k,i) => { if (n[i] && Number(n[i])) r[k] = n[i]; });
      r.lu = true; return r;
    }
    /* Deux valeurs : impossible de savoir si c'est matin-midi ou
       matin-soir. On ne devine PAS une posologie. */
    return r;
  }
  /* Forme en mots. Deux lectures, puis un rattrapage : « 1 cp matin,
     midi et soir » ne porte qu'un seul chiffre pour trois moments. */
  const UNITE = "(?:cp|comprimes?|gelules?|gouttes?|doses?|unites?|ui|mg|ml|sachets?|bouffees?)?";
  const vus = {};
  [...t.matchAll(new RegExp("(\\d+(?:[.,]\\d+)?)\\s*" + UNITE + "\\s*(?:le |au |du |a |en |de )*(" + _TRAIT_MOTS + ")", "g"))]
    .forEach(mm => { const k = _traitMoment(mm[2]); if (k) vus[k] = _traitNb(mm[1]); });
  [...t.matchAll(new RegExp("(" + _TRAIT_MOTS + ")\\s*[:=]\\s*(\\d+(?:[.,]\\d+)?)", "g"))]
    .forEach(mm => { const k = _traitMoment(mm[1]); if (k) vus[k] = _traitNb(mm[2]); });
  const nbs = t.match(/\d+(?:[.,]\d+)?/g) || [];
  const parDefaut = nbs.length === 1 ? _traitNb(nbs[0]) : "1";
  [...t.matchAll(new RegExp("(" + _TRAIT_MOTS + ")", "g"))].forEach(mm => {
    const k = _traitMoment(mm[1]); if (k && !vus[k]) vus[k] = parDefaut;
  });
  Object.entries(vus).forEach(([k,v]) => { if (Number(v)) r[k] = v; r.lu = true; });
  return r;
}

/* La forme galénique ramenée aux cinq cases de la fiche. Tout ce qui
   n'est ni avalé, ni piqué, ni liquide, ni collé tombe dans « Autre » :
   une pommade n'a pas de case à elle, et ce n'est pas grave. */
const TRAIT_FORMES_ALIAS = [
  ["cp",   /comprime|^cp$|^cpr$|gelule|capsule|dragee|orodisper|sublingual|lyoc|^gel$/],
  ["inj",  /injec|^inj$|seringue|stylo|^sc$|^im$|^iv$|ampoule|perfusion/],
  ["got",  /goutte|^got$|collyre|buvable|sirop|suspension|solution orale|^ml$/],
  ["patch",/patch|transderm/]
];
function traitFormeDepuis(txt){
  const t = _traitSa(txt); if (!t) return "";
  for (const [k, rx] of TRAIT_FORMES_ALIAS) if (rx.test(t)) return k;
  return "aut";
}

/* ── LE MODÈLE VIERGE ──
   La norme ne se décrit pas dans un guide qu'on ne lira pas : on la
   livre sous forme de classeur, avec ses listes déroulantes et deux
   exemples. C'est lui, la définition. */
async function traitModeleXlsx(){
  let XL;
  toast("Préparation du modèle…");
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }

  const wb = new XL.Workbook();
  wb.creator = "JM@Santé"; wb.created = new Date();
  const LIGNES = 200;

  const ws0 = wb.addWorksheet("Lisez-moi");
  ws0.getColumn(1).width = 104;
  [["JM@Santé — modèle de plan de traitement", 15, true],
   ["", 11, false],
   ["Remplis l'onglet « Traitement ». Une ligne par médicament.", 11, false],
   ["", 11, false],
   ["Médicament : obligatoire. Le nom tel qu'il est écrit sur la boîte.", 11, false],
   ["Dosage : 1000 mg, 2,5 mg, 100 UI… Il sera accolé au nom.", 11, false],
   ["Forme : choisis dans la liste déroulante.", 11, false],
   ["Matin / Midi / Soir / Coucher : le nombre de prises. Laisse vide s'il n'y en a pas.", 11, false],
   ["Fréquence : à n'utiliser QUE si tu ne remplis pas les quatre colonnes ci-dessus.", 11, false],
   ["     Formes comprises : « 1-0-1-0 », « 1-0-1 », « 1 matin et 1 soir », « si besoin ».", 10, false],
   ["     Une fréquence non comprise (« 3x/j ») entre sans posologie et reste à compléter.", 10, false],
   ["Remarques : « si douleur > 4 », « à jeun », « ne pas écraser »…", 11, false],
   ["", 11, false],
   ["Tu peux renommer les colonnes au pluriel ou sans accent, et les déplacer.", 10, false],
   ["Les colonnes que l'application ne connaît pas sont simplement ignorées.", 10, false],
   ["", 11, false],
   ["L'import ne remplace rien sans te le demander : un écran de relecture", 10, false],
   ["te montre chaque ligne avant qu'elle n'entre dans le dossier.", 10, false],
   ["", 11, false],
   ["EXEMPLES — à recopier dans l'onglet « Traitement »", 12, true],
   ["     DOLIPRANE | 1000 mg | comprimé | Matin 1 | Midi 1 | Soir 1 | « 6 h entre deux prises »", 10, false],
   ["     ELIQUIS | 2,5 mg | comprimé | Fréquence « 1-0-1-0 »", 10, false],
   ["     LOVENOX | 4000 UI | injectable | Coucher 1 | « sous-cutané »", 10, false],
   ["     SPASFON | | comprimé | Fréquence « si besoin » | « si douleur »", 10, false]
  ].forEach(([t, sz, b], i) => {
    const c = ws0.getCell("A" + (i + 1));
    c.value = t; c.font = { size: sz, bold: !!b };
  });

  const ws = wb.addWorksheet("Traitement");
  const COLS = [["Médicament", 30], ["Dosage", 14], ["Forme", 15],
                ["Matin", 8], ["Midi", 8], ["Soir", 8], ["Coucher", 10],
                ["Fréquence", 22], ["Remarques", 34]];
  ws.columns = COLS.map(([h, w]) => ({ header: h, width: w }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).height = 22;
  ws.views = [{ state:"frozen", ySplit:1 }];

  /* ⚠️ AUCUN exemple dans cet onglet : une ligne de démonstration oubliée
     serait importée avec les vraies et ferait entrer un médicament que le
     patient ne prend pas. Les exemples sont dans « Lisez-moi ». */

  for (let r = 2; r <= LIGNES; r++){
    ws.getCell("C" + r).dataValidation = {
      type:"list", allowBlank:true,
      formulae:['"comprimé,injectable,gouttes,patch,autre"'],
      showErrorMessage:false       // la liste propose, elle n'impose pas
    };
    ["D","E","F","G"].forEach(col => { ws.getCell(col + r).numFmt = "General"; });
  }

  const buf = await wb.xlsx.writeBuffer();
  await cabLivrer("JMSante_Modele_traitement.xlsx", buf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* ── LA LECTURE ── */
async function traitImportXlsx(fichier, pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable", "danger"); return; }
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  try { await wb.xlsx.load(await fichier.arrayBuffer()); }
  catch(e){ toast("Fichier illisible", "danger"); logIncident("traitement", "Import xlsx", e); return; }

  /* L'onglet « Traitement » s'il existe, sinon le premier : un classeur
     reçu d'ailleurs n'a aucune raison de porter nos noms d'onglets. */
  const ws = wb.getWorksheet("Traitement") || wb.worksheets[0];
  if (!ws){ toast("Classeur vide", "danger"); return; }

  const txt = v => v == null ? ""
    : (typeof v === "object" ? String(v.text ?? v.result ?? v.richText?.map(r=>r.text).join("") ?? "") : String(v)).trim();

  /* Repérage des colonnes par leur en-tête, où qu'elles soient. */
  const entetes = (ws.getRow(1).values || []).map(txt);
  const col = {};
  entetes.forEach((h, i) => {
    const n = _traitSa(h).replace(/\s+/g, " ");
    if (!n) return;
    for (const [cle, rx] of Object.entries(TRAIT_XLS_COLS))
      if (rx.test(n) && col[cle] == null) col[cle] = i;
  });

  if (col.nom == null){
    await askDialog({ ton:"danger", ic:"📄", titre:"Colonne « Médicament » introuvable",
      sub: entetes.filter(Boolean).length
        ? "La première ligne contient : " + entetes.filter(Boolean).slice(0,6).map(esc).join(" · ")
        : "La première ligne du classeur est vide.",
      warn:"La ligne 1 doit porter les en-têtes, dont « Médicament ». Récupère le modèle vierge depuis la fiche de traitement.",
      oui:"J'ai compris", seul:true });
    return;
  }

  const lus = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values || [];
    const lire = cle => col[cle] == null ? "" : txt(v[col[cle]]);
    const nomBrut = lire("nom");
    if (!nomBrut) return;                       // ligne vide ou séparateur

    const dose = lire("dose");
    /* On n'accole pas un dosage déjà écrit dans le nom : « DOLIPRANE
       1000 mg » + « 1000 mg » donnerait un libellé absurde. */
    const nom = dose && !_traitSa(nomBrut).includes(_traitSa(dose))
      ? nomBrut + " " + dose : nomBrut;

    const l = { id: uid(), nom, m:"", mi:"", s:"", c:"",
                sibesoin:false, forme: traitFormeDepuis(lire("forme")), note: lire("note") };
    let souci = "";

    /* Les quatre colonnes de moment l'emportent dès qu'une est remplie. */
    const parCol = ["m","mi","s","c"].map(k => lire(k));
    const aDesColonnes = parCol.some(x => x !== "" && Number(_traitNb(x)) > 0);
    if (aDesColonnes){
      ["m","mi","s","c"].forEach((k, j) => {
        const n = Number(_traitNb(parCol[j]));
        if (n > 0) l[k] = _traitNb(parCol[j]);
      });
    } else {
      const f = traitFreqLire(lire("freq"));
      if (f.lu){ l.m=f.m; l.mi=f.mi; l.s=f.s; l.c=f.c; l.sibesoin=f.sibesoin; }
      else if (lire("freq")){
        souci = "fréquence non comprise";
        /* Le texte d'origine n'est pas perdu : il part en remarque, pour
           que l'IDEL puisse trancher sans rouvrir le classeur. */
        l.note = [l.note, "fréquence au classeur : " + lire("freq")].filter(Boolean).join(" · ");
      } else souci = "aucune posologie";
    }
    if (/^(oui|o|x|1|vrai|true)$/i.test(lire("sib"))) l.sibesoin = true;
    if (l.sibesoin){ l.m=l.mi=l.s=l.c=""; souci = ""; }
    if (!l.forme) l.forme = "cp";

    lus.push({ l, souci, ligne: i });
  });

  if (!lus.length){
    await askDialog({ ic:"📄", titre:"Aucun médicament dans ce classeur",
      sub:"Les en-têtes ont été reconnus, mais aucune ligne ne porte de nom de médicament.",
      oui:"Fermer", seul:true });
    return;
  }
  traitRelire(p, lus);
}

/* ── L'ÉCRAN DE RELECTURE ──
   ⚠️ Le seul endroit où l'import touche au dossier. Tout est coché au
   départ : on décoche ce qu'on refuse, c'est le cas le plus rare. */
function traitRelire(p, lus){
  const dejaLa = traitLignes(p);
  const cle = n => _traitSa(n).replace(/\s+/g, " ");
  lus.forEach(o => { o.ancien = dejaLa.find(a => cle(a.nom) === cle(o.l.nom)) || null; });

  const pris = new Set(lus.map((_, i) => "i" + i));
  const poso = l => l.sibesoin ? "si besoin"
    : (["m","mi","s","c"].map(k => l[k] || "—").join(" · "));

  const draw = () => {
    const ligne = (o, i) => `<button class="selv ${pris.has("i"+i)?"on":""}" data-tri="${i}">
      <span class="box">${pris.has("i"+i)?"✓":""}</span>
      <span class="sv" style="flex:1;min-width:0">
        <b>${esc(o.l.nom)}</b> ${o.l.forme?formeIc(o.l.forme):""}
        <br><span class="small muted">${esc(poso(o.l))}${o.l.note?" · "+esc(o.l.note):""}</span>
        ${o.ancien ? `<br><span class="small" style="color:var(--amber,var(--accent))">remplace « ${esc(poso(o.ancien))} »</span>` : ""}
        ${o.souci ? `<br><span class="small" style="color:var(--amber,var(--accent))">⚠ ${esc(o.souci)} — à compléter à la main</span>` : ""}
      </span></button>`;

    const neufs = lus.map((o,i)=>[o,i]).filter(([o]) => !o.ancien);
    const maj   = lus.map((o,i)=>[o,i]).filter(([o]) =>  o.ancien);
    const souci = lus.filter(o => o.souci).length;

    openSheet(`
      ${navHeader("Traitement", true)}
      <h3 style="margin-bottom:2px">📥 Classeur relu — ${lus.length} ligne${lus.length>1?"s":""}</h3>
      <p class="small muted" style="margin-bottom:10px">Rien n'est encore enregistré. Décoche ce que tu ne veux pas reprendre.</p>
      ${souci ? `<div class="tip" style="margin-bottom:10px"><b>${souci} ligne${souci>1?"s":""} sans posologie lisible.</b>
        <p class="small muted" style="margin:5px 0 0">Elles entreront avec les moments vides : la fréquence du classeur est recopiée en remarque pour que tu puisses la saisir.</p></div>` : ""}

      ${neufs.length ? `<div class="rowlab vi"><span>Nouveaux</span><i></i><em>${neufs.length}</em></div>
        ${neufs.map(([o,i]) => ligne(o,i)).join("")}` : ""}
      ${maj.length ? `<div class="rowlab am" style="margin-top:12px"><span>Déjà au dossier</span><i></i><em>${maj.length}</em></div>
        ${maj.map(([o,i]) => ligne(o,i)).join("")}` : ""}

      <div class="rowb" style="margin-top:16px;gap:8px">
        <button class="btn btn-ghost" id="tri-non" style="flex:1">Annuler</button>
        <button class="btn btn-primary" id="tri-ok" style="flex:1">Reprendre ${pris.size} ligne${pris.size>1?"s":""}</button>
      </div>`);

    bindNav(() => sheetTraitement(p.id));
    $$("#sheet [data-tri]").forEach(b => b.onclick = () => {
      const k = "i" + b.dataset.tri;
      pris.has(k) ? pris.delete(k) : pris.add(k);
      draw();
    });
    $("#tri-non").onclick = () => sheetTraitement(p.id);
    $("#tri-ok").onclick = () => {
      if (!pris.size){ toast("Rien de coché"); return; }
      p.traitement = p.traitement || { lignes:[] };
      p.traitement.lignes = p.traitement.lignes || [];
      let ajout = 0, remplace = 0;
      lus.forEach((o, i) => {
        if (!pris.has("i" + i)) return;
        if (o.ancien){
          /* On garde l'identifiant et le prescripteur de la ligne
             existante : un médicament suivi ne doit pas changer d'identité
             au passage d'un classeur. */
          const g = o.ancien;
          g.nom = o.l.nom; g.forme = o.l.forme; g.sibesoin = o.l.sibesoin;
          ["m","mi","s","c"].forEach(k => g[k] = o.l[k]);
          if (o.l.note) g.note = o.l.note;
          remplace++;
        } else {
          p.traitement.lignes.push(o.l); ajout++;
        }
      });
      p.traitement.maj = todayISO();
      save();
      toast(ajout + " ajouté" + (ajout>1?"s":"") + (remplace ? " · " + remplace + " mis à jour" : ""));
      sheetTraitement(p.id);
    };
  };
  draw();
}
