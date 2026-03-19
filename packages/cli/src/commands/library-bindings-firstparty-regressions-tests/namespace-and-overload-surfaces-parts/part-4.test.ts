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
  it("preserves optional exact numerics through first-party bindings", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-optional-int-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "users", "src"), {
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
        join(dir, "packages", "users", "package.json"),
        JSON.stringify(
          {
            name: "@acme/users",
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
        join(dir, "packages", "users", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Users",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Users",
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
                "../users/generated/bin/Release/net10.0/Acme.Users.dll",
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
        join(dir, "packages", "users", "src", "index.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `export interface CreateFieldInput {`,
          `  readonly name: string;`,
          `  readonly displayInProfileSummary?: int;`,
          `}`,
          ``,
          `export const createField = (input: CreateFieldInput): string => {`,
          `  return input.displayInProfileSummary === undefined ? input.name : input.name + input.displayInProfileSummary.ToString();`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { createField } from "@acme/users/Acme.Users.js";`,
          ``,
          `export function run(flag: boolean): string {`,
          `  const displayInProfileSummary: int | undefined = flag ? (1 as int) : undefined;`,
          `  return createField({ name: "field", displayInProfileSummary });`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "users");

      const bindings = readFileSync(
        join(
          dir,
          "packages",
          "users",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Users",
          "bindings.json"
        ),
        "utf-8"
      );

      expect(bindings).to.include('"semanticOptional": true');
      expect(bindings).to.include('"name": "int"');

      linkDir(
        join(dir, "packages", "users"),
        join(dir, "node_modules/@acme/users")
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
