/* ============================================================
   TENDANCES — voir ce que les seuils ne voient pas
   ─────────────────────────────────────────────────────────
   Les seuils alertent quand UNE valeur sort des bornes. Ils
   ne voient pas une dégradation lente où chaque mesure reste
   normale : six pesées au-dessus du seuil, et pourtant
   −2,4 kg en trois semaines.

   ⚠️ Une tendance est un CONSTAT, jamais un diagnostic.
   L'app dit « le poids a baissé de 2,4 kg ». Elle ne dira
   jamais « dénutrition » : c'est l'IDEL qui interprète.

   Poids et TA seulement : la glycémie varie trop d'un jour à
   l'autre, la température n'a de sens qu'en valeur absolue.
============================================================ */

const TREND = {
  minPts:   4,     // sous 4 mesures, on signale du bruit
  minJours: 14,    // il faut du recul pour parler de tendance
  maxJours: 90,    // au-delà, ce n'est plus la situation actuelle
  poids: { seuil: 2.0, unite: "kg",    lbl: "Poids" },   // kg sur la période
  ta:    { seuil: 1.5, unite: "cmHg",  lbl: "Tension" }  // points de systolique
};

/* Relevés datés d'une constante, du plus ancien au plus récent */
function trendPoints(p, cle){
  const out = [];
  (p.visits||[]).forEach(v => {
    const c = v.consts || {};
    let val = null;
    if (cle === "poids") val = num(c.poids);
    else if (cle === "ta" && c.ta){
      let s = num(String(c.ta).split("/")[0]);
      if (s != null && s > 40) s /= 10;      // 140 → 14
      val = s;
    }
    if (val != null && v.date) out.push({ d: v.date, v: val });
  });
  out.sort((a,b) => a.d.localeCompare(b.d));
  return out;
}

/* Une tendance, ou null si les données ne permettent pas de conclure */
function trendOf(p, cle){
  const cfg = TREND[cle];
  const pts = trendPoints(p, cle);
  if (pts.length < TREND.minPts) return null;

  const fin = pts[pts.length - 1];
  const jFin = Math.round((new Date(todayISO()) - new Date(fin.d)) / 864e5);
  if (jFin > 30) return null;                 // mesures trop anciennes

  // On borne la fenêtre : la situation d'il y a six mois n'éclaire rien
  const limite = new Date(new Date(fin.d) - TREND.maxJours * 864e5)
                   .toISOString().slice(0,10);
  const zone = pts.filter(x => x.d >= limite);
  if (zone.length < TREND.minPts) return null;

  const deb = zone[0];
  const jours = Math.round((new Date(fin.d) - new Date(deb.d)) / 864e5);
  if (jours < TREND.minJours) return null;

  const delta = fin.v - deb.v;
  if (Math.abs(delta) < cfg.seuil) return null;

  return {
    cle, lbl: cfg.lbl, unite: cfg.unite,
    delta: Math.round(delta * 10) / 10,
    depuis: deb.d, jusqu: fin.d, jours, n: zone.length,
    debut: deb.v, fin: fin.v
  };
}

/* Toutes les tendances d'un patient */
function trendsOf(p){
  return ["poids","ta"].map(k => trendOf(p, k)).filter(Boolean);
}

/* Formulation neutre — un constat, pas une interprétation */
function trendTexte(t){
  const sens = t.delta < 0 ? "en baisse" : "en hausse";
  const signe = t.delta > 0 ? "+" : "";
  return `${t.lbl} ${sens} : ${signe}${t.delta} ${t.unite} en ${t.jours} jours`;
}

/* Encart pour la fiche patient */
function trendHtml(p){
  const ts = trendsOf(p);
  if (!ts.length) return "";
  return `<div class="rowlab vi" style="margin-top:12px">
      <span>Tendances</span><i></i><em>sur les dernières mesures</em>
    </div>
    <div class="rowbox vi" style="display:block;margin-bottom:12px">
      ${ts.map(t => `<div class="trend">
        <span class="tr-ar">${t.delta < 0 ? "📉" : "📈"}</span>
        <span class="tr-b">
          <span class="tr-t">${esc(trendTexte(t))}</span>
          <span class="tr-d">${t.n} mesures · du ${esc(fmtFR(t.depuis))} au ${esc(fmtFR(t.jusqu))}
            · ${t.debut} → ${t.fin} ${esc(t.unite)}</span>
        </span>
      </div>`).join("")}
      <p class="small muted" style="margin:7px 0 0">Constat sur les mesures enregistrées — à interpréter selon le contexte du patient.</p>
    </div>`;
}
