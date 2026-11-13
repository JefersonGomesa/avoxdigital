/* Vox Desk — help texts (EN and PT). Shown by the "i" button on each screen and by "Help" in the menu. */
window.DESK_HELP = {
  order: ["start", "board", "card", "clients", "list", "dash", "notes", "calendar", "history", "tools"],
  en: {
    title: "How Vox Desk works", open: "How this screen works", all: "See the full guide",
    start: ["The idea in 30 seconds", [
      "Requests arrive from Slack. When someone tags @clicklabdesk, the message becomes a card here in 1 to 2 seconds.",
      "ClickLab executes the request and checks each step on the card.",
      "When every step is checked, the card moves to Done by itself.",
      "Everything is saved the moment you change it. The history keeps who changed what, and when."]],
    board: ["Requests · the board", [
      "Each card is one request. Each column is a status.",
      "<b>New clients</b>: clients to build from zero. <b>Updates</b>: date changes, page or automation edits.",
      "<b>Needs info</b>: we are waiting for someone. <b>In progress</b>: someone is working on it.",
      "<b>Columns</b> button: add your own columns and set an owner for each one. A card that enters the column is assigned to the owner.",
      "<b>Updated & tested</b>: ready. Ads can launch. <b>Done</b>: finished.",
      "Drag a card to another column to change the status. Drag it up or down to set the priority. The card on top is priority 1.",
      "The red bar on top shows clients that cannot launch yet because Pineda still has to send something.",
      "Use the two filters on top to see one person or one client."]],
    card: ["A card, piece by piece", [
      "<b>Orange number</b>: priority in the column.",
      "<b>Date line</b>: webinar date in the client's time zone, and in your time zone below.",
      "<b>Grey quote</b>: the original Slack message and who sent it.",
      "<b>Slack button</b>: opens the exact message in Slack.",
      "<b>Circles on the right</b>: who is responsible (J, A). <b>Moved by</b>: who changed the status last.",
      "<b>Teal shield</b>: runs the validator. It opens the client's pages and checks date, form, links and leftover template text.",
      "<b>Square</b>: marks the request as done. Click again to reopen.",
      "Click the card to open it. Inside you can edit everything, check steps, add links, comment with @ and read the history."]],
    clients: ["Clients", [
      "One card per client. Click a client to open the page.",
      "<b>GHL button</b>: opens the client's GoHighLevel account.",
      "<b>Needed from Pineda to launch</b>: what the account manager still has to send. Check an item when it arrives and paste the link.",
      "<b>Deliveries</b>: what ClickLab built for this client (pages, funnel, automation). Paste the live link beside each one.",
      "<b>Links</b>: copy docs, Drive folders, calendar, Zoom.",
      "The red label \"Missing from Pineda\" shows how many items are still missing."]],
    list: ["Checklist", [
      "Pick a client on the left. The client with the highest priority comes first.",
      "<b>Requested executions</b>: one row for each thing that was asked for this client. A row is a request, or a message that was added to a request in Slack.",
      "Check the row when the execution is finished. The row leaves the list and goes to <b>Done</b>.",
      "When someone asks for something new, a new row shows. The finished rows stay in Done.",
      "<b>Steps</b> opens the steps of the request. <b>GHL CT</b> (blue) is the time zone set in the client's GHL account."]],
    dash: ["Dashboard", [
      "Numbers on top: clients served today, this week and this month, deliveries, work in production and waiting.",
      "<b>By client</b>: one row per client. Click a row to see what was done and what is missing.",
      "<b>Requests</b>: every request in a table. Use \"Columns\" to choose what to see. Click a column title to sort.",
      "The filters on top change both tables.",
      "The chart shows deliveries done, update requests and new client requests, by day, week or month."]],
    notes: ["Notes", [
      "Your private notepad. Nobody else can see your notes.",
      "Each note has a title, a text, a client and a box to mark it done."]],
    calendar: ["Calendar", [
      "Orange: a webinar. Yellow: a delivery due date. Green: updated and tested.",
      "Times are shown in your time zone. Hover an event to see the client's time zone.",
      "Click an event to open the request."]],
    history: ["History", [
      "Every change, newest first: who, when and what.",
      "Rows with an arrow open to show the value before and after.",
      "Nobody can edit or delete the history."]],
    tools: ["Other tools", [
      "<b>Undo</b>: press Cmd + Z (or Ctrl + Z) to undo your last change.",
      "<b>Chat</b>: the orange button at the bottom right. \"Team\" is for everyone. Click the bubble beside a name for a private chat.",
      "<b>Translator</b>: the round button beside the chat. Or select any text on the page and click \"Translate\".",
      "<b>Language</b>: \"English · PT\" in the menu changes the labels. It never changes what people wrote.",
      "<b>Online now</b>: who has the desk open and which request they are in."]],
  },
  pt: {
    title: "Como o Vox Desk funciona", open: "Como esta tela funciona", all: "Ver o guia completo",
    start: ["A ideia em 30 segundos", [
      "Os pedidos chegam pelo Slack. Quando alguém marca @clicklabdesk, a mensagem vira um cartão aqui em 1 a 2 segundos.",
      "A ClickLab executa o pedido e marca cada passo no cartão.",
      "Quando todos os passos estão marcados, o cartão vai para Done sozinho.",
      "Tudo é salvo na hora da alteração. O histórico guarda quem mudou o quê, e quando."]],
    board: ["Pedidos · o quadro", [
      "Cada cartão é um pedido. Cada coluna é um status.",
      "<b>New clients</b>: clientes para construir do zero. <b>Updates</b>: mudança de data, ajuste de página ou de automação.",
      "<b>Needs info</b>: estamos esperando alguém. <b>In progress</b>: alguém está fazendo.",
      "Botão <b>Columns</b>: adicione colunas suas e defina um dono para cada uma. O cartão que entra na coluna fica com o dono como responsável.",
      "<b>Updated & tested</b>: pronto. Os anúncios podem começar. <b>Done</b>: concluído.",
      "Arraste o cartão para outra coluna para mudar o status. Arraste para cima ou para baixo para definir a prioridade. O cartão de cima é a prioridade 1.",
      "A faixa vermelha no topo mostra os clientes que ainda não podem lançar, porque a Pineda precisa enviar algo.",
      "Use os 2 filtros do topo para ver uma pessoa ou um cliente."]],
    card: ["O cartão, parte por parte", [
      "<b>Número laranja</b>: a prioridade na coluna.",
      "<b>Linha da data</b>: a data do webinar no fuso do cliente e, embaixo, no seu fuso.",
      "<b>Citação cinza</b>: a mensagem original do Slack e quem enviou.",
      "<b>Botão Slack</b>: abre a mensagem exata no Slack.",
      "<b>Círculos à direita</b>: quem é o responsável (J, A). <b>Moved by</b>: quem mudou o status por último.",
      "<b>Escudo verde-água</b>: roda o validador. Ele abre as páginas do cliente e confere data, formulário, links e sobras de modelo.",
      "<b>Quadrado</b>: marca o pedido como concluído. Clique de novo para reabrir.",
      "Clique no cartão para abrir. Dentro dele você edita tudo, marca passos, adiciona links, comenta com @ e lê o histórico."]],
    clients: ["Clientes", [
      "Um cartão por cliente. Clique no cliente para abrir a página.",
      "<b>Botão GHL</b>: abre a conta do cliente no GoHighLevel.",
      "<b>Needed from Pineda to launch</b>: o que a gerente de conta ainda precisa enviar. Marque o item quando ele chegar e cole o link.",
      "<b>Deliveries</b>: o que a ClickLab construiu para o cliente (páginas, funil, automação). Cole o link publicado ao lado de cada um.",
      "<b>Links</b>: copys, pastas do Drive, calendário, Zoom.",
      "A etiqueta vermelha \"Missing from Pineda\" mostra quantos itens ainda faltam."]],
    list: ["Checklist", [
      "Escolha o cliente à esquerda. O cliente com a maior prioridade vem primeiro.",
      "<b>Execuções pedidas</b>: uma linha para cada coisa pedida para este cliente. A linha é um pedido, ou uma mensagem que entrou em um pedido pelo Slack.",
      "Marque a linha quando a execução terminar. A linha sai da lista e vai para <b>Concluído</b>.",
      "Quando alguém pede algo novo, uma linha nova aparece. As linhas concluídas ficam em Concluído.",
      "<b>Passos</b> abre os passos do pedido. <b>GHL CT</b> (azul) é o fuso definido na conta GHL do cliente."]],
    dash: ["Dashboard", [
      "Números do topo: clientes atendidos hoje, na semana e no mês, entregas, trabalho em produção e em espera.",
      "<b>By client</b>: uma linha por cliente. Clique na linha para ver o que foi feito e o que falta.",
      "<b>Requests</b>: todos os pedidos em tabela. Use \"Columns\" para escolher o que ver. Clique no título da coluna para ordenar.",
      "Os filtros do topo mudam as 2 tabelas.",
      "O gráfico mostra entregas feitas, pedidos de atualização e pedidos de cliente novo, por dia, semana ou mês."]],
    notes: ["Notas", [
      "O seu bloco de notas privado. Ninguém mais vê as suas notas.",
      "Cada nota tem título, texto, cliente e uma caixa para marcar como concluída."]],
    calendar: ["Calendário", [
      "Laranja: um webinar. Amarelo: um prazo de entrega. Verde: atualizado e testado.",
      "Os horários aparecem no seu fuso. Pare o mouse sobre o evento para ver o fuso do cliente.",
      "Clique no evento para abrir o pedido."]],
    history: ["Histórico", [
      "Toda alteração, da mais nova para a mais antiga: quem, quando e o quê.",
      "As linhas com seta abrem e mostram o valor de antes e o de depois.",
      "Ninguém edita nem apaga o histórico."]],
    tools: ["Outras ferramentas", [
      "<b>Desfazer</b>: pressione Cmd + Z (ou Ctrl + Z) para desfazer a sua última alteração.",
      "<b>Chat</b>: o botão laranja no canto inferior direito. \"Team\" é para todos. Clique no balão ao lado de um nome para a conversa privada.",
      "<b>Tradutor</b>: o botão redondo ao lado do chat. Ou selecione um texto na tela e clique em \"Translate\".",
      "<b>Idioma</b>: \"English · PT\" no menu muda os rótulos. Ele nunca muda o que as pessoas escreveram.",
      "<b>Online now</b>: quem está com o painel aberto e em qual pedido."]],
  },
};
