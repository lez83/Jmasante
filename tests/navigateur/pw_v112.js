// v1.12.0 — ① inscrire un médecin au cabinet depuis le dossier,
//            ③ nouvelle ordonnance depuis la fiche de traitement.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8126,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:412,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8126/index.html'); await pg.waitForTimeout(2600);

 const pid=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t; const p=S.patients[0];
   if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t);
   p.medecins=[]; p.docs=[]; p.liens={}; p.traitement={lignes:[]};
   cabinet().contacts = (cabinet().contacts||[]).filter(c=>!/ARNAUD|DUPRE/i.test(c.nom||''));
   save(); render(); return p.id;
 });
 await pg.waitForTimeout(500);

 console.log('═══ ① LA PASTILLE N APPARAÎT QUE QUAND ELLE SERT ═══');
 // ⚠️ Le bloc est TOUJOURS écrit, et masqué tant que le nom est vide :
 //    taper un nom ne redessine pas la ligne, donc une pastille écrite
 //    sous condition n'apparaissait jamais. On vérifie donc `hidden`,
 //    pas l'absence — mon premier contrôle vérifiait l'ancienne idée.
 const sansNom=await pg.evaluate(()=>{
   const h=document.createElement('div');
   h.innerHTML=listeContactsHTML('med',[{id:'a',spec:'Pneumologue',nom:'',tel:''}]);
   const w=h.querySelector('[data-lcvw]');
   return { existe:!!w, masque:!!(w&&w.hasAttribute('hidden')) };
 });
 ok('pas de nom, pastille masquée', sansNom.existe && sansNom.masque, JSON.stringify(sansNom));
 const etat=await pg.evaluate(()=>{
   const mk=a=>{const h=document.createElement('div');h.innerHTML=listeContactsHTML('med',a);return h;};
   const neuf=mk([{id:'a',spec:'Pneumologue',nom:'Dr ARNAUD Claire',tel:'0494112233'}]);
   const duCab=mk([{id:'b',spec:'Pneumologue',nom:'Dr ARNAUD Claire',tel:'0494112233',cabRef:'cab-9'}]);
   const w=neuf.querySelector('[data-lcvw]');
   if (w && w.hasAttribute('hidden')) return { neuf:0, cabTxt:'(masquée malgré le nom)', cabBouton:-1 };
   return { neuf:neuf.querySelectorAll('[data-lcvers]').length,
            cabTxt:(duCab.textContent.match(/Déjà au cabinet/)||[])[0]||null,
            cabBouton:duCab.querySelectorAll('[data-lcvers]').length };
 });
 ok('un nom saisi à la main fait apparaître la pastille', etat.neuf===1);
 // ⚠️ Une ligne déjà liée DIT qu'elle l'est, sans proposer un geste inutile.
 ok('une ligne venue du cabinet dit « Déjà au cabinet »', etat.cabTxt==='Déjà au cabinet');
 ok('et ne propose aucun bouton', etat.cabBouton===0, String(etat.cabBouton));

 console.log('\n═══ ① CE QUI PART AU CABINET ═══');
 const av=await pg.evaluate(()=>cabinet().contacts.length);
 const ins=await pg.evaluate(()=>{
   const arr=[{id:'a',spec:'Pneumologue',nom:'Dr ARNAUD Claire',tel:'04 94 11 22 33',_versCab:true}];
   const r=contactsVersCabinet(arr);
   const c=cabinet().contacts.find(x=>/ARNAUD/.test(x.nom));
   return { r, cabRef:arr[0].cabRef, reste:arr[0]._versCab,
            cat:c&&c.cat, metier:c&&c.metier, fam:c&&cabFamille(c),
            coord:c&&c.coord[0], lien:c&&arr[0].cabRef===c.id };
 });
 ok('le contact est créé', ins.r.crees.length===1, JSON.stringify(ins.r));
 // ⚠️ Partenaires, pas Praticiens : ce sont des correspondants externes.
 ok('en PARTENAIRES, pas en praticiens', ins.cat==='partenaire', ins.cat);
 ok('la famille se déduit du métier', ins.fam==='med', ins.fam);
 ok('la coordonnée est visible du patient', ins.coord && ins.coord.vis==='patient', JSON.stringify(ins.coord));
 ok('et c est bien le numéro saisi', ins.coord && ins.coord.val==='04 94 11 22 33', JSON.stringify(ins.coord));
 ok('la ligne du dossier reçoit son lien vers l annuaire', ins.lien===true);
 // ⚠️ L'intention est consommée : sans ça, chaque réouverture réinscrirait.
 ok('l intention est consommée', ins.reste===undefined, String(ins.reste));
 ok('un seul contact de plus', await pg.evaluate(()=>cabinet().contacts.length)===av+1);

 // ⚠️ LE POINT CENTRAL : jamais de doublon.
 const dbl=await pg.evaluate(()=>{
   const arr=[{id:'z',spec:'Pneumologue',nom:'Dr Arnaud  claire',tel:'0600000000',_versCab:true}];
   const n0=cabinet().contacts.length;
   const r=contactsVersCabinet(arr);
   return { r, n0, n1:cabinet().contacts.length, cabRef:arr[0].cabRef };
 });
 ok('un nom déjà présent ne crée pas de doublon', dbl.n1===dbl.n0, dbl.n0+' → '+dbl.n1);
 ok('il est rattaché, et c est annoncé comme tel', dbl.r.lies.length===1 && dbl.r.crees.length===0, JSON.stringify(dbl.r));
 ok('la ligne pointe vers le contact existant', !!dbl.cabRef);
 // ⚠️ « traitant » est un rôle auprès d'un patient, pas un métier.
 const tr=await pg.evaluate(()=>{
   const arr=[{id:'t',spec:'traitant',nom:'Dr DUPRE Marc',tel:'0494999999',_versCab:true}];
   contactsVersCabinet(arr);
   const c=cabinet().contacts.find(x=>/DUPRE/.test(x.nom));
   return { metier:c&&c.metier, fam:c&&cabFamille(c) };
 });
 ok('« traitant » devient « Médecin », pas un rôle de dossier', tr.metier==='Médecin', tr.metier);
 ok('et il atterrit chez les médecins', tr.fam==='med', tr.fam);
 // ⚠️ Rien ne doit survivre au dossier : `_versCab` est un état d'écran.
 ok('_versCab n entre jamais au dossier',
    await pg.evaluate(()=>nettoyerContacts([{nom:'X',tel:'1',_versCab:true,_aut:true}])[0]._versCab===undefined));

 console.log('\n═══ ① LE PARCOURS COMPLET DANS LA FICHE ═══');
 await pg.evaluate(id=>sheetPatient(getP(id)), pid); await pg.waitForTimeout(900);
 await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#sheet [data-lcadd]')][0]; if(b) b.click(); });
 await pg.waitForTimeout(500);
 await pg.evaluate(()=>{
   const n=document.querySelector('#sheet [data-lcnom]'); n.value='Dr MOREAU Sylvie';
   n.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await pg.waitForTimeout(500);
 ok('la pastille apparaît une fois le nom saisi', await pg.evaluate(()=>!!document.querySelector('#sheet [data-lcvers]')));
 const nAvant=await pg.evaluate(()=>cabinet().contacts.length);
 await pg.click('#sheet [data-lcvers]'); await pg.waitForTimeout(500);
 ok('la pastille s allume', await pg.evaluate(()=>document.querySelector('#sheet [data-lcvers]').classList.contains('on')));
 // ⚠️ RIEN N'ENTRE AU CABINET avant l'enregistrement de la fiche.
 ok('mais le cabinet n a pas encore bougé',
    await pg.evaluate(()=>cabinet().contacts.length)===nAvant, 'déjà écrit');
 await pg.evaluate(()=>closeSheet()); await pg.waitForTimeout(400);
 ok('et après « Annuler », toujours rien au cabinet',
    await pg.evaluate(()=>cabinet().contacts.length)===nAvant);

 await pg.evaluate(id=>sheetPatient(getP(id)), pid); await pg.waitForTimeout(900);
 await pg.evaluate(()=>{ const b=[...document.querySelectorAll('#sheet [data-lcadd]')][0]; if(b) b.click(); });
 await pg.waitForTimeout(500);
 await pg.evaluate(()=>{ const n=document.querySelector('#sheet [data-lcnom]'); n.value='Dr MOREAU Sylvie';
   n.dispatchEvent(new Event('change',{bubbles:true})); });
 await pg.waitForTimeout(500);
 await pg.click('#sheet [data-lcvers]'); await pg.waitForTimeout(400);
 await pg.click('#f-save'); await pg.waitForTimeout(900);
 ok('enregistrer la fiche inscrit le contact',
    await pg.evaluate(()=>cabinet().contacts.some(c=>/MOREAU/.test(c.nom))));
 ok('et le dossier garde son lien vers l annuaire',
    await pg.evaluate(id=>{const m=(getP(id).medecins||[]).find(x=>/MOREAU/.test(x.nom||''));
      return !!(m&&m.cabRef);}, pid));
 ok('sans laisser d intention derrière lui',
    await pg.evaluate(id=>!(getP(id).medecins||[]).some(x=>x._versCab), pid));
 // ⚠️ Deuxième ouverture : la ligne doit dire « Déjà au cabinet ».
 await pg.evaluate(id=>sheetPatient(getP(id)), pid); await pg.waitForTimeout(900);
 ok('à la réouverture, la ligne dit « Déjà au cabinet »',
    await pg.evaluate(()=>/Déjà au cabinet/.test(document.querySelector('#sheet').textContent)));
 await pg.evaluate(()=>closeSheet()); await pg.waitForTimeout(300);

 console.log('\n═══ ③ LA NOUVELLE ORDONNANCE ═══');
 await pg.evaluate(id=>sheetTraitement(id), pid); await pg.waitForTimeout(800);
 // ⚠️ LE CUL-DE-SAC : sans aucun document, « Rattacher » ne doit plus être là.
 ok('sans document, « Rattacher » disparaît',
    await pg.evaluate(()=>!document.querySelector('#sheet [data-lienadd]')));
 ok('et « Nouvelle ordonnance » le remplace',
    await pg.evaluate(()=>!!document.querySelector('#sheet [data-ordoadd]')));
 await pg.click('#sheet [data-ordoadd]'); await pg.waitForTimeout(700);
 ok('le voyage est ouvert vers la fiche de traitement',
    await pg.evaluate(()=>!!_ordoEnCours && _ordoEnCours.cle==='traitement'));
 ok('la famille Prescriptions est imposée', await pg.evaluate(()=>_docFamImposee==='presc'));
 ok('on est sur le choix de la source', await pg.isVisible('#sheet [data-src]'));
 // ⚠️ Abandonner doit ramener D'OÙ L'ON VIENT, pas dans 📎 Documents.
 await pg.click('#src-cancel'); await pg.waitForTimeout(700);
 ok('abandonner ramène sur la fiche de traitement',
    await pg.evaluate(()=>/Fiche de traitement/.test(document.querySelector('#sheet').textContent)));
 ok('et le voyage est refermé',
    await pg.evaluate(()=>_ordoEnCours===null && _docFamImposee===null));

 // L'écran de qualification, famille imposée
 await pg.click('#sheet [data-ordoadd]'); await pg.waitForTimeout(600);
 const qual=await pg.evaluate(async()=>{
   closeSheet();
   qualifierDoc(1, 120000, 'application/pdf');
   await new Promise(r=>setTimeout(r,350));
   const t=document.querySelector('#sheet');
   return { familles:[...t.querySelectorAll('[data-dfam]')].map(e=>e.dataset.dfam),
            types:[...t.querySelectorAll('[data-dtyp]')].map(e=>e.dataset.dtyp),
            titre:(t.querySelector('h3')||{}).textContent||'' };
 });
 // ⚠️ Les autres familles ne sont pas proposées DU TOUT.
 ok('une seule famille est proposée', qual.familles.length===1 && qual.familles[0]==='presc', JSON.stringify(qual.familles));
 ok('et elle est ouverte d office, ses cinq types visibles',
    qual.types.length===5 && qual.types.every(t=>/^ordo-/.test(t)), JSON.stringify(qual.types));
 // ⚠️ On impose la FAMILLE, jamais le TYPE : choisir serait deviner.
 ok('aucun type n est présélectionné',
    await pg.evaluate(()=>!document.querySelector('#sheet [data-dtyp].on')));
 ok('et « Ajouter » reste bloqué tant que rien n est choisi',
    await pg.evaluate(()=>!!document.querySelector('#sheet #d-ok[disabled]')));
 // ⚠️ L'en-tête de la famille imposée ne doit pas se replier.
 await pg.click('#sheet [data-dfam] .dfam-h'); await pg.waitForTimeout(300);
 ok('toucher son en-tête ne la replie pas',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-dtyp]').length===5));
 await pg.evaluate(()=>{ closeSheet(); ordoVoyageFini(); }); await pg.waitForTimeout(300);

 // Le rattachement et le retour, en simulant l'arrivée d'un document
 const fin=await pg.evaluate(async id=>{
   const p=getP(id);
   _ordoEnCours={pid:id,cle:'traitement'};
   const docId='doc-essai';
   p.docs.push({id:docId,name:'2026-10-10_Ordo-medecin_renouvellement',mime:'application/pdf',
                date:todayISO(),type:'ordo-med',precision:'Renouvellement'});
   const l=liensDe(p,'traitement'); l.push(docId);
   ordoVoyageFini(); save(true);
   sheetTraitement(id);
   await new Promise(r=>setTimeout(r,500));
   return { lie:liensDe(getP(id),'traitement').includes(docId),
            voyage:_ordoEnCours, fam:_docFamImposee,
            ecran:/Fiche de traitement/.test(document.querySelector('#sheet').textContent),
            visible:/Ordonnance médecin|Renouvellement/.test(document.querySelector('#sheet').textContent) };
 }, pid);
 ok('l ordonnance arrive rattachée', fin.lie);
 ok('on revient sur la fiche de traitement', fin.ecran);
 ok('elle est visible dans le bloc', fin.visible);
 ok('et plus aucun voyage ne traîne', fin.voyage===null && fin.fam===null);
 // ⚠️ Avec un document au dossier, les DEUX boutons reviennent.
 ok('les deux boutons cohabitent quand il y a des documents',
    await pg.evaluate(id=>{ const p=getP(id);
      p.docs.push({id:'d2',name:'x',mime:'application/pdf',date:todayISO(),type:'bio',precision:'INR'});
      save(); sheetTraitement(id);
      return !!document.querySelector('#sheet [data-lienadd]') && !!document.querySelector('#sheet [data-ordoadd]');
    }, pid));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
