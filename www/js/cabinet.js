/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   LA FICHE CABINET
   ─────────────────────────────────────────────────────────
   Jusqu'ici les contacts n'existaient qu'au niveau du patient : le kiné
   de douze patients était saisi douze fois, et n'entrait dans aucune
   synchro. Le cabinet devient donc un annuaire commun, dans lequel la
   fiche patient PUISE — sans cesser d'accepter une saisie libre.

   ⚠️ UN CONTACT PORTE UNE LISTE DE COORDONNÉES, pas trois champs :
   un médecin peut avoir deux numéros aujourd'hui et quatre demain.
   Des colonnes tel1/tel2/tel3 plafonnent toujours trop tôt.

   ⚠️ CHAQUE COORDONNÉE PORTE SA VISIBILITÉ. Un praticien donne parfois
   un numéro « pour les pros, pas pour les patients » : il reste dans
   l'annuaire et dans la fiche, mais ne sort JAMAIS sur un document
   remis au patient — feuille domicile, DLU, dossier RGPD.

   ⚠️ L'ANNUAIRE MET À JOUR, IL NE COMMANDE PAS : la fiche patient garde
   une COPIE des valeurs au moment du lien. Supprimer un contact de
   l'annuaire ne doit jamais vider douze dossiers.
============================================================ */

const CAB_CATS = {
  praticien: { lbl:"Praticien du cabinet", ic:"🩺" },
  partenaire:{ lbl:"Partenaire",            ic:"🤝" },
  utile:     { lbl:"Numéro utile",          ic:"☎️" }
};
/* Métiers proposés — la saisie reste libre, c'est une aide, pas un carcan */
/* ⚠️ LA MÊME LISTE QUE LA FICHE PATIENT. Un annuaire avec son propre
   vocabulaire rendait le filtrage impossible : on cherchait « Pneumologue »
   dans des contacts marqués « Médecin spécialiste ». SPECS fait foi,
   les autres métiers viennent ensuite — et la saisie reste libre. */
const CAB_AUTRES_METIERS = ["Infirmier", "Kinésithérapeute", "Pharmacie", "Laboratoire",
  "Prestataire de matériel", "VSL / Transport", "HAD", "Service social", "Podologue",
  "Orthophoniste", "Sage-femme", "Diététicien", "Pédicure", "Ergothérapeute", "Autre"];
const CAB_METIERS = [...(typeof SPECS !== "undefined" ? SPECS : []), ...CAB_AUTRES_METIERS];
/* Les anciens libellés doivent continuer de répondre au filtre */
const CAB_EQUIV = {
  "médecin": "Médecin généraliste", "généraliste": "Médecin généraliste",
  "medecin generaliste": "Médecin généraliste", "docteur": "Médecin généraliste",
  "médecin spécialiste": "", "endocrinologue": "Endocrinologue / diabétologue",
  "diabétologue": "Endocrinologue / diabétologue", "angiologue": "Angiologue / médecin vasculaire"
};
function cabSpecNorm(t){
  const v = String(t||"").trim();
  if (!v) return "";
  const k = v.toLowerCase();
  if (CAB_EQUIV[k] !== undefined && CAB_EQUIV[k] !== "") return CAB_EQUIV[k];
  const exact = CAB_METIERS.find(m => m.toLowerCase() === k);
  return exact || v;
}
/* Un métier est-il un métier de MÉDECIN ? La liste SPECS ne contient
   que ceux-là : tout ce qui n'y est pas (pharmacie, kiné, VSL…) n'a
   rien à faire dans le choix d'un médecin. */
function cabEstMedecin(c){
  const m = cabSpecNorm(c.metier);
  if (!m) return false;
  if (typeof SPECS !== "undefined" && SPECS.some(x => x.toLowerCase() === m.toLowerCase())) return true;
  return /médecin|docteur|spécialiste|logue$|iatre$/i.test(m);
}

/* Ce contact répond-il à la spécialité cherchée ? */
function cabCorrespond(c, spec){
  /* ⚠️ « traitant » ne veut pas dire « pas de filtre » : on cherche un
     MÉDECIN. Sans cette distinction, la pharmacie et le VSL étaient
     proposés au moment d'ajouter le médecin traitant. */
  if (spec === "traitant") return cabEstMedecin(c);
  if (!spec) return true;
  const a = cabSpecNorm(c.metier), b = cabSpecNorm(spec);
  if (!a) return false;
  if (a === b) return true;
  /* « Médecin spécialiste » et les libellés vagues restent proposés */
  return /spécialiste|médecin$/i.test(a);
}
const CAB_TYPES = { tel:"Téléphone", mobile:"Mobile", mail:"E-mail", adresse:"Adresse", fax:"Fax", autre:"Autre" };
/* ⚠️ « Jours » est devenu « Complément » : un remplaçant, une associée,
   un titulaire — c'est le statut qui distingue les praticiens entre eux,
   pas leur planning. Champ LIBRE : les suggestions n'enferment pas. */
const CAB_COMPLEMENTS = ["Titulaire", "Associé", "Collaborateur", "Remplaçant",
  "Remplaçant régulier", "Étudiant", "Retraité"];
/* Des pistes pour les numéros utiles — libres elles aussi */
const CAB_UTILES = ["Hôpital", "Clinique", "Urgences", "SAMU", "HAD",
  "Centre antipoison", "Pharmacie de garde", "Service social", "Assistante sociale",
  "Astreinte du cabinet", "Laboratoire de garde", "Ambulance", "Maison médicale de garde"];

/* ============================================================
   À QUEL CABINET APPARTIENT CE PATIENT ?
   ─────────────────────────────────────────────────────────
   ⚠️ RIEN NE RELIAIT UNE TOURNÉE À UN CABINET. Un document produit pour
   un patient du Cabinet A sortait donc à l'en-tête du cabinet OUVERT —
   le B si on y avait travaillé la veille. Il fallait corriger à la main
   chaque fois.

   Un cabinet déclare les tournées qu'il couvre (`cab.tours`). Le patient
   porte ses tournées, donc son cabinet s'en déduit.

   ⚠️ LE CHOIX RESTE OUVERT : ce lien fixe le DÉFAUT, il ne verrouille
   rien. Le bouton « Qui signe » permet toujours de changer, et un
   document déjà commencé n'est pas modifié dans le dos.

   ⚠️ Aucune tournée déclarée nulle part = comportement d'avant : le
   cabinet ouvert. On ne casse pas ce qui marchait pour ceux qui n'ont
   qu'un cabinet.
============================================================ */
function cabinetDeTournee(tour){
  if (!tour) return null;
  return (S.cabinets || []).find(c => (c.tours || []).includes(tour)) || null;
}
function cabinetDuPatient(p){
  if (!p) return null;
  /* La tournée courante d'abord si le patient en fait partie : c'est
     celle sur laquelle on travaille. */
  const t = (p.tours || []);
  if (t.includes(S.curTour)){
    const c = cabinetDeTournee(S.curTour);
    if (c) return c;
  }
  for (const x of t){
    const c = cabinetDeTournee(x);
    if (c) return c;
  }
  return null;
}
/* Le cabinet à employer pour un document : celui du patient s'il est
   connu, sinon celui qui est ouvert. */
function cabinetPourDoc(p){
  return cabinetDuPatient(p) || cabinet();
}

/* ============================================================
   MA FICHE — l'identité professionnelle
   ─────────────────────────────────────────────────────────
   ⚠️ Le RPPS était rangé DANS CHAQUE CABINET : avec trois cabinets, il
   était saisi trois fois, et une faute de frappe quelque part faisait
   diverger les ordonnances selon le lieu de travail.

   L'identité suit la personne, le cabinet est le lieu. Un document
   compose les deux : qui signe vient d'ici, où joindre vient du cabinet.

   ⚠️ Le portable PERSONNEL est distinct du professionnel : seul le
   second peut figurer sur un document remis à un patient. Même logique
   que les coordonnées « pros seuls » de l'annuaire.
============================================================ */
function moi(){
  if (!S.moi){
    S.moi = { nom:"", titre:"Infirmier(ère) diplômé(e) d'État", rpps:"", am:"",
              tel:"", telPerso:"", mail:"", adresse:"" };
    /* Reprise de ce qui a déjà été saisi dans un en-tête de cabinet :
       rien à ressaisir. */
    const src = (S.cabinets || []).map(c => c.entete || {}).find(e => e.nom || e.rpps);
    if (src){
      S.moi.nom = src.nom || "";
      S.moi.titre = src.titre || S.moi.titre;
      S.moi.rpps = src.rpps || "";
      S.moi.am = src.am || "";
    }
  }
  return S.moi;
}

/* Les titulaires et associés du cabinet ouvert, pour la mention
   « remplaçant de ». Les autres praticiens restent proposés ensuite. */
function titulairesDuCabinet(){
  const l = (cabinet().contacts || []).filter(c => c.cat === "praticien" && c.nom);
  const rang = c => /titulaire/i.test(c.complement || "") ? 0
                  : /associé|associe/i.test(c.complement || "") ? 1 : 2;
  return l.sort((a, b) => rang(a) - rang(b) || (a.nom||"").localeCompare(b.nom||"", "fr"));
}

/* ⚠️ PLUSIEURS CABINETS : un remplaçant tourne dans deux ou trois
   structures, chacune avec ses confrères et ses partenaires. La fiche
   unique des premières versions devient donc une LISTE, et l'ancienne
   `S.cabinet` est reprise telle quelle comme premier élément — aucune
   saisie n'est perdue. */
function cabinets(){
  if (!Array.isArray(S.cabinets)){
    S.cabinets = [];
    if (S.cabinet && (S.cabinet.nom || (S.cabinet.contacts||[]).length)){
      S.cabinets.push({ id:uid(), ...S.cabinet });
      S.cabinetActif = S.cabinets[0].id;
    }
  }
  if (!S.cabinets.length){
    S.cabinets.push({ id:uid(), nom:"", adresse:"", tel:"", mail:"", entete:{}, contacts:[] });
    S.cabinetActif = S.cabinets[0].id;
  }
  S.cabinets.forEach(c => { if (!Array.isArray(c.contacts)) c.contacts = []; });
  return S.cabinets;
}
function cabinet(){
  const l = cabinets();
  return l.find(c => c.id === S.cabinetActif) || l[0];
}
function cabinetChoisirActif(id){
  if (cabinets().some(c => c.id === id)){ S.cabinetActif = id; save(true); }
}
function cabContacts(cat){
  const c = cabinet().contacts;
  return cat ? c.filter(x => x.cat === cat) : c;
}
function cabContact(id){ return cabinet().contacts.find(x => x.id === id) || null; }

/* Les coordonnées qu'on a le droit de montrer au patient */
function coordVisibles(c){ return ((c && c.coord) || []).filter(x => x.vis !== "pro"); }
/* Toutes, y compris celles réservées aux professionnels */
function coordToutes(c){ return (c && c.coord) || []; }
/* Le premier numéro utilisable, pour l'affichage compact */
function coordPrincipale(c, pourPatient){
  const l = pourPatient ? coordVisibles(c) : coordToutes(c);
  return l.find(x => x.type === "mobile" || x.type === "tel") || l[0] || null;
}
function cabLigne(c){
  const p = coordPrincipale(c, false);
  return c.nom + (p ? " — " + p.val : "");
}


/* ============================================================
   CLASSER LES PARTENAIRES
   ─────────────────────────────────────────────────────────
   Une liste à plat de trente contacts se parcourt longtemps sans
   repère. On groupe donc par famille de métier, un seul groupe ouvert
   à la fois — et, dans les médecins, un SECOND niveau par spécialité,
   repliable lui aussi.

   ⚠️ Deux niveaux de repliement coûtent deux touchers pour atteindre
   un nom. Le garde-fou : quand un groupe s'ouvre, ses spécialités sont
   OUVERTES par défaut ; on les replie pour faire de la place, pas pour
   y accéder. Et une recherche ouvre tout ce qu'elle trouve.
============================================================ */
const CAB_FAMILLES = [
  { id:"med",   ic:"🩺", lbl:"Médecins",           test:c => cabEstMedecin(c) },
  { id:"para",  ic:"🤝", lbl:"Paramédicaux",       test:c => /kiné|ergo|ortho|podo|psycho|diété|sage-femme|infirmier/i.test(c.metier||"") },
  { id:"pharm", ic:"💊", lbl:"Pharmacies",          test:c => /pharmac/i.test(c.metier||"") },
  { id:"labo",  ic:"🔬", lbl:"Laboratoires",        test:c => /labo|biolog/i.test(c.metier||"") },
  { id:"transp",ic:"🚐", lbl:"Transport & VSL",     test:c => /vsl|transport|ambulan|taxi/i.test(c.metier||"") },
  { id:"mat",   ic:"🛏️", lbl:"Matériel & HAD",      test:c => /matériel|materiel|prestataire|had|location/i.test(c.metier||"") },
  { id:"autre", ic:"📇", lbl:"Autres",              test:() => true }
];
function cabFamille(c){
  return (CAB_FAMILLES.find(f => f.test(c)) || CAB_FAMILLES[CAB_FAMILLES.length-1]).id;
}
/* Les médecins se sous-classent par spécialité ; les généralistes en
   tête, c'est eux qu'on appelle le plus. */
function cabSousGroupes(liste, famille){
  if (famille !== "med"){
    return [{ cle:"", lbl:"", contacts:liste }];
  }
  const par = {};
  liste.forEach(c => {
    const sp = cabSpecNorm(c.metier) || "Sans spécialité";
    (par[sp] = par[sp] || []).push(c);
  });
  /* ⚠️ Une spécialité à un seul médecin ne mérite pas son titre quand
     le groupe est fourni : sinon on lit une page d'intertitres. */
  const seuls = [], groupes = [];
  Object.entries(par).forEach(([sp, l]) => {
    if (l.length === 1 && liste.length > 6) seuls.push(...l);
    else groupes.push({ cle:sp, lbl:sp, contacts:l });
  });
  groupes.sort((a, b) => {
    if (/généraliste/i.test(a.lbl)) return -1;
    if (/généraliste/i.test(b.lbl)) return 1;
    return a.lbl.localeCompare(b.lbl, "fr");
  });
  if (seuls.length) groupes.push({ cle:"__autres", lbl:"Autres spécialités", contacts:seuls, divers:true });
  return groupes;
}

