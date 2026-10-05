/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   SOUFFLER
   ─────────────────────────────────────────────────────────
   Quatre choses à faire entre deux adresses : respirer, s'étirer,
   écouter la cigale, regarder le ciel.

   ⚠️ CE N'EST PAS DU SOIN. Aucune mesure, aucun suivi, aucun
   historique d'humeur — la même ligne que pour les constantes et les
   plaies. On ne dit jamais « cohérence cardiaque » : le terme est
   médical et l'app n'est pas un dispositif de soin.

   ⚠️ Tout est DESSINÉ ou SYNTHÉTISÉ : pas un fichier son, pas une
   image. L'app vient d'être allégée de 1,35 Mo, ce n'est pas pour la
   regonfler avec des enregistrements.
============================================================ */

/* ── 1. RESPIRER ──
   Inspiration 4 temps, expiration 6 : l'expiration plus longue que
   l'inspiration, c'est elle qui apaise. Six cycles, une minute. */
const RESP_INSP = 4, RESP_EXP = 6, RESP_CYCLES = 6;
let _respStop = null;

function sheetRespire(){
  let cycle = 0, phase = "inspire", reste = RESP_INSP;

  const points = () => Array.from({ length:RESP_CYCLES },
    (_, i) => `<span class="rs-pt ${i < cycle ? "on" : ""}"></span>`).join("");

  openSheet(`
    ${navHeader("Souffler", true)}
    <h3>🫧 Une minute pour souffler</h3>
    <p class="small muted" style="margin-bottom:14px">Suis le cercle. Rien n'est mesuré, rien n'est enregistré.</p>
    <div class="rs-zone">
      <div class="rs-anneau"></div>
      <div class="rs-bulle" id="rs-bulle"></div>
      <div class="rs-txt">
        <div class="rs-phase" id="rs-phase">Inspire</div>
        <div class="rs-cpt" id="rs-cpt">${RESP_INSP}</div>
      </div>
    </div>
    <div class="rs-pts" id="rs-pts">${points()}</div>
    <p class="small muted" style="text-align:center;margin-top:10px" id="rs-aide">
      cycle 1 sur ${RESP_CYCLES}</p>
    <button class="btn btn-ghost" id="rs-fin" style="width:100%;margin-top:14px">Arrêter</button>`);
  bindNav(() => sheetDetente());

  const bulle = $("#rs-bulle"), ph = $("#rs-phase"), cpt = $("#rs-cpt");
  const majBulle = () => {
    /* La transition dure exactement le temps de la phase : le cercle
       enfle pendant qu'on inspire, sans décalage. */
    const d = (phase === "inspire" ? RESP_INSP : RESP_EXP);
    bulle.style.transition = `transform ${d}s ease-in-out`;
    bulle.style.transform = phase === "inspire" ? "scale(1)" : "scale(.55)";
  };
  bulle.style.transform = "scale(.55)";
  setTimeout(majBulle, 60);

  const tic = setInterval(() => {
    reste--;
    if (reste > 0){ cpt.textContent = reste; return; }
    if (phase === "inspire"){
      phase = "expire"; reste = RESP_EXP;
      ph.textContent = "Expire"; cpt.textContent = reste; majBulle();
    } else {
      cycle++;
      const pts = $("#rs-pts"), aide = $("#rs-aide");
      if (pts) pts.innerHTML = points();
      if (cycle >= RESP_CYCLES){ fin(true); return; }
      if (aide) aide.textContent = "cycle " + (cycle + 1) + " sur " + RESP_CYCLES;
      phase = "inspire"; reste = RESP_INSP;
      ph.textContent = "Inspire"; cpt.textContent = reste; majBulle();
    }
  }, 1000);

  const fin = (complet) => {
    clearInterval(tic); _respStop = null;
    if (!complet) { sheetDetente(); return; }
    ph.textContent = "Voilà.";
    cpt.textContent = "";
    bulle.style.transition = "transform 1.2s ease-out";
    bulle.style.transform = "scale(.8)";
    const a = $("#rs-aide"); if (a) a.textContent = "une minute rien que pour toi";
    const b = $("#rs-fin"); if (b) b.textContent = "Revenir";
  };
  _respStop = () => fin(false);
  { const b = $("#rs-fin"); if (b) b.onclick = () => (_respStop ? fin(false) : sheetDetente()); }
}

