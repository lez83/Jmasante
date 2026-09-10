"use strict";
/* ================= Moniteur =================
   Base : concept D (vue synoptique, saisie inline)
   + Docs (photos/PDF) par patient
   + Rappels typés remontant dans la relève
   + Relève par période : complète / événements / sélection
   + Plan de soins libre par patient
   + CRUD patients, persistance IndexedDB
================================================== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const todayISO = () => { const d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const nowHM = () => new Date().toTimeString().slice(0,5);
const fmtFR = iso => iso ? new Date(iso+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) : "";
function ageOf(dob){ if(!dob)return null; const b=new Date(dob),n=new Date();
  let a=n.getFullYear()-b.getFullYear();
  if(n.getMonth()<b.getMonth()||(n.getMonth()===b.getMonth()&&n.getDate()<b.getDate()))a--; return a; }
/* toast(message) ou toast(message, { label, action, ms })
   La forme à deux arguments affiche un lien d'annulation : un geste
   involontaire (balayage, validation trop rapide) reste rattrapable. */
function toast(m, opt){
  const t = $("#toast");
  /* Sans cette garde, un #toast absent lève une erreur qui interrompt
     la fonction appelante — un simple message peut alors bloquer une
     validation de passage ou l'ouverture d'un écran. */
  if (!t) return;
  clearTimeout(t._t);
  if (opt && typeof opt === "object" && typeof opt.action === "function"){
    t.innerHTML = `<span>${esc(m)}</span><button class="toast-act">${esc(opt.label || "Annuler")}</button>`;
    const b = t.querySelector(".toast-act");
    b.onclick = () => { clearTimeout(t._t); t.classList.remove("on"); opt.action(); };
    t.classList.add("on", "with-act");
    t._t = setTimeout(() => t.classList.remove("on", "with-act"), opt.ms || 6000);
    return;
  }
  t.textContent = m; t.classList.remove("with-act"); t.classList.add("on");
  t._t = setTimeout(() => t.classList.remove("on"), 2500);
}

/* ---------- Alertes ---------- */
const SEUILS = { ta_h:16, ta_b:9, temp_h:38.3, temp_b:35.5, sat_b:92, pls_h:110, pls_b:45, dl:7, gl_b:0.7, gl_h:2.5 };
const num = v => { const n=parseFloat(String(v??"").replace(",",".")); return isNaN(n)?null:n; };
function alertes(c, th){
  if(!c) return [];
  const S2 = Object.assign({}, SEUILS, th||{});
  const out=[];
  if(c.ta){ let s=num(String(c.ta).split("/")[0]); if(s!=null){ if(s>40)s/=10;
    if(s>=S2.ta_h)out.push("TA élevée ("+c.ta+")"); else if(s<=S2.ta_b)out.push("TA basse ("+c.ta+")"); } }
  const t=num(c.temp); if(t!=null){ if(t>=S2.temp_h)out.push("Fièvre ("+t+"°C)"); else if(t<=S2.temp_b)out.push("Hypothermie ("+t+"°C)"); }
  const sa=num(c.sat); if(sa!=null&&sa<S2.sat_b)out.push("Sat basse ("+sa+"%)");
  const p=num(c.puls); if(p!=null){ if(p>S2.pls_h)out.push("Tachycardie ("+p+")"); else if(p<S2.pls_b)out.push("Bradycardie ("+p+")"); }
  const d=num(c.douleur); if(d!=null&&d>=S2.dl)out.push("Douleur "+d+"/10");
  const g=num(c.glyc); if(g!=null){ if(g<=S2.gl_b)out.push("Hypoglycémie ("+g+" g/L)"); else if(g>=S2.gl_h)out.push("Hyperglycémie ("+g+" g/L)"); }
  return out;
}
const badKey = { ta:["ta "],temp:["fièvre","hypoth"],sat:["sat"],puls:["cardie"],glyc:["glyc"],douleur:["douleur"] };
const isBad = (k,al) => al.some(a => badKey[k].some(x => a.toLowerCase().includes(x)));

/* ---------- Rappels : types ---------- */
/* Tags de priorité patient */
/* ══════════════════════════════════════════════════════
   Ordre & appartenance par créneau (matin/soir)
   Modèle : S.slotOrder[tour][slot] = [ids]  (nouveau)
            S.slotMembers[tour][slot] = [ids] (nouveau)
   Fallback transparent sur S.patientOrder[tour] + p.tours
   quand les créneaux sont désactivés ou le créneau vide.
══════════════════════════════════════════════════════ */
// Créneau "actif" pour l'affichage courant (Moniteur, déroulé)
let _viewSlot = null; // null = auto selon l'heure

