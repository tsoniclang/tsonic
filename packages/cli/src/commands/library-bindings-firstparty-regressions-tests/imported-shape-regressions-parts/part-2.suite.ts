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
import { linkDir, runProjectBuild } from "../test-helpers.js";

describe("library bindings first-party regressions", function () {
  this.timeout(10 * 60 * 1000);
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
});