/* ── 2. LE CHANT DE LA CIGALE ──
   ⚠️ SYNTHÉTISÉ, pas enregistré : un bruit filtré et modulé suffit à
   faire une stridulation. Un fichier son correct pèserait quelques
   centaines de kilo-octets pour trois secondes. */
let _ctxAudio = null;
function cigaleChanter(duree){
  duree = duree || 3;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    _ctxAudio = _ctxAudio || new AC();
    const ctx = _ctxAudio;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime;

    /* Le grain : un bruit blanc court, rejoué en boucle */
    const n = Math.floor(ctx.sampleRate * duree);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;

    /* Deux filtres serrés : la stridulation est aiguë et étroite */
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 4800; bp.Q.value = 6;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass"; bp2.frequency.value = 7200; bp2.Q.value = 9;

    /* La modulation : ce sont les pulsations rapides qui font « cigale » */
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    const pas = 0.013;
    for (let t = 0; t < duree; t += pas){
      const env = Math.min(1, t / 0.35) * Math.min(1, (duree - t) / 0.6);
      const v = (0.16 + 0.1 * Math.sin(t * 22)) * env;
      gain.gain.linearRampToValueAtTime(t % 0.026 < 0.013 ? v : v * 0.25, t0 + t);
    }
    gain.gain.linearRampToValueAtTime(0, t0 + duree);

    src.connect(bp); bp.connect(bp2); bp2.connect(gain); gain.connect(ctx.destination);
    src.start(t0); src.stop(t0 + duree + 0.05);
    return true;
  } catch(e){ return false; }
}

function sheetCigale(){
  openSheet(`
    ${navHeader("Souffler", true)}
    <h3>🦗 Le chant de la cigale</h3>
    <p class="small muted" style="margin-bottom:16px">Tout est dans la cigale.</p>
    <div class="cg-zone">
      <button class="cg-btn" id="cg-go" aria-label="Faire chanter la cigale">🦗</button>
      <div class="cg-ondes" id="cg-ondes">${
        Array.from({ length:9 }, (_, i) => `<span style="--i:${i}"></span>`).join("")}</div>
    </div>
    <p class="small muted" style="text-align:center;margin-top:14px" id="cg-txt">Touche la cigale</p>
    <div class="tip" style="margin-top:16px">Le chant est <b>fabriqué par l'application</b>, pas enregistré : aucun fichier n'a été ajouté.</div>`);
  bindNav(() => sheetDetente());
  { const b = $("#cg-go"), o = $("#cg-ondes"), t = $("#cg-txt");
    if (b) b.onclick = () => {
      /* Cinq chants de suite appellent le chœur */
      if (typeof cigaleConcertCompter === "function" && cigaleConcertCompter()){
        b.classList.add("chante"); if (o) o.classList.add("on");
        if (t) t.textContent = "tout le pin s'y met…";
        setTimeout(() => { b.classList.remove("chante"); if (o) o.classList.remove("on");
          if (t) t.textContent = "Touche la cigale"; }, 5200);
        return;
      }
      const ok = cigaleChanter(3);
      b.classList.add("chante"); if (o) o.classList.add("on");
      if (t) t.textContent = ok ? "elle chante…" : "le son est coupé sur cet appareil";
      setTimeout(() => {
        b.classList.remove("chante"); if (o) o.classList.remove("on");
        if (t) t.textContent = "Touche la cigale";
      }, 3100);
    }; }
}

/* ── 3. S'ÉTIRER ──
   Quatre mouvements qui tiennent assis dans la voiture. Les mains
   viennent en dernier : c'est ce qui travaille le plus pendant une
   tournée de toilettes, et ce à quoi on pense le moins. */
