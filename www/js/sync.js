/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
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
function buildSyncFile(tour, docIds, avecOrdre){
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
    /* Facultatif : l'ordre de passage de CETTE tournée. Absent par
       défaut — chaque infirmier garde le sien. */
    ...(avecOrdre && tour ? { ordre:{
      patientOrder: (S.patientOrder||{})[tour] || [],
      slotOrder:    (S.slotOrder||{})[tour]    || {},
      slotMembers:  (S.slotMembers||{})[tour]  || {}
    }} : {}),
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
async function receiveSyncFile(text){
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
    if (!await askDialog({ ic:"⚠️", titre:"Patients inconnus dans cette synchro",
    sub:"Une synchro ne transmet que les <b>changements</b>, pas les dossiers eux-mêmes.",
    warn:"Demande plutôt à ton collègue une sauvegarde complète (💾) pour partir de la même base.",
    oui:"Continuer quand même", non:"Annuler" })) return;
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
    /* ⚠️ Comparer par NOM DE FICHIER ne marchait pas entre confrères :
       deux scans de la même ordonnance portaient des noms différents.
       Le TYPE est comparable d'un appareil à l'autre. */
    const mine = owner && (owner.docs||[]).find(x =>
      (d.type && x.type) ? (x.type === d.type && x.date === d.date)
                         : (x.name === d.name));
    // Même type mais date différente : c'est une mise à jour, pas un doublon
    const versionAnterieure = owner && d.type && !mine
      ? (owner.docs||[]).filter(x => x.type === d.type)
          .sort((a,b) => String(b.date).localeCompare(String(a.date)))[0]
      : null;
    return { ...d, ownerName: owner ? owner.prenom+" "+owner.nom.replace("Demo-","").toUpperCase() : "?",
             clash: mine || null, anterieur: versionAnterieure || null };
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
            <b>${docIcon(d)} ${esc(typeof docLabel === "function" ? docLabel(d) : d.name)}</b>
            <div class="rs">${esc(d.ownerName)} · ${d.date?fmtFR(d.date):"sans date"} · ${ko>1024?(ko/1024).toFixed(1)+" Mo":ko+" Ko"}</div>
            ${d.anterieur && !d.clash ? `<div class="rs" style="color:var(--accent)">↻ Tu as une version du ${fmtFR(d.anterieur.date)} — celui-ci est ${String(d.date) > String(d.anterieur.date) ? "plus récent" : "plus ancien"}</div>` : ""}
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
    /* async : l'ordre de passage se demande avant d'enregistrer */
    $("#sy-apply").onclick = async () => {
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
      /* L'ordre de passage n'arrive que si l'expéditeur l'a coché, et
         ne s'applique qu'avec l'accord du destinataire : il a peut-être
         organisé sa tournée autrement. */
      if (pkg.ordre && pkg.tour){
        const o = pkg.ordre;
        const qui = pkg.from ? pkg.from.name : "ton collègue";
        if (await askDialog({ ic:"🔢", titre:"Reprendre l'ordre de passage ?",
              sub:"<b>" + esc(qui) + "</b> a joint l'ordre de sa tournée « " + esc(pkg.tour) + " ».",
              warn:"Ton ordre actuel pour cette tournée sera remplacé.",
              oui:"✓ Reprendre", non:"Garder le mien" })){
          S.patientOrder = S.patientOrder || {};
          S.patientOrder[pkg.tour] = [...(o.patientOrder||[])];
          if (o.slotOrder && Object.keys(o.slotOrder).length){
            S.slotOrder = S.slotOrder || {}; S.slotOrder[pkg.tour] = o.slotOrder;
          }
          if (o.slotMembers && Object.keys(o.slotMembers).length){
            S.slotMembers = S.slotMembers || {}; S.slotMembers[pkg.tour] = o.slotMembers;
          }
          toast("Ordre de passage repris ✓");
        }
      }
      save(); closeSheet(); render && render; renderApp();
      toast("Synchro appliquée ✓ — annulable dans les réglages");
    };
  };
  render();
}
function renderApp(){ try { render(); } catch(e){} }

/* ---------- Historique des synchros + marche arrière ---------- */
async function sheetSyncHistory(){
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
  $$("#sheet [data-restore-sync]").forEach(b => b.onclick = async () => {
    const idx = +b.getAttribute("data-restore-sync");
    const snap = S.syncHistory[idx];
    if (!snap) return;
    if (!await askDialog({ ic:"❓", titre:"Revenir à l'état d'avant cette synchro ?", sub:"Les modifications appliquées depuis seront perdues." })) return;
    Object.assign(S, JSON.parse(JSON.stringify(snap.state)));
    save(); closeSheet(); render(); toast("État restauré ↩︎");
  });
  $$("#sheet [data-del-sync]").forEach(b => b.onclick = async () => {
    const idx = +b.getAttribute("data-del-sync");
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer ce point de restauration ?", sub:"(Tes données actuelles ne changent pas, tu perds juste la possibilité de revenir à cet état.)", oui:"🗑 Supprimer" })) return;
    S.syncHistory.splice(idx, 1);
    save(); sheetSyncHistory();
  });
  const clr = $("#sh-clear");
  if (clr) clr.onclick = async () => {
    if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Vider tout l'historique des synchros ?", sub:"(Tes données actuelles ne changent pas — tu perds seulement les points de restauration.)", oui:"🗑 Supprimer" })) return;
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

      <label class="screl" style="margin:0 0 9px">
        <input type="checkbox" id="ss-ordre">
        <span>Transmettre aussi l'<b>ordre de passage</b> de cette tournée</span>
      </label>
      <button class="btn btn-primary" id="ss-go" style="width:100%">📤 Envoyer</button>
      <!-- ⚠️ Une synchro ne transmet que les changements : sur une app
           vierge elle n'apporte rien. Ce bouton livre les dossiers de
           CETTE tournée seulement, sans les autres cabinets. -->
      <button class="btn btn-ghost" id="ss-first" style="width:100%;margin-top:8px">
        💾 Premier échange — envoyer les dossiers de cette tournée</button>
      <p class="small muted" style="margin-top:6px">À utiliser une seule fois, quand le confrère n'a encore aucun patient. Les tournées suivantes restent chez toi.</p>
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
    $("#ss-go").onclick = () => { const o = !!$("#ss-ordre")?.checked; closeSheet(); shareSyncFile(tour, [...sel], o); };
    { const b = $("#ss-first");
      if (b) b.onclick = () => { closeSheet(); exportBackup("share", tour); }; }
  };
  draw();
}

