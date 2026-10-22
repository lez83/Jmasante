/* ============================================================
   JM@Santé — Copyright © 2026 JmCve83. Tous droits réservés.
   Reproduction, redistribution et décompilation interdites
   sans autorisation écrite. Voir LICENSE.md.
============================================================ */
/* ============================================================
   ALERTES — un rappel qui se manifeste tout seul
   ─────────────────────────────────────────────────────────
   « Qu'ils pensent à changer le matériel », « passer au labo vendredi ».
   Une note ou un rappel qui dort dans une liste ne sert à rien le jour
   où il faut agir : il doit venir à toi.

   ⚠️ UNE SEULE MÉCANIQUE POUR LES NOTES ET LES RAPPELS. Deux systèmes
   auraient divergé au premier changement — l'un gagnant la répétition,
   l'autre pas, et plus personne ne saurait lequel fait quoi. Le même
   objet `alerte` est posé sur une note comme sur un rappel, et le même
   bloc d'écran le règle des deux côtés.

   ⚠️ CE QUI EXISTAIT DÉJÀ, ET CE QUI ÉTAIT CASSÉ.
   Le plugin de notifications était installé depuis longtemps, et
   `scheduleRappelNotifications()` (seq.js) programmait déjà J-3, J-1 et
   le jour J à 8 h pour tout rappel daté. Mais :
     • rien à l'écran ne le disait, et rien ne permettait de l'éteindre ;
     • surtout, le branchement censé reprogrammer après chaque
       modification avait été ÉCRIT PUIS JAMAIS INSTALLÉ — une variable
       `_hookedSave` déclarée et abandonnée. Conséquence réelle : un
       rappel créé en tournée ne programmait rien tant que l'application
       n'était pas relancée.
   Même famille que le `pointer-events:none` du message : du code qui a
   l'air d'être là et qui ne tourne pas.

   ⚠️ SILENCIEUSES PAR DÉFAUT, et c'est lui qui l'a demandé : un simple
   affichage dans la barre de notifications d'Android, sans sonnerie.
   On travaille chez des patients — un téléphone qui sonne pendant un
   soin, c'est le soignant qui le paie. Canal d'importance BASSE, sans
   son ni vibration.

   ⚠️ LES NOTIFICATIONS HORS APPLICATION N'EXISTENT QUE DANS L'APK
   ANDROID : ni en PWA, ni sur PC. Et Android peut décaler une alerte
   sans l'autorisation d'alarme exacte. D'où le BANDEAU À L'OUVERTURE,
   qui rattrape ce que la notification rate — téléphone silencieux,
   notification balayée sans la lire, application rouverte trois jours
   plus tard. Il signale le RETARD en rouge : une alerte passée
   inaperçue est précisément celle qui comptait.

   ⚠️ Rien de clinique ici : une alerte ne déclenche aucun soin, ne juge
   rien et n'entre dans aucune relève. C'est un pense-bête qui sonne.
============================================================ */

const ALERTE_CANAL = "jmsante-alertes";

/* L'objet posé sur une note ou sur un rappel. */
function alerteNeuve(dateISO){
  /* ⚠️ `on:false` — ÉPROUVÉ AU NAVIGATEUR : avec `on:true`, le simple fait
     d'ouvrir l'éditeur d'une note posait une alerte active, et le premier
     toucher de l'interrupteur l'ÉTEIGNAIT au lieu de l'allumer. Une
     alerte ne se crée que si on la demande. */
  return { on:false, date: dateISO || todayISO(), heure:"08:00",
           avant:[], repete:"", tel:true, app:true, vu:"" };
}

/* ⚠️ Une alerte éteinte ne se garde pas : sinon chaque note et chaque
   rappel traînerait un objet mort, qui partirait en synchro et
   grossirait les sauvegardes pour rien. */
function alerteNettoyer(obj){
  if (obj && obj.alerte && !obj.alerte.on) delete obj.alerte;
  return obj;
}

