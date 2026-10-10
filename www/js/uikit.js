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
    .filter(([k]) => typeof constVisible !== "function" || constVisible(k, p, "tuiles"));
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
  S.pinRescue = await hashSecours(code);
  /* La même clé, enfermée une seconde fois : deux portes, un seul coffre */
  try {
    if (typeof coffreChangerSecours === "function" && cleOuverte()) await coffreChangerSecours(normSecours(code));
  } catch(e){ logIncident("coffre", "Porte de secours non posée", e); }
  save(true);
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
        if (await bioUnlock()){
    /* La clé va dans le coffre-fort : c'est ce qui rend l'empreinte
       capable d'ouvrir après un vrai redémarrage. */
    if (typeof coffreFortPoser === "function") await coffreFortPoser();
    S.bioLock = true; save(); toast("Empreinte activée 👆");
  }
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
      /* ⚠️ Deuxième porte du coffre : sans cette ouverture, le nouveau
         code enfermerait une clé neuve et les données seraient perdues. */
      if (typeof coffreExiste === "function" && await coffreExiste()){
        const dk = await coffreOuvrir(normSecours(saisi), "rec");
        if (!dk){
          await askDialog({ ton:"danger", ic:"🔑", titre:"Ce code de secours n'ouvre pas tes données",
            sub:"Il correspond bien à cet appareil, mais la clé qu'il protège n'a pas pu être ouverte.",
            warn:"N'efface rien : réimporte plutôt ta dernière sauvegarde sur une installation neuve.",
            oui:"J'ai compris", seul:true });
          return;
        }
        if (typeof rechargerApresOuverture === "function") await rechargerApresOuverture();
      }
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
      <div class="stc-prev">${[["todo","Gabryella M.","à voir"],["done","Paulette R.","vu"],["alert","J.-Claude D.","vigilance"],["absent","Marcel B.","absent"]].map(([s,n,t]) =>
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
/* v1.0.63 : trois lieux réglés séparément — "ligne" (résumé de la carte
   repliée), "tuiles" (haut de la carte ouverte), "saisie" (plus bas).
   S.cstMasq = { ligne:[], tuiles:[], saisie:[] } ; l'ordre reste commun.
   Ancien réglage unique S.constsMasquees (v1.0.62) : repris pour les trois. */
const LIEUX_CST = [["ligne","① Ligne résumé de la carte repliée","au-dessus de « dernier passage »"],
                   ["tuiles","② Tuiles en haut de la carte ouverte","mode Tableau de bord"],
                   ["saisie","③ Saisie « Constantes » plus bas","champs proposés au passage"]];
function cstMasq(){
  if (!S.cstMasq){
    const m = S.constsMasquees || [];
    S.cstMasq = { ligne:[...m], tuiles:[...m], saisie:[...m] };
    delete S.constsMasquees;
  }
  LIEUX_CST.forEach(([l]) => { if (!Array.isArray(S.cstMasq[l])) S.cstMasq[l] = []; });
  return S.cstMasq;
}
function constVisible(k, p, lieu){
  if (p && (p.constsForcees || []).includes(k)) return true;
  return !cstMasq()[lieu || "saisie"].includes(k);
}
/* ⚠️ Le réglage vivait dans la rubrique « Constantes » sous le nom
   `S.cstLigneOn`, alors que l'utilisateur le cherchait dans « Cartes
   patient » — avec les autres. Il est désormais porté par le MÊME
   mécanisme que l'âge, les badges et le dernier passage : une seule
   vérité, réglable globalement ou dossier par dossier.
   `S.cstLigneOn` n'est gardé que pour reprendre les réglages existants. */
function ligneActive(p){ return carteMontre("consts", p); }
function migrerLigneConstantes(){
  if (S.cstLigneOn === false){
    S.carteMasque = [...new Set([...(S.carteMasque || []), "consts"])];
  }
  delete S.cstLigneOn;
}
function alertesToujours(){ return S.cstAlertesToujours !== false; }
function cstStyle(k, p){
  const i = ordreConst().indexOf(k);
  return `order:${i};${constVisible(k, p, "saisie") ? "" : "display:none"}`;
}

/* Contenu des cartes repliées. Les signaux de vigilance (valeur hors
   seuil, jours sans selle, patient prioritaire, absent, saisie gardée)
   restent TOUJOURS visibles, quoi qu'on décoche. */
const CARTE_OPTS = [
  ["age","Âge"],["badges","📎 🧪 📌 Badges"],["tags","Étiquettes et anniversaire"],
  ["dernier","Dernier passage"],
  /* ⚠️ Les constantes du dernier passage étaient toujours affichées, sans
     réglage possible. Les VALEURS HORS SEUIL restent visibles quoi qu'il
     arrive — c'est un signal de vigilance, pas une information de confort. */
  ["consts","Constantes du dernier passage"],
  /* ⚠️ Décochée par défaut : l'âge suffit le plus souvent, et une date
     de naissance affichée en permanence sur un écran ouvert chez un
     patient n'a pas à y être sans qu'on l'ait voulu. */
  ["dob","Date de naissance"]
];   // la ligne de constantes se règle dans 📊 Constantes
/* ⚠️ Le réglage est GÉNÉRAL par défaut. Un patient peut avoir le sien
   (`p.carteMasque`), auquel cas il ne suit plus le commun : c'est ce que
   l'interrupteur « suivre le réglage général » décide, sur sa fiche.
   Sans ce choix explicite, une modification générale semblerait sans
   effet sur certaines cartes, sans qu'on comprenne pourquoi. */
function carteMontre(k, p){
  if (p && Array.isArray(p.carteMasque)) return !p.carteMasque.includes(k);
  return !((S.carteMasque || []).includes(k));
}
/* Combien de dossiers ne suivent pas le réglage commun ? */
function cartesAPart(){
  return (S.patients || []).filter(x => Array.isArray(x.carteMasque)).length;
}

/* ---------- Barre d'outils ---------- */
const TOOLS = {
  "search":      { ic:"🔍", lbl:"Chercher" },
  "seq":         { ic:"▶",  lbl:"Déroulé", svg:true },
  "new-rappel":  { ic:"📌", lbl:"Rappels" },
  "new-patient": { ic:"＋", lbl:"Patient" },
  "releve":      { ic:"📋", lbl:"Relève" },
  "quickdictate":{ ic:"🎤", lbl:"Note" },
  "route":       { ic:"🖨️", lbl:"Route" },
  "sync":        { ic:"🔄", lbl:"Synchro" },
  "notes":       { ic:"📝", lbl:"Notes" }
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
  "cosmos","haptique","constsMasquees","cstMasq","cstLigneOn","cstAlertesToujours","constsOrdre","carteMasque","toolbar","themeAuto","releveDefaut","ouverture"];

/* ---------- Écran 🎨 Personnaliser ---------- */
/* Aperçu en direct, propre à chaque zone. Patient fictif : Gabryella MISTRAL. */
function _carteApercu(){
  const c = { ta:"128/78", puls:"74", temp:"36.9", glyc:"1.82" };
  const al = alertes(c, {});
  const tg = (k) => { const T = tagDef(k) || { ic:"", lbl:k }; return `${T.ic} ${esc(T.lbl)}`; };
  const bande = S.cardStyle === "bande";
  return `<div class="pcard st-alert warn pers-mini"><span class="st alert"></span>
      <div class="nm">Gabryella MISTRAL${carteMontre("age") ? ` <span class="age">81 ans</span>` : ""}</div>
      <div class="vitals">${vitalsHtml(c, al, {}, null)}</div>
      <div class="badges" style="margin-top:5px">
        ${carteMontre("badges") ? `<span class="mini blue">📎 2</span> <span class="mini blue">🧪 1</span> <span class="mini amber">📌 1</span>` : ""}
        ${carteMontre("tags") ? `<span class="mini anniv">🎂 dans 3 j</span> <span class="mini blue">${tg("surveiller")}</span>` : ""}
        <span class="mini amber" style="font-weight:700">${tg("prioritaire")}</span>
      </div>
      ${carteMontre("dernier") ? `<div class="lastseen">dernier passage : hier 8:12</div>` : ""}
      ${bande ? `<div class="pc-act"><button aria-label="Appeler" class="pc-ic" tabindex="-1">📞</button><button aria-label="Localiser" class="pc-ic" tabindex="-1">📍</button></div>` : ""}
    </div>`;
}
function _moniteurApercu(){
  const ks = outilsChoisis();
  const aere = S.moniteurStyle === "aere";
  const rang = (cls, lab, chips) => `<div class="pm-row ${aere ? "aere" : "carte"} ${cls}"><div class="pm-lab">${lab}</div><div class="pm-chips">${chips}</div></div>`;
  return `<div class="pm">
    <div class="pm-tb" style="grid-template-columns:repeat(${ks.length+1},minmax(0,1fr))"><span>🦗<br>Cigale</span>${ks.map(k => `<span>${TOOLS[k].ic}<br>${esc(TOOLS[k].lbl)}</span>`).join("")}</div>
    ${rang("g-ac","TOURNÉE",'<i class="on">Pierre G.</i><i>Carole</i>')}
    ${rang("g-am","MOMENT",'<i>☀️ Matin</i><i class="on">📅 Journée</i>')}
    ${rang("g-bl","AVANCEMENT",'<b>11<small>à voir</small></b><b>3<small>vus</small></b><b>1<small>vigil.</small></b>')}
  </div>`;
}
function _constsApercu(){
  const c = { ta:"128/78", puls:"74", sat:"97", temp:"36.9", glyc:"1.10", douleur:"2" };
  const al = alertes(c, {});
  const o = ordreConst();
  const tiles = o.filter(k => constVisible(k, null, "tuiles"));
  const saisie = o.filter(k => constVisible(k, null, "saisie"));
  const court = { ta:"TA", puls:"Pouls", sat:"SpO2", temp:"T°", glyc:"Gly", douleur:"EVA" };
  return `<div class="pc-lieu"><span class="pc-n">①</span><div class="pcard st-todo pers-mini"><span class="st todo"></span>
      <div class="nm">Gabryella MISTRAL</div><div class="vitals">${vitalsHtml(c, al, {}, null) || '<span class="small muted">— aucune constante —</span>'}</div>
      <div class="lastseen">dernier passage : hier 8:12</div></div></div>
    ${S.constStyle === "tableau" ? `<div class="pc-lieu"><span class="pc-n">②</span><div class="pc-tiles">${tiles.length
      ? tiles.map(k => `<span><small>${court[k]}</small>${esc(c[k])}</span>`).join("") : '<em class="small muted">aucune tuile</em>'}</div></div>` : ""}
    <div class="pc-lieu"><span class="pc-n">③</span><div class="pc-saisie">${saisie.map(k => `<span>${court[k]}</span>`).join("")}</div></div>`;
}
function apercuPerso(z){
  const corps = z === "moniteur" ? _moniteurApercu() : z === "consts" ? _constsApercu()
    : z === "couleurs" ? _carteApercu() + (typeof legendeHtml === "function" ? legendeHtml(true) : "") : _carteApercu();
  return `<div class="pers-prev"><div class="pl">APERÇU EN DIRECT</div>${corps}</div>`;
}
function _resume(z){
  const th = (APP_THEMES[S.theme] || {}).lbl || "";
  const pal = (typeof PALETTES_ST !== "undefined" && S.couleurs && PALETTES_ST[S.couleurs.preset]) ? PALETTES_ST[S.couleurs.preset].lbl : "JM@Santé";
  switch(z){
    case "moniteur": return (S.moniteurStyle === "aere" ? "Aérée" : "Cartes") + " · " + outilsChoisis().length + " raccourcis";
    case "cartes":   return (S.cardStyle === "bande" ? "Bande latérale" : "Pastille " + (S.dotSize || "petite")) + " · " + (CARTE_OPTS.length - (S.carteMasque||[]).length) + "/" + CARTE_OPTS.length + " éléments";
    case "consts":   return (S.constStyle === "tableau" ? "Tableau de bord" : "Classique") + " · ligne " + (ligneActive() ? (6 - cstMasq().ligne.length) + "/6" : "masquée") + " · saisie " + (6 - cstMasq().saisie.length) + "/6";
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
    <button class="btn btn-ghost" id="pz-aides" style="width:100%;margin-top:12px">💡 Revoir les aides et la légende${
      Object.keys(S.aides||{}).length ? ` <span class="small muted">— ${Object.keys(S.aides).length} masquée${Object.keys(S.aides).length>1?"s":""}</span>` : ""}</button>
    <p class="small muted" style="margin-top:6px">Les bulles 💡 qui expliquent une fonction à sa première utilisation, et la <b>légende des couleurs</b> du Moniteur si tu l'as repliée. Elles réapparaîtront sur les écrans concernés — pas tout de suite ici.</p>
    <button class="btn btn-ghost" id="pz-raz" style="width:100%;margin-top:8px">↺ Réinitialiser l'affichage</button>`);
  bindNav(sheetTours);
  $$("#sheet [data-pz]").forEach(b => b.onclick = () => sheetPersoZone(b.dataset.pz));
  /* ⚠️ L'effet de ce bouton n'est visible que PLUS TARD, en retournant sur
   la fonction concernée : sans un message qui le dise, on croit qu'il ne
   fait rien. Et s'il n'y a rien à remettre, il faut le dire aussi. */
  $("#pz-aides").onclick = () => {
    const n = Object.keys(S.aides || {}).length;
    if (!n){
      toast("Aucune aide n'est masquée — elles s'afficheront à la première utilisation");
      return;
    }
    /* ⚠️ `save()` annonce « Sauvegardé localement » : son message
       recouvrait celui-ci, et l'utilisateur ne voyait que l'enregistrement
       — d'où l'impression que le bouton ne faisait rien. On enregistre
       sans bruit, puis on dit ce qui vient de se passer. */
    S.aides = {}; save(true); render(); sheetPersonnaliser();
    toast(n + " aide" + (n > 1 ? "s" : "") + " remise" + (n > 1 ? "s" : "") + " — elles reviendront sur les écrans concernés 💡");
  };
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
        <button aria-label="Monter" class="pz-b" data-tup="${i}" ${i?"":"disabled"}>▲</button><button aria-label="Descendre" class="pz-b" data-tdn="${i}" ${i<ks.length-1?"":"disabled"}>▼</button>
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
      <!-- ⚠️ Le réglage par patient existait sans que rien ne l'annonce :
           on ne pouvait le découvrir qu'en fouillant une fiche. La note
           est posée ICI, juste après les options — là où la question se
           pose — et elle donne le chemin en toutes lettres. -->
      <div class="pz-note">Ce réglage vaut pour <b>tous les dossiers</b>.<br>
        Pour une exception : fiche du patient → <b>⚡ Actions</b> → <b>🪪 Ce qu'affiche sa carte</b>.</div>
      <p class="small muted" style="margin-top:6px">Les signaux de vigilance restent toujours visibles : valeur hors seuil, jours sans selle, patient prioritaire, absence.</p>
      ${cartesAPart() ? `<div class="warn" style="margin-top:10px">
        <b>${cartesAPart()} dossier${cartesAPart()>1?"s ne suivent":" ne suit"} pas ce réglage</b> : ${cartesAPart()>1?"ils ont":"il a"} le sien, réglé depuis la fiche.
        <button class="btn btn-ghost btn-sm" id="pz-cartes-raz" style="width:100%;margin-top:8px">↺ Tout remettre sur le réglage général</button>
      </div>` : ""}
      <div class="lab" style="margin-top:14px">🏷️ Mes étiquettes</div>
      ${Object.entries(S.tagsPerso||{}).map(([id,T]) => `<button class="pz-row pz-tagl" data-tged="${id}" style="width:100%;background:none;border-left:none;border-right:none;border-bottom:none;color:var(--text);text-align:left">
        <span><span class="mini tagp" style="--tc:${esc(T.col)}">${T.ic} ${esc(T.lbl)}</span></span>
        <span class="small muted">${nbPatientsTag(id)} patient${nbPatientsTag(id)>1?"s":""} · ✏️</span></button>`).join("") || `<p class="small muted">Aucune pour l'instant. Crée les tiennes : chien méchant, clé chez la voisine, sourd…</p>`}
      <button class="btn btn-ghost" id="pz-tgnew" style="width:100%;margin-top:6px">＋ Nouvelle étiquette</button>`;
  } else if (z === "consts"){
    const o = ordreConst(), m = cstMasq();
    corps = `<div class="lab">Affichage</div>
      ${chips("pz-cst","cst",[["classique","📝 Classique"],["tableau","📊 Tableau de bord"]], S.constStyle==="tableau"?"tableau":"classique")}
      <div class="lab" style="margin-top:12px">Ordre (commun aux trois endroits)</div>
      ${o.map((k,i) => `<div class="pz-row"><span>${CONST_LBL[k]}</span>
        <button aria-label="Monter" class="pz-b" data-cup="${i}" ${i?"":"disabled"}>▲</button><button aria-label="Descendre" class="pz-b" data-cdn="${i}" ${i<o.length-1?"":"disabled"}>▼</button></div>`).join("")}
      ${LIEUX_CST.map(([l,t,sub]) => `
        <div class="pz-lieu ${l==="ligne" && !ligneActive() ? "off" : ""}">
          <div class="pz-lt"><b>${t}</b><span>${sub}</span></div>
          ${l === "ligne" ? `<label class="pz-row pz-tg" style="border-top:none"><span>Afficher la ligne</span><input type="checkbox" id="pz-lon" ${ligneActive()?"checked":""}></label>
            <p class="small muted" style="margin:6px 0 0">Même réglage que <b>🪪 Cartes patient</b> → Constantes du dernier passage. Réglable aussi dossier par dossier depuis une fiche.</p>` : ""}
          ${l === "tuiles" && S.constStyle !== "tableau" ? `<p class="small muted">Actives seulement en mode Tableau de bord.</p>` : ""}
          <div class="pz-cks">${o.map(k => `<label class="pz-ck ${m[l].includes(k)?"":"on"}"><input type="checkbox" data-cl="${l}|${k}" ${m[l].includes(k)?"":"checked"}>${esc(CONST_LBL[k].replace(" (EVA)",""))}</label>`).join("")}</div>
        </div>`).join("")}
      <label class="pz-row pz-tg" style="margin-top:8px"><span><b>Valeurs hors seuil toujours visibles</b><br><span class="small muted">Sur la ligne ①, une valeur hors seuil s'affiche même si sa constante n'est pas cochée ou si la ligne est masquée. Conseillé.</span></span><input type="checkbox" id="pz-alt" ${alertesToujours()?"checked":""}></label>
      <p class="small muted" style="margin-top:6px">Masquer ne supprime rien : <b>historique, courbes et relève gardent tout</b>. Pour un patient précis, force une constante dans sa fiche → 💉 Soins (elle apparaît alors aux trois endroits).</p>`;
  } else if (z === "couleurs"){
    corps = `<div class="lab">Thème</div>
      <div class="chips" style="margin-bottom:10px">${Object.entries(APP_THEMES).map(([k,v]) => `
        <button class="chip ${S.theme===k?"on":""}" data-pth="${k}"><span style="width:10px;height:10px;border-radius:50%;background:${v.dot};display:inline-block;margin-right:2px"></span>${v.lbl}</button>`).join("")}</div>
      ${typeof persoThemeAutoHtml === "function" ? persoThemeAutoHtml() : ""}
      ${typeof persoCosmosHtml === "function" ? persoCosmosHtml() : ""}
      <button class="btn btn-ghost" id="pz-coul" style="width:100%;margin-top:8px">🎨 Couleurs des statuts et aide daltonisme</button>

      <div class="lab" style="margin-top:16px">Fini</div>
      <p class="small muted" style="margin-bottom:8px">Le relief des cartes et des panneaux, indépendamment des couleurs.</p>
      ${[["auto","Celui du thème","Chaque thème a son fini d'origine."],
         ["plat","Plat","Aucun relief. Le plus sobre, et le plus léger."],
         ["hd","Haute définition","Contraste poussé, bords nets, dégradés fins. Pas de volume."],
         ["relief","Relief","Les cartes sont posées sur le fond : biseau clair en haut, ombre portée."],
         ["grave","Gravé","Les cartes sont creusées dans la surface. Reposant sur une longue liste."]]
        .map(([k,l,d]) => `<button class="pz-opt ${(S.fini||"auto")===k?"on":""}" data-fini="${k}"><b>${l}</b><span>${d}</span></button>`).join("")}
      <div class="tip" style="margin-top:8px">Les <b>couleurs de vigilance</b> gardent leur teinte dans tous les finis : le relief s'ajoute à l'alerte, il ne la remplace pas.</div>
      <p class="small muted" style="margin-top:7px">Si ton téléphone demande moins d'animations, le relief s'efface tout seul.</p>`;
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
  openSheet(`${navHeader("Personnaliser", true)}<h3>${T[z] || ""}</h3>${apercuPerso(z)}${corps}
    <button class="btn btn-primary" id="pz-ok" style="width:100%;margin-top:14px">✓ Terminé</button>`);
  bindNav(sheetPersonnaliser);
  $("#pz-ok").onclick = sheetPersonnaliser;
  const maj = () => { save(); applyTheme(); renderToolbar(); render(); sheetPersoZone(z); };
  $$("#sheet [data-mon]").forEach(b => b.onclick = () => { S.moniteurStyle = b.dataset.mon; maj(); });
  $$("#sheet [data-card]").forEach(b => b.onclick = () => { S.cardStyle = b.dataset.card; maj();
    if (S.cardStyle === "bande" && typeof aideUne === "function") aideUne("bande", { ic:"▌", titre:"Cartes à bande latérale",
      sub:"La couleur du bord gauche donne le statut d'un coup d'œil. 📞 ouvre ses numéros, 📍 lance l'itinéraire. La légende reste au-dessus de la liste (ⓘ)." }); });
  $$("#sheet [data-dot]").forEach(b => b.onclick = () => { S.dotSize = b.dataset.dot; maj(); });
  $$("#sheet [data-tged]").forEach(b => b.onclick = () => sheetEtiquette(b.dataset.tged));
  { const n = $("#pz-tgnew"); if (n) n.onclick = () => sheetEtiquette(null); }
  $$("#sheet [data-cst]").forEach(b => b.onclick = () => { S.constStyle = b.dataset.cst; maj(); });
  { const r = $("#pz-cartes-raz");
    if (r) r.onclick = async () => {
      const n = cartesAPart();
      if (!await askDialog({ ic:"↺", titre:"Tout remettre en commun ?",
        sub: n + " dossier" + (n>1?"s repasseront":" repassera") + " sur le réglage général.",
        oui:"↺ Remettre en commun" })) return;
      (S.patients||[]).forEach(x => { delete x.carteMasque; });
      save(true); render(); sheetPersoZone("cartes");
      toast("Toutes les cartes suivent le réglage général");
    }; }
  $$("#sheet [data-cm]").forEach(b => b.onchange = () => {
    const s = new Set(S.carteMasque || []); b.checked ? s.delete(b.dataset.cm) : s.add(b.dataset.cm); S.carteMasque = [...s]; maj(); });
  $$("#sheet [data-cl]").forEach(b => b.onchange = () => {
    const [l, k] = b.dataset.cl.split("|"); const m = cstMasq(); const s = new Set(m[l]);
    b.checked ? s.delete(k) : s.add(k);
    if (l === "saisie" && s.size >= 6){ toast("Garde au moins une constante à saisir"); b.checked = true; return; }
    m[l] = [...s]; maj(); });
  { const e = $("#pz-lon");
    if (e) e.onchange = () => {
      const set = new Set(S.carteMasque || []);
      e.checked ? set.delete("consts") : set.add("consts");
      S.carteMasque = [...set]; maj();
    }; }
  { const e = $("#pz-alt"); if (e) e.onchange = () => { S.cstAlertesToujours = e.checked; maj(); }; }
  const bouge = (arr, i, d) => { const a = [...arr]; const j = i + d; [a[i], a[j]] = [a[j], a[i]]; return a; };
  $$("#sheet [data-cup]").forEach(b => b.onclick = () => { S.constsOrdre = bouge(ordreConst(), +b.dataset.cup, -1); maj(); });
  $$("#sheet [data-cdn]").forEach(b => b.onclick = () => { S.constsOrdre = bouge(ordreConst(), +b.dataset.cdn, 1); maj(); });
  $$("#sheet [data-tup]").forEach(b => b.onclick = () => { S.toolbar = bouge(outilsChoisis(), +b.dataset.tup, -1); maj(); });
  $$("#sheet [data-tdn]").forEach(b => b.onclick = () => { S.toolbar = bouge(outilsChoisis(), +b.dataset.tdn, 1); maj(); });
  $$("#sheet [data-trm]").forEach(b => b.onclick = () => { S.toolbar = outilsChoisis().filter(k => k !== b.dataset.trm); maj(); });
  $$("#sheet [data-tadd]").forEach(b => b.onclick = () => { S.toolbar = [...outilsChoisis(), b.dataset.tadd].slice(0,5); maj(); });
  $$("#sheet [data-pth]").forEach(b => b.onclick = () => { S.theme = b.dataset.pth; maj(); });
  /* ⚠️ Le fini se range dans S.fini : « auto » suit le thème, les
     autres valeurs l'emportent sur lui. */
  $$("#sheet [data-fini]").forEach(b => b.onclick = () => { S.fini = b.dataset.fini; maj(); });
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
  return `<div class="lab" style="margin-top:14px">Retour au toucher</div>
    <label class="pz-row pz-tg" style="border-top:none"><span><b>📳 Vibrer quand un passage est validé</b><br><span class="small muted">${
      vibrationPossible() ? "Deux petites impulsions : c'est enregistré, sans regarder l'écran." : "Non disponible sur cet appareil (ordinateur)."}</span></span>
      <input type="checkbox" id="pz-hap" ${S.haptique === false ? "" : "checked"} ${vibrationPossible() ? "" : "disabled"}></label>
    ${vibrationPossible() ? `<button class="btn btn-ghost btn-sm" id="pz-hapt" style="width:100%;margin-bottom:4px">📳 Tester</button>` : ""}
    <div class="lab" style="margin-top:14px">À l'ouverture de l'app</div>
    <div class="small muted" style="margin-bottom:4px">Tournée affichée</div>
    <div class="chips" style="margin-bottom:8px">
      <button class="chip ${!o.tour || o.tour==="last" ? "on" : ""}" data-otour="last">La dernière utilisée</button>
      ${(S.tours||[]).map(t => `<button class="chip ${o.tour===t?"on":""}" data-otour="${esc(t)}">Toujours : ${esc(t)}</button>`).join("")}</div>
    ${slotsOn() ? `<div class="small muted" style="margin-bottom:4px">Moment</div>
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
    { const h = $("#pz-hap"); if (h) h.onchange = () => { S.haptique = h.checked; save(); if (h.checked) vibrer("succes"); }; }
    { const t = $("#pz-hapt"); if (t) t.onclick = () => { if (S.haptique === false) toast("La vibration est désactivée"); else vibrer("succes"); }; }
    $$("#sheet [data-otour]").forEach(b => b.onclick = () => { S.ouverture = { ...(S.ouverture||{}), tour:b.dataset.otour }; maj(); });
    $$("#sheet [data-omom]").forEach(b => b.onclick = () => { S.ouverture = { ...(S.ouverture||{}), moment:b.dataset.omom }; maj(); });
  }
  if (z === "couleurs"){
    if (typeof bindCosmos === "function") bindCosmos(maj);
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
const REGLAGES_PARTAGES = ["theme", "fini", ...REGLAGES_AFFICHAGE.filter(k => k !== "ouverture")];
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

/* ============================================================
   THÈME COSMOS · NGC 3324 — v1.0.64
   ─────────────────────────────────────────────────────────
   Six vues qui se relaient selon l'heure, dessinées en SVG et
   animées en SMIL (léger, sans image) : aube, orbite, falaises
   cosmiques (NGC 3324, « nébuleuse Gabriela Mistral »), crépuscule
   planétaire, nuit boréale, nuit australe.
   S.cosmos = { nuit:"alterner"|"nord"|"sud", creneaux:[{h, vue, on}],
                force:null|vue, fondu:true, anim:"completes"|"discretes"|"aucune" }
   Les créneaux gardent leurs heures ; ▲▼ déplace une VUE d'un créneau
   à l'autre. Pause en arrière-plan, fixe si « réduire les animations ».
============================================================ */
const COSMOS_VUES = {
  aube:     { lbl:"Aube cosmique",        sub:"Vénus, dernières étoiles" },
  orbite:   { lbl:"Vue orbitale",         sub:"la Terre depuis l'orbite" },
  falaises: { lbl:"Falaises cosmiques",   sub:"NGC 3324 en vedette" },
  planetes: { lbl:"Crépuscule planétaire",sub:"Saturne et Jupiter" },
  boreale:  { lbl:"Nuit boréale",         sub:"Voie lactée, Polaire" },
  australe: { lbl:"Nuit australe",        sub:"Croix du Sud, Carène" }
};
const COSMOS_DEF = [["05:30","aube"],["08:00","orbite"],["12:00","falaises"],["17:00","planetes"],["20:00","boreale"],["00:00","australe"]];
function cfgCosmos(){
  const c = S.cosmos = S.cosmos || {};
  if (!Array.isArray(c.creneaux) || !c.creneaux.length) c.creneaux = COSMOS_DEF.map(([h,v]) => ({ h, vue:v, on:true }));
  c.nuit = c.nuit || "alterner"; c.anim = c.anim || "completes"; if (c.fondu === undefined) c.fondu = true;
  return c;
}
const _hm = s => { const [h,m] = String(s||"0:0").split(":").map(Number); return (h||0)*60 + (m||0); };
function vueCosmos(date){
  const c = cfgCosmos();
  if (c.force && COSMOS_VUES[c.force]) return c.force;
  const on = c.creneaux.filter(x => x.on !== false && COSMOS_VUES[x.vue]);
  if (!on.length) return "falaises";
  const d = date || new Date(), m = d.getHours()*60 + d.getMinutes();
  const tri = [...on].sort((a,b) => _hm(a.h) - _hm(b.h));
  let v = tri[tri.length - 1].vue;                    // avant le 1er créneau : celui de la veille
  tri.forEach(x => { if (_hm(x.h) <= m) v = x.vue; });
  if (c.nuit === "nord" && v === "australe") v = "boreale";
  if (c.nuit === "sud"  && v === "boreale")  v = "australe";
  return v;
}

/* Scènes SVG. k = suffixe d'identifiants (deux calques pour le fondu). */
function _defsCz(k){ return `<defs>
  <pattern id="cs1${k}" width="120" height="90" patternUnits="userSpaceOnUse"><circle cx="8" cy="12" r=".9" fill="#fff"/><circle cx="37" cy="5" r=".6" fill="#cfe"/><circle cx="61" cy="30" r="1.1" fill="#fff"/><circle cx="92" cy="14" r=".7" fill="#ffe"/><circle cx="110" cy="48" r=".9" fill="#fff"/><circle cx="23" cy="55" r=".6" fill="#dff"/><circle cx="74" cy="70" r=".8" fill="#fff"/><circle cx="48" cy="84" r=".5" fill="#fff"/><circle cx="101" cy="80" r=".6" fill="#fde"/><circle cx="15" cy="37" r=".4" fill="#fff"/></pattern>
  <pattern id="cs2${k}" width="150" height="110" patternUnits="userSpaceOnUse"><circle cx="30" cy="20" r="1.3" fill="#fff"/><circle cx="118" cy="36" r="1.2" fill="#bdf"/><circle cx="72" cy="92" r="1.4" fill="#fff"/><circle cx="10" cy="78" r="1.1" fill="#fff"/></pattern>
  <radialGradient id="cgl${k}"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="cb6${k}"><feGaussianBlur stdDeviation="6"/></filter><filter id="cb2${k}"><feGaussianBlur stdDeviation="1.4"/></filter>
  <linearGradient id="cng${k}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7dd3fc"/><stop offset=".5" stop-color="#c4b5fd"/><stop offset="1" stop-color="#fdba74"/>
    <animate attributeName="x1" values="0;-.6;0" dur="12s" repeatCount="indefinite"/><animate attributeName="x2" values="1;1.6;1" dur="12s" repeatCount="indefinite"/></linearGradient>
  <filter id="cgw${k}" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur in="SourceGraphic" stdDeviation="1.8" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`; }
/* Étiquette « ✨ NGC 3324 » — v1.0.65 : police ronde Comfortaa (embarquée,
   licence OFL), dégradé nébulaire cyan → lilas → ambre qui ondule, halo. */
const CZ_FONT = "Comfortaa, 'Varela Round', Nunito, 'Trebuchet MS', sans-serif";
const _ngc = (x, y, k, taille, anchor) => `<text x="${x}" y="${y}" font-size="${taille||10}" font-family="${CZ_FONT}" font-weight="700" letter-spacing=".04em"
  text-anchor="${anchor||"start"}" fill="url(#cng${k})" filter="url(#cgw${k})">✨ NGC 3324</text>`;
const _filante = (x, y, dur) => `<line class="cz-fil" x1="${x}" y1="${y}" x2="${x+26}" y2="${y+13}" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity="0">
  <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;.85;.9;1" dur="${dur}s" repeatCount="indefinite"/>
  <animateTransform attributeName="transform" type="translate" values="0 0;0 0;70 36" keyTimes="0;.85;1" dur="${dur}s" repeatCount="indefinite"/></line>`;
/* _etiq conserve sa signature d'appel : la couleur est remplacée par le dégradé nébulaire */
let _czKCourant = "";
const _etiq = (x, y) => _ngc(x, y, _czKCourant, 10);
function sceneCosmos(v, k){
  _czKCourant = k;
  const S0 = `<svg viewBox="0 0 340 150" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${_defsCz(k)}`;
  if (v === "aube") return S0 + `<linearGradient id="ga${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1030"/><stop offset=".55" stop-color="#3a2a5e"/><stop offset=".85" stop-color="#b8607a"/><stop offset="1" stop-color="#f2a36a"/></linearGradient>
    <rect width="340" height="150" fill="url(#ga${k})"/>
    <rect width="340" height="95" fill="url(#cs1${k})"><animate attributeName="opacity" values=".9;.3;.9" dur="7s" repeatCount="indefinite"/></rect>
    <circle cx="252" cy="80" r="9" fill="url(#cgl${k})"/><circle cx="252" cy="80" r="2.2" fill="#fff"><animate attributeName="r" values="2.2;2.9;2.2" dur="3s" repeatCount="indefinite"/></circle>
    <path d="M60 36a12 12 0 1 0 10 18a9 9 0 1 1 -10 -18z" fill="#fff4dc" opacity=".85"/>
    <path d="M0 150 Q170 112 340 150Z" fill="#1a1024" opacity=".85"/>${_filante(40,12,9)}${_etiq(250,142,"#ffd9c0")}</svg>`;
  if (v === "orbite") return S0 + `<radialGradient id="ge${k}" cx=".5" cy="1.9" r="1.6"><stop offset=".6" stop-color="#1e4f9c"/><stop offset=".67" stop-color="#3b8fd6"/><stop offset=".7" stop-color="#9fd8ff"/><stop offset=".72" stop-color="#050818" stop-opacity="0"/></radialGradient>
    <linearGradient id="gs${k}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff5d0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <rect width="340" height="150" fill="#030612"/><rect width="340" height="150" fill="url(#cs1${k})" opacity=".5"/>
    <g><animateTransform attributeName="transform" type="rotate" values="0 170 320;2 170 320;0 170 320" dur="40s" repeatCount="indefinite"/>
      <ellipse cx="170" cy="320" rx="330" ry="220" fill="url(#ge${k})"/>
      <path d="M40 136 Q90 122 130 128 T220 124 T300 132" stroke="#fff" stroke-opacity=".22" stroke-width="3" fill="none"/></g>
    <rect x="60" y="96" width="220" height="3" fill="url(#gs${k})"><animate attributeName="opacity" values=".3;1;.3" dur="6s" repeatCount="indefinite"/></rect>
    <circle cx="170" cy="97" r="6" fill="#fffbe8"><animate attributeName="r" values="4;7;4" dur="6s" repeatCount="indefinite"/></circle>
    ${_filante(250,10,11)}${_etiq(262,20,"#bfe3ff")}</svg>`;
  if (v === "falaises") return S0 + `<linearGradient id="gn${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a3a"/><stop offset=".45" stop-color="#2a4a8a"/><stop offset=".62" stop-color="#6fa6d8"/></linearGradient>
    <linearGradient id="gc${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2b366"/><stop offset=".3" stop-color="#b8662e"/><stop offset="1" stop-color="#241008"/></linearGradient>
    <rect width="340" height="150" fill="url(#gn${k})"/>
    <g filter="url(#cb6${k})" opacity=".8"><ellipse cx="90" cy="46" rx="80" ry="28" fill="#9fd0ff"><animate attributeName="cx" values="90;115;90" dur="30s" repeatCount="indefinite"/></ellipse>
      <ellipse cx="255" cy="36" rx="70" ry="22" fill="#c7a8ff" opacity=".6"><animate attributeName="cx" values="255;232;255" dur="36s" repeatCount="indefinite"/></ellipse></g>
    <rect width="340" height="100" fill="url(#cs1${k})" opacity=".7"><animate attributeName="opacity" values=".7;.35;.7" dur="6s" repeatCount="indefinite"/></rect>
    <path d="M0 150 L0 100 Q20 86 38 94 Q52 74 70 88 Q86 68 104 82 Q118 60 140 76 Q156 58 176 74 Q194 64 210 80 Q232 62 252 84 Q270 74 288 90 Q310 80 340 96 L340 150Z" fill="url(#gc${k})" filter="url(#cb2${k})"/>
    <g transform="translate(228 34)"><path d="M0-8L.7-.7 8 0 .7.7 0 8-.7.7-8 0-.7-.7Z" fill="#fff"><animateTransform attributeName="transform" type="scale" values="1;1.3;1" dur="4s" repeatCount="indefinite"/></path></g>
    <g transform="translate(300 60) scale(.7)"><path d="M0-8L.7-.7 8 0 .7.7 0 8-.7.7-8 0-.7-.7Z" fill="#fff"/></g>
    ${_filante(20,10,10)}
    ${_ngc(196, 136, k, 13)}
    <text x="200" y="147" font-size="6.5" fill="#dbe8ff" font-family="${CZ_FONT}" font-weight="700" opacity=".9">Falaises cosmiques · Carène</text></svg>`;
  if (v === "planetes") return S0 + `<linearGradient id="gp${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070a22"/><stop offset=".6" stop-color="#23234e"/><stop offset="1" stop-color="#6a3a5a"/></linearGradient>
    <radialGradient id="gsa${k}" cx=".4" cy=".35"><stop offset="0" stop-color="#f4e0b0"/><stop offset="1" stop-color="#a88450"/></radialGradient>
    <radialGradient id="gj${k}" cx=".4" cy=".35"><stop offset="0" stop-color="#f3d9c0"/><stop offset="1" stop-color="#9b6a48"/></radialGradient>
    <rect width="340" height="150" fill="url(#gp${k})"/>
    <rect width="340" height="150" fill="url(#cs1${k})"><animate attributeName="opacity" values=".4;.9;.4" dur="8s" repeatCount="indefinite"/></rect>
    <g><animateTransform attributeName="transform" type="translate" values="0 5;0 -3;0 5" dur="16s" repeatCount="indefinite"/>
      <circle cx="236" cy="62" r="20" fill="url(#gsa${k})"/>
      <g transform="rotate(-16 236 62)"><ellipse cx="236" cy="62" rx="38" ry="9" fill="none" stroke="#e8d3a0" stroke-width="3" opacity=".85">
        <animate attributeName="ry" values="9;11;9" dur="20s" repeatCount="indefinite"/></ellipse></g></g>
    <g><circle cx="120" cy="96" r="13" fill="url(#gj${k})"/>
      <g stroke="#b0784e" stroke-width="1.5" opacity=".75"><path d="M108 92h24"><animateTransform attributeName="transform" type="translate" values="-3 0;3 0;-3 0" dur="12s" repeatCount="indefinite"/></path><path d="M107 99h26"/></g></g>
    <circle cx="60" cy="40" r="7" fill="#f0efe8"/><circle cx="57" cy="38" r="7" fill="#070a22"/>
    ${_filante(150,14,8)}${_etiq(14,142,"#e5d6ff")}</svg>`;
  if (v === "boreale") return S0 + `<linearGradient id="gm${k}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#cfd8ff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="gau${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2cf2a0" stop-opacity=".5"/><stop offset="1" stop-color="#2cf2a0" stop-opacity="0"/></linearGradient>
    <rect width="340" height="150" fill="#040716"/>
    <g><animateTransform attributeName="transform" type="rotate" from="0 290 26" to="360 290 26" dur="240s" repeatCount="indefinite"/>
      <rect x="-220" y="-220" width="800" height="600" fill="url(#cs1${k})"/><rect x="-220" y="-220" width="800" height="600" fill="url(#cs2${k})"><animate attributeName="opacity" values="1;.4;1" dur="5s" repeatCount="indefinite"/></rect>
      <path d="M-60 240 Q140 80 420 -60" stroke="url(#gm${k})" stroke-width="60" fill="none"/>
      <g fill="#fff"><circle cx="70" cy="54" r="1.6"/><circle cx="92" cy="48" r="1.5"/><circle cx="112" cy="52" r="1.5"/><circle cx="130" cy="60" r="1.6"/><circle cx="136" cy="80" r="1.5"/><circle cx="160" cy="82" r="1.6"/><circle cx="164" cy="62" r="1.5"/></g>
      <path d="M70 54L92 48L112 52L130 60L136 80L160 82L164 62L130 60" stroke="#9ab" stroke-width=".5" fill="none" opacity=".6"/></g>
    <circle cx="290" cy="26" r="2.2" fill="#fff"/><text x="296" y="24" font-size="8" fill="#cfe" font-family="sans-serif">Polaire</text>
    <path d="M0 150 Q60 104 120 132 T240 124 T340 132 V150Z" fill="url(#gau${k})"><animate attributeName="opacity" values=".4;1;.4" dur="9s" repeatCount="indefinite"/></path>
    ${_filante(40,16,7)}${_etiq(14,142,"#c8f5e0")}</svg>`;
  /* australe */
  return S0 + `<radialGradient id="ggc${k}"><stop offset="0" stop-color="#ffe6b8" stop-opacity=".55"/><stop offset=".5" stop-color="#b48cff" stop-opacity=".2"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <radialGradient id="gmg${k}"><stop offset="0" stop-color="#e8ecff" stop-opacity=".55"/><stop offset="1" stop-color="#e8ecff" stop-opacity="0"/></radialGradient>
    <radialGradient id="gca${k}"><stop offset="0" stop-color="#ff9a7a" stop-opacity=".8"/><stop offset=".6" stop-color="#8a5cff" stop-opacity=".3"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <rect width="340" height="150" fill="#03040f"/>
    <g><animateTransform attributeName="transform" type="rotate" from="0 170 210" to="-360 170 210" dur="300s" repeatCount="indefinite"/>
      <rect x="-220" y="-220" width="800" height="700" fill="url(#cs1${k})"/><rect x="-220" y="-220" width="800" height="700" fill="url(#cs2${k})"><animate attributeName="opacity" values=".4;1;.4" dur="6s" repeatCount="indefinite"/></rect>
      <ellipse cx="200" cy="80" rx="130" ry="34" fill="url(#ggc${k})" transform="rotate(-25 200 80)"/>
      <ellipse cx="60" cy="36" rx="18" ry="11" fill="url(#gmg${k})"/><ellipse cx="96" cy="58" rx="10" ry="6" fill="url(#gmg${k})"/>
      <g fill="#fff"><circle cx="258" cy="38" r="1.9"/><circle cx="262" cy="68" r="1.8"/><circle cx="246" cy="52" r="1.5"/><circle cx="276" cy="50" r="1.6"/></g>
      <path d="M258 38L262 68M246 52L276 50" stroke="#bcd" stroke-width=".5" opacity=".6"/>
      <circle cx="150" cy="108" r="16" fill="url(#gca${k})"><animate attributeName="r" values="14;18;14" dur="8s" repeatCount="indefinite"/></circle>
      <text x="168" y="112" font-size="8" fill="url(#cng${k})" filter="url(#cgw${k})" font-family="${CZ_FONT}" font-weight="700">✨ Carène · NGC 3324</text></g>
    <text x="284" y="32" font-size="8" fill="#dde" font-family="sans-serif">Croix du Sud</text>
    ${_filante(200,10,8)}${_etiq(14,142,"#ffd2c4")}</svg>`;
}

/* Pose / met à jour la scène dans le bandeau de marque */
let _czVue = null, _czTimer = null, _czK = 0;
function niveauAnim(){
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return "aucune";
  return cfgCosmos().anim;
}
function _pauseScene(svgs, pause){ svgs.forEach(s => { try { pause ? s.pauseAnimations() : s.unpauseAnimations(); } catch(e){} }); }
function majCosmos(force){
  const brand = document.querySelector(".brand");
  const actif = document.documentElement.dataset.themeActif === "cosmos";
  let box = document.getElementById("cz-scene");
  if (!actif){ if (box) box.remove(); _czVue = null; clearInterval(_czTimer); _czTimer = null; return; }
  if (!brand) return;
  if (!box){ box = document.createElement("div"); box.id = "cz-scene"; brand.prepend(box); }
  const v = vueCosmos();
  const niv = niveauAnim();
  document.documentElement.dataset.czAnim = niv;
  if (v !== _czVue || force){
    const k = "k" + (++_czK);
    const lay = document.createElement("div"); lay.className = "cz-lay"; lay.innerHTML = sceneCosmos(v, k);
    const anciens = [...box.querySelectorAll(".cz-lay")];
    box.appendChild(lay);
    const fondu = cfgCosmos().fondu && _czVue !== null && !force && niv !== "aucune";
    if (fondu){ lay.style.opacity = "0"; requestAnimationFrame(() => requestAnimationFrame(() => { lay.style.opacity = "1"; }));
      setTimeout(() => anciens.forEach(a => a.remove()), 61000); }
    else anciens.forEach(a => a.remove());
    _czVue = v;
  }
  _pauseScene([...box.querySelectorAll("svg")], niv === "aucune" || document.hidden);
  if (!_czTimer) _czTimer = setInterval(() => { try { majCosmos(); } catch(e){} }, 60000);
}
document.addEventListener("visibilitychange", () => {
  const box = document.getElementById("cz-scene"); if (!box) return;
  _pauseScene([...box.querySelectorAll("svg")], document.hidden || niveauAnim() === "aucune");
});

/* Frise : une étoile filante qui traverse */
function friseCosmos(){
  return `<svg viewBox="0 0 340 22" preserveAspectRatio="none" class="fr-svg"><line x1="0" y1="11" x2="340" y2="11" stroke="var(--border-strong)"/>
    <g class="cz-fil"><animateTransform attributeName="transform" type="translate" values="-70 0;400 0" dur="5s" repeatCount="indefinite"/>
      <line x1="0" y1="11" x2="50" y2="11" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" opacity=".9"/><circle cx="50" cy="11" r="2.6" fill="#fff"/></g></svg>`;
}

/* Réglages du thème (🎨 Personnaliser → Couleurs et thèmes) */
function persoCosmosHtml(){
  const concerne = S.theme === "cosmos" || (S.themeAuto && S.themeAuto.on && [S.themeAuto.jour, S.themeAuto.nuit].includes("cosmos"));
  if (!concerne) return "";
  const c = cfgCosmos();
  const seg = (attr, opts, cur) => `<div class="chips" style="margin-bottom:6px">${opts.map(([k,l]) => `<button class="chip ${cur===k?"on":""}" data-${attr}="${k}">${l}</button>`).join("")}</div>`;
  return `<div class="pz-lieu cz-reg"><div class="pz-lt"><b>🌌 Cosmos · NGC 3324</b><span>vue actuelle : ${esc(COSMOS_VUES[vueCosmos()].lbl)}</span></div>
    <div class="lab" style="margin-top:10px">La nuit, afficher le ciel</div>${seg("czn",[["nord","Nord"],["sud","Sud"],["alterner","Alterner"]], c.nuit)}
    <p class="small muted">Alterner : boréal en soirée, austral après minuit.</p>
    <div class="lab" style="margin-top:10px">Ordre et horaires des vues</div>
    ${c.creneaux.map((x,i) => `<div class="pz-row cz-row ${x.on===false?"off":""}">
      <span class="cz-th cz-${x.vue}"></span><span>${esc(COSMOS_VUES[x.vue].lbl)}<br><small class="muted">${esc(COSMOS_VUES[x.vue].sub)}</small></span>
      <input type="time" data-czh="${i}" value="${esc(x.h)}">
      <button aria-label="Monter" class="pz-b" data-czu="${i}" ${i?"":"disabled"}>▲</button><button aria-label="Descendre" class="pz-b" data-czd="${i}" ${i<c.creneaux.length-1?"":"disabled"}>▼</button>
      <input type="checkbox" data-czo="${i}" ${x.on===false?"":"checked"} title="Afficher cette vue">
      <button class="pz-b ${c.force===x.vue?"on":""}" data-czf="${x.vue}" title="Toujours cette vue">📌</button></div>`).join("")}
    <p class="small muted" style="margin-top:6px">Chaque vue dure jusqu'à l'heure de la suivante. ▲▼ fait changer une vue de créneau (les heures restent). Décoche pour retirer une vue ; 📌 la garde en permanence.</p>
    <div class="lab" style="margin-top:10px">Passage d'une vue à l'autre</div>${seg("czfo",[["1","Fondu lent (1 min)"],["0","Immédiat"]], c.fondu?"1":"0")}
    <div class="lab" style="margin-top:6px">Animations</div>${seg("cza",[["completes","Complètes"],["discretes","Discrètes"],["aucune","Aucune"]], c.anim)}
    <p class="small muted">Discrètes : scintillement et dérive, sans étoiles filantes. Toujours en pause quand l'app est en arrière-plan.</p></div>`;
}
function bindCosmos(maj){
  const c = cfgCosmos();
  const go = () => { save(); majCosmos(true); maj(); };
  $$("#sheet [data-czn]").forEach(b => b.onclick = () => { c.nuit = b.dataset.czn; go(); });
  $$("#sheet [data-czh]").forEach(b => b.onchange = () => { c.creneaux[+b.dataset.czh].h = b.value || c.creneaux[+b.dataset.czh].h; go(); });
  const echange = (i, j) => { const a = c.creneaux; [a[i].vue, a[j].vue] = [a[j].vue, a[i].vue]; [a[i].on, a[j].on] = [a[j].on, a[i].on]; };
  $$("#sheet [data-czu]").forEach(b => b.onclick = () => { const i = +b.dataset.czu; echange(i, i-1); go(); });
  $$("#sheet [data-czd]").forEach(b => b.onclick = () => { const i = +b.dataset.czd; echange(i, i+1); go(); });
  $$("#sheet [data-czo]").forEach(b => b.onchange = () => { c.creneaux[+b.dataset.czo].on = b.checked;
    if (!c.creneaux.some(x => x.on !== false)){ c.creneaux[+b.dataset.czo].on = true; toast("Garde au moins une vue"); } go(); });
  $$("#sheet [data-czf]").forEach(b => b.onclick = () => { c.force = c.force === b.dataset.czf ? null : b.dataset.czf; go(); });
  $$("#sheet [data-czfo]").forEach(b => b.onclick = () => { c.fondu = b.dataset.czfo === "1"; go(); });
  $$("#sheet [data-cza]").forEach(b => b.onclick = () => { c.anim = b.dataset.cza; go(); });
}


/* ============================================================
   RETOUR HAPTIQUE — v1.0.66
   Une courte vibration « succès » (deux impulsions) quand un passage
   est validé : on sait que c'est fait sans regarder l'écran.
   ⚠️ Le WebView Android ignore navigator.vibrate : on passe par le
   module natif @capacitor/haptics (qui déclare lui-même la permission
   VIBRATE). navigator.vibrate reste en repli pour la PWA sur Android.
   Rien sur Windows / ordinateur. Réglage : S.haptique (actif par défaut).
============================================================ */
function vibrer(type){
  if (S && S.haptique === false) return;
  try {
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H){
      if (type === "succes") return H.notification({ type:"SUCCESS" }).catch(() => {});
      return H.impact({ style:"MEDIUM" }).catch(() => {});
    }
    if (navigator.vibrate) navigator.vibrate(type === "succes" ? [35, 60, 35] : 30);
  } catch(e){}
}
function vibrationPossible(){
  return !!((window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics) || ("vibrate" in navigator && /Android/i.test(navigator.userAgent)));
}


/* ============================================================
   ÉTIQUETTES PERSONNALISÉES — v1.0.67
   S.tagsPerso[id] = { ic, lbl, col, genre:"pratique"|"soin",
                       carte, releve, route }   (id « u_xxxxxx »)
   Elles s'utilisent exactement comme les étiquettes fournies
   (PATIENT_TAGS) : même rangée dans la carte ouverte, même
   commentaire à l'appui long. Elles voyagent avec les dossiers
   (synchro, premier échange, sauvegarde) ; à la réception on AJOUTE
   celles qu'on n'a pas, sans jamais écraser les siennes.
   ⚠️ Une étiquette ne contient qu'un NOM : un code de portail va dans
   les Infos du patient, pas dans l'étiquette.
============================================================ */
const TAG_ICONES = ["🐕","🐈","🔑","🔢","🦻","👓","♿","🚪","🅿️","🧓","📞","🗣️","🌐","🧤","⚠️","⭐","🏠","🪜","🚭","💊","🩸","🦯","🛏️","🧺"];
const TAG_COULEURS = ["#e0a940","#ff8a3d","#e05540","#3fbf6f","#3dd6a8","#56b4e9","#5d8fd9","#9b6bd8","#e87fb0","#9e9e9e"];
function tagDef(k){
  if (typeof PATIENT_TAGS !== "undefined" && PATIENT_TAGS[k]) return PATIENT_TAGS[k];
  const T = (S && S.tagsPerso || {})[k];
  return T ? { kind:"etat", perso:true, ...T } : null;
}
function tousLesTags(){
  const r = { ...PATIENT_TAGS };
  const perso = Object.entries(S.tagsPerso || {})
    .sort((a,b) => ((a[1].genre==="soin")-(b[1].genre==="soin")) || a[1].lbl.localeCompare(b[1].lbl, "fr"));
  perso.forEach(([k,T]) => { r[k] = { kind:"etat", perso:true, ...T }; });
  return r;
}
function nbPatientsTag(id){ return (S.patients||[]).filter(p => (p.tags||[]).includes(id)).length; }
function fusionTagsPerso(recu){
  S.tagsPerso = S.tagsPerso || {};
  let n = 0;
  Object.entries(recu).forEach(([k,T]) => {
    if (!/^u_[a-z0-9]{4,}$/i.test(k) || !T || typeof T.lbl !== "string") return;
    if (!S.tagsPerso[k]){ S.tagsPerso[k] = { ic:String(T.ic||"🏷️").slice(0,4), lbl:T.lbl.slice(0,40), col:/^#[0-9a-f]{6}$/i.test(T.col||"") ? T.col : "#9e9e9e",
      genre:T.genre === "soin" ? "soin" : "pratique", carte:T.carte !== false, releve:T.releve !== false, route:!!T.route }; n++; }
  });
  if (n) save();
  return n;
}
function sheetEtiquette(id){
  const exist = id && (S.tagsPerso||{})[id];
  const T = exist ? { ...exist } : { ic:"🐕", lbl:"", col:"#ff8a3d", genre:"pratique", carte:true, releve:true, route:false };
  const draw = () => {
    openSheet(`${navHeader("Personnaliser", true)}<h3>🏷️ ${exist ? "Modifier l'étiquette" : "Nouvelle étiquette"}</h3>
      <div class="lab">Nom</div><input id="tg-lbl" maxlength="40" placeholder="ex. Chien méchant" value="${esc(T.lbl)}">
      <div class="lab" style="margin-top:10px">Icône</div>
      <div class="tg-ems">${TAG_ICONES.map(e => `<button class="${T.ic===e?"on":""}" data-tgi="${e}">${e}</button>`).join("")}</div>
      <div class="lab" style="margin-top:10px">Couleur</div>
      <div class="stc-pal" style="grid-template-columns:repeat(10,minmax(0,1fr))">${TAG_COULEURS.map(c => `<button class="stc-t ${T.col===c?"on":""}" data-tgc="${c}" style="background:${c}"></button>`).join("")}</div>
      <div class="lab" style="margin-top:10px">Genre</div>
      <div class="chips"><button class="chip ${T.genre!=="soin"?"on":""}" data-tgg="pratique">🧭 Info pratique</button><button class="chip ${T.genre==="soin"?"on":""}" data-tgg="soin">🩺 Info de soin</button></div>
      <div class="lab" style="margin-top:10px">Où l'afficher</div>
      <label class="pz-row pz-tg"><span>Sur la carte repliée</span><input type="checkbox" id="tg-carte" ${T.carte!==false?"checked":""}></label>
      <label class="pz-row pz-tg"><span>Dans la relève</span><input type="checkbox" id="tg-rel" ${T.releve!==false?"checked":""}></label>
      <label class="pz-row pz-tg"><span>Dans la feuille de route imprimée</span><input type="checkbox" id="tg-route" ${T.route?"checked":""}></label>
      <p class="small muted" style="margin-top:6px">Aperçu : <span class="mini tagp" style="--tc:${esc(T.col)}">${T.ic} ${esc(T.lbl || "Mon étiquette")}</span></p>
      <p class="small muted">Une étiquette ne contient qu'un nom. Un code de portail ou de boîte à clé se note dans les <b>Infos</b> du patient.</p>
      <button class="btn btn-primary" id="tg-ok" style="width:100%;margin-top:12px">✓ ${exist ? "Enregistrer" : "Créer l'étiquette"}</button>
      ${exist ? `<button class="btn btn-ghost" id="tg-del" style="width:100%;margin-top:8px;color:var(--danger)">🗑 Supprimer (${nbPatientsTag(id)} patient${nbPatientsTag(id)>1?"s":""})</button>` : ""}
      <button class="btn btn-ghost" id="tg-back" style="width:100%;margin-top:8px">← Retour</button>`);
    bindNav(() => sheetPersoZone("cartes"));
    const lire = () => { T.lbl = $("#tg-lbl").value.trim(); T.carte = $("#tg-carte").checked; T.releve = $("#tg-rel").checked; T.route = $("#tg-route").checked; };
    $$("#sheet [data-tgi]").forEach(b => b.onclick = () => { lire(); T.ic = b.dataset.tgi; draw(); });
    $$("#sheet [data-tgc]").forEach(b => b.onclick = () => { lire(); T.col = b.dataset.tgc; draw(); });
    $$("#sheet [data-tgg]").forEach(b => b.onclick = () => { lire(); T.genre = b.dataset.tgg; draw(); });
    $("#tg-lbl").oninput = () => { T.lbl = $("#tg-lbl").value; };
    $("#tg-back").onclick = () => sheetPersoZone("cartes");
    $("#tg-ok").onclick = () => {
      lire();
      if (!T.lbl){ toast("Donne un nom à l'étiquette", "danger"); return; }
      const doublon = Object.entries(tousLesTags()).find(([k,x]) => k !== id && x.lbl.toLowerCase() === T.lbl.toLowerCase());
      if (doublon){ toast("Une étiquette porte déjà ce nom", "danger"); return; }
      S.tagsPerso = S.tagsPerso || {};
      const cle = id || ("u_" + uid().replace(/[^a-z0-9]/gi,"").slice(0,8).toLowerCase());
      S.tagsPerso[cle] = T; save(); render();
      toast(exist ? "Étiquette modifiée" : "Étiquette créée — pose-la sur un patient depuis sa carte ouverte");
      sheetPersoZone("cartes");
    };
    { const d = $("#tg-del"); if (d) d.onclick = async () => {
      const n = nbPatientsTag(id);
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer « " + exist.lbl + " » ?",
          sub: n ? `Elle sera retirée de ${n} patient${n>1?"s":""}, avec son éventuel commentaire.` : "Aucun patient ne la porte.", oui:"Supprimer" })) return;
      (S.patients||[]).forEach(p => { if ((p.tags||[]).includes(id)){ p.tags = p.tags.filter(t => t !== id); if (p.tagMeta) delete p.tagMeta[id]; } });
      delete S.tagsPerso[id]; save(true); render(); toast("Étiquette supprimée"); sheetPersoZone("cartes");
    }; }
  };
  draw();
}

/* ============================================================
   HABILLER LES MENUS DÉROULANTS
   ─────────────────────────────────────────────────────────
   ⚠️ Un <select> est dessiné par ANDROID, pas par l'app : fond gris,
   pastilles rondes, typographie du système. Au milieu d'un thème
   Cosmos ou Hôpital de nuit, la rupture saute aux yeux — alors que
   l'annuaire du cabinet, qui passe par askChoice, est impeccable.

   Plutôt que de réécrire dix écrans, on remplace l'apparence en
   gardant le <select> CACHÉ derrière : tout le code existant continue
   de lire `.value` et d'écouter `change`, rien à toucher ailleurs.
============================================================ */
function _selLibelle(sel){
  const o = sel.options[sel.selectedIndex];
  return o ? o.textContent.trim() : "";
}
function habillerSelect(sel){
  if (!sel || sel.dataset.habille === "1" || sel.multiple) return;
  sel.dataset.habille = "1";
  const b = document.createElement("button");
  b.type = "button";
  b.className = "selfake " + (sel.className || "");
  /* ⚠️ Le style EN LIGNE du menu doit passer au bouton : sans lui, un
     `flex:0 0 110px` restait sur l'élément caché et le bouton prenait
     toute la largeur — le champ voisin était réduit à un timbre-poste. */
  { const st = sel.getAttribute("style");
    if (st) b.setAttribute("style", st); }
  b.innerHTML = `<span class="selfake-v"></span><span class="selfake-fl">▾</span>`;
  const maj = () => {
    b.querySelector(".selfake-v").textContent = _selLibelle(sel) || "—";
    b.disabled = sel.disabled;
  };
  maj();
  sel.after(b);
  sel.classList.add("sel-cache");
  /* ⚠️ On n'enlève PAS le select du document : le reste du code lit sa
     valeur, et une suppression casserait tout silencieusement. */
  b.onclick = async () => {
    const opts = [...sel.options].map((o, i) => ({ lbl:o.textContent.trim(), val:String(i) }));
    if (!opts.length) return;
    const choix = await askChoice({
      ic: sel.dataset.ic || "",
      titre: sel.dataset.titre || sel.getAttribute("aria-label") || "Choisir",
      options: opts
    });
    if (choix === null || choix === undefined) return;
    sel.selectedIndex = +choix;
    maj();
    sel.dispatchEvent(new Event("change", { bubbles:true }));
  };
  /* Si le code change la valeur lui-même, le bouton doit suivre */
  sel.addEventListener("change", maj);
}
function habillerSelects(racine){
  (racine || document).querySelectorAll("select:not([data-habille])").forEach(habillerSelect);
}
/* Les écrans se redessinent sans arrêt : on surveille plutôt que
   d'appeler cette fonction depuis chaque rendu. */
(function(){
  const lancer = () => {
    habillerSelects(document);
    const obs = new MutationObserver(ms => {
      for (const m of ms){
        for (const n of m.addedNodes){
          if (n.nodeType !== 1) continue;
          if (n.tagName === "SELECT") habillerSelect(n);
          else habillerSelects(n);
        }
      }
    });
    obs.observe(document.body, { childList:true, subtree:true });
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer);
  else lancer();
})();

/* ============================================================
   CE QU'AFFICHE LA CARTE D'UN PATIENT
   ─────────────────────────────────────────────────────────
   Le réglage vit dans Personnaliser et vaut pour tout le monde.
   Certains dossiers méritent pourtant une exception — un patient dont
   on veut voir le dernier passage, un autre dont les étiquettes
   encombrent. On règle ici, depuis sa fiche.

   ⚠️ UN SEUL INTERRUPTEUR DÉCIDE : « suivre le réglage général ». Tant
   qu'il est allumé, le dossier n'a pas de réglage propre du tout
   (`p.carteMasque` absent). Sans ce choix explicite, une modification
   générale resterait sans effet sur certaines cartes et on ne saurait
   jamais pourquoi.

   ⚠️ LES SIGNAUX DE VIGILANCE NE SE MASQUENT PAS : valeur hors seuil,
   jours sans selle, patient prioritaire, absence. Un réglage
   d'affichage ne doit jamais pouvoir cacher une alerte — c'est déjà la
   règle du réglage général, elle vaut ici aussi.
============================================================ */
function sheetCartePatient(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable", "danger"); return; }
  const propre = Array.isArray(p.carteMasque);

  const draw = () => {
    openSheet(`
      ${navHeader("Fiche", true)}
      <h3>🪪 Ce qu'affiche sa carte</h3>
      <p class="small muted" style="margin-bottom:12px">Pour ${esc(p.prenom || "")} ${esc((p.nom || "").replace("Demo-","").toUpperCase())} uniquement.</p>

      <label class="screl" style="margin:0 0 10px">
        <input type="checkbox" id="cp-gen" ${Array.isArray(p.carteMasque) ? "" : "checked"}>
        <span>Suivre le <b>réglage général</b>
          <br><span class="small muted">${Array.isArray(p.carteMasque)
            ? "décoché : ce dossier a son propre réglage"
            : "comme tous les autres dossiers"}</span></span>
      </label>

      <div class="${Array.isArray(p.carteMasque) ? "" : "cp-off"}">
        <div class="lab">Affiché sur sa carte repliée</div>
        ${CARTE_OPTS.map(([k, l]) => `
          <label class="pz-row pz-tg"><span>${l}</span>
            <input type="checkbox" data-cpk="${esc(k)}"
              ${carteMontre(k, Array.isArray(p.carteMasque) ? p : null) ? "checked" : ""}
              ${Array.isArray(p.carteMasque) ? "" : "disabled"}></label>`).join("")}
      </div>

      <div class="tip" style="margin-top:12px">Les <b>signaux de vigilance</b> restent affichés dans tous les cas : valeur hors seuil, jours sans selle, patient prioritaire, absence.</div>
      ${cartesAPart() ? `<p class="small muted" style="margin-top:10px">${cartesAPart()} dossier${cartesAPart()>1?"s ont":" a"} un réglage propre. Tu peux tout remettre en commun depuis <b>🎨 Personnaliser → 🪪 Cartes patient</b>.</p>` : ""}`);
    bindNav(() => sheetPatient(p, "act"));

    { const g = $("#cp-gen");
      if (g) g.onchange = () => {
        if (g.checked) delete p.carteMasque;
        /* On part du réglage général : l'exception commence là où il
           s'arrête, sinon on repartirait de zéro sans le vouloir. */
        else p.carteMasque = [...(S.carteMasque || [])];
        save(true); draw();
      }; }
    $$("#sheet [data-cpk]").forEach(c => c.onchange = () => {
      if (!Array.isArray(p.carteMasque)) return;
      const k = c.dataset.cpk;
      const set = new Set(p.carteMasque);
      c.checked ? set.delete(k) : set.add(k);
      p.carteMasque = [...set];
      save(true); render();
    });
  };
  draw();
}
