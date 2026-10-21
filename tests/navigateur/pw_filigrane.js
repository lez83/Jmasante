// LE FILIGRANE : LA CIGALE EN FOND DE PAGE.
//
// ⚠️ ÉCRITE AVANT LA CORRECTION, et vérifiée en rouge. Trois contrôles
//    tombent sur le code d'avant : il n'y a pas de couche dans la feuille,
//    pas de signature dans le pied, et l'interrupteur n'existe pas.
//
// ⚠️ CE QU'ELLE GARDE SURTOUT, C'EST CE QUI NE SE VOIT PAS À L'ÉCRAN :
//    1. un fond CSS ne sort PAS de l'imprimante — l'option « imprimer les
//       arrière-plans » est décochée par défaut. Le contrôle produit un
//       vrai PDF sans cette option et compare la page avec et sans la
//       couche : si la marque repasse en `background-image`, l'écart
//       retombe à zéro et le contrôle tombe.
//    2. le zébrage du tableau DÉCOUPAIT la cigale en bandes : Chromium
//       repeint ces cellules en blanc opaque quand les arrière-plans sont
//       décochés, et l'alpha d'un rgba n'y change rien. Le contrôle compte
//       les lignes sans marque dans la bande centrale.
//    3. la couche est en `position:fixed` : elle doit se répéter sur
//       CHAQUE page, recto et verso.
//
// ⚠️ LA MESURE SE FAIT PAR DIFFÉRENCE DE PIXELS, pas en comptant les
//    pixels « verts » : à 22 % d'opacité, les traits antialiasés tombent
//    sous n'importe quel seuil de teinte, et un premier jet de cette
//    épreuve a conclu « 90 pixels de filigrane » sur une page qui en
//    portait 23 000. Une mesure qui ne voit pas ce qu'elle mesure ne dit
//    rien.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os');
const { execFileSync } = require('child_process');
const ROOT=path.join(__dirname,'..','..','www');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'pwfili-'));
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x!==undefined&&!c?'  → '+x:''}`); if(!c)ko.push(l);};

/* Une page de PDF, rendue en PNG, lue comme un tableau de pixels. */
function pages(pdf, pfx){
  try { execFileSync('pdftoppm', ['-r','150','-png', pdf, path.join(TMP,pfx)]); }
  catch(e){ return null; }                       // pdftoppm absent : on saute
  return fs.readdirSync(TMP).filter(f=>f.startsWith(pfx)&&f.endsWith('.png')).sort()
           .map(f=>path.join(TMP,f));
}
function lirePng(f){
  const { PNG } = (()=>{ try { return require('pngjs'); } catch(e){ return {}; } })();
  if (!PNG) return null;
  return PNG.sync.read(fs.readFileSync(f));
}

(async()=>{
 await new Promise(r=>srv.listen(8221,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8221/index.html'); await pg.waitForTimeout(2700);
 const pid=await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false;
   S.feuilleMention="Cabinet des Oliviers — 06 00 00 00 00"; delete S.filigraneDocs;
   openId=null; render(); return S.patients[0].id; });

 /* ═══ ① LA MARQUE EST DANS LA PAGE, PAS DANS UN FOND CSS ═══ */
 console.log('═══ LA MARQUE EST UN ÉLÉMENT, PAS UN FOND ═══');
 const src = await pg.evaluate(id => ({
   c: feuilleHtml(getP(id),"constantes","serre",null),
   p: feuilleHtml(getP(id),"poids","serre",null),
   g: feuilleHtml(getP(id),"glycemies","serre",null),
   doc: filigraner('<!DOCTYPE html><html><head><style>@page{size:A4;margin:12mm}</style></head><body><h1>Courrier</h1>'+'<p>Ligne.</p>'.repeat(80)+'</body></html>')
 }), pid);
 ["c","p","g"].forEach((k,i) => {
   const h = src[k], nom = ["constantes","poids","glycémies"][i];
   ok(`${nom} : la couche est présente`, /class="jmf"/.test(h));
   ok(`${nom} : c'est un <svg>, pas une image de fond`,
      /class="jmf"[\s\S]{0,400}<svg/.test(h) && !/\.jmf\{[^}]*background-image/.test(h));
   ok(`${nom} : la signature est dans la ligne du pied`,
      /class="pd"[\s\S]{0,400}jmf-sig/.test(h));
 });
 ok('le document quelconque reçoit la couche', /class="jmf"/.test(src.doc));
 ok('… et le marqueur anti-double-pose',
    /data-fili=/.test(src.doc) && /data-fili="1"/.test(src.c));
 ok('un document déjà filigrané n\'en reçoit pas un second',
    await pg.evaluate(h => (filigraner(h).match(/class="jmf"/g)||[]).length === 1, src.c));
 ok('du texte simple n\'est pas touché',
    await pg.evaluate(() => filigraner("Bonjour") === "Bonjour"));

 /* ═══ ② L'INTERRUPTEUR DES AUTRES DOCUMENTS ═══ */
 console.log('═══ L\'INTERRUPTEUR ═══');
 ok('par défaut, les autres documents le portent',
    await pg.evaluate(() => filigraneDocsActif() === true));
 const eteint = await pg.evaluate(h => { S.filigraneDocs = false;
   const r = /class="jmf"/.test(filigraner(h)); S.filigraneDocs = true; return r; },
   '<!DOCTYPE html><html><head></head><body>x</body></html>');
 ok('éteint, un document quelconque n\'a plus de marque', eteint === false);
 ok('… mais les feuilles de domicile la gardent — elle y est permanente',
    await pg.evaluate(id => { S.filigraneDocs = false;
      const r = /class="jmf"/.test(feuilleHtml(getP(id),"constantes","serre",null));
      S.filigraneDocs = true; return r; }, pid) === true);
 await pg.evaluate(() => { sheetDocsVierges(); });
 await pg.waitForTimeout(350);
 ok('l\'écran des documents vierges porte l\'interrupteur',
    await pg.evaluate(() => document.querySelectorAll('#sheet [data-fdoc]').length === 2));
 ok('… et il dit que ce n\'est pas une marque de sécurité',
    await pg.evaluate(() => /pas une marque de sécurité/i.test(document.querySelector('#sheet').textContent)));
 await pg.click('#sheet [data-fdoc="0"]'); await pg.waitForTimeout(300);
 ok('le choix est enregistré', await pg.evaluate(() => S.filigraneDocs === false));
 await pg.click('#sheet [data-fdoc="1"]'); await pg.waitForTimeout(300);
 ok('… et réversible', await pg.evaluate(() => S.filigraneDocs === true));

 /* ═══ ③ CE QUI SORT DE L'IMPRIMANTE ═══ */
 console.log('═══ CE QUI SORT DE L\'IMPRIMANTE (PDF sans les arrière-plans) ═══');
 const pg2 = await (await nav.newContext()).newPage();
 await pg2.emulateMedia({ media:'print' });
 const pdf = async (html, nom) => {
   await pg2.setContent(html, { waitUntil:'load' });
   const f = path.join(TMP, nom + '.pdf');
   await pg2.pdf({ path:f, printBackground:false, preferCSSPageSize:true });
   return f;
 };
 const sansCouche = h => h.replace(/<div class="jmf">[\s\S]*?<\/div><\/div>/, "");
 const f1 = await pdf(src.c, "av"), f0 = await pdf(sansCouche(src.c), "sa");
 const P1 = pages(f1, "av"), P0 = pages(f0, "sa");
 const png = P1 && lirePng(P1[0]);
 if (!P1 || !png){
   console.log('  — pdftoppm ou pngjs absent : les contrôles d\'impression sont sautés');
 } else {
   const a = lirePng(P1[0]), b = lirePng(P0[0]);
   let diff = 0;
   for (let i = 0; i < a.data.length; i += 4)
     if (Math.abs(a.data[i]-b.data[i]) > 2 || Math.abs(a.data[i+1]-b.data[i+1]) > 2) diff++;
   console.log(`     feuille serrée : ${diff} pixels de différence avec la même page sans couche`);
   /* ⚠️ LE CONTRÔLE QUI TOMBE SI LA MARQUE REDEVIENT UN FOND CSS. */
   ok('la marque est bien imprimée sans l\'option « arrière-plans »', diff > 8000, diff);

   /* Le filigrane n'est pas découpé en bandes par le tableau. */
   const w = a.width, h = a.height, px = (x,y) => a.data[(y*w+x)*4];
   const x0 = Math.floor(w*.33), x1 = Math.floor(w*.63);
   const y0 = Math.floor(h*.37), y1 = Math.floor(h*.60);
   let sansMarque = 0, lignes = 0;
   for (let y = y0; y < y1; y++){
     lignes++;
     let n = 0;
     for (let x = x0; x < x1; x++){
       const i = (y*w+x)*4;
       if (a.data[i] < 212 && a.data[i+1] > a.data[i]+8) n++;
     }
     if (n === 0) sansMarque++;
   }
   console.log(`     bande centrale : ${sansMarque} lignes sans marque sur ${lignes}`);
   /* Code d'avant (zébrage opaque) : 256/404. Corrigé : 130/404 — et ces
      130-là sont le vide entre les ailes, pas des bandes. */
   ok('la cigale n\'est pas découpée en bandes par le tableau',
      sansMarque < lignes * 0.45, sansMarque + "/" + lignes);

   /* Recto ET verso en densité confortable. */
   const conf = await pg.evaluate(id => feuilleHtml(getP(id),"constantes","confort",null), pid);
   const fc = await pdf(conf, "cf"), fcs = await pdf(sansCouche(conf), "cs");
   const Pc = pages(fc, "cf"), Pcs = pages(fcs, "cs");
   const parPage = Pc.map((f,i) => {
     if (!Pcs[i]) return 0;
     const A = lirePng(f), B = lirePng(Pcs[i]);
     if (A.width !== B.width || A.height !== B.height) return 0;
     let d = 0;
     for (let i2 = 0; i2 < A.data.length; i2 += 4)
       if (Math.abs(A.data[i2]-B.data[i2]) > 2 || Math.abs(A.data[i2+1]-B.data[i2+1]) > 2) d++;
     return d;
   });
   console.log(`     densité confortable : ${parPage.map((n,i)=>`page ${i+1} → ${n}`).join(' · ')}`);
   ok('la marque se répète sur chaque page (recto et verso)',
      parPage.length >= 2 && parPage.every(n => n > 8000), parPage.join("/"));
 }

 /* ═══ ④ LA MARQUE NE CHANGE PAS LA PAGINATION ═══ */
 const nbp = async html => {
   await pg2.setContent(html, { waitUntil:'load' });
   const buf = await pg2.pdf({ printBackground:false, preferCSSPageSize:true });
   return (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)||[]).length;
 };
 const pA = await nbp(src.c), pB = await nbp(sansCouche(src.c));
 ok('la feuille serrée tient toujours sur une page', pA === 1 && pB === 1, pA + "/" + pB);
 ok('… et le tableau garde ses 31 jours',
    (src.c.match(/<tr[ >]/g)||[]).length >= 32, (src.c.match(/<tr[ >]/g)||[]).length);
 ok('le filet des cinq jours est posé par la ligne, pas par sa position',
    /class="g5"/.test(src.c) && /class="g5"/.test(src.g),
    "constantes " + /class="g5"/.test(src.c) + " · glycémies " + /class="g5"/.test(src.g));

 console.log('\n' + (errs.length ? '⚠ erreurs JS : ' + errs.join(' | ') : '✓ aucune erreur JS'));
 if (errs.length) ko.push("erreurs JS");
 console.log(ko.length ? `\n⚠ ${ko.length} contrôle(s) en échec :\n  - ` + ko.join('\n  - ')
                       : '\n✓ tout passe');
 try { fs.rmSync(TMP, { recursive:true, force:true }); } catch(e){}
 await nav.close(); srv.close(); process.exit(ko.length ? 1 : 0);
})();
