const { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } = require("node:fs");
const childProcess = require("node:child_process");
const { basename, dirname, join, relative, resolve } = require("node:path");

const CHECKPOINT_ROOT = process.env.TSONIC_TEST_CHECKPOINT_DIR;
if (!CHECKPOINT_ROOT) {
  // No-op unless explicitly enabled by the test runner.
  // This keeps `npm test` behavior unchanged for normal dev workflows.
  return;
}

const RESUME_MODE = process.env.TSONIC_TEST_RESUME === "1";

function safeSegment(input) {
  return String(input).replaceAll(/[^a-zA-Z0-9@._-]+/g, "_");
}

function getPackageName() {
  try {
    // Mocha runs with CWD set to the workspace package directory.
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg && typeof pkg.name === "string" && pkg.name.length > 0) return pkg.name;
  } catch {
    // ignore
  }
  return basename(process.cwd());
}

const PKG_NAME = safeSegment(getPackageName());
const PKG_DIR = join(CHECKPOINT_ROOT, "mocha", PKG_NAME);
mkdirSync(PKG_DIR, { recursive: true });

const RESULTS_FILE = join(PKG_DIR, `results.${process.pid}.jsonl`);
const SEEN_FILE = join(PKG_DIR, `seen.${process.pid}.jsonl`);
const COMMANDS_FILE = join(PKG_DIR, `commands.${process.pid}.jsonl`);

function appendJsonl(filePath, obj) {
  mkdirSync(dirname(filePath), { recursive: true });
  appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
}