/* ── L'écran ── */
let _cabOnglet = "cabinet";
let _cabRech = "", _cabFamOuv = null;
/* On mémorise ce qui est FERMÉ, pas ce qui est ouvert : par défaut tout
   est visible dans un groupe déplié. */
const _cabSpecFerme = new Set();

function sheetCabinet(onglet){
  const C = cabinet();
  if (onglet) _cabOnglet = onglet;
  const T = _cabOnglet;
  const ligneContact = c => {
    const pro = coordToutes(c).filter(x => x.vis === "pro").length;
    return `<button class="selv" data-cabc="${esc(c.id)}">
      <span class="sv" style="flex:1;min-width:0">
        <b>${esc(c.nom || "Sans nom")}</b>${c.metier ? ` <span class="small muted">${esc(c.metier)}</span>` : ""}
        ${coordToutes(c).length ? `<br><span class="small muted">${esc((coordPrincipale(c,false)||{}).val || "")}${
          coordToutes(c).length > 1 ? " · +" + (coordToutes(c).length-1) : ""}</span>` : ""}
      </span>
      ${pro ? `<span class="cab-pro">${pro} pro</span>` : ""}
    </button>`;
  };

  const liste = cat => {
    const tous = cabContacts(cat);
    if (!tous.length) return `<p class="muted small" style="padding:12px 0;text-align:center">Aucun contact — ajoute-le avec le bouton ci-dessous.</p>`;

    const q = (_cabRech || "").trim().toLowerCase();
    const colle = c => (c.nom + " " + (c.metier||"") + " " + (c.note||"") + " " +
      coordToutes(c).map(x => x.val).join(" ")).toLowerCase();
    const l = q ? tous.filter(c => colle(c).includes(q)) : tous;

    const champ = `
      <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-bottom:9px">
        <span>🔍</span>
        <input id="cab-q" class="rec-in" placeholder="Chercher un nom ou un métier…"
          value="${esc(_cabRech)}" style="flex:1;min-width:0">
        ${q ? `<button class="chip sm" id="cab-q-clr" aria-label="Effacer">✕</button>` : ""}
      </div>
      ${q ? `<p class="small muted" style="margin:-4px 0 8px">${l.length} sur ${tous.length} contact(s)</p>` : ""}`;

    if (!l.length) return champ + `<p class="muted small" style="padding:12px 0;text-align:center">Aucun contact ne correspond.</p>`;

    /* Les trois catégories autres que « partenaire » restent à plat :
       elles ne portent pas assez de monde pour mériter des groupes. */
    if (cat !== "partenaire"){
      return champ + l.sort((a,b) => (a.nom||"").localeCompare(b.nom||"", "fr")).map(ligneContact).join("");
    }

    const parFam = {};
    l.forEach(c => { const f = cabFamille(c); (parFam[f] = parFam[f] || []).push(c); });

    return champ + CAB_FAMILLES.filter(f => (parFam[f.id]||[]).length).map(f => {
      const dedans = parFam[f.id].sort((a,b) => (a.nom||"").localeCompare(b.nom||"", "fr"));
      /* ⚠️ Une recherche ouvre ce qu'elle trouve : filtrer sans déplier
         ne montrerait rien. */
      const ouv = q ? true : _cabFamOuv === f.id;
      const sous = cabSousGroupes(dedans, f.id);
      return `<div class="cab-fam ${ouv ? "ouv" : ""}">
        <button class="cab-fam-h" data-cabfam="${f.id}">
          <span style="flex:1;min-width:0;text-align:left">${f.ic} ${esc(f.lbl)}</span>
          <span class="small muted">${dedans.length}</span>
          <span class="cab-fl">▾</span>
        </button>
        <div class="cab-fam-b" ${ouv ? "" : "hidden"}>
          ${sous.map(g => {
            if (!g.lbl) return g.contacts.map(ligneContact).join("");
            /* ⚠️ Les spécialités sont OUVERTES par défaut : on les replie
               pour faire de la place, pas pour y accéder — sinon deux
               touchers seraient nécessaires pour atteindre un nom. */
            const so = q ? true : !_cabSpecFerme.has(f.id + "|" + g.cle);
            return `<div class="cab-sg ${so ? "ouv" : ""}">
              <button class="cab-sg-h" data-cabsg="${esc(f.id + "|" + g.cle)}">
                <span style="flex:1;min-width:0;text-align:left">${esc(g.lbl)}</span>
                <span class="small muted">${g.contacts.length}</span>
                <span class="cab-fl">▾</span>
              </button>
              ${so ? `<div class="cab-sg-b">${g.contacts.map(c =>
                ligneContact(g.divers ? c : { ...c, metier: "" })).join("")}</div>` : ""}
            </div>`;
          }).join("")}
        </div>
      </div>`;
    }).join("");
  };

  const corps = T === "cabinet" ? `
      <div class="lab">Le cabinet</div>
      <input id="cab-nom" class="rec-in" placeholder="Nom du cabinet" value="${esc(C.nom||"")}" style="margin-bottom:8px">
      <textarea id="cab-adr" class="rec-in" rows="2" placeholder="Adresse" style="margin-bottom:8px">${esc(C.adresse||"")}</textarea>
      <div class="rowb" style="gap:6px;margin-bottom:8px">
        <input id="cab-tel" class="rec-in" placeholder="Téléphone" value="${esc(C.tel||"")}" inputmode="tel" style="flex:1;min-width:0">
        <input id="cab-mail" class="rec-in" placeholder="E-mail" value="${esc(C.mail||"")}" inputmode="email" style="flex:1;min-width:0">
      </div>
      <!-- ⚠️ C'est ce lien qui fait sortir un document au BON en-tête :
           sans lui, l'app ne peut pas deviner à quel cabinet appartient
           un patient, et prend celui qui est ouvert. -->
      <div class="rowlab vi" style="margin-top:12px"><span>Tournées de ce cabinet</span><i></i></div>
      <p class="small muted" style="margin-bottom:7px">Coche les tournées que tu fais pour lui. Une ordonnance sortira alors à son en-tête pour les patients concernés.</p>
      ${(S.tours || []).map(t => {
        const autre = (S.cabinets || []).find(c2 => c2.id !== C.id && (c2.tours || []).includes(t));
        return `<label class="screl" style="margin-bottom:5px">
          <input type="checkbox" data-cabt2="${esc(t)}" ${(C.tours||[]).includes(t) ? "checked" : ""} ${autre ? "disabled" : ""}>
          <span>${esc(t)}${autre ? ` <span class="small muted">— déjà à ${esc(autre.nom || "un autre cabinet")}</span>` : ""}</span>
        </label>`;
      }).join("")}
      ${!(S.tours||[]).length ? `<p class="small muted">Aucune tournée pour l'instant.</p>` : ""}
      <div class="tip">Ces informations servent au pied des feuilles à laisser au domicile et à ton papier à en-tête.</div>
      ${cabinets().length > 1 ? `<button class="btn btn-ghost" id="cab-del" style="width:100%;margin-top:10px;color:var(--danger)">🗑 Retirer ce cabinet</button>` : ""}`
    : T === "entete" ? cabEnteteHTML()
    : `${liste(T === "praticiens" ? "praticien" : T === "partenaires" ? "partenaire" : "utile")}
       <button class="btn btn-ghost" id="cab-add" style="width:100%;margin-top:8px;border-style:dashed">＋ Ajouter</button>`;

  const L = cabinets();
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🏥 ${esc(C.nom || "Mon cabinet")}</h3>
    ${/* ⚠️ Deux rangées de pastilles identiques donnaient l'impression de
          « cliquer sur les mêmes boutons » : la première change de DOSSIER,
          la seconde de PAGE. D'où deux formes distinctes — cadre propre et
          pastilles rectangulaires à fond plein pour les cabinets, pastilles
          rondes en contour pour les rubriques — et un trait estompé entre
          les deux. Le logo ne figure QU'UNE FOIS, sur le libellé du bloc :
          répété sur chaque cabinet, il ferait passer les noms à la ligne. */ ""}
    <div class="cab-sel">
      <div class="cab-sel-t">🏥 CABINET</div>
      <div class="cab-sel-l">
        ${L.map(x => `<button class="cabchip ${x.id===C.id?"on":""}" data-cabsel="${esc(x.id)}"
          >${esc(x.nom || "Cabinet sans nom")}</button>`).join("")}
        <button class="cabchip plus" id="cab-new" aria-label="Nouveau cabinet">＋</button>
      </div>
    </div>
    <div class="cab-trait"></div>
    <div class="chips" style="margin-bottom:10px">
      ${[["cabinet","Le cabinet"],["praticiens","Praticiens"],["partenaires","Partenaires"],
         ["utiles","Numéros utiles"],["entete","Mon en-tête"]].map(([k,l]) =>
        `<button class="chip ${T===k?"on":""}" data-cabt="${k}" style="font-size:11.5px">${l}</button>`).join("")}
    </div>
    ${corps}
    <div class="rowlab vi" style="margin-top:16px"><span>Classeur</span><i></i><em>saisie au clavier</em></div>
    <div class="rowb" style="gap:6px">
      <button class="btn btn-ghost" id="cab-xls-out" style="flex:1">📊 Exporter</button>
      <button class="btn btn-ghost" id="cab-xls-in" style="flex:1">📥 Importer</button>
    </div>
    <p class="small muted" style="margin-top:6px">Le classeur s'ouvre dans Excel, LibreOffice ou Google Sheets. Rien n'est écrasé à l'import : tu coches ce que tu reprends.</p>
    <input type="file" id="cab-xls-file" accept=".xlsx" style="display:none">`);
  bindNav();
  { const e = $("#cab-xls-out"); if (e) e.onclick = () => cabExportXlsx(); }
  { const e = $("#cab-xls-in"), f = $("#cab-xls-file");
    if (e && f){ e.onclick = () => f.click();
      f.onchange = () => { const x = f.files && f.files[0]; if (x) cabImportXlsx(x); }; } }
  $$("#sheet [data-cabt]").forEach(b => b.onclick = () => sheetCabinet(b.dataset.cabt));
  $$("#sheet [data-cabsel]").forEach(b => b.onclick = () => { cabinetChoisirActif(b.dataset.cabsel); sheetCabinet(); });
  { const n = $("#cab-new");
    if (n) n.onclick = async () => {
      const nom = await askText("Nouveau cabinet", { ic:"🏥", ph:"Nom du cabinet — ex. Cabinet des Oliviers" });
      if (!nom) return;
      const neuf = { id:uid(), nom, adresse:"", tel:"", mail:"", entete:{}, contacts:[] };
      S.cabinets.push(neuf); S.cabinetActif = neuf.id; save(true); sheetCabinet("cabinet");
    }; }
  { const a = $("#cab-add");
    if (a) a.onclick = () => sheetCabContact(null, T === "praticiens" ? "praticien" : T === "partenaires" ? "partenaire" : "utile"); }
  $$("#sheet [data-cabc]").forEach(b => b.onclick = () => sheetCabContact(b.dataset.cabc));
  $$("#sheet [data-cabfam]").forEach(b => b.onclick = () => {
    const f = b.dataset.cabfam;
    _cabFamOuv = (_cabFamOuv === f) ? null : f;
    sheetCabinet();
  });
  $$("#sheet [data-cabsg]").forEach(b => b.onclick = () => {
    const k = b.dataset.cabsg;
    _cabSpecFerme.has(k) ? _cabSpecFerme.delete(k) : _cabSpecFerme.add(k);
    sheetCabinet();
  });
  { const e = $("#cab-q");
    if (e) e.oninput = () => { clearTimeout(e._t);
      e._t = setTimeout(() => { _cabRech = e.value; sheetCabinet();
        const n = $("#cab-q"); if (n){ n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 400); }; }
  { const c = $("#cab-q-clr"); if (c) c.onclick = () => { _cabRech = ""; sheetCabinet(); }; }
  /* ⚠️ Une tournée n'appartient qu'à UN cabinet : sinon « quel en-tête
     pour ce patient ? » n'aurait pas de réponse. Les cases déjà prises
     par un autre cabinet sont désactivées, jamais volées en silence. */
  $$("#sheet [data-cabt2]").forEach(c => c.onchange = () => {
    const C2 = cabinet();
    C2.tours = C2.tours || [];
    const t = c.dataset.cabt2;
    if (c.checked){ if (!C2.tours.includes(t)) C2.tours.push(t); }
    else C2.tours = C2.tours.filter(x => x !== t);
    save(true);
    sheetCabinet("cabinet");
  });
  ["nom","adr","tel","mail"].forEach(k => {
    const e = $("#cab-" + k); if (!e) return;
    e.onchange = () => { C[k === "adr" ? "adresse" : k] = e.value.trim(); save(true); };
  });
  { const d = $("#cab-del");
    if (d) d.onclick = async () => {
      const n = (C.contacts||[]).length;
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Retirer « " + esc(C.nom || "ce cabinet") + " » ?",
        sub: n ? n + " contact(s) y sont enregistrés." : "",
        warn:"Les fiches patient gardent les contacts déjà repris : elles cessent seulement de suivre cet annuaire.",
        oui:"🗑 Retirer" })) return;
      S.cabinets = S.cabinets.filter(x => x.id !== C.id);
      S.cabinetActif = (S.cabinets[0]||{}).id;
      save(true); sheetCabinet("cabinet");
    }; }
  cabEnteteBind();
}

