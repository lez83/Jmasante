/* ============================================================
   PWA — Installation sur l'écran d'accueil & protection des données
   ─────────────────────────────────────────────────────────
   ⚠️ POINT CRITIQUE iOS : tant que l'app N'EST PAS installée sur
   l'écran d'accueil, iOS peut effacer son stockage après ~7 jours
   d'inactivité. Une fois installée, le stockage devient persistant.
   → On avertit l'utilisateur de façon insistante et répétée.
============================================================ */

/* ---------- Détection de l'environnement ---------- */
function isIOS(){
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad récent
}
function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;   // iOS
}
function isNativeApp(){
  const cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
}
/* Contexte à risque : iPhone/iPad, dans Safari, PAS installé */
function isIOSAtRisk(){
  return isIOS() && !isStandalone() && !isNativeApp();
}

/* ---------- Enregistrement du service worker (hors ligne) ---------- */
function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  if (isNativeApp()) return;               // inutile dans l'APK
  if (location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js")
    .then(reg => {
      // Nouvelle version disponible → l'activer au prochain lancement
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller){
            toast("Nouvelle version disponible — relance l'app pour l'appliquer");
          }
        });
      });
    })
    .catch(e => console.warn("SW:", e));
}

/* ---------- Demander un stockage persistant (navigateurs qui le supportent) ---------- */
async function requestPersistentStorage(){
  try {
    if (navigator.storage && navigator.storage.persist){
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch(e){}
}

/* ---------- Écran d'installation iOS (illustré, pas à pas) ---------- */
function sheetInstallIOS(fromBanner){
  openSheet(`
    <h3>📲 Installe JM@Santé sur ton iPhone</h3>
    <div class="warn-box" style="background:var(--amber-soft);border-left:4px solid var(--amber);border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:14px">
      <b style="color:var(--amber)">⚠️ Important pour ne pas perdre tes données</b>
      <p class="small" style="margin:6px 0 0;line-height:1.5">
        Tant que l'app n'est pas installée sur ton écran d'accueil, <b>iOS peut effacer
        toutes tes données</b> après quelques jours sans ouvrir l'app.
        Une fois installée, tes données sont <b>conservées durablement</b>.
      </p>
    </div>
    <div class="small" style="line-height:1.9;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
        <span style="background:var(--accent);color:var(--accent-ink);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">1</span>
        <span>En bas de Safari, tape le bouton <b>Partager</b> <span style="font-size:18px">􀈂</span> (le carré avec une flèche vers le haut)</span>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
        <span style="background:var(--accent);color:var(--accent-ink);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">2</span>
        <span>Fais défiler et choisis <b>« Sur l'écran d'accueil »</b> <span style="font-size:16px">➕</span></span>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-start">
        <span style="background:var(--accent);color:var(--accent-ink);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">3</span>
        <span>Tape <b>Ajouter</b> — l'icône JM@Santé apparaît sur ton écran d'accueil</span>
      </div>
    </div>
    <p class="small muted" style="margin-bottom:12px">Ouvre ensuite l'app <b>par cette icône</b> (plus par Safari) : elle s'affiche en plein écran et tes données sont protégées.</p>
    <button class="btn btn-primary" id="ins-ok" style="width:100%">J'ai compris</button>
    ${fromBanner ? `<button class="btn btn-ghost" id="ins-later" style="width:100%;margin-top:8px">Plus tard (me le rappeler)</button>` : ""}`);
  $("#ins-ok").onclick = () => {
    S.iosInstallSeen = (S.iosInstallSeen||0) + 1;
    S.iosInstallLast = Date.now();
    try { save(); } catch(e){}
    closeSheet();
  };
  const later = $("#ins-later");
  if (later) later.onclick = () => { S.iosInstallLast = Date.now(); try{save();}catch(e){} closeSheet(); };
}

/* ---------- Bannière permanente (iOS non installé) ---------- */
function renderIOSBanner(){
  const existing = document.getElementById("ios-banner");
  if (!isIOSAtRisk()){ if (existing) existing.remove(); return; }
  if (existing) return;               // déjà affichée
  const el = document.createElement("div");
  el.id = "ios-banner";
  el.className = "ios-banner";
  el.innerHTML = `
    <span class="iosb-txt">⚠️ <b>Données non protégées</b> — installe l'app sur ton écran d'accueil</span>
    <button class="iosb-btn" id="iosb-how">Comment ?</button>`;
  document.body.appendChild(el);
  document.getElementById("iosb-how").onclick = () => sheetInstallIOS(true);
}

/* ---------- Rappels répétés tant que l'app n'est pas installée ---------- */
function iosNagIfNeeded(){
  if (!isIOSAtRisk()) return;
  const last = S.iosInstallLast || 0;
  const seen = S.iosInstallSeen || 0;
  const hours = (Date.now() - last) / 36e5;
  // 1er lancement : tout de suite. Ensuite : toutes les 24 h tant que non installé.
  if (seen === 0 || hours > 24){
    setTimeout(() => sheetInstallIOS(true), 1200);
  }
}

/* ---------- Rappel de sauvegarde renforcé sur iOS ---------- */
function iosBackupWarning(){
  if (!isIOSAtRisk()) return;
  const days = S.lastBackup ? Math.floor((Date.now()-S.lastBackup)/864e5) : 999;
  if (days >= 3){
    setTimeout(() => {
      toast(days === 999
        ? "⚠️ Aucune sauvegarde — exporte tes données depuis 🗺️ Réglages"
        : "⚠️ Dernière sauvegarde il y a "+days+" jours — pense à exporter", "danger");
    }, 3000);
  }
}

/* ---------- Installation native (Android / Chrome / Edge) ----------
   Chrome émet beforeinstallprompt : on capte l'événement pour proposer
   un vrai bouton « Installer » au bon moment. */
let _installPrompt = null;
function initInstallPrompt(){
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();          // on choisit nous-mêmes le moment
    _installPrompt = e;
    renderInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    _installPrompt = null;
    S.pwaInstalled = true; try { save(); } catch(e){}
    const b = document.getElementById("install-btn"); if (b) b.remove();
    toast("JM@Santé installé ✓ — ouvre-le désormais par son icône");
  });
}
function renderInstallButton(){
  if (!_installPrompt || isStandalone() || isNativeApp()) return;
  if (document.getElementById("install-btn")) return;
  const b = document.createElement("button");
  b.id = "install-btn";
  b.className = "install-btn";
  b.innerHTML = "📲 Installer l'application";
  b.onclick = async () => {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === "accepted") b.remove();
    _installPrompt = null;
  };
  document.body.appendChild(b);
}

/* ---------- Initialisation ---------- */
function initPWA(){
  initInstallPrompt();
  registerSW();
  requestPersistentStorage();
  renderIOSBanner();
  iosNagIfNeeded();
  iosBackupWarning();
}
