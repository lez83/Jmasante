/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   FICHE DE RECUEIL
   ─────────────────────────────────────────────────────────
   Chez le patient, naviguer entre les onglets Identité, Infos,
   Contacts fait perdre du temps et oublier des champs. Cette
   fiche présente TOUT à la suite, dans l'ordre où on pose les
   questions.

   ⚠️ Ce n'est PAS un document séparé : c'est une autre VUE du
   dossier. Écrire ici écrit dans le dossier, et inversement.
   Aucune copie, donc aucun risque de divergence.

   Les informations libres (p.infos) sont regroupées par type
   dans un champ unique, séparées par « · ». Relire ce champ
   réécrit UNE information de ce type.
============================================================ */

const RECUEIL_SECTIONS = [
  { cle:"identite", lbl:"Identité", ic:"👤", col:"vi" },
  { cle:"domicile", lbl:"Domicile et téléphone", ic:"🏠", col:"ac" },
  { cle:"acces",    lbl:"Accès au domicile", ic:"🔑", col:"ac" },
  { cle:"prevenir", lbl:"Qui prévenir", ic:"📞", col:"am" },
  { cle:"pros",     lbl:"Professionnels de santé", ic:"🩺", col:"vi" },
  { cle:"savoir",   lbl:"Ce qu'il faut savoir", ic:"⚠️", col:"am" },
  { cle:"quotidien",lbl:"Au quotidien", ic:"🧩", col:"ac" },
];

/* Regrouper les informations d'un type en une seule ligne lisible */
function recueilInfo(p, type){
  return (p.infos||[]).filter(i => i.type === type && (i.txt||"").trim())
    .map(i => i.txt.trim()).join(" · ");
}

/* Réécrire les informations d'un type depuis le champ groupé.
   ⚠️ On conserve la visibilité en relève de la PREMIÈRE information
   existante : sinon un simple passage dans la fiche ferait
   disparaître une vigilance de la relève. */
function recueilSetInfo(p, type, txt){
  p.infos = p.infos || [];
  const anciennes = p.infos.filter(i => i.type === type);
  const show = anciennes.length ? !!anciennes[0].show
                                : (type === "acces" || type === "vigilance");
  p.infos = p.infos.filter(i => i.type !== type);
  const t = String(txt||"").trim();
  if (t) p.infos.push({ id:uid(), type, txt:t, show });
}

/* Même principe pour une SOUS-RUBRIQUE d'« Autre ».
   Les lignes sont conservées (le catalogue écrit une ligne par phrase).
   ⚠️ Hors relève par défaut : ce sont des notes de fiche. */
function recueilInfoRub(p, rub){
  return (p.infos||[]).filter(i => i.type === "autre" && (i.rub||"libre") === rub && (i.txt||"").trim())
    .map(i => i.txt.trim()).join("\n");
}
function recueilSetRub(p, rub, txt){
  p.infos = p.infos || [];
  const est = i => i.type === "autre" && (i.rub||"libre") === rub;
  const anciennes = p.infos.filter(est);
  const show = anciennes.length ? !!anciennes[0].show : false;
  p.infos = p.infos.filter(i => !est(i));
  const t = String(txt||"").trim();
  if (t) p.infos.push({ id:uid(), type:"autre", rub, txt:t, show });
}

/* Combien de champs sont renseignés — pour la barre d'avancement */
function recueilAvance(p){
  const v = [
    p.nom, p.prenom, p.dob, p.genre,
    p.address, p.cp, p.ville,
    (p.tel||{}).fixe, (p.tel||{}).mobile,
    recueilInfo(p,"acces"),
    (aPrevenir(p)[0]||{}).nom, (aPrevenir(p)[0]||{}).tel,
    (medecinTraitant(p)||{}).nom, (medecinTraitant(p)||{}).tel,
    ((p.contacts||{}).pharma||{}).nom, ((p.contacts||{}).pharma||{}).tel,
    recueilInfo(p,"vigilance"), recueilInfo(p,"atcd"),
    recueilInfo(p,"entourage"), recueilInfo(p,"autre"),
    p.nir,
  ];
  const remplis = v.filter(x => String(x||"").trim()).length;
  return { remplis, total: v.length };
}

