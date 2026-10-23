// DEUX THÈMES DE PLUS, ET UN ÉCRAN DE CHOIX QUI SE LIT.
//
// ⚠️ ÉCRITE AVANT, et vérifiée en rouge contre la v1.23.0 livrée : les deux
//    thèmes n'existent pas, l'écran n'a ni familles ni vignettes, et les
//    blocs de jetons ne visent que <html>.
//
// ⚠️ CE QU'ELLE GARDE AVANT TOUT : que « vu » et « vigilance » ne sortent
//    jamais de la même couleur. Premier jet de Littoral : accent ET danger
//    en terre cuite — à l'écran, un patient vu et un patient en vigilance
//    étaient identiques. Dans une application de soins c'est le seul
//    défaut qui ne se discute pas, et aucun contraste ne le rattrape.
//
// ⚠️ ET QUE LES VIGNETTES MONTRENT CHACUNE SON THÈME. Posées d'abord avec
//    `data-app-theme` sur un <span>, elles sortaient toutes identiques :
//    les blocs de jetons ne visaient que `html[...]`. Mesuré en comparant
//    les couleurs réellement calculées de deux vignettes.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8224,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8224/index.html'); await pg.waitForTimeout(2700);
 await pg.evaluate(() => { S.confidentialityAck=true; S.firstRun=false; S.eggs={retro:true};
   openId=null; render(); });

 /* Outils de mesure : couleur résolue et contraste. */
 /* ⚠️ `eval()` EST EN MODE STRICT DANS LA PAGE : un `const` déclaré
    dedans ne sort pas de son propre eval, et les contrôles tombaient sur
    « ecart is not defined » au lieu de mesurer quoi que ce soit. On pose
    les outils sur l'objet global. */
 const OUTILS = `
   globalThis.res = c => { const d=document.createElement('div'); d.style.color=c;
     document.body.appendChild(d); const v=getComputedStyle(d).color; d.remove();
     return (v.match(/\\d+/g)||[0,0,0]).slice(0,3).map(Number); };
   globalThis.L = c => { const f=v=>{v/=255; return v<=.03928? v/12.92 : Math.pow((v+.055)/1.055,2.4);};
     return .2126*f(c[0])+.7152*f(c[1])+.0722*f(c[2]); };
   globalThis.ratio = (a,b) => { const x=globalThis.L(globalThis.res(a)), y=globalThis.L(globalThis.res(b));
     return +(((Math.max(x,y)+.05)/(Math.min(x,y)+.05)).toFixed(2)); };
   globalThis.ecart = (a,b) => { const p=globalThis.res(a), q=globalThis.res(b);
     return Math.abs(p[0]-q[0]) + Math.abs(p[1]-q[1]) + Math.abs(p[2]-q[2]); };
 `;

 /* ═══ ① LES DEUX THÈMES EXISTENT ET SONT RANGÉS ═══ */
 console.log('═══ LES DEUX THÈMES ═══');
 const cat = await pg.evaluate(() => ({
   littoral: !!APP_THEMES.littoral, bureau: !!APP_THEMES.bureau,
   fam: (typeof themesParFamille === "function")
      ? themesParFamille().map(g => g.id + ":" + g.themes.join("|")) : null,
   clair: (typeof themeEstClair === "function")
      ? { littoral:themeEstClair("littoral"), bureau:themeEstClair("bureau"),
          original:themeEstClair("original"), bloc:themeEstClair("bloc") } : null
 }));
 ok('Littoral est au catalogue', cat.littoral === true);
 ok('Bureau 2001 est au catalogue', cat.bureau === true);
 ok('les familles existent', Array.isArray(cat.fam) && cat.fam.length >= 4, JSON.stringify(cat.fam));
 ok('Littoral est rangé dans les sobres',
    (cat.fam||[]).some(f => f.startsWith("sobres:") && f.includes("littoral")), JSON.stringify(cat.fam));
 ok('Bureau 2001 est rangé dans le rétro',
    (cat.fam||[]).some(f => f.startsWith("retro:") && f.includes("bureau")), JSON.stringify(cat.fam));
 ok('les deux sont déclarés clairs', cat.clair && cat.clair.littoral && cat.clair.bureau, JSON.stringify(cat.clair));
 ok('… et Original sombre', cat.clair && cat.clair.original === false);
 /* Aucun thème ne doit tomber hors des familles. */
 /* ⚠️ Protégé : sur le code d'avant la fonction n'existe pas, et
    l'épreuve doit TOMBER en le disant, pas s'arrêter là. */
 const orphelins = await pg.evaluate(() => {
   if (typeof themesParFamille !== "function") return ["(pas de familles)"];
   const dans = themesParFamille().flatMap(g => g.themes);
   return themesDispo().map(([k]) => k).filter(k => !dans.includes(k));
 });
 ok('aucun thème hors famille', orphelins.length === 0, orphelins.join(","));

 /* ═══ ② VU ET VIGILANCE NE SE CONFONDENT PAS ═══ */
 console.log('═══ LES STATUTS RESTENT DISTINCTS ═══');
 const stats = await pg.evaluate((src) => {
   eval(src);
   const out = {};
   Object.keys(APP_THEMES).forEach(t => {
     S.theme = t; applyTheme();
     const cs = getComputedStyle(document.documentElement);
     const a = cs.getPropertyValue('--accent').trim();
     const d = cs.getPropertyValue('--danger').trim();
     const m = cs.getPropertyValue('--amber').trim();
     out[t] = { vu_vig: ecart(a, d), vu_avoir: ecart(a, m), vig_avoir: ecart(d, m) };
   });
   return out;
 }, OUTILS);
 Object.entries(stats).forEach(([t, v]) => {
   /* ⚠️ 60 d'écart cumulé sur R+G+B : en dessous, deux pastilles côte à
      côte ne se distinguent plus sur un écran au soleil. Terre cuite
      contre terre cuite valait 0. */
   ok(`${t.padEnd(9)} vu ≠ vigilance (${v.vu_vig})`, v.vu_vig >= 60, JSON.stringify(v));
 });

 /* ═══ ③ LES SIGNATURES DES DEUX THÈMES ═══ */
 console.log('═══ CE QUI FAIT CHACUN DES DEUX ═══');
 const litt = await pg.evaluate((src) => {
   eval(src);
   if (!APP_THEMES.littoral) return { absent:true };
   S.theme = "littoral"; applyTheme(); render();
   const l = document.querySelector('.lab, .mgroup-t, .kicker');
   const cs = l ? getComputedStyle(l) : null;
   const cig = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
   const nm = document.querySelector('.brand-nm');
   return {
     plaqueFond: cs ? cs.backgroundColor : null,
     plaqueTexte: cs ? cs.color : null,
     plaqueBord: cs ? cs.borderTopWidth : null,
     plaqueOpacite: cs ? cs.opacity : null,
     contrastePlaque: cs ? ratio(cs.color, cs.backgroundColor) : null,
     accent: cig,
     marque: nm ? getComputedStyle(nm).color : null
   };
 }, OUTILS);
 ok('Littoral : les titres sont des plaques pleines',
    /rgb\(21, 86, 110\)/.test(litt.plaqueFond||""), litt.plaqueFond);
 ok('… à liseré blanc', parseFloat(litt.plaqueBord) >= 2, litt.plaqueBord);
 /* ⚠️ `.rowlab span` impose une opacité de .62 : sans la contrer, la
    plaque sortait délavée — l'inverse d'un émail. */
 ok('… et à pleine opacité', parseFloat(litt.plaqueOpacite) === 1, litt.plaqueOpacite);
 ok('… lisibles', (litt.contrastePlaque||0) >= 7, litt.contrastePlaque);
 ok('Littoral : l\'accent est l\'olivier, pas la terre cuite',
    /rgb\(74, 93, 50\)/.test(litt.accent) || litt.accent === "#4A5D32", litt.accent);
 ok('… mais la marque reste terre cuite',
    /rgb\(168, 67, 42\)/.test(litt.marque||""), litt.marque);

 await pg.evaluate(() => { if (APP_THEMES.bureau){ S.theme = "bureau"; applyTheme(); }
   if (typeof closeSheet === "function") closeSheet(true); render(); });
 await pg.waitForTimeout(500);
 const bur = await pg.evaluate((src) => {
   eval(src);
   const b = document.querySelector('.brand');
   const bb = document.querySelector('.bottombar');
   /* ⚠️ On cherche une pastille RÉELLEMENT à l'écran : prise au hasard
      pendant qu'une feuille se referme, il n'y en avait aucune et le
      contrôle tombait sur du vide au lieu de mesurer un rayon. */
   const ch = [...document.querySelectorAll('.chip, .fchip')].find(e => e.offsetParent);
   return {
     titre: b ? getComputedStyle(b).backgroundImage : "",
     taches: bb ? getComputedStyle(bb).backgroundImage : "",
     rayon: ch ? getComputedStyle(ch).borderRadius : "(aucune pastille à l'écran)",
     police: getComputedStyle(document.body).fontFamily,
     /* On ne pose AUCUN faux bouton de fenêtre : un ✕ décoratif, dans une
        application de soins, finit par être touché. */
     fauxBoutons: /[_□✕]/.test((b ? b.textContent : "").replace(/\s/g,""))
   };
 }, OUTILS);
 ok('Bureau : le bandeau est une barre de titre dégradée',
    /linear-gradient/.test(bur.titre), bur.titre.slice(0,60));
 ok('… la barre du bas une barre des tâches', /linear-gradient/.test(bur.taches), bur.taches.slice(0,60));
 ok('… les pastilles sont équarries', parseFloat(bur.rayon) <= 4, bur.rayon);
 ok('… la police est celle de l\'époque', /Tahoma|Verdana/i.test(bur.police), bur.police);
 ok('… et aucun faux bouton de fenêtre n\'est posé', bur.fauxBoutons === false);

 /* ═══ ④ L'ÉCRAN DE CHOIX ═══ */
 console.log('═══ L\'ÉCRAN DE CHOIX ═══');
 await pg.evaluate(() => { S.theme="original"; applyTheme(); sheetPersoZone("couleurs"); });
 await pg.waitForTimeout(500);
 const ecr = await pg.evaluate(() => ({
   familles: document.querySelectorAll('#sheet .pz-fam').length,
   lignes: document.querySelectorAll('#sheet .pz-th').length,
   vignettes: document.querySelectorAll('#sheet .pz-th-v').length,
   badges: document.querySelectorAll('#sheet .pz-th-b').length,
   coche: document.querySelectorAll('#sheet .pz-th.on').length
 }));
 ok('les familles sont à l\'écran', ecr.familles >= 4, ecr.familles);
 ok('chaque thème a sa ligne', ecr.lignes === (await pg.evaluate(()=>themesDispo().length)), ecr.lignes);
 ok('… sa vignette', ecr.vignettes === ecr.lignes, ecr.vignettes + "/" + ecr.lignes);
 ok('… et son étiquette clair/sombre', ecr.badges === ecr.lignes, ecr.badges + "/" + ecr.lignes);
 ok('le thème courant est coché, une seule fois', ecr.coche === 1, ecr.coche);

 /* ⚠️ LE CONTRÔLE QUI TOMBE SI LES VIGNETTES REDEVIENNENT TOUTES PAREILLES. */
 const vig = await pg.evaluate((src) => {
   eval(src);
   const lire = k => {
     if (!document.querySelector('#sheet .pz-th')) return "rgb(0, 0, 0)";
     const b = document.querySelector(`#sheet .pz-th[data-pth="${k}"] .pz-th-v`);
     if (!b) return null;
     const cs = getComputedStyle(b);
     return cs.backgroundColor;
   };
   return { original:lire("original"), bloc:lire("bloc"), littoral:lire("littoral"),
            bureau:lire("bureau"), cosmos:lire("cosmos"),
            ecartOB: ecart(lire("original"), lire("bloc")),
            ecartLB: ecart(lire("littoral"), lire("bureau")) };
 }, OUTILS);
 console.log(`     fonds des vignettes : original ${vig.original} · bloc ${vig.bloc} · littoral ${vig.littoral} · bureau ${vig.bureau}`);
 ok('la vignette d\'un thème clair n\'a pas le fond d\'un thème sombre',
    vig.ecartOB >= 200, vig.ecartOB);
 ok('deux thèmes clairs ne se confondent pas non plus', vig.ecartLB >= 20, vig.ecartLB);
 ok('la vignette d\'Original montre SES couleurs, pas celles du thème affiché',
    await pg.evaluate((src) => { eval(src);
      if (!APP_THEMES.littoral) return false;
      S.theme = "littoral"; applyTheme(); sheetPersoZone("couleurs");
      const b = document.querySelector('#sheet .pz-th[data-pth="original"] .pz-th-v');
      return ecart(getComputedStyle(b).backgroundColor, getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()) >= 200;
    }, OUTILS));

 /* On choisit un thème depuis l'écran : il s'applique. */
 await pg.evaluate(() => { S.theme="original"; applyTheme(); sheetPersoZone("couleurs"); });
 await pg.waitForTimeout(400);
 if (await pg.evaluate(() => !!document.querySelector('#sheet .pz-th[data-pth="littoral"]')))
   await pg.click('#sheet .pz-th[data-pth="littoral"]');
 await pg.waitForTimeout(500);
 ok('toucher une ligne applique le thème', await pg.evaluate(() => S.theme === "littoral"));
 await pg.evaluate(() => { S.theme="original"; applyTheme(); save(true); });

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
