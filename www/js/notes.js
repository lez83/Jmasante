/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   MES NOTES — un espace libre, mais qu'on retrouve
   ─────────────────────────────────────────────────────────
   Le pense-bête du quotidien : la boulangerie pour Mme X, le déroulé
   d'un soin technique à revoir, la compta avant vendredi, les papiers
   à scanner. Pas forcément du soin, mais utile.

   ⚠️ STRICTEMENT PRIVÉ. Ces notes ne partent JAMAIS dans une synchro :
   ni les notes, ni les étiquettes. C'est la demande explicite de
   l'utilisateur, et c'est ce qui permet d'y écrire sans se demander qui
   lira. Un test le vérifie sur le contenu du fichier de synchro.

   ⚠️ CE N'EST PAS UN DOSSIER DE SOIN. Une observation clinique se note
   dans le passage du patient, pas ici : sinon elle ne part pas dans la
   relève et personne ne la lit. L'écran le dit.

   ⚠️ LES ÉTIQUETTES SONT À L'UTILISATEUR : il les crée, les renomme,
   les recolore, les supprime. Six sont proposées au départ, aucune
   n'est imposée.

   ⚠️ Une note peut citer des patients. Si un dossier est supprimé, la
   citation doit cesser de pointer dans le vide — même piège que les
   identifiants fantômes de l'ordre de passage.
============================================================ */

const NOTE_ETIQ_DEF = [
  { id:"pat",   n:"Patients",  c:"blue" },
  { id:"soin",  n:"Soins",     c:"accent" },
  { id:"adm",   n:"Admin",     c:"amber" },
  { id:"perso", n:"Perso",     c:"violet" },
  { id:"achat", n:"Courses",   c:"blue" },
  { id:"idee",  n:"Idées",     c:"accent" }
];
const NOTE_COULEURS = [
  { c:"accent", n:"Vert" }, { c:"blue", n:"Bleu" },
  { c:"amber", n:"Ambre" }, { c:"violet", n:"Violet" }, { c:"gris", n:"Gris" }
];

function notes(){ return (S.notes = S.notes || []); }
function noteEtiquettes(){
  if (!S.noteEtiq) S.noteEtiq = JSON.parse(JSON.stringify(NOTE_ETIQ_DEF));
  return S.noteEtiq;
}
function noteEtiq(id){ return noteEtiquettes().find(e => e.id === id); }

/* ⚠️ Appelé à la suppression d'un dossier : une citation qui pointe
   dans le vide afficherait un nom fantôme, ou pire, rien du tout. */
function notesOublierPatient(pid){
  notes().forEach(n => { if (n.pats) n.pats = n.pats.filter(x => x !== pid); });
}

let _noteFiltre = "tout", _noteQ = "";

