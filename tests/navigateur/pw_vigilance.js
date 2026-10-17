// LES SEUILS DU PATIENT, ET LA VIGILANCE MISE EN SOURDINE.
//
// ⚠️ ÉCRITE AVANT LA CORRECTION, et vérifiée en rouge : une patiente dont le
//    seuil de tension est relevé à 18 ne produit plus d'alerte au calcul,
//    mais sa carte restait au statut « alert ». `statusOf` appelait
//    `alertes(v.consts)` SANS passer `p.thresholds`, alors que l'affichage
//    de la valeur, lui, les passait. Régler le seuil d'un patient enlevait
//    le rouge sur le chiffre et laissait la carte rouge.
//
// ⚠️ CE QUE LA SOURDINE NE DOIT PAS FAIRE : effacer la valeur. Elle reste
//    enregistrée et affichée — « le soignant est capable d'interpréter sa
//    valeur, c'est son travail ». La sourdine éteint le signal, pas la
//    donnée.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..','..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

(async()=>{
 await new Promise(r=>srv.listen(8214,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8214/index.html'); await pg.waitForTimeout(2700);

 const prep = () => pg.evaluate(() => {
   S.confidentialityAck=true; S.firstRun=false;
   const t=(S.tours&&S.tours[0])||"A"; S.curTour=t;
   const p=S.patients[0]; if(!(p.tours||[]).includes(t)) p.tours=[t];
   S.slotsTours={}; delete p.thresholds;
   /* 17/9 : au-dessus du seuil par défaut (16), donc en alerte. */
   p.visits=[{uid:"v1",date:workDate(),at:"08:10",soins:[],consts:{ta:"17/9",puls:"74"},note:""}];
   openId=null; render();
   return p.id;
 });
 const pid = await prep();
 const etat = () => pg.evaluate(id => {
   const p=getP(id); openId=null; render();
   const c=document.querySelector('.pcard');
   return { statut:statusOf(p), classes:c?c.className:"",
            valeurVisible: /17\/9/.test(document.body.textContent) };
 }, pid);

 console.log('═══ LES SEUILS DU PATIENT COMPTENT PARTOUT ═══');
 const a = await etat();
 ok('sans seuil réglé, la carte est en alerte', a.statut === "alert", a.statut);
 ok('la valeur est affichée', a.valeurVisible === true);

 await pg.evaluate(id => { getP(id).thresholds = { ta_h: 18 }; }, pid);
 const b = await etat();
 ok('seuil relevé à 18 → la carte n\'est plus en alerte', b.statut !== "alert", b.statut);
 ok('… et elle ne porte plus la classe d\'alerte',
    !/st-alert|\bwarn\b/.test(b.classes), b.classes);
 ok('la valeur reste affichée', b.valeurVisible === true);

 /* Le dernier passage connu, hors tournée du jour, suit la même règle. */
 const c = await pg.evaluate(id => {
   const p=getP(id); const t=workDate();
   p.visits=[{uid:"v0",date:"2026-01-05",at:"08:00",soins:[],consts:{ta:"17/9"},note:""}];
   p.thresholds={ ta_h:18 };
   const s1=statusOf(p);
   delete p.thresholds;
   const s2=statusOf(p);
   return { avecSeuil:s1, sansSeuil:s2 };
 }, pid);
 ok('le passage d\'avant la tournée respecte aussi le seuil',
    c.avecSeuil !== "alert" && c.sansSeuil === "alert",
    `avec ${c.avecSeuil} · sans ${c.sansSeuil}`);

 console.log('\n═══ LA SOURDINE ═══');
 const s = await pg.evaluate(id => {
   const p=getP(id); delete p.thresholds;
   const v={uid:"v2",date:workDate(),at:"08:10",soins:[],consts:{ta:"17/9",glyc:"2.80"},note:""};
   p.visits=[v];
   const sans = alertes(v.consts, p.thresholds).length;
   /* On met en sourdine la seule tension : la glycémie doit rester. */
   v.sourdine = { ta:"" };
   const avec = alertes(v.consts, p.thresholds, v.sourdine);
   openId=null; render();
   const c=document.querySelector('.pcard');
   return { sans, avec, nb:avec.length, statut:statusOf(p),
            classes:c?c.className:"",
            valeurGardee: (p.visits[0].consts||{}).ta,
            affichee: /17\/9/.test(document.body.textContent) };
 }, pid);
 ok('sans sourdine : deux alertes', s.sans === 2, String(s.sans));
 ok('la tension en sourdine disparaît des alertes',
    !s.avec.some(x=>/TA/i.test(x)), JSON.stringify(s.avec));
 ok('… mais la glycémie reste signalée',
    s.avec.some(x=>/glyc/i.test(x)), JSON.stringify(s.avec));
 ok('la carte reste en alerte tant qu\'il reste une vigilance',
    s.statut === "alert", s.statut);
 ok('⚠️ LA VALEUR N\'EST PAS EFFACÉE', s.valeurGardee === "17/9", String(s.valeurGardee));
 ok('… et elle reste affichée sur la carte', s.affichee === true);

 /* Tout mettre en sourdine : la carte se calme, la valeur demeure. */
 const t2 = await pg.evaluate(id => {
   const p=getP(id); const v=p.visits[0];
   v.sourdine = { ta:"", glyc:"fin de cure" };
   openId=null; render();
   const c=document.querySelector('.pcard');
   return { nb: alertes(v.consts, p.thresholds, v.sourdine).length,
            statut: statusOf(p), classes:c?c.className:"",
            affichee: /17\/9/.test(document.body.textContent) };
 }, pid);
 ok('tout en sourdine → plus d\'alerte', t2.nb === 0, String(t2.nb));
 ok('… la carte se calme', t2.statut !== "alert", t2.statut);
 ok('… la valeur reste affichée', t2.affichee === true);

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length === 0, errs[0]);
 console.log(ko.length ? `\n⚠ ${ko.length} point(s)` : '\n✓ tout tourne');
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})();
