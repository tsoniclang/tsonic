import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { targetCsharpOnlyPackageJson, targetCsharpNodejsPackageJson } from "./process-buffer-crypto-os-fixtures.mjs";

test("CLI emits closed node:url operations from selected Node provider-package declarations", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-url-closed-provider-package");
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
            assemblyName: "SmokeGeneratedNodeUrl",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { URL, URLSearchParams, domainToASCII, fileURLToPath, format, pathToFileURL } from \"node:url\";",
      "import { resolve as bareResolve } from \"url\";",
      "",
      "export function href(input: string): string {",
      "  const parsed = new URL(input);",
      "  return parsed.href;",
      "}",
      "",
      "export function host(input: string): string {",
      "  return new URL(input).host;",
      "}",
      "",
      "export function accepts(input: string): boolean {",
      "  return URL.canParse(input);",
      "}",
      "",
      "export function acceptsRelative(input: string): boolean {",
      "  const parsed = new URL(input);",
      "  return URL.canParse(\"child\", parsed);",
      "}",
      "",
      "export function childHost(input: string): string {",
      "  const parsed = new URL(input);",
      "  return new URL(\"child\", parsed).host;",
      "}",
      "",
      "export function formatted(input: string): string {",
      "  const parsed = new URL(input);",
      "  return format(parsed);",
      "}",
      "",
      "export function roundTrip(path: string): string {",
      "  return fileURLToPath(pathToFileURL(path));",
      "}",
      "",
      "export function ascii(domain: string): string {",
      "  return domainToASCII(domain);",
      "}",
      "",
      "export function joined(from: string, to: string): string {",
      "  return bareResolve(from, to);",
      "}",
      "",
      "export function queryValue(input: string): string {",
      "  const params = new URLSearchParams(\"a=1\");",
      "  params.append(\"b\", input);",
      "  params.set(\"a\", \"2\");",
      "  return (params.get(\"a\") ?? \"\") + params.getAll(\"a\")[0] + params.toString();",
      "}",
      "",
      "export function querySize(): number {",
      "  return new URLSearchParams(\"a=1\").size;",
      "}",
      "",
      "export function liveQueryValue(input: string): string {",
      "  const parsed = new URL(\"https://example.com/?q=\" + input);",
      "  parsed.searchParams.append(\"page\", \"1\");",
      "  return parsed.searchParams.get(\"page\") ?? \"\";",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /new Tsonic\.CSharp\.Node\.URL\(input\)/);
  assert.match(generatedSource, /return parsed\.href;/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Node\.URL\(input\)\.host;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.URL\.canParse\(input\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.URL\.canParse\("child", parsed\);/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Node\.URL\("child", parsed\)\.host;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.format\(parsed\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.fileURLToPath\(Tsonic\.CSharp\.Node\.url\.pathToFileURL\(path\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.domainToASCII\(domain\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.url\.resolve\(from, to\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.URLSearchParams @?params = new Tsonic\.CSharp\.Node\.URLSearchParams\("a=1"\);/);
  assert.match(generatedSource, /@?params\.append\("b", input\);/);
  assert.match(generatedSource, /@?params\.set\("a", "2"\);/);
  assert.match(generatedSource, /@?params\.get\("a"\) \?\? ""/);
  assert.match(generatedSource, /@?params\.getAll\("a"\)\[0\]/);
  assert.match(generatedSource, /@?params\.ToString\(\)/);
  assert.match(generatedSource, /return new Tsonic\.CSharp\.Node\.URLSearchParams\("a=1"\)\.size;/);
  assert.match(generatedSource, /parsed\.searchParams\.append\("page", "1"\);/);
  assert.match(generatedSource, /return parsed\.searchParams\.get\("page"\) \?\? "";/);
  assert.doesNotMatch(generatedSource, /return URL\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeUrl.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNodeUrl", [
    "using System;",
    "using System.IO;",
    "",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        const string input = \"https://example.com/a?b=1\";",
    "        var ascii = Smoke.Generated.Index.ascii(\"mañana.com\").StartsWith(\"xn--\") ? \"ascii\" : \"bad-ascii\";",
    "        var roundTrip = Smoke.Generated.Index.roundTrip(Path.Combine(Environment.CurrentDirectory, \"sample.txt\")).EndsWith(\"sample.txt\") ? \"round\" : \"bad-round\";",
    "        Console.WriteLine(string.Join(\"|\", new[]",
    "        {",
    "            Smoke.Generated.Index.href(input),",
    "            Smoke.Generated.Index.host(input),",
    "            Smoke.Generated.Index.accepts(input).ToString(),",
    "            Smoke.Generated.Index.acceptsRelative(input).ToString(),",
    "            Smoke.Generated.Index.childHost(input),",
    "            Smoke.Generated.Index.formatted(input),",
    "            ascii,",
    "            Smoke.Generated.Index.joined(\"https://example.com/a/\", \"../b\"),",
    "            roundTrip,",
    "            Smoke.Generated.Index.queryValue(\"x\"),",
    "            Smoke.Generated.Index.querySize().ToString(),",
    "            Smoke.Generated.Index.liveQueryValue(\"next\"),",
    "        }));",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "https://example.com/a?b=1|example.com|True|True|example.com|https://example.com/a?b=1|ascii|https://example.com/b|round|22a=2&b=x|1|1\n");
});
