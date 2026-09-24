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
/* ============================================================
   CARTOGRAPHIE CORPORELLE
   ─────────────────────────────────────────────────────────
   Cinq vues (face, dos, deux profils, tête agrandie), deux genres.
   La silhouette est assemblée par PIÈCES — tronc, bras, jambes, tête —
   et les zones sont DÉCOUPÉES dedans : une localisation ne peut donc
   pas déborder du corps, et s'arrête au membre qui passe devant.

   ⚠️ CONVENTION DU SOIN : « gauche » et « droite » désignent le côté
   DU PATIENT. De face, sa droite est à gauche de l'image.

   ⚠️ Aucune couleur ici : tout passe par les variables de thème.
   ⚠️ Les localisations déjà enregistrées ne sont JAMAIS réécrites —
   LOC_ANCIENNES sert seulement à retrouver la zone à éclairer.
============================================================ */
const PLAIE_VUES = [
  { cle:"face",     lbl:"Face",     sub:"vue antérieure" },
  { cle:"dos",      lbl:"Dos",      sub:"vue postérieure" },
  { cle:"profil-d", lbl:"Profil D", sub:"côté droit du patient" },
  { cle:"profil-g", lbl:"Profil G", sub:"côté gauche du patient" },
  { cle:"tete",     lbl:"Tête",     sub:"gros plan du visage" }
];
/* Les zones de tête portées par la vue du corps renvoient au gros plan */
const ZONES_TETE = ["Front","Visage","Cou","Cuir chevelu","Occiput","Nuque"];

