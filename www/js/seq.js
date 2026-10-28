/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   SEQ.JS — Mode tournée séquentielle + Signature + Notifications
============================================================ */

/* ============ MODE TOURNÉE SÉQUENTIELLE ============ */
let seqActive = false, seqIdx = 0, seqPool = [], seqSlot = null;
/* Ce que le ruban de reprise doit dire, posé à l'entrée et effacé au
   premier changement de patient : il répond à « où en étais-je », pas à
   « où suis-je ». */
let _seqReprise = null;
/* Rappel vers la mise à jour du bouton de validation du haut : le
   formulaire est construit dans ui.js, qui n'a pas à connaître le
   déroulé — il appelle ce crochet s'il existe. */
let _seqMajValid = null;

/* Patient vu sur la date de travail, pour le créneau du déroulé. */
function seqVu(p, slot){
  const wd = (typeof workDate === "function") ? workDate() : todayISO();
  return (p.visits||[]).some(v => v.date === wd &&
          (!slotsOn() || slot === "jour" || (v.slot||defaultSlot()) === slot));
}

/* ══ LE DÉROULÉ LISTE DES PASSAGES, PLUS DES PATIENTS ══ (v1.27.0)
   ⚠️ IL N'EN LISTAIT QU'UN PAR DOSSIER. Constaté au chevet : « quand j'ai
   un deuxième passage pour un patient, ce dernier ne s'affiche pas dans le
   déroulé, mais uniquement sur la carte des patients ». Mesuré sur une
   tournée de trois patients dont un à passage supplémentaire :

     plateau de cartes │ 4 passages — p1, p1#2, p2, p3 │ « 4 à voir »
     déroulé           │ 3 patients — p1, p2, p3       │ « Patient 2 / 3 »

   ⚠️ IL N'Y AVAIT RIEN À INVENTER, IL Y AVAIT À BRANCHER. `occurrencesTriees`
   existe, le plateau s'en sert depuis le passage supplémentaire, et elle
   rend déjà les occurrences dans l'ordre du créneau. Le déroulé, lui,
   partait de `activeP()` — des dossiers.

   ⚠️ `seqPool` CONTIENT DÉSORMAIS DES OCCURRENCES `{p, rang, cle, multi}`,
   plus des patients. Tout ce qui le parcourt doit passer par `.p`. */
function seqOcc(){ return seqPool[seqIdx] || null; }
function seqPatient(){ const o = seqOcc(); return o ? o.p : null; }
/* ⚠️ L'ÉCRAN DE FIN COMPTE LES PASSAGES D'UN DOSSIER, PAS LES RANGS : lui
   passer les occurrences ferait apparaître deux fois chaque passage d'un
   patient à rang multiple. On lui rend des patients, dédoublonnés. */
function seqPatientsDuPool(pool){
  const vus = {}, out = [];
  (pool||[]).forEach(o => { const q = o && o.p ? o.p : o;
    if (q && !vus[q.id]){ vus[q.id] = 1; out.push(q); } });
  return out;
}
/* Le passage qui remplit CE rang-là — pas le dernier connu du dossier. */
function seqVisiteOcc(o, slot){
  if (!o) return null;
  return (typeof visiteDuRang === "function")
    ? visiteDuRang(o.p, slot, o.rang || 1)
    : null;
}
function seqVuOcc(o, slot){ return !!seqVisiteOcc(o, slot); }
/* ⚠️ « PAS DE PASSAGE » SE RANGE PAR OCCURRENCE, PAS PAR DOSSIER. Posé sur
   le dossier, le drapeau du 2ᵉ passage aurait effacé le 1ᵉʳ. La clé du
   rang 1 reste l'identifiant nu (`cleOcc` ne suffixe qu'à partir de 2) :
   les données déjà enregistrées continuent donc de se lire telles quelles. */
function seqCleOcc(o){
  if (!o) return "";
  return (typeof cleOcc === "function") ? cleOcc(o.p.id, o.rang || 1) : o.p.id;
}
function seqSansPassage(o){
  const wd = (typeof workDate === "function") ? workDate() : todayISO();
  return (S.noVisit||{})[seqCleOcc(o)] === wd;
}

