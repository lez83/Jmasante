/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   NOTE VOCALE
   ─────────────────────────────────────────────────────────
   Le 🎤 flottant ouvre le clavier sur le champ : c'est SON micro qui dicte.
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
/* ⚠️ Par PATIENT, la limite est plus courte : un vocal de patient sert à
   préciser un point à l'oral, pas à raconter le passage. 150 s suffisent,
   et dix patients ne doivent pas alourdir la relève. */
const VOICE_MAX_PAT = 150;
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

/* ⚠️ `maxS` : la relève globale plafonne à 3 min, un vocal de patient à
   150 s. Sans paramètre, l'ancien comportement est conservé. */
async function voiceStart(onTick, onStop, maxS){
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
      if (s >= (maxS || VOICE_MAX_S)) voiceStop();   // plafond atteint
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

/* ============================================================
   LE VOCAL D'UN PATIENT
   ─────────────────────────────────────────────────────────
   ⚠️ IL VOYAGE AVEC LA RELÈVE, PAS AVEC LES DONNÉES : c'est une
   précision dite à l'oral pour le collègue qui lira la relève, pas une
   pièce du dossier. Il ne part donc pas dans la synchro.

   ⚠️ EFFACÉ APRÈS ENVOI, comme le mot pour la prochaine relève : sinon
   les vocaux s'accumuleraient dans la sauvegarde sans que personne ne
   les réécoute jamais.

   ⚠️ LE TEXTE RESTE À CÔTÉ : un destinataire qui ne peut pas écouter
   doit au moins lire l'essentiel — et voir qu'un vocal existait.
============================================================ */
function pVoix(pid){
  S.voicePatient = S.voicePatient || {};
  return S.voicePatient[pid] || null;
}

async function pVoixGarder(pid, note){
  try {
    const b64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(note.blob);
    });
    await idbSet("voice_" + note.id, b64);
    S.voicePatient = S.voicePatient || {};
    S.voicePatient[pid] = { id:note.id, dur:note.dur, taille:note.taille,
                            mime:note.mime, at:new Date().toISOString() };
    save(true);
    return true;
  } catch(e){ logIncident("voice", "Vocal patient non conservé", e); return false; }
}

async function pVoixEffacer(pid){
  const v = pVoix(pid);
  if (!v) return;
  try { await idbDel("voice_" + v.id); } catch(e){}
  delete S.voicePatient[pid];
  save(true);
}

/* ⚠️ Appelé APRÈS l'envoi d'une relève : les vocaux des patients qui y
   figuraient ont fait leur travail. */
async function pVoixPurgeApresEnvoi(ids){
  for (const pid of (ids || [])) await pVoixEffacer(pid);
}

/* La mention qui part dans le TEXTE de la relève. */
function pVoixMention(pid){
  const v = pVoix(pid);
  return v ? "  \uD83C\uDFA4 note vocale de " + voiceFmt(v.dur) : "";
}
