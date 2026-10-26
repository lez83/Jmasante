/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   FICHES DE RAPPEL — ce que mesure une analyse
   ─────────────────────────────────────────────────────────
   Un rappel de cours, consultable quand on en a besoin. Deux voix :
   celle du soignant, et des mots simples pour expliquer de vive voix.

   ⚠️ CE N'EST PAS UNE AIDE AU DIAGNOSTIC, et le cadre posé par
   l'utilisateur est repris tel quel à l'écran : ces fiches reprennent
   les valeurs UNE PAR UNE, sans les croiser entre elles ni avec l'état
   clinique. Un résultat ne se lit jamais seul. L'infirmier ne pose pas
   de diagnostic médical.

   ⚠️ AUCUNE CONDUITE À TENIR. On écrit ce qu'une valeur peut traduire,
   jamais ce qu'il faut faire. « Kaliémie basse → donner du potassium »
   n'existera pas ici : ce serait de la prescription, et l'app
   changerait de nature.

   ⚠️ AUCUN LIEN AVEC LES BILANS D'UN PATIENT. L'app ne lit aucun
   résultat, ne compare rien, n'alerte sur rien. C'est un livre ouvert
   sur une étagère, pas un outil qui regarde par-dessus l'épaule.

   ⚠️ LA VERSION PATIENT NE S'IMPRIME PAS et ne se remet pas : remettre
   une feuille qui explique des analyses reviendrait à se substituer au
   médecin qui les a prescrites. Elle sert à trouver ses mots à l'oral.

   ⚠️ La rubrique « au prélèvement » est celle qui sert le plus : c'est
   là que le geste infirmier change le résultat.
============================================================ */