/* ══ LE RAPPEL DU PASSAGE PRÉCÉDENT ══ (v1.27.0)
   ⚠️ SON CHOIX EN MAQUETTE : « le soir, savoir ce qui a été fait le matin
   change ce que tu écris ». Le rappel vit DANS LE FLUX, en tête de
   formulaire — pas dans la barre collée : on le lit une fois en arrivant,
   il n'a pas à coûter de la hauteur pendant toute la saisie.
   ⚠️ DÉPLIÉ PAR DÉFAUT : une information cachée derrière un geste n'est
   pas une information. Le pli est retenu, pour qui le trouve de trop.
   ⚠️ IL NE S'AFFICHE QUE S'IL A QUELQUE CHOSE À DIRE : rang 1, ou rang 2
   dont le premier passage n'a pas encore eu lieu — rien à rappeler. */
function seqRappelPlie(){ return S.seqRappelPlie === true; }
function seqRappelHtml(o, slot){
  if (!o || (o.rang || 1) < 2) return "";
  const v = (typeof visiteDuRang === "function")
    ? visiteDuRang(o.p, slot, (o.rang || 1) - 1) : null;
  if (!v) return "";
  const plie = seqRappelPlie();
  const soins = (v.soins || []).join(" · ");
  const cst = (typeof constParts === "function") ? constParts(v.consts).join(" · ") : "";
  const note = String(v.note || "").trim();
  const corps = plie ? "" : `<div class="sqr-c">`
    + (soins ? `${esc(soins)}` : `<span class="sqr-v">aucun soin coché</span>`)
    + (cst ? `<br>${esc(cst)}` : "")
    + (note ? `<br><span class="sqr-n">« ${esc(note.length > 140 ? note.slice(0,140) + "…" : note)} »</span>` : "")
    + `</div>`;
  /* L'heure d'abord : c'est elle qu'on cherche en arrivant le soir. */
  return `<div class="sqr${plie ? " plie" : ""}" id="sq-rappel">
      <button class="sqr-t" id="sq-rappel-t">
        <span>${esc(v.at ? "Passage précédent à " + v.at : "Passage précédent")}</span>
        <i>${plie ? "▾" : "▴"}</i>
      </button>${corps}
    </div>`;
}

/* Formulaire du déroulé vide ? (mêmes critères que commitVisit :
   aucun soin coché, aucune constante, aucune transmission) */
function seqFormVide(form){
  if (!form) return true;
  if (form.querySelector(".chip.on[data-s]")) return false;
  if ([...form.querySelectorAll("[data-c]")].some(i => (i.value||"").trim())) return false;
  const n = form.querySelector("[data-note]");
  return !(n && (n.value||"").trim());
}

/* Barre compacte dès que le haut du déroulé est sorti de l'écran.
   Un seul écouteur pour toute la session, inactif hors déroulé. */
