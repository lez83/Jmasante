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

/* Zones cliquables, en pourcentage de la boîte : indépendantes
   de la taille d'affichage, donc valables en petit comme en grand. */
const PLAIE_ZONES_SVG = {
  dos: [
    { n:"Occiput",            x:50, y:6,  r:7 },
    { n:"Omoplate gauche",    x:40, y:27, w:13, h:11 },
    { n:"Omoplate droite",    x:60, y:27, w:13, h:11 },
    { n:"Rachis dorsal",      x:50, y:29, w:9,  h:12 },
    { n:"Rachis lombaire",    x:50, y:41, w:9,  h:8 },
    { n:"Sacrum",             x:50, y:50, w:18, h:9 },
    { n:"Coccyx",             x:50, y:57, w:11, h:5 },
    { n:"Trochanter gauche",  x:29, y:50, r:6 },
    { n:"Trochanter droit",   x:71, y:50, r:6 },
    { n:"Main gauche",        x:19, y:57, w:9,  h:7 },
    { n:"Main droite",        x:81, y:57, w:9,  h:7 },
    { n:"Mollet gauche",      x:40, y:76, w:11, h:9 },
    { n:"Mollet droit",       x:60, y:76, w:11, h:9 },
    { n:"Talon gauche",       x:40, y:90, w:11, h:6 },
    { n:"Talon droit",        x:60, y:90, w:11, h:6 },
  ],
  face: [
    { n:"Thorax",             x:50, y:27, w:20, h:11 },
    { n:"Abdomen",            x:50, y:40, w:18, h:10 },
    { n:"Flanc gauche",       x:36, y:38, w:8,  h:10 },
    { n:"Flanc droit",        x:64, y:38, w:8,  h:10 },
    { n:"Crête iliaque gauche", x:37, y:50, r:5 },
    { n:"Crête iliaque droite", x:63, y:50, r:5 },
    { n:"Cuisse gauche",      x:41, y:63, w:12, h:11 },
    { n:"Cuisse droite",      x:59, y:63, w:12, h:11 },
    { n:"Genou gauche",       x:41, y:75, w:11, h:7 },
    { n:"Genou droit",        x:59, y:75, w:11, h:7 },
    { n:"Jambe gauche",       x:41, y:84, w:11, h:8 },
    { n:"Jambe droite",       x:59, y:84, w:11, h:8 },
    { n:"Pied gauche",        x:40, y:96, w:12, h:5 },
    { n:"Pied droit",         x:60, y:96, w:12, h:5 },
    { n:"Bras gauche",        x:24, y:33, w:8,  h:12 },
    { n:"Bras droit",         x:76, y:33, w:8,  h:12 },
    { n:"Avant-bras gauche",  x:20, y:47, w:8,  h:10 },
    { n:"Avant-bras droit",   x:80, y:47, w:8,  h:10 },
  ]
};

