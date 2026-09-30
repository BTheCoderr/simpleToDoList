var CACHE="command-center-v12";
var ASSETS=["/","/index.html","/style.css","/app.js","/core.js","/storage.js","/backup.js","/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png","/icon-512-maskable.png","/apple-touch-icon.png"];
self.addEventListener("install",function(e){
  e.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(ASSETS)}));
});
self.addEventListener("activate",function(e){
  e.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE}).map(function(k){return caches.delete(k)}))})
  ]));
});
self.addEventListener("message",function(e){
  if(e.data&&e.data.type==="SKIP_WAITING")self.skipWaiting();
});
self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET")return;
  e.respondWith(fetch(e.request).then(function(r){
    if(r&&r.status===200){var copy=r.clone();caches.open(CACHE).then(function(c){c.put(e.request,copy)})}
    return r;
  }).catch(function(){
    return caches.match(e.request).then(function(hit){return hit||caches.match("/index.html")});
  }));
});