let _seqScrollBranche = false;
function seqMajCompact(){
  const nav = document.querySelector("#seq-mode .seq-nav");
  const sen = document.getElementById("sq-sentinel");
  if (!seqActive || !nav || !sen) return;
  nav.classList.toggle("compact", sen.getBoundingClientRect().top < 0);
}

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
  /* ⚠️ LA MÊME LISTE QUE LE PLATEAU, PAR LA MÊME FONCTION. Deux listes
     construites séparément finissent par diverger — c'est exactement ce
     qui est arrivé ici : le plateau comptait quatre passages, le déroulé
     trois patients. Un repli garde l'ancien comportement si la fonction
     venait à manquer. */
  pool = (typeof occurrencesTriees === "function")
    ? occurrencesTriees(pool, S.curTour, slot)
    : pool.map(p => ({ p, rang:1, cle:p.id, multi:false }));
  seqPool = pool;
  seqSlot = slot;
  /* Le premier passage non encore fait : c'est le repli, et c'est ce qui
     vaut quand on entre dans le déroulé pour la première fois de la
     journée. Un passage validé depuis sa carte n'est pas reproposé. */
  const reste = pool.findIndex(o => !seqVuOcc(o, slot));
  /* ⚠️ MAIS SI ON REVIENT, ON REVIENT À SA PLACE. La position mémorisée
     ne vaut que pour le même jour, le même créneau et la même tournée ;
     et seulement si le patient est encore dans la liste. */
  _seqReprise = null;
  const m = S.seqPos;
  let repris = -1;
  if (m && m.date === workDate() && (m.slot || null) === (slot || null)
        && (m.tour || null) === (S.curTour || null)){
    /* ⚠️ LA POSITION EST MÉMORISÉE PAR OCCURRENCE. Repartie du seul
       identifiant de dossier, la reprise ramenait au 1ᵉʳ passage d'un
       patient qu'on avait quitté au 2ᵉ. `m.cle` manque dans une position
       enregistrée par une version d'avant : on retombe alors sur le
       dossier, ce qui est l'ancien comportement exactement. */
    repris = m.cle
      ? pool.findIndex(o => o.cle === m.cle)
      : pool.findIndex(o => o.p.id === m.pid);
  }
  if (repris >= 0){
    seqIdx = repris;
    /* Combien de passages non faits restent DERRIÈRE lui : c'est ce qu'il
       faut dire, sinon la reprise masque ceux qu'on a sautés. */
    const avant = pool.slice(0, repris).filter(o => !seqVuOcc(o, slot)
                    && !seqSansPassage(o)).length;
    const q = pool[repris].p;
    _seqReprise = { nom:(q.nom||"").replace("Demo-","").toUpperCase() + " " + (q.prenom||""),
                    avant, premier:(reste >= 0 ? reste : -1) };
  } else {
    if (reste === -1){ seqEndScreen(seqPatientsDuPool(pool), slot); return; }   // tout est déjà fait
    seqIdx = reste;
  }
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

/* ══ OÙ L'ON EN ÉTAIT ══ (v1.23.0)
   ⚠️ LE DÉROULÉ NE REPRENAIT PAS OÙ ON L'AVAIT LAISSÉ. Le commentaire
   d'origine l'assumait — « premier patient non encore vu, calculé, pas
   mémorisé » — mais mesuré sur cinq patients : arrêté sur le 4ᵉ, on
   revient sur le 1ᵉʳ ; les trois premiers validés, arrêté sur le 5ᵉ, on
   revient sur le 4ᵉ. Jamais à sa place.
   ⚠️ ET CE N'EST PAS QU'UN AGACEMENT : c'est ce qui a fait noter « pas de
   passage » chez un patient déjà vu. On croit être sur le suivant.
   ⚠️ LA POSITION EST DATÉE ET CRÉNEAUTÉE : reprendre le soir là où on
   s'était arrêté le matin n'aurait aucun sens, et une tournée d'hier
   encore moins. */
