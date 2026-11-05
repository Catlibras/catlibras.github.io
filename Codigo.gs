/**
 * Catlibras – comentários, vídeos enviados e resumo diário.
 * Cole este código no Apps Script da planilha (Extensões → Apps Script).
 * Veja o passo a passo no arquivo LEIA-ME.md.
 */
var ABA = 'Comentários';
var ABA_CONFIG = 'Configurações';
var LIMITE_POR_HORA = 60;          // proteção contra robôs: máximo de envios por hora no site todo
var TAMANHO_MAX_VIDEO = 35 * 1024 * 1024;

function planilha_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function config_(chave) {
  var ws = planilha_().getSheetByName(ABA_CONFIG);
  if (!ws) return '';
  var v = ws.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === chave) return String(v[i][1] || '');
  }
  return '';
}

function norm_(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* Data no padrão dd/mm/aa - hh:mm (Brasília). A planilha às vezes converte o texto em data de verdade. */
function data_(v) {
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, 'America/Sao_Paulo', 'dd/MM/yy - HH:mm');
  return String(v);
}

function hash_(k) {
  var h = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(k));
  return h.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* O site pede os comentários de uma página. */
function doGet(e) {
  var pagina = (e && e.parameter && e.parameter.pagina) || '';
  var ws = planilha_().getSheetByName(ABA);
  var out = [];
  if (ws && pagina) {
    var v = ws.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      var r = v[i];
      if (String(r[1]) !== pagina) continue;
      if (norm_(r[6]) !== '') continue;                          // Oculto (sim) ou apagado pelo dono
      var temVideo = String(r[4]).trim() !== '';
      var aprovado = norm_(r[5]) === 'sim';
      if (!String(r[3]).trim() && temVideo && !aprovado) continue; // vídeo sem texto ainda não aprovado
      out.push({
        nome: String(r[2]),
        texto: String(r[3]),
        data: data_(r[0]),
        estado: String(r[8] || ''),
        id: String(r[9] || ''),
        editado: norm_(r[11]) === 'sim',
        video: (temVideo && aprovado) ? String(r[4]) : ''
      });
    }
  }
  out.reverse();
  return json_({ comentarios: out.slice(0, 100) });
}

