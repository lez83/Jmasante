// UN BOUTON DANS UN BOUTON CASSAIT LA CARTE PATIENT (v1.28.1)
//
// ⚠️ CONSTATÉ AU CHEVET : « parfois sur une carte patient avec une
//    pastille incomplète, si je clique sur la carte l'affichage bug ».
//    Ce n'était pas la pastille : c'était la SAISIE GARDÉE.
//
// ⚠️ MESURÉ, carte ouverte, même patient, à la seule différence d'un
//    brouillon en attente :
//
//      sans brouillon │ 3 enfants (pastille · bouton · formulaire) │ 1 779 px
//      avec brouillon │ 6 enfants, formulaire HORS de la carte     │   189 px
//
// ⚠️ LA CAUSE : l'étiquette « 💾 saisie gardée » était un `<button>`
//    posé À L'INTÉRIEUR du `<button data-toggle>` de la carte. Ce n'est
//    pas du HTML valide, et l'analyseur ne pardonne pas — il REFERME le
//    bouton extérieur, et tout ce qui suit change de parent : le reste
//    des badges, la dernière ligne, et le formulaire lui-même.
//
// ⚠️ ET LA LEÇON ÉTAIT DÉJÀ ÉCRITE DANS `ui.js`, vingt lignes plus bas,
//    pour le 📞 et le 📍 : « un bouton dans un bouton n'est pas du HTML
//    valide, et sur Android le toucher partait au mauvais des deux ».
// ⚠️ ET ON NE CHERCHE PAS L'IMBRICATION DANS LE DOM : elle n'y est
//    JAMAIS. L'analyseur a déjà refermé le bouton extérieur, donc
//    `querySelectorAll('button')` dans le bouton de la carte ne rend rien
//    — sur le code cassé comme sur le code sain. Écrit ainsi d'abord, le
//    contrôle passait sur les DEUX versions : il n'aurait rien gardé.
//    Ce qui se voit, c'est le dégât. On compare donc la FORME de la carte
//    à celle de la carte la plus nue, dans onze états.
//
// ⚠️ ON COMPARE DES ÉTATS, PAS DES VALEURS ABSOLUES. Une hauteur de carte
//    dépend du thème, du zoom et des réglages d'affichage. Ce qui est
//    gardé, c'est que la carte avec brouillon ressemble à la carte sans
//    brouillon — c'est l'écart qui désigne le défaut.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
const J = v => JSON.stringify(v);

