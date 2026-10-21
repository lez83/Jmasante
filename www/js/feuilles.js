/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   FEUILLES — export des constantes + feuilles vierges domicile
   ─────────────────────────────────────────────────────────
   ① Export de l'historique des constantes : courbes + tableau
      (PDF / HTML / Word / Texte), aussi joignable au médecin.
   ② Trois feuilles VIERGES à laisser au domicile, pré-remplies
      à l'en-tête du patient : Constantes (avec douleur),
      Poids, Glycémies.

   Format A4 portrait, grille mensuelle 1 → 31.
   Deux densités : "serre" (tout au recto) ou "confort"
   (1-16 recto, 17-31 verso, en-tête répété).
============================================================ */

/* ─────────────────────────────────────────────────────────
   RÉGLAGES DE MISE EN PAGE
   Tout ce qui touche à la densité est ici : si les lignes
   sont trop serrées ou la police trop petite à l'impression,
   ces valeurs sont les seules à changer.
   ───────────────────────────────────────────────────────── */
/* ══ LA TAILLE DU PIED DE FEUILLE ══ (v1.20.0)
   ⚠️ 7 pt ÉTAIT EN DUR, ET C'ÉTAIT TROP PETIT : « actuellement c'est
   écrit trop petit ». La feuille finit sur un frigo, lue à bout de bras
   par l'aidant — pas de près par un soignant.

   ⚠️ 8,5 pt PAR DÉFAUT, PARCE QUE C'EST MESURÉ. Densité serrée, 31 jours,
   une mention de deux lignes : la feuille tient sur une page à 7 et à
   8,5 pt, elle passe sur deux à partir de 10 pt. Le tableau ne perd
   JAMAIS de ligne — les 31 jours sont toujours là, c'est la page qui
   déborde. 10 pt reste proposé : il est lisible de loin, et avec une
   mention courte il tient. L'avertissement est au-dessus du bouton. */
const FEUILLE_PIED = [["7","7 pt"],["8.5","8,5 pt"],["10","10 pt"]];
function feuillePiedPt(){
  const v = parseFloat(S.feuillePiedPt);
  return (v > 0) ? v : 8.5;
}
const FEUILLE_CSS = {
  serre:   { row:"8.1mm",  font:"8pt",   head:"7.6pt", title:"12pt", ident:"9.5pt" },
  confort: { row:"15.5mm", font:"10pt",  head:"9pt",   title:"13pt", ident:"10.5pt" }
};
/* ⚠️ LA LIGNE SE RESSERRE QUAND IL Y A UN PIED, ET SEULEMENT ALORS. Mesuré
   au nombre de pages du PDF, densité serrée, 31 jours :

     hauteur de ligne │ 1 ligne de mention │ 2 à 4 lignes │ 5 lignes à 10 pt
     ─────────────────┼────────────────────┼──────────────┼─────────────────
       8,1 mm (avant) │      1 page        │   2 pages    │     2 pages
       7,6 mm         │      1 page        │   1 page     │     2 pages

   Autrement dit : à 8,1 mm, une mention de deux lignes passait AU VERSO à
   toutes les tailles — ce qui ruine la feuille serrée, dont tout l'intérêt
   est de tenir sur une face. À 7,6 mm, jusqu'à quatre lignes tiennent, à
   7 comme à 10 pt. Les 31 jours sont là dans tous les cas : le tableau ne
   perd JAMAIS de ligne, c'est la page qui déborde. */
const ROW_AVEC_PIED = "7.6mm";

/* ═════════════════════════════════════════════════════════════
   LES COLONNES DE LA FEUILLE DE CONSTANTES SE COMPOSENT (v1.25.0)
   ─────────────────────────────────────────────────────────────
   Demandé au chevet : « est-ce que je pourrais changer le nom d'une
   colonne à la volée ? Par exemple, à la place de douleur, mettre poids,
   parce que chez cette personne, elle n'évalue pas la douleur. Et plutôt
   qu'avoir deux feuilles, tout mettre sur la même. » Puis : « je veux
   aussi le choix d'en supprimer si j'en ai pas besoin, histoire d'avoir
   de la place pour une meilleure lisibilité. »

   ⚠️ C'EST DU PAPIER, RIEN N'EST RELU. Ces feuilles sont des formulaires
   vierges remplis au stylo au domicile ; l'application n'en récupère
   aucune valeur. Un en-tête de colonne n'est donc QUE du texte imprimé :
   renommer une colonne ne touche ni aux seuils de vigilance, ni aux
   tendances, ni au classeur. Aucun risque qu'une valeur saisie dans
   l'application passe pour une autre.

   ⚠️ UNE FICHE OÙ RIEN N'EST COMPOSÉ SORT LA FEUILLE D'AVANT, À
   L'IDENTIQUE. `FCOL_DEFAUT` reproduit exactement l'en-tête d'origine —
   largeurs 6/11/9/9/8/9/36/12, et l'unité affichée sur la SEULE colonne
   de la douleur, les quatre autres constantes n'en montraient pas. C'est
   l'invariant que garde `pw_colonnes` : chez les patients déjà au
   dossier, rien ne doit bouger tant qu'on n'y touche pas.

   ⚠️ SEULE LA FEUILLE DES CONSTANTES SE COMPOSE. Celle du poids a des
   dates libres et sa courbe, celle des glycémies trois moments par jour
   sur deux rangs d'en-tête : les fondre ici leur ferait perdre ça. Pour
   trois glycémies par jour, c'est toujours la feuille Glycémies.
   ═════════════════════════════════════════════════════════════ */

/* Catalogue des mesures. `th` est l'en-tête imprimé (court : la case fait
   17 mm au plus serré), `u` les unités proposées — la première n'est pas
   un défaut imposé, juste celle en tête de liste. `w` est le poids de
   largeur, repris des largeurs d'origine pour que le défaut tombe juste. */
const FCOL_MES = [
  { k:"ta",     lbl:"Tension artérielle", th:"TA",      u:["cmHg","mmHg"],          w:11 },
  { k:"puls",   lbl:"Pouls",              th:"Pouls",   u:["bpm","/min"],           w:9  },
  { k:"temp",   lbl:"Température",        th:"T°",      u:["°C"],                   w:9  },
  { k:"sat",    lbl:"Saturation",         th:"Sat",     u:["%"],                    w:8  },
  { k:"doul",   lbl:"Douleur",            th:"Doul.",   u:["/10","EVA","EN"],       w:9  },
  { k:"poids",  lbl:"Poids",              th:"Poids",   u:["kg"],                   w:9  },
  { k:"glyc",   lbl:"Glycémie",           th:"Glyc.",   u:["g/L","mmol/L","mg/dL"], w:9  },
  { k:"diur",   lbl:"Diurèse",            th:"Diurèse", u:["mL","L"],               w:9  },
  { k:"selles", lbl:"Selles",             th:"Selles",  u:["nombre","Bristol"],     w:9  },
  { k:"o2",     lbl:"Oxygène",            th:"O₂",      u:["L/min","%"],            w:9  },
  { k:"fr",     lbl:"Fréquence resp.",    th:"FR",      u:["/min"],                 w:9  }
];
/* Les cinq d'origine : elles ne portent pas la teinte « colonne ajoutée ». */
const FCOL_HISTO = ["ta","puls","temp","sat","doul"];
/* ⚠️ SIX AU MAXIMUM. Au-delà, les observations tombent sous 22 % de la
   largeur et ne tiennent plus une phrase — c'est ce plafond qui garantit
   que `fcolLargeurs` n'a jamais à rogner sous le plancher. */
const FCOL_MAX = 6;

function fcolMes(k){
  for (let i = 0; i < FCOL_MES.length; i++) if (FCOL_MES[i].k === k) return FCOL_MES[i];
  return null;
}
/* ⚠️ COPIE NEUVE À CHAQUE APPEL : le descripteur est modifié en place par
   l'écran de composition, un objet partagé contaminerait tous les patients. */
function fcolDefaut(){
  return { cols:[ {k:"ta",u:""}, {k:"puls",u:""}, {k:"temp",u:""},
                  {k:"sat",u:""}, {k:"doul",u:"/10"} ],
           jour:true, obs:true, init:true };
}
/* Lecture tolérante : tout descripteur abîmé — vide, sans tableau, sans
   une seule mesure valable — repart du défaut plutôt que de sortir une
   feuille sans colonnes. */
function fcolLire(p, vierge){
  const d = vierge ? S.feuilleColsVierge : (p && p.feuilleCols);
  if (!d || !Array.isArray(d.cols)) return fcolDefaut();
  const cols = d.cols.filter(c => c && (c.k === "libre" || fcolMes(c.k))).slice(0, FCOL_MAX);
  if (!cols.length) return fcolDefaut();
  return { cols:cols.map(c => ({ k:c.k, u:c.u, lbl:c.lbl })),
           jour:d.jour !== false, obs:d.obs !== false, init:d.init !== false };
}
function fcolEcrire(p, vierge, d){
  if (vierge) S.feuilleColsVierge = d; else p.feuilleCols = d;
  if (typeof logChange === "function")
    logChange("update", vierge ? "reglage" : "patient", vierge ? "feuilleColsVierge" : p.id,
              { cols:d.cols.length });
}
function fcolEstDefaut(d){
  const z = fcolDefaut();
  if (!d.jour || !d.obs || !d.init) return false;
  if (d.cols.length !== z.cols.length) return false;
  for (let i = 0; i < z.cols.length; i++){
    if (d.cols[i].k !== z.cols[i].k) return false;
    if (String(d.cols[i].u == null ? "" : d.cols[i].u) !== z.cols[i].u) return false;
  }
  return true;
}
/* En-tête imprimé et unité affichée d'une colonne. Unité vide = aucune :
   l'en-tête tient alors sur un seul rang. */
function fcolTh(c){
  if (c.k === "libre") return String(c.lbl == null ? "" : c.lbl).trim() || "—";
  const m = fcolMes(c.k);
  return m ? m.th : "—";
}
function fcolUnite(c){ return String(c.u == null ? "" : c.u).trim(); }

