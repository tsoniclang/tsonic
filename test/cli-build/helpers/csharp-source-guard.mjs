import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { testRepositoryRoots } from "../../scripts/workspace-layout.mjs";

let scanner;

export function assertCsharpSourceClosure(files) {
  assert.notEqual(files.length, 0);
  const sourceFiles = files.filter(file => file.endsWith(".cs"));
  if (sourceFiles.length > 0) {
    if (scanner === undefined) {
      const scratch = join(testRepositoryRoots.tsonic, ".temp", "source-guard");
      mkdirSync(scratch, { recursive: true });
      const directory = mkdtempSync(join(scratch, "worker-"));
      const output = join(directory, "bin");
      const build = spawnSync("dotnet", ["build",
        join(testRepositoryRoots.csharpJs, "tools/source-guard/SourceGuard.csproj"),
        "--nologo", "--verbosity", "quiet", "--disable-build-servers", "-o", output,
        `-p:BaseIntermediateOutputPath=${join(directory, "obj")}/`,
      ], { encoding: "utf8", timeout: 120_000, maxBuffer: 4_194_304 });
      assert.equal(build.status, 0, build.error?.message ?? build.stdout + build.stderr);
      scanner = join(output, "SourceGuard.dll");
    }
    const result = spawnSync("dotnet", [scanner], {
      input: JSON.stringify(sourceFiles), encoding: "utf8", timeout: 120_000, maxBuffer: 4_194_304,
    });
    assert.equal(result.status, 0, result.error?.message ?? result.stdout + result.stderr);
  }
  for (const file of files.filter(file => !file.endsWith(".cs"))) {
    const text = readFileSync(file, "utf8");
    for (const name of ["dynamic", "System.Reflection", "GetProperty", "GetProperties", "GetMethod", "GetMethods", "MethodInfo.Invoke", "MakeGenericMethod", "Activator.CreateInstance", "Assembly.Load"]) {
      assert.doesNotMatch(text, new RegExp(`\\b${name.replaceAll(".", "\\.")}\\b`, "u"), `${file} contains forbidden runtime configuration ${name}`);
    }
  }
}
