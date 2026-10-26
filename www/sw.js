/* ============================================================
   JM@Santé — Service Worker
   Rôle : rendre l'app utilisable HORS LIGNE (essentiel en tournée)
   Stratégie :
     - Fichiers de l'app  → cache d'abord, réseau en secours
     - Mise à jour        → on récupère la nouvelle version en arrière-plan
   Les DONNÉES patients ne passent jamais ici : elles vivent dans
   IndexedDB, jamais dans le cache réseau.
============================================================ */
const CACHE = "jmsante-v1.35.0";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/libs/jspdf.min.js",
  "./js/libs/pdfjs.js",
  "./js/libs/pdfjs.worker.js",
  "./js/libs/qrcode.js",
  "./js/libs/jsQR.js",
  "./fonts/OFL-Comfortaa.txt",
  "./manuel.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/icon-152.png",
  "./icons/icon-167.png",
  "./icons/icon-maskable-512.png"
];

/* Installation : mettre l'app en cache */
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(err => {
        // Un fichier manquant ne doit pas empêcher l'installation
        console.warn("SW: certains fichiers non mis en cache", err);
        return Promise.all(ASSETS.map(u => c.add(u).catch(()=>{})));
      }))
      .then(() => self.skipWaiting())
  );
});

/* Activation : purger les anciens caches */
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Requêtes : cache d'abord (l'app doit marcher sans réseau) */
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Polices Google : les mettre en cache pour rester disponibles hors ligne
  const isFont = /fonts\.(googleapis|gstatic)\.com/.test(url.hostname);
  if (url.origin !== location.origin && !isFont) return;

  /* ⚠️ DÉCLARÉ ICI, PAS DANS `respondWith(…)`. Posé à l'intérieur de
     l'appel, c'était une instruction là où le langage attend une
     expression : sw.js ne se parsait plus, le service worker ne
     s'installait plus du tout, et la page tournait sans lui — plus de
     cache, donc plus de hors ligne. Invisible à la compilation, qui ne
     vérifiait que app.js. C'est le banc d'essai qui l'a dit :
     « NON contrôlée · caches [] ». */
  const cleNue = url.origin === location.origin ? url.origin + url.pathname : req;

  e.respondWith(
    /* ignoreSearch : les ressources portent un marqueur ?v=VERSION pour
       forcer le rafraîchissement après mise à jour. Sans cette option,
       « app.js?v=72 » ne correspondrait pas à « app.js » en cache et
       l'application ne fonctionnerait plus hors ligne.

       ⚠️ C'EST LA LECTURE QUI IGNORE LE MARQUEUR, DONC L'ÉCRITURE DOIT
       L'IGNORER AUSSI. Le rafraîchissement d'arrière-plan rangeait sous
       `req`, marqueur compris : il créait « app.js?v=1.34.0 » À CÔTÉ de
       « app.js », sans jamais le remplacer. Et `caches.match` avec
       ignoreSearch rend la PREMIÈRE entrée trouvée — celle posée à
       l'installation. Le nouveau code était donc bien téléchargé, bien
       rangé, et jamais lu. Mesuré : quatre rechargements après une mise
       à jour, toujours l'ancien code, et trois entrées pour app.js dans
       le cache. On range désormais sous la clé NUE, celle que la
       lecture regarde. */
    caches.match(req, { ignoreSearch:true }).then(hit => {
      if (hit){
        // Rafraîchir en arrière-plan pour la prochaine ouverture
        fetch(req).then(res => {
          if (res && res.status === 200)
            caches.open(CACHE).then(c => c.put(cleNue, res.clone())).catch(()=>{});
        }).catch(()=>{});
        return hit;
      }
      return fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic")
            caches.open(CACHE).then(c => c.put(cleNue, res.clone())).catch(()=>{});
          return res;
        })
        .catch(() => caches.match("./index.html"));   // hors ligne : servir l'app
    })
  );
});

/* Permet à la page de forcer l'activation d'une nouvelle version */
self.addEventListener("message", e => {
  if (e.data === "skipWaiting") self.skipWaiting();
});
