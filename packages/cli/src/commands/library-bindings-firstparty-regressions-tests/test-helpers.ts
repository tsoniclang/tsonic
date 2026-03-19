import { spawnSync } from "node:child_process";
import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect } from "chai";

export const repoRoot = resolve(
  join(dirname(fileURLToPath(import.meta.url)), "../../../../..")
);

export const linkDir = (target: string, linkPath: string): void => {
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
};

export const writeLibraryScaffold = (
  dir: string,
  rootNamespace: string,
  outputName: string
): string => {
  const wsConfigPath = join(dir, "tsonic.workspace.json");
  mkdirSync(join(dir, "packages", "lib", "src"), { recursive: true });
  mkdirSync(join(dir, "node_modules"), { recursive: true });

  writeFileSync(
    join(dir, "package.json"),
    JSON.stringify(
      {
        name: "test",
        private: true,
        type: "module",
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
    join(dir, "packages", "lib", "package.json"),
    JSON.stringify(
      {
        name: "lib",
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
    join(dir, "packages", "lib", "tsonic.json"),
    JSON.stringify(
      {
        $schema: "https://tsonic.org/schema/v1.json",
        rootNamespace,
        entryPoint: "src/index.ts",
        sourceRoot: "src",
        outputDirectory: "generated",
        outputName,
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

  return wsConfigPath;
};

export const runLibraryBuild = (dir: string, wsConfigPath: string): void => {
  const cliPath = join(repoRoot, "packages/cli/dist/index.js");
  const result = spawnSync(
    "node",
    [cliPath, "build", "--project", "lib", "--config", wsConfigPath, "--quiet"],
    { cwd: dir, encoding: "utf-8" }
  );
  expect(result.status, result.stderr || result.stdout).to.equal(0);
};

export const runProjectBuild = (
  dir: string,
  wsConfigPath: string,
  projectName: string
): void => {
  const cliPath = join(repoRoot, "packages/cli/dist/index.js");
  const result = spawnSync(
    "node",
    [
      cliPath,
      "build",
      "--project",
      projectName,
      "--config",
      wsConfigPath,
      "--quiet",
    ],
    { cwd: dir, encoding: "utf-8" }
  );
  expect(result.status, result.stderr || result.stdout).to.equal(0);
};
