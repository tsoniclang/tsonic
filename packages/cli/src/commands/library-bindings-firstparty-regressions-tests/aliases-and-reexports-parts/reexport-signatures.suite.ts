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
  runLibraryBuild,
  runProjectBuild,
  writeLibraryScaffold,
} from "../test-helpers.js";

describe("library bindings first-party regressions (re-export signatures)", function () {
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
      const rootBindings = readFirstPartyBindingsJson(
        join(bindingsRoot, "Acme.Messages", "bindings.json")
      );

      expect(rootInternal).to.include(
        'readonly "__tsonic_binding_alias_Acme.Messages.domain.SendMessageInput"?: never;'
      );
      expect(rootInternal).to.not.include(
        'readonly "__tsonic_binding_alias_Acme.Messages.SendMessageInput"?: never;'
      );
      expect(
        (rootBindings.dotnet?.types ?? []).map((item) => item.clrName)
      ).to.not.include("Acme.Messages.SendMessageInput");
      expect(
        (rootBindings.dotnet?.types ?? []).map((item) => item.clrName)
      ).to.include("Acme.Messages.domain.SendMessageInput");
      expect(
        (rootBindings.semanticSurface?.types ?? []).map((item) => item.alias)
      ).to.include("Acme.Messages.domain.SendMessageInput");

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

      const bindings = readFirstPartyBindingsJson(
        join(
          dir,
          "packages",
          "lib",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Bool",
          "bindings.json"
        )
      );

      const methods = (bindings.dotnet?.types ?? []).flatMap(
        (type) =>
          (type.methods ?? []) as ReadonlyArray<{
            readonly clrName?: string;
            readonly normalizedSignature?: string;
          }>
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
});
