/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   MES DISPOSITIFS — un catalogue à soi, pour écrire moins
   ─────────────────────────────────────────────────────────
   Le but est simple : qu'une ordonnance de matériel porte des noms
   exacts et des dimensions justes, imprimés, plutôt qu'un manuscrit
   que le pharmacien devra déchiffrer.

   ⚠️ NI CODE LPP, NI TARIF, NI MENTION DE REMBOURSEMENT. C'est la
   consigne de l'utilisateur, et c'est aussi ce qui écarte le plus gros
   risque de péremption : un nom de gamme bouge lentement, un code et un
   tarif changent sans prévenir.

   ⚠️ SOCLE MODESTE, ENRICHI PAR L'UTILISATEUR. Une cinquantaine de
   références courantes, relevées des captures qu'il a fournies. Ce
   n'est pas un catalogue exhaustif et ne prétend pas l'être : une liste
   vivante qu'on complète vaut mieux qu'un pavé de six cents lignes qui
   périme sans que personne ne s'en aperçoive.

   ⚠️ L'APP NE SUGGÈRE AUCUN PANSEMENT. Elle n'a jamais dit « pour cette
   plaie, prends un alginate » et ne le dira pas. Elle range ce que
   l'utilisateur utilise, il choisit.

   ⚠️ Données rangées dans l'essai (`essaiData("dispositifs")`) :
   effaçables sans toucher à un dossier.
============================================================ */

/* ============================================================
   LE CATALOGUE DE PRESCRIPTION — les six domaines du texte
   ─────────────────────────────────────────────────────────
   ⚠️ Source : arrêté du 26 juin 2026 (NOR SFHH2617311A, JO du 27 juin),
   lu intégralement. Périmètre confirmé par l'analyse juridique de
   l'AP-HP et, pour la déclaration vaccinale, par l'ordre national des
   infirmiers.

   ⚠️ LES CONDITIONS SONT RAPPELÉES, JAMAIS VÉRIFIÉES. L'app ne sait pas
   si le patient est diabétique, ni ce qu'un confrère a prescrit la
   semaine dernière. Aucun blocage, aucune validation : le soignant
   reste seul juge.

   ⚠️ LES LIGNES ISSUES DU TEXTE NE SE MODIFIENT PAS (`fixe:true`). Une
   ligne réglementaire réécrite finit par ne plus correspondre au texte
   sans qu'on sache quand elle a dérivé. L'ajout libre reste possible à
   côté, et le retrait aussi.

   ⚠️ Le catalogue sert à écrire vite, le GUIDE sert à savoir ce qu'on a
   le droit d'écrire. Les deux se répondent, aucun ne remplace l'autre.
============================================================ */
const PRESC_DOMAINES = [
  { k:"vaccins", ic:"💉", n:"Vaccins" },
  { k:"plaies",  ic:"🩹", n:"Plaies et pansements" },
  { k:"sexuel",  ic:"💗", n:"Santé sexuelle" },
  { k:"tabac",   ic:"🚭", n:"Sevrage tabagique" },
  { k:"medic",   ic:"💊", n:"Médicaments et solutions" },
  { k:"bio",     ic:"🧪", n:"Examens biologiques" },
  { k:"dm",      ic:"⚙️", n:"Dispositifs hors plaie" }
];

/* `c` : la condition du texte, rappelée sous la ligne. */
const PRESC_SOCLE = [
  { d:"vaccins", n:"Calendrier vaccinal en vigueur", c:"11 ans et plus, selon les recommandations du calendrier" },
  { d:"vaccins", n:"Vaccin grippe saisonnière", c:"11 ans et plus, ciblés ou non par les recommandations" },
  { d:"vaccins", n:"Vaccin covid-19", c:"5 ans et plus, ciblés ou non par les recommandations" },
  { d:"vaccins", n:"⚠️ Vaccins vivants atténués", c:"exclus chez les personnes immunodéprimées" },

  { d:"sexuel", n:"Renouvellement contraceptif oral", c:"prescription de moins d'un an · 6 mois maximum, non renouvelable · mentions de l'annexe II" },
  { d:"sexuel", n:"Préservatifs", c:"" },
  { d:"sexuel", n:"Contraceptif d'urgence", c:"" },
  { d:"sexuel", n:"Dosage bêta-HCG", c:"confirmation et datation de grossesse" },
  { d:"sexuel", n:"Dépistage VIH, hépatites B et C, syphilis", c:"" },
  { d:"sexuel", n:"Dépistage chlamydia et gonocoque", c:"" },

  { d:"tabac", n:"Substituts nicotiniques", c:"" },
  { d:"tabac", n:"Bilan sanguin du sevrage", c:"cholestérol, triglycérides, glycémie à jeun — risque cardiovasculaire" },

  { d:"medic", n:"Antalgiques de palier I (OMS)", c:"y compris dans les indications antipyrétiques" },
  { d:"medic", n:"Adaptation de posologie antalgique", c:"selon les indications de la prescription initiale" },
  { d:"medic", n:"Antiseptiques à large spectre", c:"⚠️ sans antibiotique · 5 premiers jours après la plaie · hors pied diabétique" },
  { d:"medic", n:"Anesthésiques locaux", c:"toute forme sauf injectable" },
  { d:"medic", n:"Nitrate d'argent", c:"hyperbourgeonnement, faible dosage" },
  { d:"medic", n:"Solutions stériles et sérum physiologique", c:"" },
  { d:"medic", n:"Sprays protecteurs cutanés", c:"" },

  { d:"bio", n:"NFS, plaquettes", c:"pathologie connue ou symptômes évocateurs" },
  { d:"bio", n:"Ionogramme sanguin", c:"pathologie connue ou symptômes évocateurs" },
  { d:"bio", n:"ECBU", c:"avec antibiogramme si nécessaire" },
  { d:"bio", n:"Glycémie à jeun", c:"ou en urgence si déséquilibre ou hypoglycémie" },
  { d:"bio", n:"INR sous AVK", c:"⚠️ renouvellement une fois · quelques jours si déséquilibre constaté" },
  { d:"bio", n:"HbA1c", c:"⚠️ diabétique connu · pas déjà prescrit dans les 3 derniers mois" },
  { d:"bio", n:"Créatininémie", c:"⚠️ diabétique connu · pas déjà prescrit dans les 3 derniers mois" },
  { d:"bio", n:"Albuminurie / créatininurie", c:"⚠️ diabétique connu · pas déjà prescrit dans les 3 derniers mois" },

  { d:"dm", n:"Cerceaux de lit", c:"prescription et renouvellement" },
  { d:"dm", n:"Béquilles et cannes", c:"location" },
  { d:"dm", n:"Soulève-malade", c:"mécanique ou électrique" },
  { d:"dm", n:"Matériel de perfusion à domicile", c:"perfuseurs, aiguilles de chambre, prolongateurs, robinets, pieds à sérum" },
  { d:"dm", n:"Sonde naso-gastrique ou naso-entérale", c:"nutrition entérale à domicile" },
  { d:"dm", n:"Matériel de nutrition entérale", c:"renouvellement" },
  { d:"dm", n:"Orthèses de contention", c:"⚠️ renouvellement à l'identique de la force de compression" },
  { d:"dm", n:"Matériel d'autosurveillance glycémique", c:"⚠️ renouvellement à l'identique · capteurs de glucose interstitiel inclus" }
];

