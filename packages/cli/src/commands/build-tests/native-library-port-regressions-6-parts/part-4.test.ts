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
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
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

  it("builds recursive middleware unions without degrading non-recursive handler arrays to object[]", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-middlewarelike-"));
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
          "type RequestHandler = (value: string) => void;",
          "type MiddlewareParam = RequestHandler | readonly MiddlewareParam[];",
          "type MiddlewareLike = MiddlewareParam | Router | readonly MiddlewareLike[];",
          "",
          "class Router {}",
          "class Application extends Router {",
          '  mountpath: string | string[] = "/";',
          "}",
          "",
          "function flattenMiddlewareEntries(",
          "  handlers: readonly MiddlewareLike[]",
          "): Array<RequestHandler | Router> {",
          "  const result: Array<RequestHandler | Router> = [];",
          "  const append = (handler: MiddlewareLike): void => {",
          "    if (handler == null) return;",
          "    if (Array.isArray(handler)) {",
          "      const items = handler as readonly MiddlewareLike[];",
          "      for (let index = 0; index < items.length; index += 1) {",
          "        append(items[index]!);",
          "      }",
          "      return;",
          "    }",
          "    result.push(handler);",
          "  };",
          "  for (const handler of handlers) append(handler);",
          "  return result;",
          "}",
          "",
          "export function run(input: readonly MiddlewareLike[]): number {",
          "  const flattened = flattenMiddlewareEntries(input);",
          "  let applications = 0;",
          "  for (let index = 0; index < flattened.length; index += 1) {",
          "    const candidate = flattened[index]!;",
          "    if (candidate instanceof Application) {",
          '      candidate.mountpath = "/app";',
          "      applications += 1;",
          "    }",
          "  }",
          "  return applications;",
          "}",
          "",
          "export function main(): number {",
          "  const app = new Application();",
          "  return run([[(value: string) => { void value; }, [app]]]);",
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
      expect(tree).to.not.include("object[] result");
      expect(tree).to.not.include("handler == null");
      expect(tree).to.not.include("candidate is Application");
      expect(tree).to.include("Is2()");
      expect(tree).to.include(
        "Application candidate__is_1 = (Application)candidate.As2();"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
