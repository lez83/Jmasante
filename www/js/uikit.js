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
    if (!d) return `<div class="vtile none"><div class="vt-h">${lbl}</div><div class="vt-v">—</div><div class="vt-d">non mesurée</div></div>`;
    const s = sensConst(k, d.val, p.thresholds);
    const m = dateMesure(d);
    const bd = s === "hi" ? `<span class="vt-b hi">↑ HAUT</span>` : s === "lo" ? `<span class="vt-b lo">↓ BAS</span>` : `<span class="vt-b ok">DANS LES SEUILS</span>`;
    return `<div class="vtile ${s}"><div class="vt-h">${lbl}${bd}</div>
      <div class="vt-v">${esc(String(d.val))}<span class="vt-u">${u}</span></div>
      <div class="vt-d ${m.vieux?"old":""}">${esc(m.txt)}</div></div>`;
  }).join("")}</div>`;
}

/* ---------- Légende des couleurs du Moniteur ----------
   Affichée par défaut ; « Ne plus afficher » la replie en un simple ⓘ
   qui la rouvre d'un toucher. Elle suit le style de carte choisi. */
let _legOuverte = false;
function legendeHtml(){
  const bande = S.cardStyle === "bande";
  const sw = (cls) => `<i class="lg-sw ${bande?"bar":"dot"} ${cls}"></i>`;
  const items = `${sw("todo")}À voir <span class="lg-sep"></span>${sw("done")}Vu <span class="lg-sep"></span>${sw("alert")}Vigilance <span class="lg-sep"></span>${sw("absent")}Absent <span class="lg-sep"></span>${sw("novisit")}Sans passage`;
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