const ETIREMENTS = [
  { ic:"🙆", t:"La nuque", s:"20 s de chaque côté",
    d:"Assis, épaules relâchées. Amène doucement l'oreille vers l'épaule, sans monter l'épaule. Respire, puis change de côté.",
    sec:20, cotes:true },
  { ic:"🤸", t:"Les épaules", s:"cinq en arrière, cinq en avant",
    d:"Dessine de grands cercles lents avec les épaules, bras relâchés. En arrière d'abord : c'est le sens qui rouvre la poitrine.",
    sec:25 },
  { ic:"🔄", t:"Le bas du dos", s:"15 s de chaque côté",
    d:"Mains sur le volant, tourne le buste sans bouger le bassin. Va jusqu'où ça tire, pas plus loin.",
    sec:15, cotes:true },
  { ic:"🤲", t:"Les mains", s:"trois temps",
    d:"Ouvre et ferme les poings dix fois, doigts bien écartés à l'ouverture. Puis bras tendu, paume vers l'avant, ramène doucement les doigts vers toi — 15 s par main. Termine par cinq rotations de poignet dans chaque sens.",
    sec:45 }
];

function sheetEtirements(){
  let i = 0, reste = 0, tic = null;

  const draw = () => {
    const e = ETIREMENTS[i];
    openSheet(`
      ${navHeader("Souffler", true)}
      <h3>🤸 S'étirer</h3>
      <p class="small muted" style="margin-bottom:12px">Quatre mouvements, assis. Ça tient entre deux adresses.</p>
      ${ETIREMENTS.map((x, k) => `
        <div class="et-c ${k === i ? "on" : ""}" data-et="${k}">
          <div class="et-h">
            <span class="et-n">${k + 1}</span>
            <span style="flex:1;min-width:0">
              <b>${esc(x.t)}</b><br><span class="small muted">${esc(x.s)}</span>
            </span>
            ${k === i ? `<span class="et-cpt" id="et-cpt">${reste || x.sec}s</span>` : `<span class="et-ic">${x.ic}</span>`}
          </div>
          ${k === i ? `<p class="et-d">${esc(x.d)}</p>
            <div class="rowb" style="gap:6px;margin-top:8px">
              <button class="btn btn-ghost btn-sm" id="et-go" style="flex:1">${tic ? "⏸ Pause" : "▶ Lancer le minuteur"}</button>
              ${i < ETIREMENTS.length - 1
                ? `<button class="btn btn-ghost btn-sm" id="et-next" style="flex:1">Suivant ›</button>`
                : `<button class="btn btn-ghost btn-sm" id="et-fin" style="flex:1">Terminé</button>`}
            </div>` : ""}
        </div>`).join("")}
      <div class="tip" style="margin-top:12px">Aucun de ces mouvements ne doit faire mal. Va jusqu'où ça tire, jamais au-delà.</div>`);
    bindNav(() => { arreter(); sheetDetente(); });
    $$("#sheet [data-et]").forEach(b => b.onclick = () => {
      const k = +b.dataset.et; if (k === i) return;
      arreter(); i = k; reste = 0; draw();
    });
    { const g = $("#et-go"); if (g) g.onclick = () => (tic ? arreter(true) : lancer()); }
    { const n = $("#et-next"); if (n) n.onclick = () => { arreter(); i++; reste = 0; draw(); }; }
    { const f = $("#et-fin"); if (f) f.onclick = () => { arreter(); sheetDetente(); }; }
  };

  const arreter = (redessiner) => {
    if (tic){ clearInterval(tic); tic = null; }
    if (redessiner) draw();
  };
  const lancer = () => {
    reste = reste || ETIREMENTS[i].sec;
    tic = setInterval(() => {
      reste--;
      const c = $("#et-cpt");
      if (c) c.textContent = reste + "s";
      if (reste <= 0){
        clearInterval(tic); tic = null;
        if (typeof vibrer === "function") vibrer();
        if (i < ETIREMENTS.length - 1){ i++; reste = 0; draw(); }
        else { toast("C'est fini 🤸"); sheetDetente(); }
      }
    }, 1000);
    draw();
  };
  draw();
}