function lisse(pts, ferme){
  const p = pts.slice();
  if (ferme) p.unshift(pts[pts.length-1]), p.push(pts[0], pts[1]);
  else p.unshift(pts[0]), p.push(pts[pts.length-1]);
  let d = `M${p[1][0].toFixed(1)} ${p[1][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 2; i++){
    const [x0,y0]=p[i-1], [x1,y1]=p[i], [x2,y2]=p[i+1], [x3,y3]=p[i+2];
    d += ` C${(x1+(x2-x0)/6).toFixed(1)} ${(y1+(y2-y0)/6).toFixed(1)} `
      +  `${(x2-(x3-x1)/6).toFixed(1)} ${(y2-(y3-y1)/6).toFixed(1)} `
      +  `${x2.toFixed(1)} ${y2.toFixed(1)}`;
  }
  return d + (ferme ? " Z" : "");
}
const miroir = pts => pts.map(([x,y]) => [500-x, y]).reverse();
const sym = demi => lisse(demi.concat(miroir(demi)), true);

/* Canon : 7,5 têtes. Tête = 132 px pour un corps de 1000. */
const GAB = {
  F: { epaule:90,  taille:56, hanche:94, cuisse:54, genou:35, mollet:38, cheville:20,
       bras:19, avbras:15, cou:21, crane:45, machoire:32, poitrine:70 },
  M: { epaule:108, taille:70, hanche:84, cuisse:58, genou:38, mollet:42, cheville:22,
       bras:23, avbras:17, cou:27, crane:48, machoire:36, poitrine:80 }
};
const CX = 250;

/* ── Tête : crâne arrondi, pommettes, mâchoire, menton ── */
function tete(G, y0 = 34){
  const demi = [
    [CX-4, y0],
    [CX-G.crane*0.60, y0+6], [CX-G.crane*0.95, y0+30],
    [CX-G.crane, y0+62],                       // tempe
    [CX-G.crane+4, y0+86],                     // pommette
    [CX-G.machoire, y0+106],                   // angle de la mâchoire
    [CX-G.machoire*0.66, y0+124],
    [CX-G.machoire*0.34, y0+136],
    [CX-9, y0+139]                             // menton
  ];
  return sym(demi);
}
/* ── Cou ── */
function cou(G, y0 = 158){
  return sym([[CX-G.cou+3, y0], [CX-G.cou, y0+18], [CX-G.cou-6, y0+34]]);
}
/* ── Tronc : trapèzes, thorax, taille, bassin ── */
function tronc(G, y0 = 182){
  const demi = [
    [CX-G.cou-3,     y0],                      // base du cou
    [CX-G.cou-22,    y0+8],                    // trapèze, pente douce
    [CX-G.epaule+18, y0+22],
    [CX-G.epaule+2,  y0+44],                   // moignon de l'épaule
    [CX-G.poitrine-2,y0+78],                   // thorax, plus large
    [CX-G.poitrine+6,y0+120],                  // sous la poitrine
    [CX-G.taille-10, y0+156],                  // côtes basses
    [CX-G.taille,    y0+198],                  // creux de la taille
    [CX-G.taille-12, y0+226],
    [CX-G.hanche+6,  y0+256],                  // crête iliaque
    [CX-G.hanche,    y0+296],
    [CX-G.hanche+20, y0+338],                  // pli inguinal
    [CX-20,          y0+346]
  ];
  return sym(demi);
}
/* ── Bras : épaule → coude → poignet, légèrement écarté ── */
/* Le bras s'écarte en descendant : au repos il ne colle pas au tronc.
   `ec` est cet écartement progressif — c'est lui qui rend l'aisselle
   et la taille lisibles. */
function bras(G, cote){
  const s = cote === "g" ? -1 : 1;
  const xe = CX + s*(G.epaule-2), y = 212;
  const ec = k => s*k;
  const dehors = [
    [xe - s*G.bras*0.25,              y],
    [xe + s*G.bras + ec(1),           y+34],   // deltoïde
    [xe + s*(G.bras+5) + ec(5),       y+104],  // bras
    [xe + s*(G.avbras+9) + ec(10),    y+168],  // coude
    [xe + s*(G.avbras+14) + ec(15),   y+250],  // avant-bras
    [xe + s*(G.avbras+8) + ec(18),    y+298]   // poignet externe
  ];
  const dedans = [
    [xe + s*(G.avbras-6) + ec(18),    y+302],
    [xe - s*(G.avbras-3) + ec(15),    y+250],
    [xe - s*(G.avbras+3) + ec(10),    y+168],
    [xe - s*(G.bras-1)   + ec(5),     y+104],
    [xe - s*(G.bras+1)   + ec(1),     y+40]
  ];
  /* Le bord interne n'est tracé qu'à partir de l'aisselle : plus haut,
     il barrerait le thorax ; plus bas, il sépare le bras de la taille. */
  const interneBas = dedans.slice(0, 3).concat([dedans[3]]);
  return { plein: lisse(dehors.concat(dedans), true),
           trait: lisse(dehors, false),
           traitBas: lisse(interneBas, false) };
}
/* ── Main : paume + esquisse des doigts ── */
/* ── Main : poignet, dos de la main, doigts effilés, pouce côté corps ── */
function main(G, cote){
  const s = cote === "g" ? -1 : 1;
  const xe = CX + s*(G.epaule-2) + s*18, y = 502;
  const a = G.avbras;
  const pts = [
    [xe + s*(a+4),   y],                       // poignet externe
    [xe + s*(a+9),   y+24],                    // tête du 5e métacarpien
    [xe + s*(a+7),   y+60],
    [xe + s*(a+2),   y+94],                    // bout des doigts
    [xe - s*(a-5),   y+98],
    [xe - s*(a-1),   y+72],                    // bord interne des doigts
    [xe - s*(a+2),   y+44],
    [xe - s*(a+7),   y+26],                    // pouce
    [xe - s*(a+2),   y+10],
    [xe - s*(a-2),   y+1]                      // poignet interne
  ];
  return lisse(pts, true);
}
/* ── Jambe : cuisse → genou → mollet → cheville ── */
function jambe(G, cote){
  const s = cote === "g" ? -1 : 1;
  const xh = CX + s*(G.hanche-36), y = 452;
  const pts = [
    [xh - s*G.cuisse*0.45, y],                 // racine, cachée par le bassin
    [xh + s*(G.cuisse+6), y+46],               // haut de cuisse, évasé
    [xh + s*G.cuisse,     y+112],
    [xh + s*(G.cuisse-6), y+210],
    [xh + s*(G.genou+2),  y+274],              // genou
    [xh + s*(G.mollet+8), y+334],              // mollet
    [xh + s*(G.cheville+7), y+412],            // tibia
    [xh + s*(G.cheville+2), y+464],            // cheville
    [xh - s*(G.cheville-3), y+466],
    [xh - s*(G.cheville+3), y+412],
    [xh - s*(G.mollet-6),   y+334],
    [xh - s*(G.genou-2),    y+274],
    [xh - s*(G.cuisse-16),  y+180],
    [xh - s*(G.cuisse-6),   y+70]              // face interne, haut
  ];
  return lisse(pts, true);
}
/* ── Pied : vu de face, légèrement ouvert ── */
function pied(G, cote){
  const s = cote === "g" ? -1 : 1;
  const xh = CX + s*(G.hanche-36), y = 908;
  const pts = [
    [xh + s*(G.cheville-1),  y],               // malléole externe
    [xh + s*(G.cheville+8),  y+26],            // bord externe
    [xh + s*(G.cheville+10), y+48],
    [xh + s*(G.cheville+4),  y+62],            // 5e orteil
    [xh - s*(G.cheville+6),  y+64],            // gros orteil
    [xh - s*(G.cheville+9),  y+46],
    [xh - s*(G.cheville+5),  y+24],            // voûte interne
    [xh - s*(G.cheville-3),  y+2]
  ];
  return lisse(pts, true);
}
/* Traits d'anatomie : clavicules, sternum, rotules, coudes.
   ⚠️ Discrets — ils donnent du relief sans transformer le corps en
   planche annotée. */
function repereFace(g){
  const G = GAB[g], y = 182;
  const cl = s => lisse([[CX + s*8, y+40], [CX + s*(G.epaule-30), y+34], [CX + s*(G.epaule-12), y+44]], false);
  const rot = s => { const xh = CX + s*(G.hanche-34);
    return lisse([[xh - s*(G.genou-12), y+542], [xh, y+554], [xh + s*(G.genou-12), y+542]], false); };
  const cou = s => { const xe = CX + s*(G.epaule-4);
    return lisse([[xe - s*(G.avbras-4), 380], [xe + s*(G.avbras+6), 384]], false); };
  return [cl(-1), cl(1), rot(-1), rot(1), cou(-1), cou(1),
          lisse([[CX, y+86], [CX, y+150]], false)];          // sternum
}

/* Le seul bord EXTERNE du bras : tracé par-dessus le tronc, il dessine
   l'épaule et le coude sans barrer le thorax d'une couture. */
function brasTrait(g){
  const G = GAB[g];
  return [bras(G,"g").trait, bras(G,"d").trait,
          bras(G,"g").traitBas, bras(G,"d").traitBas];
}

function piecesFace(g){
  const G = GAB[g];
  return [
    ["tronc", tronc(G)], ["cou", cou(G)],
    ["jambe-g", jambe(G,"g")], ["jambe-d", jambe(G,"d")],
    ["pied-g", pied(G,"g")],   ["pied-d", pied(G,"d")],
    ["bras-g", bras(G,"g").plein], ["bras-d", bras(G,"d").plein],
    ["main-g", main(G,"g")],   ["main-d", main(G,"d")],
    ["tete", tete(G)]
  ];
}


/* ══════════════════════════════════════════════════════════════
   VUE DE PROFIL — corps tourné vers la droite (profil droit).
   La vue « profil gauche » est le miroir de celle-ci.
   ══════════════════════════════════════════════════════════════ */
function teteProfil(G, y0 = 34){
  const pts = [
    [CX-4,  y0],                               // vertex
    [CX+G.crane*0.9, y0+22],                   // front
    [CX+G.crane+4, y0+58],                     // glabelle
    [CX+G.crane-2, y0+72],                     // racine du nez
    [CX+G.crane+16, y0+92],                    // pointe du nez
    [CX+G.crane+2, y0+100],                    // sous le nez
    [CX+G.crane+6, y0+112],                    // lèvres
    [CX+G.crane-4, y0+124],
    [CX+G.crane-2, y0+136],                    // menton
    [CX+G.machoire-16, y0+146],                // mâchoire
    [CX-16, y0+140],                           // angle mandibulaire
    [CX-G.crane+8, y0+112],                    // derrière l'oreille
    [CX-G.crane, y0+62],                       // occiput
    [CX-G.crane+8, y0+24]
  ];
  return lisse(pts, true);
}
function troncProfil(G, y0 = 182){
  const pts = [
    [CX-14, y0],                               // nuque
    [CX-G.taille-8, y0+30],                    // trapèze arrière
    [CX-G.taille-16, y0+96],                   // dos
    [CX-G.taille-10, y0+170],                  // creux lombaire
    [CX-G.taille-22, y0+238],                  // fesse
    [CX-G.taille-10, y0+320],
    [CX+G.taille-6, y0+346],                   // pli fessier / aine
    [CX+G.taille+10, y0+300],
    [CX+G.taille+16, y0+220],                  // abdomen
    [CX+G.poitrine-22, y0+140],                // sous-poitrine
    [CX+G.poitrine-10, y0+86],                 // poitrine
    [CX+22, y0+28]                             // clavicule
  ];
  return lisse(pts, true);
}
function brasProfil(G){
  const y = 212, x = CX - 6;
  const pts = [
    [x-G.bras-4, y+6], [x+G.bras, y+30], [x+G.bras+4, y+120],
    [x+G.bras+2, y+190], [x+G.bras+6, y+274], [x+G.bras-4, y+300],
    [x-G.bras+2, y+296], [x-G.bras-2, y+190], [x-G.bras-8, y+110]
  ];
  return lisse(pts, true);
}
function mainProfil(G){
  const y = 506, x = CX - 6;
  return lisse([[x+G.bras-2, y], [x+G.bras+4, y+40], [x+G.bras-4, y+92],
                [x-G.bras+4, y+88], [x-G.bras-2, y+40], [x-G.bras+2, y+2]], true);
}
function jambeProfil(G){
  const y = 452, x = CX - 4;
  const pts = [
    [x-G.cuisse-10, y+10], [x+G.cuisse-6, y+20],   // haut de cuisse
    [x+G.cuisse-14, y+130], [x+G.genou-4, y+250],  // genou (rotule à droite)
    [x+G.genou-12, y+300],
    [x+G.cheville+2, y+420], [x+G.cheville-4, y+466],
    [x-G.cheville-8, y+462],
    [x-G.mollet-10, y+340],                        // mollet en arrière
    [x-G.genou-6, y+250],
    [x-G.cuisse-16, y+140]
  ];
  return lisse(pts, true);
}
function piedProfil(G){
  const y = 908, x = CX - 4;
  return lisse([
    [x-G.cheville-8, y], [x-G.cheville-12, y+44],  // talon
    [x-G.cheville-4, y+62],
    [x+G.cheville+42, y+64],                       // orteils, vers l'avant
    [x+G.cheville+40, y+44],
    [x+G.cheville+2, y+26], [x+G.cheville-4, y+2]
  ], true);
}
function piecesProfil(g){
  const G = GAB[g];
  return [
    ["jambe", jambeProfil(G)], ["pied", piedProfil(G)],
    ["tronc", troncProfil(G)], ["cou", cou(G)],
    ["bras", brasProfil(G)],   ["main", mainProfil(G)],
    ["tete", teteProfil(G)]
  ];
}

/* ══════════════════════════════════════════════════════════════
   VUE TÊTE — gros plan, pour viser les zones fines du visage
   ══════════════════════════════════════════════════════════════ */
function piecesTete(g){
  const G = GAB[g], k = 3.1, cy = 300;          // agrandissement
  const gr = (n) => n * k;
  const crane = gr(G.crane), mach = gr(G.machoire);
  /* Proportions d'un visage : hauteur ≈ 1,35 × largeur, et non un œuf. */
  const demi = [
    [CX-8, cy-198],                             // vertex
    [CX-crane*0.62, cy-182], [CX-crane*0.94, cy-128],
    [CX-crane, cy-56],                          // tempe
    [CX-crane+6, cy+14],                        // pommette
    [CX-mach-6, cy+66],                         // angle de la mâchoire
    [CX-mach*0.78, cy+120],
    [CX-mach*0.40, cy+152],
    [CX-12, cy+162]                             // menton
  ];
  const tete = sym(demi);
  const oreille = s => lisse([
    [CX + s*(crane-6),  cy-56],
    [CX + s*(crane+30), cy-44],
    [CX + s*(crane+34), cy+12],
    [CX + s*(crane+8),  cy+34]], true);
  const cou2 = lisse([[CX-gr(G.cou)-4, cy+150], [CX-gr(G.cou)-10, cy+300],
                      [CX+gr(G.cou)+10, cy+300], [CX+gr(G.cou)+4, cy+150]], true);
  return [["cou", cou2], ["oreille-g", oreille(-1)], ["oreille-d", oreille(1)], ["tete", tete]];
}




/* ⚠️ Coins ARRONDIS : une zone entièrement à l'intérieur du corps —
   sacrum, épigastre — garderait sinon des angles droits et ressemblerait
   à un rectangle posé sur le dessin. Celles qui touchent le bord sont
   de toute façon retaillées par la découpe. */
const bande = (x1,y1,x2,y2) => {
  const r = Math.min(16, Math.abs(x2-x1)/3, Math.abs(y2-y1)/3);
  return `M${x1+r} ${y1} H${x2-r} Q${x2} ${y1} ${x2} ${y1+r} V${y2-r} Q${x2} ${y2} ${x2-r} ${y2}`
       + ` H${x1+r} Q${x1} ${y2} ${x1} ${y2-r} V${y1+r} Q${x1} ${y1} ${x1+r} ${y1} Z`;
};
const L = -60, R = 560;

/* Membres : mêmes découpes de face et de dos, seuls les noms changent */
function membres(G, cote, x1, x2){
  const D = cote;   // "droit(e)" ou "gauche"
  const ac = (m, f) => (D === "droit" ? m : f);
  return [
    [`Épaule ${ac("droite","gauche")}`,      bande(x1,206,x2,262)],
    [`Bras ${ac("droit","gauche")}`,         bande(x1,262,x2,372)],
    [`Coude ${ac("droit","gauche")}`,        bande(x1,372,x2,412)],
    [`Avant-bras ${ac("droit","gauche")}`,   bande(x1,412,x2,500)],
    [`Poignet ${ac("droit","gauche")}`,      bande(x1,500,x2,524)],
    [`Main ${ac("droite","gauche")}`,        bande(x1,524,x2,572)],
    [`Doigts ${ac("droits","gauches")}`,     bande(x1,572,x2,610)]
  ];
}
function jambes(G, cote, x1, x2, dos){
  const ac = (m, f) => (cote === "droit" ? m : f);
  return dos ? [
    [`Fesse ${ac("droite","gauche")}`,            bande(x1,452,x2,530)],
    [`Cuisse ${ac("droite","gauche")} postérieure`, bande(x1,530,x2,700)],
    [`Creux poplité ${ac("droit","gauche")}`,     bande(x1,700,x2,748)],
    [`Mollet ${ac("droit","gauche")}`,            bande(x1,748,x2,864)],
    [`Tendon d'Achille ${ac("droit","gauche")}`,  bande(x1,864,x2,906)],
    [`Talon ${ac("droit","gauche")}`,             bande(x1,906,x2,1000)]
  ] : [
    [`Hanche ${ac("droite","gauche")}`,           bande(x1,452,x2,512)],
    [`Cuisse ${ac("droite","gauche")}`,           bande(x1,512,x2,700)],
    [`Genou ${ac("droit","gauche")}`,             bande(x1,700,x2,760)],
    [`Jambe ${ac("droite","gauche")}`,            bande(x1,760,x2,884)],
    [`Cheville ${ac("droite","gauche")}`,         bande(x1,884,x2,930)],
    [`Pied ${ac("droit","gauche")}`,              bande(x1,930,x2,982)],
    [`Orteils ${ac("droits","gauches")}`,         bande(x1,982,x2,1000)]
  ];
}

