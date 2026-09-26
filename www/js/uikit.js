/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
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

/* ============================================================
   LOT v1.0.58 — AFFICHAGES AU CHOIX, AIDES, CODE DE SECOURS
   ============================================================ */

/* ---------- Bulles d'aide de première utilisation ----------
   aideUne("cle", {ic, titre, sub}) : affichée tant que l'utilisateur n'a
   pas coché « Ne plus afficher ». ⚙️ Application → « Revoir les aides »
   remet S.aides à zéro. Une aide ne bloque jamais rien : elle s'ouvre,
   on la ferme, on continue. */
function aideVue(cle){ return !!((S.aides||{})[cle]); }
function aideMasquer(cle){ S.aides = S.aides || {}; S.aides[cle] = true; try { save(); } catch(e){} }
function aideUne(cle, o){
  if (aideVue(cle)) return Promise.resolve(false);
  return new Promise(res => {
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card">
      ${typeof CIG_FILI_SVG !== "undefined" ? CIG_FILI_SVG : ""}
      <div class="dlg-in">
        <div class="dlg-ic">${o.ic || "💡"}</div>
        <div class="dlg-t">${esc(o.titre)}</div>
        <div class="dlg-s">${o.sub || ""}</div>
        <label class="aide-nm"><input type="checkbox" id="aide-nm"> Ne plus afficher</label>
        <div class="dlg-act"><button class="btn btn-primary" data-yes>${esc(o.oui || "Compris")}</button></div>
      </div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    const fin = () => {
      const c = el.querySelector("#aide-nm");
      if (c && c.checked) aideMasquer(cle);
      el.classList.remove("show"); setTimeout(() => el.remove(), 200); res(true);
    };
    el.querySelector("[data-yes]").onclick = fin;
    el.onclick = e => { if (e.target === el) fin(); };
  });
}

/* ---------- Tuiles « tableau de bord » des constantes ----------
   Réglage S.constStyle : "classique" (défaut) | "tableau".
   Chaque tuile montre la DERNIÈRE valeur connue de sa constante (pas
   seulement celle du dernier passage) avec sa date : une valeur de trois
   jours ne se lit pas comme une valeur du matin. Les mesures archivées
   (p.mesures) restent réservées aux courbes, comme décidé en v1.0.51. */
const TUILES = [
  ["ta","TA","mmHg"],["puls","Pouls","bpm"],["sat","SpO2","%"],
  ["temp","Temp.","°C"],["glyc","Glycémie","g/L"],["douleur","Douleur","/10"]
];
function derniereConst(p, k){
  const vs = [...(p.visits||[])].sort((a,b)=>(b.date+(b.at||"")).localeCompare(a.date+(a.at||"")));
  for (const v of vs){ const c = v.consts || {}; if (c[k] !== undefined && c[k] !== null && String(c[k]).trim() !== "") return { val:c[k], date:v.date, at:v.at||"" }; }
  return null;
}
/* Sens du dépassement, lu dans le libellé d'alerte existant :
   on ne recalcule rien, on reprend exactement la règle des seuils. */
function sensConst(k, val, th){
  const al = alertes({ [k]: val }, th);
  if (!al.length) return "";
  return /basse|hypoth|brady|hypogly/i.test(al.join(" ")) ? "lo" : "hi";
}
function dateMesure(d){
  if (!d) return { txt:"", vieux:false };
  const t = new Date(d.date + "T" + (d.at && /^\d{1,2}:\d{2}/.test(d.at) ? d.at.padStart(5,"0") : "12:00"));
  const vieux = (Date.now() - t.getTime()) > 24*3600*1000;
  const auj = d.date === todayISO();
  const txt = auj ? "aujourd'hui" + (d.at ? " à " + d.at : "")
            : "le " + fmtFR(d.date) + (d.at ? " à " + d.at : "");
  return { txt, vieux };
}
function vitalTilesHtml(p){
  if (!p) return "";
  const _o = typeof ordreConst === "function" ? ordreConst() : TUILES.map(t => t[0]);
  const _t = _o.map(k => TUILES.find(t => t[0] === k)).filter(Boolean)
    .filter(([k]) => typeof constVisible !== "function" || constVisible(k, p));
  return `<div class="vtiles">${_t.map(([k,lbl,u]) => {
    const d = derniereConst(p, k);
    if (!d) return `<div class="vtile none" data-vtile="${k}" role="button" tabindex="0"><div class="vt-h">${lbl}</div><div class="vt-v">—</div><div class="vt-d">non mesurée</div></div>`;
    const s = sensConst(k, d.val, p.thresholds);
    const m = dateMesure(d);
    const bd = s === "hi" ? `<span class="vt-b hi">↑ HAUT</span>` : s === "lo" ? `<span class="vt-b lo">↓ BAS</span>` : `<span class="vt-b ok">DANS LES SEUILS</span>`;
    return `<div class="vtile ${s}" data-vtile="${k}" role="button" tabindex="0"><div class="vt-h">${lbl}${bd}</div>
      <div class="vt-v">${esc(String(d.val))}<span class="vt-u">${u}</span></div>
      <div class="vt-d ${m.vieux?"old":""}">${esc(m.txt)}</div></div>`;
  }).join("")}</div>`;
}

/* ---------- Légende des couleurs du Moniteur ----------
   Affichée par défaut ; « Ne plus afficher » la replie en un simple ⓘ
   qui la rouvre d'un toucher. Elle suit le style de carte choisi. */
let _legOuverte = false;
function legendeHtml(forcer){
  const bande = S.cardStyle === "bande";
  const sw = (cls) => `<i class="lg-sw ${bande?"bar":"dot"} ${cls}"></i>`;
  const items = `${sw("todo")}À voir <span class="lg-sep"></span>${sw("done")}Vu <span class="lg-sep"></span>${sw("alert")}Vigilance <span class="lg-sep"></span>${sw("absent")}Absent <span class="lg-sep"></span>${sw("novisit")}Sans passage`;
  if (forcer) return `<div class="legende">${items}</div>`;
  if (aideVue("legende") && !_legOuverte)
    return `<button class="lg-i" id="lg-open" title="Légende des couleurs">ⓘ Légende</button>`;
  return `<div class="legende">${items}
    ${aideVue("legende")
      ? `<button class="lg-x" id="lg-close" title="Replier">✕</button>`
      : `<button class="lg-x lg-nm" id="lg-hide">Ne plus afficher</button>`}</div>`;
}
function renderLegende(){
  const el = document.getElementById("legende"); if (!el) return;
  if (S.curTour === "none" || S.firstRun){ el.innerHTML = ""; return; }
  el.innerHTML = legendeHtml();
  const o = document.getElementById("lg-open");  if (o) o.onclick = () => { _legOuverte = true;  renderLegende(); };
  const c = document.getElementById("lg-close"); if (c) c.onclick = () => { _legOuverte = false; renderLegende(); };
  const h = document.getElementById("lg-hide");  if (h) h.onclick = () => { aideMasquer("legende"); _legOuverte = false; renderLegende();
    toast("Légende repliée — touche ⓘ pour la revoir"); };
}

/* ---------- Code de secours (type banque) ----------
   Généré à la création du code de verrouillage, montré UNE fois, jamais
   stocké en clair : seule son empreinte (SHA-256) est gardée. Alphabet
   sans caractères ambigus (0/O, 1/I/L). */
