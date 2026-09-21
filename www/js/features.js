/* ============================================================
   FEATURES.JS — Fonctionnalités avancées
   - Graphique évolution des constantes (SVG natif)
   - Galerie chronologique de photos de plaie
   - Recherche globale multi-tournées
   - Log d'erreurs dans IndexedDB
============================================================ */

/* ============ GRAPHIQUE DES CONSTANTES ============ */
const CONST_DEFS = [
  { key:"ta_s",  lbl:"TA syst.",   unit:"cmHg", lo:9,  hi:16, min:6,  max:22, color:"#5B7CFA" },
  { key:"ta_d",  lbl:"TA diast.",  unit:"cmHg", lo:5,  hi:9,  min:3,  max:14, color:"#8B7BFF" },
  { key:"sat",   lbl:"SpO2",       unit:"%",    lo:95, hi:100,min:85, max:100,color:"#22D3EE" },
  { key:"temp",  lbl:"Temp.",      unit:"°C",   lo:36, hi:38, min:34, max:41, color:"#FFB84D" },
  { key:"puls",  lbl:"Pouls",      unit:"bpm",  lo:50, hi:100,min:30, max:140,color:"#FF6E6E" },
  { key:"glyc",  lbl:"Glycémie",   unit:"g/L",  lo:0.7,hi:2.0,min:0.2,max:4.0,color:"#2BB3A3" },
  { key:"douleur",lbl:"Douleur",   unit:"/10",  lo:0,  hi:6,  min:0,  max:10, color:"#E25563" },
];

function extractConstValues(visits, key){
  const pts = [];
  visits.forEach(v => {
    let val = null;
    if (key === "ta_s" && v.consts.ta){
      const m = String(v.consts.ta).match(/^(\d+)/); if (m) val = +m[1];
    } else if (key === "ta_d" && v.consts.ta){
      const m = String(v.consts.ta).match(/\/(\d+)/); if (m) val = +m[1];
    } else if (v.consts[key] !== undefined && v.consts[key] !== ""){
      val = parseFloat(v.consts[key]);
    }
    if (val !== null && !isNaN(val)) pts.push({ date:v.date, at:v.at||"", val });
  });
  return pts.sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
}

function buildConstSvg(pts, def){
  if (!pts.length) return `<p class="muted small" style="padding:16px 0 8px;text-align:center">Aucune mesure enregistrée.</p>`;
  const W = 360, H = 140, PL = 44, PR = 12, PT = 16, PB = 30;
  const gW = W - PL - PR, gH = H - PT - PB;
  const vmin = def.min, vmax = def.max;
  const xScale = i => PL + (pts.length > 1 ? (i / (pts.length - 1)) * gW : gW / 2);
  const yScale = v => PT + gH - ((v - vmin) / (vmax - vmin)) * gH;
  const yLine  = v => Math.max(PT, Math.min(PT + gH, yScale(v)));

  // Zones OK (vert) et alerte (rouge)
  const yHi  = yLine(def.hi), yLo = yLine(def.lo);
  const zones = [
    `<rect x="${PL}" y="${yHi}" width="${gW}" height="${yLo - yHi}" class="graph-zone-ok"/>`,
    `<rect x="${PL}" y="${PT}" width="${gW}" height="${yHi - PT}" class="graph-zone-warn"/>`,
    `<rect x="${PL}" y="${yLo}" width="${gW}" height="${PT + gH - yLo}" class="graph-zone-warn"/>`,
  ];

  // Lignes de référence
  const refLines = [def.hi, def.lo].map(v => {
    const y = yLine(v);
    return `<line x1="${PL}" y1="${y}" x2="${PL+gW}" y2="${y}" stroke="var(--border-strong)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${PL-4}" y="${y+4}" class="graph-axis" text-anchor="end">${v}</text>`;
  });

  // Ligne de données
  const polyPts = pts.map((p,i) => `${xScale(i).toFixed(1)},${yLine(p.val).toFixed(1)}`).join(" ");
  const polyline = `<polyline class="graph-line" stroke="${esc(def.color)}" points="${polyPts}"/>`;

  // Points
  const dots = pts.map((pt, i) => {
    const x = xScale(i).toFixed(1), y = yLine(pt.val).toFixed(1);
    const cls = pt.val > def.hi || pt.val < def.lo ? "bad" : "";
    return `<circle class="graph-dot ${cls}" cx="${x}" cy="${y}" r="4" fill="${cls?"var(--danger)":esc(def.color)}">
      <title>${esc(fmtFR(pt.date))} ${esc(pt.at)} : ${pt.val} ${esc(def.unit)}</title></circle>`;
  });

  // Labels X : premier, dernier, et ceux qui tombent sur un multiple
  const xLabels = pts.map((pt, i) => {
    if (i !== 0 && i !== pts.length - 1 && pts.length > 5 && i % Math.ceil(pts.length / 4) !== 0) return "";
    const x = xScale(i);
    const d = pt.date.slice(5);  // MM-DD
    return `<text x="${x.toFixed(1)}" y="${H - 4}" class="graph-axis" text-anchor="middle">${esc(d)}</text>`;
  });

  // Unité Y
  const yLabel = `<text x="6" y="${(PT + H/2).toFixed(0)}" class="graph-axis" text-anchor="middle" transform="rotate(-90,6,${(PT+H/2).toFixed(0)})">${esc(def.unit)}</text>`;

  return `<div class="graph-wrap">
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${zones.join("")}
    ${refLines.join("")}
    ${polyline}
    ${dots.join("")}
    ${xLabels.join("")}
    ${yLabel}
    <text x="${PL}" y="${PT - 4}" class="graph-axis" font-size="11" font-weight="600" fill="${esc(def.color)}">${esc(def.lbl)}</text>
  </svg></div>`;
}

