/* ══════════════════════════════════════════════════════════════
   LE SERVICE WORKER LIVRE-T-IL LA MISE À JOUR ?        (v1.35.0)
   ─────────────────────────────────────────────────────────────
   Signalé à l'usage : « j'ai bien la version 1.34.0 et pourtant je ne
   vois pas ton interrupteur ou quoi que ce soit ».

   ⚠️ L'ENVELOPPE SE METTAIT À JOUR, LE CODE JAMAIS. Deux choses se
   combinaient :
   • le nom du cache était écrit EN DUR dans sw.js — « jmsante-v215 » —
     et n'avait pas bougé depuis des dizaines de versions. Le code qui
     purge les vieux caches ne se déclenche QUE si le nom change : il
     ne s'est jamais déclenché ;
   • `caches.match(req, {ignoreSearch:true})` rend la PREMIÈRE entrée
     trouvée, celle posée à l'installation, tandis que le
     rafraîchissement d'arrière-plan rangeait sous `req`, marqueur
     compris. Le nouveau code était téléchargé, rangé sous
     « app.js?v=1.34.0 », et jamais lu.
   Mesuré avant correction : quatre rechargements après une mise à
   jour, toujours l'ancien code, et TROIS entrées pour app.js —
   « /js/app.js », « ?v=1.33.0 », « ?v=1.34.0 ».

   ⚠️ ELLE GARDE AUTANT LE HORS LIGNE QUE LA MISE À JOUR. Une correction
   qui livrerait les nouveautés en cassant la tournée serait pire que le
   défaut qu'elle répare : l'épreuve coupe le réseau et exige que l'app
   s'ouvre quand même, avec le NOUVEAU code.

   ⚠️ ET ELLE A DÉJÀ ATTRAPÉ MA PROPRE CORRECTION : un `const` posé à
   l'intérieur de `respondWith(…)` rendait sw.js impossible à parser.
   Le navigateur refuse alors l'enregistrement en silence, la page
   tourne sans service worker — plus de cache, plus de hors ligne — et
   la compilation disait « Vérification OK », car elle ne regardait que
   app.js. Elle vérifie sw.js depuis.

   ⚠️ DEUX RECHARGEMENTS SONT NORMAUX : le premier sert encore l'ancien
   service worker, qui installe le nouveau. C'est le comportement du
   navigateur, pas un défaut — l'épreuve l'admet et le dit.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs');
const SW0 = fs.readFileSync('/home/claude/jmsante/www/sw.js','utf-8');

let VER = 'ANCIENNE', MARQUE = '9.9.8';
/* Comme build.js le fait à chaque compilation : le nom du cache porte
   la version. C'est tout l'objet de la mesure. */
const SW = () => SW0.replace(/const CACHE = "jmsante-[^"]*";/,
                             'const CACHE = "jmsante-v' + MARQUE + '";');
const page = () => `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>maj</title></head><body><div id="out">?</div>
<script src="js/app.js?v=${MARQUE}"></script>
<script>
navigator.serviceWorker.register('sw.js').catch(()=>{});
document.getElementById('out').textContent = window.__VER || 'rien';
</script></body></html>`;
const srv = http.createServer((q,r)=>{
  const u = q.url.split('?')[0];
  const env = (t,c)=>{ r.writeHead(200,{'Content-Type':t,'Cache-Control':'no-store'}); r.end(c); };
  if (u === '/' || u === '/index.html') return env('text/html', page());
  if (u === '/sw.js')                   return env('text/javascript', SW());
  if (u === '/js/app.js')               return env('text/javascript', `window.__VER=${JSON.stringify(VER)};`);
  r.writeHead(200,{'Content-Type':'text/plain'}); r.end('');
});