function genCodeSecours(){
  const A = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map(x => A[x % A.length]).join("");
  return s.slice(0,4) + "-" + s.slice(4,8) + "-" + s.slice(8,12);
}
const normSecours = c => String(c||"").toUpperCase().replace(/[^0-9A-Z]/g,"");
async function hashSecours(code){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("jmsante-secours:" + normSecours(code)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
}
async function creerCodeSecours(){
  const code = genCodeSecours();
  S.pinRescue = await hashSecours(code); save(true);
  await askDialog({ ic:"🔑", titre:"Ton code de secours",
    sub:`<div class="rescue-code">${code}</div>` +
        "Il te permettra d'ouvrir l'app si tu oublies ton code.<br><br>" +
        "<b>Note-le maintenant</b> — sur papier, dans ton gestionnaire de mots de passe — et range-le " +
        "<b>ailleurs que dans ce téléphone</b>. Il ne sera plus jamais affiché.",
    oui:"Je l'ai noté", seul:true });
}
/* Après la création d'un code : code de secours, puis empreinte (Android). */
async function apresCreationCode(){
  try { await creerCodeSecours(); } catch(e){ console.error("secours:", e); }
  try {
    if (!S.bioLock && typeof bioAvailable === "function" && await bioAvailable()){
      if (await askDialog({ ic:"👆", titre:"Déverrouiller aussi par empreinte ?",
          sub:"Plus rapide en tournée. Le code reste utilisable à tout moment.", oui:"👆 Activer", non:"Plus tard" })){
        if (await bioUnlock()){ S.bioLock = true; save(); toast("Empreinte activée 👆"); }
      }
    }
  } catch(e){}
}
/* « Code oublié ? » sur l'écran de verrouillage */
async function codeOublie(){
  const opts = [];
  if (S.pinRescue) opts.push({ ic:"🔑", lbl:"J'ai mon code de secours", val:"secours" });
  opts.push({ ic:"🗑", lbl:"Tout effacer et repartir de zéro", val:"wipe" });
  const choix = await askChoice({ ic:"🔒", titre:"Code oublié",
    sub: S.pinRescue ? "Tes données sont intactes : seul l'accès est bloqué." :
         "Aucun code de secours n'a été créé pour ce code. Sans lui, la seule issue est de tout effacer, puis de réimporter ta dernière sauvegarde.",
    options: opts });
  if (!choix) return;
  if (choix === "secours"){
    const saisi = await askDialog({ ic:"🔑", titre:"Code de secours", saisie:{ ph:"XXXX-XXXX-XXXX" }, oui:"Déverrouiller" });
    if (saisi === false) return;
    if (await hashSecours(saisi) === S.pinRescue){
      S.pin = null; S.pinLen = null; S.pinRescue = null; save(true);
      toast("Accès rétabli — choisis un nouveau code");
      showLock("set");
    } else toast("Code de secours incorrect", "danger");
  } else if (choix === "wipe"){
    const ok = await askDialog({ ton:"danger", ic:"⚠️", titre:"Tout effacer ?",
      warn:"Patients, passages, documents, réglages : tout sera perdu sur cet appareil. Tu pourras ensuite réimporter une sauvegarde.",
      saisie:{ ph:"EFFACER" }, saisieLbl:"Tape EFFACER pour confirmer", verrou:"EFFACER", oui:"🗑 Tout effacer" });
    if (!ok) return;
    S = defaultState(); save(true);
    $("#lock").classList.remove("on"); render();
    toast("Données effacées — 🦗 → Sauvegarde pour réimporter");
  }
}
/* Incitation au code de verrouillage : 5 lancements au plus, et plus
   jamais dès qu'un code existe. */
async function incitationCode(){
  if (S.pin) return;
  S.pinNudge = S.pinNudge || 0;
  if (S.pinNudge >= 5) return;
  S.pinNudge++; save();
  const ok = await askDialog({ ic:"🔒", titre:"Protège l'accès à tes patients",
    sub:"Un code à 6 chiffres empêche quelqu'un qui prend ton téléphone d'ouvrir JM@Santé." +
        (typeof bioAvailable === "function" ? " Tu pourras ensuite déverrouiller par empreinte." : "") +
        "<br><br>Tu recevras un <b>code de secours</b> à noter, au cas où tu oublierais le tien. " +
        "Pense aussi à faire des <b>sauvegardes</b> régulières." +
        `<br><br><span style="font-size:11px;opacity:.7">Rappel ${S.pinNudge}/5 — il ne s'affichera plus ensuite.</span>`,
    oui:"🔒 Créer mon code", non:"Plus tard" });
  if (ok) showLock("set");
}

/* ============================================================
   COULEURS ET MOTIFS DES STATUTS — v1.0.60
   ─────────────────────────────────────────────────────────
   S.couleurs = { preset, perso:{statut:hex}, motifs:bool,
                  motif:{statut:"plein"|"rayures"|"points"|"quadrillage"} }
   Palette « app » = couleurs du thème (aucune variable posée) ;
   les autres posent --st-<statut> sur <html>, avec data-stc.
   Motifs (aide daltonisme) : data-motifs + --st-<statut>-img/-size,
   encre noire ou blanche selon la clarté de la couleur.
   Statuts : todo (à voir) · done (vu) · alert (vigilance) · absent
   (absent ET sans passage).
============================================================ */
const STATUTS = [["todo","À voir"],["done","Vu"],["alert","Vigilance"],["absent","Absent · sans passage"]];
const PALETTES_ST = {
  app:       { lbl:"JM@Santé",      sub:"défaut, suit le thème", c:null },
  feu:       { lbl:"Feu tricolore", sub:"bleu à voir, vert vu, rouge vigilance", c:{ todo:"#5d8fd9", done:"#3fbf6f", alert:"#e05540", absent:"#5b6663" } },
  contraste: { lbl:"Contraste fort",sub:"plein soleil", c:{ todo:"#ffd23f", done:"#00e676", alert:"#ff1744", absent:"#9e9e9e" } },
  dalto:     { lbl:"Daltonisme",    sub:"distinguables par tous, motifs activés", c:{ todo:"#56b4e9", done:"#009e73", alert:"#d55e00", absent:"#999999" } }
};
/* Couleurs d'affichage de la palette « app » (pour l'aperçu et l'encre) */
const APP_ST_APPROX = { todo:"#e0a940", done:"#3dd6a8", alert:"#e05540", absent:"#5b6663" };
const TEINTES_ST = ["#e0a940","#ff8a3d","#ffd23f","#3fbf6f","#3dd6a8","#009e73","#56b4e9","#5d8fd9","#9b6bd8","#e87fb0","#e05540","#d55e00","#9e9e9e","#5b6663"];
const MOTIFS = [["plein","Plein"],["rayures","Rayures"],["points","Points"],["quadrillage","Quadrillage"]];
const MOTIF_DEF = { todo:"plein", done:"rayures", alert:"quadrillage", absent:"points" };

function cfgCouleurs(){
  S.couleurs = S.couleurs || {};
  const c = S.couleurs;
  c.preset = PALETTES_ST[c.preset] ? c.preset : "app";
  c.perso = c.perso || {};
  c.motif = Object.assign({}, MOTIF_DEF, c.motif || {});
  return c;
}
function couleurStatut(s){
  const c = cfgCouleurs();
  return c.perso[s] || (PALETTES_ST[c.preset].c || {})[s] || null;   // null = couleur du thème
}
function _rgb(hex){ const h = hex.replace("#",""); return [0,2,4].map(i => parseInt(h.slice(i,i+2),16)); }
function _lum(hex){ const [r,g,b] = _rgb(hex).map(v => { v/=255; return v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4); });
  return .2126*r + .7152*g + .0722*b; }
