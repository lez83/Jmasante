/* ============================================================
   DLU — DOSSIER DE LIAISON D'URGENCE
   ─────────────────────────────────────────────────────────
   Document remis au SAMU, aux pompiers ou à l'ambulancier
   quand un patient part à l'hôpital depuis son domicile.

   Trois couches :
   ① repris automatiquement de la fiche patient
   ② champs propres au DLU (autonomie — elle évolue, donc
      vierge à chaque fois)
   ③ variables du jour : constantes + motif

   Conçu pour l'urgence : tout est déjà là, on ajoute ce qui
   vient de se passer, et on transmet en un tap.
============================================================ */

function sheetDLU(pid){
  const p = getP(pid);
  if (!p) { toast("Dossier introuvable", "danger"); return; }
  const nom = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;

  // Repris de la fiche
  const infoTxt = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim())
                                    .map(i => i.txt.trim()).join(" · ");
  const allergies  = infoTxt("vigilance");
  const traitement = infoTxt("traitement");
  const atcd       = infoTxt("atcd");
  const acces      = infoTxt("acces");

  // Ce qui manque pour un DLU complet
  const manque = [];
  if (!(p.nir||"").trim())                  manque.push("n° de sécurité sociale");
  if (!((p.prevenir||{}).nom||"").trim())   manque.push("personne à prévenir");
  if (!traitement)                          manque.push("traitement");
  if (!allergies)                           manque.push("allergies / vigilances");

  // Variables du jour — vierges à chaque ouverture
  let auto = "";
  const cst = { ta:"", puls:"", sat:"", temp:"", glyc:"" };
  let motif = "";

  const draw = () => {
    openSheet(`
      ${navHeader("Fiche", true)}
      <h3 style="margin-bottom:2px">🚑 Dossier de liaison d'urgence</h3>
      <p class="small muted" style="margin-bottom:14px"><b>${esc(nom)}</b> — à remettre au SAMU, aux pompiers ou à l'ambulancier</p>

      <div class="dlu-auto">
        <div class="dlu-auto-h">
          <span>✓ Repris de la fiche</span>
          <button class="chip" id="dlu-edit" style="font-size:11px;padding:3px 10px">modifier</button>
        </div>
        <div class="small" style="line-height:1.75;color:var(--dim)">
          ${esc(nom)}${p.dob?` · ${ageOf(p.dob)} ans`:""}${p.genre?` · ${esc(p.genre)}`:""}
          ${p.nir?`<br>n° ${esc(p.nir)}`:""}
          ${p.address?`<br>${esc(p.address)}`:""}${acces?` — <span class="muted">${esc(acces)}</span>`:""}
          ${(p.prevenir||{}).nom?`<br>À prévenir : ${esc(p.prevenir.nom)}${p.prevenir.tel?" — "+esc(p.prevenir.tel):""}`:""}
          ${(p.contacts||{}).med?`<br>Médecin : ${esc(p.contacts.med.nom||"")}${p.contacts.med.tel?" — "+esc(p.contacts.med.tel):""}`:""}
          ${allergies?`<br><span style="color:var(--amber)">⚠ ${esc(allergies)}</span>`:""}
          ${p.appareillages?`<br>Appareillages : ${esc(p.appareillages)}`:""}
          ${traitement?`<br>Traitement : ${esc(traitement)}`:""}
          ${atcd?`<br>Antécédents : ${esc(atcd)}`:""}
        </div>
      </div>

      ${manque.length ? `<div class="dlu-manque">
        <div class="dlu-manque-h">⚠ À compléter — ${manque.length} élément(s) manquant(s)</div>
        <div class="small">${manque.map(esc).join(" · ")}</div>
        <p class="small muted" style="margin:6px 0 0">Renseigne-les dans la fiche patient : ils y resteront pour les prochaines fois.</p>
      </div>` : ""}

      <div class="lab" style="margin-top:14px">Autonomie <span style="text-transform:none;letter-spacing:0;color:var(--faint)">— état actuel</span></div>
      <textarea id="dlu-auto-txt" rows="2" placeholder="Marche seul / déambulateur / fauteuil · orienté ou confus · vit seul ou accompagné…">${esc(auto)}</textarea>

      <div class="lab" style="margin-top:14px;color:var(--amber)">Aujourd'hui — ${nowHM()}</div>
      <div class="dlu-cst">
        <div><span>TA</span><input id="dlu-ta"   inputmode="text"    placeholder="14/8"  value="${esc(cst.ta)}"></div>
        <div><span>Pouls</span><input id="dlu-puls" inputmode="numeric" placeholder="80" value="${esc(cst.puls)}"></div>
        <div><span>Sat %</span><input id="dlu-sat"  inputmode="numeric" placeholder="97" value="${esc(cst.sat)}"></div>
        <div><span>T° C</span><input id="dlu-temp" inputmode="decimal" placeholder="36.8" value="${esc(cst.temp)}"></div>
        <div><span>Glyc</span><input id="dlu-glyc" inputmode="decimal" placeholder="1.1" value="${esc(cst.glyc)}"></div>
      </div>

      <div class="lab" style="margin-top:12px">Motif — ce qui vient de se passer</div>
      <div class="micwrap">
        <textarea id="dlu-motif" rows="5" placeholder="Chute vers 14h, douleur hanche droite, impossible de se relever…">${esc(motif)}</textarea>
        <button class="micbtn" id="dlu-mic" title="Dicter">🎤</button>
      </div>
      <p class="small muted" style="margin:5px 0 14px">Écris autant que nécessaire — le document s'étend sur plusieurs pages.</p>

      <button class="btn" id="dlu-show" style="width:100%;background:#a01c1c;border-color:#a01c1c;color:#fff;font-size:15px">👁 Afficher le DLU</button>
      <div class="rowb" style="margin-top:8px">
        <button class="btn btn-ghost" id="dlu-share">📤 Partager</button>
        <button class="btn btn-ghost" id="dlu-print">🖨️ Imprimer</button>
      </div>`);

    bindNav(() => sheetPatient(p));

    const grab = () => {
      auto  = ($("#dlu-auto-txt")?.value || "").trim();
      motif = ($("#dlu-motif")?.value || "").trim();
      ["ta","puls","sat","temp","glyc"].forEach(k => cst[k] = ($("#dlu-"+k)?.value || "").trim());
    };
    $$("#sheet textarea, #sheet input").forEach(el => el.oninput = grab);

    const mic = $("#dlu-mic");
    if (mic) mic.onclick = () => { try { dictate($("#dlu-motif"), mic); } catch(e){ toast("Dictée indisponible"); } };
    const ed = $("#dlu-edit");
    if (ed) ed.onclick = () => sheetPatient(p);

    $("#dlu-show").onclick  = () => { grab(); dluOutput(p, { auto, cst, motif }, "show"); };
    $("#dlu-share").onclick = () => { grab(); dluOutput(p, { auto, cst, motif }, "share"); };
    $("#dlu-print").onclick = () => { grab(); dluOutput(p, { auto, cst, motif }, "print"); };
  };
  draw();
}

