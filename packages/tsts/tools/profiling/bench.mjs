#!/usr/bin/env node
// Cross-compiler benchmark harness: run TSTS, the pinned tsgo (native Go), and
// official tsc on the same projects with --extendedDiagnostics, and report
// per-phase time + memory side by side with TSTS÷tsgo and TSTS÷tsc ratios.
//
// All three expose --extendedDiagnostics (Files/Lines/Parse/Bind/Check/Emit/
// Memory) and --generateCpuProfile, so this is orchestration over built-ins.
// Memory is also captured externally via /usr/bin/time -v (maxRSS), since TSTS's
// own statistics.ts does not yet populate "Memory used" (a porter-tracked unit).
//
// Usage:
//   node bench.mjs [--corpus <corpus.json>] [--runs N] [--profile] [--json]
//
// corpus.json: { "projects": [ { "name": "zod", "cwd": "/abs/path", "args": ["-p","tsconfig.json","--noEmit"] }, ... ] }
// Compiler paths (override via env):
//   TSTS = node <repo>/packages/tsts/dist/src/cli/index.js   (computed)
//   TSGO_BIN  (default /tmp/tsgo)        — skipped if missing
//   TSC_BIN   (default <repo>/node_modules/.bin/tsc)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const tstsCli = join(repoRoot, "packages/tsts/dist/src/cli/index.js");
const tsgoBin = process.env.TSGO_BIN || "/tmp/tsgo";
const tscBin = process.env.TSC_BIN || join(repoRoot, "node_modules/.bin/tsc");

const COMPILERS = [
  { id: "tsts", argv: ["node", tstsCli], available: existsSync(tstsCli) },
  { id: "tsgo", argv: [tsgoBin], available: existsSync(tsgoBin) },
  { id: "tsc", argv: [tscBin], available: existsSync(tscBin) },
];

const PHASES = ["Parse", "Bind", "Check", "Emit"];

