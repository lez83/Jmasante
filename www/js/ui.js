function lastVisit(p){ return [...p.visits].sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at)).pop(); }
function statusOf(p){
  const t = workDate();
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
  /* Frise sous la barre d'outils — un motif par thème.
     Redessinée seulement si le thème a changé (évite de relancer
     les animations à chaque render). */
  { const fr = document.getElementById("frise");
    if (fr && fr.dataset.th !== (S.theme||"hopital")){
      fr.dataset.th = S.theme || "hopital";
      fr.innerHTML = friseSvg(S.theme || "hopital");
    } }

  const wd = workDate();
  $("#h-date").textContent = new Date(wd + "T12:00:00")
    .toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  $("#h-date").parentElement.classList.toggle("past", !isToday());
  { const nx = $("#d-next"); if (nx) nx.disabled = isToday(); }

  /* Bandeau de saisie différée : impossible d'oublier qu'on est dans le passé */
  const dbar = document.getElementById("datebar");
  if (dbar){
    if (isToday()) dbar.innerHTML = "";
    else dbar.innerHTML = `<div class="dpast">
      <span class="dp-i">⏱</span>
      <span class="dp-t">Saisie différée — <b>${workDateLabel()}</b><br>
        <span class="dp-s">Les passages validés porteront la date du ${fmtFR(wd)}</span></span>
      <button class="dp-b" id="dp-today">↩︎ Aujourd'hui</button>
    </div>`;
    const bt = document.getElementById("dp-today");
    if (bt) bt.onclick = () => { setWorkDate(null); openId = null; render(); toast("Retour à aujourd'hui"); };
  }
  // Écran de bienvenue INLINE au premier lancement (jamais modal → jamais figé)
  if (S.firstRun){ renderWelcomeInline(); return; }
  const _b = document.getElementById("board");
  if (_b && _b.style.display === "block") _b.style.display = "";  // rétablit la grille
  // Barre des tournées
  $("#tourbar").innerHTML =
    `<div class="rowlab ac"><span>Tournée</span><i></i></div>
     <div class="rowbox ac">` +
    `<button class="fchip ${S.curTour==="all"?"on":""}" data-t="all">🗺 Toutes</button>` +
    S.tours.map(t => `<button class="fchip ${S.curTour===t?"on":""}" data-t="${esc(t)}">${esc(t)}</button>`).join("") +
    // Vider l'affichage sans changer de tournée — écran net à la demande
    `<button class="fchip ${S.curTour==="none"?"on":""}" data-t="none" style="border-style:dashed">🚫 Aucune</button>` +
    `</div>`;
  $$("#tourbar .fchip").forEach(b => b.onclick = () => { S.curTour = b.dataset.t; save(); openId=null; render(); });
  // Bandeau créneau Matin/Soir (si activé et tournée précise)
  const slotBar = document.getElementById("slotbar");
  if (slotBar){
    if (S.slotsEnabled && S.curTour !== "all"){
      const cur = activeSlot();
      slotBar.style.display = "flex";
      slotBar.innerHTML =
        `<div class="rowlab am"><span>Moment</span><i></i></div>
         <div class="rowbox am">
           <button class="fchip ${cur==="matin"?"on":""}" data-slot="matin">☀️ Matin</button>
           <button class="fchip ${cur==="soir" ?"on":""}" data-slot="soir">🌙 Soir</button>
           <button class="fchip ${cur==="jour" ?"on":""}" data-slot="jour">📅 Journée</button>
         </div>`;
      slotBar.querySelectorAll(".fchip").forEach(b => b.onclick = () => { _viewSlot = b.dataset.slot; openId=null; render(); });
    } else { slotBar.style.display = "none"; slotBar.innerHTML = ""; }
  }

  const tour = S.curTour;
  // Mode compact (grosses tournées) : masque les constantes normales
  document.body.classList.toggle("compact-board", !!S.compactBoard);
  const slot = activeSlot();
  let pool = tour === "none" ? []
           : tour === "all"
    ? activeP()
    : activeP().filter(p => inTourSlot(p, tour, slot));
  pool = sortBySlot(pool, tour, slot);
  const st = pool.map(statusOf);
  const poolIds = new Set(pool.map(p=>p.id));

  /* Le drapeau de clôture ne flotte plus en permanence : il apparaît
     pendant le déroulé, ou dès qu'un passage existe sur la journée.
     Sinon il masque les libellés des cartes pour rien. */
  { const fab = document.getElementById("fab-endtour");
    if (fab) fab.classList.toggle("on",
      (typeof seqActive !== "undefined" && seqActive) || st.some(x => x === "done" || x === "alert"));
  }
  /* Les compteurs SONT les filtres : « À voir », « Vus » et « Vigilance »
     figuraient deux fois (compteur + bouton), ce qui allongeait la barre
     jusqu'au défilement horizontal. Un tap filtre, un second remet Tous. */
  const nRap = S.rappels.filter(r=>!r.done && (!r.pid || poolIds.has(r.pid))).length;
  $("#synth").innerHTML = `
    <div class="rowlab bl"><span>Avancement</span><i></i><em>tape pour filtrer</em></div>
    <div class="rowbox bl">
      <button class="spill ${filter==="todo"?"on":""}"  data-f="todo"><div class="n">${st.filter(x=>x==="todo").length}</div><div class="l">À voir</div></button>
      <button class="spill ok ${filter==="done"?"on":""}"   data-f="done"><div class="n">${st.filter(x=>x==="done").length}</div><div class="l">Vus</div></button>
      <button class="spill warn ${filter==="alert"?"on":""}" data-f="alert"><div class="n">${st.filter(x=>x==="alert").length}</div><div class="l">Vigilance</div></button>
      <button class="spill" data-a="new-rappel"><div class="n">${nRap}</div><div class="l">Rappels</div></button>
    </div>`;
  /* À voir · Vus · Vigilance sont désormais dans les compteurs — plus de doublon ici. */
  const F = [["all","Tous"],["novisit","🚫 Sans passage"],["absent","Absents"]];
  $("#filters").innerHTML =
    `<div class="rowlab nt"><span>Affichage</span><i></i></div>
     <div class="rowbox nt">`
    + F.map(([k,l]) => `<button class="fchip ${filter===k?"on":""}" data-f="${k}">${l}</button>`).join("")
    + `<button class="fchip ${S.compactBoard?"on":""}" id="f-compact" title="${S.compactBoard?"Affichage compact":"Affichage détaillé"}">${S.compactBoard?"📑":"📋"}</button>`
    + `</div>`;
  $$("[data-f]").forEach(b => b.onclick = () => {
    filter = (filter === b.dataset.f) ? "all" : b.dataset.f;   // second tap = Tous
    openId = null; render();
  });
  const fc = document.getElementById("f-compact");
  if (fc) fc.onclick = () => {
    S.compactBoard = !S.compactBoard; save(); render();
    toast(S.compactBoard ? "Affichage compact — seules les alertes sont visibles" : "Affichage détaillé");
  };

  const list = pool.filter(p => filter==="all" || statusOf(p)===filter);
  const cardOf = p => {
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
          ${(S.drafts||{})[p.id] ? `<span class="mini accent">💾 saisie en attente</span>` : ""}
          ${S.curTour==="all" && (p.tours||[]).length ? `<span class="mini">🗺 ${esc(p.tours.join(" · "))}</span>` : ""}
          ${p.docs.length ? `<span class="mini blue">📎 ${p.docs.length}</span>` : ""}
          ${bilansPending(p).length ? `<span class="mini blue">🧪 ${bilansPending(p).length}</span>` : ""}
          ${raps.length ? `<span class="mini amber">📌 ${raps.length}</span>` : ""}
          ${(() => {
            const t = (typeof annivTexte === "function") ? annivTexte(p) : "";
            return t ? `<span class="mini anniv">🎂 ${esc(t)}</span>` : "";
          })()}
          ${(() => {
            const n = (typeof alerteSelles === "function") ? alerteSelles(p) : 0;
            return n ? `<span class="mini amber" style="font-weight:700">💩 ${n} j sans selle</span>` : "";
          })()}
          ${(p.tags||[]).map(t=>{
            const T = PATIENT_TAGS[t]; if (!T) return "";
            const age = T.kind === "evt" ? tagAge(p, t) : null;
            const vieux = age !== null && age >= 3 ? ";opacity:.55" : "";
            return `<span class="mini ${t==="prioritaire"?"amber":"blue"}" style="${t==="prioritaire"?"font-weight:700":""}${vieux}">${T.ic} ${esc(T.lbl)}</span>`;
          }).join("")}
        </div>
        <div class="lastseen">${lv ? (lv.date===workDate() ? (isToday()?"vu aujourd'hui à ":"vu ce jour-là à ")+esc(lv.at) : "dernier passage : "+esc(fmtFR(lv.date))+" "+esc(lv.at)) : "jamais vu"}</div>
      </button>
      ${open ? inlineForm(p) : ""}
    </div>`;
  };

  const vide = S.curTour === "none"
    ? `<div style="grid-column:1/-1">${uiEmpty("🚫","Affichage vidé",
        "Choisis une tournée ci-dessus pour revoir tes patients.")}</div>`
    : `<p class="muted" style="grid-column:1/-1;text-align:center;padding:30px 0">${
    !S.patients.length ? "Aucun patient — crée le premier avec ＋"
    : !activeP().length ? "Tous les dossiers sont mis de côté (🦗 → Mes patients)."
    : S.curTour!=="all" && !activeP().filter(inTour).length ? "Aucun patient dans la tournée « "+esc(S.curTour)+" » — assigne-les depuis leur fiche."
    : "Rien dans ce filtre."}</p>`;

  /* Vue JOURNÉE : sections repliables par créneau, avec compteurs.
     Un patient présent matin ET soir figure dans les deux sections. */
  if (slot === "jour" && S.curTour !== "all"){
    S.slotFold = S.slotFold || {};
    const sections = ["matin","soir"].map(sl => {
      const sub = sortBySlot(list.filter(p => slotsOf(p, S.curTour).includes(sl)), S.curTour, sl);
      if (!sub.length) return "";
      const sts = sub.map(statusOf);
      const nDone = sts.filter(x => x === "done").length;
      const nTodo = sts.filter(x => x === "todo" || x === "alert").length;
      const L = SLOT_LBL[sl] || { ic:"", lbl:sl };
      const fold = !!S.slotFold[sl];
      return `<div class="slotsec ${sl}">
        <button class="slotsec-h" data-fold="${sl}">
          <span class="ss-ic">${L.ic}</span>
          <span class="ss-l">${esc(L.lbl.toUpperCase())}</span>
          <span class="ss-n">${nDone ? nDone + " vu" + (nDone>1?"s":"") : ""}${nDone&&nTodo?" · ":""}${nTodo ? nTodo + " à voir" : ""}${!nDone&&!nTodo?sub.length+" patient"+(sub.length>1?"s":""):""}</span>
          <span class="ss-c">${fold ? "▸" : "▾"}</span>
        </button>
        ${fold ? "" : `<div class="slotsec-b">${sub.map(cardOf).join("")}</div>`}
      </div>`;
    }).join("");
    $("#board").innerHTML = sections || vide;
    $("#board").classList.add("byslot");
    $$("#board [data-fold]").forEach(b => b.onclick = () => {
      S.slotFold[b.dataset.fold] = !S.slotFold[b.dataset.fold];
      save(); render();
    });
  } else {
    $("#board").classList.remove("byslot");
    $("#board").innerHTML = list.map(cardOf).join("") || vide;
  }

  { const pv = $("#d-prev"); if (pv) pv.onclick = () => { shiftWorkDate(-1); openId=null; render(); };
    const nx = $("#d-next"); if (nx) nx.onclick = () => { if (!isToday()){ shiftWorkDate(1); openId=null; render(); } }; }

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
      ${adresseComplete(p) ? `<button class="tool" data-gps="${p.id}" style="flex:1 1 30%" title="${esc(adresseComplete(p))}">🗺️ GPS</button>` : ""}
      ${Object.keys(p.contacts||{}).length ? `<button class="tool" data-annuaire="${p.id}" style="flex:1 1 30%">📞 Appels</button>` : ""}
      <button class="tool" data-edit="${p.id}" style="flex:1 1 30%">✏️ Fiche</button>
    </div>
    ${shownInfos(p).map(it => { const T=infoType(it.type);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:7px 11px;margin-bottom:5px">${T.ic} ${esc(it.txt)}</div>`;
    }).join("")}
    <div class="rowlab am"><span>Ce passage</span><i></i></div>
    <div class="rowbox am" style="display:block;margin-bottom:12px">
    ${S.slotsEnabled ? `<div class="chips" data-slotrow style="margin:0 0 6px">
      <button class="chip ${(_curSlot||defaultSlot())==="matin"?"on":""}" data-slot="matin" style="flex:1;justify-content:center">☀️ Matin</button>
      <button class="chip ${(_curSlot||defaultSlot())==="soir"?"on":""}" data-slot="soir" style="flex:1;justify-content:center">🌙 Soir</button>
    </div>
    <p class="small muted" data-slothint style="margin:0 0 8px">Ce que tu coches est attribué au passage sélectionné.</p>` : ""}
    <div class="chips" data-tagrow style="margin-top:2px">
      ${Object.entries(PATIENT_TAGS).map(([k,t])=>{
        const on  = (p.tags||[]).includes(k);
        const m   = (p.tagMeta||{})[k] || {};
        const age = on && t.kind === "evt" ? tagAge(p, k) : null;
        // Une pastille événementielle s'atténue avec l'âge : rien ne se perd,
        // mais l'œil distingue ce qui est frais de ce qui traîne.
        const vieux = age !== null && age >= 3 ? " old" : "";
        return `<button class="chip ${on?"on":""}${vieux}" data-tag="${k}" style="font-size:12px">${t.ic} ${esc(t.lbl)}${
          age !== null ? ` <span class="tg-age">${esc(tagAgeLbl(age))}</span>` : ""}${
          on && m.note ? ' <span class="tg-note">💬</span>' : ""}</button>`;
      }).join("")}
      ${(p.tags||[]).filter(k => ((p.tagMeta||{})[k]||{}).note).map(k => {
        const t = PATIENT_TAGS[k], m = p.tagMeta[k];
        return `<div class="tgcom" style="--tc:${k==="prioritaire"?"var(--danger)":k==="medecin"?"var(--accent)":"var(--amber)"}">
          <div class="tgc-h">${t.ic} ${esc(t.lbl)}</div>
          <div class="tgc-t">${esc(m.note)}</div>
        </div>`;
      }).join("")}
    </div>
    </div>

    <div class="rowlab ac"><span>Soins réalisés</span><i></i><em>★ = plan de soins</em></div>
    <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="small muted" style="margin-bottom:7px">💡 Appui long sur un soin (ou tape ✏️) pour un commentaire du jour</div>
      <div class="chips" data-chips="1">
        ${planFor(p, S.slotsEnabled ? (_curSlot || activeSlot() || defaultSlot()) : null).map(x=>{
          const r = (p.planRythme||{})[x];
          // L'étoile porte le créneau : ambre matin, bleu soir, neutre les deux
          const sl = (p.planSlots||{})[x] || {};
          const cls = (sl.matin && !sl.soir) ? " s-am" : (sl.soir && !sl.matin) ? " s-bl" : "";
          return `<button class="chip star${cls}" data-s="${esc(x)}">${esc(x)}${r?` <span class="rythme">${esc(r)}</span>`:""}${getSoinProtocol(x)?" 📋":""}</button>`;
        }).join("")}
        <button class="chip add" data-addsoin="1">＋ autre…</button>
      ${S.slotsEnabled && Object.keys(p.planSlots||{}).length ? `<div class="slotleg">
        <span class="l-am"><b>★</b> matin</span>
        <span class="l-bl"><b>★</b> soir</span>
        <span><b>★</b> les deux</span></div>` : ""}
      </div>
      <div style="margin-top:4px"><input class="plan-search" id="soin-srch-${p.id}" placeholder="🔍 Chercher un soin…" style="font-size:13px"></div>
      <div id="soin-srch-res-${p.id}" class="chips" style="min-height:0;margin-top:4px"></div>
    </div>
    <div>
    </div>

    <div class="rowlab bl"><span>Constantes</span><i></i><em>si mesurées</em></div>
    <div class="rowbox bl" style="display:block;margin-bottom:12px">
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
      <div class="selrow">
        <label>Selles</label>
        <div class="selbtns">
          ${SELLES_VAL.map(v => `<button type="button" class="selb${
            v.k==="diarrhee" ? " dia" : ""}" data-sel="${v.k}">${v.lbl}</button>`).join("")}
        </div>
      </div>
      <p class="alertline" data-al="1" style="margin-top:8px"></p>
      <div class="chips" style="margin-top:4px">
        <button class="chip" data-constrel style="font-size:12px">📤 Inclure dans la relève</button>
      </div>
      <p class="small muted" style="margin-top:3px">Les constantes sont toujours enregistrées dans l'historique du patient. Coche pour qu'elles figurent aussi dans la relève.</p>
    </div>
    <div>
    </div>

    <div class="rowlab vi"><span>Transmission</span><i></i><em>événements rapides</em></div>
    <div class="rowbox vi" style="display:block;margin-bottom:12px">
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
    <div class="formbtns">
      <button class="btn btn-ghost" data-cancel="1">Annuler</button>
      <button class="btn btn-ghost" data-keep="1">💾 Enregistrer</button>
      <button class="btn btn-primary fb-wide" data-save="1">${_formDraft && _formDraft.pid===p.id && _formDraft._editUid ? "✓ Enregistrer les modifications" : "✓ Valider le passage"}</button>
    </div>
    <p class="small muted" style="margin-top:6px;text-align:center">💾 conserve ta saisie sans valider le passage</p>
  </div>`;
}

let _soinNotes = {}; // commentaires par soin pour le passage en cours
let _curSlot = null;  // créneau courant du formulaire ("matin"/"soir") si activé
function _saveDraft(f, pid){
  if (!f) return;
  const soins = [...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s);
  const consts = {};
  { const sb = f.querySelector(".selb.on"); if (sb) consts.selles = sb.dataset.sel; }
  f.querySelectorAll("[data-c]").forEach(i=>{ if(i.value.trim()) consts[i.dataset.c]=i.value.trim(); });
  const taS = f.querySelector("[data-ta-s]")?.value||"";
  const taD = f.querySelector("[data-ta-d]")?.value||"";
  const note = f.querySelector("[data-note]")?.value||"";
  const constRel = !!f.querySelector("[data-constrel].on");
  const dardOn = !!f._dardOn;
  _formDraft = { pid, soins, consts, taS, taD, note, soinNotes:{..._soinNotes}, constRel, dardOn };
}
function _restoreDraft(f, pid){
  // Reprendre une saisie enregistrée avec 💾 (elle survit à la fermeture de l'app)
  if ((!_formDraft || _formDraft.pid !== pid) && (S.drafts||{})[pid]){
    _formDraft = { ...S.drafts[pid], pid };
  }
  /* Patient déjà vu aujourd'hui : recharger son passage pour le compléter.
     Cas courant — la patiente demande un soin de plus après la validation. */
  if (!_formDraft || _formDraft.pid !== pid){
    const pp = getP(pid);
    const sl = S.slotsEnabled ? (_curSlot || activeSlot() || defaultSlot()) : null;
    const v = pp && (pp.visits||[]).find(x => x.date === workDate() &&
              (!S.slotsEnabled || sl === "jour" || (x.slot||defaultSlot()) === sl));
    if (v){
      _formDraft = { pid, soins:[...(v.soins||[])], consts:{...(v.consts||{})},
                     taS:"", taD:"", note:v.note||"",
                     soinNotes:{...(v.soinNotes||{})}, constRel:!!v.constRel, dardOn:!!v.dar,
                     _editUid:v.uid };
      if (v.consts && v.consts.ta){
        const t = String(v.consts.ta).split("/");
        _formDraft.taS = t[0]||""; _formDraft.taD = t[1]||"";
      }
    }
  }
  if (!_formDraft || _formDraft.pid !== pid){ _soinNotes = {}; return; }
  const d = _formDraft;
  _soinNotes = { ...(d.soinNotes||{}) };
  // Restaurer les soins
  d.soins.forEach(sn => {
    let c = f.querySelector(`.chip[data-s="${CSS.escape(sn)}"]`);
    if (!c){
      c = document.createElement("button");
      c.className="chip on"; c.dataset.s=sn; c.textContent=sn;
      const addBtn = f.querySelector("[data-addsoin]");
      if (addBtn) f.querySelector("[data-chips]").insertBefore(c, addBtn);
      armerChipSoin(c, getP(pid), f, decorateChip, openSoinComment);   // crayon, appui long, commentaire
    } else { c.classList.add("on"); decorateChip(c); }
  });
  // Restaurer TA
  const taS=f.querySelector("[data-ta-s]"), taD=f.querySelector("[data-ta-d]");
  if (taS&&d.taS) taS.value=d.taS;
  if (taD&&d.taD) taD.value=d.taD;
  const taHid=f.querySelector("[data-c='ta']");
  if (taHid&&d.taS&&d.taD) taHid.value=d.taS+"/"+d.taD;
  // Restaurer les selles
  { const v = (d.consts||{}).selles;
    if (v !== undefined && v !== ""){
      const b = f.querySelector(`.selb[data-sel="${CSS.escape(String(v))}"]`);
      if (b) b.classList.add("on");
    } }
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
    // Le rythme du plan de soins doit survivre à la redécoration :
    // cette fonction réécrit tout le contenu du chip.
    const r = (p.planRythme||{})[sn];
    const base = esc(sn) + (r ? ` <span class="rythme">${esc(r)}</span>` : "")
               + (getSoinProtocol(sn) ? " 📋" : "");
    // ✏️ visible sur les soins cochés (invite à commenter) · 💬 si un commentaire existe
    c.innerHTML = base + (_soinNotes[sn] ? ' <span style="opacity:.9">💬</span>' : (on ? ' <span style="opacity:.55">✏️</span>' : ""));
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
  /* ⚠️ Tout soin créé en cours de saisie DOIT passer par armerChipSoin.
     Un simple onclick=toggle donne un soin cochable mais sans crayon,
     sans appui long, sans commentaire possible — c'était le cas des
     soins repris par J-1. */
  /* ⚠️ Isolé volontairement : si armerChipSoin échoue sur UN soin, le
     câblage des outils qui suit (Docs, Bilans, J-1, Fiche…) ne doit pas
     s'interrompre — sinon TOUS les boutons de la carte deviennent muets. */
  f.querySelectorAll(".chip[data-s]").forEach(c => {
    try { armerChipSoin(c, p, f, decorateChip, openSoinComment); }
    catch(e){ logIncident("carte", "Soin non armé : " + (c.dataset.s||"?"), e); }
  });
  /* Trace de diagnostic : si des boutons restent muets, l'incident
     dira lesquels. Consultable dans 🩺 Santé de l'application. */
  setTimeout(() => {
    try {
      const bs = [...f.querySelectorAll("button")];
      const muets = bs.filter(b => !b.onclick && !b.dataset.toggle);
      if (muets.length > 2){
        logIncident("carte", muets.length + "/" + bs.length + " boutons sans action",
          new Error(muets.slice(0,5).map(b => (b.textContent||"").trim().slice(0,14)).join(" · ")));
      }
    } catch(e){}
  }, 300);
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
        armerChipSoin(btn, p, f, decorateChip, openSoinComment);
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

  qEl(f, "data-addsoin").onclick = () => {
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
      f.querySelector("[data-chips]").insertBefore(btn, addBtn);
      armerChipSoin(btn, p, f, decorateChip, openSoinComment);
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
  qEl(f, "data-mic").onclick = e => { e.preventDefault(); dictate(f.querySelector("[data-note]"), f.querySelector("[data-mic]")); };
  // ── Tags de priorité ──
  /* Selles : un seul choix actif. Retaper le même bouton l'efface —
     « 0 » reste une valeur, l'absence de bouton actif signifie non renseigné. */
  f.querySelectorAll(".selb").forEach(b => b.onclick = () => {
    const dejaActif = b.classList.contains("on");
    f.querySelectorAll(".selb").forEach(x => x.classList.remove("on"));
    if (!dejaActif) b.classList.add("on");
    _saveDraft(f, p.id);
  });

  f.querySelectorAll("[data-tag]").forEach(b => {
    const k = b.dataset.tag;
    const T = PATIENT_TAGS[k] || {};
    /* Appui long : commenter la pastille — même geste que pour un soin.
       « Matériel à apporter » ne disait pas QUEL matériel ; le commentaire
       part maintenant dans la relève avec la pastille. */
    let _lt = null;
    const ask = async () => {
      if (!(p.tags||[]).includes(k)) return;   // rien à commenter si éteinte
      p.tagMeta = p.tagMeta || {};
      const m = p.tagMeta[k] || {};
      const v = await askText(T.lbl, {
        ic: T.ic, sub:"Précision (facultatif)", val:m.note || "",
        ph: k === "medecin" ? "Dr Blanc prévenu de la TA" : "ce qu'il faut savoir",
        aide: k === "medecin" ? "Ex. : rappelle demain, ordonnance à récupérer…" : "",
        oui:"✓ Noter" });
      if (v === false || v === null) return;
      const t = v.trim();
      if (t) p.tagMeta[k] = { ...m, note:t }; else if (m.note) delete p.tagMeta[k].note;
      save(); render();
    };
    b.addEventListener("touchstart", () => { _lt = setTimeout(ask, 550); }, { passive:true });
    ["touchend","touchmove","touchcancel"].forEach(ev =>
      b.addEventListener(ev, () => clearTimeout(_lt), { passive:true }));
    b.addEventListener("contextmenu", e => { e.preventDefault(); ask(); });

    b.onclick = () => {
    p.tags = p.tags || [];
    const i = p.tags.indexOf(k);
    if (i >= 0) p.tags.splice(i,1); else p.tags.push(k);
    // Une pastille événementielle retient SA date d'activation
    if (i < 0 && T.kind === "evt"){
      p.tagMeta = p.tagMeta || {};
      p.tagMeta[k] = { ...(p.tagMeta[k]||{}), at: workDate() };
    }
    if (i >= 0 && p.tagMeta) delete p.tagMeta[k];   // éteinte = on oublie tout
    b.classList.toggle("on", i < 0);
    save(); render();
    };
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
  qEl(f, "data-cancel").onclick = async () => {
    // Ne pas jeter silencieusement une saisie en cours
    const soinsOn = f.querySelectorAll(".chip[data-s].on").length;
    const noteTxt = (f.querySelector("[data-note]")?.value||"").trim();
    const cstTxt  = [...f.querySelectorAll("[data-c]")].some(i => (i.value||"").trim());
    if ((soinsOn || noteTxt || cstTxt) &&
        !await askDialog({ ton:"danger", ic:"↩️", titre:"Abandonner cette saisie ?", warn:"Les soins cochés, les constantes et la transmission seront perdus.", oui:"Abandonner" })) return;
    _formDraft=null; _soinNotes={}; _curSlot=null; openId=null;
    /* ⚠️ Dans le déroulé, le formulaire n'est PAS une carte : render()
       redessine la liste, qui est masquée — l'écran séquentiel restait
       affiché avec son texte. Il faut le redessiner lui. */
    if (typeof seqActive !== "undefined" && seqActive && typeof renderSeq === "function") renderSeq();
    else render();
  };

  /* 💾 Enregistrer sans valider — la saisie est conservée durablement
     (elle survit à la fermeture de l'app) mais le patient reste « à voir ». */
  const keepBtn = f.querySelector("[data-keep]");
  if (keepBtn) keepBtn.onclick = () => {
    _saveDraft(f, p.id);
    if (!_formDraft){ toast("Rien à enregistrer"); return; }
    S.drafts = S.drafts || {};
    S.drafts[p.id] = { ..._formDraft, at: Date.now() };
    save();
    _curSlot = null; openId = null; render();
    toast("Saisie enregistrée 💾 — le passage n'est pas encore validé");
  };
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
  const commitVisit = async (silent) => {
    const soins = [...f.querySelectorAll(".chip.on[data-s]")].map(c=>c.dataset.s);
    const consts = {}; inputs.forEach(i => { if(i.value.trim()) consts[i.dataset.c]=i.value.trim(); });
    const note = f.querySelector("[data-note]").value.trim();
    if (!soins.length && !Object.keys(consts).length && !note){ if(!silent) toast("Rien à enregistrer."); return false; }
    const sNotes = {};
    soins.forEach(sn => { if (_soinNotes[sn]) sNotes[sn] = _soinNotes[sn]; });
    const constRel = !!f.querySelector("[data-constrel].on");
    const dardOn = !!f._dardOn;
    /* Doublon : un passage existe déjà aujourd'hui sur le même créneau.
       Sans ce contrôle, valider depuis la carte puis depuis le déroulé
       créait deux passages le même jour. */
    const _slot = S.slotsEnabled ? (_curSlot || defaultSlot()) : null;
    /* Passage rechargé pour modification : on le met à jour directement,
       sans redemander confirmation — l'intention est explicite. */
    const editUid = _formDraft && _formDraft.pid === p.id ? _formDraft._editUid : null;
    if (editUid){
      const ev = (p.visits||[]).find(v => v.uid === editUid);
      if (ev){
        ev.soins = soins; ev.consts = consts; ev.note = note;
        ev.soinNotes = sNotes; ev.constRel = constRel; ev.dar = dardOn;
        if (typeof logChange==="function") logChange("update","visit", p.id+"|"+ev.uid, ev);
        _soinNotes = {}; _formDraft = null;
        if (S.drafts && S.drafts[p.id]) delete S.drafts[p.id];
        if (!silent) toast("Passage modifié ✓");
        return true;
      }
    }

    const dbl = (p.visits||[]).find(v => v.date === workDate() &&
                (!S.slotsEnabled || (v.slot||defaultSlot()) === _slot));
    if (dbl && !silent){
      const sl = _slot && SLOT_LBL[_slot] ? " " + SLOT_LBL[_slot].ic + " " + SLOT_LBL[_slot].lbl.toLowerCase() : "";
      /* Avant : « OK = compléter / Annuler = garder séparé » — deux actions
         déguisées en oui/non. Chacune porte maintenant son nom. */
      const rep = "fusion" === await askChoice({
        ic:"🔁", titre:"Passage déjà enregistré",
        sub:`${esc(p.prenom)} a déjà un passage aujourd'hui (${esc(sl.trim())} ${esc(dbl.at||"")}).`,
        options:[ { ic:"🔗", lbl:"Compléter ce passage", val:"fusion" },
                  { ic:"➕", lbl:"Garder les deux séparés", val:"separe" } ] });
      if (rep){
        // Fusion dans le passage existant
        dbl.soins = [...new Set([...(dbl.soins||[]), ...soins])];
        dbl.consts = { ...(dbl.consts||{}), ...consts };
        if (note) dbl.note = dbl.note ? (dbl.note + "\n" + note) : note;
        if (Object.keys(sNotes).length) dbl.soinNotes = { ...(dbl.soinNotes||{}), ...sNotes };
        if (constRel) dbl.constRel = true;
        if (dardOn) dbl.dar = true;
        dbl.at = nowHM();
        if (typeof logChange==="function") logChange("update","visit", p.id+"|"+dbl.uid, dbl);
        _soinNotes = {}; _formDraft = null;
        if (S.drafts && S.drafts[p.id]) delete S.drafts[p.id];
        return true;
      }
    }

    const _v = { uid:uid(), date:workDate(), at:nowHM(), soins, consts, note,
      ...(S.slotsEnabled ? { slot:(_curSlot||defaultSlot()) } : {}),
      ...(Object.keys(sNotes).length ? { soinNotes:sNotes } : {}),
      ...(constRel ? { constRel:true } : {}),      // constantes à faire figurer dans la relève
      ...(dardOn ? { dar:true } : {}) };           // passage structuré DAR
    p.visits.push(_v);
    _lastVisitUid = { pid:p.id, uid:_v.uid };   // pour l'annulation immédiate
    if (typeof logChange==="function") logChange("add","visit", p.id+"|"+_v.uid, _v);
    _soinNotes = {}; _formDraft = null;
    if (S.drafts && S.drafts[p.id]){ delete S.drafts[p.id]; }   // saisie consommée
    return true;
  };
  f._commitVisit = commitVisit; // exposé pour le mode séquentiel
  qEl(f, "data-save").onclick = () => {
    if (!commitVisit(false)) return;
    _curSlot = null;
    openId = null; save(true);
    /* Lien d'annulation : rattrape une validation partie trop vite. */
    const uv = _lastVisitUid;
    if (uv){
      toast("Passage enregistré ✓", { label:"Annuler", ms:6000, action:() => {
        const pp = getP(uv.pid);
        if (!pp) return;
        const i = (pp.visits||[]).findIndex(v => v.uid === uv.uid);
        if (i < 0){ toast("Ce passage n'existe plus"); return; }
        pp.visits.splice(i, 1);
        if (typeof logChange==="function") logChange("delete","visit", uv.pid+"|"+uv.uid, {});
        _lastVisitUid = null; save(true); render();
        toast("Passage annulé ↩︎");
      }});
    } else toast("Passage enregistré ✓");
    render();
  };
  qEl(f, "data-docs").onclick = () => sheetDocs(p.id);
  qEl(f, "data-bilans").onclick = () => sheetBilans(p.id);
  qEl(f, "data-raps").onclick = () => sheetRappels(p.id);
  qEl(f, "data-hist").onclick = () => sheetHist(p.id);
  qEl(f, "data-clone").onclick = () => {
    /* Reprendre le passage précédent DU MÊME CRÉNEAU.
       ⚠️ Avant : le dernier passage tout court — le matin, J-1 ressortait
       le soir de la veille, avec pilulier du soir et coucher.
       Si le créneau n'a pas de passage hier, on remonte au dernier du
       même créneau : le plan du matin reste le plan du matin. */
    const lastV = (() => {
      const tous = (p.visits||[]).slice()
        .sort((a,b) => (b.date+b.at).localeCompare(a.date+a.at));
      // Même détermination que le formulaire : choix explicite, sinon l'heure
      const cr = _curSlot || (typeof activeSlot === "function" ? activeSlot() : null)
                 || (typeof defaultSlot === "function" ? defaultSlot() : null);
      if (cr){
        const memeCreneau = tous.filter(v => (v.slot || null) === cr);
        if (memeCreneau.length) return memeCreneau[0];
      }
      return tous[0];      // aucun passage dans ce créneau : le dernier connu
    })();
    const plan = p.plan||[];
    const soins = lastV ? lastV.soins : plan;
    // Cocher les soins — décorer après chaque changement d'état, sinon
    // le crayon ne suit pas (il n'apparaît que sur un soin coché)
    f.querySelectorAll(".chip[data-s]").forEach(c=>{ c.classList.remove("on"); decorateChip(c); });
    soins.forEach(s => {
      let c = f.querySelector(`.chip[data-s="${CSS.escape(s)}"]`);
      if (!c){ c=document.createElement("button"); c.className="chip on"; c.dataset.s=s; c.textContent=s;
        f.querySelector("[data-chips]").insertBefore(c, f.querySelector("[data-addsoin]"));
        armerChipSoin(c, p, f, decorateChip, openSoinComment); }   // crayon, appui long, commentaire
      // ⚠️ Un soin DÉJÀ présent doit être redécoré : le crayon n'apparaît
      // que sur un soin coché, et cocher seul ne réécrit pas le contenu.
      else { c.classList.add("on"); decorateChip(c); }
    });
    // Pré-remplir la note
    const noteEl = f.querySelector("[data-note]");
    noteEl.value = "Soins conformes au plan habituel, état stable.";
    toast("Pré-rempli sur le dernier passage 🔁");
  };
  { const e = f.querySelector("[data-graph]"); if (e) e.onclick = () => sheetGraphConstantes(p.id); }
  const gpsBtn = f.querySelector("[data-gps]");
  if (gpsBtn) gpsBtn.onclick = () => {
    const addr = encodeURIComponent(p.address||"");
    window.open(`geo:0,0?q=${addr}`, "_system");
  };
  const annBtn = f.querySelector("[data-annuaire]");
  if (annBtn) annBtn.onclick = () => sheetAnnuaire(p);
  { const e = f.querySelector("[data-edit]"); if (e) e.onclick = () => sheetPatient(p); }
}

