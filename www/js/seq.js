/* ============================================================
   SEQ.JS — Mode tournée séquentielle + Signature + Notifications
============================================================ */

/* ============ MODE TOURNÉE SÉQUENTIELLE ============ */
let seqActive = false, seqIdx = 0, seqPool = [];

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
  seqIdx  = 0;
  seqActive = true;
  document.querySelector("[data-a='seq']").textContent = "⏹";
  document.querySelector("[data-a='seq']").title = "Quitter le mode tournée";
  document.getElementById("board").style.display = "none";
  document.getElementById("synth").style.display = "none";
  document.getElementById("filters").style.display = "none";
  document.querySelector(".footer-note").style.display = "none";
  renderSeq();
}

function exitSeqMode(){
  seqActive = false;
  document.querySelector("[data-a='seq']").textContent = "▶";
  document.querySelector("[data-a='seq']").title = "Mode tournée séquentiel";
  document.getElementById("board").style.display = "";
  document.getElementById("synth").style.display = "";
  document.getElementById("filters").style.display = "";
  document.querySelector(".footer-note").style.display = "";
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
    <button class="btn btn-ghost" id="sq-skip" style="width:100%;margin-bottom:10px;font-size:13.5px">
      🚫 Pas de passage prévu aujourd'hui — patient suivant
    </button>
    ${p.ctx?`<div class="small" style="background:var(--amber-soft);border-left:3px solid var(--amber);border-radius:0 10px 10px 0;padding:8px 12px;margin-bottom:10px">⚠ ${esc(p.ctx)}</div>`:""}
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
    if (saved){ save(); toast("Passage de " + p.prenom + " enregistré ✓"); }
    cb();
  };
  // « Pas de passage prévu » : on avance sans rien enregistrer → rien dans la relève
  const skipBtn = document.getElementById("sq-skip");
  if (skipBtn) skipBtn.onclick = () => {
    _formDraft = null; _soinNotes = {};   // on jette la saisie éventuelle
    // Trace du jour : le patient n'est ni « à voir » ni « vu ».
    // Aucun passage créé → rien dans la relève.
    S.noVisit = S.noVisit || {};
    S.noVisit[p.id] = todayISO();
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
      else { toast("Fin de la tournée — passages enregistrés ✓"); exitSeqMode(); }
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
