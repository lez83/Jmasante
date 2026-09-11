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
