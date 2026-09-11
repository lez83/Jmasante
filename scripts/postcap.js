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
  @Override
  public void onCreate(Bundle savedInstanceState) {
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

console.log("\nTerminé — enchaîne avec : npx cap sync android");
