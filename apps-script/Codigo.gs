/**
 * Catlibras – comentários, vídeos enviados e resumo diário.
 * Cole este código no Apps Script da planilha (Extensões → Apps Script).
 * Veja o passo a passo no arquivo LEIA-ME.md.
 */
var ABA = 'Comentários';
var ABA_CONFIG = 'Configurações';
var LIMITE_POR_HORA = 60;          // proteção contra robôs: máximo de envios por hora no site todo
var TAMANHO_MAX_VIDEO = 25 * 1024 * 1024;

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
      if (norm_(r[6]) === 'sim') continue;                       // Oculto
      var temVideo = String(r[4]).trim() !== '';
      var aprovado = norm_(r[5]) === 'sim';
      if (!String(r[3]).trim() && temVideo && !aprovado) continue; // vídeo sem texto ainda não aprovado
      out.push({
        nome: String(r[2]),
        texto: String(r[3]),
        data: String(r[0]),
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

    var nome = String(d.nome || 'Visitante').substring(0, 60);
    var texto = String(d.texto || '').substring(0, 1500);
    var pagina = String(d.pagina || '').substring(0, 120);

    var oculto = '';
    var proibidas = config_('palavras_bloqueadas').split(',').map(function (p) { return norm_(p).trim(); }).filter(String);
    var alvo = norm_(nome + ' ' + texto);
    for (var i = 0; i < proibidas.length; i++) {
      if (alvo.indexOf(proibidas[i]) > -1) { oculto = 'sim'; break; }   // retido até você revisar
    }

    var link = '';
    if (d.arquivo && d.arquivo.dados) {
      var bytes = Utilities.base64Decode(d.arquivo.dados);
      if (bytes.length <= TAMANHO_MAX_VIDEO && /^video\//.test(String(d.arquivo.tipo))) {
        var pasta = pasta_();
        var blob = Utilities.newBlob(bytes, d.arquivo.tipo, Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyyMMdd-HHmmss') + '-' + String(d.arquivo.nome || 'video').replace(/[^\w.\-]/g, '_'));
        var arq = pasta.createFile(blob);
        arq.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        link = arq.getUrl();
      }
    }
    if (!texto && !link) return json_({ ok: false });

    var ws = planilha_().getSheetByName(ABA);
    var agora = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM HH:mm');
    ws.appendRow([agora, pagina, nome, texto, link, '', oculto, '']);
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
    corpo += '• ' + r[0] + ' – ' + r[2] + ' (página ' + r[1] + ')\n';
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
