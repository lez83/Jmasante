// Le vocal d'un patient : il voyage avec la relève, pas avec les données.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const v  = fs.readFileSync(R+'www/js/vocal.js','utf-8');
const ui = fs.readFileSync(R+'www/js/ui.js','utf-8');
const en = fs.readFileSync(R+'www/js/engine.js','utf-8');
const sh = fs.readFileSync(R+'www/js/share.js','utf-8');
const sy = fs.readFileSync(R+'www/js/sync.js','utf-8');
const bd = fs.readFileSync(R+'build.js','utf-8');

console.log('═══ L ENREGISTREMENT ═══');
// ⚠️ Un vocal de patient précise un point à l'oral, il ne raconte pas le
// passage : 150 s, pas 3 min comme la relève globale.
ck('150 s par patient', /const VOICE_MAX_PAT = 150/.test(v));
ck('plafond paramétrable', /function voiceStart\(onTick, onStop, maxS\)/.test(v)
   && /maxS \|\| VOICE_MAX_S/.test(v));
// ⚠️ Le micro du CLAVIER dicte mieux, et l'ancien bouton occupait la
// place du vrai enregistrement.
ck('plus de micro flottant dans la carte', !/data-mic="1"/.test(ui));
ck('le champ invite au micro du clavier', /dicte avec le micro de ton clavier/.test(ui));
ck('bouton d enregistrement', /data-pvrec/.test(ui) && /data-pvstop/.test(ui));
ck('lecture et suppression', /data-pvplay/.test(ui) && /data-pvdel/.test(ui));

console.log('\n═══ OÙ IL VA, ET OÙ IL NE VA PAS ═══');
// ⚠️ C'est une précision dite au collègue qui lira la relève, pas une
// pièce du dossier.
ck('il part avec la relève', /pFiles\.push\(new File/.test(sh));
ck('et PAS dans la synchro', !/voicePatient|pVoix/.test(sy)
   && /IL VOYAGE AVEC LA RELÈVE, PAS AVEC LES DONNÉES/.test(v));
// ⚠️ Sinon ils s'accumulent sans que personne ne les réécoute.
ck('effacé après envoi', /function pVoixPurgeApresEnvoi/.test(v)
   && /await pVoixPurgeApresEnvoi\(pidsVoix\)/.test(sh));
// ⚠️ Un destinataire qui ne peut pas écouter doit voir qu'un son existe.
ck('mention dans le TEXTE de la relève', /function pVoixMention/.test(v)
   && /_voixParPatient\[p\.id\]/.test(en));
ck('elle part même si les rappels sont masqués',
   /La mention part même si les rappels sont masqués/.test(en));

console.log('\n═══ LE PIÈGE FERMÉ ═══');
// ⚠️ Un commentaire glissé entre `async` et `function` casse le
// chargement, et node --check sur un module ne le voit pas : chaque
// module est volontairement incomplet.
ck('le build refuse un async orphelin', /async\\b\\\\s\*\(\\\\\/\\\\\*/.test(bd)
   || /async\\b/.test(bd.slice(bd.indexOf('PIÈGE RENCONTRÉ TROIS FOIS'))));
ck('et il est expliqué', /PIÈGE RENCONTRÉ TROIS FOIS/.test(bd));
ck('aucun orphelin dans les modules', !/\basync\s*(\/\*|\/\/)/.test(v + ui + en + sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