function zonesVue(g, vue){
  const G = GAB[g];
  const xg = CX - G.epaule + 18, xd = CX + G.epaule - 18;   // limites du tronc
  if (vue === "face"){
    return [
      ["Front",                bande(L,44,R,104)],
      ["Visage",               bande(L,104,R,158)],
      ["Cou",                  bande(L,158,R,200)],
      ["Clavicule droite",     bande(L,200,CX,236)],
      ["Clavicule gauche",     bande(CX,200,R,236)],
      ["Thorax droit",         bande(xg,236,CX,318)],
      ["Thorax gauche",        bande(CX,236,xd,318)],
      ["Région mammaire droite",  bande(xg,318,CX,372)],
      ["Région mammaire gauche",  bande(CX,318,xd,372)],
      ["Épigastre",            bande(CX-64,372,CX+64,414)],
      ["Flanc droit",          bande(xg,372,CX-64,436)],
      ["Flanc gauche",         bande(CX+64,372,xd,436)],
      ["Abdomen droit",        bande(CX-64,414,CX,462)],
      ["Abdomen gauche",       bande(CX,414,CX+64,462)],
      ["Région inguinale droite", bande(xg,436,CX,498)],
      ["Région inguinale gauche", bande(CX,436,xd,498)],
      ["Région pubienne",      bande(CX-52,498,CX+52,540)],
      ...membres(G,"droit",L,CX), ...membres(G,"gauche",CX,R),
      ...jambes(G,"droit",L,CX,false), ...jambes(G,"gauche",CX,R,false)
    ];
  }
  if (vue === "dos"){
    /* De dos, la droite du patient est à DROITE de l'image */
    return [
      ["Cuir chevelu",         bande(L,44,R,110)],
      ["Occiput",              bande(L,110,R,158)],
      ["Nuque",                bande(L,158,R,200)],
      ["Omoplate gauche",      bande(xg,200,CX,318)],
      ["Omoplate droite",      bande(CX,200,xd,318)],
      ["Rachis dorsal",        bande(CX-26,200,CX+26,372)],
      ["Région lombaire gauche", bande(xg,372,CX,452)],
      ["Région lombaire droite", bande(CX,372,xd,452)],
      ["Rachis lombaire",      bande(CX-26,372,CX+26,452)],
      ["Sacrum",               bande(CX-48,452,CX+48,516)],
      ["Sillon interfessier",  bande(CX-20,516,CX+20,560)],
      ...membres(G,"gauche",L,CX), ...membres(G,"droit",CX,R),
      ...jambes(G,"gauche",L,CX,true), ...jambes(G,"droit",CX,R,true)
    ];
  }
  if (vue === "profil-d" || vue === "profil-g"){
    const c = vue === "profil-d" ? "droit" : "gauche";
    const ac = (m, f) => (c === "droit" ? m : f);
    return [
      [`Tempe ${ac("droite","gauche")}`,        bande(L,60,R,120)],
      [`Oreille ${ac("droite","gauche")}`,      bande(L,120,R,166)],
      [`Cou — côté ${ac("droit","gauche")}`,    bande(L,166,R,210)],
      [`Épaule ${ac("droite","gauche")}`,       bande(L,210,R,268)],
      [`Face latérale du thorax ${ac("droite","gauche")}`, bande(L,268,R,372)],
      [`Flanc ${ac("droit","gauche")}`,         bande(L,372,R,452)],
      [`Trochanter ${ac("droit","gauche")}`,    bande(L,452,R,530)],
      [`Face latérale de cuisse ${ac("droite","gauche")}`, bande(L,530,R,700)],
      [`Genou ${ac("droit","gauche")} — face latérale`,    bande(L,700,R,760)],
      [`Jambe ${ac("droite","gauche")} — face latérale`,   bande(L,760,R,884)],
      [`Malléole ${ac("droite","gauche")}`,     bande(L,884,R,930)],
      [`Pied ${ac("droit","gauche")} — bord externe`,      bande(L,930,R,1000)]
    ];
  }
  /* Tête en gros plan : cy = 300 dans piecesTete */
  const cy = 300, k = 3.1, cr = GAB[g].crane * k, ma = GAB[g].machoire * k;
  return [
    ["Cuir chevelu",           bande(L,cy-200,R,cy-150)],
    ["Front",                  bande(CX-cr,cy-150,CX+cr,cy-88)],
    ["Tempe droite",           bande(L,cy-150,CX-cr+30,cy-40)],
    ["Tempe gauche",           bande(CX+cr-30,cy-150,R,cy-40)],
    ["Arcade sourcilière droite", bande(CX-cr+30,cy-88,CX-14,cy-58)],
    ["Arcade sourcilière gauche", bande(CX+14,cy-88,CX+cr-30,cy-58)],
    ["Paupière droite",        bande(CX-cr+34,cy-58,CX-16,cy-36)],
    ["Paupière gauche",        bande(CX+16,cy-58,CX+cr-34,cy-36)],
    ["Œil droit",              bande(CX-cr+34,cy-36,CX-16,cy-6)],
    ["Œil gauche",             bande(CX+16,cy-36,CX+cr-34,cy-6)],
    ["Nez",                    bande(CX-30,cy-36,CX+30,cy+28)],
    ["Aile du nez droite",     bande(CX-46,cy+8,CX-30,cy+34)],
    ["Aile du nez gauche",     bande(CX+30,cy+8,CX+46,cy+34)],
    ["Pommette droite",        bande(L,cy-6,CX-30,cy+30)],
    ["Pommette gauche",        bande(CX+30,cy-6,R,cy+30)],
    ["Joue droite",            bande(L,cy+30,CX-24,cy+86)],
    ["Joue gauche",            bande(CX+24,cy+30,R,cy+86)],
    ["Lèvre supérieure",       bande(CX-40,cy+34,CX+40,cy+58)],
    ["Lèvre inférieure",       bande(CX-40,cy+58,CX+40,cy+82)],
    ["Commissure droite",      bande(CX-64,cy+40,CX-40,cy+72)],
    ["Commissure gauche",      bande(CX+40,cy+40,CX+64,cy+72)],
    ["Menton",                 bande(CX-46,cy+82,CX+46,cy+150)],
    ["Mâchoire droite",        bande(L,cy+86,CX-46,cy+150)],
    ["Mâchoire gauche",        bande(CX+46,cy+86,R,cy+150)],
    ["Oreille droite",         bande(L,cy-60,CX-cr+4,cy+40)],
    ["Oreille gauche",         bande(CX+cr-4,cy-60,R,cy+40)],
    ["Cou",                    bande(L,cy+150,R,cy+240)],
    ["Gorge",                  bande(CX-40,cy+180,CX+40,cy+300)]
  ];
}


