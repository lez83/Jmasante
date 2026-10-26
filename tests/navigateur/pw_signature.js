/* ══════════════════════════════════════════════════════════════
   SIGNER UNE ORDONNANCE ENVOYÉE EN NUMÉRIQUE        (v1.33.0)
   ─────────────────────────────────────────────────────────────
   Le pavé de tracé existait (écran de relève), le cadre existait
   (bas de l'ordonnance) : ils ne se parlaient pas. Le cadre part
   vide et annonce « MANUSCRITE » — juste sur une feuille qu'on
   imprime, FAUX au-dessus d'un tracé apposé.

   ⚠️ CE QUE CETTE ÉPREUVE GARDE, C'EST QUE LE PAPIER NE MENTE PAS.
   Trois choses doivent basculer ENSEMBLE selon l'interrupteur : le
   mot « MANUSCRITE », la date (vide à remplir / remplie), et le mot
   « originale » au pied. Un seul des trois oublié et le document
   affirme quelque chose de faux.

   ⚠️ ELLE A DÉJÀ ATTRAPÉ TROIS CHOSES, dont deux dans la sonde :
   • un `const sa` déclaré APRÈS le bloc qui s'en sert — zone morte
     temporelle, ReferenceError garantie dès que l'on signe, et la
     compilation ne proteste pas ;
   • `fmtFR()` rendait « 25 oct. », sans année : lisible dans une
     liste, inacceptable sur un document médico-légal ;
   • l'espion posé sur `jsPDF.prototype` ne voyait RIEN — jsPDF
     recopie ses méthodes sur l'instance dans son constructeur, et
     douze contrôles tombaient sans qu'aucun défaut existe. On
     enveloppe donc le constructeur.

   ⚠️ ELLE MESURE AUSSI LE DÉMARRAGE À FROID. `sheetOrdonnance` lit
   `maSignatureSync()`, qui rend null tant que le coffre n'a pas
   répondu : sans la lecture lancée par init.js, l'interrupteur
   manque à celui qui ouvre une ordonnance en premier geste.

   ⚠️ LA SIGNATURE EST RANGÉE SOUS `doc_masignature` : chiffrée par
   le coffre comme tout `doc_*`, et ABSENTE des sauvegardes — sur un
   appareil neuf on la retrace, elle ne voyage pas.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(R,u); if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>srv.listen(8234,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
 pg.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text().slice(0,120)); });
 await pg.goto('http://localhost:8234/index.html'); await pg.waitForTimeout(2700);

 const r = await pg.evaluate(async()=>{
  const L=[]; const ok=(n,c,d)=>L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);
  /* ⚠️ ELLE DOIT TOMBER, PAS PLANTER. Lancée sur une version qui ignore
     la signature, elle levait « maSignatureSync is not defined » et
     mourait au premier contrôle : code 1, certes, mais aucune ligne pour
     dire ce qui manque. On nomme donc d'abord ce qu'on exige. */
  const requis = ['maSignatureLire','maSignatureEcrire','maSignaturePrete','maSignatureSync',
                  'ordonnancePdf','produireOrdonnance','sheetOrdonnance','sheetMoi','idbGet'];
  const manque = requis.filter(n => typeof window[n] !== 'function');
  ok('les fonctions de la signature existent', manque.length===0, 'manquent : '+manque.join(', '));
  if (manque.length) return {L};
  S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;
  // une vraie image PNG, pas une chaîne quelconque
  const cv=document.createElement('canvas'); cv.width=600; cv.height=150;
  const c2=cv.getContext('2d'); c2.strokeStyle='#17211E'; c2.lineWidth=5; c2.beginPath();
  c2.moveTo(20,120); c2.bezierCurveTo(140,10,200,140,300,60); c2.bezierCurveTo(420,0,500,130,580,40); c2.stroke();
  const PNG=cv.toDataURL('image/png');

  // ── 1. LE RANGEMENT
  ok('avant tout, rien en mémoire', maSignatureSync()===null, 'vaut '+typeof maSignatureSync());
  const e1=await maSignatureEcrire(PNG);
  ok('l’écriture rend vrai', e1===true, String(e1));
  ok('le tracé est relu en mémoire', maSignatureSync()===PNG);
  const brut=await idbGet('doc_masignature');
  ok('rangé sous doc_masignature', brut===PNG, 'lu: '+String(brut).slice(0,24));
  ok('la clé est chiffrée par le coffre', typeof _aChiffrer==='function' && _aChiffrer('doc_masignature')===true);

  // ── 2. ABSENTE DES SAUVEGARDES
  const cles = (typeof CLES_EXPORT!=='undefined') ? CLES_EXPORT : null;
  ok('pas de doc_ dans les clés exportées',
     cles===null || !JSON.stringify(cles).includes('masignature'), JSON.stringify(cles||'').slice(0,80));

  // ── 2 bis. L'ENTRÉE DANS MA FICHE — le seul endroit où l'on trace
  sheetMoi(); await new Promise(r=>setTimeout(r,160));
  const corps = () => document.getElementById('sheet').innerHTML;
  ok('Ma fiche annonce la signature enregistrée', /Ma signature[\s\S]{0,200}enregistrée/.test(corps()));
  ok('Ma fiche en montre l’aperçu', /<img src="data:image\/png[^"]*" alt="Ma signature/.test(corps()));
  ok('Ma fiche offre Refaire et Effacer',
     !!document.getElementById('mo-sig') && !!document.getElementById('mo-sigdel'));
  ok('Ma fiche prévient qu’elle ne part pas dans les sauvegardes',
     /ne part pas dans les sauvegardes/.test(corps()));

  // ── 3. L'ÉCRAN DE L'ORDONNANCE
  const pid=S.patients[0].id;
  sheetOrdonnance(pid); await new Promise(r=>setTimeout(r,160));
  const sw=document.getElementById('or-apposer');
  ok('l’interrupteur existe quand la signature est enregistrée', !!sw);
  ok('il est DÉCOCHÉ par défaut', !!sw && sw.checked===false, sw?String(sw.checked):'absent');
  ok('pas d’invitation à tracer puisqu’elle existe',
     !/trace d.abord ta signature/i.test(document.getElementById('sheet').innerHTML));

  // ── 4. LE PDF, DÉCOCHÉ PUIS COCHÉ
  /* jsPDF n'est plus chargé au lancement (1,35 Mo) : on l'appelle. */
  await libPdfMake();
  ok('jsPDF est bien chargé pour la mesure', !!(window.jspdf && window.jspdf.jsPDF));
  const vraiLivrer = window.pdfLivrer;
  const journal=[];
  window.pdfLivrer = async()=>{};
  /* ⚠️ PAS LE PROTOTYPE : jsPDF recopie ses méthodes sur l'instance dans
     son constructeur, et un prototype patché après coup ne voit RIEN —
     journal vide, douze contrôles tombés sans qu'aucun défaut existe.
     On enveloppe donc le constructeur. */
  const Orig = window.jspdf.jsPDF;
  window.jspdf = Object.assign({}, window.jspdf, { jsPDF: function(...a){
    const d = new Orig(...a);
    const t = d.text.bind(d), ai = d.addImage.bind(d);
    d.text = (...x) => { journal.push(['text', String(x[0])]); return t(...x); };
    d.addImage = (...x) => { journal.push(['image', String(x[0]).slice(0,20)+' len='+String(x[0]).length]); return ai(...x); };
    return d;
  }});

  const lire = async apposer => {
    journal.length=0;
    const d = {nom:'Jean-Marie Cavayé', titre:'Infirmier D.E.', cabinet:'Cab', adresse:'1 rue X',
      tel:'', mail:'', rpps:'10001234567', am:'', mention:'', patient:'Démo Patient',
      ne:'01/01/1950', nir:'', sexe:'F', lignes:14, apposer:apposer};
    await ordonnancePdf(d,'enregistrer');
    return journal.map(x=>x.join(' | ')).join('\n');
  };

  let decoche='(non lu)', coche='(non lu)';
  try { decoche = await lire(false); } catch(e){ decoche='ERREUR '+e; }
  try { coche   = await lire(true);  } catch(e){ coche='ERREUR '+e; }

  ok('décoché : le cadre dit MANUSCRITE', /DATE & SIGNATURE MANUSCRITE IDEL/.test(decoche));
  ok('décoché : la date reste vide', /text \| Date :$/m.test(decoche));
  ok('décoché : aucune image apposée', !/^image \|/m.test(decoche));
  ok('décoché : le pied dit « originale »', /Ordonnance originale/.test(decoche));
  ok('décoché : la note manuscrite demeure', /Apposer la signature imm/.test(decoche));

  ok('coché : MANUSCRITE tombe', !/MANUSCRITE/.test(coche) && /DATE & SIGNATURE IDEL/.test(coche));
  ok('coché : la date est remplie', /text \| Date : \d\d\/\d\d\/\d{4}/.test(coche));
  ok('coché : le tracé est apposé', /^image \| data:image\/png/m.test(coche));
  ok('coché : le nom lisible est sous le tracé', /Cavaye · Infirmier D\.E\. · RPPS 10001234567/.test(coche));
  /* ⚠️ SUR LA LIGNE DU TRACÉ, PAS DANS TOUT LE DOCUMENT : l'en-tête
     porte le nom accentué de longue date, et le contrôle tombait sur
     lui — ma sonde avait tort, pas le code. */
  const ligneQui = (coche.match(/^text \| [^|\n]*RPPS 10001234567.*$/m)||[''])[0];
  ok('coché : les accents sont ôtés sur la ligne du tracé',
     /Cavaye/.test(ligneQui) && !/Cavay\u00e9/.test(ligneQui), ligneQui.slice(0,70));
  ok('coché : « originale » est retiré du pied', !/Ordonnance originale/.test(coche) && /secret professionnel/.test(coche));
  ok('coché : la note manuscrite disparaît', !/Apposer la signature imm/.test(coche));

  window.jspdf = Object.assign({}, window.jspdf, { jsPDF: Orig }); window.pdfLivrer=vraiLivrer;

  // ── 5. L'APERÇU HTML (le recours quand jsPDF manque)
  const vraiJs = window.jspdf; window.jspdf = undefined;
  const vraiImp = window.imprimerDocument; let htm='';
  window.imprimerDocument = async(html)=>{ htm=html; };
  const faire = apposer => { const d={nom:'Jean-Marie Cavayé', titre:'Infirmier D.E.', cabinet:'Cab',
    adresse:'1 rue X', tel:'', mail:'', rpps:'10001234567', am:'', mention:'', patient:'Démo',
    ne:'01/01/1950', nir:'', sexe:'F', lignes:14, apposer:apposer};
    htm=''; produireOrdonnance(d,'enregistrer'); return htm; };
  let hNon='(rien)', hOui='(rien)';
  try { hNon=faire(false); } catch(e){ hNon='ERREUR '+e; }
  try { hOui=faire(true);  } catch(e){ hOui='ERREUR '+e; }
  window.jspdf=vraiJs; window.imprimerDocument=vraiImp;

  ok('aperçu décoché : MANUSCRITE et cadre vierge',
     /SIGNATURE MANUSCRITE IDEL/.test(hNon) && /class="sp"/.test(hNon) && !/class="sg"/.test(hNon));
  ok('aperçu décoché : « originale » au pied', /Ordonnance originale/.test(hNon));
  ok('aperçu coché : le tracé remplace l’espace',
     /class="sg" src="data:image\/png/.test(hOui) && !/class="sp"/.test(hOui));
  ok('aperçu coché : MANUSCRITE tombe', !/MANUSCRITE/.test(hOui));
  ok('aperçu coché : la date est remplie', /Date :\s*<b>\d\d\/\d\d\/\d{4}<\/b>/.test(hOui));
  ok('aperçu coché : le nom lisible', /RPPS 10001234567/.test(hOui));
  ok('aperçu coché : « originale » retiré', !/Ordonnance originale/.test(hOui) && /secret professionnel/.test(hOui));

  // ── 6. L'EFFACEMENT
  const e2 = await maSignatureEcrire(null);
  ok('l’effacement rend vrai', e2===true);
  ok('plus rien en mémoire', maSignatureSync()===null);
  ok('plus rien dans le coffre', !(await idbGet('doc_masignature')));
  sheetMoi(); await new Promise(r=>setTimeout(r,160));
  ok('Ma fiche repasse à « aucune »', /Ma signature[\s\S]{0,200}aucune/.test(corps()));
  ok('Ma fiche repropose de tracer',
     !!document.getElementById('mo-sig') && !document.getElementById('mo-sigdel'));
  sheetOrdonnance(pid); await new Promise(r=>setTimeout(r,160));
  ok('l’interrupteur disparaît', !document.getElementById('or-apposer'));
  ok('l’invitation à tracer apparaît',
     /trace d.abord ta signature/i.test(document.getElementById('sheet').innerHTML));

  // ── 7. ON LA REMET POUR MESURER LE REDÉMARRAGE
  await maSignatureEcrire(PNG);
  return {L};
 });

 /* ⚠️ LE SEUL CONTRÔLE QUI MESURE init.js : `sheetOrdonnance` lit
    `maSignatureSync()`, qui rend null tant que la lecture du coffre
    n'a pas abouti. Si personne ne la lance au lancement, l'interrupteur
    manque à celui qui ouvre une ordonnance en premier geste. */
 await pg.reload(); await pg.waitForTimeout(2700);
 const froid = await pg.evaluate(async()=>{
   const L=[]; const ok=(n,c,d)=>L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);
   if (typeof maSignatureSync !== 'function'){
     ok('à froid, la signature est relue au lancement', false, 'maSignatureSync absente');
     return L;
   }
   S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;
   ok('à froid, la signature est déjà relue', typeof maSignaturePrete==='function' && maSignaturePrete()===true);
   ok('à froid, le tracé est en mémoire', !!maSignatureSync() && String(maSignatureSync()).startsWith('data:image/png'));
   sheetOrdonnance(S.patients[0].id); await new Promise(r=>setTimeout(r,160));
   const sw=document.getElementById('or-apposer');
   ok('à froid, l\u2019interrupteur est là', !!sw);
   ok('à froid, il est décoché', !!sw && sw.checked===false);
   await maSignatureEcrire(null);
   return L;
 });
 froid.forEach(x=>r.L.push(x));
 let ko=0; for(const [v,n,d] of r.L){ if(v!=='OK')ko++; console.log(`${v==='OK'?'  ✓':'  ✗'} ${n}${d?'   ['+d+']':''}`); }
 if(errs.length) console.log('── incidents ──\n'+errs.slice(0,8).join('\n'));
 console.log(`\n${r.L.length-ko}/${r.L.length} contrôles`);
 await nav.close(); srv.close(); process.exit(ko?1:0);
})();