/* ── Une fiche contact : nom, métier, et autant de coordonnées qu'il faut ── */
function sheetCabContact(id, cat){
  const C = cabinet();
  let c = id ? cabContact(id) : null;
  const neuf = !c;
  if (!c) c = { id:uid(), cat:cat||"partenaire", nom:"", metier:"", note:"", coord:[] };

  const draw = () => {
    openSheet(`
      ${navHeader("Cabinet", true)}
      <h3>${CAB_CATS[c.cat] ? CAB_CATS[c.cat].ic : "👤"} ${neuf ? "Nouveau contact" : esc(c.nom || "Contact")}</h3>

      <div class="lab">Identité</div>
      <input id="cc-nom" class="rec-in" placeholder="Nom" value="${esc(c.nom||"")}" style="margin-bottom:8px">
      <!-- ⚠️ Les suggestions du navigateur (datalist) s'ouvraient PUIS
           disparaissaient aussitôt, recouvertes par le clavier : il
           fallait fermer le clavier et rouvrir la liste. On passe par un
           choix en plein écran, comme partout ailleurs dans l'app. -->
      <div class="rowb" style="gap:6px;margin-bottom:8px">
        <input id="cc-met" class="rec-in" placeholder="${c.cat === "utile" ? "Type — hôpital, clinique…" : "Métier"}"
          value="${esc(c.metier||"")}" style="flex:1;min-width:0">
        <button class="btn btn-ghost btn-sm" id="cc-met-pick" style="width:auto;flex:0 0 auto">📋 Liste</button>
      </div>
      ${c.cat === "praticien" ? `
      <div class="lab">Complément</div>
      <!-- ⚠️ Plus de « datalist » : les suggestions du navigateur
           s'ouvrent puis se referment aussitôt, recouvertes par le
           clavier. Même correction que pour le métier en v1.0.80. -->
      <div class="rowb" style="gap:6px;margin-bottom:8px">
        <input id="cc-comp" class="rec-in" placeholder="Remplaçant, titulaire, associé…"
          value="${esc(c.complement||"")}" style="flex:1;min-width:0">
        <button class="btn btn-ghost btn-sm" id="cc-comp-pick" style="width:auto;flex:0 0 auto">📋 Liste</button>
      </div>
      <!-- ⚠️ Nécessaire pour la mention « remplaçant de » : elle porte le
           RPPS du titulaire. Facultatif pour les autres praticiens. -->
      <input id="cc-rpps" class="rec-in" placeholder="N° RPPS (pour la mention « remplaçant de »)"
        value="${esc(c.rpps||"")}" style="margin-bottom:8px">` : ""}

      <div class="rowlab vi"><span>Coordonnées</span><i></i><em>autant que nécessaire</em></div>
      <div id="cc-coords">${(c.coord||[]).map((x,i) => `
        <div class="cc-c">
          <!-- ⚠️ Le type et le numéro ne tiennent pas côte à côte sur un
               téléphone : le champ du numéro devenait minuscule. Le type
               et le bouton de retrait sur une ligne, le numéro sur la
               sienne, en pleine largeur. -->
          <div class="rowb" style="gap:6px;margin-bottom:5px">
            <select class="rec-in" data-cct="${i}" style="flex:1;min-width:0"
              data-titre="Type de coordonnée">
              ${Object.entries(CAB_TYPES).map(([k,l]) =>
                `<option value="${k}"${x.type===k?" selected":""}>${l}</option>`).join("")}
            </select>
            <button class="lien-x" data-ccrm="${i}" aria-label="Retirer cette coordonnée">✕</button>
          </div>
          <input class="rec-in" data-ccv="${i}" value="${esc(x.val||"")}"
            placeholder="${x.type === "mail" ? "adresse@exemple.fr"
                        : x.type === "adresse" ? "Adresse postale"
                        : "Numéro"}"
            inputmode="${x.type === "mail" ? "email" : x.type === "adresse" ? "text" : "tel"}"
            style="width:100%;margin-bottom:5px">
          <div class="chips" style="margin-bottom:10px">
            <button class="chip sm ${x.vis!=="pro"?"on":""}" data-ccvis="${i}|patient" style="font-size:11px">👁 Visible du patient</button>
            <button class="chip sm ${x.vis==="pro"?"on":""}" data-ccvis="${i}|pro" style="font-size:11px">🔒 Pros seuls</button>
          </div>
        </div>`).join("")}</div>
      <button class="btn btn-ghost" id="cc-add" style="width:100%;border-style:dashed;margin-bottom:10px">＋ Ajouter une coordonnée</button>

      <div class="lab">Note</div>
      <textarea id="cc-note" class="rec-in" rows="2" placeholder="Horaires, précisions…" style="margin-bottom:10px">${esc(c.note||"")}</textarea>

      <div class="tip">Une coordonnée <b>« pros seuls »</b> reste ici et dans les fiches patient, mais ne figure sur <b>aucun document remis au patient</b> — feuille domicile, DLU, dossier.</div>

      ${!neuf ? `<div id="cc-lies"></div>` : ""}
      <button class="btn btn-primary" id="cc-ok" style="width:100%;margin-top:12px">✓ Enregistrer</button>
      ${!neuf ? `<button class="btn btn-ghost" id="cc-del" style="width:100%;margin-top:8px;color:var(--danger)">🗑 Supprimer ce contact</button>` : ""}`);
    bindNav(() => sheetCabinet());

    const lire = () => {
      c.nom = ($("#cc-nom")||{}).value?.trim() || "";
      c.metier = ($("#cc-met")||{}).value?.trim() || "";
      const cp = $("#cc-comp"); if (cp) c.complement = cp.value.trim();
      const cr = $("#cc-rpps"); if (cr) c.rpps = cr.value.trim();
      c.note = ($("#cc-note")||{}).value?.trim() || "";
      (c.coord||[]).forEach((x,i) => {
        const t = $(`[data-cct="${i}"]`), v = $(`[data-ccv="${i}"]`);
        if (t) x.type = t.value;
        if (v) x.val = v.value.trim();
      });
    };
    { const b = $("#cc-comp-pick");
      if (b) b.onclick = async () => {
        lire();
        const perso = (S.cabComplements || []).filter(m => !CAB_COMPLEMENTS.includes(m));
        const choix = await askChoice({ ic:"📋", titre:"Complément",
          sub:"Ou « Autre… » pour saisir le tien.",
          options:[ ...CAB_COMPLEMENTS, ...perso ].map(m => ({ lbl:m, val:m }))
                    .concat([{ ic:"✏️", lbl:"Autre…", val:"__autre" }]) });
        if (!choix) return;
        if (choix === "__autre"){
          const libre = await askText("Complément", { ic:"✏️", ph:"Ton intitulé", val:c.complement || "" });
          if (!libre) return;
          c.complement = libre.trim();
          S.cabComplements = [...new Set([...(S.cabComplements||[]), c.complement])];
          save(true);
        } else c.complement = choix;
        draw();
      }; }
    { const b = $("#cc-met-pick");
      if (b) b.onclick = async () => {
        lire();
        const base = (c.cat === "utile" ? CAB_UTILES : CAB_METIERS);
        /* Les métiers ajoutés par l'utilisateur rejoignent la liste */
        const perso = (S.cabMetiers || []).filter(m => !base.includes(m));
        const choix = await askChoice({ ic:"📋", titre:"Métier", sub:"Ou « Autre… » pour saisir le tien.",
          options:[ ...base, ...perso ].map(m => ({ lbl:m, val:m }))
                    .concat([{ ic:"✏️", lbl:"Autre…", val:"__autre" }]) });
        if (!choix) return;
        if (choix === "__autre"){
          const libre = await askText("Métier", { ic:"✏️", ph:"Ostéopathe, diététicien…", val:c.metier || "" });
          if (!libre) return;
          c.metier = libre.trim();
          /* ⚠️ On MÉMORISE le métier saisi : sans cela, il faudrait le
             retaper pour chaque contact du même type. */
          S.cabMetiers = [...new Set([...(S.cabMetiers||[]), c.metier])];
          save(true);
        } else c.metier = choix;
        draw();
      }; }
    
    { const a = $("#cc-add"); if (a) a.onclick = () => { lire(); (c.coord = c.coord||[]).push({ type:"tel", val:"", vis:"patient" }); draw(); }; }
    $$("#sheet [data-ccrm]").forEach(b => b.onclick = () => { lire(); c.coord.splice(+b.dataset.ccrm, 1); draw(); });
    /* ⚠️ Le clavier et l'invite sont posés au DESSIN, d'après le type.
       Changer le type ensuite ne les mettait pas à jour : on choisissait
       « E-mail » et le pavé numérique s'ouvrait quand même. */
    $$("#sheet [data-cct]").forEach(sel => sel.addEventListener("change", () => {
      const i = sel.dataset.cct;
      const v = $(`[data-ccv="${i}"]`);
      if (!v) return;
      const t = sel.value;
      v.inputMode = t === "mail" ? "email" : t === "adresse" ? "text" : "tel";
      v.type      = t === "mail" ? "email" : "text";
      v.placeholder = t === "mail" ? "adresse@exemple.fr"
                    : t === "adresse" ? "Adresse postale"
                    : t === "fax" ? "Numéro de fax"
                    : t === "autre" ? "Valeur" : "Numéro";
      /* Le clavier ne change qu'au prochain focus : on le force si le
         champ est déjà actif. */
      if (document.activeElement === v){ v.blur(); v.focus(); }
    }));

    $$("#sheet [data-ccvis]").forEach(b => b.onclick = () => {
      lire(); const [i, v] = b.dataset.ccvis.split("|"); c.coord[+i].vis = v; draw();
    });
    /* Qui, parmi les patients, est lié à ce contact ? */
    if (!neuf){
      const lies = cabPatientsLies(c.id);
      const e = $("#cc-lies");
      if (e && lies.length) e.innerHTML = `<div class="rowlab vi"><span>Patients liés</span><i></i><em>${lies.length}</em></div>
        <div class="rowbox vi" style="display:block"><p class="small" style="margin:0">${
          lies.map(p => esc(p.prenom + " " + p.nom.replace("Demo-","").toUpperCase())).join(" · ")}</p></div>`;
    }
    { const o = $("#cc-ok"); if (o) o.onclick = async () => {
        lire();
        if (!c.nom){ toast("Il faut au moins un nom", "danger"); return; }
        if (neuf) C.contacts.push(c);
        else await cabPropager(c);       // remonter la modification dans les fiches liées
        save(true);
        sheetCabinet();
      }; }
    { const d = $("#cc-del"); if (d) d.onclick = async () => {
        const lies = cabPatientsLies(c.id);
        if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce contact ?",
          sub: lies.length ? lies.length + " fiche(s) patient y sont liées." : "",
          warn: lies.length ? "Elles <b>gardent</b> le nom et les numéros déjà enregistrés : rien ne se vide. Elles cessent simplement de suivre l'annuaire." : "",
          oui:"🗑 Supprimer" })) return;
        /* ⚠️ On DÉTACHE les fiches au lieu de les vider : l'annuaire met à
           jour, il ne commande pas. */
        (S.patients||[]).forEach(p => (p.medecins||[]).concat(p.entourage||[]).forEach(m => {
          if (m.cabRef === c.id) delete m.cabRef;
        }));
        C.contacts = C.contacts.filter(x => x.id !== c.id);
        save(true); sheetCabinet();
      }; }
  };
  draw();
}

/* Les patients dont un contact est lié à cette fiche d'annuaire */
function cabPatientsLies(refId){
  return (S.patients||[]).filter(p =>
    (p.medecins||[]).some(m => m.cabRef === refId) ||
    (p.entourage||[]).some(m => m.cabRef === refId));
}

/* ⚠️ Propager une modification : jamais en silence. On dit combien de
   fiches sont concernées, et on laisse le choix — un numéro peut très
   bien changer pour les pros sans devoir descendre chez les patients. */
async function cabPropager(c){
  const lies = cabPatientsLies(c.id);
  if (!lies.length) return;
  const choix = await askChoice({ ic:"🔄", titre:"Ce contact est lié à " + lies.length + " fiche(s)",
    sub:"Que faire des dossiers qui le reprennent ?",
    options:[
      { ic:"✓", lbl:"Mettre à jour les " + lies.length + " fiches", val:"oui" },
      { ic:"🔒", lbl:"Garder le changement ici seulement", val:"non" } ] });
  if (choix !== "oui") return;
  let n = 0;
  lies.forEach(p => {
    [...(p.medecins||[]), ...(p.entourage||[])].forEach(m => {
      if (m.cabRef !== c.id) return;
      m.nom = c.nom;
      const vis = coordPrincipale(c, true), p1 = vis || coordPrincipale(c, false);
      if (p1) m.tel = p1.val;
      if (!vis && p1) m.visPro = true; else delete m.visPro;
      if (c.metier) m.spec = m.spec || c.metier;
      n++;
    });
  });
  toast(n + " fiche(s) mise(s) à jour");
}

/* ── Puiser dans l'annuaire depuis une fiche patient ── */
async function cabChoisir(cat, spec){
  const tous = cabContacts(cat).filter(c => c.nom);
  let l = spec ? tous.filter(c => cabCorrespond(c, spec)) : tous;
  /* ⚠️ Un filtre qui ne donne rien ne doit pas afficher une liste vide :
     on le dit, et on propose l'annuaire entier. */
  if (spec && !l.length && tous.length){
    const tout = await askDialog({ ic:"🏥", titre:"Aucun contact en « " + esc(spec) + " »",
      sub:"Ton annuaire contient " + tous.length + " contact(s), mais aucun avec cette spécialité.",
      oui:"Voir tout l'annuaire", non:"Annuler" });
    if (!tout) return null;
    l = tous;
  }
  if (!l.length){
    await askDialog({ ic:"🏥", titre:"L'annuaire du cabinet est vide",
      sub:"Ajoute-y tes correspondants une fois, et tu les retrouveras dans chaque dossier.",
      oui:"J'ai compris", seul:true });
    return null;
  }
  const choix = await askChoice({ ic:"🏥",
    titre: spec && l.length < tous.length ? esc(spec) + " du cabinet" : "Choisir dans l'annuaire",
    sub: spec && l.length < tous.length
      ? l.length + " sur " + tous.length + " contact(s) · le lien permettra les mises à jour"
      : "Le contact restera lié : une correction au cabinet pourra descendre ici.",
    options: l.sort((a,b)=>(a.nom||"").localeCompare(b.nom||"","fr")).slice(0, 40)
      .map(c => ({ ic:CAB_CATS[c.cat] ? CAB_CATS[c.cat].ic : "👤", lbl:cabLigne(c), val:c.id })) });
  if (!choix) return null;
  const c = cabContact(choix); if (!c) return null;
  /* ⚠️ On prend d'abord une coordonnée VISIBLE DU PATIENT. Si le contact
     n'en a que des « pros seuls », on la prend quand même — le dossier en
     a besoin — mais on la MARQUE, pour qu'aucun document remis au patient
     ne la fasse sortir. */
  const vis = coordPrincipale(c, true);
  const p1 = vis || coordPrincipale(c, false);
  const m = { nom:c.nom, tel:p1 ? p1.val : "", spec:c.metier || "", cabRef:c.id };
  if (!vis && p1) m.visPro = true;
  return m;
}

