import {
  assert,
  cliPath,
  readFile,
  resolve,
  runGeneratedProject,
  runNode,
  tempRoot,
  test,
  writeProject,
} from "./harness.mjs";

test("CLI emits, dotnet-builds, and executes the complete TypeScript utility matrix", async () => {
  const assemblyName = "SmokeGeneratedTypeScriptUtilities";
  const projectDirectory = resolve(tempRoot, "typescript-utilities-comprehensive");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [{
        id: "csharp",
        options: {
          namespace: "Smoke.Generated",
          assemblyName,
          outputType: "Exe",
        },
      }],
    }, null, 2),
    "src/index.ts": runtimeUtilitySource,
    "src/overloads.d.ts": overloadDeclarations,
    "src/shadows.d.ts": shadowUtilityDeclarations,
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generated = [
    await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8"),
    await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8"),
  ].join("\n");
  assert.match(generated, /bool\[\] values/u);
  assert.match(generated, /\(string, string\?\) values/u);
  assert.match(generated, /constructOptional\(\(12, default\(string\?\)\)\)/u);
  assert.match(generated, /optionalSummary\(\(10, default\(string\?\)\)\)/u);
  assert.doesNotMatch(generated, /\b(?:Partial|Required|Readonly|Pick|Record|Exclude|Extract|Omit|NonNullable|Parameters|ConstructorParameters|ReturnType|InstanceType|Awaited|ThisParameterType|OmitThisParameter|Uppercase|Lowercase|Capitalize|Uncapitalize|NoInfer|ThisType)\b/u);
  assert.equal(
    runGeneratedProject(projectDirectory, assemblyName),
    "0|1|2|3|omitted|9|left|right|6|formatted|8:pair|9|3|items|10|11|READY|quiet|Hello|world|10:none|11:label|False|True|overload|12:none|13|14:3:bound|red|11|READY:loud:Hello:alpha|shadow:tuple:True:7\n",
  );
});

