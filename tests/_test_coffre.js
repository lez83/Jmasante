// Le coffre à trois portes : la clé de chiffrement n'est plus posée à
// côté des données, elle est enfermée par le code, le code de secours,
// et plus tard le coffre-fort Android.
const fs = require('fs');
const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const st = fs.readFileSync(R+'www/js/storage.js','utf-8');
const ini = fs.readFileSync(R+'www/js/init.js','utf-8');
const uik = fs.readFileSync(R+'www/js/uikit.js','utf-8');

console.log('═══ LA CLÉ N EST PLUS POSÉE À CÔTÉ ═══');
// ⚠️ Avant : un secret aléatoire dans IndexedDB, à côté des données.
// Qui accédait au stockage avait la boîte ET la clé.
ck('clé de données jamais écrite en clair', !/_rawSet\(COFFRE,\s*dk\)/.test(st) && /wrapKey/.test(st));
ck('trois portes vers la même clé', /c\.pin = await _fermerPorte/.test(st) && /c\.rec = await _fermerPorte/.test(st));
ck('enfermée par AES-KW', /"AES-KW"/.test(st));
ck('dérivation à 600 000 itérations', /iterations:\s*KDF_ITER/.test(st) && /KDF_ITER\s*=\s*600000/.test(st));
ck('un sel aléatoire par porte', /salt = _b64\(crypto\.getRandomValues/.test(st));
ck('mauvais code : une réponse, pas une erreur', /catch\(e\)\{ return null; \}\s*\/\/ mauvais code/.test(st));
ck('changer de code ne réécrit PAS les données', /coffreChangerCode[\s\S]{0,300}_fermerPorte\(_dk/.test(st));

console.log('\n═══ AMORÇAGE ═══');
// ⚠️ Le code PIN vit DANS l'état chiffré : sans cette bascule, l'app se
// croyait neuve au démarrage et rechargeait la démo PAR-DESSUS les données.
ck('le verrou passe AVANT la lecture de l état', ini.indexOf('coffreExiste') < ini.indexOf('loaded = await idbGet("state")'));
ck('un état illisible ne déclenche jamais la démo', /Données illisibles/.test(ini) && /if \(!loaded && typeof coffreExiste/.test(ini));
// ⚠️ showLock s'exécute quand S est encore nul : toute lecture de S doit être défensive.
ck('l écran de verrouillage supporte S nul', /_coffreBio \|\| !!\(S && S\.bioLock\)/.test(st));
ck('la longueur du code vit dans le coffre', /c = \{ v:3, len:/.test(st) && /_coffreLen \|\| \(S && S\.pinLen\)/.test(st));
ck('c est l ouverture du coffre qui valide le code', /ok = !!\(await coffreOuvrir\(code, "pin"\)\)/.test(st));
ck('pas de double demande de code au démarrage', /S\.pin && !\(typeof cleOuverte === "function" && cleOuverte\(\)\)/.test(ini));

console.log('\n═══ MIGRATION ═══');
ck('les blocs portent leur génération', /out\.k = dk \? 3 : \(k2 \? 2 : 1\)/.test(st));
ck('lecture possible avec les trois clés', /stored\.k === 3 \? \[cle3/.test(st));
// ⚠️ Tant qu'un bloc dépend de l'ancien secret, l'effacer perdrait tout.
ck('ancien secret effacé SEULEMENT si plus rien n en dépend', /if \(!restes\)\{[\s\S]{0,200}_rawDel\("__secret__"\)/.test(st));
ck('un bloc illisible n est jamais écrasé', /if \(v === null\)\{ restes\+\+; continue; \}/.test(st));

console.log('\n═══ CODE DE SECOURS ═══');
ck('il ouvre la clé, pas seulement l écran', /coffreOuvrir\(normSecours\(saisi\), "rec"\)/.test(uik));
ck('s il n ouvre pas, on n efface rien', /N'efface rien/.test(uik));
ck('sa création pose la seconde porte', /coffreChangerSecours\(normSecours\(code\)\)/.test(uik));

ck('sauvegarde et avertissement avant le pas décisif',
   /avertirAvantCoffre/.test(st) && /définitivement illisibles/.test(st));
ck('« Plus tard » n engage rien', /if \(!suite\)\{ pinBuf = ""/.test(st));


console.log('\n═══ TROISIÈME PORTE : LE COFFRE-FORT DU TÉLÉPHONE ═══');
const pc = fs.readFileSync(R+'scripts/postcap.js','utf-8');
const sh = fs.readFileSync(R+'www/js/sheets.js','utf-8');
ck('plugin natif injecté par postcap', /JMKeystorePlugin\.java/.test(pc) && /AndroidKeyStore/.test(pc));
ck('enregistré dans MainActivity', /registerPlugin\(JMKeystorePlugin\.class\)/.test(pc));
ck('clé matérielle non extractible (AES/GCM du KeyStore)', /KeyGenParameterSpec\.Builder\(ALIAS/.test(pc));
// ⚠️ Pas de setUserAuthenticationRequired : Android détruirait la clé à
// chaque changement de verrouillage. L'empreinte est vérifiée côté JS.
ck('pas de liaison matérielle à l authentification', !/setUserAuthenticationRequired\(true\)/.test(pc));
ck('clé détruite par Android = raccourci à refaire, pas une panne', /r\.put\("invalide", true\)/.test(pc));
ck('activer l empreinte POSE la clé', /coffreFortPoser\(\)/.test(sh) || /coffreFortPoser\(\)/.test(uik));
ck('désactiver l empreinte l efface', /coffreFortOublier/.test(sh));
ck('l empreinte va CHERCHER la clé', /coffreFortReprendre\(\)/.test(st));
// ⚠️ Même piège que la longueur du code : le réglage vit dans l'état chiffré.
ck('le réglage empreinte vit dans le coffre', /_coffreBio/.test(st) && /c\.bio = true/.test(st));
ck('le doigt est proposé même quand S est nul', /const bio = _coffreBio \|\| !!\(S && S\.bioLock\)/.test(st));
ck('retirer le code prévient avant de défaire le coffre', /plus chiffrées/.test(sh));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length ? 1 : 0);
