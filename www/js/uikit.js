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
  return `<div class="vtiles">${TUILES.map(([k,lbl,u]) => {
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