/* ── Mon en-tête ── */
function cabEnteteHTML(){
  const E = cabinet().entete || {};
  return `
    <div class="lab">Ton identité professionnelle</div>
    <!-- ⚠️ L'identité a quitté le cabinet : elle vivait en triple avec
         trois cabinets. Ces champs renvoient désormais à Ma fiche. -->
    <div class="tip" style="margin-bottom:10px">Ton nom, ton titre, ton RPPS et ton numéro AM sont désormais dans <b>👤 Ma fiche</b> — saisis une seule fois, ils valent pour tous tes cabinets.</div>
    <button class="btn btn-ghost" id="ce-moi" style="width:100%;margin-bottom:10px">👤 Ouvrir ma fiche</button>
    <div class="tip">L'en-tête est <b>le tien</b>, sous ta responsabilité. L'adresse et le téléphone sont repris de l'onglet « Le cabinet ».</div>
    <div class="rowlab vi" style="margin-top:14px"><span>Éditer un document</span><i></i></div>
    <button class="btn btn-ghost" id="ce-courrier" style="width:100%;margin-bottom:6px">✉️ Écrire un courrier à un confrère</button>
    <button class="btn btn-ghost" id="ce-vierge" style="width:100%;margin-bottom:6px">📄 Feuille vierge à en-tête</button>
    <button class="btn btn-ghost" id="ce-ordo" style="width:100%">💊 Ordonnance pré-imprimée</button>
    <p class="small muted" style="margin-top:6px">Une feuille à ton en-tête, à remplir à la main. Depuis une fiche patient, son identité est reprise.</p>`;
}
function cabEnteteBind(){
  /* ⚠️ Les champs d'identité ont quitté cet écran pour Ma fiche :
     plus rien à câbler ici. `cabinet().entete` n'est conservé que pour
     relire les données d'avant la bascule. */
  { const m2 = $("#ce-moi"); if (m2) m2.onclick = () => sheetMoi(); }
  { const c = $("#ce-courrier"); if (c) c.onclick = () => sheetCourrier(); }
  { const v = $("#ce-vierge");   if (v) v.onclick = () => sheetCourrier({ vierge:true }); }
  { const o = $("#ce-ordo"); if (o) o.onclick = () => sheetOrdonnance(); }
}


/* ⚠️ LE FILTRE DES DOCUMENTS REMIS AU PATIENT.
   Un contact copié depuis l'annuaire peut porter un numéro « pros
   seuls » (visPro) : il doit rester lisible dans la fiche, mais ne
   JAMAIS figurer sur une feuille domicile, un DLU ou un dossier remis
   à la personne. Tous ces écrans passent par ici. */
function contactsPourPatient(liste){
  return (liste || []).filter(m => !m.visPro);
}
/* Version qui garde le nom mais efface le numéro réservé : utile quand
   supprimer la ligne entière ferait croire à une absence de médecin. */
function contactsSansNumeroPro(liste){
  return (liste || []).map(m => m.visPro ? { ...m, tel:"" } : m);
}

/* ============================================================
   L'ALLER-RETOUR EXCEL
   ─────────────────────────────────────────────────────────
   Saisir trente correspondants au pouce est décourageant ; au clavier
   sur un PC, c'est l'affaire d'un quart d'heure. D'où un classeur qui
   sort, se remplit, et revient.

   ⚠️ La bibliothèque pèse 860 Ko : elle n'est chargée QU'AU MOMENT de
   l'export ou de l'import, jamais au démarrage.

   ⚠️ Une protection Excel se retire en trois clics : elle évite la
   fausse manœuvre, elle ne garantit rien. LE VRAI FILET EST À L'IMPORT,
   où la structure est vérifiée avant qu'on lise une seule ligne.

   ⚠️ Chaque ligne porte une colonne « ref » MASQUÉE : sans elle,
   réimporter créerait des doublons au lieu de mettre à jour.
============================================================ */
const CAB_XLS_VERSION = 1;
/* La signature attendue de chaque onglet : c'est elle qui fait foi à
   l'import, pas la position des colonnes. */
const CAB_XLS_SCHEMA = {
  "Praticiens":      ["ref","Nom","Métier","Complément","N° RPPS","Note"],
  "Partenaires":     ["ref","Nom","Métier","Note"],
  "Numéros utiles":  ["ref","Nom","Métier","Note"],
  "Coordonnées":     ["ref","Contact","Type","Valeur","Visibilité"]
};
const CAB_VIS_LBL = { patient:"Visible du patient", pro:"Pros seuls" };

/* ============================================================
   CHARGEMENT À LA DEMANDE DES GROSSES BIBLIOTHÈQUES
   ⚠️ 1,35 Mo étaient chargés AU DÉMARRAGE — pdfjs, jsPDF, jsQR,
   qrcode — alors qu'ils ne servent qu'à ouvrir un PDF, produire un
   document ou scanner un code. Sur un téléphone, cela retardait
   l'ouverture de l'app à chaque fois, pour rien.
============================================================ */
const _libs = {};
function chargerLib(src, pret){
  if (pret()) return Promise.resolve(true);
  if (_libs[src]) return _libs[src];
  _libs[src] = new Promise((ok, ko) => {
    const el = document.createElement("script");
    el.src = src;
    el.onload = () => ok(true);
    el.onerror = () => { delete _libs[src]; ko(new Error(src)); };
    document.head.appendChild(el);
  });
  return _libs[src];
}
const libPdfMake = () => chargerLib("js/libs/jspdf.min.js", () => !!(window.jspdf && window.jspdf.jsPDF));
const libPdfLire = () => chargerLib("js/libs/pdfjs.js",    () => !!window.pdfjsLib);
const libQrLire  = () => chargerLib("js/libs/jsQR.js",     () => !!window.jsQR);
const libQrFaire = () => chargerLib("js/libs/qrcode.js",   () => !!window.QRCode);

async function xlsCharger(){
  if (window.ExcelJS) return window.ExcelJS;
  await new Promise((ok, ko) => {
    const s = document.createElement("script");
    s.src = "js/libs/exceljs.min.js";
    s.onload = ok; s.onerror = () => ko(new Error("exceljs"));
    document.head.appendChild(s);
  });
  return window.ExcelJS;
}

async function cabExportXlsx(){
  let XL;
  toast("Préparation du classeur…");
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }

  const C = cabinet();
  const wb = new XL.Workbook();
  wb.creator = "JM@Santé"; wb.created = new Date();

  const ACCENT = "FF1D9E75", DOUX = "FFF2F8F6", GRIS = "FF55635E";
  const entete = (ws, cols) => {
    ws.getRow(1).values = cols;
    ws.getRow(1).eachCell(c => {
      c.font = { bold:true, color:{ argb:"FFFFFFFF" }, size:11 };
      c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:ACCENT } };
      c.alignment = { vertical:"middle" };
      c.border = { bottom:{ style:"thin", color:{ argb:"FFD5DEDB" } } };
    });
    ws.getRow(1).height = 22;
    ws.views = [{ state:"frozen", ySplit:1 }];      // l'en-tête reste visible
    ws.getColumn(1).hidden = true;                  // la colonne « ref »
  };
  /* Une liste déroulante : plus de faute de frappe, donc plus de doublon */
  const listeDer = (ws, colLettre, valeurs, jusqu, libre) => {
    for (let r = 2; r <= jusqu; r++){
      ws.getCell(colLettre + r).dataValidation = {
        type:"list", allowBlank:true, formulae:['"' + valeurs.join(",") + '"'],
        /* ⚠️ « libre » : la liste propose mais n'impose pas — un métier
           ou un complément absent de la liste doit pouvoir être tapé. */
        showErrorMessage: !libre,
        errorTitle:"Valeur non prévue", error:"Choisis dans la liste, ou tape ce que tu veux."
      };
    }
  };
  const LIGNES = 300;   // de la place pour saisir à la suite

  /* ── Lisez-moi ── */
  const ws0 = wb.addWorksheet("Lisez-moi");
  ws0.columns = [{ width:100 }];
  [["JM@Santé — annuaire du cabinet", 16, true],
   ["", 11, false],
   ["Ce classeur sert à saisir tes correspondants au clavier, puis à les réimporter dans l'application.", 11, false],
   ["", 11, false],
   ["Un contact = une ligne d'identité + autant de coordonnées que nécessaire", 13, true],
   ["Les onglets Praticiens, Partenaires et Numéros utiles portent l'IDENTITÉ : nom, métier, note.", 11, false],
   ["Les numéros et e-mails vivent dans l'onglet COORDONNÉES, une ligne chacun.", 11, false],
   ["Un même médecin peut donc avoir trois numéros, deux e-mails et une adresse :", 11, false],
   ["il suffit d'ajouter une ligne par coordonnée, en recopiant son nom dans la colonne « Contact ».", 11, false],
   ["", 11, false],
   ["Exemple", 13, true],
   ["Partenaires  →  Dr Martin | Médecin généraliste | (note)", 11, false],
   ["Coordonnées  →  Dr Martin | Téléphone | 04 94 00 00 00 | Visible du patient", 11, false],
   ["Coordonnées  →  Dr Martin | Mobile    | 06 11 11 11 11 | Pros seuls", 11, false],
   ["Coordonnées  →  Dr Martin | E-mail    | martin@exemple.fr | Visible du patient", 11, false],
   ["", 11, false],
   ["Les colonnes Métier et Complément proposent des choix, mais tu peux taper autre chose.", 11, false],
   ["", 11, false],
   ["À ne pas faire", 13, true],
   ["• Ne renomme pas les onglets, ne déplace pas les colonnes : l'import refuserait le fichier.", 11, false],
   ["• Ne touche pas à la première colonne, masquée : elle relie chaque ligne à sa fiche.", 11, false],
   ["• Laisse les numéros en texte, pour ne pas perdre le zéro initial.", 11, false],
   ["", 11, false],
   ["Visibilité d'une coordonnée", 13, true],
   ["« Visible du patient » : peut figurer sur une feuille domicile, un DLU, un dossier remis.", 11, false],
   ["« Pros seuls » : reste dans l'application, ne sort sur aucun document remis au patient.", 11, false],
   ["Cela vaut pour un e-mail comme pour un numéro.", 11, false],
   ["", 11, false],
   ["Exporté le " + new Date().toLocaleDateString("fr-FR") + " · cabinet « " + (C.nom || "sans nom") + " » · format v" + CAB_XLS_VERSION, 10, false]
  ].forEach(([t, sz, gras], i) => {
    const c = ws0.getCell("A" + (i+1));
    c.value = t; c.font = { size:sz, bold:gras, color:{ argb: gras ? ACCENT : "FF1A2420" } };
  });

  /* ── Le cabinet ── */
  const ws1 = wb.addWorksheet("Le cabinet");
  ws1.columns = [{ width:26 }, { width:58 }];
  [["Nom du cabinet", C.nom||""], ["Adresse", C.adresse||""], ["Téléphone", C.tel||""],
   ["E-mail", C.mail||""], ["", ""],
   ["Nom et prénom (en-tête)", (C.entete||{}).nom||""],
   ["Titre", (C.entete||{}).titre||""], ["RPPS ou ADELI", (C.entete||{}).rpps||""]
  ].forEach(([k, v], i) => {
    const r = i + 1;
    const a = ws1.getCell("A" + r), b = ws1.getCell("B" + r);
    a.value = k; a.font = { bold:true, color:{ argb:GRIS }, size:11 };
    b.value = v; b.numFmt = "@";
    if (k) b.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:DOUX } };
  });

  /* ── Les trois onglets de contacts ── */
  const feuille = (nom, cat) => {
    const ws = wb.addWorksheet(nom);
    const cols = CAB_XLS_SCHEMA[nom];
    ws.columns = cols.map((c,i) => ({ width: i===0 ? 14 : c==="Nom" ? 30 : c==="Note" ? 40 : 22 }));
    entete(ws, cols);
    cabContacts(cat).forEach((c, i) => {
      const r = i + 2;
      ws.getCell("A"+r).value = c.id;
      ws.getCell("B"+r).value = c.nom || "";
      ws.getCell("C"+r).value = c.metier || "";
      if (nom === "Praticiens"){
        ws.getCell("D"+r).value = c.complement || "";
        ws.getCell("E"+r).value = c.rpps || "";
        ws.getCell("F"+r).value = c.note || "";
      } else ws.getCell("D"+r).value = c.note || "";
    });
    /* ⚠️ Suggestions, pas carcan : la saisie libre reste permise
       (allowBlank + pas de refus strict hors listes fermées). */
    listeDer(ws, "C", nom === "Numéros utiles" ? CAB_UTILES : CAB_METIERS, LIGNES, true);
    if (nom === "Praticiens") listeDer(ws, "D", CAB_COMPLEMENTS, LIGNES, true);
    ws.getColumn(2).numFmt = "@";
    return ws;
  };
  feuille("Praticiens", "praticien");
  feuille("Partenaires", "partenaire");
  feuille("Numéros utiles", "utile");

  /* ── Les coordonnées, une par ligne ── */
  const ws5 = wb.addWorksheet("Coordonnées");
  ws5.columns = [{ width:14 }, { width:30 }, { width:16 }, { width:28 }, { width:22 }];
  entete(ws5, CAB_XLS_SCHEMA["Coordonnées"]);
  let r = 2;
  cabContacts().forEach(c => (c.coord||[]).forEach(x => {
    ws5.getCell("A"+r).value = c.id;
    ws5.getCell("B"+r).value = c.nom || "";
    ws5.getCell("C"+r).value = CAB_TYPES[x.type] || "Téléphone";
    ws5.getCell("D"+r).value = String(x.val || "");
    ws5.getCell("E"+r).value = CAB_VIS_LBL[x.vis === "pro" ? "pro" : "patient"];
    r++;
  }));
  /* ⚠️ Format TEXTE sur les valeurs : sinon Excel mange le zéro de tête
     et « 06 12 34 56 78 » devient un nombre. */
  ws5.getColumn(4).numFmt = "@";
  ws5.getColumn(2).numFmt = "@";
  listeDer(ws5, "C", Object.values(CAB_TYPES), LIGNES);
  listeDer(ws5, "E", Object.values(CAB_VIS_LBL), LIGNES);

  /* Garde-fou contre la fausse manœuvre — pas une serrure */
  for (const ws of [ws0, ws1]) { /* pages de saisie libre : on ne protège pas */ }

  const buf = await wb.xlsx.writeBuffer();
  const sansAccent = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const nomFichier = "Annuaire_" + (sansAccent(C.nom || "cabinet").replace(/[^\w-]+/g,"_").replace(/_+/g,"_") || "cabinet")
                   + "_" + new Date().toISOString().slice(0,10) + ".xlsx";
  await cabLivrer(nomFichier, buf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* Enregistrer, avec repli sur le téléchargement du navigateur */
async function cabLivrer(nom, buf, mime){
  const b64 = _b64(new Uint8Array(buf));
  try {
    const ou = await saveToDevice(nom, "data:" + mime + ";base64," + b64, { mime, base64:true });
    toast("Classeur enregistré — " + ou);
    return;
  } catch(e){}
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type:mime }));
    a.download = nom; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Classeur téléchargé");
  } catch(e2){ toast("Export impossible", "danger"); logIncident("cabinet", "Export xlsx", e2); }
}

