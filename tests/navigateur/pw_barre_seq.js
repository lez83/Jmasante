// LA BARRE DU DÉROULÉ RESTE VISIBLE PENDANT LA SAISIE (v1.26.0)
//
// ⚠️ ÉCRITE APRÈS UNE MESURE QUI A RENVERSÉ LE DIAGNOSTIC. Tout était
//    déjà écrit — `position:sticky;top:0` dans la feuille de style, un
//    commentaire affirmant « elle reste maintenant collée en haut », une
//    classe `.compact` et son écouteur de défilement. Rien ne marchait :
//    après 850 px de défilement la barre se retrouvait à −71 px, soit
//    EXACTEMENT sa position naturelle. Elle n'avait jamais collé.
//
// ⚠️ LA CAUSE TENAIT EN UNE LIGNE : `body{overflow-x:hidden}`, en double
//    avec celle de `html`. Une valeur d'overflow autre que `visible` fait
//    du body un conteneur de défilement — et un élément collé se colle au
//    bord de SON conteneur de défilement. Le body ne défile pas, c'est
//    html qui défile : la boîte de référence ne bougeait jamais.
//
// ⚠️ CE QUE CETTE ÉPREUVE GARDE N'EST PAS LA RÈGLE CSS, C'EST LE
//    COMPORTEMENT. Un contrôle du genre « .seq-nav a bien position:sticky »
//    serait resté VERT pendant tous les mois où la barre ne collait pas.
//    On défile pour de bon et on regarde où la barre se trouve.
//
// ⚠️ ET ON GARDE AUSSI L'ABSENCE DE DÉBORDEMENT HORIZONTAL, puisque c'est
//    la ligne retirée qui l'empêchait en double : largeur du document
//    relevée sur les quinze thèmes, décors compris.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8226,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:930}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8226/index.html'); await pg.waitForTimeout(2700);
 await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false;
   delete S.barreHaut; openId=null; render(); });
 await pg.waitForTimeout(300);

 const entre = await pg.evaluate(()=>{ if(typeof enterSeqMode!=="function") return false;
   enterSeqMode(); return true; });
 await pg.waitForTimeout(900);
 ok('① on entre dans le déroulé', entre === true);

 const etat = () => pg.evaluate(()=>{
   const n=document.querySelector('#seq-mode .seq-nav');
   if(!n) return null;
   const r=n.getBoundingClientRect();
   const v=n.querySelector('#sq-valid'), p=n.querySelector('#sq-prev'), s=n.querySelector('#sq-next');
   const vis=e=>{ if(!e) return false; const x=e.getBoundingClientRect();
     return x.height>0 && x.top>=-1 && x.bottom<=window.innerHeight+1; };
   return { top:Math.round(r.top), bas:Math.round(r.bottom), h:Math.round(r.height),
            compact:n.classList.contains('compact'),
            y:Math.round(window.scrollY),
            valider:vis(v), prec:vis(p), suiv:vis(s),
            prog:n.querySelectorAll('.sq-prog i').length,
            progVisible:(()=>{const g=n.querySelector('.sq-prog');
              return !!g && g.getBoundingClientRect().height>0;})(),
            nom:(n.querySelector('.sq-nom')||{}).textContent||'',
            posTexte:((n.querySelector('.sq-pos')||{}).innerText||'').replace(/\s+/g,' ').trim(),
            hauteurVue:window.innerHeight };
 });
 const defiler = async y => { await pg.evaluate(v=>window.scrollTo(0,v), y);
   await pg.waitForTimeout(350); return etat(); };

 /* ═══ ② AU REPOS ═══ */
 console.log('═══ AU REPOS, EN HAUT DE PAGE ═══');
 const repos = await defiler(0);
 console.log('     hauteur de la barre : ' + repos.h + ' px sur ' + repos.hauteurVue + ' px d\'écran');
 ok('② au repos elle n\'est pas resserrée', repos.compact === false);
 /* ⚠️ « PASSAGE », PAS « PATIENT » — CHANGÉ EXPRÈS EN v1.27.0, quand le
    déroulé s'est mis à lister des passages : chez trois patients dont un à
    passage supplémentaire, « Patient 4 / 4 » était faux deux fois. Ce que
    ce contrôle garde ici, c'est que le mot est ENTIER au repos et tombe
    une fois la barre resserrée ; le compte lui-même est gardé par
    `pw_sup_deroule`. */
 ok('② et le compteur est en toutes lettres',
    /^Passage \d+ \/ \d+$/.test(repos.posTexte), JSON.stringify(repos.posTexte));

 /* ═══ ③ ELLE RESTE EN HAUT QUAND ON DESCEND — LE CŒUR ═══ */
 console.log('═══ ON DESCEND DANS LA SAISIE ═══');
 const etapes = [];
 for (const y of [300, 600, 900, 1400]){
   const e = await defiler(y);
   etapes.push(e);
   console.log(`     scrollY ${String(y).padStart(4)} → barre à ${String(e.top).padStart(4)} px`
     + `, hauteur ${e.h} px, ${e.compact?'resserrée':'pleine  '}`
     + `, valider ${e.valider?'✓':'✗'}`);
 }
 /* ⚠️ LE CONTRÔLE QUI AURAIT DÛ EXISTER IL Y A DES MOIS — et il porte sur
    ce qui a été DEMANDÉ : « que ce bandeau reste visible en permanence ».
    Pas « qu'il soit à top:0 » : tant qu'il n'a pas atteint le haut, il est
    encore dans le flux et c'est très bien ainsi. Ce qu'on garde, c'est
    qu'il soit ENTIÈREMENT dans l'écran à chaque instant. */
 ok('③ la barre reste entièrement visible à tous les défilements',
    etapes.every(e => e.top >= 0 && e.bas <= e.hauteurVue),
    etapes.map(e => e.top + '→' + e.bas + 'px').join(' · '));
 /* Et une fois en haut, elle y reste : elle ne repart jamais vers le haut. */
 ok('③ une fois arrivée en haut, elle s\'y arrête',
    etapes.filter(e => e.compact).every(e => e.top >= 0 && e.top < 10),
    etapes.filter(e => e.compact).map(e => e.top + 'px').join(' · ') || 'jamais collée');
 ok('③ « Valider le passage » reste atteignable sans remonter',
    etapes.every(e => e.valider), etapes.map(e => e.valider).join(','));
 ok('③ « Préc. » et « Suiv. » aussi',
    etapes.every(e => e.prec && e.suiv));
 /* Et elle ne part pas non plus tout en bas du formulaire. */
 const basDePage = await pg.evaluate(async()=>{ window.scrollTo(0, document.body.scrollHeight);
   await new Promise(r=>setTimeout(r,350));
   const n=document.querySelector('#seq-mode .seq-nav');
   return Math.round(n.getBoundingClientRect().top); });
 ok('③ même tout en bas du formulaire', basDePage >= 0 && basDePage < 80, basDePage + ' px');

 /* ═══ ④ ELLE SE RESSERRE, ET AU BON MOMENT ═══ */
 console.log('═══ LE RESSERREMENT ═══');
 const resserree = etapes[etapes.length-1];
 console.log('     pleine : ' + repos.h + ' px · resserrée : ' + resserree.h + ' px'
   + '  (' + Math.round(resserree.h / repos.hauteurVue * 100) + ' % de l\'écran)');
 ok('④ elle se resserre une fois collée', resserree.compact === true);
 /* ⚠️ MESURÉ, PAS ESTIMÉ : c'est la hauteur rendue qui décide, pas le
    nombre de règles CSS. La maquette validée annonçait « un tiers de
    moins que la barre entière ». */
 ok('④ elle perd au moins un quart de sa hauteur',
    resserree.h <= repos.h * 0.75, repos.h + ' → ' + resserree.h + ' px');
 ok('④ et ne dépasse pas 20 % de l\'écran',
    resserree.h <= resserree.hauteurVue * 0.20,
    Math.round(resserree.h / resserree.hauteurVue * 100) + ' %');
 /* ⚠️ CE QUI RESTE EST CE QUI A ÉTÉ VALIDÉ EN MAQUETTE : le nom, le
    compteur court, les pastilles, et les trois actions. */
 ok('④ le nom du patient reste lisible', resserree.nom.trim().length > 0, JSON.stringify(resserree.nom));
 ok('④ le compteur se raccourcit mais reste',
    /^\d+ \/ \d+$/.test(resserree.posTexte), JSON.stringify(resserree.posTexte));
 ok('④ les pastilles de progression restent visibles',
    resserree.progVisible === true && resserree.prog > 0,
    resserree.prog + ' pastilles, visibles : ' + resserree.progVisible);

 /* ═══ ⑤ SOUS LA BARRE D'ÉTAT DU TÉLÉPHONE ═══ */
 console.log('═══ LA BARRE D\'ÉTAT DU TÉLÉPHONE ═══');
 /* ⚠️ COLLÉE À `top:0`, ELLE PASSERAIT SOUS L'HEURE ET LA BATTERIE. La
    réserve est posée en padding sur l'état resserré, pour que le FOND de
    la barre couvre la bande — sinon le contenu y défilerait à nu. */
 const avecReserve = await pg.evaluate(async()=>{
   S.barreHaut = 44; if (typeof appliquerBarreHaut === "function") appliquerBarreHaut();
   window.scrollTo(0, 1200); await new Promise(r=>setTimeout(r,350));
   const n=document.querySelector('#seq-mode .seq-nav');
   const r=n.getBoundingClientRect(), cs=getComputedStyle(n);
   const b=n.querySelector('#sq-prev').getBoundingClientRect();
   return { top:Math.round(r.top), padTop:cs.paddingTop,
            premierBouton:Math.round(b.top), fond:cs.backgroundColor };
 });
 console.log('     réserve déclarée 44 px → padding haut ' + avecReserve.padTop
   + ', premier bouton à ' + avecReserve.premierBouton + ' px');
 ok('⑤ la barre part toujours du haut de l\'écran', avecReserve.top >= 0 && avecReserve.top < 10,
    avecReserve.top + ' px');
 ok('⑤ mais ses boutons descendent sous la barre d\'état',
    avecReserve.premierBouton >= 44, avecReserve.premierBouton + ' px (attendu ≥ 44)');
 ok('⑤ et son fond couvre la bande, le contenu ne défile pas à nu',
    !/rgba\(0, 0, 0, 0\)|transparent/.test(avecReserve.fond), avecReserve.fond);
 const sansReserve = await pg.evaluate(async()=>{
   S.barreHaut = "auto"; if (typeof appliquerBarreHaut === "function") appliquerBarreHaut();
   window.scrollTo(0, 1200); await new Promise(r=>setTimeout(r,350));
   const n=document.querySelector('#seq-mode .seq-nav');
   return Math.round(n.querySelector('#sq-prev').getBoundingClientRect().top);
 });
 ok('⑤ sans réserve déclarée, aucune place perdue',
    sansReserve < 20, sansReserve + ' px');

 /* ═══ ⑥ LE RUBAN DE REPRISE NE COLLE PAS ═══ */
 console.log('═══ CE QUI NE DOIT PAS COLLER ═══');
 const ruban = await pg.evaluate(()=>{
   const r=document.getElementById('sq-reprise');
   return r ? getComputedStyle(r).position : "absent";
 });
 ok('⑥ le ruban de reprise reste dans le flux',
    ruban === "absent" || ruban === "static" || ruban === "relative", ruban);

 /* ═══ ⑦ AUCUN DÉBORDEMENT HORIZONTAL ═══ */
 console.log('═══ RIEN NE DÉBORDE SUR LE CÔTÉ ═══');
 /* ⚠️ C'EST LA CONTREPARTIE DU CORRECTIF : la ligne retirée empêchait le
    débordement en double. Celle de `html` reste — on le vérifie, thème
    par thème, décors compris, plutôt que de le supposer. */
 const themes = await pg.evaluate(()=>(typeof APP_THEMES!=="undefined")?Object.keys(APP_THEMES):[]);
 const large = [];
 for (const t of themes){
   const r = await pg.evaluate(async k=>{ S.theme=k; applyTheme();
     await new Promise(r=>setTimeout(r,60));
     const de=document.documentElement;
     return { sw:de.scrollWidth, cw:de.clientWidth }; }, t);
   if (r.sw > r.cw + 1) large.push(t + ' (' + r.sw + '>' + r.cw + ')');
 }
 ok('⑦ aucun thème ne fait déborder la page dans le déroulé',
    large.length === 0, large.join(', '));
 await pg.evaluate(()=>{ S.theme="original"; applyTheme();
   if (typeof exitSeqMode === "function") exitSeqMode(); render(); });
 await pg.waitForTimeout(500);
 const dehors = await pg.evaluate(()=>{
   const de=document.documentElement;
   return { sw:de.scrollWidth, cw:de.clientWidth,
            bodyOv:getComputedStyle(document.body).overflowX,
            htmlOv:getComputedStyle(document.documentElement).overflowX }; });
 ok('⑦ ni hors du déroulé', dehors.sw <= dehors.cw + 1, JSON.stringify(dehors));
 ok('⑦ et c\'est bien `html` qui porte la coupe, pas le body',
    dehors.htmlOv === "hidden" && dehors.bodyOv === "visible", JSON.stringify(dehors));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
