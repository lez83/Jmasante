// v1.10.0 — alertes vivantes, créneaux par tournée, vue liste,
// archives par cabinet, témoin d'enregistrement, base élargie.
const fs = require('fs'); const R = '../jmsante/';
let ko = []; const ck = (l,c) => { console.log(`  ${c?'✓':'⚠'} ${l}`); if(!c) ko.push(l); };
const lire = f => fs.readFileSync(R + f, 'utf-8');
const base = lire('www/js/medicaments_base.js'), al = lire('www/js/alertes.js');
const gl = lire('www/js/globals.js'), sh = lire('www/js/sheets.js'), ui = lire('www/js/ui.js');
const st = lire('www/js/storage.js'), nv = lire('www/js/nav.js'), css = lire('www/css/app.css');
const sq = lire('www/js/seq.js'), pc = lire('scripts/postcap.js'), bld = lire('build.js');
const { MED_BASE, medTotalBase } = new Function(base + '; return { MED_BASE, medTotalBase };')();
const tous = MED_BASE.flatMap(g => g.items);

console.log('═══ LA BASE ÉLARGIE ═══');
ck('267 molécules', medTotalBase() === 267);
ck('32 associations fixes marquées', tous.filter(m => m.asso).length === 32);
// ⚠️ Les deux noms qui manquaient un matin de tournée.
ck('Coaprovel se trouve', /Coaprovel/.test(base));
ck('Binocrit se trouve', /Binocrit/.test(base));
ck('les associations de cardiologie sont là',
   ['Cotareg','Preterax','Coveram','Lodoz','Exforge','Triplixam'].every(n => new RegExp(n).test(base)));
ck('celles du diabète aussi', ['Janumet','Glucovance','Xigduo','Synjardy'].every(n => new RegExp(n).test(base)));
ck('les biosimilaires injectables', ['Inhixa','Semglee','Amgevita','Benepali','Zarzio'].every(n => new RegExp(n).test(base)));
// ⚠️ Deux corrections de nomenclature vérifiées en source.
// ⚠️ « Cosyrel » est cité VOLONTAIREMENT, comme piège à éviter : on vérifie
//    donc qu'il n'apparaît jamais comme un nom commercial réel.
ck('Cosimprel est donné comme le nom français, Cosyrel seulement comme piège',
   /COSIMPREL/.test(base) && !/c:"[^"]*Cosyrel/.test(base));
ck('ézétimibe+atorvastatine donné sans nom de marque', /Pas de nom de marque en France/.test(base));
// ⚠️ UNE ASSOCIATION EST UNE SEULE LIGNE : le piège de la double posologie.
ck('chaque association le rappelle',
   tous.filter(m => m.asso).filter(m => /UNE seule ligne|une seule ligne|UNE ligne/i.test(m.r || '')).length >= 20);
console.log('\n═══ LA DOCTRINE N A PAS BOUGÉ ═══');
ck('aucune interaction, même dans les nouvelles entrées',
   tous.every(m => !/interaction/i.test([m.i, m.s, m.r].join(' '))));
ck('aucune posologie chiffrée',
   tous.every(m => !/\d+\s*(mg|g|µg|UI)\s*(par jour|\/\s*j|x\s*\d)/i.test([m.i, m.s, m.r].join(' '))));
ck('aucun montant ni code de remboursement',
   tous.every(m => !/€|\beuros?\b|rembours\w*ment de|tarif|\bLPP\b/i.test([m.i, m.s].join(' '))));
ck('le repêchage par mots existe', /IRBESARTAN\/HYDROCHLOROTHIAZIDE|redécoupe alors en mots/.test(lire('www/js/medicaments.js')));
ck('un filtre isole les associations', /id="md-asso"/.test(lire('www/js/medicaments.js')));

