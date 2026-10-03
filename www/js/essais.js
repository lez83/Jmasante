/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   LES FONCTIONS EN ESSAI
   ─────────────────────────────────────────────────────────
   Un code ouvre une liste d'interrupteurs. Chaque fonction neuve
   s'essaie à part, se désactive seule, et laisse l'application
   exactement dans l'état où elle était.

   ⚠️ RÈGLE ABSOLUE : une fonction en essai N'ÉCRIT JAMAIS dans les
   données de tournée. Elle vit dans sa propre clé (`S.essaisData`),
   que l'on peut effacer sans toucher à un dossier patient. Un module
   qui aurait besoin de modifier un dossier ne peut pas être livré en
   essai — il attend d'être validé.

   ⚠️ CAS PARTICULIER DU GUIDE : lui remplace du contenu existant. On
   garde donc l'ancienne version à côté de la nouvelle, et c'est
   l'interrupteur qui décide laquelle s'affiche. Rien n'est écrasé.

   ⚠️ Le code n'est pas un secret de sécurité : il évite qu'un
   utilisateur tombe par hasard sur une fonction non finie, rien de
   plus. Il ne protège aucune donnée.
============================================================ */
const ESSAI_CODE = "cigale83";

const ESSAIS = [
  { cle:"guide26", ic:"📋", nom:"Guide mis à jour",
    sub:"Le cadre de prescription relu sur le texte du 26 juin 2026, avec les repères « 1ʳᵉ intention » et « à inscrire au dossier ».",
    remplace:"Remplace l'affichage du guide actuel. L'ancien reste intact et revient si tu éteins." },
  { cle:"dispositifs", ic:"🩹", nom:"Mes dispositifs",
    sub:"Un catalogue de pansements et matériels, éditable et importable par classeur, pour composer une ordonnance sans tout écrire.",
    remplace:"" },
  { cle:"documents", ic:"📄", nom:"Mes modèles",
    sub:"Questionnaire pré-vaccinal et attestation de vaccination, à produire pré-remplis et à modifier à ta main.",
    remplace:"" },
  { cle:"bilans", ic:"🧪", nom:"Bilans — tubes et repères",
    sub:"Ordre de prélèvement, couleurs de tubes, et valeurs usuelles ajustables à ton laboratoire.",
    remplace:"" },
  { cle:"calculs", ic:"🧮", nom:"Calculs",
    sub:"Débit de perfusion, dose selon le poids, dilution, conversions. Formules vérifiées sur plusieurs sources.",
    remplace:"" }
];

function essais(){ return (S.essais = S.essais || {}); }
function essaiActif(cle){ return !!essais()[cle]; }
function essaisOuverts(){ return !!S.essaisDeverrouille; }
function essaisCombien(){ return ESSAIS.filter(e => essaiActif(e.cle)).length; }

/* ── Le code ── */
async function essaisDemanderCode(){
  const saisi = await askText("Fonctions en essai", {
    ic:"🧪", ph:"Code", sub:"Si tu n'as pas de code, cet écran ne te concerne pas." });
  if (saisi === null) return;
  if ((saisi || "").trim().toLowerCase() !== ESSAI_CODE){
    toast("Code non reconnu", "danger");
    return;
  }
  S.essaisDeverrouille = true; save(true);
  toast("Fonctions en essai disponibles 🧪");
  sheetEssais();
}

