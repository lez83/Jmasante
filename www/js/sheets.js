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
