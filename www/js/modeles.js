/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   MES MODÈLES — des documents à produire, et à modifier
   ─────────────────────────────────────────────────────────
   Deux modèles pour commencer : le questionnaire pré-vaccinal, rempli
   AVANT l'injection, et l'attestation remise au patient APRÈS. Ils vont
   ensemble : le numéro de lot saisi sur le premier se reporte sur le
   second, et ne se recopie donc pas de travers.

   ⚠️ Ne pas confondre avec docs.js, qui nomme les documents SCANNÉS
   d'un dossier. Ici on PRODUIT des documents vierges ou pré-remplis.

   ⚠️ MODIFIABLES, mais jamais perdus : chaque modèle garde sa version
   d'origine en dur. « Revenir au modèle d'origine » fonctionne à tout
   moment, même après vingt modifications.

   ⚠️ CE QUE TU ÉCRIS T'ENGAGE. Un questionnaire porte un consentement,
   une attestation porte ta signature. L'application met en page, elle
   ne relit pas : une question mal formulée reste une question mal
   formulée. C'est le prix de la modification, et il faut le dire.

   ⚠️ PENDANT L'ESSAI, LE DOCUMENT PRODUIT NE S'ATTACHE PAS AU DOSSIER :
   la règle du socle est qu'une fonction non validée n'écrit rien dans
   les données de tournée. Le PDF est enregistré et partagé, point.

   ⚠️ L'app ne décide de rien : ni qui vacciner, ni si une contre-
   indication s'applique. Elle imprime ce que tu as rempli.
============================================================ */

const DOC_MODELES = [
  {
    cle:"prevac",
    nom:"Questionnaire pré-vaccinal",
    sous:"À remplir avec le patient AVANT l'injection, et à conserver au dossier de soins.",
    blocs:[
      { type:"identite", titre:"Patient" },
      { type:"questions", titre:"Antécédents et état du jour", items:[
        "Avez-vous déjà présenté un effet indésirable grave après une vaccination ?",
        "Avez-vous des antécédents d'allergie à certaines substances ?",
        "Avez-vous déjà présenté, après ingestion d'œuf ou de poulet, une allergie ayant nécessité des soins immédiats ?",
        "Avez-vous de la fièvre aujourd'hui, ou une infection en cours ?",
        "Êtes-vous sous traitement anticoagulant (AVK ou injections) ?",
        "Avez-vous un déficit immunitaire, ou un traitement immunosuppresseur / corticoïdes au long cours ?",
        "Êtes-vous enceinte, ou allaitez-vous ?"
      ] },
      { type:"consentement", titre:"Consentement du patient",
        texte:"Je soussigné(e) ………………………………………… atteste avoir reçu de mon infirmier(e) les informations concernant la vaccination contre …………………………, notamment sur ses bénéfices et ses risques tels que mentionnés dans la notice du vaccin. J'ai compris ces informations et j'autorise mon infirmier(e) à me vacciner. À l'issue de la vaccination, une attestation me sera remise afin que je puisse la présenter à mon médecin traitant.",
        option:"J'accepte que mon infirmier(e) transmette à mon médecin traitant les données concernant cette vaccination (dossier médical partagé ou messagerie sécurisée). Dans la négative, je m'engage à l'informer moi-même." },
      { type:"champs", titre:"À remplir par l'infirmier(e)", items:[
        "Vaccin administré", "N° de lot", "Site d'injection", "Date et heure"
      ] },
      { type:"signature", qui:"patient" }
    ],
    pied:"Questionnaire de sécurité — il ne remplace pas l'avis médical en cas de doute."
  },
  {
    cle:"attestvac",
    nom:"Attestation de vaccination",
    sous:"À remettre au patient, pour son médecin traitant et son carnet de vaccination.",
    blocs:[
      { type:"atteste",
        texte:"Je soussigné(e) {{moi}}, infirmier(e) diplômé(e) d'État, atteste avoir administré la vaccination suivante :" },
      { type:"champs", titre:"", items:[
        "Patient", "Né(e) le", "Vaccin", "N° de lot", "Site d'injection", "Date d'administration"
      ] },
      { type:"texte",
        texte:"Cette attestation est remise au patient afin qu'il puisse la présenter à son médecin traitant et la reporter sur son carnet de vaccination." },
      { type:"signature", qui:"infirmier" }
    ],
    pied:"Traçabilité : le vaccin administré et son numéro de lot sont également inscrits au dossier patient."
  }
];

