const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/claude/jmsante/www';
const SP = __dirname;
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv = http.createServer((q,r)=>{ let u=decodeURIComponent(q.url.split('?')[0]); if(u==='/')u='/index.html';
  const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
  r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f)); });
let ko=0; const ok=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c)ko++; };
(async()=>{
 await new Promise(r=>srv.listen(8102,r));
 const nav = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg = await (await nav.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8102/index.html'); await pg.waitForTimeout(2500);
 await pg.evaluate(()=>{ S.confidentialityAck=true; sheetGuide(); }); await pg.waitForTimeout(900);

 console.log('\n═══ LE GUIDE SIMPLE S OUVRE ═══');
 ok('il s ouvre', await pg.isVisible('#gd-q'));
 const parts = await pg.evaluate(()=>[...document.querySelectorAll('#sheet .gd-part')].map(p=>({
   titre: p.querySelector('.gd-h b').textContent,
   badge: +p.querySelector('.gd-n').textContent,
   reel: p.querySelectorAll('.gd-b .cat-head').length })));
 parts.forEach(p=>ok(`${p.titre} — pastille ${p.badge}, rubriques ${p.reel}`, p.badge===p.reel));
 ok('sept parties', parts.length===7);

 console.log('\n═══ CE QUI MANQUAIT EST LÀ ═══');
 const t = await pg.textContent('#sheet');
 [['l import Excel du plan de traitement (v1.7.4)','Depuis un classeur'],
  ['la date en JJ/MM/AAAA (v1.7.4)','JJ/MM/AAAA'],
  ['la sélection multiple (v1.8.0)','Retirer plusieurs médicaments'],
  ['le raccourci Nouvelle ordonnance (v1.8.0)','Nouvelle ordonnance'],
  ['la note soignante (v1.8.0)','La note soignante'],
  ['les deux versions imprimées (v1.8.0)','Deux versions de la fiche'],
  ['la base des médicaments (v1.9.0)','La base des médicaments'],
  ['la loupe','loupe'],
 ].forEach(([l,m])=>ok(l, t.includes(m)));

 console.log('\n═══ LA DOCTRINE PASSE AUSSI DANS LE GUIDE ═══');
 ok('la note soignante est dite non diffusable', /ne figure jamais[\s\S]{0,120}remise au patient/.test(t));
 ok('la version patient est dite par défaut', /proposée en premier/.test(t));
 ok('les interactions sont dites absentes et pourquoi',
    /Ni <b>posologie|Ni posologie/.test(await pg.innerHTML('#sheet')) && /plus dangereuse|plus dangereux/.test(t));
 ok('l app est dite ne lire aucune ordonnance', /ne lit aucune ordonnance/.test(t));

 console.log('\n═══ LA RECHERCHE DU GUIDE ═══');
 await pg.fill('#gd-q','note soignante'); await pg.waitForTimeout(450);
 ok('« note soignante » est trouvée', !(await pg.textContent('#gd-cpt')).includes('Rien trouvé'));
 await pg.fill('#gd-q','tahor'); await pg.waitForTimeout(450);
 ok('« tahor » est trouvé dans le guide', !(await pg.textContent('#gd-cpt')).includes('Rien trouvé'));
 await pg.fill('#gd-q',''); await pg.waitForTimeout(400);
 ok('vidé, le compteur reprend son texte', (await pg.textContent('#gd-cpt')).includes('7 parties'));

 await pg.evaluate(()=>{ const p=[...document.querySelectorAll('#sheet .gd-part')][3];
   p.querySelector('.gd-h').click(); });
 await pg.waitForTimeout(500);
 await pg.screenshot({path:SP+'/gd_part3.png', fullPage:false});
 console.log('\nerreurs JS :', errs.length?errs.slice(0,3):'aucune');
 console.log(ko?`\n⚠ ${ko} point(s) en échec`:'\n✓ tout est au vert');
 await nav.close(); srv.close(); process.exit(ko||errs.length?1:0);
})();
