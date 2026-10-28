/* ══════════════════════════════════════════════════════════════
   LES POINTS D'ATTENTION, ET LA BANDE DES SELLES      (v1.36.0)
   ─────────────────────────────────────────────────────────────
   Deux demandes nées de l'usage, et une mesure faite sur un vrai
   dossier avant de coder.

   ① L'HISTORIQUE. « Je veux que pour chaque jour pour lequel il y a un
   commentaire ou quelque chose de particulier, et pas uniquement le
   plan de soins respecté, il y ait une forme de surbrillance. »

   ⚠️ LA CAPTURE A MONTRÉ PLUS GROS QUE LA DEMANDE. Sur un dossier réel,
   chaque passage portait quatre lignes de soins identiques matin et
   soir — « Observance / Tolérance ttt, Dossier de soins /
   Transmissions, Bas / Bandes de contention, Pansement simple » — plus
   la phrase « Soins conformes au plan habituel. » affichée dans le même
   style qu'une vraie transmission. Or cette phrase est ÉCRITE PAR
   L'APPLICATION : `NOTE_AUTO` l'écarte déjà de la relève. Une
   surbrillance posée là-dessus aurait éclairé un mur.

   ⚠️ CE QUE L'ÉPREUVE GARDE :
   • le texte automatique ne s'affiche plus comme une note ;
   • les soins du plan se replient, et se REDÉPLIENT — rien n'est caché
     sans porte de retour ;
   • la règle d'allumage est celle de la relève, pas une deuxième ;
   • l'alerte de seuil passe devant : un passage qui a une note ET une
     TA élevée se lit ROUGE. Un réglage d'affichage ne doit jamais
     affaiblir une alerte.

   ② LA BANDE DES SELLES, dans les courbes. Ce n'est pas une courbe :
   relier deux relevés inventerait les jours entre eux, « 0 » (relevé
   fait, rien ce jour-là) n'est pas l'absence de relevé, et la diarrhée
   est un état, pas un degré de plus sur l'axe.

   ⚠️ LE CONTRÔLE QUI COMPTE : un jour non renseigné ne doit JAMAIS se
   lire comme un 0. Tout le compteur de jours sans selle repose sur
   cette distinction, et c'est la seule chose qu'une courbe aurait
   rendue impossible à montrer.
══════════════════════════════════════════════════════════════ */
const { chromium } = require('playwright');
const http=require('http'),fs=require('fs'),path=require('path');
const R='/home/claude/jmsante/www';
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u==='/')u='/index.html';
 const f=path.join(R,u); if(!f.startsWith(R)||!fs.existsSync(f)||fs.statSync(f).isDirectory()){r.writeHead(404);r.end('404');return;}
 r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream'});r.end(fs.readFileSync(f));});
