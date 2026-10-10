// La date qui se lit comme sur la fiche patient, le clavier des numéros,
// et le classeur de traitement qui n'invente aucune posologie.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const g  = fs.readFileSync(R+'www/js/globals.js','utf-8');
const rc = fs.readFileSync(R+'www/js/recueil.js','utf-8');
const tr = fs.readFileSync(R+'www/js/traitement.js','utf-8');

console.log('═══ LA DATE DE NAISSANCE ═══');
ck('un seul passage entre les deux formats', /const jmaDepuisISO/.test(g) && /function isoDepuisJMA/.test(g));
ck('la fiche de recueil affiche JJ/MM/AAAA', /jmaDepuisISO\(p\.dob\),"JJ\/MM\/AAAA"/.test(rc));
ck('clavier numérique pour la saisir', /inputmode="numeric" maxlength="10"/.test(rc));
// ⚠️ Le dossier STOCKE en ISO : tri, âge et synchro en dépendent.
ck('le dossier reste stocké en ISO', /p\.dob = iso/.test(rc));
// ⚠️ Un âge faux sur une ordonnance est pire qu'un champ vide.
ck('une date impossible est refusée, pas enregistrée', /Date non reconnue/.test(rc)
   && /eDob\.value = jmaDepuisISO\(p\.dob\);\s*\n\s*return;/.test(rc));
ck('le 31 février est impossible', /j <= new Date\(a, m, 0\)\.getDate\(\)/.test(g));
ck('personne ne naît dans le futur', /a<=newDate\(\)\.getFullYear\(\)/.test(g.replace(/\s/g,'')));

{ // comportement réel des deux conversions
  const bloc = g.slice(g.indexOf('const jmaDepuisISO'), g.indexOf('/* toast('));
  const f = new Function(bloc + '; return { isoDepuisJMA, jmaDepuisISO };')();
  const t = (e, a) => JSON.stringify(f.isoDepuisJMA(e)) === JSON.stringify(a);
  ck('« 01/01/1945 » lu', t('01/01/1945','1945-01-01'));
  ck('« 01011945 » lu d un trait',  t('01011945','1945-01-01'));
  ck('« 1-1-45 » lu',  t('1-1-45','1945-01-01'));
  ck('« 31/02/1990 » refusé', t('31/02/1990',''));
  ck('« 29/02/1900 » refusé (1900 n est pas bissextile)', t('29/02/1900',''));
  ck('une date future refusée', t('01/01/2099',''));
  ck('aller-retour sans perte', f.jmaDepuisISO(f.isoDepuisJMA('07/03/1945')) === '07/03/1945');
}

