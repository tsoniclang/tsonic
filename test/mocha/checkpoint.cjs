const {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
} = require("node:fs");
const childProcess = require("node:child_process");
const { basename, dirname, join, relative, resolve } = require("node:path");

const CHECKPOINT_ROOT = process.env.TSONIC_TEST_CHECKPOINT_DIR;
if (!CHECKPOINT_ROOT) {
  // No-op unless explicitly enabled by the test runner.
  // This keeps `npm test` behavior unchanged for normal dev workflows.
  return;
}

const RESUME_MODE = process.env.TSONIC_TEST_RESUME === "1";
const TRACE_FILE = process.env.TSONIC_TEST_TRACE_FILE;
const RUN_ID = process.env.TSONIC_TEST_RUN_ID;
const TEST_TIMEOUT_MS = Number(process.env.TSONIC_TEST_TIMEOUT_MS ?? 0);
const PROGRESS_ENABLED =
  process.env.TSONIC_TEST_PROGRESS === "1" &&
  process.env.TSONIC_MOCHA_PROGRESS_REPORTER !== "1";

function safeSegment(input) {
  return String(input).replaceAll(/[^a-zA-Z0-9@._-]+/g, "_");
}

function getPackageName() {
  try {
    // Mocha runs with CWD set to the workspace package directory.
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg && typeof pkg.name === "string" && pkg.name.length > 0)
      return pkg.name;
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

function oneLine(value) {
  return String(value ?? "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function progressLine(status, fields) {
  if (!PROGRESS_ENABLED) return;

  const pieces = [
    `[mocha:${status}]`,
    `package=${oneLine(PKG_NAME)}`,
    `kind=${oneLine(fields.kind)}`,
  ];
  if (fields.ms != null) {
    pieces.push(`ms=${oneLine(fields.ms)}`);
  }
  if (fields.file) {
    pieces.push(`file=${oneLine(fields.file)}`);
  }
  if (fields.title) {
    pieces.push(`title=${oneLine(fields.title)}`);
  }

  process.stdout.write(`${pieces.join(" ")}\n`);
}

function appendTrace(event) {
  if (!TRACE_FILE || !RUN_ID) return;
  try {
    appendJsonl(TRACE_FILE, {
      runId: RUN_ID,
      packageName: PKG_NAME,
      pid: process.pid,
      ...event,
    });
  } catch {
    // Trace logging is best-effort and must not affect test execution.
  }
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
  appendTrace({
    event: "subprocess-start",
    scope: "process",
    ...record,
  });
}

function logCommandDone(record) {
  appendTrace({
    event: "subprocess-done",
    scope: "process",
    ...record,
  });
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
      normalized.options && typeof normalized.options.cwd === "string"
        ? normalized.options.cwd
        : process.cwd();
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
      result && result.error
        ? "error"
        : result && result.status === 0
          ? "pass"
          : "fail";
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
    const cwd =
      options && typeof options.cwd === "string" ? options.cwd : process.cwd();
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

  childProcess.execFileSync = function patchedExecFileSync(
    file,
    args,
    options
  ) {
    const startedAt = Date.now();
    const normalized = normalizeArgsOptions(args, options);
    const command = formatCommand(file, normalized.args);
    const cwd =
      normalized.options && typeof normalized.options.cwd === "string"
        ? normalized.options.cwd
        : process.cwd();
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
  const title =
    typeof test.fullTitle === "function"
      ? test.fullTitle()
      : String(test.title ?? "");
  // `test.file` is typically set; include it when available to avoid collisions.
  const file =
    typeof test.file === "string" && test.file.length > 0
      ? relative(process.cwd(), test.file)
      : "";
  return file ? `${file}::${title}` : title;
}

function readPassSet() {
  const pass = new Set();
  if (!RESUME_MODE) return pass;
  if (!existsSync(PKG_DIR)) return pass;

  const files = readdirSync(PKG_DIR).filter(
    (f) => f.startsWith("results.") && f.endsWith(".jsonl")
  );
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
        if (rec && rec.status === "pass" && typeof rec.id === "string")
          pass.add(rec.id);
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
  return (
    typeof test.file === "string" && /golden-shard-\d+\.test\./.test(test.file)
  );
}

function testKind(test) {
  return isGoldenTest(test) ? "golden" : "regular";
}

function logTiming(test, status) {
  const id = testId(test);
  const kind = testKind(test);
  const file =
    typeof test.file === "string" && test.file.length > 0
      ? relative(process.cwd(), test.file)
      : "";
  const title =
    typeof test.fullTitle === "function"
      ? test.fullTitle()
      : String(test.title ?? "");
  const ms = Number.isFinite(test.duration)
    ? Math.max(0, Math.trunc(test.duration))
    : 0;
  appendTrace({
    event: "test-done",
    scope: "test",
    id,
    status,
    kind,
    file,
    title,
    ms,
    ts: new Date().toISOString(),
  });
  progressLine(status, { kind, file, title, ms });
}

function logStart(test) {
  const id = testId(test);
  const kind = testKind(test);
  const file =
    typeof test.file === "string" && test.file.length > 0
      ? relative(process.cwd(), test.file)
      : "";
  const title =
    typeof test.fullTitle === "function"
      ? test.fullTitle()
      : String(test.title ?? "");
  appendTrace({
    event: "test-start",
    scope: "test",
    id,
    kind,
    file,
    title,
    ts: new Date().toISOString(),
  });
  progressLine("start", { kind, file, title });
}

function applyConfiguredTimeout(test) {
  if (!Number.isFinite(TEST_TIMEOUT_MS) || TEST_TIMEOUT_MS <= 0) return;
  if (!test || typeof test.timeout !== "function") return;

  try {
    const current = Number(test.timeout());
    if (!Number.isFinite(current) || current === 0 || current < TEST_TIMEOUT_MS) {
      test.timeout(TEST_TIMEOUT_MS);
    }
  } catch {
    // Timeout tuning is a harness guardrail and must not affect test semantics.
  }
}

exports.mochaHooks = {
  beforeEach() {
    const t = this.currentTest;
    if (!t) return;

    applyConfiguredTimeout(t);

    const id = testId(t);
    const title =
      typeof t.fullTitle === "function" ? t.fullTitle() : String(t.title ?? "");
    const file =
      typeof t.file === "string" && t.file.length > 0
        ? relative(process.cwd(), t.file)
        : "";
    const kind = testKind(t);
    appendJsonl(SEEN_FILE, {
      id,
      title,
      file,
      kind,
      packageName: PKG_NAME,
      ts: new Date().toISOString(),
    });

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
      appendTrace({
        event: "test-done",
        scope: "test",
        id,
        title,
        file,
        kind,
        status: "skip",
        reason: "cached-pass",
        ts: new Date().toISOString(),
      });
      progressLine("skip", { kind, file, title });
      this.skip();
    }

    logStart(t);
  },

  afterEach() {
    const t = this.currentTest;
    if (!t) return;

    const id = testId(t);
    const title =
      typeof t.fullTitle === "function" ? t.fullTitle() : String(t.title ?? "");
    const file =
      typeof t.file === "string" && t.file.length > 0
        ? relative(process.cwd(), t.file)
        : "";
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
