# Site Catlibras – passo a passo

Esta pasta é o site inteiro. Tudo é gratuito. O endereço final é **catlibras.github.io**.

O que tem aqui:

| Arquivo | Para que serve |
|---|---|
| `index.html`, `app.js` | o site (não precisa mexer) |
| `config.js` | **o único arquivo que você edita**: código da planilha e endereço dos comentários |
| `dados-exemplo.js` | dados de teste; usados só enquanto o código da planilha estiver vazio |
| `apps-script/Codigo.gs` | comentários, vídeos enviados e aviso por e-mail |
| `logo.svg`, `favicon.svg`, `icons/`, `manifest.webmanifest`, `sw.js` | logo, ícone da aba (só a cruz e a mão) e instalação na tela inicial |
| `bandeiras/` | imagens de bandeiras (opcional) |

---

## Parte 1 – Testar agora (sem planilha)

O site já funciona com os 17 vídeos da Patrística e o intérprete de teste. Basta publicar (Parte 4) e abrir o endereço.

## Parte 2 – Ligar a planilha

1. Importe o arquivo `Catlibras-planilha.xlsx` no Google Planilhas (Arquivo → Importar → Upload → Substituir planilha).
2. Clique em **Compartilhar → Acesso geral → Qualquer pessoa com o link → Leitor**.
3. Copie o código da planilha: no endereço `https://docs.google.com/spreadsheets/d/CÓDIGO/edit`, é o trecho `CÓDIGO`.
4. Abra `config.js` e escreva entre as aspas: `SHEET_ID: 'CÓDIGO'`.
5. Preencha as abas **Sinais**, **Acessibilidade** etc. O site lê a planilha toda vez que alguém abre; a mudança aparece em poucos minutos.

## Parte 3 – Ligar comentários e aviso por e-mail

1. Na planilha: **Extensões → Apps Script**. Apague o que estiver lá e cole o conteúdo de `apps-script/Codigo.gs`. Salve (ícone de disquete).
2. Na lista de funções (em cima), escolha **ativarAvisoDiario** e clique em **Executar**. O Google pede autorização: **Revisar permissões → escolha sua conta → Avançado → Acessar (não seguro) → Permitir**. Isso é normal para scripts seus.
3. Clique em **Implantar → Nova implantação**. Tipo: **App da Web**. Executar como: **Eu**. Quem pode acessar: **Qualquer pessoa**. Clique em **Implantar** e copie o **URL do app da Web**.
4. Abra `config.js` e escreva: `COMENTARIOS_URL: 'URL COPIADO'`.
5. Na aba **Configurações**, preencha `email_resumo` com o e-mail que deve receber o aviso e, se quiser, `palavras_bloqueadas`.

Como funciona:
- Comentário em texto aparece na hora.
- Vídeo enviado vai para a pasta **Catlibras – vídeos enviados** no seu Drive (limite de 25 MB) e só aparece no site depois que você escrever **sim** na coluna **Aprovado** da aba Comentários.
- Para esconder qualquer comentário depressa: **sim** na coluna **Oculto**.
- Comentário com palavra bloqueada fica oculto até você revisar.
- Todo dia às 20h chega um e-mail com as novidades. Se não houve nada, não chega e-mail.
- Se você mudar o código do Apps Script depois, use **Implantar → Gerenciar implantações → editar → Nova versão**.

## Parte 4 – Publicar no GitHub (endereço catlibras.github.io)

O endereço raiz precisa de um repositório com o nome exato **catlibras.github.io**. O endereço `/teste/` de hoje é de outro repositório e continua funcionando.

1. Entre em github.com com a conta **catlibras**.
2. Se ainda não existir, clique em **New repository**, nome `catlibras.github.io`, **Public**, **Create repository**.
3. Na página do repositório, clique em **uploading an existing file** (ou **Add file → Upload files**).
4. Abra a pasta do site no seu computador, selecione **tudo o que está dentro dela** (não a pasta em si) e arraste para a página. Espere terminar o envio e clique em **Commit changes**.
5. Vá em **Settings → Pages**. Em **Source** escolha **Deploy from a branch**, branch **main**, pasta **/ (root)**, **Save**.
6. Espere 1 a 2 minutos e abra **https://catlibras.github.io**.

Para atualizar depois (por exemplo, mudar o `config.js`): abra o arquivo no GitHub, clique no lápis, edite e **Commit changes**.

## Conferindo se deu certo

- A página inicial mostra a busca, os 4 botões, os temas e os últimos vídeos.
- Patrística → Módulo 1 → um vídeo: aparece o original e a faixa do intérprete. Toque no play: os dois começam juntos. Use os controles do próprio YouTube; o intérprete acompanha pausa, avanço e velocidade.
- Se o original mostrar anúncio, o botão **Pular** do próprio YouTube aparece depois do tempo obrigatório. Enquanto durar o anúncio, o intérprete espera; depois, os dois voltam juntos.
- No celular, no menu do navegador, procure **Instalar** ou **Adicionar à tela inicial**.

## Ajustes úteis

