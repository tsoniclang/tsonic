import { assert, assertGeneratedOutputHasNoReflectionSemantics, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedCsharpRunner, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";

test("CLI executes checked visibility and readonly annotations through native class members", async () => {
  const projectDirectory = resolve(tempRoot, "typescript-only-modifiers");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedTypeScriptOnlyModifiers",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class Box {",
      "  public visible: number = 1;",
      "  private hidden: number = 2;",
      "  readonly id: number = 3;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double visible = 1;/u);
  assert.match(generatedSource, /private double hidden = 2;/u);
  assert.match(generatedSource, /public readonly double id = 3;/u);
  assert.doesNotMatch(generatedSource, /__unsupported|InvalidExpression|dynamic|System\.Reflection/u);
  assert.equal(await runGeneratedCsharpRunner(projectDirectory, "SmokeGeneratedTypeScriptOnlyModifiers", [
    "using System;",
    "public static class Program",
    "{",
    "    public static void Main()",
    "    {",
    "        var box = new Smoke.Generated.Box();",
    "        Console.WriteLine($\"{box.visible}:{box.id}\");",
    "    }",
    "}",
  ]), "1:3\n");
});

test("CLI preserves checker rejection of external private/protected access and readonly writes", async () => {
  const cases = [
    {
      name: "private-read",
      source: "class Box { private hidden = 2; }\nexport function read(box: Box) { return box.hidden; }\n",
      diagnostic: /TS2341: Property 'hidden' is private and only accessible within class 'Box'/u,
    },
    {
      name: "protected-read",
      source: "class Box { protected hidden = 2; }\nexport function read(box: Box) { return box.hidden; }\n",
      diagnostic: /TS2445: Property 'hidden' is protected and only accessible within class 'Box' and its subclasses/u,
    },
    {
      name: "readonly-write",
      source: "class Box { readonly id = 3; }\nexport function write(box: Box): void { box.id = 4; }\n",
      diagnostic: /TS2540: Cannot assign to 'id' because it is a read-only property/u,
    },
  ];
  for (const current of cases) {
    const projectDirectory = resolve(tempRoot, `checked-class-${current.name}`);
    await writeProject(projectDirectory, {
      "tsonic.json": JSON.stringify({
        entryPoint: "index.ts",
        rootDir: "src",
        outDir: "out",
        targets: [{ id: "csharp" }],
      }, null, 2),
      "src/index.ts": current.source,
    });
    const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
    assert.equal(build.status, 1, current.name);
    assert.match(build.stderr, current.diagnostic);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/src/Index.cs")), false, current.name);
    assert.equal(existsSync(resolve(projectDirectory, "out/csharp/TsonicGenerated.csproj")), false, current.name);
  }
});

test("CLI emits sanitized C# names through source-owned provider facts", async () => {
  const projectDirectory = resolve(tempRoot, "source-owned-sanitized-names");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          options: {
            namespace: "Smoke.Generated",
            assemblyName: "SmokeGeneratedSanitizedNames",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export class KeywordBox {",
      "  default: number = 1;",
      "}",
      "",
      "export function read(box: KeywordBox): number {",
      "  return box.default;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stderr);

  const generatedSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(generatedSource, /public double @default = 1;/);
  assert.match(generatedSource, /return box\.@default;/);
  assert.doesNotMatch(generatedSource, /__unsupported/);

  const dotnet = run("dotnet", ["build", resolve(projectDirectory, "out/csharp/SmokeGeneratedSanitizedNames.csproj"), "--nologo", "--v:minimal"]);
  assert.equal(dotnet.status, 0, dotnet.stdout + dotnet.stderr);
});

test("CLI builds and runs source declarations without reflection or dynamic generated paths", async () => {
  const assemblyName = "SmokeGeneratedDeclarationRuntime";
  const projectDirectory = resolve(tempRoot, "declaration-runtime-proof");
  await writeProject(projectDirectory, {
    "tsonic.json": JSON.stringify({
      entryPoint: "index.ts",
      rootDir: "src",
      outDir: "out",
      targets: [
        {
          id: "csharp",
          surfaces: ["js"],
          options: {
            outputType: "Exe",
            namespace: "Smoke.Generated",
            assemblyName,
          },
        },
      ],
    }, null, 2),
    "src/model.ts": [
      "export enum Rank {",
      "  Silver = 2,",
      "  Gold = 3,",
      "}",
      "",
      "export interface Receipt {",
      "  label: string;",
      "  points: number;",
      "  rank: Rank;",
      "}",
      "",
      "export class Entity {",
      "  static suffix: string = \"score\";",
      "  label: string;",
      "",
      "  constructor(label: string) {",
      "    this.label = label;",
      "  }",
      "",
      "  get title(): string {",
      "    return this.label + \"-\" + Entity.suffix;",
      "  }",
      "",
      "  baseScore(): number {",
      "    return 4;",
      "  }",
      "}",
      "",
      "export class ScoreCard extends Entity {",
      "  static bonus: number = 3;",
      "",
      "  static create(label: string, points: number): ScoreCard {",
      "    return new ScoreCard(label, points);",
      "  }",
      "",
      "  points: number;",
      "",
      "  get title(): string {",
      "    return this.label + \"-score:\" + this.points;",
      "  }",
      "",
      "  constructor(label: string, points: number) {",
      "    super(label);",
      "    this.points = points;",
      "  }",
      "",
      "  finalScore(): number {",
      "    return super.baseScore() + this.points + ScoreCard.bonus;",
      "  }",
      "}",
      "",
      "export function classify(points: number): Rank {",
      "  return points > 10 ? Rank.Gold : Rank.Silver;",
      "}",
      "",
      "export function makeReceipt(card: ScoreCard): Receipt {",
      "  const points = card.finalScore();",
      "  return { label: card.title, points, rank: classify(points) };",
      "}",
      "",
    ].join("\n"),
    "src/index.ts": [
      "import { Rank, ScoreCard, makeReceipt } from \"./model.js\";",
      "",
      "const card = ScoreCard.create(\"Ada\", 8);",
      "const receipt = makeReceipt(card);",
      "const rank = receipt.rank === Rank.Gold ? \"gold\" : \"silver\";",
      "console.log(receipt.label + \":\" + receipt.points + \":\" + rank);",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 0, build.stdout + build.stderr);

  const modelSource = await readFile(resolve(projectDirectory, "out/csharp/src/Model.cs"), "utf8");
  assert.match(modelSource, /public enum Rank[\s\S]*Silver = 2,[\s\S]*Gold = 3/);
  assert.match(modelSource, /public interface Receipt[\s\S]*string label \{ get; set; \}[\s\S]*double points \{ get; set; \}[\s\S]*Rank rank \{ get; set; \}/);
  assert.match(modelSource, /public class Entity[\s\S]*public static string suffix = "score";[\s\S]*public Entity\(string label\)/);
  assert.match(modelSource, /public virtual string title[\s\S]*get[\s\S]*return this\.label \+ "-" \+ Entity\.suffix;/);
  assert.match(modelSource, /public override string title[\s\S]*get[\s\S]*return (?:this|\(\(Entity\)this\))\.label \+ "-score:" \+ this\.points;/);
  assert.match(modelSource, /public class ScoreCard : Entity[\s\S]*public static double bonus = 3;[\s\S]*public static ScoreCard create\(string label, double points\)/);
  assert.match(modelSource, /public ScoreCard\(string label, double points\) : base\(label\)/);
  assert.match(modelSource, /return base\.baseScore\(\) \+ this\.points \+ ScoreCard\.bonus;/);
  const shapeSource = await readFile(resolve(projectDirectory, "out/csharp/generated/TsonicObjectShapes.cs"), "utf8");
  const shapeName = /public class (ReceiptShape_[a-f0-9]{12}) : Receipt/u.exec(shapeSource)?.[1];
  assert.ok(shapeName);
  assert.match(shapeSource, /public required string label\s*\{\s*get;\s*set;\s*\}[\s\S]*public required double points\s*\{\s*get;\s*set;\s*\}[\s\S]*public required Rank rank\s*\{\s*get;\s*set;\s*\}/u);
  assert.match(modelSource, new RegExp(`return new ${shapeName}[\\s\\S]*label = (?:card|\\(\\(Entity\\)card\\))\\.title,[\\s\\S]*points = points,[\\s\\S]*rank = global::Smoke\\.Generated\\.Model\\.classify\\(points\\)`));

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /ScoreCard\.create\("Ada", 8\)/);
  assert.match(indexSource, /public static string rank\s*\{\s*get;\s*private set;\s*\} = default\(string\)!;/u);
  assert.match(indexSource, /rank = global::Smoke\.Generated\.Index\.receipt\.rank == Rank\.Gold \? "gold" : "silver";/);
  assert.match(indexSource, /Tsonic\.CSharp\.Js\.console\.log\(global::Smoke\.Generated\.Index\.receipt\.label \+ ":" \+ global::Smoke\.Generated\.Index\.receipt\.points \+ ":" \+ global::Smoke\.Generated\.Index\.rank\);/);

  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Ada-score:8:15:gold\n");
});
