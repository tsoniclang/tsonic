import { describe, it } from "mocha";
import { expect } from "chai";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../config.js";
import { buildCommand } from "./build.js";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

describe("build command (native source-package libraries)", function () {
  this.timeout(10 * 60 * 1000);

  it("emits source-package dist artifacts when project manifest declares a tsonic-source-package", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-build-source-package-"));

    try {
      mkdirSync(join(dir, "packages", "lib", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
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
        join(dir, "packages", "lib", "package.json"),
        JSON.stringify(
          {
            name: "@acme/lib",
            version: "1.0.0",
            private: true,
            type: "module",
            exports: {
              ".": "./src/index.ts",
              "./index.js": "./src/index.ts",
            },
            files: ["src/**/*.ts", "tsonic.package.json"],
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "tsonic.package.json"),
        JSON.stringify(
          {
            schemaVersion: 1,
            kind: "tsonic-source-package",
            surfaces: ["@tsonic/js"],
            source: {
              exports: {
                ".": "./src/index.ts",
                "./index.js": "./src/index.ts",
              },
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Lib",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Lib",
            output: {
              type: "library",
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
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export function double(value: number): number {",
          "  return value * 2;",
          "}",
          "",
        ].join("\n"),
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

      const config = resolveConfig(
        {
          dotnetVersion: "net10.0",
        },
        {
          rootNamespace: "Acme.Lib",
          entryPoint: "src/index.ts",
          sourceRoot: "src",
          outputDirectory: "generated",
          outputName: "Acme.Lib",
          output: {
            type: "library",
            nativeAot: false,
            generateDocumentation: false,
            includeSymbols: false,
            packable: false,
          },
        },
        {},
        dir,
        join(dir, "packages", "lib")
      );

      const result = buildCommand(config);
      expect(result.ok).to.equal(true);

      expect(existsSync(join(dir, "packages", "lib", "dist", "package.json"))).to.equal(
        true
      );
      expect(
        existsSync(
          join(
            dir,
            "packages",
            "lib",
            "dist",
            "tsonic.package.json"
          )
        )
      ).to.equal(true);
      expect(
        existsSync(join(dir, "packages", "lib", "dist", "src", "index.ts"))
      ).to.equal(true);
      expect(
        existsSync(join(dir, "packages", "lib", "dist", "src", "index.d.ts"))
      ).to.equal(true);
      expect(
        existsSync(join(dir, "packages", "lib", "dist", "tsonic", "bindings"))
      ).to.equal(false);

      const manifest = JSON.parse(
        readFileSync(
          join(
            dir,
            "packages",
            "lib",
            "dist",
            "tsonic.package.json"
          ),
          "utf-8"
        )
      ) as { readonly kind?: string };
      expect(manifest.kind).to.equal("tsonic-source-package");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails library builds that do not declare a source-package manifest", () => {
    const dir = mkdtempSync(
      join(tmpdir(), "tsonic-build-library-without-manifest-")
    );

    try {
      mkdirSync(join(dir, "packages", "lib", "src"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify(
          { name: "test-workspace", private: true, type: "module" },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
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
        join(dir, "packages", "lib", "package.json"),
        JSON.stringify(
          {
            name: "@acme/lib",
            version: "1.0.0",
            private: true,
            type: "module",
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "packages", "lib", "tsonic.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/v1.json",
            rootNamespace: "Acme.Lib",
            entryPoint: "src/index.ts",
            sourceRoot: "src",
            outputDirectory: "generated",
            outputName: "Acme.Lib",
            output: {
              type: "library",
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
        join(dir, "packages", "lib", "src", "index.ts"),
        [
          "export function double(value: number): number {",
          "  return value * 2;",
          "}",
          "",
        ].join("\n"),
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

      const config = resolveConfig(
        {
          dotnetVersion: "net10.0",
        },
        {
          rootNamespace: "Acme.Lib",
          entryPoint: "src/index.ts",
          sourceRoot: "src",
          outputDirectory: "generated",
          outputName: "Acme.Lib",
          output: {
            type: "library",
            nativeAot: false,
            generateDocumentation: false,
            includeSymbols: false,
            packable: false,
          },
        },
        {},
        dir,
        join(dir, "packages", "lib")
      );

      const result = buildCommand(config);
      expect(result.ok).to.equal(false);
      if (result.ok) return;

      expect(result.error).to.include(
        "Source-package build requires tsonic.package.json"
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
