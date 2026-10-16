/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   MÉDICAMENTS — la recherche, la fiche, l'ajustement
   ─────────────────────────────────────────────────────────
   Les données sont dans medicaments_base.js, avec la doctrine qui les
   encadre. Ici : comment on cherche, ce qu'on affiche, et comment le
   soignant corrige ou complète la liste.

   ⚠️ DEUX ENTRÉES, UN SEUL ÉCRAN. On arrive soit par Réglages → Mes
   outils, soit par la loupe d'une ligne de traitement, et dans ce
   second cas la recherche est déjà remplie. Un écran unique, sinon
   l'ajustement fait dans un chemin ne se retrouverait pas dans
   l'autre.

   ⚠️ LA RECHERCHE IGNORE LES ACCENTS ET LA CASSE, et porte sur la DCI,
   TOUS les noms commerciaux, la famille et l'indication. C'est le
   point : on lit « TAHOR » sur une ordonnance, on ne connaît pas
   « atorvastatine ». Sans la recherche par nom commercial, la base ne
   sert à rien.

   ⚠️ RIEN N'ENTRE DANS UN DOSSIER DEPUIS CET ÉCRAN. C'est une lecture,
   comme les bilans. Aucun nom de patient n'y apparaît, et la loupe ne
   fait que remplir un champ de recherche.

   ⚠️ L'APPLICATION N'INTERPRÈTE RIEN et ne pose aucun diagnostic. Les
   interactions médicamenteuses ne sont PAS embarquées : un bouton
   renvoie vers la base publique. Une liste partielle d'interactions
   rassurerait à tort — c'est pire que pas de liste du tout.
============================================================ */

/* ── La pliure sans accents ──
   ⚠️ CHAQUE REMPLACEMENT FAIT UN SEUL CARACTÈRE, donc la chaîne pliée a
   EXACTEMENT la même longueur que l'originale. C'est ce qui permet au
   surlignage de retrouver ses positions dans le texte d'origine. Une
   table où « œ » donnerait « oe » décalerait tout le surlignage d'un
   cran après chaque œ. (Un test le vérifie.) */
const _MED_PLI = {
  "à":"a","â":"a","ä":"a","á":"a","ã":"a","å":"a","ç":"c",
  "è":"e","é":"e","ê":"e","ë":"e","ì":"i","î":"i","ï":"i","í":"i",
  "ò":"o","ô":"o","ö":"o","ó":"o","õ":"o","œ":"o",
  "ù":"u","û":"u","ü":"u","ú":"u","ý":"y","ÿ":"y","ñ":"n","æ":"a","ß":"s"
};
function medPli(s){
  let o = "";
  for (const ch of String(s == null ? "" : s).toLowerCase())
    o += (_MED_PLI[ch] !== undefined ? _MED_PLI[ch] : ch);
  return o;
}

/* Surlignage de la correspondance, accents compris. */
function medSurl(txt, q){
  const t = String(txt == null ? "" : txt);
  const fq = medPli(q).trim();
  if (!fq) return esc(t);
  const f = medPli(t);
  let out = "", i = 0, k;
  while ((k = f.indexOf(fq, i)) >= 0){
    out += esc(t.slice(i, k)) + "<mark>" + esc(t.slice(k, k + fq.length)) + "</mark>";
    i = k + fq.length;
  }
  return out + esc(t.slice(i));
}

/* ── Ce que le soignant a corrigé ou ajouté ──
   Les 226 entrées d'origine restent en dur et reviennent quand on le
   demande, comme pour les bilans et les modèles de documents. */
const MED_CHAP_PERSO = "Mes ajouts";

function medData(){
  S.medPerso = S.medPerso || {};
  S.medPerso.modifs = S.medPerso.modifs || {};   // DCI d'origine → champs corrigés
  S.medPerso.ajouts = S.medPerso.ajouts || [];   // entrées entièrement nouvelles
  return S.medPerso;
}
function medAjuste(){
  const M = medData();
  return Object.keys(M.modifs).length + M.ajouts.length;
}

/* La liste effective : l'originale, les corrections par-dessus, les
   ajouts à la suite. La DCI d'une entrée d'origine n'est jamais
   réécrite — c'est la clé qui relie la correction à son original. */
function medListe(){
  const M = medData();
  const out = [];
  MED_BASE.forEach(g => g.items.forEach(m => {
    const mod = M.modifs[m.d];
    out.push(mod ? { ...m, ...mod, d:m.d, g:g.g, ajuste:true } : { ...m, g:g.g });
  }));
  (M.ajouts || []).forEach(m => out.push({ ...m, g: m.g || MED_CHAP_PERSO, perso:true }));
  return out;
}
function medChapitres(){
  const vus = MED_BASE.map(g => g.g);
  if (medData().ajouts.length) vus.push(MED_CHAP_PERSO);
  return vus;
}
function medTotal(){ return medListe().length; }

/* Le texte sur lequel on cherche. Construit une fois par entrée. */
function medIndex(m){
  return medPli([m.d, m.c, m.f, m.i].join(" ⋅ "));
}

/* ── L'état de l'écran ── */
let _medQ = "", _medOuvert = null, _medChap = null, _medVoie = null, _medAsso = false;
let _medRetour = null;      // d'où l'on vient — Mes outils, ou une fiche de traitement

function medVoiePuce(v){
  const x = MED_VOIES[v];
  return x ? `<span class="md-v" title="${esc(x.n)}">${x.ic} ${esc(x.n)}</span>` : "";
}

