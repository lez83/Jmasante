// LA PLACE DE LA BARRE D'ÉTAT DU TÉLÉPHONE.
//
// ⚠️ ÉCRITE AVANT LA CORRECTION, et vérifiée en rouge : la règle qui
//    réserve le haut existait, mais enfermée dans
//    `@media (display-mode: standalone)` — le mode « installé ». Dans
//    l'application Android le mode est `browser`, la règle n'était jamais
//    appliquée, et l'heure du système se posait sur le bandeau de marque.
//    Le code d'avant fait tomber les contrôles de cette épreuve parce
//    qu'elle mesure le haut du bandeau avec une encoche SIMULÉE.
//
// ⚠️ COMMENT ON SIMULE UNE ENCOCHE SANS TÉLÉPHONE : `env()` vaut 0 sur un
//    écran d'ordinateur, et aucun outil ne permet de le forcer. Mais toute
//    l'application lit `--sbtop`, jamais `env()` directement — justement
//    pour que le réglage manuel puisse l'emporter. L'épreuve pose donc
//    `--sbtop` à la main : c'est exactement le chemin qu'emprunte un
//    téléphone qui ne déclare rien.
//
// ⚠️ CE QU'ELLE GARDE AUSSI : que le mode « installé » ne soit plus la
//    condition. Un contrôle lit la feuille de style et tombe si le retrait
//    du haut y retourne.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8222,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8222/index.html'); await pg.waitForTimeout(2700);
 await pg.evaluate(() => { S.confidentialityAck=true; S.firstRun=false; delete S.barreHaut;
   openId=null; render(); });

 /* ═══ ① LE MODE « INSTALLÉ » N'EST PLUS LA CONDITION ═══ */
 console.log('═══ LA RÈGLE S\'APPLIQUE HORS MODE INSTALLÉ ═══');
 const css = fs.readFileSync(path.join(ROOT,'css','app.css'),'utf-8');
 const bloc = (css.match(/@media \(display-mode: standalone\)\{[\s\S]*?\}\s*\}/)||[""])[0];
 ok('le navigateur n\'est pas en mode installé — comme l\'app Android',
    await pg.evaluate(() => !matchMedia('(display-mode: standalone)').matches
                         &&  matchMedia('(display-mode: browser)').matches));
 ok('le retrait du haut n\'est plus enfermé dans le mode installé',
    !/safe-area-inset-top|--sbtop/.test(bloc), bloc.replace(/\s+/g," ").slice(0,90));
 ok('il est posé sans condition, par une variable',
    /:root\{[^}]*--sbtop:\s*env\(safe-area-inset-top/.test(css));
 ok('et .wrap la lit', /\.wrap\{[^}]*padding:calc\(16px \+ var\(--sbtop\)\)/.test(css));

 /* ═══ ② AVEC UNE ENCOCHE SIMULÉE, LE BANDEAU DESCEND ═══ */
 console.log('═══ AVEC UNE BARRE DE 40 px ═══');
 const hautBandeau = () => pg.evaluate(() => {
   const b = document.querySelector('.brand') || document.querySelector('.wrap > *');
   return b ? Math.round(b.getBoundingClientRect().top) : -1;
 });
 const h0 = await hautBandeau();
 await pg.evaluate(() => document.documentElement.style.setProperty('--sbtop','40px'));
 const h1 = await hautBandeau();
 console.log(`     haut du bandeau : ${h0} px sans barre · ${h1} px avec 40 px réservés`);
 ok('sans barre déclarée, le bandeau reste où il était', h0 === 16, h0);
 ok('avec 40 px déclarés, il descend d\'exactement 40 px', h1 - h0 === 40, h1 - h0);
 ok('… et rien ne dépasse au-dessus de lui',
    await pg.evaluate(() => {
      const top = [...document.querySelectorAll('.wrap *')]
        .map(e => e.getBoundingClientRect())
        .filter(r => r.height > 0 && r.width > 0)
        .reduce((m,r) => Math.min(m, r.top), 1e9);
      return top >= 40;
    }));
 await pg.evaluate(() => document.documentElement.style.removeProperty('--sbtop'));

 /* ═══ ③ LES AUTRES ÉCRANS COLLÉS AU BORD HAUT ═══ */
 console.log('═══ LES AUTRES ÉCRANS DU HAUT ═══');
 ok('le salut du jour réserve la place', /\.daily-greet\{[^}]*padding-top:calc\(14px \+ var\(--sbtop\)\)/.test(css));
 ok('la croix du visionneur de documents aussi', /\.dv-close\{[^}]*top:calc\(16px \+ var\(--sbtop\)\)/.test(css));
 ok('l\'aperçu de fiche lit la variable, plus env() en direct',
    /\.fiche-prev \.fp-bar\{[\s\S]{0,200}calc\(10px \+ var\(--sbtop\)\)/.test(css));
 ok('la barre du jeu aussi', /#jeu-barre\{[\s\S]{0,400}calc\(6px \+ var\(--sbtop\)\)/.test(css));
 ok('plus aucun env(safe-area-inset-top) en direct dans la feuille',
    !/env\(safe-area-inset-top[^)]*\)/.test(css.replace(/--sbtop:\s*env\(safe-area-inset-top[^;]*;/,"")),
    (css.match(/[^\n]*env\(safe-area-inset-top[^\n]*/g)||[]).slice(0,3).join(" | "));

 /* ═══ ④ LE RÉGLAGE MANUEL, POUR LES TÉLÉPHONES QUI NE DÉCLARENT RIEN ═══ */
 console.log('═══ LE RÉGLAGE MANUEL ET SA MESURE ═══');
 ok('la valeur déclarée par l\'appareil est lisible',
    await pg.evaluate(() => typeof barreHautMesuree() === "number"));
 ok('… et vaut 0 sur un écran sans encoche — ce qui est le cas ici',
    await pg.evaluate(() => barreHautMesuree() === 0));
 await pg.evaluate(() => { S.barreHaut = 32; appliquerBarreHaut(); });
 ok('une valeur fixe l\'emporte',
    await pg.evaluate(() => document.documentElement.style.getPropertyValue('--sbtop') === "32px"));
 const h2 = await hautBandeau();
 ok('… et le bandeau descend pour de bon', h2 - h0 === 32, h2 - h0);
 await pg.evaluate(() => { S.barreHaut = "auto"; appliquerBarreHaut(); });
 ok('« Automatique » rend la main au téléphone',
    await pg.evaluate(() => document.documentElement.style.getPropertyValue('--sbtop') === ""));
 ok('le réglage revient avec « Réinitialiser l\'affichage »',
    await pg.evaluate(() => REGLAGES_AFFICHAGE.includes("barreHaut")));

 /* L'écran de réglage existe et dit ce que le téléphone déclare. */
 await pg.evaluate(() => sheetPersoZone("texte"));
 await pg.waitForTimeout(400);
 const ecran = await pg.evaluate(() => ({
   chips: document.querySelectorAll('#sheet [data-sb]').length,
   dit: /ne déclare rien|déclare <b>|déclare /.test(document.querySelector('#sheet').innerHTML)
 }));
 ok('l\'écran « Texte et zoom » porte le réglage', ecran.chips === 6, ecran.chips);
 ok('… et affiche ce que l\'appareil déclare', ecran.dit === true);
 await pg.click('#sheet [data-sb="24"]'); await pg.waitForTimeout(400);
 ok('le choix est enregistré', await pg.evaluate(() => S.barreHaut === 24));
 await pg.evaluate(() => { S.barreHaut = "auto"; appliquerBarreHaut(); save(true); });

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