function encreMotif(hex){ return _lum(hex) < .2 ? "rgba(255,255,255,.55)" : "rgba(0,0,0,.5)"; }
function motifCss(m, ink){
  if (m === "rayures") return { img:`repeating-linear-gradient(45deg, ${ink} 0 2px, transparent 2px 6px)`, size:"auto" };
  if (m === "points")  return { img:`radial-gradient(circle, ${ink} 1.3px, transparent 1.7px)`, size:"5px 5px" };
  if (m === "quadrillage") return { img:`linear-gradient(${ink} 1.5px, transparent 1.5px), linear-gradient(90deg, ${ink} 1.5px, transparent 1.5px)`, size:"6px 6px" };
  return { img:"none", size:"auto" };
}
function appliquerCouleurs(){
  const c = cfgCouleurs();
  const h = document.documentElement;
  let perso = false;
  STATUTS.forEach(([s]) => {
    const col = couleurStatut(s);
    if (col){ h.style.setProperty("--st-" + s, col); perso = true; }
    else h.style.removeProperty("--st-" + s);
    const m = motifCss(c.motif[s], encreMotif(col || APP_ST_APPROX[s]));
    h.style.setProperty("--st-" + s + "-img", m.img);
    h.style.setProperty("--st-" + s + "-size", m.size);
  });
  if (perso) h.dataset.stc = "1"; else delete h.dataset.stc;
  if (c.motifs) h.dataset.motifs = "1"; else delete h.dataset.motifs;
}
/* Garde-fou : deux statuts trop proches (distance perceptuelle simple) */
function statutsTropProches(){
  const cols = STATUTS.map(([s,l]) => [l, couleurStatut(s) || APP_ST_APPROX[s]]);
  const out = [];
  for (let i = 0; i < cols.length; i++) for (let j = i+1; j < cols.length; j++){
    const [a,b] = [_rgb(cols[i][1]), _rgb(cols[j][1])];
    const rm = (a[0]+b[0])/2, d = Math.sqrt((2+rm/256)*(a[0]-b[0])**2 + 4*(a[1]-b[1])**2 + (2+(255-rm)/256)*(a[2]-b[2])**2);
    if (d < 110) out.push(cols[i][0] + " et " + cols[j][0]);
  }
  return out;
}

function sheetCouleurs(){
  const c = cfgCouleurs();
  let edit = null;   // statut en cours de personnalisation
  const swatch = (s, big) => {
    const col = couleurStatut(s) || APP_ST_APPROX[s];
    const m = motifCss(c.motifs ? c.motif[s] : "plein", encreMotif(col));
    return `<i class="stc-sw ${big?"big":""}" style="background-color:${col};background-image:${m.img};background-size:${m.size}"></i>`;
  };
  const draw = () => {
    const proches = statutsTropProches();
    openSheet(`
      ${typeof navHeader === "function" ? navHeader("Application", true) : ""}
      <h3>🎨 Couleurs des statuts</h3>
      <p class="small muted" style="margin-bottom:10px">Pastilles, cartes à bande, légende, compteurs d'avancement et valeurs hors seuil.</p>
      <div class="lab">Palette</div>
      ${Object.entries(PALETTES_ST).map(([k,p]) => `
        <button class="stc-pre ${c.preset===k && !Object.keys(c.perso).length ? "on" : ""}" data-pre="${k}">
          <span class="stc-pn">${esc(p.lbl)}<span>${esc(p.sub)}</span></span>
          <span class="stc-sws">${STATUTS.map(([s]) => { const col = (p.c||APP_ST_APPROX)[s];
            return `<i class="stc-sw" style="background:${col}"></i>`; }).join("")}</span></button>`).join("")}
      <label class="stc-tg"><input type="checkbox" id="stc-mot" ${c.motifs?"checked":""}>
        <span><b>Motifs et formes</b> (aide daltonisme)<br><span class="small muted">Motif sur la bande et dans la légende, forme sur la pastille : ● à voir · ✓ vu · ▲ vigilance · ▬ absent.</span></span></label>
      <div class="lab" style="margin-top:14px">Personnaliser</div>
      ${STATUTS.map(([s,l]) => `
        <button class="stc-row ${edit===s?"on":""}" data-ed="${s}"><span class="stc-sn">${l}</span>
          ${c.motifs ? `<span class="small muted">${esc((MOTIFS.find(x=>x[0]===c.motif[s])||[])[1]||"")}</span>` : ""}${swatch(s, true)}</button>
        ${edit===s ? `<div class="stc-ed">
          <div class="stc-pal">${TEINTES_ST.map(t => `<button class="stc-t ${(couleurStatut(s)||"")===t?"on":""}" data-col="${t}" style="background:${t}" title="${t}"></button>`).join("")}</div>
          ${c.motifs ? `<div class="stc-mots">${MOTIFS.map(([m,ml]) => { const col = couleurStatut(s) || APP_ST_APPROX[s]; const mc = motifCss(m, encreMotif(col));
            return `<button class="stc-m ${c.motif[s]===m?"on":""}" data-mot="${m}"><i style="background-color:${col};background-image:${mc.img};background-size:${mc.size}"></i>${ml}</button>`; }).join("")}</div>` : ""}
          ${c.perso[s] ? `<button class="btn btn-ghost btn-sm" data-raz="${s}" style="width:100%;margin-top:6px">↺ Couleur de la palette</button>` : ""}
        </div>` : ""}`).join("")}
      ${proches.length ? `<div class="stc-warn">⚠ ${esc(proches.join(" ; "))} : couleurs trop proches, elles risquent de se confondre.</div>` : ""}
      <div class="lab" style="margin-top:14px">Aperçu</div>
      <div class="stc-prev">${[["todo","Josette M.","à voir"],["done","Paulette R.","vu"],["alert","J.-Claude D.","vigilance"],["absent","Marcel B.","absent"]].map(([s,n,t]) =>
        `<div class="pcard st-${s} stc-mini"><span class="st ${s==="absent"?"todo":s}"></span><div class="nm">${n}</div><div class="small muted">${t}</div></div>`).join("")}</div>
      <div id="stc-leg">${typeof legendeHtml === "function" ? legendeHtml(true) : ""}</div>
      <button class="btn btn-ghost" id="stc-raz" style="width:100%;margin-top:12px">↺ Revenir aux couleurs d'origine</button>
      <button class="btn btn-primary" id="stc-ok" style="width:100%;margin-top:8px">✓ Terminé</button>`);
    const maj = () => { save(); appliquerCouleurs(); try { render(); } catch(e){} draw(); };
    $$("#sheet [data-pre]").forEach(b => b.onclick = () => {
      c.preset = b.dataset.pre; c.perso = {};
      if (c.preset === "dalto") c.motifs = true;
      maj(); });
    $("#stc-mot").onchange = e => { c.motifs = e.target.checked; maj(); };
    $$("#sheet [data-ed]").forEach(b => b.onclick = () => { edit = edit === b.dataset.ed ? null : b.dataset.ed; draw(); });
    $$("#sheet [data-col]").forEach(b => b.onclick = () => { c.perso[edit] = b.dataset.col; maj(); });
    $$("#sheet [data-mot]").forEach(b => b.onclick = () => { c.motif[edit] = b.dataset.mot; maj(); });
    $$("#sheet [data-raz]").forEach(b => b.onclick = () => { delete c.perso[b.dataset.raz]; maj(); });
    $("#stc-raz").onclick = () => { S.couleurs = { preset:"app", perso:{}, motifs:false }; edit = null; save(); appliquerCouleurs(); try { render(); } catch(e){} sheetCouleurs(); };
    $("#stc-ok").onclick = () => { if (typeof sheetAppPanel === "function") sheetAppPanel(); else closeSheet(); };
    if (typeof bindNav === "function") try { bindNav(sheetAppPanel); } catch(e){}
  };
  draw();
}


