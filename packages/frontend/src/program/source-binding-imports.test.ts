import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { BindingRegistry } from "./bindings.js";
import { resolveSourceBindingFiles } from "./source-binding-imports.js";

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
        path.join(authoritativeJsRoot, "tsonic", "package-manifest.json"),
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
            assembly: "Tsonic.JSRuntime",
            type: "Tsonic.JSRuntime.console",
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
});