(async()=>{
 await new Promise(r=>srv.listen(8230,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8230/index.html'); await pg.waitForTimeout(2700);
 const pid = await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false;
   openId=null; render(); return S.patients[0].id; });

 /* Pose un état, ouvre la carte, et rend sa forme. */
 const etat = (prep) => pg.evaluate(async ([i, p])=>{
   const q=getP(i);
   q.visits=[]; S.noVisit={}; S.drafts={};
   S.rappels=(S.rappels||[]).filter(r=>r.pid!==i);
   eval(p);
   openId=i; render(); await new Promise(r=>setTimeout(r,420));
   const c=document.querySelector('.pcard.open');
   if (!c) return { ouverte:false };
   const tg=c.querySelector('[data-toggle]');
   const b=c.querySelector('.toolrow .tool');
   return { ouverte:true,
     statut:statusOf(q,null,1),
     enfants:[...c.children].map(e=>e.tagName.toLowerCase()+'.'+String(e.className).split(' ')[0]),
     formulaire:!!c.querySelector('[data-form]'),
     hauteur:Math.round(c.getBoundingClientRect().height),
     premierOutil:b?Math.round(b.getBoundingClientRect().left):null,
     /* ⚠️ NE PAS CHERCHER L'IMBRICATION DANS LE DOM : elle n'y est
        JAMAIS. L'analyseur a déjà refermé le bouton extérieur, donc
        `tg.querySelectorAll('button')` ne rend rien — sur le code cassé
        comme sur le code sain. Un tel contrôle serait resté vert pendant
        toute la durée du défaut. Ce qui se voit, c'est le DÉGÂT : le
        bouton perd ses derniers enfants et le formulaire sort de la
        carte. C'est donc la FORME de la carte qu'on compare. */
     derniereLigne:!!(tg && tg.querySelector('.lastseen')),
     enfantsDuBouton:tg ? [...tg.children].map(e=>String(e.className).split(' ')[0]) : [] };
 }, [pid, prep]);

 const BROUILLON = `S.drafts[i]={pid:i,at:Date.parse("2026-10-18T09:00:00"),soins:["Toilette"],consts:{ta:"13/7"},note:"brouillon"};`;

 /* ═══ ① LE DÉFAUT EXACT ═══ */
 console.log('═══ LA CARTE AVEC ET SANS SAISIE GARDÉE ═══');
 const sans = await etat(`;`);
 const avec = await etat(BROUILLON);
 console.log('     sans : ' + J({enfants:sans.enfants, form:sans.formulaire, h:sans.hauteur}));
 console.log('     avec : ' + J({enfants:avec.enfants, form:avec.formulaire, h:avec.hauteur}));
 ok('① la carte sans brouillon a bien son formulaire', sans.formulaire === true, J(sans));
 /* ⚠️ LE CONTRÔLE QUI PORTE LA PLAINTE. */
 ok('① la carte AVEC brouillon aussi', avec.formulaire === true, J(avec));
 ok('① et elle a la même forme que l\'autre',
    J(avec.enfants) === J(sans.enfants), J(avec.enfants) + ' ≠ ' + J(sans.enfants));
 ok('① le bouton garde sa dernière ligne',
    avec.derniereLigne === true && sans.derniereLigne === true,
    'sans=' + sans.derniereLigne + ' avec=' + avec.derniereLigne);
 /* ⚠️ COMPARÉE, PAS ABSOLUE : la hauteur dépend du thème et du zoom. */
 ok('① et une hauteur du même ordre',
    avec.hauteur > sans.hauteur * 0.9,
    sans.hauteur + ' px → ' + avec.hauteur + ' px');
 ok('① les outils restent à gauche',
    avec.premierOutil !== null && avec.premierOutil < 60, avec.premierOutil + ' px');

 /* ═══ ② L'INVARIANT, DANS TOUS LES ÉTATS ═══ */
 console.log('═══ LA MÊME FORME DANS TOUS LES ÉTATS ═══');
 /* ⚠️ LA RÉFÉRENCE EST LA CARTE LA PLUS NUE : si un état la fait
    diverger, c'est qu'un élément de cet état a cassé l'arbre. Peu
    importe lequel, et peu importe comment — c'est l'écart qui compte. */
 const REF = { enfants:J(sans.enfants), bouton:J(sans.enfantsDuBouton) };
 console.log('     référence (carte nue) : ' + REF.enfants + ' · bouton ' + REF.bouton);
 const CAS = [
   ["à voir",                      `;`],
   ["vu",                          `q.visits=[{uid:"a",date:workDate(),at:"08:00",soins:["Toilette"],consts:{},note:"ok"}];`],
   ["vigilance",                   `q.visits=[{uid:"a",date:workDate(),at:"08:00",soins:[],consts:{ta:"19/11"},note:""}];`],
   ["sans passage",                `S.noVisit[i]=workDate();`],
   ["absent",                      `S.rappels=(S.rappels||[]).concat([{id:"r1",pid:i,type:"absence",due:workDate(),txt:"h",done:false}]);`],
   ["brouillon",                   BROUILLON],
   ["brouillon + vigilance",       BROUILLON + `q.visits=[{uid:"a",date:workDate(),at:"08:00",soins:[],consts:{ta:"19/11"},note:""}];`],
   ["brouillon + sans passage",    BROUILLON + `S.noVisit[i]=workDate();`],
   ["brouillon + absent",          BROUILLON + `S.rappels=(S.rappels||[]).concat([{id:"r1",pid:i,type:"absence",due:workDate(),txt:"h",done:false}]);`],
   ["avec pièces et rappels",      BROUILLON + `q.docs=[{id:"d1",name:"ordo.pdf",mime:"application/pdf",date:workDate()}]; S.rappels=(S.rappels||[]).concat([{id:"r2",pid:i,type:"autre",due:workDate(),txt:"à faire",done:false}]);`],
   ["avec étiquettes",             BROUILLON + `q.tags=["prioritaire"];`]
 ];
 let pires = 0;
 for (const [lbl, prep] of CAS){
   const r = await etat(prep);
   const propre = r.ouverte && r.formulaire === true
     && J(r.enfants) === REF.enfants && J(r.enfantsDuBouton) === REF.bouton
     && r.derniereLigne === true;
   if (!propre) pires++;
   ok('② ' + lbl + ' : la carte garde sa forme et son formulaire', propre,
      r.ouverte ? ('carte ' + J(r.enfants) + ' · bouton ' + J(r.enfantsDuBouton)
                   + ' · form ' + r.formulaire) : 'carte absente');
 }
 console.log('     ' + CAS.length + ' états contrôlés, ' + pires + ' en défaut');

 /* ═══ ③ L'ÉTIQUETTE GARDE SON GESTE ═══ */
 console.log('═══ L\'ÉTIQUETTE « SAISIE GARDÉE » RÉPOND TOUJOURS ═══');
 await etat(BROUILLON);
 const avantClic = await pg.evaluate(()=>({ ouvert:openId,
   feuille:!!document.querySelector('#veil.on') }));
 const badge = await pg.evaluate(()=>!!document.querySelector('.pcard.open [data-draft]'));
 ok('③ l\'étiquette est bien là', badge === true);
 if (badge){
   await pg.click('.pcard.open [data-draft]'); await pg.waitForTimeout(600);
   const apres = await pg.evaluate(()=>({ ouvert:openId,
     feuille:!!document.querySelector('#veil.on'),
     contenu:(document.querySelector('#sheet')||{}).textContent||"" }));
   ok('③ elle ouvre le détail du brouillon',
      apres.feuille === true && /gardée|brouillon|saisie/i.test(apres.contenu),
      J({feuille:apres.feuille, debut:apres.contenu.slice(0,60)}));
   /* ⚠️ `stopPropagation` : sans lui, le clic traverserait jusqu'au
      bouton de la carte et la replierait sous la feuille qui s'ouvre. */
   ok('③ et ne replie pas la carte au passage',
      apres.ouvert === avantClic.ouvert, J({avant:avantClic.ouvert, apres:apres.ouvert}));
   await pg.evaluate(()=>{ if (typeof closeSheet==="function") closeSheet(true); });
   await pg.waitForTimeout(300);
 } else {
   ok('③ elle ouvre le détail du brouillon', false, 'étiquette absente');
   ok('③ et ne replie pas la carte au passage', false, 'étiquette absente');
 }

 /* ═══ ④ ET LE BOUTON DE LA CARTE RÉPOND TOUJOURS ═══ */
 console.log('═══ LA CARTE SE REPLIE TOUJOURS ═══');
 await etat(BROUILLON);
 await pg.click('.pcard.open [data-toggle]'); await pg.waitForTimeout(500);
 const replie = await pg.evaluate(()=>({ ouvert:openId,
   carteOuverte:!!document.querySelector('.pcard.open') }));
 ok('④ toucher la carte la replie', replie.ouvert === null && replie.carteOuverte === false, J(replie));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