/* Tuiles cliquables — v1.0.61
   Carte ouverte : la tuile mène au champ de saisie de sa constante
   (TA → systolique), clavier ouvert. Fiche : ouvre les 📈 Courbes,
   après confirmation si la fiche a des modifications non enregistrées. */
function brancherTuilesSaisie(f){
  f.querySelectorAll("[data-vtile]").forEach(t => t.onclick = () => {
    const k = t.dataset.vtile;
    const inp = f.querySelector(k === "ta" ? "[data-ta-s]" : `[data-c="${k}"]`);
    if (!inp) return;
    try { inp.scrollIntoView({ block:"center", behavior:"smooth" }); } catch(e){}
    inp.focus();
    inp.classList.add("vt-cible"); setTimeout(() => inp.classList.remove("vt-cible"), 1200);
  });
}
function brancherTuilesFiche(p){
  const sh = document.getElementById("sheet"); if (!sh || !p) return;
  let modif = false;
  sh.addEventListener("input", () => { modif = true; });
  sh.querySelectorAll("[data-vtile]").forEach(t => t.onclick = async () => {
    if (modif && !await askDialog({ ic:"📈", titre:"Ouvrir les courbes ?",
        sub:"Les modifications non enregistrées de la fiche seront perdues.", oui:"Ouvrir", non:"Rester" })) return;
    sheetGraphConstantes(p.id);
  });
}

/* ============================================================
   PERSONNALISATION — v1.0.62
   Écran 🎨 Personnaliser (zones + aperçu + réinitialisation),
   texte et zoom, constantes affichées, contenu des cartes,
   barre d'outils du Moniteur.
   ⚠️ Uniquement de l'affichage : aucune donnée n'est modifiée,
   masquer une constante ne l'efface nulle part.
============================================================ */
const CONST_DEF = ["ta","puls","sat","temp","glyc","douleur"];
const CONST_LBL = { ta:"TA", puls:"Pouls", sat:"SpO2", temp:"Température", glyc:"Glycémie", douleur:"Douleur (EVA)" };
function ordreConst(){
  const o = (S.constsOrdre || []).filter(k => CONST_DEF.includes(k));
  CONST_DEF.forEach(k => { if (!o.includes(k)) o.push(k); });
  return o;
}
/* Visible globalement, ou forcée pour ce patient (exception par patient) */
function constVisible(k, p){
  if (p && (p.constsForcees || []).includes(k)) return true;
  return !((S.constsMasquees || []).includes(k));
}
function cstStyle(k, p){
  const i = ordreConst().indexOf(k);
  return `order:${i};${constVisible(k, p) ? "" : "display:none"}`;
}

/* Contenu des cartes repliées. Les signaux de vigilance (valeur hors
   seuil, jours sans selle, patient prioritaire, absent, saisie gardée)
   restent TOUJOURS visibles, quoi qu'on décoche. */
const CARTE_OPTS = [["age","Âge"],["consts","Constantes"],["badges","📎 🧪 📌 Badges"],["tags","Étiquettes et anniversaire"],["dernier","Dernier passage"]];
function carteMontre(k){ return !((S.carteMasque || []).includes(k)); }

/* ---------- Barre d'outils ---------- */
const TOOLS = {
  "search":      { ic:"🔍", lbl:"Chercher" },
  "seq":         { ic:"▶",  lbl:"Déroulé", svg:true },
  "new-rappel":  { ic:"📌", lbl:"Rappels" },
  "new-patient": { ic:"＋", lbl:"Patient" },
  "releve":      { ic:"📋", lbl:"Relève" },
  "quickdictate":{ ic:"🎤", lbl:"Note" },
  "route":       { ic:"🖨️", lbl:"Route" },
  "sync":        { ic:"🔄", lbl:"Synchro" }
};
const TOOLS_DEF = ["search","seq","new-rappel","new-patient"];
function outilsChoisis(){ const t = (S.toolbar || TOOLS_DEF).filter(k => TOOLS[k]); return t.slice(0, 5); }
let _cigaleHtml = null;
function renderToolbar(){
  const tb = document.querySelector(".toolbar"); if (!tb) return;
  if (!_cigaleHtml){ const c = tb.querySelector('[data-a="tours"]'); if (!c) return; _cigaleHtml = c.outerHTML; }
  const ks = outilsChoisis();
  tb.style.gridTemplateColumns = `repeat(${ks.length + 1}, minmax(0,1fr))`;
  tb.innerHTML = _cigaleHtml + ks.map(k => { const t = TOOLS[k];
    return `<button class="tbtn" data-a="${k}" title="${esc(t.lbl)}">${ t.svg
      ? `<svg viewBox="0 0 24 24" class="tb-svg" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/></svg>`
      : `<span class="tb-ic">${t.ic}</span>`}<span>${esc(t.lbl)}</span></button>`; }).join("");
}

/* ---------- Texte et zoom ----------
   S.zoomApp : facteur d'échelle de l'app (0.85 à 1.6), appliqué par la
   propriété CSS zoom sur <body> — la mise en page se RÉORGANISE dans la
   largeur de l'écran (pas de défilement horizontal, les éléments fixes
   restent en place). Crans : Normale 1 · Grande 1.15 · Très grande 1.3.
   S.zoomMode : "intelligent" (défaut) | "natif" | "off". */
const ZOOM_MIN = 0.85, ZOOM_MAX = 1.6;
const CRANS = [["Normale",1],["Grande",1.15],["Très grande",1.3]];
function zoomActuel(){ const z = +S.zoomApp || 1; return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)); }
function appliquerZoom(z){
  const v = z === undefined ? zoomActuel() : z;
  document.body.style.zoom = v === 1 ? "" : String(v);
  document.documentElement.toggleAttribute("data-zoomcol", v >= 1.3);   // une seule colonne de cartes
}
function appliquerModeZoom(){
  const mode = S.zoomMode || "intelligent";
  const m = document.querySelector('meta[name="viewport"]'); if (!m) return;
  m.setAttribute("content", mode === "natif"
    ? "width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover, user-scalable=yes"
    : "width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover, user-scalable=no");
}
function badgeZoom(v, fin){
  let b = document.getElementById("zoom-badge");
  if (!b){ b = document.createElement("div"); b.id = "zoom-badge";
    b.innerHTML = `<span id="zb-v"></span><button id="zb-raz" title="Revenir à 100 %">↺</button>`;
    document.documentElement.appendChild(b);   // hors de <body> : non zoomé lui-même
    b.querySelector("#zb-raz").onclick = () => { S.zoomApp = 1; save(); appliquerZoom(); badgeZoom(1, true); };
  }
  b.querySelector("#zb-v").textContent = "🔍 " + Math.round(v * 100) + " %";
  b.classList.add("on"); clearTimeout(b._t);
  if (fin) b._t = setTimeout(() => b.classList.remove("on"), 2200);
}
(function gesteZoom(){
  let d0 = 0, z0 = 1, actif = false, raf = 0, zCourant = 1;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  /* Photos et documents gardent leur propre zoom */
  const surImage = e => !!(e.target && e.target.closest && e.target.closest(".zoomable, .zv-veil"));
  document.addEventListener("touchstart", e => {
    if (e.touches.length !== 2 || surImage(e)) return;
    if ((S && S.zoomMode) === "natif") return;
    d0 = dist(e.touches); z0 = zoomActuel(); zCourant = z0; actif = false;
  }, { passive:true });
  document.addEventListener("touchmove", e => {
    if (e.touches.length !== 2 || !d0 || surImage(e)) return;
    const mode = (S && S.zoomMode) || "intelligent";
    if (mode === "natif") return;
    e.preventDefault();                          // pas de zoom navigateur en mode intelligent / désactivé
    if (mode === "off") return;
    const r = dist(e.touches) / d0;
    if (!actif && Math.abs(r - 1) < 0.08) return;   // seuil : un défilement à deux doigts ne zoome pas
    actif = true;
    zCourant = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z0 * r * 20) / 20));
    cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { appliquerZoom(zCourant); badgeZoom(zCourant); });
  }, { passive:false });
  document.addEventListener("touchend", e => {
    if (!d0 || e.touches.length >= 2) return;
    if (actif){ S.zoomApp = zCourant; save(); badgeZoom(zCourant, true); }
    d0 = 0; actif = false;
  }, { passive:true });
  /* Windows / navigateur : Ctrl + molette suit le même réglage */
  window.addEventListener("wheel", e => {
    if (!e.ctrlKey) return;
    const mode = (S && S.zoomMode) || "intelligent";
    if (mode === "natif") return;
    e.preventDefault();
    if (mode === "off") return;
    const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((zoomActuel() - Math.sign(e.deltaY) * 0.05) * 20) / 20));
    S.zoomApp = z; appliquerZoom(z); badgeZoom(z, true);
    clearTimeout(window._zs); window._zs = setTimeout(() => save(), 400);
  }, { passive:false });
})();

