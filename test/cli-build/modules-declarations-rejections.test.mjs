import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { assert, cliPath, existsSync, readFile, repoRoot, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "./harness.mjs";

const bannedGeneratedRuntimeSemantics = [
  /\bdynamic\b/u,
  /\bSystem\.Reflection\b/u,
  /\bGetProperty\b/u,
  /\bGetProperties\b/u,
  /\bGetMethod\b/u,
  /\bGetMethods\b/u,
  /\bMethodInfo\.Invoke\b/u,
  /\bMakeGenericMethod\b/u,
  /\bActivator\.CreateInstance\b/u,
  /\bAssembly\.Load\b/u,
];

test("CLI rejects TypeScript-only runtime-shape modifiers before C# emission", async () => {
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
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TypeScript-only modifier 'public'/);
  assert.match(build.stderr, /TypeScript-only modifier 'private'/);
  assert.match(build.stderr, /TypeScript-only modifier 'readonly'/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedTypeScriptOnlyModifiers.csproj")), false);
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
  assert.match(modelSource, /public interface Receipt[\s\S]*string label \{ get; \}[\s\S]*double points \{ get; \}[\s\S]*Rank rank \{ get; \}/);
  assert.match(modelSource, /public class Entity[\s\S]*public static string suffix = "score";[\s\S]*public Entity\(string label\)/);
  assert.match(modelSource, /public virtual string title[\s\S]*get[\s\S]*return this\.label \+ "-" \+ Entity\.suffix;/);
  assert.match(modelSource, /public override string title[\s\S]*get[\s\S]*return (?:this|\(\(Entity\)this\))\.label \+ "-score:" \+ this\.points;/);
  assert.match(modelSource, /public class ScoreCard : Entity[\s\S]*public static double bonus = 3;[\s\S]*public static ScoreCard create\(string label, double points\)/);
  assert.match(modelSource, /public ScoreCard\(string label, double points\) : base\(label\)/);
  assert.match(modelSource, /return base\.baseScore\(\) \+ this\.points \+ ScoreCard\.bonus;/);
  assert.match(modelSource, /public class __TsonicShape_Receipt_[A-Za-z0-9_]+ : Receipt[\s\S]*public string label[\s\S]*get;[\s\S]*set;[\s\S]*public double points[\s\S]*get;[\s\S]*set;[\s\S]*public Rank rank[\s\S]*get;[\s\S]*set;/);
  assert.match(modelSource, /return new __TsonicShape_Receipt_[A-Za-z0-9_]+[\s\S]*label = (?:card|\(\(Entity\)card\))\.title,[\s\S]*points = points,[\s\S]*rank = (?:Model\.)?classify\(points\)/);

  const indexSource = await readFile(resolve(projectDirectory, "out/csharp/src/Index.cs"), "utf8");
  assert.match(indexSource, /ScoreCard\.create\("Ada", 8\)/);
  assert.match(indexSource, /public static readonly string rank;/);
  assert.match(indexSource, /rank = receipt\.rank == Rank\.Gold \? "gold" : "silver";/);
  assert.match(indexSource, /Tsonic\.CSharp\.Js\.console\.log\(receipt\.label \+ ":" \+ receipt\.points \+ ":" \+ rank\);/);

  await assertGeneratedOutputHasNoReflectionSemantics(projectDirectory);
  assert.equal(runGeneratedProject(projectDirectory, assemblyName), "Ada-score:8:15:gold\n");
});

