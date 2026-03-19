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
import { linkDir, repoRoot, runProjectBuild } from "./test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
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


});