/* ---------- Sortie : afficher, partager ou imprimer ---------- */
function dluOutput(p, day, mode){
  const html = dluHtml(p, day);
  const base = "DLU_" + p.nom.replace("Demo-","").replace(/\s+/g,"_") + "_" + todayISO();

  if (mode === "share"){
    if (typeof shareText === "function") shareText(html, base + ".html", "text/html");
    return;
  }
  // Affichage plein écran dans l'app (montrer le téléphone / imprimer)
  if (typeof showFichePreview === "function"){
    showFichePreview(html, base);
    if (mode === "print") setTimeout(() => { const b = document.getElementById("fp-print"); if (b) b.click(); }, 500);
  }
}

/* ---------- Le document ---------- */
function dluHtml(p, day){
  const nom  = p.nom.replace("Demo-","").toUpperCase() + " " + p.prenom;
  const age  = ageOf(p.dob);
  const it   = t => (p.infos||[]).filter(i => i.type === t && (i.txt||"").trim()).map(i => i.txt.trim()).join(" · ");
  const allergies  = it("vigilance");
  const traitement = it("traitement");
  const atcd       = it("atcd");
  const acces      = it("acces");
  const c = day.cst || {};

  // Constantes hors seuils : mises en évidence pour l'urgentiste
  const bad = { ta:false, puls:false, sat:false, temp:false, glyc:false };
  try {
    const sys = parseFloat(String(c.ta||"").split("/")[0]);
    if (!isNaN(sys) && (sys >= 16 || sys <= 9)) bad.ta = true;
    const pu = parseFloat(c.puls); if (!isNaN(pu) && (pu >= 100 || pu <= 50)) bad.puls = true;
    const sa = parseFloat(c.sat);  if (!isNaN(sa) && sa <= 92) bad.sat = true;
    const te = parseFloat(c.temp); if (!isNaN(te) && (te >= 38 || te <= 35.5)) bad.temp = true;
    const gl = parseFloat(c.glyc); if (!isNaN(gl) && (gl >= 2.5 || gl <= 0.7)) bad.glyc = true;
  } catch(e){}
  const cv = (lbl, val, isBad, unit) => (val||"").trim()
    ? `<span class="${isBad?"cbad":""}">${lbl} ${esc(val)}${unit||""}</span>` : "";
  const consts = [cv("TA", c.ta, bad.ta), cv("Pouls", c.puls, bad.puls),
                  cv("Sat", c.sat, bad.sat, " %"), cv("T°", c.temp, bad.temp),
                  cv("Glyc", c.glyc, bad.glyc)].filter(Boolean).join(" · ");

  // Bandeau de vigilances : ce qui change une prise en charge
  const vig = [];
  if (allergies) vig.push("<b>" + esc(allergies) + "</b>");
  if (p.appareillages) vig.push(esc(p.appareillages));
  if (/anticoag|eliquis|xarelto|previscan|coumadin|kardegic|kardégic|lovenox|apixaban|rivaroxaban/i.test(traitement))
    vig.push("<b>Sous anticoagulant / antiagrégant</b>");

  const row = (k, v) => v ? `<tr><td>${k}</td><td>${v}</td></tr>` : "";

  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>DLU — ${esc(nom)}</title>
<style>
 *{box-sizing:border-box}
 body{font-family:'Segoe UI',system-ui,Arial,sans-serif;color:#1a2420;line-height:1.5;margin:0;padding:14px;font-size:11pt}
 header{background:#a01c1c;color:#fff;padding:10px 14px;margin:-14px -14px 12px;display:flex;align-items:center;gap:10px}
 header .ic{font-size:21px}
 header .t{font-size:14pt;font-weight:800;letter-spacing:.02em}
 header .s{font-size:8.5pt;color:#f5c6c6;margin-top:1px}
 .nm{font-size:17pt;font-weight:800;margin:0}
 .sub{font-size:10pt;color:#5a6a65;margin:1px 0 10px}
 .vig{background:#fdeaea;border-left:4px solid #a01c1c;padding:8px 11px;margin-bottom:10px;page-break-inside:avoid}
 .vig .h{font-size:8.5pt;letter-spacing:.05em;text-transform:uppercase;color:#a01c1c;font-weight:700;margin-bottom:3px}
 .mot{background:#fff8e6;border-left:4px solid #d98324;padding:8px 11px;margin-bottom:11px}
 .mot .h{font-size:8.5pt;letter-spacing:.05em;text-transform:uppercase;color:#a06a10;font-weight:700;margin-bottom:3px}
 .mot .txt{font-size:11pt;line-height:1.55;white-space:pre-wrap}
 .mot .cst{font-size:11pt;margin-top:6px;padding-top:5px;border-top:1px solid #f0dcb8}
 .cbad{color:#a01c1c;font-weight:700}
 table{width:100%;border-collapse:collapse;font-size:10.5pt}
 td{padding:4px 0;border-bottom:1px solid #eef3f1;vertical-align:top}
 td:first-child{color:#6b7a75;width:32%;padding-right:8px}
 tr:last-child td{border-bottom:none}
 .acc{color:#8a6a2a}
 footer{margin-top:14px;padding-top:8px;border-top:1px solid #d8e3df;font-size:8.5pt;color:#8a9a95;
   display:flex;justify-content:space-between}
 @media print{ body{padding:10px} header{margin:-10px -10px 10px} }
</style></head><body>
<header>
  <span class="ic">🚑</span>
  <div><div class="t">DOSSIER DE LIAISON D'URGENCE</div>
  <div class="s">Édité le ${todayISO().split("-").reverse().join("/")} à ${nowHM()} — JM@Santé</div></div>
</header>

<p class="nm">${esc(nom)}</p>
<p class="sub">${p.dob?`Né(e) le ${p.dob.split("-").reverse().join("/")}${age!=null?` (${age} ans)`:""}`:""}${p.genre?` · ${esc(p.genre)}`:""}${p.nir?` · n° ${esc(p.nir)}`:""}</p>

${vig.length ? `<div class="vig"><div class="h">⚠ Vigilances</div><div>${vig.join(" · ")}</div></div>` : ""}

${(day.motif||consts) ? `<div class="mot">
  <div class="h">Motif de l'appel — ${todayISO().split("-").reverse().join("/")} à ${nowHM()}</div>
  ${day.motif?`<div class="txt">${esc(day.motif)}</div>`:""}
  ${consts?`<div class="cst">${consts}</div>`:""}
</div>` : ""}

<table>
  ${row("Traitement", traitement ? esc(traitement) : "")}
  ${row("Antécédents", atcd ? esc(atcd) : "")}
  ${row("Autonomie", day.auto ? esc(day.auto) : "")}
  ${row("Domicile", p.address ? esc(p.address) + (acces ? `<br><span class="acc">${esc(acces)}</span>` : "") : "")}
  ${row("À prévenir", (p.prevenir||{}).nom ? esc(p.prevenir.nom) + ((p.prevenir||{}).tel ? " — " + esc(p.prevenir.tel) : "") : "")}
  ${row("Médecin traitant", (p.contacts||{}).med ? esc(p.contacts.med.nom||"") + (p.contacts.med.tel ? " — " + esc(p.contacts.med.tel) : "") : "")}
  ${row("Pharmacie", (p.contacts||{}).pharma ? esc(p.contacts.pharma.nom||"") + (p.contacts.pharma.tel ? " — " + esc(p.contacts.pharma.tel) : "") : "")}
</table>

<footer>
  <span>${S.identity ? esc(whoami()) + ", IDEL" : "IDEL"}</span>
  <span>Document confidentiel — données de santé</span>
</footer>
</body></html>`;
}
