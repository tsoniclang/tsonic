import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadClrCatalog } from "./clr-catalog.js";

describe("loadClrCatalog", () => {
  it("ignores surface binding manifests that do not carry CLR types", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const jsRoot = path.join(nodeModulesRoot, "@tsonic", "js");
      const runtimeNsRoot = path.join(jsRoot, "Tsonic.JSRuntime");
      const runtimeInternalRoot = path.join(runtimeNsRoot, "internal");

      fs.mkdirSync(runtimeInternalRoot, { recursive: true });
      fs.writeFileSync(
        path.join(jsRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/js", version: "0.0.0", type: "module" },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(jsRoot, "bindings.json"),
        JSON.stringify(
          {
            bindings: {
              console: {
                kind: "global",
                assembly: "Tsonic.JSRuntime",
                type: "Tsonic.JSRuntime.console",
              },
            },
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(runtimeNsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "Tsonic.JSRuntime",
            types: [
              {
                stableId: "Tsonic.JSRuntime:Tsonic.JSRuntime.console",
                clrName: "Tsonic.JSRuntime.console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: false,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "Tsonic.JSRuntime",
              },
            ],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(runtimeInternalRoot, "index.d.ts"),
        "export {};\n"
      );

      const catalog = loadClrCatalog(nodeModulesRoot);
      expect(catalog.entries.size).to.equal(1);
      expect(
        catalog.entries.has("Tsonic.JSRuntime:Tsonic.JSRuntime.console")
      ).to.equal(true);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("skips unreadable directories while scanning CLR bindings", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-catalog-")
    );

    const unreadableDir = path.join(
      tempDir,
      "node_modules",
      "@tsonic",
      "blocked",
      "secret"
    );

    try {
      const nodeModulesRoot = path.join(tempDir, "node_modules");
      const dotnetRoot = path.join(nodeModulesRoot, "@tsonic", "dotnet");
      const dotnetNsRoot = path.join(dotnetRoot, "System");
      const dotnetInternalRoot = path.join(dotnetNsRoot, "internal");

      fs.mkdirSync(dotnetInternalRoot, { recursive: true });
      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetNsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "System",
            types: [
              {
                stableId: "System:System.Console",
                clrName: "System.Console",
                kind: "class",
                accessibility: "public",
                isAbstract: false,
                isSealed: true,
                isStatic: true,
                arity: 0,
                methods: [],
                properties: [],
                fields: [],
                constructors: [],
                assemblyName: "System.Console",
              },
            ],
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetInternalRoot, "index.d.ts"),
        "export {};\n"
      );

      fs.mkdirSync(unreadableDir, { recursive: true });
      fs.chmodSync(unreadableDir, 0);

      const catalog = loadClrCatalog(nodeModulesRoot);
      expect(catalog.entries.has("System:System.Console")).to.equal(true);
    } finally {
      if (fs.existsSync(unreadableDir)) {
        fs.chmodSync(unreadableDir, 0o755);
      }
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
