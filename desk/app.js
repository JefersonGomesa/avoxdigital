/* Vox Desk — requests board. No build step. Data: Supabase (config.js) or demo mode (localStorage). */
(function () {
  const CFG = window.DESK_CONFIG || {};
  const LIVE = !!(CFG.supabaseUrl && CFG.supabaseKey);
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => crypto.randomUUID();
  const now = () => new Date().toISOString();

  const STATUS = [
    { id: "new", label: "New", color: "#8AB8FF" },
    { id: "info", label: "Needs info", color: "#FFC861" },
    { id: "doing", label: "In progress", color: "#FF9A5C" },
    { id: "tested", label: "Updated & tested", color: "#5FD39A" },
    { id: "done", label: "Done", color: "#BABABA" },
  ];
  const TYPES = [
    { id: "launch", label: "New launch date", icon: "ti-calendar-event", hint: "Webinar date or time changed", list: ["Opt-in page A updated", "Opt-in page B updated (split test)", "Organic link updated", "Automation dates updated", "Zoom link updated", "Test opt-in sent and received"] },
    { id: "update", label: "Page or automation update", icon: "ti-edit", hint: "Copy, bio, form, QR code, voicemail", list: ["Change applied", "Checked on desktop and mobile"] },
    { id: "client", label: "New client", icon: "ti-user-plus", hint: "Build pages and automations", list: ["Onboarding answers received", "Webinar opt-in page", "Book a Call funnel (6 steps)", "Homework page", "Masterclass automation", "Page review on desktop and mobile"] },
    { id: "global", label: "Global change", icon: "ti-world", hint: "A new rule for every client", list: [] },
  ];
  const DELIVERABLES = ["Webinar opt-in page", "Book a Call funnel (6 steps)", "Application form on Book a Call page", "Homework page", "Masterclass automation", "Organic link", "Ringless voicemail"];
  const ZONES = [["America/Los_Angeles", "PT", "Pacific"], ["America/Denver", "MT", "Mountain"], ["America/Chicago", "CT", "Central"], ["America/New_York", "ET", "Eastern"]];
  const MYZ = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  const BR = /Sao_Paulo|Fortaleza|Recife|Bahia|Belem|Maceio|Araguaina/.test(MYZ);
  const MYLABEL = BR ? "Brasília" : "Your time";
  const zAbbr = z => (ZONES.find(x => x[0] === z) || [0, "?"])[1];

  /* ---------- time ---------- */
  function tzOff(tz, t) {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" }).formatToParts(new Date(t));
    const g = k => +p.find(x => x.type === k).value;
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute")) - t;
  }
  function evUTC(r) {
    if (!r.event_date) return null;
    const a = r.event_date.split("-"), h = (r.event_time || "12:00").split(":");
    const n = Date.UTC(+a[0], +a[1] - 1, +a[2], +h[0], +h[1]);
    return n - tzOff(r.event_tz || "America/Chicago", n);
  }
  const fDay = (u, tz) => new Date(u).toLocaleDateString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" });
  const fTime = (u, tz, h24) => new Date(u).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: !h24 });
  const ymdIn = (u, tz) => new Date(u).toLocaleDateString("en-CA", { timeZone: tz });
  const today = () => ymdIn(Date.now(), MYZ);
  const fStamp = iso => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: !BR });
  const fDue = d => { if (!d) return ""; const [y, m, dd] = d.split("-"); return new Date(Date.UTC(+y, +m - 1, +dd, 12)).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }); };
  function whenHTML(r) {
    const u = evUTC(r); if (u == null) return "";
    const z = r.event_tz || "America/Chicago";
    const t = r.event_time ? " · " + fTime(u, z) + " " + zAbbr(z) : "";
    const mine = r.event_time ? `<small>${esc(fDay(u, MYZ))} · ${esc(fTime(u, MYZ, BR))} ${MYLABEL}</small>` : "";
    return `<div class="when"><i class="ti ti-broadcast"></i><div>${esc(fDay(u, z))}${esc(t)}${mine}</div></div>`;
  }
  function tzHTML(r) {
    const u = evUTC(r);
    if (u == null) return `<div class="note">Pick a date to see the time in every zone.</div>`;
    const cells = ZONES.filter(z => z[1] !== "MT" || r.event_tz === z[0]).slice(0, 3).map(z => [z[2], z[0], false]);
    if (!cells.some(c => c[1] === MYZ)) cells.push([MYLABEL, MYZ, BR]);
    return `<div class="tz">${cells.map(c => `<div class="${c[1] === MYZ ? "mine" : ""}"><span>${esc(c[0])}</span><b>${r.event_time ? esc(fTime(u, c[1], c[2])) : "—"}</b><small>${esc(fDay(u, c[1]))}</small></div>`).join("")}</div>`;
  }

  /* ---------- state + storage ---------- */
  const S = { items: { clients: [], requests: [], comments: [], activity: [] }, members: [], me: null, view: "board", open: null, client: null, modal: null, filter: "", cal: null, hfilter: "", live: false, dirty: false };
  const KINDS = ["clients", "requests", "comments", "activity"];
  let sb = null;

  const local = {
    async load() {
      let d = null; try { d = JSON.parse(localStorage.getItem("voxdesk-v2")); } catch (e) {}
      if (!d) { d = seed(); localStorage.setItem("voxdesk-v2", JSON.stringify(d)); }
      return d;
    },
    flush() { try { localStorage.setItem("voxdesk-v2", JSON.stringify({ items: S.items, members: S.members })); } catch (e) {} },
    async save() { this.flush(); }, async remove() { this.flush(); },
  };
  const remote = {
    async load() {
      const m = await sb.from("desk_members").select("*");
      if (m.error) throw m.error;
      const it = await sb.from("desk_items").select("id,kind,data");
      if (it.error) throw it.error;
      const items = { clients: [], requests: [], comments: [], activity: [] };
      it.data.forEach(r => items[r.kind] && items[r.kind].push(Object.assign({}, r.data, { id: r.id })));
      return { items, members: m.data };
    },
    async save(kind, o) {
      const { error } = await sb.from("desk_items").upsert({ id: o.id, kind, data: o, updated_at: now(), updated_by: S.me.email });
      if (error) toast("Could not save. Check your connection.");
    },
    async remove(kind, id) { const { error } = await sb.from("desk_items").delete().eq("id", id); if (error) toast("Could not delete."); },
  };
  const store = LIVE ? remote : local;
  const save = (kind, o) => store.save(kind, o);
  const get = (kind, id) => S.items[kind].find(x => x.id === id);
  const clientName = id => { const c = get("clients", id); return c ? c.name : id === "all" ? "All clients" : "No client"; };
  const first = n => String(n || "").split(" ")[0];
  const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  function log(text, ref, client_id, from, to) {
    const a = { id: uid(), ref, client_id: client_id || null, actor: S.me.name, text, at: now() };
    if (from !== undefined || to !== undefined) { a.from = String(from == null ? "" : from); a.to = String(to == null ? "" : to); }
    S.items.activity.push(a); save("activity", a);
    const hb = $("#hbox"); if (hb && S.open && ref === S.open) hb.innerHTML = histList(S.items.activity.filter(x => x.ref === ref));
    const cb = $("#chbox"); if (cb && S.client && client_id === S.client) cb.innerHTML = histList(S.items.activity.filter(x => x.client_id === S.client));
  }
  /* One history row. Rows with a before/after value open on click. */
  function histRow(a, ctx) {
    const r = ctx && get("requests", a.ref);
    const line = `<time>${esc(fStamp(a.at))}</time><span><b>${esc(a.actor)}</b> ${esc(a.text)}${ctx && a.client_id ? " · " + esc(clientName(a.client_id)) : ""}${r ? " · " + esc(r.title || typeOf(r).label) : ""}</span>`;
    const go = r ? `<button class="btn sm ghost" data-act="open" data-id="${r.id}" style="margin-left:auto;flex:none"><i class="ti ti-arrow-up-right"></i></button>` : "";
    if (a.from === undefined) return `<div class="hist">${line}${go}</div>`;
    return `<details class="hist hd"><summary>${line}<i class="ti ti-chevron-down" style="margin-left:auto"></i>${go}</summary><div class="diff"><div><span>Before</span><p>${a.from ? mentions(a.from) : "<em>(empty)</em>"}</p></div><div><span>After</span><p>${a.to ? mentions(a.to) : "<em>(empty)</em>"}</p></div></div></details>`;
  }
  const histList = (l, ctx) => l.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300).map(a => histRow(a, ctx)).join("") || `<div class="empty">Nothing yet</div>`;


  function hid(str) { let h1 = 0x811c9dc5, h2 = 0x1b873593; for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0; h2 ^= h2 >>> 13; } const x = (h1.toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0") + h1.toString(16).padStart(8, "0")); return "51ac0000-0000-4000-8" + x.slice(0, 3) + "-" + x.slice(3, 15); }
  function seed() {
    const M = [["jeferson@clicklabpro.com", "Jeferson", "clicklab"], ["alex@realcolordesign.com", "Alex", "clicklab"], ["katarina@pineda.co", "Kat", "pineda"], ["athalia@leadkitchen.com", "Athalia", "pineda"], ["jess.gonzalez@pineda.co", "Jess", "pineda"], ["neeco.hernandez@pineda.co", "Neeco", "pineda"], ["javier.chavez@ryanpineda.com", "Javi", "pineda"]].map(m => ({ email: m[0], name: m[1], team: m[2] }));
    return { members: M, items: { clients: [], requests: [], comments: [], activity: [] } };
  }
  /* Adds Slack items that this workspace has not seen yet. Never overwrites an edited item. */
  function mergeImport() {
    const I = window.DESK_IMPORT; if (!I) return 0;
    let seen = []; try { seen = JSON.parse(localStorage.getItem("voxdesk-seen") || "[]"); } catch (e) {}
    const S2 = new Set(seen); let n = 0;
    const li = (x, pre, i) => typeof x === "string" ? { id: hid(pre + i), label: x, done: false, url: "", by: "", at: "" } : { id: hid(pre + i), label: x.label, done: !!x.done, url: x.url || "", by: x.by || "", at: x.done ? I.synced_at : "" };
    const lk = (x, pre, i) => ({ id: hid(pre + "l" + i), label: x.label, url: x.url });
    I.clients.forEach(c => {
      const id = hid("client:" + c.key); if (S2.has(id) || get("clients", id)) return;
      const o = { id, key: c.key, name: c.name, brand: c.brand, am: c.am, tz: c.tz, slack: c.slack, notes: c.notes, src: "slack", links: (c.links || []).map((x, i) => lk(x, id, i)), deliverables: c.deliverables.map((x, i) => li(x, id, i)) };
      S.items.clients.push(o); save("clients", o); S2.add(id); n++;
    });
    I.requests.forEach(r => {
      const id = hid("req:" + r.ts); if (S2.has(id) || get("requests", id)) return;
      const cid = r.client === "all" ? "all" : r.client ? hid("client:" + r.client) : "";
      const t = TYPES.find(x => x.id === r.type);
      let list = r.global ? I.clients.map(c => ({ label: c.name + (c.brand ? " · " + c.brand : ""), done: (r.done || []).includes(c.key), by: "Alex" })) : (r.checklist || t.list);
      if (r.allDone) list = list.map(x => ({ label: x.label || x, done: true, url: x.url || "", by: r.assignee }));
      const o = { id, client_id: cid, type: r.type, title: r.title, status: r.status, assignee: (r.tagged || [r.assignee]).filter(Boolean)[0] || "", assignees: (r.tagged || [r.assignee]).filter(Boolean), requester: r.requester || "", waiting_on: r.waiting_on || "", due_date: "", event_date: r.event_date || "", event_time: r.event_time || "", event_tz: r.event_tz || "America/Chicago", details: r.note || "", source_text: r.text || "", slack_url: r.slack || "", src: "slack", links: (r.links || []).map((x, i) => lk(x, id, i)), checklist: list.map((x, i) => li(x, id, i)), created_at: r.at, done_at: r.done_at || null };
      S.items.requests.push(o); save("requests", o);
      const a = { id: hid("act:" + r.ts), ref: id, client_id: cid, actor: r.requester || "Slack", text: "sent the request in Slack", at: r.at }; S.items.activity.push(a); save("activity", a);
      if (r.done_at) { const d = { id: hid("actd:" + r.ts), ref: id, client_id: cid, actor: r.assignee || "ClickLab", text: "set status to Done", at: r.done_at }; S.items.activity.push(d); save("activity", d); }
      S2.add(id); n++;
    });
    localStorage.setItem("voxdesk-seen", JSON.stringify([...S2]));
    return n;
  }

  /* ---------- small renderers ---------- */
  const asg = r => Array.isArray(r.assignees) ? r.assignees : (r.assignee ? [r.assignee] : []);
  /* Who moved the request between columns: last move of each person, oldest first. */
  const movers = r => { const m = new Map(); S.items.activity.filter(a => a.ref === r.id && /^set status to/.test(a.text)).sort((a, b) => a.at.localeCompare(b.at)).forEach(a => { m.delete(a.actor); m.set(a.actor, a); }); return [...m.values()]; };
  const typeOf = r => TYPES.find(t => t.id === r.type) || TYPES[1];
  const prog = l => { const n = (l || []).length, d = (l || []).filter(x => x.done).length; return { n, d, pct: n ? Math.round(d / n * 100) : 0 }; };
  const opt = (v, l, cur) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(l)}</option>`;
  const memberOpts = (cur, blank) => opt("", blank || "Nobody", cur || "") + [...new Set(S.members.map(m => m.name))].map(n => opt(n, n, cur)).join("");
  const clientOpts = (cur, all) => (all ? opt("all", "All clients", cur) : "") + S.items.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => opt(c.id, c.name + (c.brand ? " · " + c.brand : ""), cur)).join("");
  const zoneOpts = (cur, blank) => (blank ? opt("", "Not set", cur || "") : "") + ZONES.map(z => opt(z[0], z[2] + " (" + z[1] + ")", cur)).join("");
  const mentions = t => esc(t).replace(/@([A-Za-zÀ-ÿ]+)/g, (m, n) => S.members.some(x => first(x.name).toLowerCase() === n.toLowerCase()) ? `<span class="at">@${n}</span>` : m).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");

  function listHTML(kind, id, field, ph) {
    const o = get(kind, id), l = o[field] || [];
    return l.map(it => `<div class="li${it.done ? " done" : ""}">
      <button class="chk${it.done ? " on" : ""}" data-act="tgl" data-k="${kind}" data-id="${id}" data-fld="${field}" data-it="${it.id}" aria-label="Mark done">${it.done ? '<i class="ti ti-check"></i>' : ""}</button>
      <input class="bare lt" value="${esc(it.label)}" data-li="label" data-k="${kind}" data-id="${id}" data-fld="${field}" data-it="${it.id}">
      <input class="bare lu" value="${esc(it.url || "")}" placeholder="Add link" data-li="url" data-k="${kind}" data-id="${id}" data-fld="${field}" data-it="${it.id}">
      ${it.url ? `<a class="x" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="Open link"><i class="ti ti-external-link"></i></a>` : ""}
      ${it.done && it.by ? `<span class="who">${esc(first(it.by))}</span>` : ""}
      <button class="x" data-act="lidel" data-k="${kind}" data-id="${id}" data-fld="${field}" data-it="${it.id}" aria-label="Remove"><i class="ti ti-x"></i></button></div>`).join("") +
      `<div class="add"><input class="inp" placeholder="${esc(ph)}" data-add="${kind}|${id}|${field}"><button class="btn sm" data-act="liadd" data-k="${kind}" data-id="${id}" data-fld="${field}"><i class="ti ti-plus"></i>Add</button></div>`;
  }
  function linksHTML(kind, id) {
    const o = get(kind, id), l = o.links || [];
    return l.map(it => `<div class="li"><i class="ti ti-link" style="color:var(--laranja)"></i>
      <input class="bare" style="width:130px;flex:none" value="${esc(it.label)}" placeholder="Name" data-li="label" data-k="${kind}" data-id="${id}" data-fld="links" data-it="${it.id}">
      <input class="bare" style="color:var(--brasa)" value="${esc(it.url)}" placeholder="https://" data-li="url" data-k="${kind}" data-id="${id}" data-fld="links" data-it="${it.id}">
      ${it.url ? `<a class="x" href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="Open link"><i class="ti ti-external-link"></i></a>` : ""}
      <button class="x" data-act="lidel" data-k="${kind}" data-id="${id}" data-fld="links" data-it="${it.id}" aria-label="Remove"><i class="ti ti-x"></i></button></div>`).join("") +
      `<div class="add"><input class="inp" placeholder="Paste a link (Drive, page, Zoom, doc)" data-add="${kind}|${id}|links"><button class="btn sm" data-act="liadd" data-k="${kind}" data-id="${id}" data-fld="links"><i class="ti ti-plus"></i>Add</button></div>`;
  }
  /* Column order: manual priority (rank) first, then due date, then newest. */
  const byRank = (a, b) => ((a.rank == null ? 1e9 : a.rank) - (b.rank == null ? 1e9 : b.rank)) || ((a.due_date || "9") < (b.due_date || "9") ? -1 : (a.due_date || "9") > (b.due_date || "9") ? 1 : (b.created_at || "").localeCompare(a.created_at || ""));
  const inCol = (r, st, sub) => r.status === st && (!sub || (sub === "client") === (r.type === "client"));
  function cardHTML(r, pos) {
    const mv = movers(r);
    const p = prog(r.checklist), t = typeOf(r), late = r.due_date && r.due_date < today() && r.status !== "done" && r.status !== "tested";
    return `<div class="card" draggable="true" data-act="open" data-id="${r.id}">
      <div style="display:flex;gap:8px;align-items:flex-start">${typeof pos === "number" && r.status !== "done" ? `<span class="rk" title="Priority ${pos + 1}">${pos + 1}</span>` : ""}<div style="flex:1;min-width:0"><div class="cl">${esc(clientName(r.client_id))}</div><div class="sub">${esc(r.title || t.label)}</div></div><button class="chk${r.status === "done" ? " on" : ""}" data-act="quick" data-id="${r.id}" title="${r.status === "done" ? "Reopen" : "Mark as done"}" aria-label="Mark as done">${r.status === "done" ? '<i class="ti ti-check"></i>' : ""}</button></div>
      ${whenHTML(r)}
      ${r.source_text ? `<div class="q"><i class="ti ti-brand-slack"></i><span><b>${esc(r.requester || "Slack")}:</b> ${esc(r.source_text.length > 150 ? r.source_text.slice(0, 150) + "…" : r.source_text)}</span></div>` : ""}
      ${p.n ? `<div class="bar"><b style="width:${p.pct}%"></b></div>` : ""}
      <div class="meta"><span class="pill o"><i class="ti ${t.icon}"></i>${esc(t.label)}</span>
      ${r.status === "info" && r.waiting_on ? `<span class="pill a">Waiting on ${esc(r.waiting_on)}</span>` : ""}
      ${r.status === "tested" ? `<span class="pill g"><i class="ti ti-rocket"></i>Cleared to launch</span>` : ""}
      ${r.due_date ? `<span class="pill${late ? " r" : ""}">Due ${esc(fDue(r.due_date))}</span>` : ""}
      ${p.n ? `<span>${p.d}/${p.n}</span>` : ""}
      ${r.slack_url ? `<a class="pill" href="${esc(r.slack_url)}" target="_blank" rel="noopener" style="text-decoration:none" title="Open the message in Slack"><i class="ti ti-brand-slack"></i>Slack</a>` : r.src === "slack" ? `<i class="ti ti-brand-slack" title="From Slack"></i>` : ""}
      <span style="margin-left:auto;display:inline-flex;gap:3px">${asg(r).map(n => `<span class="av" title="Assigned to ${esc(n)}">${esc(initials(n))}</span>`).join("")}</span></div>
      ${mv.length ? `<div class="mv"><i class="ti ti-arrows-exchange"></i><span>Moved by</span>${mv.map(m => `<span class="av m" title="${esc(m.actor)} · ${esc(m.text.replace("set status to", "→"))} · ${esc(fStamp(m.at))}">${esc(initials(m.actor))}</span>`).join("")}<small>${esc(fStamp(mv[mv.length - 1].at))}</small></div>` : ""}</div>`;
  }

  /* ---------- views ---------- */
  function vBoard() {
    const rs = S.items.requests.filter(r => (!S.filter || r.client_id === S.filter) && (!S.who || asg(r).includes(S.who)));
    const team = [...new Set(S.members.filter(m => m.team === "clicklab").map(m => m.name))];
    const cut = Date.now() - 7 * 864e5;
    return `<div class="top"><h1>Requests</h1>
      <select class="sel" style="width:150px" data-ui="who">${opt("", "Everyone", S.who || "")}${team.map(n => opt(n, n, S.who)).join("")}</select>
      <select class="sel" style="width:220px" data-ui="filter">${opt("", "All clients", S.filter)}${clientOpts(S.filter)}</select>
      <button class="btn pri" data-act="new"><i class="ti ti-plus"></i>Add request</button></div>
      <div class="board">${[{ id: "new", sub: "client", label: "New clients", color: "#FF6D29", empty: "No new client to build" }, { id: "new", sub: "update", label: "Updates", color: "#8AB8FF", empty: "No new update" }, ...STATUS.slice(1)].map(s => {
        let l = rs.filter(r => r.status === s.id && (!s.sub || (s.sub === "client") === (r.type === "client")));
        if (s.id === "done") l = l.filter(r => !r.done_at || +new Date(r.done_at) > cut);
        l.sort(s.id === "done" ? (a, b) => (b.done_at || "").localeCompare(a.done_at || "") : byRank);
        return `<div class="col" data-drop="${s.id}" data-sub="${s.sub || ""}"><div class="colh"><span class="dot" style="background:${s.color}"></span>${s.label}<span class="q">${l.length}</span></div>
        ${l.map(cardHTML).join("") || `<div class="empty">${s.empty || (s.id === "done" ? "Done in the last 7 days shows here" : "Drag a card here")}</div>`}</div>`;
      }).join("")}</div>`;
  }
  function vClients() {
    if (S.client && get("clients", S.client)) return vClient(get("clients", S.client));
    return `<div class="top"><h1>Clients</h1><button class="btn pri" data-act="newclient"><i class="ti ti-plus"></i>Add client</button></div>
      <div class="grid">${S.items.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => {
        const p = prog(c.deliverables), open = S.items.requests.filter(r => r.client_id === c.id && r.status !== "done").length;
        const nx = S.items.requests.filter(r => r.client_id === c.id && evUTC(r) > Date.now()).sort((a, b) => evUTC(a) - evUTC(b))[0];
        return `<div class="card" data-act="client" data-id="${c.id}"><div class="cl">${esc(c.name)}</div><div class="sub">${esc(c.brand || "")}</div>
          ${nx ? whenHTML(nx) : `<div class="when"><i class="ti ti-calendar-off" style="color:var(--cinza)"></i><div style="color:var(--cinza)">No webinar date set</div></div>`}
          <div class="bar"><b style="width:${p.pct}%"></b></div>
          <div class="meta"><span>${p.d} of ${p.n} delivered</span>${open ? `<span class="pill o">${open} open</span>` : ""}${c.am ? `<span class="av" style="margin-left:auto" title="${esc(c.am)}">${esc(initials(c.am))}</span>` : ""}</div></div>`;
      }).join("")}</div>`;
  }
  function vClient(c) {
    const rs = S.items.requests.filter(r => r.client_id === c.id).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const p = prog(c.deliverables);
    const F = (f, ph, cls) => `<input class="${cls || "inp"}" value="${esc(c[f] || "")}" placeholder="${ph}" data-f="${f}" data-k="clients" data-id="${c.id}">`;
    return `<div class="top"><button class="btn ghost" data-act="clients"><i class="ti ti-arrow-left"></i>Clients</button><h1>${esc(c.name)}</h1>
      <button class="btn" data-act="new" data-client="${c.id}"><i class="ti ti-plus"></i>New request</button><button class="btn ghost" data-act="delclient" data-id="${c.id}"><i class="ti ti-trash"></i></button></div>
      <div class="two"><div>
        <div class="panel"><h3><i class="ti ti-checklist"></i>Deliveries · ${p.d} of ${p.n}</h3>${listHTML("clients", c.id, "deliverables", "Add a delivery (page, automation, funnel)")}</div>
        <div class="panel" style="margin-top:16px"><h3><i class="ti ti-inbox"></i>Requests</h3>
        ${rs.map(r => `<div class="hist go" data-act="open" data-id="${r.id}"><time>${esc(fDue(r.due_date) || "No due date")}</time><span><b>${esc(r.title || typeOf(r).label)}</b> · ${esc(STATUS.find(s => s.id === r.status).label)}</span></div>`).join("") || `<div class="empty">No requests yet</div>`}</div>
      </div><div>
        <div class="panel"><h3><i class="ti ti-id"></i>Details</h3><div class="fg">
          <div><span class="lab">Spokesperson</span>${F("name", "Name")}</div><div><span class="lab">Brand</span>${F("brand", "Brand or program")}</div>
          <div><span class="lab">Account manager</span><select class="sel" data-f="am" data-k="clients" data-id="${c.id}">${memberOpts(c.am)}</select></div>
          <div><span class="lab">Usual time zone</span><select class="sel" data-f="tz" data-k="clients" data-id="${c.id}">${zoneOpts(c.tz, true)}</select></div>
          <div class="w"><span class="lab">Slack channel</span>${F("slack", "pinedapartners-...")}</div>
          <div class="w"><span class="lab">Notes</span><textarea class="txt" style="min-height:150px" data-f="notes" data-k="clients" data-id="${c.id}" placeholder="Brand colours, rules, anything the team must know">${esc(c.notes || "")}</textarea></div></div></div>
        <div class="panel" style="margin-top:16px"><h3><i class="ti ti-link"></i>Links</h3>${linksHTML("clients", c.id)}</div>
        <div class="panel" style="margin-top:16px"><h3><i class="ti ti-history"></i>History</h3><div id="chbox">${histList(S.items.activity.filter(a => a.client_id === c.id))}</div></div>
      </div></div>`;
  }
  function vCalendar() {
    if (!S.cal) { const t = today().split("-"); S.cal = { y: +t[0], m: +t[1] - 1 }; }
    const { y, m } = S.cal, f = new Date(Date.UTC(y, m, 1)), start = f.getUTCDay(), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const ev = {}; const push = (d, e) => (ev[d] = ev[d] || []).push(e);
    S.items.requests.forEach(r => {
      const u = evUTC(r);
      if (u != null) push(ymdIn(u, MYZ), { r, cls: r.status === "tested" || r.status === "done" ? "ok" : "", t: (r.event_time ? fTime(u, MYZ, BR) + " " : "") + clientName(r.client_id), tip: fDay(u, r.event_tz) + (r.event_time ? " · " + fTime(u, r.event_tz) + " " + zAbbr(r.event_tz) : "") });
      if (r.due_date && r.status !== "done") push(r.due_date, { r, cls: "due", t: "Due · " + clientName(r.client_id), tip: r.title || "" });
    });
    let cells = ""; const td = today();
    for (let i = 0; i < Math.ceil((start + dim) / 7) * 7; i++) {
      const d = new Date(Date.UTC(y, m, i - start + 1)), key = d.toISOString().slice(0, 10), out = d.getUTCMonth() !== m;
      cells += `<div class="day${out ? " out" : ""}${key === td ? " today" : ""}"><span>${d.getUTCDate()}</span>${(ev[key] || []).map(e => `<button class="ev ${e.cls}" title="${esc(e.tip)}" data-act="open" data-id="${e.r.id}">${esc(e.t)}</button>`).join("")}</div>`;
    }
    return `<div class="top"><h1>${f.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" })}</h1>
      <span class="pill o">Webinar</span><span class="pill a">Delivery due</span><span class="pill g">Updated & tested</span><span class="pill">Times in ${MYLABEL}</span>
      <button class="btn sm" data-act="cal" data-d="-1"><i class="ti ti-chevron-left"></i></button><button class="btn sm" data-act="cal" data-d="0">Today</button><button class="btn sm" data-act="cal" data-d="1"><i class="ti ti-chevron-right"></i></button></div>
      <div class="cal">${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => `<div class="dn">${d}</div>`).join("")}${cells}</div>`;
  }
  function vHistory() {
    const l = S.items.activity.filter(a => !S.hfilter || a.client_id === S.hfilter).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 300);
    return `<div class="top"><h1>History</h1><select class="sel" style="width:220px" data-ui="hfilter">${opt("", "All clients", S.hfilter)}${clientOpts(S.hfilter)}</select></div>
      <div class="panel">${histList(l, true)}</div>`;
  }

  /* ---------- drawer + modals ---------- */
  function drawerHTML(r) {
    const cm = S.items.comments.filter(c => c.request_id === r.id).sort((a, b) => a.at.localeCompare(b.at));
    const hs = S.items.activity.filter(a => a.ref === r.id).sort((a, b) => b.at.localeCompare(a.at));
    const A = `data-k="requests" data-id="${r.id}"`;
    return `<div class="veil" data-act="close"><div class="drawer" data-stop>
      <div class="dh"><span class="pill o"><i class="ti ${typeOf(r).icon}"></i>${esc(typeOf(r).label)}</span><span class="sp"></span>
        <button class="btn ghost sm" data-act="delreq" data-id="${r.id}"><i class="ti ti-trash"></i>Delete</button><button class="btn ghost sm" data-act="close"><i class="ti ti-x"></i></button></div>
      <div id="pbar"></div>
      <input class="bare ttl" value="${esc(r.title || "")}" placeholder="Short title" data-f="title" ${A}>
      <div class="steps">${STATUS.map(s => `<button class="step${r.status === s.id ? " on" : ""}" data-act="status" data-id="${r.id}" data-s="${s.id}">${s.label}</button>`).join("")}</div>
      ${r.status === "tested" ? `<div class="note" style="color:var(--verde)"><i class="ti ti-rocket"></i> Pages and automations are updated and tested. Ads can launch.</div>` : ""}
      ${r.source_text ? `<div class="sec cm" style="border-color:rgba(255,109,41,.35)"><div class="h"><i class="ti ti-brand-slack" style="color:var(--laranja);font-size:16px"></i><b>${esc(r.requester || "Slack")}</b>${esc(fStamp(r.created_at))}${r.slack_url ? `<a href="${esc(r.slack_url)}" target="_blank" rel="noopener" style="margin-left:auto">Open in Slack</a>` : ""}</div>${mentions(r.source_text)}</div>` : ""}
      <div class="sec fg">
        <div><span class="lab">Client</span><select class="sel" data-f="client_id" ${A}>${opt("", "No client", r.client_id)}${clientOpts(r.client_id, true)}</select></div>
        <div><span class="lab">Type</span><select class="sel" data-f="type" ${A}>${TYPES.map(t => opt(t.id, t.label, r.type)).join("")}</select></div>
        <div><span class="lab">Assigned to</span><div style="display:flex;gap:6px;flex-wrap:wrap">${[...new Set([...S.members.filter(m => m.team === "clicklab").map(m => m.name), ...asg(r)])].map(n => `<button class="step${asg(r).includes(n) ? " on" : ""}" data-act="asg" data-id="${r.id}" data-n="${esc(n)}"><span class="av" style="width:18px;height:18px;font-size:9px">${esc(initials(n))}</span><span data-i18n>${esc(n)}</span></button>`).join("")}</div></div>
        <div><span class="lab">Due date</span><input type="date" class="inp" value="${esc(r.due_date || "")}" data-f="due_date" ${A}></div>
        <div><span class="lab">Requested by</span><select class="sel" data-f="requester" ${A}>${memberOpts(r.requester)}</select></div>
        <div><span class="lab">Waiting on</span><select class="sel" data-f="waiting_on" ${A}>${memberOpts(r.waiting_on, "Nobody")}</select></div>
      </div>
      <div class="sec panel"><h3><i class="ti ti-broadcast"></i>Webinar date and time</h3>
        <div style="display:grid;grid-template-columns:1.2fr 1fr 1.2fr;gap:8px">
          <input type="date" class="inp" value="${esc(r.event_date || "")}" data-f="event_date" ${A}><input type="time" class="inp" value="${esc(r.event_time || "")}" data-f="event_time" ${A}>
          <select class="sel" data-f="event_tz" ${A}>${zoneOpts(r.event_tz || "America/Chicago")}</select></div>
        <div id="tzbox">${tzHTML(r)}</div></div>
      <div class="sec"><span class="lab">Notes</span><textarea class="txt" data-f="details" ${A} placeholder="Notes for the team. What is missing, what was decided.">${esc(r.details || "")}</textarea></div>
      <div class="sec panel"><h3><i class="ti ti-checklist"></i>Checklist · ${prog(r.checklist).d} of ${prog(r.checklist).n}</h3>${listHTML("requests", r.id, "checklist", "Add a step")}</div>
      <div class="sec panel"><h3><i class="ti ti-link"></i>Links</h3>${linksHTML("requests", r.id)}</div>
      <div class="sec"><span class="lab">Comments</span>
        ${cm.map(c => `<div class="cm"><div class="h"><span class="av">${esc(initials(c.author))}</span><b>${esc(c.author)}</b>${esc(fStamp(c.at))}</div>${mentions(c.body)}</div>`).join("")}
        <textarea class="txt" id="cbox" style="min-height:64px" placeholder="Write a comment. Use @ to tag someone."></textarea>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">${S.members.filter((m, i, l) => m.name !== S.me.name && l.findIndex(x => x.name === m.name) === i).map(m => `<button class="btn sm ghost" data-act="at" data-n="${esc(first(m.name))}">@${esc(first(m.name))}</button>`).join("")}
        <button class="btn pri sm" style="margin-left:auto" data-act="comment" data-id="${r.id}">Comment</button></div></div>
      <div class="sec"><span class="lab">History</span><div id="hbox">${histList(hs)}</div></div>
    </div></div>`;
  }
  function newHTML() {
    const d = S.modal, t = TYPES.find(x => x.id === d.type);
    return `<div class="veil mid" data-act="closemodal"><div class="modal" data-stop>
      <div class="dh"><span class="ttl">New request</span><span class="sp"></span><button class="btn ghost sm" data-act="closemodal"><i class="ti ti-x"></i></button></div>
      <div class="types">${TYPES.map(x => `<button class="type${x.id === d.type ? " on" : ""}" data-act="ntype" data-t="${x.id}"><i class="ti ${x.icon}"></i><b>${x.label}</b>${x.hint}</button>`).join("")}</div>
      <div class="fg">
        ${d.type === "global" ? "" : `<div><span class="lab">Client</span><select class="sel" data-n="client_id">${opt("", "Choose a client", d.client_id)}${clientOpts(d.client_id)}${opt("+", "+ New client", d.client_id)}</select></div>`}
        <div${d.type === "global" ? ' class="w"' : ""}><span class="lab">${d.type === "global" ? "What changes for every client?" : "Short title"}</span><input class="inp" data-n="title" value="${esc(d.title)}" placeholder="${d.type === "launch" ? "Webinar Nov 12" : d.type === "client" ? "Launch pages and automations" : "What needs to be done"}"></div>
        ${d.client_id === "+" && d.type !== "global" ? `<div><span class="lab">New client name</span><input class="inp" data-n="newname" value="${esc(d.newname)}" placeholder="Spokesperson"></div><div><span class="lab">Brand</span><input class="inp" data-n="newbrand" value="${esc(d.newbrand)}" placeholder="Brand or program"></div>` : ""}
        ${d.type === "launch" ? `<div class="w"><span class="lab">Webinar date, time and zone</span><div style="display:grid;grid-template-columns:1.2fr 1fr 1.2fr;gap:8px">
          <input type="date" class="inp" data-n="event_date" value="${esc(d.event_date)}"><input type="time" class="inp" data-n="event_time" value="${esc(d.event_time)}"><select class="sel" data-n="event_tz">${zoneOpts(d.event_tz)}</select></div><div id="ntz">${tzHTML(d)}</div></div>` : ""}
        <div><span class="lab">Needed by</span><input type="date" class="inp" data-n="due_date" value="${esc(d.due_date)}"></div>
        <div><span class="lab">Link (optional)</span><input class="inp" data-n="link" value="${esc(d.link)}" placeholder="Zoom, Drive, doc"></div>
        <div class="w"><span class="lab">Details (optional)</span><textarea class="txt" data-n="details" placeholder="Paste the copy or the instruction here.">${esc(d.details)}</textarea></div>
      </div>
      <div class="err" id="nerr"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:14px;gap:10px"><span class="note" style="margin:0">${t.list.length ? "A checklist with " + t.list.length + " steps is added. You can edit it." : d.type === "global" ? "One checklist line per client is added." : ""}</span><button class="btn pri" data-act="create">Send request</button></div>
    </div></div>`;
  }

  /* ---------- render ---------- */
  function renderMain() {
    const v = { board: vBoard, clients: vClients, calendar: vCalendar, history: vHistory }[S.view]();
    $("#main").innerHTML = v;
    const n = S.items.requests.filter(r => r.status === "new").length;
    document.querySelectorAll(".nav").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
    $("#nnew").textContent = n || ""; $("#nnew").style.display = n ? "" : "none";
    onRender();
  }
  function renderOver() {
    const r = S.open && get("requests", S.open);
    const sc = $(".drawer") ? $(".drawer").scrollTop : 0;
    $("#over").innerHTML = (r ? drawerHTML(r) : "") + (S.modal ? newHTML() : "");
    if ($(".drawer")) $(".drawer").scrollTop = sc;
    onRender();
  }
  function render() {
    if (!S.me) return;
    if (!$("#main")) {
      $("#app").innerHTML = `<div class="shell"><aside class="side">
        <div class="brand"><img src="assets/vox-simbolo.svg" alt="Vox Digital"><div><b>VOX</b><span>Desk</span></div></div>
        ${[["board", "ti-layout-kanban", "Requests"], ["clients", "ti-users", "Clients"], ["calendar", "ti-calendar", "Calendar"], ["history", "ti-history", "History"]].map(n => `<button class="nav" data-act="view" data-v="${n[0]}"><i class="ti ${n[1]}"></i><span>${n[2]}</span>${n[0] === "board" ? '<b class="n" id="nnew"></b>' : ""}</button>`).join("")}
        <button class="btn sm" data-act="lang" style="margin:0 6px 0;align-self:flex-start" title="Trocar o idioma da interface · Switch the interface language"><i class="ti ti-language"></i><span data-i18n>${window.DESK_I18N && window.DESK_I18N.get() === "pt" ? "Português · EN" : "English · PT"}</span></button>
        <div id="online" style="margin:auto 6px 10px"></div>
        <div class="note" id="live" style="margin:10px 6px 0;display:${LIVE ? "block" : "none"}"><span class="dot" style="display:inline-block;background:${S.live ? "var(--verde)" : "var(--cinza)"}"></span> <span>${S.live ? "Live" : "Connecting"}</span></div>
        <div class="note" style="margin:4px 6px 0;line-height:1.5">${window.DESK_IMPORT ? `<i class="ti ti-brand-slack"></i> Slack sync<br>${esc(fStamp(window.DESK_IMPORT.synced_at))}` : ""}</div>
        <div class="me" style="margin-top:10px"><b>${esc(S.me.name)}</b>${esc(S.me.team === "clicklab" ? "ClickLab" : "Pineda Partners")}${LIVE ? "" : " · demo"}<br><button data-act="logout">Sign out</button></div>
      </aside><main class="main" id="main"></main></div><div id="over"></div><div id="chat"></div>`;
    }
    renderMain(); renderOver();
  }
  /* ---------- presence: who is online and what each person has open ---------- */
  let pres = null, lastTrack = "", typing = false;
  const myPresence = () => ({ name: S.me.name, team: S.me.team, view: S.client ? "client" : S.view, open: S.open || null, client: S.client || null, typing });
  function onRender() {
    if (!S.me) return;
    if (pres && S.presOn) { const j = JSON.stringify(myPresence()); if (j !== lastTrack) { lastTrack = j; pres.track(myPresence()); } }
    renderChat(); paintPresence();
  }
  function paintPresence() {
    const pt = window.DESK_I18N && window.DESK_I18N.get() === "pt";
    const W = pt ? { you: "você", edit: "editando", view: "vendo", on: "Online agora", alone: "Só você está online", too: "também está neste pedido", tooP: "também estão neste pedido", views: { board: "no quadro", clients: "em Clientes", client: "em um cliente", calendar: "no calendário", history: "no histórico" } }
                 : { you: "you", edit: "editing", view: "viewing", on: "Online now", alone: "Only you are online", too: "is also in this request", tooP: "are also in this request", views: { board: "on the board", clients: "in Clients", client: "in a client", calendar: "in the calendar", history: "in the history" } };
    const others = (S.online || []).filter(u => u.name !== S.me.name);
    const box = $("#online");
    const un = S.unreadDm || {}, dmBtn = n => `<button class="x dm" data-act="dm" data-n="${esc(n)}" title="${pt ? "Conversar com " : "Chat with "}${esc(n)}" aria-label="Chat with ${esc(n)}"><i class="ti ti-message-circle"></i>${un[dmKey(n)] ? `<b>${un[dmKey(n)]}</b>` : ""}</button>`;
    const off = peers().filter(n => !others.some(u => u.name === n));
    if (box) box.innerHTML = `<span class="lab" data-i18n>${W.on} · ${others.length + 1}</span><div class="on"><span class="av live">${esc(initials(S.me.name))}</span><span data-i18n>${esc(S.me.name)} (${W.you})</span></div>` + others.map(u => { const r = u.open && get("requests", u.open); return `<div class="on${r ? " go" : ""}" ${r ? `data-act="open" data-id="${r.id}"` : ""}><span class="av live${u.typing ? " ty" : ""}">${esc(initials(u.name))}</span><span data-i18n><b>${esc(u.name)}</b><small>${r ? (u.typing ? W.edit : W.view) + " · " + esc(r.title || "") : W.views[u.view] || ""}</small></span>${dmBtn(u.name)}</div>`; }).join("") + off.map(n => `<div class="on off"><span class="av">${esc(initials(n))}</span><span data-i18n><b>${esc(n)}</b><small>offline</small></span>${dmBtn(n)}</div>`).join("");
    document.querySelectorAll(".card .pres").forEach(e => e.remove());
    document.querySelectorAll('.card[data-act="open"]').forEach(c => { const here = others.filter(u => u.open === c.dataset.id); if (!here.length) return; c.insertAdjacentHTML("beforeend", `<div class="pres" data-i18n>${here.map(u => `<span class="av live${u.typing ? " ty" : ""}">${esc(initials(u.name))}</span>`).join("")}<span>${here.map(u => esc(u.name)).join(", ")} · ${here.some(u => u.typing) ? W.edit : W.view}</span></div>`); });
    const bar = $("#pbar"); if (bar) { const here = others.filter(u => u.open === S.open); bar.innerHTML = here.length ? `<div class="pres big" data-i18n>${here.map(u => `<span class="av live${u.typing ? " ty" : ""}">${esc(initials(u.name))}</span>`).join("")}<span>${here.map(u => esc(u.name) + (u.typing ? " (" + W.edit + ")" : "")).join(", ")} ${here.length > 1 ? W.tooP : W.too}</span></div>` : ""; }
  }
  window.__deskPresencePreview = l => { S.online = l; paintPresence(); }; /* preview only: changes this browser, nothing is sent */
  function startPresence() {
    pres = sb.channel("desk-presence", { config: { presence: { key: S.me.name } } });
    pres.on("presence", { event: "sync" }, () => { const st = pres.presenceState(); S.online = Object.values(st).map(a => a[a.length - 1]).filter(Boolean); renderChat(); paintPresence(); })
      .subscribe(st => { S.presOn = st === "SUBSCRIBED"; if (S.presOn) { lastTrack = ""; onRender(); } });
    const setTyping = v => { if (typing === v) return; typing = v; onRender(); };
    document.addEventListener("focusin", e => { if (e.target.closest && e.target.closest(".drawer") && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) setTyping(true); });
    document.addEventListener("focusout", () => setTimeout(() => { const a = document.activeElement; if (!(a && a.closest && a.closest(".drawer") && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) setTyping(false); }, 200));
  }
  /* ---------- chat: comments with request_id "team" (everyone) or "dm:A|B" (two people) ---------- */
  const dmKey = n => "dm:" + [S.me.name, n].sort().join("|");
  const dmOther = k => k.slice(3).split("|").find(n => n !== S.me.name) || "";
  const isMyRoom = k => k === "team" || (typeof k === "string" && k.startsWith("dm:") && k.slice(3).split("|").includes(S.me.name));
  const roomMsgs = k => S.items.comments.filter(c => c.request_id === k).sort((a, b) => a.at.localeCompare(b.at));
  const peers = () => [...new Set(S.members.filter(m => m.can_login !== false && m.name !== S.me.name).map(m => m.name))];
  const readMap = () => { try { return JSON.parse(localStorage.getItem("voxdesk-chatread2") || "{}"); } catch (e) { return {}; } };
  const unreadIn = (k, rm) => roomMsgs(k).filter(m => m.author !== S.me.name && m.at > (rm[k] || "")).length;
  function renderChat() {
    const box = $("#chat"); if (!box || !S.me) return;
    S.room = S.room && isMyRoom(S.room) ? S.room : "team";
    const rm = readMap();
    if (S.chat) { rm[S.room] = now(); try { localStorage.setItem("voxdesk-chatread2", JSON.stringify(rm)); } catch (e) {} }
    const rooms = ["team", ...peers().map(dmKey)];
    S.items.comments.forEach(c => { if (isMyRoom(c.request_id) && !rooms.includes(c.request_id)) rooms.push(c.request_id); });
    const un = {}; let total = 0; rooms.forEach(k => { un[k] = S.chat && k === S.room ? 0 : unreadIn(k, rm); total += un[k]; });
    S.unreadDm = un;
    if (!$("#chatbtn")) box.innerHTML = `<button class="chatbtn" id="chatbtn" data-act="chat" aria-label="Chat"><i class="ti ti-messages"></i><b id="chatn"></b></button><div class="chatpanel" id="chatpanel"><div class="chath"><i class="ti ti-messages"></i><span>Chat</span><small id="chaton"></small><button class="btn ghost sm" data-act="chat" style="margin-left:auto"><i class="ti ti-x"></i></button></div><div class="rooms" id="rooms"></div><div class="chatlist" id="chatlist"></div><div class="chatin"><textarea class="txt" id="chatinput" rows="1"></textarea><button class="btn pri sm" data-act="chatsend">Send</button></div></div>`;
    $("#chatpanel").style.display = S.chat ? "flex" : "none";
    $("#chatn").textContent = total || ""; $("#chatn").style.display = total ? "" : "none";
    const on = (S.online || []).map(u => u.name);
    $("#rooms").innerHTML = rooms.map(k => { const n = k === "team" ? "" : dmOther(k); return `<button class="step${k === S.room ? " on" : ""}" data-act="room" data-r="${esc(k)}">${k === "team" ? '<i class="ti ti-users"></i><span>Team</span>' : `<span class="av${on.includes(n) ? " live" : ""}" style="width:18px;height:18px;font-size:9px">${esc(initials(n))}</span><span data-i18n>${esc(n)}</span>`}${un[k] ? `<b class="n" data-i18n>${un[k]}</b>` : ""}</button>`; }).join("");
    const other = S.room === "team" ? "" : dmOther(S.room);
    $("#chaton").textContent = S.room === "team" ? "" : (on.includes(other) ? "· online" : "· offline");
    $("#chaton").style.color = S.room !== "team" && !on.includes(other) ? "var(--cinza)" : "";
    const inp = $("#chatinput"); inp.placeholder = S.room === "team" ? "Write to the team" : "Private message";
    const list = $("#chatlist"), msgs = roomMsgs(S.room), atEnd = list.scrollHeight - list.scrollTop - list.clientHeight < 60, k0 = list.dataset.k;
    let day = "";
    list.innerHTML = msgs.map(m => { const d = fDay(+new Date(m.at), MYZ), head = d !== day ? `<div class="chatday">${esc(d)}</div>` : ""; day = d; const mine = m.author === S.me.name; return head + `<div class="msg${mine ? " mine" : ""}">${mine ? "" : `<span class="av">${esc(initials(m.author))}</span>`}<div><div class="mh">${mine ? "" : `<b>${esc(m.author)}</b>`}${esc(fTime(+new Date(m.at), MYZ, BR))}</div><div class="mb">${mentions(m.body)}</div></div></div>`; }).join("") || `<div class="empty">${S.room === "team" ? "No messages yet. Say hi to the team." : "No messages yet. Only you two see this chat."}</div>`;
    list.dataset.k = S.room + ":" + msgs.length;
    if (S.chat && (atEnd || k0 !== list.dataset.k)) list.scrollTop = list.scrollHeight;
    if (window.DESK_I18N) window.DESK_I18N.apply(box);
  }
  function toast(t) { const e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.appendChild(e); setTimeout(() => e.remove(), 2600); }

  function loginScreen(msg, sent) {
    $("#app").innerHTML = `<div class="login"><div class="modal"><img src="assets/vox-simbolo.svg" alt="Vox Digital"><h1>Vox Desk</h1>
      <p>Requests, deliveries and launch dates in one place.</p>
      ${sent ? `<p style="color:var(--branco)">Check your inbox. We sent a sign-in link to <b>${esc(sent)}</b>.</p>` : `<input class="inp" id="lemail" type="email" placeholder="name@company.com" autocomplete="email" style="text-align:center"><button class="btn pri" data-act="login" style="width:100%;justify-content:center;margin-top:10px">${LIVE ? "Email me a sign-in link" : "Enter"}</button>`}
      <div class="err">${esc(msg || "")}</div><button class="btn sm ghost" data-act="lang" style="margin-top:8px"><i class="ti ti-language"></i><span data-i18n>${window.DESK_I18N && window.DESK_I18N.get() === "pt" ? "Português · EN" : "English · PT"}</span></button><div class="note">${LIVE ? "No password. The link signs you in." : "Demo mode. Data stays in this browser only."}</div></div></div>`;
  }

  /* ---------- actions ---------- */
  function setStatus(r, s) {
    if (r.status === s) return;
    const was = STATUS.find(x => x.id === r.status); r.status = s; r.done_at = s === "done" ? now() : null;
    if (s !== "info") r.waiting_on = r.waiting_on || "";
    save("requests", r); log("set status to " + STATUS.find(x => x.id === s).label, r.id, r.client_id, was ? was.label : "", STATUS.find(x => x.id === s).label);
  }
  const A = {
    view(d) { S.view = d.v; S.client = null; renderMain(); },
    open(d) { S.open = d.id; renderOver(); },
    close() { S.open = null; renderOver(); },
    closemodal() { S.modal = null; renderOver(); },
    client(d) { S.client = d.id; renderMain(); },
    clients() { S.client = null; renderMain(); },
    cal(d) { if (d.d === "0") S.cal = null; else { let m = S.cal.m + +d.d, y = S.cal.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } S.cal = { y, m }; } renderMain(); },
    new(d) { const c = d.client && get("clients", d.client); S.modal = { type: "launch", client_id: d.client || "", title: "", event_date: "", event_time: "", event_tz: (c && c.tz) || "America/Chicago", due_date: "", link: "", details: "", newname: "", newbrand: "" }; renderOver(); },
    ntype(d) { S.modal.type = d.t; renderOver(); },
    create() {
      const d = S.modal; let cid = d.type === "global" ? "all" : d.client_id;
      if (d.type !== "global" && !cid) return ($("#nerr").textContent = "Choose a client first.");
      if (cid === "+") {
        if (!d.newname.trim()) return ($("#nerr").textContent = "Enter the new client name.");
        const c = { id: uid(), name: d.newname.trim(), brand: d.newbrand.trim(), am: S.me.team === "pineda" ? S.me.name : "", tz: d.event_tz, notes: "", links: [], deliverables: DELIVERABLES.map(l => ({ id: uid(), label: l, done: false, url: "" })) };
        S.items.clients.push(c); save("clients", c); cid = c.id; log("added the client", c.id, c.id);
      }
      if (d.type === "launch" && !d.event_date) return ($("#nerr").textContent = "Pick the webinar date.");
      if (d.type === "global" && !d.title.trim()) return ($("#nerr").textContent = "Describe the change.");
      const t = TYPES.find(x => x.id === d.type);
      const list = d.type === "global" ? S.items.clients.map(c => c.name + (c.brand ? " · " + c.brand : "")) : t.list;
      const r = { id: uid(), client_id: cid, type: d.type, title: d.title.trim() || (d.type === "launch" ? "Webinar " + fDue(d.event_date).replace(/^\w+, /, "") : t.label), status: "new", assignee: "", requester: S.me.name, waiting_on: "", due_date: d.due_date, event_date: d.type === "launch" ? d.event_date : "", event_time: d.type === "launch" ? d.event_time : "", event_tz: d.event_tz, details: d.details, links: d.link.trim() ? [{ id: uid(), label: "Link", url: d.link.trim() }] : [], checklist: list.map(l => ({ id: uid(), label: l, done: false, url: "" })), created_at: now() };
      S.items.requests.push(r); save("requests", r); log("created the request", r.id, cid);
      S.modal = null; S.view = "board"; S.open = r.id; render(); toast("Request sent");
    },
    newclient() { const c = { id: uid(), name: "New client", brand: "", am: "", tz: "America/Chicago", notes: "", links: [], deliverables: DELIVERABLES.map(l => ({ id: uid(), label: l, done: false, url: "" })) }; S.items.clients.push(c); save("clients", c); log("added the client", c.id, c.id); S.client = c.id; renderMain(); },
    delclient(d) { const c = get("clients", d.id); if (!confirm('Delete the client "' + c.name + '"? Requests stay in the history.')) return; S.items.clients = S.items.clients.filter(x => x.id !== d.id); store.remove("clients", d.id); log('deleted the client "' + c.name + '"', null, null); S.client = null; renderMain(); },
    delreq(d) { const r = get("requests", d.id); if (!confirm("Delete this request? This cannot be undone.")) return; S.items.requests = S.items.requests.filter(x => x.id !== d.id); store.remove("requests", d.id); log('deleted the request "' + (r.title || "") + '"', null, r.client_id); S.open = null; render(); },
    status(d) { setStatus(get("requests", d.id), d.s); render(); },
    tgl(d) { const o = get(d.k, d.id), it = o[d.fld].find(x => x.id === d.it); it.done = !it.done; it.by = it.done ? S.me.name : ""; it.at = it.done ? now() : ""; save(d.k, o); log((it.done ? "checked" : "unchecked") + ' "' + it.label + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id);
      if (d.k === "requests" && d.fld === "checklist" && o.checklist.length) { if (o.checklist.every(x => x.done)) { if (o.status !== "done") { setStatus(o, "done"); toast("All steps checked. Moved to Done."); } } else if (o.status === "done") setStatus(o, "doing"); }
      render(); },
    quick(d) { const r = get("requests", d.id); setStatus(r, r.status === "done" ? "doing" : "done"); render(); },
    lidel(d) { const o = get(d.k, d.id), it = o[d.fld].find(x => x.id === d.it); o[d.fld] = o[d.fld].filter(x => x.id !== d.it); save(d.k, o); if (it) log('removed "' + it.label + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, it.label + (it.url ? "\n" + it.url : ""), ""); render(); },
    liadd(d) {
      const inp = $(`[data-add="${d.k}|${d.id}|${d.fld}"]`), v = inp.value.trim(); if (!v) return inp.focus();
      const o = get(d.k, d.id); o[d.fld] = o[d.fld] || [];
      if (d.fld === "links") { let label = "Link"; try { label = new URL(v).hostname.replace(/^www\./, ""); } catch (e) {} o.links.push({ id: uid(), label, url: v }); }
      else o[d.fld].push({ id: uid(), label: v, done: false, url: "" });
      save(d.k, o); log((d.fld === "links" ? "added the link " : "added ") + '"' + v + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, "", v); render(); const n = $(`[data-add="${d.k}|${d.id}|${d.fld}"]`); if (n) n.focus();
    },
    asg(d) { const r = get("requests", d.id), was = asg(r), l = was.includes(d.n) ? was.filter(x => x !== d.n) : [...was, d.n]; r.assignees = l; r.assignee = l[0] || ""; save("requests", r); log(l.length ? "assigned to " + l.join(" and ") : "assigned to nobody", r.id, r.client_id, was.join(", "), l.join(", ")); render(); },
    chat() { S.chat = !S.chat; renderChat(); paintPresence(); if (S.chat) { const l = $("#chatlist"); l.scrollTop = l.scrollHeight; $("#chatinput").focus(); } },
    room(d) { S.room = d.r; S.chat = true; renderChat(); paintPresence(); const l = $("#chatlist"); l.scrollTop = l.scrollHeight; $("#chatinput").focus(); },
    dm(d) { A.room({ r: dmKey(d.n) }); },
    chatsend() { const b = $("#chatinput"), v = b.value.trim(); if (!v) return b.focus(); const c = { id: uid(), request_id: S.room || "team", author: S.me.name, body: v, at: now() }; S.items.comments.push(c); save("comments", c); b.value = ""; renderChat(); const l = $("#chatlist"); l.scrollTop = l.scrollHeight; b.focus(); },
    at(d) { const b = $("#cbox"); b.value += (b.value && !/\s$/.test(b.value) ? " " : "") + "@" + d.n + " "; b.focus(); },
    comment(d) {
      const b = $("#cbox"), v = b.value.trim(); if (!v) return b.focus();
      const r = get("requests", d.id), c = { id: uid(), request_id: r.id, author: S.me.name, body: v, at: now() };
      S.items.comments.push(c); save("comments", c); log("commented", r.id, r.client_id); renderOver();
    },
    async login() {
      const e = ($("#lemail").value || "").trim().toLowerCase(); if (!/.+@.+\..+/.test(e)) return loginScreen("Enter a valid email.");
      if (!LIVE) { const m = S.members.find(x => x.email.toLowerCase() === e) || { email: e, name: e.split("@")[0].replace(/^./, c => c.toUpperCase()), team: "pineda" }; localStorage.setItem("voxdesk-me", JSON.stringify(m)); S.me = m; return render(); }
      const { error } = await sb.auth.signInWithOtp({ email: e, options: { emailRedirectTo: location.origin + location.pathname } });
      loginScreen(error ? "Could not send the link. Try again in a minute." : "", error ? null : e);
    },
    async logout() { if (LIVE) await sb.auth.signOut(); localStorage.removeItem("voxdesk-me"); S.me = null; $("#app").innerHTML = ""; loginScreen(); },
  };

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    if ((el.dataset.act === "close" || el.dataset.act === "closemodal") && el.classList.contains("veil") && e.target !== el) return;
    if (e.target.closest("a")) return;
    A[el.dataset.act] && A[el.dataset.act](el.dataset, e);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (S.modal) A.closemodal(); else if (S.open) A.close(); else if (S.chat) A.chat(); }
    if (e.key === "Enter" && e.target.dataset.add) { const [k, id, fld] = e.target.dataset.add.split("|"); A.liadd({ k, id, fld }); }
    if (e.key === "Enter" && e.target.id === "lemail") A.login();
    if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatinput") { e.preventDefault(); A.chatsend(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target.id === "cbox" && S.open) A.comment({ id: S.open });
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.dataset.n && S.modal) { S.modal[t.dataset.n] = t.value; if (/^event_/.test(t.dataset.n) && $("#ntz")) $("#ntz").innerHTML = tzHTML(S.modal); if (t.dataset.n === "client_id") { const c = get("clients", t.value); if (c && c.tz) S.modal.event_tz = c.tz; renderOver(); } }
  });
  document.addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    if (d.ui) { S[d.ui] = t.value; return renderMain(); }
    if (d.f) {
      const o = get(d.k, d.id); if (!o || o[d.f] === t.value) return;
      const old = o[d.f]; o[d.f] = t.value; save(d.k, o);
      const names = { assignee: "assigned to " + (t.value || "nobody"), due_date: "set due date to " + (fDue(t.value) || "none"), event_date: "changed the webinar date", event_time: "changed the webinar time", event_tz: "changed the time zone to " + zAbbr(t.value), client_id: "moved to " + clientName(t.value), waiting_on: t.value ? "is waiting on " + t.value : "cleared waiting on" };
      const lab = { title: "title", details: "notes", notes: "notes", name: "spokesperson", brand: "brand", am: "account manager", tz: "time zone", slack: "Slack channel", type: "type", requester: "requested by" };
      const show = v => d.f === "client_id" ? clientName(v) : /tz$/.test(d.f) ? (v ? zAbbr(v) : "") : d.f === "type" ? (TYPES.find(x => x.id === v) || {}).label || v : /_date$/.test(d.f) ? fDue(v) : v;
      log(names[d.f] && d.k === "requests" ? names[d.f] : "edited the " + (lab[d.f] || d.f), d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, show(old), show(t.value));
      if (d.k === "requests" && d.f === "waiting_on" && t.value && o.status !== "info") setStatus(o, "info");
      if (/^event_/.test(d.f) && $("#tzbox")) $("#tzbox").innerHTML = tzHTML(o);
      renderMain(); if (d.f === "type" || d.f === "waiting_on") renderOver(); void old; return;
    }
    if (d.li) { const o = get(d.k, d.id), it = (o[d.fld] || []).find(x => x.id === d.it); if (it && it[d.li] !== t.value.trim()) { const was = it[d.li] || ""; it[d.li] = t.value.trim(); save(d.k, o); log("edited the " + (d.li === "url" ? "link" : "name") + ' of "' + it.label + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, was, it[d.li]); if (d.li === "url") render(); else renderMain(); } }
  });
  let drag = null;
  document.addEventListener("dragstart", e => { const c = e.target.closest && e.target.closest(".card[draggable]"); if (c) { drag = c.dataset.id; e.dataTransfer.effectAllowed = "move"; } });
  let dropRef = null;
  const clearMarks = () => document.querySelectorAll(".card.dropb,.card.dropa").forEach(x => x.classList.remove("dropb", "dropa"));
  document.addEventListener("dragover", e => {
    const c = e.target.closest && e.target.closest("[data-drop]"); if (!c || !drag) return;
    e.preventDefault(); c.classList.add("over"); clearMarks(); dropRef = null;
    const t = e.target.closest('.card[data-act="open"]');
    if (t && t.dataset.id !== drag) { const r = t.getBoundingClientRect(), before = e.clientY < r.top + r.height / 2; t.classList.add(before ? "dropb" : "dropa"); dropRef = { id: t.dataset.id, before }; }
  });
  document.addEventListener("dragleave", e => { const c = e.target.closest && e.target.closest("[data-drop]"); if (c && !c.contains(e.relatedTarget)) { c.classList.remove("over"); clearMarks(); } });
  document.addEventListener("dragend", () => { drag = null; dropRef = null; clearMarks(); document.querySelectorAll(".col.over").forEach(x => x.classList.remove("over")); });
  document.addEventListener("drop", e => {
    const c = e.target.closest && e.target.closest("[data-drop]"); if (!c || !drag) return;
    e.preventDefault(); const r = get("requests", drag), st = c.dataset.drop, sub = c.dataset.sub;
    if (r) {
      const sameCol = inCol(r, st, sub), oldPos = sameCol ? S.items.requests.filter(x => inCol(x, st, sub)).sort(byRank).findIndex(x => x.id === r.id) + 1 : 0;
      if (sub && (sub === "client") !== (r.type === "client")) { const was = typeOf(r).label; r.type = sub === "client" ? "client" : "update"; save("requests", r); log("edited the type", r.id, r.client_id, was, typeOf(r).label); }
      setStatus(r, st);
      if (st !== "done") {
        const ids = S.items.requests.filter(x => inCol(x, st, sub) && x.id !== r.id).sort(byRank).map(x => x.id);
        let i = dropRef ? ids.indexOf(dropRef.id) : -1; i = i < 0 ? ids.length : i + (dropRef.before ? 0 : 1);
        ids.splice(i, 0, r.id);
        ids.forEach((id, k) => { const o = get("requests", id), rk = (k + 1) * 10; if (o && o.rank !== rk) { o.rank = rk; save("requests", o); } });
        if (sameCol && oldPos !== i + 1) log("changed the priority", r.id, r.client_id, "#" + oldPos, "#" + (i + 1));
      }
    }
    drag = null; dropRef = null; render();
  });

  /* ---------- boot ---------- */
  async function boot() {
    try {
      if (LIVE) {
        sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
        const { data } = await sb.auth.getSession();
        if (!data.session) return loginScreen();
        const d = await remote.load(); S.items = d.items; S.members = d.members;
        const email = (data.session.user.email || "").toLowerCase();
        S.me = S.members.find(m => m.email.toLowerCase() === email && m.can_login !== false);
        if (!S.me) { await sb.auth.signOut(); return loginScreen("This email has no access yet. Ask Jeferson to add you."); }
        if (location.hash.includes("access_token")) history.replaceState(null, "", location.pathname);
        const reload = async () => { try { const n = await remote.load(); S.items = n.items; S.members = n.members; S.dirty = true; flush(); } catch (e) {} };
        const typingIn = sel => { const a = document.activeElement; return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest(sel)); };
        const flush = () => { if (!S.dirty) return; if (typingIn("#main") || typingIn(".drawer,.modal")) return; S.dirty = false; if (S.open && !get("requests", S.open)) S.open = null; renderMain(); renderOver(); };
        document.addEventListener("focusout", () => setTimeout(flush, 150));
        const setLive = on => { S.live = on; const e = $("#live"); if (e) { e.querySelector(".dot").style.background = on ? "var(--verde)" : "var(--cinza)"; e.lastElementChild.textContent = on ? "Live" : "Connecting"; e.lastElementChild.removeAttribute("data-i18n"); if (I18) I18.apply(e); } };
        sb.channel("desk-items").on("postgres_changes", { event: "*", schema: "public", table: "desk_items" }, p => {
          if (p.eventType === "DELETE") { const id = p.old && p.old.id; if (!id) return reload(); KINDS.forEach(k => { S.items[k] = S.items[k].filter(x => x.id !== id); }); }
          else {
            const row = p.new; if (!row || !S.items[row.kind]) return; if (row.updated_by === S.me.email) return;
            const o = Object.assign({}, row.data, { id: row.id }), l = S.items[row.kind], i = l.findIndex(x => x.id === o.id);
            if (i < 0) l.push(o); else l[i] = o;
            const who = (S.members.find(m => m.email === row.updated_by) || {}).name || (row.updated_by === "slack-sync" ? "Slack" : "");
            if (row.kind === "requests" && who) toast(i < 0 ? who + ": new request · " + (o.title || "") : who + " updated · " + (o.title || ""));
            if (row.kind === "comments" && who) { if (o.request_id === "team" || String(o.request_id).startsWith("dm:")) { if (isMyRoom(o.request_id)) { if (!S.chat || S.room !== o.request_id) toast((o.request_id === "team" ? "" : "\u2709 ") + o.author + ": " + (o.body.length > 70 ? o.body.slice(0, 70) + "…" : o.body)); renderChat(); paintPresence(); } } else { const r = get("requests", o.request_id); toast(o.author + " commented" + (r ? " · " + (r.title || "") : "")); } }
          }
          S.dirty = true; flush();
        }).subscribe(st => { setLive(st === "SUBSCRIBED"); if (st === "SUBSCRIBED") reload(); });
        window.addEventListener("focus", reload);
        startPresence();
        setInterval(() => { if (!S.live) reload(); }, 60000);
      } else {
        const d = await local.load(); S.items = d.items; S.members = d.members;
        S.me = { name: "Slack", email: "" }; mergeImport(); S.me = null;
        try { S.me = JSON.parse(localStorage.getItem("voxdesk-me")); } catch (e) {}
        if (!S.me) return loginScreen();
      }
      render();
    } catch (err) { console.error(err); if (LIVE && sb) { try { await sb.auth.signOut(); } catch (e) {} } loginScreen(LIVE ? "This email has no access yet. Ask Jeferson to add you." : "Could not load. Reload the page."); }
  }
  const I18 = window.DESK_I18N;
  if (I18) {
    const wrap = f => function () { const r = f.apply(this, arguments); I18.apply(document.body); return r; };
    renderMain = wrap(renderMain); renderOver = wrap(renderOver); render = wrap(render); loginScreen = wrap(loginScreen);
    document.addEventListener("input", () => setTimeout(() => I18.apply(document.body), 0));
    A.lang = () => { I18.set(I18.get() === "pt" ? "en" : "pt"); $("#app").innerHTML = ""; if (S.me) render(); else loginScreen(); };
  }
  boot();
})();
