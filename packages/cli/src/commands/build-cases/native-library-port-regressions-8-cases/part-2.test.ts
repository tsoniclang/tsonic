import { before, describe, it } from "mocha";
import { buildTestTimeoutMs } from "../helpers.js";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../../../config.js";
import { applyPackageManifestWorkspaceOverlay } from "../../../package-manifests/bindings.js";
import { buildCommand } from "../../build.js";
import { skipIfNativeAotUnavailable } from "../../native-aot-test-support.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../../..")
);
const localJsPackageRoot = resolve(
  join(repoRoot, "..", "js", "versions", "10")
);
const linkedJsPackageRoot = existsSync(localJsPackageRoot)
  ? localJsPackageRoot
  : join(repoRoot, "node_modules/@tsonic/js");

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const resolveEffectiveConfig = (
  workspaceConfig: Parameters<typeof resolveConfig>[0],
  projectConfig: Parameters<typeof resolveConfig>[1],
  workspaceRoot: string,
  projectRoot: string,
  entryFile?: string
) => {
  const overlay = applyPackageManifestWorkspaceOverlay(
    workspaceRoot,
    workspaceConfig
  );
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

  before(function () {
    skipIfNativeAotUnavailable(this);
  });

  it("builds private class members in JS-surface source packages", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-private-source-port-")
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

      const sourcePackageRoot = join(dir, "node_modules/@demo/private-port");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/private-port",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "Demo.PrivatePort",
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          'import { overloads as O } from "@tsonic/core/lang.js";',
          "",
          "export class Counter {",
          '  #label: string = "ctr";',
          "  #count: number = 0;",
          "",
          "  get #prefix(): string {",
          "    return this.#label;",
          "  }",
          "",
          "  #increment(): string {",
          "    this.#count += 1;",
          "    return String(this.#count);",
          "  }",
          "",
          "  append(value: string): string;",
          "  append(value: string[]): string;",
          "  append(_value: any): any {",
          '    throw new Error("stub");',
          "  }",
          "",
          "  append_one(value: string): string {",
          "    return `${this.#prefix}:${value}:${this.#increment()}`;",
          "  }",
          "",
          "  append_many(value: string[]): string {",
          "    for (let index = 0; index < value.length; index += 1) {",
          "      const item = value[index]!;",
          "      this.append_one(item);",
          "    }",
          "    return this.#prefix;",
          "  }",
          "",
          "  read(): string {",
          '    return this.append_one("value");',
          "  }",
          "}",
          "",
          "O<Counter>().method(x => x.append_one).family(x => x.append);",
          "O<Counter>().method(x => x.append_many).family(x => x.append);",
          "",
          "export const createCounter = (): Counter => new Counter();",
        ].join("\n"),
        "utf-8"
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
          'import { createCounter } from "@demo/private-port";',
          "",
          "export function main(): void {",
          "  const counter = createCounter();",
          '  if (counter.read() !== "ctr:value:1") throw new Error("private read failed");',
          '  if (counter.append(["a", "b"]) !== "ctr") throw new Error("private append failed");',
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

  it("does not treat source-package members as CLR-bound just because a root bindings.json exists", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-source-port-bindings-root-")
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

      const sourcePackageRoot = join(dir, "node_modules/@demo/simple-port");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/simple-port",
            version: "1.0.0",
            type: "module",
            exports: {
              ".": "./src/index.ts",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              namespace: "Demo.SimplePort",
              exports: {
                ".": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              "node:fake": {
                kind: "module",
                assembly: "demo",
                type: "demo.fake",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      writeFileSync(
        join(sourcePackageRoot, "src/index.ts"),
        [
          "export class Counter {",
          "  #count = 0;",
          "",
          "  increment(): number {",
          "    this.#count += 1;",
          "    return this.#count;",
          "  }",
          "",
          "  get current(): number {",
          "    return this.#count;",
          "  }",
          "}",
          "",
          "export const createCounter = (): Counter => new Counter();",
        ].join("\n"),
        "utf-8"
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
          'import { createCounter } from "@demo/simple-port";',
          "",
          "export function main(): void {",
          "  const counter = createCounter();",
          '  if (counter.increment() !== 1) throw new Error("increment failed");',
          '  if (counter.current !== 1) throw new Error("current failed");',
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
});