- **Início do intérprete**: se o intérprete começar adiantado ou atrasado em relação ao original, mude os segundos na coluna **Início do intérprete (segundos)** daquele vídeo. Play, pausa, barra de tempo, velocidade e repetir são feitos no próprio player do YouTube, e o intérprete acompanha.
- **Capa padrão dos sinais**: os cartões dos sinais mostram só a imagem quadrada que aparece sempre no mesmo lugar do vídeo (a figura do santo, por exemplo). O recorte vem das linhas `capa_x`, `capa_y` e `capa_zoom` da aba Configurações. Se mudar o layout dos vídeos, ajuste esses três números.
- **Capas**: coluna **Capa (link de imagem)** para usar sua imagem; **Capa X** e **Capa Y** (0 a 100) escolhem a parte da imagem que aparece; **Capa zoom** (1 = inteira, 1.5 = aproximada).
- **Bandeiras das Variações**: escreva o código na coluna Bandeira (ex.: BA, RS, PT) e coloque o arquivo `BA.png` na pasta `bandeiras/`. Sem o arquivo, aparece o código escrito.
- **Prefixos da letra**: aba Configurações, linha `prefixos_ignorados`.

## O que o site não faz

- Cada sinal tem endereço próprio (`catlibras.github.io/#sinal-jesus`), mas, ao compartilhar no WhatsApp, a prévia mostra o título geral do site, não a foto do sinal. Prévia individual exigiria páginas geradas por programa, e isso é um próximo passo possível.
- Anúncios do YouTube não podem ser bloqueados nem pulados pelo site: o botão Pular é do YouTube.

## Aparecer no Google (indexação)
O site já sai aberto para o Google: tem `robots.txt` liberando tudo, `sitemap.xml`, título, descrição e dados estruturados. O repositório `/teste/` e este são separados, então o bloqueio do teste não passa para cá.

Depois de publicar:
1. Entre em **search.google.com/search-console** com a conta do Catlibras.
2. **Adicionar propriedade → Prefixo do URL** e escreva `https://catlibras.github.io/`.
3. Confirme pela opção **Tag HTML**: o Google dá uma linha `<meta name="google-site-verification" ...>`. Cole essa linha dentro do `<head>` do `index.html` no GitHub e clique em Verificar.
4. Em **Sitemaps**, envie `sitemap.xml`.
5. Em **Inspeção de URL**, cole `https://catlibras.github.io/` e clique em **Solicitar indexação**.

Limite: hoje o Google enxerga bem a página inicial. Cada sinal dentro do catálogo (`#sinal-jesus`) não vira resultado próprio, porque o endereço com `#` é tratado como a mesma página. Para cada sinal aparecer sozinho na busca ("sinal de Jesus em Libras"), é preciso gerar uma página por sinal a partir da planilha, e isso entra no sitemap. É o próximo passo recomendado.

## Sinais ainda não publicados
A planilha guarda todos os sinais, publicados ou não. A coluna **Situação** diz em que pé está cada um. O site mostra **só os que têm link do YouTube**. Quando você colar o link de um sinal, ele aparece no site.

Se um dia quiser mostrar os que ainda não saíram como "Em breve" (cartão apagado, sem clique), mude a linha `mostrar_em_breve` da aba Configurações para `aprovados` ou `todos`. O padrão é `nao`.

## Instalar o app na tela inicial
- Na página inicial, o site oferece "Instalar o Catlibras na tela inicial?" toda vez que a pessoa abre (no celular com Chrome ou no computador). Se ela tocar em "Agora não", a pergunta volta na próxima vez que abrir.
- Quem recusou pode instalar depois pelo link **Instalar app**, no rodapé de todas as páginas.
- No iPhone (Safari) não existe botão automático. O site mostra a orientação: Compartilhar → Adicionar à Tela de Início.
- O ícone que aparece no celular é só a cruz e a mão. Se o navegador guardou o ícone antigo, limpe os dados do site ou aguarde alguns dias.

## Páginas Dual Play
São as páginas com o vídeo original e o intérprete (Conteúdo Dual Play e Patrística). Os botões são só **Voltar**, **Anterior**, **Próximo** e **WhatsApp**. No celular na vertical o cabeçalho com a logo aparece; na horizontal ele some para os dois vídeos ocuparem a tela.

Se a coluna **Link do intérprete** ficar vazia (Acessibilidade ou Patrística), o espaço do intérprete mostra "Em breve" e o vídeo original toca normalmente. Quando você colar o link do intérprete, ele passa a funcionar sozinho.

## Logos de Realização e Apoio
Aparecem no final da página **Sobre**, com os títulos "Realização" e "Apoio", cada logo sobre um fundo branco. Coloque os arquivos na pasta `apoio/` do GitHub e preencha, na aba **Configurações**, as linhas `realizacao_imagem`, `realizacao_nome`, `realizacao_link` e `apoio_imagem`, `apoio_nome`, `apoio_link`. Imagem: PNG ou JPG, horizontal, cerca de 300 × 100 px. O link é opcional. Sem a imagem, aquele bloco não aparece.
