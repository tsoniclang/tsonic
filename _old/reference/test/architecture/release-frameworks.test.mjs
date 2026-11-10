import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { hostRoot } from "../../scripts/release/npm-wave.mjs";
import { readCsharpFrameworkMatrix, verifyCsharpFrameworks } from "../../scripts/release/verify-csharp-frameworks.mjs";

test("framework matrix accepts explicit SDK selections and rejects malformed input", () => {
  assert.deepEqual(readCsharpFrameworkMatrix(undefined), []);
  const selections = readCsharpFrameworkMatrix(JSON.stringify([
    { framework: "net10.0", sdk: "10.0.400" },
    { framework: "net11.0", sdk: "11.0.100-rc.1.26425.128" },
  ]));
  assert.equal(Object.isFrozen(selections), true);
  assert.equal(Object.isFrozen(selections[0]), true);
  for (const value of [null, {}, [null], [{}],
    [{ framework: "net9.0", sdk: "10.0.400" }],
    [{ framework: "net11.0", sdk: "latest" }],
    [{ framework: "net11.0", sdk: "11.0.100", extra: true }],
    [{ framework: 11, sdk: "11.0.100" }],
  ]) {
    assert.throws(() => readCsharpFrameworkMatrix(JSON.stringify(value)), /JSON array|exact SDK version/u);
  }
});

test("installed framework proof shares cold and warm execution without reinstalling", () => {
  const selections = [
    { framework: "net10.0", sdk: "10.0.400" },
    { framework: "net11.0", sdk: "11.0.100-rc.1.26425.128" },
    { framework: "net10.0", sdk: "11.0.100-rc.1.26425.128" },
  ];
  const fixture = createFrameworkFixture(selections);
  fixture.execute();
  assert.deepEqual(fixture.verified, [
    "net10.0 cold", "net10.0 warm", "net11.0 cold", "net11.0 warm", "net10.0 cold", "net10.0 warm",
  ]);
  assert.equal(fixture.commands.length, 9);
  assert.equal(fixture.commands.filter(([command]) => command === "npm").length, 6);
  const source = readFileSync(resolve(fixture.root, "src/App.ts"), "utf8");
  assert.match(source, /Environment\.Version\.Major !== 10/u);
  assert.ok(source.includes(JSON.stringify(fixture.options.message)));
  const config = JSON.parse(readFileSync(resolve(fixture.root, "tsonic.json"), "utf8"));
  assert.deepEqual(config.targets[0].surfaces, ["js"]);
  assert.equal(config.targets[0].options.targetFramework, "net10.0");
});

test("framework proof rejects a different selected SDK before compilation", () => {
  const fixture = createFrameworkFixture();
  fixture.options.run = () => "10.0.400\n";
  assert.throws(fixture.execute, /did not select SDK 11\.0\.100/u);
  assert.deepEqual(fixture.verified, []);
});

test("framework proof retains runtime, framework and dependency-path guards", () => {
  for (const failure of ["runtime", "framework", "dependency"]) {
    const fixture = createFrameworkFixture();
    const run = fixture.options.run;
    fixture.options.run = (command, args, options) => {
      const result = run(command, args, options);
      if (command !== "npm") return result;
      if (failure === "runtime") return "wrong result\n";
      writeFileSync(fixture.project, [
        `<TargetFramework>${failure === "framework" ? "net10.0" : "net11.0"}</TargetFramework>`,
        `/csharp/runtime/${failure === "dependency" ? "net10.0" : "net11.0"}/project.csproj`,
      ].join("\n"));
      return result;
    };
    assert.throws(fixture.execute, /runtime contract|framework selection/u);
    assert.deepEqual(fixture.verified, []);
  }
});

test("framework proof retains the caller's installed-package validation", () => {
  const fixture = createFrameworkFixture();
  fixture.options.verifyInstallation = () => { throw new Error("installed package changed"); };
  assert.throws(fixture.execute, /installed package changed/u);
  assert.equal(fixture.commands.filter(([command]) => command === "npm").length, 1);
});

function createFrameworkFixture(selections = [{ framework: "net11.0", sdk: "11.0.100" }]) {
  const scratch = resolve(hostRoot, ".temp/release-framework-proofs");
  mkdirSync(scratch, { recursive: true });
  const root = mkdtempSync(resolve(scratch, "proof-"));
  mkdirSync(resolve(root, "src"));
  mkdirSync(resolve(root, "build-output/csharp"), { recursive: true });
  const project = resolve(root, "build-output/csharp/SelectedAssembly.csproj");
  writeFileSync(resolve(root, "tsonic.json"), JSON.stringify({
    outDir: "build-output",
    targets: [{ id: "csharp", options: { assemblyName: "SelectedAssembly", targetFramework: "net10.0" } }],
  }));
  const environment = { TSONIC_CSHARP_FRAMEWORK_MATRIX: JSON.stringify(selections) };
  const commands = [];
  const verified = [];
  const options = {
    environment,
    message: 'exact "message"\n',
    verifyInstallation: (selection) => verified.push(selection),
    run(command, args, commandOptions) {
      commands.push([command, args]);
      assert.equal(commandOptions.env, environment);
      assert.equal(commandOptions.cwd, root);
      assert.equal(commandOptions.capture, true);
      if (command === "dotnet") {
        assert.deepEqual(args, ["--version"]);
        return `${JSON.parse(readFileSync(resolve(root, "global.json"), "utf8")).sdk.version}\n`;
      }
      assert.equal(command, "npm");
      assert.deepEqual(args, ["start", "--silent"]);
      const config = JSON.parse(readFileSync(resolve(root, "tsonic.json"), "utf8"));
      const framework = config.targets[0].options.targetFramework;
      writeFileSync(project, `<TargetFramework>${framework}</TargetFramework>\n/csharp/runtime/${framework}/project.csproj\n`);
      return "build output\r\n2,4,6\r\n";
    },
  };
  return { root, project, commands, verified, options, execute: () => verifyCsharpFrameworks(root, options) };
}
