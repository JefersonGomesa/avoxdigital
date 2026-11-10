/* Vox Desk — interface language. Translates platform labels only. Never translates what people typed. */
(function () {
  const PT = {
    "Requests": "Pedidos", "Clients": "Clientes", "Calendar": "Calendário", "History": "Histórico", "Sign out": "Sair",
    "Add request": "Adicionar pedido", "New request": "Novo pedido", "All clients": "Todos os clientes", "No client": "Sem cliente", "Add client": "Adicionar cliente",
    "New": "Novo", "Needs info": "Falta informação", "In progress": "Em andamento", "Updated & tested": "Atualizado e testado", "Done": "Concluído",
    "New launch date": "Nova data de lançamento", "Page or automation update": "Atualização de página ou automação", "New client": "Cliente novo", "Global change": "Mudança para todos os clientes",
    "Webinar date or time changed": "A data ou a hora do webinar mudou", "Copy, bio, form, QR code, voicemail": "Copy, bio, formulário, QR code, voicemail", "Build pages and automations": "Construir páginas e automações", "A new rule for every client": "Uma regra nova para todos os clientes",
    "Client": "Cliente", "Type": "Tipo", "Assigned to": "Responsável", "Due date": "Prazo", "Requested by": "Pedido por", "Waiting on": "Aguardando", "Nobody": "Ninguém",
    "Webinar date and time": "Data e hora do webinar", "Notes": "Notas", "Comments": "Comentários", "Comment": "Comentar", "Delete": "Apagar", "Add": "Adicionar", "Open in Slack": "Abrir no Slack",
    "Cleared to launch": "Liberado para lançar", "Pacific": "Pacífico", "Eastern": "Leste", "Mountain": "Montanha", "Your time": "Seu horário", "Not set": "Não definido",
    "Pacific (PT)": "Pacífico (PT)", "Mountain (MT)": "Montanha (MT)", "Central (CT)": "Central (CT)", "Eastern (ET)": "Leste (ET)",
    "Pages and automations are updated and tested. Ads can launch.": "As páginas e as automações estão atualizadas e testadas. Os anúncios podem começar.",
    "Pick a date to see the time in every zone.": "Escolha uma data para ver a hora em cada fuso.",
    "No new requests": "Nenhum pedido novo", "Drag a card here": "Arraste um cartão para cá", "Done in the last 7 days shows here": "Os concluídos dos últimos 7 dias aparecem aqui",
    "No requests yet": "Nenhum pedido ainda", "Nothing yet": "Nada ainda", "No webinar date set": "Sem data de webinar", "No due date": "Sem prazo",
    "Details": "Dados", "Spokesperson": "Porta-voz", "Brand": "Marca", "Account manager": "Gerente de conta", "Usual time zone": "Fuso horário habitual", "Slack channel": "Canal do Slack",
    "Delivery due": "Prazo de entrega", "Times in Brasília": "Horários de Brasília", "Times in Your time": "Horários no seu fuso", "Today": "Hoje",
    "Sun": "Dom", "Mon": "Seg", "Tue": "Ter", "Wed": "Qua", "Thu": "Qui", "Fri": "Sex", "Sat": "Sáb",
    "Short title": "Título curto", "Choose a client": "Escolha um cliente", "+ New client": "+ Cliente novo", "Needed by": "Necessário até", "Link (optional)": "Link (opcional)", "Details (optional)": "Detalhes (opcional)",
    "Send request": "Enviar pedido", "Webinar date, time and zone": "Data, hora e fuso do webinar", "What changes for every client?": "O que muda para todos os clientes?", "New client name": "Nome do cliente novo",
    "Add link": "Adicionar link", "Add a step": "Adicionar um passo", "Add a delivery (page, automation, funnel)": "Adicionar uma entrega (página, automação, funil)", "Paste a link (Drive, page, Zoom, doc)": "Cole um link (Drive, página, Zoom, doc)",
    "Write a comment. Use @ to tag someone.": "Escreva um comentário. Use @ para marcar alguém.", "Notes for the team. What is missing, what was decided.": "Notas para a equipe. O que falta e o que foi decidido.", "Name": "Nome",
    "Paste the copy or the instruction here.": "Cole a copy ou a instrução aqui.", "Brand colours, rules, anything the team must know": "Cores da marca, regras e tudo que a equipe precisa saber", "Brand or program": "Marca ou programa", "What needs to be done": "O que precisa ser feito",
    "Requests, deliveries and launch dates in one place.": "Pedidos, entregas e datas de lançamento em um só lugar.", "Enter": "Entrar", "Email me a sign-in link": "Enviar link de acesso por e-mail",
    "Demo mode. Data stays in this browser only.": "Modo demonstração. Os dados ficam só neste navegador.", "No password. The link signs you in.": "Sem senha. O link faz o login.", "Slack sync": "Sincronização do Slack",
    "Everyone": "Todos", "Moved by": "Movido por", "Live": "Ao vivo", "Connecting": "Conectando", "Before": "Antes", "After": "Depois", "(empty)": "(vazio)",
    "One checklist line per client is added.": "A lista recebe uma linha por cliente.",
  };
  const ST = "New|Needs info|In progress|Updated & tested|Done";
  const RX = [
    [/^Due (.+)$/, (m, a) => "Prazo " + a], [/^Waiting on (.+)$/, (m, a) => "Aguardando " + a],
    [/^(\d+) of (\d+) delivered$/, (m, a, b) => a + " de " + b + " entregues"], [/^(\d+) open$/, (m, a) => a + " abertos"],
    [/^Deliveries · (\d+) of (\d+)$/, (m, a, b) => "Entregas · " + a + " de " + b], [/^Checklist · (\d+) of (\d+)$/, (m, a, b) => "Lista de verificação · " + a + " de " + b],
    [new RegExp("^· (" + ST + ")$"), (m, a) => "· " + PT[a]],
    [/^A checklist with (\d+) steps is added\. You can edit it\.$/, (m, a) => "A lista recebe " + a + " passos. Você pode editar."],
  ];
  const ACT = [["created the request", "criou o pedido"], ["sent the request in Slack", "enviou o pedido no Slack"], ["commented", "comentou"], ["unchecked", "desmarcou"], ["checked", "marcou"], ["set status to", "mudou o status para"], ["assigned to nobody", "removeu o responsável"], ["assigned to", "atribuiu a"], ["set due date to none", "removeu o prazo"], ["set due date to", "definiu o prazo para"], ["changed the webinar date", "mudou a data do webinar"], ["changed the webinar time", "mudou a hora do webinar"], ["changed the time zone to", "mudou o fuso para"], ["moved to", "moveu para"], ["is waiting on", "aguarda"], ["cleared waiting on", "removeu o aguardando"], ["added the client", "adicionou o cliente"], ["added the link", "adicionou o link"], ["added", "adicionou"], ["removed", "removeu"], ["edited the link of", "editou o link de"], ["edited the name of", "editou o nome de"], ["edited the", "editou:"], ["deleted the client", "apagou o cliente"], ["deleted the request", "apagou o pedido"]];
  function conv(s, inHist) {
    if (PT[s]) return PT[s];
    for (const [r, f] of RX) if (r.test(s)) return s.replace(r, f);
    if (inHist) for (const [en, pt] of ACT) if (s.startsWith(en)) { let rest = s.slice(en.length); if (en === "set status to") rest = rest.replace(new RegExp("^ (" + ST + ")"), (m, a) => " " + PT[a]); return pt + rest; }
    return null;
  }
  let lang = "en"; try { lang = localStorage.getItem("voxdesk-lang") || "en"; } catch (e) {}
  function apply(root) {
    root = root || document.body;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const nodes = []; let n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(node => {
      const p = node.parentElement; if (!p || /^(TEXTAREA|SCRIPT|STYLE)$/.test(p.tagName)) return;
      if (p.classList.contains("cm") || p.matches(".diff p") || p.closest(".cl,.sub,.at,.q,[data-i18n]")) return;
      const raw = node.nodeValue, s = raw.trim(); if (!s) return;
      const pt = conv(s, !!p.closest(".hist")); if (!pt) return;
      if (lang === "pt") { node.nodeValue = raw.replace(s, pt); p.setAttribute("data-i18n", ""); }
      else if (p.tagName !== "OPTION" && !p.title) p.title = pt;
    });
    root.querySelectorAll("[placeholder]").forEach(e => { const pt = PT[e.placeholder]; if (!pt) return; if (lang === "pt") e.placeholder = pt; else if (!e.title) e.title = pt; });
  }
  window.DESK_I18N = { apply, get: () => lang, set(l) { lang = l; try { localStorage.setItem("voxdesk-lang", l); } catch (e) {} } };
})();
