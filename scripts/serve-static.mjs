import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootArgIndex = process.argv.indexOf("--root");
const portArgIndex = process.argv.indexOf("--port");
const root = path.resolve(__dirname, "..", rootArgIndex === -1 ? "out" : process.argv[rootArgIndex + 1]);
const port = Number(portArgIndex === -1 ? 3001 : process.argv[portArgIndex + 1]);

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".txt", "text/plain; charset=utf-8"],
]);

function sendNotFound(response) {
  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const safePath = pathname.replace(/^\/+/, "");

  const candidates = [
    path.join(root, safePath),
    path.join(root, safePath, "index.html"),
  ];

  let targetPath = null;

  for (const candidate of candidates) {
    if (!candidate.startsWith(root)) {
      continue;
    }

    if (existsSync(candidate)) {
      const candidateStat = await stat(candidate);

      if (candidateStat.isFile()) {
        targetPath = candidate;
        break;
      }
    }
  }

  if (!targetPath) {
    sendNotFound(response);
    return;
  }

  const extension = path.extname(targetPath).toLowerCase();
  const contentType = contentTypes.get(extension) ?? "application/octet-stream";

  response.writeHead(200, { "Content-Type": contentType });
  createReadStream(targetPath).pipe(response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`);
});