async function shareSyncFile(tour, docIds, avecOrdre){
  if (!S.identity){ ensureIdentity(() => shareSyncFile(tour, docIds, avecOrdre)); return; }
  // Charger les contenus des documents cochés
  const pkg = JSON.parse(buildSyncFile(tour, docIds, avecOrdre));
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
  /* v1.0.58 : l'envoi passe par l'écran de protection (appairé / mot de
     passe / libre), qui produit un fichier protégé et/ou un fichier libre. */
  sheetProtectionEnvoi(tour, { json,
    base: "synchro_" + String(S.identity.prenom||"idel").replace(/[^\w-]+/g,"-") + "_" + todayISO(),
    titre: "Synchro JM@Santé", texte: "Fichier dynamique de tournée — " + whoami() });
}

/* ============================================================
   ÉCHANGES PROTÉGÉS — v1.0.58
   ─────────────────────────────────────────────────────────
   Trois modes par destinataire : 🤝 collègue appairé · 🔑 mot de
   passe de la tournée · 📤 libre (messagerie chiffrée ou
   responsabilité de chacun). Aucun serveur.

   Enveloppe : le contenu est chiffré UNE fois (AES-GCM 256, clé
   aléatoire), puis cette clé est « emballée » par autant de serrures
   que de moyens d'ouvrir : une par collègue appairé, une pour le mot
   de passe (PBKDF2-SHA256, 600 000 itérations, sel aléatoire). Un
   seul fichier protégé sert donc X (appairé) ET Z (mot de passe).

   ⚠️ « de » et « tour » voyagent EN CLAIR dans l'enveloppe : ils
   servent à retrouver le mot de passe retenu. Jamais de nom de
   patient à cet endroit.
   ⚠️ Les relèves PDF/Word/HTML ne sont PAS concernées : elles sont
   lues par des collègues qui n'ont pas forcément l'app.
============================================================ */
const JMSEC_V = 1, PW_ITER = 600000;
const _te = new TextEncoder(), _td = new TextDecoder();
const _rnd = n => crypto.getRandomValues(new Uint8Array(n));
const _aesKey = raw => crypto.subtle.importKey("raw", raw, { name:"AES-GCM" }, false, ["encrypt","decrypt"]);
async function _pwKey(pw, salt, it){
  const m = await crypto.subtle.importKey("raw", _te.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name:"PBKDF2", salt, iterations:it, hash:"SHA-256" },
    m, { name:"AES-GCM", length:256 }, false, ["encrypt","decrypt"]);
}
async function _enc(key, u8){
  const iv = _rnd(12);
  const c = await crypto.subtle.encrypt({ name:"AES-GCM", iv }, key, u8);
  return { iv:_b64(iv), d:_b64(new Uint8Array(c)) };
}
async function _dec(key, o){
  return new Uint8Array(await crypto.subtle.decrypt({ name:"AES-GCM", iv:_deb64(o.iv) }, key, _deb64(o.d)));
}
/* o = { pw, pairs:[{id,key}], tour } */
async function chiffrerPaquet(text, o){
  const dk = _rnd(32);
  const body = await _enc(await _aesKey(dk), _te.encode(text));
  const locks = [];
  if (o.pw){
    const salt = _rnd(16);
    const w = await _enc(await _pwKey(o.pw, salt, PW_ITER), dk);
    locks.push({ t:"pw", salt:_b64(salt), it:PW_ITER, iv:w.iv, d:w.d });
  }
  for (const c of (o.pairs||[])){
    const w = await _enc(await _aesKey(_deb64(c.key)), dk);
    locks.push({ t:"pair", id:c.id, iv:w.iv, d:w.d });
  }
  return JSON.stringify({ _jmsecure:JMSEC_V, de:whoami(), tour:o.tour||"", cree:new Date().toISOString(), body, locks });
}
async function _essai(lock, key){ try { return await _dec(key, lock); } catch(e){ return null; } }
/* Sans pw : essaie les appairages. Avec pw : essaie les serrures « mot de passe ». */
async function dechiffrerPaquet(env, pw){
  let dk = null;
  const locks = env.locks || [];
  if (pw === undefined){
    for (const l of locks.filter(l => l.t === "pair")){
      const c = (S.collegues||[]).find(c => c.id === l.id);
      if (c && (dk = await _essai(l, await _aesKey(_deb64(c.key))))) break;
    }
  } else {
    for (const l of locks.filter(l => l.t === "pw")){
      if ((dk = await _essai(l, await _pwKey(pw, _deb64(l.salt), l.it || PW_ITER)))) break;
    }
  }
  if (!dk) return null;
  try { return _td.decode(await _dec(await _aesKey(dk), env.body)); } catch(e){ return null; }
}

