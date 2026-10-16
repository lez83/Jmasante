/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   RELÈVE NARRATIVE — en cours d'essai
   ─────────────────────────────────────────────────────────
   La forme télégraphique reste la meilleure pour une journée ordinaire.
   Elle s'essouffle quand les éléments doivent être RELIÉS : une plaie
   qui évolue, un contexte de vie, une dégradation.

   ⚠️ L'APP ASSEMBLE, ELLE NE CONCLUT PAS. Elle écrit « 4,2 × 3,1 cm,
   contre 4,8 × 3,4 le 28 septembre » — jamais « en amélioration ».
   « Amélioration », « dégradation », « état stable » sont des
   conclusions cliniques : elles appartiennent au soignant. Un test
   vérifie l'absence de ces mots dans le texte produit.

   ⚠️ ON NE GÉNÈRE PAS DES PHRASES, ON ASSEMBLE DES FRAGMENTS. Dix
   gabarits couvrent l'essentiel des passages. Fabriquer de la prose
   « naturelle » produirait des tournures qui sonnent juste et disent
   faux.

   ⚠️ LES COMPTAGES SONT DES FAITS, PAS DES INTERPRÉTATIONS.
   « Pansement refait 3 fois sur les 8 derniers jours » se vérifie.
   « Suivi irrégulier » serait un jugement.

   ⚠️ LES NOTES LIBRES NE SONT JAMAIS REFORMULÉES. L'app ne sait pas
   lire « un peu confuse » : elle rassemble les phrases du soignant
   telles quelles, sous un titre, en les datant.

   ⚠️ RIEN N'EST ÉCRIT DANS UN DOSSIER : la relève est un texte produit
   à la demande. Les réglages vivent dans `essaiData("narratif")`.
============================================================ */

/* Les gabarits : un fragment par type de soin. Volontairement courts —
   c'est l'enchaînement qui fait la phrase, pas chaque morceau. */
const NARR_SOINS = [
  { re:/toilette/i,                  f:"toilette" },
  { re:/pansement|plaie|réfection/i, f:"réfection du pansement" },
  { re:/injection|insuline|piq/i,    f:"injection" },
  { re:/perfusion|perf\b/i,          f:"perfusion" },
  { re:/sonde|sondage/i,             f:"sondage" },
  { re:/bas|contention/i,            f:"pose des bas de contention" },
  { re:/médicament|pilulier|traitement/i, f:"distribution du traitement" },
  { re:/prise de sang|prélèvement|bilan/i, f:"prélèvement" },
  { re:/surveillance|constantes/i,   f:"surveillance" },
  { re:/vaccin/i,                    f:"vaccination" }
];

function narrData(){
  const d = essaiData("narratif");
  if (d.opts === undefined)
    d.opts = { silence:true, comparer:true, compter:true, contexte:true, entourage:true };
  if (d.opts.silence === undefined) d.opts.silence = true;
  return d;
}

/* ── Les outils de langue, volontairement minces ── */
function narrListe(items){
  const l = items.filter(Boolean);
  if (!l.length) return "";
  if (l.length === 1) return l[0];
  return l.slice(0, -1).join(", ") + " et " + l[l.length - 1];
}
function narrJour(iso){
  if (!iso) return "";
  const [a, m, j] = iso.split("-");
  const MOIS = ["janvier","février","mars","avril","mai","juin","juillet",
                "août","septembre","octobre","novembre","décembre"];
  return Number(j) + " " + (MOIS[Number(m) - 1] || "") ;
}
function narrHeure(h){
  if (!h) return "";
  const [hh, mm] = h.split(":");
  return Number(hh) + "h" + (mm && mm !== "00" ? mm : "");
}
function narrSoins(liste){
  const vus = [];
  (liste || []).forEach(s => {
    const g = NARR_SOINS.find(x => x.re.test(s));
    const f = g ? g.f : s.toLowerCase();
    if (!vus.includes(f)) vus.push(f);
  });
  return narrListe(vus);
}

/* ⚠️ Les constantes sont CITÉES, avec leur valeur précédente quand elle
   existe. Aucune flèche, aucun mot : deux nombres et une date. */