console.log('\n═══ LE TÉMOIN D ENREGISTREMENT ═══');
// ⚠️ LE DIAGNOSTIC : le témoin existait, mais `.veil` le recouvrait.
ck('la cause est écrite dans le code', /`\.veil`[\s\S]{0,200}recouvre|voile noir/.test(nv) || /inset:0, z-index:90/.test(nv));
ck('chaque barre de panneau porte le sien', /class="save-badge nav-save"/.test(nv));
ck('les deux témoins se mettent à jour ensemble', /function majBadges/.test(st)
   && /#save-badge, \.nav-save/.test(st));
// ⚠️ L'échec partait dans un journal que personne ne lit.
ck('un échec reste affiché en rouge', /majBadges\("ko"/.test(st) && /\.save-badge\.ko\{/.test(css));
ck('et le dit en clair', /ne ferme pas l'application/.test(st));
ck('« pris en compte » existe et vit sous la SECTION, pas sous chaque champ',
   /function prisEnCompte/.test(gl) && /jamais sous\s*\n?\s*chaque champ/.test(gl));
ck('branché sur le recueil et le traitement',
   /prisEnCompte\("#rc-pec"\)/.test(lire('www/js/recueil.js'))
   && /prisEnCompte\("#tr-pec"\)/.test(lire('www/js/traitement.js')));

console.log('\n═══ LES ALERTES ═══');
ck('une seule mécanique pour les notes et les rappels',
   /alerteBloc\(n, "nal"/.test(lire('www/js/notes.js')) && /alerteBloc\(_ral, "ral"/.test(sh));
// ⚠️ ÉPROUVÉ AU NAVIGATEUR : avec on:true, le premier toucher ÉTEIGNAIT.
ck('une alerte neuve est éteinte', /on:false/.test(al) && /ÉPROUVÉ AU NAVIGATEUR/.test(al));
ck('une alerte éteinte n est pas conservée morte', /function alerteNettoyer/.test(al));
// ⚠️ LE BRANCHEMENT QUI N'AVAIT JAMAIS ÉTÉ INSTALLÉ.
// ⚠️ Le nom `_hookedSave` reste cité dans le commentaire qui l'enterre :
//    on vérifie qu'il n'est plus DÉCLARÉ, pas qu'il n'est plus nommé.
ck('l ancien crochet mort est retiré', !/const _hookedSave/.test(sq)
   && /JAMAIS INSTALLÉ|branchement mort/i.test(sq));
ck('save est RÉELLEMENT remplacé cette fois', /window\.save = function/.test(al));
ck('et temporisé (une saisie enregistre plusieurs fois)', /setTimeout\(\(\) => \{ try \{ alerteProgrammer/.test(al));
ck('un seul programmeur, pas deux concurrents',
   /if \(typeof alerteProgrammer === "function"\) return alerteProgrammer\(\);/.test(sq));
// ⚠️ Sans sonnerie — il l'a demandé explicitement.
ck('canal d importance BASSE, sans son ni vibration',
   /importance: 2/.test(al) && /vibration: false/.test(al));
ck('et la raison est écrite', /chez un patient|sans sonnerie/i.test(al));
// ⚠️ Les permissions manquaient depuis toujours.
ck('POST_NOTIFICATIONS déclarée', /POST_NOTIFICATIONS/.test(pc));
ck('SCHEDULE_EXACT_ALARM aussi', /SCHEDULE_EXACT_ALARM/.test(pc) && /USE_EXACT_ALARM/.test(pc));
ck('le bandeau rattrape ce que la notification rate', /function alertesBandeau/.test(al));
ck('le retard est signalé à part, en rouge', /\.albar\.retard\{/.test(css) && /retard/.test(al));
// ⚠️ « J'ai vu » ne doit pas effacer le travail à faire.
ck('« j ai vu » marque la date, il n efface rien', /n'efface RIEN/.test(al));
ck('la permission est demandée au moment où une alerte est posée',
   /function alerteDemander/.test(al) && /se refuse par réflexe/.test(al));
ck('hors Android, rien n est tenté', /function alerteDispo/.test(al) && /isNativePlatform/.test(al));
ck('le module est dans la compilation', /'notes','alertes','detente'/.test(bld)
   && /'alertes\.js':\s+'function alerteProgrammer'/.test(bld));

console.log('\n═══ LES CRÉNEAUX, TOURNÉE PAR TOURNÉE ═══');
ck('un helper unique', /function slotsOn\(tour\)/.test(gl));
// ⚠️ 30 lectures dans 8 modules : aucune ne doit rester globale.
const modules = ['globals','ui','sheets','seq','engine','features','nav','uikit']
  .map(f => lire('www/js/' + f + '.js'));
const restes = modules.join('\n').split('\n')
  .filter(l => /S\.slotsEnabled/.test(l) && !/^\s*\*|^\s*\/\*|⚠️/.test(l));
ck('aucune lecture globale ne subsiste (sauf la reprise)',
   restes.length === 1 && /S\.slotsTours\[t\] = true/.test(restes[0]));
ck('l ancien réglage est repris sur chaque tournée', /if \(S\.slotsEnabled\) \(S\.tours \|\| \[\]\)\.forEach/.test(gl));
// ⚠️ LE POINT QU'ON REGRETTE QUAND IL EST PRIS À L'ENVERS.
ck('éteindre MASQUE, il n efface pas', /ÉTEINDRE N'EFFACE RIEN/.test(gl)
   && /On ne touche NI à S\.slotMembers NI à S\.slotOrder/.test(sh));
ck('une pastille par ligne de tournée', /data-tslot=/.test(sh));
ck('et le même interrupteur dans l écran de composition', /id="ap-slot-on"/.test(sh));
ck('le bouton global ne fait plus que poser la même valeur partout',
   /ce n'est plus lui\s*\n?\s*qui décide/.test(sh));
ck('la relève regarde le réglage DE SA tournée',
   /slotsOn\(tour\) && \(\(S\.slotOrder/.test(lire('www/js/engine.js')));
ck('pas de créneau en vue « Toutes »', /t === "all" \|\| t === "none"\) return false/.test(gl));

console.log('\n═══ LA VUE LISTE ═══');
ck('un bouton ☰ séparé du 📋', /id="f-liste"/.test(ui) && /id="f-compact"/.test(ui));
ck('pas un troisième état du bouton existant', /UN BOUTON À PART, pas un troisième état/.test(ui));
ck('tri alphabétique avec les lettres en repère', /localeCompare\(b\.nom/.test(ui) && /pl-sep/.test(css));
// ⚠️ LE POINT DÉFENDU CONTRE LA DEMANDE LITTÉRALE.
// ⚠️ La vue a été REFONDUE en v1.11.0 : la pastille ronde est devenue un
//    liseré de statut et le mot « vigilance » une pastille `.pl-m.d`. La
//    règle, elle, n'a pas bougé — c'est elle qu'on vérifie, pas la forme.
ck('la pastille de statut et la vigilance RESTENT',
   /ne doit jamais cacher une alerte/.test(ui)
   && /st === "alert"\s*\)\s*inf\.push/.test(ui));
ck('toucher un nom ramène aux cartes sur ce patient', /openId = b\.dataset\.pli; S\.boardListe = false/.test(ui));
ck('les deux réglages restent indépendants', /restent\s*\n?\s*indépendants/.test(ui));

console.log('\n═══ LES ARCHIVES PAR CABINET ═══');
ck('le cabinet est INSCRIT à la mise de côté', /p\.archCab = \(typeof cabinetArchive/.test(sh));
// ⚠️ « Appartenance initiale » veut dire figée.
ck('et la raison est écrite', /veut dire figée/.test(sh));
ck('les anciens dossiers reçoivent le leur une bonne fois', /if \(fige\) save\(\)/.test(sh));
ck('groupes repliables, comme l annuaire des partenaires', /data-arcg=/.test(sh)
   && /annuaire des partenaires/.test(sh));
ck('un groupe « sans cabinet connu » plutôt que des dossiers perdus', /__sans__/.test(sh));

console.log('\n═══ LES BOÎTES GRISES D ANDROID ═══');
const mods = ['sheets','ui','recueil','sync','menage','notes','traitement','engine','features']
  .map(f => ({ f, s: lire('www/js/' + f + '.js') }));
const reste = mods.filter(m => /(^|[^.\w])confirm\(/.test(m.s.replace(/\/\*[\s\S]*?\*\//g, '')));
ck('plus aucun confirm() natif', reste.length === 0,
   reste.length ? reste.map(m => m.f).join(', ') : '');
ck('les fonctions appelantes sont devenues asynchrones',
   /async function reprendrePEC/.test(sh) && /async function faireLeMenage/.test(lire('www/js/menage.js')));

console.log('\n' + (ko.length ? '⚠ ' + ko.length + ' point(s) : ' + ko.join(' · ')
                              : '✓ tout est en place'));
process.exit(ko.length ? 1 : 0);
