/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
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
  /* Revenir au Moniteur = revenir à la vue d'ensemble : la journée
     entière, cartes repliées. Sinon on retombe sur le créneau et le
     patient qu'on venait de quitter. */
  try {
    if (typeof _viewSlot !== "undefined" && typeof slotsOn === "function" && slotsOn()) _viewSlot = "jour";
    if (typeof openId !== "undefined") openId = null;
    if (typeof render === "function") render();
  } catch(e){}
}

/* En-tête unifié d'une feuille — à placer en tête du HTML.
   `label` : destination du retour (« Réglages », « Fiche »…).
   `showHome` : afficher aussi le ✕ (au-delà d'un niveau de profondeur). */
function navHeader(label, showHome){
  const ARROW = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
    <path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CROSS = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
    <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  /* ⚠️ LE TÉMOIN D'ENREGISTREMENT EXISTAIT DÉJÀ, mais dans la barre du
     titre — et `.veil` (position:fixed, inset:0, z-index:90) la recouvre
     d'un voile noir dès qu'un panneau s'ouvre. Or c'est DANS les panneaux
     qu'on modifie ses données. Le seul témoin de l'app était donc
     invisible exactement au moment où il sert. Il est repris ici, dans
     chaque barre de panneau ; `majBadges()` les met tous à jour. */
  return `<div class="navbar">
    <button class="nav-back" id="nav-back" type="button">${ARROW}<span>${esc(label||"Retour")}</span></button>
    <span style="flex:1"></span>
    ${/* ⚠️ UNE BALISE BOUTON, PLUS UNE BALISE SPAN. Il reste un simple
         témoin tant qu'aucun écran ne lui donne d'action — mais le jour
         où il en a une, c'est un bouton qu'il faut : un span cliquable
         n'est pas atteignable au clavier et ne s'annonce pas comme
         touchable.
         ⚠️ AUCUNE APOSTROPHE INVERSE ICI : ce commentaire vit DANS un
         gabarit de chaîne, et une seule y referme le gabarit. */""}
    <button type="button" class="save-badge nav-save" title="État de l'enregistrement">💾</button>
    ${showHome ? `<button class="nav-home" id="nav-home" type="button" title="Fermer">${CROSS}</button>` : ""}
  </div>`;
}

/* Branche les boutons de l'en-tête ET enregistre le retour dans la pile,
   pour que le bouton du téléphone fasse la même chose que la flèche. */
/* ══ LE 💾 DU HAUT ENREGISTRE, ET ON RESTE ══ (v1.28.0)
   ⚠️ IL AVAIT L'AIR D'UN BOUTON ET N'EN ÉTAIT PAS. Constaté au chevet :
   « en haut j'ai la petite disquette, mais si je clique dessus rien ne se
   passe ». C'était un témoin d'état — un `span` de 21 × 33 px, sans
   gestionnaire, dont l'infobulle disait « État de l'enregistrement ».

   ⚠️ ET LA DEMANDE EST FONDÉE PAR UNE MESURE : dans la fiche patient, le
   bouton « ✓ Enregistrer » est à **1 765 px plus bas** — près de deux
   écrans de défilement pour l'atteindre, puis autant pour remonter.

   ⚠️ IL ENREGISTRE SANS FERMER, et c'est l'arbitrage retenu en maquette
   contre « faire exactement comme le bouton du bas ». Celui du bas ferme
   la fiche : c'est la fin de la tâche. Toucher le 💾 au milieu du
   remplissage, c'est vouloir SÉCURISER SA SAISIE et continuer — le
   refermer renverrait au plateau et ferait perdre les 1 765 px.

   ⚠️ IL N'APPELLE À L'ACTION QUE QUAND IL Y A QUELQUE CHOSE À FAIRE :
   « 💾 Enregistrer » en plein accent tant qu'une modification est en
   attente, « 💾 ✓ » discret sinon. Un bouton d'appel permanent qu'on
   touche pour rien apprend à être ignoré.

   ⚠️ ET SEULS LES ÉCRANS QUI ONT QUELQUE CHOSE À VALIDER LE DÉCLARENT.
   Le 💾 est posé dans la barre de TOUS les panneaux, et la plupart
   écrivent au fur et à mesure : ailleurs il reste ce qu'il a toujours
   été, un témoin. */
let _sheetSave = null;
/* ⚠️ « SANS FERMER » N'EST VRAI QUE SI L'ÉCRAN LE PROMET. Quand le 💾
   reprend le bouton du bas, il fait ce que fait ce bouton — et plusieurs
   de ces écrans enchaînent sur un autre panneau (le contact du cabinet
   revient au cabinet). Annoncer « sans fermer » y serait faux. */