function narrConstantes(p, v, precedente, tout){
  const c = v.consts || {};
  const out = [];
  /* ⚠️ La virgule décimale, pas le point : « 36,7 » et non « 36.7 ».
     Un chiffre écrit à l'anglaise sur une transmission française se
     lit mal, et peut se relire de travers. */
  const fr = x => String(x).replace(".", ",");
  const dire = (cle, lbl, unite) => {
    if (c[cle] == null || c[cle] === "") return;
    const av = precedente && precedente.consts ? precedente.consts[cle] : null;
    const bouge = !av || String(av) !== String(c[cle]);
    /* Valeur inchangée et pas d'alerte : on la tait. */
    if (!bouge && !tout && narrData().opts.silence !== false) return;
    out.push(lbl + " " + fr(c[cle]) + (unite || "")
      + (av && bouge && narrData().opts.comparer
         ? " (précédemment " + fr(av) + (unite || "") + ")" : ""));
  };
  dire("ta", "TA");
  dire("temp", "température", " °C");
  dire("pouls", "pouls");
  dire("satu", "saturation", " %");
  dire("glycemie", "glycémie");
  dire("poids", "poids", " kg");
  return narrListe(out);
}

/* ⚠️ Un COMPTAGE, pas une appréciation : le lecteur juge lui-même si
   3 fois sur 8 jours est peu ou assez. */
function narrComptages(p, start, end){
  if (!narrData().opts.compter) return "";
  const vs = (p.visits || []).filter(v => v.date >= start && v.date <= end);
  if (vs.length < 2) return "";
  const jours = new Set(vs.map(v => v.date)).size;
  const nb = {};
  vs.forEach(v => (v.soins || []).forEach(s => {
    const g = NARR_SOINS.find(x => x.re.test(s));
    const f = g ? g.f : s.toLowerCase();
    nb[f] = (nb[f] || 0) + 1;
  }));
  const l = Object.entries(nb)
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([f, n]) => f + " " + n + " fois");
  if (!l.length) return "";
  return "Sur la période : " + narrListe(l) + ", en " + jours + " jour" + (jours > 1 ? "s" : "") + ".";
}

/* ⚠️ Les notes du soignant sont RASSEMBLÉES, jamais reformulées. */
function narrNotes(p, start, end){
  if (!narrData().opts.contexte) return "";
  const l = (p.visits || [])
    .filter(v => v.date >= start && v.date <= end && (v.note || "").trim())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(v => "— " + narrJour(v.date) + " : " + v.note.trim());
  return l.length ? l.join("\n") : "";
}

/* ── Le texte d'un patient ── */
function narrPatient(p, start, end){
  const vs = (p.visits || [])
    .filter(v => v.date >= start && v.date <= end)
    .sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at));
  if (!vs.length) return "";

  const nom = (p.prenom || "") + " " + (p.nom || "").replace("Demo-", "").toUpperCase();
  const age = (typeof ageOf === "function" && p.dob != null) ? ageOf(p.dob) : null;
  let t = nom.trim() + (age != null ? ", " + age + " ans" : "") + ".\n";

  const der = vs[vs.length - 1];
  /* La visite d'avant, pour citer la valeur précédente. */
  const avant = (p.visits || [])
    .filter(v => (v.date + v.at) < (der.date + der.at))
    .sort((a, b) => (a.date + a.at).localeCompare(b.date + b.at)).pop();

  const phr = [];
  phr.push("Passage du " + narrJour(der.date)
    + (der.at ? " à " + narrHeure(der.at) : "") + ".");

  /* ⚠️ CE QUI NE VARIE PAS NE S'ÉCRIT PAS. Reprendre tout le plan de
     soins à chaque passage allonge la relève sans rien apprendre : si
     la glycémie est faite trois jours de suite sans rien de
     particulier, le dire trois fois est du bruit.

     On ne détaille donc que les soins HORS PLAN, ou ceux qui portent un
     commentaire. Le plan tenu se résume en quatre mots — car son
     absence, elle, compte. */
  const plan = p.plan || [];
  const horsPlan = (der.soins || []).filter(x => !plan.includes(x));
  const commentes = Object.keys(der.soinNotes || {}).filter(k => (der.soinNotes[k] || "").trim());
  const aDire = [...new Set([...horsPlan, ...commentes])];
  const planTenu = plan.length && plan.every(x => (der.soins || []).includes(x));

  if (planTenu && !aDire.length) phr.push("Soins du plan réalisés.");
  else {
    if (planTenu) phr.push("Soins du plan réalisés.");
    else if (plan.length){
      const manquants = plan.filter(x => !(der.soins || []).includes(x));
      /* ⚠️ Un soin du plan NON fait est une information, pas un silence. */
      if (manquants.length) phr.push("Non réalisé : " + narrListe(manquants) + ".");
    }
    const sup = narrSoins(aDire);
    if (sup) phr.push("En plus : " + sup + ".");
  }
  commentes.forEach(k => {
    phr.push(k + " — " + (der.soinNotes[k] || "").trim()
      + (/[.!?]$/.test((der.soinNotes[k] || "").trim()) ? "" : "."));
  });

  /* ⚠️ Une alerte OUVRE le paragraphe : elle ne doit pas se lire comme
     le reste. */
  const al = (typeof alertes === "function") ? alertes(der.consts, p.thresholds) : [];
  /* ⚠️ Même principe pour les constantes : une valeur identique à celle
     de la veille n'apprend rien. On cite CE QUI A CHANGÉ, et tout en
     cas d'alerte — là, le contexte compte. */
  const cst = narrConstantes(p, der, avant, al.length > 0);
  if (cst){
    phr.push(al.length
      ? "Constantes hors seuils : " + cst + "."
      : "Constantes : " + cst + ".");
  }
  if (al.length) t += "\u26A0 " + al.join(" · ") + "\n";
  t += phr.join(" ") + "\n";

  const cpt = narrComptages(p, start, end);
  if (cpt) t += cpt + "\n";

  const n = narrNotes(p, start, end);
  if (n) t += n + "\n";

  if (narrData().opts.entourage && typeof pVoixMention === "function"){
    const m = pVoixMention(p.id);
    if (m) t += m.trim() + "\n";
  }
  return t;
}

