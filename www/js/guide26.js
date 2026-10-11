/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   GUIDE DE PRESCRIPTION — version relue sur le texte du 26 juin 2026
   ─────────────────────────────────────────────────────────
   Source : arrêté du 26 juin 2026 fixant la liste des produits de santé
   et examens complémentaires que les infirmiers diplômés d'État sont
   autorisés à prescrire ou à renouveler. NOR : SFHH2617311A, publié au
   Journal officiel du 27 juin 2026, annexes I et II comprises.

   ⚠️ CONTENU REPRIS DU TEXTE, pas d'une mémoire ni d'un résumé. Chaque
   ligne colle au vocabulaire de l'arrêté — « prescription »,
   « renouvellement », « à l'identique » ne sont pas interchangeables.

   ⚠️ L'APPLICATION NE SUGGÈRE RIEN et ne dit jamais qu'une prescription
   est conforme : elle affiche un cadre, le soignant décide. Même ligne
   que pour les constantes et les plaies.

   ⚠️ TROIS REPÈRES, repris du texte lui-même : Prescription (l'infirmier
   peut prescrire), Renouvellement (il reconduit une prescription
   existante), Les deux. Remplacent « Autonome / Conditionné », qui ne
   figurent pas dans l'arrêté.

   ⚠️ L'ARTICLE 2 S'APPLIQUE À TOUT : « Toute prescription mentionnée par
   le présent arrêté fait l'objet d'une inscription par l'infirmier au
   dossier patient ou au dossier médical partagé. » D'où le marqueur sur
   chaque bloc, sans exception.

   ⚠️ Ce qui ne vient PAS de cet arrêté n'y est pas rattaché : le bloc 0
   sur le statut de remplaçant relève d'autres textes, il est repris tel
   quel de la version précédente.

   ⚠️ Contenu figé : une mise à jour passe par une nouvelle version.
============================================================ */
const GUIDE_SOURCE_26 = {
  titre: "Arrêté du 26 juin 2026",
  ref: "NOR : SFHH2617311A — Journal officiel du 27 juin 2026",
  lu: "02/10/2026"
};

