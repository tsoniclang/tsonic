import { describe, it } from "mocha";
import { buildTestTimeoutMs } from "./helpers.js";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../../config.js";
import { applyAikyaWorkspaceOverlay } from "../../aikya/bindings.js";
import { buildCommand } from "../build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);
const localJsPackageRoot = resolve(join(repoRoot, "..", "js", "versions", "10"));
const linkedJsPackageRoot = existsSync(localJsPackageRoot)
  ? localJsPackageRoot
  : join(repoRoot, "node_modules/@tsonic/js");

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const readGeneratedCSharpTree = (root: string): string => {
  const chunks: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const nextPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(nextPath);
        continue;
      }
      if (entry.isFile() && nextPath.endsWith(".cs")) {
        chunks.push(readFileSync(nextPath, "utf-8"));
      }
    }
  };

  if (existsSync(root) && statSync(root).isDirectory()) {
    visit(root);
  }
  return chunks.join("\n");
};

const resolveEffectiveConfig = (
  workspaceConfig: Parameters<typeof resolveConfig>[0],
  projectConfig: Parameters<typeof resolveConfig>[1],
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
) => {
  const overlay = applyAikyaWorkspaceOverlay(workspaceRoot, workspaceConfig);
  expect(overlay.ok).to.equal(true);
  if (!overlay.ok) {
    throw new Error(overlay.error);
  }

  return resolveConfig(
    overlay.value.config,
    projectConfig,
    {},
    workspaceRoot,
    projectRoot,
    entryFile
  );
};

