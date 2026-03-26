import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDotnetProcessEnv } from "../../dotnet/nuget-config.js";

export {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  tmpdir,
  writeFileSync,
};
export { join };

export const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);

export const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

export const run = (
  cwd: string,
  command: string,
  args: readonly string[]
): void => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf-8",
    env: command === "dotnet" ? buildDotnetProcessEnv(cwd) : process.env,
  });
  if (result.status !== 0) {
    const msg = result.stderr || result.stdout || `Exit code ${result.status}`;
    throw new Error(`${command} ${args.join(" ")} failed:\n${msg}`);
  }
};

export const writeWorkspacePackageJson = (projectRoot: string): void => {
  writeFileSync(
    join(projectRoot, "package.json"),
    JSON.stringify({ name: "test", private: true, type: "module" }, null, 2) +
      "\n",
    "utf-8"
  );
};

export const linkStandardBindings = (
  projectRoot: string,
  extraPackages: readonly string[] = []
): void => {
  linkDir(
    join(repoRoot, "node_modules/@tsonic/dotnet"),
    join(projectRoot, "node_modules/@tsonic/dotnet")
  );
  linkDir(
    join(repoRoot, "node_modules/@tsonic/core"),
    join(projectRoot, "node_modules/@tsonic/core")
  );
  for (const packageName of extraPackages) {
    linkDir(
      join(repoRoot, `node_modules/${packageName}`),
      join(projectRoot, `node_modules/${packageName}`)
    );
  }
};

export const writeNugetConfig = (
  projectRoot: string,
  feedDir: string
): void => {
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

export const createNugetPackage = (
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

  const deps =
    pkg.deps && pkg.deps.length > 0
      ? `<ItemGroup>\n${pkg.deps
          .map(
            (dep) =>
              `  <PackageReference Include="${dep.id}" Version="${dep.version}" />`
          )
          .join("\n")}\n</ItemGroup>\n`
      : "";

  const includeBuildOutputProp =
    pkg.includeBuildOutput === false
      ? "    <IncludeBuildOutput>false</IncludeBuildOutput>\n"
      : "";

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

export const buildSimpleDll = (
  dir: string,
  assemblyName: string,
  namespaceName: string = assemblyName
): void => {
  mkdirSync(join(dir, "libs"), { recursive: true });
  mkdirSync(join(dir, "csharp"), { recursive: true });
  writeFileSync(
    join(dir, "csharp", `${assemblyName}.csproj`),
    `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>false</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>${assemblyName}</AssemblyName>
  </PropertyGroup>
</Project>
`,
    "utf-8"
  );
  writeFileSync(
    join(dir, "csharp", "Class1.cs"),
    `namespace ${namespaceName};\npublic sealed class Demo { }\n`,
    "utf-8"
  );

  run(dir, "dotnet", [
    "build",
    join(dir, "csharp", `${assemblyName}.csproj`),
    "-c",
    "Release",
    "-o",
    join(dir, "libs"),
    "--nologo",
  ]);
};