(async()=>{
 await new Promise(r=>srv.listen(8238,r));
 const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
 const ctx=await nav.newContext({viewport:{width:430,height:950}});
 const pg=await ctx.newPage();
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e).slice(0,140)));
 await pg.goto('http://localhost:8238/index.html'); await pg.waitForTimeout(2700);

 const r = await pg.evaluate(async()=>{
  const L=[]; const ok=(n,c,d)=>L.push([c?'OK':'ÉCHEC',n,c?'':(d||'')]);
  const dort = ms => new Promise(r=>setTimeout(r,ms));
  const requis = ['histPoints','sheetHist','sellesBandeHtml','sellesJours','sellesParJour',
                  'sellesALire','joursSansSelle','noteUtile','comRemonte','alertes'];
  const manque = requis.filter(n => typeof window[n] !== 'function');
  ok('les fonctions des deux lots existent', manque.length===0, 'manquent : '+manque.join(', '));
  if (manque.length) return {L};

  S.confidentialityAck=true;S.firstRun=false;S.essaisDeverrouille=true;
  const p = S.patients[0];
  const PLAN = ["Observance / Tolérance ttt","Dossier de soins / Transmissions",
                "Bas / Bandes de contention","Pansement simple"];
  p.plan = PLAN.slice();
  const j = n => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); };
  p.visits = [];
  for (let k=0;k<6;k++){
    p.visits.push({ uid:"m"+k, date:j(k), at:"07:00", soins:PLAN.slice(),
      consts:{ta:"13/8",puls:"75"}, note:"Soins conformes au plan habituel." });
  }
  const V = u => p.visits.find(x=>x.uid===u);
  V("m1").note = "Sa fille la trouve changée depuis dimanche.";          // note vraie
  V("m2").soins = PLAN.concat(["Prise de sang"]);                        // hors plan
  V("m3").consts = { ta:"17/10", puls:"96" };                            // alerte de seuil
  V("m3").note = "Sa fille la trouve changée.";                          // ET une note
  V("m4").soinNotes = { "Pansement simple":"rougeur en bordure" };
  V("m4").soinNotesRel = { "Pansement simple": false };                  // gardé pour soi
  V("m5").soinNotes = { "Pansement simple":"cicatrisation nette" };
  V("m5").soinNotesRel = { "Pansement simple": true };                   // remonte
  save(true);

  // ── ① LA RÈGLE
  ok('plan tenu + texte auto : rien ne s’allume', histPoints(p, V("m0")).niveau === null,
     JSON.stringify(histPoints(p, V("m0")).motifs));
  ok('une vraie note allume en vert', histPoints(p, V("m1")).niveau === 'attention');
  ok('un soin hors plan allume en vert', histPoints(p, V("m2")).niveau === 'attention'
     && histPoints(p, V("m2")).motifs.some(m => /hors plan/.test(m.txt)));
  /* ⚠️ LE CONTRÔLE QUI PROTÈGE L'ALERTE. */
  ok('une alerte ET une note se lisent ROUGE', histPoints(p, V("m3")).niveau === 'alerte',
     histPoints(p, V("m3")).niveau);
  ok('un commentaire décoché s’allume en « note perso »',
     histPoints(p, V("m4")).motifs.some(m => m.txt === 'note perso'));
  ok('un commentaire coché s’allume en « transmission »',
     histPoints(p, V("m5")).motifs.some(m => m.txt === 'transmission'));
  ok('la règle s’appuie sur noteUtile, pas sur une copie',
     noteUtile("Soins conformes au plan habituel.") === false && noteUtile("Sa fille...") === true);

  // ── ① L'ÉCRAN
  _histFiltre = { mode:"tout", du:"", au:"", mot:"" };
  sheetHist(p.id); await dort(260);
  const corps = () => document.getElementById('sheet').innerHTML;
  ok('le texte automatique n’est plus affiché',
     !/Soins conformes au plan habituel/.test(corps()));
  ok('les soins du plan sont repliés',
     /Plan habituel · 4 soins/.test(corps()) && !/Observance \/ Tolérance ttt, Dossier/.test(corps()));
  ok('le soin hors plan reste visible', /\+ Prise de sang/.test(corps()));
  ok('la vraie transmission est là', /Sa fille la trouve changée/.test(corps()));
  const nAtt = (corps().match(/class="selv hv-att"/g)||[]).length;
  const nAlr = (corps().match(/class="selv hv-alr"/g)||[]).length;
  ok('quatre lignes en vert et une en rouge', nAtt===4 && nAlr===1, nAtt+' vert · '+nAlr+' rouge');
  ok('les pastilles disent pourquoi',
     /hv-p">➕ hors plan/.test(corps()) && /hv-p">📝 note/.test(corps())
     && /hv-pa">⚠ TA élevée/.test(corps()));
  ok('l’en-tête du mois compte les points d’attention', /hm-v">5 à voir/.test(corps()),
     (corps().match(/hm-v">[^<]*/)||['(absent)'])[0]);

  // ── ① LA PORTE DE RETOUR
  const dep = document.querySelector('[data-hsoins]');
  ok('le repli porte un bouton pour redéplier', !!dep);
  if (dep){
    dep.click(); await dort(240);
    ok('redéplier rend la liste entière', /Observance \/ Tolérance ttt, Dossier/.test(corps()));
    const rep = document.querySelector('[data-hsoins]');
    if (rep){ rep.click(); await dort(240);
      ok('et on peut replier à nouveau', /Plan habituel · 4 soins/.test(corps())); }
  }

  // ── ① LE FILTRE
  _histFiltre.mode = "att"; sheetHist(p.id); await dort(260);
  const lignes = (corps().match(/class="selv/g)||[]).length;
  ok('le filtre ne garde que les points d’attention', lignes===5, lignes+' lignes');
  ok('et il le dit', /5 passage\(s\) retenu\(s\) sur 6/.test(corps()),
     (corps().match(/\d+ passage\(s\)[^<]*/)||['?'])[0]);
  _histFiltre.mode = "tout";

  // ── ② LES SELLES
  /* Un trou volontaire : le jour -3 n'est PAS renseigné. */
  [[0,"1"],[1,"0"],[2,"diarrhee"],[4,"0"],[5,"0"],[6,"4"]].forEach(([n,v],i) => {
    p.visits.push({ uid:"sel"+i, date:j(n), at:"08:00", soins:[], consts:{ selles:v }, note:"" });
  });
  save(true);
  const par = sellesParJour(p);
  ok('le trou du jour -3 reste un trou', par[j(3)] === undefined, JSON.stringify(par[j(3)]));
  ok('et le jour -1 vaut bien « 0 »', par[j(1)] === "0");
  ok('il y a des selles à lire', sellesALire(p) === true);

  const jours = sellesJours(p, 6);
  ok('six semaines font 42 jours', jours.length === 42, String(jours.length));
  ok('la bande commence un lundi', new Date(jours[0].iso + "T12:00:00").getDay() === 1);
  ok('et finit un dimanche', new Date(jours[41].iso + "T12:00:00").getDay() === 0);
  const vuJ = x => jours.find(y => y.iso === j(x));
  ok('le jour -3 est null, pas 0', vuJ(3) && vuJ(3).val === null, JSON.stringify(vuJ(3)));
  ok('le jour -1 est "0", pas null', vuJ(1) && vuJ(1).val === "0", JSON.stringify(vuJ(1)));
  ok('les jours à venir sont marqués', jours.some(x => x.futur));

  const h = sellesBandeHtml(p, 6);
  ok('la case non renseignée est en pointillé, pas colorée',
     /sb-c sb-vide/.test(h) && !/sb-vide[^"]*sb-r/.test(h));
  ok('le 0 porte une case pleine de la rampe', /sb-c sb-r1/.test(h));
  ok('la diarrhée sort de la rampe', /sb-c sb-dia/.test(h) && /💧/.test(h));
  ok('la légende nomme chaque état, jamais la couleur seule',
     /0 — rien/.test(h) && /Diarrhée/.test(h) && /non renseigné/.test(h));
  ok('la bande ne conclut pas', /elle n.interprète pas/.test(h)
     && !/constipation/i.test(h) && !/surveiller/i.test(h));
  ok('aucune couleur écrite en dur dans la bande', !/#[0-9a-fA-F]{6}/.test(h));

  // ── ② L'ÉCRAN DES COURBES
  sheetGraphConstantes(p.id); await dort(300);
  const chip = document.querySelector('[data-gk="selles"]');
  ok('la pastille 💩 Selles est là', !!chip);
  if (chip){
    chip.click(); await dort(300);
    ok('elle ouvre la bande, pas une courbe',
       /class="sb"/.test(corps()) && !/<svg[^>]*class="cst/.test(corps()));
    const c = document.querySelector('[data-sellej]');
    ok('les cases sont touchables', !!c);
    if (c){ c.click(); await dort(240);
      ok('une case touchée dit son jour', /class="sb-d"/.test(corps())
         && !/Touche une case/.test(corps())); }
  }
  return {L};
 });

 let ko=0; for(const [v,n,d] of r.L){ if(v!=='OK')ko++; console.log(`${v==='OK'?'  ✓':'  ✗'} ${n}${d?'   ['+d+']':''}`); }
 if(errs.length) console.log('── incidents ──\n'+errs.slice(0,6).join('\n'));
 console.log(`\n${r.L.length-ko}/${r.L.length} contrôles`);
 await nav.close(); srv.close(); process.exit(ko?1:0);
})();