/* La date réellement visée. Un rappel a déjà sa date d'échéance : on la
   reprend plutôt que d'en demander une seconde, qui divergerait. */
function alerteDate(obj){
  const a = obj && obj.alerte;
  if (a && a.date) return a.date;
  return (obj && obj.due) || "";
}

function alerteActive(obj){
  const a = obj && obj.alerte;
  return !!(a && a.on && alerteDate(obj));
}

/* Résumé en une ligne, pour l'interrupteur replié. */
function alerteResume(obj){
  if (!alerteActive(obj)) return "aucune alerte";
  const a = obj.alerte;
  const bouts = [fmtFR(alerteDate(obj)) + " à " + (a.heure || "08:00")];
  if ((a.avant || []).length)
    bouts.push("et " + a.avant.slice().sort((x, y) => x - y)
      .map(j => j === 1 ? "la veille" : j + " jours avant").join(" · "));
  if (a.repete === "semaine") bouts.push("chaque semaine");
  if (a.repete === "mois") bouts.push("chaque mois");
  if (!a.tel && !a.app) bouts.push("⚠ aucun moyen de prévenir coché");
  return bouts.join(" · ");
}

/* ── LE BLOC D'ÉCRAN, identique dans les notes et dans les rappels ──
   `pre` préfixe les identifiants pour que deux blocs puissent coexister.
   `dateFixe` : dans un rappel, la date vient du rappel lui-même. */
function alerteBloc(obj, pre, dateFixe){
  const a = (obj.alerte = obj.alerte || alerteNeuve(alerteDate(obj) || todayISO()));
  const on = !!a.on;
  const AVANT = [[1, "la veille"], [3, "3 jours avant"], [7, "1 semaine avant"]];
  const REP = [["", "une fois"], ["semaine", "chaque semaine"], ["mois", "chaque mois"]];
  return `
    <div class="al-sw ${on ? "on" : ""}" id="${pre}-on">
      <span class="al-t">🔔 Me prévenir
        <span class="al-s">${esc(alerteResume(obj))}</span></span>
      <span class="al-k"></span>
    </div>
    ${on ? `<div class="al-det">
      ${dateFixe ? `<p class="small muted" style="margin:0 0 9px">Le jour de l'échéance du rappel, le ${esc(fmtFR(alerteDate(obj)))}.</p>`
        : `<div class="lab">Quand</div>
           <div class="rowb" style="gap:7px;margin-bottom:9px">
             <input id="${pre}-d" class="rec-in" style="flex:2" placeholder="JJ/MM/AAAA"
                    inputmode="numeric" value="${esc(jmaDepuisISO(a.date))}">
             <input id="${pre}-h" class="rec-in" style="flex:1" placeholder="08:00"
                    inputmode="numeric" value="${esc(a.heure || "08:00")}">
           </div>`}
      ${dateFixe ? `<div class="lab">À quelle heure</div>
         <input id="${pre}-h" class="rec-in" style="margin-bottom:9px;max-width:120px"
                inputmode="numeric" value="${esc(a.heure || "08:00")}">` : ""}

      <div class="lab">Me prévenir aussi avant</div>
      <div class="al-chips">
        ${AVANT.map(([j, l]) => `<button type="button" class="chip sm ${(a.avant||[]).includes(j) ? "on" : ""}"
           data-${pre}av="${j}">${l}</button>`).join("")}
      </div>

      <div class="lab">Comment</div>
      <div class="al-sw sm ${a.tel ? "on" : ""}" id="${pre}-tel">
        <span class="al-t">📱 Notification du téléphone
          <span class="al-s">même application fermée · sans sonnerie</span></span>
        <span class="al-k"></span></div>
      <div class="al-sw sm ${a.app ? "on" : ""}" id="${pre}-app">
        <span class="al-t">🔔 Bandeau à l'ouverture
          <span class="al-s">dans l'application, et rattrape ce qui a été raté</span></span>
        <span class="al-k"></span></div>

      <div class="lab">Répéter</div>
      <div class="al-chips">
        ${REP.map(([v, l]) => `<button type="button" class="chip sm ${(a.repete||"") === v ? "on" : ""}"
           data-${pre}rep="${v}">${l}</button>`).join("")}
      </div>

      ${!a.tel && !a.app ? `<div class="warn" style="margin-top:9px">Aucun moyen de prévenir n'est coché : l'alerte ne se manifestera nulle part.</div>` : ""}
      ${typeof alerteDispo === "function" && !alerteDispo() && a.tel
        ? `<div class="tip" style="margin-top:9px">Sur cet appareil, les notifications hors application ne sont pas disponibles — c'est le <b>bandeau à l'ouverture</b> qui prendra le relais.</div>` : ""}
    </div>` : ""}`;
}

