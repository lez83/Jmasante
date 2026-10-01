/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   LES SURPRISES
   ─────────────────────────────────────────────────────────
   Quatre choses cachées, et une règle qui les rend acceptables.

   ⚠️ JAMAIS SUR UN ÉCRAN PATIENT, JAMAIS PENDANT UN SOIN. Une
   animation qui se déclenche en validant un passage est une
   distraction au mauvais moment. Elles vivent dans l'en-tête, les
   réglages et Souffler — pas dans le Moniteur en cours d'usage.

   ⚠️ JAMAIS DANS UN DOCUMENT. Rien qui puisse finir imprimé sur une
   feuille domicile ou un DLU.

   ⚠️ PAS DE GESTE SECRET À BALAYAGE : sur un écran tactile utilisé en
   tournée, ils se déclenchent tout seuls. On s'en tient aux
   répétitions — sept touchers, cinq chants — que personne ne fait par
   accident.
============================================================ */

function eggs(){ return (S.eggs = S.eggs || {}); }
function eggTrouve(cle){ return !!eggs()[cle]; }
function eggPoser(cle){ if (!eggs()[cle]){ eggs()[cle] = Date.now(); save(true); } }

/* ── 1. LA CIGALE QU'ON TRITURE ──
   Sept touchers rapides sur la mascotte de l'en-tête. Elle s'immobilise,
   regarde, puis reprend son chant. */
let _cigTaps = 0, _cigT = null;
function cigaleTouchee(){
  clearTimeout(_cigT);
  _cigTaps++;
  _cigT = setTimeout(() => { _cigTaps = 0; }, 900);
  if (_cigTaps < 7) return;
  _cigTaps = 0;
  const el = document.querySelector(".brand-logo, .hd-logo, #brand-cigale");
  if (el){
    el.classList.add("cig-surprise");
    setTimeout(() => el.classList.remove("cig-surprise"), 2600);
  }
  if (typeof cigaleChanter === "function") cigaleChanter(2);
  eggPoser("cigale");
  toast("🦗 …elle t'a vu.");
}

/* ── 2. LE CONCERT ──
   Cinq chants de suite dans Souffler : plusieurs cigales légèrement
   désaccordées, comme un vrai soir d'été. */
let _cigSuite = 0, _cigSuiteT = null;
function cigaleConcertCompter(){
  clearTimeout(_cigSuiteT);
  _cigSuite++;
  _cigSuiteT = setTimeout(() => { _cigSuite = 0; }, 12000);
  if (_cigSuite < 5) return false;
  _cigSuite = 0;
  cigaleConcert();
  eggPoser("concert");
  return true;
}
function cigaleConcert(){
  /* ⚠️ Toujours synthétisé : six cigales coûtent six oscillateurs de
     plus, pas un fichier son. */
  if (typeof cigaleChanter !== "function") return;
  for (let i = 0; i < 6; i++){
    setTimeout(() => {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        _ctxAudio = _ctxAudio || new AC();
        const ctx = _ctxAudio, t0 = ctx.currentTime;
        const duree = 3.4 + Math.random() * 1.6;
        const n = Math.floor(ctx.sampleRate * duree);
        const buf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let k = 0; k < n; k++) d[k] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource(); src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        /* Chacune un peu désaccordée : c'est ce qui fait le chœur */
        bp.type = "bandpass"; bp.frequency.value = 4200 + Math.random() * 1800; bp.Q.value = 7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t0);
        const pas = 0.014, vit = 20 + Math.random() * 8;
        for (let t = 0; t < duree; t += pas){
          const env = Math.min(1, t / 0.5) * Math.min(1, (duree - t) / 0.9);
          const v = (0.05 + 0.035 * Math.sin(t * vit)) * env;
          g.gain.linearRampToValueAtTime(t % 0.028 < 0.014 ? v : v * 0.3, t0 + t);
        }
        g.gain.linearRampToValueAtTime(0, t0 + duree);
        src.connect(bp); bp.connect(g); g.connect(ctx.destination);
        src.start(t0); src.stop(t0 + duree + 0.05);
      } catch(e){}
    }, i * 420);
  }
  toast("🦗🦗🦗 un soir d'été");
}

