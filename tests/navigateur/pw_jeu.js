// Le jeu « Tubulure » — la sortie ne recouvre plus rien, le pavé est au
// pouce, et les scores s'ouvrent.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8127,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 // Format du téléphone de la capture : 448 × 972 points.
 const pg=await (await nav.newContext({viewport:{width:448,height:972}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8127/index.html'); await pg.waitForTimeout(2600);
 await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false; save(); render(); ouvrirJeu(); });
 await pg.waitForTimeout(2200);

 console.log('═══ LA SORTIE NE RECOUVRE PLUS RIEN ═══');
 ok('la barre existe', await pg.isVisible('#jeu-barre'));
 ok('et le bouton de sortie est dedans',
    await pg.evaluate(()=>!!document.querySelector('#jeu-barre #jeu-sortie')));
 // ⚠️ LE DÉFAUT : la pastille flottante couvrait 🏆 SCORES et 🔊 SON.
 const geo=await pg.evaluate(()=>{
   const b=document.getElementById('jeu-sortie').getBoundingClientRect();
   const f=document.querySelector('#jeu-plein iframe').getBoundingClientRect();
   return { bas:Math.round(b.bottom), haut:Math.round(f.top),
            pos:getComputedStyle(document.getElementById('jeu-sortie')).position };
 });
 ok('elle n est plus en position fixe par-dessus le jeu', geo.pos!=='fixed', geo.pos);
 ok('et elle est entièrement AU-DESSUS du cadre', geo.bas <= geo.haut + 1,
    'bas du bouton '+geo.bas+' vs haut du cadre '+geo.haut);

 const F=pg.frameLocator('#jeu-plein iframe');
 const fr=pg.frames().find(f=>/tubulure/.test(f.url()));
 ok('le jeu est chargé', !!fr);
 // Les boutons du jeu doivent être libres de tout recouvrement.
 const libre=await pg.evaluate(()=>{
   const f=document.querySelector('#jeu-plein iframe').getBoundingClientRect();
   const b=document.getElementById('jeu-sortie').getBoundingClientRect();
   return !(b.bottom > f.top && b.top < f.bottom && b.right > f.left && b.left < f.right);
 });
 ok('aucun recouvrement du cadre par la sortie', libre);

 console.log('\n═══ LES SCORES S OUVRENT ═══');
 const sc=await fr.evaluate(()=>{
   const b=document.getElementById('btn-show-scores');
   const r=b.getBoundingClientRect();
   // Qui reçoit le toucher au centre du bouton ?
   const cible=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
   return { existe:!!b, atteignable: cible===b || b.contains(cible),
            cible: cible ? (cible.id || cible.tagName) : null,
            haut: Math.round(r.top) };
 });
 ok('le bouton 🏆 SCORES existe', sc.existe);
 // ⚠️ Avant, c'est « ✕ Quitter » du parent qui recevait le toucher.
 ok('et c est bien LUI qui reçoit le toucher', sc.atteignable, 'reçu par : '+sc.cible);
 ok('il n est pas sous la barre d état du téléphone', sc.haut >= 0, String(sc.haut));
 await F.locator('#btn-show-scores').click(); await pg.waitForTimeout(500);
 ok('la fenêtre des scores s ouvre',
    await fr.evaluate(()=>!document.getElementById('modal-scores').classList.contains('hidden')));
 const lignes=await fr.evaluate(()=>({
   n: document.querySelectorAll('#scores-tbody tr').length,
   txt: document.getElementById('scores-tbody').textContent.trim().slice(0,40)
 }));
 ok('et elle contient des lignes', lignes.n>0, JSON.stringify(lignes));
 ok('le titre est lisible', await F.locator('#modal-scores .modal-title').isVisible());
 // ⚠️ Stockage refusé → une phrase, pas quatre en-têtes au-dessus de rien.
 const vide=await fr.evaluate(()=>{
   const vrai=window.getHighScores; window.getHighScores=()=>[];
   renderScoresTable();
   const t=document.getElementById('scores-tbody').textContent;
   window.getHighScores=vrai; renderScoresTable();
   return t;
 });
 ok('un tableau vide le dit au lieu de rester blanc', /Aucun score/.test(vide), JSON.stringify(vide));
 await F.locator('#btn-close-scores').click(); await pg.waitForTimeout(400);

 console.log('\n═══ LE PAVÉ, AU POUCE ═══');
 const d=await fr.evaluate(()=>{
   const q=i=>document.getElementById(i).getBoundingClientRect();
   const u=q('btn-up'), dn=q('btn-down'), l=q('btn-left'), r=q('btn-right');
   return { w:Math.round(u.width), h:Math.round(u.height),
            ecartV:Math.round(dn.top-u.bottom), ecartH:Math.round(r.left-l.right),
            basDn:Math.round(dn.bottom), vh:window.innerHeight };
 });
 console.log('   touche '+d.w+'×'+d.h+' px · écart '+d.ecartH+'/'+d.ecartV+' px · bas à '+d.basDn+' / '+d.vh);
 // ⚠️ 56 × 44 avant. La cible tactile confortable est à 48 px.
 ok('les touches ont grossi (≥ 64 px de large)', d.w>=64, String(d.w));
 ok('et en hauteur (≥ 56 px)', d.h>=56, String(d.h));
 // ⚠️ C'est l'ÉCART qui permet de les distinguer sans les regarder.
 ok('elles sont nettement plus écartées qu avant (≥ 14 px)',
    d.ecartH>=14 && d.ecartV>=14, d.ecartH+'/'+d.ecartV);
 // ⚠️ « Plus vers le bas » : le pavé doit occuper le bas de l'écran.
 ok('le pavé est dans le tiers bas de l écran', d.basDn > d.vh*0.72,
    'bas '+d.basDn+' sur '+d.vh);
 ok('et il ne déborde pas', d.basDn <= d.vh, 'bas '+d.basDn+' sur '+d.vh);
 ok('plus de grand vide sous les touches', d.vh - d.basDn < 60, String(d.vh-d.basDn));

 // Le cadre du jeu ne doit pas s'être déformé.
 const sq=await fr.evaluate(()=>{
   const r=document.querySelector('.screen-wrapper').getBoundingClientRect();
   return { w:Math.round(r.width), h:Math.round(r.height) };
 });
 ok('le cadre du jeu reste carré', Math.abs(sq.w-sq.h)<=2, JSON.stringify(sq));

 // ⚠️ Les touches doivent toujours COMMANDER le jeu — grossir des boutons
 //    qui ne répondent plus serait une régression invisible à l'œil.
 //    Mon premier contrôle interrogeait une variable `nextDir` qui n'a
 //    jamais existé : il passait au vert sur `null === null`. Le vrai
 //    nom est `gameState.nextDirection`.
 //    ⚠️ ET ON LANCE LA PARTIE POUR DE BON. Forcer `gameState.running`
 //    à la main faisait tourner la boucle sur un état jamais initialisé
 //    et jetait une erreur — que le contrôle de console suivant
 //    attribuait à l'application. Une erreur fabriquée par l'épreuve
 //    elle-même est pire qu'une épreuve absente.
 await F.locator('#btn-game-start').click(); await pg.waitForTimeout(400);
 const dir=await fr.evaluate(async()=>{
   if (typeof gameState === 'undefined') return { err:'gameState absent' };
   gameState.paused = false;
   gameState.direction = { x:1, y:0 };
   gameState.nextDirection = { x:1, y:0 };
   const av = JSON.stringify(gameState.nextDirection);
   const b = document.getElementById('btn-down');
   ['touchstart','pointerdown','mousedown','click'].forEach(t =>
     b.dispatchEvent(new Event(t, { bubbles:true })));
   await new Promise(r=>setTimeout(r,150));
   return { av, ap: JSON.stringify(gameState.nextDirection) };
 });
 ok('toucher ▼ fait vraiment tourner la perfusion vers le bas',
    dir.ap === '{"x":0,"y":1}', JSON.stringify(dir));

 console.log('\n═══ QUITTER ═══');
 await pg.click('#jeu-sortie'); await pg.waitForTimeout(500);
 ok('le jeu se ferme', await pg.evaluate(()=>!document.getElementById('jeu-plein')));
 ok('et le défilement de l app revient',
    await pg.evaluate(()=>!document.body.classList.contains('jeu-ouvert')));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