/* ---------- Feuilles génériques ---------- */

/* Poser les gestes d'un soin : cocher, commenter, menu d'appui long.
   Appelée à la construction du formulaire ET à chaque soin ajouté
   ensuite — par J-1, par la recherche, par « ＋ autre… ». */
/* ⚠️ `qEl(f, "data-x").onclick = …` lève une TypeError quand
   l'élément n'existe pas, et TOUT le câblage qui suit est perdu : Docs,
   Bilans, J-1, Fiche… tous les boutons de la carte deviennent muets.
   `q(f,"data-x")` renvoie un objet inerte plutôt que null. */
const _INERTE = new Proxy({}, { get:()=>()=>{}, set:()=>true });
function qEl(f, attr){
  try { return f.querySelector("[" + attr + "]") || _INERTE; }
  catch(e){ return _INERTE; }
}

function armerChipSoin(c, p, f, deco, ouvrirNote){
  /* ⚠️ decorateChip et openSoinComment sont LOCALES au formulaire :
     elles dépendent du patient courant. On les reçoit en paramètre
     plutôt que de les chercher globalement. */
  deco(c);
  let lpTimer = null, lpFired = false;
  c.onclick = (e) => {
    if (lpFired){ lpFired = false; return; }   // ne pas basculer après un appui long
    // Tap sur le crayon ou la bulle → ouvrir le commentaire
    if (e.target.closest("span") && (c.classList.contains("on") || _soinNotes[c.dataset.s])){
      ouvrirNote(c); return;
    }
    c.classList.toggle("on"); deco(c); _saveDraft(f, p.id);
  };
  c.addEventListener("pointerdown", () => {
    lpFired = false;
    lpTimer = setTimeout(() => { lpFired = true; menuSoin(c, p, f); }, 550);
  });
  ["pointerup","pointerleave","pointercancel"].forEach(ev =>
    c.addEventListener(ev, () => clearTimeout(lpTimer)));
}

