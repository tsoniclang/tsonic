import { assert, cliPath, readFile, repoRoot, resolve, runGeneratedCsharpRunner, runGeneratedProject, runNode,
  tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI preserves original binding carriers with native identity and allocation cost", { timeout: 300_000 }, async () => {
  const original = await readFile(resolve(repoRoot, "test/cli-build/core/control-flow/binding-destructure.test.mjs"), "utf8");
  const start = original.indexOf('test("CLI runs non-Node carrier binding spread nullish and exception flow"');
  assert.equal(start >= 0, true, "the exact original supported case exists");
  const end = original.indexOf('\ntest("', start + 1);
  const sourceArray = original.slice(start, end).match(/"src\/index\.ts": \[([\s\S]*?)\]\.join\("\\n"\)/u);
  assert.equal(sourceArray !== null, true, "the original source remains a literal array, never executed to extract it");
  const sourceText = JSON.parse(`[${sourceArray[1].trim().replace(/,$/u, "")}]`).join("\n");
  const assemblyName = "SmokeGeneratedBindingCarrierContracts";
  const projectDirectory = resolve(tempRoot, "binding-carrier-contracts");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({ entryPoint: "index.ts", rootDir: "src", outDir: "out",
      targets: [{ id: "csharp", surfaces: ["js"], options: {
        namespace: "Smoke.Generated", assemblyName, outputType: "Exe",
      } }] }),
    "src/index.ts": sourceText,
  });
  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const output = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  const shapes = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const spread = output.match(/(?<carrier>ObjectShape_[a-f0-9]{12}) spread = new \k<carrier>\s*\{\s*label = label,\s*total = value \+ rest\.count,/u);
  assert.equal(spread !== null, true, "one concrete spread construction retains the exact original fields and evaluation");
  const shape = shapes.match(new RegExp(`public class ${spread.groups.carrier} : (?<contract>ObjectShape_[a-f0-9]{12})<string, double>\\s*\\{(?<body>[\\s\\S]*?)\\n    \\}`, "u"));
  assert.equal(shape !== null, true, "the concrete native carrier implements the authored string/double interface");
  assert.match(shape.groups.body, /public required string label\s*\{\s*get;\s*set;\s*\}/u);
  assert.match(shape.groups.body, /public required double total\s*\{\s*get;\s*set;\s*\}/u);
  assert.doesNotMatch(output + shapes, /\bdynamic\b|System\.Reflection|__unsupported|InvalidExpression/u);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "slice8|14|4\nfallback|10|4\n",
    "the unchanged original program preserves binding defaults, nullish exception flow and values");
  const parameter = output.match(/public static string summarize\((?<carrier>[^;()]+) __tsonic_param\d+, Tsonic\.CSharp\.Js\.JSArray<double> numbers\)/u);
  assert.equal(parameter !== null, true, "the original complete native source signature is present");
  const native = await runGeneratedCsharpRunner(projectDirectory, assemblyName, [
    "using System;",
    "using Smoke.Generated;",
    "using Tsonic.CSharp.Js;",
    "Smoke.Generated.Index.__tsonic_module_init();",
    "var input = Smoke.Generated.Index.input;",
    "var child = input.child;",
    "var label = input.label;",
    "var numbers = JSArray<double>.of([5D, 6D]);",
    "var generated = string.Empty;",
    "var handwritten = string.Empty;",
    "for (var index = 0; index < 10000; index++) {",
    "  generated = Smoke.Generated.Index.summarize(input, numbers);",
    "  handwritten = NativeSummary(input, numbers);",
    "}",
    "var beforeNative = GC.GetAllocatedBytesForCurrentThread();",
    "for (var index = 0; index < 10000; index++) handwritten = NativeSummary(input, numbers);",
    "var nativeBytes = GC.GetAllocatedBytesForCurrentThread() - beforeNative;",
    "var beforeGenerated = GC.GetAllocatedBytesForCurrentThread();",
    "for (var index = 0; index < 10000; index++) generated = Smoke.Generated.Index.summarize(input, numbers);",
    "var generatedBytes = GC.GetAllocatedBytesForCurrentThread() - beforeGenerated;",
    "if (generated != \"slice8|14|4\" || handwritten != generated || generatedBytes != nativeBytes ||",
    "    !System.Object.ReferenceEquals(input.child, child) || !System.Object.ReferenceEquals(input.label, label) ||",
    "    numbers.length != 2 || numbers[0] != 5D || numbers[1] != 6D)",
    "  throw new Exception($\"native carrier/identity/copy/allocation: generated={generatedBytes},native={nativeBytes}\");",
    "GC.KeepAlive(child); GC.KeepAlive(label); GC.KeepAlive(numbers);",
    "Console.WriteLine($\"generatedBytes={generatedBytes};nativeBytes={nativeBytes};identity=true\");",
    `static string NativeSummary(${parameter.groups.carrier} input, JSArray<double> numbers) {`,
    "  var label = input.label ?? \"fallback\";",
    "  var value = input.child.value;",
    "  var count = input.count;",
    "  var spread = new NativeSpread { label = label, total = value + count };",
    "  var composed = new JSArray<double>().AppendElement(spread.total);",
    "  composed.EnsureCapacity(checked(composed.Count + numbers.length));",
    "  for (var index = 0; index < numbers.length; index++) composed.Add(numbers[index]);",
    "  composed.AppendElement(count);",
    "  var first = composed.length > 0 ? composed[0] : 1D;",
    "  var second = composed.length > 1 ? composed[1] : 2D;",
    "  var tail = composed.slice(2);",
    "  return $\"{spread.label}|{first + second + tail.length}|{value}\";",
    "}",
    "sealed class NativeSpread { public required string label { get; set; } public required double total { get; set; } }",
  ]);
  assert.match(native, /^slice8\|14\|4\nfallback\|10\|4\ngeneratedBytes=(\d+);nativeBytes=\1;identity=true\n$/u,
    "the original native startup/output and aliases survive without additional allocation against the matching native operations");
  console.log(native.trim());
});
