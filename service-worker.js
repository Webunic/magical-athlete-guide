const CACHE='magical-athlete-companion-v1.1.1';
const CARD_IDS=['alchemist','blimp','coach','baba-yaga','centaur','copycat','banana','cheerleader','dicemonger','duelist','genius','heckler','egg','gunk','huge-baby','flip-flop','hare','hypnotist','inchworm','legs','mastermind','lackey','lovable-loser','m-o-u-t-h','leaptoad','magician','party-animal','rocket-scientist','sisyphus','suckerfish','romantic','skipper','third-wheel','scoocher','stickler','twin'];
const CORE=['./','./index.html','./styles.css','./app.js','./original-images.js','./cards.json','./manifest.webmanifest'];
const OPTIONAL=['./assets/cards/manifest.json',...CARD_IDS.map(id=>`./assets/cards/${id}.png`),'./assets/sprite-v11.json','./assets/sprite-v11-01.txt'];
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