/* ============================================================
   LA CONDUITE À TENIR — aide-mémoire du questionnaire pré-vaccinal
   ─────────────────────────────────────────────────────────
   ⚠️ L'APPLICATION NE LIT PAS LES RÉPONSES ET N'EN DÉDUIT RIEN. Elle
   n'affiche pas « tu as coché OUI, donc ne vaccine pas ». Elle met à
   disposition un aide-mémoire que le soignant consulte s'il le veut,
   quand il veut. C'est exactement la ligne du guide de prescription :
   afficher un texte, jamais interpréter une donnée.

   Si l'app décidait à partir des cases cochées, elle entrerait dans
   l'aide à la décision clinique — et changerait de nature.

   ⚠️ CE TEXTE EST CELUI DE L'UTILISATEUR, pas une recommandation que
   j'aurais rédigée. Il est modifiable comme les autres modèles.

   ⚠️ NE S'IMPRIME JAMAIS SUR LE DOCUMENT DU PATIENT : c'est une fiche
   interne. Elle sort dans son propre PDF, marqué comme tel.
============================================================ */
const AIDE_PREVAC = {
  cle:"aideprevac",
  nom:"Conduite à tenir — pré-vaccinal",
  sous:"Aide-mémoire pour l'infirmier. Ne pas remettre au patient.",
  lignes:[
    { q:"Effet indésirable grave après une vaccination antérieure",
      oui:"Contre-indication temporaire à l'acte infirmier autonome. Identifier l'effet (anaphylaxie, choc, syndrome de Guillain-Barré…). Ne pas vacciner sans avis ou prescription écrite d'un médecin ou d'un allergologue.",
      non:"Poursuivre." },
    { q:"Allergie à certaines substances",
      oui:"Vérifier les excipients du vaccin prévu (néomycine, gélatine, latex du bouchon de seringue…). Si allergie croisée avérée avec un composant du produit : ne pas vacciner, réorienter vers le médecin traitant.",
      non:"Poursuivre." },
    { q:"Allergie sévère à l'œuf ou au poulet avec soins immédiats",
      oui:"Concerne surtout les vaccins cultivés sur œufs embryonnés (grippe, fièvre jaune). Pour la grippe, les vaccins actuels contiennent des traces minimes d'ovalbumine, mais un antécédent d'anaphylaxie vraie impose une vaccination sous surveillance médicale stricte en milieu adapté. Différer l'injection à domicile ou au cabinet, orienter vers le médecin.",
      non:"Poursuivre." },
    { q:"Fièvre ou infection en cours",
      oui:"Reporter de quelques jours, jusqu'à disparition complète des signes infectieux et de la fièvre. Un rhume banal sans fièvre ne contre-indique pas formellement, mais en cas de syndrome infectieux aigu on reporte systématiquement.",
      non:"Poursuivre." },
    { q:"Traitement anticoagulant (AVK ou injections)",
      oui:"Pas une contre-indication absolue, mais la technique change pour limiter le risque d'hématome : aiguille fine (23G ou 25G) ; injection intramusculaire profonde ou sous-cutanée selon le RCP du vaccin ; compression ferme du point d'injection sans frotter pendant 2 à 5 minutes après retrait ; s'assurer de la stabilité du traitement (INR récent < 3 pour les AVK).",
      non:"Injection intramusculaire standard." },
    { q:"Déficit immunitaire, immunosuppresseur ou corticoïdes au long cours",
      oui:"Vaccins vivants atténués (ROR, fièvre jaune, varicelle, zona vivant) : contre-indication formelle. Vaccins inactivés ou sous-unitaires (grippe, DTP, Covid, pneumocoque…) : autorisés, mais la réponse immunitaire peut être diminuée — calendrier adapté ou avis médical préalable requis.",
      non:"Poursuivre selon le schéma vaccinal standard." },
    { q:"Grossesse ou allaitement",
      oui:"Vaccins vivants atténués : contre-indiqués pendant la grossesse par précaution. Vaccins recommandés : certains le sont formellement (grippe à n'importe quel trimestre, coqueluche entre la 20ᵉ et la 36ᵉ SA, Covid). Vérifier l'indication exacte selon le terme et le RCP.",
      non:"Poursuivre." }
  ],
  procedure:[
    "Consentement éclairé : informer le patient sur les bénéfices et les effets indésirables attendus (douleur locale, fébricule), faire signer le volet de consentement.",
    "Surveillance post-injection : garder le patient sous surveillance au moins 15 minutes, pour parer à une réaction anaphylactique ou un malaise vagal. Trousse d'urgence (adrénaline) à portée immédiate.",
    "Traçabilité : noter le nom du vaccin, le lot, la date de péremption et le site d'injection sur le carnet de vaccination, dans le dossier de soins et sur Mon espace santé / DMP."
  ],
  pied:"Fiche interne, à l'usage du soignant. L'application n'interprète aucune réponse : elle affiche ce mémo, tu décides."
};

