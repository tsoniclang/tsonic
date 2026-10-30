import { assert, assertRuntimeProjectReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, targetCsharpNodejsPackageJson, targetCsharpOnlyPackageJson, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI runs Node provider-package runtime operations from selected facts", async () => {
  const assemblyName = "SmokeGeneratedNodeProviderRuntime";
  const projectDirectory = resolve(tempRoot, "nodejs-provider-package-runtime");
  const runtimeRoot = JSON.stringify(projectDirectory);
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
            assemblyName,
            outputType: "Exe",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Console } from \"@tsonic/dotnet/System.js\";",
      "import { Buffer } from \"node:buffer\";",
      "import { createHash, randomUUID } from \"node:crypto\";",
      "import { accessSync, appendFileSync, chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, readlinkSync, realpathSync, renameSync, rmSync, rmdirSync, statSync, symlinkSync, truncateSync, unlinkSync, writeFileSync } from \"node:fs\";",
      "import os from \"node:os\";",
      "import path from \"node:path\";",
      "import process from \"node:process\";",
      "import { URL, fileURLToPath, pathToFileURL } from \"node:url\";",
      "import { toUSVString } from \"node:util\";",
      "",
      `const runtimeRoot = ${runtimeRoot};`,
      "const filePath = path.join(runtimeRoot, \"tsonic-slice8-node-provider-runtime.txt\");",
      "writeFileSync(filePath, \"hello\", \"utf8\");",
      "const text = readFileSync(filePath, \"utf8\");",
      "const directoryPath = path.join(runtimeRoot, \"tsonic-slice8-node-provider-runtime-dir\");",
      "mkdirSync(directoryPath, { recursive: true });",
      "const firstPath = path.join(directoryPath, \"first.txt\");",
      "const secondPath = path.join(directoryPath, \"second.txt\");",
      "writeFileSync(firstPath, \"a\", \"utf8\");",
      "appendFileSync(firstPath, \"b\", \"utf8\");",
      "copyFileSync(firstPath, secondPath);",
      "const renamedPath = path.join(directoryPath, \"renamed.txt\");",
      "renameSync(secondPath, renamedPath);",
      "const directoryEntries = readdirSync(directoryPath);",
      "const directoryListText = directoryEntries.length > 0 ? \"listed\" : \"empty\";",
      "accessSync(filePath);",
      "chmodSync(filePath, 420);",
      "const descriptorPath = path.join(directoryPath, \"descriptor.txt\");",
      "writeFileSync(descriptorPath, \"Zlong\", \"utf8\");",
      "truncateSync(descriptorPath, 1);",
      "const descriptorText = readFileSync(descriptorPath, \"utf8\");",
      "const emptyDir = path.join(directoryPath, \"empty\");",
      "mkdirSync(emptyDir, { recursive: true });",
      "rmdirSync(emptyDir, true);",
      "const linkPath = path.join(directoryPath, \"descriptor-link.txt\");",
      "symlinkSync(descriptorPath, linkPath);",
      "const linkText = readlinkSync(linkPath).length > 0 && realpathSync(linkPath).length > 0 ? \"link\" : \"missing-link\";",
      "const copyDirectoryPath = path.join(runtimeRoot, \"tsonic-slice8-node-provider-runtime-copy\");",
      "cpSync(directoryPath, copyDirectoryPath, true);",
      "const copiedDescriptorText = readFileSync(path.join(copyDirectoryPath, \"descriptor.txt\"), \"utf8\");",
      "const bytes = Buffer.from(text, \"utf8\");",
      "const fileUrl = pathToFileURL(filePath);",
      "const roundTrip = fileURLToPath(fileUrl);",
      "const hash = createHash(\"sha256\").update(text).digest(\"hex\");",
      "const existsText = existsSync(filePath) ? \"exists\" : \"missing\";",
      "const kindText = statSync(filePath).isFile() ? \"file\" : \"other\";",
      "const osText = os.platform().length > 0 ? \"platform\" : \"missing-platform\";",
      "const parsed = new URL(\"https://example.com/path?foo=bar\");",
      "parsed.searchParams.append(\"baz\", \"qux\");",
      "parsed.search = \"?answer=42\";",
      "parsed.searchParams.delete(\"answer\");",
      "const urlText = parsed.href === \"https://example.com/path\" ? \"url-live\" : parsed.href;",
      "const fsSyncText = `${readFileSync(firstPath, \"utf8\")}:${existsSync(renamedPath) ? \"renamed\" : \"missing\"}:${directoryListText}`;",
      "Console.WriteLine(`${path.basename(roundTrip)}|${text}|${bytes.toString()}|${hash.length}|${randomUUID().length}|${existsText}|${kindText}|${osText}|${toUSVString(\"ok\")}|${urlText}|${fsSyncText}|${descriptorText}:${copiedDescriptorText}:${linkText}`);",
      "unlinkSync(filePath);",
      "rmSync(copyDirectoryPath, { recursive: true, force: true });",
      "rmSync(directoryPath, { recursive: true, force: true });",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedProject = await readFile(resolve(projectDirectory, `out/csharp/${assemblyName}.csproj`), "utf8");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Runtime");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Js");
  assertRuntimeProjectReference(generatedProject, "Tsonic.CSharp.Node");

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.writeFileSync\(global::Smoke\.Generated\.Index\.filePath, "hello", "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readFileSync\(global::Smoke\.Generated\.Index\.filePath, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.mkdirSync\(global::Smoke\.Generated\.Index\.directoryPath, new Tsonic\.CSharp\.Node\.MakeDirectoryOptions\s*\{[\s\S]*?recursive = true[\s\S]*?\}\);/u);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.appendFileSync\(global::Smoke\.Generated\.Index\.firstPath, "b", "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.copyFileSync\(global::Smoke\.Generated\.Index\.firstPath, global::Smoke\.Generated\.Index\.secondPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.renameSync\(global::Smoke\.Generated\.Index\.secondPath, global::Smoke\.Generated\.Index\.renamedPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readdirSync\(global::Smoke\.Generated\.Index\.directoryPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.accessSync\(global::Smoke\.Generated\.Index\.filePath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.chmodSync\(global::Smoke\.Generated\.Index\.filePath, 420\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.truncateSync\(global::Smoke\.Generated\.Index\.descriptorPath, 1L\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.rmdirSync\(global::Smoke\.Generated\.Index\.emptyDir, true\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.symlinkSync\(global::Smoke\.Generated\.Index\.descriptorPath, global::Smoke\.Generated\.Index\.linkPath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.readlinkSync\(global::Smoke\.Generated\.Index\.linkPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.realpathSync\(global::Smoke\.Generated\.Index\.linkPath\)/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.cpSync\(global::Smoke\.Generated\.Index\.directoryPath, global::Smoke\.Generated\.Index\.copyDirectoryPath, true\);/);
  assert.match(generatedSource, /global::Smoke\.Generated\.Index\.directoryEntries\.Length > 0/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.Buffer\.from\(global::Smoke\.Generated\.Index\.text, "utf8"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.url\.pathToFileURL\(global::Smoke\.Generated\.Index\.filePath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.url\.fileURLToPath\(global::Smoke\.Generated\.Index\.fileUrl\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.crypto\.createHash\("sha256"\)\.update\(global::Smoke\.Generated\.Index\.text\)\.digest\("hex"\);/);
  assert.match(generatedSource, /new Tsonic\.CSharp\.Node\.URL\("https:\/\/example\.com\/path\?foo=bar"\);/);
  assert.match(generatedSource, /global::Smoke\.Generated\.Index\.parsed\.searchParams\.append\("baz", "qux"\);/);
  assert.match(generatedSource, /global::Smoke\.Generated\.Index\.parsed\.search = "\?answer=42";/);
  assert.match(generatedSource, /global::Smoke\.Generated\.Index\.parsed\.searchParams\.delete\("answer"\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.unlinkSync\(global::Smoke\.Generated\.Index\.filePath\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.fs\.rmSync\(global::Smoke\.Generated\.Index\.directoryPath, new Tsonic\.CSharp\.Node\.RmOptions\s*\{[\s\S]*?recursive = true[\s\S]*?force = true[\s\S]*?\}\);/u);
  assert.doesNotMatch(generatedSource, /\bdynamic\b|System\.Reflection|GetMethod|GetProperty|MethodInfo\.Invoke|Assembly\.Load/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  assert.equal(
    runGeneratedProject(projectDirectory, assemblyName),
    "tsonic-slice8-node-provider-runtime.txt|hello|hello|64|36|exists|file|platform|ok|url-live|ab:renamed:listed|Z:Z:link\n",
  );
});
