// ② L'adresse : le GPS assemble les trois, et les dossiers hérités se rangent.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8125,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:412,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8125/index.html'); await pg.waitForTimeout(2600);

 const ids=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t;
   S.patients.forEach(p=>{ if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t); });
   const a=S.patients[0], b=S.patients[1], c=S.patients[2];
   // Le dossier hérité : tout sur une ligne, PLUS les deux cases
   a.address='12 rue des Lilas 83000 Toulon'; a.cp='83000'; a.ville='Toulon';
   // Le dossier propre
   b.address='5 avenue Foch'; b.cp='83000'; b.ville='Toulon';
   // Le piège : une rue qui porte le nom de la ville
   if(c){ c.address='3 rue de Toulon'; c.cp='83000'; c.ville='Toulon'; }
   save(); render();
   return { a:a.id, b:b.id, c:c?c.id:null };
 });
 await pg.waitForTimeout(500);

 console.log('═══ ② LE GPS ASSEMBLE LES TROIS ═══');
 // ⚠️ Le bouton GPS de la fiche ne prenait QUE la ligne de rue.
 const geo=await pg.evaluate(async id=>{
   let vu=null; const vrai=window.open; window.open=(u)=>{ vu=u; return null; };
   openId=id; S.boardListe=false; render();
   await new Promise(r=>setTimeout(r,300));
   const b=document.querySelector('.pcard[data-id="'+id+'"] [data-gps]')
        || (document.querySelector('[data-toggle="'+id+'"]')&&null);
   if(!b){ window.open=vrai; return '(pas de bouton GPS — carte repliée ?)'; }
   b.click(); window.open=vrai; return vu;
 }, ids.b);
 ok('le bouton GPS de la fiche prend adresse + CP + ville',
    typeof geo==='string' && decodeURIComponent(geo).includes('5 avenue Foch, 83000 Toulon'),
    geo && decodeURIComponent(String(geo)));
 const geo2=await pg.evaluate(id=>{
   let vu=null; const vrai=window.open; window.open=(u)=>{ vu=u; return null; };
   const b=document.querySelector('[data-cgps="'+id+'"]'); if(b) b.click();
   window.open=vrai; return b?vu:'(pas de pastille 📍)';
 }, ids.b);
 if (!/pas de pastille/.test(String(geo2)))
   ok('et la pastille 📍 des cartes aussi, à l identique',
      decodeURIComponent(String(geo2)).includes('5 avenue Foch, 83000 Toulon'), decodeURIComponent(String(geo2)));

 console.log('\n═══ ② LA DÉTECTION ═══');
 const det=await pg.evaluate(i=>({
   herite: (adresseRepetition(getP(i.a))||{}).apres || null,
   propre: adresseRepetition(getP(i.b)),
   piege:  i.c ? adresseRepetition(getP(i.c)) : null,
   n: adressesARanger().length
 }), ids);
 ok('le dossier hérité est repéré', det.herite==='12 rue des Lilas', JSON.stringify(det.herite));
 ok('un dossier propre n est pas touché', det.propre===null);
 // ⚠️ LE PIÈGE : « 3 rue de Toulon » ne doit JAMAIS devenir « 3 rue de ».
 ok('une rue qui porte le nom de la ville est laissée tranquille', det.piege===null, JSON.stringify(det.piege));
 ok('un seul dossier à ranger', det.n===1, String(det.n));

 console.log('\n═══ ② L AVIS DANS LA FICHE ═══');
 await pg.evaluate(id=>sheetPatient(getP(id)), ids.a); await pg.waitForTimeout(900);
 ok('la fiche du dossier hérité propose la correction', await pg.isVisible('#f-addr-fix'));
 ok('et dit ce que le GPS reçoit aujourd hui',
    await pg.evaluate(()=>/83000 Toulon, 83000 Toulon/.test(document.querySelector('#sheet').textContent)));
 await pg.click('#f-addr-fix'); await pg.waitForTimeout(500);
 ok('le champ est raccourci à l écran',
    await pg.evaluate(()=>document.querySelector('#f-addr').value==='12 rue des Lilas'));
 // ⚠️ RIEN N'ENTRE AU DOSSIER avant l'enregistrement de la fiche.
 ok('mais le dossier n a pas encore bougé',
    await pg.evaluate(id=>getP(id).address==='12 rue des Lilas 83000 Toulon', ids.a));
 ok('l avis disparaît une fois corrigé', await pg.evaluate(()=>!document.querySelector('#f-addr-fix')));
 await pg.evaluate(()=>closeSheet()); await pg.waitForTimeout(400);
 ok('et après « Annuler », le dossier est toujours intact',
    await pg.evaluate(id=>getP(id).address==='12 rue des Lilas 83000 Toulon', ids.a));

 console.log('\n═══ ② LA REPRISE DE TOUS LES DOSSIERS ═══');
 await pg.evaluate(()=>sheetAdresses()); await pg.waitForTimeout(800);
 ok('l écran liste le dossier concerné',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-adr]').length===1));
 ok('tout est coché au départ',
    await pg.evaluate(()=>document.querySelector('#sheet [data-adr]').classList.contains('on')));
 ok('il montre l avant et l après',
    await pg.evaluate(()=>{const t=document.querySelector('#sheet').textContent;
      return /12 rue des Lilas 83000 Toulon/.test(t) && /→ 12 rue des Lilas/.test(t);}));
 await pg.click('#adr-ok'); await pg.waitForTimeout(800);
 ok('le dossier est rangé', await pg.evaluate(id=>getP(id).address==='12 rue des Lilas', ids.a));
 ok('le code postal et la ville sont intacts dans leurs cases',
    await pg.evaluate(id=>getP(id).cp==='83000'&&getP(id).ville==='Toulon', ids.a));
 ok('le GPS reçoit toujours l adresse complète',
    await pg.evaluate(id=>adresseComplete(getP(id))==='12 rue des Lilas, 83000 Toulon', ids.a),
    await pg.evaluate(id=>adresseComplete(getP(id)), ids.a));
 ok('et l écran annonce qu il n y a plus rien à ranger',
    await pg.evaluate(()=>/Rien à ranger/.test(document.querySelector('#sheet').textContent)));
 // ⚠️ Le bouton doit disparaître des réglages une fois le travail fait.
 await pg.evaluate(()=>sheetAppPanel()); await pg.waitForTimeout(700);
 ok('le bouton disparaît des réglages', await pg.evaluate(()=>!document.querySelector('#go-adr')));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
