/* Dados de teste: usados só enquanto SHEET_ID (config.js) estiver vazio ou a planilha não abrir. */
(function(){
  var I='https://youtu.be/Pz0530_vEZo';
  function y(id){return 'https://youtu.be/'+id}
  var m1=['2BJu2eEBcNU','SZWfetX0i5k','HFzYRUKYbDQ','MwPbjlw-S0k','u3Dcttgdfe0','7CQm0gUFr-o','q_CPlFHnuRw','s9NVAgkSDqU','jEDhRRBFwlU'];
  var m2=['ma1dq3QinTY','AV7ks6gG7gk','_GePztdwCO0','YvhCGGR5ars','_K3Tt8Acj9I','LLGp6iTO36U','XYt_5p3aBZw','iSBzJ6yNZKA'];
  function mod(m,l){return l.map(function(v,i){return {modulo:m,ordem:i+1,nome:'Módulo '+m+' – Vídeo '+(i+1),orig:y(v),terp:I,ini:0}})}
  window.DADOS_EXEMPLO = {
    sinais:[{titulo:'Sinal de exemplo em Libras',link:y('WNIJOTqUNJI'),outros:'',temas:'Expressões',data:'',ativo:'sim'}],
    variacoes:[],
    patristica:mod(1,m1).concat(mod(2,m2)),
    eucaristica:[{numero:'II',v1:'',v2:'',v3:''},{numero:'III',v1:'',v2:'',v3:''}],
    acessibilidade:[],
    temas:[{tema:'Santos',descricao:'Os santos da Igreja'},{tema:'Profetas',descricao:'Os profetas do Antigo Testamento'},{tema:'Personagens Bíblicos',descricao:'Pessoas das Escrituras'},{tema:'Personalidades',descricao:'Pessoas marcantes da vida da Igreja'},{tema:'Expressões',descricao:'Palavras e expressões da fé'}],
    equipe:[],
    config:{}
  };
})();