console.log('\n═══ LE CLAVIER DES NUMÉROS ═══');
ck('les deux numéros du patient', (rc.match(/TEL_ATTRS/g)||[]).length >= 3);
// ⚠️ type="tel" et non type="number" : un numéro n'est pas une quantité.
ck('type tel, pas number', /type="tel" inputmode="tel"/.test(rc) && !/TÉLÉPHONE[^`]*type="number"/.test(rc));
ck('la pharmacie aussi', /rc-phtel","TÉL",c\("pharma","tel"\),"",false,TEL_ATTRS/.test(rc));

console.log('\n═══ LE CLASSEUR DE TRAITEMENT ═══');
ck('la norme est écrite dans le module', /LA NORME — premier onglet/.test(tr));
ck('en-têtes reconnus, où qu ils soient', /TRAIT_XLS_COLS/.test(tr) && /if \(rx\.test\(n\) && col\[cle\] == null\) col\[cle\] = i/.test(tr));
ck('un onglet venu d ailleurs est accepté', /wb\.getWorksheet\("Traitement"\) \|\| wb\.worksheets\[0\]/.test(tr));
ck('les colonnes de moment l emportent sur la fréquence', /aDesColonnes/.test(tr));
// ⚠️ LE POINT CENTRAL : l'application ne devine JAMAIS une posologie.
ck('aucune posologie inventée', /ne devine jamais une posologie/.test(tr)
   && /On ne devine PAS une posologie/.test(tr));
ck('ce qui n est pas compris est signalé', /fréquence non comprise/.test(tr));
/* ⚠️ CHANGÉ EN v1.11.0. Jusque-là, « 1 fois par mois » au classeur était
   un « souci » et son texte partait en remarque, la ligne restant sans
   posologie. Le troisième rythme lui donne une case : on vérifie
   maintenant qu'elle y tombe, et que la ligne cesse d'être un souci. */
ck('une fréquence non quotidienne devient un rythme, pas un souci',
   /l\.freq = lire\("freq"\)\.trim\(\)/.test(tr) && /if \(l\.freq\) souci = ""/.test(tr));
ck('et « si besoin » reste prioritaire sur un rythme',
   /if \(l\.sibesoin\)\{ l\.m=l\.mi=l\.s=l\.c=""; delete l\.freq/.test(tr));
ck('rien n entre sans relecture', /Rien n'est encore enregistré/.test(tr));
ck('un médicament déjà au dossier garde son identité', /garde l'identifiant et le prescripteur/.test(tr));
ck('l import n efface jamais', /L'import N'EFFACE JAMAIS/.test(tr));
// ⚠️ Un exemple oublié dans l'onglet de saisie entrerait au dossier.
ck('le modèle vierge ne contient aucun exemple importable', /AUCUN exemple dans cet onglet/.test(tr));
ck('les exemples sont dans le Lisez-moi', /EXEMPLES — à recopier/.test(tr));
/* ⚠️ La liste du classeur était RECOPIÉE À LA MAIN et annonçait cinq
   formes quand l'app en proposait douze. Elle est maintenant construite
   depuis FORMES : on vérifie la construction, pas le texte — un texte
   figé est précisément ce qui avait menti. */
ck('la liste de formes du classeur est construite depuis FORMES',
   /FORMES\.map\(f => f\[2\]\)/.test(tr));
/* ⚠️ Excel coupe sur la virgule : un libellé qui en contient casserait
   la liste déroulante en deux entrées. */
ck('et un libellé à virgule ne peut pas casser la liste',
   /filter\(l => !l\.includes\(","\)\)/.test(tr));
ck('deux boutons sur la fiche', /id="tr-xls-in"/.test(tr) && /id="tr-xls-mod"/.test(tr));
// ⚠️ Sans cette remise à zéro, réimporter deux fois le même fichier ne fait rien.
ck('le même fichier peut être réimporté', /f\.value = ""; f\.click\(\)/.test(tr));

{ // comportement réel de la lecture des fréquences
  const d = tr.indexOf('const _traitSa =');
  const f1 = tr.indexOf("/* ── LE MODÈLE VIERGE ──");
  const f = new Function(tr.slice(d, f1) + '; return traitFreqLire;')();
  const eq = (e, att) => { const r = f(e);
    return ['m','mi','s','c'].every(k => (r[k]||'') === (att[k]||'')) && !!r.sibesoin === !!att.sibesoin && r.lu === att.lu; };
  ck('« 1-0-1-0 » lu',          eq('1-0-1-0', {m:'1',s:'1',lu:true}));
  ck('« 1-0-1 » lu',            eq('1-0-1',   {m:'1',s:'1',lu:true}));
  ck('« 0,5-0-0-1 » lu',        eq('0,5-0-0-1',{m:'0.5',c:'1',lu:true}));
  ck('« 1 matin et 1 soir » lu',eq('1 matin et 1 soir',{m:'1',s:'1',lu:true}));
  ck('« 1 cp matin, midi et soir » lu', eq('1 cp matin, midi et soir',{m:'1',mi:'1',s:'1',lu:true}));
  ck('« si besoin » lu',        eq('si besoin',{sibesoin:true,lu:true}));
  // ⚠️ « 1-1 » : matin-midi ou matin-soir ? On ne tranche pas.
  ck('« 1-1 » refusé, pas deviné',   eq('1-1',  {lu:false}));
  ck('« 3 fois par jour » refusé',   eq('3 fois par jour',{lu:false}));
  ck('« 1x/j » refusé',              eq('1x/j', {lu:false}));

  /* ⚠️ DOUZE FORMES DEPUIS LA v1.11.0. Trois contrôles de cette suite
     gardaient l'inverse — gélule rangée en comprimé, sirop en gouttes,
     pommade dans « Autre » — parce que les cases n'existaient pas. Ils
     disaient vrai pour la v1.10.0 ; ils sont retournés, pas supprimés. */
  const fo = new Function(tr.slice(d, f1) + '; return traitFormeDepuis;')();
  ck('gélule a sa case',             fo('Gélule') === 'gel');
  ck('sous-cutané rangé en injectable', fo('SC') === 'inj');
  ck('sirop a la sienne',            fo('sirop') === 'sir');
  ck('transdermique rangé en patch', fo('Dispositif transdermique') === 'patch');
  ck('une pommade aussi',            fo('pommade') === 'pom');
  ck('un collyre n est plus des gouttes', fo('collyre') === 'col');
  ck('une inhalation n est plus « Autre »', fo('poudre pour inhalation') === 'inh');
  ck('un spray nasal non plus',      fo('spray nasal') === 'spr');
  ck('un suppositoire non plus',     fo('suppositoire') === 'sup');
  /* ⚠️ LE PIÈGE D'ORDRE, trouvé au navigateur : « transdermique »
     contient « dermique », et la pommade l'attrapait. Le contrôle du
     dessus le couvre ; celui-ci dit pourquoi il est là. */
  /* ⚠️ Et ce contrôle-là s'est trompé une première fois : `["pom",`
     apparaît AUSSI dans la déclaration des douze formes, bien avant la
     table de lecture. Il comparait donc deux endroits sans rapport. On
     découpe d'abord la table, puis on y cherche. */
  { const t = tr.slice(tr.indexOf('const TRAIT_FORMES_ALIAS'),
                       tr.indexOf('function traitFormeDepuis'));
    ck('la table de lecture contient bien les deux lignes',
       /\["patch"/.test(t) && /\["pom"/.test(t));
    ck('« patch » y passe AVANT « pommade »', t.indexOf('["patch"') < t.indexOf('["pom"')); }
  ck('un comprimé reste un comprimé', fo('comprimé pelliculé') === 'cp');
  ck('une forme inconnue tombe dans Autre', fo('chose bizarre') === 'aut');
  ck('une forme absente ne vaut rien', fo('') === '');
}

console.log('\n' + (ko.length ? '⚠ ' + ko.length + ' point(s) : ' + ko.join(' · ')
                              : '✓ tout est en place'));
process.exit(ko.length ? 1 : 0);
