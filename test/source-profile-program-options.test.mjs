import assert from "node:assert/strict";
import { mkdir, symlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { createCompilerSession, formatDiagnostics } from "@tsonic/tsts";
import {
  createProgramOptionsForProject,
  parseTsonicProjectConfig,
  resolveProjectPaths,
} from "../packages/host/dist/index.js";
import {
  hasCompilerSourceExport,
  isCompilerSourceFile,
} from "../packages/host/dist/package-contract.js";
import {
  isPathStrictlyWithin,
  isPathWithinOrEqual,
} from "../packages/host/dist/path-relation.js";

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
  const source = compiler.checkSource();
  const fileNames = source.getSourceFiles()
    .map((sourceFile) => source.ast.getFileName(sourceFile))
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
  const source = compiler.checkSource();
  const fileNames = source.getSourceFiles()
    .map((sourceFile) => source.ast.getFileName(sourceFile))
    .filter((fileName) => fileName !== "");
  assert.equal(fileNames.some((fileName) => /\/lib\..*\.d\.ts$/u.test(fileName)), false, `bundled TypeScript lib leaked into product program: ${fileNames.join("\n")}`);
});

test("product program options retain the exact configured root-file set", async () => {
  const projectDirectory = resolve(tempRoot, "explicit-root-files");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await writeFile(resolve(projectDirectory, "src/index.ts"), "export const reachable = 1;\n", "utf8");
  await writeFile(resolve(projectDirectory, "src/unreferenced.ts"), "export const retained = 2;\n", "utf8");
  const project = {
    entryPoint: "index.ts",
    rootFiles: ["index.ts", "unreferenced.ts"],
    rootDir: "src",
    targets: [{ id: "csharp" }],
  };
  const sourceProfilePath = resolve(projectDirectory, "src/.tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
  const created = createProgramOptionsForProject({
    project,
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: [{ path: sourceProfilePath, text: minimalNoLibProfile() }],
  });
  assert.deepEqual(created.rootFilePaths, [
    resolve(projectDirectory, "src/index.ts"),
    resolve(projectDirectory, "src/unreferenced.ts"),
  ]);
  const source = createCompilerSession({ programOptions: created.programOptions }).checkSource();
  const fileNames = source.getSourceFiles().map((sourceFile) => source.ast.getFileName(sourceFile));
  assert.ok(fileNames.includes(resolve(projectDirectory, "src/index.ts").split("\\").join("/")));
  assert.ok(fileNames.includes(resolve(projectDirectory, "src/unreferenced.ts").split("\\").join("/")));
});

test("project config validates root-file syntax without comparing unresolved spellings", () => {
  assert.deepEqual(parseTsonicProjectConfig({
    entryPoint: "./index.ts",
    rootFiles: ["index.ts", "unreferenced.ts"],
    targets: [{ id: "csharp" }],
  }).rootFiles, ["index.ts", "unreferenced.ts"]);
  assert.throws(
    () => parseTsonicProjectConfig({
      entryPoint: "index.ts",
      rootFiles: ["index.ts", "index.ts"],
      targets: [{ id: "csharp" }],
    }),
    /root file 'index\.ts' is declared more than once/u,
  );
});

test("product paths resolve root identity once and reject aliases or escapes", () => {
  const projectFilePath = resolve(tempRoot, "invalid-root-files/tsonic.json");
  assert.deepEqual(resolveProjectPaths({
    project: {
      entryPoint: "./index.ts",
      rootFiles: ["index.ts", "other.ts"],
      rootDir: "src",
      targets: [{ id: "csharp" }],
    },
    projectFilePath,
  }).rootFilePaths, [
    resolve(tempRoot, "invalid-root-files/src/index.ts"),
    resolve(tempRoot, "invalid-root-files/src/other.ts"),
  ]);
  assert.throws(
    () => resolveProjectPaths({
      project: {
        entryPoint: "index.ts",
        rootFiles: ["other.ts"],
        rootDir: "src",
        targets: [{ id: "csharp" }],
      },
      projectFilePath,
    }),
    /rootFiles must contain the resolved entryPoint/u,
  );
  assert.throws(
    () => resolveProjectPaths({
      project: {
        entryPoint: "index.ts",
        rootFiles: ["index.ts", "nested\/..\/index.ts"],
        rootDir: "src",
        targets: [{ id: "csharp" }],
      },
      projectFilePath,
    }),
    /rootFiles must resolve to distinct source paths/u,
  );
  assert.throws(
    () => resolveProjectPaths({
      project: {
        entryPoint: "../outside.ts",
        rootDir: "src",
        targets: [{ id: "csharp" }],
      },
      projectFilePath,
    }),
    /entryPoint must resolve to a source file inside projectRoot/u,
  );
  assert.throws(
    () => resolveProjectPaths({
      project: {
        entryPoint: "index.ts",
        rootFiles: ["index.ts", "../outside.ts"],
        rootDir: "src",
        targets: [{ id: "csharp" }],
      },
      projectFilePath,
    }),
    /rootFiles\[1\] must resolve to a source file inside projectRoot/u,
  );
});

test("host path relations distinguish parent segments from dot-prefixed names", () => {
  const parent = resolve(tempRoot, "path-relation");
  const dotPrefixedChild = resolve(parent, "..cache/index.ts");
  assert.equal(isPathWithinOrEqual(parent, parent), true);
  assert.equal(isPathWithinOrEqual(parent, dotPrefixedChild), true);
  assert.equal(isPathStrictlyWithin(parent, dotPrefixedChild), true);
  assert.equal(isPathStrictlyWithin(parent, parent), false);
  assert.equal(isPathWithinOrEqual(parent, resolve(parent, "../outside.ts")), false);
});

test("source-package exports select only exact available ESM TypeScript paths", () => {
  const packageRoot = resolve(tempRoot, "source-package-contract");
  const sourceFiles = [
    resolve(packageRoot, "src/index.ts"),
    resolve(packageRoot, "src/features/math.mts"),
    resolve(packageRoot, "private.ts"),
    resolve(packageRoot, "src/ignored.tsx"),
    resolve(packageRoot, "src/ignored.cts"),
    resolve(packageRoot, "../outside.ts"),
  ];

  assert.equal(hasCompilerSourceExport(packageRoot, {
    exports: { ".": { import: "./src/index.js" } },
  }, sourceFiles), true);
  assert.equal(hasCompilerSourceExport(packageRoot, {
    exports: { "./features/*.mjs": "./src/features/*.mjs" },
  }, sourceFiles), true);
  assert.equal(hasCompilerSourceExport(packageRoot, {
    exports: { "./features/*.js": "./missing/*.js" },
  }, sourceFiles), false);
  assert.equal(hasCompilerSourceExport(packageRoot, {
    exports: { ".": "../outside.js" },
  }, sourceFiles), false);
  assert.equal(hasCompilerSourceExport(packageRoot, {
    exports: { ".": "./src/ignored.jsx" },
  }, sourceFiles), false);
  assert.equal(hasCompilerSourceExport(packageRoot, {
    exports: { ".": "./src/ignored.cjs" },
  }, sourceFiles), false);
});

test("compiler source-file policy accepts only final ESM TypeScript source", () => {
  assert.deepEqual([
    "index.ts",
    "index.mts",
    "index.d.ts",
    "index.d.mts",
    "index.tsx",
    "index.cts",
    "index.js",
  ].map((fileName) => [fileName, isCompilerSourceFile(fileName)]), [
    ["index.ts", true],
    ["index.mts", true],
    ["index.d.ts", false],
    ["index.d.mts", false],
    ["index.tsx", false],
    ["index.cts", false],
    ["index.js", false],
  ]);
});

test("product program options resolve hoisted source packages and their source dependencies", async () => {
  const workspaceDirectory = resolve(tempRoot, "hoisted-source-packages");
  const projectDirectory = resolve(workspaceDirectory, "packages/app");
  const domainDirectory = resolve(workspaceDirectory, "packages/domain");
  const mathDirectory = resolve(workspaceDirectory, "packages/math");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await mkdir(resolve(domainDirectory, "src"), { recursive: true });
  await mkdir(resolve(mathDirectory, "src"), { recursive: true });
  await mkdir(resolve(workspaceDirectory, "node_modules/@demo"), { recursive: true });
  await writeFile(resolve(projectDirectory, "package.json"), JSON.stringify({
    name: "@demo/app",
    type: "module",
    dependencies: {
      "@demo/domain": "workspace:*",
    },
  }), "utf8");
  await writeFile(resolve(projectDirectory, "src/App.ts"), [
    "import { domainValue } from \"@demo/domain/index.js\";",
    "export const result: number = domainValue;",
    "",
  ].join("\n"), "utf8");
  await writeFile(resolve(domainDirectory, "package.json"), JSON.stringify({
    name: "@demo/domain",
    type: "module",
    exports: {
      "./*.js": "./src/*.js",
      "./package.json": "./package.json",
    },
    dependencies: {
      "@demo/math": "workspace:*",
    },
  }), "utf8");
  await writeFile(resolve(domainDirectory, "src/index.ts"), [
    "import { addOne } from \"@demo/math/index.js\";",
    "export const domainValue: number = addOne(41);",
    "",
  ].join("\n"), "utf8");
  await writeFile(resolve(domainDirectory, "src/ignored.tsx"), "export const ignoredTsx = 1;\n", "utf8");
  await writeFile(resolve(domainDirectory, "src/ignored.cts"), "export const ignoredCts = 1;\n", "utf8");
  await writeFile(resolve(mathDirectory, "package.json"), JSON.stringify({
    name: "@demo/math",
    type: "module",
    exports: {
      "./*.js": "./src/*.js",
      "./package.json": "./package.json",
    },
  }), "utf8");
  await writeFile(resolve(mathDirectory, "src/index.ts"), "export function addOne(value: number): number { return value + 1; }\n", "utf8");
  await symlink(domainDirectory, resolve(workspaceDirectory, "node_modules/@demo/domain"), "dir");
  await symlink(mathDirectory, resolve(workspaceDirectory, "node_modules/@demo/math"), "dir");
  const project = {
    entryPoint: "App.ts",
    rootDir: "src",
    targets: [{ id: "csharp" }],
  };
  const sourceProfilePath = resolve(projectDirectory, "src/.tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
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
  const diagnostics = compiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [], formatDiagnostics(diagnostics, projectDirectory));
  const source = compiler.checkSource();
  const fileNames = source.getSourceFiles()
    .map((sourceFile) => source.ast.getFileName(sourceFile))
    .filter((fileName) => fileName !== "");
  assert.ok(fileNames.includes(resolve(workspaceDirectory, "node_modules/@demo/domain/src/index.ts").split("\\").join("/")));
  assert.ok(fileNames.includes(resolve(workspaceDirectory, "node_modules/@demo/math/src/index.ts").split("\\").join("/")));
  assert.equal(fileNames.some((fileName) => fileName.endsWith("/ignored.tsx")), false);
  assert.equal(fileNames.some((fileName) => fileName.endsWith("/ignored.cts")), false);
  assert.equal(fileNames.some((fileName) => /\/lib\..*\.d\.ts$/u.test(fileName)), false, `bundled TypeScript lib leaked into product program: ${fileNames.join("\n")}`);
});

test("package-contract declaration policy exposes only declared package closure to NodeNext", async () => {
  const projectDirectory = resolve(tempRoot, "package-contract-declarations");
  const sourceDirectory = resolve(projectDirectory, "src");
  await mkdir(sourceDirectory, { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/typed-package/types"), { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/typed-dependency"), { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/unused-package"), { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/@types/leak"), { recursive: true });
  await writeFile(resolve(projectDirectory, "package.json"), JSON.stringify({
    name: "declaration-policy-app",
    type: "module",
    dependencies: {
      "typed-package": "1.0.0",
      "unused-package": "1.0.0",
    },
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/typed-package/package.json"), JSON.stringify({
    name: "typed-package",
    version: "1.0.0",
    type: "module",
    exports: {
      ".": {
        types: "./types/index.d.ts",
        default: "./index.js",
      },
    },
    dependencies: {
      "typed-dependency": "1.0.0",
    },
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/typed-package/types/index.d.ts"), [
    "import type { DependencyValue } from \"typed-dependency\";",
    "export declare const value: DependencyValue;",
    "",
  ].join("\n"), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/typed-dependency/package.json"), JSON.stringify({
    name: "typed-dependency",
    version: "1.0.0",
    type: "module",
    exports: {
      ".": {
        types: "./index.d.ts",
        default: "./index.js",
      },
    },
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/typed-dependency/index.d.ts"), "export type DependencyValue = number;\n", "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/unused-package/package.json"), JSON.stringify({
    name: "unused-package",
    version: "1.0.0",
    types: "./index.d.ts",
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/unused-package/index.d.ts"), "export declare const unused: number;\n", "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/@types/leak/package.json"), JSON.stringify({
    name: "@types/leak",
    version: "1.0.0",
    types: "./index.d.ts",
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/@types/leak/index.d.ts"), "interface String { leakedMember(): void; }\n", "utf8");
  await writeFile(resolve(sourceDirectory, "App.ts"), "import { value } from \"typed-package\";\nexport const result: number = value;\n", "utf8");
  const profilePath = resolve(projectDirectory, ".tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
  const input = {
    project: {
      entryPoint: "./src/App.ts",
      rootDir: ".",
      targets: [{ id: "test" }],
    },
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: [{ path: profilePath, text: minimalNoLibProfile() }],
    sourceDeclarationPolicy: { installedDeclarations: "package-contract" },
  };
  const first = createProgramOptionsForProject(input);
  const second = createProgramOptionsForProject(input);
  assert.deepEqual(first.sourceDeclarationSnapshot, second.sourceDeclarationSnapshot);
  assert.equal(first.sourceDeclarationSnapshot.installedPackages.length, 3);
  assert.equal(first.sourceDeclarationSnapshot.installedDeclarationFileCount, 6);
  await writeFile(resolve(projectDirectory, "node_modules/typed-dependency/index.d.ts"), "export type DependencyValue = string;\n", "utf8");
  const compiler = createCompilerSession({ programOptions: first.programOptions });
  const diagnostics = compiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [], formatDiagnostics(diagnostics, projectDirectory));
  const source = compiler.checkSource();
  const sourceFiles = source.getSourceFiles().map((sourceFile) => source.ast.getFileName(sourceFile));
  assert.ok(sourceFiles.some((fileName) => fileName.endsWith("/node_modules/typed-package/types/index.d.ts")));
  assert.ok(sourceFiles.some((fileName) => fileName.endsWith("/node_modules/typed-dependency/index.d.ts")));
  assert.equal(sourceFiles.some((fileName) => fileName.includes("/unused-package/")), false);
  assert.equal(sourceFiles.some((fileName) => fileName.includes("/@types/leak/")), false);
  const changed = createProgramOptionsForProject(input);
  assert.notEqual(changed.sourceDeclarationSnapshot.fingerprint, first.sourceDeclarationSnapshot.fingerprint);
  const changedCompiler = createCompilerSession({ programOptions: changed.programOptions });
  const changedDiagnostics = changedCompiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.ok(changedDiagnostics.some((diagnostic) => diagnostic.code === 2322), formatDiagnostics(changedDiagnostics, projectDirectory));
});

test("package-contract declaration policy activates only explicitly declared ambient packages", async () => {
  const projectDirectory = resolve(tempRoot, "ambient-package-contract");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/@types/node-example"), { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/@types/leak"), { recursive: true });
  await writeFile(resolve(projectDirectory, "package.json"), JSON.stringify({
    name: "ambient-package-app",
    type: "module",
    devDependencies: {
      "@types/node-example": "1.0.0",
    },
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/@types/node-example/package.json"), JSON.stringify({
    name: "@types/node-example",
    version: "1.0.0",
    types: "./index.d.ts",
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/@types/node-example/index.d.ts"), [
    "declare module \"node:example\" {",
    "  export function read(): string;",
    "}",
    "",
  ].join("\n"), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/@types/leak/package.json"), JSON.stringify({
    name: "@types/leak",
    version: "1.0.0",
    types: "./index.d.ts",
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/@types/leak/index.d.ts"), "interface String { leakedMember(): void; }\n", "utf8");
  await writeFile(resolve(projectDirectory, "src/App.ts"), [
    "import { read } from \"node:example\";",
    "export const value: string = read();",
    "",
  ].join("\n"), "utf8");
  const profilePath = resolve(projectDirectory, ".tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
  const created = createProgramOptionsForProject({
    project: { entryPoint: "./src/App.ts", rootDir: ".", targets: [{ id: "test" }] },
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: [{ path: profilePath, text: minimalNoLibProfile() }],
    sourceDeclarationPolicy: { installedDeclarations: "package-contract" },
  });
  const compiler = createCompilerSession({ programOptions: created.programOptions });
  const diagnostics = compiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [], formatDiagnostics(diagnostics, projectDirectory));
  const source = compiler.checkSource();
  const fileNames = source.getSourceFiles().map((sourceFile) => source.ast.getFileName(sourceFile));
  assert.ok(fileNames.some((fileName) => fileName.endsWith("/@types/node-example/index.d.ts")));
  assert.equal(fileNames.some((fileName) => fileName.endsWith("/@types/leak/index.d.ts")), false);
});

test("package-contract declaration policy hides physically installed undeclared packages", async () => {
  const projectDirectory = resolve(tempRoot, "undeclared-package");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await mkdir(resolve(projectDirectory, "node_modules/hidden-package"), { recursive: true });
  await writeFile(resolve(projectDirectory, "package.json"), JSON.stringify({
    name: "undeclared-package-app",
    type: "module",
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/hidden-package/package.json"), JSON.stringify({
    name: "hidden-package",
    version: "1.0.0",
    types: "./index.d.ts",
  }), "utf8");
  await writeFile(resolve(projectDirectory, "node_modules/hidden-package/index.d.ts"), "export declare const hidden: number;\n", "utf8");
  await writeFile(resolve(projectDirectory, "src/App.ts"), "import { hidden } from \"hidden-package\";\nexport const value = hidden;\n", "utf8");
  const profilePath = resolve(projectDirectory, ".tsonic/source-profiles/test/profile.d.ts").split("\\").join("/");
  const created = createProgramOptionsForProject({
    project: { entryPoint: "./src/App.ts", rootDir: ".", targets: [{ id: "test" }] },
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceProfileFiles: [{ path: profilePath, text: minimalNoLibProfile() }],
    sourceDeclarationPolicy: { installedDeclarations: "package-contract" },
  });
  assert.equal(created.sourceDeclarationSnapshot.installedPackages.length, 0);
  const compiler = createCompilerSession({ programOptions: created.programOptions });
  const diagnostics = compiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 2307), formatDiagnostics(diagnostics, projectDirectory));
});

test("bundled declaration policy roots only explicitly selected TypeScript libraries", async () => {
  const projectDirectory = resolve(tempRoot, "bundled-library-policy");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await writeFile(resolve(projectDirectory, "src/App.ts"), "export const values = new Map<string, number>();\n", "utf8");
  const created = createProgramOptionsForProject({
    project: { entryPoint: "./src/App.ts", rootDir: ".", targets: [{ id: "test" }] },
    projectFilePath: resolve(projectDirectory, "tsonic.json"),
    sourceDeclarationPolicy: { bundledLibraries: ["lib.es2024.d.ts"] },
  });
  assert.deepEqual(created.sourceDeclarationSnapshot.bundledLibraries, ["lib.es2024.d.ts"]);
  assert.ok(created.sourceDeclarationSnapshot.bundledLibraryClosure.includes("lib.es5.d.ts"));
  assert.equal(created.sourceDeclarationSnapshot.bundledLibraryClosure.includes("lib.dom.d.ts"), false);
  const compiler = createCompilerSession({ programOptions: created.programOptions });
  const diagnostics = compiler.getDiagnostics("all").filter((diagnostic) => diagnostic !== undefined);
  assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code), [], formatDiagnostics(diagnostics, projectDirectory));
  const source = compiler.checkSource();
  const fileNames = source.getSourceFiles().map((sourceFile) => source.ast.getFileName(sourceFile));
  assert.ok(fileNames.some((fileName) => fileName.endsWith("/lib.es2024.d.ts")));
  assert.equal(fileNames.some((fileName) => fileName.endsWith("/lib.dom.d.ts")), false);
});

test("bundled declaration policy rejects a canonical-looking unknown library", async () => {
  const projectDirectory = resolve(tempRoot, "unknown-bundled-library");
  await mkdir(resolve(projectDirectory, "src"), { recursive: true });
  await writeFile(resolve(projectDirectory, "src/App.ts"), "export const value = 1;\n", "utf8");
  assert.throws(
    () => createProgramOptionsForProject({
      project: { entryPoint: "./src/App.ts", rootDir: ".", targets: [{ id: "test" }] },
      projectFilePath: resolve(projectDirectory, "tsonic.json"),
      sourceDeclarationPolicy: { bundledLibraries: ["lib.not-real.d.ts"] },
    }),
    /Unknown bundled library 'lib\.not-real\.d\.ts'/u,
  );
});

function minimalNoLibProfile() {
  return [
    "interface Object {}",
    "interface Function {}",
    "interface CallableFunction extends Function {}",
    "interface NewableFunction extends Function {}",
    "interface IArguments {}",
    "interface Boolean {}",
    "interface Number {}",
    "interface RegExp {}",
    "interface String {}",
    "interface Array<T> { readonly length: number; [index: number]: T; }",
  ].join("\n");
}
