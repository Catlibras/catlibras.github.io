/* Site Catlibras. Lê a planilha do Google (ou os dados de teste) e monta as páginas. */
(function(){
'use strict';
var CFG = window.CATLIBRAS || {};
var $ = function(s,r){return (r||document).querySelector(s)};
var app = $('#app');
var BUILD="2026-11-07a";
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
window.ytOk=function(im,err){var id=im.getAttribute('data-id'),st=+(im.getAttribute('data-s')||0),u=['hq720','mqdefault','hqdefault','sddefault'];
  if((err||(im.naturalWidth&&im.naturalWidth<=120))&&st<u.length-1){im.setAttribute('data-s',st+1);im.src='https://i.ytimg.com/vi/'+id+'/'+u[st+1]+'.jpg'}};
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
  var tabs=['Sinais','Variações','Patrística','Oração Eucarística','Acessibilidade','Temas','Equipe','Configurações','Recomendamos','Catequeses','Grupos de catequese','Tendências'];
  return Promise.all(tabs.map(function(t){return fetchTab(t).catch(function(){return null})})).then(function(r){
    if(!r[0]&&!r[2]) throw new Error('offline');
    return {raw:{sinais:r[0]||[],variacoes:r[1]||[],patristica:r[2]||[],eucaristica:r[3]||[],acessibilidade:r[4]||[],temas:r[5]||[],equipe:r[6]||[],config:r[7]||[],recomendamos:r[8]||[],catequeses:r[9]||[],grupos:r[10]||[],tendencias:r[11]||[]},source:'planilha'};
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
    recomendamos:[],
    catequeses:[],
    grupos:[]
  };
}

/* ---------- modelo ---------- */
var D={sinais:[],temas:{},patr:{},euc:[],acess:[],equipe:[],rec:[],cfg:{},prefixos:[],cat:[],catBy:{},grupos:[],gBy:{}};
var DEFAULT_PREF='padre, irmã, irmão, ir, frei, dom, dra, dr, madre, monsenhor, cardeal, papa, beato, beata, são, santo, santa, santas, santos';
function ytimg(id){return 'https://i.ytimg.com/vi/'+id+'/hq720.jpg'}
function imgUrl(u){
  var m=String(u||'').match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]{20,})/);
  return m?'https://lh3.googleusercontent.com/d/'+m[1]:String(u||'');
}
function capaOf(r,fallbackId,def){
  var img=imgUrl(String(f(r,'capa (link')||'').trim());
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
      sinonimos:String(f(r,'sinonimos')||''),dest:yes(f(r,'destaque')),dia:String(f(r,'dia de celebracao')||''),temas:temas,yt:publicado?yt:'',soon:!publicado,data:publicado?data:'',capa:capaOf(r,publicado?yt:'',CAPA_SINAL),ordem:i});
  });
  D.patr={};
  raw.patristica.filter(function(r){return norm(f(r,'ativo'))!=='nao'}).forEach(function(r){
    var m=String(f(r,'modulo')).trim(),o=ytid(f(r,'link do original'));
    if(!m||!o) return;
    (D.patr[m]=D.patr[m]||[]).push({ordem:num(f(r,'ordem'),999),nome:String(f(r,'nome')||('Vídeo')),orig:o,terp:ytid(f(r,'link do interprete')),ini:num(f(r,'inicio'),0),dest:yes(f(r,'destaque')),capa:capaOf(r,o)});
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
  /* Catequeses: grupos (barras) e vídeos do canal da paróquia */
  D.cat=[];D.catBy={};D.grupos=[];D.gBy={};
  /* Tendências (calculadas pela planilha): sinais com procura em alta nesta época, do maior para o menor */
  D.trend=(raw.tendencias||[]).filter(function(r){return norm(f(r,'em alta'))==='sim'}).map(function(r){return {id:String(f(r,'sinal')||'').replace(/^\/?sinal-/,''),pos:num(f(r,'posicao'),99)}}).sort(function(a,b){return a.pos-b.pos});
  (raw.grupos||[]).filter(function(r){return norm(f(r,'ativo'))!=='nao'}).forEach(function(r,i){
    var nome=String(f(r,'grupo')).trim();if(!nome) return;
    var lv=norm(f(r,'leva')),g={id:slug(nome),nome:nome,desc:String(f(r,'descricao')||''),leva:/patr/.test(lv)?'patr':(/dual|acess/.test(lv)?'dual':''),ordem:num(f(r,'ordem'),999),data:String(f(r,'data de')||'').slice(0,10),capa:capaOf(r,''),i:i};
    D.grupos.push(g);D.gBy[g.id]=g;
  });
  D.grupos.sort(function(a,b){return a.ordem-b.ordem||a.i-b.i});
  (raw.catequeses||[]).filter(function(r){return norm(f(r,'ativo'))!=='nao'}).forEach(function(r,i){
    var yt=ytid(f(r,'link')),t=String(f(r,'titulo')).trim();if(!yt||!t) return;
    var id=slug(t)||('c'+i);if(D.catBy[id]) id=id+'-'+(i+1);
    var gid=slug(f(r,'grupo'));
    var c={id:id,titulo:t,yt:yt,g:D.gBy[gid]?gid:'',ordem:num(f(r,'ordem'),999),dia:String(f(r,'dia de celebracao')||''),dest:yes(f(r,'destaque')),data:String(f(r,'data de')||'').slice(0,10),capa:capaOf(r,yt),i:i};
    D.cat.push(c);D.catBy[id]=c;
  });
  D.grupos.forEach(function(g){
    if(g.capa.img||g.capa.yt) return;
    var first=null;
    if(g.leva==='patr'){var ms=Object.keys(D.patr).sort(function(a,b){return a-b});if(ms.length&&D.patr[ms[0]].length) first=D.patr[ms[0]][0].orig}
    else if(g.leva==='dual'){if(D.acess.length) first=D.acess[0].orig}
    else{var l=D.cat.filter(function(c){return c.g===g.id}).sort(function(a,b){return a.ordem-b.ordem||a.i-b.i});if(l.length) first=l[0].yt}
    if(first) g.capa.yt=first;
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
  if(c.yt) return '<span class="cover" style="'+st+'background-color:hsl('+hh+' 42% 16%)"><img class="cimg" src="'+ytimg(c.yt)+'" data-id="'+c.yt+'" alt="" loading="lazy" onload="ytOk(this)" onerror="ytOk(this,1)"></span>';
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
function videoTile(href,name,c,seed,attr,ord,nw){
  return '<a class="tile cov" href="'+href+'"'+(attr||'')+'>'+cover(c,seed)+(ord?'<span class="ord">'+ord+'</span>':'')+(nw?'<span class="newtag'+(ord?' l':'')+'">Novo</span>':'')+'<span class="play">'+PLAY+'</span><span class="name">'+esc(name)+'</span></a>';
}
var SHARE_PAGES=['a-biblia','catecismo-da-igreja-catolica','dogma-da-redencao','escatologia','missa-parte-por-parte','sao-jose','teologia-do-corpo'];
function shareLink(id){return SHARE_PAGES.indexOf(id)>-1?location.origin+'/compartilhar/'+id+'.html':location.href}
function headShare(h,txt){return '<div class="hs"><h1>'+h+'</h1>'+waBtn(txt,'Compartilhar esta série')+'</div><hr class="rule">'}
function rowTile(href,name,c,seed,ord,nw){
  return '<a class="srow" href="'+href+'"><span class="tile cov vt">'+cover(c,seed)+(ord?'<span class="ord">'+ord+'</span>':'')+(nw?'<span class="newtag'+(ord?' l':'')+'">Novo</span>':'')+'<span class="play">'+PLAY+'</span></span><span class="stt">'+esc(name)+'</span></a>';
}
function catTile(c,ord){return '<a class="vcell" href="#catequese-'+c.id+'" aria-label="'+esc(c.titulo)+'"><span class="tile cov vt">'+cover(c.capa,'c'+c.id)+(ord?'<span class="ord">'+ord+'</span>':'')+(newDate(c.data)?'<span class="newtag'+(ord?' l':'')+'">Novo</span>':'')+'<span class="play">'+PLAY+'</span></span><span class="vtt">'+esc(c.titulo)+'</span></a>'}
function gCount(g){return g.leva==='patr'?Object.keys(D.patr).length:(g.leva==='dual'?D.acess.length:D.cat.filter(function(c){return c.g===g.id}).length)}
function gBar(g){
  var n=gCount(g);if(!n) return '';
  var href=g.leva==='patr'?'#patristica':(g.leva==='dual'?'#acessibilidade':'#catequeses-'+g.id);
  var sub=g.leva==='patr'?(n+(n===1?' módulo':' módulos')):(n+(n===1?' vídeo':' vídeos'));
  return '<a class="tile theme cov" href="'+href+'">'+cover(g.capa,'g'+g.id)+(newDate(g.data,g.leva==='patr'?183:7)?'<span class="newtag">Novo</span>':'')+'<span class="name">'+esc(g.nome)+'</span><span class="sub">'+esc(g.desc||sub)+'</span></a>';
}
var WAICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
function waBtn(text,label){return '<a class="btn small wa" data-share="'+esc(text)+'" href="https://wa.me/?text='+encodeURIComponent(text)+'" target="_blank" rel="noopener" aria-label="'+(label||'Compartilhar')+'" title="'+(label||'Compartilhar')+'">'+WAICON+'</a>'}
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
/* Patrística: ao fim do vídeo, avisa e passa ao próximo em 5 segundos (dá para cancelar) */
function autoNext(d,href){
  if(d.an||dual!==d) return;
  var n=5,box=document.createElement('div');box.className='autonext';box.setAttribute('role','status');
  box.innerHTML='<p>Próximo vídeo em <b id="ancount">5</b> segundos.</p><a class="btn small" href="'+href+'">Ir agora</a><button type="button" class="btn small ghost" id="ancancel">Cancelar</button>';
  var pg=$('.dualpage');if(!pg) return;pg.appendChild(box);
  d.an=setInterval(function(){n--;var c=$('#ancount');if(c)c.textContent=n;if(n<=0){clearInterval(d.an);d.an=null;location.hash=href}},1000);
  $('#ancancel').addEventListener('click',function(){clearInterval(d.an);d.an=null;box.remove()});
}
function stopDual(){
  if(!dual) return;
  clearInterval(dual.an);
  clearInterval(dual.timer);
  [dual.o,dual.t].forEach(function(p){try{p&&p.destroy()}catch(e){}});
  dual=null;
}
function dualView(back,it,title,prev,next,canal){
  var home='<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-6h4v6"/></svg>';
  var sw=false;try{sw=localStorage.getItem('cl_swap')==='1'}catch(e){}
  var cred=it.solo?'':'<p class="credit">Vídeo original'+(canal?' do canal '+esc(canal):'')+': <a href="https://youtu.be/'+esc(it.orig)+'" target="_blank" rel="noopener">assistir no YouTube</a>. Tradução em Libras: Catlibras.</p>';
  return '<div class="dualpage"><div class="dual"><div class="pair'+(it.solo?' one':(sw?' swap':''))+'">'+
    '<div class="frame live orig" id="fo">'+poster(it.orig,it.solo?'Reproduzir':'Reproduzir os dois vídeos')+'</div>'+
    (it.solo?'':(it.terp?'<div class="frame live terp" id="ft">'+poster(it.terp,'Reproduzir os dois vídeos')+'</div>':'<div class="frame live terp soonbox" id="ft"><span>Em breve - Tradução em Libras</span></div>'))+
    '</div></div>'+
    '<div class="player-bar" id="pbar" role="group" aria-label="Navegação">'+
    '<a class="btn small ghost ctl-home" href="#inicio" aria-label="Início">'+home+'</a>'+
    (prev?'<a class="btn small ghost" href="'+prev+'" rel="prev"><span class="ar">《</span> Anterior</a>':'')+
    (next?'<a class="btn small ghost" href="'+next+'" rel="next">Próximo <span class="ar">》</span></a>':'')+
    (it.terp?'<button type="button" class="btn small ghost" id="swp" aria-pressed="'+(sw?'true':'false')+'" aria-label="'+(sw?'Diminuir o intérprete':'Aumentar o intérprete')+'">'+(sw?'Libras \u2212':'Libras +')+'</button>':'')+
    waBtn((title?title+' ':'')+location.href)+
    '</div>'+cred+'</div>';
}
function initDual(it,nextHref){
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
        onState:function(s){if(s===0&&d.t){try{d.t.pauseVideo()}catch(e){}}if(s===0&&nextHref) autoNext(d,nextHref)},
        onError:function(){unavailable(fo)}});
      if(st) d.t=mkPlayer(st,it.terp,{autoplay:0,controls:0,mute:1,start:Math.floor(it.ini||0),title:'Intérprete de Libras',
        onError:function(){unavailable(ft)}});
      d.timer=setInterval(tick,250);
    });
  }
  d.start=start;
  var sb=$('#swp');
  if(sb) sb.addEventListener('click',function(){
    var pr=$('.pair'),on=!pr.classList.contains('swap');
    pr.classList.toggle('swap',on);sb.setAttribute('aria-pressed',on?'true':'false');sb.setAttribute('aria-label',on?'Diminuir o intérprete':'Aumentar o intérprete');sb.textContent=on?'Libras \u2212':'Libras +';
    try{localStorage.setItem('cl_swap',on?'1':'0')}catch(e){}
  });
  fo.addEventListener('click',function(e){if(e.target.closest('.poster'))start()});
  if(ft&&it.terp) ft.addEventListener('click',function(e){if(e.target.closest('.poster'))start()});
}