const runtimeUtilitySource = `
import type { int32 } from "@tsonic/core/types.js";
import { Console } from "@tsonic/dotnet/System.js";
import type { Overloaded } from "./overloads.js";
import type {
  OmitThisParameter as LocalOmitThisParameter,
  Parameters as LocalParameters,
  Partial as LocalPartial,
  ReturnType as LocalReturnType,
} from "./shadows.js";

interface Model {
  id: int32;
  label: string;
  active?: boolean;
}
type ModelPatch = Partial<Model>;
type CompleteModel = Required<Model>;
type ReadOnlyModel = Readonly<CompleteModel>;
type ModelId = Pick<Model, "id">;
type ModelWithoutId = Omit<Model, "id">;
type Totals = Record<"left" | "right", int32>;

function patchId(value: ModelPatch): int32 { return value.id ?? (0 as int32); }
function requiredId(value: CompleteModel): int32 { return value.id; }
function readOnlyId(value: ReadOnlyModel): int32 { return value.id; }
function pickedId(value: ModelId): int32 { return value.id; }
function omittedLabel(value: ModelWithoutId): string { return value.label; }
function recordTotal(value: Totals): int32 { return value.left + value.right; }

type Selection = "left" | "right" | undefined;
type PresentSelection = NonNullable<Selection>;
type LeftSelection = Extract<PresentSelection, "left">;
type RightSelection = Exclude<PresentSelection, "left">;
function leftSelection(): LeftSelection { return "left"; }
function rightSelection(): RightSelection { return "right"; }

interface Thenable<T> { then(onfulfilled: (value: T) => void): void; }
type AwaitedInt = Awaited<Thenable<int32>>;
type NestedAwaitedInt = Awaited<Thenable<Thenable<int32>>>;
function awaitedValue(value: AwaitedInt): int32 { return value; }
function nestedAwaitedValue(value: NestedAwaitedInt): int32 { return value; }

function format(value: int32, suffix: string): string {
  void value;
  return suffix;
}
type FormatParameters = Parameters<typeof format>;
type FormatResult = ReturnType<typeof format>;
function callFormat(values: FormatParameters): FormatResult {
  return format(values[0], values[1]);
}

class Pair {
  left: int32;
  label: string;
  constructor(left: int32, label: string) {
    this.left = left;
    this.label = label;
  }
}
type PairParameters = ConstructorParameters<typeof Pair>;
type PairInstance = InstanceType<typeof Pair>;
function constructPair(values: PairParameters): PairInstance {
  return new Pair(values[0], values[1]);
}

interface Receiver { value: int32; }
type BoundIncrement = (this: Receiver, delta: int32) => int32;
type IncrementReceiver = ThisParameterType<BoundIncrement>;
type DetachedIncrement = OmitThisParameter<BoundIncrement>;
type BoundFormat = (this: Receiver, value: int32, suffix: string) => string;
type DetachedFormat = OmitThisParameter<BoundFormat>;
function receiverValue(receiver: IncrementReceiver): int32 { return receiver.value; }
function callDetached(increment: DetachedIncrement): int32 { return increment(2 as int32); }
function callDetachedFormat(formatter: DetachedFormat): string {
  return formatter(3 as int32, "items");
}

function choose<T>(value: T, fallback: NoInfer<T>): T {
  void fallback;
  return value;
}
function chooseInt(value: int32): int32 { return choose(value, 0 as int32); }

interface ContextualMethods { read(): int32; }
type ContextualObject = Receiver & ContextualMethods & ThisType<Receiver & ContextualMethods>;
function contextualValue(): int32 {
  const object: ContextualObject = {
    value: 11 as int32,
    read(): int32 { return this.value; },
  };
  return object.read();
}

type Loud = Uppercase<"ready">;
type Quiet = Lowercase<"QUIET">;
type Greeting = Capitalize<"hello">;
type Subject = Uncapitalize<"World">;
function loud(): Loud { return "READY"; }
function quiet(): Quiet { return "quiet"; }
function greeting(): Greeting { return "Hello"; }
function subject(): Subject { return "world"; }

type Optional = (first: int32, label?: string) => string;
type OptionalParameters = Parameters<Optional>;
type OptionalResult = ReturnType<Optional>;
function optionalSummary(values: OptionalParameters): OptionalResult {
  return \`${"${values[0]}:${values[1] ?? \"none\"}"}\`;
}

type Rest = (...flags: boolean[]) => boolean;
type RestParameters = Parameters<Rest>;
type RestResult = ReturnType<Rest>;
function restSummary(values: RestParameters): RestResult {
  return values[0];
}

type OverloadedParameters = Parameters<Overloaded>;
type OverloadedResult = ReturnType<Overloaded>;
function overloadSummary(values: OverloadedParameters): OverloadedResult {
  return \`${"${values[0]}${values[1] ?? \"\"}"}\`;
}

class OptionalBox {
  value: int32;
  label: string;
  constructor(value: int32, label?: string) {
    this.value = value;
    this.label = label ?? "none";
  }
}
type OptionalBoxParameters = ConstructorParameters<typeof OptionalBox>;
type OptionalBoxInstance = InstanceType<typeof OptionalBox>;
function constructOptional(values: OptionalBoxParameters): OptionalBoxInstance {
  return new OptionalBox(values[0], values[1]);
}

type Bound = (this: Receiver, value: int32, label?: string) => string;
type BoundReceiver = ThisParameterType<Bound>;
type DetachedBound = OmitThisParameter<Bound>;
function callBound(receiver: BoundReceiver, callable: DetachedBound): string {
  return \`${"${receiver.value}:${callable(3 as int32, \"bound\")}"}\`;
}

function chooseLiteral<C>(value: C, fallback: NoInfer<C>): C {
  void fallback;
  return value;
}

type LoudUnion = Uppercase<"ready" | "set">;
type QuietUnion = Lowercase<"LOUD" | "QUIET">;
type GreetingUnion = Capitalize<"hello" | "world">;
type SubjectUnion = Uncapitalize<"Alpha" | "Beta">;
function loudUnion(selected: boolean): string {
  const loudValue: LoudUnion = selected ? "READY" : "SET";
  const quietValue: QuietUnion = selected ? "loud" : "quiet";
  const greetingValue: GreetingUnion = selected ? "Hello" : "World";
  const subjectValue: SubjectUnion = selected ? "alpha" : "beta";
  return \`${"${loudValue}:${quietValue}:${greetingValue}:${subjectValue}"}\`;
}

function localPartial(value: LocalPartial<{ value: int32 }>): string { return value; }
function localParameters(value: LocalParameters<(value: int32) => int32>): [string] { return value; }
function localReturn(value: LocalReturnType<() => string>): boolean { return value; }
function localDetached(value: LocalOmitThisParameter<(this: { value: int32 }) => string>): int32 { return value; }

function localIdentitySummary(): string {
  return \`${"${localPartial(\"shadow\")}:${localParameters([\"tuple\"])[0]}:${localReturn(true)}:${localDetached(7 as int32)}"}\`;
}

const pair = constructPair([8 as int32, "pair"]);
const optional = constructOptional([12 as int32]);
const bound = callBound(
  { value: 14 as int32 },
  (value: int32, label?: string): string =>
    value + ":" + (label ?? "none"),
);
Console.WriteLine(
  patchId({ label: "patch" }) + "|" +
  requiredId({ id: 1 as int32, label: "required", active: true }) + "|" +
  readOnlyId({ id: 2 as int32, label: "readonly", active: false }) + "|" +
  pickedId({ id: 3 as int32 }) + "|" +
  omittedLabel({ label: "omitted", active: true }) + "|" +
  recordTotal({ left: 4 as int32, right: 5 as int32 }) + "|" +
  leftSelection() + "|" + rightSelection() + "|" +
  awaitedValue(6 as int32) + "|" +
  callFormat([7 as int32, "formatted"]) + "|" +
  pair.left + ":" + pair.label + "|" +
  receiverValue({ value: 9 as int32 }) + "|" +
  callDetached((delta: int32): int32 => delta + (1 as int32)) + "|" +
  callDetachedFormat((_value: int32, suffix: string): string => suffix) + "|" +
  chooseInt(10 as int32) + "|" + contextualValue() + "|" +
  loud() + "|" + quiet() + "|" + greeting() + "|" + subject() + "|" +
  optionalSummary([10 as int32]) + "|" +
  optionalSummary([11 as int32, "label"]) + "|" +
  restSummary([false]) + "|" + restSummary([true, false]) + "|" +
  overloadSummary(["over", "load"]) + "|" +
  optional.value + ":" + optional.label + "|" +
  nestedAwaitedValue(13 as int32) + "|" + bound + "|" +
  chooseLiteral("red", "red") + "|" + contextualValue() + "|" +
  loudUnion(true) + "|" + localIdentitySummary(),
);
`;

const overloadDeclarations = `
import type { int32 } from "@tsonic/core/types.js";

export interface Overloaded {
  (value: int32): int32;
  (value: string, suffix?: string): string;
}
`;

const shadowUtilityDeclarations = `
import type { int32 } from "@tsonic/core/types.js";
export type Partial<T> = string;
export type Parameters<T> = [string];
export type ReturnType<T> = boolean;
export type OmitThisParameter<T> = int32;
`;
