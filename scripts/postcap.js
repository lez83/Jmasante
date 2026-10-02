#!/usr/bin/env node
/* ============================================================
   postcap.js — à lancer APRÈS `npx cap add android` (CI et local)
   1) Installe le splash jour/nuit (drawable / drawable-night)
   2) Injecte le plugin natif JMSaveFile (MediaStore.Downloads)
      → enregistrement local fiable sur Android 10+ sans permission
   3) Enregistre le plugin dans MainActivity.java
   Usage : node scripts/postcap.js
============================================================ */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ANDROID = path.join(ROOT, "android");
if (!fs.existsSync(ANDROID)) { console.error("✗ Dossier android/ introuvable — lance d'abord : npx cap add android"); process.exit(1); }

/* ── 1. Splash jour/nuit ── */
const RES = path.join(ANDROID, "app/src/main/res");
const cp = (src, dst) => { if (fs.existsSync(src)) { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); console.log("✓ " + path.relative(ROOT, dst)); } };
cp(path.join(ROOT, "resources/splash.png"),      path.join(RES, "drawable/splash.png"));
cp(path.join(ROOT, "resources/splash-dark.png"), path.join(RES, "drawable-night/splash.png"));

/* ── 2. Plugin natif JMSaveFile ── */
const PKG_DIR = path.join(ANDROID, "app/src/main/java/fr/jmsante/app");
fs.mkdirSync(PKG_DIR, { recursive: true });

const PLUGIN_JAVA = `package fr.jmsante.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Enregistrement d'un fichier dans Téléchargements/JMSante via MediaStore (API officielle, sans permission). */
@CapacitorPlugin(name = "JMSaveFile")
public class JMSaveFilePlugin extends Plugin {

  @PluginMethod
  public void save(PluginCall call) {
    String name = call.getString("name", "fichier.txt");
    String data = call.getString("data", "");
    String mime = call.getString("mime", "application/octet-stream");
    boolean isB64 = Boolean.TRUE.equals(call.getBoolean("base64", false));
    try {
      byte[] bytes = isB64 ? Base64.decode(data, Base64.DEFAULT) : data.getBytes("UTF-8");
      JSObject r = new JSObject();
      if (Build.VERSION.SDK_INT >= 29) {
        ContentResolver cr = getContext().getContentResolver();
        ContentValues cv = new ContentValues();
        cv.put(MediaStore.Downloads.DISPLAY_NAME, name);
        cv.put(MediaStore.Downloads.MIME_TYPE, mime);
        cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/JMSante");
        Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
        if (uri == null) { call.reject("MediaStore insert null"); return; }
        try (OutputStream os = cr.openOutputStream(uri)) { os.write(bytes); os.flush(); }
        r.put("path", "Téléchargements/JMSante/" + name);
        r.put("uri", uri.toString());
      } else {
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "JMSante");
        dir.mkdirs();
        File f = new File(dir, name);
        try (FileOutputStream os = new FileOutputStream(f)) { os.write(bytes); os.flush(); }
        r.put("path", f.getAbsolutePath());
      }
      call.resolve(r);
    } catch (Exception e) {
      call.reject("JMSaveFile: " + e.getMessage());
    }
  }
}
`;
fs.writeFileSync(path.join(PKG_DIR, "JMSaveFilePlugin.java"), PLUGIN_JAVA);
console.log("✓ android/app/src/main/java/fr/jmsante/app/JMSaveFilePlugin.java");

