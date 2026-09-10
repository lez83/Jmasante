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

/* Combien de champs sont renseignés — pour la barre d'avancement */
function recueilAvance(p){
  const v = [
    p.nom, p.prenom, p.dob, p.genre,
    p.address, p.cp, p.ville,
    (p.tel||{}).fixe, (p.tel||{}).mobile,
    recueilInfo(p,"acces"),
    ((p.contacts||{}).fam||{}).nom, ((p.contacts||{}).fam||{}).tel,
    ((p.contacts||{}).med||{}).nom, ((p.contacts||{}).med||{}).tel,
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
      <div class="rowb">${champ("rc-famnom","NOM",c("fam","nom"),"",true)}${champ("rc-famtel","TÉLÉPHONE",c("fam","tel"),"")}</div>
      <div style="margin-top:6px">
        <div class="rec-lab">ENTOURAGE, AIDES, PRÉSENCES</div>
        <textarea class="rec-in" id="rc-entourage" rows="2"
          placeholder="Fille présente le week-end · aide à domicile le matin">${esc(recueilInfo(p,"entourage"))}</textarea>
      </div>`,
      manque(c("fam","nom"),c("fam","tel")))}

    ${sect(RECUEIL_SECTIONS[4], `
      <div class="rowb">${champ("rc-mednom","MÉDECIN TRAITANT",c("med","nom"),"",true)}${champ("rc-medtel","TÉL",c("med","tel"),"")}</div>
      <div class="rowb" style="margin-top:6px">${champ("rc-phnom","PHARMACIE",c("pharma","nom"),"",true)}${champ("rc-phtel","TÉL",c("pharma","tel"),"")}</div>`,
      manque(c("med","nom"),c("med","tel"),c("pharma","nom")))}

    ${sect(RECUEIL_SECTIONS[5], `
      <div class="rec-lab">ALLERGIES, VIGILANCES</div>
      <textarea class="rec-in" id="rc-vigilance" rows="2"
        placeholder="Allergie pénicilline · risque de chute">${esc(recueilInfo(p,"vigilance"))}</textarea>
      <div class="rec-lab" style="margin-top:8px">MALADIES SUIVIES, ANTÉCÉDENTS</div>
      <textarea class="rec-in" id="rc-atcd" rows="2"
        placeholder="HTA · insuffisance cardiaque · PTH droite 2019">${esc(recueilInfo(p,"atcd"))}</textarea>`,
      manque(recueilInfo(p,"vigilance")))}

    ${sect(RECUEIL_SECTIONS[6], `
      <div class="rec-lab">APPAREILLAGE, MATÉRIEL</div>
      <textarea class="rec-in" id="rc-autre" rows="2"
        placeholder="Lunettes · prothèse auditive · déambulateur">${esc(recueilInfo(p,"autre"))}</textarea>`,
      "")}

    <div class="rowb" style="margin-top:16px;gap:8px">
      <button class="btn btn-ghost" id="rc-print" style="flex:1">🖨 Imprimer remplie</button>
      <button class="btn btn-ghost" id="rc-vierge" style="flex:1">📄 Fiche vierge</button>
    </div>
    <p class="small muted" style="margin-top:8px">Ce que tu saisis ici est enregistré <b>directement dans le dossier</b> — l'onglet Infos et le DLU le reprennent aussitôt.</p>`);

  /* Enregistrement au fil de la saisie : pas de bouton à valider,
     l'IDEL est chez le patient et peut être interrompu. */
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
  lie("rc-famnom", v => setC("fam","nom",v));
  lie("rc-famtel", v => setC("fam","tel",v));
  lie("rc-mednom", v => setC("med","nom",v));
  lie("rc-medtel", v => setC("med","tel",v));
  lie("rc-phnom",  v => setC("pharma","nom",v));
  lie("rc-phtel",  v => setC("pharma","tel",v));
  lie("rc-acces",     v => recueilSetInfo(p,"acces",v));
  lie("rc-entourage", v => recueilSetInfo(p,"entourage",v));
  lie("rc-vigilance", v => recueilSetInfo(p,"vigilance",v));
  lie("rc-atcd",      v => recueilSetInfo(p,"atcd",v));
  lie("rc-autre",  v => recueilSetInfo(p,"autre",v));

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
        <b>${esc(ou(c("fam","nom")))}</b> — ${esc(ou(c("fam","tel")))}<br>
        ${esc(ou(inf("entourage"), ""))}</div>
      <div class="duo">
        <div><div class="lab">PROFESSIONNELS</div>
          <b>Médecin</b> ${esc(ou(c("med","nom")))}<br>&nbsp;&nbsp;${esc(ou(c("med","tel")))}<br>
          <b>Pharmacie</b> ${esc(ou(c("pharma","nom")))}<br>&nbsp;&nbsp;${esc(ou(c("pharma","tel")))}</div>
        <div><div class="lab">AU QUOTIDIEN</div>${esc(ou(inf("autre"), "non renseigné"))}</div>
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
