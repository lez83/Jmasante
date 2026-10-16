const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=0; const ok=(l,c)=>{console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c)ko++;};
(async()=>{
 await new Promise(r=>srv.listen(8106,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8106/index.html'); await pg.waitForTimeout(2600);
 await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false; save(); render(); });
 await pg.waitForTimeout(400);

 console.log('\n═══ LA BASE ÉLARGIE ═══');
 const st=await pg.evaluate(()=>({n:medTotalBase(),a:MED_BASE.flatMap(g=>g.items).filter(m=>m.asso).length,v:MED_VERIF}));
 ok(`${st.n} molécules dont ${st.a} associations`, st.n===267 && st.a===32);
 await pg.evaluate(()=>menuGo('meds')); await pg.waitForTimeout(600);
 const cherche=async q=>{ await pg.fill('#md-q',q); await pg.waitForTimeout(450);
   return pg.evaluate(()=>[...document.querySelectorAll('#sheet .md-d')].map(e=>e.textContent.trim())); };
 ok('« coaprovel » trouve l association irbésartan', (await cherche('coaprovel')).some(x=>/Irbésartan \+/.test(x)));
 ok('« binocrit » trouve l époétine', (await cherche('binocrit')).some(x=>/poétine/i.test(x)));
 ok('« cosimprel » trouve bisoprolol + périndopril', (await cherche('cosimprel')).some(x=>/Bisoprolol \+/.test(x)));
 ok('« janumet » trouve sitagliptine + metformine', (await cherche('janumet')).some(x=>/Sitagliptine \+/.test(x)));
 ok('« inhixa » trouve l énoxaparine', (await cherche('inhixa')).some(x=>/noxaparine/i.test(x)));
 // ⚠️ le format des ordonnances d'aujourd'hui
 await pg.fill('#md-q','IRBESARTAN/HYDROCHLOROTHIAZIDE ARROW'); await pg.waitForTimeout(500);
 const rep=await pg.evaluate(()=>[...document.querySelectorAll('#sheet [data-mdmot]')].map(e=>e.textContent.trim()));
 ok('un nom générique composé propose un repêchage par mots', rep.length>0);
 if (rep.length){ await pg.click('#sheet [data-mdmot]'); await pg.waitForTimeout(500);
   ok('et le repêchage tombe sur quelque chose',
      await pg.evaluate(()=>document.querySelectorAll('#sheet .md-d').length>0)); }
 await pg.fill('#md-q',''); await pg.waitForTimeout(400);
 await pg.click('#md-asso'); await pg.waitForTimeout(450);
 ok('le filtre « Associations » isole les 32',
    await pg.evaluate(()=>document.querySelectorAll('#sheet .md-d').length)===32);
 await pg.click('#md-asso'); await pg.waitForTimeout(300);

 console.log('\n═══ LE TÉMOIN D ENREGISTREMENT ═══');
 ok('chaque panneau porte son témoin', await pg.evaluate(()=>!!document.querySelector('#sheet .nav-save')));
 // ⚠️ le point du diagnostic : celui du titre est sous le voile
 ok('celui du titre est bien recouvert quand un panneau est ouvert',
    await pg.evaluate(()=>document.getElementById('veil').classList.contains('on')));
 await pg.evaluate(()=>{ S.__t=Date.now(); save(); }); await pg.waitForTimeout(120);
 ok('il passe en « enregistrement » puis en ✓', await pg.evaluate(async()=>{
   const b=document.querySelector('#sheet .nav-save');
   const vu=b.className; await new Promise(r=>setTimeout(r,700));
   return vu.includes('saving') && document.querySelector('#sheet .nav-save').textContent.includes('✓'); }));

 console.log('\n═══ L ALERTE SUR UNE NOTE ═══');
 await pg.evaluate(()=>{ closeSheet(); sheetNoteEdit(null); }); await pg.waitForTimeout(500);
 ok('le bloc d alerte est dans l éditeur de note', await pg.isVisible('#nal-on'));
 ok('replié, il annonce « aucune alerte »',
    (await pg.textContent('#nal-on')).includes('aucune alerte'));
 await pg.fill('#ne-t','Changer le matériel de perfusion');
 await pg.click('#nal-on'); await pg.waitForTimeout(400);
 // ⚠️ le redessin ne doit pas effacer ce qui est déjà tapé
 ok('⚠ le titre tapé survit au dépliage', (await pg.inputValue('#ne-t'))==='Changer le matériel de perfusion');
 ok('la date et l heure apparaissent', await pg.isVisible('#nal-d') && await pg.isVisible('#nal-h'));
 await pg.fill('#nal-d','20/10/2026');
 await pg.fill('#nal-h','7h30');
 await pg.click('#sheet [data-nalav="1"]'); await pg.waitForTimeout(400);
 const res=await pg.textContent('#nal-on');
 ok('l heure écrite « 7h30 » est comprise', res.includes('07:30'));
 ok('le résumé annonce la veille', res.includes('la veille'));
 ok('la date est reprise', res.includes('20 oct'));
 await pg.click('#sheet [data-nalrep="semaine"]'); await pg.waitForTimeout(400);
 ok('la répétition est retenue', (await pg.textContent('#nal-on')).includes('chaque semaine'));
 await pg.click('#ne-ok'); await pg.waitForTimeout(700);
 const n=await pg.evaluate(()=>{ const x=notes()[0]; return x&&x.alerte; });
 ok('l alerte est enregistrée sur la note',
    n && n.on && n.date==='2026-10-20' && n.heure==='07:30' && n.avant[0]===1 && n.repete==='semaine');

 console.log('\n═══ LE BANDEAU À L OUVERTURE ═══');
 await pg.evaluate(()=>{ const x=notes()[0]; x.alerte.date=todayISO(); x.alerte.vu='';
   // et une seconde, en retard
   const d=new Date(); d.setDate(d.getDate()-2);
   S.rappels.push({ id:'rr1', done:false, type:'autre', text:'Commander les pansements',
     due:d.toISOString().slice(0,10),
     alerte:{on:true,date:d.toISOString().slice(0,10),heure:'08:00',avant:[],repete:'',tel:true,app:true,vu:''} });
   save(); closeSheet(); render(); });
 await pg.waitForTimeout(600);
 ok('le bandeau apparaît', await pg.isVisible('#albar'));
 const bt=await pg.textContent('#albar');
 ok('il distingue aujourd hui et le retard', /aujourd/i.test(bt) && /retard/i.test(bt));
 ok('⚠ le retard est en rouge, pas fondu dans le reste',
    await pg.evaluate(()=>!!document.querySelector('#albar .albar.retard')));
 ok('le texte de l alerte est lisible', bt.includes('pansements'));
 await pg.click('#albar .albar.retard .al-x'); await pg.waitForTimeout(600);
 ok('« j ai vu » retire le retard du bandeau',
    await pg.evaluate(()=>!document.querySelector('#albar .albar.retard')));
 // ⚠️ mais n'efface pas le rappel lui-même
 ok('⚠ et n efface PAS le rappel', await pg.evaluate(()=>!!S.rappels.find(r=>r.id==='rr1' && !r.done)));
 ok('celui du jour reste affiché', await pg.evaluate(()=>!!document.querySelector('#albar .albar')));

 console.log('\n═══ LE BRANCHEMENT RÉPARÉ ═══');
 ok('save est bien remplacé (l ancien crochet ne l était pas)',
    await pg.evaluate(()=>window._alBranche===true));
 ok('aucun programmeur concurrent', await pg.evaluate(()=>{
   const a=String(scheduleRappelNotifications); return a.includes('alerteProgrammer'); }));
 ok('hors Android, la programmation ne tente rien', await pg.evaluate(()=>alerteDispo()===false));

 await pg.screenshot({path:__dirname+'/al_bandeau.png',fullPage:false});
 console.log('\nerreurs JS :', errs.length?errs.slice(0,4):'aucune');
 console.log(ko?`\n⚠ ${ko} point(s) en échec`:'\n✓ tout est au vert');
 await nav.close(); srv.close(); process.exit(ko||errs.length?1:0);
})();