/* ---------- comentários ---------- */
var pageStart=0;
var UFS=[['AC','Acre'],['AL','Alagoas'],['AP','Amapá'],['AM','Amazonas'],['BA','Bahia'],['CE','Ceará'],['DF','Distrito Federal'],['ES','Espírito Santo'],['GO','Goiás'],['MA','Maranhão'],['MT','Mato Grosso'],['MS','Mato Grosso do Sul'],['MG','Minas Gerais'],['PA','Pará'],['PB','Paraíba'],['PR','Paraná'],['PE','Pernambuco'],['PI','Piauí'],['RJ','Rio de Janeiro'],['RN','Rio Grande do Norte'],['RS','Rio Grande do Sul'],['RO','Rondônia'],['RR','Roraima'],['SC','Santa Catarina'],['SP','São Paulo'],['SE','Sergipe'],['TO','Tocantins']];
var PEND_DIAS=5;
function pendGet(){try{return JSON.parse(localStorage.getItem('cl_pend')||'[]').filter(function(x){return Date.now()-x.t<PEND_DIAS*864e5})}catch(e){return []}}
function pendSet(a){try{localStorage.setItem('cl_pend',JSON.stringify(a))}catch(e){}}
function rnd(){var a=new Uint8Array(16);try{crypto.getRandomValues(a)}catch(e){for(var i=0;i<16;i++)a[i]=Math.floor(Math.random()*256)}return Array.prototype.map.call(a,function(x){return ('0'+x.toString(16)).slice(-2)}).join('')}
function ownGet(){try{return JSON.parse(localStorage.getItem('cl_own')||'{}')}catch(e){return {}}}
function ownSet(o){try{localStorage.setItem('cl_own',JSON.stringify(o))}catch(e){}}
var CMKEY='';
function cmSend(body){body.pagina=CMKEY;body.site='';body.tempo=Date.now()-pageStart;return fetch(CFG.COMENTARIOS_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)})}
function cmActions(li,c){
  var k=ownGet()[c.id];if(!c.id||!k) return;
  var bar=document.createElement('div');bar.className='cact';
  var be=document.createElement('button'),bd=document.createElement('button');
  be.type=bd.type='button';be.textContent='Editar';bd.textContent='Apagar';
  if(!c.texto) be.hidden=true;
  bar.appendChild(be);bar.appendChild(bd);li.appendChild(bar);
  bd.addEventListener('click',function(){
    if(!confirm('Apagar este comentário?')) return;
    cmSend({acao:'apagar',id:c.id,chave:k}).then(function(){li.remove()}).catch(function(){alert('Não foi possível apagar agora.')});
  });
  be.addEventListener('click',function(){
    var p=li.querySelector('p');if(!p||li.querySelector('.cedit')) return;
    var box=document.createElement('div');box.className='cedit';
    var ta=document.createElement('textarea');ta.maxLength=1500;ta.value=p.textContent;
    var ok=document.createElement('button'),no=document.createElement('button');
    ok.type=no.type='button';ok.textContent='Salvar';no.textContent='Cancelar';ok.className='btn small';no.className='btn small ghost';
    var row=document.createElement('div');row.className='row';row.appendChild(ok);row.appendChild(no);box.appendChild(ta);box.appendChild(row);
    p.hidden=true;bar.hidden=true;li.insertBefore(box,bar);ta.focus();
    function close(){box.remove();p.hidden=false;bar.hidden=false}
    no.addEventListener('click',close);
    ok.addEventListener('click',function(){
      var t=ta.value.trim();if(!t){ta.focus();return}
      cmSend({acao:'editar',id:c.id,chave:k,texto:t}).then(function(){p.textContent=t;var sp=li.querySelector('span');if(sp&&!/editado/.test(sp.textContent))sp.textContent+=' · editado';close()}).catch(function(){alert('Não foi possível salvar agora.')});
    });
  });
}
function commentsBlock(key,withVideo){
  if(!CFG.COMENTARIOS_URL) return '';
  return '<section class="section"><section class="comments" aria-labelledby="ch"><h2 id="ch">Comentários</h2>'+
    '<form class="form" id="cform" novalidate>'+
    '<div><label for="cn">Seu nome</label><input type="text" id="cn" autocomplete="name" maxlength="60"></div>'+
    '<div><label for="ce">Seu Estado</label><select id="ce"><option value="">Escolha o Estado</option>'+UFS.map(function(u){return '<option value="'+u[0]+'">'+u[1]+'</option>'}).join('')+'<option value="Outro país">Outro país</option></select></div>'+
    '<div><label for="ct">Seu comentário</label><textarea id="ct" maxlength="1500"></textarea></div>'+
    '<div class="cform-hp" aria-hidden="true"><label>Não preencha<input type="text" id="chp" tabindex="-1" autocomplete="off"></label></div>'+
    '<div class="row"><button class="btn small" type="submit">Publicar comentário</button>'+
    (withVideo?'<label class="btn small ghost filebtn">Enviar vídeo<input type="file" id="cv" accept="video/*"></label>':'')+'</div>'+
    (withVideo?'<p class="note vhint" id="cvh" hidden>Envie um vídeo de até 15 segundos, com até 35 MB, mostrando como você faz este sinal em Libras. Ele aparece no site depois da aprovação da equipe.</p>':'')+
    '<p class="status" id="cs" role="status"></p></form>'+
    '<div class="pend" id="pend" hidden>Seu vídeo está em análise. Quando for aprovado, ele aparece neste espaço.</div>'+
    '<ul class="clist" id="clist"></ul></section></section>';
}
function addComment(c,top){
  var li=document.createElement('li'),b=document.createElement('b'),sp=document.createElement('span'),p=document.createElement('p');
  b.textContent=(c.nome||'Visitante')+(c.estado?' - '+c.estado:'');sp.textContent=(c.data||'')+(c.editado?' · editado':'');p.textContent=c.texto||'';
  li.appendChild(b);li.appendChild(sp);if(c.texto)li.appendChild(p);
  if(c.video){var m=String(c.video).match(/[-\w]{20,}/);if(m){var fr=document.createElement('iframe');fr.src='https://drive.google.com/file/d/'+m[0]+'/preview';fr.setAttribute('allow','autoplay');fr.style.cssText='width:100%;aspect-ratio:16/9;border:0;border-radius:4px;margin-top:8px';fr.title='Vídeo enviado';li.appendChild(fr)}}
  cmActions(li,c);
  var l=$('#clist');if(!l)return;
  if(top) l.insertBefore(li,l.firstChild); else l.appendChild(li);
}
function initComments(key){
  var form=$('#cform'); if(!form) return;
  CMKEY=key;
  fetch(CFG.COMENTARIOS_URL+'?pagina='+encodeURIComponent(key)).then(function(r){return r.json()}).then(function(j){var cs=j.comentarios||[];cs.forEach(function(c){addComment(c,false)});
    var pl=pendGet();if(pl.length){var rest=pl.filter(function(x){return !(x.k===key&&cs.some(function(c){return c.video&&c.nome===x.n}))});if(rest.length!==pl.length){pendSet(rest);showPend()}}}).catch(function(){});
  var st=$('#cs');
  function showPend(){var el=$('#pend');if(el)el.hidden=!pendGet().some(function(x){return x.k===key})}
  showPend();
  function post(body){
    body.pagina=key;var ce=$('#ce');if(ce&&ce.value)body.estado=ce.value;body.site=$('#chp').value;body.tempo=Date.now()-pageStart;
    return fetch(CFG.COMENTARIOS_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
  }
  function limited(){
    try{var a=JSON.parse(localStorage.getItem('cl_c')||'[]').filter(function(t){return Date.now()-t<60000});if(a.length>=4)return true;a.push(Date.now());localStorage.setItem('cl_c',JSON.stringify(a))}catch(e){}
    return false;
  }
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var t=$('#ct').value.trim(),n=$('#cn').value.trim();
    if(!n){st.textContent='Preencha seu nome.';$('#cn').focus();return}
    if(!$('#ce').value){st.textContent='Escolha o seu Estado.';$('#ce').focus();return}
    if(!t){st.textContent='Escreva o comentário antes de publicar.';return}
    if($('#chp').value||Date.now()-pageStart<3000){st.textContent='Tente de novo em instantes.';return}
    if(limited()){st.textContent='Muitos envios seguidos. Aguarde um minuto.';return}
    var nid=rnd(),nk=rnd();post({nome:n,texto:t,id:nid,chave:nk}).then(function(){ev('comentario-enviado');var ow=ownGet();ow[nid]=nk;ownSet(ow);addComment({id:nid,nome:n,estado:($('#ce')||{}).value||'',texto:t,data:'agora'},true);$('#ct').value='';st.textContent='Comentário enviado.'}).catch(function(){st.textContent='Não foi possível enviar agora.'});
  });
  var fv=$('#cv');
  function durOk(file,cb){
    var v=document.createElement('video'),u=URL.createObjectURL(file),done=false;
    function fin(ok){if(done)return;done=true;URL.revokeObjectURL(u);cb(ok)}
    v.preload='metadata';v.onloadedmetadata=function(){fin(!(v.duration>15.5))};v.onerror=function(){fin(true)};
    setTimeout(function(){fin(true)},4000);v.src=u;
  }
  if(fv) fv.addEventListener('click',function(e){
    var h=$('#cvh');if(h)h.hidden=false;
    if(!$('#cn').value.trim()||!($('#ce')||{}).value){e.preventDefault();st.textContent='Para enviar um vídeo, preencha seu nome e escolha o Estado. Depois toque em Enviar vídeo.';(!$('#cn').value.trim()?$('#cn'):$('#ce')).focus()}
  });
  if(fv) fv.addEventListener('change',function(){
    var file=fv.files&&fv.files[0]; if(!file) return;
    if(file.size>35*1024*1024){st.textContent='O vídeo é grande demais (máximo 35 MB).';fv.value='';return}
    durOk(file,function(ok){
    if(!ok){st.textContent='O vídeo deve ter até 15 segundos.';fv.value='';return}
    if(limited()){st.textContent='Muitos envios seguidos. Aguarde um minuto.';fv.value='';return}
    st.textContent='Enviando o vídeo...';
    var rd=new FileReader();
    rd.onload=function(){
      var n=$('#cn').value.trim();
      var vid=rnd(),vk=rnd(),ow=ownGet();ow[vid]=vk;ownSet(ow);
      post({nome:n,texto:$('#ct').value.trim(),id:vid,chave:vk,arquivo:{nome:file.name,tipo:file.type,dados:String(rd.result).split(',')[1]}})
        .then(function(){ev('video-enviado');st.textContent='Recebemos seu vídeo. Obrigado por contribuir! Ele aparecerá nesta página depois da nossa análise.';fv.value='';var pl=pendGet();pl.push({k:key,n:n,t:Date.now()});pendSet(pl);showPend()})
        .catch(function(){st.textContent='Não foi possível enviar o vídeo agora.'});
    };
    rd.readAsDataURL(file);
    });
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
  var d=new Date(s.data+'T00:00:00');return !isNaN(d)&&(Date.now()-d.getTime())<7*864e5;
}
function head(h){return '<h1>'+h+'</h1><hr class="rule">'}
var DEF_WHATS='https://whatsapp.com/channel/0029VaGE5bbHwXb8n4YcpC3G',DEF_TELEGRAM='https://t.me/+HBcOID9aNCZlMDc5';
/* Carrossel de destaque do Dual Play (usado no início e na página Conteúdo Dual Play) */
function spotDual(){
  var dest=D.acess.map(function(a,i){return {a:a,i:i}}).filter(function(x){return x.a.destaque}).slice(0,3);
  if(!dest.length) dest=D.acess.slice(0,3).map(function(a,i){return {a:a,i:i}});
  if(!dest.length) return '';
  var slides=dest.map(function(x,k){return '<a draggable="false" class="slide'+(k===0?' on':'')+'" href="#video-acessibilidade-'+(x.i+1)+'" style="background-image:var(--spotgrad),url('+thumb(x.a.orig)+');background-size:cover;background-position:center"><span class="play">'+PLAY+'</span><span class="name">'+esc(x.a.titulo)+'</span><span class="sub">'+esc(x.a.canal)+'</span></a>'}).join('');
  var dots=dest.map(function(x,k){return '<button type="button" data-dot="'+k+'" aria-label="Destaque '+(k+1)+'"'+(k===0?' aria-current="true"':'')+'></button>'}).join('');
  return '<div class="spot" id="spot" aria-roledescription="carrossel">'+slides+'<div class="dots">'+dots+'</div></div>';
}
/* ---------- dias de celebração (datas fixas e móveis) ---------- */
function easterOf(y){
  var a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,g=Math.floor((8*b+13)/25),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1;
  return new Date(y,mo-1,da);
}
function addD(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n)}
function celebNames(y){
  var E=easterOf(y),n25=new Date(y,11,25),dow=n25.getDay(),adv4=addD(n25,-(dow===0?7:dow)),adv1=addD(adv4,-21),epi=new Date(y,0,2),m={};
  while(epi.getDay()!==0) epi=addD(epi,1);
  function s(k,d){m[norm(k)]=d}
  s('quarta-feira de cinzas',addD(E,-46));s('cinzas',addD(E,-46));
  s('domingo de ramos',addD(E,-7));s('ramos',addD(E,-7));
  s('quinta-feira santa',addD(E,-3));s('sexta-feira santa',addD(E,-2));s('sabado santo',addD(E,-1));
  s('pascoa',E);s('domingo de pascoa',E);
  s('divina misericordia',addD(E,7));s('domingo da divina misericordia',addD(E,7));
  s('ascensao',addD(E,42));s('ascensao do senhor',addD(E,42));
  s('pentecostes',addD(E,49));s('santissima trindade',addD(E,56));
  s('corpus christi',addD(E,60));
  s('sagrado coracao',addD(E,68));s('sagrado coracao de jesus',addD(E,68));
  s('imaculado coracao de maria',addD(E,69));
  s('cristo rei',addD(adv1,-7));
  s('advento',adv1);s('primeiro domingo do advento',adv1);
  s('sagrada familia',dow===0?new Date(y,11,30):addD(n25,7-dow));
  s('epifania',epi);s('batismo do senhor',addD(epi,7));
  return m;
}
/* a data escrita na planilha (25/12, 2026-12-25, Páscoa, Pentecostes+3...) cai hoje? */
function celebHit(txt,now){
  txt=String(txt||'').trim();if(!txt) return false;
  now=now||new Date();
  var y=now.getFullYear(),mo=now.getMonth()+1,da=now.getDate(),names=null;
  return txt.split(/[,;]/).some(function(t){
    t=t.trim();if(!t) return false;
    var m=t.match(/^(\d{1,2})\/(\d{1,2})(?:\/\d{2,4})?$/);
    if(m) return +m[1]===da&&+m[2]===mo;
    m=t.match(/^\d{4}-(\d{2})-(\d{2})/);
    if(m) return +m[2]===da&&+m[1]===mo;
    m=t.match(/^(.*?)\s*([+-]\s*\d+)?$/);
    names=names||celebNames(y);
    var d=names[norm(m[1])];if(!d) return false;
    d=addD(d,parseInt((m[2]||'0').replace(/\s/g,''),10)||0);
    return d.getDate()===da&&d.getMonth()+1===mo;
  });
}
function newDate(ds,days){
  if(!ds) return false;
  var d=new Date(ds+'T00:00:00');return !isNaN(d)&&(Date.now()-d.getTime())<(days||7)*864e5;
}
function seeded(list,seed){
  var a=list.slice(),i,j,t;
  function r(){seed=(seed*1664525+1013904223)%4294967296;return seed/4294967296}
  for(i=a.length-1;i>0;i--){j=Math.floor(r()*(i+1));t=a[i];a[i]=a[j];a[j]=t}
  return a;
}
var VEIL='<img class="veil" src="favicon.svg" alt="" aria-hidden="true">';
function addVeil(fr){if(fr&&!fr.querySelector('.veil')) fr.insertAdjacentHTML('beforeend',VEIL)}
/* celebração: entra um dia antes e fica durante todo o dia */
function celebNear(txt){var n=new Date();return celebHit(txt,n)||celebHit(txt,addD(n,1))}
/* Carrossel (thumbnails sem título): Patrística, celebração, sinal, série. O que não tem destaque marcado na planilha fica de fora (exceto Patrística e sinal, que têm sugestão automática) */
function carItems(withSinal){
  var out=[],used={};
  function add(href,yt){if(!yt||used[href]) return;used[href]=1;out.push({href:href,yt:yt})}
  var ms=Object.keys(D.patr).sort(function(a,b){return a-b}),pv=null,m,i;
  for(m=0;m<ms.length&&!pv;m++) for(i=0;i<D.patr[ms[m]].length;i++) if(D.patr[ms[m]][i].dest){pv={m:ms[m],i:i};break}
  if(!pv&&ms.length&&D.patr[ms[0]].length) pv={m:ms[0],i:0};
  if(pv) add('#video-patristica-'+pv.m+'-'+(pv.i+1),D.patr[pv.m][pv.i].orig);
  if(withSinal) D.sinais.filter(function(x){return !x.soon&&celebNear(x.dia)}).forEach(function(x){add('#sinal-'+x.id,x.yt)});
  D.cat.filter(function(c){return celebNear(c.dia)}).forEach(function(c){add('#catequese-'+c.id,c.yt)});
  if(withSinal){
    var sd=D.sinais.filter(function(x){return !x.soon&&x.dest})[0]||recentList()[0];
    if(sd) add('#sinal-'+sd.id,sd.yt);
  }
  var se=D.cat.filter(function(c){return c.g&&c.dest})[0];
  if(se) add('#catequese-'+se.id,se.yt);
  if(withSinal){
    /* vagas restantes (até 6): sinais e catequeses sorteados, alternando */
    function mix(a){a=a.slice();for(var q=a.length-1;q>0;q--){var r=Math.floor(Math.random()*(q+1)),t=a[q];a[q]=a[r];a[r]=t}return a}
    var bySin={};D.sinais.forEach(function(x){bySin[x.id]=x});
    var tr=(D.trend||[]).map(function(t){return bySin[t.id]}).filter(function(x){return x&&!x.soon&&x.yt}).slice(0,3).reverse();
    /* só os sinais em alta entram; sem dados de tendência ainda, sorteio livre como antes */
    var ps=tr.length?tr:mix(D.sinais.filter(function(x){return !x.soon&&x.yt})),pc=mix(D.cat.filter(function(c){return c.yt})),turn=0;
    while(out.length<6&&(ps.length||pc.length)){
      if((turn%2===0&&ps.length)||!pc.length){var a1=ps.pop();add('#sinal-'+a1.id,a1.yt)}
      else{var c1=pc.pop();add('#catequese-'+c1.id,c1.yt)}
      turn++;
    }
  }
  return out;
}
/* Carrossel da página Catequeses (5 entradas): Patrística nos primeiros 6 meses (selo Novo), depois catequeses e séries (celebração e destaque primeiro, o resto sorteado). Sem nenhuma catequese: 2 em alta + 2 sorteados + Patrística */
function mixArr(a){a=a.slice();for(var q=a.length-1;q>0;q--){var r=Math.floor(Math.random()*(q+1)),t=a[q];a[q]=a[r];a[r]=t}return a}
function catCarItems(){
  var out=[],used={},N=5;
  function add(h,y){if(!y||used[h]||out.length>=N) return;used[h]=1;out.push({href:h,yt:y})}
  var ms=Object.keys(D.patr).sort(function(a,b){return a-b}),m,i;
  function patrItems(max){
    var pv=null;
    for(m=0;m<ms.length&&!pv;m++) for(i=0;i<D.patr[ms[m]].length;i++) if(D.patr[ms[m]][i].dest){pv={m:ms[m],i:i};break}
    if(!pv&&ms.length&&D.patr[ms[0]].length) pv={m:ms[0],i:0};
    if(pv) add('#video-patristica-'+pv.m+'-'+(pv.i+1),D.patr[pv.m][pv.i].orig);
    ms.forEach(function(k){if(max>1&&pv&&k!==pv.m&&D.patr[k].length) add('#video-patristica-'+k+'-1',D.patr[k][0].orig)});
  }
  var cats=D.cat.filter(function(c){return c.yt});
  if(!cats.length){
    patrItems(1);
    var bySin={};D.sinais.forEach(function(x){bySin[x.id]=x});
    var okS=function(x){return x&&!x.soon&&x.yt};
    var tr=(D.trend||[]).map(function(t){return bySin[t.id]}).filter(okS).slice(0,2);
    tr.forEach(function(x){add('#sinal-'+x.id,x.yt)});
    mixArr(D.sinais.filter(okS)).forEach(function(x){add('#sinal-'+x.id,x.yt)});
    return out.slice(0,N);
  }
  if(D.grupos.some(function(g){return g.leva==='patr'&&newDate(g.data,183)})) patrItems(2);
  cats.filter(function(c){return celebNear(c.dia)}).forEach(function(c){add('#catequese-'+c.id,c.yt)});
  cats.filter(function(c){return c.dest}).forEach(function(c){add('#catequese-'+c.id,c.yt)});
  mixArr(cats).forEach(function(c){add('#catequese-'+c.id,c.yt)});
  return out;
}
function carHtml(items){
  if(!items.length) return '';
  var slides=items.map(function(x,k){return '<a draggable="false" class="slide'+(k===0?' on':'')+'" href="'+x.href+'" aria-label="Assistir"><img src="'+ytimg(x.yt)+'" data-id="'+x.yt+'" alt="" onload="ytOk(this)" onerror="ytOk(this,1)"><span class="play">'+PLAY+'</span></a>'}).join('');
  var dots=items.map(function(x,k){return '<button type="button" data-dot="'+k+'" aria-label="Destaque '+(k+1)+'"'+(k===0?' aria-current="true"':'')+'></button>'}).join('');
  return '<div class="spot thumb" id="spot" aria-roledescription="carrossel">'+slides+'<div class="dots">'+dots+'</div></div>';
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
var TEMAS_POR_VEZ=4,TEMA_INI=0;
try{TEMA_INI=parseInt(localStorage.getItem('cl_tema_ini'),10)||0;localStorage.setItem('cl_tema_ini',String(TEMA_INI+TEMAS_POR_VEZ))}catch(e){}
function rodizio(list){
  var n=list.length;if(n<=TEMAS_POR_VEZ) return list;
  var st=TEMA_INI%n,out=[],i;
  for(i=0;i<n;i++) out.push(list[(st+i)%n]);
  return out;
}
var IC={
  cat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
  pat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/><path d="M9 8h6"/></svg>',
  euc:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 8a3.5 3.5 0 0 1 7 0"/><path d="M6.5 8h11v1.5a5.5 5.5 0 0 1-11 0z"/><path d="M12 15v4.5"/><path d="M8 20.5h8"/></svg>',
  catq:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.6c1.4 1.7 1.9 2.7 1.9 3.5a1.9 1.9 0 0 1-3.8 0c0-.8.5-1.8 1.9-3.5z"/><path d="M10.2 9.4h3.6v7.2h-3.6z"/><path d="M4.6 16.6h15.2l-2.3 3.8H8.4a3.8 3.8 0 0 1-3.8-3.8z"/></svg>',
  dual:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="5" width="13" height="10" rx="1.5"/><rect x="9" y="10" width="12.5" height="9" rx="1.5" class="cut"/><path d="M13.5 12.5v4l3.5-2z" fill="currentColor"/></svg>',
  lupa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg>',
  x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  lua:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  sol:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
};
function stripHtml(){
  function ci(h,t,ic,p){return '<a class="ci" href="'+h+'"><i'+(p?' class="p"':'')+'>'+ic+'</i>'+t+'</a>'}
  return '<nav class="strip" aria-label="Seções">'+ci('#catalogo','Catálogo',IC.cat,1)+ci('#catequeses','Catequeses',IC.catq)+ci('#oracao-eucaristica','Oração Eucarística',IC.euc)+'</nav>';
}
function temasComSinais(){
  return (D.temasHome.length?D.temasHome:Object.keys(D.temas)).filter(function(k){return D.temas[k]&&D.sinais.some(function(x){return x.temas.indexOf(k)>-1})});
}
var views={
  temas:function(){
    var g=temasComSinais().map(themeTile).join('');
    return head('Temas')+(g?'<div class="grid wide">'+g+'</div>':'<p class="note">Em breve.</p>');
  },
  inicio:function(){
    var hk=temasComSinais();
    var th=rodizio(hk).map(function(k,i){var t=themeTile(k);return i<TEMAS_POR_VEZ?t:t.replace(/^<a /,'<a hidden ')}).join('');
    var moreTh=hk.length>TEMAS_POR_VEZ?'<div class="morewrap"><button type="button" class="morebtn" id="moreth" aria-label="Mostrar mais temas" title="Mostrar mais temas"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button></div>':'';
    var RL=recentList(),PAGE=(window.matchMedia&&matchMedia('(min-width:1000px) and (min-aspect-ratio:1/1)').matches)?9:5,spot=carHtml(carItems(true));
    var PLUS='<button type="button" class="tile plus" id="more" aria-label="Mostrar mais vídeos" title="Mostrar mais vídeos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>';
    var rec=RL.map(function(s,i){var t=signTile(s,isNew(s));return (i<PAGE?t:t.replace(/^<a /,'<a hidden '))+(i===PAGE-1&&RL.length>PAGE?PLUS:'')}).join('');
    var more='';
    return '<section class="hero">'+stripHtml()+'</section>'+
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
      '<p>O Catlibras não tem como objetivo padronizar os sinais, mas sim catalogar aqueles utilizados e compreendidos pela comunidade surda católica. Deseja ser uma fonte confiável e pastoral, acessível a todos os que buscam servir e viver a fé de forma inclusiva. É um passo concreto rumo a uma Igreja mais acolhedora, onde surdos e intérpretes caminham juntos como discípulos missionários.</p>';
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
    var items=[['Canal no WhatsApp',D.cfg.contato_whatsapp||DEF_WHATS,WAICON],['Fórum Catlibras no Telegram',D.cfg.contato_telegram||DEF_TELEGRAM,TGICON]];
    var h=items.filter(function(x){return /^https:\/\//i.test(String(x[1]).trim())}).map(function(x){
      return '<div class="contato-item"><h2>'+esc(x[0])+'</h2><a class="btn wa contato-ic" href="'+esc(String(x[1]).trim())+'" target="_blank" rel="noopener" aria-label="'+esc(x[0])+'" title="'+esc(x[0])+'">'+x[2]+'</a></div>';
    }).join('');
    return head('Contato')+(h?'<div class="contato">'+h+'</div>':'<p class="note">Em breve.</p>');
  },
  catalogo:function(){
    var L='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    return head('Escolha a letra')+'<div class="area" id="larea"><div class="letters fit" id="lgrid">'+L.map(function(c){return '<a class="lt" href="#letra-'+c.toLowerCase()+'" aria-label="Letra '+c+'">'+c+'</a>'}).join('')+'<a class="lt tema" href="#temas">Por tema</a></div></div>';
  },
  'oracao-eucaristica':function(){
    return head('Oração Eucarística')+'<div class="grid wide">'+D.euc.map(function(e){return barTile('#eucaristica-'+slug(e.num),'Oração Eucarística '+e.num,e.capa,'euc'+e.num)}).join('')+'</div>';
  },
  catequeses:function(){
    var spot=carHtml(catCarItems());
    var fixed=[],pool=[];
    D.grupos.forEach(function(g){var h=gBar(g);if(!h) return;(g.leva==='patr'&&newDate(g.data,183)?fixed:pool).push(h)});
    var NB=4,vis=NB-fixed.length;pool=seeded(pool,Math.floor(Math.random()*4294967295));
    var bars=fixed.concat(pool.slice(0,Math.max(vis,0))).join('')+pool.slice(Math.max(vis,0)).map(function(h){return h.replace(/^<a /,'<a hidden ')}).join('')+(pool.length>vis?'<button type="button" class="tile plus" id="morebars" aria-label="Mostrar todas as séries" title="Mostrar todas as séries"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>':'');
    var rest=D.cat.filter(function(c){return !c.g}).sort(function(a,b){return a.titulo.localeCompare(b.titulo,'pt-BR')}),PG=5,DK=(window.matchMedia&&matchMedia('(min-width:1000px)').matches);
    var PLUSC='<button type="button" class="tile plus" id="morecq" aria-label="Mostrar mais catequeses" title="Mostrar mais catequeses"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>';
    var grid=rest.map(function(c,i){var t=catTile(c);return (i<PG?t:t.replace(/^<a /,'<a hidden '))+(i===PG-1&&rest.length>PG?PLUSC:'')}).join('');
    if(!spot&&!bars&&!grid) return head('Catequeses')+'<p class="note">Em breve.</p>';
    return head('Catequeses')+
      (spot?'<section class="section spotsec">'+spot+'</section>':'')+
      '<div class="cqs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/></svg><input id="cqq" type="search" placeholder="Buscar catequese" aria-label="Buscar catequese" autocomplete="off"></div>'+
      '<div id="cqres"></div><div id="cqmain">'+
      (bars?'<section class="section"><div class="grid wide">'+bars+'</div></section>':'')+
      (grid?'<section class="section"><div class="section-head"><h2>Mais catequeses</h2></div><hr class="rule"><div class="grid vid" id="cqgrid">'+grid+'</div></section>':'')+'</div>';
  },
  patristica:function(){
    return head('Patrística')+'<div class="grid wide">'+Object.keys(D.patr).sort(function(a,b){return a-b}).map(function(m){return barTile('#patristica-'+m,'Módulo '+m,D.patr[m][0].capa,'patr'+m)}).join('')+'</div>';
  },
  acessibilidade:function(){
    var g=D.acess.map(function(a,i){return videoTile('#video-acessibilidade-'+(i+1),a.titulo,a.capa,'ac'+i).replace('class="tile cov"','class="tile cov vt"')}).join('');
    return head('Conteúdo Dual Play')+spotDual()+
      (g?'<div class="grid vid titled" style="margin-top:26px">'+g+'</div>':'<p class="note">Em breve.</p>');
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
  return '<div class="sp"><h1 class="sr">'+esc(label(s))+'</h1>'+
    '<div class="solo"><div class="frame live" id="sf">'+poster(s.yt,'Reproduzir '+label(s))+'</div>'+
    vctl(waBtn('https://youtu.be/'+s.yt))+pn+'</div>'+
    (reg?'<section class="section varsec"><div class="section-head"><h2>Variações</h2></div><hr class="rule"><div class="grid small">'+reg+'</div></section>':'')+
    commentsBlock('sinal-'+s.id,true)+'</div>';
}
function eucView(e){
  var T=['Versão Catlibras','Alternativas de estratégia de tradução','Tradução comentada'];
  var m=T.map(function(t,i){
    if(!e.v[i]) return '';
    return '<a class="tile cov vt" href="#" data-video="Oração Eucarística '+esc(e.num)+' · '+esc(t)+'" data-yt="'+e.v[i]+'">'+cover({img:thumb(e.v[i]),x:'50%',y:'50%',z:1},e.num+t)+'<span class="play">'+PLAY+'</span><span class="name">'+esc(t)+'</span></a>';
  }).join('');
  return head('Oração Eucarística '+esc(e.num))+(m?'<div class="grid vid titled">'+m+'</div>':'<p class="note">Em breve.</p>')+commentsBlock('eucaristica-'+slug(e.num),true);
}
function patrView(m){
  var l=D.patr[m]||[];
  return headShare('Patrística · Módulo '+esc(m),'Patrística · Módulo '+m+' – Catlibras '+location.href)+'<div class="slist">'+l.map(function(v,i){return rowTile('#video-patristica-'+m+'-'+(i+1),v.nome,v.capa,'p'+m+'-'+i,i+1)}).join('')+'</div>';
}

/* ---------- endereço da página (migalhas) ---------- */
function crumbsHtml(list){
  return '<nav class="crumbs" aria-label="Você está em"><ol>'+list.map(function(c,i){
    return i===list.length-1?'<li aria-current="page">'+esc(c[0])+'</li>':'<li><a href="'+c[1]+'">'+esc(c[0])+'</a></li>';
  }).join('')+'</ol></nav>';
}

/* ---------- rotas ---------- */
function render(){
  stopDual();stopSingle();
  var h=(location.hash||'#inicio').slice(1),html,nav='',after=null,mt,home=false,cr=[['Início','#inicio']];
  pageStart=Date.now();
  if((mt=h.match(/^tema-(.+)$/))&&D.temas[mt[1]]){
    lastTheme=mt[1];var k=mt[1];cr.push(['Temas','#temas'],[D.temas[k].nome]);var list=sorted(D.sinais.filter(function(s){return s.temas.indexOf(k)>-1}));
    html='<p class="eyebrow">Tema</p><h1>'+esc(D.temas[k].nome)+'</h1>'+(D.temas[k].desc?'<p class="lead">'+esc(D.temas[k].desc)+'</p>':'')+'<hr class="rule" style="margin-top:20px"><div class="grid compact">'+list.map(function(s){return signTile(s,false)}).join('')+'</div>';
  } else if((mt=h.match(/^letra-([a-z])$/))){
    lastTheme=null;var c=mt[1],C=c.toUpperCase();cr.push(['Catálogo','#catalogo'],['Letra '+C]);
    var ll=sorted(D.sinais.filter(function(s){return [s.nome].concat(s.outros).some(function(n){return chave(n).charAt(0)===c})}));
    html=head('Letra '+C)+(ll.length?'<div class="grid compact">'+ll.map(function(s){return signTile(s,false)}).join('')+'</div>':'<p class="note">Ainda não há sinais com a letra '+C+'.</p>');
    nav='catalogo';
  } else if((mt=h.match(/^sinal-(.+)$/))&&byId(mt[1])){
    var s=byId(mt[1]);html=sinalView(s);nav='catalogo';
    if(s.temas[0]) cr.push(['Temas','#temas'],[D.temas[s.temas[0]].nome,'#tema-'+s.temas[0]],[label(s)]); else cr.push(['Catálogo','#catalogo'],[label(s)]);
    after=function(){
      var fr=$('#sf'),ps=$('.poster',fr);
      if(ps) ps.addEventListener('click',function(){mountSingle(fr,s.yt,s.titulo)});
      initComments('sinal-'+s.id);
    };
  } else if((mt=h.match(/^eucaristica-(.+)$/))&&D.euc.filter(function(e){return slug(e.num)===mt[1]})[0]){
    var e=D.euc.filter(function(x){return slug(x.num)===mt[1]})[0];html=eucView(e);nav='oracao';cr.push(['Oração Eucarística','#oracao-eucaristica'],['Oração Eucarística '+e.num]);after=function(){initComments('eucaristica-'+slug(e.num))};
  } else if((mt=h.match(/^patristica-(\d+)$/))&&D.patr[mt[1]]){
    html=patrView(mt[1]);nav='catequeses';cr.push(['Catequeses','#catequeses'],['Patrística','#patristica'],['Módulo '+mt[1]]);
  } else if((mt=h.match(/^video-patristica-(\d+)-(\d+)$/))&&D.patr[mt[1]]&&D.patr[mt[1]][mt[2]-1]){
    var v=D.patr[mt[1]][mt[2]-1],pm=mt[1],pi=+mt[2],pl=D.patr[pm].length;html=dualView('#patristica-'+pm,v,v.nome,pi>1?'#video-patristica-'+pm+'-'+(pi-1):'',pi<pl?'#video-patristica-'+pm+'-'+(pi+1):'');nav='catequeses';cr.push(['Catequeses','#catequeses'],['Patrística','#patristica'],['Módulo '+pm,'#patristica-'+pm],[v.nome]);var nxh=pi<pl?'#video-patristica-'+pm+'-'+(pi+1):'';after=function(){initDual(v,nxh)};
  } else if((mt=h.match(/^catequeses-(.+)$/))&&D.gBy[mt[1]]&&!D.gBy[mt[1]].leva){
    var gg=D.gBy[mt[1]],gl=D.cat.filter(function(c){return c.g===gg.id}).sort(function(a,b){return a.ordem-b.ordem||a.i-b.i});
    html=headShare(esc(gg.nome),gg.nome+' – Catlibras '+shareLink(gg.id))+(gg.desc?'<p class="lead">'+esc(gg.desc)+'</p>':'')+'<div class="slist">'+gl.map(function(c,i){return rowTile('#catequese-'+c.id,c.titulo,c.capa,'c'+c.id,i+1,newDate(c.data))}).join('')+'</div>';
    nav='catequeses';cr.push(['Catequeses','#catequeses'],[gg.nome]);
  } else if((mt=h.match(/^catequese-(.+)$/))&&D.catBy[mt[1]]){
    var cc=D.catBy[mt[1]],cg=cc.g?D.gBy[cc.g]:null,cl=cg?D.cat.filter(function(c){return c.g===cg.id}).sort(function(a,b){return a.ordem-b.ordem||a.i-b.i}):[],ci=cl.indexOf(cc);
    var pnv='';
    if(cg){
      var pvc=cl[ci-1],nxc=cl[ci+1];
      pnv='<nav class="pn" aria-label="Anterior e próximo em '+esc(cg.nome)+'">'+
        (pvc?'<a href="#catequese-'+pvc.id+'"><small><span class="ar">《</span> Anterior</small><b>'+esc(pvc.titulo)+'</b></a>':'<span class="off"></span>')+
        (nxc?'<a class="nx" href="#catequese-'+nxc.id+'"><small>Próximo <span class="ar">》</span></small><b>'+esc(nxc.titulo)+'</b></a>':'<span class="off"></span>')+'</nav>';
    }
    html='<div class="sp"><h1 class="sr">'+esc(cc.titulo)+'</h1><div class="solo"><div class="frame live" id="sf">'+poster(cc.yt,'Reproduzir '+cc.titulo)+VEIL+'</div>'+vctl(waBtn(cc.titulo+' '+location.href))+pnv+'</div></div>';
    nav='catequeses';cr.push(['Catequeses','#catequeses']);if(cg) cr.push([cg.nome,'#catequeses-'+cg.id]);cr.push([cc.titulo]);
    after=function(){var fr=$('#sf'),ps=$('.poster',fr);if(ps) ps.addEventListener('click',function(){mountSingle(fr,cc.yt,cc.titulo);addVeil(fr)})};
  } else if((mt=h.match(/^video-acessibilidade-(\d+)$/))&&D.acess[mt[1]-1]){
    var ai=+mt[1],a=D.acess[ai-1];html=dualView('#acessibilidade',a,a.titulo,ai>1?'#video-acessibilidade-'+(ai-1):'',ai<D.acess.length?'#video-acessibilidade-'+(ai+1):'',a.canal);nav='catequeses';cr.push(['Catequeses','#catequeses'],['Conteúdo Dual Play','#acessibilidade'],[a.titulo]);after=function(){initDual(a)};
  } else if(views[h]){
    html=views[h]();nav=({catalogo:'catalogo','oracao-eucaristica':'oracao',catequeses:'catequeses',patristica:'catequeses',acessibilidade:'catequeses'})[h]||'';
    if(h==='catequeses') after=initCq;
    home=(h==='inicio');
    var NM={catalogo:'Catálogo',temas:'Temas','oracao-eucaristica':'Oração Eucarística',patristica:'Patrística',acessibilidade:'Conteúdo Dual Play',sobre:'Sobre',equipe:'Nossa equipe',contato:'Contato',catequeses:'Catequeses'};
    if(!home){if(h==='patristica'||h==='acessibilidade') cr.push(['Catequeses','#catequeses']);cr.push([NM[h]||h])}
  } else { html=views.inicio();home=true; }
  app.innerHTML=(home?'':crumbsHtml(cr))+html;
  $('#menu').hidden=home;
  closeSearch();
  document.body.classList.toggle('watch',h.indexOf('video-')===0);
  document.body.classList.toggle('home',home);
  document.body.classList.toggle('letras',h==='catalogo');
  document.body.classList.toggle('solopage',h.indexOf('sinal-')===0||h.indexOf('catequese-')===0);
  document.querySelectorAll('#menu a').forEach(function(x){if(x.getAttribute('data-nav')===nav) x.setAttribute('aria-current','page');else x.removeAttribute('aria-current')});
  closeVideo();initSpot();maybeInstBar();
  if(h==='catalogo') fitLetters();
  if(after) after();
  window.scrollTo(0,0);
  hit(h);
}
function initCq(){
  var q=$('#cqq');if(!q) return;
  q.addEventListener('input',function(){
    var v=norm(q.value),res=$('#cqres'),mn=$('#cqmain');
    if(!v){res.innerHTML='';mn.hidden=false;return}
    var hit=D.cat.filter(function(c){return norm(c.titulo).indexOf(v)>-1||(c.g&&norm(D.gBy[c.g].nome).indexOf(v)>-1)}).sort(function(a,b){return a.titulo.localeCompare(b.titulo,'pt-BR')});
    mn.hidden=true;
    res.innerHTML='<section class="section"><div class="section-head"><h2>Resultado</h2></div><hr class="rule">'+(hit.length?'<div class="grid vid">'+hit.map(function(c){return catTile(c)}).join('')+'</div>':'<p class="note">Nenhuma catequese encontrada.</p>')+'</section>';
    evSearch('busca-catequese',q.value,hit.length>0);
  });
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
  var x0=null,sw=false;
  sp.style.touchAction='pan-y';
  sp.addEventListener('pointerdown',function(e){x0=e.clientX;sw=false});
  sp.addEventListener('pointerup',function(e){if(x0===null)return;var dx=e.clientX-x0;x0=null;if(Math.abs(dx)>45){sw=true;show(i+(dx<0?1:-1));pause();start()}});
  sp.addEventListener('pointercancel',function(){x0=null});
  sp.addEventListener('click',function(e){if(sw){e.preventDefault();sw=false}},true);
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
    var hid=document.querySelectorAll('#recent > a[hidden]'),n=Math.min(6,hid.length),i,pl=$('#more');
    for(i=0;i<n;i++) hid[i].hidden=false;
    var rest=document.querySelectorAll('#recent > a[hidden]');
    if(pl){ if(rest.length) pl.parentNode.insertBefore(pl,rest[0]); else pl.remove(); }
  }
  if(e.target.closest&&e.target.closest('#morebars')){
    document.querySelectorAll('.grid.wide > a[hidden]').forEach(function(a){a.hidden=false});
    var pb=$('#morebars');if(pb) pb.remove();
    return;
  }
  if(e.target.closest&&e.target.closest('#morecq')){
    var hc=document.querySelectorAll('#cqgrid > a[hidden]'),nc=Math.min((window.matchMedia&&matchMedia('(min-width:1000px)').matches)?8:4,hc.length),ic,pc=$('#morecq');
    for(ic=0;ic<nc;ic++) hc[ic].hidden=false;
    var rc=document.querySelectorAll('#cqgrid > a[hidden]');
    if(pc){ if(rc.length) pc.parentNode.insertBefore(pc,rc[0]); else pc.remove(); }
  }
  if(e.target.closest&&e.target.closest('#moreth')){
    location.hash='#temas';
  }
  var sh=e.target.closest&&e.target.closest('[data-share]');
  if(sh&&navigator.share){e.preventDefault();navigator.share({text:sh.getAttribute('data-share')}).catch(function(){})}
  var rp=e.target.closest&&e.target.closest('[data-repeat]');
  if(rp){repeat=rp.getAttribute('aria-pressed')!=='true';rp.setAttribute('aria-pressed',repeat?'true':'false')}
  var v=e.target.closest&&e.target.closest('[data-video]');
  if(v){e.preventDefault();openVideo(v.getAttribute('data-video'),v.getAttribute('data-yt'))}
});