function safeCommandPart(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function formatCommand(file, args) {
  const parts = [safeCommandPart(file)];
  if (Array.isArray(args)) {
    for (const arg of args) {
      parts.push(safeCommandPart(arg));
    }
  }
  return parts.filter((part) => part.length > 0).join(" ");
}

function normalizeArgsOptions(args, options) {
  if (Array.isArray(args)) {
    return { args, options: options ?? {} };
  }
  if (args && typeof args === "object") {
    return { args: [], options: args };
  }
  return { args: [], options: options ?? {} };
}

function logCommandStart(record) {
  console.log(`[proc-start][${PKG_NAME}][${record.kind}] ${record.command}`);
}

function logCommandDone(record) {
  console.log(`[proc-done][${PKG_NAME}][${record.kind}][${record.status}][${formatMs(record.ms)}] ${record.command}`);
}

function appendCommandRecord(record) {
  appendJsonl(COMMANDS_FILE, record);
}

function installChildProcessInstrumentation() {
  const originalSpawnSync = childProcess.spawnSync;
  const originalExecSync = childProcess.execSync;
  const originalExecFileSync = childProcess.execFileSync;

  childProcess.spawnSync = function patchedSpawnSync(file, args, options) {
    const startedAt = Date.now();
    const normalized = normalizeArgsOptions(args, options);
    const command = formatCommand(file, normalized.args);
    const cwd =
      normalized.options && typeof normalized.options.cwd === "string" ? normalized.options.cwd : process.cwd();
    const startRecord = {
      phase: "start",
      kind: "spawnSync",
      command,
      cwd,
      ts: new Date().toISOString(),
    };
    appendCommandRecord(startRecord);
    logCommandStart(startRecord);

    const result = originalSpawnSync.apply(this, arguments);
    const ms = Date.now() - startedAt;
    const status =
      result && result.error ? "error" : result && result.status === 0 ? "pass" : "fail";
    const doneRecord = {
      phase: "done",
      kind: "spawnSync",
      command,
      cwd,
      status,
      code: result ? result.status : null,
      signal: result ? result.signal : null,
      ms,
      ts: new Date().toISOString(),
    };
    appendCommandRecord(doneRecord);
    logCommandDone(doneRecord);
    return result;
  };

  childProcess.execSync = function patchedExecSync(command, options) {
    const startedAt = Date.now();
    const cwd = options && typeof options.cwd === "string" ? options.cwd : process.cwd();
    const startRecord = {
      phase: "start",
      kind: "execSync",
      command: safeCommandPart(command),
      cwd,
      ts: new Date().toISOString(),
    };
    appendCommandRecord(startRecord);
    logCommandStart(startRecord);

    try {
      const result = originalExecSync.apply(this, arguments);
      const doneRecord = {
        phase: "done",
        kind: "execSync",
        command: safeCommandPart(command),
        cwd,
        status: "pass",
        ms: Date.now() - startedAt,
        ts: new Date().toISOString(),
      };
      appendCommandRecord(doneRecord);
      logCommandDone(doneRecord);
      return result;
    } catch (error) {
      const doneRecord = {
        phase: "done",
        kind: "execSync",
        command: safeCommandPart(command),
        cwd,
        status: "fail",
        ms: Date.now() - startedAt,
        ts: new Date().toISOString(),
      };
      appendCommandRecord(doneRecord);
      logCommandDone(doneRecord);
      throw error;
    }
  };

  childProcess.execFileSync = function patchedExecFileSync(file, args, options) {
    const startedAt = Date.now();
    const normalized = normalizeArgsOptions(args, options);
    const command = formatCommand(file, normalized.args);
    const cwd =
      normalized.options && typeof normalized.options.cwd === "string" ? normalized.options.cwd : process.cwd();
    const startRecord = {
      phase: "start",
      kind: "execFileSync",
      command,
      cwd,
      ts: new Date().toISOString(),
    };
    appendCommandRecord(startRecord);
    logCommandStart(startRecord);

    try {
      const result = originalExecFileSync.apply(this, arguments);
      const doneRecord = {
        phase: "done",
        kind: "execFileSync",
        command,
        cwd,
        status: "pass",
        ms: Date.now() - startedAt,
        ts: new Date().toISOString(),
      };
      appendCommandRecord(doneRecord);
      logCommandDone(doneRecord);
      return result;
    } catch (error) {
      const doneRecord = {
        phase: "done",
        kind: "execFileSync",
        command,
        cwd,
        status: "fail",
        ms: Date.now() - startedAt,
        ts: new Date().toISOString(),
      };
      appendCommandRecord(doneRecord);
      logCommandDone(doneRecord);
      throw error;
    }
  };
}

function testId(test) {
  const title = typeof test.fullTitle === "function" ? test.fullTitle() : String(test.title ?? "");
  // `test.file` is typically set; include it when available to avoid collisions.
  const file = typeof test.file === "string" && test.file.length > 0 ? relative(process.cwd(), test.file) : "";
  return file ? `${file}::${title}` : title;
}

function readPassSet() {
  const pass = new Set();
  if (!RESUME_MODE) return pass;
  if (!existsSync(PKG_DIR)) return pass;

  const files = readdirSync(PKG_DIR).filter((f) => f.startsWith("results.") && f.endsWith(".jsonl"));
  for (const f of files) {
    const p = join(PKG_DIR, f);
    let text = "";
    try {
      text = readFileSync(p, "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n")) {
      if (!line) continue;
      try {
        const rec = JSON.parse(line);
        if (rec && rec.status === "pass" && typeof rec.id === "string") pass.add(rec.id);
      } catch {
        // ignore malformed line
      }
    }
  }
  return pass;
}

const PASS_SET = readPassSet();
installChildProcessInstrumentation();

function formatMs(ms) {
  const value = Number.isFinite(ms) ? Math.max(0, Math.trunc(ms)) : 0;
  return `${value}ms`;
}

function isGoldenTest(test) {
  return typeof test.file === "string" && /golden-shard-\d+\.test\./.test(test.file);
}

function testKind(test) {
  return isGoldenTest(test) ? "golden" : "regular";
}

function logTiming(test, status) {
  const id = testId(test);
  const duration = formatMs(test.duration ?? 0);
  const kind = testKind(test);
  console.log(`[done][${PKG_NAME}][${status}][${duration}][${kind}] ${id}`);
}

function logStart(test) {
  const id = testId(test);
  const kind = testKind(test);
  console.log(`[start][${PKG_NAME}][${kind}] ${id}`);
}

exports.mochaHooks = {
  beforeEach() {
    const t = this.currentTest;
    if (!t) return;

    const id = testId(t);
    const title = typeof t.fullTitle === "function" ? t.fullTitle() : String(t.title ?? "");
    const file = typeof t.file === "string" && t.file.length > 0 ? relative(process.cwd(), t.file) : "";
    const kind = testKind(t);
    appendJsonl(SEEN_FILE, { id, title, file, kind, packageName: PKG_NAME, ts: new Date().toISOString() });

    if (RESUME_MODE && PASS_SET.has(id)) {
      appendJsonl(RESULTS_FILE, {
        id,
        title,
        file,
        kind,
        packageName: PKG_NAME,
        status: "skip",
        reason: "cached-pass",
        ts: new Date().toISOString(),
      });
      this.skip();
    }

    logStart(t);
  },

  afterEach() {
    const t = this.currentTest;
    if (!t) return;

    const id = testId(t);
    const title = typeof t.fullTitle === "function" ? t.fullTitle() : String(t.title ?? "");
    const file = typeof t.file === "string" && t.file.length > 0 ? relative(process.cwd(), t.file) : "";
    const kind = testKind(t);
    if (t.state === "passed") {
      appendJsonl(RESULTS_FILE, {
        id,
        title,
        file,
        kind,
        packageName: PKG_NAME,
        status: "pass",
        ms: t.duration ?? null,
        ts: new Date().toISOString(),
      });
      logTiming(t, "pass");
    } else if (t.state === "failed") {
      appendJsonl(RESULTS_FILE, {
        id,
        title,
        file,
        kind,
        packageName: PKG_NAME,
        status: "fail",
        ms: t.duration ?? null,
        ts: new Date().toISOString(),
      });
      logTiming(t, "fail");
    }
  },
};
