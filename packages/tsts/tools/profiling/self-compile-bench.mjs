#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../../..");
const tstsCli = join(repoRoot, "packages/tsts/dist/src/cli/index.js");
const tscBin = join(repoRoot, "node_modules/typescript/bin/tsc");

const compilers = [
  { id: "tsts", argv: [process.execPath, tstsCli], available: existsSync(tstsCli) },
  { id: "tsc", argv: [process.execPath, tscBin], available: existsSync(tscBin) },
];

const phases = ["Parse", "Bind", "Check", "Emit"];

function parseArgs(argv) {
  const options = { runs: 3, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs") options.runs = Math.max(2, Number(argv[++i]));
    else if (arg === "--json") options.json = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

function parsePhases(stdout) {
  const result = {};
  for (const phase of phases) {
    const match = new RegExp(`${phase} time:\\s+([\\d.]+)s`).exec(stdout);
    result[phase] = match ? Number(match[1]) : undefined;
  }
  const files = /Files:\s+(\d+)/.exec(stdout);
  const lines = /Lines(?: of \w+)?:\s+(\d+)/.exec(stdout);
  const total = /Total time:\s+([\d.]+)s/.exec(stdout);
  result.Files = files ? Number(files[1]) : undefined;
  result.Lines = lines ? Number(lines[1]) : undefined;
  result.Total = total && Number(total[1]) > 0 ? Number(total[1]) : undefined;
  return result;
}

function parseTime(stderr) {
  const wall = /Elapsed \(wall clock\) time[^\n]*:\s+([\d:.]+)/.exec(stderr);
  const user = /User time \(seconds\):\s+([\d.]+)/.exec(stderr);
  const system = /System time \(seconds\):\s+([\d.]+)/.exec(stderr);
  const cpuPercent = /Percent of CPU this job got:\s+(\d+)%/.exec(stderr);
  const rss = /Maximum resident set size \(kbytes\):\s+(\d+)/.exec(stderr);
  let wallSecs;
  if (wall) {
    const parts = wall[1].split(":").map(Number);
    wallSecs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2]
      : parts.length === 2 ? parts[0] * 60 + parts[1]
        : parts[0];
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

function median(values) {
  const sorted = values.filter((value) => value !== undefined).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function runOnce(compiler) {
  const args = [
    "-v",
    ...compiler.argv,
    "-p",
    "packages/tsts/tsconfig.json",
    "--noEmit",
    "--extendedDiagnostics",
  ];
  const result = spawnSync("/usr/bin/time", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0 || result.signal !== null) {
    const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    throw new Error(`${compiler.id} self-compile failed${result.signal ? ` by ${result.signal}` : ""}:\n${output}`);
  }
  return {
    ...parsePhases(result.stdout || ""),
    ...parseTime(result.stderr || ""),
  };
}

function bench(compiler, runs) {
  const samples = [];
  for (let run = 0; run < runs; run++) {
    samples.push(runOnce(compiler));
  }
  const warm = samples.slice(1);
  const aggregate = {};
  for (const metric of [...phases, "Total", "wallSecs", "userSecs", "systemSecs", "cpuSecs", "cpuPercent", "maxRssKB", "Files", "Lines"]) {
    aggregate[metric] = median(warm.map((sample) => sample[metric]));
  }
  return { samples, aggregate };
}

function fmt(value, suffix = "", digits = 2) {
  return value === undefined ? "—" : `${value.toFixed(digits)}${suffix}`;
}

function ratio(a, b) {
  return a === undefined || b === undefined || b === 0 ? "—" : `${(a / b).toFixed(1)}x`;
}

const options = parseArgs(process.argv.slice(2));
const results = {};
for (const compiler of compilers) {
  if (compiler.available) {
    results[compiler.id] = bench(compiler, options.runs).aggregate;
  }
}

if (!results.tsts) {
  throw new Error(`Missing built TSTS CLI at ${tstsCli}. Run npx tsc -p packages/tsts/tsconfig.json first.`);
}

if (options.json) {
  console.log(JSON.stringify({ runs: options.runs, project: "packages/tsts/tsconfig.json", results }, null, 2));
} else {
  const tsts = results.tsts;
  const tsc = results.tsc;
  console.log(`# TSTS self-compile benchmark`);
  console.log(`project: packages/tsts/tsconfig.json --noEmit`);
  console.log(`runs: ${options.runs} (cold first run dropped, median warm runs)`);
  console.log(`files/lines: ${tsts.Files ?? "?"}/${tsts.Lines ?? "?"}`);
  console.log(`| metric | tsc | TSTS | TSTS÷tsc |`);
  console.log(`|---|---:|---:|---:|`);
  for (const phase of phases) {
    console.log(`| ${phase} | ${fmt(tsc?.[phase], "s")} | ${fmt(tsts[phase], "s")} | ${ratio(tsts[phase], tsc?.[phase])} |`);
  }
  console.log(`| Total diagnostics | ${fmt(tsc?.Total, "s")} | ${fmt(tsts.Total, "s")} | ${ratio(tsts.Total, tsc?.Total)} |`);
  console.log(`| wall | ${fmt(tsc?.wallSecs, "s")} | ${fmt(tsts.wallSecs, "s")} | ${ratio(tsts.wallSecs, tsc?.wallSecs)} |`);
  console.log(`| CPU time | ${fmt(tsc?.cpuSecs, "s")} | ${fmt(tsts.cpuSecs, "s")} | ${ratio(tsts.cpuSecs, tsc?.cpuSecs)} |`);
  console.log(`| CPU utilization | ${fmt(tsc?.cpuPercent, "%", 0)} | ${fmt(tsts.cpuPercent, "%", 0)} | ${ratio(tsts.cpuPercent, tsc?.cpuPercent)} |`);
  console.log(`| maxRSS MB | ${fmt(tsc?.maxRssKB === undefined ? undefined : tsc.maxRssKB / 1024)} | ${fmt(tsts.maxRssKB === undefined ? undefined : tsts.maxRssKB / 1024)} | ${ratio(tsts.maxRssKB, tsc?.maxRssKB)} |`);
}