/* ── 2 bis. Plugin natif JMKeystore ──
   ⚠️ TROISIÈME PORTE DU COFFRE : la clé de données y est enfermée par
   une clé qui vit dans le MATÉRIEL du téléphone (AndroidKeyStore) et
   qui n'en sort JAMAIS. Une copie brute d'IndexedDB devient inutile :
   la clé n'y est pas, et elle n'est pas extractible.

   ⚠️ L'empreinte est vérifiée côté JavaScript, par le plugin
   biométrique déjà présent, AVANT d'appeler « lire ». On ne lie pas la
   clé matérielle à l'authentification (setUserAuthenticationRequired) :
   Android la détruirait à chaque modification du verrouillage ou des
   empreintes, et l'utilisateur perdrait son raccourci sans comprendre.

   ⚠️ Ce que ça protège : l'extraction des données (sauvegarde ADB,
   téléphone démonté, copie du dossier). Ce que ça ne protège pas : un
   appareil rooté où l'attaquant fait exécuter l'app elle-même. Le code
   reste la porte sûre.
────────────────────────────────────────────────────────────── */
const KS_JAVA = `package fr.jmsante.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Coffre-fort matériel : enferme un secret avec une clé AndroidKeyStore non extractible. */
@CapacitorPlugin(name = "JMKeystore")
public class JMKeystorePlugin extends Plugin {

  private static final String KS = "AndroidKeyStore";
  private static final String ALIAS = "jmsante_coffre";
  private static final String PREFS = "jmsante_ks";

  private SecretKey cleMaterielle(boolean creer) throws Exception {
    KeyStore ks = KeyStore.getInstance(KS);
    ks.load(null);
    if (ks.containsAlias(ALIAS)) {
      return (SecretKey) ks.getKey(ALIAS, null);
    }
    if (!creer) return null;
    KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KS);
    kg.init(new KeyGenParameterSpec.Builder(ALIAS,
        KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build());
    return kg.generateKey();
  }

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  /** Le matériel gère-t-il un coffre-fort ? */
  @PluginMethod
  public void disponible(PluginCall call) {
    JSObject r = new JSObject();
    try { cleMaterielle(true); r.put("ok", true); }
    catch (Exception e) { r.put("ok", false); r.put("raison", String.valueOf(e.getMessage())); }
    call.resolve(r);
  }

  /** Enferme un secret (base64) derrière la clé matérielle. */
  @PluginMethod
  public void ecrire(PluginCall call) {
    String valeur = call.getString("valeur", "");
    try {
      SecretKey k = cleMaterielle(true);
      Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
      c.init(Cipher.ENCRYPT_MODE, k);
      byte[] iv = c.getIV();
      byte[] ct = c.doFinal(valeur.getBytes("UTF-8"));
      prefs().edit()
        .putString("iv", Base64.encodeToString(iv, Base64.NO_WRAP))
        .putString("ct", Base64.encodeToString(ct, Base64.NO_WRAP))
        .apply();
      JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
    } catch (Exception e) { call.reject("ecrire: " + e.getMessage()); }
  }

  /** Rend le secret, ou rien si la clé a été invalidée. */
  @PluginMethod
  public void lire(PluginCall call) {
    try {
      String ivB = prefs().getString("iv", null);
      String ctB = prefs().getString("ct", null);
      JSObject r = new JSObject();
      if (ivB == null || ctB == null) { r.put("vide", true); call.resolve(r); return; }
      SecretKey k = cleMaterielle(false);
      if (k == null) { r.put("vide", true); call.resolve(r); return; }
      Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
      c.init(Cipher.DECRYPT_MODE, k,
             new GCMParameterSpec(128, Base64.decode(ivB, Base64.NO_WRAP)));
      byte[] plain = c.doFinal(Base64.decode(ctB, Base64.NO_WRAP));
      r.put("valeur", new String(plain, "UTF-8"));
      call.resolve(r);
    } catch (Exception e) {
      /* Clé détruite par Android (verrouillage modifié) : ce n'est pas
         une panne, c'est un raccourci à refaire. Le code reste valable. */
      JSObject r = new JSObject(); r.put("vide", true); r.put("invalide", true);
      call.resolve(r);
    }
  }

  /** Oublie le raccourci (l'utilisateur désactive l'empreinte). */
  @PluginMethod
  public void effacer(PluginCall call) {
    try {
      prefs().edit().clear().apply();
      KeyStore ks = KeyStore.getInstance(KS); ks.load(null);
      if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
    } catch (Exception e) { /* rien à faire : l'essentiel est parti */ }
    JSObject r = new JSObject(); r.put("ok", true); call.resolve(r);
  }
}
`;
fs.writeFileSync(path.join(PKG_DIR, "JMKeystorePlugin.java"), KS_JAVA);
console.log("✓ JMKeystorePlugin.java injecté");

