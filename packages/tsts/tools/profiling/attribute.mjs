#!/usr/bin/env node
// Attribute a V8 CPU profile (and optional heap-allocation profile) to named
// cost categories — turning a raw profile into the "exact losses" breakdown:
// UTF-8 conversion, GC, value-key serialization, and per-phase scanner / parser
// / binder / checker / ast-build / emit time.
//
// Usage:
//   node attribute.mjs --cpu <file.cpuprofile> [--heap <file.heapprofile>] [--label NAME] [--json] [--top N]
//
// The CPU profile gives self-time per category (where the compiler spends CPU).
// The heap profile gives allocation bytes per category/site — essential because
// the dominant cost (per-node object/closure allocation) is charged to "(gc)" in
// the CPU profile, not to the allocation site. Run both together for the full story.
import { readFileSync } from "node:fs";

// Category rules in PRIORITY order. Specific JS-tax functions are matched before
// the by-file-path phase buckets so e.g. getUtf8ByteInfo (in scanner.ts) counts
// as utf8-conv, not scanner. `fn` matches the callFrame functionName; `url` the file.
const RULES = [
  { cat: "gc", fn: /^\(garbage collector\)$/ },
  { cat: "vm-overhead", fn: /^\((program|idle|root|native|garbage|gc)\)?/ },
  // The JS taxes (recoverable in native C#):
  { cat: "utf8-conv", fn: /getUtf8ByteInfo|byteAt|byteSlice|byteLen|decodeRuneInString|decodeLastRune|encodeUtf8|decodeUTF8|TextEncoder|TextDecoder|^#?encode$|^#?decode$/ },
  { cat: "utf8-conv", url: /\/(encoding|utf8)\.js/ },
  { cat: "value-key", fn: /goValueKey|goStructFieldsKey|goStructMapKey|goObjectId|keyBuilder_|writeByte|writeInt|writeString|Sum128|getRelationKey/ },
  { cat: "value-key", url: /\/xxh3\.js/ },
  // AST node construction = the {} as T + 22-closure adapter + factory allocations:
  { cat: "ast-build", url: /\/internal\/ast\// },
  // Go-runtime emulation (maps/slices/arena/sync):
  { cat: "go-runtime", url: /\/go\/(compat|sync|maps|slices)|\/core\/arena\.js/ },
  // Compiler phases (by directory in the file URL):
  { cat: "scanner", url: /\/internal\/scanner\// },
  { cat: "parser", url: /\/internal\/parser\// },
  { cat: "binder", url: /\/internal\/binder\// },
  { cat: "checker", url: /\/internal\/(checker|nodebuilder|evaluator)\// },
  { cat: "emit", url: /\/internal\/printer\// },
];

// Categories considered "JS-emulation tax" — recoverable by native C#
// (value structs, byte[]/Span, Dictionary<struct,V>). Reported as the headline.
const RECOVERABLE = new Set(["utf8-conv", "value-key", "gc", "ast-build", "go-runtime"]);

function categorize(callFrame) {
  const fn = callFrame.functionName || "";
  const url = callFrame.url || "";
  for (const r of RULES) {
    if (r.fn && r.fn.test(fn)) return r.cat;
    if (r.url && r.url.test(url)) return r.cat;
  }
  return "other";
}

function fileBase(callFrame) {
  return (callFrame.url || "").split("/").pop() || "(native)";
}

function attributeCpu(path) {
  const p = JSON.parse(readFileSync(path, "utf8"));
  const totalMicros = (p.endTime ?? 0) - (p.startTime ?? 0);
  const byCat = new Map();
  const byFn = new Map();
  let totalHits = 0;
  for (const n of p.nodes || []) {
    const h = n.hitCount || 0;
    if (h === 0) continue;
    totalHits += h;
    const cat = categorize(n.callFrame);
    byCat.set(cat, (byCat.get(cat) || 0) + h);
    const key = `${(n.callFrame.functionName || "(anon)")} [${fileBase(n.callFrame)}]`;
    byFn.set(key, (byFn.get(key) || 0) + h);
  }
  return { kind: "cpu", totalMicros, totalHits, byCat, byFn };
}

function attributeHeap(path) {
  const p = JSON.parse(readFileSync(path, "utf8"));
  const byCat = new Map();
  const bySite = new Map();
  let totalBytes = 0;
  const stack = [p.head];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node === undefined) continue;
    const s = node.selfSize || 0;
    if (s > 0) {
      totalBytes += s;
      const cat = categorize(node.callFrame);
      byCat.set(cat, (byCat.get(cat) || 0) + s);
      const key = `${(node.callFrame.functionName || "(anon)")} [${fileBase(node.callFrame)}]`;
      bySite.set(key, (bySite.get(key) || 0) + s);
    }
    for (const c of node.children || []) stack.push(c);
  }
  return { kind: "heap", totalBytes, byCat, bySite };
}

function pctRows(map, total) {
  return [...map.entries()]
    .map(([k, v]) => ({ k, v, pct: total > 0 ? (100 * v) / total : 0 }))
    .sort((a, b) => b.v - a.v);
}

function printCpu(label, r) {
  const secs = r.totalMicros / 1e6;
  console.log(`\n# CPU self-time — ${label}  (total ${secs.toFixed(2)}s, ${r.totalHits} samples)`);
  console.log(`${"category".padEnd(14)} ${"%".padStart(7)} ${"time".padStart(8)}`);
  let recoverable = 0;
  for (const { k, v, pct } of pctRows(r.byCat, r.totalHits)) {
    if (RECOVERABLE.has(k)) recoverable += pct;
    console.log(`${k.padEnd(14)} ${pct.toFixed(1).padStart(6)}% ${(secs * v / r.totalHits).toFixed(2).padStart(7)}s`);
  }
  console.log(`${"-".repeat(32)}`);
  console.log(`${"RECOVERABLE".padEnd(14)} ${recoverable.toFixed(1).padStart(6)}%  (JS-emulation tax: gc + utf8 + value-key + ast-build + go-runtime)`);
}

function printHeap(label, r, top) {
  const mb = r.totalBytes / 1048576;
  console.log(`\n# Heap allocation — ${label}  (sampled total ${mb.toFixed(1)} MB)`);
  console.log(`${"category".padEnd(14)} ${"%".padStart(7)} ${"bytes".padStart(10)}`);
  for (const { k, v, pct } of pctRows(r.byCat, r.totalBytes)) {
    console.log(`${k.padEnd(14)} ${pct.toFixed(1).padStart(6)}% ${(v / 1048576).toFixed(2).padStart(8)}MB`);
  }
  console.log(`\n  top allocation sites:`);
  for (const { k, pct } of pctRows(r.bySite, r.totalBytes).slice(0, top)) {
    console.log(`    ${pct.toFixed(1).padStart(5)}%  ${k}`);
  }
}

function printTopFns(r, top) {
  console.log(`\n  top self-time functions:`);
  for (const { k, pct } of pctRows(r.byFn, r.totalHits).slice(0, top)) {
    console.log(`    ${pct.toFixed(1).padStart(5)}%  ${k}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const opt = { label: "profile", top: 12, json: false };
  let cpu, heap;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cpu") cpu = argv[++i];
    else if (a === "--heap") heap = argv[++i];
    else if (a === "--label") opt.label = argv[++i];
    else if (a === "--top") opt.top = Number(argv[++i]);
    else if (a === "--json") opt.json = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!cpu && !heap) {
    console.error("usage: attribute.mjs --cpu <file.cpuprofile> [--heap <file.heapprofile>] [--label NAME] [--top N] [--json]");
    process.exit(1);
  }
  const out = {};
  let cpuR, heapR;
  if (cpu) cpuR = attributeCpu(cpu);
  if (heap) heapR = attributeHeap(heap);
  if (opt.json) {
    if (cpuR) out.cpu = { totalMicros: cpuR.totalMicros, byCat: Object.fromEntries(cpuR.byCat) };
    if (heapR) out.heap = { totalBytes: heapR.totalBytes, byCat: Object.fromEntries(heapR.byCat) };
    console.log(JSON.stringify(out, null, 2));
    return;
  }
  if (cpuR) { printCpu(opt.label, cpuR); printTopFns(cpuR, opt.top); }
  if (heapR) printHeap(opt.label, heapR, opt.top);
}

main();
