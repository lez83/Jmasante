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
function buildSyncFile(){
  const ops = S.changeLog.slice();
  const maxSeq = ops.length ? ops[ops.length-1].seq : (S.changeSeq||0);
  // Mémoriser jusqu'où on a envoyé (par appareil : ici on garde le high-water-mark global d'envoi)
  S.lastSentSeq = maxSeq;
  // Élagage : les opérations envoyées ET plus vieilles que 60 jours sont retirées du journal
  const cutTs = Date.now() - 60*864e5;
  const kept = S.changeLog.filter(op => op.ts >= cutTs || op.seq > (S.confirmedSeq||0));
  if (kept.length !== S.changeLog.length) S.changeLog = kept;
  try { save(); } catch(e){}
  return JSON.stringify({
    _jmsync: 1,
    from: { uid: S.identity.uid, name: whoami() },
    generatedAt: Date.now(),
    sinceSeq: 0,           // futur : synchro incrémentale par pair
    upToSeq: maxSeq,
    ops
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
  const newChoice = {};      // nouveaux patients : accepté par défaut
  a.newPatients.forEach(op => newChoice[op.seq] = true);
  const delChoice = {};      // suppressions : REFUSÉES par défaut (prudence)
  a.delPatients.forEach(op => delChoice[op.seq] = false);

  const render = () => {
    const summary = `
      <div class="small" style="margin-bottom:10px">De <b>${esc(a.from?a.from.name:"?")}</b> — ${a.auto.length} mise(s) à jour automatique(s)${a.newPatients.length?`, <b style="color:var(--accent)">${a.newPatients.length} nouveau(x) patient(s)</b>`:""}${a.delPatients.length?`, <b style="color:var(--danger)">${a.delPatients.length} suppression(s)</b>`:""}${a.plans.length?`, ${a.plans.length} plan(s) de soins`:""}${a.conflicts.length?`, <span style="color:var(--amber)">${a.conflicts.length} conflit(s)</span>`:""}.</div>`;
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
async function shareSyncFile(){
  if (!S.identity){ ensureIdentity(shareSyncFile); return; }
  const json = buildSyncFile();
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
