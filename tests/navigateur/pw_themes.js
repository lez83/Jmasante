// Les panneaux en creux restent lisibles dans TOUS les thèmes.
// ⚠️ Le défaut d'origine : « Île de la Réunion » pose un décor en image,
//    et son --bg est la couleur de ce décor — ardoise foncée — pendant
//    que ses surfaces sont crème. Les blocs peints avec --bg sortaient
//    en ardoise sous du texte sombre. Un seul thème concerné, mais
//    seule une mesure sur les douze le prouve.
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const ROOT='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(ROOT,u); if(!f.startsWith(ROOT)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
let ko=[]; const ok=(l,c,x)=>{console.log(`  ${c?'✓':'⚠'} ${l}${x&&!c?'  → '+x:''}`); if(!c)ko.push(l);};
(async()=>{
 await new Promise(r=>srv.listen(8128,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const pg=await (await nav.newContext({viewport:{width:430,height:950}})).newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e)));
 await pg.goto('http://localhost:8128/index.html'); await pg.waitForTimeout(2600);

 /* Contraste WCAG, posé DANS la page pour être réutilisable partout. */
 await pg.evaluate(() => {
   window.ctr = (a, b) => {
     const lum = c => { const m = String(c).match(/[\d.]+/g).map(Number);
       const f = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
       return .2126*f(m[0]) + .7152*f(m[1]) + .0722*f(m[2]); };
     const L1 = lum(a), L2 = lum(b);
     return (Math.max(L1,L2) + .05) / (Math.min(L1,L2) + .05);
   };
 });
 const pid=await pg.evaluate(()=>{
   S.confidentialityAck=true; S.firstRun=false;
   const t=S.tours[0]; S.curTour=t; const p=S.patients[0];
   if(!(p.tours||[]).includes(t)) (p.tours=p.tours||[]).push(t);
   p.medecins=[{id:'m1',spec:'Pneumologue',nom:'Dr ARNAUD Claire',tel:'0494112233'}];
   save(); render(); return p.id;
 });

 /* Luminance relative et contraste WCAG — la seule mesure qui ne dépend
    pas de l'idée qu'on se fait d'une couleur. */
 const outil = `
   const lum = c => { const [r,g,b]=c; const f=v=>{v/=255;
     return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);};
     return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
   const rgb = s => { const m=String(s).match(/-?[\\d.]+/g)||[0,0,0];
     return [+m[0],+m[1],+m[2],m[3]===undefined?1:+m[3]]; };
   /* ⚠️ Un fond translucide se lit SUR ce qu'il y a dessous : prendre sa
      couleur brute donnerait un contraste imaginaire. On compose. */
   const sur = (fg,bg) => { const a=fg[3];
     return [0,1,2].map(i => fg[i]*a + bg[i]*(1-a)); };
   const ratio = (a,b) => { const l1=lum(a),l2=lum(b);
     return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05); };
 `;

 const THEMES=['bloc','reunion','verre','tubes','hopital','cosmos','retro','ambre','papier'];
 console.log('═══ LE TEXTE SUR UN PANNEAU EN CREUX ═══');
 for (const th of THEMES){
   await pg.evaluate(t=>{ S.theme=t; save(); applyTheme(); render(); }, th);
   await pg.waitForTimeout(220);
   await pg.evaluate(id=>sheetPatient(getP(id)), pid);
   await pg.waitForTimeout(500);
   const m=await pg.evaluate('(()=>{'+outil+`
     const row=document.querySelector('#sheet .lc-row');
     const inp=document.querySelector('#sheet .lc-row [data-lcnom]');
     if(!row) return null;
     const cs=getComputedStyle(row), sheet=getComputedStyle(document.getElementById('sheet'));
     const fond = sur(rgb(cs.backgroundColor), rgb(sheet.backgroundColor).slice(0,3));
     const txt  = sur(rgb(cs.color), fond);
     const champFond = inp ? sur(rgb(getComputedStyle(inp).backgroundColor), fond) : null;
     const champTxt  = inp ? sur(rgb(getComputedStyle(inp).color), champFond) : null;
     return { bloc:+ratio(txt,fond).toFixed(2),
              champ: champFond ? +ratio(champTxt,champFond).toFixed(2) : null };
   `+'})()');
   // ⚠️ 4,5:1 est le seuil WCAG AA pour du texte de taille courante.
   const bon = m && m.bloc>=4.5 && (m.champ===null || m.champ>=4.5);
   ok(`${th.padEnd(8)} bloc ${m?m.bloc:'?'}:1 · champ ${m?m.champ:'?'}:1`, bon,
      JSON.stringify(m));
   await pg.evaluate(()=>closeSheet()); await pg.waitForTimeout(200);
 }

 /* ⚠️ Les champs de la première capture sont des `.rec-in`, pas des
    `.lc-in` : ils ont leur PROPRE règle de fond, et c'est elle qui
    rendait l'écran du cabinet illisible. Un contrôle sur une seule des
    deux familles aurait laissé l'autre passer. */
 console.log('\n═══ LES CHAMPS DE L ÉCRAN DU CABINET ═══');
 for (const th of ['reunion','bloc','papier','cosmos']){
   await pg.evaluate(t=>{ S.theme=t; save(); applyTheme(); render(); }, th);
   await pg.waitForTimeout(200);
   await pg.evaluate(()=>sheetCabinet('cabinet')); await pg.waitForTimeout(500);
   const m=await pg.evaluate('(()=>{'+outil+`
     const e=document.getElementById('cab-nom'); if(!e) return null;
     const sh=getComputedStyle(document.getElementById('sheet'));
     const f=sur(rgb(getComputedStyle(e).backgroundColor), rgb(sh.backgroundColor).slice(0,3));
     const t=sur(rgb(getComputedStyle(e).color), f);
     const ph=getComputedStyle(e,'::placeholder').color;
     return { champ:+ratio(t,f).toFixed(2),
              invite: ph ? +ratio(sur(rgb(ph),f),f).toFixed(2) : null };
   `+'})()');
   ok(`${th.padEnd(8)} champ ${m?m.champ:'?'}:1`, m && m.champ>=4.5, JSON.stringify(m));
   await pg.evaluate(()=>closeSheet()); await pg.waitForTimeout(200);
 }

 console.log('\n═══ LE JETON NE CHANGE RIEN AUX AUTRES THÈMES ═══');
 const id=await pg.evaluate(()=>{
   const out={};
   ['bloc','reunion','verre','tubes','hopital','cosmos','retro','ambre','papier'].forEach(t=>{
     S.theme=t; applyTheme();
     const cs=getComputedStyle(document.documentElement);
     out[t]={ bg:cs.getPropertyValue('--bg').trim(), inset:cs.getPropertyValue('--inset').trim() };
   });
   return out;
 });
 Object.entries(id).forEach(([t,v])=>{
   // ⚠️ Réunion est le SEUL thème qui doit s'écarter : partout ailleurs
   //    `--inset` doit rendre exactement `--bg`, sinon le jeton a changé
   //    l'apparence de thèmes qu'on ne voulait pas toucher.
   if (t==='reunion') ok(`${t.padEnd(8)} s écarte de --bg, comme prévu`, v.inset!==v.bg, v.inset+' vs '+v.bg);
   else ok(`${t.padEnd(8)} inchangé`, v.inset===v.bg, v.inset+' vs '+v.bg);
 });

 /* ══ LE DÉCOR NE TRAVERSE PAS UNE CARTE ══
    ⚠️ DÉFAUT RÉEL, SIGNALÉ EN PHOTO : sur le thème Réunion, les cartes
    des patients déjà vus laissaient voir la montagne et la mer au
    travers, et le texte devenait illisible. La cause tient en une
    multiplication : `opacity:.62` sur la carte × `--surface` à .9 font
    **0,56** d'opacité effective du fond — et l'`opacity` affaiblit en
    prime le `backdrop-filter` censé masquer ce qu'il y a derrière.

    ⚠️ C'EST CE PRODUIT QU'ON MESURE, pas la déclaration CSS. Vérifier
    « opacity vaut 1 » garderait l'écriture ; vérifier « le fond est
    opaque à au moins 85 % » garde le service rendu, quelle que soit la
    façon dont on l'obtient demain. */
 console.log('\n═══ LE DÉCOR NE TRAVERSE PAS UNE CARTE ═══');
 const alpha = (c) => { const m=String(c).match(/rgba?\(([^)]+)\)/);
   if(!m) return 1; const p=m[1].split(',').map(x=>parseFloat(x));
   return p.length>3 ? p[3] : 1; };

 /* ⚠️ PREMIER SEUIL, ÉCARTÉ APRÈS MESURE. J'avais posé « le fond d'une
    carte doit être opaque à 85 % » : quatre thèmes tombaient — Verre
    fumé, Hôpital de nuit et les deux rétro ont un `--surface` à 5 %,
    DÉLIBÉRÉMENT, parce que leur fond est uni et que la carte y est un
    voile. Rien n'y traverse. Un contrôle qui condamne un parti pris
    assumé n'est pas un contrôle, c'est une opinion.

    Ce qui est VRAIMENT en cause : l'état de la carte dégradait le fond.
    Une carte « vue » doit donc avoir EXACTEMENT la même opacité de fond
    qu'une carte « à voir » — c'est vrai dans les neuf thèmes, quel que
    soit le parti pris de chacun. */
 for (const t of THEMES){
   const v = await pg.evaluate(async th => {
     S.theme = th; applyTheme();
     const [a, b] = S.patients;
     a.visits = [{ uid:"t1", date:workDate(), at:"08:00", slot:null,
                   soins:["Toilette"], consts:{}, note:"" }];
     if (b) b.visits = [];
     render();
     await new Promise(r => setTimeout(r, 120));
     const lire = el => { const s = getComputedStyle(el);
       return { op:parseFloat(s.opacity), fond:s.backgroundColor }; };
     const vue = document.querySelector('.pcard.seen');
     const voir = document.querySelector('.pcard:not(.seen):not(.absent):not(.novisit)');
     return { vue: vue?lire(vue):null, voir: voir?lire(voir):null };
   }, t);
   if (!v.vue || !v.voir){ ok(`${t.padEnd(8)} deux cartes à comparer`, false); continue; }
   const ev = v.vue.op * alpha(v.vue.fond), eo = v.voir.op * alpha(v.voir.fond);
   ok(`${t.padEnd(8)} « vue » aussi opaque qu « à voir »`,
      Math.abs(ev - eo) < 0.01, `${Math.round(ev*100)} % contre ${Math.round(eo*100)} %`);
 }

 /* ⚠️ ET SUR RÉUNION, LE SEUIL VAUT. C'est le seul thème dont le fond
    est une IMAGE — montagne, mer, soleil — et pas une couleur unie :
    là, tout ce qui passe au travers devient un motif sous le texte. */
 const reu = await pg.evaluate(async () => {
   S.theme = "reunion"; applyTheme(); render();
   await new Promise(r => setTimeout(r, 120));
   const c = document.querySelector('.pcard.seen') || document.querySelector('.pcard');
   const s = getComputedStyle(c);
   return { op:parseFloat(s.opacity), fond:s.backgroundColor };
 });
 ok(`reunion  fond opaque à ${Math.round(reu.op*alpha(reu.fond)*100)} % (image derrière)`,
    reu.op * alpha(reu.fond) >= 0.85, `${reu.op} × ${alpha(reu.fond)}`);

 /* ⚠️ ET LA PASTILLE DE STATUT NE S'ESTOMPE PAS. Un réglage d'affichage
    ne doit jamais atténuer un signal d'état — même règle que le listing. */
 const past = await pg.evaluate(() => {
   S.theme = "reunion"; applyTheme(); render();
   const st = document.querySelector('.pcard.seen > .st');
   return st ? parseFloat(getComputedStyle(st).opacity) : null;
 });
 ok('la pastille de statut reste à pleine opacité', past === 1, past);

 /* ⚠️ UNE CARTE DÉPLIÉE DÉPASSE 1 700 px DE HAUT. Un `backdrop-filter`
    sur un élément de cette taille n'est pas composité en entier par
    WebKit : au-delà, le voile disparaît et le décor revient à pleine
    force. C'est le second défaut de sa capture — haut de carte opaque,
    reste transparent. Un flou n'a rien à faire derrière un formulaire. */
 const dep = await pg.evaluate(async () => {
   S.theme = "reunion"; applyTheme(); render();
   const b = document.querySelector('.pcard [data-toggle]');
   if (b) b.click();
   await new Promise(r => setTimeout(r, 300));
   const c = document.querySelector('.pcard.open');
   if (!c) return null;
   const s = getComputedStyle(c);
   return { h:Math.round(c.getBoundingClientRect().height),
            flou:s.backdropFilter || s.webkitBackdropFilter,
            fond:s.backgroundColor, op:parseFloat(s.opacity) };
 });
 ok('la carte dépliée est bien haute (c est tout le sujet)', dep && dep.h > 600, dep && dep.h);
 ok('elle ne porte plus de flou', dep && (dep.flou === 'none' || !dep.flou), dep && dep.flou);
 ok('et son fond est totalement opaque', dep && alpha(dep.fond) === 1 && dep.op === 1,
    dep && (dep.fond + ' op=' + dep.op));

 /* ══ AUCUN CONTOUR BARIOLÉ ══
    ⚠️ DÉFAUT RÉEL, SIGNALÉ EN PHOTO. Le fini Relief donne quatre couleurs
    de bordure — claire en haut, claire à gauche, sombre ailleurs — pour
    simuler le volume. Sur un contour plein elles se fondent ; sur un
    contour EN POINTILLÉS chaque tiret prend la couleur de son côté, et
    la pastille « 🚫 Aucune » sortait blanche en haut, noire en bas.

    ⚠️ ON BALAIE L'APP, ON NE LISTE PAS. Le fini Relief s'était déjà fait
    avoir par une liste de classes écrite à la main : « tout élément hors
    de la liste restait plat sans que rien ne le signale ». Le même piège
    vaut ici. Ce contrôle part donc de TOUS les éléments de l'écran et
    retient ceux qui sont en pointillés sur plusieurs côtés avec des
    couleurs différentes — il trouvera les oublis de demain. */
 console.log('\n═══ AUCUN CONTOUR BARIOLÉ ═══');
 const bariole = () => pg.evaluate(() => {
   const out = [];
   document.querySelectorAll('*').forEach(e => {
     const s = getComputedStyle(e);
     const st = [s.borderTopStyle, s.borderRightStyle, s.borderBottomStyle, s.borderLeftStyle];
     if (!st.includes('dashed') && !st.includes('dotted')) return;
     const r = e.getBoundingClientRect();
     if (r.width < 8 || r.height < 8) return;          // invisible : sans objet
     const co = [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor];
     const i = [0,1,2,3].filter(k => st[k] === 'dashed' || st[k] === 'dotted');
     /* Un seul côté en pointillés (un liseré de statut) ne peut pas être
        bariolé : il n'a qu'une couleur par construction. */
     if (i.length < 2) return;
     if (new Set(i.map(k => co[k])).size > 1)
       out.push(e.tagName.toLowerCase() + '.' + String(e.className||'').trim().split(/\s+/).join('.')
                + ' « ' + (e.textContent||'').trim().slice(0,22) + ' »');
   });
   return [...new Set(out)];
 });

 /* Les deux finis en relief sont les seuls concernés : eux seuls
    colorent les côtés séparément. */
 for (const fi of ['relief','grave','plat']){
   for (const th of ['reunion','hopital','papier']){
     await pg.evaluate(([f, t]) => { S.fini = f; S.theme = t; applyTheme();
       const p = S.patients[0];
       /* On force un dossier « absent » et on déplie une carte : c'est là
          que vivent les contours en pointillés. */
       S.rappels = (S.rappels||[]).filter(r => r.type !== 'absence');
       S.rappels.push({ id:'ab1', type:'absence', pid:p.id, due:workDate(), done:false });
       render();
       const b = document.querySelector('.pcard [data-toggle]'); if (b) b.click();
     }, [fi, th]);
     await pg.waitForTimeout(350);
     const r = await bariole();
     ok(`${fi.padEnd(6)} / ${th.padEnd(8)} aucun contour bariolé`, r.length === 0,
        r.slice(0,3).join(' | '));
   }
 }

 /* ══ UNE PASTILLE COCHÉE SE LIT ══
    ⚠️ DÉFAUT MESURÉ, SIGNALÉ EN PHOTO : `.chip.on` portait
    `color:var(--accent)` sur `background:var(--accent-soft)` — le même
    accent, à 13 %. Texte et fond de la MÊME couleur, contraste **1,00**.
    Seul le voile noir du fini Relief creusait un écart, et il ne
    suffisait pas sur le thème Réunion en scène « jour ».

    ⚠️ ON MESURE LES DEUX SCÈNES SUR RÉUNION. Une piste écartée en cours
    de route gardait un fond teinté : 8,90 de jour, **1,34** le soir —
    `--accent-soft` est semi-transparent et laisse passer le décor. Une
    mesure sur une seule scène aurait fait retenir cette piste-là. */
 console.log('\n═══ UNE PASTILLE COCHÉE SE LIT ═══');
 await pg.evaluate(() => {
   const p = S.patients[0];
   p.plan = ["Évaluation douleur", "Change de protection"]; p.visits = [];
   S.curTour = S.tours[0]; render();
   const b = document.querySelector('.pcard [data-toggle]'); if (b) b.click();
 });
 await pg.waitForTimeout(500);
 await pg.evaluate(() => { const c = document.querySelector('#board .inline .chip[data-s]');
   if (c) c.click(); });
 await pg.waitForTimeout(300);

 for (const th of THEMES){
   const v = await pg.evaluate(t => {
     S.theme = t; applyTheme();
     const el = document.querySelector('#board .inline .chip.on');
     if (!el) return null;
     const s = getComputedStyle(el);
     const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
     /* ⚠️ `--surface` peut être SEMI-TRANSPARENT : on le compose sur ce
        qu'il y a derrière avant de mesurer, sinon on mesure une couleur
        que personne ne voit. */
     const comp = (fond, der) => {
       const m = String(fond).match(/[\d.]+/g).map(Number);
       const a = m.length > 3 ? m[3] : 1;
       const d = String(der).startsWith('#')
         ? [1,3,5].map(i => parseInt(der.slice(i, i+2), 16))
         : String(der).match(/[\d.]+/g).map(Number);
       return `rgb(${[0,1,2].map(i => Math.round(a*m[i] + (1-a)*d[i])).join(',')})`;
     };
     /* Réunion a un DÉCOR, pas une couleur : on prend le pire des deux
        scènes, le ciel clair et le coucher de soleil. */
     const scenes = (t === 'reunion') ? ['rgb(159,216,242)','rgb(32,49,66)'] : [bg];
     return { c: Math.min(...scenes.map(sc => ctr(s.color, comp(s.backgroundColor, sc)))),
              bord: parseFloat(s.borderTopWidth),
              h: Math.round(el.getBoundingClientRect().height) };
   }, th);
   if (!v){ ok(`${th.padEnd(8)} pastille cochée introuvable`, false); continue; }
   ok(`${th.padEnd(8)} pastille cochée : contraste ${v.c.toFixed(2)}`, v.c >= 4.5, v.c);
 }

 /* ⚠️ LE LISERÉ NE DOIT PAS DÉFORMER LA LISTE. Il est tracé vers
    l'intérieur : une pastille cochée fait la même hauteur qu'une non
    cochée. Mesuré à 44 px pour les quatre épaisseurs essayées — si un
    jour quelqu'un le passe en `outline` ou ajoute une marge, la liste
    sauterait d'une ligne à chaque case cochée. */
 const geo = await pg.evaluate(() => {
   S.theme = "reunion"; applyTheme();
   const on = document.querySelector('#board .inline .chip.on');
   const off = document.querySelector('#board .inline .chip:not(.on)');
   if (!on || !off) return null;
   return { on:Math.round(on.getBoundingClientRect().height),
            off:Math.round(off.getBoundingClientRect().height),
            bord:parseFloat(getComputedStyle(on).borderTopWidth) };
 });
 ok('le liseré fait bien 4 px', geo && geo.bord === 4, geo && geo.bord);
 ok('et il ne change pas la hauteur de la pastille',
    geo && geo.on === geo.off, geo && (geo.on + ' contre ' + geo.off));

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
