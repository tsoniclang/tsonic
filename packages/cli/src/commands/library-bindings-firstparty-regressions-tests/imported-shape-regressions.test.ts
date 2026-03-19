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
