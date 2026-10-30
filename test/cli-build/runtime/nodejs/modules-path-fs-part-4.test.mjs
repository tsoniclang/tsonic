import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits fs promises operations from selected Node provider-package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-fs-promises-provider-package");
  await writeProject(projectDirectory, {
    "package.json": targetCsharpNodejsPackageJson(projectDirectory),
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedNodeFsPromises",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer } from \"node:buffer\";",
      "import { access, appendFile, chmod, copyFile, cp, mkdir, readFile, readdir, readlink, realpath, rename, rm, rmdir, stat, symlink, truncate, unlink, writeFile } from \"node:fs/promises\";",
      "",
      "export async function readText(path: string): Promise<string> {",
      "  return await readFile(path, \"utf8\");",
      "}",
      "",
      "export async function writeText(path: string, text: string): Promise<void> {",
      "  await writeFile(path, text, \"utf8\");",
      "}",
      "",
      "export async function statPath(path: string): Promise<void> {",
      "  await stat(path);",
      "}",
      "",
      "export async function deletePath(path: string): Promise<void> {",
      "  await unlink(path);",
      "}",
      "",
      "export async function linkRoundTrip(sourcePath: string, linkPath: string): Promise<string> {",
      "  await symlink(sourcePath, linkPath);",
      "  await chmod(linkPath, 420);",
      "  await cp(sourcePath, linkPath + \".copy\", true);",
      "  await rmdir(linkPath + \".dir\", true);",
      "  return (await readlink(linkPath)) + (await realpath(linkPath));",
      "}",
      "",
      "export async function runFileRoundTrip(root: string): Promise<string> {",
      "  const directory = root + \"/promises\";",
      "  await mkdir(directory, { recursive: true });",
      "  const source = directory + \"/source.txt\";",
      "  const binary = directory + \"/binary.bin\";",
      "  const renamed = directory + \"/renamed.txt\";",
      "  const copied = directory + \"/copied.txt\";",
      "  const copiedDirect = directory + \"/copied-direct.txt\";",
      "  await writeFile(source, \"hello\", \"utf8\");",
      "  await access(source);",
      "  await writeFile(binary, Buffer.from(\"ok\", \"utf8\"));",
      "  await appendFile(binary, Buffer.from(\"!\", \"utf8\"));",
      "  const text = await readFile(source, \"utf8\");",
      "  const bytes = await readFile(source);",
      "  const binaryBytes = await readFile(binary);",
      "  await rename(source, renamed);",
      "  await cp(renamed, copied, false);",
      "  await copyFile(renamed, copiedDirect);",
      "  await truncate(copiedDirect, 2);",
      "  const truncatedText = await readFile(copiedDirect, \"utf8\");",
      "  const entries = await readdir(directory);",
      "  const kind = (await stat(copied)).isFile() ? \"file\" : \"other\";",
      "  await unlink(binary);",
      "  await unlink(renamed);",
      "  await rm(copied);",
      "  await rm(copiedDirect);",
      "  await rm(directory, { recursive: true, force: true });",
      "  return `${text}:${bytes.length}:${binaryBytes.length}:${entries.length}:${kind}:${truncatedText}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(path, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Buffer bytes = await Tsonic\.CSharp\.Node\.fs_promises\.readFile\(source\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.access\(source\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(path, text, "utf8"\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.writeFile\(binary, Tsonic\.CSharp\.Node\.Buffer\.from\("ok", "utf8"\)\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.appendFile\(binary, Tsonic\.CSharp\.Node\.Buffer\.from\("!", "utf8"\)\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.stat\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.unlink\(path\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.mkdir\(directory, new Tsonic\.CSharp\.Node\.MakeDirectoryOptions\s*\{[\s\S]*?recursive = true[\s\S]*?\}\);/u);
  assert.match(generatedSource, /string\[\] entries = await Tsonic\.CSharp\.Node\.fs_promises\.readdir\(directory\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.copyFile\(renamed, copiedDirect\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.truncate\(copiedDirect, 2L\);/);
  assert.doesNotMatch(generatedSource, /System\.Convert\.ToInt64\(2\)/);
  assert.match(generatedSource, /entries\.Length/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.symlink\(sourcePath, linkPath\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.chmod\(linkPath, 420\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.cp\(sourcePath, linkPath \+ "\.copy", true\);/);
  assert.match(generatedSource, /await Tsonic\.CSharp\.Node\.fs_promises\.rmdir\(linkPath \+ "\.dir", true\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs_promises\.readlink\(linkPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs_promises\.realpath\(linkPath\)/);
  assert.doesNotMatch(generatedSource, /return readFile\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeFsPromises.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNodeFsPromises", [
    "using System;",
    "using System.Threading.Tasks;",
    "",
    "public static class Program",
    "{",
    "    public static async Task Main()",
    "    {",
    "        Console.WriteLine(await Smoke.Generated.Index.runFileRoundTrip(Environment.CurrentDirectory));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "hello:5:3:4:file:he\n");
});
