/* ============================================================
   OUVRIR UN FICHIER REÇU — depuis WhatsApp, Fichiers, Drive…
   ─────────────────────────────────────────────────────────
   Toucher le fichier dans WhatsApp (ou le partager vers JM@Santé)
   ouvre l'app avec son adresse content://. Sans ça, le collègue
   devait fouiller les dossiers du téléphone depuis 📂 Importer.
============================================================ */
/* Aiguillage commun : synchro, envoi d'une tournée ou sauvegarde */
function ouvrirTexteRecu(txt){
  let j = null;
  try { j = JSON.parse(txt); } catch(e){}
  if (j && j._jmsync){ receiveSyncFile(txt); return; }
  if (j && (Array.isArray(j.patients) || j._jmarchive)){ importBackupText(txt); return; }   // sauvegarde, tournée, archive
  toast("Ce fichier n'est pas un fichier JM@Santé.");
}

let _appPrete = false, _fichierEnAttente = null, _dernierRecu = { url:"", t:0 };
function _estVerrouillee(){ const l = document.getElementById("lock"); return !!(l && l.classList.contains("on")); }

async function traiterFichierRecu(){
  const url = _fichierEnAttente;
  if (!url || !_appPrete) return;
  /* ⚠️ Jamais par-dessus l'écran de verrouillage : l'analyse d'une synchro
     affiche des noms de patients. On attend le déverrouillage. */
  if (_estVerrouillee()){ setTimeout(traiterFichierRecu, 500); return; }
  _fichierEnAttente = null;
  try {
    const F = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem;
    if (!F) throw new Error("Filesystem indisponible");
    const r = await F.readFile({ path:url, encoding:"utf8" });
    ouvrirTexteRecu(typeof r.data === "string" ? r.data : await r.data.text());
  } catch(e){
    if (typeof logIncident === "function") logIncident("import", "Fichier reçu illisible", e);
    toast("Lecture impossible — passe par 📂 Importer.");
  }
}
function recevoirUrl(url){
  if (!/^(content|file):/i.test(url || "")) return;
  /* Au lancement à froid, l'adresse arrive deux fois (écouteur et
     getLaunchUrl) : un seul import. */
  const t = Date.now();
  if (url === _dernierRecu.url && t - _dernierRecu.t < 15000) return;
  _dernierRecu = { url, t };
  _fichierEnAttente = url;
  setTimeout(traiterFichierRecu, 600);   // laisse le verrouillage au retour s'appliquer
}
try {
  const A = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (A){
    A.addListener("appUrlOpen", ev => recevoirUrl(ev && ev.url));
    A.getLaunchUrl().then(r => { if (r && r.url) recevoirUrl(r.url); }).catch(() => {});
  }
} catch(e){}

$("#backupfile").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    ouvrirTexteRecu(ev.target.result);
  };
  rd.onerror = () => toast("Lecture du fichier impossible.");
  rd.readAsText(f);
});
$("#syncfile").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    ouvrirTexteRecu(ev.target.result);
  };
  rd.onerror = () => toast("Lecture du fichier impossible.");
  rd.readAsText(f);
});

/* ---------- Masquer le splash au plus tôt (avant même le chargement des données) ---------- */
async function hideSplashNow(){
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.SplashScreen) cap.Plugins.SplashScreen.hide();
  } catch(e){}
}
/* Retirer l'écran de démarrage une fois l'app prête. Le thème est
   déjà appliqué à ce moment : les couleurs correspondent. */
function hideBoot(){
  const b = document.getElementById("boot");
  if (!b || b.classList.contains("gone")) return;
  b.classList.add("gone");
  setTimeout(() => { if (b.parentNode) b.remove(); }, 450);
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
  // Les notes vocales pèsent lourd : ménage à chaque ouverture
  try { if (typeof voicePurge === "function") voicePurge(); } catch(e){}
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
    /* L'avertissement d'abord, le bonjour ensuite : on ne salue pas
     quelqu'un avant de lui dire ce qu'il a entre les mains. */
  setTimeout(async () => {
    try { await avertissementPremierLancement(); } catch(e){}
    try { dailyGreeting(); } catch(e){}
  }, 800);
  }

  // PWA : service worker, bannière iOS, avertissements de sauvegarde
  if (typeof initPWA !== "undefined"){
    try { initPWA(); } catch(e){ console.error("PWA:", e); }
    // Le bouton retour du téléphone ferme la feuille au lieu de quitter l'app
    try { initBackButton(); } catch(e){ console.error("nav:", e); }
    // La date de travail ne survit pas à une fermeture : on repart d'aujourd'hui
    try { setWorkDate(null); } catch(e){}
  }

  if (typeof initNotifications !== "undefined"){
    try { initNotifications(); } catch(e){ console.error("notif:", e); }
  }

  hideSplashNow();
  // L'app est prête et le thème appliqué : on retire l'écran de démarrage
  hideBoot();
  _appPrete = true;
  traiterFichierRecu();   // fichier ouvert depuis WhatsApp pendant le démarrage
})();
/* Filet : si le démarrage échoue, l'écran ne doit pas rester bloqué */
setTimeout(() => { try { hideBoot(); } catch(e){} }, 3500);

/* ============================================================
   AVERTISSEMENT DU PREMIER LANCEMENT
   ─────────────────────────────────────────────────────────
   ⚠️ Exigé pour une diffusion par le Play Store, et sain de toute
   façon : l'utilisateur doit savoir ce que l'app fait — et surtout
   ce qu'elle NE fait pas — avant d'y porter des données de patients.
   Affiché UNE FOIS, puis consultable dans le guide.
============================================================ */
async function avertissementPremierLancement(){
  if (S.avertLu) return;
  await askDialog({
    ic:"🩺", titre:"Avant de commencer",
    sub:"<b>JM@Santé est un carnet de relève, pas un dispositif médical.</b><br><br>" +
        "Elle enregistre ce que tu saisis et t'aide à le transmettre. Elle " +
        "<b>n'interprète pas</b> tes données : aucun diagnostic, aucun score, " +
        "aucune conduite à tenir, aucune alerte clinique.<br><br>" +
        "Les seuils que tu règles servent seulement à faire ressortir une valeur.<br><br>" +
        "Les données restent <b>sur cet appareil</b>. Elles ne partent nulle part, sauf quand " +
        "tu décides toi-même de partager une relève ou un document.<br><br>" +
        "Tu restes responsable de tes observations, de tes décisions et du secret professionnel.",
    /* ⚠️ Pas de « warn » : le cadre rouge ferait alarme alors que le
       propos est rassurant — les données ne bougent pas. */
    oui:"J'ai compris", seul:true
  });
  S.avertLu = true;
  try { save(true); } catch(e){}
}