/* ── 3. LA FICHE CACHÉE DU CIEL ──
   Une trente-et-unième constellation, qui n'apparaît qu'en cherchant
   « cigale ». Elle n'entre jamais dans la rotation hebdomadaire. */
const CIEL_SECRET = {
  n:"La Cigale", f:"constellation", secret:true,
  t:"Elle ne figure dans aucun catalogue, et pour cause : on l'a inventée ici. Cherche-la entre le Scorpion et la Lyre, un soir de juillet, quand le chant monte des pins et qu'on ne sait plus si on l'entend ou si on s'en souvient.",
  e:[[50,22,3.2],[38,38,2.4],[62,38,2.4],[44,56,2.6],[56,56,2.6],[50,74,3],[30,62,2],[70,62,2]],
  l:[[0,1],[0,2],[1,3],[2,4],[3,5],[4,5],[3,6],[4,7]]
};

/* ── 4. LE THÈME RÉTRO ──
   Sept touchers sur le numéro de version. */
let _verTaps = 0, _verT = null;
function versionTouchee(){
  clearTimeout(_verT);
  _verTaps++;
  _verT = setTimeout(() => { _verTaps = 0; }, 900);
  if (eggTrouve("retro")){
    if (_verTaps >= 7){ _verTaps = 0; toast("▓ Moniteur 1994 est déjà dans tes thèmes"); }
    return;
  }
  if (_verTaps >= 4 && _verTaps < 7) toast(["…", "▓", "▓▓", "▓▓▓"][_verTaps - 4] || "▓");
  if (_verTaps < 7) return;
  _verTaps = 0;
  eggPoser("retro");
  toast("> MODE MONITEUR 1994 DÉBLOQUÉ_");
  askDialog({ ic:"▓", titre:"Moniteur 1994",
    sub:"Le terminal du poste de soins, avant les écrans couleur. Il rejoint tes thèmes — et il y reste.",
    oui:"L'essayer tout de suite", non:"Plus tard" }).then(ok => {
      if (!ok) return;
      S.theme = "retro"; save(true); applyTheme(); render();
      if (typeof sheetPersonnaliser === "function") sheetPersonnaliser();
    });
}

/* ── 5. LE JEU ──
   ⚠️ Chargé À LA DEMANDE, dans un cadre plein écran : 43 Ko qui n'ont
   rien à faire au démarrage de l'app. Un bouton d'échappement permet
   d'en sortir à tout moment — on peut être interrompu par un patient.
   ⚠️ Ses scores vivent dans SON propre stockage (localStorage), séparé
   de l'état de l'app : ils n'entrent ni dans la sauvegarde ni dans la
   synchro, et ne grossissent aucun dossier. */
function ouvrirJeu(){
  if (document.getElementById("jeu-plein")) return;
  const d = document.createElement("div");
  d.id = "jeu-plein";
  d.innerHTML = `
    <iframe src="jeu/tubulure.html" title="Tubulure" loading="lazy"></iframe>
    <button id="jeu-sortie" aria-label="Quitter le jeu">✕ Quitter</button>`;
  document.body.appendChild(d);
  document.body.classList.add("jeu-ouvert");
  const sortir = () => {
    d.remove();
    document.body.classList.remove("jeu-ouvert");
    document.removeEventListener("keydown", surEchap);
  };
  const surEchap = e => { if (e.key === "Escape") sortir(); };
  document.getElementById("jeu-sortie").onclick = sortir;
  document.addEventListener("keydown", surEchap);
  eggPoser("jeu");
}