function sheetGraphConstantes(pid){
  const p = getP(pid);
  const visits = (p.visits||[]).slice().sort((a,b)=>(a.date+a.at).localeCompare(b.date+b.at));
  // Filtrer les 90 derniers jours
  const cut = new Date(); cut.setDate(cut.getDate()-90);
  const cutISO = cut.toISOString().slice(0,10);
  const recent = visits.filter(v=>v.date>=cutISO);

  // Trouver les constantes qui ont au moins 1 valeur
  const available = CONST_DEFS.filter(d => extractConstValues(recent, d.key).length > 0);
  if (!available.length){
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune constante enregistrée sur les 90 derniers jours.</p>`);
    { const _e = $("#gcl"); if (_e) _e.onclick = closeSheet; } return;
  }

  let selKey = available[0].key;
  const render = () => {
    const def = CONST_DEFS.find(d=>d.key===selKey);
    const pts = extractConstValues(recent, selKey);
    const stat = pts.length ? `Dernière : ${pts[pts.length-1].val} ${def.unit} (${fmtFR(pts[pts.length-1].date)}) · ${pts.length} mesure(s)` : "";
    const chips = available.map(d=>`<button class="chip ${d.key===selKey?"on":""}" data-gk="${esc(d.key)}">${esc(d.lbl)}</button>`).join("");
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <div class="chips" style="margin-bottom:10px">${chips}</div>
      ${buildConstSvg(pts, def)}
      ${stat?`<p class="small muted" style="text-align:center;margin-top:4px">${esc(stat)}</p>`:""}
      <button class="btn btn-ghost" id="gc-exp" style="margin-top:12px;width:100%">📄 Exporter l'historique</button>`);
    $$("#sheet [data-gk]").forEach(b=>b.onclick=()=>{ selKey=b.dataset.gk; render(); });
    const _ex = $("#gc-exp"); if (_ex) _ex.onclick = () => sheetExportConst(p.id);
    { const _e = $("#gcl"); if (_e) _e.onclick = closeSheet; }
  };
  render();
}

/* ============ GALERIE CHRONOLOGIQUE ============ */
function sheetGalerie(pid){
  const p = getP(pid);
  const photos = (p.docs||[]).filter(d=>d.mime&&d.mime.startsWith("image/"))
    .slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if (!photos.length){
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune photo dans ce dossier.</p>`);
    { const _e = $("#gal-back"); if (_e) _e.onclick = ()=>sheetDocs(pid); } return;
  }
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    <p class="small muted" style="margin-bottom:10px">${photos.length} photo(s) — ordre chronologique</p>
    <div class="chrono-grid">
      ${photos.map(d=>`
      <div class="chrono-item" data-gopen="${esc(d.id)}">
        <img src="${d.data}" alt="${esc(d.name)}" loading="lazy">
        <span class="chrono-date">${esc(fmtFR(d.date))}</span>
      </div>`).join("")}
    </div>`);
  $$("#sheet [data-gopen]").forEach(el=>el.onclick=()=>viewDoc(p.docs.find(d=>d.id===el.dataset.gopen)));
  { const _e = $("#gal-back"); if (_e) _e.onclick = ()=>sheetDocs(pid); }
}

/* ============ RECHERCHE GLOBALE ============ */
async function sheetSearch(){
  openSheet(`
    ${navHeader("Moniteur", false)}
    <h3>🔍 Recherche</h3>
    <input id="srch-in" placeholder="Patient, soin, note, bilan, rappel…" autofocus style="margin-bottom:12px">
    <div id="srch-res" style="max-height:60vh;overflow-y:auto"></div>`);
  bindNav(closeSheet);

  const highlight = (text, q) => {
    if (!q) return esc(text);
    const i = text.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return esc(text);
    return esc(text.slice(0,i))+'<mark class="search-hit-hl">'+esc(text.slice(i,i+q.length))+'</mark>'+esc(text.slice(i+q.length));
  };

  const doSearch = q => {
    const box = $("#srch-res");
    if (!q || q.length < 2){ box.innerHTML = `<p class="muted small" style="padding:8px 0">Tape au moins 2 caractères…</p>`; return; }
    const ql = q.toLowerCase();
    const hits = [];
    // Actifs + clôturés (fin de PEC) + archivés : tout reste trouvable
    const all = [...activeP(), ...(S.patients||[]).filter(p=>p.pec && !p.archived),
                 ...(S.patients||[]).filter(p=>p.archived)];
    all.forEach(p => {
      const nomFull = p.nom.replace("Demo-","")+" "+p.prenom;
      // Patient lui-même
      if (nomFull.toLowerCase().includes(ql) || (p.ctx||"").toLowerCase().includes(ql)){
        const statut = p.pec ? "🎗️ Prise en charge terminée le "+fmtFR(p.pec.end)
                     : p.archived ? "📦 Dossier mis de côté" : (p.ctx||"Fiche patient");
        hits.push({ ico: p.pec?"🎗️":"🧑", title:nomFull.toUpperCase(), sub:statut,
          action:()=>{ closeSheet(); if (p.pec || p.archived) sheetPatient(p.id);
                       else { const live=getP(p.id); if(live){ openId=p.id; render(); } } } });
      }
      // Passages (notes)
      (p.visits||[]).forEach(v => {
        if ((v.note||"").toLowerCase().includes(ql) || (v.soins||[]).join(" ").toLowerCase().includes(ql)){
          const snippet = v.note||v.soins.join(", ");
          hits.push({ ico:"📋", title:nomFull.toUpperCase()+" — "+fmtFR(v.date), sub:snippet.slice(0,80), action:()=>{ openId=p.id; render(); closeSheet(); } });
        }
      });
      // Bilans
      (p.bilans||[]).forEach(b => {
        if ((b.type||"").toLowerCase().includes(ql)||(b.res||"").toLowerCase().includes(ql)){
          hits.push({ ico:"🧪", title:nomFull.toUpperCase()+" — "+b.type, sub:(b.res||"").slice(0,60), action:()=>{ openId=p.id; render(); closeSheet(); } });
        }
      });
      // Documents
      (p.docs||[]).forEach(d => {
        if ((d.name||"").toLowerCase().includes(ql)){
          hits.push({ ico:"📎", title:nomFull.toUpperCase()+" — "+d.name, sub:fmtFR(d.date||""), action:()=>{ openId=p.id; render(); closeSheet(); } });
        }
      });
    });
    // Rappels
    (S.rappels||[]).forEach(r => {
      if ((r.text||"").toLowerCase().includes(ql)){
        const rp = r.pid ? getP(r.pid) : null;
        hits.push({ ico:"📌", title:"Rappel"+(rp?" — "+rp.nom.replace("Demo-","").toUpperCase():""), sub:r.text.slice(0,80), action:()=>closeSheet() });
      }
    });

    if (!hits.length){ box.innerHTML = `<p class="muted small" style="padding:8px 0">Aucun résultat pour "<strong>${esc(q)}</strong>".</p>`; return; }
    box.innerHTML = hits.slice(0,40).map((h,i)=>`
      <div class="search-hit" data-hit="${i}">
        <span class="search-hit-ico">${h.ico}</span>
        <div class="search-hit-body">
          <div class="search-hit-title">${highlight(h.title,q)}</div>
          ${h.sub?`<div class="search-hit-sub">${highlight(h.sub,q)}</div>`:""}
        </div>
      </div>`).join("");
    $$("#srch-res [data-hit]").forEach((el,i)=>el.onclick=()=>hits[i].action());
  };

  let debT;
  $("#srch-in").oninput = e => { clearTimeout(debT); debT = setTimeout(()=>doSearch(e.target.value.trim()),180); };
  { const _e = $("#srch-close"); if (_e) _e.onclick = closeSheet; }
  doSearch("");
}