function sheetRecueil(pid){
  const p = getP(pid);
  if (!p){ toast("Dossier introuvable"); return; }
  p.medecins  = nettoyerContacts(medecinsDe(p));
  p.entourage = nettoyerContacts(entourageDe(p));
  const av = recueilAvance(p);
  const pct = Math.round(av.remplis / av.total * 100);
  const c  = (k, sub) => ((p.contacts||{})[k]||{})[sub] || "";

  const champ = (id, lbl, val, ph, large) => `
    <div style="flex:${large?2:1};min-width:0">
      <div class="rec-lab">${lbl}</div>
      <input class="rec-in" id="${id}" value="${esc(val||"")}" placeholder="${esc(ph||"")}">
    </div>`;

  const sect = (s, corps, etat) => `
    <div class="rowlab ${s.col}" style="margin-top:13px">
      <span>${s.ic} ${s.lbl}</span><i></i><em>${etat||""}</em></div>
    <div class="rowbox ${s.col}" style="display:block">${corps}</div>`;

  const manque = (...vals) => {
    const n = vals.filter(x => !String(x||"").trim()).length;
    return n ? n + " à compléter" : "✓";
  };

  openSheet(`
    ${navHeader("Fiche", true)}
    <h3>📋 Fiche de recueil</h3>
    <p class="small muted" style="margin-bottom:4px">${esc(p.prenom)} ${esc(p.nom.replace("Demo-",""))} — tout à la suite, pour ne rien oublier chez le patient.</p>
    <div class="rec-bar"><i style="width:${pct}%"></i></div>
    <p class="small muted" style="text-align:right;margin:3px 0 0">${av.remplis} champ${av.remplis>1?"s":""} sur ${av.total}</p>

    ${sect(RECUEIL_SECTIONS[0], `
      <div class="rowb">${champ("rc-nom","NOM",p.nom.replace("Demo-",""),"en majuscules")}${champ("rc-prenom","PRÉNOM",p.prenom,"")}</div>
      <div class="rowb" style="margin-top:6px">${champ("rc-dob","NÉ(E) LE",p.dob,"AAAA-MM-JJ")}
        <div style="flex:1;min-width:0"><div class="rec-lab">GENRE</div>
          <div class="rowb" style="gap:4px">
            <!-- ⚠️ Les valeurs doivent être IDENTIQUES à celles de la fiche
                 patient (M / F / Autre) : un "H" n'y serait jamais reconnu. -->
            <button class="chip ${p.genre==="F"?"on":""}" data-rcg="F" style="flex:1">F</button>
            <button class="chip ${p.genre==="M"?"on":""}" data-rcg="M" style="flex:1">M</button>
            <button class="chip ${p.genre==="Autre"?"on":""}" data-rcg="Autre" style="flex:1">Autre</button>
          </div></div></div>
      <div style="margin-top:6px">${champ("rc-nir","N° SÉCURITÉ SOCIALE",p.nir,"facultatif",true)}</div>`,
      manque(p.nom,p.prenom,p.dob,p.genre))}

    ${sect(RECUEIL_SECTIONS[1], `
      ${champ("rc-addr","ADRESSE",p.address,"n° et rue",true)}
      <div class="rowb" style="margin-top:6px">${champ("rc-cp","CODE POSTAL",p.cp,"")}${champ("rc-ville","VILLE",p.ville,"",true)}</div>
      <div class="rowb" style="margin-top:6px">${champ("rc-tfixe","TÉLÉPHONE FIXE",(p.tel||{}).fixe,"")}${champ("rc-tmob","PORTABLE",(p.tel||{}).mobile,"")}</div>`,
      manque(p.address,p.cp,p.ville))}

    ${sect(RECUEIL_SECTIONS[2], `
      <div class="rec-lab">CODE PORTAIL, ÉTAGE, CLÉ, ANIMAL…</div>
      <textarea class="rec-in" id="rc-acces" rows="3"
        placeholder="Code portail 1234 · 2ᵉ étage sans ascenseur · chien">${esc(recueilInfo(p,"acces"))}</textarea>
      <p class="small muted" style="margin:5px 0 0;font-size:9.5px">Sépare les éléments par « · ». Cette information figure sur la relève.</p>`,
      manque(recueilInfo(p,"acces")))}

    ${sect(RECUEIL_SECTIONS[3], `
      ${listeContactsHTML("ent", entourageDe(p))}
      <div style="margin-top:8px">
        <div class="rec-lab">ENTOURAGE, AIDES, PRÉSENCES</div>
        <textarea class="rec-in" id="rc-entourage" rows="2"
          placeholder="Fille présente le week-end · aide à domicile le matin">${esc(recueilInfo(p,"entourage"))}</textarea>
      </div>`,
      manque(...(aPrevenir(p)[0] ? [aPrevenir(p)[0].nom, aPrevenir(p)[0].tel] : ["",""])))}

    ${sect(RECUEIL_SECTIONS[4], `
      <div class="rec-lab">MÉDECINS</div>
      ${listeContactsHTML("med", medecinsDe(p))}
      <div class="rowb" style="margin-top:10px">${champ("rc-phnom","PHARMACIE",c("pharma","nom"),"",true)}${champ("rc-phtel","TÉL",c("pharma","tel"),"")}</div>`,
      manque((medecinTraitant(p)||{}).nom,(medecinTraitant(p)||{}).tel,c("pharma","nom")))}

    ${sect(RECUEIL_SECTIONS[5], `
      <div class="rowb" style="align-items:center"><div class="rec-lab" style="flex:1;margin:0">ALLERGIES, VIGILANCES</div>
        <button class="chip sm rc-cat" data-rccatx="vigilance">📚 Catalogue</button></div>
      <textarea class="rec-in" id="rc-vigilance" rows="2"
        placeholder="Allergie pénicilline · risque de chute">${esc(recueilInfo(p,"vigilance"))}</textarea>
      <div class="rowb" style="align-items:center;margin-top:8px"><div class="rec-lab" style="flex:1;margin:0">MALADIES SUIVIES, ANTÉCÉDENTS</div>
        <button class="chip sm rc-cat" data-rccatx="atcd">📚 Catalogue</button>
        <button class="chip sm rc-cat" id="rc-lire" style="margin-left:4px">📄 Lire un doc</button></div>
      <textarea class="rec-in" id="rc-atcd" rows="2"
        placeholder="HTA · insuffisance cardiaque · PTH droite 2019">${esc(recueilInfo(p,"atcd"))}</textarea>
      ${blocOrdos(p, "atcd")}`,
      manque(recueilInfo(p,"vigilance")))}

    ${sect(RECUEIL_SECTIONS[6], autreRubs().map(r => `
      <div class="rowb" style="align-items:center;margin-top:8px">
        <div class="rec-lab" style="flex:1;margin:0">${esc(r.ic)} ${esc(r.lbl.toUpperCase())}</div>
        ${(r.cat || r.cle === "appareillage") ? `<button class="chip sm rc-cat" data-rccat="${esc(r.cle)}">📚 Catalogue</button>` : ""}
      </div>
      <textarea class="rec-in" data-rcrub="${esc(r.cle)}" rows="${r.cat?3:2}"
        placeholder="${esc(r.ph||"")}">${esc(recueilInfoRub(p, r.cle))}</textarea>`).join(""),
      "")}

    <div class="rowb" style="margin-top:16px;gap:8px">
      <button class="btn btn-ghost" id="rc-print" style="flex:1">🖨 Imprimer remplie</button>
      <button class="btn btn-ghost" id="rc-vierge" style="flex:1">📄 Fiche vierge</button>
    </div>
    <p class="small muted" style="margin-top:8px">Ce que tu saisis ici est enregistré <b>directement dans le dossier</b> — l'onglet Infos et le DLU le reprennent aussitôt.</p>`);

  /* Enregistrement au fil de la saisie : pas de bouton à valider,
     l'IDEL est chez le patient et peut être interrompu. */
  bindNav(() => sheetPatient(p));   // « Fiche » en haut à gauche
  const lie = (id, poser) => {
    const e = $("#" + id); if (!e) return;
    e.onchange = () => { poser(e.value.trim()); save(true); maj(); };
  };
  const setC = (k, sub, v) => {
    p.contacts = p.contacts || {};
    p.contacts[k] = p.contacts[k] || {};
    p.contacts[k][sub] = v;
  };
  const maj = () => {
    const a = recueilAvance(p);
    const b = $(".rec-bar i"); if (b) b.style.width = Math.round(a.remplis/a.total*100) + "%";
  };

  lie("rc-nom",    v => p.nom = v.toUpperCase());
  lie("rc-prenom", v => p.prenom = v);
  lie("rc-dob",    v => p.dob = v);
  lie("rc-nir",    v => p.nir = v);
  lie("rc-addr",   v => p.address = v);
  lie("rc-cp",     v => p.cp = v);
  lie("rc-ville",  v => p.ville = v);
  lie("rc-tfixe",  v => { p.tel = p.tel||{}; p.tel.fixe = v; });
  lie("rc-tmob",   v => { p.tel = p.tel||{}; p.tel.mobile = v; });
  /* Listes : enregistrées à chaque modification, miroir vers les
     anciens champs pour la synchro avec une version antérieure. */
  const surListe = () => { majContactsLegacy(p); save(true); maj(); };
  lierOrdos(p, "atcd", () => sheetRecueil(p.id));
  lierListeContacts($("#sheet"), "ent", entourageDe(p), surListe);
  lierListeContacts($("#sheet"), "med", medecinsDe(p),  surListe);
  lie("rc-phnom",  v => setC("pharma","nom",v));
  lie("rc-phtel",  v => setC("pharma","tel",v));
  lie("rc-acces",     v => recueilSetInfo(p,"acces",v));
  lie("rc-entourage", v => recueilSetInfo(p,"entourage",v));
  lie("rc-vigilance", v => recueilSetInfo(p,"vigilance",v));
  lie("rc-atcd",      v => recueilSetInfo(p,"atcd",v));
  $$("#sheet [data-rcrub]").forEach(e => {
    e.onchange = () => { recueilSetRub(p, e.dataset.rcrub, e.value.trim()); save(true); maj(); };
  });
  /* Le catalogue ajoute ses lignes à la suite, et enregistre aussitôt */
  /* Ajoute une ligne au champ, avec le séparateur du catalogue */
  const ajouterA = (ta, ligne, sep, ecrire) => {
    const v = ta.value.trim();
    ta.value = v ? v + sep + ligne : ligne;
    if (sep === "\n") ta.rows = Math.min(10, Math.max(3, ta.value.split("\n").length + 1));
    ecrire(ta.value); save(true); maj();
  };
  $$("#sheet [data-rccat]").forEach(b => b.onclick = () => {
    const rub = b.dataset.rccat, k = rub === "appareillage" ? "appareillage" : "autonomie";
    const ta = $(`#sheet [data-rcrub="${rub}"]`); if (!ta) return;
    ouvrirCatalogue(k, { onAdd: l => ajouterA(ta, l, CATS[k].sep, v => recueilSetRub(p, rub, v)) });
  });
  /* Allergies → seulement la section allergies ; antécédents → tout le reste */
  { const b = $("#rc-lire"); if (b) b.onclick = () => sheetLireDoc(p.id, () => sheetRecueil(p.id)); }
  $$("#sheet [data-rccatx]").forEach(b => b.onclick = () => {
    const vig = b.dataset.rccatx === "vigilance";
    const ta = $(vig ? "#rc-vigilance" : "#rc-atcd"); if (!ta) return;
    ouvrirCatalogue("atcd", {
      titre: vig ? "Allergies & intolérances" : "Antécédents",
      filtre: sec => vig ? sec.dest === "vigilance" : sec.dest !== "vigilance",
      nouvelle: vig ? { dest:"vigilance" } : {},
      onAdd: l => ajouterA(ta, l, " · ", v => recueilSetInfo(p, vig ? "vigilance" : "atcd", v)) });
  });

  $$("#sheet [data-rcg]").forEach(b => b.onclick = () => {
    p.genre = b.dataset.rcg; save(true); sheetRecueil(pid);
  });
  { const b = $("#rc-print");  if (b) b.onclick = () => imprimerRecueil(p, false); }
  { const b = $("#rc-vierge"); if (b) b.onclick = () => imprimerRecueil(p, true); }
}