function seqMemoriser(){
  const o = seqOcc();
  if (!o) return;
  S.seqPos = { pid:o.p.id, cle:o.cle, rang:o.rang || 1,
               date:workDate(), slot:seqSlot || null,
               tour:S.curTour || null, ts:Date.now() };
}
function renderSeq(){
  const occ  = seqOcc();
  const p    = occ ? occ.p : null;
  if (!p) return;
  const rang = occ.rang || 1;
  const multi = !!occ.multi;
  seqMemoriser();
  const sm   = document.getElementById("seq-mode");
  sm.className = "on";
  const total = seqPool.length;
  const raps  = (S.rappels||[]).filter(r=>!r.done&&r.pid===p.id).length;

  const wd = (typeof workDate === "function") ? workDate() : todayISO();
  /* ⚠️ UNE PASTILLE PAR PASSAGE, ET CHACUNE LIT SON PROPRE RANG. Avec
     `seqVu`, le 2ᵉ passage s'allumait en « vu » dès le 1ᵉʳ validé : la
     barre annonçait une tournée finie alors qu'il restait à y retourner
     le soir. Les deux pastilles d'un même dossier portent `duo`, qui les
     rapproche — sinon on lit quatre patients là où il y en a trois. */
  const prog = seqPool.map((o, i) => {
    const c = i === seqIdx ? "cur"
            : seqVuOcc(o, seqSlot) ? "vu"
            : (seqSansPassage(o) ? "sans" : "");
    const duo = o.multi ? " duo" + (o.rang > 1 ? " duo-b" : " duo-a") : "";
    return `<i class="${c}${duo}"></i>`;
  }).join("");
  const dernier = seqIdx === total - 1;

  /* ⚠️ Avant : flèches de 40px en surface-2 et nom en petite police
     monospace grise — on ne voyait pas où taper, et la barre disparaissait
     en défilant. Elle reste maintenant collée en haut (compacte). */
  const ruban = _seqReprise ? `
    <div class="sq-reprise" id="sq-reprise">
      <span class="sq-r-ic">↩︎</span>
      <span class="sq-r-tx">Reprise sur <b>${esc(_seqReprise.nom.trim())}</b>${
        _seqReprise.avant
          ? `<br><span class="sq-r-s">${_seqReprise.avant} patient${_seqReprise.avant>1?"s":""} non vu${_seqReprise.avant>1?"s":""} avant lui</span>`
          : `<br><span class="sq-r-s">là où tu t'étais arrêté</span>`}</span>
      ${_seqReprise.avant ? `<button class="sq-r-go" id="sq-r-go">VOIR ›</button>` : `<button class="sq-r-go" id="sq-r-x">✕</button>`}
    </div>` : "";
  sm.innerHTML = `
    ${ruban}
    ${/* ⚠️ LA SENTINELLE EST COLLÉE À LA BARRE, PAS EN TÊTE D'ÉCRAN. Au
         sommet de l'écran séquentiel, elle sortait de l'écran AVANT la barre :
         le resserrement se déclenchait pendant que la barre descendait
         encore, et la réserve de barre d'état apparaissait trop tôt.
         Placée juste au-dessus, « sentinelle sortie » et « barre collée »
         sont le même instant. */""}
    <div id="sq-sentinel"></div>
    <div class="seq-nav avecv">
      <button class="sq-btn sq-prev${seqIdx===0?" edge":""}" id="sq-prev" aria-label="Patient précédent">
        <span class="sq-ar">‹</span><span class="sq-lb">Préc.</span></button>
      <div class="sq-ctr">
        ${/* « Patient » tombe quand la barre se resserre : le compteur
             passe alors à côté du nom, et « Patient 10 / 10 » y serait
             trois fois plus long que l'information qu'il porte. */""}
        ${/* ⚠️ « PASSAGE », PLUS « PATIENT ». Le déroulé compte désormais
             des passages : chez trois patients dont un à passage
             supplémentaire, « Patient 4 / 4 » aurait été faux deux fois. */""}
        <div class="sq-pos"><span class="sq-pos-l">Passage </span>${seqIdx+1} / ${total}</div>
        <div class="sq-nom">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${
          multi ? ` <span class="px${rang>1?"":" un"}">${rang>1?"2ᵉ":"1ᵉʳ"} passage</span>` : ""}</div>
        <div class="sq-prog" aria-hidden="true">${prog}</div>
      </div>
      <button class="sq-btn sq-next" id="sq-next" aria-label="${dernier?"Terminer la tournée":"Patient suivant"}">
        <span class="sq-ar">${dernier?"✓":"›"}</span><span class="sq-lb">${dernier?"Fin":"Suiv."}</span></button>
      <!-- ⚠️ LE SECOND BOUTON DE VALIDATION, DANS LA BARRE COLLÉE.
           Il fallait descendre tout en bas du formulaire pour valider,
           puis remonter prendre la flèche : deux voyages chez un patient
           chargé. La barre étant collée, ce bouton-ci suit partout.
           ⚠️ PLEINE LARGEUR, et c'est délibéré : posé à côté de « Suiv. »
           il aurait été un carré vert de 44 px contre un autre carré vert
           de 44 px, à un pouce d'écart, pour deux actions qui n'ont rien
           à voir — valider un passage, ou changer de patient.
           ⚠️ IL NE VALIDE PAS LUI-MÊME : il appuie sur celui du bas (voir
           plus bas). Un seul chemin de validation, donc un seul endroit
           où un défaut peut se loger. -->
      <button class="sq-valid-b" id="sq-valid">✓ Valider le passage</button>
    </div>
    <div class="sq-tools"><button class="sq-quit" id="sq-quit">✕ Quitter le déroulé</button></div>
    ${(() => {
      const t = (typeof annivTexte === "function") ? annivTexte(p) : "";
      return t ? `<div class="sq-anniv">🎂 ${esc(t)}</div>` : "";
    })()}
    ${/* ⚠️ LE LIBELLÉ DIT CE QUE LE BOUTON FAIT VRAIMENT. Sur un dossier à
         passage supplémentaire, « pas de passage aujourd'hui » était faux :
         le drapeau ne porte que sur CE passage-là, l'autre reste dû. */""}
    <button class="btn btn-ghost" id="sq-skip" style="width:100%;margin-bottom:10px;font-size:13.5px">
      🚫 ${multi
        ? `Pas de ${rang>1?"2ᵉ":"1ᵉʳ"} passage aujourd'hui — suivant`
        : "Pas de passage prévu aujourd'hui — patient suivant"}
    </button>
    ${seqRappelHtml(occ, seqSlot)}
    ${shownInfos(p).map(it => { const T=infoLabel(it);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:8px 12px;margin-bottom:8px">${T.ic} ${it.type==="autre"?"<b>"+esc(T.lbl)+"</b> ":""}${esc(it.txt).replace(/\n/g,"<br>")}</div>`;
    }).join("")}
    <div id="seq-form"></div>`;

  // Formulaire inline
  const fwrap = document.getElementById("seq-form");
  openId = p.id;
  _curSlot = null; // recalculé selon l'heure pour ce patient
  fwrap.innerHTML = inlineForm(p);
  bindInline(p, fwrap);   // le formulaire du déroulé, pas celui de la liste
  const seqForm = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;

  /* ══ NAVIGUER N'EST PAS VALIDER ══ (v1.15.1)
     ⚠️ ←, → et Quitter ENREGISTRAIENT. La règle écrite ici était : « rien
     de saisi → on navigue sans rien enregistrer ; saisie présente → on
     enregistre puis on navigue ». Elle ne pouvait pas distinguer un
     formulaire rempli par une saisie neuve d'un formulaire rempli par le
     passage qu'on venait d'enregistrer : un patient déjà validé revient
     avec ses soins cochés. Revenir le relire puis repartir créait donc un
     SECOND PASSAGE — et l'enregistrement se faisant en mode silencieux
     depuis le déroulé, la question « compléter ou garder deux ? » n'était
     même pas posée. Le doublon se créait sans un mot.
     Mesuré avant correction : valider avec le bouton du bas puis appuyer
     une seule fois sur → donnait déjà DEUX passages.

     ⚠️ UN SEUL CHEMIN CRÉE UN PASSAGE : le bouton « ✓ Valider le passage »
     du bas du formulaire. C'est ce qu'il a demandé, et c'est aussi la
     seule règle qu'on puisse expliquer en une phrase.

     ⚠️ MAIS ON NE JETTE JAMAIS UNE SAISIE. Perdre ce qui vient d'être tapé
     est bien pire qu'un doublon : si le formulaire a été touché depuis le
     dernier enregistrement, la saisie part dans « saisie gardée 💾 » —
     le mécanisme qui existe déjà — et l'écran le dit. */
  const naviguerThen = cb => {
    const form = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;
    if (form && form._touche && !seqFormVide(form)){
      _saveDraft(form, p.id);
      if (_formDraft){
        S.drafts = S.drafts || {};
        S.drafts[p.id] = { ..._formDraft, at: Date.now() };
        save(true);
        toast("Saisie de " + p.prenom + " gardée 💾 — passage non validé");
      }
    }
    cb();
  };
  // « Pas de passage prévu » : on avance sans rien enregistrer → rien dans la relève
  if (!_seqScrollBranche){
    window.addEventListener("scroll", seqMajCompact, { passive:true });
    _seqScrollBranche = true;
  }
  /* Nouveau patient : on repart du haut de sa fiche, pas du milieu */
  { const sen = document.getElementById("sq-sentinel");
    const t = sen ? sen.getBoundingClientRect().top : 0;
    if (t < 0) window.scrollBy(0, t); }
  seqMajCompact();
  { const g = document.getElementById("sq-r-go");
    if (g) g.onclick = () => {
      /* On va au premier non vu, et le ruban s'efface : il a servi. */
      const i = _seqReprise ? _seqReprise.premier : -1;
      _seqReprise = null;
      if (i >= 0){ seqIdx = i; }
      renderSeq();
    };
    const x = document.getElementById("sq-r-x");
    if (x) x.onclick = () => { _seqReprise = null; renderSeq(); }; }
  { const rt = document.getElementById("sq-rappel-t");
    if (rt) rt.onclick = () => { S.seqRappelPlie = !seqRappelPlie(); save(); renderSeq(); }; }
  const skipBtn = document.getElementById("sq-skip");
  if (skipBtn) skipBtn.onclick = async () => {
    /* ══ LA GARDE ══ (v1.23.0)
       ⚠️ CE BOUTON SE TOUCHAIT SUR LE MAUVAIS PATIENT, et l'application
       ne disait rien. C'est arrivé au chevet : revenu dans le déroulé,
       croyant être sur le patient suivant — le déroulé ne reprenait pas
       où il s'était arrêté —, un « pas de passage » noté chez quelqu'un
       où le passage était fait et les constantes saisies.
       ⚠️ ET LE MESSAGE ÉTAIT FAUX : « non inclus dans la relève » alors
       que le passage existant, lui, y figure bel et bien. `statusOf`
       ignore le drapeau dès qu'un passage existe ce jour-là — le mal est
       donc limité, mais on l'annonçait à l'envers.
       ⚠️ ON N'EMPÊCHE PAS, ON DIT. Le soignant reste maître : le troisième
       chemin mène à la correction du passage, qui est neuf fois sur dix
       l'intention réelle. */
    /* ⚠️ LA GARDE NE REGARDE QUE CE RANG-LÀ. Sur un dossier à passage
       supplémentaire, « tu es déjà passé aujourd'hui » se serait déclenché
       le soir alors que le passage du soir, lui, reste à faire : la garde
       serait devenue un bruit qu'on apprend à écarter d'un geste — et le
       jour où elle aurait eu raison, elle aurait été écartée aussi. */
    const vRang = seqVisiteOcc(occ, seqSlot);
    const dejà = vRang ? [vRang] : [];
    if (dejà.length && typeof askChoice === "function"){
      const v0 = dejà[dejà.length - 1];
      const rep = await askChoice({ ic:"⚠️",
        titre:"Tu es déjà passé chez " + esc(p.prenom) + " aujourd'hui",
        sub:"Passage enregistré à <b>" + esc(v0.at || "?") + "</b>"
            + (typeof _resumePassage === "function" && _resumePassage(v0)
               ? " — " + esc(_resumePassage(v0).replace(/^[^—]*—\s*/,"")) : "")
            + ". Noter « pas de passage » ajouterait une marque qui dit le contraire.",
        options:[ { ic:"✏️", lbl:"Corriger le passage de " + esc(v0.at||""), val:"corr" },
                  { ic:"🚫", lbl:"Noter quand même", val:"quand" } ] });
      if (!rep) return;                                  // Annuler : on ne touche à rien
      if (rep === "corr"){
        if (typeof reprendrePassage === "function") reprendrePassage(p.id, v0.uid);
        return;
      }
    }
    // Trace du jour : le patient n'est ni « à voir » ni « vu ».
    // Aucun passage créé → rien dans la relève.
    S.noVisit = S.noVisit || {};
    /* L'état d'avant, pris AVANT d'écrire : c'est lui qui rend le geste
       annulable — le drapeau précédent et la saisie qu'on s'apprête à
       jeter. */
    const _cle = seqCleOcc(occ);
    const avant = { noVisit:(S.noVisit[_cle] || null), cle:_cle,
                    draft:((S.drafts||{})[p.id] ? JSON.parse(JSON.stringify(S.drafts[p.id])) : null) };
    _formDraft = null; _soinNotes = {};   // on jette la saisie éventuelle
    S.noVisit[_cle] = workDate();
    if (typeof annulNoter === "function")
      annulNoter({ type:"novisit", pid:p.id, cle:_cle, avant,
        resume: dejà.length ? "alors qu'un passage de " + (dejà[dejà.length-1].at||"?") + " existe" : "" });
    /* ⚠️ Une saisie gardée survivait à « pas de passage » : l'étiquette
       restait sans qu'aucun geste ne puisse l'enlever. */
    if (typeof oublierBrouillon === "function" && (S.drafts||{})[p.id]){
      oublierBrouillon(p.id);
      toast("Saisie gardée effacée avec le passage");
    }
    save(true);
    /* ⚠️ LE MESSAGE DIT LE VRAI DANS LES DEUX CAS : un passage existant
       part dans la relève, drapeau ou pas. */
    toast(dejà.length
      ? "Marqué « pas de passage » pour " + p.prenom + " — son passage de " + (dejà[dejà.length-1].at||"?") + " reste dans la relève"
      : "Pas de passage prévu pour " + p.prenom + " — non inclus dans la relève",
      { label:"Annuler", ms:7000, action:() => {
          const l = (typeof annulListe === "function") ? annulListe() : [];
          if (l[0] && typeof annulDefaire === "function"){
            const r = annulDefaire(l[0].id);
            toast(r.ok ? "Action annulée ↩︎" : r.why); render();
          }
        } });
    if (seqIdx < total - 1){ seqIdx++; _seqReprise = null; renderSeq(); }
    else { toast("Fin de la tournée ✓"); exitSeqMode(); }
  };
  /* ══ LE BOUTON DU HAUT ══
     ⚠️ Il dit la MÊME chose que celui du bas. Deux boutons qui valident
     la même chose doivent raconter la même histoire : un bouton du haut
     qui resterait « à valider » après une validation ferait appuyer
     « au cas où », et on recréerait des doublons par un autre chemin. */
  const majValidHaut = () => {
    const h = document.getElementById("sq-valid");
    if (!h) return;
    /* ⚠️ CE RANG-LÀ, PAS LE DOSSIER. Avec `seqVu`, le bouton du 2ᵉ passage
       annonçait « Passage enregistré — modifier » dès le 1ᵉʳ validé : il
       disait fait ce qui restait à faire, et invitait à modifier le
       passage du matin en croyant saisir celui du soir. */
    const fait = seqVuOcc(seqOcc(), seqSlot);
    h.classList.toggle("fait", fait);
    h.textContent = fait ? "✓ Passage enregistré — modifier" : "✓ Valider le passage";
    /* Éteint quand il n'y a rien à valider : c'est déjà ce que fait le
       bouton du bas, et les deux doivent s'éteindre ensemble. */
    const bas = fwrap.querySelector("[data-save]");
    if (bas && !fait) h.classList.toggle("off", bas.classList.contains("off"));
    else h.classList.remove("off");
  };
  _seqMajValid = majValidHaut;          // relu à chaque geste dans le formulaire
  majValidHaut();
  { const h = document.getElementById("sq-valid");
    if (h) h.onclick = () => {
      const bas = fwrap.querySelector("[data-save]");
      if (!bas) return;
      bas.click();
      /* La validation est asynchrone (elle peut poser une question) :
         on relit l'état un instant après plutôt que de le supposer. */
      setTimeout(majValidHaut, 150);
    }; }

  document.getElementById("sq-prev").onclick = () => {
    if (seqIdx === 0){ toast("Premier patient de la tournée"); return; }
    naviguerThen(() => { seqIdx--; _seqReprise = null; renderSeq(); });
  };
  document.getElementById("sq-quit").onclick = () => naviguerThen(exitSeqMode);
  document.getElementById("sq-next").onclick = () => {
    naviguerThen(() => {
      if (seqIdx < total - 1){ seqIdx++; _seqReprise = null; renderSeq(); }
      else { const pl = seqPatientsDuPool(seqPool), sl = seqSlot;
             exitSeqMode(); seqEndScreen(pl, sl); }
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
/* ⚠️ REMPLACÉ PAR alertes.js. Cette fonction programmait d'autorité
   J-3, J-1 et le jour J à 8 h pour TOUT rappel daté, sans que rien ne
   l'annonce ni ne permette de l'éteindre. Elle délègue désormais, pour
   qu'il n'existe qu'un seul programmeur : deux auraient posé des
   notifications concurrentes et se seraient annulées l'un l'autre. */
async function scheduleRappelNotifications(){
  if (typeof alerteProgrammer === "function") return alerteProgrammer();
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

/* ⚠️ ICI VIVAIT UN BRANCHEMENT MORT. `_hookedSave` était déclarée et
   n'était installée NULLE PART : `save` n'a jamais été remplacé, donc
   les notifications n'étaient reprogrammées qu'au démarrage de l'app.
   Un rappel créé en tournée ne programmait rien. Le vrai branchement
   vit désormais dans alertes.js, qui remplace réellement `save`. */

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
        (!slotsOn() || slot === "jour" || !slot || (v.slot||defaultSlot()) === slot);

  const lignes = [];
  (pool||[]).forEach(p => {
    (p.visits||[]).filter(estDuJour).forEach(v => lignes.push({ p, v }));
  });
  lignes.sort((a,b) => (a.v.at||"").localeCompare(b.v.at||""));

  const heures = lignes.map(x => x.v.at).filter(Boolean).sort();
  const alertes_ = lignes.filter(x => alertes(x.v.consts, x.p.thresholds, x.v.sourdine).length);
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
        const al = alertes(v.consts, p.thresholds, v.sourdine);
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

    ${/* ⚠️ UN ÉCRAN ENTIER SANS PORTE. sheetBilanTournee — 58 lignes,
          patients vus et non vus, alertes, rappels dus, bilans à faire —
          n'était appelé de nulle part. Sa place est ICI : au moment où
          l'on vient de finir, pas au fond des réglages où l'on ne passe
          pas en tournée. Cet écran-ci dit ce qui a été fait ; celui-là
          dit ce qu'il RESTE, y compris les patients non vus.
                ⚠️ AUCUNE APOSTROPHE INVERSE ICI : ce commentaire vit DANS
                un gabarit, et une seule y referme le gabarit. */""}
    <button class="btn btn-ghost" id="sqe-bilan" style="width:100%;margin-top:14px">📋 Le bilan de la tournée</button>
    <button class="btn btn-primary" id="sqe-home" style="width:100%;margin-top:8px">↩︎ Retour au Moniteur</button>`);

  $$("#sheet [data-sqe]").forEach(b => b.onclick = () => {
    const pid = b.dataset.sqe;
    closeSheet(); openId = pid; render();
    setTimeout(() => {
      const el = document.querySelector(`.pcard[data-id="${pid}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"start" });
    }, 120);
  });
  { const bb = $("#sqe-bilan");
    if (bb) bb.onclick = () => {
      /* Le bilan raisonne sur le vivier de la tournée, pas sur les seuls
         passages de ce créneau : les NON VUS en sont le cœur. */
      const vivier = Array.isArray(pool) && pool.length
        ? pool : (S.patients || []).filter(p => !p.archived && !p.pec);
      sheetBilanTournee(vivier, S.curTour || "all");
    }; }
  $("#sqe-home").onclick = () => { closeSheet(); render(); };
}
