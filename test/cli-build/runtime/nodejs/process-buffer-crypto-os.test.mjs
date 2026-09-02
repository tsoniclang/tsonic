import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI emits expanded process operations from selected Node provider-package facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-expanded-provider-package");
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
            assemblyName: "SmokeGeneratedNodeProcessExpanded",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import * as process from \"node:process\";",
      "",
      "export function processInfo(): string {",
      "  const pathValue = process.env[\"PATH\"] ?? \"\";",
      "  const usage = process.memoryUsage();",
      "  const identity = process.arch + process.argv0 + process.execPath + process.platform + process.version;",
      "  const versionInfo = process.versions.node + process.versions.dotnet + pathValue;",
      "  const processIds = process.pid + process.ppid + process.uptime();",
      "  const memoryInfo = usage.rss + usage.heapUsed;",
      "  return identity + versionInfo + processIds + memoryInfo;",
      "}",
      "",
      "export function currentExitCode(): number | null {",
      "  return process.exitCode;",
      "}",
      "",
      "export function changeDirectory(directory: string): void {",
      "  process.chdir(directory);",
      "}",
      "",
      "export function terminate(code?: number): void {",
      "  process.exit(code);",
      "}",
      "",
      "export function signalSelf(): boolean {",
      "  return process.kill(process.pid, 0);",
      "}",
      "",
      "export function memoryCeiling(): number {",
      "  return process.availableMemory() + process.constrainedMemory();",
      "}",
      "",
      "export function timingParts(): number {",
      "  const parts = process.hrtime();",
      "  return parts[0] + parts[1];",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.env\["PATH"\] \?\? ""/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.arch/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.argv0/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.execPath/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.platform/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.version/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.versions\.node/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.versions\.dotnet/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.pid/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.ppid/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.MemoryUsage usage = Tsonic\.CSharp\.Node\.process\.memoryUsage\(\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.uptime\(\)/);
  assert.match(generatedSource, /usage\.rss/);
  assert.match(generatedSource, /usage\.heapUsed/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.exitCode;/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.chdir\(directory\);/);
  assert.match(generatedSource, /Tsonic\.CSharp\.Node\.process\.exit\(Tsonic\.CSharp\.Generated\.__TsonicConversions\.LiftNullable<double, int>\(code, System\.Convert\.ToInt32\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.kill\(Tsonic\.CSharp\.Node\.process\.pid, 0\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.process\.availableMemory\(\) \+ Tsonic\.CSharp\.Node\.process\.constrainedMemory\(\);/);
  assert.match(generatedSource, /double\[\] parts = Tsonic\.CSharp\.Node\.process\.hrtime\(\);/);
  assert.match(generatedSource, /return parts\[0\] \+ parts\[1\];/);
  assert.doesNotMatch(generatedSource, /return process\./);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const generatedConversions = await readFile(
    resolve(projectDirectory, "out/csharp/generated/TsonicConversions.cs"),
    "utf8",
  );
  assert.equal(generatedConversions, `namespace Tsonic.CSharp.Generated
{
    internal static class __TsonicConversions
    {
        internal static TResult? LiftNullable<TSource, TResult>(TSource? value, System.Func<TSource, TResult> conversion)
        where TSource : struct
        where TResult : struct
        {
            return value.HasValue ? conversion(value.Value) : default(TResult?);
        }
    }
}
`);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeProcessExpanded.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI rejects unsupported process stream properties without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-streams-unsupported");
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
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import process from \"node:process\";",
      "",
      "export function streams(): void {",
      "  void process.stdin;",
      "  void process.stdout;",
      "  void process.stderr;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  for (const memberName of ["stdin", "stdout", "stderr"]) {
    assert.match(
      build.stderr,
      new RegExp(`hard-rejected selected property 'node:process' export 'default' member 'node:process\\.default\\.${memberName}'`),
    );
    assert.match(build.stderr, new RegExp(`unsupported:Tsonic\\.CSharp\\.Node\\.process\\.${memberName}`));
  }
  assert.match(build.stderr, /TS9100203/u);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|MethodInfo\.Invoke/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI rejects unsupported process nextTick without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-process-nexttick-unsupported");
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
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import process from \"node:process\";",
      "",
      "export function tick(): void {",
      "  process.nextTick(() => {});",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /hard-rejected selected call 'node:process' export 'default' member 'node:process\.default\.nextTick'/u);
  assert.match(build.stderr, /unsupported:Tsonic\.CSharp\.Node\.process\.nextTick\(Function,System\.Object\[\]\)/);
  assert.match(build.stderr, /TS9100203/u);
  assert.doesNotMatch(build.stderr, /CSHARP_NODEJS_PROPERTY_NOT_MAPPED|could not map checked .* to a target property/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty|MethodInfo\.Invoke/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

test("CLI emits Buffer and crypto operations from selected Node provider-package declaration facts", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-buffer-crypto-provider-package");
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
            assemblyName: "SmokeGeneratedNodeBufferCrypto",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { Buffer, transcode } from \"node:buffer\";",
      "import { createHash, createHmac, getHashes, randomBytes, randomFillSync, randomInt, timingSafeEqual } from \"node:crypto\";",
      "",
      "export function bufferText(): string {",
      "  return Buffer.from(\"hello\").toString();",
      "}",
      "",
      "export function bufferLength(): number {",
      "  return Buffer.alloc(3).length;",
      "}",
      "",
      "export function byteLength(): number {",
      "  return Buffer.byteLength(\"hello\");",
      "}",
      "",
      "export function validEncoding(): boolean {",
      "  return Buffer.isEncoding(\"utf8\");",
      "}",
      "",
      "export function validEncodingText(): string {",
      "  return Buffer.isEncoding(\"utf8\").toString();",
      "}",
      "",
      "export function recognizedBuffer(): boolean {",
      "  return Buffer.isBuffer(Buffer.from(\"x\"));",
      "}",
      "",
      "export function poolSizeValue(): number {",
      "  return Buffer.poolSize;",
      "}",
      "",
      "export function transcodedText(): string {",
      "  return transcode(Buffer.from(\"hello\"), \"utf8\", \"utf8\").toString();",
      "}",
      "",
      "export function copiedBufferCount(): number {",
      "  const source = Buffer.from(\"abc\");",
      "  const target = Buffer.alloc(8);",
      "  return source.copy(target) + target.write(\"z\") + Buffer.from(source).compare(source);",
      "}",
      "",
      "export function boundedRandom(): number {",
      "  return randomInt(10);",
      "}",
      "",
      "export function rangedRandom(): number {",
      "  return randomInt(1, 10);",
      "}",
      "",
      "export function firstHash(): string {",
      "  return getHashes()[0];",
      "}",
      "",
      "export function randomBufferLength(): number {",
      "  return randomBytes(4).length;",
      "}",
      "",
      "export function filledBufferLength(): number {",
      "  return randomFillSync(Buffer.alloc(4)).length;",
      "}",
      "",
      "export function digestHex(input: string): string {",
      "  return createHash(\"sha256\").update(input).digest(\"hex\");",
      "}",
      "",
      "export function digestBufferLength(input: string): number {",
      "  return createHash(\"sha256\").update(Buffer.from(input)).digest().length;",
      "}",
      "",
      "export function hmacHex(key: string, value: string): string {",
      "  return createHmac(\"sha256\", Buffer.from(key)).update(value).digest(\"hex\");",
      "}",
      "",
      "export function sameBuffer(): boolean {",
      "  return timingSafeEqual(Buffer.from(\"aa\"), Buffer.from(\"aa\"));",
      "}",
      "",
      "export function numericRoundTrip(): string {",
      "  const ints = Buffer.alloc(8);",
      "  ints.writeUInt16LE(4660, 0);",
      "  ints.writeInt16BE(-2, 2);",
      "  ints.writeUInt32BE(16909060, 4);",
      "  const floats = Buffer.alloc(12);",
      "  floats.writeFloatLE(1.5, 0);",
      "  floats.writeDoubleBE(2.5, 4);",
      "  return `${ints.readUInt16LE(0)}:${ints.readInt16BE(2)}:${ints.readUInt32BE(4)}:${floats.readFloatLE(0)}:${floats.readDoubleBE(4)}`;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.from\("hello"\)\.toString\(\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.alloc\(3\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.byteLength\("hello"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.isEncoding\("utf8"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Js\.BooleanOps\.toString\(Tsonic\.CSharp\.Node\.Buffer\.isEncoding\("utf8"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.isBuffer\(Tsonic\.CSharp\.Node\.Buffer\.from\("x"\)\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.Buffer\.poolSize;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.buffer\.transcode\(Tsonic\.CSharp\.Node\.Buffer\.from\("hello"\), "utf8", "utf8"\)\.toString\(\);/);
  assert.match(generatedSource, /return source\.copy\(target\) \+ target\.write\("z"\) \+ Tsonic\.CSharp\.Node\.Buffer\.from\(source\)\.compare\(source\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomInt\(10\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomInt\(1, 10\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.getHashes\(\)\[0\];/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomBytesBuffer\(4\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.randomFillSync\(Tsonic\.CSharp\.Node\.Buffer\.alloc\(4\)\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.createHash\("sha256"\)\.update\(input\)\.digest\("hex"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.createHash\("sha256"\)\.update\(Tsonic\.CSharp\.Node\.Buffer\.from\(input\)\)\.digestBuffer\(\)\.length;/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.createHmac\("sha256", Tsonic\.CSharp\.Node\.Buffer\.from\(key\)\)\.update\(value\)\.digest\("hex"\);/);
  assert.match(generatedSource, /return Tsonic\.CSharp\.Node\.crypto\.timingSafeEqual\(Tsonic\.CSharp\.Node\.Buffer\.from\("aa"\), Tsonic\.CSharp\.Node\.Buffer\.from\("aa"\)\);/);
  assert.match(generatedSource, /ints\.writeUInt16LE\(4660, 0\);/);
  assert.match(generatedSource, /ints\.writeInt16BE\(-2, 2\);/);
  assert.match(generatedSource, /ints\.writeUInt32BE\(16909060, 4\);/);
  assert.match(generatedSource, /floats\.writeFloatLE\(1\.5F, 0\);/);
  assert.match(generatedSource, /floats\.writeDoubleBE\(2\.5, 4\);/);
  assert.match(generatedSource, /ints\.readUInt16LE\(0\)/);
  assert.match(generatedSource, /ints\.readInt16BE\(2\)/);
  assert.match(generatedSource, /ints\.readUInt32BE\(4\)/);
  assert.match(generatedSource, /floats\.readFloatLE\(0\)/);
  assert.match(generatedSource, /floats\.readDoubleBE\(4\)/);
  assert.doesNotMatch(generatedSource, /return Buffer\./);
  assert.doesNotMatch(generatedSource, /return randomInt\(/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedNodeBufferCrypto.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);

  const stdout = await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedNodeBufferCrypto", [
    "using System;",
    "",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        Console.WriteLine(Smoke.Generated.Index.numericRoundTrip());",
    "    }",
    "}",
    "",
  ]);
  assert.equal(stdout, "4660:-2:16909060:1.5:2.5\n");
});

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

test("CLI rejects unsupported selected Node crypto and os provider-package operations without fallback", async () => {
  const projectDirectory = resolve(tempRoot, "nodejs-unsupported-crypto-os-selected-operation");
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
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "import { createCipheriv, createDecipheriv, createSign, createVerify, pbkdf2Sync, scryptSync } from \"node:crypto\";",
      "import os, { cpus, getPriority, networkInterfaces, setPriority, userInfo } from \"node:os\";",
      "",
      "export function unsupportedCryptoOs(): void {",
      "  createCipheriv(\"aes-256-cbc\", {}, {});",
      "  createDecipheriv(\"aes-256-cbc\", {}, {});",
      "  scryptSync(\"password\", \"salt\", 16, {});",
      "  pbkdf2Sync(\"password\", \"salt\", 1, 16, \"sha256\");",
      "  createSign(\"RSA-SHA256\");",
      "  createVerify(\"RSA-SHA256\");",
      "  cpus();",
      "  networkInterfaces();",
      "  userInfo({});",
      "  getPriority(0);",
      "  setPriority(0, 0);",
      "  const constants = os.constants;",
      "  if (constants) {}",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:crypto' export 'createCipheriv'/);
  assert.match(build.stderr, /node:crypto\.createCipheriv/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:crypto' export 'createDecipheriv'/);
  assert.match(build.stderr, /node:crypto\.createDecipheriv/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:crypto' export 'scryptSync'/);
  assert.match(build.stderr, /node:crypto\.scryptSync/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:crypto' export 'pbkdf2Sync'/);
  assert.match(build.stderr, /node:crypto\.pbkdf2Sync/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:crypto' export 'createSign'/);
  assert.match(build.stderr, /node:crypto\.createSign/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:crypto' export 'createVerify'/);
  assert.match(build.stderr, /node:crypto\.createVerify/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:os' export 'cpus'/);
  assert.match(build.stderr, /node:os\.cpus/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:os' export 'networkInterfaces'/);
  assert.match(build.stderr, /node:os\.networkInterfaces/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:os' export 'userInfo'/);
  assert.match(build.stderr, /node:os\.userInfo/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:os' export 'getPriority'/);
  assert.match(build.stderr, /node:os\.getPriority/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected call 'node:os' export 'setPriority'/);
  assert.match(build.stderr, /node:os\.setPriority/);
  assert.match(build.stderr, /C# NodeJS provider package hard-rejected selected property 'node:os' export 'default' member 'node:os\.default\.constants'/);
  assert.match(build.stderr, /unsupported:Tsonic\.CSharp\.Node\.os\.constants/);
  assert.doesNotMatch(build.stderr, /createCipheriv is not a function|cpus is not a function|constants is undefined/);
  assert.doesNotMatch(build.stderr, /Reflection|dynamic|GetMethod|GetProperty/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false);
});

function targetCsharpOnlyPackageJson(name) {
  return JSON.stringify({
    name: `tsonic-test-${name}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
      "@tsonic/csharp-js": "file:../../../../csharp-js",
    },
  }, null, 2);
}

function targetCsharpNodejsPackageJson(projectDirectory) {
  return JSON.stringify({
    name: `tsonic-test-${projectDirectory.split("/").at(-1)}`,
    type: "module",
    private: true,
    dependencies: {
      "@tsonic/target-csharp": "file:../../../../tsonic-csharp",
      "@tsonic/csharp-runtime": "file:../../../../csharp-runtime",
      "@tsonic/csharp-js": "file:../../../../csharp-js",
      "@tsonic/csharp-nodejs": "file:../../../../csharp-nodejs",
    },
  }, null, 2);
}
