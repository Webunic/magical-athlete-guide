const CACHE='magical-athlete-companion-v1.1.0';
const CORE=['./','./index.html','./styles.css','./app.js','./cards.json','./manifest.webmanifest'];
const OPTIONAL=['./assets/sprite-v11.json','./assets/sprite-v11-01.txt','./assets/sprite-1.txt','./assets/sprite-2.txt','./assets/sprite-3.txt','./assets/sprite-4.txt','./assets/sprite-5.txt'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.addAll(CORE);await Promise.allSettled(OPTIONAL.map(asset=>cache.add(asset)));await self.skipWaiting()})));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy))}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(event.request);
    if(cached)return cached;
    if(event.request.mode==='navigate')return caches.match('./index.html');
    return Response.error();
  }));
});