describe("build command (native library port regressions)", function () {
  this.timeout(buildTestTimeoutMs);

  it("canonicalizes runtime union ordering across overload helpers and base dispatch", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-union-order-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type PathSpec = string | readonly string[] | RegExp;",
          "",
          "class Router {",
          "  get(path: PathSpec, ...handlers: (() => void)[]): this {",
          "    void path;",
          "    void handlers;",
          "    return this;",
          "  }",
          "}",
          "",
          "class Application extends Router {",
          "  get(name: string): unknown;",
          "  override get(path: PathSpec, ...handlers: (() => void)[]): this;",
          "  override get(nameOrPath: string | PathSpec, ...handlers: (() => void)[]): unknown {",
          '    if (handlers.length === 0 && typeof nameOrPath === "string") {',
          "      return undefined;",
          "    }",
          "    return super.get(nameOrPath as PathSpec, ...handlers);",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  const app = new Application();",
          '  app.get("/items", () => {});',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      const unionMatches = Array.from(
        tree.matchAll(
          /global::Tsonic\.Runtime\.Union<[^>]*global::Tsonic\.JSRuntime\.RegExp[^>]*>/g
        ),
        (match) => match[0]
      );
      expect(unionMatches.length).to.be.greaterThan(0);
      expect(new Set(unionMatches).size).to.equal(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JSArray push calls for tuple and object-literal element values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-push-element-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type RouteLayer = {",
          "  path: string;",
          "  method: string | undefined;",
          "  middleware: boolean;",
          "  handlers: string[];",
          "};",
          "",
          "class Params {",
          "  entries(): [string, string][] {",
          "    const result: [string, string][] = [];",
          '    const key = "name";',
          '    const value = "value";',
          "    result.push([key, value]);",
          "    return result;",
          "  }",
          "}",
          "",
          "class Router {",
          "  layers: RouteLayer[] = [];",
          "  add(path: string, method: string | undefined, handlers: string[]): void {",
          "    this.layers.push({ path, method, middleware: false, handlers });",
          "  }",
          "}",
          "",
          "export function main(): void {",
          "  new Params().entries();",
          '  new Router().add("/", "GET", []);',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.not.include(
        "push(new global::System.ValueTuple<string, string>[]"
      );
      expect(tree).to.not.include("push(new global::App.RouteLayer[]");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds CLR enum toString calls and nullable-int nullish coalescing in JS-surface ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-native-port-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import type { int } from "@tsonic/core/types.js";',
          'import { Environment } from "@tsonic/dotnet/System.js";',
          'import { RuntimeInformation } from "@tsonic/dotnet/System.Runtime.InteropServices.js";',
          "",
          "let currentExitCode: int | undefined = undefined;",
          "",
          "export function main(): void {",
          "  const arch = RuntimeInformation.ProcessArchitecture.toString();",
          "  const code: int | undefined = undefined;",
          "  const resolved = code ?? currentExitCode ?? (0 as int);",
          "  console.log(arch);",
          "  Environment.Exit(resolved);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds JS array callbacks and rest-only timer callbacks in JS-surface ports", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-js-array-callbacks-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "type Todo = { id: number; title: string; completed: boolean };",
          "const todos: Todo[] = [];",
          "",
          "export function getById(id: number): Todo | undefined {",
          "  return todos.find((t) => t.id === id);",
          "}",
          "",
          "export function remove(id: number): boolean {",
          "  const index = todos.findIndex((t) => t.id === id);",
          "  return index !== -1;",
          "}",
          "",
          "export function main(): void {",
          "  setInterval(() => {}, 1000);",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.match(
        /new global::Tsonic\.JSRuntime\.JSArray<(?:global::App\.)?Todo(?:__Alias)?>\(todos\)\.find\(/
      );
      expect(tree).to.match(
        /new global::Tsonic\.JSRuntime\.JSArray<(?:global::App\.)?Todo(?:__Alias)?>\(todos\)\.findIndex\(/
      );
      expect(tree).to.include(
        "global::Tsonic.JSRuntime.Timers.setInterval(() =>"
      );
      expect(tree).to.not.include("__unused_args");
      expect(tree).to.not.include("todos.Find(");
      expect(tree).to.not.include("todos.FindIndex(");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("builds typeof-narrowed unknown entry assignments with concrete CLR casts", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-typeof-entry-casts-"));
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "export function readFirst(root: Record<string, unknown>): string {",
          "  const first = Object.entries(root)[0];",
          '  let title = "";',
          "  let enabled = false;",
          "  let weight: number = 0;",
          "  if (first === undefined) return title;",
          "  const [key, value] = first;",
          '  if (typeof value === "string") {',
          "    title = value;",
          '  } else if (typeof value === "boolean") {',
          "    enabled = value;",
          '  } else if (typeof value === "number") {',
          "    weight = value;",
          "  }",
          "  return enabled ? `${key}:${title}:${weight}` : title;",
          "}",
          "",
          "export function main(): string {",
          '  return readFirst({ title: "hello" });',
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include("title = (string)value;");
      expect(tree).to.include("enabled = (bool)value;");
      expect(tree).to.include("weight = (double)value;");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps JS Object.entries object-based for JSON.parse<object> values narrowed by user guards", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-json-object-entries-")
    );
    try {
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(linkedJsPackageRoot, join(dir, "node_modules/@tsonic/js"));
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const workspaceConfig = {
        $schema: "https://tsonic.org/schema/workspace/v1.json",
        dotnetVersion: "net10.0",
        surface: "@tsonic/js",
        dotnet: {
          typeRoots: ["node_modules/@tsonic/js"],
          libraries: [],
          frameworkReferences: [],
          packageReferences: [],
        },
      };

      const projectRoot = join(dir, "packages", "app");
      mkdirSync(join(projectRoot, "src"), { recursive: true });
      writeFileSync(
        join(projectRoot, "package.json"),
        JSON.stringify(
          {
            name: "@acme/app",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          "const isObject = (value: unknown): value is Record<string, unknown> => {",
          '  return value !== null && typeof value === "object" && !Array.isArray(value);',
          "};",
          "",
          "export function main(): void {",
          '  const root = JSON.parse("{\\"title\\":\\"hello\\",\\"count\\":2}");',
          "  if (!isObject(root)) return;",
          "  const first = Object.entries(root)[0];",
          "  if (first === undefined) return;",
          "  const [key, value] = first;",
          '  if (typeof value === "number") {',
          "    console.log(key, value.toString());",
          '  } else if (typeof value === "string") {',
          "    console.log(key, value.toUpperCase());",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );

      const projectConfig = {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace: "App",
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName: "App",
      };

      const config = resolveEffectiveConfig(
        workspaceConfig,
        projectConfig,
        dir,
        projectRoot
      );

      const result = buildCommand(config);
      if (!result.ok) {
        throw new Error(result.error);
      }
      expect(result.ok).to.equal(true);

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.match(
        /global::Tsonic\.JSRuntime\.Object\.entries\([^\n]*root\)/
      );
      expect(tree).to.not.include(
        "(global::System.Collections.Generic.Dictionary<string, object?>)root"
      );
      expect(tree).to.not.include("global::System.Linq.Enumerable");
      expect(tree).to.include(
        "global::Tsonic.JSRuntime.Number.toString((double)value)"
      );
      expect(tree).to.include(
        "global::Tsonic.JSRuntime.String.toUpperCase((string)value)"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
