import { assert, cliPath, existsSync, readFile, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { targetCsharpOnlyPackageJson, targetCsharpNodejsPackageJson } from "./process-buffer-crypto-os.split-fixtures.mjs";

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
  assert.match(generatedSource, /ints\.writeUInt16LE\(\(ushort\)4660, 0\);/);
  assert.match(generatedSource, /ints\.writeInt16BE\(\(short\)-2, 2\);/);
  assert.match(generatedSource, /ints\.writeUInt32BE\(\(uint\)16909060, 4\);/);
  assert.match(generatedSource, /floats\.writeFloatLE\(1\.5F, 0\);/);
  assert.match(generatedSource, /floats\.writeDoubleBE\(2\.5D, 4\);/);
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
