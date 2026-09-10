/* ============================================================
   SEQ.JS — Mode tournée séquentielle + Signature + Notifications
============================================================ */

/* ============ MODE TOURNÉE SÉQUENTIELLE ============ */
let seqActive = false, seqIdx = 0, seqPool = [], seqSlot = null;

function toggleSeqMode(){
  if (seqActive) exitSeqMode();
  else enterSeqMode();
}

function enterSeqMode(){
  const slot = activeSlot();
  let pool = S.curTour === "all"
    ? activeP()
    : activeP().filter(p => inTourSlot(p, S.curTour, slot));
  if (!pool.length){ toast("Aucun patient dans ce créneau de la tournée."); return; }
  pool = sortBySlot(pool, S.curTour, slot);
  seqPool = pool;
  seqSlot = slot;
  /* Reprendre où l'on en est : premier patient non encore vu sur la date
     de travail. Calculé, pas mémorisé — un patient validé depuis sa carte
     ne doit pas être reproposé. */
  const wd = (typeof workDate === "function") ? workDate() : todayISO();
  const vu = p => (p.visits||[]).some(v => v.date === wd &&
                  (!S.slotsEnabled || slot === "jour" || (v.slot||defaultSlot()) === slot));
  const reste = pool.findIndex(p => !vu(p));
  if (reste === -1){ seqEndScreen(pool, slot); return; }   // tout est déjà vu
  seqIdx = reste;
  seqActive = true;
  majBoutonSeq(true);
  document.getElementById("board").style.display = "none";
  document.getElementById("synth").style.display = "none";
  document.getElementById("filters").style.display = "none";
  document.querySelector(".footer-note").style.display = "none";
  /* La signature est un bloc SÉPARÉ de .footer-note : sans ça elle restait
     visible au milieu de l'écran, et le déroulé s'affichait dessous. */
  { const sg = document.querySelector(".signature"); if (sg) sg.style.display = "none"; }
  renderSeq();
}

/* Le bouton change d'état sans perdre sa structure.
   ⚠️ Avant : textContent = "⏹" écrasait TOUT le bouton — l'icône SVG
   et le libellé « Déroulé » disparaissaient, remplacés par un carré
   d'emoji. Le libellé ne revenait jamais. */
function majBoutonSeq(actif){
  const b = document.querySelector("[data-a='seq']");
  if (!b) return;
  const ic  = b.querySelector("svg, .tb-ic");
  const lbl = b.querySelector("span:last-child");
  if (ic){
    ic.outerHTML = actif
      ? `<svg viewBox="0 0 24 24" class="tb-svg" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>`
      : `<svg viewBox="0 0 24 24" class="tb-svg" aria-hidden="true"><path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/></svg>`;
  }
  if (lbl) lbl.textContent = actif ? "Quitter" : "Déroulé";
  b.title = actif ? "Quitter le mode tournée" : "Mode tournée séquentiel";
  b.classList.toggle("primary", !!actif);
}

function exitSeqMode(){
  seqActive = false;
  majBoutonSeq(false);
  document.getElementById("board").style.display = "";
  document.getElementById("synth").style.display = "";
  document.getElementById("filters").style.display = "";
  document.querySelector(".footer-note").style.display = "";
  { const sg = document.querySelector(".signature"); if (sg) sg.style.display = ""; }
  const sm = document.getElementById("seq-mode");
  sm.innerHTML = ""; sm.className = "";
  openId = null;
  render();
}