/* O site envia um comentário ou um vídeo. */
function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.site) return json_({ ok: true });                       // campo-isca preenchido: robô
    if (Number(d.tempo) < 3000) return json_({ ok: true });       // enviado rápido demais: robô
    var cache = CacheService.getScriptCache();
    var chave = 'n_' + Utilities.formatDate(new Date(), 'GMT', 'yyyyMMddHH');
    var n = Number(cache.get(chave) || 0);
    if (n >= LIMITE_POR_HORA) return json_({ ok: false });
    cache.put(chave, String(n + 1), 4000);

    /* Editar ou apagar o próprio comentário (só quem tem a chave guardada no aparelho) */
    if (d.acao === 'editar' || d.acao === 'apagar') {
      var wsA = planilha_().getSheetByName(ABA);
      var id = String(d.id || ''), ch = String(d.chave || '');
      if (!wsA || !/^[a-f0-9]{16,32}$/.test(id) || !ch) return json_({ ok: false });
      var vA = wsA.getDataRange().getValues(), hc = hash_(ch);
      for (var j = 1; j < vA.length; j++) {
        if (String(vA[j][9]) !== id || String(vA[j][10]) !== hc) continue;
        if (d.acao === 'apagar') {
          wsA.getRange(j + 1, 7).setValue('apagado');
        } else {
          var novo = String(d.texto || '').substring(0, 1500).trim();
          if (!novo) return json_({ ok: false });
          var bl = config_('palavras_bloqueadas').split(',').map(function (p) { return norm_(p).trim(); }).filter(String);
          var al = norm_(vA[j][2] + ' ' + novo);
          for (var q = 0; q < bl.length; q++) { if (al.indexOf(bl[q]) > -1) { wsA.getRange(j + 1, 7).setValue('sim'); break; } }
          wsA.getRange(j + 1, 4).setValue(novo);
          wsA.getRange(j + 1, 8).setValue('');
          wsA.getRange(j + 1, 12).setValue('sim');
        }
        return json_({ ok: true });
      }
      return json_({ ok: false });
    }

    var nome = String(d.nome || 'Visitante').substring(0, 60);
    var texto = String(d.texto || '').substring(0, 1500);
    var pagina = String(d.pagina || '').substring(0, 120);

    var oculto = '';
    var proibidas = config_('palavras_bloqueadas').split(',').map(function (p) { return norm_(p).trim(); }).filter(String);
    var alvo = norm_(nome + ' ' + texto);
    for (var i = 0; i < proibidas.length; i++) {
      if (alvo.indexOf(proibidas[i]) > -1) { oculto = 'sim'; break; }   // retido até você revisar
    }

    var estado = String(d.estado || '').substring(0, 20);
    var link = '';
    if (d.arquivo && d.arquivo.dados && String(d.nome || '').trim() && estado) {   // vídeo exige nome e Estado
      var bytes = Utilities.base64Decode(d.arquivo.dados);
      if (bytes.length <= TAMANHO_MAX_VIDEO && /^video\//.test(String(d.arquivo.tipo))) {
        var pasta = pasta_();
        var blob = Utilities.newBlob(bytes, d.arquivo.tipo, Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss') + '-' + String(d.arquivo.nome || 'video').replace(/[^\w.\-]/g, '_'));
        var arq = pasta.createFile(blob);
        arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        link = arq.getUrl();
      }
    }
    if (!String(d.nome || '').trim() || !estado) return json_({ ok: false });   // nome e Estado obrigatórios
    if (!texto && !link) return json_({ ok: false });

    var ws = planilha_().getSheetByName(ABA);
    var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yy - HH:mm');
    var idN = /^[a-f0-9]{16,32}$/.test(String(d.id || '')) ? String(d.id) : '';
    var hN = (idN && d.chave) ? hash_(d.chave) : '';
    ws.appendRow([agora, pagina, nome, texto, link, '', oculto, '', estado, idN, hN, '']);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false });
  }
}

function pasta_() {
  var it = DriveApp.getFoldersByName('Catlibras – vídeos enviados');
  return it.hasNext() ? it.next() : DriveApp.createFolder('Catlibras – vídeos enviados');
}

/* Resumo diário: só envia e-mail se houver novidade desde o último aviso. */
function enviarResumo() {
  var ws = planilha_().getSheetByName(ABA);
  if (!ws) return;
  var v = ws.getDataRange().getValues();
  var novos = [], linhas = [];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][7]).trim() === '' && (String(v[i][3]).trim() || String(v[i][4]).trim())) {
      novos.push(v[i]); linhas.push(i + 1);
    }
  }
  if (!novos.length) return;
  var para = config_('email_resumo') || Session.getEffectiveUser().getEmail();
  var corpo = 'Novidades no site Catlibras:\n\n';
  novos.forEach(function (r) {
    corpo += '• ' + data_(r[0]) + ' – ' + r[2] + ' (página ' + r[1] + ')\n';
    if (r[3]) corpo += '  "' + r[3] + '"\n';
    if (r[4]) corpo += '  Vídeo enviado (aguarda sua aprovação): ' + r[4] + '\n';
    if (norm_(r[6]) === 'sim') corpo += '  Retido pelo filtro de palavras.\n';
    corpo += '\n';
  });
  corpo += 'Para aprovar um vídeo, escreva "sim" na coluna Aprovado da aba Comentários.\n';
  corpo += 'Para esconder um comentário, escreva "sim" na coluna Oculto.\n\n' + planilha_().getUrl();
  MailApp.sendEmail(para, 'Catlibras: ' + novos.length + ' novidade(s) no site', corpo);
  linhas.forEach(function (n) { ws.getRange(n, 8).setValue('sim'); });
}

/* Rode UMA vez para ligar o aviso diário (20h) e preparar a coluna Avisado. */
function ativarAvisoDiario() {
  var ws = planilha_().getSheetByName(ABA);
  if (ws && String(ws.getRange(1, 8).getValue()) === '') ws.getRange(1, 8).setValue('Avisado');
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'enviarResumo') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('enviarResumo').timeBased().everyDays(1).atHour(20).create();
}
