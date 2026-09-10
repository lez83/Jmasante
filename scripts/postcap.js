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

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(JMSaveFilePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
`;
fs.writeFileSync(MAIN, MAIN_JAVA);
console.log("✓ MainActivity.java (plugin JMSaveFile enregistré)");
console.log("\nTerminé — enchaîne avec : npx cap sync android");