const DISPO_FAMILLES = [
  "Hydrocellulaires", "Hydrocolloïdes", "Alginates et hydrofibres",
  "Interfaces et tulles", "Pansements spécifiques", "Compresses et gazes",
  "Fixation et bandes", "Nettoyage et antiseptiques", "Contention",
  "Sondage et urologie", "Perfusion", "Surveillance glycémique",
  "Prévention d'escarre", "Autre"
];

/* Le socle : nom de gamme, dimensions courantes, famille. */
const DISPO_SOCLE = [
  { n:"Mepilex Border", d:"7,5×7,5 · 10×10 · 12,5×12,5 · 15×15", f:"Hydrocellulaires" },
  { n:"Mepilex Border Lite", d:"5×5 · 7,5×7,5 · 10×10", f:"Hydrocellulaires" },
  { n:"Mepilex", d:"10×10 · 10×20 · 15×15", f:"Hydrocellulaires" },
  { n:"Mepilex Heel", d:"talon", f:"Hydrocellulaires" },
  { n:"Allevyn Adhesive", d:"7,5×7,5 · 12,5×12,5 · 17,5×17,5", f:"Hydrocellulaires" },
  { n:"Allevyn Gentle Border", d:"7,5×7,5 · 10×10 · 12,5×12,5", f:"Hydrocellulaires" },
  { n:"Allevyn Life", d:"10,3×10,3 · 12,9×12,9 · 15,4×15,4", f:"Hydrocellulaires" },
  { n:"Biatain Silicone", d:"7,5×7,5 · 10×10 · 12,5×12,5", f:"Hydrocellulaires" },
  { n:"Aquacel Foam", d:"10×10 · 12,5×12,5 · 17,5×17,5", f:"Hydrocellulaires" },
  { n:"UrgoTul Absorb", d:"10×12 · 15×20", f:"Hydrocellulaires" },

  { n:"DuoDERM E", d:"10×10 · 15×15 · 20×20", f:"Hydrocolloïdes" },
  { n:"DuoDERM Extra Thin", d:"7,5×7,5 · 10×10 · 15×15", f:"Hydrocolloïdes" },
  { n:"Comfeel Plus Transparent", d:"5×7 · 10×10 · 15×15", f:"Hydrocolloïdes" },
  { n:"Algoplaque", d:"10×10 · 15×15", f:"Hydrocolloïdes" },

  { n:"Algostéril compresse", d:"5×5 · 10×10", f:"Alginates et hydrofibres" },
  { n:"Algostéril mèche", d:"30 cm", f:"Alginates et hydrofibres" },
  { n:"Urgosorb", d:"5×5 · 10×10 · mèche", f:"Alginates et hydrofibres" },
  { n:"Aquacel Extra", d:"5×5 · 10×10 · 15×15", f:"Alginates et hydrofibres" },
  { n:"Aquacel mèche", d:"2×45 cm", f:"Alginates et hydrofibres" },
  { n:"Biatain Alginate", d:"10×10 · mèche", f:"Alginates et hydrofibres" },

  { n:"Mepitel One", d:"5×7,5 · 10×18 · 13×15", f:"Interfaces et tulles" },
  { n:"Adaptic Touch", d:"5×7,6 · 7,6×11 · 12,7×15", f:"Interfaces et tulles" },
  { n:"Urgotul", d:"10×12 · 15×20", f:"Interfaces et tulles" },
  { n:"Physiotulle", d:"10×10 · 15×15", f:"Interfaces et tulles" },
  { n:"Jelonet / tulle gras", d:"10×10 · 10×40", f:"Interfaces et tulles" },

  { n:"Pansement au charbon actif", d:"10×10 · 10×20", f:"Pansements spécifiques" },
  { n:"Pansement à l'argent", d:"10×10 · 15×15", f:"Pansements spécifiques" },
  { n:"Super-absorbant", d:"10×20 · 20×20", f:"Pansements spécifiques" },
  { n:"Film polyuréthane transparent", d:"6×7 · 10×12 · 15×20", f:"Pansements spécifiques" },

  { n:"Compresses stériles non tissées", d:"7,5×7,5 · 10×10", f:"Compresses et gazes" },
  { n:"Compresses stériles de gaze", d:"7,5×7,5 · 10×10", f:"Compresses et gazes" },
  { n:"Compresses non stériles", d:"10×10, boîte de 100", f:"Compresses et gazes" },
  { n:"Set à pansement stérile", d:"à l'unité", f:"Compresses et gazes" },

  { n:"Sparadrap microporeux", d:"2,5 cm · 5 cm", f:"Fixation et bandes" },
  { n:"Bande de crêpe", d:"5 cm · 7 cm · 10 cm", f:"Fixation et bandes" },
  { n:"Bande cohésive", d:"6 cm · 8 cm · 10 cm", f:"Fixation et bandes" },
  { n:"Filet tubulaire de maintien", d:"doigt · main · bras · jambe", f:"Fixation et bandes" },
  { n:"Jersey tubulaire", d:"2,5 cm · 5 cm · 7,5 cm", f:"Fixation et bandes" },

  { n:"Sérum physiologique NaCl 0,9 %", d:"dosettes 5 ml · 10 ml · 20 ml", f:"Nettoyage et antiseptiques" },
  { n:"Eau stérile pour irrigation", d:"flacon 250 ml · 500 ml", f:"Nettoyage et antiseptiques" },
  { n:"Antiseptique à large spectre", d:"flacon", f:"Nettoyage et antiseptiques" },

  { n:"Bas de compression", d:"classe à préciser · mesures à prendre", f:"Contention" },
  { n:"Chaussettes de compression", d:"classe à préciser", f:"Contention" },
  { n:"Bande à allongement court", d:"8 cm · 10 cm", f:"Contention" },

  { n:"Sonde vésicale à demeure", d:"CH 14 · CH 16 · CH 18", f:"Sondage et urologie" },
  { n:"Sonde d'autosondage", d:"CH 12 · CH 14", f:"Sondage et urologie" },
  { n:"Étui pénien", d:"petit · moyen · grand", f:"Sondage et urologie" },
  { n:"Poche de recueil à urines", d:"jambe · nuit", f:"Sondage et urologie" },

  { n:"Perfuseur stérile", d:"à l'unité", f:"Perfusion" },
  { n:"Aiguille de Huber", d:"20G · 22G", f:"Perfusion" },
  { n:"Prolongateur", d:"10 cm · 25 cm", f:"Perfusion" },
  { n:"Robinet à trois voies", d:"à l'unité", f:"Perfusion" },
  { n:"Pansement de cathéter central", d:"8,5×11,5 · 10×12", f:"Perfusion" },

  { n:"Bandelettes d'autosurveillance", d:"boîte de 50", f:"Surveillance glycémique" },
  { n:"Lancettes", d:"boîte de 100", f:"Surveillance glycémique" },
  { n:"Aiguilles pour stylo injecteur", d:"4 mm · 5 mm · 6 mm · 8 mm", f:"Surveillance glycémique" },

  { n:"Coussin anti-escarre", d:"mousse · gel · air", f:"Prévention d'escarre" },
  { n:"Matelas anti-escarre", d:"mousse · air statique · air dynamique", f:"Prévention d'escarre" }
];

/* ── Les données de l'utilisateur ──
   `ajouts` : ses propres références. `retires` : les lignes du socle
   qu'il ne veut pas voir — on ne touche jamais au socle lui-même. */