/* ---------- Mot de passe généré, facile à dicter ---------- */
const MOTS_PW = ("abricot ancre arbre ardoise balcon baleine bambou banane barque bateau biscuit bleuet bocal bougie boussole brioche brume cabane cactus caillou calme camelia canard canot carafe carotte castor cerise chalet chamois chataigne chouette citron colline comete corail coton crabe criquet dauphin dune ecureuil eclair epice erable etoile falaise faucon figue flocon fontaine foret fraise galet gazelle girafe glacier grenade griotte hamac herisson hibou horizon igloo iris jardin jasmin kiwi lagon lavande lezard lilas limace loutre lueur lynx magnolia mandarine marmotte melon menthe meteore mimosa mouette muguet myrtille nuage oasis olive orage orchidee ours pagaie palmier panda papaye pastel pelican perle phare pinson piment pirogue pivoine plume poivre pomme poney prairie quartz radis renard requin rivage roseau rubis sable safran sapin sardine saule sirop soleil source tamaris tapir tilleul tomate tortue toucan tulipe vague vanille verger violette volcan yaourt zebre").split(" ");
function genMotDePasse(){
  const r = crypto.getRandomValues(new Uint32Array(5));
  const w = [0,1,2,3].map(i => MOTS_PW[r[i] % MOTS_PW.length]);
  return w.join("-") + "-" + String(r[4] % 100).padStart(2,"0");
}

/* ---------- Partage d'un texte en fichier ---------- */
async function partagerTexte(fname, txt, titre, texte){
  const cap = window.Capacitor;
  if (cap && cap.isNativePlatform && cap.isNativePlatform()){
    try {
      const { Filesystem, Share } = cap.Plugins;
      const r = await Filesystem.writeFile({ path:fname, data:txt, directory:"CACHE", encoding:"utf8" });
      await Share.share({ title:titre, text:texte||"", url:r.uri });
      return true;
    } catch(e){ if ((e.message||"").match(/cancel/i)) return false; console.warn("partage:", e); }
  }
  downloadBlob(fname, new Blob([txt], { type:"application/json" }));
  toast("Fichier exporté 📤");
  return true;
}

/* ---------- Réglage d'envoi d'une tournée ----------
   S.envoiTour[tour] = { dest:[{ id, nom, mode:"pair"|"pw"|"libre", cid }] }
   S.tourPw[tour]    = { pw, date }       — chiffré au repos avec l'état
   S.pwRecus[de|tour]= pw                  — côté destinataire, s'il accepte */
const MODE_LBL = { pair:"🤝 Appairé", pw:"🔑 Mot de passe", libre:"📤 Libre" };
function _nomCollegue(cid){ const c = (S.collegues||[]).find(c => c.id === cid); return c ? c.nom : ""; }

