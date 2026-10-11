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

 console.log('\n═══ LA CONSOLE ═══');
 ok('aucune erreur de page', errs.length===0, errs.join(' | '));
 console.log('\n'+(ko.length?'⚠ '+ko.length+' point(s) : '+ko.join(' · '):'✓ tout tourne'));
 await nav.close(); srv.close(); process.exit(ko.length?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