/* ⚠️ LES TAILLES SAISIES À LA MAIN NE SE DÉCOUPAIENT PAS. Le socle
   sépare par « · », et le code ne connaissait que ce caractère : une
   référence ajoutée par l'utilisateur avec « 10×10 / 15×15 » ou
   « 10×10 15×15 » ne proposait aucun choix, malgré les tailles saisies.

   ⚠️ LA VIRGULE N'EST PAS UN SÉPARATEUR : en français elle sert de
   décimale (« 12,5×12,5 »). La découper casserait la taille en deux.

   Deux passes : les séparateurs francs d'abord, puis — s'il n'en reste
   qu'un bloc — la reconnaissance des motifs « nombre × nombre », qui
   rattrape les tailles collées par des espaces. */
function tailleListe(txt){
  const t = (txt || "").trim();
  if (!t) return [];
  /* ⚠️ Le TIRET n'est séparateur qu'ENTOURÉ D'ESPACES : « 10x10 - 14x14 »
     se découpe, « Mepilex Border-Flex » non. Collé, il est traité à la
     passe suivante, qui reconnaît les motifs de dimension. */
  const franc = t.split(/[·;|\/\n]+|\s+-\s+/).map(x => x.trim()).filter(Boolean);
  if (franc.length > 1) return franc;

  /* Un seul bloc : y a-t-il plusieurs motifs de dimension dedans ? */
  const motif = /\d+(?:[.,]\d+)?\s*[x×*]\s*\d+(?:[.,]\d+)?(?:\s*(?:cm|mm))?/gi;
  const trouves = t.match(motif);
  if (trouves && trouves.length > 1) return trouves.map(x => x.trim());

  /* Ou plusieurs calibres « CH 14 CH 16 », « 5 cm 7 cm » ? */
  const cal = t.match(/(?:CH|FR|G)\s*\d+|\d+(?:[.,]\d+)?\s*(?:cm|mm|ml|G)\b/gi);
  if (cal && cal.length > 1) return cal.map(x => x.trim());

  return [t];
}

function dispoData(){
  const d = essaiData("dispositifs");
  d.ajouts = d.ajouts || [];
  d.retires = d.retires || [];
  return d;
}
function dispoListe(){
  const d = dispoData();
  const socle = DISPO_SOCLE
    .filter(x => !d.retires.includes(x.n))
    .map(x => ({ ...x, socle:true }));
  return [...socle, ...d.ajouts.map(x => ({ ...x, socle:false }))];
}
/* ⚠️ UNE RÉFÉRENCE AJOUTÉE ATTERRISSAIT EN FIN DE FAMILLE : « Mepilex
   Border Flex » se retrouvait après d'autres marques, loin de « Mepilex
   Border ». On classe donc chaque famille par ordre alphabétique, ce
   qui regroupe naturellement les déclinaisons d'une même gamme.

   ⚠️ SEULEMENT LES FAMILLES DE MATÉRIEL. Les domaines issus du texte
   (vaccins, examens, médicaments) gardent l'ordre de l'arrêté : il y a
   une logique de lecture qu'un tri alphabétique casserait.

   `localeCompare` avec `numeric` pour que « 10×10 » précède « 15×15 »
   et non l'inverse comme le ferait une comparaison de chaînes. */
function trierRefs(l){
  return [...l].sort((a, b) =>
    (a.n || "").localeCompare(b.n || "", "fr", { numeric:true, sensitivity:"base" }));
}

function dispoFamilles(){
  const l = dispoListe();
  return DISPO_FAMILLES
    .map(f => ({ f, items:trierRefs(l.filter(x => x.f === f)) }))
    .filter(g => g.items.length);
}

/* ── L'écran du catalogue ── */
let _dispoOuvert = null, _dispoQ = "";
function sheetDispositifs(pid){
  const q = (_dispoQ || "").trim().toLowerCase();
  /* ⚠️ Le catalogue ne contient plus seulement du matériel : les six
     domaines du texte y entrent, et les pansements deviennent l'un
     d'eux. */
  const groupes = prescParDomaine()
    .map(g => ({ ...g, items: q ? g.items.filter(x =>
        (x.n + " " + (x.dim || "") + " " + (x.c || "")).toLowerCase().includes(q)) : g.items }))
    .filter(g => g.items.length);
  const total = prescListe().length;

  openSheet(`
    ${navHeader(pid ? "Fiche" : "Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("dispositifs") : ""}
    <h3>📋 Mon catalogue</h3>
    <p class="small muted" style="margin-bottom:10px">${total} référence(s) dans ${PRESC_DOMAINES.length} domaines. Les lignes issues du texte ne se modifient pas ; tu peux les retirer et ajouter les tiennes.</p>
    <div class="warn" style="margin-bottom:10px">Les conditions sont <b>rappelées</b>, jamais vérifiées : l'application ne sait pas si ton patient est diabétique, ni ce qui a été prescrit ailleurs.</div>

    <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-bottom:10px">
      <span>🔍</span>
      <input id="di-q" class="rec-in" placeholder="Chercher une référence…" value="${esc(_dispoQ)}" style="flex:1;min-width:0">
      ${_dispoQ ? `<button class="lien-x" id="di-qx" aria-label="Effacer">✕</button>` : ""}
    </div>

    ${groupes.map(g => {
      const ouvert = q ? true : _dispoOuvert === g.k;
      return `<div class="di-g ${ouvert ? "on" : ""}">
        <button class="di-gh" data-dif="${esc(g.k)}">
          <span style="flex:0 0 auto">${g.ic}</span>
          <span style="flex:1;min-width:0;text-align:left">${esc(g.n)}</span>
          <span class="di-n">${g.items.length}</span>
          <span class="di-fl">${ouvert ? "⌄" : "›"}</span>
        </button>
        ${ouvert ? g.items.map(x => `
          <div class="di-i">
            <span style="flex:1;min-width:0">
              <b>${esc(x.n)}</b>${(!x.fixe && x.socle === false) ? `<span class="di-tag">à moi</span>` : ""}
              ${x.dim ? `<br><span class="small muted">${esc(x.dim)}</span>` : ""}
              ${/* ⚠️ La condition du texte, RAPPELÉE sous la ligne — jamais vérifiée. */
                x.c ? `<br><span class="pr-c">${esc(x.c)}</span>` : ""}
            </span>
            ${pid ? `<button class="btn btn-ghost btn-sm" data-dipick="${esc(x.n)}" style="width:auto;flex:0 0 auto">＋</button>`
                  : `<button class="lien-x" data-dirm="${esc(x.n)}" aria-label="Retirer">✕</button>`}
          </div>`).join("") : ""}
      </div>`;
    }).join("")}

    ${!groupes.length ? `<p class="small muted">Rien ne correspond à « ${esc(_dispoQ)} ».</p>` : ""}

    <button class="btn btn-ghost" id="di-add" style="width:100%;margin-top:10px">＋ Ajouter une référence</button>
    <button class="btn btn-ghost" id="di-xls" style="width:100%;margin-top:7px">📊 Classeur — exporter / importer</button>
    ${pid ? `<button class="btn btn-primary" id="di-ordo" style="width:100%;margin-top:10px">✍️ Composer une ordonnance</button>` : ""}
    <div class="tip" style="margin-top:12px">Ni code, ni tarif, ni mention de remboursement : seulement des noms et des dimensions, pour que la pharmacie lise sans déchiffrer.</div>`);
  bindNav(() => pid ? sheetPatient(getP(pid), "act") : sheetTours());
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();

  { const e = $("#di-q");
    if (e) e.oninput = () => { _dispoQ = e.value; const p2 = e.selectionStart;
      sheetDispositifs(pid); const n = $("#di-q"); if (n){ n.focus(); n.setSelectionRange(p2, p2); } }; }
  { const e = $("#di-qx"); if (e) e.onclick = () => { _dispoQ = ""; sheetDispositifs(pid); }; }
  $$("#sheet [data-dif]").forEach(b => b.onclick = () => {
    _dispoOuvert = (_dispoOuvert === b.dataset.dif) ? null : b.dataset.dif;
    sheetDispositifs(pid);
  });
  $$("#sheet [data-dirm]").forEach(b => b.onclick = async () => {
    const nom = b.dataset.dirm;
    const d = dispoData();
    const perso = d.ajouts.findIndex(x => x.n === nom);
    if (!await askDialog({ ic:"✕", titre:"Retirer « " + nom + " » ?",
      sub:perso >= 0 ? "C'est une de tes références." : "Elle disparaît de ta liste. Tu pourras la remettre par le classeur.",
      oui:"Retirer" })) return;
    if (perso >= 0) d.ajouts.splice(perso, 1);
    else d.retires.push(nom);
    save(true); sheetDispositifs(pid);
  });
  { const b = $("#di-add"); if (b) b.onclick = () => dispoAjouter(pid); }
  { const b = $("#di-xls"); if (b) b.onclick = () => sheetDispoClasseur(pid); }
  { const b = $("#di-ordo"); if (b) b.onclick = () => sheetOrdoDispo(pid); }
  /* ⚠️ Le catalogue liste les tailles DISPONIBLES. Les imprimer toutes
     sur l'ordonnance (« 7,5×7,5 · 10×10 · 12,5×12,5 · 15×15 ») laisse le
     pharmacien sans savoir quoi délivrer. On en choisit UNE. */
  $$("#sheet [data-dipick]").forEach(b => b.onclick = async () => {
    _ordoPanier = _ordoPanier || [];
    const nom = b.dataset.dipick;
    const ref = dispoListe().find(x => x.n === nom);
    const tailles = tailleListe(ref && (ref.dim || ref.d));
    let taille = "";
    if (tailles.length > 1){
      const choix = await askChoice({ ic:"📏", titre:nom,
        sub:"Quelle taille ?",
        options:[ ...tailles.map(t => ({ lbl:t, val:t })),
                  { ic:"✏️", lbl:"Autre — à préciser", val:"__libre" } ] });
      if (!choix) return;
      if (choix === "__libre"){
        const libre = await askText("Taille", { ic:"📏", ph:"ex. 20×20" });
        if (!libre || !libre.trim()) return;
        taille = libre.trim();
      } else taille = choix;
    } else taille = tailles[0] || "";
    /* ⚠️ Une même référence peut revenir en DEUX tailles — une plaie qui
       évolue —, mais pas deux fois la même. */
    if (_ordoPanier.some(x => x.n === nom && x.d === taille)){
      toast(nom + (taille ? " " + taille : "") + " — déjà dans l'ordonnance");
      return;
    }
    _ordoPanier.push({ n:nom, d:taille, q:"1 boîte" });
    toast(nom + (taille ? " " + taille : "") + " ajouté");
  });
}

