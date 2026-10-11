const CACHE="nexosophy-shell-v1",SHELL=["/offline.html","/manifest.webmanifest"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));});
self.addEventListener("activate",e=>{e.waitUntil((async()=>{for(const k of await caches.keys())if(k!==CACHE)await caches.delete(k);await self.clients.claim()})())});
self.addEventListener("message",e=>{if(e.data?.type==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",e=>{const r=e.request,u=new URL(r.url);if(r.method!=="GET"||u.origin!==location.origin)return;if(u.pathname.startsWith("/api/")||u.pathname.startsWith("/v1/"))return;if(r.mode==="navigate"){e.respondWith(fetch(r).catch(()=>caches.match("/offline.html")));return}if(u.pathname.startsWith("/_next/static/")||u.pathname==="/manifest.webmanifest"){e.respondWith(caches.open(CACHE).then(async c=>(await c.match(r))??fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x})));}});
self.addEventListener("sync",e=>{if(e.tag==="nexosophy-sync")e.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(cs=>{for(const c of cs)c.postMessage({type:"NEXOSOPHY_SYNC_REQUESTED"})}))});