/* ── L'IMPORT ──
   ⚠️ On vérifie la structure AVANT de lire quoi que ce soit, et on
   refuse franchement : un classeur dont les onglets ont été renommés
   ou les colonnes déplacées ne doit pas produire un import approximatif. */
function cabVerifierClasseur(wb){
  const manques = [];
  for (const [nom, cols] of Object.entries(CAB_XLS_SCHEMA)){
    const ws = wb.getWorksheet(nom);
    if (!ws){ manques.push("onglet « " + nom + " »"); continue; }
    const lus = (ws.getRow(1).values || []).slice(1).map(v => String(v || "").trim());
    cols.forEach((c, i) => {
      if ((lus[i] || "").toLowerCase() !== c.toLowerCase())
        manques.push("colonne « " + c + " » de l'onglet « " + nom + " »");
    });
  }
  return manques;
}

async function cabImportXlsx(fichier){
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  try { await wb.xlsx.load(await fichier.arrayBuffer()); }
  catch(e){ toast("Fichier illisible", "danger"); return; }

  const manques = cabVerifierClasseur(wb);
  if (manques.length){
    await askDialog({ ton:"danger", ic:"📄", titre:"Ce classeur n'a pas la bonne structure",
      sub:"Il manque : " + manques.slice(0,3).join(", ") + (manques.length > 3 ? "…" : ""),
      warn:"Repars du classeur exporté par l'application : ne renomme pas les onglets et ne déplace pas les colonnes.",
      oui:"J'ai compris", seul:true });
    return;
  }

  /* Les contacts du fichier */
  const lus = [];
  const txt = v => v == null ? "" : (typeof v === "object" && v.text ? String(v.text) : String(v)).trim();
  [["Praticiens","praticien"],["Partenaires","partenaire"],["Numéros utiles","utile"]].forEach(([nom, cat]) => {
    const ws = wb.getWorksheet(nom); if (!ws) return;
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const v = row.values || [];
      const n = txt(v[2]); if (!n) return;
      const c = { id: txt(v[1]) || uid(), cat, nom:n, metier: txt(v[3]), coord:[] };
      if (nom === "Praticiens"){ c.complement = txt(v[4]); c.rpps = txt(v[5]); c.note = txt(v[6]); }
      else c.note = txt(v[4]);
      lus.push(c);
    });
  });
  /* Les coordonnées, rattachées par identifiant sinon par nom */
  const parType = Object.fromEntries(Object.entries(CAB_TYPES).map(([k,l]) => [l.toLowerCase(), k]));
  const wsC = wb.getWorksheet("Coordonnées");
  if (wsC) wsC.eachRow((row, i) => {
    if (i === 1) return;
    const v = row.values || [];
    const val = txt(v[4]); if (!val) return;
    const ref = txt(v[1]), nom = txt(v[2]);
    const c = lus.find(x => (ref && x.id === ref) || (nom && x.nom.toLowerCase() === nom.toLowerCase()));
    if (!c) return;      // coordonnée orpheline : on l'ignore plutôt que d'inventer un contact
    c.coord.push({ type: parType[txt(v[3]).toLowerCase()] || "tel", val,
                   vis: /pro/i.test(txt(v[5])) ? "pro" : "patient" });
  });

  /* Le cabinet lui-même */
  const ws1 = wb.getWorksheet("Le cabinet");
  const cab = {};
  if (ws1){
    const lire = r => txt((ws1.getRow(r).values || [])[2]);
    cab.nom = lire(1); cab.adresse = lire(2); cab.tel = lire(3); cab.mail = lire(4);
    cab.entete = { nom:lire(6), titre:lire(7), rpps:lire(8) };
  }
  await cabComparer(lus, cab, "le classeur");
}

/* ⚠️ Le même écran sert à l'import Excel et à une synchro reçue :
   trois piles, une case à cocher par contact. Jamais de fusion en bloc. */
async function cabComparer(lus, cab, source){
  const C = cabinet();
  const cle = c => (c.nom||"").toLowerCase().trim();
  const parRef = Object.fromEntries(C.contacts.map(c => [c.id, c]));
  const parNom = {}; C.contacts.forEach(c => { parNom[cle(c)] = c; });

  const nouveaux = [], differents = [], identiques = [];
  lus.forEach(c => {
    const a = parRef[c.id] || parNom[cle(c)];
    if (!a){ nouveaux.push({ c }); return; }
    const memes = JSON.stringify([a.nom, a.metier, a.note||"", (a.coord||[])]) ===
                  JSON.stringify([c.nom, c.metier, c.note||"", (c.coord||[])]);
    if (memes) identiques.push({ c, a }); else differents.push({ c, a });
  });

  if (!nouveaux.length && !differents.length){
    toast("Rien de nouveau dans " + source);
    return;
  }
  /* ⚠️ On rend la main SEULEMENT quand l'utilisateur a tranché : sinon la
     suite d'une réception de synchro ouvrirait son propre écran par-dessus
     celui-ci, et la comparaison disparaîtrait sans avoir servi. */
  let _fini;
  const attendre = new Promise(r => { _fini = r; });
  /* ⚠️ Les clés doivent être celles des boutons (« n0 », « dif0 ») :
     avec de simples index, rien n'était coché au départ et le premier
     clic inversait l'effet attendu. Tout est coché d'emblée — on décoche
     ce qu'on ne veut pas, c'est le cas le plus fréquent. */
  const pris = new Set([...nouveaux.map((_, i) => "n" + i),
                        ...differents.map((_, i) => "dif" + i)]);
  const draw = () => {
    const ligne = (o, i, type) => {
      const dif = type === "dif" ? cabDifference(o.a, o.c) : "";
      return `<button class="selv ${pris.has(type+i)?"on":""}" data-cmpc="${type}${i}">
        <span class="box">${pris.has(type+i)?"✓":""}</span>
        <span class="sv" style="flex:1;min-width:0"><b>${esc(o.c.nom)}</b>
        ${o.c.metier ? ` <span class="small muted">${esc(o.c.metier)}</span>` : ""}
        ${dif ? `<br><span class="small" style="color:var(--amber,var(--accent))">${dif}</span>` : ""}</span>
      </button>`;
    };
    openSheet(`
      ${navHeader("Cabinet", true)}
      <h3>🔄 Annuaire reçu — ${esc(source)}</h3>
      <p class="small muted" style="margin-bottom:10px">Rapprochement par nom. Coche ce que tu veux reprendre, contact par contact.</p>
      ${nouveaux.length ? `<div class="rowlab vi"><span>Nouveaux</span><i></i><em>${nouveaux.length}</em></div>
        ${nouveaux.map((o,i) => ligne(o,i,"n")).join("")}` : ""}
      ${differents.length ? `<div class="rowlab vi"><span>Différents</span><i></i><em>${differents.length}</em></div>
        ${differents.map((o,i) => ligne(o,i,"dif")).join("")}` : ""}
      ${identiques.length ? `<div class="rowlab vi"><span>Identiques</span><i></i><em>${identiques.length}</em></div>
        <p class="small muted" style="margin:0 0 10px">Rien à faire pour ceux-là.</p>` : ""}
      <button class="btn btn-primary" id="cmp-ok" style="width:100%;margin-top:12px">✓ Reprendre ce qui est coché</button>`);
    bindNav(() => sheetCabinet());
    $$("#sheet [data-cmpc]").forEach(b => b.onclick = () => {
      const k = b.dataset.cmpc;
      pris.has(k) ? pris.delete(k) : pris.add(k);
      draw();
    });
    { const o = $("#cmp-ok"); if (o) o.onclick = async () => {
        let n = 0;
        nouveaux.forEach((x,i) => { if (pris.has("n"+i)){ C.contacts.push(x.c); n++; } });
        for (let i = 0; i < differents.length; i++){
          if (!pris.has("dif"+i)) continue;
          const { a, c } = differents[i];
          Object.assign(a, { nom:c.nom, metier:c.metier, note:c.note, coord:c.coord });
          await cabPropager(a);      // les fiches liées suivent, si tu le veux
          n++;
        }
        if (cab && cab.nom !== undefined && (cab.nom || cab.adresse)){
          Object.assign(C, { nom:cab.nom || C.nom, adresse:cab.adresse || C.adresse,
                             tel:cab.tel || C.tel, mail:cab.mail || C.mail });
          if (cab.entete) C.entete = { ...(C.entete||{}), ...cab.entete };
        }
        save(true); toast(n + " contact(s) repris");
        _fini(n);
        if (source === "le classeur") sheetCabinet();   // import Excel : on revient au cabinet
      }; }
    /* Repartir sans rien reprendre reste une réponse */
    ["#nav-back", "#nav-home"].forEach(sel => {
      const r = $(sel);
      if (r) r.addEventListener("click", () => _fini(0), { once:true });
    });
  };
  draw();
  return attendre;
}

/* Ce qui change entre la fiche connue et celle qui arrive */
function cabDifference(a, c){
  const d = [];
  if ((a.metier||"") !== (c.metier||"")) d.push("métier");
  const va = (a.coord||[]).map(x => x.val).join(" "), vc = (c.coord||[]).map(x => x.val).join(" ");
  if (va !== vc){
    const p1 = coordPrincipale(a, false), p2 = coordPrincipale(c, false);
    d.push((p1 ? p1.val : "—") + " → " + (p2 ? p2.val : "—"));
  }
  if ((a.note||"") !== (c.note||"")) d.push("note");
  return esc(d.join(" · "));
}