/* ---------- DATE DE TRAVAIL ----------
   Permet de rattraper une saisie oubliée : un passage noté sur papier
   la veille s'enregistre à SA date, pas à celle du jour.
   Toujours réinitialisée à aujourd'hui au démarrage (voir init.js). */
let _workDate = null;                       // null = aujourd'hui
const MAX_RECUL = 30;                       // jours de recul autorisés

function workDate(){ return _workDate || todayISO(); }
function isToday(){ return !_workDate || _workDate === todayISO(); }
function setWorkDate(iso){
  if (!iso || iso >= todayISO()){ _workDate = null; return; }
  const min = new Date(Date.now() - MAX_RECUL*864e5).toISOString().slice(0,10);
  _workDate = iso < min ? min : iso;
}
function shiftWorkDate(n){
  const d = new Date(workDate() + "T12:00:00");
  d.setDate(d.getDate() + n);
  setWorkDate(d.toISOString().slice(0,10));
}
/* Libellé lisible : « il y a 2 jours », « hier » */
function workDateLabel(){
  if (isToday()) return "";
  const j = Math.round((new Date(todayISO()) - new Date(workDate())) / 864e5);
  return j === 1 ? "hier" : "il y a " + j + " jours";
}
function activeSlot(){
  if (!S.slotsEnabled) return null;
  return _viewSlot || defaultSlot();
}
// Un patient appartient-il à ce créneau de cette tournée ?
function inTourSlot(p, tour, slot){
  if (!(p.tours||[]).includes(tour)) return false;
  if (!S.slotsEnabled || !slot) return true;
  if (slot === "jour") return true;      // vue Journée : les deux créneaux
  const m = ((S.slotMembers||{})[tour]||{})[slot];
  // Si aucune composition de créneau définie → le patient de la tournée compte pour les deux
  if (!m) return true;
  return m.includes(p.id);
}
/* Soins du plan proposés à ce créneau.
   Sans indication de créneau, un soin est proposé aux deux —
   c'est le comportement d'origine, préservé. */
function planFor(p, slot){
  const all = p.plan || [];
  if (!S.slotsEnabled || !slot || slot === "jour") return all;
  const sl = p.planSlots || {};
  return all.filter(x => {
    const c = sl[x];
    if (!c || (!c.matin && !c.soir)) return true;   // non précisé : les deux
    return !!c[slot];
  });
}

/* Créneaux auxquels ce patient appartient dans cette tournée.
   Sert à regrouper la vue Journée par section. */
function slotsOf(p, tour){
  if (!S.slotsEnabled) return [];
  return ["matin","soir"].filter(sl => {
    const m = ((S.slotMembers||{})[tour]||{})[sl];
    if (!m) return true;            // pas de composition définie → les deux
    return m.includes(p.id);
  });
}

// Ordre de passage pour ce créneau (fallback : ordre global de la tournée)
function orderFor(tour, slot){
  if (S.slotsEnabled && slot){
    const so = ((S.slotOrder||{})[tour]||{})[slot];
    if (so && so.length) return so;
  }
  return (S.patientOrder||{})[tour] || [];
}
// Tri d'un pool selon l'ordre d'un créneau
function sortBySlot(pool, tour, slot){
  const ord = orderFor(tour, slot);
  return pool.slice().sort((a,b)=>{
    const ia=ord.indexOf(a.id), ib=ord.indexOf(b.id);
    if (ia===-1&&ib===-1) return 0;
    if (ia===-1) return 1;
    if (ib===-1) return -1;
    return ia-ib;
  });
}

/* Créneau par défaut selon l'heure (avant 14h = matin) */
function defaultSlot(){ return new Date().getHours() < 14 ? "matin" : "soir"; }
const SLOT_LBL = { matin:{ic:"☀️",lbl:"Matin"}, soir:{ic:"🌙",lbl:"Soir"} };

/* Informations contextuelles du patient — chacune peut figurer ou non dans la relève.
   p.infos = [{ id, type, txt, show }] ; le champ p.ctx historique est migré en "atcd". */
