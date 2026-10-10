const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const ROOT = '/home/claude/jmsante/www';
const SP = '/tmp/claude-0/-home-claude/4ebfe93b-ab3f-5bf6-aa15-2c013c59186b/scratchpad';
const MIME = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};
const srv = http.createServer((q,r)=>{
  let u = decodeURIComponent(q.url.split('?')[0]); if (u==='/') u='/index.html';
  const f = path.join(ROOT,u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end('404'); return; }
  r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'}); r.end(fs.readFileSync(f));
});
let ko = 0;
const ok = (l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko++; };

(async()=>{
 await new Promise(r=>srv.listen(8099,r));
 const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
 const ctx = await nav.newContext({viewport:{width:430,height:900}});
 const pg = await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8099/index.html');
 await pg.waitForTimeout(2500);

 console.log('\n═══ LES DONNÉES ═══');
 const stat = await pg.evaluate(()=>({ n:medTotalBase(), ch:MED_BASE.length, v:MED_VERIF, tot:medTotal() }));
 ok('267 molécules en 14 chapitres', stat.n===267 && stat.ch===14);
 ok('la base annonce sa date de vérification', stat.v==='08/10/2026');
 ok('medTotal part de la base quand rien n est ajusté', stat.tot===267);

 // ⚠️ LE POINT CRITIQUE DU SURLIGNAGE : la pliure doit garder la longueur.
 console.log('\n═══ LA PLIURE SANS ACCENTS ═══');
 const pli = await pg.evaluate(()=>{
   const t = ['Paracétamol','Ésoméprazole','Lévothyroxine','œsophage','ANTICOAGULANT','Néo-Mercazole','Béclométasone'];
   return t.map(x=>({ x, p:medPli(x), same:medPli(x).length===x.length }));
 });
 ok('la longueur est préservée sur tous les cas accentués', pli.every(r=>r.same));
 ok('é→e, è→e, œ→o', pli[0].p==='paracetamol' && pli[1].p==='esomeprazole' && pli[3].p==='oesophage'.replace('oe','o'));

 const surl = await pg.evaluate(()=>({
   a: medSurl('Ésoméprazole','esome'),
   b: medSurl('Doliprane · Dafalgan','dafal'),
   c: medSurl('Lévothyroxine sodique','THYRO'),
   d: medSurl('<script>x</script>','script')
 }));
 ok('« esome » surligne bien « Ésomé » dans le texte accentué', surl.a.includes('<mark>Ésomé</mark>'));
 ok('la correspondance est trouvée au milieu d une liste de marques', surl.b.includes('<mark>Dafal</mark>'));
 ok('la casse est ignorée', surl.c.includes('<mark>thyro</mark>'));
 // ⚠️ Un surlignage qui n'échappe pas le HTML serait une injection.
 ok('le HTML reste échappé malgré le surlignage',
    !surl.d.includes('<script>') && surl.d.includes('&lt;'));

 console.log('\n═══ L ÉCRAN DEPUIS MES OUTILS ═══');
 await pg.evaluate(()=>{ S.confidentialityAck = true; menuGo('meds'); });
 await pg.waitForTimeout(600);
 ok('l écran s ouvre', await pg.isVisible('#md-q'));
 ok('il annonce le nombre et la date', (await pg.textContent('#sheet')).includes('267 molécules')
    && (await pg.textContent('#sheet')).includes('08/10/2026'));
 // ⚠️ LE POINT DE DOCTRINE : il doit être écrit, en haut, pas enfoui.
 const haut = await pg.textContent('#sheet .warn');
 ok('ce que la base NE dit pas est annoncé en tête',
    /ni posologie/i.test(haut) && /interaction/i.test(haut));

 console.log('\n═══ CHERCHER PAR NOM COMMERCIAL ═══');
 const cherche = async (q) => {
   await pg.fill('#md-q', q); await pg.waitForTimeout(450);
   return await pg.evaluate(()=>[...document.querySelectorAll('#sheet .md-d')].map(e=>e.textContent.trim()));
 };
 let r = await cherche('tahor');
 ok('« tahor » trouve Atorvastatine', r.length===1 && r[0].includes('Atorvastatine'));
 r = await cherche('INIPOMP');
 ok('« INIPOMP » en capitales trouve Pantoprazole', r.some(x=>x.includes('Pantoprazole')));
 r = await cherche('levothyrox');
 ok('« levothyrox » sans accent trouve Lévothyroxine', r.some(x=>x.includes('thyroxine')));
 r = await cherche('lovenox');
 ok('« lovenox » trouve Énoxaparine', r.some(x=>x.includes('noxaparine')));
 r = await cherche('statine');
 ok('« statine » ramène la famille entière', r.length>=4);
 r = await cherche('skenan');
 ok('« skenan » trouve la morphine', r.some(x=>x.toLowerCase().includes('morphine')));
 ok('la correspondance est surlignée dans le nom commercial',
    await pg.evaluate(()=>!!document.querySelector('#sheet .md-c mark')));

 r = await cherche('zzzz');
 ok('une recherche sans résultat le dit', r.length===0
    && (await pg.textContent('#sheet')).includes('Rien ne correspond'));
 ok('et propose d ajouter ce qui manque', await pg.isVisible('#md-add-q'));

 console.log('\n═══ LA FICHE ═══');
 await cherche('eliquis');
 await pg.click('#sheet .md-h'); await pg.waitForTimeout(400);
 const fiche = await pg.textContent('#sheet .md-fiche');
 ok('la fiche s ouvre sur l indication', /fibrillation/i.test(fiche));
 ok('elle montre la surveillance', await pg.isVisible('#sheet .md-p.md-s'));
 ok('la voie est affichée', (await pg.textContent('#sheet .md-vs')).includes('orale'));
 // ⚠️ Le cadre doit être sur CHAQUE fiche, pas une fois à l'accueil.
 ok('le cadre « pas une aide à la prescription » est sur la fiche',
    /pas une aide à la prescription/i.test(fiche));
 ok('aucune posologie chiffrée dans la fiche', !/\d+\s*mg\s*(par jour|x\s*\d)/i.test(fiche));

 console.log('\n═══ LES INTERACTIONS RESTENT DEHORS ═══');
 await pg.click('#sheet [data-mdinter]'); await pg.waitForTimeout(400);
 const dlg = await pg.textContent('.dlg-veil');
 ok('un dialogue explique pourquoi elles ne sont pas dans l app',
    /ne sont pas dans l.app/i.test(dlg) && /incompl/i.test(dlg));
 ok('il propose la base publique', /base publique/i.test(dlg));
 await pg.click('.dlg-veil [data-no]'); await pg.waitForTimeout(350);
 // ⚠️ AUCUNE donnée d'interaction ne doit être embarquée, nulle part.
 const fuite = await pg.evaluate(()=>{
   const RX = /interaction/i;
   const t = [];
   MED_BASE.forEach(g=>g.items.forEach(m=>{ if (RX.test((m.s||'')+(m.r||'')+(m.i||''))) t.push(m.d); }));
   return t;
 });
 ok('aucune entrée ne prétend décrire une interaction', fuite.length===0);

 console.log('\n═══ LES FILTRES ═══');
 await pg.fill('#md-q',''); await pg.waitForTimeout(400);
 await pg.click('#sheet [data-mdv="SC"]'); await pg.waitForTimeout(450);
 const sc = await pg.evaluate(()=>[...document.querySelectorAll('#sheet .md-d')].map(e=>e.textContent.trim()));
 ok('le filtre « sous-cutanée » ne garde que les injectables SC', sc.length>=12
    && sc.some(x=>x.includes('noxaparine')) && !sc.some(x=>x.includes('Atorvastatine')));
 await pg.click('#sheet [data-mdv=""]'); await pg.waitForTimeout(400);
 await pg.click('#sheet [data-mdc="Anticoagulants et antiagrégants"]'); await pg.waitForTimeout(450);
 const chap = await pg.evaluate(()=>[...document.querySelectorAll('#sheet .md-d')].map(e=>e.textContent.trim()));
 ok('le filtre par chapitre donne les 16 anticoagulants', chap.length===16);
 await pg.click('#sheet [data-mdc=""]'); await pg.waitForTimeout(400);

 console.log('\n═══ LA LOUPE DEPUIS UNE LIGNE DE TRAITEMENT ═══');
 const req = await pg.evaluate(()=>({
   a: medRequeteDepuis('DOLIPRANE 1000 mg'),
   b: medRequeteDepuis('TAHOR 20 mg comprimé'),
   c: medRequeteDepuis('LOVENOX 4000 UI inj'),
   d: medRequeteDepuis('SKENAN LP 10 mg gélule'),
   e: medRequeteDepuis('ELIQUIS 2,5 mg'),
   f: medRequeteDepuis('XYZOLAMINE 5 mg cp')
 }));
 ok('« DOLIPRANE 1000 mg » donne la requête « doliprane »', req.a==='doliprane');
 ok('le dosage est retiré', !/\d/.test(req.b) && req.b==='tahor');
 ok('la forme et l unité sont retirées', req.c==='lovenox' && req.d==='skenan');
 ok('la virgule décimale ne casse rien', req.e==='eliquis');
 ok('un médicament inconnu rend quand même un mot cherchable', req.f==='xyzolamine');

 const pid = await pg.evaluate(()=>{
   const p = S.patients[0];
   p.traitement = { lignes:[
     {id:'t1',nom:'DOLIPRANE 1000 mg',m:'1',mi:'1',s:'1',c:'',forme:'cp',note:'6 h entre deux prises',soig:'Antalgique'},
     {id:'t2',nom:'ELIQUIS 2,5 mg',m:'1',mi:'',s:'1',c:'',forme:'cp',note:'',soig:''},
     {id:'t3',nom:'INIPOMP 20 mg',m:'1',mi:'',s:'',c:'',forme:'cp',note:'',soig:''}
   ], maj:'2026-10-07' };
   sheetTraitement(p.id); return p.id;
 });
 await pg.waitForTimeout(700);
 ok('une loupe sur chaque ligne', await pg.evaluate(()=>document.querySelectorAll('#sheet .tr-lp').length)===3);
 await pg.click('#sheet [data-mdlp="t3"]'); await pg.waitForTimeout(700);
 ok('elle ouvre la base, recherche déjà remplie', (await pg.inputValue('#md-q'))==='inipomp');
 const vu = await pg.evaluate(()=>[...document.querySelectorAll('#sheet .md-d')].map(e=>e.textContent.trim()));
 ok('et le bon médicament est devant les yeux', vu.some(x=>x.includes('Pantoprazole')));
 // ⚠️ Aucun nom de patient, aucune donnée de dossier ne doit suivre.
 const txtMed = await pg.textContent('#sheet');
 const nomPat = await pg.evaluate(id=>getP(id).nom||'', pid);
 ok('aucune donnée du dossier ne suit dans la base', !nomPat || !txtMed.includes(nomPat));
 ok('le libellé du médicament n est pas passé par un attribut HTML',
    await pg.evaluate(()=>!document.body.innerHTML.includes('data-mdlp="DOLIPRANE')));

 // ⚠️ Le retour doit ramener à la FICHE DE TRAITEMENT, pas aux réglages.
 await pg.click('#nav-back'); await pg.waitForTimeout(700);
 ok('le retour ramène à la fiche de traitement',
    (await pg.textContent('#sheet')).includes('Fiche de traitement'));

 console.log('\n═══ AJOUTER ET CORRIGER ═══');
 await pg.evaluate(()=>menuGo('meds')); await pg.waitForTimeout(600);
 await pg.click('#md-add'); await pg.waitForTimeout(500);
 await pg.fill('#me-d','Ozempicol');
 await pg.fill('#me-c','Truclic · Machin');
 await pg.fill('#me-f','Antidiabétique inventé');
 await pg.click('#sheet [data-mev="SC"]');
 await pg.fill('#me-i','Rien, c est un test');
 await pg.fill('#me-s','Points d injection');
 await pg.click('#me-ok'); await pg.waitForTimeout(700);
 ok('l entrée ajoutée est enregistrée', await pg.evaluate(()=>medTotal()===268
    && S.medPerso.ajouts.length===1 && S.medPerso.ajouts[0].v[0]==='SC'));
 let rr = await cherche('truclic');
 ok('on la retrouve par son nom commercial', rr.some(x=>x.includes('Ozempicol')));
 ok('elle est marquée « ajouté »', (await pg.textContent('#sheet .md-tag')).includes('ajouté'));
 // ⚠️ Un doublon de molécule rendrait la base incohérente.
 await pg.fill('#md-q',''); await pg.waitForTimeout(300);
 await pg.click('#md-add'); await pg.waitForTimeout(450);
 await pg.fill('#me-d','PARACETAMOL'); await pg.click('#me-ok'); await pg.waitForTimeout(500);
 ok('une molécule déjà présente est refusée', await pg.evaluate(()=>medTotal()===268)
    && await pg.isVisible('#me-d'));
 await pg.click('#nav-back'); await pg.waitForTimeout(500);

 rr = await cherche('tahor');
 await pg.click('#sheet .md-h'); await pg.waitForTimeout(400);
 await pg.click('#sheet [data-mded]'); await pg.waitForTimeout(500);
 ok('la DCI d une entrée d origine n est pas modifiable',
    await pg.evaluate(()=>!!document.querySelector('#sheet input[disabled]')));
 await pg.fill('#me-s','Douleurs musculaires — ET MA NOTE À MOI');
 await pg.click('#me-ok'); await pg.waitForTimeout(700);
 ok('la correction est gardée',
    await pg.evaluate(()=>(S.medPerso.modifs['Atorvastatine']||{}).s.includes('MA NOTE À MOI')));
 ok('elle est marquée « corrigé »',
    await pg.evaluate(()=>[...document.querySelectorAll('#sheet .md-tag.am')].some(e=>e.textContent.includes('corrigé'))));
 ok('le compteur annonce ce qui est de la main du soignant',
    (await pg.textContent('#sheet')).includes('2 de ta main'));
 // ⚠️ Une correction qui redonne l'original ne doit plus compter comme correction.
 await pg.click('#sheet [data-mded]'); await pg.waitForTimeout(500);
 await pg.fill('#me-s', await pg.evaluate(()=>medOriginal('Atorvastatine').s));
 await pg.click('#me-ok'); await pg.waitForTimeout(700);
 ok('remettre le texte d origine efface la correction',
    await pg.evaluate(()=>!S.medPerso.modifs['Atorvastatine']));

 console.log('\n═══ LE RETOUR À L ORIGINE ═══');
 await pg.fill('#md-q',''); await pg.waitForTimeout(400);
 ok('le bouton de remise à zéro apparaît quand il y a du sien', await pg.isVisible('#md-raz'));
 await pg.click('#md-raz'); await pg.waitForTimeout(450);
 await pg.click('.dlg-veil [data-yes]'); await pg.waitForTimeout(700);
 ok('tout revient à la liste d origine',
    await pg.evaluate(()=>medTotal()===267 && !S.medPerso.ajouts.length));

 console.log('\n═══ LA LECTURE DES VOIES ÉCRITES À LA MAIN ═══');
 const vv = await pg.evaluate(()=>({
   a: medVoiesDepuis('orale'), b: medVoiesDepuis('sous-cutanée'), c: medVoiesDepuis('S/C'),
   d: medVoiesDepuis('IV, perfusion'), e: medVoiesDepuis('inhalée / aérosol'),
   f: medVoiesDepuis('orale et IM'), g: medVoiesDepuis('n importe quoi')
 }));
 ok('« sous-cutanée », « S/C » et « IV » sont reconnus',
    vv.b[0]==='SC' && vv.c[0]==='SC' && vv.d[0]==='IV');
 ok('deux voies dans une cellule donnent deux voies', vv.f.length===2);
 ok('une voie illisible ne donne pas une voie inventée', vv.g.length===0);

 await pg.evaluate(()=>menuGo('meds')); await pg.waitForTimeout(600);
 await pg.screenshot({path:SP+'/md_liste.png', fullPage:false});
 await pg.fill('#md-q','tahor'); await pg.waitForTimeout(450);
 await pg.click('#sheet .md-h'); await pg.waitForTimeout(450);
 await pg.screenshot({path:SP+'/md_fiche.png', fullPage:false});
 await pg.evaluate(id=>sheetTraitement(id), pid); await pg.waitForTimeout(600);
 await pg.screenshot({path:SP+'/md_loupe.png', fullPage:false});

 console.log('\nerreurs JS :', errs.length ? errs.slice(0,4) : 'aucune');
 console.log(ko ? '\n⚠ ' + ko + ' point(s) en échec' : '\n✓ tout est au vert');
 await nav.close(); srv.close();
 process.exit(ko || errs.length ? 1 : 0);
})();
