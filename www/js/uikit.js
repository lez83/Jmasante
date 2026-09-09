/* ============================================================
   UI-KIT — le vocabulaire visuel commun
   ─────────────────────────────────────────────────────────
   Le Moniteur avait gagné un langage (mot-repère, liseré,
   dégradé) que les autres écrans ignoraient. Ces fonctions
   le rendent disponible partout : on apprend une fois, on
   s'y retrouve sur tous les écrans.

   Un seul endroit à corriger pour toute l'application.
============================================================ */

/* ---------- Rangée titrée ----------
   uiRow("Portée", "ac", contenuHTML)
   ton : ac (accent) · am (ambre) · bl (bleu) · nt (neutre) */
function uiRow(label, ton, html, extra){
  return `<div class="rowlab ${ton||"nt"}">
      <span>${esc(label)}</span><i></i>${extra?`<em>${esc(extra)}</em>`:""}
    </div>
    <div class="rowbox ${ton||"nt"}" style="display:block;margin-bottom:12px">${html}</div>`;
}

/* ---------- Ligne de liste ----------
   Un gabarit unique pour documents, bilans, rappels, archives…
   { ic, titre, detail, etat, tonEtat, ton, data }             */
function uiListRow(o){
  const at = Object.entries(o.data||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(" ");
  return `<button class="uirow ${o.ton?"t-"+o.ton:""}" ${at}>
    ${o.ic?`<span class="ui-ic">${o.ic}</span>`:""}
    <span class="ui-body">
      <span class="ui-t">${esc(o.titre||"")}</span>
      ${o.detail?`<span class="ui-d">${esc(o.detail)}</span>`:""}
    </span>
    ${o.etat?`<span class="ui-e ${o.tonEtat?"t-"+o.tonEtat:""}">${esc(o.etat)}</span>`:""}
    <span class="ui-ch">›</span>
  </button>`;
}

/* ---------- Écran vide ----------
   Plutôt qu'une phrase grise : dire ce qu'on peut mettre là,
   et proposer de le faire.                                    */
function uiEmpty(ic, titre, aide, action){
  return `<div class="uiempty">
    <div class="ue-ic">${ic||"📭"}</div>
    <div class="ue-t">${esc(titre)}</div>
    ${aide?`<div class="ue-a">${esc(aide)}</div>`:""}
    ${action?`<button class="btn btn-ghost ue-b" ${action.data||""} style="border-color:var(--accent);color:var(--accent)">${esc(action.label)}</button>`:""}
  </div>`;
}

/* ---------- Pied de feuille ----------
   Action secondaire à gauche, principale à droite et plus large.
   Toujours au même endroit, dans le même ordre.               */
function uiActions(annuler, valider, danger){
  return `<div class="uiact">
      <button class="btn btn-ghost" ${annuler.data||""} id="${annuler.id||""}">${esc(annuler.label||"Annuler")}</button>
      <button class="btn btn-primary" ${valider.data||""} id="${valider.id||""}">${esc(valider.label||"✓ Enregistrer")}</button>
    </div>
    ${danger?`<button class="btn uidanger" ${danger.data||""} id="${danger.id||""}">${esc(danger.label)}</button>`:""}`;
}

/* ---------- Section de catalogue ----------
   Une couleur par famille, et le nombre annoncé.              */
const UI_TONS = ["ac","bl","am","vi","nt"];
function uiCat(ic, nom, n, html, i){
  const ton = UI_TONS[(i||0) % UI_TONS.length];
  return `<div class="rowlab ${ton}" style="margin-top:12px">
      ${ic?`<span class="rl-ic">${ic}</span>`:""}
      <span>${esc(nom)}</span><i></i>${n?`<em>${n}</em>`:""}
    </div>
    <div class="rowbox ${ton}">${html}</div>`;
}