function sheetMedicaments(opts){
  opts = opts || {};
  if (opts.q !== undefined){ _medQ = String(opts.q || ""); _medOuvert = null; }
  if (opts.retour !== undefined) _medRetour = opts.retour;
  if (opts.chap !== undefined) _medChap = opts.chap;

  const q = _medQ.trim();
  const fq = medPli(q);
  const tous = medListe();

  /* Le filtrage : recherche, puis chapitre, puis voie. Les trois se
     cumulent, et le compteur affiché est celui du résultat final. */
  let L = fq ? tous.filter(m => medIndex(m).includes(fq)) : tous.slice();
  if (_medChap) L = L.filter(m => m.g === _medChap);
  if (_medVoie) L = L.filter(m => (m.v || []).includes(_medVoie));
  /* ⚠️ C'est devant une ASSOCIATION qu'on hésite le plus : deux molécules
     dans un comprimé, un nom qui ne ressemble à aucun des deux. */
  if (_medAsso) L = L.filter(m => m.asso);

  /* ⚠️ LES ORDONNANCES PORTENT DÉSORMAIS DES NOMS COMPOSÉS :
     « IRBESARTAN/HYDROCHLOROTHIAZIDE ARROW », « EZETIMIBE/ATORVASTATINE
     ZENTIVA ». Cherchée en entier, cette chaîne ne tombe sur rien. On
     redécoupe alors en mots et on propose ceux qui donnent un résultat,
     plutôt que d'annoncer sèchement qu'on ne sait pas. */
  const repeche = (!L.length && fq)
    ? [...new Set(medPli(q).split(/[^a-z0-9]+/).filter(m => m.length >= 4))]
        .map(mot => ({ mot, n: tous.filter(m => medIndex(m).includes(mot)).length }))
        .filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 4)
    : [];

  /* Regroupement par chapitre, dans l'ordre d'origine. */
  const ordre = medChapitres();
  const paq = ordre.map(g => ({ g, items: L.filter(m => m.g === g) })).filter(x => x.items.length);

  const ligne = m => {
    const ouvert = _medOuvert === m.d;
    return `<div class="md-i ${ouvert?"on":""}">
      <button class="md-h" data-mdi="${esc(m.d)}">
        <span class="md-txt">
          <span class="md-d">${medSurl(m.d, q)}${
            m.perso ? ` <span class="md-tag">ajouté</span>` : (m.ajuste ? ` <span class="md-tag am">corrigé</span>` : "")}</span>
          ${m.c ? `<span class="md-c">${medSurl(m.c, q)}</span>` : `<span class="md-c faint">— pas de nom commercial renseigné</span>`}
          <span class="md-f">${medSurl(m.f, q)}</span>
        </span>
        <span class="md-fl">${ouvert?"⌄":"›"}</span>
      </button>
      ${ouvert ? `<div class="md-fiche">
        <div class="md-q">À QUOI ÇA SERT</div>
        <p class="md-p">${medSurl(m.i, q)}</p>
        ${(m.v||[]).length ? `<div class="md-vs">${m.v.map(medVoiePuce).join("")}</div>` : ""}
        ${(m.s||"").trim() ? `<div class="md-q">CE QUE JE SURVEILLE</div>
          <p class="md-p md-s">${esc(m.s)}</p>` : ""}
        ${(m.r||"").trim() ? `<div class="md-q">BON À SAVOIR</div>
          <p class="md-p md-r">${esc(m.r)}</p>` : ""}

        <!-- ⚠️ LE CADRE EST RAPPELÉ SUR CHAQUE FICHE, pas une fois dans
             un écran d'accueil qu'on ne relit jamais. Même choix que
             pour les bilans. -->
        <div class="md-cadre">Aide-mémoire, <b>pas une aide à la prescription</b> : ni posologie, ni contre-indication, ni interaction. La posologie est sur l'ordonnance du patient.</div>

        <div class="rowb" style="gap:7px;margin-top:9px">
          <button class="btn btn-ghost btn-sm" data-mdinter="${esc(m.d)}" style="flex:1">🔗 Vérifier les interactions</button>
          <button class="btn btn-ghost btn-sm" data-mded="${esc(m.d)}">✏️ Corriger</button>
        </div>
      </div>` : ""}
    </div>`;
  };

  openSheet(`
    ${navHeader(_medRetour ? "Retour" : "Réglages", true)}
    <h3 style="margin-bottom:2px">💊 Médicaments</h3>
    <p class="small muted" style="margin-bottom:11px">${medTotal()} molécules${
      medAjuste() ? ` · <b style="color:var(--amber)">${medAjuste()} de ta main</b>` : ""
      } · noms commerciaux vérifiés le ${esc(MED_VERIF)}</p>

    <!-- ⚠️ CE QUE LA BASE NE DIT PAS, ANNONCÉ EN HAUT. Un soignant qui
         croit avoir sous la main un contrôle d'interactions prendrait
         une décision sur une base qui n'en sait rien. -->
    <div class="warn" style="margin-bottom:11px">À quoi sert un médicament, par quelle voie, et ce qu'il y a à surveiller. <b>Ni posologie, ni contre-indication, ni interaction</b> — pour les interactions, chaque fiche renvoie vers la base publique.</div>

    <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-bottom:9px">
      <span>🔍</span>
      <input id="md-q" class="rec-in" placeholder="Chercher — tahor, inipomp, statine…"
             value="${esc(_medQ)}" style="flex:1;min-width:0" autocomplete="off">
      ${_medQ ? `<button class="lien-x" id="md-qx" aria-label="Effacer">✕</button>` : ""}
    </div>

    <div class="md-chips">
      <button class="chip sm ${_medChap?"":"on"}" data-mdc="">Tout</button>
      ${medChapitres().map(g => `<button class="chip sm ${_medChap===g?"on":""}" data-mdc="${esc(g)}">${esc(g)}</button>`).join("")}
    </div>
    <div class="md-chips">
      <button class="chip sm ${_medVoie?"":"on"}" data-mdv="">Toutes voies</button>
      ${Object.keys(MED_VOIES).map(k => `<button class="chip sm ${_medVoie===k?"on":""}" data-mdv="${esc(k)}">${MED_VOIES[k].ic} ${esc(MED_VOIES[k].n)}</button>`).join("")}
      <button class="chip sm ${_medAsso?"on":""}" id="md-asso">🔗 Associations</button>
    </div>

    <p class="small muted" style="margin:10px 0 7px">${
      L.length ? `<b>${L.length}</b> résultat${L.length>1?"s":""}` : "Aucun résultat"}</p>

    ${paq.map(x => `
      <div class="lab" style="margin-top:12px">${esc(x.g)} <span class="md-n">${x.items.length}</span></div>
      ${x.items.map(ligne).join("")}`).join("")}

    ${!L.length && repeche.length ? `<div class="tip" style="margin-top:4px">
      Rien ne correspond à « <b>${esc(q)}</b> » en entier, mais ces mots-là donnent quelque chose :
      <div class="md-chips" style="margin-top:7px">
        ${repeche.map(x => `<button class="chip sm" data-mdmot="${esc(x.mot)}">${esc(x.mot)} <span class="md-n">${x.n}</span></button>`).join("")}
      </div>
    </div>` : ""}

    ${!L.length ? `<div class="tip" style="margin-top:4px">
      Rien ne correspond${q ? ` à « <b>${esc(q)}</b> »` : ""}.
      ${q ? `<br><span class="small">Un médicament qui manque se rajoute : il restera dans ta base.</span>` : ""}
      ${q ? `<div style="margin-top:9px"><button class="btn btn-primary btn-sm" id="md-add-q">＋ Ajouter « ${esc(q)} »</button></div>` : ""}
    </div>` : ""}

    <button class="btn btn-ghost" id="md-add" style="width:100%;margin-top:13px;border-style:dashed">＋ Ajouter un médicament</button>

    <div class="rowlab bl" style="margin-top:14px"><span>Depuis un classeur</span><i></i></div>
    <div class="rowbox bl" style="display:block">
      <p class="small muted" style="margin:0 0 8px">Une ligne par molécule, sept colonnes. L'export contient ta base entière, corrections comprises : c'est aussi ta sauvegarde.</p>
      <div class="rowb" style="gap:8px">
        <button class="btn btn-ghost btn-sm" id="md-xls-in" style="flex:1">📥 Importer</button>
        <button class="btn btn-ghost btn-sm" id="md-xls-out" style="flex:1">📤 Exporter</button>
        <button class="btn btn-ghost btn-sm" id="md-xls-mod" style="flex:1">📄 Modèle</button>
      </div>
      ${medAjuste() ? `<button class="btn btn-ghost btn-sm" id="md-raz" style="width:100%;margin-top:8px">↺ Revenir à la liste d'origine</button>` : ""}
    </div>
    <input type="file" id="md-xls-file" accept=".xlsx" style="display:none">

    <div class="tip" style="margin-top:13px">Une base qui dit son âge est honnête : les noms commerciaux ont été confrontés à la base publique des médicaments le <b>${esc(MED_VERIF)}</b>. Ils bougent — en cas de doute, c'est la base publique qui fait foi, pas celle-ci.</div>`);

  bindNav(() => { const r = _medRetour; _medRetour = null; (r || sheetTours)(); });

  /* ⚠️ Le champ garde le curseur : sans ça, chaque lettre tapée relance
     le dessin et renvoie le curseur en fin de ligne — impossible de
     corriger une faute au milieu du mot. Même correctif que les bilans. */
  { const e = $("#md-q");
    if (e) e.oninput = () => { _medQ = e.value; _medOuvert = null;
      const p = e.selectionStart; sheetMedicaments();
      const n = $("#md-q"); if (n){ n.focus(); n.setSelectionRange(p, p); } }; }
  { const b = $("#md-qx"); if (b) b.onclick = () => sheetMedicaments({ q:"" }); }

  $$("#sheet [data-mdc]").forEach(b => b.onclick = () => {
    _medChap = b.dataset.mdc || null; _medOuvert = null; sheetMedicaments(); });
  $$("#sheet [data-mdv]").forEach(b => b.onclick = () => {
    _medVoie = b.dataset.mdv || null; _medOuvert = null; sheetMedicaments(); });
  $$("#sheet [data-mdi]").forEach(b => b.onclick = () => {
    _medOuvert = (_medOuvert === b.dataset.mdi) ? null : b.dataset.mdi; sheetMedicaments(); });
  $$("#sheet [data-mded]").forEach(b => b.onclick = () => sheetMedEdit(b.dataset.mded));
  $$("#sheet [data-mdinter]").forEach(b => b.onclick = () => medInteractions(b.dataset.mdinter));

  { const b = $("#md-asso"); if (b) b.onclick = () => {
      _medAsso = !_medAsso; _medOuvert = null; sheetMedicaments(); }; }
  $$("#sheet [data-mdmot]").forEach(b => b.onclick = () => sheetMedicaments({ q:b.dataset.mdmot }));

  { const b = $("#md-add");   if (b) b.onclick = () => sheetMedEdit(null); }
  { const b = $("#md-add-q"); if (b) b.onclick = () => sheetMedEdit(null, { d:_medQ.trim() }); }

  { const b = $("#md-xls-mod"); if (b) b.onclick = () => medModeleXlsx(); }
  { const b = $("#md-xls-out"); if (b) b.onclick = () => medExportXlsx(); }
  { const b = $("#md-xls-in");  if (b) b.onclick = () => $("#md-xls-file").click(); }
  { const e = $("#md-xls-file");
    if (e) e.onchange = () => { const f = e.files && e.files[0]; e.value = "";
      if (f) medImportXlsx(f); }; }

  { const b = $("#md-raz");
    if (b) b.onclick = async () => {
      const M = medData();
      if (!await askDialog({ ton:"danger", ic:"↺", titre:"Revenir à la liste d'origine ?",
        sub:`Tes <b>${Object.keys(M.modifs).length} correction(s)</b> et <b>${M.ajouts.length} ajout(s)</b> seront perdus.`,
        warn:"Pense à exporter ta base avant, si tu veux la garder.",
        non:"Annuler", oui:"↺ Tout remettre d'origine" })) return;
      S.medPerso = { modifs:{}, ajouts:[] }; save(true);
      toast("Liste d'origine rétablie");
      sheetMedicaments();
    }; }
}

