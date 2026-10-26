// Servidor estático mínimo para a Hostinger (app Node.js). Sem dependências.
// Serve os arquivos desta pasta; /serie abre serie/index.html.
const http = require("http");
const fs = require("fs");
const path = require("path");

const RAIZ = __dirname;
const PORTA = process.env.PORT || 3000;
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".ico": "image/x-icon", ".mp4": "video/mp4", ".webm": "video/webm", ".mp3": "audio/mpeg",
  ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml",
};
const PRIVADOS = new Set(["server.js", "package.json", "package-lock.json"]);

function arquivo(url) {
  let p = decodeURIComponent(url.split("?")[0]);
  p = path.normalize(p).replace(/^(\.\.[/\\])+/, "");
  let alvo = path.join(RAIZ, p);
  if (!alvo.startsWith(RAIZ)) return null;
  if (fs.existsSync(alvo) && fs.statSync(alvo).isDirectory()) alvo = path.join(alvo, "index.html");
  else if (!path.extname(alvo) && fs.existsSync(alvo + ".html")) alvo += ".html";
  const nome = path.relative(RAIZ, alvo);
  if (PRIVADOS.has(nome) || nome.split(path.sep).some(s => s.startsWith("."))) return null;
  return fs.existsSync(alvo) ? alvo : null;
}

http.createServer((req, res) => {
  // /serie → /serie/ (os caminhos relativos da página dependem da barra final)
  const semQuery = req.url.split("?")[0];
  if (semQuery === "/serie") { res.writeHead(301, { Location: "/serie/" + (req.url.slice(6) || "") }); return res.end(); }

  // Painel de finanças (app React em financas/, gerado pelo projeto "contador"):
  // /financas → /financas/; rotas internas sem arquivo abrem o index.html; fora dos buscadores
  if (semQuery === "/financas") { res.writeHead(301, { Location: "/financas/" + (req.url.slice(9) || "") }); return res.end(); }
  const painel = semQuery.startsWith("/financas/");
  if (painel) {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("X-Frame-Options", "DENY");
  }

  const alvo = arquivo(req.url) || (painel && !path.extname(semQuery) ? path.join(RAIZ, "financas", "index.html") : null);
  if (!alvo) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); return res.end("Página não encontrada"); }

  const tipo = TIPOS[path.extname(alvo).toLowerCase()] || "application/octet-stream";
  const { size } = fs.statSync(alvo);
  const cache = tipo.startsWith("text/html") ? "no-cache" : "public, max-age=604800";
  const range = req.headers.range;

  // vídeos precisam de Range para o player avançar e o Safari tocar
  if (range) {
    const [i, f] = range.replace(/bytes=/, "").split("-");
    const ini = parseInt(i, 10) || 0, fim = f ? parseInt(f, 10) : size - 1;
    if (ini >= size) { res.writeHead(416, { "Content-Range": `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { "Content-Type": tipo, "Content-Range": `bytes ${ini}-${fim}/${size}`, "Accept-Ranges": "bytes", "Content-Length": fim - ini + 1, "Cache-Control": cache });
    return fs.createReadStream(alvo, { start: ini, end: fim }).pipe(res);
  }
  res.writeHead(200, { "Content-Type": tipo, "Content-Length": size, "Accept-Ranges": "bytes", "Cache-Control": cache });
  fs.createReadStream(alvo).pipe(res);
}).listen(PORTA, () => console.log("Vox Digital no ar na porta " + PORTA));
