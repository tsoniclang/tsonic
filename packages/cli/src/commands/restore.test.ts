/**
 * Regression tests for `tsonic restore`.
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  copyFileSync,
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
import { restoreCommand } from "./restore.js";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../..")
);

const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

const run = (cwd: string, command: string, args: readonly string[]): void => {
  const result = spawnSync(command, args, { cwd, encoding: "utf-8" });
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || `Exit code ${result.status}`;
    throw new Error(`${command} ${args.join(" ")} failed:\n${msg}`);
  }
};

const writeNugetConfig = (projectRoot: string, feedDir: string): void => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <packageSources>
    <clear />
    <add key="local" value="${feedDir}" />
  </packageSources>
</configuration>
`;
  writeFileSync(join(projectRoot, "nuget.config"), xml, "utf-8");
};

const createNugetPackage = (
  workDir: string,
  feedDir: string,
  pkg: {
    id: string;
    version: string;
    deps?: readonly { id: string; version: string }[];
    includeBuildOutput?: boolean;
  }
): void => {
  const projDir = join(workDir, `${pkg.id}.${pkg.version}`);
  mkdirSync(projDir, { recursive: true });

  const includeBuildOutput =
    pkg.includeBuildOutput === undefined ? true : pkg.includeBuildOutput;

  const deps =
    pkg.deps && pkg.deps.length > 0
      ? `<ItemGroup>\n${pkg.deps
          .map(
            (d) =>
              `  <PackageReference Include="${d.id}" Version="${d.version}" />`
          )
          .join("\n")}\n</ItemGroup>\n`
      : "";

  const includeBuildOutputProp = includeBuildOutput
    ? ""
    : "    <IncludeBuildOutput>false</IncludeBuildOutput>\n";

  const csproj = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
${includeBuildOutputProp}
    <PackageId>${pkg.id}</PackageId>
    <Version>${pkg.version}</Version>
  </PropertyGroup>
${deps}</Project>
`;
  writeFileSync(join(projDir, `${pkg.id}.csproj`), csproj, "utf-8");
  writeFileSync(
    join(projDir, "Class1.cs"),
    `namespace ${pkg.id.replace(/\./g, "_")};\npublic sealed class ${pkg.id
      .split(".")
      .pop()}Type { }\n`,
    "utf-8"
  );

  run(projDir, "dotnet", ["pack", "-c", "Release", "-o", feedDir, "--nologo"]);
};

describe("restore command", function () {
  this.timeout(10 * 60 * 1000);

  it("ignores built-in runtime DLLs in dotnet.libraries", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-runtime-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "libs"), { recursive: true });
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Built-in runtime DLLs should never trigger bindings generation.
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: ["libs/Tsonic.Runtime.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide the runtime DLL.
      copyFileSync(
        join(repoRoot, "packages/cli/runtime/Tsonic.Runtime.dll"),
        join(dir, "libs/Tsonic.Runtime.dll")
      );

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for the runtime DLL.
      expect(existsSync(join(dir, "node_modules", "tsonic-runtime-types"))).to.equal(
        false
      );

      // restore does not rewrite the config; it simply ignores runtime DLLs for bindings generation.
      const updated = JSON.parse(readFileSync(join(dir, "tsonic.workspace.json"), "utf-8")) as {
        dotnet?: { libraries?: unknown };
      };
      expect(updated.dotnet?.libraries).to.deep.equal(["libs/Tsonic.Runtime.dll"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores DLL references outside libs/ (e.g., workspace outputs)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-workspace-dll-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Simulate a workspace-dependent project that references another project's output DLL.
      // This DLL may not exist until the dependency is built. `tsonic restore` must not fail
      // or attempt bindings generation for such paths (only ./libs/*.dll are eligible).
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: ["../domain/dist/net10.0/Acme.Domain.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for workspace output DLL references.
      expect(
        existsSync(join(dir, "node_modules", "acme-domain-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips bindings generation for DLLs with an explicit 'types' mapping", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-types-"));
    try {
      mkdirSync(join(dir, "libs"), { recursive: true });
      mkdirSync(join(dir, "csharp"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Build a tiny local DLL (no dependencies outside the framework).
      writeFileSync(
        join(dir, "csharp", "Acme.Test.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Acme.Test</AssemblyName>
  </PropertyGroup>
</Project>
`,
        "utf-8"
      );
      writeFileSync(
        join(dir, "csharp", "Class1.cs"),
        `namespace Acme.Test;\npublic sealed class Demo { }\n`,
        "utf-8"
      );

      const build = spawnSync(
        "dotnet",
        ["build", join(dir, "csharp", "Acme.Test.csproj"), "-c", "Release", "-o", join(dir, "libs"), "--nologo"],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(build.status, build.stderr || build.stdout).to.equal(0);

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      // Provide an external bindings package root.
      const typesPkg = join(dir, "node_modules/@acme/acme-test-types");
      mkdirSync(typesPkg, { recursive: true });
      writeFileSync(
        join(typesPkg, "package.json"),
        JSON.stringify({ name: "@acme/acme-test-types", version: "0.0.0", type: "module" }, null, 2) + "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: [{ path: "libs/Acme.Test.dll", types: "@acme/acme-test-types" }],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      // Should not generate bindings for the DLL since it's mapped to an external types package.
      expect(existsSync(join(dir, "node_modules", "acme-test-types"))).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a DLL has a 'types' mapping but the package is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-types-missing-"));
    try {
      mkdirSync(join(dir, "libs"), { recursive: true });
      mkdirSync(join(dir, "csharp"), { recursive: true });

      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      writeFileSync(
        join(dir, "csharp", "Acme.Test.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>Acme.Test</AssemblyName>
  </PropertyGroup>
</Project>
`,
        "utf-8"
      );
      writeFileSync(
        join(dir, "csharp", "Class1.cs"),
        `namespace Acme.Test;\npublic sealed class Demo { }\n`,
        "utf-8"
      );

      const build = spawnSync(
        "dotnet",
        ["build", join(dir, "csharp", "Acme.Test.csproj"), "-c", "Release", "-o", join(dir, "libs"), "--nologo"],
        { cwd: dir, encoding: "utf-8" }
      );
      expect(build.status, build.stderr || build.stdout).to.equal(0);

      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: [{ path: "libs/Acme.Test.dll", types: "@acme/acme-test-types" }],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error).to.include("Bindings package not found");
        expect(result.error).to.include("@acme/acme-test-types");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips bindings generation for NuGet packages with 'types: false'", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-nuget-types-false-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
        "utf-8"
      );

      // Provide required standard bindings packages (no network).
      linkDir(
        join(repoRoot, "node_modules/@tsonic/dotnet"),
        join(dir, "node_modules/@tsonic/dotnet")
      );
      linkDir(
        join(repoRoot, "node_modules/@tsonic/core"),
        join(dir, "node_modules/@tsonic/core")
      );

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);

      createNugetPackage(dir, feedDir, { id: "Acme.A", version: "1.0.0" });
      createNugetPackage(dir, feedDir, { id: "Acme.Tooling", version: "1.0.0" });

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              frameworkReferences: [],
              libraries: [],
              packageReferences: [
                { id: "Acme.A", version: "1.0.0" },
                { id: "Acme.Tooling", version: "1.0.0", types: false },
              ],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      expect(existsSync(join(dir, "node_modules", "acme-a-types"))).to.equal(true);
      expect(existsSync(join(dir, "node_modules", "acme-tooling-types"))).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails fast when a generated NuGet package depends on a 'types: false' package", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-nuget-types-false-dep-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
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

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);

      createNugetPackage(dir, feedDir, { id: "Acme.B", version: "1.0.0" });
      createNugetPackage(dir, feedDir, {
        id: "Acme.A",
        version: "1.0.0",
        deps: [{ id: "Acme.B", version: "1.0.0" }],
      });

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              frameworkReferences: [],
              libraries: [],
              packageReferences: [
                { id: "Acme.A", version: "1.0.0" },
                { id: "Acme.B", version: "1.0.0", types: false },
              ],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(false);
      if (!result.ok) {
        expect(result.error).to.include("types: false");
        expect(result.error).to.include("Acme.B");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates real bindings for meta-package roots by claiming dependency DLLs", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-nuget-meta-root-"));
    try {
      writeFileSync(
        join(dir, "package.json"),
        JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
          "\n",
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

      const feedDir = join(dir, "feed");
      mkdirSync(feedDir, { recursive: true });
      writeNugetConfig(dir, feedDir);

      createNugetPackage(dir, feedDir, { id: "Acme.A", version: "1.0.0" });
      createNugetPackage(dir, feedDir, {
        id: "Acme.Meta",
        version: "1.0.0",
        includeBuildOutput: false,
        deps: [{ id: "Acme.A", version: "1.0.0" }],
      });

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              frameworkReferences: [],
              libraries: [],
              packageReferences: [{ id: "Acme.Meta", version: "1.0.0" }],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), { quiet: true });
      expect(result.ok).to.equal(true);

      const metaTypesDir = join(dir, "node_modules", "acme-meta-types");
      const aTypesDir = join(dir, "node_modules", "acme-a-types");
      expect(existsSync(metaTypesDir)).to.equal(true);
      expect(existsSync(aTypesDir)).to.equal(false);

      // Meta root bindings package must contain real bindings.json for dependency namespaces.
      expect(existsSync(join(metaTypesDir, "Acme_A", "bindings.json"))).to.equal(true);
      expect(existsSync(join(metaTypesDir, "Acme_A.js"))).to.equal(true);
      expect(existsSync(join(metaTypesDir, "Acme_A.d.ts"))).to.equal(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
