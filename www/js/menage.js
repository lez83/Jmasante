/* ============================================================
   MÉNAGE DANS L'HISTORIQUE
   ─────────────────────────────────────────────────────────
   Archiver dans un fichier, puis supprimer — jamais l'inverse.
   Le bouton de suppression reste inactif tant qu'aucune archive
   n'a été produite (un lien discret permet de passer outre).

   Quatre étapes : ① quoi ② quand ③ qui ④ archiver puis supprimer.
   Ouvert depuis le menu → tous les patients.
   Ouvert depuis une fiche → l'étape ③ disparaît.
============================================================ */

async function sheetMenage(pid){
  const solo = pid ? getP(pid) : null;
  if (pid && !solo){ toast("Dossier introuvable", "danger"); return; }

  let doPassages = true, doConstantes = true;
  let mode = "6m";                       // 3m · 6m · 1a · libre
  let from = "", to = "";
  const sel = new Set();                 // patients cochés
  let archiveFaite = false;
  let fmt = "html";

  const tous = () => solo ? [solo] : activeP().concat((S.patients||[]).filter(p => p.archived || p.pec));
  tous().forEach(p => sel.add(p.id));

  /* Bornes de la période */
  const bornes = () => {
    if (mode === "libre") return { a: from || "0000-01-01", b: to || todayISO() };
    const m = { "3m":3, "6m":6, "1a":12 }[mode] || 6;
    const lim = new Date(); lim.setMonth(lim.getMonth() - m);
    return { a: "0000-01-01", b: lim.toISOString().slice(0,10) };
  };

  /* Ce qui tombe dans la période, patient par patient */
  const compte = () => {
    const { a, b } = bornes();
    let nP = 0, nC = 0;
    const par = [];
    tous().forEach(p => {
      const vs = (p.visits||[]).filter(v => v.date >= a && v.date <= b);
      const cs = vs.filter(v => v.consts && Object.keys(v.consts).length);
      par.push({ p, nP: vs.length, nC: cs.length });
      if (sel.has(p.id)){ nP += vs.length; nC += cs.length; }
    });
    return { nP, nC, par, a, b };
  };

  const draw = () => {
    const { nP, nC, par, a, b } = compte();
    const totP = (S.patients||[]).reduce((n,p)=>n+(p.visits||[]).length, 0);
    const totC = (S.patients||[]).reduce((n,p)=>n+(p.visits||[]).filter(v=>v.consts&&Object.keys(v.consts).length).length, 0);
    const traiteP = doPassages ? nP : 0;
    const traiteC = doConstantes ? nC : 0;
    const rien = !traiteP && !traiteC;

    openSheet(`
      ${navHeader(solo ? "Fiche" : "Réglages", true)}
      <h3 style="margin-bottom:2px">🧹 Ménage dans l'historique${solo ? " — " + esc(solo.prenom + " " + solo.nom.replace("Demo-","").toUpperCase()) : ""}</h3>
      <p class="small muted" style="margin-bottom:14px">${solo
        ? `${(solo.visits||[]).length} passage(s) · ${(solo.visits||[]).filter(v=>v.consts&&Object.keys(v.consts).length).length} relevé(s)`
        : `${totP} passages · ${totC} relevés de constantes`}</p>

      <div class="mn-step">1 · Que veux-tu traiter ?</div>
      <div class="mn-what">
        <button class="mn-w ${doPassages?"on":""}" data-mw="p">
          <span class="ic">🚶</span><span class="l">Passages</span><span class="s">et leurs soins</span></button>
        <button class="mn-w ${doConstantes?"on":""}" data-mw="c">
          <span class="ic">🩺</span><span class="l">Constantes</span><span class="s">TA, pouls, glyc…</span></button>
      </div>
      <p class="small muted" style="margin:6px 0 14px">Décoche pour n'en traiter qu'un. Supprimer les <b>constantes seules</b> conserve la trace des soins faits.</p>

      <div class="mn-step">2 · Sur quelle période ?</div>
      <div class="chips" style="margin-bottom:8px">
        ${[["3m","Avant 3 mois"],["6m","Avant 6 mois"],["1a","Avant 1 an"],["libre","📅 Dates libres"]]
          .map(([k,l])=>`<button class="chip ${mode===k?"on":""}" data-mp="${k}">${l}</button>`).join("")}
      </div>
      ${mode==="libre" ? `<div class="rowb" style="margin-bottom:14px">
        <input type="date" id="mn-from" value="${esc(from)}" style="flex:1">
        <input type="date" id="mn-to"   value="${esc(to)}"   style="flex:1">
      </div>` : `<p class="small muted" style="margin-bottom:14px">Tout ce qui date d'avant le <b>${fmtFR(b)}</b>.</p>`}

      ${solo ? "" : `
      <div class="mn-step" style="display:flex;align-items:center;gap:7px">
        <span style="flex:1">3 · Quels patients ?</span>
        <button class="chip" id="mn-all"  style="font-size:10.5px;padding:3px 10px">Tout cocher</button>
        <button class="chip" id="mn-none" style="font-size:10.5px;padding:3px 10px">Aucun</button>
      </div>
      <div class="mn-list">
        ${par.filter(x => x.nP).map(({p,nP,nC})=>`
          <button class="mn-p ${sel.has(p.id)?"on":""}" data-mpp="${p.id}">
            <span class="box">${sel.has(p.id)?"✓":""}</span>
            <span class="nm">${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${p.archived?' <span class="small muted">· mis de côté</span>':""}</span>
            <span class="ct">${nP} pass.${nC?` · ${nC} const.`:""}</span>
          </button>`).join("") || uiEmpty("🗓","Aucun passage sur cette période","Élargis la période pour voir des dossiers à traiter.")}
      </div>`}

      <div class="mn-recap ${rien?"vide":""}">
        <div class="h">Ce qui sera traité</div>
        ${rien ? `<div class="small">Rien à traiter — élargis la période ou coche des patients.</div>` : `
        <div style="font-size:13px;line-height:1.7">
          ${doPassages?`<b>${traiteP} passage(s)</b>`:""}${doPassages&&doConstantes?" et ":""}${doConstantes?`<b>${traiteC} relevé(s)</b>`:""}<br>
          <span class="small muted">${solo?esc(solo.prenom):sel.size+" patient(s)"} · jusqu'au ${fmtFR(b)}</span>
        </div>
        <p class="small muted" style="margin:7px 0 0">Documents, bilans et rappels ne sont pas touchés.</p>`}
      </div>

      <div class="mn-step">4 · Archiver, puis supprimer</div>
      <div class="chips" style="margin-bottom:9px">
        ${[["html","🌐 HTML"],["txt","🗒️ Texte"],["csv","📊 CSV"],["json","💾 JSON"]]
          .map(([k,l])=>`<button class="chip ${fmt===k?"on":""}" data-mf="${k}" style="flex:1;justify-content:center;font-size:11.5px">${l}</button>`).join("")}
      </div>
      <p class="small muted" style="margin-bottom:9px">${fmt==="json"
        ? "Le JSON peut être <b>réimporté</b> dans l'application plus tard."
        : fmt==="csv" ? "Le CSV s'ouvre dans Excel ou LibreOffice."
        : "Lisible dans n'importe quel navigateur, sans l'application."}</p>

      <button class="btn btn-primary" id="mn-arch" style="width:100%" ${rien?"disabled":""}>📤 Archiver dans un fichier</button>
      <button class="btn" id="mn-del" style="width:100%;margin-top:8px;background:transparent;${archiveFaite
        ? "border-color:var(--danger);color:var(--danger)"
        : "border-color:var(--border);color:var(--faint)"}" ${(!archiveFaite||rien)?"disabled":""}>
        🗑 ${archiveFaite ? "Supprimer maintenant" : "Supprimer — archive d'abord"}</button>
      ${rien?"":`<p class="small muted" style="text-align:center;margin-top:8px">
        <a id="mn-skip" style="color:var(--faint);text-decoration:underline">supprimer sans archiver</a></p>`}`);

    bindNav(() => solo ? sheetPatient(solo) : sheetTours());
    $$("#sheet [data-mw]").forEach(b => b.onclick = () => {
      if (b.dataset.mw === "p") doPassages = !doPassages; else doConstantes = !doConstantes;
      if (!doPassages && !doConstantes){ doPassages = true; toast("Coche au moins l'un des deux"); }
      archiveFaite = false; draw();
    });
    $$("#sheet [data-mp]").forEach(b => b.onclick = () => { mode = b.dataset.mp; archiveFaite = false; draw(); });
    $$("#sheet [data-mpp]").forEach(b => b.onclick = () => {
      const id = b.dataset.mpp; sel.has(id) ? sel.delete(id) : sel.add(id);
      archiveFaite = false; draw();
    });
    $$("#sheet [data-mf]").forEach(b => b.onclick = () => { fmt = b.dataset.mf; archiveFaite = false; draw(); });
    const ma = $("#mn-all");  if (ma) ma.onclick = async () => { tous().forEach(p=>sel.add(p.id)); archiveFaite=false; draw(); };
    const mn = $("#mn-none"); if (mn) mn.onclick = () => { sel.clear(); archiveFaite=false; draw(); };
    ["mn-from","mn-to"].forEach(id => { const e = $("#"+id); if (e) e.onchange = () => {
      if (id==="mn-from") from = e.value; else to = e.value; archiveFaite=false; draw(); }; });

    $("#mn-arch").onclick = async () => {
      const data = collecte(sel, bornes(), doPassages, doConstantes, solo);
      await exportArchive(data, fmt, bornes());
      archiveFaite = true; draw();
      toast("Archive produite — tu peux maintenant supprimer 📤");
    };
    const del = $("#mn-del");
    if (del) del.onclick = () => faireLeMenage(sel, bornes(), doPassages, doConstantes, solo, traiteP, traiteC);
    const skip = $("#mn-skip");
    if (skip) skip.onclick = async () => {
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Supprimer SANS archiver ?", sub:"Ces données seront définitivement perdues.", oui:"🗑 Supprimer" })) return;
      faireLeMenage(sel, bornes(), doPassages, doConstantes, solo, traiteP, traiteC);
    };
  };
  draw();
}

/* ---------- Collecte des données concernées ---------- */
function collecte(sel, {a,b}, doP, doC, solo){
  const src = solo ? [solo] : (S.patients||[]).filter(p => sel.has(p.id));
  return src.map(p => ({
    p,
    visits: (p.visits||[]).filter(v => v.date >= a && v.date <= b)
  })).filter(x => x.visits.length);
}

/* ---------- Suppression effective ---------- */
function faireLeMenage(sel, bornes, doP, doC, solo, nP, nC){
  const quoi = [doP ? nP+" passage(s)" : "", doC && !doP ? nC+" relevé(s) de constantes" : ""].filter(Boolean).join(" et ");
  if (!confirm("Supprimer " + quoi + " ?\n\n" +
    (doP ? "Les passages de la période seront retirés de l'historique.\n"
         : "Seules les constantes seront effacées — les passages et les soins restent.\n") +
    "Documents, bilans et rappels ne sont pas touchés.")) return;

  const { a, b } = bornes;
  const src = solo ? [solo] : (S.patients||[]).filter(p => sel.has(p.id));
  let supP = 0, supC = 0;
  src.forEach(p => {
    if (doP){
      const av = (p.visits||[]).length;
      p.visits = (p.visits||[]).filter(v => !(v.date >= a && v.date <= b));
      supP += av - p.visits.length;
    } else if (doC){
      // Constantes seules : on vide le champ, le passage reste
      (p.visits||[]).forEach(v => {
        if (v.date >= a && v.date <= b && v.consts && Object.keys(v.consts).length){
          v.consts = {}; delete v.constRel; supC++;
        }
      });
    }
  });
  save(); render();
  toast(doP ? supP + " passage(s) supprimé(s) 🧹" : supC + " relevé(s) effacé(s) 🧹");
  closeSheet();
}

/* ---------- Production du fichier d'archive ---------- */
async function exportArchive(data, fmt, {a,b}){
  const base = "Archive_JMSante_" + (a==="0000-01-01" ? "avant_" + b : a + "_" + b);
  if (fmt === "json"){
    const pkg = { _jmarchive:1, from:a, to:b, generatedAt:Date.now(),
      by: S.identity ? whoami() : null,
      patients: data.map(({p,visits}) => ({
        id:p.id, nom:p.nom, prenom:p.prenom, dob:p.dob, visits }))
    };
    await shareText(JSON.stringify(pkg, null, 1), base + ".json", "application/json");
    return;
  }
  if (fmt === "csv"){
    const L = ['"Patient";"Naissance";"Date";"Heure";"Créneau";"Soins";"TA";"Pouls";"Temp";"Sat";"Glyc";"Transmission"'];
    data.forEach(({p,visits}) => {
      const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
      [...visits].sort((x,y)=>x.date.localeCompare(y.date)).forEach(v => {
        const c = v.consts || {};
        const q = t => '"' + String(t==null?"":t).replace(/"/g,'""') + '"';
        L.push([nom, p.dob||"", v.date, v.at||"", v.slot||"",
                (v.soins||[]).join(", "), c.ta||"", c.puls||"", c.temp||"", c.sat||"", c.glyc||"",
                (v.note||"").replace(/\n/g," ")].map(q).join(";"));
      });
    });
    await shareText("\uFEFF" + L.join("\n"), base + ".csv", "text/csv");
    return;
  }
  if (fmt === "txt"){
    let o = "ARCHIVE — PASSAGES\n" + (a==="0000-01-01" ? "Jusqu'au " + fmtFR(b) : "Du " + fmtFR(a) + " au " + fmtFR(b)) + "\n";
    o += "─".repeat(30) + "\n\n";
    data.forEach(({p,visits}) => {
      o += p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom +
           (p.dob ? " — né(e) le " + p.dob.split("-").reverse().join("/") : "") + "\n";
      [...visits].sort((x,y)=>x.date.localeCompare(y.date)).forEach(v => {
        const cp = constParts(v.consts);
        o += "  " + fmtFR(v.date) + " " + (v.at||"") + " — " + ((v.soins||[]).join(", ") || "—") + "\n";
        if (cp.length) o += "     " + cp.join(" · ") + "\n";
        if (v.note) o += "     " + v.note.replace(/\n/g,"\n     ") + "\n";
      });
      o += "\n";
    });
    o += "─".repeat(30) + "\nProduite le " + todayISO().split("-").reverse().join("/") +
         (S.identity ? " par " + whoami() : "") + "\nDocument confidentiel — données de santé.\n";
    await shareText(o, base + ".txt", "text/plain");
    return;
  }
  // HTML
  const totV = data.reduce((n,x)=>n+x.visits.length, 0);
  const corps = data.map(({p,visits}) => `
    <section>
      <h2>${esc(p.nom.replace("Demo-","").toUpperCase())} ${esc(p.prenom)}${p.dob?` <span class="dob">— né(e) le ${p.dob.split("-").reverse().join("/")}</span>`:""}</h2>
      <table>
        <tr><th>Date</th><th>Soins</th><th>Constantes</th><th>Transmission</th></tr>
        ${[...visits].sort((x,y)=>x.date.localeCompare(y.date)).map(v => {
          const sl = (v.slot && SLOT_LBL[v.slot]) ? " " + SLOT_LBL[v.slot].ic : "";
          const sn = v.soinNotes || {};
          return `<tr>
            <td class="dt">${fmtFR(v.date)}${sl} ${esc(v.at||"")}</td>
            <td>${(v.soins||[]).map(x => sn[x] ? `${esc(x)} <i>(${esc(sn[x])})</i>` : esc(x)).join(", ") || "—"}</td>
            <td class="ct">${esc(constParts(v.consts).join(" · ")) || "—"}</td>
            <td>${v.note ? esc(v.note).replace(/\n/g,"<br>") : "—"}</td>
          </tr>`;
        }).join("")}
      </table>
    </section>`).join("");

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Archive JM@Santé</title>
<style>
 @page{ size:A4 portrait; margin:12mm 10mm }
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;margin:0;padding:0;font-size:10.5pt;line-height:1.45}
 header{background:#005A50;color:#fff;padding:10px 14px;margin-bottom:12px}
 header .t{font-size:13pt;font-weight:800}
 header .s{font-size:8.5pt;color:#a8ded2;margin-top:1px}
 h2{font-size:11.5pt;color:#005A50;border-bottom:2px solid #d8e3df;padding-bottom:3px;margin:16px 0 6px}
 h2 .dob{font-weight:400;font-size:9.5pt;color:#6b7a75}
 section{page-break-inside:avoid}
 table{width:100%;border-collapse:collapse;font-size:9pt}
 th{background:#eef3f1;border:1px solid #c8d8d3;padding:4px;text-align:left;font-size:8.5pt}
 td{border:1px solid #eef3f1;padding:4px;vertical-align:top}
 td.dt{white-space:nowrap;color:#5a6a65;width:20%}
 td.ct{color:#3a4a45;width:22%}
 footer{margin-top:18px;padding-top:8px;border-top:1px solid #d8e3df;font-size:8pt;color:#8a9a95;text-align:center}
 @media screen{ body{background:#e8eeec;padding:14px} header{margin:-14px -14px 12px} }
</style></head><body>
<header>
  <div class="t">ARCHIVE — PASSAGES ET CONSTANTES</div>
  <div class="s">${a==="0000-01-01" ? "Jusqu'au " + fmtFR(b) : "Du " + fmtFR(a) + " au " + fmtFR(b)} · ${data.length} patient(s) · ${totV} passage(s)</div>
</header>
${corps || "<p>Aucune donnée sur cette période.</p>"}
<footer>
  Archive produite le ${todayISO().split("-").reverse().join("/")}${S.identity?` par ${esc(whoami())}`:""} — JM@Santé<br>
  Document confidentiel — données de santé, à conserver de façon sécurisée
</footer>
</body></html>`;
  await shareText(html, base + ".html", "text/html");
}

/* ---------- Réimport d'une archive JSON ---------- */
function importArchive(txt){
  let pkg;
  try { pkg = JSON.parse(txt); } catch(e){ toast("Fichier illisible", "danger"); return; }
  if (!pkg || !pkg._jmarchive || !Array.isArray(pkg.patients)){
    toast("Ce n'est pas une archive JM@Santé", "danger"); return;
  }
  // Analyse : ce qui existe déjà, ce qui est nouveau
  const lignes = [];
  pkg.patients.forEach(a => {
    const p = (S.patients||[]).find(x => x.id === a.id) ||
              (S.patients||[]).find(x => x.nom === a.nom && x.prenom === a.prenom);
    const has = new Set(p ? (p.visits||[]).map(v => v.uid) : []);
    const nouveaux = (a.visits||[]).filter(v => !has.has(v.uid));
    lignes.push({ a, p, nouveaux, deja: (a.visits||[]).length - nouveaux.length });
  });
  const totN = lignes.reduce((n,l)=>n+l.nouveaux.length, 0);
  const totD = lignes.reduce((n,l)=>n+l.deja, 0);
  const inconnus = lignes.filter(l => !l.p);
  const choix = {};
  lignes.forEach(l => { if (l.p && l.nouveaux.length) choix[l.a.id] = true; });

  const draw = () => {
    openSheet(`
    ${navHeader("Retour", true)}
    <h3>💾 Réimporter une archive</h3>
      <p class="small muted" style="margin-bottom:12px">Du ${fmtFR(pkg.from)} au ${fmtFR(pkg.to)}${pkg.by?` · produite par ${esc(pkg.by)}`:""}</p>
      <div class="tip" style="margin-bottom:12px">
        <b>${totN} passage(s)</b> à réintégrer${totD?` · ${totD} déjà présent(s), ignoré(s)`:""}
        ${inconnus.length?`<br><span style="color:var(--amber)">⚠ ${inconnus.length} patient(s) de l'archive n'existent plus — ils ne peuvent pas être réintégrés</span>`:""}
      </div>
      ${lignes.filter(l=>l.p && l.nouveaux.length).map(l=>`
        <button class="selv" data-ia="${esc(l.a.id)}">
          <span class="box">${choix[l.a.id]?"✓":""}</span>
          <span class="sv">${esc(l.a.nom.replace("Demo-","").toUpperCase())} ${esc(l.a.prenom)}
            <span class="small muted">${l.nouveaux.length} passage(s)${l.deja?` · ${l.deja} déjà là`:""}</span></span>
        </button>`).join("") || `<p class="small muted">Rien à réintégrer — tout est déjà présent.</p>`}
      <button class="btn btn-primary" id="ia-go" style="width:100%;margin-top:12px" ${totN?"":"disabled"}>Réintégrer les passages cochés</button>
      <button class="btn btn-ghost" id="ia-cancel" style="width:100%;margin-top:8px">Annuler</button>`);
    $$("#sheet [data-ia]").forEach(b => b.onclick = () => { choix[b.dataset.ia] = !choix[b.dataset.ia]; draw(); });
    $("#ia-cancel").onclick = closeSheet;
    $("#ia-go").onclick = () => {
      let n = 0;
      lignes.forEach(l => {
        if (!l.p || !choix[l.a.id]) return;
        l.p.visits = l.p.visits || [];
        l.nouveaux.forEach(v => { l.p.visits.push(v); n++; });
        l.p.visits.sort((x,y)=>(x.date+x.at).localeCompare(y.date+y.at));
      });
      save(true); render(); closeSheet();
      toast(n + " passage(s) réintégré(s) 💾");
    };
  };
  draw();
}