/* ---------- Réinitialiser l'affichage ---------- */
const REGLAGES_AFFICHAGE = ["moniteurStyle","constStyle","cardStyle","dotSize","couleurs","zoomApp","zoomMode",
  "constsMasquees","constsOrdre","carteMasque","toolbar","themeAuto","releveDefaut","ouverture"];

/* ---------- Écran 🎨 Personnaliser ---------- */
function apercuPerso(){
  const c = { ta:"128/78", puls:"74", glyc:"1.82" };
  const al = alertes(c, {});
  return `<div class="pers-prev"><div class="pl">APERÇU EN DIRECT</div>
    <div class="pcard st-alert warn pers-mini"><span class="st alert"></span>
      <div class="nm">Josette MARTIN ${carteMontre("age") ? `<span class="age">84 ans</span>` : ""}</div>
      <div class="vitals">${vitalsHtml(c, al, {})}</div>
      ${carteMontre("badges") ? `<div class="badges"><span class="mini blue">📎 2</span> <span class="mini amber">📌 1</span></div>` : ""}
      ${carteMontre("dernier") ? `<div class="lastseen">dernier passage : hier 8:12</div>` : ""}
    </div></div>`;
}
function _resume(z){
  const th = (APP_THEMES[S.theme] || {}).lbl || "";
  const pal = (typeof PALETTES_ST !== "undefined" && S.couleurs && PALETTES_ST[S.couleurs.preset]) ? PALETTES_ST[S.couleurs.preset].lbl : "JM@Santé";
  switch(z){
    case "moniteur": return (S.moniteurStyle === "aere" ? "Aérée" : "Cartes") + " · " + outilsChoisis().length + " raccourcis";
    case "cartes":   return (S.cardStyle === "bande" ? "Bande latérale" : "Pastille " + (S.dotSize || "petite")) + " · " + (CARTE_OPTS.length - (S.carteMasque||[]).length) + "/" + CARTE_OPTS.length + " éléments";
    case "consts":   return (S.constStyle === "tableau" ? "Tableau de bord" : "Classique") + " · " + (6 - (S.constsMasquees||[]).length) + " sur 6 affichées";
    case "couleurs": return th + " · " + pal + ((S.couleurs||{}).motifs ? " · motifs" : "");
    case "texte":    return Math.round(zoomActuel()*100) + " % · zoom " + ({ intelligent:"intelligent", natif:"natif", off:"désactivé" })[S.zoomMode || "intelligent"];
  }
  return "";
}
function sheetPersonnaliser(){
  const zones = [["moniteur","🖥","Moniteur"],["cartes","🪪","Cartes patient"],["consts","📊","Constantes"],
                 ["couleurs","🎨","Couleurs et thèmes"],["texte","🔤","Texte et zoom"]];
  if (typeof sheetPersoPlus === "function") zones.push(...sheetPersoPlus());
  openSheet(`
    ${navHeader("Réglages", true)}
    <h3>🎨 Personnaliser</h3>
    <p class="small muted" style="margin-bottom:10px">Tout ce qui change l'apparence — rien qui touche à tes données.</p>
    ${apercuPerso()}
    ${zones.map(([k,ic,l]) => `<button class="pers-z" data-pz="${k}"><span class="pz-i">${ic}</span>
      <span class="pz-t">${l}<span>${esc(_resume(k))}</span></span><span class="pz-c">›</span></button>`).join("")}
    <button class="btn btn-ghost" id="pz-aides" style="width:100%;margin-top:12px">💡 Revoir les aides et la légende</button>
    <button class="btn btn-ghost" id="pz-raz" style="width:100%;margin-top:8px">↺ Réinitialiser l'affichage</button>`);
  bindNav(sheetTours);
  $$("#sheet [data-pz]").forEach(b => b.onclick = () => sheetPersoZone(b.dataset.pz));
  $("#pz-aides").onclick = () => { S.aides = {}; save(); render(); toast("Les aides réapparaîtront 💡"); };
  $("#pz-raz").onclick = async () => {
    if (!await askDialog({ ic:"↺", titre:"Réinitialiser l'affichage ?",
        sub:"Présentation, cartes, constantes, couleurs, texte, barre d'outils… reviennent à l'origine. <b>Tes données ne sont pas touchées</b>, ni ton thème.", oui:"Réinitialiser" })) return;
    REGLAGES_AFFICHAGE.forEach(k => delete S[k]);
    save(); applyTheme(); renderToolbar(); appliquerZoom(); appliquerModeZoom(); render(); sheetPersonnaliser();
    toast("Affichage d'origine rétabli");
  };
}
function sheetPersoZone(z){
  if (typeof sheetPersoZonePlus === "function" && sheetPersoZonePlus(z)) return;
  const chips = (id, attr, opts, cur) => `<div class="chips" id="${id}" style="margin-bottom:8px">${opts.map(([k,l]) =>
    `<button class="chip ${cur===k?"on":""}" data-${attr}="${k}">${l}</button>`).join("")}</div>`;
  const T = { moniteur:"🖥 Moniteur", cartes:"🪪 Cartes patient", consts:"📊 Constantes", couleurs:"🎨 Couleurs et thèmes", texte:"🔤 Texte et zoom" };
  let corps = "";
  if (z === "moniteur"){
    const ks = outilsChoisis();
    corps = `<div class="lab">Présentation</div>
      ${chips("pz-mon","mon",[["cartes","🗂 Cartes"],["aere","🌬 Aérée"]], S.moniteurStyle==="aere"?"aere":"cartes")}
      <div class="lab" style="margin-top:12px">Barre d'outils <span class="small muted" style="text-transform:none;letter-spacing:0">(🦗 Cigale toujours en premier · 5 raccourcis max.)</span></div>
      <div id="pz-tools">${ks.map((k,i) => `<div class="pz-row"><span>${TOOLS[k].ic} ${esc(TOOLS[k].lbl)}</span>
        <button class="pz-b" data-tup="${i}" ${i?"":"disabled"}>▲</button><button class="pz-b" data-tdn="${i}" ${i<ks.length-1?"":"disabled"}>▼</button>
        <button class="pz-b" data-trm="${k}" ${ks.length>1?"":"disabled"}>✕</button></div>`).join("")}</div>
      ${ks.length < 5 ? `<div class="chips" style="margin-top:6px">${Object.keys(TOOLS).filter(k => !ks.includes(k)).map(k =>
        `<button class="chip" data-tadd="${k}">＋ ${TOOLS[k].ic} ${esc(TOOLS[k].lbl)}</button>`).join("")}</div>` : ""}
      ${typeof persoMoniteurPlus === "function" ? persoMoniteurPlus() : ""}`;
  } else if (z === "cartes"){
    corps = `<div class="lab">Style</div>
      ${chips("pz-card","card",[["classique","● Pastille"],["bande","▌ Bande latérale"]], S.cardStyle==="bande"?"bande":"classique")}
      ${S.cardStyle !== "bande" ? `<div class="lab">Taille de la pastille</div>${chips("pz-dot","dot",[["petite","Petite"],["moyenne","Moyenne"],["grande","Grande"]], S.dotSize||"petite")}` : ""}
      <div class="lab" style="margin-top:12px">Affiché sur la carte repliée</div>
      ${CARTE_OPTS.map(([k,l]) => `<label class="pz-row pz-tg"><span>${l}</span><input type="checkbox" data-cm="${k}" ${carteMontre(k)?"checked":""}></label>`).join("")}
      <p class="small muted" style="margin-top:6px">Les signaux de vigilance restent toujours visibles : valeur hors seuil, jours sans selle, patient prioritaire, absence.</p>`;
  } else if (z === "consts"){
    const o = ordreConst();
    corps = `<div class="lab">Affichage</div>
      ${chips("pz-cst","cst",[["classique","📝 Classique"],["tableau","📊 Tableau de bord"]], S.constStyle==="tableau"?"tableau":"classique")}
      <div class="lab" style="margin-top:12px">Constantes affichées et ordre</div>
      ${o.map((k,i) => `<div class="pz-row"><span>${CONST_LBL[k]}</span>
        <button class="pz-b" data-cup="${i}" ${i?"":"disabled"}>▲</button><button class="pz-b" data-cdn="${i}" ${i<o.length-1?"":"disabled"}>▼</button>
        <input type="checkbox" data-cv="${k}" ${(S.constsMasquees||[]).includes(k)?"":"checked"}></div>`).join("")}
      <p class="small muted" style="margin-top:6px">Une constante masquée disparaît de la saisie, des tuiles et de la ligne du Moniteur — <b>jamais de l'historique, des courbes ni de la relève</b>. Pour un patient précis, force-la dans sa fiche → 💉 Soins.</p>`;
  } else if (z === "couleurs"){
    corps = `<div class="lab">Thème</div>
      <div class="chips" style="margin-bottom:10px">${Object.entries(APP_THEMES).map(([k,v]) => `
        <button class="chip ${S.theme===k?"on":""}" data-pth="${k}"><span style="width:10px;height:10px;border-radius:50%;background:${v.dot};display:inline-block;margin-right:2px"></span>${v.lbl}</button>`).join("")}</div>
      ${typeof persoThemeAutoHtml === "function" ? persoThemeAutoHtml() : ""}
      <button class="btn btn-ghost" id="pz-coul" style="width:100%;margin-top:8px">🎨 Couleurs des statuts et aide daltonisme</button>`;
  } else if (z === "texte"){
    const zc = zoomActuel();
    corps = `<div class="lab">Taille</div>
      <div class="chips" style="margin-bottom:4px">${CRANS.map(([l,v]) => `<button class="chip ${Math.abs(zc-v)<0.03?"on":""}" data-zc="${v}">${l}</button>`).join("")}</div>
      <p class="small muted" style="margin-bottom:12px">Niveau actuel : <b>${Math.round(zc*100)} %</b>. À partir de 130 %, les cartes passent sur une seule colonne.</p>
      <div class="lab">Zoom à deux doigts</div>
      ${[["intelligent","Intelligent","Écarte deux doigts n'importe où : toute l'app grossit en se réorganisant dans la largeur de l'écran. Le niveau est gardé. Conseillé."],
         ["natif","Natif","Le zoom classique du téléphone, comme sur une page web : agrandissement libre, mais il faut faire défiler de côté, et le bouton du bas peut sortir de l'écran le temps du zoom."],
         ["off","Désactivé","Aucun zoom à deux doigts (évite les zooms involontaires). La taille reste réglable ci-dessus."]].map(([k,l,d]) => `
        <button class="pz-opt ${(S.zoomMode||"intelligent")===k?"on":""}" data-zm="${k}"><b>${l}</b><span>${d}</span></button>`).join("")}
      <p class="small muted" style="margin-top:6px">Sur ordinateur : <b>Ctrl + molette</b>. Les photos et documents gardent leur propre zoom.</p>`;
  }
  openSheet(`${navHeader("Personnaliser", true)}<h3>${T[z] || ""}</h3>${apercuPerso()}${corps}
    <button class="btn btn-primary" id="pz-ok" style="width:100%;margin-top:14px">✓ Terminé</button>`);
  bindNav(sheetPersonnaliser);
  $("#pz-ok").onclick = sheetPersonnaliser;
  const maj = () => { save(); applyTheme(); renderToolbar(); render(); sheetPersoZone(z); };
  $$("#sheet [data-mon]").forEach(b => b.onclick = () => { S.moniteurStyle = b.dataset.mon; maj(); });
  $$("#sheet [data-card]").forEach(b => b.onclick = () => { S.cardStyle = b.dataset.card; maj();
    if (S.cardStyle === "bande" && typeof aideUne === "function") aideUne("bande", { ic:"▌", titre:"Cartes à bande latérale",
      sub:"La couleur du bord gauche donne le statut d'un coup d'œil. 📞 ouvre ses numéros, 📍 lance l'itinéraire. La légende reste au-dessus de la liste (ⓘ)." }); });
  $$("#sheet [data-dot]").forEach(b => b.onclick = () => { S.dotSize = b.dataset.dot; maj(); });
  $$("#sheet [data-cst]").forEach(b => b.onclick = () => { S.constStyle = b.dataset.cst; maj(); });
  $$("#sheet [data-cm]").forEach(b => b.onchange = () => {
    const s = new Set(S.carteMasque || []); b.checked ? s.delete(b.dataset.cm) : s.add(b.dataset.cm); S.carteMasque = [...s]; maj(); });
  $$("#sheet [data-cv]").forEach(b => b.onchange = () => {
    const s = new Set(S.constsMasquees || []); b.checked ? s.delete(b.dataset.cv) : s.add(b.dataset.cv);
    if (s.size >= 6){ toast("Garde au moins une constante"); b.checked = true; return; }
    S.constsMasquees = [...s]; maj(); });
  const bouge = (arr, i, d) => { const a = [...arr]; const j = i + d; [a[i], a[j]] = [a[j], a[i]]; return a; };
  $$("#sheet [data-cup]").forEach(b => b.onclick = () => { S.constsOrdre = bouge(ordreConst(), +b.dataset.cup, -1); maj(); });
  $$("#sheet [data-cdn]").forEach(b => b.onclick = () => { S.constsOrdre = bouge(ordreConst(), +b.dataset.cdn, 1); maj(); });
  $$("#sheet [data-tup]").forEach(b => b.onclick = () => { S.toolbar = bouge(outilsChoisis(), +b.dataset.tup, -1); maj(); });
  $$("#sheet [data-tdn]").forEach(b => b.onclick = () => { S.toolbar = bouge(outilsChoisis(), +b.dataset.tdn, 1); maj(); });
  $$("#sheet [data-trm]").forEach(b => b.onclick = () => { S.toolbar = outilsChoisis().filter(k => k !== b.dataset.trm); maj(); });
  $$("#sheet [data-tadd]").forEach(b => b.onclick = () => { S.toolbar = [...outilsChoisis(), b.dataset.tadd].slice(0,5); maj(); });
  $$("#sheet [data-pth]").forEach(b => b.onclick = () => { S.theme = b.dataset.pth; maj(); });
  { const c = $("#pz-coul"); if (c) c.onclick = () => sheetCouleurs(); }
  $$("#sheet [data-zc]").forEach(b => b.onclick = () => { S.zoomApp = +b.dataset.zc; appliquerZoom(); maj(); });
  $$("#sheet [data-zm]").forEach(b => b.onclick = () => { S.zoomMode = b.dataset.zm; appliquerModeZoom(); maj();
    if (typeof aideUne === "function") aideUne("zoom-" + S.zoomMode, { ic:"🔍", titre:"Zoom " + ({ intelligent:"intelligent", natif:"natif", off:"désactivé" })[S.zoomMode],
      sub: S.zoomMode === "intelligent" ? "Écarte ou rapproche deux doigts n'importe où. Un badge montre le niveau ; ↺ remet à 100 %." :
           S.zoomMode === "natif" ? "Zoom du téléphone : l'écran s'agrandit comme une photo. Dézoome pour retrouver le bouton du bas." :
           "Plus aucun zoom à deux doigts. Change la taille avec les boutons Normale / Grande / Très grande." }); });
  if (typeof persoZoneBind === "function") persoZoneBind(z, maj);
}