/* Le corps dessiné — un tracé par genre et par vue */
function plaieCorpsSVG(genre, vue){
  const F = genre === "F", H = genre === "M";
  // Épaules, taille et hanches : c'est là que se joue la silhouette
  const ep = F ? 15 : (H ? 19 : 17);
  const ta = F ? 11 : (H ? 15 : 13);
  const ha = F ? 16 : (H ? 14 : 15);
  const cheveux = F
    ? `<path d="M35 11 q0 -9 15 -9 t15 9 q1 20 -3 31 l-4 -2 q3 -11 2 -23 q-10 5 -20 0 q-1 12 2 23 l-4 2 q-4 -11 -3 -31 z" opacity=".55"/>`
    : (H ? `<path d="M40 9 q2 -7 10 -7 t10 7 q0 2 -1 3 q-9 -4 -18 0 q-1 -1 -1 -3 z" opacity=".55"/>` : "");
  return `
    ${cheveux}
    <ellipse cx="50" cy="12" rx="${F?7.4:(H?8:7.7)}" ry="8.6"/>
    <path d="M47 20 q3 2 6 0 l1 5 q-4 2 -8 0 z"/>
    <!-- tronc : épaules → taille → hanches, en courbes -->
    <path d="M${50-ep} 27 q${ep} -4 ${ep*2} 0
             q1 12 ${-(ep-ta)} 20
             q2 12 ${(ta-ha)} 21
             q${-ha} 6 ${-ha*2} 0
             q${(ta-ha)*-1} -9 ${ha-ta} -21
             q${-(ep-ta)} -8 ${-(ep-ta)*0+0} -20 z"/>
    <!-- bras -->
    <path d="M${50-ep} 28 q-7 2 -9 8 l-3 21 q-1 3 2 4 q3 1 4 -2 l4 -20 q1 -4 4 -6 z"/>
    <path d="M${50+ep} 28 q7 2 9 8 l3 21 q1 3 -2 4 q-3 1 -4 -2 l-4 -20 q-1 -4 -4 -6 z"/>
    <!-- jambes : cuisse, genou, mollet -->
    <path d="M${50-ha+2} 66 q5 -2 9 0 l1 16 q1 3 0 6 l-1 14 q0 3 -3 3 q-3 0 -3 -3 l-2 -14 q-1 -3 -1 -6 z"/>
    <path d="M${50+2} 66 q5 -2 9 0 l1 16 q1 3 0 6 l-1 14 q0 3 -3 3 q-3 0 -3 -3 l-2 -14 q-1 -3 -1 -6 z"/>
    <!-- chevilles et pieds -->
    <path d="M${50-ha+4} 105 h6 l1 8 q-4 2 -8 0 z"/>
    <path d="M${50+4} 105 h6 l1 8 q-4 2 -8 0 z"/>
    <path d="M${50-ha+2} 113 q5 -2 10 0 l0 5 q-5 2 -10 0 z"/>
    <path d="M${50+2} 113 q5 -2 10 0 l0 5 q-5 2 -10 0 z"/>
    <!-- mains -->
    <ellipse cx="${50-ep-6}" cy="60" rx="3.2" ry="4.4"/>
    <ellipse cx="${50+ep+6}" cy="60" rx="3.2" ry="4.4"/>
    ${F ? `<path d="M${50-7} 36 q3.5 3.5 7 0 M50 36 q3.5 3.5 7 0"
            fill="none" stroke="currentColor" stroke-width=".8" opacity=".45"/>` : ""}`;
}

/* La silhouette complète, zones incluses */
function plaieSilhouette(genre, vue, choisie, grand){
  const zones = PLAIE_ZONES_SVG[vue] || [];
  const zs = zones.map(z => {
    const on = z.n === choisie;
    const st = on
      ? 'fill="color-mix(in srgb, var(--amber) 42%, transparent)" stroke="var(--amber)" stroke-width="1.9"'
      : 'fill="color-mix(in srgb, var(--accent) 9%, transparent)" stroke="var(--accent)" stroke-width=".7" stroke-opacity=".55"';
    const forme = z.r
      ? `<circle cx="${z.x}" cy="${z.y}" r="${z.r}" ${st}/>`
      : `<rect x="${z.x-z.w/2}" y="${z.y-z.h/2}" width="${z.w}" height="${z.h}" rx="3" ${st}/>`;
    // En grand seulement : le nom dans la zone, sinon illisible
    const txt = grand
      ? `<text x="${z.x}" y="${z.y+1.4}" text-anchor="middle" font-size="2.6"
            fill="${on?'var(--amber)':'var(--accent)'}" font-weight="${on?700:400}"
            pointer-events="none">${esc(z.n.replace(/ (gauche|droite?)$/, m => m.trim()==="gauche"?" G":" D"))}</text>`
      : "";
    return `<g class="pz" data-zone="${esc(z.n)}" style="cursor:pointer">${forme}${txt}</g>`;
  }).join("");
  return `<svg viewBox="0 0 100 122" class="plaie-svg${grand?" grand":""}" data-vue="${vue}">
    <g class="corps">${plaieCorpsSVG(genre, vue)}</g>${zs}</svg>`;
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
            <div class="plgenre">${genre==="F"?"femme":(genre==="M"?"homme":"neutre")} · ${vue}</div>
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
    $$("#sheet .pz").forEach(g => g.onclick = () => { loc = g.dataset.zone; libre = ""; dessine(); });
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
    <p class="small muted" style="text-align:center;margin:8px 0 0">Tape une zone pour la choisir</p>
  </div>`;
  document.body.appendChild(ov);
  const fermer = () => ov.remove();
  ov.querySelector(".plzoom-x").onclick = fermer;
  ov.onclick = e => { if (e.target === ov) fermer(); };
  ov.querySelectorAll(".pz").forEach(g => g.onclick = () => { onPick(g.dataset.zone); fermer(); });
}
