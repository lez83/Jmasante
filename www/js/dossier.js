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
