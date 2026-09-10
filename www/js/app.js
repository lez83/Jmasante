/* ===== globals.js ===== */
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


/* ===== uikit.js ===== */
/* ============================================================
   UI-KIT — le vocabulaire visuel commun
   ─────────────────────────────────────────────────────────
   Le Moniteur avait gagné un langage (mot-repère, liseré,
   dégradé) que les autres écrans ignoraient. Ces fonctions
   le rendent disponible partout : on apprend une fois, on
   s'y retrouve sur tous les écrans.

   Un seul endroit à corriger pour toute l'application.
============================================================ */

/* ---------- Rangée titrée ----------
   uiRow("Portée", "ac", contenuHTML)
   ton : ac (accent) · am (ambre) · bl (bleu) · nt (neutre) */
function uiRow(label, ton, html, extra){
  return `<div class="rowlab ${ton||"nt"}">
      <span>${esc(label)}</span><i></i>${extra?`<em>${esc(extra)}</em>`:""}
    </div>
    <div class="rowbox ${ton||"nt"}" style="display:block;margin-bottom:12px">${html}</div>`;
}

/* ---------- Ligne de liste ----------
   Un gabarit unique pour documents, bilans, rappels, archives…
   { ic, titre, detail, etat, tonEtat, ton, data }             */
function uiListRow(o){
  const at = Object.entries(o.data||{}).map(([k,v])=>`data-${k}="${esc(v)}"`).join(" ");
  return `<button class="uirow ${o.ton?"t-"+o.ton:""}" ${at}>
    ${o.ic?`<span class="ui-ic">${o.ic}</span>`:""}
    <span class="ui-body">
      <span class="ui-t">${esc(o.titre||"")}</span>
      ${o.detail?`<span class="ui-d">${esc(o.detail)}</span>`:""}
    </span>
    ${o.etat?`<span class="ui-e ${o.tonEtat?"t-"+o.tonEtat:""}">${esc(o.etat)}</span>`:""}
    <span class="ui-ch">›</span>
  </button>`;
}

/* ---------- Écran vide ----------
   Plutôt qu'une phrase grise : dire ce qu'on peut mettre là,
   et proposer de le faire.                                    */
function uiEmpty(ic, titre, aide, action){
  return `<div class="uiempty">
    <div class="ue-ic">${ic||"📭"}</div>
    <div class="ue-t">${esc(titre)}</div>
    ${aide?`<div class="ue-a">${esc(aide)}</div>`:""}
    ${action?`<button class="btn btn-ghost ue-b" ${action.data||""} style="border-color:var(--accent);color:var(--accent)">${esc(action.label)}</button>`:""}
  </div>`;
}

/* ---------- Pied de feuille ----------
   Action secondaire à gauche, principale à droite et plus large.
   Toujours au même endroit, dans le même ordre.               */
function uiActions(annuler, valider, danger){
  return `<div class="uiact">
      <button class="btn btn-ghost" ${annuler.data||""} id="${annuler.id||""}">${esc(annuler.label||"Annuler")}</button>
      <button class="btn btn-primary" ${valider.data||""} id="${valider.id||""}">${esc(valider.label||"✓ Enregistrer")}</button>
    </div>
    ${danger?`<button class="btn uidanger" ${danger.data||""} id="${danger.id||""}">${esc(danger.label)}</button>`:""}`;
}

/* ---------- Section de catalogue ----------
   Une couleur par famille, et le nombre annoncé.              */
const UI_TONS = ["ac","bl","am","vi","nt"];
function uiCat(ic, nom, n, html, i){
  const ton = UI_TONS[(i||0) % UI_TONS.length];
  return `<div class="rowlab ${ton}" style="margin-top:12px">
      ${ic?`<span class="rl-ic">${ic}</span>`:""}
      <span>${esc(nom)}</span><i></i>${n?`<em>${n}</em>`:""}
    </div>
    <div class="rowbox ${ton}">${html}</div>`;
}


/* ===== storage.js ===== */
function openDB(){ return new Promise((res,rej)=>{ const rq=indexedDB.open("transm_d2",1);
  rq.onupgradeneeded=e=>e.target.result.createObjectStore("kv");
  rq.onsuccess=e=>{db=e.target.result;res();}; rq.onerror=()=>rej(rq.error); }); }
const _rawGet=k=>new Promise((res,rej)=>{const r=db.transaction("kv").objectStore("kv").get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);});
const _rawDel=k=>new Promise((res,rej)=>{const r=db.transaction("kv","readwrite").objectStore("kv").delete(k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});
const _rawSet=(k,v)=>new Promise((res,rej)=>{const r=db.transaction("kv","readwrite").objectStore("kv").put(v,k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error);});
const _rawKeys=()=>new Promise((res,rej)=>{const r=db.transaction("kv").objectStore("kv").getAllKeys();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error);});

/* ============================================================
   BACKEND SQLITE CHIFFRÉ (SQLCipher) — natif Android
   Table kv(k TEXT PK, v TEXT). Fallback IndexedDB sur web.
   Migration automatique IDB → SQLite au premier lancement natif.
============================================================ */
let _sql = null;
const SQLDB = "jmsante";

async function initSqlite(){
  const cap = window.Capacitor;
  if (!(cap && cap.isNativePlatform && cap.isNativePlatform())) return false;
  const P = cap.Plugins && cap.Plugins.CapacitorSQLite;
  if (!P) return false;
  try {
    // Passphrase SQLCipher : réutilise le secret local (même source que la clé AES applicative)
    const secret = await _getOrCreateSecret();
    try {
      const st = await P.isSecretStored();
      if (!st || !st.result) await P.setEncryptionSecret({ passphrase: secret });
    } catch(e){ /* déjà défini ou non supporté */ }
    await P.createConnection({ database:SQLDB, version:1, encrypted:true, mode:"secret", readonly:false });
    await P.open({ database:SQLDB, readonly:false });
    await P.execute({ database:SQLDB, statements:"CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);" });
    _sql = P;
    // Migration : si SQLite vide et IDB peuplée → copier
    const probe = await P.query({ database:SQLDB, statement:"SELECT COUNT(*) AS n FROM kv;", values:[] });
    const empty = !probe.values || !probe.values.length || !probe.values[0].n;
    if (empty && db){
      const keys = await _rawKeys();
      if (keys.length){
        for (const k of keys){
          const v = await _rawGet(k);
          if (v !== undefined)
            await P.run({ database:SQLDB, statement:"INSERT OR REPLACE INTO kv (k,v) VALUES (?,?);", values:[String(k), JSON.stringify(v)] });
        }
        console.log("Migration IDB → SQLite :", keys.length, "clés");
      }
    }
    return true;
  } catch(e){ console.warn("SQLite init KO, fallback IndexedDB :", e); _sql = null; return false; }
}

const _sqlGet = async k => {
  const r = await _sql.query({ database:SQLDB, statement:"SELECT v FROM kv WHERE k=?;", values:[String(k)] });
  if (!r.values || !r.values.length) return undefined;
  try { return JSON.parse(r.values[0].v); } catch { return r.values[0].v; }
};
const _sqlSet = (k,v) => _sql.run({ database:SQLDB, statement:"INSERT OR REPLACE INTO kv (k,v) VALUES (?,?);", values:[String(k), JSON.stringify(v)] });
const _sqlDel = k => _sql.run({ database:SQLDB, statement:"DELETE FROM kv WHERE k=?;", values:[String(k)] });

/* Routeur bas niveau : SQLite natif si dispo, sinon IndexedDB */
const _backGet = k => _sql ? _sqlGet(k) : _rawGet(k);
const _backSet = (k,v) => _sql ? _sqlSet(k,v) : _rawSet(k,v);
const _backDel = k => _sql ? _sqlDel(k) : _rawDel(k);

/* Routeur applicatif : chiffre/déchiffre de façon transparente.
   "state" ET les documents "doc_*" — ordonnances, comptes-rendus, photos
   de plaies sont les données les plus sensibles du dossier : en clair,
   un téléphone perdu les livre à qui sait fouiller le stockage.
   "__secret__" reste en clair : c'est la clé elle-même.

   ⚠️ Les documents ajoutés AVANT cette version sont en clair. La lecture
   les accepte tels quels ; ils sont rechiffrés à la première réécriture.
   Aucune migration forcée : elle bloquerait l'app au démarrage sur un
   dossier volumineux. */
const _aChiffrer = k => k === "state" || String(k).startsWith("doc_");

async function idbGet(k){
  const v = await _backGet(k);
  if (_aChiffrer(k) && v && v._enc){
    const dec = await decryptState(v);
    return dec;   // null si la clé ne correspond pas
  }
  return v;       // document d'avant le chiffrement : lisible tel quel
}
async function idbSet(k, v){
  if (_aChiffrer(k)){
    const enc = await encryptState(v);
    return _backSet(k, enc);
  }
  return _backSet(k, v);
}
const idbDel = k => _backDel(k);
let saveT=null;
let _saveCount = 0;

/* ============================================================
   CHIFFREMENT AES-GCM DE L'ÉTAT (IndexedDB)
   - Clé aléatoire per-session dérivée d'un secret persistant
   - Si PIN actif, la clé est renforcée avec le hash du PIN
   - Transparent : idbGet/idbSet chiffrent/déchiffrent auto
============================================================ */
let _encKey = null;

let _secretCache = null;
async function _getOrCreateSecret(){
  if (_secretCache) return _secretCache;
  const KEY = "jmsante_secret_v1";
  // Source de vérité : IndexedDB (persiste au kill de l'app, contrairement à localStorage en WebView)
  let secret = null;
  try { secret = await _rawGet("__secret__"); } catch {}
  // Récupération depuis l'ancien emplacement (localStorage) pour ne PAS casser les bases existantes
  if (!secret){
    try { secret = localStorage.getItem(KEY) || null; } catch {}
    if (secret){ try { await _rawSet("__secret__", secret); } catch {} } // migrer vers IDB
  }
  // Aucune trace : première utilisation → générer et persister dans IDB
  if (!secret){
    const buf = crypto.getRandomValues(new Uint8Array(32));
    secret = btoa(String.fromCharCode(...buf));
    try { await _rawSet("__secret__", secret); } catch {}
    try { localStorage.setItem(KEY, secret); } catch {} // copie de secours best-effort
  }
  _secretCache = secret;
  return secret;
}

async function _deriveKey(secret, pinHash){
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(secret+(pinHash||"")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name:"PBKDF2", salt:enc.encode("jmsante_v1"), iterations:100000, hash:"SHA-256" },
    keyMat, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]
  );
}

async function ensureEncKey(){
  if (_encKey) return _encKey;
  try {
    const secret = await _getOrCreateSecret();
    const pinHash = (S && S.pin) ? S.pin : "";
    _encKey = await _deriveKey(secret, pinHash);
  } catch(e){ _encKey = null; }
  return _encKey;
}

/* ⚠️ String.fromCharCode(...tableau) passe CHAQUE OCTET en argument.
   Sur un document de 2 Mo, cela fait deux millions d'arguments et la
   pile d'appels explose — « Maximum call stack size exceeded ».
   Le dossier patient passait, petit ; les documents non.
   On convertit par tranches de 32 Ko. */
function _b64(u8){
  const T = 0x8000;              // tranche sûre pour fromCharCode
  let out = "";
  for (let i = 0; i < u8.length; i += T){
    out += String.fromCharCode.apply(null, u8.subarray(i, i + T));
  }
  return btoa(out);
}

async function encryptState(obj){
  const key = await ensureEncKey();
  if (!key) return obj; // pas de chiffrement sans clé
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, plain);
  // Stocker comme { _enc: true, iv: base64, data: base64 }
  return { _enc:true, iv:_b64(iv), data:_b64(new Uint8Array(cipher)) };
}

/* Même précaution au retour : atob(...).split("") créait un tableau
   de plusieurs millions d'éléments sur un gros document. */
function _deb64(b64){
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

async function decryptState(stored){
  if (!stored || !stored._enc) return stored; // pas chiffré
  const key = await ensureEncKey();
  if (!key) return null;
  try {
    const iv   = _deb64(stored.iv);
    const data = _deb64(stored.data);
    const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv}, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch(e){ console.warn("Déchiffrement échoué:", e); return null; }
}

/* ============================================================
   SAUVEGARDE
   ─────────────────────────────────────────────────────────
   L'écriture est différée de 300 ms pour ne pas écrire cent
   fois pendant la frappe. Mais ce délai ouvrait une fenêtre
   de perte : valider un passage puis ranger le téléphone,
   Android suspend l'app, le setTimeout ne part jamais et la
   donnée reste en mémoire. Aucune alerte — l'app n'a jamais
   su qu'elle devait écrire.

   Trois parades :
   - save(true) écrit tout de suite (gestes lourds)
   - flushSave() force l'écriture en attente
   - l'app force elle-même quand elle passe en arrière-plan
============================================================ */
let _saveDirty = false;      // une écriture est-elle en attente ?
let _saveLast  = null;       // horodatage de la dernière écriture réussie

function _doSave(){
  _saveDirty = false;
  clearTimeout(saveT);
  const b = document.getElementById("save-badge");
  if (b){ b.className="save-badge saving"; b.title="Sauvegarde…"; b.textContent="💾"; }
  return idbSet("state", JSON.parse(JSON.stringify(S))).then(()=>{
    _saveCount++; _saveLast = Date.now();
    if (b){ b.className="save-badge ok"; b.title="Appuie pour exporter une sauvegarde"; b.textContent="💾 ✓"; }
    if (_saveCount <= 3) toast("✓ Sauvegardé localement");
    setTimeout(()=>{ if(b){ b.className="save-badge"; b.textContent="💾"; } }, 3000);
  }).catch(err=>{
    _saveDirty = true;                       // toujours en attente
    logIncident("save", "Échec d'enregistrement", err);
    toast("⚠ Échec de sauvegarde !", "danger");
    if(b){ b.className="save-badge"; b.textContent="💾"; }
  });
}

/* save(true) : écrit immédiatement — pour tout geste qu'on ne veut
   pas perdre (valider un passage, supprimer, importer). */
function save(immediat){
  _saveDirty = true;
  if (immediat){ return _doSave(); }
  clearTimeout(saveT);
  const b = document.getElementById("save-badge");
  if (b){ b.className="save-badge saving"; b.title="Sauvegarde…"; b.textContent="💾"; }
  saveT = setTimeout(_doSave, 300);
}

/* Force l'écriture en attente. Appelé quand l'app part en arrière-plan. */
function flushSave(){
  if (!_saveDirty) return Promise.resolve();
  clearTimeout(saveT);
  return _doSave();
}

/* L'app peut être suspendue à tout moment : on écrit avant de partir.
   visibilitychange couvre le passage en arrière-plan, pagehide la
   fermeture, freeze la mise en veille par Android. */
["visibilitychange","pagehide","freeze"].forEach(ev =>
  document.addEventListener(ev, () => {
    if (ev === "visibilitychange" && document.visibilityState !== "hidden") return;
    flushSave();
  }, { capture:true }));
window.addEventListener("blur", () => flushSave());

function defaultState(){ return { version:1, tours:[], curTour:"all", patients:[], rappels:[], patientOrder:{} }; }
const getP = id => S.patients.find(p=>p.id===id);
// Patients actifs : ni archivés, ni en fin de prise en charge.
// Les dossiers clôturés restent dans S.patients → trouvables par la recherche.
const activeP = () => S.patients.filter(p=>!p.archived && !p.pec);
const inTour = p => S.curTour==="all" || (p.tours||[]).includes(S.curTour);
const rapOf = pid => S.rappels.filter(r=>r.pid===pid && !r.done);
const bilansPending = p => (p.bilans||[]).filter(b => b.statut !== "Résultat reçu" && b.statut !== "Fait");
function migrate(){
  S.tours = S.tours || [];
  S.curTour = S.curTour || "all";
  if (S.curTour !== "all" && !S.tours.includes(S.curTour)) S.curTour = "all";
  S.patients.forEach(p => { p.bilans = p.bilans||[]; p.docs = p.docs||[]; p.visits = p.visits||[];
    p.plan = p.plan||[]; p.tours = p.tours||[]; p.archived = p.archived||null; });
  S.rappels = S.rappels||[];
  S.patientOrder = S.patientOrder||{};
  S.slotOrder = S.slotOrder||{};
  S.slotMembers = S.slotMembers||{};
  S.trash = S.trash||[];
  // ── Socle synchro multi-utilisateurs ──
  if (!S.identity) S.identity = null;          // { nom, prenom, uid } — saisi au 1er usage
  if (!S.changeLog) S.changeLog = [];          // journal d'opérations horodatées/signées
  if (!S.syncState) S.syncState = {};          // { <peerUid>: { lastPushSeq, lastPullTs } }
  if (!S.syncHistory) S.syncHistory = [];      // fusions reçues + snapshots (garde-fou)
  if (S.changeSeq === undefined) S.changeSeq = 0;
  if (!S.noVisit) S.noVisit = {};
  // Rappels : distinguer cabinet / personnel / patient.
  // Les anciens rappels « généraux » (sans patient) deviennent PERSONNELS :
  // rattachés à aucun cabinet, on ne peut pas savoir lequel — et un rappel
  // personnel ne fuite jamais. L'IDEL les réaffectera s'il le souhaite.
  (S.rappels||[]).forEach(r => {
    if (r.perso !== undefined || r.tour !== undefined) return;   // déjà migré
    if (r.pid){
      const _p = (S.patients||[]).find(x => x.id === r.pid);
      r.tour = (_p && (_p.tours||[])[0]) || null;
      r.perso = false;
    } else {
      r.perso = true; r.tour = null;
    }
  });
  // Migration du champ « contexte » vers les informations subdivisées.
  // L'ancien texte devient un antécédent, masqué de la relève par défaut :
  // il n'apparaîtra plus comme une vigilance.
  (S.patients||[]).forEach(p => {
    if (!p.infos){
      p.infos = [];
      if ((p.ctx||"").trim())
        p.infos.push({ id:uid(), type:"atcd", txt:p.ctx.trim(), show:false });
    }
  });
  if (S.lastSentSeq === undefined) S.lastSentSeq = 0;
  if (S.confirmedSeq === undefined) S.confirmedSeq = 0;
  // S.catalog complet (sauvegardes antérieures au catalogue : clé absente ou ancien format tableau)
  if (Array.isArray(S.catalog)) S.catalog = { custom:[...S.catalog] };
  if (!S.catalog || typeof S.catalog !== "object") S.catalog = {};
  S.catalog.overrides = S.catalog.overrides || {};
  S.catalog.protocols = S.catalog.protocols || {};
  S.catalog.custom    = S.catalog.custom    || [];
  S.catalog.disabled  = S.catalog.disabled  || [];
  S.catalog.variants  = S.catalog.variants  || {};
  S.catalog.catNames  = S.catalog.catNames  || {};
  S.catalog.customCats= S.catalog.customCats|| [];
  if (!Array.isArray(S.phraseCats) || !S.phraseCats.length){
    S.phraseCats = JSON.parse(JSON.stringify(DEFAULT_PHRASE_CATS));
    // Récupérer les éventuelles phrases perso de l'ancien format plat
    if (S.phrases && S.phrases.length){
      const all = new Set(S.phraseCats.flatMap(c=>c.phrases));
      const perso = S.phrases.filter(ph => !all.has(ph));
      if (perso.length) S.phraseCats.push({ name:"Mes phrases", phrases:perso });
    }
    delete S.phrases;
    S.phraseSeedV = 3;
  }
  // Enrichissements ultérieurs du catalogue par défaut (ajout des catégories manquantes uniquement)
  if ((S.phraseSeedV||1) < 3){
    const existing = new Set(S.phraseCats.map(c=>c.name));
    DEFAULT_PHRASE_CATS.forEach(dc => { if (!existing.has(dc.name)) S.phraseCats.push(JSON.parse(JSON.stringify(dc))); });
    S.phraseSeedV = 3;
  }
  if (!S.sendLog) S.sendLog = [];
  (S.patients||[]).forEach(p => {
    if(!p.tags) p.tags = [];
    /* « Matériel à apporter » était un rappel déguisé : on le convertit
       plutôt que de le perdre silencieusement. */
    if (p.tags.includes("materiel")){
      p.tags = p.tags.filter(t => t !== "materiel");
      S.rappels = S.rappels || [];
      const dejaLa = S.rappels.some(r => r.pid === p.id && r._fromTag === "materiel");
      if (!dejaLa) S.rappels.push({
        id: uid(), pid: p.id, tour: (p.tours||[])[0] || null, perso: false,
        type: "materiel", text: "Matériel à apporter",
        due: todayISO(), done: false, _fromTag: "materiel"
      });
    }
    if(p.genre===undefined) p.genre="";
    if(!p.address) p.address="";
    if(!p.contacts) p.contacts={};
    if(p.thresholds===undefined) p.thresholds=undefined;
    // Migration docs : extraire les data vers IDB séparées
    (p.docs||[]).forEach(d => {
      if(d.data && d.data.length > 10){
        idbSet("doc_"+d.id, d.data).catch(()=>{});
        delete d.data; // supprimer du state principal
      }
    });
  });
  if (Array.isArray(S.catalog)){
    S.catalog = { overrides:{}, protocols:{}, custom:S.catalog, disabled:[] };
  } else if (!S.catalog || typeof S.catalog !== "object"){
    S.catalog = { overrides:{}, protocols:{}, custom:[], disabled:[] };
  } else {
    S.catalog.overrides  = S.catalog.overrides  || {};
    S.catalog.protocols  = S.catalog.protocols  || {};
    S.catalog.custom     = Array.isArray(S.catalog.custom)   ? S.catalog.custom   : [];
    S.catalog.variants   = S.catalog.variants   || {};  // { "parent orig": ["variant1", ...] }
    S.catalog.disabled   = Array.isArray(S.catalog.disabled) ? S.catalog.disabled : [];
  }
  S.retention = [3,6,12].includes(S.retention) ? S.retention : 12;
  S.pin = S.pin || null;
  S.theme = APP_THEMES[S.theme] ? S.theme : "original";
}

/* ============================================================
   [SÉCURITÉ] Verrou PIN (empreinte haché SHA-256, jamais en clair)
   Version Capacitor : ajout biométrie + base SQLite chiffrée.
============================================================ */
async function pinHash(code){
  if (crypto && crypto.subtle){
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("jmsante:" + code));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
  }
  return "plain:" + code; // repli pour environnements sans WebCrypto
}
let pinBuf = "", pinMode = "unlock", pinFirst = "";
async function bioAvailable(){
  const cap = window.Capacitor;
  const B = cap && cap.Plugins && cap.Plugins.BiometricAuthNative;
  if (!B || !(cap.isNativePlatform && cap.isNativePlatform())) return false;
  try { const r = await B.checkBiometry(); return !!(r && r.isAvailable); } catch { return false; }
}
async function bioUnlock(){
  const cap = window.Capacitor;
  const B = cap && cap.Plugins && cap.Plugins.BiometricAuthNative;
  if (!B) return false;
  try {
    // NB : la méthode NATIVE s'appelle internalAuthenticate (authenticate n'existe
    // que dans le wrapper JS du plugin, non utilisé ici sans bundler)
    await B.internalAuthenticate({
      reason:"Déverrouiller JM@Santé",
      cancelTitle:"Utiliser le code",
      androidTitle:"Déverrouillage JM@Santé",
      androidSubtitle:"Empreinte ou visage",
      allowDeviceCredential:false
    });
    return true;
  } catch(e){ console.warn("bio:", e); return false; }
}
function showLock(mode){
  pinMode = mode; pinBuf = ""; pinFirst = "";
  $("#lockmsg").textContent = mode === "set" ? "Choisis un code à 4 chiffres" : "Saisis ton code pour déverrouiller";
  drawDots();
  const pad = $("#pinpad");
  const keys = ["1","2","3","4","5","6","7","8","9", (mode==="unlock"&&S.bioLock)?"👆":"", "0","⌫"];
  pad.innerHTML = keys
    .map(k => k === "" ? "<span></span>" : `<button data-k="${k}">${k}</button>`).join("");
  pad.querySelectorAll("button").forEach(b => b.onclick = () => {
    if (b.dataset.k === "👆"){ bioUnlock().then(ok => { if(ok) $("#lock").classList.remove("on"); }); return; }
    pinKey(b.dataset.k);
  });
  $("#lock").classList.add("on");
  // Tentative biométrique automatique à l'ouverture du verrou
  if (mode === "unlock" && S.bioLock){
    bioUnlock().then(ok => { if(ok) $("#lock").classList.remove("on"); });
  }
}
function drawDots(){ $$("#lockdots .d").forEach((d,i) => d.classList.toggle("f", i < pinBuf.length)); }
async function pinKey(k){
  if (k === "⌫") pinBuf = pinBuf.slice(0,-1);
  else if (pinBuf.length < 4) pinBuf += k;
  drawDots();
  if (pinBuf.length !== 4) return;
  const code = pinBuf;
  if (pinMode === "unlock"){
    if (await pinHash(code) === S.pin){ $("#lock").classList.remove("on"); }
    else { toast("Code incorrect", "danger"); pinBuf = ""; drawDots(); }
  } else {
    if (!pinFirst){
      pinFirst = code; pinBuf = ""; drawDots();
      $("#lockmsg").textContent = "Confirme le code";
    } else if (pinFirst === code){
      S.pin = await pinHash(code); save();
      $("#lock").classList.remove("on");
      toast("Code activé 🔒"); sheetTours();
    } else {
      toast("Les codes ne correspondent pas", "danger");
      pinFirst = ""; pinBuf = ""; drawDots();
      $("#lockmsg").textContent = "Choisis un code à 4 chiffres";
    }
  }
}

/* ============================================================
   [SAUVEGARDE / RESTAURATION]
   Export JSON complet ; import v3 ou conversion de l'ancienne
   app « Suivi Infirmier » (format infirmierPRO).
============================================================ */
/* ============================================================
   saveToDevice(fname, data, {base64}) — enregistrement local Android
   Android 11+ (stockage cloisonné) refuse l'écriture directe dans
   Documents (FILE_NOTCREATED). Téléchargements reste autorisé pour
   les fichiers créés par l'appli. Ordre d'essai :
   1) /Download (racine externe)  2) Documents  3) échec → message
   Retourne le libellé du chemin lisible, ou lance une erreur.
============================================================ */
async function saveToDevice(fname, data, opts={}){
  /* Un dossier choisi par l'utilisateur passe avant tout le reste ;
     s'il échoue, on reprend la voie normale sans rien perdre. */
  if (typeof ecrireDansDossier === "function"){
    try {
      const ou = await ecrireDansDossier(fname, data, opts);
      if (ou) return ou;
    } catch(e){ logIncident("saveToDevice", "Dossier choisi indisponible", e); }
  }
  const cap = window.Capacitor;
  // 0) Plugin natif JMSaveFile (MediaStore.Downloads) — voie officielle, sans permission
  if (cap.Plugins.JMSaveFile){
    try {
      const mime = opts.mime || (fname.endsWith(".json") ? "application/json" : fname.endsWith(".pdf") ? "application/pdf"
        : fname.endsWith(".html") ? "text/html" : fname.endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain");
      const r = await cap.Plugins.JMSaveFile.save({ name:fname, data, mime, base64:!!opts.base64 });
      return "Fichiers ▸ " + (r.path || "Téléchargements/JMSante/"+fname);
    } catch(e){ console.warn("JMSaveFile:", e); }
  }
  const { Filesystem } = cap.Plugins;
  const enc = opts.base64 ? {} : { encoding:"utf8" };
  const attempts = [
    { path:"Download/"+fname, directory:"EXTERNAL_STORAGE", label:"Fichiers ▸ Téléchargements" },
    { path:fname,             directory:"DOCUMENTS",        label:"Fichiers ▸ Documents" }
  ];
  let lastErr = null;
  for (const a of attempts){
    try {
      await Filesystem.writeFile({ path:a.path, directory:a.directory, data, ...enc, recursive:true });
      await Filesystem.stat({ path:a.path, directory:a.directory });
      return a.label + " ▸ " + fname;
    } catch(e){ lastErr = e; console.warn("saveToDevice", a.directory, e); }
  }
  throw lastErr || new Error("Écriture impossible");
}

async function exportBackup(mode){
  // mode : "save" (fichier local uniquement) | "share" (menu de partage) | défaut = les deux tentés
  if (!S.patients.length){ toast("Aucune donnée à sauvegarder."); return; }
  S.lastBackup = Date.now(); save();

  /* Les contenus des documents vivent hors du state (clés doc_<id>).
     Sans eux, une sauvegarde restaurée n'affiche que des noms de fichiers
     et le message « contenu introuvable ». On les joint donc au fichier. */
  const _docs = {};
  let _nDocs = 0;
  for (const p of (S.patients||[])){
    for (const d of (p.docs||[])){
      try {
        const data = await idbGet("doc_"+d.id);
        if (data){ _docs[d.id] = data; _nDocs++; }
      } catch(e){ /* document illisible : ignoré */ }
    }
  }
  /* Le fichier contient les dossiers EN CLAIR : noms, dates de naissance,
     transmissions, contenu des documents. Rien ne le disait jusqu'ici. */
  if (!S.bkAvertiVu && typeof askDialog === "function"){
    const ok = await askDialog({
      ic:"🔐", titre:"Ce que contient la sauvegarde",
      sub:"Noms, dates de naissance, adresses, transmissions et documents — <b>en clair</b>.",
      warn:"Range ce fichier en lieu sûr : toute personne y ayant accès peut le lire.",
      oui:"✓ J'ai compris", non:"Annuler" });
    if (!ok) return;
    S.bkAvertiVu = true;
  }
  const json = JSON.stringify({ ...S, _docs }, null, 1);
  if (_nDocs) toast(_nDocs + " document(s) inclus dans la sauvegarde 📎");
  const fname = "JMSante_sauvegarde_" + todayISO() + ".json";
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    const { Filesystem, Share } = cap.Plugins;
    if (mode !== "share"){
      try {
        const where = await saveToDevice(fname, json);
        toast("💾 Enregistré : " + where);
      } catch(e){
        toast("Enregistrement local refusé par Android (" + (e.message||e).slice(0,40) + ") — utilise 📤 Partager → Fichiers/Drive.", "danger");
        if (mode === "save") return;
      }
      if (mode === "save") return;
    }
    try {
      const cache = await Filesystem.writeFile({ path:fname, data:json, directory:"CACHE", encoding:"utf8" });
      await Share.share({ title:"Sauvegarde JM@Santé", url:cache.uri });
    } catch(e){
      if (!(e.message||"").match(/cancel/i)){ console.warn("export share:", e); toast("Partage échoué : " + (e.message||e).slice(0,60), "danger"); }
    }
    return;
  }
  const blob = new Blob([json], { type:"application/json" });
  downloadBlob(fname, blob);
  toast("Sauvegarde exportée 💾");
}
function convertLegacy(j){
  const tours = Array.isArray(j.availableTours) && j.availableTours.length ? j.availableTours : [];
  const patients = (j.patients||[]).map(op => {
    const visits = [];
    (op.soins||[]).forEach(x => visits.push({ uid:uid(), date:x.date||todayISO(), at:x.heure&&/^\d/.test(x.heure)?x.heure:"",
      soins:[x.type||"Autre soin"], consts:{}, note:x.comm||"" }));
    (op.constantes||[]).forEach(x => visits.push({ uid:uid(), date:x.date||todayISO(), at:x.heure||"",
      soins:[], consts:{ ta:x.ta||"", temp:x.temp??"", sat:x.sat??"", puls:x.puls??"", glyc:"", douleur:x.douleur??"" }, note:"" }));
    const bilans = (op.bilans||[]).map(x => ({ id:uid(), type:x.type||"Autre", date:x.date||todayISO(),
      statut:["À faire","Fait","Résultat reçu"].includes(x.statut) ? x.statut : "À faire", res:x.res||"" }));
    return { id:String(op.id||uid()), nom:op.nom||"", prenom:op.prenom||"", dob:op.dob||"",
      ctx:(op.notes||"").trim(), tours:(op.tours||[]).filter(t=>tours.includes(t)),
      plan:[], docs:[], bilans, visits, archived:null };
  });
  return { version:1, tours, curTour:"all", patients, rappels:[] };
}
async function importBackupText(txt){

    // 1. Lecture brute
    let raw = txt;
    if (typeof raw !== "string" || !raw.trim()){
      toast("Fichier vide ou illisible.", "danger"); return;
    }
    // Retirer un éventuel BOM / espaces parasites
    raw = raw.replace(/^\uFEFF/, "").trim();
    // 2. Parsing JSON
    let j;
    // Archive JM@Santé : parcours dédié (choix des passages à réintégrer)
    try {
      const t = JSON.parse(raw);
      if (t && t._jmarchive && typeof importArchive === "function"){ importArchive(raw); return; }
    } catch(e){}
    try { j = JSON.parse(raw); }
    catch(e){
      console.error("JSON:", e);
      toast("Ce fichier n'est pas une sauvegarde JSON valide (" + e.message.slice(0,60) + ")", "danger");
      return;
    }
    // 3. Reconnaissance du format
    let incoming = null;
    try {
      if (j && Array.isArray(j.patients) && j.version >= 1) incoming = j;
      else if (j && Array.isArray(j.patients)) incoming = convertLegacy(j);
    } catch(e){ console.error("convert:", e); }
    /* Restaurer les contenus des documents joints à la sauvegarde.
       Sans cette étape, la fiche mentionne des fichiers dont le contenu
       n'existe plus (« contenu introuvable »). */
    if (incoming && incoming._docs && typeof incoming._docs === "object"){
      let n = 0;
      for (const [id, data] of Object.entries(incoming._docs)){
        if (!data) continue;
        try { await idbSet("doc_"+id, data); n++; } catch(e){ console.warn("doc restore:", e); }
      }
      delete incoming._docs;          // ne pas conserver dans le state
      if (n) toast(n + " document(s) restauré(s) 📎");
    }

    if (!incoming || !Array.isArray(incoming.patients)){
      toast("Fichier non reconnu comme sauvegarde JM@Santé.", "danger"); return;
    }
    // 4. Normaliser les dossiers (sauvegardes anciennes : champs manquants)
    incoming.patients.forEach(p => {
      p.visits  = p.visits  || [];
      p.bilans  = p.bilans  || [];
      p.docs    = p.docs    || [];
      p.tags    = p.tags    || [];
      p.contacts= p.contacts|| {};
      p.tours   = p.tours   || [];
    });
    incoming.rappels = incoming.rappels || [];
    // 5. Choix : fusionner (recommandé) ou remplacer — avec sauvegarde de sécurité
    sheetImportChoice(incoming);
}

/* ---------- Écran de choix à l'import d'une sauvegarde ---------- */
async function sheetImportChoice(incoming){
  const nIn = incoming.patients.length;
  const nMe = (S.patients||[]).length;
  // Que va-t-on ajouter / mettre à jour en cas de fusion ?
  const mine = new Set((S.patients||[]).map(p=>p.id));
  const nouveaux = incoming.patients.filter(p=>!mine.has(p.id)).length;
  const communs  = nIn - nouveaux;

  openSheet(`
    <h3>📂 Importer une sauvegarde</h3>
    <p class="small muted" style="margin-bottom:12px">
      Le fichier contient <b>${nIn} dossier(s)</b>. Tu en as actuellement <b>${nMe}</b>.
      ${nouveaux ? `<br>${nouveaux} nouveau(x) · ${communs} déjà présent(s).` : ""}
    </p>

    <button class="btn btn-primary" id="imp-merge" style="width:100%;text-align:left;padding:14px">
      🔀 <b>Fusionner</b> <span class="small" style="opacity:.85">(recommandé)</span>
      <div class="small" style="opacity:.85;font-weight:400;margin-top:3px;line-height:1.4">
        Ajoute les dossiers manquants et complète les passages, sans rien supprimer
        de ce que tu as déjà.
      </div>
    </button>

    <button class="btn btn-ghost" id="imp-replace" style="width:100%;text-align:left;padding:14px;margin-top:10px">
      ♻️ <b>Remplacer tout</b>
      <div class="small muted" style="font-weight:400;margin-top:3px;line-height:1.4">
        Efface tes données actuelles et les remplace par celles du fichier.
        À utiliser pour restaurer après une perte.
      </div>
    </button>

    <div class="tip small" style="margin-top:12px">Dans les deux cas, une <b>sauvegarde de sécurité</b> de ton état actuel est créée : tu pourras revenir en arrière depuis 🗺️ → 🕰️ Historique des synchros.</div>
    <button class="btn btn-ghost" id="imp-cancel" style="width:100%;margin-top:10px">Annuler</button>`);

  const snapshot = label => {
    try { if (typeof makeSyncSnapshot === "function") makeSyncSnapshot(label); } catch(e){}
  };

  $("#imp-merge").onclick = () => {
    snapshot("Avant import (fusion)");
    let add = 0, upd = 0, vis = 0;
    incoming.patients.forEach(pin => {
      const local = (S.patients||[]).find(p => p.id === pin.id);
      if (!local){ S.patients.push(pin); add++; return; }
      // Fusion patient : compléter les champs vides, ajouter les passages absents
      ["nom","prenom","dob","ctx","genre","address"].forEach(k => { if (!local[k] && pin[k]) local[k] = pin[k]; });
      local.contacts = { ...(pin.contacts||{}), ...(local.contacts||{}) };
      local.plan  = local.plan  && local.plan.length  ? local.plan  : (pin.plan||[]);
      local.tours = [...new Set([...(local.tours||[]), ...(pin.tours||[])])];
      local.tags  = [...new Set([...(local.tags||[]),  ...(pin.tags||[])])];
      const seen = new Set((local.visits||[]).map(v=>v.uid));
      (pin.visits||[]).forEach(v => { if (!seen.has(v.uid)){ local.visits.push(v); vis++; } });
      const bs = new Set((local.bilans||[]).map(b=>b.id));
      (pin.bilans||[]).forEach(b => { if (!bs.has(b.id)) local.bilans.push(b); });
      const ds = new Set((local.docs||[]).map(d=>d.id));
      (pin.docs||[]).forEach(d => { if (!ds.has(d.id)) local.docs.push(d); });
      upd++;
    });
    // Rappels et tournées : union sans doublon
    const rs = new Set((S.rappels||[]).map(r=>r.id));
    (incoming.rappels||[]).forEach(r => { if (!rs.has(r.id)) S.rappels.push(r); });
    S.tours = [...new Set([...(S.tours||[]), ...(incoming.tours||[])])];

    migrate(); save(true); autoPurge(); closeSheet(); openId = null; render();
    toast("Fusion : " + add + " dossier(s) ajouté(s), " + upd + " complété(s), " + vis + " passage(s) récupéré(s) ✓");
  };

  $("#imp-replace").onclick = async () => {
    if (!await askDialog({ ic:"❓", titre:"Remplacer TOUTES tes données actuelles ?", sub:"(Une sauvegarde de sécurité est créée : tu pourras revenir en arrière.)" })) return;
    snapshot("Avant import (remplacement)");
    try {
      const keepHist = S.syncHistory;   // conserver les points de restauration
      S = { ...defaultState(), ...incoming, pin:S.pin, theme:S.theme, retention:S.retention };
      S.syncHistory = keepHist;
      migrate(); save(); autoPurge();
      closeSheet(); toast(incoming.patients.length + " dossier(s) importé(s) ✓");
      openId = null; render();
    } catch(e){
      console.error("import:", e);
      toast("Import échoué : " + (e.message||e), "danger");
    }
  };

  $("#imp-cancel").onclick = closeSheet;
}
function importBackup(file){
  const rd = new FileReader();
  rd.onerror = () => toast("Impossible de lire ce fichier (accès refusé par Android). Réessaie en le sélectionnant depuis Téléchargements.", "danger");
  rd.onload = ev => importBackupText(ev.target.result);
  rd.readAsText(file);
}


/* ---------- Purge automatique (limitation de conservation) ---------- */
function autoPurge(){
  // Corbeille : effacement définitif au-delà de 30 jours (docs inclus)
  const trashCut = Date.now() - 30*864e5;
  (S.trash||[]).filter(t=>t.deletedAt < trashCut).forEach(t =>
    (t.patient.docs||[]).forEach(d => idbDel("doc_"+d.id).catch(()=>{})));
  S.trash = (S.trash||[]).filter(t => t.deletedAt >= trashCut);
  const lim = new Date(); lim.setMonth(lim.getMonth() - S.retention);
  const cut = lim.toISOString().slice(0,10);
  let n = 0;
  S.patients.forEach(p => {
    p.visits = p.visits || []; p.bilans = p.bilans || [];
    const v0 = p.visits.length;
    p.visits = p.visits.filter(v => v.date >= cut);
    n += v0 - p.visits.length;
    const b0 = p.bilans.length;   // bilans clos et anciens ; les "À faire" ne sont jamais purgés
    p.bilans = p.bilans.filter(b => !((b.statut === "Fait" || b.statut === "Résultat reçu") && b.date && b.date < cut));
    n += b0 - p.bilans.length;
  });
  S.rappels = S.rappels || [];
  const r0 = S.rappels.length;    // rappels traités et anciens
  S.rappels = S.rappels.filter(r => !(r.done && r.due && r.due < cut));
  n += r0 - S.rappels.length;
  if (n){
    save();
    setTimeout(() => toast(n + " élément" + (n>1?"s":"") + " de plus de " + S.retention + " mois purgé" + (n>1?"s":"") + " automatiquement 🧹"), 700);
  }
  return n;
}


/* ===== seed.js ===== */
function seedDemo(){
  const t = todayISO(), y = new Date(Date.now()-86400000).toISOString().slice(0,10);
  const in3 = new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  S = { version:1, tours:["Cabinet Durand","Cabinet Les Oliviers"], curTour:"all",
    patients:[
      { id:"p1", nom:"Demo-Martin", prenom:"Yvonne", dob:"1941-03-12", ctx:"Diabète type 2 insulino-requérant. Chat à l'entrée !", tours:["Cabinet Durand"],
        plan:["Insuline (Lantus 18 UI)","Glycémie capillaire","Préparation pilulier"], docs:[],
        bilans:[{ id:uid(), type:"Consultation", date:in3, statut:"À faire", res:"Cardiologue Dr Lopez 14h30" }],
        visits:[
          { uid:uid(), date:y, at:"07:45", soins:["Insuline (Lantus 18 UI)","Glycémie capillaire"], consts:{ta:"14/8",glyc:"1.15",puls:"76"}, note:"" },
          { uid:uid(), date:t, at:"07:50", soins:["Insuline (Lantus 18 UI)"], consts:{glyc:"0.65"}, note:"Vertiges au lever, resucrage fait, fille prévenue." }
        ]},
      { id:"p2", nom:"Demo-Roux", prenom:"Henri", dob:"1936-11-02", ctx:"Ulcère jambe droite, pansement 1 j/2. Aidant : épouse.", tours:["Cabinet Durand"],
        plan:["Pansement complexe (ulcère JD)","Surveillance prise Trt"], docs:[],
        bilans:[{ id:uid(), type:"Prise de sang", date:in3, statut:"À faire", res:"NFS + CRP prescrite par Dr Blanc, labo à domicile" }],
        visits:[
          { uid:uid(), date:y, at:"08:20", soins:["Pansement complexe (ulcère JD)"], consts:{ta:"13/7",temp:"36.9",sat:"96",douleur:"3"}, note:"Détersion faite, bourgeonnement propre." }
        ]},
      { id:"p3", nom:"Demo-Sauveur", prenom:"Lucie", dob:"1958-06-27", ctx:"Anticoagulant post-phlébite, fin de Trt le 12/09.", tours:["Cabinet Les Oliviers"],
        plan:["Injection anticoagulant","Bas de contention"], docs:[], visits:[] }
    ],
    rappels:[
      { id:uid(), pid:"p2", type:"pharmacie", due:t,  text:"Récupérer sets de pansement + Bétadine", done:false },
      { id:uid(), pid:"p1", type:"rdv", due:in3, text:"RDV cardiologue Dr Lopez 14h30 — prévoir transport", done:false },
      { id:uid(), pid:"p3", type:"absence", due:in3, text:"Absente 3 jours (chez sa sœur) — pas de passage", done:false }
    ]};
  save();
}
/* helpers définis plus haut (getP, activeP, inTour, rapOf, bilansPending, migrate) */

/* ---------- Statut / rendu pancarte ---------- */


/* ===== ui.js ===== */
function lastVisit(p){ return [...p.visits].sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at)).pop(); }
function statusOf(p){
  const t = workDate();
  if (rapOf(p.id).some(r=>r.type==="absence" && r.due>=t)) return "absent";
  // Marqué « pas de passage prévu » aujourd'hui (valable pour la journée seulement)
  if ((S.noVisit||{})[p.id] === t && !p.visits.some(v=>v.date===t)) return "novisit";
  const todayV = p.visits.filter(v=>v.date===t);
  if (todayV.some(v=>alertes(v.consts).length)) return "alert";
  if (todayV.length) return "done";
  const lv = lastVisit(p);
  return (lv && alertes(lv.consts).length) ? "alert" : "todo";
}
function vitalsHtml(c, al){
  const parts=[]; const push=(k,lbl,unit)=>{ if(c&&c[k])parts.push(`<b class="${isBad(k,al)?"bad":""}">${lbl} ${esc(c[k])}${unit||""}</b>`); };
  push("ta","TA");push("temp","T°","°");push("sat","Sat","%");push("puls","♥");push("glyc","Gly");push("douleur","EVA");
  // Rien à afficher plutôt qu'une ligne « aucune constante connue » qui prend
  // de la place pour ne rien dire (surtout sur les grosses tournées).
  return parts.join(" · ");
}

function renderWelcomeInline(){
  const board = document.getElementById("board");
  const synth = document.getElementById("synth");
  const filters = document.getElementById("filters");
  if (synth) synth.innerHTML = "";
  if (filters) filters.innerHTML = "";
  // fermer tout overlay résiduel
  const veil = document.getElementById("veil"); if (veil) veil.classList.remove("on");
  if (!board) return;
  // Sortir le board de sa grille 2 colonnes pour l'écran de bienvenue
  board.style.display = "block";
  board.innerHTML = `
    <div class="welcome-card">
      <svg viewBox="0 0 100 100" class="cig-big" aria-hidden="true"><g stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/><ellipse cx="50" cy="30" rx="15" ry="12"/><path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/><path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/><path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/><path d="M40 52 h20 M41 64 h18 M44 74 h12" stroke-width="2.6" opacity=".85"/></g><circle cx="43" cy="29" r="2.8" fill="currentColor"/><circle cx="57" cy="29" r="2.8" fill="currentColor"/><path d="M50 53 v14 M43 60 h14" stroke="#fff" stroke-width="5.5" stroke-linecap="round" fill="none"/></svg>
      <h2 class="wc-title">Bienvenue dans JM@Santé</h2>
      <div class="wc-slogan">Tout est dans la cigale</div>
      <p class="wc-lead">Ton carnet de <b>relève infirmière</b> : tu saisis tes passages au fil de la tournée, l'app rédige la relève à envoyer au collègue ou au médecin.</p>
      <div class="wc-features">
        <div class="wc-f"><span class="wc-ic">🗺️</span><span><b>Tournées</b><br>Un cabinet = une tournée, avec son ordre de passage</span></div>
        <div class="wc-f"><span class="wc-ic">👤</span><span><b>Patients</b><br>Tape une carte pour saisir le passage du jour</span></div>
        <div class="wc-f"><span class="wc-ic">🎤</span><span><b>Dictée</b><br>Le micro flottant pour noter vite entre deux visites</span></div>
        <div class="wc-f"><span class="wc-ic">📋</span><span><b>Relève</b><br>Génère et envoie en texte, PDF, HTML ou Word</span></div>
        <div class="wc-f"><span class="wc-ic">🔄</span><span><b>Partage</b><br>Synchronise tes données avec un collègue</span></div>
        <div class="wc-f"><span class="wc-ic">🔒</span><span><b>Sécurité</b><br>Code PIN, empreinte, données chiffrées sur ton téléphone</span></div>
      </div>
      <button class="btn btn-primary" id="wl-demo-in" style="width:100%;margin-top:4px">Découvrir avec la démo</button>
      <button class="btn btn-ghost" id="wl-empty-in" style="width:100%;margin-top:8px">Commencer avec mes propres patients</button>
    </div>`;
  const finish = () => {
    const b = document.getElementById("board");
    if (b) b.style.display = "";   // rétablit la grille
    try { delete S.firstRun; save(); } catch(e){}
    render();
  };
  const demo = document.getElementById("wl-demo-in");
  const empty = document.getElementById("wl-empty-in");
  if (demo) demo.onclick = finish;
  if (empty) empty.onclick = () => {
    S.patients = []; S.rappels = []; S.tours = ["Ma tournée"]; S.curTour = "Ma tournée"; S.patientOrder = {};
    const b = document.getElementById("board");
    if (b) b.style.display = "";
    try { delete S.firstRun; save(); } catch(e){}
    render();
    toast("C'est parti — crée ton premier patient avec ＋");
  };
}

function render(){
  /* Frise sous la barre d'outils — un motif par thème.
     Redessinée seulement si le thème a changé (évite de relancer
     les animations à chaque render). */
  { const fr = document.getElementById("frise");
    if (fr && fr.dataset.th !== (S.theme||"hopital")){
      fr.dataset.th = S.theme || "hopital";
      fr.innerHTML = friseSvg(S.theme || "hopital");
    } }

  const wd = workDate();
  $("#h-date").textContent = new Date(wd + "T12:00:00")
    .toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  $("#h-date").parentElement.classList.toggle("past", !isToday());
  { const nx = $("#d-next"); if (nx) nx.disabled = isToday(); }

  /* Bandeau de saisie différée : impossible d'oublier qu'on est dans le passé */
  const dbar = document.getElementById("datebar");
  if (dbar){
    if (isToday()) dbar.innerHTML = "";
    else dbar.innerHTML = `<div class="dpast">
      <span class="dp-i">⏱</span>
      <span class="dp-t">Saisie différée — <b>${workDateLabel()}</b><br>
        <span class="dp-s">Les passages validés porteront la date du ${fmtFR(wd)}</span></span>
      <button class="dp-b" id="dp-today">↩︎ Aujourd'hui</button>
    </div>`;
    const bt = document.getElementById("dp-today");
    if (bt) bt.onclick = () => { setWorkDate(null); openId = null; render(); toast("Retour à aujourd'hui"); };
  }
  // Écran de bienvenue INLINE au premier lancement (jamais modal → jamais figé)
  if (S.firstRun){ renderWelcomeInline(); return; }
  const _b = document.getElementById("board");
  if (_b && _b.style.display === "block") _b.style.display = "";  // rétablit la grille
  // Barre des tournées
  $("#tourbar").innerHTML =
    `<div class="rowlab ac"><span>Tournée</span><i></i></div>
     <div class="rowbox ac">` +
    `<button class="fchip ${S.curTour==="all"?"on":""}" data-t="all">🗺 Toutes</button>` +
    S.tours.map(t => `<button class="fchip ${S.curTour===t?"on":""}" data-t="${esc(t)}">${esc(t)}</button>`).join("") +
    // Vider l'affichage sans changer de tournée — écran net à la demande
    `<button class="fchip ${S.curTour==="none"?"on":""}" data-t="none" style="border-style:dashed">🚫 Aucune</button>` +
    `</div>`;
  $$("#tourbar .fchip").forEach(b => b.onclick = () => { S.curTour = b.dataset.t; save(); openId=null; render(); });
  // Bandeau créneau Matin/Soir (si activé et tournée précise)
  const slotBar = document.getElementById("slotbar");
  if (slotBar){
    if (S.slotsEnabled && S.curTour !== "all"){
      const cur = activeSlot();
      slotBar.style.display = "flex";
      slotBar.innerHTML =
        `<div class="rowlab am"><span>Moment</span><i></i></div>
         <div class="rowbox am">
           <button class="fchip ${cur==="matin"?"on":""}" data-slot="matin">☀️ Matin</button>
           <button class="fchip ${cur==="soir" ?"on":""}" data-slot="soir">🌙 Soir</button>
           <button class="fchip ${cur==="jour" ?"on":""}" data-slot="jour">📅 Journée</button>
         </div>`;
      slotBar.querySelectorAll(".fchip").forEach(b => b.onclick = () => { _viewSlot = b.dataset.slot; openId=null; render(); });
    } else { slotBar.style.display = "none"; slotBar.innerHTML = ""; }
  }

  const tour = S.curTour;
  // Mode compact (grosses tournées) : masque les constantes normales
  document.body.classList.toggle("compact-board", !!S.compactBoard);
  const slot = activeSlot();
  let pool = tour === "none" ? []
           : tour === "all"
    ? activeP()
    : activeP().filter(p => inTourSlot(p, tour, slot));
  pool = sortBySlot(pool, tour, slot);
  const st = pool.map(statusOf);
  const poolIds = new Set(pool.map(p=>p.id));

  /* Le drapeau de clôture ne flotte plus en permanence : il apparaît
     pendant le déroulé, ou dès qu'un passage existe sur la journée.
     Sinon il masque les libellés des cartes pour rien. */
  { const fab = document.getElementById("fab-endtour");
    if (fab) fab.classList.toggle("on",
      (typeof seqActive !== "undefined" && seqActive) || st.some(x => x === "done" || x === "alert"));
  }
  /* Les compteurs SONT les filtres : « À voir », « Vus » et « Vigilance »
     figuraient deux fois (compteur + bouton), ce qui allongeait la barre
     jusqu'au défilement horizontal. Un tap filtre, un second remet Tous. */
  const nRap = S.rappels.filter(r=>!r.done && (!r.pid || poolIds.has(r.pid))).length;
  $("#synth").innerHTML = `
    <div class="rowlab bl"><span>Avancement</span><i></i><em>tape pour filtrer</em></div>
    <div class="rowbox bl">
      <button class="spill ${filter==="todo"?"on":""}"  data-f="todo"><div class="n">${st.filter(x=>x==="todo").length}</div><div class="l">À voir</div></button>
      <button class="spill ok ${filter==="done"?"on":""}"   data-f="done"><div class="n">${st.filter(x=>x==="done").length}</div><div class="l">Vus</div></button>
      <button class="spill warn ${filter==="alert"?"on":""}" data-f="alert"><div class="n">${st.filter(x=>x==="alert").length}</div><div class="l">Vigilance</div></button>
      <button class="spill" data-a="new-rappel"><div class="n">${nRap}</div><div class="l">Rappels</div></button>
    </div>`;
  /* À voir · Vus · Vigilance sont désormais dans les compteurs — plus de doublon ici. */
  const F = [["all","Tous"],["novisit","🚫 Sans passage"],["absent","Absents"]];
  $("#filters").innerHTML =
    `<div class="rowlab nt"><span>Affichage</span><i></i></div>
     <div class="rowbox nt">`
    + F.map(([k,l]) => `<button class="fchip ${filter===k?"on":""}" data-f="${k}">${l}</button>`).join("")
    + `<button class="fchip ${S.compactBoard?"on":""}" id="f-compact" title="${S.compactBoard?"Affichage compact":"Affichage détaillé"}">${S.compactBoard?"📑":"📋"}</button>`
    + `</div>`;
  $$("[data-f]").forEach(b => b.onclick = () => {
    filter = (filter === b.dataset.f) ? "all" : b.dataset.f;   // second tap = Tous
    openId = null; render();
  });
  const fc = document.getElementById("f-compact");
  if (fc) fc.onclick = () => {
    S.compactBoard = !S.compactBoard; save(); render();
    toast(S.compactBoard ? "Affichage compact — seules les alertes sont visibles" : "Affichage détaillé");
  };

  const list = pool.filter(p => filter==="all" || statusOf(p)===filter);
  const cardOf = p => {
    const s = statusOf(p);
    const lv = lastVisit(p);
    const c = lv ? lv.consts : null;
    const al = alertes(c, p.thresholds);
    const open = p.id === openId;
    const raps = rapOf(p.id);
    return `<div class="pcard ${s==="alert"?"warn":""} ${s==="absent"?"absent":""} ${s==="novisit"?"novisit":""} ${s==="done"&&!open?"seen":""} ${open?"open":""}" data-id="${p.id}">
      <span class="st ${s==="absent"?"todo":s}"></span>
      <button style="text-align:left" data-toggle="${p.id}">
        <div class="nm">${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())} <span class="age">${ageOf(p.dob)??"—"} ans</span></div>
        <div class="vitals">${vitalsHtml(c, al)}</div>
        <div class="badges" style="margin-top:5px">
          ${s==="absent" ? `<span class="mini amber">🚪 absent</span>` : ""}
          ${s==="novisit" ? `<span class="mini grey">🚫 pas de passage prévu</span>` : ""}
          ${(S.drafts||{})[p.id] ? `<span class="mini accent">💾 saisie en attente</span>` : ""}
          ${S.curTour==="all" && (p.tours||[]).length ? `<span class="mini">🗺 ${esc(p.tours.join(" · "))}</span>` : ""}
          ${p.docs.length ? `<span class="mini blue">📎 ${p.docs.length}</span>` : ""}
          ${bilansPending(p).length ? `<span class="mini blue">🧪 ${bilansPending(p).length}</span>` : ""}
          ${raps.length ? `<span class="mini amber">📌 ${raps.length}</span>` : ""}
          ${(() => {
            const t = (typeof annivTexte === "function") ? annivTexte(p) : "";
            return t ? `<span class="mini anniv">🎂 ${esc(t)}</span>` : "";
          })()}
          ${(() => {
            const n = (typeof alerteSelles === "function") ? alerteSelles(p) : 0;
            return n ? `<span class="mini amber" style="font-weight:700">💩 ${n} j sans selle</span>` : "";
          })()}
          ${(p.tags||[]).map(t=>{
            const T = PATIENT_TAGS[t]; if (!T) return "";
            const age = T.kind === "evt" ? tagAge(p, t) : null;
            const vieux = age !== null && age >= 3 ? ";opacity:.55" : "";
            return `<span class="mini ${t==="prioritaire"?"amber":"blue"}" style="${t==="prioritaire"?"font-weight:700":""}${vieux}">${T.ic} ${esc(T.lbl)}</span>`;
          }).join("")}
        </div>
        <div class="lastseen">${lv ? (lv.date===workDate() ? (isToday()?"vu aujourd'hui à ":"vu ce jour-là à ")+esc(lv.at) : "dernier passage : "+esc(fmtFR(lv.date))+" "+esc(lv.at)) : "jamais vu"}</div>
      </button>
      ${open ? inlineForm(p) : ""}
    </div>`;
  };

  const vide = S.curTour === "none"
    ? `<div style="grid-column:1/-1">${uiEmpty("🚫","Affichage vidé",
        "Choisis une tournée ci-dessus pour revoir tes patients.")}</div>`
    : `<p class="muted" style="grid-column:1/-1;text-align:center;padding:30px 0">${
    !S.patients.length ? "Aucun patient — crée le premier avec ＋"
    : !activeP().length ? "Tous les dossiers sont mis de côté (🦗 → Mes patients)."
    : S.curTour!=="all" && !activeP().filter(inTour).length ? "Aucun patient dans la tournée « "+esc(S.curTour)+" » — assigne-les depuis leur fiche."
    : "Rien dans ce filtre."}</p>`;

  /* Vue JOURNÉE : sections repliables par créneau, avec compteurs.
     Un patient présent matin ET soir figure dans les deux sections. */
  if (slot === "jour" && S.curTour !== "all"){
    S.slotFold = S.slotFold || {};
    const sections = ["matin","soir"].map(sl => {
      const sub = sortBySlot(list.filter(p => slotsOf(p, S.curTour).includes(sl)), S.curTour, sl);
      if (!sub.length) return "";
      const sts = sub.map(statusOf);
      const nDone = sts.filter(x => x === "done").length;
      const nTodo = sts.filter(x => x === "todo" || x === "alert").length;
      const L = SLOT_LBL[sl] || { ic:"", lbl:sl };
      const fold = !!S.slotFold[sl];
      return `<div class="slotsec ${sl}">
        <button class="slotsec-h" data-fold="${sl}">
          <span class="ss-ic">${L.ic}</span>
          <span class="ss-l">${esc(L.lbl.toUpperCase())}</span>
          <span class="ss-n">${nDone ? nDone + " vu" + (nDone>1?"s":"") : ""}${nDone&&nTodo?" · ":""}${nTodo ? nTodo + " à voir" : ""}${!nDone&&!nTodo?sub.length+" patient"+(sub.length>1?"s":""):""}</span>
          <span class="ss-c">${fold ? "▸" : "▾"}</span>
        </button>
        ${fold ? "" : `<div class="slotsec-b">${sub.map(cardOf).join("")}</div>`}
      </div>`;
    }).join("");
    $("#board").innerHTML = sections || vide;
    $("#board").classList.add("byslot");
    $$("#board [data-fold]").forEach(b => b.onclick = () => {
      S.slotFold[b.dataset.fold] = !S.slotFold[b.dataset.fold];
      save(); render();
    });
  } else {
    $("#board").classList.remove("byslot");
    $("#board").innerHTML = list.map(cardOf).join("") || vide;
  }

  { const pv = $("#d-prev"); if (pv) pv.onclick = () => { shiftWorkDate(-1); openId=null; render(); };
    const nx = $("#d-next"); if (nx) nx.onclick = () => { if (!isToday()){ shiftWorkDate(1); openId=null; render(); } }; }

  $$("[data-toggle]").forEach(b => b.onclick = () => {
    openId = openId === b.dataset.toggle ? null : b.dataset.toggle;
    render();
    if (openId){ const el=document.querySelector(`.pcard[data-id="${openId}"]`); el&&el.scrollIntoView&&el.scrollIntoView({behavior:"smooth",block:"start"}); }
  });
  if (openId){
    const p = getP(openId);
    // La carte ouverte de la liste, jamais le formulaire du déroulé
    const carte = document.querySelector(".pcard.open");
    if (p) bindInline(p, carte);
  }
}

/* ---------- Saisie inline + outils patient ---------- */
function inlineForm(p){
  const raps = rapOf(p.id);
  const _lc = (lastVisit(p)||{}).consts || {};
  const _ta = String(_lc.ta||"").split("/");
  const gh = (v,def) => v ? String(v) : def;
  return `<div class="inline" data-form="${p.id}">
    <div class="toolrow" style="flex-wrap:wrap">
      <button class="tool" data-docs="${p.id}" style="flex:1 1 30%">📎 Docs${p.docs.length?" ("+p.docs.length+")":""}</button>
      <button class="tool" data-bilans="${p.id}" style="flex:1 1 30%">🧪 Bilans${bilansPending(p).length?" ("+bilansPending(p).length+")":""}</button>
      <button class="tool" data-raps="${p.id}" style="flex:1 1 30%">📌 Rappels${raps.length?" ("+raps.length+")":""}</button>
      <button class="tool" data-clone="${p.id}" style="flex:1 1 30%">🔁 J-1</button>
      <button class="tool" data-hist="${p.id}" style="flex:1 1 30%">🕐 Historique</button>
      <button class="tool" data-graph="${p.id}" style="flex:1 1 30%">📈 Courbes</button>
      ${adresseComplete(p) ? `<button class="tool" data-gps="${p.id}" style="flex:1 1 30%" title="${esc(adresseComplete(p))}">🗺️ GPS</button>` : ""}
      ${Object.keys(p.contacts||{}).length ? `<button class="tool" data-annuaire="${p.id}" style="flex:1 1 30%">📞 Appels</button>` : ""}
      <button class="tool" data-edit="${p.id}" style="flex:1 1 30%">✏️ Fiche</button>
    </div>
    ${shownInfos(p).map(it => { const T=infoType(it.type);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:7px 11px;margin-bottom:5px">${T.ic} ${esc(it.txt)}</div>`;
    }).join("")}
    <div class="rowlab am"><span>Ce passage</span><i></i></div>
    <div class="rowbox am" style="display:block;margin-bottom:12px">
    ${S.slotsEnabled ? `<div class="chips" data-slotrow style="margin:0 0 6px">
      <button class="chip ${(_curSlot||defaultSlot())==="matin"?"on":""}" data-slot="matin" style="flex:1;justify-content:center">☀️ Matin</button>
      <button class="chip ${(_curSlot||defaultSlot())==="soir"?"on":""}" data-slot="soir" style="flex:1;justify-content:center">🌙 Soir</button>
    </div>
    <p class="small muted" data-slothint style="margin:0 0 8px">Ce que tu coches est attribué au passage sélectionné.</p>` : ""}
    <div class="chips" data-tagrow style="margin-top:2px">
      ${Object.entries(PATIENT_TAGS).map(([k,t])=>{
        const on  = (p.tags||[]).includes(k);
        const m   = (p.tagMeta||{})[k] || {};
        const age = on && t.kind === "evt" ? tagAge(p, k) : null;
        // Une pastille événementielle s'atténue avec l'âge : rien ne se perd,
        // mais l'œil distingue ce qui est frais de ce qui traîne.
        const vieux = age !== null && age >= 3 ? " old" : "";
        return `<button class="chip ${on?"on":""}${vieux}" data-tag="${k}" style="font-size:12px">${t.ic} ${esc(t.lbl)}${
          age !== null ? ` <span class="tg-age">${esc(tagAgeLbl(age))}</span>` : ""}${
          on && m.note ? ' <span class="tg-note">💬</span>' : ""}</button>`;
      }).join("")}
      ${(p.tags||[]).filter(k => ((p.tagMeta||{})[k]||{}).note).map(k => {
        const t = PATIENT_TAGS[k], m = p.tagMeta[k];
        return `<div class="tgcom" style="--tc:${k==="prioritaire"?"var(--danger)":k==="medecin"?"var(--accent)":"var(--amber)"}">
          <div class="tgc-h">${t.ic} ${esc(t.lbl)}</div>
          <div class="tgc-t">${esc(m.note)}</div>
        </div>`;
      }).join("")}
    </div>
    </div>

    <div class="rowlab ac"><span>Soins réalisés</span><i></i><em>★ = plan de soins</em></div>
    <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="small muted" style="margin-bottom:7px">💡 Appui long sur un soin (ou tape ✏️) pour un commentaire du jour</div>
      <div class="chips" data-chips="1">
        ${planFor(p, S.slotsEnabled ? (_curSlot || activeSlot() || defaultSlot()) : null).map(x=>{
          const r = (p.planRythme||{})[x];
          // L'étoile porte le créneau : ambre matin, bleu soir, neutre les deux
          const sl = (p.planSlots||{})[x] || {};
          const cls = (sl.matin && !sl.soir) ? " s-am" : (sl.soir && !sl.matin) ? " s-bl" : "";
          return `<button class="chip star${cls}" data-s="${esc(x)}">${esc(x)}${r?` <span class="rythme">${esc(r)}</span>`:""}${getSoinProtocol(x)?" 📋":""}</button>`;
        }).join("")}
        <button class="chip add" data-addsoin="1">＋ autre…</button>
      ${S.slotsEnabled && Object.keys(p.planSlots||{}).length ? `<div class="slotleg">
        <span class="l-am"><b>★</b> matin</span>
        <span class="l-bl"><b>★</b> soir</span>
        <span><b>★</b> les deux</span></div>` : ""}
      </div>
      <div style="margin-top:4px"><input class="plan-search" id="soin-srch-${p.id}" placeholder="🔍 Chercher un soin…" style="font-size:13px"></div>
      <div id="soin-srch-res-${p.id}" class="chips" style="min-height:0;margin-top:4px"></div>
    </div>
    <div>
    </div>

    <div class="rowlab bl"><span>Constantes</span><i></i><em>si mesurées</em></div>
    <div class="rowbox bl" style="display:block;margin-bottom:12px">
      <div class="cgrid">
        <div><label>TA</label>
          <div style="display:flex;align-items:center;gap:4px">
            <input data-ta-s inputmode="numeric" placeholder="${esc(gh(_ta[0],"13"))}" style="width:40px;text-align:center" maxlength="3">
            <span style="font-size:18px;color:var(--dim)">/</span>
            <input data-ta-d inputmode="numeric" placeholder="${esc(gh(_ta[1],"8"))}" style="width:36px;text-align:center" maxlength="2">
          </div>
          <input data-c="ta" type="hidden">
        </div>
        <div><label>T° °C</label><input data-c="temp" inputmode="decimal" placeholder="${esc(gh(_lc.temp,"36.8"))}"></div>
        <div><label>Sat %</label><input data-c="sat" inputmode="numeric" placeholder="${esc(gh(_lc.sat,"97"))}"></div>
        <div><label>Pouls</label><input data-c="puls" inputmode="numeric" placeholder="${esc(gh(_lc.puls,"72"))}"></div>
        <div><label>Gly g/L</label><input data-c="glyc" inputmode="decimal" placeholder="${esc(gh(_lc.glyc,"1.10"))}"></div>
        <div><label>EVA /10</label><input data-c="douleur" inputmode="numeric" placeholder="${esc(gh(_lc.douleur,"0"))}"></div>
      </div>
      <div class="selrow">
        <label>Selles</label>
        <div class="selbtns">
          ${SELLES_VAL.map(v => `<button type="button" class="selb${
            v.k==="diarrhee" ? " dia" : ""}" data-sel="${v.k}">${v.lbl}</button>`).join("")}
        </div>
      </div>
      <p class="alertline" data-al="1" style="margin-top:8px"></p>
      <div class="chips" style="margin-top:4px">
        <button class="chip" data-constrel style="font-size:12px">📤 Inclure dans la relève</button>
      </div>
      <p class="small muted" style="margin-top:3px">Les constantes sont toujours enregistrées dans l'historique du patient. Coche pour qu'elles figurent aussi dans la relève.</p>
    </div>
    <div>
    </div>

    ${(() => {
      /* Le suivi de plaie vit ICI, entre constantes et transmission :
         pas dans ⚡ Actions. Minimaliste quand il n'y a rien — une
         seule ligne — pour ne pas allonger toutes les cartes. */
      const pls = (typeof plaiesOuvertes === "function") ? plaiesOuvertes(p) : [];
      if (!pls.length) return `
        <button class="plnone" data-plnew="${p.id}">🩹 Déclarer une plaie</button>`;
      return `
      <div class="rowlab am"><span>🩹 Plaies</span><i></i>
        <em>${pls.length} en cours</em></div>
      <div class="rowbox am" style="display:block;margin-bottom:12px">
        ${pls.map(pl => {
          const j = plaieJours(pl);
          const ph = plaiePhotos(p, pl);
          const der = ph.slice(-1)[0];
          return `<div class="plrow" data-plopen="${pl.id}">
            <span style="flex:1;min-width:0">
              <div class="plrow-t">${esc(plaieNom(pl))}${j!==null?" — "+j+" j":""}</div>
              <div class="plrow-s">${pl.stade?"stade "+pl.stade+" · ":""}${
                der ? "photo le "+fmtFR(der.date) : "aucune photo"}</div>
            </span>
            <button class="plrow-cam" data-plphoto="${pl.id}">📷</button>
          </div>`;
        }).join("")}
        <button class="plnone" data-plnew="${p.id}" style="margin-top:6px">＋ Autre plaie</button>
      </div>`;
    })()}

    <div class="rowlab vi"><span>Transmission</span><i></i><em>événements rapides</em></div>
    <div class="rowbox vi" style="display:block;margin-bottom:12px">
      <div class="chips" id="evt-tags-${p.id}" style="margin-bottom:6px">
        ${[["🤕","Chute"],["🚫","Refus de soin"],["🚪","Absence"],["⚠️","Matériel manquant"],["💊","Erreur pharmacie"],["🏠","Domicile fermé"]].map(([ic,lbl])=>
          `<button class="chip" data-evt="${esc(lbl)}" style="font-size:12px">${ic} ${lbl}</button>`).join("")}
      </div>
      <div class="chips" style="margin-bottom:6px">
        <button class="chip" data-phrasepick style="font-size:12px">💬 Phrases types…</button>
        <button class="chip" data-dard-toggle style="font-size:12px">📋 Mode DARD</button>
      </div>
      <div data-dardbox style="display:none;flex-direction:column;gap:6px;margin-bottom:6px">
        <input data-dard="D" placeholder="Données — constantes, faits observés">
        <input data-dard="A" placeholder="Actions — soins réalisés, appels">
        <input data-dard="R" placeholder="Résultats — tolérance, évolution">
        <input data-dard="V" placeholder="Devenir — à prévoir pour le collègue">
      </div>
      <div class="micwrap">
        <textarea data-note="1" placeholder="Événements, consignes… (la dictée ajoute au texte)"></textarea>
        <button class="mic" data-mic="1">🎤</button>
      </div>
    </div>
    <div class="formbtns">
      <button class="btn btn-ghost" data-cancel="1">Annuler</button>
      <button class="btn btn-ghost" data-keep="1">💾 Enregistrer</button>
      <button class="btn btn-primary fb-wide" data-save="1">${_formDraft && _formDraft.pid===p.id && _formDraft._editUid ? "✓ Enregistrer les modifications" : "✓ Valider le passage"}</button>
    </div>
    <p class="small muted" style="margin-top:6px;text-align:center">💾 conserve ta saisie sans valider le passage</p>
  </div>`;
}

let _soinNotes = {}; // commentaires par soin pour le passage en cours
let _curSlot = null;  // créneau courant du formulaire ("matin"/"soir") si activé
function _saveDraft(f, pid){
  if (!f) return;
  const soins = [...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s);
  const consts = {};
  { const sb = f.querySelector(".selb.on"); if (sb) consts.selles = sb.dataset.sel; }
  f.querySelectorAll("[data-c]").forEach(i=>{ if(i.value.trim()) consts[i.dataset.c]=i.value.trim(); });
  const taS = f.querySelector("[data-ta-s]")?.value||"";
  const taD = f.querySelector("[data-ta-d]")?.value||"";
  const note = f.querySelector("[data-note]")?.value||"";
  const constRel = !!f.querySelector("[data-constrel].on");
  const dardOn = !!f._dardOn;
  _formDraft = { pid, soins, consts, taS, taD, note, soinNotes:{..._soinNotes}, constRel, dardOn };
}
function _restoreDraft(f, pid){
  // Reprendre une saisie enregistrée avec 💾 (elle survit à la fermeture de l'app)
  if ((!_formDraft || _formDraft.pid !== pid) && (S.drafts||{})[pid]){
    _formDraft = { ...S.drafts[pid], pid };
  }
  /* Patient déjà vu aujourd'hui : recharger son passage pour le compléter.
     Cas courant — la patiente demande un soin de plus après la validation. */
  if (!_formDraft || _formDraft.pid !== pid){
    const pp = getP(pid);
    const sl = S.slotsEnabled ? (_curSlot || activeSlot() || defaultSlot()) : null;
    const v = pp && (pp.visits||[]).find(x => x.date === workDate() &&
              (!S.slotsEnabled || sl === "jour" || (x.slot||defaultSlot()) === sl));
    if (v){
      _formDraft = { pid, soins:[...(v.soins||[])], consts:{...(v.consts||{})},
                     taS:"", taD:"", note:v.note||"",
                     soinNotes:{...(v.soinNotes||{})}, constRel:!!v.constRel, dardOn:!!v.dar,
                     _editUid:v.uid };
      if (v.consts && v.consts.ta){
        const t = String(v.consts.ta).split("/");
        _formDraft.taS = t[0]||""; _formDraft.taD = t[1]||"";
      }
    }
  }
  if (!_formDraft || _formDraft.pid !== pid){ _soinNotes = {}; return; }
  const d = _formDraft;
  _soinNotes = { ...(d.soinNotes||{}) };
  // Restaurer les soins
  d.soins.forEach(sn => {
    let c = f.querySelector(`.chip[data-s="${CSS.escape(sn)}"]`);
    if (!c){
      c = document.createElement("button");
      c.className="chip on"; c.dataset.s=sn; c.textContent=sn;
      const addBtn = f.querySelector("[data-addsoin]");
      if (addBtn) f.querySelector("[data-chips]").insertBefore(c, addBtn);
      armerChipSoin(c, getP(pid), f, decorateChip, openSoinComment);   // crayon, appui long, commentaire
    } else { c.classList.add("on"); decorateChip(c); }
  });
  // Restaurer TA
  const taS=f.querySelector("[data-ta-s]"), taD=f.querySelector("[data-ta-d]");
  if (taS&&d.taS) taS.value=d.taS;
  if (taD&&d.taD) taD.value=d.taD;
  const taHid=f.querySelector("[data-c='ta']");
  if (taHid&&d.taS&&d.taD) taHid.value=d.taS+"/"+d.taD;
  // Restaurer les selles
  { const v = (d.consts||{}).selles;
    if (v !== undefined && v !== ""){
      const b = f.querySelector(`.selb[data-sel="${CSS.escape(String(v))}"]`);
      if (b) b.classList.add("on");
    } }
  // Restaurer autres constantes
  f.querySelectorAll("[data-c]").forEach(i=>{
    if(i.dataset.c!=="ta" && d.consts[i.dataset.c]) i.value=d.consts[i.dataset.c];
  });
  // Restaurer la note
  const noteEl=f.querySelector("[data-note]");
  if(noteEl&&d.note) noteEl.value=d.note;
}

function bindInline(p, racine){
  /* ⚠️ Chercher dans TOUT le document est risqué : si un formulaire du
     même patient subsiste ailleurs (déroulé masqué, rendu partiel),
     c'est lui qui est câblé et les boutons visibles restent muets.
     On cherche d'abord dans la racine demandée, puis on retient le
     formulaire réellement AFFICHÉ. */
  let f = null;
  if (racine) f = racine.querySelector(`[data-form="${p.id}"]`);
  if (!f){
    const tous = [...document.querySelectorAll(`[data-form="${p.id}"]`)];
    f = tous.find(x => x.offsetParent !== null) || tous[0] || null;
    if (tous.length > 1){
      logIncident("carte", tous.length + " formulaires pour le même patient",
        new Error("bindInline a retenu le " + (tous.indexOf(f)+1) + "e"));
    }
  }
  if (!f) return;
  // Restaurer le brouillon si on revient sur ce patient après un sous-écran
  _restoreDraft(f, p.id);
  const decorateChip = c => {
    const sn = c.dataset.s;
    const on = c.classList.contains("on");
    // Le rythme du plan de soins doit survivre à la redécoration :
    // cette fonction réécrit tout le contenu du chip.
    const r = (p.planRythme||{})[sn];
    const base = esc(sn) + (r ? ` <span class="rythme">${esc(r)}</span>` : "")
               + (getSoinProtocol(sn) ? " 📋" : "");
    // ✏️ visible sur les soins cochés (invite à commenter) · 💬 si un commentaire existe
    c.innerHTML = base + (_soinNotes[sn] ? ' <span style="opacity:.9">💬</span>' : (on ? ' <span style="opacity:.55">✏️</span>' : ""));
  };
  const openSoinComment = (chip) => {
    const sn = chip.dataset.s;
    if (!chip.classList.contains("on")){ chip.classList.add("on"); decorateChip(chip); _saveDraft(f,p.id); }
    // Retirer un éventuel éditeur déjà ouvert
    f.querySelector("[data-scwrap]")?.remove();
    const wrap = document.createElement("div");
    wrap.setAttribute("data-scwrap","1");
    wrap.style.cssText = "display:flex;gap:6px;align-items:center;margin:6px 0;padding:8px;border:1px dashed var(--border-strong);border-radius:10px";
    wrap.style.flexWrap = "wrap";
    wrap.innerHTML = `<span class="small" style="flex-basis:100%;margin-bottom:2px">💬 Commentaire — ${esc(sn)}</span>
      <input data-scin placeholder="Ton commentaire du jour…" style="flex:1;min-width:0;font-size:13px" value="${esc(_soinNotes[sn]||"")}">
      <button class="chip" data-scphrase title="Insérer une phrase type">💬</button>
      <button class="chip" data-scok>✓</button>`;
    chip.closest("[data-chips]").after(wrap);
    const inp = wrap.querySelector("[data-scin]");
    inp.focus();
    const persist = () => {
      const v = inp.value.trim();
      if (v) _soinNotes[sn] = v; else delete _soinNotes[sn];
      decorateChip(chip);
      _saveDraft(f, p.id);
    };
    const done = () => { persist(); wrap.remove(); };
    wrap.querySelector("[data-scok]").onclick = done;
    // Bouton 💬 : ouvrir le catalogue de phrases, insérer dans CE champ de commentaire
    wrap.querySelector("[data-scphrase]").onclick = () => {
      persist(); // garder ce qui est déjà tapé
      sheetPhrasePicker(p.id, (ph) => {
        _soinNotes[sn] = ((_soinNotes[sn]||"").trim() ? _soinNotes[sn].replace(/\s+$/,"")+" " : "") + ph;
        decorateChip(chip); _saveDraft(f, p.id);
        openSoinComment(chip); // rouvrir l'éditeur avec la phrase insérée
      });
    };
    inp.addEventListener("keydown", e => { if (e.key==="Enter") done(); });
  };
  const planHint = f.querySelector("[data-planhint]");
  /* ⚠️ Tout soin créé en cours de saisie DOIT passer par armerChipSoin.
     Un simple onclick=toggle donne un soin cochable mais sans crayon,
     sans appui long, sans commentaire possible — c'était le cas des
     soins repris par J-1. */
  /* ⚠️ Isolé volontairement : si armerChipSoin échoue sur UN soin, le
     câblage des outils qui suit (Docs, Bilans, J-1, Fiche…) ne doit pas
     s'interrompre — sinon TOUS les boutons de la carte deviennent muets. */
  f.querySelectorAll(".chip[data-s]").forEach(c => {
    try { armerChipSoin(c, p, f, decorateChip, openSoinComment); }
    catch(e){ logIncident("carte", "Soin non armé : " + (c.dataset.s||"?"), e); }
  });
  /* Trace de diagnostic : si des boutons restent muets, l'incident
     dira lesquels. Consultable dans 🩺 Santé de l'application. */
  setTimeout(() => {
    try {
      const bs = [...f.querySelectorAll("button")];
      const muets = bs.filter(b => !b.onclick && !b.dataset.toggle);
      if (muets.length > 2){
        logIncident("carte", muets.length + "/" + bs.length + " boutons sans action",
          new Error(muets.slice(0,5).map(b => (b.textContent||"").trim().slice(0,14)).join(" · ")));
      }
    } catch(e){}
  }, 300);
  /* Recherche soins pendant le passage */
  const srchIn = document.getElementById("soin-srch-"+p.id);
  const srchRes = document.getElementById("soin-srch-res-"+p.id);
  if (srchIn && srchRes){
    srchIn.oninput = () => {
      const q = srchIn.value.trim().toLowerCase();
      if (!q){ srchRes.innerHTML=""; return; }
      const sel = new Set([...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s));
      const hits = getCatalog().filter(n=>n.toLowerCase().includes(q) && !sel.has(n)).slice(0,12);
      srchRes.innerHTML = hits.map(n=>`<button class="chip" data-srch="${esc(n)}">${esc(n)}${getSoinProtocol(n)?" 📋":""}</button>`).join("");
      srchRes.querySelectorAll("[data-srch]").forEach(b=>b.onclick=()=>{
        const name=b.dataset.srch, btn=document.createElement("button");
        btn.className="chip on"; btn.dataset.s=name; btn.textContent=name;
        f.querySelector("[data-chips]").insertBefore(btn, f.querySelector("[data-addsoin]"));
        armerChipSoin(btn, p, f, decorateChip, openSoinComment);
        /* Si le soin a un protocole, le pré-remplir dans les notes */
        const proto = getSoinProtocol(name);
        if (proto){
          const noteEl = f.querySelector("[data-note]");
          if (noteEl && !noteEl.value.includes(proto)) noteEl.value += (noteEl.value?"\n":"")+proto;
        }
        srchIn.value=""; srchRes.innerHTML="";
      });
    };
  }

  qEl(f, "data-addsoin").onclick = () => {
    const addBtn = f.querySelector("[data-addsoin]");
    if (f.querySelector("[data-addsoin-input]")) return; // déjà ouvert
    const wrap = document.createElement("span");
    wrap.style.cssText = "display:inline-flex;gap:4px;align-items:center";
    wrap.innerHTML = `<input data-addsoin-input placeholder="Nom du soin…" style="width:150px;font-size:13px;padding:6px 8px">
      <button class="chip" data-addsoin-ok style="font-size:13px">✓</button>`;
    addBtn.parentNode.insertBefore(wrap, addBtn);
    const inp = wrap.querySelector("[data-addsoin-input]");
    inp.focus();
    const validate = () => {
      const name = inp.value.trim();
      wrap.remove();
      if (!name) return;
      const btn = document.createElement("button");
      btn.className = "chip on"; btn.dataset.s = name; btn.textContent = name;
      f.querySelector("[data-chips]").insertBefore(btn, addBtn);
      armerChipSoin(btn, p, f, decorateChip, openSoinComment);
      // Offrir d'ajouter au catalogue global si inconnu
      if (!getCatalog().includes(name)){
        setTimeout(()=>{
          if (confirm('"'+name+'" : ajouter au catalogue des soins pour d\'autres patients ?')){
            if (!customEntries().some(e=>e.nom===name)){
              S.catalog.custom.push({ nom:name, cat:"" });
              save(); toast('"'+name+'" ajouté au catalogue ✓ (catégorie modifiable dans Réglages → Catalogue)');
            }
          }
        }, 80);
      }
    };
    wrap.querySelector("[data-addsoin-ok]").onclick = validate;
    inp.addEventListener("keydown", e => { if (e.key==="Enter") validate(); });
  };
  // Synchronisation pavé TA : sys/dia → champ caché data-c="ta"
  const taS = f.querySelector("[data-ta-s]"), taD = f.querySelector("[data-ta-d]");
  const taHid = f.querySelector("[data-c=\'ta\']");
  const syncTA = () => { if(taS&&taD&&taHid) taHid.value=(taS.value&&taD.value)?taS.value+"/"+taD.value:""; if(check) check(); else _saveDraft(f, p.id); };
  if(taS){ taS.oninput=syncTA; taD.oninput=syncTA; }
  const inputs = [...f.querySelectorAll("[data-c]")];
  // Sauvegarder le brouillon à chaque changement
  const check = () => {
    const c = {}; inputs.forEach(i => c[i.dataset.c] = i.value.trim());
    const al = alertes(c, p.thresholds);
    inputs.forEach(i => i.classList.toggle("warnf", isBad(i.dataset.c, al)));
    const line = f.querySelector("[data-al]");
    if (al.length){ line.style.display="block"; line.textContent="⚠ "+al.join(" · "); } else line.style.display="none";
    _saveDraft(f, p.id); // sauvegarde brouillon à chaque changement de constante
  };
  inputs.forEach(i => i.oninput = check);
  f.querySelectorAll("[data-evt]").forEach(b => b.onclick = () => {
    const noteEl = f.querySelector("[data-note]");
    const tag = "["+b.dataset.evt+"]";
    noteEl.value = (noteEl.value ? noteEl.value+"\n" : "") + tag+" ";
    b.classList.toggle("on");
    toast(b.dataset.evt+" noté ✓");
  });
  const noteTA = f.querySelector("[data-note]");
  if(noteTA) noteTA.addEventListener("input", () => _saveDraft(f, p.id));
  qEl(f, "data-mic").onclick = e => { e.preventDefault(); dictate(f.querySelector("[data-note]"), f.querySelector("[data-mic]")); };
  // ── Tags de priorité ──
  /* Selles : un seul choix actif. Retaper le même bouton l'efface —
     « 0 » reste une valeur, l'absence de bouton actif signifie non renseigné. */
  f.querySelectorAll(".selb").forEach(b => b.onclick = () => {
    const dejaActif = b.classList.contains("on");
    f.querySelectorAll(".selb").forEach(x => x.classList.remove("on"));
    if (!dejaActif) b.classList.add("on");
    _saveDraft(f, p.id);
  });

  f.querySelectorAll("[data-tag]").forEach(b => {
    const k = b.dataset.tag;
    const T = PATIENT_TAGS[k] || {};
    /* Appui long : commenter la pastille — même geste que pour un soin.
       « Matériel à apporter » ne disait pas QUEL matériel ; le commentaire
       part maintenant dans la relève avec la pastille. */
    let _lt = null;
    const ask = async () => {
      if (!(p.tags||[]).includes(k)) return;   // rien à commenter si éteinte
      p.tagMeta = p.tagMeta || {};
      const m = p.tagMeta[k] || {};
      const v = await askText(T.lbl, {
        ic: T.ic, sub:"Précision (facultatif)", val:m.note || "",
        ph: k === "medecin" ? "Dr Blanc prévenu de la TA" : "ce qu'il faut savoir",
        aide: k === "medecin" ? "Ex. : rappelle demain, ordonnance à récupérer…" : "",
        oui:"✓ Noter" });
      if (v === false || v === null) return;
      const t = v.trim();
      if (t) p.tagMeta[k] = { ...m, note:t }; else if (m.note) delete p.tagMeta[k].note;
      save(); render();
    };
    b.addEventListener("touchstart", () => { _lt = setTimeout(ask, 550); }, { passive:true });
    ["touchend","touchmove","touchcancel"].forEach(ev =>
      b.addEventListener(ev, () => clearTimeout(_lt), { passive:true }));
    b.addEventListener("contextmenu", e => { e.preventDefault(); ask(); });

    b.onclick = () => {
    p.tags = p.tags || [];
    const i = p.tags.indexOf(k);
    if (i >= 0) p.tags.splice(i,1); else p.tags.push(k);
    // Une pastille événementielle retient SA date d'activation
    if (i < 0 && T.kind === "evt"){
      p.tagMeta = p.tagMeta || {};
      p.tagMeta[k] = { ...(p.tagMeta[k]||{}), at: workDate() };
    }
    if (i >= 0 && p.tagMeta) delete p.tagMeta[k];   // éteinte = on oublie tout
    b.classList.toggle("on", i < 0);
    save(); render();
    };
  });
  // ── Phrases types : ouvrir le catalogue ──
  const phBtn = f.querySelector("[data-phrasepick]");
  if (phBtn) phBtn.onclick = () => sheetPhrasePicker(p.id);
  // ── Mode DARD : composer la note depuis les 4 champs ──
  const dardBox = f.querySelector("[data-dardbox]");
  const dardToggle = f.querySelector("[data-dard-toggle]");
  const noteField = f.querySelector("[data-note]");
  const composeDard = () => {
    const g = k => (f.querySelector(`[data-dard="${k}"]`)?.value||"").trim();
    const parts = [];
    if (g("D")) parts.push("D : " + g("D"));
    if (g("A")) parts.push("A : " + g("A"));
    if (g("R")) parts.push("R : " + g("R"));
    if (g("V")) parts.push("Devenir : " + g("V"));
    noteField.value = parts.join("\n");
    noteField.dispatchEvent(new Event("input", { bubbles:true }));
  };
  if (dardToggle) dardToggle.onclick = () => {
    const on = dardBox.style.display === "none";
    f._dardOn = on;   // ce passage sera marqué DAR dans la relève
    dardBox.style.display = on ? "flex" : "none";
    dardToggle.classList.toggle("on", on);
    noteField.readOnly = on;
    noteField.placeholder = on ? "Composée automatiquement depuis les champs DARD ↑" : "Événements, consignes… (la dictée ajoute au texte)";
    if (on) composeDard();
    else noteField.readOnly = false;
  };
  f.querySelectorAll("[data-dard]").forEach(inp => inp.addEventListener("input", composeDard));
  qEl(f, "data-cancel").onclick = async () => {
    // Ne pas jeter silencieusement une saisie en cours
    const soinsOn = f.querySelectorAll(".chip[data-s].on").length;
    const noteTxt = (f.querySelector("[data-note]")?.value||"").trim();
    const cstTxt  = [...f.querySelectorAll("[data-c]")].some(i => (i.value||"").trim());
    if ((soinsOn || noteTxt || cstTxt) &&
        !await askDialog({ ton:"danger", ic:"↩️", titre:"Abandonner cette saisie ?", warn:"Les soins cochés, les constantes et la transmission seront perdus.", oui:"Abandonner" })) return;
    _formDraft=null; _soinNotes={}; _curSlot=null; openId=null;
    /* ⚠️ Dans le déroulé, le formulaire n'est PAS une carte : render()
       redessine la liste, qui est masquée — l'écran séquentiel restait
       affiché avec son texte. Il faut le redessiner lui. */
    if (typeof seqActive !== "undefined" && seqActive && typeof renderSeq === "function") renderSeq();
    else render();
  };

  /* 💾 Enregistrer sans valider — la saisie est conservée durablement
     (elle survit à la fermeture de l'app) mais le patient reste « à voir ». */
  const keepBtn = f.querySelector("[data-keep]");
  if (keepBtn) keepBtn.onclick = () => {
    _saveDraft(f, p.id);
    if (!_formDraft){ toast("Rien à enregistrer"); return; }
    S.drafts = S.drafts || {};
    S.drafts[p.id] = { ..._formDraft, at: Date.now() };
    save();
    _curSlot = null; openId = null; render();
    toast("Saisie enregistrée 💾 — le passage n'est pas encore validé");
  };
  // ① Case « inclure les constantes dans la relève »
  const constRelBtn = f.querySelector("[data-constrel]");
  if (constRelBtn){
    if (_formDraft && _formDraft.pid === p.id && _formDraft.constRel) constRelBtn.classList.add("on");
    constRelBtn.onclick = () => { constRelBtn.classList.toggle("on"); _saveDraft(f, p.id); };
  }

  // Créneau matin/soir
  if (S.slotsEnabled){
    if (!_curSlot) _curSlot = defaultSlot();
    f.querySelectorAll("[data-slot]").forEach(b => b.onclick = () => {
      _curSlot = b.dataset.slot;
      f.querySelectorAll("[data-slot]").forEach(x => x.classList.toggle("on", x===b));
      const hint = f.querySelector("[data-slothint]");
      if (hint) hint.textContent = "Passage du " + SLOT_LBL[_curSlot].lbl.toLowerCase() + " — ce que tu coches lui est attribué.";
    });
  }
  // Validation d'un passage — renvoie true si un passage a été enregistré
  const commitVisit = async (silent) => {
    const soins = [...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s);
    const consts = {}; inputs.forEach(i => { if(i.value.trim()) consts[i.dataset.c]=i.value.trim(); });
    const note = f.querySelector("[data-note]").value.trim();
    if (!soins.length && !Object.keys(consts).length && !note){ if(!silent) toast("Rien à enregistrer."); return false; }
    const sNotes = {};
    soins.forEach(sn => { if (_soinNotes[sn]) sNotes[sn] = _soinNotes[sn]; });
    const constRel = !!f.querySelector("[data-constrel].on");
    const dardOn = !!f._dardOn;
    /* Doublon : un passage existe déjà aujourd'hui sur le même créneau.
       Sans ce contrôle, valider depuis la carte puis depuis le déroulé
       créait deux passages le même jour. */
    const _slot = S.slotsEnabled ? (_curSlot || defaultSlot()) : null;
    /* Passage rechargé pour modification : on le met à jour directement,
       sans redemander confirmation — l'intention est explicite. */
    const editUid = _formDraft && _formDraft.pid === p.id ? _formDraft._editUid : null;
    if (editUid){
      const ev = (p.visits||[]).find(v => v.uid === editUid);
      if (ev){
        ev.soins = soins; ev.consts = consts; ev.note = note;
        ev.soinNotes = sNotes; ev.constRel = constRel; ev.dar = dardOn;
        if (typeof logChange==="function") logChange("update","visit", p.id+"|"+ev.uid, ev);
        _soinNotes = {}; _formDraft = null;
        if (S.drafts && S.drafts[p.id]) delete S.drafts[p.id];
        if (!silent) toast("Passage modifié ✓");
        return true;
      }
    }

    const dbl = (p.visits||[]).find(v => v.date === workDate() &&
                (!S.slotsEnabled || (v.slot||defaultSlot()) === _slot));
    if (dbl && !silent){
      const sl = _slot && SLOT_LBL[_slot] ? " " + SLOT_LBL[_slot].ic + " " + SLOT_LBL[_slot].lbl.toLowerCase() : "";
      /* Avant : « OK = compléter / Annuler = garder séparé » — deux actions
         déguisées en oui/non. Chacune porte maintenant son nom. */
      const rep = "fusion" === await askChoice({
        ic:"🔁", titre:"Passage déjà enregistré",
        sub:`${esc(p.prenom)} a déjà un passage aujourd'hui (${esc(sl.trim())} ${esc(dbl.at||"")}).`,
        options:[ { ic:"🔗", lbl:"Compléter ce passage", val:"fusion" },
                  { ic:"➕", lbl:"Garder les deux séparés", val:"separe" } ] });
      if (rep){
        // Fusion dans le passage existant
        dbl.soins = [...new Set([...(dbl.soins||[]), ...soins])];
        dbl.consts = { ...(dbl.consts||{}), ...consts };
        if (note) dbl.note = dbl.note ? (dbl.note + "\n" + note) : note;
        if (Object.keys(sNotes).length) dbl.soinNotes = { ...(dbl.soinNotes||{}), ...sNotes };
        if (constRel) dbl.constRel = true;
        if (dardOn) dbl.dar = true;
        dbl.at = nowHM();
        if (typeof logChange==="function") logChange("update","visit", p.id+"|"+dbl.uid, dbl);
        _soinNotes = {}; _formDraft = null;
        if (S.drafts && S.drafts[p.id]) delete S.drafts[p.id];
        return true;
      }
    }

    const _v = { uid:uid(), date:workDate(), at:nowHM(), soins, consts, note,
      ...(S.slotsEnabled ? { slot:(_curSlot||defaultSlot()) } : {}),
      ...(Object.keys(sNotes).length ? { soinNotes:sNotes } : {}),
      ...(constRel ? { constRel:true } : {}),      // constantes à faire figurer dans la relève
      ...(dardOn ? { dar:true } : {}) };           // passage structuré DAR
    p.visits.push(_v);
    _lastVisitUid = { pid:p.id, uid:_v.uid };   // pour l'annulation immédiate
    if (typeof logChange==="function") logChange("add","visit", p.id+"|"+_v.uid, _v);
    _soinNotes = {}; _formDraft = null;
    if (S.drafts && S.drafts[p.id]){ delete S.drafts[p.id]; }   // saisie consommée
    return true;
  };
  f._commitVisit = commitVisit; // exposé pour le mode séquentiel
  qEl(f, "data-save").onclick = () => {
    if (!commitVisit(false)) return;
    _curSlot = null;
    openId = null; save(true);
    /* Lien d'annulation : rattrape une validation partie trop vite. */
    const uv = _lastVisitUid;
    if (uv){
      toast("Passage enregistré ✓", { label:"Annuler", ms:6000, action:() => {
        const pp = getP(uv.pid);
        if (!pp) return;
        const i = (pp.visits||[]).findIndex(v => v.uid === uv.uid);
        if (i < 0){ toast("Ce passage n'existe plus"); return; }
        pp.visits.splice(i, 1);
        if (typeof logChange==="function") logChange("delete","visit", uv.pid+"|"+uv.uid, {});
        _lastVisitUid = null; save(true); render();
        toast("Passage annulé ↩︎");
      }});
    } else toast("Passage enregistré ✓");
    render();
  };
  qEl(f, "data-docs").onclick = () => sheetDocs(p.id);
  qEl(f, "data-bilans").onclick = () => sheetBilans(p.id);
  qEl(f, "data-raps").onclick = () => sheetRappels(p.id);
  qEl(f, "data-hist").onclick = () => sheetHist(p.id);
  qEl(f, "data-clone").onclick = () => {
    /* Reprendre le passage précédent DU MÊME CRÉNEAU.
       ⚠️ Avant : le dernier passage tout court — le matin, J-1 ressortait
       le soir de la veille, avec pilulier du soir et coucher.
       Si le créneau n'a pas de passage hier, on remonte au dernier du
       même créneau : le plan du matin reste le plan du matin. */
    const lastV = (() => {
      const tous = (p.visits||[]).slice()
        .sort((a,b) => (b.date+b.at).localeCompare(a.date+a.at));
      // Même détermination que le formulaire : choix explicite, sinon l'heure
      const cr = _curSlot || (typeof activeSlot === "function" ? activeSlot() : null)
                 || (typeof defaultSlot === "function" ? defaultSlot() : null);
      if (cr){
        const memeCreneau = tous.filter(v => (v.slot || null) === cr);
        if (memeCreneau.length) return memeCreneau[0];
      }
      return tous[0];      // aucun passage dans ce créneau : le dernier connu
    })();
    const plan = p.plan||[];
    const soins = lastV ? lastV.soins : plan;
    // Cocher les soins — décorer après chaque changement d'état, sinon
    // le crayon ne suit pas (il n'apparaît que sur un soin coché)
    f.querySelectorAll(".chip[data-s]").forEach(c=>{ c.classList.remove("on"); decorateChip(c); });
    soins.forEach(s => {
      let c = f.querySelector(`.chip[data-s="${CSS.escape(s)}"]`);
      if (!c){ c=document.createElement("button"); c.className="chip on"; c.dataset.s=s; c.textContent=s;
        f.querySelector("[data-chips]").insertBefore(c, f.querySelector("[data-addsoin]"));
        armerChipSoin(c, p, f, decorateChip, openSoinComment); }   // crayon, appui long, commentaire
      // ⚠️ Un soin DÉJÀ présent doit être redécoré : le crayon n'apparaît
      // que sur un soin coché, et cocher seul ne réécrit pas le contenu.
      else { c.classList.add("on"); decorateChip(c); }
    });
    // Pré-remplir la note
    const noteEl = f.querySelector("[data-note]");
    noteEl.value = "Soins conformes au plan habituel, état stable.";
    toast("Pré-rempli sur le dernier passage 🔁");
  };
  { const e = f.querySelector("[data-graph]"); if (e) e.onclick = () => sheetGraphConstantes(p.id); }

  /* Suivi de plaie — dans la carte, entre constantes et transmission */
  f.querySelectorAll("[data-plnew]").forEach(b => b.onclick = e => {
    e.stopPropagation(); plaieNouvelle(p.id);
  });
  f.querySelectorAll("[data-plopen]").forEach(b => b.onclick = e => {
    if (e.target.closest("[data-plphoto]")) return;
    sheetPlaies(p.id);
  });
  f.querySelectorAll("[data-plphoto]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    _plaieEnCours = b.dataset.plphoto; docTargetPid = p.id;
    const el = document.getElementById("camerafile"); if (el) el.click();
  });
  const gpsBtn = f.querySelector("[data-gps]");
  if (gpsBtn) gpsBtn.onclick = () => {
    const addr = encodeURIComponent(p.address||"");
    window.open(`geo:0,0?q=${addr}`, "_system");
  };
  const annBtn = f.querySelector("[data-annuaire]");
  if (annBtn) annBtn.onclick = () => sheetAnnuaire(p);
  { const e = f.querySelector("[data-edit]"); if (e) e.onclick = () => sheetPatient(p); }
}

/* ---------- Feuilles génériques ---------- */

/* Poser les gestes d'un soin : cocher, commenter, menu d'appui long.
   Appelée à la construction du formulaire ET à chaque soin ajouté
   ensuite — par J-1, par la recherche, par « ＋ autre… ». */
/* ⚠️ `qEl(f, "data-x").onclick = …` lève une TypeError quand
   l'élément n'existe pas, et TOUT le câblage qui suit est perdu : Docs,
   Bilans, J-1, Fiche… tous les boutons de la carte deviennent muets.
   `q(f,"data-x")` renvoie un objet inerte plutôt que null. */
const _INERTE = new Proxy({}, { get:()=>()=>{}, set:()=>true });
function qEl(f, attr){
  try { return f.querySelector("[" + attr + "]") || _INERTE; }
  catch(e){ return _INERTE; }
}

function armerChipSoin(c, p, f, deco, ouvrirNote){
  /* ⚠️ decorateChip et openSoinComment sont LOCALES au formulaire :
     elles dépendent du patient courant. On les reçoit en paramètre
     plutôt que de les chercher globalement. */
  deco(c);
  let lpTimer = null, lpFired = false;
  c.onclick = (e) => {
    if (lpFired){ lpFired = false; return; }   // ne pas basculer après un appui long
    // Tap sur le crayon ou la bulle → ouvrir le commentaire
    if (e.target.closest("span") && (c.classList.contains("on") || _soinNotes[c.dataset.s])){
      ouvrirNote(c); return;
    }
    c.classList.toggle("on"); deco(c); _saveDraft(f, p.id);
  };
  c.addEventListener("pointerdown", () => {
    lpFired = false;
    lpTimer = setTimeout(() => { lpFired = true; menuSoin(c, p, f); }, 550);
  });
  ["pointerup","pointerleave","pointercancel"].forEach(ev =>
    c.addEventListener(ev, () => clearTimeout(lpTimer)));
}

/* ============================================================
   MENU D'UN SOIN — appui long
   ─────────────────────────────────────────────────────────
   L'appui long ne faisait qu'ouvrir le commentaire. Un soin
   ajouté à la volée n'avait donc AUCUN moyen d'être retiré :
   une erreur de frappe restait là jusqu'à la fermeture.

   Le menu s'adapte au chip : un soin du plan ne se retire pas
   (on le décoche), un soin ajouté oui.
============================================================ */
async function menuSoin(chip, p, f){
  const nom     = chip.dataset.s;
  const duPlan  = (p.plan || []).includes(nom);
  const aNote   = !!(_soinNotes && _soinNotes[nom]);

  const options = [{ ic:"💬", lbl: aNote ? "Modifier le commentaire" : "Ajouter un commentaire", val:"note" }];
  if (aNote)   options.push({ ic:"🧹", lbl:"Effacer le commentaire", val:"clr" });
  if (!duPlan) options.push({ ic:"🗑", lbl:"Retirer de ce passage",  val:"del" });

  // Un seul choix possible : inutile d'ouvrir un menu
  if (options.length === 1){ openSoinComment(chip); return; }

  const c = await askChoice({
    ic:"💉", titre: nom,
    sub: duPlan ? "Soin du plan de soins" : "Ajouté à ce passage",
    options });
  if (!c) return;

  if (c === "note"){ openSoinComment(chip); return; }
  if (c === "clr"){
    delete _soinNotes[nom];
    decorateChip(chip); _saveDraft(f, p.id);
    toast("Commentaire effacé");
    return;
  }
  if (c === "del"){
    delete _soinNotes[nom];
    chip.remove();
    _saveDraft(f, p.id);
    toast(`« ${nom} » retiré de ce passage`);
  }
}


/* ===== sheets.js ===== */
function openSheet(html){
  $("#sheet").innerHTML=`<div class="grab-zone" role="button" aria-label="Fermer"><div class="grab"></div></div>`+html;
  $("#veil").classList.add("on");
  // Swipe bas robuste sur toute la zone de préhension
  let sy=0, moved=false;
  const gz=$("#sheet .grab-zone");
  gz.style.cssText="touch-action:pan-down;cursor:grab;padding:12px 0 10px;margin:-12px 0 0;display:block";
  gz.addEventListener("touchstart",e=>{sy=e.touches[0].clientY; moved=false;},{passive:true});
  gz.addEventListener("touchmove", e=>{
    const dy=e.touches[0].clientY-sy;
    if(dy>10) moved=true;
    if(moved) Object.assign($("#sheet").style,{transform:`translateY(${Math.max(0,dy)}px)`,transition:"none"});
  },{passive:true});
  gz.addEventListener("touchend",e=>{
    const dy=e.changedTouches[0].clientY-sy;
    $("#sheet").style.transition="";
    $("#sheet").style.transform="";
    if(dy>60) closeSheet();
  },{passive:true});

  /* Branchement automatique de la barre de navigation.
     Elle est posée sur 40+ feuilles : la câbler ici évite d'oublier
     un bindNav() et garantit que le bouton retour du téléphone ferme
     proprement PARTOUT, au lieu de quitter l'application. */
  if ($("#sheet .navbar") && typeof bindNav === "function" && !openSheet._skipNav){
    bindNav(closeSheet);
  }
  openSheet._skipNav = false;
}
function closeSheet(){ $("#veil").classList.remove("on"); }
$("#veil").addEventListener("click", e => { if(e.target.id==="veil") closeSheet(); });


/* ---------- Choisir le type d'une information ----------
   Couche empilée au-dessus de la fiche : la feuille en cours n'est pas
   touchée, donc aucune saisie n'est perdue. */
function pickInfoType(current, cb){
  const old = document.getElementById("typepick");
  if (old) old.remove();
  // Deux densités : à l'AJOUT (current vide) on explique chaque type ;
  // pour un CHANGEMENT on va à l'essentiel, l'IDEL les connaît déjà.
  const ajout = !current;
  const el = document.createElement("div");
  el.id = "typepick";
  el.className = "typepick";
  el.innerHTML = `<div class="tp-card">
    <div class="tp-h">${ajout ? "Quel type d'information ?" : "Changer le type"}</div>
    ${ajout ? `<p class="small muted" style="margin:0 0 12px">Le type détermine l'icône, la couleur et le classement.</p>` : ""}
    <div class="tpgrid ${ajout?"large":""}">
      ${Object.entries(INFO_TYPES).map(([k,v])=>`
        <button class="tpcell ${k===current?"on":""}" data-pt="${k}" style="--tc:${v.col}">
          <span class="tc-ic">${v.ic}</span>
          <span class="tc-body">
            <span class="tc-lbl">${esc(v.lbl)}</span>
            ${ajout?`<span class="tc-sub">${esc(INFO_HINTS[k]||"")}</span>`:""}
          </span>
          ${k===current?'<span class="tc-ok">✓</span>':""}
        </button>`).join("")}
    </div>
    <button class="btn btn-ghost" id="pt-cancel" style="width:100%;margin-top:11px">Annuler</button>
  </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  el.querySelectorAll("[data-pt]").forEach(b => b.onclick = () => { const t=b.dataset.pt; close(); cb(t); });
  el.querySelector("#pt-cancel").onclick = close;
  el.onclick = e => { if (e.target === el) close(); };
}

/* ---------- Fin de prise en charge ----------
   Clôture les soins d'un patient : il sort des tournées mais reste
   visible dans la relève couvrant sa date de fin, et son dossier
   (historique, documents) est conservé pour la durée choisie. */
const PEC_MOTIFS = ["Guérison / fin de traitement","Hospitalisation","Entrée en EHPAD",
                    "Déménagement","Changement de cabinet","Décès","Autre"];
const PEC_DUREES = [[3,"3 mois"],[6,"6 mois"],[9,"9 mois"],[12,"12 mois"]];

function sheetFinPEC(pid){
  const p = getP(pid); if (!p) return;
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  let motif = "", duree = 6;
  const draw = () => {
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>🎗️ Fin de prise en charge</h3>
      <p class="small muted" style="margin-bottom:12px">Clôture les soins de <b>${esc(nom)}</b>. Le dossier sort de tes tournées mais reste consultable, et la <b>relève du jour mentionnera la fin de prise en charge</b> pour informer ton collègue.</p>

      <div class="field"><span class="lab">Date de fin</span>
        <input type="date" id="pec-date" value="${todayISO()}"></div>

      <div class="lab">Motif <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></div>
      <div class="chips" style="margin-bottom:12px">
        ${PEC_MOTIFS.map(m=>`<button class="chip ${motif===m?"on":""}" data-pm="${esc(m)}" style="font-size:12.5px">${esc(m)}</button>`).join("")}
      </div>

      <div class="lab">Conserver le dossier</div>
      <div class="chips" style="margin-bottom:6px">
        ${PEC_DUREES.map(([v,l])=>`<button class="chip ${duree===v?"on":""}" data-pd="${v}" style="flex:1;justify-content:center">${l}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:14px">Passé ce délai, l'app te préviendra avant toute suppression — rien n'est effacé sans ton accord.</p>

      <button class="btn btn-primary" id="pec-ok" style="width:100%">🎗️ Clôturer la prise en charge</button>
      <button class="btn btn-ghost" id="pec-cancel" style="width:100%;margin-top:8px">Annuler</button>`);
    $$("#sheet [data-pm]").forEach(b => b.onclick = () => { motif = (motif===b.dataset.pm) ? "" : b.dataset.pm; draw(); });
    $$("#sheet [data-pd]").forEach(b => b.onclick = () => { duree = +b.dataset.pd; draw(); });
    $("#pec-cancel").onclick = () => sheetPatient(pid);
    $("#pec-ok").onclick = () => {
      const dt = $("#pec-date").value || todayISO();
      p.pec = { end: dt, motif, keepMonths: duree, closedAt: Date.now() };
      p.tours = [];                       // sort de toutes les tournées
      if (typeof logChange === "function") logChange("update","patient", p.id, { pec:p.pec, tours:[] });
      if (openId === p.id) openId = null;  // referme sa carte sur le Moniteur
      save(); closeSheet(); render();
      toast("Prise en charge clôturée 🎗️ — dossier conservé " + duree + " mois");
    };
  };
  draw();
}

/* Reprise des soins : annule la clôture */
function reprendrePEC(pid){
  const p = getP(pid); if (!p || !p.pec) return;
  if (!confirm("Reprendre la prise en charge de " + p.prenom + " ?\nLe dossier redevient actif ; pense à le réaffecter à une tournée.")) return;
  delete p.pec;
  if (typeof logChange === "function") logChange("update","patient", p.id, { pec:null });
  save(); closeSheet(); render(); toast("Prise en charge reprise ✓");
}

/* Liste des prises en charge terminées */
function sheetPECList(){
  // Toutes les fins de prise en charge, y compris les dossiers archivés :
  // les masquer donnait un compteur à 0 alors que la PEC existe bien.
  const list = (S.patients||[]).filter(p => p.pec)
    .sort((a,b) => (b.pec.end||"").localeCompare(a.pec.end||""));
  openSheet(`
    ${navHeader("Patients", true)}
    <h3>🎗️ Prises en charge terminées</h3>
    <p class="small muted" style="margin-bottom:10px">Dossiers clôturés, conservés pour la durée choisie. Ils restent trouvables par la recherche 🔍.</p>
    <div style="max-height:56vh;overflow-y:auto">
      ${list.length ? list.map(p=>{
        const rest = pecMonthsLeft(p);
        const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
        return `<div class="rap" style="align-items:center">
          <span style="flex:1">
            <div class="rt">${esc(nom)}</div>
            <div class="rs">Fin le ${fmtFR(p.pec.end)}${p.pec.motif?" · "+esc(p.pec.motif):""}${p.archived?" · 📦 archivé":""}</div>
            <div class="rs" style="color:${rest<=1?"var(--amber)":"var(--faint)"}">${
              rest<=0 ? "⚠ Conservation expirée" : "Conservé encore "+rest+" mois"}</div>
          </span>
          <button class="btn btn-ghost btn-sm" data-pecopen="${p.id}">Ouvrir</button>
          <button class="btn btn-ghost btn-sm" data-pecdel="${p.id}" title="Supprimer définitivement">🗑</button>
        </div>`;
      }).join("") : '<p class="muted small" style="padding:10px 0">Aucune prise en charge terminée.</p>'}
    </div>
    `);
  // sheetPatient attend l'OBJET patient, pas son id : lui passer l'id
  // ouvrait une fiche vide (interprétée comme « nouveau patient »).
  $$("#sheet [data-pecopen]").forEach(b => b.onclick = () => {
    const pp = (S.patients||[]).find(x => x.id === b.dataset.pecopen);
    if (pp) sheetPatient(pp); else toast("Dossier introuvable", "danger");
  });
  $$("#sheet [data-pecdel]").forEach(b => b.onclick = () => supprimerPECDefinitif(b.dataset.pecdel));
  bindNav(sheetPatientsPanel);
}

/* Mois restants avant expiration de la conservation */
function pecMonthsLeft(p){
  if (!p.pec) return null;
  const end = new Date((p.pec.end||todayISO()) + "T12:00:00");
  end.setMonth(end.getMonth() + (p.pec.keepMonths||6));
  return Math.ceil((end - new Date()) / (30*864e5));
}

/* Suppression définitive — double validation */
async function supprimerPECDefinitif(pid){
  const p = getP(pid); if (!p) return;
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  const nv = (p.visits||[]).length, nd = (p.docs||[]).length;
  /* Deux dialogues natifs enchaînés auparavant. Le garde-fou reste — on
     retape le nom — mais dans une seule carte. */
  const _N = nom.toUpperCase();
  if (!await askDialog({
    ton:"danger", ic:"⚠️", titre:"Effacer définitivement",
    sub:`<b>${esc(nom)}</b>`,
    warn:`${nv} passage(s) et ${nd} document(s) seront effacés. Le dossier ne passera PAS par la corbeille — il sera définitivement perdu.`,
    saisieLbl:`Écris <b>${esc(_N)}</b> pour confirmer`,
    saisie:{ ph:_N }, verrou:_N, oui:"🗑 Effacer", non:"Annuler" })) return;
  (p.docs||[]).forEach(d => { try { _rawDel("doc_" + d.id); } catch(e){} });
  S.patients = S.patients.filter(x => x.id !== pid);
  S.rappels  = (S.rappels||[]).filter(r => r.pid !== pid);
  if (typeof logChange === "function") logChange("delete","patient", pid);
  save(true); closeSheet(); render(); toast("Dossier supprimé définitivement");
}

/* ============================================================
   MENU PRINCIPAL — deux présentations au choix
   ▦ Tuiles (défaut) · ☰ Liste
   Les deux mènent aux mêmes écrans ; l'ancien menu complet
============================================================ */
function sheetTours(){
  const archived = S.patients.filter(p=>p.archived);
  const nPec  = (S.patients||[]).filter(x=>x.pec).length;
  const nTr   = (S.trash||[]).length;
  const nSync = (S.syncHistory||[]).length;
  const nPh   = (S.phraseCats||[]).reduce((n,c)=>n+c.phrases.length,0);
  const nLog  = (S.sendLog||[]).length;
  const days  = S.lastBackup ? Math.floor((Date.now()-S.lastBackup)/864e5) : null;
  const bkTxt = days === null ? "jamais" : (days === 0 ? "aujourd'hui" : "il y a "+days+" j");
  const bkWarn = (days === null || days >= 7);
  const mode = S.menuMode || "tiles";

  const CIG = `<svg viewBox="0 0 100 100" class="cig-ic mh-cig" aria-hidden="true"><g stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/><ellipse cx="50" cy="30" rx="15" ry="12"/><path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/><path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/><path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g><circle cx="43" cy="29" r="3.2" fill="currentColor"/><circle cx="57" cy="29" r="3.2" fill="currentColor"/><path d="M50 50 v18 M41 59 h18" class="cig-x-bg" stroke-width="13" stroke-linecap="round" fill="none"/><path d="M50 50 v18 M41 59 h18" stroke="#fff" stroke-width="7.5" stroke-linecap="round" fill="none"/></svg>`;

  const tiles = `
    <div class="mgrid">
      <button class="mtile" data-sec="tour"><span class="mt-ic">🗺️</span><span class="mt-l">Tournées</span>
        <span class="mt-s">${S.tours.length} cabinet${S.tours.length>1?"s":""}${S.slotsEnabled?" · ☀️🌙":""}</span></button>
      <button class="mtile" data-sec="share"><span class="mt-ic">🔄</span><span class="mt-l">Partage</span>
        <span class="mt-s">${S.identity ? esc(whoami()) : "identité à définir"}</span></button>
      <button class="mtile" data-sec="pat"><span class="mt-ic">👥</span><span class="mt-l">Patients</span>
        <span class="mt-s">${nPec} clôturée${nPec>1?"s":""} · ${archived.length} archivé${archived.length>1?"s":""}</span></button>
      <button class="mtile" data-sec="data"><span class="mt-ic">💾</span><span class="mt-l">Données</span>
        <span class="mt-s ${bkWarn?"warn":""}">${bkWarn?"⚠ ":""}sauvegarde ${bkTxt}</span></button>
      <button class="mtile" data-sec="cat"><span class="mt-ic">📋</span><span class="mt-l">Catalogues</span>
        <span class="mt-s">Soins · ${nPh} phrases</span></button>
      <button class="mtile" data-sec="app"><span class="mt-ic">⚙️</span><span class="mt-l">Application</span>
        <span class="mt-s">Sécurité · Thème</span></button>
    </div>
    <button class="btn btn-ghost" data-sec="guide" style="width:100%;margin-top:10px">📖 Guide d'utilisation</button>`;

  const row = (id,ic,lbl,val) =>
    `<button class="mrow" data-sec="${id}"><span class="mr-ic">${ic}</span><span class="mr-l">${lbl}</span><span class="mr-v">${val||""} ›</span></button>`;
  const list = `
    <div class="mgroup-t">Ma tournée</div>
    <div class="mgroup">
      ${row("tour","🗺️","Tournées &amp; ordre de passage", S.tours.length)}
      ${row("slots","☀️","Créneaux Matin / Soir", S.slotsEnabled?'<b style="color:var(--accent)">activés</b>':"désactivés")}
      ${row("route","🖨️","Feuille de route imprimable","")}
    </div>
    <div class="mgroup-t">Partage</div>
    <div class="mgroup">
      ${row("send","📤","Envoyer la synchro","")}
      ${row("recv","📥","Recevoir","")}
      ${row("synchist","🕰️","Historique des synchros", nSync)}
    </div>
    <div class="mgroup-t">Mes patients</div>
    <div class="mgroup">
      ${row("pec","🎗️","Prises en charge terminées", nPec)}
      ${row("arch","📦","Dossiers mis de côté", archived.length)}
      ${row("trash","🗑","Corbeille", nTr)}
    </div>
    <div class="mgroup-t">Mes données</div>
    <div class="mgroup">
      ${row("data","💾","Sauvegarde", `<span class="${bkWarn?"warn":""}">${bkTxt}</span>`)}
      ${row("sendlog","📨","Journal des envois", nLog)}
    </div>
    <div class="mgroup-t">Catalogues</div>
    <div class="mgroup">
      ${row("catalog","📋","Catalogue des soins","")}
      ${row("phrases","💬","Phrases types", nPh)}
    </div>
    <div class="mgroup-t">Application</div>
    <div class="mgroup">
      ${row("theme","🎨","Thème", esc((APP_THEMES[S.theme]||{}).lbl||""))}
      ${row("clean","🧹","Conservation des données", S.retention+" mois")}
      ${row("guide","📖","Guide d'utilisation","")}
      ${row("seed","🎬","Recharger la démo","")}
      ${row("wipe","🗑","Tout effacer","")}
    </div>`;

  openSheet(`
    ${navHeader("Moniteur", false)}
    <div class="mhead">
      ${CIG}
      <div class="mh-t"><h3 style="margin:0;font-size:17px">Réglages</h3>
        <div class="mh-s">Tout est dans la cigale</div></div>
      <div class="mswitch">
        <button class="msw ${mode==="tiles"?"on":""}" data-mm="tiles" title="Vue tuiles">▦</button>
        <button class="msw ${mode==="list" ?"on":""}" data-mm="list"  title="Vue liste">☰</button>
      </div>
    </div>
    ${mode==="tiles"?tiles:list}`);

  $$("#sheet [data-mm]").forEach(b => b.onclick = () => { S.menuMode = b.dataset.mm; save(); sheetTours(); });
  $$("#sheet [data-sec]").forEach(b => b.onclick = () => menuGo(b.dataset.sec));
}

/* ---------- Routage des rubriques du menu ---------- */
function menuGo(sec){
  switch(sec){
    // Rubriques (tuiles) et écrans regroupés
    case "tour":     sheetToursList(); break;
    case "slots":    sheetToursList(); break;
    case "share":    sheetSharePanel(); break;
    case "pat":      sheetPatientsPanel(); break;
    case "data":     sheetDataPanel(); break;
    case "cat":      sheetCatalogPanel(); break;
    case "app":      sheetAppPanel(); break;
    // Entrées directes (mode liste)
    case "route":    closeSheet(); if (typeof shareFeuilleRoute==="function") shareFeuilleRoute(); break;
    case "send":     ensureIdentity(() => sheetSendSync()); break;
    case "recv":     $("#syncfile").click(); break;
    case "synchist": sheetSyncHistory(); break;
    case "pec":      sheetPECList(); break;
    case "trash":    sheetTrash(); break;
    case "arch":     sheetArchives(); break;
    case "backup":   sheetDataPanel(); break;
    case "sec":      sheetDataPanel(); break;
    case "sendlog":  sheetSendLog(); break;
    case "sante":    sheetSante(); break;
    case "catalog":  sheetCatalog(); break;
    case "phrases":  sheetPhrases(); break;
    case "theme":    sheetAppPanel(); break;
    case "clean":    sheetAppPanel(); break;
    case "guide":    sheetGuide(); break;
    case "seed":     sheetAppPanel(); setTimeout(()=>{ const b=document.getElementById("go-seed"); if(b) b.click(); }, 30); break;
    case "wipe":     sheetAppPanel(); setTimeout(()=>{ const b=document.getElementById("go-wipe"); if(b) b.click(); }, 30); break;
    default:         sheetTours(); break;
  }
}

/* Gestionnaires communs à tous les écrans du menu.
   Tolérant : chaque élément est branché seulement s'il est présent. */
async function bindMenuHandlers(){
  // Helper : renvoie l'élément s'il existe, sinon un objet inerte.
  // Évite de casser sur un écran qui ne contient pas tel bouton.
  const $ = sel => document.querySelector(sel) || {};
  // Démo et effacement : mêmes actions que les liens du pied de page
  $("#go-seed").onclick = () => { closeSheet(); const b = document.querySelector('[data-a="seed"]'); if (b) b.click(); };
  $("#go-wipe").onclick = () => { closeSheet(); const b = document.querySelector('[data-a="wipe"]'); if (b) b.click(); };
  // Démo et effacement : mêmes actions que les liens du pied de page
  $("#go-seed").onclick = () => { closeSheet(); const b=document.querySelector('[data-a="seed"]'); if(b) b.click(); };
  $("#go-wipe").onclick = () => { closeSheet(); const b=document.querySelector('[data-a="wipe"]'); if(b) b.click(); };
  $$("#tourlist [data-assign]").forEach(b => b.onclick = () => sheetAssignPatients(b.dataset.assign));
  $$("#tourlist [data-deltour]").forEach(b => b.onclick = async () => {
    const t = b.dataset.deltour;
    const n = S.patients.filter(p=>(p.tours||[]).includes(t)).length;
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer cette tournée ?", sub:esc(t)+(n?" — "+n+" patient(s) en seront retirés":""), oui:"🗑 Supprimer" })) return;
    S.tours = S.tours.filter(x=>x!==t);
    S.patients.forEach(p => p.tours = (p.tours||[]).filter(x=>x!==t));
    if (S.curTour===t) S.curTour="all";
    save(); sheetTours(); render();
  });
  $("#addtour").onclick = () => {
    const v = $("#newtour").value.trim();
    if (!v){ toast("Nom de tournée vide"); return; }
    if (S.tours.includes(v)){ toast("Cette tournée existe déjà"); return; }
    S.tours.push(v); save(); sheetTours(); render();
  };
  $$("#themepick [data-th]").forEach(b => b.onclick = () => {
    S.theme = b.dataset.th; save(); applyTheme();
    // Mettre à jour les chips sans détruire le formulaire en cours
    $$("#themepick [data-th]").forEach(x=>x.classList.toggle("on",x===b));
    render();
  });
  $$("#retpick [data-ret]").forEach(b => b.onclick = async () => {
    S.retention = +b.dataset.ret; save();
    const n = autoPurge();
    if (!n) toast("Conservation réglée sur " + S.retention + " mois — rien à purger pour l'instant.");
    sheetTours(); render();
  });
  const pinOn = $("#pin-on"), pinOff = $("#pin-off");
  const bioOn = $("#bio-on"), bioOff = $("#bio-off");
  if (bioOn) bioOn.onclick = async () => {
    if (!(await bioAvailable())){ toast("Biométrie non disponible sur cet appareil"); return; }
    const ok = await bioUnlock();
    if (ok){ S.bioLock = true; save(); toast("Empreinte activée 👆"); sheetTours(); }
    else toast("Authentification annulée");
  };
  if (bioOff) bioOff.onclick = () => {
    S.bioLock = false; save(); toast("Empreinte désactivée"); sheetTours();
  };
  if (pinOn) pinOn.onclick = async () => { closeSheet(); showLock("set"); };
  if (pinOff) pinOff.onclick = async () => {
    if (!await askDialog({ ic:"❓", titre:"Désactiver le code de verrouillage ?" })) return;
    S.pin = null; S.bioLock = false; save(); toast("Code désactivé"); sheetTours();
  };
  const st = $("#slot-toggle");
  if (st) st.onclick = () => { S.slotsEnabled = !S.slotsEnabled; save(); sheetTours(); toast(S.slotsEnabled?"Créneaux activés ☀️🌙":"Créneaux désactivés"); };
  { const _e = $("#bk-save"); if (_e) _e.onclick = () => { exportBackup("save"); setTimeout(sheetTours, 900); }; }
  { const _e = $("#bk-exp"); if (_e) _e.onclick = () => { exportBackup("share"); setTimeout(sheetTours, 900); }; }
  { const _e = $("#go-phrases"); if (_e) _e.onclick = () => sheetPhrases(); }
  const goPec = $("#go-pec"); if (goPec) goPec.onclick = sheetPECList;
  { const _e = $("#go-trash"); if (_e) _e.onclick = sheetTrash; }
  const sSend=$("#sync-send"), sRecv=$("#sync-recv"), sHist=$("#sync-hist"), sId=$("#sync-id");
  if (sSend) sSend.onclick = () => ensureIdentity(() => sheetSendSync());
  // Pas d'identité demandée ici : elle ne sert qu'aux vraies synchros
  // (receiveSyncFile la réclame lui-même si le fichier en est une).
  if (sRecv) sRecv.onclick = () => { $("#syncfile").click(); };
  if (sHist) sHist.onclick = sheetSyncHistory;
  if (sId) sId.onclick = () => { S.identity=null; ensureIdentity(()=>sheetTours()); };
  { const _e = $("#go-route"); if (_e) _e.onclick = () => { closeSheet(); shareFeuilleRoute(); }; }
  { const _e = $("#go-sendlog"); if (_e) _e.onclick = sheetSendLog; }
  { const _e = $("#go-sante"); if (_e) _e.onclick = sheetSante; }
  $$("#sheet [data-vret]").forEach(b => b.onclick = async () => {
    S.voiceRetention = b.dataset.vret; save(true);
    const n = await voicePurge();
    sheetDataPanel();
    toast(n ? n + " note(s) effacée(s)" : "Réglage enregistré");
  });
  { const _e = $("#bk-dir"); if (_e) _e.onclick = async () => {
      const mode = (typeof dossierPossible === "function") ? dossierPossible() : "aucun";
      if (S.dossierSauvegarde){
        const c = await askChoice({
          ic:"📁", titre:"Dossier d'enregistrement",
          sub:esc(dossierLabel()),
          options:[ { ic:"📂", lbl:"Choisir un autre dossier", val:"chg" },
                    { ic:"↩︎", lbl:"Revenir au dossier par défaut", val:"raz" } ] });
        if (c === "raz"){ await oublierDossier(); sheetDataPanel(); toast("Dossier par défaut rétabli"); return; }
        if (c !== "chg") return;
      }
      if (await choisirDossier()) sheetDataPanel();
    }; }
  $("#go-guide").onclick = () => { openSheet(`
    ${navHeader("Retour", true)}
    <h3>📖 Guide d'utilisation — JM@Santé</h3>
    <!-- Les mêmes boutons figuraient uniquement TOUT EN BAS : sans le
         savoir, on ne les trouvait pas. Doublés ici en tête. -->
    <div class="rowb" style="margin-bottom:14px">
      <button class="btn btn-ghost btn-sm" id="guide-dl-html2" style="flex:1">🌐 Télécharger</button>
      <button class="btn btn-ghost btn-sm" id="guide-dl-pdf2" style="flex:1">📑 Ouvrir pour PDF</button>
    </div>
<p class="small" style="color:var(--accent);font-style:italic;margin:-6px 0 10px">Tout est dans la cigale</p>
<div style="max-height:70vh;overflow-y:auto;padding-right:4px">

<div class="cat-head" style="margin-top:0">🗺️ Organiser ses tournées</div>
<p class="small" style="margin-bottom:8px">Tape le bouton <b>🦗 cigale</b> (en haut à gauche) → réglages, tournées et archives. Le <b>🗺️</b> reste devant la gestion des cabinets à l'intérieur. Ajoute une tournée par cabinet. Rattache un patient à son cabinet depuis <b>sa fiche</b> : il restera visible dans l'écran <b>👥</b> même s'il est temporairement hors tournée (hospitalisation, absence) — tu pourras le recocher en un tap. Utilise <b>👥</b> pour composer la tournée et régler l'<b>ordre de passage</b> : la case ✓ affecte, la poignée <b>☰</b> déplace (tape ☰ puis la ligne de destination), les flèches ↑↓ ajustent. Le filtre 👁️ n'affiche que les patients de la tournée.</p>

<div class="cat-head">🧑 Créer un dossier patient</div>
<p class="small" style="margin-bottom:8px"><b>Contexte &amp; informations</b> : chaque information (code d'accès, allergie, <b>traitement</b>, antécédents, entourage) est une ligne à part, avec son <b>type</b> — tape l'icône pour ouvrir le <b>sélecteur</b> et choisir parmi les 6 catégories — et son <b>interrupteur</b> : <b>relève</b> = elle figure sur chaque relève de ce patient · <b>fiche</b> = consultable ici seulement. Tu règles ça <b>une fois</b>, pas à chaque relève. Ainsi le code du portail accompagne toujours tes transmissions, tandis que les antécédents restent dans la fiche sans encombrer la relève.</p>
<p class="small" style="margin-bottom:8px">Tape <b>＋</b> → nom, prénom, date de naissance, tournée(s). <b>Adresse</b> : active le GPS. <b>Annuaire</b> : médecin, famille, pharmacie → appel direct. <b>Seuils perso</b> : adapte les alertes de constantes à ce patient.</p>

<div class="cat-head">✅ Saisir un passage</div>
<p class="small" style="margin-bottom:8px">Tape une carte patient → elle s'ouvre. Coche les <b>soins</b> réalisés. Les <b>constantes</b> affichent la dernière valeur connue en gris. <b>💬 Phrases types</b> : catalogue de formulations pro classées par thème. <b>📋 Mode DARD</b> : découpe la transmission en Données/Actions/Résultats/Devenir. <b>Dictée 🎤</b> : ajoute au texte. Valide avec <b>✓ Valider le passage</b>.</p>

<div class="cat-head">💬 Commenter un soin précis</div>
<p class="small" style="margin-bottom:8px">Coche un soin → un <b>✏️</b> apparaît dessus. <b>Appui long</b> (ou tape le ✏️) → un champ s'ouvre pour ce soin. Le bouton <b>💬</b> insère une phrase type. Exemple : « Pansement plaie <i>(bourgeonnement satisfaisant)</i> ». Le commentaire suit le soin dans la relève.</p>

<div class="cat-head">☀️🌙 Créneaux Matin / Soir</div>
<p class="small" style="margin-bottom:8px">Active-les dans <b>🗺️ → Créneaux</b>. Un sélecteur apparaît alors sur chaque passage : ce que tu coches est attribué au créneau choisi (deux passages distincts le même jour). Dans <b>👥</b>, chaque créneau a sa <b>propre composition et son propre ordre</b>. Le bandeau ☀️/🌙 du Moniteur bascule la vue ; le déroulé ▶ suit le créneau affiché.</p>

<div class="cat-head">🩺 Santé de l'application</div>
<p class="small" style="margin-bottom:8px">Dans <b>Réglages → Données</b>, cet écran montre l'état réel de tes données : nombre de patients et de passages, place occupée, dernière sauvegarde.</p>
<p class="small" style="margin-bottom:8px">L'<b>intégrité</b> repère les incohérences — une tournée supprimée mais encore référencée, un rappel qui pointe vers un dossier disparu. Les <b>incidents</b> gardent la trace des erreurs techniques.</p>
<div class="tip">Ce journal ne contient <b>aucune donnée patient</b> : seulement la date, l'origine et le message technique.</div>

<div class="cat-head">🩹 Le suivi de plaie</div>
<p class="small" style="margin-bottom:8px">Tout se passe <b>dans la carte du patient</b>, entre les constantes et la transmission. S'il n'y a rien, une seule ligne : <b>🩹 Déclarer une plaie</b>. Sinon, chaque plaie ouverte s'affiche avec sa durée et un bouton 📷 pour ajouter une photo sans rien ouvrir.</p>
<p class="small" style="margin-bottom:8px">À la création : un <b>type</b> (escarre, ulcère, plaie chirurgicale…) et une <b>localisation</b>. Les cinq plus courantes sont en accès direct ; pour le reste, un <b>schéma du corps</b> — dos et face — où <b>chaque partie se colore quand on la touche</b>, avec la liste complète en dessous. Le bouton ⛶ agrandit le schéma.</p>
<p class="small" style="margin-bottom:8px">Le <b>stade</b> et les <b>mesures</b> sont facultatifs.</p>
<div class="tip">L'app <b>enregistre, elle n'interprète pas</b>. Aucune alerte du type « plaie qui se dégrade » : les photos côte à côte suffisent, et l'évaluation reste la tienne.</div>
<p class="small" style="margin-bottom:8px">Une plaie refermée se déclare <b>✓ Cicatrisée</b>. Elle passe alors dans la seconde liste, avec sa durée totale. Les plaies ouvertes figurent dans la relève — le collègue sait qu'il y en a une et depuis quand.</p>

<div class="cat-head">📎 Nommer les documents</div>
<p class="small" style="margin-bottom:8px">Chaque document ajouté demande un <b>type</b> et une <b>précision</b>. Sans les deux, il ne peut pas être enregistré. Cinq familles : prescriptions, résultats, suivi de soin, administratif, et <b>libre</b> pour tout le reste.</p>
<p class="small" style="margin-bottom:8px">Le nom se compose seul avec la date : <code>2026-09-08_Ordo-medecin_Renouvellement</code>. Il est <b>identique d'un appareil à l'autre</b>.</p>
<div class="tip">C'est ce qui rend la <b>synchronisation</b> utile : l'app compare des types datés au lieu de noms de fichiers. « Tu as déjà une ordo médecin du 3 sept. » — tu sais quoi garder, remplacer ou ignorer.</div>
<p class="small" style="margin-bottom:8px"><b>Photos :</b> l'app propose d'en faire un PDF — plusieurs pages en un fichier, environ 85 % plus léger. Sauf pour une <b>photo de plaie</b>, où les images sont conservées : le zoom sert au suivi.</p>
<p class="small" style="margin-bottom:8px">Les documents ajoutés avant cette version portent une pastille <b>à qualifier</b>. Rien n'est imposé rétroactivement.</p>

<div class="cat-head">🔁 Le bouton J-1</div>
<p class="small" style="margin-bottom:8px">Il reprend le passage précédent <b>du même créneau</b> : le matin, il ressort le matin de la veille ; le soir, le soir de la veille. Sans quoi le pilulier du soir et le coucher se retrouvaient dans un passage du matin.</p>
<div class="tip">Si le patient n'a pas été vu hier dans ce créneau, l'app remonte au <b>dernier passage du même créneau</b>, même s'il date de plusieurs jours. Le plan du matin reste le plan du matin.</div>

<div class="cat-head">📋 La fiche de recueil</div>
<p class="small" style="margin-bottom:8px">Chez le patient, naviguer entre les onglets fait perdre du temps et oublier des champs. La fiche de recueil présente <b>tout à la suite</b> — identité, domicile, accès, qui prévenir, professionnels, ce qu'il faut savoir. Une barre d'avancement indique ce qui manque.</p>
<p class="small" style="margin-bottom:8px">Accès : <b>✏️ Fiche → ⚡ Actions → 📋 Fiche de recueil</b>. L'app la propose aussi juste après la création d'un dossier.</p>
<div class="tip">Ce n'est pas un document séparé : <b>c'est le dossier lui-même, présenté autrement</b>. Ce que tu écris ici apparaît dans l'onglet Infos, et le DLU le reprend comme d'habitude. Impossible que les deux divergent.</div>
<p class="small" style="margin-bottom:8px">Deux impressions : <b>🖨 Remplie</b> donne une page dense pour le classeur du domicile — utile au remplaçant qui ne connaît pas le patient. <b>📄 Fiche vierge</b> imprime trois pages avec des cases à lettres, que le patient ou sa famille remplit à la main.</p>

<div class="cat-head">🎙 La note vocale</div>
<p class="small" style="margin-bottom:8px">Sur l'écran d'envoi de la relève, après avoir relu le texte : <b>🎙 Ajouter une note vocale</b>. Deux notes de <b>3 minutes</b> au maximum, entièrement facultatives.</p>
<p class="small" style="margin-bottom:8px">Avant d'envoyer, tu peux <b>l'écouter</b>, l'effacer pour la refaire, ou la compléter par une seconde. Après envoi, elle reste écoutable dans <b>📨 Journal des envois</b>.</p>
<div class="warn">Une mention est jointe au message : « <i>Contient des données de santé couvertes par le secret professionnel. Ne pas rediffuser.</i> » Elle engage celui qui reçoit — mais <b>l'app ne peut rien effacer chez lui</b>.</div>
<p class="small" style="margin-bottom:8px">L'effacement sur <b>ton</b> appareil se règle dans <b>💾 Mes données</b> : après envoi, 7 jours, 30 jours, ou à la main.</p>

<div class="cat-head">🎂 Les anniversaires</div>
<p class="small" style="margin-bottom:8px">Quand la date de naissance est renseignée, une pastille <b>🎂</b> apparaît sur la carte du patient, dans le déroulé et dans la relève.</p>
<div class="tip">Elle sort <b>3 jours avant</b> et reste <b>jusqu'au lendemain</b> : tu peux souhaiter au passage d'avant ou d'après si tu ne viens pas le jour même. Ton collègue la voit aussi dans la relève.</div>

<div class="cat-head">💩 La surveillance des selles</div>
<p class="small" style="margin-bottom:8px">Dans les <b>constantes</b>, une rangée <b>0 · + · ++ · +++ · ++++ · 💧 Diarrhée</b>. Un tap pour noter, un second sur le même bouton pour effacer.</p>
<p class="small" style="margin-bottom:8px"><b>0 est une valeur</b> — « pas de selle aujourd'hui » — et non l'absence de saisie. C'est cette distinction qui permet l'alerte.</p>
<p class="small" style="margin-bottom:8px">Au-delà de <b>3 jours consécutifs à 0</b>, l'app signale « 💩 4 j sans selle » sur la carte et dans la relève. Le délai se règle par patient dans <b>✏️ Fiche → 💉 Soins</b> : le transit varie, 5 jours peut être la norme pour certains.</p>
<div class="tip">Un jour <b>non renseigné remet le compteur à zéro</b>. Mieux vaut rater une alerte que d'en lever une fausse sur des données qu'on n'a pas.</div>

<div class="cat-head">📉 Les tendances</div>
<p class="small" style="margin-bottom:8px">Les seuils alertent quand <b>une</b> constante sort des bornes. Mais une dégradation lente peut passer inaperçue : six pesées toutes au-dessus du seuil, et pourtant <b>2,4 kg perdus en trois semaines</b>.</p>
<p class="small" style="margin-bottom:8px">L'onglet <b>📋 Infos</b> signale ces dérives pour le <b>poids</b> et la <b>tension</b>. Il faut au moins <b>4 mesures sur 14 jours</b> — sinon c'est du bruit, et rien ne s'affiche.</p>
<div class="tip">C'est un <b>constat</b>, pas un diagnostic. L'app dit « le poids a baissé de 2,4 kg » — l'interprétation t'appartient.</div>

<div class="cat-head">✏️ La consigne des feuilles domicile</div>
<p class="small" style="margin-bottom:8px">Chaque feuille porte en bas une <b>consigne</b> — les seuils d'alerte pour les constantes, la conduite à tenir pour le poids ou les glycémies. Elle reprend automatiquement les seuils réglés pour ce patient.</p>
<p class="small" style="margin-bottom:8px">Tu peux la <b>modifier avant d'imprimer</b> : « Prévenir le fils au 06… avant le médecin », par exemple. Deux boutons pour revenir au texte d'origine ou n'afficher <b>aucune consigne</b>.</p>
<div class="tip">La modification est <b>ponctuelle</b> : elle vaut pour cette impression. Rouvrir l'écran repart du texte par défaut.</div>

<div class="cat-head">🗑 Retirer un soin</div>
<p class="small" style="margin-bottom:8px"><b>Pendant un passage</b> : appui long sur un soin → un menu propose de le commenter, d'effacer son commentaire, et — s'il a été ajouté à la volée — de le <b>retirer de ce passage</b>. Un soin du plan ne se retire pas : il se décoche.</p>
<p class="small" style="margin-bottom:8px"><b>Dans le catalogue</b> : le 🗑 retire un soin de la liste. Si tu l'as déjà employé, l'app te le dit — « utilisé dans 3 passages et 1 plan ».</p>
<div class="tip">Retirer un soin du catalogue ne touche <b>jamais</b> l'historique : les passages enregistrés gardent le texte du soin tel qu'il a été saisi ce jour-là. Seule la liste de choix perd la ligne, et le plan de soins des patients est nettoyé.</div>

<div class="cat-head">📌 Un rappel fait devient une information</div>
<p class="small" style="margin-bottom:8px">Quand tu coches un rappel, l'app te propose de <b>noter le résultat dans la relève</b>. Le texte est pré-rempli à partir du rappel — « Récupérer le médicament » devient « Récupéré : le médicament » — tu n'as qu'à valider ou l'ajuster.</p>
<p class="small" style="margin-bottom:8px">La relève affiche alors <b>✅ ce qui est fait</b> à côté de <b>📌 ce qui reste à faire</b>. Ton collègue sait que c'est réglé, au lieu de ne plus rien voir.</p>
<div class="tip">L'information <b>reste jusqu'à ce que tu la supprimes</b>, dans la section « Notés dans la relève » de l'écran Rappels. Laisse le champ vide pour classer un rappel sans rien noter.</div>

<div class="cat-head">🏷️ Commenter une pastille</div>
<p class="small" style="margin-bottom:8px"><b>Appui long</b> sur une pastille active (👁️ À surveiller, 🔴 Prioritaire, 🩺 Médecin contacté) pour préciser — comme pour un soin. Un <b>💬</b> apparaît, et le texte part dans la relève : « 🩺 Médecin contacté (hier) — Dr Blanc prévenu de la TA ».</p>
<p class="small" style="margin-bottom:8px"><b>🩺 Médecin contacté</b> retient sa date. La relève indique l'ancienneté, et la pastille <b>s'atténue au bout de trois jours</b> — ton collègue distingue ce qui est frais de ce qui traîne. Rien ne disparaît pour autant.</p>
<p class="small" style="margin-bottom:8px">La pastille <b>Matériel à apporter</b> a été retirée : c'était un rappel déguisé, sans échéance ni disparition une fois fait. Celles déjà cochées sont <b>converties en rappels</b>, rien n'est perdu.</p>

<div class="cat-head">📋 Choisir le type d'une information</div>
<p class="small" style="margin-bottom:8px">Le bouton <b>＋ Ajouter une information</b> ouvre la <b>grille des six types</b> : accès, vigilance, traitement, antécédents, entourage, autre. Tu choisis d'abord, la ligne se crée au bon type.</p>
<p class="small" style="margin-bottom:8px">Sur une information existante, la <b>pastille du type</b> (avec son ▾) rouvre la même grille pour en changer — le texte saisi est conservé, seule la couleur change.</p>

<div class="cat-head">🏁 La fin de tournée</div>
<p class="small" style="margin-bottom:8px">À la fin du déroulé ▶, un <b>récapitulatif</b> s'affiche : nombre de passages, plage horaire, constantes hors seuils. Chaque passage est <b>modifiable</b> — un tap sur ✏️ rouvre la carte du patient.</p>
<p class="small" style="margin-bottom:8px">Le déroulé <b>reprend toujours au premier patient non encore vu</b>. Si tu le quittes en cours de route et que tu le relances, tu repars là où tu en étais. Et si tous les patients sont déjà vus, l'écran de fin s'affiche directement.</p>

<div class="cat-head">💊 La fiche de traitement</div>
<p class="small" style="margin-bottom:8px">Fiche patient → onglet <b>📋 Infos</b> → <b>💊 Fiche de traitement</b>. Une <b>ligne par médicament</b>, avec sa posologie répartie sur quatre moments : <b>matin · midi · soir · coucher</b>. Un tap sur ✏️ ouvre la ligne pour l'ajuster quand le médecin change la prescription.</p>
<p class="small" style="margin-bottom:8px">Pour chaque médicament tu peux préciser sa <b>forme</b> (comprimé, injectable, gouttes, patch) et une <b>remarque</b> (« à jeun », « pendant le repas »). Les traitements <b>« si besoin »</b> ont leur propre section — tu décris la conduite dans les remarques (« si douleur &gt; 4, max 3/jour »).</p>
<p class="small" style="margin-bottom:8px">La fiche <b>s'imprime</b> ou se partage : un tableau clair à laisser chez le patient, avec la date de mise à jour, les vigilances et le prescripteur. Les <b>anticoagulants sont repérés automatiquement</b> et signalés en rouge.</p>
<p class="small" style="margin-bottom:8px">Le <b>DLU</b> et la <b>relève</b> reprennent cette fiche dès qu'elle contient un médicament. Si tu avais renseigné le traitement en <b>texte libre</b>, il reste en place tant que tu ne l'as pas ressaisi — il te sera rappelé en haut de l'écran.</p>

<div class="cat-head">☀️🌙 Un plan de soins différent matin et soir</div>
<p class="small" style="margin-bottom:8px">Dans l'onglet <b>💉 Soins</b> de la fiche, chaque soin du plan a deux cases : <b>☀️</b> et <b>🌙</b>. Coche celle du créneau où le soin doit être proposé. La toilette au matin, l'injection du soir, le pilulier aux deux.</p>
<p class="small" style="margin-bottom:8px"><b>Aucune case cochée = le soin est proposé aux deux créneaux</b> — c'est le comportement d'origine, rien ne change si tu ne précises rien. Et si tu n'utilises pas les créneaux Matin/Soir, la liste reste comme aujourd'hui.</p>
<p class="small" style="margin-bottom:8px">À la saisie, tu ne vois plus que les soins du créneau en cours. Un remplaçant sait exactement ce qui est attendu à <b>ce passage-là</b>. Tu peux toujours ajouter un soin à la volée (libre ou depuis le catalogue) et le commenter par appui long.</p>

<div class="cat-head">👤 La fiche patient en 4 onglets</div>
<p class="small" style="margin-bottom:8px">La fiche est organisée en onglets, chacun avec sa couleur : <b>👤 Identité</b> (état civil, n° de sécurité sociale, adresse, tournées, personne à prévenir, annuaire d'urgence) · <b>📋 Infos</b> (informations typées et appareillages) · <b>💉 Soins</b> (plan de soins et seuils personnalisés) · <b>⚡ Actions</b> (DLU, feuilles, export, fin de prise en charge, mise de côté, suppression).</p>

<div class="cat-head">📅 Saisir un passage d'un autre jour</div>
<p class="small" style="margin-bottom:8px">Tu as noté des soins sur papier hier faute de temps ? Les <b>flèches ‹ ›</b> autour de la date, en haut du Moniteur, reculent d'un jour (jusqu'à <b>30 jours</b>). Un <b>bandeau orange</b> apparaît alors : impossible d'oublier que tu saisis dans le passé.</p>
<p class="small" style="margin-bottom:8px">Toute l'application suit cette date : les cartes montrent l'état de ce jour-là, les passages validés portent cette date, et le déroulé ▶ comme la relève s'y adaptent. Le bouton <b>↩︎ Aujourd'hui</b> te ramène d'un tap — et l'app repart toujours d'aujourd'hui à son ouverture.</p>
<p class="small" style="margin-bottom:8px">Pour une <b>ordonnance reçue avant-hier</b> que tu scannes ce soir : pas besoin de changer la date du Moniteur. L'écran <b>＋ Ajouter un document</b> propose un champ <b>Date du document</b>, pré-rempli à aujourd'hui et modifiable.</p>

<div class="cat-head">🧹 Ménage dans l'historique</div>
<p class="small" style="margin-bottom:8px">🦗 → <b>Application</b> → <b>🧹 Ménage dans l'historique</b>, ou le bouton <b>🧹</b> dans l'écran <b>🕐 Historique</b> d'un patient. Quatre étapes : <b>①</b> passages et/ou constantes · <b>②</b> période (3 mois, 6 mois, 1 an ou dates libres) · <b>③</b> quels patients — tu peux en décocher un dont l'historique reste utile · <b>④</b> archiver puis supprimer.</p>
<p class="small" style="margin-bottom:8px"><b>Rien ne se supprime sans archive</b> : le bouton de suppression reste inactif tant que le fichier n'est pas produit (un lien discret permet de passer outre si tu y tiens). Quatre formats : <b>HTML</b> lisible dans un navigateur · <b>Texte</b> · <b>CSV</b> pour Excel · <b>JSON</b> réimportable dans l'app.</p>
<p class="small" style="margin-bottom:8px">Supprimer les <b>constantes seules</b> conserve la trace des soins faits — utile pour un patient mesuré tous les jours. Documents, bilans et rappels ne sont jamais touchés.</p>
<p class="small" style="margin-bottom:8px">Pour <b>réimporter</b> une archive JSON : 💾 Mes données → 📂 Importer. L'app te propose de choisir, patient par patient, ce que tu veux réintégrer — les passages déjà présents sont ignorés.</p>

<div class="cat-head">📦 Mettre un dossier de côté</div>
<p class="small" style="margin-bottom:8px">À ne pas confondre : <b>📦 Mettre de côté</b> retire le dossier du Moniteur mais <b>ne produit aucun fichier</b> — tout reste dans l'app, récupérable. Pour un <b>fichier</b>, utilise <b>📄 Exporter la fiche</b> (un patient) ou <b>🧹 Ménage</b> (plusieurs patients, par période).</p>

<div class="cat-head">📅 Vue Journée</div>
<p class="small" style="margin-bottom:8px">À côté de <b>☀️ Matin</b> et <b>🌙 Soir</b>, un bouton <b>📅 Journée</b> affiche <b>toute la tournée</b> en deux sections repliables. Chaque section indique son avancement (« 1 vu · 1 à voir ») et se replie d'un tap — pratique pour fermer le matin une fois terminé. Les quatre compteurs du haut portent alors sur la journée entière.</p>

<div class="cat-head">🩺 Santé de l'application</div>
<p class="small" style="margin-bottom:8px">Dans <b>Réglages → Données</b>, cet écran montre l'état réel de tes données : nombre de patients et de passages, place occupée, dernière sauvegarde.</p>
<p class="small" style="margin-bottom:8px">L'<b>intégrité</b> repère les incohérences — une tournée supprimée mais encore référencée, un rappel qui pointe vers un dossier disparu. Les <b>incidents</b> gardent la trace des erreurs techniques.</p>
<div class="tip">Ce journal ne contient <b>aucune donnée patient</b> : seulement la date, l'origine et le message technique.</div>

<div class="cat-head">🩹 Le suivi de plaie</div>
<p class="small" style="margin-bottom:8px">Tout se passe <b>dans la carte du patient</b>, entre les constantes et la transmission. S'il n'y a rien, une seule ligne : <b>🩹 Déclarer une plaie</b>. Sinon, chaque plaie ouverte s'affiche avec sa durée et un bouton 📷 pour ajouter une photo sans rien ouvrir.</p>
<p class="small" style="margin-bottom:8px">À la création : un <b>type</b> (escarre, ulcère, plaie chirurgicale…) et une <b>localisation</b>. Les cinq plus courantes sont en accès direct ; pour le reste, un <b>schéma du corps</b> — dos et face — où <b>chaque partie se colore quand on la touche</b>, avec la liste complète en dessous. Le bouton ⛶ agrandit le schéma.</p>
<p class="small" style="margin-bottom:8px">Le <b>stade</b> et les <b>mesures</b> sont facultatifs.</p>
<div class="tip">L'app <b>enregistre, elle n'interprète pas</b>. Aucune alerte du type « plaie qui se dégrade » : les photos côte à côte suffisent, et l'évaluation reste la tienne.</div>
<p class="small" style="margin-bottom:8px">Une plaie refermée se déclare <b>✓ Cicatrisée</b>. Elle passe alors dans la seconde liste, avec sa durée totale. Les plaies ouvertes figurent dans la relève — le collègue sait qu'il y en a une et depuis quand.</p>

<div class="cat-head">📎 Nommer les documents</div>
<p class="small" style="margin-bottom:8px">Chaque document ajouté demande un <b>type</b> et une <b>précision</b>. Sans les deux, il ne peut pas être enregistré. Cinq familles : prescriptions, résultats, suivi de soin, administratif, et <b>libre</b> pour tout le reste.</p>
<p class="small" style="margin-bottom:8px">Le nom se compose seul avec la date : <code>2026-09-08_Ordo-medecin_Renouvellement</code>. Il est <b>identique d'un appareil à l'autre</b>.</p>
<div class="tip">C'est ce qui rend la <b>synchronisation</b> utile : l'app compare des types datés au lieu de noms de fichiers. « Tu as déjà une ordo médecin du 3 sept. » — tu sais quoi garder, remplacer ou ignorer.</div>
<p class="small" style="margin-bottom:8px"><b>Photos :</b> l'app propose d'en faire un PDF — plusieurs pages en un fichier, environ 85 % plus léger. Sauf pour une <b>photo de plaie</b>, où les images sont conservées : le zoom sert au suivi.</p>
<p class="small" style="margin-bottom:8px">Les documents ajoutés avant cette version portent une pastille <b>à qualifier</b>. Rien n'est imposé rétroactivement.</p>

<div class="cat-head">🔁 Le bouton J-1</div>
<p class="small" style="margin-bottom:8px">Il reprend le passage précédent <b>du même créneau</b> : le matin, il ressort le matin de la veille ; le soir, le soir de la veille. Sans quoi le pilulier du soir et le coucher se retrouvaient dans un passage du matin.</p>
<div class="tip">Si le patient n'a pas été vu hier dans ce créneau, l'app remonte au <b>dernier passage du même créneau</b>, même s'il date de plusieurs jours. Le plan du matin reste le plan du matin.</div>

<div class="cat-head">📋 La fiche de recueil</div>
<p class="small" style="margin-bottom:8px">Chez le patient, naviguer entre les onglets fait perdre du temps et oublier des champs. La fiche de recueil présente <b>tout à la suite</b> — identité, domicile, accès, qui prévenir, professionnels, ce qu'il faut savoir. Une barre d'avancement indique ce qui manque.</p>
<p class="small" style="margin-bottom:8px">Accès : <b>✏️ Fiche → ⚡ Actions → 📋 Fiche de recueil</b>. L'app la propose aussi juste après la création d'un dossier.</p>
<div class="tip">Ce n'est pas un document séparé : <b>c'est le dossier lui-même, présenté autrement</b>. Ce que tu écris ici apparaît dans l'onglet Infos, et le DLU le reprend comme d'habitude. Impossible que les deux divergent.</div>
<p class="small" style="margin-bottom:8px">Deux impressions : <b>🖨 Remplie</b> donne une page dense pour le classeur du domicile — utile au remplaçant qui ne connaît pas le patient. <b>📄 Fiche vierge</b> imprime trois pages avec des cases à lettres, que le patient ou sa famille remplit à la main.</p>

<div class="cat-head">🎙 La note vocale</div>
<p class="small" style="margin-bottom:8px">Sur l'écran d'envoi de la relève, après avoir relu le texte : <b>🎙 Ajouter une note vocale</b>. Deux notes de <b>3 minutes</b> au maximum, entièrement facultatives.</p>
<p class="small" style="margin-bottom:8px">Avant d'envoyer, tu peux <b>l'écouter</b>, l'effacer pour la refaire, ou la compléter par une seconde. Après envoi, elle reste écoutable dans <b>📨 Journal des envois</b>.</p>
<div class="warn">Une mention est jointe au message : « <i>Contient des données de santé couvertes par le secret professionnel. Ne pas rediffuser.</i> » Elle engage celui qui reçoit — mais <b>l'app ne peut rien effacer chez lui</b>.</div>
<p class="small" style="margin-bottom:8px">L'effacement sur <b>ton</b> appareil se règle dans <b>💾 Mes données</b> : après envoi, 7 jours, 30 jours, ou à la main.</p>

<div class="cat-head">🎂 Les anniversaires</div>
<p class="small" style="margin-bottom:8px">Quand la date de naissance est renseignée, une pastille <b>🎂</b> apparaît sur la carte du patient, dans le déroulé et dans la relève.</p>
<div class="tip">Elle sort <b>3 jours avant</b> et reste <b>jusqu'au lendemain</b> : tu peux souhaiter au passage d'avant ou d'après si tu ne viens pas le jour même. Ton collègue la voit aussi dans la relève.</div>

<div class="cat-head">💩 La surveillance des selles</div>
<p class="small" style="margin-bottom:8px">Dans les <b>constantes</b>, une rangée <b>0 · + · ++ · +++ · ++++ · 💧 Diarrhée</b>. Un tap pour noter, un second sur le même bouton pour effacer.</p>
<p class="small" style="margin-bottom:8px"><b>0 est une valeur</b> — « pas de selle aujourd'hui » — et non l'absence de saisie. C'est cette distinction qui permet l'alerte.</p>
<p class="small" style="margin-bottom:8px">Au-delà de <b>3 jours consécutifs à 0</b>, l'app signale « 💩 4 j sans selle » sur la carte et dans la relève. Le délai se règle par patient dans <b>✏️ Fiche → 💉 Soins</b> : le transit varie, 5 jours peut être la norme pour certains.</p>
<div class="tip">Un jour <b>non renseigné remet le compteur à zéro</b>. Mieux vaut rater une alerte que d'en lever une fausse sur des données qu'on n'a pas.</div>

<div class="cat-head">📉 Les tendances</div>
<p class="small" style="margin-bottom:8px">Les seuils alertent quand <b>une</b> constante sort des bornes. Mais une dégradation lente peut passer inaperçue : six pesées toutes au-dessus du seuil, et pourtant <b>2,4 kg perdus en trois semaines</b>.</p>
<p class="small" style="margin-bottom:8px">L'onglet <b>📋 Infos</b> signale ces dérives pour le <b>poids</b> et la <b>tension</b>. Il faut au moins <b>4 mesures sur 14 jours</b> — sinon c'est du bruit, et rien ne s'affiche.</p>
<div class="tip">C'est un <b>constat</b>, pas un diagnostic. L'app dit « le poids a baissé de 2,4 kg » — l'interprétation t'appartient.</div>

<div class="cat-head">✏️ La consigne des feuilles domicile</div>
<p class="small" style="margin-bottom:8px">Chaque feuille porte en bas une <b>consigne</b> — les seuils d'alerte pour les constantes, la conduite à tenir pour le poids ou les glycémies. Elle reprend automatiquement les seuils réglés pour ce patient.</p>
<p class="small" style="margin-bottom:8px">Tu peux la <b>modifier avant d'imprimer</b> : « Prévenir le fils au 06… avant le médecin », par exemple. Deux boutons pour revenir au texte d'origine ou n'afficher <b>aucune consigne</b>.</p>
<div class="tip">La modification est <b>ponctuelle</b> : elle vaut pour cette impression. Rouvrir l'écran repart du texte par défaut.</div>

<div class="cat-head">🗑 Retirer un soin</div>
<p class="small" style="margin-bottom:8px"><b>Pendant un passage</b> : appui long sur un soin → un menu propose de le commenter, d'effacer son commentaire, et — s'il a été ajouté à la volée — de le <b>retirer de ce passage</b>. Un soin du plan ne se retire pas : il se décoche.</p>
<p class="small" style="margin-bottom:8px"><b>Dans le catalogue</b> : le 🗑 retire un soin de la liste. Si tu l'as déjà employé, l'app te le dit — « utilisé dans 3 passages et 1 plan ».</p>
<div class="tip">Retirer un soin du catalogue ne touche <b>jamais</b> l'historique : les passages enregistrés gardent le texte du soin tel qu'il a été saisi ce jour-là. Seule la liste de choix perd la ligne, et le plan de soins des patients est nettoyé.</div>

<div class="cat-head">📌 Un rappel fait devient une information</div>
<p class="small" style="margin-bottom:8px">Quand tu coches un rappel, l'app te propose de <b>noter le résultat dans la relève</b>. Le texte est pré-rempli à partir du rappel — « Récupérer le médicament » devient « Récupéré : le médicament » — tu n'as qu'à valider ou l'ajuster.</p>
<p class="small" style="margin-bottom:8px">La relève affiche alors <b>✅ ce qui est fait</b> à côté de <b>📌 ce qui reste à faire</b>. Ton collègue sait que c'est réglé, au lieu de ne plus rien voir.</p>
<div class="tip">L'information <b>reste jusqu'à ce que tu la supprimes</b>, dans la section « Notés dans la relève » de l'écran Rappels. Laisse le champ vide pour classer un rappel sans rien noter.</div>

<div class="cat-head">🏷️ Commenter une pastille</div>
<p class="small" style="margin-bottom:8px"><b>Appui long</b> sur une pastille active (👁️ À surveiller, 🔴 Prioritaire, 🩺 Médecin contacté) pour préciser — comme pour un soin. Un <b>💬</b> apparaît, et le texte part dans la relève : « 🩺 Médecin contacté (hier) — Dr Blanc prévenu de la TA ».</p>
<p class="small" style="margin-bottom:8px"><b>🩺 Médecin contacté</b> retient sa date. La relève indique l'ancienneté, et la pastille <b>s'atténue au bout de trois jours</b> — ton collègue distingue ce qui est frais de ce qui traîne. Rien ne disparaît pour autant.</p>
<p class="small" style="margin-bottom:8px">La pastille <b>Matériel à apporter</b> a été retirée : c'était un rappel déguisé, sans échéance ni disparition une fois fait. Celles déjà cochées sont <b>converties en rappels</b>, rien n'est perdu.</p>

<div class="cat-head">📋 Choisir le type d'une information</div>
<p class="small" style="margin-bottom:8px">Le bouton <b>＋ Ajouter une information</b> ouvre la <b>grille des six types</b> : accès, vigilance, traitement, antécédents, entourage, autre. Tu choisis d'abord, la ligne se crée au bon type.</p>
<p class="small" style="margin-bottom:8px">Sur une information existante, la <b>pastille du type</b> (avec son ▾) rouvre la même grille pour en changer — le texte saisi est conservé, seule la couleur change.</p>

<div class="cat-head">🏁 La fin de tournée</div>
<p class="small" style="margin-bottom:8px">À la fin du déroulé ▶, un <b>récapitulatif</b> s'affiche : nombre de passages, plage horaire, constantes hors seuils. Chaque passage est <b>modifiable</b> — un tap sur ✏️ rouvre la carte du patient.</p>
<p class="small" style="margin-bottom:8px">Le déroulé <b>reprend toujours au premier patient non encore vu</b>. Si tu le quittes en cours de route et que tu le relances, tu repars là où tu en étais. Et si tous les patients sont déjà vus, l'écran de fin s'affiche directement.</p>

<div class="cat-head">💊 La fiche de traitement</div>
<p class="small" style="margin-bottom:8px">Fiche patient → onglet <b>📋 Infos</b> → <b>💊 Fiche de traitement</b>. Une <b>ligne par médicament</b>, avec sa posologie répartie sur quatre moments : <b>matin · midi · soir · coucher</b>. Un tap sur ✏️ ouvre la ligne pour l'ajuster quand le médecin change la prescription.</p>
<p class="small" style="margin-bottom:8px">Pour chaque médicament tu peux préciser sa <b>forme</b> (comprimé, injectable, gouttes, patch) et une <b>remarque</b> (« à jeun », « pendant le repas »). Les traitements <b>« si besoin »</b> ont leur propre section — tu décris la conduite dans les remarques (« si douleur &gt; 4, max 3/jour »).</p>
<p class="small" style="margin-bottom:8px">La fiche <b>s'imprime</b> ou se partage : un tableau clair à laisser chez le patient, avec la date de mise à jour, les vigilances et le prescripteur. Les <b>anticoagulants sont repérés automatiquement</b> et signalés en rouge.</p>
<p class="small" style="margin-bottom:8px">Le <b>DLU</b> et la <b>relève</b> reprennent cette fiche dès qu'elle contient un médicament. Si tu avais renseigné le traitement en <b>texte libre</b>, il reste en place tant que tu ne l'as pas ressaisi — il te sera rappelé en haut de l'écran.</p>

<div class="cat-head">☀️🌙 Un plan de soins différent matin et soir</div>
<p class="small" style="margin-bottom:8px">Dans l'onglet <b>💉 Soins</b> de la fiche, chaque soin du plan a deux cases : <b>☀️</b> et <b>🌙</b>. Coche celle du créneau où le soin doit être proposé. La toilette au matin, l'injection du soir, le pilulier aux deux.</p>
<p class="small" style="margin-bottom:8px"><b>Aucune case cochée = le soin est proposé aux deux créneaux</b> — c'est le comportement d'origine, rien ne change si tu ne précises rien. Et si tu n'utilises pas les créneaux Matin/Soir, la liste reste comme aujourd'hui.</p>
<p class="small" style="margin-bottom:8px">À la saisie, tu ne vois plus que les soins du créneau en cours. Un remplaçant sait exactement ce qui est attendu à <b>ce passage-là</b>. Tu peux toujours ajouter un soin à la volée (libre ou depuis le catalogue) et le commenter par appui long.</p>

<div class="cat-head">👤 La fiche patient en 4 onglets</div>
<p class="small" style="margin-bottom:8px"><b>👤 Identité</b> (état civil, n° sécu, adresse, tournées, personne à prévenir, annuaire) · <b>📋 Infos</b> (informations typées, appareillages) · <b>💉 Soins</b> (plan de soins, seuils personnalisés) · <b>⚡ Actions</b> (DLU, feuilles, export, fin de PEC, archiver, supprimer). Chaque onglet a sa couleur — plus besoin de faire défiler pour changer une ligne.</p>

<div class="cat-head">✏️ Modifier un passage déjà validé</div>
<p class="small" style="margin-bottom:8px">La patiente demande un soin de plus après ta validation ? <b>Rouvre simplement sa carte</b> : tu retrouves les soins cochés, les constantes et la transmission. Tu ajoutes ou retires ce qu'il faut, le bouton devient <b>✓ Enregistrer les modifications</b>. L'heure d'origine est conservée, aucun doublon n'est créé.</p>
<p class="small" style="margin-bottom:8px">Et si un passage part trop vite, le message de confirmation propose <b>Annuler</b> pendant quelques secondes.</p>

<div class="cat-head">🗓️ Rythme d'un soin (facultatif)</div>
<p class="small" style="margin-bottom:8px"><b>Appui long</b> sur un soin du plan pour préciser son rythme : « quotidien », « lundi », « 2×/semaine »… Il s'affiche ensuite à côté du soin, à la saisie comme dans la fiche. Entièrement facultatif — un remplaçant sait ainsi ce qui est attendu ce jour-là.</p>

<div class="cat-head">🖨️ Feuilles à laisser au domicile</div>
<p class="small" style="margin-bottom:8px">Fiche patient → <b>🖨️ Feuilles domicile</b>. Trois feuilles <b>vierges</b>, déjà à l'en-tête du patient, à remplir à la main par tous les intervenants : <b>📊 Constantes</b> (avec colonne douleur /10) · <b>⚖️ Poids</b> (date libre + courbe à tracer) · <b>🩸 Glycémies</b> (matin/midi/soir avec doses d'insuline).</p>
<p class="small" style="margin-bottom:8px">Format A4, <b>grille mensuelle</b> : les jours 1 à 31 sont pré-imprimés, tu écris le mois en haut. Les <b>seuils d'alerte</b> figurent en bas — ceux du patient s'ils sont personnalisés dans sa fiche, sinon des repères généraux.</p>
<p class="small" style="margin-bottom:8px">Deux densités : <b>Serrée</b> (les 31 jours au recto seul) ou <b>Confortable</b> (jours 1-16 au recto, 17-31 au verso, lignes deux fois plus hautes — imprime en <b>recto-verso</b> pour garder une seule feuille par mois).</p>

<div class="cat-head">📄 Exporter l'historique des constantes</div>
<p class="small" style="margin-bottom:8px">Carte patient → <b>📈 Courbes</b> → <b>📄 Exporter l'historique</b>. Le document réunit les <b>courbes d'évolution</b> (avec les seuils en pointillés et les valeurs hors norme pointées en rouge) et le <b>tableau détaillé</b> de tous les relevés. Période au choix (15 jours à 1 an), en <b>PDF</b>, <b>HTML</b> ou <b>texte</b> — pratique pour un envoi au médecin.</p>

<div class="cat-head">🚑 DLU — Dossier de liaison d'urgence</div>
<p class="small" style="margin-bottom:8px">Un patient part à l'hôpital depuis son domicile ? Ouvre sa <b>fiche</b> → bouton rouge <b>🚑 DLU urgence</b>. Le document est <b>déjà pré-rempli</b> avec ce que contient sa fiche : identité, n° de sécurité sociale, adresse et code d'accès, personne à prévenir, médecin, allergies, traitement, antécédents, appareillages.</p>
<p class="small" style="margin-bottom:8px">Il ne te reste qu'à renseigner l'<b>autonomie</b> (elle évolue, donc vierge à chaque fois), les <b>constantes du moment</b> et le <b>motif</b> — ce qui vient de se passer. Le champ de motif s'agrandit autant que nécessaire, le document passe sur plusieurs pages.</p>
<p class="small" style="margin-bottom:8px">Trois façons de le transmettre, selon la situation : <b>👁 Afficher</b> (montre ton téléphone à l'ambulancier — le plus rapide) · <b>📤 Partager</b> (mail, WhatsApp, messagerie) · <b>🖨️ Imprimer</b>.</p>
<p class="small" style="margin-bottom:8px">Le document met en tête un <b>bandeau rouge de vigilances</b> : allergies, appareillages, et la mention <b>« sous anticoagulant »</b> détectée automatiquement dans le traitement. Les constantes hors seuils apparaissent en rouge. C'est ce qu'un urgentiste doit voir en trois secondes.</p>

<div class="cat-head">💾 Enregistrer sans valider le passage</div>
<p class="small" style="margin-bottom:8px">Sous chaque carte patient, trois boutons : <b>Annuler</b> (abandonne, avec confirmation si tu as saisi quelque chose) · <b>💾 Enregistrer</b> · <b>✓ Valider le passage</b>.</p>
<p class="small" style="margin-bottom:8px"><b>💾 Enregistrer</b> conserve ta saisie <b>durablement</b> sans marquer le passage : utile quand le médecin te transmet une information avant ton passage, ou quand tu penses à quelque chose après coup. Le patient reste « à voir », un repère <b>💾 saisie en attente</b> apparaît sur sa carte, et tu retrouves tout en rouvrant la carte pour compléter puis valider.</p>
<p class="small" style="margin-bottom:8px"><b>Doublon évité</b> : si tu valides un passage alors que le patient en a déjà un aujourd'hui sur le même créneau, l'app te propose de <b>compléter</b> le passage existant plutôt que d'en créer un second. Les deux restent possibles.</p>

<div class="cat-head">↩️ Revenir en arrière</div>
<p class="small" style="margin-bottom:8px">Trois façons, au choix : le bouton <b>‹ suivi du nom</b> en haut à gauche (il indique où tu reviens) · le <b>bouton retour de ton téléphone</b> · ou <b>glisser la poignée vers le bas</b> pour fermer la feuille. Le <b>✕</b> en haut à droite ferme tout d'un coup et ramène au Moniteur.</p>

<div class="cat-head">⚡ Gestes rapides</div>
<p class="small" style="margin-bottom:8px"><b>🎤 flottant</b> : dictée rapide → dicte puis affecte au patient en un tap. <b>▶ Déroulé</b> : parcourt la tournée patient par patient (chaque passage est enregistré en avançant). <b>🏁</b> : clôt la tournée. <b>Swipe droite</b> sur une carte : RÀS instantané.</p>
<div class="cat-head">🖨️ Exporter une fiche patient</div>
<p class="small" style="margin-bottom:8px">Fiche patient → <b>🖨️ Exporter la fiche</b>. Tu coches <b>ce qui doit y figurer</b> (identité, accès, vigilance, traitement, antécédents, entourage, plan de soins, contacts, bilans, rappels, historique) et <b>quels documents intégrer</b>, puis tu choisis le format : <b>📑 PDF</b> · <b>🌐 HTML</b> · <b>📝 Word</b>. Le bouton <b>🖨️ Imprimer</b> ouvre directement la boîte d'impression (d'où tu peux aussi enregistrer en PDF).</p>
<p class="small" style="margin-bottom:8px">Pratique pour transmettre une fiche complète à un remplaçant, ou une version allégée à un médecin. Les photos et PDF cochés sont <b>intégrés</b> au document.</p>

<div class="cat-head">🎗️ Fin de prise en charge</div>
<p class="small" style="margin-bottom:8px">Quand les soins d'un patient se terminent : fiche patient → <b>🎗️ Fin de prise en charge</b>. Tu indiques la date, un motif si tu veux, et la <b>durée de conservation</b> du dossier (3, 6, 9 ou 12 mois).</p>
<p class="small" style="margin-bottom:8px">Le patient <b>sort automatiquement de tes tournées</b> et du Moniteur, mais la <b>relève couvrant sa date de fin le mentionne</b> — ton collègue est informé. Son dossier reste consultable dans <b>🗺️ → 🎗️ Prises en charge terminées</b> et trouvable par la <b>recherche 🔍</b>. Depuis cette liste tu peux le rouvrir, ou le <b>supprimer définitivement</b> (double confirmation, sans passage par la corbeille).</p>

<p class="small" style="margin-bottom:8px">Dans le déroulé, le bouton <b>🚫 Pas de passage prévu aujourd'hui</b> saute le patient <b>sans créer de passage</b> : il n'apparaîtra pas dans la relève. Sur le Moniteur il prend une pastille grise « pas de passage prévu » (valable pour la journée seulement) et n'est plus compté dans « À voir ». À utiliser quand ce n'est simplement pas ton jour de passage (1 jour sur 2, etc.) — c'est différent d'une <b>absence</b>, qui est un vrai événement à transmettre.</p>

<div class="cat-head">📝 Générer et envoyer la relève</div>
<p class="small" style="margin-bottom:8px">La relève va à l'essentiel. Sur toute la période demandée, si le plan de soins a été suivi sans particularité, elle indique <b>une seule fois « ✅ Plan de soins respecté »</b> — même sur une semaine de passages matin et soir.</p>
<p class="small" style="margin-bottom:8px">Ne ressort ensuite que ce qui demande une lecture, <b>daté et situé</b> (matin/soir) : les soins <b>commentés</b> (💬), les soins <b>non prévus au plan</b> (➕) et tes <b>transmissions</b> (📝).</p>
<p class="small" style="margin-bottom:8px"><b>📊 Constantes</b> : elles sont <b>toujours enregistrées</b> dans l'historique du patient (utile en cas d'urgence ou pour le médecin), mais ne figurent dans la relève <b>que si tu coches « 📤 Inclure dans la relève »</b> lors du passage. C'est toi qui juges de leur pertinence.</p>
<p class="small" style="margin-bottom:8px"><b>📋 Mode DARD</b> : quand tu l'actives sur un passage (chute, aggravation, incident), la transmission apparaît dans la relève en <b>bloc structuré mis en évidence</b>, daté et situé. Les autres patients gardent la présentation normale.</p>
<p class="small" style="margin-bottom:8px"><b>🩺 Synthèse ciblée</b> : pour transmettre à un médecin ou un service. Tu choisis <b>quels patients</b> inclure (cases à cocher) <b>et quelles données</b> y faire figurer (soins, événements, constantes, transmissions, bilans, rappels, historique). Seuls les patients cochés apparaissent — indispensable pour la confidentialité.</p>
<p class="small" style="margin-bottom:8px">Dans l'aperçu, deux boutons enrichissent le document : <b>✍️ Signer</b> (ta signature manuscrite apparaît en bas du PDF, du HTML et du Word) et <b>💬 Message</b> (un mot libre présenté dans un encart en fin de relève, avec ton nom et l'heure). Les deux repartent à zéro à chaque nouvelle relève.</p>
<p class="small" style="margin-bottom:8px">Tape <b>📝 Éditer une relève</b> (barre du bas) → période, tournée, mode. Puis choisis le format : <b>🗒️ Texte · 📑 PDF · 🌐 HTML · 📝 Word</b>, coche les <b>documents à joindre</b> (intégrés en annexes cliquables dans PDF/HTML), <b>✏️ modifie le texte</b> si besoin, et <b>📤 Envoie</b> via le menu Android.</p>

<div class="cat-head">💾 vs 🔄 — quelle différence ?</div>
<p class="small" style="margin-bottom:8px"><b>💾 Sauvegarde</b> = <b>toutes</b> tes données (patients, passages, réglages, catalogues) dans un fichier. C'est ta protection en cas de perte, et le moyen de passer du téléphone au PC.<br>
<b>🔄 Synchro</b> = <b>uniquement tes changements récents</b>, signés de ton nom, pour mettre à jour l'app d'un collègue sans toucher à son ordre de passage ni à son thème.</p>
<p class="small" style="margin-bottom:8px">Les deux sont complémentaires, sans conflit. <b>Premier échange avec un collègue :</b> envoie-lui une <b>sauvegarde</b> pour partir de la même base ; ensuite, la <b>synchro</b> suffit au quotidien. Si tu te trompes de bouton, l'app reconnaît le type de fichier et applique le bon traitement.</p>

<div class="cat-head">🔄 Partage avec un collègue</div>
<p class="small" style="margin-bottom:8px"><b>🔒 Cloisonnement par cabinet.</b> Un fichier de synchro ne contient <b>que les patients du cabinet choisi</b> : ceux de tes autres cabinets n'y figurent pas. Les <b>rappels du cabinet</b> et ceux de ses patients partent avec ; tes rappels <b>personnels</b> ne quittent jamais ton appareil.</p>
<p class="small" style="margin-bottom:8px"><b>📎 Documents</b> : aucun n'est joint par défaut, pour ne pas alourdir. Tu coches patient par patient ce qui est utile, avec le poids total affiché en direct.</p>
<p class="small" style="margin-bottom:8px"><b>📥 À la réception</b>, tu choisis document par document ce que tu gardes. <b>Tes fichiers ne sont jamais remplacés</b> : si ton collègue t'envoie un document portant le même nom, les deux dates te sont montrées et le fichier reçu est ajouté <b>à côté</b> du tien, renommé pour les distinguer.</p>

<p class="small" style="margin-bottom:8px">Envoie le <b>fichier dynamique de tournée</b> (bouton dans l'écran relève, ou 🗺️ → Partage). Ton collègue le reçoit avec <b>📥 Recevoir</b> : un écran lui résume les changements, il tranche les éventuels <b>conflits</b> et accepte les <b>plans de soins</b> modifiés.</p>
<p class="small" style="margin-bottom:8px"><b>🆕 Nouveaux patients</b> : si ton collègue fait une admission, le dossier arrive avec son <b>plan de soins</b> — tu l'ajoutes ou l'ignores. <b>🗑 Suppressions</b> : elles te sont proposées mais <b>refusées par défaut</b> ; si tu acceptes, le dossier part dans <b>ta corbeille</b> (récupérable 30 jours). Rien n'est jamais supprimé sans ton accord. Son ordre de passage, son thème et ses réglages restent intacts. Les <b>countdowns des rappels se recalculent</b> chez lui.</p>

<div class="cat-head">↩︎ Revenir en arrière</div>
<p class="small" style="margin-bottom:8px"><b>🗺️ → 🕰️ Historique des synchros</b> : chaque synchro reçue a créé une sauvegarde d'avant. Bouton ↩︎ pour y revenir, 🗑 pour supprimer un point, 🧹 pour tout vider. La <b>🗑 Corbeille</b> garde 30 jours les patients supprimés.</p>

<div class="cat-head">📌 Bilans et rappels</div>
<p class="small" style="margin-bottom:8px">Un <b>bilan « À faire » daté</b> crée automatiquement son rappel 🧪 avec compte à rebours J-3 → <b style="color:var(--danger)">JOUR J</b>. Le passer à « Fait » clôt le rappel.</p>
<p class="small" style="margin-bottom:8px">Tape <b>📌</b> pour créer un rappel. Choisis d'abord une <b>catégorie</b> (💉 Soin ponctuel · 🧪 Bilan/Prélèvement · 📦 Pharmacie &amp; Matériel · 📋 Ordonnance &amp; Médecin · 🗓️ RDV &amp; Transport · 🚪 Absence patient · 📌 Autre) : des <b>précisions</b> apparaissent dessous (ex. « Pansement lourd », « ECBU », « Commande pilulier »). Tape l'une d'elles pour remplir le détail, puis <b>complète librement ✏️</b> — exemple : « Pansement lourd — sacrum, à refaire vendredi ». La dictée 🎤 fonctionne aussi.</p>

<div class="cat-head">💾 Sauvegarde et sécurité</div>
<p class="small" style="margin-bottom:8px">Données 100% locales et chiffrées, jamais de serveur. <b>🗺️ → Sauvegarde</b> : <b>💾 Enregistrer</b> (Fichiers ▸ Téléchargements ▸ JMSante) · <b>📤 Partager</b> (Drive, mail, PC) · <b>📂 Importer</b>. À l'import, tu choisis <b>🔀 Fusionner</b> (ajoute sans rien supprimer — recommandé, notamment entre téléphone et PC) ou <b>♻️ Remplacer tout</b> (restauration après perte). Une sauvegarde de sécurité est créée dans les deux cas. <b>Code PIN</b> et <b>empreinte</b> dans 🗺️ → Sécurité. <b>Sauvegarde souvent</b> — un indicateur t'alerte au-delà de 7 jours.</p>

<div class="cat-head">📋 Catalogues</div>
<p class="small" style="margin-bottom:8px"><b>Soins</b> : 🗺️ → Catalogue. Ajoute un soin en choisissant sa catégorie (ou en créant une nouvelle), renomme par <b>appui long</b> ou ✏️. <b>Phrases types</b> : 🗺️ → 💬. Ajoute tes formulations, crée des catégories, modifie par <b>appui long</b>.</p>
</div>
<div style="border-top:1px solid var(--border);margin-top:14px;padding-top:12px">
  <p class="small muted" style="margin-bottom:8px">📘 <b>Mode d'emploi complet illustré</b> — toutes les fonctions détaillées, avec captures d'écran. À garder sous la main ou à transmettre à un collègue.</p>
  <div class="rowb">
    <button class="btn btn-ghost" id="guide-dl-html">🌐 Télécharger (HTML)</button>
    <button class="btn btn-ghost" id="guide-dl-pdf">📑 Ouvrir pour PDF</button>
  </div>
</div>`);
    const dlH = $("#guide-dl-html"); if (dlH) dlH.onclick = () => downloadManuel("html");
    const dlH2 = $("#guide-dl-html2"); if (dlH2) dlH2.onclick = () => downloadManuel("html");
    const dlP2 = $("#guide-dl-pdf2");  if (dlP2) dlP2.onclick = () => downloadManuel("pdf");
    const dlP = $("#guide-dl-pdf");  if (dlP) dlP.onclick = () => downloadManuel("pdf");
    { const _e = $("#guide-close"); if (_e) _e.onclick = sheetTours; }; }
  { const _e = $("#go-catalog"); if (_e) _e.onclick = sheetCatalog; }
  { const _e = $("#bk-imp"); if (_e) _e.onclick = () => $("#backupfile").click(); }
  { const _e = $("#go-arch"); if (_e) _e.onclick = sheetArchives; }
  { const _e = $("#go-menage"); if (_e) _e.onclick = () => sheetMenage(null); }
}

/* ---------- Sous-écrans du menu ----------
   Chaque rubrique est un écran construit explicitement : plus fiable qu'un
   masquage dynamique, et chaque bloc reste lisible. Les gestionnaires sont
   posés par bindMenuHandlers(), commun à tous les écrans. */
function menuSheet(title, inner, sub){
  openSheet(`
    ${navHeader("Réglages", true)}
    <h3 style="margin-bottom:${sub?"2px":"12px"}">${title}</h3>
    ${sub?`<p class="small muted" style="margin-bottom:14px">${sub}</p>`:""}
    ${inner}`);
  bindNav(sheetTours);
  bindMenuHandlers();
}

/* 🗺️ Tournées */
function sheetToursList(){
  menuSheet("🗺️ Mes tournées", `
    <div id="tourlist">${S.tours.map(t => `
      <div class="rap"><span class="ric">🗺</span>
        <span style="flex:1"><div class="rt">${esc(t)}</div>
        <div class="rs">${activeP().filter(p=>(p.tours||[]).includes(t)).length} patient(s)</div></span>
        <button class="btn btn-ghost btn-sm" data-assign="${esc(t)}" style="flex:none" title="Gérer les patients">👥</button>
        <button class="btn btn-ghost btn-sm" data-deltour="${esc(t)}" style="flex:none">🗑</button>
      </div>`).join("") || `<p class="muted small" style="padding:8px 0">Aucune tournée — crée-en une ci-dessous.</p>`}</div>
    <div class="rowb" style="margin-top:12px">
      <input id="newtour" placeholder="Nouvelle tournée (ex : Cabinet Durand)">
      <button class="btn btn-primary btn-sm" id="addtour" style="flex:none">Ajouter</button>
    </div>
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <button class="btn btn-ghost" id="slot-toggle" style="width:100%;margin-bottom:8px">${S.slotsEnabled?"✓ Créneaux Matin/Soir activés":"Activer les créneaux Matin/Soir"}</button>
    <p class="small muted" style="margin-bottom:14px">Les créneaux permettent une composition et un ordre de passage différents le matin et le soir.</p>
    <button class="btn btn-ghost" id="go-route" style="width:100%">🖨️ Feuille de route imprimable</button>`,
    "Un cabinet = une tournée, avec son ordre de passage.");
}

/* 🔄 Partage */
function sheetSharePanel(){
  menuSheet("🔄 Partage & synchronisation", `
    <div class="rowb" style="margin-bottom:8px">
      <button class="btn btn-ghost" id="sync-send">📤 Envoyer la synchro</button>
      <button class="btn btn-ghost" id="sync-recv">📥 Recevoir</button>
    </div>
    <button class="btn btn-ghost" id="sync-hist" style="margin-bottom:10px;width:100%">🕰️ Historique des synchros (${(S.syncHistory||[]).length})</button>
    <p class="small muted">${S.identity ? "Identité : <b>"+esc(whoami())+"</b>" : "⚠ Définis ton identité pour partager"} · <a id="sync-id" style="color:var(--accent);text-decoration:underline">changer</a></p>
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <p class="small muted"><b>Synchro</b> = uniquement tes changements récents, pour mettre à jour un collègue. Pour un <b>premier échange</b>, envoie plutôt une <b>sauvegarde</b> complète (💾 Mes données).</p>`,
    "Mettre à jour l'application d'un collègue.");
}

/* 👥 Patients */
function sheetPatientsPanel(){
  const archived = S.patients.filter(p=>p.archived);
  menuSheet("👥 Mes patients", `
    <button class="btn btn-ghost" id="go-pec" style="width:100%;margin-bottom:8px">🎗️ Prises en charge terminées (${(S.patients||[]).filter(x=>x.pec).length})</button>
    <button class="btn btn-ghost" id="go-arch" style="width:100%;margin-bottom:8px">📦 Dossiers mis de côté (${archived.length})</button>
    <button class="btn btn-ghost" id="go-trash" style="width:100%">🗑 Corbeille (${(S.trash||[]).length})</button>`,
    "Dossiers clôturés, archivés ou supprimés.");
}

/* 💾 Données */
/* Poids réel des documents, lu depuis le stockage.
   Aide à repérer ce qu'il faut élaguer pour alléger les sauvegardes. */
async function fillBackupWeight(){
  const box = document.getElementById("bk-weight");
  if (!box) return;
  const per = [];
  let total = 0, count = 0;
  for (const p of (S.patients||[])){
    let ko = 0, n = 0;
    for (const d of (p.docs||[])){
      try {
        const data = await idbGet("doc_"+d.id);
        if (data){ ko += String(data).length * 0.75 / 1024; n++; }
      } catch(e){}
    }
    if (n){ per.push({ p, ko, n }); total += ko; count += n; }
  }
  if (!document.getElementById("bk-weight")) return;   // écran fermé entre-temps
  if (!count){ box.textContent = "Aucun document — sauvegarde légère."; return; }
  const fmt = k => k >= 1024 ? (k/1024).toFixed(1)+" Mo" : Math.round(k)+" Ko";
  per.sort((a,b) => b.ko - a.ko);
  const top = per.slice(0,3).map(x =>
    `${esc(x.p.nom.replace("Demo-","").toUpperCase())} (${fmt(x.ko)} · ${x.n} doc${x.n>1?"s":""})`).join(" · ");
  const heavy = total > 25*1024;
  box.innerHTML = `<b>${count} document(s) · ${fmt(total)}</b>` +
    (per.length ? `<br>Les plus lourds : ${top}` : "") +
    (heavy ? `<br><span style="color:var(--amber)">⚠ Sauvegarde volumineuse — supprime les documents devenus inutiles depuis les fiches patients, puis refais-en une.</span>` : "");
}

function sheetDataPanel(){
  const days = S.lastBackup ? Math.floor((Date.now()-S.lastBackup)/864e5) : null;
  const warn = (days === null || days >= 7);
  menuSheet("💾 Mes données", `
    ${warn?`<div class="tip" style="border-color:var(--amber);background:var(--amber-soft);margin-bottom:12px">⚠ ${days===null?"Aucune sauvegarde n'a encore été faite.":"Dernière sauvegarde il y a "+days+" jours."} Pense à en faire une régulièrement.</div>`:""}
    <span class="lab" style="display:block;margin-bottom:8px">💾 Sauvegarde</span>
    <div id="bk-weight" class="small muted" style="margin-bottom:10px">Calcul du poids des documents…</div>
    <div class="rowb" style="margin-bottom:8px">
      <button class="btn btn-ghost" id="bk-save">💾 Enregistrer</button>
      <button class="btn btn-ghost" id="bk-exp">📤 Partager</button>
      <button class="btn btn-ghost" id="bk-imp">📂 Importer</button>
    </div>
    <button class="btn btn-ghost" id="bk-dir" style="width:100%;margin-top:8px;justify-content:flex-start;gap:9px;text-align:left">
      <span>📁</span>
      <span style="flex:1;min-width:0">
        <span style="display:block;font-size:var(--fs-sm)">Dossier d'enregistrement</span>
        <span style="display:block;font-size:9.5px;color:var(--faint)">${esc(typeof dossierLabel === "function" ? dossierLabel() : "par défaut")}</span>
      </span>
      <span style="color:var(--accent);font-size:11px">${S.dossierSauvegarde ? "Changer" : "Choisir"}</span>
    </button>
    <p class="small muted" style="margin-bottom:16px">La sauvegarde contient <b>toutes</b> tes données. C'est ta protection en cas de perte, et le moyen de passer du téléphone au PC.</p>
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <span class="lab" style="display:block;margin-bottom:8px">🔒 Sécurité</span>
    ${S.pin
      ? `<button class="btn btn-ghost" id="pin-off" style="width:100%;margin-bottom:8px">🔓 Désactiver le code de verrouillage</button>`
      : `<button class="btn btn-ghost" id="pin-on" style="width:100%;margin-bottom:8px">🔒 Activer un code de verrouillage</button>`}
    ${S.pin ? (S.bioLock
      ? `<button class="btn btn-ghost" id="bio-off" style="width:100%;margin-bottom:8px">👆 Désactiver l'empreinte</button>`
      : `<button class="btn btn-ghost" id="bio-on" style="width:100%;margin-bottom:8px">👆 Déverrouiller par empreinte</button>`) : ""}
    <p class="small muted" style="margin-bottom:16px">Code à 4 chiffres demandé à l'ouverture.</p>
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <button class="btn btn-ghost" id="go-sendlog" style="width:100%">📨 Journal des envois (${(S.sendLog||[]).length})</button>
    ${typeof voicePossible === "function" && voicePossible() ? `
    <div class="rowlab vi" style="margin-top:12px"><span>Notes vocales</span><i></i>
      <em>${(S.voiceNotes||[]).length} conservée${(S.voiceNotes||[]).length>1?"s":""}</em></div>
    <div class="rowbox vi" style="display:block;margin-bottom:12px">
      <div class="small muted" style="margin-bottom:6px">Effacer de cet appareil…</div>
      <div class="rowb" style="gap:5px">
        ${[["envoi","après envoi"],["7","7 jours"],["30","30 jours"],["manuel","à la main"]]
          .map(([k,l])=>`<button class="chip ${(S.voiceRetention||"7")===k?"on":""}" data-vret="${k}" style="flex:1">${l}</button>`).join("")}
      </div>
      <p class="small muted" style="margin:7px 0 0;font-size:9.5px">L'app efface la note <b>de ton appareil</b>. Elle ne peut rien chez le destinataire.</p>
    </div>` : ""}
    <button class="btn btn-ghost" id="go-sante" style="width:100%;margin-top:8px">🩺 Santé de l'application${
      (S.incidents||[]).length ? ` <span class="warn">(${(S.incidents||[]).length} incident${(S.incidents||[]).length>1?"s":""})</span>` : ""}</button>`);
  fillBackupWeight();
}

/* 📋 Catalogues */
function sheetCatalogPanel(){
  const nPh = (S.phraseCats||[]).reduce((n,c)=>n+c.phrases.length,0);
  menuSheet("📋 Catalogues", `
    <button class="btn btn-ghost" id="go-catalog" style="width:100%;margin-bottom:8px">📋 Catalogue des soins</button>
    <button class="btn btn-ghost" id="go-phrases" style="width:100%">💬 Phrases types (${nPh})</button>`,
    "Personnalise les soins et les formulations que tu utilises.");
}

/* ⚙️ Application */
function sheetAppPanel(){
  menuSheet("⚙️ Application", `
    <span class="lab" style="display:block;margin-bottom:8px">🎨 Thème</span>
    <div class="chips" id="themepick" style="margin-bottom:16px">${Object.entries(APP_THEMES).map(([k,v]) => `
      <button class="chip ${S.theme===k?"on":""}" data-th="${k}"><span style="width:10px;height:10px;border-radius:50%;background:${v.dot};display:inline-block;margin-right:2px"></span>${v.lbl}</button>`).join("")}</div>
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <span class="lab" style="display:block;margin-bottom:8px">🧹 Conservation des données</span>
    <div class="chips" id="retpick" style="margin-bottom:8px">${[3,6,12].map(m => `
      <button class="chip ${S.retention===m?"on":""}" data-ret="${m}">${m} mois</button>`).join("")}</div>
    <p class="small muted" style="margin-bottom:10px">Les passages plus anciens sont supprimés automatiquement. Les bilans « À faire » et les documents ne sont jamais purgés.</p>
    <button class="btn btn-ghost" id="go-menage" style="width:100%;margin-bottom:8px">🧹 Ménage dans l'historique</button>
    <p class="small muted" style="margin-bottom:16px">Archive puis supprime les passages et constantes anciens, patient par patient si tu veux.</p>
    <div style="height:1px;background:var(--border);margin:16px 0"></div>
    <button class="btn btn-ghost" id="go-guide" style="width:100%;margin-bottom:8px">📖 Guide d'utilisation</button>
    <button class="btn btn-ghost" id="go-seed" style="width:100%;margin-bottom:8px">🎬 Recharger la démo</button>
    <button class="btn btn-ghost" id="go-wipe" style="width:100%;color:var(--danger)">🗑 Tout effacer</button>`);
}

/* Écrans à entrée directe (rubrique = un seul écran) */
function sheetSlots(){    sheetToursList(); }
function sheetTheme(){    sheetAppPanel(); }
function sheetClean(){    sheetAppPanel(); }
function sheetBackup(){   sheetDataPanel(); }
function sheetSecurity(){ sheetDataPanel(); }
function sheetArchives(){ sheetPatientsPanel(); setTimeout(()=>{ const b=document.getElementById("go-arch"); if(b) b.click(); }, 30); }
function sheetSendLog(){  sheetDataPanel(); setTimeout(()=>{ const b=document.getElementById("go-sendlog"); if(b) b.click(); }, 30); }
function sheetCatalog(){  sheetCatalogPanel(); setTimeout(()=>{ const b=document.getElementById("go-catalog"); if(b) b.click(); }, 30); }
function sheetPhrases(){  sheetCatalogPanel(); setTimeout(()=>{ const b=document.getElementById("go-phrases"); if(b) b.click(); }, 30); }
function sheetGuide(){    sheetAppPanel();     setTimeout(()=>{ const b=document.getElementById("go-guide"); if(b) b.click(); }, 30); }

/* ---------- Tournées / Archives / Nettoyage ---------- */

function sheetArchives(){
  const archived = S.patients.filter(p=>p.archived).sort((a,b)=>String(b.archived).localeCompare(String(a.archived)));
  openSheet(`
    ${navHeader("Patients", true)}
    <h3>📦 Dossiers mis de côté</h3>
    <p class="small muted" style="margin-bottom:12px">Ces dossiers ne sont plus dans le Moniteur ni dans les tournées, mais <b>rien n'a été supprimé</b>. Remets-en un en service avec ↩︎, ou supprime-le définitivement.</p>
    <p class="small muted" style="margin-bottom:10px">Dossiers conservés avec tout leur historique (passages, documents, bilans). Restaure un dossier pour le remettre en pancarte, ou supprime-le définitivement quand tu n'en as plus besoin.</p>
    <div id="archlist">${archived.map(p => `
      <div class="rap"><span class="ric">📦</span>
        <span style="flex:1"><div class="rt">${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</div>
        <div class="rs">archivé le ${esc(fmtFR(p.archived))} · ${p.visits.length} passage(s) · ${p.docs.length} doc(s) · ${(p.bilans||[]).length} bilan(s)</div></span>
        <button class="btn btn-ghost btn-sm" data-rest="${p.id}" style="flex:none">↩︎</button>
        <button class="btn btn-danger btn-sm" data-kill="${p.id}" style="flex:none">🗑</button>
      </div>`).join("") || `<p class="muted small" style="padding:8px 0">Aucun dossier archivé.</p>`}</div>
    `);
  $$("#archlist [data-rest]").forEach(b => b.onclick = () => {
    const pp = getP(b.dataset.rest);
    if (!pp){ toast("Dossier introuvable", "danger"); return; }
    pp.archived = null;

    /* Un dossier peut être archivé ET clôturé (fin de PEC). Ne lever que
       l'archivage le laissait invisible partout : hors du Moniteur (à cause
       de la PEC) et hors des Archives (plus archivé). */
    if (pp.pec){
      if (!confirm("Ce dossier a aussi une fin de prise en charge (" + fmtFR(pp.pec.end) + ").\n\n" +
          "OK : reprendre les soins — le patient redevient actif.\n" +
          "Annuler : le laisser en « prise en charge terminée ».")){
        save(); toast("Dossier désarchivé — reste en prise en charge terminée");
        sheetArchives(); render(); return;
      }
      delete pp.pec;
    }

    // Sans tournée, il n'apparaîtrait toujours pas sur le Moniteur
    if (!(pp.tours||[]).length && S.tours.length){
      pp.tours = [ S.tours.includes(S.curTour) ? S.curTour : S.tours[0] ];
      toast("Dossier restauré dans « " + pp.tours[0] + " » ↩︎");
    } else {
      toast("Dossier restauré ↩︎");
    }
    if (typeof logChange === "function") logChange("update","patient", pp.id, { archived:null, pec:null, tours:pp.tours });
    save(); sheetArchives(); render();
  });
  $$("#archlist [data-kill]").forEach(b => b.onclick = async () => {
    const p = getP(b.dataset.kill);
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce dossier ?", sub:esc(p.prenom)+" "+esc(p.nom), warn:"Il ira dans la corbeille, récupérable 30 jours.", oui:"🗑 Supprimer" })) return;
    trashPatient(p.id);
    save(true); toast("Dossier déplacé dans la corbeille 🗑"); sheetArchives(); render();
  });
  bindNav(sheetPatientsPanel);
}

function sheetClean(){
  const d90 = new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const count = before => S.patients.reduce((n,p)=>n+p.visits.filter(v=>v.date<before).length, 0);
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🧹 Nettoyer l'historique</h3>
    <p class="small muted" style="margin-bottom:12px">Supprime les passages antérieurs à une date, pour tous les patients (actifs et archivés). Les fiches, plans de soins, documents, bilans et rappels sont conservés. Pense à exporter une relève de la période avant si besoin.</p>
    <div class="field"><span class="lab">Supprimer les passages antérieurs au</span>
      <input id="cl-date" type="date" value="${d90}"></div>
    <p class="small muted" id="cl-count" style="margin-bottom:12px"></p>
    <div class="rowb">
      <button class="btn btn-ghost" id="cl-back">‹ Retour</button>
      <button class="btn btn-danger" id="cl-go">Supprimer ces passages</button>
    </div>`);
  const upd = () => { const n = count($("#cl-date").value||"0000"); $("#cl-count").textContent = n + " passage(s) concerné(s)."; $("#cl-go").disabled = !n; };
  $("#cl-date").onchange = upd; upd();
  $("#cl-back").onclick = sheetTours;
  $("#cl-go").onclick = () => {
    const before = $("#cl-date").value;
    const n = count(before);
    if (!confirm("Supprimer définitivement "+n+" passage(s) antérieur(s) au "+fmtFR(before)+" ?")) return;
    S.patients.forEach(p => p.visits = p.visits.filter(v=>v.date>=before));
    save(); toast(n+" passage(s) supprimé(s) 🧹"); sheetTours(); render();
  };
}

/* ---------- Fiche patient (création / édition + plan de soins libre) ---------- */
function sheetPatient(p){
  // Tolère un identifiant aussi bien qu'un objet : plusieurs appels
  // passaient un id, ce qui ouvrait une fiche vide (« nouveau patient »).
  if (typeof p === "string"){
    const found = (S.patients||[]).find(x => x.id === p);
    if (!found){ toast("Dossier introuvable", "danger"); return; }
    p = found;
  }
  const isNew = !p;
  p = p || { nom:"", prenom:"", dob:"", ctx:"", plan:[] };
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>${isNew?"Nouveau patient":"Fiche patient"}</h3>
    <div class="ftabs">
      <button class="ftab on" data-tab="id"><span class="ft-ic">👤</span><span>Identité</span></button>
      <button class="ftab"    data-tab="info"><span class="ft-ic">📋</span><span>Infos</span></button>
      <button class="ftab"    data-tab="soins"><span class="ft-ic">💉</span><span>Soins</span></button>
      ${isNew ? "" : `<button class="ftab" data-tab="act"><span class="ft-ic">⚡</span><span>Actions</span></button>`}
    </div>

    <div class="fpane on" data-pane="id">
    <div class="field"><span class="lab">Nom</span><input id="f-nom" value="${esc(p.nom)}" autocapitalize="characters"></div>
    <div class="field"><span class="lab">Prénom</span><input id="f-prenom" value="${esc(p.prenom)}"></div>
    <div class="field"><span class="lab">Date de naissance</span><input id="f-dob" type="date" value="${esc(p.dob)}"></div>
    <div class="field"><span class="lab">Genre</span>
      <div class="chips" id="f-genre">
        <button class="chip ${(p.genre||'')==='M'?'on':''}" data-g="M">M</button>
        <button class="chip ${(p.genre||'')==='F'?'on':''}" data-g="F">F</button>
        <button class="chip ${(p.genre||'')==='Autre'?'on':''}" data-g="Autre">Autre</button>
        <button class="chip ${!(p.genre)?'on':''}" data-g="">Non précisé</button>
      </div></div>
    <div class="field"><span class="lab">N° de sécurité sociale <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(pour le DLU)</span></span>
      <input id="f-nir" inputmode="numeric" placeholder="2 41 06 83 137 025 44" value="${esc(p.nir||'')}"></div>
    <div class="field"><span class="lab">Adresse <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(pour le GPS)</span></span>
      <input id="f-addr" placeholder="n° et rue" value="${esc(p.address||'')}">
      <div class="rowb" style="margin-top:6px">
        <input id="f-cp" inputmode="numeric" maxlength="5" placeholder="Code postal" value="${esc(p.cp||'')}" style="flex:0 0 40%">
        <input id="f-ville" placeholder="Ville" value="${esc(p.ville||'')}" style="flex:1">
      </div></div>

    <div class="rowlab ac" style="margin-top:4px"><span>Joindre le patient</span><i></i></div>
    <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="rowb">
        <div style="flex:1"><span class="lab" style="font-size:9px">☎️ Fixe</span>
          <input id="f-tel-fixe" inputmode="tel" placeholder="04 …" value="${esc((p.tel||{}).fixe||'')}"></div>
        <div style="flex:1"><span class="lab" style="font-size:9px">📱 Mobile</span>
          <input id="f-tel-mob" inputmode="tel" placeholder="06 …" value="${esc((p.tel||{}).mobile||'')}"></div>
      </div>
    </div>
    <div class="field"><span class="lab">Tournées</span>
      <div class="chips" id="f-tours">${S.tours.map(t =>
        `<button class="chip ${(p.tours||[]).includes(t)||(isNew&&S.curTour===t)?"on":""}" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
    <div class="field"><span class="lab">Personne à prévenir</span>
      <!-- Deux lignes : l'exemple « Nom et lien » ne tenait pas sur une
           demi-largeur et se coupait au milieu. -->
      <div style="display:flex;flex-direction:column;gap:6px">
        <input id="f-pap-nom" placeholder="Mme Martin, sa fille" value="${esc((p.prevenir||{}).nom||'')}">
        <input id="f-pap-tel" inputmode="tel" placeholder="Téléphone" value="${esc((p.prevenir||{}).tel||'')}">
      </div></div>
    <div class="field"><span class="lab">Annuaire d'urgence</span>
      <!-- ⚠️ Avant : deux colonnes, le nom recevait 71px face à 110px pour
           le téléphone. Un nom composé était coupé. Une ligne par contact
           donne 250px au nom, qui en a bien plus besoin qu'un numéro. -->
      <div style="display:flex;flex-direction:column;gap:9px">
        ${[["med","🩺 Médecin traitant"],["fam","👨‍👩 Famille / Confiance"],["pharma","💊 Pharmacie"],["cabinet","🗺️ Cabinet titulaire"]].map(([k,lbl])=>`
        <div>
          <div class="small muted" style="margin-bottom:3px">${lbl}</div>
          <div style="display:flex;gap:5px">
            <input class="f-contact-name" data-ck="${k}" placeholder="Nom" value="${esc((p.contacts||{})[k]?.nom||'')}" style="flex:2.2;min-width:0;font-size:13px">
            <input class="f-contact-tel" data-ck="${k}" placeholder="Téléphone" value="${esc((p.contacts||{})[k]?.tel||'')}" style="flex:1;min-width:0;font-size:13px" inputmode="tel">
          </div>
        </div>`).join('')}
      </div></div>
    </div>

    <div class="fpane" data-pane="info">
      <button class="btn btn-ghost" id="f-trait" style="width:100%;margin-bottom:14px;justify-content:flex-start;gap:9px">
        <span>💊</span><span style="flex:1;text-align:left">Fiche de traitement</span>
        <span style="color:var(--faint);font-size:11.5px">${(((p.traitement||{}).lignes)||[]).length ? (((p.traitement||{}).lignes)||[]).length + " médicament(s)" : "à renseigner"} ›</span>
      </button>
    ${typeof trendHtml === "function" ? trendHtml(p) : ""}
    <div class="field"><span class="lab">Contexte &amp; informations</span>
      <p class="small muted" style="margin-bottom:8px">Chaque information a son type et son interrupteur : <b>relève</b> = elle figure sur chaque relève de ce patient · <b>fiche</b> = consultable ici seulement.</p>
      <div id="f-infos"></div>
      <button class="btn btn-ghost" id="f-info-add" style="width:100%;margin-top:6px;border-style:dashed;font-size:13px">＋ Ajouter une information</button>
    </div>
    <div class="field"><span class="lab">Appareillages</span>
      <input id="f-appar" placeholder="Pacemaker, port-à-cath, sonde, O₂…" value="${esc(p.appareillages||'')}"></div>
    </div>

    <div class="fpane" data-pane="soins">
    <div class="field"><span class="lab">Plan de soins <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(★ pré-proposé à chaque passage)</span></span>
      <p class="small muted" style="margin-bottom:7px">Appui long sur un soin pour préciser son <b>rythme</b> (facultatif) : quotidien, lundi, 2×/semaine… Utile à un remplaçant qui découvre le patient.</p>
      ${S.slotsEnabled ? `
      <p class="small muted" style="margin-bottom:6px">Coche ☀️ ou 🌙 pour qu'un soin ne soit proposé qu'à ce créneau. <b>Aucune case cochée = proposé aux deux</b>.</p>
      <div class="plangrid" id="f-plan">
        <div class="pg-h"><span class="pg-n">Soin</span><span class="pg-c">☀️</span><span class="pg-c">🌙</span><span class="pg-x"></span></div>
        ${(p.plan||[]).map(x=>{
          const sl = (p.planSlots||{})[x] || {};
          const r = (p.planRythme||{})[x];
          return `<div class="pg-r" data-p="${esc(x)}">
            <span class="pg-n">${esc(x)}${r?` <span class="rythme">${esc(r)}</span>`:""}</span>
            <button class="pg-b ${sl.matin?"on am":""}" data-ps="${esc(x)}" data-sl="matin">${sl.matin?"✓":""}</button>
            <button class="pg-b ${sl.soir ?"on pm":""}" data-ps="${esc(x)}" data-sl="soir">${sl.soir?"✓":""}</button>
            <button class="pg-x" data-pdel="${esc(x)}" title="Retirer">✕</button>
          </div>`;
        }).join("") || `<p class="small muted" style="padding:8px 11px">Aucun soin — ajoute-les ci-dessous.</p>`}
      </div>`
      : `<div class="chips" id="f-plan" style="margin-bottom:8px">${(p.plan||[]).map(x=>{
        const r = (p.planRythme||{})[x];
        const sl = (p.planSlots||{})[x] || {};
        const cls = (sl.matin && !sl.soir) ? " s-am" : (sl.soir && !sl.matin) ? " s-bl" : "";
        return `<button class="chip on${cls}" data-p="${esc(x)}">${esc(x)}${r?` <span class="rythme">${esc(r)}</span>`:""} ✕</button>`;
      }).join("")}</div>`}
      <div id="f-catalog-sugg" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:8px">
        <input id="f-newplan" placeholder="Nouveau soin (libre)…">
        <button class="btn btn-ghost btn-sm" id="f-addplan" style="flex:none">＋</button>
      </div></div>
    <div class="field">
      <span class="lab">Seuils d'alerte personnalisés <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(laisser vide = seuils globaux)</span></span>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[["ta_h","TA syst. haute","≥ "+SEUILS.ta_h+" cmHg"],["ta_b","TA syst. basse","≤ "+SEUILS.ta_b],["sat_b","Sat basse","< "+SEUILS.sat_b+"%"],["gl_b","Glycémie basse","≤ "+SEUILS.gl_b+" g/L"],["gl_h","Glycémie haute","≥ "+SEUILS.gl_h],["temp_h","Fièvre","≥ "+SEUILS.temp_h+"°C"]].map(([k,lbl,plh])=>
          `<div><div class="small muted" style="margin-bottom:3px">${lbl}</div>
          <input class="f-th" data-thk="${k}" placeholder="${plh}" value="${(p.thresholds||{})[k]||""}" inputmode="decimal" style="font-size:13px"></div>`).join("")}
      </div></div>
      <div style="margin-top:10px">
        <div class="small muted" style="margin-bottom:3px">💩 Alerte après … jours sans selle</div>
        <input id="f-selles" inputmode="numeric" placeholder="3 par défaut"
               value="${esc(p.seuilSelles||"")}" style="max-width:170px">
        <div class="small muted" style="margin-top:4px;font-size:9.5px">Le transit varie d'un patient à l'autre — 5 jours peut être la norme pour certains.</div>
      </div>
    </div>

    <div class="uiact">
      <button class="btn btn-ghost" id="f-cancel">Annuler</button>
      <button class="btn btn-primary" id="f-save">${isNew?"✓ Créer le dossier":"✓ Enregistrer"}</button>
    </div>
    ${!isNew ? `<div class="fpane" data-pane="act">
      <button class="btn" id="f-dlu" style="width:100%;background:color-mix(in srgb, var(--danger) 55%, var(--bg));border-color:var(--danger);color:#fff;font-size:14.5px;margin-bottom:7px">🚑 DLU urgence</button>
      <div class="factions">
        <button class="btn btn-ghost" id="f-recueil" style="border-color:var(--accent);color:var(--accent)">📋 Fiche de recueil</button>
        <button class="btn btn-ghost" id="f-feuilles" style="border-color:var(--accent);color:var(--accent)"><span>🖨️</span><span class="fa-l">Feuilles à laisser au domicile</span><span class="fa-c">›</span></button>
        <button class="btn btn-ghost" id="f-export"><span>📄</span><span class="fa-l">Exporter la fiche</span><span class="fa-c">›</span></button>
        <button class="btn btn-ghost" id="f-pec"><span>🎗️</span><span class="fa-l">Fin de prise en charge</span><span class="fa-c">›</span></button>
      </div>
      <div class="fsep"></div>
      <div class="lab" style="margin-bottom:3px">Retirer ce dossier</div>
      <p class="small muted" style="margin:0 0 8px"><b>Mettre de côté</b> : le dossier quitte le Moniteur mais reste consultable et récupérable — rien n'est exporté. Pour produire un <b>fichier</b>, utilise 📄 Exporter la fiche ou 🧹 Ménage dans l'historique.</p>
      <div class="factions">
        <button class="btn btn-ghost" id="f-arch" style="color:var(--faint)"><span>📦</span><span class="fa-l">Mettre le dossier de côté</span></button>
        <button class="btn" id="f-del" style="background:transparent;border-color:var(--danger);color:var(--danger)"><span>🗑</span><span class="fa-l">Supprimer le dossier</span></button>
      </div>
    </div>` : ""}`);
  $$("#f-tours .chip").forEach(c => c.onclick = () => c.classList.toggle("on"));
  $$("#f-genre [data-g]").forEach(c => c.onclick = () => { $$("#f-genre .chip").forEach(x=>x.classList.remove("on")); c.classList.add("on"); });
  // Le plan s'affiche en grille (créneaux actifs) ou en chips : lire les deux
  const planList = () => [...$("#f-plan").querySelectorAll(".chip[data-p], .pg-r[data-p]")].map(c=>c.dataset.p);
  const bindDel = () => $$("#f-plan .chip").forEach(c => c.onclick = () => c.remove());
  bindDel();

  /* Suggestions catalogue avec recherche */
  const addToPlan = v => {
    if (planList().includes(v)){ toast("Déjà dans le plan."); return; }
    const box = $("#f-plan");
    if (!box) return;
    // En mode créneaux, le plan est une grille : ajouter une LIGNE avec ses cases
    if (box.classList.contains("plangrid")){
      const vide = box.querySelector("p.muted"); if (vide) vide.remove();
      const row = document.createElement("div");
      row.className = "pg-r"; row.dataset.p = v;
      row.innerHTML = `<span class="pg-n">${esc(v)}</span>
        <button class="pg-b" data-ps="${esc(v)}" data-sl="matin"></button>
        <button class="pg-b" data-ps="${esc(v)}" data-sl="soir"></button>
        <button class="pg-x" data-pdel="${esc(v)}" title="Retirer">✕</button>`;
      box.appendChild(row);
      bindPlanRow(row);
    } else {
      const b = document.createElement("button");
      b.className="chip on"; b.dataset.p=v; b.textContent=v+" ✕";
      b.onclick=()=>{ b.remove(); refreshSugg(); };
      box.appendChild(b);
    }
    refreshSugg();
  };

  /* Gestionnaires d'une ligne de la grille — appelés aussi à l'ajout à la volée */
  const bindPlanRow = row => {
    row.querySelectorAll("[data-ps]").forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const soin = b.dataset.ps, sl = b.dataset.sl;
      p.planSlots = p.planSlots || {};
      p.planSlots[soin] = p.planSlots[soin] || {};
      p.planSlots[soin][sl] = !p.planSlots[soin][sl];
      const on = !!p.planSlots[soin][sl];
      if (!p.planSlots[soin].matin && !p.planSlots[soin].soir) delete p.planSlots[soin];
      b.classList.toggle("on", on);
      b.classList.toggle(sl === "matin" ? "am" : "pm", on);
      b.textContent = on ? "✓" : "";
      save();
    });
    row.querySelectorAll("[data-pdel]").forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation();
      const soin = b.dataset.pdel;
      p.plan = (p.plan||[]).filter(x => x !== soin);
      if (p.planSlots) delete p.planSlots[soin];
      if (p.planRythme) delete p.planRythme[soin];
      row.remove(); save(); refreshSugg();
    });
  };
  const refreshSugg = (q="") => {
    const inPlan = planList();
    const box = $("#f-catalog-sugg");
    if (!box) return;
    const cats = getCatalogCats();
    let html = "";
    if (q){
      const ql = q.toLowerCase();
      const hits = cats.flatMap(c=>c.soins.map(s=>s.nom)).filter(n=>n.toLowerCase().includes(ql) && !inPlan.includes(n));
      if (hits.length){
        html = `<div class="chips">` + hits.map(n=>`<button class="chip" data-sugg="${esc(n)}">${esc(n)}${getSoinProtocol(n)||getSoinProtocol(Object.entries(S.catalog.overrides||{}).find(([k,v])=>v===n)?.[0]||n) ? " 📋":""} ＋</button>`).join("") + `</div>`;
      } else {
        html = `<p class="small muted" style="padding:4px 0">Pas dans le catalogue — appuie sur ＋ pour créer.</p>`;
      }
    } else {
      html = cats.map(c=>{
        const items = c.soins.filter(s=>!inPlan.includes(s.nom));
        if (!items.length) return "";
        return `<div class="cat-section" style="margin-bottom:8px">
          <div class="cat-head">${esc(c.icon)} ${esc(c.cat)}</div>
          <div class="chips">${items.map(s=>`<button class="chip" data-sugg="${esc(s.nom)}">${esc(s.nom)}${s.proto?" 📋":""} ＋</button>`).join("")}</div>
        </div>`;
      }).join("");
    }
    box.innerHTML = html;
    box.querySelectorAll("[data-sugg]").forEach(b=>b.onclick=()=>{ addToPlan(b.dataset.sugg); $("#f-newplan").value=""; refreshSugg(); });
  };
  $("#f-newplan").oninput = e => refreshSugg(e.target.value.trim());
  refreshSugg();

  /* Cases ☀️ / 🌙 : à quel créneau ce soin est-il proposé ?
     Aucune case cochée = proposé aux deux (comportement d'origine). */
  /* Lignes de la grille : mise à jour SUR PLACE — rouvrir la fiche ramenait
     au premier onglet à chaque clic, insupportable pour cocher plusieurs soins. */
  $$("#sheet .pg-r").forEach(bindPlanRow);

  /* Ajout libre + offre de sauvegarde dans le catalogue global */
  /* Appui long sur un soin du plan : définir ou effacer son rythme.
     Entièrement facultatif — laisser vide n'empêche rien. */
  {
    let _rt = null;
    const planBox = $("#f-plan");
    if (planBox){
      planBox.querySelectorAll("[data-p]").forEach(b => {
        const soin = b.dataset.p;
        const ask = async () => {
          const cur = (p.planRythme||{})[soin] || "";
          const v = await askText("Rythme du soin", {
            ic:"🔁", sub:esc(soin), val:cur,
            ph:"quotidien · lundi · 2×/semaine",
            aide:"Laisser vide pour ne rien afficher.", oui:"✓ Enregistrer" });
          if (v === false || v === null) return;
          p.planRythme = p.planRythme || {};
          const t = v.trim();
          if (t) p.planRythme[soin] = t; else delete p.planRythme[soin];
          save();
          // Mise à jour sur place : ne pas rouvrir la fiche (retour au 1er onglet)
          const lbl = b.querySelector(".pg-n") || b;
          if (lbl){
            const old = lbl.querySelector(".rythme");
            if (old) old.remove();
            if (t){
              const sp = document.createElement("span");
              sp.className = "rythme"; sp.textContent = t;
              lbl.appendChild(document.createTextNode(" ")); lbl.appendChild(sp);
            }
          }
        };
        b.addEventListener("touchstart", () => { _rt = setTimeout(ask, 550); }, { passive:true });
        ["touchend","touchmove","touchcancel"].forEach(ev =>
          b.addEventListener(ev, () => clearTimeout(_rt), { passive:true }));
        b.addEventListener("contextmenu", e => { e.preventDefault(); ask(); });
      });
    }
  }

  $("#f-addplan").onclick = () => {
    const v = $("#f-newplan").value.trim();
    if (!v) return;
    addToPlan(v);
    const alreadyKnown = getCatalog().includes(v);
    $("#f-newplan").value="";
    if (!alreadyKnown){
      setTimeout(()=>{
        if (confirm('Sauvegarder "'+v+'" dans le catalogue des soins ? Disponible ensuite pour tous les patients.')){
          const exists = customEntries().some(e=>e.nom===v);
          if (!exists){ S.catalog.custom.push({ nom:v, cat:"" }); save(); toast('"'+v+'" ajouté au catalogue ✓'); refreshSugg(); }
        }
      }, 80);
    }
  };
  /* ── Informations contextuelles ── */
  let infos = JSON.parse(JSON.stringify(p.infos || []));
  const drawInfos = () => {
    const box = $("#f-infos"); if (!box) return;
    box.innerHTML = infos.length ? infos.map((it,i)=>{
      const T = infoType(it.type);
      return `<div class="info-row ${it.show?"on":""}" style="border-left-color:${it.show?T.col:"var(--border)"}">
        <div class="info-body">
          <button class="info-typ" data-ityp="${i}" title="Changer le type"
                  style="--tc:${it.show?T.col:"var(--faint)"}">
            <span class="it-ic">${T.ic}</span>
            <span class="it-lbl">${esc(T.lbl)}</span>
            <span class="it-ch">▾</span>
          </button>
          <textarea class="info-txt" data-itxt="${i}" rows="1" placeholder="${esc(T.ph)}">${esc(it.txt||"")}</textarea>
        </div>
        <div class="info-sw">
          <button class="sw ${it.show?"on":""}" data-ishow="${i}" title="Afficher dans la relève"><span></span></button>
          <span class="sw-l" style="color:${it.show?T.col:"var(--faint)"}">${it.show?"relève":"fiche"}</span>
          <button class="info-del" data-idel="${i}" title="Supprimer">✕</button>
        </div>
      </div>`;
    }).join("") : uiEmpty("📋","Aucune information",
      "Code d'accès, allergie, antécédents, entourage… ce qu'un remplaçant doit savoir.");

    box.querySelectorAll("[data-itxt]").forEach(t => {
      const auto = () => { t.style.height="auto"; t.style.height=Math.min(t.scrollHeight+2,140)+"px"; };
      auto();
      // La feuille n'est pas encore dimensionnée au premier appel :
      // scrollHeight vaut alors une ligne et le texte reste tronqué.
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(auto);
      setTimeout(auto, 60);
      t.oninput = () => { infos[+t.dataset.itxt].txt = t.value; auto(); };
    });
    box.querySelectorAll("[data-ishow]").forEach(b => b.onclick = e => {
      e.preventDefault(); const i=+b.dataset.ishow; infos[i].show = !infos[i].show; drawInfos();
    });
    box.querySelectorAll("[data-idel]").forEach(b => b.onclick = e => {
      e.preventDefault(); infos.splice(+b.dataset.idel,1); drawInfos();
    });
    box.querySelectorAll("[data-ityp]").forEach(b => b.onclick = e => {
      e.preventDefault();
      const i = +b.dataset.ityp;
      pickInfoType(infos[i].type, t => { infos[i].type = t; drawInfos(); });
    });
  };
  drawInfos();
  const addInfo = $("#f-info-add");
  if (addInfo) addInfo.onclick = e => {
    e.preventDefault();
    // On choisit le type AVANT de créer la ligne : plus besoin de la
    // retyper après coup, et les six types se découvrent d'eux-mêmes.
    pickInfoType(null, t => {
      infos.push({ id:uid(), type:t||"acces", txt:"", show:(t==="acces"||t==="vigilance") });
      drawInfos();
      const l = $("#f-infos").querySelector("[data-itxt]:last-of-type");
      if (l){ l.focus(); if (l.scrollIntoView) l.scrollIntoView({ block:"center", behavior:"smooth" }); }
    });
  };
  const _addInfoOld = () => {
    infos.push({ id:uid(), type:"acces", txt:"", show:true });
    drawInfos();
    const last = $("#f-infos").querySelector("[data-itxt]:last-of-type");
    setTimeout(()=>{ const ts=$$("#f-infos [data-itxt]"); if(ts.length) ts[ts.length-1].focus(); }, 60);
  };
  /* Bascule d'onglet — la fiche est longue, chaque onglet tient sur un écran */
  $$("#sheet .ftab").forEach(b => b.onclick = () => {
    const t = b.dataset.tab;
    $$("#sheet .ftab").forEach(x => x.classList.toggle("on", x === b));
    $$("#sheet .fpane").forEach(pn => pn.classList.toggle("on", pn.dataset.pane === t));
    const sh = document.getElementById("sheet"); if (sh) sh.scrollTop = 0;
    /* Un textarea dans un panneau masqué a un scrollHeight nul : sa hauteur
       auto doit être recalculée quand le panneau devient visible, sinon le
       texte reste coupé à une ligne. */
    $$("#sheet .fpane.on textarea").forEach(x => {
      x.style.height = "auto";
      x.style.height = Math.min(x.scrollHeight + 2, 140) + "px";
    });
  });

  $("#f-cancel").onclick = closeSheet;
  $("#f-save").onclick = () => {
    const nom=$("#f-nom").value.trim(), prenom=$("#f-prenom").value.trim();
    if (!nom||!prenom){ toast("Nom et prénom requis"); return; }
    const genreChip = $("#f-genre .chip.on");
    const thresholds = {};
    document.querySelectorAll(".f-th[data-thk]").forEach(i=>{ const v=parseFloat(i.value); if(!isNaN(v)) thresholds[i.dataset.thk]=v; });
    const contacts = {};
    ["med","fam","pharma","cabinet"].forEach(k => {
      const nom = (document.querySelector(`.f-contact-name[data-ck="${k}"]`)?.value||"").trim();
      const tel = (document.querySelector(`.f-contact-tel[data-ck="${k}"]`)?.value||"").trim();
      if (nom||tel) contacts[k]={nom,tel};
    });
    const data = { nom, prenom, dob:$("#f-dob").value, genre:genreChip?genreChip.dataset.g:"",
      seuilSelles: ($("#f-selles")?.value||"").trim(),
      address: ($("#f-addr")?.value||"").trim(),
      cp:      ($("#f-cp")?.value||"").trim(),
      ville:   ($("#f-ville")?.value||"").trim(),
      tel: { fixe:   ($("#f-tel-fixe")?.value||"").trim(),
             mobile: ($("#f-tel-mob")?.value||"").trim() },
      nir: ($("#f-nir")?.value||"").trim(),
      prevenir: { nom:($("#f-pap-nom")?.value||"").trim(), tel:($("#f-pap-tel")?.value||"").trim() },
      appareillages: ($("#f-appar")?.value||"").trim(),
      thresholds: Object.keys(thresholds).length ? thresholds : undefined,
      contacts,
      infos: infos.filter(i => (i.txt||"").trim()).map(i => ({ ...i, txt:i.txt.trim() })),
      ctx: (infos.find(i=>i.type==="atcd")?.txt || "").trim(),   // compat ascendante
      plan:planList(), planRythme: p.planRythme || undefined,
      planSlots: p.planSlots || undefined,
      tours: $$("#f-tours .chip.on").map(c=>c.dataset.t) };
    if (isNew){
      const np = { id:uid(), docs:[], visits:[], bilans:[], archived:null, ...data };
      S.patients.push(np);
      if (typeof logChange==="function") logChange("add","patient", np.id, np);
      /* Après création, l'IDEL est chez le patient : c'est le moment
         où il donne accès, contacts, antécédents. On propose la fiche
         de recueil plutôt que de le laisser chercher les onglets. */
      _recueilApres = np.id;
    } else {
      const planBefore = JSON.stringify(p.plan||[]);
      Object.assign(p, data);
      if (typeof logChange==="function"){
        // Le plan de soins est journalisé à part (validation à la réception)
        const planAfter = JSON.stringify(data.plan||[]);
        const { plan, ...rest } = data;
        logChange("update","patient", p.id, rest);
        if (planBefore !== planAfter) logChange("update","plan", p.id, data.plan||[]);
      }
    }
    save(); closeSheet(); toast(isNew?"Dossier créé":"Fiche mise à jour"); render();
    /* Nouveau dossier : proposer d'enchaîner sur la fiche de recueil */
    if (isNew && _recueilApres){
      const nid = _recueilApres; _recueilApres = null;
      setTimeout(async () => {
        const ok = await askDialog({ ic:"📋", titre:"Compléter la fiche de recueil ?",
          sub:"Accès, contacts, allergies — tout à la suite, sans naviguer.",
          oui:"📋 Compléter", non:"Plus tard" });
        if (ok) sheetRecueil(nid);
      }, 420);
    }
  };
  if (!isNew){
    { const ft = $("#f-trait"); if (ft) ft.onclick = () => sheetTraitement(p.id); }
    const fRec = $("#f-recueil");
    if (fRec) fRec.onclick = () => sheetRecueil(p.id);
    const fFeu = $("#f-feuilles");
    if (fFeu) fFeu.onclick = () => sheetFeuilles(p.id);
    const fDlu = $("#f-dlu");
    if (fDlu) fDlu.onclick = () => sheetDLU(p.id);
    const fExp = $("#f-export");
    if (fExp) fExp.onclick = () => sheetExportFiche(p.id);
    const fPec = $("#f-pec");
    if (fPec) fPec.onclick = () => sheetFinPEC(p.id);
    $("#f-arch").onclick = async () => {
      if (!await askDialog({ ic:"📥", titre:"Mettre de côté ce dossier ?", sub:esc(p.prenom)+" "+esc(p.nom)+" — il sortira du Moniteur sans rien perdre, et pourra être repris à tout moment.", oui:"✓ Mettre de côté" })) return;
      p.archived = todayISO();
      if (typeof logChange==="function") logChange("update","patient", p.id, { archived:p.archived });
      if (openId===p.id) openId=null;
      save(); closeSheet(); toast("Dossier mis de côté 📦"); render();
    };
    $("#f-del").onclick = async () => {
      /* Action lourde : deux étapes. La saisie du nom empêche
         un enchaînement machinal de « OK ». */
      /* Deux dialogues natifs enchaînés auparavant. Le garde-fou reste —
         on retape le nom — mais dans une seule carte, bouton éteint tant
         que la saisie ne correspond pas. */
      const N = p.nom.replace("Demo-","").toUpperCase();
      const ok = await askDialog({
        ton:"danger", ic:"⚠️",
        titre:"Supprimer définitivement",
        sub:`<b>${esc(p.prenom)} ${esc(N)}</b>`,
        warn:"Le dossier partira dans la corbeille, récupérable 30 jours. Ses documents et son historique seront retirés du Moniteur.",
        saisieLbl:`Écris <b>${esc(N)}</b> pour confirmer`,
        saisie:{ ph:N },
        verrou:N, oui:"🗑 Supprimer", non:"Annuler"
      });
      if (!ok) return;
      trashPatient(p.id);
      if (openId===p.id) openId=null;
      save(true); closeSheet(); toast("Dossier déplacé dans la corbeille 🗑"); render();
    };
  }
}

/* ---------- Documents (photos / PDF) ---------- */
let docTargetPid = null;
function sheetDocs(pid){
  const p = getP(pid);
  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>📎 Documents — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    <p class="small muted" style="margin-bottom:12px">Ordonnances, photos de plaie, comptes-rendus… stockés sur cet appareil. (La version Android les chiffrera et la photo de plaie pourra se prendre directement au passage.)</p>
    <div class="docgrid" id="doclist"></div>
    ${(p.docs||[]).some(d=>d.mime&&d.mime.startsWith("image/"))
      ? '<button class="btn btn-ghost" id="d-gal-chrono" style="margin-bottom:10px">🖼️ Galerie chronologique des photos</button>'
      : ""}
    <button class="btn btn-primary" id="d-add" style="width:100%;margin-top:6px;font-size:15px">＋ Ajouter un document</button>`);
  renderDocs(pid);
  // Charger les thumbnails depuis IDB après le rendu
  (p.docs||[]).filter(d=>d.mime&&d.mime.startsWith("image/")).forEach(d=>{
    const img=document.getElementById("dthumb-"+d.id);
    if(img) idbGet("doc_"+d.id).then(data=>{ if(data&&img) img.src=data; }).catch(()=>{});
  });
  const galBtn=$("#d-gal-chrono"); if(galBtn) galBtn.onclick=()=>sheetGalerie(pid);
  $("#d-add").onclick = () => sheetAddDoc(pid);
  // Le bouton de l'écran vide mène au même endroit
  $$("[data-adddoc]").forEach(b => b.onclick = () => sheetAddDoc(pid));
}

/* ---------- Choisir la provenance du document ---------- */
let docDate = null;   // date choisie pour le document en cours d'ajout

function sheetAddDoc(pid, replaceId){
  docDate = workDate();
  const SRC = [
    ["camerafile",  "📷", "Photo",   "Prendre maintenant"],
    ["galleryfile", "🖼️", "Galerie", "Photo existante"],
    ["docfile",     "📄", "PDF",     "Ordonnance, bilan"],
    ["wordfile",    "📝", "Word",    "Modifiable"]
  ];
  openSheet(`
    ${navHeader("Documents", true)}
    <h3>＋ ${replaceId ? "Remplacer le document" : "Ajouter un document"}</h3>
    <p class="small muted" style="margin-bottom:14px">D'où vient le document ?</p>
    <div class="srcgrid">
      ${SRC.map(([id,ic,lbl,sub])=>`
        <button class="srcbtn" data-src="${id}">
          <span class="src-ic">${ic}</span>
          <span class="src-lbl">${lbl}</span>
          <span class="src-sub">${sub}</span>
        </button>`).join("")}
    </div>
    <div class="lab" style="margin-top:14px">Date du document</div>
    <div class="rowb">
      <input type="date" id="src-date" value="${esc(docDate||workDate())}" max="${esc(todayISO())}" style="flex:1">
      <button class="btn btn-ghost btn-sm" id="src-today" style="flex:none">Aujourd'hui</button>
    </div>
    <p class="small muted" style="margin:5px 0 0">Modifie-la si l'ordonnance ou la photo date d'avant.</p>
    <button class="btn btn-ghost" id="src-cancel" style="width:100%;margin-top:12px">Annuler</button>`);
  { const dd = $("#src-date"); if (dd) dd.onchange = () => { docDate = dd.value || workDate(); };
    const dt = $("#src-today"); if (dt) dt.onclick = () => { docDate = todayISO(); const e=$("#src-date"); if(e) e.value = docDate; }; }
  $$("#sheet [data-src]").forEach(b => b.onclick = () => {
    docTargetPid = pid; docReplaceId = replaceId || null;
    closeSheet();
    setTimeout(() => { const el = document.getElementById(b.dataset.src); if (el) el.click(); }, 120);
  });
  $("#src-cancel").onclick = () => sheetDocs(pid);
}
function docAgeMonths(d){
  if (!d.date) return 0;
  const a = new Date(d.date+"T12:00:00"), n = new Date();
  return (n.getFullYear()-a.getFullYear())*12 + (n.getMonth()-a.getMonth()) - (n.getDate() < a.getDate() ? 1 : 0);
}
async function renderDocs(pid){
  const p = getP(pid);
  const box = $("#doclist");
  if (!box) return;
  box.innerHTML = p.docs.map(d => {
    const age = docAgeMonths(d);
    return `
    <div class="doc" data-open="${d.id}">
      ${d.mime&&d.mime.startsWith("image/") ? `<img id="dthumb-${esc(d.id)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : `<span class="ic">${docIcon(d)}</span>`}
      <!-- Le type est plus parlant que le nom de fichier ; un document
           antérieur à la nomenclature porte une pastille « à qualifier ». -->
      <span class="dn">${(() => {
        const l = typeof docLabel === "function" ? docLabel(d) : d.name;
        return esc(l.length > 26 ? l.slice(0,26) + "…" : l);
      })()}${typeof docAQualifier === "function" && docAQualifier(d)
        ? `<i class="dq">à qualifier</i>` : ""}</span>
      <button class="rep" data-repdoc="${d.id}" title="Remplacer (validité remise à zéro)">🔁</button>
      <button class="del" data-deldoc="${d.id}" title="Supprimer">✕</button>
      <span class="dd ${age>=3?"old":""}">${age>=3?"⚠ ":""}${esc(fmtFR(d.date))}${age>=1?" · "+age+" mois":""}</span>
    </div>`;
  }).join("") || `<div style="grid-column:1/-1">${uiEmpty("📎","Aucun document",
      "Ordonnances, photos de plaie, comptes-rendus d'hospitalisation…",
      { label:"＋ Ajouter un document", data:'data-adddoc="1"' })}</div>`;
  box.querySelectorAll("[data-open]").forEach(el => el.onclick = e => {
    if (e.target.closest("[data-deldoc]") || e.target.closest("[data-repdoc]")) return;
    const d = p.docs.find(x=>x.id===el.dataset.open);
    viewDoc(d);
  });
  box.querySelectorAll("[data-deldoc]").forEach(b => b.onclick = async e => {
    e.stopPropagation();
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce document ?", oui:"🗑 Supprimer" })) return;
    p.docs = p.docs.filter(x=>x.id!==b.dataset.deldoc);
    save(); renderDocs(pid); render();
  });
  box.querySelectorAll("[data-repdoc]").forEach(b => b.onclick = async e => {
    e.stopPropagation();
    docTargetPid = pid; docReplaceId = b.dataset.repdoc;
    // Choisir le picker selon le type du document à remplacer
    const existing = p.docs.find(x=>x.id===b.dataset.repdoc);
    const isImg = existing && existing.mime && existing.mime.startsWith("image/");
    if (isImg){
      // Proposer galerie ou photo
      /* Avant : « Prendre une photo ? (Annuler = galerie) » — deux actions
         déguisées en oui/non, où « Annuler » ne voulait pas dire annuler. */
      const c = await askChoice({
        ic:"📷", titre:"Ajouter une photo",
        options:[ { ic:"📷", lbl:"Prendre une photo",       val:"cam" },
                  { ic:"🖼", lbl:"Choisir dans la galerie", val:"gal" } ]
      });
      if (!c) return;
      (c === "cam" ? $("#camerafile") : $("#galleryfile")).click();
    } else {
      $("#docfile").click();
    }
  });
}
let docReplaceId = null;
/* Compression images avant stockage (évite la limite de taille) */
function compressImage(file, maxPx, quality){
  return new Promise(res => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx){
        const r = maxPx / Math.max(w, h);
        w = Math.round(w * r); h = Math.round(h * r);
      }
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      cv.toBlob(b => res(b), "image/jpeg", quality);
    };
    img.onerror = () => res(file); // repli si décodage impossible
    img.src = url;
  });
}

async function handleDocFile(e) {
  const file = e.target.files[0]; e.target.value = "";
  const repId = docReplaceId; docReplaceId = null;
  const pid = docTargetPid;
  if (!file || !pid) return;
  const isImg = file.type.startsWith("image/");
  const limitMo = isImg ? 25 : 15;
  if (file.size > limitMo * 1024 * 1024){
    toast("Fichier trop lourd (max " + limitMo + " Mo).");
    return;
  }
  // Compression automatique des images
  let blob = file, finalMime = file.type || "application/octet-stream";
  let finalName = file.name;
  if (isImg){
    blob = await compressImage(file, 2000, 0.85);
    finalMime = "image/jpeg";
    finalName = finalName.replace(/\.[^.]+$/, "") + ".jpg";
  }
  const rd = new FileReader();
  rd.onload = ev => {
    const dataUrl = ev.target.result;
    const sizeMo = (dataUrl.length * 0.75 / 1048576).toFixed(1);
    // Prévisualisation avant confirmation
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>${repId ? "Remplacer le document" : "Ajouter un document"}</h3>
      <div class="doc-prev-wrap">
        ${isImg
          ? `<img src="${dataUrl}" alt="prévisualisation">`
          : `<div class="pdf-ico">📄</div>`}
      </div>
      <p style="font-weight:600;margin-bottom:4px">${esc(finalName)}</p>
      <p class="doc-meta">Taille stockée : ~${sizeMo} Mo</p>
      <div class="uiact" style="margin-top:16px">
        <button class="btn btn-ghost" id="doc-cancel" style="flex:1">✕ Annuler</button>
        <button class="btn btn-primary" id="doc-ok" style="flex:1">✓ ${repId ? "Remplacer" : "Qualifier et ajouter"}</button>
      </div>`);
    $("#doc-cancel").onclick = () => sheetDocs(pid);
    $("#doc-ok").onclick = () => {
      const p = getP(pid);
      if (repId){
        // Le contenu va dans IDB (clé doc_<id>), JAMAIS dans la fiche patient :
        // sinon idbGet ne le retrouve pas et l'aperçu affiche « introuvable ».
        idbSet("doc_"+repId, dataUrl).then(()=>{
          const d = p.docs.find(x=>x.id===repId);
          if (d){
            delete d.data;                      // purge d'un éventuel reliquat
            Object.assign(d, { name:finalName, mime:finalMime, date:todayISO() });
            if (typeof logChange==="function") logChange("update","doc", pid+"|"+repId, d);
          }
          save(); renderDocs(pid);
          toast("Document remplacé — validité repartie de zéro 🔁");
        }).catch(e => toast("Échec stockage : "+e.message, "danger"));
        return;
      } else {
        const docId = uid();
        /* Qualifier AVANT d'enregistrer : type et précision obligatoires,
           et conversion en PDF si le document s'y prête. */
        qualifierDoc(1, poidsDataUrl(dataUrl), finalMime).then(async q => {
          if (!q) return;                          // annulé : rien n'est ajouté
          let donnee = dataUrl, mime2 = finalMime;
          if (q.format === "pdf" && /^image\//.test(finalMime)){
            try {
              donnee = await imagesVersPdf([dataUrl]);
              mime2 = "application/pdf";
            } catch(err){
              logIncident("docs", "Conversion PDF impossible", err);
              toast("Conversion impossible — image conservée");
            }
          }
          idbSet("doc_"+docId, donnee).then(()=>{
            const _d={ id:docId, name:q.nom, mime:mime2, date: docDate || workDate(),
                       type:q.type, precision:q.precision };
            p.docs.push(_d);
            if(typeof logChange==="function") logChange("add","doc", pid+"|"+docId, _d);
            /* Photo prise depuis le suivi de plaie : la rattacher */
            if (_plaieEnCours){
              const pl = (p.plaies||[]).find(x => x.id === _plaieEnCours);
              if (pl){ pl.docIds = pl.docIds || []; pl.docIds.push(docId); }
              _plaieEnCours = null;
            }
            save(true); renderDocs(pid); toast(docLabel(_d) + " ajouté 📎");
          }).catch(e=>{ toast("Échec stockage doc : "+e.message); });
        });
        return; // save() sera appelé dans le then ci-dessus
        toast("Document ajouté 📎");
      }
      save(); sheetDocs(pid); render();
    };
  };
  rd.readAsDataURL(blob);
}
["docfile","galleryfile","camerafile","wordfile"].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener("change", handleDocFile);
});

async function viewDoc(d){
  const ov = document.getElementById("docview");
  if (!ov) return;
  ov.style.display = "flex";
  const closeAll = () => { ov.style.display="none"; ov.innerHTML=""; };
  ov.innerHTML = `<div class="dv-wrap" style="display:flex;align-items:center;justify-content:center;min-height:60vh">
    <div class="muted small" style="color:#fff">Chargement…</div>
    <button class="dv-close" style="position:fixed;top:20px;right:20px;font-size:28px;background:none;border:none;color:#fff;cursor:pointer">✕</button>
  </div>`;
  ov.querySelector(".dv-close").onclick = closeAll;
  // Filet de sécurité : un tap sur le fond ferme toujours la visionneuse
  ov.onclick = e => { if (e.target === ov) closeAll(); };

  idbGet("doc_"+d.id).then(async data => {
    // Récupération des documents cassés par l'ancien bug de remplacement :
    // le contenu avait atterri dans la fiche (d.data) au lieu d'IDB.
    if (!data && d.data){
      try { await idbSet("doc_"+d.id, d.data); data = d.data; delete d.data; save(); }
      catch(e){ data = d.data; }
    }
    if (!data){
      ov.innerHTML = `<div class="dv-wrap" style="text-align:center;padding:34px 24px">
        <div style="font-size:46px;line-height:1;margin-bottom:12px">📎</div>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 8px">Contenu introuvable</p>
        <p style="color:var(--dim);font-size:13px;line-height:1.55;margin:0 0 20px;max-width:290px;margin-inline:auto">
          La fiche mentionne « ${esc(d.name)} » mais son contenu n'est plus sur cet appareil.
          Cela peut arriver si le fichier a été importé depuis une sauvegarde faite avec une
          version antérieure de l'app, ou reçu par synchro sans être joint.
          Demande à son expéditeur de te le renvoyer, ou réimporte-le depuis la fiche.</p>
        <div class="dv-bar" style="position:static;padding:0;background:none">
          <button class="btn btn-primary dv-close">Fermer</button>
        </div>
      </div>`;
      ov.querySelectorAll(".dv-close").forEach(b => b.onclick = closeAll);
      return;
    }

    /* ── Image : affichage direct ── */
    if (d.mime && d.mime.startsWith("image/")){
      ov.innerHTML = `<div class="dv-wrap">
        <img src="${data}" style="max-width:100%;max-height:78vh;object-fit:contain" alt="${esc(d.name)}">
        <div class="dv-bar">
          <button class="btn btn-primary dv-share">📤 Partager / Enregistrer</button>
          <button class="btn btn-ghost dv-close">Fermer</button>
        </div>
      </div>`;
    }

    /* ── PDF : rendu en images (le WebView bloque data:/blob: en iframe) ── */
    else if ((d.mime||"").includes("pdf") || /\.pdf$/i.test(d.name||"")){
      ov.innerHTML = `<div class="dv-wrap dv-full">
        <div class="dv-head">${docIcon(d)} ${esc(d.name)}</div>
        <div class="dv-pages"><div class="dv-noprev">Rendu du document…</div></div>
        <div class="dv-bar">
          <button class="btn btn-primary dv-share">📤 Partager / Enregistrer</button>
          <button class="btn btn-ghost dv-open">👁 Ouvrir</button>
          <button class="btn btn-ghost dv-close">Fermer</button>
        </div>
      </div>`;
      ov.querySelectorAll(".dv-close").forEach(b => b.onclick = closeAll);
      ov.querySelectorAll(".dv-open").forEach(b => b.onclick = () => openDocExternal(d, data));
      ov.querySelectorAll(".dv-share").forEach(b => b.onclick = () => shareDoc(d, data));
      const box = ov.querySelector(".dv-pages");
      const imgs = await pdfToImagesGlobal(data, 12);
      if (!box) return;
      if (imgs && imgs.length){
        box.innerHTML = imgs.map(im =>
          `<img class="dv-page" src="${im.dataUrl}" alt="page ${im.page}">`).join("")
          + (imgs[0].total > imgs.length
             ? `<p class="dv-more">${imgs[0].total - imgs.length} page(s) supplémentaire(s) — utilise « Ouvrir » pour tout voir.</p>` : "");
      } else {
        box.innerHTML = `<div class="dv-noprev">Aperçu indisponible sur cet appareil.<br><small>Utilise « Ouvrir » ou « Partager ».</small></div>`;
      }
      return;   // handlers déjà posés
    }

    /* ── Word et autres : pas d'aperçu possible, on propose les actions ── */
    else {
      ov.innerHTML = `<div class="dv-wrap" style="text-align:center;padding:34px 24px">
        <div style="font-size:52px;line-height:1;margin-bottom:12px">${docIcon(d)}</div>
        <p style="color:#fff;font-size:16px;font-weight:600;margin:0 0 4px">${esc(d.name)}</p>
        <p style="color:var(--dim);font-size:12.5px;margin:0 0 22px">${d.date?fmtFR(d.date):""}${d.date?" · ":""}${docSizeLabel(data)}</p>
        <p style="color:var(--faint);font-size:12.5px;line-height:1.5;margin:0 0 20px;max-width:280px;margin-inline:auto">
          Ce format ne s'affiche pas dans l'app. Ouvre-le dans Word, WPS ou ton lecteur habituel.</p>
        <div class="dv-bar" style="position:static;padding:0">
          <button class="btn btn-primary dv-open">👁 Ouvrir</button>
          <button class="btn btn-ghost dv-share">📤 Partager / Enregistrer</button>
          <button class="btn btn-ghost dv-close">Fermer</button>
        </div>
      </div>`;
    }

    ov.querySelectorAll(".dv-close").forEach(b => b.onclick = closeAll);
    ov.querySelectorAll(".dv-open").forEach(b => b.onclick = () => openDocExternal(d, data));
    ov.querySelectorAll(".dv-share").forEach(b => b.onclick = () => shareDoc(d, data));
  }).catch(e => {
    ov.innerHTML = `<div class="dv-wrap" style="text-align:center;padding:34px 24px">
      <p style="color:#fff;font-size:15px;margin:0 0 18px">Impossible d'ouvrir le document.<br><small style="color:var(--dim)">${esc(e.message||"")}</small></p>
      <button class="btn btn-primary dv-close">Fermer</button></div>`;
    ov.querySelectorAll(".dv-close").forEach(b => b.onclick = closeAll);
  });
}

/* dataURL → URL d'objet (les blobs passent mieux que les data: longues) */
function dataToUrl(data, mime){
  try {
    const b64 = String(data).split(",")[1] || data;
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i=0;i<bin.length;i++) arr[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([arr], { type: mime || "application/octet-stream" }));
  } catch(e){ return data; }
}
function docSizeLabel(data){
  try {
    const b64 = String(data).split(",")[1] || data;
    const ko = Math.round(b64.length * 0.75 / 1024);
    return ko > 1024 ? (ko/1024).toFixed(1)+" Mo" : ko+" Ko";
  } catch(e){ return ""; }
}

/* Ouvrir le document dans l'application système adéquate */
async function openDocExternal(d, data){
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    try {
      const { Filesystem, Share } = cap.Plugins;
      const FileOpener = cap.Plugins.FileOpener || cap.Plugins.FileOpenerPlugin;
      const b64 = String(data).split(",")[1] || data;
      const r = await Filesystem.writeFile({ path: d.name, data: b64, directory: "CACHE" });
      if (FileOpener && FileOpener.open){
        await FileOpener.open({ filePath: r.uri, contentType: d.mime || "application/octet-stream" });
        return;
      }
      // Pas de plugin d'ouverture : le partage Android propose « Ouvrir avec »
      await Share.share({ title: d.name, url: r.uri });
      return;
    } catch(e){ if ((e.message||"").match(/cancel/i)) return; console.warn("openDoc:", e); }
  }
  const url = dataToUrl(data, d.mime);
  const w = window.open(url, "_blank");
  if (!w) toast("Autorise les fenêtres pour ouvrir le document");
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/* Partager ou enregistrer le document */
async function shareDoc(d, data){
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    try {
      const { Filesystem, Share } = cap.Plugins;
      const b64 = String(data).split(",")[1] || data;
      const r = await Filesystem.writeFile({ path: d.name, data: b64, directory: "CACHE" });
      await Share.share({ title: d.name, url: r.uri });
      return;
    } catch(e){ if ((e.message||"").match(/cancel/i)) return; console.warn("shareDoc:", e); }
  }
  const url = dataToUrl(data, d.mime);
  const a = document.createElement("a");
  a.href = url; a.download = d.name || "document"; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 8000);
  toast("Document enregistré 📤");
}

async function sheetRappels(pid){
  const p = pid ? getP(pid) : null;
  const list = S.rappels
    .filter(r => (!pid || r.pid===pid) && (!r.pid || !(getP(r.pid)||{}).archived))
    .sort((a,b) => (a.done?1:0)-(b.done?1:0) || String(a.due).localeCompare(String(b.due)));
  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>📌 Rappels${p ? " — "+esc(p.prenom)+" "+esc(p.nom.replace("Demo-","").toUpperCase()) : ""}</h3>
    <div id="raplist">${(() => {
      /* Deux sections : ce qui reste à faire, et ce qui a été noté
         dans la relève — ce dernier y reste jusqu'à suppression. */
      const aFaire = list.filter(r => !r.done || !r.resultat);
      const notes  = list.filter(r =>  r.done &&  r.resultat);
      const ligne = r => {
      const rp = r.pid ? getP(r.pid) : null;
      const cd = rapCountdown(r);
      return `<div class="rap ${r.done?"done":""}">
        <span class="ric">${rapType(r.type).ic}</span>
        <button style="flex:1;text-align:left" data-editrap="${r.id}" title="Modifier / prolonger">
          <div class="rt">${esc(r.text)}</div>
          <div class="rs">${rapType(r.type).lbl}${rp&&!pid?" · "+esc(rp.nom.replace("Demo-","").toUpperCase()):""}
          ${r.due?` · ${esc(fmtFR(r.due))} ${cd.txt&&!r.done?`<span class="rdue ${cd.cls}">${cd.cls==="past"?"⚠ ":""}${esc(cd.txt)}</span>`:""}`:""}</div>
        </button>
        <button class="rchk" data-rchk="${r.id}">${r.done?"✓":""}</button>
        <button class="btn btn-ghost btn-sm" data-delrap="${r.id}" style="flex:none">🗑</button>
      </div>`;
      };
      if (!list.length) return uiEmpty("📌","Aucun rappel",
        "Ordonnance à renouveler, matériel à commander, absence à noter…");
      let out = "";
      if (aFaire.length) out += aFaire.map(ligne).join("");
      if (notes.length){
        out += `<div class="rowlab ac" style="margin-top:13px">
            <span>Notés dans la relève</span><i></i><em>jusqu'à suppression</em></div>
          <div class="rowbox ac" style="display:block">` +
          notes.map(r => `<div class="rap done">
            <span class="ric">✅</span>
            <span style="flex:1;min-width:0;text-align:left">
              <div class="rt">${esc(r.resultat)}</div>
              <div class="rs">noté le ${esc(fmtFR(r.resultatAt || todayISO()))}${
                r.text ? ` · rappel « ${esc(r.text)} »` : ""}</div>
            </span>
            <button class="rchk" data-rchk="${r.id}" title="Remettre à faire">✓</button>
            <button class="btn btn-ghost btn-sm" data-delrap="${r.id}" style="flex:none">🗑</button>
          </div>`).join("") + `</div>`;
      }
      return out;
    })()}</div>
    <p class="small muted" style="margin-top:8px">Tape un rappel pour le modifier ou le prolonger. Les échéances s'activent de J-3 au jour J.</p>
    <button class="btn btn-primary" id="r-new" style="margin-top:10px">＋ Nouveau rappel</button>`);
  $$("#raplist [data-editrap]").forEach(b => b.onclick = () => sheetEditRappel(pid, b.dataset.editrap));
  $$("#raplist [data-rchk]").forEach(b => b.onclick = async () => {
    const r = S.rappels.find(x=>x.id===b.dataset.rchk);
    /* Un rappel coché disparaissait sans laisser de trace : le collègue
       ne savait pas s'il était FAIT ou supprimé. On propose désormais de
       noter le résultat, qui restera dans la relève jusqu'à suppression. */
    if (r && !r.done){
      const txt = await askText("Rappel fait", {
        ic:"✅", sub: esc(r.text || ""),
        val: resultatPropose(r.text || ""),
        ph: "ce qui figurera dans la relève",
        aide: "Laisse vide pour classer le rappel sans rien noter.",
        oui: "✓ Noter dans la relève" });
      if (txt === false || txt === null) return;      // annulé : rien ne bouge
      const t = String(txt).trim();
      if (t){ r.resultat = t; r.resultatAt = workDate(); }
      else delete r.resultat;
    } else if (r && r.done){
      delete r.resultat; delete r.resultatAt;         // remis « à faire »
    }
    r.done = !r.done; if(typeof logChange==="function") logChange("update","rappel", r.id, { done:r.done }); save(); sheetRappels(pid); render();
  });
  $$("#raplist [data-delrap]").forEach(b => b.onclick = async () => {
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce rappel ?", oui:"🗑 Supprimer" })) return;
    if(typeof logChange==="function") logChange("delete","rappel", b.dataset.delrap); S.rappels = S.rappels.filter(x=>x.id!==b.dataset.delrap);
    save(); sheetRappels(pid); render();
  });
  $("#r-new").onclick = () => sheetEditRappel(pid, null);
}
function sheetNewRappel(pid){ sheetEditRappel(pid, null); }
function sheetEditRappel(backPid, rapId){
  const r = rapId ? S.rappels.find(x=>x.id===rapId) : null;
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>${r ? "Modifier le rappel" : "Nouveau rappel"}</h3>
    <div class="field"><span class="lab">Catégorie</span>
      <select id="nr-type">${Object.entries(RAP_TYPES).map(([k,v])=>`<option value="${k}" ${r&&r.type===k?"selected":""}>${v.ic} ${v.lbl}</option>`).join("")}</select>
      <div class="chips" id="nr-subs" style="margin-top:8px"></div>
      <p class="small muted" id="nr-subhint" style="margin-top:4px">Tape une précision pour la reprendre dans le détail — ou écris librement plus bas ✏️</p>
    </div>
    <div class="field"><span class="lab">Rappel concernant</span>
      <select id="nr-pid">
        <optgroup label="Cabinet (part avec la synchro du cabinet)">
          ${S.tours.map(t=>`<option value="tour:${esc(t)}" ${r && r.tour===t && !r.pid ?"selected":""}>🗺️ ${esc(t)}</option>`).join("")}
        </optgroup>
        <optgroup label="Pour moi seul">
          <option value="perso" ${r && r.perso ?"selected":""}>🔒 Personnel — ne part jamais en synchro</option>
        </optgroup>
        <optgroup label="Patient">
          ${activeP().map(p=>`<option value="${p.id}" ${(r? r.pid===p.id : p.id===backPid)?"selected":""}>${esc(p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom)}</option>`).join("")}
        </optgroup>
      </select>
      <p class="small muted" style="margin-top:5px">Un rappel de <b>cabinet</b> accompagne la synchro de ce cabinet. Un rappel <b>personnel</b> reste sur ton appareil.</p></div>
    <div class="field"><span class="lab">Échéance</span>
      <input id="nr-due" type="date" value="${esc(r&&r.due ? r.due : todayISO())}">
      <div class="chips" style="margin-top:8px">
        ${[["+1 j",1],["+3 j",3],["+7 j",7],["+1 mois",30]].map(([l,n])=>`<button class="chip" data-plus="${n}">${l}</button>`).join("")}
      </div></div>
    <div class="field"><span class="lab">✏️ Détail du rappel</span>
      <div class="micwrap"><textarea id="nr-txt" placeholder="Précise librement : ECBU à faire jeudi · récupérer compresses chez Dupont · RDV dentiste 15h…">${esc(r?r.text:"")}</textarea>
      <button class="mic" id="nr-mic">🎤</button></div></div>
    <div class="uiact">
      <button class="btn btn-ghost" id="nr-cancel">Annuler</button>
      <button class="btn btn-primary" id="nr-save">${r ? "Enregistrer" : "Créer le rappel"}</button>
    </div>`);
  // Sous-catégories dynamiques selon la catégorie choisie
  const renderSubs = () => {
    const t = $("#nr-type").value;
    const subs = rapType(t).subs || [];
    const box = $("#nr-subs");
    if (!box) return;
    box.innerHTML = subs.map((sub,i)=>`<button class="chip" data-sub="${i}" style="font-size:12.5px">${esc(sub)}</button>`).join("");
    box.querySelectorAll("[data-sub]").forEach(b => b.onclick = () => {
      const val = subs[+b.dataset.sub];
      const ta = $("#nr-txt");
      // La sous-catégorie devient le début du détail, modifiable ensuite au crayon
      ta.value = ta.value.trim() ? val + " — " + ta.value.trim() : val;
      ta.dispatchEvent(new Event("input", { bubbles:true }));
      ta.focus();
      $$("#nr-subs .chip").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
    });
  };
  renderSubs();
  $("#nr-type").onchange = renderSubs;
  $$("#sheet [data-plus]").forEach(b => b.onclick = () => {
    const base = $("#nr-due").value || todayISO();
    const d = new Date(base + "T12:00:00");
    d.setDate(d.getDate() + (+b.dataset.plus));
    $("#nr-due").value = d.toISOString().slice(0,10);
  });
  $("#nr-mic").onclick = e => { e.preventDefault(); dictate($("#nr-txt"), $("#nr-mic")); };
  $("#nr-cancel").onclick = () => sheetRappels(backPid);
  $("#nr-save").onclick = () => {
    const text = $("#nr-txt").value.trim();
    if (!text){ toast("Décris le rappel."); return; }
    // Le sélecteur encode trois cas : "tour:<nom>" · "perso" · "<idPatient>"
    const sel = $("#nr-pid").value || "";
    const data = { type:$("#nr-type").value, due:$("#nr-due").value, text,
                   pid:null, tour:null, perso:false };
    if (sel === "perso")            data.perso = true;
    else if (sel.startsWith("tour:")) data.tour = sel.slice(5);
    else if (sel)                   { data.pid = sel;
                                      const _p = getP(sel);
                                      data.tour = (_p && (_p.tours||[])[0]) || null; }
    if (r){ Object.assign(r, data); toast("Rappel mis à jour ✓"); }
    else { const _r={ id:uid(), done:false, ...data }; S.rappels.push(_r); if(typeof logChange==="function") logChange("add","rappel", _r.id, _r); }
    save(true); sheetRappels(backPid); render();
    if (!r) toast("Rappel créé 📌");
  };
}

/* ---------- Bilans / RDV médicaux ---------- */
/* ---------- Corbeille (30 jours) ---------- */
function trashPatient(pid){
  const p = getP(pid);
  if (!p) return;
  if (typeof logChange==="function") logChange("delete","patient", pid);
  S.trash = S.trash || [];
  S.trash.push({ deletedAt: Date.now(), patient: p, rappels: (S.rappels||[]).filter(r=>r.pid===pid) });
  S.patients = S.patients.filter(x=>x.id!==pid);
  S.rappels = (S.rappels||[]).filter(r=>r.pid!==pid);
}
function sheetTrash(){
  const trash = S.trash || [];
  openSheet(`
    ${navHeader("Patients", true)}
    <h3>🗑 Corbeille</h3>
    <p class="small muted" style="margin-bottom:10px">Les dossiers supprimés restent récupérables 30 jours, puis sont effacés définitivement au démarrage de l'app.</p>
    <div style="max-height:52vh;overflow-y:auto">
      ${trash.map((t,i)=>{
        const d=new Date(t.deletedAt);
        const jRest = Math.max(0, 30 - Math.floor((Date.now()-t.deletedAt)/864e5));
        return `<div class="rap" style="align-items:center">
          <span style="flex:1"><div class="rt">${esc(t.patient.nom.replace("Demo-","").toUpperCase())} ${esc(t.patient.prenom)}</div>
          <div class="rs">Supprimé le ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")} · effacement dans ${jRest} j</div></span>
          <button class="btn btn-ghost btn-sm" data-restore="${i}">↩︎ Restaurer</button>
          <button class="btn btn-ghost btn-sm" data-purge="${i}">❌</button>
        </div>`;
      }).join("") || '<p class="muted small" style="padding:12px 0">Corbeille vide.</p>'}
    </div>
    `);
  $$("#sheet [data-restore]").forEach(b => b.onclick = () => {
    const t = S.trash[+b.dataset.restore];
    const pp = t.patient;
    // Un dossier restauré doit redevenir VISIBLE : sans tournée (ou encore
    // archivé/clôturé), il reviendrait sans apparaître nulle part.
    pp.archived = null;
    if (!(pp.tours||[]).length && S.tours.length)
      pp.tours = [ S.tours.includes(S.curTour) ? S.curTour : S.tours[0] ];
    S.patients.push(pp);
    S.rappels.push(...(t.rappels||[]));
    S.trash.splice(+b.dataset.restore, 1);
    save(true); render(); sheetTrash();
    toast(pp.prenom + " restauré" + (pp.pec ? " (prise en charge terminée)" : "") + " ↩︎");
  });
  $$("#sheet [data-purge]").forEach(b => b.onclick = async () => {
    const t = S.trash[+b.dataset.purge];
    if (!await askDialog({ ton:"danger", ic:"⚠️", titre:"Effacer définitivement ?", sub:esc(t.patient.prenom)+" "+esc(t.patient.nom), warn:"Ce dossier ne sera plus récupérable.", oui:"🗑 Effacer" })) return;
    // Purger aussi les documents stockés en base
    (t.patient.docs||[]).forEach(d => idbDel("doc_"+d.id).catch(()=>{}));
    S.trash.splice(+b.dataset.purge, 1);
    save(); sheetTrash(); toast("Dossier effacé définitivement");
  });
  bindNav(sheetPatientsPanel);
}

/* Appui long générique : cb() après 550 ms, et neutralise le clic qui suit */
function onLongPress(el, cb){
  let t=null, swallowUntil=0;
  el.addEventListener("pointerdown", () => { t=setTimeout(()=>{ swallowUntil=Date.now()+350; cb(); }, 550); });
  ["pointerup","pointerleave","pointercancel"].forEach(ev => el.addEventListener(ev, () => clearTimeout(t)));
  // N'avaler que le clic synthétique qui suit immédiatement l'appui long (pas les taps ultérieurs sur ✓)
  el.addEventListener("click", e => { if (Date.now() < swallowUntil){ e.stopImmediatePropagation(); e.preventDefault(); swallowUntil=0; } }, true);
}

/* Éditeur inline d'une phrase : remplace la ligne par un champ + ✓ */
function inlineEditPhrase(rowEl, ci, pi, onDone){
  const cur = S.phraseCats[ci].phrases[pi];
  rowEl.innerHTML = `<input data-phedit value="${esc(cur)}" style="flex:1;font-size:13px">
    <button class="chip" data-phok style="flex:none">✓</button>`;
  const inp = rowEl.querySelector("[data-phedit]"); inp.focus(); inp.select();
  const done = () => {
    const v = inp.value.trim();
    if (v && v !== cur){ S.phraseCats[ci].phrases[pi] = v; save(); toast("Phrase modifiée ✓"); }
    onDone();
  };
  rowEl.querySelector("[data-phok]").onclick = e => { e.stopPropagation(); done(); };
  inp.addEventListener("keydown", e => { if (e.key==="Enter") done(); if (e.key==="Escape") onDone(); });
  inp.addEventListener("click", e => e.stopPropagation());
}

/* ---------- Phrases types : sélecteur par catégories ---------- */
let _phOpenCat = null; // catégorie dépliée
function sheetPhrasePicker(pid, onPick){
  const cats = S.phraseCats || [];
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>💬 Phrases types</h3>
    <p class="small muted" style="margin-bottom:10px">Tape une catégorie puis une phrase — elle s'ajoute à la transmission. <b>Appui long</b> sur une phrase pour la modifier.</p>
    <div style="max-height:56vh;overflow-y:auto">
      ${cats.map((c,ci)=>`
        <button class="btn btn-ghost" data-cat="${ci}" style="width:100%;justify-content:space-between;margin-bottom:6px">
          <span>${esc(c.name)}</span><span class="muted small">${c.phrases.length} ▾</span>
        </button>
        <div data-catbox="${ci}" style="display:${_phOpenCat===ci?"block":"none"};margin:0 0 8px 8px">
          ${c.phrases.map((ph,pi)=>`
            <button class="selv" data-pick="${ci}:${pi}" style="width:100%;text-align:left;margin-bottom:4px">
              <span class="sv" style="font-size:13px">${esc(ph)}</span>
            </button>`).join("")}
        </div>`).join("")}
    </div>
    <div class="rowb" style="margin-top:10px">
      <button class="btn btn-ghost" id="php-manage">⚙️ Gérer le catalogue</button>
    </div>`);
  $$("#sheet [data-cat]").forEach(b => b.onclick = () => {
    const ci = +b.dataset.cat;
    _phOpenCat = _phOpenCat === ci ? null : ci;
    sheetPhrasePicker(pid, onPick);
  });
  $$("#sheet [data-pick]").forEach(b => onLongPress(b, () => {
    const [ci,pi] = b.dataset.pick.split(":").map(Number);
    inlineEditPhrase(b, ci, pi, () => sheetPhrasePicker(pid, onPick));
  }));
  $$("#sheet [data-pick]").forEach(b => b.onclick = () => {
    const [ci,pi] = b.dataset.pick.split(":").map(Number);
    const ph = S.phraseCats[ci].phrases[pi];
    closeSheet();
    if (typeof onPick === "function"){ onPick(ph); return; }
    const ta = document.querySelector(`[data-form="${pid}"] [data-note]`);
    if (ta && !ta.readOnly){
      ta.value = (ta.value ? ta.value.replace(/\s+$/,"") + " " : "") + ph;
      ta.dispatchEvent(new Event("input", { bubbles:true }));
      toast("Phrase insérée 💬");
    } else if (ta && ta.readOnly){
      toast("Désactive le mode DARD pour insérer une phrase libre.");
    }
  });
  $("#php-manage").onclick = () => sheetPhrases(pid);
  { const _e = $("#php-close"); if (_e) _e.onclick = closeSheet; }
}

/* ---------- Gestion du catalogue de phrases ---------- */
function sheetPhrases(backPid){
  const cats = S.phraseCats || [];
  openSheet(`
    ${navHeader("Réglages", true)}
    <h3>⚙️ Catalogue de phrases</h3>
    <div style="max-height:46vh;overflow-y:auto">
      ${cats.map((c,ci)=>`
        <div style="margin-bottom:12px">
          <div class="lab" style="display:flex;justify-content:space-between;align-items:center">
            <span>${esc(c.name)}</span>
            ${!c.phrases.length ? `<button class="btn btn-ghost btn-sm" data-delcat="${ci}">🗑 catégorie</button>` : ""}
          </div>
          ${c.phrases.map((ph,pi)=>`<div class="rap" data-phrow="${ci}:${pi}" style="align-items:center;padding:6px 10px">
            <span style="flex:1;font-size:13px">${esc(ph)}</span>
            <button class="btn btn-ghost btn-sm" data-editph="${ci}:${pi}" style="flex:none">✏️</button>
            <button class="btn btn-ghost btn-sm" data-delph="${ci}:${pi}" style="flex:none">🗑</button>
          </div>`).join("")}
        </div>`).join("")}
    </div>
    <div style="height:1px;background:var(--border);margin:10px 0"></div>
    <span class="lab">＋ Nouvelle phrase</span>
    <div class="micwrap" style="margin-top:6px">
      <textarea id="ph-new" placeholder="Texte de la phrase…" style="min-height:48px"></textarea>
      <button class="mic" id="ph-mic">🎤</button>
    </div>
    <select id="ph-cat" style="margin-top:8px">
      ${cats.map((c,ci)=>`<option value="${ci}">${esc(c.name)}</option>`).join("")}
      <option value="__new">➕ Nouvelle catégorie…</option>
    </select>
    <input id="ph-newcat" placeholder="Nom de la nouvelle catégorie" style="display:none;margin-top:8px">
    <button class="btn btn-primary" id="ph-add" style="margin-top:10px;width:100%">＋ Ajouter au catalogue</button>`);
  $("#ph-mic").onclick = e => { e.preventDefault(); dictate($("#ph-new"), $("#ph-mic")); };
  $("#ph-cat").onchange = () => {
    $("#ph-newcat").style.display = $("#ph-cat").value === "__new" ? "block" : "none";
  };
  $$("#sheet [data-delph]").forEach(b => b.onclick = () => {
    const [ci,pi] = b.dataset.delph.split(":").map(Number);
    S.phraseCats[ci].phrases.splice(pi,1); save(); sheetPhrases(backPid);
  });
  const editRow = key => {
    const [ci,pi] = key.split(":").map(Number);
    const row = document.querySelector(`#sheet [data-phrow="${key}"]`);
    if (row) inlineEditPhrase(row, ci, pi, () => sheetPhrases(backPid));
  };
  $$("#sheet [data-editph]").forEach(b => b.onclick = e => { e.stopPropagation(); editRow(b.dataset.editph); });
  $$("#sheet [data-phrow]").forEach(r => onLongPress(r, () => editRow(r.dataset.phrow)));
  $$("#sheet [data-delcat]").forEach(b => b.onclick = () => {
    S.phraseCats.splice(+b.dataset.delcat,1); save(); sheetPhrases(backPid);
  });
  $("#ph-add").onclick = () => {
    const v = $("#ph-new").value.trim();
    if (!v){ toast("Phrase vide."); return; }
    let ci = $("#ph-cat").value;
    if (ci === "__new"){
      const cn = $("#ph-newcat").value.trim();
      if (!cn){ toast("Nom de catégorie vide."); return; }
      S.phraseCats.push({ name:cn, phrases:[] });
      ci = S.phraseCats.length - 1;
    }
    S.phraseCats[+ci].phrases.push(v);
    save(); toast("Phrase ajoutée 💬"); sheetPhrases(backPid);
  };
  { const _e = $("#ph-back"); if (_e) _e.onclick = () => backPid ? sheetPhrasePicker(backPid) : sheetTours(); }
}

/* ---------- Journal des envois ---------- */
function sheetSendLog(){
  const log = S.sendLog || [];
  const fmtLbl = { txt:"🗒️ Texte", pdf:"📑 PDF", html:"🌐 HTML", docx:"📝 Word" };
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📨 Journal des envois</h3>
    <p class="small muted" style="margin-bottom:10px">Trace de chaque relève partagée — utile pour prouver qu'une transmission a été faite.</p>
    <div style="max-height:55vh;overflow-y:auto">
      ${log.map((e,i)=>{
        const d = new Date(e.ts);
        const dd = String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+"/"+d.getFullYear();
        const hh = String(d.getHours()).padStart(2,"0")+"h"+String(d.getMinutes()).padStart(2,"0");
        return `<div class="rap" style="align-items:center"><span class="ric">📨</span>
          <span style="flex:1"><div class="rt">${dd} à ${hh} — ${esc(e.tour)}</div>
          <div class="rs">${fmtLbl[e.fmt]||e.fmt} · ${e.n} patient(s)${e.docs?" · "+e.docs+" doc(s)":""}</div></span>
          ${e.text?`<button class="btn btn-ghost btn-sm" data-resend="${i}">↩︎ Rouvrir</button>`:""}</div>`;
      }).join("") || `<p class="muted small" style="padding:10px 0">Aucun envoi enregistré pour l\'instant.</p>`}
    </div>`);
  $$("#sheet [data-resend]").forEach(b => b.onclick = () => {
    const e = (S.sendLog||[])[+b.dataset.resend];
    if (!e || !e.text){ toast("Texte non conservé pour cet envoi."); return; }
    showReport(e.text, { tour:S.curTour, start:todayISO(), end:todayISO() });
  });
  { const _e = $("#sl-back"); if (_e) _e.onclick = sheetTours; }
}

/* ---------- Synchronisation bilan ↔ rappel ---------- */
function syncBilanRappel(pid, bilan){
  const p = getP(pid);
  if (!p) return;
  const existing = (S.rappels||[]).find(r => r.bilanId === bilan.id);
  const label = bilan.type + (bilan.res ? " — " + bilan.res.slice(0,40) : "");
  if (bilan.statut === "À faire" && bilan.date){
    if (existing){ existing.due = bilan.date; existing.txt = label; existing.done = false; }
    else { const _br={ id:uid(), pid, type:"bilan", txt:label, due:bilan.date, done:false, bilanId:bilan.id }; S.rappels.push(_br); if(typeof logChange==="function") logChange("add","rappel", _br.id, _br); }
  } else if (existing){
    // Fait ou Résultat reçu → rappel terminé
    existing.done = true;
  }
}
function removeBilanRappel(bilanId){
  S.rappels = (S.rappels||[]).filter(r => r.bilanId !== bilanId);
}

async function sheetBilans(pid){
  const p = getP(pid);
  const list = [...p.bilans].sort((a,b) =>
    (BILAN_STATUTS.indexOf(a.statut)-BILAN_STATUTS.indexOf(b.statut)) || String(a.date).localeCompare(String(b.date)));
  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>🧪 Bilans / RDV — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    <p class="small muted" style="margin-bottom:10px">Tape le statut pour le faire avancer : À faire → Fait → Résultat reçu.</p>
    <div id="billist">${list.map(b => {
      const past = b.date && b.date < todayISO() && b.statut === "À faire";
      return `<div class="rap">
        <span class="ric">🧪</span>
        <span style="flex:1"><div class="rt">${esc(b.type)}</div>
          <div class="rs">${b.date ? `<span class="rdue ${past?"past":""}">${past?"⚠ ":""}${esc(fmtFR(b.date))}</span> · ` : ""}${b.res?esc(b.res):""}</div></span>
        <button class="btn btn-ghost btn-sm" data-cycle="${b.id}" style="flex:none;min-width:104px;justify-content:center;${b.statut==="Résultat reçu"?"color:var(--accent);border-color:var(--accent)":b.statut==="Fait"?"color:var(--amber)":""}">${esc(b.statut)}</button>
        <button class="btn btn-ghost btn-sm" data-delbil="${b.id}" style="flex:none">🗑</button>
      </div>`;
    }).join("") || uiEmpty("🧪","Aucun bilan ni rendez-vous",
      "Prise de sang, INR, consultation… note-les pour ne pas les oublier.")}</div>
    <button class="btn btn-primary" id="b-new" style="margin-top:14px">＋ Nouveau bilan / RDV</button>`);
  $$("#billist [data-cycle]").forEach(btn => btn.onclick = () => {
    const b = p.bilans.find(x=>x.id===btn.dataset.cycle);
    b.statut = BILAN_STATUTS[(BILAN_STATUTS.indexOf(b.statut)+1) % BILAN_STATUTS.length];
    if(typeof logChange==="function") logChange("update","bilan", pid+"|"+b.id, { statut:b.statut });
    syncBilanRappel(pid, b);
    save(); sheetBilans(pid); render();
  });
  $$("#billist [data-delbil]").forEach(btn => btn.onclick = async () => {
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce bilan ?", oui:"🗑 Supprimer" })) return;
    removeBilanRappel(btn.dataset.delbil);
    if(typeof logChange==="function") logChange("delete","bilan", pid+"|"+btn.dataset.delbil); p.bilans = p.bilans.filter(x=>x.id!==btn.dataset.delbil);
    save(); sheetBilans(pid); render();
  });
  $("#b-new").onclick = () => sheetNewBilan(pid);
}
function sheetNewBilan(pid){
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>Nouveau bilan / RDV</h3>
    <div class="field"><span class="lab">Type</span>
      <select id="nb-type">${BILAN_TYPES.map(t=>`<option>${esc(t)}</option>`).join("")}</select></div>
    <div class="rowb" style="margin-bottom:13px">
      <div style="flex:1"><span class="lab">Date</span><input id="nb-date" type="date" value="${todayISO()}"></div>
      <div style="flex:1"><span class="lab">Statut</span>
        <select id="nb-statut">${BILAN_STATUTS.map(s=>`<option>${esc(s)}</option>`).join("")}</select></div>
    </div>
    <div class="field"><span class="lab">Précision / résultat</span>
      <div class="micwrap"><textarea id="nb-res" placeholder="Ex : NFS + iono, labo à prévenir · résultat : CRP 12…"></textarea>
      <button class="mic" id="nb-mic">🎤</button></div></div>
    <div class="uiact">
      <button class="btn btn-ghost" id="nb-cancel">Annuler</button>
      <button class="btn btn-primary" id="nb-save">Ajouter</button>
    </div>`);
  $("#nb-mic").onclick = e => { e.preventDefault(); dictate($("#nb-res"), $("#nb-mic")); };
  $("#nb-cancel").onclick = () => sheetBilans(pid);
  $("#nb-save").onclick = () => {
    const nb = { id:uid(), type:$("#nb-type").value, date:$("#nb-date").value,
      statut:$("#nb-statut").value, res:$("#nb-res").value.trim() };
    getP(pid).bilans.push(nb); if(typeof logChange==="function") logChange("add","bilan", pid+"|"+nb.id, nb);
    syncBilanRappel(pid, nb);
    save(true); toast("Bilan ajouté 🧪" + (nb.statut==="À faire"&&nb.date ? " + rappel créé 📌" : "")); sheetBilans(pid); render();
  };
}

/* ---------- Historique patient ---------- */
async function sheetHist(pid){
  const p = getP(pid);
  const vs = [...p.visits].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at));
  openSheet(`
    ${navHeader("Fiche", true)}
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <h3 style="margin:0;flex:1">🕐 Historique — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <button class="chip" id="hist-menage" title="Archiver et alléger">🧹</button>
    </div>
    <p class="small muted" style="margin-bottom:12px">${p.visits.length} passage(s) · 🧹 pour archiver et alléger</p>
    ${vs.map(v => {
      const al = alertes(v.consts);
      const cp=[]; const c=v.consts||{};
      if(c.ta)cp.push("TA "+c.ta); if(c.temp)cp.push("T° "+c.temp); if(c.sat)cp.push("Sat "+c.sat+"%");
      if(c.puls)cp.push("♥ "+c.puls); if(c.glyc)cp.push("Gly "+c.glyc); if(c.douleur)cp.push("EVA "+c.douleur);
      return `<div class="selv"><span style="flex:1" class="sv">
        <b>${esc(fmtFR(v.date))} ${esc(v.at)}</b>${al.length?` <b style="color:var(--danger)">⚠</b>`:""}<br>
        ${v.soins.length?esc(v.soins.join(", "))+"<br>":""}
        ${cp.length?`<span class="mono">${esc(cp.join(" · "))}</span><br>`:""}
        ${v.note?esc(v.note):""}
      </span>
      <button class="btn btn-ghost btn-sm" data-delv="${v.uid}" style="flex:none">🗑</button></div>`;
    }).join("") || `<p class="muted small" style="padding:10px 0">Aucun passage.</p>`}`);
  $$("#sheet [data-delv]").forEach(b => b.onclick = async () => {
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce passage ?", oui:"🗑 Supprimer" })) return;
    p.visits = p.visits.filter(v=>v.uid!==b.dataset.delv);
    save(); sheetHist(pid); render();
  });
  const hm = $("#hist-menage"); if (hm) hm.onclick = () => sheetMenage(pid);
}

/* ---------- RELÈVE PAR PÉRIODE : 3 modes ---------- */
function isEvent(v){ return alertes(v.consts).length > 0 || (v.note && v.note.trim() !== ""); }

/* ============================================================
   [CATALOGUE] Gestion du catalogue des soins
============================================================ */
function sheetCatalog(){
  const cats = getCatalogCats();
  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>📋 Catalogue des soins</h3>
    <input id="cat-srch" class="plan-search" placeholder="🔍 Rechercher un soin…">
    <div id="cat-list" class="cat-results">
      ${cats.map((c,ci)=>`
      <div class="cat-section" data-cat="${esc(c.cat)}">
        <div class="rowlab ${UI_TONS[ci % UI_TONS.length]}" style="margin-top:13px">
          <span class="rl-ic">${esc(c.icon)}</span><span>${esc(c.cat)}</span><i></i>
          <em>${c.soins.length}</em>
        </div>
        ${c.soins.map(s=>`
        <div class="cat-soin" data-orig="${esc(s.orig)}">
          <span class="cat-nom">${esc(s.nom)}</span>
          ${s.proto?'<span class="cat-proto-ic" title="Protocole défini">📋</span>':''}
          <button class="cat-prot" data-prot="${esc(s.orig)}" title="Modifier le protocole">📋</button>
          <button class="cat-edit" data-orig="${esc(s.orig)}" data-nom="${esc(s.nom)}" title="Renommer">✏️</button>
          <button class="cat-del" data-delsoin="${esc(s.orig)}" title="Retirer du catalogue">🗑</button>
        </div>`).join("")}
      </div>`).join("")}
    </div>
    <button class="btn btn-ghost" id="cat-add" style="margin-top:14px">＋ Ajouter un soin</button>`);

  /* Recherche */
  $("#cat-srch").oninput = e => {
    const q = e.target.value.trim().toLowerCase();
    $$("#cat-list .cat-soin").forEach(el => {
      el.style.display = (!q || el.querySelector(".cat-nom").textContent.toLowerCase().includes(q)) ? "" : "none";
    });
    $$("#cat-list .cat-section").forEach(el => {
      el.style.display = [...el.querySelectorAll(".cat-soin")].some(s=>s.style.display!=="none") ? "" : "none";
    });
  };

  /* Renommer */
  /* Retirer un soin du catalogue. Le catalogue est une LISTE DE CHOIX :
     le retirer ne touche pas l'historique, où le texte du soin reste
     affiché comme il a été saisi ce jour-là. */
  $$("#cat-list .cat-del").forEach(b => b.onclick = async () => {
    const orig = b.dataset.delsoin;
    const nom  = b.closest(".cat-soin")?.querySelector(".cat-nom")?.textContent || orig;
    const u    = usagesSoin(orig);
    const ok = await askDialog({
      ton:"danger", ic:"🗑", titre:"Retirer ce soin du catalogue ?",
      sub:`<b>${esc(nom)}</b>`,
      warn: u.total
        ? `Il est utilisé dans ${u.passages} passage${u.passages>1?"s":""} et ${u.plans} plan${u.plans>1?"s":""} de soins. Ces enregistrements gardent le texte du soin — seul le catalogue perd la ligne.`
        : "Il n'est utilisé nulle part. Rien d'autre ne sera touché.",
      oui:"🗑 Retirer", non:"Annuler" });
    if (!ok) return;
    retirerSoinCatalogue(orig);
    save(true); sheetCatalog();
    toast(`« ${nom} » retiré du catalogue`);
  });

  $$("#cat-list .cat-edit").forEach(b => b.onclick = () =>
    sheetRenameSoin(b.dataset.orig, b.dataset.nom));
  // Appui long sur la ligne → renommage inline (sans quitter la liste)
  $$("#cat-list .cat-soin").forEach(row => onLongPress(row, () => {
    const orig = row.dataset.orig;
    const nomEl = row.querySelector(".cat-nom");
    const cur = nomEl.textContent;
    nomEl.innerHTML = `<input data-snedit value="${esc(cur)}" style="width:100%;font-size:13px">`;
    const inp = nomEl.querySelector("[data-snedit]"); inp.focus(); inp.select();
    const done = () => {
      const v = inp.value.trim();
      if (v && v !== cur){ S.catalog.overrides[orig] = v; save(); toast('"'+cur+'" → "'+v+'" ✓'); }
      sheetCatalog();
    };
    inp.addEventListener("keydown", e => { if (e.key==="Enter") done(); if (e.key==="Escape") sheetCatalog(); });
    inp.addEventListener("blur", done);
    inp.addEventListener("click", e => e.stopPropagation());
  }));

  /* Protocole */
  $$("#cat-list .cat-prot").forEach(b => b.onclick = () => {
    const orig = b.dataset.prot;
    sheetEditProtocol(orig, getSoinName(orig), getSoinProtocol(orig));
  });

  /* Nouveau soin */
  $("#cat-add").onclick = () => sheetNewSoin();
  { const _e = $("#cat-back"); if (_e) _e.onclick = sheetTours; }
}

/* ---------- Nouveau soin (catégorie au choix / création) ---------- */
function sheetNewSoin(){
  const customCats = S.catalog.customCats || [];
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>＋ Nouveau soin au catalogue</h3>
    <div class="field"><span class="lab">Nom du soin</span>
      <input id="ns-nom" placeholder="Ex : Lavage de sinus"></div>
    <div class="field"><span class="lab">Catégorie</span>
      <select id="ns-cat">
        ${CATALOG_CATS.map(c=>`<option value="${esc(c.cat)}">${esc(c.icon)} ${esc(c.cat)}</option>`).join("")}
        ${customCats.map(c=>`<option value="${esc(c)}">🗂️ ${esc(c)}</option>`).join("")}
        <option value="">⭐ Soins personnalisés</option>
        <option value="__new">➕ Nouvelle catégorie…</option>
      </select></div>
    <input id="ns-newcat" placeholder="Nom de la nouvelle catégorie" style="display:none;margin-bottom:12px">
    <div class="uiact">
      <button class="btn btn-ghost" id="ns-cancel">Annuler</button>
      <button class="btn btn-primary" id="ns-save">Ajouter</button>
    </div>`);
  $("#ns-cat").onchange = () => {
    $("#ns-newcat").style.display = $("#ns-cat").value === "__new" ? "block" : "none";
  };
  $("#ns-cancel").onclick = sheetCatalog;
  $("#ns-save").onclick = () => {
    const n = $("#ns-nom").value.trim();
    if (!n){ toast("Nom vide."); return; }
    if (getCatalog().includes(n)){ toast("Ce soin existe déjà."); return; }
    let cat = $("#ns-cat").value;
    if (cat === "__new"){
      const cn = $("#ns-newcat").value.trim();
      if (!cn){ toast("Nom de catégorie vide."); return; }
      if (!S.catalog.customCats) S.catalog.customCats = [];
      if (!S.catalog.customCats.includes(cn)) S.catalog.customCats.push(cn);
      cat = cn;
    }
    S.catalog.custom.push({ nom:n, cat });
    save(); toast('"'+n+'" ajouté ✓'); sheetCatalog();
  };
}

/* ---------- Renommer un soin ---------- */
function sheetRenameSoin(orig, cur){
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>✏️ Renommer un soin</h3>
    <div class="field"><span class="lab">Nom actuel</span>
      <p class="small muted">${esc(cur)}</p></div>
    <div class="field"><span class="lab">Nouveau nom</span>
      <input id="rn-nom" value="${esc(cur)}"></div>
    <div class="uiact">
      <button class="btn btn-ghost" id="rn-cancel">Annuler</button>
      <button class="btn btn-primary" id="rn-save">Renommer</button>
    </div>`);
  $("#rn-cancel").onclick = sheetCatalog;
  $("#rn-save").onclick = () => {
    const nv = $("#rn-nom").value.trim();
    if (!nv || nv === cur){ sheetCatalog(); return; }
    S.catalog.overrides[orig] = nv; save();
    toast('"'+cur+'" → "'+nv+'" ✓'); sheetCatalog();
  };
}

function sheetEditProtocol(orig, nom, current){
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📋 Protocole — ${esc(nom)}</h3>
    <p class="small muted" style="margin-bottom:10px">Affiché comme guide lors de la saisie de ce soin pendant un passage.</p>
    <textarea id="prot-txt" style="min-height:180px" placeholder="Ex : 1. Désinfecter au NaCl 0,9%&#10;2. Appliquer Mepilex Border&#10;3. Couvrir et dater&#10;4. Photographier si évolution">${esc(current)}</textarea>
    <div class="rowb" style="margin-top:12px">
      ${current?'<button class="btn btn-danger btn-sm" id="prot-del">Supprimer</button>':''}
      <button class="btn btn-ghost" id="prot-cancel">Annuler</button>
      <button class="btn btn-primary" id="prot-save">Enregistrer</button>
    </div>`);
  const del = $("#prot-del");
  if (del) del.onclick = () => { delete S.catalog.protocols[orig]; save(); toast("Protocole supprimé."); sheetCatalog(); };
  $("#prot-cancel").onclick = () => sheetCatalog();
  $("#prot-save").onclick = () => {
    const txt = $("#prot-txt").value.trim();
    if (txt) S.catalog.protocols[orig] = txt; else delete S.catalog.protocols[orig];
    save(); toast("Protocole enregistré 📋"); sheetCatalog();
  };
}
/* ---------- Affectation des patients à une tournée ---------- */
function sheetAssignPatients(tourName, initialSlot){
  const pats = activeP().slice().sort((a,b)=>a.nom.localeCompare(b.nom));
  if (!pats.length){
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>👥 ${esc(tourName)}</h3>
      <p class="muted small" style="padding:16px 0">Aucun patient créé. Crée d'abord un dossier patient.</p>`);
    { const _e = $("#ap-back"); if (_e) _e.onclick = sheetTours; } return;
  }
  let editSlot = S.slotsEnabled ? (initialSlot || defaultSlot()) : null; // créneau en cours d'édition
  let filterIn = false;
  let lifted = null;
  const state = {}; // cochage courant (dépend du créneau édité)
  let ord = [];     // ordre courant (dépend du créneau édité)

  const loadSlot = () => {
    // Appartenance : membres du créneau si définis, sinon appartenance tournée
    pats.forEach(p => {
      if (editSlot){
        const m = ((S.slotMembers||{})[tourName]||{})[editSlot];
        state[p.id] = m ? m.includes(p.id) : (p.tours||[]).includes(tourName);
      } else {
        state[p.id] = (p.tours||[]).includes(tourName);
      }
    });
    // Ordre : ordre du créneau si défini, sinon ordre global
    const base = editSlot
      ? (((S.slotOrder||{})[tourName]||{})[editSlot] || (S.patientOrder||{})[tourName] || [])
      : ((S.patientOrder||{})[tourName] || []);
    ord = [...base];
    pats.forEach(p => { if (!ord.includes(p.id)) ord.push(p.id); });
  };
  loadSlot();

  const sortedPats = () => {
    const indexed = Object.fromEntries(pats.map(p=>[p.id,p]));
    return ord.map(id=>indexed[id]).filter(Boolean)
      // Filtre : patients RATTACHÉS à ce cabinet (via leur fiche), qu'ils soient
      // cochés dans la tournée du moment ou non — pour pouvoir recocher
      // facilement un patient temporairement retiré (hospitalisation, absence…).
      .filter(p => !filterIn || (p.tours||[]).includes(tourName) || state[p.id]);
  };

  const renderList = () => {
    const box = $("#assign-list");
    if (!box) return;
    const sp = sortedPats();
    box.innerHTML = sp.map((p,i) => `
      <div class="rap" data-ap="${esc(p.id)}" style="cursor:pointer;user-select:none">
        <button class="btn btn-ghost btn-sm" data-drag="${esc(p.id)}" style="flex-shrink:0;margin-right:6px;font-size:16px;padding:4px 10px;${lifted===p.id?"background:var(--accent);color:var(--accent-ink)":""}" title="Soulever / placer">☰</button>
        <button class="box" data-chk="${esc(p.id)}" title="${state[p.id]?"Retirer de la tournée":"Affecter à la tournée"}" style="width:30px;height:30px;border-radius:8px;border:2px solid var(--border-strong);
          display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-right:10px;font-size:16px;padding:0;
          background:${state[p.id]?"var(--accent)":"transparent"};color:${state[p.id]?"var(--accent-ink)":"transparent"};font-weight:700">✓</button>
        <span style="flex:1">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${
          (!state[p.id] && (p.tours||[]).includes(tourName))
            ? `<div class="rs" style="color:var(--faint)">rattaché au cabinet · hors tournée</div>` : ""}</span>
        <button class="btn btn-ghost btn-sm" data-up="${esc(p.id)}" ${i===0?"disabled":""} title="Monter">↑</button>
        <button class="btn btn-ghost btn-sm" data-dn="${esc(p.id)}" ${i===sp.length-1?"disabled":""} title="Descendre">↓</button>
      </div>`).join("") || '<p class="muted small" style="padding:12px 0">Aucun patient dans cette tournée — décoche le filtre pour en ajouter.</p>';

    // (Dé)cocher UNIQUEMENT via la case ✓ — jamais par un tap sur la ligne
    $$("#assign-list [data-chk]").forEach(b => b.onclick = e => {
      e.stopPropagation();
      state[b.dataset.chk] = !state[b.dataset.chk];
      if (!state[b.dataset.chk] && filterIn) toast("Retiré de la tournée (Enregistrer pour valider)");
      renderList();
    });
    $$("#assign-list [data-ap]").forEach(b => { b.onclick = null; b.style.cursor = "default"; });
    // ↑↓ par id (fiable même filtré)
    const move = (id, dir) => {
      const visible = sortedPats().map(x=>x.id);
      const vi = visible.indexOf(id);
      const target = visible[vi+dir];
      if (target === undefined) return;
      const a = ord.indexOf(id), b = ord.indexOf(target);
      [ord[a], ord[b]] = [ord[b], ord[a]];
      renderList();
    };
    $$("#assign-list [data-up]").forEach(b => b.onclick = e => { e.stopPropagation(); move(b.dataset.up, -1); });
    $$("#assign-list [data-dn]").forEach(b => b.onclick = e => { e.stopPropagation(); move(b.dataset.dn, +1); });

    // ── Soulever & placer : tap ☰ = soulever, tap une ligne = insérer là ──
    const box2 = $("#assign-list");
    if (lifted){
      const lr = box2.querySelector(`[data-ap="${CSS.escape(lifted)}"]`);
      if (lr){ lr.style.outline = "2px solid var(--accent)"; lr.style.background = "var(--accent-soft, rgba(43,179,163,.15))"; }
      const hint = $("#ap-hint");
      if (hint) hint.textContent = "👆 Tape la ligne où placer le patient soulevé (ou ☰ à nouveau pour annuler).";
    } else {
      const hint = $("#ap-hint");
      if (hint) hint.innerHTML = "Case ✓ = dans la tournée du moment · ☰ puis une ligne = déplacer · ↑↓ = ajuster.<br>Les patients rattachés au cabinet restent visibles même décochés.";
    }
    $$("#assign-list [data-drag]").forEach(h => {
      h.onclick = e => {
        e.stopPropagation();
        const id = h.dataset.drag;
        lifted = (lifted === id) ? null : id;
        renderList();
      };
    });
    // Un tap sur une ligne quand un patient est soulevé → insertion à cette position
    $$("#assign-list [data-ap]").forEach(rowEl => {
      rowEl.onclick = e => {
        if (e.target.closest("[data-up]")||e.target.closest("[data-dn]")||e.target.closest("[data-drag]")||e.target.closest("[data-chk]")) return;
        if (!lifted) return; // sans patient soulevé : un tap sur la ligne ne fait rien
        if (lifted !== rowEl.dataset.ap){
          const a = ord.indexOf(lifted), b = ord.indexOf(rowEl.dataset.ap);
          if (a > -1 && b > -1){ ord.splice(a,1); ord.splice(b,0,lifted); }
        }
        lifted = null; renderList();
      };
      rowEl.style.cursor = lifted ? "pointer" : "default";
    });
  };

  openSheet(`
    ${navHeader("Retour", true)}
    <h3>👥 Patients — ${esc(tourName)}</h3>
    ${S.slotsEnabled ? `<div class="chips" style="margin-bottom:8px">
      <button class="chip ${editSlot==="matin"?"on":""}" id="ap-slot-m" style="flex:1;justify-content:center">☀️ Matin</button>
      <button class="chip ${editSlot==="soir"?"on":""}" id="ap-slot-s" style="flex:1;justify-content:center">🌙 Soir</button>
    </div>
    <p class="small muted" style="margin-bottom:8px">Compose et ordonne le passage <b>du ${editSlot==="matin"?"matin":"soir"}</b> — indépendant de l'autre créneau.</p>` : ""}
    <div class="chips" style="margin-bottom:10px">
      <button class="chip" id="ap-filter">🏥 Seulement ce cabinet</button>
    </div>
    <p class="small muted" id="ap-hint" style="margin-bottom:10px">Case ✓ = dans la tournée du moment · ☰ puis une ligne = déplacer · ↑↓ = ajuster.<br>Les patients rattachés au cabinet restent visibles même décochés (hospitalisation, absence…).</p>
    <div id="assign-list"></div>
    <div class="rowb" style="margin-top:14px">
      <button class="btn btn-primary" id="ap-save">Enregistrer</button>
    </div>`);
  renderList();
  if (!sheetAssignPatients.__reopen) toast("Pour déplacer : tape ☰ du patient, puis tape la ligne où le placer");
  sheetAssignPatients.__reopen = false;
  // Persistance du créneau courant en mémoire locale avant bascule
  const stashSlot = () => {
    if (!editSlot) return;
    S.slotMembers[tourName] = S.slotMembers[tourName] || {};
    S.slotOrder[tourName]   = S.slotOrder[tourName]   || {};
    S.slotMembers[tourName][editSlot] = pats.filter(p=>state[p.id]).map(p=>p.id);
    S.slotOrder[tourName][editSlot]   = ord.filter(id=>state[id]);
  };
  const switchSlot = ns => { stashSlot(); sheetAssignPatients.__reopen = true; sheetAssignPatients(tourName, ns); };
  if ($("#ap-slot-m")) $("#ap-slot-m").onclick = () => switchSlot("matin");
  if ($("#ap-slot-s")) $("#ap-slot-s").onclick = () => switchSlot("soir");
  $("#ap-filter").onclick = () => {
    filterIn = !filterIn;
    $("#ap-filter").classList.toggle("on", filterIn);
    renderList();
  };
  { const _e = $("#ap-back"); if (_e) _e.onclick = sheetTours; }
  $("#ap-save").onclick = () => {
    if (S.slotsEnabled && editSlot){
      // Enregistrer le créneau courant
      S.slotMembers[tourName] = S.slotMembers[tourName] || {};
      S.slotOrder[tourName]   = S.slotOrder[tourName]   || {};
      S.slotMembers[tourName][editSlot] = pats.filter(p=>state[p.id]).map(p=>p.id);
      S.slotOrder[tourName][editSlot]   = ord.filter(id=>state[id]);
      // Un patient présent dans AU MOINS un créneau appartient à la tournée
      const inAnySlot = new Set();
      ["matin","soir"].forEach(sl => (((S.slotMembers[tourName]||{})[sl])||[]).forEach(id=>inAnySlot.add(id)));
      pats.forEach(p => {
        const tours = (p.tours||[]).filter(t=>t!==tourName);
        if (inAnySlot.has(p.id)) tours.push(tourName);
        p.tours = tours;
      });
      save(); sheetTours(); render();
      toast("Passage du "+(editSlot==="matin"?"matin ☀️":"soir 🌙")+" enregistré ✓");
      return;
    }
    const removed = pats.filter(p => (p.tours||[]).includes(tourName) && !state[p.id]);
    if (removed.length){
      const names = removed.map(p=>p.prenom+" "+p.nom.replace("Demo-","").toUpperCase()).join(", ");
      if (!confirm(removed.length+" patient(s) vont être RETIRÉS de la tournée « "+tourName+" » :\n"+names+"\n\n(Leurs dossiers sont conservés.) Confirmer ?")) return;
    }
    pats.forEach(p => {
      const tours = (p.tours||[]).filter(t=>t!==tourName);
      if (state[p.id]) tours.push(tourName);
      p.tours = tours;
    });
    if (!S.patientOrder) S.patientOrder={};
    S.patientOrder[tourName] = ord;
    save(); sheetTours(); render();
    toast("Affectations et ordre mis à jour ✓");
  };
}

/* ---------- Annuaire d'urgence ---------- */
function sheetAnnuaire(p){
  const cats = [
    {k:"med",   lbl:"🩺 Médecin traitant"},
    {k:"fam",   lbl:"👨‍👩 Famille / Confiance"},
    {k:"pharma",lbl:"💊 Pharmacie"},
    {k:"cabinet",lbl:"🗺️ Cabinet titulaire"},
  ];
  const c = p.contacts||{};
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📞 Annuaire — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    ${cats.filter(x=>c[x.k]).map(x=>`
    <div class="rap" style="align-items:center">
      <div style="flex:1">
        <div class="rt">${x.lbl}</div>
        <div class="rs">${esc(c[x.k].nom||"")}${c[x.k].tel?" — "+esc(c[x.k].tel):""}</div>
      </div>
      ${c[x.k].tel?`<a href="tel:${esc(c[x.k].tel)}" class="btn btn-primary" style="padding:8px 16px;text-decoration:none;border-radius:12px">📞 Appeler</a>`:""}
    </div>`).join("")}
    ${!cats.some(x=>c[x.k]) ? `<p class="muted small" style="padding:16px 0;text-align:center">Aucun contact — ajoute-les dans la fiche ✏️.</p>` : ""}`);
  { const _e = $("#ann-back"); if (_e) _e.onclick = closeSheet; }
}


/* ===== nav.js ===== */
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
}

/* En-tête unifié d'une feuille — à placer en tête du HTML.
   `label` : destination du retour (« Réglages », « Fiche »…).
   `showHome` : afficher aussi le ✕ (au-delà d'un niveau de profondeur). */
function navHeader(label, showHome){
  const ARROW = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
    <path d="M15 5 L8 12 L15 19" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const CROSS = `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
    <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
  return `<div class="navbar">
    <button class="nav-back" id="nav-back" type="button">${ARROW}<span>${esc(label||"Retour")}</span></button>
    <span style="flex:1"></span>
    ${showHome ? `<button class="nav-home" id="nav-home" type="button" title="Fermer">${CROSS}</button>` : ""}
  </div>`;
}

/* Branche les boutons de l'en-tête ET enregistre le retour dans la pile,
   pour que le bouton du téléphone fasse la même chose que la flèche. */
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


/* ===== engine.js ===== */
function sheetReleve(){
  const t = workDate();   // suit la date de travail (saisie différée)
  openSheet(`
    ${navHeader("Moniteur", true)}
    <h3>📝 Éditer une relève</h3>
    <div class="field"><span class="lab">Tournée</span>
      <select id="rl-tour">
        <option value="all">🗺 Toutes les tournées</option>
        ${S.tours.map(t=>`<option value="${esc(t)}" ${t===S.curTour?"selected":""}>${esc(t)}</option>`).join("")}
      </select></div>
    <div class="rowb" style="margin-bottom:13px">
      <div style="flex:1"><span class="lab">Du</span><input id="rl-start" type="date" value="${t}"></div>
      <div style="flex:1"><span class="lab">Au</span><input id="rl-end" type="date" value="${t}"></div>
    </div>
    <div class="field"><span class="lab">Contenu</span>
      <div class="chips">
        <button class="chip big on" data-m="full">Complète</button>
        <button class="chip" data-m="events">Événements seuls</button>
        <button class="chip" data-m="select">Sélection…</button>
      </div>
      <p class="small muted" style="margin-top:7px" id="rl-hint">Tous les passages de la période, en ordre chronologique par patient.</p></div>
    <div class="field"><span class="lab">Présentation</span>
      <div class="chips">
        <button class="chip on" data-l="narratif">Narrative</button>
        <button class="chip" data-l="structure">Structurée</button>
        <button class="chip" data-l="ras">RÀS rapide</button>
        <button class="chip" data-l="medecin">🩺 Synthèse ciblée</button>
      </div>
      <p class="small muted" style="margin-top:7px" id="rl-lay-hint">Narrative : paragraphes fluides par patient et par passage.</p></div>
    <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-bottom:7px;cursor:pointer">
      <input type="checkbox" id="rl-raps" checked style="width:20px;height:20px;min-height:20px">
      Inclure les rappels en cours</label>
    <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-bottom:14px;cursor:pointer">
      <input type="checkbox" id="rl-anon" style="width:20px;height:20px;min-height:20px">
      🔒 Anonymiser les noms (M. D.) — pour partage par messagerie</label>
    <button class="btn btn-primary" id="rl-gen">Générer la relève</button>
    <button class="btn btn-ghost" id="rl-sync" style="width:100%;margin-top:8px">🔄 Envoyer le fichier dynamique de tournée</button>
    <p class="small muted" style="margin-top:6px">Le fichier dynamique met à jour l'app de ton collègue (données + countdowns), sans écraser son ordre ni son thème.</p>`);
  let mode = "full", layout = "narratif";
  const hints = { full:"Tous les passages de la période, en ordre chronologique par patient.",
    events:"Uniquement les passages marquants : alertes de constantes ou transmission écrite. La routine est résumée en une ligne.",
    select:"Tu choisis passage par passage ce qui entre dans la relève." };
  $$("#sheet .chip[data-m]").forEach(c => c.onclick = () => {
    mode = c.dataset.m;
    $$("#sheet .chip[data-m]").forEach(x=>x.classList.toggle("on",x===c));
    $("#rl-hint").textContent = hints[mode];
  });
  const layHints = {
    narratif: "Narrative : paragraphes fluides par patient et par passage.",
    structure: "Structurée : sections SOINS · CONSTANTES · BILANS/RDV · TRANSMISSIONS par patient.",
    ras: "RÀS rapide : une ligne par patient — RÀS ou anomalies. Idéal pour les messages courts.",
    medecin: "🩺 Synthèse ciblée : tu choisis les patients ET les données à inclure — pour transmettre à un médecin, un spécialiste ou un service."
  };
  $$("#sheet .chip[data-l]").forEach(c => c.onclick = () => {
    layout = c.dataset.l;
    $$("#sheet .chip[data-l]").forEach(x=>x.classList.toggle("on",x===c));
    $("#rl-lay-hint").textContent = layHints[layout] || "";
  });
  const rlSync = $("#rl-sync");
  if (rlSync) rlSync.onclick = () => ensureIdentity(() => { closeSheet(); shareSyncFile(); });
  $("#rl-gen").onclick = () => {
    if (layout === "medecin"){
      const st = $("#rl-start").value, en = $("#rl-end").value;
      const tr = $("#rl-tour") ? $("#rl-tour").value : S.curTour;
      sheetSyntheseCiblee(st, en, tr);
      return;
    }
    const start=$("#rl-start").value, end=$("#rl-end").value;
    if (start>end){ toast("La date de début dépasse la fin."); return; }
    const withRaps = $("#rl-raps").checked;
    const anon = $("#rl-anon").checked;
    const tour = $("#rl-tour").value;
    const opts = {start, end, mode, withRaps, layout, anon, tour};
    if (mode==="select") sheetSelect(start, end, withRaps, layout, tour, anon);
    else showReport(buildReleve(opts), { ...opts, regen: () => buildReleve(opts) });
  };
}

/* ---------- Synthèse ciblée : choix des patients ET des données ---------- */
function sheetSyntheseCiblee(start, end, tour){
  const pool = relevePool(tour, start, end).filter(p =>
    (p.visits||[]).some(v=>v.date>=start && v.date<=end) ||
    (p.bilans||[]).some(b=>b.statut!=="Fait") ||
    (S.rappels||[]).some(r=>!r.done && r.pid===p.id)
  );
  if (!pool.length){ toast("Aucun patient concerné sur cette période."); return; }

  const sel = {};                       // patients cochés
  pool.forEach(p => sel[p.id] = false);
  const inc = { consts:true, events:true, soins:true, bilans:true, raps:true, notes:true, hist:false };

  const render = () => {
    const nSel = Object.values(sel).filter(Boolean).length;
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>🩺 Synthèse ciblée</h3>
      <p class="small muted" style="margin-bottom:10px">Compose un document pour un médecin, un spécialiste ou un service : choisis les patients concernés, puis les données à y faire figurer.</p>

      <div class="lab">1. Patients à inclure</div>
      <div style="max-height:32vh;overflow-y:auto;margin-bottom:12px">
        ${pool.map(p=>`<button class="selv" data-sp="${esc(p.id)}" style="width:100%;text-align:left">
          <span class="box">${sel[p.id]?"✓":""}</span>
          <span class="sv">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${
      shownInfos(p).length ? ` — ${esc(shownInfos(p).map(i=>i.txt).join(" · ").slice(0,60))}` : ""}</span>
        </button>`).join("")}
      </div>

      <div class="lab">2. Données à faire figurer</div>
      <div class="chips" style="margin-bottom:12px">
        ${[["soins","✅ Soins"],["events","💬 Événements"],["consts","📊 Constantes"],
           ["notes","📝 Transmissions"],["bilans","🧪 Bilans / RDV"],["raps","📌 Rappels & ordonnances"],
           ["hist","🕑 Historique complet"]].map(([k,l])=>
          `<button class="chip ${inc[k]?"on":""}" data-inc="${k}" style="font-size:12.5px">${l}</button>`).join("")}
      </div>

      <button class="btn btn-primary" id="sc-gen" style="width:100%" ${nSel?"":"disabled"}>
        Générer ${nSel?`pour ${nSel} patient(s)`:"— coche au moins un patient"}
      </button>
      <button class="btn btn-ghost" id="sc-all" style="width:100%;margin-top:8px">${nSel===pool.length?"Tout décocher":"Tout cocher"}</button>
      <button class="btn btn-ghost" id="sc-cancel" style="width:100%;margin-top:8px">Annuler</button>`);

    $$("#sheet [data-sp]").forEach(b => b.onclick = () => { sel[b.dataset.sp] = !sel[b.dataset.sp]; render(); });
    $$("#sheet [data-inc]").forEach(b => b.onclick = () => { inc[b.dataset.inc] = !inc[b.dataset.inc]; render(); });
    $("#sc-all").onclick = () => { const all = nSel===pool.length; pool.forEach(p=>sel[p.id]=!all); render(); };
    $("#sc-cancel").onclick = closeSheet;
    const gen = $("#sc-gen");
    if (gen && nSel) gen.onclick = () => {
      const chosen = pool.filter(p=>sel[p.id]);
      const txt = buildSyntheseCiblee(chosen, start, end, inc);
      closeSheet();
      showReport(txt, { tour, start, end, regen: () => buildSyntheseCiblee(chosen, start, end, inc) });
    };
  };
  render();
}

/* Construction du texte de la synthèse ciblée */
function buildSyntheseCiblee(patients, start, end, inc){
  let out = "\u2554" + "\u2550".repeat(38) + "\u2557\n";
  out += "\u2551  SYNTH\u00c8SE INFIRMI\u00c8RE                \u2551\n";
  out += "\u255A" + "\u2550".repeat(38) + "\u255D\n";
  out += "\uD83D\uDCC5 " + (start===end ? fmtFR(start) : fmtFR(start)+" \u2192 "+fmtFR(end)) + "\n";
  out += "\uD83D\uDC65 " + patients.length + " patient(s)\n\n";

  const moment = v => {
    const d = fmtFR(v.date);
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
    return d + sl;
  };

  patients.forEach(p => {
    const vs = (p.visits||[]).filter(v=>v.date>=start && v.date<=end)
                 .sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
    out += "\u250C" + "\u2500".repeat(37) + "\n";
    out += "\u2502 \uD83D\uDC64 " + p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom
         + (ageOf(p.dob)!=null ? ", "+ageOf(p.dob)+" ans" : "") + "\n";
    out += "\u2514" + "\u2500".repeat(37) + "\n";
    shownInfos(p).forEach(it => {
      out += "  " + infoType(it.type).ic + " " + it.txt.replace(/\n+/g," \u00B7 ") + "\n";
    });

    const plan = p.plan || [];
    let planTenu = false; const evts = [], cst = [], nts = [];
    const hors = new Set();
    vs.forEach(v => {
      const sn = v.soinNotes || {};
      // Plan de référence du créneau de CE passage : un soin du soir
      // n'est pas « hors plan » parce qu'il ne figure pas au matin.
      const planV = planFor(p, S.slotsEnabled ? (v.slot || defaultSlot()) : null);
      const com = (v.soins||[]).filter(x=>sn[x]);
      const hp  = (v.soins||[]).filter(x=>!planV.includes(x) && !sn[x]);
      if ((v.soins||[]).some(x=>planV.includes(x))) planTenu = true;
      hp.forEach(x=>hors.add(x));
      com.forEach(x => evts.push("  \uD83D\uDCAC " + moment(v) + " \u2014 " + x + " : " + sn[x]));
      if (v.constRel || inc.hist){
        const cp = constParts(v.consts);
        if (cp.length){
          const al = alertes(v.consts, p.thresholds);
          cst.push("  \uD83D\uDCCA " + moment(v) + " \u2014 " + cp.join(" \u00B7 ") + (al.length?" \u26A0\uFE0F "+al.join(", "):""));
        }
      }
      if (v.note){
        if (v.dar){
          nts.push("  \uD83D\uDCCB " + moment(v) + " \u2014 Transmission structur\u00e9e (DAR) :");
          String(v.note).split("\n").filter(l=>l.trim()).forEach(l=>nts.push("     " + l.trim()));
        } else nts.push("  \uD83D\uDCDD " + moment(v) + " \u2014 " + v.note);
      }
    });

    if (inc.soins){
      if (planTenu) out += "  \u2705 Plan de soins respect\u00e9\n";
      if (hors.size) out += "  \u2795 Soins suppl\u00e9mentaires : " + [...hors].join(", ") + "\n";
    }
    if (inc.events) evts.forEach(l => out += l + "\n");
    if (inc.consts) cst.forEach(l => out += l + "\n");
    if (inc.notes)  nts.forEach(l => out += l + "\n");
    if (inc.bilans){
      (p.bilans||[]).filter(b=>b.statut!=="Fait" || inc.hist).forEach(b =>
        out += "  \uD83E\uDDEA " + bilanLine(b) + "\n");
    }
    if (inc.raps){
      /* Rappel fait dont le résultat a été noté : il devient une
         information (✅), à côté de ce qui reste à faire (📌).
         Il reste jusqu'à suppression manuelle dans l'écran Rappels. */
      (S.rappels||[]).filter(r => r.done && r.resultat && r.pid === p.id).forEach(r =>
        out += "  \u2705 " + r.resultat + "\n");
      (S.rappels||[]).filter(r=>!r.done && r.pid===p.id).forEach(r =>
        out += "  \uD83D\uDCCC " + rapType(r.type).lbl + " : " + (r.text||"") + (r.due?" ("+fmtFR(r.due)+")":"") + "\n");
    }
    out += "\n";
  });

  out += "\u2550".repeat(40) + "\n";
  out += "\uD83D\uDD52 G\u00e9n\u00e9r\u00e9e le " + fmtFR(todayISO()) + " \u00e0 " + nowHM() + "\n";
  out += "\u2550".repeat(40) + "\n";
  return out;
}

function relevePool(tour, start, end){
  const pool = activeP().filter(p => tour==="all" || (p.tours||[]).includes(tour));
  // Fins de prise en charge tombant dans la période : le collègue doit être informé
  if (start && end){
    (S.patients||[]).forEach(p => {
      // Inclure même si le dossier a ensuite été archivé : la fin de prise
      // en charge doit être annoncée au collègue, archivage ou non.
      if (p.pec && p.pec.end >= start && p.pec.end <= end && !pool.some(x=>x.id===p.id))
        pool.push(p);
    });
  }
  if (tour === "all") return pool;
  // Respecter l'ordre de passage configuré. Référence : l'ordre du MATIN
  // (c'est la séquence de tournée de référence) ; à défaut, l'ordre global.
  const ord = (S.slotsEnabled && ((S.slotOrder||{})[tour]||{}).matin)
            || ((S.slotOrder||{})[tour]||{}).soir
            || (S.patientOrder||{})[tour]
            || [];
  if (!ord.length) return pool;
  return pool.slice().sort((a,b)=>{
    const ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
    if (ia===-1 && ib===-1) return 0;   // hors ordre : à la fin, ordre inchangé
    if (ia===-1) return 1;
    if (ib===-1) return -1;
    return ia - ib;
  });
}

function sheetSelect(start, end, withRaps, layout, tour, anon){
  const pool = relevePool(tour);
  if (!pool.length){ toast("Aucun patient sur ce périmètre."); return; }
  // État par patient : inclus? + options de données + filtre de date
  const PS = {};
  pool.forEach(p => {
    const hasVisits = p.visits.filter(v=>v.date>=start&&v.date<=end).length;
    PS[p.id] = {
      on: true,
      consts: true, notes: true, bilans: true, raps: true, docs: false,
      dateFilter: "events", // "all"|"events"|"date"
      specificDate: start,
      hasVisits
    };
  });
  const renderSel = () => {
    const box = $("#sel");
    if (!box) return;
    box.innerHTML = pool.map(p => {
      const st = PS[p.id];
      const nom = anon ? (p.nom.replace("Demo-","").charAt(0)+". "+p.prenom.charAt(0)+".") : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom;
      const vsCount = p.visits.filter(v=>v.date>=start&&v.date<=end).length;
      return `<div class="rap" style="flex-direction:column;align-items:stretch;padding:10px 4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:${st.on?"8px":"0"}">
          <button class="box" data-toggle-p="${esc(p.id)}" style="width:24px;height:24px;border-radius:7px;flex-shrink:0;border:2px solid var(--border-strong);
            display:flex;align-items:center;justify-content:center;font-weight:700;
            background:${st.on?"var(--accent)":"transparent"};color:${st.on?"var(--accent-ink)":"transparent"}">${st.on?"✓":""}</button>
          <b style="flex:1">${esc(nom)}</b>
        </div>
        ${st.on ? `<div style="padding-left:32px">
          <div class="chips" style="margin-bottom:6px">
            ${[["consts","📊 Constantes"],["notes","📝 Transmissions"],["bilans","🧪 Bilans"],["raps","📌 Rappels"],["docs","📎 Docs"]].map(([k,lbl])=>
              `<button class="chip ${st[k]?"on":""}" data-opt="${esc(p.id)}:${k}" style="font-size:12px;padding:4px 10px">${lbl}</button>`
            ).join("")}
          </div>
          <div class="chips" style="margin-bottom:4px">
            <button class="chip ${st.dateFilter==="all"?"on":""}" data-df="${esc(p.id)}:all" style="font-size:12px">Tous les passages</button>
            <button class="chip ${st.dateFilter==="events"?"on":""}" data-df="${esc(p.id)}:events" style="font-size:12px">Événements ⚠</button>
            <button class="chip ${st.dateFilter==="date"?"on":""}" data-df="${esc(p.id)}:date" style="font-size:12px">Date précise</button>
          </div>
          ${st.dateFilter==="date"?`<input type="date" class="sel-date" data-sdp="${esc(p.id)}" value="${esc(st.specificDate)}" style="font-size:13px;width:100%;margin-bottom:4px">`:""}</div>` : ""}
      </div>`;
    }).join("<hr style='border:none;border-top:1px solid var(--border);margin:0'>");
  };
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🔍 Sélection fine de la relève</h3>
    <div class="small muted" style="margin-bottom:10px">Choisis ce qui est inclus pour chaque patient.</div>
    <div id="sel"></div>
    <button class="btn btn-primary" id="sel-gen" style="margin-top:14px">Générer la relève</button>`);
  renderSel();
  // Délégation des clics
  $("#sel").addEventListener("click", e => {
    const tp = e.target.closest("[data-toggle-p]");
    const opt = e.target.closest("[data-opt]");
    const df = e.target.closest("[data-df]");
    if (tp){ PS[tp.dataset.toggleP].on = !PS[tp.dataset.toggleP].on; renderSel(); }
    else if (opt){ const [id,k]=opt.dataset.opt.split(":"); PS[id][k]=!PS[id][k]; renderSel(); }
    else if (df){ const [id,v]=df.dataset.df.split(":"); PS[id].dateFilter=v; renderSel(); }
  });
  $("#sel").addEventListener("change", e => {
    const sdp = e.target.closest("[data-sdp]");
    if (sdp) PS[sdp.dataset.sdp].specificDate = e.target.value;
  });
  $("#sel-gen").onclick = () => {
    const keep = new Set(), pOpts = {};
    pool.forEach(p => {
      if (!PS[p.id].on) return;
      const st = PS[p.id];
      pOpts[p.id] = { consts:st.consts, notes:st.notes, bilans:st.bilans, raps:st.raps, docs:st.docs };
      const visits = p.visits.filter(v=>v.date>=start&&v.date<=end);
      let filtered = visits;
      if (st.dateFilter==="events") filtered=visits.filter(v=>isEvent(v));
      else if (st.dateFilter==="date") filtered=visits.filter(v=>v.date===st.specificDate);
      filtered.forEach(v=>keep.add(v.uid));
      // Si bilans sélectionnés, toujours inclus même sans passages
      if (st.bilans && bilansFor(p,start,end).length) keep.add("bilan_"+p.id);
    });
    const opts = {start, end, mode:"select", withRaps, keep, pOpts, layout, anon, tour};
    showReport(buildReleve(opts), { ...opts, regen: () => buildReleve(opts) });
  };
}

/* Bilans à faire figurer : ceux datés dans la période + tous ceux en attente */
function bilansFor(p, start, end){
  return (p.bilans||[])
    .filter(b => (b.date >= start && b.date <= end) || b.statut === "À faire")
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
}
function bilanLine(b){
  return b.type + " — " + b.statut + (b.date ? " · " + fmtFR(b.date) : "") + (b.res ? " (" + b.res + ")" : "");
}
function constParts(c){
  const cp=[]; c=c||{};
  if(c.ta)cp.push("TA "+c.ta); if(c.temp)cp.push("T° "+c.temp+"°C"); if(c.sat)cp.push("Sat "+c.sat+" %");
  if(c.selles!==undefined && c.selles!=="") cp.push(sellesTxt(c.selles));
  if(c.puls)cp.push("pouls "+c.puls); if(c.glyc)cp.push("glycémie "+c.glyc+" g/L"); if(c.douleur)cp.push("douleur "+c.douleur+"/10");
  return cp;
}

/* Corps « structuré » d'un patient : sections SOINS / CONSTANTES / BILANS / TRANSMISSIONS */
function patientStructured(shown, bils, p){
  /* Synthèse par section sur toute la période, sans répéter chaque passage.
     Le routinier se dit une fois ; l'exceptionnel est daté et situé. */
  const plan = (p && p.plan) || [];
  const moment = v => {
    const d = fmtFR(v.date);
    const sl = (v.slot && SLOT_LBL && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
    return d + sl;
  };
  let planTenu = false;
  const horsPlanTous = new Set();
  const evts = [], constsL = [], notesL = [];

  shown.forEach(v => {
    const sn = v.soinNotes || {};
    const planV = planFor(p, S.slotsEnabled ? (v.slot || defaultSlot()) : null);
    const commentes = (v.soins||[]).filter(x => sn[x]);
    const horsPlan  = (v.soins||[]).filter(x => !planV.includes(x) && !sn[x]);
    const duPlan    = (v.soins||[]).filter(x => planV.includes(x));
    if (duPlan.length) planTenu = true;
    horsPlan.forEach(x => horsPlanTous.add(x));
    commentes.forEach(x => evts.push("- " + moment(v) + " : " + x + " — " + sn[x]));
    if (!duPlan.length && !horsPlan.length && !commentes.length && (v.soins||[]).length)
      evts.push("- " + moment(v) + " : " + v.soins.join(", "));
    // Constantes : uniquement celles marquées « inclure dans la relève »
    if (v.constRel){
      const cp = constParts(v.consts);
      if (cp.length){
        const al = alertes(v.consts, p && p.thresholds);
        constsL.push("- " + moment(v) + " : " + cp.join(", ") + (al.length ? "  ⚠ " + al.join(", ") : ""));
      }
    }
    if (v.note){
      if (v.dar){
        notesL.push("- " + moment(v) + " — Transmission structurée (DAR) :");
        String(v.note).split("\n").filter(l=>l.trim()).forEach(l => notesL.push("    " + l.trim()));
      } else {
        notesL.push("- " + moment(v) + " : " + v.note);
      }
    }
  });

  let out = "";
  // SOINS : la routine en une ligne, l'exceptionnel détaillé
  const soinsLignes = [];
  if (planTenu) soinsLignes.push("- Plan de soins respecté sur la période");
  if (horsPlanTous.size) soinsLignes.push("- Soins supplémentaires : " + [...horsPlanTous].join(", "));
  if (soinsLignes.length) out += "[ SOINS ]\n" + soinsLignes.join("\n") + "\n";
  if (evts.length)    out += "[ ÉVÉNEMENTS ]\n" + evts.join("\n") + "\n";
  if (constsL.length) out += "[ CONSTANTES ]\n" + constsL.join("\n") + "\n";
  if (bils.length)    out += "[ BILANS / RDV ]\n" + bils.map(b=>"- "+bilanLine(b)).join("\n") + "\n";
  if (notesL.length)  out += "[ TRANSMISSIONS ]\n" + notesL.join("\n") + "\n";
  return out;
}


function anonName(p){
  const n = p.nom.replace("Demo-","");
  return n.charAt(0).toUpperCase() + ". " + p.prenom.charAt(0).toUpperCase() + ".";
}

function buildReleve({start, end, mode, withRaps, keep, pOpts, layout, anon, tour}){
  tour = tour || "all";
  const L = "──────────────────────────────";
  const pool = relevePool(tour, start, end);
  const poolIds = new Set(pool.map(p=>p.id));
  let alerts = [], body = "", routines = [];
  pool.forEach(p => {
    const vs = p.visits.filter(v=>v.date>=start&&v.date<=end)
      .sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));   // chronologique par patient
    const bils = bilansFor(p, start, end);
    if (!vs.length && !bils.length) return;
    vs.forEach(v => alertes(v.consts).forEach(a => alerts.push(p.nom.replace("Demo-","").toUpperCase()+" — "+fmtFR(v.date)+" : "+a)));
    let shown = vs;
    if (mode==="events") shown = vs.filter(isEvent);
    if (mode==="select") shown = vs.filter(v=>keep.has(v.uid));
    if (!shown.length && !bils.length){
      // En mode SÉLECTION, un patient coché doit toujours figurer dans la relève :
      // s'il n'a rien de notable, on affiche quand même son bloc avec
      // « Plan de soins respecté ». Le masquer donnait une relève incomplète.
      if (mode === "select"){
        if (!vs.length) return;          // aucun passage du tout sur la période
      } else {
        if (mode==="events" && vs.length) routines.push(anon ? anonName(p) : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom+" ("+vs.length+" passage"+(vs.length>1?"s":"")+")");
        return;
      }
    }
    const pNom = anon ? anonName(p) : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom;
    const po = (pOpts && pOpts[p.id]) || { consts:true, notes:true, bilans:true, raps:true, docs:false };
    const pAge = ageOf(p.dob)!=null ? ", "+ageOf(p.dob)+" ans" : "";
    const pGenre = p.genre ? " · "+p.genre : "";
    body += "\n┌─────────────────────────────────────\n";
    body += "│ 👤 " + pNom + pAge + pGenre + "\n";
    body += "└─────────────────────────────────────\n";
    shownInfos(p).forEach(it => {
      body += "  " + infoType(it.type).ic + " " + it.txt.replace(/\n+/g," · ") + "\n";
    });
    /* Plaies ouvertes : un constat daté, sans jugement clinique */
    { const l = (typeof plaieTexteReleve === "function") ? plaieTexteReleve(p) : [];
      l.forEach(t => { body += "\uD83E\uDE79 " + t + "\n"; }); }

    /* Anniversaire : le collègue qui passe doit pouvoir le souhaiter */
    { const t = (typeof annivTexte === "function") ? annivTexte(p) : "";
      if (t) body += "\uD83C\uDF82 " + t + "\n"; }

    /* Transit : jours consécutifs renseignés à 0 */
    { const n = (typeof alerteSelles === "function") ? alerteSelles(p) : 0;
      if (n) body += "\uD83D\uDCA9 " + n + " jour(s) sans selle\n"; }

    /* Une dérive lente que les seuils ne voient pas : chaque mesure est
       dans les bornes, mais la pente ne l'est pas. Constat, pas diagnostic. */
    if (typeof trendsOf === "function"){
      const tds = trendsOf(p);
      if (tds.length) body += tds.map(t =>
        (t.delta < 0 ? "📉 " : "📈 ") + trendTexte(t)).join("\n") + "\n";
    }

    /* Les pastilles portent maintenant leur précision et leur ancienneté :
       « 🩺 Médecin contacté (hier) — Dr Blanc prévenu de la TA » plutôt
       qu'une mention nue répétée chaque jour. */
    if ((p.tags||[]).length) body += "🏷️ " + p.tags.map(t=>{
      const T = PATIENT_TAGS[t]; if (!T) return t;
      const m = (p.tagMeta||{})[t] || {};
      const age = T.kind === "evt" ? tagAge(p, t) : null;
      return T.ic + " " + T.lbl
           + (age !== null ? " (" + tagAgeLbl(age) + ")" : "")
           + (m.note ? " — " + m.note : "");
    }).join(" · ") + "\n";

    if (layout === "structure"){
      body += patientStructured(shown, bils, p);
    } else if (layout === "ras"){
      const alRas = shown.flatMap(v=>alertes(v.consts));
      const soinsRas = [...new Set(shown.flatMap(v=>v.soins))];
      if (alRas.length){
        body += "  \u26a0\ufe0f " + alRas.join(", ") + "\n";
        if (soinsRas.length) body += "  Soins : " + soinsRas.join(", ") + ".\n";
      } else {
        body += "  R\u00c0S \u2014 soins conformes" + (soinsRas.length?" ("+soinsRas.join(", ")+")":"") + ".\n";
      }
      const bilsAF = bils.filter(b=>b.statut==="\u00c0 faire");
      if (bilsAF.length) body += "  En attente : " + bilsAF.map(b=>b.type).join(", ") + ".\n";
    } else if (layout === "dar"){
      const allConsts = shown.flatMap(v=>constParts(v.consts));
      const allAlerts = shown.flatMap(v=>alertes(v.consts));
      const allSoins  = [...new Set(shown.flatMap(v=>v.soins))];
      const allNotes  = shown.map(v=>v.note).filter(Boolean);
      body += "  D \u2014 " + (allConsts.length?allConsts.join(", ")+".":"\u00c9tat g\u00e9n\u00e9ral satisfaisant.") + (allAlerts.length?" \u26a0\ufe0f "+allAlerts.join(", ")+"." : "") + "\n";
      body += "  A \u2014 " + (allSoins.length?allSoins.join(", ")+".":"Aucun soin particulier ce jour.") + "\n";
      body += "  R \u2014 " + (allNotes.length?allNotes.join(" \u00b7 ")+".":"R\u00c0S.") + "\n";
      if (bils.length) body += "  Bilans/RDV : " + bils.map(bilanLine).join(" \u00b7 ") + "\n";
    } else if (layout === "medecin"){
      /* ── Synthèse médecin : seulement ce qui appelle une décision médicale ── */
      const MOTS_PLAIE = /plaie|pansement|escarre|cicatr|bourgeon|fibrin|exsudat|n[ée]crose|rougeur|inflammat/i;
      const MOTS_TTT   = /traitement|ordonnance|posologie|dose|insuline|antalgique|antibio|anticoag|arr[êe]t|instaur|modif/i;
      const MOTS_AVIS  = /m[ée]decin|avis|appel|contact|signal|urgence|r[ée][ée]valu/i;
      let bloc = "";
      shown.forEach(v => {
        // Constantes hors seuils uniquement
        const al = alertes(v.consts, p.thresholds);
        if (al.length){
          const cp = constParts(v.consts);
          bloc += "  \u26A0\uFE0F " + fmtFR(v.date) + " — " + al.join(", ")
                + (cp.length ? " (" + cp.join(" \u00B7 ") + ")" : "") + "\n";
        }
        // Soins de plaie avec leur commentaire du jour
        const sn = v.soinNotes || {};
        (v.soins||[]).forEach(so => {
          if (MOTS_PLAIE.test(so) || (sn[so] && MOTS_PLAIE.test(sn[so])))
            bloc += "  \uD83E\uDE79 " + fmtFR(v.date) + " — " + so + (sn[so] ? " : " + sn[so] : "") + "\n";
          else if (sn[so] && (MOTS_TTT.test(sn[so]) || MOTS_AVIS.test(sn[so])))
            bloc += "  \uD83D\uDC8A " + fmtFR(v.date) + " — " + so + " : " + sn[so] + "\n";
        });
        // Transmissions traitant du traitement ou demandant un avis
        if (v.note && (MOTS_TTT.test(v.note) || MOTS_AVIS.test(v.note) || MOTS_PLAIE.test(v.note)))
          bloc += "  \uD83D\uDCDD " + fmtFR(v.date) + " — " + v.note + "\n";
      });
      // Bilans en attente et rappels médicaux
      (bils||[]).filter(b => b.statut !== "Fait").forEach(b => {
        bloc += "  \uD83E\uDDEA " + bilanLine(b) + "\n";
      });
      (S.rappels||[]).filter(r => r.done && r.resultat && r.pid === p.id).forEach(r => {
        bloc += "  \u2705 " + r.resultat + "\n";
      });
      (S.rappels||[]).filter(r => !r.done && r.pid === p.id &&
        (r.type === "ordonnance" || r.type === "bilan" || r.type === "rdv")).forEach(r => {
        bloc += "  \uD83D\uDCCC " + rapType(r.type).lbl + " : " + (r.text||"") + (r.due ? " (" + fmtFR(r.due) + ")" : "") + "\n";
      });
      if (bloc) body += bloc;
      else body += "  \u2705 Rien à signaler sur le plan médical.\n";
    } else {
      /* ── Vue synthétique sur la période ──
         Plan respecté partout sans remarque → une seule ligne.
         Sinon : la ligne globale + uniquement les moments à lire,
         datés et situés (matin / soir). ── */
      // Mode sélection sans passage retenu : on s'appuie sur l'ensemble
      // des passages de la période pour établir le plan de soins respecté.
      const base = shown.length ? shown : (mode === "select" ? vs : shown);
      const plan = p.plan || [];
      const moment = v => {
        const d = fmtFR(v.date);
        const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
        return d + sl;
      };
      let planTenu = false;
      const evenements = [];

      base.forEach(v => {
        const planV = planFor(p, S.slotsEnabled ? (v.slot || defaultSlot()) : null);
        const sn = v.soinNotes || {};
        const commentes = (v.soins||[]).filter(x => sn[x]);
        const horsPlan  = (v.soins||[]).filter(x => !planV.includes(x) && !sn[x]);
        const duPlan    = (v.soins||[]).filter(x => planV.includes(x));
        if (duPlan.length) planTenu = true;

        commentes.forEach(x => {
          evenements.push("  \uD83D\uDCAC " + moment(v) + " \u2014 " + x + " : " + sn[x]);
        });
        if (horsPlan.length){
          evenements.push("  \u2795 " + moment(v) + " \u2014 Soins suppl\u00e9mentaires : " + horsPlan.join(", "));
        }
        if (!duPlan.length && !horsPlan.length && !commentes.length && (v.soins||[]).length){
          evenements.push("  \u2705 " + moment(v) + " \u2014 " + v.soins.join(", "));
        }
        // Constantes : uniquement celles que l'IDEL a choisi d'inclure (case 📤)
        if (po.consts !== false && v.constRel){
          const cp2 = constParts(v.consts);
          const al2 = alertes(v.consts, p.thresholds);
          if (cp2.length){
            evenements.push("  \uD83D\uDCCA " + moment(v) + " \u2014 " + cp2.join(" \u00B7 ")
              + (al2.length ? " \u26A0\uFE0F " + al2.join(", ") : ""));
          }
        }
        if (po.notes !== false && v.note){
          // Passage marqué DAR → bloc structuré mis en évidence
          if (v.dar){
            const lignes = String(v.note).split("\n").filter(l=>l.trim());
            evenements.push("  \uD83D\uDCCB " + moment(v) + " \u2014 Transmission structur\u00e9e (DAR)");
            lignes.forEach(l => evenements.push("     " + l.trim()));
          } else {
            evenements.push("  \uD83D\uDCDD " + moment(v) + " \u2014 " + v.note);
          }
        }
      });

      if (planTenu) body += "  \u2705 Plan de soins respect\u00e9\n";
      evenements.forEach(l => { body += l + "\n"; });
      // Fin de prise en charge survenue dans la période
      if (p.pec && p.pec.end >= start && p.pec.end <= end){
        body += "  \uD83C\uDF97\uFE0F FIN DE PRISE EN CHARGE le " + fmtFR(p.pec.end)
              + (p.pec.motif ? " \u2014 " + p.pec.motif : "") + "\n";
      }

      if (po.bilans !== false && bils.length){
        bils.forEach(b => {
          const ic = b.statut==="Fait" ? "✅" : "🧪";
          body += ic+" Bilan : " + bilanLine(b) + "\n";
        });
      }
    }

    if (po.docs !== false && po.docs && (p.docs||[]).length)
      body += "📎 Documents : " + p.docs.map(d=>esc(d.name)+(d.date?" ("+fmtFR(d.date)+")":"")).join(", ") + "\n";
    body += L + "\n";
  });
  if (mode==="events" && routines.length)
    body += "✓ Sans particularité sur la période : " + routines.join(" · ") + ".\n";

  let rapBlock = "";
  if (withRaps){
    /* Même cloisonnement que la synchro : un rappel personnel ne sort jamais,
       et un rappel de cabinet ne figure que dans la relève de CE cabinet. */
    const raps = S.rappels.filter(r => {
      if (r.done) return false;
      if (r.perso) return false;                       // personnel : jamais transmis
      if (r.pid)   return poolIds.has(r.pid);          // patient : suit son dossier
      if (r.tour)  return tour === "all" || r.tour === tour;   // cabinet
      return true;                                     // ancien rappel non typé
    })
      .sort((a,b)=>String(a.due).localeCompare(String(b.due)));
    if (raps.length){
      rapBlock = "📌 À PRÉVOIR / RAPPELS\n" + raps.map(r => {
        const rp = r.pid ? getP(r.pid) : null;
        const cd = rapCountdown(r);
        const cdTxt = cd.txt ? " [" + (cd.cls==="past"?"⚠ ":"") + cd.txt + "]" : "";
        return "  · " + rapType(r.type).lbl + (rp ? " ["+(anon?anonName(rp):rp.nom.replace("Demo-","").toUpperCase())+"]"
            : (r.tour ? " ["+r.tour+"]" : " [tournée]")) +
          (r.due?" — éch. "+fmtFR(r.due)+cdTxt:"") + " : " + r.text;
      }).join("\n") + "\n" + L + "\n";
    }
  }
  const head = "RELÈVE INFIRMIÈRE" + (tour!=="all" ? " — TOURNÉE « " + tour + " »" : "") +
    " — du " + fmtFR(start) + " au " + fmtFR(end) +
    (mode==="events"?" (événements)":mode==="select"?" (sélection)":"") +
    (layout==="structure"?" — présentation par sections":layout==="ras"?" — RÀS rapide":layout==="dar"?" — format DAR":"") + (anon?" [anonymisé]":"") + "\n" +
    "Éditée le " + new Date().toLocaleDateString("fr-FR") + " à " + nowHM() + "\n" + L + "\n" +
    (alerts.length ? "⚠ POINTS DE VIGILANCE ("+alerts.length+")\n"+alerts.map(a=>"  · "+a).join("\n")+"\n"+L+"\n" : "");
  let tail = "";
  if (typeof _finalMsg !== "undefined" && _finalMsg){
    tail += "\n" + L + "\n";
    tail += "\uD83D\uDCAC MESSAGE DE L'INFIRMIER\n";
    tail += _finalMsg.split("\n").map(l => "   " + l).join("\n") + "\n";
    tail += "   " + (S.identity ? whoami() + " \u2014 " : "") + fmtFR(todayISO()) + " \u00e0 " + nowHM() + "\n";
    tail += L + "\n";
  }
  return head + rapBlock + (body || "Aucun passage sur la période.\n") + tail;
}

/* ============================================================
   [MODULE DE PARTAGE]
   - Fabrique un vrai .docx sans dépendance (ZIP "store" + XML)
   - Sélection des documents patients à joindre
   - Partage via le menu natif (Web Share niveau 2) ;
     repli : téléchargement. En version Capacitor,

/* ===== share.js ===== */
/* ============================================================
   [MODULE DE PARTAGE]
   En version Capacitor, shareFiles()
     basculera sur le plugin @capacitor/share sans rien changer
     d'autre.
============================================================ */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n=0; n<256; n++){ let c=n; for (let k=0;k<8;k++) c = (c&1) ? (0xEDB88320 ^ (c>>>1)) : (c>>>1); t[n]=c; }
  return t;
})();
function crc32(u8){
  let c = 0xFFFFFFFF;
  for (let i=0;i<u8.length;i++) c = CRC_TABLE[(c ^ u8[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
/* ZIP sans compression (method 0) — suffisant et universellement lisible */
function zipStore(entries){ // entries: [{name, data:Uint8Array}]
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const u16 = v => new Uint8Array([v&255, (v>>8)&255]);
  const u32 = v => new Uint8Array([v&255, (v>>8)&255, (v>>16)&255, (v>>>24)&255]);
  entries.forEach(e => {
    const name = enc.encode(e.name), crc = crc32(e.data), sz = e.data.length;
    const head = [u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
                  u32(crc), u32(sz), u32(sz), u16(name.length), u16(0)];
    chunks.push(...head, name, e.data);
    central.push({name, crc, sz, offset});
    offset += head.reduce((n,a)=>n+a.length,0) + name.length + sz;
  });
  const cdStart = offset;
  central.forEach(c => {
    chunks.push(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(c.crc), u32(c.sz), u32(c.sz), u16(c.name.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(c.offset), c.name);
    offset += 46 + c.name.length;
  });
  chunks.push(u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
    u32(offset - cdStart), u32(cdStart), u16(0));
  let total = 0; chunks.forEach(c => total += c.length);
  const out = new Uint8Array(total); let p = 0;
  chunks.forEach(c => { out.set(c, p); p += c.length; });
  return out;
}
function textToDocx(text){
  const enc = new TextEncoder();
  const xml = s => String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const RPR = '<w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="20"/></w:rPr>';
  const paras = text.split("\n").map(l =>
    `<w:p><w:pPr>${RPR}</w:pPr><w:r>${RPR}<w:t xml:space="preserve">${xml(l)}</w:t></w:r></w:p>`).join("");
  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr/></w:body></w:document>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  return zipStore([
    { name:"[Content_Types].xml", data: enc.encode(contentTypes) },
    { name:"_rels/.rels", data: enc.encode(rels) },
    { name:"word/document.xml", data: enc.encode(document) }
  ]);
}
/* DOCX avec annexes : images intégrées, signets et hyperliens internes */
function docxWithAnnexes(text, annexData){
  // annexData : [{ num, name, patientLabel, mime, dataUrl (images only) }]
  const enc = new TextEncoder();
  const xml = t => String(t).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/></w:rPr>';
  const RPR_B = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="24"/><w:color w:val="005A50"/></w:rPr>';
  const RPR_LINK = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/><w:color w:val="1450DC"/><w:u w:val="single"/></w:rPr>';

  const P  = (t)     => `<w:p><w:r>${RPR}<w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`;
  const PB = (t)     => `<w:p><w:r>${RPR_B}<w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:p>`;
  const PLINK = (t, anchor) => `<w:p><w:hyperlink w:anchor="${anchor}"><w:r>${RPR_LINK}<w:t xml:space="preserve">${xml(t)}</w:t></w:r></w:hyperlink></w:p>`;
  const BOOKMARK = (id, name, content) => `<w:p><w:bookmarkStart w:id="${id}" w:name="${name}"/><w:r>${RPR_B}<w:t xml:space="preserve">${xml(content)}</w:t></w:r><w:bookmarkEnd w:id="${id}"/></w:p>`;

  // Images : chaque annexe image ajoute un fichier media + une relation
  const media = [], imgRels = [];
  let relIdx = 10;
  const IMG = (annexNum, dataUrl, mime) => {
    const ext = mime.includes("png") ? "png" : "jpeg";
    const fname = `image_annexe${annexNum}.${ext}`;
    const rid = "rIdImg"+(relIdx++);
    media.push({ name:"word/media/"+fname, data: dataUrlToU8(dataUrl) });
    imgRels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${fname}"/>`);
    // 4200000 EMU ≈ 11 cm de large, 3150000 ≈ 8,3 cm de haut
    return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
      <wp:extent cx="4200000" cy="3150000"/><wp:docPr id="${annexNum}" name="Annexe${annexNum}"/>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr><pic:cNvPr id="${annexNum}" name="Annexe${annexNum}"/><pic:cNvPicPr/></pic:nvPicPr>
            <pic:blipFill><a:blip r:embed="${rid}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
            <pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="4200000" cy="3150000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
          </pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  };

  // Corps : texte principal ligne par ligne, en repérant les lignes "Voir :" pour les hyperliens
  let body = "";
  const cleanLine = l => l.replace(/[│┌└─╔╗╚╝║═]+/g,"").trim();
  text.split("\n").forEach(l => {
    const c = cleanLine(l);
    if (!c){ body += P(""); return; }
    // Ligne "Voir : X (Annexe N)" → hyperlien vers annexeN
    const m = c.match(/Voir\s*:\s*.+\(Annexe\s*(\d+)\)/i);
    if (m){ body += PLINK("📎 "+c, "annexe"+m[1]); return; }
    if (l.includes("👤") || l.includes("\uD83D\uDC64")){ body += PB(c); return; }
    body += P(c);
  });

  // Annexes
  if (annexData.length){
    body += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    body += PB("═══ ANNEXES ═══");
    annexData.forEach(a => {
      body += BOOKMARK(100+a.num, "annexe"+a.num, "ANNEXE "+a.num+" — "+a.name+" — "+a.patientLabel);
      if (a.dataUrl && a.mime && a.mime.startsWith("image/")){
        body += IMG(a.num, a.dataUrl, a.mime);
      } else {
        body += P("→ Document joint séparément : "+a.name);
      }
      body += P("");
    });
  }

  const document =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr/></w:body></w:document>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Default Extension="png" ContentType="image/png"/>` +
    `<Default Extension="jpeg" ContentType="image/jpeg"/>` +
    `<Default Extension="jpg" ContentType="image/jpeg"/>` +
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
  const docRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    imgRels.join("") + `</Relationships>`;

  const files = [
    { name:"[Content_Types].xml", data: enc.encode(contentTypes) },
    { name:"_rels/.rels", data: enc.encode(rootRels) },
    { name:"word/document.xml", data: enc.encode(document) },
    { name:"word/_rels/document.xml.rels", data: enc.encode(docRels) },
    ...media
  ];
  return zipStore(files);
}

function dataUrlToU8(dataUrl){
  const bin = atob(dataUrl.split(",")[1]);
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function downloadBlob(name, blob){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
/* Rappel déontologique — affiché une seule fois, avant le premier partage.
   Information, pas conseil juridique : l'app n'est pas un service HDS. */
function confidentialityNotice(){
  return new Promise(resolve => {
    if (S.confidentialityAck){ resolve(true); return; }
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>🔐 Avant de partager</h3>
      <p class="small" style="line-height:1.55;margin-bottom:12px">
        Les relèves contiennent des <b>données de santé nominatives</b>.
        Les messageries grand public (WhatsApp, SMS, mail classique) ne sont
        pas conçues pour ce type d'échange.
      </p>
      <div style="background:var(--accent-soft,rgba(43,179,163,.10));border-left:4px solid var(--accent);border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:12px">
        <p class="small" style="margin:0;line-height:1.55">
          Privilégie une <b>messagerie sécurisée de santé</b> — MSSanté, Apicrypt
          ou équivalent — pour transmettre des exports nominatifs.
        </p>
      </div>
      <p class="small muted" style="margin-bottom:14px">
        Autre possibilité : <b>anonymiser la relève</b> avant l'envoi (option dans
        l'écran de génération), ou remettre le document en main propre.
      </p>
      <p class="small muted" style="margin-bottom:14px">
        JM@Santé conserve tes données uniquement sur ton appareil et n'héberge rien.
        Le choix du canal de transmission relève de ta responsabilité professionnelle.
      </p>
      <button class="btn btn-primary" id="cn-ok" style="width:100%">J'ai compris — continuer</button>
      <button class="btn btn-ghost" id="cn-cancel" style="width:100%;margin-top:8px">Annuler l'envoi</button>`);
    $("#cn-ok").onclick = () => {
      S.confidentialityAck = true; try { save(); } catch(e){}
      closeSheet(); resolve(true);
    };
    $("#cn-cancel").onclick = () => { closeSheet(); resolve(false); };
  });
}

async function shareFiles(files, title, text=""){
  // Rappel déontologique au premier partage
  if (!S.confidentialityAck){
    const ok = await confidentialityNotice();
    if (!ok) return;
  }
  /* ── Capacitor Share (Android natif) ─────────────────────────────────
     Quand on est dans l'APK, window.Capacitor est défini et on passe
     par @capacitor/share qui utilise le vrai Intent Android.
     Le fichier est d'abord écrit dans le cache Filesystem puis partagé
     via son URI content://.
     En dehors de l'APK (navigateur), repli sur Web Share Level 2 puis
     téléchargement.
  ──────────────────────────────────────────────────────────────────── */
  const inCapacitor = !!(window.Capacitor && window.Capacitor.isNativePlatform
                         && window.Capacitor.isNativePlatform());

  if (inCapacitor){
    try {
      const { Share, Filesystem } = window.Capacitor.Plugins;
      // Écrire les fichiers dans le répertoire cache
      const uris = [];
      for (const f of files){
        const ab = await f.arrayBuffer();
        // Conversion ArrayBuffer → base64 par chunks (évite les erreurs mémoire)
        const bytes = new Uint8Array(ab);
        let b64 = "";
        const CHUNK = 8192;
        for (let i=0; i<bytes.length; i+=CHUNK)
          b64 += String.fromCharCode(...bytes.subarray(i, i+CHUNK));
        const res = await Filesystem.writeFile({ path: f.name, data: btoa(b64), directory: "CACHE" });
        uris.push(res.uri);
      }
      if (uris.length === 1){
        await Share.share({ title, text, url: uris[0] });
      } else {
        // Capacitor Share 5+ supporte files[]
        await Share.share({ title, files: uris });
      }
      return true;
    } catch(e){
      if (e && (e.message||"").match(/cancel|dismiss/i)) return true;
      console.warn("Capacitor share failed, repli Web Share:", e);
    }
  }

  // Repli 1 : Web Share Level 2 (Chrome Android hors APK)
  if (navigator.canShare && navigator.canShare({ files })){
    try { await navigator.share({ files, title }); return true; }
    catch(e){ if (e && e.name === "AbortError") return true; }
  }

  // Repli 2 : téléchargement direct
  files.forEach(f => downloadBlob(f.name, f));
  toast("Partage natif indisponible ici — fichier(s) téléchargé(s).");
  return false;
}

/* Convertir un PDF (dataURL) en images de pages via pdf.js.
   Indispensable : le WebView Android bloque les data:/blob: dans
   <iframe> et <embed>, donc on rend les PDF en images. */
async function pdfToImagesGlobal(dataUrl, maxPages=5){
  if (!window.pdfjsLib) return null;
  try {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdfjs.worker.js";
    const raw = atob(String(dataUrl).split(",")[1] || dataUrl);
    const arr = new Uint8Array(raw.length);
    for (let i=0;i<raw.length;i++) arr[i] = raw.charCodeAt(i);
    const pdf = await window.pdfjsLib.getDocument({ data:arr }).promise;
    const imgs = [];
    const n = Math.min(pdf.numPages, maxPages);
    for (let p=1; p<=n; p++){
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale:1.6 });
      const cv = document.createElement("canvas");
      cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext:cv.getContext("2d"), viewport:vp }).promise;
      imgs.push({ dataUrl: cv.toDataURL("image/jpeg",0.82), w:vp.width, h:vp.height, page:p, total:pdf.numPages });
    }
    return imgs;
  } catch(e){ console.warn("pdfToImages:", e); return null; }
}

let _lastReport = null; // relève courante, pour la rouvrir après message/signature
let _keepDocs = null;   // sélection de documents conservée lors d'un réaffichage
let _keepFmt  = null;   // format d'export conservé lors d'un réaffichage
let _keepText = null;   // texte modifié à la main, à ne pas régénérer

/* Retire l'encart texte du message : PDF et HTML le rendent eux-mêmes
   avec leur propre mise en forme (sinon il apparaît deux fois, et collé
   au dernier patient à cause du découpage par bloc). */
function stripFinalMsg(t){
  return String(t).replace(/\n?\u2550{5,}\n\uD83D\uDCAC MESSAGE DE L'INFIRMIER[\s\S]*?\u2550{5,}\n?/g, "\n")
                  .replace(/\n?[\u2500\u2550-]{10,}\n\s*\uD83D\uDCAC MESSAGE DE L'INFIRMIER[\s\S]*$/g, "\n");
}
let _sigData = null;    // signature manuscrite (dataURL) pour les exports
let _finalMsg = "";     // message libre de fin de relève

function richPreview(text){
  // L'encart de message est rendu à part, sinon il s'imbrique dans le
  // cadre du dernier patient (le texte est découpé aux blocs ┌).
  const parts = ("\n"+stripFinalMsg(text)).split(/\n(?=┌)/);
  const body = parts.map(part=>{
    if (!part.trim()) return "";
    const nameLine = part.split("\n").find(l=>l.includes("👤"));
    if (!nameLine) return `<div class="rp-head">${esc(part.trim())}</div>`;
    const lines = part.split("\n").filter(l=>l.trim() && !l.match(/[┌└│]/));
    return `<div class="rp-pat"><div class="rp-nm">${esc(nameLine.replace(/[│┌└─]/g,"").trim())}</div>${
      lines.map(l=>`<div class="rp-ln">${esc(l.trim())}</div>`).join("")}</div>`;
  }).join("");
  const encart = _finalMsg ? `<div class="rp-msg">
      <div class="rp-msg-t">💬 Message de l'infirmier</div>
      <div class="rp-msg-b">${esc(_finalMsg)}</div>
      <div class="rp-msg-s">${S.identity?esc(whoami())+" — ":""}${fmtFR(todayISO())} à ${nowHM()}</div>
    </div>` : "";
  return body + encart;
}

async function showReport(text, opts, keepExtras){
  // Nouvelle relève → message et signature repartent à zéro.
  // keepExtras=true → simple réaffichage après ajout d'un message/signature.
  if (!keepExtras){ _finalMsg = ""; _sigData = null; _keepDocs = null; _keepFmt = null; _keepText = null; }
  _lastReport = { text, opts };
  const { tour } = opts;
  const label = (tour==="all"?"toutes":tour).replace(/\s+/g,"_");
  const baseName = "Releve_JMSante_"+label+"_"+(opts.start||todayISO());
  const pool = relevePool(tour);

  // Documents disponibles, regroupés par patient.
  // On ne propose que les patients qui figurent réellement dans la relève :
  // inutile d'afficher les documents de quelqu'un qui n'y apparaît pas.
  const inReport = new Set();
  try {
    (text||"").split(/\n(?=┌)/).forEach(part => {
      const nl = part.split("\n").find(l => l.includes("👤"));
      if (nl) inReport.add(nl.replace(/[│┌└─👤]/g,"").trim().toLowerCase());
    });
  } catch(e){}
  const inReleve = p => {
    if (!inReport.size) return true;            // sécurité : si le parsing échoue, on montre tout
    const n = (p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom).toLowerCase();
    const n2 = (p.prenom+" "+p.nom.replace("Demo-","").toUpperCase()).toLowerCase();
    return [...inReport].some(x => x.includes(n.split(",")[0]) || x.includes(n2.split(",")[0])
                                || n.includes(x.split(",")[0]) || n2.includes(x.split(",")[0]));
  };

  const docMeta = [];
  const docGroups = [];                          // [{ p, items:[{i, d}] }]
  pool.forEach(p => {
    const docs = p.docs || [];
    if (!docs.length || !inReleve(p)) return;
    const items = [];
    docs.forEach(d => {
      const i = docMeta.length;
      docMeta.push({ p, d, label: p.nom.replace("Demo-","").toUpperCase()+" — "+d.name+(d.date?" ("+fmtFR(d.date)+")":"") });
      items.push({ i, d });
    });
    docGroups.push({ p, items });
  });

  // Un réaffichage (retour depuis 💬 Message ou ✍️ Signer) doit conserver
  // le format choisi — sinon on repart en Texte sans que ce soit visible.
  let fmt = (keepExtras && _keepFmt) ? _keepFmt : "txt";
  // Un réaffichage (retour depuis 💬 Message ou ✍️ Signer) doit conserver
  // les documents déjà cochés — sinon la sélection est silencieusement perdue.
  const checked = new Set(keepExtras && _keepDocs ? _keepDocs : []);

  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📤 Envoyer la relève</h3>
    <div class="rp-rich" id="rp-preview">${richPreview(text)}</div>
    <textarea id="rp-edit" style="display:none;width:100%;min-height:30vh;font-family:monospace;font-size:12px">${esc(text)}</textarea>
    <button class="chip" id="rp-editbtn" style="margin-top:6px;font-size:12px">✏️ Modifier le texte avant envoi</button>
    <div class="field" style="margin-top:10px">
      <span class="lab">Format</span>
      <div class="chips" id="fmt-chips">
        <button class="chip ${fmt==="txt" ?"on":""}" data-fm="txt">🗒️ Texte</button>
        <button class="chip ${fmt==="pdf" ?"on":""}" data-fm="pdf">📑 PDF <span class="small muted">(photos intégrées)</span></button>
        <button class="chip ${fmt==="html"?"on":""}" data-fm="html">🌐 HTML <span class="small muted">(photos intégrées)</span></button>
        <button class="chip ${fmt==="docx"?"on":""}" data-fm="docx">📝 Word</button>
      </div>
    </div>
    ${docMeta.length ? `<div class="field">
      <span class="lab">📎 Docs à joindre</span>
      <div class="small muted" style="margin-bottom:8px">Choisis document par document. Photos et PDF sont intégrés dans les formats PDF/HTML, et envoyés en pièces jointes pour Texte/Word.</div>
      <div id="attlist" style="max-height:34vh;overflow-y:auto">
        ${docGroups.map(g=>`
          <div class="doc-grp">
            <div class="doc-grp-h">
              <span>👤 ${esc(g.p.nom.replace("Demo-","").toUpperCase())} ${esc(g.p.prenom)}</span>
              ${g.items.length>1?`<button class="chip doc-all" data-attall="${g.items.map(x=>x.i).join(",")}" style="font-size:11px">Tout</button>`:""}
            </div>
            ${g.items.map(({i,d})=>`<button class="selv ${checked.has(i)?"on":""}" data-att="${i}">
              <span class="box">${checked.has(i)?"✓":""}</span>
              <span class="sv">${/^image\//.test(d.mime||"")?"🖼":"📄"} ${esc(d.name)}${d.date?` <span class="small muted">${fmtFR(d.date)}</span>`:""}</span>
            </button>`).join("")}
          </div>`).join("")}
      </div></div>` : ""}
    ${voicePossible() ? `
    <div class="rowlab vi" style="margin-top:12px"><span>Note vocale</span><i></i><em>facultatif</em></div>
    <div class="rowbox vi" style="display:block;margin-bottom:4px" id="rp-voice"></div>` : ""}
    <button class="btn btn-primary" id="rp-send" style="width:100%;margin-top:12px;font-size:15px">
      📤 Envoyer<span id="rp-count"></span>
    </button>
    <div class="rowb" style="margin-top:8px;gap:8px">
      <button class="btn btn-ghost" id="rp-save" style="flex:1">💾 Enregistrer</button>
      <button class="btn btn-ghost" id="rp-sig"  style="flex:1">${_sigData?"✍️ Signé ✓":"✍️ Signer"}</button>
      <button class="btn btn-ghost" id="rp-msg"  style="flex:1">${_finalMsg?"💬 Message ✓":"💬 Message"}</button>
    </div>`);

  /* ── Note vocale ──────────────────────────────────────────
     Enregistrer, réécouter, effacer et refaire, ou compléter par
     une seconde note — le tout AVANT l'envoi. */
  function dessineVoix(){
    const z = $("#rp-voice"); if (!z) return;
    if (voiceEnCours()) return;                 // l'affichage est piloté par le minuteur
    z.innerHTML =
      _vNotes.map((n,i) => `<div class="vnote" data-vn="${n.id}">
          <button class="vplay" data-vplay="${n.id}">▶</button>
          <span class="vb">
            <span class="vt">Note ${i+1} — ${voiceFmt(n.dur)}</span>
            <span class="vs">${Math.round(n.taille/1024)} Ko</span>
          </span>
          <button class="vdel" data-vdel="${n.id}">🗑</button>
          <audio preload="none" src="${n.url}"></audio>
        </div>`).join("") +
      (_vNotes.length < VOICE_MAX_NB
        ? `<button class="vadd" id="rp-vrec">🎙 ${_vNotes.length ? "Ajouter une seconde note" : "Ajouter une note vocale"}</button>`
        : `<p class="small muted" style="margin:6px 0 0">Deux notes au maximum.</p>`);

    { const b = $("#rp-vrec"); if (b) b.onclick = demarrer; }
    z.querySelectorAll("[data-vplay]").forEach(b => b.onclick = () => {
      const au = b.closest(".vnote").querySelector("audio");
      z.querySelectorAll("audio").forEach(a => { if (a !== au){ a.pause(); a.currentTime = 0; } });
      z.querySelectorAll(".vplay").forEach(x => { if (x !== b) x.textContent = "▶"; });
      if (au.paused){ au.play(); b.textContent = "⏸"; }
      else { au.pause(); b.textContent = "▶"; }
      au.onended = () => { b.textContent = "▶"; };
    });
    z.querySelectorAll("[data-vdel]").forEach(b => b.onclick = async () => {
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Effacer cette note vocale ?",
        oui:"🗑 Effacer" })) return;
      const n = _vNotes.find(x => x.id === b.dataset.vdel);
      if (n) URL.revokeObjectURL(n.url);
      _vNotes = _vNotes.filter(x => x.id !== b.dataset.vdel);
      dessineVoix();
    });
  }

  async function demarrer(){
    const z = $("#rp-voice"); if (!z) return;
    const rendu = s => {
      const reste = Math.max(0, VOICE_MAX_S - s);
      z.innerHTML = `<div class="vrec">
        <button class="vstop" id="rp-vstop">⏹</button>
        <span class="vb">
          <span class="vt"><i class="vdot"></i> Enregistrement…</span>
          <span class="vbar"><i style="width:${Math.min(100, s/VOICE_MAX_S*100)}%"></i></span>
        </span>
        <span class="vchrono">${voiceFmt(s)}</span>
      </div>
      <p class="small muted" style="margin:5px 0 0;text-align:right">reste ${voiceFmt(reste)}</p>`;
      { const b = $("#rp-vstop"); if (b) b.onclick = () => voiceStop(); }
    };
    rendu(0);
    const ok = await voiceStart(rendu, note => {
      if (note) _vNotes.push(note);
      dessineVoix();
    });
    if (!ok) dessineVoix();
  }

  dessineVoix();

  // ── Édition à la volée ──
  let editing = false;
  $("#rp-editbtn").onclick = () => {
    editing = !editing;
    if (editing){
      $("#rp-edit").style.display = "block";
      $("#rp-preview").style.display = "none";
      $("#rp-editbtn").textContent = "✓ Terminer la modification";
      $("#rp-editbtn").classList.add("on");
    } else {
      text = $("#rp-edit").value; // le texte modifié devient LA relève
      $("#rp-preview").innerHTML = richPreview(text);
      $("#rp-edit").style.display = "none";
      $("#rp-preview").style.display = "block";
      $("#rp-editbtn").textContent = "✏️ Modifier le texte avant envoi";
      $("#rp-editbtn").classList.remove("on");
      toast("Relève modifiée ✓ (le PDF/HTML/Word reprendra ce texte)");
    }
  };
  $$("#fmt-chips .chip").forEach(c => c.onclick = () => {
    fmt = c.dataset.fm;
    $$("#fmt-chips .chip").forEach(x => x.classList.toggle("on", x===c));
  });
  const updCount = () => {
    const n = checked.size;
    $("#rp-count").textContent = n ? " + "+n+" doc"+(n>1?"s":"") : "";
  };
  const paintAtt = () => {
    $$("#attlist [data-att]").forEach(b => {
      const on = checked.has(+b.dataset.att);
      b.classList.toggle("on", on);
      b.querySelector(".box").textContent = on ? "✓" : "";
    });
    $$("#attlist [data-attall]").forEach(b => {
      const ids = b.dataset.attall.split(",").map(Number);
      b.classList.toggle("on", ids.every(i => checked.has(i)));
    });
    updCount();
  };
  $$("#attlist [data-att]").forEach(b => b.onclick = () => {
    const i = +b.dataset.att;
    checked.has(i) ? checked.delete(i) : checked.add(i);
    paintAtt();
  });
  updCount();   // refléter d'emblée une sélection conservée (retour message/signature)
  // « Tout » : coche ou décoche tous les documents de CE patient
  $$("#attlist [data-attall]").forEach(b => b.onclick = () => {
    const ids = b.dataset.attall.split(",").map(Number);
    const allOn = ids.every(i => checked.has(i));
    ids.forEach(i => allOn ? checked.delete(i) : checked.add(i));
    paintAtt();
  });

  // ── Charger un doc depuis IDB ──
  const loadDoc = id => idbGet("doc_"+id).catch(()=>null);

  // ── Trouver les docs d'un patient parmi les cases cochées ──
  const checkedDocsFor = (pid, imgOnly) => [...checked].map(i=>docMeta[i])
    .filter(x => x.p.id===pid && (!imgOnly || (x.d.mime&&x.d.mime.startsWith("image/"))));

  // ══════════════════════════════════════════════
  // SYSTÈME D'ANNEXES : docs numérotés en bas + liens
  // ══════════════════════════════════════════════
  const getAnnexes = () => [...checked].map((i,k)=>({ ...docMeta[i], num:k+1 }));

  // Convertir un PDF (dataURL) en images de pages via pdf.js
  const pdfToImages = async (dataUrl, maxPages=5) => {
    if (!window.pdfjsLib) return null;
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdfjs.worker.js";
      const raw = atob(dataUrl.split(",")[1]);
      const arr = new Uint8Array(raw.length);
      for(let i=0;i<raw.length;i++) arr[i]=raw.charCodeAt(i);
      const pdf = await window.pdfjsLib.getDocument({data:arr}).promise;
      const imgs = [];
      const n = Math.min(pdf.numPages, maxPages);
      for (let p=1; p<=n; p++){
        const page = await pdf.getPage(p);
        const vp = page.getViewport({scale:1.6});
        const cv = document.createElement("canvas");
        cv.width=vp.width; cv.height=vp.height;
        await page.render({canvasContext:cv.getContext("2d"),viewport:vp}).promise;
        imgs.push({ dataUrl: cv.toDataURL("image/jpeg",0.82), w:vp.width, h:vp.height });
      }
      return { imgs, total: pdf.numPages };
    } catch(e){ console.warn("pdfToImages:", e); return null; }
  };

  // ── PDF avec liens internes vers annexes ──
  const buildPdf = async () => {
    if (!window.jspdf) throw new Error("jsPDF absent");
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
    const M=14, maxW=182, pageH=297;
    let y=M;
    const annexes = getAnnexes();
    const linkSources = []; // { num, page, x, y, w, h }
    const linkTargets = {}; // num -> { page, y }

    const chk=(n=6)=>{ if(y+n>pageH-14){ doc.addPage(); y=M; } };
    const cl = t => (t||"")
      .replace(/\u2705/g,"+").replace(/\uD83D\uDCCA/g,"").replace(/\uD83D\uDCDD/g,"")
      .replace(/\u26A0(?:\uFE0F)?/g,"! ").replace(/\uD83D\uDCCC/g,"*")
      .replace(/\uD83E\uDDEA/g,"").replace(/\uD83D\uDCCE/g,"").replace(/\u{1F4C5}/gu,"")
      .replace(/\uD83D\uDC64/g,"").replace(/[╔╗╚╝║═╠╣]+/g,"=")
      .replace(/[┌┐└┘│├┤─]+/g,"-").replace(/[^\x00-\xFF]/g,"").trim();
    const C={ head:[0,90,80], soins:[40,160,60], consts:[60,100,200],
              note:[200,120,0], alerte:[200,0,0], rappel:[160,120,0],
              bilan:[120,60,160], link:[20,80,220], dim:[130,130,130] };
    const rgb=c=>doc.setTextColor(c[0],c[1],c[2]);

    // Bandeau
    doc.setFillColor(0,90,80); doc.rect(0,0,210,13,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
    doc.text("RELEVE INFIRMIERE - JM@Sante", M, 8);
    doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(168,222,210);
    doc.text("Tout est dans la cigale", M, 11.6);
    doc.setTextColor(0,0,0); y=24;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); rgb(C.dim);
    doc.text("Periode : "+fmtFR(opts.start||todayISO())+"   |   Tournee : "+(tour==="all"?"Toutes":cl(tour)), M, y); y+=8;
    doc.setTextColor(0,0,0);

    const parts = ("\n"+stripFinalMsg(text)).split(/\n(?=┌)/);
    for (const part of parts){
      const lines = part.split("\n").filter(l=>l.trim());
      const nameLine = lines.find(l=>l.match(/\uD83D\uDC64|👤/));
      if (!nameLine){
        lines.forEach(l=>{ const c=cl(l); if(!c||c.match(/^[-=]+$/)) return;
          chk(); doc.setFont("helvetica","normal"); doc.setFontSize(8); rgb(C.dim);
          doc.text(c,M,y); y+=5.2; });
        doc.setTextColor(0,0,0); y+=3; continue;   // respiration avant le 1er patient
      }
      // Entête patient — on descend d'abord pour que le rectangle (dessiné
      // 5.5 mm au-dessus de y) ne remonte pas sur la ligne précédente.
      chk(18);
      y += 6;
      const nameClean = cl(nameLine.replace(/[│┌└─\-]/g,""));
      doc.setFillColor(235,248,246); doc.rect(M-2,y-5.5,maxW+4,9,"F");
      doc.setFillColor(0,90,80); doc.rect(M-2,y-5.5,3.5,9,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(11); rgb(C.head);
      doc.text(nameClean, M+4, y); doc.setTextColor(0,0,0); y+=7;

      lines.forEach(l=>{
        if (l.match(/\uD83D\uDC64|👤|[│┌└─]/)) return;
        const raw = cl(l); if (!raw) return;
        let color=C.dim, prefix="  ", bold=false;
        if (l.match(/\u2705|Soins/)){ color=C.soins; prefix="  + "; }
        else if (l.match(/\uD83D\uDCCA|Constantes/)){ color=C.consts; prefix="  ~ "; }
        else if (l.match(/\u26A0|elev|basse/)){ color=C.alerte; prefix="  ! "; bold=true; }
        else if (l.match(/\uD83D\uDCDD/)){ color=C.note; prefix="  > "; }
        else if (l.match(/RAS|R\u00C0S/)){ color=C.soins; bold=true; prefix="  + "; }
        else if (l.match(/\uD83E\uDDEA|Bilan/)){ color=C.bilan; prefix="  # "; }
        else if (l.match(/\uD83D\uDCCC|Rappel/)){ color=C.rappel; prefix="  * "; }
        const val = raw.replace(/^[\s\-\+\*\|~#>!]+/,"").trim();
        if (!val || val.match(/^[-=]{3,}$/)) return;
        chk();
        doc.setFont("helvetica",bold?"bold":"normal"); doc.setFontSize(9.5);
        doc.setTextColor(color[0],color[1],color[2]);
        doc.splitTextToSize(prefix+val, maxW-6).forEach(ll=>{ chk(); doc.text(ll,M+3,y); y+=5; });
        doc.setTextColor(0,0,0);
      });

      // Liens "Voir : X (Annexe N)" pour ce patient
      let pid=null;
      const nameRaw=nameClean.toUpperCase();
      pool.forEach(p=>{ if(nameRaw.includes(p.nom.replace("Demo-","").toUpperCase().slice(0,5))) pid=p.id; });
      if (pid){
        annexes.filter(a=>a.p.id===pid).forEach(a=>{
          chk(6);
          doc.setFont("helvetica","normal"); doc.setFontSize(9); rgb(C.link);
          const linkTxt = ">> Voir : "+cl(a.d.name)+" (Annexe "+a.num+")";
          doc.text(linkTxt, M+3, y);
          const w = doc.getTextWidth(linkTxt);
          linkSources.push({ num:a.num, page:doc.internal.getCurrentPageInfo().pageNumber, x:M+3, y:y-4, w, h:5 });
          doc.setTextColor(0,0,0);
          y+=5.5;
        });
      }
      doc.setDrawColor(200,200,200); chk(4); doc.line(M,y,M+maxW,y); y+=6;
    }

    // ── ANNEXES ──
    if (annexes.length){
      doc.addPage(); y=M;
      doc.setFillColor(0,90,80); doc.rect(0,0,210,13,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
      doc.text("RELEVE INFIRMIERE - JM@Sante", M, 8);
      // « ANNEXES » aligné à DROITE : au même endroit, il se superposait au titre.
      doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(168,222,210);
      doc.text("ANNEXES", 210-M, 8.5, { align:"right" });
      doc.setTextColor(0,0,0); y=24;

      for (const a of annexes){
        chk(14);
        linkTargets[a.num] = { page:doc.internal.getCurrentPageInfo().pageNumber, y:Math.max(0,y-8) };
        // Titre annexe
        doc.setFillColor(240,240,245); doc.rect(M-2,y-5,maxW+4,8,"F");
        doc.setFont("helvetica","bold"); doc.setFontSize(10); rgb(C.head);
        doc.text("ANNEXE "+a.num+" - "+cl(a.d.name)+" - "+cl(a.p.nom.replace("Demo-","").toUpperCase()+" "+a.p.prenom), M, y);
        doc.setTextColor(0,0,0); y+=8;

        const data = await loadDoc(a.d.id);
        if (!data){ doc.setFontSize(9); rgb(C.alerte); doc.text("Document introuvable.", M, y); y+=6; doc.setTextColor(0,0,0); continue; }

        if (a.d.mime && a.d.mime.startsWith("image/")){
          chk(95);
          try {
            const ext=(a.d.mime.split("/")[1]||"jpeg").toUpperCase().replace("JPEG","JPG");
            doc.addImage(data, ext, M, y, 120, 90); y+=95;
          } catch(e){ doc.setFontSize(9); doc.text("[Image non affichable]", M, y); y+=6; }
        } else if (a.d.mime === "application/pdf"){
          // Convertir les pages en images via pdf.js
          const res = await pdfToImages(data, 4);
          if (res && res.imgs.length){
            for (const im of res.imgs){
              const ratio = im.h/im.w;
              const w = Math.min(150, maxW), h = w*ratio;
              chk(h+6);
              try { doc.addImage(im.dataUrl, "JPG", M, y, w, h); y+=h+4; }
              catch(e){ break; }
            }
            if (res.total > res.imgs.length){
              doc.setFont("helvetica","italic"); doc.setFontSize(8); rgb(C.dim);
              doc.text("("+res.total+" pages au total - "+res.imgs.length+" affichees - document complet en piece jointe)", M, y); y+=6;
              doc.setTextColor(0,0,0);
            }
          } else {
            doc.setFont("helvetica","italic"); doc.setFontSize(9); rgb(C.dim);
            doc.text("Document PDF joint separement : "+cl(a.d.name), M, y); y+=6;
            doc.setTextColor(0,0,0);
          }
        } else {
          doc.setFont("helvetica","italic"); doc.setFontSize(9); rgb(C.dim);
          doc.text("Document joint separement : "+cl(a.d.name), M, y); y+=6;
          doc.setTextColor(0,0,0);
        }
        y+=4;
      }
    }

    // ── Poser les liens cliquables ──
    linkSources.forEach(ls => {
      const t = linkTargets[ls.num];
      if (!t) return;
      doc.setPage(ls.page);
      doc.link(ls.x, ls.y, ls.w, ls.h, { pageNumber: t.page, top: t.y });
    });

    // ── Encart message de fin (option A : barre verte à gauche) ──
    if (_finalMsg){
      if (y > pageH - 50){ doc.addPage(); y = 24; }
      y += 6;
      const msgLines = doc.splitTextToSize(cl(_finalMsg), 168);
      const boxH = 16 + msgLines.length * 5;
      doc.setFillColor(245,250,248); doc.rect(M, y, 178, boxH, "F");
      doc.setFillColor(15,110,86);   doc.rect(M, y, 2.5, boxH, "F");
      doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(15,110,86);
      doc.text("MESSAGE DE L'INFIRMIER", M+7, y+7);
      doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(30,30,30);
      doc.text(msgLines, M+7, y+13);
      doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.setTextColor(110,110,110);
      const sigName = (S.identity ? whoami() : "");
      doc.text(sigName + (sigName?" — ":"") + fmtFR(todayISO()) + " à " + nowHM(), M+7, y+boxH-3.5);
      doc.setTextColor(0,0,0);
      y += boxH + 6;
    }

    // ── Signature manuscrite ──
    if (_sigData){
      if (y > pageH - 40){ doc.addPage(); y = 24; }
      y += 4;
      doc.setFont("helvetica","normal"); doc.setFontSize(8); rgb(C.dim);
      doc.text("Signature :", M, y); doc.setTextColor(0,0,0);
      try { doc.addImage(_sigData, "PNG", M, y+2, 52, 20); } catch(e){}
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5);
      if (S.identity) doc.text(whoami(), M+58, y+14);
      y += 26;
    }

    // Pied de page
    const pages=doc.internal.pages.length-1;
    for(let i=1;i<=pages;i++){
      doc.setPage(i);
      doc.setFont("helvetica","italic"); doc.setFontSize(7.5); rgb(C.dim);
      doc.text("JM@Sante - "+fmtFR(todayISO())+" "+nowHM()+" | Page "+i+"/"+pages, M, pageH-9);
      doc.text("JM@Sante by JmCve83 - Toulon production", M, pageH-5.5);
      doc.setTextColor(0,0,0);
    }
    return doc.output("arraybuffer");
  };

  // ── HTML avec ancres vers annexes ──
  const buildHtml = async () => {
    const annexes = getAnnexes();
    const css = `body{font-family:'Segoe UI',Arial,sans-serif;font-size:10.5pt;padding:16px;max-width:780px;margin:0 auto;line-height:1.55;color:#222}
      .ps{border:1px solid #d5dfe0;border-radius:10px;padding:14px;margin:14px 0;page-break-inside:avoid}
      .ph{font-weight:700;font-size:12pt;color:#005A50;border-bottom:2px solid #005A50;margin-bottom:8px;padding-bottom:5px}
      pre{white-space:pre-wrap;word-break:break-word;margin:0;font-family:inherit}
      .doclink{display:inline-block;margin:4px 0;padding:5px 12px;background:#e8f5f2;color:#005A50;border-radius:8px;text-decoration:none;font-weight:600;font-size:10pt}
      .doclink:hover{background:#d0ebe5}
      .annexe{border:2px solid #005A50;border-radius:10px;padding:14px;margin:18px 0;page-break-inside:avoid}
      .annexe h3{color:#005A50;margin:0 0 10px;font-size:11pt}
      .annexe img{max-width:100%;border-radius:6px;border:1px solid #ccc;display:block;margin:6px 0}
      .annexe embed{width:100%;height:520px;border:1px solid #ccc;border-radius:6px}
      .backtop{font-size:9pt;color:#888;text-decoration:none}
      h1{font-size:15pt;color:#005A50;border-bottom:3px solid #005A50;padding-bottom:6px}
      h2{font-size:13pt;color:#005A50;margin-top:28px;border-bottom:2px solid #005A50;padding-bottom:4px}
      @media print{@page{margin:12mm}.annexe,.ps{page-break-inside:avoid}}`;
    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Relève JM@Santé</title><style>${css}</style></head><body>`;
    html += `<div id="top" style="background:#005A50;padding:12px 16px;margin:-16px -16px 16px;display:flex;align-items:center;gap:11px">
      <svg viewBox="0 0 100 100" width="30" height="30" style="flex-shrink:0"><g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/><ellipse cx="50" cy="30" rx="15" ry="12"/><path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/><path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/><path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g><circle cx="43" cy="29" r="3" fill="#fff"/><circle cx="57" cy="29" r="3" fill="#fff"/></svg>
      <div><div style="color:#fff;font-size:15pt;font-weight:700">Relève JM@Santé — ${fmtFR(todayISO())}</div>
      <div style="color:#a8ded2;font-size:9pt;font-style:italic;margin-top:1px">Tout est dans la cigale</div></div>
    </div>`;

    const parts = ("\n"+stripFinalMsg(text)).split(/\n(?=┌)/);
    for (const part of parts){
      if (!part.trim()) continue;
      const nameLine = part.split("\n").find(l=>l.match(/\uD83D\uDC64|👤/));
      if (!nameLine){ html += `<pre style="color:#777;font-size:9pt">${esc(part.trim())}</pre>`; continue; }
      let pid=null;
      const raw=nameLine.replace(/[│┌└─\s]/g,"").replace(/👤/g,"").toUpperCase();
      pool.forEach(p=>{ if(raw.startsWith(p.nom.replace("Demo-","").toUpperCase().slice(0,5))) pid=p.id; });
      html += `<div class="ps"><div class="ph">${esc(nameLine.replace(/[│┌└─]/g,"").trim())}</div>`;
      html += `<pre>${esc(part.split("\n").filter(l=>!l.match(/[│┌└─]/)).join("\n").trim())}</pre>`;
      if (pid){
        annexes.filter(a=>a.p.id===pid).forEach(a=>{
          html += `<a class="doclink" href="#annexe-${a.num}">📎 Voir : ${esc(a.d.name)} (Annexe ${a.num})</a><br>`;
        });
      }
      html += `</div>`;
    }

    // Annexes
    if (annexes.length){
      html += `<h2 id="annexes">📎 ANNEXES</h2>`;
      for (const a of annexes){
        const data = await loadDoc(a.d.id);
        html += `<div class="annexe" id="annexe-${a.num}">`;
        html += `<h3>ANNEXE ${a.num} — ${esc(a.d.name)} — ${esc(a.p.nom.replace("Demo-","").toUpperCase())} ${esc(a.p.prenom)}${a.d.date?" · "+fmtFR(a.d.date):""}</h3>`;
        if (!data){ html += `<p style="color:#c00">Document introuvable.</p>`; }
        else if (a.d.mime && a.d.mime.startsWith("image/")){
          html += `<img src="${data}" alt="${esc(a.d.name)}">`;
        } else if (a.d.mime === "application/pdf"){
          // Rendu en images : <embed src="data:…"> est bloqué par le WebView
          // Android et laisse un cadre blanc chez le destinataire.
          const pages = await pdfToImagesGlobal(data, 8);
          if (pages && pages.length){
            pages.forEach(pg => { html += `<img src="${pg.dataUrl}" alt="${esc(a.d.name)}">`; });
            if (pages[0].total > pages.length)
              html += `<p style="font-size:9pt;color:#666">${pages[0].total - pages.length} page(s) non affichée(s) — <a href="${data}" download="${esc(a.d.name)}">télécharger le PDF complet</a></p>`;
          } else {
            html += `<p style="font-size:9pt;color:#666"><a href="${data}" download="${esc(a.d.name)}">Télécharger ${esc(a.d.name)}</a></p>`;
          }
        } else {
          html += `<p><a href="${data}" download="${esc(a.d.name)}">Télécharger ${esc(a.d.name)}</a></p>`;
        }
        html += `<a class="backtop" href="#top">↑ Retour en haut</a></div>`;
      }
    }
    if (_finalMsg){
      html += `<div style="background:#f5faf8;border:1px solid #dbe8e3;border-left:4px solid #0F6E56;padding:14px 16px;margin:24px 0 10px">
        <div style="font-size:10.5pt;letter-spacing:.06em;text-transform:uppercase;color:#0F6E56;font-weight:700;margin-bottom:7px">💬 Message de l'infirmier</div>
        <div style="font-size:11pt;line-height:1.6;color:#1a2420;white-space:pre-wrap">${esc(_finalMsg)}</div>
        <div style="font-size:9pt;color:#6b7a75;margin-top:9px">${S.identity?esc(whoami())+" — ":""}${fmtFR(todayISO())} à ${nowHM()}</div>
      </div>`;
    }
    if (_sigData){
      html += `<div style="margin:20px 0 6px">
        <div style="font-size:9pt;color:#6b7a75;margin-bottom:4px">Signature :</div>
        <img src="${_sigData}" alt="Signature" style="height:64px;border-bottom:1px solid #dbe8e3">
        ${S.identity?`<div style="font-size:9.5pt;color:#3a4a45;margin-top:4px">${esc(whoami())}</div>`:""}
      </div>`;
    }
    html += `<hr><p style="font-size:8pt;color:#999">Généré par JM@Santé le ${fmtFR(todayISO())} à ${nowHM()}</p>
      <p style="font-size:8pt;color:#aaa;text-align:center;margin-top:4px">JM@Santé by JmCve83 — Toulon production · <i>« Tout est dans la cigale »</i></p></body></html>`;
    return html;
  };

  // ── Pièces jointes séparées (non-image ou format txt/docx) ──
  const buildAtts = async () => {
    const files=[];
    const embedded=(fmt==="pdf"||fmt==="html"); // en pdf/html tout est intégré
    for (const i of [...checked]){
      const {d}=docMeta[i];
      // En PDF/HTML : images intégrées, PDF intégrés (pages converties) → seuls les autres types sont joints
      if (embedded && d.mime && (d.mime.startsWith("image/")||d.mime==="application/pdf")) continue;
      const data=await loadDoc(d.id); if(!data) continue;
      files.push(new File([dataUrlToU8(data)], d.name, {type:d.mime||"application/octet-stream"}));
    }
    return files;
  };

  // ── Construire le fichier principal ──
  const buildMain = async () => {
    if (fmt==="pdf"){
      const ab=await buildPdf();
      return new File([ab], baseName+".pdf", {type:"application/pdf"});
    }
    if (fmt==="html"){
      const hc=await buildHtml();
      return new File([hc], baseName+".html", {type:"text/html"});
    }
    if (fmt==="docx"){
      const annexes = getAnnexes();
      const annexData = [];
      for (const a of annexes){
        const data = await loadDoc(a.d.id);
        annexData.push({
          num: a.num, name: a.d.name,
          patientLabel: a.p.nom.replace("Demo-","").toUpperCase()+" "+a.p.prenom,
          mime: a.d.mime||"", dataUrl: (data && a.d.mime && a.d.mime.startsWith("image/")) ? data : null
        });
      }
      // Injecter les lignes "Voir : X (Annexe N)" dans le texte avant conversion
      let textWithLinks = text;
      const parts2 = ("\n"+text).split(/\n(?=┌)/);
      let rebuilt = "";
      for (const part of parts2){
        rebuilt += part;
        const nameLine = part.split("\n").find(l=>l.match(/👤/));
        if (nameLine){
          let pid=null;
          const raw=nameLine.replace(/[│┌└─\s]/g,"").replace(/👤/g,"").toUpperCase();
          pool.forEach(p=>{ if(raw.startsWith(p.nom.replace("Demo-","").toUpperCase().slice(0,5))) pid=p.id; });
          if (pid) annexes.filter(x=>x.p.id===pid).forEach(x=>{
            rebuilt += "\n  Voir : "+x.d.name+" (Annexe "+x.num+")";
          });
        }
        rebuilt += "\n";
      }
      return new File([docxWithAnnexes(rebuilt, annexData)], baseName+".docx",
        {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    }
    return new File([text], baseName+".txt", {type:"text/plain"});
  };

  // ── 📤 Envoyer ──
  $("#rp-send").onclick = async () => {
    const btn=$("#rp-send"); btn.disabled=true; btn.textContent="Préparation…";
    try {
      const main=await buildMain();
      const atts=await buildAtts();
      // Journal des envois (traçabilité)
      S.sendLog = S.sendLog || [];
      S.sendLog.unshift({ ts:Date.now(), tour:(tour==="all"?"Toutes":tour), fmt, n:pool.length, docs:checked.size, text });
      if (S.sendLog.length > 60) S.sendLog.length = 60;
      S.sendLog.forEach((e,i)=>{ if (i>=20) delete e.text; }); // texte conservé pour les 20 dernières
      save();
      // Message automatique adapté au format
      const fmtHint = fmt==="pdf" ? "Ouvrir avec Adobe Acrobat ou tout lecteur PDF"
        : fmt==="html" ? "Ouvrir dans Chrome ou n'importe quel navigateur"
        : fmt==="docx" ? "Ouvrir avec WPS Office, Word ou Google Docs"
        : "Fichier texte — ouvrir avec n'importe quelle app";
      const nbPats = pool.length;
      const nbAlerts = pool.reduce((n,p)=>n+p.visits.filter(v=>v.date>=(opts.start||todayISO())&&v.date<=(opts.end||todayISO())).reduce((a,v)=>a+alertes(v.consts,p.thresholds).length,0),0);
      const nbRaps = (S.rappels||[]).filter(r=>!r.done&&r.due&&daysUntil(r.due)<=1).length;
      const tourLbl=tour==="all"?"Toutes tournees":tour;
      const dateLbl=fmtFR(opts.start||todayISO())+(opts.end&&opts.end!==opts.start?" au "+fmtFR(opts.end):"");
      const st=nbPats+" patient(s)"+(nbAlerts?" - "+nbAlerts+" alerte(s)":"")+(nbRaps?" - "+nbRaps+" rappel(s) urgent(s)":"");
      /* Notes vocales : jointes au même envoi, avec la mention de secret
         professionnel. Elle ne protège pas techniquement — elle engage
         celui qui reçoit, ce qui manque à une messagerie ordinaire. */
      const vFiles = _vNotes.map((n,i) => new File([n.blob],
        "Note_vocale_" + (i+1) + "_" + (opts.start||todayISO()) + "." + voiceExt(n.mime),
        { type:n.mime }));
      const autoMsg = "Releve JM@Sante - "+tourLbl+" - "+dateLbl+"\n"+st+"\n\n> "+fmtHint
        + (vFiles.length ? VOICE_MENTION : "");
      await shareFiles([main, ...atts, ...vFiles], "Relève JM@Santé", autoMsg);
      /* Conserver les notes pour les réécouter depuis le journal des envois,
         jusqu'à ce que le ménage les efface selon le réglage. */
      for (const n of _vNotes) await voiceGarder(n);
      if (_vNotes.length){
        _vNotes.forEach(n => URL.revokeObjectURL(n.url));
        _vNotes = [];
      }
    } catch(e){ toast("Échec : "+e.message); }
    finally {
      btn.disabled=false;
      const n=checked.size;
      btn.innerHTML='📤 Envoyer'+(n?' <span id="rp-count"> + '+n+' doc'+(n>1?'s':'')+'</span>':'<span id="rp-count"></span>');
    }
  };

  // ── 💾 Enregistrer ──
  $("#rp-save").onclick = async () => {
    try {
      const main=await buildMain();
      const cap=window.Capacitor;
      if(cap&&cap.isNativePlatform&&cap.isNativePlatform()){
        const ab=await main.arrayBuffer(); const bytes=new Uint8Array(ab);
        let b64=""; for(let i=0;i<bytes.length;i+=8192) b64+=String.fromCharCode(...bytes.subarray(i,i+8192));
        const where = await saveToDevice(main.name, btoa(b64), { base64:true });
        toast("💾 Enregistré : "+where); return;
      }
      downloadBlob(main.name, main); toast("Téléchargé 💾");
    } catch(e){ toast("Erreur : "+e.message); }
  };

  // ── ✍️ Signer ──
  $("#rp-sig").onclick = () => openSignature(sig => {
    _sigData = sig || null;                       // conservée pour les exports
    const b = document.getElementById("rp-sig");
    if (b) b.textContent = sig ? "✍️ Signé ✓" : "✍️ Signer";
    else if (_lastReport){
      _keepDocs = [...checked]; _keepFmt = fmt;
      setTimeout(() => showReport(_lastReport.text, _lastReport.opts, true), 60);
    }
    toast(sig ? "Signature ajoutée aux documents ✓" : "Signature retirée");
  });

  // ── 💬 Message de fin de relève ──
  $("#rp-msg").onclick = () => {
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>💬 Message de fin de relève</h3>
      <p class="small muted" style="margin-bottom:10px">Un mot libre qui apparaîtra dans un encart en fin de document (texte, PDF, HTML et Word).</p>
      <div class="micwrap">
        <textarea id="fm-txt" rows="4" placeholder="Ex : penser à récupérer les compresses chez Mme X · portail du 12 en panne, passer par le jardin…">${esc(_finalMsg||"")}</textarea>
        <button class="micbtn" id="fm-mic" title="Dicter">🎤</button>
      </div>
      <button class="btn btn-primary" id="fm-ok" style="width:100%;margin-top:10px">Valider</button>
      ${_finalMsg?`<button class="btn btn-ghost" id="fm-del" style="width:100%;margin-top:8px">Retirer le message</button>`:""}`);
    const fmMic = $("#fm-mic");
    if (fmMic) fmMic.onclick = () => { try { dictate($("#fm-txt"), fmMic); } catch(e){ toast("Dictée indisponible"); } };
    const reopen = () => {
      // Régénérer la relève avec le message, puis revenir à l'aperçu
      _keepDocs = [...checked];          // conserver les documents cochés
      _keepFmt  = fmt;                   // ...et le format choisi
      // Si l'utilisateur a modifié le texte à la main, ne pas le régénérer :
      // ses corrections seraient silencieusement écrasées.
      _keepText = (text !== _lastReport.text) ? text : null;
      closeSheet();
      if (_lastReport){
        const o = _lastReport.opts || {};
        let txt = _lastReport.text;
        try { if (o.regen) txt = o.regen(); } catch(e){}
        if (_keepText) txt = _keepText;      // corrections manuelles préservées
        setTimeout(() => showReport(txt, o, true), 60);
      }
    };
    $("#fm-ok").onclick = () => {
      _finalMsg = $("#fm-txt").value.trim();
      toast(_finalMsg ? "Message ajouté — il figurera en fin de relève ✓" : "Message retiré");
      reopen();
    };
    const del = $("#fm-del");
    if (del) del.onclick = () => { _finalMsg = ""; toast("Message retiré"); reopen(); };
  };

  { const _e = $("#rp-close"); if (_e) _e.onclick = closeSheet; }
}


/* ---------- Feuille de route de tournée (imprimable) ---------- */
async function shareFeuilleRoute(){
  const tour = S.curTour;
  const slot = activeSlot();
  const pool = activeP().filter(p => inTourSlot(p, tour, slot));
  if (!pool.length){ toast("Aucun patient dans la tournée courante."); return; }
  const sorted = sortBySlot(pool, tour, slot);
  const rows = sorted.map((p,i)=>`
    <tr>
      <td class="num">${i+1}</td>
      <td><b>${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}</b>${shownInfos(p).map(it=>`<br><span class="ctx">${infoType(it.type).ic} ${esc(it.txt)}</span>`).join("")}
        ${(p.tags||[]).length?`<br><span class="tags">${p.tags.map(t=>PATIENT_TAGS[t]?PATIENT_TAGS[t].ic+" "+PATIENT_TAGS[t].lbl:t).join(" · ")}</span>`:""}</td>
      <td>${esc(p.address||"—")}</td>
      <td>${(p.plan||[]).map(esc).join("<br>")||"—"}</td>
      <td class="chk">☐</td>
    </tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Feuille de route</title><style>
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10pt;padding:10mm;color:#222}
    h1{font-size:14pt;color:#005A50;border-bottom:2px solid #005A50;padding-bottom:4px;margin:0 0 4px}
    .sub{color:#777;font-size:9pt;margin-bottom:10px}
    table{width:100%;border-collapse:collapse}
    th{background:#005A50;color:#fff;padding:6px 8px;text-align:left;font-size:9pt}
    td{border:1px solid #cfdedd;padding:6px 8px;vertical-align:top}
    .num{width:24px;text-align:center;font-weight:700;color:#005A50}
    .chk{width:30px;text-align:center;font-size:14pt}
    .ctx{color:#b35c00;font-size:8.5pt}
    .tags{color:#666;font-size:8.5pt}
    tr:nth-child(even) td{background:#f4faf9}
    @media print{@page{margin:8mm}}
  </style></head><body>
  <h1>🗺️ Feuille de route — ${esc(tour==="all"?"Toutes tournées":tour)}</h1>
  <div class="sub">${fmtFR(todayISO())} · ${sorted.length} patient(s) · JM@Santé</div>
  <table><tr><th>#</th><th>Patient</th><th>Adresse</th><th>Soins prévus</th><th>✓</th></tr>${rows}</table>
  </body></html>`;
  /* Aperçu d'abord : on décide ensuite d'imprimer ou d'envoyer.
     Auparavant le partage s'ouvrait directement, sans avoir rien vu. */
  const base = "Feuille_route_" + (tour==="all"?"toutes":tour).replace(/\s+/g,"_") + "_" + todayISO();
  if (typeof showFichePreview === "function"){ showFichePreview(html, base); return; }
  const file = new File([html], "Feuille_route_"+(tour==="all"?"toutes":tour).replace(/\s+/g,"_")+"_"+todayISO()+".html", { type:"text/html" });
  await shareFiles([file], "Feuille de route", "Feuille de route "+(tour==="all"?"":tour)+" — "+fmtFR(todayISO())+"\nOuvrir dans Chrome puis Imprimer pour la version papier.");
}

/* ---------- Gestionnaire global des boutons [data-a] ---------- */
document.addEventListener("click", async e => {
  const a = e.target.closest("[data-a]");
  if (!a) return;
  switch (a.dataset.a){
    case "tours":       sheetTours(); break;
    case "search":      sheetSearch(); break;
    case "seq":         toggleSeqMode(); break;
    case "new-patient": sheetPatient(null); break;
    case "new-rappel":  sheetRappels(null); break;
    case "releve":      sheetReleve(); break;
    case "quickdictate": sheetQuickDictate(); break;
    case "endtour":     terminerTournee(); break;
    case "seed":
      if (await askDialog({ ic:"🧪", titre:"Charger les données de démonstration ?", sub:"Des patients fictifs seront ajoutés à ta liste.", oui:"✓ Charger" })){ seedDemo(); save(); render(); }
      break;
    case "wipe":
      if (await askDialog({ ton:"danger", ic:"⚠️", titre:"Effacer toutes les données ?", warn:"Patients, passages, documents, réglages : tout sera perdu. Cette action est irréversible.", oui:"🗑 Tout effacer" })){ S=defaultState(); save(); render(); }
      break;
  }
});


/* ===== fiche.js ===== */
/* ============================================================
   EXPORT DE LA FICHE PATIENT
   ─────────────────────────────────────────────────────────
   L'IDEL choisit ce qui figure dans le document (identité,
   informations par type, plan de soins, contacts, bilans,
   rappels, documents, historique) et le format de sortie.
   Les documents cochés sont INTÉGRÉS (photos et PDF) dans les
   sorties PDF et HTML, listés en Word.
============================================================ */

const FICHE_BLOCS = [
  ["identite",   "Identité",        true ],
  ["acces",      "🔑 Accès",        true ],
  ["vigilance",  "⚠️ Vigilance",    true ],
  ["traitement", "💊 Traitement",   true ],
  ["atcd",       "📋 Antécédents",  true ],
  ["entourage",  "👨‍👩‍👧 Entourage", false],
  ["autre",      "📌 Autres infos", false],
  ["plan",       "Plan de soins",   true ],
  ["contacts",   "📞 Contacts",     true ],
  ["bilans",     "🧪 Bilans / RDV", false],
  ["rappels",    "📌 Rappels",      false],
  ["historique", "🕑 Historique",   false]
];

function sheetExportFiche(pid){
  const p = getP(pid);
  if (!p) return;
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();

  // Configuration par défaut, modifiable à la volée
  const inc = {};
  FICHE_BLOCS.forEach(([k,,def]) => inc[k] = def);
  const docsSel = new Set();          // documents cochés (aucun par défaut)
  let fmt = "pdf";

  const draw = () => {
    const docs = p.docs || [];
    openSheet(`
    ${navHeader("Fiche", true)}
    <h3>🖨️ Exporter la fiche</h3>
      <p class="small muted" style="margin-bottom:13px"><b>${esc(nom)}</b> — choisis ce qui doit y figurer.</p>

      <div class="lab">Contenu</div>
      <div class="chips" style="margin-bottom:14px">
        ${FICHE_BLOCS.map(([k,l])=>`<button class="chip ${inc[k]?"on":""}" data-fb="${k}" style="font-size:12.5px">${inc[k]?"✓ ":""}${l}</button>`).join("")}
      </div>

      ${docs.length ? `
        <div class="lab">📎 Documents à intégrer</div>
        <div class="small muted" style="margin-bottom:7px">Photos et PDF sont intégrés au document ; en Word ils sont listés.</div>
        <div style="max-height:22vh;overflow-y:auto;margin-bottom:14px">
          ${docs.map(d=>`<button class="selv" data-fd="${esc(d.id)}">
            <span class="box">${docsSel.has(d.id)?"✓":""}</span>
            <span class="sv">${docIcon(d)} ${esc(d.name)}${d.date?` <span class="small muted">${fmtFR(d.date)}</span>`:""}</span>
          </button>`).join("")}
        </div>` : ""}

      <div class="lab">Format</div>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip ${fmt==="pdf" ?"on":""}" data-ff="pdf"  style="flex:1;justify-content:center">📑 PDF</button>
        <button class="chip ${fmt==="html"?"on":""}" data-ff="html" style="flex:1;justify-content:center">🌐 HTML</button>
        <button class="chip ${fmt==="docx"?"on":""}" data-ff="docx" style="flex:1;justify-content:center">📝 Word</button>
      </div>

      <button class="btn btn-primary" id="fe-go" style="width:100%">📤 Exporter / Partager</button>
      <button class="btn btn-ghost" id="fe-print" style="width:100%;margin-top:8px">🖨️ Imprimer</button>
      <button class="btn btn-ghost" id="fe-cancel" style="width:100%;margin-top:8px">Annuler</button>`);

    $$("#sheet [data-fb]").forEach(b => b.onclick = () => { inc[b.dataset.fb] = !inc[b.dataset.fb]; draw(); });
    $$("#sheet [data-ff]").forEach(b => b.onclick = () => { fmt = b.dataset.ff; draw(); });
    $$("#sheet [data-fd]").forEach(b => b.onclick = () => {
      const id = b.dataset.fd;
      docsSel.has(id) ? docsSel.delete(id) : docsSel.add(id);
      draw();
    });
    $("#fe-cancel").onclick = () => sheetPatient(pid);
    $("#fe-go").onclick    = () => buildFiche(p, inc, [...docsSel], fmt, false);
    $("#fe-print").onclick = () => buildFiche(p, inc, [...docsSel], "html", true);
  };
  draw();
}

/* ---------- Génération du document ---------- */
async function buildFiche(p, inc, docIds, fmt, printIt){
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  const base = "Fiche_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();

  // Charger les documents cochés
  const docs = [];
  for (const id of docIds){
    const meta = (p.docs||[]).find(d => d.id === id);
    if (!meta) continue;
    try {
      const data = await idbGet("doc_"+id);
      if (!data) continue;
      // Les PDF sont rendus en IMAGES : <embed src="data:..."> est bloqué
      // par le WebView Android et donnait un encart blanc.
      if ((meta.mime||"").includes("pdf") || /\.pdf$/i.test(meta.name||"")){
        const pages = await pdfToImagesGlobal(data, 8);
        docs.push({ ...meta, data, pages: pages || null });
      } else {
        docs.push({ ...meta, data });
      }
    } catch(e){ /* document illisible : on l'ignore */ }
  }

  const infosOf = type => (p.infos||[]).filter(i => i.type === type && (i.txt||"").trim());

  if (fmt === "docx"){
    const txt = ficheTexte(p, inc, docs, nom);
    try { await shareDocx(txt, base + ".docx"); }
    catch(e){ await shareText(txt, base + ".txt", "text/plain"); }
    return;
  }

  const html = ficheHtml(p, inc, docs, nom);

  if (fmt === "html" && !printIt){
    await shareText(html, base + ".html", "text/html");
    return;
  }

  // PDF et impression : aperçu DANS l'app (un onglet séparé piège
  // l'utilisateur dans le WebView Android, sans retour possible).
  showFichePreview(html, base);
}

/* ---------- Aperçu de la fiche, avec sortie toujours possible ---------- */
function showFichePreview(html, base){
  const old = document.getElementById("fichePrev");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "fichePrev";
  el.className = "fiche-prev";
  el.innerHTML = `
    <div class="fp-bar">
      <button class="fp-back" id="fp-back">← Retour</button>
      <span class="fp-t">Aperçu de la fiche</span>
    </div>
    <iframe class="fp-frame" id="fp-frame"></iframe>
    <div class="fp-actions">
      <button class="btn btn-primary" id="fp-print">🖨️ Imprimer / PDF</button>
      <button class="btn btn-ghost" id="fp-share">📤 Partager</button>
    </div>`;
  document.body.appendChild(el);

  // srcdoc plutôt qu'une URL : accepté par le WebView, contrairement à data:/blob:
  const fr = el.querySelector("#fp-frame");
  /* ⚠️ Avec srcdoc l'iframe n'a PAS d'URL de base : un lien de sommaire
     « #intro » sort du cadre et recharge l'application — l'utilisateur se
     retrouve sur l'écran principal. <base target="_self"> garde la
     navigation à l'intérieur, et le script résout les ancres à la main. */
  const ancrage = `<base target="_self">
    <script>
      document.addEventListener("click", function(e){
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        e.preventDefault();
        var id = a.getAttribute("href").slice(1);
        var c = id && (document.getElementById(id) ||
                       document.querySelector('[name="' + id + '"]'));
        if (c) c.scrollIntoView({ behavior:"smooth", block:"start" });
      }, true);
    <\/script>`;
  fr.srcdoc = /<head[^>]*>/i.test(html)
    ? html.replace(/<head([^>]*)>/i, "<head$1>" + ancrage)
    : ancrage + html;

  const close = () => el.remove();
  el.querySelector("#fp-back").onclick = close;
  el.querySelector("#fp-print").onclick = () => imprimerDocument(html, base);
  el.querySelector("#fp-share").onclick = () => shareText(html, base + ".html", "text/html");
  // Sécurité : la touche retour Android ferme l'aperçu
  const onBack = ev => { if (ev.key === "Escape"){ close(); document.removeEventListener("keydown", onBack); } };
  document.addEventListener("keydown", onBack);
}

/* ---------- Rendu HTML de la fiche ---------- */
function ficheHtml(p, inc, docs, nom){
  const infosOf = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim());
  const sec = (titre, corps) => corps ? `<section><h2>${titre}</h2>${corps}</section>` : "";
  const lignes = arr => arr.map(i => `<p>${esc(i.txt).replace(/\n/g,"<br>")}</p>`).join("");

  let body = "";

  if (inc.identite){
    const age = ageOf(p.dob);
    body += sec("Identité", `<table class="kv">
      <tr><td>Nom</td><td><b>${esc(nom)}</b></td></tr>
      ${p.dob?`<tr><td>Naissance</td><td>${fmtFR(p.dob)}${age!=null?` (${age} ans)`:""}</td></tr>`:""}
      ${p.genre?`<tr><td>Sexe</td><td>${esc(p.genre)}</td></tr>`:""}
      ${p.address?`<tr><td>Adresse</td><td>${esc(adresseComplete(p))}</td></tr>`:""}
      ${(p.tours||[]).length?`<tr><td>Tournée(s)</td><td>${esc(p.tours.join(" · "))}</td></tr>`:""}
      ${p.pec?`<tr><td>Prise en charge</td><td>Terminée le ${fmtFR(p.pec.end)}${p.pec.motif?" — "+esc(p.pec.motif):""}</td></tr>`:""}
    </table>`);
  }
  ["acces","vigilance","traitement","atcd","entourage","autre"].forEach(t => {
    if (!inc[t]) return;
    const arr = infosOf(t);
    if (arr.length) body += sec(infoType(t).ic + " " + infoType(t).lbl, lignes(arr));
  });
  if (inc.plan && (p.plan||[]).length)
    body += sec("Plan de soins", `<ul>${p.plan.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`);
  if (inc.contacts){
    const c = p.contacts || {};
    const rows = Object.entries(c).filter(([,v]) => (v||"").trim())
      .map(([k,v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
    if (rows) body += sec("📞 Contacts", `<table class="kv">${rows}</table>`);
  }
  if (inc.bilans && (p.bilans||[]).length)
    body += sec("🧪 Bilans / RDV", `<ul>${p.bilans.map(b=>`<li>${esc(bilanLine(b))}</li>`).join("")}</ul>`);
  if (inc.rappels){
    const rs = (S.rappels||[]).filter(r => !r.done && r.pid === p.id);
    if (rs.length) body += sec("📌 Rappels", `<ul>${rs.map(r=>
      `<li>${esc(rapType(r.type).lbl)} : ${esc(r.text||"")}${r.due?` (${fmtFR(r.due)})`:""}</li>`).join("")}</ul>`);
  }
  if (inc.historique && (p.visits||[]).length){
    const vs = [...p.visits].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).slice(0,40);
    body += sec("🕑 Historique des passages", `<ul>${vs.map(v=>{
      const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
      const sn = v.soinNotes || {};
      const soins = (v.soins||[]).map(x => sn[x] ? `${esc(x)} <i>(${esc(sn[x])})</i>` : esc(x)).join(", ");
      const cp = constParts(v.consts);
      return `<li><b>${fmtFR(v.date)}${sl} ${esc(v.at||"")}</b> — ${soins || "—"}${
        cp.length?` · ${esc(cp.join(" · "))}`:""}${v.note?`<br><i>${esc(v.note)}</i>`:""}</li>`;
    }).join("")}</ul>`);
  }
  // Documents intégrés
  if (docs.length){
    body += `<section class="docs"><h2>📎 Documents (${docs.length})</h2>` +
      docs.map(d => {
        if ((d.mime||"").startsWith("image/"))
          return `<figure><img src="${d.data}" alt="${esc(d.name)}"><figcaption>${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""}</figcaption></figure>`;
        if ((d.mime||"").includes("pdf") || /\.pdf$/i.test(d.name||"")){
          if (d.pages && d.pages.length)
            return `<figure>${d.pages.map(pg=>`<img src="${pg.dataUrl}" alt="${esc(d.name)}">`).join("")}` +
                   `<figcaption>${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""}` +
                   `${d.pages[0].total>d.pages.length?` (${d.pages.length}/${d.pages[0].total} pages)`:""}</figcaption></figure>`;
          return `<p class="doclink">${docIcon(d)} ${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""} <i>(aperçu indisponible)</i></p>`;
        }
        return `<p class="doclink">${docIcon(d)} ${esc(d.name)}${d.date?` — ${fmtFR(d.date)}`:""} <i>(joint séparément)</i></p>`;
      }).join("") + `</section>`;
  }

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Fiche — ${esc(nom)}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;line-height:1.55;margin:0;padding:22px;font-size:11pt}
 header{background:#005A50;color:#fff;padding:14px 18px;margin:-22px -22px 20px;display:flex;align-items:center;gap:12px}
 header .t{font-size:15pt;font-weight:700}
 header .s{font-size:9pt;color:#a8ded2;font-style:italic;margin-top:1px}
 h2{font-size:11.5pt;color:#005A50;border-bottom:2px solid #d8e3df;padding-bottom:4px;margin:20px 0 8px}
 section{page-break-inside:avoid}
 p{margin:5px 0}
 ul{margin:5px 0;padding-left:20px} li{margin:3px 0}
 table.kv{width:100%;border-collapse:collapse;margin:4px 0}
 table.kv td{padding:4px 8px;border-bottom:1px solid #eef3f1;vertical-align:top}
 table.kv td:first-child{color:#6b7a75;width:34%;font-size:10pt}
 figure{margin:12px 0;page-break-inside:avoid}
 figure img{max-width:100%;max-height:420px;border:1px solid #d8e3df;border-radius:6px}
 figure embed{width:100%;height:520px;border:1px solid #d8e3df;border-radius:6px}
 figcaption{font-size:9pt;color:#6b7a75;margin-top:4px}
 .doclink{font-size:10pt;color:#3a4a45}
 footer{margin-top:26px;padding-top:10px;border-top:1px solid #d8e3df;font-size:8.5pt;color:#8a9a95;text-align:center}
 @media print{ body{padding:14px} header{margin:-14px -14px 16px} }
</style></head><body>
<header>
  <svg viewBox="0 0 100 100" width="28" height="28"><g stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/><ellipse cx="50" cy="30" rx="15" ry="12"/><path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/><path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/><path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g><circle cx="43" cy="29" r="3" fill="#fff"/><circle cx="57" cy="29" r="3" fill="#fff"/></svg>
  <div><div class="t">Fiche patient — ${esc(nom)}</div><div class="s">Tout est dans la cigale</div></div>
</header>
${body || "<p>Aucun élément sélectionné.</p>"}
<footer>Éditée le ${fmtFR(todayISO())} à ${nowHM()}${S.identity?` par ${esc(whoami())}`:""}<br>
JM@Santé by JmCve83 — document confidentiel, à transmettre par un canal sécurisé.</footer>
</body></html>`;
}

/* ---------- Rendu texte (base du Word) ---------- */
function ficheTexte(p, inc, docs, nom){
  const L = "──────────────────────────────";
  const infosOf = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim());
  let o = "FICHE PATIENT — " + nom + "\n" + L + "\n";

  if (inc.identite){
    const age = ageOf(p.dob);
    if (p.dob) o += "Naissance : " + fmtFR(p.dob) + (age!=null?` (${age} ans)`:"") + "\n";
    if (p.genre) o += "Sexe : " + p.genre + "\n";
    if (adresseComplete(p)) o += "Adresse : " + adresseComplete(p) + "\n";
    if ((p.tours||[]).length) o += "Tournée(s) : " + p.tours.join(" · ") + "\n";
    if (p.pec) o += "Prise en charge terminée le " + fmtFR(p.pec.end) + (p.pec.motif?" — "+p.pec.motif:"") + "\n";
    o += L + "\n";
  }
  ["acces","vigilance","traitement","atcd","entourage","autre"].forEach(t => {
    if (!inc[t]) return;
    const arr = infosOf(t);
    if (!arr.length) return;
    o += infoType(t).ic + " " + infoType(t).lbl.toUpperCase() + "\n";
    arr.forEach(i => o += "  " + i.txt.replace(/\n/g,"\n  ") + "\n");
    o += L + "\n";
  });
  if (inc.plan && (p.plan||[]).length){
    o += "PLAN DE SOINS\n" + p.plan.map(x=>"  · "+x).join("\n") + "\n" + L + "\n";
  }
  if (inc.contacts){
    const rows = Object.entries(p.contacts||{}).filter(([,v])=>(v||"").trim());
    if (rows.length){ o += "CONTACTS\n" + rows.map(([k,v])=>"  "+k+" : "+v).join("\n") + "\n" + L + "\n"; }
  }
  if (inc.bilans && (p.bilans||[]).length)
    o += "BILANS / RDV\n" + p.bilans.map(b=>"  · "+bilanLine(b)).join("\n") + "\n" + L + "\n";
  if (inc.rappels){
    const rs = (S.rappels||[]).filter(r=>!r.done && r.pid===p.id);
    if (rs.length) o += "RAPPELS\n" + rs.map(r=>"  · "+rapType(r.type).lbl+" : "+(r.text||"")+(r.due?" ("+fmtFR(r.due)+")":"")).join("\n") + "\n" + L + "\n";
  }
  if (inc.historique && (p.visits||[]).length){
    const vs = [...p.visits].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).slice(0,40);
    o += "HISTORIQUE DES PASSAGES\n";
    vs.forEach(v => {
      const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
      const sn = v.soinNotes || {};
      o += "  " + fmtFR(v.date) + sl + " " + (v.at||"") + " — "
         + ((v.soins||[]).map(x => sn[x] ? `${x} (${sn[x]})` : x).join(", ") || "—") + "\n";
      const cp = constParts(v.consts); if (cp.length) o += "     " + cp.join(" · ") + "\n";
      if (v.note) o += "     " + v.note + "\n";
    });
    o += L + "\n";
  }
  if (docs.length){
    o += "DOCUMENTS JOINTS (" + docs.length + ")\n";
    docs.forEach(d => o += "  " + docIcon(d) + " " + d.name + (d.date?" — "+fmtFR(d.date):"") + "\n");
    o += L + "\n";
  }
  o += "Éditée le " + fmtFR(todayISO()) + " à " + nowHM() + (S.identity?" par "+whoami():"") + "\n";
  o += "JM@Santé by JmCve83 — document confidentiel.\n";
  return o;
}

/* ---------- Partage d'un contenu texte ---------- */
async function shareText(content, filename, mime){
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    try {
      const { Filesystem, Share } = cap.Plugins;
      const b64 = btoa(unescape(encodeURIComponent(content)));
      const r = await Filesystem.writeFile({ path: filename, data: b64, directory: "CACHE" });
      await Share.share({ title: filename, url: r.uri });
      return;
    } catch(e){ if ((e.message||"").match(/cancel/i)) return; console.warn("shareText:", e); }
  }
  const blob = new Blob([content], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
  toast("Fiche exportée 📤");
}

/* ---------- Word minimal à partir du texte ---------- */
async function shareDocx(text, filename){
  const paras = text.split("\n").map(l =>
    `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join("");
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}<w:sectPr/></w:body></w:document>`;
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml": doc
  };
  const enc = new TextEncoder();
  const zip = zipStore(Object.entries(files).map(([name,content]) => ({ name, data: enc.encode(content) })));
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    const { Filesystem, Share } = cap.Plugins;
    let bin = ""; zip.forEach(b => bin += String.fromCharCode(b));
    const r = await Filesystem.writeFile({ path: filename, data: btoa(bin), directory: "CACHE" });
    await Share.share({ title: filename, url: r.uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([zip], { type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 6000);
  toast("Fiche Word exportée 📤");
}

/* ============================================================
   IMPRESSION
   ─────────────────────────────────────────────────────────
   ⚠️ Le WebView Android n'implémente PAS window.print() : l'appel
   ne fait rien et ne lève aucune erreur. Le bouton restait donc
   muet dans l'app installée, alors qu'il marchait en navigateur.

   Dans l'app : on écrit le document sur l'appareil et on l'ouvre
   avec le système, qui propose alors ses imprimantes et
   « Enregistrer en PDF ».
   En navigateur : window.print() convient.
============================================================ */
async function imprimerDocument(html, base){
  const cap = window.Capacitor;
  const natif = cap && cap.isNativePlatform && cap.isNativePlatform();

  if (!natif){
    // Navigateur : une fenêtre dédiée s'imprime mieux qu'une iframe
    try {
      const w = window.open("", "_blank");
      if (w){
        w.document.write(html); w.document.close();
        w.focus();
        setTimeout(() => { try { w.print(); } catch(e){} }, 400);
        toast("Choisis « Enregistrer en PDF » dans la boîte d'impression 📑");
        return;
      }
      const fr = document.querySelector("#fp-frame");
      if (fr && fr.contentWindow){ fr.contentWindow.focus(); fr.contentWindow.print(); return; }
    } catch(e){ logIncident("print", "Impression navigateur impossible", e); }
    toast("Impression indisponible — utilise « Partager »", "danger");
    return;
  }

  /* Android : passer par le système. On écrit le HTML puis on
     l'ouvre — le service d'impression prend le relais. */
  const fname = (base || "document") + ".html";
  try {
    const { Filesystem } = cap.Plugins;
    const f = await Filesystem.writeFile({
      path: fname, data: html, directory: "CACHE", encoding: "utf8" });
    const opener = cap.Plugins.FileOpener;
    if (opener && f && f.uri){
      await opener.open({ filePath:f.uri, contentType:"text/html" });
      toast("Choisis « Imprimer » dans le menu qui s'ouvre 🖨️");
      return;
    }
    // Sans FileOpener : le partage permet au moins d'atteindre une imprimante
    if (cap.Plugins.Share && f && f.uri){
      await cap.Plugins.Share.share({ title:"Imprimer", url:f.uri });
      return;
    }
  } catch(e){
    if (!(e && (e.message||"").match(/cancel/i)))
      logIncident("print", "Impression Android impossible", e);
  }
  toast("Impression indisponible ici — utilise « Partager » 📤", "danger");
}


/* ===== dlu.js ===== */
/* ============================================================
   DLU — DOSSIER DE LIAISON D'URGENCE
   ─────────────────────────────────────────────────────────
   Document remis au SAMU, aux pompiers ou à l'ambulancier
   quand un patient part à l'hôpital depuis son domicile.

   Trois couches :
   ① repris automatiquement de la fiche patient
   ② champs propres au DLU (autonomie — elle évolue, donc
      vierge à chaque fois)
   ③ variables du jour : constantes + motif

   Conçu pour l'urgence : tout est déjà là, on ajoute ce qui
   vient de se passer, et on transmet en un tap.
============================================================ */

function sheetDLU(pid){
  const p = getP(pid);
  if (!p) { toast("Dossier introuvable", "danger"); return; }
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;

  // Repris de la fiche
  const infoTxt = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim())
                                    .map(i => i.txt.trim()).join(" · ");
  const allergies  = infoTxt("vigilance");
  const traitement = traitTexte(p);   // fiche structurée si elle existe
  const atcd       = infoTxt("atcd");
  const acces      = infoTxt("acces");

  // Ce qui manque pour un DLU complet
  const manque = [];
  if (!(p.nir||"").trim())                  manque.push("n° de sécurité sociale");
  if (!((p.prevenir||{}).nom||"").trim())   manque.push("personne à prévenir");
  if (!traitement)                          manque.push("traitement");
  if (!allergies)                           manque.push("allergies / vigilances");

  // Variables du jour — vierges à chaque ouverture
  let auto = "";
  const cst = { ta:"", puls:"", sat:"", temp:"", glyc:"" };
  let motif = "";

  const draw = () => {
    openSheet(`
      ${navHeader("Fiche", true)}
      <h3 style="margin-bottom:2px">🚑 Dossier de liaison d'urgence</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b> — à remettre au SAMU, aux pompiers ou à l'ambulancier</p>

      <div class="dlu-auto">
        <div class="dlu-auto-h">
          <span>✓ Repris de la fiche</span>
          <button class="chip" id="dlu-edit" style="font-size:11px;padding:3px 10px">modifier</button>
        </div>
        <div class="small" style="line-height:1.75;color:var(--dim)">
          ${esc(nom)}${p.dob?` · ${ageOf(p.dob)} ans`:""}${p.genre?` · ${esc(p.genre)}`:""}
          ${p.nir?`<br>n° ${esc(p.nir)}`:""}
          ${p.address?`<br>${esc(adresseComplete(p))}`:""}${acces?` — <span class="muted">${esc(acces)}</span>`:""}
          ${(p.prevenir||{}).nom?`<br>À prévenir : ${esc(p.prevenir.nom)}${p.prevenir.tel?" — "+esc(p.prevenir.tel):""}`:""}
          ${(p.contacts||{}).med?`<br>Médecin : ${esc(p.contacts.med.nom||"")}${p.contacts.med.tel?" — "+esc(p.contacts.med.tel):""}`:""}
          ${allergies?`<br><span style="color:var(--amber)">⚠ ${esc(allergies)}</span>`:""}
          ${p.appareillages?`<br>Appareillages : ${esc(p.appareillages)}`:""}
          ${traitement?`<br>Traitement : ${esc(traitement)}`:""}
          ${atcd?`<br>Antécédents : ${esc(atcd)}`:""}
        </div>
      </div>

      ${manque.length ? `<div class="dlu-manque">
        <div class="dlu-manque-h">⚠ À compléter — ${manque.length} élément(s) manquant(s)</div>
        <div class="small">${manque.map(esc).join(" · ")}</div>
        <p class="small muted" style="margin:6px 0 0">Renseigne-les dans la fiche patient : ils y resteront pour les prochaines fois.</p>
      </div>` : ""}

      <div class="rowlab ac" style="margin-top:14px"><span>Autonomie</span><i></i><em>état actuel</em></div>
      <textarea id="dlu-auto-txt" rows="2" placeholder="Marche seul / déambulateur / fauteuil · orienté ou confus · vit seul ou accompagné…">${esc(auto)}</textarea>

      <div class="lab" style="margin-top:14px;color:var(--amber)">Aujourd'hui — ${nowHM()}</div>
      <div class="dlu-cst">
        <div><span>TA</span><input id="dlu-ta"   inputmode="text"    placeholder="14/8"  value="${esc(cst.ta)}"></div>
        <div><span>Pouls</span><input id="dlu-puls" inputmode="numeric" placeholder="80" value="${esc(cst.puls)}"></div>
        <div><span>Sat %</span><input id="dlu-sat"  inputmode="numeric" placeholder="97" value="${esc(cst.sat)}"></div>
        <div><span>T° C</span><input id="dlu-temp" inputmode="decimal" placeholder="36.8" value="${esc(cst.temp)}"></div>
        <div><span>Glyc</span><input id="dlu-glyc" inputmode="decimal" placeholder="1.1" value="${esc(cst.glyc)}"></div>
      </div>

      <div class="rowlab am" style="margin-top:12px"><span>Motif</span><i></i><em>ce qui vient de se passer</em></div>
      <div class="micwrap">
        <textarea id="dlu-motif" rows="5" placeholder="Chute vers 14h, douleur hanche droite, impossible de se relever…">${esc(motif)}</textarea>
        <button class="micbtn" id="dlu-mic" title="Dicter">🎤</button>
      </div>
      <p class="small muted" style="margin:5px 0 14px">Écris autant que nécessaire — le document s'étend sur plusieurs pages.</p>

      <button class="btn" id="dlu-show" style="width:100%;background:var(--danger);border-color:#a01c1c;color:#fff;font-size:15px">👁 Afficher le DLU</button>
      <div class="rowb" style="margin-top:8px">
        <button class="btn btn-ghost" id="dlu-share">📤 Partager</button>
        <button class="btn btn-ghost" id="dlu-print">🖨️ Imprimer</button>
      </div>`);

    bindNav(() => sheetPatient(p));

    const grab = () => {
      auto  = ($("#dlu-auto-txt")?.value || "").trim();
      motif = ($("#dlu-motif")?.value || "").trim();
      ["ta","puls","sat","temp","glyc"].forEach(k => cst[k] = ($("#dlu-"+k)?.value || "").trim());
    };
    $$("#sheet textarea, #sheet input").forEach(el => el.oninput = grab);

    const mic = $("#dlu-mic");
    if (mic) mic.onclick = () => { try { dictate($("#dlu-motif"), mic); } catch(e){ toast("Dictée indisponible"); } };
    const ed = $("#dlu-edit");
    if (ed) ed.onclick = () => sheetPatient(p);

    $("#dlu-show").onclick  = () => { grab(); dluOutput(p, { auto, cst, motif }, "show"); };
    $("#dlu-share").onclick = () => { grab(); dluOutput(p, { auto, cst, motif }, "share"); };
    $("#dlu-print").onclick = () => { grab(); dluOutput(p, { auto, cst, motif }, "print"); };
  };
  draw();
}

/* ---------- Sortie : afficher, partager ou imprimer ---------- */
function dluOutput(p, day, mode){
  const html = dluHtml(p, day);
  const base = "DLU_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();

  if (mode === "share"){
    if (typeof shareText === "function") shareText(html, base + ".html", "text/html");
    return;
  }
  // Affichage plein écran dans l'app (montrer le téléphone / imprimer)
  if (typeof showFichePreview === "function"){
    showFichePreview(html, base);
    if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
  }
}

/* ---------- Le document ---------- */
function dluHtml(p, day){
  const nom  = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const age  = ageOf(p.dob);
  const it   = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim()).map(i => i.txt.trim()).join(" · ");
  const allergies  = it("vigilance");
  const traitement = traitTexte(p);
  const atcd       = it("atcd");
  const acces      = it("acces");
  const c = day.cst || {};

  // Constantes hors seuils : mises en évidence pour l'urgentiste
  const bad = { ta:false, puls:false, sat:false, temp:false, glyc:false };
  try {
    const sys = parseFloat(String(c.ta||"").split("/")[0]);
    if (!isNaN(sys) && (sys >= 16 || sys <= 9)) bad.ta = true;
    const pu = parseFloat(c.puls); if (!isNaN(pu) && (pu >= 100 || pu <= 50)) bad.puls = true;
    const sa = parseFloat(c.sat);  if (!isNaN(sa) && sa <= 92) bad.sat = true;
    const te = parseFloat(c.temp); if (!isNaN(te) && (te >= 38 || te <= 35.5)) bad.temp = true;
    const gl = parseFloat(c.glyc); if (!isNaN(gl) && (gl >= 2.5 || gl <= 0.7)) bad.glyc = true;
  } catch(e){}
  const cv = (lbl, val, isBad, unit) => (val||"").trim()
    ? `<span class="${isBad?"cbad":""}">${lbl} ${esc(val)}${unit||""}</span>` : "";
  const consts = [cv("TA", c.ta, bad.ta), cv("Pouls", c.puls, bad.puls),
                  cv("Sat", c.sat, bad.sat, " %"), cv("T°", c.temp, bad.temp),
                  cv("Glyc", c.glyc, bad.glyc)].filter(Boolean).join(" · ");

  // Bandeau de vigilances : ce qui change une prise en charge
  const vig = [];
  if (allergies) vig.push("<b>" + esc(allergies) + "</b>");
  if (p.appareillages) vig.push(esc(p.appareillages));
  if (RX_ANTICOAG.test(traitement))
    vig.push("<b>Sous anticoagulant / antiagrégant</b>");

  const row = (k, v) => v ? `<tr><td>${k}</td><td>${v}</td></tr>` : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>DLU — ${esc(nom)}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;line-height:1.5;margin:0;padding:14px;font-size:11pt}
 header{background:#a01c1c;color:#fff;padding:10px 14px;margin:-14px -14px 12px;display:flex;align-items:center;gap:10px}
 header .ic{font-size:21px}
 header .t{font-size:14pt;font-weight:800;letter-spacing:.02em}
 header .s{font-size:8.5pt;color:#f5c6c6;margin-top:1px}
 .nm{font-size:17pt;font-weight:800;margin:0}
 .sub{font-size:10pt;color:#5a6a65;margin:1px 0 10px}
 .vig{background:#fdeaea;border-left:4px solid #a01c1c;padding:8px 11px;margin-bottom:10px;page-break-inside:avoid}
 .vig .h{font-size:8.5pt;letter-spacing:.05em;text-transform:uppercase;color:#a01c1c;font-weight:700;margin-bottom:3px}
 .mot{background:#fff8e6;border-left:4px solid #d98324;padding:8px 11px;margin-bottom:11px}
 .mot .h{font-size:8.5pt;letter-spacing:.05em;text-transform:uppercase;color:#a06a10;font-weight:700;margin-bottom:3px}
 .mot .txt{font-size:11pt;line-height:1.55;white-space:pre-wrap}
 .mot .cst{font-size:11pt;margin-top:6px;padding-top:5px;border-top:1px solid #f0dcb8}
 .cbad{color:#a01c1c;font-weight:700}
 table{width:100%;border-collapse:collapse;font-size:10.5pt}
 td{padding:4px 0;border-bottom:1px solid #eef3f1;vertical-align:top}
 td:first-child{color:#6b7a75;width:32%;padding-right:8px}
 tr:last-child td{border-bottom:none}
 .acc{color:#8a6a2a}
 footer{margin-top:14px;padding-top:8px;border-top:1px solid #d8e3df;font-size:8.5pt;color:#8a9a95;
   display:flex;justify-content:space-between}
 @media print{ body{padding:10px} header{margin:-10px -10px 10px} }
</style></head><body>
<header>
  <span class="ic">🚑</span>
  <div><div class="t">DOSSIER DE LIAISON D'URGENCE</div>
  <div class="s">Édité le ${todayISO().split("-").reverse().join("/")} à ${nowHM()} — JM@Santé</div></div>
</header>

<p class="nm">${esc(nom)}</p>
<p class="sub">${p.dob?`Né(e) le ${p.dob.split("-").reverse().join("/")}${age!=null?` (${age} ans)`:""}`:""}${p.genre?` · ${esc(p.genre)}`:""}${p.nir?` · n° ${esc(p.nir)}`:""}</p>

${vig.length ? `<div class="vig"><div class="h">⚠ Vigilances</div><div>${vig.join(" · ")}</div></div>` : ""}

${(day.motif||consts) ? `<div class="mot">
  <div class="h">Motif de l'appel — ${todayISO().split("-").reverse().join("/")} à ${nowHM()}</div>
  ${day.motif?`<div class="txt">${esc(day.motif)}</div>`:""}
  ${consts?`<div class="cst">${consts}</div>`:""}
</div>` : ""}

<table>
  ${row("Traitement", traitement ? esc(traitement) : "")}
  ${row("Antécédents", atcd ? esc(atcd) : "")}
  ${row("Autonomie", day.auto ? esc(day.auto) : "")}
  ${row("Domicile", adresseComplete(p) ? esc(adresseComplete(p)) + (acces ? `<br><span class="acc">${esc(acces)}</span>` : "") : "")}
  ${row("À prévenir", (p.prevenir||{}).nom ? esc(p.prevenir.nom) + ((p.prevenir||{}).tel ? " — " + esc(p.prevenir.tel) : "") : "")}
  ${row("Médecin traitant", (p.contacts||{}).med ? esc(p.contacts.med.nom||"") + (p.contacts.med.tel ? " — " + esc(p.contacts.med.tel) : "") : "")}
  ${row("Pharmacie", (p.contacts||{}).pharma ? esc(p.contacts.pharma.nom||"") + (p.contacts.pharma.tel ? " — " + esc(p.contacts.pharma.tel) : "") : "")}
</table>

<footer>
  <span>${S.identity ? esc(whoami()) + ", IDEL" : "IDEL"}</span>
  <span>Document confidentiel — données de santé</span>
</footer>
</body></html>`;
}


/* ===== feuilles.js ===== */
/* ============================================================
   FEUILLES — export des constantes + feuilles vierges domicile
   ─────────────────────────────────────────────────────────
   ① Export de l'historique des constantes : courbes + tableau
      (PDF / HTML / Word / Texte), aussi joignable au médecin.
   ② Trois feuilles VIERGES à laisser au domicile, pré-remplies
      à l'en-tête du patient : Constantes (avec douleur),
      Poids, Glycémies.

   Format A4 portrait, grille mensuelle 1 → 31.
   Deux densités : "serre" (tout au recto) ou "confort"
   (1-16 recto, 17-31 verso, en-tête répété).
============================================================ */

/* ─────────────────────────────────────────────────────────
   RÉGLAGES DE MISE EN PAGE
   Tout ce qui touche à la densité est ici : si les lignes
   sont trop serrées ou la police trop petite à l'impression,
   ces valeurs sont les seules à changer.
   ───────────────────────────────────────────────────────── */
const FEUILLE_CSS = {
  serre:   { row:"8.1mm",  font:"8pt",   head:"7.6pt", title:"12pt", ident:"9.5pt" },
  confort: { row:"15.5mm", font:"10pt",  head:"9pt",   title:"13pt", ident:"10.5pt" }
};

/* ---------- Point d'entrée : choix de la feuille ---------- */
function sheetFeuilles(pid){
  const p = getP(pid);
  if (!p) { toast("Dossier introuvable", "danger"); return; }
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  let type = "constantes";
  let dens = "serre";
  /* Consigne modifiée à la volée — ponctuelle : elle n'est pas enregistrée,
     l'écran rouvert repart du texte par défaut. */
  let consigne = null;

  const TYPES = [
    ["constantes", "📊", "Constantes",  "TA · pouls · T° · sat · douleur"],
    ["poids",      "⚖️", "Poids",       "date libre · écart · observations"],
    ["glycemies",  "🩸", "Glycémies",   "matin · midi · soir + insuline"]
  ];

  const draw = () => {
    openSheet(`
      ${navHeader("Fiche", true)}
      <h3 style="margin-bottom:2px">🖨️ Feuilles à laisser au domicile</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b> — feuilles vierges, déjà à son nom, à remplir à la main par tous les intervenants</p>

      <div class="rowlab ac"><span>Quelle feuille</span><i></i></div>
      <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="srcgrid" style="grid-template-columns:1fr;margin-bottom:14px">
        ${TYPES.map(([k,ic,lbl,sub])=>`
          <button class="srcbtn ${k===type?"on":""}" data-ft="${k}" style="flex-direction:row;align-items:center;gap:11px;text-align:left;padding:11px 13px">
            <span class="src-ic" style="margin:0">${ic}</span>
            <span style="flex:1;display:flex;flex-direction:column">
              <span class="src-lbl">${lbl}</span>
              <span class="src-sub">${sub}</span>
            </span>
            ${k===type?'<span style="color:var(--accent);font-size:15px">✓</span>':""}
          </button>`).join("")}
      </div>

      </div><div class="rowlab ac"><span>Densité</span><i></i><em>à tester à l'impression</em></div>
      <div class="chips" style="margin-bottom:8px">
        <button class="chip ${dens==="serre"?"on":""}"   data-fd2="serre"   style="flex:1;justify-content:center">Serrée</button>
        <button class="chip ${dens==="confort"?"on":""}" data-fd2="confort" style="flex:1;justify-content:center">Confortable</button>
      </div>
      <p class="small muted" style="margin-bottom:16px">
        ${dens==="serre"
          ? "Les 31 jours sur une seule face. Lignes de 7 mm — compact."
          : "Jours 1 à 16 au recto, 17 à 31 au verso. Lignes de 13 mm — bien plus facile à remplir. <b>Imprimer en recto-verso</b> : une seule feuille pour le mois."}
      </p>

      <div class="rowlab am"><span>Consigne en bas de feuille</span><i></i><em>modifiable</em></div>
      <div class="rowbox am" style="display:block;margin-bottom:14px">
        <textarea id="fe2-cons" rows="3" style="width:100%;font-size:var(--fs-xs);line-height:1.5"
          placeholder="Aucune consigne">${esc(consigne !== null ? consigne : consigneDefaut(p, type))}</textarea>
        <div class="rowb" style="margin-top:6px">
          <button class="btn btn-ghost btn-sm" id="fe2-cdef" style="flex:1">↩︎ Texte d'origine</button>
          <button class="btn btn-ghost btn-sm" id="fe2-cvide" style="flex:1">🚫 Aucune consigne</button>
        </div>
      </div>

      <button class="btn btn-primary" id="fe2-show" style="width:100%">👁 Aperçu &amp; impression</button>
      <div class="rowb" style="margin-top:8px">
        <button class="btn btn-ghost" id="fe2-print">🖨️ Imprimer</button>
        <button class="btn btn-ghost" id="fe2-share">📤 Partager</button>
      </div>`);

    bindNav(() => sheetPatient(p));
    $$("#sheet [data-ft]").forEach(b => b.onclick = () => { type = b.dataset.ft; consigne = null; draw(); });
    { const t = $("#fe2-cons");
      if (t) t.oninput = () => { consigne = t.value; };   // pas de redraw : on garde le curseur
    }
    { const b = $("#fe2-cdef");  if (b) b.onclick = () => { consigne = null; draw(); }; }
    { const b = $("#fe2-cvide"); if (b) b.onclick = () => { consigne = "";   draw(); }; }
    $$("#sheet [data-fd2]").forEach(b => b.onclick = () => { dens = b.dataset.fd2; draw(); });

    const out = mode => {
      const html = feuilleHtml(p, type, dens, consigne);
      const base = "Feuille_" + type + "_" + p.nom.replace("Demo-","").replace(/\s+/g,"_");
      if (mode === "share"){ shareText(html, base + ".html", "text/html"); return; }
      showFichePreview(html, base);
      if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
    };
    $("#fe2-show").onclick  = () => out("show");
    $("#fe2-print").onclick = () => out("print");
    $("#fe2-share").onclick = () => out("share");
  };
  draw();
}

/* ---------- Génération d'une feuille vierge ---------- */
/* Texte de consigne par défaut, seuils du patient inclus.
   Extrait pour que l'écran puisse le pré-remplir et le proposer
   à la modification avant impression. */
function consigneDefaut(p, type){
  const th = (p && p.thresholds) || {};
  const seuil = (k, d) => (th[k] != null && th[k] !== "") ? th[k] : d;
  const R = {
    constantes: `TA > ${seuil("ta_h",16)} ou < ${seuil("ta_b",9)} · Pouls > 100 ou < 50 · T° > ${seuil("temp_h",38)} · Sat < ${seuil("sat_b",92)} · Douleur ≥ 4 : antalgique et transmission`,
    poids:      `Prévenir le médecin si prise de plus de 2 kg en 3 jours ou 3 kg en une semaine`,
    glycemies:  `Hypoglycémie < ${seuil("gl_b",0.70)} g/L : resucrer et alerter · Hyperglycémie > ${seuil("gl_h",2.50)} g/L : prévenir le médecin`
  };
  return R[type] || "";
}

function feuilleHtml(p, type, dens, consigne){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const dob = p.dob ? p.dob.split("-").reverse().join("/") : "";
  const D = FEUILLE_CSS[dens] || FEUILLE_CSS.serre;
  const th = p.thresholds || {};

  // Seuils : ceux du patient s'ils sont définis, sinon repères généraux
  const seuil = (k, def) => (th[k] !== undefined && th[k] !== null) ? th[k] : def;
  const rappels = {
    constantes: `TA &gt; ${seuil("taHigh",16)} ou &lt; ${seuil("taLow",9)} · Pouls &gt; 100 ou &lt; 50 · T° &gt; 38 · Sat &lt; ${seuil("satLow",92)}` +
                ` · <b>Douleur ≥ 4 : antalgique et transmission</b>`,
    poids:      `Prévenir le médecin si prise de plus de 2 kg en 3 jours ou 3 kg en une semaine`,
    glycemies:  `Hypoglycémie &lt; ${seuil("glycLow",0.70)} g/L : resucrer et alerter · Hyperglycémie &gt; 2,50 g/L : prévenir le médecin`
  };

  const TITRES = {
    constantes: "SURVEILLANCE DES CONSTANTES",
    poids:      "SUIVI DU POIDS",
    glycemies:  "SURVEILLANCE GLYCÉMIQUE"
  };

  /* En-tête, répété au verso en mode confortable */
  const entete = (suite) => `
    <div class="hd">
      <div class="hd-l">
        <div class="tt">${TITRES[type]}${suite?' <span class="sui">(suite)</span>':""}</div>
        <div class="id"><b>${esc(nom)}</b>${dob?` — née le ${dob}`:""}</div>
        ${type==="poids"     ? `<div class="sub">Poids de référence : ________ kg</div>` : ""}
        ${type==="glycemies" ? `<div class="sub">Protocole : _______________________________________________</div>` : ""}
      </div>
      <div class="mois">Mois : ________ 20___</div>
    </div>`;

  /* Lignes du tableau */
  const nbCols = { constantes:8, poids:5, glycemies:9 }[type];
  const ligne = (j) => {
    const jour = (type === "poids")
      ? `<td class="dt"></td>`                        // date libre : pesée non quotidienne
      : `<td class="jr">${j}</td>`;
    const cells = new Array(nbCols - 1).fill('<td></td>').join("");
    return `<tr>${jour}${cells}</tr>`;
  };

  const entetesTable = {
    constantes: `<tr>
        <th style="width:6%">${"J"}</th>
        <th style="width:11%">TA</th><th style="width:9%">Pouls</th>
        <th style="width:9%">T°</th><th style="width:8%">Sat</th>
        <th style="width:9%" class="dl">Doul.<span>/10</span></th>
        <th style="width:36%">Observations</th><th style="width:12%">Init.</th>
      </tr>`,
    poids: `<tr>
        <th style="width:13%">Date</th><th style="width:13%">Poids</th>
        <th style="width:11%">Écart</th><th style="width:49%">Observations</th>
        <th style="width:14%">Init.</th>
      </tr>`,
    glycemies: `<tr>
        <th rowspan="2" style="width:6%">J</th>
        <th colspan="2" style="width:17%">Matin</th>
        <th colspan="2" style="width:17%">Midi</th>
        <th colspan="2" style="width:17%">Soir</th>
        <th rowspan="2" style="width:31%">Observations</th>
        <th rowspan="2" style="width:12%">Init.</th>
      </tr>
      <tr class="sub-h">
        <th>g/L</th><th>UI</th><th>g/L</th><th>UI</th><th>g/L</th><th>UI</th>
      </tr>`
  };

  const table = (from, to) => `<table>
      ${entetesTable[type]}
      ${Array.from({length: to-from+1}, (_,i) => ligne(from+i)).join("")}
    </table>`;

  /* Une consigne modifiée à la volée remplace celle du type.
     Le texte saisi est échappé : un < ou un & casserait la mise en page.
     Chaîne vide = aucune consigne (l'IDEL a vidé le champ). */
  const txtPied = (consigne !== undefined && consigne !== null)
    ? esc(String(consigne).trim()) : rappels[type];
  const pied = txtPied
    ? `<div class="sp"></div><div class="pd">${txtPied}</div>`
    : `<div class="sp"></div>`;

  // Courbe uniquement sur la feuille de poids
  const courbe = type !== "poids" ? "" : `
    <svg class="crb" viewBox="0 0 310 ${dens==="serre"?70:90}" preserveAspectRatio="none">
      ${[...Array(5)].map((_,i)=>`<line x1="0" y1="${(i+1)*(dens==="serre"?12:16)}" x2="310" y2="${(i+1)*(dens==="serre"?12:16)}" stroke="#e4ece9" stroke-width="0.4"/>`).join("")}
      ${[...Array(9)].map((_,i)=>`<line x1="${(i+1)*31}" y1="0" x2="${(i+1)*31}" y2="${dens==="serre"?70:90}" stroke="#eef3f1" stroke-width="0.3"/>`).join("")}
      <text x="2" y="8" font-size="5" fill="var(--faint)">kg</text>
    </svg>`;

  const corps = (dens === "serre")
    ? `<div class="pg">${entete(false)}${courbe}${table(1,31)}${pied}</div>`
    : `<div class="pg">${entete(false)}${courbe}${table(1,16)}${pied}
         <div class="verso-note">Suite au verso →</div></div>
       <div class="pg brk">${entete(true)}${table(17,31)}${pied}</div>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>${TITRES[type]} — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:9mm 8mm; }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0}
 .pg{ display:flex; flex-direction:column; min-height:277mm; }
 .sp{ flex:1 }   /* pousse le pied de page en bas sans étirer le tableau */
 .brk{ page-break-before:always; }
 .hd{ display:flex; justify-content:space-between; align-items:flex-end;
      border-bottom:2px solid #005A50; padding-bottom:4px; margin-bottom:5px; flex-shrink:0 }
 .hd .tt{ font-size:${D.title}; font-weight:800; color:#005A50; letter-spacing:.02em }
 .hd .sui{ font-weight:400; font-size:9pt; color:#6b7a75 }
 .hd .id{ font-size:${D.ident}; margin-top:1px }
 .hd .sub{ font-size:8.5pt; color:#5a6a65; margin-top:2px }
 .hd .mois{ font-size:8.5pt; color:#5a6a65; border:1px solid #c8d8d3;
            padding:2px 8px; border-radius:3px; white-space:nowrap }
 .crb{ width:100%; height:${dens==="serre"?"22mm":"30mm"}; border:1px solid #c8d8d3;
       margin-bottom:4px; flex-shrink:0 }
 table{ width:100%; border-collapse:collapse; font-size:${D.font};
        table-layout:fixed }
 th{ border:1px solid #b8ccc6; background:#eef3f1; padding:3px 1px;
     font-size:${D.head}; font-weight:700; text-align:center;
     height:auto; line-height:1.15 }
 thead th, table > tr:first-child th{ height:6mm }
 th span{ display:block; font-weight:400; font-size:.8em; color:#5a6a65 }
 th.dl{ background:#fdf0e6 }
 tr.sub-h th{ background:#f5f8f7; font-weight:400; font-size:.85em }
 td{ border:1px solid #dde7e3; height:${D.row} }
 td.jr{ text-align:center; color:#7a8a85; font-weight:600; background:#f7faf9; font-size:.95em }
 td.dt{ background:#fafcfb }
 tbody tr:nth-child(even) td{ background:#fbfdfc }
 tr:nth-child(even) td.jr{ background:#f1f6f4 }
 .pd{ border-top:1px solid #d8e3df; margin-top:4px; padding-top:3px;
      font-size:7pt; color:#5a6a65; flex-shrink:0 }
 .verso-note{ text-align:right; font-size:7.5pt; color:#8a9a95; margin-top:2px; font-style:italic }
 @media screen{ body{ background:#e8eeec; padding:10px }
   .pg{ background:#fff; padding:9mm 8mm; margin:0 auto 12px; max-width:210mm;
        box-shadow:0 2px 12px rgba(0,0,0,.15) } }
</style></head><body>${corps}</body></html>`;
}

/* ============================================================
   EXPORT DE L'HISTORIQUE DES CONSTANTES — courbes + tableau
============================================================ */

function sheetExportConst(pid){
  const p = getP(pid);
  if (!p) return;
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  let jours = 30, fmt = "pdf";

  const draw = () => {
    const cut = new Date(Date.now() - jours*864e5).toISOString().slice(0,10);
    const vs = (p.visits||[]).filter(v => v.date >= cut && v.consts && Object.keys(v.consts).length);
    openSheet(`
      ${navHeader("Courbes", true)}
      <h3 style="margin-bottom:2px">📄 Exporter l'historique</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b> — courbes d'évolution puis tableau détaillé</p>

      <div class="rowlab bl"><span>Période</span><i></i></div>
      <div class="rowbox bl" style="display:block;margin-bottom:12px">
      <div class="chips" style="margin-bottom:12px">
        ${[[15,"15 jours"],[30,"1 mois"],[90,"3 mois"],[365,"1 an"]].map(([d,l])=>
          `<button class="chip ${jours===d?"on":""}" data-fj="${d}">${l}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:14px">${vs.length} relevé(s) sur la période.</p>

      </div><div class="rowlab vi"><span>Format</span><i></i></div>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip ${fmt==="pdf" ?"on":""}" data-ff2="pdf"  style="flex:1;justify-content:center">📑 PDF</button>
        <button class="chip ${fmt==="html"?"on":""}" data-ff2="html" style="flex:1;justify-content:center">🌐 HTML</button>
        <button class="chip ${fmt==="txt" ?"on":""}" data-ff2="txt"  style="flex:1;justify-content:center">🗒️ Texte</button>
      </div>

      <button class="btn btn-primary" id="ec-go" style="width:100%">${fmt==="pdf"?"👁 Aperçu &amp; impression":"📤 Exporter"}</button>`);

    bindNav(() => { closeSheet(); const b = document.querySelector(`[data-graph="${p.id}"]`); if (b) b.click(); });
    $$("#sheet [data-fj]").forEach(b => b.onclick = () => { jours = +b.dataset.fj; draw(); });
    $$("#sheet [data-ff2]").forEach(b => b.onclick = () => { fmt = b.dataset.ff2; draw(); });
    $("#ec-go").onclick = () => {
      const base = "Constantes_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();
      if (fmt === "txt"){ shareText(constTexte(p, vs, jours), base + ".txt", "text/plain"); return; }
      const html = constHtml(p, vs, jours);
      if (fmt === "html"){ shareText(html, base + ".html", "text/html"); return; }
      showFichePreview(html, base);
    };
  };
  draw();
}

/* ---------- Document : courbes puis tableau ---------- */
function constHtml(p, vs, jours){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const th = p.thresholds || {};
  const sorted = [...vs].sort((a,b) => (a.date+a.at).localeCompare(b.date+b.at));

  const DEFS = [
    { key:"ta",   lbl:"Tension artérielle", unit:"cmHg", hi:th.taHigh||16, lo:th.taLow||9 },
    { key:"puls", lbl:"Pouls",              unit:"bpm",  hi:100,           lo:50 },
    { key:"sat",  lbl:"Saturation",         unit:"%",    hi:null,          lo:th.satLow||92 },
    { key:"temp", lbl:"Température",        unit:"°C",   hi:38,            lo:35.5 },
    { key:"glyc", lbl:"Glycémie",           unit:"g/L",  hi:2.5,           lo:th.glycLow||0.7 }
  ];
  const num = (v, k) => {
    if (v == null || v === "") return null;
    if (k === "ta"){ const s = parseFloat(String(v).split("/")[0]); return isNaN(s)?null:s; }
    const n = parseFloat(String(v).replace(",",".")); return isNaN(n)?null:n;
  };
  const horsSeuil = (v, d) => {
    const n = num(v, d.key); if (n === null) return false;
    return (d.hi !== null && n >= d.hi) || (d.lo !== null && n <= d.lo);
  };

  // Courbes SVG
  let courbes = "";
  DEFS.forEach(d => {
    const pts = sorted.map(v => ({ n:num((v.consts||{})[d.key], d.key), date:v.date }))
                      .filter(x => x.n !== null);
    if (pts.length < 2) return;
    const W = 560, H = 90, PAD = 6;
    const vals = pts.map(x => x.n);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (d.hi) mx = Math.max(mx, d.hi); if (d.lo) mn = Math.min(mn, d.lo);
    const span = (mx - mn) || 1;
    const X = i => PAD + i * (W - 2*PAD) / Math.max(pts.length-1, 1);
    const Y = n => H - PAD - ((n - mn) / span) * (H - 2*PAD);
    const line = pts.map((x,i) => `${X(i).toFixed(1)},${Y(x.n).toFixed(1)}`).join(" ");
    const seuils = [
      d.hi ? `<line x1="0" y1="${Y(d.hi).toFixed(1)}" x2="${W}" y2="${Y(d.hi).toFixed(1)}" stroke="#e8a0a0" stroke-width="1" stroke-dasharray="4 3"/>` : "",
      d.lo ? `<line x1="0" y1="${Y(d.lo).toFixed(1)}" x2="${W}" y2="${Y(d.lo).toFixed(1)}" stroke="#e8a0a0" stroke-width="1" stroke-dasharray="4 3"/>` : ""
    ].join("");
    const dots = pts.map((x,i) => horsSeuil((sorted.find(v=>v.date===x.date)||{}).consts?.[d.key], d)
      ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(x.n).toFixed(1)}" r="3" fill="#a01c1c"/>` : "").join("");
    courbes += `<div class="crb-b">
      <div class="crb-t">${d.lbl} <span>(${d.unit})</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${seuils}
        <polyline points="${line}" fill="none" stroke="#005A50" stroke-width="2"/>
        ${dots}
      </svg>
      <div class="crb-x"><span>${fmtFR(pts[0].date)}</span><span>${fmtFR(pts[pts.length-1].date)}</span></div>
    </div>`;
  });

  // Tableau
  const lignes = [...sorted].reverse().map(v => {
    const c = v.consts || {};
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
    const cell = d => {
      const val = c[d.key];
      if (val == null || val === "") return "<td>—</td>";
      return `<td class="${horsSeuil(val, d)?"bad":""}">${esc(String(val))}</td>`;
    };
    return `<tr><td class="dt">${fmtFR(v.date)}${sl} ${esc(v.at||"")}</td>${DEFS.map(cell).join("")}</tr>`;
  }).join("");

  // Synthèse
  const nHors = sorted.filter(v => DEFS.some(d => horsSeuil((v.consts||{})[d.key], d))).length;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Constantes — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 header{background:#005A50;color:#fff;padding:9px 13px;margin-bottom:11px}
 header .t{font-size:12.5pt;font-weight:800}
 header .s{font-size:8.5pt;color:#a8ded2;margin-top:1px}
 .alert{background:#fdeaea;border-left:3px solid #a01c1c;padding:6px 10px;font-size:9.5pt;margin-bottom:10px}
 .crb-b{margin-bottom:9px;page-break-inside:avoid}
 .crb-t{font-size:8.5pt;color:#5a6a65;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
 .crb-t span{text-transform:none;letter-spacing:0}
 .crb-b svg{width:100%;height:22mm;background:#fafcfb;border:1px solid #e4ece9}
 .crb-x{display:flex;justify-content:space-between;font-size:7.5pt;color:#8a9a95;margin-top:1px}
 table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}
 th{background:#eef3f1;border:1px solid #c8d8d3;padding:4px 3px;font-size:8.5pt}
 td{border:1px solid #eef3f1;padding:3px;text-align:center}
 td.dt{text-align:left;color:#5a6a65;white-space:nowrap}
 td.bad{color:#a01c1c;font-weight:700}
 footer{margin-top:12px;padding-top:7px;border-top:1px solid #d8e3df;font-size:8pt;color:#8a9a95;
   display:flex;justify-content:space-between}
 @media screen{ body{background:#e8eeec;padding:12px}
   header{margin:-12px -12px 11px} }
</style></head><body>
<header>
  <div class="t">SURVEILLANCE DES CONSTANTES</div>
  <div class="s">${esc(nom)}${p.dob?` — née le ${p.dob.split("-").reverse().join("/")}`:""} · ${jours} derniers jours · ${sorted.length} relevé(s)</div>
</header>
${nHors ? `<div class="alert"><b>${nHors} relevé(s) hors seuils</b> sur la période — repérés en rouge.</div>` : ""}
${courbes || "<p style='color:#8a9a95;font-size:9.5pt'>Pas assez de relevés pour tracer une courbe.</p>"}
<table>
  <tr><th>Date</th>${DEFS.map(d=>`<th>${d.lbl.split(" ")[0]}</th>`).join("")}</tr>
  ${lignes || `<tr><td colspan="6" style="color:#8a9a95;padding:10px">Aucun relevé sur la période.</td></tr>`}
</table>
<footer>
  <span>${S.identity ? esc(whoami()) + ", IDEL" : "IDEL"} — édité le ${todayISO().split("-").reverse().join("/")}</span>
  <span>Document confidentiel — données de santé</span>
</footer>
</body></html>`;
}

/* ---------- Version texte ---------- */
function constTexte(p, vs, jours){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const L = "──────────────────────────────";
  let o = "SURVEILLANCE DES CONSTANTES\n" + nom + "\n" + jours + " derniers jours · " + vs.length + " relevé(s)\n" + L + "\n";
  [...vs].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).forEach(v => {
    const parts = constParts(v.consts);
    if (!parts.length) return;
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
    o += fmtFR(v.date) + sl + " " + (v.at||"") + " — " + parts.join(" · ") + "\n";
  });
  o += L + "\nÉdité le " + todayISO().split("-").reverse().join("/") +
       (S.identity ? " par " + whoami() : "") + "\nDocument confidentiel — données de santé.\n";
  return o;
}


/* ===== menage.js ===== */
/* ============================================================
   MÉNAGE DANS L'HISTORIQUE
   ─────────────────────────────────────────────────────────
   Archiver dans un fichier, puis supprimer — jamais l'inverse.
   Le bouton de suppression reste inactif tant qu'aucune archive
   n'a été produite (un lien discret permet de passer outre).

   Quatre étapes : ① quoi ② quand ③ qui ④ archiver puis supprimer.
   Ouvert depuis le menu → tous les patients.
   Ouvert depuis une fiche → l'étape ③ disparaît.
============================================================ */

async function sheetMenage(pid){
  const solo = pid ? getP(pid) : null;
  if (pid && !solo){ toast("Dossier introuvable", "danger"); return; }

  let doPassages = true, doConstantes = true;
  let mode = "6m";                       // 3m · 6m · 1a · libre
  let from = "", to = "";
  const sel = new Set();                 // patients cochés
  let archiveFaite = false;
  let fmt = "html";

  const tous = () => solo ? [solo] : activeP().concat((S.patients||[]).filter(p => p.archived || p.pec));
  tous().forEach(p => sel.add(p.id));

  /* Bornes de la période */
  const bornes = () => {
    if (mode === "libre") return { a: from || "0000-01-01", b: to || todayISO() };
    const m = { "3m":3, "6m":6, "1a":12 }[mode] || 6;
    const lim = new Date(); lim.setMonth(lim.getMonth() - m);
    return { a: "0000-01-01", b: lim.toISOString().slice(0,10) };
  };

  /* Ce qui tombe dans la période, patient par patient */
  const compte = () => {
    const { a, b } = bornes();
    let nP = 0, nC = 0;
    const par = [];
    tous().forEach(p => {
      const vs = (p.visits||[]).filter(v => v.date >= a && v.date <= b);
      const cs = vs.filter(v => v.consts && Object.keys(v.consts).length);
      par.push({ p, nP: vs.length, nC: cs.length });
      if (sel.has(p.id)){ nP += vs.length; nC += cs.length; }
    });
    return { nP, nC, par, a, b };
  };

  const draw = () => {
    const { nP, nC, par, a, b } = compte();
    const totP = (S.patients||[]).reduce((n,p)=>n+(p.visits||[]).length, 0);
    const totC = (S.patients||[]).reduce((n,p)=>n+(p.visits||[]).filter(v=>v.consts&&Object.keys(v.consts).length).length, 0);
    const traiteP = doPassages ? nP : 0;
    const traiteC = doConstantes ? nC : 0;
    const rien = !traiteP && !traiteC;

    openSheet(`
      ${navHeader(solo ? "Fiche" : "Réglages", true)}
      <h3 style="margin-bottom:2px">🧹 Ménage dans l'historique${solo ? " — " + esc(solo.prenom + " " + solo.nom.replace("Demo-","").toUpperCase()) : ""}</h3>
      <p class="small muted" style="margin-bottom:14px">${solo
        ? `${(solo.visits||[]).length} passage(s) · ${(solo.visits||[]).filter(v=>v.consts&&Object.keys(v.consts).length).length} relevé(s)`
        : `${totP} passages · ${totC} relevés de constantes`}</p>

      <div class="mn-step">1 · Que veux-tu traiter ?</div>
      <div class="mn-what">
        <button class="mn-w ${doPassages?"on":""}" data-mw="p">
          <span class="ic">🚶</span><span class="l">Passages</span><span class="s">et leurs soins</span></button>
        <button class="mn-w ${doConstantes?"on":""}" data-mw="c">
          <span class="ic">🩺</span><span class="l">Constantes</span><span class="s">TA, pouls, glyc…</span></button>
      </div>
      <p class="small muted" style="margin:6px 0 14px">Décoche pour n'en traiter qu'un. Supprimer les <b>constantes seules</b> conserve la trace des soins faits.</p>

      <div class="mn-step">2 · Sur quelle période ?</div>
      <div class="chips" style="margin-bottom:8px">
        ${[["3m","Avant 3 mois"],["6m","Avant 6 mois"],["1a","Avant 1 an"],["libre","📅 Dates libres"]]
          .map(([k,l])=>`<button class="chip ${mode===k?"on":""}" data-mp="${k}">${l}</button>`).join("")}
      </div>
      ${mode==="libre" ? `<div class="rowb" style="margin-bottom:14px">
        <input type="date" id="mn-from" value="${esc(from)}" style="flex:1">
        <input type="date" id="mn-to"   value="${esc(to)}"   style="flex:1">
      </div>` : `<p class="small muted" style="margin-bottom:14px">Tout ce qui date d'avant le <b>${fmtFR(b)}</b>.</p>`}

      ${solo ? "" : `
      <div class="mn-step" style="display:flex;align-items:center;gap:7px">
        <span style="flex:1">3 · Quels patients ?</span>
        <button class="chip" id="mn-all"  style="font-size:10.5px;padding:3px 10px">Tout cocher</button>
        <button class="chip" id="mn-none" style="font-size:10.5px;padding:3px 10px">Aucun</button>
      </div>
      <div class="mn-list">
        ${par.filter(x => x.nP).map(({p,nP,nC})=>`
          <button class="mn-p ${sel.has(p.id)?"on":""}" data-mpp="${p.id}">
            <span class="box">${sel.has(p.id)?"✓":""}</span>
            <span class="nm">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${p.archived?' <span class="small muted">· mis de côté</span>':""}</span>
            <span class="ct">${nP} pass.${nC?` · ${nC} const.`:""}</span>
          </button>`).join("") || uiEmpty("🗓","Aucun passage sur cette période","Élargis la période pour voir des dossiers à traiter.")}
      </div>`}

      <div class="mn-recap ${rien?"vide":""}">
        <div class="h">Ce qui sera traité</div>
        ${rien ? `<div class="small">Rien à traiter — élargis la période ou coche des patients.</div>` : `
        <div style="font-size:13px;line-height:1.7">
          ${doPassages?`<b>${traiteP} passage(s)</b>`:""}${doPassages&&doConstantes?" et ":""}${doConstantes?`<b>${traiteC} relevé(s)</b>`:""}<br>
          <span class="small muted">${solo?esc(solo.prenom):sel.size+" patient(s)"} · jusqu'au ${fmtFR(b)}</span>
        </div>
        <p class="small muted" style="margin:7px 0 0">Documents, bilans et rappels ne sont pas touchés.</p>`}
      </div>

      <div class="mn-step">4 · Archiver, puis supprimer</div>
      <div class="chips" style="margin-bottom:9px">
        ${[["html","🌐 HTML"],["txt","🗒️ Texte"],["csv","📊 CSV"],["json","💾 JSON"]]
          .map(([k,l])=>`<button class="chip ${fmt===k?"on":""}" data-mf="${k}" style="flex:1;justify-content:center;font-size:11.5px">${l}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:9px">${fmt==="json"
        ? "Le JSON peut être <b>réimporté</b> dans l'application plus tard."
        : fmt==="csv" ? "Le CSV s'ouvre dans Excel ou LibreOffice."
        : "Lisible dans n'importe quel navigateur, sans l'application."}</p>

      <button class="btn btn-primary" id="mn-arch" style="width:100%" ${rien?"disabled":""}>📤 Archiver dans un fichier</button>
      <button class="btn" id="mn-del" style="width:100%;margin-top:8px;background:transparent;${archiveFaite
        ? "border-color:var(--danger);color:var(--danger)"
        : "border-color:var(--border);color:var(--faint)"}" ${(!archiveFaite||rien)?"disabled":""}>
        🗑 ${archiveFaite ? "Supprimer maintenant" : "Supprimer — archive d'abord"}</button>
      ${rien?"":`<p class="small muted" style="text-align:center;margin-top:8px">
        <a id="mn-skip" style="color:var(--faint);text-decoration:underline">supprimer sans archiver</a></p>`}`);

    bindNav(() => solo ? sheetPatient(solo) : sheetTours());
    $$("#sheet [data-mw]").forEach(b => b.onclick = () => {
      if (b.dataset.mw === "p") doPassages = !doPassages; else doConstantes = !doConstantes;
      if (!doPassages && !doConstantes){ doPassages = true; toast("Coche au moins l'un des deux"); }
      archiveFaite = false; draw();
    });
    $$("#sheet [data-mp]").forEach(b => b.onclick = () => { mode = b.dataset.mp; archiveFaite = false; draw(); });
    $$("#sheet [data-mpp]").forEach(b => b.onclick = () => {
      const id = b.dataset.mpp; sel.has(id) ? sel.delete(id) : sel.add(id);
      archiveFaite = false; draw();
    });
    $$("#sheet [data-mf]").forEach(b => b.onclick = () => { fmt = b.dataset.mf; archiveFaite = false; draw(); });
    const ma = $("#mn-all");  if (ma) ma.onclick = async () => { tous().forEach(p=>sel.add(p.id)); archiveFaite=false; draw(); };
    const mn = $("#mn-none"); if (mn) mn.onclick = () => { sel.clear(); archiveFaite=false; draw(); };
    ["mn-from","mn-to"].forEach(id => { const e = $("#"+id); if (e) e.onchange = () => {
      if (id==="mn-from") from = e.value; else to = e.value; archiveFaite=false; draw(); }; });

    $("#mn-arch").onclick = async () => {
      const data = collecte(sel, bornes(), doPassages, doConstantes, solo);
      await exportArchive(data, fmt, bornes());
      archiveFaite = true; draw();
      toast("Archive produite — tu peux maintenant supprimer 📤");
    };
    const del = $("#mn-del");
    if (del) del.onclick = () => faireLeMenage(sel, bornes(), doPassages, doConstantes, solo, traiteP, traiteC);
    const skip = $("#mn-skip");
    if (skip) skip.onclick = async () => {
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer SANS archiver ?", sub:"Ces données seront définitivement perdues.", oui:"🗑 Supprimer" })) return;
      faireLeMenage(sel, bornes(), doPassages, doConstantes, solo, traiteP, traiteC);
    };
  };
  draw();
}

/* ---------- Collecte des données concernées ---------- */
function collecte(sel, {a,b}, doP, doC, solo){
  const src = solo ? [solo] : (S.patients||[]).filter(p => sel.has(p.id));
  return src.map(p => ({
    p,
    visits: (p.visits||[]).filter(v => v.date >= a && v.date <= b)
  })).filter(x => x.visits.length);
}

/* ---------- Suppression effective ---------- */
function faireLeMenage(sel, bornes, doP, doC, solo, nP, nC){
  const quoi = [doP ? nP+" passage(s)" : "", doC && !doP ? nC+" relevé(s) de constantes" : ""].filter(Boolean).join(" et ");
  if (!confirm("Supprimer " + quoi + " ?\n\n" +
    (doP ? "Les passages de la période seront retirés de l'historique.\n"
         : "Seules les constantes seront effacées — les passages et les soins restent.\n") +
    "Documents, bilans et rappels ne sont pas touchés.")) return;

  const { a, b } = bornes;
  const src = solo ? [solo] : (S.patients||[]).filter(p => sel.has(p.id));
  let supP = 0, supC = 0;
  src.forEach(p => {
    if (doP){
      const av = (p.visits||[]).length;
      p.visits = (p.visits||[]).filter(v => !(v.date >= a && v.date <= b));
      supP += av - p.visits.length;
    } else if (doC){
      // Constantes seules : on vide le champ, le passage reste
      (p.visits||[]).forEach(v => {
        if (v.date >= a && v.date <= b && v.consts && Object.keys(v.consts).length){
          v.consts = {}; delete v.constRel; supC++;
        }
      });
    }
  });
  save(); render();
  toast(doP ? supP + " passage(s) supprimé(s) 🧹" : supC + " relevé(s) effacé(s) 🧹");
  closeSheet();
}

/* ---------- Production du fichier d'archive ---------- */
async function exportArchive(data, fmt, {a,b}){
  const base = "Archive_JMSante_" + (a==="0000-01-01" ? "avant_" + b : a + "_" + b);
  if (fmt === "json"){
    const pkg = { _jmarchive:1, from:a, to:b, generatedAt:Date.now(),
      by: S.identity ? whoami() : null,
      patients: data.map(({p,visits}) => ({
        id:p.id, nom:p.nom, prenom:p.prenom, dob:p.dob, visits }))
    };
    await shareText(JSON.stringify(pkg, null, 1), base + ".json", "application/json");
    return;
  }
  if (fmt === "csv"){
    const L = ['"Patient";"Naissance";"Date";"Heure";"Créneau";"Soins";"TA";"Pouls";"Temp";"Sat";"Glyc";"Transmission"'];
    data.forEach(({p,visits}) => {
      const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
      [...visits].sort((x,y)=>x.date.localeCompare(y.date)).forEach(v => {
        const c = v.consts || {};
        const q = t => '"' + String(t==null?"":t).replace(/"/g,'""') + '"';
        L.push([nom, p.dob||"", v.date, v.at||"", v.slot||"",
                (v.soins||[]).join(", "), c.ta||"", c.puls||"", c.temp||"", c.sat||"", c.glyc||"",
                (v.note||"").replace(/\n/g," ")].map(q).join(";"));
      });
    });
    await shareText("\uFEFF" + L.join("\n"), base + ".csv", "text/csv");
    return;
  }
  if (fmt === "txt"){
    let o = "ARCHIVE — PASSAGES\n" + (a==="0000-01-01" ? "Jusqu'au " + fmtFR(b) : "Du " + fmtFR(a) + " au " + fmtFR(b)) + "\n";
    o += "─".repeat(30) + "\n\n";
    data.forEach(({p,visits}) => {
      o += p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom +
           (p.dob ? " — né(e) le " + p.dob.split("-").reverse().join("/") : "") + "\n";
      [...visits].sort((x,y)=>x.date.localeCompare(y.date)).forEach(v => {
        const cp = constParts(v.consts);
        o += "  " + fmtFR(v.date) + " " + (v.at||"") + " — " + ((v.soins||[]).join(", ") || "—") + "\n";
        if (cp.length) o += "     " + cp.join(" · ") + "\n";
        if (v.note) o += "     " + v.note.replace(/\n/g,"\n     ") + "\n";
      });
      o += "\n";
    });
    o += "─".repeat(30) + "\nProduite le " + todayISO().split("-").reverse().join("/") +
         (S.identity ? " par " + whoami() : "") + "\nDocument confidentiel — données de santé.\n";
    await shareText(o, base + ".txt", "text/plain");
    return;
  }
  // HTML
  const totV = data.reduce((n,x)=>n+x.visits.length, 0);
  const corps = data.map(({p,visits}) => `
    <section>
      <h2>${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${p.dob?` <span class="dob">— né(e) le ${p.dob.split("-").reverse().join("/")}</span>`:""}</h2>
      <table>
        <tr><th>Date</th><th>Soins</th><th>Constantes</th><th>Transmission</th></tr>
        ${[...visits].sort((x,y)=>x.date.localeCompare(y.date)).map(v => {
          const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
          const sn = v.soinNotes || {};
          return `<tr>
            <td class="dt">${fmtFR(v.date)}${sl} ${esc(v.at||"")}</td>
            <td>${(v.soins||[]).map(x => sn[x] ? `${esc(x)} <i>(${esc(sn[x])})</i>` : esc(x)).join(", ") || "—"}</td>
            <td class="ct">${esc(constParts(v.consts).join(" · ")) || "—"}</td>
            <td>${v.note ? esc(v.note).replace(/\n/g,"<br>") : "—"}</td>
          </tr>`;
        }).join("")}
      </table>
    </section>`).join("");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Archive JM@Santé</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 header{background:#005A50;color:#fff;padding:10px 14px;margin-bottom:12px}
 header .t{font-size:13pt;font-weight:800}
 header .s{font-size:8.5pt;color:#a8ded2;margin-top:1px}
 h2{font-size:11.5pt;color:#005A50;border-bottom:2px solid #d8e3df;padding-bottom:3px;margin:16px 0 6px}
 h2 .dob{font-weight:400;font-size:9.5pt;color:#6b7a75}
 section{page-break-inside:avoid}
 table{width:100%;border-collapse:collapse;font-size:9pt}
 th{background:#eef3f1;border:1px solid #c8d8d3;padding:4px;text-align:left;font-size:8.5pt}
 td{border:1px solid #eef3f1;padding:4px;vertical-align:top}
 td.dt{white-space:nowrap;color:#5a6a65;width:20%}
 td.ct{color:#3a4a45;width:22%}
 footer{margin-top:18px;padding-top:8px;border-top:1px solid #d8e3df;font-size:8pt;color:#8a9a95;text-align:center}
 @media screen{ body{background:#e8eeec;padding:14px} header{margin:-14px -14px 12px} }
</style></head><body>
<header>
  <div class="t">ARCHIVE — PASSAGES ET CONSTANTES</div>
  <div class="s">${a==="0000-01-01" ? "Jusqu'au " + fmtFR(b) : "Du " + fmtFR(a) + " au " + fmtFR(b)} · ${data.length} patient(s) · ${totV} passage(s)</div>
</header>
${corps || "<p>Aucune donnée sur cette période.</p>"}
<footer>
  Archive produite le ${todayISO().split("-").reverse().join("/")}${S.identity?` par ${esc(whoami())}`:""} — JM@Santé<br>
  Document confidentiel — données de santé, à conserver de façon sécurisée
</footer>
</body></html>`;
  await shareText(html, base + ".html", "text/html");
}

/* ---------- Réimport d'une archive JSON ---------- */
function importArchive(txt){
  let pkg;
  try { pkg = JSON.parse(txt); } catch(e){ toast("Fichier illisible", "danger"); return; }
  if (!pkg || !pkg._jmarchive || !Array.isArray(pkg.patients)){
    toast("Ce n'est pas une archive JM@Santé", "danger"); return;
  }
  // Analyse : ce qui existe déjà, ce qui est nouveau
  const lignes = [];
  pkg.patients.forEach(a => {
    const p = (S.patients||[]).find(x => x.id === a.id) ||
              (S.patients||[]).find(x => x.nom === a.nom && x.prenom === a.prenom);
    const has = new Set(p ? (p.visits||[]).map(v => v.uid) : []);
    const nouveaux = (a.visits||[]).filter(v => !has.has(v.uid));
    lignes.push({ a, p, nouveaux, deja: (a.visits||[]).length - nouveaux.length });
  });
  const totN = lignes.reduce((n,l)=>n+l.nouveaux.length, 0);
  const totD = lignes.reduce((n,l)=>n+l.deja, 0);
  const inconnus = lignes.filter(l => !l.p);
  const choix = {};
  lignes.forEach(l => { if (l.p && l.nouveaux.length) choix[l.a.id] = true; });

  const draw = () => {
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>💾 Réimporter une archive</h3>
      <p class="small muted" style="margin-bottom:12px">Du ${fmtFR(pkg.from)} au ${fmtFR(pkg.to)}${pkg.by?` · produite par ${esc(pkg.by)}`:""}</p>
      <div class="tip" style="margin-bottom:12px">
        <b>${totN} passage(s)</b> à réintégrer${totD?` · ${totD} déjà présent(s), ignoré(s)`:""}
        ${inconnus.length?`<br><span style="color:var(--amber)">⚠ ${inconnus.length} patient(s) de l'archive n'existent plus — ils ne peuvent pas être réintégrés</span>`:""}
      </div>
      ${lignes.filter(l=>l.p && l.nouveaux.length).map(l=>`
        <button class="selv" data-ia="${esc(l.a.id)}">
          <span class="box">${choix[l.a.id]?"✓":""}</span>
          <span class="sv">${esc(l.a.nom.replace("Demo-","").toUpperCase())} ${esc(l.a.prenom)}
            <span class="small muted">${l.nouveaux.length} passage(s)${l.deja?` · ${l.deja} déjà là`:""}</span></span>
        </button>`).join("") || `<p class="small muted">Rien à réintégrer — tout est déjà présent.</p>`}
      <button class="btn btn-primary" id="ia-go" style="width:100%;margin-top:12px" ${totN?"":"disabled"}>Réintégrer les passages cochés</button>
      <button class="btn btn-ghost" id="ia-cancel" style="width:100%;margin-top:8px">Annuler</button>`);
    $$("#sheet [data-ia]").forEach(b => b.onclick = () => { choix[b.dataset.ia] = !choix[b.dataset.ia]; draw(); });
    $("#ia-cancel").onclick = closeSheet;
    $("#ia-go").onclick = () => {
      let n = 0;
      lignes.forEach(l => {
        if (!l.p || !choix[l.a.id]) return;
        l.p.visits = l.p.visits || [];
        l.nouveaux.forEach(v => { l.p.visits.push(v); n++; });
        l.p.visits.sort((x,y)=>(x.date+x.at).localeCompare(y.date+y.at));
      });
      save(true); render(); closeSheet();
      toast(n + " passage(s) réintégré(s) 💾");
    };
  };
  draw();
}


/* ===== traitement.js ===== */
/* ============================================================
   FICHE DE TRAITEMENT STRUCTURÉE
   ─────────────────────────────────────────────────────────
   Une ligne par médicament, quatre moments de prise, plus les
   traitements « si besoin ». Remplace avantageusement le texte
   libre : le DLU affiche un vrai tableau, la détection des
   anticoagulants devient fiable, et la fiche s'imprime.

   Modèle : p.traitement = {
     lignes: [{ id, nom, m, mi, s, c, sibesoin, forme, note }],
     maj: "YYYY-MM-DD", prescripteur: "" }

   L'ancien texte libre (info de type « traitement ») est
   CONSERVÉ tel quel tant que l'IDEL n'a pas ressaisi.
============================================================ */

const FORMES = [
  ["cp",   "💊", "Comprimé"],
  ["inj",  "💉", "Injectable"],
  ["got",  "🥄", "Gouttes"],
  ["patch","🩹", "Patch"],
  ["aut",  "📦", "Autre"]
];
function formeIc(k){ const f = FORMES.find(x => x[0] === k); return f ? f[1] : ""; }

/* Molécules à signaler — sert au DLU et à la fiche imprimée */
const RX_ANTICOAG = /anticoag|eliquis|xarelto|previscan|coumadin|sintrom|kard[ée]gic|lovenox|innohep|apixaban|rivaroxaban|warfarine|h[ée]parine|plavix|clopidogrel|aspirine|aspegic/i;

function traitLignes(p){ return ((p.traitement||{}).lignes) || []; }

/* Texte compact pour la relève, le DLU et l'export de fiche.
   Reprend le texte libre si la fiche structurée est vide. */
function traitTexte(p){
  const L = traitLignes(p);
  if (!L.length){
    return (p.infos||[]).filter(i => i.type === "traitement" && (i.txt||"").trim())
                        .map(i => i.txt.trim()).join(" · ");
  }
  return L.map(l => {
    const pos = l.sibesoin ? "si besoin"
              : [l.m, l.mi, l.s, l.c].map(x => x || "0").join("-");
    return l.nom + " (" + pos + ")";
  }).join(" · ");
}

/* ---------- Écran principal ---------- */
function sheetTraitement(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable", "danger"); return; }
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();

  const draw = () => {
    const T = p.traitement || {};
    const L = T.lignes || [];
    const reg = L.filter(l => !l.sibesoin);
    const sib = L.filter(l => l.sibesoin);
    const ancien = (p.infos||[]).filter(i => i.type === "traitement" && (i.txt||"").trim());

    const ligne = l => `<div class="tr-r" data-tid="${esc(l.id)}">
      <span class="tr-n">${esc(l.nom)}${l.forme?` <span class="tr-f">${formeIc(l.forme)}</span>`:""}${
        RX_ANTICOAG.test(l.nom) ? ` <span class="tr-w">anticoag.</span>` : ""}
        ${l.note?`<span class="tr-note">${esc(l.note)}</span>`:""}</span>
      ${l.sibesoin
        ? `<span class="tr-sb">si besoin</span>`
        : ["m","mi","s","c"].map(k => `<span class="tr-d ${l[k]?"on":""}">${l[k]?esc(String(l[k])):"—"}</span>`).join("")}
      <button class="tr-e" data-ted="${esc(l.id)}" title="Modifier">✏️</button>
    </div>`;

    openSheet(`
      ${navHeader("Fiche", true)}
      <h3 style="margin-bottom:2px">💊 Fiche de traitement</h3>
      <p class="small muted" style="margin-bottom:12px"><b>${esc(nom)}</b>${
        T.maj ? ` · mise à jour le ${fmtFR(T.maj)}` : ""}</p>

      ${ancien.length && !L.length ? `<div class="tip" style="margin-bottom:12px">
        <b>Traitement actuellement en texte libre :</b><br>
        <span class="small">${ancien.map(i=>esc(i.txt)).join("<br>")}</span>
        <p class="small muted" style="margin:7px 0 0">Ressaisis-le ci-dessous pour obtenir un tableau imprimable. Le texte reste en place tant que tu ne l'effaces pas.</p>
      </div>` : ""}

      ${reg.length ? `<div class="trgrid">
        <div class="tr-h">
          <span class="tr-n">Médicament</span>
          <span class="tr-d">M</span><span class="tr-d">Mi</span><span class="tr-d">S</span><span class="tr-d">C</span>
          <span class="tr-e"></span>
        </div>
        ${reg.map(ligne).join("")}
      </div>` : `<p class="small muted" style="padding:10px 0">Aucun médicament — ajoute le premier ci-dessous.</p>`}

      ${sib.length ? `<div class="rowlab am" style="margin-top:14px"><span>Si besoin</span><i></i></div>
        <div class="trgrid">${sib.map(ligne).join("")}</div>` : ""}

      <button class="btn btn-ghost" id="tr-add" style="width:100%;margin-top:10px;border-style:dashed">＋ Ajouter un médicament</button>

      <div class="field" style="margin-top:14px"><span class="lab">Prescripteur <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></span>
        <input id="tr-presc" placeholder="Dr Blanc — ordonnance du 03/09" value="${esc(T.prescripteur||"")}"></div>

      ${L.length ? `<div class="rowb" style="margin-top:12px">
        <button class="btn btn-ghost" id="tr-print">🖨️ Imprimer</button>
        <button class="btn btn-ghost" id="tr-share">📤 Partager</button>
      </div>` : ""}`);

    bindNav(() => sheetPatient(p));
    $$("#sheet [data-ted]").forEach(b => b.onclick = () => editLigne(b.dataset.ted));
    $("#tr-add").onclick = () => editLigne(null);
    { const e = $("#tr-presc"); if (e) e.onchange = () => {
      p.traitement = p.traitement || { lignes:[] };
      p.traitement.prescripteur = e.value.trim(); save(); }; }
    { const b = $("#tr-print"); if (b) b.onclick = () => sortirTrait(p, "print"); }
    { const b = $("#tr-share"); if (b) b.onclick = () => sortirTrait(p, "share"); }
  };

  /* ---------- Saisie d'une ligne ---------- */
  const editLigne = (tid) => {
    const L = traitLignes(p);
    const l = tid ? L.find(x => x.id === tid) : { id:uid(), nom:"", m:"", mi:"", s:"", c:"", sibesoin:false, forme:"cp", note:"" };
    if (!l) return;
    let forme = l.forme || "cp";
    let sib = !!l.sibesoin;

    const drawEdit = () => {
      openSheet(`
        ${navHeader("Traitement", false)}
        <h3 style="margin-bottom:12px">${tid ? "Modifier" : "Nouveau médicament"}</h3>

        <div class="field"><span class="lab">Médicament et dosage</span>
          <input id="te-nom" placeholder="Eliquis 2,5 mg" value="${esc(l.nom)}" autocapitalize="sentences"></div>

        <div class="chips" style="margin-bottom:12px">
          <button class="chip ${sib?"":"on"}" id="te-reg" style="flex:1;justify-content:center">Posologie fixe</button>
          <button class="chip ${sib?"on":""}" id="te-sib" style="flex:1;justify-content:center">Si besoin</button>
        </div>

        ${sib ? `<p class="small muted" style="margin-bottom:12px">Traitement conditionnel — précise la conduite dans les remarques (« si douleur &gt; 4 », « si T° &gt; 38 »).</p>`
        : `<div class="rowlab ac"><span>Posologie</span><i></i></div>
      <div class="rowbox ac" style="display:block;margin-bottom:12px">
        <div class="teposo">
          ${[["m","Matin"],["mi","Midi"],["s","Soir"],["c","Coucher"]].map(([k,lbl])=>`
            <div><span>${lbl}</span>
              <input id="te-${k}" inputmode="decimal" placeholder="0" value="${esc(l[k]||"")}"></div>`).join("")}
        </div>
        <p class="small muted" style="margin:5px 0 12px">Laisse vide ou 0 si aucune prise à ce moment.</p>`}

        </div><div class="rowlab bl"><span>Forme</span><i></i></div>
      <div class="rowbox bl" style="display:block;margin-bottom:12px">
        <div class="chips" style="margin-bottom:12px">
          ${FORMES.map(([k,ic,lbl])=>`<button class="chip ${forme===k?"on":""}" data-tf="${k}" style="font-size:11.5px">${ic} ${lbl}</button>`).join("")}
        </div>

        </div><div class="field"><span class="lab">Remarques <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></span>
          <input id="te-note" placeholder="À jeun · pendant le repas · surveiller…" value="${esc(l.note||"")}"></div>

        <div class="uiact" style="margin-top:6px">
          <button class="btn btn-ghost" id="te-cancel">Annuler</button>
          <button class="btn btn-primary" id="te-ok">${tid?"Enregistrer":"Ajouter"}</button>
        </div>
        ${tid ? `<button class="btn" id="te-del" style="width:100%;margin-top:8px;background:transparent;border-color:var(--danger);color:var(--danger)">🗑 Retirer ce médicament</button>` : ""}`);

      bindNav(draw);
      $$("#sheet [data-tf]").forEach(b => b.onclick = () => { forme = b.dataset.tf; grab(); drawEdit(); });
      $("#te-reg").onclick = () => { sib = false; grab(); drawEdit(); };
      $("#te-sib").onclick = () => { sib = true;  grab(); drawEdit(); };
      $("#te-cancel").onclick = draw;
      $("#te-ok").onclick = () => {
        grab();
        if (!l.nom.trim()){ toast("Indique au moins le nom du médicament"); return; }
        p.traitement = p.traitement || { lignes:[] };
        p.traitement.lignes = p.traitement.lignes || [];
        l.forme = forme; l.sibesoin = sib;
        if (sib){ l.m = l.mi = l.s = l.c = ""; }
        if (!tid) p.traitement.lignes.push(l);
        p.traitement.maj = todayISO();
        if (typeof logChange==="function") logChange("update","patient", p.id, { traitement:p.traitement });
        save(true); draw();
        toast(tid ? "Médicament modifié 💊" : "Médicament ajouté 💊");
      };
      { const b = $("#te-del"); if (b) b.onclick = async () => {
        if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Retirer ce médicament ?", sub:esc(l.nom), oui:"🗑 Retirer" })) return;
        p.traitement.lignes = (p.traitement.lignes||[]).filter(x => x.id !== tid);
        p.traitement.maj = todayISO(); save(true); draw();
        toast("Médicament retiré");
      }; }
    };
    const grab = () => {
      l.nom  = ($("#te-nom")?.value || "").trim();
      l.note = ($("#te-note")?.value || "").trim();
      if (!sib) ["m","mi","s","c"].forEach(k => l[k] = ($("#te-"+k)?.value || "").trim());
    };
    drawEdit();
  };

  draw();
}

/* ---------- Fiche imprimable ---------- */
function sortirTrait(p, mode){
  const html = traitHtml(p);
  const base = "Traitement_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();
  if (mode === "share"){ shareText(html, base + ".html", "text/html"); return; }
  showFichePreview(html, base);
  if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
}

function traitHtml(p){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const T = p.traitement || {};
  const L = T.lignes || [];
  const reg = L.filter(x => !x.sibesoin), sib = L.filter(x => x.sibesoin);
  const vig = (p.infos||[]).filter(i => i.type === "vigilance" && (i.txt||"").trim())
                           .map(i => i.txt.trim()).join(" · ");
  const med = (p.contacts||{}).med;

  const row = l => `<tr>
    <td class="nm">${RX_ANTICOAG.test(l.nom)?`<b>${esc(l.nom)}</b>`:esc(l.nom)}${l.forme&&l.forme!=="cp"?` ${formeIc(l.forme)}`:""}</td>
    ${l.sibesoin
      ? `<td colspan="4" class="sb">si besoin</td>`
      : ["m","mi","s","c"].map(k => `<td class="d">${l[k] ? `<b>${esc(String(l[k]))}</b>` : "—"}</td>`).join("")}
    <td class="rm">${esc(l.note||"")}${RX_ANTICOAG.test(l.nom)?`<span class="ac">Anticoagulant — surveiller les saignements</span>`:""}</td>
  </tr>`;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Traitement — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 .hd{ display:flex;justify-content:space-between;align-items:flex-end;
      border-bottom:2px solid #005A50;padding-bottom:5px;margin-bottom:9px }
 .hd .t{ font-size:12.5pt;font-weight:800;color:#005A50;letter-spacing:.02em }
 .hd .id{ font-size:11pt;margin-top:2px }
 .hd .mj{ font-size:8.5pt;color:#6b7a75;text-align:right;white-space:nowrap }
 table{ width:100%;border-collapse:collapse;font-size:10pt;table-layout:fixed }
 th{ background:#eef3f1;border:1px solid #c8d8d3;padding:5px 4px;font-size:9pt }
 th.nm{ text-align:left }
 td.nm{ word-break:normal;overflow-wrap:break-word }
 td{ border:1px solid #dde7e3;padding:6px 5px;vertical-align:top }
 td.nm{ width:26% }
 td.d{ text-align:center;width:8% }
 td.d b{ font-size:11pt }
 td.sb{ text-align:center;color:#a06a10;font-style:italic }
 td.rm{ width:26%;font-size:9pt;color:#3a4a45 }
 td.rm .ac{ display:block;color:#a01c1c;font-size:8.5pt;margin-top:2px }
 tr:nth-child(even) td{ background:#fafcfb }
 h2{ font-size:10pt;color:#005A50;margin:14px 0 5px;text-transform:uppercase;letter-spacing:.04em }
 .vig{ background:#fdeaea;border-left:3px solid #a01c1c;padding:6px 10px;font-size:9.5pt;margin-top:11px }
 footer{ margin-top:12px;padding-top:7px;border-top:1px solid #d8e3df;
         font-size:8pt;color:#8a9a95;text-align:center }
 @media screen{ body{background:#e8eeec;padding:14px} }
</style></head><body>
<div class="hd">
  <div>
    <div class="t">FICHE DE TRAITEMENT</div>
    <div class="id"><b>${esc(nom)}</b>${p.dob?` — née le ${p.dob.split("-").reverse().join("/")}`:""}</div>
  </div>
  <div class="mj">${T.maj?`Mise à jour<br>${T.maj.split("-").reverse().join("/")}`:""}</div>
</div>

${reg.length ? `<table>
  <tr><th class="nm">Médicament</th><th>Matin</th><th>Midi</th><th>Soir</th><th>Coucher</th><th>Précisions</th></tr>
  ${reg.map(row).join("")}
</table>` : "<p>Aucun traitement à posologie fixe.</p>"}

${sib.length ? `<h2>Si besoin</h2><table>
  <tr><th class="nm">Médicament</th><th colspan="4">Conduite</th><th>Précisions</th></tr>
  ${sib.map(row).join("")}
</table>` : ""}

${vig ? `<div class="vig"><b>⚠ ${esc(vig)}</b>${med?` — prescripteur : ${esc(med.nom||"")}${med.tel?", "+esc(med.tel):""}`:""}</div>`
      : (med?`<p style="font-size:9pt;color:#5a6a65;margin-top:10px">Prescripteur : ${esc(med.nom||"")}${med.tel?" — "+esc(med.tel):""}</p>`:"")}
${T.prescripteur?`<p style="font-size:9pt;color:#5a6a65;margin-top:6px">${esc(T.prescripteur)}</p>`:""}

<footer>
  Document établi par ${S.identity ? esc(whoami()) + ", IDEL" : "l'IDEL"} le ${todayISO().split("-").reverse().join("/")}<br>
  Ne remplace pas la prescription médicale — données de santé, document confidentiel
</footer>
</body></html>`;
}


/* ===== tendances.js ===== */
/* ============================================================
   TENDANCES — voir ce que les seuils ne voient pas
   ─────────────────────────────────────────────────────────
   Les seuils alertent quand UNE valeur sort des bornes. Ils
   ne voient pas une dégradation lente où chaque mesure reste
   normale : six pesées au-dessus du seuil, et pourtant
   −2,4 kg en trois semaines.

   ⚠️ Une tendance est un CONSTAT, jamais un diagnostic.
   L'app dit « le poids a baissé de 2,4 kg ». Elle ne dira
   jamais « dénutrition » : c'est l'IDEL qui interprète.

   Poids et TA seulement : la glycémie varie trop d'un jour à
   l'autre, la température n'a de sens qu'en valeur absolue.
============================================================ */

const TREND = {
  minPts:   4,     // sous 4 mesures, on signale du bruit
  minJours: 14,    // il faut du recul pour parler de tendance
  maxJours: 90,    // au-delà, ce n'est plus la situation actuelle
  poids: { seuil: 2.0, unite: "kg",    lbl: "Poids" },   // kg sur la période
  ta:    { seuil: 1.5, unite: "cmHg",  lbl: "Tension" }  // points de systolique
};

/* Relevés datés d'une constante, du plus ancien au plus récent */
function trendPoints(p, cle){
  const out = [];
  (p.visits||[]).forEach(v => {
    const c = v.consts || {};
    let val = null;
    if (cle === "poids") val = num(c.poids);
    else if (cle === "ta" && c.ta){
      let s = num(String(c.ta).split("/")[0]);
      if (s != null && s > 40) s /= 10;      // 140 → 14
      val = s;
    }
    if (val != null && v.date) out.push({ d: v.date, v: val });
  });
  out.sort((a,b) => a.d.localeCompare(b.d));
  return out;
}

/* Une tendance, ou null si les données ne permettent pas de conclure */
function trendOf(p, cle){
  const cfg = TREND[cle];
  const pts = trendPoints(p, cle);
  if (pts.length < TREND.minPts) return null;

  const fin = pts[pts.length - 1];
  const jFin = Math.round((new Date(todayISO()) - new Date(fin.d)) / 864e5);
  if (jFin > 30) return null;                 // mesures trop anciennes

  // On borne la fenêtre : la situation d'il y a six mois n'éclaire rien
  const limite = new Date(new Date(fin.d) - TREND.maxJours * 864e5)
                   .toISOString().slice(0,10);
  const zone = pts.filter(x => x.d >= limite);
  if (zone.length < TREND.minPts) return null;

  const deb = zone[0];
  const jours = Math.round((new Date(fin.d) - new Date(deb.d)) / 864e5);
  if (jours < TREND.minJours) return null;

  const delta = fin.v - deb.v;
  if (Math.abs(delta) < cfg.seuil) return null;

  return {
    cle, lbl: cfg.lbl, unite: cfg.unite,
    delta: Math.round(delta * 10) / 10,
    depuis: deb.d, jusqu: fin.d, jours, n: zone.length,
    debut: deb.v, fin: fin.v
  };
}

/* Toutes les tendances d'un patient */
function trendsOf(p){
  return ["poids","ta"].map(k => trendOf(p, k)).filter(Boolean);
}

/* Formulation neutre — un constat, pas une interprétation */
function trendTexte(t){
  const sens = t.delta < 0 ? "en baisse" : "en hausse";
  const signe = t.delta > 0 ? "+" : "";
  return `${t.lbl} ${sens} : ${signe}${t.delta} ${t.unite} en ${t.jours} jours`;
}

/* Encart pour la fiche patient */
function trendHtml(p){
  const ts = trendsOf(p);
  if (!ts.length) return "";
  return `<div class="rowlab vi" style="margin-top:12px">
      <span>Tendances</span><i></i><em>sur les dernières mesures</em>
    </div>
    <div class="rowbox vi" style="display:block;margin-bottom:12px">
      ${ts.map(t => `<div class="trend">
        <span class="tr-ar">${t.delta < 0 ? "📉" : "📈"}</span>
        <span class="tr-b">
          <span class="tr-t">${esc(trendTexte(t))}</span>
          <span class="tr-d">${t.n} mesures · du ${esc(fmtFR(t.depuis))} au ${esc(fmtFR(t.jusqu))}
            · ${t.debut} → ${t.fin} ${esc(t.unite)}</span>
        </span>
      </div>`).join("")}
      <p class="small muted" style="margin:7px 0 0">Constat sur les mesures enregistrées — à interpréter selon le contexte du patient.</p>
    </div>`;
}


/* ===== dossier.js ===== */
/* ============================================================
   DOSSIER D'ENREGISTREMENT
   ─────────────────────────────────────────────────────────
   Trois plateformes, trois capacités différentes :

   Android (app)  → sélecteur de dossier natif, mémorisable
   Windows/Chrome → « Enregistrer sous » via File System Access,
                    la poignée du dossier est conservée en base
   iPhone/Safari  → aucun accès aux dossiers : le téléchargement
                    et le menu de partage font office

   On ne promet jamais plus que ce que la plateforme permet :
   dossierPossible() dit ce qui est réellement disponible ici.
============================================================ */

/* Que sait faire cet appareil ? */
function dossierPossible(){
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    // Android : le plugin natif gère le sélecteur système
    return (cap.Plugins && cap.Plugins.JMSaveFile) ? "natif" : "auto";
  }
  // Navigateur : File System Access (Chrome, Edge — pas Safari)
  if (typeof window.showDirectoryPicker === "function") return "web";
  return "aucun";   // iPhone, Firefox : téléchargement seul
}

/* Libellé du dossier retenu, pour l'affichage dans les réglages */
function dossierLabel(){
  const d = S.dossierSauvegarde;
  if (d && d.label) return d.label;
  const mode = dossierPossible();
  if (mode === "aucun") return "Téléchargements de l'appareil";
  return "Dossier par défaut";
}

/* Demander à l'utilisateur où enregistrer désormais.
   La poignée web est conservée hors du state (non sérialisable). */
async function choisirDossier(){
  const mode = dossierPossible();

  if (mode === "web"){
    try {
      const h = await window.showDirectoryPicker({ mode:"readwrite", id:"jmsante-bk" });
      await idbSet("__dossier__", h);          // IndexedDB accepte les poignées
      S.dossierSauvegarde = { label: h.name, type:"web" };
      save(true);
      toast("Dossier choisi : " + h.name + " ✓");
      return true;
    } catch(e){
      if (e && e.name === "AbortError") return false;   // annulé, pas une erreur
      logIncident("dossier", "Choix de dossier refusé", e);
      toast("Impossible d'ouvrir le sélecteur", "danger");
      return false;
    }
  }

  if (mode === "natif"){
    try {
      const r = await window.Capacitor.Plugins.JMSaveFile.pickFolder();
      if (!r || !r.uri) return false;
      S.dossierSauvegarde = { label: r.name || "Dossier choisi", uri:r.uri, type:"natif" };
      save(true);
      toast("Dossier choisi ✓");
      return true;
    } catch(e){
      // Le plugin peut ne pas exposer pickFolder selon sa version
      toast("Sélecteur indisponible — enregistrement dans Téléchargements");
      return false;
    }
  }

  await askDialog({
    ic:"📁", titre:"Choix du dossier indisponible",
    sub: mode === "auto"
      ? "Cette version enregistre dans le dossier Téléchargements."
      : "Ce navigateur ne permet pas de choisir un dossier. Le fichier ira dans tes téléchargements — tu pourras ensuite le ranger, ou utiliser <b>📤 Partager</b>.",
    oui:"J'ai compris", non:"Fermer"
  });
  return false;
}

/* Oublier le dossier choisi et revenir au comportement par défaut */
async function oublierDossier(){
  delete S.dossierSauvegarde;
  try { await idbDel("__dossier__"); } catch(e){}
  save(true);
}

/* Écrire dans le dossier choisi. Renvoie le libellé, ou null si
   aucun dossier n'est retenu (l'appelant reprend la voie normale). */
async function ecrireDansDossier(fname, contenu, opts={}){
  const d = S.dossierSauvegarde;
  if (!d) return null;

  if (d.type === "web"){
    try {
      const h = await idbGet("__dossier__");
      if (!h) return null;
      // L'autorisation peut avoir expiré depuis la dernière session
      if (h.queryPermission){
        let p = await h.queryPermission({ mode:"readwrite" });
        if (p !== "granted" && h.requestPermission)
          p = await h.requestPermission({ mode:"readwrite" });
        if (p !== "granted") return null;
      }
      const f = await h.getFileHandle(fname, { create:true });
      const w = await f.createWritable();
      await w.write(opts.base64 ? _b64ToBlob(contenu, opts.mime) : contenu);
      await w.close();
      return d.label + " ▸ " + fname;
    } catch(e){
      logIncident("dossier", "Écriture dans le dossier choisi impossible", e);
      return null;   // repli sur le téléchargement
    }
  }

  if (d.type === "natif" && d.uri){
    try {
      const r = await window.Capacitor.Plugins.JMSaveFile.saveTo({
        uri:d.uri, name:fname, data:contenu, base64:!!opts.base64, mime:opts.mime });
      return (d.label || "Dossier") + " ▸ " + (r && r.name || fname);
    } catch(e){
      logIncident("dossier", "Écriture dans le dossier choisi impossible", e);
      return null;
    }
  }
  return null;
}

function _b64ToBlob(b64, mime){
  const bin = atob(String(b64).replace(/^data:[^,]+,/, ""));
  const u = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime || "application/octet-stream" });
}


/* ===== vocal.js ===== */
/* ============================================================
   NOTE VOCALE
   ─────────────────────────────────────────────────────────
   Le 🎤 flottant transcrit la voix en texte et jette le son.
   Ici on garde le SON : le ton passe, un terme médical n'est
   pas déformé par la transcription, et c'est plus rapide que
   d'écrire dans une cage d'escalier.

   ⚠️ Un enregistrement nommant un patient est une donnée de
   santé. L'app efface la note CHEZ L'EXPÉDITEUR, elle ne peut
   rien chez le destinataire — d'où la mention de secret
   professionnel jointe à chaque envoi.

   Les notes vivent dans IndexedDB (clés "voice_*"), jamais
   dans le state : un blob audio n'est pas sérialisable en JSON
   et ferait exploser la taille des sauvegardes.
============================================================ */

const VOICE_MAX_S   = 180;   // 3 minutes : au-delà personne n'écoute
const VOICE_MAX_NB  = 2;     // deux notes suffisent
let _vRec = null, _vChunks = [], _vTimer = null, _vStart = 0;

/* Le navigateur sait-il enregistrer ? */
function voicePossible(){
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
            typeof MediaRecorder !== "undefined");
}

/* Format le plus léger que l'appareil sait produire */
function voiceMime(){
  const essais = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const m of essais){
    try { if (MediaRecorder.isTypeSupported(m)) return m; } catch(e){}
  }
  return "";   // le navigateur choisira
}
function voiceExt(mime){
  if (/mp4/.test(mime))  return "m4a";
  if (/ogg/.test(mime))  return "ogg";
  return "webm";
}

/* Les notes en cours de composition, avant envoi */
let _vNotes = [];        // [{ id, dur, taille, mime, blob, url }]

function voiceFmt(s){
  s = Math.max(0, Math.round(s));
  return Math.floor(s/60) + ":" + String(s%60).padStart(2,"0");
}

async function voiceStart(onTick, onStop){
  if (!voicePossible()){
    toast("Enregistrement indisponible sur cet appareil", "danger"); return false;
  }
  try {
    const flux = await navigator.mediaDevices.getUserMedia({ audio:true });
    const mime = voiceMime();
    _vRec = new MediaRecorder(flux, mime ? { mimeType:mime } : undefined);
    _vChunks = [];
    _vStart = Date.now();
    _vRec.ondataavailable = e => { if (e.data && e.data.size) _vChunks.push(e.data); };
    _vRec.onstop = () => {
      clearInterval(_vTimer); _vTimer = null;
      flux.getTracks().forEach(t => t.stop());     // libérer le micro
      const type = _vRec.mimeType || mime || "audio/webm";
      const blob = new Blob(_vChunks, { type });
      const dur  = Math.round((Date.now() - _vStart) / 1000);
      _vRec = null; _vChunks = [];
      if (blob.size < 1200){ toast("Enregistrement trop court"); onStop(null); return; }
      onStop({ id:uid(), dur, taille:blob.size, mime:type, blob, url:URL.createObjectURL(blob) });
    };
    _vRec.start();
    _vTimer = setInterval(() => {
      const s = (Date.now() - _vStart) / 1000;
      onTick(s);
      if (s >= VOICE_MAX_S) voiceStop();          // plafond atteint
    }, 200);
    return true;
  } catch(e){
    logIncident("voice", "Micro refusé ou indisponible", e);
    toast("Micro indisponible — autorise l'accès dans les réglages", "danger");
    return false;
  }
}

function voiceStop(){
  try { if (_vRec && _vRec.state !== "inactive") _vRec.stop(); }
  catch(e){ logIncident("voice", "Arrêt d'enregistrement", e); }
}

function voiceEnCours(){ return !!(_vRec && _vRec.state === "recording"); }

/* Conserver une note après envoi, pour la réécouter */
async function voiceGarder(note, envoiId){
  try {
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(note.blob);
    });
    await idbSet("voice_" + note.id, b64);
    S.voiceNotes = S.voiceNotes || [];
    S.voiceNotes.push({ id:note.id, dur:note.dur, taille:note.taille,
                        mime:note.mime, at:new Date().toISOString(), envoi:envoiId||null });
    return true;
  } catch(e){
    logIncident("voice", "Note vocale non conservée", e);
    return false;
  }
}

/* Ménage : les notes ne doivent pas s'accumuler sur l'appareil */
async function voicePurge(){
  const regl = S.voiceRetention || "7";       // "envoi" | "7" | "30" | "manuel"
  if (regl === "manuel") return 0;
  const notes = S.voiceNotes || [];
  if (!notes.length) return 0;
  const jours = regl === "envoi" ? 0 : parseInt(regl, 10);
  const limite = Date.now() - jours * 864e5;
  const garder = [];
  let n = 0;
  for (const v of notes){
    if (new Date(v.at).getTime() <= limite){
      try { await idbDel("voice_" + v.id); } catch(e){}
      n++;
    } else garder.push(v);
  }
  if (n){ S.voiceNotes = garder; save(true); }
  return n;
}

/* Retrouver une note conservée, pour la réécouter */
async function voiceUrl(id){
  try {
    const b64 = await idbGet("voice_" + id);
    return b64 || null;
  } catch(e){ return null; }
}
async function voiceEffacer(id){
  try { await idbDel("voice_" + id); } catch(e){}
  S.voiceNotes = (S.voiceNotes||[]).filter(v => v.id !== id);
  save(true);
}

/* Mention jointe à l'envoi — elle ne protège pas techniquement,
   mais elle engage celui qui reçoit. C'est ce qui manque quand
   la relève passe par une messagerie ordinaire. */
const VOICE_MENTION =
  "\n\n\uD83C\uDF99 Note vocale jointe\n" +
  "\u26A0\uFE0F Contient des données de santé couvertes par le secret " +
  "professionnel. Ne pas rediffuser. À effacer après écoute.";


/* ===== recueil.js ===== */
/* ============================================================
   FICHE DE RECUEIL
   ─────────────────────────────────────────────────────────
   Chez le patient, naviguer entre les onglets Identité, Infos,
   Contacts fait perdre du temps et oublier des champs. Cette
   fiche présente TOUT à la suite, dans l'ordre où on pose les
   questions.

   ⚠️ Ce n'est PAS un document séparé : c'est une autre VUE du
   dossier. Écrire ici écrit dans le dossier, et inversement.
   Aucune copie, donc aucun risque de divergence.

   Les informations libres (p.infos) sont regroupées par type
   dans un champ unique, séparées par « · ». Relire ce champ
   réécrit UNE information de ce type.
============================================================ */

const RECUEIL_SECTIONS = [
  { cle:"identite", lbl:"Identité", ic:"👤", col:"vi" },
  { cle:"domicile", lbl:"Domicile et téléphone", ic:"🏠", col:"ac" },
  { cle:"acces",    lbl:"Accès au domicile", ic:"🔑", col:"ac" },
  { cle:"prevenir", lbl:"Qui prévenir", ic:"📞", col:"am" },
  { cle:"pros",     lbl:"Professionnels de santé", ic:"🩺", col:"vi" },
  { cle:"savoir",   lbl:"Ce qu'il faut savoir", ic:"⚠️", col:"am" },
  { cle:"quotidien",lbl:"Au quotidien", ic:"🧩", col:"ac" },
];

/* Regrouper les informations d'un type en une seule ligne lisible */
function recueilInfo(p, type){
  return (p.infos||[]).filter(i => i.type === type && (i.txt||"").trim())
    .map(i => i.txt.trim()).join(" · ");
}

/* Réécrire les informations d'un type depuis le champ groupé.
   ⚠️ On conserve la visibilité en relève de la PREMIÈRE information
   existante : sinon un simple passage dans la fiche ferait
   disparaître une vigilance de la relève. */
function recueilSetInfo(p, type, txt){
  p.infos = p.infos || [];
  const anciennes = p.infos.filter(i => i.type === type);
  const show = anciennes.length ? !!anciennes[0].show
                                : (type === "acces" || type === "vigilance");
  p.infos = p.infos.filter(i => i.type !== type);
  const t = String(txt||"").trim();
  if (t) p.infos.push({ id:uid(), type, txt:t, show });
}

/* Combien de champs sont renseignés — pour la barre d'avancement */
function recueilAvance(p){
  const v = [
    p.nom, p.prenom, p.dob, p.genre,
    p.address, p.cp, p.ville,
    (p.tel||{}).fixe, (p.tel||{}).mobile,
    recueilInfo(p,"acces"),
    ((p.contacts||{}).fam||{}).nom, ((p.contacts||{}).fam||{}).tel,
    ((p.contacts||{}).med||{}).nom, ((p.contacts||{}).med||{}).tel,
    ((p.contacts||{}).pharma||{}).nom, ((p.contacts||{}).pharma||{}).tel,
    recueilInfo(p,"vigilance"), recueilInfo(p,"atcd"),
    recueilInfo(p,"entourage"), recueilInfo(p,"autre"),
    p.nir,
  ];
  const remplis = v.filter(x => String(x||"").trim()).length;
  return { remplis, total: v.length };
}

function sheetRecueil(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable"); return; }
  const av = recueilAvance(p);
  const pct = Math.round(av.remplis / av.total * 100);
  const c  = (k, sub) => ((p.contacts||{})[k]||{})[sub] || "";

  const champ = (id, lbl, val, ph, large) => `
    <div style="flex:${large?2:1};min-width:0">
      <div class="rec-lab">${lbl}</div>
      <input class="rec-in" id="${id}" value="${esc(val||"")}" placeholder="${esc(ph||"")}">
    </div>`;

  const sect = (s, corps, etat) => `
    <div class="rowlab ${s.col}" style="margin-top:13px">
      <span>${s.ic} ${s.lbl}</span><i></i><em>${etat||""}</em></div>
    <div class="rowbox ${s.col}" style="display:block">${corps}</div>`;

  const manque = (...vals) => {
    const n = vals.filter(x => !String(x||"").trim()).length;
    return n ? n + " à compléter" : "✓";
  };

  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>📋 Fiche de recueil</h3>
    <p class="small muted" style="margin-bottom:4px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))} — tout à la suite, pour ne rien oublier chez le patient.</p>
    <div class="rec-bar"><i style="width:${pct}%"></i></div>
    <p class="small muted" style="text-align:right;margin:3px 0 0">${av.remplis} champ${av.remplis>1?"s":""} sur ${av.total}</p>

    ${sect(RECUEIL_SECTIONS[0], `
      <div class="rowb">${champ("rc-nom","NOM",p.nom.replace("Demo-",""),"en majuscules")}${champ("rc-prenom","PRÉNOM",p.prenom,"")}</div>
      <div class="rowb" style="margin-top:6px">${champ("rc-dob","NÉ(E) LE",p.dob,"AAAA-MM-JJ")}
        <div style="flex:1;min-width:0"><div class="rec-lab">GENRE</div>
          <div class="rowb" style="gap:4px">
            <!-- ⚠️ Les valeurs doivent être IDENTIQUES à celles de la fiche
                 patient (M / F / Autre) : un "H" n'y serait jamais reconnu. -->
            <button class="chip ${p.genre==="F"?"on":""}" data-rcg="F" style="flex:1">F</button>
            <button class="chip ${p.genre==="M"?"on":""}" data-rcg="M" style="flex:1">M</button>
            <button class="chip ${p.genre==="Autre"?"on":""}" data-rcg="Autre" style="flex:1">Autre</button>
          </div></div></div>
      <div style="margin-top:6px">${champ("rc-nir","N° SÉCURITÉ SOCIALE",p.nir,"facultatif",true)}</div>`,
      manque(p.nom,p.prenom,p.dob,p.genre))}

    ${sect(RECUEIL_SECTIONS[1], `
      ${champ("rc-addr","ADRESSE",p.address,"n° et rue",true)}
      <div class="rowb" style="margin-top:6px">${champ("rc-cp","CODE POSTAL",p.cp,"")}${champ("rc-ville","VILLE",p.ville,"",true)}</div>
      <div class="rowb" style="margin-top:6px">${champ("rc-tfixe","TÉLÉPHONE FIXE",(p.tel||{}).fixe,"")}${champ("rc-tmob","PORTABLE",(p.tel||{}).mobile,"")}</div>`,
      manque(p.address,p.cp,p.ville))}

    ${sect(RECUEIL_SECTIONS[2], `
      <div class="rec-lab">CODE PORTAIL, ÉTAGE, CLÉ, ANIMAL…</div>
      <textarea class="rec-in" id="rc-acces" rows="3"
        placeholder="Code portail 1234 · 2ᵉ étage sans ascenseur · chien">${esc(recueilInfo(p,"acces"))}</textarea>
      <p class="small muted" style="margin:5px 0 0;font-size:9.5px">Sépare les éléments par « · ». Cette information figure sur la relève.</p>`,
      manque(recueilInfo(p,"acces")))}

    ${sect(RECUEIL_SECTIONS[3], `
      <div class="rowb">${champ("rc-famnom","NOM",c("fam","nom"),"",true)}${champ("rc-famtel","TÉLÉPHONE",c("fam","tel"),"")}</div>
      <div style="margin-top:6px">
        <div class="rec-lab">ENTOURAGE, AIDES, PRÉSENCES</div>
        <textarea class="rec-in" id="rc-entourage" rows="2"
          placeholder="Fille présente le week-end · aide à domicile le matin">${esc(recueilInfo(p,"entourage"))}</textarea>
      </div>`,
      manque(c("fam","nom"),c("fam","tel")))}

    ${sect(RECUEIL_SECTIONS[4], `
      <div class="rowb">${champ("rc-mednom","MÉDECIN TRAITANT",c("med","nom"),"",true)}${champ("rc-medtel","TÉL",c("med","tel"),"")}</div>
      <div class="rowb" style="margin-top:6px">${champ("rc-phnom","PHARMACIE",c("pharma","nom"),"",true)}${champ("rc-phtel","TÉL",c("pharma","tel"),"")}</div>`,
      manque(c("med","nom"),c("med","tel"),c("pharma","nom")))}

    ${sect(RECUEIL_SECTIONS[5], `
      <div class="rec-lab">ALLERGIES, VIGILANCES</div>
      <textarea class="rec-in" id="rc-vigilance" rows="2"
        placeholder="Allergie pénicilline · risque de chute">${esc(recueilInfo(p,"vigilance"))}</textarea>
      <div class="rec-lab" style="margin-top:8px">MALADIES SUIVIES, ANTÉCÉDENTS</div>
      <textarea class="rec-in" id="rc-atcd" rows="2"
        placeholder="HTA · insuffisance cardiaque · PTH droite 2019">${esc(recueilInfo(p,"atcd"))}</textarea>`,
      manque(recueilInfo(p,"vigilance")))}

    ${sect(RECUEIL_SECTIONS[6], `
      <div class="rec-lab">APPAREILLAGE, MATÉRIEL</div>
      <textarea class="rec-in" id="rc-autre" rows="2"
        placeholder="Lunettes · prothèse auditive · déambulateur">${esc(recueilInfo(p,"autre"))}</textarea>`,
      "")}

    <div class="rowb" style="margin-top:16px;gap:8px">
      <button class="btn btn-ghost" id="rc-print" style="flex:1">🖨 Imprimer remplie</button>
      <button class="btn btn-ghost" id="rc-vierge" style="flex:1">📄 Fiche vierge</button>
    </div>
    <p class="small muted" style="margin-top:8px">Ce que tu saisis ici est enregistré <b>directement dans le dossier</b> — l'onglet Infos et le DLU le reprennent aussitôt.</p>`);

  /* Enregistrement au fil de la saisie : pas de bouton à valider,
     l'IDEL est chez le patient et peut être interrompu. */
  const lie = (id, poser) => {
    const e = $("#" + id); if (!e) return;
    e.onchange = () => { poser(e.value.trim()); save(true); maj(); };
  };
  const setC = (k, sub, v) => {
    p.contacts = p.contacts || {};
    p.contacts[k] = p.contacts[k] || {};
    p.contacts[k][sub] = v;
  };
  const maj = () => {
    const a = recueilAvance(p);
    const b = $(".rec-bar i"); if (b) b.style.width = Math.round(a.remplis/a.total*100) + "%";
  };

  lie("rc-nom",    v => p.nom = v.toUpperCase());
  lie("rc-prenom", v => p.prenom = v);
  lie("rc-dob",    v => p.dob = v);
  lie("rc-nir",    v => p.nir = v);
  lie("rc-addr",   v => p.address = v);
  lie("rc-cp",     v => p.cp = v);
  lie("rc-ville",  v => p.ville = v);
  lie("rc-tfixe",  v => { p.tel = p.tel||{}; p.tel.fixe = v; });
  lie("rc-tmob",   v => { p.tel = p.tel||{}; p.tel.mobile = v; });
  lie("rc-famnom", v => setC("fam","nom",v));
  lie("rc-famtel", v => setC("fam","tel",v));
  lie("rc-mednom", v => setC("med","nom",v));
  lie("rc-medtel", v => setC("med","tel",v));
  lie("rc-phnom",  v => setC("pharma","nom",v));
  lie("rc-phtel",  v => setC("pharma","tel",v));
  lie("rc-acces",     v => recueilSetInfo(p,"acces",v));
  lie("rc-entourage", v => recueilSetInfo(p,"entourage",v));
  lie("rc-vigilance", v => recueilSetInfo(p,"vigilance",v));
  lie("rc-atcd",      v => recueilSetInfo(p,"atcd",v));
  lie("rc-autre",  v => recueilSetInfo(p,"autre",v));

  $$("#sheet [data-rcg]").forEach(b => b.onclick = () => {
    p.genre = b.dataset.rcg; save(true); sheetRecueil(pid);
  });
  { const b = $("#rc-print");  if (b) b.onclick = () => imprimerRecueil(p, false); }
  { const b = $("#rc-vierge"); if (b) b.onclick = () => imprimerRecueil(p, true); }
}

/* ============================================================
   IMPRESSION
   ─────────────────────────────────────────────────────────
   Deux documents très différents :
   · REMPLIE — une page dense, lue par un remplaçant qui ne
     connaît pas le patient. Les blocs rouges attirent l'œil
     sur ce qui compte quand ça presse.
   · VIERGE — trois pages avec de vraies lignes d'écriture,
     pour que le patient ou sa famille la remplisse à la main.
============================================================ */
function imprimerRecueil(p, vierge){
  const c   = (k,s) => ((p.contacts||{})[k]||{})[s] || "";
  const nom = (p.nom||"").replace("Demo-","");
  const ans = p.dob ? ageOf(p.dob) : "";
  const inf = t => recueilInfo(p, t);
  const ou  = (v, d) => String(v||"").trim() || (d || "—");

  const CSS = `
    @page{ size:A4; margin:11mm 12mm; }
    *{ box-sizing:border-box; }
    body{ font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
          color:#1a1a1a; font-size:9.5pt; line-height:1.5; margin:0; }
    h1{ font-size:15pt; margin:0; }
    .sub{ font-size:8pt; color:#666; }
    .hd{ display:flex; justify-content:space-between; align-items:flex-start;
         border-bottom:2px solid #0E8F94; padding-bottom:6px; margin-bottom:9px; }
    .mk{ font-size:7.5pt; color:#0E8F94; font-weight:700; text-align:right; }
    .lab{ font-size:7pt; font-weight:800; color:#0E8F94; letter-spacing:.05em;
          border-bottom:1px solid #D8E3DF; margin-bottom:3px; }
    .duo{ display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:8px; }
    .urg{ background:#FDF3F2; border-left:3px solid #C4574A; padding:7px 9px; margin-bottom:8px; }
    .urg .lab{ color:#C4574A; border-color:#F0D5D2; }
    .ft{ border-top:1px solid #ddd; margin-top:9px; padding-top:5px;
         font-size:6.5pt; color:#888; text-align:center; }
    /* Fiche vierge : de vraies lignes pour écrire */
    .li{ border-bottom:1px dotted #999; display:inline-block; min-width:60px; }
    .rw{ margin-bottom:11px; }
    .cases{ display:flex; gap:2px; margin-top:2px; }
    .cases i{ width:15px; height:19px; border:1px solid #bbb; border-radius:2px; display:block; }
    .note{ background:#F0F7F6; border-left:3px solid #0E8F94; padding:6px 9px;
           font-size:8pt; color:#333; margin-bottom:10px; }
    .pb{ page-break-before:always; }`;

  if (!vierge){
    /* ── Version remplie : une page ── */
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>Fiche_${esc(nom)}</title><style>${CSS}</style></head><body>
      <div class="hd">
        <div><h1>${esc(nom.toUpperCase())} ${esc(p.prenom||"")}</h1>
          <div class="sub">${ans ? ans + " ans · " : ""}${p.dob ? "né(e) le " + p.dob.split("-").reverse().join("/") : ""}</div></div>
        <div class="mk">JM@Santé<div style="color:#888;font-weight:400">maj ${todayISO().split("-").reverse().join("/")}</div></div>
      </div>
      <div class="duo">
        <div><div class="lab">DOMICILE</div>
          ${esc(ou(p.address))}<br>${esc(ou(p.cp,""))} ${esc(ou(p.ville,""))}<br>
          <b>Fixe</b> ${esc(ou((p.tel||{}).fixe))}<br>
          <b>Mobile</b> ${esc(ou((p.tel||{}).mobile))}</div>
        <div><div class="lab">ACCÈS</div>${esc(ou(inf("acces"), "non renseigné"))}</div>
      </div>
      <div class="urg"><div class="lab">EN CAS DE BESOIN</div>
        <b>${esc(ou(c("fam","nom")))}</b> — ${esc(ou(c("fam","tel")))}<br>
        ${esc(ou(inf("entourage"), ""))}</div>
      <div class="duo">
        <div><div class="lab">PROFESSIONNELS</div>
          <b>Médecin</b> ${esc(ou(c("med","nom")))}<br>&nbsp;&nbsp;${esc(ou(c("med","tel")))}<br>
          <b>Pharmacie</b> ${esc(ou(c("pharma","nom")))}<br>&nbsp;&nbsp;${esc(ou(c("pharma","tel")))}</div>
        <div><div class="lab">AU QUOTIDIEN</div>${esc(ou(inf("autre"), "non renseigné"))}</div>
      </div>
      <div class="urg"><div class="lab">À SAVOIR</div>
        <b>Vigilance</b> ${esc(ou(inf("vigilance"), "rien de signalé"))}<br>
        <b>Antécédents</b> ${esc(ou(inf("atcd")))}</div>
      <div class="ft">Document de soins — à conserver dans le classeur du domicile · confidentiel</div>
      </body></html>`;
    imprimerDocument(html, "Fiche_" + nom.replace(/\s+/g,"_"));
    return;
  }

  /* ── Version vierge : trois pages, de la place pour écrire ── */
  const cases = n => `<div class="cases">${"<i></i>".repeat(n)}</div>`;
  const ligne = (l, n) => `<div class="rw">${l}<br><span class="li" style="width:${n||100}%">&nbsp;</span></div>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Fiche_a_remplir</title><style>${CSS}</style></head><body>
    <div class="hd"><div><h1>Fiche patient</h1>
      <div class="sub">à remplir et à laisser au domicile · page 1 sur 3</div></div>
      <div class="mk">JM@Santé</div></div>
    <div class="note">Ces informations servent à vos soins et restent entre vos infirmiers.
      Remplissez ce que vous pouvez — rien n'est obligatoire.
      <b>Écrivez en majuscules dans les cases</b>, une lettre par case.</div>
    <div class="lab">IDENTITÉ</div>
    <div class="rw">NOM ${cases(20)}</div>
    <div class="rw">PRÉNOM ${cases(20)}</div>
    <div class="rw">NÉ(E) LE ${cases(8)} <span style="font-size:7.5pt;color:#888">jour mois année</span></div>
    <div class="rw">☐ Femme &nbsp; ☐ Homme</div>
    <div class="lab" style="margin-top:14px">OÙ VOUS TROUVER</div>
    ${ligne("ADRESSE")}${ligne("")}
    <div class="rw">CODE POSTAL ${cases(5)}</div>
    ${ligne("VILLE", 70)}
    <div class="rw">TÉLÉPHONE FIXE ${cases(10)}</div>
    <div class="rw">PORTABLE ${cases(10)}</div>

    <div class="pb"></div>
    <div class="hd"><div><h1>Fiche patient — suite</h1>
      <div class="sub">page 2 sur 3</div></div><div class="mk">JM@Santé</div></div>
    <div class="lab">POUR ENTRER CHEZ VOUS</div>
    <div class="rw">CODE PORTAIL ${cases(8)}</div>
    <div class="rw">CODE PORTE ${cases(8)}</div>
    ${ligne("ÉTAGE — avec ou sans ascenseur")}
    ${ligne("NOM SUR L'INTERPHONE")}
    ${ligne("CLÉ CACHÉE ? où")}
    <div class="rw">ANIMAL ☐ non &nbsp; ☐ oui, lequel <span class="li" style="width:50%">&nbsp;</span></div>
    <div class="lab" style="margin-top:14px">QUI PRÉVENIR EN CAS DE BESOIN</div>
    ${ligne("NOM")}${ligne("LIEN AVEC VOUS (fils, voisine…)", 60)}
    <div class="rw">TÉLÉPHONE ${cases(10)}</div>
    ${ligne("SECOND CONTACT — nom et téléphone")}

    <div class="pb"></div>
    <div class="hd"><div><h1>Fiche patient — suite</h1>
      <div class="sub">page 3 sur 3</div></div><div class="mk">JM@Santé</div></div>
    <div class="lab">VOS PROFESSIONNELS DE SANTÉ</div>
    ${ligne("MÉDECIN TRAITANT")}
    <div class="rw">son téléphone ${cases(10)}</div>
    ${ligne("PHARMACIE")}
    <div class="rw">son téléphone ${cases(10)}</div>
    ${ligne("AUTRE — kiné, spécialiste…")}
    <div class="lab" style="margin-top:14px">CE QU'IL FAUT SAVOIR</div>
    <div class="rw">ALLERGIES ☐ aucune connue</div>
    ${ligne("lesquelles")}
    ${ligne("MALADIES SUIVIES — diabète, tension, cœur…")}${ligne("")}
    ${ligne("OPÉRATIONS IMPORTANTES")}
    <div class="lab" style="margin-top:14px">AU QUOTIDIEN</div>
    <div class="rw">☐ lunettes ☐ prothèse auditive ☐ dentier<br>
      ☐ canne ☐ déambulateur ☐ fauteuil ☐ lit médicalisé</div>
    ${ligne("AIDE À DOMICILE — quand")}
    ${ligne("AUTRE CHOSE À NOUS DIRE")}${ligne("")}
    <div class="ft">Rempli le ___ / ___ / ______ par _________________ · JM@Santé</div>
    </body></html>`;
  imprimerDocument(html, "Fiche_a_remplir");
}


/* ===== docs.js ===== */
/* ============================================================
   NOMENCLATURE DES DOCUMENTS
   ─────────────────────────────────────────────────────────
   ⚠️ La synchronisation comparait les documents par NOM DE
   FICHIER. Deux confrères scannant la même ordonnance avec des
   noms différents créaient deux documents ; deux documents
   différents portant le même nom s'écrasaient.

   Chaque document porte désormais un TYPE et une PRÉCISION,
   tous deux obligatoires. Le nom se compose seul :
       2026-09-08_Ordo-medecin_Renouvellement

   Les documents antérieurs restent sans type — pastille
   « à qualifier », jamais imposé rétroactivement.
============================================================ */

const DOC_FAMILLES = [
  { cle:"presc", ic:"📄", lbl:"Prescriptions", col:"var(--accent)", types:[
      { cle:"ordo-med",    lbl:"Ordonnance médecin", court:"Ordo-medecin",
        prec:["Renouvellement","Modification","Sortie d'hospitalisation","Initiale"] },
      { cle:"ordo-ide",    lbl:"Ordonnance IDE", court:"Ordo-IDE",
        prec:["BSI","DSI","Renouvellement","Prolongation"] },
      { cle:"ordo-kine",   lbl:"Ordonnance kiné", court:"Ordo-kine",
        prec:["Initiale","Renouvellement"] },
      { cle:"ordo-bio",    lbl:"Ordonnance biologie", court:"Ordo-bio",
        prec:["Bilan de contrôle","INR","Suivi"] },
      { cle:"ordo-mat",    lbl:"Prescription matériel", court:"Ordo-materiel",
        prec:["Lit médicalisé","Pansements","Oxygène","Autre matériel"] },
    ]},
  { cle:"resul", ic:"🧪", lbl:"Résultats", col:"var(--blue,#7f9de0)", types:[
      { cle:"bio",         lbl:"Biologie", court:"Biologie",
        prec:["INR","NFS","Ionogramme","Glycémie","Bilan complet"] },
      { cle:"imagerie",    lbl:"Imagerie", court:"Imagerie",
        prec:["Radio","Échographie","Scanner","IRM"] },
      { cle:"cr-hospit",   lbl:"Compte-rendu d'hospitalisation", court:"CR-hospit",
        prec:["Entrée","Sortie","Séjour"] },
      { cle:"cr-consult",  lbl:"Compte-rendu de consultation", court:"CR-consult",
        prec:["Spécialiste","Médecin traitant","Urgences"] },
    ]},
  { cle:"soin",  ic:"🩹", lbl:"Suivi de soin", col:"var(--amber)", types:[
      { cle:"plaie",       lbl:"Photo de plaie", court:"Plaie",
        prec:["Sacrum","Talon","Jambe droite","Jambe gauche","Autre localisation"],
        garderImage:true },
      { cle:"protocole",   lbl:"Protocole de pansement", court:"Protocole",
        prec:["Pansement","Sondage","Autre protocole"] },
      { cle:"surveillance",lbl:"Feuille de surveillance", court:"Surveillance",
        prec:["Constantes","Poids","Glycémies"] },
      { cle:"recueil",     lbl:"Fiche de recueil", court:"Recueil",
        prec:["Remplie par le patient","Remplie au domicile"] },
    ]},
  { cle:"admin", ic:"📋", lbl:"Administratif", col:"var(--violet,#b98ce8)", types:[
      { cle:"vitale",      lbl:"Carte Vitale / attestation", court:"Vitale",
        prec:["Attestation de droits","Carte Vitale"] },
      { cle:"mutuelle",    lbl:"Mutuelle", court:"Mutuelle",
        prec:["Carte","Attestation"] },
      { cle:"pec",         lbl:"Accord de prise en charge", court:"PEC",
        prec:["Accord","Demande","Refus"] },
    ]},
  { cle:"libre", ic:"✏️", lbl:"Libre", col:"var(--faint)", types:[
      { cle:"libre",       lbl:"Document libre", court:"Document",
        prec:[] },   // aucune suggestion : saisie entièrement libre
    ]},
];

/* Retrouver un type depuis sa clé */
function docType(cle){
  for (const f of DOC_FAMILLES){
    const t = f.types.find(x => x.cle === cle);
    if (t) return { ...t, fam:f.cle, ic:f.ic, col:f.col, famLbl:f.lbl };
  }
  return null;
}

/* Nom composé, comparable d'un appareil à l'autre.
   ⚠️ Sans accents ni espaces : il sert aussi de nom de fichier
   lors du partage, et certains systèmes les gèrent mal. */
function docNomCompose(typeCle, precision, dateISO){
  const t = docType(typeCle);
  const propre = s => String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const d = dateISO || workDate();
  return [d, t ? t.court : "Document", propre(precision)].filter(Boolean).join("_");
}

/* Libellé lisible pour l'affichage */
function docLabel(d){
  const t = d.type ? docType(d.type) : null;
  if (!t) return d.name || "Document";
  return t.lbl + (d.precision ? " — " + d.precision : "");
}

/* Un document sans type : ajouté avant la nomenclature */
function docAQualifier(d){ return !d.type; }

/* ============================================================
   CONVERSION EN PDF
   ─────────────────────────────────────────────────────────
   Une photo d'iPhone pèse ~3,3 Mo ; convertie en A4 à 200 dpi
   elle tombe à ~500 Ko, soit 85 % de moins — et plusieurs pages
   deviennent UN fichier. Décisif ici : les documents transitent
   par la synchronisation.

   ⚠️ La conversion RÉDUIT la définition et l'original n'est pas
   conservé. Jamais proposée par défaut sur une photo de plaie,
   où le zoom sert au suivi.
============================================================ */

function docConversionUtile(typeCle){
  const t = typeCle ? docType(typeCle) : null;
  return !(t && t.garderImage);      // vrai sauf pour les plaies
}

/* Assembler des images en un seul PDF */
async function imagesVersPdf(dataUrls){
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF absent");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:"mm", format:"a4", compress:true });
  const LA = 210, HA = 297;
  for (let i = 0; i < dataUrls.length; i++){
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej; im.src = dataUrls[i];
    });
    // Réduire à 200 dpi A4 : au-delà, on stocke du détail invisible
    const MAXW = 1654, MAXH = 2339;
    let w = img.width, h = img.height;
    const r = Math.min(MAXW / w, MAXH / h, 1);
    w = Math.round(w * r); h = Math.round(h * r);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    const jpg = cv.toDataURL("image/jpeg", 0.78);
    // Ajuster dans la page en gardant les proportions
    const ech = Math.min(LA / w, HA / h);
    const pw = w * ech, ph = h * ech;
    if (i > 0) pdf.addPage();
    pdf.addImage(jpg, "JPEG", (LA - pw) / 2, (HA - ph) / 2, pw, ph);
  }
  return pdf.output("datauristring");
}

/* Poids d'une donnée encodée, pour informer avant conversion */
function poidsDataUrl(u){
  const b64 = String(u||"").split(",")[1] || "";
  return Math.round(b64.length * 0.75);
}
function poidsLisible(o){
  return o > 1048576 ? (o/1048576).toFixed(1) + " Mo" : Math.round(o/1024) + " Ko";
}

/* ============================================================
   ÉCRAN DE QUALIFICATION
   Type ET précision obligatoires : sans eux, pas d'ajout.
============================================================ */
async function qualifierDoc(nbImages, poids, mime){
  return new Promise(resolve => {
    let fam = null, type = null, prec = "", format = "auto";
    const estImage = /^image\//.test(mime||"");

    const dessine = () => {
      const t = type ? docType(type) : null;
      const pret = !!(type && prec.trim());
      const nom = pret ? docNomCompose(type, prec) : "";
      const convUtile = estImage && docConversionUtile(type);

      $("#sheet").innerHTML = `
        ${navHeader("Annuler", true)}
        <h3>📎 Nouveau document</h3>
        <p class="small muted" style="margin-bottom:12px">${
          nbImages > 1 ? nbImages + " images" : (estImage ? "1 image" : "Fichier")
        } · ${esc(poidsLisible(poids))}</p>

        <div class="rowlab vi"><span>1 · Type de document</span><i></i>
          <em>${type ? "✓" : "à choisir"}</em></div>
        <div class="rowbox vi" style="display:block">
          ${DOC_FAMILLES.map(f => {
            const ouvert = fam === f.cle;
            return `<div class="dfam ${ouvert?"on":""}" data-dfam="${f.cle}">
              <div class="dfam-h">
                <span>${f.ic}</span>
                <span class="dfam-l">${f.lbl}</span>
                <span class="dfam-c">${ouvert ? "▾" : (f.types.length>1 ? f.types.length+" ›" : "›")}</span>
              </div>
              ${ouvert ? `<div class="dfam-t">${f.types.map(t2 =>
                `<button class="chip ${type===t2.cle?"on":""}" data-dtyp="${t2.cle}">${esc(t2.lbl)}</button>`
              ).join("")}</div>` : ""}
            </div>`;
          }).join("")}
        </div>

        ${type ? `
        <div class="rowlab am" style="margin-top:12px"><span>2 · Précision</span><i></i>
          <em>${prec.trim() ? "✓" : "requise"}</em></div>
        <div class="rowbox am" style="display:block">
          ${t.prec.length ? `<div class="rowb" style="flex-wrap:wrap;gap:4px;margin-bottom:7px">
            ${t.prec.map(s => `<button class="chip sm ${prec===s?"on":""}" data-dprec="${esc(s)}">${esc(s)}</button>`).join("")}
          </div>` : ""}
          <input id="d-prec" class="rec-in" value="${esc(prec)}"
            placeholder="${t.prec.length ? "ou saisir librement…" : "décris le document…"}">
        </div>` : ""}

        ${convUtile ? `
        <div class="rowlab ac" style="margin-top:12px"><span>Format</span><i></i>
          <em>${nbImages>1 ? "conseillé : PDF" : ""}</em></div>
        <div class="rowbox ac" style="display:block">
          <div class="rowb" style="gap:5px">
            <button class="chip ${format!=="img"?"on":""}" data-dfmt="pdf" style="flex:1">📄 En faire un PDF</button>
            <button class="chip ${format==="img"?"on":""}" data-dfmt="img" style="flex:1">🖼 Garder les images</button>
          </div>
          <p class="small muted" style="margin:6px 0 0;font-size:9.5px">Le PDF réunit les pages et allège fortement le fichier. Les images gardent leur définition d'origine.</p>
        </div>` : ""}
        ${estImage && !convUtile && type ? `
        <p class="small muted" style="margin-top:10px">🖼 Images conservées : le zoom sert au suivi de la plaie.</p>` : ""}

        ${pret ? `
        <div class="dnom">
          <div class="dnom-l">Nom attribué</div>
          <div class="dnom-v">${esc(nom)}</div>
        </div>` : ""}

        <div class="rowb" style="margin-top:14px;gap:8px">
          <button class="btn btn-ghost" id="d-cancel" style="flex:1">Annuler</button>
          <button class="btn btn-primary" id="d-ok" style="flex:1.4" ${pret?"":"disabled"}>✓ Ajouter</button>
        </div>
        ${!pret ? `<p class="small muted" style="margin-top:7px;text-align:center">Choisis un type et une précision pour ajouter.</p>` : ""}`;

      $$("#sheet [data-dfam]").forEach(e => {
        const h = e.querySelector(".dfam-h");
        if (h) h.onclick = () => {
          fam = (fam === e.dataset.dfam) ? null : e.dataset.dfam;
          dessine();
        };
      });
      $$("#sheet [data-dtyp]").forEach(b => b.onclick = () => {
        type = b.dataset.dtyp; prec = "";
        // La conversion se règle sur le type : jamais imposée sur une plaie
        format = docConversionUtile(type) ? "pdf" : "img";
        dessine();
      });
      $$("#sheet [data-dprec]").forEach(b => b.onclick = () => { prec = b.dataset.dprec; dessine(); });
      $$("#sheet [data-dfmt]").forEach(b => b.onclick = () => { format = b.dataset.dfmt; dessine(); });
      { const e = $("#d-prec"); if (e) e.oninput = () => {
          prec = e.value;
          const ok = $("#d-ok"); if (ok) ok.disabled = !(type && prec.trim());
        }; }
      { const b = $("#d-cancel"); if (b) b.onclick = () => { closeSheet(); resolve(null); }; }
      { const b = $("#d-ok"); if (b) b.onclick = () => {
          if (!type || !prec.trim()) return;
          closeSheet();
          resolve({ type, precision:prec.trim(), format, nom:docNomCompose(type, prec) });
        }; }
    };
    openSheet("");
    dessine();
  });
}


/* ===== plaies.js ===== */
/* ============================================================
   SUIVI DE PLAIE
   ─────────────────────────────────────────────────────────
   Les photos de plaie existaient déjà comme documents, mais
   rien ne les reliait : impossible de voir l'évolution d'un
   escarre sur trois semaines, ni de clore une plaie guérie.

   ⚠️ L'app ENREGISTRE le stade, elle ne l'INTERPRÈTE jamais.
   Pas d'alerte « plaie qui se dégrade », pas de conclusion
   clinique : ce serait franchir la frontière du dispositif
   médical. Les photos côte à côte suffisent — l'IDEL juge.
   Question ouverte dans CONFORMITE_A_PREPARER.md.
============================================================ */

const PLAIE_TYPES = [
  { cle:"escarre",  lbl:"Escarre",            court:"Escarre" },
  { cle:"ulcere",   lbl:"Ulcère",             court:"Ulcère" },
  { cle:"chir",     lbl:"Plaie chirurgicale", court:"Plaie chir." },
  { cle:"brulure",  lbl:"Brûlure",            court:"Brûlure" },
  { cle:"trauma",   lbl:"Plaie traumatique",  court:"Plaie" },
  { cle:"autre",    lbl:"Autre",              court:"Plaie" },
];

/* Les cinq localisations les plus fréquentes, en accès direct */
const PLAIE_COURANTES = ["Sacrum","Talon gauche","Talon droit","Jambe gauche","Jambe droite"];

/* Toutes les localisations, groupées par région.
   `vue` indique sur quelle silhouette la zone est cliquable. */
const PLAIE_REGIONS = [
  { cle:"tronc", lbl:"Tête et tronc", zones:[
    { n:"Occiput",              vue:"dos" },
    { n:"Oreille gauche",       vue:"dos" },
    { n:"Oreille droite",       vue:"dos" },
    { n:"Omoplate gauche",      vue:"dos" },
    { n:"Omoplate droite",      vue:"dos" },
    { n:"Rachis dorsal",        vue:"dos" },
    { n:"Rachis lombaire",      vue:"dos" },
    { n:"Thorax",               vue:"face" },
    { n:"Abdomen",              vue:"face" },
    { n:"Flanc gauche",         vue:"face" },
    { n:"Flanc droit",          vue:"face" },
  ]},
  { cle:"bassin", lbl:"Bassin", zones:[
    { n:"Sacrum",               vue:"dos" },
    { n:"Coccyx",               vue:"dos" },
    { n:"Ischion gauche",       vue:"dos" },
    { n:"Ischion droit",        vue:"dos" },
    { n:"Trochanter gauche",    vue:"dos" },
    { n:"Trochanter droit",     vue:"dos" },
    { n:"Crête iliaque gauche", vue:"face" },
    { n:"Crête iliaque droite", vue:"face" },
    { n:"Pli inter-fessier",    vue:"dos" },
  ]},
  { cle:"minf", lbl:"Membres inférieurs", zones:[
    { n:"Cuisse gauche",        vue:"face" },
    { n:"Cuisse droite",        vue:"face" },
    { n:"Genou gauche",         vue:"face" },
    { n:"Genou droit",          vue:"face" },
    { n:"Jambe gauche",         vue:"face" },
    { n:"Jambe droite",         vue:"face" },
    { n:"Mollet gauche",        vue:"dos" },
    { n:"Mollet droit",         vue:"dos" },
    { n:"Malléole interne gauche", vue:"face" },
    { n:"Malléole externe gauche", vue:"face" },
    { n:"Malléole interne droite", vue:"face" },
    { n:"Malléole externe droite", vue:"face" },
    { n:"Talon gauche",         vue:"dos" },
    { n:"Talon droit",          vue:"dos" },
    { n:"Pied gauche",          vue:"face" },
    { n:"Pied droit",           vue:"face" },
    { n:"Plante gauche",        vue:"dos" },
    { n:"Plante droite",        vue:"dos" },
    { n:"Orteils gauche",       vue:"face" },
    { n:"Orteils droit",        vue:"face" },
  ]},
  { cle:"msup", lbl:"Membres supérieurs", zones:[
    { n:"Épaule gauche",        vue:"dos" },
    { n:"Épaule droite",        vue:"dos" },
    { n:"Bras gauche",          vue:"face" },
    { n:"Bras droit",           vue:"face" },
    { n:"Coude gauche",         vue:"dos" },
    { n:"Coude droit",          vue:"dos" },
    { n:"Avant-bras gauche",    vue:"face" },
    { n:"Avant-bras droit",     vue:"face" },
    { n:"Poignet gauche",       vue:"face" },
    { n:"Poignet droit",        vue:"face" },
    { n:"Main gauche",          vue:"dos" },
    { n:"Main droite",          vue:"dos" },
    { n:"Doigts gauche",        vue:"face" },
    { n:"Doigts droit",         vue:"face" },
  ]},
];

function plaieToutesZones(){
  return PLAIE_REGIONS.flatMap(r => r.zones.map(z => z.n));
}
function plaieRegionDe(nom){
  for (const r of PLAIE_REGIONS) if (r.zones.some(z => z.n === nom)) return r;
  return null;
}

/* Nom composé : « Escarre sacrée » se lit mieux que « Escarre — Sacrum ».
   On reste simple : type + localisation en minuscules. */
function plaieNom(p){
  const t = PLAIE_TYPES.find(x => x.cle === p.type);
  const base = t ? t.court : "Plaie";
  const l = String(p.loc||"").trim();
  // « Escarre sacrée » se lit mieux que « Escarre sacrum » : quelques
  // localisations courantes ont une forme adjectivale usuelle.
  const ADJ = { "Sacrum":"sacrée", "Coccyx":"coccygienne", "Occiput":"occipitale" };
  if (ADJ[l] && base === "Escarre") return base + " " + ADJ[l];
  return base + " " + (l.charAt(0).toLowerCase() + l.slice(1));
}

/* Depuis combien de jours la plaie est-elle ouverte ? */
function plaieJours(pl, refISO){
  if (!pl || !pl.depuis) return null;
  const d1 = new Date(pl.depuis + "T12:00:00");
  const d2 = new Date((pl.cicatriseeLe || refISO || workDate()) + "T12:00:00");
  return Math.max(0, Math.round((d2 - d1) / 864e5));
}

/* Les photos rattachées, de la plus ancienne à la plus récente */
function plaiePhotos(p, pl){
  return (p.docs||[])
    .filter(d => (pl.docIds||[]).includes(d.id))
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
}

/* Les plaies ouvertes, pour la relève et le ménage documentaire */
function plaiesOuvertes(p){
  return (p.plaies||[]).filter(pl => !pl.cicatriseeLe);
}

/* Une photo appartient-elle à une plaie encore ouverte ?
   ⚠️ Sert de garde-fou au ménage : ces photos ne sont jamais
   proposées d'office à la suppression. */
function docPlaieOuverte(p, docId){
  return plaiesOuvertes(p).some(pl => (pl.docIds||[]).includes(docId));
}

/* Ligne de relève — un constat daté, sans jugement clinique */
function plaieTexteReleve(p){
  return plaiesOuvertes(p).map(pl => {
    const j = plaieJours(pl);
    const der = plaiePhotos(p, pl).slice(-1)[0];
    return plaieNom(pl)
      + (j !== null ? " — " + j + " j" : "")
      + (pl.stade ? ", stade " + pl.stade : "")
      + (der ? " · dernière photo le " + fmtFR(der.date) : "");
  });
}

/* ============================================================
   SILHOUETTES
   ─────────────────────────────────────────────────────────
   Schématiques, pas anatomiques : le repère utile est la
   RÉGION, pas la morphologie. Trois formes néanmoins
   distinctes — cheveux longs et hanches pour la femme,
   épaules larges et torse en V pour l'homme.
============================================================ */

/* ============================================================
   LE CORPS EN RÉGIONS CLIQUABLES
   ─────────────────────────────────────────────────────────
   ⚠️ Chaque région du corps EST la zone cliquable : plus de
   pastilles superposées qui masquaient le dessin. Toucher une
   partie la colore directement.

   Les tracés sont paramétrés par les largeurs d'épaules, de
   taille et de hanches, qui portent la différence de genre.
============================================================ */

/* Un corps = une liste de { zone, tracé }. Le tracé dépend du
   gabarit, calculé une fois selon le genre. */
function plaieGabarit(genre){
  const F = genre === "F", H = genre === "M";
  return {
    ep: F ? 16 : (H ? 20 : 18),    // demi-largeur d'épaules
    ta: F ? 12 : (H ? 16 : 14),    // taille
    ha: F ? 17 : (H ? 15 : 16),    // hanches
    tete: F ? 7.6 : (H ? 8.4 : 8),
    F, H
  };
}

function plaieRegionsSVG(genre, vue){
  const g = plaieGabarit(genre);
  const { ep, ta, ha } = g;
  const C = 50;   // axe du corps
  const dos = vue === "dos";

  const R = [];
  const add = (zone, d) => R.push({ zone, d });

  // ── Tête ──
  add(dos ? "Occiput" : "Thorax",
      dos ? `M${C-g.tete} 13 a${g.tete} 9.5 0 0 1 ${g.tete*2} 0 a${g.tete} 9.5 0 0 1 ${-g.tete*2} 0 z` : null);
  if (dos) R.pop(), add("Occiput", `M${C-g.tete} 11 a${g.tete} 9.5 0 0 1 ${g.tete*2} 0 l0 4 a${g.tete} 9.5 0 0 1 ${-g.tete*2} 0 z`);
  else add("Thorax", null), R.pop();

  // Le crâne, toujours présent (cliquable seulement de dos)
  if (dos) {} else add("__tete", `M${C-g.tete} 13 a${g.tete} 9.5 0 1 1 ${g.tete*2} 0 a${g.tete} 9.5 0 1 1 ${-g.tete*2} 0 z`);

  // ── Cou ──
  add("__cou", `M${C-4} 21 h8 v6 h-8 z`);

  // ── Haut du tronc ──
  if (dos){
    add("Omoplate gauche", `M${C-ep} 27 q${ep/2} -3 ${ep-1} -2 l-1 17 q-${ep/2} 1 -${ep-2} -1 z`);
    add("Omoplate droite", `M${C+ep} 27 q-${ep/2} -3 -${ep-1} -2 l1 17 q${ep/2} 1 ${ep-2} -1 z`);
    add("Rachis dorsal",   `M${C-2} 25 h4 l0 19 h-4 z`);
    add("Rachis lombaire", `M${C-2} 44 h4 l0 12 h-4 z`);
  } else {
    add("Thorax",  `M${C-ep} 27 q${ep} -4 ${ep*2} 0 l-1 16 q-${ep} 3 -${(ep-1)*2} 0 z`);
    add("Abdomen", `M${C-ta-1} 43 q${ta+1} 3 ${(ta+1)*2} 0 l-1 14 q-${ta} 3 -${ta*2} 0 z`);
  }

  // ── Flancs / côtés du tronc ──
  if (!dos){
    add("Flanc gauche", `M${C-ep} 30 l-2 14 q2 2 4 1 l1 -14 z`);
    add("Flanc droit",  `M${C+ep} 30 l2 14 q-2 2 -4 1 l-1 -14 z`);
  }

  // ── Bassin ──
  if (dos){
    add("Sacrum", `M${C-9} 56 q9 3 18 0 l-1 12 q-8 2 -16 0 z`);
    add("Coccyx", `M${C-5} 68 q5 2 10 0 l-1 5 q-4 1 -8 0 z`);
    add("Trochanter gauche", `M${C-ha} 55 q-4 3 -3 9 q1 5 5 5 l2 -13 z`);
    add("Trochanter droit",  `M${C+ha} 55 q4 3 3 9 q-1 5 -5 5 l-2 -13 z`);
    add("Ischion gauche", `M${C-9} 68 q4 2 8 0 l-1 6 q-4 1 -7 0 z`);
    add("Ischion droit",  `M${C+1} 68 q4 2 8 0 l-1 6 q-4 1 -7 0 z`);
  } else {
    add("Crête iliaque gauche", `M${C-ha} 56 q-3 3 -2 8 q3 2 6 0 l1 -8 z`);
    add("Crête iliaque droite", `M${C+ha} 56 q3 3 2 8 q-3 2 -6 0 l-1 -8 z`);
  }

  // ── Bras ──
  const brasG = `M${C-ep} 28 q-7 3 -9 10 l-3 19 q3 2 6 1 l3 -18 q2 -6 5 -8 z`;
  const brasD = `M${C+ep} 28 q7 3 9 10 l3 19 q-3 2 -6 1 l-3 -18 q-2 -6 -5 -8 z`;
  if (dos){
    add("Épaule gauche", `M${C-ep-1} 26 q-6 2 -8 8 q4 2 8 0 z`);
    add("Épaule droite", `M${C+ep+1} 26 q6 2 8 8 q-4 2 -8 0 z`);
    add("Coude gauche", `M${C-ep-9} 45 q4 1 6 -1 l-1 7 q-4 1 -6 -1 z`);
    add("Coude droit",  `M${C+ep+3} 45 q4 2 6 1 l1 7 q-2 2 -6 1 z`);
  } else {
    add("Bras gauche", brasG);
    add("Bras droit",  brasD);
    add("Avant-bras gauche", `M${C-ep-11} 47 q5 2 8 0 l-2 13 q-4 1 -7 -1 z`);
    add("Avant-bras droit",  `M${C+ep+3} 47 q3 2 8 0 l1 12 q-3 2 -7 1 z`);
  }
  add("Main gauche", `M${C-ep-11} 60 q4 -2 8 0 l0 7 q-4 2 -8 0 z`);
  add("Main droite", `M${C+ep+3} 60 q4 -2 8 0 l0 7 q-4 2 -8 0 z`);

  // ── Jambes ──
  add("Cuisse gauche", `M${C-ha+1} 72 q6 -2 11 0 l-1 15 q-5 2 -9 0 z`);
  add("Cuisse droite", `M${C+2} 72 q6 -2 11 0 l-1 15 q-5 2 -9 0 z`);
  add("Genou gauche",  `M${C-ha+2} 87 q5 -2 9 0 l0 7 q-5 2 -9 0 z`);
  add("Genou droit",   `M${C+3} 87 q5 -2 9 0 l0 7 q-5 2 -9 0 z`);
  if (dos){
    add("Mollet gauche", `M${C-ha+2} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
    add("Mollet droit",  `M${C+3} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
  } else {
    add("Jambe gauche", `M${C-ha+2} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
    add("Jambe droite", `M${C+3} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
    add("Malléole interne gauche", `M${C-ha+5} 108 q3 -1 4 0 l0 4 q-3 1 -4 0 z`);
    add("Malléole externe gauche", `M${C-ha+2} 108 q2 -1 3 0 l0 4 q-2 1 -3 0 z`);
    add("Malléole interne droite", `M${C+3} 108 q2 -1 3 0 l0 4 q-2 1 -3 0 z`);
    add("Malléole externe droite", `M${C+8} 108 q3 -1 4 0 l0 4 q-3 1 -4 0 z`);
  }

  // ── Pieds ──
  if (dos){
    add("Talon gauche", `M${C-ha+2} 108 q5 -2 9 0 l0 6 q-5 2 -9 0 z`);
    add("Talon droit",  `M${C+3} 108 q5 -2 9 0 l0 6 q-5 2 -9 0 z`);
    add("Plante gauche", `M${C-ha+1} 114 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
    add("Plante droite", `M${C+2} 114 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
  } else {
    add("Pied gauche", `M${C-ha+1} 112 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
    add("Pied droit",  `M${C+2} 112 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
    add("Orteils gauche", `M${C-ha+1} 118 q6 -2 11 0 l0 3 q-6 2 -11 0 z`);
    add("Orteils droit",  `M${C+2} 118 q6 -2 11 0 l0 3 q-6 2 -11 0 z`);
  }
  return R.filter(x => x.d);
}

/* Les cheveux, seule touche décorative — ils portent le genre */
function plaieCheveux(genre){
  const F = genre === "F", H = genre === "M";
  if (F) return `<path d="M${50-9} 10 q0 -9 9 -9 t9 9 q1 19 -2 29 l-3 -2 q2 -11 1 -22 q-5 4 -10 0 q-1 11 1 22 l-3 2 q-3 -10 -2 -29 z" fill="currentColor" opacity=".3"/>`;
  if (H) return `<path d="M${50-8} 8 q1 -6 8 -6 t8 6 q0 2 -1 3 q-7 -3 -14 0 q-1 -1 -1 -3 z" fill="currentColor" opacity=".3"/>`;
  return "";
}

/* La silhouette : chaque région est cliquable et se colore.
   ⚠️ Le nom de la zone choisie s'affiche HORS du SVG — un texte
   dans le tracé grandit avec lui au zoom et devient illisible. */
function plaieCorpsFond(genre){
  const g = plaieGabarit(genre);
  const { ep, ta, ha, tete } = g;
  const C = 50;
  // Un seul tracé continu : tête, tronc, bras, jambes, pieds
  return `
    <ellipse cx="${C}" cy="13" rx="${tete}" ry="9.5"/>
    <path d="M${C-4} 20 h8 v7 h-8 z"/>
    <path d="M${C-ep} 27
             C${C-ep} 27 ${C} 23 ${C+ep} 27
             L${C+ta} 46
             C${C+ta} 46 ${C+ha} 52 ${C+ha} 58
             L${C+ha-2} 70
             C${C+ha-2} 70 ${C} 74 ${C-ha+2} 70
             L${C-ha} 58
             C${C-ha} 52 ${C-ta} 46 ${C-ta} 46
             Z"/>
    <path d="M${C-ep} 28 q-8 3 -10 10 l-4 21 q3 3 7 1 l4 -20 q2 -6 6 -8 z"/>
    <path d="M${C+ep} 28 q8 3 10 10 l4 21 q-3 3 -7 1 l-4 -20 q-2 -6 -6 -8 z"/>
    <ellipse cx="${C-ep-7}" cy="63" rx="4" ry="5"/>
    <ellipse cx="${C+ep+7}" cy="63" rx="4" ry="5"/>
    <path d="M${C-ha+1} 68 q6 -2 11 0 l-2 24 q0 4 -1 8 l-1 18 q-4 2 -8 0 l-1 -18 q-1 -4 -1 -8 z"/>
    <path d="M${C+2} 68 q6 -2 11 0 l-1 24 q0 4 -1 8 l-1 18 q-4 2 -8 0 l-1 -18 q-1 -4 -1 -8 z"/>
    <path d="M${C-ha} 116 q6 -2 12 0 l0 5 q-6 2 -12 0 z"/>
    <path d="M${C+1} 116 q6 -2 12 0 l0 5 q-6 2 -12 0 z"/>`;
}

function plaieSilhouette(genre, vue, choisie, grand){
  const regions = plaieRegionsSVG(genre, vue);
  const zs = regions.map(r => {
    const cli = !r.zone.startsWith("__");
    const on  = r.zone === choisie;
    const cls = "preg" + (on ? " on" : "") + (cli ? "" : " fixe");
    return `<path class="${cls}" d="${r.d}"${cli?` data-zone="${esc(r.zone)}"`:""}/>`;
  }).join("");
  return `<svg viewBox="0 0 100 124" class="plaie-svg${grand?" grand":""}" data-vue="${vue}">
    <g class="deco">${plaieCheveux(genre)}</g>
    <g class="fond">${plaieCorpsFond(genre)}</g>
    <g class="zones">${zs}</g></svg>`;
}

/* ============================================================
   ÉCRAN DE SUIVI
============================================================ */
function sheetPlaies(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable"); return; }
  p.plaies = p.plaies || [];
  const ouvertes = plaiesOuvertes(p);
  const fermees  = (p.plaies||[]).filter(pl => pl.cicatriseeLe);

  const carte = (pl, close) => {
    const j = plaieJours(pl);
    const ph = plaiePhotos(p, pl);
    const vign = ph.slice(-4).map((d,i) => `
      <div class="plv${i===ph.slice(-4).length-1?" der":""}" data-photo="${d.id}">
        <span>${fmtFR(d.date)}</span></div>`).join("");
    return `
    <div class="plcard ${close?"ok":"on"}" data-pl="${pl.id}">
      <div class="plhead">
        <div style="flex:1;min-width:0">
          <div class="pltit">${esc(plaieNom(pl))}</div>
          <div class="plsub">${close
            ? "cicatrisée le " + fmtFR(pl.cicatriseeLe) + (j!==null?" · "+j+" jours":"")
            : (j!==null ? "ouverte depuis "+j+" j" : "") + (pl.stade?" · stade "+pl.stade:"")
              + " · " + ph.length + " photo" + (ph.length>1?"s":"")}</div>
        </div>
        <span class="plbadge">${close?"✓ fermée":"en cours"}</span>
      </div>
      ${ph.length ? `<div class="plphotos">${vign}${ph.length>4?`<i>+${ph.length-4}</i>`:""}</div>` : ""}
      ${pl.mesures ? `<div class="plmes">📏 ${esc(pl.mesures)}</div>` : ""}
      <div class="rowb" style="gap:5px;margin-top:8px">
        <button class="btn btn-ghost sm" data-plphoto="${pl.id}" style="flex:1">📷 Ajouter une photo</button>
        ${close ? `<button class="btn btn-ghost sm" data-plrouvrir="${pl.id}" style="flex:1">↩ Rouvrir</button>`
                : `<button class="btn btn-ghost sm" data-plfermer="${pl.id}" style="flex:1">✓ Cicatrisée</button>`}
      </div>
    </div>`;
  };

  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>🩹 Suivi de plaie</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}</p>

    ${ouvertes.length ? `
      <div class="rowlab am"><span>En cours</span><i></i><em>${ouvertes.length}</em></div>
      <div class="rowbox am" style="display:block">${ouvertes.map(pl => carte(pl,false)).join("")}</div>` : ""}

    ${fermees.length ? `
      <div class="rowlab vi" style="margin-top:12px"><span>Cicatrisées</span><i></i><em>${fermees.length}</em></div>
      <div class="rowbox vi" style="display:block">${fermees.map(pl => carte(pl,true)).join("")}</div>` : ""}

    ${!p.plaies.length ? `<p class="small muted" style="text-align:center;padding:20px 0">Aucune plaie suivie pour ce patient.</p>` : ""}

    <button class="btn btn-primary" id="pl-new" style="width:100%;margin-top:14px">＋ Nouvelle plaie</button>
    <p class="small muted" style="margin-top:9px">Les photos sont datées et rattachées à la plaie. L'app les range, <b>elle n'interprète pas</b> — l'évaluation reste la tienne.</p>`);

  { const b = $("#pl-new"); if (b) b.onclick = () => plaieNouvelle(pid); }
  $$("#sheet [data-plfermer]").forEach(b => b.onclick = async () => {
    const pl = p.plaies.find(x => x.id === b.dataset.plfermer);
    if (!pl) return;
    if (!await askDialog({ ic:"✓", titre:"Plaie cicatrisée ?",
      sub:plaieNom(pl), oui:"✓ Cicatrisée", non:"Annuler" })) return;
    pl.cicatriseeLe = workDate();
    save(true); sheetPlaies(pid); toast("Plaie close ✓");
  });
  $$("#sheet [data-plrouvrir]").forEach(b => b.onclick = () => {
    const pl = p.plaies.find(x => x.id === b.dataset.plrouvrir);
    if (!pl) return;
    pl.cicatriseeLe = null; save(true); sheetPlaies(pid); toast("Plaie rouverte");
  });
  $$("#sheet [data-plphoto]").forEach(b => b.onclick = () => {
    // Le document sera rattaché à cette plaie après ajout
    _plaieEnCours = b.dataset.plphoto;
    docTargetPid = pid;
    const el = document.getElementById("camerafile"); if (el) el.click();
  });
  $$("#sheet [data-photo]").forEach(e => e.onclick = () => {
    const d = (p.docs||[]).find(x => x.id === e.dataset.photo);
    if (d) viewDoc(d);
  });
}

/* ============================================================
   CRÉER UNE PLAIE
============================================================ */
function plaieNouvelle(pid){
  const p = getP(pid);
  let type = null, loc = null, stade = "", vue = "dos", libre = "";
  let mes = { l:"", L:"", prof:"" };
  const genre = p.genre === "F" ? "F" : (p.genre === "M" ? "M" : "N");

  const dessine = () => {
    const reg  = loc ? plaieRegionDe(loc) : null;
    const pret = !!(type && (loc || libre.trim()));
    const listeZones = (reg || PLAIE_REGIONS[1]).zones;

    $("#sheet").innerHTML = `
      ${navHeader("Annuler", true)}
      <h3>🩹 Nouvelle plaie</h3>
      <p class="small muted" style="margin-bottom:12px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}</p>

      <div class="rowlab vi"><span>1 · Type</span><i></i><em>${type?"✓":"à choisir"}</em></div>
      <div class="rowbox vi" style="display:block">
        <div class="rowb" style="flex-wrap:wrap;gap:4px">
          ${PLAIE_TYPES.map(t => `<button class="chip sm ${type===t.cle?"on":""}" data-pt="${t.cle}">${esc(t.lbl)}</button>`).join("")}
        </div>
      </div>

      <div class="rowlab ac" style="margin-top:12px"><span>2 · Localisation</span><i></i>
        <em>${loc||libre.trim() ? "✓" : "requise"}</em></div>
      <div class="rowbox ac" style="display:block">
        <div class="rowb" style="flex-wrap:wrap;gap:4px;margin-bottom:9px">
          ${PLAIE_COURANTES.map(z => `<button class="chip sm ${loc===z?"on":""}" data-pz="${esc(z)}">${esc(z)}</button>`).join("")}
        </div>
        <div class="plvues">
          <button class="chip ${vue==="dos"?"on":""}" data-pvue="dos" style="flex:1">◐ DOS</button>
          <button class="chip ${vue==="face"?"on":""}" data-pvue="face" style="flex:1">◑ FACE</button>
        </div>
        <div class="plbody">
          <div class="plsil">
            ${plaieSilhouette(genre, vue, loc, false)}
            <button class="plzoom" id="pl-zoom" title="Agrandir">⛶</button>
            <div class="plgenre">${loc ? esc(loc) : (genre==="F"?"femme":(genre==="M"?"homme":"neutre")) + " · " + vue}</div>
          </div>
          <div class="pllist">
            <div class="pllab">${esc((reg||PLAIE_REGIONS[1]).lbl)}</div>
            <div class="pllz">
              ${listeZones.map(z => `<button class="plz ${loc===z.n?"on":""}" data-pz="${esc(z.n)}">${esc(z.n)}</button>`).join("")}
            </div>
            <div class="rowb" style="flex-wrap:wrap;gap:3px;margin-top:7px">
              ${PLAIE_REGIONS.map(r => `<button class="chip sm ${reg&&reg.cle===r.cle?"on":""}" data-preg="${r.cle}">${esc(r.lbl)}</button>`).join("")}
            </div>
            <input id="pl-libre" class="rec-in" value="${esc(libre)}"
              placeholder="✏️ autre — préciser" style="margin-top:7px;font-size:13px">
          </div>
        </div>
      </div>

      <div class="rowlab vi" style="margin-top:12px"><span>3 · Stade</span><i></i><em>facultatif</em></div>
      <div class="rowbox vi" style="display:block">
        <div class="rowb" style="gap:4px">
          ${["1","2","3","4"].map(n => `<button class="chip ${stade===n?"on":""}" data-pst="${n}" style="flex:1">${n}</button>`).join("")}
          <button class="chip ${!stade?"on":""}" data-pst="" style="flex:1.6">non précisé</button>
        </div>
        <p class="small muted" style="margin:6px 0 0;font-size:9.5px">Enregistré tel quel. <b>L'app n'en tire aucune conclusion</b> — l'évaluation reste la tienne.</p>
      </div>

      <div class="rowlab ac" style="margin-top:12px"><span>4 · Mesures</span><i></i><em>facultatif</em></div>
      <div class="rowbox ac" style="display:block">
        <div class="rowb" style="gap:5px">
          <div style="flex:1"><div class="rec-lab">LONGUEUR</div>
            <input id="pl-L" class="rec-in" value="${esc(mes.L)}" placeholder="cm" inputmode="decimal"></div>
          <div style="flex:1"><div class="rec-lab">LARGEUR</div>
            <input id="pl-l" class="rec-in" value="${esc(mes.l)}" placeholder="cm" inputmode="decimal"></div>
          <div style="flex:1"><div class="rec-lab">PROFONDEUR</div>
            <input id="pl-p" class="rec-in" value="${esc(mes.prof)}" placeholder="cm" inputmode="decimal"></div>
        </div>
      </div>

      <div class="rowlab vi" style="margin-top:12px"><span>5 · Apparue le</span><i></i></div>
      <div class="rowbox vi" style="display:block">
        <input id="pl-date" type="date" class="rec-in" value="${workDate()}">
      </div>

      ${pret ? `<div class="dnom"><div class="dnom-l">Nom de la plaie</div>
        <div class="dnom-v">${esc(plaieNom({ type, loc: loc || libre.trim() }))}</div></div>` : ""}

      <div class="rowb" style="margin-top:14px;gap:8px">
        <button class="btn btn-ghost" id="pl-cancel" style="flex:1">Annuler</button>
        <button class="btn btn-primary" id="pl-ok" style="flex:1.4" ${pret?"":"disabled"}>✓ Créer</button>
      </div>`;

    $$("#sheet [data-pt]").forEach(b => b.onclick = () => { type = b.dataset.pt; dessine(); });
    $$("#sheet [data-pz]").forEach(b => b.onclick = () => { loc = b.dataset.pz; libre = ""; dessine(); });
    $$("#sheet [data-preg]").forEach(b => b.onclick = () => {
      const r = PLAIE_REGIONS.find(x => x.cle === b.dataset.preg);
      if (r){ loc = r.zones[0].n; dessine(); }
    });
    $$("#sheet [data-pvue]").forEach(b => b.onclick = () => { vue = b.dataset.pvue; dessine(); });
    $$("#sheet [data-pst]").forEach(b => b.onclick = () => { stade = b.dataset.pst; dessine(); });
    $$("#sheet [data-zone]").forEach(g => g.onclick = () => { loc = g.dataset.zone; libre = ""; dessine(); });
    { const e = $("#pl-libre"); if (e) e.oninput = () => {
        libre = e.value;
        const ok = $("#pl-ok"); if (ok) ok.disabled = !(type && (loc || libre.trim()));
      }; }
    ["L","l","p"].forEach(k => { const e = $("#pl-"+k); if (e) e.oninput = () => {
      mes[k === "p" ? "prof" : k] = e.value; }; });
    { const b = $("#pl-zoom"); if (b) b.onclick = () => plaieZoom(genre, vue, loc, z => { loc = z; libre = ""; dessine(); }); }
    { const b = $("#pl-cancel"); if (b) b.onclick = () => sheetPlaies(pid); }
    { const b = $("#pl-ok"); if (b) b.onclick = () => {
        const finale = loc || libre.trim();
        if (!type || !finale) return;
        const m = [mes.L && mes.L+" cm", mes.l && mes.l+" cm", mes.prof && mes.prof+" cm"]
          .filter(Boolean).join(" × ");
        p.plaies = p.plaies || [];
        p.plaies.push({ id:uid(), type, loc:finale, stade,
          mesures: m || "", depuis: ($("#pl-date")||{}).value || workDate(),
          cicatriseeLe: null, docIds: [] });
        save(true); sheetPlaies(pid); toast("Plaie créée 🩹");
      }; }
  };
  openSheet("");
  dessine();
}

/* La silhouette en grand — les zones deviennent confortables au doigt */
function plaieZoom(genre, vue, choisie, onPick){
  const ov = document.createElement("div");
  ov.className = "plzoom-ov";
  ov.innerHTML = `<div class="plzoom-box">
    <div class="plzoom-h"><b>${vue==="dos"?"◐ Vue de dos":"◑ Vue de face"}</b>
      <button class="plzoom-x">✕</button></div>
    ${plaieSilhouette(genre, vue, choisie, true)}
    <!-- ⚠️ Le nom vit HORS du SVG : un texte dans le tracé grandit
         avec lui au zoom et devient illisible. -->
    <div class="plzoom-nom" id="plz-nom">${choisie ? esc(choisie) : "Tape une zone du corps"}</div>
  </div>`;
  document.body.appendChild(ov);
  const fermer = () => ov.remove();
  ov.querySelector(".plzoom-x").onclick = fermer;
  ov.onclick = e => { if (e.target === ov) fermer(); };
  const nom = ov.querySelector("#plz-nom");
  ov.querySelectorAll("[data-zone]").forEach(g => {
    g.onclick = () => { onPick(g.dataset.zone); fermer(); };
    // Nommer au survol comme au toucher : on sait ce qu'on vise
    ["pointerenter","pointerdown"].forEach(ev =>
      g.addEventListener(ev, () => { if (nom) nom.textContent = g.dataset.zone; }));
  });
}


/* ===== dictate.js ===== */
/* Repli Web Speech API (nécessite une connexion) */
let rec = null;
(function(){
  const SRW = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SRW) return;
  rec = new SRW();
  rec.lang = "fr-FR"; rec.interimResults = false; rec.maxAlternatives = 1;
  rec.onstart = () => { if (rec._b){ rec._b.classList.add("on"); rec._b.textContent="⏹"; } };
  rec.onend   = () => { if (rec._b){ rec._b.classList.remove("on"); rec._b.textContent="🎤"; } };
  rec.onerror = e => { if (e.error!=="aborted" && e.error!=="no-speech") toast("Dictée : "+e.error); };
  rec.onresult = e => {
    const said = e.results[0][0].transcript;
    const t = rec._t;
    if (t && said){
      t.value = (t.value ? t.value.replace(/\s+$/,"")+" " : "") + said;
      t.dispatchEvent(new Event("input", { bubbles:true }));
    }
  };
})();

/* ============================================================
   DICTÉE VOCALE
   1) Plugin natif SpeechRecognition (Android SpeechRecognizer)
      → fonctionne HORS LIGNE si le pack vocal français est
        installé (Réglages Android > Google > Saisie vocale
        > Reconnaissance hors connexion > Français)
   2) Repli : Web Speech API (webkitSpeechRecognition, en ligne)
============================================================ */
let _srListening = false;

async function _nativeDictate(t, b){
  const cap = window.Capacitor;
  const SR = cap && cap.Plugins && cap.Plugins.SpeechRecognition;
  if (!SR || !(cap.isNativePlatform && cap.isNativePlatform())) return false;
  try {
    const av = await SR.available();
    if (!av || !av.available) return false;
    // Permission micro
    try { await SR.requestPermissions(); } catch {}
    if (_srListening){ try{ await SR.stop(); }catch{} _srListening=false; if(b) b.classList.remove("on"); return true; }
    _srListening = true;
    if (b){ b.classList.add("on"); b.textContent = "⏹"; }
    const res = await SR.start({ language:"fr-FR", maxResults:1, partialResults:false, popup:false });
    _srListening = false;
    if (b){ b.classList.remove("on"); b.textContent = "🎤"; }
    const said = res && res.matches && res.matches[0];
    if (said){
      t.value = (t.value ? t.value.replace(/\s+$/,"")+" " : "") + said;
      t.dispatchEvent(new Event("input", { bubbles:true }));
    }
    return true;
  } catch(e){
    _srListening = false;
    if (b){ b.classList.remove("on"); b.textContent = "🎤"; }
    // Si erreur de permission ou annulation → considéré géré (pas de fallback bruyant)
    console.warn("SpeechRecognition:", e);
    return true;
  }
}

function dictate(t, b){
  _nativeDictate(t, b).then(handled => {
    if (handled) return;
    // Repli Web Speech API
    if (!rec){ toast("Dictée non prise en charge ici."); return; }
    rec._t = t; rec._b = b;
    try { rec.start(); } catch {}
  });
}

/* ===== features.js ===== */
/* ============================================================
   FEATURES.JS — Fonctionnalités avancées
   - Graphique évolution des constantes (SVG natif)
   - Galerie chronologique de photos de plaie
   - Recherche globale multi-tournées
   - Log d'erreurs dans IndexedDB
============================================================ */

/* ============ GRAPHIQUE DES CONSTANTES ============ */
const CONST_DEFS = [
  { key:"ta_s",  lbl:"TA syst.",   unit:"cmHg", lo:9,  hi:16, min:6,  max:22, color:"#5B7CFA" },
  { key:"ta_d",  lbl:"TA diast.",  unit:"cmHg", lo:5,  hi:9,  min:3,  max:14, color:"#8B7BFF" },
  { key:"sat",   lbl:"SpO2",       unit:"%",    lo:95, hi:100,min:85, max:100,color:"#22D3EE" },
  { key:"temp",  lbl:"Temp.",      unit:"°C",   lo:36, hi:38, min:34, max:41, color:"#FFB84D" },
  { key:"puls",  lbl:"Pouls",      unit:"bpm",  lo:50, hi:100,min:30, max:140,color:"#FF6E6E" },
  { key:"glyc",  lbl:"Glycémie",   unit:"g/L",  lo:0.7,hi:2.0,min:0.2,max:4.0,color:"#2BB3A3" },
  { key:"douleur",lbl:"Douleur",   unit:"/10",  lo:0,  hi:6,  min:0,  max:10, color:"#E25563" },
];

function extractConstValues(visits, key){
  const pts = [];
  visits.forEach(v => {
    let val = null;
    if (key === "ta_s" && v.consts.ta){
      const m = String(v.consts.ta).match(/^(\d+)/); if (m) val = +m[1];
    } else if (key === "ta_d" && v.consts.ta){
      const m = String(v.consts.ta).match(/\/(\d+)/); if (m) val = +m[1];
    } else if (v.consts[key] !== undefined && v.consts[key] !== ""){
      val = parseFloat(v.consts[key]);
    }
    if (val !== null && !isNaN(val)) pts.push({ date:v.date, at:v.at||"", val });
  });
  return pts.sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
}

function buildConstSvg(pts, def){
  if (!pts.length) return `<p class="muted small" style="padding:16px 0 8px;text-align:center">Aucune mesure enregistrée.</p>`;
  const W = 360, H = 140, PL = 44, PR = 12, PT = 16, PB = 30;
  const gW = W - PL - PR, gH = H - PT - PB;
  const vmin = def.min, vmax = def.max;
  const xScale = i => PL + (pts.length > 1 ? (i / (pts.length - 1)) * gW : gW / 2);
  const yScale = v => PT + gH - ((v - vmin) / (vmax - vmin)) * gH;
  const yLine  = v => Math.max(PT, Math.min(PT + gH, yScale(v)));

  // Zones OK (vert) et alerte (rouge)
  const yHi  = yLine(def.hi), yLo = yLine(def.lo);
  const zones = [
    `<rect x="${PL}" y="${yHi}" width="${gW}" height="${yLo - yHi}" class="graph-zone-ok"/>`,
    `<rect x="${PL}" y="${PT}" width="${gW}" height="${yHi - PT}" class="graph-zone-warn"/>`,
    `<rect x="${PL}" y="${yLo}" width="${gW}" height="${PT + gH - yLo}" class="graph-zone-warn"/>`,
  ];

  // Lignes de référence
  const refLines = [def.hi, def.lo].map(v => {
    const y = yLine(v);
    return `<line x1="${PL}" y1="${y}" x2="${PL+gW}" y2="${y}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${PL-4}" y="${y+4}" class="graph-axis" text-anchor="end">${v}</text>`;
  });

  // Ligne de données
  const polyPts = pts.map((p,i) => `${xScale(i).toFixed(1)},${yLine(p.val).toFixed(1)}`).join(" ");
  const polyline = `<polyline class="graph-line" stroke="${esc(def.color)}" points="${polyPts}"/>`;

  // Points
  const dots = pts.map((pt, i) => {
    const x = xScale(i).toFixed(1), y = yLine(pt.val).toFixed(1);
    const cls = pt.val > def.hi || pt.val < def.lo ? "bad" : "";
    return `<circle class="graph-dot ${cls}" cx="${x}" cy="${y}" r="4" fill="${cls?"var(--danger)":esc(def.color)}">
      <title>${esc(fmtFR(pt.date))} ${esc(pt.at)} : ${pt.val} ${esc(def.unit)}</title></circle>`;
  });

  // Labels X : premier, dernier, et ceux qui tombent sur un multiple
  const xLabels = pts.map((pt, i) => {
    if (i !== 0 && i !== pts.length - 1 && pts.length > 5 && i % Math.ceil(pts.length / 4) !== 0) return "";
    const x = xScale(i);
    const d = pt.date.slice(5);  // MM-DD
    return `<text x="${x.toFixed(1)}" y="${H - 4}" class="graph-axis" text-anchor="middle">${esc(d)}</text>`;
  });

  // Unité Y
  const yLabel = `<text x="6" y="${(PT + H/2).toFixed(0)}" class="graph-axis" text-anchor="middle" transform="rotate(-90,6,${(PT+H/2).toFixed(0)})">${esc(def.unit)}</text>`;

  return `<div class="graph-wrap">
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${zones.join("")}
    ${refLines.join("")}
    ${polyline}
    ${dots.join("")}
    ${xLabels.join("")}
    ${yLabel}
    <text x="${PL}" y="${PT - 4}" class="graph-axis" font-size="11" font-weight="600" fill="${esc(def.color)}">${esc(def.lbl)}</text>
  </svg></div>`;
}

function sheetGraphConstantes(pid){
  const p = getP(pid);
  const visits = (p.visits||[]).slice().sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
  // Filtrer les 90 derniers jours
  const cut = new Date(); cut.setDate(cut.getDate()-90);
  const cutISO = cut.toISOString().slice(0,10);
  const recent = visits.filter(v=>v.date>=cutISO);

  // Trouver les constantes qui ont au moins 1 valeur
  const available = CONST_DEFS.filter(d => extractConstValues(recent, d.key).length > 0);
  if (!available.length){
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune constante enregistrée sur les 90 derniers jours.</p>`);
    { const _e = $("#gcl"); if (_e) _e.onclick = closeSheet; } return;
  }

  let selKey = available[0].key;
  const render = () => {
    const def = CONST_DEFS.find(d=>d.key===selKey);
    const pts = extractConstValues(recent, selKey);
    const stat = pts.length ? `Dernière : ${pts[pts.length-1].val} ${def.unit} (${fmtFR(pts[pts.length-1].date)}) · ${pts.length} mesure(s)` : "";
    const chips = available.map(d=>`<button class="chip ${d.key===selKey?"on":""}" data-gk="${esc(d.key)}">${esc(d.lbl)}</button>`).join("");
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <div class="chips" style="margin-bottom:10px">${chips}</div>
      ${buildConstSvg(pts, def)}
      ${stat?`<p class="small muted" style="text-align:center;margin-top:4px">${esc(stat)}</p>`:""}
      <button class="btn btn-ghost" id="gc-exp" style="margin-top:12px;width:100%">📄 Exporter l'historique</button>`);
    $$("#sheet [data-gk]").forEach(b=>b.onclick=()=>{ selKey=b.dataset.gk; render(); });
    const _ex = $("#gc-exp"); if (_ex) _ex.onclick = () => sheetExportConst(p.id);
    { const _e = $("#gcl"); if (_e) _e.onclick = closeSheet; }
  };
  render();
}

/* ============ GALERIE CHRONOLOGIQUE ============ */
function sheetGalerie(pid){
  const p = getP(pid);
  const photos = (p.docs||[]).filter(d=>d.mime&&d.mime.startsWith("image/"))
    .slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if (!photos.length){
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune photo dans ce dossier.</p>`);
    { const _e = $("#gal-back"); if (_e) _e.onclick = ()=>sheetDocs(pid); } return;
  }
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    <p class="small muted" style="margin-bottom:10px">${photos.length} photo(s) — ordre chronologique</p>
    <div class="chrono-grid">
      ${photos.map(d=>`
      <div class="chrono-item" data-gopen="${esc(d.id)}">
        <img src="${d.data}" alt="${esc(d.name)}" loading="lazy">
        <span class="chrono-date">${esc(fmtFR(d.date))}</span>
      </div>`).join("")}
    </div>`);
  $$("#sheet [data-gopen]").forEach(el=>el.onclick=()=>viewDoc(p.docs.find(d=>d.id===el.dataset.gopen)));
  { const _e = $("#gal-back"); if (_e) _e.onclick = ()=>sheetDocs(pid); }
}

/* ============ RECHERCHE GLOBALE ============ */
async function sheetSearch(){
  openSheet(`
    ${navHeader("Moniteur", false)}
    <h3>🔍 Recherche</h3>
    <input id="srch-in" placeholder="Patient, soin, note, bilan, rappel…" autofocus style="margin-bottom:12px">
    <div id="srch-res" style="max-height:60vh;overflow-y:auto"></div>`);
  bindNav(closeSheet);

  const highlight = (text, q) => {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0,i))+'<mark class="search-hit-hl">'+esc(text.slice(i,i+q.length))+'</mark>'+esc(text.slice(i+q.length));
  };

  const doSearch = q => {
    const box = $("#srch-res");
    if (!q || q.length < 2){ box.innerHTML = `<p class="muted small" style="padding:8px 0">Tape au moins 2 caractères…</p>`; return; }
    const ql = q.toLowerCase();
    const hits = [];
    // Actifs + clôturés (fin de PEC) + archivés : tout reste trouvable
    const all = [...activeP(), ...(S.patients||[]).filter(p=>p.pec && !p.archived),
                 ...(S.patients||[]).filter(p=>p.archived)];
    all.forEach(p => {
      const nomFull = p.nom.replace("Demo-","")+" "+p.prenom;
      // Patient lui-même
      if (nomFull.toLowerCase().includes(ql) || (p.ctx||"").toLowerCase().includes(ql)){
        const statut = p.pec ? "🎗️ Prise en charge terminée le "+fmtFR(p.pec.end)
                     : p.archived ? "📦 Dossier mis de côté" : (p.ctx||"Fiche patient");
        hits.push({ ico: p.pec?"🎗️":"🧑", title:nomFull.toUpperCase(), sub:statut,
          action:()=>{ closeSheet(); if (p.pec || p.archived) sheetPatient(p.id);
                       else { const live=getP(p.id); if(live){ openId=p.id; render(); } } } });
      }
      // Passages (notes)
      (p.visits||[]).forEach(v => {
        if ((v.note||"").toLowerCase().includes(ql) || (v.soins||[]).join(" ").toLowerCase().includes(ql)){
          const snippet = v.note||v.soins.join(", ");
          hits.push({ ico:"📋", title:nomFull.toUpperCase()+" — "+fmtFR(v.date), sub:snippet.slice(0,80), action:()=>{ openId=p.id; render(); closeSheet(); } });
        }
      });
      // Bilans
      (p.bilans||[]).forEach(b => {
        if ((b.type||"").toLowerCase().includes(ql)||(b.res||"").toLowerCase().includes(ql)){
          hits.push({ ico:"🧪", title:nomFull.toUpperCase()+" — "+b.type, sub:(b.res||"").slice(0,60), action:()=>{ openId=p.id; render(); closeSheet(); } });
        }
      });
      // Documents
      (p.docs||[]).forEach(d => {
        if ((d.name||"").toLowerCase().includes(ql)){
          hits.push({ ico:"📎", title:nomFull.toUpperCase()+" — "+d.name, sub:fmtFR(d.date||""), action:()=>{ openId=p.id; render(); closeSheet(); } });
        }
      });
    });
    // Rappels
    (S.rappels||[]).forEach(r => {
      if ((r.text||"").toLowerCase().includes(ql)){
        const rp = r.pid ? getP(r.pid) : null;
        hits.push({ ico:"📌", title:"Rappel"+(rp?" — "+rp.nom.replace("Demo-","").toUpperCase():""), sub:r.text.slice(0,80), action:()=>closeSheet() });
      }
    });

    if (!hits.length){ box.innerHTML = `<p class="muted small" style="padding:8px 0">Aucun résultat pour "<strong>${esc(q)}</strong>".</p>`; return; }
    box.innerHTML = hits.slice(0,40).map((h,i)=>`
      <div class="search-hit" data-hit="${i}">
        <span class="search-hit-ico">${h.ico}</span>
        <div class="search-hit-body">
          <div class="search-hit-title">${highlight(h.title,q)}</div>
          ${h.sub?`<div class="search-hit-sub">${highlight(h.sub,q)}</div>`:""}
        </div>
      </div>`).join("");
    $$("#srch-res [data-hit]").forEach((el,i)=>el.onclick=()=>hits[i].action());
  };

  let debT;
  $("#srch-in").oninput = e => { clearTimeout(debT); debT = setTimeout(()=>doSearch(e.target.value.trim()),180); };
  { const _e = $("#srch-close"); if (_e) _e.onclick = closeSheet; }
  doSearch("");
}

/* ============ LOG D'ERREURS ============ */
(async function setupErrorLog(){
  const MAX_LOGS = 50;
  async function logError(type, msg, stack){
    try {
      const existing = (await idbGet("errorlog")) || [];
      existing.push({ t:new Date().toISOString(), type, msg:String(msg).slice(0,200), stack:String(stack||"").slice(0,400) });
      await idbSet("errorlog", existing.slice(-MAX_LOGS));
    } catch {}
  }
  window.onerror = (msg, src, line, col, err) => { logError("error", msg, err&&err.stack||src+":"+line); return false; };
  window.onunhandledrejection = e => logError("promise", e.reason, e.reason&&e.reason.stack);
})();


/* ============ RÉCAPITULATIF DE FIN DE TOURNÉE ============ */
function sheetBilanTournee(pool, tourName){
  const today = todayISO();
  const vus = pool.filter(p=>p.visits.some(v=>v.date===today));
  const nonVus = pool.filter(p=>!p.visits.some(v=>v.date===today));
  const alertPatients = pool.filter(p=>{
    const lv=p.visits.filter(v=>v.date===today).pop();
    return lv && alertes(lv.consts, p.thresholds).length;
  });
  const rappelsDus = (S.rappels||[]).filter(r=>!r.done&&r.due&&daysUntil(r.due)<=1);
  const bilansAF = pool.flatMap(p=>(p.bilans||[]).filter(b=>b.statut==="À faire"));
  const evtTags = pool.flatMap(p=>p.visits.filter(v=>v.date===today).map(v=>{
    const tags = (v.note||"").match(/\[[^\]]+\]/g)||[];
    return tags.map(t=>({who:p.nom.replace("Demo-","").toUpperCase(), tag:t}));
  })).flat();

  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📋 Bilan de tournée — ${esc(tourName==="all"?"Toutes tournées":tourName)}</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(fmtFR(today))}</p>

    <div class="spill ok" style="margin-bottom:10px">
      <div class="l">✅ Patients vus</div>
      <div class="n">${vus.length}/${pool.length}</div>
    </div>
    ${nonVus.length?`<div class="spill warn" style="margin-bottom:10px">
      <div class="l">⏳ Non vus</div>
      <div class="n">${nonVus.length}</div>
    </div>`:""}
    ${alertPatients.length?`<div class="spill warn" style="margin-bottom:10px">
      <div class="l">🚨 Alertes constantes</div>
      <div class="n">${alertPatients.length}</div>
    </div>
    <div style="padding:0 8px 10px">${alertPatients.map(p=>{
      const lv=p.visits.filter(v=>v.date===today).pop();
      return `<div class="small" style="color:var(--danger)">⚠ ${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)} : ${alertes(lv.consts,p.thresholds).join(", ")}</div>`;
    }).join("")}</div>`:""}
    ${rappelsDus.length?`<div class="spill warn" style="margin-bottom:10px">
      <div class="l">📌 Rappels urgents (J0/J-1)</div>
      <div class="n">${rappelsDus.length}</div>
    </div>
    <div style="padding:0 8px 10px">${rappelsDus.map(r=>{
      const rp=r.pid?getP(r.pid):null;
      const cd=rapCountdown(r);
      return `<div class="small">${rapType(r.type).ic} ${esc(r.text.slice(0,60))}${rp?" — "+esc(rp.nom.replace("Demo-","").toUpperCase()):""}  <b style="color:var(--danger)">[${cd.txt}]</b></div>`;
    }).join("")}</div>`:""}
    ${bilansAF.length?`<div class="spill" style="margin-bottom:10px">
      <div class="l">🧪 Bilans en attente</div>
      <div class="n">${bilansAF.length}</div>
    </div>`:""}
    ${evtTags.length?`<div style="padding:0 8px 10px;border-left:3px solid var(--amber);margin-bottom:10px">
      <div class="lab" style="margin-bottom:4px">Événements notés</div>
      ${evtTags.map(e=>`<div class="small">${esc(e.who)} — ${esc(e.tag)}</div>`).join("")}
    </div>`:""}

    <div class="rowb" style="margin-top:14px">
      <button class="btn btn-primary" id="bt-releve">📝 Générer la relève</button>
    </div>`);
  { const _e = $("#bt-close"); if (_e) _e.onclick = closeSheet; }
  $("#bt-releve").onclick = () => { closeSheet(); sheetReleve(); };
}

/* ---------- Dictée rapide (FAB) ---------- */
function sheetQuickDictate(){
  const pool = activeP().filter(inTour);
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🎤 Dictée rapide</h3>
    <p class="small muted" style="margin-bottom:8px">Dicte ta note puis tape le patient concerné — elle atterrit dans son dossier.</p>
    <div class="micwrap">
      <textarea id="qd-note" placeholder="Dicte ou tape ta note…" style="min-height:90px"></textarea>
      <button class="mic" id="qd-mic">🎤</button>
    </div>
    <div class="lab" style="margin:14px 0 8px">Affecter à :</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${pool.map(p=>`<button class="btn btn-ghost" data-qd="${p.id}" style="padding:14px 10px;font-size:14px">👤 ${esc(p.prenom)}<br><b>${esc(p.nom.replace("Demo-","").toUpperCase())}</b></button>`).join("") || '<p class="muted small" style="grid-column:1/-1">Aucun patient dans la tournée courante.</p>'}
    </div>
    <button class="btn btn-ghost" id="qd-close" style="margin-top:12px;width:100%">Annuler</button>`);
  $("#qd-mic").onclick = e => { e.preventDefault(); dictate($("#qd-note"), $("#qd-mic")); };
  $$("#sheet [data-qd]").forEach(b => b.onclick = () => {
    const note = $("#qd-note").value.trim();
    if (!note){ toast("Note vide — dicte ou écris d'abord."); return; }
    const p = getP(b.dataset.qd);
    p.visits.push({ uid:uid(), date:todayISO(), at:nowHM(), soins:[], consts:{}, note });
    save(true); closeSheet(); render();
    toast("Note ajoutée à " + p.prenom + " ✓");
  });
  $("#qd-close").onclick = closeSheet;
}


/* ---------- Écran de bienvenue (premier lancement) ---------- */
function sheetWelcome(){
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>👋 Bienvenue dans JM@Santé</h3>
    <p class="small" style="margin-bottom:12px;line-height:1.55">
      Ton carnet de <b>relève infirmière</b> : tu saisis tes passages au fil de la tournée
      (soins, constantes, transmissions, photos), et l'app génère la relève complète
      à envoyer au collègue ou au médecin — en un tap.
    </p>
    <div class="small" style="line-height:1.7;margin-bottom:14px">
      🗺️ <b>Tournées</b> — un cabinet = une tournée, avec son ordre de passage<br>
      👤 <b>Patients</b> — tape une carte pour saisir le passage du jour<br>
      🎤 <b>Dictée</b> — le micro flottant pour noter vite entre deux visites<br>
      📋 <b>Relève</b> — génère, relis, envoie (texte, PDF, HTML, Word)<br>
      🔒 <b>Sécurité</b> — code PIN + empreinte, données chiffrées, tout reste sur le téléphone
    </div>
    <p class="small muted" style="margin-bottom:12px">Des dossiers de démonstration sont chargés pour découvrir l'app.</p>
    <button class="btn btn-primary" id="wl-demo" style="width:100%">Découvrir avec la démo</button>
    <button class="btn btn-ghost" id="wl-empty" style="width:100%;margin-top:8px">Commencer avec mes propres patients</button>`);
  const finish = () => { try { delete S.firstRun; save(); } catch(e){} closeSheet(); try { render(); } catch(e){} };
  const demo = document.getElementById("wl-demo");
  const empty = document.getElementById("wl-empty");
  if (demo) demo.onclick = finish;
  if (empty) empty.onclick = () => {
    S.patients = []; S.rappels = []; S.tours = ["Ma tournée"]; S.curTour = "Ma tournée"; S.patientOrder = {};
    finish(); toast("C'est parti — crée ton premier patient avec ＋");
  };
  // Sécurité anti-figeage : tap hors de la feuille ferme et garde la démo
  const veil = document.getElementById("veil");
  if (veil) veil.onclick = (e) => { if (e.target.id === "veil") finish(); };
}

/* ---------- Salutation quotidienne ---------- */
const DAILY_GREETINGS = [
  "Bonne et belle journée, IDEL ! 🌿",
  "Belle tournée à toi aujourd'hui ! ☀️",
  "Prends soin de toi autant que de tes patients 💚",
  "Une nouvelle journée, de belles rencontres en perspective 🩺",
  "Courage pour la tournée, tu fais un métier essentiel 🌟",
  "Bon pied, bon œil — belle journée de soins ! 👟",
  "Bonjour ! Café injecté en intraveineuse, tournée chargée, c'est parti. ☕",
  "Debout avant le soleil : le monde appartient à ceux qui ont des pansements à faire.",
  "Le réveil a piqué, mais le premier café est prêt. Belle tournée !",
  "Clés de contact, stéthoscope, transmission propre. On démarre !",
  "Garde le sourire, la première prise de sang à jeun t'attend.",
  "Un grand café, zéro bouchon (on y croit) et une belle journée en vue.",
  "Les yeux piquent un peu, mais le cardio est là. En route !",
  "Mode guerrier activé : 35 passages, même pas peur. 💪",
  "Le soleil se lève à peine, mais l'IDEL est déjà sur le bitume. Bon courage !",
  "Objectif du matin : trouver une place où se garer sans prendre de PV. 🅿️",
  "Courage ! N'oublie pas que chaque passage finance un quart de seconde de retraite CARPIMKO.",
  "L'URSSAF et la CARPIMKO te souhaitent une excellente journée très rentable.",
  "Travaille dur ce matin : les caisses de cotisations comptent sur toi !",
  "Pense positif : après la CARPIMKO, il te reste pile de quoi t'acheter un café.",
  "Une pensée émue pour l'URSSAF qui te regarde travailler avec admiration.",
  "Bonjour ! Aujourd'hui, on cotise pour trois et on soigne pour dix.",
  "La CARPIMKO te remercie par avance pour ta contribution au patrimoine national.",
  "Chaque injection de ce matin rapproche l'URSSAF de son bonheur. Belle tournée !",
  "Règle d'or du jour : cotiser d'abord, soigner toujours, râler un peu.",
  "Travaille bien, l'échéancier trimestriel arrive plus vite que ton jour de repos !",
  "Parce qu'on a déjà assez à faire avec l'URSSAF et les escaliers.",
  "Même la CARPIMKO valide une relève aussi rapide.",
  "Bonjour ! Que la force de la NGAP soit avec toi pour cumuler les AMI sans te faire retoquer.",
  "La Sécurité Sociale t'aime (surtout quand les ordonnances sont parfaitement conformes).",
  "Objectif du jour : zéro rejet de télétransmission, zéro prise de tête.",
  "Que le grand esprit de la nomenclature veille sur tes cotations du jour !",
  "Un AIS par-ci, un AMI par-là : bonne tournée millimétrée !",
  "Si la CPAM avait ton rythme de travail, les dossiers seraient traités en 2 minutes.",
  "N'oublie pas le tampon, la signature et l'alignement des planètes pour la Sécu.",
  "La bienveillance au cœur, la cotation en tête. Bonne tournée !",
  "Aujourd'hui, on ne laisse passer aucun soin hors nomenclature. Force à toi !",
  "Les ordonnances d'un an renouvelées trois fois n'auront pas ta peau aujourd'hui.",
  "Prêt pour l'épreuve olympique : monter quatre étages sans ascenseur avec la mallette. 🏅",
  "Courage pour les escaliers étroits et les portes cochères récalcitrantes !",
  "Puissent les feux être verts et les patients prêts à ton arrivée. 🚦",
  "La mallette est bouclée, le coffre est plein : c'est parti pour le gymkhana urbain !",
  "Bonjour ! Que le capital veineux de tes patients soit franc et sans surprise ce matin.",
  "Attention aux chiens de garde trop affectueux et aux chats qui squattent les lits médicalisés. 🐕",
  "Un pansement complexe réussi du premier coup, c'est la promesse d'une bonne journée.",
  "Garde ton calme si la boîte de bandelettes est vide : tu en as dans le coffre (normalement).",
  "Belle journée ! Que personne ne te raconte toute sa vie avant le soin de 7h15.",
  "L'art d'enfiler des gants avec les mains encore humides : défi du jour accepté. 🧤",
  "Tout est dans la mallette. Même la relève.",
  "Tu ne portes pas de cape, mais tu sauves des tournées tous les jours. Bon courage !",
  "Le sourire que tu apportes au domicile n'a pas de prix (et n'est pas soumis à l'URSSAF).",
  "Tu es le maillon fort du maintien à domicile. Fière allure et bon pas !",
  "Toujours prêt, toujours efficace : excellente journée à toi !",
  "Le café est chaud, les compétences sont là : rien ne peut t'arrêter.",
  "Un métier indispensable fait par quelqu'un de formidable. Bonne tournée !",
  "Soigner, écouter, transmettre : une routine extraordinaire au quotidien.",
  "Prends soin d'eux, mais n'oublie pas de boire de l'eau entre deux visites ! 💧",
  "Même sous la pluie ou dans les bouchons, ton travail a du sens. Belle journée !",
  "Aujourd'hui est une bonne journée pour faire du super boulot. C'est parti !",
  "Moins de temps sur les notes, plus de temps pour le café. ☕",
  "Chantez, tournez, transmettez ! 🦗"
];
const END_GREETINGS = [
  "Tournée terminée, beau travail ! 👏",
  "C'est bouclé — repose-toi bien 🌙",
  "Mission accomplie, à demain ! ✨",
  "Belle tournée menée à bien, bravo 💚",
  "Fin de tournée — prends un moment pour toi ☕",
  "Bientôt le dernier arrêt, la relève propre sur l'appli et la liberté !",
  "Plus que quelques kilomètres avant d'éteindre le contact et de souffler.",
  "Une transmission claire, un collègue heureux, une journée validée.",
  "La relève est dans la boîte, tu as assuré. Rentre te poser !",
  "Fin de mission : les patients sont soignés, l'esprit est tranquille.",
  "Dépose la mallette, respire : ta tournée est bouclée avec brio.",
  "Plus qu'à envoyer la transmission en un tap et la journée est officiellement pliée.",
  "Bravo pour le marathon du jour. Repos bien mérité ! 🏃",
  "Clap de fin pour aujourd'hui : mission accomplie sur toute la ligne. 🎬",
  "La tournée est finie, la CARPIMKO est rassurée, tu peux enfin décompresser."
];
function dailyGreeting(){
  const today = todayISO();
  if (S.lastGreeting === today) return;   // déjà salué aujourd'hui
  S.lastGreeting = today; try { save(); } catch(e){}
  const msg = DAILY_GREETINGS[Math.floor(Math.random()*DAILY_GREETINGS.length)];
  const now = new Date();
  const jour = now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const el = document.createElement("div");
  el.className = "end-tour-modal";   // même habillage que la clôture
  el.innerHTML = `
    <div class="etm-card">
      <div class="etm-flag">👋</div>
      <div class="etm-title">Bonjour${S.identity&&S.identity.prenom?" "+esc(S.identity.prenom):""} !</div>
      <div class="etm-msg">${esc(msg)}</div>
      <div class="etm-time">${esc(jour.charAt(0).toUpperCase()+jour.slice(1))}</div>
      <button class="btn btn-primary etm-close">C'est parti</button>
    </div>`;
  const close = () => { el.classList.remove("show"); setTimeout(()=>el.remove(), 350); };
  el.querySelector(".etm-close").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 30);
  setTimeout(close, 8000);
}


/* ---------- Déblocage d'urgence (triple tap sur la date/titre) ---------- */
(function(){
  let taps=0, timer=null;
  document.addEventListener("DOMContentLoaded", ()=>{}, {once:true});
  document.addEventListener("click", (e)=>{
    const h = e.target.closest("#h-date, .header h1, #title");
    if (!h) return;
    taps++;
    clearTimeout(timer);
    timer = setTimeout(()=>{ taps=0; }, 600);
    if (taps>=3){
      taps=0;
      ["veil","lock"].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove("on"); });
      document.querySelectorAll(".daily-greet").forEach(el=>el.remove());
      if (typeof toast==="function") toast("Écran débloqué ✓");
    }
  });
})();


/* ---------- Fin de tournée ---------- */
function endTourneeGreeting(){
  const msg = END_GREETINGS[Math.floor(Math.random()*END_GREETINGS.length)];
  const now = new Date();
  const heure = String(now.getHours()).padStart(2,"0")+"h"+String(now.getMinutes()).padStart(2,"0");
  const el = document.createElement("div");
  el.className = "end-tour-modal";
  el.innerHTML = `
    <div class="etm-card">
      <div class="etm-flag">🏁</div>
      <div class="etm-title">Tournée terminée</div>
      <div class="etm-msg">${esc(msg)}</div>
      <div class="etm-time">Clôturée à ${heure}</div>
      <button class="btn btn-primary etm-close">Fermer</button>
    </div>`;
  const close = () => { el.classList.remove("show"); setTimeout(()=>el.remove(), 350); };
  el.querySelector(".etm-close").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 30);
  setTimeout(close, 13500); // 13,5 s (10 de plus qu'avant)
}
/* Silhouette de cigale en filigrane — sans yeux ni croix, purement décorative */
const CIG_FILI_SVG = `<svg viewBox="0 0 100 100" class="dlg-fili" aria-hidden="true">
  <g stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/>
    <ellipse cx="50" cy="30" rx="15" ry="12"/>
    <path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/>
    <path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/>
    <path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g></svg>`;

/* Dialogue aux couleurs de l'application — remplace confirm(), qui affiche
   la boîte native d'Android : carrée, grise, étrangère au reste. */
function askDialog(o){
  return new Promise(res => {
    const rouge = o.ton === "danger";
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card ${rouge?"danger":""}">
      ${CIG_FILI_SVG}
      <div class="dlg-in">
        ${o.ic ? `<div class="dlg-ic">${o.ic}</div>` : ""}
        <div class="dlg-t">${esc(o.titre)}</div>
        ${o.sub ? `<div class="dlg-s">${o.sub}</div>` : ""}
        ${o.warn ? `<div class="dlg-w">${o.warn}</div>` : ""}
        ${o.saisie ? `<div class="dlg-f">
          ${o.saisieLbl ? `<div class="dlg-fl">${o.saisieLbl}</div>` : ""}
          <input id="dlg-in" ${o.saisie.type==="num"?'inputmode="decimal"':""}
                 placeholder="${esc(o.saisie.ph||"")}" value="${esc(o.saisie.val||"")}">
          ${o.saisie.aide ? `<div class="dlg-fa">${esc(o.saisie.aide)}</div>` : ""}
        </div>` : ""}
        <div class="dlg-act">
          <button class="btn btn-ghost" data-no>${esc(o.non || "Annuler")}</button>
          <button class="btn ${rouge?"dlg-dg":"btn-primary"}" data-yes ${o.verrou?"disabled":""}>${esc(o.oui || "Confirmer")}</button>
        </div>
      </div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    const inp = el.querySelector("#dlg-in");
    const btn = el.querySelector("[data-yes]");
    const fin = v => { el.classList.remove("show");
      setTimeout(() => el.remove(), 200); res(v); };
    /* Verrou : le bouton reste éteint tant que la saisie ne correspond pas.
       Sert à la suppression d'un dossier — on retape le nom du patient. */
    if (o.verrou && inp){
      const test = () => btn.disabled =
        inp.value.trim().toUpperCase() !== String(o.verrou).trim().toUpperCase();
      inp.oninput = test; test();
    }
    if (inp) setTimeout(() => inp.focus(), 120);
    el.querySelector("[data-no]").onclick = () => fin(false);
    btn.onclick = () => { if (btn.disabled) return;
      fin(o.saisie && !o.verrou ? (inp ? inp.value : "") : true); };
    if (inp) inp.onkeydown = e => { if (e.key === "Enter" && !btn.disabled) btn.click(); };
    el.onclick = e => { if (e.target === el) fin(false); };
  });
}

/* Choix entre plusieurs actions nommées.
   Remplace les confirm() du type « Oui ? (Annuler = autre chose) », où
   « Annuler » ne voulait pas dire annuler — piège classique. */
function askChoice(o){
  return new Promise(res => {
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card">
      ${CIG_FILI_SVG}
      <div class="dlg-in">
        ${o.ic ? `<div class="dlg-ic">${o.ic}</div>` : ""}
        <div class="dlg-t">${esc(o.titre)}</div>
        ${o.sub ? `<div class="dlg-s">${o.sub}</div>` : ""}
        <div class="dlg-opts">
          ${o.options.map((x,i)=>`<button class="dlg-opt" data-i="${i}">${x.ic?x.ic+" ":""}${esc(x.lbl)}</button>`).join("")}
        </div>
        <button class="dlg-cancel" data-no>${esc(o.non || "Annuler")}</button>
      </div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    const fin = v => { el.classList.remove("show");
      setTimeout(() => el.remove(), 200); res(v); };
    el.querySelectorAll("[data-i]").forEach(b =>
      b.onclick = () => fin(o.options[+b.dataset.i].val));
    el.querySelector("[data-no]").onclick = () => fin(null);
    el.onclick = e => { if (e.target === el) fin(null); };
  });
}

/* Saisie de texte — remplace prompt() */
function askText(titre, o){
  o = o || {};
  return askDialog({
    ic: o.ic, titre, sub: o.sub,
    saisie: { ph:o.ph||"", val:o.val||"", aide:o.aide, type:o.type },
    oui: o.oui || "✓ Enregistrer", non: "Annuler"
  });
}

async function terminerTournee(){
  const slot = (typeof activeSlot==="function") ? activeSlot() : null;
  const L = slot && SLOT_LBL[slot] ? SLOT_LBL[slot] : null;
  const wd = (typeof workDate==="function") ? workDate() : todayISO();
  /* Le pool AFFICHÉ, pas relevePool() : ce dernier filtre sur la sélection
     de relève et renvoie 0 quand rien n'a été coché. */
  const tour = S.curTour;
  const pool = (tour === "all" ? S.patients.filter(p => !p.archived)
                               : S.patients.filter(p => !p.archived && (p.tours||[]).includes(tour)));
  const estDuJour = v => v.date === wd &&
        (!S.slotsEnabled || !slot || slot === "jour" || (v.slot||defaultSlot()) === slot);
  const n = pool.reduce((a,p) => a + (p.visits||[]).filter(estDuJour).length, 0);

  const ok = await askDialog({
    ic: "🏁", titre: "Terminer la tournée ?",
    sub: `${S.curTour==="all"?"Toutes les tournées":esc(S.curTour)}${L?` · ${L.ic} ${esc(L.lbl.toLowerCase())}`:""}<br>
          <b style="color:var(--accent)">${n} passage${n>1?"s":""}</b> enregistré${n>1?"s":""}`,
    non: "Annuler", oui: "🏁 Clôturer"
  });
  if (!ok) return;
  // Un seul écran de fin : le récapitulatif du déroulé, message en tête
  if (typeof seqEndScreen === "function") seqEndScreen(pool, slot, true);
  else endTourneeGreeting();
}


/* ---------- Masquer les boutons flottants pendant la saisie ---------- */
(function(){
  const isField = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  document.addEventListener("focusin", e => {
    if (isField(e.target)) document.body.classList.add("typing");
  });
  document.addEventListener("focusout", e => {
    // Laisser un court délai : si le focus passe à un autre champ, on reste en mode saisie
    setTimeout(() => {
      if (!isField(document.activeElement)) document.body.classList.remove("typing");
    }, 120);
  });
  // Textareas auto-extensibles (la zone grandit avec le texte)
  document.addEventListener("input", e => {
    const t = e.target;
    if (t && t.tagName === "TEXTAREA" && t.dataset.note !== undefined){
      t.style.height = "auto";
      t.style.height = Math.min(t.scrollHeight + 2, 260) + "px";
    }
  });
})();


/* ---------- Téléchargement du mode d'emploi ----------
   Le manuel illustré est embarqué dans l'app (www/manuel.html).
   "html" → enregistre/partage le fichier ; "pdf" → l'ouvre pour
   l'imprimer en PDF (aucune app ne sait générer un PDF depuis
   un HTML complexe sans passer par le moteur d'impression). */
async function downloadManuel(mode){
  try {
    const res = await fetch("manuel.html");
    if (!res.ok) throw new Error("introuvable");
    const html = await res.text();

    if (mode === "pdf"){
      // Aperçu DANS l'app : un onglet séparé piège l'utilisateur
      // dans le WebView Android (pas de barre d'adresse, pas de retour).
      if (typeof showFichePreview === "function"){
        showFichePreview(html, "JMSante_Mode_emploi");
        toast("Utilise « Imprimer / PDF » en bas de l'écran 📑");
      } else {
        await shareText(html, "JMSante_Mode_emploi.html", "text/html");
      }
      return;
    }

    // Enregistrement / partage du fichier HTML
    const name = "JMSante_Mode_emploi.html";
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()){
      try {
        const { Filesystem, Share } = cap.Plugins;
        const b64 = btoa(unescape(encodeURIComponent(html)));
        const r = await Filesystem.writeFile({ path:name, data:b64, directory:"CACHE" });
        await Share.share({ title:"Mode d'emploi JM@Santé", url:r.uri });
        return;
      } catch(e){ if((e.message||"").match(/cancel/i)) return; console.warn(e); }
    }
    const blob = new Blob([html], { type:"text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast("Mode d'emploi téléchargé 📘");
  } catch(e){
    console.error("manuel:", e);
    toast("Manuel indisponible dans cette version", "danger");
  }
}

/* ============================================================
   FRISE DE L'EN-TÊTE — un motif animé par thème
   ─────────────────────────────────────────────────────────
   hopital → tracé ECG d'origine qui défile
   reunion → déferlantes, une baleine et un aileron qui passent
   tubes   → un tube de néon dégradé qui glisse de teinte
   autres  → un tracé cardiaque fixe et discret

   ⚠️ Animations en CSS, pas en SMIL : un <animateTransform>
   dans un SVG injecté par innerHTML ne démarre pas de façon
   fiable (silhouettes figées à leur position de départ).
============================================================ */
function friseSvg(theme){
  if (theme === "reunion"){
    return `<svg viewBox="0 0 340 26" preserveAspectRatio="xMidYMid slice" class="fr-svg">
      <g fill="none" stroke="var(--accent)" stroke-linecap="round">
        <path d="M0 15 Q17 9 34 15 T68 15 T102 15 T136 15 T170 15 T204 15 T238 15 T272 15 T306 15 T340 15"
          stroke-width="1.6" opacity=".62"/>
        <path d="M0 19 Q21 14 42 19 T84 19 T126 19 T168 19 T210 19 T252 19 T294 19 T336 19"
          stroke-width="1.2" opacity=".3"/>
      </g>
      <path class="fr-whale" fill="var(--accent)" opacity=".85"
        d="M0 1 Q-1.5 -5 -11 -12 Q-5.5 -13.5 0 -8 Q5.5 -13.5 11 -12 Q1.5 -5 0 1 Z"/>
      <path class="fr-fin" fill="var(--accent)" opacity=".78"
        d="M0 1 Q1.5 -10 10 -14 Q5.5 -7 7 1 Z"/>
    </svg>`;
  }
  if (theme === "tubes"){
    return `<svg viewBox="0 0 340 22" preserveAspectRatio="xMidYMid meet" class="fr-svg">
      <defs>
        <!-- userSpaceOnUse : sur une ligne horizontale la bbox est plate,
             un dégradé (ou un filtre) en unités relatives ne s'applique pas. -->
        <linearGradient id="frNeon" gradientUnits="userSpaceOnUse" x1="6" y1="11" x2="334" y2="11">
          <stop offset="0"   stop-color="#2BB3A3"/>
          <stop offset=".33" stop-color="#4A9FD8"/>
          <stop offset=".66" stop-color="#9B6BD8"/>
          <stop offset="1"   stop-color="#E0559A"/>
        </linearGradient>
        <filter id="frGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="340" height="22">
          <feGaussianBlur stdDeviation="2.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g class="fr-neon">
        <line x1="6" y1="11" x2="334" y2="11" stroke="url(#frNeon)" stroke-width="3"
          stroke-linecap="round" filter="url(#frGlow)" opacity=".9"/>
        <line x1="6" y1="11" x2="334" y2="11" stroke="#fff" stroke-width=".8"
          stroke-linecap="round" opacity=".3"/>
      </g>
    </svg>`;
  }
  if (theme === "hopital"){
    // Tracé d'origine (v49) : deux complexes QRS puis un cœur dans la ligne
    const P = "M0 20 H24 q5 -5 10 0 h5 l2 3 l3 -16 l3 17 l2 -4 h7 q6 -7 12 0 H96 q5 -5 10 0 h5 l2 3 l3 -16 l3 17 l2 -4 h7 q6 -7 12 0 H176 c0 0 -7 -6 -7 -10 c0 -3 2.5 -5 4.5 -5 c1.5 0 2.5 1.5 2.5 3.5 c0 -2 1 -3.5 2.5 -3.5 c2 0 4.5 2 4.5 5 c0 4 -7 10 -7 10 H300";
    return `<svg viewBox="0 0 300 30" preserveAspectRatio="xMidYMid slice" class="fr-svg">
      <g class="fr-ecg" fill="none" stroke="var(--accent)" stroke-width="1.8"
         stroke-linejoin="round" stroke-linecap="round" opacity=".9">
        <path d="${P}"/>
        <path d="${P}" transform="translate(300,0)"/>
      </g>
    </svg>`;
  }
  // bloc · verre — tracé cardiaque fixe et discret
  return `<svg viewBox="0 0 340 20" preserveAspectRatio="none" class="fr-svg">
    <defs><linearGradient id="frFade" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="340" y2="10">
      <stop offset="0" stop-color="var(--accent)" stop-opacity="0"/>
      <stop offset=".14" stop-color="var(--accent)" stop-opacity=".6"/>
      <stop offset=".86" stop-color="var(--accent)" stop-opacity=".6"/>
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="M0 11 H52 l3 -5 l4 10 l3 -5 H128 l3 -6 l4 12 l4 -6 H208 l3 -4 l4 8 l3 -4 H284 l3 -5 l4 10 l3 -5 H340"
      fill="none" stroke="url(#frFade)" stroke-width="1.5"
      stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* ============================================================
   SANTÉ DE L'APPLICATION
   ─────────────────────────────────────────────────────────
   Voir l'état sans deviner : place occupée, volume de données,
   dernière sauvegarde, incidents récents, et une vérification
   d'intégrité qui repère les incohérences.
============================================================ */
async function sheetSante(){
  const nP  = (S.patients||[]).filter(p=>!p.archived).length;
  const nA  = (S.patients||[]).filter(p=>p.archived).length;
  const nV  = (S.patients||[]).reduce((a,p)=>a+(p.visits||[]).length, 0);
  const nD  = (S.patients||[]).reduce((a,p)=>a+(p.docs||[]).length, 0);
  const nI  = (S.incidents||[]).length;
  const nT  = (S.trash||[]).length;

  // Place occupée — l'API n'est pas disponible partout
  let place = null;
  try {
    if (navigator.storage && navigator.storage.estimate){
      const e = await navigator.storage.estimate();
      if (e && e.usage != null) place = { u:e.usage, q:e.quota||0 };
    }
  } catch(err){ /* indisponible : on affiche simplement le nombre d'éléments */ }
  const mo = o => (o/1048576).toFixed(1).replace(".", ",") + " Mo";

  const pbs = verifierIntegrite();

  openSheet(`
    ${navHeader("Réglages", true)}
    <h3>🩺 Santé de l'application</h3>
    <p class="small muted" style="margin-bottom:14px">L'état réel de tes données sur cet appareil.</p>

    <div class="rowlab ac"><span>Contenu</span><i></i></div>
    <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="sante-g">
        <div class="sa-c"><b>${nP}</b><span>patients</span></div>
        <div class="sa-c"><b>${nV}</b><span>passages</span></div>
        <div class="sa-c"><b>${nD}</b><span>documents</span></div>
        <div class="sa-c"><b>${nA}</b><span>mis de côté</span></div>
      </div>
      ${nT ? `<p class="small muted" style="margin:7px 0 0">🗑 ${nT} dossier(s) en corbeille</p>` : ""}
    </div>

    <div class="rowlab bl"><span>Stockage</span><i></i></div>
    <div class="rowbox bl" style="display:block;margin-bottom:12px">
      ${place ? `<div class="small">Occupé : <b>${mo(place.u)}</b>${
          place.q ? ` sur ${mo(place.q)} disponibles` : ""}</div>
        ${place.q ? `<div class="sa-bar"><i style="width:${
          Math.max(1, Math.min(100, Math.round(place.u/place.q*100)))}%"></i></div>` : ""}`
        : `<div class="small muted">Mesure indisponible sur cet appareil.</div>`}
      <div class="small muted" style="margin-top:7px">Dernière sauvegarde : ${
        (typeof _saveLast !== "undefined" && _saveLast)
          ? new Date(_saveLast).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})
          : "aucune depuis l'ouverture"}</div>
    </div>

    <div class="rowlab ${pbs.length ? "am" : "ac"}"><span>Intégrité</span><i></i>
      <em>${pbs.length ? pbs.length + " à voir" : "rien à signaler"}</em></div>
    <div class="rowbox ${pbs.length ? "am" : "ac"}" style="display:block;margin-bottom:12px">
      ${pbs.length
        ? pbs.map(x=>`<div class="sa-pb"><span>⚠</span><span>${esc(x)}</span></div>`).join("")
        : `<div class="small muted">Aucune incohérence détectée dans les dossiers.</div>`}
    </div>

    <div class="rowlab ${nI ? "vi" : "nt"}"><span>Incidents</span><i></i>
      <em>${nI ? nI + " enregistré" + (nI>1?"s":"") : "aucun"}</em></div>
    <div class="rowbox ${nI ? "vi" : "nt"}" style="display:block;margin-bottom:12px">
      ${nI ? (S.incidents||[]).slice(0,8).map(x=>`<div class="sa-inc">
          <span class="si-d">${esc(new Date(x.at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}))}</span>
          <span class="si-m">${esc(x.msg)}${x.det?`<span class="si-x">${esc(x.det)}</span>`:""}</span>
        </div>`).join("")
        + (nI > 8 ? `<p class="small muted" style="margin:6px 0 0">… et ${nI-8} plus anciens</p>` : "")
        + `<button class="btn btn-ghost" id="sa-clr" style="width:100%;margin-top:9px">Vider le journal</button>`
        : `<div class="small muted">Rien à signaler — aucune erreur enregistrée.</div>`}
    </div>

    <p class="small muted">Ce journal ne contient aucune donnée patient : seulement la date, l'origine et le message technique.</p>`);

  { const b = $("#sa-clr"); if (b) b.onclick = async () => {
      if (!await askDialog({ ic:"🧹", titre:"Vider le journal des incidents ?",
        sub:"Tes données ne changent pas.", oui:"✓ Vider" })) return;
      S.incidents = []; save(true); sheetSante(); toast("Journal vidé");
    }; }
}

/* Repère les incohérences réparables — sans rien modifier */
function verifierIntegrite(){
  const out = [];
  (S.patients||[]).forEach(p => {
    const nom = (p.prenom||"") + " " + (p.nom||"").replace("Demo-","");
    if (!p.id)   out.push(`Dossier sans identifiant : ${nom}`);
    if (!p.nom)  out.push(`Dossier sans nom (${p.id||"?"})`);
    (p.visits||[]).forEach(v => {
      if (!v.date) out.push(`Passage sans date — ${nom}`);
    });
    // Une tournée référencée qui n'existe plus
    (p.tours||[]).forEach(t => {
      if (!(S.tours||[]).includes(t)) out.push(`${nom} : tournée « ${t} » introuvable`);
    });
  });
  // Un rappel qui pointe vers un dossier disparu
  (S.rappels||[]).forEach(r => {
    if (r.pid && !(S.patients||[]).some(p => p.id === r.pid))
      out.push(`Rappel « ${(r.text||"").slice(0,28)} » sans dossier`);
  });
  return [...new Set(out)].slice(0, 12);
}


/* ===== seq.js ===== */
/* ============================================================
   SEQ.JS — Mode tournée séquentielle + Signature + Notifications
============================================================ */

/* ============ MODE TOURNÉE SÉQUENTIELLE ============ */
let seqActive = false, seqIdx = 0, seqPool = [], seqSlot = null;

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
  seqPool = pool;
  seqSlot = slot;
  /* Reprendre où l'on en est : premier patient non encore vu sur la date
     de travail. Calculé, pas mémorisé — un patient validé depuis sa carte
     ne doit pas être reproposé. */
  const wd = (typeof workDate === "function") ? workDate() : todayISO();
  const vu = p => (p.visits||[]).some(v => v.date === wd &&
                  (!S.slotsEnabled || slot === "jour" || (v.slot||defaultSlot()) === slot));
  const reste = pool.findIndex(p => !vu(p));
  if (reste === -1){ seqEndScreen(pool, slot); return; }   // tout est déjà vu
  seqIdx = reste;
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

function renderSeq(){
  const p    = seqPool[seqIdx];
  const sm   = document.getElementById("seq-mode");
  sm.className = "on";
  const total = seqPool.length;
  const raps  = (S.rappels||[]).filter(r=>!r.done&&r.pid===p.id).length;

  sm.innerHTML = `
    <div class="seq-nav">
      <button class="sq-btn" id="sq-prev">←</button>
      <div class="sq-ctr">${seqIdx+1} / ${total} — ${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}</div>
      <button class="sq-btn" id="sq-next">${seqIdx===total-1?"✓":"→"}</button>
      <button class="sq-quit" id="sq-quit">✕ Quitter</button>
    </div>
    ${(() => {
      const t = (typeof annivTexte === "function") ? annivTexte(p) : "";
      return t ? `<div class="sq-anniv">🎂 ${esc(t)}</div>` : "";
    })()}
    <button class="btn btn-ghost" id="sq-skip" style="width:100%;margin-bottom:10px;font-size:13.5px">
      🚫 Pas de passage prévu aujourd'hui — patient suivant
    </button>
    ${shownInfos(p).map(it => { const T=infoType(it.type);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:8px 12px;margin-bottom:8px">${T.ic} ${esc(it.txt)}</div>`;
    }).join("")}
    <div id="seq-form"></div>`;

  // Formulaire inline
  const fwrap = document.getElementById("seq-form");
  openId = p.id;
  _curSlot = null; // recalculé selon l'heure pour ce patient
  fwrap.innerHTML = inlineForm(p);
  bindInline(p, fwrap);   // le formulaire du déroulé, pas celui de la liste
  const seqForm = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;

  // Valide le passage courant (soins cochés, constantes, note, créneau) puis exécute cb
  const commitThen = cb => {
    const form = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;
    const saved = form && form._commitVisit ? form._commitVisit(true) : false;
    if (saved){ save(true); toast("Passage de " + p.prenom + " enregistré ✓"); }
    cb();
  };
  // « Pas de passage prévu » : on avance sans rien enregistrer → rien dans la relève
  const skipBtn = document.getElementById("sq-skip");
  if (skipBtn) skipBtn.onclick = () => {
    _formDraft = null; _soinNotes = {};   // on jette la saisie éventuelle
    // Trace du jour : le patient n'est ni « à voir » ni « vu ».
    // Aucun passage créé → rien dans la relève.
    S.noVisit = S.noVisit || {};
    S.noVisit[p.id] = workDate();
    save();
    toast("Pas de passage prévu pour " + p.prenom + " — non inclus dans la relève");
    if (seqIdx < total - 1){ seqIdx++; renderSeq(); }
    else { toast("Fin de la tournée ✓"); exitSeqMode(); }
  };
  document.getElementById("sq-prev").onclick = () => {
    commitThen(() => { if (seqIdx > 0){ seqIdx--; renderSeq(); } });
  };
  document.getElementById("sq-quit").onclick = () => commitThen(exitSeqMode);
  document.getElementById("sq-next").onclick = () => {
    commitThen(() => {
      if (seqIdx < total - 1){ seqIdx++; renderSeq(); }
      else { const pl = seqPool, sl = seqSlot; exitSeqMode(); seqEndScreen(pl, sl); }
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
async function scheduleRappelNotifications(){
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

/* Appeler après chaque sauvegarde de rappels */
const _origSave = (typeof save !== "undefined") ? save : null;
if (_origSave){
  const _hookedSave = function(){
    _origSave.apply(this, arguments);
    scheduleRappelNotifications();
  };
}

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
        (!S.slotsEnabled || slot === "jour" || !slot || (v.slot||defaultSlot()) === slot);

  const lignes = [];
  (pool||[]).forEach(p => {
    (p.visits||[]).filter(estDuJour).forEach(v => lignes.push({ p, v }));
  });
  lignes.sort((a,b) => (a.v.at||"").localeCompare(b.v.at||""));

  const heures = lignes.map(x => x.v.at).filter(Boolean).sort();
  const alertes_ = lignes.filter(x => alertes(x.v.consts, x.p.thresholds).length);
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
        const al = alertes(v.consts, p.thresholds);
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

    <button class="btn btn-primary" id="sqe-home" style="width:100%;margin-top:14px">↩︎ Retour au Moniteur</button>`);

  $$("#sheet [data-sqe]").forEach(b => b.onclick = () => {
    const pid = b.dataset.sqe;
    closeSheet(); openId = pid; render();
    setTimeout(() => {
      const el = document.querySelector(`.pcard[data-id="${pid}"]`);
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior:"smooth", block:"start" });
    }, 120);
  });
  $("#sqe-home").onclick = () => { closeSheet(); render(); };
}


/* ===== sync.js ===== */
/* ============================================================
   SYNCHRONISATION MULTI-UTILISATEURS (sans serveur)
   ─────────────────────────────────────────────────────────
   Principe : chaque app tient un JOURNAL d'opérations signées
   et horodatées. Le fichier .jmsync ne transporte QUE les
   opérations depuis la dernière synchro avec ce destinataire.
   À la réception : snapshot de sécurité → analyse → validation
   (tout ou rien) → conflits tranchés par donnée → fusion.

   Données STRICTEMENT locales (jamais dans le journal ni le
   fichier) : ordre de passage, thème, PIN, créneaux, phrases
   perso, préférences, identité, journal lui-même.
============================================================ */

/* ---------- Identité ---------- */
function ensureIdentity(cb){
  if (S.identity && S.identity.uid){ if (cb) cb(); return; }
  openSheet(`
    <h3>👤 Qui es-tu ?</h3>
    <p class="small muted" style="margin-bottom:12px">Ton nom et prénom identifient tes modifications lors du partage avec un collègue. Ils restent sur ton téléphone.</p>
    <div class="field"><span class="lab">Nom</span><input id="id-nom" placeholder="Ton nom"></div>
    <div class="field"><span class="lab">Prénom</span><input id="id-prenom" placeholder="Ton prénom"></div>
    <button class="btn btn-primary" id="id-ok" style="width:100%;margin-top:8px">Valider</button>`);
  $("#id-ok").onclick = () => {
    const nom = $("#id-nom").value.trim(), prenom = $("#id-prenom").value.trim();
    if (!nom || !prenom){ toast("Nom et prénom requis."); return; }
    S.identity = { nom, prenom, uid: "u_" + Math.random().toString(36).slice(2,10) };
    save(); closeSheet(); toast("Bienvenue "+prenom+" ✓");
    if (cb) cb();
  };
}
function whoami(){ return S.identity ? (S.identity.prenom+" "+S.identity.nom) : "Inconnu"; }

/* ---------- Journal des changements ----------
   Chaque opération : { seq, ts, by, kind, entity, id, data }
   kind ∈ add|update|delete ; entity ∈ patient|visit|rappel|bilan|doc|plan
   'plan' (plan de soins) est marqué pour validation à la réception.
------------------------------------------------------------ */
function logChange(kind, entity, id, data){
  if (!S.identity) return; // pas de journal tant qu'on n'a pas d'identité
  S.changeSeq = (S.changeSeq||0) + 1;
  S.changeLog.push({
    seq: S.changeSeq, ts: Date.now(), by: S.identity.uid, byName: whoami(),
    kind, entity, id, data: data===undefined ? null : data
  });
  // Garder le journal borné (les opérations trop vieilles et déjà synchronisées partout sont élaguées ailleurs)
  if (S.changeLog.length > 5000) S.changeLog.splice(0, S.changeLog.length - 5000);
}

/* ---------- Construire un fichier .jmsync ----------
   Contient les ops depuis la dernière synchro avec ce peer
   (ou tout le journal si première synchro). Léger, incrémental.
------------------------------------------------------------ */
/* Construit le fichier de synchro CLOISONNÉ par tournée.
   Règle absolue : un fichier ne contient QUE les patients du cabinet choisi.
   Envoyer les patients d'un autre cabinet à un collègue qui n'en a pas la
   charge est une violation du secret professionnel. */
function buildSyncFile(tour, docIds){
  const inTourIds = new Set(
    (S.patients||[]).filter(p => !tour || (p.tours||[]).includes(tour)).map(p => p.id));

  // Une opération part si elle concerne un patient du cabinet, ou un rappel
  // du cabinet lui-même. Jamais les rappels personnels ni les autres cabinets.
  const belongs = op => {
    if (!tour) return true;
    if (op.entity === "rappel"){
      const r = (S.rappels||[]).find(x => x.id === op.id) || op.data || {};
      if (r.perso) return false;                       // personnel : reste chez moi
      if (r.pid)   return inTourIds.has(r.pid);        // patient : suit son cabinet
      return r.tour === tour;                          // rappel de cabinet
    }
    const pid = String(op.id||"").split("|")[0];
    return inTourIds.has(pid);
  };

  const ops = S.changeLog.filter(belongs);
  const maxSeq = S.changeLog.length ? S.changeLog[S.changeLog.length-1].seq : (S.changeSeq||0);
  S.lastSentSeq = maxSeq;
  const cutTs = Date.now() - 60*864e5;
  const kept = S.changeLog.filter(op => op.ts >= cutTs || op.seq > (S.confirmedSeq||0));
  if (kept.length !== S.changeLog.length) S.changeLog = kept;
  try { save(); } catch(e){}

  return JSON.stringify({
    _jmsync: 1,
    from: { uid: S.identity.uid, name: whoami() },
    tour: tour || null,
    generatedAt: Date.now(),
    sinceSeq: 0,
    upToSeq: maxSeq,
    ops,
    docs: []          // rempli par shareSyncFile (contenus chargés depuis IDB)
  }, null, 1);
}


/* ---------- Snapshot de sécurité (garde-fou) ---------- */
function makeSyncSnapshot(label){
  const snap = {
    ts: Date.now(),
    label: label || "Avant synchro",
    // état complet SANS les gros documents (rechargés par clé) — copie profonde du state applicatif
    state: JSON.parse(JSON.stringify({
      patients: S.patients, rappels: S.rappels, tours: S.tours,
      patientOrder: S.patientOrder, slotOrder: S.slotOrder, slotMembers: S.slotMembers
    }))
  };
  S.syncHistory.unshift(snap);
  if (S.syncHistory.length > 20) S.syncHistory.length = 20;
  return snap;
}

/* ---------- Analyse d'un fichier reçu ----------
   Classe les opérations : courantes (auto), plan (validation),
   conflits (édition simultanée de la même donnée).
------------------------------------------------------------ */
function analyzeSync(pkg){
  const mine = indexMyChanges();     // dernières modifs locales par (entity,id) → ts
  const mineUnsent = indexMyUnsentChanges();  // (entity,id) → true si modif locale non partagée
  const auto = [], plans = [], conflicts = [], newPatients = [], delPatients = [];
  const already = (pkg.from && S.syncState && S.syncState[pkg.from.uid]) ? (S.syncState[pkg.from.uid].lastRecvUpTo||0) : 0;
  (pkg.ops||[]).forEach(op => {
    if (op.by === S.identity.uid) return; // ignorer mes propres ops renvoyées
    if (op.seq <= already) return;         // déjà reçue de ce pair lors d'une synchro précédente
    if (op.entity === "plan"){ plans.push(op); return; }
    // Arrivée d'un patient créé par le collègue → validation explicite
    if (op.entity === "patient" && op.kind === "add"){
      if (!getP(op.id)) newPatients.push(op);   // déjà présent → rien à faire
      return;
    }
    // Suppression d'un patient → JAMAIS automatique, validation explicite
    if (op.entity === "patient" && op.kind === "delete"){
      if (getP(op.id)) delPatients.push(op);
      return;
    }
    const key = op.entity+":"+op.id;
    const localTs = mine[key];
    // Conflit : j'ai une modification LOCALE non encore partagée sur la MÊME entité que celle
    // que le pair modifie. Seq locale > lastSentSeq = pas encore envoyée à personne.
    const localUnsent = localTs && (mineUnsent[key] === true);
    if (op.kind==="update" && localUnsent && localTs !== op.ts){
      conflicts.push(op);
    } else {
      auto.push(op);
    }
  });
  return { auto, plans, conflicts, newPatients, delPatients, from: pkg.from };
}
function indexMyChanges(){
  const idx = {};
  (S.changeLog||[]).forEach(op => {
    if (op.by !== S.identity.uid) return;
    idx[op.entity+":"+op.id] = op.ts;
  });
  return idx;
}
function indexMyUnsentChanges(){
  const idx = {};
  const sent = S.confirmedSeq || 0;
  (S.changeLog||[]).forEach(op => {
    if (op.by !== S.identity.uid) return;
    if (op.seq > sent) idx[op.entity+":"+op.id] = true; // pas encore confirmée comme partagée
  });
  return idx;
}

/* ---------- Application d'une opération ---------- */
function applyOp(op){
  const P = () => getP(op.id) || S.patients.find(p=>p.id===op.id);
  switch(op.entity){
    case "patient":
      if (op.kind==="add" && !getP(op.id)) S.patients.push(op.data);
      else if (op.kind==="update"){ const p=getP(op.id); if(p) Object.assign(p, op.data); }
      else if (op.kind==="delete"){
        // Passage par la corbeille (récupérable 30 j) plutôt qu'une perte sèche
        if (typeof trashPatient === "function" && getP(op.id)) trashPatient(op.id);
        else S.patients = S.patients.filter(x=>x.id!==op.id);
      }
      break;
    case "visit": {
      const [pid, uid_] = op.id.split("|");
      const p = getP(pid); if(!p) break; p.visits = p.visits||[];
      if (op.kind==="add" && !p.visits.some(v=>v.uid===uid_)) p.visits.push(op.data);
      else if (op.kind==="update"){ const v=p.visits.find(v=>v.uid===uid_); if(v) Object.assign(v, op.data); }
      else if (op.kind==="delete"){ p.visits = p.visits.filter(v=>v.uid!==uid_); }
      break; }
    case "rappel":
      if (op.kind==="add" && !S.rappels.some(r=>r.id===op.id)) S.rappels.push(op.data);
      else if (op.kind==="update"){ const r=S.rappels.find(r=>r.id===op.id); if(r) Object.assign(r, op.data); }
      else if (op.kind==="delete"){ S.rappels = S.rappels.filter(r=>r.id!==op.id); }
      break;
    case "bilan": {
      const [pid, bid] = op.id.split("|");
      const p = getP(pid); if(!p) break; p.bilans = p.bilans||[];
      if (op.kind==="add" && !p.bilans.some(b=>b.id===bid)) p.bilans.push(op.data);
      else if (op.kind==="update"){ const b=p.bilans.find(b=>b.id===bid); if(b) Object.assign(b, op.data); }
      else if (op.kind==="delete"){ p.bilans = p.bilans.filter(b=>b.id!==bid); }
      break; }
    case "plan": {
      const p = getP(op.id); if(p && op.data) p.plan = op.data; // appliqué seulement si validé
      break; }
  }
}

/* ---------- Réception : écran de validation ---------- */
async function receiveSyncFile(text){
  let pkg;
  try { pkg = JSON.parse(text); } catch(e){ toast("Fichier de synchro illisible."); return; }
  if (!pkg._jmsync){ toast("Ce fichier n'est pas une synchro JM@Santé."); return; }
  if (!S.identity){ ensureIdentity(() => receiveSyncFile(text)); return; }

  const a = analyzeSync(pkg);
  if (!a.auto.length && !a.plans.length && !a.conflicts.length && !a.newPatients.length && !a.delPatients.length){
    toast("Rien de nouveau dans cette synchro."); return;
  }
  // Opérations portant sur des patients absents de MA base : elles seront ignorées.
  const willBeCreated = new Set(a.newPatients.map(op => op.id));
  const orphelines = [...a.auto, ...a.plans, ...a.conflicts].filter(op => {
    const pid = String(op.id||"").split("|")[0];
    if (op.entity === "rappel") return false;          // les rappels peuvent être généraux
    if (willBeCreated.has(pid)) return false;          // le patient arrive dans cette synchro
    return pid && !getP(pid);
  }).length;
  if (orphelines && !(S.patients||[]).length){
    if (!await askDialog({ ic:"⚠️", titre:"Patients inconnus dans cette synchro",
    sub:"Une synchro ne transmet que les <b>changements</b>, pas les dossiers eux-mêmes.",
    warn:"Demande plutôt à ton collègue une sauvegarde complète (💾) pour partir de la même base.",
    oui:"Continuer quand même", non:"Annuler" })) return;
  } else if (orphelines){
    toast(orphelines + " modification(s) concernent des patients que tu n'as pas — elles seront ignorées.");
  }
  // Décisions de conflit : par donnée (défaut : garder la version distante ? non → locale)
  const conflictChoice = {}; // seq -> "mine"|"theirs"
  a.conflicts.forEach(op => conflictChoice[op.seq] = "mine");
  const planChoice = {};     // seq -> true(accepter)/false
  a.plans.forEach(op => planChoice[op.seq] = true);
  // ── Documents reçus : rien n'entre sans accord explicite ──
  const rxDocs = (pkg.docs||[]).map(d => {
    const owner = (S.patients||[]).find(p => p.id === d.pid);
    /* ⚠️ Comparer par NOM DE FICHIER ne marchait pas entre confrères :
       deux scans de la même ordonnance portaient des noms différents.
       Le TYPE est comparable d'un appareil à l'autre. */
    const mine = owner && (owner.docs||[]).find(x =>
      (d.type && x.type) ? (x.type === d.type && x.date === d.date)
                         : (x.name === d.name));
    // Même type mais date différente : c'est une mise à jour, pas un doublon
    const versionAnterieure = owner && d.type && !mine
      ? (owner.docs||[]).filter(x => x.type === d.type)
          .sort((a,b) => String(b.date).localeCompare(String(a.date)))[0]
      : null;
    return { ...d, ownerName: owner ? owner.prenom+" "+owner.nom.replace("Demo-","").toUpperCase() : "?",
             clash: mine || null, anterieur: versionAnterieure || null };
  });
  const docChoice = {};      // id -> true (importer) / false (ignorer)
  rxDocs.forEach(d => docChoice[d.id] = !d.clash);   // doublon → décoché par prudence

  const newChoice = {};      // nouveaux patients : accepté par défaut
  a.newPatients.forEach(op => newChoice[op.seq] = true);
  const delChoice = {};      // suppressions : REFUSÉES par défaut (prudence)
  a.delPatients.forEach(op => delChoice[op.seq] = false);

  const render = () => {
    const summary = `
      <div class="small" style="margin-bottom:10px">De <b>${esc(a.from?a.from.name:"?")}</b> — ${a.auto.length} mise(s) à jour automatique(s)${a.newPatients.length?`, <b style="color:var(--accent)">${a.newPatients.length} nouveau(x) patient(s)</b>`:""}${a.delPatients.length?`, <b style="color:var(--danger)">${a.delPatients.length} suppression(s)</b>`:""}${rxDocs.length?`, <b>${rxDocs.length} document(s)</b>`:""}${a.plans.length?`, ${a.plans.length} plan(s) de soins`:""}${a.conflicts.length?`, <span style="color:var(--amber)">${a.conflicts.length} conflit(s)</span>`:""}.</div>`;
    const newHtml = a.newPatients.length ? `
      <div class="lab" style="margin-top:10px">🆕 Nouveaux patients — les ajouter à ton app ?</div>
      ${a.newPatients.map(op => {
        const np = op.data || {};
        const nom = (np.nom||"?").replace("Demo-","").toUpperCase() + " " + (np.prenom||"");
        const plan = (np.plan||[]).length;
        return `<div class="rap" style="align-items:center;padding:8px">
          <span style="flex:1" class="small"><b>${esc(nom)}</b>${np.ctx?`<div class="rs">⚠ ${esc(np.ctx)}</div>`:""}
            <div class="rs">${plan?plan+" soin(s) au plan":"sans plan de soins"} · créé par ${esc(op.byName||"collègue")}</div></span>
          <button class="chip ${newChoice[op.seq]?"on":""}" data-np="${op.seq}">${newChoice[op.seq]?"✓ Ajouter":"Ignorer"}</button>
        </div>`;
      }).join("")}` : "";

    const delHtml = a.delPatients.length ? `
      <div class="lab" style="margin-top:10px;color:var(--danger)">🗑 Suppressions demandées — à confirmer</div>
      <p class="small muted" style="margin-bottom:6px">Refusées par défaut. Si tu acceptes, le dossier part en corbeille (récupérable 30 jours).</p>
      ${a.delPatients.map(op => {
        const dp = getP(op.id);
        const nom = dp ? dp.nom.replace("Demo-","").toUpperCase()+" "+dp.prenom : op.id;
        const nv = dp ? (dp.visits||[]).length : 0;
        return `<div class="rap" style="align-items:center;padding:8px">
          <span style="flex:1" class="small"><b>${esc(nom)}</b>
            <div class="rs">${nv} passage(s) enregistré(s) · demandé par ${esc(op.byName||"collègue")}</div></span>
          <button class="chip ${delChoice[op.seq]?"on":""}" data-dp="${op.seq}" style="${delChoice[op.seq]?"background:var(--danger);border-color:var(--danger);color:#fff":""}">${delChoice[op.seq]?"✓ Supprimer":"Conserver"}</button>
        </div>`;
      }).join("")}` : "";

    const docsHtml = rxDocs.length ? `
      <div class="lab" style="margin-top:10px">📎 Documents reçus (${rxDocs.length})</div>
      <p class="small muted" style="margin-bottom:6px">Coche ce que tu veux garder. <b>Tes documents actuels ne sont jamais remplacés.</b></p>
      ${rxDocs.map(d=>{
        const ko = Math.round(((d.data||"").length*0.75)/1024);
        return `<div class="rap" style="align-items:flex-start;padding:8px">
          <span style="flex:1" class="small">
            <b>${docIcon(d)} ${esc(typeof docLabel === "function" ? docLabel(d) : d.name)}</b>
            <div class="rs">${esc(d.ownerName)} · ${d.date?fmtFR(d.date):"sans date"} · ${ko>1024?(ko/1024).toFixed(1)+" Mo":ko+" Ko"}</div>
            ${d.anterieur && !d.clash ? `<div class="rs" style="color:var(--accent)">↻ Tu as une version du ${fmtFR(d.anterieur.date)} — celui-ci est ${String(d.date) > String(d.anterieur.date) ? "plus récent" : "plus ancien"}</div>` : ""}
            ${d.clash ? `<div class="rs" style="color:var(--amber)">⚠ Tu as déjà un fichier de ce nom (${d.clash.date?fmtFR(d.clash.date):"sans date"}) — le reçu date du ${d.date?fmtFR(d.date):"?"}. S'il est importé, il sera ajouté <b>à côté</b> du tien.</div>` : ""}
          </span>
          <button class="chip ${docChoice[d.id]?"on":""}" data-rxd="${esc(d.id)}">${docChoice[d.id]?"✓ Garder":"Ignorer"}</button>
        </div>`;
      }).join("")}` : "";

    const conflictsHtml = a.conflicts.length ? `
      <div class="lab" style="margin-top:10px">⚠️ Conflits — choisis la version à garder</div>
      ${a.conflicts.map(op => {
        const p = getP(op.id.split("|")[0]) || getP(op.id);
        const who = op.byName||"collègue";
        return `<div class="rap" style="flex-direction:column;align-items:stretch;padding:8px">
          <div class="small" style="margin-bottom:4px"><b>${esc(p?p.nom.replace("Demo-","").toUpperCase():op.id)}</b> — ${esc(op.entity)}</div>
          <div class="chips">
            <button class="chip ${conflictChoice[op.seq]==="mine"?"on":""}" data-cf="${op.seq}:mine" style="flex:1">La mienne</button>
            <button class="chip ${conflictChoice[op.seq]==="theirs"?"on":""}" data-cf="${op.seq}:theirs" style="flex:1">Celle de ${esc(who)}</button>
          </div>
        </div>`;
      }).join("")}` : "";
    const plansHtml = a.plans.length ? `
      <div class="lab" style="margin-top:10px">📋 Plans de soins modifiés — accepter ?</div>
      ${a.plans.map(op => {
        const p = getP(op.id);
        return `<div class="rap" style="align-items:center;padding:8px">
          <span style="flex:1" class="small"><b>${esc(p?p.nom.replace("Demo-","").toUpperCase():op.id)}</b> par ${esc(op.byName||"collègue")}</span>
          <button class="chip ${planChoice[op.seq]?"on":""}" data-pl="${op.seq}">${planChoice[op.seq]?"✓ Accepté":"Refusé"}</button>
        </div>`;
      }).join("")}` : "";
    openSheet(`
      <h3>🔄 Synchronisation reçue</h3>
      ${summary}
      ${docsHtml}
      ${newHtml}
      ${delHtml}
      ${conflictsHtml}
      ${plansHtml}
      <div class="tip small" style="margin-top:10px">Une sauvegarde de sécurité est créée avant l'application. Tu pourras revenir en arrière dans 🗺️ → Historique des synchros.</div>
      <button class="btn btn-primary" id="sy-apply" style="width:100%;margin-top:12px">Appliquer cette synchro</button>
      <button class="btn btn-ghost" id="sy-cancel" style="width:100%;margin-top:8px">Annuler</button>`);
    $$("#sheet [data-cf]").forEach(b => b.onclick = () => {
      const [seq, ch] = b.dataset.cf.split(":"); conflictChoice[+seq]=ch; render();
    });
    $$("#sheet [data-pl]").forEach(b => b.onclick = () => {
      const seq = +b.dataset.pl; planChoice[seq]=!planChoice[seq]; render();
    });
    $$("#sheet [data-rxd]").forEach(b => b.onclick = () => {
      const id = b.dataset.rxd; docChoice[id] = !docChoice[id]; render();
    });
    $$("#sheet [data-np]").forEach(b => b.onclick = () => {
      const seq = +b.dataset.np; newChoice[seq]=!newChoice[seq]; render();
    });
    $$("#sheet [data-dp]").forEach(b => b.onclick = () => {
      const seq = +b.dataset.dp;
      if (!delChoice[seq]){
        const op = a.delPatients.find(o=>o.seq===seq);
        const dp = op && getP(op.id);
        const nom = dp ? dp.prenom+" "+dp.nom.replace("Demo-","").toUpperCase() : "ce patient";
        if (!confirm("Supprimer "+nom+" de TON app ?\nLe dossier ira dans ta corbeille (récupérable 30 jours).")) return;
      }
      delChoice[seq]=!delChoice[seq]; render();
    });
    $("#sy-cancel").onclick = closeSheet;
    $("#sy-apply").onclick = () => {
      makeSyncSnapshot("Avant synchro de "+(a.from?a.from.name:"?"));
      // 1. nouveaux patients acceptés (AVANT les autres ops qui les concernent)
      a.newPatients.forEach(op => { if (newChoice[op.seq]) applyOp(op); });
      // 2. auto
      a.auto.forEach(applyOp);
      // 2. conflits selon le choix
      a.conflicts.forEach(op => { if (conflictChoice[op.seq]==="theirs") applyOp(op); });
      // 3. plans acceptés
      a.plans.forEach(op => { if (planChoice[op.seq]) applyOp(op); });
      // 3bis. documents acceptés — ajoutés SANS écraser les existants
      rxDocs.filter(d => docChoice[d.id]).forEach(d => {
        const owner = (S.patients||[]).find(p => p.id === d.pid);
        if (!owner || !d.data) return;
        owner.docs = owner.docs || [];
        const nid = uid();
        let name = d.name;
        if (owner.docs.some(x => x.name === name)){
          // Même nom : on distingue par la date plutôt que d'écraser
          const dot = name.lastIndexOf(".");
          const base = dot>0 ? name.slice(0,dot) : name;
          const ext  = dot>0 ? name.slice(dot) : "";
          name = base + " (reçu " + (d.date?fmtFR(d.date):todayISO()) + ")" + ext;
        }
        try { idbSet("doc_"+nid, d.data); } catch(e){}
        owner.docs.push({ id:nid, name, mime:d.mime, date:d.date || todayISO() });
      });

      // 4. suppressions confirmées (en dernier)
      a.delPatients.forEach(op => { if (delChoice[op.seq]) applyOp(op); });
      // Enregistrer l'entrée d'historique (le snapshot est déjà en tête de syncHistory)
      S.syncHistory[0].applied = {
        from: a.from?a.from.name:"?", at: Date.now(),
        counts: { auto:a.auto.length, plans:a.plans.filter(o=>planChoice[o.seq]).length, conflicts:a.conflicts.length,
                  added:a.newPatients.filter(o=>newChoice[o.seq]).length, removed:a.delPatients.filter(o=>delChoice[o.seq]).length }
      };
      // Mémoriser la dernière seq reçue de ce pair (anti-doublon aux prochaines synchros)
      if (pkg.from && pkg.from.uid){
        S.syncState = S.syncState || {};
        S.syncState[pkg.from.uid] = { lastRecvUpTo: pkg.upToSeq||0, at: Date.now(), name: pkg.from.name };
      }
      save(); closeSheet(); render && render; renderApp();
      toast("Synchro appliquée ✓ — annulable dans les réglages");
    };
  };
  render();
}
function renderApp(){ try { render(); } catch(e){} }

/* ---------- Historique des synchros + marche arrière ---------- */
async function sheetSyncHistory(){
  const h = S.syncHistory||[];
  openSheet(`
    <h3>🕰️ Historique des synchros</h3>
    <p class="small muted" style="margin-bottom:10px">Chaque synchro reçue a créé une sauvegarde de ton état d'avant. Tu peux y revenir ou faire le ménage.</p>
    <div style="max-height:50vh;overflow-y:auto">
      ${h.length ? h.map((s,i)=>{
        const d=new Date(s.ts);
        const dd=String(d.getDate()).padStart(2,"0")+"/"+String(d.getMonth()+1).padStart(2,"0")+" "+String(d.getHours()).padStart(2,"0")+"h"+String(d.getMinutes()).padStart(2,"0");
        const ap = s.applied ? ` · ${s.applied.counts.auto} maj${s.applied.counts.conflicts?", "+s.applied.counts.conflicts+" conflit(s)":""}` : "";
        return `<div class="rap" style="align-items:center">
          <span style="flex:1"><div class="rt">${esc(s.label)}</div><div class="rs">${dd}${ap}</div></span>
          <button class="btn btn-ghost btn-sm" data-restore-sync="${i}" title="Revenir à cet état">↩︎</button>
          <button class="btn btn-ghost btn-sm" data-del-sync="${i}" title="Supprimer de l'historique">🗑</button>
        </div>`;
      }).join("") : '<p class="muted small" style="padding:10px 0">Aucune synchro reçue.</p>'}
    </div>
    ${h.length ? '<button class="btn btn-ghost" id="sh-clear" style="margin-top:10px;width:100%">🧹 Vider tout l\'historique</button>' : ''}
    <button class="btn btn-ghost" id="sh-back" style="margin-top:8px;width:100%">← Retour</button>`);
  $$("#sheet [data-restore-sync]").forEach(b => b.onclick = async () => {
    const idx = +b.getAttribute("data-restore-sync");
    const snap = S.syncHistory[idx];
    if (!snap) return;
    if (!await askDialog({ ic:"❓", titre:"Revenir à l'état d'avant cette synchro ?", sub:"Les modifications appliquées depuis seront perdues." })) return;
    Object.assign(S, JSON.parse(JSON.stringify(snap.state)));
    save(); closeSheet(); render(); toast("État restauré ↩︎");
  });
  $$("#sheet [data-del-sync]").forEach(b => b.onclick = async () => {
    const idx = +b.getAttribute("data-del-sync");
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce point de restauration ?", sub:"(Tes données actuelles ne changent pas, tu perds juste la possibilité de revenir à cet état.)", oui:"🗑 Supprimer" })) return;
    S.syncHistory.splice(idx, 1);
    save(); sheetSyncHistory();
  });
  const clr = $("#sh-clear");
  if (clr) clr.onclick = async () => {
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Vider tout l'historique des synchros ?", sub:"(Tes données actuelles ne changent pas — tu perds seulement les points de restauration.)", oui:"🗑 Supprimer" })) return;
    S.syncHistory = []; save(); sheetSyncHistory(); toast("Historique vidé 🧹");
  };
  $("#sh-back").onclick = sheetTours;
}

/* ---------- Envoi du fichier .jmsync ---------- */
/* ---------- Composer l'envoi : tournée + documents ---------- */
function sheetSendSync(){
  if (!S.identity){ ensureIdentity(sheetSendSync); return; }
  if (!S.tours.length){ toast("Crée d'abord une tournée"); return; }
  let tour = S.tours.includes(S.curTour) ? S.curTour : S.tours[0];
  const sel = new Set();                    // documents cochés

  const draw = () => {
    const pats = (S.patients||[]).filter(p => (p.tours||[]).includes(tour) && !p.archived);
    const withDocs = pats.filter(p => (p.docs||[]).length);
    const nOps = (S.changeLog||[]).length;
    let ko = 0;
    withDocs.forEach(p => (p.docs||[]).forEach(d => { if (sel.has(d.id)) ko += (d.size||120000)/1024; }));
    const mo = ko/1024;
    const heavy = mo > 8;

    openSheet(`
      <h3>📤 Envoyer la synchro</h3>
      <p class="small muted" style="margin-bottom:12px">Le fichier ne contiendra <b>que les patients du cabinet choisi</b> — ceux des autres cabinets n'y figurent pas.</p>

      <div class="lab">1. Cabinet à transmettre</div>
      <div class="chips" style="margin-bottom:14px">
        ${S.tours.map(t=>`<button class="chip ${t===tour?"on":""}" data-st="${esc(t)}">${esc(t)}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:14px">${pats.length} patient(s) · ${nOps} modification(s) en attente${
        (S.rappels||[]).filter(r=>!r.perso && (r.tour===tour || (r.pid && pats.some(p=>p.id===r.pid)))).length
        ? " · "+(S.rappels||[]).filter(r=>!r.perso && (r.tour===tour || (r.pid && pats.some(p=>p.id===r.pid)))).length+" rappel(s)" : ""}</p>

      ${withDocs.length ? `
        <div class="lab">2. Documents à joindre <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(facultatif)</span></div>
        <p class="small muted" style="margin-bottom:7px">Aucun par défaut, pour ne pas alourdir l'envoi. Coche seulement ce qui est utile à ton collègue.</p>
        <div style="max-height:30vh;overflow-y:auto;margin-bottom:8px">
          ${withDocs.map(p=>`
            <div class="doc-grp">
              <div class="doc-grp-h">
                <span>👤 ${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}</span>
                ${(p.docs||[]).length>1?`<button class="chip doc-all" data-sdall="${(p.docs||[]).map(d=>d.id).join(",")}" style="font-size:11px">Tout</button>`:""}
              </div>
              ${(p.docs||[]).map(d=>`<button class="selv" data-sd="${esc(d.id)}">
                <span class="box">${sel.has(d.id)?"✓":""}</span>
                <span class="sv">${docIcon(d)} ${esc(d.name)}${d.date?` <span class="small muted">${fmtFR(d.date)}</span>`:""}</span>
              </button>`).join("")}
            </div>`).join("")}
        </div>
        <p class="small ${heavy?"":"muted"}" style="margin-bottom:14px;${heavy?"color:var(--amber)":""}">
          ${sel.size} document(s) · ${mo>=1 ? mo.toFixed(1)+" Mo" : Math.round(ko)+" Ko"}${
          heavy ? " — ⚠ envoi lourd, certaines messageries le refuseront. Tu peux l'envoyer quand même." : ""}</p>`
        : `<p class="small muted" style="margin-bottom:14px">Aucun document dans ce cabinet.</p>`}

      <button class="btn btn-primary" id="ss-go" style="width:100%">📤 Envoyer</button>
      <button class="btn btn-ghost" id="ss-cancel" style="width:100%;margin-top:8px">Annuler</button>`);

    $$("#sheet [data-st]").forEach(b => b.onclick = () => { tour = b.dataset.st; sel.clear(); draw(); });
    $$("#sheet [data-sd]").forEach(b => b.onclick = () => {
      const id = b.dataset.sd; sel.has(id) ? sel.delete(id) : sel.add(id); draw();
    });
    $$("#sheet [data-sdall]").forEach(b => b.onclick = () => {
      const ids = b.dataset.sdall.split(",");
      const allOn = ids.every(i => sel.has(i));
      ids.forEach(i => allOn ? sel.delete(i) : sel.add(i));
      draw();
    });
    $("#ss-cancel").onclick = closeSheet;
    $("#ss-go").onclick = () => { closeSheet(); shareSyncFile(tour, [...sel]); };
  };
  draw();
}

async function shareSyncFile(tour, docIds){
  if (!S.identity){ ensureIdentity(() => shareSyncFile(tour, docIds)); return; }
  // Charger les contenus des documents cochés
  const pkg = JSON.parse(buildSyncFile(tour, docIds));
  for (const id of (docIds||[])){
    const owner = (S.patients||[]).find(p => (p.docs||[]).some(d => d.id === id));
    const meta  = owner && (owner.docs||[]).find(d => d.id === id);
    if (!meta) continue;
    try {
      const data = await idbGet("doc_"+id);
      if (data) pkg.docs.push({ ...meta, pid: owner.id, data });
    } catch(e){ /* document illisible : ignoré */ }
  }
  const json = JSON.stringify(pkg, null, 1);
  // Extension .json : reconnue par tous les gestionnaires de fichiers et apps de partage Android/iOS
  const fname = "synchro_"+ (S.identity.prenom||"idel") +"_"+ todayISO() +".json";
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    try {
      const { Filesystem, Share } = cap.Plugins;
      const b64 = btoa(unescape(encodeURIComponent(json)));
      const res = await Filesystem.writeFile({ path:fname, data:b64, directory:"CACHE" });
      await Share.share({ title:"Synchro JM@Santé", text:"Fichier dynamique de tournée — "+whoami(), url:res.uri });
      return;
    } catch(e){ if((e.message||"").match(/cancel/i)) return; console.warn("shareSync:", e); }
  }
  // Fallback web : téléchargement
  const blob = new Blob([json], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=fname; a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
  toast("Fichier de synchro exporté 📤");
}


/* ===== pwa.js ===== */
/* ============================================================
   PWA — Installation sur l'écran d'accueil & protection des données
   ─────────────────────────────────────────────────────────
   ⚠️ POINT CRITIQUE iOS : tant que l'app N'EST PAS installée sur
   l'écran d'accueil, iOS peut effacer son stockage après ~7 jours
   d'inactivité. Une fois installée, le stockage devient persistant.
   → On avertit l'utilisateur de façon insistante et répétée.
============================================================ */

/* ---------- Détection de l'environnement ---------- */
function isIOS(){
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) ||
         (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPad récent
}
function isStandalone(){
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.navigator.standalone === true;   // iOS
}
function isNativeApp(){
  const cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
}
/* Contexte à risque : iPhone/iPad, dans Safari, PAS installé */
function isIOSAtRisk(){
  return isIOS() && !isStandalone() && !isNativeApp();
}

/* ---------- Enregistrement du service worker (hors ligne) ---------- */
function registerSW(){
  if (!("serviceWorker" in navigator)) return;
  if (isNativeApp()) return;               // inutile dans l'APK
  if (location.protocol === "file:") return;
  navigator.serviceWorker.register("sw.js")
    .then(reg => {
      // Nouvelle version disponible → l'activer au prochain lancement
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller){
            toast("Nouvelle version disponible — relance l'app pour l'appliquer");
          }
        });
      });
    })
    .catch(e => console.warn("SW:", e));
}

/* ---------- Demander un stockage persistant (navigateurs qui le supportent) ---------- */
async function requestPersistentStorage(){
  try {
    if (navigator.storage && navigator.storage.persist){
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch(e){}
}

/* ---------- Écran d'installation iOS (illustré, pas à pas) ---------- */
function sheetInstallIOS(fromBanner){
  openSheet(`
    <h3>📲 Installe JM@Santé sur ton iPhone</h3>
    <div class="warn-box" style="background:var(--amber-soft);border-left:4px solid var(--amber);border-radius:0 12px 12px 0;padding:12px 14px;margin-bottom:14px">
      <b style="color:var(--amber)">⚠️ Important pour ne pas perdre tes données</b>
      <p class="small" style="margin:6px 0 0;line-height:1.5">
        Tant que l'app n'est pas installée sur ton écran d'accueil, <b>iOS peut effacer
        toutes tes données</b> après quelques jours sans ouvrir l'app.
        Une fois installée, tes données sont <b>conservées durablement</b>.
      </p>
    </div>
    <div class="small" style="line-height:1.9;margin-bottom:14px">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
        <span style="background:var(--accent);color:var(--accent-ink);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">1</span>
        <span>En bas de Safari, tape le bouton <b>Partager</b> <span style="font-size:18px">􀈂</span> (le carré avec une flèche vers le haut)</span>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px">
        <span style="background:var(--accent);color:var(--accent-ink);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">2</span>
        <span>Fais défiler et choisis <b>« Sur l'écran d'accueil »</b> <span style="font-size:16px">➕</span></span>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-start">
        <span style="background:var(--accent);color:var(--accent-ink);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0">3</span>
        <span>Tape <b>Ajouter</b> — l'icône JM@Santé apparaît sur ton écran d'accueil</span>
      </div>
    </div>
    <p class="small muted" style="margin-bottom:12px">Ouvre ensuite l'app <b>par cette icône</b> (plus par Safari) : elle s'affiche en plein écran et tes données sont protégées.</p>
    <button class="btn btn-primary" id="ins-ok" style="width:100%">J'ai compris</button>
    ${fromBanner ? `<button class="btn btn-ghost" id="ins-later" style="width:100%;margin-top:8px">Plus tard (me le rappeler)</button>` : ""}`);
  $("#ins-ok").onclick = () => {
    S.iosInstallSeen = (S.iosInstallSeen||0) + 1;
    S.iosInstallLast = Date.now();
    try { save(); } catch(e){}
    closeSheet();
  };
  const later = $("#ins-later");
  if (later) later.onclick = () => { S.iosInstallLast = Date.now(); try{save();}catch(e){} closeSheet(); };
}

/* ---------- Bannière permanente (iOS non installé) ---------- */
function renderIOSBanner(){
  const existing = document.getElementById("ios-banner");
  if (!isIOSAtRisk()){ if (existing) existing.remove(); return; }
  if (existing) return;               // déjà affichée
  const el = document.createElement("div");
  el.id = "ios-banner";
  el.className = "ios-banner";
  el.innerHTML = `
    <span class="iosb-txt">⚠️ <b>Données non protégées</b> — installe l'app sur ton écran d'accueil</span>
    <button class="iosb-btn" id="iosb-how">Comment ?</button>`;
  document.body.appendChild(el);
  document.getElementById("iosb-how").onclick = () => sheetInstallIOS(true);
}

/* ---------- Rappels répétés tant que l'app n'est pas installée ---------- */
function iosNagIfNeeded(){
  if (!isIOSAtRisk()) return;
  const last = S.iosInstallLast || 0;
  const seen = S.iosInstallSeen || 0;
  const hours = (Date.now() - last) / 36e5;
  // 1er lancement : tout de suite. Ensuite : toutes les 24 h tant que non installé.
  if (seen === 0 || hours > 24){
    setTimeout(() => sheetInstallIOS(true), 1200);
  }
}

/* ---------- Rappel de sauvegarde renforcé sur iOS ---------- */
function iosBackupWarning(){
  if (!isIOSAtRisk()) return;
  const days = S.lastBackup ? Math.floor((Date.now()-S.lastBackup)/864e5) : 999;
  if (days >= 3){
    setTimeout(() => {
      toast(days === 999
        ? "⚠️ Aucune sauvegarde — exporte tes données depuis 🗺️ Réglages"
        : "⚠️ Dernière sauvegarde il y a "+days+" jours — pense à exporter", "danger");
    }, 3000);
  }
}

/* ---------- Installation native (Android / Chrome / Edge) ----------
   Chrome émet beforeinstallprompt : on capte l'événement pour proposer
   un vrai bouton « Installer » au bon moment. */
let _installPrompt = null;
function initInstallPrompt(){
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();          // on choisit nous-mêmes le moment
    _installPrompt = e;
    renderInstallButton();
  });
  window.addEventListener("appinstalled", () => {
    _installPrompt = null;
    S.pwaInstalled = true; try { save(); } catch(e){}
    const b = document.getElementById("install-btn"); if (b) b.remove();
    toast("JM@Santé installé ✓ — ouvre-le désormais par son icône");
  });
}
async function renderInstallButton(){
  if (!_installPrompt || isStandalone() || isNativeApp()) return;
  if (document.getElementById("install-btn")) return;
  const b = document.createElement("button");
  b.id = "install-btn";
  b.className = "install-btn";
  b.innerHTML = "📲 Installer l'application";
  b.onclick = async () => {
    if (!_installPrompt) return;
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === "accepted") b.remove();
    _installPrompt = null;
  };
  document.body.appendChild(b);
}

/* ---------- Initialisation ---------- */
function initPWA(){
  initInstallPrompt();
  registerSW();
  requestPersistentStorage();
  renderIOSBanner();
  iosNagIfNeeded();
  iosBackupWarning();
}


/* ===== init.js ===== */
$("#backupfile").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const txt = ev.target.result;
    try { if (JSON.parse(txt)._jmsync){ receiveSyncFile(txt); return; } } catch(e){}
    importBackupText(txt);
  };
  rd.onerror = () => toast("Lecture du fichier impossible.");
  rd.readAsText(f);
});
$("#syncfile").addEventListener("change", e => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const rd = new FileReader();
  rd.onload = ev => {
    const txt = ev.target.result;
    try {
      const j = JSON.parse(txt);
      if (j._jmsync){ receiveSyncFile(txt); return; }
      if (Array.isArray(j.patients)){ importBackupText(txt); return; }
    } catch(e){}
    receiveSyncFile(txt);
  };
  rd.onerror = () => toast("Lecture du fichier impossible.");
  rd.readAsText(f);
});

/* ---------- Masquer le splash au plus tôt (avant même le chargement des données) ---------- */
async function hideSplashNow(){
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.SplashScreen) cap.Plugins.SplashScreen.hide();
  } catch(e){}
}
/* Retirer l'écran de démarrage une fois l'app prête. Le thème est
   déjà appliqué à ce moment : les couleurs correspondent. */
function hideBoot(){
  const b = document.getElementById("boot");
  if (!b || b.classList.contains("gone")) return;
  b.classList.add("gone");
  setTimeout(() => { if (b.parentNode) b.remove(); }, 450);
}

// Tentatives multiples et précoces
hideSplashNow();
if (document.readyState !== "loading") hideSplashNow();
document.addEventListener("DOMContentLoaded", hideSplashNow);
window.addEventListener("load", hideSplashNow);
setTimeout(hideSplashNow, 100);
setTimeout(hideSplashNow, 500);
setTimeout(hideSplashNow, 1000);

/* ---------- INIT ---------- */
(async function(){
  // Filet anti-figeage : fermer tout overlay AVANT toute opération async
  try {
    ["veil","lock"].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove("on"); });
    document.querySelectorAll(".daily-greet").forEach(el=>el.remove());
  } catch(e){}

  let loaded = null;
  try { await openDB(); } catch(e){ console.error("openDB:", e); }
  try { await initSqlite(); } catch(e){ console.error("initSqlite:", e); }
  try { loaded = await idbGet("state"); } catch(e){ console.error("load state:", e); }

  let welcome = false;
  if (loaded && loaded.version >= 1){
    S = loaded;
  } else {
    seedDemo(); welcome = true; S.firstRun = true;
  }
  try { migrate(); } catch(e){ console.error("migrate:", e); }
  try { autoPurge(); } catch(e){ console.error("autoPurge:", e); }
  // Les notes vocales pèsent lourd : ménage à chaque ouverture
  try { if (typeof voicePurge === "function") voicePurge(); } catch(e){}
  try { applyTheme(); } catch(e){ console.error("applyTheme:", e); }

  // Re-fermer tout overlay après chargement
  try {
    ["veil","lock"].forEach(id => { const el=document.getElementById(id); if(el) el.classList.remove("on"); });
  } catch(e){}

  hideSplashNow();

  if (S.pin){ try { showLock("unlock"); } catch(e){ console.error(e); } }

  try { render(); } catch(e){
    console.error("render:", e);
    // Filet ultime : si render plante, afficher un bouton de secours
    try {
      const b = document.getElementById("board");
      if (b) b.innerHTML = '<div style="padding:30px;text-align:center"><p>Chargement…</p><button class="btn btn-primary" onclick="location.reload()">Recharger</button></div>';
    } catch(e2){}
  }

  // Salutation quotidienne (jamais au premier lancement)
  if (!welcome && !S.firstRun){
    setTimeout(() => { try { dailyGreeting(); } catch(e){} }, 800);
  }

  // PWA : service worker, bannière iOS, avertissements de sauvegarde
  if (typeof initPWA !== "undefined"){
    try { initPWA(); } catch(e){ console.error("PWA:", e); }
    // Le bouton retour du téléphone ferme la feuille au lieu de quitter l'app
    try { initBackButton(); } catch(e){ console.error("nav:", e); }
    // La date de travail ne survit pas à une fermeture : on repart d'aujourd'hui
    try { setWorkDate(null); } catch(e){}
  }

  if (typeof initNotifications !== "undefined"){
    try { initNotifications(); } catch(e){ console.error("notif:", e); }
  }

  hideSplashNow();
  // L'app est prête et le thème appliqué : on retire l'écran de démarrage
  hideBoot();
})();
/* Filet : si le démarrage échoue, l'écran ne doit pas rester bloqué */
setTimeout(() => { try { hideBoot(); } catch(e){} }, 3500);