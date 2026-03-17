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

  it("emits canonical binding alias markers for nominal source-binding types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-canonical-alias-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Test.Lib", "Test.Lib");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        ["export class Attachment {", '  Id: string = "";', "}", ""].join("\n"),
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
          "Test.Lib",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );

      expect(internal).to.include(
        'readonly "__tsonic_binding_alias_Test.Lib.Attachment"?: never;'
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("emits canonical manifest aliases for generic source-binding types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-generic-alias-")
    );
    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Test.Lib", "Test.Lib");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export type Result<T> = {",
          "  ok: T;",
          "};",
          "",
          "export class Box<T> {",
          "  value!: T;",
          "}",
          "",
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
            "Test.Lib",
            "bindings.json"
          ),
          "utf-8"
        )
      ) as {
        readonly types?: ReadonlyArray<{
          readonly clrName?: string;
          readonly alias?: string;
        }>;
      };

      expect(
        bindings.types?.some(
          (type) =>
            type.clrName === "Test.Lib.Result__Alias`1" &&
            type.alias === "Test.Lib.Result__Alias_1"
        )
      ).to.equal(true);
      expect(
        bindings.types?.some(
          (type) =>
            type.clrName === "Test.Lib.Box`1" && type.alias === "Test.Lib.Box_1"
        )
      ).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
      expect(facade).to.include(
        "import type { Success } from './Test.Lib.types.js';"
      );
      expect(okLine ?? "").to.match(/:\s*Success<\s*T\s*>;/);
      expect(okLine ?? "").to.not.match(/\$instance|__\d+\b/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves declaring-namespace identity for non-exported helper types on re-exported functions", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-reexported-helper-")
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
            name: "@acme/app",
            private: true,
            type: "module",
            dependencies: {
              "@acme/messages": "workspace:*",
            },
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
        join(dir, "packages", "messages", "src", "domain", "send-message.ts"),
        [
          `interface SendMessageInput {`,
          `  type: string;`,
          `  to: string;`,
          `  topic?: string;`,
          `  content: string;`,
          `}`,
          ``,
          `export const sendMessageDomain = async (params: SendMessageInput): Promise<{ id: string }> => {`,
          `  return { id: params.to + ":" + params.content };`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "messages", "src", "index.ts"),
        [
          `export { sendMessageDomain } from "./domain/send-message.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { sendMessageDomain } from "@acme/messages/Acme.Messages.js";`,
          ``,
          `export async function run(): Promise<string> {`,
          `  const result = await sendMessageDomain({`,
          `    type: "stream",`,
          `    to: "general",`,
          `    topic: "ops",`,
          `    content: "hello",`,
          `  });`,
          `  return result.id;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "messages");
      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      const bindingsRoot = join(
        dir,
        "packages",
        "messages",
        "dist",
        "tsonic",
        "bindings"
      );
      const rootInternal = readFileSync(
        join(bindingsRoot, "Acme.Messages", "internal", "index.d.ts"),
        "utf-8"
      );
      const rootBindings = JSON.parse(
        readFileSync(
          join(bindingsRoot, "Acme.Messages", "bindings.json"),
          "utf-8"
        )
      ) as { readonly types: readonly { readonly clrName: string }[] };

      expect(rootInternal).to.include(
        'readonly "__tsonic_binding_alias_Acme.Messages.domain.SendMessageInput"?: never;'
      );
      expect(rootInternal).to.not.include(
        'readonly "__tsonic_binding_alias_Acme.Messages.SendMessageInput"?: never;'
      );
      expect(rootBindings.types.map((item) => item.clrName)).to.not.include(
        "Acme.Messages.SendMessageInput"
      );
      expect(rootBindings.types.map((item) => item.clrName)).to.include(
        "Acme.Messages.domain.SendMessageInput"
      );

      runProjectBuild(dir, wsConfigPath, "app");

      const appGenerated = readFileSync(
        join(dir, "packages", "app", "generated", "App.cs"),
        "utf-8"
      );
      expect(appGenerated).to.include(
        "new global::Acme.Messages.domain.SendMessageInput"
      );
      expect(appGenerated).to.not.include(
        "new global::Acme.Messages.SendMessageInput"
      );
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

      expect(internal).to.match(
        /readonly Users: __TsonicExt_Ef<__TsonicExt_Linq<IQueryable<User>>>;/
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves contextual object typing for imported generic result helpers across source-package bindings", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-contextual-result-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src", "types"), {
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

      writeFileSync(
        join(dir, "packages", "core", "src", "types", "result.ts"),
        [
          `export type Ok<T> = { success: true; data: T };`,
          `export type Err<E> = { success: false; error: E };`,
          `export type Result<T, E> = Ok<T> | Err<E>;`,
          ``,
          `export function ok<T>(data: T): Ok<T> {`,
          `  return { success: true, data };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "core", "src", "index.ts"),
        [
          `export { ok } from "./types/result.ts";`,
          `export type { Result } from "./types/result.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { Result } from "@acme/core/Acme.Core.js";`,
          `import { ok } from "@acme/core/Acme.Core.js";`,
          ``,
          `interface Payload {`,
          `  foundAnchor: boolean;`,
          `  foundNewest: boolean;`,
          `  foundOldest: boolean;`,
          `}`,
          ``,
          `export async function run(anchor: string): Promise<Result<Payload, string>> {`,
          `  const foundAnchor = anchor !== "newest" && anchor !== "oldest";`,
          `  const foundNewest = anchor === "newest";`,
          `  const foundOldest = anchor === "oldest";`,
          `  return ok({ foundAnchor, foundNewest, foundOldest });`,
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
      runProjectBuild(dir, wsConfigPath, "app");

      const generated = readFileSync(
        join(dir, "packages", "app", "generated", "App.cs"),
        "utf-8"
      );

      expect(generated).to.include("new Payload");
      expect(generated).to.not.include("__Anon");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves imported alias return types for exported source-package function values", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-imported-return-alias-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
      mkdirSync(join(dir, "packages", "messages", "src"), { recursive: true });
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

      for (const [name, rootNamespace] of [
        ["core", "Acme.Core"],
        ["messages", "Acme.Messages"],
        ["app", "Acme.App"],
      ] as const) {
        writeFileSync(
          join(dir, "packages", name, "package.json"),
          JSON.stringify(
            {
              name: `@acme/${name}`,
              private: true,
              type: "module",
              dependencies:
                name === "messages"
                  ? { "@acme/core": "workspace:*" }
                  : name === "app"
                    ? {
                        "@acme/core": "workspace:*",
                        "@acme/messages": "workspace:*",
                      }
                    : undefined,
              exports:
                name === "app"
                  ? undefined
                  : {
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
          join(dir, "packages", name, "tsonic.json"),
          JSON.stringify(
            {
              $schema: "https://tsonic.org/schema/v1.json",
              rootNamespace,
              entryPoint: name === "app" ? "src/App.ts" : "src/index.ts",
              sourceRoot: "src",
              references:
                name === "messages"
                  ? {
                      libraries: [
                        "../core/generated/bin/Release/net10.0/Acme.Core.dll",
                      ],
                    }
                  : name === "app"
                    ? {
                        libraries: [
                          "../core/generated/bin/Release/net10.0/Acme.Core.dll",
                          "../messages/generated/bin/Release/net10.0/Acme.Messages.dll",
                        ],
                      }
                    : undefined,
              outputDirectory: "generated",
              outputName: rootNamespace,
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
      }

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
          `export interface AuthenticatedUser {`,
          `  id: string;`,
          `}`,
          ``,
          `export type Ok<T> = { success: true; data: T };`,
          `export type Err<E> = { success: false; error: E };`,
          `export type Result<T, E = string> = Ok<T> | Err<E>;`,
          ``,
          `export function ok<T>(data: T): Ok<T> {`,
          `  return { success: true, data };`,
          `}`,
          ``,
          `export function err<E>(error: E): Err<E> {`,
          `  return { success: false, error };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "messages", "src", "index.ts"),
        [
          `import type { AuthenticatedUser, Result } from "@acme/core/Acme.Core.js";`,
          `import { err, ok } from "@acme/core/Acme.Core.js";`,
          ``,
          `interface SendMessageInput {`,
          `  content: string;`,
          `}`,
          ``,
          `export const sendMessageDomain = async (`,
          `  user: AuthenticatedUser,`,
          `  params: SendMessageInput`,
          `): Promise<Result<{ id: string }, string>> => {`,
          `  if (params.content === "") return err("empty");`,
          `  return ok({ id: user.id });`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { sendMessageDomain } from "@acme/messages/Acme.Messages.js";`,
          ``,
          `export async function run(): Promise<string> {`,
          `  const result = await sendMessageDomain({ id: "u1" }, { content: "hello" });`,
          `  if (!result.success) return result.error;`,
          `  return result.data.id;`,
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
      runProjectBuild(dir, wsConfigPath, "messages");
      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      const facade = readFileSync(
        join(
          dir,
          "packages",
          "messages",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Messages.d.ts"
        ),
        "utf-8"
      );
      const internal = readFileSync(
        join(
          dir,
          "packages",
          "messages",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Messages",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );

      expect(facade).to.include(
        `import type { AuthenticatedUser } from '@acme/core/Acme.Core.js';`
      );
      expect(facade).to.include(
        `import type { Result } from '@acme/core/Acme.Core.js';`
      );
      expect(facade).to.match(
        /export declare const sendMessageDomain: \(user: AuthenticatedUser, params: __Local_.*SendMessageInput\) => Promise<Result<__Anon_.*?, string>>;/
      );
      expect(facade).to.not.match(/Ok__Alias_1|Err__Alias_1/);

      expect(internal).to.include(
        `import type { AuthenticatedUser } from '@acme/core/Acme.Core.js';`
      );
      expect(internal).to.include(
        `import type { Result } from '@acme/core/Acme.Core.js';`
      );
      expect(internal).to.match(
        /static sendMessageDomain: \(user: AuthenticatedUser, params: __Local_.*SendMessageInput\) => Promise<Result<__Anon_.*?, string>>;/
      );
      expect(internal).to.not.match(/Ok__Alias_1|Err__Alias_1/);

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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
      const rootBindings = JSON.parse(
        readFileSync(join(bindingsRoot, "Acme.Core", "bindings.json"), "utf-8")
      ) as { readonly types: readonly { readonly clrName: string }[] };

      expect(rootInternal).to.not.include("export interface User$instance");
      expect(rootFacade).to.not.include(
        "export { User } from './Acme.Core/internal/index.js';"
      );
      expect(rootBindings.types.map((item) => item.clrName)).to.not.include(
        "Acme.Core.User"
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("honors included module augmentations during project build", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-augmentation-")
    );

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
      linkDir(
        join(dir, "packages", "core"),
        join(dir, "node_modules/@acme/core")
      );
      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves non-exported local type closure without leaking raw local names across namespace facades", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-private-local-closure-")
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
            dotnet: {
              packageReferences: [],
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
            name: "@acme/app",
            private: true,
            type: "module",
            dependencies: {
              "@acme/messages": "workspace:*",
            },
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
          `export { sendA } from "./domain/send-a.ts";`,
          `export { sendB } from "./domain/send-b.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "messages", "src", "domain", "send-a.ts"),
        [
          `interface SendAInput {`,
          `  value: string;`,
          `}`,
          ``,
          `export const sendA = (input: SendAInput): SendAInput => input;`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "messages", "src", "domain", "send-b.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          ``,
          `interface SendBInput {`,
          `  count: int;`,
          `}`,
          ``,
          `export const sendB = (input: SendBInput): SendBInput => input;`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import type { int } from "@tsonic/core/types.js";`,
          `import { sendA, sendB } from "@acme/messages/Acme.Messages.domain.js";`,
          ``,
          `export function run(): int {`,
          `  const left = sendA({ value: "ok" });`,
          `  const right = sendB({ count: 1 as int });`,
          `  const text: string = left.value;`,
          `  void text;`,
          `  return right.count;`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "messages");
      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      const facade = readFileSync(
        join(
          dir,
          "packages",
          "messages",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Messages.domain.d.ts"
        ),
        "utf-8"
      );
      const internal = readFileSync(
        join(
          dir,
          "packages",
          "messages",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Messages.domain",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );
      const stripInternalMarkers = (text: string): string =>
        text
          .replace(/^\s*readonly __tsonic_type_[^\n]*\n/gm, "")
          .replace(/^\s*readonly "__tsonic_binding_alias_[^"]+"[^\n]*\n/gm, "");
      const sanitizedFacade = stripInternalMarkers(facade);
      const sanitizedInternal = stripInternalMarkers(internal);

      expect(sanitizedFacade).to.include("import type { __Local_");
      expect(sanitizedFacade).to.not.match(/\bSendAInput\b/);
      expect(sanitizedFacade).to.not.match(/\bSendBInput\b/);
      expect(sanitizedInternal).to.include("export interface __Local_");
      expect(sanitizedInternal).to.not.match(/\bSendAInput\b/);
      expect(sanitizedInternal).to.not.match(/\bSendBInput\b/);

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps anonymous inline object parameters structural across source-package consumers", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-anon-param-"));

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
          `export { createUserDomain } from "./domain/create-user-domain.ts";`,
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
          "create-user-domain.ts"
        ),
        [
          `export const createUserDomain = (input: { email: string; fullName: string }): string => {`,
          `  return input.email + ":" + input.fullName;`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { createUserDomain } from "@acme/messages/Acme.Messages.js";`,
          ``,
          `export function run(): string {`,
          `  return createUserDomain({ email: "a@example.com", fullName: "Alice" });`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "messages");
      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "messages",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Messages",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );

      expect(internal).to.match(/export interface __Anon_/);
      expect(internal).to.not.match(/new\(...args: unknown\[\]\): __Anon_/);

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps anonymous inline object parameters structural when passed via local variables", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-anon-local-param-")
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
          `export { createUserDomain } from "./domain/create-user-domain.ts";`,
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
          "create-user-domain.ts"
        ),
        [
          `export const createUserDomain = (input: { email: string; fullName: string }): string => {`,
          `  return input.email + ":" + input.fullName;`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { createUserDomain } from "@acme/messages/Acme.Messages.js";`,
          ``,
          `export function run(): string {`,
          `  const input = { email: "a@example.com", fullName: "Alice" };`,
          `  return createUserDomain(input);`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "messages");
      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps anonymous inline object array parameters structural through local ToArray() values", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-anon-array-local-")
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
          `export { createDraftsDomain } from "./domain/create-drafts-domain.ts";`,
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
          "create-drafts-domain.ts"
        ),
        [
          `export const createDraftsDomain = (drafts: { type: string; to: string; topic?: string; content: string }[]): string => {`,
          `  return drafts[0]?.content ?? "";`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { List } from "@tsonic/dotnet/System.Collections.Generic.js";`,
          `import { createDraftsDomain } from "@acme/messages/Acme.Messages.js";`,
          ``,
          `export function run(): string {`,
          `  const inputs = new List<{ type: string; to: string; topic?: string; content: string }>();`,
          `  inputs.Add({ type: "stream", to: "general", topic: "hello", content: "world" });`,
          `  const drafts = inputs.ToArray();`,
          `  return createDraftsDomain(drafts);`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "messages");
      linkDir(
        join(dir, "packages", "messages"),
        join(dir, "node_modules/@acme/messages")
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps nested anonymous record value types structural across source-package consumers", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-lib-bindings-anon-record-"));

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "users", "src", "domain"), {
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
          `export { updateProfileDataDomain } from "./domain/update-profile-data-domain.ts";`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(
          dir,
          "packages",
          "users",
          "src",
          "domain",
          "update-profile-data-domain.ts"
        ),
        [
          `export const updateProfileDataDomain = (profileData: Record<string, { value: string }>): string => {`,
          `  const item = profileData["name"];`,
          `  return item === undefined ? "" : item.value;`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { updateProfileDataDomain } from "@acme/users/Acme.Users.js";`,
          ``,
          `export function run(): string {`,
          `  return updateProfileDataDomain({ name: { value: "Alice" } });`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "users");
      linkDir(
        join(dir, "packages", "users"),
        join(dir, "node_modules/@acme/users")
      );

      const internal = readFileSync(
        join(
          dir,
          "packages",
          "users",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Users",
          "internal",
          "index.d.ts"
        ),
        "utf-8"
      );

      expect(internal).to.not.match(/readonly __tsonic_type_[^\n]*__Anon_/);
      expect(internal).to.not.match(/new\(...args: unknown\[\]\): __Anon_/);

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps same-named local helper types from sibling namespaces unambiguous for consumers", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-sibling-local-type-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "channels", "src", "domain"), {
        recursive: true,
      });
      mkdirSync(join(dir, "packages", "channels", "src", "repo"), {
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
        join(dir, "packages", "channels", "package.json"),
        JSON.stringify(
          {
            name: "@acme/channels",
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
        join(dir, "packages", "channels", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Channels",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Channels",
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
                "../channels/generated/bin/Release/net10.0/Acme.Channels.dll",
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
        join(dir, "packages", "channels", "src", "entities.ts"),
        [
          "export class ChannelFolder {",
          '  Id: string = "";',
          "}",
          "",
          "export class ChannelFolderItem {",
          '  ChannelId: string = "";',
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(
          dir,
          "packages",
          "channels",
          "src",
          "repo",
          "get-channel-folders.ts"
        ),
        [
          'import { ChannelFolder, ChannelFolderItem } from "../entities.ts";',
          "",
          "interface ChannelFolderWithItems {",
          "  folder: ChannelFolder;",
          "  items: ChannelFolderItem[];",
          "}",
          "",
          "export const getChannelFolders = (): ChannelFolderWithItems[] => {",
          "  const folder = new ChannelFolder();",
          '  folder.Id = "folder-1";',
          "  const item = new ChannelFolderItem();",
          '  item.ChannelId = "channel-1";',
          "  return [{ folder, items: [item] }];",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(
          dir,
          "packages",
          "channels",
          "src",
          "domain",
          "get-channel-folders-domain.ts"
        ),
        [
          'import { ChannelFolder, ChannelFolderItem } from "../entities.ts";',
          'import { getChannelFolders } from "../repo/get-channel-folders.ts";',
          "",
          "interface ChannelFolderWithItems {",
          "  folder: ChannelFolder;",
          "  items: ChannelFolderItem[];",
          "}",
          "",
          "export const getChannelFoldersDomain = (): ChannelFolderWithItems[] => {",
          "  return getChannelFolders();",
          "};",
          "",
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "channels", "src", "index.ts"),
        [
          'export { ChannelFolder, ChannelFolderItem } from "./entities.ts";',
          'export { getChannelFoldersDomain } from "./domain/get-channel-folders-domain.ts";',
          'export { getChannelFolders } from "./repo/get-channel-folders.ts";',
          "",
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          'import { getChannelFoldersDomain } from "@acme/channels/Acme.Channels.js";',
          "",
          "export function run(): string {",
          "  const folders = getChannelFoldersDomain();",
          "  const entry = folders[0];",
          '  if (entry === undefined) return "none";',
          '  return entry.folder.Id + ":" + entry.items[0]!.ChannelId;',
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "channels");

      const topLevelBindings = JSON.parse(
        readFileSync(
          join(
            dir,
            "packages",
            "channels",
            "dist",
            "tsonic",
            "bindings",
            "Acme.Channels",
            "bindings.json"
          ),
          "utf-8"
        )
      ) as {
        readonly types?: ReadonlyArray<{
          readonly clrName?: string;
          readonly alias?: string;
        }>;
      };

      expect(
        topLevelBindings.types?.some(
          (type) =>
            type.clrName === "Acme.Channels.domain.ChannelFolderWithItems" &&
            type.alias === "Acme.Channels.domain.ChannelFolderWithItems"
        )
      ).to.equal(true);
      expect(
        topLevelBindings.types?.some(
          (type) =>
            type.clrName === "Acme.Channels.repo.ChannelFolderWithItems" &&
            type.alias === "Acme.Channels.repo.ChannelFolderWithItems"
        )
      ).to.equal(true);

      linkDir(
        join(dir, "packages", "channels"),
        join(dir, "node_modules/@acme/channels")
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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

  it("preserves union-returning function signatures through source-package bindings", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-union-return-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "queue", "src"), {
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
        join(dir, "packages", "queue", "package.json"),
        JSON.stringify(
          {
            name: "@acme/queue",
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
        join(dir, "packages", "queue", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Queue",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Queue",
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
                "../queue/generated/bin/Release/net10.0/Acme.Queue.dll",
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
        join(dir, "packages", "queue", "src", "index.ts"),
        [
          `export async function getEventsFromQueue(ok: boolean): Promise<{ events: string[] } | { error: string; code?: string }> {`,
          `  if (!ok) {`,
          `    return { error: "bad", code: "BAD_QUEUE" };`,
          `  }`,
          `  return { events: ["one", "two"] };`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { getEventsFromQueue } from "@acme/queue/Acme.Queue.js";`,
          ``,
          `export async function run(ok: boolean): Promise<string> {`,
          `  const result = await getEventsFromQueue(ok);`,
          `  if ("error" in result) {`,
          `    return result.code === undefined ? result.error : result.code + ":" + result.error;`,
          `  }`,
          `  return result.events[0] ?? "";`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "queue");

      const bindings = readFileSync(
        join(
          dir,
          "packages",
          "queue",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Queue",
          "bindings.json"
        ),
        "utf-8"
      );

      expect(bindings).to.include('"semanticSignature"');
      expect(bindings).to.include('"kind": "unionType"');

      linkDir(
        join(dir, "packages", "queue"),
        join(dir, "node_modules/@acme/queue")
      );

      runProjectBuild(dir, wsConfigPath, "app");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

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

  it("preserves imported canonical types and record element shapes across source-package consumers", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-canonical-record-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
      mkdirSync(join(dir, "packages", "channels", "src"), { recursive: true });
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

      for (const [pkgName, namespace] of [
        ["core", "Acme.Core"],
        ["channels", "Acme.Channels"],
        ["app", "Acme.App"],
      ] as const) {
        writeFileSync(
          join(dir, "packages", pkgName, "package.json"),
          JSON.stringify(
            pkgName === "app"
              ? {
                  name: "app",
                  private: true,
                  type: "module",
                }
              : {
                  name: `@acme/${pkgName}`,
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
          join(dir, "packages", pkgName, "tsonic.json"),
          JSON.stringify(
            {
              $schema: "https://tsonic.org/schema/v1.json",
              rootNamespace: namespace,
              entryPoint: pkgName === "app" ? "src/App.ts" : "src/index.ts",
              sourceRoot: "src",
              references:
                pkgName === "channels"
                  ? {
                      libraries: [
                        "../core/generated/bin/Release/net10.0/Acme.Core.dll",
                      ],
                    }
                  : pkgName === "app"
                    ? {
                        libraries: [
                          "../core/generated/bin/Release/net10.0/Acme.Core.dll",
                          "../channels/generated/bin/Release/net10.0/Acme.Channels.dll",
                        ],
                      }
                    : undefined,
              outputDirectory: "generated",
              outputName: namespace,
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
      }

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
          `export class ChannelFolderItem {`,
          `  ChannelId: string = "";`,
          `}`,
          ``,
          `export class Channel {`,
          `  Id: string = "";`,
          `  Name: string = "";`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "channels", "src", "index.ts"),
        [
          `import { Channel, ChannelFolderItem } from "@acme/core/Acme.Core.js";`,
          ``,
          `export interface ChannelFolderWithItems {`,
          `  readonly items: ChannelFolderItem[];`,
          `}`,
          ``,
          `export const getChannelFoldersDomain = (): ChannelFolderWithItems[] => {`,
          `  const item = new ChannelFolderItem();`,
          `  item.ChannelId = "chan-1";`,
          `  return [{ items: [item] }];`,
          `};`,
          ``,
          `export const getAllChannels = (): Channel[] => {`,
          `  const channel = new Channel();`,
          `  channel.Id = "chan-1";`,
          `  channel.Name = "General";`,
          `  return [channel];`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { getAllChannels, getChannelFoldersDomain } from "@acme/channels/Acme.Channels.js";`,
          ``,
          `export function run(): string {`,
          `  const folders = getChannelFoldersDomain();`,
          `  const entry = folders[0];`,
          `  if (entry === undefined) return "none";`,
          `  const allChannels = getAllChannels();`,
          `  const channelMap: Record<string, typeof allChannels[0]> = {};`,
          `  for (let i = 0; i < allChannels.Length; i++) {`,
          `    const channel = allChannels[i];`,
          `    if (channel !== undefined) {`,
          `      channelMap[channel.Id] = channel;`,
          `    }`,
          `  }`,
          `  const mapped = channelMap[entry.items[0]!.ChannelId];`,
          `  return entry.items[0]!.ChannelId + ":" + (mapped === undefined ? "missing" : mapped.Name);`,
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

      runProjectBuild(dir, wsConfigPath, "channels");
      linkDir(
        join(dir, "packages", "channels"),
        join(dir, "node_modules/@acme/channels")
      );

      runProjectBuild(dir, wsConfigPath, "app");

      const emitted = readFileSync(
        join(dir, "packages", "app", "generated", "App.cs"),
        "utf-8"
      );

      expect(emitted).to.not.include("global::ChannelFolderItem");
      expect(emitted).to.not.include("Dictionary<string, object?> channelMap");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves indexed-access structural members through source-package declaration bindings", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-indexed-access-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "events", "src"), { recursive: true });
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
            surface: "@tsonic/js",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      for (const [pkgName, namespace] of [
        ["events", "Acme.Events"],
        ["app", "Acme.App"],
      ] as const) {
        writeFileSync(
          join(dir, "packages", pkgName, "package.json"),
          JSON.stringify(
            pkgName === "app"
              ? {
                  name: "app",
                  private: true,
                  type: "module",
                }
              : {
                  name: `@acme/${pkgName}`,
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
          join(dir, "packages", pkgName, "tsonic.json"),
          JSON.stringify(
            {
              $schema: "https://tsonic.org/schema/v1.json",
              rootNamespace: namespace,
              entryPoint: pkgName === "app" ? "src/App.ts" : "src/index.ts",
              sourceRoot: "src",
              references:
                pkgName === "app"
                  ? {
                      libraries: [
                        "../events/generated/bin/Release/net10.0/Acme.Events.dll",
                      ],
                    }
                  : undefined,
              outputDirectory: "generated",
              outputName: namespace,
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
      }

      writeFileSync(
        join(dir, "packages", "events", "src", "index.ts"),
        [
          "export interface ClientCapabilities {",
          "  notificationBadge: boolean;",
          "}",
          "",
          "export interface RegisterParams {",
          "  clientCapabilities?: ClientCapabilities;",
          "  narrow?: { operator: string; operand: string; negated?: boolean }[];",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          'import type { RegisterParams } from "@acme/events/Acme.Events.js";',
          "",
          "export function run(",
          "  clientCapabilitiesRaw: string | undefined,",
          "  narrowRaw: string | undefined",
          "): RegisterParams {",
          "  const clientCapabilities = clientCapabilitiesRaw",
          '    ? (JSON.parse(clientCapabilitiesRaw) as RegisterParams["clientCapabilities"])',
          "    : undefined;",
          "  const narrow = narrowRaw",
          '    ? (JSON.parse(narrowRaw) as RegisterParams["narrow"])',
          "    : undefined;",
          "  return { clientCapabilities, narrow };",
          "}",
          "",
        ].join("\n"),
        "utf-8"
      );

      runProjectBuild(dir, wsConfigPath, "events");

      linkDir(
        join(dir, "packages", "events"),
        join(dir, "node_modules/@acme/events")
      );

      runProjectBuild(dir, wsConfigPath, "app");

      const generated = readFileSync(
        join(dir, "packages", "app", "generated", "App.cs"),
        "utf-8"
      );
      const eventsFacade = readFileSync(
        join(
          dir,
          "packages",
          "events",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Events.d.ts"
        ),
        "utf-8"
      );
      const eventsBindingsJson = readFileSync(
        join(
          dir,
          "packages",
          "events",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Events",
          "bindings.json"
        ),
        "utf-8"
      );

      expect(generated).to.not.include("JSON.parse<object>");
      expect(generated).to.not.include("JsonSerializer.Deserialize<object>");
      expect(generated).to.include("ClientCapabilities");
      expect(generated).to.match(
        /JsonSerializer\.Deserialize<global::Acme\.Events\.__Anon_[A-Za-z0-9_]+\[]>/
      );
      expect(eventsFacade).to.include("export type { ClientCapabilities }");
      expect(eventsFacade).to.match(/export type \{ __Anon_[A-Za-z0-9_]+ \}/);
      expect(eventsBindingsJson).to.include('"operator"');
      expect(eventsBindingsJson).to.include('"operand"');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("preserves awaited imported array element shapes inside record value types", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-awaited-record-")
    );

    try {
      const wsConfigPath = join(dir, "tsonic.workspace.json");
      mkdirSync(join(dir, "packages", "core", "src"), { recursive: true });
      mkdirSync(join(dir, "packages", "channels", "src"), { recursive: true });
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

      for (const [pkgName, namespace] of [
        ["core", "Acme.Core"],
        ["channels", "Acme.Channels"],
        ["app", "Acme.App"],
      ] as const) {
        writeFileSync(
          join(dir, "packages", pkgName, "package.json"),
          JSON.stringify(
            pkgName === "app"
              ? {
                  name: "app",
                  private: true,
                  type: "module",
                }
              : {
                  name: `@acme/${pkgName}`,
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
          join(dir, "packages", pkgName, "tsonic.json"),
          JSON.stringify(
            {
              $schema: "https://tsonic.org/schema/v1.json",
              rootNamespace: namespace,
              entryPoint: pkgName === "app" ? "src/App.ts" : "src/index.ts",
              sourceRoot: "src",
              references:
                pkgName === "channels"
                  ? {
                      libraries: [
                        "../core/generated/bin/Release/net10.0/Acme.Core.dll",
                      ],
                    }
                  : pkgName === "app"
                    ? {
                        libraries: [
                          "../core/generated/bin/Release/net10.0/Acme.Core.dll",
                          "../channels/generated/bin/Release/net10.0/Acme.Channels.dll",
                        ],
                      }
                    : undefined,
              outputDirectory: "generated",
              outputName: namespace,
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
      }

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
          `export class Channel {`,
          `  Id: string = "";`,
          `  Name: string = "";`,
          `  Description: string = "";`,
          `}`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "channels", "src", "index.ts"),
        [
          `import { Channel } from "@acme/core/Acme.Core.js";`,
          ``,
          `export const getChannels = async (): Promise<Channel[]> => {`,
          `  const channel = new Channel();`,
          `  channel.Id = "chan-1";`,
          `  channel.Name = "General";`,
          `  channel.Description = "Main";`,
          `  return [channel];`,
          `};`,
          ``,
        ].join("\n"),
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "app", "src", "App.ts"),
        [
          `import { getChannels } from "@acme/channels/Acme.Channels.js";`,
          ``,
          `export async function run(): Promise<string> {`,
          `  const allChannels = await getChannels();`,
          `  const channelMap: Record<string, typeof allChannels[0]> = {};`,
          `  for (let i = 0; i < allChannels.length; i++) {`,
          `    const channel = allChannels[i];`,
          `    if (channel !== undefined) {`,
          `      channelMap[channel.Id] = channel;`,
          `    }`,
          `  }`,
          `  const mapped = channelMap["chan-1"];`,
          `  return mapped === undefined ? "missing" : mapped.Name + ":" + mapped.Description;`,
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

      runProjectBuild(dir, wsConfigPath, "channels");
      linkDir(
        join(dir, "packages", "channels"),
        join(dir, "node_modules/@acme/channels")
      );

      runProjectBuild(dir, wsConfigPath, "app");

      const emitted = readFileSync(
        join(dir, "packages", "app", "generated", "App.cs"),
        "utf-8"
      );

      expect(emitted).to.include(
        "global::System.Collections.Generic.Dictionary<string, global::Acme.Core.Channel>"
      );
      expect(emitted).to.include(
        'return mapped == null ? "missing" : mapped.Name + ":" + mapped.Description;'
      );
      expect(emitted).to.not.include(
        "global::System.Collections.Generic.Dictionary<string, object?>"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("serializes recursive first-party binding semantic graphs without circular bindings.json output", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-lib-bindings-recursive-json-")
    );

    try {
      const wsConfigPath = writeLibraryScaffold(dir, "Test.Lib", "Test.Lib");

      writeFileSync(
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export type PathSpec = string | readonly PathSpec[] | null | undefined;",
          "",
          "export interface Node {",
          "  path?: PathSpec;",
          "  next?: Node;",
          "  children?: readonly Node[];",
          "  visit(callback: (value: Node) => Node | undefined): Node | undefined;",
          "}",
          "",
          "export const head = (node: Node): Node | undefined => node.next;",
          "",
        ].join("\n"),
        "utf-8"
      );

      runLibraryBuild(dir, wsConfigPath);

      const bindingsText = readFileSync(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Test.Lib",
          "bindings.json"
        ),
        "utf-8"
      );
      const bindings = JSON.parse(bindingsText) as {
        readonly types?: ReadonlyArray<{
          readonly clrName?: string;
          readonly properties?: ReadonlyArray<{
            readonly clrName?: string;
            readonly semanticType?: {
              readonly kind?: string;
              readonly name?: string;
            };
          }>;
        }>;
        readonly exports?: Readonly<Record<string, unknown>>;
      };

      expect(bindingsText).to.not.include("[Circular]");
      expect(
        bindings.types?.some((type) => type.clrName === "Test.Lib.Node")
      ).to.equal(true);
      expect(
        bindings.types
          ?.find((type) => type.clrName === "Test.Lib.Node")
          ?.properties?.find((property) => property.clrName === "next")
          ?.semanticType
      ).to.deep.equal({
        kind: "referenceType",
        name: "Node",
        resolvedClrType: "Test.Lib.Node",
        typeId: {
          stableId: "Test.Lib:Test.Lib.Node",
          clrName: "Test.Lib.Node",
          assemblyName: "Test.Lib",
          tsName: "Node",
        },
      });
      expect(bindings.exports?.head).to.not.equal(undefined);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