const INFO_TYPES = {
  acces:    { ic:"🔑",   lbl:"Accès & domicile", col:"var(--accent)",
              ph:"Code portail, clé sous le pot, 3e étage sans ascenseur, chien…" },
  vigilance:{ ic:"⚠️",   lbl:"Vigilance",        col:"var(--amber)",
              ph:"Allergie, risque de chute, contre-indication…" },
  traitement:{ic:"💊",   lbl:"Traitement",       col:"var(--accent)",
              ph:"Fiche de traitement, posologies, horaires de prise…" },
  atcd:     { ic:"📋",   lbl:"Antécédents",      col:"var(--dim)",
              ph:"HTA, diabète, PTH droite 2019…" },
  entourage:{ ic:"👨‍👩‍👧", lbl:"Entourage",        col:"var(--dim)",
              ph:"Fille présente le week-end, aide à domicile le matin…" },
  autre:    { ic:"📌",   lbl:"Autre",            col:"var(--dim)",
              ph:"Toute autre information utile…" }
};
function infoType(t){ return INFO_TYPES[t] || INFO_TYPES.autre; }
/* Descriptions courtes affichées dans le sélecteur de type */
const INFO_HINTS = {
  acces:     "Code portail, clé, étage, chien",
  vigilance: "Allergie, risque de chute",
  traitement:"Fiche de traitement, posologies",
  atcd:      "HTA, diabète, interventions",
  entourage: "Aidants, présence familiale",
  autre:     "Divers"
};
/* Informations à faire figurer dans la relève */
function shownInfos(p){ return (p.infos||[]).filter(i => i.show && (i.txt||"").trim()); }

/* Icône d'un document selon son type */
function docIcon(d){
  const m = (d && d.mime) || "", n = ((d && d.name) || "").toLowerCase();
  if (m.startsWith("image/")) return "🖼️";
  if (m === "application/pdf" || n.endsWith(".pdf")) return "📄";
  if (/word|opendocument\.text|rtf/.test(m) || /\.(docx?|odt|rtf)$/.test(n)) return "📝";
  return "📎";
}

/* Deux natures de pastille :
   - « état » : durable, décrit le patient (à surveiller, prioritaire)
   - « evt »  : un fait daté (médecin contacté) — il grise avec l'âge
   « Matériel à apporter » a été retiré : c'était un rappel déguisé,
   sans date d'échéance ni disparition une fois fait. */
const PATIENT_TAGS = {
  surveiller:  { ic:"👁️", lbl:"À surveiller",     kind:"etat" },
  prioritaire: { ic:"🔴", lbl:"Prioritaire",       kind:"etat" },
  medecin:     { ic:"🩺", lbl:"Médecin contacté",  kind:"evt"  }
};
/* ============================================================
   SURVEILLANCE DES SELLES
   ─────────────────────────────────────────────────────────
   ⚠️ « 0 » est une VALEUR — « pas de selle aujourd'hui » — et
   non l'absence de saisie. La distinction porte toute l'alerte.

   Le compteur de jours sans selle ne démarre que sur des jours
   RENSEIGNÉS et consécutifs : un jour non noté le remet à zéro.
   Décision de l'IDEL : mieux vaut rater une alerte que d'en
   lever une fausse sur des données qu'on n'a pas.
============================================================ */
const SELLES_VAL = [
  { k:"0",        lbl:"0",        txt:"selles 0" },
  { k:"1",        lbl:"+",        txt:"selles +" },
  { k:"2",        lbl:"++",       txt:"selles ++" },
  { k:"3",        lbl:"+++",      txt:"selles +++" },
  { k:"4",        lbl:"++++",     txt:"selles ++++" },
  { k:"diarrhee", lbl:"💧 Diarrhée", txt:"diarrhée" }
];
function sellesTxt(v){
  const e = SELLES_VAL.find(x => x.k === String(v));
  return e ? e.txt : "";
}

/* Jours consécutifs RENSEIGNÉS à 0, en remontant depuis le dernier
   jour noté. S'arrête au premier jour sans relevé. */
function joursSansSelle(p){
  const par = {};                      // date → valeur (le dernier relevé du jour prime)
  (p.visits||[]).forEach(v => {
    const s = (v.consts||{}).selles;
    if (s !== undefined && s !== "" && v.date) par[v.date] = String(s);
  });
  const jours = Object.keys(par).sort().reverse();
  if (!jours.length) return 0;
  let n = 0, curseur = jours[0];
  while (par[curseur] === "0"){
    n++;
    const d = new Date(curseur); d.setDate(d.getDate() - 1);
    curseur = d.toISOString().slice(0,10);
    if (par[curseur] === undefined) break;   // jour non renseigné : on s'arrête
  }
  return n;
}

