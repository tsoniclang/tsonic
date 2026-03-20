import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

      const topLevelBindings = readFirstPartyBindingsJson(
        join(
          dir,
          "packages",
          "channels",
          "dist",
          "tsonic",
          "bindings",
          "Acme.Channels",
          "bindings.json"
        )
      );

      expect(
        topLevelBindings.dotnet?.types?.some(
          (type) =>
            type.clrName === "Acme.Channels.domain.ChannelFolderWithItems" &&
            type.alias === "Acme.Channels.domain.ChannelFolderWithItems"
        )
      ).to.equal(true);
      expect(
        topLevelBindings.dotnet?.types?.some(
          (type) =>
            type.clrName === "Acme.Channels.repo.ChannelFolderWithItems" &&
            type.alias === "Acme.Channels.repo.ChannelFolderWithItems"
        )
      ).to.equal(true);
      expect(
        topLevelBindings.semanticSurface?.types?.some(
          (type) => type.alias === "Acme.Channels.domain.ChannelFolderWithItems"
        )
      ).to.equal(true);
      expect(
        topLevelBindings.semanticSurface?.types?.some(
          (type) => type.alias === "Acme.Channels.repo.ChannelFolderWithItems"
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
});
