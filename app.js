/* Site Catlibras. Lê a planilha do Google (ou os dados de teste) e monta as páginas. */
(function(){
'use strict';
var CFG = window.CATLIBRAS || {};
var $ = function(s,r){return (r||document).querySelector(s)};
var app = $('#app');
var PLAY = '<svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><path d="M2 1l11 6-11 6z"/></svg>';

/* ---------- utilidades ---------- */
function norm(s){return String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim()}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function slug(s){return norm(s).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function ytid(u){
  u=String(u||'').trim(); if(!u) return '';
  var m=u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if(m) return m[1];
  return /^[A-Za-z0-9_-]{11}$/.test(u)?u:'';
}
function thumb(id){return 'https://img.youtube.com/vi/'+id+'/mqdefault.jpg'}
function yes(v){return norm(v)==='sim'}
function num(v,d){var n=parseFloat(String(v).replace(',','.'));return isNaN(n)?d:n}
function pct(v){var n=num(v,50);return n+'%'}
function fmt(s){s=Math.max(0,Math.floor(s||0));var m=Math.floor(s/60),r=s%60;return m+':'+(r<10?'0':'')+r}

/* ---------- planilha ---------- */
function parseGviz(txt){
  var j=JSON.parse(txt.substring(txt.indexOf('{'),txt.lastIndexOf('}')+1));
  var cols=j.table.cols.map(function(c){return norm(c.label||'')});
  return j.table.rows.map(function(r){
    var o={};
    (r.c||[]).forEach(function(c,i){
      var v=c?(c.v!=null?c.v:''):'';
      if(typeof v==='string'&&/^Date\(/.test(v)){var p=v.match(/\d+/g);v=p[0]+'-'+('0'+(+p[1]+1)).slice(-2)+'-'+('0'+p[2]).slice(-2)}
      if(cols[i]) o[cols[i]]=v;
    });
    return o;
  }).filter(function(o){
    var vals=Object.keys(o).map(function(k){return String(o[k]).trim()}).filter(Boolean);
    return vals.length && norm(vals[0]).indexOf('exemplo')!==0;
  });
}
function fetchTab(name){
  var u='https://docs.google.com/spreadsheets/d/'+CFG.SHEET_ID+'/gviz/tq?tqx=out:json&headers=1&sheet='+encodeURIComponent(name);
  return fetch(u).then(function(r){if(!r.ok) throw new Error(name);return r.text()}).then(parseGviz);
}
/* pega o valor da coluna cujo nome começa com o trecho dado */
function f(row,frag){
  frag=norm(frag);
  for(var k in row){ if(k.indexOf(frag)===0) return row[k]; }
  return '';
}
function loadData(){
  var ex=window.DADOS_EXEMPLO;
  if(!CFG.SHEET_ID) return Promise.resolve({raw:fromExample(ex),source:'exemplo'});
  var tabs=['Sinais','Variações','Patrística','Oração Eucarística','Acessibilidade','Temas','Equipe','Configurações'];
  return Promise.all(tabs.map(function(t){return fetchTab(t).catch(function(){return null})})).then(function(r){
    if(!r[0]&&!r[2]) return {raw:fromExample(ex),source:'exemplo'};
    return {raw:{sinais:r[0]||[],variacoes:r[1]||[],patristica:r[2]||[],eucaristica:r[3]||[],acessibilidade:r[4]||[],temas:r[5]||[],equipe:r[6]||[],config:r[7]||[]},source:'planilha'};
  });
}
function fromExample(ex){
  /* converte os dados de teste para o mesmo formato das linhas da planilha */
  function a(list,map){return list.map(function(o){var r={};Object.keys(map).forEach(function(k){r[k]=o[map[k]]!=null?o[map[k]]:''});return r})}
  return {
    sinais:a(ex.sinais,{'titulo':'titulo','link do youtube':'link','outros nomes':'outros','temas':'temas','data de publicacao':'data','ativo':'ativo'}),
    variacoes:[],
    patristica:a(ex.patristica,{'modulo':'modulo','ordem':'ordem','nome do video':'nome','link do original':'orig','link do interprete':'terp','inicio do interprete (segundos)':'ini'}),
    eucaristica:a(ex.eucaristica,{'numero (ii, iii...)':'numero','versao catlibras':'v1','alternativas de estrategia de traducao':'v2','traducao comentada':'v3'}),
    acessibilidade:[],
    temas:a(ex.temas,{'tema':'tema','descricao':'descricao'}),
    equipe:[],
    config:[]
  };
}

/* ---------- modelo ---------- */
var D={sinais:[],temas:{},patr:{},euc:[],acess:[],equipe:[],cfg:{},prefixos:[]};
var DEFAULT_PREF='padre, irmã, irmão, frei, dom, madre, monsenhor, papa, beato, beata, são, santo, santa';
function capaOf(r,fallbackId){
  var img=String(f(r,'capa (link')||'').trim();
  return {img:img||(fallbackId?thumb(fallbackId):''),custom:!!img,x:pct(f(r,'capa x')),y:pct(f(r,'capa y')),z:num(f(r,'capa zoom'),1)};
}
function buildModel(raw){
  D.cfg={};
  raw.config.forEach(function(r){var k=norm(f(r,'chave'));if(k) D.cfg[k]=String(f(r,'valor')||'')});
  D.prefixos=(D.cfg.prefixos_ignorados||DEFAULT_PREF).split(',').map(function(p){return norm(p)}).filter(Boolean);
  D.temas={};
  raw.temas.forEach(function(r){var n=String(f(r,'tema')).trim();if(!n) return;D.temas[slug(n)]={nome:n,desc:String(f(r,'descricao')||''),capa:capaOf(r,'')}});
  var used={};
  D.sinais=raw.sinais.filter(function(r){return String(f(r,'titulo')).trim()&&ytid(f(r,'link'))&&norm(f(r,'ativo'))!=='nao'}).map(function(r,i){
    var titulo=String(f(r,'titulo')).trim(), id=slug(nomePrincipal(titulo))||('s'+i);
    if(used[id]) id=id+'-'+(i+1); used[id]=1;
    var temas=String(f(r,'temas')||'').split(',').map(function(t){return t.trim()}).filter(Boolean).map(function(t){
      var k=slug(t); if(!D.temas[k]) D.temas[k]={nome:t,desc:'',capa:{img:'',x:'50%',y:'50%',z:1}}; return k;
    });
    var yt=ytid(f(r,'link'));
    return {id:id,titulo:titulo,nome:nomePrincipal(titulo),outros:String(f(r,'outros')||'').split(',').map(function(t){return t.trim()}).filter(Boolean),temas:temas,yt:yt,data:String(f(r,'data')||''),capa:capaOf(r,yt),ordem:i};
  });
  D.patr={};
  raw.patristica.filter(function(r){return norm(f(r,'ativo'))!=='nao'}).forEach(function(r){
    var m=String(f(r,'modulo')).trim(),o=ytid(f(r,'link do original'));
    if(!m||!o) return;
    (D.patr[m]=D.patr[m]||[]).push({ordem:num(f(r,'ordem'),999),nome:String(f(r,'nome')||('Vídeo')),orig:o,terp:ytid(f(r,'link do interprete')),ini:num(f(r,'inicio'),0),capa:capaOf(r,o)});
  });
  Object.keys(D.patr).forEach(function(m){D.patr[m].sort(function(a,b){return a.ordem-b.ordem})});
  D.euc=raw.eucaristica.filter(function(r){return norm(f(r,'ativo'))!=='nao'&&String(f(r,'numero')).trim()}).map(function(r){
    var v=[ytid(f(r,'versao')),ytid(f(r,'alternativas')),ytid(f(r,'traducao'))];
    return {num:String(f(r,'numero')).trim(),v:v,capa:capaOf(r,v[0])};
  });
  D.acess=raw.acessibilidade.filter(function(r){return norm(f(r,'ativo'))!=='nao'&&ytid(f(r,'link do original'))}).map(function(r){
    var o=ytid(f(r,'link do original'));
    return {titulo:String(f(r,'titulo')),canal:String(f(r,'canal')||''),orig:o,terp:ytid(f(r,'link do interprete')),ini:num(f(r,'inicio'),0),destaque:yes(f(r,'destaque')),capa:capaOf(r,o)};
  });
  D.equipe=raw.equipe.slice().sort(function(a,b){return num(f(a,'ordem'),99)-num(f(b,'ordem'),99)});
}
/* Letra do catálogo: ignora "Sinal de", "em Libras" e títulos como Padre, Irmã, São... */
function chave(n){
  var k=norm(n).replace(/^sinal de /,'').replace(/ em libras$/,'').trim(),p=k.split(' ');
  while(p.length>1&&D.prefixos.indexOf(p[0])>-1) p.shift();
  return p.join(' ');
}
function nomePrincipal(t){return String(t).replace(/^\s*sinal de\s+/i,'').replace(/\s+em libras\s*$/i,'').trim()}
function label(s){return [s.nome].concat(s.outros).join(' e ')}
function sorted(list){return list.slice().sort(function(a,b){return chave(a.nome).localeCompare(chave(b.nome),'pt-BR')})}
function byId(id){return D.sinais.filter(function(s){return s.id===id})[0]}

/* ---------- peças de interface ---------- */
function hue(seed){var h=0,i;for(i=0;i<seed.length;i++){h=(h*31+seed.charCodeAt(i))%360}return [205,220,235,250,265,190,35][h%7]}
function cover(c,seed){
  var hh=hue(seed||'x'),b=(hh+40)%360;
  var st='--x:'+c.x+';--y:'+c.y+';--z:'+c.z+';';
  var grad='radial-gradient(circle at 28% 24%,hsl('+hh+' 58% 44%) 0,transparent 52%),radial-gradient(circle at 78% 82%,hsl('+b+' 62% 32%) 0,transparent 58%)';
  var bg=(c.img?'url('+c.img.replace(/[()'"\s]/g,function(ch){return '%'+ch.charCodeAt(0).toString(16)})+'),':'')+grad;
  return '<span class="cover img" style="'+st+'background-image:'+bg+';background-color:hsl('+hh+' 42% 16%)"></span>';
}
function signTile(s,isNew){
  return '<a class="tile cov" href="#sinal-'+s.id+'">'+cover(s.capa,s.id)+(isNew?'<span class="newtag">Novo</span>':'')+'<span class="play">'+PLAY+'</span><span class="name">'+esc(label(s))+'</span></a>';
}
function themeTile(k){
  var t=D.temas[k];
  return '<a class="tile theme cov" href="#tema-'+k+'">'+cover(t.capa,k)+'<span class="name">'+esc(t.nome)+'</span>'+(t.desc?'<span class="sub">'+esc(t.desc)+'</span>':'')+'</a>';
}
function barTile(href,name,c,seed){return '<a class="tile theme cov" href="'+href+'">'+cover(c,seed)+'<span class="name">'+esc(name)+'</span></a>'}
function videoTile(href,name,c,seed,attr){
  return '<a class="tile cov" href="'+href+'"'+(attr||'')+'>'+cover(c,seed)+'<span class="play">'+PLAY+'</span><span class="name">'+esc(name)+'</span></a>';
}
function waLink(title){return 'https://wa.me/?text='+encodeURIComponent((title?title+' ':'')+location.href)}
function vctl(extra){
  return '<div class="vctl" role="group" aria-label="Controles do vídeo">'+
    '<div class="seg" role="group" aria-label="Velocidade">'+
    '<button type="button" data-speed="0.5" aria-pressed="false">0,5×</button>'+
    '<button type="button" data-speed="0.75" aria-pressed="false">0,75×</button>'+
    '<button type="button" data-speed="1" aria-pressed="true">1×</button></div>'+
    '<button type="button" class="tog" data-repeat aria-pressed="false">↻ Repetir</button>'+(extra||'')+'</div>';
}
function poster(id,label){
  return '<button class="poster" type="button" aria-label="'+esc(label||'Reproduzir')+'"><img src="'+thumb(id)+'" alt="" loading="lazy"><span class="big">'+PLAY+'</span></button>';
}

/* ---------- YouTube ---------- */
var ytQ=[],ytLoading=false;
function ytReady(cb){
  if(window.YT&&YT.Player){cb();return}
  ytQ.push(cb);
  if(ytLoading) return; ytLoading=true;
  var prev=window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady=function(){if(prev)prev();var q=ytQ;ytQ=[];q.forEach(function(c){c()})};
  var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);
}
function unavailable(frame){
  frame.innerHTML='<div class="msg">Este vídeo não está disponível no momento.<br><a href="'+esc(CFG.CANAL_URL||'https://www.youtube.com/@catlibras')+'" target="_blank" rel="noopener">Ver o canal no YouTube</a></div>';
}
function mkPlayer(slot,id,o){
  /* slot: elemento que será trocado pelo iframe */
  return new YT.Player(slot,{
    videoId:id,host:'https://www.youtube.com',
    playerVars:{autoplay:o.autoplay?1:0,controls:o.controls?1:0,rel:0,playsinline:1,modestbranding:1,iv_load_policy:3,fs:o.controls?1:0,disablekb:o.controls?0:1,start:o.start||0,origin:location.origin},
    events:{
      onReady:function(e){
        var fr=e.target.getIframe();fr.className='yt';fr.setAttribute('title',o.title||'Vídeo');
        if(o.mute) e.target.mute();
        if(o.onReady) o.onReady(e.target);
      },
      onStateChange:function(e){if(o.onState) o.onState(e.data,e.target)},
      onError:function(){if(o.onError) o.onError()}
    }
  });
}

/* ---------- player de um vídeo (página do sinal e janela) ---------- */
var single=null,speed=1,repeat=false;
function stopSingle(){if(single&&single.p){try{single.p.destroy()}catch(e){}}single=null}
function mountSingle(frame,id,title){
  stopSingle();
  var slot=document.createElement('div');
  frame.innerHTML='';frame.appendChild(slot);
  single={p:null};
  ytReady(function(){
    if(!single) return;
    single.p=mkPlayer(slot,id,{autoplay:1,controls:1,title:title,
      onReady:function(p){try{p.setPlaybackRate(speed)}catch(e){}},
      onState:function(st,p){if(st===0&&repeat){p.seekTo(0);p.playVideo()}},
      onError:function(){unavailable(frame)}});
  });
}
function applySpeed(r){speed=r;if(single&&single.p&&single.p.setPlaybackRate){try{single.p.setPlaybackRate(r)}catch(e){}}if(dual&&dual.apply)dual.apply()}

/* ---------- dois vídeos com sincronização ---------- */
var dual=null;
function stopDual(){
  if(!dual) return;
  clearInterval(dual.timer);
  [dual.o,dual.t].forEach(function(p){try{p&&p.destroy()}catch(e){}});
  dual=null;
}
function dualView(back,it,title){
  /* it: {orig,terp,ini,nome} */
  var home='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg>';
  return '<div class="dualpage"><div class="dual"><div class="pair">'+
    '<div class="frame live orig" id="fo"><span class="chip">Vídeo original</span>'+poster(it.orig,'Reproduzir os dois vídeos')+'</div>'+
    (it.terp?'<div class="frame live terp" id="ft"><span class="chip">Intérprete</span>'+poster(it.terp,'Reproduzir os dois vídeos')+'</div>':'')+
    '</div></div>'+
    '<div class="player-bar" id="pbar" role="group" aria-label="Controles dos dois vídeos">'+
    '<a class="btn small ghost ctl-home" href="#inicio" aria-label="Início">'+home+'</a>'+
    '<a class="btn small ghost" href="'+back+'">← Voltar</a>'+
    '<button class="go" id="pgo" type="button">Reproduzir</button>'+
    '<button id="pback" type="button" aria-label="Voltar 10 segundos">−10 s</button>'+
    '<button id="pfwd" type="button" aria-label="Avançar 10 segundos">+10 s</button>'+
    '<div class="track" id="ptrack" role="slider" aria-label="Posição" style="cursor:pointer"><i id="pfill"></i></div>'+
    '<span class="time" id="ptime">0:00</span>'+
    '<div class="seg" role="group" aria-label="Velocidade"><button type="button" data-speed="0.5" aria-pressed="false">0,5×</button><button type="button" data-speed="0.75" aria-pressed="false">0,75×</button><button type="button" data-speed="1" aria-pressed="true">1×</button></div>'+
    '<button type="button" class="tog" data-repeat aria-pressed="false">↻ Repetir</button>'+
    '<a class="btn small ghost" href="'+waLink(title)+'" target="_blank" rel="noopener">Compartilhar</a>'+
    (it.terp?'<button id="psync" class="linkbtn" type="button">Ressincronizar</button>':'')+
    '</div></div>';
}
function initDual(it){
  var fo=$('#fo'),ft=$('#ft'); if(!fo) return;
  var d=dual={o:null,t:null,timer:null,started:false,lastT:-1,stall:0,it:it,apply:null};
  function oTime(){try{return d.o.getCurrentTime()||0}catch(e){return 0}}
  function target(){return oTime()+(it.ini||0)}
  d.apply=function(){[d.o,d.t].forEach(function(p){try{p&&p.setPlaybackRate(speed)}catch(e){}})};
  function resync(){if(d.t&&d.o){try{d.t.seekTo(target(),true)}catch(e){}}}
  function tick(){
    if(!d.o||!d.o.getPlayerState) return;
    var st=d.o.getPlayerState(),t=oTime(),dur=0;
    try{dur=d.o.getDuration()||0}catch(e){}
    $('#pfill').style.width=(dur?Math.min(100,t/dur*100):0)+'%';
    $('#ptime').textContent=fmt(t)+(dur?' / '+fmt(dur):'');
    $('#pgo').textContent=(st===1||st===3)?'Pausar':'Reproduzir';
    /* anúncio ou travamento: o vídeo diz que toca, mas o tempo não anda */
    if(st===1||st===3){ if(Math.abs(t-d.lastT)<0.01) d.stall+=250; else d.stall=0; } else d.stall=0;
    d.lastT=t;
    var playing=(st===1)&&d.stall<1000;
    if(!d.t) return;
    var ts=-2;try{ts=d.t.getPlayerState()}catch(e){}
    if(playing){
      var tt=target(),tc=0;try{tc=d.t.getCurrentTime()||0}catch(e){}
      if(ts!==1&&ts!==3){try{d.t.seekTo(tt,true);d.t.playVideo()}catch(e){}}
      else if(Math.abs(tc-tt)>0.7){try{d.t.seekTo(tt,true)}catch(e){}}
    } else if(ts===1||ts===3){ try{d.t.pauseVideo()}catch(e){} }
  }
  function start(){
    if(d.started) return; d.started=true;
    fo.innerHTML='<span class="chip">Vídeo original</span>';
    var so=document.createElement('div');fo.appendChild(so);
    var st=null;
    if(ft){ft.innerHTML='<span class="chip">Intérprete</span>';st=document.createElement('div');ft.appendChild(st)}
    ytReady(function(){
      if(dual!==d) return;
      d.o=mkPlayer(so,it.orig,{autoplay:1,controls:1,title:'Vídeo original',
        onReady:function(){d.apply()},
        onState:function(s,p){
          if(s===0){ if(repeat){p.seekTo(0);p.playVideo();setTimeout(resync,300)} else if(d.t){try{d.t.pauseVideo()}catch(e){}} }
        },
        onError:function(){unavailable(fo)}});
      if(st) d.t=mkPlayer(st,it.terp,{autoplay:0,controls:0,mute:1,start:Math.floor(it.ini||0),title:'Intérprete de Libras',
        onReady:function(){d.apply()},onError:function(){unavailable(ft)}});
      d.timer=setInterval(tick,250);
    });
  }
  d.start=start;
  fo.addEventListener('click',function(e){if(e.target.closest('.poster'))start()});
  if(ft) ft.addEventListener('click',function(e){if(e.target.closest('.poster'))start()});
  $('#pgo').addEventListener('click',function(){
    if(!d.started){start();return}
    if(!d.o||!d.o.getPlayerState) return;
    var s=d.o.getPlayerState();
    if(s===1||s===3) d.o.pauseVideo(); else d.o.playVideo();
  });
  $('#pback').addEventListener('click',function(){if(d.o&&d.o.seekTo){d.o.seekTo(Math.max(0,oTime()-10),true);setTimeout(resync,200)}});
  $('#pfwd').addEventListener('click',function(){if(d.o&&d.o.seekTo){d.o.seekTo(oTime()+10,true);setTimeout(resync,200)}});
  $('#ptrack').addEventListener('click',function(e){
    if(!d.o||!d.o.getDuration) return;
    var r=this.getBoundingClientRect(),p=(e.clientX-r.left)/r.width;
    d.o.seekTo(p*d.o.getDuration(),true);setTimeout(resync,200);
  });
  var rs=$('#psync');
  if(rs) rs.addEventListener('click',function(){resync();rs.textContent='Sincronizado';setTimeout(function(){rs.textContent='Ressincronizar'},1400)});
}

/* ---------- comentários ---------- */
var pageStart=0;
function commentsBlock(key,withVideo){
  if(!CFG.COMENTARIOS_URL) return '';
  return '<section class="section"><section class="comments" aria-labelledby="ch"><h2 id="ch">Comentários</h2>'+
    '<form class="form" id="cform" novalidate>'+
    '<div><label for="cn">Seu nome</label><input type="text" id="cn" autocomplete="name" maxlength="60"></div>'+
    '<div><label for="ct">Seu comentário</label><textarea id="ct" maxlength="1500"></textarea></div>'+
    '<div class="cform-hp" aria-hidden="true"><label>Não preencha<input type="text" id="chp" tabindex="-1" autocomplete="off"></label></div>'+
    '<div class="row"><button class="btn small" type="submit">Publicar comentário</button>'+
    (withVideo?'<label class="btn small ghost filebtn">Enviar vídeo<input type="file" id="cv" accept="video/*"></label>':'')+'</div>'+
    '<p class="status" id="cs" role="status"></p></form>'+
    '<ul class="clist" id="clist"></ul></section></section>';
}
function addComment(c,top){
  var li=document.createElement('li'),b=document.createElement('b'),sp=document.createElement('span'),p=document.createElement('p');
  b.textContent=c.nome||'Visitante';sp.textContent=c.data||'';p.textContent=c.texto||'';
  li.appendChild(b);li.appendChild(sp);if(c.texto)li.appendChild(p);
  if(c.video){var m=String(c.video).match(/[-\w]{20,}/);if(m){var fr=document.createElement('iframe');fr.src='https://drive.google.com/file/d/'+m[0]+'/preview';fr.setAttribute('allow','autoplay');fr.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:4px;margin-top:8px';fr.title='Vídeo enviado';li.appendChild(fr)}}
  var l=$('#clist');if(!l)return;
  if(top) l.insertBefore(li,l.firstChild); else l.appendChild(li);
}
function initComments(key){
  var form=$('#cform'); if(!form) return;
  fetch(CFG.COMENTARIOS_URL+'?pagina='+encodeURIComponent(key)).then(function(r){return r.json()}).then(function(j){(j.comentarios||[]).forEach(function(c){addComment(c,false)})}).catch(function(){});
  var st=$('#cs');
  function post(body){
    body.pagina=key;body.site=$('#chp').value;body.tempo=Date.now()-pageStart;
    return fetch(CFG.COMENTARIOS_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
  }
  function limited(){
    try{var a=JSON.parse(localStorage.getItem('cl_c')||'[]').filter(function(t){return Date.now()-t<60000});if(a.length>=4)return true;a.push(Date.now());localStorage.setItem('cl_c',JSON.stringify(a))}catch(e){}
    return false;
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var t=$('#ct').value.trim(),n=$('#cn').value.trim()||'Visitante';
    if(!t){st.textContent='Escreva o comentário antes de publicar.';return}
    if($('#chp').value||Date.now()-pageStart<3000){st.textContent='Tente de novo em instantes.';return}
    if(limited()){st.textContent='Muitos envios seguidos. Aguarde um minuto.';return}
    post({nome:n,texto:t}).then(function(){addComment({nome:n,texto:t,data:'agora'},true);$('#ct').value='';st.textContent='Comentário enviado.'}).catch(function(){st.textContent='Não foi possível enviar agora.'});
  });
  var fv=$('#cv');
  if(fv) fv.addEventListener('change',function(){
    var file=fv.files&&fv.files[0]; if(!file) return;
    if(file.size>25*1024*1024){st.textContent='O vídeo é grande demais (máximo 25 MB).';fv.value='';return}
    if(limited()){st.textContent='Muitos envios seguidos. Aguarde um minuto.';fv.value='';return}
    st.textContent='Enviando o vídeo...';
    var rd=new FileReader();
    rd.onload=function(){
      var n=$('#cn').value.trim()||'Visitante';
      post({nome:n,texto:$('#ct').value.trim(),arquivo:{nome:file.name,tipo:file.type,dados:String(rd.result).split(',')[1]}})
        .then(function(){st.textContent='Vídeo recebido. Aparece no site depois da aprovação da equipe.';fv.value=''})
        .catch(function(){st.textContent='Não foi possível enviar o vídeo agora.'});
    };
    rd.readAsDataURL(file);
  });
}

/* ---------- páginas ---------- */
var lastTheme=null,pendingComments=null,pendingCover=null;
function recentList(){
  var l=D.sinais.slice().sort(function(a,b){
    if(a.data&&b.data&&a.data!==b.data) return a.data<b.data?1:-1;
    if(!!a.data!==!!b.data) return a.data?-1:1;
    return b.ordem-a.ordem;
  });
  return l.slice(0,12);
}
function isNew(s){
  if(!s.data) return false;
  var d=new Date(s.data+'T00:00:00');return !isNaN(d)&&(Date.now()-d.getTime())<14*864e5;
}
function head(h){return '<h1>'+h+'</h1><hr class="rule">'}
var views={
  inicio:function(){
    var th=Object.keys(D.temas).map(themeTile).join('');
    var rec=recentList().map(function(s){return signTile(s,isNew(s))}).join('');
    return '<section class="hero">'+
      '<div class="search hero-search"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>'+
      '<input id="qh" type="search" placeholder="Buscar sinal pelo nome" autocomplete="off" aria-label="Buscar sinal pelo nome"><div id="resultsh" class="results" hidden></div></div>'+
      '<div class="actions" style="margin-top:0"><a class="btn" href="#catalogo">Explorar o catálogo</a><a class="btn ghost" href="#patristica">Patrística</a><a class="btn ghost" href="#oracao-eucaristica">Oração Eucarística</a><a class="btn ghost" href="#acessibilidade">Acessibilidade Catlibras</a></div></section>'+
      (th?'<section class="section"><div class="section-head"><h2>Temas</h2></div><hr class="rule"><div class="grid wide">'+th+'</div></section>':'')+
      (rec?'<section class="section"><div class="section-head"><h2>Últimos vídeos publicados</h2></div><hr class="rule"><div class="grid compact">'+rec+'</div></section>':'');
  },
  sobre:function(){
    var SIL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
    var team=D.equipe.map(function(r){
      var nm=String(f(r,'nome')),role=String(f(r,'surdo')),ph=String(f(r,'foto')).trim();
      if(!nm) return '';
      return '<div class="member"><div class="photo">'+(ph?'<img src="'+esc(ph)+'" alt="" style="width:100%;height:100%;object-fit:cover">':SIL)+'</div><div class="who">'+esc(nm)+'</div>'+(role?'<span class="role '+(norm(role)==='surdo'?'surdo':'ouvinte')+'">'+esc(role)+'</span>':'')+'</div>';
    }).join('');
    var txt=D.cfg.texto_sobre?'<p>'+esc(D.cfg.texto_sobre).replace(/\n+/g,'</p><p>')+'</p>':
      '<p>Em 2016, durante um intercâmbio de experiências entre intérpretes católicos de LIBRAS da Arquidiocese de Brasília, surgiu o desejo de reunir os estudos e reflexões acumulados ao longo dos anos sobre a vivência da fé em LIBRAS.</p>'+
      '<p>Formou-se então um grupo de trabalho, composto majoritariamente por surdos engajados na missão evangelizadora, junto a intérpretes comprometidos com o discipulado. Com dedicação e amor à Igreja, o grupo se empenhou na validação dos sinais com participação ativa da comunidade surda.</p>'+
      '<p>O CatLibras não tem como objetivo padronizar os sinais, mas sim catalogar aqueles utilizados e compreendidos pela comunidade surda católica. Deseja ser uma fonte confiável e pastoral, acessível a todos os que buscam servir e viver a fé de forma inclusiva. É um passo concreto rumo a uma Igreja mais acolhedora, onde surdos e intérpretes caminham juntos como discípulos missionários.</p>';
    return head('Sobre')+'<div class="about">'+txt+'</div>'+(team?'<section class="section"><div class="section-head"><h2>Equipe</h2></div><hr class="rule"><div class="team">'+team+'</div></section>':'');
  },
  catalogo:function(){
    var L='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return head('Escolha a letra')+'<div class="grid letters">'+L.map(function(c){return '<a class="tile letter" href="#letra-'+c.toLowerCase()+'" aria-label="Letra '+c+'"><span class="ltr">'+c+'</span></a>'}).join('')+'</div>';
  },
  'oracao-eucaristica':function(){
    return head('Oração Eucarística')+'<div class="grid wide">'+D.euc.map(function(e){return barTile('#eucaristica-'+slug(e.num),'Oração Eucarística '+e.num,e.capa,'euc'+e.num)}).join('')+'</div>';
  },
  patristica:function(){
    return head('Patrística')+'<div class="grid wide">'+Object.keys(D.patr).sort(function(a,b){return a-b}).map(function(m){return barTile('#patristica-'+m,'Módulo '+m,D.patr[m][0].capa,'patr'+m)}).join('')+'</div>';
  },
  acessibilidade:function(){
    var dest=D.acess.map(function(a,i){return {a:a,i:i}}).filter(function(x){return x.a.destaque}).slice(0,3);
    if(!dest.length) dest=D.acess.slice(0,3).map(function(a,i){return {a:a,i:i}});
    var slides=dest.map(function(x,k){return '<a class="slide'+(k===0?' on':'')+'" href="#video-acessibilidade-'+(x.i+1)+'" style="background-image:linear-gradient(to top,rgba(6,14,34,.9),rgba(6,14,34,.1)),url('+thumb(x.a.orig)+');background-size:cover;background-position:center"><span class="play">'+PLAY+'</span><span class="name">'+esc(x.a.titulo)+'</span><span class="sub">'+esc(x.a.canal)+'</span></a>'}).join('');
    var dots=dest.map(function(x,k){return '<button type="button" data-dot="'+k+'" aria-label="Destaque '+(k+1)+'"'+(k===0?' aria-current="true"':'')+'></button>'}).join('');
    var g=D.acess.map(function(a,i){return videoTile('#video-acessibilidade-'+(i+1),a.titulo,a.capa,'ac'+i)}).join('');
    return head('Acessibilidade Catlibras')+
      (dest.length?'<div class="spot" id="spot" aria-roledescription="carrossel">'+slides+'<div class="dots">'+dots+'</div></div>':'')+
      (g?'<div class="grid compact" style="margin-top:26px">'+g+'</div>':'<p class="note">Em breve.</p>');
  }
};
function sinalView(s){
  var th=(lastTheme&&s.temas.indexOf(lastTheme)>-1)?lastTheme:s.temas[0];
  var pn='';
  if(th){
    var lst=sorted(D.sinais.filter(function(x){return x.temas.indexOf(th)>-1})),ix=0,q;
    for(q=0;q<lst.length;q++){if(lst[q].id===s.id)ix=q}
    var pv=lst[ix-1],nx=lst[ix+1];
    pn='<nav class="pn" aria-label="Anterior e próximo em '+esc(D.temas[th].nome)+'">'+
      (pv?'<a href="#sinal-'+pv.id+'"><small>← Anterior</small><b>'+esc(label(pv))+'</b></a>':'<span class="off"></span>')+
      (nx?'<a class="nx" href="#sinal-'+nx.id+'"><small>Próximo →</small><b>'+esc(label(nx))+'</b></a>':'<span class="off"></span>')+'</nav>';
  }
  var tags=s.temas.map(function(k){return '<li><a href="#tema-'+k+'">'+esc(D.temas[k].nome)+'</a></li>'}).join('');
  var vars=(D.raw.variacoes||[]).filter(function(r){return (slug(f(r,'sinal'))===slug(s.titulo)||slug(nomePrincipal(String(f(r,'sinal'))))===slug(s.nome))&&ytid(f(r,'link'))&&norm(f(r,'ativo'))!=='nao'}).sort(function(a,b){return num(f(a,'ordem'),99)-num(f(b,'ordem'),99)});
  var reg=vars.map(function(r){
    var id=ytid(f(r,'link')),code=String(f(r,'bandeira')).trim(),lugar=String(f(r,'nome do lugar')||code);
    var flag=code?'<span class="flag" style="background:#1d2f5c">'+esc(code.slice(0,3).toUpperCase())+'<img src="bandeiras/'+esc(code.toUpperCase())+'.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()"></span>':'';
    return '<a class="tile cov" href="#" data-video="'+esc(lugar)+'" data-yt="'+id+'">'+cover({img:thumb(id),x:'50%',y:'50%',z:1},id)+flag+'<span class="play">'+PLAY+'</span><span class="name">'+esc(lugar)+'</span></a>';
  }).join('');
  return '<p class="eyebrow">Sinal</p><h1>'+esc(label(s))+'</h1>'+(tags?'<ul class="tags">'+tags+'</ul>':'')+
    '<div class="solo"><div class="frame live" id="sf">'+poster(s.yt,'Reproduzir '+label(s))+'</div>'+
    vctl('<a class="btn small ghost" href="'+waLink(s.titulo)+'" target="_blank" rel="noopener">Compartilhar no WhatsApp</a>')+pn+'</div>'+
    (reg?'<section class="section"><div class="section-head"><h2>Variações</h2></div><hr class="rule"><div class="grid small">'+reg+'</div></section>':'')+
    commentsBlock('sinal-'+s.id,true);
}
function eucView(e){
  var T=['Versão Catlibras','Alternativas de estratégia de tradução','Tradução comentada'];
  var m=T.map(function(t,i){
    if(!e.v[i]) return '';
    return '<a class="tile cov" href="#" data-video="Oração Eucarística '+esc(e.num)+' · '+esc(t)+'" data-yt="'+e.v[i]+'">'+cover({img:thumb(e.v[i]),x:'50%',y:'50%',z:1},e.num+t)+'<span class="play">'+PLAY+'</span><span class="name">'+esc(t)+'</span></a>';
  }).join('');
  return head('Oração Eucarística '+esc(e.num))+(m?'<div class="grid compact roomy">'+m+'</div>':'<p class="note">Em breve.</p>')+commentsBlock('eucaristica-'+slug(e.num),true);
}
function patrView(m){
  var l=D.patr[m]||[];
  return head('Patrística · Módulo '+esc(m))+'<div class="grid compact">'+l.map(function(v,i){return videoTile('#video-patristica-'+m+'-'+(i+1),v.nome,v.capa,'p'+m+'-'+i)}).join('')+'</div>';
}

/* ---------- rotas ---------- */
function render(){
  stopDual();stopSingle();
  var h=(location.hash||'#inicio').slice(1),html,nav='',after=null,mt;
  pageStart=Date.now();
  if((mt=h.match(/^tema-(.+)$/))&&D.temas[mt[1]]){
    lastTheme=mt[1];var k=mt[1],list=sorted(D.sinais.filter(function(s){return s.temas.indexOf(k)>-1}));
    html='<p class="eyebrow">Tema</p><h1>'+esc(D.temas[k].nome)+'</h1>'+(D.temas[k].desc?'<p class="lead">'+esc(D.temas[k].desc)+'. Em ordem alfabética.</p>':'')+'<hr class="rule" style="margin-top:20px"><div class="grid compact">'+list.map(function(s){return signTile(s,false)}).join('')+'</div>';
  } else if((mt=h.match(/^letra-([a-z])$/))){
    lastTheme=null;var c=mt[1],C=c.toUpperCase();
    var ll=sorted(D.sinais.filter(function(s){return [s.nome].concat(s.outros).some(function(n){return chave(n).charAt(0)===c})}));
    html=head('Letra '+C)+(ll.length?'<div class="grid compact">'+ll.map(function(s){return signTile(s,false)}).join('')+'</div>':'<p class="note">Ainda não há sinais com a letra '+C+'.</p>');
    nav='catalogo';
  } else if((mt=h.match(/^sinal-(.+)$/))&&byId(mt[1])){
    var s=byId(mt[1]);html=sinalView(s);nav='catalogo';
    after=function(){
      var fr=$('#sf'),ps=$('.poster',fr);
      if(ps) ps.addEventListener('click',function(){mountSingle(fr,s.yt,s.titulo)});
      initComments('sinal-'+s.id);
    };
  } else if((mt=h.match(/^eucaristica-(.+)$/))&&D.euc.filter(function(e){return slug(e.num)===mt[1]})[0]){
    var e=D.euc.filter(function(x){return slug(x.num)===mt[1]})[0];html=eucView(e);nav='oracao';after=function(){initComments('eucaristica-'+slug(e.num))};
  } else if((mt=h.match(/^patristica-(\d+)$/))&&D.patr[mt[1]]){
    html=patrView(mt[1]);nav='patristica';
  } else if((mt=h.match(/^video-patristica-(\d+)-(\d+)$/))&&D.patr[mt[1]]&&D.patr[mt[1]][mt[2]-1]){
    var v=D.patr[mt[1]][mt[2]-1];html=dualView('#patristica-'+mt[1],v,v.nome);nav='patristica';after=function(){initDual(v)};
  } else if((mt=h.match(/^video-acessibilidade-(\d+)$/))&&D.acess[mt[1]-1]){
    var a=D.acess[mt[1]-1];html=dualView('#acessibilidade',a,a.titulo);nav='acessibilidade';after=function(){initDual(a)};
  } else if(views[h]){
    html=views[h]();nav=({catalogo:'catalogo','oracao-eucaristica':'oracao',patristica:'patristica',acessibilidade:'acessibilidade'})[h]||'';
  } else { html=views.inicio(); }
  app.innerHTML=html;
  var hq=$('#qh'); if(hq) setupSearch(hq,$('#resultsh'));
  $('nav.menu').hidden=!!hq;
  document.body.classList.toggle('watch',h.indexOf('video-')===0);
  document.body.classList.toggle('home',!!hq);
  document.querySelectorAll('nav.menu a').forEach(function(x){if(x.getAttribute('data-nav')===nav) x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
  closeVideo();initSpot();
  if(after) after();
  window.scrollTo(0,0);
}
var spotTimer=null;
function initSpot(){
  if(spotTimer){clearInterval(spotTimer);spotTimer=null}
  var sp=$('#spot');if(!sp)return;
  var slides=sp.querySelectorAll('.slide'),dots=sp.querySelectorAll('.dots button'),i=0;
  function show(n){i=(n+slides.length)%slides.length;slides.forEach(function(s,k){s.classList.toggle('on',k===i)});dots.forEach(function(d,k){if(k===i)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current')})}
  function start(){if(spotTimer||slides.length<2||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;spotTimer=setInterval(function(){show(i+1)},4000)}
  function pause(){clearInterval(spotTimer);spotTimer=null}
  dots.forEach(function(d,k){d.addEventListener('click',function(){show(k)})});
  sp.addEventListener('mouseenter',pause);sp.addEventListener('mouseleave',start);sp.addEventListener('focusin',pause);sp.addEventListener('focusout',start);
  start();
}

/* ---------- vídeo em janela ---------- */
function openVideo(t,id){
  $('#vt').textContent=t;$('#vo').hidden=false;
  var fr=$('#vslot');fr.innerHTML=poster(id,'Reproduzir');
  $('.poster',fr).addEventListener('click',function(){mountSingle(fr,id,t)});
  $('#vc').focus();
}
function closeVideo(){if(!$('#vo').hidden){$('#vo').hidden=true;stopSingle();$('#vslot').innerHTML=''}}
$('#vc').addEventListener('click',closeVideo);
$('#vo').addEventListener('click',function(e){if(e.target===this)closeVideo()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeVideo()});
document.addEventListener('click',function(e){
  var sp=e.target.closest&&e.target.closest('[data-speed]');
  if(sp){sp.parentNode.querySelectorAll('[data-speed]').forEach(function(b){b.setAttribute('aria-pressed',b===sp?'true':'false')});applySpeed(parseFloat(sp.getAttribute('data-speed')))}
  var rp=e.target.closest&&e.target.closest('[data-repeat]');
  if(rp){repeat=rp.getAttribute('aria-pressed')!=='true';rp.setAttribute('aria-pressed',repeat?'true':'false')}
  var v=e.target.closest&&e.target.closest('[data-video]');
  if(v){e.preventDefault();openVideo(v.getAttribute('data-video'),v.getAttribute('data-yt'))}
});

/* ---------- busca ---------- */
function closeAll(){document.querySelectorAll('.results').forEach(function(r){r.hidden=true;r.innerHTML=''})}
function setupSearch(q,res){
  q.addEventListener('input',function(){
    var v=norm(q.value);
    if(!v){closeAll();return}
    var hit=sorted(D.sinais.filter(function(s){return norm(label(s)).indexOf(v)>-1||norm(s.titulo).indexOf(v)>-1})).slice(0,8);
    res.innerHTML=hit.length?hit.map(function(s){return '<a href="#sinal-'+s.id+'">'+esc(label(s))+'<small>'+esc(s.temas.map(function(k){return D.temas[k].nome}).join(', '))+'</small></a>'}).join(''):'<p>Nenhum sinal encontrado.</p>';
    res.hidden=false;
  });
  q.addEventListener('keydown',function(e){if(e.key==='Escape'){closeAll();q.blur()}});
  res.addEventListener('click',function(){setTimeout(function(){q.value='';closeAll()},0)});
}
document.addEventListener('click',function(e){if(!e.target.closest('.search'))closeAll()});

/* ---------- início ---------- */
var foot=$('.foot-in a.btn');if(foot&&CFG.CANAL_URL) foot.href=CFG.CANAL_URL;
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){navigator.serviceWorker.register('sw.js').catch(function(){})}
app.innerHTML='<p class="note" style="padding:40px 0">Carregando...</p>';
loadData().then(function(r){
  D.raw=r.raw;buildModel(r.raw);
  window.addEventListener('hashchange',render);
  render();
}).catch(function(){app.innerHTML='<p class="note">Não foi possível carregar o catálogo agora. Tente novamente em instantes.</p>'});
window.__catlibras={D:D};
})();
