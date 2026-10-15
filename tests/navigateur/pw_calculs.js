// Les calculs — conversions, seringue électrique, doses, héparines.
//
// ⚠️ CHAQUE RÉSULTAT EST VÉRIFIÉ CONTRE UN NOMBRE CONNU D'AVANCE, pas
//    contre ce que rend le code. Un contrôle qui recalcule avec la même
//    formule que celle qu'il garde ne garde rien.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8130,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8130/index.html'); await pg.waitForTimeout(2600);
 await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false; save(); render(); });

 // Poser des valeurs et lire un calcul, sans passer par l'écran.
 const calc = (vals, nom, etat) => pg.evaluate(a=>{
   _calcV = a.vals;
   Object.assign(window, {});
   if (a.etat) Object.entries(a.etat).forEach(([k,v])=>{ window[k]=v; });
   const r = CALCULS[a.nom]();
   return r ? { r:r.r, detail:r.detail, sous:r.sous||'' } : null;
 }, { vals, nom, etat });

 console.log('═══ ÉCRIRE UN NOMBRE QU ON PUISSE LIRE ═══');
 const nb = await pg.evaluate(()=>({
   mille: calcNb(250000), petit: calcNb(0.00025), zero: calcNb(0),
   // ⚠️ toPrecision bascule en notation scientifique : « 2.5e-4 » n'est
   //    pas un nombre qu'on lit au chevet d'un patient.
   sci: /e[+-]/.test(calcNb(0.00025)), nul: calcNb(null),
   rond: calcNb(4), virg: calcNb(4.2), neg: calcNb(-1500)
 }));
 ok('250000 s écrit avec des espaces', /250.250/.test(nb.mille.replace(/\s| /g,'250')) || nb.mille.includes(' '), nb.mille);
 ok('aucune notation scientifique sur les petits nombres', !nb.sci, nb.petit);
 ok('zéro reste zéro', nb.zero==='0', nb.zero);
 ok('une valeur absente rend un tiret', nb.nul==='—', nb.nul);
 ok('4 ne devient pas 4,000', nb.rond==='4', nb.rond);
 ok('la virgule française', nb.virg==='4,2', nb.virg);
 ok('un négatif n est pas découpé après le signe', !nb.neg.startsWith('- '), nb.neg);

 console.log('\n═══ LES ÉCHELLES ═══');
 // 250 mg = 250 000 µg = 0,25 g = 0,00025 kg — vérifiable de tête.
 const m = await calc({ m_val:'250' }, 'convMasse', { _uMasse:'mg' });
 const vm = m && m.echelle;
 const ech = await pg.evaluate(()=>{ _calcV={m_val:'250'}; _uMasse='mg';
   return CALCULS.convMasse().echelle.map(x=>[x.u, x.v, x.on]); });
 ok('µg', ech[0][1]===250000, JSON.stringify(ech[0]));
 ok('mg, et c est l unité saisie', ech[1][1]===250 && ech[1][2]===true, JSON.stringify(ech[1]));
 ok('g', Math.abs(ech[2][1]-0.25)<1e-12, JSON.stringify(ech[2]));
 ok('kg', Math.abs(ech[3][1]-0.00025)<1e-15, JSON.stringify(ech[3]));
 const ev = await pg.evaluate(()=>{ _calcV={vo_val:'1'}; _uVol='L';
   return CALCULS.convVolume().echelle.map(x=>[x.u, x.v]); });
 ok('1 L = 1 000 000 µL', ev[0][1]===1e6, JSON.stringify(ev[0]));
 ok('1 L = 1 000 mL', ev[1][1]===1000, JSON.stringify(ev[1]));
 ok('1 L = 100 cL', ev[2][1]===100, JSON.stringify(ev[2]));
 ok('une valeur absente ne rend pas d échelle',
    await pg.evaluate(()=>{ _calcV={}; return CALCULS.convMasse()===null; }));

 console.log('\n═══ LA CONCENTRATION EN POURCENTAGE ═══');
 // Sérum phy 0,9 % = 9 g/L = 9 mg/mL. Poche de 500 mL = 4,5 g.
 const cc = await pg.evaluate(()=>{ _calcV={cc_val:'0.9', cc_poche:'500'}; _uConc='%';
   return { e:CALCULS.convConc().echelle.map(x=>[x.u,x.v]), p:CALCULS.convPoche() }; });
 ok('0,9 % = 9 g/L', cc.e[1][1]===9, JSON.stringify(cc.e));
 ok('0,9 % = 9 mg/mL', cc.e[2][1]===9, JSON.stringify(cc.e));
 ok('une poche de 500 mL contient 4,5 g', /^4,5 g$/.test(cc.p.r), JSON.stringify(cc.p));
 // G5 % dans 500 mL = 25 g.
 const g5 = await pg.evaluate(()=>{ _calcV={cc_val:'5', cc_poche:'500'}; _uConc='%';
   return CALCULS.convPoche().r; });
 ok('du G5 % dans 500 mL fait 25 g', g5==='25 g', g5);

 console.log('\n═══ LA SERINGUE ÉLECTRIQUE ═══');
 // 250 mg dans 50 mL = 5 mg/mL. 5 µg/kg/min, 70 kg :
 // (5 × 70 × 60) ÷ 5000 = 21000 ÷ 5000 = 4,2 mL/h. Et 50 ÷ 4,2 = 11,90 h.
 const sap = await pg.evaluate(()=>{ _calcV={g_mg:'250',g_vol:'50',g_poids:'70',g_dose:'5'};
   _uSap='ugkgmin'; return { c:CALCULS.sapConc(), d:CALCULS.sapDebit() }; });
 ok('la concentration s affiche AVANT le débit', sap.c && sap.c.r==='5 mg/mL', JSON.stringify(sap.c));
 ok('et aussi en µg/mL', sap.c && /5 000 µg\/mL/.test(sap.c.sous), sap.c&&sap.c.sous);
 ok('le débit vaut 4,2 mL/h', sap.d && sap.d.r==='4,2 mL/h', JSON.stringify(sap.d));
 ok('la durée de tenue est donnée', sap.d && /tient 11 h 54/.test(sap.d.sous), sap.d&&sap.d.sous);
 // ⚠️ La concentration doit sortir sans le poids ni la posologie.
 ok('la concentration sort même sans le poids',
    await pg.evaluate(()=>{ _calcV={g_mg:'250',g_vol:'50'}; return CALCULS.sapConc().r==='5 mg/mL'; }));
 // mg/h : 10 mg/h avec 5 mg/mL = 2 mL/h, SANS poids.
 const mgh = await pg.evaluate(()=>{ _calcV={g_mg:'250',g_vol:'50',g_dose:'10'};
   _uSap='mgh'; return CALCULS.sapDebit(); });
 ok('mg/h : 10 mg/h à 5 mg/mL font 2 mL/h', mgh && mgh.r==='2 mL/h', JSON.stringify(mgh));
 // ⚠️ Réclamer un poids pour des mg/h bloquerait un calcul qui n'en a pas besoin.
 ok('et il n a pas fallu de poids', mgh!==null);
 // mg/kg/h : 0,1 mg/kg/h × 70 kg = 7 mg/h ÷ 5 mg/mL = 1,4 mL/h
 const mkh = await pg.evaluate(()=>{ _calcV={g_mg:'250',g_vol:'50',g_poids:'70',g_dose:'0.1'};
   _uSap='mgkgh'; return CALCULS.sapDebit(); });
 ok('mg/kg/h : 0,1 × 70 ÷ 5 = 1,4 mL/h', mkh && mkh.r==='1,4 mL/h', JSON.stringify(mkh));
 // ⚠️ Une unité qui PORTE le poids dans son nom doit l'exiger.
 ok('µg/kg/min sans poids ne rend rien',
    await pg.evaluate(()=>{ _calcV={g_mg:'250',g_vol:'50',g_dose:'5'}; _uSap='ugkgmin';
      return CALCULS.sapDebit()===null; }));

 console.log('\n═══ LA DOSE, RECOPIÉE SUR L AMPOULE ═══');
 // 500 mg dans 5 mL = 100 mg/mL. Pour 350 mg : 3,5 mL.
 const d1 = await pg.evaluate(()=>{ _calcV={v_conc:'500',v_qte:'5',v_dose:'350'}; _doseSens='versML';
   return { c:CALCULS.doseConc(), v:CALCULS.doseVolume() }; });
 ok('500 mg dans 5 mL font 100 mg par mL', d1.c && d1.c.r==='100 mg par mL', JSON.stringify(d1.c));
 ok('pour 350 mg, prélever 3,5 mL', d1.v && d1.v.r==='3,5 mL', JSON.stringify(d1.v));
 // L'autre sens : 3,5 mL × 100 mg/mL = 350 mg.
 const d2 = await pg.evaluate(()=>{ _calcV={v_conc:'500',v_qte:'5',v_dose:'3.5'}; _doseSens='versMG';
   return CALCULS.doseVolume(); });
 ok('et dans l autre sens, 3,5 mL font 350 mg', d2 && d2.r==='350 mg', JSON.stringify(d2));
 // 60 mg/kg × 20 kg = 1200 mg, en 3 prises = 400 mg.
 const dp = await pg.evaluate(()=>{ _calcV={p_mgkg:'60',p_poids:'20',p_prises:'3'};
   return CALCULS.dosePoids(); });
 ok('60 mg/kg pour 20 kg font 1 200 mg', dp && /^1 200 mg$/.test(dp.r), JSON.stringify(dp));
 ok('et 400 mg par prise en trois prises', dp && /400 mg par prise/.test(dp.sous), dp&&dp.sous);
 ok('sans nombre de prises, pas de ligne par prise',
    await pg.evaluate(()=>{ _calcV={p_mgkg:'60',p_poids:'20'}; return CALCULS.dosePoids().sous===''; }));

 console.log('\n═══ LES HÉPARINES ═══');
 // 20 000 UI avec une sodique à 5 000 UI/mL = 4 mL.
 const h1 = await pg.evaluate(()=>{ _calcV={h_conc:'5000',h_dose:'20000'}; return CALCULS.hepVolume(); });
 ok('20 000 UI à 5 000 UI/mL font 4 mL', h1 && h1.r==='4 mL', JSON.stringify(h1));
 // ⚠️ LE POINT CENTRAL : le résultat redit sa concentration.
 ok('le résultat redit la concentration employée', h1 && /5 000 UI\/mL/.test(h1.sous), h1&&h1.sous);
 ok('et nomme le produit quand c est un raccourci', h1 && /sodique/.test(h1.sous), h1&&h1.sous);
 // Le même volume avec une calcique : cinq fois la dose.
 const h2 = await pg.evaluate(()=>{ _calcV={h_conc:'25000',h_ml:'1'}; return CALCULS.hepUI(); });
 const h3 = await pg.evaluate(()=>{ _calcV={h_conc:'5000',h_ml:'1'}; return CALCULS.hepUI(); });
 ok('1 mL de calcique fait 25 000 UI', h2 && /^25 000 UI$/.test(h2.r), JSON.stringify(h2));
 ok('1 mL de sodique fait 5 000 UI', h3 && /^5 000 UI$/.test(h3.r), JSON.stringify(h3));
 // ⚠️ RIEN NE SE CALCULE SANS LA CONCENTRATION. C'est toute la raison
 //    d'être de cet écran face à un tableau figé.
 ok('aucun volume sans concentration',
    await pg.evaluate(()=>{ _calcV={h_dose:'20000'}; return CALCULS.hepVolume()===null; }));
 ok('aucune dose sans concentration',
    await pg.evaluate(()=>{ _calcV={h_ml:'1'}; return CALCULS.hepUI()===null; }));
 // L'ancienne convention, repliée.
 const hm = await pg.evaluate(()=>{ _calcV={h_ui:'5000'}; return CALCULS.hepMgUI(); });
 ok('5 000 UI font 50 mg selon l ancienne convention', hm && hm.r==='50 mg', JSON.stringify(hm));
 // L'énoxaparine, la seule étiquetée dans les deux unités.
 const en = await pg.evaluate(()=>{ _calcV={e_mg:'40'}; return CALCULS.enoxa(); });
 ok('40 mg d énoxaparine font 4 000 UI anti-Xa', en && /^4 000 UI anti-Xa$/.test(en.r), JSON.stringify(en));
 const en2 = await pg.evaluate(()=>{ _calcV={e_ui:'10000'}; return CALCULS.enoxa(); });
 ok('et 10 000 UI font 100 mg — ce qui est sur la boîte', en2 && en2.r==='100 mg', JSON.stringify(en2));
 // Les présentations
 const pres = await pg.evaluate(()=>HEP_PRES.map(p=>[p.nom,p.c]));
 ok('les trois concentrations réelles sont proposées',
    JSON.stringify(pres.map(p=>p[1]))==='[5000,1000,25000,0]', JSON.stringify(pres));
 ok('plus une saisie libre', pres[3][1]===0);
 ok('les présentations portent leur date de vérification',
    await pg.evaluate(()=>/^\d{2}\/\d{2}\/\d{4}$/.test(HEP_VERIF)));

 console.log('\n═══ CE QUE L ÉCRAN REFUSE DE FAIRE ═══');
 const src = await pg.evaluate(()=>document.documentElement.outerHTML.length>0);
 const js = fs.readFileSync('/home/claude/jmsante/www/js/calculs.js','utf-8');
 // ⚠️ Aucune équivalence entre HBPM : c'est une décision de prescription.
 ok('aucune table d équivalence entre héparines',
    !/innohep|fraxiparine|fragmine|tinzapar|nadropar|daltepar/i.test(js.replace(/\/\*[\s\S]*?\*\//g,'')));
 ok('et le refus est écrit à l écran',
    /ne fait passer d'une héparine à aucune autre/.test(js));
 ok('la raison aussi', /Changer d'héparine est une prescription/.test(js));
 ok('les RCP sont cités en commentaire', /Panpharma/.test(js) && /MSF/.test(js));
 ok('le facteur 5 est écrit en permanence, pas en pied de page',
    /un facteur <b>5<\/b> pour le même volume/.test(js));
 ok('les milligrammes sont repliés par défaut', /let _hepMg = false/.test(js));
 ok('et étiquetés quand on les ouvre',
    /Aucun RCP français ne donne de correspondance UI ↔ mg/.test(js));

 console.log('\n═══ L ÉCRAN TOURNE ═══');
 await pg.evaluate(()=>{ _calcV={}; _calcOnglet='debit'; _calcSous='masse'; sheetCalculs(null); });
 await pg.waitForTimeout(600);
 ok('l écran s ouvre', await pg.isVisible('#sheet .ca-tabs'));
 ok('quatre onglets en haut', await pg.evaluate(()=>document.querySelectorAll('#sheet [data-cat]').length===4));
 await pg.click('#sheet [data-cat="conv"]'); await pg.waitForTimeout(400);
 ok('six sous-onglets de conversion',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-cas]').length===6));
 await pg.fill('#sheet [data-cav="m_val"]','250'); await pg.waitForTimeout(300);
 ok('l échelle se remplit à la frappe',
    await pg.evaluate(()=>/250/.test(document.querySelector('#sheet .ca-ech').textContent)));
 // ⚠️ Une frappe ne doit PAS redessiner l'écran : le curseur se perdrait.
 ok('et le champ garde le focus',
    await pg.evaluate(()=>document.activeElement && document.activeElement.dataset.cav==='m_val'));
 await pg.click('#sheet [data-cas="hep"]'); await pg.waitForTimeout(500);
 ok('l écran des héparines s ouvre', await pg.isVisible('#sheet .hep-pres'));
 ok('avec quatre présentations',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-cahp]').length===4));
 await pg.click('#sheet [data-cahp="25000"]'); await pg.waitForTimeout(500);
 ok('un raccourci remplit la concentration',
    await pg.evaluate(()=>document.querySelector('#sheet [data-cav="h_conc"]').value==='25000'));
 ok('et la pastille s allume',
    await pg.evaluate(()=>document.querySelector('#sheet [data-cahp="25000"]').classList.contains('on')));
 await pg.click('#sheet [data-cahp="0"]'); await pg.waitForTimeout(500);
 ok('« Autre » vide le champ pour qu on lise son ampoule',
    await pg.evaluate(()=>document.querySelector('#sheet [data-cav="h_conc"]').value===''));
 await pg.click('#sheet #ca-hepmg'); await pg.waitForTimeout(500);
 ok('le dépliant des mg s ouvre', await pg.isVisible('#sheet [data-cav="h_ui"]'));
 ok('et affiche l avertissement',
    await pg.evaluate(()=>/se rédigent en UI/.test(document.querySelector('#sheet').textContent)));

 console.log('\n═══ CHAQUE BLOC AFFICHE SON PROPRE RÉSULTAT ═══');
 // ⚠️ L'ancienne version appariait une liste de noms à l'ORDRE des
 //    blocs : ajouter un résultat au milieu décalait tous les suivants.
 await pg.click('#sheet [data-cat="debit"]'); await pg.waitForTimeout(400);
 ok('chaque bloc porte le nom de son calcul',
    await pg.evaluate(()=>[...document.querySelectorAll('#sheet .ca-r')].every(e=>e.dataset.cr && CALCULS[e.dataset.cr])));
 await pg.fill('#sheet [data-cav="g_mg"]','250');
 await pg.fill('#sheet [data-cav="g_vol"]','50'); await pg.waitForTimeout(400);
 const blocs = await pg.evaluate(()=>[...document.querySelectorAll('#sheet .ca-r')]
   .map(e=>({ n:e.dataset.cr, v:e.querySelector('.ca-rv').textContent })));
 const conc = blocs.find(b=>b.n==='sapConc');
 ok('le bloc « Concentration » montre bien la concentration', conc && conc.v==='5 mg/mL', JSON.stringify(blocs));
 ok('et les blocs incomplets restent à —',
    blocs.filter(b=>b.n==='debitGouttes').every(b=>b.v==='—'), JSON.stringify(blocs));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
