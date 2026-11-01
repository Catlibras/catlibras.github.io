/* Guarda só os arquivos básicos do site para mostrar a tela de "sem conexão". Sempre tenta a internet primeiro. */
var C='catlibras-base-v2';
var BASE=['./','index.html','app.js','config.js','dados-exemplo.js','logo.svg','logo-claro.svg'];
self.addEventListener('install',function(e){
  e.waitUntil(caches.open(C).then(function(c){return Promise.all(BASE.map(function(u){return c.add(u).catch(function(){})}))}).then(function(){return self.skipWaiting()}));
});
self.addEventListener('activate',function(e){
  e.waitUntil(caches.keys().then(function(k){return Promise.all(k.filter(function(n){return n!==C}).map(function(n){return caches.delete(n)}))}).then(function(){return self.clients.claim()}));
});
self.addEventListener('fetch',function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin) return;
  var nome=u.pathname.split('/').pop()||'index.html';
  if(r.mode!=='navigate'&&BASE.indexOf(nome)<0) return;
  e.respondWith(fetch(r).then(function(res){
    if(res&&res.ok){var cp=res.clone();caches.open(C).then(function(c){c.put(r.mode==='navigate'?'index.html':r,cp)})}
    return res;
  }).catch(function(){
    return caches.match(r.mode==='navigate'?'index.html':r,{ignoreSearch:true}).then(function(m){return m||Response.error()});
  }));
});