/* ============================================================
   ÉCRIRE UN COURRIER À EN-TÊTE
   ─────────────────────────────────────────────────────────
   ⚠️ TOUT L'EN-TÊTE EST MODIFIABLE AU MOMENT D'ÉCRIRE. Les champs
   arrivent pré-remplis depuis la fiche cabinet, mais une correction
   ici ne touche PAS la fiche : on écrit parfois depuis une autre
   adresse, avec un autre numéro, sans vouloir changer son dossier.
   Un bouton propose explicitement de reporter la correction.

   ⚠️ Le corps peut rester VIDE : une feuille à en-tête qu'on remplit
   à la main est le besoin le plus courant.

   ⚠️ Aucune ordonnance ici : mentions obligatoires et responsabilité
   engagée. L'emplacement est réservé, le contenu attend son cadrage.
============================================================ */
function sheetCourrier(opts){
  opts = opts || {};
  const C = cabinet();  /* courrier : pas forcément lié à un patient */
  let _sig = signatureChoix(C.id);
  const E = enteteDocument(_sig, C);
  /* Une copie de travail : ni ta fiche ni celle du cabinet ne bougent */
  const d = {
    nom: E.nom || "", titre: E.titre || "", rpps: E.rpps || "", mention: E.mention || "",
    cabinet: E.cabinet, adresse: E.adresse, tel: E.tel, mail: E.mail,
    lieu: E.lieu,
    dest: opts.dest || "", destAdr: opts.destAdr || "",
    objet: opts.objet || "", corps: opts.corps || "",
    vierge: !!opts.vierge, signature: true
  };
  const modifie = () => ["nom","titre","rpps","cabinet","adresse","tel","mail"]
    .some(k => (d[k] || "") !== ((k === "cabinet" ? C.nom : k === "adresse" ? C.adresse
              : k === "tel" ? C.tel : k === "mail" ? C.mail : E[k]) || ""));

  const draw = () => {
    openSheet(`
      ${navHeader("Cabinet", true)}
      <h3>${d.vierge ? "📄 Feuille à en-tête" : "✉️ Courrier à un confrère"}</h3>

      <button class="btn btn-ghost btn-sm" id="co-sig" style="width:100%;margin-bottom:10px">
        ✍️ Qui signe : <b>${d.mention ? "moi, remplaçant" : (_sig.mode === "cabinet" ? "le cabinet" : "moi")}</b></button>
      ${d.mention ? `<p class="small muted" style="margin:-6px 0 10px">${esc(d.mention)}</p>` : ""}
      <div class="rowlab vi"><span>L'en-tête</span><i></i><em>repris de ta fiche, modifiable</em></div>
      <input id="co-nom" class="rec-in" placeholder="Nom et prénom" value="${esc(d.nom)}" style="margin-bottom:6px">
      <div class="rowb" style="gap:6px;margin-bottom:6px">
        <input id="co-titre" class="rec-in" placeholder="Titre" value="${esc(d.titre)}" style="flex:1;min-width:0">
        <input id="co-rpps" class="rec-in" placeholder="RPPS / ADELI" value="${esc(d.rpps)}" style="flex:1;min-width:0">
      </div>
      <input id="co-cabinet" class="rec-in" placeholder="Nom du cabinet" value="${esc(d.cabinet)}" style="margin-bottom:6px">
      <textarea id="co-adresse" class="rec-in" rows="2" placeholder="Adresse" style="margin-bottom:6px">${esc(d.adresse)}</textarea>
      <div class="rowb" style="gap:6px;margin-bottom:6px">
        <input id="co-tel" class="rec-in" placeholder="Téléphone" value="${esc(d.tel)}" inputmode="tel" style="flex:1;min-width:0">
        <input id="co-mail" class="rec-in" placeholder="E-mail" value="${esc(d.mail)}" inputmode="email" style="flex:1;min-width:0">
      </div>
      ${modifie() ? `<button class="btn btn-ghost btn-sm" id="co-report" style="width:100%;margin-bottom:10px">↥ Reporter ces corrections dans la fiche cabinet</button>`
                  : `<p class="small muted" style="margin-bottom:10px">Une correction ici ne touche pas ta fiche cabinet.</p>`}

      <div class="rowlab vi"><span>Le destinataire</span><i></i><em>facultatif</em></div>
      <div class="rowb" style="gap:6px;margin-bottom:6px">
        <input id="co-dest" class="rec-in" placeholder="Nom" value="${esc(d.dest)}" style="flex:1;min-width:0">
        <button class="btn btn-ghost btn-sm" id="co-annu" style="flex:0 0 auto;width:auto">🏥 Annuaire</button>
      </div>
      <textarea id="co-destadr" class="rec-in" rows="2" placeholder="Adresse du destinataire" style="margin-bottom:10px">${esc(d.destAdr)}</textarea>

      <div class="rowlab vi"><span>Le contenu</span><i></i><em>${d.vierge ? "laissé vide" : "ou vide, pour écrire à la main"}</em></div>
      <input id="co-objet" class="rec-in" placeholder="Objet" value="${esc(d.objet)}" style="margin-bottom:6px">
      <textarea id="co-corps" class="rec-in" rows="6" placeholder="Cher confrère,&#10;&#10;…">${esc(d.corps)}</textarea>
      <label class="screl" style="margin:8px 0 10px">
        <input type="checkbox" id="co-sig" ${d.signature ? "checked" : ""}>
        <span>Laisser un espace pour la <b>signature</b></span>
      </label>

      <button class="btn btn-primary" id="co-go" style="width:100%">📄 Produire le document</button>
      <p class="small muted" style="margin-top:8px">Un document à imprimer, ou à enregistrer en PDF depuis l'aperçu de ton téléphone.</p>`);
    bindNav(() => sheetCabinet("entete"));

    const lire = () => {
      [["nom","co-nom"],["titre","co-titre"],["rpps","co-rpps"],["cabinet","co-cabinet"],
       ["adresse","co-adresse"],["tel","co-tel"],["mail","co-mail"],["dest","co-dest"],
       ["destAdr","co-destadr"],["objet","co-objet"],["corps","co-corps"]].forEach(([k, id]) => {
        const e = $("#" + id); if (e) d[k] = e.value.trim();
      });
      const sg = $("#co-sig"); if (sg) d.signature = sg.checked;
    };
    $$("#sheet .rec-in").forEach(e => e.onchange = () => { lire(); draw(); });
    { const a = $("#co-annu"); if (a) a.onclick = async () => {
        lire();
        const c = await cabChoisir("partenaire");
        if (c){ d.dest = c.nom; const ct = cabContact(c.cabRef);
          const adr = ct && (ct.coord||[]).find(x => x.type === "adresse");
          if (adr) d.destAdr = adr.val; }
        draw();
      }; }
    { const b = $("#co-sig");
      if (b) b.onclick = async () => {
        lire();
        const ch = await choisirSignature(C.id);
        if (!ch) return;
        _sig = ch;
        const E2 = enteteDocument(ch, C);
        ["nom","titre","rpps","cabinet","adresse","tel","mail","lieu"].forEach(k => d[k] = E2[k] || "");
        d.mention = E2.mention || "";
        draw();
      }; }
    { const r = $("#co-report"); if (r) r.onclick = async () => {
        lire();
        if (!await askDialog({ ic:"↥", titre:"Reporter dans la fiche cabinet ?",
          sub:"Ton adresse, tes coordonnées et ton en-tête seront mis à jour pour tous les prochains documents.",
          oui:"Reporter", non:"Garder pour ce document seulement" })) return;
        C.nom = d.cabinet; C.adresse = d.adresse; C.tel = d.tel; C.mail = d.mail;
        C.entete = { ...(C.entete||{}), nom:d.nom, titre:d.titre, rpps:d.rpps };
        save(true); toast("Fiche cabinet mise à jour"); draw();
      }; }
    { const g = $("#co-go"); if (g) g.onclick = async () => {
        lire();
        if (!pdfDispo()) toast("Préparation du document…");
        await pdfPret();
        produireCourrier(d);
      }; }
  };
  draw();
}

