import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";

export async function startPackedRegistry(packages) {
  const byName = new Map(packages.map(entry => [entry.name, entry]));
  const byTarball = new Map(packages.map(entry => [entry.filename, entry]));
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const prefix = "/tarballs/";
    if (url.pathname.startsWith(prefix)) {
      const entry = byTarball.get(decodeURIComponent(url.pathname.slice(prefix.length)));
      if (entry === undefined) return notFound(response);
      response.writeHead(200, { "content-type": "application/octet-stream", "content-length": String(statSync(entry.tarballPath).size) });
      createReadStream(entry.tarballPath).pipe(response);
      return;
    }
    const name = decodeURIComponent(url.pathname.slice(1));
    const entry = byName.get(name);
    if (entry === undefined) return notFound(response);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const manifest = { ...entry.manifest, dist: {
      tarball: `${origin}/tarballs/${encodeURIComponent(entry.filename)}`,
      integrity: entry.integrity, shasum: entry.shasum,
    } };
    const body = JSON.stringify({ name, "dist-tags": { latest: entry.version }, versions: { [entry.version]: manifest } });
    response.writeHead(200, { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) });
    response.end(body);
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function notFound(response) {
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error: "not_found" }));
}
