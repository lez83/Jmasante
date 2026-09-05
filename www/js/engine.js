function sheetReleve(){
  const t = todayISO();
  openSheet(`
    <h3>📝 Éditer une relève</h3>
    <div class="field"><span class="lab">Tournée</span>
      <select id="rl-tour">
        <option value="all">🗺 Toutes les tournées</option>
        ${S.tours.map(t=>`<option value="${esc(t)}" ${t===S.curTour?"selected":""}>${esc(t)}</option>`).join("")}
      </select></div>
    <div class="rowb" style="margin-bottom:13px">
      <div style="flex:1"><span class="lab">Du</span><input id="rl-start" type="date" value="${t}"></div>
      <div style="flex:1"><span class="lab">Au</span><input id="rl-end" type="date" value="${t}"></div>
    </div>
    <div class="field"><span class="lab">Contenu</span>
      <div class="chips">
        <button class="chip big on" data-m="full">Complète</button>
        <button class="chip" data-m="events">Événements seuls</button>
        <button class="chip" data-m="select">Sélection…</button>
      </div>
      <p class="small muted" style="margin-top:7px" id="rl-hint">Tous les passages de la période, en ordre chronologique par patient.</p></div>
    <div class="field"><span class="lab">Présentation</span>
      <div class="chips">
        <button class="chip on" data-l="narratif">Narrative</button>
        <button class="chip" data-l="structure">Structurée</button>
        <button class="chip" data-l="ras">RÀS rapide</button>
        <button class="chip" data-l="medecin">🩺 Synthèse ciblée</button>
      </div>
      <p class="small muted" style="margin-top:7px" id="rl-lay-hint">Narrative : paragraphes fluides par patient et par passage.</p></div>
    <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-bottom:7px;cursor:pointer">
      <input type="checkbox" id="rl-raps" checked style="width:20px;height:20px;min-height:20px">
      Inclure les rappels en cours</label>
    <label class="small muted" style="display:flex;gap:8px;align-items:center;margin-bottom:14px;cursor:pointer">
      <input type="checkbox" id="rl-anon" style="width:20px;height:20px;min-height:20px">
      🔒 Anonymiser les noms (M. D.) — pour partage par messagerie</label>
    <button class="btn btn-primary" id="rl-gen">Générer la relève</button>
    <button class="btn btn-ghost" id="rl-sync" style="width:100%;margin-top:8px">🔄 Envoyer le fichier dynamique de tournée</button>
    <p class="small muted" style="margin-top:6px">Le fichier dynamique met à jour l'app de ton collègue (données + countdowns), sans écraser son ordre ni son thème.</p>`);
  let mode = "full", layout = "narratif";
  const hints = { full:"Tous les passages de la période, en ordre chronologique par patient.",
    events:"Uniquement les passages marquants : alertes de constantes ou transmission écrite. La routine est résumée en une ligne.",
    select:"Tu choisis passage par passage ce qui entre dans la relève." };
  $$("#sheet .chip[data-m]").forEach(c => c.onclick = () => {
    mode = c.dataset.m;
    $$("#sheet .chip[data-m]").forEach(x=>x.classList.toggle("on",x===c));
    $("#rl-hint").textContent = hints[mode];
  });
  const layHints = {
    narratif: "Narrative : paragraphes fluides par patient et par passage.",
    structure: "Structurée : sections SOINS · CONSTANTES · BILANS/RDV · TRANSMISSIONS par patient.",
    ras: "RÀS rapide : une ligne par patient — RÀS ou anomalies. Idéal pour les messages courts.",
    medecin: "🩺 Synthèse ciblée : tu choisis les patients ET les données à inclure — pour transmettre à un médecin, un spécialiste ou un service."
  };
  $$("#sheet .chip[data-l]").forEach(c => c.onclick = () => {
    layout = c.dataset.l;
    $$("#sheet .chip[data-l]").forEach(x=>x.classList.toggle("on",x===c));
    $("#rl-lay-hint").textContent = layHints[layout] || "";
  });
  const rlSync = $("#rl-sync");
  if (rlSync) rlSync.onclick = () => ensureIdentity(() => { closeSheet(); shareSyncFile(); });
  $("#rl-gen").onclick = () => {
    if (layout === "medecin"){
      const st = $("#rl-start").value, en = $("#rl-end").value;
      const tr = $("#rl-tour") ? $("#rl-tour").value : S.curTour;
      sheetSyntheseCiblee(st, en, tr);
      return;
    }
    const start=$("#rl-start").value, end=$("#rl-end").value;
    if (start>end){ toast("La date de début dépasse la fin."); return; }
    const withRaps = $("#rl-raps").checked;
    const anon = $("#rl-anon").checked;
    const tour = $("#rl-tour").value;
    const opts = {start, end, mode, withRaps, layout, anon, tour};
    if (mode==="select") sheetSelect(start, end, withRaps, layout, tour, anon);
    else showReport(buildReleve(opts), { ...opts, regen: () => buildReleve(opts) });
  };
}