function sheetNotes(pid){
  const q = (_noteQ || "").trim().toLowerCase();
  let l = [...notes()];
  if (pid) l = l.filter(n => (n.pats || []).includes(pid));
  if (_noteFiltre === "epingle") l = l.filter(n => n.pin);
  else if (_noteFiltre === "faites") l = l.filter(n => n.fait);
  else if (_noteFiltre !== "tout") l = l.filter(n => (n.etiq || []).includes(_noteFiltre));
  if (q) l = l.filter(n => ((n.t || "") + " " + (n.m || "")).toLowerCase().includes(q));
  if (_noteFiltre !== "faites") l = l.filter(n => !n.fait || q);

  const epingles = l.filter(n => n.pin);
  const autres = l.filter(n => !n.pin);
  const faites = notes().filter(n => n.fait).length;

  const carte = n => `
    <div class="no-c ${n.pin ? "pin" : ""} ${n.fait ? "fait" : ""}">
      <div class="no-l">
        <button class="no-ck ${n.fait ? "on" : ""}" data-nok="${n.id}" aria-label="${n.fait ? "Rouvrir" : "Marquer fait"}">${n.fait ? "✓" : ""}</button>
        <button class="no-b" data-noed="${n.id}">
          <span class="no-t ${n.fait ? "barre" : ""}">${esc(n.t || "(sans titre)")}</span>
          ${n.m ? `<span class="no-m">${esc(n.m.length > 90 ? n.m.slice(0, 90) + "…" : n.m)}</span>` : ""}
        </button>
        <button class="no-pin" data-nopin="${n.id}" aria-label="${n.pin ? "Détacher" : "Épingler"}">${n.pin ? "📌" : "📍"}</button>
      </div>
      ${((n.etiq || []).length || (n.pats || []).length) ? `
        <div class="no-tags">
          ${(n.etiq || []).map(id => { const e = noteEtiq(id);
            return e ? `<span class="no-tg ${esc(e.c)}">${esc(e.n)}</span>` : ""; }).join("")}
          ${(n.pats || []).map(x => { const p = getP(x);
            return p ? `<button class="no-tg pat" data-nopat="${x}">👤 ${esc((p.nom||"").replace("Demo-","").toUpperCase())}</button>` : ""; }).join("")}
        </div>` : ""}
    </div>`;

  openSheet(`
    ${navHeader(pid ? "Fiche" : "Réglages", true)}
    <h3>📝 Mes notes</h3>
    <p class="small muted" style="margin-bottom:10px">${pid
      ? "Les notes qui citent ce patient."
      : "Ton pense-bête. Il ne part nulle part : ni synchro, ni relève."}</p>

    ${!pid ? `
      <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-bottom:9px">
        <span>🔍</span>
        <input id="no-q" class="rec-in" placeholder="Chercher dans mes notes…" value="${esc(_noteQ)}" style="flex:1;min-width:0">
        ${_noteQ ? `<button class="lien-x" id="no-qx" aria-label="Effacer">✕</button>` : ""}
      </div>
      <div class="no-fil">
        <button class="chip ${_noteFiltre === "tout" ? "on" : ""}" data-nof="tout">Tout</button>
        <button class="chip ${_noteFiltre === "epingle" ? "on" : ""}" data-nof="epingle">📌 Épinglées</button>
        ${noteEtiquettes().map(e => `<button class="chip ${_noteFiltre === e.id ? "on" : ""}" data-nof="${esc(e.id)}">${esc(e.n)}</button>`).join("")}
        ${faites ? `<button class="chip ${_noteFiltre === "faites" ? "on" : ""}" data-nof="faites">✓ Faites (${faites})</button>` : ""}
      </div>` : ""}

    ${epingles.length ? `<div class="lab" style="margin-top:4px">📌 Épinglées</div>${epingles.map(carte).join("")}` : ""}
    ${autres.length ? `${epingles.length ? `<div class="lab" style="margin-top:12px">Les autres</div>` : ""}${autres.map(carte).join("")}` : ""}
    ${!l.length ? `<p class="small muted" style="margin:14px 0">${q ? "Rien ne correspond à « " + esc(_noteQ) + " »." : "Aucune note ici."}</p>` : ""}

    <button class="btn btn-primary" id="no-add" style="width:100%;margin-top:10px">＋ Nouvelle note</button>
    ${!pid ? `<button class="btn btn-ghost" id="no-etiq" style="width:100%;margin-top:7px">🏷️ Mes étiquettes</button>` : ""}
    <div class="tip" style="margin-top:12px">Une <b>observation clinique</b> se note dans le passage du patient, pas ici : sinon elle ne part pas dans la relève et personne ne la lit.</div>`);
  bindNav(() => pid ? sheetPatient(getP(pid), "act") : sheetTours());

  { const e = $("#no-q");
    if (e) e.oninput = () => { _noteQ = e.value; const c = e.selectionStart;
      sheetNotes(pid); const n = $("#no-q"); if (n){ n.focus(); n.setSelectionRange(c, c); } }; }
  { const e = $("#no-qx"); if (e) e.onclick = () => { _noteQ = ""; sheetNotes(pid); }; }
  $$("#sheet [data-nof]").forEach(b => b.onclick = () => { _noteFiltre = b.dataset.nof; sheetNotes(pid); });
  $$("#sheet [data-noed]").forEach(b => b.onclick = () => sheetNoteEdit(b.dataset.noed, pid));
  $$("#sheet [data-nok]").forEach(b => b.onclick = () => {
    const n = notes().find(x => x.id === b.dataset.nok);
    if (!n) return;
    n.fait = !n.fait; n.maj = Date.now(); save(true); sheetNotes(pid);
  });
  $$("#sheet [data-nopin]").forEach(b => b.onclick = () => {
    const n = notes().find(x => x.id === b.dataset.nopin);
    if (!n) return;
    n.pin = !n.pin; n.maj = Date.now(); save(true); sheetNotes(pid);
  });
  $$("#sheet [data-nopat]").forEach(b => b.onclick = () => {
    const p = getP(b.dataset.nopat);
    if (p) sheetPatient(p, "id"); else toast("Ce dossier n'existe plus");
  });
  { const b = $("#no-add"); if (b) b.onclick = () => sheetNoteEdit(null, pid); }
  { const b = $("#no-etiq"); if (b) b.onclick = () => sheetNoteEtiquettes(pid); }
}