function produireCourrier(d){
  const nl = t => esc(t).replace(/\n/g, "<br>");
  const dateFR = new Date().toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" });
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>${esc(d.objet || (d.vierge ? "Feuille à en-tête" : "Courrier"))}</title><style>
@page{ size:A4; margin:20mm 18mm; }
body{ font-family:Georgia,"Times New Roman",serif; color:#1a2420; line-height:1.55; font-size:12pt;
  max-width:174mm; margin:0 auto; padding:10mm; }
.tete{ display:flex; justify-content:space-between; align-items:flex-start;
  border-bottom:1.5pt solid #1d9e75; padding-bottom:8pt; margin-bottom:14pt; }
.tete .g{ font-size:11pt } .tete .g b{ font-size:13pt }
.tete .d{ text-align:right; font-size:10pt; color:#55635e }
.small{ font-size:10pt; color:#55635e }
.date{ text-align:right; font-size:10.5pt; color:#55635e; margin-bottom:12pt }
.dest{ text-align:right; margin-bottom:18pt }
.objet{ margin-bottom:14pt }
.corps{ min-height:${d.corps ? "auto" : "90mm"}; white-space:pre-wrap }
.sig{ margin-top:${d.corps ? "22pt" : "14pt"}; display:flex; justify-content:flex-end }
.sig div{ width:55mm; border-top:0.5pt solid #b9c4c0; padding-top:4pt; text-align:center;
  font-size:9.5pt; color:#55635e; height:26mm }
@media print{ body{ padding:0 } }
</style></head><body>
  <div class="tete">
    <div class="g"><b>${esc(d.nom)}</b>
      ${d.titre ? `<br>${esc(d.titre)}` : ""}
      ${d.rpps ? `<br><span class="small">RPPS ${esc(d.rpps)}</span>` : ""}</div>
    <div class="d">${d.cabinet ? esc(d.cabinet) + "<br>" : ""}${nl(d.adresse)}
      ${d.tel ? "<br>" + esc(d.tel) : ""}${d.mail ? "<br>" + esc(d.mail) : ""}</div>
  </div>
  <p class="date">${d.lieu ? esc(d.lieu) + ", le " : "Le "}${esc(dateFR)}</p>
  ${d.dest || d.destAdr ? `<div class="dest">${d.dest ? "<b>" + esc(d.dest) + "</b>" : ""}
    ${d.destAdr ? `<br><span class="small">${nl(d.destAdr)}</span>` : ""}</div>` : ""}
  ${d.objet ? `<p class="objet"><span class="small">Objet :</span> ${esc(d.objet)}</p>` : ""}
  <div class="corps">${d.corps ? nl(d.corps) : ""}</div>
  ${d.signature ? `<div class="sig"><div>Signature</div></div>` : ""}
</body></html>`;
  /* ⚠️ Même piège que l'ordonnance : pas de window.open dans la WebView,
     et le PDF plutôt que le HTML pour obtenir l'impression. */
  if (pdfDispo()){ courrierPdf(d); return; }
  const base = (d.vierge ? "Feuille_entete_" : "Courrier_") + new Date().toISOString().slice(0,10);
  if (typeof imprimerDocument === "function"){ imprimerDocument(html, base); return; }
  (async () => {
    try { const ou = await saveToDevice(base + ".html", html, { mime:"text/html" }); toast("Document enregistré — " + ou); }
    catch(e){ toast("Impression indisponible", "danger"); }
  })();
}

/* ============================================================
   ORDONNANCE PRÉ-IMPRIMÉE
   ─────────────────────────────────────────────────────────
   Reprend la maquette validée : en-tête à deux colonnes, pastilles
   RPPS et AM, cadre patient, zone réglée, bloc de signature.

   ⚠️ RÈGLE ABSOLUE : UNE DONNÉE ABSENTE NE LAISSE AUCUNE TRACE.
   Jamais de « {{…}} » imprimé, jamais de libellé orphelin : on garde
   « Date : » et sa ligne, mais un bloc entier disparaît s'il est vide
   — une pastille AM sans numéro, un courriel absent. Une ordonnance
   couverte d'accolades ne s'utilise pas.

   ⚠️ La DATE reste toujours vide : elle s'écrit à la main, comme la
   taille et le poids. Le SEXE est coché d'après le dossier, corrigeable.

   ⚠️ Ce document est celui de l'utilisateur : aucune mention n'est
   ajoutée ni vérifiée ici. Il l'a cadré, il en répond.
============================================================ */
function sheetOrdonnance(pid){
  const p0 = pid ? getP(pid) : null;
  /* ⚠️ Le cabinet DU PATIENT, pas celui qui est ouvert : un document
     pour un patient du Cabinet A sortait à l'en-tête du B si on y avait
     travaillé la veille. Le choix « Qui signe » reste ouvert. */
  const C = cabinetPourDoc(p0);
  /* L'identité vient de MA FICHE, le lieu du cabinet ouvert. Le choix
     « qui signe » peut y ajouter la mention « remplaçant de ». */
  let _sig = signatureChoix(C.id);
  const E = enteteDocument(_sig, C);
  const d = {
    nom: E.nom || "", titre: E.titre || "Infirmier(ère) Diplômé(e) d'État — Exercice Libéral",
    cabinet: E.cabinet, adresse: E.adresse, tel: E.tel, mail: E.mail,
    rpps: E.rpps || "", am: E.am || "", mention: E.mention || "",
    patient: p0 ? ((p0.prenom || "") + " " + (p0.nom || "").replace("Demo-","").toUpperCase()).trim() : "",
    ne: p0 && p0.dob ? p0.dob.split("-").reverse().join("/") : "",
    nir: p0 ? (p0.nir || "") : "",
    /* ⚠️ Coché d'après le dossier, jamais imposé : un genre mal saisi
       ne doit pas partir imprimé sans qu'on puisse le corriger. */
    sexe: p0 ? (p0.genre === "M" || p0.genre === "H" ? "M" : p0.genre === "F" ? "F" : "") : "",
    lignes: 22
  };

  const draw = () => {
    openSheet(`
      ${navHeader(pid ? "Fiche" : "Cabinet", true)}
      <h3>💊 Ordonnance${d.patient ? " — " + esc(d.patient) : " vierge"}</h3>
      <p class="small muted" style="margin-bottom:10px">Une feuille à ton en-tête, à remplir à la main. <b>Ce qui reste vide ne s'imprime pas</b> : ni balise, ni cadre à moitié rempli.</p>

      <button class="btn btn-ghost btn-sm" id="or-sig" style="width:100%;margin-bottom:10px">
        ✍️ Qui signe : <b>${d.mention ? "moi, remplaçant" : (_sig.mode === "cabinet" ? "le cabinet" : "moi")}</b></button>
      ${d.mention ? `<p class="small muted" style="margin:-6px 0 10px">${esc(d.mention)}</p>` : ""}
      <div class="rowlab vi"><span>Ton en-tête</span><i></i><em>repris de ta fiche, modifiable</em></div>
      <input id="or-nom" class="rec-in" placeholder="Nom et prénom" value="${esc(d.nom)}" style="margin-bottom:6px">
      <input id="or-titre" class="rec-in" placeholder="Titre" value="${esc(d.titre)}" style="margin-bottom:6px">
      <div class="rowb" style="gap:6px;margin-bottom:6px">
        <input id="or-rpps" class="rec-in" placeholder="N° RPPS" value="${esc(d.rpps)}" style="flex:1;min-width:0">
        <input id="or-am" class="rec-in" placeholder="N° AM (CPAM)" value="${esc(d.am)}" style="flex:1;min-width:0">
      </div>
      <input id="or-cabinet" class="rec-in" placeholder="Nom du cabinet" value="${esc(d.cabinet)}" style="margin-bottom:6px">
      <textarea id="or-adresse" class="rec-in" rows="2" placeholder="Adresse">${esc(d.adresse)}</textarea>
      <div class="rowb" style="gap:6px;margin:6px 0 10px">
        <input id="or-tel" class="rec-in" placeholder="Téléphone" value="${esc(d.tel)}" inputmode="tel" style="flex:1;min-width:0">
        <input id="or-mail" class="rec-in" placeholder="Courriel" value="${esc(d.mail)}" inputmode="email" style="flex:1;min-width:0">
      </div>

      <div class="rowlab vi"><span>Le patient</span><i></i><em>${pid ? "repris du dossier" : "laisse vide pour une feuille vierge"}</em></div>
      <input id="or-patient" class="rec-in" placeholder="Nom et prénom du patient" value="${esc(d.patient)}" style="margin-bottom:6px">
      <div class="rowb" style="gap:6px;margin-bottom:6px">
        <input id="or-ne" class="rec-in" placeholder="Né(e) le" value="${esc(d.ne)}" style="flex:1;min-width:0">
        <input id="or-nir" class="rec-in" placeholder="N° de sécurité sociale" value="${esc(d.nir)}" style="flex:1;min-width:0">
      </div>
      <div class="chips" style="margin-bottom:10px">
        <span class="small muted" style="align-self:center;margin-right:4px">Sexe :</span>
        ${[["F","F"],["M","M"],["","Ne pas cocher"]].map(([v,l]) =>
          `<button class="chip ${d.sexe===v?"on":""}" data-orsexe="${v}" style="font-size:12px">${l}</button>`).join("")}
      </div>
      <div class="tip">La <b>date</b>, la <b>taille</b> et le <b>poids</b> restent vides : tu les écris à la main, comme convenu.</div>

      <button class="btn btn-primary" id="or-go" style="width:100%;margin-top:12px">📄 Produire l'ordonnance</button>
      <!-- La question se pose ICI, au moment de rédiger -->
      <button class="btn btn-ghost" id="or-guide" style="width:100%;margin-top:8px">📋 Que puis-je prescrire ?</button>`);
    bindNav(() => pid ? sheetPatient(pid, "act") : sheetCabinet("entete"));
    const lire = () => {
      [["nom","or-nom"],["titre","or-titre"],["rpps","or-rpps"],["am","or-am"],["cabinet","or-cabinet"],
       ["adresse","or-adresse"],["tel","or-tel"],["mail","or-mail"],["patient","or-patient"],
       ["ne","or-ne"],["nir","or-nir"]].forEach(([k, id]) => {
        const e = $("#" + id); if (e) d[k] = e.value.trim();
      });
    };
    $$("#sheet [data-orsexe]").forEach(b => b.onclick = () => { lire(); d.sexe = b.dataset.orsexe; draw(); });
    { const g = $("#or-go"); if (g) g.onclick = async () => {
        lire();
        /* ⚠️ La bibliothèque PDF n'est plus chargée au démarrage : on
           l'attend ici, en le disant si c'est la première fois. */
        if (!pdfDispo()) toast("Préparation du document…");
        await pdfPret();
        produireOrdonnance(d);
      }; }
    { const b = $("#or-sig");
      if (b) b.onclick = async () => {
        const ch = await choisirSignature(C.id);
        if (!ch) return;
        _sig = ch;
        const E2 = enteteDocument(ch, C);
        ["nom","titre","rpps","am","cabinet","adresse","tel","mail"].forEach(k => d[k] = E2[k] || "");
        d.mention = E2.mention || "";
        draw();
      }; }
    { const gu = $("#or-guide");
      if (gu) gu.onclick = () => { if (typeof sheetGuidePresc === "function") sheetGuidePresc(""); }; }
  };
  draw();
}

function produireOrdonnance(d){
  const V = "#1D7A66", VC = "#EAF5F1", G = "#55635E", F = "#A8BDB6";
  const e = t => esc(String(t || ""));
  /* ⚠️ Le cœur de la règle : rien n'est écrit si la valeur manque. */
  const si = (v, html) => v ? html : "";
  const nl = t => e(t).replace(/\n/g, "<br>");
  const ligne = (lbl, val) => `<tr><td class="lb">${e(lbl)}</td><td class="vl">${e(val)}</td></tr>`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Ordonnance${d.patient ? " — " + e(d.patient) : ""}</title><style>
@page{ size:A4; margin:18mm; }
body{ font-family:Calibri,"Segoe UI",system-ui,sans-serif; color:#1A2420; font-size:10.5pt;
  line-height:1.35; margin:0 auto; max-width:174mm; padding:8mm; }
.tete{ display:flex; justify-content:space-between; align-items:flex-start; gap:10mm }
.tete .nom{ color:${V}; font-weight:700; font-size:15pt; margin:0 0 2pt }
.tete .qual{ font-weight:700; font-size:9.5pt; margin:0 0 3pt }
.tete .l{ color:${G}; font-size:9pt; margin:0 0 1pt }
.tete .d{ text-align:right }
.croix{ color:${V}; font-size:22pt; font-weight:700; line-height:1 }
.ord{ color:${V}; font-weight:700; font-size:17pt; letter-spacing:2pt; margin:2pt 0 0 }
.orig{ color:${G}; font-size:8.5pt }
.past{ display:flex; gap:4mm; margin:5mm 0 0 }
.past span{ background:${VC}; color:${V}; font-weight:700; font-size:9pt; padding:2mm 4mm; border-radius:1mm }
.filet{ border-bottom:1.2pt solid ${V}; margin:4mm 0 5mm }
.cadre{ border:0.5pt solid ${F}; border-left:2.5pt solid ${V}; background:#F7FBF9; padding:3mm 4mm }
.cadre table{ width:100%; border-collapse:collapse }
.cadre td{ padding:1.6mm 0; vertical-align:bottom }
.cadre .lb{ font-weight:700; font-size:9.5pt; white-space:nowrap; padding-right:2mm }
.cadre .vl{ border-bottom:0.5pt dotted ${F}; font-size:9.5pt; color:${G}; width:99% }
.cadre .g{ width:52% } .cadre .dcol{ width:48%; padding-left:5mm }
h2{ color:${V}; font-size:9.5pt; letter-spacing:1.4pt; margin:6mm 0 3mm }
.regl div{ border-bottom:0.5pt solid ${F}; height:7.2mm }
.note{ color:${G}; font-style:italic; font-size:8.5pt; margin:2mm 0 0 }
.pied{ display:flex; justify-content:flex-end; margin-top:6mm }
.sig{ border:0.5pt solid ${F}; padding:3mm 4mm; width:82mm }
.sig h3{ color:${V}; font-size:9pt; letter-spacing:1pt; margin:0 0 2mm }
.sig .dt{ color:${G}; font-size:9pt } .sig .sp{ height:20mm }
.bas{ border-top:0.5pt solid ${F}; margin-top:8mm; padding-top:2mm; display:flex;
  justify-content:space-between; color:${G}; font-size:8pt }
@media print{ body{ padding:0 } }
</style></head><body>
  <div class="tete">
    <div>
      ${si(d.nom, `<p class="nom">${e(d.nom)}</p>`)}
      ${si(d.titre, `<p class="qual">${e(d.titre)}</p>`)}
      ${si(d.cabinet, `<p class="l">${e(d.cabinet)}</p>`)}
      ${si(d.adresse, `<p class="l">${nl(d.adresse)}</p>`)}
      ${si(d.tel || d.mail, `<p class="l">${[
        si(d.tel, "Tél. : " + e(d.tel)), si(d.mail, "Courriel : " + e(d.mail))
      ].filter(Boolean).join(" — ")}</p>`)}
    </div>
    <div class="d">
      <div class="croix">✚</div>
      <p class="ord">ORDONNANCE</p>
      <p class="orig">ORIGINAL (Destiné au patient)</p>
    </div>
  </div>
  ${si(d.rpps || d.am, `<div class="past">
    ${si(d.rpps, `<span>N° RPPS : ${e(d.rpps)}</span>`)}
    ${si(d.am, `<span>N° AM (CPAM) : ${e(d.am)}</span>`)}
  </div>`)}
  <div class="filet"></div>

  <div class="cadre"><table>
    <tr>
      <td class="g"><table><tr><td class="lb">Date :</td><td class="vl"></td></tr></table></td>
      <td class="dcol"><table><tr><td class="lb">Sexe :</td><td class="vl">${
        d.sexe === "F" ? "[✕] F&nbsp;&nbsp; [ ] M" : d.sexe === "M" ? "[ ] F&nbsp;&nbsp; [✕] M" : "[ ] F&nbsp;&nbsp; [ ] M"
      }</td></tr></table></td>
    </tr>
    <tr>
      <td class="g"><table>${ligne("Patient(e) :", d.patient)}</table></td>
      <td class="dcol"><table>${ligne("Né(e) le :", d.ne)}</table></td>
    </tr>
    <tr>
      <td class="g"><table><tr><td class="lb">Taille / Poids :</td><td class="vl"></td></tr></table></td>
      <td class="dcol"><table>${ligne("N° Sécurité Sociale (NIR) :", d.nir)}</table></td>
    </tr>
  </table></div>

  <h2>PRESCRIPTION</h2>
  <div class="regl">${Array.from({ length:d.lignes }, () => "<div></div>").join("")}</div>
  <p class="note">Barrez les lignes restées blanches sous la prescription.</p>

  <div class="pied"><div class="sig">
    <h3>DATE &amp; SIGNATURE MANUSCRITE IDEL</h3>
    <p class="dt">Date :</p>
    <div class="sp"></div>
    <p class="note">Apposer la signature immédiatement sous la dernière ligne rédigée</p>
  </div></div>

  <div class="bas"><span>Ordonnance originale — Document médico-légal soumis au secret professionnel</span><span>Page 1 / 1</span></div>
</body></html>`;

  /* ⚠️ JAMAIS window.open() ICI : dans la WebView Android, la fenêtre
     s'ouvre sans parent et la boîte d'impression ne rend pas la main —
     l'application se fige et il faut la tuer. Le piège était déjà
     documenté dans fiche.js ; imprimerDocument() le contourne en
     écrivant le fichier puis en le confiant au système. */
  /* ⚠️ Le PDF d'abord : un .html confié à Android n'ouvre qu'une
     visionneuse, sans impression ni enregistrement. */
  if (pdfDispo()){ ordonnancePdf(d); return; }
  const sansAccent = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const base = "Ordonnance_" + (d.patient ? sansAccent(d.patient).replace(/[^\w-]+/g,"_").replace(/_+/g,"_") + "_" : "")
             + new Date().toISOString().slice(0,10);
  if (typeof imprimerDocument === "function"){ imprimerDocument(html, base); return; }
  (async () => {
    try { const ou = await saveToDevice(base + ".html", html, { mime:"text/html" }); toast("Ordonnance enregistrée — " + ou); }
    catch(x){ toast("Impression indisponible", "danger"); }
  })();
}

/* ============================================================
   LES DOCUMENTS EN PDF
   ─────────────────────────────────────────────────────────
   ⚠️ Un fichier .html confié à Android n'ouvre qu'une visionneuse :
   ni impression, ni enregistrement. Un PDF, lui, est reconnu partout —
   le pilote d'impression l'accepte directement, et « Enregistrer au
   format PDF » devient inutile puisque c'en est déjà un.

   ⚠️ La police du PDF ne porte PAS les émojis : la croix est dessinée
   en traits, jamais écrite en caractère. Tout texte venant de l'app
   passe par sansEmoji().
============================================================ */
const sansEmoji = t => String(t || "").replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "").trim();

function pdfDispo(){ return !!(window.jspdf && window.jspdf.jsPDF); }
/* ⚠️ La bibliothèque n'est plus là au démarrage : il faut l'attendre. */
async function pdfPret(){ try { await libPdfMake(); } catch(e){} return pdfDispo(); }

/* Le cadre commun : en-tête à deux colonnes, filet vert, pied de page */
function pdfEnTete(doc, d, titre, sousTitre){
  const M = 18, L = 210 - M * 2;
  const V = [29, 122, 102], G = [85, 99, 94], F = [168, 189, 182];
  let y = M + 4;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(...V);
  if (d.nom) doc.text(sansEmoji(d.nom), M, y);
  doc.setFontSize(9.5); doc.setTextColor(26, 36, 32);
  if (d.titre){ y += 5.2; doc.text(sansEmoji(d.titre), M, y); }
  /* ⚠️ La mention « remplaçant de » vient juste sous le titre : c'est
     là qu'on la lit. Elle ne s'ajoute JAMAIS d'elle-même — elle n'est
     là que si le soignant l'a choisie. */
  if (d.mention){
    y += 4.6;
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...G);
    doc.text(sansEmoji(d.mention), M, y);
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
  const gauche = [d.cabinet, ...(d.adresse || "").split("\n")].filter(Boolean);
  gauche.forEach(t => {
    doc.splitTextToSize(sansEmoji(t), 100).forEach(l => { y += 4.4; doc.text(l, M, y); });
  });
  /* ⚠️ Téléphone ET courriel sur la même ligne débordaient sous le
     titre à droite : une adresse un peu longue suffit. Chacun sur sa
     ligne, et la colonne de gauche est bornée à 100 mm — la moitié de
     la feuille — pour qu'aucune adresse ne puisse plus l'atteindre. */
  const LG = 100;
  const couper = (t, taille) => {
    doc.setFontSize(taille);
    return doc.splitTextToSize(sansEmoji(t), LG);
  };
  if (d.tel){ y += 4.4; couper("Tél. : " + d.tel, 9).forEach((l, i) => doc.text(l, M, y + i * 4)); }
  if (d.mail){
    y += 4.4;
    couper("Courriel : " + d.mail, 9).forEach((l, i) => { doc.text(l, M, y + i * 4); if (i) y += 4; });
  }

  /* La croix, dessinée — jamais un caractère */
  const cx = 210 - M - 6, cy = M + 4;
  doc.setFillColor(...V);
  doc.rect(cx - 1.6, cy - 6, 3.2, 10, "F");
  doc.rect(cx - 5, cy - 2.4, 10, 3.2, "F");

  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...V);
  doc.text(titre, 210 - M, cy + 12, { align:"right" });
  if (sousTitre){
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...G);
    doc.text(sousTitre, 210 - M, cy + 17, { align:"right" });
  }
  y = Math.max(y, cy + 20);
  return { M, L, V, G, F, y };
}
function pdfPied(doc, texte){
  const M = 18, H = 297;
  doc.setDrawColor(168, 189, 182); doc.setLineWidth(0.2);
  doc.line(M, H - 16, 210 - M, H - 16);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(85, 99, 94);
  doc.text(texte, M, H - 11.5);
  doc.text("Page 1 / 1", 210 - M, H - 11.5, { align:"right" });
}
/* Enregistrer puis confier au système : c'est là qu'Android propose
   l'impression, le partage et l'enregistrement. */
/* ⚠️ `mode` : "save" enregistre seulement, "share" ouvre directement le
   menu de partage. Sans précision on enregistre puis on propose de
   partager — le comportement d'avant, conservé pour les autres
   documents. */
async function pdfLivrer(doc, base, mode){
  const buf = doc.output("arraybuffer");
  const b64 = _b64(new Uint8Array(buf));
  const nom = base + ".pdf";
  try {
    const ou = await saveToDevice(nom, "data:application/pdf;base64," + b64,
                                  { mime:"application/pdf", base64:true });
    if (mode === "share"){
      if (typeof partagerFichier === "function"){
        try { await partagerFichier(nom); return; } catch(e){}
      }
      toast("Partage indisponible — enregistré dans " + ou);
      return;
    }
    toast("Enregistré — " + ou);
    if (mode === "save") return;
    if (typeof partagerFichier === "function") { try { await partagerFichier(nom); } catch(e){} }
    return;
  } catch(e){}
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([buf], { type:"application/pdf" }));
    a.download = nom; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("Document téléchargé");
  } catch(e2){ toast("Production impossible", "danger"); logIncident("pdf", "Document", e2); }
}