/* ---------- Zones supplémentaires : relève, partage ; ouverture ; jour/nuit ---------- */
function sheetPersoPlus(){ return [["releve","📋","Relève"],["partage","📤","Partager mes réglages"]]; }
const _resume0 = _resume;
_resume = function(z){
  if (z === "releve"){ const r = S.releveDefaut || {};
    return ({ txt:"Texte", pdf:"PDF", html:"HTML", docx:"Word" })[r.format || "txt"] + " · " + ({ full:"complète", events:"événements", select:"sélection" })[r.mode || "full"] + (r.signature ? " · signée" : ""); }
  if (z === "partage") return "sans aucune donnée patient";
  let t = _resume0(z);
  if (z === "couleurs" && S.themeAuto && S.themeAuto.on) t = "jour/nuit auto · " + t.split(" · ").slice(1).join(" · ");
  return t;
};
function persoMoniteurPlus(){
  const o = S.ouverture || {};
  return `<div class="lab" style="margin-top:14px">À l'ouverture de l'app</div>
    <div class="small muted" style="margin-bottom:4px">Tournée affichée</div>
    <div class="chips" style="margin-bottom:8px">
      <button class="chip ${!o.tour || o.tour==="last" ? "on" : ""}" data-otour="last">La dernière utilisée</button>
      ${(S.tours||[]).map(t => `<button class="chip ${o.tour===t?"on":""}" data-otour="${esc(t)}">Toujours : ${esc(t)}</button>`).join("")}</div>
    ${S.slotsEnabled ? `<div class="small muted" style="margin-bottom:4px">Moment</div>
    <div class="chips">${[["auto","Selon l'heure"],["jour","📅 Journée"],["matin","☀️ Matin"],["soir","🌙 Soir"]].map(([k,l]) =>
      `<button class="chip ${(o.moment||"auto")===k?"on":""}" data-omom="${k}">${l}</button>`).join("")}</div>` : ""}`;
}
function persoThemeAutoHtml(){
  const a = S.themeAuto || {};
  const sel = (id, v) => `<select id="${id}">${Object.entries(APP_THEMES).map(([k,x]) => `<option value="${k}" ${v===k?"selected":""}>${esc(x.lbl)}</option>`).join("")}</select>`;
  return `<label class="pz-row pz-tg" style="border-top:none"><span><b>Thème de jour et thème de nuit</b><br><span class="small muted">L'app bascule seule à l'heure choisie.</span></span>
      <input type="checkbox" id="ta-on" ${a.on?"checked":""}></label>
    ${a.on ? `<div class="pz-jn">
      <div><div class="small muted">☀️ Jour, à partir de</div><input id="ta-hj" type="time" value="${esc(a.hJour||"07:00")}">${sel("ta-j", a.jour || "bloc")}</div>
      <div><div class="small muted">🌙 Nuit, à partir de</div><input id="ta-hn" type="time" value="${esc(a.hNuit||"19:30")}">${sel("ta-n", a.nuit || "hopital")}</div>
    </div><p class="small muted" style="margin-top:6px">Tant que c'est actif, les thèmes ci-dessus choisissent le décor ; le choix de thème unique reprend la main si tu désactives.</p>` : ""}`;
}
function persoZoneBind(z, maj){
  if (z === "moniteur"){
    $$("#sheet [data-otour]").forEach(b => b.onclick = () => { S.ouverture = { ...(S.ouverture||{}), tour:b.dataset.otour }; maj(); });
    $$("#sheet [data-omom]").forEach(b => b.onclick = () => { S.ouverture = { ...(S.ouverture||{}), moment:b.dataset.omom }; maj(); });
  }
  if (z === "couleurs"){
    const on = $("#ta-on");
    if (on) on.onchange = () => { S.themeAuto = { jour:"bloc", nuit:"hopital", hJour:"07:00", hNuit:"19:30", ...(S.themeAuto||{}), on:on.checked };
      maj(); if (on.checked) toast("Thème actuel : " + ((APP_THEMES[themeEffectif()]||{}).lbl || "")); };
    [["ta-hj","hJour"],["ta-hn","hNuit"],["ta-j","jour"],["ta-n","nuit"]].forEach(([id,k]) => { const e = $("#"+id);
      if (e) e.onchange = () => { S.themeAuto[k] = e.value; save(); applyTheme(); render(); }; });
  }
}
function sheetPersoZonePlus(z){
  if (z === "releve"){
    const r = S.releveDefaut || {};
    const chips = (attr, opts, cur) => `<div class="chips" style="margin-bottom:8px">${opts.map(([k,l]) =>
      `<button class="chip ${cur===k?"on":""}" data-${attr}="${k}">${l}</button>`).join("")}</div>`;
    openSheet(`${navHeader("Personnaliser", true)}<h3>📋 Relève</h3>
      <p class="small muted" style="margin-bottom:10px">Présélectionné à chaque génération ; tu peux toujours changer pour une relève ponctuelle.</p>
      <div class="lab">Format</div>${chips("rfm",[["txt","🗒️ Texte"],["pdf","📑 PDF"],["html","🌐 HTML"],["docx","📝 Word"]], r.format||"txt")}
      <div class="lab">Contenu</div>${chips("rmo",[["full","Complète"],["events","Événements seuls"],["select","Sélection"]], r.mode||"full")}
      <div class="lab" style="margin-top:6px">Ordre</div>
      <label class="pz-row pz-tg"><span>Patients en vigilance en premier</span><input type="checkbox" id="rv-vig" ${r.vigilanceDabord?"checked":""}></label>
      <label class="pz-row pz-tg"><span>Rappels de tournée à la fin (au lieu du début)</span><input type="checkbox" id="rv-raf" ${r.rappelsEnFin?"checked":""}></label>
      <div class="lab" style="margin-top:12px">Signature</div>
      <input id="rv-sig" placeholder="ex. Jmeu, IDEL remplaçant" value="${esc(r.signature||"")}" maxlength="80">
      <p class="small muted" style="margin-top:4px">Ajoutée en bas de chaque relève.</p>
      <button class="btn btn-primary" id="pz-ok" style="width:100%;margin-top:14px">✓ Terminé</button>`);
    bindNav(sheetPersonnaliser);
    const set = (k, v) => { S.releveDefaut = { ...(S.releveDefaut||{}), [k]:v }; save(); };
    $$("#sheet [data-rfm]").forEach(b => b.onclick = () => { set("format", b.dataset.rfm); sheetPersoZone("releve"); });
    $$("#sheet [data-rmo]").forEach(b => b.onclick = () => { set("mode", b.dataset.rmo); sheetPersoZone("releve"); });
    $("#rv-vig").onchange = e => set("vigilanceDabord", e.target.checked);
    $("#rv-raf").onchange = e => set("rappelsEnFin", e.target.checked);
    $("#rv-sig").oninput = e => set("signature", e.target.value.trim());
    $("#pz-ok").onclick = sheetPersonnaliser;
    return true;
  }
  if (z === "partage"){
    const av = S._reglagesAvant;
    openSheet(`${navHeader("Personnaliser", true)}<h3>📤 Partager mes réglages</h3>
      <p class="small muted" style="margin-bottom:10px">Pour harmoniser l'app dans un cabinet, ou retrouver tes préférences sur un nouveau téléphone.</p>
      <div class="pz-row">✓ Thème, couleurs, cartes, constantes, texte et zoom, barre d'outils, relève par défaut</div>
      <div class="pz-row" style="opacity:.6">✗ Jamais inclus : patients, tournées, mots de passe, collègues, identité</div>
      <button class="btn btn-primary" id="rg-share" style="width:100%;margin-top:12px">📤 Partager mes réglages</button>
      ${av ? `<button class="btn btn-ghost" id="rg-undo" style="width:100%;margin-top:8px">↺ Revenir à mes réglages d'avant (${esc(av.de||"")})</button>` : ""}
      <p class="small muted" style="margin-top:8px">Pour appliquer les réglages d'un collègue : ouvre simplement le fichier reçu avec JM@Santé.</p>
      <button class="btn btn-ghost" id="pz-ok" style="width:100%;margin-top:10px">← Retour</button>`);
    bindNav(sheetPersonnaliser);
    $("#rg-share").onclick = () => partagerReglages();
    { const u = $("#rg-undo"); if (u) u.onclick = () => { appliquerReglages(S._reglagesAvant.reglages); delete S._reglagesAvant; save();
        toast("Tes réglages d'avant sont rétablis"); sheetPersoZone("partage"); }; }
    $("#pz-ok").onclick = sheetPersonnaliser;
    return true;
  }
  return false;
}

/* ---------- Partage des réglages ----------
   Liste FERMÉE : rien d'autre que ces clés ne sort ni n'entre. */
const REGLAGES_PARTAGES = ["theme", ...REGLAGES_AFFICHAGE.filter(k => k !== "ouverture")];
function extraireReglages(){
  const r = {};
  REGLAGES_PARTAGES.forEach(k => { if (S[k] !== undefined) r[k] = JSON.parse(JSON.stringify(S[k])); });
  return r;
}
function appliquerReglages(r){
  REGLAGES_PARTAGES.forEach(k => { if (r && r[k] !== undefined) S[k] = JSON.parse(JSON.stringify(r[k])); else delete S[k]; });
  if (S.theme && !APP_THEMES[S.theme]) S.theme = "original";
  save(); applyTheme(); renderToolbar(); appliquerZoom(); appliquerModeZoom(); render();
}
async function partagerReglages(){
  const txt = JSON.stringify({ _jmreglages:1, de:(typeof whoami === "function" ? whoami() : ""), date:new Date().toISOString(), reglages:extraireReglages() }, null, 1);
  await partagerTexte("JMSante_reglages_" + todayISO() + ".json", txt, "Réglages JM@Santé", "Mes réglages d'affichage JM@Santé (aucune donnée patient)");
}
async function recevoirReglages(j){
  const r = j && j.reglages; if (!r || typeof r !== "object"){ toast("Fichier de réglages illisible"); return; }
  const n = Object.keys(r).filter(k => REGLAGES_PARTAGES.includes(k)).length;
  if (!await askDialog({ ic:"🎨", titre:"Appliquer les réglages de " + (j.de || "ce collègue") + " ?",
      sub:`${n} réglage(s) d'affichage : thème, couleurs, cartes, constantes, texte, barre d'outils…<br><br>Aucune donnée n'est touchée. Tu pourras revenir aux tiens : 🎨 Personnaliser → 📤 Partager mes réglages → ↺.`,
      oui:"Appliquer", non:"Annuler" })) return;
  S._reglagesAvant = { de:j.de || "", reglages:extraireReglages() };
  const propre = {}; Object.keys(r).forEach(k => { if (REGLAGES_PARTAGES.includes(k)) propre[k] = r[k]; });
  appliquerReglages(propre);
  toast("Réglages de " + (j.de || "ton collègue") + " appliqués 🎨");
}