/* ---------- Synthèse ciblée : choix des patients ET des données ---------- */
function sheetSyntheseCiblee(start, end, tour){
  const pool = relevePool(tour, start, end).filter(p =>
    (p.visits||[]).some(v=>v.date>=start && v.date<=end) ||
    (p.bilans||[]).some(b=>b.statut!=="Fait") ||
    (S.rappels||[]).some(r=>!r.done && r.pid===p.id)
  );
  if (!pool.length){ toast("Aucun patient concerné sur cette période."); return; }

  const sel = {};                       // patients cochés
  pool.forEach(p => sel[p.id] = false);
  const inc = { consts:true, events:true, soins:true, bilans:true, raps:true, notes:true, hist:false };

  const render = () => {
    const nSel = Object.values(sel).filter(Boolean).length;
    openSheet(`
      <h3>🩺 Synthèse ciblée</h3>
      <p class="small muted" style="margin-bottom:10px">Compose un document pour un médecin, un spécialiste ou un service : choisis les patients concernés, puis les données à y faire figurer.</p>

      <div class="lab">1. Patients à inclure</div>
      <div style="max-height:32vh;overflow-y:auto;margin-bottom:12px">
        ${pool.map(p=>`<button class="selv" data-sp="${esc(p.id)}" style="width:100%;text-align:left">
          <span class="box">${sel[p.id]?"✓":""}</span>
          <span class="sv">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${
      shownInfos(p).length ? ` — ${esc(shownInfos(p).map(i=>i.txt).join(" · ").slice(0,60))}` : ""}</span>
        </button>`).join("")}
      </div>

      <div class="lab">2. Données à faire figurer</div>
      <div class="chips" style="margin-bottom:12px">
        ${[["soins","✅ Soins"],["events","💬 Événements"],["consts","📊 Constantes"],
           ["notes","📝 Transmissions"],["bilans","🧪 Bilans / RDV"],["raps","📌 Rappels & ordonnances"],
           ["hist","🕑 Historique complet"]].map(([k,l])=>
          `<button class="chip ${inc[k]?"on":""}" data-inc="${k}" style="font-size:12.5px">${l}</button>`).join("")}
      </div>

      <button class="btn btn-primary" id="sc-gen" style="width:100%" ${nSel?"":"disabled"}>
        Générer ${nSel?`pour ${nSel} patient(s)`:"— coche au moins un patient"}
      </button>
      <button class="btn btn-ghost" id="sc-all" style="width:100%;margin-top:8px">${nSel===pool.length?"Tout décocher":"Tout cocher"}</button>
      <button class="btn btn-ghost" id="sc-cancel" style="width:100%;margin-top:8px">Annuler</button>`);

    $$("#sheet [data-sp]").forEach(b => b.onclick = () => { sel[b.dataset.sp] = !sel[b.dataset.sp]; render(); });
    $$("#sheet [data-inc]").forEach(b => b.onclick = () => { inc[b.dataset.inc] = !inc[b.dataset.inc]; render(); });
    $("#sc-all").onclick = () => { const all = nSel===pool.length; pool.forEach(p=>sel[p.id]=!all); render(); };
    $("#sc-cancel").onclick = closeSheet;
    const gen = $("#sc-gen");
    if (gen && nSel) gen.onclick = () => {
      const chosen = pool.filter(p=>sel[p.id]);
      const txt = buildSyntheseCiblee(chosen, start, end, inc);
      closeSheet();
      showReport(txt, { tour, start, end, regen: () => buildSyntheseCiblee(chosen, start, end, inc) });
    };
  };
  render();
}