/* Seuil d'alerte, réglable par patient (le transit varie beaucoup) */
function seuilSelles(p){
  const n = parseInt((p && p.seuilSelles) || "", 10);
  return (n > 0 && n < 30) ? n : 3;
}
function alerteSelles(p){
  const n = joursSansSelle(p);
  return n >= seuilSelles(p) ? n : 0;
}

/* ============================================================
   JOURNAL DES INCIDENTS
   ─────────────────────────────────────────────────────────
   27 catch vides avalaient les erreurs sans laisser de trace :
   une écriture ratée disparaissait, et personne ne le savait.
   On garde désormais une trace datée, consultable dans
   « Santé de l'application ».

   Volontairement borné à 50 entrées et sans donnée patient :
   ce journal ne doit ni grossir sans fin ni contenir de
   données de santé.
============================================================ */
function logIncident(source, message, err){
  try {
    S.incidents = S.incidents || [];
    S.incidents.unshift({
      at: new Date().toISOString(),
      src: String(source||"?").slice(0,24),
      msg: String(message||"").slice(0,120),
      det: err ? String(err.message || err).slice(0,160) : ""
    });
    if (S.incidents.length > 50) S.incidents.length = 50;
    if (typeof idbSet === "function") idbSet("state", JSON.parse(JSON.stringify(S))).catch(()=>{});
  } catch(e){ /* le journal ne doit jamais casser l'app */ }
}

/* Propose le résultat à partir du libellé du rappel.
   ⚠️ Accorder un participe en français demande de connaître le genre et
   le nombre — impossible sans dictionnaire. On garde donc une forme
   IMPERSONNELLE, toujours correcte : « Fait : récupérer le médicament »
   deviendrait lourd, on préfère préfixer le verbe au passé composé
   uniquement quand la règle est sûre, sinon on reprend le texte tel quel.
   Dans tous les cas, l'IDEL peut modifier avant de valider. */
function resultatPropose(txt){
  const t = String(txt||"").trim();
  if (!t) return "";
  // Verbes dont le résultat s'exprime sans accord : « J'ai … »
  const SANS_ACCORD = [
    [/^r[ée]cup[ée]r[ée]r?\s+(.+)$/i,  "Récupéré : $1"],
    [/^renouveler\s+(.+)$/i,          "Renouvelé : $1"],
    [/^commander\s+(.+)$/i,           "Commandé : $1"],
    [/^appeler\s+(.+)$/i,             "Appelé : $1"],
    [/^contacter\s+(.+)$/i,           "Contacté : $1"],
    [/^pr[ée]venir\s+(.+)$/i,         "Prévenu : $1"],
    [/^demander\s+(.+)$/i,            "Demandé : $1"],
    [/^v[ée]rifier\s+(.+)$/i,         "Vérifié : $1"],
    [/^transmettre\s+(.+)$/i,         "Transmis : $1"],
    [/^faire\s+(.+)$/i,               "Fait : $1"],
    [/^apporter\s+(.+)$/i,            "Apporté : $1"],
  ];
  for (const [re, rep] of SANS_ACCORD){
    if (re.test(t)) return t.replace(re, rep);
  }
  return t;   // aucune règle : texte repris tel quel, modifiable
}

let _plaieEnCours = null;  // plaie à laquelle rattacher la prochaine photo
let _recueilApres = null;   // dossier tout juste créé, à compléter

/* ============================================================
   ANNIVERSAIRE
   ─────────────────────────────────────────────────────────
   Quelques jours autour de la date : l'IDEL ne passe pas
   forcément le jour J, il peut souhaiter au passage d'avant
   ou d'après.

   ⚠️ Le 29 février n'existe pas les années ordinaires : la
   pastille sort alors le 28. Sans ce repli, ces patients
   n'auraient jamais d'anniversaire.
============================================================ */
const ANNIV_AVANT = 3;   // jours d'avance
const ANNIV_APRES = 1;   // jours de retard

function annivJours(p, refISO){
  if (!p || !p.dob) return null;
  const ref = new Date((refISO || workDate()) + "T12:00:00");
  const [, m, j] = String(p.dob).split("-").map(Number);
  if (!m || !j) return null;
  const an = ref.getFullYear();
  const bissext = a => (a%4===0 && a%100!==0) || a%400===0;
  // 29 février un an ordinaire : on fête le 28
  const jour = (m === 2 && j === 29 && !bissext(an)) ? 28 : j;
  const cette = new Date(an, m-1, jour, 12);
  const diff = Math.round((cette - ref) / 864e5);
  // Chercher aussi l'an prochain, pour un anniversaire début janvier
  if (diff < -ANNIV_APRES){
    const suiv = new Date(an+1, m-1,
      (m === 2 && j === 29 && !bissext(an+1)) ? 28 : j, 12);
    const d2 = Math.round((suiv - ref) / 864e5);
    return (d2 <= ANNIV_AVANT) ? d2 : null;
  }
  return (diff <= ANNIV_AVANT && diff >= -ANNIV_APRES) ? diff : null;
}