/* payload = { json, base, titre, texte } ou null (simple réglage de la tournée) */
async function sheetProtectionEnvoi(tour, payload){
  S.envoiTour = S.envoiTour || {}; S.tourPw = S.tourPw || {};
  const avaitCfg = !!S.envoiTour[tour];
  let dest = avaitCfg ? JSON.parse(JSON.stringify(S.envoiTour[tour].dest || []))
                      : [{ id:uid(), nom:"Destinataire", mode:"libre", inc:true }];
  dest.forEach(d => { if (d.inc === undefined) d.inc = true; });
  let retenir = !avaitCfg || !payload;
  let pwSaisi = "";
  const partages = { prot:false, libre:false };

  await aideUne("envoi-protege", { ic:"🔐", titre:"Protéger un envoi",
    sub:"Pour chaque collègue de la tournée, choisis comment il reçoit le fichier :<br><br>" +
        "<b>🤝 Appairé</b> — chiffré pour lui seul, il n'a rien à taper (appairage fait une fois, 🦗 → Partage → Collègues).<br>" +
        "<b>🔑 Mot de passe</b> — le mot de passe de la tournée, donné <b>une fois</b> par un autre canal (SMS, de vive voix).<br>" +
        "<b>📤 Libre</b> — comme avant, si tu passes par une messagerie chiffrée.<br><br>" +
        "Les collègues appairés et ceux au mot de passe reçoivent <b>le même fichier protégé</b>." });

  const draw = () => {
    const inc = dest.filter(d => d.inc);
    const prot = inc.filter(d => (d.mode === "pair" && d.cid) || d.mode === "pw");
    const lib  = inc.filter(d => d.mode === "libre");
    const besoinPw = inc.some(d => d.mode === "pw");
    const tp = S.tourPw[tour];
    const vieux = tp && (Date.now() - new Date(tp.date).getTime()) > 180*864e5;
    openSheet(`
      <h3>🔐 Envoi — ${esc(tour)}</h3>
      <p class="small muted" style="margin-bottom:12px">${payload ? "Choisis la protection de chaque destinataire." : "Réglage par défaut de cette tournée : il sera présélectionné à chaque envoi."}</p>
      <div class="lab">Destinataires</div>
      <div id="pe-dest">${dest.map((d,i) => `
        <div class="pe-row ${d.inc?"":"off"}">
          <div class="pe-top">
            ${payload ? `<input type="checkbox" data-pinc="${i}" ${d.inc?"checked":""}>` : ""}
            <button class="pe-nom" data-pnom="${i}">${esc(d.nom)}</button>
            <button class="pe-x" data-pdel="${i}" title="Retirer">✕</button>
          </div>
          <div class="pe-seg">${["pair","pw","libre"].map(m =>
            `<button class="${d.mode===m?"on":""}" data-pm="${i}|${m}">${MODE_LBL[m]}</button>`).join("")}</div>
          <div class="pe-sub">${d.mode==="pair" ? (d.cid ? "chiffré pour <b>"+esc(_nomCollegue(d.cid)||"?")+"</b>" : "⚠ choisis le collègue appairé")
            : d.mode==="pw" ? "mot de passe de la tournée" : "sans protection"}</div>
        </div>`).join("")}</div>
      <button class="btn btn-ghost btn-sm" id="pe-add" style="width:100%;margin:4px 0 14px">＋ Ajouter un destinataire</button>
      ${besoinPw ? `
        <div class="lab">🔑 Mot de passe de la tournée</div>
        ${tp ? `<div class="pe-pw"><span id="pe-pwv">••••••••</span>
            <button class="btn btn-ghost btn-sm" id="pe-voir" style="flex:none">👁</button>
            <button class="btn btn-ghost btn-sm" id="pe-chg" style="flex:none">✏️ Changer</button></div>
          <p class="small muted" style="margin:4px 0 14px">Défini le ${esc(fmtFR(tp.date.slice(0,10)))}. ${vieux ? '<span style="color:var(--amber)">Il a plus de 6 mois : pense à le changer.</span>' : "Change-le quand quelqu'un quitte le cabinet."}</p>`
        : `<div class="pe-pw"><input id="pe-pwin" placeholder="mot de passe (8 caractères min.)" value="${esc(pwSaisi)}" autocomplete="off">
            <button class="btn btn-ghost btn-sm" id="pe-gen" style="flex:none" title="Générer">🎲</button></div>
          <p class="small muted" style="margin:4px 0 14px">Donne-le <b>une fois</b> à tes collègues par un autre canal, jamais dans le même message que le fichier. Il servira pour tous les envois suivants.</p>`}` : ""}
      ${payload ? `<label class="screl" style="margin:0 0 10px"><input type="checkbox" id="pe-ret" ${retenir?"checked":""}>
        <span>Retenir ces choix pour la tournée</span></label>` : ""}
      ${payload ? `
        ${prot.length ? `<button class="btn btn-primary" id="pe-prot" style="width:100%;margin-bottom:8px">${partages.prot?"✓ ":""}🔒 Fichier protégé — ${esc(prot.map(d=>d.nom).join(", "))}</button>` : ""}
        ${lib.length ? `<button class="btn ${prot.length?"btn-ghost":"btn-primary"}" id="pe-lib" style="width:100%;margin-bottom:8px">${partages.libre?"✓ ":""}📤 Fichier libre — ${esc(lib.map(d=>d.nom).join(", "))}</button>` : ""}
        ${!inc.length ? `<p class="small muted">Coche au moins un destinataire.</p>` : ""}`
      : `<button class="btn btn-primary" id="pe-save" style="width:100%;margin-bottom:8px">✓ Enregistrer</button>`}
      <button class="btn btn-ghost" id="pe-coll" style="width:100%;margin-bottom:8px">🤝 Collègues appairés (${(S.collegues||[]).length})</button>
      <button class="btn btn-ghost" id="pe-close" style="width:100%">${payload && (partages.prot||partages.libre) ? "Terminé" : "Annuler"}</button>`);

    const memo = () => { const r = $("#pe-ret"); if (r) retenir = r.checked; const pi = $("#pe-pwin"); if (pi) pwSaisi = pi.value; };
    $$("#sheet [data-pinc]").forEach(b => b.onchange = () => { memo(); dest[+b.dataset.pinc].inc = b.checked; draw(); });
    $$("#sheet [data-pdel]").forEach(b => b.onclick = () => { memo(); dest.splice(+b.dataset.pdel, 1); draw(); });
    $$("#sheet [data-pnom]").forEach(b => b.onclick = async () => { memo();
      const d = dest[+b.dataset.pnom];
      const n = await askDialog({ ic:"✏️", titre:"Nom du destinataire", saisie:{ val:d.nom }, oui:"OK" });
      if (n && n.trim()){ d.nom = n.trim(); } draw(); });
    $$("#sheet [data-pm]").forEach(b => b.onclick = async () => { memo();
      const [i, m] = b.dataset.pm.split("|"); const d = dest[+i];
      if (m === "pair"){
        const cs = S.collegues || [];
        if (!cs.length){ toast("Aucun collègue appairé — 🤝 Collègues appairés, plus bas"); return; }
        const cid = cs.length === 1 ? cs[0].id : await askChoice({ ic:"🤝", titre:"Quel collègue appairé ?",
          options: cs.map(c => ({ ic:"🤝", lbl:c.nom, val:c.id })) });
        if (!cid) return;
        d.cid = cid; if (d.nom === "Destinataire") d.nom = _nomCollegue(cid);
      }
      d.mode = m; draw(); });
    $("#pe-add").onclick = async () => { memo();
      const n = await askDialog({ ic:"＋", titre:"Nouveau destinataire", saisie:{ ph:"Prénom du collègue" }, oui:"Ajouter" });
      if (!n || !n.trim()) return;
      const c = (S.collegues||[]).find(c => c.nom.toLowerCase() === n.trim().toLowerCase());
      dest.push({ id:uid(), nom:n.trim(), mode: c ? "pair" : (S.tourPw[tour] ? "pw" : "libre"), cid: c ? c.id : null, inc:true });
      draw(); };
    { const v = $("#pe-voir"); if (v) v.onclick = () => { const s = $("#pe-pwv"); s.textContent = s.textContent.startsWith("•") ? S.tourPw[tour].pw : "••••••••"; }; }
    { const c = $("#pe-chg"); if (c) c.onclick = async () => { memo();
        if (!await askDialog({ ic:"🔑", titre:"Changer le mot de passe de la tournée ?",
            sub:"Les fichiers déjà envoyés gardent l'ancien. Tu devras donner le nouveau à tes collègues, par un autre canal.", oui:"Changer" })) return;
        delete S.tourPw[tour]; save(); pwSaisi = genMotDePasse(); draw(); }; }
    { const g = $("#pe-gen"); if (g) g.onclick = () => { memo(); pwSaisi = genMotDePasse(); draw(); }; }
    $("#pe-coll").onclick = () => { memo(); sheetCollegues(() => { draw(); }); };
    $("#pe-close").onclick = closeSheet;

    /* Valider le mot de passe saisi et l'enregistrer pour la tournée */
    const assurerPw = () => {
      memo();
      if (!dest.some(d => d.inc && d.mode === "pw")) return true;
      if (S.tourPw[tour]) return true;
      if ((pwSaisi||"").trim().length < 8){ toast("Mot de passe trop court (8 caractères minimum) — 🎲 en propose un", "danger"); return false; }
      S.tourPw[tour] = { pw:pwSaisi.trim(), date:new Date().toISOString() };
      return true;
    };
    const enregistrer = () => {
      S.envoiTour[tour] = { dest: dest.map(({ id, nom, mode, cid }) => ({ id, nom, mode, cid: cid || null })) };
    };
    { const s = $("#pe-save"); if (s) s.onclick = () => {
        if (dest.some(d => d.mode === "pair" && !d.cid)){ toast("Choisis le collègue appairé", "danger"); return; }
        if (!assurerPw()) return;
        enregistrer(); save(); toast("Réglage d'envoi enregistré 🔐"); closeSheet(); }; }
    { const b = $("#pe-prot"); if (b) b.onclick = async () => {
        if (dest.some(d => d.inc && d.mode === "pair" && !d.cid)){ toast("Choisis le collègue appairé", "danger"); return; }
        if (!assurerPw()) return;
        if (retenir) enregistrer(); save();
        const inc = dest.filter(d => d.inc);
        const pairs = [...new Set(inc.filter(d => d.mode === "pair" && d.cid).map(d => d.cid))]
          .map(cid => S.collegues.find(c => c.id === cid)).filter(Boolean);
        const pw = inc.some(d => d.mode === "pw") ? S.tourPw[tour].pw : null;
        toast("Chiffrement…");
        const txt = await chiffrerPaquet(payload.json, { pw, pairs, tour });
        if (await partagerTexte(payload.base + "_PROTEGE.json", txt, payload.titre + " (protégé)", payload.texte)){
          partages.prot = true; draw(); } }; }
    { const b = $("#pe-lib"); if (b) b.onclick = async () => {
        memo(); if (retenir) enregistrer(); save();
        if (!aideVue("libre-avert")){
          const r = await avertLibre();
          if (r === "pw"){ dest.forEach(d => { if (d.inc && d.mode === "libre") d.mode = "pw"; }); draw(); return; }
          if (r !== "go") return;
        }
        if (await partagerTexte(payload.base + "_LIBRE.json", payload.json, payload.titre, payload.texte)){
          partages.libre = true; draw(); } }; }
  };
  draw();
}

