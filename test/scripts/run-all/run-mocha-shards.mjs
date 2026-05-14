#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";

const packageCatalog = [
  {
    key: "frontend",
    prefix: "FRONTEND",
    label: "Frontend Tests",
    packageName: "@tsonic/frontend",
    dir: "packages/frontend",
    mochaArgs: ["--timeout", "10000"],
    serialMochaArgs: ["--parallel", "--timeout", "10000"],
  },
  {
    key: "backend",
    prefix: "BACKEND",
    label: "Backend Tests",
    packageName: "@tsonic/backend",
    dir: "packages/backend",
    mochaArgs: [],
    serialMochaArgs: ["--parallel"],
  },
  {
    key: "emitter",
    prefix: "EMITTER",
    label: "Emitter Tests",
    packageName: "@tsonic/emitter",
    dir: "packages/emitter",
    mochaArgs: ["--timeout", "45000"],
    serialMochaArgs: ["--parallel", "--jobs", "4", "--timeout", "45000"],
  },
  {
    key: "cli",
    prefix: "CLI",
    label: "CLI Tests",
    packageName: "@tsonic/cli",
    dir: "packages/cli",
    mochaArgs: [],
    serialMochaArgs: ["--parallel"],
  },
];

function printUsage() {
  console.error(
    [
      "Usage: run-mocha-shards.mjs --root <repo> --cache <cache> --summary-shell <file> [options]",
      "",
      "Options:",
      "  --packages <csv>      Package keys to run (frontend,backend,emitter,cli).",
      "  --concurrency <n>     Maximum concurrent Mocha shard processes.",
      "  --test-shard-threshold <n>",
      "                       Split leaf files with at least this many tests into per-title shards.",
      "  --file-shard-ms <n>   Split leaf files whose estimated runtime is at least this many ms.",
      "  --heavy-timeout-ms <n>",
      "                       Minimum Mocha timeout for heavy/compiler shards.",
      "  --heavy-timeout-shard-ms <n>",
      "                       Estimated shard runtime that receives the heavy timeout.",
      "  --resume <0|1>        Reuse checkpoint pass records.",
      "  --validate-only       Validate manifests and exit before running shards.",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    cache: undefined,
    summaryShell: undefined,
    packages: packageCatalog.map((packageConfig) => packageConfig.key),
    concurrency: undefined,
    testShardThreshold: Number(
      process.env.TSONIC_UNIT_TEST_SHARD_THRESHOLD ?? 50
    ),
    fileShardMs: Number(process.env.TSONIC_UNIT_FILE_SHARD_MS ?? 30000),
    heavyTimeoutMs: Number(process.env.TSONIC_UNIT_HEAVY_TIMEOUT_MS ?? 300000),
    heavyTimeoutShardMs: Number(
      process.env.TSONIC_UNIT_HEAVY_TIMEOUT_SHARD_MS ?? 10000
    ),
    resume: false,
    validateOnly: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--root":
        options.root = argv[++index];
        break;
      case "--cache":
        options.cache = argv[++index];
        break;
      case "--summary-shell":
        options.summaryShell = argv[++index];
        break;
      case "--packages":
        options.packages = String(argv[++index] ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        break;
      case "--concurrency":
        options.concurrency = Number(argv[++index]);
        break;
      case "--test-shard-threshold":
        options.testShardThreshold = Number(argv[++index]);
        break;
      case "--file-shard-ms":
        options.fileShardMs = Number(argv[++index]);
        break;
      case "--heavy-timeout-ms":
        options.heavyTimeoutMs = Number(argv[++index]);
        break;
      case "--heavy-timeout-shard-ms":
        options.heavyTimeoutShardMs = Number(argv[++index]);
        break;
      case "--resume":
        options.resume = String(argv[++index] ?? "0") === "1";
        break;
      case "--validate-only":
        options.validateOnly = true;
        break;
      case "-h":
      case "--help":
        printUsage();
        process.exit(0);
      default:
        console.error(`FAIL: unknown argument: ${arg}`);
        printUsage();
        process.exit(2);
    }
  }

  if (!options.cache || !options.summaryShell) {
    printUsage();
    process.exit(2);
  }

  const hardwareConcurrency =
    typeof availableParallelism === "function"
      ? availableParallelism()
      : cpus().length;
  if (!Number.isInteger(options.concurrency) || options.concurrency <= 0) {
    options.concurrency = Math.max(1, Math.ceil(hardwareConcurrency * 0.75));
  }
  if (
    !Number.isInteger(options.testShardThreshold) ||
    options.testShardThreshold <= 1
  ) {
    options.testShardThreshold = 2;
  }
  if (!Number.isFinite(options.fileShardMs) || options.fileShardMs < 0) {
    options.fileShardMs = 30000;
  }
  if (!Number.isFinite(options.heavyTimeoutMs) || options.heavyTimeoutMs < 0) {
    options.heavyTimeoutMs = 300000;
  }
  if (
    !Number.isFinite(options.heavyTimeoutShardMs) ||
    options.heavyTimeoutShardMs < 0
  ) {
    options.heavyTimeoutShardMs = 10000;
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const rootDir = resolve(options.root);
const cacheDir = resolve(options.cache);
const summaryShellPath = resolve(options.summaryShell);
const mochaBin = join(rootDir, "node_modules", "mocha", "bin", "mocha.js");
const checkpointPath = join(rootDir, "test", "mocha", "checkpoint.cjs");
const reporterPath = join(rootDir, "test", "mocha", "progress-reporter.cjs");
const traceFile = process.env.TSONIC_TEST_TRACE_FILE;
const runId = process.env.TSONIC_TEST_RUN_ID;

process.stdout.setMaxListeners(0);
process.stderr.setMaxListeners(0);

const selectedPackages = options.packages.map((key) => {
  const packageConfig = packageCatalog.find((entry) => entry.key === key);
  if (!packageConfig) {
    throw new Error(`Unknown package key: ${key}`);
  }
  return packageConfig;
});
const timingInfo = loadTimingEstimates(selectedPackages);

function toPosix(value) {
  return value.split(sep).join("/");
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function nowMs() {
  return Date.now();
}

function formatDurationMs(totalMs) {
  const normalizedMs = Math.max(0, Math.trunc(Number(totalMs) || 0));
  if (normalizedMs < 1000) return `${normalizedMs}ms`;

  const totalSeconds = Math.trunc(normalizedMs / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.trunc(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.trunc(totalMinutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${totalSeconds}.${String(normalizedMs % 1000).padStart(3, "0")}s`;
}

function escapeRegExp(value) {
  return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
}

function packageTraceNames(packageConfig) {
  return new Set([
    packageConfig.packageName,
    packageConfig.packageName.replace("/", "_"),
    packageConfig.packageName.replaceAll(/[^a-zA-Z0-9@._-]+/g, "_"),
  ]);
}

function appendTrace(record) {
  if (!traceFile || !runId) return;
  mkdirSync(dirname(traceFile), { recursive: true });
  appendFileSync(
    traceFile,
    `${JSON.stringify({
      runId,
      ts: new Date().toISOString(),
      ...record,
    })}\n`,
    "utf8"
  );
}

function walkFiles(dir, output = []) {
  if (!existsSync(dir)) return output;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const filePath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(filePath, output);
    } else if (entry.isFile()) {
      output.push(filePath);
    }
  }
  return output;
}

function isIgnoredCaseFile(packageRelativePath) {
  return /^dist\/.*-cases\/.*\.test\.js$/.test(toPosix(packageRelativePath));
}

function serialEntries(packageConfig) {
  const packageRoot = join(rootDir, packageConfig.dir);
  const distRoot = join(packageRoot, "dist");
  return walkFiles(distRoot)
    .filter((filePath) => filePath.endsWith(".test.js"))
    .filter((filePath) => !isIgnoredCaseFile(relative(packageRoot, filePath)))
    .sort((left, right) =>
      toPosix(relative(packageRoot, left)).localeCompare(
        toPosix(relative(packageRoot, right))
      )
    );
}

function stripLocalTestBody(text) {
  return text
    .replace(/^\s*import\s+[^\n]*$/gm, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function testImports(filePath) {
  const text = readFileSync(filePath, "utf8");
  const imports = [];
  const importRegex =
    /^\s*import\s+(?:[^'";]+\s+from\s+)?["'](.+?\.test\.js)["'];?\s*$/gm;

  for (const match of text.matchAll(importRegex)) {
    const specifier = match[1];
    if (!specifier.startsWith(".")) continue;
    const importedPath = resolve(dirname(filePath), specifier);
    if (!existsSync(importedPath)) {
      throw new Error(
        `Test wrapper imports a missing file: ${relative(rootDir, filePath)} -> ${specifier}`
      );
    }
    imports.push(importedPath);
  }

  return {
    imports,
    hasLocalTests: /\b(describe|it)\s*\(/.test(stripLocalTestBody(text)),
  };
}

function expandEntry(filePath, stack = []) {
  const info = testImports(filePath);
  if (info.imports.length === 0) return [filePath];
  if (info.hasLocalTests) {
    throw new Error(
      `Refusing mixed wrapper/local test file: ${relative(rootDir, filePath)}`
    );
  }

  const expanded = [];
  for (const importedPath of info.imports) {
    if (stack.includes(importedPath)) {
      throw new Error(
        `Test wrapper import cycle: ${[...stack, importedPath]
          .map((entry) => relative(rootDir, entry))
          .join(" -> ")}`
      );
    }
    expanded.push(...expandEntry(importedPath, [...stack, filePath]));
  }
  return expanded;
}

function expandedEntries(packageConfig) {
  const packageRoot = join(rootDir, packageConfig.dir);
  const seen = new Set();
  const expanded = [];
  for (const entry of serialEntries(packageConfig)) {
    for (const leaf of expandEntry(entry)) {
      const resolvedLeaf = resolve(leaf);
      if (seen.has(resolvedLeaf)) continue;
      seen.add(resolvedLeaf);
      expanded.push(resolvedLeaf);
    }
  }
  return expanded.sort((left, right) =>
    toPosix(relative(packageRoot, left)).localeCompare(
      toPosix(relative(packageRoot, right))
    )
  );
}

function runMochaDryRun(packageConfig, files, mode) {
  const packageRoot = join(rootDir, packageConfig.dir);
  const args = [
    mochaBin,
    "--dry-run",
    "--reporter",
    "json",
    "--require",
    checkpointPath,
    ...(mode === "serial"
      ? packageConfig.serialMochaArgs
      : packageConfig.mochaArgs),
    ...files.map((filePath) => toPosix(relative(packageRoot, filePath))),
  ];

  const env = { ...process.env };
  delete env.TSONIC_TEST_CHECKPOINT_DIR;
  delete env.TSONIC_TEST_PROGRESS;
  delete env.TSONIC_MOCHA_PROGRESS_REPORTER;
  delete env.TSONIC_TEST_RESUME;

  const result = spawnSync(process.execPath, args, {
    cwd: packageRoot,
    encoding: "utf8",
    env,
    maxBuffer: 256 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const outputDir = join(cacheDir, "mocha-shards-validation");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, `${packageConfig.key}-${mode}.stdout.log`),
      result.stdout ?? "",
      "utf8"
    );
    writeFileSync(
      join(outputDir, `${packageConfig.key}-${mode}.stderr.log`),
      result.stderr ?? "",
      "utf8"
    );
    throw new Error(
      `${packageConfig.key} ${mode} dry-run failed with exit ${result.status}`
    );
  }

  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    const outputDir = join(cacheDir, "mocha-shards-validation");
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, `${packageConfig.key}-${mode}.stdout.log`),
      result.stdout ?? "",
      "utf8"
    );
    throw new Error(
      `${packageConfig.key} ${mode} dry-run did not produce valid JSON: ${error.message}`
    );
  }
}

function multiset(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function compareMultiset(left, right) {
  const missing = [];
  const extra = [];
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort();
  for (const key of keys) {
    const leftCount = left.get(key) ?? 0;
    const rightCount = right.get(key) ?? 0;
    if (leftCount > rightCount) {
      missing.push({ key, count: leftCount - rightCount });
    }
    if (rightCount > leftCount) {
      extra.push({ key, count: rightCount - leftCount });
    }
  }
  return { missing, extra };
}

function testFullTitle(test) {
  return typeof test.fullTitle === "string" ? test.fullTitle : "";
}

function testFileKey(test, packageConfig) {
  const packageRoot = join(rootDir, packageConfig.dir);
  if (typeof test.file !== "string" || test.file.length === 0) return "";
  return toPosix(relative(packageRoot, test.file));
}

function groupTestsByFile(tests, packageConfig) {
  const counts = new Map();
  for (const test of tests) {
    const fileKey = testFileKey(test, packageConfig);
    if (!fileKey) continue;
    const entries = counts.get(fileKey) ?? [];
    entries.push(test);
    counts.set(fileKey, entries);
  }
  return counts;
}

function latestTraceFiles(limit = 8) {
  const testsDir = join(rootDir, ".tests");
  if (!existsSync(testsDir)) return [];
  return readdirSync(testsDir)
    .filter((entry) => /^run-all-.*\.trace\.jsonl$/.test(entry))
    .map((entry) => join(testsDir, entry))
    .sort((left, right) => statSync(left).mtimeMs - statSync(right).mtimeMs)
    .slice(-limit);
}

function loadTimingEstimates(packageConfigs) {
  const packageByTraceName = new Map();
  for (const packageConfig of packageConfigs) {
    for (const traceName of packageTraceNames(packageConfig)) {
      packageByTraceName.set(traceName, packageConfig);
    }
  }

  const estimates = new Map();
  const traceFiles = latestTraceFiles();
  for (const tracePath of traceFiles) {
    let text = "";
    try {
      text = readFileSync(tracePath, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line) continue;
      let record;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (record.event !== "test-done") continue;
      const packageConfig = packageByTraceName.get(
        String(record.packageName ?? record.package ?? "")
      );
      if (!packageConfig) continue;
      if (typeof record.file !== "string" || typeof record.title !== "string") {
        continue;
      }
      const ms = Number(record.ms);
      if (!Number.isFinite(ms) || ms <= 0) continue;
      const key = `${packageConfig.key}\0${record.file}\0${record.title}`;
      estimates.set(key, Math.max(estimates.get(key) ?? 0, ms));
    }
  }

  return { estimates, traceFiles };
}

function timingEstimateMs(timingInfo, packageConfig, relativeFile, title) {
  return (
    timingInfo.estimates.get(
      `${packageConfig.key}\0${relativeFile}\0${title}`
    ) ?? 0
  );
}

function groupTestsByTitle(tests) {
  const groups = new Map();
  for (const test of tests) {
    const title = testFullTitle(test);
    const group = groups.get(title) ?? [];
    group.push(test);
    groups.set(title, group);
  }
  return [...groups.entries()];
}

function isPreShardedLeaf(relativeFile) {
  return /^dist\/golden-shard-\d+\.test\.js$/.test(relativeFile);
}

function isCompilerHeavyPackage(packageConfig) {
  return packageConfig.key === "emitter" || packageConfig.key === "cli";
}

function heavyTimeoutForShard(packageConfig, relativeFile, estimatedMs) {
  if (options.heavyTimeoutMs <= 0) return 0;
  if (isCompilerHeavyPackage(packageConfig)) return options.heavyTimeoutMs;
  if (isPreShardedLeaf(relativeFile)) return options.heavyTimeoutMs;
  if (estimatedMs >= options.heavyTimeoutShardMs) return options.heavyTimeoutMs;
  return 0;
}

function shardValidationKeys(shards) {
  const keys = [];
  for (const shard of shards) {
    for (const title of shard.testTitles) {
      keys.push(`${shard.relativeFile}\0${title}`);
    }
  }
  return keys;
}

function testValidationKeys(tests, packageConfig) {
  return tests.map(
    (test) => `${testFileKey(test, packageConfig)}\0${testFullTitle(test)}`
  );
}

function buildShards(packageConfig, expandedFiles, expandedTests, timingInfo) {
  const testsByFile = groupTestsByFile(expandedTests, packageConfig);
  const shards = [];

  for (const filePath of expandedFiles) {
    const packageRoot = join(rootDir, packageConfig.dir);
    const relativeFile = toPosix(relative(packageRoot, filePath));
    const fileTests = testsByFile.get(relativeFile) ?? [];
    const fileEstimatedMs = fileTests.reduce(
      (sum, test) =>
        sum +
        timingEstimateMs(
          timingInfo,
          packageConfig,
          relativeFile,
          testFullTitle(test)
        ),
      0
    );
    const shouldSplit =
      !isPreShardedLeaf(relativeFile) &&
      fileTests.length > 1 &&
      (fileTests.length >= options.testShardThreshold ||
        fileEstimatedMs >= options.fileShardMs);

    if (!shouldSplit) {
      shards.push({
        packageConfig,
        shardKind: "file",
        relativeFile,
        testCount: fileTests.length,
        estimatedMs: fileEstimatedMs || fileTests.length,
        timeoutMs: heavyTimeoutForShard(
          packageConfig,
          relativeFile,
          fileEstimatedMs
        ),
        testTitles: fileTests.map((test) => testFullTitle(test)),
      });
      continue;
    }

    for (const [title, titleTests] of groupTestsByTitle(fileTests)) {
      const estimatedMs = titleTests.reduce(
        (sum, test) =>
          sum +
          timingEstimateMs(
            timingInfo,
            packageConfig,
            relativeFile,
            testFullTitle(test)
          ),
        0
      );
      shards.push({
        packageConfig,
        shardKind: "test",
        relativeFile,
        fullTitle: title,
        grepPattern: `^${escapeRegExp(title)}$`,
        testCount: titleTests.length,
        estimatedMs: estimatedMs || titleTests.length,
        timeoutMs: heavyTimeoutForShard(
          packageConfig,
          relativeFile,
          estimatedMs
        ),
        testTitles: titleTests.map((test) => testFullTitle(test)),
      });
    }
  }

  return shards;
}

function packageManifest(packageConfig) {
  const serial = serialEntries(packageConfig);
  const expanded = expandedEntries(packageConfig);
  const serialDryRun = runMochaDryRun(packageConfig, serial, "serial");
  const expandedDryRun = runMochaDryRun(packageConfig, expanded, "expanded");
  const shards = buildShards(
    packageConfig,
    expanded,
    expandedDryRun.tests ?? [],
    timingInfo
  );
  const titleDiff = compareMultiset(
    multiset((serialDryRun.tests ?? []).map((test) => test.fullTitle)),
    multiset((expandedDryRun.tests ?? []).map((test) => test.fullTitle))
  );
  const shardDiff = compareMultiset(
    multiset(testValidationKeys(expandedDryRun.tests ?? [], packageConfig)),
    multiset(shardValidationKeys(shards))
  );
  const serialCount = serialDryRun.tests?.length ?? 0;
  const expandedCount = expandedDryRun.tests?.length ?? 0;
  const shardCount = shards.reduce((sum, shard) => sum + shard.testCount, 0);
  const status =
    serialCount === expandedCount &&
    expandedCount === shardCount &&
    titleDiff.missing.length === 0 &&
    titleDiff.extra.length === 0 &&
    shardDiff.missing.length === 0 &&
    shardDiff.extra.length === 0
      ? "ok"
      : "mismatch";

  const validationDir = join(cacheDir, "mocha-shards-validation");
  mkdirSync(validationDir, { recursive: true });
  writeFileSync(
    join(validationDir, `${packageConfig.key}-manifest.json`),
    JSON.stringify(
      {
        packageName: packageConfig.packageName,
        serial: serial.map((filePath) =>
          toPosix(relative(join(rootDir, packageConfig.dir), filePath))
        ),
        expanded: expanded.map((filePath) =>
          toPosix(relative(join(rootDir, packageConfig.dir), filePath))
        ),
        shards: shards.map((shard) => ({
          kind: shard.shardKind,
          file: shard.relativeFile,
          title: shard.fullTitle,
          testCount: shard.testCount,
          estimatedMs: shard.estimatedMs,
          timeoutMs: shard.timeoutMs,
        })),
        serialTests: serialCount,
        expandedTests: expandedCount,
        shardTests: shardCount,
        missingTitles: titleDiff.missing,
        extraTitles: titleDiff.extra,
        shardMissingTests: shardDiff.missing,
        shardExtraTests: shardDiff.extra,
      },
      null,
      2
    ),
    "utf8"
  );

  if (status !== "ok") {
    writeFileSync(
      join(validationDir, `${packageConfig.key}-title-diff.json`),
      JSON.stringify({ titleDiff, shardDiff }, null, 2),
      "utf8"
    );
  }

  return {
    packageConfig,
    serial,
    expanded,
    serialCount,
    expandedCount,
    shardCount,
    titleDiff,
    shardDiff,
    status,
    shards,
  };
}

function printTable(title, columns, rows) {
  const widths = columns.map((column, columnIndex) =>
    Math.max(
      column.label.length,
      ...rows.map((row) => String(row[columnIndex] ?? "").length)
    )
  );
  const formatRow = (values) =>
    values
      .map((value, columnIndex) =>
        String(value ?? "").padEnd(widths[columnIndex])
      )
      .join("  ");

  console.log(title);
  console.log(formatRow(columns.map((column) => column.label)));
  console.log(
    formatRow(columns.map((_, columnIndex) => "-".repeat(widths[columnIndex])))
  );
  for (const row of rows) {
    console.log(formatRow(row));
  }
  console.log("");
}

function writeSummaryShell(packageStates) {
  mkdirSync(dirname(summaryShellPath), { recursive: true });
  const lines = ["# Generated by test/scripts/run-all/run-mocha-shards.mjs"];

  for (const packageConfig of selectedPackages) {
    const state = packageStates.get(packageConfig.key);
    const status = state?.status ?? "failed";
    const durationMs = state?.durationMs ?? 0;
    lines.push(`${packageConfig.prefix}_STATUS=${shellQuote(status)}`);
    lines.push(
      `${packageConfig.prefix}_DURATION_MS=${Math.max(0, Math.trunc(durationMs))}`
    );
  }

  writeFileSync(summaryShellPath, `${lines.join("\n")}\n`, "utf8");
}

function appendBoundedOutput(current, chunk, maxLength = 1024 * 1024) {
  const next = `${current}${chunk}`;
  return next.length > maxLength ? next.slice(next.length - maxLength) : next;
}

function hardTimeoutForShard(job) {
  if (!job.timeoutMs || job.timeoutMs <= 0) {
    return 15 * 60 * 1000;
  }

  return Math.max(job.timeoutMs * 4, job.timeoutMs + 5 * 60 * 1000);
}

function spawnShard(job, packageStates) {
  const packageConfig = job.packageConfig;
  const packageRoot = join(rootDir, packageConfig.dir);
  const packageState = packageStates.get(packageConfig.key);
  if (!packageState.startedAt) {
    packageState.startedAt = nowMs();
  }

  const hardTimeoutMs = hardTimeoutForShard(job);

  appendTrace({
    event: "shard-start",
    scope: "test-shard",
    package: packageConfig.packageName,
    label: packageConfig.label,
    file: job.relativeFile,
    shardKind: job.shardKind,
    title: job.fullTitle ?? "",
    testCount: String(job.testCount),
    estimatedMs: String(job.estimatedMs ?? 0),
    timeoutMs: String(job.timeoutMs ?? 0),
    hardTimeoutMs: String(hardTimeoutMs),
  });

  const args = [
    mochaBin,
    "--require",
    checkpointPath,
    ...packageConfig.mochaArgs,
    ...(job.timeoutMs > 0 ? ["--timeout", String(job.timeoutMs)] : []),
    "--reporter",
    reporterPath,
    ...(job.grepPattern ? ["--grep", job.grepPattern] : []),
    job.relativeFile,
  ];

  const child = spawn(process.execPath, args, {
    cwd: packageRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      TSONIC_TEST_CHECKPOINT_DIR: cacheDir,
      TSONIC_TEST_PROGRESS: "0",
      TSONIC_TEST_FAILURE_DETAILS: "1",
      TSONIC_TEST_TIMEOUT_MS: job.timeoutMs > 0 ? String(job.timeoutMs) : "",
      TSONIC_MOCHA_PROGRESS_REPORTER: "1",
      TSONIC_TEST_RESUME: options.resume ? "1" : "0",
      TSONIC_TEST_TRACE_FILE: traceFile ?? "",
      TSONIC_TEST_RUN_ID: runId ?? "",
    },
  });

  let stdout = "";
  let stderr = "";
  let timedOut = false;
  let killTimer;
  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    killTimer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 10_000);
  }, hardTimeoutMs);

  child.stdout.on("data", (chunk) => {
    stdout = appendBoundedOutput(stdout, chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr = appendBoundedOutput(stderr, chunk);
  });

  return new Promise((resolveJob) => {
    child.on("close", (code, signal) => {
      clearTimeout(timeoutTimer);
      if (killTimer) {
        clearTimeout(killTimer);
      }

      const status = code === 0 && !timedOut ? "passed" : "failed";
      if (status === "failed") packageState.failedShards += 1;
      packageState.completedShards += 1;
      packageState.durationMs = nowMs() - packageState.startedAt;
      appendTrace({
        event: "shard-done",
        scope: "test-shard",
        package: packageConfig.packageName,
        label: packageConfig.label,
        file: job.relativeFile,
        shardKind: job.shardKind,
        title: job.fullTitle ?? "",
        status,
        code: String(code ?? ""),
        signal: signal ?? "",
        timedOut: timedOut ? "true" : "false",
        durationMs: String(packageState.durationMs),
      });
      if (status === "failed") {
        console.error(
          `[parallel-shard:failed] package=${packageConfig.packageName} file=${job.relativeFile} title=${job.fullTitle ?? ""}`
        );
        if (timedOut) {
          console.error(
            `[parallel-shard:timeout] hardTimeoutMs=${hardTimeoutMs}`
          );
        }
        if (stdout.trim()) {
          console.error("--- shard stdout ---");
          process.stderr.write(stdout.endsWith("\n") ? stdout : `${stdout}\n`);
        }
        if (stderr.trim()) {
          console.error("--- shard stderr ---");
          process.stderr.write(stderr.endsWith("\n") ? stderr : `${stderr}\n`);
        }
      }
      resolveJob(status === "passed");
    });
  });
}

async function runJobs(jobs, packageStates) {
  let nextJobIndex = 0;
  let activeCount = 0;
  let failed = false;

  await new Promise((resolveAll) => {
    const launchMore = () => {
      while (activeCount < options.concurrency && nextJobIndex < jobs.length) {
        const job = jobs[nextJobIndex];
        nextJobIndex += 1;
        activeCount += 1;
        spawnShard(job, packageStates).then((passed) => {
          if (!passed) failed = true;
          activeCount -= 1;
          launchMore();
        });
      }

      if (activeCount === 0 && nextJobIndex >= jobs.length) {
        resolveAll();
      }
    };

    launchMore();
  });

  return !failed;
}

function packageStatusFromState(state) {
  if (!state) return "failed";
  if (state.failedShards > 0) return "failed";
  if (state.completedShards !== state.totalShards) return "failed";
  return "passed";
}

async function main() {
  if (!existsSync(mochaBin)) {
    throw new Error(`Mocha binary not found: ${mochaBin}`);
  }

  const manifests = selectedPackages.map((packageConfig) =>
    packageManifest(packageConfig)
  );

  printTable(
    "Parallel Unit Manifest Validation",
    [
      { label: "Package" },
      { label: "Serial Files" },
      { label: "Leaf Files" },
      { label: "Run Shards" },
      { label: "Serial Tests" },
      { label: "Leaf Tests" },
      { label: "Shard Tests" },
      { label: "Missing" },
      { label: "Extra" },
      { label: "Status" },
    ],
    manifests.map((manifest) => [
      manifest.packageConfig.key,
      manifest.serial.length,
      manifest.expanded.length,
      manifest.shards.length,
      manifest.serialCount,
      manifest.expandedCount,
      manifest.shardCount,
      manifest.titleDiff.missing.length + manifest.shardDiff.missing.length,
      manifest.titleDiff.extra.length + manifest.shardDiff.extra.length,
      manifest.status,
    ])
  );

  const mismatches = manifests.filter(
    (manifest) => manifest.status === "mismatch"
  );
  if (mismatches.length > 0) {
    const packageStates = new Map(
      selectedPackages.map((packageConfig) => [
        packageConfig.key,
        {
          status: "failed",
          durationMs: 0,
          failedShards: 1,
          completedShards: 0,
          totalShards: 0,
        },
      ])
    );
    writeSummaryShell(packageStates);
    throw new Error(
      `Parallel manifest validation failed for: ${mismatches
        .map((manifest) => manifest.packageConfig.key)
        .join(", ")}`
    );
  }

  if (options.validateOnly) {
    return;
  }

  const packageStates = new Map();
  const jobs = [];
  for (const manifest of manifests) {
    const packageConfig = manifest.packageConfig;
    packageStates.set(packageConfig.key, {
      status: "running",
      durationMs: 0,
      startedAt: 0,
      completedShards: 0,
      failedShards: 0,
      totalShards: manifest.shards.length,
      expectedTests: manifest.expandedCount,
    });

    appendTrace({
      event: "phase-start",
      scope: "package",
      package: packageConfig.packageName,
      label: packageConfig.label,
      concurrency: String(options.concurrency),
      shards: String(manifest.shards.length),
      expectedTests: String(manifest.expandedCount),
    });

    for (const shard of manifest.shards) {
      jobs.push({
        ...shard,
        packageConfig,
      });
    }
  }

  jobs.sort((left, right) => {
    if ((right.estimatedMs ?? 0) !== (left.estimatedMs ?? 0)) {
      return (right.estimatedMs ?? 0) - (left.estimatedMs ?? 0);
    }
    if (right.testCount !== left.testCount)
      return right.testCount - left.testCount;
    if (left.packageConfig.key !== right.packageConfig.key) {
      return left.packageConfig.key.localeCompare(right.packageConfig.key);
    }
    return left.relativeFile.localeCompare(right.relativeFile);
  });

  console.log(`Parallel unit shard concurrency: ${options.concurrency}`);
  console.log(`Parallel unit shard count: ${jobs.length}`);
  console.log("");

  const passed = await runJobs(jobs, packageStates);

  for (const packageConfig of selectedPackages) {
    const state = packageStates.get(packageConfig.key);
    state.status = packageStatusFromState(state);
    state.durationMs = state.startedAt ? nowMs() - state.startedAt : 0;
    appendTrace({
      event: "phase-done",
      scope: "package",
      package: packageConfig.packageName,
      label: packageConfig.label,
      status: state.status,
      wallMs: String(state.durationMs),
      shards: String(state.totalShards),
      failedShards: String(state.failedShards),
    });
  }

  writeSummaryShell(packageStates);

  printTable(
    "Parallel Unit Shard Summary",
    [
      { label: "Package" },
      { label: "Shards" },
      { label: "Expected Tests" },
      { label: "Failed Shards" },
      { label: "Wall Duration" },
      { label: "Status" },
    ],
    selectedPackages.map((packageConfig) => {
      const state = packageStates.get(packageConfig.key);
      return [
        packageConfig.key,
        state.totalShards,
        state.expectedTests,
        state.failedShards,
        formatDurationMs(state.durationMs),
        state.status,
      ];
    })
  );

  if (!passed) process.exit(1);
}

main().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exit(1);
});