/* ── Catalogue des localisations, reconstruit depuis les vues ── */
const PLAIE_REGIONS = (() => {
  const rang = n =>
      /chevelu|Occiput|Nuque|Front|Visage|Tempe|Oreille|Arcade|Paupière|Œil|Nez|Pommette|Joue|Lèvre|Commissure|Menton|Mâchoire|Gorge|^Cou/.test(n) ? 0
    : /Omoplate|Rachis|lombaire|Sacrum|interfessier|Thorax|mammaire|Épigastre|Flanc|Abdomen|Clavicule|latérale du thorax/.test(n) ? 1
    : /inguinale|pubienne|Fesse|Hanche|Trochanter/.test(n) ? 2
    : /Épaule|Bras|Coude|Avant-bras|Poignet|Main|Doigts/.test(n) ? 3 : 4;
  const LBL = ["Tête & visage","Tronc","Bassin","Membres supérieurs","Membres inférieurs"];
  const CLE = ["tete","tronc","bassin","ms","mi"];
  const vues = {};
  PLAIE_VUES.forEach(v => zonesVue("F", v.cle).forEach(([n]) => {
    (vues[n] = vues[n] || []).push(v.cle);
  }));
  const regs = LBL.map((lbl, i) => ({ cle:CLE[i], lbl, zones:[] }));
  Object.entries(vues).forEach(([n, vs]) => regs[rang(n)].zones.push({ n, vue:vs[0], vues:vs }));
  regs.forEach(r => r.zones.sort((a,b) => a.n.localeCompare(b.n, "fr")));
  return regs.filter(r => r.zones.length);
})();
function plaieToutesZones(){ return PLAIE_REGIONS.flatMap(r => r.zones.map(z => z.n)); }
function plaieRegionDe(nom){
  for (const r of PLAIE_REGIONS) if (r.zones.some(z => z.n === nom)) return r;
  return null;
}
function plaieZoneInfo(nom){
  for (const r of PLAIE_REGIONS){ const z = r.zones.find(x => x.n === nom); if (z) return z; }
  return null;
}
/* Dans quelle vue montrer une localisation ? */
function plaieVueDe(nom){
  const z = plaieZoneInfo(nom);
  if (z) return z.vues[0];
  const eq = LOC_ANCIENNES[nom];
  return eq ? (plaieZoneInfo(eq)||{}).vues?.[0] || "face" : "face";
}
/* ⚠️ Correspondance des anciennes localisations : le libellé enregistré
   reste tel quel dans le dossier, on s'en sert seulement pour éclairer
   la bonne zone du nouveau schéma. */