(async()=>{
 await new Promise(r=>srv.listen(8237,r));
 const L=[]; const ok=(n,c,d)=>L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);

 /* Avant tout : sw.js doit se parser, sinon rien de ce qui suit n'a de sens. */
 try { new Function(SW0); ok('sw.js se parse', true); }
 catch(e){ ok('sw.js se parse', false, e.message); }
 /* ⚠️ IL NE SUFFIT PAS QU'IL RESSEMBLE À UNE VERSION : il doit être LA
    version du moment. « jmsante-v215 » passait un contrôle de forme
    pendant des dizaines de livraisons. On le compare donc à
    package.json, ce que build.js est censé garantir à chaque
    compilation. Un défaut planté exprès l'a montré : le contrôle de
    forme seul ne mordait pas. */
 const pkg = JSON.parse(fs.readFileSync('/home/claude/jmsante/package.json','utf-8'));
 const nomCache = (SW0.match(/const CACHE = "([^"]*)"/)||[])[1] || '?';
 ok('le nom du cache est celui de la version du jour',
    nomCache === 'jmsante-v' + pkg.version,
    nomCache + ' au lieu de jmsante-v' + pkg.version);

 const nav = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx = await nav.newContext();
 const pg  = await ctx.newPage();
 const lu  = async () => { try { return await pg.textContent('#out',{timeout:5000}) || '?'; }
                           catch(e){ return '(page non chargée)'; } };
 const etat = async () => { try { return await pg.evaluate(async () => ({
     ctrl: !!navigator.serviceWorker.controller,
     caches: await caches.keys(),
     appjs: await (async () => {
       const k = await caches.keys(); const out = [];
       for (const n of k){ const c = await caches.open(n);
         (await c.keys()).forEach(r => { if (/app\.js/.test(r.url)) out.push(r.url.replace(location.origin,'')); }); }
       return out;
     })()
   }), {timeout:5000}); } catch(e){ return { ctrl:false, caches:[], appjs:[] }; } };

 await pg.goto('http://localhost:8237/index.html'); await pg.waitForTimeout(1300);
 await pg.reload(); await pg.waitForTimeout(1100);
 let e = await etat();
 ok('le service worker prend la main', e.ctrl === true);
 ok('il a posé son cache', e.caches.length === 1, JSON.stringify(e.caches));
 ok('avant la mise à jour : l’ancien code', (await lu()) === 'ANCIENNE');

 /* ── LA LIVRAISON : nouveau code, nouvelle version ── */
 VER = 'NOUVELLE'; MARQUE = '9.9.9';
 let vu = [], quand = 0;
 for (let i = 1; i <= 4; i++){
   await pg.reload(); await pg.waitForTimeout(1100);
   const t = await lu(); vu.push(t);
   if (t === 'NOUVELLE' && !quand) quand = i;
 }
 ok('le nouveau code finit par arriver', vu.includes('NOUVELLE'), vu.join(' → '));
 ok('et il arrive en deux rechargements au plus', quand > 0 && quand <= 2,
    quand ? 'au ' + quand + 'e' : 'jamais');
 ok('il ne repart pas en arrière ensuite',
    vu.slice(quand).every(x => x === 'NOUVELLE'), vu.join(' → '));

 /* ⚠️ ON ATTEND L'ÉTAT, PAS LE CHRONOMÈTRE. Avec une pause fixe de
    1,6 s, le service worker était encore « activating » : deux caches
    coexistaient et deux contrôles tombaient sur ce seul décalage. À
    4,6 s la purge était faite. Une temporisation n'est pas un fait. */
 const active = await pg.evaluate(async () => {
   const r = await navigator.serviceWorker.getRegistration();
   if (!r) return 'aucun enregistrement';
   for (let i = 0; i < 60; i++){
     if (r.active && r.active.state === 'activated') return 'activated';
     await new Promise(x => setTimeout(x, 150));
   }
   return r.active ? r.active.state : 'sans worker actif';
 });
 ok('le nouveau service worker s\u2019active', active === 'activated', active);
 /* Et la purge est asynchrone même une fois activé : on attend qu'elle
    ait eu lieu, au lieu de la supposer faite. */
 /* ⚠️ ON ATTEND LE BON CACHE, PAS UN COMPTE. « un seul cache » était
    vrai au milieu de la purge, à l'instant où l'ancien subsistait seul :
    l'épreuve relevait alors jmsante-v9.9.8 et criait au défaut. */
 for (let i = 0; i < 60; i++){
   e = await etat();
   if (e.caches.length === 1 && e.caches[0] === 'jmsante-v9.9.9') break;
   await pg.waitForTimeout(150);
 }
 /* ⚠️ UNE SEULE ENTRÉE POUR app.js, ET SANS MARQUEUR. C'est le cœur du
    défaut : avec trois clés — « /js/app.js », « ?v=1.33.0 »,
    « ?v=1.34.0 » — `caches.match(…, {ignoreSearch:true})` rend
    toujours la première, c'est-à-dire la plus ancienne. */
 ok('une seule entrée en cache pour app.js', e.appjs.length === 1, JSON.stringify(e.appjs));
 ok('et elle n\u2019a pas de marqueur ?v=', !/\?v=/.test(e.appjs.join('')), JSON.stringify(e.appjs));
 ok('le vieux cache a été purgé',
    e.caches.length === 1 && !e.caches.includes('jmsante-v9.9.8'), JSON.stringify(e.caches));

 /* ── LE HORS LIGNE, RAISON D'ÊTRE DE CE CACHE ── */
 await ctx.setOffline(true);
 await pg.reload({ waitUntil:'load' }).catch(()=>{});
 await pg.waitForTimeout(900);
 const horsLigne = await lu();
 ok('hors ligne, l’application s’ouvre encore', horsLigne !== '(page non chargée)', horsLigne);
 ok('hors ligne, c’est le NOUVEAU code qui sert', horsLigne === 'NOUVELLE', horsLigne);
 await ctx.setOffline(false);

 let ko=0; for(const [v,n,d] of L){ if(v!=='OK')ko++; console.log(`${v==='OK'?'  ✓':'  ✗'} ${n}${d?'   ['+d+']':''}`); }
 console.log(`\n${L.length-ko}/${L.length} contrôles`);
 await nav.close(); srv.close(); process.exit(ko?1:0);
})();