/* ============================================================
   IMPRESSION
   ─────────────────────────────────────────────────────────
   Deux documents très différents :
   · REMPLIE — une page dense, lue par un remplaçant qui ne
     connaît pas le patient. Les blocs rouges attirent l'œil
     sur ce qui compte quand ça presse.
   · VIERGE — trois pages avec de vraies lignes d'écriture,
     pour que le patient ou sa famille la remplisse à la main.
============================================================ */
function imprimerRecueil(p, vierge){
  const c   = (k,s) => ((p.contacts||{})[k]||{})[s] || "";
  const nom = (p.nom||"").replace("Demo-","");
  const ans = p.dob ? ageOf(p.dob) : "";
  const inf = t => recueilInfo(p, t);
  const ou  = (v, d) => String(v||"").trim() || (d || "—");

  const CSS = `
    @page{ size:A4; margin:11mm 12mm; }
    *{ box-sizing:border-box; }
    body{ font-family:-apple-system,'Segoe UI',Roboto,sans-serif;
          color:#1a1a1a; font-size:9.5pt; line-height:1.5; margin:0; }
    h1{ font-size:15pt; margin:0; }
    .sub{ font-size:8pt; color:#666; }
    .hd{ display:flex; justify-content:space-between; align-items:flex-start;
         border-bottom:2px solid #0E8F94; padding-bottom:6px; margin-bottom:9px; }
    .mk{ font-size:7.5pt; color:#0E8F94; font-weight:700; text-align:right; }
    .lab{ font-size:7pt; font-weight:800; color:#0E8F94; letter-spacing:.05em;
          border-bottom:1px solid #D8E3DF; margin-bottom:3px; }
    .duo{ display:grid; grid-template-columns:1fr 1fr; gap:9px; margin-bottom:8px; }
    .urg{ background:#FDF3F2; border-left:3px solid #C4574A; padding:7px 9px; margin-bottom:8px; }
    .urg .lab{ color:#C4574A; border-color:#F0D5D2; }
    .ft{ border-top:1px solid #ddd; margin-top:9px; padding-top:5px;
         font-size:6.5pt; color:#888; text-align:center; }
    /* Fiche vierge : de vraies lignes pour écrire */
    .li{ border-bottom:1px dotted #999; display:inline-block; min-width:60px; }
    .rw{ margin-bottom:11px; }
    .cases{ display:flex; gap:2px; margin-top:2px; }
    .cases i{ width:15px; height:19px; border:1px solid #bbb; border-radius:2px; display:block; }
    .note{ background:#F0F7F6; border-left:3px solid #0E8F94; padding:6px 9px;
           font-size:8pt; color:#333; margin-bottom:10px; }
    .pb{ page-break-before:always; }`;

  if (!vierge){
    /* ── Version remplie : une page ── */
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
      <title>Fiche_${esc(nom)}</title><style>${CSS}</style></head><body>
      <div class="hd">
        <div><h1>${esc(nom.toUpperCase())} ${esc(p.prenom||"")}</h1>
          <div class="sub">${ans ? ans + " ans · " : ""}${p.dob ? "né(e) le " + p.dob.split("-").reverse().join("/") : ""}</div></div>
        <div class="mk">JM@Santé<div style="color:#888;font-weight:400">maj ${todayISO().split("-").reverse().join("/")}</div></div>
      </div>
      <div class="duo">
        <div><div class="lab">DOMICILE</div>
          ${esc(ou(p.address))}<br>${esc(ou(p.cp,""))} ${esc(ou(p.ville,""))}<br>
          <b>Fixe</b> ${esc(ou((p.tel||{}).fixe))}<br>
          <b>Mobile</b> ${esc(ou((p.tel||{}).mobile))}</div>
        <div><div class="lab">ACCÈS</div>${esc(ou(inf("acces"), "non renseigné"))}</div>
      </div>
      <div class="urg"><div class="lab">EN CAS DE BESOIN</div>
        ${aPrevenir(p).length ? aPrevenir(p).map(e => `<b>${esc(e.nom)}</b>${e.lien?" ("+esc(e.lien.toLowerCase())+")":""} — ${esc(ou(e.tel))}`).join("<br>") : "—"}<br>
        ${personnesConfiance(p).length ? "Personne de confiance : " + personnesConfiance(p).map(e => esc(e.nom)).join(", ") + "<br>" : ""}
        ${esc(ou(inf("entourage"), ""))}</div>
      <div class="duo">
        <div><div class="lab">PROFESSIONNELS</div>
          ${medecinsDe(p).filter(m => m.nom||m.tel).length
            ? medecinsDe(p).filter(m => m.nom||m.tel).map(m => `<b>${esc(medLabel(m))}</b> ${esc(ou(m.nom))}<br>&nbsp;&nbsp;${esc(ou(m.tel))}`).join("<br>")
            : "<b>Médecin</b> —"}<br>
          <b>Pharmacie</b> ${esc(ou(c("pharma","nom")))}<br>&nbsp;&nbsp;${esc(ou(c("pharma","tel")))}</div>
        <div><div class="lab">AU QUOTIDIEN</div>${(() => {
          const l = autreRubs().map(r => ({ r, t:recueilInfoRub(p, r.cle) })).filter(x => x.t);
          return l.length ? l.map(x => `<b>${esc(x.r.lbl)}</b> ${esc(x.t).replace(/\n/g,"<br>")}`).join("<br>")
                          : "non renseigné";
        })()}</div>
      </div>
      <div class="urg"><div class="lab">À SAVOIR</div>
        <b>Vigilance</b> ${esc(ou(inf("vigilance"), "rien de signalé"))}<br>
        <b>Antécédents</b> ${esc(ou(inf("atcd")))}</div>
      <div class="ft">Document de soins — à conserver dans le classeur du domicile · confidentiel</div>
      </body></html>`;
    imprimerDocument(html, "Fiche_" + nom.replace(/\s+/g,"_"));
    return;
  }

  /* ── Version vierge : trois pages, de la place pour écrire ── */
  const cases = n => `<div class="cases">${"<i></i>".repeat(n)}</div>`;
  const ligne = (l, n) => `<div class="rw">${l}<br><span class="li" style="width:${n||100}%">&nbsp;</span></div>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Fiche_a_remplir</title><style>${CSS}</style></head><body>
    <div class="hd"><div><h1>Fiche patient</h1>
      <div class="sub">à remplir et à laisser au domicile · page 1 sur 3</div></div>
      <div class="mk">JM@Santé</div></div>
    <div class="note">Ces informations servent à vos soins et restent entre vos infirmiers.
      Remplissez ce que vous pouvez — rien n'est obligatoire.
      <b>Écrivez en majuscules dans les cases</b>, une lettre par case.</div>
    <div class="lab">IDENTITÉ</div>
    <div class="rw">NOM ${cases(20)}</div>
    <div class="rw">PRÉNOM ${cases(20)}</div>
    <div class="rw">NÉ(E) LE ${cases(8)} <span style="font-size:7.5pt;color:#888">jour mois année</span></div>
    <div class="rw">☐ Femme &nbsp; ☐ Homme</div>
    <div class="lab" style="margin-top:14px">OÙ VOUS TROUVER</div>
    ${ligne("ADRESSE")}${ligne("")}
    <div class="rw">CODE POSTAL ${cases(5)}</div>
    ${ligne("VILLE", 70)}
    <div class="rw">TÉLÉPHONE FIXE ${cases(10)}</div>
    <div class="rw">PORTABLE ${cases(10)}</div>

    <div class="pb"></div>
    <div class="hd"><div><h1>Fiche patient — suite</h1>
      <div class="sub">page 2 sur 3</div></div><div class="mk">JM@Santé</div></div>
    <div class="lab">POUR ENTRER CHEZ VOUS</div>
    <div class="rw">CODE PORTAIL ${cases(8)}</div>
    <div class="rw">CODE PORTE ${cases(8)}</div>
    ${ligne("ÉTAGE — avec ou sans ascenseur")}
    ${ligne("NOM SUR L'INTERPHONE")}
    ${ligne("CLÉ CACHÉE ? où")}
    <div class="rw">ANIMAL ☐ non &nbsp; ☐ oui, lequel <span class="li" style="width:50%">&nbsp;</span></div>
    <div class="lab" style="margin-top:14px">QUI PRÉVENIR EN CAS DE BESOIN</div>
    ${ligne("NOM")}${ligne("LIEN AVEC VOUS (fils, voisine…)", 60)}
    <div class="rw">TÉLÉPHONE ${cases(10)}</div>
    ${ligne("SECOND CONTACT — nom et téléphone")}

    <div class="pb"></div>
    <div class="hd"><div><h1>Fiche patient — suite</h1>
      <div class="sub">page 3 sur 3</div></div><div class="mk">JM@Santé</div></div>
    <div class="lab">VOS PROFESSIONNELS DE SANTÉ</div>
    ${ligne("MÉDECIN TRAITANT")}
    <div class="rw">son téléphone ${cases(10)}</div>
    ${ligne("PHARMACIE")}
    <div class="rw">son téléphone ${cases(10)}</div>
    ${ligne("AUTRE — kiné, spécialiste…")}
    <div class="lab" style="margin-top:14px">CE QU'IL FAUT SAVOIR</div>
    <div class="rw">ALLERGIES ☐ aucune connue</div>
    ${ligne("lesquelles")}
    ${ligne("MALADIES SUIVIES — diabète, tension, cœur…")}${ligne("")}
    ${ligne("OPÉRATIONS IMPORTANTES")}
    <div class="lab" style="margin-top:14px">AU QUOTIDIEN</div>
    <div class="rw">☐ lunettes ☐ prothèse auditive ☐ dentier<br>
      ☐ canne ☐ déambulateur ☐ fauteuil ☐ lit médicalisé</div>
    ${ligne("AIDE À DOMICILE — quand")}
    ${ligne("AUTRE CHOSE À NOUS DIRE")}${ligne("")}
    <div class="ft">Rempli le ___ / ___ / ______ par _________________ · JM@Santé</div>
    </body></html>`;
  imprimerDocument(html, "Fiche_a_remplir");
}

/* ============================================================
   CATALOGUE « AUTONOMIE & COMPORTEMENT » — l'écran
   ─────────────────────────────────────────────────────────
   ⚠️ Une COUCHE au-dessus de l'écran appelant, pas une feuille :
   ouvrir une feuille remplacerait le recueil ou la fiche — et la
   fiche garde ses infos en mémoire jusqu'à « Enregistrer ».
   onAdd(texte) reçoit chaque ligne composée.
============================================================ */
function ouvrirCatAutonomie(onAdd){ return ouvrirCatalogue("autonomie", { onAdd }); }

/* Un seul écran pour tous les catalogues (autonomie, antécédents,
   appareillage). o.filtre restreint les sections montrées : les
   allergies s'ouvrent seules depuis « Allergies, vigilances ». */
function ouvrirCatalogue(k, o){
  const cfg = CATS[k], onAdd = o.onAdd, garde = o.filtre || (() => true);
  const cat = catDe(k);
  const premiere = () => { const i = cat.findIndex(garde); return i < 0 ? -1 : i; };
  let openSec = premiere(), openItem = null, vals = {}, edit = null, ajout = null, n = 0, libre = "";
  const ov = document.createElement("div");
  ov.className = "catov";
  document.body.appendChild(ov);
  const fermer = () => ov.remove();

  const draw = () => {
    const sc = ov.querySelector(".cat-scroll");
    const top = sc ? sc.scrollTop : 0;
    ov.innerHTML = `<div class="cat-card">
      <div class="cat-h">
        <b>📚 ${esc(o.titre || cfg.titre)}</b>
        <span class="cat-n">${n ? n + " ligne" + (n>1?"s":"") + " ajoutée" + (n>1?"s":"") : ""}</span>
        <button class="cat-x" data-cx>✕</button>
      </div>
      <div class="cat-scroll">
        <div class="cat-libre">
          <div class="cat-lab">✏️ LIGNE LIBRE — ce qui n'est pas dans le catalogue</div>
          <div class="rowb" style="gap:6px">
            <input class="rec-in" data-clibre value="${esc(libre)}" placeholder="Une particularité…" style="flex:1;min-width:0;margin:0">
            <!-- ⚠️ .btn prend toute la largeur par défaut : sans flex:0 le
                 champ de saisie était écrasé à zéro. -->
            <button class="btn btn-primary sm" data-clibreok style="flex:0 0 auto;width:auto;padding:8px 16px" ${libre.trim()?"":"disabled"}>＋ Ajouter</button>
          </div>
        </div>
        ${cat.map((sec, si) => !garde(sec) ? "" : `
          <button class="cat-sec ${openSec===si?"on":""}" data-csec="${si}">
            <span>${esc(sec.ic||"📋")} ${esc(sec.name)}</span><span>${openSec===si?"▾":"▸"}</span>
          </button>
          ${openSec!==si ? "" : `<div class="cat-secbody">
            ${sec.groups.map((g, gi) => `
              ${g.name ? `<div class="cat-grp">${esc(g.name)}</div>` : ""}
              ${g.items.map((line, ii) => {
                const k = si+":"+gi+":"+ii;
                if (edit === k) return `<div class="cat-edit">
                  <textarea class="rec-in" data-cedtxt rows="3">${esc(line)}</textarea>
                  <p class="small muted" style="margin:4px 0 6px">[a | b] = choix · [texte] = champ à remplir</p>
                  <div class="rowb" style="gap:5px">
                    <button class="btn btn-ghost sm" data-cedel style="color:var(--danger)">🗑</button>
                    <button class="btn btn-ghost sm" data-cedno style="flex:1">Annuler</button>
                    <button class="btn btn-primary sm" data-cedok style="flex:1.3">✓ Enregistrer</button>
                  </div></div>`;
                const parts = catParse(line);
                let titre = parts.filter(p=>p.t==="txt").map(p=>p.v).join(" … ").replace(/\s+/g," ").trim();
                /* Phrase qui commence par des choix (« [Obésité | Dénutrition] ») :
                   sans ce repli, le bouton serait vide. */
                if (!titre.replace(/[…\s]/g,"")) titre = (parts.find(p=>p.t==="ch")||{opts:["…"]}).opts.join(" / ");
                if (openItem !== k) return `<button class="cat-item" data-citem="${k}">${esc(titre)}</button>`;
                const prete = catPret(parts, vals) || cfg.libre;
                return `<div class="cat-open">
                  ${parts.map((p, pi) => p.t==="txt"
                    ? `<div class="cat-txt">${esc(p.v.trim())}</div>`
                    : p.t==="ch"
                      ? `<div class="cat-chips">${p.opts.map((o, oi) => `
                          <button class="chip sm ${(vals[pi]||[]).includes(o)?"on":""}" data-cch="${pi}:${oi}">${esc(o)}</button>`).join("")}</div>`
                      : `<input class="rec-in" data-cfree="${pi}" value="${esc(vals[pi]||"")}" placeholder="${esc(p.ph)}">`
                  ).join("")}
                  <div class="cat-prev">${prete ? esc(catCompose(parts, vals)) : "<i>Choisis au moins une option</i>"}</div>
                  <button class="btn btn-primary sm" data-cadd style="width:100%" ${prete?"":"disabled"}>＋ Ajouter la ligne</button>
                </div>`;
              }).join("")}
              ${ajout === "p:"+si+":"+gi
                ? `<div class="cat-edit"><textarea class="rec-in" data-cnew rows="2" placeholder="Nouvelle phrase [choix 1 | choix 2]"></textarea>
                   <div class="rowb" style="gap:5px;margin-top:5px"><button class="btn btn-ghost sm" data-cnewno style="flex:1">Annuler</button>
                   <button class="btn btn-primary sm" data-cnewok style="flex:1.3">✓ Ajouter</button></div></div>`
                : `<button class="cat-plus" data-cplus="p:${si}:${gi}">＋ Phrase</button>`}
            `).join("")}
            ${ajout === "g:"+si
              ? `<div class="cat-edit"><input class="rec-in" data-cnew placeholder="Nom du groupe">
                 <div class="rowb" style="gap:5px;margin-top:5px"><button class="btn btn-ghost sm" data-cnewno style="flex:1">Annuler</button>
                 <button class="btn btn-primary sm" data-cnewok style="flex:1.3">✓ Ajouter</button></div></div>`
              : `<button class="cat-plus" data-cplus="g:${si}">＋ Groupe</button>`}
          </div>`}
        `).join("")}
        ${ajout === "s"
          ? `<div class="cat-edit"><input class="rec-in" data-cnew placeholder="Nom de la section">
             <div class="rowb" style="gap:5px;margin-top:5px"><button class="btn btn-ghost sm" data-cnewno style="flex:1">Annuler</button>
             <button class="btn btn-primary sm" data-cnewok style="flex:1.3">✓ Ajouter</button></div></div>`
          : `<button class="cat-plus" data-cplus="s" style="margin-top:8px">＋ Section</button>`}
        <p class="small muted" style="margin:12px 0 4px">Tape une phrase pour la composer · <b>appui long</b> pour la modifier.</p>
        <button class="cat-reset" data-creset>↺ Rétablir le catalogue d'origine</button>
      </div>
      <button class="btn btn-primary" data-cfin style="width:100%;margin-top:10px">✓ Terminer</button>
    </div>`;
    const sc2 = ov.querySelector(".cat-scroll"); if (sc2) sc2.scrollTop = top;
    brancher();
  };

  const q  = s => ov.querySelector(s);
  const qa = s => ov.querySelectorAll(s);
  const ajouter = t => { const v = String(t||"").trim(); if (!v) return; onAdd(v); n++; toast("Ligne ajoutée ✓"); };

  const brancher = () => {
    q("[data-cx]").onclick = fermer;
    q("[data-cfin]").onclick = fermer;
    ov.onclick = e => { if (e.target === ov) fermer(); };
    { const i = q("[data-clibre]"), b = q("[data-clibreok]");
      i.oninput = () => { libre = i.value; b.disabled = !libre.trim(); };
      i.onkeydown = e => { if (e.key === "Enter" && libre.trim()){ ajouter(libre); libre = ""; draw(); } };
      b.onclick = () => { ajouter(libre); libre = ""; draw(); }; }
    qa("[data-csec]").forEach(b => b.onclick = () => {
      const si = +b.dataset.csec; openSec = openSec === si ? -1 : si;
      openItem = null; edit = null; ajout = null; vals = {}; draw(); });
    qa("[data-citem]").forEach(b => {
      let t = null, long = false;
      b.addEventListener("pointerdown", () => { long = false;
        t = setTimeout(() => { long = true; edit = b.dataset.citem; openItem = null; draw(); }, 550); });
      ["pointerup","pointerleave","pointercancel"].forEach(ev => b.addEventListener(ev, () => clearTimeout(t)));
      b.onclick = () => { if (long) return; openItem = b.dataset.citem; vals = {}; edit = null; draw(); };
    });
    const cur = () => { const [si,gi,ii] = openItem.split(":").map(Number); return cat[si].groups[gi].items[ii]; };
    qa("[data-cch]").forEach(b => b.onclick = () => {
      const [pi, oi] = b.dataset.cch.split(":").map(Number);
      const o = catParse(cur())[pi].opts[oi];
      const a = vals[pi] = vals[pi] || [];
      const k = a.indexOf(o); if (k >= 0) a.splice(k,1); else a.push(o);
      draw(); });
    qa("[data-cfree]").forEach(inp => inp.oninput = () => {
      vals[+inp.dataset.cfree] = inp.value;
      const parts = catParse(cur()), ok = catPret(parts, vals) || cfg.libre;
      const pv = q(".cat-prev"); if (pv) pv.innerHTML = ok ? esc(catCompose(parts, vals)) : "<i>Choisis au moins une option</i>";
      const ad = q("[data-cadd]"); if (ad) ad.disabled = !ok; });
    { const b = q("[data-cadd]"); if (b) b.onclick = () => {
        const parts = catParse(cur()); if (!catPret(parts, vals) && !cfg.libre) return;
        ajouter(catCompose(parts, vals)); openItem = null; vals = {}; draw(); }; }
    /* Modifier / supprimer une phrase */
    { const b = q("[data-cedok]"); if (b) b.onclick = () => {
        const v = q("[data-cedtxt]").value.trim(); if (!v) return;
        const [si,gi,ii] = edit.split(":").map(Number);
        cat[si].groups[gi].items[ii] = v; edit = null; save(true); draw(); }; }
    { const b = q("[data-cedno]"); if (b) b.onclick = () => { edit = null; draw(); }; }
    { const b = q("[data-cedel]"); if (b) b.onclick = () => {
        const [si,gi,ii] = edit.split(":").map(Number);
        cat[si].groups[gi].items.splice(ii,1); edit = null; save(true); draw(); }; }
    /* Ajouter phrase / groupe / section */
    qa("[data-cplus]").forEach(b => b.onclick = () => { ajout = b.dataset.cplus; openItem = null; edit = null; draw();
      const i = q("[data-cnew]"); if (i) i.focus(); });
    { const b = q("[data-cnewno]"); if (b) b.onclick = () => { ajout = null; draw(); }; }
    { const b = q("[data-cnewok]"); if (b) b.onclick = () => {
        const v = q("[data-cnew]").value.trim(); if (!v) return;
        const [t, si, gi] = ajout.split(":");
        if (t === "p") cat[+si].groups[+gi].items.push(v);
        else if (t === "g") cat[+si].groups.push({ name:v, items:[] });
        else { cat.push({ name:v, ic:"📋", ...(o.nouvelle||{}), groups:[{ name:"", items:[] }] }); openSec = cat.length-1; }
        ajout = null; save(true); draw(); }; }
    { const b = q("[data-creset]"); if (b) b.onclick = () => {
        if (!confirm("Rétablir le catalogue d'origine ? Tes phrases ajoutées ou modifiées seront perdues.")) return;
        /* ⚠️ Remplir le MÊME tableau : `cat` est la référence utilisée
           par l'écran. Réassigner S.autoCat les découplerait, et les
           modifications suivantes ne seraient plus enregistrées. */
        const neuf = JSON.parse(JSON.stringify(cfg.def()));
        cat.splice(0, cat.length, ...neuf); S[cfg.cle] = cat;
        openSec = premiere(); save(true); draw(); }; }
  };
  draw();
}

/* ============================================================
   LIRE UN DOCUMENT POUR REMPLIR LES ANTÉCÉDENTS
   ─────────────────────────────────────────────────────────
   ⚠️ RIEN n'entre dans le dossier sans validation : on propose,
   l'utilisatrice coche, corrige à la main, ou annule.
   ⚠️ Ne marche que sur un PDF contenant du TEXTE — une photo ou
   un scan sans reconnaissance de caractères n'en contient pas.
   Adobe Scan, lui, ajoute cette couche de texte.
============================================================ */
function _sansAccents(t){
  return String(t||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
/* Mots significatifs d'un fragment : sigles entre parenthèses (HTA,
   BPCO, PTH…) et mots d'au moins 5 lettres, hors mots passe-partout. */
/* ⚠️ « chronique » n'est PAS un mot vide : il distingue une option
   (« Insuffisance rénale chronique » vs « dialysée »). */
const _VIDES = ["maladie","antecedent","antecedents","traitement","precision","autre","depuis","niveau"];
function _mots(txt){
  const sigles = (String(txt).match(/\(([A-ZÀ-Ý0-9\/]{2,8})\)/g) || []).map(x => x.replace(/[()]/g, ""));
  const mots = _sansAccents(txt).replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter(m => m.length >= 5 && !_VIDES.includes(m));
  return { sigles, mots };
}
/* Ce fragment est-il présent dans le texte ? */
function _present(txt, brut, norm){
  const { sigles, mots } = _mots(txt);
  if (sigles.some(sg => new RegExp("\\b" + sg.replace(/\//g, "\\/") + "\\b").test(brut))) return true;
  return mots.length > 0 && mots.every(m => norm.includes(" " + m) || norm.includes(m + " "));
}

async function texteDuPdf(doc){
  if (!window.pdfjsLib) return null;
  try {
    const data = await idbGet("doc_" + doc.id);
    if (!data) return null;
    const b64 = String(data).split(",").pop();
    const bin = atob(b64), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "js/libs/pdfjs.worker.js";
    const pdf = await window.pdfjsLib.getDocument({ data: arr }).promise;
    let txt = "";
    for (let n = 1; n <= Math.min(pdf.numPages, 12); n++){
      const page = await pdf.getPage(n);
      const c = await page.getTextContent();
      txt += c.items.map(i => i.str).join(" ") + "\n";
    }
    return { texte: txt, pages: pdf.numPages };
  } catch(e){
    if (typeof logIncident === "function") logIncident("import", "Lecture PDF impossible", e);
    return null;
  }
}
/* Ce que le document évoque, parmi le catalogue des antécédents.
   ⚠️ Les OPTIONS comptent : « Diabète [type 1 | type 2 (DNID)] » ne
   remonte pas « Diabète » tout seul, mais « Diabète type 2 (DNID) ».
   Et « Allergie médicamenteuse [pénicilline | AINS | iode] » exige de
   retrouver l'une des molécules — sinon on inventerait une allergie. */
function _trouvailles(texte){
  const brut = String(texte);
  const norm = " " + _sansAccents(texte).replace(/[^a-z0-9]+/g, " ") + " ";
  const out = [];
  catDe("atcd").forEach(sec => sec.groups.forEach(g => g.items.forEach(ligne => {
    const parts = catParse(ligne);
    const fixe = parts.filter(x => x.t === "txt").map(x => x.v).join(" ").trim();
    const choix = parts.filter(x => x.t === "ch");
    const retenus = choix.map(c => c.opts.filter(o => _present(o, brut, norm)));
    const auMoinsUneOption = retenus.some(r => r.length);
    const socleOk = fixe && _mots(fixe).mots.length > 0 && _present(fixe, brut, norm);

    /* Une phrase à choix n'est proposée que si une option a été vue :
       sinon on affirmerait quelque chose que le document ne dit pas. */
    if (choix.length && !auMoinsUneOption) return;
    if (!choix.length && !socleOk) return;
    if (choix.length && !socleOk && !auMoinsUneOption) return;

    let k = 0;
    const titre = parts.map(x => {
      if (x.t === "txt") return x.v;
      if (x.t === "free") return "";
      const r = retenus[k++]; return r && r.length ? r.join(", ") : "";
    }).join("").replace(/\s+/g, " ").replace(/[\s—:–-]+$/, "").trim();

    if (titre) out.push({ titre, dest: sec.dest || "atcd", sec: sec.name });
  })));
  /* Deux formulations proches du même antécédent : une seule ligne */
  const vus = new Set();
  return out.filter(t => { const k = _sansAccents(t.titre); if (vus.has(k)) return false; vus.add(k); return true; });
}

function sheetLireDoc(pid, apres){
  const p = getP(pid);
  const pdfs = (p.docs||[]).filter(d => /pdf/i.test(d.mime||"") || /\.pdf$/i.test(d.name||""));
  if (!pdfs.length){
    askDialog({ ic:"📄", titre:"Aucun PDF dans ce dossier",
      sub:"La lecture automatique ne fonctionne que sur un <b>PDF contenant du texte</b>.",
      warn:"Une photo d'ordonnance n'en contient pas. Un scan fait avec <b>Adobe Scan</b>, si.",
      oui:"J'ai compris", seul:true });
    return;
  }
  openSheet(`
    ${navHeader("Retour", true)}
    <h3>📄 Lire un document</h3>
    <p class="small muted" style="margin-bottom:10px">Choisis le document à lire. L'app propose ce qu'elle y reconnaît :
      <b>tu coches, tu corriges, ou tu annules</b>.</p>
    <div class="fc-list">
      ${pdfs.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(d => `
        <button class="lien-l" data-lirepdf="${esc(d.id)}" style="width:100%;text-align:left;cursor:pointer">
          <span style="flex:1;min-width:0">
            <span class="lien-t">📄 ${esc(d.precision || d.name || "document")}</span>
            <span class="lien-s">${d.date ? fmtFR(d.date) : ""}${d.type ? " · " + esc(d.type) : ""}</span>
          </span></button>`).join("")}
    </div>
    <button class="btn btn-ghost" id="lire-cancel" style="width:100%;margin-top:12px">Annuler</button>`);
  bindNav(apres);
  { const b = $("#lire-cancel"); if (b) b.onclick = apres; }
  $$("#sheet [data-lirepdf]").forEach(b => b.onclick = async () => {
    const doc = pdfs.find(d => d.id === b.dataset.lirepdf);
    toast("Lecture du document…");
    const r = await texteDuPdf(doc);
    if (!r || !(r.texte||"").trim()){
      await askDialog({ ic:"🖼", titre:"Pas de texte dans ce document",
        sub:"Ce PDF est une <b>image</b> : il n'y a rien à lire automatiquement.",
        warn:"Refais-le avec <b>Adobe Scan</b>, qui ajoute une couche de texte — ou saisis à la main.",
        oui:"J'ai compris", seul:true });
      return;
    }
    montrerTrouvailles(pid, doc, r, apres);
  });
}

function montrerTrouvailles(pid, doc, r, apres){
  const p = getP(pid);
  const trouve = _trouvailles(r.texte);
  const sel = new Set(trouve.map((_, i) => i));
  let lier = true;

  const draw = () => {
    openSheet(`
      ${navHeader("Retour", true)}
      <h3>📄 Ce que j'ai lu</h3>
      <p class="small muted" style="margin-bottom:10px">${esc(doc.precision || doc.name || "document")} — ${r.pages} page(s) lue(s).</p>
      ${trouve.length ? `
        <div class="fc-list">
          ${trouve.map((t, i) => `
            <label class="fc-l ${sel.has(i)?"on":""}">
              <input type="checkbox" data-tv="${i}" ${sel.has(i)?"checked":""}>
              <span><b>${esc(t.titre)}</b>
                <i>${t.dest === "vigilance" ? "→ ira dans Allergies, vigilances" : "→ antécédents"} · ${esc(t.sec)}</i></span>
            </label>`).join("")}
        </div>
        <label class="screl" style="margin-top:10px">
          <input type="checkbox" id="tv-lier" ${lier?"checked":""}>
          <span>📎 Rattacher aussi ce document aux antécédents</span>
        </label>
        <div class="rowb" style="gap:8px;margin-top:12px">
          <button class="btn btn-ghost" id="tv-no" style="flex:1">Annuler</button>
          <button class="btn btn-primary" id="tv-ok" style="flex:1.5">✓ Ajouter (<span id="tv-n">${sel.size}</span>)</button>
        </div>
        <p class="small muted" style="margin-top:9px">Tu pourras <b>modifier ou effacer</b> chaque ligne à la main ensuite, dans le champ Antécédents.</p>`
      : `<p class="small muted" style="padding:14px 0">Le texte a bien été lu, mais <b>aucun antécédent connu du catalogue</b> n'y a été reconnu.
           Saisis à la main, ou complète le catalogue pour la prochaine fois.</p>
         <button class="btn btn-ghost" id="tv-no" style="width:100%">Retour</button>`}`);
    bindNav(apres);
    $$("#sheet [data-tv]").forEach(c => c.onchange = () => {
      const i = +c.dataset.tv;
      if (c.checked) sel.add(i); else sel.delete(i);
      c.closest(".fc-l").classList.toggle("on", c.checked);
      $("#tv-n").textContent = sel.size;
      $("#tv-ok").disabled = !sel.size;
    });
    { const c = $("#tv-lier"); if (c) c.onchange = () => { lier = c.checked; }; }
    { const b = $("#tv-no"); if (b) b.onclick = apres; }
    { const b = $("#tv-ok"); if (b) b.onclick = () => {
        const pris = [...sel].map(i => trouve[i]);
        ["atcd","vigilance"].forEach(dest => {
          const lignes = pris.filter(t => t.dest === dest).map(t => t.titre);
          if (!lignes.length) return;
          const v = recueilInfo(p, dest);
          recueilSetInfo(p, dest, (v.trim() ? v.trim() + " · " : "") + lignes.join(" · "));
        });
        if (lier && liensDe(p, "atcd").length < LIENS_MAX && !liensDe(p, "atcd").includes(doc.id))
          liensDe(p, "atcd").push(doc.id);
        save(true); apres();
        toast(pris.length + " ligne(s) ajoutée(s) — à relire et corriger ✓");
      }; }
  };
  draw();
}