/* ── L'ordonnance ── */
async function ordonnancePdf(d){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const c = pdfEnTete(doc, d, "ORDONNANCE", "ORIGINAL (Destiné au patient)");
  const { M, L, V, G, F } = c;
  let y = c.y;

  /* Les deux pastilles — seulement si le numéro existe */
  const past = [];
  if (d.rpps) past.push("N° RPPS : " + d.rpps);
  if (d.am)   past.push("N° AM (CPAM) : " + d.am);
  if (past.length){
    y += 4;
    let x = M;
    doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
    past.forEach(t => {
      const w = doc.getTextWidth(t) + 8;
      doc.setFillColor(234, 245, 241); doc.rect(x, y - 3.6, w, 6.4, "F");
      doc.setTextColor(...V); doc.text(t, x + 4, y + 0.8);
      x += w + 6;
    });
    y += 5;
  }
  doc.setDrawColor(...V); doc.setLineWidth(0.5); doc.line(M, y + 2, 210 - M, y + 2);
  y += 9;

  /* Le cadre patient */
  const hC = 26;
  doc.setFillColor(247, 251, 249); doc.rect(M, y, L, hC, "F");
  doc.setDrawColor(...F); doc.setLineWidth(0.2); doc.rect(M, y, L, hC);
  doc.setFillColor(...V); doc.rect(M, y, 1.2, hC, "F");
  const col = [M + 5, M + L / 2 + 2];
  const champ = (cx, cy, lbl, val, larg) => {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(26, 36, 32);
    doc.text(lbl, cx, cy);
    const w = doc.getTextWidth(lbl) + 2;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...G);
    if (val) doc.text(sansEmoji(val), cx + w, cy);
    doc.setDrawColor(...F); doc.setLineWidth(0.15);
    doc.line(cx + w, cy + 1.2, cx + larg, cy + 1.2);
  };
  const lg = L / 2 - 8;
  champ(col[0], y + 7,    "Date :", "", lg);
  champ(col[1], y + 7,    "Sexe :", d.sexe === "F" ? "[X] F   [ ] M" : d.sexe === "M" ? "[ ] F   [X] M" : "[ ] F   [ ] M", lg);
  champ(col[0], y + 15.5, "Patient(e) :", d.patient, lg);
  champ(col[1], y + 15.5, "Né(e) le :", d.ne, lg);
  champ(col[0], y + 24,   "Taille / Poids :", "", lg);
  champ(col[1], y + 24,   "N° SS :", d.nir, lg);
  y += hC + 9;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...V);
  doc.text("PRESCRIPTION", M, y); y += 5;

  /* La zone réglée : autant de lignes que la page en accepte */
  doc.setDrawColor(...F); doc.setLineWidth(0.15);
  const pas = 7.4, bas = 297 - 58;
  while (y < bas){ doc.line(M, y, 210 - M, y); y += pas; }
  doc.setFont("helvetica", "italic"); doc.setFontSize(8); doc.setTextColor(...G);
  doc.text("Barrez les lignes restées blanches sous la prescription.", M, y + 1);

  /* Le bloc de signature */
  const bw = 82, bx = 210 - M - bw, by = 297 - 52;
  doc.setDrawColor(...F); doc.setLineWidth(0.2); doc.rect(bx, by, bw, 32);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...V);
  doc.text("DATE & SIGNATURE MANUSCRITE IDEL", bx + 4, by + 6);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...G);
  doc.text("Date :", bx + 4, by + 13);
  doc.setFont("helvetica", "italic"); doc.setFontSize(7);
  doc.text("Apposer la signature immédiatement sous la dernière ligne rédigée", bx + 4, by + 29);

  pdfPied(doc, "Ordonnance originale - Document medico-legal soumis au secret professionnel");
  const sa = t => String(t).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  await pdfLivrer(doc, "Ordonnance_" + (d.patient ? sa(d.patient).replace(/[^\w-]+/g,"_").replace(/_+/g,"_") + "_" : "")
                       + new Date().toISOString().slice(0,10));
}

/* ── Le courrier et la feuille à en-tête ── */
async function courrierPdf(d){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
  const c = pdfEnTete(doc, d, d.vierge ? "" : "", "");
  const { M, L, V, G, F } = c;
  let y = c.y;
  if (d.rpps){
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...G);
    doc.text("RPPS " + d.rpps, M, y); y += 3;
  }
  if (d.mention){
    doc.setFont("helvetica", "italic"); doc.setFontSize(8.5); doc.setTextColor(...G);
    doc.text(sansEmoji(d.mention), M, y + 1.5); y += 4.5;
  }
  doc.setDrawColor(...V); doc.setLineWidth(0.5); doc.line(M, y + 2, 210 - M, y + 2);
  y += 11;

  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...G);
  const dateFR = new Date().toLocaleDateString("fr-FR", { day:"numeric", month:"long", year:"numeric" });
  doc.text((d.lieu ? d.lieu + ", le " : "Le ") + dateFR, 210 - M, y, { align:"right" });
  y += 10;

  if (d.dest || d.destAdr){
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(26, 36, 32);
    if (d.dest) doc.text(sansEmoji(d.dest), 210 - M, y, { align:"right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
    (d.destAdr || "").split("\n").filter(Boolean).forEach(t => {
      y += 4.4; doc.text(sansEmoji(t), 210 - M, y, { align:"right" });
    });
    y += 11;
  }
  if (d.objet){
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...G);
    doc.text("Objet :", M, y);
    doc.setFontSize(10); doc.setTextColor(26, 36, 32);
    doc.text(sansEmoji(d.objet), M + doc.getTextWidth("Objet : ") + 1, y);
    y += 10;
  }
  if (d.corps){
    doc.setFont("helvetica", "normal"); doc.setFontSize(10.5); doc.setTextColor(26, 36, 32);
    doc.splitTextToSize(sansEmoji(d.corps), L).forEach(l => {
      if (y > 297 - 60){ doc.addPage(); y = 25; }
      doc.text(l, M, y); y += 5.6;
    });
  }
  if (d.signature){
    const by = Math.max(y + 16, 297 - 52);
    doc.setDrawColor(...F); doc.setLineWidth(0.2);
    doc.line(210 - M - 55, by, 210 - M, by);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...G);
    doc.text("Signature", 210 - M - 27, by + 4.5, { align:"center" });
  }
  pdfPied(doc, "JM@Sante - Document confidentiel");
  await pdfLivrer(doc, (d.vierge ? "Feuille_entete_" : "Courrier_") + new Date().toISOString().slice(0,10));
}


/* ⚠️ RÉPARER UN RACCOURCI MANQUANT.
   Activer l'empreinte AVANT d'avoir un code ne déposait aucune clé : le
   réglage restait vrai, mais le doigt n'ouvrait rien au démarrage. Après
   chaque ouverture réussie au code, on vérifie et on répare en silence. */
async function reparerEmpreinte(){
  try {
    if (!S || !S.bioLock) return;              // l'empreinte n'est pas demandée
    if (!cleOuverte()) return;                 // rien à déposer
    if (!(await coffreExiste())) return;
    const c = await coffreLire();
    if (c && c.bio) return;                    // déjà en place
    if (!(await coffreFortDisponible())) return;   // pas de coffre-fort ici
    const ok = await coffreFortPoser();
    if (ok) toast("Empreinte prête pour le prochain démarrage 👆");
  } catch(e){ logIncident("coffre-fort", "Réparation du raccourci", e); }
}

/* ── L'écran de ma fiche ── */
function sheetMoi(){
  const M = moi();
  openSheet(`
    ${navHeader("Réglages", true)}
    <h3>👤 Ma fiche</h3>
    <p class="small muted" style="margin-bottom:12px">Ton identité professionnelle. Elle te suit dans <b>tous</b> les cabinets et sert à composer tes documents.</p>

    <div class="rowlab vi"><span>Identité</span><i></i></div>
    <input id="mo-nom" class="rec-in" placeholder="Nom et prénom" value="${esc(M.nom)}" style="margin-bottom:6px">
    <input id="mo-titre" class="rec-in" placeholder="Titre" value="${esc(M.titre)}" style="margin-bottom:6px">
    <div class="rowb" style="gap:6px;margin-bottom:10px">
      <input id="mo-rpps" class="rec-in" placeholder="N° RPPS ou ADELI" value="${esc(M.rpps)}" style="flex:1;min-width:0">
      <input id="mo-am" class="rec-in" placeholder="N° AM (CPAM)" value="${esc(M.am)}" style="flex:1;min-width:0">
    </div>

    <div class="rowlab vi"><span>Me joindre</span><i></i></div>
    <input id="mo-tel" class="rec-in" placeholder="Portable professionnel" value="${esc(M.tel)}"
      inputmode="tel" style="margin-bottom:6px">
    <input id="mo-mail" class="rec-in" placeholder="Courriel professionnel" value="${esc(M.mail)}"
      inputmode="email" style="margin-bottom:6px">
    <textarea id="mo-adresse" class="rec-in" rows="2" placeholder="Adresse (facultatif)">${esc(M.adresse)}</textarea>

    <div class="rowlab vi" style="margin-top:12px"><span>Privé</span><i></i><em>ne sort sur aucun document</em></div>
    <input id="mo-telperso" class="rec-in" placeholder="Portable personnel" value="${esc(M.telPerso)}"
      inputmode="tel" style="margin-bottom:6px">
    <!-- ⚠️ Sans patient, seule la feuille vierge a du sens — il en
         imprime d'avance pour la sacoche. -->
    <button class="btn btn-ghost" id="mo-presc" style="width:100%;margin-top:10px">✍️ Faire une ordonnance vierge</button>
    ${typeof essaiActif === "function" && essaiActif("documents")
      ? `<button class="btn btn-ghost" id="mo-docs" style="width:100%;margin-top:10px">📄 Mes modèles de documents</button>` : ""}
    <div class="tip">Le numéro personnel reste dans l'application : il ne figure ni sur une ordonnance, ni sur un courrier, ni sur une feuille laissée au domicile.</div>

    <div class="warn" style="margin-top:12px">Ces informations étaient auparavant saisies dans chaque cabinet. Elles sont désormais ici, une seule fois — les cabinets ne gardent que l'adresse du lieu.</div>`);
  bindNav(() => sheetTours());
  const champs = [["nom","mo-nom"],["titre","mo-titre"],["rpps","mo-rpps"],["am","mo-am"],
                  ["tel","mo-tel"],["mail","mo-mail"],["adresse","mo-adresse"],["telPerso","mo-telperso"]];
  { const pr = $("#mo-presc");
    if (pr) pr.onclick = () => {
      if (typeof essaiActif === "function" && essaiActif("dispositifs")
          && typeof sheetPrescrire === "function") sheetPrescrire(null);
      else sheetOrdonnance(null);
    }; }
  { const d = $("#mo-docs"); if (d) d.onclick = () => sheetModeles(); }
  champs.forEach(([k, id]) => {
    const e = $("#" + id);
    if (e) e.onchange = () => { M[k] = e.value.trim(); save(true); };
  });
}

/* ── Qui signe un document ──
   ⚠️ L'app PROPOSE les trois formes, elle ne dit jamais laquelle est
   réglementaire : cela dépend du cabinet et de la situation, et c'est au
   soignant de le savoir. Aucune mention ne s'ajoute d'elle-même.
   Le dernier choix est retenu PAR CABINET : on remplace souvent la même
   personne au même endroit. */
function signatureChoix(cabId){
  return ((S.signature || {})[cabId]) || { mode:"moi" };
}
function signatureMemoriser(cabId, ch){
  S.signature = S.signature || {};
  S.signature[cabId] = ch;
  save(true);
}
/* Compose l'en-tête d'un document à partir du choix retenu. */
/* ⚠️ `cab` passé en argument : sans lui, la composition relisait le
   cabinet OUVERT et annulait tout le travail de `cabinetPourDoc()` —
   l'en-tête repartait au Cabinet B pour un patient du A. */
function enteteDocument(ch, cab){
  const M = moi(), C = cab || cabinet();
  const base = {
    cabinet: C.nom || "", adresse: C.adresse || "", tel: C.tel || "", mail: C.mail || "",
    lieu: (C.adresse || "").split("\n").pop().replace(/^\d{4,5}\s*/, "").trim()
  };
  if (ch && ch.mode === "cabinet"){
    /* L'en-tête du cabinet titulaire : c'est lui qui signe. */
    const t = ch.titulaire ? cabContact(ch.titulaire) : null;
    return { ...base,
      nom: t ? t.nom : (C.nom || ""), titre: t ? (t.metier || "") : "",
      rpps: t ? (t.rpps || "") : "", am: "", mention: "" };
  }
  const e = { ...base, nom: M.nom, titre: M.titre, rpps: M.rpps, am: M.am,
              tel: M.tel || base.tel, mail: M.mail || base.mail, mention: "" };
  if (ch && ch.mode === "remplacant" && ch.titulaire){
    const t = cabContact(ch.titulaire);
    if (t) e.mention = "Remplaçant de " + t.nom
      + (t.metier ? ", " + t.metier : "")
      + (t.rpps ? " — RPPS " + t.rpps : "");
  }
  return e;
}

/* L'écran de choix, ouvert depuis un document */
async function choisirSignature(cabId){
  const titulaires = titulairesDuCabinet();
  const nomTit = c => c.nom + (c.complement ? " · " + c.complement : "");
  const opts = [
    { ic:"👤", lbl:"Moi", sub:(moi().nom || "ton identité") + " — sans mention", val:"moi" }
  ];
  if (titulaires.length)
    opts.push({ ic:"🤝", lbl:"Moi, remplaçant de…", sub:"ton identité, avec le titulaire mentionné", val:"remplacant" },
              { ic:"🏥", lbl:"Le cabinet", sub:"l'en-tête d'un titulaire, en son nom", val:"cabinet" });
  const mode = await askChoice({ ic:"✍️", titre:"Qui signe ce document ?",
    sub:"L'application propose les formes ; le cadre qui s'applique relève de toi.",
    options:opts });
  if (!mode) return null;
  let titulaire = null;
  if (mode !== "moi"){
    if (!titulaires.length){ toast("Aucun praticien dans ce cabinet", "danger"); return null; }
    titulaire = await askChoice({ ic:"🩺",
      titre: mode === "remplacant" ? "Remplaçant de qui ?" : "En-tête de qui ?",
      options: titulaires.map(c => ({ lbl:nomTit(c), sub:(c.rpps ? "RPPS " + c.rpps : "RPPS non renseigné"), val:c.id })) });
    if (!titulaire) return null;
  }
  const ch = { mode, titulaire };
  signatureMemoriser(cabId, ch);
  return ch;
}