const LOC_ANCIENNES = {
  "Crâne (vertex)":"Cuir chevelu", "Tête":"Cuir chevelu",
  "Derrière l'oreille gauche":"Oreille gauche", "Derrière l'oreille droite":"Oreille droite",
  "Lèvre supérieure":"Lèvre supérieure", "Commissure des lèvres":"Commissure droite",
  "Aile du nez":"Aile du nez droite",
  "Thorax":"Thorax droit", "Sein gauche":"Région mammaire gauche", "Sein droit":"Région mammaire droite",
  "Abdomen":"Abdomen droit", "Dos":"Rachis dorsal", "Colonne":"Rachis dorsal",
  "Lombaires":"Rachis lombaire", "Fessier gauche":"Fesse gauche", "Fessier droit":"Fesse droite",
  "Ischion gauche":"Fesse gauche", "Ischion droit":"Fesse droite",
  "Coccyx":"Sacrum", "Pli inter-fessier":"Sillon interfessier",
  "Jambe gauche":"Jambe gauche", "Jambe droite":"Jambe droite",
  "Plante du pied gauche":"Pied gauche", "Plante du pied droit":"Pied droit",
  "Malléole interne gauche":"Cheville gauche", "Malléole externe gauche":"Malléole gauche",
  "Malléole interne droite":"Cheville droite", "Malléole externe droite":"Malléole droite",
  "Avant-bras gauche":"Avant-bras gauche", "Avant-bras droit":"Avant-bras droit"
};