/* ── 4. LE CIEL DU JOUR ──
   ⚠️ Écrit de mémoire : on s'en tient à des faits stables et
   vérifiables, jamais à une position ou une date de passage — le ciel
   change, pas une app hors ligne. Trente fiches, trois proposées par
   semaine : dix semaines sans répétition, et une semaine sur deux
   travaillée, cela fait cinq mois. */
const CIEL = [
  { n:"La Croix du Sud", f:"constellation", t:"La plus petite des 88 constellations, invisible depuis la France métropolitaine. Les marins s'en servaient pour trouver le sud : en prolongeant son grand axe de quatre fois et demie, on tombe sur le pôle céleste.",
    e:[[50,22,3.4],[54,62,2.8],[32,42,2.4],[72,40,2.6]], l:[[0,1],[2,3]] },
  { n:"La Grande Ourse", f:"constellation", t:"Sept étoiles que tout le monde reconnaît, et qui ne se couchent jamais sous nos latitudes. Les deux du bout de la casserole pointent l'étoile polaire, cinq fois plus loin.",
    e:[[18,60,2.6],[30,56,2.4],[42,54,2.6],[54,50,2.2],[62,38,2.6],[76,34,2.4],[84,46,2.8]], l:[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,3]] },
  { n:"Orion", f:"constellation", t:"Trois étoiles alignées forment sa ceinture, visibles de partout sur Terre. Bételgeuse, l'épaule rouge, est si grande que placée à la place du Soleil, elle engloutirait l'orbite de Mars.",
    e:[[32,22,3.2],[68,26,2.6],[44,48,2.4],[52,50,2.4],[60,52,2.4],[30,76,2.8],[70,78,2.6]], l:[[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]] },
  { n:"Cassiopée", f:"constellation", t:"Un W dans le ciel, face à la Grande Ourse de l'autre côté de l'étoile polaire. Quand l'une est haute, l'autre est basse : elles tournent l'une autour de l'autre toute l'année.",
    e:[[18,40,2.4],[34,62,2.6],[50,38,2.8],[66,60,2.4],[82,36,2.6]], l:[[0,1],[1,2],[2,3],[3,4]] },
  { n:"Le Cygne", f:"constellation", t:"Une grande croix qui traverse la Voie lactée en été. Deneb, sa queue, est l'une des étoiles les plus lumineuses qu'on connaisse — si elle était à la place de notre plus proche voisine, elle éclairerait nos nuits.",
    e:[[50,18,2.8],[50,46,2.2],[50,74,3],[24,44,2.4],[76,44,2.4]], l:[[0,1],[1,2],[3,1],[1,4]] },
  { n:"Le Scorpion", f:"constellation", t:"Antarès, son cœur rouge, porte un nom qui signifie « rival de Mars » : les deux se ressemblent tellement qu'on les confondait. Basse sur l'horizon sud en été.",
    e:[[24,24,2.4],[36,34,2.6],[48,44,3.2],[58,58,2.4],[66,72,2.4],[78,78,2.6]], l:[[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { n:"La Lyre", f:"constellation", t:"Véga, son étoile principale, fut l'étoile polaire il y a 14 000 ans — et le redeviendra dans 12 000 ans. L'axe de la Terre décrit un lent cercle, comme une toupie qui ralentit.",
    e:[[46,20,3.4],[38,48,2.2],[58,46,2.2],[40,70,2.2],[60,68,2.2]], l:[[0,1],[0,2],[1,3],[2,4],[3,4]] },
  { n:"Le Triangle d'été", f:"repère", t:"Trois étoiles de trois constellations différentes — Véga, Deneb et Altaïr. Ce n'est pas une constellation officielle, juste un repère que les astronomes se transmettent pour s'orienter les nuits de juillet.",
    e:[[26,28,3.2],[74,34,3],[50,78,3.2]], l:[[0,1],[1,2],[2,0]] },
  { n:"Le Taureau", f:"constellation", t:"Aldébaran, son œil orange, semble appartenir à l'amas des Hyades — mais elle est deux fois plus proche de nous. Une illusion de perspective vieille de plusieurs millénaires.",
    e:[[30,60,3],[44,52,2.2],[56,46,2.2],[68,30,2.6],[72,62,2.4]], l:[[0,1],[1,2],[2,3],[1,4]] },
  { n:"Les Pléiades", f:"amas", t:"Sept sœurs à l'œil nu, mais plus de mille étoiles au télescope. Elles sont nées ensemble il y a une centaine de millions d'années et voyagent toujours de conserve.",
    e:[[40,34,2.6],[52,30,2.4],[60,40,2.8],[46,46,2.2],[56,52,2.4],[36,50,2.2],[64,28,2],[50,60,1.8]], l:[] },
  { n:"Persée", f:"constellation", t:"Algol, son étoile démon, perd de l'éclat pendant dix heures toutes les trois nuits. Les Anciens l'avaient remarqué sans l'expliquer : c'est une seconde étoile qui passe devant.",
    e:[[30,26,2.6],[44,42,2.8],[58,56,2.4],[70,70,2.4],[38,64,2.2]], l:[[0,1],[1,2],[2,3],[1,4]] },
  { n:"Le Bouvier", f:"constellation", t:"Arcturus, sa géante orange, file à travers la Galaxie dans une direction différente de la nôtre. Elle vient d'ailleurs — probablement d'une petite galaxie absorbée il y a longtemps.",
    e:[[48,76,3.4],[40,56,2.4],[56,54,2.4],[36,34,2.2],[62,32,2.2]], l:[[0,1],[0,2],[1,3],[2,4]] },
  { n:"Andromède", f:"galaxie", t:"La galaxie voisine, à 2,5 millions d'années-lumière — l'objet le plus lointain qu'un œil humain puisse voir sans instrument. Elle se rapproche : dans quatre milliards d'années, elle fusionnera avec la nôtre.",
    e:[[50,44,4.2],[30,30,2],[70,30,2],[26,58,1.8],[74,58,1.8]], l:[] },
  { n:"La Voie lactée", f:"galaxie", t:"Notre galaxie vue par la tranche, depuis l'intérieur. La bande laiteuse des nuits d'été, c'est le disque où nous sommes, à mi-chemin du centre.",
    e:[[14,66,1.8],[28,58,2.2],[42,50,2.6],[56,44,2.4],[70,36,2.2],[84,30,1.8]], l:[[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { n:"L'étoile polaire", f:"repère", t:"Elle n'est pas la plus brillante du ciel, contrairement à ce qu'on croit — à peine la cinquantième. Sa force est ailleurs : elle ne bouge pas, et tout le reste tourne autour d'elle.",
    e:[[50,26,3.4],[38,50,2],[62,52,2],[44,72,1.8],[58,74,1.8]], l:[[0,1],[0,2],[1,3],[2,4]] },
  { n:"Vénus", f:"planète", t:"L'étoile du berger n'est pas une étoile : c'est la planète la plus proche, et la plus brillante après la Lune. Elle ne s'écarte jamais beaucoup du Soleil — visible au crépuscule, ou avant l'aube.",
    e:[[50,44,5.5],[24,24,1.6],[78,66,1.6],[70,22,1.4]], l:[] },
  { n:"Jupiter", f:"planète", t:"Un point très stable et très brillant, qui ne scintille pas — c'est à ça qu'on reconnaît une planète. Avec de simples jumelles tenues fermement, on distingue quatre de ses lunes, celles que Galilée a vues en 1610.",
    e:[[50,44,5],[30,40,1.4],[38,44,1.2],[64,46,1.2],[72,42,1.4]], l:[] },
  { n:"Mars", f:"planète", t:"Sa couleur rouge vient de la rouille : sa poussière est riche en oxyde de fer. Tous les deux ans environ, elle passe au plus près de nous et devient spectaculaire.",
    e:[[50,44,4.6],[22,28,1.5],[76,64,1.5],[34,70,1.3]], l:[] },
  { n:"Saturne", f:"planète", t:"Jaune pâle et calme à l'œil nu. Ses anneaux sont faits de milliards de morceaux de glace, certains gros comme une maison, la plupart comme des grains de sable — et ils ne font que quelques dizaines de mètres d'épaisseur.",
    e:[[50,44,4.2],[30,44,1.2],[70,44,1.2],[24,44,1],[76,44,1]], l:[[3,0],[0,4]] },
  { n:"La Lune cendrée", f:"phénomène", t:"Quand la Lune est un fin croissant, on devine parfois tout son disque en gris pâle. Cette lueur, c'est la Terre qui l'éclaire — le clair de Terre, vu depuis la Lune, est cinquante fois plus lumineux que notre clair de lune.",
    e:[[54,44,7],[26,26,1.4],[76,62,1.4]], l:[] },
  { n:"Les Perséides", f:"phénomène", t:"Les étoiles filantes du 12 août. Ce sont des grains de poussière laissés par une comète, qui se consument à cent kilomètres d'altitude. La plupart sont plus petits qu'un grain de riz.",
    e:[[24,24,1.6],[44,34,1.4],[64,26,1.6],[80,44,1.4]], l:[[0,1],[2,3]] },
  { n:"Les Géminides", f:"phénomène", t:"Mi-décembre, souvent plus généreuses que les Perséides — mais il faut supporter le froid. Elles ne viennent pas d'une comète mais d'un astéroïde, ce qui reste une énigme.",
    e:[[30,30,1.6],[50,24,1.4],[66,38,1.6],[42,52,1.4]], l:[[0,1],[2,3]] },
  { n:"La station spatiale", f:"phénomène", t:"Un point brillant qui traverse le ciel en trois minutes, sans clignoter. Elle tourne à 400 km d'altitude et fait le tour de la Terre en 90 minutes : ses occupants voient seize levers de soleil par jour.",
    e:[[18,62,1.4],[36,54,1.8],[54,46,2.2],[72,38,1.8],[88,30,1.4]], l:[[0,1],[1,2],[2,3],[3,4]] },
  { n:"Les étoiles doubles", f:"curiosité", t:"Plus de la moitié des étoiles vivent en couple. Mizar, dans la Grande Ourse, en est une : une vue très perçante distingue sa compagne, et les Arabes s'en servaient pour tester les yeux.",
    e:[[42,44,3],[52,42,2],[74,62,1.6],[26,28,1.4]], l:[] },
  { n:"Sirius", f:"étoile", t:"L'étoile la plus brillante du ciel nocturne, basse au sud en hiver. Elle scintille de toutes les couleurs — non pas par nature, mais parce que sa lumière traverse une épaisse couche d'atmosphère.",
    e:[[50,52,4.6],[30,30,1.6],[72,28,1.4],[68,72,1.5]], l:[] },
  { n:"Bételgeuse", f:"étoile", t:"L'épaule rouge d'Orion, une supergéante en fin de vie. Elle explosera — peut-être demain, peut-être dans cent mille ans. Et sa lumière met 600 ans à nous parvenir : elle a peut-être déjà explosé.",
    e:[[46,38,5],[70,60,1.8],[26,64,1.6],[76,26,1.4]], l:[] },
  { n:"La lumière du passé", f:"curiosité", t:"Regarder le ciel, c'est regarder en arrière. Le Soleil qu'on voit date de huit minutes, l'étoile polaire de quatre siècles, la galaxie d'Andromède d'avant l'apparition des premiers humains.",
    e:[[22,30,1.6],[40,46,2.4],[58,36,2],[76,56,3],[34,70,1.6]], l:[] },
  { n:"Le ciel des marins", f:"curiosité", t:"Avant le GPS, on trouvait sa latitude à la hauteur de l'étoile polaire au-dessus de l'horizon : son angle donne directement le nombre de degrés. Un sextant et une nuit claire suffisaient.",
    e:[[50,20,3.2],[50,78,1.2],[30,52,1.6],[70,52,1.6]], l:[[0,1]] },
  { n:"Les nuits sans lune", f:"conseil", t:"Pour voir la Voie lactée, il faut trois choses : pas de lune, pas de lampadaire, et vingt minutes sans regarder un écran. C'est le temps qu'il faut à l'œil pour s'adapter complètement.",
    e:[[16,60,1.4],[32,48,2],[48,40,2.6],[64,48,2],[80,58,1.4],[50,22,1.6]], l:[] },
  { n:"Le ciel de l'hiver", f:"repère", t:"La plus belle saison pour lever les yeux : Orion, Sirius, Aldébaran et les Pléiades tiennent dans le même regard. Et les nuits sont longues, ce qui pour une fois arrange.",
    e:[[28,28,2.6],[46,40,3],[62,30,2.2],[74,52,3.2],[38,64,2],[58,70,2.4]], l:[[0,1],[1,2],[1,4],[3,5]] }
];

function cielSemaine(){
  /* Un numéro de semaine simple : le même triplet toute la semaine. */
  const d = new Date();
  const debut = new Date(d.getFullYear(), 0, 1);
  return Math.floor(((d - debut) / 864e5 + debut.getDay()) / 7);
}
let _cielIdx = null;

/* ⚠️ La fiche cachée n'entre JAMAIS dans la rotation hebdomadaire :
   elle ne se trouve qu'en la cherchant. */
function cielListe(){
  const l = [...CIEL];
  if (typeof CIEL_SECRET !== "undefined" && (S.eggs||{}).ciel) l.push(CIEL_SECRET);
  return l;
}
function sheetCiel(i, cherche){
  const L = cielListe();
  /* ⚠️ Chercher « cigale » révèle la fiche cachée — et seulement là. */
  if (cherche && /cigale/i.test(cherche) && typeof eggPoser === "function"){
    eggPoser("ciel");
    _cielIdx = cielListe().length - 1;
    toast("✨ tu l'as trouvée");
    const l2 = cielListe(); const c2 = l2[_cielIdx];
    return cielAfficher(c2, _cielIdx, l2.length);
  }
  if (_cielIdx === null) _cielIdx = (cielSemaine() * 3) % CIEL.length;
  if (i !== undefined) _cielIdx = (i + L.length) % L.length;
  const c = L[_cielIdx];
  return cielAfficher(c, _cielIdx, L.length);
}

function cielAfficher(c, idx, total){
  _cielIdx = idx;

  const etoiles = (c.e || []).map(([x, y, r]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#eaf4ff"/>
     <circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="#8fd2f5" opacity=".14"/>`).join("");
  const traits = (c.l || []).map(([a, b]) => {
    const p = c.e[a], q = c.e[b];
    return `<line x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}" stroke="#5b9ed0" stroke-width=".6" opacity=".5"/>`;
  }).join("");
  /* Un fond d'étoiles fixe, tiré du nom : toujours le même pour une
     fiche donnée, différent d'une fiche à l'autre. */
  const graine = c.n.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const fond = Array.from({ length:26 }, (_, k) => {
    const g = (graine * (k + 7)) % 997;
    return `<circle cx="${g % 100}" cy="${(g * 3) % 100}" r="${0.3 + (g % 5) / 8}"
      fill="#fff" opacity="${0.18 + (g % 4) / 12}"/>`;
  }).join("");

  openSheet(`
    ${navHeader("Souffler", true)}
    <h3>✨ Le ciel</h3>
    <div class="ciel-carte">
      <!-- ⚠️ « slice » recadrait dans le carré : agrandi 3,8 fois, les
           étoiles devenaient de gros disques. « meet » garde la carte
           entière, et le fond sombre du cadre complète les côtés. -->
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img"
        aria-label="${esc(c.n)}">
        <defs>
          <radialGradient id="cg1" cx="70%" cy="26%" r="46%">
            <stop offset="0%" stop-color="#4a7fb5" stop-opacity=".5"/>
            <stop offset="100%" stop-color="#050a18" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="#050a18"/>
        <rect width="100" height="100" fill="url(#cg1)"/>
        ${fond}${traits}${etoiles}
      </svg>
      <div class="ciel-txt">
        <div class="ciel-f">${esc((c.f || "").toUpperCase())}</div>
        <div class="ciel-n">${esc(c.n)}</div>
        <p class="ciel-d">${esc(c.t)}</p>
      </div>
    </div>
    <div class="rowbox" style="display:flex;gap:7px;align-items:center;margin-top:10px">
      <span>🔍</span>
      <input id="ciel-q" class="rec-in" placeholder="Chercher une fiche…" style="flex:1;min-width:0">
    </div>
    <div class="rowb" style="gap:6px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" id="ciel-prev" style="flex:1" aria-label="Précédent">‹ Précédent</button>
      <span class="small muted" style="align-self:center;padding:0 6px">${idx + 1} / ${total}</span>
      <button class="btn btn-ghost btn-sm" id="ciel-next" style="flex:1" aria-label="Suivant">Suivant ›</button>
    </div>
    <p class="small muted" style="text-align:center;margin-top:10px">Trois fiches par semaine — mais tu peux toutes les feuilleter.</p>`);
  bindNav(() => sheetDetente());
  { const p = $("#ciel-prev"); if (p) p.onclick = () => sheetCiel(_cielIdx - 1); }
  { const n = $("#ciel-next"); if (n) n.onclick = () => sheetCiel(_cielIdx + 1); }
  { const q = $("#ciel-q");
    if (q) q.onchange = () => {
      const v = q.value.trim();
      if (!v) return;
      const L = cielListe();
      const k = L.findIndex(x => (x.n + " " + x.f + " " + x.t).toLowerCase().includes(v.toLowerCase()));
      if (k >= 0) sheetCiel(k);
      else sheetCiel(undefined, v);          // peut révéler la fiche cachée
    }; }
}

/* ── L'écran d'accueil de la rubrique ── */
function sheetDetente(){
  openSheet(`
    ${navHeader("Réglages", true)}
    <h3>🌿 Souffler</h3>
    <p class="small muted" style="margin-bottom:14px">Deux minutes entre deux adresses. Rien n'est enregistré.</p>
    <button class="btn btn-ghost sf-item" id="sf-resp">
      <span class="sf-ic">🫧</span>
      <span class="sf-t"><b>Respirer</b><br><span class="small muted">une minute, six cycles guidés</span></span>
      <span class="sf-fl">›</span></button>
    <button class="btn btn-ghost sf-item" id="sf-etir">
      <span class="sf-ic">🤸</span>
      <span class="sf-t"><b>S'étirer</b><br><span class="small muted">quatre mouvements, assis dans la voiture</span></span>
      <span class="sf-fl">›</span></button>
    <button class="btn btn-ghost sf-item" id="sf-cig">
      <span class="sf-ic">🦗</span>
      <span class="sf-t"><b>Le chant de la cigale</b><br><span class="small muted">trois secondes d'été</span></span>
      <span class="sf-fl">›</span></button>
    <button class="btn btn-ghost sf-item" id="sf-ciel">
      <span class="sf-ic">✨</span>
      <span class="sf-t"><b>Le ciel</b><br><span class="small muted">${CIEL.length} fiches à feuilleter</span></span>
      <span class="sf-fl">›</span></button>
    <div class="tip" style="margin-top:14px">Ce n'est pas du soin : rien n'est mesuré, rien n'est suivi, rien ne part dans une relève.</div>`);
  bindNav(() => sheetTours());
  { const e = $("#sf-resp"); if (e) e.onclick = () => sheetRespire(); }
  { const e = $("#sf-etir"); if (e) e.onclick = () => sheetEtirements(); }
  { const e = $("#sf-cig");  if (e) e.onclick = () => sheetCigale(); }
  { const e = $("#sf-ciel"); if (e) e.onclick = () => sheetCiel(); }
}
