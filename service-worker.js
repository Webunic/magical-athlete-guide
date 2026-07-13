const CACHE='magical-athlete-companion-v1.1.0';
const SPRITE_PARTS=Array.from({length:15},(_,index)=>`./assets/sprite-v11-${String(index+1).padStart(2,'0')}.txt`);
const ASSETS=['./','./index.html','./styles.css','./app.js','./cards.json','./manifest.webmanifest',...SPRITE_PARTS];

self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())
));

self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html')))
  );
});
