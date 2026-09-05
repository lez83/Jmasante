/* ============================================================
   NAVIGATION — retour matériel, pile d'écrans, en-tête unifié
   ─────────────────────────────────────────────────────────
   Trois apports :
   ① Le bouton retour du téléphone ferme la feuille ouverte au
      lieu de quitter l'application.
   ② Une pile mémorise d'où l'on vient, pour un vrai « retour ».
   ③ Un en-tête constant : « ‹ Destination » à gauche, ✕ à droite.

   Les poignées glissables des feuilles restent inchangées.
============================================================ */

/* Pile de navigation : chaque entrée sait comment revenir en arrière */
const NAV = { stack: [], guard: null };

/* Enregistre l'écran courant et la façon d'en revenir.
   `label` s'affiche à côté de la flèche : l'utilisateur sait où il va. */
function navPush(label, back){
  NAV.stack.push({ label, back });
}
function navReset(){ NAV.stack = []; }

/* Revenir d'un niveau. Renvoie false s'il n'y a nulle part où aller. */
function navBack(){
  // Priorité aux couches empilées au-dessus des feuilles
  const tp = document.getElementById("typepick");
  if (tp){ tp.remove(); return true; }
  const dv = document.getElementById("docview");
  if (dv && dv.style.display !== "none"){ dv.style.display = "none"; dv.innerHTML = ""; return true; }
  const fp = document.getElementById("fichePrev");
  if (fp){ fp.remove(); return true; }

  // Saisie en cours : demander avant de perdre le travail
  if (typeof NAV.guard === "function"){
    const g = NAV.guard;
    if (!g()) return true;          // le garde a traité l'événement
  }

  const cur = NAV.stack.pop();
  if (cur && typeof cur.back === "function"){ cur.back(); return true; }

  // Feuille ouverte sans historique : la fermer simplement
  const veil = document.getElementById("veil");
  if (veil && veil.classList.contains("on")){ closeSheet(); navReset(); return true; }
  return false;
}

/* Tout fermer et revenir au Moniteur */
function navHome(){
  ["typepick","fichePrev"].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
  const dv = document.getElementById("docview");
  if (dv){ dv.style.display = "none"; dv.innerHTML = ""; }
  closeSheet(); navReset();
}

/* En-tête unifié d'une feuille — à placer en tête du HTML.
   `label` : destination du retour (« Réglages », « Fiche »…).
   `showHome` : afficher aussi le ✕ (au-delà d'un niveau de profondeur). */
function navHeader(label, showHome){
  const ARROW = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
    <path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CROSS = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
    <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  return `<div class="navbar">
    <button class="nav-back" id="nav-back" type="button">${ARROW}<span>${esc(label||"Retour")}</span></button>
    <span style="flex:1"></span>
    ${showHome ? `<button class="nav-home" id="nav-home" type="button" title="Fermer">${CROSS}</button>` : ""}
  </div>`;
}

/* Branche les boutons de l'en-tête ET enregistre le retour dans la pile,
   pour que le bouton du téléphone fasse la même chose que la flèche. */
function bindNav(backFn){
  const b = document.getElementById("nav-back");
  const go = () => { if (typeof backFn === "function") backFn(); else navHome(); };
  if (b) b.onclick = () => { NAV.stack.pop(); go(); };
  const h = document.getElementById("nav-home");
  if (h) h.onclick = navHome;
  // Une seule entrée par écran : on remplace si on revient sur le même
  NAV.stack = NAV.stack.filter(x => x.fn !== String(backFn));
  NAV.stack.push({ label:"", back:go, fn:String(backFn) });
  if (NAV.stack.length > 12) NAV.stack.shift();   // garde-fou
}

/* ---------- Bouton retour du téléphone ----------
   Sans cela, le retour Android QUITTE l'application — y compris
   au milieu d'une saisie de passage. */
function initBackButton(){
  const handle = () => {
    if (navBack()) return true;      // consommé par l'app
    return false;                    // laisser le système agir
  };

  // Android natif (Capacitor)
  const cap = window.Capacitor;
  if (cap && cap.Plugins && cap.Plugins.App){
    cap.Plugins.App.addListener("backButton", ({ canGoBack }) => {
      if (handle()) return;
      // Au Moniteur : confirmer avant de quitter
      if (confirm("Quitter JM@Santé ?")) cap.Plugins.App.exitApp();
    });
  }

  // Navigateur et PWA : on pilote l'historique
  try {
    history.replaceState({ jm: 0 }, "");
    history.pushState({ jm: 1 }, "");
    window.addEventListener("popstate", () => {
      const consumed = handle();
      // Toujours conserver une entrée d'avance, sinon le retour suivant
      // sortirait de l'application.
      history.pushState({ jm: 1 }, "");
      if (!consumed){
        // Rien à fermer : on reste sur le Moniteur (pas de sortie brutale)
      }
    });
  } catch(e){ console.warn("history:", e); }

  // Touche Échap au clavier (version PC)
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") navBack();
  });
}