function sheetNoteEdit(id, pid){
  const neuve = !id;
  const n = neuve
    ? { id:uid(), t:"", m:"", etiq:[], pats:pid ? [pid] : [], pin:false, fait:false, cree:Date.now() }
    : JSON.parse(JSON.stringify(notes().find(x => x.id === id) || {}));

  const draw = () => {
    openSheet(`
      ${navHeader("Mes notes", true)}
      <h3>${neuve ? "＋ Nouvelle note" : "✏️ Modifier"}</h3>
      <input id="ne-t" class="rec-in" placeholder="Titre" value="${esc(n.t || "")}" style="margin-bottom:6px">
      <textarea id="ne-m" class="rec-in" rows="6" placeholder="Le détail, s'il y en a…">${esc(n.m || "")}</textarea>

      <div class="lab" style="margin-top:12px">Étiquettes</div>
      <div class="no-fil">
        ${noteEtiquettes().map(e => `<button class="chip ${(n.etiq||[]).includes(e.id) ? "on" : ""}" data-nee="${esc(e.id)}">${esc(e.n)}</button>`).join("")}
      </div>

      <div class="lab" style="margin-top:12px">Patients cités</div>
      ${(n.pats || []).length ? `<div class="no-tags" style="margin-bottom:6px">
        ${(n.pats||[]).map(x => { const p = getP(x);
          return `<span class="no-tg pat">👤 ${esc(p ? (p.nom||"").replace("Demo-","").toUpperCase() : "dossier supprimé")}
            <button class="no-x" data-nepx="${esc(x)}" aria-label="Retirer">✕</button></span>`; }).join("")}
      </div>` : ""}
      <button class="btn btn-ghost btn-sm" id="ne-pat" style="width:100%">👤 Citer un patient</button>
      <p class="small muted" style="margin-top:5px">Un toucher sur le nom, depuis la liste, ouvrira sa fiche.</p>

      <div class="lab" style="margin-top:14px">Alerte</div>
      ${typeof alerteBloc === "function" ? alerteBloc(n, "nal", false) : ""}

      <label class="screl" style="margin:12px 0 0">
        <input type="checkbox" id="ne-pin" ${n.pin ? "checked" : ""}>
        <span>Épingler en haut</span></label>

      <button class="btn btn-primary" id="ne-ok" style="width:100%;margin-top:12px">✓ Enregistrer</button>
      ${!neuve ? `<button class="btn btn-ghost" id="ne-rm" style="width:100%;margin-top:7px">🗑 Supprimer cette note</button>` : ""}`);
    bindNav(() => sheetNotes(pid));

    /* ⚠️ Le bloc d'alerte redessine l'écran à chaque réglage : il faut
       relire les champs AVANT, sinon le titre tapé serait perdu. */
    const lireAl = (typeof alerteBind === "function")
      ? alerteBind(n, "nal", () => { lire(); draw(); }) : null;
    const lire = () => {
      const t = $("#ne-t"); if (t) n.t = t.value.trim();
      const m = $("#ne-m"); if (m) n.m = m.value.trim();
      const p = $("#ne-pin"); if (p) n.pin = p.checked;
      if (lireAl) lireAl();
    };
    $$("#sheet [data-nee]").forEach(b => b.onclick = () => {
      lire();
      n.etiq = n.etiq || [];
      const i = n.etiq.indexOf(b.dataset.nee);
      if (i >= 0) n.etiq.splice(i, 1); else n.etiq.push(b.dataset.nee);
      draw();
    });
    $$("#sheet [data-nepx]").forEach(b => b.onclick = () => {
      lire();
      n.pats = (n.pats || []).filter(x => x !== b.dataset.nepx);
      draw();
    });
    { const b = $("#ne-pat");
      if (b) b.onclick = async () => {
        lire();
        const dispo = (S.patients || []).filter(p => !(n.pats || []).includes(p.id));
        if (!dispo.length){ toast("Aucun autre dossier à citer"); return; }
        const choix = await askChoice({ ic:"👤", titre:"Citer un patient",
          options: dispo.slice(0, 60).map(p => ({
            lbl:((p.prenom||"") + " " + (p.nom||"").replace("Demo-","").toUpperCase()).trim(),
            val:p.id })) });
        if (!choix) return;
        n.pats = [...(n.pats || []), choix];
        draw();
      }; }
    { const b = $("#ne-ok");
      if (b) b.onclick = () => {
        lire();
        if (!n.t && !n.m){ toast("Une note vide ne sert à rien"); return; }
        /* ⚠️ Même règle que pour les rappels : on ne réclame l'autorisation
           de notifier qu'au moment où une alerte est réellement posée. */
        if (n.alerte && n.alerte.on && n.alerte.tel !== false
            && typeof alerteDemander === "function") alerteDemander();
        if (typeof alerteNettoyer === "function") alerteNettoyer(n);
        n.maj = Date.now();
        const l = notes();
        const i = l.findIndex(x => x.id === n.id);
        if (i >= 0) l[i] = n; else l.unshift(n);
        save(true);
        toast(neuve ? "Note ajoutée" : "Note enregistrée");
        sheetNotes(pid);
      }; }
    { const b = $("#ne-rm");
      if (b) b.onclick = async () => {
        if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer cette note ?",
          sub:"Elle ne passe pas par la corbeille.", oui:"Supprimer" })) return;
        S.notes = notes().filter(x => x.id !== n.id);
        save(true);
        toast("Note supprimée");
        sheetNotes(pid);
      }; }
  };
  draw();
}

