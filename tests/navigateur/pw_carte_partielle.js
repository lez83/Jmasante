/* ══════════════════════════════════════════════════════════════
   LE DESSIN PARTIEL D'UNE CARTE                      (v1.32.0)
   ─────────────────────────────────────────────────────────────
   Ouvrir UNE carte détruisait et refabriquait LES QUARANTE.
   Mesuré, 40 patients, processeur ralenti six fois : zéro carte
   conservée, 31 ms de fabrication, 117 ms de mise en page.

   ⚠️ CE QUE CETTE ÉPREUVE GARDE N'EST PAS LA VITESSE, C'EST
   L'ÉGALITÉ. Un dessin partiel qui irait vite en oubliant un coin
   de l'écran serait bien pire que le dessin complet qu'il remplace.
   Elle compare donc, caractère par caractère, le plateau obtenu en
   ouvrant une carte par le chemin PARTIEL et celui obtenu par le
   chemin COMPLET, sur huit patients, plus la fermeture.

   ⚠️ ELLE A DÉJÀ ATTRAPÉ QUELQUE CHOSE, et c'était elle qui se
   trompait : elle lisait le chemin complet après une image d'écran
   et le partiel aussitôt. `bindInline` pose sa classe un instant
   plus tard — huit comparaisons tombaient sur ce seul décalage.
   On attend donc la même chose des deux côtés.

   ⚠️ ET LE GAIN EST MODESTE, 140 ms → 121 ms, parce que le coût
   n'est PAS dans les trente-neuf autres cartes : il est dans la
   mise en page de la carte ouverte elle-même — 1 881 px, 14 champs.
   La note d'audit qui annonçait « 200 ms → moins de 40 ms en ne
   reconstruisant plus le plateau » reposait sur un modèle faux.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(R,u); if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>srv.listen(8233,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,90)));
 await pg.goto('http://localhost:8233/index.html'); await pg.waitForTimeout(2700);
 await pg.evaluate(()=>{ S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;
   const src=JSON.parse(JSON.stringify(S.patients[0]));
   while(S.patients.length<24){const p=JSON.parse(JSON.stringify(src));p.id="x"+S.patients.length;p.nom="Demo-P"+S.patients.length;S.patients.push(p);}
   save(true); openId=null; render(); });
 const r=await pg.evaluate(async()=>{
   const L=[]; const board=()=>document.getElementById('board').innerHTML;
   const ids=[...document.querySelectorAll('#board [data-toggle]')].map(b=>b.dataset.toggle);
   let ecarts=0, essais=0;
   for (const cle of ids.slice(0,8)){
     // chemin PARTIEL
     openId=null; render(); await new Promise(r=>requestAnimationFrame(r));
     const avant=openId; openId=cle;
     const ok=renderCartesOuverture([avant,openId]); bindBoard();
     /* ⚠️ ON ATTEND LA MÊME CHOSE DES DEUX CÔTÉS. Le chemin complet était
        lu après une image d'écran, le partiel aussitôt : `bindInline`
        pose sa classe un instant plus tard, et les huit comparaisons
        tombaient sur ce seul décalage. */
     await new Promise(r=>requestAnimationFrame(r));
     const partiel=board();
     // chemin COMPLET, même état
     openId=cle; render(); await new Promise(r=>requestAnimationFrame(r));
     const complet=board();
     essais++;
     if (!ok) { ecarts++; L.push("  ⚠ "+cle+" : le dessin partiel a renoncé"); }
     else if (partiel!==complet){ ecarts++;
       let i=0; while(i<partiel.length && partiel[i]===complet[i]) i++;
       L.push("  ⚠ "+cle+" : écart au caractère "+i+" — partiel «"+partiel.slice(i,i+60)+"» / complet «"+complet.slice(i,i+60)+"»"); }
   }
   L.unshift("ouvertures comparées : "+essais+" — écarts : "+ecarts);
   // et la fermeture
   openId=ids[2]; render(); await new Promise(r=>requestAnimationFrame(r));
   const av=openId; openId=null;
   const ok2=renderCartesOuverture([av,null]); bindBoard();
   await new Promise(r=>requestAnimationFrame(r));
   const p2=board(); openId=null; render();
   await new Promise(r=>requestAnimationFrame(r));
   const c2=board();
   L.push("fermeture : partiel "+(ok2?"fait":"renoncé")+", identique au complet : "+(p2===c2));
   return L;
 });
 r.forEach(l=>console.log("   "+l));
 let ko=0;
 const vrai=(c,q,d)=>{ if(c) console.log("  ✓ "+q); else { ko++; console.log("  ✗ "+q+(d!==undefined?"  → "+d:"")); } };
 const tete2 = r[0]||"";
 const ecarts = Number((tete2.match(/écarts : (\d+)/)||[])[1]);
 const essais = Number((tete2.match(/comparées : (\d+)/)||[])[1]);
 const ferm = r.find(x=>x.indexOf("fermeture")>=0)||"";
 console.log("");
 vrai(essais>=8, "huit ouvertures au moins sont comparées", essais);
 vrai(ecarts===0, "le dessin partiel donne le MÊME plateau que le complet", ecarts);
 vrai(/partiel fait/.test(ferm), "la fermeture passe aussi par le dessin partiel", ferm);
 vrai(/identique au complet : true/.test(ferm), "et elle donne le même plateau", ferm);
 vrai(errs.length===0, "aucune erreur JS", errs[0]);
 console.log("\n>>> "+(5-ko)+"/5 vérifications\n");
 await nav.close(); srv.close(); process.exit(ko ? 1 : 0);
})();
