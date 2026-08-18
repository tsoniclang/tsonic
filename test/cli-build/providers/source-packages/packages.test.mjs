import { mkdir, symlink, writeFile } from "node:fs/promises";
import {
  assert,
  cliPath,
  existsSync,
  readFile,
  resolve,
  runGeneratedProject,
  runNode,
  tempRoot,
  test,
  writeProject,
} from "../../helpers/harness.mjs";

test("CLI compiles a hoisted workspace source package through its package exports", async () => {
  const workspaceDirectory = resolve(tempRoot, "hoisted-workspace-source-package");
  const projectDirectory = resolve(workspaceDirectory, "packages/app");
  const sourcePackageDirectory = resolve(workspaceDirectory, "packages/domain");
  const installedPackageDirectory = resolve(workspaceDirectory, "node_modules/@demo/domain");
  await mkdir(resolve(sourcePackageDirectory, "src"), { recursive: true });
  await mkdir(resolve(workspaceDirectory, "node_modules/@demo"), { recursive: true });
  await writeFile(resolve(sourcePackageDirectory, "package.json"), JSON.stringify({
    name: "@demo/domain",
    type: "module",
    exports: {
      "./index.js": "./src/index.ts",
      "./package.json": "./package.json",
    },
  }, null, 2), "utf8");
  await writeFile(resolve(sourcePackageDirectory, "src/index.ts"), "export const greeting = \"workspace-source\";\n", "utf8");
  await symlink(sourcePackageDirectory, installedPackageDirectory, "dir");
  await writeProject(projectDirectory, {
    "package.json": JSON.stringify({
      name: "@demo/app",
      type: "module",
      private: true,
      dependencies: {
        "@demo/domain": "workspace:*",
        "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
        "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
        "@tsonic/csharp-js": "file:../../../../csharp-js",
      },
    }, null, 2),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName: "SmokeGeneratedHoistedSourcePackage",
          outputType: "Exe",
        },
      }],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import { greeting } from \"@demo/domain/index.js\";",
      "Console.WriteLine(greeting);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const packageSourcePath = resolve(projectDirectory, "out/csharp/src/node_modules/@demo/domain/src/Node_modules_Demo_domain_src_index.cs");
  assert.equal(existsSync(packageSourcePath), true);
  const packageSource = await readFile(packageSourcePath, "utf8");
  assert.match(packageSource, /public static string greeting\s*\{\s*get;\s*private set;\s*\} = default\(string\)!;/u);
  assert.match(packageSource, /private static object\? __tsonic_module_init_core\(\)[\s\S]*greeting = "workspace-source";/u);
  assert.equal(runGeneratedProject(projectDirectory, "SmokeGeneratedHoistedSourcePackage"), "workspace-source\n");
});
