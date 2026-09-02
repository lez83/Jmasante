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
    openSheet(`<h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune constante enregistrée sur les 90 derniers jours.</p>
      <button class="btn btn-ghost" id="gcl">← Retour</button>`);
    $("#gcl").onclick = closeSheet; return;
  }

  let selKey = available[0].key;
  const render = () => {
    const def = CONST_DEFS.find(d=>d.key===selKey);
    const pts = extractConstValues(recent, selKey);
    const stat = pts.length ? `Dernière : ${pts[pts.length-1].val} ${def.unit} (${fmtFR(pts[pts.length-1].date)}) · ${pts.length} mesure(s)` : "";
    const chips = available.map(d=>`<button class="chip ${d.key===selKey?"on":""}" data-gk="${esc(d.key)}">${esc(d.lbl)}</button>`).join("");
    openSheet(`
      <h3>📈 Courbes — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <div class="chips" style="margin-bottom:10px">${chips}</div>
      ${buildConstSvg(pts, def)}
      ${stat?`<p class="small muted" style="text-align:center;margin-top:4px">${esc(stat)}</p>`:""}
      <button class="btn btn-ghost" id="gcl" style="margin-top:14px">← Retour</button>`);
    $$("#sheet [data-gk]").forEach(b=>b.onclick=()=>{ selKey=b.dataset.gk; render(); });
    $("#gcl").onclick = closeSheet;
  };
  render();
}

/* ============ GALERIE CHRONOLOGIQUE ============ */
function sheetGalerie(pid){
  const p = getP(pid);
  const photos = (p.docs||[]).filter(d=>d.mime&&d.mime.startsWith("image/"))
    .slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  if (!photos.length){
    openSheet(`<h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
      <p class="muted small" style="padding:20px 0 8px;text-align:center">Aucune photo dans ce dossier.</p>
      <button class="btn btn-ghost" id="gal-back">← Retour</button>`);
    $("#gal-back").onclick = ()=>sheetDocs(pid); return;
  }
  openSheet(`
    <h3>🖼️ Galerie — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-","").toUpperCase())}</h3>
    <p class="small muted" style="margin-bottom:10px">${photos.length} photo(s) — ordre chronologique</p>
    <div class="chrono-grid">
      ${photos.map(d=>`
      <div class="chrono-item" data-gopen="${esc(d.id)}">
        <img src="${d.data}" alt="${esc(d.name)}" loading="lazy">
        <span class="chrono-date">${esc(fmtFR(d.date))}</span>
      </div>`).join("")}
    </div>
    <button class="btn btn-ghost" id="gal-back" style="margin-top:14px">← Retour</button>`);
  $$("#sheet [data-gopen]").forEach(el=>el.onclick=()=>viewDoc(p.docs.find(d=>d.id===el.dataset.gopen)));
  $("#gal-back").onclick = ()=>sheetDocs(pid);
}

/* ============ RECHERCHE GLOBALE ============ */
function sheetSearch(){
  openSheet(`
    <h3>🔍 Recherche</h3>
    <input id="srch-in" placeholder="Patient, soin, note, bilan, rappel…" autofocus style="margin-bottom:12px">
    <div id="srch-res" style="max-height:60vh;overflow-y:auto"></div>
    <button class="btn btn-ghost" id="srch-close" style="margin-top:12px">Fermer</button>`);

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
    const all = [...activeP(), ...(S.patients||[]).filter(p=>p.archived)];
    all.forEach(p => {
      const nomFull = p.nom.replace("Demo-","")+" "+p.prenom;
      // Patient lui-même
      if (nomFull.toLowerCase().includes(ql) || (p.ctx||"").toLowerCase().includes(ql)){
        hits.push({ ico:"🧑", title:nomFull.toUpperCase(), sub:p.ctx||"Fiche patient", action:()=>{ const live=getP(p.id); if(live){ openId=p.id; render(); closeSheet();} } });
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
  $("#srch-close").onclick = closeSheet;
  doSearch("");
}

/* ============ LOG D'ERREURS ============ */
(function setupErrorLog(){
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
      <button class="btn btn-ghost" id="bt-close">Fermer</button>
      <button class="btn btn-primary" id="bt-releve">📝 Générer la relève</button>
    </div>`);
  $("#bt-close").onclick = closeSheet;
  $("#bt-releve").onclick = () => { closeSheet(); sheetReleve(); };
}

/* ---------- Dictée rapide (FAB) ---------- */
function sheetQuickDictate(){
  const pool = activeP().filter(inTour);
  openSheet(`
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
    save(); closeSheet(); render();
    toast("Note ajoutée à " + p.prenom + " ✓");
  });
  $("#qd-close").onclick = closeSheet;
}


/* ---------- Écran de bienvenue (premier lancement) ---------- */
function sheetWelcome(){
  openSheet(`
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
  "Bon pied, bon œil — belle journée de soins ! 👟"
];
const END_GREETINGS = [
  "Tournée terminée, beau travail ! 👏",
  "C'est bouclé — repose-toi bien 🌙",
  "Mission accomplie, à demain ! ✨",
  "Belle tournée menée à bien, bravo 💚",
  "Fin de tournée — prends un moment pour toi ☕"
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
function terminerTournee(){
  const slot = (typeof activeSlot==="function") ? activeSlot() : null;
  const slotLbl = slot ? (slot==="matin" ? "du matin ☀️" : "du soir 🌙") : "";
  if (!confirm("Terminer la tournée "+slotLbl+" ?\nCela clôt la journée en cours pour cette tournée.")) return;
  endTourneeGreeting();
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
