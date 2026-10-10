// v1.11.0 — le listing (ordre de passage, infos à droite sur UNE ligne),
// le troisième rythme, les douze formes. Au navigateur réel : un écran
// que je n'ai pas vu tourner n'existe pas.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8121,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:412,height:900}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8121/index.html'); await pg.waitForTimeout(2600);

 // ⚠️ S.firstRun=false, sinon render() s'arrête sur l'écran de bienvenue
 //    et le board reste vide — quatre contrôles verts sur du néant.
 const T=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t; S.slotsTours={}; delete S.listeTri;
   S.patients.forEach(p=>{ if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t); });
   // ⚠️ La démo n'a ni téléphone ni adresse sur tous les dossiers : sans
   //    ça le contrôle des boutons 📞 📍 passait au vert sur zéro bouton.
   S.patients.forEach((p,i)=>{ if(i%2===0){ p.tel={mobile:'0600000000'};
     p.address='12 rue des Lilas'; p.cp='83000'; p.ville='Toulon'; } });
   save(); render(); return t;
 });
 await pg.waitForTimeout(500);

 console.log('═══ ⑥ LE LISTING ═══');
 await pg.click('#f-liste'); await pg.waitForTimeout(600);
 const n=await pg.evaluate(()=>document.querySelectorAll('#board .pl-i').length);
 ok(`le listing s affiche (${n} lignes)`, n>0);
 ok('plus aucune carte', await pg.evaluate(()=>!document.querySelectorAll('#board .pcard').length));

 // ⚠️ LE DÉFAUT. C'est tout l'objet de la demande.
 ok('l ordre de passage est le tri PAR DÉFAUT',
    await pg.evaluate(()=>document.querySelector('[data-pltri="ordre"]')?.classList.contains('on')===true));
 const memeOrdre=await pg.evaluate(()=>{
   // les cartes et le listing doivent lister les mêmes patients dans le même ordre
   const liste=[...document.querySelectorAll('#board .pl-main')].map(b=>b.dataset.pli);
   S.boardListe=false; render();
   const cartes=[...document.querySelectorAll('#board .pcard')].map(c=>c.dataset.id);
   S.boardListe=true; render();
   return JSON.stringify(liste)===JSON.stringify(cartes) ? '' : liste+' vs '+cartes;
 });
 await pg.waitForTimeout(400);
 ok('le listing suit exactement l ordre des cartes', memeOrdre==='', memeOrdre);

 // ⚠️ SA REMARQUE : les séparateurs de lettres allongeaient le défilé.
 ok('aucun séparateur de lettre en ordre de passage',
    await pg.evaluate(()=>document.querySelectorAll('#board .pl-sep').length===0));
 ok('un rang numéroté devant chaque nom',
    await pg.evaluate(()=>{const r=[...document.querySelectorAll('#board .pl-rg')].map(e=>e.textContent);
      return r.length>0 && r.join(',')===r.map((_,i)=>i+1).join(',');}));

 await pg.click('[data-pltri="alpha"]'); await pg.waitForTimeout(500);
 const noms=await pg.evaluate(()=>[...document.querySelectorAll('#board .pl-nm b')].map(e=>e.textContent));
 ok('A→Z retrie bien', JSON.stringify(noms)===JSON.stringify(noms.slice().sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}))));
 ok('et ramène les lettres en intertitre',
    await pg.evaluate(()=>document.querySelectorAll('#board .pl-sep').length>0));
 ok('sans rang numéroté (il n a plus de sens)',
    await pg.evaluate(()=>document.querySelectorAll('#board .pl-rg').length===0));
 ok('le tri est retenu', await pg.evaluate(()=>S.listeTri==='alpha'));
 await pg.click('[data-pltri="ordre"]'); await pg.waitForTimeout(500);

 // ⚠️ LE POINT QU'IL A SOULIGNÉ : « infos a droite sur une seule ligne max »
 await pg.evaluate(()=>{ const p=S.patients[0];
   p.visits=[{id:'vx',date:todayISO(),at:'07:41',consts:{ta:'19/11',puls:'110',temp:'38.4'},soins:[]}];
   p.docs=[{id:'d1'},{id:'d2'},{id:'d3'}];
   p.tags=['prioritaire'];
   p.thresholds=null; save(); render(); });
 await pg.waitForTimeout(500);
 const mesure=await pg.evaluate(()=>{
   const out=[];
   document.querySelectorAll('#board .pl-i').forEach(r=>{
     const inf=r.querySelector('.pl-r'); if(!inf) return;
     const b=inf.getBoundingClientRect();
     const h=[...inf.children].map(c=>c.getBoundingClientRect());
     // une seule ligne = tous les enfants partagent le même haut
     const tops=new Set(h.map(c=>Math.round(c.top)));
     out.push({ n:inf.children.length, lignes:tops.size, haut:Math.round(b.height),
                debord: h.some(c=>c.right > b.right+1) });
   });
   return out;
 });
 const multi = mesure.filter(m=>m.lignes>1);
 ok('les informations de droite tiennent sur UNE ligne partout',
    multi.length===0, JSON.stringify(multi));
 ok('aucune rangée ne dépasse 56 px de haut',
    mesure.every(m=>m.haut<=56), JSON.stringify(mesure.map(m=>m.haut)));

 // ⚠️ La règle défendue : un réglage d'affichage ne cache jamais une alerte.
 const vig=await pg.evaluate(()=>{
   const r=[...document.querySelectorAll('#board .pl-i')].find(x=>x.classList.contains('st-alert'));
   return r ? { liseré:getComputedStyle(r).borderLeftColor,
                motDit:!!r.querySelector('.pl-m.d'),
                constantes:(r.querySelector('.pl-sb')||{}).textContent||'' } : null;
 });
 ok('la rangée en vigilance porte son liseré', vig && vig.liseré!=='rgba(0, 0, 0, 0)', JSON.stringify(vig));
 ok('et le mot « vigilance » est écrit', vig && vig.motDit);
 ok('les constantes hors seuil sont sous le nom', vig && /19\/11/.test(vig.constantes), vig&&vig.constantes);

 ok('📞 et 📍 sont hors du bouton principal (HTML valide)',
    await pg.evaluate(()=>![...document.querySelectorAll('#board .pl-ic')].some(b=>b.closest('.pl-main'))));
 const nIc=await pg.evaluate(()=>document.querySelectorAll('#board .pl-ic').length);
 ok(`et ils existent (${nIc} boutons)`, nIc>0);

 // Toucher une ligne doit ramener aux cartes sur CE patient
 const cible=await pg.evaluate(()=>document.querySelector('#board .pl-main').dataset.pli);
 await pg.click('#board .pl-main'); await pg.waitForTimeout(700);
 ok('toucher une ligne rouvre sa carte',
    await pg.evaluate(id=>!S.boardListe && !!document.querySelector(`.pcard[data-id="${id}"].open`), cible));

 console.log('\n═══ ⑤ LES DOUZE FORMES ═══');
 ok('douze formes déclarées', await pg.evaluate(()=>FORMES.length===12));
 ok('les cinq codes d origine sont intacts',
    await pg.evaluate(()=>['cp','inj','got','patch','aut'].every(k=>FORMES.some(f=>f[0]===k))));
 ok('chaque forme a un code, une icône, un libellé',
    await pg.evaluate(()=>FORMES.every(f=>f.length===3&&f.every(x=>String(x).trim()))));
 ok('aucun code en double', await pg.evaluate(()=>new Set(FORMES.map(f=>f[0])).size===12));
 const lec=await pg.evaluate(()=>({
   gelule: traitFormeDepuis('ATORVASTATINE 20 mg gélule'),
   collyre: traitFormeDepuis('LATANOPROST collyre'),
   spray:   traitFormeDepuis('Pulvérisation nasale'),
   inhal:   traitFormeDepuis('SERETIDE Diskus poudre pour inhalation'),
   sirop:   traitFormeDepuis('solution buvable 15 ml'),
   pommade: traitFormeDepuis('DIPROSONE crème'),
   suppo:   traitFormeDepuis('suppositoire'),
   cp:      traitFormeDepuis('comprimé pelliculé'),
   inj:     traitFormeDepuis('stylo injectable'),
   patch:   traitFormeDepuis('dispositif transdermique')
 }));
 const att={gelule:'gel',collyre:'col',spray:'spr',inhal:'inh',sirop:'sir',pommade:'pom',
            suppo:'sup',cp:'cp',inj:'inj',patch:'patch'};
 Object.keys(att).forEach(k=>ok(`« ${k} » tombe dans la bonne case`, lec[k]===att[k], lec[k]));

 console.log('\n═══ ④ LE TROISIÈME RYTHME ═══');
 const ry=await pg.evaluate(()=>({
   fixe: traitRythme({m:'1'}),
   sib:  traitRythme({sibesoin:true}),
   frq:  traitRythme({freq:'1 fois par mois'}),
   // ⚠️ exclusivité : si les deux sont là, « si besoin » gagne
   deux: traitRythme({sibesoin:true, freq:'1 fois par mois'}),
   // ⚠️ un ancien dossier sans freq doit se lire comme avant
   vieux: traitRythme({m:'',mi:'',s:'',c:'',sibesoin:false}),
   posoF: traitPoso({m:'1',mi:'',s:'1',c:''}),
   posoS: traitPoso({sibesoin:true}),
   posoQ: traitPoso({freq:'1 fois par mois'}),
   vide:  traitRythme(null)
 }));
 ok('posologie fixe reconnue', ry.fixe==='fixe', ry.fixe);
 ok('si besoin reconnu', ry.sib==='sib', ry.sib);
 ok('autre rythme reconnu', ry.frq==='freq', ry.frq);
 ok('« si besoin » l emporte si les deux marqueurs traînent', ry.deux==='sib', ry.deux);
 ok('un ancien dossier se lit comme avant', ry.vieux==='fixe', ry.vieux);
 ok('traitPoso rend 1-0-1-0', ry.posoF==='1-0-1-0', ry.posoF);
 ok('traitPoso rend « si besoin »', ry.posoS==='si besoin', ry.posoS);
 ok('traitPoso recopie le rythme tel quel', ry.posoQ==='1 fois par mois', ry.posoQ);
 ok('une ligne nulle ne fait pas planter', ry.vide==='fixe', ry.vide);

 // L'écran : trois pastilles, et les quatre cases qui disparaissent
 await pg.evaluate(()=>{ S.boardListe=false; sheetTraitement(S.patients[0].id); });
 await pg.waitForTimeout(700);
 await pg.click('#tr-add'); await pg.waitForTimeout(600);
 ok('trois pastilles de rythme à l écran',
    await pg.isVisible('#te-reg') && await pg.isVisible('#te-frq') && await pg.isVisible('#te-sib'));
 ok('les quatre cases sont là en posologie fixe', await pg.isVisible('#te-m'));
 await pg.click('#te-frq'); await pg.waitForTimeout(500);
 // ⚠️ LE POINT EXACT DE SA DEMANDE : les cases doivent DISPARAÎTRE.
 ok('« autre rythme » MASQUE les quatre cases',
    await pg.evaluate(()=>!document.querySelector('#te-m')));
 ok('et ouvre le champ de rythme', await pg.isVisible('#te-freq'));
 ok('avec quatre raccourcis',
    await pg.evaluate(()=>document.querySelectorAll('#sheet [data-tfq]').length===4));

 await pg.fill('#te-nom','PROLIA 60 mg');
 await pg.click('#sheet [data-tfq="1 fois tous les 3 mois"]'); await pg.waitForTimeout(400);
 ok('un raccourci remplit le champ',
    await pg.evaluate(()=>document.querySelector('#te-freq').value==='1 fois tous les 3 mois'));
 // ⚠️ `grab()` avant le changement de mode : la fréquence ne doit pas
 //    s'évaporer à l'aller-retour.
 await pg.click('#te-reg'); await pg.waitForTimeout(400);
 await pg.click('#te-frq'); await pg.waitForTimeout(400);
 ok('l aller-retour ne perd ni le nom ni le rythme',
    await pg.evaluate(()=>document.querySelector('#te-nom').value==='PROLIA 60 mg'
      && document.querySelector('#te-freq').value==='1 fois tous les 3 mois'));

 await pg.click('#te-ok'); await pg.waitForTimeout(800);
 const enr=await pg.evaluate(()=>{
   const l=(S.patients[0].traitement.lignes||[]).find(x=>/PROLIA/.test(x.nom));
   return l?{freq:l.freq,sib:l.sibesoin,m:l.m}:null;
 });
 ok('la ligne est enregistrée avec son rythme', enr && enr.freq==='1 fois tous les 3 mois', JSON.stringify(enr));
 ok('et sans drapeau « si besoin »', enr && enr.sib===false);
 ok('et sans posologie fantôme dans les cases', enr && !enr.m);
 ok('elle apparaît dans son propre groupe « Autre rythme »',
    await pg.evaluate(()=>/Autre rythme/.test(document.querySelector('#sheet').textContent)));
 ok('le rythme est écrit sur la rangée',
    await pg.evaluate(()=>!!document.querySelector('#sheet .tr-fq')
      && /3 mois/.test(document.querySelector('#sheet .tr-fq').textContent)));
 // ⚠️ Le rythme occupe les colonnes de prise, il ne s'y ajoute pas.
 ok('et il remplace les quatre colonnes, il ne s y ajoute pas',
    await pg.evaluate(()=>{
      const r=[...document.querySelectorAll('#sheet .tr-r')].find(x=>/PROLIA/.test(x.textContent));
      return !!r && r.querySelectorAll('.tr-d').length===0;
    }));
 // ⚠️ Une seule ligne dans la grille : le texte long ne doit pas déborder.
 ok('le rythme ne déborde pas de ses colonnes',
    await pg.evaluate(()=>{
      const r=[...document.querySelectorAll('#sheet .tr-r')].find(x=>/PROLIA/.test(x.textContent));
      const f=r && r.querySelector('.tr-fq'); if(!f) return false;
      return f.getBoundingClientRect().right <= r.getBoundingClientRect().right+1;
    }));
 // Un rythme vide doit être refusé plutôt qu'enregistré en fixe muet
 await pg.click('#tr-add'); await pg.waitForTimeout(500);
 await pg.fill('#te-nom','ESSAI VIDE'); await pg.click('#te-frq'); await pg.waitForTimeout(400);
 await pg.click('#te-ok'); await pg.waitForTimeout(600);
 ok('un rythme laissé vide est refusé',
    await pg.evaluate(()=>!(S.patients[0].traitement.lignes||[]).some(x=>/ESSAI VIDE/.test(x.nom))));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));

 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