function aidePrevac(){
  const perso = (essaiData("documents").aide || {});
  return { ...AIDE_PREVAC, ...perso };
}
function aideModifiee(){ return !!(essaiData("documents").aide); }

/* ⚠️ Les modèles modifiés vivent dans les données d'essai : effaçables
   sans toucher à un dossier. Un modèle absent retombe sur son original. */
function docModele(cle){
  const perso = (essaiData("documents").modeles || {})[cle];
  const orig = DOC_MODELES.find(m => m.cle === cle);
  if (!orig) return null;
  return perso ? { ...orig, ...perso, cle } : orig;
}
function docModifie(cle){ return !!((essaiData("documents").modeles || {})[cle]); }
function docEnregistrer(cle, m){
  const d = essaiData("documents");
  d.modeles = d.modeles || {};
  d.modeles[cle] = m;
  save(true);
}
function docRestaurer(cle){
  const d = essaiData("documents");
  if (d.modeles) delete d.modeles[cle];
  save(true);
}

function sheetModeles(pid){
  const p = pid ? getP(pid) : null;
  openSheet(`
    ${navHeader(p ? "Fiche" : "Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("documents") : ""}
    <h3>📄 Mes modèles</h3>
    <p class="small muted" style="margin-bottom:12px">${p
      ? "Pour " + esc(p.prenom || "") + " " + esc((p.nom||"").replace("Demo-","").toUpperCase()) + " — son identité et tes coordonnées déjà en place."
      : "Modèles vierges, à imprimer d'avance. Depuis une fiche patient, ils sortent pré-remplis."}</p>

    ${DOC_MODELES.map(o => {
      const m = docModele(o.cle);
      return `<div class="doc-c">
        <div class="doc-h"><span class="doc-ic">📄</span>
          <span style="flex:1;min-width:0"><b>${esc(m.nom)}</b>${
            docModifie(o.cle) ? `<span class="doc-tag">modifié</span>` : ""}
            <br><span class="small muted">${esc(m.sous)}</span></span></div>
        <div class="rowb" style="gap:6px;margin-top:9px">
          <button class="btn btn-ghost btn-sm" data-docgen="${esc(o.cle)}" style="flex:1">📄 Produire</button>
          <button class="btn btn-ghost btn-sm" data-docedit="${esc(o.cle)}" style="flex:0 0 auto;width:auto">✏️ Modifier</button>
        </div>
      </div>`;
    }).join("")}

    <button class="btn btn-ghost" id="doc-aide" style="width:100%;margin-top:4px">🧭 Conduite à tenir — pré-vaccinal${
      aideModifiee() ? ` <span class="small muted">— modifiée</span>` : ""}</button>
    <p class="small muted" style="margin:6px 0 10px">Aide-mémoire pour toi, à consulter quand tu le veux. L'app ne lit pas tes réponses.</p>

    <div class="tip" style="margin-top:12px">Le <b>numéro de lot</b> et le vaccin figurent sur les deux documents : saisis-les une fois sur le questionnaire, recopie-les sur l'attestation.</div>
    <div class="warn" style="margin-top:9px">Pendant l'essai, le document produit est <b>enregistré et partagé</b> mais ne s'attache pas encore au dossier du patient.</div>`);
  bindNav(() => p ? sheetPatient(p, "act") : sheetTours());
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();
  { const b = $("#doc-aide"); if (b) b.onclick = () => sheetAidePrevac(pid); }
  $$("#sheet [data-docgen]").forEach(b => b.onclick = () => docProduire(b.dataset.docgen, pid));
  $$("#sheet [data-docedit]").forEach(b => b.onclick = () => sheetModeleEdit(b.dataset.docedit, pid));
}