/* Libellé court pour la pastille */
function annivTexte(p, refISO){
  const d = annivJours(p, refISO);
  if (d === null) return "";
  const ans = ageOf(p.dob);
  if (d === 0)  return ans ? ans + " ans aujourd'hui" : "anniversaire aujourd'hui";
  if (d === -1) return "anniversaire hier";
  if (d === 1)  return "anniversaire demain";
  return "anniversaire dans " + d + " jours";
}

/* Adresse assemblée : rue + code postal + ville.
   Sert au GPS, au DLU et à l'export de fiche. */
function adresseComplete(p){
  return [p.address, [p.cp, p.ville].filter(Boolean).join(" ")]
         .filter(x => (x||"").trim()).join(", ");
}

/* Âge d'une pastille événementielle, pour l'atténuer sans la supprimer */
function tagAge(p, k){
  const d = ((p.tagMeta||{})[k]||{}).at;
  if (!d) return null;
  return Math.max(0, Math.round((new Date(todayISO()) - new Date(d)) / 864e5));
}
function tagAgeLbl(n){
  if (n === null) return "";
  return n === 0 ? "aujourd'hui" : n === 1 ? "hier" : "il y a " + n + " jours";
}
/* Catalogue de phrases types par thème (personnalisable dans Réglages) */
const DEFAULT_PHRASE_CATS = [
  { name:"État général", phrases:[
    "RAS, patient stable.",
    "Patient calme, orienté, cohérent.",
    "État général conservé.",
    "Patient fatigué ce jour.",
    "Patient anxieux, réassurance faite."
  ]},
  { name:"Pansements / Plaies", phrases:[
    "Pansement propre, cicatrisation favorable.",
    "Plaie en voie d'épidermisation.",
    "Exsudat modéré, pansement renouvelé.",
    "Rougeur périlésionnelle à surveiller.",
    "Retrait fils/agrafes réalisé, cicatrice propre."
  ]},
  { name:"Traitements", phrases:[
    "Traitement pris devant moi.",
    "Pilulier préparé pour la semaine.",
    "Injection réalisée, bien tolérée.",
    "Refus du traitement ce jour, patient informé des risques."
  ]},
  { name:"Douleur", phrases:[
    "Patient algique malgré traitement.",
    "Douleur soulagée après antalgique.",
    "EVA à réévaluer au prochain passage."
  ]},
  { name:"Diabète", phrases:[
    "Glycémie dans les objectifs.",
    "Hypoglycémie corrigée par resucrage, contrôle fait.",
    "Insuline faite selon protocole."
  ]},
  { name:"Entourage / Coordination", phrases:[
    "Famille informée ce jour.",
    "Médecin traitant contacté.",
    "Passage kiné signalé.",
    "Aide à domicile présente au passage."
  ]},
  { name:"Cutané / Points d'appui", phrases:[
    "Téguments intacts, points d'appui sains.",
    "Rougeur non blanchissante au sacrum, mise en décharge.",
    "Œdèmes des membres inférieurs prenant le godet.",
    "Effleurage des points d'appui réalisé.",
    "Peau sèche, hydratation cutanée appliquée."
  ]},
  { name:"Élimination", phrases:[
    "Transit régulier, selles normales.",
    "Absence de selles depuis 3 jours, à surveiller.",
    "Diurèse conservée, urines claires.",
    "Sonde urinaire perméable, urines claires en quantité suffisante.",
    "Change complet réalisé, protection adaptée."
  ]},
  { name:"Respiratoire", phrases:[
    "Eupnéique au repos, saturation correcte en air ambiant.",
    "Encombrement bronchique, toux grasse peu productive.",
    "Dyspnée d'effort signalée, repos conseillé.",
    "Oxygénothérapie en place selon prescription."
  ]},
  { name:"Perfusions / Abords veineux", phrases:[
    "Abord veineux fonctionnel, reflux franc, débit conforme.",
    "Reflux franc, rinçage pulsé positif, point de ponction sain.",
    "Pansement PICC/CIP refait, changement de valve et aiguille de Huber.",
    "Fin de perfusion, rinçage pulsé et verrouillage.",
    "Ligne bouchée, désobstruction infructueuse, médecin appelé."
  ]},
  { name:"Prélèvements / Biologie", phrases:[
    "Bilan sanguin réalisé à jeun sans difficulté, acheminement labo prévu.",
    "Prélèvement difficile (capital veineux précaire), un seul tube.",
    "ECBU réalisé sur miction spontanée, déposé au laboratoire."
  ]},
  { name:"Injections / Perfusions", phrases:[
    "Point d'injection propre, sans rougeur ni induration.",
    "Rotation des sites d'injection respectée.",
    "Perfusion en place, point de ponction propre, débit conforme.",
    "Voie veineuse perméable, pansement occlusif propre.",
    "Ablation de la perfusion, point comprimé, pansement sec."
  ]},
  { name:"Devenir", phrases:[
    "À réévaluer au prochain passage.",
    "Prévoir renouvellement d'ordonnance.",
    "Commande de matériel à prévoir.",
    "Surveillance rapprochée les prochains jours.",
    "Patient apyrétique, poursuite du protocole en cours.",
    "Transmission faite au médecin traitant, en attente de consigne."
  ]}
];
/* Rappels : catégorie parente + sous-catégories concrètes (usage IDEL) */
const RAP_TYPES = {
  soin:      { ic:"💉", lbl:"Soin ponctuel", subs:[
    "Pansement lourd", "Injection spécifique", "Ablation fils / agrafes",
    "Renouvellement sonde", "Réfection PICC / CIP" ]},
  bilan:     { ic:"🧪", lbl:"Bilan / Prélèvement", subs:[
    "Prise de sang à jeun", "ECBU", "Frottis", "Test COVID / grippe",
    "Dépôt au laboratoire", "Résultats à récupérer" ]},
  pharmacie: { ic:"📦", lbl:"Pharmacie & Matériel", subs:[
    "Commande pilulier", "Récupérer ordonnance", "Récupérer matériel",
    "Livraison HAD / prestataire", "Rupture de stock pansements" ]},
  ordonnance:{ ic:"📋", lbl:"Ordonnance & Médecin", subs:[
    "Renouvellement ordonnance", "Appel médecin traitant",
    "Compte-rendu à transmettre", "Demande d'avis / réévaluation" ]},
  rdv:       { ic:"🗓️", lbl:"RDV & Transport", subs:[
    "Consultation spécialiste", "Séance kiné", "VSL / ambulance",
    "Hospitalisation", "Retour d'hospitalisation" ]},
  absence:   { ic:"🚪", lbl:"Absence patient", subs:[
    "Départ en famille", "Séjour de répit", "Non présent ponctuellement",
    "Hospitalisé" ]},
  autre:     { ic:"📌", lbl:"Autre / Divers", subs:[
    "Code porte changé", "Consigne famille", "Matériel à rapporter" ]}
};
/* Accès sûr à un type de rappel (types anciens ou reçus d'un collègue) */
function rapType(t){ return RAP_TYPES[t] || { ic:"📌", lbl:"Autre / Divers", subs:[] }; }

