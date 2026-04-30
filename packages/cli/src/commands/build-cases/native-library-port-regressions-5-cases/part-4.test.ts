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

  it("infers branch-local storage from narrowed member-access initializers for repeated locals", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-narrowed-local-storage-")
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
          'import { List } from "@tsonic/dotnet/System.Collections.Generic.js";',
          'import type { int } from "@tsonic/core/types.js";',
          "",
          "class Item {",
          "  name: string;",
          "  constructor(name: string) {",
          "    this.name = name;",
          "  }",
          "}",
          "",
          "class PageArrayValue {",
          "  value: Item[];",
          "  constructor(value: Item[]) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "class AnyArrayValue {",
          "  value: List<Item>;",
          "  constructor(value: List<Item>) {",
          "    this.value = value;",
          "  }",
          "}",
          "",
          "type Value = PageArrayValue | AnyArrayValue;",
          "",
          "export const len = (value: Value): int => {",
          "  if (value instanceof PageArrayValue) {",
          "    const items = value.value;",
          "    return items.length;",
          "  }",
          "  if (value instanceof AnyArrayValue) {",
          "    const items = value.value;",
          "    if (items.Count === 0) return 0 as int;",
          "    const arr = items.ToArray();",
          "    return arr.length;",
          "  }",
          "  return 0 as int;",
          "};",
          "",
          "export function main(): void {}",
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
