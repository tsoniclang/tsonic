import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const writeLibraryScaffold = (
  dir: string,
  rootNamespace: string,
  outputName: string
): string => {
  const wsConfigPath = join(dir, "tsonic.workspace.json");
  mkdirSync(join(dir, "packages", "lib", "src"), { recursive: true });
  mkdirSync(join(dir, "node_modules"), { recursive: true });

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "test",
        private: true,
        type: "module",
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
    join(dir, "packages", "lib", "package.json"),
    JSON.stringify(
      {
        name: "lib",
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
    join(dir, "packages", "lib", "tsonic.json"),
    JSON.stringify(
      {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace,
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName,
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

  return wsConfigPath;
};

const runLibraryBuild = (dir: string, wsConfigPath: string): void => {
  const cliPath = join(repoRoot, "packages/cli/dist/index.js");
  const result = spawnSync(
    "node",
    [cliPath, "build", "--project", "lib", "--config", wsConfigPath, "--quiet"],
    { cwd: dir, encoding: "utf-8" }
  );
  expect(result.status, result.stderr || result.stdout).to.equal(0);
};

const runProjectBuild = (
  dir: string,
  wsConfigPath: string,
  projectName: string
): void => {
  const cliPath = join(repoRoot, "packages/cli/dist/index.js");
  const result = spawnSync(
    "node",
    [
      cliPath,
      "build",
      "--project",
      projectName,
      "--config",
      wsConfigPath,
      "--quiet",
    ],
    { cwd: dir, encoding: "utf-8" }
  );
  expect(result.status, result.stderr || result.stdout).to.equal(0);
};

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);

  it("uses declaring-module source signatures for transitive re-exported function values", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-declaring-"));
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Test.Lib", "Test.Lib");
      mkdirSync(join(dir, "packages", "lib", "src", "types"), {
        recursive: true,
      });

      writeFileSync(
        join(dir, "packages", "lib", "src", "types", "result.ts"),
        [`export type Success<T> = { ok: true; value: T };`, ``].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "impl.ts"),
        [
          `import type { Success } from "./types/result.ts";`,
          ``,
          `export function ok<T>(value: T): Success<T> {`,
          `  return { ok: true, value };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "bridge.ts"),
        [
          `export { ok } from "./impl.ts";`,
          `export type { Success } from "./types/result.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `export { ok } from "./bridge.ts";`,
          `export type { Success } from "./bridge.ts";`,
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
          "Test.Lib.d.ts"
        ),
        "utf-8"
      );
      const okLine = facade
        .split("\n")
        .find((line) => line.includes("export declare function ok<"));
      expect(okLine).to.not.equal(undefined);
      expect(okLine ?? "").to.match(/:\s*Success<\s*T\s*>;/);
      expect(okLine ?? "").to.not.match(/\$instance|__\d+\b/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits boolean literal signatures as System.Boolean in bindings metadata", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-boollit-"));
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Acme.Bool", "Acme.Bool");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `export function onlyTrue(flag: true): int {`,
          `  return flag ? 1 : 0;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const bindings = JSON.parse(
        readFileSync(
          join(
            dir,
            "packages",
            "lib",
            "dist",
            "tsonic",
            "bindings",
            "Acme.Bool",
            "bindings.json"
          ),
          "utf-8"
        )
      ) as {
        readonly types?: ReadonlyArray<{
          readonly methods?: ReadonlyArray<{
            readonly clrName?: string;
            readonly normalizedSignature?: string;
          }>;
        }>;
      };

      const methods = (bindings.types ?? []).flatMap(
        (type) => type.methods ?? []
      );
      const onlyTrue = methods.find((method) => method.clrName === "onlyTrue");
      expect(onlyTrue).to.not.equal(undefined);
      const signature = onlyTrue?.normalizedSignature ?? "";
      expect(signature).to.include("(System.Boolean)");
      expect(signature).to.not.include("System.Double");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
      linkDir(join(dir, "packages", "core"), join(dir, "node_modules/@acme/core"));

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
      const facade = readFileSync(join(bindingsRoot, "Acme.Core.db.d.ts"), "utf-8");
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
        /export declare function createSeed\(\): List<User>;/,
      );
      expect(rootFacade).to.include(
        "import type { List } from '@tsonic/dotnet/System.Collections.Generic.js';"
      );
      expect(rootFacade).to.include(
        "import type { User } from './Acme.Core.entities.js';"
      );
      expect(rootFacade).to.match(
        /export declare function createSeed\(\): List<User>;/,
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves EF/LINQ contextual typing across source-package bindings", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-ef-context-"));

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
          `export type { User } from "./entities/user.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { UserContext } from "@acme/core/Acme.Core.db.js";`,
          ``,
          `export async function findActive(db: UserContext): Promise<boolean> {`,
          `  const user = await db.Users`,
          `    .Where((u) => u.active)`,
          `    .Where((u) => u.email !== "")`,
          `    .FirstOrDefaultAsync();`,
          `  return user === undefined ? false : user.active;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "core");
      linkDir(join(dir, "packages", "core"), join(dir, "node_modules/@acme/core"));

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

      expect(internal).to.match(
        /readonly Users: __TsonicExt_Ef<__TsonicExt_Linq<IQueryable<User>>>;/
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors included module augmentations during project build", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-augmentation-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
      mkdirSync(join(dir, "packages", "app", "src"), { recursive: true });
      mkdirSync(join(dir, "types"), { recursive: true });
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

      writeFileSync(
        join(dir, "packages", "app", "tsconfig.json"),
        JSON.stringify(
          {
            include: ["src/**/*.ts", "../../types/**/*.d.ts"],
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
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export class Greeter {`,
          `  greet(name: string): string {`,
          `    return "hello " + name;`,
          `  }`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "types", "acme-core-augment.d.ts"),
        [
          `declare module "@acme/core/Acme.Core.js" {`,
          `  export interface AugmentedSentinel {`,
          `    ok: true;`,
          `  }`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { AugmentedSentinel } from "@acme/core/Acme.Core.js";`,
          ``,
          `export type VisibleAugmentation = AugmentedSentinel;`,
          ``,
          `export function ok(): void {}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "core");
      linkDir(join(dir, "packages", "core"), join(dir, "node_modules/@acme/core"));
      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
