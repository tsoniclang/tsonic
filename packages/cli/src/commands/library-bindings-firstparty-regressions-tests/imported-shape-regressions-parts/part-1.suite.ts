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
import { linkDir, repoRoot, runProjectBuild } from "../test-helpers.js";

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
});
