import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { targetCsharpOnlyPackageJson, targetCsharpNodejsPackageJson } from "./process-buffer-crypto-os.split-fixtures.mjs";

test("CLI emits closed node:util string operations from selected Node provider-package declarations", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-util-string-provider-package");
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
            assemblyName: "SmokeGeneratedNodeUtil",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { convertProcessSignalToExitCode, getSystemErrorMessage, getSystemErrorName, stripVTControlCharacters, styleText, toUSVString } from \"node:util\";",
      "import { stripVTControlCharacters as bareStrip } from \"util\";",
      "",
      "export function clean(input: string): string {",
      "  return stripVTControlCharacters(input);",
      "}",
      "",
      "export function normalize(input: string): string {",
      "  return toUSVString(input);",
      "}",
      "",
      "export function cleanBare(input: string): string {",
      "  return bareStrip(input);",
      "}",
      "",
      "export function styledError(input: string): string {",
      "  return styleText(\"red\", input) + getSystemErrorName(2) + getSystemErrorMessage(2);",
      "}",
      "",
      "export function signalExitCode(): number {",
      "  return convertProcessSignalToExitCode(\"SIGINT\");",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.stripVTControlCharacters\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.toUSVString\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.styleText\("red", input\) \+ Tsonic\.CSharp\.Node\.util\.getSystemErrorName\(2\) \+ Tsonic\.CSharp\.Node\.util\.getSystemErrorMessage\(2\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.util\.convertProcessSignalToExitCode\("SIGINT"\);/);
  assert.doesNotMatch(generatedSource, /return stripVTControlCharacters\(/);
  assert.doesNotMatch(generatedSource, /return bareStrip\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeUtil.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});
