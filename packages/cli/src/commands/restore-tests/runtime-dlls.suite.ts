import { describe, it } from "mocha";
import { expect } from "chai";
import { mkdtempSync, rmSync } from "node:fs";
import { restoreCommand } from "../restore.js";
import {
  copyFileSync,
  existsSync,
  join,
  linkStandardBindings,
  mkdirSync,
  repoRoot,
  run,
  tmpdir,
  writeFileSync,
  writeWorkspacePackageJson,
} from "./helpers.js";

describe("restore command (runtime and local DLLs)", function () {
  this.timeout(10 * 60 * 1000);

  it("ignores built-in runtime DLLs in dotnet.libraries", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-runtime-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "libs"), { recursive: true });
      writeWorkspacePackageJson(dir);
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
      copyFileSync(
        join(repoRoot, "packages/cli/runtime/Tsonic.Runtime.dll"),
        join(dir, "libs/Tsonic.Runtime.dll")
      );
      linkStandardBindings(dir);

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(
        existsSync(join(dir, "node_modules", "tsonic-runtime-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores built-in runtime assemblies even when DLL file name is custom", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-runtime-alias-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      mkdirSync(join(dir, "libs"), { recursive: true });
      writeWorkspacePackageJson(dir);
      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: ["libs/runtime-alias.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );
      copyFileSync(
        join(repoRoot, "packages/cli/runtime/Tsonic.Runtime.dll"),
        join(dir, "libs/runtime-alias.dll")
      );
      linkStandardBindings(dir);

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(
        existsSync(join(dir, "node_modules", "runtime-alias-types"))
      ).to.equal(false);
      expect(
        existsSync(join(dir, "node_modules", "tsonic-runtime-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("generates bindings for DLLs that reference Tsonic.Runtime without requiring libs/Tsonic.Runtime.dll", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-dll-runtime-"));
    try {
      mkdirSync(join(dir, "libs"), { recursive: true });
      mkdirSync(join(dir, "csharp"), { recursive: true });
      mkdirSync(join(dir, "node_modules"), { recursive: true });
      writeWorkspacePackageJson(dir);
      linkStandardBindings(dir, ["@tsonic/tsbindgen"]);

      const runtimeDll = join(
        repoRoot,
        "packages/cli/runtime/Tsonic.Runtime.dll"
      );
      writeFileSync(
        join(dir, "csharp", "TestLib.csproj"),
        `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>TestLib</AssemblyName>
  </PropertyGroup>
  <ItemGroup>
    <Reference Include="Tsonic.Runtime">
      <HintPath>${runtimeDll}</HintPath>
    </Reference>
  </ItemGroup>
</Project>
`,
        "utf-8"
      );
      writeFileSync(
        join(dir, "csharp", "Api.cs"),
        `namespace TestLib;\npublic static class Api { public static global::Tsonic.Runtime.Union<int, int> Make(int x) => default; }\n`,
        "utf-8"
      );

      run(join(dir, "csharp"), "dotnet", [
        "build",
        "-c",
        "Release",
        "-o",
        join(dir, "libs"),
        "--nologo",
      ]);
      expect(existsSync(join(dir, "libs", "TestLib.dll"))).to.equal(true);

      writeFileSync(
        join(dir, "tsonic.workspace.json"),
        JSON.stringify(
          {
            $schema: "https://tsonic.org/schema/workspace/v1.json",
            dotnetVersion: "net10.0",
            dotnet: {
              libraries: ["libs/TestLib.dll"],
              frameworkReferences: [],
              packageReferences: [],
            },
          },
          null,
          2
        ) + "\n",
        "utf-8"
      );

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(existsSync(join(dir, "node_modules", "test-lib-types"))).to.equal(
        true
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores DLL references outside libs/ (e.g., workspace outputs)", () => {
    const dir = mkdtempSync(join(tmpdir(), "tsonic-restore-workspace-dll-"));
    try {
      mkdirSync(join(dir, "src"), { recursive: true });
      writeWorkspacePackageJson(dir);
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
      linkStandardBindings(dir);

      const result = restoreCommand(join(dir, "tsonic.workspace.json"), {
        quiet: true,
      });
      expect(result.ok).to.equal(true);
      expect(
        existsSync(join(dir, "node_modules", "acme-domain-types"))
      ).to.equal(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