/* Construction du texte de la synthèse ciblée */
function buildSyntheseCiblee(patients, start, end, inc){
  let out = "\u2554" + "\u2550".repeat(38) + "\u2557\n";
  out += "\u2551  SYNTH\u00c8SE INFIRMI\u00c8RE                \u2551\n";
  out += "\u255A" + "\u2550".repeat(38) + "\u255D\n";
  out += "\uD83D\uDCC5 " + (start===end ? fmtFR(start) : fmtFR(start)+" \u2192 "+fmtFR(end)) + "\n";
  out += "\uD83D\uDC65 " + patients.length + " patient(s)\n\n";

  const moment = v => {
    const d = fmtFR(v.date);
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
    return d + sl;
  };

  patients.forEach(p => {
    const vs = (p.visits||[]).filter(v=>v.date>=start && v.date<=end)
                 .sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
    out += "\u250C" + "\u2500".repeat(37) + "\n";
    out += "\u2502 \uD83D\uDC64 " + p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom
         + (ageOf(p.dob)!=null ? ", "+ageOf(p.dob)+" ans" : "") + "\n";
    out += "\u2514" + "\u2500".repeat(37) + "\n";
    shownInfos(p).forEach(it => {
      out += "  " + infoType(it.type).ic + " " + it.txt.replace(/\n+/g," \u00B7 ") + "\n";
    });

    const plan = p.plan || [];
    let planTenu = false; const evts = [], cst = [], nts = [];
    const hors = new Set();
    vs.forEach(v => {
      const sn = v.soinNotes || {};
      const com = (v.soins||[]).filter(x=>sn[x]);
      const hp  = (v.soins||[]).filter(x=>!plan.includes(x) && !sn[x]);
      if ((v.soins||[]).some(x=>plan.includes(x))) planTenu = true;
      hp.forEach(x=>hors.add(x));
      com.forEach(x => evts.push("  \uD83D\uDCAC " + moment(v) + " \u2014 " + x + " : " + sn[x]));
      if (v.constRel || inc.hist){
        const cp = constParts(v.consts);
        if (cp.length){
          const al = alertes(v.consts, p.thresholds);
          cst.push("  \uD83D\uDCCA " + moment(v) + " \u2014 " + cp.join(" \u00B7 ") + (al.length?" \u26A0\uFE0F "+al.join(", "):""));
        }
      }
      if (v.note){
        if (v.dar){
          nts.push("  \uD83D\uDCCB " + moment(v) + " \u2014 Transmission structur\u00e9e (DAR) :");
          String(v.note).split("\n").filter(l=>l.trim()).forEach(l=>nts.push("     " + l.trim()));
        } else nts.push("  \uD83D\uDCDD " + moment(v) + " \u2014 " + v.note);
      }
    });

    if (inc.soins){
      if (planTenu) out += "  \u2705 Plan de soins respect\u00e9\n";
      if (hors.size) out += "  \u2795 Soins suppl\u00e9mentaires : " + [...hors].join(", ") + "\n";
    }
    if (inc.events) evts.forEach(l => out += l + "\n");
    if (inc.consts) cst.forEach(l => out += l + "\n");
    if (inc.notes)  nts.forEach(l => out += l + "\n");
    if (inc.bilans){
      (p.bilans||[]).filter(b=>b.statut!=="Fait" || inc.hist).forEach(b =>
        out += "  \uD83E\uDDEA " + bilanLine(b) + "\n");
    }
    if (inc.raps){
      (S.rappels||[]).filter(r=>!r.done && r.pid===p.id).forEach(r =>
        out += "  \uD83D\uDCCC " + rapType(r.type).lbl + " : " + (r.text||"") + (r.due?" ("+fmtFR(r.due)+")":"") + "\n");
    }
    out += "\n";
  });

  out += "\u2550".repeat(40) + "\n";
  out += "\uD83D\uDD52 G\u00e9n\u00e9r\u00e9e le " + fmtFR(todayISO()) + " \u00e0 " + nowHM() + "\n";
  out += "\u2550".repeat(40) + "\n";
  return out;
}

function relevePool(tour, start, end){
  const pool = activeP().filter(p => tour==="all" || (p.tours||[]).includes(tour));
  // Fins de prise en charge tombant dans la période : le collègue doit être informé
  if (start && end){
    (S.patients||[]).forEach(p => {
      if (p.pec && !p.archived && p.pec.end >= start && p.pec.end <= end && !pool.some(x=>x.id===p.id))
        pool.push(p);
    });
  }
  if (tour === "all") return pool;
  // Respecter l'ordre de passage configuré. Référence : l'ordre du MATIN
  // (c'est la séquence de tournée de référence) ; à défaut, l'ordre global.
  const ord = (S.slotsEnabled && ((S.slotOrder||{})[tour]||{}).matin)
            || ((S.slotOrder||{})[tour]||{}).soir
            || (S.patientOrder||{})[tour]
            || [];
  if (!ord.length) return pool;
  return pool.slice().sort((a,b)=>{
    const ia = ord.indexOf(a.id), ib = ord.indexOf(b.id);
    if (ia===-1 && ib===-1) return 0;   // hors ordre : à la fin, ordre inchangé
    if (ia===-1) return 1;
    if (ib===-1) return -1;
    return ia - ib;
  });
}

