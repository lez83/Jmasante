/* ══════════════════════════════════════════════════════════════
   TOUS LES GESTES DES RÉGLAGES, DANS LES DEUX PRÉSENTATIONS
                                                      (v1.35.0)
   ─────────────────────────────────────────────────────────────
   Signalé à l'usage : « quand je mets les paramètres en mode liste,
   le bouton sauvegarder ne fonctionne plus. Avec l'autre mode, pas de
   problème. »

   ⚠️ IL N'ÉTAIT PAS SEUL : QUATRE LIGNES SUR TRENTE-DEUX ne menaient
   nulle part — Sauvegarde (`bk`), Journal des envois (`envois`),
   Conservation des données (`menage`) et Mes modèles (`modeles`).
   Leurs clés ne correspondaient à aucune destination de `menuGo`,
   alors que trois destinations voisines existaient sous d'autres noms
   (`backup`, `sendlog`, `clean`), jamais atteintes. Elles tombaient
   donc sur `default`, qui ROUVRAIT LES RÉGLAGES : à l'œil, rien ne se
   passe, et le bouton a l'air cassé.

   ⚠️ LES 19 GESTES DU MODE TUILES ÉTAIENT TOUS BRANCHÉS. Le défaut ne
   se voyait que dans l'autre présentation — c'est pour ça que cette
   épreuve balaie LES DEUX, et non celle qu'on a sous les yeux.

   ⚠️ ELLE NE LIT PAS LE CODE, ELLE TOUCHE. Un contrôle qui vérifierait
   qu'une clé a bien un `case` passerait à côté d'un `case` qui ne fait
   rien. Chaque geste est donc réellement déclenché, et l'épreuve
   vérifie qu'on a QUITTÉ l'écran des Réglages — c'est exactement ce
   que l'utilisateur constate : l'écran change, ou il ne change pas.

   ⚠️ DEUX GESTES NE CHANGENT PAS D'ÉCRAN, ET C'EST NORMAL : « Recevoir »
   ouvre le sélecteur de fichiers du système (invisible au DOM), et
   « Feuille de route » referme le panneau pour partager. Ils sont
   mesurés autrement, pas exemptés.

   ⚠️ ET ELLE NE DOIT RIEN DÉTRUIRE : « Recharger la démo » et « Tout
   effacer » ouvrent une confirmation. L'épreuve répond NON à chaque
   fois, et vérifie à la fin que les dossiers sont toujours là.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(R,u); if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>srv.listen(8236,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
 await pg.goto('http://localhost:8236/index.html'); await pg.waitForTimeout(2700);

 const r = await pg.evaluate(async()=>{
  const L=[]; const ok=(n,c,d)=>L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);
  const requis = ['sheetTours','menuGo','logIncident'];
  const manque = requis.filter(n => typeof window[n] !== 'function');
  ok('les fonctions du menu existent', manque.length===0, 'manquent : '+manque.join(', '));
  if (manque.length) return {L};

  S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;
  /* ⚠️ LES ESSAIS OUVERTS, SINON LE BALAYAGE EST INCOMPLET. Cinq entrées
     sont conditionnées par `essaiActif(...)` — dont « Mes modèles », qui
     est précisément l'une des quatre lignes mortes. Mesuré : sans ça,
     15 tuiles au lieu de 19 et 27 lignes au lieu de 32. */
  S.essais = { documents:true, dispositifs:true, bilans:true, narratif:true, calculs:true };
  save(true);
  const nPat = S.patients.length;

  const dort = ms => new Promise(r=>setTimeout(r,ms));
  const reglages = async mode => { S.menuMode = mode; save(); sheetTours(); await dort(220); };
  /* ⚠️ `closeSheet()` NE VIDE PAS LE PANNEAU : il décroche seulement le
     voile, et le HTML des Réglages reste dans le DOM. Chercher
     `.mswitch` seul faisait passer « Feuille de route » pour un geste
     mort alors qu'il referme et partage. On regarde donc si le panneau
     est AFFICHÉ, pas s'il existe. */
  const surReglages = () => !!document.querySelector('#sheet .mswitch')
                          && document.getElementById('veil').classList.contains('on');
  /* On répond NON à toute confirmation, et on le dit. */
  const fermerDialogue = async () => {
    const no = document.querySelector('[data-no]');
    if (no){ no.click(); await dort(140); return true; }
    return false;
  };
  /* « Recevoir » ne change pas d'écran : il ouvre le sélecteur de
     fichiers du système. On espionne le clic plutôt que l'écran. */
  let fichierOuvert = 0;
  const inp = document.getElementById('syncfile');
  if (inp) inp.addEventListener('click', e => { fichierOuvert++; e.preventDefault(); });
  ok('le sélecteur de fichier de la synchro existe', !!inp);

  const balayer = async mode => {
    await reglages(mode);
    const gestes = [...document.querySelectorAll('#sheet [data-sec]')]
      .map(b => ({ cle: b.dataset.sec, lbl: (b.textContent||'').replace(/\s+/g,' ').trim().slice(0,38) }));
    ok(mode + ' : des gestes à toucher', gestes.length > 0, String(gestes.length));
    const morts = [], dialogues = [];
    for (const g of gestes){
      await reglages(mode);
      const avantFic = fichierOuvert;
      try { menuGo(g.cle); } catch(e){ morts.push(g.lbl + ' [' + g.cle + '] LÈVE ' + e); continue; }
      await dort(220);
      if (await fermerDialogue()) dialogues.push(g.cle);
      const parti = !surReglages() || (fichierOuvert > avantFic);
      if (!parti) morts.push(g.lbl + ' [' + g.cle + ']');
    }
    ok(mode + ' : les ' + gestes.length + ' gestes mènent quelque part',
       morts.length===0, morts.join(' · '));
    return { n: gestes.length, dialogues: dialogues };
  };

  const t = await balayer('tiles');
  const l = await balayer('list');
  ok('les deux présentations ont été balayées en entier',
     t.n >= 19 && l.n >= 32, t.n + ' tuiles · ' + l.n + ' lignes');
  ok('les confirmations ont bien été refusées',
     t.dialogues.concat(l.dialogues).length > 0, 'aucune confirmation rencontrée');
  ok('rien n’a été effacé pendant le balayage', S.patients.length === nPat,
     S.patients.length + ' au lieu de ' + nPat);

  /* ── Le défaut d'origine, nommément ── */
  await reglages('list');
  const bk = [...document.querySelectorAll('#sheet [data-sec]')].find(b => b.dataset.sec === 'bk');
  ok('mode liste : la ligne Sauvegarde est là', !!bk);
  if (bk){
    bk.click(); await dort(260);
    ok('mode liste : Sauvegarde ouvre un écran, et pas les Réglages',
       !surReglages(), 'on est resté sur les Réglages');
    ok('mode liste : c’est bien l’écran des données',
       /Sauvegarde|sauvegarde/.test(document.getElementById('sheet').innerHTML));
  }

  /* ── Une clé inconnue doit CRIER, pas rouvrir les Réglages en silence ── */
  const avant = (S.incidents||[]).length;
  menuGo('cle-qui-n-existe-pas'); await dort(220);
  ok('une destination manquante est journalisée',
     (S.incidents||[]).length === avant + 1,
     'incidents : ' + avant + ' → ' + (S.incidents||[]).length);
  ok('et le journal nomme la clé fautive',
     /cle-qui-n-existe-pas/.test(JSON.stringify((S.incidents||[])[0] || {})));

  /* ── Les noms redéclarés : la seconde déclaration gagne en silence ── */
  ok('ficheHtml est bien celle de la fiche patient',
     typeof ficheHtml === 'function' && ficheHtml.length === 4,
     'arité ' + (typeof ficheHtml === 'function' ? ficheHtml.length : '?'));
  ok('sheetBilans est bien l’écran des bilans d’un patient',
     typeof sheetBilans === 'function' && sheetBilans.length === 1,
     'arité ' + (typeof sheetBilans === 'function' ? sheetBilans.length : '?'));
  ok('le guide des tubes a son propre nom', typeof sheetBilansGuide === 'function');
  await sheetBilans(S.patients[0].id); await dort(240);
  ok('le bouton 🧪 d’un patient ouvre SES bilans, pas le guide',
     /Bilans \/ RDV/.test(document.getElementById('sheet').innerHTML));
  sheetBilansGuide(); await dort(240);
  ok('et le guide des tubes s’ouvre toujours',
     /tube|repère|prélèvement/i.test(document.getElementById('sheet').innerHTML));

  return {L};
 });

 let ko=0; for(const [v,n,d] of r.L){ if(v!=='OK')ko++; console.log(`${v==='OK'?'  ✓':'  ✗'} ${n}${d?'   ['+d+']':''}`); }
 if(errs.length) console.log('── incidents ──\n'+errs.slice(0,6).join('\n'));
 console.log(`\n${r.L.length-ko}/${r.L.length} contrôles`);
 await nav.close(); srv.close(); process.exit(ko?1:0);
})();
