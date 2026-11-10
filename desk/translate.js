/* Vox Desk — translator EN <-> PT. Uses the browser's built-in Translator (Chrome 138+). Text never leaves the computer. */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pt = () => window.DESK_I18N && window.DESK_I18N.get() === "pt";
  const L = k => (pt() ? { title: "Tradutor", ph: "Digite ou cole o texto", out: "A tradução aparece aqui", copy: "Copiar", copied: "Copiado", tr: "Traduzir", wait: "Traduzindo…", dl: "Baixando o idioma", no: "Este navegador não tem tradutor embutido. Use o Google Chrome atualizado.", g: "Abrir no Google Tradutor", swap: "Inverter" }
    : { title: "Translator", ph: "Type or paste the text", out: "The translation shows here", copy: "Copy", copied: "Copied", tr: "Translate", wait: "Translating…", dl: "Downloading the language", no: "This browser has no built-in translator. Use an up-to-date Google Chrome.", g: "Open in Google Translate", swap: "Swap" })[k];
  const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error("timeout")), ms))]);
  const cache = {};
  const isPT = t => /[ãõçáéíóúâêôà]/i.test(t) || (t.toLowerCase().match(/\b(que|não|nao|para|com|uma|você|voce|está|esta|por|como|mais|isso|fazer|pode|preciso|obrigado|página|pagina|cliente)\b/g) || []).length >= 2;
  async function engine(src, tgt, onStatus) {
    const k = src + ">" + tgt; if (cache[k]) return cache[k];
    if (!("Translator" in self)) throw new Error("unsupported");
    const av = await timeout(self.Translator.availability({ sourceLanguage: src, targetLanguage: tgt }), 8000);
    if (av === "unavailable") throw new Error("unsupported");
    const tr = await timeout(self.Translator.create({ sourceLanguage: src, targetLanguage: tgt, monitor(m) { m.addEventListener("downloadprogress", e => onStatus && onStatus(L("dl") + " " + Math.round((e.loaded || 0) * 100) + "%")); } }), 120000);
    return (cache[k] = tr);
  }
  async function translate(text, src, tgt, onStatus) {
    const tr = await engine(src, tgt, onStatus);
    const parts = text.split(/\n/); const out = [];
    for (const p of parts) out.push(p.trim() ? await tr.translate(p) : "");
    return out.join("\n");
  }
  const gUrl = (t, src, tgt) => "https://translate.google.com/?sl=" + src + "&tl=" + tgt + "&op=translate&text=" + encodeURIComponent(t.slice(0, 1500));
  const failHTML = (t, src, tgt) => `<span style="color:var(--ambar)">${esc(L("no"))}</span><br><a href="${esc(gUrl(t, src, tgt))}" target="_blank" rel="noopener">${esc(L("g"))}</a>`;

  /* ---- panel ---- */
  let dir = "en>pt", timer = null, seq = 0;
  const root = document.createElement("div"); root.id = "tr"; document.body.appendChild(root);
  function build() {
    const [a, b] = dir.split(">");
    root.innerHTML = `<button class="trbtn" id="trbtn" aria-label="${esc(L("title"))}" title="${esc(L("title"))} EN ⇄ PT"><i class="ti ti-language"></i></button>
      <div class="chatpanel trpanel" id="trpanel" style="display:none"><div class="chath"><i class="ti ti-language"></i><span>${esc(L("title"))}</span>
        <button class="step on" id="trdir" title="${esc(L("swap"))}" style="margin-left:auto;padding:5px 12px"><b id="trfrom">${a.toUpperCase()}</b><i class="ti ti-arrows-exchange" style="color:inherit"></i><b id="trto">${b.toUpperCase()}</b></button>
        <button class="btn ghost sm" id="trclose"><i class="ti ti-x"></i></button></div>
        <div style="padding:12px;display:flex;flex-direction:column;gap:10px;flex:1;min-height:0">
          <textarea class="txt" id="trin" placeholder="${esc(L("ph"))}" style="flex:1;min-height:90px;resize:none"></textarea>
          <div class="trout" id="trout"><span style="color:var(--cinza)">${esc(L("out"))}</span></div>
          <div style="display:flex;justify-content:flex-end"><button class="btn sm" id="trcopy"><i class="ti ti-copy"></i><span>${esc(L("copy"))}</span></button></div>
        </div></div>`;
  }
  async function run() {
    const t = document.getElementById("trin").value.trim(), out = document.getElementById("trout"), [a, b] = dir.split(">"), my = ++seq;
    if (!t) { out.innerHTML = `<span style="color:var(--cinza)">${esc(L("out"))}</span>`; out.dataset.t = ""; return; }
    out.innerHTML = `<span style="color:var(--cinza)">${esc(L("wait"))}</span>`;
    try { const r = await translate(t, a, b, s => { if (my === seq) out.innerHTML = `<span style="color:var(--cinza)">${esc(s)}</span>`; }); if (my !== seq) return; out.textContent = r; out.dataset.t = r; }
    catch (e) { if (my === seq) { out.innerHTML = failHTML(t, a, b); out.dataset.t = ""; } }
  }
  function open(text, d) {
    if (d) dir = d; build(); const p = document.getElementById("trpanel"); p.style.display = "flex";
    const cp = document.getElementById("chatpanel"); if (cp && cp.style.display === "flex") document.getElementById("chatbtn").click();
    const i = document.getElementById("trin"); if (text) i.value = text; i.focus(); if (text) run();
  }
  build();
  root.addEventListener("click", e => {
    if (e.target.closest("#trbtn")) { const p = document.getElementById("trpanel"); if (p.style.display === "flex") p.style.display = "none"; else open(); }
    else if (e.target.closest("#trclose")) document.getElementById("trpanel").style.display = "none";
    else if (e.target.closest("#trdir")) { const v = document.getElementById("trin").value, o = document.getElementById("trout").dataset.t || ""; dir = dir.split(">").reverse().join(">"); open(o || v); }
    else if (e.target.closest("#trcopy")) { const t = document.getElementById("trout").dataset.t || ""; if (t && navigator.clipboard) navigator.clipboard.writeText(t).then(() => { const s = document.querySelector("#trcopy span"); s.textContent = L("copied"); setTimeout(() => { s.textContent = L("copy"); }, 1500); }); }
  });
  root.addEventListener("input", e => { if (e.target.id === "trin") { clearTimeout(timer); timer = setTimeout(run, 600); } });
  document.addEventListener("click", e => { if (e.target.closest && e.target.closest("#chatbtn")) { const p = document.getElementById("trpanel"); if (p) p.style.display = "none"; } });

  /* ---- select any text on the page -> "Translate" ---- */
  const pop = document.createElement("div"); pop.className = "trpop"; pop.style.display = "none"; document.body.appendChild(pop);
  let selText = "";
  const hide = () => { pop.style.display = "none"; pop.dataset.mode = ""; };
  document.addEventListener("mouseup", e => {
    if (e.target.closest && e.target.closest(".trpop,#tr")) return;
    setTimeout(() => {
      const s = window.getSelection(), t = s ? s.toString().trim() : "";
      if (!t || t.length < 2 || t.length > 3000 || !s.rangeCount) return hide();
      const r = s.getRangeAt(0).getBoundingClientRect(); if (!r.width && !r.height) return hide();
      selText = t; pop.dataset.mode = "btn";
      pop.innerHTML = `<button class="btn pri sm" data-tr="go"><i class="ti ti-language"></i>${esc(L("tr"))}</button>`;
      pop.style.display = "block"; pop.style.maxWidth = "";
      pop.style.left = Math.max(8, Math.min(window.innerWidth - 150, r.left)) + "px";
      pop.style.top = Math.min(window.innerHeight - 50, r.bottom + 8) + "px";
    }, 10);
  });
  document.addEventListener("mousedown", e => { if (!(e.target.closest && e.target.closest(".trpop"))) hide(); });
  pop.addEventListener("mousedown", e => e.preventDefault());
  pop.addEventListener("click", async e => {
    const b = e.target.closest("[data-tr]"); if (!b) return;
    if (b.dataset.tr === "close") return hide();
    if (b.dataset.tr === "panel") { hide(); return open(selText, isPT(selText) ? "pt>en" : "en>pt"); }
    if (b.dataset.tr === "copy") { if (navigator.clipboard) navigator.clipboard.writeText(pop.dataset.out || ""); return; }
    const src = isPT(selText) ? "pt" : "en", tgt = src === "pt" ? "en" : "pt";
    const head = `<div class="trh"><b>${src.toUpperCase()} → ${tgt.toUpperCase()}</b><button class="x" data-tr="copy" title="${esc(L("copy"))}"><i class="ti ti-copy"></i></button><button class="x" data-tr="panel" title="${esc(L("title"))}"><i class="ti ti-arrows-maximize"></i></button><button class="x" data-tr="close"><i class="ti ti-x"></i></button></div>`;
    pop.dataset.mode = "out"; pop.style.maxWidth = "min(440px, calc(100vw - 16px))";
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 456, parseFloat(pop.style.left))) + "px";
    pop.innerHTML = head + `<div class="trb" style="color:var(--cinza)">${esc(L("wait"))}</div>`;
    try { const r = await translate(selText, src, tgt, s => { const el = pop.querySelector(".trb"); if (el) el.textContent = s; }); pop.dataset.out = r; pop.innerHTML = head + `<div class="trb"></div>`; pop.querySelector(".trb").textContent = r; }
    catch (err) { pop.innerHTML = head + `<div class="trb">${failHTML(selText, src, tgt)}</div>`; }
    const h = pop.getBoundingClientRect(); if (h.bottom > window.innerHeight - 8) pop.style.top = Math.max(8, window.innerHeight - h.height - 8) + "px";
  });
  window.DESK_TRANSLATE = { open };
})();
