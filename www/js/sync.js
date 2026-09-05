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
