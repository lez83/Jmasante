// Signature de release : injection dans le projet Android régénéré,
// et workflow qui produit un APK signé sans jamais exposer la clé.
const fs=require('fs'), path=require('path');
let ko=[]; const ck=(l,c)=>{ console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const pc = fs.readFileSync('../jmsante/scripts/postcap.js','utf-8');
const wf = fs.readFileSync('../jmsante/.github/workflows/build-android.yml','utf-8');

console.log('═══ INJECTION DANS build.gradle ═══');
// ⚠️ android/ est recréé à chaque compilation : une config posée à la
// main y serait perdue. Elle doit être réinjectée par postcap.
ck('la signature est injectée par postcap', /JMSANTE_SIGNING/.test(pc));
ck('les mots de passe viennent de l environnement',
   /System\.getenv\("KEYSTORE_PASSWORD"\)/.test(pc) && !/storePassword\s+"/.test(pc));
ck('PKCS12 : repli du mot de passe de clé',
   /System\.getenv\("KEY_PASSWORD"\) \?: System\.getenv\("KEYSTORE_PASSWORD"\)/.test(pc));
ck('sans clé, le bloc est inerte', /ks != null && !ks\.isEmpty\(\) && file\(ks\)\.exists\(\)/.test(pc));
ck('le type release s en sert', /signingConfig signingConfigs\.release/.test(pc));
ck('pas de double injection', /if \(!g\.includes\("JMSANTE_SIGNING"\)\)/.test(pc));

// Injection réelle sur un build.gradle de Capacitor
const tmp = '/tmp/_sig_test';
fs.rmSync(tmp, { recursive:true, force:true });
fs.mkdirSync(tmp + '/android/app', { recursive:true });
fs.writeFileSync(tmp + '/android/app/build.gradle',
`apply plugin: 'com.android.application'
android {
    namespace "com.jmsante.app"
    buildTypes {
        release {
            minifyEnabled false
        }
    }
}
`);
const i = pc.indexOf('/* ── 6. Signature de release ──');
const k = pc.indexOf('\n\n', pc.indexOf('console.log("  ⚠ app/build.gradle introuvable', i));
const bloc = pc.slice(i, k);
new Function('fs','path','ANDROID', bloc)(fs, path, tmp + '/android');
const g = fs.readFileSync(tmp + '/android/app/build.gradle','utf-8');
ck('accolades équilibrées après injection', (g.match(/\{/g)||[]).length === (g.match(/\}/g)||[]).length);
ck('signingConfigs à l intérieur de android{}',
   g.indexOf('signingConfigs') > g.indexOf('android {') && g.indexOf('signingConfigs') < g.indexOf('buildTypes'));
new Function('fs','path','ANDROID', bloc)(fs, path, tmp + '/android');
const g2 = fs.readFileSync(tmp + '/android/app/build.gradle','utf-8');
ck('second passage sans doublon', (g2.match(/JMSANTE_SIGNING/g)||[]).length === 1);
fs.rmSync(tmp, { recursive:true, force:true });

// ⚠️ Un alias copié depuis « keytool -list » traîne une TABULATION :
// la compilation échoue sur « No key with alias '\tjmsante' found ».
ck('alias nettoyé de ses blancs', /def jmAlias = \(System\.getenv\("KEY_ALIAS"\) \?: ""\)\.trim\(\)/.test(pc));
// ⚠️ En Groovy, « storePassword (x).replaceAll(...) » se lit comme l'appel
// storePassword(x) PUIS .replaceAll sur son résultat, qui est nul :
// « Cannot invoke method replaceAll() on null object ». D'où les variables.
{ // on ignore les lignes de commentaire, qui citent justement la forme fautive
  const code = pc.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  ck('pas d appel DSL ambigu',
     !/\b(storePassword|keyAlias|keyPassword|storeFile)\s*\([^)]*\)\s*\./.test(code)); }
ck('valeurs passées par variables locales',
   /def jmPwd =/.test(pc) && /storePassword jmPwd/.test(pc) && /keyPassword jmKeyPwd/.test(pc));
ck('mots de passe nettoyés des retours à la ligne', (pc.match(/replaceAll\("\[\\\\r\\\\n\]", ""\)/g)||[]).length >= 2);

// ⚠️ Si le bloc release tient sur une ligne, l'instruction injectée se
// collerait à la suivante : deux instructions Groovy sur une ligne.
{
  const t2 = '/tmp/_sig_test2';
  fs.rmSync(t2, { recursive:true, force:true });
  fs.mkdirSync(t2 + '/android/app', { recursive:true });
  fs.writeFileSync(t2 + '/android/app/build.gradle',
    'android {\n    buildTypes {\n        release { minifyEnabled false }\n    }\n}\n');
  new Function('fs','path','ANDROID', bloc)(fs, path, t2 + '/android');
  const g3 = fs.readFileSync(t2 + '/android/app/build.gradle','utf-8');
  ck('bloc release sur une ligne : instruction isolée',
     /signingConfig signingConfigs\.release\s*\n/.test(g3));
  fs.rmSync(t2, { recursive:true, force:true });
}

console.log('\n═══ WORKFLOW ═══');
ck('compilation en release', /run: \.\/gradlew assembleRelease/.test(wf)
   && !/run: \.\/gradlew assembleDebug/.test(wf));
ck('chemins de sortie mis à jour', /apk\/release\/app-release\.apk/.test(wf) && !/app-debug\.apk/.test(wf));
// ⚠️ Sans clé, assembleRelease sortirait un APK non signé, et l'échec
// n'apparaîtrait qu'au moment de l'installer sur le téléphone.
ck('arrêt net si un secret manque', /Secret\(s\) manquant\(s\)/.test(wf) && /exit 1/.test(wf));
ck('la clé est reconstituée depuis le secret', /base64 -d > android\/jmsante\.p12/.test(wf));
ck('retours à la ligne parasites retirés', wf.includes("tr -d '\\r\\n '"));
ck('signature vérifiée après compilation', /verify --print-certs/.test(wf));
ck('la vérification ne casse jamais la compilation', /Vérifier la signature[\s\S]{0,80}continue-on-error: true/.test(wf));
ck('alerte si l alias contient des blancs', /ANDROID_KEY_ALIAS contient des espaces ou tabulations/.test(wf));
// ⚠️ La clé ne doit pas survivre à la compilation, même en cas d'échec.
ck('clé effacée du runner, même si erreur', /Effacer la clé[\s\S]{0,80}if: always\(\)/.test(wf));
ck('aucun mot de passe en clair dans le dépôt',
   !/storePassword\s+["'][^$]/.test(pc) && !/KEYSTORE_PASSWORD:\s*["'][a-zA-Z0-9]/.test(wf));

console.log('\nERREURS:', ko.length ? ko.join(' · ') : 'aucune');
process.exit(ko.length?1:0);