/* Câblage du bloc. `redraw` redessine l'écran qui le contient. */
function alerteBind(obj, pre, redraw){
  const a = (obj.alerte = obj.alerte || alerteNeuve());
  const lire = () => {
    const d = $("#" + pre + "-d");
    if (d){ const iso = isoDepuisJMA(d.value); if (iso) a.date = iso; }
    const h = $("#" + pre + "-h");
    if (h){
      /* ⚠️ Une heure illisible ne doit pas donner une alerte à 00:00
         sans prévenir : on garde la précédente. */
      const m = /^(\d{1,2})\s*[:hH.]?\s*(\d{2})?$/.exec((h.value || "").trim());
      if (m){
        const hh = Math.min(23, +m[1]), mm = Math.min(59, +(m[2] || 0));
        a.heure = String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0");
      }
    }
  };
  { const b = $("#" + pre + "-on");
    if (b) b.onclick = () => { lire(); a.on = !a.on;
      if (a.on && !a.date) a.date = alerteDate(obj) || todayISO(); redraw(); }; }
  { const b = $("#" + pre + "-tel"); if (b) b.onclick = () => { lire(); a.tel = !a.tel; redraw(); }; }
  { const b = $("#" + pre + "-app"); if (b) b.onclick = () => { lire(); a.app = !a.app; redraw(); }; }
  $$("#sheet [data-" + pre + "av]").forEach(b => b.onclick = () => {
    lire(); a.avant = a.avant || [];
    const j = +b.dataset[pre + "av"];
    const i = a.avant.indexOf(j);
    if (i >= 0) a.avant.splice(i, 1); else a.avant.push(j);
    redraw();
  });
  $$("#sheet [data-" + pre + "rep]").forEach(b => b.onclick = () => {
    lire(); a.repete = b.dataset[pre + "rep"]; redraw();
  });
  return lire;      // à rappeler avant d'enregistrer
}

/* ── CE QUI EST DÛ ──
   ⚠️ Une alerte « en retard » n'est pas une alerte ratée : c'est celle
   qui compte le plus. Elle reste affichée tant qu'elle n'est ni cochée
   ni reportée. */
