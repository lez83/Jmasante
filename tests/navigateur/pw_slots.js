const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c)ko++;};
(async()=>{
 await new Promise(r=>srv.listen(8107,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8107/index.html'); await pg.waitForTimeout(2600);

 const T=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   if (S.tours.length<2) S.tours.push('Cabinet Mistral');
   // on part de l'ANCIEN réglage global, pour éprouver la reprise
   S.slotsEnabled = true; delete S.slotsTours;
   save(); return S.tours.slice(0,2);
 });
 console.log('\n═══ LA REPRISE DE L ANCIEN RÉGLAGE ═══');
 const rep=await pg.evaluate(()=>({ a:slotsOn(S.tours[0]), b:slotsOn(S.tours[1]), d:JSON.stringify(slotsData()) }));
 ok('l ancien oui/non global est recopié sur chaque tournée', rep.a===true && rep.b===true);
 ok('on retrouve donc exactement ce qu on avait', /true/.test(rep.d));

 console.log('\n═══ RÉGLAGE INDÉPENDANT PAR TOURNÉE ═══');
 await pg.evaluate(()=>{ S.curTour=S.tours[0]; sheetToursList(); }); await pg.waitForTimeout(600);
 ok('une pastille ☀️🌙 par tournée',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-tslot]').length)>=2);
 ok('elles sont allumées', await pg.evaluate(()=>
    [...document.querySelectorAll('#sheet [data-tslot]')].every(e=>e.classList.contains('on'))));
 // on éteint LA SECONDE seulement
 await pg.click(`#sheet [data-tslot="${T[1]}"]`); await pg.waitForTimeout(600);
 const et=await pg.evaluate(t=>({a:slotsOn(t[0]), b:slotsOn(t[1])}), T);
 ok('éteindre une tournée ne touche pas l autre', et.a===true && et.b===false);

 console.log('\n═══ ÉTEINDRE NE DÉTRUIT RIEN ═══');
 await pg.evaluate(t=>{
   S.slotMembers={[t[1]]:{matin:['p1'],soir:['p2']}};
   S.slotOrder={[t[1]]:{matin:['p1','p2'],soir:['p2','p1']}};
   slotsData()[t[1]]=true; save();
 }, T);
 await pg.evaluate(()=>sheetToursList()); await pg.waitForTimeout(400);
 await pg.click(`#sheet [data-tslot="${T[1]}"]`); await pg.waitForTimeout(600);
 const garde=await pg.evaluate(t=>({
   on:slotsOn(t[1]),
   mem:JSON.stringify(S.slotMembers[t[1]]||null),
   ord:JSON.stringify(S.slotOrder[t[1]]||null) }), T);
 ok('la composition matin/soir survit à l extinction', garde.on===false && garde.mem.includes('p1'));
 ok('l ordre de passage par créneau aussi', garde.ord.includes('p2'));
 await pg.click(`#sheet [data-tslot="${T[1]}"]`); await pg.waitForTimeout(600);
 ok('rallumer retrouve tout', await pg.evaluate(t=>
    slotsOn(t[1]) && S.slotMembers[t[1]].matin[0]==='p1' && S.slotOrder[t[1]].soir[0]==='p2', T));

 console.log('\n═══ CE QUE VOIT LE MONITEUR ═══');
 await pg.evaluate(t=>{ closeSheet(); slotsData()[t[0]]=true; slotsData()[t[1]]=false;
   S.curTour=t[0]; save(); render(); }, T);
 await pg.waitForTimeout(500);
 ok('tournée à créneaux : la barre Matin/Soir est là',
    await pg.evaluate(()=>getComputedStyle(document.getElementById('slotbar')).display!=='none'));
 await pg.evaluate(t=>{ S.curTour=t[1]; save(); render(); }, T); await pg.waitForTimeout(500);
 ok('tournée sans créneaux : la barre disparaît',
    await pg.evaluate(()=>getComputedStyle(document.getElementById('slotbar')).display==='none'));
 await pg.evaluate(()=>{ S.curTour='all'; save(); render(); }); await pg.waitForTimeout(500);
 ok('⚠ vue « Toutes » : pas de créneau, deux tournées pouvant différer',
    await pg.evaluate(()=>slotsOn('all')===false
      && getComputedStyle(document.getElementById('slotbar')).display==='none'));

 console.log('\n═══ L ÉCRAN DE COMPOSITION ═══');
 await pg.evaluate(t=>sheetAssignPatients(t[1]), T); await pg.waitForTimeout(600);
 ok('sans créneaux : il propose de les séparer', await pg.isVisible('#ap-slot-on'));
 ok('et n affiche pas les onglets Matin/Soir', await pg.evaluate(()=>!document.querySelector('#ap-slot-m')));
 await pg.click('#ap-slot-on'); await pg.waitForTimeout(700);
 ok('le toucher les sépare sans sortir de l écran',
    await pg.evaluate(()=>!!document.querySelector('#ap-slot-m')));
 ok('et c est bien enregistré', await pg.evaluate(t=>slotsOn(t[1]), T));

 console.log('\n═══ LE BOUTON « PARTOUT » ═══');
 await pg.evaluate(()=>sheetToursList()); await pg.waitForTimeout(500);
 await pg.click('#slot-toggle'); await pg.waitForTimeout(600);
 ok('il éteint partout', await pg.evaluate(t=>!slotsOn(t[0]) && !slotsOn(t[1]), T));
 ok('sans rien supprimer', await pg.evaluate(t=>!!S.slotMembers[t[1]], T));
 await pg.click('#slot-toggle'); await pg.waitForTimeout(600);
 ok('et rallume partout', await pg.evaluate(t=>slotsOn(t[0]) && slotsOn(t[1]), T));

 console.log('\nerreurs JS :', errs.length?errs.slice(0,4):'aucune');
 console.log(ko?`\n⚠ ${ko} point(s) en échec`:'\n✓ tout est au vert');
 await nav.close(); srv.close(); process.exit(ko||errs.length?1:0);
})();