/* ── Les interactions : dehors, et assumé ──
   ⚠️ C'EST LE POINT DE DOCTRINE DE CE MODULE. On n'embarque aucune
   donnée d'interaction : partielle, elle rassurerait à tort. On envoie
   vers la base publique, en disant pourquoi. */
function medInteractions(dci){
  const url = "https://base-donnees-publique.medicaments.gouv.fr/";
  askDialog({ ic:"🔗", titre:"Les interactions ne sont pas dans l'app",
    sub:`Volontairement : une liste incomplète d'interactions est plus dangereuse qu'une absence de liste, parce qu'elle laisse croire qu'on a vérifié.<br><br>Pour <b>${esc(dci)}</b>, la base publique des médicaments donne le résumé des caractéristiques du produit, à jour.`,
    non:"Rester ici", oui:"🌐 Ouvrir la base publique" }).then(ok => {
      if (!ok) return;
      /* ⚠️ "_system" et pas "_blank" : dans la WebView Android, une
         fenêtre sans parent ne rend pas la main. Piège déjà rencontré
         à l'impression, documenté dans cabinet.js. */
      try { window.open(url, "_system"); }
      catch(e){ toast("Ouverture impossible", "danger"); }
    });
}

/* ── La loupe depuis une ligne de traitement ──
   ⚠️ On reçoit « DOLIPRANE 1000 mg », pas « paracétamol ». Il faut
   retirer le dosage et la forme, puis trouver LE mot qui tombe dans la
   base — c'est lui qu'on met dans le champ de recherche. */
