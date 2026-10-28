/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   GUIDE DE PRESCRIPTION — notice informative
   ─────────────────────────────────────────────────────────
   Le cadre légal de la prescription infirmière, tel que l'utilisateur
   l'a lui-même établi. C'est une LECTURE, pas une donnée de soin.

   ⚠️ Ne touche JAMAIS un dossier : rien ne s'y rattache, rien n'en
   sort dans une relève. Ce n'est pas une information de patient.

   ⚠️ L'APPLICATION NE SUGGÈRE RIEN. Elle n'a jamais dit « pour cette
   plaie, prescris un alginate » et ne le dira pas : elle affiche un
   cadre, le soignant décide. C'est la même ligne que pour les
   constantes et les plaies — et c'est ce qui la tient hors du champ
   du dispositif médical.

   ⚠️ Contenu FIGÉ : il ne se modifie pas depuis l'app, pour qu'une
   fausse manœuvre n'efface pas ce travail. Une mise à jour passe par
   une nouvelle version.

   ⚠️ Daté : les textes changent. L'avertissement de tête le dit.
============================================================ */
const GUIDE_PRESC = [
  { n:0, titre:"0. Règles transversales : Statut infirmier remplaçant", blocs:[
    { t:"Sécurisation de l'ordonnance et mentions obligatoires", badge:"Procédure", type:"auto",
      champs:[
        ["Périmètre temporel", "Strictement limité aux dates effectives du contrat de remplacement enregistré au CDOI."],
        ["Support", "Ordonnance pré-imprimée du titulaire (conserver lisible le n° AM / code cabinet)."],
        ["Mentions requises", "Biffer le nom du titulaire, ajouter « Remplaçant de M./Mme [Nom] », nom, prénom, RPPS personnel , date du jour et signature manuscrite."],
        ["Traçabilité", "Dossier partagé du cabinet et Mon espace santé (DMP)."]
      ], alerte:"Attention : Toute prescription émise hors période contractuelle engage la responsabilité personnelle pour exercice illégal et expose à un refus de remboursement CPAM." }
  ]},
  { n:1, titre:"1. Perfusion et abords vasculaires", blocs:[
    { t:"Dispositifs d'administration IV/SC et sécurité", badge:"Conditionné", type:"cond",
      champs:[
        ["Champ d'action", "Perfuseurs, prolongateurs, robinets 3 voies, régulateurs, filtres, VVP (cathéters courts), aiguilles de Huber, seringues, aiguilles, boîtes DASRI."],
        ["Condition d'accès", "Présence obligatoire d'une prescription médicale active de soins de perfusion ou d'injection ."],
        ["Durée & Quantités", "Strictement calquées sur la durée du protocole médical de traitement (ex. : 7 jours d'antibiothérapie)."]
      ], alerte:"Verrou légal : L'infirmier ne prescrit jamais la molécule médicamenteuse ni les poches de soluté vecteur (NaCl 0,9 % ou G5 % pour perfusion IV)." }
  ]},
  { n:2, titre:"2. Plaies, pansements et cicatrisation", blocs:[
    { t:"Pansements actifs et dispositifs de fixation", badge:"Autonome", type:"auto",
      champs:[
        ["Champ d'action", "Hydrocellulaires, alginates, hydrogels, interfaces siliconées, pansements au charbon, à l'argent, absorbants, compresses, bandes, sparadraps."],
        ["Condition d'accès", "Sur ordonnance médicale d'un acte de pansement. Le choix de la classe technologique relève du rôle propre de l'infirmier."],
        ["Durée préconisée", "7 jours en phase d'évaluation / détersion, puis renouvelable par 15 à 30 jours selon l'évolution de la plaie."]
      ], alerte:"Alerte médicale : Recontacter le médecin traitant en cas de stagnation de cicatrisation après 21 jours ou suspicion de surinfection." },
    { t:"Solutions de nettoyage et antiseptiques d'appoint", badge:"Autonome", type:"auto",
      champs:[
        ["Champ d'action", "Sérum physiologique stérile (NaCl 0,9 %), eau stérile pour irrigation, antiseptiques cutanés nécessaires au soin local."],
        ["Bonne pratique", "Privilégier le lavage au sérum physiologique ou eau/savon doux ; réserver les antiseptiques aux plaies manifestement souillées ou infectées."]
      ] }
  ]},
  { n:3, titre:"3. Compression veineuse et phlébologie", blocs:[
    { t:"Chaussettes, bas, collants et bandes de contention", badge:"Autonome", type:"auto",
      champs:[
        ["Champ d'action", "Compression élastique classes 1 à 4, bandes à allongement court ou long, enfile-bas."],
        ["Condition d'accès", "Prescription initiale autonome possible avec obligation légale d'information du médecin traitant ."],
        ["Protocole de mesure", "Prise de mesures impérative le matin au lever (cheville, mollet, hauteur). Prescrire 2 paires pour le roulement de lavage."]
      ], alerte:"Contre-indications strictes : AOMI sévère (IPS < 0,6), microangiopathie diabétique avancée, phlébite bleue." }
  ]},
  { n:4, titre:"4. Troubles urinaires, continence et stomies", blocs:[
    { t:"Sondage vésical et étuis péniens", badge:"Conditionné", type:"cond",
      champs:[
        ["Condition d'accès", "Exige une prescription médicale de l'acte de pose ou d'apprentissage à l'autosondage. L'IDE calibre le matériel."],
        ["Durée", "Prescription initiale d'1 mois, puis renouvelable par périodes de 3 mois."]
      ] },
    { t:"Appareillage pour stomies digestives et urinaires", badge:"Autonome", type:"auto",
      champs:[
        ["Champ d'action", "Poches 1 ou 2 pièces, supports cutanés, pâtes barrières, anneaux, sprays protecteurs et de retrait d'adhésif."],
        ["Condition d'accès", "Stomie chirurgicale connue. Adaptation autonome selon diamètre de découpe et état péristomial."]
      ] }
  ]},
  { n:5, titre:"5. Prévention des escarres, maintien et mobilité", blocs:[
    { t:"Coussins anti-escarres et aides à la marche", badge:"Autonome", type:"auto",
      champs:[
        ["Champ d'action", "Coussins d'assise classe II (mousse viscoélastique, gel), surmatelas classe II, cannes simples/anglaises, déambulateurs, rollators, cerceaux de lit."],
        ["Prérequis clinique", "Évaluation et traçabilité d'un score de risque : Échelle de Braden ou de Norton . Notification au médecin traitant."]
      ], alerte:"Exclusions : Fauteuils roulants (manuels ou électriques) et matelas dynamiques motorisés à air continu restent de compétence médicale stricte." }
  ]},
  { n:6, titre:"6. Biologie médicale ciblée et examens", blocs:[
    { t:"Surveillance des pathologies chroniques (Diabète & AVK)", badge:"Autonome", type:"auto",
      champs:[
        ["Diabète", "Prescription de la glycémie à jeun, HbA1c (si non dosée dans les 3 mois précédents), créatininémie + DFG, albuminurie/créatininurie."],
        ["AVK", "Prescription ponctuelle de l'INR pour suivi de routine ou suspicion de déséquilibre / surdosage."],
        ["Durée", "Examens strictement ponctuels (pas de mention « à renouveler tous les mois »)."]
      ] },
    { t:"ECBU, dépistages IST et bêta-HCG", badge:"Autonome", type:"auto",
      champs:[
        ["ECBU", "Conditionné à des symptômes urinaires bas et une bandelette urinaire positive (leucocytes / nitrites)."],
        ["Dépistage & Grossesse", "Sérologies VIH, VHB, VHC, syphilis, chlamydia/gonocoque et dosage sanguin de bêta-HCG en accès direct."]
      ] }
  ]},
  { n:7, titre:"7. Médicaments de premiers soins et antalgiques palier I", blocs:[
    { t:"Paracétamol et Ibuprofène (Voie orale)", badge:"Autonome", type:"auto",
      champs:[
        ["Indications", "Douleur aiguë d'intensité faible à modérée (EVA 1 à 4) ou fièvre sans signes d'alerte."],
        ["Durée maximale", "3 à 5 jours consécutifs maximum . Aucun renouvellement tacite."],
        ["Vérifications", "Paracétamol : max 3 g/jour en automédication/IDE. Ibuprofène : contre-indiqué formellement en cas de grossesse > 24 SA, ulcère ou varicelle."]
      ] }
  ]},
  { n:8, titre:"8. Prévention vaccinale, tabacologie et santé reproductive", blocs:[
    { t:"Vaccination (Calendrier vaccinal)", badge:"Autonome", type:"auto",
      champs:[
        ["Public", "Personnes de 11 ans et plus (dès 5 ans pour la Covid-19)."],
        ["Vaccins autorisés", "DTP, Coqueluche, ROR, Hépatites A et B, HPV, Pneumocoque, Méningocoques, Zona, Grippe, Covid-19."],
        ["Traçabilité", "Enregistrement du numéro de lot, site et date dans Mon espace santé ou carnet de santé."]
      ], alerte:"Exclusion absolue : Interdiction de prescrire ou d'administrer des vaccins vivants atténués chez les personnes immunodéprimées sans ordonnance médicale préalable." },
    { t:"Sevrage tabagique (TSN)", badge:"Autonome", type:"auto",
      champs:[
        ["Public", "Dès 15 ans. Éligible aux femmes enceintes ou allaitantes après évaluation."],
        ["Formes", "Patchs, gommes, pastilles, comprimés sublinguaux, sprays buccaux."],
        ["Règle de prise en charge", "Ordonnance dédiée et exclusive (aucun autre matériel sur la feuille) pour remboursement Sécurité sociale à 65 %."]
      ] },
    { t:"Contraception hormonale & Urgence", badge:"Mixte", type:"cond",
      champs:[
        ["Pilule d'urgence", "Accès direct sans délai (Lévonorgestrel < 72 h ou Ulipristal < 120 h)."],
        ["Pilule contraceptive", "Renouvellement possible uniquement sur ordonnance médicale datant de moins d'un an , pour 6 mois maximum non renouvelables ."]
      ] }
  ]}
];

