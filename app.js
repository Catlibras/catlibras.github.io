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
  var tabs=['Sinais','Variações','Patrística','Oração Eucarística','Acessibilidade','Temas','Equipe','Configurações','Recomendamos'];
  return Promise.all(tabs.map(function(t){return fetchTab(t).catch(function(){return null})})).then(function(r){
    if(!r[0]&&!r[2]) return {raw:fromExample(ex),source:'exemplo'};
    return {raw:{sinais:r[0]||[],variacoes:r[1]||[],patristica:r[2]||[],eucaristica:r[3]||[],acessibilidade:r[4]||[],temas:r[5]||[],equipe:r[6]||[],config:r[7]||[],recomendamos:r[8]||[]},source:'planilha'};
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
    config:[],
    recomendamos:[]
  };
}

/* ---------- modelo ---------- */
var D={sinais:[],temas:{},patr:{},euc:[],acess:[],equipe:[],rec:[],cfg:{},prefixos:[]};
var DEFAULT_PREF='padre, irmã, irmão, ir, frei, dom, dra, dr, madre, monsenhor, cardeal, papa, beato, beata, são, santo, santa, santas, santos';
function ytimg(id){return 'https://i.ytimg.com/vi/'+id+'/hq720.jpg'}
function capaOf(r,fallbackId,def){
  var img=String(f(r,'capa (link')||'').trim();
  def=img?{x:'50%',y:'50%',z:1}:(def||{x:'50%',y:'50%',z:1});
  function has(k){return String(f(r,k)).trim()!==''}
  return {img:img,yt:img?'':(fallbackId||''),x:has('capa x')?pct(f(r,'capa x')):def.x,y:has('capa y')?pct(f(r,'capa y')):def.y,z:has('capa zoom')?num(f(r,'capa zoom'),def.z):def.z};
}
function buildModel(raw){
  D.cfg={};
  raw.config.forEach(function(r){var k=norm(f(r,'chave'));if(k) D.cfg[k]=String(f(r,'valor')||'')});
  D.prefixos=(D.cfg.prefixos_ignorados||DEFAULT_PREF).split(',').map(function(p){return norm(p)}).filter(Boolean);
  D.temas={};D.temasHome=[];
  raw.temas.forEach(function(r){var n=String(f(r,'tema')).trim();if(!n) return;D.temas[slug(n)]={nome:n,desc:String(f(r,'descricao')||''),capa:capaOf(r,'')};D.temasHome.push(slug(n))});
  var CAPA_SINAL={x:D.cfg.capa_x?pct(D.cfg.capa_x):'7%',y:D.cfg.capa_y?pct(D.cfg.capa_y):'36.5%',z:D.cfg.capa_zoom?num(D.cfg.capa_zoom,2.5):2.5};
  var used={},modo=norm(D.cfg.mostrar_em_breve||'nao'),hoje=new Date().toISOString().slice(0,10);
  D.sinais=[];
  raw.sinais.forEach(function(r,i){
    var titulo=String(f(r,'titulo')).trim();
    if(!titulo||norm(f(r,'ativo'))==='nao') return;
    var yt=ytid(f(r,'link')),data=String(f(r,'data')||'').slice(0,10),sit=norm(f(r,'situacao'));
    var publicado=!!yt;
    var breve=!publicado&&(modo==='todos'||(modo==='aprovados'&&(!!yt||/aprovado|gravado|agendado/.test(sit))));
    if(!publicado&&!breve) return;
    var id=slug(nomePrincipal(titulo))||('s'+i);
    if(used[id]) id=id+'-'+(i+1); used[id]=1;
    var temas=String(f(r,'temas')||'').split(',').map(function(t){return t.trim()}).filter(Boolean).map(function(t){
      var k=slug(t); if(!D.temas[k]) D.temas[k]={nome:t,desc:'',capa:{img:'',x:'50%',y:'50%',z:1},extra:true}; return k;
    });
    D.sinais.push({id:id,titulo:titulo,nome:nomePrincipal(titulo),outros:String(f(r,'outros')||'').split(',').map(function(t){return t.trim()}).filter(Boolean),
      sinonimos:String(f(r,'sinonimos')||''),temas:temas,yt:publicado?yt:'',soon:!publicado,data:publicado?data:'',capa:capaOf(r,publicado?yt:'',CAPA_SINAL),ordem:i});
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
  /* Recomendamos: canais do YouTube (nome, link do canal, logo, ordem, ativo) */
  D.rec=(raw.recomendamos||[]).filter(function(r){return norm(f(r,'ativo'))!=='nao'&&String(f(r,'canal')||f(r,'nome')).trim()&&/^https?:\/\//i.test(String(f(r,'link')).trim())}).map(function(r,i){
    return {nome:String(f(r,'canal')||f(r,'nome')).trim(),link:String(f(r,'link')).trim(),logo:String(f(r,'logo')).trim(),ordem:num(f(r,'ordem'),999),i:i};
  }).sort(function(a,b){return a.ordem-b.ordem||a.i-b.i});
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
  if(c.yt) return '<span class="cover" style="'+st+'background-color:hsl('+hh+' 42% 16%)"><img class="cimg" src="'+ytimg(c.yt)+'" alt="" loading="lazy" onerror="this.onerror=null;this.src=\''+thumb(c.yt)+'\'"></span>';
  var bg=(c.img?'url('+c.img.replace(/[()'"\s]/g,function(ch){return '%'+ch.charCodeAt(0).toString(16)})+'),':'')+grad;
  return '<span class="cover img" style="'+st+'background-image:'+bg+';background-color:hsl('+hh+' 42% 16%)"></span>';
}
function signTile(s,isNew){
  if(s.soon) return '<div class="tile cov soon" aria-label="'+esc(label(s))+', em breve">'+cover(s.capa,s.id)+'<span class="soontag">Em breve</span><span class="name">'+esc(label(s))+'</span></div>';
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
var WAICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
function waBtn(text,label){return '<a class="btn small wa" href="https://wa.me/?text='+encodeURIComponent(text)+'" target="_blank" rel="noopener" aria-label="'+(label||'Compartilhar no WhatsApp')+'" title="'+(label||'Compartilhar no WhatsApp')+'">'+WAICON+'</a>'}
function vctl(extra){
  return '<div class="vctl" role="group" aria-label="Controles do vídeo">'+
    '<a class="btn small ghost ctl-home" href="#inicio" aria-label="Início"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg></a>'+
    '<div class="seg" role="group" aria-label="Velocidade">'+
    '<button type="button" data-speed="0.5" aria-pressed="false">0,5×</button>'+
    '<button type="button" data-speed="0.75" aria-pressed="false">0,75×</button>'+
    '<button type="button" data-speed="1" aria-pressed="true">1×</button></div>'+
    (extra||'')+'</div>';
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
function dualView(back,it,title,prev,next){
  var home='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg>';
  return '<div class="dualpage"><div class="dual"><div class="pair">'+
    '<div class="frame live orig" id="fo">'+poster(it.orig,'Reproduzir os dois vídeos')+'</div>'+
    (it.terp?'<div class="frame live terp" id="ft">'+poster(it.terp,'Reproduzir os dois vídeos')+'</div>':'<div class="frame live terp soonbox" id="ft"><span>Em breve - Tradução em Libras</span></div>')+
    '</div></div>'+
    '<div class="player-bar" id="pbar" role="group" aria-label="Navegação">'+
    '<a class="btn small ghost ctl-home" href="#inicio" aria-label="Início">'+home+'</a>'+
    '<a class="btn small ghost" href="'+back+'">Voltar</a>'+
    (prev?'<a class="btn small ghost" href="'+prev+'" rel="prev"><span class="ar">《</span> Anterior</a>':'')+
    (next?'<a class="btn small ghost" href="'+next+'" rel="next">Próximo <span class="ar">》</span></a>':'')+
    waBtn((title?title+' ':'')+location.href)+
    '</div></div>';
}
function initDual(it){
  var fo=$('#fo'),ft=$('#ft'); if(!fo) return;
  var d=dual={o:null,t:null,timer:null,started:false,lastT:-1,stall:0,rate:1,it:it,apply:null};
  function oTime(){try{return d.o.getCurrentTime()||0}catch(e){return 0}}
  function target(){return oTime()+(it.ini||0)}
  d.apply=function(){};
  /* Tudo o que a pessoa faz no player do YouTube (play, pausa, barra, velocidade, repetir) é copiado para o intérprete */
  function tick(){
    if(!d.o||!d.o.getPlayerState) return;
    var st=d.o.getPlayerState(),t=oTime();
    /* anúncio ou travamento: o vídeo diz que toca, mas o tempo não anda */
    if(st===1||st===3){ if(Math.abs(t-d.lastT)<0.01) d.stall+=250; else d.stall=0; } else d.stall=0;
    d.lastT=t;
    var playing=(st===1)&&d.stall<1000;
    if(!d.t) return;
    var r=1;try{r=d.o.getPlaybackRate()||1}catch(e){}
    if(r!==d.rate){d.rate=r;try{d.t.setPlaybackRate(r)}catch(e){}}
    var ts=-2;try{ts=d.t.getPlayerState()}catch(e){}
    if(playing){
      var tt=target(),tc=0;try{tc=d.t.getCurrentTime()||0}catch(e){}
      if(ts!==1&&ts!==3){try{d.t.seekTo(tt,true);d.t.playVideo()}catch(e){}}
      else if(Math.abs(tc-tt)>0.7*r){try{d.t.seekTo(tt,true)}catch(e){}}
    } else if(ts===1||ts===3){ try{d.t.pauseVideo()}catch(e){} }
  }
  function start(){
    if(d.started) return; d.started=true;
    fo.innerHTML='';
    var so=document.createElement('div');fo.appendChild(so);
    var st=null;
    if(ft&&it.terp){ft.innerHTML='';st=document.createElement('div');ft.appendChild(st)}
    ytReady(function(){
      if(dual!==d) return;
      d.o=mkPlayer(so,it.orig,{autoplay:1,controls:1,title:'Vídeo original',
        onState:function(s){if(s===0&&d.t){try{d.t.pauseVideo()}catch(e){}}},
        onError:function(){unavailable(fo)}});
      if(st) d.t=mkPlayer(st,it.terp,{autoplay:0,controls:0,mute:1,start:Math.floor(it.ini||0),title:'Intérprete de Libras',
        onError:function(){unavailable(ft)}});
      d.timer=setInterval(tick,250);
    });
  }
  d.start=start;
  fo.addEventListener('click',function(e){if(e.target.closest('.poster'))start()});
  if(ft&&it.terp) ft.addEventListener('click',function(e){if(e.target.closest('.poster'))start()});
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
  var l=D.sinais.filter(function(x){return !x.soon}).sort(function(a,b){
    if(a.data&&b.data&&a.data!==b.data) return a.data<b.data?1:-1;
    if(!!a.data!==!!b.data) return a.data?-1:1;
    return b.ordem-a.ordem;
  });
  return l;
}
function isNew(s){
  if(!s.data) return false;
  var d=new Date(s.data+'T00:00:00');return !isNaN(d)&&(Date.now()-d.getTime())<14*864e5;
}
function head(h){return '<h1>'+h+'</h1><hr class="rule">'}
var DEF_WHATS='https://whatsapp.com/channel/0029VaGE5bbHwXb8n4YcpC3G',DEF_TELEGRAM='https://t.me/+HBcOID9aNCZlMDc5';
/* Carrossel de destaque do Dual Play (usado no início e na página Conteúdo Dual Play) */
function spotHtml(){
  var dest=D.acess.map(function(a,i){return {a:a,i:i}}).filter(function(x){return x.a.destaque}).slice(0,3);
  if(!dest.length) dest=D.acess.slice(0,3).map(function(a,i){return {a:a,i:i}});
  if(!dest.length) return '';
  var slides=dest.map(function(x,k){return '<a class="slide'+(k===0?' on':'')+'" href="#video-acessibilidade-'+(x.i+1)+'" style="background-image:linear-gradient(to top,rgba(6,14,34,.9),rgba(6,14,34,.1)),url('+thumb(x.a.orig)+');background-size:cover;background-position:center"><span class="play">'+PLAY+'</span><span class="name">'+esc(x.a.titulo)+'</span><span class="sub">'+esc(x.a.canal)+'</span></a>'}).join('');
  var dots=dest.map(function(x,k){return '<button type="button" data-dot="'+k+'" aria-label="Destaque '+(k+1)+'"'+(k===0?' aria-current="true"':'')+'></button>'}).join('');
  return '<div class="spot" id="spot" aria-roledescription="carrossel">'+slides+'<div class="dots">'+dots+'</div></div>';
}
/* Recomendamos: círculos com a logo do canal e o nome embaixo, rolando para o lado */
function recHtml(){
  if(!D.rec.length) return '';
  var items=D.rec.map(function(r){
    var ini=esc((r.nome.match(/[A-Za-zÀ-ÿ0-9]/)||['?'])[0].toUpperCase());
    var img=/^(https?:\/\/|[\w\-./]+\.(png|jpe?g|webp|svg|gif)$)/i.test(r.logo)?'<img src="'+esc(r.logo)+'" alt="" loading="lazy" onerror="this.remove()">':'';
    return '<a class="rec" href="'+esc(r.link)+'" target="_blank" rel="noopener" aria-label="'+esc(r.nome)+' no YouTube"><span class="rimg">'+ini+img+'</span><span class="rname">'+esc(r.nome)+'</span></a>';
  }).join('');
  return '<section class="section"><div class="section-head"><h2>Recomendamos</h2></div><hr class="rule"><div class="recrow" role="list" aria-label="Canais recomendados">'+items+'</div></section>';
}
/* Equipe: cartão de integrante (foto opcionalmente leva ao Instagram) */
var SILH='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
var IGICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>';
function igLink(v){
  v=String(v||'').trim();if(!v) return '';
  if(/^https?:\/\//i.test(v)) return v;
  v=v.replace(/^@/,'').replace(/^(www\.)?instagram\.com\//i,'').replace(/[\/?#].*$/,'');
  return /^[\w.]+$/.test(v)?'https://www.instagram.com/'+v:'';
}
function memberHtml(r){
  var nm=String(f(r,'nome')),role=String(f(r,'surdo')),ph=String(f(r,'foto')).trim(),ig=igLink(f(r,'instagram'));
  if(!nm) return '';
  var photo='<div class="photo">'+SILH+(ph?'<img src="'+esc(ph)+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()">':'')+'</div>';
  var pw=ig?'<a class="pw" href="'+esc(ig)+'" target="_blank" rel="noopener" aria-label="Instagram de '+esc(nm)+'">'+photo+'<span class="igb">'+IGICON+'</span></a>':'<div class="pw">'+photo+'</div>';
  return '<div class="member">'+pw+'<div class="who">'+esc(nm)+'</div>'+(role?'<span class="role '+(/^surd/.test(norm(role))?'surdo':'ouvinte')+'">'+esc(role)+'</span>':'')+'</div>';
}
/* Temas na tela inicial: 5 por vez, em rodízio a cada abertura do app */
var TEMAS_POR_VEZ=5,TEMA_INI=0;
try{TEMA_INI=parseInt(localStorage.getItem('cl_tema_ini'),10)||0;localStorage.setItem('cl_tema_ini',String(TEMA_INI+TEMAS_POR_VEZ))}catch(e){}
function rodizio(list){
  var n=list.length;if(n<=TEMAS_POR_VEZ) return list;
  var st=TEMA_INI%n,out=[],i;
  for(i=0;i<n;i++) out.push(list[(st+i)%n]);
  return out;
}
var views={
  inicio:function(){
    var hk=(D.temasHome.length?D.temasHome:Object.keys(D.temas)).filter(function(k){return D.temas[k]&&D.sinais.some(function(x){return x.temas.indexOf(k)>-1})});
    var th=rodizio(hk).map(function(k,i){var t=themeTile(k);return i<TEMAS_POR_VEZ?t:t.replace(/^<a /,'<a hidden ')}).join('');
    var moreTh=hk.length>TEMAS_POR_VEZ?'<div class="morewrap"><button type="button" class="morebtn" id="moreth" aria-label="Mostrar mais temas" title="Mostrar mais temas">+</button></div>':'';
    var RL=recentList(),PAGE=6,spot=spotHtml();
    var rec=RL.map(function(s,i){var t=signTile(s,isNew(s));return i<PAGE?t:t.replace(/^<a /,'<a hidden ')}).join('');
    var more=RL.length>PAGE?'<div class="morewrap"><button type="button" class="morebtn" id="more" aria-label="Mostrar mais vídeos" title="Mostrar mais vídeos">+</button></div>':'';
    return '<section class="hero">'+
      '<div class="search hero-search"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l4 4"/></svg>'+
      '<input id="qh" type="search" placeholder="Buscar sinal pelo nome" autocomplete="off" aria-label="Buscar sinal pelo nome"><div id="resultsh" class="results" hidden></div></div>'+
      '<div class="actions" style="margin-top:0"><a class="btn" href="#catalogo">Explorar o catálogo</a><a class="btn ghost" href="#patristica">Patrística</a><a class="btn ghost" href="#oracao-eucaristica">Oração Eucarística</a><a class="btn ghost" href="#acessibilidade">Conteúdo Dual Play</a></div></section>'+
      (spot?'<section class="section spotsec">'+spot+'</section>':'')+
      (rec?'<section class="section"><div class="section-head"><h2>Últimos vídeos</h2></div><hr class="rule"><div class="grid compact" id="recent">'+rec+'</div>'+more+'</section>':'')+
      (th?'<section class="section"><div class="section-head"><h2>Temas</h2></div><hr class="rule"><div class="grid wide" id="temasgrid">'+th+'</div>'+moreTh+'</section>':'')+
      recHtml();
  },
  sobre:function(){
    var SIL='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>';
    var team=D.equipe.map(function(r){
      var nm=String(f(r,'nome')),role=String(f(r,'surdo')),ph=String(f(r,'foto')).trim();
      if(!nm) return '';
      return '<div class="member"><div class="photo">'+SIL+(ph?'<img src="'+esc(ph)+'" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()">':'')+'</div><div class="who">'+esc(nm)+'</div>'+(role?'<span class="role '+(/^surd/.test(norm(role))?'surdo':'ouvinte')+'">'+esc(role)+'</span>':'')+'</div>';
    }).join('');
    var txt=D.cfg.texto_sobre?'<p>'+esc(D.cfg.texto_sobre).replace(/\n+/g,'</p><p>')+'</p>':
      '<p>Em 2016, durante um intercâmbio de experiências entre intérpretes católicos de LIBRAS da Arquidiocese de Brasília, surgiu o desejo de reunir os estudos e reflexões acumulados ao longo dos anos sobre a vivência da fé em LIBRAS.</p>'+
      '<p>Formou-se então um grupo de trabalho, composto majoritariamente por surdos engajados na missão evangelizadora, junto a intérpretes comprometidos com o discipulado. Com dedicação e amor à Igreja, o grupo se empenhou na validação dos sinais com participação ativa da comunidade surda.</p>'+
      '<p>O CatLibras não tem como objetivo padronizar os sinais, mas sim catalogar aqueles utilizados e compreendidos pela comunidade surda católica. Deseja ser uma fonte confiável e pastoral, acessível a todos os que buscam servir e viver a fé de forma inclusiva. É um passo concreto rumo a uma Igreja mais acolhedora, onde surdos e intérpretes caminham juntos como discípulos missionários.</p>';
    return head('Sobre')+'<div class="about">'+txt+'</div>'+entidadesHtml();
  },
  equipe:function(){
    var isInt=function(r){return /^intercess/.test(norm(f(r,'grupo')))};
    var team=D.equipe.filter(function(r){return !isInt(r)}).map(memberHtml).join('');
    var inter=D.equipe.filter(isInt).map(memberHtml).join('');
    return head('Nossa equipe')+(team?'<div class="team">'+team+'</div>':(inter?'':'<p class="note">Em breve.</p>'))+
      (inter?'<h2 class="subhead">Intercessores</h2><div class="team">'+inter+'</div>':'');
  },
  contato:function(){
    var TGICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
    var items=[['Canal no WhatsApp',D.cfg.contato_whatsapp||DEF_WHATS,WAICON],['Fórum CatLIBRAS no Telegram',D.cfg.contato_telegram||DEF_TELEGRAM,TGICON]];
    var h=items.filter(function(x){return /^https:\/\//i.test(String(x[1]).trim())}).map(function(x){
      return '<div class="contato-item"><h2>'+esc(x[0])+'</h2><a class="btn wa contato-ic" href="'+esc(String(x[1]).trim())+'" target="_blank" rel="noopener" aria-label="'+esc(x[0])+'" title="'+esc(x[0])+'">'+x[2]+'</a></div>';
    }).join('');
    return head('Contato')+(h?'<div class="contato">'+h+'</div>':'<p class="note">Em breve.</p>');
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
    var g=D.acess.map(function(a,i){return videoTile('#video-acessibilidade-'+(i+1),a.titulo,a.capa,'ac'+i)}).join('');
    return head('Conteúdo Dual Play')+spotHtml()+
      (g?'<div class="grid compact" style="margin-top:26px">'+g+'</div>':'<p class="note">Em breve.</p>');
  }
};
function sinalView(s){
  var th=(lastTheme&&s.temas.indexOf(lastTheme)>-1)?lastTheme:s.temas[0];
  var pn='';
  if(th){
    var lst=sorted(D.sinais.filter(function(x){return !x.soon&&x.temas.indexOf(th)>-1})),ix=0,q;
    for(q=0;q<lst.length;q++){if(lst[q].id===s.id)ix=q}
    var pv=lst[ix-1],nx=lst[ix+1];
    pn='<nav class="pn" aria-label="Anterior e próximo em '+esc(D.temas[th].nome)+'">'+
      (pv?'<a href="#sinal-'+pv.id+'"><small><span class="ar">《</span> Anterior</small><b>'+esc(label(pv))+'</b></a>':'<span class="off"></span>')+
      (nx?'<a class="nx" href="#sinal-'+nx.id+'"><small>Próximo <span class="ar">》</span></small><b>'+esc(label(nx))+'</b></a>':'<span class="off"></span>')+'</nav>';
  }
  var tags=s.temas.map(function(k){return '<li><a href="#tema-'+k+'">'+esc(D.temas[k].nome)+'</a></li>'}).join('');
  var vars=(D.raw.variacoes||[]).filter(function(r){return (slug(f(r,'sinal'))===slug(s.titulo)||slug(nomePrincipal(String(f(r,'sinal'))))===slug(s.nome))&&ytid(f(r,'link'))&&norm(f(r,'ativo'))!=='nao'}).sort(function(a,b){return num(f(a,'ordem'),99)-num(f(b,'ordem'),99)});
  var reg=vars.map(function(r){
    var id=ytid(f(r,'link')),code=String(f(r,'bandeira')).trim(),lugar=String(f(r,'nome do lugar')||code);
    var flag=code?'<span class="flag" style="background:#1d2f5c">'+esc(code.slice(0,3).toUpperCase())+'<img src="bandeiras/'+esc(code.toUpperCase())+'.png" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" onerror="this.remove()"></span>':'';
    return '<a class="tile cov" href="#" data-video="'+esc(lugar)+'" data-yt="'+id+'">'+cover({img:thumb(id),x:'50%',y:'50%',z:1},id)+flag+'<span class="play">'+PLAY+'</span><span class="name">'+esc(lugar)+'</span></a>';
  }).join('');
  return '<div class="sp"><p class="eyebrow">Sinal</p><h1>'+esc(label(s))+'</h1>'+(tags?'<ul class="tags">'+tags+'</ul>':'')+
    '<div class="solo"><div class="frame live" id="sf">'+poster(s.yt,'Reproduzir '+label(s))+'</div>'+
    vctl(waBtn('https://youtu.be/'+s.yt))+pn+'</div>'+
    (reg?'<section class="section"><div class="section-head"><h2>Variações</h2></div><hr class="rule"><div class="grid small">'+reg+'</div></section>':'')+
    commentsBlock('sinal-'+s.id,true)+'</div>';
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
    var v=D.patr[mt[1]][mt[2]-1],pm=mt[1],pi=+mt[2],pl=D.patr[pm].length;html=dualView('#patristica-'+pm,v,v.nome,pi>1?'#video-patristica-'+pm+'-'+(pi-1):'',pi<pl?'#video-patristica-'+pm+'-'+(pi+1):'');nav='patristica';after=function(){initDual(v)};
  } else if((mt=h.match(/^video-acessibilidade-(\d+)$/))&&D.acess[mt[1]-1]){
    var ai=+mt[1],a=D.acess[ai-1];html=dualView('#acessibilidade',a,a.titulo,ai>1?'#video-acessibilidade-'+(ai-1):'',ai<D.acess.length?'#video-acessibilidade-'+(ai+1):'');nav='acessibilidade';after=function(){initDual(a)};
  } else if(views[h]){
    html=views[h]();nav=({catalogo:'catalogo','oracao-eucaristica':'oracao',patristica:'patristica',acessibilidade:'acessibilidade'})[h]||'';
  } else { html=views.inicio(); }
  app.innerHTML=html;
  var hq=$('#qh'); if(hq) setupSearch(hq,$('#resultsh'));
  $('nav.menu').hidden=!!hq;
  document.body.classList.toggle('watch',h.indexOf('video-')===0);
  document.body.classList.toggle('home',!!hq);
  document.body.classList.toggle('solopage',h.indexOf('sinal-')===0);
  document.querySelectorAll('nav.menu a').forEach(function(x){if(x.getAttribute('data-nav')===nav) x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
  closeVideo();initSpot();maybeInstBar();
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
  if(e.target.closest&&e.target.closest('#more')){
    var hid=document.querySelectorAll('#recent > [hidden]'),n=Math.min(6,hid.length),i;
    for(i=0;i<n;i++) hid[i].hidden=false;
    if(hid.length<=6){var mb=$('#more');if(mb) mb.parentNode.remove()}
  }
  if(e.target.closest&&e.target.closest('#moreth')){
    document.querySelectorAll('#temasgrid > [hidden]').forEach(function(t){t.hidden=false});
    var mt=$('#moreth');if(mt) mt.parentNode.remove();
  }
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
    var hit=sorted(D.sinais.filter(function(s){return norm(label(s)).indexOf(v)>-1||norm(s.titulo).indexOf(v)>-1||norm(s.sinonimos).indexOf(v)>-1})).sort(function(a,b){return (a.soon?1:0)-(b.soon?1:0)}).slice(0,8);
    res.innerHTML=hit.length?hit.map(function(s){var sm='<small>'+(s.soon?'Em breve':esc(s.temas.map(function(k){return D.temas[k].nome}).join(', ')))+'</small>';return s.soon?'<span class="soonres">'+esc(label(s))+sm+'</span>':'<a href="#sinal-'+s.id+'">'+esc(label(s))+sm+'</a>'}).join(''):'<p>Nenhum sinal encontrado.</p>';
    res.hidden=false;
  });
  q.addEventListener('keydown',function(e){if(e.key==='Escape'){closeAll();q.blur()}});
  res.addEventListener('click',function(){setTimeout(function(){q.value='';closeAll()},0)});
}
document.addEventListener('click',function(e){if(!e.target.closest('.search'))closeAll()});

/* ---------- instalar na tela inicial ---------- */
var deferredInstall=null,installDismissed=false;
function standalone(){return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function removeInstBar(){var b=$('#instbar');if(b)b.remove()}
function showInstBar(forceHelp){
  removeInstBar();
  if(standalone()) return;
  var help=forceHelp||!deferredInstall;
  var msg=help?(isIOS()?'Para instalar: toque em Compartilhar (quadrado com seta) e depois em Adicionar à Tela de Início.':'Para instalar: abra o menu do navegador (três pontinhos) e escolha Instalar app ou Adicionar à tela inicial.'):'Instalar o Catlibras na tela inicial do aparelho?';
  var bar=document.createElement('div');bar.id='instbar';bar.className='instbar';bar.setAttribute('role','region');bar.setAttribute('aria-label','Instalar aplicativo');
  bar.innerHTML='<p>'+msg+'</p><div class="row">'+(help?'':'<button type="button" class="btn small" id="instgo">Instalar</button>')+'<button type="button" class="btn small ghost" id="instno">'+(help?'Entendi':'Agora não')+'</button></div>';
  document.body.appendChild(bar);
  var go=$('#instgo');
  if(go) go.addEventListener('click',function(){
    var d=deferredInstall;deferredInstall=null;removeInstBar();
    if(d){d.prompt();d.userChoice&&d.userChoice.then(function(){})}
  });
  $('#instno').addEventListener('click',function(){installDismissed=true;removeInstBar()});
}
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredInstall=e;if(!standalone()&&!installDismissed&&$('#qh')) showInstBar()});
window.addEventListener('appinstalled',function(){deferredInstall=null;removeInstBar();var l=$('#instl');if(l) l.hidden=true});
var instl=$('#instl');
if(instl&&!standalone()){
  instl.hidden=false;
  instl.addEventListener('click',function(e){e.preventDefault();showInstBar(!deferredInstall)});
}
/* a cada abertura do site, na página inicial, a pergunta volta (em iPhone, só a orientação) */
function maybeInstBar(){
  removeInstBar();
  if(standalone()||installDismissed||!$('#qh')) return;
  if(deferredInstall||isIOS()) showInstBar();
}

/* ---------- realização e apoio (final da página Sobre) ---------- */
function entidadesHtml(){
  var h='';
  [['realizacao','Realização'],['apoio','Apoio']].forEach(function(p){
    var img=String(D.cfg[p[0]+'_imagem']||'').trim();if(!img) return;
    var nome=String(D.cfg[p[0]+'_nome']||p[1]).trim(),link=String(D.cfg[p[0]+'_link']||'').trim();
    var im='<img src="'+esc(img)+'" alt="'+esc(nome)+'" loading="lazy">';
    h+='<div class="entidade"><p class="ent-t">'+p[1]+'</p><div class="ent-box">'+(/^https?:\/\//i.test(link)?'<a href="'+esc(link)+'" target="_blank" rel="noopener" aria-label="'+esc(nome)+'">'+im+'</a>':im)+'</div></div>';
  });
  return h?'<div class="entidades">'+h+'</div>':'';
}

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