async function dispoAjouter(pid){
  const nom = await askText("Nouvelle référence", { ic:"🩹", ph:"Nom — ex. Mepilex Border Flex" });
  if (!nom || !nom.trim()) return;
  const dim = await askText("Dimensions", { ic:"📏", ph:"ex. 10×10 · 15×15 · 20×20",
    sub:"Sépare les tailles par « · », « / » ou un point-virgule. Facultatif." });

  /* ⚠️ On MONTRE ce que l'app a compris : une taille mal découpée ne se
     verrait qu'au moment de prescrire, trop tard. */
  const vues = tailleListe(dim);
  if (vues.length > 1){
    await askDialog({ ic:"📏", titre:vues.length + " tailles reconnues",
      sub:vues.join("   ·   "), oui:"C'est bien ça" });
  } else if ((dim || "").trim()){
    const ok = await askDialog({ ic:"📏", titre:"Une seule taille reconnue",
      sub:"« " + dim.trim() + " ». Si tu en as saisi plusieurs, sépare-les par « · » ou « / ».",
      oui:"Continuer", non:"Corriger" });
    if (!ok) return dispoAjouter(pid);
  }
  const fam = await askChoice({ ic:"📂", titre:"Dans quelle famille ?",
    options: DISPO_FAMILLES.map(f => ({ lbl:f, val:f })) });
  if (!fam) return;
  dispoData().ajouts.push({ n:nom.trim(), d:(dim || "").trim(), f:fam });
  save(true);
  _dispoOuvert = fam;
  toast("Référence ajoutée");
  sheetDispositifs(pid);
}

/* ── Le classeur ──
   ⚠️ Même principe que l'annuaire : on remplit au clavier sur un vrai
   écran, et l'import ne remplace jamais sans montrer ce qui change. */
function sheetDispoClasseur(pid){
  openSheet(`
    ${navHeader("Mes dispositifs", true)}
    <h3>📊 Le classeur</h3>
    <p class="small muted" style="margin-bottom:12px">Saisir trente références au pouce est pénible. Exporte, remplis au clavier, réimporte.</p>
    <button class="btn btn-ghost" id="dx-exp" style="width:100%;margin-bottom:7px">⬇️ Exporter mes dispositifs</button>
    <button class="btn btn-ghost" id="dx-imp" style="width:100%">⬆️ Importer un classeur</button>
    <!-- ⚠️ Un champ de fichier caché : c'est le seul moyen d'ouvrir le
         sélecteur du système. Même mécanisme que le classeur du cabinet. -->
    <input type="file" id="dx-file" accept=".xlsx" style="display:none">
    <div class="tip" style="margin-top:12px">Trois colonnes : <b>Nom</b>, <b>Dimensions</b>, <b>Famille</b>. Ne renomme pas l'onglet et ne déplace pas les colonnes.</div>
    <div class="warn" style="margin-top:9px">L'import <b>ajoute</b> ce qui manque et te montre ce qui diffère. Rien n'est écrasé sans que tu le voies.</div>`);
  bindNav(() => sheetDispositifs(pid));
  { const b = $("#dx-exp"); if (b) b.onclick = () => dispoExport(); }
  { const b = $("#dx-imp"), f = $("#dx-file");
    if (b && f){
      b.onclick = () => f.click();
      f.onchange = () => { const x = f.files && f.files[0]; if (x) dispoImport(x, pid); };
    } }
}

