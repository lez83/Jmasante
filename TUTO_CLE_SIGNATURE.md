# Tutoriel — la clé de signature, pas à pas

*À faire une seule fois. Ensuite, chaque nouvelle version prend 30 secondes
de préparation en plus.*

---

## Avant de commencer

**1. Sauvegarde tes données.**
Dans l'app : 🦗 → 💾 Mes données → **📤 Partager**. Envoie-toi le fichier par
courriel ou range-le dans ton nuage. Cette manipulation demande une dernière
désinstallation.

**2. Vérifie que Java répond.**
Ouvre PowerShell (touche Windows, tape `powershell`, Entrée) et colle :

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -help
```

Si tu vois une longue liste d'options, c'est bon. Si tu vois une erreur,
dis-le-moi avant d'aller plus loin.

---

## Étape 1 — Créer la clé

Toujours dans PowerShell, colle ces deux lignes **l'une après l'autre** :

```powershell
cd "C:\Users\cavay\Desktop\Jm@sante"
```

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -keystore jmsante-cle.jks -alias jmsante -keyalg RSA -keysize 2048 -validity 10000
```

Il va te poser des questions :

| Question | Quoi répondre |
|---|---|
| *Entrez le mot de passe du fichier de clés* | Choisis-en un et **note-le** |
| *Ressaisissez le nouveau mot de passe* | Le même |
| *Quels sont vos nom et prénom ?* | Jean-Marie Cavayé |
| *Quel est le nom de votre unité organisationnelle ?* | IDEL |
| *Quel est le nom de votre organisation ?* | JM@Santé |
| *Quel est le nom de votre ville ?* | Toulon |
| *Quel est le nom de votre état ?* | Var |
| *Quel est le code pays ?* | FR |
| *Est-ce correct ?* | tape **oui** |

À la fin, un fichier **`jmsante-cle.jks`** est créé dans
`C:\Users\cavay\Desktop\Jm@sante\`.

---

## ⚠️ Étape 2 — Mettre la clé en sécurité

**Ce fichier est irremplaçable.** Si tu le perds :
- plus aucune mise à jour possible sur les téléphones où l'app est installée
- il faudrait tout désinstaller et repartir de zéro
- et plus tard, tu perdrais l'accès à ton app sur le magasin

**Fais-en au moins deux copies :** une clé USB, et ton nuage personnel.
Note aussi le **mot de passe** au même endroit — sans lui, le fichier ne sert
à rien.

---

## Étape 3 — Le fichier de configuration

Dans le dossier `android\` de ta version courante, crée un fichier texte
nommé exactement **`keystore.properties`**.

> Dans l'Explorateur : clic droit → Nouveau → Document texte, puis renomme-le
> `keystore.properties` (attention à supprimer le `.txt` à la fin).

Colle dedans, en remplaçant `TON_MOT_DE_PASSE` par le tien :

```properties
storeFile=C:\\Users\\cavay\\Desktop\\Jm@sante\\jmsante-cle.jks
storePassword=TON_MOT_DE_PASSE
keyAlias=jmsante
keyPassword=TON_MOT_DE_PASSE
```

> ⚠️ Les **doubles antislashs** `\\` sont obligatoires dans ce fichier.

---

## Étape 4 — Modifier build.gradle

Ouvre `android\app\build.gradle` avec le Bloc-notes.

**A. Tout en haut du fichier**, avant la ligne `apply plugin` ou `android {`,
ajoute :

```gradle
def keyProps = new Properties()
def keyFile = rootProject.file("keystore.properties")
if (keyFile.exists()) keyProps.load(new FileInputStream(keyFile))
```

**B. Cherche le bloc `android {`.** À l'intérieur, juste après
`namespace` ou `compileSdk`, ajoute :

```gradle
    signingConfigs {
        release {
            if (keyProps['storeFile']) {
                storeFile file(keyProps['storeFile'])
                storePassword keyProps['storePassword']
                keyAlias keyProps['keyAlias']
                keyPassword keyProps['keyPassword']
            }
        }
    }
```

**C. Cherche le bloc `buildTypes {`.** Remplace-le par :

```gradle
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
        debug {
            signingConfig signingConfigs.release
        }
    }
```

> Le `debug` avec la même clé permet aussi les mises à jour pendant tes tests.

**D. Dans le bloc `defaultConfig {`**, vérifie ces deux lignes :

```gradle
        versionCode 78
        versionName "1.0.01"
```

Je te donnerai ces deux nombres à chaque livraison.

---

## Étape 5 — Compiler

```powershell
cd "C:\Users\cavay\Desktop\Jm@sante\V1.0.01\JMSante_v1.0.01\JMSante\android"
```

```powershell
.\gradlew assembleRelease
```

L'APK sort dans :
`android\app\build\outputs\apk\release\app-release.apk`

---

## Étape 6 — Installer

**Cette fois seulement** : désinstalle l'ancienne app du téléphone, puis
installe le nouvel APK. Réimporte ta sauvegarde.

**Toutes les fois suivantes** : installe simplement par-dessus. Tes données
restent.

---

## Les versions suivantes

Pour chaque nouvelle version que je te livre :

1. **Copie** `keystore.properties` de l'ancien dossier `android\` vers le
   nouveau
2. **Refais** les modifications de l'étape 4 dans le nouveau `build.gradle`
   *(ou copie l'ancien fichier si la structure n'a pas changé)*
3. Mets à jour `versionCode` et `versionName` avec ce que je t'aurai donné
4. Compile

> Astuce : garde une copie de ton `build.gradle` modifié quelque part. Tu
> n'auras qu'à le recoller à chaque fois.

---

## Si ça coince

**« keytool n'est pas reconnu »** → JAVA_HOME n'est pas défini. Dis-le-moi.

**« Keystore was tampered with, or password was incorrect »** → le mot de
passe dans `keystore.properties` ne correspond pas.

**« Failed to read key jmsante from store »** → l'alias ne correspond pas.
Il doit être exactement `jmsante`.

**L'installation refuse encore** → vérifie que `versionCode` est bien
supérieur à celui déjà installé.

Dans tous les cas, envoie-moi le message d'erreur et je regarde.