/* Avertissement avant un envoi libre — « Ne plus afficher » possible,
   réactivé par 🦗 → Application → Revoir les aides. */
function avertLibre(){
  return new Promise(res => {
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card">${typeof CIG_FILI_SVG !== "undefined" ? CIG_FILI_SVG : ""}<div class="dlg-in">
      <div class="dlg-ic">⚠️</div><div class="dlg-t">Fichier non protégé</div>
      <div class="dlg-s">Il contient des données de santé <b>lisibles par toute personne qui l'ouvre</b>. Si tu l'envoies par une messagerie chiffrée santé, tu peux continuer.</div>
      <label class="aide-nm"><input type="checkbox" id="al-nm"> Ne plus afficher — j'utilise une plateforme chiffrée</label>
      <div class="dlg-opts" style="margin-top:12px">
        <button class="dlg-opt" data-r="pw">🔑 Protéger par mot de passe</button>
        <button class="dlg-opt" data-r="go">📤 Envoyer sans protection</button></div>
      <button class="dlg-cancel" data-r="">Annuler</button></div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    el.querySelectorAll("[data-r]").forEach(b => b.onclick = () => {
      if (b.dataset.r === "go" && el.querySelector("#al-nm").checked) aideMasquer("libre-avert");
      el.classList.remove("show"); setTimeout(() => el.remove(), 200); res(b.dataset.r || null);
    });
  });
}

