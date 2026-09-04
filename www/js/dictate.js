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