async function dispoExport(){
  let XL;
  toast("Préparation du classeur…");
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  wb.creator = "JM@Santé"; wb.created = new Date();
  const ws = wb.addWorksheet("Dispositifs");
  ws.getRow(1).values = ["Nom", "Dimensions", "Famille"];
  ws.getRow(1).eachCell(c => {
    c.font = { bold:true, color:{ argb:"FFFFFFFF" }, size:11 };
    c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:"FF1D9E75" } };
  });
  ws.columns = [{ width:34 }, { width:34 }, { width:26 }];
  dispoListe().forEach((x, i) => {
    const r = i + 2;
    ws.getCell("A" + r).value = x.n;
    ws.getCell("B" + r).value = x.d || "";
    ws.getCell("C" + r).value = x.f;
  });
  /* La liste des familles, pour que la saisie reste cohérente */
  const wf = wb.addWorksheet("Familles");
  wf.getRow(1).values = ["Familles possibles"];
  DISPO_FAMILLES.forEach((f, i) => { wf.getCell("A" + (i + 2)).value = f; });
  wf.columns = [{ width:30 }];

  const buf = await wb.xlsx.writeBuffer();
  const b64 = _b64(new Uint8Array(buf));
  const nom = "Mes_dispositifs_" + new Date().toISOString().slice(0, 10) + ".xlsx";
  try {
    const ou = await saveToDevice(nom,
      "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," + b64,
      { mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", base64:true });
    toast("Enregistré — " + ou);
    /* ⚠️ Le classeur se remplit sur un vrai clavier : on propose de
       l'envoyer tout de suite. Une annulation n'est pas une erreur. */
    try { await fichierPartager(nom, b64,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); } catch(e){}
  } catch(e){ toast("Export impossible", "danger"); }
}

async function dispoImport(fichier, pid){
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  let wb;
  try {
    wb = new XL.Workbook();
    await wb.xlsx.load(await fichier.arrayBuffer());
  } catch(e){ toast("Fichier illisible", "danger"); return; }
  const ws = wb.getWorksheet("Dispositifs");
  if (!ws){ toast("Onglet « Dispositifs » introuvable", "danger"); return; }

  const lus = [];
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values || [];
    const txt = x => (x && x.text ? x.text : (x == null ? "" : String(x))).trim();
    const n = txt(v[1]); if (!n) return;
    lus.push({ n, d:txt(v[2]), f:DISPO_FAMILLES.includes(txt(v[3])) ? txt(v[3]) : "Autre" });
  });
  if (!lus.length){ toast("Aucune référence dans le classeur"); return; }

  /* ⚠️ Trois piles, comme pour l'annuaire : on montre avant d'appliquer. */
  const actuel = dispoListe();
  const nouveaux = lus.filter(x => !actuel.some(a => a.n.toLowerCase() === x.n.toLowerCase()));
  const differents = lus.filter(x => actuel.some(a =>
    a.n.toLowerCase() === x.n.toLowerCase() && ((a.d||"") !== (x.d||"") || a.f !== x.f)));

  if (!nouveaux.length && !differents.length){ toast("Rien de nouveau dans ce classeur"); return; }

  const choix = await askChoice({ ic:"📊", titre:"Classeur lu",
    sub: nouveaux.length + " nouvelle(s) · " + differents.length + " différente(s)",
    options:[
      { ic:"＋", lbl:"Ajouter les nouvelles seulement", sub:nouveaux.length + " référence(s)", val:"new" },
      { ic:"✓", lbl:"Ajouter et mettre à jour", sub:"les différences sont reprises", val:"tout" }
    ] });
  if (!choix) return;

  const d = dispoData();
  nouveaux.forEach(x => d.ajouts.push(x));
  if (choix === "tout"){
    differents.forEach(x => {
      const i = d.ajouts.findIndex(a => a.n.toLowerCase() === x.n.toLowerCase());
      if (i >= 0) d.ajouts[i] = x;
      else { d.retires.push(actuel.find(a => a.n.toLowerCase() === x.n.toLowerCase()).n); d.ajouts.push(x); }
    });
  }
  save(true);
  toast(nouveaux.length + " ajoutée(s)" + (choix === "tout" && differents.length ? " · " + differents.length + " mise(s) à jour" : ""));
  sheetDispositifs(pid);
}

