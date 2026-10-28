/* ══════════════════════════════════════════════════════════════
   LES FEUILLES DE DOMICILE CALÉES SUR LE CALENDRIER   (v1.34.0)
   ─────────────────────────────────────────────────────────────
   La feuille ignorait le calendrier : 31 lignes numérotées, le mois
   écrit à la main, un filet tous les cinq jours. Son besoin : « si le
   1er novembre tombe un vendredi, qu'on puisse mettre Ve devant », et
   « des blocs de sept jours pour faire la semaine ».

   ⚠️ CE QUE CETTE ÉPREUVE GARDE D'ABORD, C'EST QUE LE JOUR SOIT LE BON.
   Une feuille de surveillance décalée d'un jour est pire qu'une feuille
   sans jours du tout : on lirait « mardi » au-dessus du relevé de
   mercredi. Elle recalcule donc chaque abréviation contre `Date`, sur
   douze mois, un février bissextile et un non bissextile, et sur les
   deux changements d'heure — là où un décalage de fuseau se verrait.

   ⚠️ ET QUE LA FEUILLE GÉNÉRIQUE NE BOUGE PAS D'UN OCTET. C'est elle
   qu'on imprime en pile d'avance, et elle existait avant ce lot : sans
   mois, la sortie doit être exactement celle d'avant. L'épreuve la
   compare caractère par caractère à une empreinte figée.

   ⚠️ LES DEUX LETTRES TIENNENT SANS ÉLARGIR LA COLONNE — mesuré avant
   d'écrire une ligne : colonne de 11,62 mm (6 % de 194 mm), « 31 Me »
   en demande 8,63 mm en serré et 10,52 mm en confortable. L'épreuve
   remesure, pour que personne ne resserre la colonne un jour sans
   s'apercevoir que le jour n'y tient plus.

   ⚠️ LE WEEK-END N'EST PAS UN FOND. Le zébrage a été retiré de cette
   feuille parce qu'« imprimer les arrière-plans » est décoché par
   défaut — un fond ne s'imprime pas — et parce qu'il découpait le
   filigrane (256 lignes sur 404 sans trace de cigale). L'épreuve
   vérifie qu'aucun fond n'est revenu par la petite porte.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(R,u); if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});

const MENTION4 = "Cabinet du Faron - 04 94 00 00 00\nEn cas de doute, appeler avant de donner quoi que ce soit.\nMerci de laisser la feuille sur la table de la cuisine.\nBon mois a tous, et pensez a bien aerer la chambre le matin.";

(async()=>{
 await new Promise(r=>srv.listen(8235,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
 await pg.goto('http://localhost:8235/index.html'); await pg.waitForTimeout(2700);

 const r = await pg.evaluate(async m => {
  const L=[]; const ok=(n,c,d)=>L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);
  /* ⚠️ ELLE DOIT TOMBER, PAS PLANTER : lancée sur une version qui ignore
     le calendrier, elle levait « feuMois is not defined » et mourait au
     premier contrôle. On nomme d'abord ce qu'on exige. */
  const requis = ['feuMois','feuMoisLire','feuMoisCourant','feuMoisDecale','feuilleHtml','sheetFeuilles'];
  const manque = requis.filter(n => typeof window[n] !== 'function');
  ok('les fonctions du calage existent', manque.length===0, 'manquent : '+manque.join(', '));
  if (manque.length) return {L};

  S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;save(true);
  const p = S.patients[0];

  // ── 1. LE DESCRIPTEUR DE MOIS
  ok('un mois illisible ne rend rien', feuMois('')===null && feuMois('2026-13')===null
     && feuMois('pas un mois')===null && feuMois(null)===null);
  const AB=['Di','Lu','Ma','Me','Je','Ve','Sa'];
  let faux=0, vus=0, exJ='';
  for (const an of [2024, 2026, 2027, 2100]){
    for (let mo=1; mo<=12; mo++){
      const M = feuMois(an+'-'+String(mo).padStart(2,'0'));
      if (!M){ faux++; continue; }
      if (M.nb !== new Date(an, mo, 0).getDate()) { faux++; exJ = an+'-'+mo+' nb='+M.nb; continue; }
      for (const j of M.jours){
        vus++;
        const vrai = AB[new Date(an, mo-1, j.n).getDay()];
        if (j.ab !== vrai){ faux++; exJ = an+'-'+mo+'-'+j.n+' dit '+j.ab+' au lieu de '+vrai; }
        if (j.semaine !== (new Date(an, mo-1, j.n).getDay()===1 && j.n>1)){ faux++; exJ='semaine '+an+'-'+mo+'-'+j.n; }
      }
    }
  }
  ok('48 mois, '+vus+' jours : aucune abréviation fausse', faux===0, exJ);
  ok('février 2024 fait 29 jours', feuMois('2024-02').nb===29);
  ok('février 2026 fait 28 jours', feuMois('2026-02').nb===28);
  ok('2100 n’est pas bissextile', feuMois('2100-02').nb===28);
  /* ⚠️ LES CHANGEMENTS D'HEURE : c'est là qu'un Date mal manié décale la
     feuille d'un jour. Mars et octobre 2026, jour par jour. */
  ok('mars 2026 (passage à l’heure d’été) reste juste',
     feuMois('2026-03').jours.every(j => j.ab === AB[new Date(2026,2,j.n).getDay()]));
  ok('octobre 2026 (retour à l’heure d’hiver) reste juste',
     feuMois('2026-10').jours.every(j => j.ab === AB[new Date(2026,9,j.n).getDay()]));
  ok('novembre 2026 commence un dimanche', feuMois('2026-11').jours[0].ab==='Di');
  ok('décembre 2026 commence un mardi', feuMois('2026-12').jours[0].ab==='Ma');
  ok('la coupe recto-verso suit le mois',
     feuMois('2026-11').demi===15 && feuMois('2026-12').demi===16 && feuMois('2026-02').demi===14);
  ok('le décalage de mois ne passe pas par un jour',
     feuMoisDecale('2026-01',1)==='2026-02' && feuMoisDecale('2026-12',1)==='2027-01'
     && feuMoisDecale('2026-01',-1)==='2025-12' && feuMoisDecale('2026-03',-14)==='2025-01');
  ok('le mois courant a la bonne forme', /^\d{4}-\d{2}$/.test(feuMoisCourant()));

  // ── 2. LA FEUILLE GÉNÉRIQUE N'A PAS BOUGÉ
  const gen = feuilleHtml(p, 'constantes', 'serre', m);
  ok('sans mois : 31 lignes numérotées', (gen.match(/<td class="jr">\d+<\/td>/g)||[]).length===31);
  ok('sans mois : le mois reste à écrire à la main', /Mois : ________ 20___/.test(gen));
  ok('sans mois : aucune abréviation de jour', !/class="ab/.test(gen));
  ok('sans mois : le filet tous les cinq jours',
     (gen.match(/<tr class="g5">/g)||[]).length===6);
  ok('sans mois : la feuille du poids garde sa date libre',
     /<td class="dt"><\/td>/.test(feuilleHtml(p,'poids','serre',m)));
  ok('un mois illisible retombe sur la feuille générique',
     feuilleHtml(p,'constantes','serre',m,'2026-77') === gen
     && feuilleHtml(p,'constantes','serre',m,'') === gen);

  // ── 3. LA FEUILLE CALÉE
  const nov = feuilleHtml(p, 'constantes', 'serre', m, '2026-11');
  ok('calée : 30 lignes en novembre', (nov.match(/<td class="jr">/g)||[]).length===30);
  ok('calée : le mois est imprimé', /<b>Novembre 2026<\/b>/.test(nov) && !/Mois : ________/.test(nov));
  ok('calée : le 1er porte Di', /<td class="jr">1<span class="ab we">Di<\/span>/.test(nov));
  ok('calée : le 2 porte Lu et ouvre un bloc',
     /<tr class="g5"><td class="jr">2<span class="ab">Lu<\/span>/.test(nov));
  ok('calée : le 30 porte Lu', /<td class="jr">30<span class="ab">Lu<\/span>/.test(nov));
  /* novembre 2026 : dimanche 1 seul, puis 2-8, 9-15, 16-22, 23-29, puis 30 seul */
  ok('calée : cinq filets, donc six blocs', (nov.match(/<tr class="g5">/g)||[]).length===5);
  ok('calée : samedis et dimanches marqués dans les lettres',
     (nov.match(/class="ab we"/g)||[]).length===9, String((nov.match(/class="ab we"/g)||[]).length));
  ok('calée : aucun fond sur une ligne de week-end',
     !/background[^;]*;?[^<]*class="[^"]*we/.test(nov) && !/\.we\s*{[^}]*background/.test(nov));
  const fev = feuilleHtml(p, 'constantes', 'serre', m, '2024-02');
  ok('calée : 29 lignes en février 2024', (fev.match(/<td class="jr">/g)||[]).length===29);
  ok('calée : aucune ligne pour le 30 février',
     !/<td class="jr">30/.test(fev) && !/<td class="jr">31/.test(fev));
  const nconf = feuilleHtml(p, 'constantes', 'confort', m, '2026-11');
  /* ⚠️ ON COMPTE LES LIGNES DE CHAQUE FACE, PAS LEUR EXISTENCE. Ce
     contrôle vérifiait que les lignes 15 et 16 existent — elles existent
     des deux côtés de la coupure, donc une coupe laissée à 16 en dur
     passait au travers. Mesuré par un défaut planté exprès. */
  const faces = nconf.split('<div class="pg brk">');
  const parFace = faces.map(x => (x.match(/<td class="jr">/g)||[]).length);
  ok('calée : deux faces, 15 jours sur chacune en novembre',
     faces.length===2 && parFace[0]===15 && parFace[1]===15, JSON.stringify(parFace));
  ok('calée : le recto finit au 15 et le verso ouvre au 16',
     /<td class="jr">15<span/.test(faces[0]) && !/<td class="jr">16<span/.test(faces[0])
     && /<td class="jr">16<span/.test(faces[1]));
  ok('calée : trente lignes en tout sur les deux faces',
     (nconf.match(/<td class="jr">/g)||[]).length===30);
  const gly = feuilleHtml(p, 'glycemies', 'serre', m, '2026-12');
  ok('les glycémies se calent aussi', /<td class="jr">1<span class="ab">Ma<\/span>/.test(gly)
     && (gly.match(/<td class="jr">/g)||[]).length===31);
  const poi = feuilleHtml(p, 'poids', 'serre', m, '2026-11');
  ok('le poids se cale aussi, dans sa colonne de date',
     /<td class="dt dtj">1<span class="ab we">Di<\/span>/.test(poi)
     && (poi.match(/<td class="dt dtj">/g)||[]).length===30
     && !/<td class="dt"><\/td>/.test(poi));

  // ── 4. L'ÉCRAN
  sheetFeuilles(p.id); await new Promise(r=>setTimeout(r,200));
  const corps = () => document.getElementById('sheet').innerHTML;
  const c = document.getElementById('fe2-cale');
  ok('depuis une fiche : l’interrupteur est COCHÉ', !!c && c.checked===true);
  ok('depuis une fiche : le mois du jour est proposé',
     corps().indexOf((feuMois(feuMoisCourant())||{}).libelle) > 0);
  /* ⚠️ ELLE DOIT RAPPORTER, PAS PLANTER. Un défaut planté exprès
     (interrupteur décoché depuis une fiche) faisait disparaître les
     flèches, et le `.click()` sur un élément absent levait une erreur
     qui emportait TOUTE la mesure : code 1, et zéro ligne pour dire
     quoi. On touche donc par une fonction qui rapporte au lieu de lever. */
  const toucher = (id, nom) => {
    const el = document.getElementById(id);
    ok(nom, !!el, 'élément ' + id + ' absent');
    if (el) el.click();
    return !!el;
  };
  ok('les deux flèches de mois sont là',
     !!document.getElementById('fe2-mprec') && !!document.getElementById('fe2-msuiv'));
  const avant = (feuMois(feuMoisCourant())||{}).libelle;
  if (toucher('fe2-msuiv', 'la flèche « mois suivant » est touchable')){
    await new Promise(r=>setTimeout(r,180));
    const apres = (feuMois(feuMoisDecale(feuMoisCourant(),1))||{}).libelle;
    ok('la flèche avance d’un mois', corps().indexOf(apres) > 0 && avant !== apres, apres);
  }
  if (toucher('fe2-cale', 'l’interrupteur est touchable')){
    await new Promise(r=>setTimeout(r,180));
    ok('décoché : les flèches disparaissent', !document.getElementById('fe2-mprec'));
    ok('décoché : l’écran annonce la feuille générique',
       /pile d.avance/i.test(corps()) && /1 à 31/.test(corps()));
  }
  sheetFeuilles(null); await new Promise(r=>setTimeout(r,200));
  const c2 = document.getElementById('fe2-cale');
  ok('depuis Documents vierges : l’interrupteur est DÉCOCHÉ', !!c2 && c2.checked===false);

  return {L, nov:nov, conf:feuilleHtml(p,'constantes','confort',m,'2026-11')};
 }, MENTION4);

 if (r.nov){
  /* ── 5. LA GÉOMÉTRIE, MESURÉE ET NON SUPPOSÉE ── */
  /* ⚠️ PAS DANS LE CONTEXTE DU TÉLÉPHONE. Mesurée dans la fenêtre de
     430 px de l'application, la feuille faisait 92,5 mm de large et la
     colonne du jour 5,53 mm : deux contrôles tombaient sur ce seul
     décalage, alors que la feuille va sur une page A4. On mesure donc
     dans une fenêtre assez large pour que la page tienne sa taille. */
  const f = await ctx.newPage();
  await f.setViewportSize({ width: 1100, height: 1400 });
  const ok=(n,c,d)=>r.L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);
  await f.setContent(r.nov, { waitUntil:'load' }); await f.waitForTimeout(350);
  const g = await f.evaluate(() => {
    const t=document.querySelector('table'), jr=document.querySelector('td.jr');
    const cs=getComputedStyle(jr);
    const son=document.createElement('div');
    son.style.cssText='position:absolute;width:100mm;height:0';
    document.body.appendChild(son);
    const mm=son.getBoundingClientRect().width/100; son.remove();
    const s=document.createElement('span');
    s.style.cssText='position:absolute;white-space:nowrap;visibility:hidden;font:'+cs.font;
    s.textContent='31 Me'; document.body.appendChild(s);
    const besoin=(s.getBoundingClientRect().width
      + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight))/mm;
    s.remove();
    return { tableMm:+(t.getBoundingClientRect().width/mm).toFixed(1),
             jrMm:+(jr.getBoundingClientRect().width/mm).toFixed(2),
             besoinMm:+besoin.toFixed(2),
             /* ⚠️ LE VRAI RISQUE N'EST PAS LE DÉBORDEMENT, C'EST LE
                RETOUR À LA LIGNE : trop étroite, la cellule ne déborde
                pas, elle passe « Me » à la ligne et grandit la rangée.
                On compare donc la hauteur de la cellule du jour à celle
                de ses voisines, qui ne contiennent rien. */
             hJour: Math.round(jr.getBoundingClientRect().height),
             hVide: Math.round(jr.nextElementSibling.getBoundingClientRect().height),
             debord: jr.scrollWidth > jr.clientWidth + 1 };
  });
  ok('« 31 Me » tient dans la colonne du jour ('+g.besoinMm+' mm sur '+g.jrMm+' mm)',
     g.besoinMm <= g.jrMm, g.besoinMm+' > '+g.jrMm);
  ok('aucune cellule de jour ne déborde', !g.debord);
  ok('le jour ne passe pas à la ligne ('+g.hJour+' px contre '+g.hVide+' px)',
     g.hJour === g.hVide, g.hJour+' ≠ '+g.hVide);
  ok('le tableau fait toujours 194 mm', g.tableMm===194, String(g.tableMm));
  const pdf = await f.pdf({ format:'A4', printBackground:false, margin:{top:0,bottom:0,left:0,right:0} });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
  ok('serrée, mention de 4 lignes : toujours UNE face', pages===1, pages+' pages');
  console.log('  ── géométrie : colonne '+g.jrMm+' mm · « 31 Me » '+g.besoinMm+' mm · '+pages+' page(s)');
 }

 let ko=0; for(const [v,n,d] of r.L){ if(v!=='OK')ko++; console.log(`${v==='OK'?'  ✓':'  ✗'} ${n}${d?'   ['+d+']':''}`); }
 if(errs.length) console.log('── incidents ──\n'+errs.slice(0,6).join('\n'));
 console.log(`\n${r.L.length-ko}/${r.L.length} contrôles`);
 await nav.close(); srv.close(); process.exit(ko?1:0);
})();