/* ── La relève entière ── */
function narrReleve({ start, end, tour }){
  const pool = (typeof relevePool === "function") ? relevePool(tour || "all", start, end) : [];
  const blocs = pool.map(p => narrPatient(p, start, end)).filter(Boolean);
  const entete = "Relève du " + narrJour(start)
    + (end && end !== start ? " au " + narrJour(end) : "") + "\n\n";
  return entete + (blocs.length ? blocs.join("\n") : "Aucun passage sur la période.\n");
}

/* ── L'écran ── */
function sheetNarratif(){
  const o = narrData().opts;
  const h = todayISO();
  const apercu = narrReleve({ start:h, end:h, tour:S.curTour || "all" });

  openSheet(`
    ${navHeader("Réglages", true)}
    ${typeof essaiBandeau === "function" ? essaiBandeau("narratif") : ""}
    <h3>📝 Relève narrative</h3>
    <p class="small muted" style="margin-bottom:10px">Des phrases au lieu de lignes. La forme télégraphique reste disponible : celle-ci ne la remplace pas.</p>

    <div class="warn" style="margin-bottom:12px">L'application <b>assemble, elle ne conclut pas</b> : elle cite les valeurs et les compte, elle n'écrit jamais « amélioration », « dégradation » ni « état stable ». Ces mots t'appartiennent.</div>

    <div class="lab">Ce qu'elle inclut</div>
    ${[["silence","Taire ce qui ne bouge pas","Un soin du plan fait comme prévu, une constante identique à la veille : inutile de le répéter."],
       ["comparer","Citer la valeur précédente","« TA 14/8 (précédemment 15/9) » — le chiffre, pas le jugement."],
       ["compter","Compter les soins sur la période","« réfection du pansement 3 fois, en 8 jours ». Un fait vérifiable."],
       ["contexte","Reprendre mes notes libres","Telles que tu les as écrites, datées. Jamais reformulées."],
       ["entourage","Signaler la note vocale","La mention part dans le texte, pour qui ne peut pas écouter."]]
      .map(([k,l,d]) => `
        <label class="screl" style="margin-bottom:6px">
          <input type="checkbox" data-no="${k}" ${o[k] ? "checked" : ""}>
          <span><b>${esc(l)}</b><br><span class="small muted">${esc(d)}</span></span>
        </label>`).join("")}

    <div class="lab" style="margin-top:14px">Aperçu — aujourd'hui</div>
    <pre class="narr-ap">${esc(apercu)}</pre>

    <button class="btn btn-ghost" id="na-copy" style="width:100%;margin-top:10px">📋 Copier ce texte</button>
    <div class="tip" style="margin-top:10px">Tu relis et tu corriges avant d'envoyer : c'est là que l'ajustement est le plus naturel.</div>`);
  bindNav(() => sheetTours());
  if (typeof essaiBandeauBind === "function") essaiBandeauBind();
  $$("#sheet [data-no]").forEach(c => c.onchange = () => {
    narrData().opts[c.dataset.no] = c.checked;
    save(true); sheetNarratif();
  });
  { const b = $("#na-copy");
    if (b) b.onclick = async () => {
      try { await navigator.clipboard.writeText(apercu); toast("Texte copié"); }
      catch(e){ toast("Copie impossible", "danger"); }
    }; }
}
