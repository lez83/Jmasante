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
function toast(m){ const t=$("#toast"); t.textContent=m; t.classList.add("on"); clearTimeout(t._t); t._t=setTimeout(()=>t.classList.remove("on"),2500); }

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
function activeSlot(){
  if (!S.slotsEnabled) return null;
  return _viewSlot || defaultSlot();
}
// Un patient appartient-il à ce créneau de cette tournée ?
function inTourSlot(p, tour, slot){
  if (!(p.tours||[]).includes(tour)) return false;
  if (!S.slotsEnabled || !slot) return true;
  const m = ((S.slotMembers||{})[tour]||{})[slot];
  // Si aucune composition de créneau définie → le patient de la tournée compte pour les deux
  if (!m) return true;
  return m.includes(p.id);
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
  atcd:     { ic:"📋",   lbl:"Antécédents",      col:"var(--dim)",
              ph:"HTA, diabète, PTH droite 2019…" },
  entourage:{ ic:"👨‍👩‍👧", lbl:"Entourage",        col:"var(--dim)",
              ph:"Fille présente le week-end, aide à domicile le matin…" },
  autre:    { ic:"📌",   lbl:"Autre",            col:"var(--dim)",
              ph:"Toute autre information utile…" }
};
function infoType(t){ return INFO_TYPES[t] || INFO_TYPES.autre; }
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

const PATIENT_TAGS = {
  surveiller:  { ic:"👁️", lbl:"À surveiller" },
  prioritaire: { ic:"🔴", lbl:"Prioritaire" },
  materiel:    { ic:"🧰", lbl:"Matériel à apporter" },
  medecin:     { ic:"🩺", lbl:"Médecin contacté" }
};
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