function sheetSelect(start, end, withRaps, layout, tour, anon){
  const pool = relevePool(tour);
  if (!pool.length){ toast("Aucun patient sur ce périmètre."); return; }
  // État par patient : inclus? + options de données + filtre de date
  const PS = {};
  pool.forEach(p => {
    const hasVisits = p.visits.filter(v=>v.date>=start&&v.date<=end).length;
    PS[p.id] = {
      on: true,
      consts: true, notes: true, bilans: true, raps: true, docs: false,
      dateFilter: "events", // "all"|"events"|"date"
      specificDate: start,
      hasVisits
    };
  });
  const renderSel = () => {
    const box = $("#sel");
    if (!box) return;
    box.innerHTML = pool.map(p => {
      const st = PS[p.id];
      const nom = anon ? (p.nom.replace("Demo-","").charAt(0)+". "+p.prenom.charAt(0)+".") : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom;
      const vsCount = p.visits.filter(v=>v.date>=start&&v.date<=end).length;
      return `<div class="rap" style="flex-direction:column;align-items:stretch;padding:10px 4px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:${st.on?"8px":"0"}">
          <button class="box" data-toggle-p="${esc(p.id)}" style="width:24px;height:24px;border-radius:7px;flex-shrink:0;border:2px solid var(--border-strong);
            display:flex;align-items:center;justify-content:center;font-weight:700;
            background:${st.on?"var(--accent)":"transparent"};color:${st.on?"var(--accent-ink)":"transparent"}">${st.on?"✓":""}</button>
          <b style="flex:1">${esc(nom)}</b>
        </div>
        ${st.on ? `<div style="padding-left:32px">
          <div class="chips" style="margin-bottom:6px">
            ${[["consts","📊 Constantes"],["notes","📝 Transmissions"],["bilans","🧪 Bilans"],["raps","📌 Rappels"],["docs","📎 Docs"]].map(([k,lbl])=>
              `<button class="chip ${st[k]?"on":""}" data-opt="${esc(p.id)}:${k}" style="font-size:12px;padding:4px 10px">${lbl}</button>`
            ).join("")}
          </div>
          <div class="chips" style="margin-bottom:4px">
            <button class="chip ${st.dateFilter==="all"?"on":""}" data-df="${esc(p.id)}:all" style="font-size:12px">Tous les passages</button>
            <button class="chip ${st.dateFilter==="events"?"on":""}" data-df="${esc(p.id)}:events" style="font-size:12px">Événements ⚠</button>
            <button class="chip ${st.dateFilter==="date"?"on":""}" data-df="${esc(p.id)}:date" style="font-size:12px">Date précise</button>
          </div>
          ${st.dateFilter==="date"?`<input type="date" class="sel-date" data-sdp="${esc(p.id)}" value="${esc(st.specificDate)}" style="font-size:13px;width:100%;margin-bottom:4px">`:""}</div>` : ""}
      </div>`;
    }).join("<hr style='border:none;border-top:1px solid var(--border);margin:0'>");
  };
  openSheet(`
    <h3>🔍 Sélection fine de la relève</h3>
    <div class="small muted" style="margin-bottom:10px">Choisis ce qui est inclus pour chaque patient.</div>
    <div id="sel"></div>
    <button class="btn btn-primary" id="sel-gen" style="margin-top:14px">Générer la relève</button>`);
  renderSel();
  // Délégation des clics
  $("#sel").addEventListener("click", e => {
    const tp = e.target.closest("[data-toggle-p]");
    const opt = e.target.closest("[data-opt]");
    const df = e.target.closest("[data-df]");
    if (tp){ PS[tp.dataset.toggleP].on = !PS[tp.dataset.toggleP].on; renderSel(); }
    else if (opt){ const [id,k]=opt.dataset.opt.split(":"); PS[id][k]=!PS[id][k]; renderSel(); }
    else if (df){ const [id,v]=df.dataset.df.split(":"); PS[id].dateFilter=v; renderSel(); }
  });
  $("#sel").addEventListener("change", e => {
    const sdp = e.target.closest("[data-sdp]");
    if (sdp) PS[sdp.dataset.sdp].specificDate = e.target.value;
  });
  $("#sel-gen").onclick = () => {
    const keep = new Set(), pOpts = {};
    pool.forEach(p => {
      if (!PS[p.id].on) return;
      const st = PS[p.id];
      pOpts[p.id] = { consts:st.consts, notes:st.notes, bilans:st.bilans, raps:st.raps, docs:st.docs };
      const visits = p.visits.filter(v=>v.date>=start&&v.date<=end);
      let filtered = visits;
      if (st.dateFilter==="events") filtered=visits.filter(v=>isEvent(v));
      else if (st.dateFilter==="date") filtered=visits.filter(v=>v.date===st.specificDate);
      filtered.forEach(v=>keep.add(v.uid));
      // Si bilans sélectionnés, toujours inclus même sans passages
      if (st.bilans && bilansFor(p,start,end).length) keep.add("bilan_"+p.id);
    });
    const opts = {start, end, mode:"select", withRaps, keep, pOpts, layout, anon, tour};
    showReport(buildReleve(opts), { ...opts, regen: () => buildReleve(opts) });
  };
}

