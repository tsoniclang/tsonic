import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BindingRegistry, loadBindings } from "./bindings.js";
import {
  resolveSourceBindingFiles,
  resolveSourceBackedBindingFiles,
} from "./source-binding-imports.js";

describe("resolveSourceBindingFiles", () => {
  it("prefers authoritative source-package roots over stale installed packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-source-binding-imports-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const projectRoot = path.join(workspaceRoot, "proof", "js");
      const resolverFile = path.join(projectRoot, "__tsonic_resolver__.ts");
      const installedJsRoot = path.join(
        projectRoot,
        "node_modules",
        "@tsonic",
        "js"
      );
      const authoritativeJsRoot = path.join(
        workspaceRoot,
        "js-next",
        "versions",
        "10"
      );

      fs.mkdirSync(projectRoot, { recursive: true });
      fs.mkdirSync(installedJsRoot, { recursive: true });
      fs.mkdirSync(path.join(authoritativeJsRoot, "src"), { recursive: true });
      fs.mkdirSync(path.join(authoritativeJsRoot, "tsonic"), {
        recursive: true,
      });
      fs.writeFileSync(resolverFile, "export {};\n");

      fs.writeFileSync(
        path.join(installedJsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "9.9.9", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(authoritativeJsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "10.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(authoritativeJsRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                "./console.js": "./src/console.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(authoritativeJsRoot, "src", "console.ts"),
        "export const console = { error: (..._args: unknown[]) => undefined };\n"
      );

      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js.bindings.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "js",
            type: "js.console",
            sourceImport: "@tsonic/js/console.js",
          },
        },
      });

      const result = resolveSourceBindingFiles(
        bindings,
        ["global"],
        resolverFile,
        projectRoot,
        "@tsonic/js",
        new Map<string, string>([["@tsonic/js", authoritativeJsRoot]])
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value).to.deep.equal([
        path.join(authoritativeJsRoot, "src", "console.ts"),
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("includes source-owned type member files for authoritative source packages", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-source-backed-binding-files-")
    );

    try {
      const projectRoot = path.join(tempDir, "app");
      const resolverFile = path.join(projectRoot, "__tsonic_resolver__.ts");
      const surfaceRoot = path.join(projectRoot, "node_modules", "@fixture", "js");
      const stringPath = path.join(surfaceRoot, "src", "String.ts");
      const timersPath = path.join(surfaceRoot, "src", "timers.ts");

      fs.mkdirSync(path.join(surfaceRoot, "src"), { recursive: true });
      fs.writeFileSync(resolverFile, "export {};\n");
      fs.writeFileSync(
        path.join(surfaceRoot, "package.json"),
        JSON.stringify(
          { name: "@fixture/js", version: "1.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@fixture/js"],
            source: {
              namespace: "fixture.js",
              ambient: ["./globals.ts"],
              exports: {
                "./String.js": "./src/String.ts",
                "./timers.js": "./src/timers.ts",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(surfaceRoot, "globals.ts"),
        [
          "declare global {",
          "  interface String {",
          "    trim(): string;",
          "  }",
          "",
          "  function setInterval(",
          "    handler: (...args: unknown[]) => void,",
          "    timeout?: number,",
          "    ...args: unknown[]",
          "  ): number;",
          "}",
          "",
          "export {};",
        ].join("\n")
      );
      fs.writeFileSync(
        stringPath,
        [
          "export const trim = (value: string): string => value;",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        timersPath,
        [
          "export const setInterval = (",
          "  _handler: (...args: unknown[]) => void,",
          "  _timeout?: number,",
          "  ..._args: unknown[]",
          "): number => 0;",
          "",
        ].join("\n")
      );

      const bindings = loadBindings([surfaceRoot]);
      const result = resolveSourceBackedBindingFiles(
        bindings,
        resolverFile,
        projectRoot,
        "@fixture/js",
        new Map<string, string>([["@fixture/js", surfaceRoot]])
      );

      expect(result.ok).to.equal(true);
      if (!result.ok) return;

      expect(result.value).to.include(stringPath);
      expect(result.value).to.include(timersPath);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