/* ── Les étiquettes, à l'utilisateur ── */
function sheetNoteEtiquettes(pid){
  openSheet(`
    ${navHeader("Mes notes", true)}
    <h3>🏷️ Mes étiquettes</h3>
    <p class="small muted" style="margin-bottom:12px">Renomme, recolore, supprime, ajoute. Aucune n'est imposée.</p>
    ${noteEtiquettes().map(e => `
      <div class="no-e">
        <span class="no-tg ${esc(e.c)}">${esc(e.n)}</span>
        <span style="flex:1"></span>
        <button class="btn btn-ghost btn-sm" data-neren="${esc(e.id)}" style="width:auto">✏️</button>
        <button class="lien-x" data-nerm="${esc(e.id)}" aria-label="Supprimer">✕</button>
      </div>`).join("")}
    <button class="btn btn-ghost" id="ne-add" style="width:100%;margin-top:10px">＋ Nouvelle étiquette</button>
    <div class="tip" style="margin-top:12px">Supprimer une étiquette ne supprime aucune note : elle est simplement retirée de celles qui la portaient.</div>`);
  bindNav(() => sheetNotes(pid));

  $$("#sheet [data-neren]").forEach(b => b.onclick = async () => {
    const e = noteEtiq(b.dataset.neren); if (!e) return;
    const nom = await askText("Renommer", { ic:"🏷️", ph:"Nom de l'étiquette", val:e.n });
    if (nom === null) return;
    if (nom.trim()) e.n = nom.trim();
    const c = await askChoice({ ic:"🎨", titre:"Couleur",
      options: NOTE_COULEURS.map(x => ({ lbl:x.n, val:x.c })) });
    if (c) e.c = c;
    save(true); sheetNoteEtiquettes(pid);
  });
  $$("#sheet [data-nerm]").forEach(b => b.onclick = async () => {
    const e = noteEtiq(b.dataset.nerm); if (!e) return;
    const n = notes().filter(x => (x.etiq || []).includes(e.id)).length;
    if (!await askDialog({ ic:"✕", titre:"Supprimer « " + e.n + " » ?",
      sub:n ? n + " note(s) la portent : elles la perdront, mais resteront." : "Aucune note ne la porte.",
      oui:"Supprimer" })) return;
    /* ⚠️ On retire l'étiquette des notes : sinon elles garderaient un
       identifiant qui ne correspond plus à rien. */
    notes().forEach(x => { if (x.etiq) x.etiq = x.etiq.filter(i => i !== e.id); });
    S.noteEtiq = noteEtiquettes().filter(x => x.id !== e.id);
    save(true); sheetNoteEtiquettes(pid);
  });
  { const b = $("#ne-add");
    if (b) b.onclick = async () => {
      const nom = await askText("Nouvelle étiquette", { ic:"🏷️", ph:"ex. Matériel, Formation…" });
      if (!nom || !nom.trim()) return;
      const c = await askChoice({ ic:"🎨", titre:"Couleur",
        options: NOTE_COULEURS.map(x => ({ lbl:x.n, val:x.c })) });
      noteEtiquettes().push({ id:uid(), n:nom.trim(), c:c || "gris" });
      save(true); sheetNoteEtiquettes(pid);
    }; }
}