function parseArgs(argv) {
  const o = { corpus: "", runs: 3, profile: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--corpus") o.corpus = argv[++i];
    else if (a === "--runs") o.runs = Math.max(2, Number(argv[++i]));
    else if (a === "--profile") o.profile = true;
    else if (a === "--json") o.json = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return o;
}

function loadCorpus(path) {
  const resolved = path
    ? (isAbsolute(path) ? path : join(process.cwd(), path))
    : join(here, "corpus.json");
  if (!existsSync(resolved)) {
    throw new Error(`No corpus file at ${resolved}. Pass --corpus <file> or create corpus.json (see corpus.example.json).`);
  }
  const corpus = JSON.parse(readFileSync(resolved, "utf8"));
  for (const p of corpus.projects) {
    if (!existsSync(p.cwd)) throw new Error(`Project '${p.name}' cwd does not exist: ${p.cwd}`);
  }
  return corpus;
}

function parsePhases(stdout) {
  const out = {};
  for (const phase of PHASES) {
    const m = new RegExp(`${phase} time:\\s+([\\d.]+)s`).exec(stdout);
    out[phase] = m ? Number(m[1]) : undefined;
  }
  const files = /Files:\s+(\d+)/.exec(stdout);
  const lines = /Lines(?: of \w+)?:\s+(\d+)/.exec(stdout);
  out.Files = files ? Number(files[1]) : undefined;
  out.Lines = lines ? Number(lines[1]) : undefined;
  const mem = /Memory used:\s+(\d+)K/.exec(stdout);
  out.MemReportedKB = mem ? Number(mem[1]) : undefined;
  return out;
}

function parseTimeV(stderr) {
  // The label contains colons ("(h:mm:ss or m:ss)"), so match greedily to the last
  // ": <value>" on the line.
  const wall = /Elapsed \(wall clock\) time[^\n]*:\s+([\d:.]+)/.exec(stderr);
  const user = /User time \(seconds\):\s+([\d.]+)/.exec(stderr);
  const system = /System time \(seconds\):\s+([\d.]+)/.exec(stderr);
  const cpuPercent = /Percent of CPU this job got:\s+(\d+)%/.exec(stderr);
  const rss = /Maximum resident set size \(kbytes\):\s+(\d+)/.exec(stderr);
  let wallSecs;
  if (wall) {
    const parts = wall[1].split(":").map(Number);
    wallSecs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
  }
  const userSecs = user ? Number(user[1]) : undefined;
  const systemSecs = system ? Number(system[1]) : undefined;
  const cpuSecs = userSecs !== undefined && systemSecs !== undefined ? userSecs + systemSecs : undefined;
  return {
    wallSecs,
    userSecs,
    systemSecs,
    cpuSecs,
    cpuPercent: cpuPercent ? Number(cpuPercent[1]) : undefined,
    maxRssKB: rss ? Number(rss[1]) : undefined,
  };
}

function median(xs) {
  const s = xs.filter((x) => x !== undefined).sort((a, b) => a - b);
  if (s.length === 0) return undefined;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function runOnce(compiler, project) {
  // /usr/bin/time -v <compiler argv> <project args> --extendedDiagnostics
  const args = ["-v", ...compiler.argv, ...project.args, "--extendedDiagnostics"];
  const r = spawnSync("/usr/bin/time", args, { cwd: project.cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  const stdout = `${r.stdout || ""}`;
  const stderr = `${r.stderr || ""}`;
  return { ...parsePhases(stdout), ...parseTimeV(stderr) };
}

function benchProject(project, runs) {
  const result = { name: project.name, byCompiler: {} };
  for (const c of COMPILERS) {
    if (!c.available) continue;
    const samples = [];
    for (let i = 0; i < runs; i++) samples.push(runOnce(c, project));
    // Drop the cold first run; aggregate the rest by median.
    const warm = samples.slice(1);
    const agg = {};
    for (const k of [...PHASES, "wallSecs", "userSecs", "systemSecs", "cpuSecs", "cpuPercent", "maxRssKB", "MemReportedKB", "Files", "Lines"]) {
      agg[k] = median(warm.map((s) => s[k]));
    }
    result.byCompiler[c.id] = agg;
  }
  return result;
}

function fmt(v, suffix = "", digits = 2) {
  return v === undefined ? "—" : `${v.toFixed(digits)}${suffix}`;
}
function ratio(a, b) {
  return a === undefined || b === undefined || b === 0 ? "—" : `${(a / b).toFixed(1)}×`;
}

function report(results) {
  console.log(`# tsgo-suite cross-compiler benchmark`);
  const avail = COMPILERS.filter((c) => c.available).map((c) => c.id).join(", ");
  console.log(`compilers: ${avail}\n`);
  for (const r of results) {
    const t = r.byCompiler;
    const lines = t.tsts?.Lines ?? t.tsgo?.Lines ?? t.tsc?.Lines;
    console.log(`## ${r.name}  (${t.tsts?.Files ?? "?"} files, ${lines ?? "?"} lines)`);
    console.log(`| metric | tsgo | tsc | TSTS | TSTS÷tsgo | TSTS÷tsc |`);
    console.log(`|---|---:|---:|---:|---:|---:|`);
    for (const phase of PHASES) {
      console.log(`| ${phase} | ${fmt(t.tsgo?.[phase], "s")} | ${fmt(t.tsc?.[phase], "s")} | ${fmt(t.tsts?.[phase], "s")} | ${ratio(t.tsts?.[phase], t.tsgo?.[phase])} | ${ratio(t.tsts?.[phase], t.tsc?.[phase])} |`);
    }
    console.log(`| **wall** | ${fmt(t.tsgo?.wallSecs, "s")} | ${fmt(t.tsc?.wallSecs, "s")} | ${fmt(t.tsts?.wallSecs, "s")} | ${ratio(t.tsts?.wallSecs, t.tsgo?.wallSecs)} | ${ratio(t.tsts?.wallSecs, t.tsc?.wallSecs)} |`);
    console.log(`| CPU time | ${fmt(t.tsgo?.cpuSecs, "s")} | ${fmt(t.tsc?.cpuSecs, "s")} | ${fmt(t.tsts?.cpuSecs, "s")} | ${ratio(t.tsts?.cpuSecs, t.tsgo?.cpuSecs)} | ${ratio(t.tsts?.cpuSecs, t.tsc?.cpuSecs)} |`);
    console.log(`| CPU utilization | ${fmt(t.tsgo?.cpuPercent, "%", 0)} | ${fmt(t.tsc?.cpuPercent, "%", 0)} | ${fmt(t.tsts?.cpuPercent, "%", 0)} | ${ratio(t.tsts?.cpuPercent, t.tsgo?.cpuPercent)} | ${ratio(t.tsts?.cpuPercent, t.tsc?.cpuPercent)} |`);
    console.log(`| maxRSS (MB) | ${fmt(t.tsgo?.maxRssKB / 1024)} | ${fmt(t.tsc?.maxRssKB / 1024)} | ${fmt(t.tsts?.maxRssKB / 1024)} | ${ratio(t.tsts?.maxRssKB, t.tsgo?.maxRssKB)} | ${ratio(t.tsts?.maxRssKB, t.tsc?.maxRssKB)} |`);
    console.log();
  }
}

function main() {
  const opt = parseArgs(process.argv.slice(2));
  const corpus = loadCorpus(opt.corpus);
  for (const c of COMPILERS) if (!c.available) console.error(`note: ${c.id} not found (${c.argv[c.argv.length - 1]}) — skipping`);
  const results = corpus.projects.map((p) => benchProject(p, opt.runs));
  if (opt.json) {
    console.log(JSON.stringify({ compilers: COMPILERS.filter((c) => c.available).map((c) => c.id), results }, null, 2));
  } else {
    report(results);
  }
  if (opt.profile) {
    // For each project: capture a TSTS CPU profile (compiler's own --generateCpuProfile)
    // and a heap-allocation profile (node --heap-prof), then run the attributor so the
    // per-phase ratios above are explained by the cost-category breakdown.
    const profDir = join(repoRoot, ".tests/profiling");
    mkdirSync(profDir, { recursive: true });
    for (const p of corpus.projects) {
      const cpuName = `${p.name}.cpuprofile`;
      const heapName = `${p.name}.heapprofile`;
      const cpu = join(profDir, cpuName);
      spawnSync("node", ["--cpu-prof", `--cpu-prof-dir=${profDir}`, `--cpu-prof-name=${cpuName}`, tstsCli, ...p.args], { cwd: p.cwd, stdio: "ignore", maxBuffer: 256 * 1024 * 1024 });
      spawnSync("node", ["--heap-prof", `--heap-prof-dir=${profDir}`, `--heap-prof-name=${heapName}`, tstsCli, ...p.args], { cwd: p.cwd, stdio: "ignore", maxBuffer: 256 * 1024 * 1024 });
      const r = spawnSync("node", [join(here, "attribute.mjs"), "--cpu", cpu, "--heap", join(profDir, heapName), "--label", `TSTS ${p.name}`, "--top", "8"], { encoding: "utf8" });
      console.log(r.stdout || r.stderr || "");
    }
  }
}

main();