function alertesToutes(){
  const out = [];
  (S.rappels || []).forEach(r => {
    if (r.done || !alerteActive(r)) return;
    out.push({ src:"rappel", id:r.id, obj:r, date:alerteDate(r),
               titre:(typeof rapType === "function" ? rapType(r.type).lbl : "Rappel"),
               txt:r.text || "", pid:r.pid || null });
  });
  (typeof notes === "function" ? notes() : (S.notes || [])).forEach(n => {
    if (n.fait || !alerteActive(n)) return;
    out.push({ src:"note", id:n.id, obj:n, date:alerteDate(n),
               titre:"Note", txt:(n.t || n.m || ""), pid:(n.pats || [])[0] || null });
  });
  return out.sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/* Dues aujourd'hui ou avant, et pas encore acquittées pour cette date. */
function alertesDues(){
  const j = todayISO();
  return alertesToutes().filter(x =>
    x.obj.alerte.app !== false && x.date <= j && (x.obj.alerte.vu || "") < x.date);
}

/* ── LE BANDEAU À L'OUVERTURE ── */
function alertesBandeau(){
  const el = document.getElementById("albar");
  if (!el) return;
  const dues = alertesDues();
  if (!dues.length){ el.innerHTML = ""; el.style.display = "none"; return; }
  const j = todayISO();
  const retard = dues.filter(x => x.date < j);
  const auj = dues.filter(x => x.date === j);
  const ligne = x => {
    const p = x.pid ? getP(x.pid) : null;
    const qui = p ? (p.nom || "").replace("Demo-", "").toUpperCase() + " — " : "";
    return `<div class="al-li">${esc(qui)}${esc((x.txt || "").slice(0, 70))}</div>`;
  };
  el.style.display = "block";
  el.innerHTML =
    (retard.length ? `<div class="albar retard">
      <span class="al-ic">⚠️</span>
      <span class="al-bd"><b>${retard.length} alerte${retard.length>1?"s":""} en retard</b>
        ${retard.slice(0,3).map(ligne).join("")}
        ${retard.length>3?`<div class="al-li">et ${retard.length-3} autre(s)…</div>`:""}</span>
      <button class="al-x" data-alok="retard" title="J'ai vu">✓</button>
    </div>` : "") +
    (auj.length ? `<div class="albar">
      <span class="al-ic">⏰</span>
      <span class="al-bd"><b>${auj.length} alerte${auj.length>1?"s":""} aujourd'hui</b>
        ${auj.slice(0,3).map(ligne).join("")}
        ${auj.length>3?`<div class="al-li">et ${auj.length-3} autre(s)…</div>`:""}</span>
      <button class="al-x" data-alok="auj" title="J'ai vu">✓</button>
    </div>` : "");

  el.querySelectorAll("[data-alok]").forEach(b => b.onclick = () => {
    /* ⚠️ « J'ai vu » n'efface RIEN : il marque la date comme acquittée.
       Le rappel ou la note restent dans leur liste, à cocher ou non —
       sinon un geste d'un instant ferait disparaître le travail à faire. */
    const quoi = b.dataset.alok;
    const cible = quoi === "retard" ? retard : auj;
    cible.forEach(x => { x.obj.alerte.vu = x.date; });
    save();
    alertesBandeau();
    toast(cible.length + " alerte" + (cible.length>1?"s":"") + " mise" + (cible.length>1?"s":"") + " de côté");
  });
}

/* ── LES NOTIFICATIONS D'ANDROID ── */
function alerteDispo(){
  const cap = window.Capacitor;
  return !!(cap && cap.isNativePlatform && cap.isNativePlatform()
            && cap.Plugins && cap.Plugins.LocalNotifications);
}

/* Identifiant stable et numérique, exigé par Android. */
function _alId(cle){
  let h = 0;
  for (let i = 0; i < cle.length; i++) h = (h * 31 + cle.charCodeAt(i)) | 0;
  return Math.abs(h) % 2000000 + 1;
}

/* Les dates à programmer pour une alerte : le jour J, et les rappels
   anticipés. La répétition est portée par Android lui-même. */
function alerteEcheances(x){
  const a = x.obj.alerte, out = [];
  const [hh, mm] = String(a.heure || "08:00").split(":");
  const pose = (iso, tag) => {
    const d = new Date(iso + "T00:00:00");
    d.setHours(+hh || 8, +mm || 0, 0, 0);
    if (d > new Date()) out.push({ quand:d, tag });
  };
  pose(x.date, "J");
  (a.avant || []).forEach(j => {
    const d = new Date(x.date + "T00:00:00");
    d.setDate(d.getDate() - j);
    pose(d.toISOString().slice(0, 10), "J-" + j);
  });
  return out;
}

async function alerteCanal(){
  const { LocalNotifications } = window.Capacitor.Plugins;
  if (!LocalNotifications.createChannel) return;
  /* ⚠️ IMPORTANCE BASSE (2) : l'alerte s'affiche dans la barre de
     notifications et rien de plus — pas de son, pas de vibration, pas
     de surgissement par-dessus l'écran. C'est ce qu'il a demandé, et
     c'est ce qui la rend utilisable chez un patient. */
  try {
    await LocalNotifications.createChannel({
      id: ALERTE_CANAL, name: "Alertes JM@Santé",
      description: "Rappels et notes datés",
      importance: 2, visibility: 1, sound: undefined, vibration: false
    });
  } catch(e){ console.warn("canal:", e); }
}

/* ⚠️ APPELÉE APRÈS CHAQUE ENREGISTREMENT (voir le branchement en bas de
   ce fichier) : c'est précisément ce qui manquait. On annule tout et on
   reprogramme, plutôt que de tenir une comptabilité des différences —
   une alerte en trop est bien plus visible qu'une alerte manquante. */
let _alT = null;
async function alerteProgrammer(){
  if (!alerteDispo()) return;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== "granted") return;
    await alerteCanal();

    const enCours = await LocalNotifications.getPending();
    if (enCours.notifications && enCours.notifications.length)
      await LocalNotifications.cancel({ notifications: enCours.notifications });

    const notifs = [];
    alertesToutes().filter(x => x.obj.alerte.tel !== false).forEach(x => {
      const p = x.pid ? getP(x.pid) : null;
      const qui = p ? (p.nom || "").replace("Demo-", "").toUpperCase() + " " + (p.prenom || "") : "";
      alerteEcheances(x).forEach(e => {
        const n = {
          id: _alId(x.src + x.id + e.tag),
          title: (e.tag === "J" ? "⏰ " : "📅 " + e.tag + " · ") + x.titre,
          body: (qui ? qui + " — " : "") + String(x.txt).slice(0, 90),
          schedule: { at: e.quand, allowWhileIdle: true },
          channelId: ALERTE_CANAL,
          sound: undefined, smallIcon: "ic_stat_icon_config_sample",
          extra: { src:x.src, id:x.id }
        };
        /* La répétition n'est posée que sur l'échéance du jour J. */
        const r = x.obj.alerte.repete;
        if (r === "semaine" && e.tag === "J") n.schedule.every = "week";
        if (r === "mois" && e.tag === "J") n.schedule.every = "month";
        notifs.push(n);
      });
    });
    if (notifs.length) await LocalNotifications.schedule({ notifications: notifs });
  } catch(e){ console.warn("alertes:", e); }
}

