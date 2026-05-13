const { readFileSync } = require("node:fs");
const { basename, relative, resolve } = require("node:path");

function safeSegment(input) {
  return String(input).replaceAll(/[^a-zA-Z0-9@._-]+/g, "_");
}

function oneLine(value) {
  return String(value ?? "")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function getPackageName() {
  try {
    const pkgPath = resolve(process.cwd(), "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (pkg && typeof pkg.name === "string" && pkg.name.length > 0) {
      return pkg.name;
    }
  } catch {
    // ignore
  }
  return basename(process.cwd());
}

function testKind(test) {
  return typeof test?.file === "string" &&
    /golden-shard-\d+\.test\./.test(test.file)
    ? "golden"
    : "regular";
}

function testFile(test) {
  return typeof test?.file === "string" && test.file.length > 0
    ? relative(process.cwd(), test.file)
    : "";
}

function testTitle(test) {
  return typeof test?.fullTitle === "function"
    ? test.fullTitle()
    : String(test?.title ?? "");
}

function testDurationMs(test) {
  const duration = Number(test?.duration);
  if (!Number.isFinite(duration)) {
    return undefined;
  }
  return Math.max(0, Math.trunc(duration));
}

function writeProgress(status, test, extraFields = {}) {
  if (process.env.TSONIC_TEST_PROGRESS !== "1") {
    return;
  }

  const pieces = [
    `[mocha:${status}]`,
    `package=${safeSegment(getPackageName())}`,
    `kind=${oneLine(testKind(test))}`,
  ];

  const durationMs = extraFields.ms ?? testDurationMs(test);
  if (durationMs != null) {
    pieces.push(`ms=${oneLine(durationMs)}`);
  }

  const file = testFile(test);
  if (file) {
    pieces.push(`file=${oneLine(file)}`);
  }

  const title = testTitle(test);
  if (title) {
    pieces.push(`title=${oneLine(title)}`);
  }

  if (extraFields.reason) {
    pieces.push(`reason=${oneLine(extraFields.reason)}`);
  }

  process.stdout.write(`${pieces.join(" ")}\n`);
}

function writeFailureDetails(test, error) {
  if (process.env.TSONIC_TEST_FAILURE_DETAILS === "0" || !error) {
    return;
  }

  const pieces = [
    "[mocha:failure]",
    `package=${safeSegment(getPackageName())}`,
  ];

  const file = testFile(test);
  if (file) {
    pieces.push(`file=${oneLine(file)}`);
  }

  const title = testTitle(test);
  if (title) {
    pieces.push(`title=${oneLine(title)}`);
  }

  const message = oneLine(error.message ?? error);
  if (message) {
    pieces.push(`message=${message}`);
  }

  process.stdout.write(`${pieces.join(" ")}\n`);
  if (typeof error.stack === "string" && error.stack.length > 0) {
    process.stdout.write(`${error.stack}\n`);
  }
}

module.exports = class TsonicProgressReporter {
  constructor(runner) {
    runner.once("start", () => {
      process.stdout.write(
        `[mocha:suite-start] package=${safeSegment(getPackageName())}\n`
      );
    });

    runner.once("end", () => {
      const stats = runner.stats ?? {};
      const pieces = [
        "[mocha:suite-end]",
        `package=${safeSegment(getPackageName())}`,
        `tests=${Number(stats.tests ?? 0)}`,
        `passes=${Number(stats.passes ?? 0)}`,
        `failures=${Number(stats.failures ?? 0)}`,
        `pending=${Number(stats.pending ?? 0)}`,
        `duration=${Number(stats.duration ?? 0)}`,
      ];
      process.stdout.write(`${pieces.join(" ")}\n`);
    });

    runner.on("test", (test) => {
      writeProgress("start", test);
    });

    runner.on("pass", (test) => {
      writeProgress("pass", test);
    });

    runner.on("fail", (test, error) => {
      writeProgress("fail", test);
      writeFailureDetails(test, error);
    });

    runner.on("pending", (test) => {
      writeProgress("skip", test, { reason: "pending" });
    });
  }
};
