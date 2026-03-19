import {
  describe,
  it
} from "mocha";
import {
  buildTestTimeoutMs
} from "../helpers.js";
import {
  expect
} from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import {
  tmpdir
} from "node:os";
import {
  dirname,
  join,
  resolve
} from "node:path";
import {
  fileURLToPath
} from "node:url";
import {
  resolveConfig
} from "../../../config.js";
import {
  applyAikyaWorkspaceOverlay
} from "../../../aikya/bindings.js";
import {
  buildCommand
} from "../../build.js";

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

  it("keeps imported wrapper-member types isolated across sibling instanceof branches inside loop bodies", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-imported-wrapper-member-isolation-")
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
      mkdirSync(join(projectRoot, "src", "values"), { recursive: true });
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
        join(projectRoot, "src", "models.ts"),
        [
          "export class PageContext {",
          '  title = "";',
          "}",
          "",
          "export class SiteContext {",
          '  baseURL = "";',
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "base.ts"),
        [
          "export class TemplateValue {}",
          "export class NilValue extends TemplateValue {}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "page.ts"),
        [
          'import { PageContext } from "../models.ts";',
          'import { TemplateValue } from "./base.ts";',
          "",
          "export class PageValue extends TemplateValue {",
          "  readonly value: PageContext;",
          "  constructor(value: PageContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "values", "site.ts"),
        [
          'import { SiteContext } from "../models.ts";',
          'import { TemplateValue } from "./base.ts";',
          "",
          "export class SiteValue extends TemplateValue {",
          "  readonly value: SiteContext;",
          "  constructor(value: SiteContext) {",
          "    super();",
          "    this.value = value;",
          "  }",
          "}",
        ].join("\n"),
        "utf-8"
      );
      writeFileSync(
        join(projectRoot, "src", "index.ts"),
        [
          'import { NilValue } from "./values/base.ts";',
          'import { PageValue } from "./values/page.ts";',
          'import { SiteValue } from "./values/site.ts";',
          "",
          "function keepString(value: string): string {",
          "  return value;",
          "}",
          "",
          "type Value = NilValue | PageValue | SiteValue;",
          "",
          "export const resolve = (value: Value, segments: string[]): void => {",
          "  let cur: Value = value;",
          "  for (let i = 0; i < segments.length; i++) {",
          "    const seg = segments[i]!;",
          "    if (cur instanceof NilValue) return;",
          "    if (cur instanceof PageValue) {",
          "      const page = cur.value;",
          '      if (seg === "title") keepString(page.title);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "    if (cur instanceof SiteValue) {",
          "      const site = cur.value;",
          '      if (seg === "baseurl") keepString(site.baseURL);',
          "      cur = new NilValue();",
          "      continue;",
          "    }",
          "  }",
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
