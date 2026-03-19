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
import { linkDir, repoRoot, runLibraryBuild, runProjectBuild, writeLibraryScaffold } from "./test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
  it("keeps source alias surfaces free of synthetic helper tokens", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-alias-tokens-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(
        dir,
        "Acme.Alias",
        "Acme.Alias"
      );
      mkdirSync(join(dir, "packages", "lib", "src", "types"), {
        recursive: true,
      });

      writeFileSync(
        join(dir, "packages", "lib", "src", "types", "result.ts"),
        [
          `export type SuccessResult = { ok: true; value: string };`,
          `export type FailureResult = { ok: false; error: string };`,
          `export type Result = SuccessResult | FailureResult;`,
          `export type Wrapped = Promise<Result>;`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "api.ts"),
        [
          `import type { Result, Wrapped } from "./types/result.ts";`,
          `import { Exception } from "@tsonic/dotnet/System.js";`,
          ``,
          `export type UserPayload = { id: string; active: boolean };`,
          `export type FetchUser = Wrapped;`,
          ``,
          `export function fetchUser(_id: string): Result {`,
          `  throw new Exception("not-implemented");`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "bridge.ts"),
        [
          `export { fetchUser } from "./api.ts";`,
          `export type { FetchUser, UserPayload } from "./api.ts";`,
          `export type { Result, SuccessResult, FailureResult, Wrapped } from "./types/result.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `export { fetchUser } from "./bridge.ts";`,
          `export type {`,
          `  FetchUser,`,
          `  UserPayload,`,
          `  Result,`,
          `  SuccessResult,`,
          `  FailureResult,`,
          `  Wrapped,`,
          `} from "./bridge.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const facade = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Alias.d.ts"
        ),
        "utf-8"
      );
      const startMarker = "// Tsonic source type aliases (generated)";
      const endMarker = "// End Tsonic source type aliases";
      const start = facade.indexOf(startMarker);
      const end = facade.indexOf(endMarker);

      expect(start).to.be.greaterThan(-1);
      expect(end).to.be.greaterThan(start);

      const sourceAliasBlock = facade.slice(start, end);
      expect(sourceAliasBlock).to.include("export type FetchUser");
      expect(sourceAliasBlock).to.not.match(/\$instance|__\d+\b/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps overload implementation helpers out of source-package public surfaces", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-overload-family-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(
        dir,
        "Acme.Overloads",
        "Acme.Overloads"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export class Parser {",
          "  parse(text: string): string;",
          "  parse(text: string, radix: number): string;",
          "  parse(text: string, radix: number = 10): string {",
          "    return `${text}:${radix}`;",
          "  }",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Overloads",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );
      expect(internal).to.include("parse(text: string): string;");
      expect(internal).to.include(
        "parse(text: string, radix: number): string;"
      );
      expect(internal).to.not.include("__tsonic_overload_impl_parse");

      const bindings = JSON.parse(
        readFileSync(
          join(
            dir,
            "packages",
            "lib",
            "dist",
            "tsonic",
            "bindings",
            "Acme.Overloads",
            "bindings.json"
          ),
          "utf-8"
        )
      ) as {
        readonly types?: ReadonlyArray<{
          readonly alias?: string;
          readonly methods?: ReadonlyArray<{
            readonly clrName?: string;
            readonly overloadFamily?: {
              readonly ownerKind?: string;
              readonly publicName?: string;
              readonly role?: string;
              readonly publicSignatureCount?: number;
              readonly publicSignatureIndex?: number;
              readonly implementationName?: string;
            };
          }>;
        }>;
      };

      const parserType = bindings.types?.find(
        (type) => type.alias === "Acme.Overloads.Parser"
      );
      expect(parserType).to.not.equal(undefined);

      const methods = parserType?.methods ?? [];
      expect(
        methods.some(
          (method) => method.clrName === "__tsonic_overload_impl_parse"
        )
      ).to.equal(false);

      const parseMethods = methods.filter(
        (method) => method.clrName === "parse"
      );
      expect(parseMethods).to.have.length(2);
      expect(
        parseMethods.map(
          (method) => method.overloadFamily?.publicSignatureIndex
        )
      ).to.deep.equal([0, 1]);
      for (const method of parseMethods) {
        expect(method.overloadFamily).to.deep.equal({
          ownerKind: "method",
          publicName: "parse",
          role: "publicOverload",
          publicSignatureCount: 2,
          publicSignatureIndex: method.overloadFamily?.publicSignatureIndex,
          implementationName: "__tsonic_overload_impl_parse",
        });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports synthetic __Anon declarations as type-only surface", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-anon-type-"));
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Acme.Anon", "Acme.Anon");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `function id<T>(x: T): T {`,
          `  return x;`,
          `}`,
          ``,
          `export const current = id({ ok: true, reason: "fresh" });`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Anon",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );
      const facade = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Anon.d.ts"
        ),
        "utf-8"
      );

      expect(internal).to.match(/__Anon_/);
      expect(facade).to.match(/export type \{ __Anon_/);
      expect(facade).to.not.match(/export \{ __Anon_/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