/* ── 3. Enregistrement dans MainActivity ── */
const MAIN = path.join(PKG_DIR, "MainActivity.java");
const MAIN_JAVA = `package fr.jmsante.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  /* « Partager vers JM@Santé » arrive en ACTION_SEND, fichier en pièce
     jointe (EXTRA_STREAM). Le greffon App de Capacitor ne transmet à la
     page que les ACTION_VIEW : on convertit, pour qu'un seul chemin
     traite les deux gestes — toucher le fichier, ou le partager. */
  private static android.content.Intent envoiVersVue(android.content.Intent i) {
    if (i != null && android.content.Intent.ACTION_SEND.equals(i.getAction())) {
      android.net.Uri u = i.getParcelableExtra(android.content.Intent.EXTRA_STREAM);
      if (u != null) {
        i.setAction(android.content.Intent.ACTION_VIEW);
        i.setDataAndType(u, i.getType());
      }
    }
    return i;
  }

  @Override
  protected void onNewIntent(android.content.Intent intent) {
    super.onNewIntent(envoiVersVue(intent));
  }

  @Override
  public void onCreate(Bundle savedInstanceState) {
    envoiVersVue(getIntent());   // lancement à froid depuis WhatsApp
    registerPlugin(JMSaveFilePlugin.class);
    registerPlugin(JMKeystorePlugin.class);   // coffre-fort matériel
    super.onCreate(savedInstanceState);

    /* ⚠️ Le WebView refuse getUserMedia tant qu'on n'accorde pas
       explicitement RESOURCE_AUDIO_CAPTURE — même quand la permission
       Android est donnée. C'est pour cela que la note vocale marchait
       en PWA (Chrome gère seul) et pas dans l'app. */
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
        != PackageManager.PERMISSION_GRANTED){
      ActivityCompat.requestPermissions(this,
        new String[]{ Manifest.permission.RECORD_AUDIO,
                      Manifest.permission.MODIFY_AUDIO_SETTINGS }, 4711);
    }

    /* ⚠️ On ÉTEND le client du pont : le remplacer par un neuf
       casserait le choix de fichier, le plein écran et les journaux
       que Capacitor y branche. */
    getBridge().getWebView().setWebChromeClient(
      new com.getcapacitor.BridgeWebChromeClient(getBridge()){
      @Override
      public void onPermissionRequest(final PermissionRequest request){
        runOnUiThread(() -> {
          /* v1.0.58 : la caméra sert à scanner le code d'appairage.
             On n'accorde que ce que la page demande, et seulement si la
             permission Android correspondante est donnée. */
          java.util.List<String> res = java.util.Arrays.asList(request.getResources());
          boolean veutCam = res.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
          boolean veutMic = res.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
          boolean camOk = !veutCam || ContextCompat.checkSelfPermission(
              MainActivity.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
          boolean micOk = !veutMic || ContextCompat.checkSelfPermission(
              MainActivity.this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
          if (camOk && micOk) request.grant(request.getResources());
          else {
            request.deny();
            java.util.List<String> manque = new java.util.ArrayList<>();
            if (!camOk) manque.add(Manifest.permission.CAMERA);
            if (!micOk){ manque.add(Manifest.permission.RECORD_AUDIO);
                         manque.add(Manifest.permission.MODIFY_AUDIO_SETTINGS); }
            ActivityCompat.requestPermissions(MainActivity.this,
              manque.toArray(new String[0]), 4711);
          }
        });
      }
    });

    /* v1.0.62 : zoom natif à deux doigts disponible. Ce n'est qu'une
       POSSIBILITÉ : l'app l'autorise (mode « Natif ») ou le bloque
       (modes « Intelligent » et « Désactivé ») par la balise viewport. */
    android.webkit.WebSettings jmWs = getBridge().getWebView().getSettings();
    jmWs.setSupportZoom(true);
    jmWs.setBuiltInZoomControls(true);
    jmWs.setDisplayZoomControls(false);   // pas de boutons +/− à l'écran
  }
}
`;
fs.writeFileSync(MAIN, MAIN_JAVA);
console.log("✓ MainActivity.java (plugin JMSaveFile enregistré)");
/* ── 4. Permissions du micro ──
   ⚠️ Le WebView refuse getUserMedia sans DEUX permissions : RECORD_AUDIO
   ET MODIFY_AUDIO_SETTINGS. Le greffon de dictée n'ajoute que la
   première — d'où « accès au micro non autorisé » alors que la
   permission Android est bien accordée. En PWA, Chrome gère seul. */