/* Bilans à faire figurer : ceux datés dans la période + tous ceux en attente */
function bilansFor(p, start, end){
  return (p.bilans||[])
    .filter(b => (b.date >= start && b.date <= end) || b.statut === "À faire")
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
}
function bilanLine(b){
  return b.type + " — " + b.statut + (b.date ? " · " + fmtFR(b.date) : "") + (b.res ? " (" + b.res + ")" : "");
}
function constParts(c){
  const cp=[]; c=c||{};
  if(c.ta)cp.push("TA "+c.ta); if(c.temp)cp.push("T° "+c.temp+"°C"); if(c.sat)cp.push("Sat "+c.sat+" %");
  if(c.puls)cp.push("pouls "+c.puls); if(c.glyc)cp.push("glycémie "+c.glyc+" g/L"); if(c.douleur)cp.push("douleur "+c.douleur+"/10");
  return cp;
}

/* Corps « structuré » d'un patient : sections SOINS / CONSTANTES / BILANS / TRANSMISSIONS */
function patientStructured(shown, bils, p){
  /* Synthèse par section sur toute la période, sans répéter chaque passage.
     Le routinier se dit une fois ; l'exceptionnel est daté et situé. */
  const plan = (p && p.plan) || [];
  const moment = v => {
    const d = fmtFR(v.date);
    const sl = (v.slot && SLOT_LBL && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
    return d + sl;
  };
  let planTenu = false;
  const horsPlanTous = new Set();
  const evts = [], constsL = [], notesL = [];

  shown.forEach(v => {
    const sn = v.soinNotes || {};
    const commentes = (v.soins||[]).filter(x => sn[x]);
    const horsPlan  = (v.soins||[]).filter(x => !plan.includes(x) && !sn[x]);
    const duPlan    = (v.soins||[]).filter(x => plan.includes(x));
    if (duPlan.length) planTenu = true;
    horsPlan.forEach(x => horsPlanTous.add(x));
    commentes.forEach(x => evts.push("- " + moment(v) + " : " + x + " — " + sn[x]));
    if (!duPlan.length && !horsPlan.length && !commentes.length && (v.soins||[]).length)
      evts.push("- " + moment(v) + " : " + v.soins.join(", "));
    // Constantes : uniquement celles marquées « inclure dans la relève »
    if (v.constRel){
      const cp = constParts(v.consts);
      if (cp.length){
        const al = alertes(v.consts, p && p.thresholds);
        constsL.push("- " + moment(v) + " : " + cp.join(", ") + (al.length ? "  ⚠ " + al.join(", ") : ""));
      }
    }
    if (v.note){
      if (v.dar){
        notesL.push("- " + moment(v) + " — Transmission structurée (DAR) :");
        String(v.note).split("\n").filter(l=>l.trim()).forEach(l => notesL.push("    " + l.trim()));
      } else {
        notesL.push("- " + moment(v) + " : " + v.note);
      }
    }
  });

  let out = "";
  // SOINS : la routine en une ligne, l'exceptionnel détaillé
  const soinsLignes = [];
  if (planTenu) soinsLignes.push("- Plan de soins respecté sur la période");
  if (horsPlanTous.size) soinsLignes.push("- Soins supplémentaires : " + [...horsPlanTous].join(", "));
  if (soinsLignes.length) out += "[ SOINS ]\n" + soinsLignes.join("\n") + "\n";
  if (evts.length)    out += "[ ÉVÉNEMENTS ]\n" + evts.join("\n") + "\n";
  if (constsL.length) out += "[ CONSTANTES ]\n" + constsL.join("\n") + "\n";
  if (bils.length)    out += "[ BILANS / RDV ]\n" + bils.map(b=>"- "+bilanLine(b)).join("\n") + "\n";
  if (notesL.length)  out += "[ TRANSMISSIONS ]\n" + notesL.join("\n") + "\n";
  return out;
}


function anonName(p){
  const n = p.nom.replace("Demo-","");
  return n.charAt(0).toUpperCase() + ". " + p.prenom.charAt(0).toUpperCase() + ".";
}

function buildReleve({start, end, mode, withRaps, keep, pOpts, layout, anon, tour}){
  tour = tour || "all";
  const L = "──────────────────────────────";
  const pool = relevePool(tour, start, end);
  const poolIds = new Set(pool.map(p=>p.id));
  let alerts = [], body = "", routines = [];
  pool.forEach(p => {
    const vs = p.visits.filter(v=>v.date>=start&&v.date<=end)
      .sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));   // chronologique par patient
    const bils = bilansFor(p, start, end);
    if (!vs.length && !bils.length) return;
    vs.forEach(v => alertes(v.consts).forEach(a => alerts.push(p.nom.replace("Demo-","").toUpperCase()+" — "+fmtFR(v.date)+" : "+a)));
    let shown = vs;
    if (mode==="events") shown = vs.filter(isEvent);
    if (mode==="select") shown = vs.filter(v=>keep.has(v.uid));
    if (!shown.length && !bils.length){
      if (mode==="events" && vs.length) routines.push(anon ? anonName(p) : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom+" ("+vs.length+" passage"+(vs.length>1?"s":"")+")");
      return;
    }
    const pNom = anon ? anonName(p) : p.nom.replace("Demo-","").toUpperCase()+" "+p.prenom;
    const po = (pOpts && pOpts[p.id]) || { consts:true, notes:true, bilans:true, raps:true, docs:false };
    const pAge = ageOf(p.dob)!=null ? ", "+ageOf(p.dob)+" ans" : "";
    const pGenre = p.genre ? " · "+p.genre : "";
    body += "\n┌─────────────────────────────────────\n";
    body += "│ 👤 " + pNom + pAge + pGenre + "\n";
    body += "└─────────────────────────────────────\n";
    shownInfos(p).forEach(it => {
      body += "  " + infoType(it.type).ic + " " + it.txt.replace(/\n+/g," · ") + "\n";
    });
    if ((p.tags||[]).length) body += "🏷️ " + p.tags.map(t=>PATIENT_TAGS[t]?PATIENT_TAGS[t].ic+" "+PATIENT_TAGS[t].lbl:t).join(" · ") + "\n";

    if (layout === "structure"){
      body += patientStructured(shown, bils, p);
    } else if (layout === "ras"){
      const alRas = shown.flatMap(v=>alertes(v.consts));
      const soinsRas = [...new Set(shown.flatMap(v=>v.soins))];
      if (alRas.length){
        body += "  \u26a0\ufe0f " + alRas.join(", ") + "\n";
        if (soinsRas.length) body += "  Soins : " + soinsRas.join(", ") + ".\n";
      } else {
        body += "  R\u00c0S \u2014 soins conformes" + (soinsRas.length?" ("+soinsRas.join(", ")+")":"") + ".\n";
      }
      const bilsAF = bils.filter(b=>b.statut==="\u00c0 faire");
      if (bilsAF.length) body += "  En attente : " + bilsAF.map(b=>b.type).join(", ") + ".\n";
    } else if (layout === "dar"){
      const allConsts = shown.flatMap(v=>constParts(v.consts));
      const allAlerts = shown.flatMap(v=>alertes(v.consts));
      const allSoins  = [...new Set(shown.flatMap(v=>v.soins))];
      const allNotes  = shown.map(v=>v.note).filter(Boolean);
      body += "  D \u2014 " + (allConsts.length?allConsts.join(", ")+".":"\u00c9tat g\u00e9n\u00e9ral satisfaisant.") + (allAlerts.length?" \u26a0\ufe0f "+allAlerts.join(", ")+"." : "") + "\n";
      body += "  A \u2014 " + (allSoins.length?allSoins.join(", ")+".":"Aucun soin particulier ce jour.") + "\n";
      body += "  R \u2014 " + (allNotes.length?allNotes.join(" \u00b7 ")+".":"R\u00c0S.") + "\n";
      if (bils.length) body += "  Bilans/RDV : " + bils.map(bilanLine).join(" \u00b7 ") + "\n";
    } else if (layout === "medecin"){
      /* ── Synthèse médecin : seulement ce qui appelle une décision médicale ── */
      const MOTS_PLAIE = /plaie|pansement|escarre|cicatr|bourgeon|fibrin|exsudat|n[ée]crose|rougeur|inflammat/i;
      const MOTS_TTT   = /traitement|ordonnance|posologie|dose|insuline|antalgique|antibio|anticoag|arr[êe]t|instaur|modif/i;
      const MOTS_AVIS  = /m[ée]decin|avis|appel|contact|signal|urgence|r[ée][ée]valu/i;
      let bloc = "";
      shown.forEach(v => {
        // Constantes hors seuils uniquement
        const al = alertes(v.consts, p.thresholds);
        if (al.length){
          const cp = constParts(v.consts);
          bloc += "  \u26A0\uFE0F " + fmtFR(v.date) + " — " + al.join(", ")
                + (cp.length ? " (" + cp.join(" \u00B7 ") + ")" : "") + "\n";
        }
        // Soins de plaie avec leur commentaire du jour
        const sn = v.soinNotes || {};
        (v.soins||[]).forEach(so => {
          if (MOTS_PLAIE.test(so) || (sn[so] && MOTS_PLAIE.test(sn[so])))
            bloc += "  \uD83E\uDE79 " + fmtFR(v.date) + " — " + so + (sn[so] ? " : " + sn[so] : "") + "\n";
          else if (sn[so] && (MOTS_TTT.test(sn[so]) || MOTS_AVIS.test(sn[so])))
            bloc += "  \uD83D\uDC8A " + fmtFR(v.date) + " — " + so + " : " + sn[so] + "\n";
        });
        // Transmissions traitant du traitement ou demandant un avis
        if (v.note && (MOTS_TTT.test(v.note) || MOTS_AVIS.test(v.note) || MOTS_PLAIE.test(v.note)))
          bloc += "  \uD83D\uDCDD " + fmtFR(v.date) + " — " + v.note + "\n";
      });
      // Bilans en attente et rappels médicaux
      (bils||[]).filter(b => b.statut !== "Fait").forEach(b => {
        bloc += "  \uD83E\uDDEA " + bilanLine(b) + "\n";
      });
      (S.rappels||[]).filter(r => !r.done && r.pid === p.id &&
        (r.type === "ordonnance" || r.type === "bilan" || r.type === "rdv")).forEach(r => {
        bloc += "  \uD83D\uDCCC " + rapType(r.type).lbl + " : " + (r.text||"") + (r.due ? " (" + fmtFR(r.due) + ")" : "") + "\n";
      });
      if (bloc) body += bloc;
      else body += "  \u2705 Rien à signaler sur le plan médical.\n";
    } else {
      /* ── Vue synthétique sur la période ──
         Plan respecté partout sans remarque → une seule ligne.
         Sinon : la ligne globale + uniquement les moments à lire,
         datés et situés (matin / soir). ── */
      const plan = p.plan || [];
      const moment = v => {
        const d = fmtFR(v.date);
        const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic + " " + SLOT_LBL[v.slot].lbl.toLowerCase() : "";
        return d + sl;
      };
      let planTenu = false;
      const evenements = [];

      shown.forEach(v => {
        const sn = v.soinNotes || {};
        const commentes = (v.soins||[]).filter(x => sn[x]);
        const horsPlan  = (v.soins||[]).filter(x => !plan.includes(x) && !sn[x]);
        const duPlan    = (v.soins||[]).filter(x => plan.includes(x));
        if (duPlan.length) planTenu = true;

        commentes.forEach(x => {
          evenements.push("  \uD83D\uDCAC " + moment(v) + " \u2014 " + x + " : " + sn[x]);
        });
        if (horsPlan.length){
          evenements.push("  \u2795 " + moment(v) + " \u2014 Soins suppl\u00e9mentaires : " + horsPlan.join(", "));
        }
        if (!duPlan.length && !horsPlan.length && !commentes.length && (v.soins||[]).length){
          evenements.push("  \u2705 " + moment(v) + " \u2014 " + v.soins.join(", "));
        }
        // Constantes : uniquement celles que l'IDEL a choisi d'inclure (case 📤)
        if (po.consts !== false && v.constRel){
          const cp2 = constParts(v.consts);
          const al2 = alertes(v.consts, p.thresholds);
          if (cp2.length){
            evenements.push("  \uD83D\uDCCA " + moment(v) + " \u2014 " + cp2.join(" \u00B7 ")
              + (al2.length ? " \u26A0\uFE0F " + al2.join(", ") : ""));
          }
        }
        if (po.notes !== false && v.note){
          // Passage marqué DAR → bloc structuré mis en évidence
          if (v.dar){
            const lignes = String(v.note).split("\n").filter(l=>l.trim());
            evenements.push("  \uD83D\uDCCB " + moment(v) + " \u2014 Transmission structur\u00e9e (DAR)");
            lignes.forEach(l => evenements.push("     " + l.trim()));
          } else {
            evenements.push("  \uD83D\uDCDD " + moment(v) + " \u2014 " + v.note);
          }
        }
      });

      if (planTenu) body += "  \u2705 Plan de soins respect\u00e9\n";
      evenements.forEach(l => { body += l + "\n"; });
      // Fin de prise en charge survenue dans la période
      if (p.pec && p.pec.end >= start && p.pec.end <= end){
        body += "  \uD83C\uDF97\uFE0F FIN DE PRISE EN CHARGE le " + fmtFR(p.pec.end)
              + (p.pec.motif ? " \u2014 " + p.pec.motif : "") + "\n";
      }

      if (po.bilans !== false && bils.length){
        bils.forEach(b => {
          const ic = b.statut==="Fait" ? "✅" : "🧪";
          body += ic+" Bilan : " + bilanLine(b) + "\n";
        });
      }
    }

    if (po.docs !== false && po.docs && (p.docs||[]).length)
      body += "📎 Documents : " + p.docs.map(d=>esc(d.name)+(d.date?" ("+fmtFR(d.date)+")":"")).join(", ") + "\n";
    body += L + "\n";
  });
  if (mode==="events" && routines.length)
    body += "✓ Sans particularité sur la période : " + routines.join(" · ") + ".\n";

  let rapBlock = "";
  if (withRaps){
    /* Même cloisonnement que la synchro : un rappel personnel ne sort jamais,
       et un rappel de cabinet ne figure que dans la relève de CE cabinet. */
    const raps = S.rappels.filter(r => {
      if (r.done) return false;
      if (r.perso) return false;                       // personnel : jamais transmis
      if (r.pid)   return poolIds.has(r.pid);          // patient : suit son dossier
      if (r.tour)  return tour === "all" || r.tour === tour;   // cabinet
      return true;                                     // ancien rappel non typé
    })
      .sort((a,b)=>String(a.due).localeCompare(String(b.due)));
    if (raps.length){
      rapBlock = "📌 À PRÉVOIR / RAPPELS\n" + raps.map(r => {
        const rp = r.pid ? getP(r.pid) : null;
        const cd = rapCountdown(r);
        const cdTxt = cd.txt ? " [" + (cd.cls==="past"?"⚠ ":"") + cd.txt + "]" : "";
        return "  · " + rapType(r.type).lbl + (rp ? " ["+(anon?anonName(rp):rp.nom.replace("Demo-","").toUpperCase())+"]"
            : (r.tour ? " ["+r.tour+"]" : " [tournée]")) +
          (r.due?" — éch. "+fmtFR(r.due)+cdTxt:"") + " : " + r.text;
      }).join("\n") + "\n" + L + "\n";
    }
  }
  const head = "RELÈVE INFIRMIÈRE" + (tour!=="all" ? " — TOURNÉE « " + tour + " »" : "") +
    " — du " + fmtFR(start) + " au " + fmtFR(end) +
    (mode==="events"?" (événements)":mode==="select"?" (sélection)":"") +
    (layout==="structure"?" — présentation par sections":layout==="ras"?" — RÀS rapide":layout==="dar"?" — format DAR":"") + (anon?" [anonymisé]":"") + "\n" +
    "Éditée le " + new Date().toLocaleDateString("fr-FR") + " à " + nowHM() + "\n" + L + "\n" +
    (alerts.length ? "⚠ POINTS DE VIGILANCE ("+alerts.length+")\n"+alerts.map(a=>"  · "+a).join("\n")+"\n"+L+"\n" : "");
  let tail = "";
  if (typeof _finalMsg !== "undefined" && _finalMsg){
    tail += "\n" + L + "\n";
    tail += "\uD83D\uDCAC MESSAGE DE L'INFIRMIER\n";
    tail += _finalMsg.split("\n").map(l => "   " + l).join("\n") + "\n";
    tail += "   " + (S.identity ? whoami() + " \u2014 " : "") + fmtFR(todayISO()) + " \u00e0 " + nowHM() + "\n";
    tail += L + "\n";
  }
  return head + rapBlock + (body || "Aucun passage sur la période.\n") + tail;
}

/* ============================================================
   [MODULE DE PARTAGE]
   - Fabrique un vrai .docx sans dépendance (ZIP "store" + XML)
   - Sélection des documents patients à joindre
   - Partage via le menu natif (Web Share niveau 2) ;
     repli : téléchargement. En version Capacitor,