let _sheetSaveDelegue = false;
function sheetEnregistrer(fn){
  _sheetSave = (typeof fn === "function") ? fn : null;
  _sheetSaveDelegue = false;
  majSaveBtn();
  majSaveVisible();
}
/* ══ LE 💾 N'APPARAÎT QUE S'IL A UN ÉTAT À MONTRER ══ (v1.30.0)
   ⚠️ CONSTATÉ AU CHEVET, SUR L'ÉCRAN RÉGLAGES : « la disquette en haut à
   droite ne fonctionne pas ». Elle n'était pas en panne — Réglages est un
   MENU, on y entre et on en sort, rien n'y est jamais enregistré. Elle
   n'avait aucun état à montrer, et n'en aurait jamais.

   ⚠️ MESURÉ SUR LES 42 MODULES : le 💾 était posé sur 88 panneaux, et
   n'agissait que sur UN. Dont 38 sans le moindre champ de saisie.

   ⚠️ POURQUOI PAS UNE DÉCORATION À LA PLACE (cigale, étoile) : un
   ornement occuperait la place d'un indicateur. L'œil apprendrait que ce
   coin est décoratif — et deux écrans plus loin, sur une saisie, le 💾
   est le SEUL endroit qui dise « c'est passé », le témoin du titre étant
   recouvert par le voile dès qu'un panneau s'ouvre. Décorer les menus
   abîmerait l'indicateur ailleurs. Même raisonnement qu'en v1.28.0 : un
   bouton qu'on touche pour rien apprend à être ignoré.

   ⚠️ LA RÈGLE SE DÉCIDE SUR LE DOM, PAS ÉCRAN PAR ÉCRAN. Marquer 38
   panneaux à la main, c'est laisser passer le trente-neuvième, écrit
   demain — c'est exactement ainsi que le cloisonnement des brouillons
   était mort (v1.29.0). Ici la barre regarde ce qu'elle surmonte.

   ⚠️ CE QU'ELLE NE SAIT PAS VOIR : un panneau sans aucun champ qui
   écrirait par ses seuls boutons perdrait son témoin. Qu'il déclare son
   enregistrement par `sheetEnregistrer` et il le retrouve. */
function majSaveVisible(){
  const sh = document.getElementById("sheet");
  if (!sh) return;
  const montrer = (typeof _sheetSave === "function")
               || !!sh.querySelector("input, textarea, select");
  /* `style`, pas une classe : `majBadges` repose tout le `className` à
     chaque écriture de fond, et emporterait la classe avec lui. */
  sh.querySelectorAll(".nav-save").forEach(b => { b.style.display = montrer ? "" : "none"; });
}

function majSaveBtn(){
  const actif = (typeof _sheetSave === "function");
  /* ⚠️ Le témoin de la barre du titre (`#save-badge`) n'est JAMAIS
     actionnable : il vit hors des panneaux, là où il n'y a rien à
     valider. Seuls ceux des barres de panneau le deviennent. */
  document.querySelectorAll(".nav-save").forEach(b => {
    b.classList.toggle("act", actif);
    b.onclick = actif ? () => { try { _sheetSave(); } catch(e){ console.error("enregistrer:", e); } } : null;
    if (!actif){ b.classList.remove("att"); return; }
    /* « En attente » se lit sur la garde de sortie, qui sait déjà si
       l'écran a été modifié : une seconde source se serait désynchronisée
       de la première au premier écran qui l'oublie. */
    /* La garde de sortie quand l'écran en pose une ; sinon la comparaison
       générique avec l'état d'ouverture, qui vaut pour tous les autres. */
    const sale = (typeof _sheetGarde === "function") ? !!_sheetGarde()
               : (typeof sheetModifie === "function" && sheetModifie());
    b.classList.toggle("att", sale);
    b.textContent = sale ? "💾 Enregistrer" : (b.dataset.etat || "💾 ✓");
    b.title = sale ? (_sheetSaveDelegue ? "Enregistrer" : "Enregistrer sans fermer")
                   : "Tout est enregistré";
  });
}

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
    cap.Plugins.App.addListener("backButton", async ({ canGoBack }) => {
      if (handle()) return;
      // Au Moniteur : confirmer avant de quitter
      if (await askDialog({ ic:"👋", titre:"Quitter JM@Santé ?", oui:"Quitter" })) cap.Plugins.App.exitApp();
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