const MANIF = path.join(__dirname, "..", "android", "app", "src", "main", "AndroidManifest.xml");
if (fs.existsSync(MANIF)){
  let m = fs.readFileSync(MANIF, "utf-8");
  const perms = ["android.permission.RECORD_AUDIO",
                 "android.permission.MODIFY_AUDIO_SETTINGS",
                 "android.permission.CAMERA"];   // v1.0.58 : scan du code d'appairage
  let ajout = "";
  perms.forEach(pm => {
    if (!m.includes(pm)) ajout += `    <uses-permission android:name="${pm}" />\n`;
  });
  /* CAMERA ferait croire au Play Store que la caméra est obligatoire :
     on la déclare facultative (le code d'appairage peut aussi se coller). */
  if (!m.includes("android.hardware.camera"))
    ajout += `    <uses-feature android:name="android.hardware.camera" android:required="false" />\n`;
  if (ajout){
    m = m.replace("</manifest>", ajout + "</manifest>");
    fs.writeFileSync(MANIF, m);
    console.log("✓ AndroidManifest.xml — permissions micro ajoutées");
  } else {
    console.log("· AndroidManifest.xml — permissions micro déjà présentes");
  }
} else {
  console.log("⚠ AndroidManifest.xml introuvable — lance d'abord npx cap add android");
}

/* ── 5 bis. Niveau d'API exigé par le Play Store ──
   ⚠️ Capacitor 6 vise l'API 34. Depuis le 31 août 2026, Google refuse
   toute soumission — nouvelle application comme mise à jour — qui ne
   vise pas l'API 36. On force donc les valeurs ici, puisque le dossier
   android/ est régénéré à chaque compilation.

   ⚠️ Viser l'API 36 change des comportements : affichage bord à bord
   imposé, retour prédictif, orientation non verrouillable sur grand
   écran. À vérifier sur appareil, pas seulement à la compilation.
────────────────────────────────────────────────────────────── */
{
  const vars = path.join(ANDROID, "variables.gradle");
  if (fs.existsSync(vars)){
    let v = fs.readFileSync(vars, "utf8");
    const av = v;
    v = v.replace(/compileSdkVersion\s*=\s*\d+/, "compileSdkVersion = 36")
         .replace(/targetSdkVersion\s*=\s*\d+/,  "targetSdkVersion = 36");
    if (v !== av){ fs.writeFileSync(vars, v); console.log("  ✓ compileSdk/targetSdk portés à 36 (exigence Play Store)"); }
  } else {
    console.log("  ⚠ variables.gradle introuvable — niveau d'API non forcé");
  }
}

