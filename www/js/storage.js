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