/* ── L'écran ── */
function sheetEssais(){
  if (!essaisOuverts()){ essaisDemanderCode(); return; }
  const n = essaisCombien();
  openSheet(`
    ${navHeader("Application", true)}
    <h3>🧪 Fonctions en essai</h3>
    <p class="small muted" style="margin-bottom:12px">Des fonctions qui ne sont pas encore validées. Active ce que tu veux essayer, éteins quand tu veux.</p>

    ${ESSAIS.map(e => `
      <div class="ess ${essaiActif(e.cle) ? "on" : ""}">
        <label class="ess-h">
          <span class="ess-ic">${e.ic}</span>
          <span style="flex:1;min-width:0"><b>${esc(e.nom)}</b>
            ${essaiActif(e.cle) ? `<span class="ess-tag">en essai</span>` : ""}</span>
          <input type="checkbox" data-ess="${esc(e.cle)}" ${essaiActif(e.cle) ? "checked" : ""}>
        </label>
        <p class="ess-s">${esc(e.sub)}</p>
        ${e.remplace ? `<p class="ess-r">⚠️ ${esc(e.remplace)}</p>` : ""}
      </div>`).join("")}

    <div class="tip" style="margin-top:12px">Une fonction en essai <b>n'écrit rien</b> dans tes dossiers, tes tournées ou tes passages. Elle range ses propres données à part.</div>

    ${n ? `<button class="btn btn-ghost" id="ess-off" style="width:100%;margin-top:10px">↺ Tout éteindre et revenir à l'application habituelle</button>` : ""}
    <button class="btn btn-ghost" id="ess-purge" style="width:100%;margin-top:7px">🗑 Effacer les données des essais</button>
    <p class="small muted" style="margin-top:6px">Efface ce que les fonctions en essai ont enregistré de leur côté. Tes dossiers ne sont pas concernés.</p>

    <div class="warn" style="margin-top:12px">Ces fonctions peuvent changer, mal se comporter ou disparaître. Ne t'appuie pas dessus pour un soin.</div>`);
  bindNav(() => sheetAppPanel());

  $$("#sheet [data-ess]").forEach(c => c.onchange = async () => {
    const cle = c.dataset.ess;
    const e = ESSAIS.find(x => x.cle === cle);
    if (c.checked){
      essais()[cle] = Date.now();
      save(true); render(); sheetEssais();
      toast(e.nom + " — en essai 🧪");
    } else {
      delete essais()[cle];
      save(true); render(); sheetEssais();
      toast(e.nom + " — éteint");
    }
  });

  { const b = $("#ess-off");
    if (b) b.onclick = async () => {
      if (!await askDialog({ ic:"↺", titre:"Tout éteindre ?",
        sub:"L'application revient à son fonctionnement habituel. Les données des essais sont conservées, au cas où tu rallumes.",
        oui:"Tout éteindre" })) return;
      S.essais = {}; save(true); render(); sheetEssais();
      toast("Application habituelle rétablie");
    }; }

  { const b = $("#ess-purge");
    if (b) b.onclick = async () => {
      if (!await askDialog({ ton:"danger", ic:"🗑", titre:"Effacer les données des essais ?",
        sub:"Ce que les fonctions en essai ont enregistré sera perdu. <b>Tes patients, tournées et passages ne sont pas touchés.</b>",
        oui:"Effacer" })) return;
      delete S.essaisData;
      save(true); render(); sheetEssais();
      toast("Données des essais effacées");
    }; }
}

/* ── Le rangement des données d'essai ──
   ⚠️ TOUT ce qu'une fonction en essai enregistre passe par ici. C'est
   ce qui rend l'effacement sûr : une seule clé à retirer, et pas une
   ligne touchée ailleurs. */
function essaiData(cle){
  S.essaisData = S.essaisData || {};
  S.essaisData[cle] = S.essaisData[cle] || {};
  return S.essaisData[cle];
}

/* Le bandeau posé en tête d'un écran en essai : le testeur doit savoir
   qu'il essuie les plâtres. */
function essaiBandeau(cle){
  const e = ESSAIS.find(x => x.cle === cle);
  return `<div class="ess-band">🧪 <b>${esc(e ? e.nom : "Fonction en essai")}</b> — en cours d'essai, susceptible de changer.
    <button class="ess-band-x" data-essoff="${esc(cle)}">éteindre</button></div>`;
}
function essaiBandeauBind(){
  $$("#sheet [data-essoff]").forEach(b => b.onclick = () => {
    delete essais()[b.dataset.essoff];
    save(true); render(); closeSheet();
    toast("Fonction éteinte");
  });
}
