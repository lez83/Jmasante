/* ============================================================
   NOMENCLATURE DES DOCUMENTS
   ─────────────────────────────────────────────────────────
   ⚠️ La synchronisation comparait les documents par NOM DE
   FICHIER. Deux confrères scannant la même ordonnance avec des
   noms différents créaient deux documents ; deux documents
   différents portant le même nom s'écrasaient.

   Chaque document porte désormais un TYPE et une PRÉCISION,
   tous deux obligatoires. Le nom se compose seul :
       2026-09-08_Ordo-medecin_Renouvellement

   Les documents antérieurs restent sans type — pastille
   « à qualifier », jamais imposé rétroactivement.
============================================================ */

const DOC_FAMILLES = [
  { cle:"presc", ic:"📄", lbl:"Prescriptions", col:"var(--accent)", types:[
      { cle:"ordo-med",    lbl:"Ordonnance médecin", court:"Ordo-medecin",
        prec:["Renouvellement","Modification","Sortie d'hospitalisation","Initiale"] },
      { cle:"ordo-ide",    lbl:"Ordonnance IDE", court:"Ordo-IDE",
        prec:["BSI","DSI","Renouvellement","Prolongation"] },
      { cle:"ordo-kine",   lbl:"Ordonnance kiné", court:"Ordo-kine",
        prec:["Initiale","Renouvellement"] },
      { cle:"ordo-bio",    lbl:"Ordonnance biologie", court:"Ordo-bio",
        prec:["Bilan de contrôle","INR","Suivi"] },
      { cle:"ordo-mat",    lbl:"Prescription matériel", court:"Ordo-materiel",
        prec:["Lit médicalisé","Pansements","Oxygène","Autre matériel"] },
    ]},
  { cle:"resul", ic:"🧪", lbl:"Résultats", col:"var(--blue,#7f9de0)", types:[
      { cle:"bio",         lbl:"Biologie", court:"Biologie",
        prec:["INR","NFS","Ionogramme","Glycémie","Bilan complet"] },
      { cle:"imagerie",    lbl:"Imagerie", court:"Imagerie",
        prec:["Radio","Échographie","Scanner","IRM"] },
      { cle:"cr-hospit",   lbl:"Compte-rendu d'hospitalisation", court:"CR-hospit",
        prec:["Entrée","Sortie","Séjour"] },
      { cle:"cr-consult",  lbl:"Compte-rendu de consultation", court:"CR-consult",
        prec:["Spécialiste","Médecin traitant","Urgences"] },
    ]},
  { cle:"soin",  ic:"🩹", lbl:"Suivi de soin", col:"var(--amber)", types:[
      { cle:"plaie",       lbl:"Photo de plaie", court:"Plaie",
        prec:["Sacrum","Talon","Jambe droite","Jambe gauche","Autre localisation"],
        garderImage:true },
      { cle:"protocole",   lbl:"Protocole de pansement", court:"Protocole",
        prec:["Pansement","Sondage","Autre protocole"] },
      { cle:"surveillance",lbl:"Feuille de surveillance", court:"Surveillance",
        prec:["Constantes","Poids","Glycémies"] },
      { cle:"recueil",     lbl:"Fiche de recueil", court:"Recueil",
        prec:["Remplie par le patient","Remplie au domicile"] },
    ]},
  { cle:"admin", ic:"📋", lbl:"Administratif", col:"var(--violet,#b98ce8)", types:[
      { cle:"vitale",      lbl:"Carte Vitale / attestation", court:"Vitale",
        prec:["Attestation de droits","Carte Vitale"] },
      { cle:"mutuelle",    lbl:"Mutuelle", court:"Mutuelle",
        prec:["Carte","Attestation"] },
      { cle:"pec",         lbl:"Accord de prise en charge", court:"PEC",
        prec:["Accord","Demande","Refus"] },
    ]},
  { cle:"libre", ic:"✏️", lbl:"Libre", col:"var(--faint)", types:[
      { cle:"libre",       lbl:"Document libre", court:"Document",
        prec:[] },   // aucune suggestion : saisie entièrement libre
    ]},
];

/* Retrouver un type depuis sa clé */
function docType(cle){
  for (const f of DOC_FAMILLES){
    const t = f.types.find(x => x.cle === cle);
    if (t) return { ...t, fam:f.cle, ic:f.ic, col:f.col, famLbl:f.lbl };
  }
  return null;
}