/* ============ LOG D'ERREURS ============ */
(async function setupErrorLog(){
  const MAX_LOGS = 50;
  async function logError(type, msg, stack){
    try {
      const existing = (await idbGet("errorlog")) || [];
      existing.push({ t:new Date().toISOString(), type, msg:String(msg).slice(0,200), stack:String(stack||"").slice(0,400) });
      await idbSet("errorlog", existing.slice(-MAX_LOGS));
    } catch {}
  }
  window.onerror = (msg, src, line, col, err) => { logError("error", msg, err&&err.stack||src+":"+line); return false; };
  window.onunhandledrejection = e => logError("promise", e.reason, e.reason&&e.reason.stack);
})();


/* ============ RÉCAPITULATIF DE FIN DE TOURNÉE ============ */
function sheetBilanTournee(pool, tourName){
  const today = todayISO();
  const vus = pool.filter(p=>p.visits.some(v=>v.date===today));
  const nonVus = pool.filter(p=>!p.visits.some(v=>v.date===today));
  const alertPatients = pool.filter(p=>{
    const lv=p.visits.filter(v=>v.date===today).pop();
    return lv && alertes(lv.consts, p.thresholds).length;
  });
  const rappelsDus = (S.rappels||[]).filter(r=>!r.done&&r.due&&daysUntil(r.due)<=1);
  const bilansAF = pool.flatMap(p=>(p.bilans||[]).filter(b=>b.statut==="À faire"));
  const evtTags = pool.flatMap(p=>p.visits.filter(v=>v.date===today).map(v=>{
    const tags = (v.note||"").match(/\[[^\]]+\]/g)||[];
    return tags.map(t=>({who:p.nom.replace("Demo-","").toUpperCase(), tag:t}));
  })).flat();

  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📋 Bilan de tournée — ${esc(tourName==="all"?"Toutes tournées":tourName)}</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(fmtFR(today))}</p>

    <div class="spill ok" style="margin-bottom:10px">
      <div class="l">✅ Patients vus</div>
      <div class="n">${vus.length}/${pool.length}</div>
    </div>
    ${nonVus.length?`<div class="spill warn" style="margin-bottom:10px">
      <div class="l">⏳ Non vus</div>
      <div class="n">${nonVus.length}</div>
    </div>`:""}
    ${alertPatients.length?`<div class="spill warn" style="margin-bottom:10px">
      <div class="l">🚨 Alertes constantes</div>
      <div class="n">${alertPatients.length}</div>
    </div>
    <div style="padding:0 8px 10px">${alertPatients.map(p=>{
      const lv=p.visits.filter(v=>v.date===today).pop();
      return `<div class="small" style="color:var(--danger)">⚠ ${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)} : ${alertes(lv.consts,p.thresholds).join(", ")}</div>`;
    }).join("")}</div>`:""}
    ${rappelsDus.length?`<div class="spill warn" style="margin-bottom:10px">
      <div class="l">📌 Rappels urgents (J0/J-1)</div>
      <div class="n">${rappelsDus.length}</div>
    </div>
    <div style="padding:0 8px 10px">${rappelsDus.map(r=>{
      const rp=r.pid?getP(r.pid):null;
      const cd=rapCountdown(r);
      return `<div class="small">${rapType(r.type).ic} ${esc(r.text.slice(0,60))}${rp?" — "+esc(rp.nom.replace("Demo-","").toUpperCase()):""}  <b style="color:var(--danger)">[${cd.txt}]</b></div>`;
    }).join("")}</div>`:""}
    ${bilansAF.length?`<div class="spill" style="margin-bottom:10px">
      <div class="l">🧪 Bilans en attente</div>
      <div class="n">${bilansAF.length}</div>
    </div>`:""}
    ${evtTags.length?`<div style="padding:0 8px 10px;border-left:3px solid var(--amber);margin-bottom:10px">
      <div class="lab" style="margin-bottom:4px">Événements notés</div>
      ${evtTags.map(e=>`<div class="small">${esc(e.who)} — ${esc(e.tag)}</div>`).join("")}
    </div>`:""}

    <div class="rowb" style="margin-top:14px">
      <button class="btn btn-primary" id="bt-releve">📝 Générer la relève</button>
    </div>`);
  { const _e = $("#bt-close"); if (_e) _e.onclick = closeSheet; }
  $("#bt-releve").onclick = () => { closeSheet(); sheetReleve(); };
}

/* ---------- Dictée rapide (FAB) ---------- */
function sheetQuickDictate(){
  const pool = activeP().filter(inTour);
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>🎤 Dictée rapide</h3>
    <p class="small muted" style="margin-bottom:8px">Dicte ta note puis tape le patient concerné — elle atterrit dans son dossier.</p>
    <div class="micwrap">
      <textarea id="qd-note" placeholder="Dicte ou tape ta note…" style="min-height:90px"></textarea>
      <button class="mic" id="qd-mic">🎤</button>
    </div>
    <div class="lab" style="margin:14px 0 8px">Affecter à :</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${pool.map(p=>`<button class="btn btn-ghost" data-qd="${p.id}" style="padding:14px 10px;font-size:14px">👤 ${esc(p.prenom)}<br><b>${esc(p.nom.replace("Demo-","").toUpperCase())}</b></button>`).join("") || '<p class="muted small" style="grid-column:1/-1">Aucun patient dans la tournée courante.</p>'}
    </div>
    <button class="btn btn-ghost" id="qd-close" style="margin-top:12px;width:100%">Annuler</button>`);
  $("#qd-mic").onclick = e => { e.preventDefault(); dictate($("#qd-note"), $("#qd-mic")); };
  $$("#sheet [data-qd]").forEach(b => b.onclick = () => {
    const note = $("#qd-note").value.trim();
    if (!note){ toast("Note vide — dicte ou écris d'abord."); return; }
    const p = getP(b.dataset.qd);
    p.visits.push({ uid:uid(), date:todayISO(), at:nowHM(), soins:[], consts:{}, note });
    save(true); closeSheet(); render();
    toast("Note ajoutée à " + p.prenom + " ✓");
  });
  $("#qd-close").onclick = closeSheet;
}


