var CACHE="command-center-v19";
var ASSETS=["/","/index.html","/style.css","/app.js","/core.js","/storage.js","/backup.js","/privacy.js","/exporters.js","/manifest.webmanifest","/icon.svg","/icon-192.png","/icon-512.png","/icon-512-maskable.png","/apple-touch-icon.png"];
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
  var request=e.request;
  if(request.method!=="GET")return;
  var url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  var privateShare=url.searchParams.get("share")==="1";
  e.respondWith(fetch(request).then(function(r){
    if(r&&r.status===200&&!privateShare){
      var copy=r.clone();
      caches.open(CACHE).then(function(c){c.put(request,copy)});
    }
    return r;
  }).catch(function(){
    return caches.match(request).then(function(hit){
      if(hit)return hit;
      if(request.mode==="navigate")return caches.match("/index.html");
      return new Response("",{status:503,statusText:"Offline"});
    });
  }));
});
