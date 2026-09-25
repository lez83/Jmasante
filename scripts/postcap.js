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
          boolean micOk = ContextCompat.checkSelfPermission(
              MainActivity.this, Manifest.permission.RECORD_AUDIO)
              == PackageManager.PERMISSION_GRANTED;
          if (micOk) request.grant(request.getResources());
          else {
            request.deny();
            ActivityCompat.requestPermissions(MainActivity.this,
              new String[]{ Manifest.permission.RECORD_AUDIO,
                            Manifest.permission.MODIFY_AUDIO_SETTINGS }, 4711);
          }
        });
      }
    });
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
                 "android.permission.MODIFY_AUDIO_SETTINGS"];
  let ajout = "";
  perms.forEach(pm => {
    if (!m.includes(pm)) ajout += `    <uses-permission android:name="${pm}" />\n`;
  });
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
                storePassword System.getenv("KEYSTORE_PASSWORD")
                keyAlias System.getenv("KEY_ALIAS")
                keyPassword System.getenv("KEY_PASSWORD") ?: System.getenv("KEYSTORE_PASSWORD")
            }
        }
    }
`;
      /* Le bloc doit vivre DANS android { … } : on le pose juste après */
      g = g.replace(/android\s*\{/, m => m + conf);
      /* Et le type release doit s'en servir */
      g = g.replace(/buildTypes\s*\{\s*release\s*\{/, m =>
        m + `\n            signingConfig signingConfigs.release`);
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