const _MED_BRUIT = /\b(lp|l\.p|cp|comprime|comprimes|gelule|gelules|sachet|sachets|ampoule|ampoules|injectable|inj|collyre|patch|patchs|gouttes|goutte|solution|suspension|susp|buvable|creme|pommade|gel|spray|stylo|flacon|dose|doses|retard|effervescent|orodispersible|matin|midi|soir|coucher|si|besoin|et|de|du|la|le|les|par|jour|mg|g|ug|mcg|ui|ml|cc|pour|cent)\b/g;

function medMotsDe(nom){
  let f = medPli(nom)
    .replace(/\d+([.,]\d+)?\s*(mg|g|µg|ug|mcg|ui|ml|%)/g, " ")  // les dosages
    .replace(/[^a-z0-9]+/g, " ")
    .replace(_MED_BRUIT, " ");
  return f.split(/\s+/).filter(m => m.length >= 4);
}

/* Rend la requête à mettre dans le champ, ou "" si la ligne ne donne
   rien d'exploitable. On ne devine pas la molécule : on remplit une
   recherche, le soignant lit et décide. */
function medRequeteDepuis(nom){
  const mots = medMotsDe(nom);
  if (!mots.length) return "";
  const idx = medListe().map(medIndex);
  for (const m of mots) if (idx.some(t => t.includes(m))) return m;
  return mots[0];     // rien ne tombe : on cherche quand même, l'écran proposera d'ajouter
}

/* Appelé par la fiche de traitement. */
function medDepuisTraitement(nom, retour){
  sheetMedicaments({ q: medRequeteDepuis(nom), retour, chap:null });
}

/* ============================================================
   CORRIGER OU AJOUTER UNE ENTRÉE
   ⚠️ La DCI d'une entrée d'origine ne se réécrit PAS : c'est la clé qui
   relie la correction à son original, et donc ce qui permet de revenir
   en arrière. Pour une entrée ajoutée, elle est libre.
   ⚠️ Les champs refusés ici sont refusés partout : pas de posologie, pas
   de contre-indication, pas d'interaction. Le libellé des champs le dit
   à l'écran, parce qu'un champ libre finit toujours par recevoir ce
   qu'on n'a pas interdit explicitement.
============================================================ */
let _medEdV = new Set();

function medOriginal(dci){
  for (const g of MED_BASE){
    const m = g.items.find(x => x.d === dci);
    if (m) return { ...m, g:g.g };
  }
  return null;
}

