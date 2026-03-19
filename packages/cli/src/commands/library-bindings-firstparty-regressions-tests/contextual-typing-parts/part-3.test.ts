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


});
