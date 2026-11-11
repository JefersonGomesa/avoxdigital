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
  /* ---------- undo: every change made in this browser session can be reverted, newest first ---------- */
  const U = { stack: [], cur: null, shadow: new Map(), busy: false };
  const snapAll = () => { U.shadow.clear(); KINDS.forEach(k => S.items[k].forEach(o => U.shadow.set(k + ":" + o.id, JSON.stringify(o)))); };
  function track(key, fn) {
    if (U.busy) return;
    if (!U.cur) { const g = U.cur = { items: [], label: "", ref: null, client: null }; setTimeout(() => { if (g.items.length) { U.stack.push(g); if (U.stack.length > 60) U.stack.shift(); } if (U.cur === g) U.cur = null; paintUndo(); }, 0); }
    if (!U.cur.items.some(x => x.key === key)) U.cur.items.push({ key, fn });
  }
  function trackItem(kind, id) {
    if (kind === "activity") return;
    const key = kind + ":" + id, prev = U.shadow.has(key) ? U.shadow.get(key) : null;
    track(key, () => {
      if (prev == null) { S.items[kind] = S.items[kind].filter(x => x.id !== id); U.shadow.delete(key); store.remove(kind, id); }
      else { const o = JSON.parse(prev), l = S.items[kind], i = l.findIndex(x => x.id === id); if (i < 0) l.push(o); else l[i] = o; U.shadow.set(key, prev); store.save(kind, o); }
    });
  }
  const save = (kind, o) => { trackItem(kind, o.id); if (kind !== "activity") U.shadow.set(kind + ":" + o.id, JSON.stringify(o)); return store.save(kind, o); };
  const removeItem = (kind, id) => { trackItem(kind, id); U.shadow.delete(kind + ":" + id); return store.remove(kind, id); };
  function paintUndo() {
    let b = $("#undo"); if (!S.me) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("button"); b.id = "undo"; b.className = "undo"; b.dataset.act = "undo"; document.body.appendChild(b); }
    const g = U.stack[U.stack.length - 1], pt = window.DESK_I18N && window.DESK_I18N.get() === "pt";
    clearTimeout(U.hide);
    if (!g) { b.style.display = "none"; return; }
    b.style.display = "flex"; b.title = (pt ? "Desfazer: " : "Undo: ") + (g.label || (pt ? "última alteração" : "last change")) + " (Cmd/Ctrl + Z)";
    b.setAttribute("aria-label", pt ? "Desfazer" : "Undo");
    b.innerHTML = '<i class="ti ti-arrow-back-up"></i>';
    U.hide = setTimeout(() => { b.style.display = "none"; }, 6000);
  }
  function undoLast() {
    const g = U.stack.pop(); if (!g) return;
    U.busy = true; try { g.items.slice().reverse().forEach(e => e.fn()); } finally { U.busy = false; }
    if (!g.priv) log("undid: " + (g.label || "last change"), g.ref && get("requests", g.ref) ? g.ref : null, g.client);
    if (S.open && !get("requests", S.open)) S.open = null;
    if (S.client && !get("clients", S.client)) S.client = null;
    render(); paintUndo(); toast((window.DESK_I18N && window.DESK_I18N.get() === "pt" ? "Desfeito: " : "Undone: ") + (g.label || ""));
  }
  const get = (kind, id) => S.items[kind].find(x => x.id === id);
  const clientName = id => { const c = get("clients", id); return c ? c.name : id === "all" ? "All clients" : "No client"; };
  const first = n => String(n || "").split(" ")[0];
  const initials = n => String(n || "?").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

  function log(text, ref, client_id, from, to) {
    const a = { id: uid(), ref, client_id: client_id || null, actor: S.me.name, text, at: now() };
    if (from !== undefined || to !== undefined) { a.from = String(from == null ? "" : from); a.to = String(to == null ? "" : to); }
    S.items.activity.push(a); save("activity", a);
    if (U.cur && !U.busy && !U.cur.label) { U.cur.label = text; U.cur.ref = ref || null; U.cur.client = client_id || null; }
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
      const o = { id, key: c.key, name: c.name, brand: c.brand, am: c.am, tz: c.tz, slack: c.slack, notes: c.notes, src: "slack", links: (c.links || []).map((x, i) => lk(x, id, i)), deliverables: c.deliverables.map((x, i) => li(x, id, i)), requirements: REQS.map((l, i) => ({ id: hid(id + 'rq' + i), label: l, done: i % 3 === 0, url: '', by: i % 3 === 0 ? 'Pineda' : '', at: '' })) };
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
  /* What Pineda must send before a launch. Stored per client in `requirements` (done = received). */
  const REQS = ["GHL access (sub-account)", "Copy · Webinar landing page", "Copy · Book a Call (VSL) page", "Copy · Homework page", "Brand assets or client website (logo, colours, photos)", "Booking calendar for Book a Call", "Copy · Reminder automation (SMS and email)", "Zoom registration link", "Webinar or masterclass date and time (with time zone)", "Extra questions for the application form", "Domain or subdomain connected to the CRM", "Founder voice memo for the reminder voicemail"];
  const newReqs = () => REQS.map(l => ({ id: uid(), label: l, done: false, url: "", by: "", at: "" }));
  const missing = c => c && Array.isArray(c.requirements) ? c.requirements.filter(x => !x.done) : [];
  const building = () => { const ids = new Set(S.items.requests.filter(r => r.type === "client" && r.status !== "done").map(r => r.client_id)); return S.items.clients.filter(c => ids.has(c.id) && missing(c).length).sort((a, b) => a.name.localeCompare(b.name)); };
  const START = ["GHL access (sub-account)", "Copy · Webinar landing page", "Copy · Book a Call (VSL) page", "Brand assets or client website (logo, colours, photos)"];
  function startBox(c) {
    if (!c || !Array.isArray(c.requirements)) return "";
    const m = missing(c), block = m.filter(x => START.includes(x.label)), rest = m.filter(x => !START.includes(x.label));
    return `<div class="stb ${block.length ? "no" : "yes"}"><div class="sth"><i class="ti ti-${block.length ? "lock" : "player-play"}"></i><b>${block.length ? "Cannot start yet" : "Ready to start"}</b></div>
      ${block.length ? `<span class="lab">Needed to start</span><ul>${block.map(x => `<li class="cl">${esc(x.label)}</li>`).join("")}</ul>` : ""}
      ${rest.length ? `<span class="lab">Needed before launch</span><ul class="soft">${rest.map(x => `<li class="cl">${esc(x.label)}</li>`).join("")}</ul>` : ""}</div>`;
  }
  const missPill = c => { const m = missing(c); return m.length ? `<span class="pill r" title="${esc(m.map(x => x.label).join("\n"))}"><i class="ti ti-alert-triangle"></i><span>Missing from Pineda</span><b data-i18n>${m.length}</b></span>` : ""; };
  /* News for a client: the open cards that got something from Slack and nobody marked as seen yet. */
  const newsOf = c => S.items.requests.filter(r => r.client_id === c.id && r.status !== "done" && r.news).sort((a, b) => String(b.news.at).localeCompare(String(a.news.at)));
  function missBanner() {
    const hot = S.items.clients.filter(c => S.items.requests.some(r => r.client_id === c.id && r.type === "client" && r.status !== "done") && newsOf(c).length);
    const l = [...new Set([...building(), ...hot])].sort((a, b) => (newsOf(b).length ? 1 : 0) - (newsOf(a).length ? 1 : 0) || a.name.localeCompare(b.name)); if (!l.length) return "";
    const mine = S.me.team === "pineda", tot = l.reduce((a, c) => a + missing(c).length, 0);
    return `<div class="missb"><div class="mbh"><i class="ti ti-alert-triangle"></i><b>${mine ? "Waiting on you to launch" : "Waiting on Pineda to launch"}</b><span class="pill r" data-i18n>${tot}</span><button class="btn sm ghost" data-act="mbtog" style="margin-left:auto"><i class="ti ti-chevron-${S.mbOpen ? "up" : "down"}"></i><span>${S.mbOpen ? "Hide" : "Show items"}</span></button></div>
      <div class="mbc">${l.map(c => { const nw = newsOf(c), m = missing(c); return `<button class="mbi${nw.length ? " y" : ""}" data-act="${nw.length ? "open" : "client"}" data-id="${nw.length ? nw[0].id : c.id}" data-go="1" title="${esc(nw.length ? nw[0].news.text || "" : m.map(x => x.label).join("\n"))}">${nw.length ? `<span class="stc y" style="margin:0 6px 0 0"><i></i></span>` : ""}<b class="cl">${esc(c.name)}</b><small class="sub">${esc(c.brand || "")}</small>${m.length ? `<span class="pill ${nw.length ? "a" : "r"}" data-i18n>${m.length}</span>` : `<span class="pill g"><i class="ti ti-check"></i><span>All received</span></span>`}${nw.length ? `<div class="mbn cl"><i class="ti ti-bell-ringing"></i> ${esc((nw[0].news.text || "").slice(0, 90))} · <span data-i18n>${esc(fStamp(nw[0].news.at))}</span></div>` : ""}${S.mbOpen && m.length ? `<ul>${m.map(x => `<li class="cl">${esc(x.label)}</li>`).join("")}</ul>` : ""}</button>`; }).join("")}</div></div>`;
  }
  /* ---------- validator (level 1): the desk-validate function opens the pages and checks them ---------- */
  const VB = new Set();
  const valBtn = (k, id, text) => `<button class="vbtn${text ? " wide" : ""}${VB.has(id) ? " busy" : ""}" data-act="validate" data-k="${k}" data-id="${id}" title="Validate: open the pages and check date, form, links and leftovers" aria-label="Validate"><i class="ti ti-${VB.has(id) ? "loader-2" : "shield-check"}"></i>${text ? `<span>${VB.has(id) ? "Checking…" : "Validate"}</span>` : ""}</button>`;
  const valPill = o => { const v = o && o.validation; return !v ? "" : v.verdict === "approved" ? `<span class="pill g" title="Validated by ${esc(v.by)} · ${esc(fStamp(v.at))}"><i class="ti ti-shield-check"></i><span>Approved</span>${v.warns ? `<b data-i18n>${v.warns}!</b>` : ""}</span>` : `<span class="pill r" title="Validated by ${esc(v.by)} · ${esc(fStamp(v.at))}"><i class="ti ti-shield-x"></i><span>Not approved</span><b data-i18n>${v.fails}</b></span>`; };
  function valReport(o, open) {
    const v = o && o.validation; if (!v) return "";
    const by = {}; v.checks.forEach(c => (by[c.page] = by[c.page] || []).push(c));
    const ic = { ok: ["circle-check", "var(--verde)"], warn: ["alert-triangle", "var(--ambar)"], fail: ["circle-x", "var(--vermelho)"], miss: ["circle-x", "var(--vermelho)"] }, pm = v.checks.filter(c => c.level === "miss").length;
    return `<details class="panel vrep ${v.verdict}" ${open || v.verdict !== "approved" ? "open" : ""}><summary><i class="ti ti-shield-${v.verdict === "approved" ? "check" : "x"}"></i><b>${v.verdict === "approved" ? "Validation: approved" : "Validation: not approved"}</b><span class="pill ${v.fails ? "r" : "g"}" data-i18n>${v.fails} ✕</span><span class="pill ${v.warns - pm ? "a" : ""}" data-i18n>${v.warns - pm} !</span>${pm ? `<span class="pill r"><span>Missing from Pineda</span><b data-i18n>${pm}</b></span>` : ""}<small data-i18n>${esc(v.by)} · ${esc(fStamp(v.at))}</small><i class="ti ti-chevron-down" style="margin-left:auto"></i></summary>
      ${Object.keys(by).map(pg => `<div class="vpg"><div class="vph cl">${esc(pg)}</div>${by[pg].map(c => `<div class="vck ${c.level}"><i class="ti ti-${(ic[c.level] || ic.warn)[0]}" style="color:${(ic[c.level] || ic.warn)[1]}"></i><span><b>${esc(c.name)}</b><small class="cl">${mentions(c.detail || "")}</small></span></div>`).join("")}</div>`).join("")}</details>`;
  }
  /* What Pineda sent and what is missing, inside the request card. Missing items first, in red. */
  function pinedaBox(c) {
    if (!c || !Array.isArray(c.requirements) || !c.requirements.length) return "";
    const m = missing(c), n = c.requirements.length;
    return `<div class="sec panel reqp pbx${m.length ? " bad" : ""}"><h3><i class="ti ti-${m.length ? "alert-triangle" : "circle-check"}"></i><span>Needed from Pineda to launch</span><span class="pill ${m.length ? "r" : "g"}" data-i18n style="margin-left:auto;letter-spacing:0;text-transform:none">${n - m.length} / ${n}</span></h3>
      ${[...m, ...c.requirements.filter(x => x.done)].map(x => `<div class="vck ${x.done ? "ok" : "miss"}"><i class="ti ti-${x.done ? "circle-check" : "circle-x"}" style="color:var(--${x.done ? "verde" : "vermelho"})"></i><span><b class="cl">${esc(x.label)}</b>${x.done ? "" : `<small>Not received yet</small>`}</span>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" title="${esc(x.url)}"><i class="ti ti-external-link"></i></a>` : ""}</div>`).join("")}</div>`;
  }
  /* ---------- GHL link + help ---------- */
  const ghlBtn = (c, always) => c && c.ghl ? `<a class="btn sm ghl" href="${esc(c.ghl)}" target="_blank" rel="noopener" title="Open the client's GoHighLevel account"><i class="ti ti-external-link"></i><span data-i18n>GHL</span></a>` : c && always ? `<span class="pill" title="Paste the GHL account link in Details">No GHL link</span>` : "";
  const HELPKEY = { board: ["board", "card"], clients: ["clients"], list: ["list"], dash: ["dash"], notes: ["notes"], calendar: ["calendar"], history: ["history"] };
  function helpHTML() {
    const H = window.DESK_HELP; if (!H || !S.help) return "";
    const L = H[window.DESK_I18N && window.DESK_I18N.get() === "pt" ? "pt" : "en"], keys = S.help === "all" ? H.order : (HELPKEY[S.help] || ["start"]);
    return `<div class="veil mid" data-act="helpclose"><div class="modal helpm" data-stop data-i18n><div class="dh"><i class="ti ti-info-circle" style="font-size:22px;color:var(--laranja)"></i><span class="ttl">${esc(S.help === "all" ? L.title : L.open)}</span><span class="sp"></span><button class="btn ghost sm" data-act="helpclose"><i class="ti ti-x"></i></button></div>
      ${keys.map(k => `<div class="hsec"><h4>${esc(L[k][0])}</h4><ul>${L[k][1].map(x => `<li>${x}</li>`).join("")}</ul></div>`).join("")}
      ${S.help === "all" ? "" : `<button class="btn sm" data-act="help" data-h="all" style="margin-top:6px"><i class="ti ti-book"></i>${esc(L.all)}</button>`}</div></div>`;
  }
  function confirmHTML() {
    const q = S.confirm; if (!q) return "";
    const o = get(q.k, q.id); if (!o) return "";
    const pt = window.DESK_I18N && window.DESK_I18N.get() === "pt", isC = q.k === "clients";
    const name = isC ? o.name + (o.brand ? " · " + o.brand : "") : clientName(o.client_id) + " · " + (o.title || typeOf(o).label);
    return `<div class="veil mid" data-act="delcancel" style="z-index:40"><div class="modal delm" data-stop data-i18n><div class="dh"><i class="ti ti-alert-triangle" style="font-size:22px;color:var(--vermelho)"></i><span class="ttl">${pt ? (isC ? "Apagar este cliente?" : "Apagar este pedido?") : (isC ? "Delete this client?" : "Delete this request?")}</span></div>
      <p class="delname">${esc(name)}</p>
      <p class="note" style="margin:0 0 12px">${pt ? (isC ? "O cliente sai do painel. Os pedidos dele continuam no histórico." : "O pedido sai do quadro, do checklist e do calendário. O histórico continua.") : (isC ? "The client leaves the board. Its requests stay in the history." : "The request leaves the board, the checklist and the calendar. The history stays.")}</p>
      <span class="lab">${pt ? "Para confirmar, escreva DELETE" : "To confirm, type DELETE"}</span>
      <input class="inp" id="delword" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE">
      <div class="err" id="delerr"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px"><button class="btn" data-act="delcancel">${pt ? "Cancelar" : "Cancel"}</button><button class="btn delb" id="delbtn" data-act="delgo"><i class="ti ti-trash"></i>${pt ? "Apagar" : "Delete"}</button></div></div></div>`;
  }
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
      `<div class="add"><input class="inp" placeholder="${esc(ph)}" data-add="${kind}|${id}|${field}"><button class="btn sm" data-act="liadd" data-k="${kind}" data-id="${id}" data-fld="${field}"><i class="ti ti-plus"></i>Add</button>${l.length ? `<button class="btn sm${l.every(x => x.done) ? "" : " pri"}" data-act="allchk" data-k="${kind}" data-id="${id}" data-fld="${field}"><i class="ti ti-${l.every(x => x.done) ? "square" : "checks"}"></i><span>${l.every(x => x.done) ? "Uncheck all" : "Check all"}</span></button>` : ""}</div>`;
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
  /* When the request was made: the latest Slack message for this card, or the creation time. */
  const reqAt = r => r.requested_at || r.created_at || "";
  const reqLine = r => reqAt(r) ? `<div class="mv rq" title="Date and time of the latest request, in your local time"><i class="ti ti-clock"></i><span>Requested</span><small>${esc(fStamp(reqAt(r)))}</small></div>` : "";
  /* Column order: a new request (no manual priority yet) goes first, newest first. Cards moved by hand keep their order below. */
  const byRank = (a, b) => ((a.rank == null ? -1 : a.rank) - (b.rank == null ? -1 : b.rank)) || reqAt(b).localeCompare(reqAt(a));
  const inCol = (r, st, sub) => r.status === st && (!sub || (sub === "client") === (r.type === "client"));
  /* One colour for each card. Yellow = something arrived from Slack and nobody marked it as seen yet. */
  function stateOf(r) {
    if (r.status === "done") return ["g", "Done"];
    if (r.news) return ["y", "New from Slack"];
    if (r.status === "tested") return ["g", "Updated & tested"];
    if (r.type === "client" && missing(get("clients", r.client_id)).length) return ["r", "Missing material"];
    if (r.status === "info" || r.waiting_on) return ["b", "On hold"];
    if (r.status === "doing") return ["o", "In progress"];
    return ["w", "Not started"];
  }
  const stChip = r => { const s = stateOf(r); return `<span class="stc ${s[0]}"><i></i><span>${s[1]}</span></span>`; };
  const newsHTML = (r, full) => r.news ? `<div class="nw${full ? " sec" : ""}"><i class="ti ti-bell-ringing"></i><span><b>${esc(r.news.by || "Slack")}</b><small data-i18n>${esc(fStamp(r.news.at))}</small><span class="cl">${esc(full || (r.news.text || "").length <= 120 ? r.news.text || "" : r.news.text.slice(0, 120) + "…")}</span></span>${full ? `<button class="btn sm" data-act="seen" data-id="${r.id}"><i class="ti ti-check"></i><span>Mark as seen</span></button>` : ""}</div>` : "";
  function cardHTML(r, pos) {
    const mv = movers(r);
    const p = prog(r.checklist), t = typeOf(r), late = r.due_date && r.due_date < today() && r.status !== "done" && r.status !== "tested";
    return `<div class="card st-${stateOf(r)[0]}" draggable="true" data-act="open" data-id="${r.id}">
      ${stChip(r)}
      <div style="display:flex;gap:8px;align-items:flex-start">${typeof pos === "number" && r.status !== "done" ? `<span class="rk" title="Priority ${pos + 1}">${pos + 1}</span>` : ""}<div style="flex:1;min-width:0"><div class="cl">${esc(clientName(r.client_id))}</div><div class="sub">${esc(r.title || t.label)}</div></div>${valBtn("requests", r.id)}<button class="chk${r.status === "done" ? " on" : ""}" data-act="quick" data-id="${r.id}" title="${r.status === "done" ? "Reopen" : "Mark as done"}" aria-label="Mark as done">${r.status === "done" ? '<i class="ti ti-check"></i>' : ""}</button></div>
      ${newsHTML(r)}
      ${whenHTML(r)}
      ${r.source_text ? `<div class="q"><i class="ti ti-brand-slack"></i><span><b>${esc(r.requester || "Slack")}:</b> ${esc(r.source_text.length > 150 ? r.source_text.slice(0, 150) + "…" : r.source_text)}</span></div>` : ""}
      ${reqLine(r)}
      ${r.type === "client" && r.status === "new" ? startBox(get("clients", r.client_id)) : ""}
      ${p.n ? `<div class="bar"><b style="width:${p.pct}%"></b></div>` : ""}
      <div class="meta"><span class="pill o"><i class="ti ${t.icon}"></i>${esc(t.label)}</span>
      ${r.status === "info" && r.waiting_on ? `<span class="pill a">Waiting on ${esc(r.waiting_on)}</span>` : ""}
      ${r.status === "tested" ? `<span class="pill g"><i class="ti ti-rocket"></i>Cleared to launch</span>` : ""}
      ${r.type === "client" && r.status !== "done" ? missPill(get("clients", r.client_id)) : ""}
      ${valPill(r)}
      ${r.due_date ? `<span class="pill${late ? " r" : ""}">Due ${esc(fDue(r.due_date))}</span>` : ""}
      ${p.n ? `<span>${p.d}/${p.n}</span>` : ""}
      ${r.slack_url ? `<a class="pill" href="${esc(r.slack_url)}" target="_blank" rel="noopener" style="text-decoration:none" title="Open the message in Slack"><i class="ti ti-brand-slack"></i>Slack</a>` : r.src === "slack" ? `<i class="ti ti-brand-slack" title="From Slack"></i>` : ""}
      <span style="margin-left:auto;display:inline-flex;gap:3px">${asg(r).map(n => `<span class="av" title="Assigned to ${esc(n)}">${esc(initials(n))}</span>`).join("")}</span></div>
      ${mv.length ? `<div class="mv"><i class="ti ti-arrows-exchange"></i><span>Moved by</span>${mv.map(m => `<span class="av m" title="${esc(m.actor)} · ${esc(m.text.replace("set status to", "→"))} · ${esc(fStamp(m.at))}">${esc(initials(m.actor))}</span>`).join("")}<small>${esc(fStamp(mv[mv.length - 1].at))}</small></div>` : ""}</div>`;
  }

  /* ---------- views ---------- */
  function vBoard() {
    const rs = S.items.requests.filter(r => (!S.filter || r.client_id === S.filter) && (!S.who || asg(r).includes(S.who) || !asg(r).length));
    const team = [...new Set(S.members.filter(m => m.team === "clicklab").map(m => m.name))];
    const cut = Date.now() - 7 * 864e5;
    return `<div class="top"><h1>Requests</h1>
      <select class="sel" style="width:150px" data-ui="who">${opt("", "Everyone", S.who || "")}${team.map(n => opt(n, n, S.who)).join("")}</select>
      <select class="sel" style="width:220px" data-ui="filter">${opt("", "All clients", S.filter)}${clientOpts(S.filter)}</select>
      <button class="btn pri" data-act="new"><i class="ti ti-plus"></i>Add request</button></div>
      ${missBanner()}
      <div class="board">${[{ id: "new", sub: "client", label: "New clients", color: "#FF6D29", empty: "No new client to build" }, { id: "new", sub: "update", label: "Updates", color: "#8AB8FF", empty: "No new update" }, ...STATUS.slice(1)].map(s => {
        let l = rs.filter(r => r.status === s.id && (!s.sub || (s.sub === "client") === (r.type === "client")));
        if (s.id === "done") l = l.filter(r => r.type === "client" || !r.done_at || +new Date(r.done_at) > cut);
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
          <div class="meta"><span>${p.d} of ${p.n} delivered</span>${ghlBtn(c)}${missPill(c)}${valPill(c)}${open ? `<span class="pill o">${open} open</span>` : ""}${c.am ? `<span class="av" style="margin-left:auto" title="${esc(c.am)}">${esc(initials(c.am))}</span>` : ""}</div></div>`;
      }).join("")}</div>`;
  }
  function vClient(c) {
    const rs = S.items.requests.filter(r => r.client_id === c.id).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    const p = prog(c.deliverables);
    const F = (f, ph, cls) => `<input class="${cls || "inp"}" value="${esc(c[f] || "")}" placeholder="${ph}" data-f="${f}" data-k="clients" data-id="${c.id}">`;
    return `<div class="top"><button class="btn ghost" data-act="clients"><i class="ti ti-arrow-left"></i>Clients</button><h1>${esc(c.name)}</h1>
      ${ghlBtn(c, true)}${valPill(c)}${valBtn("clients", c.id, true)}<button class="btn" data-act="new" data-client="${c.id}"><i class="ti ti-plus"></i>New request</button><button class="btn ghost" data-act="delclient" data-id="${c.id}"><i class="ti ti-trash"></i></button></div>
      ${c.validation ? `<div style="margin-bottom:16px">${valReport(c)}</div>` : ""}
      <div class="two"><div>
        <div class="panel reqp${missing(c).length ? " bad" : ""}" style="margin-bottom:16px"><h3><i class="ti ti-${missing(c).length ? "alert-triangle" : "circle-check"}"></i><span>Needed from Pineda to launch</span><span class="pill ${missing(c).length ? "r" : "g"}" data-i18n style="margin-left:auto;letter-spacing:0;text-transform:none">${(c.requirements || []).filter(x => x.done).length} / ${(c.requirements || []).length}</span></h3>
          <div class="note" style="margin:0 0 8px">Check an item when Pineda sends it. Paste the link beside it.</div>
          ${Array.isArray(c.requirements) ? listHTML("clients", c.id, "requirements", "Add something Pineda must send") : `<button class="btn sm" data-act="reqinit" data-id="${c.id}"><i class="ti ti-plus"></i><span>Create the list</span></button>`}</div>
        <div class="panel"><h3><i class="ti ti-checklist"></i>Deliveries · ${p.d} of ${p.n}</h3>${listHTML("clients", c.id, "deliverables", "Add a delivery (page, automation, funnel)")}</div>
        <div class="panel" style="margin-top:16px"><h3><i class="ti ti-inbox"></i>Requests</h3>
        ${rs.map(r => `<div class="hist go" data-act="open" data-id="${r.id}"><time>${esc(fDue(r.due_date) || "No due date")}</time><span><b>${esc(r.title || typeOf(r).label)}</b> · ${esc(STATUS.find(s => s.id === r.status).label)}</span></div>`).join("") || `<div class="empty">No requests yet</div>`}</div>
      </div><div>
        <div class="panel"><h3><i class="ti ti-id"></i>Details</h3><div class="fg">
          <div><span class="lab">Spokesperson</span>${F("name", "Name")}</div><div><span class="lab">Brand</span>${F("brand", "Brand or program")}</div>
          <div><span class="lab">Account manager</span><select class="sel" data-f="am" data-k="clients" data-id="${c.id}">${memberOpts(c.am)}</select></div>
          <div><span class="lab">Usual time zone</span><select class="sel" data-f="tz" data-k="clients" data-id="${c.id}">${zoneOpts(c.tz, true)}</select></div>
          <div class="w"><span class="lab">GHL account link</span>${F("ghl", "https://app.gohighlevel.com/v2/location/...")}</div>
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

  /* ---------- dashboard ---------- */
  const DCOL = { delivered: "#E8632A", upd: "#4F8FE8", neu: "#2FA883" };
  const durTxt = ms => ms == null ? "—" : ms < 36e5 ? Math.max(1, Math.round(ms / 6e4)) + " min" : ms < 864e5 ? Math.round(ms / 36e5) + " h" : (ms / 864e5 < 10 ? (ms / 864e5).toFixed(1) : Math.round(ms / 864e5)) + " d";
  const grpOf = r => r.status === "done" ? "done" : (r.status === "doing" || r.status === "tested") ? "prod" : "wait";
  const GRP = { done: ["Done", "g"], prod: ["In production", "o"], wait: ["Waiting", "a"] };
  const waitMs = r => r.created_at ? (r.status === "done" ? (r.done_at ? +new Date(r.done_at) - +new Date(r.created_at) : null) : Date.now() - +new Date(r.created_at)) : null;
  const fDate = iso => iso ? new Date(iso).toLocaleDateString("en-US", { timeZone: MYZ, month: "short", day: "numeric" }) + " · " + fTime(+new Date(iso), MYZ, BR) : "—";
  const weekStart = () => { const t = today().split("-"), d = new Date(Date.UTC(+t[0], +t[1] - 1, +t[2])); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
  const DCOLS = [
    ["client", "Client", r => clientName(r.client_id), r => `<b>${esc(clientName(r.client_id))}</b>`],
    ["title", "Request", r => r.title || "", r => esc(r.title || typeOf(r).label)],
    ["type", "Type", r => r.type === "client" ? "0" : "1", r => `<span class="pill o">${esc(r.type === "client" ? "New client" : typeOf(r).label)}</span>`],
    ["status", "Status", r => STATUS.findIndex(x => x.id === r.status), r => `<span class="pill ${GRP[grpOf(r)][1]}">${esc(STATUS.find(x => x.id === r.status).label)}</span>`],
    ["requested", "Requested on", r => r.created_at || "", r => esc(fDate(r.created_at))],
    ["requester", "Requested by", r => r.requester || "", r => esc(r.requester || "—")],
    ["assignees", "Assigned to", r => asg(r).join(","), r => asg(r).map(n => `<span class="av" title="${esc(n)}">${esc(initials(n))}</span>`).join(" ") || "—"],
    ["done", "Done on", r => r.done_at || "", r => r.status === "done" ? esc(fDate(r.done_at)) : "—"],
    ["wait", "Waiting time", r => waitMs(r) || 0, r => r.status === "done" ? `<span title="Time from request to done">${esc(durTxt(waitMs(r)))}</span>` : `<span class="pill ${waitMs(r) > 2 * 864e5 ? "r" : "a"}" title="Waiting since the request">${esc(durTxt(waitMs(r)))}</span>`],
    ["webinar", "Webinar date", r => evUTC(r) || 0, r => { const u = evUTC(r); return u ? esc(fDay(u, r.event_tz || "America/Chicago") + (r.event_time ? " · " + fTime(u, r.event_tz) + " " + zAbbr(r.event_tz) : "")) : "—"; }],
    ["due", "Due date", r => r.due_date || "9", r => esc(fDue(r.due_date) || "—")],
    ["steps", "Steps", r => prog(r.checklist).pct, r => { const p = prog(r.checklist); return p.n ? p.d + " / " + p.n : "—"; }],
    ["moved", "Moved by", r => movers(r).map(m => m.actor).join(","), r => movers(r).map(m => `<span class="av m" title="${esc(m.actor)}">${esc(initials(m.actor))}</span>`).join(" ") || "—"],
  ];
  function dashState() {
    if (!S.dash) { let cols = null; try { cols = JSON.parse(localStorage.getItem("voxdesk-dcols")); } catch (e) {} S.dash = { period: "all", client: "", type: "", grp: "", who: "", sort: "requested", dir: -1, gran: "day", open: null, cols: Array.isArray(cols) && cols.length ? cols : ["client", "title", "type", "status", "requested", "requester", "assignees", "done", "wait"] }; }
    return S.dash;
  }
  function chartHTML(reqs) {
    const D = dashState(), g = D.gran, B = [], td = today().split("-"), base = new Date(Date.UTC(+td[0], +td[1] - 1, +td[2]));
    const keyOf = iso => { if (!iso) return null; const k = ymdIn(+new Date(iso), MYZ); if (g === "day") return k; if (g === "month") return k.slice(0, 7); const p = k.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
    if (g === "day") { const n = new Date(Date.UTC(+td[0], +td[1], 0)).getUTCDate(); for (let i = 1; i <= n; i++) { const d = new Date(Date.UTC(+td[0], +td[1] - 1, i)); B.push({ k: d.toISOString().slice(0, 10), lab: String(i), full: d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }) }); } }
    else if (g === "week") { const ws = new Date(base); ws.setUTCDate(ws.getUTCDate() - ((ws.getUTCDay() + 6) % 7)); for (let i = 11; i >= 0; i--) { const d = new Date(ws); d.setUTCDate(d.getUTCDate() - i * 7); const l = d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }); B.push({ k: d.toISOString().slice(0, 10), lab: l, full: "Week of " + l }); } }
    else for (let i = 5; i >= 0; i--) { const d = new Date(Date.UTC(+td[0], +td[1] - 1 - i, 1)); B.push({ k: d.toISOString().slice(0, 7), lab: d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" }), full: d.toLocaleDateString("en-US", { timeZone: "UTC", month: "long", year: "numeric" }) }); }
    const ix = {}; B.forEach((b, i) => { b.delivered = 0; b.upd = 0; b.neu = 0; ix[b.k] = i; });
    reqs.forEach(r => { const c = ix[keyOf(r.created_at)]; if (c != null) B[c][r.type === "client" ? "neu" : "upd"]++; if (r.status === "done") { const d = ix[keyOf(r.done_at)]; if (d != null) B[d].delivered++; } });
    const tot = k => B.reduce((a, b) => a + b[k], 0), max = Math.max(1, ...B.map(b => Math.max(b.delivered, b.upd, b.neu)));
    const step = max <= 5 ? 1 : max <= 10 ? 2 : max <= 25 ? 5 : max <= 50 ? 10 : Math.ceil(max / 5 / 10) * 10, top = Math.ceil(max / step) * step;
    const W = 960, H = 250, L = 30, R = 6, T = 10, Bt = 26, pw = W - L - R, ph = H - T - Bt, bw = pw / B.length, gap = 2, w = Math.max(2, Math.min(16, (bw - 8 - 2 * gap) / 3));
    const y = v => T + ph - (v / top) * ph;
    const bar = (x, v, c) => { if (!v) return ""; const h = (v / top) * ph, r = Math.min(4, w / 2, h); return `<path d="M${x.toFixed(1)} ${(T + ph).toFixed(1)}v${(-(h - r)).toFixed(1)}q0 ${-r} ${r} ${-r}h${(w - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}v${(h - r).toFixed(1)}z" fill="${c}"/>`; };
    let grid = "", bars = "", labs = "", hits = ""; const every = Math.ceil(B.length / 16);
    for (let v = 0; v <= top; v += step) grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${v ? 0.07 : 0.2})"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}</text>`;
    B.forEach((b, i) => { const x0 = L + i * bw + (bw - (3 * w + 2 * gap)) / 2; bars += bar(x0, b.delivered, DCOL.delivered) + bar(x0 + w + gap, b.upd, DCOL.upd) + bar(x0 + 2 * (w + gap), b.neu, DCOL.neu); if (i % every === 0 || g !== "day") labs += `<text x="${L + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" class="ax${b.k === today() ? " now" : ""}">${esc(b.lab)}</text>`; hits += `<rect class="hit" x="${L + i * bw}" y="${T}" width="${bw}" height="${ph}" fill="transparent" data-tip="${esc(JSON.stringify([b.full, b.delivered, b.upd, b.neu]))}"/>`; });
    const lg = (c, t, n) => `<span class="lg"><i style="background:${c}"></i><span>${t}</span><b data-i18n>${n}</b></span>`;
    return `<div class="panel" style="margin-top:16px"><h3><i class="ti ti-chart-bar"></i><span>Deliveries and requests</span><span style="margin-left:auto;display:flex;gap:6px;letter-spacing:0;text-transform:none">${[["day", "This month, by day"], ["week", "By week"], ["month", "By month"]].map(x => `<button class="step${g === x[0] ? " on" : ""}" data-act="dgran" data-g="${x[0]}">${x[1]}</button>`).join("")}</span></h3>
      <div class="lgs">${lg(DCOL.delivered, "Deliveries done", tot("delivered"))}${lg(DCOL.upd, "Update requests", tot("upd"))}${lg(DCOL.neu, "New client requests", tot("neu"))}</div>
      <div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Deliveries done, update requests and new client requests per period">${grid}${bars}${labs}${hits}</svg><div class="dtip" id="dtip"></div></div></div>`;
  }
  function vDash() {
    const D = dashState(), td = today(), start = { all: "", week: weekStart(), month: td.slice(0, 8) + "01", d30: ymdIn(Date.now() - 30 * 864e5, MYZ), d90: ymdIn(Date.now() - 90 * 864e5, MYZ) }[D.period] || "";
    const dk = iso => iso ? ymdIn(+new Date(iso), MYZ) : "";
    const all = S.items.requests, team = [...new Set(S.members.filter(m => m.team === "clicklab").map(m => m.name))];
    const rs = all.filter(r => (!start || dk(r.created_at) >= start) && (!D.client || r.client_id === D.client) && (!D.type || (D.type === "client") === (r.type === "client")) && (!D.grp || grpOf(r) === D.grp) && (!D.who || asg(r).includes(D.who)));
    const served = from => new Set(all.filter(r => r.status === "done" && r.client_id && r.client_id !== "all" && dk(r.done_at) >= from).map(r => r.client_id)).size;
    const doneM = all.filter(r => r.status === "done" && dk(r.done_at) >= td.slice(0, 8) + "01").length, open = all.filter(r => r.status !== "done"), prod = open.filter(r => grpOf(r) === "prod").length, wait = open.filter(r => grpOf(r) === "wait");
    const avg = l => l.length ? l.reduce((a, b) => a + b, 0) / l.length : null;
    const kpi = (v, l, sub) => `<div class="kpi"><span>${l}</span><b data-i18n>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
    const col = DCOLS.find(c => c[0] === D.sort) || DCOLS[4];
    const rows = rs.slice().sort((a, b) => { const x = col[2](a), y = col[2](b); return (x < y ? -1 : x > y ? 1 : 0) * D.dir; });
    const shown = DCOLS.filter(c => D.cols.includes(c[0]));
    const by = {}; rs.forEach(r => { (by[r.client_id || ""] = by[r.client_id || ""] || []).push(r); });
    const cl = Object.keys(by).map(id => { const l = by[id], c = get("clients", id), p = c ? prog(c.deliverables) : null, op = l.filter(r => r.status !== "done"); return { id, name: clientName(id), brand: c ? c.brand : "", l, c, p, done: l.filter(r => r.status === "done").length, prod: l.filter(r => grpOf(r) === "prod").length, wait: l.filter(r => grpOf(r) === "wait").length, avg: avg(l.filter(r => r.status === "done").map(waitMs).filter(v => v != null)), old: op.length ? Math.max(...op.map(waitMs)) : null }; }).sort((a, b) => (b.prod + b.wait) - (a.prod + a.wait) || a.name.localeCompare(b.name));
    const sel = (k, opts) => `<select class="sel" style="width:auto;min-width:130px" data-dash="${k}">${opts.map(o => opt(o[0], o[1], D[k])).join("")}</select>`;
    return `<div class="top"><h1>Dashboard</h1>
      ${sel("period", [["all", "All time"], ["week", "This week"], ["month", "This month"], ["d30", "Last 30 days"], ["d90", "Last 90 days"]])}
      <select class="sel" style="width:auto;min-width:160px" data-dash="client">${opt("", "All clients", D.client)}${clientOpts(D.client)}</select>
      ${sel("type", [["", "All types"], ["client", "New clients"], ["update", "Updates"]])}
      ${sel("grp", [["", "All statuses"], ["done", "Done"], ["prod", "In production"], ["wait", "Waiting"]])}
      ${sel("who", [["", "Everyone"], ...team.map(n => [n, n])])}</div>
      <div class="kpis">${kpi(served(td), "Clients served today")}${kpi(served(weekStart()), "Clients served this week")}${kpi(served(td.slice(0, 8) + "01"), "Clients served this month")}${kpi(doneM, "Deliveries this month")}${kpi(prod, "In production")}${kpi(wait.length, "Waiting", wait.length ? "<span>Average wait</span> " + esc(durTxt(avg(wait.map(waitMs)))) : "")}</div>
      <div class="panel"><h3><i class="ti ti-users"></i><span>By client</span><span class="q" data-i18n style="margin-left:auto;letter-spacing:0">${cl.length}</span></h3>
        <div class="tbw"><table class="tb"><thead><tr><th>Client</th><th>Requests</th><th>Done</th><th>In production</th><th>Waiting</th><th>Average delivery time</th><th>Oldest open request</th><th>Deliveries</th><th>Missing from Pineda</th></tr></thead><tbody>
        ${cl.map(c => `<tr class="go" data-act="dopen" data-id="${esc(c.id)}"><td><i class="ti ti-chevron-${D.open === c.id ? "down" : "right"}"></i> <b class="cl">${esc(c.name)}</b>${c.brand ? ` <span class="sub" style="display:inline;margin:0">· ${esc(c.brand)}</span>` : ""}</td><td>${c.l.length}</td><td><span class="pill g">${c.done}</span></td><td><span class="pill ${c.prod ? "o" : ""}">${c.prod}</span></td><td><span class="pill ${c.wait ? "a" : ""}">${c.wait}</span></td><td>${esc(durTxt(c.avg))}</td><td>${c.old == null ? "—" : `<span class="pill ${c.old > 2 * 864e5 ? "r" : ""}">${esc(durTxt(c.old))}</span>`}</td><td>${c.p ? `<span style="display:inline-flex;align-items:center;gap:8px"><span class="bar" style="width:70px;margin:0"><b style="width:${c.p.pct}%"></b></span>${c.p.d} / ${c.p.n}</span>` : "—"}</td><td>${c.c && missing(c.c).length ? `<span class="pill r" title="${esc(missing(c.c).map(x => x.label).join("\n"))}">${missing(c.c).length}</span>` : c.c && c.c.requirements ? `<span class="pill g">0</span>` : "—"}</td></tr>` +
          (D.open === c.id ? `<tr class="ex"><td colspan="9"><div class="exg"><div><span class="lab">Requests</span>${c.l.slice().sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")).map(r => `<div class="hist go" data-act="open" data-id="${r.id}"><time>${esc(fDate(r.created_at))}</time><span><b>${esc(r.title || typeOf(r).label)}</b></span><span class="pill ${GRP[grpOf(r)][1]}" style="margin-left:auto">${esc(STATUS.find(x => x.id === r.status).label)}</span><span style="width:64px;text-align:right">${esc(durTxt(waitMs(r)))}</span></div>`).join("")}</div>
            <div>${c.c ? `<span class="lab">Done</span>${c.c.deliverables.filter(x => x.done).map(x => `<div class="hist"><i class="ti ti-check" style="color:var(--verde)"></i><span class="cl" style="font-weight:400">${esc(x.label)}</span>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" style="margin-left:auto"><i class="ti ti-external-link"></i></a>` : ""}</div>`).join("") || `<div class="hist">—</div>`}<span class="lab" style="margin-top:12px">Missing</span>${c.c.deliverables.filter(x => !x.done).map(x => `<div class="hist"><i class="ti ti-circle-dashed" style="color:var(--ambar)"></i><span class="cl" style="font-weight:400">${esc(x.label)}</span></div>`).join("") || `<div class="hist">—</div>`}<button class="btn sm" style="margin-top:10px" data-act="client" data-id="${c.c.id}" data-go="1"><i class="ti ti-arrow-up-right"></i><span>Open client</span></button>` : ""}</div></div></td></tr>` : "")).join("") || `<tr><td colspan="9"><div class="empty">No requests match these filters</div></td></tr>`}
        </tbody></table></div></div>
      <div class="panel" style="margin-top:16px"><h3><i class="ti ti-table"></i><span>Requests</span><span class="q" data-i18n style="margin-left:auto;letter-spacing:0">${rows.length}</span></h3>
        <div class="colpick"><span class="lab" style="margin:0">Columns</span>${DCOLS.map(c => `<button class="step${D.cols.includes(c[0]) ? " on" : ""}" data-act="dcol" data-c="${c[0]}">${c[1]}</button>`).join("")}</div>
        <div class="tbw"><table class="tb"><thead><tr>${shown.map(c => `<th class="go" data-act="dsort" data-c="${c[0]}"><span>${c[1]}</span>${D.sort === c[0] ? ` <i class="ti ti-arrow-${D.dir > 0 ? "up" : "down"}"></i>` : ""}</th>`).join("")}</tr></thead><tbody>
        ${rows.map(r => `<tr class="go" data-act="open" data-id="${r.id}">${shown.map(c => `<td>${c[3](r)}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${shown.length || 1}"><div class="empty">No requests match these filters</div></td></tr>`}
        </tbody></table></div></div>
      ${chartHTML(all.filter(r => (!D.client || r.client_id === D.client) && (!D.who || asg(r).includes(D.who))))}`;
  }

  /* ---------- checklist view: one client at a time, every request as a list of steps ---------- */
  function vList() {
    const open = S.items.requests.filter(r => r.status !== "done");
    const ids = [...new Set(open.map(r => r.client_id || ""))];
    const info = ids.map(id => { const l = open.filter(r => (r.client_id || "") === id).sort(byRank), st = l.reduce((a, r) => { const p = prog(r.checklist); a.d += p.d; a.n += p.n; return a; }, { d: 0, n: 0 }); return { id, name: clientName(id), brand: (get("clients", id) || {}).brand || "", l, st, rank: Math.min(...l.map(r => r.rank == null ? 1e9 : r.rank)), old: Math.min(...l.map(r => +new Date(r.created_at || Date.now()))) }; }).sort((a, b) => a.rank - b.rank || a.old - b.old);
    if (S.listClient == null || (!info.some(c => c.id === S.listClient) && !S.items.requests.some(r => (r.client_id || "") === S.listClient))) S.listClient = info.length ? info[0].id : "";
    const cur = S.listClient, mine = S.items.requests.filter(r => (r.client_id || "") === cur), todo = mine.filter(r => r.status !== "done").sort(byRank), done = mine.filter(r => r.status === "done").sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")), c = get("clients", cur);
    const sec = (r, i) => { const p = prog(r.checklist), t = typeOf(r); return `<div class="panel lsec"><div class="lh"><span class="rk">${i + 1}</span><div style="flex:1;min-width:0"><div class="cl">${esc(r.title || t.label)}</div><div class="sub" style="margin:2px 0 0">${esc(r.requester ? r.requester + " · " : "")}${esc(fDate(r.created_at))}${evUTC(r) ? " · webinar " + esc(fDay(evUTC(r), r.event_tz || "America/Chicago")) : ""}</div></div>
        <span class="pill ${GRP[grpOf(r)][1]}">${esc(STATUS.find(x => x.id === r.status).label)}</span><span class="pill">${p.d} / ${p.n}</span>
        ${asg(r).map(n => `<span class="av" title="${esc(n)}">${esc(initials(n))}</span>`).join("")}
        ${r.slack_url ? `<a class="x" href="${esc(r.slack_url)}" target="_blank" rel="noopener" title="Open in Slack"><i class="ti ti-brand-slack"></i></a>` : ""}
        ${valPill(r)}${valBtn("requests", r.id, true)}
        <button class="btn sm" data-act="open" data-id="${r.id}"><i class="ti ti-arrow-up-right"></i><span>Open request</span></button></div>
        ${r.validation ? `<div style="margin-top:10px">${valReport(r)}</div>` : ""}
        ${r.source_text ? `<div class="q" style="margin:10px 0 4px"><i class="ti ti-brand-slack"></i><span><b>${esc(r.requester || "Slack")}:</b> ${esc(r.source_text.length > 220 ? r.source_text.slice(0, 220) + "…" : r.source_text)}</span></div>` : ""}
        <div class="bar" style="margin:10px 0 8px"><b style="width:${p.pct}%"></b></div>
        ${listHTML("requests", r.id, "checklist", "Add a step")}</div>`; };
    return `<div class="top"><h1>Checklist</h1><button class="btn pri" data-act="new" data-client="${c ? c.id : ""}"><i class="ti ti-plus"></i>Add request</button></div>
      <div class="lgrid"><div class="panel lside"><h3><i class="ti ti-users"></i><span>Clients with open work</span></h3>
        ${info.map(x => `<button class="lcl${x.id === cur ? " on" : ""}" data-act="lpick" data-id="${esc(x.id)}"><span style="flex:1;min-width:0"><b class="cl">${esc(x.name)}</b><small class="sub">${esc(x.brand)}</small><span class="bar" style="margin-top:6px"><b style="width:${x.st.n ? Math.round(x.st.d / x.st.n * 100) : 0}%"></b></span></span><span class="pill o">${x.l.length}</span></button>`).join("") || `<div class="empty">No open work. All done.</div>`}</div>
      <div><div class="lhead"><div><div class="ttl">${esc(clientName(cur))}</div><div class="sub">${esc(c ? c.brand || "" : "")}</div></div>${c ? `<span style="display:flex;gap:8px;align-items:center">${ghlBtn(c)}${valPill(c)}${valBtn("clients", c.id, true)}<button class="btn sm" data-act="client" data-id="${c.id}" data-go="1"><i class="ti ti-arrow-up-right"></i><span>Open client</span></button></span>` : ""}</div>
        ${c && c.validation ? `<div style="margin-bottom:14px">${valReport(c)}</div>` : ""}
        ${c && missing(c).length ? `<div class="panel reqp bad lsec"><h3><i class="ti ti-alert-triangle"></i><span>Needed from Pineda to launch</span><span class="pill r" data-i18n style="margin-left:auto;letter-spacing:0;text-transform:none">${missing(c).length}</span></h3>${listHTML("clients", c.id, "requirements", "Add something Pineda must send")}</div>` : ""}
        ${todo.map(sec).join("") || `<div class="panel"><div class="empty">Nothing open for this client</div></div>`}
        ${done.length ? `<div class="panel" style="margin-top:14px"><h3><i class="ti ti-circle-check"></i><span>Done</span><span class="q" data-i18n style="margin-left:auto;letter-spacing:0">${done.length}</span></h3>${done.map(r => `<div class="hist go" data-act="open" data-id="${r.id}"><i class="ti ti-check" style="color:var(--verde)"></i><span><b>${esc(r.title || typeOf(r).label)}</b></span><span style="margin-left:auto">${esc(fDate(r.done_at))}</span></div>`).join("")}</div>` : ""}
      </div></div>`;
  }

  /* ---------- private notes + AI assistant (each person sees only their own rows) ---------- */
  const P = { notes: [], ai: [], loaded: false, busy: false };
  const privKey = () => "voxdesk-priv:" + (S.me.email || S.me.name);
  async function loadPriv() {
    if (LIVE) {
      const { data, error } = await sb.from("desk_private").select("id,kind,data,created_at").order("created_at");
      if (error) { toast("Could not load your notes."); return; }
      P.notes = data.filter(r => r.kind === "note").map(r => Object.assign({}, r.data, { id: r.id, at: r.created_at })).reverse();
      P.ai = data.filter(r => r.kind === "ai").map(r => ({ role: r.data.role, text: r.data.text, at: r.created_at })).slice(-60);
    } else { let d = null; try { d = JSON.parse(localStorage.getItem(privKey())); } catch (e) {} P.notes = (d && d.notes) || []; P.ai = (d && d.ai) || []; }
    NS.clear(); P.notes.forEach(n => NS.set(n.id, JSON.stringify(n)));
    P.loaded = true; if (S.view === "notes") { renderMain(); aiScroll(); }
  }
  const privFlush = () => { if (!LIVE) try { localStorage.setItem(privKey(), JSON.stringify({ notes: P.notes, ai: P.ai })); } catch (e) {} };
  const aiScroll = () => { const l = $("#ailist"); if (l) l.scrollTop = l.scrollHeight; };
  const NS = new Map();
  function trackNote(id) {
    const prev = NS.has(id) ? NS.get(id) : null;
    track("pnote:" + id, () => {
      if (prev == null) { P.notes = P.notes.filter(x => x.id !== id); NS.delete(id); if (LIVE) sb.from("desk_private").delete().eq("id", id).then(() => {}); else privFlush(); }
      else { const o = JSON.parse(prev), i = P.notes.findIndex(x => x.id === id); if (i < 0) P.notes.unshift(o); else P.notes[i] = o; saveNoteRaw(o); }
    });
    if (U.cur) { U.cur.priv = true; if (!U.cur.label) U.cur.label = "note"; }
  }
  async function saveNote(n) { trackNote(n.id); return saveNoteRaw(n); }
  async function saveNoteRaw(n) {
    NS.set(n.id, JSON.stringify(n));
    if (!LIVE) return privFlush();
    const data = { title: n.title || "", body: n.body || "", client: n.client || "", done: !!n.done };
    const { error } = await sb.from("desk_private").upsert({ id: n.id, owner: S.me.email.toLowerCase(), kind: "note", data, updated_at: now() });
    if (error) toast("Could not save the note.");
  }
  function vNotes() {
    if (!P.loaded) { setTimeout(loadPriv, 0); return `<div class="top"><h1>Notes</h1></div><div class="empty">Loading…</div>`; }
    const cl = [...new Set(S.items.clients.map(c => c.name))].sort();
    const open = P.notes.filter(n => !n.done), done = P.notes.filter(n => n.done);
    const card = n => `<div class="panel pnote${n.done ? " dn" : ""}"><div class="lh"><button class="chk${n.done ? " on" : ""}" data-act="ntgl" data-id="${n.id}" aria-label="Mark as done">${n.done ? '<i class="ti ti-check"></i>' : ""}</button>
        <input class="bare" style="font-weight:500;font-size:15px" value="${esc(n.title || "")}" placeholder="Title" data-nf="title" data-id="${n.id}">
        <select class="sel" style="width:auto;max-width:170px;padding:5px 8px;font-size:12px" data-nf="client" data-id="${n.id}">${opt("", "No client", n.client || "")}${cl.map(c => opt(c, c, n.client)).join("")}${n.client && !cl.includes(n.client) ? opt(n.client, n.client, n.client) : ""}</select>
        <button class="x" data-act="ndel" data-id="${n.id}" aria-label="Delete"><i class="ti ti-trash"></i></button></div>
        <textarea class="bare nb" data-nf="body" data-id="${n.id}" placeholder="Write here" rows="${Math.min(14, Math.max(2, String(n.body || "").split("\n").length + 1))}">${esc(n.body || "")}</textarea></div>`;
    return `<div class="top"><h1>Notes</h1><span class="pill"><i class="ti ti-lock"></i><span>Private. Only you see this page.</span></span><button class="btn pri" data-act="nnew"><i class="ti ti-plus"></i>New note</button></div>
      <div class="ngrid"><div>${open.map(card).join("") || `<div class="panel"><div class="empty">No notes yet. Click "New note" to write the first one.</div></div>`}
        ${done.length ? `<div class="colh" style="margin:18px 4px 10px"><span class="dot" style="background:#BABABA"></span>Done<span class="q">${done.length}</span></div>${done.map(card).join("")}` : ""}</div>
</div>`;
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
        ${valBtn("requests", r.id, true)}<button class="btn ghost sm" data-act="delreq" data-id="${r.id}"><i class="ti ti-trash"></i>Delete</button><button class="btn ghost sm" data-act="close"><i class="ti ti-x"></i></button></div>
      <div id="pbar"></div>
      <input class="bare ttl" value="${esc(r.title || "")}" placeholder="Short title" data-f="title" ${A}>
      <div class="steps">${STATUS.map(s => `<button class="step${r.status === s.id ? " on" : ""}" data-act="status" data-id="${r.id}" data-s="${s.id}">${s.label}</button>`).join("")}</div>
      <div style="margin-top:10px">${stChip(r)}</div>
      ${newsHTML(r, true)}
      ${r.status === "tested" ? `<div class="note" style="color:var(--verde)"><i class="ti ti-rocket"></i> Pages and automations are updated and tested. Ads can launch.</div>` : ""}
      ${r.source_text ? `<div class="sec cm" style="border-color:rgba(255,109,41,.35)"><div class="h"><i class="ti ti-brand-slack" style="color:var(--laranja);font-size:16px"></i><b>${esc(r.requester || "Slack")}</b>${esc(fStamp(reqAt(r)))}${r.slack_url ? `<a href="${esc(r.slack_url)}" target="_blank" rel="noopener" style="margin-left:auto">Open in Slack</a>` : ""}</div>${mentions(r.source_text)}</div>` : ""}
      ${(r.updates || []).map(u => `<div class="sec cm" style="border-color:rgba(255,200,97,.4)"><div class="h"><i class="ti ti-brand-slack" style="color:var(--ambar);font-size:16px"></i><b>${esc(u.by || "Slack")}</b>${esc(fStamp(u.at))}<span class="pill a" style="margin-left:8px">Added in Slack</span>${u.url ? `<a href="${esc(u.url)}" target="_blank" rel="noopener" style="margin-left:auto">Open in Slack</a>` : ""}</div>${mentions(u.text || "")}</div>`).join("")}
      ${r.validation ? `<div class="sec">${valReport(r)}</div>` : ""}
      ${(c => c && (r.type === "client" || missing(c).length) ? pinedaBox(c) : "")(get("clients", r.client_id))}
      <div class="sec fg">
        <div><span class="lab" style="display:flex;align-items:center;gap:8px">Client ${get("clients", r.client_id) && get("clients", r.client_id).ghl ? `<a href="${esc(get("clients", r.client_id).ghl)}" target="_blank" rel="noopener" style="margin-left:auto;letter-spacing:0;text-transform:none" data-i18n><i class="ti ti-external-link"></i> GHL</a>` : ""}</span><select class="sel" data-f="client_id" ${A}>${opt("", "No client", r.client_id)}${clientOpts(r.client_id, true)}</select></div>
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
    const v = { board: vBoard, clients: vClients, calendar: vCalendar, history: vHistory, dash: vDash, list: vList, notes: vNotes }[S.view]();
    $("#main").innerHTML = v;
    const h1 = $("#main .top h1"); if (h1 && window.DESK_HELP) h1.insertAdjacentHTML("beforeend", `<button class="ibtn" data-act="help" data-h="${S.view}" title="How this screen works" aria-label="How this screen works"><i class="ti ti-info-circle"></i></button>`);
    const n = S.items.requests.filter(r => r.status === "new").length;
    document.querySelectorAll(".nav").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
    $("#nnew").textContent = n || ""; $("#nnew").style.display = n ? "" : "none";
    onRender();
  }
  function renderOver() {
    const r = S.open && get("requests", S.open);
    const sc = $(".drawer") ? $(".drawer").scrollTop : 0;
    $("#over").innerHTML = (r ? drawerHTML(r) : "") + (S.modal ? newHTML() : "") + helpHTML() + confirmHTML();
    if ($(".drawer")) $(".drawer").scrollTop = sc;
    onRender();
  }
  function render() {
    if (!S.me) return;
    if (!$("#main")) {
      $("#app").innerHTML = `<div class="shell"><aside class="side">
        <div class="brand"><img src="assets/vox-simbolo.svg" alt="Vox Digital"><div><b>VOX</b><span>Desk</span></div></div>
        ${[["board", "ti-layout-kanban", "Requests"], ["clients", "ti-users", "Clients"], ["list", "ti-list-check", "Checklist"], ["dash", "ti-chart-bar", "Dashboard"], ["notes", "ti-notebook", "Notes"], ["calendar", "ti-calendar", "Calendar"], ["history", "ti-history", "History"]].map(n => `<button class="nav" data-act="view" data-v="${n[0]}"><i class="ti ${n[1]}"></i><span>${n[2]}</span>${n[0] === "board" ? '<b class="n" id="nnew"></b>' : ""}</button>`).join("")}
        <button class="btn sm" data-act="lang" style="margin:0 6px 0;align-self:flex-start" title="Trocar o idioma da interface · Switch the interface language"><i class="ti ti-language"></i><span data-i18n>${window.DESK_I18N && window.DESK_I18N.get() === "pt" ? "Português · EN" : "English · PT"}</span></button>
        <button class="btn sm ghost" data-act="help" data-h="all" style="margin:6px 6px 0;align-self:flex-start"><i class="ti ti-help-circle"></i><span>Help</span></button>
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
    client(d) { S.client = d.id; if (d.go) S.view = "clients"; renderMain(); },
    nnew() { const n = { id: uid(), title: "", body: "", client: "", done: false, at: now() }; P.notes.unshift(n); saveNote(n); renderMain(); const i = $('[data-nf="title"][data-id="' + n.id + '"]'); if (i) i.focus(); },
    ntgl(d) { const n = P.notes.find(x => x.id === d.id); if (!n) return; n.done = !n.done; saveNote(n); renderMain(); },
    async ndel(d) { const n = P.notes.find(x => x.id === d.id); if (!n || !confirm("Delete this note?")) return; trackNote(n.id); NS.delete(n.id); P.notes = P.notes.filter(x => x.id !== d.id); if (LIVE) { const { error } = await sb.from("desk_private").delete().eq("id", d.id); if (error) toast("Could not delete."); } else privFlush(); renderMain(); },
    lpick(d) { S.listClient = d.id; renderMain(); window.scrollTo(0, 0); },
    dopen(d) { const D = dashState(); D.open = D.open === d.id ? null : d.id; renderMain(); },
    dgran(d) { dashState().gran = d.g; renderMain(); },
    dsort(d) { const D = dashState(); if (D.sort === d.c) D.dir = -D.dir; else { D.sort = d.c; D.dir = 1; } renderMain(); },
    dcol(d) { const D = dashState(); D.cols = D.cols.includes(d.c) ? D.cols.filter(x => x !== d.c) : DCOLS.map(c => c[0]).filter(x => x === d.c || D.cols.includes(x)); try { localStorage.setItem("voxdesk-dcols", JSON.stringify(D.cols)); } catch (e) {} renderMain(); },
    clients() { S.client = null; renderMain(); },
    cal(d) { if (d.d === "0") S.cal = null; else { let m = S.cal.m + +d.d, y = S.cal.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } S.cal = { y, m }; } renderMain(); },
    new(d) { const c = d.client && get("clients", d.client); S.modal = { type: "launch", client_id: d.client || "", title: "", event_date: "", event_time: "", event_tz: (c && c.tz) || "America/Chicago", due_date: "", link: "", details: "", newname: "", newbrand: "" }; renderOver(); },
    ntype(d) { S.modal.type = d.t; renderOver(); },
    create() {
      const d = S.modal; let cid = d.type === "global" ? "all" : d.client_id;
      if (d.type !== "global" && !cid) return ($("#nerr").textContent = "Choose a client first.");
      if (cid === "+") {
        if (!d.newname.trim()) return ($("#nerr").textContent = "Enter the new client name.");
        const c = { id: uid(), name: d.newname.trim(), brand: d.newbrand.trim(), am: S.me.team === "pineda" ? S.me.name : "", tz: d.event_tz, notes: "", links: [], deliverables: DELIVERABLES.map(l => ({ id: uid(), label: l, done: false, url: "" })), requirements: newReqs() };
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
    newclient() { const c = { id: uid(), name: "New client", brand: "", am: "", tz: "America/Chicago", notes: "", links: [], deliverables: DELIVERABLES.map(l => ({ id: uid(), label: l, done: false, url: "" })), requirements: newReqs() }; S.items.clients.push(c); save("clients", c); log("added the client", c.id, c.id); S.client = c.id; renderMain(); },
    delclient(d) { S.confirm = { k: "clients", id: d.id }; renderOver(); const i = $("#delword"); if (i) i.focus(); },
    delreq(d) { S.confirm = { k: "requests", id: d.id }; renderOver(); const i = $("#delword"); if (i) i.focus(); },
    delcancel() { S.confirm = null; renderOver(); },
    delgo() {
      const q = S.confirm, i = $("#delword"); if (!q) return;
      if (!i || i.value !== "DELETE") { const e = $("#delerr"); if (e) e.textContent = (window.DESK_I18N && window.DESK_I18N.get() === "pt") ? "Escreva DELETE em maiúsculas para confirmar." : "Type DELETE in capital letters to confirm."; return i && i.focus(); }
      S.confirm = null;
      if (q.k === "clients") { const c = get("clients", q.id); if (c) { S.items.clients = S.items.clients.filter(x => x.id !== q.id); removeItem("clients", q.id); log('deleted the client "' + c.name + '"', null, null); S.client = null; } }
      else { const r = get("requests", q.id); if (r) { S.items.requests = S.items.requests.filter(x => x.id !== q.id); removeItem("requests", q.id); log('deleted the request "' + (r.title || "") + '"', null, r.client_id); S.open = null; } }
      render(); toast((window.DESK_I18N && window.DESK_I18N.get() === "pt") ? "Apagado. Use Cmd + Z para desfazer." : "Deleted. Press Cmd + Z to undo.");
    },
    status(d) { setStatus(get("requests", d.id), d.s); render(); },
    tgl(d) { const o = get(d.k, d.id), it = o[d.fld].find(x => x.id === d.it); it.done = !it.done; it.by = it.done ? S.me.name : ""; it.at = it.done ? now() : ""; save(d.k, o); log((d.fld === "requirements" ? (it.done ? "received from Pineda" : "marked as missing") : (it.done ? "checked" : "unchecked")) + ' "' + it.label + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id);
      if (d.k === "requests" && d.fld === "checklist" && o.checklist.length) { if (o.checklist.every(x => x.done)) { if (o.status !== "done") { setStatus(o, "done"); toast("All steps checked. Moved to Done."); } } else if (o.status === "done") setStatus(o, "doing"); }
      render(); },
    allchk(d) {
      const o = get(d.k, d.id), l = o[d.fld] || []; if (!l.length) return;
      const on = !l.every(x => x.done), n = l.filter(x => x.done !== on).length;
      l.forEach(it => { if (it.done !== on) { it.done = on; it.by = on ? S.me.name : ""; it.at = on ? now() : ""; } });
      save(d.k, o); log((on ? "checked all " : "unchecked all ") + n + (d.fld === "requirements" ? " items from Pineda" : d.fld === "deliverables" ? " deliveries" : " steps"), d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id);
      if (d.k === "requests" && d.fld === "checklist") { if (on) { if (o.status !== "done") { setStatus(o, "done"); toast("All steps checked. Moved to Done."); } } else if (o.status === "done") setStatus(o, "doing"); }
      render();
    },
    undo() { undoLast(); },
    help(d) { S.help = d.h || "all"; renderOver(); },
    helpclose() { S.help = null; renderOver(); },
    async validate(d) {
      if (VB.has(d.id)) return;
      if (!LIVE) return toast("The validator works on the published panel only.");
      VB.add(d.id); render();
      const { data, error } = await sb.functions.invoke("desk-validate", { body: d.k === "clients" ? { client_id: d.id } : { request_id: d.id } });
      VB.delete(d.id);
      if (error || !data || !data.item) { render(); return toast("The validator could not run. Try again."); }
      const l = S.items[data.kind], i = l.findIndex(x => x.id === data.item.id); if (i >= 0) l[i] = data.item; U.shadow.set(data.kind + ":" + data.item.id, JSON.stringify(data.item));
      render();
      toast(data.verdict === "approved" ? "Validation: approved" + (data.warns ? " · " + data.warns + " warning(s)" : "") : "Validation: not approved · " + data.fails + " issue(s)" + (data.moved ? ". Moved back to In progress." : ""));
    },
    quick(d) { const r = get("requests", d.id); setStatus(r, r.status === "done" ? "doing" : "done"); render(); },
    lidel(d) { const o = get(d.k, d.id), it = o[d.fld].find(x => x.id === d.it); o[d.fld] = o[d.fld].filter(x => x.id !== d.it); save(d.k, o); if (it) log('removed "' + it.label + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, it.label + (it.url ? "\n" + it.url : ""), ""); render(); },
    liadd(d) {
      const inp = $(`[data-add="${d.k}|${d.id}|${d.fld}"]`), v = inp.value.trim(); if (!v) return inp.focus();
      const o = get(d.k, d.id); o[d.fld] = o[d.fld] || [];
      if (d.fld === "links") { let label = "Link"; try { label = new URL(v).hostname.replace(/^www\./, ""); } catch (e) {} o.links.push({ id: uid(), label, url: v }); }
      else o[d.fld].push({ id: uid(), label: v, done: false, url: "" });
      save(d.k, o); log((d.fld === "links" ? "added the link " : "added ") + '"' + v + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, "", v); render(); const n = $(`[data-add="${d.k}|${d.id}|${d.fld}"]`); if (n) n.focus();
    },
    seen(d) { const r = get("requests", d.id); if (!r || !r.news) return; delete r.news; save("requests", r); log("marked the Slack news as seen", r.id, r.client_id); render(); },
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
    async logout() { if (LIVE) await sb.auth.signOut(); localStorage.removeItem("voxdesk-me"); U.stack = []; P.loaded = false; P.notes = []; P.ai = []; S.me = null; $("#app").innerHTML = ""; loginScreen(); },
  };

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    if ((el.dataset.act === "close" || el.dataset.act === "closemodal" || el.dataset.act === "helpclose" || el.dataset.act === "delcancel") && el.classList.contains("veil") && e.target !== el) return;
    if (e.target.closest("a")) return;
    A[el.dataset.act] && A[el.dataset.act](el.dataset, e);
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Enter" && e.target.id === "delword") { e.preventDefault(); return A.delgo(); }
    if (e.key === "Escape") { if (S.confirm) A.delcancel(); else if (S.help) A.helpclose(); else if (S.modal) A.closemodal(); else if (S.open) A.close(); else if (S.chat) A.chat(); }
    if (e.key === "Enter" && e.target.dataset.add) { const [k, id, fld] = e.target.dataset.add.split("|"); A.liadd({ k, id, fld }); }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === "z" && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && U.stack.length) { e.preventDefault(); undoLast(); }
    if (e.key === "Enter" && e.target.id === "lemail") A.login();
    if (e.key === "Enter" && !e.shiftKey && e.target.id === "chatinput") { e.preventDefault(); A.chatsend(); }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && e.target.id === "cbox" && S.open) A.comment({ id: S.open });
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.id === "delword") { const b = $("#delbtn"), e2 = $("#delerr"); if (b) b.classList.toggle("ready", t.value === "DELETE"); if (e2) e2.textContent = ""; return; }
    if (t.dataset.n && S.modal) { S.modal[t.dataset.n] = t.value; if (/^event_/.test(t.dataset.n) && $("#ntz")) $("#ntz").innerHTML = tzHTML(S.modal); if (t.dataset.n === "client_id") { const c = get("clients", t.value); if (c && c.tz) S.modal.event_tz = c.tz; renderOver(); } }
  });
  document.addEventListener("change", e => {
    const t = e.target, d = t.dataset;
    if (d.ui) { S[d.ui] = t.value; return renderMain(); }
    if (d.nf) { const n = P.notes.find(x => x.id === d.id); if (n && n[d.nf] !== t.value) { n[d.nf] = t.value; saveNote(n); } return; }
    if (d.dash) { dashState()[d.dash] = t.value; return renderMain(); }
    if (d.f) {
      const o = get(d.k, d.id); if (!o || o[d.f] === t.value) return;
      const old = o[d.f]; o[d.f] = t.value; save(d.k, o);
      const names = { assignee: "assigned to " + (t.value || "nobody"), due_date: "set due date to " + (fDue(t.value) || "none"), event_date: "changed the webinar date", event_time: "changed the webinar time", event_tz: "changed the time zone to " + zAbbr(t.value), client_id: "moved to " + clientName(t.value), waiting_on: t.value ? "is waiting on " + t.value : "cleared waiting on" };
      const lab = { title: "title", details: "notes", notes: "notes", name: "spokesperson", brand: "brand", am: "account manager", tz: "time zone", slack: "Slack channel", ghl: "GHL account link", type: "type", requester: "requested by" };
      const show = v => d.f === "client_id" ? clientName(v) : /tz$/.test(d.f) ? (v ? zAbbr(v) : "") : d.f === "type" ? (TYPES.find(x => x.id === v) || {}).label || v : /_date$/.test(d.f) ? fDue(v) : v;
      log(names[d.f] && d.k === "requests" ? names[d.f] : "edited the " + (lab[d.f] || d.f), d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, show(old), show(t.value));
      if (d.k === "requests" && d.f === "waiting_on" && t.value && o.status !== "info") setStatus(o, "info");
      if (/^event_/.test(d.f) && $("#tzbox")) $("#tzbox").innerHTML = tzHTML(o);
      renderMain(); if (d.f === "type" || d.f === "waiting_on") renderOver(); void old; return;
    }
    if (d.li) { const o = get(d.k, d.id), it = (o[d.fld] || []).find(x => x.id === d.it); if (it && it[d.li] !== t.value.trim()) { const was = it[d.li] || ""; it[d.li] = t.value.trim(); save(d.k, o); log("edited the " + (d.li === "url" ? "link" : "name") + ' of "' + it.label + '"', d.k === "requests" ? o.id : null, d.k === "requests" ? o.client_id : o.id, was, it[d.li]); if (d.li === "url") render(); else renderMain(); } }
  });
  document.addEventListener("mousemove", e => {
    const h = e.target.closest && e.target.closest(".hit[data-tip]"), tip = $("#dtip"); if (!tip) return;
    if (!h) { tip.style.display = "none"; return; }
    const v = JSON.parse(h.dataset.tip), box = tip.parentElement.getBoundingClientRect(), pt = window.DESK_I18N && window.DESK_I18N.get() === "pt";
    tip.innerHTML = `<b>${esc(v[0])}</b>` + [[DCOL.delivered, pt ? "Entregas feitas" : "Deliveries done", v[1]], [DCOL.upd, pt ? "Pedidos de atualização" : "Update requests", v[2]], [DCOL.neu, pt ? "Pedidos de cliente novo" : "New client requests", v[3]]].map(x => `<div><i style="background:${x[0]}"></i><span>${x[1]}</span><b>${x[2]}</b></div>`).join("");
    tip.style.display = "block"; const x = e.clientX - box.left, w = tip.offsetWidth;
    tip.style.left = Math.max(0, Math.min(box.width - w, x + (x + w + 20 > box.width ? -w - 12 : 12))) + "px"; tip.style.top = Math.max(0, e.clientY - box.top - 20) + "px";
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
        const reload = async () => { try { const n = await remote.load(); S.items = n.items; S.members = n.members; snapAll(); S.dirty = true; flush(); } catch (e) {} };
        const typingIn = sel => { const a = document.activeElement; return !!(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest(sel)); };
        const flush = () => { if (!S.dirty) return; if (typingIn("#main") || typingIn(".drawer,.modal")) return; S.dirty = false; if (S.open && !get("requests", S.open)) S.open = null; renderMain(); renderOver(); };
        document.addEventListener("focusout", () => setTimeout(flush, 150));
        const setLive = on => { S.live = on; const e = $("#live"); if (e) { e.querySelector(".dot").style.background = on ? "var(--verde)" : "var(--cinza)"; e.lastElementChild.textContent = on ? "Live" : "Connecting"; e.lastElementChild.removeAttribute("data-i18n"); if (I18) I18.apply(e); } };
        sb.channel("desk-items").on("postgres_changes", { event: "*", schema: "public", table: "desk_items" }, p => {
          if (p.eventType === "DELETE") { const id = p.old && p.old.id; if (!id) return reload(); KINDS.forEach(k => { U.shadow.delete(k + ":" + id); S.items[k] = S.items[k].filter(x => x.id !== id); }); }
          else {
            const row = p.new; if (!row || !S.items[row.kind]) return; if (row.updated_by === S.me.email) return;
            const o = Object.assign({}, row.data, { id: row.id }), l = S.items[row.kind], i = l.findIndex(x => x.id === o.id);
            if (i < 0) l.push(o); else l[i] = o;
            if (row.kind !== "activity") U.shadow.set(row.kind + ":" + o.id, JSON.stringify(o));
            const who = (S.members.find(m => m.email === row.updated_by) || {}).name || (/^slack-/.test(row.updated_by || "") ? "Slack" : row.updated_by === "desk-validate" ? "Validator" : "");
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
        S.me = { name: "Slack", email: "" }; U.busy = true; mergeImport(); U.busy = false; S.me = null;
        try { S.me = JSON.parse(localStorage.getItem("voxdesk-me")); } catch (e) {}
        if (!S.me) return loginScreen();
      }
      snapAll(); U.stack = []; U.cur = null;
      render(); paintUndo();
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