/* ---------- Zoom renforcé sur photos et documents (×5) ----------
   Pincer pour zoomer, glisser pour se déplacer, double-toucher pour
   basculer ×1 / ×2,5. Branché automatiquement sur toute image de la
   visionneuse (#docview), photos comme pages de PDF. */
function brancherZoomImage(img){
  if (img._zv) return; img._zv = true;
  img.classList.add("zoomable"); img.style.touchAction = "none"; img.style.transformOrigin = "0 0";
  let s = 1, x = 0, y = 0, d0 = 0, s0 = 1, px = 0, py = 0, mx0 = 0, my0 = 0, dernierTap = 0;
  const pose = () => { img.style.transform = s === 1 ? "" : `translate(${x}px,${y}px) scale(${s})`; };
  const borne = v => Math.min(5, Math.max(1, v));
  img.addEventListener("touchstart", e => {
    if (e.touches.length === 2){
      const [a,b] = e.touches; d0 = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY); s0 = s;
      const r = img.getBoundingClientRect(); mx0 = (a.clientX+b.clientX)/2 - r.left; my0 = (a.clientY+b.clientY)/2 - r.top;
    } else if (e.touches.length === 1){
      px = e.touches[0].clientX; py = e.touches[0].clientY;
      const t = Date.now();
      if (t - dernierTap < 300){ if (s > 1){ s = 1; x = y = 0; } else { s = 2.5; x = -(px - img.getBoundingClientRect().left) * 1.5; y = -(py - img.getBoundingClientRect().top) * 1.5; } pose(); }
      dernierTap = t;
    }
  }, { passive:true });
  img.addEventListener("touchmove", e => {
    e.preventDefault(); e.stopPropagation();
    if (e.touches.length === 2 && d0){
      const [a,b] = e.touches; const ns = borne(s0 * Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY) / d0);
      /* le point entre les doigts reste sous les doigts */
      const r = img.getBoundingClientRect();
      const mx = (a.clientX+b.clientX)/2 - r.left, my = (a.clientY+b.clientY)/2 - r.top;
      x -= mx * (ns/s - 1); y -= my * (ns/s - 1); s = ns; if (s === 1){ x = y = 0; } pose();
    } else if (e.touches.length === 1 && s > 1){
      x += e.touches[0].clientX - px; y += e.touches[0].clientY - py; px = e.touches[0].clientX; py = e.touches[0].clientY; pose();
    }
  }, { passive:false });
  img.addEventListener("touchend", () => { d0 = 0; }, { passive:true });
}
(function observerVisionneuse(){
  const go = () => {
    const ov = document.getElementById("docview"); if (!ov){ return setTimeout(go, 500); }
    ov.classList.add("zv-veil");
    new MutationObserver(() => ov.querySelectorAll("img").forEach(brancherZoomImage)).observe(ov, { childList:true, subtree:true });
  };
  go();
})();