/* Compte à rebours calendaire d'un rappel : dormant → J-3…J-1 → JOUR J → dépassé */
function daysUntil(iso){
  if (!iso) return null;
  return Math.round((new Date(iso+"T12:00:00") - new Date(todayISO()+"T12:00:00")) / 86400000);
}
function rapCountdown(r){
  const n = daysUntil(r.due);
  if (n === null) return { txt:"", cls:"" };
  if (n < 0)  return { txt:"dépassé de " + (-n) + " j", cls:"past" };
  if (n === 0) return { txt:"JOUR J", cls:"jj" };
  if (n <= 3) return { txt:"J-" + n, cls:"soon" };
  return { txt:"dans " + n + " j", cls:"later" };
}

/* ---------- Bilans / RDV médicaux ---------- */
const BILAN_TYPES = ["Prise de sang","Radio","Scanner","IRM","Consultation","Ordonnance à renouveler","Autre"];
const BILAN_STATUTS = ["À faire","Fait","Résultat reçu"];

/* ---------- Thèmes commutables ---------- */
const APP_THEMES = {
  original:{lbl:"Original",dot:"#3FD0A4"},
  bloc:{lbl:"Bloc",dot:"#0E7DA0"},
  reunion:{lbl:"Réunion",dot:"#0E8F94"},
  verre:{lbl:"Verre fumé",dot:"#8FB0FF"},
  tubes:{lbl:"Tubes néon",dot:"#22D3EE"},
  hopital:{lbl:"Hôpital de nuit",dot:"#2BB3A3"}
};
function applyTheme(){
  const t = APP_THEMES[S.theme] ? S.theme : "original";
  if (t === "original") delete document.documentElement.dataset.appTheme;
  else document.documentElement.dataset.appTheme = t;
  if (t === "reunion"){
    const h = new Date().getHours();
    document.body.dataset.scene = h>=6&&h<11 ? "matin" : h>=11&&h<17 ? "jour" : "soir";
  } else delete document.body.dataset.scene;
}