function sheetMedEdit(dci, prefill){
  const M = medData();
  const orig = dci ? medOriginal(dci) : null;
  const perso = dci && !orig ? M.ajouts.find(x => x.d === dci) : null;
  const cur = dci ? medListe().find(m => m.d === dci) : null;
  const v = cur || prefill || {};
  const neuf = !dci;

  _medEdV = new Set(v.v || []);

  const champ = (id, lbl, val, ph, aide, large) => `
    <div class="field">
      <span class="lab">${lbl}</span>
      ${large
        ? `<textarea id="${id}" class="md-ta" placeholder="${esc(ph||"")}">${esc(val||"")}</textarea>`
        : `<input id="${id}" placeholder="${esc(ph||"")}" value="${esc(val||"")}">`}
      ${aide ? `<span class="md-aide">${aide}</span>` : ""}
    </div>`;

  openSheet(`
    ${navHeader("Médicaments", true)}
    <h3 style="margin-bottom:2px">${neuf ? "＋ Ajouter un médicament" : "✏️ " + esc(dci)}</h3>
    <p class="small muted" style="margin-bottom:12px">${
      orig ? "Entrée d'origine — tu peux la corriger, et revenir à l'original quand tu veux."
           : (perso ? "Entrée que tu as ajoutée." : "Elle restera dans ta base, et dans l'export.")}</p>

    <div class="warn" style="margin-bottom:12px">On ne saisit ici <b>ni posologie, ni contre-indication, ni interaction</b>. Ce qu'on fait au moment de l'administration, oui ; ce que le médecin décide, non.</div>

    ${orig
      ? `<div class="field"><span class="lab">DCI (molécule)</span>
           <input value="${esc(dci)}" disabled>
           <span class="md-aide">Non modifiable : c'est ce qui relie ta correction à l'entrée d'origine.</span></div>`
      : champ("me-d", "DCI (molécule)", v.d, "Paracétamol",
          "Le nom de la molécule, pas celui de la boîte.")}

    ${champ("me-c", "Noms commerciaux", v.c, "Doliprane · Dafalgan · Efferalgan",
      "Séparés par <b>·</b>, une virgule ou un slash. C'est par là qu'on cherche le plus souvent.")}

    ${champ("me-f", "Famille thérapeutique", v.f, "Antalgique de palier 1",
      "")}

    <div class="field"><span class="lab">Voie</span>
      <div class="md-chips" id="me-voies">
        ${Object.keys(MED_VOIES).map(k => `<button type="button" class="chip sm ${_medEdV.has(k)?"on":""}" data-mev="${k}">${MED_VOIES[k].ic} ${esc(MED_VOIES[k].n)}</button>`).join("")}
      </div>
      <span class="md-aide">Plusieurs voies possibles. C'est ce qui aide quand la question est « c'est quoi, cette injection ? ».</span></div>

    ${champ("me-i", "Indication — à quoi ça sert", v.i, "Douleurs légères à modérées, fièvre", "", true)}

    ${champ("me-s", "Ce que je surveille", v.s, "Poids chaque matin, diurèse…",
      "Surveillance infirmière : ce qu'on regarde et ce qu'on transmet. Pas une consigne médicale.", true)}

    ${champ("me-r", "Bon à savoir", v.r, "À jeun, 30 min avant le petit-déjeuner…",
      "Modalité d'administration, piège de nom, forme à ne pas écraser.", true)}

    <button class="btn btn-primary" id="me-ok" style="width:100%;margin-top:14px">✓ Enregistrer</button>
    ${(orig && M.modifs[dci]) ? `<button class="btn btn-ghost" id="me-raz" style="width:100%;margin-top:7px">↺ Revenir à l'entrée d'origine</button>` : ""}
    ${perso ? `<button class="btn btn-ghost" id="me-del" style="width:100%;margin-top:7px;color:var(--danger);border-color:var(--danger)">🗑 Supprimer cette entrée</button>` : ""}`);

  bindNav(() => sheetMedicaments());

  $$("#sheet [data-mev]").forEach(b => b.onclick = () => {
    const k = b.dataset.mev;
    _medEdV.has(k) ? _medEdV.delete(k) : _medEdV.add(k);
    b.classList.toggle("on", _medEdV.has(k));
  });

  { const b = $("#me-ok");
    if (b) b.onclick = () => {
      const lire = id => ($("#" + id)?.value || "").trim();
      const d = orig ? dci : lire("me-d");
      if (!d){ toast("Il faut au moins la molécule", "danger"); return; }
      const champs = { c:lire("me-c"), f:lire("me-f"), v:[...Array.from(_medEdV)],
                       i:lire("me-i"), s:lire("me-s"), r:lire("me-r") };

      if (orig){
        /* ⚠️ Si la correction redonne exactement l'original, on efface la
           correction : sinon l'entrée resterait marquée « corrigé » alors
           qu'elle ne l'est plus, et le compteur mentirait. */
        const pareil = ["c","f","i","s","r"].every(k => (champs[k]||"") === (orig[k]||""))
          && JSON.stringify(champs.v.slice().sort()) === JSON.stringify((orig.v||[]).slice().sort());
        if (pareil) delete M.modifs[dci]; else M.modifs[dci] = champs;
      } else if (perso){
        Object.assign(perso, champs, { d });
        /* La DCI a pu changer : elle sert de clé d'affichage. */
        if (d !== dci) perso.d = d;
      } else {
        if (medListe().some(m => medPli(m.d) === medPli(d))){
          toast("Cette molécule est déjà dans la base", "danger"); return;
        }
        M.ajouts.push({ id: uid(), d, ...champs, g: MED_CHAP_PERSO });
      }
      save(true);
      toast(neuf ? "Médicament ajouté" : "Entrée enregistrée");
      _medOuvert = d;
      sheetMedicaments();
    }; }

  { const b = $("#me-raz");
    if (b) b.onclick = async () => {
      if (!await askDialog({ ic:"↺", titre:"Revenir à l'entrée d'origine ?",
        sub:"Ta correction sur <b>" + esc(dci) + "</b> sera perdue.", oui:"↺ Revenir" })) return;
      delete M.modifs[dci]; save(true);
      toast("Entrée d'origine rétablie"); _medOuvert = dci; sheetMedicaments();
    }; }

  { const b = $("#me-del");
    if (b) b.onclick = async () => {
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer « " + esc(dci) + " » ?",
        sub:"Cette entrée que tu as ajoutée sera retirée de ta base.",
        non:"Annuler", oui:"🗑 Supprimer" })) return;
      M.ajouts = M.ajouts.filter(x => x !== perso); save(true);
      toast("Entrée supprimée"); _medOuvert = null; sheetMedicaments();
    }; }
}

/* ============================================================
   LE CLASSEUR
   ⚠️ Mêmes alias d'en-têtes que l'import du plan de traitement : on
   repère les colonnes par leur titre, où qu'elles soient, et les
   colonnes inconnues sont ignorées plutôt que de faire échouer tout
   l'import.
============================================================ */
const MED_XLS_COLS = {
  d: /^(dci|molecule|substance|nom dci|principe actif)/,
  c: /^(nom|noms) (commercial|commerciaux|de marque|marque)|^(marque|specialite|specialites|princeps)/,
  f: /^(famille|classe)/,
  v: /^(voie|voies|mode d administration|administration)/,
  i: /^(indication|indications|a quoi|usage)/,
  s: /^(surveillance|ce que je surveille|vigilance)/,
  r: /^(remarque|remarques|bon a savoir|note|notes|commentaire)/,
  g: /^(chapitre|rubrique|groupe|section)/
};

/* Les voies écrites à la main dans un classeur : on les ramène aux
   clés connues plutôt que d'inventer une voie « SC. » ou « sous cut ». */
function medVoiesDepuis(txt){
  const f = medPli(txt);
  const out = [];
  const test = (k, rx) => { if (rx.test(f) && !out.includes(k)) out.push(k); };
  test("orale",   /oral|per os|\bpo\b|bouche|comprime/);
  test("SC",      /sous.?cut|\bsc\b|s\/c/);
  test("IM",      /intra.?muscul|\bim\b/);
  test("IV",      /intra.?veine|\biv\b|perfusion/);
  test("inhalee", /inhal|aerosol|nebulis|pulmonaire/);
  test("patch",   /patch|transderm|emplatre|dispositif transderm/);
  test("collyre", /collyre|ophtalm|oculaire|\boeil\b|yeux/);
  test("rectale", /rectal|suppo|lavement/);
  test("nasale",  /nasal|\bnez\b/);
  test("subl",    /sublingual|sous.?langue|perlingual/);
  test("locale",  /local|cutane|topique|creme|pommade|\bgel\b/);
  return out;
}

const MED_XLS_LIGNES = 400;

function _medEnteteLisezMoi(){
  return [
    ["JM@Santé — base des médicaments", 15, true],
    ["", 11, false],
    ["Une ligne par MOLÉCULE (DCI), pas par boîte.", 11, true],
    ["", 11, false],
    ["LES COLONNES, dans l'onglet « Medicaments »", 12, true],
    ["   DCI                    la molécule. Seule colonne obligatoire.", 10, false],
    ["   Noms commerciaux       séparés par · ou , ou / — l'application les découpe.", 10, false],
    ["   Famille thérapeutique  « Antalgique de palier 1 », « AINS », « statine »…", 10, false],
    ["   Voie                   orale, SC, IM, IV, inhalée, patch, collyre, locale,", 10, false],
    ["                          rectale, nasale, sublinguale. Plusieurs possibles.", 10, false],
    ["   Indication             à quoi ça sert, en une ligne.", 10, false],
    ["   Surveillance           ce que le soignant regarde et transmet.", 10, false],
    ["   Bon à savoir           modalité de prise, piège de nom, forme à ne pas écraser.", 10, false],
    ["   Chapitre               facultatif. Vide, l'entrée va dans « Mes ajouts ».", 10, false],
    ["", 11, false],
    ["CE QUI N'ENTRE PAS DANS CETTE BASE", 12, true],
    ["   Les INTERACTIONS médicamenteuses. Une liste partielle est pire qu'une", 10, false],
    ["   liste absente : elle laisse croire qu'on a vérifié. L'application renvoie", 10, false],
    ["   vers la base publique des médicaments.", 10, false],
    ["   Les POSOLOGIES et les adaptations de dose : c'est la prescription, elle", 10, false],
    ["   est sur l'ordonnance du patient.", 10, false],
    ["   Les CONTRE-INDICATIONS : raisonnement de prescripteur.", 10, false],
    ["   Les codes de remboursement et tout montant.", 10, false],
    ["", 11, false],
    ["La frontière, en une phrase : ce que tu fais au moment de l'administration,", 10, true],
    ["oui ; ce que le médecin décide, non.", 10, true],
    ["", 11, false],
    ["« À jeun, 30 min avant le petit-déjeuner » est une modalité de prise : elle", 10, false],
    ["entre. « À distance du calcium » est une interaction : elle reste dehors.", 10, false],
    ["", 11, false],
    ["LES NOMS COMMERCIAUX VIEILLISSENT", 12, true],
    ["Ils sont retirés, renommés, arrêtés. En cas de doute, la base publique des", 10, false],
    ["médicaments fait foi, pas ce classeur.", 10, false],
    ["", 11, false],
    ["EXEMPLES", 12, true],
    ["   Paracétamol | Doliprane · Dafalgan | Antalgique de palier 1 | orale |", 10, false],
    ["      Douleurs légères à modérées, fièvre | Risque de cumul : il est dans", 10, false],
    ["      beaucoup de spécialités | Effervescent = sodium", 10, false],
    ["   Énoxaparine | Lovenox | HBPM | SC | Prévention et traitement", 10, false],
    ["      thromboembolique | Plaquettes selon la prescription, points", 10, false],
    ["      d'injection | Pli cutané, ne pas purger la bulle, ne pas masser", 10, false]
  ];
}

function _medFeuilleColonnes(ws){
  const COLS = [["DCI", 26], ["Noms commerciaux", 34], ["Famille thérapeutique", 30],
                ["Voie", 18], ["Indication", 44], ["Surveillance", 50],
                ["Bon à savoir", 50], ["Chapitre", 28]];
  ws.columns = COLS.map(([h, w]) => ({ header: h, width: w }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).height = 22;
  ws.views = [{ state:"frozen", ySplit:1 }];
  ["E","F","G"].forEach(c => { ws.getColumn(c).alignment = { wrapText:true, vertical:"top" }; });
}

function _medValidations(ws, n){
  const voies = Object.keys(MED_VOIES).map(k => MED_VOIES[k].n).join(",");
  const chaps = MED_BASE.map(g => g.g).concat([MED_CHAP_PERSO]).join(",");
  for (let r = 2; r <= n; r++){
    ws.getCell("D" + r).dataValidation = {
      type:"list", allowBlank:true, formulae:['"' + voies + '"'], showErrorMessage:false };
    ws.getCell("H" + r).dataValidation = {
      type:"list", allowBlank:true, formulae:['"' + chaps + '"'], showErrorMessage:false };
  }
}

async function medModeleXlsx(){
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  const ws0 = wb.addWorksheet("Lisez-moi");
  ws0.getColumn("A").width = 92;
  _medEnteteLisezMoi().forEach(([t, sz, b], i) => {
    const c = ws0.getCell("A" + (i + 1)); c.value = t; c.font = { size: sz, bold: !!b };
  });
  const ws = wb.addWorksheet("Medicaments");
  _medFeuilleColonnes(ws);
  /* ⚠️ AUCUN exemple dans cet onglet : une ligne de démonstration
     oubliée serait importée avec les vraies. Les exemples sont dans
     « Lisez-moi ». Même règle que le modèle de plan de traitement. */
  _medValidations(ws, MED_XLS_LIGNES);
  const buf = await wb.xlsx.writeBuffer();
  await cabLivrer("JMSante_Modele_medicaments.xlsx", buf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* L'export : la base entière telle qu'elle est aujourd'hui, corrections
   et ajouts compris. C'est aussi la sauvegarde de son travail. */
async function medExportXlsx(){
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  const ws0 = wb.addWorksheet("Lisez-moi");
  ws0.getColumn("A").width = 92;
  _medEnteteLisezMoi().concat([
    ["", 11, false],
    ["CE CLASSEUR-CI", 12, true],
    ["Export de la base telle qu'elle est dans l'application, le "
      + new Date().toLocaleDateString("fr-FR") + ".", 10, false],
    [medTotal() + " molécules, dont " + medAjuste() + " corrigées ou ajoutées par le soignant.", 10, false],
    ["Noms commerciaux de la liste d'origine vérifiés le " + MED_VERIF + ".", 10, false]
  ]).forEach(([t, sz, b], i) => {
    const c = ws0.getCell("A" + (i + 1)); c.value = t; c.font = { size: sz, bold: !!b };
  });

  const ws = wb.addWorksheet("Medicaments");
  _medFeuilleColonnes(ws);
  const L = medListe();
  L.forEach(m => ws.addRow([ m.d, m.c || "", m.f || "",
    (m.v || []).map(k => MED_VOIES[k] ? MED_VOIES[k].n : k).join(" · "),
    m.i || "", m.s || "", m.r || "", m.g || "" ]));
  _medValidations(ws, L.length + 1);

  const buf = await wb.xlsx.writeBuffer();
  await cabLivrer("JMSante_medicaments_" + new Date().toISOString().slice(0,10) + ".xlsx", buf,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

/* ── LA LECTURE ──
   ⚠️ Rien n'entre dans un dossier de patient ici : c'est un référentiel.
   On ne fait donc pas relire 226 lignes une par une — ce serait
   impraticable et personne ne le ferait. On annonce le bilan chiffré
   AVANT d'écrire, et on demande confirmation. */
async function medImportXlsx(fichier){
  let XL;
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }
  const wb = new XL.Workbook();
  try { await wb.xlsx.load(await fichier.arrayBuffer()); }
  catch(e){ toast("Fichier illisible", "danger"); logIncident("medicaments", "Import xlsx", e); return; }

  const ws = wb.getWorksheet("Medicaments") || wb.getWorksheet("Médicaments") || wb.worksheets[0];
  if (!ws){ toast("Classeur vide", "danger"); return; }

  const txt = v => v == null ? ""
    : (typeof v === "object"
        ? String(v.text ?? v.result ?? v.richText?.map(r => r.text).join("") ?? "")
        : String(v)).trim();

  const entetes = (ws.getRow(1).values || []).map(txt);
  const col = {};
  entetes.forEach((h, i) => {
    const n = medPli(h).replace(/[^a-z0-9]+/g, " ").trim();
    if (!n) return;
    for (const [cle, rx] of Object.entries(MED_XLS_COLS))
      if (rx.test(n) && col[cle] == null) col[cle] = i;
  });

  if (col.d == null){
    await askDialog({ ton:"danger", ic:"📄", titre:"Colonne « DCI » introuvable",
      sub: entetes.filter(Boolean).length
        ? "La première ligne contient : " + entetes.filter(Boolean).slice(0,6).map(esc).join(" · ")
        : "La première ligne du classeur est vide.",
      warn:"La ligne 1 doit porter les en-têtes, dont « DCI ». Récupère le modèle depuis l'écran Médicaments.",
      oui:"J'ai compris", seul:true });
    return;
  }

  const lus = [];
  const vus = new Set();
  let doublons = 0, vides = 0;
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const vals = row.values || [];
    const lire = cle => col[cle] == null ? "" : txt(vals[col[cle]]);
    const d = lire("d");
    if (!d){ vides++; return; }
    const cle = medPli(d);
    if (vus.has(cle)){ doublons++; return; }      // deux fois la même molécule dans le classeur
    vus.add(cle);
    lus.push({ d, c:lire("c"), f:lire("f"), v:medVoiesDepuis(lire("v")),
               i:lire("i"), s:lire("s"), r:lire("r"), g:lire("g") });
  });

  if (!lus.length){
    await askDialog({ ton:"danger", ic:"📄", titre:"Aucune molécule lue",
      sub:"La colonne DCI a été trouvée, mais toutes les lignes sont vides.",
      oui:"J'ai compris", seul:true });
    return;
  }

  /* Qui corrige quoi : une DCI déjà connue devient une correction, une
     DCI inconnue devient un ajout. Le bilan est annoncé avant d'écrire. */
  const connues = new Map();
  MED_BASE.forEach(g => g.items.forEach(m => connues.set(medPli(m.d), m.d)));
  const corr = lus.filter(m => connues.has(medPli(m.d)));
  const neufs = lus.filter(m => !connues.has(medPli(m.d)));

  const mode = await askChoice({ ic:"📥", titre:"Importer " + lus.length + " molécule" + (lus.length>1?"s":""),
    sub:`<b>${corr.length}</b> correspond${corr.length>1?"ent":""} à une entrée d'origine · <b>${neufs.length}</b> nouvelle${neufs.length>1?"s":""}`
       + (doublons ? `<br><span class="small">${doublons} ligne(s) en double dans le classeur, ignorée(s).</span>` : "")
       + (vides ? `<br><span class="small">${vides} ligne(s) sans DCI, ignorée(s).</span>` : ""),
    options:[
      { ic:"➕", lbl:"Compléter ma base", val:"merge",
        sub:"Mes corrections et ajouts actuels sont gardés, le classeur s'ajoute par-dessus." },
      { ic:"♻️", lbl:"Remplacer mes ajustements", val:"replace",
        sub:"Mes corrections et ajouts actuels sont effacés, puis le classeur est repris." }
    ],
    non:"Annuler" });
  if (!mode) return;

  const M = medData();
  if (mode === "replace"){ M.modifs = {}; M.ajouts = []; }

  let nC = 0, nA = 0;
  lus.forEach(m => {
    const champs = { c:m.c, f:m.f, v:m.v, i:m.i, s:m.s, r:m.r };
    const dOrig = connues.get(medPli(m.d));
    if (dOrig){
      /* ⚠️ Une cellule laissée vide dans le classeur ne doit pas effacer
         ce que l'entrée d'origine disait : on ne retient que ce qui est
         renseigné. Sans ça, un classeur rempli à moitié viderait la
         moitié de la base sans que personne ne s'en aperçoive. */
      const base = medOriginal(dOrig);
      const fus = {};
      ["c","f","i","s","r"].forEach(k => fus[k] = champs[k] || base[k] || "");
      fus.v = champs.v.length ? champs.v : (base.v || []);
      const pareil = ["c","f","i","s","r"].every(k => (fus[k]||"") === (base[k]||""))
        && JSON.stringify(fus.v.slice().sort()) === JSON.stringify((base.v||[]).slice().sort());
      if (pareil) delete M.modifs[dOrig]; else { M.modifs[dOrig] = fus; nC++; }
    } else {
      const chap = m.g && medChapitres().includes(m.g) ? m.g : MED_CHAP_PERSO;
      const dejaLa = M.ajouts.find(x => medPli(x.d) === medPli(m.d));
      if (dejaLa) Object.assign(dejaLa, champs, { g:chap });
      else M.ajouts.push({ id: uid(), d:m.d, ...champs, g:chap });
      nA++;
    }
  });
  save(true);

  toast(nC + " corrigée" + (nC>1?"s":"") + " · " + nA + " ajoutée" + (nA>1?"s":""), { ms:5000 });
  _medQ = ""; _medOuvert = null; _medChap = null; _medVoie = null;
  sheetMedicaments();
}