/* ============================================================
   LE CARNET DES SURPRISES
   ─────────────────────────────────────────────────────────
   La liste de ce qui est caché, et comment l'ouvrir.

   ⚠️ IL EST LUI-MÊME CACHÉ : trois touchers sur le slogan, au-dessus du
   guide d'utilisation. Une liste affichée en clair dans le guide
   supprimerait le plaisir de chercher — mais ne rien écrire nulle part
   condamnerait les surprises à l'oubli.

   ⚠️ CE QUI N'EST PAS ENCORE TROUVÉ N'EST PAS DÉVOILÉ : on lit une
   devinette, pas la marche à suivre. Un bouton permet de tout révéler
   pour qui préfère la liste — c'est son application, il choisit.
============================================================ */
const SURPRISES = [
  { cle:"cigale", ic:"🦗", nom:"Le réveil de la cigale",
    enigme:"Elle dort en haut à gauche de tous les écrans. Insiste un peu.",
    comment:"Sept touchers rapides sur la mascotte, dans l'en-tête.",
    quoi:"Elle s'étire, te regarde, puis chante deux secondes." },
  { cle:"concert", ic:"🦗🦗", nom:"Le concert",
    enigme:"Une cigale, c'est l'été. Cinq fois de suite, c'est tout le pin.",
    comment:"Dans 🌿 Souffler → Le chant de la cigale, touche-la cinq fois de suite sans attendre.",
    quoi:"Six cigales légèrement désaccordées, comme un vrai soir de juillet." },
  { cle:"ciel", ic:"✨", nom:"La constellation perdue",
    enigme:"Trente fiches au catalogue. La trente-et-unième porte ton slogan.",
    comment:"Dans 🌿 Souffler → Le ciel, tape « cigale » dans la recherche.",
    quoi:"Une constellation qui n'existe dans aucun catalogue — on l'a inventée ici." },
  { cle:"retro", ic:"▓", nom:"Moniteur 1994",
    enigme:"Le numéro de version, en bas de l'accueil, n'est pas qu'un numéro.",
    comment:"Sept touchers sur le numéro de version, au bas de l'écran d'accueil.",
    quoi:"Un thème vert phosphore : le terminal du poste de soins, avant les écrans couleur. Il reste ensuite dans ta liste de thèmes." },
  { cle:"jeu", ic:"🎮", nom:"Tubulure",
    enigme:"Le même numéro de version. Mais là, prends ton temps.",
    comment:"Appui long d'une seconde sur le numéro de version.",
    quoi:"Un jeu pour patienter dans la voiture. Plein écran, avec ✕ Quitter toujours visible." }
];

function sheetCarnet(tout){
  const trouvees = SURPRISES.filter(s => eggTrouve(s.cle)).length;
  openSheet(`
    ${navHeader("Guide", true)}
    <h3>📜 Le carnet des surprises</h3>
    <p class="small muted" style="margin-bottom:12px">
      ${trouvees} sur ${SURPRISES.length} ${trouvees > 1 ? "trouvées" : "trouvée"}.
      ${trouvees < SURPRISES.length && !tout
        ? "Ce qui reste caché ne te donne qu'un indice."
        : "Tu les as toutes."}</p>

    ${SURPRISES.map(s => {
      const vu = eggTrouve(s.cle) || tout;
      return `<div class="srp ${vu ? "ouv" : ""}">
        <div class="srp-h"><span class="srp-ic">${vu ? s.ic : "🔒"}</span>
          <b>${vu ? esc(s.nom) : "?"}</b></div>
        ${vu
          ? `<p class="srp-c"><b>Comment :</b> ${esc(s.comment)}</p>
             <p class="srp-q">${esc(s.quoi)}</p>`
          : `<p class="srp-e">${esc(s.enigme)}</p>`}
      </div>`;
    }).join("")}

    ${trouvees < SURPRISES.length && !tout
      ? `<button class="btn btn-ghost" id="srp-tout" style="width:100%;margin-top:12px">🔓 Tout me montrer</button>
         <p class="small muted" style="margin-top:6px">Rien ne t'oblige à chercher.</p>`
      : ""}
    <div class="tip" style="margin-top:14px">Aucune de ces surprises ne touche tes dossiers, ne s'affiche pendant un soin, ni ne figure sur un document imprimé.</div>`);
  bindNav();
  { const t = $("#srp-tout"); if (t) t.onclick = () => sheetCarnet(true); }
}

/* La porte d'entrée : trois touchers sur le slogan du guide */
let _sloTaps = 0, _sloT = null;
function sloganTouche(){
  clearTimeout(_sloT);
  _sloTaps++;
  _sloT = setTimeout(() => { _sloTaps = 0; }, 900);
  if (_sloTaps < 3) return;
  _sloTaps = 0;
  sheetCarnet();
}
