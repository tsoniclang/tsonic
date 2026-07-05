import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createCompilerSession, formatDiagnostics } from "@tsonic/tsts";
import { createProgramOptionsForProject } from "../packages/host/dist/index.js";

const repoRoot = process.cwd();
const tempRoot = resolve(repoRoot, ".temp/test-runs/source-profile-program-options", `${Date.now()}-${process.pid}`);

test("product program options use noLib and target-owned source-profile files", async () => {
  const projectDirectory = resolve(tempRoot, "nolib-profile");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await writeFile(resolve(projectDirectory, "src/App.ts"), "const value = \"abc\";\nvalue.split(\"b\");\n", "utf8");
  const project = {
    entryPoint: "./src/App.ts",
    rootDir: ".",
    targets: [{ id: "csharp" }],
  };
  const sourceProfilePath = resolve(projectDirectory, ".tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
  const created = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: [{
      path: sourceProfilePath,
      text: [
        "interface Object {}",
        "interface Function {}",
        "interface CallableFunction extends Function {}",
        "interface NewableFunction extends Function {}",
        "interface IArguments {}",
        "interface Boolean {}",
        "interface Number {}",
        "interface RegExp {}",
        "interface String { Split(separator: string): string[]; }",
        "interface Array<T> { readonly Length: number; [index: number]: T; }",
      ].join("\n"),
    }],
  });
  const compiler = createCompilerSession({ programOptions: created.programOptions });
  const fileNames = compiler.getSourceFiles()
    .map((sourceFile) => compiler.ast.getFileName(sourceFile))
    .filter((fileName) => fileName !== "");
  assert.ok(fileNames.includes(sourceProfilePath), "source-profile declaration must be a real compiler input");
  assert.equal(fileNames.some((fileName) => /\/lib\..*\.d\.ts$/u.test(fileName)), false, `bundled TypeScript lib leaked into product program: ${fileNames.join("\n")}`);
  const diagnostics = compiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [2551], formatDiagnostics(diagnostics, projectDirectory));
  assert.match(formatDiagnostics(diagnostics, projectDirectory), /Property 'split' does not exist on type '"abc"'\. Did you mean 'Split'\?/u);
});

test("product program options accept relative .ts imports without loading TS default libs", async () => {
  const projectDirectory = resolve(tempRoot, "ts-extension-imports");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await writeFile(resolve(projectDirectory, "src/dep.ts"), "export const value = 41;\n", "utf8");
  await writeFile(resolve(projectDirectory, "src/App.ts"), "import { value } from \"./dep.ts\";\nexport const result = value + 1;\n", "utf8");
  const project = {
    entryPoint: "./src/App.ts",
    rootDir: ".",
    targets: [{ id: "csharp" }],
  };
  const sourceProfilePath = resolve(projectDirectory, ".tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
  const created = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: [{
      path: sourceProfilePath,
      text: [
        "interface Object {}",
        "interface Function {}",
        "interface CallableFunction extends Function {}",
        "interface NewableFunction extends Function {}",
        "interface IArguments {}",
        "interface Boolean {}",
        "interface Number {}",
        "interface RegExp {}",
        "interface String {}",
        "interface Array<T> { readonly Length: number; [index: number]: T; }",
      ].join("\n"),
    }],
  });
  const compiler = createCompilerSession({ programOptions: created.programOptions });
  const diagnostics = compiler.getDiagnostics("all");
  assert.deepEqual(diagnostics.filter((diagnostic) => diagnostic !== undefined).map((diagnostic) => diagnostic.code), []);
  const fileNames = compiler.getSourceFiles()
    .map((sourceFile) => compiler.ast.getFileName(sourceFile))
    .filter((fileName) => fileName !== "");
  assert.equal(fileNames.some((fileName) => /\/lib\..*\.d\.ts$/u.test(fileName)), false, `bundled TypeScript lib leaked into product program: ${fileNames.join("\n")}`);
});
