import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  linkDir,
  readFirstPartyBindingsJson,
  repoRoot,
  runProjectBuild,
} from "../test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
  it("preserves canonical type identity for cross-namespace source re-exports", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-canonical-reexport-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src", "db"), {
        recursive: true,
      });
      mkdirSync(join(dir, "packages", "core", "src", "entities"), {
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
            dotnet: {
              packageReferences: [
                {
                  id: "Microsoft.EntityFrameworkCore",
                  version: "10.0.1",
                  types: "@tsonic/efcore",
                },
              ],
              libraries: [],
              frameworkReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "package.json"),
        JSON.stringify(
          {
            name: "@acme/core",
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
            name: "@acme/app",
            private: true,
            type: "module",
            dependencies: {
              "@acme/core": "workspace:*",
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Core",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Core",
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
                "../core/generated/bin/Release/net10.0/Acme.Core.dll",
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
      linkDir(
        join(repoRoot, "node_modules/@tsonic/efcore"),
        join(dir, "node_modules/@tsonic/efcore")
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "entities", "user.ts"),
        [
          `export class User {`,
          `  email: string = "";`,
          `  active: boolean = false;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "db", "context.ts"),
        [
          `import type { ExtensionMethods as Linq, IQueryable } from "@tsonic/dotnet/System.Linq.js";`,
          `import type { ExtensionMethods as Ef } from "@tsonic/efcore/Microsoft.EntityFrameworkCore.js";`,
          `import type { User } from "../entities/user.ts";`,
          ``,
          `type Query<T> = Ef<Linq<IQueryable<T>>>;`,
          ``,
          `export class UserContext {`,
          `  get Users(): Query<User> {`,
          `    throw new Error("unused");`,
          `  }`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export { UserContext } from "./db/context.ts";`,
          `export { User } from "./entities/user.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { User, UserContext } from "@acme/core/Acme.Core.js";`,
          ``,
          `export async function findActive(db: UserContext): Promise<User | undefined> {`,
          `  const user = await db.Users`,
          `    .Where((u) => u.active)`,
          `    .Where((u) => u.email !== "")`,
          `    .FirstOrDefaultAsync();`,
          `  return user;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "core");
      linkDir(
        join(dir, "packages", "core"),
        join(dir, "node_modules/@acme/core")
      );

      const bindingsRoot = join(
        dir,
        "packages",
        "core",
        "dist",
        "tsonic",
        "bindings"
      );
      const rootInternal = readFileSync(
        join(bindingsRoot, "Acme.Core", "internal", "index.d.ts"),
        "utf-8"
      );
      const rootFacade = readFileSync(
        join(bindingsRoot, "Acme.Core.d.ts"),
        "utf-8"
      );
      const rootBindings = readFirstPartyBindingsJson(
        join(bindingsRoot, "Acme.Core", "bindings.json")
      );

      expect(rootInternal).to.not.include("export interface User$instance");
      expect(rootFacade).to.not.include(
        "export { User } from './Acme.Core/internal/index.js';"
      );
      expect(
        (rootBindings.dotnet?.types ?? []).map((item) => item.clrName)
      ).to.not.include("Acme.Core.User");

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