const GUIDE_PRESC_26 = [
  { n:0, titre:"0. Règles transversales : statut d'infirmier remplaçant", blocs:[
    { t:"Sécurisation de l'ordonnance et mentions obligatoires", badge:"Procédure", type:"auto", dmp:false,
      champs:[
        ["Périmètre temporel", "Strictement limité aux dates effectives du contrat de remplacement enregistré au CDOI."],
        ["Support", "Ordonnance pré-imprimée du titulaire (conserver lisible le n° AM / code cabinet)."],
        ["Mentions requises", "Biffer le nom du titulaire, ajouter « Remplaçant de M./Mme [Nom] », nom, prénom, RPPS personnel, date du jour et signature manuscrite."],
        ["Traçabilité", "Dossier partagé du cabinet et Mon espace santé (DMP)."],
        ["Hors de cet arrêté", "Ce bloc ne vient pas du texte du 26 juin 2026, qui fixe une liste de produits et non les modalités du remplacement."]
      ], alerte:"Toute prescription émise hors période contractuelle engage la responsabilité personnelle pour exercice illégal et expose à un refus de remboursement." }
  ]},

  { n:1, titre:"1. Vaccination", blocs:[
    { t:"Calendrier vaccinal, grippe et covid-19", badge:"Prescription", type:"auto", dmp:true,
      champs:[
        ["Calendrier vaccinal", "Ensemble des vaccins mentionnés au calendrier en vigueur, aux personnes de 11 ans et plus, selon les recommandations de ce calendrier."],
        ["Grippe saisonnière", "Personnes de 11 ans et plus, ciblées ou non par les recommandations vaccinales."],
        ["Covid-19", "Personnes de 5 ans et plus, ciblées ou non par les recommandations vaccinales."]
      ], alerte:"Exclusion : les vaccins vivants atténués chez les personnes immunodéprimées." },
    { t:"Déclaration préalable à l'ordre (annexe I)", badge:"Procédure", type:"cond", dmp:false,
      champs:[
        ["Déclaration", "L'infirmier déclare l'activité de prescription de vaccins auprès de l'autorité compétente du conseil de l'ordre au tableau duquel il est inscrit, par tout moyen donnant date certaine à la réception."],
        ["Contenu", "Nom et prénom d'exercice, et numéro d'identification au répertoire sectoriel de référence des personnes physiques."],
        ["Formation", "Si la prescription de vaccins n'a pas été vue en formation initiale, joindre une attestation de formation délivrée par un organisme respectant les objectifs pédagogiques fixés par arrêté."],
        ["Dispense", "Pas de formation exigée pour qui prescrit uniquement les vaccins contre la grippe saisonnière ou la covid-19."],
        ["Prise d'effet", "L'activité peut commencer dès la réception de la déclaration."]
      ], cond:"Déclaration préalable obligatoire avant toute prescription de vaccin." }
  ]},

  { n:2, titre:"2. Prévention et traitement de la plaie", blocs:[
    { t:"Supports anti-escarre et contention", badge:"Les deux", type:"auto", dmp:true,
      champs:[
        ["Supports d'escarre", "Matelas, sur-matelas, coussins, cales : à air statique ou dynamique, en gel, en mousse et gel, en mousse viscoélastique, en mousse structurée à modules amovibles ou à découpe en gaufrier."],
        ["Contention", "Collants, bas, chaussettes ou bandes de contention, avec prescription à l'identique de la force de compression."],
        ["Bonne pratique (hors texte)", "Prise de mesures le matin au lever (cheville, mollet, hauteur) ; deux paires pour le roulement de lavage."]
      ], alerte:"La force de compression se prescrit à l'identique : l'arrêté ne prévoit pas d'en changer." },
    { t:"Pansements et articles pour pansements", badge:"Prescription", type:"auto", dmp:true,
      champs:[
        ["Durée initiale", "Sept jours."],
        ["Pansements", "Hydrocolloïdes, hydrocellulaires, alginates, hydrogels, fibres à haut pouvoir d'absorption, hydrofibres, charbon actif, acide hyaluronique seul, interfaces (silicones et carboxyméthylcellulose), vaselinés, irrigo-absorbants, à l'argent, super-absorbants."],
        ["Compresses et gazes", "Compresses stériles de coton hydrophile à bords adhésifs ou non adhérentes, non tissées, de gaze hydrophile ; gaze non stérile ; compresses non stériles et non tissées ; coton hydrophile non stérile ; ouate de cellulose chirurgicale."],
        ["Fixation et maintien", "Pansements adhésifs stériles avec compresse intégrée ; sparadraps élastiques et non élastiques ; filets et jerseys tubulaires ; bandes de crêpe en coton avec ou sans élastomère ; bandes extensibles tissées ou tricotées ; bandes de crêpe en laine ; films adhésifs semi-perméables."],
        ["Autres", "Pansements et compresses stériles absorbants non adhérents pour plaies productives ; sets pour plaies ; matériel d'aide à la détersion ; produits hémostatiques dont compresses de collagène ; champ stérile ; dispositifs de rapprochement cutané adhésifs."]
      ] },
    { t:"Produits de santé pour la plaie", badge:"Prescription", type:"cond", dmp:true,
      champs:[
        ["Sprays protecteurs cutanés", "Prescription."],
        ["Anesthésiques locaux", "Toute forme galénique, en dehors de la forme injectable."],
        ["Antiseptiques à large spectre", "À l'exclusion de tout produit contenant un antibiotique, et uniquement dans les cinq premiers jours après l'apparition d'une plaie par brûlure ou d'une plaie traumatique avec souillures."],
        ["Nitrate d'argent", "En cas d'hyperbourgeonnement, à faible dosage."]
      ],
      cond:"Antiseptiques : fenêtre de cinq jours, aucun produit contenant un antibiotique, et hors plaie du pied diabétique.",
      alerte:"La plaie du pied diabétique est explicitement exclue du champ des antiseptiques." }
  ]},

  { n:3, titre:"3. Santé sexuelle et reproductive", blocs:[
    { t:"Contraception, préservatifs, dépistages", badge:"Les deux", type:"cond", dmp:true,
      champs:[
        ["Contraceptifs oraux", "Renouvellement d'une prescription datant de moins d'un an, pour six mois au maximum, non renouvelable — sauf s'ils figurent sur une liste fixée par arrêté du ministre chargé de la santé, sur proposition de l'ANSM."],
        ["Préservatifs", "Prescription."],
        ["Contraceptifs d'urgence", "Prescription."],
        ["Bêta-HCG", "Prescription du dosage pour confirmation et datation de grossesse."],
        ["Dépistages", "Tests de dépistage de pathologies transmissibles : VIH, hépatites B et C, syphilis, chlamydia et gonocoque."]
      ], cond:"Le renouvellement d'un contraceptif oral suppose une prescription de moins d'un an." },
    { t:"Mentions à porter sur l'ordonnance (annexe II)", badge:"Procédure", type:"cond", dmp:false,
      champs:[
        ["Où", "Sur l'original de l'ordonnance médicale."],
        ["Quoi", "Nom, prénom et numéro obtenu lors de l'enregistrement prévu à l'article L. 4311-15 ; la mention « Renouvellement infirmier » ; la durée du renouvellement en mois, sans excéder six ; la date à laquelle il est effectué."]
      ], cond:"Ces quatre mentions accompagnent tout renouvellement de contraceptif oral." }
  ]},

  { n:4, titre:"4. Sevrage tabagique", blocs:[
    { t:"Substituts nicotiniques et bilan sanguin", badge:"Prescription", type:"auto", dmp:true,
      champs:[
        ["Substituts nicotiniques", "Prescription."],
        ["Bilan sanguin", "Cholestérol, triglycérides et glycémie à jeun, pour évaluer les facteurs de risque biologiques cardiovasculaires."]
      ] }
  ]},

  { n:5, titre:"5. Produits de santé : médicaments et solutions", blocs:[
    { t:"Antalgiques et adaptation de posologie", badge:"Prescription", type:"auto", dmp:true,
      champs:[
        ["Antalgiques", "Palier I selon la classification de l'Organisation mondiale de la santé, y compris dans les indications antipyrétiques."],
        ["Adaptation de posologie", "Selon les indications mentionnées dans la prescription initiale, dans le domaine de la prise en charge de la douleur."],
        ["Vérifications (hors texte)", "Rappel de bonne pratique : respecter les doses maximales, les contre-indications et la durée utile."]
      ], alerte:"L'adaptation de posologie s'appuie sur une prescription initiale : elle n'en crée pas une." },
    { t:"Solutions stériles", badge:"Prescription", type:"auto", dmp:true,
      champs:[
        ["Solutions stériles", "Prescription de solutions stériles et de produits antiseptiques."],
        ["Sérum physiologique", "Prescription de sérum physiologique à prescription médicale facultative."]
      ] }
  ]},

  { n:6, titre:"6. Dispositifs médicaux (hors plaie)", blocs:[
    { t:"Mobilité, lit et transfert", badge:"Les deux", type:"auto", dmp:true,
      champs:[
        ["Cerceaux de lit", "Prescription et renouvellement."],
        ["Béquilles et cannes", "Location."],
        ["Soulève-malade", "Mécanique ou électrique."]
      ] },
    { t:"Incontinence et appareil urogénital", badge:"Les deux", type:"auto", dmp:true,
      champs:[
        ["Recueil", "Étui pénien, joint et raccord ; plat bassin et urinal."],
        ["Incontinents et stomisés", "Dispositifs et accessoires communs : poches, raccord, filtre, tampon, supports avec ou sans anneau de gomme, ceinture, clamp, pâte pour protection péristomiale, tampon absorbant, bouchon de matières fécales, collecteur d'urines et de matières fécales."],
        ["Irrigation", "Dispositifs pour colostomisés pratiquant l'irrigation ; nécessaires pour irrigation colique."],
        ["Sondage vésical", "Sondes pour autosondage et hétérosondage ; renouvellement des sondes à demeure."]
      ] },
    { t:"Perfusion à domicile", badge:"Les deux", type:"auto", dmp:true,
      champs:[
        ["Appareils et accessoires", "Appareil à perfusion stérile non réutilisable ; panier de perfusion ; perfuseur de précision ; accessoires à usage unique de remplissage du perfuseur ou du diffuseur portable ; accessoires à usage unique pour pose au bras en l'absence de cathéter implantable."],
        ["Chambre et cathéter central", "Aiguilles pour chambre à cathéter implantable ; aiguille, adhésif transparent, prolongateur, robinet à trois voies ; pansements de maintien du cathéter central ou profond."],
        ["Entretien et rinçage", "Accessoires stériles non réutilisables pour hépariner, entretenir ou rincer : seringues ou aiguilles adaptées, prolongateur, robinet à trois voies."],
        ["Support", "Pieds et potences à sérum à roulettes."]
      ] },
    { t:"Nutrition entérale", badge:"Les deux", type:"auto", dmp:true,
      champs:[
        ["Sondes", "Sonde naso-gastrique ou naso-entérale pour nutrition entérale à domicile."],
        ["Matériel", "Renouvellement de matériel pour nutrition entérale."]
      ] },
    { t:"Renouvellements à l'identique", badge:"Renouvellement", type:"cond", dmp:true,
      champs:[
        ["Orthèses de contention", "Bas (jambe, cuisse), chaussettes et suppléments associés — dans le cadre d'un renouvellement à l'identique."],
        ["Surveillance glycémique", "Lancettes ; bandelettes d'autosurveillance ; autopiqueurs à usage unique ; seringues avec aiguilles pour autotraitement ; aiguilles non réutilisables pour stylo injecteur ; ensemble stérile non réutilisable (aiguilles et réservoir) ; embout perforateur stérile ; dispositifs de mesure du glucose interstitiel (capteurs et lecteurs)."]
      ],
      cond:"À l'identique de la prescription initiale.",
      alerte:"Pour dispenser un produit renouvelé à l'identique, le pharmacien doit pouvoir consulter la prescription initiale par tout moyen de traçabilité disponible (article 3)." }
  ]},

  { n:7, titre:"7. Examens biologiques et bactériologiques", blocs:[
    { t:"INR sous antivitamine K", badge:"Renouvellement", type:"cond", dmp:true,
      champs:[
        ["Règle", "Renouvellement une fois du dosage de l'INR dans le cadre d'un traitement sous AVK."],
        ["Déséquilibre", "Lors du constat d'un déséquilibre de l'INR, renouvellement pendant quelques jours du dosage."]
      ], cond:"Un renouvellement, sauf déséquilibre constaté." },
    { t:"Examens courants", badge:"Prescription", type:"cond", dmp:true,
      champs:[
        ["NFS, plaquettes, ionogramme", "Dans le cadre d'une pathologie connue ou de symptômes évocateurs d'une pathologie."],
        ["ECBU", "Avec antibiogramme si nécessaire."],
        ["Glycémie", "À jeun, ou dans un contexte d'urgence en cas de déséquilibre du diabète et d'hypoglycémie."]
      ], cond:"Les examens courants supposent une pathologie connue ou des symptômes évocateurs." },
    { t:"Suivi du patient diabétique", badge:"Prescription", type:"cond", dmp:true,
      champs:[
        ["Examens", "Créatininémie, dosage albuminurie/créatininurie sur échantillon, HbA1c."],
        ["Conditions", "Uniquement pour les patients diabétiques connus, et si ces examens n'ont pas déjà été prescrits dans les trois derniers mois."]
      ], cond:"Patients diabétiques connus, et pas d'examen déjà prescrit dans les trois derniers mois." }
  ]}
];