/* ============================================================
   MENU D'UN SOIN — appui long
   ─────────────────────────────────────────────────────────
   L'appui long ne faisait qu'ouvrir le commentaire. Un soin
   ajouté à la volée n'avait donc AUCUN moyen d'être retiré :
   une erreur de frappe restait là jusqu'à la fermeture.

   Le menu s'adapte au chip : un soin du plan ne se retire pas
   (on le décoche), un soin ajouté oui.
============================================================ */
async function menuSoin(chip, p, f){
  const nom     = chip.dataset.s;
  const duPlan  = (p.plan || []).includes(nom);
  const aNote   = !!(_soinNotes && _soinNotes[nom]);

  const options = [{ ic:"💬", lbl: aNote ? "Modifier le commentaire" : "Ajouter un commentaire", val:"note" }];
  if (aNote)   options.push({ ic:"🧹", lbl:"Effacer le commentaire", val:"clr" });
  if (!duPlan) options.push({ ic:"🗑", lbl:"Retirer de ce passage",  val:"del" });

  // Un seul choix possible : inutile d'ouvrir un menu
  if (options.length === 1){ openSoinComment(chip); return; }

  const c = await askChoice({
    ic:"💉", titre: nom,
    sub: duPlan ? "Soin du plan de soins" : "Ajouté à ce passage",
    options });
  if (!c) return;

  if (c === "note"){ openSoinComment(chip); return; }
  if (c === "clr"){
    delete _soinNotes[nom];
    decorateChip(chip); _saveDraft(f, p.id);
    toast("Commentaire effacé");
    return;
  }
  if (c === "del"){
    delete _soinNotes[nom];
    chip.remove();
    _saveDraft(f, p.id);
    toast(`« ${nom} » retiré de ce passage`);
  }
}
