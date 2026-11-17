const nativeScope = "Keel D-K01: native package APIs remain; only signed common provider contracts are required.";
const common = [
  ["assert", "assert.ts", "assert.ts"],
  ["buffer", "buffer/identities.ts", "buffer/declarations.ts"],
  ["child_process", "child-process.ts", "child-process/declarations.ts"],
  ["crypto", "crypto.ts", "crypto/declarations.ts"],
  ["dns", "dns.ts", "dns/declarations.ts"],
  ["dns/promises", "dns.ts", "dns/declarations.ts"],
  ["events", "events.ts", "events/declarations.ts"],
  ["fs", "filesystem/identities.ts", "filesystem/calls.ts"],
  ["fs/promises", "filesystem/identities.ts", "filesystem/promises.ts"],
  ["http", "http/types.ts", "http/types.ts"],
  ["https", "https.ts", "https/declarations.ts"],
  ["net", "net.ts", "net/declarations.ts"],
  ["os", "os.ts", "os.ts"],
  ["path", "path/identity.ts", "path.ts"],
  ["process", "process/declarations.ts", "process/declarations.ts"],
  ["readline", "readline.ts", "readline/declarations.ts"],
  ["stream", "stream.ts", "stream/declarations.ts"],
  ["timers", "timers.ts", "timers/declarations.ts"],
  ["tls", "tls.ts", "tls/declarations.ts"],
  ["url", "url/identities.ts", "url/declarations.ts"],
  ["util", "util/declarations.ts", "util/declarations.ts"],
  ["v8", "v8.ts", "v8.ts"],
  ["worker_threads", "worker-threads.ts", "worker-threads/declarations.ts"],
  ["zlib", "zlib.ts", "zlib/declarations.ts"],
];

export const keelOwnedNodeModules = Object.freeze({
  "csharp-nodejs": Object.freeze(common.map(([name, csharp]) => row(name, csharp))),
  "rust-nodejs": Object.freeze([
    ...common.map(([name, _csharp, rust]) => row(name, rust)),
    { module: "node:perf_hooks", file: "nodejs/src/provider/modules/performance.ts", exposed: true,
      required: false, scopeEvidence: nativeScope },
  ]),
});

function row(name, file) {
  return Object.freeze({ module: `node:${name}`, file: `nodejs/src/provider/modules/${file}`, exposed: true, required: true });
}