/* ══ LES LARGEURS ══
   ⚠️ LA PLACE RENDUE NE VA PAS QU'AUX OBSERVATIONS. « Histoire d'avoir de
   la place pour une meilleure lisibilité » : retirer une colonne doit
   ÉLARGIR LES CASES DE MESURE, pas seulement rallonger la colonne de
   droite. D'où le facteur `f` : les mesures gardent leurs proportions
   entre elles et grossissent toutes ensemble jusqu'à 2,1 fois.

     mesures │ une case │ observations
     ────────┼──────────┼──────────────
        6    │   9 %    │    27 %
        5    │   9 %    │    36 %   ← le défaut, identique à avant
        3    │  14 %    │    36 %
        2    │  19 %    │    52 %   (sans la colonne des initiales)

   ⚠️ LE PLANCHER DES OBSERVATIONS L'EMPORTE SUR LE FACTEUR : une phrase
   écrite à la main a besoin de 22 %. Si le compte ne tombe pas, ce sont
   les mesures qui cèdent, jamais les observations. */
function fcolLargeurs(d){
  const W_JOUR = 6, W_INIT = 12, OBS_CIBLE = 36, OBS_MIN = 22, F_MAX = 2.1;
  const jour = d.jour !== false, obs = d.obs !== false, init = d.init !== false;
  const parts = d.cols.map(c => { const m = fcolMes(c.k); return (m ? m.w : 9); });
  const base = parts.reduce((s, w) => s + w, 0) || 1;
  const dispo = 100 - (jour ? W_JOUR : 0) - (init ? W_INIT : 0);
  let f;
  if (!obs) f = dispo / base;
  else {
    f = Math.min(F_MAX, Math.max(1, (dispo - OBS_CIBLE) / base));
    if (dispo - base * f < OBS_MIN) f = (dispo - OBS_MIN) / base;
  }
  /* Arrondi au dixième, et le reliquat va à la dernière colonne élastique
     — les observations, ou la dernière mesure quand elles sont retirées.
     Sans ça les largeurs ne font pas 100 et la dernière case déborde. */
  const w = parts.map(x => Math.round(x * f * 10) / 10);
  const somme = w.reduce((s, x) => s + x, 0);
  let wObs = 0;
  if (obs) wObs = Math.round((dispo - somme) * 10) / 10;
  else if (w.length) w[w.length - 1] = Math.round((w[w.length - 1] + dispo - somme) * 10) / 10;
  return { jour:jour ? W_JOUR : 0, init:init ? W_INIT : 0, obs:wObs, cols:w };
}
function fcolNb(d){
  const L = fcolLargeurs(d);
  return (L.jour ? 1 : 0) + d.cols.length + (L.obs ? 1 : 0) + (L.init ? 1 : 0);
}
/* ⚠️ LE TITRE SUIT LA COMPOSITION, PAS L'INVERSE. « Surveillance des
   constantes » ne veut plus rien dire sur une feuille où l'on relève le
   poids et la diurèse. */
function fcolTitre(d){
  const horsConstantes = d.cols.some(c => FCOL_HISTO.indexOf(c.k) < 0);
  return horsConstantes ? "SURVEILLANCE QUOTIDIENNE" : "SURVEILLANCE DES CONSTANTES";
}
function fcolEnteteHtml(d){
  const L = fcolLargeurs(d);
  let h = L.jour ? `<th style="width:${L.jour}%">J</th>` : "";
  d.cols.forEach((c, i) => {
    /* La teinte orangée reste à la douleur, comme avant ; le vert pâle
       marque les colonnes qui ne sont pas d'origine, pour que l'œil voie
       au premier coup d'œil que la feuille a été taillée sur mesure. */
    const cl = (c.k === "doul") ? ' class="dl"'
             : (FCOL_HISTO.indexOf(c.k) < 0) ? ' class="perso"' : "";
    const u = fcolUnite(c);
    h += `<th style="width:${L.cols[i]}%"${cl}>${esc(fcolTh(c))}`
       + (u ? `<span>${esc(u)}</span>` : "") + `</th>`;
  });
  if (L.obs)  h += `<th style="width:${L.obs}%">Observations</th>`;
  if (L.init) h += `<th style="width:${L.init}%">Init.</th>`;
  return `<tr>${h}</tr>`;
}

/* ---------- Point d'entrée : choix de la feuille ---------- */
/* ⚠️ `pid` NUL = FEUILLE VIERGE, SANS DOSSIER. « Je veux pouvoir éditer
   une fiche de constantes vierge (pas de données patient déjà renseigné)
   ailleurs que depuis la fiche patient. » L'en-tête devient deux lignes à
   remplir à la main : pour en avoir d'avance dans la sacoche, ou pour
   quelqu'un qui n'est pas dans l'application. `type0` permet d'entrer
   directement sur la bonne feuille depuis « Documents vierges ». */
