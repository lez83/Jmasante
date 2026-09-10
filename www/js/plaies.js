/* ============================================================
   SUIVI DE PLAIE
   ─────────────────────────────────────────────────────────
   Les photos de plaie existaient déjà comme documents, mais
   rien ne les reliait : impossible de voir l'évolution d'un
   escarre sur trois semaines, ni de clore une plaie guérie.

   ⚠️ L'app ENREGISTRE le stade, elle ne l'INTERPRÈTE jamais.
   Pas d'alerte « plaie qui se dégrade », pas de conclusion
   clinique : ce serait franchir la frontière du dispositif
   médical. Les photos côte à côte suffisent — l'IDEL juge.
   Question ouverte dans CONFORMITE_A_PREPARER.md.
============================================================ */

const PLAIE_TYPES = [
  { cle:"escarre",  lbl:"Escarre",            court:"Escarre" },
  { cle:"ulcere",   lbl:"Ulcère",             court:"Ulcère" },
  { cle:"chir",     lbl:"Plaie chirurgicale", court:"Plaie chir." },
  { cle:"brulure",  lbl:"Brûlure",            court:"Brûlure" },
  { cle:"trauma",   lbl:"Plaie traumatique",  court:"Plaie" },
  { cle:"autre",    lbl:"Autre",              court:"Plaie" },
];

/* Les cinq localisations les plus fréquentes, en accès direct */
const PLAIE_COURANTES = ["Sacrum","Talon gauche","Talon droit","Jambe gauche","Jambe droite"];

/* Toutes les localisations, groupées par région.
   `vue` indique sur quelle silhouette la zone est cliquable. */
const PLAIE_REGIONS = [
  { cle:"tronc", lbl:"Tête et tronc", zones:[
    { n:"Occiput",              vue:"dos" },
    { n:"Oreille gauche",       vue:"dos" },
    { n:"Oreille droite",       vue:"dos" },
    { n:"Omoplate gauche",      vue:"dos" },
    { n:"Omoplate droite",      vue:"dos" },
    { n:"Rachis dorsal",        vue:"dos" },
    { n:"Rachis lombaire",      vue:"dos" },
    { n:"Thorax",               vue:"face" },
    { n:"Abdomen",              vue:"face" },
    { n:"Flanc gauche",         vue:"face" },
    { n:"Flanc droit",          vue:"face" },
  ]},
  { cle:"bassin", lbl:"Bassin", zones:[
    { n:"Sacrum",               vue:"dos" },
    { n:"Coccyx",               vue:"dos" },
    { n:"Ischion gauche",       vue:"dos" },
    { n:"Ischion droit",        vue:"dos" },
    { n:"Trochanter gauche",    vue:"dos" },
    { n:"Trochanter droit",     vue:"dos" },
    { n:"Crête iliaque gauche", vue:"face" },
    { n:"Crête iliaque droite", vue:"face" },
    { n:"Pli inter-fessier",    vue:"dos" },
  ]},
  { cle:"minf", lbl:"Membres inférieurs", zones:[
    { n:"Cuisse gauche",        vue:"face" },
    { n:"Cuisse droite",        vue:"face" },
    { n:"Genou gauche",         vue:"face" },
    { n:"Genou droit",          vue:"face" },
    { n:"Jambe gauche",         vue:"face" },
    { n:"Jambe droite",         vue:"face" },
    { n:"Mollet gauche",        vue:"dos" },
    { n:"Mollet droit",         vue:"dos" },
    { n:"Malléole interne gauche", vue:"face" },
    { n:"Malléole externe gauche", vue:"face" },
    { n:"Malléole interne droite", vue:"face" },
    { n:"Malléole externe droite", vue:"face" },
    { n:"Talon gauche",         vue:"dos" },
    { n:"Talon droit",          vue:"dos" },
    { n:"Pied gauche",          vue:"face" },
    { n:"Pied droit",           vue:"face" },
    { n:"Plante gauche",        vue:"dos" },
    { n:"Plante droite",        vue:"dos" },
    { n:"Orteils gauche",       vue:"face" },
    { n:"Orteils droit",        vue:"face" },
  ]},
  { cle:"msup", lbl:"Membres supérieurs", zones:[
    { n:"Épaule gauche",        vue:"dos" },
    { n:"Épaule droite",        vue:"dos" },
    { n:"Bras gauche",          vue:"face" },
    { n:"Bras droit",           vue:"face" },
    { n:"Coude gauche",         vue:"dos" },
    { n:"Coude droit",          vue:"dos" },
    { n:"Avant-bras gauche",    vue:"face" },
    { n:"Avant-bras droit",     vue:"face" },
    { n:"Poignet gauche",       vue:"face" },
    { n:"Poignet droit",        vue:"face" },
    { n:"Main gauche",          vue:"dos" },
    { n:"Main droite",          vue:"dos" },
    { n:"Doigts gauche",        vue:"face" },
    { n:"Doigts droit",         vue:"face" },
  ]},
];

