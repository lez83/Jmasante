/* ══════════════════════════════════════════════════════════════
   TROIS FONCTIONS QUI MARCHAIENT SANS PORTE          (v1.31.0)
   ─────────────────────────────────────────────────────────────
   ⚠️ LA MÊME FAMILLE QUE `sheetBrouillonPour` : du code complet,
   éprouvé, que personne ne pouvait atteindre. Trouvées en rendant
   lisible le compteur des fonctions mortes — qui criait 28 fois et
   n'était donc plus lu.

   ① `reprendrePEC` — on clôturait une prise en charge et on ne la
      rouvrait jamais. La liste n'offrait que « Ouvrir » et
      « Supprimer définitivement » : un patient qui revenait après une
      interruption devait être RECRÉÉ.

   ② `voiceEffacer` — le réglage proposait « à la main », qui coupe la
      purge automatique. Et rien ne permettait cette main : aucune
      liste, aucun bouton. Des enregistrements sur des patients, sur
      l'appareil, sans issue.

   ③ `sheetBilanTournee` — 58 lignes (patients vus ET NON VUS, alertes,
      rappels dus, bilans à faire) appelées de nulle part. Posé au bout
      du déroulé, là où l'on vient de finir — pas au fond des réglages,
      où l'on ne passe pas en tournée.

   ⚠️ ET UNE TEMPORISATION QUI N'ÉTAIT PAS UN FAIT : l'export d'une
   sauvegarde enchaînait sur un autre écran 900 ms après l'appel — or
   il commence par poser une question. Mesuré : à 1 200 ms la question
   était toujours affichée et le panneau était déjà passé de « Mes
   données » à « Réglages ». On lisait un avertissement sur la
   confidentialité de sa sauvegarde pendant que l'app partait ailleurs.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(R,u); if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>srv.listen(8232,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,90)));
 await pg.goto('http://localhost:8232/index.html'); await pg.waitForTimeout(2700);
 const pid=await pg.evaluate(()=>{S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;openId=null;render();return S.patients[0].id;});
 const r=await pg.evaluate(async(P)=>{
  const L=[]; const dire=(k,v)=>L.push("  "+k+" : "+(typeof v==="object"?JSON.stringify(v).slice(0,110):v));
  // ① REPRENDRE UNE PRISE EN CHARGE
  const p=getP(P); p.pec={end:todayISO(),motif:"hospitalisation"}; save(true);
  closeSheet(true); await new Promise(r=>setTimeout(r,250));
  sheetPECList(); await new Promise(r=>setTimeout(r,650));
  const rep=document.querySelector('#sheet [data-pecrep]');
  dire("① bouton Reprendre présent", !!rep);
  if (rep){ rep.click(); await new Promise(r=>setTimeout(r,500));
    const y=document.querySelector('.dlg-veil [data-yes]'); if(y) y.click();
    await new Promise(r=>setTimeout(r,700));
    dire("① la prise en charge est rouverte", !getP(P).pec); }
  // ② EFFACER UNE NOTE VOCALE
  S.voiceNotes=[{id:"v1",dur:34,taille:215000,at:new Date().toISOString()},
                {id:"v2",dur:12,taille:90000,at:new Date().toISOString()}];
  S.voiceRetention="manuel"; save(true);
  closeSheet(true); await new Promise(r=>setTimeout(r,250));
  sheetDataPanel(); await new Promise(r=>setTimeout(r,700));
  dire("② notes listées", document.querySelectorAll('#sheet [data-vdelgard]').length);
  dire("② bouton tout effacer", !!document.getElementById('v-tout'));
  const d1=document.querySelector('#sheet [data-vdelgard]');
  if (d1){ d1.click(); await new Promise(r=>setTimeout(r,450));
    const y=document.querySelector('.dlg-veil [data-yes]'); if(y) y.click();
    await new Promise(r=>setTimeout(r,800));
    dire("② après effacement, il reste", (S.voiceNotes||[]).length); }
  // ③ LE BILAN DE TOURNÉE
  closeSheet(true); await new Promise(r=>setTimeout(r,250));
  seqEndScreen((S.patients||[]).slice(0,4), null, false);
  await new Promise(r=>setTimeout(r,650));
  const bb=document.getElementById('sqe-bilan');
  dire("③ bouton du bilan présent", !!bb);
  if (bb){ bb.click(); await new Promise(r=>setTimeout(r,800));
    dire("③ l'écran du bilan s'ouvre", (document.querySelector('#sheet h3')||{textContent:''}).textContent.trim().slice(0,34)); }
  // ④ L'EXPORT NE DOIT PLUS CHANGER D'ÉCRAN PENDANT QU'IL POSE SA QUESTION
  closeSheet(true); await new Promise(r=>setTimeout(r,250));
  S.bkAvertiVu = false;                       // pour que la question se pose
  sheetDataPanel(); await new Promise(r=>setTimeout(r,650));
  const titre = () => (document.querySelector('#sheet h3')||{textContent:''}).textContent.trim().slice(0,30);
  const avant = titre();
  const bs = document.getElementById('bk-save');
  if (!bs) { dire("④ bouton de sauvegarde", "ABSENT"); return L; }
  bs.click();
  await new Promise(r=>setTimeout(r,1300));   // bien au-delà des 900 ms d'avant
  dire("④ question encore posée à 1300 ms", !!document.querySelector('.dlg-veil, .dlg-card'));
  dire("④ l'écran a-t-il bougé sous la question", titre() !== avant);
  { const n=document.querySelector('.dlg-veil [data-no], .dlg-cancel'); if(n) n.click(); }
  await new Promise(r=>setTimeout(r,500));

  // ⑤ UNE AIDE MASQUÉE DOIT POUVOIR REVENIR
  // Le code existait (aides-reset) ; son bouton avait disparu avec un
  // ancien écran d'affichage, en même temps que dotpick et monpick.
  S.aides={}; save(true); closeSheet(true); await new Promise(r=>setTimeout(r,250));
  sheetAppPanel(); await new Promise(r=>setTimeout(r,600));
  dire("⑤ sans aide masquée, pas de bouton", !document.getElementById('aides-reset'));
  S.aides={a:true,b:true}; save(true); closeSheet(true); await new Promise(r=>setTimeout(r,250));
  sheetAppPanel(); await new Promise(r=>setTimeout(r,600));
  const ar=document.getElementById('aides-reset');
  dire("⑤ avec 2 masquées, le bouton est là", !!ar);
  if (ar){ ar.click(); await new Promise(r=>setTimeout(r,700));
    dire("⑤ après le clic, il reste", Object.keys(S.aides||{}).length); }

  // ⑥ LE STOCKAGE DURABLE : la réponse était jetée
  await requestPersistentStorage(); await new Promise(r=>setTimeout(r,300));
  dire("⑥ l'état est connu", S.stockageDurable || "(non renseigné)");
  closeSheet(true); await new Promise(r=>setTimeout(r,250));
  sheetSante(); await new Promise(r=>setTimeout(r,800));
  dire("⑥ la Santé le dit", /[Ss]tockage durable/.test((document.getElementById('sheet')||{textContent:''}).textContent));

  closeSheet(true);
  return L;
 }, pid);
 let ko=0;
 const vrai=(c,q,d)=>{ if(c) console.log("  ✓ "+q); else { ko++; console.log("  ✗ "+q+(d!==undefined?"  → "+d:"")); } };
 const val=k=>{ const l=r.find(x=>x.indexOf(k)>=0); return l? l.split(" : ").slice(1).join(" : ") : "(absent)"; };
 console.log("");
 vrai(val("① bouton Reprendre")==="true", "① la liste des prises en charge offre « Reprendre »", val("① bouton Reprendre"));
 vrai(val("① la prise en charge est rouverte")==="true", "① et elle rouvre vraiment le dossier", val("① la prise en charge est rouverte"));
 vrai(Number(val("② notes listées"))===2, "② les notes vocales conservées sont listées", val("② notes listées"));
 vrai(val("② bouton tout effacer")==="true", "② « Tout effacer maintenant » est là", val("② bouton tout effacer"));
 vrai(Number(val("② après effacement, il reste"))===1, "② effacer une note l'enlève pour de bon", val("② après effacement, il reste"));
 vrai(val("③ bouton du bilan")==="true", "③ le bout du déroulé mène au bilan", val("③ bouton du bilan"));
 vrai(/Bilan de tourn/.test(val("③ l'écran du bilan")), "③ et l'écran du bilan s'ouvre", val("③ l'écran du bilan"));
 vrai(val("④ question encore posée à 1300 ms")==="true", "④ l'export pose bien sa question et l'y laisse", val("④ question encore posée à 1300 ms"));
 vrai(val("④ l'écran a-t-il bougé sous la question")==="false", "④ et l'écran ne bouge plus sous elle", val("④ l'écran a-t-il bougé sous la question"));
 vrai(val("⑤ sans aide masquée")==="true", "⑤ pas de bouton quand il n'y a rien à rappeler", val("⑤ sans aide masquée"));
 vrai(val("⑤ avec 2 masquées")==="true", "⑤ le bouton apparaît quand des aides sont masquées", val("⑤ avec 2 masquées"));
 vrai(Number(val("⑤ après le clic, il reste"))===0, "⑤ et elles réapparaissent toutes", val("⑤ après le clic, il reste"));
 vrai(["accorde","refuse","indisponible"].indexOf(val("⑥ l'état est connu"))>=0, "⑥ la réponse du navigateur n'est plus jetée", val("⑥ l'état est connu"));
 vrai(val("⑥ la Santé le dit")==="true", "⑥ et la Santé de l'application l'affiche", val("⑥ la Santé le dit"));
 vrai(errs.length===0, "aucune erreur JS", errs[0]);
 console.log("\n>>> "+(15-ko)+"/15 vérifications\n");
 await nav.close(); srv.close(); process.exit(ko ? 1 : 0);
})();