/* Nom composé, comparable d'un appareil à l'autre.
   ⚠️ Sans accents ni espaces : il sert aussi de nom de fichier
   lors du partage, et certains systèmes les gèrent mal. */
function docNomCompose(typeCle, precision, dateISO){
  const t = docType(typeCle);
  const propre = s => String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  const d = dateISO || workDate();
  return [d, t ? t.court : "Document", propre(precision)].filter(Boolean).join("_");
}

/* Libellé lisible pour l'affichage */
function docLabel(d){
  const t = d.type ? docType(d.type) : null;
  if (!t) return d.name || "Document";
  return t.lbl + (d.precision ? " — " + d.precision : "");
}

/* Un document sans type : ajouté avant la nomenclature */
function docAQualifier(d){ return !d.type; }

/* ============================================================
   CONVERSION EN PDF
   ─────────────────────────────────────────────────────────
   Une photo d'iPhone pèse ~3,3 Mo ; convertie en A4 à 200 dpi
   elle tombe à ~500 Ko, soit 85 % de moins — et plusieurs pages
   deviennent UN fichier. Décisif ici : les documents transitent
   par la synchronisation.

   ⚠️ La conversion RÉDUIT la définition et l'original n'est pas
   conservé. Jamais proposée par défaut sur une photo de plaie,
   où le zoom sert au suivi.
============================================================ */

function docConversionUtile(typeCle){
  const t = typeCle ? docType(typeCle) : null;
  return !(t && t.garderImage);      // vrai sauf pour les plaies
}

/* Assembler des images en un seul PDF */
async function imagesVersPdf(dataUrls){
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error("jsPDF absent");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit:"mm", format:"a4", compress:true });
  const LA = 210, HA = 297;
  for (let i = 0; i < dataUrls.length; i++){
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im); im.onerror = rej; im.src = dataUrls[i];
    });
    // Réduire à 200 dpi A4 : au-delà, on stocke du détail invisible
    const MAXW = 1654, MAXH = 2339;
    let w = img.width, h = img.height;
    const r = Math.min(MAXW / w, MAXH / h, 1);
    w = Math.round(w * r); h = Math.round(h * r);
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    const jpg = cv.toDataURL("image/jpeg", 0.78);
    // Ajuster dans la page en gardant les proportions
    const ech = Math.min(LA / w, HA / h);
    const pw = w * ech, ph = h * ech;
    if (i > 0) pdf.addPage();
    pdf.addImage(jpg, "JPEG", (LA - pw) / 2, (HA - ph) / 2, pw, ph);
  }
  return pdf.output("datauristring");
}

/* Poids d'une donnée encodée, pour informer avant conversion */
function poidsDataUrl(u){
  const b64 = String(u||"").split(",")[1] || "";
  return Math.round(b64.length * 0.75);
}
function poidsLisible(o){
  return o > 1048576 ? (o/1048576).toFixed(1) + " Mo" : Math.round(o/1024) + " Ko";
}