/* ---------- Écran de bienvenue (premier lancement) ---------- */
function sheetWelcome(){
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>👋 Bienvenue dans JM@Santé</h3>
    <p class="small" style="margin-bottom:12px;line-height:1.55">
      Ton carnet de <b>relève infirmière</b> : tu saisis tes passages au fil de la tournée
      (soins, constantes, transmissions, photos), et l'app génère la relève complète
      à envoyer au collègue ou au médecin — en un tap.
    </p>
    <div class="small" style="line-height:1.7;margin-bottom:14px">
      🗺️ <b>Tournées</b> — un cabinet = une tournée, avec son ordre de passage<br>
      👤 <b>Patients</b> — tape une carte pour saisir le passage du jour<br>
      🎤 <b>Dictée</b> — le micro flottant pour noter vite entre deux visites<br>
      📋 <b>Relève</b> — génère, relis, envoie (texte, PDF, HTML, Word)<br>
      🔒 <b>Sécurité</b> — code PIN + empreinte, données chiffrées, tout reste sur le téléphone
    </div>
    <p class="small muted" style="margin-bottom:12px">Des dossiers de démonstration sont chargés pour découvrir l'app.</p>
    <button class="btn btn-primary" id="wl-demo" style="width:100%">Découvrir avec la démo</button>
    <button class="btn btn-ghost" id="wl-empty" style="width:100%;margin-top:8px">Commencer avec mes propres patients</button>`);
  const finish = () => { try { delete S.firstRun; save(); } catch(e){} closeSheet(); try { render(); } catch(e){} };
  const demo = document.getElementById("wl-demo");
  const empty = document.getElementById("wl-empty");
  if (demo) demo.onclick = finish;
  if (empty) empty.onclick = () => {
    S.patients = []; S.rappels = []; S.tours = ["Ma tournée"]; S.curTour = "Ma tournée"; S.patientOrder = {};
    finish(); toast("C'est parti — crée ton premier patient avec ＋");
  };
  // Sécurité anti-figeage : tap hors de la feuille ferme et garde la démo
  const veil = document.getElementById("veil");
  if (veil) veil.onclick = (e) => { if (e.target.id === "veil") finish(); };
}

/* ---------- Salutation quotidienne ---------- */
const DAILY_GREETINGS = [
  "Bonne et belle journée, IDEL ! 🌿",
  "Belle tournée à toi aujourd'hui ! ☀️",
  "Prends soin de toi autant que de tes patients 💚",
  "Une nouvelle journée, de belles rencontres en perspective 🩺",
  "Courage pour la tournée, tu fais un métier essentiel 🌟",
  "Bon pied, bon œil — belle journée de soins ! 👟",
  "Bonjour ! Café injecté en intraveineuse, tournée chargée, c'est parti. ☕",
  "Debout avant le soleil : le monde appartient à ceux qui ont des pansements à faire.",
  "Le réveil a piqué, mais le premier café est prêt. Belle tournée !",
  "Clés de contact, stéthoscope, transmission propre. On démarre !",
  "Garde le sourire, la première prise de sang à jeun t'attend.",
  "Un grand café, zéro bouchon (on y croit) et une belle journée en vue.",
  "Les yeux piquent un peu, mais le cardio est là. En route !",
  "Mode guerrier activé : 35 passages, même pas peur. 💪",
  "Le soleil se lève à peine, mais l'IDEL est déjà sur le bitume. Bon courage !",
  "Objectif du matin : trouver une place où se garer sans prendre de PV. 🅿️",
  "Courage ! N'oublie pas que chaque passage finance un quart de seconde de retraite CARPIMKO.",
  "L'URSSAF et la CARPIMKO te souhaitent une excellente journée très rentable.",
  "Travaille dur ce matin : les caisses de cotisations comptent sur toi !",
  "Pense positif : après la CARPIMKO, il te reste pile de quoi t'acheter un café.",
  "Une pensée émue pour l'URSSAF qui te regarde travailler avec admiration.",
  "Bonjour ! Aujourd'hui, on cotise pour trois et on soigne pour dix.",
  "La CARPIMKO te remercie par avance pour ta contribution au patrimoine national.",
  "Chaque injection de ce matin rapproche l'URSSAF de son bonheur. Belle tournée !",
  "Règle d'or du jour : cotiser d'abord, soigner toujours, râler un peu.",
  "Travaille bien, l'échéancier trimestriel arrive plus vite que ton jour de repos !",
  "Parce qu'on a déjà assez à faire avec l'URSSAF et les escaliers.",
  "Même la CARPIMKO valide une relève aussi rapide.",
  "Bonjour ! Que la force de la NGAP soit avec toi pour cumuler les AMI sans te faire retoquer.",
  "La Sécurité Sociale t'aime (surtout quand les ordonnances sont parfaitement conformes).",
  "Objectif du jour : zéro rejet de télétransmission, zéro prise de tête.",
  "Que le grand esprit de la nomenclature veille sur tes cotations du jour !",
  "Un AIS par-ci, un AMI par-là : bonne tournée millimétrée !",
  "Si la CPAM avait ton rythme de travail, les dossiers seraient traités en 2 minutes.",
  "N'oublie pas le tampon, la signature et l'alignement des planètes pour la Sécu.",
  "La bienveillance au cœur, la cotation en tête. Bonne tournée !",
  "Aujourd'hui, on ne laisse passer aucun soin hors nomenclature. Force à toi !",
  "Les ordonnances d'un an renouvelées trois fois n'auront pas ta peau aujourd'hui.",
  "Prêt pour l'épreuve olympique : monter quatre étages sans ascenseur avec la mallette. 🏅",
  "Courage pour les escaliers étroits et les portes cochères récalcitrantes !",
  "Puissent les feux être verts et les patients prêts à ton arrivée. 🚦",
  "La mallette est bouclée, le coffre est plein : c'est parti pour le gymkhana urbain !",
  "Bonjour ! Que le capital veineux de tes patients soit franc et sans surprise ce matin.",
  "Attention aux chiens de garde trop affectueux et aux chats qui squattent les lits médicalisés. 🐕",
  "Un pansement complexe réussi du premier coup, c'est la promesse d'une bonne journée.",
  "Garde ton calme si la boîte de bandelettes est vide : tu en as dans le coffre (normalement).",
  "Belle journée ! Que personne ne te raconte toute sa vie avant le soin de 7h15.",
  "L'art d'enfiler des gants avec les mains encore humides : défi du jour accepté. 🧤",
  "Tout est dans la mallette. Même la relève.",
  "Tu ne portes pas de cape, mais tu sauves des tournées tous les jours. Bon courage !",
  "Le sourire que tu apportes au domicile n'a pas de prix (et n'est pas soumis à l'URSSAF).",
  "Tu es le maillon fort du maintien à domicile. Fière allure et bon pas !",
  "Toujours prêt, toujours efficace : excellente journée à toi !",
  "Le café est chaud, les compétences sont là : rien ne peut t'arrêter.",
  "Un métier indispensable fait par quelqu'un de formidable. Bonne tournée !",
  "Soigner, écouter, transmettre : une routine extraordinaire au quotidien.",
  "Prends soin d'eux, mais n'oublie pas de boire de l'eau entre deux visites ! 💧",
  "Même sous la pluie ou dans les bouchons, ton travail a du sens. Belle journée !",
  "Aujourd'hui est une bonne journée pour faire du super boulot. C'est parti !",
  "Moins de temps sur les notes, plus de temps pour le café. ☕",
  "Chantez, tournez, transmettez ! 🦗"
];
const END_GREETINGS = [
  "Tournée terminée, beau travail ! 👏",
  "C'est bouclé — repose-toi bien 🌙",
  "Mission accomplie, à demain ! ✨",
  "Belle tournée menée à bien, bravo 💚",
  "Fin de tournée — prends un moment pour toi ☕",
  "Bientôt le dernier arrêt, la relève propre sur l'appli et la liberté !",
  "Plus que quelques kilomètres avant d'éteindre le contact et de souffler.",
  "Une transmission claire, un collègue heureux, une journée validée.",
  "La relève est dans la boîte, tu as assuré. Rentre te poser !",
  "Fin de mission : les patients sont soignés, l'esprit est tranquille.",
  "Dépose la mallette, respire : ta tournée est bouclée avec brio.",
  "Plus qu'à envoyer la transmission en un tap et la journée est officiellement pliée.",
  "Bravo pour le marathon du jour. Repos bien mérité ! 🏃",
  "Clap de fin pour aujourd'hui : mission accomplie sur toute la ligne. 🎬",
  "La tournée est finie, la CARPIMKO est rassurée, tu peux enfin décompresser."
];
function dailyGreeting(){
  const today = todayISO();
  if (S.lastGreeting === today) return;   // déjà salué aujourd'hui
  S.lastGreeting = today; try { save(); } catch(e){}
  const msg = DAILY_GREETINGS[Math.floor(Math.random()*DAILY_GREETINGS.length)];
  const now = new Date();
  const jour = now.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  const el = document.createElement("div");
  el.className = "end-tour-modal";   // même habillage que la clôture
  el.innerHTML = `
    <div class="etm-card">
      <div class="etm-flag">👋</div>
      <div class="etm-title">Bonjour${S.identity&&S.identity.prenom?" "+esc(S.identity.prenom):""} !</div>
      <div class="etm-msg">${esc(msg)}</div>
      <div class="etm-time">${esc(jour.charAt(0).toUpperCase()+jour.slice(1))}</div>
      <button class="btn btn-primary etm-close">C'est parti</button>
    </div>`;
  const close = () => { el.classList.remove("show"); setTimeout(()=>el.remove(), 350); };
  el.querySelector(".etm-close").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 30);
  setTimeout(close, 8000);
}


/* ---------- Déblocage d'urgence (triple tap sur la date/titre) ---------- */
(function(){
  let taps=0, timer=null;
  document.addEventListener("DOMContentLoaded", ()=>{}, {once:true});
  document.addEventListener("click", (e)=>{
    const h = e.target.closest("#h-date, .header h1, #title");
    if (!h) return;
    taps++;
    clearTimeout(timer);
    timer = setTimeout(()=>{ taps=0; }, 600);
    if (taps>=3){
      taps=0;
      ["veil","lock"].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.remove("on"); });
      document.querySelectorAll(".daily-greet").forEach(el=>el.remove());
      if (typeof toast==="function") toast("Écran débloqué ✓");
    }
  });
})();


/* ---------- Fin de tournée ---------- */
function endTourneeGreeting(){
  const msg = END_GREETINGS[Math.floor(Math.random()*END_GREETINGS.length)];
  const now = new Date();
  const heure = String(now.getHours()).padStart(2,"0")+"h"+String(now.getMinutes()).padStart(2,"0");
  const el = document.createElement("div");
  el.className = "end-tour-modal";
  el.innerHTML = `
    <div class="etm-card">
      <div class="etm-flag">🏁</div>
      <div class="etm-title">Tournée terminée</div>
      <div class="etm-msg">${esc(msg)}</div>
      <div class="etm-time">Clôturée à ${heure}</div>
      <button class="btn btn-primary etm-close">Fermer</button>
    </div>`;
  const close = () => { el.classList.remove("show"); setTimeout(()=>el.remove(), 350); };
  el.querySelector(".etm-close").onclick = close;
  el.onclick = (e) => { if (e.target === el) close(); };
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 30);
  setTimeout(close, 13500); // 13,5 s (10 de plus qu'avant)
}
/* Silhouette de cigale en filigrane — sans yeux ni croix, purement décorative */
const CIG_FILI_SVG = `<svg viewBox="0 0 100 100" class="dlg-fili" aria-hidden="true">
  <g stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M38 22 C34 14, 30 11, 27 9"/><path d="M62 22 C66 14, 70 11, 73 9"/>
    <ellipse cx="50" cy="30" rx="15" ry="12"/>
    <path d="M35 40 C20 44, 12 60, 16 76 C24 74, 33 62, 37 50"/>
    <path d="M65 40 C80 44, 88 60, 84 76 C76 74, 67 62, 63 50"/>
    <path d="M38 40 C38 62, 44 80, 50 88 C56 80, 62 62, 62 40"/></g></svg>`;

/* Dialogue aux couleurs de l'application — remplace confirm(), qui affiche
   la boîte native d'Android : carrée, grise, étrangère au reste. */
function askDialog(o){
  return new Promise(res => {
    const rouge = o.ton === "danger";
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card ${rouge?"danger":""}">
      ${CIG_FILI_SVG}
      <div class="dlg-in">
        ${o.ic ? `<div class="dlg-ic">${o.ic}</div>` : ""}
        <div class="dlg-t">${esc(o.titre)}</div>
        ${o.sub ? `<div class="dlg-s">${o.sub}</div>` : ""}
        ${o.warn ? `<div class="dlg-w">${o.warn}</div>` : ""}
        ${o.saisie ? `<div class="dlg-f">
          ${o.saisieLbl ? `<div class="dlg-fl">${o.saisieLbl}</div>` : ""}
          <input id="dlg-in" ${o.saisie.type==="num"?'inputmode="decimal"':""}
                 placeholder="${esc(o.saisie.ph||"")}" value="${esc(o.saisie.val||"")}">
          ${o.saisie.aide ? `<div class="dlg-fa">${esc(o.saisie.aide)}</div>` : ""}
        </div>` : ""}
        <div class="dlg-act">
          <button class="btn btn-ghost" data-no>${esc(o.non || "Annuler")}</button>
          <button class="btn ${rouge?"dlg-dg":"btn-primary"}" data-yes ${o.verrou?"disabled":""}>${esc(o.oui || "Confirmer")}</button>
        </div>
      </div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    const inp = el.querySelector("#dlg-in");
    const btn = el.querySelector("[data-yes]");
    const fin = v => { el.classList.remove("show");
      setTimeout(() => el.remove(), 200); res(v); };
    /* Verrou : le bouton reste éteint tant que la saisie ne correspond pas.
       Sert à la suppression d'un dossier — on retape le nom du patient. */
    if (o.verrou && inp){
      const test = () => btn.disabled =
        inp.value.trim().toUpperCase() !== String(o.verrou).trim().toUpperCase();
      inp.oninput = test; test();
    }
    if (inp) setTimeout(() => inp.focus(), 120);
    el.querySelector("[data-no]").onclick = () => fin(false);
    btn.onclick = () => { if (btn.disabled) return;
      fin(o.saisie && !o.verrou ? (inp ? inp.value : "") : true); };
    if (inp) inp.onkeydown = e => { if (e.key === "Enter" && !btn.disabled) btn.click(); };
    el.onclick = e => { if (e.target === el) fin(false); };
  });
}

/* Choix entre plusieurs actions nommées.
   Remplace les confirm() du type « Oui ? (Annuler = autre chose) », où
   « Annuler » ne voulait pas dire annuler — piège classique. */
function askChoice(o){
  return new Promise(res => {
    const el = document.createElement("div");
    el.className = "dlg-veil";
    el.innerHTML = `<div class="dlg-card">
      ${CIG_FILI_SVG}
      <div class="dlg-in">
        ${o.ic ? `<div class="dlg-ic">${o.ic}</div>` : ""}
        <div class="dlg-t">${esc(o.titre)}</div>
        ${o.sub ? `<div class="dlg-s">${o.sub}</div>` : ""}
        <div class="dlg-opts">
          ${o.options.map((x,i)=>`<button class="dlg-opt" data-i="${i}">${x.ic?x.ic+" ":""}${esc(x.lbl)}</button>`).join("")}
        </div>
        <button class="dlg-cancel" data-no>${esc(o.non || "Annuler")}</button>
      </div></div>`;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add("show"), 16);
    const fin = v => { el.classList.remove("show");
      setTimeout(() => el.remove(), 200); res(v); };
    el.querySelectorAll("[data-i]").forEach(b =>
      b.onclick = () => fin(o.options[+b.dataset.i].val));
    el.querySelector("[data-no]").onclick = () => fin(null);
    el.onclick = e => { if (e.target === el) fin(null); };
  });
}

/* Saisie de texte — remplace prompt() */
function askText(titre, o){
  o = o || {};
  return askDialog({
    ic: o.ic, titre, sub: o.sub,
    saisie: { ph:o.ph||"", val:o.val||"", aide:o.aide, type:o.type },
    oui: o.oui || "✓ Enregistrer", non: "Annuler"
  });
}

async function terminerTournee(){
  const slot = (typeof activeSlot==="function") ? activeSlot() : null;
  const L = slot && SLOT_LBL[slot] ? SLOT_LBL[slot] : null;
  const wd = (typeof workDate==="function") ? workDate() : todayISO();
  /* Le pool AFFICHÉ, pas relevePool() : ce dernier filtre sur la sélection
     de relève et renvoie 0 quand rien n'a été coché. */
  const tour = S.curTour;
  const pool = (tour === "all" ? S.patients.filter(p => !p.archived)
                               : S.patients.filter(p => !p.archived && (p.tours||[]).includes(tour)));
  const estDuJour = v => v.date === wd &&
        (!S.slotsEnabled || !slot || slot === "jour" || (v.slot||defaultSlot()) === slot);
  const n = pool.reduce((a,p) => a + (p.visits||[]).filter(estDuJour).length, 0);

  const ok = await askDialog({
    ic: "🏁", titre: "Terminer la tournée ?",
    sub: `${S.curTour==="all"?"Toutes les tournées":esc(S.curTour)}${L?` · ${L.ic} ${esc(L.lbl.toLowerCase())}`:""}<br>
          <b style="color:var(--accent)">${n} passage${n>1?"s":""}</b> enregistré${n>1?"s":""}`,
    non: "Annuler", oui: "🏁 Clôturer"
  });
  if (!ok) return;
  // Un seul écran de fin : le récapitulatif du déroulé, message en tête
  if (typeof seqEndScreen === "function") seqEndScreen(pool, slot, true);
  else endTourneeGreeting();
}


/* ---------- Masquer les boutons flottants pendant la saisie ---------- */
(function(){
  const isField = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
  document.addEventListener("focusin", e => {
    if (isField(e.target)) document.body.classList.add("typing");
  });
  document.addEventListener("focusout", e => {
    // Laisser un court délai : si le focus passe à un autre champ, on reste en mode saisie
    setTimeout(() => {
      if (!isField(document.activeElement)) document.body.classList.remove("typing");
    }, 120);
  });
  // Textareas auto-extensibles (la zone grandit avec le texte)
  document.addEventListener("input", e => {
    const t = e.target;
    if (t && t.tagName === "TEXTAREA" && t.dataset.note !== undefined){
      t.style.height = "auto";
      t.style.height = Math.min(t.scrollHeight + 2, 260) + "px";
    }
  });
})();


/* ---------- Téléchargement du mode d'emploi ----------
   Le manuel illustré est embarqué dans l'app (www/manuel.html).
   "html" → enregistre/partage le fichier ; "pdf" → l'ouvre pour
   l'imprimer en PDF (aucune app ne sait générer un PDF depuis
   un HTML complexe sans passer par le moteur d'impression). */
async function downloadManuel(mode){
  try {
    const res = await fetch("manuel.html");
    if (!res.ok) throw new Error("introuvable");
    const html = await res.text();

    if (mode === "pdf"){
      // Aperçu DANS l'app : un onglet séparé piège l'utilisateur
      // dans le WebView Android (pas de barre d'adresse, pas de retour).
      if (typeof showFichePreview === "function"){
        showFichePreview(html, "JMSante_Mode_emploi");
        toast("Utilise « Imprimer / PDF » en bas de l'écran 📑");
      } else {
        await shareText(html, "JMSante_Mode_emploi.html", "text/html");
      }
      return;
    }

    // Enregistrement / partage du fichier HTML
    const name = "JMSante_Mode_emploi.html";
    const cap = window.Capacitor;
    if (cap && cap.isNativePlatform && cap.isNativePlatform()){
      try {
        const { Filesystem, Share } = cap.Plugins;
        const b64 = btoa(unescape(encodeURIComponent(html)));
        const r = await Filesystem.writeFile({ path:name, data:b64, directory:"CACHE" });
        await Share.share({ title:"Mode d'emploi JM@Santé", url:r.uri });
        return;
      } catch(e){ if((e.message||"").match(/cancel/i)) return; console.warn(e); }
    }
    const blob = new Blob([html], { type:"text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=name; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 4000);
    toast("Mode d'emploi téléchargé 📘");
  } catch(e){
    console.error("manuel:", e);
    toast("Manuel indisponible dans cette version", "danger");
  }
}

/* ============================================================
   FRISE DE L'EN-TÊTE — un motif animé par thème
   ─────────────────────────────────────────────────────────
   hopital → tracé ECG d'origine qui défile
   reunion → déferlantes, une baleine et un aileron qui passent
   tubes   → un tube de néon dégradé qui glisse de teinte
   autres  → un tracé cardiaque fixe et discret

   ⚠️ Animations en CSS, pas en SMIL : un <animateTransform>
   dans un SVG injecté par innerHTML ne démarre pas de façon
   fiable (silhouettes figées à leur position de départ).
============================================================ */
function friseSvg(theme){
  if (theme === "reunion"){
    return `<svg viewBox="0 0 340 26" preserveAspectRatio="xMidYMid slice" class="fr-svg">
      <g fill="none" stroke="var(--accent)" stroke-linecap="round">
        <path d="M0 15 Q17 9 34 15 T68 15 T102 15 T136 15 T170 15 T204 15 T238 15 T272 15 T306 15 T340 15"
          stroke-width="1.6" opacity=".62"/>
        <path d="M0 19 Q21 14 42 19 T84 19 T126 19 T168 19 T210 19 T252 19 T294 19 T336 19"
          stroke-width="1.2" opacity=".3"/>
      </g>
      <path class="fr-whale" fill="var(--accent)" opacity=".85"
        d="M0 1 Q-1.5 -5 -11 -12 Q-5.5 -13.5 0 -8 Q5.5 -13.5 11 -12 Q1.5 -5 0 1 Z"/>
      <path class="fr-fin" fill="var(--accent)" opacity=".78"
        d="M0 1 Q1.5 -10 10 -14 Q5.5 -7 7 1 Z"/>
    </svg>`;
  }
  if (theme === "tubes"){
    return `<svg viewBox="0 0 340 22" preserveAspectRatio="xMidYMid meet" class="fr-svg">
      <defs>
        <!-- userSpaceOnUse : sur une ligne horizontale la bbox est plate,
             un dégradé (ou un filtre) en unités relatives ne s'applique pas. -->
        <linearGradient id="frNeon" gradientUnits="userSpaceOnUse" x1="6" y1="11" x2="334" y2="11">
          <stop offset="0"   stop-color="#2BB3A3"/>
          <stop offset=".33" stop-color="#4A9FD8"/>
          <stop offset=".66" stop-color="#9B6BD8"/>
          <stop offset="1"   stop-color="#E0559A"/>
        </linearGradient>
        <filter id="frGlow" filterUnits="userSpaceOnUse" x="0" y="0" width="340" height="22">
          <feGaussianBlur stdDeviation="2.4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <g class="fr-neon">
        <line x1="6" y1="11" x2="334" y2="11" stroke="url(#frNeon)" stroke-width="3"
          stroke-linecap="round" filter="url(#frGlow)" opacity=".9"/>
        <line x1="6" y1="11" x2="334" y2="11" stroke="#fff" stroke-width=".8"
          stroke-linecap="round" opacity=".3"/>
      </g>
    </svg>`;
  }
  if (theme === "hopital"){
    // Tracé d'origine (v49) : deux complexes QRS puis un cœur dans la ligne
    const P = "M0 20 H24 q5 -5 10 0 h5 l2 3 l3 -16 l3 17 l2 -4 h7 q6 -7 12 0 H96 q5 -5 10 0 h5 l2 3 l3 -16 l3 17 l2 -4 h7 q6 -7 12 0 H176 c0 0 -7 -6 -7 -10 c0 -3 2.5 -5 4.5 -5 c1.5 0 2.5 1.5 2.5 3.5 c0 -2 1 -3.5 2.5 -3.5 c2 0 4.5 2 4.5 5 c0 4 -7 10 -7 10 H300";
    return `<svg viewBox="0 0 300 30" preserveAspectRatio="xMidYMid slice" class="fr-svg">
      <g class="fr-ecg" fill="none" stroke="var(--accent)" stroke-width="1.8"
         stroke-linejoin="round" stroke-linecap="round" opacity=".9">
        <path d="${P}"/>
        <path d="${P}" transform="translate(300,0)"/>
      </g>
    </svg>`;
  }
  // bloc · verre — tracé cardiaque fixe et discret
  return `<svg viewBox="0 0 340 20" preserveAspectRatio="none" class="fr-svg">
    <defs><linearGradient id="frFade" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="340" y2="10">
      <stop offset="0" stop-color="var(--accent)" stop-opacity="0"/>
      <stop offset=".14" stop-color="var(--accent)" stop-opacity=".6"/>
      <stop offset=".86" stop-color="var(--accent)" stop-opacity=".6"/>
      <stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="M0 11 H52 l3 -5 l4 10 l3 -5 H128 l3 -6 l4 12 l4 -6 H208 l3 -4 l4 8 l3 -4 H284 l3 -5 l4 10 l3 -5 H340"
      fill="none" stroke="url(#frFade)" stroke-width="1.5"
      stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* ============================================================
   SANTÉ DE L'APPLICATION
   ─────────────────────────────────────────────────────────
   Voir l'état sans deviner : place occupée, volume de données,
   dernière sauvegarde, incidents récents, et une vérification
   d'intégrité qui repère les incohérences.
============================================================ */
async function sheetSante(){
  const nP  = (S.patients||[]).filter(p=>!p.archived).length;
  const nA  = (S.patients||[]).filter(p=>p.archived).length;
  const nV  = (S.patients||[]).reduce((a,p)=>a+(p.visits||[]).length, 0);
  const nD  = (S.patients||[]).reduce((a,p)=>a+(p.docs||[]).length, 0);
  const nI  = (S.incidents||[]).length;
  const nT  = (S.trash||[]).length;

  // Place occupée — l'API n'est pas disponible partout
  let place = null;
  try {
    if (navigator.storage && navigator.storage.estimate){
      const e = await navigator.storage.estimate();
      if (e && e.usage != null) place = { u:e.usage, q:e.quota||0 };
    }
  } catch(err){ /* indisponible : on affiche simplement le nombre d'éléments */ }
  const mo = o => (o/1048576).toFixed(1).replace(".", ",") + " Mo";

  const pbs = verifierIntegrite();

  openSheet(`
    ${navHeader("Réglages", true)}
    <h3>🩺 Santé de l'application</h3>
    <p class="small muted" style="margin-bottom:14px">L'état réel de tes données sur cet appareil.</p>

    <div class="rowlab ac"><span>Contenu</span><i></i></div>
    <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="sante-g">
        <div class="sa-c"><b>${nP}</b><span>patients</span></div>
        <div class="sa-c"><b>${nV}</b><span>passages</span></div>
        <div class="sa-c"><b>${nD}</b><span>documents</span></div>
        <div class="sa-c"><b>${nA}</b><span>mis de côté</span></div>
      </div>
      ${nT ? `<p class="small muted" style="margin:7px 0 0">🗑 ${nT} dossier(s) en corbeille</p>` : ""}
    </div>

    <div class="rowlab bl"><span>Stockage</span><i></i></div>
    <div class="rowbox bl" style="display:block;margin-bottom:12px">
      ${place ? `<div class="small">Occupé : <b>${mo(place.u)}</b>${
          place.q ? ` sur ${mo(place.q)} disponibles` : ""}</div>
        ${place.q ? `<div class="sa-bar"><i style="width:${
          Math.max(1, Math.min(100, Math.round(place.u/place.q*100)))}%"></i></div>` : ""}`
        : `<div class="small muted">Mesure indisponible sur cet appareil.</div>`}
      <div class="small muted" style="margin-top:7px">Dernière sauvegarde : ${
        (typeof _saveLast !== "undefined" && _saveLast)
          ? new Date(_saveLast).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})
          : "aucune depuis l'ouverture"}</div>
    </div>

    <div class="rowlab ${pbs.length ? "am" : "ac"}"><span>Intégrité</span><i></i>
      <em>${pbs.length ? pbs.length + " à voir" : "rien à signaler"}</em></div>
    <div class="rowbox ${pbs.length ? "am" : "ac"}" style="display:block;margin-bottom:12px">
      ${pbs.length
        ? pbs.map(x=>`<div class="sa-pb"><span>⚠</span><span>${esc(x)}</span></div>`).join("")
        : `<div class="small muted">Aucune incohérence détectée dans les dossiers.</div>`}
    </div>

    <div class="rowlab ${nI ? "vi" : "nt"}"><span>Incidents</span><i></i>
      <em>${nI ? nI + " enregistré" + (nI>1?"s":"") : "aucun"}</em></div>
    <div class="rowbox ${nI ? "vi" : "nt"}" style="display:block;margin-bottom:12px">
      ${nI ? (S.incidents||[]).slice(0,8).map(x=>`<div class="sa-inc">
          <span class="si-d">${esc(new Date(x.at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}))}</span>
          <span class="si-m">${esc(x.msg)}${x.det?`<span class="si-x">${esc(x.det)}</span>`:""}</span>
        </div>`).join("")
        + (nI > 8 ? `<p class="small muted" style="margin:6px 0 0">… et ${nI-8} plus anciens</p>` : "")
        + `<button class="btn btn-ghost" id="sa-clr" style="width:100%;margin-top:9px">Vider le journal</button>`
        : `<div class="small muted">Rien à signaler — aucune erreur enregistrée.</div>`}
    </div>

    <p class="small muted">Ce journal ne contient aucune donnée patient : seulement la date, l'origine et le message technique.</p>`);

  { const b = $("#sa-clr"); if (b) b.onclick = async () => {
      if (!await askDialog({ ic:"🧹", titre:"Vider le journal des incidents ?",
        sub:"Tes données ne changent pas.", oui:"✓ Vider" })) return;
      S.incidents = []; save(true); sheetSante(); toast("Journal vidé");
    }; }
}

/* Repère les incohérences réparables — sans rien modifier */
function verifierIntegrite(){
  const out = [];
  (S.patients||[]).forEach(p => {
    const nom = (p.prenom||"") + " " + (p.nom||"").replace("Demo-","");
    if (!p.id)   out.push(`Dossier sans identifiant : ${nom}`);
    if (!p.nom)  out.push(`Dossier sans nom (${p.id||"?"})`);
    (p.visits||[]).forEach(v => {
      if (!v.date) out.push(`Passage sans date — ${nom}`);
    });
    // Une tournée référencée qui n'existe plus
    (p.tours||[]).forEach(t => {
      if (!(S.tours||[]).includes(t)) out.push(`${nom} : tournée « ${t} » introuvable`);
    });
  });
  // Un rappel qui pointe vers un dossier disparu
  (S.rappels||[]).forEach(r => {
    if (r.pid && !(S.patients||[]).some(p => p.id === r.pid))
      out.push(`Rappel « ${(r.text||"").slice(0,28)} » sans dossier`);
  });
  return [...new Set(out)].slice(0, 12);
}
