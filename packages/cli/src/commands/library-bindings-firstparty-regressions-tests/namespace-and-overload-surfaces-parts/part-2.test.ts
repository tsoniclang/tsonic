import {
  describe,
  it
} from "mocha";
import {
  expect
} from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import {
  tmpdir
} from "node:os";
import {
  join
} from "node:path";
import {
  linkDir,
  repoRoot,
  runProjectBuild
} from "../test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
  it("preserves callable const export signatures for sync await across source-package consumers", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-await-sync-const-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "messages", "src", "domain"), {
        recursive: true,
      });
      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          {
            name: "test",
            private: true,
            type: "module",
            workspaces: ["packages/*"],
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        wsConfigPath,
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "messages", "package.json"),
        JSON.stringify(
          {
            name: "@acme/messages",
            private: true,
            type: "module",
            exports: {
              "./package.json": "./package.json",
              "./*.js": {
                types: "./dist/tsonic/bindings/*.d.ts",
                default: "./dist/tsonic/bindings/*.js",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "package.json"),
        JSON.stringify(
          {
            name: "app",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "messages", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Messages",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Messages",
            output: {
              type: "library",
              targetFrameworks: ["net10.0"],
              nativeAot: false,
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.App",
            entryPoint: "src/App.ts",
            sourceRoot: "src",
            references: {
              libraries: [
                "../messages/generated/bin/Release/net10.0/Acme.Messages.dll",
              ],
            },
            outputDirectory: "generated",
            outputName: "Acme.App",
            output: {
              type: "library",
              targetFrameworks: ["net10.0"],
              nativeAot: false,
              generateDocumentation: false,
              includeSymbols: false,
              packable: false,
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/globals"),
        join(dir, "node_modules/@tsonic/globals")
      );

      writeFileSync(
        join(dir, "packages", "messages", "src", "index.ts"),
        [
          `export { renderMarkdownDomain } from "./domain/render-markdown-domain.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(
          dir,
          "packages",
          "messages",
          "src",
          "domain",
          "render-markdown-domain.ts"
        ),
        [
          `export type RenderResult =`,
          `  | { success: true; rendered: string }`,
          `  | { success: false; error: string };`,
          ``,
          `export const renderMarkdownDomain = (content: string): RenderResult => {`,
          `  if (content.Trim() === "") {`,
          `    return { success: false, error: "empty" };`,
          `  }`,
          `  return { success: true, rendered: content.ToUpper() };`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { renderMarkdownDomain } from "@acme/messages/Acme.Messages.js";`,
          ``,
          `export async function run(content: string): Promise<string> {`,
          `  const result = await renderMarkdownDomain(content);`,
          `  if (!result.success) {`,
          `    return result.error;`,
          `  }`,
          `  return result.rendered;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "messages");

      const bindings = readFileSync(
        join(
          dir,
          "packages",
          "messages",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Messages",
          "bindings.json"
        ),
        "utf-8"
      );

      expect(bindings).to.include('"kind": "functionType"');

      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

});