function plaieToutesZones(){
  return PLAIE_REGIONS.flatMap(r => r.zones.map(z => z.n));
}
function plaieRegionDe(nom){
  for (const r of PLAIE_REGIONS) if (r.zones.some(z => z.n === nom)) return r;
  return null;
}

/* Nom composé : « Escarre sacrée » se lit mieux que « Escarre — Sacrum ».
   On reste simple : type + localisation en minuscules. */
function plaieNom(p){
  const t = PLAIE_TYPES.find(x => x.cle === p.type);
  const base = t ? t.court : "Plaie";
  const l = String(p.loc||"").trim();
  // « Escarre sacrée » se lit mieux que « Escarre sacrum » : quelques
  // localisations courantes ont une forme adjectivale usuelle.
  const ADJ = { "Sacrum":"sacrée", "Coccyx":"coccygienne", "Occiput":"occipitale" };
  if (ADJ[l] && base === "Escarre") return base + " " + ADJ[l];
  return base + " " + (l.charAt(0).toLowerCase() + l.slice(1));
}

/* Depuis combien de jours la plaie est-elle ouverte ? */
function plaieJours(pl, refISO){
  if (!pl || !pl.depuis) return null;
  const d1 = new Date(pl.depuis + "T12:00:00");
  const d2 = new Date((pl.cicatriseeLe || refISO || workDate()) + "T12:00:00");
  return Math.max(0, Math.round((d2 - d1) / 864e5));
}

/* Les photos rattachées, de la plus ancienne à la plus récente */
function plaiePhotos(p, pl){
  return (p.docs||[])
    .filter(d => (pl.docIds||[]).includes(d.id))
    .sort((a,b) => String(a.date).localeCompare(String(b.date)));
}

/* Les plaies ouvertes, pour la relève et le ménage documentaire */
function plaiesOuvertes(p){
  return (p.plaies||[]).filter(pl => !pl.cicatriseeLe);
}

/* Une photo appartient-elle à une plaie encore ouverte ?
   ⚠️ Sert de garde-fou au ménage : ces photos ne sont jamais
   proposées d'office à la suppression. */
function docPlaieOuverte(p, docId){
  return plaiesOuvertes(p).some(pl => (pl.docIds||[]).includes(docId));
}

/* Ligne de relève — un constat daté, sans jugement clinique */
function plaieTexteReleve(p){
  return plaiesOuvertes(p).map(pl => {
    const j = plaieJours(pl);
    const der = plaiePhotos(p, pl).slice(-1)[0];
    return plaieNom(pl)
      + (j !== null ? " — " + j + " j" : "")
      + (pl.stade ? ", stade " + pl.stade : "")
      + (der ? " · dernière photo le " + fmtFR(der.date) : "");
  });
}

/* ============================================================
   SILHOUETTES
   ─────────────────────────────────────────────────────────
   Schématiques, pas anatomiques : le repère utile est la
   RÉGION, pas la morphologie. Trois formes néanmoins
   distinctes — cheveux longs et hanches pour la femme,
   épaules larges et torse en V pour l'homme.
============================================================ */

/* ============================================================
   LE CORPS EN RÉGIONS CLIQUABLES
   ─────────────────────────────────────────────────────────
   ⚠️ Chaque région du corps EST la zone cliquable : plus de
   pastilles superposées qui masquaient le dessin. Toucher une
   partie la colore directement.

   Les tracés sont paramétrés par les largeurs d'épaules, de
   taille et de hanches, qui portent la différence de genre.
============================================================ */

/* Un corps = une liste de { zone, tracé }. Le tracé dépend du
   gabarit, calculé une fois selon le genre. */
