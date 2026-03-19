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
  it("preserves external and cross-namespace source type closure through generated library bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-closure-"));

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
            dependencies: {
              "@tsonic/efcore": "*",
            },
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

      writeFileSync(
        join(dir, "packages", "core", "src", "entities", "user.ts"),
        [
          `export class User {`,
          `  name: string = "";`,
          `  active: boolean = false;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "db", "store.ts"),
        [
          `import { asinterface } from "@tsonic/core/lang.js";`,
          `import type { ExtensionMethods as Linq } from "@tsonic/dotnet/System.Linq.js";`,
          `import { List } from "@tsonic/dotnet/System.Collections.Generic.js";`,
          `import type { User } from "../entities/user.ts";`,
          ``,
          `type Query<T> = Linq<List<T>>;`,
          ``,
          `export class UserStore extends List<User> {`,
          `  get ActiveUsers(): Query<User> {`,
          `    return asinterface<Query<User>>(this);`,
          `  }`,
          `}`,
          ``,
          `export function createSeed(): List<User> {`,
          `  return new List<User>();`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export { UserStore, createSeed } from "./db/store.ts";`,
          `export type { User } from "./entities/user.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { UserStore, createSeed } from "@acme/core/Acme.Core.db.js";`,
          ``,
          `export function project(store: UserStore): int {`,
          `  const seeded = createSeed();`,
          `  store.AddRange(seeded);`,
          `  const active = store.ActiveUsers.Where((user) => user.active).ToArray();`,
          `  return store.Count + active.Length;`,
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
      const internal = readFileSync(
        join(bindingsRoot, "Acme.Core.db", "internal", "index.d.ts"),
        "utf-8"
      );
      const facade = readFileSync(
        join(bindingsRoot, "Acme.Core.db.d.ts"),
        "utf-8"
      );
      const rootFacade = readFileSync(
        join(bindingsRoot, "Acme.Core.d.ts"),
        "utf-8"
      );

      expect(internal).to.include(
        "import type { List } from '@tsonic/dotnet/System.Collections.Generic.js';"
      );
      expect(internal).to.include(
        "import type { User } from '../../Acme.Core.entities/internal/index.js';"
      );
      expect(internal).to.match(
        /interface UserStore\$instance extends List<User>/
      );
      expect(internal).to.match(
        /readonly ActiveUsers: __TsonicExt_Linq<List<User>>;/
      );
      expect(facade).to.include(
        "import type { List } from '@tsonic/dotnet/System.Collections.Generic.js';"
      );
      expect(facade).to.include(
        "import type { User } from './Acme.Core.entities.js';"
      );
      expect(facade).to.match(
        /export declare function createSeed\(\): List<User>;/
      );
      expect(rootFacade).to.include(
        "import type { User } from './Acme.Core.entities.js';"
      );
      expect(rootFacade).to.include(
        "export { createSeed, UserStore } from './Acme.Core.db.js';"
      );
      expect(rootFacade).to.include(
        "export { User } from './Acme.Core.entities.js';"
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });


});
