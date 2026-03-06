import { expect } from "chai";
import { describe, it } from "mocha";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadDotnetMetadata } from "./metadata.js";

describe("Program Metadata", () => {
  it("should load CLR metadata through surface package dependencies", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-metadata-")
    );

    try {
      const globalsRoot = path.join(tempDir, "node_modules/@tsonic/globals");
      const dotnetRoot = path.join(tempDir, "node_modules/@tsonic/dotnet");
      const dotnetBindingsRoot = path.join(dotnetRoot, "System");

      fs.mkdirSync(globalsRoot, { recursive: true });
      fs.mkdirSync(dotnetBindingsRoot, { recursive: true });

      fs.writeFileSync(
        path.join(globalsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/globals",
            version: "0.0.0",
            type: "module",
            dependencies: {
              "@tsonic/dotnet": "0.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(globalsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "clr",
            extends: [],
            requiredTypeRoots: ["."],
            requiredNpmPackages: ["@tsonic/globals", "@tsonic/dotnet"],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetBindingsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "System",
            types: [
              {
                clrName: "System.String",
                kind: "Class",
                methods: [
                  {
                    clrName: "Trim",
                    parameterCount: 0,
                    canonicalSignature: "():System.String",
                  },
                ],
              },
            ],
          },
          null,
          2
        )
      );

      const metadata = loadDotnetMetadata([globalsRoot]);
      expect(metadata.getTypeMetadata("System.String")).to.not.equal(undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should load CLR metadata through sibling workspace package dependencies", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-program-metadata-sibling-")
    );

    try {
      const workspaceRoot = path.join(tempDir, "tsoniclang");
      const globalsRoot = path.join(workspaceRoot, "globals", "versions", "10");
      const dotnetRoot = path.join(workspaceRoot, "dotnet", "versions", "10");
      const dotnetBindingsRoot = path.join(dotnetRoot, "System");

      fs.mkdirSync(globalsRoot, { recursive: true });
      fs.mkdirSync(dotnetBindingsRoot, { recursive: true });

      fs.writeFileSync(
        path.join(globalsRoot, "package.json"),
        JSON.stringify(
          {
            name: "@tsonic/globals",
            version: "0.0.0",
            type: "module",
            dependencies: {
              "@tsonic/dotnet": "0.0.0",
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(globalsRoot, "tsonic.surface.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            id: "clr",
            extends: [],
            requiredTypeRoots: ["."],
            requiredNpmPackages: ["@tsonic/globals", "@tsonic/dotnet"],
          },
          null,
          2
        )
      );

      fs.writeFileSync(
        path.join(dotnetRoot, "package.json"),
        JSON.stringify(
          { name: "@tsonic/dotnet", version: "0.0.0", type: "module" },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(dotnetBindingsRoot, "bindings.json"),
        JSON.stringify(
          {
            namespace: "System",
            types: [
              {
                clrName: "System.String",
                kind: "Class",
                methods: [
                  {
                    clrName: "Trim",
                    parameterCount: 0,
                    canonicalSignature: "():System.String",
                  },
                ],
              },
            ],
          },
          null,
          2
        )
      );

      const metadata = loadDotnetMetadata([globalsRoot]);
      expect(metadata.getTypeMetadata("System.String")).to.not.equal(undefined);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