function renderSeq(){
  const p    = seqPool[seqIdx];
  const sm   = document.getElementById("seq-mode");
  sm.className = "on";
  const total = seqPool.length;
  const raps  = (S.rappels||[]).filter(r=>!r.done&&r.pid===p.id).length;

  sm.innerHTML = `
    <div class="seq-nav">
      <button class="sq-btn" id="sq-prev">←</button>
      <div class="sq-ctr">${seqIdx+1} / ${total} — ${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}</div>
      <button class="sq-btn" id="sq-next">${seqIdx===total-1?"✓":"→"}</button>
      <button class="sq-quit" id="sq-quit">✕ Quitter</button>
    </div>
    ${(() => {
      const t = (typeof annivTexte === "function") ? annivTexte(p) : "";
      return t ? `<div class="sq-anniv">🎂 ${esc(t)}</div>` : "";
    })()}
    <button class="btn btn-ghost" id="sq-skip" style="width:100%;margin-bottom:10px;font-size:13.5px">
      🚫 Pas de passage prévu aujourd'hui — patient suivant
    </button>
    ${shownInfos(p).map(it => { const T=infoType(it.type);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:8px 12px;margin-bottom:8px">${T.ic} ${esc(it.txt)}</div>`;
    }).join("")}
    <div id="seq-form"></div>`;

  // Formulaire inline
  const fwrap = document.getElementById("seq-form");
  openId = p.id;
  _curSlot = null; // recalculé selon l'heure pour ce patient
  fwrap.innerHTML = inlineForm(p);
  bindInline(p);
  const seqForm = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;

  // Valide le passage courant (soins cochés, constantes, note, créneau) puis exécute cb
  const commitThen = cb => {
    const form = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;
    const saved = form && form._commitVisit ? form._commitVisit(true) : false;
    if (saved){ save(true); toast("Passage de " + p.prenom + " enregistré ✓"); }
    cb();
  };
  // « Pas de passage prévu » : on avance sans rien enregistrer → rien dans la relève
  const skipBtn = document.getElementById("sq-skip");
  if (skipBtn) skipBtn.onclick = () => {
    _formDraft = null; _soinNotes = {};   // on jette la saisie éventuelle
    // Trace du jour : le patient n'est ni « à voir » ni « vu ».
    // Aucun passage créé → rien dans la relève.
    S.noVisit = S.noVisit || {};
    S.noVisit[p.id] = workDate();
    save();
    toast("Pas de passage prévu pour " + p.prenom + " — non inclus dans la relève");
    if (seqIdx < total - 1){ seqIdx++; renderSeq(); }
    else { toast("Fin de la tournée ✓"); exitSeqMode(); }
  };
  document.getElementById("sq-prev").onclick = () => {
    commitThen(() => { if (seqIdx > 0){ seqIdx--; renderSeq(); } });
  };
  document.getElementById("sq-quit").onclick = () => commitThen(exitSeqMode);
  document.getElementById("sq-next").onclick = () => {
    commitThen(() => {
      if (seqIdx < total - 1){ seqIdx++; renderSeq(); }
      else { const pl = seqPool, sl = seqSlot; exitSeqMode(); seqEndScreen(pl, sl); }
    });
  };
}

/* ============ TAMPON DE SIGNATURE ============ */
let sigResolve = null;

function openSignature(callback){
  const ov = document.getElementById("sig-overlay");
  const cv = document.getElementById("sig-canvas");
  const ctx = cv.getContext("2d");
  if (!ctx){ toast("Canvas non disponible dans cet environnement."); return; }
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = "#1a1a2e";
  ctx.lineWidth = 2.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let drawing = false, lastX = 0, lastY = 0;

  const getPos = e => {
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width;
    const scaleY = cv.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  };
  const start = e => { e.preventDefault(); drawing = true; const pos = getPos(e); lastX = pos.x; lastY = pos.y; ctx.beginPath(); ctx.moveTo(lastX, lastY); };
  const move  = e => { if (!drawing) return; e.preventDefault(); const pos = getPos(e); ctx.lineTo(pos.x, pos.y); ctx.stroke(); lastX = pos.x; lastY = pos.y; };
  const stop  = e => { drawing = false; };

  cv.addEventListener("mousedown", start); cv.addEventListener("mousemove", move); cv.addEventListener("mouseup", stop);
  cv.addEventListener("touchstart", start); cv.addEventListener("touchmove", move); cv.addEventListener("touchend", stop);

  ov.className = "on";
  document.getElementById("sig-clear").onclick = () => { ctx.clearRect(0,0,cv.width,cv.height); ctx.fillStyle="#fff"; ctx.fillRect(0,0,cv.width,cv.height); };
  document.getElementById("sig-cancel").onclick = () => {
    ov.className = "";
    cv.removeEventListener("mousedown",start); cv.removeEventListener("mousemove",move); cv.removeEventListener("mouseup",stop);
    cv.removeEventListener("touchstart",start); cv.removeEventListener("touchmove",move); cv.removeEventListener("touchend",stop);
    callback(null);
  };
  document.getElementById("sig-ok").onclick = () => {
    const sig = cv.toDataURL("image/png");
    ov.className = "";
    cv.removeEventListener("mousedown",start); cv.removeEventListener("mousemove",move); cv.removeEventListener("mouseup",stop);
    cv.removeEventListener("touchstart",start); cv.removeEventListener("touchmove",move); cv.removeEventListener("touchend",stop);
    callback(sig);
  };
}

/* ============ NOTIFICATIONS LOCALES ANDROID (Capacitor) ============ */
async function scheduleRappelNotifications(){
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  try {
    const { LocalNotifications } = cap.Plugins;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return;

    // Annuler les anciennes notifications JMSanté
    await LocalNotifications.cancel({ notifications: (await LocalNotifications.getPending()).notifications });

    const today = todayISO();
    const notifs = [];
    (S.rappels||[]).filter(r=>!r.done && r.due && r.due >= today).forEach(r => {
      const dj = daysUntil(r.due);
      const rp = r.pid ? getP(r.pid) : null;
      const who = rp ? rp.nom.replace("Demo-","").toUpperCase()+" "+rp.prenom : "Tournée";
      // J-3, J-1, Jour J
      [3, 1, 0].forEach(j => {
        if (dj < j) return;
        const fireDate = new Date(r.due + "T08:00:00");
        if (j > 0) fireDate.setDate(fireDate.getDate() - j);
        if (fireDate <= new Date()) return;
        notifs.push({
          id: Math.abs((r.id + j).split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % 999999 + 1,
          title: j === 0 ? "📅 Aujourd'hui : " + rapType(r.type).lbl : "📅 J-" + j + " : " + rapType(r.type).lbl,
          body: who + " — " + r.text.slice(0, 80),
          schedule: { at: fireDate },
          sound: null,
          attachments: null,
          actionTypeId: "",
          extra: null
        });
      });
    });

    if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
  } catch(e){ console.warn("Notifications: ", e); }
}

/* Initialiser les notifications au démarrage de l'app */
async function initNotifications(){
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  try {
    const { LocalNotifications } = cap.Plugins;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display === "granted"){
      await scheduleRappelNotifications();
    }
  } catch(e){ console.warn("initNotifications:", e); }
}

/* Appeler après chaque sauvegarde de rappels */
const _origSave = (typeof save !== "undefined") ? save : null;
if (_origSave){
  const _hookedSave = function(){
    _origSave.apply(this, arguments);
    scheduleRappelNotifications();
  };
}

/* ============================================================
   ÉCRAN DE FIN DE TOURNÉE
   ─────────────────────────────────────────────────────────
   Affiché à la fin du déroulé, et aussi quand on lance ▶ alors
   que tous les patients ont déjà été vus. Les passages restent
   modifiables : un tap sur ✏️ rouvre la carte du patient.
============================================================ */
function seqEndScreen(pool, slot, felicit){
  const wd = (typeof workDate === "function") ? workDate() : todayISO();
  const estDuJour = v => v.date === wd &&
        (!S.slotsEnabled || slot === "jour" || !slot || (v.slot||defaultSlot()) === slot);

  const lignes = [];
  (pool||[]).forEach(p => {
    (p.visits||[]).filter(estDuJour).forEach(v => lignes.push({ p, v }));
  });
  lignes.sort((a,b) => (a.v.at||"").localeCompare(b.v.at||""));

  const heures = lignes.map(x => x.v.at).filter(Boolean).sort();
  const alertes_ = lignes.filter(x => alertes(x.v.consts, x.p.thresholds).length);
  const L = slot && SLOT_LBL[slot] ? SLOT_LBL[slot] : null;

  openSheet(`
    <div class="sqe-hero">
      ${CIG_FILI_SVG}
      <div style="position:relative">
      <div style="font-size:30px;line-height:1.1">🏁</div>
      <h3 style="margin:3px 0 2px">Tournée terminée</h3>
      ${felicit ? `<p class="sqe-msg">${esc(END_GREETINGS[Math.floor(Math.random()*END_GREETINGS.length)])}</p>` : ""}
      <p class="small muted" style="margin:0">${S.curTour==="all"?"Toutes les tournées":esc(S.curTour)}${
        L?` · ${L.ic} ${esc(L.lbl.toLowerCase())}`:""} · ${lignes.length} passage${lignes.length>1?"s":""}</p>
      </div>
    </div>

    <div class="tip" style="margin-bottom:14px">
      <b>${lignes.length} patient${lignes.length>1?"s vus":" vu"}</b>${
        heures.length>1?` · de ${esc(heures[0])} à ${esc(heures[heures.length-1])}`:
        heures.length===1?` · à ${esc(heures[0])}`:""}
      ${alertes_.length?`<br><span style="color:var(--amber)">⚠ ${alertes_.length} constante${alertes_.length>1?"s":""} hors seuils</span> — ${
        alertes_.map(x=>esc(x.p.nom.replace("Demo-","").toUpperCase())).join(", ")}`:""}
    </div>

    ${lignes.length ? `<div class="lab" style="margin-bottom:7px">Revoir un passage</div>
    <div class="sqend">
      ${lignes.map(({p,v}) => {
        const al = alertes(v.consts, p.thresholds);
        const cp = constParts(v.consts);
        return `<button class="sqe-r ${al.length?"warn":""}" data-sqe="${esc(p.id)}">
          <span class="sqe-h">${esc(v.at||"")}</span>
          <span class="sqe-n">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${
            al.length&&cp.length?` <span class="sqe-al">${esc(cp[0])}</span>`:""}</span>
          <span class="sqe-s">${(v.soins||[]).length} soin${(v.soins||[]).length>1?"s":""}</span>
          <span class="sqe-e">✏️</span>
        </button>`;
      }).join("")}
    </div>` : uiEmpty("🚶","Aucun passage enregistré","Sur ce créneau, aucun patient n'a encore été vu.")}

    <button class="btn btn-primary" id="sqe-home" style="width:100%;margin-top:14px">↩︎ Retour au Moniteur</button>`);

  $$("#sheet [data-sqe]").forEach(b => b.onclick = () => {
    const pid = b.dataset.sqe;
    closeSheet(); openId = pid; render();
    setTimeout(() => {
      const el = document.querySelector(`.pcard[data-id="${pid}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"start" });
    }, 120);
  });
  $("#sqe-home").onclick = () => { closeSheet(); render(); };
}