/* Demande d'autorisation — au moment où l'utilisateur pose SA première
   alerte, pas au démarrage : une permission demandée sans raison visible
   se refuse par réflexe. */
async function alerteDemander(){
  if (!alerteDispo()) return false;
  try {
    const { LocalNotifications } = window.Capacitor.Plugins;
    let p = await LocalNotifications.checkPermissions();
    if (p.display !== "granted") p = await LocalNotifications.requestPermissions();
    if (p.display === "granted"){ await alerteCanal(); await alerteProgrammer(); return true; }
    return false;
  } catch(e){ return false; }
}

/* ⚠️ LE BRANCHEMENT QUI MANQUAIT. L'ancienne version déclarait une
   fonction `_hookedSave` et ne l'installait nulle part : `save` n'était
   jamais remplacé, donc rien n'était reprogrammé après une modification.
   Ici on remplace réellement, et on temporise — une saisie déclenche
   plusieurs enregistrements d'affilée, on ne reprogramme qu'une fois. */
(function brancherAlertes(){
  if (typeof window === "undefined" || typeof save !== "function") return;
  if (window._alBranche) return;
  window._alBranche = true;
  const vrai = save;
  window.save = function(){
    const r = vrai.apply(this, arguments);
    clearTimeout(_alT);
    _alT = setTimeout(() => { try { alerteProgrammer(); } catch(e){} }, 800);
    return r;
  };
})();