/* ── 6. Signature de release ──
   ⚠️ Le dossier android/ est RECRÉÉ à chaque compilation par
   « npx cap add android » : une configuration posée à la main y serait
   perdue. On l'injecte donc ici, à chaque fois.

   ⚠️ Les mots de passe ne sont JAMAIS dans le dépôt : Gradle les lit
   dans les variables d'environnement, que le workflow alimente depuis
   les secrets GitHub. Sans ces variables — compilation locale — le bloc
   est ignoré et l'APK reste en debug, ce qui est le comportement voulu.

   ⚠️ En PKCS12 le mot de passe de la clé est celui du fichier : si
   KEY_PASSWORD manque, on retombe sur KEYSTORE_PASSWORD.
────────────────────────────────────────────────────────────── */
{
  const gradle = path.join(ANDROID, "app", "build.gradle");
  if (fs.existsSync(gradle)){
    let g = fs.readFileSync(gradle, "utf8");
    if (!g.includes("JMSANTE_SIGNING")){
      const conf = `
    // JMSANTE_SIGNING — injecté par scripts/postcap.js
    signingConfigs {
        release {
            def ks = System.getenv("KEYSTORE_FILE")
            if (ks != null && !ks.isEmpty() && file(ks).exists()) {
                storeFile file(ks)
                // ⚠️ Variables intermédiaires OBLIGATOIRES : en Groovy,
                // « storePassword (x).replaceAll(...) » se lit comme l'appel
                // storePassword(x) — puis .replaceAll sur son résultat, qui
                // est nul : « Cannot invoke method replaceAll() on null ».
                //
                // ⚠️ Et on nettoie les blancs : un alias copié depuis la
                // sortie de keytool traîne une TABULATION, d'où l'échec
                // « No key with alias '\\tjmsante' found ».
                def jmPwd = (System.getenv("KEYSTORE_PASSWORD") ?: "").replaceAll("[\\r\\n]", "")
                def jmAlias = (System.getenv("KEY_ALIAS") ?: "").trim()
                def jmKeyPwd = ((System.getenv("KEY_PASSWORD") ?: System.getenv("KEYSTORE_PASSWORD")) ?: "").replaceAll("[\\r\\n]", "")
                storePassword jmPwd
                keyAlias jmAlias
                keyPassword jmKeyPwd
            }
        }
    }
`;
      /* Le bloc doit vivre DANS android { … } : on le pose juste après */
      g = g.replace(/android\s*\{/, m => m + conf);
      /* Et le type release doit s'en servir */
      /* ⚠️ Retour à la ligne INDISPENSABLE : si le bloc release tient sur
         une seule ligne, notre instruction se collerait à la suivante —
         deux instructions Groovy sur une ligne, et la compilation casse. */
      g = g.replace(/buildTypes\s*\{\s*release\s*\{/, m =>
        m + `\n            signingConfig signingConfigs.release\n            `);
      fs.writeFileSync(gradle, g);
      console.log("  ✓ signature de release injectée dans app/build.gradle");
    }
  } else {
    console.log("  ⚠ app/build.gradle introuvable — signature non injectée");
  }
}


/* ── 5. « Ouvrir avec JM@Santé » ──
   ⚠️ Un fichier reçu par WhatsApp n'était importable qu'en fouillant les
   dossiers du téléphone. Déclarer ces filtres fait apparaître JM@Santé
   quand on touche le fichier (VIEW) ou qu'on le partage (SEND).
   application/json : synchros et sauvegardes. application/octet-stream :
   repli pour les applis qui ne transmettent pas le type exact — le
   contenu est de toute façon vérifié avant tout import. */
if (fs.existsSync(MANIF)){
  let m = fs.readFileSync(MANIF, "utf-8");
  if (!m.includes("jmsante-ouvrir")){
    const filtres = `
            <!-- jmsante-ouvrir : fichiers de synchro et de sauvegarde -->
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:scheme="content" android:mimeType="application/json" />
                <data android:scheme="content" android:mimeType="application/octet-stream" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.SEND" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/json" />
                <data android:mimeType="application/octet-stream" />
            </intent-filter>
        </activity>`;
    const k = m.indexOf("</activity>");
    if (k > 0){
      m = m.slice(0, k) + filtres.trimStart() + m.slice(k + "</activity>".length);
      fs.writeFileSync(MANIF, m);
      console.log("✓ AndroidManifest.xml — « Ouvrir avec JM@Santé » déclaré");
    } else console.log("⚠ AndroidManifest.xml — activité introuvable, filtres non ajoutés");
  } else console.log("· AndroidManifest.xml — « Ouvrir avec » déjà déclaré");
}

console.log("\nTerminé — enchaîne avec : npx cap sync android");