/* Le badge dit un statut ; la condition dit ce qu'il faut AVANT.
   « Conditionné » seul ne disait pas conditionné à quoi. */
function guideCondition(b){
  const c = (b.champs || []).find(([k]) => /condition/i.test(k));
  return c ? c[1] : "";
}

let _guideOuvert = null, _guideMot = "";

function sheetGuidePresc(mot){
  if (mot !== undefined) _guideMot = mot;
  const q = (_guideMot || "").trim().toLowerCase();
  const colle = m => (m.titre + " " + m.blocs.map(b =>
      b.t + " " + b.badge + " " + b.champs.map(c => c.join(" ")).join(" ") + " " + (b.alerte||"")
    ).join(" ")).toLowerCase();
  /* ⚠️ L'interrupteur « Guide mis à jour » choisit la source. L'ancienne
     version n'est jamais écrasée : elle revient dès qu'on éteint. */
  const _neuf = typeof essaiActif === "function" && essaiActif("guide26")
                && typeof GUIDE_PRESC_26 !== "undefined";
  const SRC = _neuf ? GUIDE_PRESC_26 : GUIDE_PRESC;
  const mods = q ? SRC.filter(m => colle(m).includes(q)) : SRC;
  /* Une recherche ouvre ce qu'elle trouve : sinon on filtre et on ne voit rien */
  const ouvert = m => q ? true : _guideOuvert === m.n;

  const bloc = b => `
    <div class="gp-b">
      <div class="gp-bh">
        <span style="flex:1;min-width:0">${esc(b.t)}</span>
        ${b.badge ? `<span class="gp-badge ${b.type === "cond" ? "cond" : "auto"}">${esc(b.badge)}</span>` : ""}
        ${/* ⚠️ Article 2 : toute prescription de l'arrêté s'inscrit au
              dossier patient ou au DMP. Sans exception, d'où le marqueur
              sur chaque bloc concerné. */
          b.dmp ? `<span class="gp-dmp" title="Article 2 de l'arrêté">📁 dossier</span>` : ""}
      </div>
      ${guideCondition(b) ? `<p class="gp-cond">${esc(guideCondition(b))}</p>` : ""}
      ${/* ⚠️ La condition est déjà remontée sous le badge : la répéter
            dans la liste ferait lire deux fois la même phrase. */
        b.champs.filter(([k]) => !/condition/i.test(k))
         .map(([k, v]) => `<p class="gp-c"><b>${esc(k)}</b> — ${esc(v)}</p>`).join("")}
      ${b.alerte ? `<div class="gp-al">${esc(b.alerte)}</div>` : ""}
    </div>`;

  openSheet(`
    ${navHeader("Retour", true)}
    ${_neuf && typeof essaiBandeau === "function" ? essaiBandeau("guide26") : ""}
    <h3>📋 Guide prescription</h3>
    <p class="small muted" style="margin-bottom:10px">Le cadre légal, pour toi. <b>Rien de ceci n'entre dans un dossier</b> ni ne part dans une relève.</p>

    <div class="warn">Document de travail, daté. <b>Vérifie les textes en vigueur avant de prescrire</b> : ta prescription t'engage. L'application affiche ce cadre, elle ne conseille rien.</div>
    ${/* ⚠️ La source et la date de lecture sont affichées : un guide
          réglementaire sans sa référence ne vaut rien. */
      _neuf && typeof GUIDE_SOURCE_26 !== "undefined" ? `
      <p class="small muted" style="margin:8px 0 0">Source : <b>${esc(GUIDE_SOURCE_26.titre)}</b> — ${esc(GUIDE_SOURCE_26.ref)}. Texte lu le ${esc(GUIDE_SOURCE_26.lu)}.</p>
      <p class="small muted" style="margin:4px 0 0">📁 signale les prescriptions à inscrire au dossier patient ou au DMP (article 2).</p>` : ""}

    <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin:12px 0 10px">
      <span>🔍</span>
      <input id="gp-q" class="rec-in" placeholder="Chercher — alginate, contention, HbA1c…"
        value="${esc(_guideMot)}" style="flex:1;min-width:0">
      ${q ? `<button class="chip sm" id="gp-clr" aria-label="Effacer">✕</button>` : ""}
    </div>
    ${q ? `<p class="small muted" style="margin-bottom:8px">${mods.length} chapitre(s) sur ${GUIDE_PRESC.length}</p>` : ""}

    ${mods.map(m => `
      <div class="gp-m ${ouvert(m) ? "ouv" : ""}">
        <button class="gp-h" data-gpm="${m.n}">
          <span style="flex:1;min-width:0;text-align:left">${esc(m.titre)}</span>
          <span class="gp-fl">▾</span>
        </button>
        <div class="gp-body" ${ouvert(m) ? "" : "hidden"}>${m.blocs.map(bloc).join("")}</div>
      </div>`).join("") || `<p class="muted small" style="padding:14px 0;text-align:center">Aucun chapitre ne contient ce mot.</p>`}`);
  bindNav();
  $$("#sheet [data-gpm]").forEach(b => b.onclick = () => {
    const n = +b.dataset.gpm;
    _guideOuvert = (_guideOuvert === n) ? null : n;
    sheetGuidePresc();
  });
  { const e = $("#gp-q");
    if (e) e.oninput = () => { clearTimeout(e._t);
      e._t = setTimeout(() => { sheetGuidePresc(e.value);
        const n = $("#gp-q"); if (n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 400); }; }
  { const c = $("#gp-clr"); if (c) c.onclick = () => sheetGuidePresc(""); }
}
