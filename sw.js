/* Serviço mínimo, só para permitir "Instalar na tela inicial". Não guarda nada em cache. */
self.addEventListener('install',function(){self.skipWaiting()});
self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});
self.addEventListener('fetch',function(){});