const BILAN_FICHES = {
  "Hémoglobine": {
    mesure:"La quantité d'hémoglobine dans le sang, protéine des globules rouges qui transporte l'oxygène.",
    bas:"Anémie : carence en fer, en folates ou en B12, saignement aigu ou chronique, maladie rénale, inflammation prolongée, hémolyse.",
    haut:"Déshydratation (hémoconcentration), polyglobulie, tabagisme ancien, séjour prolongé en altitude, maladie respiratoire chronique.",
    prel:"Un prélèvement bras levé ou après une perfusion en cours du même côté dilue l'échantillon. Garrot bref.",
    patient:"L'hémoglobine, c'est ce qui transporte l'oxygène dans le sang. Quand elle baisse, on se sent souvent fatigué, essoufflé au moindre effort. C'est pour ça qu'on la surveille."
  },
  "Hématocrite": {
    mesure:"La part du volume sanguin occupée par les globules rouges, en pourcentage.",
    bas:"Les mêmes causes qu'une hémoglobine basse, ou une dilution (hyperhydratation, perfusion abondante).",
    haut:"Déshydratation surtout, polyglobulie.",
    prel:"Très sensible à l'état d'hydratation : un même patient varie d'un jour à l'autre.",
    patient:"C'est la proportion de globules rouges dans le sang. Ça monte quand on manque d'eau, ça descend quand on est anémié."
  },
  "Globules rouges": {
    mesure:"Le nombre de globules rouges par unité de volume.",
    bas:"Anémie, saignement, hémolyse, insuffisance médullaire.",
    haut:"Déshydratation, polyglobulie, hypoxie chronique.",
    prel:"Se lit avec l'hémoglobine et le VGM : le nombre seul dit peu de chose.",
    patient:"Ce sont les cellules qui transportent l'oxygène. On compte combien il y en a dans une petite quantité de sang."
  },
  "VGM": {
    mesure:"Le volume moyen d'un globule rouge. C'est lui qui oriente le type d'anémie.",
    bas:"Microcytose : carence en fer, thalassémie, inflammation chronique.",
    haut:"Macrocytose : carence en B12 ou folates, alcool, hypothyroïdie, certains médicaments.",
    prel:"Stable, peu sensible aux conditions de prélèvement.",
    patient:"C'est la taille moyenne des globules rouges. Trop petits ou trop gros, ça oriente le médecin sur la cause d'une anémie."
  },
  "Leucocytes": {
    mesure:"Le nombre total de globules blancs, cellules de défense de l'organisme.",
    bas:"Infection virale, certains médicaments, chimiothérapie, atteinte médullaire, hypersplénisme.",
    haut:"Infection bactérienne, inflammation, corticoïdes, stress aigu, tabac, hémopathie.",
    prel:"Monte après un effort, un stress ou une émotion forte. Un chiffre isolé se relit au calme.",
    patient:"Ce sont les globules blancs, les cellules qui défendent contre les infections. Ils montent souvent quand on se bat contre un microbe."
  },
  "Polynucléaires neutrophiles": {
    mesure:"La population de globules blancs la plus impliquée dans la défense contre les bactéries.",
    bas:"Neutropénie : chimiothérapie, certains médicaments, infection virale, atteinte médullaire. En dessous d'un certain seuil, le risque infectieux augmente nettement.",
    haut:"Infection bactérienne, inflammation, corticoïdes, stress.",
    prel:"Même remarque que pour les leucocytes.",
    patient:"C'est la partie des globules blancs qui s'occupe surtout des bactéries."
  },
  "Lymphocytes": {
    mesure:"Les globules blancs de la défense virale et de la mémoire immunitaire.",
    bas:"Infection virale aiguë, corticoïdes, immunodépression, dénutrition.",
    haut:"Infection virale, coqueluche, certaines hémopathies. Normalement plus élevés chez l'enfant.",
    prel:"Rien de particulier.",
    patient:"Ce sont les globules blancs qui s'occupent surtout des virus et qui gardent la mémoire des infections passées."
  },
  "Plaquettes": {
    mesure:"Les cellules qui amorcent la coagulation en formant le premier bouchon.",
    bas:"Thrombopénie : virose, médicaments dont l'héparine, maladie du foie, hypersplénisme, atteinte médullaire. Le risque de saignement augmente quand elles chutent franchement.",
    haut:"Inflammation, carence en fer, après une splénectomie, syndrome myéloprolifératif.",
    prel:"⚠️ Un tube EDTA mal homogénéisé fait s'agréger les plaquettes : le compteur en voit moins qu'il n'y en a. Une thrombopénie isolée et inattendue se recontrôle avant tout.",
    patient:"Les plaquettes servent à arrêter les saignements. Quand il n'y en a pas assez, on saigne plus facilement — des bleus, les gencives."
  },
  "Sodium": {
    mesure:"Le sodium du plasma. Il reflète surtout l'équilibre entre l'eau et le sel, donc l'hydratation.",
    bas:"Hyponatrémie : excès d'eau le plus souvent (insuffisance cardiaque, cirrhose, SIADH), diurétiques, pertes digestives. Chez la personne âgée, elle se manifeste parfois par une confusion.",
    haut:"Hypernatrémie : manque d'eau avant tout — apports insuffisants, fièvre, canicule, pertes digestives.",
    prel:"Rien de particulier.",
    patient:"Le sodium, c'est le sel du sang. Il dit surtout si on boit assez ou trop. Chez les personnes âgées, un déséquilibre peut rendre confus."
  },
  "Potassium": {
    mesure:"Le potassium du plasma. L'essentiel du stock est à l'intérieur des cellules : la kaliémie n'en reflète qu'une petite part.",
    bas:"Hypokaliémie : diurétiques, vomissements, diarrhée, laxatifs, dénutrition. Retentit sur le rythme cardiaque et la force musculaire.",
    haut:"Hyperkaliémie : insuffisance rénale, IEC et sartans, diurétiques épargneurs, acidose, destruction cellulaire.",
    prel:"⚠️ La valeur la plus faussée par le geste. Garrot trop serré ou trop long, poing serré, hémolyse du tube, délai avant analyse : tous font MONTER le résultat. Devant une hyperkaliémie inattendue, la première question est celle du prélèvement.",
    patient:"Le potassium est un sel minéral qui aide le cœur et les muscles à bien fonctionner. Il doit rester dans une fourchette étroite. Certains médicaments pour la tension le font bouger, d'où les contrôles."
  },
  "Chlore": {
    mesure:"Le chlore plasmatique, qui accompagne le sodium dans l'équilibre des sels.",
    bas:"Vomissements, diurétiques, certaines alcaloses.",
    haut:"Déshydratation, acidoses, apports salés importants.",
    prel:"Rien de particulier.",
    patient:"Un autre sel du sang, qui va souvent de pair avec le sodium."
  },
  "Bicarbonates": {
    mesure:"La réserve alcaline : la capacité du sang à tamponner les acides.",
    bas:"Acidose métabolique : insuffisance rénale, diabète déséquilibré, diarrhée, état de choc.",
    haut:"Alcalose : vomissements prolongés, diurétiques, rétention de CO₂ compensée.",
    prel:"Un tube resté ouvert ou un délai long fait baisser la valeur.",
    patient:"C'est ce qui équilibre l'acidité du sang."
  },
  "Calcium total": {
    mesure:"Le calcium circulant, en grande partie lié à l'albumine.",
    bas:"Carence en vitamine D, insuffisance rénale, hypoparathyroïdie — ou simplement une albumine basse, sans vrai manque de calcium.",
    haut:"Hyperparathyroïdie, cancers, immobilisation prolongée, excès de vitamine D.",
    prel:"⚠️ S'interprète avec l'albumine : une albumine basse abaisse le calcium total sans que le calcium actif soit touché.",
    patient:"Le calcium sert aux os, aux muscles et au cœur. Son taux dans le sang dépend aussi d'autres protéines, donc on le lit avec d'autres résultats."
  },
  "Magnésium": {
    mesure:"Le magnésium plasmatique, lui aussi majoritairement intracellulaire.",
    bas:"Pertes digestives, diurétiques, alcool, dénutrition. Souvent associé à une hypokaliémie qui résiste.",
    haut:"Insuffisance rénale, apports excessifs.",
    prel:"Rien de particulier.",
    patient:"Un minéral utile aux muscles et au système nerveux."
  },
  "Créatinine": {
    mesure:"Un déchet du muscle, éliminé par le rein. Sa montée signale que le rein filtre moins bien.",
    bas:"Faible masse musculaire, dénutrition, grossesse. Une créatinine basse chez une personne très maigre peut masquer une fonction rénale altérée.",
    haut:"Insuffisance rénale aiguë ou chronique, déshydratation, certains médicaments. Monte aussi après un effort musculaire intense.",
    prel:"Rien de particulier, mais le chiffre brut se lit toujours avec le débit de filtration estimé.",
    patient:"C'est un déchet que les reins éliminent. S'il s'accumule, c'est que les reins filtrent moins bien. On le surveille surtout avec certains médicaments."
  },
  "Urée": {
    mesure:"Un déchet de la dégradation des protéines, éliminé par le rein.",
    bas:"Dénutrition, maladie du foie, grossesse.",
    haut:"Insuffisance rénale, déshydratation, régime très riche en protéines, saignement digestif, corticoïdes.",
    prel:"Rien de particulier.",
    patient:"Un autre déchet filtré par les reins. Il monte aussi quand on manque d'eau."
  },
  "DFG estimé": {
    mesure:"Le débit de filtration glomérulaire estimé par une formule, à partir de la créatinine, de l'âge et du sexe. C'est lui qui classe la maladie rénale.",
    bas:"Une baisse durable définit l'insuffisance rénale chronique et impose d'adapter la posologie de nombreux médicaments.",
    haut:"Rarement interprété comme anormal chez l'adulte.",
    prel:"Une estimation, pas une mesure : peu fiable aux âges extrêmes, chez le patient très maigre ou très musclé, et en cas de variation rapide de la créatinine.",
    patient:"C'est une estimation de la capacité de filtration des reins, calculée à partir de la créatinine et de l'âge."
  },
  "ASAT (SGOT)": {
    mesure:"Une enzyme présente dans le foie, mais aussi dans le muscle et le cœur.",
    bas:"Sans signification particulière.",
    haut:"Atteinte hépatique, mais aussi effort musculaire intense, traumatisme musculaire, hémolyse.",
    prel:"Une hémolyse du tube fait monter le résultat.",
    patient:"Une enzyme du foie, qu'on retrouve aussi dans les muscles."
  },
  "ALAT (SGPT)": {
    mesure:"Une enzyme beaucoup plus spécifique du foie que l'ASAT.",
    bas:"Sans signification particulière.",
    haut:"Hépatite virale, médicamenteuse ou toxique, stéatose, obstacle biliaire.",
    prel:"Rien de particulier.",
    patient:"Une enzyme surtout présente dans le foie : si elle monte, on regarde du côté du foie."
  },
  "Gamma-GT": {
    mesure:"Une enzyme hépatique et biliaire, très sensible mais peu spécifique.",
    bas:"Sans signification particulière.",
    haut:"Alcool, médicaments inducteurs, obstacle biliaire, stéatose, surpoids.",
    prel:"Rien de particulier.",
    patient:"Une enzyme du foie, sensible à beaucoup de choses — l'alcool, certains médicaments, le surpoids."
  },
  "Bilirubine totale": {
    mesure:"Le pigment issu de la destruction des globules rouges, éliminé par le foie.",
    bas:"Sans signification particulière.",
    haut:"Ictère : obstacle biliaire, hépatite, hémolyse, ou maladie de Gilbert, bénigne et fréquente.",
    prel:"Sensible à la lumière : le tube ne doit pas rester exposé.",
    patient:"C'est ce qui donne la couleur jaune quand il y en a trop — ce qu'on appelle la jaunisse."
  },
  "Albumine": {
    mesure:"La principale protéine du sang, fabriquée par le foie. Un marqueur de l'état nutritionnel et hépatique.",
    bas:"Dénutrition, maladie du foie, syndrome néphrotique, inflammation prolongée. Favorise les œdèmes.",
    haut:"Essentiellement la déshydratation.",
    prel:"Rien de particulier.",
    patient:"Une protéine fabriquée par le foie. Quand elle baisse, on peut gonfler des jambes, et c'est souvent lié à l'alimentation."
  },
  "Glycémie à jeun": {
    mesure:"Le taux de sucre dans le sang après au moins huit heures sans manger.",
    bas:"Hypoglycémie : insuline ou sulfamides, jeûne prolongé, alcool, insuffisance surrénale.",
    haut:"Diabète ou prédiabète, stress aigu, corticoïdes, infection.",
    prel:"⚠️ Le jeûne doit être réel : un café sucré fausse tout. Et sans tube fluoré, un délai long avant analyse fait baisser le résultat.",
    patient:"C'est le taux de sucre dans le sang, mesuré le matin avant d'avoir mangé."
  },
  "HbA1c": {
    mesure:"La part d'hémoglobine sur laquelle du sucre s'est fixé : le reflet des glycémies des deux à trois derniers mois.",
    bas:"Anémie hémolytique, saignement récent, transfusion — le chiffre est alors faussement rassurant.",
    haut:"Déséquilibre du diabète sur la durée.",
    prel:"Pas besoin d'être à jeun. ⚠️ Ininterprétable en cas d'hémoglobinopathie ou d'anémie importante.",
    patient:"C'est la mémoire du sucre dans le sang sur deux à trois mois. Une seule prise de sang, mais elle raconte toute la période."
  },
  "Cholestérol total": {
    mesure:"L'ensemble du cholestérol circulant, toutes fractions confondues.",
    bas:"Dénutrition, hyperthyroïdie, maladie du foie.",
    haut:"Alimentation, hérédité, hypothyroïdie, syndrome néphrotique. Se lit avec le LDL et le HDL : le total seul dit peu.",
    prel:"À jeun pour le bilan complet, selon les habitudes du laboratoire.",
    patient:"C'est une graisse du sang. Ce qui compte n'est pas tant le total que la répartition entre le « bon » et le « mauvais »."
  },
  "Triglycérides": {
    mesure:"Les graisses du sang, très sensibles à l'alimentation récente.",
    bas:"Rarement interprété.",
    haut:"Repas récent, alcool, diabète déséquilibré, surpoids, hérédité.",
    prel:"⚠️ Un repas ou de l'alcool la veille fait grimper le résultat. Le jeûne compte ici plus qu'ailleurs.",
    patient:"Des graisses du sang, très influencées par ce qu'on a mangé la veille — d'où l'importance d'être à jeun."
  },
  "TP": {
    mesure:"Le taux de prothrombine : l'efficacité d'une partie de la coagulation, exprimée en pourcentage d'un témoin.",
    bas:"Traitement par AVK, maladie du foie, carence en vitamine K, CIVD.",
    haut:"Sans signification particulière.",
    prel:"⚠️ Tube citraté à remplir jusqu'au trait. Un tube incomplet fausse le rapport et donne un résultat ininterprétable.",
    patient:"Ça mesure la vitesse à laquelle le sang coagule."
  },
  "INR (hors traitement)": {
    mesure:"Le TP exprimé de façon standardisée, comparable d'un laboratoire à l'autre.",
    bas:"Sans signification particulière hors traitement.",
    haut:"Allongement de la coagulation : AVK, maladie du foie, carence en vitamine K.",
    prel:"⚠️ Même exigence : tube citraté rempli au trait, homogénéisé sans agiter, acheminé sans délai.",
    patient:"C'est une façon standardisée de mesurer la coagulation, pour que le résultat soit comparable partout."
  },
  "INR sous AVK": {
    mesure:"Le même indicateur, suivi pour ajuster le traitement anticoagulant.",
    bas:"En dessous de la cible : protection insuffisante contre la thrombose.",
    haut:"Au-dessus de la cible : risque hémorragique accru.",
    prel:"⚠️ Le tube citraté mal rempli est l'erreur la plus fréquente et la plus lourde de conséquences chez un patient sous AVK. La cible est fixée par le prescripteur, pas par une norme générale.",
    patient:"C'est le contrôle de votre anticoagulant. Le médecin vous a fixé une fourchette à respecter : en dessous ça protège moins, au-dessus on saigne plus facilement."
  },
  "Fibrinogène": {
    mesure:"Une protéine de la coagulation, également marqueur d'inflammation.",
    bas:"CIVD, maladie du foie, fibrinolyse.",
    haut:"Inflammation, infection, grossesse, tabac.",
    prel:"Même tube citraté, mêmes exigences.",
    patient:"Une protéine qui sert à la coagulation, et qui monte aussi quand il y a de l'inflammation."
  },
  "CRP": {
    mesure:"La protéine C réactive, marqueur d'inflammation qui monte vite et redescend vite.",
    bas:"Valeur normale, sans signification particulière.",
    haut:"Infection, inflammation, traumatisme, chirurgie récente, cancer. L'ampleur ne distingue pas à elle seule une cause d'une autre.",
    prel:"Rien de particulier. Monte en quelques heures et suit l'évolution de près, contrairement à la VS.",
    patient:"C'est un marqueur d'inflammation. Il monte vite quand il se passe quelque chose, et redescend vite quand ça s'arrange."
  },
  "VS à la 1ʳᵉ heure": {
    mesure:"La vitesse de sédimentation : le temps que mettent les globules rouges à tomber dans un tube.",
    bas:"Polyglobulie, certaines anomalies des globules rouges.",
    haut:"Inflammation, infection, anémie, grossesse, âge avancé, myélome. Beaucoup moins spécifique que la CRP.",
    prel:"Monte et descend lentement : inadaptée à un suivi rapproché.",
    patient:"Un marqueur d'inflammation plus ancien et plus lent que la CRP."
  },
  "TSH": {
    mesure:"L'hormone qui commande la thyroïde. C'est le premier examen du dépistage thyroïdien.",
    bas:"Hyperthyroïdie le plus souvent, ou surdosage d'un traitement substitutif.",
    haut:"Hypothyroïdie, ou dosage insuffisant d'un traitement substitutif.",
    prel:"⚠️ Varie selon l'heure. Le traitement substitutif se prend après le prélèvement, pas avant.",
    patient:"La TSH est l'hormone qui donne ses ordres à la thyroïde. Quand elle est haute, c'est souvent que la thyroïde fonctionne au ralenti."
  },
  "T4 libre": {
    mesure:"L'hormone thyroïdienne circulante sous sa forme active.",
    bas:"Hypothyroïdie.",
    haut:"Hyperthyroïdie, surdosage.",
    prel:"Se lit avec la TSH : l'une sans l'autre prête à confusion.",
    patient:"C'est l'hormone produite par la thyroïde elle-même."
  },
  "Ferritine": {
    mesure:"La forme de stockage du fer. Le meilleur reflet des réserves.",
    bas:"Carence en fer — c'est le signe le plus précoce et le plus fiable.",
    haut:"Inflammation, maladie du foie, alcool, surcharge en fer. ⚠️ Une inflammation peut la faire monter et masquer une carence réelle.",
    prel:"Rien de particulier.",
    patient:"C'est la réserve de fer de l'organisme. Quand elle est basse, les réserves sont vides, même si l'hémoglobine tient encore."
  },
  "Vitamine B12": {
    mesure:"Une vitamine indispensable à la fabrication des globules rouges et au système nerveux.",
    bas:"Carence d'apport (régime sans produits animaux), malabsorption, maladie de Biermer, metformine au long cours, chirurgie gastrique.",
    haut:"Rarement interprété comme anormal.",
    prel:"Rien de particulier.",
    patient:"Une vitamine qu'on trouve surtout dans les produits animaux. Elle est nécessaire aux globules rouges et aux nerfs."
  },
  "Phosphore": {
    mesure:"Le phosphore plasmatique, lié au métabolisme osseux et au fonctionnement du rein.",
    bas:"Dénutrition, alcoolisme, renutrition rapide après un jeûne prolongé, hyperparathyroïdie, certains traitements chélateurs.",
    haut:"Insuffisance rénale au premier chef, hypoparathyroïdie, destruction cellulaire importante.",
    prel:"L'hémolyse du tube fait monter le résultat : le phosphore est abondant dans les cellules.",
    patient:"Un minéral qui travaille avec le calcium pour les os. Son taux dépend beaucoup du fonctionnement des reins."
  },
  "Albuminurie / créatininurie": {
    mesure:"Le rapport entre l'albumine et la créatinine dans un échantillon d'urines. Il dépiste une fuite de protéines par le rein, bien avant que la créatinine du sang ne bouge.",
    bas:"Valeur normale, sans signification particulière.",
    haut:"Atteinte rénale débutante, souvent liée au diabète ou à l'hypertension. Peut aussi monter transitoirement après un effort, une fièvre ou une infection urinaire.",
    prel:"⚠️ Sur échantillon, de préférence le matin. Une infection urinaire, des règles ou un effort récent faussent le résultat : on recontrôle à distance avant de conclure.",
    patient:"C'est une recherche de protéines dans les urines. Quand le rein commence à fatiguer, il en laisse passer un peu — et ça se voit là bien avant le reste."
  },
  "Phosphatases alcalines": {
    mesure:"Une enzyme présente surtout dans le foie, les voies biliaires et l'os.",
    bas:"Rare : dénutrition sévère, hypothyroïdie, certaines maladies osseuses héréditaires.",
    haut:"Obstacle biliaire, maladie du foie — mais aussi croissance osseuse, fracture en consolidation, maladie de Paget, grossesse. Chez l'adolescent, une valeur élevée est normale.",
    prel:"Rien de particulier. Se lit avec les gamma-GT : élevées ensemble, elles orientent vers le foie ; isolées, plutôt vers l'os.",
    patient:"Une enzyme qu'on trouve dans le foie et dans les os. Si elle monte, on regarde d'abord lequel des deux est en cause."
  },
  "LDL": {
    mesure:"Le cholestérol transporté vers les tissus, dit « mauvais cholestérol ». C'est la cible principale des traitements.",
    bas:"Dénutrition, hyperthyroïdie, maladie du foie.",
    haut:"Alimentation, hérédité, hypothyroïdie, syndrome néphrotique. ⚠️ Il n'existe pas de norme unique : la cible dépend du risque cardiovasculaire global, fixé par le médecin.",
    prel:"Souvent calculé et non mesuré ; le calcul devient faux quand les triglycérides sont très élevés. À jeun selon les habitudes du laboratoire.",
    patient:"C'est la part du cholestérol qui se dépose dans les artères. Il n'y a pas un chiffre bon pour tout le monde : votre médecin fixe un objectif selon votre situation."
  },
  "HDL": {
    mesure:"Le cholestérol ramené vers le foie, dit « bon cholestérol ». Un taux élevé est plutôt protecteur.",
    bas:"Sédentarité, tabac, surpoids, diabète, triglycérides élevés.",
    haut:"Activité physique régulière, modération d'alcool, hérédité. Rarement préoccupant.",
    prel:"Rien de particulier.",
    patient:"C'est la part du cholestérol qui nettoie les artères plutôt que de les encrasser. Ici, plus il y en a, mieux c'est."
  },
  "TCA (ratio)": {
    mesure:"Le temps de céphaline activée, exploration d'une autre voie de la coagulation que le TP. Il suit notamment l'héparine non fractionnée.",
    bas:"Rarement interprété.",
    haut:"Héparine non fractionnée, hémophilie et déficits en facteurs, anticoagulant circulant, maladie du foie, carence en vitamine K.",
    prel:"⚠️ Mêmes exigences que le TP : tube citraté rempli au trait, homogénéisé sans agiter, acheminé sans délai. ⚠️ Un prélèvement sur un bras perfusé par de l'héparine allonge faussement le résultat — prélever sur l'autre bras.",
    patient:"C'est une autre façon de mesurer la coagulation. On l'utilise surtout quand vous recevez certains anticoagulants."
  },
  "Procalcitonine": {
    mesure:"Un marqueur qui s'élève surtout dans les infections bactériennes, plus spécifique que la CRP.",
    bas:"Valeur normale. Oriente plutôt vers une origine non bactérienne.",
    haut:"Infection bactérienne, sepsis. Monte aussi après une chirurgie lourde, un traumatisme important ou un choc, sans infection.",
    prel:"Rien de particulier. S'élève en quelques heures et redescend vite sous traitement efficace.",
    patient:"C'est un marqueur qui monte surtout quand l'infection est bactérienne — il aide à distinguer d'un virus."
  },
  "Protéines totales": {
    mesure:"L'ensemble des protéines du sang, dont l'albumine représente la plus grande part.",
    bas:"Dénutrition, maladie du foie, syndrome néphrotique, malabsorption, hyperhydratation.",
    haut:"Déshydratation le plus souvent, parfois myélome ou inflammation chronique.",
    prel:"⚠️ Un garrot prolongé fait monter le résultat par concentration locale. Se lit avec l'albumine.",
    patient:"C'est le total des protéines du sang. Ça dépend de l'alimentation, du foie, des reins — et de l'hydratation."
  },
  "Vitamine D (25-OH)": {
    mesure:"Le reflet du statut en vitamine D, d'origine solaire et alimentaire.",
    bas:"Manque d'exposition au soleil, âge avancé, peau foncée, malabsorption, obésité. Très fréquent en hiver.",
    haut:"Supplémentation excessive.",
    prel:"Rien de particulier.",
    patient:"La vitamine du soleil. Elle sert aux os et aux muscles, et beaucoup de gens en manquent l'hiver."
  }
};