/* ⚠️ On ne propose QUE ce qui se modifie sans casser la mise en page :
   titre, sous-titre, questions, champs, textes, pied. La structure reste. */
function sheetModeleEdit(cle, pid){
  const m = JSON.parse(JSON.stringify(docModele(cle)));
  const draw = () => {
    openSheet(`
      ${navHeader("Mes modèles", true)}
      <h3>✏️ ${esc(m.nom)}</h3>
      <div class="warn" style="margin-bottom:12px">Ce que tu écris ici sera imprimé tel quel, sur un document que tu signes. <b>L'application ne relit rien.</b></div>

      <div class="lab">Titre</div>
      <input id="dc-nom" class="rec-in" value="${esc(m.nom)}" style="margin-bottom:6px">
      <textarea id="dc-sous" class="rec-in" rows="2" placeholder="Sous-titre">${esc(m.sous||"")}</textarea>

      ${m.blocs.map((b, i) => {
        if (b.type === "questions") return `
          <div class="lab" style="margin-top:12px">${esc(b.titre||"Questions")}</div>
          ${b.items.map((q, k) => `
            <div class="rowb" style="gap:6px;margin-bottom:5px">
              <textarea class="rec-in" data-dq="${i}.${k}" rows="2" style="flex:1;min-width:0">${esc(q)}</textarea>
              <button class="lien-x" data-dqrm="${i}.${k}" aria-label="Retirer">✕</button>
            </div>`).join("")}
          <button class="btn btn-ghost btn-sm" data-dqadd="${i}" style="width:100%">＋ Ajouter une question</button>`;
        if (b.type === "champs") return `
          <div class="lab" style="margin-top:12px">${esc(b.titre||"Champs à remplir")}</div>
          ${b.items.map((c, k) => `
            <div class="rowb" style="gap:6px;margin-bottom:5px">
              <input class="rec-in" data-dq="${i}.${k}" value="${esc(c)}" style="flex:1;min-width:0">
              <button class="lien-x" data-dqrm="${i}.${k}" aria-label="Retirer">✕</button>
            </div>`).join("")}
          <button class="btn btn-ghost btn-sm" data-dqadd="${i}" style="width:100%">＋ Ajouter un champ</button>`;
        if (b.type === "consentement") return `
          <div class="lab" style="margin-top:12px">Consentement</div>
          <textarea class="rec-in" data-dt="${i}.texte" rows="6">${esc(b.texte||"")}</textarea>
          <div class="lab" style="margin-top:8px">Case à cocher</div>
          <textarea class="rec-in" data-dt="${i}.option" rows="3">${esc(b.option||"")}</textarea>`;
        if (b.type === "atteste" || b.type === "texte") return `
          <div class="lab" style="margin-top:12px">Texte</div>
          <textarea class="rec-in" data-dt="${i}.texte" rows="4">${esc(b.texte||"")}</textarea>`;
        return "";
      }).join("")}

      <div class="lab" style="margin-top:12px">Mention de pied de page</div>
      <textarea id="dc-pied" class="rec-in" rows="2">${esc(m.pied||"")}</textarea>

      <button class="btn btn-primary" id="dc-ok" style="width:100%;margin-top:12px">✓ Enregistrer ce modèle</button>
      ${docModifie(cle) ? `<button class="btn btn-ghost" id="dc-raz" style="width:100%;margin-top:7px">↺ Revenir au modèle d'origine</button>` : ""}
      <p class="small muted" style="margin-top:6px">L'original reste dans l'application : tu peux y revenir à tout moment.</p>`);
    bindNav(() => sheetModeles(pid));

    const lire = () => {
      const n = $("#dc-nom"); if (n) m.nom = n.value.trim() || m.nom;
      const s = $("#dc-sous"); if (s) m.sous = s.value.trim();
      const pd = $("#dc-pied"); if (pd) m.pied = pd.value.trim();
      $$("#sheet [data-dq]").forEach(el => {
        const [i, k] = el.dataset.dq.split(".").map(Number);
        m.blocs[i].items[k] = el.value.trim();
      });
      $$("#sheet [data-dt]").forEach(el => {
        const [i, champ] = el.dataset.dt.split(".");
        m.blocs[+i][champ] = el.value.trim();
      });
    };
    $$("#sheet [data-dqadd]").forEach(b => b.onclick = () => {
      lire(); m.blocs[+b.dataset.dqadd].items.push(""); draw();
    });
    $$("#sheet [data-dqrm]").forEach(b => b.onclick = () => {
      lire();
      const [i, k] = b.dataset.dqrm.split(".").map(Number);
      m.blocs[i].items.splice(k, 1); draw();
    });
    { const b = $("#dc-ok");
      if (b) b.onclick = () => {
        lire();
        /* ⚠️ Les lignes vides sont jetées : une question vide
           s'imprimerait en ligne fantôme sur un document signé. */
        m.blocs.forEach(x => { if (x.items) x.items = x.items.filter(y => y.trim()); });
        docEnregistrer(cle, m);
        toast("Modèle enregistré");
        sheetModeles(pid);
      }; }
    { const b = $("#dc-raz");
      if (b) b.onclick = async () => {
        if (!await askDialog({ ic:"↺", titre:"Revenir au modèle d'origine ?",
          sub:"Tes modifications sur ce document seront perdues.", oui:"Revenir à l'origine" })) return;
        docRestaurer(cle);
        toast("Modèle d'origine rétabli");
        sheetModeles(pid);
      }; }
  };
  draw();
}

async function docProduire(cle, pid){
  if (!(await pdfPret())){ toast("Impossible de préparer le PDF ici", "danger"); return; }
  const m = docModele(cle);
  const p = pid ? getP(pid) : null;
  const M2 = (typeof moi === "function") ? moi() : {};
  const C = (typeof cabinet === "function") ? cabinet() : {};
  const sig = (typeof signatureChoix === "function" && C.id) ? signatureChoix(C.id) : { mode:"moi" };
  const E = (typeof enteteDocument === "function") ? enteteDocument(sig) : { nom:M2.nom || "" };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const MG = 18, L = 210 - MG * 2, V = [29, 122, 102], G = [85, 99, 94];
  /* ⚠️ pdfEnTete renvoie un OBJET { M, L, V, G, F, y }, pas une
     ordonnée : la prendre pour un nombre donnait des coordonnées NaN
     et « Invalid arguments passed to jsPDF.text ». */
  const tete = pdfEnTete(doc, E, sansEmoji(m.nom), sansEmoji(m.sous || ""));
  /* ⚠️ L'en-tête à deux colonnes se termine plus bas que la position
     rendue : sans cette marge, le premier titre chevauchait l'adresse
     du cabinet. */
  let y = Math.max(tete.y + 2, 56);

  const ligne = (txt, o = {}) => {
    doc.setFont("helvetica", o.b ? "bold" : (o.i ? "italic" : "normal"));
    doc.setFontSize(o.sz || 10);
    doc.setTextColor(...(o.c || [26, 36, 32]));
    doc.splitTextToSize(sansEmoji(txt), o.l || L).forEach(l => {
      if (y > 275){ doc.addPage(); y = 20; }
      doc.text(l, MG, y); y += (o.sz || 10) * 0.42 + 1.4;
    });
  };
  const titreBloc = t => { y += 3; ligne(t, { b:true, sz:11, c:V }); y += 1; };
  const champVide = (lbl, largeur) => {
    if (y > 272){ doc.addPage(); y = 20; }
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...G);
    doc.text(sansEmoji(lbl) + " :", MG, y);
    doc.setDrawColor(190, 198, 195);
    const x0 = MG + Math.max(34, doc.getTextWidth(sansEmoji(lbl) + " :") + 3);
    doc.line(x0, y + 0.8, MG + (largeur || L), y + 0.8);
    y += 7;
  };

  m.blocs.forEach(b => {
    if (b.type === "identite"){
      titreBloc(b.titre || "Patient");
      if (p){
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(26, 36, 32);
        const nom = ((p.prenom || "") + " " + (p.nom || "").replace("Demo-", "").toUpperCase()).trim();
        doc.text(sansEmoji("Nom : " + nom), MG, y);
        /* ⚠️ fmtFR abrège : sur une date de naissance on écrit en clair. */
        if (p.dob) doc.text("Ne(e) le : " + p.dob.split("-").reverse().join("/"), MG + 100, y);
        y += 6;
        if (p.nir){ doc.setFontSize(9.5); doc.setTextColor(...G);
          doc.text("N° de securite sociale : " + p.nir, MG, y); y += 6; }
      } else {
        champVide("Nom", 90); champVide("Ne(e) le", 90); champVide("N° de securite sociale", 110);
      }
    }
    else if (b.type === "questions"){
      titreBloc(b.titre || "");
      b.items.forEach(q => {
        if (y > 266){ doc.addPage(); y = 20; }
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
        const lignes = doc.splitTextToSize(sansEmoji(q), L - 32);
        lignes.forEach((l, k) => doc.text(l, MG, y + k * 4.2));
        const yq = y + (lignes.length - 1) * 4.2;
        /* ⚠️ Cases DESSINÉES : la police du PDF n'a pas d'émoji. */
        doc.setDrawColor(120, 130, 126);
        doc.rect(MG + L - 28, yq - 3, 3.6, 3.6);
        doc.text("OUI", MG + L - 23, yq);
        doc.rect(MG + L - 12, yq - 3, 3.6, 3.6);
        doc.text("NON", MG + L - 7, yq);
        y = yq + 6.4;
      });
    }
    else if (b.type === "consentement"){
      titreBloc(b.titre || "Consentement");
      ligne(b.texte || "", { sz:9.5 });
      if (b.option){
        y += 2;
        const yq = y;
        doc.setDrawColor(120, 130, 126);
        doc.rect(MG, yq - 3, 3.6, 3.6);
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
        const lignes = doc.splitTextToSize(sansEmoji(b.option), L - 8);
        lignes.forEach((l, k) => doc.text(l, MG + 6, yq + k * 4.2));
        y = yq + lignes.length * 4.2 + 3;
      }
    }
    else if (b.type === "champs"){
      if (b.titre) titreBloc(b.titre); else y += 2;
      b.items.forEach(c => {
        if (p && /^patient$/i.test(c)){
          doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
          doc.text(sansEmoji("Patient : ") + ((p.prenom||"") + " " + (p.nom||"").replace("Demo-","").toUpperCase()).trim(), MG, y);
          y += 7; return;
        }
        if (p && p.dob && /n[ée]\(e\) le/i.test(c)){
          doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
          doc.text("Ne(e) le : " + p.dob.split("-").reverse().join("/"), MG, y);
          y += 7; return;
        }
        champVide(c, 120);
      });
    }
    else if (b.type === "atteste" || b.type === "texte"){
      y += 2;
      ligne((b.texte || "").replace("{{moi}}", E.nom || M2.nom || "…………………………"), { sz:10 });
    }
    else if (b.type === "signature"){
      y += 6;
      if (y > 248){ doc.addPage(); y = 24; }
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...G);
      doc.text("Fait le :", MG, y);
      doc.setDrawColor(190, 198, 195);
      doc.line(MG + 15, y + 0.8, MG + 55, y + 0.8);
      doc.text("a :", MG + 60, y);
      doc.line(MG + 66, y + 0.8, MG + 105, y + 0.8);
      y += 9;
      doc.text(b.qui === "patient" ? "Signature du / de la patient(e) :" : "Signature et cachet de l'infirmier(e) :", MG, y);
      doc.setDrawColor(210, 216, 213);
      doc.rect(MG, y + 2, L, 22);
      if (b.qui === "infirmier" && (E.rpps || M2.rpps)){
        doc.setFontSize(9); doc.setTextColor(...G);
        doc.text("N° RPPS / ADELI : " + (E.rpps || M2.rpps), MG + 2, y + 20);
      }
      y += 28;
    }
  });

  if (m.pied){
    if (y > 268){ doc.addPage(); y = 20; }
    y += 4;
    doc.setDrawColor(...V); doc.setLineWidth(0.3);
    doc.line(MG, y, MG + L, y); y += 4.5;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...G);
    doc.splitTextToSize(sansEmoji(m.pied), L).forEach(l => { doc.text(l, MG, y); y += 3.6; });
  }

  const base = sansEmoji(m.nom).replace(/[^\w]+/g, "_")
    + (p ? "_" + (p.prenom || "") + "_" + (p.nom || "").replace("Demo-", "") : "")
    + "_" + new Date().toISOString().slice(0, 10);
  await pdfLivrer(doc, base);
}

/* ── Consulter la conduite à tenir ── */
function sheetAidePrevac(pid){
  const a = aidePrevac();
  openSheet(`
    ${navHeader("Mes modèles", true)}
    <h3>🧭 ${esc(a.nom)}</h3>
    <p class="small muted" style="margin-bottom:10px">${esc(a.sous)}</p>
    <div class="warn" style="margin-bottom:12px">L'application <b>ne lit pas tes réponses</b> et n'en déduit rien. Ce mémo s'ouvre quand tu le demandes — c'est toi qui conclus.</div>

    ${a.lignes.map((l, i) => `
      <div class="aide-l">
        <div class="aide-q">${i + 1}. ${esc(l.q)}</div>
        <p class="aide-o"><b>Si OUI</b> — ${esc(l.oui)}</p>
        <p class="aide-n"><b>Si NON</b> — ${esc(l.non)}</p>
      </div>`).join("")}

    <div class="lab" style="margin-top:14px">Procédure et traçabilité</div>
    ${a.procedure.map((p2, i) => `<p class="aide-p"><b>${i + 1}.</b> ${esc(p2)}</p>`).join("")}

    <div class="tip" style="margin-top:12px">${esc(a.pied)}</div>
    <div class="rowb" style="gap:6px;margin-top:12px">
      <button class="btn btn-ghost btn-sm" id="aid-pdf" style="flex:1">📄 Imprimer la fiche</button>
      <button class="btn btn-ghost btn-sm" id="aid-edit" style="flex:0 0 auto;width:auto">✏️ Modifier</button>
    </div>`);
  bindNav(() => sheetModeles(pid));
  { const b = $("#aid-pdf"); if (b) b.onclick = () => aideProduire(); }
  { const b = $("#aid-edit"); if (b) b.onclick = () => sheetAideEdit(pid); }
}

function sheetAideEdit(pid){
  const a = JSON.parse(JSON.stringify(aidePrevac()));
  const draw = () => {
    openSheet(`
      ${navHeader("Conduite à tenir", true)}
      <h3>✏️ Modifier l'aide-mémoire</h3>
      <div class="warn" style="margin-bottom:12px">C'est <b>ton</b> texte : l'application ne le relit pas et ne le complète pas.</div>
      ${a.lignes.map((l, i) => `
        <div class="lab" style="margin-top:10px">${i + 1}. ${esc(l.q)}</div>
        <textarea class="rec-in" data-ao="${i}" rows="4" placeholder="Si OUI…">${esc(l.oui)}</textarea>
        <textarea class="rec-in" data-an="${i}" rows="2" placeholder="Si NON…" style="margin-top:5px">${esc(l.non)}</textarea>`).join("")}
      <div class="lab" style="margin-top:14px">Procédure et traçabilité</div>
      ${a.procedure.map((p2, i) => `
        <textarea class="rec-in" data-ap="${i}" rows="3" style="margin-bottom:5px">${esc(p2)}</textarea>`).join("")}
      <button class="btn btn-primary" id="ae-ok" style="width:100%;margin-top:12px">✓ Enregistrer</button>
      ${aideModifiee() ? `<button class="btn btn-ghost" id="ae-raz" style="width:100%;margin-top:7px">↺ Revenir au texte d'origine</button>` : ""}`);
    bindNav(() => sheetAidePrevac(pid));
    { const b = $("#ae-ok");
      if (b) b.onclick = () => {
        $$("#sheet [data-ao]").forEach(e => a.lignes[+e.dataset.ao].oui = e.value.trim());
        $$("#sheet [data-an]").forEach(e => a.lignes[+e.dataset.an].non = e.value.trim());
        $$("#sheet [data-ap]").forEach(e => a.procedure[+e.dataset.ap] = e.value.trim());
        a.procedure = a.procedure.filter(x => x);
        essaiData("documents").aide = a; save(true);
        toast("Aide-mémoire enregistré");
        sheetAidePrevac(pid);
      }; }
    { const b = $("#ae-raz");
      if (b) b.onclick = async () => {
        if (!await askDialog({ ic:"↺", titre:"Revenir au texte d'origine ?",
          sub:"Tes modifications sur cet aide-mémoire seront perdues.", oui:"Revenir à l'origine" })) return;
        delete essaiData("documents").aide; save(true);
        toast("Texte d'origine rétabli");
        sheetAidePrevac(pid);
      }; }
  };
  draw();
}

/* ⚠️ La fiche sort dans SON PROPRE PDF, jamais accolée au questionnaire
   du patient : elle est à l'usage du soignant, et le dit en tête. */
async function aideProduire(){
  if (!(await pdfPret())){ toast("Impossible de préparer le PDF ici", "danger"); return; }
  const a = aidePrevac();
  const M2 = (typeof moi === "function") ? moi() : {};
  const C = (typeof cabinet === "function") ? cabinet() : {};
  const sig = (typeof signatureChoix === "function" && C.id) ? signatureChoix(C.id) : { mode:"moi" };
  const E = (typeof enteteDocument === "function") ? enteteDocument(sig) : { nom:M2.nom || "" };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:"mm", format:"a4" });
  const MG = 18, L = 210 - MG * 2, V = [29, 122, 102], G = [85, 99, 94], A = [154, 107, 12];
  const tete = pdfEnTete(doc, E, sansEmoji(a.nom), sansEmoji(a.sous));
  let y = Math.max(tete.y + 2, 56);

  const ecrire = (txt, o = {}) => {
    doc.setFont("helvetica", o.b ? "bold" : (o.i ? "italic" : "normal"));
    doc.setFontSize(o.sz || 9.5);
    doc.setTextColor(...(o.c || [26, 36, 32]));
    doc.splitTextToSize(sansEmoji(txt), o.l || L - (o.ind || 0)).forEach(l => {
      if (y > 276){ doc.addPage(); y = 20; }
      doc.text(l, MG + (o.ind || 0), y); y += (o.sz || 9.5) * 0.42 + 1.3;
    });
  };

  /* Le bandeau : ce document ne se remet pas au patient. */
  doc.setFillColor(253, 248, 236); doc.setDrawColor(...A);
  doc.rect(MG, y - 4, L, 9, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...A);
  doc.text(sansEmoji("Fiche interne — a l'usage du soignant. Ne pas remettre au patient."), MG + 3, y + 1.8);
  y += 11;

  a.lignes.forEach((l, i) => {
    if (y > 258){ doc.addPage(); y = 20; }
    y += 2;
    ecrire((i + 1) + ". " + l.q, { b:true, sz:10.5, c:V });
    ecrire("Si OUI — " + l.oui, { ind:4 });
    ecrire("Si NON — " + l.non, { ind:4, i:true, c:G });
    y += 1.5;
  });

  if (a.procedure && a.procedure.length){
    if (y > 250){ doc.addPage(); y = 20; }
    y += 3;
    ecrire("Procedure et tracabilite", { b:true, sz:11, c:V });
    a.procedure.forEach((p2, i) => ecrire((i + 1) + ". " + p2, { ind:4 }));
  }

  if (a.pied){
    if (y > 270){ doc.addPage(); y = 20; }
    y += 4;
    doc.setDrawColor(...V); doc.setLineWidth(0.3);
    doc.line(MG, y, MG + L, y); y += 4.5;
    ecrire(a.pied, { i:true, sz:8.5, c:G });
  }

  await pdfLivrer(doc, "Conduite_a_tenir_pre-vaccinal_" + new Date().toISOString().slice(0, 10));
}
