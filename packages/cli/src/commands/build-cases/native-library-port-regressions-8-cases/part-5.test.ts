import { describe, it } from "mocha";
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

  it("builds contextual callback parameters that flow from imported class-backed query surfaces", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-contextual-class-callback-")
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
        join(projectRoot, "src", "entities.ts"),
        [
          "export class Event {",
          "  Path?: string;",
          "  VisitorId?: string;",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "query.ts"),
        [
          "export class Query<T> {",
          "  readonly items: readonly T[];",
          "",
          "  constructor(items: readonly T[]) {",
          "    this.items = items;",
          "  }",
          "",
          "  map<TResult>(project: (value: T) => TResult): TResult[] {",
          "    const out: TResult[] = [];",
          "    for (let i = 0; i < this.items.length; i++) {",
          "      out.push(project(this.items[i]!));",
          "    }",
          "    return out;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "context.ts"),
        [
          'import { Event } from "./entities.ts";',
          'import type { Event as EventEntity } from "./entities.ts";',
          'import { Query } from "./query.ts";',
          "",
          "export class ClickmeterDbContext {",
          "  readonly items: readonly EventEntity[];",
          "",
          "  constructor(items: readonly EventEntity[]) {",
          "    this.items = items;",
          "  }",
          "",
          "  get Events(): Query<EventEntity> {",
          "    return new Query<EventEntity>(this.items);",
          "  }",
          "}",
          "",
          "export const createDb = (): ClickmeterDbContext => {",
          "  const event = new Event();",
          '  event.Path = "/x";',
          '  event.VisitorId = "v1";',
          "  return new ClickmeterDbContext([event]);",
          "};",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { createDb } from "./context.ts";',
          "",
          "export function main(): void {",
          "  const db = createDb();",
          '  const rows = db.Events.map((e) => e.Path ?? "");',
          '  if (rows[0] !== "/x") throw new Error("bad contextual callback typing");',
          "}",
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
