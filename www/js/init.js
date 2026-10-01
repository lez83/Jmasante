/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
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
  if (j && j._jmsecure){ ouvrirProtege(j); return; }          // v1.0.58 : fichier protégé
  /* v1.0.67 : les étiquettes personnalisées voyagent avec les dossiers.
     On ajoute celles qu'on n'a pas ; on ne remplace jamais les siennes. */
  try { if (j && j.tagsPerso && typeof j.tagsPerso === "object") fusionTagsPerso(j.tagsPerso); } catch(e){}
  if (j && j._jmreglages){ recevoirReglages(j); return; }       // v1.0.62 : réglages d'un collègue
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

  /* ⚠️ LE VERROU AVANT LA LECTURE.
     Le code PIN vit DANS l'état, qui est chiffré : tant que la clé du
     coffre n'est pas ouverte, on ne sait même pas qu'un code existe.
     Au premier essai, l'app se croyait neuve et rechargeait la démo
     PAR-DESSUS des données bien présentes. C'est le coffre — lisible en
     clair, sans rien révéler — qui dit s'il faut demander le code. */
  /* Savoir si l'appareil lit une empreinte AVANT d'afficher le verrou :
     c'est ce qui décide d'y proposer le doigt. */
  try { if (typeof bioAppareilDispo === "function") await bioAppareilDispo(); } catch(e){}
  try {
    if (typeof coffreExiste === "function" && await coffreExiste()){
      await new Promise(res => {
        showLock("unlock");
        const l = document.getElementById("lock");
        const obs = new MutationObserver(() => {
          if (!l.classList.contains("on")){ obs.disconnect(); res(); }
        });
        obs.observe(l, { attributes:true, attributeFilter:["class"] });
      });
    }
  } catch(e){ console.error("coffre au démarrage:", e); }

  try { loaded = await idbGet("state"); } catch(e){ console.error("load state:", e); }

  /* ⚠️ Un état illisible n'est PAS un état absent : si le coffre existe,
     on ne démarre jamais sur la démo — on écraserait les données. */
  if (!loaded && typeof coffreExiste === "function" && await coffreExiste()){
    await askDialog({ ton:"danger", ic:"🔒", titre:"Données illisibles",
      sub:"Le coffre est ouvert, mais l'état n'a pas pu être lu.",
      warn:"Ne saisis rien : ferme l'application et réessaie. Si cela persiste, réimporte ta dernière sauvegarde.",
      oui:"J'ai compris", seul:true });
    return;
  }

  let welcome = false;
  if (loaded && loaded.version >= 1){
    S = loaded;
    /* Écran d'ouverture — v1.0.62 (S.ouverture) */
    try {
      const o = S.ouverture || {};
      if (o.tour && o.tour !== "last" && (S.tours||[]).includes(o.tour)) S.curTour = o.tour;
      if (o.moment && o.moment !== "auto") _viewSlot = o.moment;
    } catch(e){}
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

  /* ⚠️ Le coffre a déjà été ouvert plus haut : redemander le code ici
     le ferait saisir DEUX FOIS au démarrage. On ne verrouille que si
     l'app n'est pas déjà passée par là. */
  /* ⚠️ AUTO-RÉPARATION DU RACCOURCI EMPREINTE, une fois l'état chargé :
     activer l'empreinte avant d'avoir un code ne déposait aucune clé. Le
     réglage restait vrai et le doigt n'ouvrait rien. Ici S est lu, donc
     on sait si l'empreinte est demandée. */
  /* ⚠️ On ÉCOUTE le toucher de la mascotte sans toucher à son rôle :
     elle ouvre toujours les réglages. Le compteur se contente de
     regarder passer les clics. */
  /* ⚠️ Deux gestes DISTINCTS sur le numéro de version, tous deux
     délibérés : sept touchers débloquent le thème, un appui long ouvre
     le jeu — la convention d'Android, que les gens connaissent. */
  { const v = document.querySelector(".footer-note");
    if (v){
      v.style.cursor = "default";
      /* ⚠️ Un appui long sur du TEXTE déclenche la sélection d'Android et
         son menu « copier » : le geste n'arrivait jamais jusqu'ici. Il
         faut rendre la ligne non sélectionnable ET refuser le menu
         contextuel — l'un sans l'autre ne suffit pas. */
      v.classList.add("pas-selectionnable");
      v.addEventListener("contextmenu", e => e.preventDefault());
      v.addEventListener("click", () => {
        try { if (typeof versionTouchee === "function") versionTouchee(); } catch(e){}
      });
      let _long = null;
      const presser = () => {
        /* ⚠️ PAS de preventDefault ici : sur mobile il supprimerait le
           clic qui suit, donc les sept touchers du thème. La sélection
           est bloquée par le style (voir .pas-selectionnable). */
        try { const sel = window.getSelection(); if (sel) sel.removeAllRanges(); } catch(e){}
        _long = setTimeout(() => {
        _long = null;
        try { if (typeof ouvrirJeu === "function") ouvrirJeu(); } catch(e){}
      }, 1100); };
      const relacher = () => { if (_long){ clearTimeout(_long); _long = null; } };
      v.addEventListener("pointerdown", presser);
      ["pointerup","pointerleave","pointercancel"].forEach(e => v.addEventListener(e, relacher));
    } }

  { const l = document.querySelector(".brand-logo");
    if (l) l.addEventListener("click", () => {
      try { if (typeof cigaleTouchee === "function") cigaleTouchee(); } catch(e){}
    }); }

  /* Reprendre l'ancien réglage de la ligne des constantes */
  try { if (typeof migrerLigneConstantes === "function") migrerLigneConstantes(); } catch(e){}

  try { if (typeof reparerEmpreinte === "function") setTimeout(reparerEmpreinte, 600); } catch(e){}

  if (S.pin && !(typeof cleOuverte === "function" && cleOuverte())){
    try { showLock("unlock"); } catch(e){ console.error(e); }
  }

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
    try { if (typeof incitationCode === "function") await incitationCode(); } catch(e){}
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
  // v1.0.59 : passage à la clé locale v2, en tâche de fond
  setTimeout(() => { try { migrerCleLocale(); } catch(e){} }, 4000);
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