/* ---------- busca ---------- */
function closeAll(){document.querySelectorAll('.results').forEach(function(r){r.hidden=true;r.innerHTML=''})}
var searchInit=false;
function openSearch(){
  var t=$('#top'),q=$('#qh');t.classList.add('sopen');$('#lupa').innerHTML=IC.x;$('#lupa').setAttribute('aria-label','Fechar busca');$('#lupa').setAttribute('aria-expanded','true');
  if(q) q.focus();
}
function closeSearch(){
  var t=$('#top'),q=$('#qh');if(!t||!t.classList.contains('sopen')) return;
  t.classList.remove('sopen');$('#lupa').innerHTML=IC.lupa;$('#lupa').setAttribute('aria-label','Buscar');$('#lupa').setAttribute('aria-expanded','false');
  if(q) q.value='';closeAll();
}
function initHeader(){
  setupSearch($('#qh'),$('#resultsh'));
  $('#lupa').addEventListener('click',function(){if($('#top').classList.contains('sopen')) closeSearch(); else openSearch()});
  $('#dado').addEventListener('click',function(){
    var pool=D.sinais.filter(function(x){return !x.soon&&('#sinal-'+x.id)!==location.hash});
    if(!pool.length) return;
    var alvo='#sinal-'+pool[Math.floor(Math.random()*pool.length)].id,ic=$('#dado svg');
    if(ic&&ic.animate&&!reducedMotion()){ic.animate([{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:450,easing:'ease-in-out'});setTimeout(function(){location.hash=alvo},450)}
    else location.hash=alvo;
  });
}
function setupSearch(q,res){
  if(searchInit) return; searchInit=true;
  q.addEventListener('input',function(){
    var v=norm(q.value);
    if(!v){closeAll();return}
    var hit0=0;
    var hit=sorted(D.sinais.filter(function(s){return norm(label(s)).indexOf(v)>-1||norm(s.titulo).indexOf(v)>-1||norm(s.sinonimos).indexOf(v)>-1||s.temas.some(function(k){return norm(D.temas[k].nome).indexOf(v)>-1})})).sort(function(a,b){return (a.soon?1:0)-(b.soon?1:0)}).slice(0,8);
    res.innerHTML=hit.length?hit.map(function(s){var sm='<small>'+(s.soon?'Em breve':esc(s.temas.map(function(k){return D.temas[k].nome}).join(', ')))+'</small>';return s.soon?'<span class="soonres">'+esc(label(s))+sm+'</span>':'<a href="#sinal-'+s.id+'"><img class="rth" src="'+thumb(s.yt)+'" alt="" loading="lazy" onerror="this.remove()"><span>'+esc(label(s))+sm+'</span></a>'}).join(''):'<p>Nenhum sinal encontrado.</p>';
    res.hidden=false;evSearch('busca',q.value,hit.length>0);
  });
  q.addEventListener('keydown',function(e){if(e.key==='Escape'){closeSearch();var lb=$('#lupa');if(lb)lb.focus()}});
  res.addEventListener('click',function(){setTimeout(closeSearch,0)});
}
document.addEventListener('click',function(e){if(!e.target.closest('.search')&&!e.target.closest('#lupa'))closeAll()});

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
window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferredInstall=e;if(!standalone()&&!installDismissed&&document.body.classList.contains('home')) showInstBar()});
window.addEventListener('appinstalled',function(){deferredInstall=null;removeInstBar();var l=$('#instl');if(l) l.hidden=true});
var instl=$('#instl');
if(instl&&!standalone()){
  instl.hidden=false;
  instl.addEventListener('click',function(e){e.preventDefault();showInstBar(!deferredInstall)});
}
/* a cada abertura do site, na página inicial, a pergunta volta (em iPhone, só a orientação) */
function maybeInstBar(){
  removeInstBar();
  if(standalone()||installDismissed||!document.body.classList.contains('home')) return;
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

/* ---------- tema claro / noturno ---------- */
function curTheme(){return document.documentElement.getAttribute('data-theme')==='dark'?'dark':'light'}
function paintTheme(){
  var d=curTheme()==='dark',m=document.querySelector('meta[name="theme-color"]');
  if(m) m.setAttribute('content',d?'#08142b':'#f0e4c8');
  var i=$('#tgi'),b=$('#tgl'),tx=d?'Tema claro':'Tema noturno';if(i) i.innerHTML=d?IC.sol:IC.lua;if(b){b.setAttribute('aria-label',tx);b.setAttribute('title',tx)}
}
var tgl=$('#tgl');
if(tgl) tgl.addEventListener('click',function(){
  var n=curTheme()==='dark'?'light':'dark';
  document.documentElement.setAttribute('data-theme',n);
  try{localStorage.setItem('cl_theme',n)}catch(e){}
  paintTheme();
});
paintTheme();

/* ---------- eventos (GoatCounter): contam ações, não páginas ---------- */
var evSeen={};
function ev(name,once){
  if(once){if(evSeen[name])return;evSeen[name]=1}
  var n=0;(function go(){
    if(window.goatcounter&&window.goatcounter.count){window.goatcounter.count({path:'ev/'+name,title:name,event:true});return}
    if(n++<8) setTimeout(go,600);
  })();
}
var evTimer=null;
function evSearch(kind,v,found){
  clearTimeout(evTimer);v=(v||'').trim();if(v.length<3) return;
  evTimer=setTimeout(function(){var t=norm(v).slice(0,40);ev(kind+'/'+t,true);if(!found)ev('sem-resultado/'+t,true)},1500);
}
document.addEventListener('click',function(e){
  var t=e.target;if(!t||!t.closest) return;
  if(t.closest('[data-share]')) ev('compartilhar/'+(location.hash.slice(1)||'inicio').slice(0,60));
  if(t.closest('.poster')) ev('play/'+(location.hash.slice(1)||'inicio').slice(0,60));
  if(t.closest('#instgo')) ev('clicou-instalar');
},true);
window.addEventListener('appinstalled',function(){ev('instalou-app')});
/* ---------- visitas (GoatCounter): cada página do site conta como uma visita ---------- */
function hit(h){
  var path='/'+(h||'inicio'),n=0;
  (function go(){
    if(window.goatcounter&&window.goatcounter.count){window.goatcounter.count({path:path,title:document.title,event:false});return}
    if(n++<8) setTimeout(go,600);
  })();
}

/* ---------- alfabeto: calculado ao abrir; só refaz se o celular girar ---------- */
var letrasOri=null;
function fitLetters(){
  var a=$('#larea'),l=$('#lgrid');if(!a||!l) return;
  var g=8,W=a.clientWidth,port=window.innerHeight>=window.innerWidth,r=port?5:3,c=Math.ceil(28/r);
  var s=(W-(c-1)*g)/c;
  s=Math.max(36,Math.min(s,120));
  letrasOri=port?'v':'h';
  l.style.setProperty('--c',c);l.style.setProperty('--r',r);l.style.setProperty('--s',Math.floor(s)+'px');
}
function refitLetters(){if(!$('#lgrid')) return;var p=window.innerHeight>=window.innerWidth?'v':'h';if(p!==letrasOri) fitLetters()}
window.addEventListener('resize',refitLetters);window.addEventListener('orientationchange',function(){setTimeout(refitLetters,250)});

/* ---------- deslizar para o lado na página do sinal: anterior / próximo ---------- */
(function(){
  var x0=0,y0=0,on=false;
  document.addEventListener('touchstart',function(e){
    on=location.hash.indexOf('#sinal-')===0&&e.touches.length===1&&!(e.target.closest&&e.target.closest('iframe,input,textarea,.seg,.recrow'));
    if(on){x0=e.touches[0].clientX;y0=e.touches[0].clientY}
  },{passive:true});
  document.addEventListener('touchend',function(e){
    if(!on) return;on=false;
    var t=e.changedTouches[0],dx=t.clientX-x0,dy=t.clientY-y0;
    if(Math.abs(dx)<70||Math.abs(dy)>45) return;
    var a=dx<0?$('.pn a.nx'):$('.pn a:not(.nx)');
    if(a) location.hash=a.getAttribute('href');
  },{passive:true});
})();

/* ---------- animação de abertura (só no app instalado, na tela inicial) ---------- */
var introEl=null,introT=0;
function reducedMotion(){return !!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}
function startIntro(){
  if((location.hash||'#inicio')!=='#inicio'||!standalone()||reducedMotion()) return;
  var d=document.createElement('div'),bg=document.createElement('div'),im=document.createElement('img'),w=Math.min(window.innerWidth*0.72,380);
  d.className='intro';d.setAttribute('aria-hidden','true');bg.className='intro-bg';
  im.alt='';im.src=curTheme()==='dark'?'logo.svg':'logo-claro.svg';
  im.style.cssText='left:'+((window.innerWidth-w)/2)+'px;top:'+(window.innerHeight*0.42-w*0.12)+'px;width:'+w+'px;height:auto';
  d.appendChild(bg);d.appendChild(im);document.body.appendChild(d);document.documentElement.classList.add('introing');
  introEl=d;introT=Date.now();
  setTimeout(endIntro,9000);
}
function endIntro(){
  if(introEl){introEl.remove();introEl=null}
  document.documentElement.classList.remove('introing');
}
function finishIntro(){
  var d=introEl;if(!d) return;
  setTimeout(function(){
    if(introEl!==d) return;
    var im=d.querySelector('img'),bg=d.querySelector('.intro-bg'),t=null;
    document.querySelectorAll('.top .brand img').forEach(function(x){var r=x.getBoundingClientRect();if(r.width>0) t=r});
    if(!t||!im.animate){endIntro();return}
    var s=im.getBoundingClientRect(),o={duration:700,easing:'cubic-bezier(.65,0,.35,1)',fill:'forwards'};
    function box(r){return {left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'}}
    im.animate([box(s),box(t)],o);
    bg.animate([{opacity:1},{opacity:1,offset:.2},{opacity:0}],o);
    setTimeout(endIntro,720);
  },Math.max(0,500-(Date.now()-introT)));
}

/* ---------- aviso de versão nova ---------- */
var updShown=false,lastChk=0;
function checkUpdate(){
  if(updShown||document.hidden||(lastChk&&Date.now()-lastChk<600000)) return;
  lastChk=Date.now();
  fetch('app.js',{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(function(t){
    var m=t.match(/var BUILD="([\w.\-]+)"/);
    if(m&&m[1]!==BUILD) showUpdate();
  }).catch(function(){});
}
function showUpdate(){
  if(updShown) return;updShown=true;
  var b=document.createElement('div');b.className='instbar upd';b.setAttribute('role','status');
  b.innerHTML='<p>Há uma versão nova do Catlibras.</p><div class="row"><button type="button" class="btn small" id="updgo">Atualizar</button><button type="button" class="btn small ghost" id="updno">Depois</button></div>';
  document.body.appendChild(b);
  $('#updno').addEventListener('click',function(){b.remove()});
  $('#updgo').addEventListener('click',function(){
    Promise.all([fetch('app.js',{cache:'reload'}),fetch('index.html',{cache:'reload'})]).catch(function(){}).then(function(){location.reload()});
  });
}

/* ---------- início ---------- */
var foot=$('.foot-in a.btn');if(foot&&CFG.CANAL_URL) foot.href=CFG.CANAL_URL;
if('serviceWorker' in navigator&&location.protocol.indexOf('http')===0){navigator.serviceWorker.register('sw.js').catch(function(){})}
app.innerHTML='<div class="skel" aria-busy="true" aria-label="Carregando"><span class="sk h"></span><div class="skg"><span class="sk"></span><span class="sk"></span><span class="sk"></span><span class="sk"></span></div></div>';
document.body.classList.add('home');$('#menu').hidden=true;
startIntro();
loadData().then(function(r){
  D.raw=r.raw;buildModel(r.raw);
  initHeader();
  window.addEventListener('hashchange',render);
  render();
  finishIntro();
  setTimeout(checkUpdate,4000);
  document.addEventListener('visibilitychange',checkUpdate);
  setInterval(checkUpdate,900000);
}).catch(function(){
  endIntro();
  $('#menu').hidden=true;
  app.innerHTML='<div class="offline"><img src="'+(curTheme()==='dark'?'logo.svg':'logo-claro.svg')+'" alt="Catlibras"><p>Não foi possível carregar o catálogo agora. Verifique a conexão com a internet e tente de novo.</p><button type="button" class="btn" id="retry">Tentar de novo</button></div>';
  $('#retry').addEventListener('click',function(){location.reload()});
});
window.__catlibras={D:D};
})();