/* ── Composer une ordonnance ── */
let _ordoPanier = [];
function sheetOrdoDispo(pid){
  const p = getP(pid);
  _ordoPanier = _ordoPanier || [];
  openSheet(`
    ${navHeader("Mes dispositifs", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("dispositifs") : ""}
    <h3>✍️ Composer l'ordonnance</h3>
    <p class="small muted" style="margin-bottom:10px">Pour ${esc(p ? (p.prenom||"") + " " + (p.nom||"").replace("Demo-","").toUpperCase() : "")}.</p>

    ${_ordoPanier.length ? _ordoPanier.map((x, i) => `
      <div class="od-l">
        <div class="rowb" style="gap:7px;align-items:center">
          <span style="flex:1;min-width:0"><b>${esc(x.n)}</b>
            ${x.d ? `<br><span class="small muted">${esc(x.d)}</span>` : ""}</span>
          <input class="rec-in" data-oq="${i}" value="${esc(x.q)}" placeholder="Quantité" style="flex:0 0 100px;min-width:0">
          <button class="lien-x" data-orm="${i}" aria-label="Retirer">✕</button>
        </div>
        <!-- ⚠️ Modalités d'utilisation : sans elles, la pharmacie
             délivre mais le patient ne sait pas comment s'en servir. -->
        <input class="rec-in" data-om="${i}" value="${esc(x.m || "")}"
          placeholder="Modalités — ex. 1 changement tous les 2 jours" style="margin-top:5px">
      </div>`).join("")
      : `<p class="small muted">Rien pour l'instant. Ajoute des références depuis ton catalogue.</p>`}

    <button class="btn btn-ghost" id="od-pick" style="width:100%;margin-top:9px">＋ Prendre dans mon catalogue</button>
    <button class="btn btn-ghost" id="od-libre" style="width:100%;margin-top:7px">✏️ Ajouter une ligne libre</button>

    <!-- ⚠️ L'EN-TÊTE ÉTAIT FIGÉ ICI, alors que la feuille vierge le
         laissait modifier. Une correction ponctuelle — un cabinet, un
         numéro — ne doit pas obliger à changer sa fiche. Modifié ici,
         ce n'est valable QUE pour ce document. -->
    <button class="btn btn-ghost" id="od-entete" style="width:100%;margin-top:12px">
      ✍️ En-tête : ${esc(ordoEntete(p).nom || "—")}${_ordoEnteteMod ? " — modifié" : ""}</button>

    <div class="lab" style="margin-top:12px">Durée et renouvellement</div>
    <div class="rowb" style="gap:6px">
      <input id="od-duree" class="rec-in" value="${esc(dispoData().duree || "")}"
        placeholder="Durée — ex. 7 jours, 1 mois" style="flex:1;min-width:0">
      <select class="rec-in" id="od-renouv" style="flex:1;min-width:0">
        ${["Non renouvelable","Renouvelable 1 fois","Renouvelable 2 fois","Renouvelable 3 fois",
           "À renouveler si besoin"].map(o =>
          `<option${(dispoData().renouv || "Non renouvelable") === o ? " selected" : ""}>${esc(o)}</option>`).join("")}
      </select>
    </div>

    ${/* ⚠️ CHAMPS LIBRES, pas une reprise du dossier : une mesure
          ancienne imprimée d'autorité serait trompeuse, et le poids du
          jour n'est pas toujours dans l'app. Laissés vides, ils sortent
          en pointillés — à remplir à la main après impression. */ ""}
    <div class="lab" style="margin-top:12px">Taille et poids
      <span class="small muted" style="text-transform:none;letter-spacing:0"> — si c'est utile au matériel</span></div>
    <div class="rowb" style="gap:6px">
      <input id="od-taille" class="rec-in" value="${esc(dispoData().taille || "")}"
        placeholder="Taille${_mesureHint(p).taille}" style="flex:1;min-width:0">
      <input id="od-poids" class="rec-in" value="${esc(dispoData().poids || "")}"
        placeholder="Poids${_mesureHint(p).poids}" style="flex:1;min-width:0">
    </div>
    <label class="screl" style="margin-top:7px">
      <input type="checkbox" id="od-morpho" ${dispoData().morpho ? "checked" : ""}>
      <span>Les faire figurer sur l'ordonnance
        <span class="small muted"><br>Laissés vides, ils s'impriment en pointillés à remplir à la main.</span></span>
    </label>

    <div class="lab" style="margin-top:12px">Précisions pour la pharmacie</div>
    <textarea id="od-note" class="rec-in" rows="2" placeholder="Remarques libres…">${esc((dispoData().note)||"")}</textarea>

    ${_ordoPanier.length ? `<button class="btn btn-primary" id="od-go" style="width:100%;margin-top:12px">👁 Voir l'ordonnance</button>` : ""}
    <div class="warn" style="margin-top:10px">Un brouillon à relire : <b>rien n'est signé</b> tant que tu n'as pas imprimé et signé toi-même.</div>`);
  bindNav(() => sheetDispositifs(pid));
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();
  $$("#sheet [data-oq]").forEach(e => e.onchange = () => { _ordoPanier[+e.dataset.oq].q = e.value.trim(); });
  $$("#sheet [data-orm]").forEach(b => b.onclick = () => { _ordoPanier.splice(+b.dataset.orm, 1); sheetOrdoDispo(pid); });
  { const b = $("#od-pick"); if (b) b.onclick = () => sheetDispositifs(pid); }
  { const b = $("#od-libre");
    if (b) b.onclick = async () => {
      const n = await askText("Ligne libre", { ic:"✏️", ph:"Ce que tu veux écrire" });
      if (!n || !n.trim()) return;
      _ordoPanier.push({ n:n.trim(), d:"", q:"" });
      sheetOrdoDispo(pid);
    }; }
  $$("#sheet [data-om]").forEach(e => e.onchange = () => { _ordoPanier[+e.dataset.om].m = e.value.trim(); });
  { const e = $("#od-duree"); if (e) e.onchange = () => { dispoData().duree = e.value.trim(); save(true); }; }
  { const e = $("#od-renouv"); if (e) e.onchange = () => { dispoData().renouv = e.value; save(true); }; }
  { const e = $("#od-taille"); if (e) e.onchange = () => { dispoData().taille = e.value.trim(); save(true); }; }
  { const e = $("#od-poids"); if (e) e.onchange = () => { dispoData().poids = e.value.trim(); save(true); }; }
  { const e = $("#od-morpho"); if (e) e.onchange = () => { dispoData().morpho = e.checked; save(true); sheetOrdoDispo(pid); }; }
  { const e = $("#od-note"); if (e) e.onchange = () => { dispoData().note = e.value.trim(); save(true); }; }
  { const b = $("#od-entete"); if (b) b.onclick = () => sheetOrdoEntete(pid); }
  { const b = $("#od-go"); if (b) b.onclick = () => sheetOrdoApercu(pid); }
}

/* ⚠️ `mode` : "save" enregistre, "share" ouvre le menu de partage.
   Sans précision, les deux sont tentés — comportement d'avant. */
async function ordoDispoProduire(pid, mode){
  if (!(await pdfPret())){ toast("Impossible de préparer le PDF ici", "danger"); return; }
  const p = getP(pid);
  /* ⚠️ Le cabinet DU PATIENT quand il y en a un — même règle que
     l'ordonnance : l'en-tête suit le dossier, pas l'écran ouvert. */
  const E = ordoEntete(p);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const MG = 18, L = 210 - MG * 2, V = [29, 122, 102], G = [85, 99, 94];
  /* ⚠️ Titre NEUTRE : le catalogue couvre vaccins, examens et
     médicaments, pas seulement du matériel. « Ordonnance de dispositifs
     médicaux » rendrait la feuille inexacte dès qu'on prescrit un
     examen biologique. */
  const tete = pdfEnTete(doc, E, "Ordonnance", "");
  /* ⚠️ L'en-tête s'est allongé d'une ligne (numéro du prescripteur) :
     la marge minimale suit, sinon le bloc patient se superpose. */
  let y = Math.max(tete.y + 3, 62);
  /* ⚠️ La mention « remplaçant de » est déjà écrite par pdfEnTete(),
     juste sous le titre : la répéter ici la faisait apparaître DEUX
     FOIS sur la feuille. */
  /* ⚠️ Le bloc patient est commun à tous les documents : chaque écran
     le réécrivait, et ils finissaient par diverger. */
  y = pdfBlocPatient(doc, p, y, {
    morpho: !!dispoData().morpho,
    taille: (dispoData().taille || "").trim(),
    poids:  (dispoData().poids  || "").trim()
  });

  /* ⚠️ LE NUMÉRO VA EN MARGE DROITE, dans sa propre colonne séparée par
     un filet : collé au texte, « 1 Mepilex » se lisait comme une
     QUANTITÉ. La prescription garde la largeur utile. */
  const COL = 12;                    // largeur de la colonne des numéros
  const LT  = L - COL;               // largeur du texte
  const XN  = MG + L;                // bord droit, où s'aligne le chiffre
  const XF  = MG + LT + 2;           // le filet de séparation

  _ordoPanier.forEach((x, i) => {
    if (y > 254){ doc.addPage(); y = 22; }
    const y0 = y;
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(26, 36, 32);
    doc.splitTextToSize(sansEmoji(x.n) + (x.q ? "   —   " + sansEmoji(x.q) : ""), LT - 4)
      .forEach(l => { doc.text(l, MG, y); y += 4.8; });
    if (x.d){
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
      doc.text(sansEmoji(x.d), MG + 4, y); y += 4.4;
    }
    /* Les modalités d'utilisation, sous la ligne qu'elles concernent. */
    if (x.m){
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
      doc.splitTextToSize(sansEmoji(x.m), LT - 6).forEach(l => {
        if (y > 272){ doc.addPage(); y = 22; }
        doc.text(l, MG + 4, y); y += 4.4;
      });
    }
    /* Le filet puis le chiffre, alignés sur toute la hauteur de la ligne. */
    doc.setDrawColor(226, 232, 230); doc.setLineWidth(0.2);
    doc.line(XF, y0 - 3.4, XF, y - 1);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(138, 154, 149);
    doc.text(String(i + 1), XN, y0, { align:"right" });
    y += 2.2;
  });

  /* ⚠️ LE TOTAL FERME LA LISTE, juste avant la signature : une ligne
     ajoutée après coup ne correspondrait plus au compte. Affiché même
     pour une seule prescription, pour que son absence ne crée jamais de
     doute. */
  if (_ordoPanier.length){
    y += 2;
    doc.setDrawColor(...V); doc.setLineWidth(0.5);
    doc.line(MG, y, MG + L, y);
    y += 5.2;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...V);
    doc.text("Ordonnance comportant", MG + L - 42, y, { align:"right" });
    doc.setFont("helvetica", "bold");
    doc.text(_ordoPanier.length + (_ordoPanier.length > 1 ? " prescriptions" : " prescription"),
             MG + L, y, { align:"right" });
    y += 6;
  }

  /* ⚠️ Durée et renouvellement sortent en évidence, pas noyés dans les
     remarques : ce sont des mentions qui engagent la délivrance. */
  { const du = (dispoData().duree || "").trim();
    const re = (dispoData().renouv || "").trim();
    if (du || re){
      y += 3;
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...V);
      doc.text(sansEmoji([du ? "Duree : " + du : "", re].filter(Boolean).join("   —   ")), MG, y);
      y += 6;
    } }

  const note = (dispoData().note || "").trim();
  if (note){
    y += 3;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
    doc.splitTextToSize(sansEmoji(note), L).forEach(l => {
      if (y > 272){ doc.addPage(); y = 22; }
      doc.text(l, MG, y); y += 4.4;
    });
  }

  y = Math.max(y + 10, 240);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...G);
  doc.text("Fait le :", MG, y);
  doc.setDrawColor(190, 198, 195);
  doc.line(MG + 15, y + 0.8, MG + 60, y + 0.8);
  y += 9;
  doc.text("Signature :", MG, y);
  doc.setDrawColor(210, 216, 213);
  doc.rect(MG, y + 2, L, 22);

  const base = "Ordonnance" + (p ? "_" + (p.prenom||"") + "_" + (p.nom||"").replace("Demo-","") : "")
    + "_" + new Date().toISOString().slice(0, 10);
  await pdfLivrer(doc, base, mode);
}

/* ============================================================
   L'APERÇU AVANT PRODUCTION
   ─────────────────────────────────────────────────────────
   ⚠️ DESSINÉ DANS L'APP, pas en ouvrant le PDF : sur Android un PDF
   part dans une visionneuse extérieure, et revenir corriger oblige à
   quitter puis rouvrir l'application. Ici le bouton « Modifier »
   ramène à la saisie sans sortir.

   ⚠️ C'est une reproduction fidèle de la mise en page, pas le document
   lui-même : l'aperçu ne remplace pas la relecture du PDF signé.
============================================================ */
function sheetOrdoApercu(pid){
  const p = getP(pid);
  const E = ordoEntete(p);
  const dd = dispoData();
  sheetApercu({
    titre:"Ordonnance", entete:E, patient:p,
    morpho: !!dd.morpho, taille:(dd.taille || "").trim(), poids:(dd.poids || "").trim(),
    corps: _ordoPanier.map((x, i) => ({
      t: x.n + (x.d ? "  " + x.d : "") + (x.q ? "  —  " + x.q : ""),
      s: x.m || "", num: i + 1 })),
    total: _ordoPanier.length,
    pied: [dd.duree ? "Durée : " + dd.duree : "", dd.renouv].filter(Boolean).join("   —   "),
    retour: () => sheetOrdoDispo(pid),
    modifier: () => sheetOrdoDispo(pid),
    produire: (mode) => ordoDispoProduire(pid, mode)
  });
}


/* ============================================================
   UNE SEULE PORTE VERS LES ORDONNANCES
   ─────────────────────────────────────────────────────────
   ⚠️ Deux entrées voisines — « Ordonnance pré-imprimée » et « Mes
   dispositifs » — ne disaient pas ce qui les sépare. « Pré-imprimée »
   décrit comment la feuille est fabriquée, pas ce qu'on en fait. La
   vraie différence tient en deux mots : IMPRIMÉ ou MANUSCRIT.
============================================================ */
function sheetPrescrire(pid){
  const p = pid ? getP(pid) : null;
  const n = prescListe().length;
  openSheet(`
    ${navHeader(p ? "Fiche" : "Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("dispositifs") : ""}
    <h3>✍️ Faire une ordonnance</h3>
    <p class="small muted" style="margin-bottom:12px">${p
      ? "Pour <b>" + esc((p.prenom||"") + " " + (p.nom||"").replace("Demo-","").toUpperCase()) + "</b>. Deux façons de faire."
      : "Deux façons de faire. Sans patient, seule la feuille vierge a du sens."}</p>

    ${p ? `
    <button class="pr-v" id="pr-cat">
      <span class="pr-i">📋</span>
      <span class="pr-t"><b>Depuis mon catalogue</b>
        <span>Vaccins, pansements, examens, substituts… Tu choisis, l'app écrit. <b>Tout est imprimé</b> : la pharmacie ou le laboratoire n'a rien à déchiffrer.</span>
        <span class="pr-q">${PRESC_DOMAINES.length} domaines · ${n} référence(s) ›</span></span>
    </button>` : ""}

    <button class="pr-v" id="pr-vierge">
      <span class="pr-i">📄</span>
      <span class="pr-t"><b>Une feuille à remplir à la main</b>
        <span>Ton en-tête${p ? " et l'identité du patient" : ""}, les cadres aux bons endroits — et <b>le corps reste vide</b>. Tu écris toi-même après impression.</span>
        <span class="pr-q">Mise en page seule ›</span></span>
    </button>

    <div class="tip" style="margin-top:10px">Dans les deux cas, <b>✍️ Qui signe</b> reste à ta main, et rien n'est signé tant que tu n'as pas imprimé.</div>
    ${p ? "" : `<p class="small muted" style="margin-top:8px">Depuis la fiche d'un patient, le catalogue devient disponible et les documents sortent à son nom.</p>`}`);
  bindNav(() => p ? sheetPatient(p, "act") : sheetMoi());
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();
  { const b = $("#pr-cat"); if (b) b.onclick = () => sheetDispositifs(pid); }
  { const b = $("#pr-vierge");
    if (b) b.onclick = () => {
      /* L'ordonnance pré-imprimée existante : elle sait déjà sortir
         vierge, avec ou sans patient. */
      if (typeof sheetOrdonnance === "function") sheetOrdonnance(pid || null);
      else toast("Écran indisponible", "danger");
    }; }
}

/* ── Le catalogue, tous domaines confondus ──
   ⚠️ Les lignes du texte portent `fixe:true` : on peut les retirer de
   SA liste, jamais les réécrire. */
function prescListe(){
  const d = dispoData();
  const socle = PRESC_SOCLE
    .filter(x => !(d.retires || []).includes(x.n))
    .map(x => ({ ...x, fixe:true }));
  const plaies = dispoListe().map(x => ({ ...x, d:"plaies", dim:x.d, n:x.n, fixe:false }));
  return [...socle, ...plaies];
}
function prescParDomaine(){
  const l = prescListe();
  return PRESC_DOMAINES
    .map(dom => ({ ...dom,
      /* Les pansements se trient ; les domaines du texte gardent leur ordre. */
      items: dom.k === "plaies" ? trierRefs(l.filter(x => x.d === dom.k))
                                : l.filter(x => x.d === dom.k) }))
    .filter(g => g.items.length);
}

/* ⚠️ Taille et poids ne sont pas des champs du dossier : ils vivent
   dans les constantes d'un passage. Cette lecture ne sert plus qu'à
   SUGGÉRER une valeur dans l'invite du champ — jamais à la remplir :
   une mesure ancienne imprimée d'autorité serait trompeuse. */
function mesuresPatient(p){
  const r = { poids:"", taille:"", quand:"" };
  if (!p) return r;
  const vis = [...(p.visits || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  for (const v of vis){
    const c = v.consts || {};
    if (!r.poids && c.poids){ r.poids = c.poids + " kg"; r.quand = v.date; }
    if (!r.taille && c.taille) r.taille = c.taille + " cm";
    if (r.poids && r.taille) break;
  }
  return r;
}

/* L'invite du champ rappelle la dernière valeur connue, sans la saisir. */
function _mesureHint(p){
  const m = mesuresPatient(p);
  const d = m.quand ? " le " + m.quand.split("-").reverse().join("/") : "";
  return {
    taille: m.taille ? " — " + m.taille + d : "",
    poids:  m.poids  ? " — " + m.poids  + d : ""
  };
}

/* ============================================================
   L'EN-TÊTE DE L'ORDONNANCE, MODIFIABLE POUR CE DOCUMENT
   ─────────────────────────────────────────────────────────
   ⚠️ La feuille vierge permettait de corriger son en-tête, pas
   l'ordonnance composée depuis le catalogue. Un remplacement d'un jour,
   un numéro à ajuster : ça ne doit pas obliger à modifier sa fiche.

   ⚠️ LA MODIFICATION NE VAUT QUE POUR CE DOCUMENT. Elle n'écrit ni dans
   Ma fiche ni dans le cabinet — sinon une correction ponctuelle
   deviendrait définitive sans qu'on l'ait voulu.
============================================================ */
let _ordoEnteteMod = null, _ordoForme = "moi", _ordoTitulaire = null;

/* ⚠️ L'app PROPOSE les trois formes, elle ne dit pas laquelle est
   réglementaire pour une situation donnée — même ligne que « Qui
   signe » depuis la v1.1.0. */
function ordoMention(E){
  if (_ordoForme === "cab")
    return "Remplaçant du " + (E.cabinet || "cabinet");
  if (_ordoForme === "prat" && _ordoTitulaire && typeof cabContact === "function"){
    const t = cabContact(_ordoTitulaire);
    if (t) return "Remplaçant de " + t.nom
      + (t.metier ? ", " + t.metier : "")
      + (t.rpps ? " — RPPS " + t.rpps : "");
  }
  return "";
}

function ordoEntete(p){
  if (_ordoEnteteMod) return { ..._ordoEnteteMod, mention:ordoMention(_ordoEnteteMod) };
  const C = (typeof cabinetPourDoc === "function") ? cabinetPourDoc(p) : cabinet();
  const sig = (typeof signatureChoix === "function" && C.id) ? signatureChoix(C.id) : { mode:"moi" };
  const E = (typeof enteteDocument === "function") ? enteteDocument(sig, C) : {};
  return { ...E, mention:ordoMention(E) || E.mention || "" };
}

function sheetOrdoEntete(pid){
  const p = pid ? getP(pid) : null;
  const E = { ...ordoEntete(p) };
  const champ = (k, lbl, mode) => `
    <div class="lab" style="margin-top:9px">${esc(lbl)}</div>
    <input class="rec-in" data-oe="${k}" value="${esc(E[k] || "")}" inputmode="${mode || "text"}">`;

  openSheet(`
    ${navHeader("Ordonnance", true)}
    <h3>✍️ L'en-tête de ce document</h3>
    <p class="small muted" style="margin-bottom:10px">Repris de ta fiche et du cabinet du patient. Ce que tu changes ici ne vaut <b>que pour cette ordonnance</b>.</p>

    <!-- ⚠️ Trois formes au même endroit : « Qui signe » proposait déjà
         le remplacement d'un PRATICIEN nommé ; on y ajoute celui d'un
         CABINET, sans nommer personne, et on rassemble le tout ici. -->
    <div class="lab">Je signe en tant que</div>
    ${[["moi","Moi","Mon identité seule. Le cas courant."],
       ["cab","Je remplace ce cabinet","« Remplaçant du " + (E.cabinet || "cabinet") + " » sous mon titre."],
       ["prat","Je remplace un praticien","Nom, métier et RPPS du titulaire, choisi dans l'annuaire."]]
      .map(([k,l,d2]) => `<button class="pz-opt ${(_ordoForme || "moi") === k ? "on" : ""}" data-of="${k}"><b>${esc(l)}</b><span>${esc(d2)}</span></button>`).join("")}
    ${_ordoForme === "prat" && _ordoTitulaire
      ? `<p class="small muted" style="margin:-2px 0 8px">Titulaire : <b>${esc((cabContact(_ordoTitulaire)||{}).nom || "—")}</b></p>` : ""}

    ${champ("nom", "Nom")}
    ${champ("titre", "Titre")}
    ${champ("rpps", "N° RPPS / ADELI", "numeric")}
    ${champ("am", "N° AM (CPAM)", "numeric")}
    ${champ("cabinet", "Cabinet")}
    <div class="lab" style="margin-top:9px">Adresse</div>
    <textarea class="rec-in" data-oe="adresse" rows="2">${esc(E.adresse || "")}</textarea>
    ${champ("tel", "Téléphone", "tel")}
    ${champ("mail", "Courriel", "email")}

    <!-- ⚠️ Ce réglage-ci est DURABLE, contrairement au reste de cet
         écran : il vaut pour tous les documents. Dit à l'écran pour
         qu'on ne s'attende pas à l'inverse. -->
    <div class="lab" style="margin-top:16px">Trait sous le patient
      <span class="small muted" style="text-transform:none;letter-spacing:0"> — retenu pour tous tes documents</span></div>
    <div class="rowb" style="gap:6px">
      <button class="pz-opt ${S.ordoFilet === "parallele" ? "" : "on"}" data-ofil="miroir" style="flex:1">
        <b>En miroir</b><span>Plein à droite, estompé à gauche.</span></button>
      <button class="pz-opt ${S.ordoFilet === "parallele" ? "on" : ""}" data-ofil="parallele" style="flex:1">
        <b>Même sens</b><span>Plein à gauche, comme celui du haut.</span></button>
    </div>

    <button class="btn btn-primary" id="oe-ok" style="width:100%;margin-top:12px">✓ Utiliser pour ce document</button>
    ${_ordoEnteteMod ? `<button class="btn btn-ghost" id="oe-raz" style="width:100%;margin-top:7px">↺ Revenir à ma fiche</button>` : ""}
    <div class="tip" style="margin-top:10px">Pour changer ton en-tête <b>durablement</b>, passe par 👤 Ma fiche ou 🏥 Mon cabinet.</div>`);
  bindNav(() => sheetOrdoDispo(pid));
  $$("#sheet [data-of]").forEach(b => b.onclick = async () => {
    const k = b.dataset.of;
    if (k === "prat"){
      /* ⚠️ Le titulaire vient de l'annuaire du cabinet : on ne le tape
         pas à la main, sinon son RPPS serait saisi de mémoire. */
      const C2 = (typeof cabinetPourDoc === "function") ? cabinetPourDoc(p) : cabinet();
      const prats = (C2.contacts || []).filter(c => c.cat === "praticien" || c.rpps);
      if (!prats.length){ toast("Aucun praticien dans l'annuaire de ce cabinet"); return; }
      const ch = await askChoice({ ic:"👤", titre:"Qui remplaces-tu ?",
        options: prats.map(c => ({ lbl:c.nom + (c.metier ? " — " + c.metier : ""), val:c.id })) });
      if (!ch) return;
      _ordoTitulaire = ch;
    }
    _ordoForme = k;
    sheetOrdoEntete(pid);
  });
  $$("#sheet [data-ofil]").forEach(b => b.onclick = () => {
    S.ordoFilet = b.dataset.ofil === "parallele" ? "parallele" : "miroir";
    save(true); sheetOrdoEntete(pid);
  });
  { const b = $("#oe-ok");
    if (b) b.onclick = () => {
      $$("#sheet [data-oe]").forEach(e => { E[e.dataset.oe] = e.value.trim(); });
      _ordoEnteteMod = E;
      toast("En-tête appliqué à ce document");
      sheetOrdoDispo(pid);
    }; }
  { const b = $("#oe-raz");
    if (b) b.onclick = () => {
      _ordoEnteteMod = null;
      toast("En-tête repris de ta fiche");
      sheetOrdoDispo(pid);
    }; }
}
