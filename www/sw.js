/* ============================================================
   JM@Santé — Service Worker
   Rôle : rendre l'app utilisable HORS LIGNE (essentiel en tournée)
   Stratégie :
     - Fichiers de l'app  → cache d'abord, réseau en secours
     - Mise à jour        → on récupère la nouvelle version en arrière-plan
   Les DONNÉES patients ne passent jamais ici : elles vivent dans
   IndexedDB, jamais dans le cache réseau.
============================================================ */
const CACHE = "jmsante-v37";
const ASSETS = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/libs/jspdf.min.js",
  "./js/libs/pdfjs.js",
  "./js/libs/pdfjs.worker.js",
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

  e.respondWith(
    caches.match(req).then(hit => {
      if (hit){
        // Rafraîchir en arrière-plan pour la prochaine ouverture
        fetch(req).then(res => {
          if (res && res.status === 200)
            caches.open(CACHE).then(c => c.put(req, res.clone())).catch(()=>{});
        }).catch(()=>{});
        return hit;
      }
      return fetch(req)
        .then(res => {
          if (res && res.status === 200 && res.type === "basic")
            caches.open(CACHE).then(c => c.put(req, res.clone())).catch(()=>{});
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
