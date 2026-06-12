import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("CLI CommonJS emit qualifies references to named imports", () => {
  const root = mkdtempSync(join(tmpdir(), "tsts-commonjs-import-"));
  const sourceRoot = join(root, "src");
  const outputRoot = join(root, "out");
  mkdirSync(sourceRoot, { recursive: true });
  mkdirSync(outputRoot, { recursive: true });

  writeFileSync(
    join(sourceRoot, "math.ts"),
    [
      "export function add(left: number, right: number): number {",
      "  return left + right;",
      "}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(sourceRoot, "main.ts"),
    [
      'import { add } from "./math";',
      "console.log(add(20, 22));",
      "export const result = add(20, 22);",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          module: "commonjs",
          target: "es2018",
          rootDir: "src",
          outDir: "out",
          noEmitOnError: true,
          strict: true,
        },
        files: ["src/main.ts", "src/math.ts"],
      },
      undefined,
      2,
    ),
  );

  const cli = fileURLToPath(new URL("./index.js", import.meta.url));
  execFileSync(process.execPath, [cli, "-p", join(root, "tsconfig.json"), "--pretty", "false"], {
    cwd: root,
    encoding: "utf8",
    stdio: "pipe",
  });

  const emitted = readFileSync(join(outputRoot, "main.js"), "utf8");
  assert.match(emitted, /const math_1 = require\("\.\/math"\);/);
  assert.doesNotMatch(emitted, /[^.]add\(20, 22\)/);
  assert.match(emitted, /\(0, math_1\.add\)\(20, 22\)/);

  writeFileSync(join(outputRoot, "package.json"), '{"type":"commonjs"}\n');
  const output = execFileSync(process.execPath, [join(outputRoot, "main.js")], {
    cwd: outputRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  assert.equal(output.trim(), "42");
});