function plaieGabarit(genre){
  const F = genre === "F", H = genre === "M";
  return {
    ep: F ? 16 : (H ? 20 : 18),    // demi-largeur d'épaules
    ta: F ? 12 : (H ? 16 : 14),    // taille
    ha: F ? 17 : (H ? 15 : 16),    // hanches
    tete: F ? 7.6 : (H ? 8.4 : 8),
    F, H
  };
}

function plaieRegionsSVG(genre, vue){
  const g = plaieGabarit(genre);
  const { ep, ta, ha } = g;
  const C = 50;   // axe du corps
  const dos = vue === "dos";

  const R = [];
  const add = (zone, d) => R.push({ zone, d });

  // ── Tête ──
  add(dos ? "Occiput" : "Thorax",
      dos ? `M${C-g.tete} 13 a${g.tete} 9.5 0 0 1 ${g.tete*2} 0 a${g.tete} 9.5 0 0 1 ${-g.tete*2} 0 z` : null);
  if (dos) R.pop(), add("Occiput", `M${C-g.tete} 11 a${g.tete} 9.5 0 0 1 ${g.tete*2} 0 l0 4 a${g.tete} 9.5 0 0 1 ${-g.tete*2} 0 z`);
  else add("Thorax", null), R.pop();

  // Le crâne, toujours présent (cliquable seulement de dos)
  if (dos) {} else add("__tete", `M${C-g.tete} 13 a${g.tete} 9.5 0 1 1 ${g.tete*2} 0 a${g.tete} 9.5 0 1 1 ${-g.tete*2} 0 z`);

  // ── Cou ──
  add("__cou", `M${C-4} 21 h8 v6 h-8 z`);

  // ── Haut du tronc ──
  if (dos){
    add("Omoplate gauche", `M${C-ep} 27 q${ep/2} -3 ${ep-1} -2 l-1 17 q-${ep/2} 1 -${ep-2} -1 z`);
    add("Omoplate droite", `M${C+ep} 27 q-${ep/2} -3 -${ep-1} -2 l1 17 q${ep/2} 1 ${ep-2} -1 z`);
    add("Rachis dorsal",   `M${C-2} 25 h4 l0 19 h-4 z`);
    add("Rachis lombaire", `M${C-2} 44 h4 l0 12 h-4 z`);
  } else {
    add("Thorax",  `M${C-ep} 27 q${ep} -4 ${ep*2} 0 l-1 16 q-${ep} 3 -${(ep-1)*2} 0 z`);
    add("Abdomen", `M${C-ta-1} 43 q${ta+1} 3 ${(ta+1)*2} 0 l-1 14 q-${ta} 3 -${ta*2} 0 z`);
  }

  // ── Flancs / côtés du tronc ──
  if (!dos){
    add("Flanc gauche", `M${C-ep} 30 l-2 14 q2 2 4 1 l1 -14 z`);
    add("Flanc droit",  `M${C+ep} 30 l2 14 q-2 2 -4 1 l-1 -14 z`);
  }

  // ── Bassin ──
  if (dos){
    add("Sacrum", `M${C-9} 56 q9 3 18 0 l-1 12 q-8 2 -16 0 z`);
    add("Coccyx", `M${C-5} 68 q5 2 10 0 l-1 5 q-4 1 -8 0 z`);
    add("Trochanter gauche", `M${C-ha} 55 q-4 3 -3 9 q1 5 5 5 l2 -13 z`);
    add("Trochanter droit",  `M${C+ha} 55 q4 3 3 9 q-1 5 -5 5 l-2 -13 z`);
    add("Ischion gauche", `M${C-9} 68 q4 2 8 0 l-1 6 q-4 1 -7 0 z`);
    add("Ischion droit",  `M${C+1} 68 q4 2 8 0 l-1 6 q-4 1 -7 0 z`);
  } else {
    add("Crête iliaque gauche", `M${C-ha} 56 q-3 3 -2 8 q3 2 6 0 l1 -8 z`);
    add("Crête iliaque droite", `M${C+ha} 56 q3 3 2 8 q-3 2 -6 0 l-1 -8 z`);
  }

  // ── Bras ──
  const brasG = `M${C-ep} 28 q-7 3 -9 10 l-3 19 q3 2 6 1 l3 -18 q2 -6 5 -8 z`;
  const brasD = `M${C+ep} 28 q7 3 9 10 l3 19 q-3 2 -6 1 l-3 -18 q-2 -6 -5 -8 z`;
  if (dos){
    add("Épaule gauche", `M${C-ep-1} 26 q-6 2 -8 8 q4 2 8 0 z`);
    add("Épaule droite", `M${C+ep+1} 26 q6 2 8 8 q-4 2 -8 0 z`);
    add("Coude gauche", `M${C-ep-9} 45 q4 1 6 -1 l-1 7 q-4 1 -6 -1 z`);
    add("Coude droit",  `M${C+ep+3} 45 q4 2 6 1 l1 7 q-2 2 -6 1 z`);
  } else {
    add("Bras gauche", brasG);
    add("Bras droit",  brasD);
    add("Avant-bras gauche", `M${C-ep-11} 47 q5 2 8 0 l-2 13 q-4 1 -7 -1 z`);
    add("Avant-bras droit",  `M${C+ep+3} 47 q3 2 8 0 l1 12 q-3 2 -7 1 z`);
  }
  add("Main gauche", `M${C-ep-11} 60 q4 -2 8 0 l0 7 q-4 2 -8 0 z`);
  add("Main droite", `M${C+ep+3} 60 q4 -2 8 0 l0 7 q-4 2 -8 0 z`);

  // ── Jambes ──
  add("Cuisse gauche", `M${C-ha+1} 72 q6 -2 11 0 l-1 15 q-5 2 -9 0 z`);
  add("Cuisse droite", `M${C+2} 72 q6 -2 11 0 l-1 15 q-5 2 -9 0 z`);
  add("Genou gauche",  `M${C-ha+2} 87 q5 -2 9 0 l0 7 q-5 2 -9 0 z`);
  add("Genou droit",   `M${C+3} 87 q5 -2 9 0 l0 7 q-5 2 -9 0 z`);
  if (dos){
    add("Mollet gauche", `M${C-ha+2} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
    add("Mollet droit",  `M${C+3} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
  } else {
    add("Jambe gauche", `M${C-ha+2} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
    add("Jambe droite", `M${C+3} 94 q5 -2 9 0 l-1 14 q-4 2 -8 0 z`);
    add("Malléole interne gauche", `M${C-ha+5} 108 q3 -1 4 0 l0 4 q-3 1 -4 0 z`);
    add("Malléole externe gauche", `M${C-ha+2} 108 q2 -1 3 0 l0 4 q-2 1 -3 0 z`);
    add("Malléole interne droite", `M${C+3} 108 q2 -1 3 0 l0 4 q-2 1 -3 0 z`);
    add("Malléole externe droite", `M${C+8} 108 q3 -1 4 0 l0 4 q-3 1 -4 0 z`);
  }

  // ── Pieds ──
  if (dos){
    add("Talon gauche", `M${C-ha+2} 108 q5 -2 9 0 l0 6 q-5 2 -9 0 z`);
    add("Talon droit",  `M${C+3} 108 q5 -2 9 0 l0 6 q-5 2 -9 0 z`);
    add("Plante gauche", `M${C-ha+1} 114 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
    add("Plante droite", `M${C+2} 114 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
  } else {
    add("Pied gauche", `M${C-ha+1} 112 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
    add("Pied droit",  `M${C+2} 112 q6 -2 11 0 l0 6 q-6 2 -11 0 z`);
    add("Orteils gauche", `M${C-ha+1} 118 q6 -2 11 0 l0 3 q-6 2 -11 0 z`);
    add("Orteils droit",  `M${C+2} 118 q6 -2 11 0 l0 3 q-6 2 -11 0 z`);
  }
  return R.filter(x => x.d);
}

/* Les cheveux, seule touche décorative — ils portent le genre */
function plaieCheveux(genre){
  const F = genre === "F", H = genre === "M";
  if (F) return `<path d="M${50-9} 10 q0 -9 9 -9 t9 9 q1 19 -2 29 l-3 -2 q2 -11 1 -22 q-5 4 -10 0 q-1 11 1 22 l-3 2 q-3 -10 -2 -29 z" fill="currentColor" opacity=".3"/>`;
  if (H) return `<path d="M${50-8} 8 q1 -6 8 -6 t8 6 q0 2 -1 3 q-7 -3 -14 0 q-1 -1 -1 -3 z" fill="currentColor" opacity=".3"/>`;
  return "";
}

/* La silhouette : chaque région est cliquable et se colore.
   ⚠️ Le nom de la zone choisie s'affiche HORS du SVG — un texte
   dans le tracé grandit avec lui au zoom et devient illisible. */
function plaieCorpsFond(genre){
  const g = plaieGabarit(genre);
  const { ep, ta, ha, tete } = g;
  const C = 50;
  // Un seul tracé continu : tête, tronc, bras, jambes, pieds
  return `
    <ellipse cx="${C}" cy="13" rx="${tete}" ry="9.5"/>
    <path d="M${C-4} 20 h8 v7 h-8 z"/>
    <path d="M${C-ep} 27
             C${C-ep} 27 ${C} 23 ${C+ep} 27
             L${C+ta} 46
             C${C+ta} 46 ${C+ha} 52 ${C+ha} 58
             L${C+ha-2} 70
             C${C+ha-2} 70 ${C} 74 ${C-ha+2} 70
             L${C-ha} 58
             C${C-ha} 52 ${C-ta} 46 ${C-ta} 46
             Z"/>
    <path d="M${C-ep} 28 q-8 3 -10 10 l-4 21 q3 3 7 1 l4 -20 q2 -6 6 -8 z"/>
    <path d="M${C+ep} 28 q8 3 10 10 l4 21 q-3 3 -7 1 l-4 -20 q-2 -6 -6 -8 z"/>
    <ellipse cx="${C-ep-7}" cy="63" rx="4" ry="5"/>
    <ellipse cx="${C+ep+7}" cy="63" rx="4" ry="5"/>
    <path d="M${C-ha+1} 68 q6 -2 11 0 l-2 24 q0 4 -1 8 l-1 18 q-4 2 -8 0 l-1 -18 q-1 -4 -1 -8 z"/>
    <path d="M${C+2} 68 q6 -2 11 0 l-1 24 q0 4 -1 8 l-1 18 q-4 2 -8 0 l-1 -18 q-1 -4 -1 -8 z"/>
    <path d="M${C-ha} 116 q6 -2 12 0 l0 5 q-6 2 -12 0 z"/>
    <path d="M${C+1} 116 q6 -2 12 0 l0 5 q-6 2 -12 0 z"/>`;
}

function plaieSilhouette(genre, vue, choisie, grand){
  const regions = plaieRegionsSVG(genre, vue);
  const zs = regions.map(r => {
    const cli = !r.zone.startsWith("__");
    const on  = r.zone === choisie;
    const cls = "preg" + (on ? " on" : "") + (cli ? "" : " fixe");
    return `<path class="${cls}" d="${r.d}"${cli?` data-zone="${esc(r.zone)}"`:""}/>`;
  }).join("");
  return `<svg viewBox="0 0 100 124" class="plaie-svg${grand?" grand":""}" data-vue="${vue}">
    <g class="deco">${plaieCheveux(genre)}</g>
    <g class="fond">${plaieCorpsFond(genre)}</g>
    <g class="zones">${zs}</g></svg>`;
}

/* ============================================================
   ÉCRAN DE SUIVI
============================================================ */
function sheetPlaies(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable"); return; }
  p.plaies = p.plaies || [];
  const ouvertes = plaiesOuvertes(p);
  const fermees  = (p.plaies||[]).filter(pl => pl.cicatriseeLe);

  const carte = (pl, close) => {
    const j = plaieJours(pl);
    const ph = plaiePhotos(p, pl);
    const vign = ph.slice(-4).map((d,i) => `
      <div class="plv${i===ph.slice(-4).length-1?" der":""}" data-photo="${d.id}">
        <span>${fmtFR(d.date)}</span></div>`).join("");
    return `
    <div class="plcard ${close?"ok":"on"}" data-pl="${pl.id}">
      <div class="plhead">
        <div style="flex:1;min-width:0">
          <div class="pltit">${esc(plaieNom(pl))}</div>
          <div class="plsub">${close
            ? "cicatrisée le " + fmtFR(pl.cicatriseeLe) + (j!==null?" · "+j+" jours":"")
            : (j!==null ? "ouverte depuis "+j+" j" : "") + (pl.stade?" · stade "+pl.stade:"")
              + " · " + ph.length + " photo" + (ph.length>1?"s":"")}</div>
        </div>
        <span class="plbadge">${close?"✓ fermée":"en cours"}</span>
      </div>
      ${ph.length ? `<div class="plphotos">${vign}${ph.length>4?`<i>+${ph.length-4}</i>`:""}</div>` : ""}
      ${pl.mesures ? `<div class="plmes">📏 ${esc(pl.mesures)}</div>` : ""}
      <div class="rowb" style="gap:5px;margin-top:8px">
        <button class="btn btn-ghost sm" data-plphoto="${pl.id}" style="flex:1">📷 Ajouter une photo</button>
        ${close ? `<button class="btn btn-ghost sm" data-plrouvrir="${pl.id}" style="flex:1">↩ Rouvrir</button>`
                : `<button class="btn btn-ghost sm" data-plfermer="${pl.id}" style="flex:1">✓ Cicatrisée</button>`}
      </div>
    </div>`;
  };

  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>🩹 Suivi de plaie</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}</p>

    ${ouvertes.length ? `
      <div class="rowlab am"><span>En cours</span><i></i><em>${ouvertes.length}</em></div>
      <div class="rowbox am" style="display:block">${ouvertes.map(pl => carte(pl,false)).join("")}</div>` : ""}

    ${fermees.length ? `
      <div class="rowlab vi" style="margin-top:12px"><span>Cicatrisées</span><i></i><em>${fermees.length}</em></div>
      <div class="rowbox vi" style="display:block">${fermees.map(pl => carte(pl,true)).join("")}</div>` : ""}

    ${!p.plaies.length ? `<p class="small muted" style="text-align:center;padding:20px 0">Aucune plaie suivie pour ce patient.</p>` : ""}

    <button class="btn btn-primary" id="pl-new" style="width:100%;margin-top:14px">＋ Nouvelle plaie</button>
    <p class="small muted" style="margin-top:9px">Les photos sont datées et rattachées à la plaie. L'app les range, <b>elle n'interprète pas</b> — l'évaluation reste la tienne.</p>`);

  { const b = $("#pl-new"); if (b) b.onclick = () => plaieNouvelle(pid); }
  $$("#sheet [data-plfermer]").forEach(b => b.onclick = async () => {
    const pl = p.plaies.find(x => x.id === b.dataset.plfermer);
    if (!pl) return;
    if (!await askDialog({ ic:"✓", titre:"Plaie cicatrisée ?",
      sub:plaieNom(pl), oui:"✓ Cicatrisée", non:"Annuler" })) return;
    pl.cicatriseeLe = workDate();
    save(true); sheetPlaies(pid); toast("Plaie close ✓");
  });
  $$("#sheet [data-plrouvrir]").forEach(b => b.onclick = () => {
    const pl = p.plaies.find(x => x.id === b.dataset.plrouvrir);
    if (!pl) return;
    pl.cicatriseeLe = null; save(true); sheetPlaies(pid); toast("Plaie rouverte");
  });
  $$("#sheet [data-plphoto]").forEach(b => b.onclick = () => {
    // Le document sera rattaché à cette plaie après ajout
    _plaieEnCours = b.dataset.plphoto;
    docTargetPid = pid;
    const el = document.getElementById("camerafile"); if (el) el.click();
  });
  $$("#sheet [data-photo]").forEach(e => e.onclick = () => {
    const d = (p.docs||[]).find(x => x.id === e.dataset.photo);
    if (d) viewDoc(d);
  });
}

/* ============================================================
   CRÉER UNE PLAIE
============================================================ */
function plaieNouvelle(pid){
  const p = getP(pid);
  let type = null, loc = null, stade = "", vue = "dos", libre = "";
  let mes = { l:"", L:"", prof:"" };
  const genre = p.genre === "F" ? "F" : (p.genre === "M" ? "M" : "N");

  const dessine = () => {
    const reg  = loc ? plaieRegionDe(loc) : null;
    const pret = !!(type && (loc || libre.trim()));
    const listeZones = (reg || PLAIE_REGIONS[1]).zones;

    $("#sheet").innerHTML = `
      ${navHeader("Annuler", true)}
      <h3>🩹 Nouvelle plaie</h3>
      <p class="small muted" style="margin-bottom:12px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}</p>

      <div class="rowlab vi"><span>1 · Type</span><i></i><em>${type?"✓":"à choisir"}</em></div>
      <div class="rowbox vi" style="display:block">
        <div class="rowb" style="flex-wrap:wrap;gap:4px">
          ${PLAIE_TYPES.map(t => `<button class="chip sm ${type===t.cle?"on":""}" data-pt="${t.cle}">${esc(t.lbl)}</button>`).join("")}
        </div>
      </div>

      <div class="rowlab ac" style="margin-top:12px"><span>2 · Localisation</span><i></i>
        <em>${loc||libre.trim() ? "✓" : "requise"}</em></div>
      <div class="rowbox ac" style="display:block">
        <div class="rowb" style="flex-wrap:wrap;gap:4px;margin-bottom:9px">
          ${PLAIE_COURANTES.map(z => `<button class="chip sm ${loc===z?"on":""}" data-pz="${esc(z)}">${esc(z)}</button>`).join("")}
        </div>
        <div class="plvues">
          <button class="chip ${vue==="dos"?"on":""}" data-pvue="dos" style="flex:1">◐ DOS</button>
          <button class="chip ${vue==="face"?"on":""}" data-pvue="face" style="flex:1">◑ FACE</button>
        </div>
        <div class="plbody">
          <div class="plsil">
            ${plaieSilhouette(genre, vue, loc, false)}
            <button class="plzoom" id="pl-zoom" title="Agrandir">⛶</button>
            <div class="plgenre">${loc ? esc(loc) : (genre==="F"?"femme":(genre==="M"?"homme":"neutre")) + " · " + vue}</div>
          </div>
          <div class="pllist">
            <div class="pllab">${esc((reg||PLAIE_REGIONS[1]).lbl)}</div>
            <div class="pllz">
              ${listeZones.map(z => `<button class="plz ${loc===z.n?"on":""}" data-pz="${esc(z.n)}">${esc(z.n)}</button>`).join("")}
            </div>
            <div class="rowb" style="flex-wrap:wrap;gap:3px;margin-top:7px">
              ${PLAIE_REGIONS.map(r => `<button class="chip sm ${reg&&reg.cle===r.cle?"on":""}" data-preg="${r.cle}">${esc(r.lbl)}</button>`).join("")}
            </div>
            <input id="pl-libre" class="rec-in" value="${esc(libre)}"
              placeholder="✏️ autre — préciser" style="margin-top:7px;font-size:13px">
          </div>
        </div>
      </div>

      <div class="rowlab vi" style="margin-top:12px"><span>3 · Stade</span><i></i><em>facultatif</em></div>
      <div class="rowbox vi" style="display:block">
        <div class="rowb" style="gap:4px">
          ${["1","2","3","4"].map(n => `<button class="chip ${stade===n?"on":""}" data-pst="${n}" style="flex:1">${n}</button>`).join("")}
          <button class="chip ${!stade?"on":""}" data-pst="" style="flex:1.6">non précisé</button>
        </div>
        <p class="small muted" style="margin:6px 0 0;font-size:9.5px">Enregistré tel quel. <b>L'app n'en tire aucune conclusion</b> — l'évaluation reste la tienne.</p>
      </div>

      <div class="rowlab ac" style="margin-top:12px"><span>4 · Mesures</span><i></i><em>facultatif</em></div>
      <div class="rowbox ac" style="display:block">
        <div class="rowb" style="gap:5px">
          <div style="flex:1"><div class="rec-lab">LONGUEUR</div>
            <input id="pl-L" class="rec-in" value="${esc(mes.L)}" placeholder="cm" inputmode="decimal"></div>
          <div style="flex:1"><div class="rec-lab">LARGEUR</div>
            <input id="pl-l" class="rec-in" value="${esc(mes.l)}" placeholder="cm" inputmode="decimal"></div>
          <div style="flex:1"><div class="rec-lab">PROFONDEUR</div>
            <input id="pl-p" class="rec-in" value="${esc(mes.prof)}" placeholder="cm" inputmode="decimal"></div>
        </div>
      </div>

      <div class="rowlab vi" style="margin-top:12px"><span>5 · Apparue le</span><i></i></div>
      <div class="rowbox vi" style="display:block">
        <input id="pl-date" type="date" class="rec-in" value="${workDate()}">
      </div>

      ${pret ? `<div class="dnom"><div class="dnom-l">Nom de la plaie</div>
        <div class="dnom-v">${esc(plaieNom({ type, loc: loc || libre.trim() }))}</div></div>` : ""}

      <div class="rowb" style="margin-top:14px;gap:8px">
        <button class="btn btn-ghost" id="pl-cancel" style="flex:1">Annuler</button>
        <button class="btn btn-primary" id="pl-ok" style="flex:1.4" ${pret?"":"disabled"}>✓ Créer</button>
      </div>`;

    $$("#sheet [data-pt]").forEach(b => b.onclick = () => { type = b.dataset.pt; dessine(); });
    $$("#sheet [data-pz]").forEach(b => b.onclick = () => { loc = b.dataset.pz; libre = ""; dessine(); });
    $$("#sheet [data-preg]").forEach(b => b.onclick = () => {
      const r = PLAIE_REGIONS.find(x => x.cle === b.dataset.preg);
      if (r){ loc = r.zones[0].n; dessine(); }
    });
    $$("#sheet [data-pvue]").forEach(b => b.onclick = () => { vue = b.dataset.pvue; dessine(); });
    $$("#sheet [data-pst]").forEach(b => b.onclick = () => { stade = b.dataset.pst; dessine(); });
    $$("#sheet [data-zone]").forEach(g => g.onclick = () => { loc = g.dataset.zone; libre = ""; dessine(); });
    { const e = $("#pl-libre"); if (e) e.oninput = () => {
        libre = e.value;
        const ok = $("#pl-ok"); if (ok) ok.disabled = !(type && (loc || libre.trim()));
      }; }
    ["L","l","p"].forEach(k => { const e = $("#pl-"+k); if (e) e.oninput = () => {
      mes[k === "p" ? "prof" : k] = e.value; }; });
    { const b = $("#pl-zoom"); if (b) b.onclick = () => plaieZoom(genre, vue, loc, z => { loc = z; libre = ""; dessine(); }); }
    { const b = $("#pl-cancel"); if (b) b.onclick = () => sheetPlaies(pid); }
    { const b = $("#pl-ok"); if (b) b.onclick = () => {
        const finale = loc || libre.trim();
        if (!type || !finale) return;
        const m = [mes.L && mes.L+" cm", mes.l && mes.l+" cm", mes.prof && mes.prof+" cm"]
          .filter(Boolean).join(" × ");
        p.plaies = p.plaies || [];
        p.plaies.push({ id:uid(), type, loc:finale, stade,
          mesures: m || "", depuis: ($("#pl-date")||{}).value || workDate(),
          cicatriseeLe: null, docIds: [] });
        save(true); sheetPlaies(pid); toast("Plaie créée 🩹");
      }; }
  };
  openSheet("");
  dessine();
}

/* La silhouette en grand — les zones deviennent confortables au doigt */
function plaieZoom(genre, vue, choisie, onPick){
  const ov = document.createElement("div");
  ov.className = "plzoom-ov";
  ov.innerHTML = `<div class="plzoom-box">
    <div class="plzoom-h"><b>${vue==="dos"?"◐ Vue de dos":"◑ Vue de face"}</b>
      <button class="plzoom-x">✕</button></div>
    ${plaieSilhouette(genre, vue, choisie, true)}
    <!-- ⚠️ Le nom vit HORS du SVG : un texte dans le tracé grandit
         avec lui au zoom et devient illisible. -->
    <div class="plzoom-nom" id="plz-nom">${choisie ? esc(choisie) : "Tape une zone du corps"}</div>
  </div>`;
  document.body.appendChild(ov);
  const fermer = () => ov.remove();
  ov.querySelector(".plzoom-x").onclick = fermer;
  ov.onclick = e => { if (e.target === ov) fermer(); };
  const nom = ov.querySelector("#plz-nom");
  ov.querySelectorAll("[data-zone]").forEach(g => {
    g.onclick = () => { onPick(g.dataset.zone); fermer(); };
    // Nommer au survol comme au toucher : on sait ce qu'on vise
    ["pointerenter","pointerdown"].forEach(ev =>
      g.addEventListener(ev, () => { if (nom) nom.textContent = g.dataset.zone; }));
  });
}