/* ============================================================
   ÉCRAN DE QUALIFICATION
   Type ET précision obligatoires : sans eux, pas d'ajout.
============================================================ */
async function qualifierDoc(nbImages, poids, mime){
  return new Promise(resolve => {
    let fam = null, type = null, prec = "", format = "auto";
    const estImage = /^image\//.test(mime||"");

    const dessine = () => {
      const t = type ? docType(type) : null;
      const pret = !!(type && prec.trim());
      const nom = pret ? docNomCompose(type, prec) : "";
      const convUtile = estImage && docConversionUtile(type);

      $("#sheet").innerHTML = `
        ${navHeader("Annuler", true)}
        <h3>📎 Nouveau document</h3>
        <p class="small muted" style="margin-bottom:12px">${
          nbImages > 1 ? nbImages + " images" : (estImage ? "1 image" : "Fichier")
        } · ${esc(poidsLisible(poids))}</p>

        <div class="rowlab vi"><span>1 · Type de document</span><i></i>
          <em>${type ? "✓" : "à choisir"}</em></div>
        <div class="rowbox vi" style="display:block">
          ${DOC_FAMILLES.map(f => {
            const ouvert = fam === f.cle;
            return `<div class="dfam ${ouvert?"on":""}" data-dfam="${f.cle}">
              <div class="dfam-h">
                <span>${f.ic}</span>
                <span class="dfam-l">${f.lbl}</span>
                <span class="dfam-c">${ouvert ? "▾" : (f.types.length>1 ? f.types.length+" ›" : "›")}</span>
              </div>
              ${ouvert ? `<div class="dfam-t">${f.types.map(t2 =>
                `<button class="chip ${type===t2.cle?"on":""}" data-dtyp="${t2.cle}">${esc(t2.lbl)}</button>`
              ).join("")}</div>` : ""}
            </div>`;
          }).join("")}
        </div>

        ${type ? `
        <div class="rowlab am" style="margin-top:12px"><span>2 · Précision</span><i></i>
          <em>${prec.trim() ? "✓" : "requise"}</em></div>
        <div class="rowbox am" style="display:block">
          ${t.prec.length ? `<div class="rowb" style="flex-wrap:wrap;gap:4px;margin-bottom:7px">
            ${t.prec.map(s => `<button class="chip sm ${prec===s?"on":""}" data-dprec="${esc(s)}">${esc(s)}</button>`).join("")}
          </div>` : ""}
          <input id="d-prec" class="rec-in" value="${esc(prec)}"
            placeholder="${t.prec.length ? "ou saisir librement…" : "décris le document…"}">
        </div>` : ""}

        ${convUtile ? `
        <div class="rowlab ac" style="margin-top:12px"><span>Format</span><i></i>
          <em>${nbImages>1 ? "conseillé : PDF" : ""}</em></div>
        <div class="rowbox ac" style="display:block">
          <div class="rowb" style="gap:5px">
            <button class="chip ${format!=="img"?"on":""}" data-dfmt="pdf" style="flex:1">📄 En faire un PDF</button>
            <button class="chip ${format==="img"?"on":""}" data-dfmt="img" style="flex:1">🖼 Garder les images</button>
          </div>
          <p class="small muted" style="margin:6px 0 0;font-size:9.5px">Le PDF réunit les pages et allège fortement le fichier. Les images gardent leur définition d'origine.</p>
        </div>` : ""}
        ${estImage && !convUtile && type ? `
        <p class="small muted" style="margin-top:10px">🖼 Images conservées : le zoom sert au suivi de la plaie.</p>` : ""}

        ${pret ? `
        <div class="dnom">
          <div class="dnom-l">Nom attribué</div>
          <div class="dnom-v">${esc(nom)}</div>
        </div>` : ""}

        <div class="rowb" style="margin-top:14px;gap:8px">
          <button class="btn btn-ghost" id="d-cancel" style="flex:1">Annuler</button>
          <button class="btn btn-primary" id="d-ok" style="flex:1.4" ${pret?"":"disabled"}>✓ Ajouter</button>
        </div>
        ${!pret ? `<p class="small muted" style="margin-top:7px;text-align:center">Choisis un type et une précision pour ajouter.</p>` : ""}`;

      $$("#sheet [data-dfam]").forEach(e => {
        const h = e.querySelector(".dfam-h");
        if (h) h.onclick = () => {
          fam = (fam === e.dataset.dfam) ? null : e.dataset.dfam;
          dessine();
        };
      });
      $$("#sheet [data-dtyp]").forEach(b => b.onclick = () => {
        type = b.dataset.dtyp; prec = "";
        // La conversion se règle sur le type : jamais imposée sur une plaie
        format = docConversionUtile(type) ? "pdf" : "img";
        dessine();
      });
      $$("#sheet [data-dprec]").forEach(b => b.onclick = () => { prec = b.dataset.dprec; dessine(); });
      $$("#sheet [data-dfmt]").forEach(b => b.onclick = () => { format = b.dataset.dfmt; dessine(); });
      { const e = $("#d-prec"); if (e) e.oninput = () => {
          prec = e.value;
          const ok = $("#d-ok"); if (ok) ok.disabled = !(type && prec.trim());
        }; }
      { const b = $("#d-cancel"); if (b) b.onclick = () => { closeSheet(); resolve(null); }; }
      { const b = $("#d-ok"); if (b) b.onclick = () => {
          if (!type || !prec.trim()) return;
          closeSheet();
          resolve({ type, precision:prec.trim(), format, nom:docNomCompose(type, prec) });
        }; }
    };
    openSheet("");
    dessine();
  });
}