/* ---------- Réception d'un fichier protégé ---------- */
function demanderMotDePasse(env){
  return new Promise(res => {
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card">${typeof CIG_FILI_SVG !== "undefined" ? CIG_FILI_SVG : ""}<div class="dlg-in">
      <div class="dlg-ic">🔒</div><div class="dlg-t">Fichier protégé</div>
      <div class="dlg-s">Envoyé par <b>${esc(env.de||"?")}</b>${env.tour ? " · tournée <b>"+esc(env.tour)+"</b>" : ""}</div>
      <div class="dlg-f"><input id="mdp-in" type="password" placeholder="Mot de passe" autocomplete="off">
        <div class="dlg-fa"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="mdp-show"> afficher</label></div></div>
      <label class="aide-nm"><input type="checkbox" id="mdp-ret" checked> Retenir pour les prochains envois de ${esc(env.de||"ce collègue")}</label>
      <div class="dlg-act"><button class="btn btn-ghost" data-no>Annuler</button><button class="btn btn-primary" data-yes>Ouvrir</button></div>
      <div class="dlg-fa" style="margin-top:8px">Mot de passe erroné : rien n'est importé, tes données restent intactes.</div>
    </div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    const inp = el.querySelector("#mdp-in"); setTimeout(() => inp.focus(), 120);
    el.querySelector("#mdp-show").onchange = e => inp.type = e.target.checked ? "text" : "password";
    const fin = v => { el.classList.remove("show"); setTimeout(() => el.remove(), 200); res(v); };
    el.querySelector("[data-no]").onclick = () => fin(null);
    el.querySelector("[data-yes]").onclick = () => fin(inp.value ? { pw:inp.value, retenir:el.querySelector("#mdp-ret").checked } : null);
    inp.onkeydown = e => { if (e.key === "Enter") el.querySelector("[data-yes]").click(); };
  });
}
async function ouvrirProtege(env){
  if (env._jmsecure > JMSEC_V){ toast("Fichier créé par une version plus récente de JM@Santé — mets l'app à jour.", "danger"); return; }
  let txt = await dechiffrerPaquet(env);                       // 1. appairages
  const cle = (env.de||"") + "|" + (env.tour||"");
  const retenus = [ (S.pwRecus||{})[cle], ((S.tourPw||{})[env.tour]||{}).pw ].filter(Boolean);
  for (const p of retenus){ if (txt) break; txt = await dechiffrerPaquet(env, p); }   // 2. mots de passe retenus
  const aPw = (env.locks||[]).some(l => l.t === "pw");
  if (!txt && !aPw){
    await askDialog({ ic:"🤝", titre:"Fichier réservé à des collègues appairés",
      sub:"Ce fichier a été chiffré pour des collègues appairés avec <b>" + esc(env.de||"l'expéditeur") + "</b>, et cet appareil n'en fait pas partie.<br><br>Demande-lui de le renvoyer avec le mot de passe de la tournée, ou refaites l'appairage.",
      oui:"Compris", seul:true });
    return;
  }
  while (!txt){                                               // 3. saisie
    const r = await demanderMotDePasse(env);
    if (!r){ toast("Rien n'a été importé."); return; }
    toast("Vérification…");
    txt = await dechiffrerPaquet(env, r.pw);
    if (!txt){ toast("Mot de passe incorrect — rien n'a été importé", "danger"); continue; }
    if (r.retenir){ S.pwRecus = S.pwRecus || {}; S.pwRecus[cle] = r.pw; save(); }
  }
  toast("Fichier déverrouillé 🔓");
  ouvrirTexteRecu(txt);
}

/* ============================================================
   APPAIRAGE DES COLLÈGUES
   ─────────────────────────────────────────────────────────
   🛡 Sécurisé (deux scans) : chacun montre une clé PUBLIQUE ECDH
      P-256 ; chacun calcule le même secret. Les codes peuvent être
      vus ou photographiés sans risque.
   ⚡ Rapide (un scan) : le code montré CONTIENT la clé secrète.
   Les deux aboutissent à S.collegues[] = { id, nom, key, date, methode }.
   Un « code de contrôle » à 4 chiffres, identique sur les deux
   téléphones, confirme que c'est bien le bon collègue.
   Codes texte : JMS1P.<b64url> (public) · JMS1K.<b64url> (secret).
============================================================ */
const _b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const _unb64u = s => decodeURIComponent(escape(atob(s.replace(/-/g,"+").replace(/_/g,"/"))));
async function _sha(u8){ return new Uint8Array(await crypto.subtle.digest("SHA-256", u8)); }
const _hex = u8 => [...u8].map(b => b.toString(16).padStart(2,"0")).join("");
async function codeControle(keyB64){ const h = await _sha(_deb64(keyB64)); return String(((h[0]<<8)|h[1]) % 10000).padStart(4,"0"); }

async function nouvelleSessionSecure(){
  const kp = await crypto.subtle.generateKey({ name:"ECDH", namedCurve:"P-256" }, false, ["deriveBits"]);
  const pub = _b64(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
  return { kp, pub, code: "JMS1P." + _b64u(JSON.stringify({ n:whoami(), p:pub })) };
}
function lireCodeAppairage(txt){
  const t = String(txt||"").trim();
  const m = t.match(/JMS1([PK])\.([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try { const o = JSON.parse(_unb64u(m[2])); o.type = m[1]; return o; } catch(e){ return null; }
}
async function enregistrerCollegue(c){
  S.collegues = (S.collegues||[]).filter(x => x.id !== c.id);
  S.collegues.push({ ...c, date:new Date().toISOString() }); save(true);
  return codeControle(c.key);
}
/* Code reçu (scanné ou collé). sess = session sécurisée en cours, si l'écran en a une. */
async function recevoirCodeAppairage(txt, sess){
  const o = lireCodeAppairage(txt);
  if (!o){ toast("Ce n'est pas un code d'appairage JM@Santé", "danger"); return null; }
  if (o.type === "K"){
    const cc = await enregistrerCollegue({ id:o.i, nom:o.n || "Collègue", key:o.k, methode:"rapide" });
    return { nom:o.n, cc };
  }
  if (!sess){ toast("Code sécurisé : ouvre « 🛡 Appairage sécurisé » pour le scanner", "danger"); return null; }
  if (o.p === sess.pub){ toast("C'est ton propre code — scanne celui de ton collègue", "danger"); return null; }
  const theirs = await crypto.subtle.importKey("raw", _deb64(o.p), { name:"ECDH", namedCurve:"P-256" }, false, []);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name:"ECDH", public:theirs }, sess.kp.privateKey, 256));
  const pubs = [sess.pub, o.p].sort().join("|");
  const key = _b64(await _sha(new Uint8Array([...bits, ..._te.encode(pubs)])));
  const id  = _hex(await _sha(_te.encode("id|" + pubs))).slice(0, 16);
  const cc = await enregistrerCollegue({ id, nom:o.n || "Collègue", key, methode:"secure" });
  return { nom:o.n, cc };
}

function qrSvg(txt){
  try { const q = qrcode(0, "M"); q.addData(txt); q.make(); return q.createSvgTag({ cellSize:4, margin:3, scalable:true }); }
  catch(e){ return `<p class="small muted">QR indisponible — utilise le code ci-dessous.</p>`; }
}
async function copierTexte(t){
  try { await navigator.clipboard.writeText(t); toast("Code copié 📋"); }
  catch(e){ toast("Copie impossible — sélectionne le code à la main"); }
}

/* Lecture d'un QR par la caméra (jsQR). cb(texte) une seule fois. */
async function scannerQR(cb){
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) || typeof jsQR !== "function"){
    toast("Caméra indisponible ici — utilise « ⌨️ Coller son code »"); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" }, audio:false }); }
  catch(e){ toast("Accès à la caméra refusé — autorise-le, puis réessaie, ou colle le code", "danger"); return; }
  const el = document.createElement("div");
  el.className = "qr-scan";
  el.innerHTML = `<video playsinline muted></video><div class="qr-cadre"></div>
    <p>Vise le code de ton collègue</p><button class="btn btn-ghost" id="qr-stop">Annuler</button>`;
  document.body.appendChild(el);
  const v = el.querySelector("video"); v.srcObject = stream; try { await v.play(); } catch(e){}
  const cv = document.createElement("canvas"); const cx = cv.getContext("2d", { willReadFrequently:true });
  let fini = false;
  const stop = () => { fini = true; stream.getTracks().forEach(t => t.stop()); el.remove(); };
  el.querySelector("#qr-stop").onclick = stop;
  const tour = () => {
    if (fini) return;
    if (v.readyState >= 2 && v.videoWidth){
      cv.width = v.videoWidth; cv.height = v.videoHeight;
      cx.drawImage(v, 0, 0);
      const r = jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts:"dontInvert" });
      if (r && /JMS1[PK]\./.test(r.data)){ stop(); cb(r.data); return; }
    }
    requestAnimationFrame(tour);
  };
  tour();
}

