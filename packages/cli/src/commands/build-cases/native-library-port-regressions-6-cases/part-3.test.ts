import { describe, it } from "mocha";
import { buildTestTimeoutMs } from "../helpers.js";
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
import { resolveConfig } from "../../../config.js";
import { applyPackageManifestWorkspaceOverlay } from "../../../package-manifests/bindings.js";
import { buildCommand } from "../../build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
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

  it("builds source-package callback-or-dictionary flows with contextual object literals", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-renderlike-"));
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

      const sourcePackageRoot = join(dir, "node_modules/@demo/renderlike");
      mkdirSync(join(sourcePackageRoot, "tsonic"), { recursive: true });
      mkdirSync(join(sourcePackageRoot, "src"), { recursive: true });
      writeFileSync(
        join(sourcePackageRoot, "package.json"),
        JSON.stringify(
          {
            name: "@demo/renderlike",
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
        join(sourcePackageRoot, "tsonic/package-manifest.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
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
          "export type TemplateCallback = (error: unknown, html: string) => void;",
          "export type TemplateEngine = (view: string, locals: Record<string, unknown>, callback: TemplateCallback) => void;",
          "export type CookieOptions = { sameSite?: string | boolean };",
          "",
          "export function renderCookie(options?: CookieOptions): string[] {",
          "  const segments: string[] = [];",
          '  if (typeof options?.sameSite === "string" && options.sameSite.length > 0) {',
          "    segments.push(`SameSite=${options.sameSite}`);",
          "  } else if (options?.sameSite === true) {",
          '    segments.push("SameSite=Strict");',
          "  }",
          "  return segments;",
          "}",
          "",
          "export class App {",
          "  readonly locals: Record<string, unknown> = {};",
          "  readonly engines: Record<string, TemplateEngine> = {};",
          "",
          "  engine(name: string, fn: TemplateEngine): this {",
          "    this.engines[name] = fn;",
          "    return this;",
          "  }",
          "",
          "  resolveEngine(view: string): TemplateEngine | undefined {",
          '    const index = view.lastIndexOf(".");',
          '    const ext = index >= 0 ? view.slice(index + 1) : "";',
          "    return this.engines[ext];",
          "  }",
          "",
          "  render(",
          "    view: string,",
          "    localsOrCallback?: Record<string, unknown> | TemplateCallback,",
          "    maybeCallback?: TemplateCallback",
          "  ): void {",
          '    const locals = typeof localsOrCallback === "function" || localsOrCallback === undefined ? this.locals : localsOrCallback;',
          '    const callback = typeof localsOrCallback === "function" ? localsOrCallback : maybeCallback;',
          '    if (!callback) throw new Error("missing callback");',
          "    const engine = this.resolveEngine(view);",
          "    if (!engine) {",
          "      callback(undefined, `<rendered:${view}>`);",
          "      return;",
          "    }",
          "    engine(view, locals, callback);",
          "  }",
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
          'import { App, renderCookie } from "@demo/renderlike";',
          "",
          "export function main(): void {",
          "  const app = new App();",
          '  app.engine("tpl", (_view, locals, callback) => {',
          '    callback(undefined, "hello " + locals["name"]);',
          "  });",
          '  app.render("home.tpl", { name: "world" }, (_error, html) => {',
          '    if (html !== "hello world") throw new Error("bad render");',
          "  });",
          '  const cookie = renderCookie({ sameSite: "Lax" });',
          '  if (cookie[0] !== "SameSite=Lax") throw new Error("bad cookie");',
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

      const tree = readGeneratedCSharpTree(join(projectRoot, "generated"));
      expect(tree).to.include('["name"] = "world"');
      expect(tree).to.not.include('{ name = "world" }');
      expect(tree).to.not.include("localsOrCallback == null");
      expect(tree).to.not.include("callback.Match(");
      expect(tree).to.not.include("locals.Match(");
      expect(tree).to.match(
        /push\(\$"SameSite=\{[^"\n]*options\?\.sameSite\.As\d\(\)[^"\n]*\}"\)/
      );
      expect(tree).to.not.include('push($"SameSite={options?.sameSite}")');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
