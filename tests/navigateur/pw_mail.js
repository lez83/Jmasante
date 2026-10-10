// ① Le mail cliquable : fiche patient + annuaire praticiens/partenaires.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8123,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:412,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8123/index.html'); await pg.waitForTimeout(2600);
 await pg.evaluate(()=>{ S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t;
   S.patients.forEach(p=>{ if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t); });
   save(); render(); });
 await pg.waitForTimeout(500);

 console.log('═══ ① LE MAIL DU PATIENT ═══');
 const pid=await pg.evaluate(()=>{ const p=S.patients[0]; delete p.mail; p.tel={mobile:'0600000000'}; save(); return p.id; });

 // ⚠️ Sans mail : le bouton ne doit pas exister du tout.
 await pg.evaluate(id=>sheetAnnuaire(getP(id)), pid); await pg.waitForTimeout(600);
 ok('sans mail, AUCUN bouton ✉️ dans l annuaire du dossier',
    await pg.evaluate(()=>!document.querySelector('#sheet a[href^="mailto:"]')));
 ok('mais le 📞 du mobile est bien là',
    await pg.evaluate(()=>!!document.querySelector('#sheet a[href^="tel:"]')));

 // Le champ existe dans la fiche de renseignements et s'enregistre
 await pg.evaluate(()=>closeSheet()); await pg.waitForTimeout(400);
 await pg.evaluate(id=>sheetPatient(getP(id)), pid); await pg.waitForTimeout(900);
 const champ=await pg.isVisible('#f-mail');
 ok('un champ ✉️ E-mail dans la fiche de renseignements', champ);
 if (champ){
   ok('clavier e-mail demandé (type ET inputmode)',
      await pg.evaluate(()=>{const e=document.querySelector('#f-mail');
        return e.type==='email'&&e.inputMode==='email'&&e.getAttribute('autocapitalize')==='none';}));
   await pg.fill('#f-mail','yvonne.martin@exemple.fr');
   const b=await pg.$('#sheet .btn-primary'); if (b) await b.click();
   await pg.waitForTimeout(900);
   ok('le mail est enregistré au dossier',
      await pg.evaluate(id=>getP(id).mail==='yvonne.martin@exemple.fr', pid),
      await pg.evaluate(id=>JSON.stringify(getP(id).mail), pid));
 }

 await pg.evaluate(id=>sheetAnnuaire(getP(id)), pid); await pg.waitForTimeout(700);
 const lien=await pg.evaluate(()=>{const a=document.querySelector('#sheet a[href^="mailto:"]');
   return a?{href:a.getAttribute('href'),txt:a.textContent.trim()}:null;});
 ok('renseigné, le bouton ✉️ apparaît', !!lien, JSON.stringify(lien));
 ok('et il pointe sur la bonne adresse',
    lien && decodeURIComponent(lien.href)==='mailto:yvonne.martin@exemple.fr', lien&&lien.href);

 console.log('\n═══ ① L ANNUAIRE PRATICIENS ET PARTENAIRES ═══');
 const liens=await pg.evaluate(()=>({
   mail:   cabLien('mail','jean.martin@exemple.fr'),
   tel:    cabLien('tel','04 94 00 00 00'),
   mobile: cabLien('mobile','0600000000'),
   adr:    cabLien('adresse','3 place du Marché, 83000 Toulon'),
   fax:    cabLien('fax','0494000001'),
   autre:  cabLien('autre','code 1234'),
   vide:   cabLien('mail','   ')
 }));
 ok('un e-mail donne un lien mailto', liens.mail && /^mailto:/.test(liens.mail.href));
 ok('un téléphone donne un lien tel', liens.tel && /^tel:/.test(liens.tel.href));
 // ⚠️ Les espaces d'un numéro recopié cassent tel: sur certains appareils
 ok('et le numéro est débarrassé de ses espaces',
    liens.tel && liens.tel.href==='tel:0494000000', liens.tel&&liens.tel.href);
 ok('un mobile aussi', liens.mobile && /^tel:/.test(liens.mobile.href));
 ok('une adresse donne un itinéraire', liens.adr && /^geo:/.test(liens.adr.href));
 ok('et elle passe par le système, pas par un <a>', liens.adr && liens.adr.systeme===true);
 // ⚠️ Rien à faire = AUCUN bouton, pas un bouton grisé.
 ok('un fax ne donne aucun bouton', liens.fax===null);
 ok('un « autre » non plus', liens.autre===null);
 ok('une valeur vide non plus', liens.vide===null);

 // À l'écran : un contact de l'annuaire avec trois coordonnées
 await pg.evaluate(()=>{
   const C=cabinet();
   C.contacts=C.contacts||[];
   C.contacts.push({ id:'ct-essai', cat:'praticien', nom:'Dr ESSAI', metier:'Médecin généraliste',
     coord:[{type:'mail',val:'dr.essai@exemple.fr',vis:'pro'},
            {type:'tel', val:'04 94 11 22 33',vis:'patient'},
            {type:'fax', val:'0494112234',vis:'pro'}] });
   save(); sheetCabinet('praticiens');
 });
 await pg.waitForTimeout(900);
 const sur=await pg.evaluate(()=>{
   const l=[...document.querySelectorAll('#sheet .cab-li')]
     .find(x=>/Dr ESSAI/.test(x.textContent));
   if(!l) return null;
   return { mailto:!!l.querySelector('a[href^="mailto:"]'),
            tel:!!l.querySelector('a[href^="tel:"]'),
            dansLeBouton:!!l.querySelector('.selv .cc-go'),
            nBoutons:l.querySelectorAll('.cc-go').length };
 });
 ok('la ligne du contact porte ses actions', !!sur, 'ligne introuvable');
 ok('✉️ sur son e-mail', sur && sur.mailto);
 ok('📞 sur son numéro', sur && sur.tel);
 // ⚠️ Un bouton dans un bouton : HTML invalide, toucher imprévisible.
 ok('les actions sont HORS du bouton de la ligne', sur && !sur.dansLeBouton);
 ok('le fax n ajoute pas de bouton (2 actions, pas 3)', sur && sur.nBoutons===2, sur&&String(sur.nBoutons));

 // Dans l'éditeur du contact : un bouton par coordonnée, qui suit la frappe
 await pg.click('#sheet [data-cabc="ct-essai"]'); await pg.waitForTimeout(800);
 ok('l éditeur montre un bouton par coordonnée utile',
    await pg.evaluate(()=>document.querySelectorAll('#sheet .cc-gow .cc-go').length===2));
 // ⚠️ Le bouton doit suivre la VALEUR, sans redessiner l'écran.
 await pg.fill('[data-ccv="0"]','autre.adresse@exemple.fr'); await pg.waitForTimeout(400);
 ok('corriger l adresse met le lien à jour',
    await pg.evaluate(()=>{const a=document.querySelector('[data-ccgw="0"] a');
      return !!a && decodeURIComponent(a.getAttribute('href'))==='mailto:autre.adresse@exemple.fr';}),
    await pg.evaluate(()=>{const a=document.querySelector('[data-ccgw="0"] a');return a?a.getAttribute('href'):'(aucun)';}));
 await pg.fill('[data-ccv="0"]',''); await pg.waitForTimeout(400);
 ok('vider le champ fait disparaître le bouton',
    await pg.evaluate(()=>!document.querySelector('[data-ccgw="0"] .cc-go')));
 // ⚠️ Le champ garde le curseur : pas de redessin complet pendant la frappe
 ok('et le champ n a pas perdu le focus possible',
    await pg.evaluate(()=>!!document.querySelector('[data-ccv="0"]')));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