function sheetCollegues(retour){
  const cs = S.collegues || [];
  const recus = Object.keys(S.pwRecus || {});
  openSheet(`
    <h3>🤝 Collègues appairés</h3>
    <p class="small muted" style="margin-bottom:12px">Un collègue appairé reçoit des fichiers chiffrés pour lui seul, <b>sans mot de passe à taper</b>. L'appairage se fait une fois.</p>
    <div>${cs.map(c => `
      <div class="rap"><span class="ric">🤝</span>
        <span style="flex:1"><div class="rt">${esc(c.nom)}</div>
        <div class="rs">${c.methode === "secure" ? "🛡 sécurisé" : "⚡ rapide"} · depuis le ${esc(fmtFR(String(c.date).slice(0,10)))}</div></span>
        <button class="btn btn-ghost btn-sm" data-oubli="${esc(c.id)}" style="flex:none">Oublier</button>
      </div>`).join("") || `<p class="small muted" style="padding:6px 0">Aucun collègue appairé pour l'instant.</p>`}</div>
    <button class="btn btn-primary" id="co-add" style="width:100%;margin:12px 0 8px">＋ Appairer un collègue</button>
    ${recus.length ? `<div class="lab" style="margin-top:10px">🔑 Mots de passe retenus (fichiers reçus)</div>
      ${recus.map(k => `<div class="rap"><span class="ric">🔑</span><span style="flex:1"><div class="rt">${esc(k.split("|")[0])}</div>
        <div class="rs">${esc(k.split("|")[1] ? "tournée " + k.split("|")[1] : "")}</div></span>
        <button class="btn btn-ghost btn-sm" data-pwoubli="${esc(k)}" style="flex:none">Oublier</button></div>`).join("")}` : ""}
    <p class="small muted" style="margin-top:10px">Un collègue a perdu ou changé de téléphone ? <b>Oublie-le</b> ici : son ancien appareil ne pourra plus ouvrir tes envois. En attendant de refaire l'appairage, envoie-lui avec le mot de passe de la tournée.</p>
    <button class="btn btn-ghost" id="co-back" style="width:100%;margin-top:8px">${retour ? "← Retour à l'envoi" : "Fermer"}</button>`);
  $$("#sheet [data-oubli]").forEach(b => b.onclick = async () => {
    const c = (S.collegues||[]).find(x => x.id === b.dataset.oubli); if (!c) return;
    if (!await askDialog({ ton:"danger", ic:"🤝", titre:"Oublier " + c.nom + " ?",
        sub:"Ses appareils ne pourront plus ouvrir tes prochains envois. Dans tes tournées, il passe en <b>🔑 mot de passe</b>.",
        oui:"Oublier" })) return;
    S.collegues = S.collegues.filter(x => x.id !== c.id);
    Object.values(S.envoiTour||{}).forEach(t => (t.dest||[]).forEach(d => { if (d.cid === c.id){ d.cid = null; d.mode = "pw"; } }));
    save(true); toast(c.nom + " oublié"); sheetCollegues(retour);
  });
  $$("#sheet [data-pwoubli]").forEach(b => b.onclick = () => {
    delete S.pwRecus[b.dataset.pwoubli]; save(); toast("Mot de passe oublié"); sheetCollegues(retour); });
  $("#co-add").onclick = () => sheetAppairer(retour);
  $("#co-back").onclick = () => retour ? retour() : closeSheet();
}

async function sheetAppairer(retour){
  if (!S.identity){ ensureIdentity(() => sheetAppairer(retour)); return; }
  await aideUne("appairage", { ic:"🤝", titre:"Appairer un collègue",
    sub:"<b>🛡 Sécurisé</b> — vous scannez chacun le code de l'autre. Ces codes ne contiennent rien de secret : ils peuvent être vus sans risque. C'est la méthode conseillée.<br><br>" +
        "<b>⚡ Rapide</b> — un seul scan. Mais le code affiché <b>est la clé</b> : ne le laisse pas à l'écran, ne le photographie pas.<br><br>" +
        "À la fin, un <b>code de contrôle</b> à 4 chiffres s'affiche : il doit être <b>identique</b> sur les deux téléphones.<br><br>" +
        "Pas de caméra (PC) ou pas côte à côte ? Chaque code peut aussi être <b>copié puis collé</b>, par exemple en visio." });
  openSheet(`
    <h3>🤝 Appairer un collègue</h3>
    <div class="dlg-opts">
      <button class="dlg-opt" id="ap-sec">🛡 Appairage sécurisé — deux scans <span class="small muted" style="display:block;font-weight:400">Conseillé. Les codes peuvent être vus sans risque.</span></button>
      <button class="dlg-opt" id="ap-show">⚡ Rapide — je montre mon code <span class="small muted" style="display:block;font-weight:400">Un seul scan. Le code est une clé : à ne pas laisser à l'écran.</span></button>
      <button class="dlg-opt" id="ap-scan">⚡ Rapide — je scanne ou colle son code</button>
    </div>
    <button class="btn btn-ghost" id="ap-back" style="width:100%;margin-top:12px">← Retour</button>`);
  $("#ap-back").onclick = () => sheetCollegues(retour);
  $("#ap-sec").onclick = () => ecranSecure(retour);
  $("#ap-show").onclick = () => ecranRapideMontrer(retour);
  $("#ap-scan").onclick = () => ecranRecevoir(null, retour);
}
function _succes(r, retour, rester){
  if (!r) return;
  askDialog({ ic:"✅", titre:"Appairé avec " + (r.nom || "ton collègue"),
    sub:`Code de contrôle : <div class="rescue-code">${r.cc}</div>Il doit être <b>identique</b> sur son téléphone. Sinon, oublie ce collègue et recommencez.` +
        (rester ? "<br><br>Laisse ton code affiché jusqu'à ce qu'il l'ait scanné à son tour." : ""),
    oui:"OK", seul:true }).then(() => { if (!rester) sheetCollegues(retour); });
}
async function ecranSecure(retour){
  const sess = await nouvelleSessionSecure();
  openSheet(`
    <h3>🛡 Appairage sécurisé</h3>
    <p class="small muted" style="margin-bottom:10px"><b>1.</b> Ton collègue scanne ce code. <b>2.</b> Tu scannes le sien. L'ordre n'a pas d'importance.</p>
    <div class="qr-box">${qrSvg(sess.code)}</div>
    <div class="qr-txt" id="ap-code">${esc(sess.code)}</div>
    <div class="rowb" style="margin:8px 0">
      <button class="btn btn-ghost btn-sm" id="ap-copy">📋 Copier mon code</button>
      <button class="btn btn-ghost btn-sm" id="ap-paste">⌨️ Coller son code</button></div>
    <button class="btn btn-primary" id="ap-cam" style="width:100%;margin-bottom:8px">📷 Scanner son code</button>
    <button class="btn btn-ghost" id="ap-fin" style="width:100%">Terminé</button>`);
  $("#ap-copy").onclick = () => copierTexte(sess.code);
  $("#ap-paste").onclick = async () => { const t = await askDialog({ ic:"⌨️", titre:"Coller le code de ton collègue", saisie:{ ph:"JMS1P.…" }, oui:"Valider" });
    if (t) _succes(await recevoirCodeAppairage(t, sess), retour, true); };
  $("#ap-cam").onclick = () => scannerQR(async t => _succes(await recevoirCodeAppairage(t, sess), retour, true));
  $("#ap-fin").onclick = () => sheetCollegues(retour);
}
async function ecranRapideMontrer(retour){
  const nom = await askDialog({ ic:"⚡", titre:"Avec qui ?", saisie:{ ph:"Prénom du collègue" }, oui:"Afficher mon code" });
  if (!nom || !nom.trim()) return;
  const key = _b64(_rnd(32)), id = _hex(_rnd(8));
  const code = "JMS1K." + _b64u(JSON.stringify({ n:whoami(), k:key, i:id }));
  const cc = await enregistrerCollegue({ id, nom:nom.trim(), key, methode:"rapide" });
  openSheet(`
    <h3>⚡ Montre ce code à ${esc(nom.trim())}</h3>
    <div class="tip" style="border-color:var(--amber);margin-bottom:10px">⚠ Ce code <b>est la clé</b>. Ne le photographie pas, ne l'envoie pas, ferme l'écran dès qu'il est scanné.</div>
    <div class="qr-box">${qrSvg(code)}</div>
    <p class="small muted" style="margin:8px 0">Code de contrôle : <b>${cc}</b> — il doit s'afficher chez ${esc(nom.trim())}.</p>
    <button class="btn btn-ghost btn-sm" id="ap-copy" style="width:100%;margin-bottom:8px">📋 Copier le code (visio, PC)</button>
    <button class="btn btn-primary" id="ap-fin" style="width:100%">Terminé — masquer le code</button>`);
  $("#ap-copy").onclick = () => copierTexte(code);
  $("#ap-fin").onclick = () => sheetCollegues(retour);
}
async function ecranRecevoir(sess, retour){
  openSheet(`
    <h3>⚡ Scanner le code de ton collègue</h3>
    <button class="btn btn-primary" id="ap-cam" style="width:100%;margin-bottom:8px">📷 Scanner</button>
    <button class="btn btn-ghost" id="ap-paste" style="width:100%;margin-bottom:8px">⌨️ Coller son code</button>
    <button class="btn btn-ghost" id="ap-back" style="width:100%">← Retour</button>`);
  $("#ap-cam").onclick = () => scannerQR(async t => _succes(await recevoirCodeAppairage(t, sess), retour));
  $("#ap-paste").onclick = async () => { const t = await askDialog({ ic:"⌨️", titre:"Coller le code", saisie:{ ph:"JMS1K.…" }, oui:"Valider" });
    if (t) _succes(await recevoirCodeAppairage(t, sess), retour); };
  $("#ap-back").onclick = () => sheetAppairer(retour);
}