/* ── Le SVG d'une vue ── */
function plaiePieces(genre, vue){
  const g = (genre === "M" || genre === "H") ? "M" : "F";
  if (vue === "tete") return piecesTete(g);
  if (vue === "profil-d" || vue === "profil-g") return piecesProfil(g);
  return piecesFace(g);
}
/* Découpes par membre : la zone du thorax ne déborde pas sur le bras */
const PL_GROUPES = {
  face: { tronc:["tronc","cou","tete"], brasD:["bras-g","main-g"], brasG:["bras-d","main-d"],
          jambeD:["jambe-g","pied-g"], jambeG:["jambe-d","pied-d"] },
  dos:  { tronc:["tronc","cou","tete"], brasG:["bras-g","main-g"], brasD:["bras-d","main-d"],
          jambeG:["jambe-g","pied-g"], jambeD:["jambe-d","pied-d"] }
};
function plaieGroupeDe(nom, vue){
  if (vue === "tete" || vue === "profil-d" || vue === "profil-g") return "tronc";
  const ms = /Épaule|Bras|Coude|Avant-bras|Poignet|Main|Doigts/.test(nom);
  const mi = /Hanche|Cuisse|Genou|Jambe|Cheville|Pied|Orteils|Fesse|poplité|Mollet|Achille|Talon/.test(nom);
  if (/droit/.test(nom)) return ms ? "brasD" : mi ? "jambeD" : "tronc";
  if (/gauche/.test(nom)) return ms ? "brasG" : mi ? "jambeG" : "tronc";
  return "tronc";
}
function plaieRegionsSVG(genre, vue){
  const g = (genre === "M" || genre === "H") ? "M" : "F";
  return zonesVue(g, vue || "face").map(([zone, d]) => ({ zone, d }));
}
function plaieSilhouette(genre, vue, choisie, grand){
  const g = (genre === "M" || genre === "H") ? "M" : "F";
  const v = vue || "face";
  const pieces = plaiePieces(g, v);
  const par = Object.fromEntries(pieces);
  const id = "pl" + g + v.replace(/[^a-z]/g,"");
  const eclairee = plaieZoneInfo(choisie) ? choisie : (LOC_ANCIENNES[choisie] || choisie);
  const zones = zonesVue(g, v);

  /* Vues simples (profil, tête) : une seule découpe, tout le dessin */
  const groupes = PL_GROUPES[v] || { tronc: pieces.map(([n]) => n) };
  const parGroupe = {};
  zones.forEach(([n, d]) => { const k = plaieGroupeDe(n, v); (parGroupe[k] = parGroupe[k] || []).push([n, d]); });

  const couche = k => `
    <g class="sil-corps">${(groupes[k]||[]).map(n => par[n] ? `<path d="${par[n]}"/>` : "").join("")}</g>
    <g clip-path="url(#${id}-${k})">${(parGroupe[k]||[]).map(([n, d]) =>
        `<path class="preg${n===eclairee?" on":""}" data-zone="${esc(n)}" d="${d}"/>`).join("")}</g>
    <g class="sil-trait">${(groupes[k]||[]).filter(n => n !== "cou" && !n.startsWith("bras"))
        .map(n => par[n] ? `<path d="${par[n]}"/>` : "").join("")}</g>`;
  /* ⚠️ Ordre : jambes puis tronc (sinon un trait barre l'aine),
     bras en dernier — avec leur seul bord externe, sinon une couture
     traverse le thorax. */
  const ordre = PL_GROUPES[v] ? ["jambeD","jambeG","tronc","brasD","brasG"] : ["tronc"];

  /* ⚠️ Le gros plan de la tête a son propre cadrage : dans le cadre du
     corps entier, il flottait au milieu d'un grand vide. */
  const CADRE = { tete:"60 80 380 540" };
  return `<svg viewBox="${CADRE[v] || "0 0 500 1000"}" preserveAspectRatio="xMidYMid meet"
      class="sil${grand?" grand":""}" data-vue="${esc(v)}">
    <defs>${Object.keys(groupes).map(k => `<clipPath id="${id}-${k}">${
      (groupes[k]||[]).map(n => par[n] ? `<path d="${par[n]}"/>` : "").join("")}</clipPath>`).join("")}</defs>
    ${ordre.map(couche).join("")}
    ${PL_GROUPES[v] ? `<g class="sil-trait">${brasTrait(g).map(d => `<path d="${d}"/>`).join("")}</g>
    <g class="sil-repere">${repereFace(g).map(d => `<path d="${d}"/>`).join("")}</g>` : ""}
  </svg>`;
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

/* ============================================================
   JOURNAL DE SUIVI D'UNE PLAIE
   ─────────────────────────────────────────────────────────
   pl.suivi = [{ id, date, txt, mesures, stade }]
   ⚠️ Avant, la fiche ne montrait que des photos : les observations
   écrites partaient dans le passage, sans lien avec la plaie.
   Le fil rassemble tout, par date : ouverture, photos, notes,
   commentaires de soin rattachés, cicatrisation.
============================================================ */
function plaieFil(p, pl){
  const ev = [];
  if (pl.depuis) ev.push({ d:pl.depuis, t:"ouv", txt:"Plaie constatée" });
  plaiePhotos(p, pl).forEach(doc => ev.push({ d:doc.date, t:"photo", id:doc.id }));
  (pl.suivi||[]).forEach(n => ev.push({ d:n.date, t:"note", txt:n.txt, mesures:n.mesures, stade:n.stade, id:n.id, rel:!!n.rel }));
  /* Commentaires de passage que l'utilisateur a rattachés à CETTE plaie */
  (p.visits||[]).forEach(v => {
    const li = v.soinNotesPlaie || {};
    Object.keys(li).forEach(soin => {
      if (li[soin] !== pl.id) return;
      const txt = (v.soinNotes||{})[soin];
      if (txt) ev.push({ d:v.date, t:"soin", soin, txt, slot:v.slot });
    });
  });
  if (pl.cicatriseeLe) ev.push({ d:pl.cicatriseeLe, t:"fin", txt:"Cicatrisée" });
  return ev.sort((a,b) => String(b.d).localeCompare(String(a.d)));   // du plus récent
}
/* Dernière observation écrite, pour la carte */
function plaieDerniereNote(p, pl){
  return plaieFil(p, pl).find(e => e.t === "note" || e.t === "soin") || null;
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
/* Lignes « plaies » d'une relève : l'état de chaque plaie ouverte, plus
   les notes de suivi COCHÉES dont la date tombe dans la période.
   ⚠️ Les commentaires de passage rattachés ne sont pas répétés ici :
   ils figurent déjà à leur date, sous leur soin. */
function plaieBlocReleve(p, start, end){
  const out = [];
  (p.plaies||[]).forEach(pl => {
    const notes = (pl.suivi||[]).filter(n => n.rel && (!start || n.date >= start) && (!end || n.date <= end))
                                .sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const ferme = pl.cicatriseeLe && (!start || pl.cicatriseeLe >= start) && (!end || pl.cicatriseeLe <= end);
    if (pl.cicatriseeLe && !ferme && !notes.length) return;         // refermée avant la période
    const j = plaieJours(pl);
    let tete = plaieNom(pl);
    if (ferme) tete += " — cicatrisée le " + fmtFR(pl.cicatriseeLe) + (j !== null ? " (" + j + " j)" : "");
    else tete += (j !== null ? " — " + j + " j" : "") + (pl.stade ? ", stade " + pl.stade : "");
    out.push({ pl, tete, notes });
  });
  return out;
}
/* Photos de la période, pour la pré-sélection des pièces jointes */
function plaiePhotosPeriode(p, start, end){
  const out = [];
  plaieBlocReleve(p, start, end).forEach(({ pl }) => {
    const ph = plaiePhotos(p, pl).filter(d => (!start || d.date >= start) && (!end || d.date <= end));
    if (ph.length) out.push(ph[ph.length - 1]);   // la dernière de la période
  });
  return out;
}

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
        <span>${fmtFR(d.date)}</span>
        <button class="plv-x" data-plrm="${pl.id}|${d.id}" title="Retirer cette photo">✕</button>
      </div>`).join("");
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
      ${(() => { const n = plaieDerniereNote(p, pl); return n
        ? `<div class="plnote"><b>${fmtFR(n.d)}</b> ${esc(n.txt)}${n.mesures?" · 📏 "+esc(n.mesures):""}</div>` : ""; })()}
      <div class="rowb" style="gap:5px;margin-top:8px">
        <!-- ⚠️ .btn impose width:100% : sans width:auto, ce bouton d'icône
             prenait toute la largeur et cassait la rangée. -->
        <button class="btn btn-ghost sm" data-plsch="${pl.id}" title="Voir sur le schéma"
          style="flex:0 0 auto;width:auto;padding:8px 14px">🧍</button>
        <button class="btn btn-ghost sm" data-plnote="${pl.id}" style="flex:1">✍️ Note de suivi</button>
        <button class="btn btn-ghost sm" data-plfil="${pl.id}" style="flex:1">🕐 Suivi (${plaieFil(p, pl).length})</button>
      </div>
      <div class="rowb" style="gap:5px;margin-top:5px">
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

  bindNav(() => sheetPatient(p));   // ⚠️ sans ceci, « Fiche » reste inerte
  { const b = $("#pl-new"); if (b) b.onclick = () => plaieNouvelle(pid); }
  $$("#sheet [data-plnote]").forEach(b => b.onclick = () => plaieNoteEditer(pid, b.dataset.plnote));
  $$("#sheet [data-plsch]").forEach(b => b.onclick = () => sheetPlaieSchema(pid, b.dataset.plsch));
  $$("#sheet [data-plfil]").forEach(b => b.onclick = () => sheetPlaieFil(pid, b.dataset.plfil));
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
  $$("#sheet [data-plphoto]").forEach(b => b.onclick = async () => {
      /* ⚠️ Avant : appareil photo imposé. Une plaie est souvent
         photographiée pendant le soin, puis importée après. */
      const c = await askChoice({ ic:"📷", titre:"Photo de la plaie",
        options:[ { ic:"📷", lbl:"Prendre une photo",       val:"cam" },
                  { ic:"🖼", lbl:"Choisir dans la galerie", val:"gal" } ] });
      if (!c) return;
      _plaieEnCours = b.dataset.plphoto; docTargetPid = pid;
      const el = document.getElementById(c === "cam" ? "camerafile" : "galleryfile");
      if (el) el.click();
  });
  /* ⚠️ Une photo ajoutée par erreur ne pouvait pas être retirée.
     Deux gestes distincts : la détacher de la plaie (elle reste dans
     les documents du patient) ou la supprimer pour de bon. */
  $$("#sheet [data-plrm]").forEach(b => b.onclick = async e => {
    e.stopPropagation();
    const [plid, did] = b.dataset.plrm.split("|");
    const pl = (p.plaies||[]).find(x => x.id === plid); if (!pl) return;
    const c = await askChoice({ ic:"🖼", titre:"Cette photo",
      options:[ { ic:"↩️", lbl:"Retirer de la plaie", val:"det" },
                { ic:"🗑", lbl:"Supprimer la photo",  val:"sup" } ] });
    if (!c) return;
    pl.docIds = (pl.docIds||[]).filter(x => x !== did);
    if (c === "sup"){
      p.docs = (p.docs||[]).filter(x => x.id !== did);
      /* Le contenu vit hors du dossier (clé doc_<id>) : sans cet effacement,
         plusieurs Mo restaient occupés par une photo invisible. */
      if (typeof idbDel === "function") idbDel("doc_" + did).catch(() => {});
      if (typeof logChange === "function") logChange("delete","doc", p.id+"|"+did);
    }
    save(true); sheetPlaies(pid);
    toast(c === "sup" ? "Photo supprimée 🗑" : "Photo retirée de la plaie");
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
          ${PLAIE_VUES.map(v => `<button class="chip ${vue===v.cle?"on":""}" data-pvue="${v.cle}"
            style="flex:1;justify-content:center;font-size:11.5px;padding:6px 3px">${v.lbl}</button>`).join("")}
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

    bindNav(() => sheetPlaies(pid));   // « Annuler » revient au suivi
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


function plaieZoom(genre, vue, choisie, onPick){
  const ov = document.createElement("div");
  ov.className = "plzoom-ov";
  ov.innerHTML = `<div class="plzoom-box">
    <div class="plzoom-h"><b>${(PLAIE_VUES.find(v=>v.cle===vue)||{lbl:"Vue"}).lbl}</b>
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

/* ============================================================
   NOTE DE SUIVI — écrire une observation datée
   ⚠️ Mesures et stade sont ENREGISTRÉS, jamais interprétés :
   pas d'« aggravation » calculée par l'app (cf. conformité).
============================================================ */
function plaieNoteEditer(pid, plid, noteId, apres){
  const p  = getP(pid);
  const pl = (p.plaies||[]).find(x => x.id === plid);
  if (!pl) return;
  pl.suivi = pl.suivi || [];
  const n = noteId ? pl.suivi.find(x => x.id === noteId) : null;
  const m = (n && n.mesures ? String(n.mesures) : "").match(/([\d.,]+)\s*cm(?:\s*×\s*([\d.,]+)\s*cm)?(?:\s*×\s*([\d.,]+)\s*cm)?/) || [];

  openSheet(`
    ${navHeader("Suivi", true)}
    <h3>✍️ ${n ? "Modifier la note" : "Note de suivi"}</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(plaieNom(pl))} — ${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}</p>

    <div class="rowlab vi"><span>Date</span><i></i></div>
    <div class="rowbox vi" style="display:block">
      <input id="pn-date" type="date" class="rec-in" value="${esc((n && n.date) || workDate())}">
    </div>

    <div class="rowlab ac" style="margin-top:12px"><span>Observation</span><i></i><em>ce que tu vois</em></div>
    <div class="rowbox ac" style="display:block">
      <textarea id="pn-txt" class="rec-in" rows="3"
        placeholder="Plaie propre · bourgeonnement · fibrine · exsudat · douleur au pansement…">${esc((n && n.txt) || "")}</textarea>
      <button class="chip sm rc-cat" id="pn-cat" style="margin-top:6px">📚 Catalogue</button>
    </div>

    <div class="rowlab vi" style="margin-top:12px"><span>Mesures</span><i></i><em>facultatif</em></div>
    <div class="rowbox vi" style="display:block">
      <div class="rowb" style="gap:5px">
        <div style="flex:1"><div class="rec-lab">LONGUEUR</div><input id="pn-L" class="rec-in" inputmode="decimal" placeholder="cm" value="${esc(m[1]||"")}"></div>
        <div style="flex:1"><div class="rec-lab">LARGEUR</div><input id="pn-l" class="rec-in" inputmode="decimal" placeholder="cm" value="${esc(m[2]||"")}"></div>
        <div style="flex:1"><div class="rec-lab">PROFONDEUR</div><input id="pn-p" class="rec-in" inputmode="decimal" placeholder="cm" value="${esc(m[3]||"")}"></div>
      </div>
    </div>

    <div class="rowlab ac" style="margin-top:12px"><span>Stade</span><i></i><em>facultatif</em></div>
    <div class="rowbox ac" style="display:block">
      <div class="rowb" style="gap:4px">
        ${["1","2","3","4"].map(x => `<button class="chip ${((n&&n.stade)||pl.stade)===x?"on":""}" data-pnst="${x}" style="flex:1">${x}</button>`).join("")}
        <button class="chip ${!((n&&n.stade)||pl.stade)?"on":""}" data-pnst="" style="flex:1.6">non précisé</button>
      </div>
      <p class="small muted" style="margin:6px 0 0;font-size:9.5px">Enregistré tel quel. <b>L'app n'en tire aucune conclusion.</b></p>
    </div>

    <div class="rowb" style="margin-top:14px;gap:8px">
      ${n ? `<button class="btn btn-ghost" id="pn-del" style="color:var(--danger)">🗑</button>` : ""}
      <button class="btn btn-ghost" id="pn-cancel" style="flex:1">Annuler</button>
      <button class="btn btn-primary" id="pn-ok" style="flex:1.4">✓ Enregistrer</button>
    </div>`);

  let stade = (n && n.stade) || pl.stade || "";
  bindNav(() => (apres ? apres() : sheetPlaies(pid)));
  $$("#sheet [data-pnst]").forEach(b => b.onclick = () => {
    stade = b.dataset.pnst;
    $$("#sheet [data-pnst]").forEach(x => x.classList.toggle("on", x.dataset.pnst === stade));
  });
  { const b = $("#pn-cat"); if (b) b.onclick = () => ouvrirCatalogue("autonomie", {
      titre:"Observation", onAdd: l => { const t = $("#pn-txt");
        t.value = (t.value.trim() ? t.value.trim() + " · " : "") + l; } }); }
  { const b = $("#pn-cancel"); if (b) b.onclick = () => (apres ? apres() : sheetPlaies(pid)); }
  { const b = $("#pn-del"); if (b) b.onclick = async () => {
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer cette note ?", oui:"🗑 Supprimer" })) return;
      pl.suivi = pl.suivi.filter(x => x.id !== noteId);
      save(true); (apres ? apres() : sheetPlaies(pid)); toast("Note supprimée"); }; }
  { const b = $("#pn-ok"); if (b) b.onclick = () => {
      const txt = ($("#pn-txt").value||"").trim();
      const mes = [$("#pn-L").value, $("#pn-l").value, $("#pn-p").value]
        .map(x => (x||"").trim()).filter(Boolean).map(x => x + " cm").join(" × ");
      if (!txt && !mes && !stade){ toast("Écris une observation, une mesure ou un stade."); return; }
      const e = { id:(n && n.id) || uid(), date:($("#pn-date").value || workDate()), txt, mesures:mes, stade };
      if (n) Object.assign(n, e); else pl.suivi.push(e);
      /* La carte affiche l'état COURANT : la dernière mesure et le
         dernier stade renseignés deviennent ceux de la plaie. */
      const dern = [...pl.suivi].sort((a,b) => String(a.date).localeCompare(String(b.date)));
      const lm = [...dern].reverse().find(x => x.mesures); if (lm) pl.mesures = lm.mesures;
      const ls = [...dern].reverse().find(x => x.stade);   if (ls) pl.stade   = ls.stade;
      save(true); (apres ? apres() : sheetPlaies(pid));
      toast(n ? "Note modifiée ✓" : "Note ajoutée ✓"); }; }
}

/* ============================================================
   LE FIL — tout ce qui concerne la plaie, du plus récent au plus ancien
============================================================ */
function sheetPlaieFil(pid, plid){
  const p  = getP(pid);
  const pl = (p.plaies||[]).find(x => x.id === plid);
  if (!pl) return;
  const ev = plaieFil(p, pl);
  const IC = { ouv:"🩹", photo:"📷", note:"✍️", soin:"💬", fin:"✅" };
  openSheet(`
    ${navHeader("Plaies", true)}
    <h3>🕐 ${esc(plaieNom(pl))}</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))} —
      ${pl.cicatriseeLe ? "cicatrisée le " + fmtFR(pl.cicatriseeLe) : "ouverte depuis " + plaieJours(pl) + " j"}</p>
    <div class="fil">
      ${ev.map(e => `
        <div class="fil-e${e.t==="note"?" cliq":""}${e.rel?" rel":""}"${e.t==="note"?` data-filnote="${e.id}"`:""}>
          <div class="fil-d">${esc(fmtFR(e.d))}</div>
          <div class="fil-c">
            <span class="fil-ic">${IC[e.t]}</span>
            ${e.t==="photo" ? `<span class="fil-t">Photo</span><button class="chip sm" data-filph="${e.id}">Voir</button>`
              : `<span class="fil-t">${e.t==="soin" ? "<b>"+esc(e.soin)+"</b> — " : ""}${esc(e.txt||"")}</span>`}
            ${e.mesures ? `<div class="fil-s">📏 ${esc(e.mesures)}</div>` : ""}
            ${e.stade ? `<div class="fil-s">stade ${esc(e.stade)}</div>` : ""}
            ${e.t==="note" ? `
              <label class="fil-rel" data-stop>
                <input type="checkbox" data-filrel="${e.id}" ${e.rel?"checked":""}>
                <span>📤 Inclure dans la prochaine relève</span>
              </label>
              <div class="fil-s">appuie sur la note pour la modifier</div>` : ""}
          </div>
        </div>`).join("")}
    </div>
    <button class="btn btn-primary" id="fil-add" style="width:100%;margin-top:14px">✍️ Note de suivi</button>
    <p class="small muted" style="margin-top:9px">Les commentaires 💬 viennent des passages : ils restent aussi dans l'historique du patient.</p>`);
  const revenir = () => sheetPlaieFil(pid, plid);
  bindNav(() => sheetPlaies(pid));
  { const b = $("#fil-add"); if (b) b.onclick = () => plaieNoteEditer(pid, plid, null, revenir); }
  $$("#sheet [data-filnote]").forEach(b => b.onclick = e => {
    if (e.target.closest("[data-stop]")) return;   // la case ne rouvre pas la note
    plaieNoteEditer(pid, plid, b.dataset.filnote, revenir);
  });
  /* ⚠️ Marque à usage unique : effacée à l'envoi de la relève, comme les
     mots libres. On ne traîne pas d'anciennes observations sans le voir. */
  $$("#sheet [data-filrel]").forEach(b => b.onchange = () => {
    const n = (pl.suivi||[]).find(x => x.id === b.dataset.filrel);
    if (!n) return;
    if (b.checked) n.rel = true; else delete n.rel;
    save(true); sheetPlaieFil(pid, plid);
    toast(b.checked ? "Note ajoutée à la relève 📤" : "Note retirée de la relève");
  });
  $$("#sheet [data-filph]").forEach(b => b.onclick = e => {
    e.stopPropagation();
    const d = (p.docs||[]).find(x => x.id === b.dataset.filph); if (d) viewDoc(d);
  });
}

/* ============================================================
   OÙ SE TROUVE CETTE PLAIE — le schéma après coup
   ─────────────────────────────────────────────────────────
   La localisation se choisit à la déclaration ; ensuite plus rien
   ne la montrait. Ici on la voit sur la silhouette, et on la corrige.
============================================================ */
function sheetPlaieSchema(pid, plid, apres){
  const p  = getP(pid);
  const pl = (p.plaies||[]).find(x => x.id === plid);
  if (!pl) return;
  const genre = p.genre === "F" ? "F" : (p.genre === "M" ? "M" : "N");
  let loc = pl.loc || "";
  let vue = (plaieRegionsSVG(genre, "face").some(r => r.zone === loc)) ? "face" : "dos";
  const revenir = () => (apres ? apres() : sheetPlaies(pid));

  const dessine = () => {
    const reg = loc ? plaieRegionDe(loc) : null;
    $("#sheet").innerHTML = `
      ${navHeader("Retour", true)}
      <h3>🩹 ${esc(plaieNom(pl))}</h3>
      <p class="small muted" style="margin-bottom:10px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))}</p>
      <div class="chips" style="margin-bottom:8px">
        ${PLAIE_VUES.map(v => `<button class="chip ${vue===v.cle?"on":""}" data-plv="${v.cle}"
          style="font-size:12px">${v.lbl}</button>`).join("")}
        <button class="chip" id="pls-zoom">⛶ Agrandir</button>
      </div>
      ${plaieSilhouette(genre, vue, loc)}
      <div class="plloc">${loc ? "📍 " + esc(loc) : "Localisation non renseignée"}</div>
      ${reg ? `<div class="chips" style="margin-top:8px">
        ${reg.zones.map(z => `<button class="chip sm ${z.n===loc?"on":""}" data-plz="${esc(z.n)}">${esc(z.n)}</button>`).join("")}
      </div>` : ""}
      <p class="small muted" style="margin-top:8px">Tape une zone du schéma pour corriger l'emplacement.</p>
      <button class="btn btn-primary" id="pls-ok" style="width:100%;margin-top:12px">✓ Terminer</button>`;
    bindNav(revenir);
    $$("#sheet [data-plv]").forEach(b => b.onclick = () => { vue = b.dataset.plv; dessine(); });
    $$("#sheet [data-plz]").forEach(b => b.onclick = () => { loc = b.dataset.plz; majLoc(); dessine(); });
    $$("#sheet [data-zone]").forEach(z => z.onclick = () => {
      /* Une zone de tête ouvre le gros plan : 28 zones sur une tête de
         silhouette entière ne se visent pas au doigt. */
      { const _n = z.dataset.zone;
        if (vue !== "tete" && ZONES_TETE.includes(_n)){ vue = "tete"; dessine(); return; } }
      const n = z.dataset.zone; if (!n) return;
      /* Une zone de tête ouvre le gros plan : 28 zones sur une tête de
         silhouette ne se visent pas au doigt. */
      if (vue !== "tete" && ZONES_TETE.includes(n)){ vue = "tete"; dessine(); return; }
      loc = n; majLoc(); dessine();
    });
    { const b = $("#pls-zoom"); if (b) b.onclick = () => plaieZoom(genre, vue, loc); }
    { const b = $("#pls-ok");   if (b) b.onclick = revenir; }
  };
  const majLoc = () => {
    if (loc === pl.loc) return;
    pl.loc = loc;
    if (typeof logChange === "function") logChange("update","patient", p.id, p);
    save(true); toast("Localisation corrigée ✓");
  };
  dessine();
}
