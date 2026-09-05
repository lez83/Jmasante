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

/* Routeur applicatif : chiffre/déchiffre "state" de façon transparente.
   Les clés "doc_*" et "__secret__" restent en clair (docs déjà volumineux ; secret = la clé elle-même). */
async function idbGet(k){
  const v = await _backGet(k);
  if (k === "state" && v && v._enc){
    const dec = await decryptState(v);
    return dec; // null si la clé ne correspond pas
  }
  return v;
}
async function idbSet(k, v){
  if (k === "state"){
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

async function encryptState(obj){
  const key = await ensureEncKey();
  if (!key) return obj; // pas de chiffrement sans clé
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({name:"AES-GCM",iv}, key, plain);
  // Stocker comme { _enc: true, iv: base64, data: base64 }
  return { _enc:true, iv:btoa(String.fromCharCode(...iv)), data:btoa(String.fromCharCode(...new Uint8Array(cipher))) };
}

async function decryptState(stored){
  if (!stored || !stored._enc) return stored; // pas chiffré
  const key = await ensureEncKey();
  if (!key) return null;
  try {
    const iv   = new Uint8Array(atob(stored.iv).split("").map(c=>c.charCodeAt(0)));
    const data = new Uint8Array(atob(stored.data).split("").map(c=>c.charCodeAt(0)));
    const plain = await crypto.subtle.decrypt({name:"AES-GCM",iv}, key, data);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch(e){ console.warn("Déchiffrement échoué:", e); return null; }
}

function save(){
  clearTimeout(saveT);
  const b = document.getElementById("save-badge");
  if (b){ b.className="save-badge saving"; b.title="Sauvegarde…"; b.textContent="💾"; }
  saveT = setTimeout(()=>{
    idbSet("state", JSON.parse(JSON.stringify(S))).then(()=>{
      _saveCount++;
      if (b){ b.className="save-badge ok"; b.title="Appuie pour exporter une sauvegarde"; b.textContent="💾 ✓"; }
      // Toast discret uniquement lors des premières sauvegardes
      if (_saveCount <= 3) toast("✓ Sauvegardé localement");
      setTimeout(()=>{ if(b){ b.className="save-badge"; b.textContent="💾"; } }, 3000);
    }).catch(()=>{ toast("⚠ Échec de sauvegarde !"); if(b){ b.className="save-badge"; b.textContent="💾"; } });
  }, 300);
}

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
  const json = JSON.stringify(S, null, 1);
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
function importBackupText(txt){

    // 1. Lecture brute
    let raw = txt;
    if (typeof raw !== "string" || !raw.trim()){
      toast("Fichier vide ou illisible.", "danger"); return;
    }
    // Retirer un éventuel BOM / espaces parasites
    raw = raw.replace(/^\uFEFF/, "").trim();
    // 2. Parsing JSON
    let j;
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
function sheetImportChoice(incoming){
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

    migrate(); save(); autoPurge(); closeSheet(); openId = null; render();
    toast("Fusion : " + add + " dossier(s) ajouté(s), " + upd + " complété(s), " + vis + " passage(s) récupéré(s) ✓");
  };

  $("#imp-replace").onclick = () => {
    if (!confirm("Remplacer TOUTES tes données actuelles ?\n(Une sauvegarde de sécurité est créée : tu pourras revenir en arrière.)")) return;
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
  const t = todayISO();
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
  $("#h-date").textContent = new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  // Écran de bienvenue INLINE au premier lancement (jamais modal → jamais figé)
  if (S.firstRun){ renderWelcomeInline(); return; }
  const _b = document.getElementById("board");
  if (_b && _b.style.display === "block") _b.style.display = "";  // rétablit la grille
  // Barre des tournées
  $("#tourbar").innerHTML =
    `<button class="fchip ${S.curTour==="all"?"on":""}" data-t="all">🗺 Toutes</button>` +
    S.tours.map(t => `<button class="fchip ${S.curTour===t?"on":""}" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  $$("#tourbar .fchip").forEach(b => b.onclick = () => { S.curTour = b.dataset.t; save(); openId=null; render(); });
  // Bandeau créneau Matin/Soir (si activé et tournée précise)
  const slotBar = document.getElementById("slotbar");
  if (slotBar){
    if (S.slotsEnabled && S.curTour !== "all"){
      const cur = activeSlot();
      slotBar.style.display = "flex";
      slotBar.innerHTML =
        `<button class="fchip ${cur==="matin"?"on":""}" data-slot="matin">☀️ Matin</button>` +
        `<button class="fchip ${cur==="soir"?"on":""}" data-slot="soir">🌙 Soir</button>`;
      slotBar.querySelectorAll(".fchip").forEach(b => b.onclick = () => { _viewSlot = b.dataset.slot; openId=null; render(); });
    } else { slotBar.style.display = "none"; slotBar.innerHTML = ""; }
  }

  const tour = S.curTour;
  // Mode compact (grosses tournées) : masque les constantes normales
  document.body.classList.toggle("compact-board", !!S.compactBoard);
  const slot = activeSlot();
  let pool = tour === "all"
    ? activeP()
    : activeP().filter(p => inTourSlot(p, tour, slot));
  pool = sortBySlot(pool, tour, slot);
  const st = pool.map(statusOf);
  const poolIds = new Set(pool.map(p=>p.id));
  $("#synth").innerHTML = `
    <div class="spill"><div class="n">${st.filter(x=>x==="todo").length}</div><div class="l">À voir</div></div>
    <div class="spill ok"><div class="n">${st.filter(x=>x==="done").length}</div><div class="l">Vus</div></div>
    <div class="spill warn"><div class="n">${st.filter(x=>x==="alert").length}</div><div class="l">Vigilance</div></div>
    <div class="spill"><div class="n">${S.rappels.filter(r=>!r.done && (!r.pid || poolIds.has(r.pid))).length}</div><div class="l">Rappels</div></div>`;
  const F = [["all","Tous"],["todo","À voir"],["alert","⚠ Vigilance"],["done","Vus"],["novisit","🚫 Sans passage"],["absent","Absents"]];
  $("#filters").innerHTML = F.map(([k,l]) => `<button class="fchip ${filter===k?"on":""}" data-f="${k}">${l}</button>`).join("")
    + `<button class="fchip ${S.compactBoard?"on":""}" id="f-compact" title="Affichage compact">${S.compactBoard?"📑 Compact":"📋 Détaillé"}</button>`;
  $$("#filters .fchip[data-f]").forEach(b => b.onclick = () => { filter=b.dataset.f; render(); });
  const fc = document.getElementById("f-compact");
  if (fc) fc.onclick = () => {
    S.compactBoard = !S.compactBoard; save(); render();
    toast(S.compactBoard ? "Affichage compact — seules les alertes sont visibles" : "Affichage détaillé");
  };

  const list = pool.filter(p => filter==="all" || statusOf(p)===filter);
  $("#board").innerHTML = list.map(p => {
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
          ${S.curTour==="all" && (p.tours||[]).length ? `<span class="mini">🗺 ${esc(p.tours.join(" · "))}</span>` : ""}
          ${p.docs.length ? `<span class="mini blue">📎 ${p.docs.length}</span>` : ""}
          ${bilansPending(p).length ? `<span class="mini blue">🧪 ${bilansPending(p).length}</span>` : ""}
          ${raps.length ? `<span class="mini amber">📌 ${raps.length}</span>` : ""}
          ${(p.tags||[]).map(t=>PATIENT_TAGS[t]?`<span class="mini ${t==="prioritaire"?"amber":"blue"}" style="${t==="prioritaire"?"font-weight:700":""}">${PATIENT_TAGS[t].ic} ${PATIENT_TAGS[t].lbl}</span>`:"").join("")}
        </div>
        <div class="lastseen">${lv ? (lv.date===todayISO() ? "vu aujourd'hui à "+esc(lv.at) : "dernier passage : "+esc(fmtFR(lv.date))+" "+esc(lv.at)) : "jamais vu"}</div>
      </button>
      ${open ? inlineForm(p) : ""}
    </div>`;
  }).join("") || `<p class="muted" style="grid-column:1/-1;text-align:center;padding:30px 0">${
    !S.patients.length ? "Aucun patient — crée le premier avec ＋"
    : !activeP().length ? "Tous les dossiers sont archivés (🗺️ → Archives)."
    : S.curTour!=="all" && !activeP().filter(inTour).length ? "Aucun patient dans la tournée « "+esc(S.curTour)+" » — assigne-les depuis leur fiche."
    : "Rien dans ce filtre."}</p>`;

  $$("[data-toggle]").forEach(b => b.onclick = () => {
    openId = openId === b.dataset.toggle ? null : b.dataset.toggle;
    render();
    if (openId){ const el=document.querySelector(`.pcard[data-id="${openId}"]`); el&&el.scrollIntoView&&el.scrollIntoView({behavior:"smooth",block:"start"}); }
  });
  if (openId){ const p = getP(openId); if (p) bindInline(p); }
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
      ${p.address ? `<button class="tool" data-gps="${p.id}" style="flex:1 1 30%" title="${esc(p.address)}">🗺️ GPS</button>` : ""}
      ${Object.keys(p.contacts||{}).length ? `<button class="tool" data-annuaire="${p.id}" style="flex:1 1 30%">📞 Appels</button>` : ""}
      <button class="tool" data-edit="${p.id}" style="flex:1 1 30%">✏️ Fiche</button>
    </div>
    ${shownInfos(p).map(it => { const T=infoType(it.type);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:7px 11px;margin-bottom:5px">${T.ic} ${esc(it.txt)}</div>`;
    }).join("")}
    ${S.slotsEnabled ? `<div class="chips" data-slotrow style="margin:6px 0">
      <button class="chip ${(_curSlot||defaultSlot())==="matin"?"on":""}" data-slot="matin" style="flex:1;justify-content:center">☀️ Matin</button>
      <button class="chip ${(_curSlot||defaultSlot())==="soir"?"on":""}" data-slot="soir" style="flex:1;justify-content:center">🌙 Soir</button>
    </div>
    <p class="small muted" data-slothint style="margin:0 0 8px">Ce que tu coches est attribué au passage sélectionné.</p>` : ""}
    <div class="chips" data-tagrow style="margin-top:2px">
      ${Object.entries(PATIENT_TAGS).map(([k,t])=>`<button class="chip ${(p.tags||[]).includes(k)?"on":""}" data-tag="${k}" style="font-size:12px">${t.ic} ${t.lbl}</button>`).join("")}
    </div>
    <div>
      <div class="lab" style="margin-bottom:3px">Soins réalisés <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(★ = plan de soins)</span></div>
      <div class="small muted" style="margin-bottom:7px">💡 Appui long sur un soin (ou tape ✏️) pour ajouter un commentaire du jour</div>
      <div class="chips" data-chips="1">
        ${(p.plan||[]).map(x=>`<button class="chip star" data-s="${esc(x)}">${esc(x)}${getSoinProtocol(x)?" 📋":""}</button>`).join("")}
        <button class="chip add" data-addsoin="1">＋ autre…</button>
      </div>
      <div style="margin-top:4px"><input class="plan-search" id="soin-srch-${p.id}" placeholder="🔍 Chercher un soin…" style="font-size:13px"></div>
      <div id="soin-srch-res-${p.id}" class="chips" style="min-height:0;margin-top:4px"></div>
    </div>
    <div>
      <div class="lab" style="margin-bottom:7px">Constantes (si mesurées)</div>
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
      <p class="alertline" data-al="1" style="margin-top:8px"></p>
      <div class="chips" style="margin-top:4px">
        <button class="chip" data-constrel style="font-size:12px">📤 Inclure dans la relève</button>
      </div>
      <p class="small muted" style="margin-top:3px">Les constantes sont toujours enregistrées dans l'historique du patient. Coche pour qu'elles figurent aussi dans la relève.</p>
    </div>
    <div>
      <div class="lab" style="margin-bottom:7px">Transmission <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— événements rapides</span></div>
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
    <div class="rowb">
      <button class="btn btn-ghost" data-cancel="1">Fermer</button>
      <button class="btn btn-primary" data-save="1">✓ Valider le passage</button>
    </div>
  </div>`;
}

let _soinNotes = {}; // commentaires par soin pour le passage en cours
let _curSlot = null;  // créneau courant du formulaire ("matin"/"soir") si activé
function _saveDraft(f, pid){
  if (!f) return;
  const soins = [...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s);
  const consts = {};
  f.querySelectorAll("[data-c]").forEach(i=>{ if(i.value.trim()) consts[i.dataset.c]=i.value.trim(); });
  const taS = f.querySelector("[data-ta-s]")?.value||"";
  const taD = f.querySelector("[data-ta-d]")?.value||"";
  const note = f.querySelector("[data-note]")?.value||"";
  const constRel = !!f.querySelector("[data-constrel].on");
  const dardOn = !!f._dardOn;
  _formDraft = { pid, soins, consts, taS, taD, note, soinNotes:{..._soinNotes}, constRel, dardOn };
}
function _restoreDraft(f, pid){
  if (!_formDraft || _formDraft.pid !== pid){ _soinNotes = {}; return; }
  const d = _formDraft;
  _soinNotes = { ...(d.soinNotes||{}) };
  // Restaurer les soins
  d.soins.forEach(sn => {
    let c = f.querySelector(`.chip[data-s="${CSS.escape(sn)}"]`);
    if (!c){
      c = document.createElement("button");
      c.className="chip on"; c.dataset.s=sn; c.textContent=sn;
      c.onclick=()=>{ c.classList.toggle("on"); _saveDraft(f,pid); };
      const addBtn = f.querySelector("[data-addsoin]");
      if (addBtn) f.querySelector("[data-chips]").insertBefore(c, addBtn);
    } else c.classList.add("on");
  });
  // Restaurer TA
  const taS=f.querySelector("[data-ta-s]"), taD=f.querySelector("[data-ta-d]");
  if (taS&&d.taS) taS.value=d.taS;
  if (taD&&d.taD) taD.value=d.taD;
  const taHid=f.querySelector("[data-c='ta']");
  if (taHid&&d.taS&&d.taD) taHid.value=d.taS+"/"+d.taD;
  // Restaurer autres constantes
  f.querySelectorAll("[data-c]").forEach(i=>{
    if(i.dataset.c!=="ta" && d.consts[i.dataset.c]) i.value=d.consts[i.dataset.c];
  });
  // Restaurer la note
  const noteEl=f.querySelector("[data-note]");
  if(noteEl&&d.note) noteEl.value=d.note;
}

function bindInline(p){
  const f = document.querySelector(`[data-form="${p.id}"]`);
  if (!f) return;
  // Restaurer le brouillon si on revient sur ce patient après un sous-écran
  _restoreDraft(f, p.id);
  const decorateChip = c => {
    const sn = c.dataset.s;
    const on = c.classList.contains("on");
    const base = sn + (getSoinProtocol(sn) ? " 📋" : "");
    // ✏️ visible sur les soins cochés (invite à commenter) · 💬 si un commentaire existe
    c.innerHTML = esc(base) + (_soinNotes[sn] ? ' <span style="opacity:.9">💬</span>' : (on ? ' <span style="opacity:.55">✏️</span>' : ""));
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
  f.querySelectorAll(".chip[data-s]").forEach(c => {
    decorateChip(c);
    let lpTimer = null, lpFired = false;
    c.onclick = (e) => {
      if (lpFired){ lpFired = false; return; } // ne pas toggler après un appui long
      // Tap sur le crayon/bulle → ouvrir le commentaire directement
      if (e.target.closest("span") && (c.classList.contains("on") || _soinNotes[c.dataset.s])){
        openSoinComment(c); return;
      }
      c.classList.toggle("on"); decorateChip(c); _saveDraft(f,p.id);
    };
    c.addEventListener("pointerdown", () => {
      lpFired = false;
      lpTimer = setTimeout(() => { lpFired = true; openSoinComment(c); }, 550);
    });
    ["pointerup","pointerleave","pointercancel"].forEach(ev =>
      c.addEventListener(ev, () => clearTimeout(lpTimer)));
  });
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

  f.querySelector("[data-addsoin]").onclick = () => {
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
      btn.onclick = () => btn.classList.toggle("on");
      f.querySelector("[data-chips]").insertBefore(btn, addBtn);
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
  f.querySelector("[data-mic]").onclick = e => { e.preventDefault(); dictate(f.querySelector("[data-note]"), f.querySelector("[data-mic]")); };
  // ── Tags de priorité ──
  f.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => {
    const k = b.dataset.tag;
    p.tags = p.tags || [];
    const i = p.tags.indexOf(k);
    if (i >= 0) p.tags.splice(i,1); else p.tags.push(k);
    b.classList.toggle("on", i < 0);
    save();
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
  f.querySelector("[data-cancel]").onclick = () => { _formDraft=null; _soinNotes={}; _curSlot=null; openId=null; render(); };
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
  const commitVisit = (silent) => {
    const soins = [...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s);
    const consts = {}; inputs.forEach(i => { if(i.value.trim()) consts[i.dataset.c]=i.value.trim(); });
    const note = f.querySelector("[data-note]").value.trim();
    if (!soins.length && !Object.keys(consts).length && !note){ if(!silent) toast("Rien à enregistrer."); return false; }
    const sNotes = {};
    soins.forEach(sn => { if (_soinNotes[sn]) sNotes[sn] = _soinNotes[sn]; });
    const constRel = !!f.querySelector("[data-constrel].on");
    const dardOn = !!f._dardOn;
    const _v = { uid:uid(), date:todayISO(), at:nowHM(), soins, consts, note,
      ...(S.slotsEnabled ? { slot:(_curSlot||defaultSlot()) } : {}),
      ...(Object.keys(sNotes).length ? { soinNotes:sNotes } : {}),
      ...(constRel ? { constRel:true } : {}),      // constantes à faire figurer dans la relève
      ...(dardOn ? { dar:true } : {}) };           // passage structuré DAR
    p.visits.push(_v);
    if (typeof logChange==="function") logChange("add","visit", p.id+"|"+_v.uid, _v);
    _soinNotes = {}; _formDraft = null;
    return true;
  };
  f._commitVisit = commitVisit; // exposé pour le mode séquentiel
  f.querySelector("[data-save]").onclick = () => {
    if (!commitVisit(false)) return;
    _curSlot = null;
    openId = null; save(); toast("Passage enregistré ✓"); render();
  };
  f.querySelector("[data-docs]").onclick = () => sheetDocs(p.id);
  f.querySelector("[data-bilans]").onclick = () => sheetBilans(p.id);
  f.querySelector("[data-raps]").onclick = () => sheetRappels(p.id);
  f.querySelector("[data-hist]").onclick = () => sheetHist(p.id);
  f.querySelector("[data-clone]").onclick = () => {
    // Pré-remplir avec le dernier passage
    const lastV = (p.visits||[]).slice().sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at))[0];
    const plan = p.plan||[];
    const soins = lastV ? lastV.soins : plan;
    // Cocher les soins
    f.querySelectorAll(".chip[data-s]").forEach(c=>c.classList.remove("on"));
    soins.forEach(s => {
      let c = f.querySelector(`.chip[data-s="${CSS.escape(s)}"]`);
      if (!c){ c=document.createElement("button"); c.className="chip on"; c.dataset.s=s; c.textContent=s;
        c.onclick=()=>c.classList.toggle("on");
        f.querySelector("[data-chips]").insertBefore(c, f.querySelector("[data-addsoin]")); }
      else c.classList.add("on");
    });
    // Pré-remplir la note
    const noteEl = f.querySelector("[data-note]");
    noteEl.value = "Soins conformes au plan habituel, état stable.";
    toast("Pré-rempli sur le dernier passage 🔁");
  };
  f.querySelector("[data-graph]").onclick = () => sheetGraphConstantes(p.id);
  const gpsBtn = f.querySelector("[data-gps]");
  if (gpsBtn) gpsBtn.onclick = () => {
    const addr = encodeURIComponent(p.address||"");
    window.open(`geo:0,0?q=${addr}`, "_system");
  };
  const annBtn = f.querySelector("[data-annuaire]");
  if (annBtn) annBtn.onclick = () => sheetAnnuaire(p);
  f.querySelector("[data-edit]").onclick = () => sheetPatient(p);
}

/* ---------- Feuilles génériques ---------- */


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
}
function closeSheet(){ $("#veil").classList.remove("on"); }
$("#veil").addEventListener("click", e => { if(e.target.id==="veil") closeSheet(); });


/* ---------- Choisir le type d'une information ----------
   Couche empilée au-dessus de la fiche : la feuille en cours n'est pas
   touchée, donc aucune saisie n'est perdue. */
function pickInfoType(current, cb){
  const old = document.getElementById("typepick");
  if (old) old.remove();
  const el = document.createElement("div");
  el.id = "typepick";
  el.className = "typepick";
  el.innerHTML = `<div class="tp-card">
    <div class="tp-h">Type d'information</div>
    <p class="small muted" style="margin:0 0 12px">Choisis la catégorie de cette information.</p>
    ${Object.entries(INFO_TYPES).map(([k,v])=>`
      <button class="typerow ${k===current?"on":""}" data-pt="${k}">
        <span class="tr-ic">${v.ic}</span>
        <span class="tr-body">
          <span class="tr-lbl">${esc(v.lbl)}</span>
          <span class="tr-sub">${esc(INFO_HINTS[k]||"")}</span>
        </span>
        ${k===current?'<span class="tr-ok">✓</span>':""}
      </button>`).join("")}
    <button class="btn btn-ghost" id="pt-cancel" style="width:100%;margin-top:10px">Annuler</button>
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
    <button class="btn btn-ghost" id="pec-back" style="margin-top:12px;width:100%">← Retour</button>`);
  $$("#sheet [data-pecopen]").forEach(b => b.onclick = () => sheetPatient(b.dataset.pecopen));
  $$("#sheet [data-pecdel]").forEach(b => b.onclick = () => supprimerPECDefinitif(b.dataset.pecdel));
  $("#pec-back").onclick = sheetTours;
}

/* Mois restants avant expiration de la conservation */
function pecMonthsLeft(p){
  if (!p.pec) return null;
  const end = new Date((p.pec.end||todayISO()) + "T12:00:00");
  end.setMonth(end.getMonth() + (p.pec.keepMonths||6));
  return Math.ceil((end - new Date()) / (30*864e5));
}

/* Suppression définitive — double validation */
function supprimerPECDefinitif(pid){
  const p = getP(pid); if (!p) return;
  const nom = p.prenom + " " + p.nom.replace("Demo-","").toUpperCase();
  const nv = (p.visits||[]).length, nd = (p.docs||[]).length;
  if (!confirm("Supprimer définitivement le dossier de " + nom + " ?\n\n" +
      nv + " passage(s) et " + nd + " document(s) seront effacés.\n" +
      "Le dossier ne passera PAS par la corbeille.")) return;
  // Deuxième validation
  if (!confirm("⚠ ÊTES-VOUS SÛR ?\n\nCette action est IRRÉVERSIBLE.\n" +
      "Le dossier de " + nom + " sera définitivement perdu.")) return;
  (p.docs||[]).forEach(d => { try { _rawDel("doc_" + d.id); } catch(e){} });
  S.patients = S.patients.filter(x => x.id !== pid);
  S.rappels  = (S.rappels||[]).filter(r => r.pid !== pid);
  if (typeof logChange === "function") logChange("delete","patient", pid);
  save(); closeSheet(); render(); toast("Dossier supprimé définitivement");
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
      ${row("arch","📦","Archives", archived.length)}
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
function bindMenuHandlers(){
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
  $$("#tourlist [data-deltour]").forEach(b => b.onclick = () => {
    const t = b.dataset.deltour;
    const n = S.patients.filter(p=>(p.tours||[]).includes(t)).length;
    if (!confirm("Supprimer la tournée « "+t+" » ?"+(n?" ("+n+" patient(s) en seront retirés — leurs dossiers sont conservés)":""))) return;
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
  $$("#retpick [data-ret]").forEach(b => b.onclick = () => {
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
  if (pinOn) pinOn.onclick = () => { closeSheet(); showLock("set"); };
  if (pinOff) pinOff.onclick = () => {
    if (!confirm("Désactiver le code de verrouillage ?")) return;
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
  $("#go-guide").onclick = () => { openSheet(`<h3>📖 Guide d'utilisation — JM@Santé</h3>
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
</div>
<button class="btn btn-ghost" id="guide-close" style="margin-top:12px">Fermer</button>`);
    const dlH = $("#guide-dl-html"); if (dlH) dlH.onclick = () => downloadManuel("html");
    const dlP = $("#guide-dl-pdf");  if (dlP) dlP.onclick = () => downloadManuel("pdf");
    { const _e = $("#guide-close"); if (_e) _e.onclick = sheetTours; }; }
  { const _e = $("#go-catalog"); if (_e) _e.onclick = sheetCatalog; }
  { const _e = $("#bk-imp"); if (_e) _e.onclick = () => $("#backupfile").click(); }
  { const _e = $("#go-arch"); if (_e) _e.onclick = sheetArchives; }
  { const _e = $("#go-clean"); if (_e) _e.onclick = sheetClean; }
}

/* ---------- Sous-écrans du menu ----------
   Chaque rubrique est un écran construit explicitement : plus fiable qu'un
   masquage dynamique, et chaque bloc reste lisible. Les gestionnaires sont
   posés par bindMenuHandlers(), commun à tous les écrans. */
function menuSheet(title, inner, sub){
  openSheet(`
    <button class="btn btn-ghost btn-sm" id="mf-back" style="margin-bottom:10px">‹ Réglages</button>
    <h3 style="margin-bottom:${sub?"2px":"12px"}">${title}</h3>
    ${sub?`<p class="small muted" style="margin-bottom:14px">${sub}</p>`:""}
    ${inner}`);
  $("#mf-back").onclick = sheetTours;
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
    <button class="btn btn-ghost" id="go-arch" style="width:100%;margin-bottom:8px">📦 Archives (${archived.length} dossier${archived.length>1?"s":""})</button>
    <button class="btn btn-ghost" id="go-trash" style="width:100%">🗑 Corbeille (${(S.trash||[]).length})</button>`,
    "Dossiers clôturés, archivés ou supprimés.");
}

/* 💾 Données */
function sheetDataPanel(){
  const days = S.lastBackup ? Math.floor((Date.now()-S.lastBackup)/864e5) : null;
  const warn = (days === null || days >= 7);
  menuSheet("💾 Mes données", `
    ${warn?`<div class="tip" style="border-color:var(--amber);background:var(--amber-soft);margin-bottom:12px">⚠ ${days===null?"Aucune sauvegarde n'a encore été faite.":"Dernière sauvegarde il y a "+days+" jours."} Pense à en faire une régulièrement.</div>`:""}
    <span class="lab" style="display:block;margin-bottom:8px">💾 Sauvegarde</span>
    <div class="rowb" style="margin-bottom:8px">
      <button class="btn btn-ghost" id="bk-save">💾 Enregistrer</button>
      <button class="btn btn-ghost" id="bk-exp">📤 Partager</button>
      <button class="btn btn-ghost" id="bk-imp">📂 Importer</button>
    </div>
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
    <button class="btn btn-ghost" id="go-sendlog" style="width:100%">📨 Journal des envois (${(S.sendLog||[]).length})</button>`);
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
    <button class="btn btn-ghost" id="go-clean" style="width:100%;margin-bottom:16px">🧹 Nettoyer l'historique</button>
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
    <h3>📦 Archives</h3>
    <p class="small muted" style="margin-bottom:10px">Dossiers conservés avec tout leur historique (passages, documents, bilans). Restaure un dossier pour le remettre en pancarte, ou supprime-le définitivement quand tu n'en as plus besoin.</p>
    <div id="archlist">${archived.map(p => `
      <div class="rap"><span class="ric">📦</span>
        <span style="flex:1"><div class="rt">${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</div>
        <div class="rs">archivé le ${esc(fmtFR(p.archived))} · ${p.visits.length} passage(s) · ${p.docs.length} doc(s) · ${(p.bilans||[]).length} bilan(s)</div></span>
        <button class="btn btn-ghost btn-sm" data-rest="${p.id}" style="flex:none">↩︎</button>
        <button class="btn btn-danger btn-sm" data-kill="${p.id}" style="flex:none">🗑</button>
      </div>`).join("") || `<p class="muted small" style="padding:8px 0">Aucun dossier archivé.</p>`}</div>
    <button class="btn btn-ghost" id="back-tours" style="margin-top:14px">‹ Retour aux tournées</button>`);
  $$("#archlist [data-rest]").forEach(b => b.onclick = () => {
    getP(b.dataset.rest).archived = null;
    save(); toast("Dossier restauré ↩︎"); sheetArchives(); render();
  });
  $$("#archlist [data-kill]").forEach(b => b.onclick = () => {
    const p = getP(b.dataset.kill);
    if (!confirm("Supprimer "+p.prenom+" "+p.nom+" ? Le dossier ira dans la corbeille (récupérable 30 jours).")) return;
    trashPatient(p.id);
    save(); toast("Dossier déplacé dans la corbeille 🗑"); sheetArchives(); render();
  });
  $("#back-tours").onclick = sheetTours;
}

function sheetClean(){
  const d90 = new Date(Date.now()-90*86400000).toISOString().slice(0,10);
  const count = before => S.patients.reduce((n,p)=>n+p.visits.filter(v=>v.date<before).length, 0);
  openSheet(`
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
  const isNew = !p;
  p = p || { nom:"", prenom:"", dob:"", ctx:"", plan:[] };
  openSheet(`
    <h3>${isNew?"Nouveau patient":"Fiche patient"}</h3>
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
    <div class="field"><span class="lab">Tournées</span>
      <div class="chips" id="f-tours">${S.tours.map(t =>
        `<button class="chip ${(p.tours||[]).includes(t)||(isNew&&S.curTour===t)?"on":""}" data-t="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
    <div class="field"><span class="lab">Adresse (pour GPS)</span>
      <input id="f-addr" placeholder="12 rue des Lilas, 13100 Aix-en-Provence" value="${esc(p.address||'')}"></div>
    <div class="field"><span class="lab">Contexte &amp; informations</span>
      <p class="small muted" style="margin-bottom:8px">Chaque information a son type et son interrupteur : <b>relève</b> = elle figure sur chaque relève de ce patient · <b>fiche</b> = consultable ici seulement.</p>
      <div id="f-infos"></div>
      <button class="btn btn-ghost" id="f-info-add" style="width:100%;margin-top:6px;border-style:dashed;font-size:13px">＋ Ajouter une information</button>
    </div>
    <div class="field">
      <span class="lab">Seuils d'alerte personnalisés <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(laisser vide = seuils globaux)</span></span>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[["ta_h","TA syst. haute","≥ "+SEUILS.ta_h+" cmHg"],["ta_b","TA syst. basse","≤ "+SEUILS.ta_b],["sat_b","Sat basse","< "+SEUILS.sat_b+"%"],["gl_b","Glycémie basse","≤ "+SEUILS.gl_b+" g/L"],["gl_h","Glycémie haute","≥ "+SEUILS.gl_h],["temp_h","Fièvre","≥ "+SEUILS.temp_h+"°C"]].map(([k,lbl,plh])=>
          `<div><div class="small muted" style="margin-bottom:3px">${lbl}</div>
          <input class="f-th" data-thk="${k}" placeholder="${plh}" value="${(p.thresholds||{})[k]||""}" inputmode="decimal" style="font-size:13px"></div>`).join("")}
      </div></div>
    <div class="field"><span class="lab">Annuaire d'urgence</span>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${[["med","🩺 Médecin traitant"],["fam","👨‍👩 Famille / Confiance"],["pharma","💊 Pharmacie"],["cabinet","🗺️ Cabinet titulaire"]].map(([k,lbl])=>`
        <div>
          <div class="small muted" style="margin-bottom:3px">${lbl}</div>
          <div style="display:flex;gap:4px">
            <input class="f-contact-name" data-ck="${k}" placeholder="Nom" value="${esc((p.contacts||{})[k]?.nom||'')}" style="flex:1;font-size:13px">
            <input class="f-contact-tel" data-ck="${k}" placeholder="Tél" value="${esc((p.contacts||{})[k]?.tel||'')}" style="width:110px;font-size:13px" inputmode="tel">
          </div>
        </div>`).join('')}
      </div></div>
    <div class="field"><span class="lab">Plan de soins <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(★ pré-proposé à chaque passage)</span></span>
      <div class="chips" id="f-plan" style="margin-bottom:8px">${(p.plan||[]).map(x=>
        `<button class="chip on" data-p="${esc(x)}">${esc(x)} ✕</button>`).join("")}</div>
      <div id="f-catalog-sugg" style="margin-bottom:8px"></div>
      <div style="display:flex;gap:8px">
        <input id="f-newplan" placeholder="Nouveau soin (libre)…">
        <button class="btn btn-ghost btn-sm" id="f-addplan" style="flex:none">＋</button>
      </div></div>
    <div class="rowb">
      <button class="btn btn-ghost" id="f-cancel">Annuler</button>
      <button class="btn btn-primary" id="f-save">${isNew?"Créer":"Enregistrer"}</button>
    </div>
    ${!isNew ? `<div class="rowb" style="margin-top:12px">
      <button class="btn btn-ghost btn-sm" id="f-export" style="flex:1">🖨️ Exporter la fiche</button>
      <button class="btn btn-ghost btn-sm" id="f-pec" style="flex:1">🎗️ Fin de prise en charge</button>
      <button class="btn btn-ghost btn-sm" id="f-arch" style="flex:1">📦 Archiver le dossier</button>
      <button class="btn btn-danger btn-sm" id="f-del" style="flex:1">Supprimer définitivement</button>
    </div>` : ""}`);
  $$("#f-tours .chip").forEach(c => c.onclick = () => c.classList.toggle("on"));
  $$("#f-genre [data-g]").forEach(c => c.onclick = () => { $$("#f-genre .chip").forEach(x=>x.classList.remove("on")); c.classList.add("on"); });
  const planList = () => [...$("#f-plan").querySelectorAll(".chip")].map(c=>c.dataset.p);
  const bindDel = () => $$("#f-plan .chip").forEach(c => c.onclick = () => c.remove());
  bindDel();

  /* Suggestions catalogue avec recherche */
  const addToPlan = v => {
    if (planList().includes(v)){ toast("Déjà dans le plan."); return; }
    const b = document.createElement("button");
    b.className="chip on"; b.dataset.p=v; b.textContent=v+" ✕";
    b.onclick=()=>{ b.remove(); refreshSugg(); };
    $("#f-plan").appendChild(b); refreshSugg();
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

  /* Ajout libre + offre de sauvegarde dans le catalogue global */
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
        <button class="info-ic" data-ityp="${i}" title="Changer le type">${T.ic}</button>
        <div class="info-body">
          <div class="info-lbl" style="color:${it.show?T.col:"var(--faint)"}">${esc(T.lbl)}</div>
          <textarea class="info-txt" data-itxt="${i}" rows="1" placeholder="${esc(T.ph)}">${esc(it.txt||"")}</textarea>
        </div>
        <div class="info-sw">
          <button class="sw ${it.show?"on":""}" data-ishow="${i}" title="Afficher dans la relève"><span></span></button>
          <span class="sw-l" style="color:${it.show?T.col:"var(--faint)"}">${it.show?"relève":"fiche"}</span>
          <button class="info-del" data-idel="${i}" title="Supprimer">✕</button>
        </div>
      </div>`;
    }).join("") : `<p class="small muted" style="padding:6px 0">Aucune information. Ajoute le code d'accès, une vigilance, des antécédents…</p>`;

    box.querySelectorAll("[data-itxt]").forEach(t => {
      const auto = () => { t.style.height="auto"; t.style.height=Math.min(t.scrollHeight+2,140)+"px"; };
      auto();
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
    infos.push({ id:uid(), type:"acces", txt:"", show:true });
    drawInfos();
    const last = $("#f-infos").querySelector("[data-itxt]:last-of-type");
    setTimeout(()=>{ const ts=$$("#f-infos [data-itxt]"); if(ts.length) ts[ts.length-1].focus(); }, 60);
  };
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
      address: ($("#f-addr")?.value||"").trim(),
      thresholds: Object.keys(thresholds).length ? thresholds : undefined,
      contacts,
      infos: infos.filter(i => (i.txt||"").trim()).map(i => ({ ...i, txt:i.txt.trim() })),
      ctx: (infos.find(i=>i.type==="atcd")?.txt || "").trim(),   // compat ascendante
      plan:planList(),
      tours: $$("#f-tours .chip.on").map(c=>c.dataset.t) };
    if (isNew){
      const np = { id:uid(), docs:[], visits:[], bilans:[], archived:null, ...data };
      S.patients.push(np);
      if (typeof logChange==="function") logChange("add","patient", np.id, np);
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
  };
  if (!isNew){
    const fExp = $("#f-export");
    if (fExp) fExp.onclick = () => sheetExportFiche(p.id);
    const fPec = $("#f-pec");
    if (fPec) fPec.onclick = () => sheetFinPEC(p.id);
    $("#f-arch").onclick = () => {
      if (!confirm("Archiver le dossier de "+p.prenom+" "+p.nom+" ?\nSes données (passages, documents, bilans) restent conservées dans les Archives (🗺️), d'où tu pourras le restaurer ou le supprimer définitivement.")) return;
      p.archived = todayISO();
      if (typeof logChange==="function") logChange("update","patient", p.id, { archived:p.archived });
      if (openId===p.id) openId=null;
      save(); closeSheet(); toast("Dossier archivé 📦"); render();
    };
    $("#f-del").onclick = () => {
      if (!confirm("Supprimer "+p.prenom+" "+p.nom+" ? Le dossier ira dans la corbeille (récupérable 30 jours).")) return;
      trashPatient(p.id);
      if (openId===p.id) openId=null;
      save(); closeSheet(); toast("Dossier déplacé dans la corbeille 🗑"); render();
    };
  }
}

/* ---------- Documents (photos / PDF) ---------- */
let docTargetPid = null;
function sheetDocs(pid){
  const p = getP(pid);
  openSheet(`
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
}

/* ---------- Choisir la provenance du document ---------- */
function sheetAddDoc(pid, replaceId){
  const SRC = [
    ["camerafile",  "📷", "Photo",   "Prendre maintenant"],
    ["galleryfile", "🖼️", "Galerie", "Photo existante"],
    ["docfile",     "📄", "PDF",     "Ordonnance, bilan"],
    ["wordfile",    "📝", "Word",    "Modifiable"]
  ];
  openSheet(`
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
    <button class="btn btn-ghost" id="src-cancel" style="width:100%;margin-top:12px">Annuler</button>`);
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
function renderDocs(pid){
  const p = getP(pid);
  const box = $("#doclist");
  if (!box) return;
  box.innerHTML = p.docs.map(d => {
    const age = docAgeMonths(d);
    return `
    <div class="doc" data-open="${d.id}">
      ${d.mime&&d.mime.startsWith("image/") ? `<img id="dthumb-${esc(d.id)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : `<span class="ic">${docIcon(d)}</span>`}
      <span class="dn">${esc(d.name.length>22?d.name.slice(0,22)+"…":d.name)}</span>
      <button class="rep" data-repdoc="${d.id}" title="Remplacer (validité remise à zéro)">🔁</button>
      <button class="del" data-deldoc="${d.id}" title="Supprimer">✕</button>
      <span class="dd ${age>=3?"old":""}">${age>=3?"⚠ ":""}${esc(fmtFR(d.date))}${age>=1?" · "+age+" mois":""}</span>
    </div>`;
  }).join("") || `<p class="muted small" style="grid-column:1/-1;text-align:center;padding:14px 0">Aucun document.</p>`;
  box.querySelectorAll("[data-open]").forEach(el => el.onclick = e => {
    if (e.target.closest("[data-deldoc]") || e.target.closest("[data-repdoc]")) return;
    const d = p.docs.find(x=>x.id===el.dataset.open);
    viewDoc(d);
  });
  box.querySelectorAll("[data-deldoc]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    if (!confirm("Supprimer ce document ?")) return;
    p.docs = p.docs.filter(x=>x.id!==b.dataset.deldoc);
    save(); renderDocs(pid); render();
  });
  box.querySelectorAll("[data-repdoc]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    docTargetPid = pid; docReplaceId = b.dataset.repdoc;
    // Choisir le picker selon le type du document à remplacer
    const existing = p.docs.find(x=>x.id===b.dataset.repdoc);
    const isImg = existing && existing.mime && existing.mime.startsWith("image/");
    if (isImg){
      // Proposer galerie ou photo
      const choice = confirm("Prendre une nouvelle photo ? (Annuler = choisir dans la galerie)");
      (choice ? $("#camerafile") : $("#galleryfile")).click();
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
      <h3>${repId ? "Remplacer le document" : "Ajouter un document"}</h3>
      <div class="doc-prev-wrap">
        ${isImg
          ? `<img src="${dataUrl}" alt="prévisualisation">`
          : `<div class="pdf-ico">📄</div>`}
      </div>
      <p style="font-weight:600;margin-bottom:4px">${esc(finalName)}</p>
      <p class="doc-meta">Taille stockée : ~${sizeMo} Mo</p>
      <div class="rowb" style="margin-top:16px">
        <button class="btn btn-ghost" id="doc-cancel" style="flex:1">✕ Annuler</button>
        <button class="btn btn-primary" id="doc-ok" style="flex:1">✓ ${repId ? "Remplacer" : "Ajouter"}</button>
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
        // Stocker les données brutes dans IDB séparée (évite la saturation du state chiffré)
        idbSet("doc_"+docId, dataUrl).then(()=>{
          const _d={ id:docId, name:finalName, mime:finalMime, date:todayISO() };
          p.docs.push(_d);
          if(typeof logChange==="function") logChange("add","doc", pid+"|"+docId, _d);
          save(); renderDocs(pid); toast(finalName+" ajouté 📎");
        }).catch(e=>{ toast("Échec stockage doc : "+e.message); });
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

function viewDoc(d){
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
        <p style="color:#9fb0ab;font-size:13px;line-height:1.55;margin:0 0 20px;max-width:290px;margin-inline:auto">
          La fiche mentionne « ${esc(d.name)} » mais son contenu n'est plus sur cet appareil.
          Cela arrive si le document vient d'une sauvegarde ou d'une synchro : seules les
          références sont transmises, pas les fichiers eux-mêmes.</p>
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
        <p style="color:#9fb0ab;font-size:12.5px;margin:0 0 22px">${d.date?fmtFR(d.date):""}${d.date?" · ":""}${docSizeLabel(data)}</p>
        <p style="color:#8a9a95;font-size:12.5px;line-height:1.5;margin:0 0 20px;max-width:280px;margin-inline:auto">
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
      <p style="color:#fff;font-size:15px;margin:0 0 18px">Impossible d'ouvrir le document.<br><small style="color:#9fb0ab">${esc(e.message||"")}</small></p>
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

function sheetRappels(pid){
  const p = pid ? getP(pid) : null;
  const list = S.rappels
    .filter(r => (!pid || r.pid===pid) && (!r.pid || !(getP(r.pid)||{}).archived))
    .sort((a,b) => (a.done?1:0)-(b.done?1:0) || String(a.due).localeCompare(String(b.due)));
  openSheet(`
    <h3>📌 Rappels${p ? " — "+esc(p.prenom)+" "+esc(p.nom.replace("Demo-","").toUpperCase()) : ""}</h3>
    <div id="raplist">${list.map(r => {
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
    }).join("") || `<p class="muted small" style="padding:10px 0">Aucun rappel.</p>`}</div>
    <p class="small muted" style="margin-top:8px">Tape un rappel pour le modifier ou le prolonger. Les échéances s'activent de J-3 au jour J.</p>
    <button class="btn btn-primary" id="r-new" style="margin-top:10px">＋ Nouveau rappel</button>`);
  $$("#raplist [data-editrap]").forEach(b => b.onclick = () => sheetEditRappel(pid, b.dataset.editrap));
  $$("#raplist [data-rchk]").forEach(b => b.onclick = () => {
    const r = S.rappels.find(x=>x.id===b.dataset.rchk);
    r.done = !r.done; if(typeof logChange==="function") logChange("update","rappel", r.id, { done:r.done }); save(); sheetRappels(pid); render();
  });
  $$("#raplist [data-delrap]").forEach(b => b.onclick = () => {
    if (!confirm("Supprimer ce rappel ?")) return;
    if(typeof logChange==="function") logChange("delete","rappel", b.dataset.delrap); S.rappels = S.rappels.filter(x=>x.id!==b.dataset.delrap);
    save(); sheetRappels(pid); render();
  });
  $("#r-new").onclick = () => sheetEditRappel(pid, null);
}
function sheetNewRappel(pid){ sheetEditRappel(pid, null); }
function sheetEditRappel(backPid, rapId){
  const r = rapId ? S.rappels.find(x=>x.id===rapId) : null;
  openSheet(`
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
    <div class="rowb">
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
    save(); sheetRappels(backPid); render();
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
    <button class="btn btn-ghost" id="tr-back" style="margin-top:12px;width:100%">← Retour</button>`);
  $$("#sheet [data-restore]").forEach(b => b.onclick = () => {
    const t = S.trash[+b.dataset.restore];
    S.patients.push(t.patient);
    S.rappels.push(...(t.rappels||[]));
    S.trash.splice(+b.dataset.restore, 1);
    save(); render(); sheetTrash(); toast(t.patient.prenom+" restauré ↩︎");
  });
  $$("#sheet [data-purge]").forEach(b => b.onclick = () => {
    const t = S.trash[+b.dataset.purge];
    if (!confirm("Effacer DÉFINITIVEMENT "+t.patient.prenom+" "+t.patient.nom+" ? Action irréversible.")) return;
    // Purger aussi les documents stockés en base
    (t.patient.docs||[]).forEach(d => idbDel("doc_"+d.id).catch(()=>{}));
    S.trash.splice(+b.dataset.purge, 1);
    save(); sheetTrash(); toast("Dossier effacé définitivement");
  });
  $("#tr-back").onclick = sheetTours;
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
      <button class="btn btn-ghost" id="php-close">Fermer</button>
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
  $("#php-close").onclick = closeSheet;
}

/* ---------- Gestion du catalogue de phrases ---------- */
function sheetPhrases(backPid){
  const cats = S.phraseCats || [];
  openSheet(`
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
    <button class="btn btn-primary" id="ph-add" style="margin-top:10px;width:100%">＋ Ajouter au catalogue</button>
    <button class="btn btn-ghost" id="ph-back" style="margin-top:8px;width:100%">← Retour</button>`);
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
  $("#ph-back").onclick = () => backPid ? sheetPhrasePicker(backPid) : sheetTours();
}

/* ---------- Journal des envois ---------- */
function sheetSendLog(){
  const log = S.sendLog || [];
  const fmtLbl = { txt:"🗒️ Texte", pdf:"📑 PDF", html:"🌐 HTML", docx:"📝 Word" };
  openSheet(`
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
    </div>
    <button class="btn btn-ghost" id="sl-back" style="margin-top:12px;width:100%">← Retour</button>`);
  $$("#sheet [data-resend]").forEach(b => b.onclick = () => {
    const e = (S.sendLog||[])[+b.dataset.resend];
    if (!e || !e.text){ toast("Texte non conservé pour cet envoi."); return; }
    showReport(e.text, { tour:S.curTour, start:todayISO(), end:todayISO() });
  });
  $("#sl-back").onclick = sheetTours;
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

function sheetBilans(pid){
  const p = getP(pid);
  const list = [...p.bilans].sort((a,b) =>
    (BILAN_STATUTS.indexOf(a.statut)-BILAN_STATUTS.indexOf(b.statut)) || String(a.date).localeCompare(String(b.date)));
  openSheet(`
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
    }).join("") || `<p class="muted small" style="padding:10px 0">Aucun bilan ni RDV.</p>`}</div>
    <button class="btn btn-primary" id="b-new" style="margin-top:14px">＋ Nouveau bilan / RDV</button>`);
  $$("#billist [data-cycle]").forEach(btn => btn.onclick = () => {
    const b = p.bilans.find(x=>x.id===btn.dataset.cycle);
    b.statut = BILAN_STATUTS[(BILAN_STATUTS.indexOf(b.statut)+1) % BILAN_STATUTS.length];
    if(typeof logChange==="function") logChange("update","bilan", pid+"|"+b.id, { statut:b.statut });
    syncBilanRappel(pid, b);
    save(); sheetBilans(pid); render();
  });
  $$("#billist [data-delbil]").forEach(btn => btn.onclick = () => {
    if (!confirm("Supprimer ce bilan ?")) return;
    removeBilanRappel(btn.dataset.delbil);
    if(typeof logChange==="function") logChange("delete","bilan", pid+"|"+btn.dataset.delbil); p.bilans = p.bilans.filter(x=>x.id!==btn.dataset.delbil);
    save(); sheetBilans(pid); render();
  });
  $("#b-new").onclick = () => sheetNewBilan(pid);
}
function sheetNewBilan(pid){
  openSheet(`
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
    <div class="rowb">
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
    save(); toast("Bilan ajouté 🧪" + (nb.statut==="À faire"&&nb.date ? " + rappel créé 📌" : "")); sheetBilans(pid); render();
  };
}

/* ---------- Historique patient ---------- */
function sheetHist(pid){
  const p = getP(pid);
  const vs = [...p.visits].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at));
  openSheet(`
    <h3>🕐 Historique — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
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
  $$("#sheet [data-delv]").forEach(b => b.onclick = () => {
    if (!confirm("Supprimer ce passage ?")) return;
    p.visits = p.visits.filter(v=>v.uid!==b.dataset.delv);
    save(); sheetHist(pid); render();
  });
}

/* ---------- RELÈVE PAR PÉRIODE : 3 modes ---------- */
function isEvent(v){ return alertes(v.consts).length > 0 || (v.note && v.note.trim() !== ""); }

/* ============================================================
   [CATALOGUE] Gestion du catalogue des soins
============================================================ */
function sheetCatalog(){
  const cats = getCatalogCats();
  openSheet(`
    <h3>📋 Catalogue des soins</h3>
    <input id="cat-srch" class="plan-search" placeholder="🔍 Rechercher un soin…">
    <div id="cat-list" class="cat-results">
      ${cats.map(c=>`
      <div class="cat-section" data-cat="${esc(c.cat)}">
        <div class="cat-head">${esc(c.icon)} ${esc(c.cat)}</div>
        ${c.soins.map(s=>`
        <div class="cat-soin" data-orig="${esc(s.orig)}">
          <span class="cat-nom">${esc(s.nom)}</span>
          ${s.proto?'<span class="cat-proto-ic" title="Protocole défini">📋</span>':''}
          <button class="cat-prot" data-prot="${esc(s.orig)}" title="Modifier le protocole">📋</button>
          <button class="cat-edit" data-orig="${esc(s.orig)}" data-nom="${esc(s.nom)}" title="Renommer">✏️</button>
        </div>`).join("")}
      </div>`).join("")}
    </div>
    <button class="btn btn-ghost" id="cat-add" style="margin-top:14px">＋ Ajouter un soin</button>
    <button class="btn btn-ghost" id="cat-back" style="margin-top:8px">← Retour</button>`);

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
  $("#cat-back").onclick = sheetTours;
}

/* ---------- Nouveau soin (catégorie au choix / création) ---------- */
function sheetNewSoin(){
  const customCats = S.catalog.customCats || [];
  openSheet(`
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
    <div class="rowb">
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
    <h3>✏️ Renommer un soin</h3>
    <div class="field"><span class="lab">Nom actuel</span>
      <p class="small muted">${esc(cur)}</p></div>
    <div class="field"><span class="lab">Nouveau nom</span>
      <input id="rn-nom" value="${esc(cur)}"></div>
    <div class="rowb">
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
    openSheet(`<h3>👥 ${esc(tourName)}</h3>
      <p class="muted small" style="padding:16px 0">Aucun patient créé. Crée d'abord un dossier patient.</p>
      <button class="btn btn-ghost" id="ap-back">← Retour</button>`);
    $("#ap-back").onclick = sheetTours; return;
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
      <button class="btn btn-ghost" id="ap-back">← Retour</button>
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
  $("#ap-back").onclick = sheetTours;
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
    <h3>📞 Annuaire — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    ${cats.filter(x=>c[x.k]).map(x=>`
    <div class="rap" style="align-items:center">
      <div style="flex:1">
        <div class="rt">${x.lbl}</div>
        <div class="rs">${esc(c[x.k].nom||"")}${c[x.k].tel?" — "+esc(c[x.k].tel):""}</div>
      </div>
      ${c[x.k].tel?`<a href="tel:${esc(c[x.k].tel)}" class="btn btn-primary" style="padding:8px 16px;text-decoration:none;border-radius:12px">📞 Appeler</a>`:""}
    </div>`).join("")}
    ${!cats.some(x=>c[x.k]) ? `<p class="muted small" style="padding:16px 0;text-align:center">Aucun contact — ajoute-les dans la fiche ✏️.</p>` : ""}
    <button class="btn btn-ghost" id="ann-back" style="margin-top:14px">← Retour</button>`);
  $("#ann-back").onclick = closeSheet;
}


/* ===== engine.js ===== */
function sheetReleve(){
  const t = todayISO();
  openSheet(`
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
      const com = (v.soins||[]).filter(x=>sn[x]);
      const hp  = (v.soins||[]).filter(x=>!plan.includes(x) && !sn[x]);
      if ((v.soins||[]).some(x=>plan.includes(x))) planTenu = true;
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
      if (p.pec && !p.archived && p.pec.end >= start && p.pec.end <= end && !pool.some(x=>x.id===p.id))
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
    const commentes = (v.soins||[]).filter(x => sn[x]);
    const horsPlan  = (v.soins||[]).filter(x => !plan.includes(x) && !sn[x]);
    const duPlan    = (v.soins||[]).filter(x => plan.includes(x));
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
      if (mode==="events" && vs.length) routines.push(anon ? anonName(p) : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom+" ("+vs.length+" passage"+(vs.length>1?"s":"")+")");
      return;
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
    if ((p.tags||[]).length) body += "🏷️ " + p.tags.map(t=>PATIENT_TAGS[t]?PATIENT_TAGS[t].ic+" "+PATIENT_TAGS[t].lbl:t).join(" · ") + "\n";

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
      const plan = p.plan || [];
      const moment = v => {
        const d = fmtFR(v.date);
        const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
        return d + sl;
      };
      let planTenu = false;
      const evenements = [];

      shown.forEach(v => {
        const sn = v.soinNotes || {};
        const commentes = (v.soins||[]).filter(x => sn[x]);
        const horsPlan  = (v.soins||[]).filter(x => !plan.includes(x) && !sn[x]);
        const duPlan    = (v.soins||[]).filter(x => plan.includes(x));
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
    const raps = S.rappels.filter(r=>!r.done && (!r.pid || poolIds.has(r.pid)))
      .sort((a,b)=>String(a.due).localeCompare(String(b.due)));
    if (raps.length){
      rapBlock = "📌 À PRÉVOIR / RAPPELS\n" + raps.map(r => {
        const rp = r.pid ? getP(r.pid) : null;
        const cd = rapCountdown(r);
        const cdTxt = cd.txt ? " [" + (cd.cls==="past"?"⚠ ":"") + cd.txt + "]" : "";
        return "  · " + rapType(r.type).lbl + (rp?" ["+(anon?anonName(rp):rp.nom.replace("Demo-","").toUpperCase())+"]":" [tournée]") +
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

function showReport(text, opts, keepExtras){
  // Nouvelle relève → message et signature repartent à zéro.
  // keepExtras=true → simple réaffichage après ajout d'un message/signature.
  if (!keepExtras){ _finalMsg = ""; _sigData = null; }
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

  let fmt = "txt";
  const checked = new Set();

  openSheet(`
    <h3>📤 Envoyer la relève</h3>
    <div class="rp-rich" id="rp-preview">${richPreview(text)}</div>
    <textarea id="rp-edit" style="display:none;width:100%;min-height:30vh;font-family:monospace;font-size:12px">${esc(text)}</textarea>
    <button class="chip" id="rp-editbtn" style="margin-top:6px;font-size:12px">✏️ Modifier le texte avant envoi</button>
    <div class="field" style="margin-top:10px">
      <span class="lab">Format</span>
      <div class="chips" id="fmt-chips">
        <button class="chip on" data-fm="txt">🗒️ Texte</button>
        <button class="chip" data-fm="pdf">📑 PDF <span class="small muted">(photos intégrées)</span></button>
        <button class="chip" data-fm="html">🌐 HTML <span class="small muted">(photos intégrées)</span></button>
        <button class="chip" data-fm="docx">📝 Word</button>
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
            ${g.items.map(({i,d})=>`<button class="selv" data-att="${i}">
              <span class="box"></span>
              <span class="sv">${/^image\//.test(d.mime||"")?"🖼":"📄"} ${esc(d.name)}${d.date?` <span class="small muted">${fmtFR(d.date)}</span>`:""}</span>
            </button>`).join("")}
          </div>`).join("")}
      </div></div>` : ""}
    <button class="btn btn-primary" id="rp-send" style="width:100%;margin-top:12px;font-size:15px">
      📤 Envoyer<span id="rp-count"></span>
    </button>
    <div class="rowb" style="margin-top:8px;gap:8px">
      <button class="btn btn-ghost" id="rp-save" style="flex:1">💾 Enregistrer</button>
      <button class="btn btn-ghost" id="rp-sig"  style="flex:1">${_sigData?"✍️ Signé ✓":"✍️ Signer"}</button>
      <button class="btn btn-ghost" id="rp-msg"  style="flex:1">${_finalMsg?"💬 Message ✓":"💬 Message"}</button>
    </div>
    <button class="btn btn-ghost" id="rp-close" style="margin-top:8px;width:100%">Fermer</button>`);

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
      doc.text("RELEVE INFIRMIERE - JM@Sante", M, 9); doc.setTextColor(0,0,0);
      doc.setFont("helvetica","bold"); doc.setFontSize(13); doc.setTextColor(255,255,255);
      doc.text("ANNEXES", M, 9); doc.setTextColor(0,0,0); y=22;

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
      const autoMsg="Releve JM@Sante - "+tourLbl+" - "+dateLbl+"\n"+st+"\n\n> "+fmtHint;
      await shareFiles([main,...atts], "Relève JM@Santé", autoMsg);
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
    else if (_lastReport) setTimeout(() => showReport(_lastReport.text, _lastReport.opts, true), 60);
    toast(sig ? "Signature ajoutée aux documents ✓" : "Signature retirée");
  });

  // ── 💬 Message de fin de relève ──
  $("#rp-msg").onclick = () => {
    openSheet(`
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
      closeSheet();
      if (_lastReport){
        const o = _lastReport.opts || {};
        let txt = _lastReport.text;
        try { if (o.regen) txt = o.regen(); } catch(e){}
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

  $("#rp-close").onclick = closeSheet;
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
  const file = new File([html], "Feuille_route_"+(tour==="all"?"toutes":tour).replace(/\s+/g,"_")+"_"+todayISO()+".html", { type:"text/html" });
  await shareFiles([file], "Feuille de route", "Feuille de route "+(tour==="all"?"":tour)+" — "+fmtFR(todayISO())+"\nOuvrir dans Chrome puis Imprimer pour la version papier.");
}

/* ---------- Gestionnaire global des boutons [data-a] ---------- */
document.addEventListener("click", e => {
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
      if (confirm("Charger les données de démonstration ?")){ seedDemo(); save(); render(); }
      break;
    case "wipe":
      if (confirm("Effacer TOUTES les données ? Cette action est irréversible.")){ S=defaultState(); save(); render(); }
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
  fr.srcdoc = html;

  const close = () => el.remove();
  el.querySelector("#fp-back").onclick = close;
  el.querySelector("#fp-print").onclick = () => {
    try {
      const w = fr.contentWindow;
      w.focus(); w.print();
      toast("Choisis « Enregistrer en PDF » dans la boîte d'impression 📑");
    } catch(e){ toast("Impression indisponible — utilise « Partager »", "danger"); }
  };
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
      ${p.address?`<tr><td>Adresse</td><td>${esc(p.address)}</td></tr>`:""}
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
    if (p.address) o += "Adresse : " + p.address + "\n";
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
    openSheet(`<h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune constante enregistrée sur les 90 derniers jours.</p>
      <button class="btn btn-ghost" id="gcl">← Retour</button>`);
    $("#gcl").onclick = closeSheet; return;
  }

  let selKey = available[0].key;
  const render = () => {
    const def = CONST_DEFS.find(d=>d.key===selKey);
    const pts = extractConstValues(recent, selKey);
    const stat = pts.length ? `Dernière : ${pts[pts.length-1].val} ${def.unit} (${fmtFR(pts[pts.length-1].date)}) · ${pts.length} mesure(s)` : "";
    const chips = available.map(d=>`<button class="chip ${d.key===selKey?"on":""}" data-gk="${esc(d.key)}">${esc(d.lbl)}</button>`).join("");
    openSheet(`
      <h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <div class="chips" style="margin-bottom:10px">${chips}</div>
      ${buildConstSvg(pts, def)}
      ${stat?`<p class="small muted" style="text-align:center;margin-top:4px">${esc(stat)}</p>`:""}
      <button class="btn btn-ghost" id="gcl" style="margin-top:14px">← Retour</button>`);
    $$("#sheet [data-gk]").forEach(b=>b.onclick=()=>{ selKey=b.dataset.gk; render(); });
    $("#gcl").onclick = closeSheet;
  };
  render();
}

/* ============ GALERIE CHRONOLOGIQUE ============ */
function sheetGalerie(pid){
  const p = getP(pid);
  const photos = (p.docs||[]).filter(d=>d.mime&&d.mime.startsWith("image/"))
    .slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if (!photos.length){
    openSheet(`<h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune photo dans ce dossier.</p>
      <button class="btn btn-ghost" id="gal-back">← Retour</button>`);
    $("#gal-back").onclick = ()=>sheetDocs(pid); return;
  }
  openSheet(`
    <h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    <p class="small muted" style="margin-bottom:10px">${photos.length} photo(s) — ordre chronologique</p>
    <div class="chrono-grid">
      ${photos.map(d=>`
      <div class="chrono-item" data-gopen="${esc(d.id)}">
        <img src="${d.data}" alt="${esc(d.name)}" loading="lazy">
        <span class="chrono-date">${esc(fmtFR(d.date))}</span>
      </div>`).join("")}
    </div>
    <button class="btn btn-ghost" id="gal-back" style="margin-top:14px">← Retour</button>`);
  $$("#sheet [data-gopen]").forEach(el=>el.onclick=()=>viewDoc(p.docs.find(d=>d.id===el.dataset.gopen)));
  $("#gal-back").onclick = ()=>sheetDocs(pid);
}

/* ============ RECHERCHE GLOBALE ============ */
function sheetSearch(){
  openSheet(`
    <h3>🔍 Recherche</h3>
    <input id="srch-in" placeholder="Patient, soin, note, bilan, rappel…" autofocus style="margin-bottom:12px">
    <div id="srch-res" style="max-height:60vh;overflow-y:auto"></div>
    <button class="btn btn-ghost" id="srch-close" style="margin-top:12px">Fermer</button>`);

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
                     : p.archived ? "📦 Dossier archivé" : (p.ctx||"Fiche patient");
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
  $("#srch-close").onclick = closeSheet;
  doSearch("");
}

/* ============ LOG D'ERREURS ============ */
(function setupErrorLog(){
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
      <button class="btn btn-ghost" id="bt-close">Fermer</button>
      <button class="btn btn-primary" id="bt-releve">📝 Générer la relève</button>
    </div>`);
  $("#bt-close").onclick = closeSheet;
  $("#bt-releve").onclick = () => { closeSheet(); sheetReleve(); };
}

/* ---------- Dictée rapide (FAB) ---------- */
function sheetQuickDictate(){
  const pool = activeP().filter(inTour);
  openSheet(`
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
    save(); closeSheet(); render();
    toast("Note ajoutée à " + p.prenom + " ✓");
  });
  $("#qd-close").onclick = closeSheet;
}


/* ---------- Écran de bienvenue (premier lancement) ---------- */
function sheetWelcome(){
  openSheet(`
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
function terminerTournee(){
  const slot = (typeof activeSlot==="function") ? activeSlot() : null;
  const slotLbl = slot ? (slot==="matin" ? "du matin ☀️" : "du soir 🌙") : "";
  if (!confirm("Terminer la tournée "+slotLbl+" ?\nCela clôt la journée en cours pour cette tournée.")) return;
  endTourneeGreeting();
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


/* ===== seq.js ===== */
/* ============================================================
   SEQ.JS — Mode tournée séquentielle + Signature + Notifications
============================================================ */

/* ============ MODE TOURNÉE SÉQUENTIELLE ============ */
let seqActive = false, seqIdx = 0, seqPool = [];

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
  seqIdx  = 0;
  seqActive = true;
  document.querySelector("[data-a='seq']").textContent = "⏹";
  document.querySelector("[data-a='seq']").title = "Quitter le mode tournée";
  document.getElementById("board").style.display = "none";
  document.getElementById("synth").style.display = "none";
  document.getElementById("filters").style.display = "none";
  document.querySelector(".footer-note").style.display = "none";
  renderSeq();
}

function exitSeqMode(){
  seqActive = false;
  document.querySelector("[data-a='seq']").textContent = "▶";
  document.querySelector("[data-a='seq']").title = "Mode tournée séquentiel";
  document.getElementById("board").style.display = "";
  document.getElementById("synth").style.display = "";
  document.getElementById("filters").style.display = "";
  document.querySelector(".footer-note").style.display = "";
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
  bindInline(p);
  const seqForm = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;

  // Valide le passage courant (soins cochés, constantes, note, créneau) puis exécute cb
  const commitThen = cb => {
    const form = fwrap.querySelector("[data-form]") || fwrap.firstElementChild;
    const saved = form && form._commitVisit ? form._commitVisit(true) : false;
    if (saved){ save(); toast("Passage de " + p.prenom + " enregistré ✓"); }
    cb();
  };
  // « Pas de passage prévu » : on avance sans rien enregistrer → rien dans la relève
  const skipBtn = document.getElementById("sq-skip");
  if (skipBtn) skipBtn.onclick = () => {
    _formDraft = null; _soinNotes = {};   // on jette la saisie éventuelle
    // Trace du jour : le patient n'est ni « à voir » ni « vu ».
    // Aucun passage créé → rien dans la relève.
    S.noVisit = S.noVisit || {};
    S.noVisit[p.id] = todayISO();
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
      else { toast("Fin de la tournée — passages enregistrés ✓"); exitSeqMode(); }
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
function receiveSyncFile(text){
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
    if (!confirm("Cette synchro concerne des patients que tu n'as pas encore.\n\n" +
      "Une synchro ne transmet que les CHANGEMENTS, pas les dossiers eux-mêmes.\n" +
      "Demande plutôt à ton collègue une SAUVEGARDE complète (💾) pour partir de la même base.\n\n" +
      "Continuer quand même ?")) return;
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
    const mine  = owner && (owner.docs||[]).find(x => x.name === d.name);
    return { ...d, ownerName: owner ? owner.prenom+" "+owner.nom.replace("Demo-","").toUpperCase() : "?",
             clash: mine || null };
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
            <b>${docIcon(d)} ${esc(d.name)}</b>
            <div class="rs">${esc(d.ownerName)} · ${d.date?fmtFR(d.date):"sans date"} · ${ko>1024?(ko/1024).toFixed(1)+" Mo":ko+" Ko"}</div>
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
function sheetSyncHistory(){
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
  $$("#sheet [data-restore-sync]").forEach(b => b.onclick = () => {
    const idx = +b.getAttribute("data-restore-sync");
    const snap = S.syncHistory[idx];
    if (!snap) return;
    if (!confirm("Revenir à l'état d'avant cette synchro ?\nLes modifications appliquées depuis seront perdues.")) return;
    Object.assign(S, JSON.parse(JSON.stringify(snap.state)));
    save(); closeSheet(); render(); toast("État restauré ↩︎");
  });
  $$("#sheet [data-del-sync]").forEach(b => b.onclick = () => {
    const idx = +b.getAttribute("data-del-sync");
    if (!confirm("Supprimer ce point de restauration ?\n(Tes données actuelles ne changent pas, tu perds juste la possibilité de revenir à cet état.)")) return;
    S.syncHistory.splice(idx, 1);
    save(); sheetSyncHistory();
  });
  const clr = $("#sh-clear");
  if (clr) clr.onclick = () => {
    if (!confirm("Vider tout l'historique des synchros ?\n(Tes données actuelles ne changent pas — tu perds seulement les points de restauration.)")) return;
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
function renderInstallButton(){
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
function hideSplashNow(){
  try {
    const cap = window.Capacitor;
    if (cap && cap.Plugins && cap.Plugins.SplashScreen) cap.Plugins.SplashScreen.hide();
  } catch(e){}
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
  }

  if (typeof initNotifications !== "undefined"){
    try { initNotifications(); } catch(e){ console.error("notif:", e); }
  }

  hideSplashNow();
})();