/* ---------- État + persistance ---------- */
const CATALOG_CATS = [
  { cat:"Surveillance clinique et constantes", icon:"👁️", soins:[
    "TA / Pouls","Saturation (SpO2)","Température","Fréquence respiratoire","Poids / IMC",
    "Évaluation douleur","Surveillance œdèmes (OMI)","État cutané / Points d'appui",
    "Conscience / Fonctions cognitives","Observance / Tolérance ttt"
  ]},
  { cat:"Soins d'hygiène, confort et dépendance", icon:"🛁", soins:[
    "Toilette au lit","Toilette au lavabo","Douche / Bain","Soins de bouche","Hygiène des pieds",
    "Habillage / Déshabillage","Change de protection","Bas / Bandes de contention",
    "Installation / Transferts","Prévention escarres"
  ]},
  { cat:"Diabétologie", icon:"💉", soins:[
    "Glycémie capillaire (Dextro)","Cétonémie / Cétonurie","Injection insuline",
    "Changement capteur glycémie","Gestion pompe à insuline","Suivi carnet diabète"
  ]},
  { cat:"Injections et prélèvements", icon:"🩸", soins:[
    "Injection SC (HBPM...)","Injection IM","Injection IV directe",
    "Prélèvement sanguin (Prise de sang)","Prélèvement capillaire / TROD","Recueil d'urines / ECBU"
  ]},
  { cat:"Pansements et plaies", icon:"🩹", soins:[
    "Pansement simple (Ablation fils/agrafes)","Pansement complexe (Ulcère, escarre...)",
    "Soin de brûlure","Thérapie pression négative (TPN)","Surveillance fistule (FAV)","Soin de drain / Redon"
  ]},
  { cat:"Perfusions et abords vasculaires", icon:"🩺", soins:[
    "Pose / Suivi VVP","Soin voie centrale (PICC / PAC / Midline)","Perfusion sous-cutanée (Hypodermoclyse)",
    "Gestion diffuseur / Pompe","Réfection pansement voie centrale"
  ]},
  { cat:"Élimination et continence", icon:"🚿", soins:[
    "Sonde urinaire (Pose/Suivi)","Sondage évacuateur intermittent","Lavage vésical","Pose étui pénien",
    "Soin stomie urinaire","Soin stomie digestive","Lavement rectal"
  ]},
  { cat:"Respiratoire et nutrition", icon:"🫁", soins:[
    "Oxygénothérapie (Suivi extracteur)","Aspiration endotrachéale","Soins de trachéotomie",
    "Aérosolthérapie / Nébulisation","Alimentation entérale (SNG / GPE)","Suivi alimentation parentérale"
  ]},
  { cat:"Gestion médicamenteuse et coordination", icon:"💊", soins:[
    "Préparation pilulier","Distribution / Aide à la prise",
    "Dossier de soins / Transmissions","Coordination médicale et tiers"
  ]}
];
function getSoinName(orig){
  const ov = S && S.catalog && S.catalog.overrides;
  return (ov && ov[orig]) ? ov[orig] : orig;
}
function getSoinProtocol(orig){
  const pr = S && S.catalog && S.catalog.protocols;
  return (pr && pr[orig]) ? pr[orig] : "";
}
/* custom : tableau mixte rétro-compatible — "nom" (legacy) ou {nom, cat} */
function customEntries(){
  return ((S && S.catalog && S.catalog.custom) || []).map(e =>
    typeof e === "string" ? { nom:e, cat:"" } : e);
}
/* Combien d'endroits emploient ce soin ? Sert à prévenir avant de
   retirer une ligne du catalogue — sans jamais bloquer l'action. */
