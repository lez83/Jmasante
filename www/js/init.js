$("#backupfile").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const txt = ev.target.result;
    try { if (JSON.parse(txt)._jmsync){ receiveSyncFile(txt); return; } } catch(e){}
    importBackupText(txt);
  };
  rd.onerror = () => toast("Lecture du fichier impossible.");
  rd.readAsText(f);
});
$("#syncfile").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const txt = ev.target.result;
    try {
      const j = JSON.parse(txt);
      if (j._jmsync){ receiveSyncFile(txt); return; }
      if (Array.isArray(j.patients)){ importBackupText(txt); return; }
    } catch(e){}
    receiveSyncFile(txt);
  };
  rd.onerror = () => toast("Lecture du fichier impossible.");
  rd.readAsText(f);
});

/* ---------- Masquer le splash au plus tôt (avant même le chargement des données) ---------- */
function hideSplashNow(){
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.SplashScreen) cap.Plugins.SplashScreen.hide();
  } catch(e){}
}
// Tentatives multiples et précoces
hideSplashNow();
if (document.readyState !== "loading") hideSplashNow();
document.addEventListener("DOMContentLoaded", hideSplashNow);
window.addEventListener("load", hideSplashNow);
setTimeout(hideSplashNow, 100);
setTimeout(hideSplashNow, 500);
setTimeout(hideSplashNow, 1000);

/* ---------- INIT ---------- */
(async function(){
  // Filet anti-figeage : fermer tout overlay AVANT toute opération async
  try {
    ["veil","lock"].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove("on"); });
    document.querySelectorAll(".daily-greet").forEach(el=>el.remove());
  } catch(e){}

  let loaded = null;
  try { await openDB(); } catch(e){ console.error("openDB:", e); }
  try { await initSqlite(); } catch(e){ console.error("initSqlite:", e); }
  try { loaded = await idbGet("state"); } catch(e){ console.error("load state:", e); }

  let welcome = false;
  if (loaded && loaded.version >= 1){
    S = loaded;
  } else {
    seedDemo(); welcome = true; S.firstRun = true;
  }
  try { migrate(); } catch(e){ console.error("migrate:", e); }
  try { autoPurge(); } catch(e){ console.error("autoPurge:", e); }
  try { applyTheme(); } catch(e){ console.error("applyTheme:", e); }

  // Re-fermer tout overlay après chargement
  try {
    ["veil","lock"].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove("on"); });
  } catch(e){}

  hideSplashNow();

  if (S.pin){ try { showLock("unlock"); } catch(e){ console.error(e); } }

  try { render(); } catch(e){
    console.error("render:", e);
    // Filet ultime : si render plante, afficher un bouton de secours
    try {
      const b = document.getElementById("board");
      if (b) b.innerHTML = '<div style="padding:30px;text-align:center"><p>Chargement…</p><button class="btn btn-primary" onclick="location.reload()">Recharger</button></div>';
    } catch(e2){}
  }

  // Salutation quotidienne (jamais au premier lancement)
  if (!welcome && !S.firstRun){
    setTimeout(() => { try { dailyGreeting(); } catch(e){} }, 800);
  }

  // PWA : service worker, bannière iOS, avertissements de sauvegarde
  if (typeof initPWA !== "undefined"){
    try { initPWA(); } catch(e){ console.error("PWA:", e); }
    // Le bouton retour du téléphone ferme la feuille au lieu de quitter l'app
    try { initBackButton(); } catch(e){ console.error("nav:", e); }
  }

  if (typeof initNotifications !== "undefined"){
    try { initNotifications(); } catch(e){ console.error("notif:", e); }
  }

  hideSplashNow();
})();