function lastVisit(p){ return [...p.visits].sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at)).pop(); }
function statusOf(p){
  const t = todayISO();
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
  $("#h-date").textContent = new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  // Écran de bienvenue INLINE au premier lancement (jamais modal → jamais figé)
  if (S.firstRun){ renderWelcomeInline(); return; }
  const _b = document.getElementById("board");
  if (_b && _b.style.display === "block") _b.style.display = "";  // rétablit la grille
  // Barre des tournées
  $("#tourbar").innerHTML =
    `<button class="fchip ${S.curTour==="all"?"on":""}" data-t="all">🗺 Toutes</button>` +
    S.tours.map(t => `<button class="fchip ${S.curTour===t?"on":""}" data-t="${esc(t)}">${esc(t)}</button>`).join("");
  $$("#tourbar .fchip").forEach(b => b.onclick = () => { S.curTour = b.dataset.t; save(); openId=null; render(); });
  // Bandeau créneau Matin/Soir (si activé et tournée précise)
  const slotBar = document.getElementById("slotbar");
  if (slotBar){
    if (S.slotsEnabled && S.curTour !== "all"){
      const cur = activeSlot();
      slotBar.style.display = "flex";
      slotBar.innerHTML =
        `<button class="fchip ${cur==="matin"?"on":""}" data-slot="matin">☀️ Matin</button>` +
        `<button class="fchip ${cur==="soir"?"on":""}" data-slot="soir">🌙 Soir</button>`;
      slotBar.querySelectorAll(".fchip").forEach(b => b.onclick = () => { _viewSlot = b.dataset.slot; openId=null; render(); });
    } else { slotBar.style.display = "none"; slotBar.innerHTML = ""; }
  }

  const tour = S.curTour;
  // Mode compact (grosses tournées) : masque les constantes normales
  document.body.classList.toggle("compact-board", !!S.compactBoard);
  const slot = activeSlot();
  let pool = tour === "all"
    ? activeP()
    : activeP().filter(p => inTourSlot(p, tour, slot));
  pool = sortBySlot(pool, tour, slot);
  const st = pool.map(statusOf);
  const poolIds = new Set(pool.map(p=>p.id));
  $("#synth").innerHTML = `
    <div class="spill"><div class="n">${st.filter(x=>x==="todo").length}</div><div class="l">À voir</div></div>
    <div class="spill ok"><div class="n">${st.filter(x=>x==="done").length}</div><div class="l">Vus</div></div>
    <div class="spill warn"><div class="n">${st.filter(x=>x==="alert").length}</div><div class="l">Vigilance</div></div>
    <div class="spill"><div class="n">${S.rappels.filter(r=>!r.done && (!r.pid || poolIds.has(r.pid))).length}</div><div class="l">Rappels</div></div>`;
  const F = [["all","Tous"],["todo","À voir"],["alert","⚠ Vigilance"],["done","Vus"],["novisit","🚫 Sans passage"],["absent","Absents"]];
  $("#filters").innerHTML = F.map(([k,l]) => `<button class="fchip ${filter===k?"on":""}" data-f="${k}">${l}</button>`).join("")
    + `<button class="fchip ${S.compactBoard?"on":""}" id="f-compact" title="Affichage compact">${S.compactBoard?"📑 Compact":"📋 Détaillé"}</button>`;
  $$("#filters .fchip[data-f]").forEach(b => b.onclick = () => { filter=b.dataset.f; render(); });
  const fc = document.getElementById("f-compact");
  if (fc) fc.onclick = () => {
    S.compactBoard = !S.compactBoard; save(); render();
    toast(S.compactBoard ? "Affichage compact — seules les alertes sont visibles" : "Affichage détaillé");
  };

  const list = pool.filter(p => filter==="all" || statusOf(p)===filter);
  $("#board").innerHTML = list.map(p => {
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
          ${(p.tags||[]).map(t=>PATIENT_TAGS[t]?`<span class="mini ${t==="prioritaire"?"amber":"blue"}" style="${t==="prioritaire"?"font-weight:700":""}">${PATIENT_TAGS[t].ic} ${PATIENT_TAGS[t].lbl}</span>`:"").join("")}
        </div>
        <div class="lastseen">${lv ? (lv.date===todayISO() ? "vu aujourd'hui à "+esc(lv.at) : "dernier passage : "+esc(fmtFR(lv.date))+" "+esc(lv.at)) : "jamais vu"}</div>
      </button>
      ${open ? inlineForm(p) : ""}
    </div>`;
  }).join("") || `<p class="muted" style="grid-column:1/-1;text-align:center;padding:30px 0">${
    !S.patients.length ? "Aucun patient — crée le premier avec ＋"
    : !activeP().length ? "Tous les dossiers sont archivés (🗺️ → Archives)."
    : S.curTour!=="all" && !activeP().filter(inTour).length ? "Aucun patient dans la tournée « "+esc(S.curTour)+" » — assigne-les depuis leur fiche."
    : "Rien dans ce filtre."}</p>`;

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
      ${p.address ? `<button class="tool" data-gps="${p.id}" style="flex:1 1 30%" title="${esc(p.address)}">🗺️ GPS</button>` : ""}
      ${Object.keys(p.contacts||{}).length ? `<button class="tool" data-annuaire="${p.id}" style="flex:1 1 30%">📞 Appels</button>` : ""}
      <button class="tool" data-edit="${p.id}" style="flex:1 1 30%">✏️ Fiche</button>
    </div>
    ${shownInfos(p).map(it => { const T=infoType(it.type);
      return `<div class="small" style="background:rgba(127,127,127,.07);border-left:3px solid ${T.col};border-radius:0 10px 10px 0;padding:7px 11px;margin-bottom:5px">${T.ic} ${esc(it.txt)}</div>`;
    }).join("")}
    ${S.slotsEnabled ? `<div class="chips" data-slotrow style="margin:6px 0">
      <button class="chip ${(_curSlot||defaultSlot())==="matin"?"on":""}" data-slot="matin" style="flex:1;justify-content:center">☀️ Matin</button>
      <button class="chip ${(_curSlot||defaultSlot())==="soir"?"on":""}" data-slot="soir" style="flex:1;justify-content:center">🌙 Soir</button>
    </div>
    <p class="small muted" data-slothint style="margin:0 0 8px">Ce que tu coches est attribué au passage sélectionné.</p>` : ""}
    <div class="chips" data-tagrow style="margin-top:2px">
      ${Object.entries(PATIENT_TAGS).map(([k,t])=>`<button class="chip ${(p.tags||[]).includes(k)?"on":""}" data-tag="${k}" style="font-size:12px">${t.ic} ${t.lbl}</button>`).join("")}
    </div>
    <div>
      <div class="lab" style="margin-bottom:3px">Soins réalisés <span style="text-transform:none;letter-spacing:0;color:var(--faint)">(★ = plan de soins)</span></div>
      <div class="small muted" style="margin-bottom:7px">💡 Appui long sur un soin (ou tape ✏️) pour ajouter un commentaire du jour</div>
      <div class="chips" data-chips="1">
        ${(p.plan||[]).map(x=>`<button class="chip star" data-s="${esc(x)}">${esc(x)}${getSoinProtocol(x)?" 📋":""}</button>`).join("")}
        <button class="chip add" data-addsoin="1">＋ autre…</button>
      </div>
      <div style="margin-top:4px"><input class="plan-search" id="soin-srch-${p.id}" placeholder="🔍 Chercher un soin…" style="font-size:13px"></div>
      <div id="soin-srch-res-${p.id}" class="chips" style="min-height:0;margin-top:4px"></div>
    </div>
    <div>
      <div class="lab" style="margin-bottom:7px">Constantes (si mesurées)</div>
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
      <p class="alertline" data-al="1" style="margin-top:8px"></p>
      <div class="chips" style="margin-top:4px">
        <button class="chip" data-constrel style="font-size:12px">📤 Inclure dans la relève</button>
      </div>
      <p class="small muted" style="margin-top:3px">Les constantes sont toujours enregistrées dans l'historique du patient. Coche pour qu'elles figurent aussi dans la relève.</p>
    </div>
    <div>
      <div class="lab" style="margin-bottom:7px">Transmission <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— événements rapides</span></div>
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
      <button class="btn btn-primary fb-wide" data-save="1">✓ Valider le passage</button>
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
  if (!_formDraft || _formDraft.pid !== pid){ _soinNotes = {}; return; }
  const d = _formDraft;
  _soinNotes = { ...(d.soinNotes||{}) };
  // Restaurer les soins
  d.soins.forEach(sn => {
    let c = f.querySelector(`.chip[data-s="${CSS.escape(sn)}"]`);
    if (!c){
      c = document.createElement("button");
      c.className="chip on"; c.dataset.s=sn; c.textContent=sn;
      c.onclick=()=>{ c.classList.toggle("on"); _saveDraft(f,pid); };
      const addBtn = f.querySelector("[data-addsoin]");
      if (addBtn) f.querySelector("[data-chips]").insertBefore(c, addBtn);
    } else c.classList.add("on");
  });
  // Restaurer TA
  const taS=f.querySelector("[data-ta-s]"), taD=f.querySelector("[data-ta-d]");
  if (taS&&d.taS) taS.value=d.taS;
  if (taD&&d.taD) taD.value=d.taD;
  const taHid=f.querySelector("[data-c='ta']");
  if (taHid&&d.taS&&d.taD) taHid.value=d.taS+"/"+d.taD;
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
    const base = sn + (getSoinProtocol(sn) ? " 📋" : "");
    // ✏️ visible sur les soins cochés (invite à commenter) · 💬 si un commentaire existe
    c.innerHTML = esc(base) + (_soinNotes[sn] ? ' <span style="opacity:.9">💬</span>' : (on ? ' <span style="opacity:.55">✏️</span>' : ""));
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
  f.querySelectorAll(".chip[data-s]").forEach(c => {
    decorateChip(c);
    let lpTimer = null, lpFired = false;
    c.onclick = (e) => {
      if (lpFired){ lpFired = false; return; } // ne pas toggler après un appui long
      // Tap sur le crayon/bulle → ouvrir le commentaire directement
      if (e.target.closest("span") && (c.classList.contains("on") || _soinNotes[c.dataset.s])){
        openSoinComment(c); return;
      }
      c.classList.toggle("on"); decorateChip(c); _saveDraft(f,p.id);
    };
    c.addEventListener("pointerdown", () => {
      lpFired = false;
      lpTimer = setTimeout(() => { lpFired = true; openSoinComment(c); }, 550);
    });
    ["pointerup","pointerleave","pointercancel"].forEach(ev =>
      c.addEventListener(ev, () => clearTimeout(lpTimer)));
  });
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

  f.querySelector("[data-addsoin]").onclick = () => {
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
      btn.onclick = () => btn.classList.toggle("on");
      f.querySelector("[data-chips]").insertBefore(btn, addBtn);
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
  f.querySelector("[data-mic]").onclick = e => { e.preventDefault(); dictate(f.querySelector("[data-note]"), f.querySelector("[data-mic]")); };
  // ── Tags de priorité ──
  f.querySelectorAll("[data-tag]").forEach(b => b.onclick = () => {
    const k = b.dataset.tag;
    p.tags = p.tags || [];
    const i = p.tags.indexOf(k);
    if (i >= 0) p.tags.splice(i,1); else p.tags.push(k);
    b.classList.toggle("on", i < 0);
    save();
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
  f.querySelector("[data-cancel]").onclick = () => {
    // Ne pas jeter silencieusement une saisie en cours
    const soinsOn = f.querySelectorAll(".chip[data-s].on").length;
    const noteTxt = (f.querySelector("[data-note]")?.value||"").trim();
    const cstTxt  = [...f.querySelectorAll("[data-c]")].some(i => (i.value||"").trim());
    if ((soinsOn || noteTxt || cstTxt) &&
        !confirm("Abandonner cette saisie ?\nLes soins cochés, les constantes et la transmission seront perdus.")) return;
    _formDraft=null; _soinNotes={}; _curSlot=null; openId=null; render();
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
  const commitVisit = (silent) => {
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
    const dbl = (p.visits||[]).find(v => v.date === todayISO() &&
                (!S.slotsEnabled || (v.slot||defaultSlot()) === _slot));
    if (dbl && !silent){
      const sl = _slot && SLOT_LBL[_slot] ? " " + SLOT_LBL[_slot].ic + " " + SLOT_LBL[_slot].lbl.toLowerCase() : "";
      const rep = confirm(p.prenom + " a déjà un passage aujourd'hui (" + sl.trim() + " " + (dbl.at||"") + ").\n\n" +
        "OK : COMPLÉTER ce passage (recommandé — soins et notes fusionnés)\n" +
        "Annuler : garder les deux passages séparés");
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

    const _v = { uid:uid(), date:todayISO(), at:nowHM(), soins, consts, note,
      ...(S.slotsEnabled ? { slot:(_curSlot||defaultSlot()) } : {}),
      ...(Object.keys(sNotes).length ? { soinNotes:sNotes } : {}),
      ...(constRel ? { constRel:true } : {}),      // constantes à faire figurer dans la relève
      ...(dardOn ? { dar:true } : {}) };           // passage structuré DAR
    p.visits.push(_v);
    if (typeof logChange==="function") logChange("add","visit", p.id+"|"+_v.uid, _v);
    _soinNotes = {}; _formDraft = null;
    if (S.drafts && S.drafts[p.id]){ delete S.drafts[p.id]; }   // saisie consommée
    return true;
  };
  f._commitVisit = commitVisit; // exposé pour le mode séquentiel
  f.querySelector("[data-save]").onclick = () => {
    if (!commitVisit(false)) return;
    _curSlot = null;
    openId = null; save(); toast("Passage enregistré ✓"); render();
  };
  f.querySelector("[data-docs]").onclick = () => sheetDocs(p.id);
  f.querySelector("[data-bilans]").onclick = () => sheetBilans(p.id);
  f.querySelector("[data-raps]").onclick = () => sheetRappels(p.id);
  f.querySelector("[data-hist]").onclick = () => sheetHist(p.id);
  f.querySelector("[data-clone]").onclick = () => {
    // Pré-remplir avec le dernier passage
    const lastV = (p.visits||[]).slice().sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at))[0];
    const plan = p.plan||[];
    const soins = lastV ? lastV.soins : plan;
    // Cocher les soins
    f.querySelectorAll(".chip[data-s]").forEach(c=>c.classList.remove("on"));
    soins.forEach(s => {
      let c = f.querySelector(`.chip[data-s="${CSS.escape(s)}"]`);
      if (!c){ c=document.createElement("button"); c.className="chip on"; c.dataset.s=s; c.textContent=s;
        c.onclick=()=>c.classList.toggle("on");
        f.querySelector("[data-chips]").insertBefore(c, f.querySelector("[data-addsoin]")); }
      else c.classList.add("on");
    });
    // Pré-remplir la note
    const noteEl = f.querySelector("[data-note]");
    noteEl.value = "Soins conformes au plan habituel, état stable.";
    toast("Pré-rempli sur le dernier passage 🔁");
  };
  f.querySelector("[data-graph]").onclick = () => sheetGraphConstantes(p.id);
  const gpsBtn = f.querySelector("[data-gps]");
  if (gpsBtn) gpsBtn.onclick = () => {
    const addr = encodeURIComponent(p.address||"");
    window.open(`geo:0,0?q=${addr}`, "_system");
  };
  const annBtn = f.querySelector("[data-annuaire]");
  if (annBtn) annBtn.onclick = () => sheetAnnuaire(p);
  f.querySelector("[data-edit]").onclick = () => sheetPatient(p);
}

/* ---------- Feuilles génériques ---------- */