function usagesSoin(orig){
  // Un soin renommé garde son nom d'origine comme clé : on compte les deux
  const nom = ((S.catalog||{}).overrides||{})[orig] || orig;
  let passages = 0, plans = 0;
  (S.patients||[]).forEach(p => {
    (p.visits||[]).forEach(v => {
      if ((v.soins||[]).some(x => x === orig || x === nom)) passages++;
    });
    if ((p.plan||[]).some(x => x === orig || x === nom)) plans++;
  });
  return { passages, plans, total: passages + plans };
}

/* Retirer un soin du catalogue.
   ⚠️ Le catalogue est une LISTE DE CHOIX, pas une source de vérité :
   l'historique conserve le TEXTE du soin tel qu'il a été saisi. Retirer
   une ligne ne touche donc à aucun passage enregistré.
   Le plan de soins des patients est nettoyé — sinon on proposerait un
   soin qui n'existe plus. */
function retirerSoinCatalogue(orig){
  S.catalog = S.catalog || {};
  const nom = ((S.catalog||{}).overrides||{})[orig] || orig;

  // Soin personnalisé : on l'efface. Soin d'origine : on le désactive.
  const av = (S.catalog.custom||[]).length;
  S.catalog.custom = customEntries().filter(e => e.nom !== orig && e.nom !== nom);
  if (S.catalog.custom.length === av){
    S.catalog.disabled = S.catalog.disabled || [];
    if (!S.catalog.disabled.includes(orig)) S.catalog.disabled.push(orig);
  }
  // Nettoyer ce qui le proposerait encore
  if (S.catalog.overrides) delete S.catalog.overrides[orig];
  if (S.catalog.protocols) delete S.catalog.protocols[orig];
  (S.patients||[]).forEach(p => {
    if ((p.plan||[]).length){
      p.plan = p.plan.filter(x => x !== orig && x !== nom);
      if (p.planSlots)  { delete p.planSlots[orig];  delete p.planSlots[nom]; }
      if (p.planRythme) { delete p.planRythme[orig]; delete p.planRythme[nom]; }
    }
  });
}

function getCatalog(){
  const dis = (S && S.catalog && S.catalog.disabled) || [];
  const custom = customEntries().map(e=>e.nom);
  const all = [...CATALOG_CATS.flatMap(c=>c.soins), ...custom];
  return all.filter(x=>!dis.includes(x));
}
function getCatalogCats(){
  const dis  = (S && S.catalog && S.catalog.disabled) || [];
  const custom  = customEntries();
  const variants = (S && S.catalog && S.catalog.variants) || {};
  const catNames = (S && S.catalog && S.catalog.catNames) || {};
  const customCats = (S && S.catalog && S.catalog.customCats) || [];
  const cats = CATALOG_CATS.map(c=>{
    const soins = [];
    c.soins.filter(x=>!dis.includes(x)).forEach(orig => {
      soins.push({ orig, nom:getSoinName(orig), proto:getSoinProtocol(orig) });
      (variants[orig]||[]).forEach(v => soins.push({ orig:v, nom:getSoinName(v), proto:getSoinProtocol(v), parentCat:c.cat }));
    });
    // Soins perso rattachés à cette catégorie standard
    custom.filter(e=>e.cat===c.cat).forEach(e =>
      soins.push({ orig:e.nom, nom:getSoinName(e.nom), proto:getSoinProtocol(e.nom), custom:true }));
    return { cat: catNames[c.cat]||c.cat, icon:c.icon, origCat:c.cat, soins };
  }).filter(c=>c.soins.length);
  // Catégories créées par l'utilisateur
  customCats.forEach(cc => {
    const soins = custom.filter(e=>e.cat===cc).map(e =>
      ({ orig:e.nom, nom:getSoinName(e.nom), proto:getSoinProtocol(e.nom), custom:true }));
    if (soins.length) cats.push({ cat:cc, icon:"🗂️", origCat:cc, soins });
  });
  // Soins perso sans catégorie (legacy)
  const orphans = custom.filter(e=>!e.cat || (!CATALOG_CATS.some(c=>c.cat===e.cat) && !customCats.includes(e.cat)));
  if (orphans.length) cats.push({ cat:"Soins personnalisés", icon:"⭐", origCat:"__custom__",
    soins: orphans.map(e=>({ orig:e.nom, nom:getSoinName(e.nom), proto:getSoinProtocol(e.nom), custom:true })) });
  return cats;
}
let S = null, db = null;
let openId = null, filter = "all";
let _formDraft = null; // Brouillon du formulaire en cours pour survivre aux render()
let _lastVisitUid = null; // dernier passage validé — annulable quelques secondes
