const { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } = require("node:fs");
const { basename, join, relative, resolve } = require("node:path");

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

function appendJsonl(filePath, obj) {
  appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
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

exports.mochaHooks = {
  beforeEach() {
    const t = this.currentTest;
    if (!t) return;

    const id = testId(t);
    appendJsonl(SEEN_FILE, { id, ts: new Date().toISOString() });

    if (RESUME_MODE && PASS_SET.has(id)) {
      appendJsonl(RESULTS_FILE, { id, status: "skip", reason: "cached-pass", ts: new Date().toISOString() });
      this.skip();
    }
  },

  afterEach() {
    const t = this.currentTest;
    if (!t) return;

    const id = testId(t);
    if (t.state === "passed") {
      appendJsonl(RESULTS_FILE, { id, status: "pass", ms: t.duration ?? null, ts: new Date().toISOString() });
    } else if (t.state === "failed") {
      appendJsonl(RESULTS_FILE, { id, status: "fail", ms: t.duration ?? null, ts: new Date().toISOString() });
    }
  },
};