function sheetFeuilles(pid, type0){
  const vierge = !pid;
  const p = vierge ? { nom:"", prenom:"", dob:"", thresholds:{}, _vierge:true } : getP(pid);
  if (!p) { toast("Dossier introuvable", "danger"); return; }
  const nom = vierge ? "" : (p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom);
  let type = (type0 && ["constantes","poids","glycemies"].indexOf(type0) >= 0) ? type0 : "constantes";
  let dens = "serre";
  /* Consigne modifiée à la volée. Elle part de la dernière utilisée et
     n'est enregistrée qu'au tirage (aperçu, impression, partage). */
  let consigne = null;

  /* ⚠️ LA TUILE DIT CE QUE LA FEUILLE CONTIENT VRAIMENT. Laissée en dur,
     elle annonçait « TA · pouls · T° · sat · douleur » sur une feuille où
     la douleur avait été remplacée par le poids : la liste des colonnes
     est donc lue sur la composition. Fonction et non constante — elle
     doit se relire après chaque passage par l'écran de composition. */
  const TYPES = () => {
    const dc = fcolLire(p, vierge);
    return [
      ["constantes", "📊", "Constantes",
        dc.cols.map(c => fcolTh(c)).join(" · ").toLowerCase()],
      ["poids",      "⚖️", "Poids",       "date libre · écart · observations"],
      ["glycemies",  "🩸", "Glycémies",   "matin · midi · soir + insuline"]
    ];
  };

  const draw = () => {
    openSheet(`
      ${navHeader(vierge ? "Documents" : "Fiche", true)}
      <h3 style="margin-bottom:2px">🖨️ Feuilles à laisser au domicile</h3>
      <p class="small muted" style="margin-bottom:14px">${vierge
        ? "Feuille <b>vierge</b> — nom et date de naissance à remplir à la main. À imprimer d'avance."
        : "<b>" + esc(nom) + "</b> — feuilles vierges, déjà à son nom, à remplir à la main par tous les intervenants"}</p>

      <div class="rowlab ac"><span>Quelle feuille</span><i></i></div>
      <div class="rowbox ac" style="display:block;margin-bottom:12px">
      <div class="srcgrid" style="grid-template-columns:1fr;margin-bottom:14px">
        ${TYPES().map(([k,ic,lbl,sub])=>`
          <button class="srcbtn ${k===type?"on":""}" data-ft="${k}" style="flex-direction:row;align-items:center;gap:11px;text-align:left;padding:11px 13px">
            <span class="src-ic" style="margin:0">${ic}</span>
            <span style="flex:1;display:flex;flex-direction:column">
              <span class="src-lbl">${lbl}</span>
              <span class="src-sub">${sub}</span>
            </span>
            ${k===type?'<span style="color:var(--accent);font-size:15px">✓</span>':""}
          </button>`).join("")}
      </div>

      ${/* ⚠️ L'ENTRÉE N'APPARAÎT QUE SUR LA FEUILLE DES CONSTANTES : c'est
           la seule qui se compose. La proposer sur celle du poids ou des
           glycémies promettrait quelque chose qui n'existe pas. */
        type !== "constantes" ? "" : `
      <button class="btn btn-ghost btn-sm" id="fe2-cols" style="width:100%">
        ⚙️ Composer les colonnes${fcolEstDefaut(fcolLire(p, vierge))
          ? "" : ` <span style="color:var(--accent)">· sur mesure</span>`}</button>
      <p class="small muted" style="margin:6px 0 0">${(() => {
        const dc = fcolLire(p, vierge);
        return fcolEstDefaut(dc)
          ? "Renommer une colonne, en ajouter, en retirer pour élargir les autres."
          : dc.cols.map(c => esc(fcolTh(c))).join(" · ")
            + (dc.obs === false ? "" : " · observations")
            + (dc.init === false ? " — sans initiales" : "");
      })()}</p>`}

      </div><div class="rowlab ac"><span>Densité</span><i></i><em>à tester à l'impression</em></div>
      <div class="chips" style="margin-bottom:8px">
        <button class="chip ${dens==="serre"?"on":""}"   data-fd2="serre"   style="flex:1;justify-content:center">Serrée</button>
        <button class="chip ${dens==="confort"?"on":""}" data-fd2="confort" style="flex:1;justify-content:center">Confortable</button>
      </div>
      <p class="small muted" style="margin-bottom:16px">
        ${dens==="serre"
          ? "Les 31 jours sur une seule face. Lignes de 7 mm — compact."
          : "Jours 1 à 16 au recto, 17 à 31 au verso. Lignes de 13 mm — bien plus facile à remplir. <b>Imprimer en recto-verso</b> : une seule feuille pour le mois."}
      </p>

      <div class="rowlab am"><span>Ma mention en bas de page</span><i></i><em>la même pour les 3 feuilles</em></div>
      <div class="rowbox am" style="display:block;margin-bottom:10px">
        <textarea id="fe2-cons" rows="3" style="width:100%;font-size:var(--fs-xs);line-height:1.5"
          placeholder="Nom, cabinet, téléphone, un mot de saison…">${esc(consigne !== null ? consigne : mentionFeuille())}</textarea>
        <p class="small muted" style="margin:6px 0 0">${mentionFeuille()
          ? "La dernière utilisée est proposée. Modifie-la autant que tu veux : celle que tu imprimes revient la prochaine fois."
          : "Ce que tu écris ici s'imprime en bas de la feuille, et revient la prochaine fois."}</p>
        <div class="rowb" style="margin-top:6px">
          <button class="btn btn-ghost btn-sm" id="fe2-cdef" style="flex:1"${mentionFeuille()?"":" disabled"}>↩︎ La dernière</button>
          <button class="btn btn-ghost btn-sm" id="fe2-cvide" style="flex:1">🚫 Aucune mention</button>
        </div>
      </div>

      <div class="rowlab am"><span>Taille du texte en bas</span><i></i></div>
      <div class="chips" style="margin-bottom:6px">
        ${FEUILLE_PIED.map(([v,lbl])=>`
          <button class="chip ${feuillePiedPt()==parseFloat(v)?"on":""}" data-fpt="${v}" style="flex:1;justify-content:center">${lbl}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:16px">
        ${feuillePiedPt() <= 7
          ? "7 pt, c'est l'ancienne taille : lisible de près, beaucoup moins à bout de bras sur un frigo."
          : feuillePiedPt() >= 10
            ? "Lisible de loin, y compris par l'aidant."
            : "Se lit sans se pencher. C'est la taille proposée par défaut."}
        ${dens === "serre"
          ? "La feuille serrée tient sur une face jusqu'à <b>quatre lignes</b> de mention, à toutes les tailles — mesuré. Au-delà, elle passe au verso."
          : "Les 31 jours sont déjà sur deux faces : la mention ne change rien à la pagination."}
      </p>

      <button class="btn btn-primary" id="fe2-show" style="width:100%">👁 Aperçu &amp; impression</button>
      <div class="rowb" style="margin-top:8px">
        <button class="btn btn-ghost" id="fe2-print">🖨️ Imprimer</button>
        <button class="btn btn-ghost" id="fe2-share">📤 Partager</button>
      </div>`);

    /* ⚠️ Le retour suit le chemin d'arrivée : une feuille vierge n'a pas de
       fiche derrière elle, et renvoyer vers `sheetPatient` d'un patient vide
       ouvrirait un dossier qui n'existe pas. */
    bindNav(() => vierge ? sheetDocsVierges() : sheetPatient(p));
    $$("#sheet [data-ft]").forEach(b => b.onclick = () => { type = b.dataset.ft; consigne = null; draw(); });
    { const t = $("#fe2-cons");
      if (t) t.oninput = () => { consigne = t.value; };   // pas de redraw : on garde le curseur
    }
    { const b = $("#fe2-cdef");  if (b) b.onclick = () => { consigne = null; draw(); }; }
    { const b = $("#fe2-cvide"); if (b) b.onclick = () => { consigne = "";   draw(); }; }
    $$("#sheet [data-fd2]").forEach(b => b.onclick = () => { dens = b.dataset.fd2; draw(); });
    $$("#sheet [data-fpt]").forEach(b => b.onclick = () => {
      S.feuillePiedPt = parseFloat(b.dataset.fpt); save(); draw();
    });

    const out = mode => {
      /* ⚠️ C'EST ICI QUE LA MENTION EST GARDÉE, PAS À LA FRAPPE : ce qu'on
         tire est ce qui revient. Un champ à demi tapé puis abandonné ne
         doit pas devenir la proposition de la fois d'après. */
      if (consigne !== null){ mentionFeuilleSet(consigne); save(); }
      const html = feuilleHtml(p, type, dens, consigne);
      const base = "Feuille_" + type + (vierge ? "_vierge" : "_" + p.nom.replace("Demo-","").replace(/\s+/g,"_"));
      if (mode === "share"){ shareText(html, base + ".html", "text/html"); return; }
      showFichePreview(html, base);
      if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
    };
    $("#fe2-show").onclick  = () => out("show");
    $("#fe2-print").onclick = () => out("print");
    $("#fe2-share").onclick = () => out("share");
    { const b = $("#fe2-cols");
      if (b) b.onclick = () => sheetFeuilleColonnes(pid, type); }
  };
  draw();
}

/* ---------- Composer les colonnes de la feuille de constantes ---------- */
/* ⚠️ ON REVIENT TOUJOURS D'OÙ L'ON VIENT, avec la bonne feuille
   sélectionnée : `type0` est rendu à `sheetFeuilles`, sinon le retour
   rouvrait la feuille des constantes alors qu'on en avait choisi une
   autre avant de passer ici. */
function sheetFeuilleColonnes(pid, type0){
  const vierge = !pid;
  const p = vierge ? { nom:"", prenom:"", _vierge:true } : getP(pid);
  if (!p) { toast("Dossier introuvable", "danger"); return; }
  const nom = vierge ? "" : (p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom);
  let d = fcolLire(p, vierge);

  const garder = () => { fcolEcrire(p, vierge, d); save(); };

  const draw = () => {
    const L = fcolLargeurs(d);
    const pris = d.cols.map(c => c.k);
    /* Une mesure déjà posée se retire en la retouchant ; la colonne libre
       peut se répéter, donc elle n'est jamais « prise ». */
    const plein = d.cols.length >= FCOL_MAX;

    const palette = FCOL_MES.map(m => {
      const on = pris.indexOf(m.k) >= 0;
      return `<button class="chip ${on ? "on" : ""}" data-fcm="${m.k}"${
        (!on && plein) ? " disabled" : ""}>${esc(m.th)}</button>`;
    }).join("") + `<button class="chip" data-fclib style="border-style:dashed;color:var(--accent)"${
        plein ? " disabled" : ""}>+ libre</button>`;

    const lignes = d.cols.map((c, i) => {
      const m = fcolMes(c.k);
      const u = fcolUnite(c);
      const libre = (c.k === "libre");
      const sous = libre ? "colonne libre"
        : `en-tête : « ${fcolTh(c)} » · ${L.cols[i]} %`;
      return `<div class="fc-r${libre ? " lib" : ""}">
        <span class="fc-fl">
          <button data-fcup="${i}"${i === 0 ? " disabled" : ""}>▲</button>
          <button data-fcdn="${i}"${i === d.cols.length-1 ? " disabled" : ""}>▼</button>
        </span>
        <button class="fc-n" data-fcn="${i}">${esc(libre ? fcolTh(c) : m.lbl)}
          <small>${esc(sous)}${libre ? " · " + L.cols[i] + " %" : ""}</small></button>
        <button class="chip fc-u ${u ? "on" : ""}" data-fcu="${i}">${
          u ? esc(u) : "sans unité"}</button>
        <button class="fc-x" data-fcx="${i}"${d.cols.length <= 1 ? " disabled" : ""}>✕</button>
      </div>`;
    }).join("");

    const apr = `<table class="fc-apr">${fcolEnteteHtml(d)}
      <tr>${new Array(fcolNb(d)).fill("<td></td>").join("")}</tr></table>`;

    openSheet(`
      ${navHeader("Feuilles", true)}
      <h3 style="margin-bottom:2px">📊 Colonnes de la feuille</h3>
      <p class="small muted" style="margin-bottom:14px">${vierge
        ? "Feuille <b>vierge</b> — cette composition sert à toutes les feuilles vierges."
        : "<b>" + esc(nom) + "</b> — cette composition ne vaut que pour elle."}</p>

      ${uiRow("Mesures", "ac", palette, d.cols.length + " sur " + FCOL_MAX)}

      ${uiRow("Dans cet ordre, de gauche à droite", "ac",
        `<div class="fc-l">${lignes}</div>
         <p class="small muted" style="margin:8px 0 0">Touche l'unité pour la changer ou la
         retirer. Les flèches déplacent la colonne sur le papier.</p>`)}

      ${uiRow("Colonnes fixes", "am", `
        <div class="fc-l">
          <div class="fc-r">
            <span class="fc-n" style="pointer-events:none">Jour
              <small>la colonne des 1 à 31 · ${L.jour} %</small></span>
            <span class="chip on" style="opacity:.55">toujours là</span>
          </div>
          <div class="fc-r">
            <span class="fc-n" style="pointer-events:none">Observations
              <small>${L.obs ? L.obs + " % de la largeur" : "retirée — sa place va aux mesures"}</small></span>
            <button class="chip ${L.obs ? "on" : ""}" data-fcf="obs">${L.obs ? "présente" : "retirée"}</button>
          </div>
          <div class="fc-r">
            <span class="fc-n" style="pointer-events:none">Initiales
              <small>${L.init ? L.init + " % de la largeur" : "retirée — 12 % rendus au tableau"}</small></span>
            <button class="chip ${L.init ? "on" : ""}" data-fcf="init">${L.init ? "présente" : "retirée"}</button>
          </div>
        </div>
        <p class="small muted" style="margin:8px 0 0">Ce sont les deux plus grosses colonnes.
        Chez un patient où tu passes seul, les initiales ne servent à rien : les retirer rend
        plus de place que n'importe quelle mesure supprimée.</p>`)}

      ${uiRow("Aperçu de l'en-tête", "bl", apr
        + `<p class="small muted" style="margin:8px 0 0">Une case de mesure fait
           <b>${Math.round(L.cols.reduce((s,x)=>s+x,0) / L.cols.length * 1.9)} mm</b> environ
           sur une A4. ${fcolEstDefaut(d)
             ? "C'est la feuille d'origine, inchangée."
             : "Titre de la feuille : « " + fcolTitre(d).toLowerCase() + " »."}</p>`)}

      <div class="rowb">
        <button class="btn btn-ghost" id="fc-raz"${fcolEstDefaut(d)?" disabled":""}>↩︎ Modèle d'origine</button>
        <button class="btn btn-primary" id="fc-ok">✓ Terminé</button>
      </div>`);

    bindNav(() => sheetFeuilles(pid, type0));

    /* ── palette : ajouter ou retirer une mesure ── */
    $$("#sheet [data-fcm]").forEach(b => b.onclick = () => {
      const k = b.dataset.fcm, i = d.cols.findIndex(c => c.k === k);
      if (i >= 0){ if (d.cols.length <= 1) return; d.cols.splice(i, 1); }
      else {
        if (d.cols.length >= FCOL_MAX) return;
        /* L'unité proposée n'est pas imposée : la première de la liste
           quand il y en a plusieurs, rien du tout quand la mesure n'en a
           qu'une évidente — c'est ce que faisait la feuille d'origine,
           qui n'affichait l'unité que sur la douleur. */
        const m = fcolMes(k);
        d.cols.push({ k, u: (m.u.length > 1) ? m.u[0] : "" });
      }
      garder(); draw();
    });
    { const b = $("#sheet [data-fclib]");
      if (b) b.onclick = async () => {
        if (d.cols.length >= FCOL_MAX) return;
        const nm = await askText("Colonne libre", {
          ic:"✍️", ph:"Appétit, humeur, pansement…",
          sub:"Son nom s'imprime en en-tête. Court, il tient mieux." });
        if (nm === false || !String(nm).trim()) return;
        const un = await askText("Son unité", {
          ic:"📐", ph:"— / + / ++",
          sub:"Laisse vide pour n'en afficher aucune.", oui:"✓ Ajouter" });
        if (un === false) return;
        d.cols.push({ k:"libre", lbl:String(nm).trim(), u:String(un).trim() });
        garder(); draw();
      };
    }

    /* ── une colonne : nom, unité, ordre, retrait ── */
    $$("#sheet [data-fcn]").forEach(b => b.onclick = async () => {
      const i = +b.dataset.fcn, c = d.cols[i];
      if (c.k !== "libre") return;            // le nom d'une mesure ne se renomme pas : on change de mesure
      const nm = await askText("Nom de la colonne", { ic:"✍️", val:fcolTh(c) });
      if (nm === false || !String(nm).trim()) return;
      c.lbl = String(nm).trim(); garder(); draw();
    });
    $$("#sheet [data-fcu]").forEach(b => b.onclick = async () => {
      const i = +b.dataset.fcu, c = d.cols[i], m = fcolMes(c.k);
      const u = fcolUnite(c);
      const opts = (m ? m.u : []).map(x => ({ lbl:x, val:x, ic:(x === u) ? "✓" : "" }));
      opts.push({ lbl:"Sans unité", val:"__none", ic:u ? "" : "✓",
                  sub:"l'en-tête tient sur un seul rang" });
      opts.push({ lbl:"La mienne…", val:"__libre", sub:"à taper" });
      const r = await askChoice({
        ic:"📐", titre:"Unité de « " + fcolTh(c) + " »",
        sub:"Elle s'imprime en petit sous l'en-tête.", options:opts });
      if (r === null) return;
      if (r === "__libre"){
        const t = await askText("Unité", { ic:"📐", val:u, ph:"mmol/L, mL, /min…",
          sub:"Laisse vide pour n'en afficher aucune." });
        if (t === false) return;
        c.u = String(t).trim();
      } else c.u = (r === "__none") ? "" : r;
      garder(); draw();
    });
    const bouger = (i, j) => {
      if (j < 0 || j >= d.cols.length) return;
      const t = d.cols[i]; d.cols[i] = d.cols[j]; d.cols[j] = t;
      garder(); draw();
    };
    $$("#sheet [data-fcup]").forEach(b => b.onclick = () => bouger(+b.dataset.fcup, +b.dataset.fcup - 1));
    $$("#sheet [data-fcdn]").forEach(b => b.onclick = () => bouger(+b.dataset.fcdn, +b.dataset.fcdn + 1));
    $$("#sheet [data-fcx]").forEach(b => b.onclick = () => {
      /* ⚠️ JAMAIS ZÉRO MESURE : une feuille sans colonne à remplir n'est
         plus une feuille, et `fcolLire` la remplacerait par le défaut au
         tirage suivant — l'utilisateur verrait son travail disparaître. */
      if (d.cols.length <= 1){ toast("Il faut au moins une mesure", "amber"); return; }
      d.cols.splice(+b.dataset.fcx, 1); garder(); draw();
    });

    /* ── colonnes fixes ── */
    $$("#sheet [data-fcf]").forEach(b => b.onclick = () => {
      const k = b.dataset.fcf;
      d[k] = (d[k] === false);
      garder(); draw();
    });

    { const b = $("#fc-raz");
      if (b) b.onclick = async () => {
        const ok = await askDialog({ ic:"↩︎", titre:"Revenir au modèle d'origine ?",
          sub:"TA · pouls · T° · sat · douleur, avec les observations et les initiales.",
          oui:"↩︎ Revenir", non:"Annuler" });
        if (!ok) return;
        d = fcolDefaut(); garder(); draw(); toast("Modèle d'origine rétabli", "accent");
      };
    }
    $("#fc-ok").onclick = () => sheetFeuilles(pid, type0);
  };
  draw();
}

/* ---------- Génération d'une feuille vierge ---------- */
/* Texte de consigne par défaut, seuils du patient inclus.
   Extrait pour que l'écran puisse le pré-remplir et le proposer
   à la modification avant impression. */
/* ══ LA MENTION DU BAS DE FEUILLE ══ (v1.20.0)
   ⚠️ CE N'EST PLUS LES NORMES. Elles y étaient d'office — « TA > 16 ou
   < 9 · Pouls > 100… » — et sa mention ne pouvait que les remplacer, sans
   être gardée : l'écran rouvert repartait du texte d'origine. Demandé au
   chevet : « je ne veux que la mention que je souhaite et plus les
   indications de normes », et « avoir en proposition la précédente ».

   ⚠️ UNE SEULE MENTION POUR LES TROIS FEUILLES — constantes, poids,
   glycémies. C'est son choix : la consigne porte son nom, son cabinet ou
   un mot de saison, pas le contenu du tableau.

   ⚠️ ELLE EST PROPOSÉE, PAS IMPOSÉE. Le champ s'ouvre sur la dernière
   utilisée et se modifie à chaque tirage : « pour certaines périodes je
   vais modifier le nom ou le cabinet ou bien mettre un message
   d'actualités type joyeuses fêtes ». Ce qu'on imprime est enregistré
   pour la fois d'après. */
function mentionFeuille(){ return (S.feuilleMention != null) ? String(S.feuilleMention) : ""; }
function mentionFeuilleSet(txt){
  S.feuilleMention = String(txt == null ? "" : txt);
  if (typeof logChange === "function") logChange("update","reglage","feuilleMention",{ v:S.feuilleMention });
}
/* ⚠️ Gardée pour les anciennes suites et pour qui voudrait retrouver les
   repères chiffrés : elle n'est plus posée d'office en bas de feuille. */
function normesDefaut(p, type){
  const th = (p && p.thresholds) || {};
  const seuil = (k, d) => (th[k] != null && th[k] !== "") ? th[k] : d;
  const R = {
    constantes: `TA > ${seuil("ta_h",16)} ou < ${seuil("ta_b",9)} · Pouls > 100 ou < 50 · T° > ${seuil("temp_h",38)} · Sat < ${seuil("sat_b",92)} · Douleur ≥ 4 : antalgique et transmission`,
    poids:      `Prévenir le médecin si prise de plus de 2 kg en 3 jours ou 3 kg en une semaine`,
    glycemies:  `Hypoglycémie < ${seuil("gl_b",0.70)} g/L : resucrer et alerter · Hyperglycémie > ${seuil("gl_h",2.50)} g/L : prévenir le médecin`
  };
  return R[type] || "";
}

function feuilleHtml(p, type, dens, consigne){
  const vierge = !!(p && p._vierge) || !(p && p.nom);
  const nom = vierge ? "" : (p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom);
  const dob = (!vierge && p.dob) ? p.dob.split("-").reverse().join("/") : "";
  const D0 = FEUILLE_CSS[dens] || FEUILLE_CSS.serre;
  const pPt = feuillePiedPt();

  /* Composition des colonnes — seule la feuille des constantes la suit. */
  const dcol = fcolLire(p, vierge);

  const TITRES = {
    constantes: fcolTitre(dcol),
    poids:      "SUIVI DU POIDS",
    glycemies:  "SURVEILLANCE GLYCÉMIQUE"
  };

  /* En-tête, répété au verso en mode confortable */
  const entete = (suite) => `
    <div class="hd">
      <div class="hd-l">
        <div class="tt">${TITRES[type]}${suite?' <span class="sui">(suite)</span>':""}</div>
        <div class="id">${vierge
          ? `Nom : <span class="lg"></span> &nbsp; Né(e) le : <span class="lg sm"></span>`
          : `<b>${esc(nom)}</b>${dob?` — née le ${dob}`:""}`}</div>
        ${type==="poids"     ? `<div class="sub">Poids de référence : ________ kg</div>` : ""}
        ${type==="glycemies" ? `<div class="sub">Protocole : _______________________________________________</div>` : ""}
      </div>
      <div class="mois">Mois : ________ 20___</div>
    </div>`;

  /* Lignes du tableau */
  const nbCols = { constantes:fcolNb(dcol), poids:5, glycemies:9 }[type];
  const ligne = (j) => {
    /* ⚠️ LE NOMBRE DE CASES SUIT LA COMPOSITION, ET DOIT LA SUIVRE
       EXACTEMENT : avec `table-layout:fixed`, une case de trop ne
       s'ajoute pas au tableau, elle sort de la page sans un mot. */
    const sansJour = (type === "constantes") && (dcol.jour === false);
    const jour = sansJour ? ""
      : (type === "poids") ? `<td class="dt"></td>`    // date libre : pesée non quotidienne
      : `<td class="jr">${j}</td>`;
    const cells = new Array(nbCols - (sansJour ? 0 : 1)).fill('<td></td>').join("");
    /* ⚠️ LE RYTHME EST PORTÉ PAR LA LIGNE, PAS PAR UN `nth-child`. Les
       glycémies ont DEUX lignes d'en-tête et les constantes une seule :
       un compteur de position se décalerait d'un jour d'un tableau à
       l'autre. La ligne sait quel jour elle porte, elle le dit. */
    return `<tr${(j > 1 && j % 5 === 1) ? ' class="g5"' : ""}>${jour}${cells}</tr>`;
  };

  const entetesTable = {
    /* ⚠️ L'EN-TÊTE DES CONSTANTES EST CALCULÉ, PLUS ÉCRIT. Avec le
       descripteur par défaut il ressort mot pour mot celui d'avant —
       6/11/9/9/8/9/36/12, unité sur la seule colonne de la douleur. */
    constantes: fcolEnteteHtml(dcol),
    poids: `<tr>
        <th style="width:13%">Date</th><th style="width:13%">Poids</th>
        <th style="width:11%">Écart</th><th style="width:49%">Observations</th>
        <th style="width:14%">Init.</th>
      </tr>`,
    glycemies: `<tr>
        <th rowspan="2" style="width:6%">J</th>
        <th colspan="2" style="width:17%">Matin</th>
        <th colspan="2" style="width:17%">Midi</th>
        <th colspan="2" style="width:17%">Soir</th>
        <th rowspan="2" style="width:31%">Observations</th>
        <th rowspan="2" style="width:12%">Init.</th>
      </tr>
      <tr class="sub-h">
        <th>g/L</th><th>UI</th><th>g/L</th><th>UI</th><th>g/L</th><th>UI</th>
      </tr>`
  };

  const table = (from, to) => `<table>
      ${entetesTable[type]}
      ${Array.from({length: to-from+1}, (_,i) => ligne(from+i)).join("")}
    </table>`;

  /* ⚠️ PLUS DE NORMES EN BAS DE FEUILLE, SEULEMENT SA MENTION : « je ne
     veux que la mention que je souhaite et plus les indications de
     normes », pour les trois feuilles. Le texte saisi est échappé — un <
     ou un & casserait la mise en page. Chaîne vide = pas de pied du tout.
     `normesDefaut()` reste disponible pour qui veut les recopier dedans. */
  const txtPied = esc(String(
    (consigne !== undefined && consigne !== null) ? consigne : mentionFeuille()
  ).trim());
  /* ⚠️ LE FILIGRANE EST PERMANENT SUR LES TROIS FEUILLES — son choix :
     « je le veux bien sur les feuilles de constantes, poids, glycémie en
     permanence ». Pas d'interrupteur ici ; celui des réglages ne vaut que
     pour les autres documents. La signature vit DANS la ligne du pied,
     jamais par-dessus : posée en absolu, elle chevauchait la mention. */
  const sig = (typeof filigraneSignature === "function") ? filigraneSignature() : "";
  const pied = `<div class="sp"></div><div class="pd">`
    + `<span class="pd-t">${txtPied}</span>${sig}</div>`;
  /* ⚠️ TOUJOURS RESSERRÉE EN DENSITÉ SERRÉE, MÊME SANS MENTION. La ligne
     du pied existe désormais dans tous les cas : elle porte la signature
     du filigrane. Conditionner le resserrement au texte de la mention
     faisait déborder la feuille sur deux pages dès qu'on vidait le champ
     — mesuré, et c'est l'épreuve qui l'a dit. */
  const D = (dens === "serre") ? Object.assign({}, D0, { row: ROW_AVEC_PIED }) : D0;

  // Courbe uniquement sur la feuille de poids
  const courbe = type !== "poids" ? "" : `
    <svg class="crb" viewBox="0 0 310 ${dens==="serre"?70:90}" preserveAspectRatio="none">
      ${[...Array(5)].map((_,i)=>`<line x1="0" y1="${(i+1)*(dens==="serre"?12:16)}" x2="310" y2="${(i+1)*(dens==="serre"?12:16)}" stroke="#e4ece9" stroke-width="0.4"/>`).join("")}
      ${[...Array(9)].map((_,i)=>`<line x1="${(i+1)*31}" y1="0" x2="${(i+1)*31}" y2="${dens==="serre"?70:90}" stroke="#eef3f1" stroke-width="0.3"/>`).join("")}
      <text x="2" y="8" font-size="5" fill="var(--faint)">kg</text>
    </svg>`;

  /* ⚠️ UNE SEULE COUCHE, EN `position:fixed` : à l'impression elle se
     répète d'elle-même sur chaque page — recto ET verso en densité
     confortable — sans qu'on ait à la poser deux fois. */
  const fond = (typeof filigraneCouche === "function") ? filigraneCouche(dens === "serre" ? 190 : 210) : "";
  const corps = fond + ((dens === "serre")
    ? `<div class="pg">${entete(false)}${courbe}${table(1,31)}${pied}</div>`
    : `<div class="pg">${entete(false)}${courbe}${table(1,16)}${pied}
         <div class="verso-note">Suite au verso →</div></div>
       <div class="pg brk">${entete(true)}${table(17,31)}${pied}</div>`);

  return `<!DOCTYPE html><html lang="fr" data-fili="1"><head><meta charset="utf-8">
<title>${TITRES[type]} — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:9mm 8mm; }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0}
 .pg{ display:flex; flex-direction:column; min-height:277mm; }
 .sp{ flex:1 }   /* pousse le pied de page en bas sans étirer le tableau */
 .brk{ page-break-before:always; }
 .hd{ display:flex; justify-content:space-between; align-items:flex-end;
      border-bottom:2px solid #005A50; padding-bottom:4px; margin-bottom:5px; flex-shrink:0 }
 .hd .tt{ font-size:${D.title}; font-weight:800; color:#005A50; letter-spacing:.02em }
 .hd .sui{ font-weight:400; font-size:9pt; color:#6b7a75 }
 .hd .id{ font-size:${D.ident}; margin-top:1px }
 .hd .sub{ font-size:8.5pt; color:#5a6a65; margin-top:2px }
 .hd .mois{ font-size:8.5pt; color:#5a6a65; border:1px solid #c8d8d3;
            padding:2px 8px; border-radius:3px; white-space:nowrap }
 .crb{ width:100%; height:${dens==="serre"?"22mm":"30mm"}; border:1px solid #c8d8d3;
       margin-bottom:4px; flex-shrink:0 }
 table{ width:100%; border-collapse:collapse; font-size:${D.font};
        table-layout:fixed }
 th{ border:1px solid #b8ccc6; background:#eef3f1; padding:3px 1px;
     font-size:${D.head}; font-weight:700; text-align:center;
     height:auto; line-height:1.15 }
 thead th, table > tr:first-child th{ height:6mm }
 th span{ display:block; font-weight:400; font-size:.8em; color:#5a6a65 }
 th.dl{ background:#fdf0e6 }
 /* Marque les colonnes composées à la main.
    ⚠️ C'EST UN REPÈRE D'ÉCRAN, PAS DE PAPIER — À MESURER. La teinte de la
    douleur est là depuis le début et personne n'a vérifié qu'elle
    sortait : le zébrage du
    tableau, lui, ne s'imprimait jamais (arrière-plans décochés par
    défaut, Chromium repeint la cellule en blanc opaque). Si ces fonds ne
    sortent pas non plus, ça ne coûte rien : sur le papier c'est le NOM de
    la colonne qui dit ce qu'elle est, pas sa teinte. Aucune information
    ne repose sur cette couleur. */
 th.perso{ background:#e9f4ef }
 tr.sub-h th{ background:#f5f8f7; font-weight:400; font-size:.85em }
 td{ border:1px solid #dde7e3; height:${D.row} }
 /* ══ PLUS DE ZÉBRAGE : UN FILET TOUS LES CINQ JOURS ══
    ⚠️ LE ZÉBRAGE NE S'IMPRIMAIT PAS, ET N'A JAMAIS DÛ S'IMPRIMER. C'est un
    fond (background), et l'option « imprimer les arrière-plans » est décochée
    par défaut : la feuille sortait avec 31 lignes toutes blanches. Il ne
    servait qu'à l'aperçu écran.
    ⚠️ PIRE, IL DÉCOUPAIT LE FILIGRANE. Mesuré en comptant la marque ligne
    par ligne dans la bande centrale : arrière-plans décochés, 10 210 pixels
    de cigale et **256 lignes sur 404 sans aucune trace** — la cigale
    sortait rayée, une bande par ligne paire. Arrière-plans cochés, ou
    zébrage retiré : 20 000 pixels et une cigale continue. Chromium repeint
    donc ces cellules en blanc OPAQUE, l'alpha du rgba n'y change rien.
    ⚠️ CE QUI LE REMPLACE S'IMPRIME TOUJOURS : un filet plus marqué tous les
    cinq jours. Un trait est une bordure, pas un fond — l'œil retrouve sa
    ligne, sur l'écran comme sur le papier. */
 td.jr{ text-align:center; color:#7a8a85; font-weight:600; font-size:.95em }
 /* ⚠️ 2 px, PAS 1,4 : en bordures fusionnées, à largeur égale c'est la
    cellule du HAUT qui gagne. Mesuré — la règle s'appliquait bien
    (couleur calculée rgb(174,198,191)), mais 1,4 px retombait à 1 px et le
    filet pâle de la ligne précédente l'emportait au tracé. */
 tr.g5 td{ border-top:2px solid #9ebdb5 }
 .pd{ border-top:1px solid #d8e3df; margin-top:4px; padding-top:3px;
      font-size:${pPt}pt; color:#3c4b46; flex-shrink:0; line-height:1.35;
      display:flex; align-items:flex-end; gap:10px }
 .pd .pd-t{ flex:1; white-space:pre-line }
${(typeof filigraneCss === "function") ? filigraneCss() : ""}
 .lg{ display:inline-block; border-bottom:1px solid #9bb0a9; min-width:58mm;
      height:1.15em; vertical-align:bottom }
 .lg.sm{ min-width:26mm }
 .verso-note{ text-align:right; font-size:7.5pt; color:#8a9a95; margin-top:2px; font-style:italic }
 @media screen{ html{ background:#e8eeec } body{ background:transparent; padding:10px }
   .pg{ background:#fff; padding:9mm 8mm; margin:0 auto 12px; max-width:210mm;
        box-shadow:0 2px 12px rgba(0,0,0,.15) } }
</style></head><body>${corps}</body></html>`;
}

/* ============================================================
   EXPORT DE L'HISTORIQUE DES CONSTANTES — courbes + tableau
============================================================ */

/* ══════════════════════════════════════════════════════════════
   LA PÉRIODE D'UN EXPORT — TROIS FAÇONS DE LA DIRE
   ──────────────────────────────────────────────────────────────
   ⚠️ IL N'Y AVAIT QUE DU GLISSANT : « 1 mois » voulait dire « les
   30 derniers jours ». Pour un classeur qu'on complète mois après
   mois, ça ne tombe jamais juste — imprimé le 3 novembre, on obtient
   du 4 octobre au 3 novembre ; le mois suivant rechevauche de deux
   jours, et sauter un mois laisse un trou que rien ne signale.

   ⚠️ UN MOIS CALENDAIRE NE SE RECOUVRE JAMAIS. C'est la seule forme
   qui se range sans réfléchir, et c'est le besoin énoncé : « pouvoir
   incrémenter le classeur papier du patient de manière mensuelle ».

   ⚠️ LE GLISSANT RESTE EN PREMIER : il répond à « montre-moi les
   trois derniers mois », qui est la question du chevet, pas celle du
   classeur. Les deux usages coexistent.
══════════════════════════════════════════════════════════════ */
const EXP_MODES = [["glisse","Glissant"],["mois","Mois"],["libre","Du… au…"]];
const MOIS_FR = ["janvier","février","mars","avril","mai","juin","juillet",
                 "août","septembre","octobre","novembre","décembre"];
/* ⚠️ PAS DE toISOString() POUR UNE DATE LOCALE : il convertit en UTC et
   recule d'un jour à l'est de Greenwich. Un export de janvier commencerait
   le 31 décembre. On compose la chaîne à la main. */
function _isoLocal(d){
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0")
       + "-" + String(d.getDate()).padStart(2,"0");
}
/* Les bornes d'une période, et comment elle s'écrit en haut du document. */
function periodeBornes(mode, e){
  if (mode === "mois"){
    const fin = new Date(e.an, e.mo + 1, 0);           // jour 0 du mois suivant
    return { debut:_isoLocal(new Date(e.an, e.mo, 1)), fin:_isoLocal(fin),
             lbl: MOIS_FR[e.mo] + " " + e.an,
             dernierJour: fin.getDate() };
  }
  if (mode === "libre"){
    const a = e.du <= e.au ? e.du : e.au, b = e.du <= e.au ? e.au : e.du;
    return { debut:a, fin:b, lbl:"du " + fmtFR(a) + " au " + fmtFR(b) };
  }
  const d = new Date(Date.now() - e.jours*864e5);
  return { debut:_isoLocal(d), fin:todayISO(),
           lbl: e.jours >= 365 ? "les 12 derniers mois"
              : e.jours >= 30  ? "les " + e.jours + " derniers jours"
              : "les " + e.jours + " derniers jours" };
}

/* `ecartees` : clés « date|heure » à retirer du document — choisies dans le
   tableau. ⚠️ ELLES NE SONT PAS SUPPRIMÉES : elles restent dans
   l'application et dans les courbes, elles ne figurent simplement pas sur
   la feuille qu'on imprime. Supprimer est un autre geste, et un autre
   bouton. */
function sheetExportConst(pid, ecartees){
  const p = getP(pid);
  if (!p) return;
  const _hors = new Set(ecartees || []);
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const auj = new Date();
  let mode = "glisse", fmt = "pdf", contenu = "deux";
  const etat = { jours:30, an:auj.getFullYear(), mo:auj.getMonth(),
                 du:_isoLocal(new Date(Date.now()-30*864e5)), au:todayISO() };

  const draw = () => {
    const per = periodeBornes(mode, etat);
    /* Même source que les courbes : les mesures archivées comptent. */
    const vs = mesuresDe(p).filter(v => v.date >= per.debut && v.date <= per.fin)
                           .filter(v => !_hors.has(v.date + "|" + (v.at||"")));

    /* Le mois en cours n'est pas fini : le dire plutôt que de laisser
       croire à un mois creux. */
    const moisEnCours = mode === "mois" &&
      etat.an === auj.getFullYear() && etat.mo === auj.getMonth();
    const suivantPossible = !(etat.an > auj.getFullYear() ||
      (etat.an === auj.getFullYear() && etat.mo >= auj.getMonth()));

    const corpsPeriode =
      mode === "mois" ? `
        <div class="exp-pas">
          <button data-mdec="1" aria-label="Mois précédent">‹</button>
          <div class="exp-pas-c">
            <div class="exp-pas-m">${esc(MOIS_FR[etat.mo].charAt(0).toUpperCase()+MOIS_FR[etat.mo].slice(1))} ${etat.an}</div>
            <div class="exp-pas-s">du 1ᵉʳ au ${per.dernierJour}</div>
          </div>
          <button data-minc="1" aria-label="Mois suivant" ${suivantPossible?"":"disabled"}>›</button>
        </div>`
    : mode === "libre" ? `
        <div class="exp-deux">
          <div><label>DU</label><input type="date" data-edu value="${esc(etat.du)}" max="${esc(todayISO())}"></div>
          <div><label>AU</label><input type="date" data-eau value="${esc(etat.au)}" max="${esc(todayISO())}"></div>
        </div>`
    : `<div class="chips">
          ${[[15,"15 jours"],[30,"1 mois"],[90,"3 mois"],[365,"1 an"]].map(([d,l])=>
            `<button class="chip ${etat.jours===d?"on":""}" data-fj="${d}">${l}</button>`).join("")}
       </div>`;

    openSheet(`
      ${/* ⚠️ L'écran d'où l'on vient s'appelle « Historique » depuis qu'il
            porte aussi les lectures en chiffres. Le bouton de retour disait
            encore « Courbes » : un retour qui nomme un écran qui n'existe
            plus sous ce nom. */ ""}
      ${navHeader("Historique", true)}
      <h3 style="margin-bottom:2px">📄 Exporter l'historique</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b></p>

      <div class="rowlab bl"><span>Période</span><i></i></div>
      <div class="rowbox bl" style="display:block;margin-bottom:12px">
        <div class="vseg" style="margin-bottom:10px">
          ${EXP_MODES.map(([m,l])=>
            `<button class="${mode===m?"on":""}" data-emode="${m}">${l}</button>`).join("")}
        </div>
        ${corpsPeriode}
        <p class="small muted" style="margin:10px 0 0">${vs.length} relevé(s) — ${esc(per.lbl)}.</p>
        ${moisEnCours ? `<p class="small" style="margin:8px 0 0;background:rgba(230,150,40,.14);
          border-left:3px solid var(--amber);border-radius:0 10px 10px 0;padding:7px 10px">
          📎 Le mois en cours n'est pas terminé.</p>` : ""}
      </div>

      <div class="rowlab vi"><span>Contenu</span><i></i><em>ce qui sera imprimé</em></div>
      <div class="chips" style="margin-bottom:14px">
        ${/* ⚠️ « 📈+▦ Les deux » passait sur deux lignes et déformait la
              rangée — mesuré sur 430 px de large. « Tout » dit la même
              chose en un mot. */ ""}
        ${[["deux","📈▦ Tout"],["courbes","📈 Courbes"],["tableau","▦ Tableau"]].map(([c,l])=>
          `<button class="chip ${contenu===c?"on":""}" data-ec="${c}" style="flex:1;justify-content:center">${l}</button>`).join("")}
      </div>

      <div class="rowlab vi"><span>Format</span><i></i></div>
      <div class="chips" style="margin-bottom:14px">
        <button class="chip ${fmt==="pdf" ?"on":""}" data-ff2="pdf"  style="flex:1;justify-content:center">📑 PDF</button>
        <button class="chip ${fmt==="html"?"on":""}" data-ff2="html" style="flex:1;justify-content:center">🌐 HTML</button>
        <button class="chip ${fmt==="txt" ?"on":""}" data-ff2="txt"  style="flex:1;justify-content:center">🗒️ Texte</button>
        ${/* ⚠️ Excel ne porte QUE le tableau : un classeur de courbes n'a pas
             de sens, on y retravaille des chiffres. Le choix de contenu
             reste affiché mais Excel l'ignore, et le dit. */ ""}
        <button class="chip ${fmt==="xlsx"?"on":""}" data-ff2="xlsx" style="flex:1;justify-content:center">📊 Excel</button>
      </div>
      ${fmt === "xlsx" ? `<p class="small muted" style="margin:-8px 0 12px">Le classeur contient le <b>tableau des relevés</b>, une ligne par passage — les courbes se retracent dans Excel.</p>` : ""}

      <button class="btn btn-primary" id="ec-go" style="width:100%" ${vs.length?"":"disabled"}>${
        !vs.length ? "Aucun relevé sur cette période"
                   : fmt==="pdf" ? "👁 Aperçu &amp; impression" : "📤 Exporter"}</button>`);

    bindNav(() => { closeSheet(); const b = document.querySelector(`[data-graph="${p.id}"]`); if (b) b.click(); });
    $$("#sheet [data-emode]").forEach(b => b.onclick = () => { mode = b.dataset.emode; draw(); });
    $$("#sheet [data-fj]").forEach(b => b.onclick = () => { etat.jours = +b.dataset.fj; draw(); });
    $$("#sheet [data-ec]").forEach(b => b.onclick = () => { contenu = b.dataset.ec; draw(); });
    $$("#sheet [data-ff2]").forEach(b => b.onclick = () => { fmt = b.dataset.ff2; draw(); });
    { const b = $("#sheet [data-mdec]"); if (b) b.onclick = () => {
        etat.mo--; if (etat.mo < 0){ etat.mo = 11; etat.an--; } draw(); }; }
    { const b = $("#sheet [data-minc]"); if (b && !b.disabled) b.onclick = () => {
        etat.mo++; if (etat.mo > 11){ etat.mo = 0; etat.an++; } draw(); }; }
    { const d = $("#sheet [data-edu]"); if (d) d.onchange = () => { etat.du = d.value; draw(); }; }
    { const d = $("#sheet [data-eau]"); if (d) d.onchange = () => { etat.au = d.value; draw(); }; }

    const go = $("#ec-go");
    if (go && vs.length) go.onclick = () => {
      const base = "Constantes_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" +
                   (mode === "mois" ? etat.an + "-" + String(etat.mo+1).padStart(2,"0") : todayISO());
      const o = { contenu, periodeLbl:per.lbl };
      if (fmt === "xlsx"){ constXlsx(p, vs, o, base); return; }
      if (fmt === "txt"){ shareText(constTexte(p, vs, null, o), base + ".txt", "text/plain"); return; }
      const html = constHtml(p, vs, null, o);
      if (fmt === "html"){ shareText(html, base + ".html", "text/html"); return; }
      showFichePreview(html, base);
    };
  };
  draw();
}

/* ---------- Document : courbes puis tableau ---------- */
function constHtml(p, vs, jours, opts){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  /* ⚠️ `opts` est arrivé APRÈS `jours` : les anciens appels passaient un
     nombre de jours glissants et rien d'autre. Les deux doivent marcher,
     sinon une suite qui appelle constHtml(p, vs, 30) casse sans raison. */
  const _o   = opts || {};
  const quoi = _o.contenu || "deux";
  const perLbl = _o.periodeLbl || ((jours||0) + " derniers jours");
  const th = p.thresholds || {};
  const sorted = [...vs].sort((a,b) => (a.date+a.at).localeCompare(b.date+b.at));

  const DEFS = [
    { key:"ta",   lbl:"Tension artérielle", unit:"cmHg", hi:th.taHigh||16, lo:th.taLow||9 },
    { key:"puls", lbl:"Pouls",              unit:"bpm",  hi:100,           lo:50 },
    { key:"sat",  lbl:"Saturation",         unit:"%",    hi:null,          lo:th.satLow||92 },
    { key:"temp", lbl:"Température",        unit:"°C",   hi:38,            lo:35.5 },
    { key:"glyc", lbl:"Glycémie",           unit:"g/L",  hi:2.5,           lo:th.glycLow||0.7 }
  ];
  const num = (v, k) => {
    if (v == null || v === "") return null;
    if (k === "ta") return taSysDia(v).sys;
    const n = parseFloat(String(v).replace(",",".")); return isNaN(n)?null:n;
  };
  const horsSeuil = (v, d) => {
    const n = num(v, d.key); if (n === null) return false;
    return (d.hi !== null && n >= d.hi) || (d.lo !== null && n <= d.lo);
  };

  // Courbes SVG
  let courbes = "";
  DEFS.forEach(d => {
    const pts = sorted.map(v => ({ n:num((v.consts||{})[d.key], d.key), date:v.date }))
                      .filter(x => x.n !== null);
    if (pts.length < 2) return;
    const W = 560, H = 90, PAD = 6;
    const vals = pts.map(x => x.n);
    let mn = Math.min(...vals), mx = Math.max(...vals);
    if (d.hi) mx = Math.max(mx, d.hi); if (d.lo) mn = Math.min(mn, d.lo);
    const span = (mx - mn) || 1;
    const X = i => PAD + i * (W - 2*PAD) / Math.max(pts.length-1, 1);
    const Y = n => H - PAD - ((n - mn) / span) * (H - 2*PAD);
    const line = pts.map((x,i) => `${X(i).toFixed(1)},${Y(x.n).toFixed(1)}`).join(" ");
    const seuils = [
      d.hi ? `<line x1="0" y1="${Y(d.hi).toFixed(1)}" x2="${W}" y2="${Y(d.hi).toFixed(1)}" stroke="#e8a0a0" stroke-width="1" stroke-dasharray="4 3"/>` : "",
      d.lo ? `<line x1="0" y1="${Y(d.lo).toFixed(1)}" x2="${W}" y2="${Y(d.lo).toFixed(1)}" stroke="#e8a0a0" stroke-width="1" stroke-dasharray="4 3"/>` : ""
    ].join("");
    const dots = pts.map((x,i) => horsSeuil((sorted.find(v=>v.date===x.date)||{}).consts?.[d.key], d)
      ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(x.n).toFixed(1)}" r="3" fill="#a01c1c"/>` : "").join("");
    courbes += `<div class="crb-b">
      <div class="crb-t">${d.lbl} <span>(${d.unit})</span></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${seuils}
        <polyline points="${line}" fill="none" stroke="#005A50" stroke-width="2"/>
        ${dots}
      </svg>
      <div class="crb-x"><span>${fmtFR(pts[0].date)}</span><span>${fmtFR(pts[pts.length-1].date)}</span></div>
    </div>`;
  });

  // Tableau
  const lignes = [...sorted].reverse().map(v => {
    const c = v.consts || {};
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
    const cell = d => {
      const val = c[d.key];
      if (val == null || val === "") return "<td>—</td>";
      return `<td class="${horsSeuil(val, d)?"bad":""}">${esc(String(val))}</td>`;
    };
    return `<tr><td class="dt">${fmtFR(v.date)}${sl} ${esc(v.at||"")}</td>${DEFS.map(cell).join("")}</tr>`;
  }).join("");

  // Synthèse
  const nHors = sorted.filter(v => DEFS.some(d => horsSeuil((v.consts||{})[d.key], d))).length;

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Constantes — ${esc(nom)}</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 header{background:#005A50;color:#fff;padding:9px 13px;margin-bottom:11px}
 header .t{font-size:12.5pt;font-weight:800}
 header .s{font-size:8.5pt;color:#a8ded2;margin-top:1px}
 .alert{background:#fdeaea;border-left:3px solid #a01c1c;padding:6px 10px;font-size:9.5pt;margin-bottom:10px}
 .crb-b{margin-bottom:9px;page-break-inside:avoid}
 .crb-t{font-size:8.5pt;color:#5a6a65;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px}
 .crb-t span{text-transform:none;letter-spacing:0}
 .crb-b svg{width:100%;height:22mm;background:#fafcfb;border:1px solid #e4ece9}
 .crb-x{display:flex;justify-content:space-between;font-size:7.5pt;color:#8a9a95;margin-top:1px}
 table{width:100%;border-collapse:collapse;font-size:9pt;margin-top:6px}
 th{background:#eef3f1;border:1px solid #c8d8d3;padding:4px 3px;font-size:8.5pt}
 td{border:1px solid #eef3f1;padding:3px;text-align:center}
 td.dt{text-align:left;color:#5a6a65;white-space:nowrap}
 td.bad{color:#a01c1c;font-weight:700}
 footer{margin-top:12px;padding-top:7px;border-top:1px solid #d8e3df;font-size:8pt;color:#8a9a95;
   display:flex;justify-content:space-between}
 @media screen{ body{background:#e8eeec;padding:12px}
   header{margin:-12px -12px 11px} }
</style></head><body>
<header>
  <div class="t">SURVEILLANCE DES CONSTANTES</div>
  <div class="s">${esc(nom)}${p.dob?` — née le ${p.dob.split("-").reverse().join("/")}`:""} · ${esc(perLbl)} · ${sorted.length} relevé(s)</div>
</header>
${nHors ? `<div class="alert"><b>${nHors} relevé(s) hors seuils</b> sur la période — repérés en rouge.</div>` : ""}
${quoi === "tableau" ? "" :
  (courbes || "<p style='color:#8a9a95;font-size:9.5pt'>Pas assez de relevés pour tracer une courbe.</p>")}
${quoi === "courbes" ? "" : `<table>
  <tr><th>Date</th>${DEFS.map(d=>`<th>${d.lbl.split(" ")[0]}</th>`).join("")}</tr>
  ${lignes || `<tr><td colspan="6" style="color:#8a9a95;padding:10px">Aucun relevé sur la période.</td></tr>`}
</table>`}
<footer>
  <span>${S.identity ? esc(whoami()) + ", IDEL" : "IDEL"} — édité le ${todayISO().split("-").reverse().join("/")}</span>
  <span>Document confidentiel — données de santé</span>
</footer>
</body></html>`;
}

/* ---------- Version texte ---------- */
function constTexte(p, vs, jours, opts){
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const perLbl = (opts && opts.periodeLbl) || ((jours||0) + " derniers jours");
  const L = "──────────────────────────────";
  let o = "SURVEILLANCE DES CONSTANTES\n" + nom + "\n" + perLbl + " · " + vs.length + " relevé(s)\n" + L + "\n";
  [...vs].sort((a,b)=>(b.date+b.at).localeCompare(a.date+a.at)).forEach(v => {
    const parts = constParts(v.consts);
    if (!parts.length) return;
    const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
    o += fmtFR(v.date) + sl + " " + (v.at||"") + " — " + parts.join(" · ") + "\n";
  });
  o += L + "\nÉdité le " + todayISO().split("-").reverse().join("/") +
       (S.identity ? " par " + whoami() : "") + "\nDocument confidentiel — données de santé.\n";
  return o;
}

/* ══════════════════════════════════════════════════════════════
   LE TABLEAU DES RELEVÉS EN CLASSEUR
   ──────────────────────────────────────────────────────────────
   ⚠️ POURQUOI PAS LES COURBES. Un classeur sert à retravailler des
   chiffres — trier, filtrer, calculer une moyenne, coller dans un
   courrier. Les courbes s'y retracent en deux gestes à partir des
   colonnes ; les embarquer en image aurait donné un classeur lourd
   dont on ne peut rien faire.

   ⚠️ UNE COLONNE PAR CONSTANTE, et les tensions séparées en
   systolique et diastolique : « 13/8 » dans une cellule est du
   texte, dont Excel ne sait tirer ni moyenne ni courbe. C'est tout
   l'intérêt du format par rapport au PDF.

   ⚠️ LES VALEURS HORS SEUIL SONT MARQUÉES, pas interprétées — même
   règle que partout : l'application fait ressortir, elle ne conclut
   pas. ══════════════════════════════════════════════════════════ */
async function constXlsx(p, vs, opts, base){
  let XL;
  toast("Préparation du classeur…");
  try { XL = await xlsCharger(); }
  catch(e){ toast("Bibliothèque introuvable", "danger"); return; }

  const th = p.thresholds || {};
  const COLS = [
    { k:"ta_s", lbl:"TA systolique",  u:"cmHg", hi:th.taHigh||16, lo:th.taLow||9 },
    { k:"ta_d", lbl:"TA diastolique", u:"cmHg", hi:null, lo:null },
    { k:"puls", lbl:"Pouls",          u:"bpm",  hi:100, lo:50 },
    { k:"sat",  lbl:"Saturation",     u:"%",    hi:null, lo:th.satLow||92 },
    { k:"temp", lbl:"Température",    u:"°C",   hi:38,  lo:35.5 },
    { k:"glyc", lbl:"Glycémie",       u:"g/L",  hi:2.5, lo:th.glycLow||0.7 },
    { k:"douleur", lbl:"Douleur",     u:"/10",  hi:6,   lo:null },
  ];
  const val = (v, k) => {
    const c = v.consts || {};
    if (k === "ta_s" || k === "ta_d"){
      if (!c.ta) return null;
      const m = String(c.ta).match(k === "ta_s" ? /^(\d+)/ : /\/(\d+)/);
      return m ? +m[1] : null;
    }
    if (c[k] === undefined || c[k] === "") return null;
    const n = parseFloat(String(c[k]).replace(",", "."));
    return isNaN(n) ? null : n;
  };
  /* On ne garde que les colonnes qui ont au moins une valeur : un classeur
     plein de colonnes vides se trie mal et s'imprime encore plus mal. */
  const sorted = [...vs].sort((a,b) => (a.date+a.at).localeCompare(b.date+b.at));
  const cols = COLS.filter(c => sorted.some(v => val(v, c.k) !== null));

  const wb = new XL.Workbook();
  wb.creator = "JM@Santé"; wb.created = new Date();
  const ws = wb.addWorksheet("Relevés");
  const ACCENT = "FF1D9E75", DOUX = "FFF2F8F6";

  ws.columns = [{ width:12 }, { width:7 }].concat(cols.map(() => ({ width:15 })));

  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  ws.getCell("A1").value = "Surveillance des constantes — " + nom;
  ws.getCell("A1").font = { bold:true, size:14 };
  ws.getCell("A2").value = (opts && opts.periodeLbl ? "Période : " + opts.periodeLbl + " · " : "")
                         + sorted.length + " relevé(s) · édité le " + fmtFR(todayISO());
  ws.getCell("A2").font = { size:10, color:{ argb:"FF55635E" } };
  ws.getCell("A3").value = "Données de santé — document confidentiel.";
  ws.getCell("A3").font = { size:9, italic:true, color:{ argb:"FF55635E" } };

  const LIG = 5;
  ws.getRow(LIG).values = ["Date", "Heure"].concat(cols.map(c => c.lbl + " (" + c.u + ")"));
  ws.getRow(LIG).eachCell(c => {
    c.font = { bold:true, color:{ argb:"FFFFFFFF" }, size:11 };
    c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:ACCENT } };
    c.alignment = { vertical:"middle", wrapText:true };
  });
  ws.getRow(LIG).height = 26;
  /* L'en-tête reste visible quand on fait défiler un an de relevés. */
  ws.views = [{ state:"frozen", ySplit:LIG }];

  sorted.forEach((v, i) => {
    const r = ws.getRow(LIG + 1 + i);
    /* ⚠️ Une vraie date, pas une chaîne : sans cela Excel trie « 10 oct. »
       avant « 9 oct. » et aucun graphique ne se trace. */
    r.getCell(1).value = new Date(v.date + "T12:00:00");
    r.getCell(1).numFmt = "dd/mm/yyyy";
    r.getCell(2).value = v.at || "";
    cols.forEach((c, j) => {
      const n = val(v, c.k);
      const cell = r.getCell(3 + j);
      if (n === null){ cell.value = null; return; }
      cell.value = n;
      const hors = (c.hi !== null && n >= c.hi) || (c.lo !== null && n <= c.lo);
      if (hors) cell.font = { bold:true, color:{ argb:"FFA8342A" } };
    });
    if (i % 2) r.eachCell(c => { if (!c.fill || !c.fill.fgColor)
      c.fill = { type:"pattern", pattern:"solid", fgColor:{ argb:DOUX } }; });
  });
  ws.autoFilter = { from:{ row:LIG, column:1 }, to:{ row:LIG, column:2 + cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  await cabLivrer((base || "Constantes") + ".xlsx",
    buf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}


/* ============================================================
   DOCUMENTS VIERGES — ce que l'app sait imprimer sans dossier
   ──────────────────────────────────────────────────────────
   ⚠️ IL FALLAIT OUVRIR UN PATIENT POUR SORTIR UNE FEUILLE. Les
   feuilles de domicile, les modèles, le courrier, l'ordonnance :
   tout partait d'une fiche. Or une feuille vierge sert justement
   quand il n'y a pas encore de fiche — pour en avoir d'avance dans
   la sacoche, ou pour quelqu'un qui n'est pas dans l'application.
   Demandé ainsi : « intégrer l'ensemble des feuilles et documents
   que l'app peut générer dans la section mes outils ».

   ⚠️ SEULEMENT CE QUI SERT EN VIERGE : « la relève vierge ne sert
   pas ». Une relève sans patients est une page blanche ; l'export
   des constantes sans historique n'existe pas. Ils ne sont pas ici.

   ⚠️ CE N'EST PAS UN SECOND CHEMIN : chaque entrée ouvre l'écran
   qui existe déjà, avec un dossier vide. On ne maintient pas deux
   versions d'une même feuille.
============================================================ */
function sheetDocsVierges(){
  const ess = k => (typeof essaiActif === "function") && essaiActif(k);
  const DOCS = [
    ["c",  "📊", "Feuille de constantes", "TA · pouls · T° · sat · douleur — grille du mois", true],
    ["p",  "⚖️", "Feuille de poids",      "date libre · écart · courbe", true],
    ["g",  "🩸", "Feuille de glycémies",  "matin · midi · soir + insuline", true],
    ["crr","✉️", "Courrier",              "à l'en-tête de ton cabinet", typeof sheetCourrier === "function"],
    ["ord","📝", "Ordonnance",            "vierge, à ta signature", typeof sheetOrdonnance === "function"],
    ["mod","📄", "Mes modèles",           "tes documents types, à imprimer d'avance",
      ess("documents") && typeof sheetModeles === "function"],
    ["dsp","🩹", "Ordonnance de matériel", "depuis ton catalogue de dispositifs",
      ess("dispositifs") && typeof sheetOrdoDispo === "function"]
  ].filter(d => d[4]);

  openSheet(`
    ${navHeader("Réglages", true)}
    <h3 style="margin-bottom:2px">🖨️ Documents vierges</h3>
    <p class="small muted" style="margin-bottom:14px">À imprimer d'avance, sans ouvrir de dossier. Depuis une fiche patient, les mêmes documents sortent déjà remplis.</p>
    <div class="srcgrid" style="grid-template-columns:1fr">
      ${DOCS.map(([k,ic,lbl,sub]) => `
        <button class="srcbtn" data-dv="${k}" style="flex-direction:row;align-items:center;gap:11px;text-align:left;padding:11px 13px">
          <span class="src-ic" style="margin:0">${ic}</span>
          <span style="flex:1;display:flex;flex-direction:column">
            <span class="src-lbl">${lbl}</span>
            <span class="src-sub">${sub}</span>
          </span>
          <span style="color:var(--dim);font-size:15px">›</span>
        </button>`).join("")}
    </div>
    <p class="small muted" style="margin-top:14px">La mention de bas de page et sa taille se règlent sur l'écran de la feuille — elles sont communes aux trois feuilles de domicile.</p>

    <div class="rowlab am" style="margin-top:18px"><span>🦗 Le filigrane</span><i></i></div>
    <div class="rowbox am" style="display:block">
      <p class="small" style="margin:0 0 8px">La cigale et « ${esc(FILI_TXT)} » en fond de page.
        <b>Toujours présente sur les trois feuilles de domicile</b> — c'est ce qui les identifie
        quand elles traînent sur un frigo pendant un mois.</p>
      <div class="chips">
        <button class="chip ${filigraneDocsActif()?"on":""}"  data-fdoc="1" style="flex:1;justify-content:center">Sur les autres documents</button>
        <button class="chip ${filigraneDocsActif()?"":"on"}" data-fdoc="0" style="flex:1;justify-content:center">Feuilles seulement</button>
      </div>
      <p class="small muted" style="margin:8px 0 0">Relève, DLU, recueil, courrier, ordonnance, modèles, export des constantes.
        <b>Ce n'est pas une marque de sécurité</b> : elle n'authentifie rien et ne prouve rien.
        Sur une ordonnance, elle peut être prise pour autre chose qu'une signature visuelle — à toi de voir.</p>
    </div>`);

  $$("#sheet [data-fdoc]").forEach(b => b.onclick = () => {
    S.filigraneDocs = (b.dataset.fdoc === "1");
    if (typeof logChange === "function") logChange("update","reglage","filigraneDocs",{ v:S.filigraneDocs });
    save(); sheetDocsVierges();
  });
  bindNav(sheetTours);
  $$("#sheet [data-dv]").forEach(b => b.onclick = () => {
    switch(b.dataset.dv){
      case "c":   sheetFeuilles(null, "constantes"); break;
      case "p":   sheetFeuilles(null, "poids");      break;
      case "g":   sheetFeuilles(null, "glycemies");  break;
      case "crr": sheetCourrier({}); break;
      case "ord": sheetOrdonnance(null); break;
      case "mod": sheetModeles(null); break;
      case "dsp": sheetOrdoDispo(null); break;
    }
  });
}
