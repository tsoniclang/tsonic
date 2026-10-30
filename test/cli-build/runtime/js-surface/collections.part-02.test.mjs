import { assert, assertRuntimeProjectReference, assertNoRuntimeReference, assertNoInstalledAssemblyReference, cliPath, existsSync, readFile, resolve, run, runGeneratedProject, runNode, tempRoot, test, writeProject } from "../../helpers/harness.mjs";
import { assertExternalCallNotMapped } from "./collections.split-fixtures.mjs";

test("CLI rejects Map and Set without selected JS surface declarations", async () => {
  const projectDirectory = resolve(tempRoot, "map-set-without-js-surface");
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
            assemblyName: "SmokeGeneratedMapSetWithoutJsSurface",
          },
        },
      ],
    }, null, 2),
    "src/index.ts": [
      "export function count(key: string): number {",
      "  const counts = new Map<string, number>();",
      "  const names = new Set<string>();",
      "  counts.set(key, 1);",
      "  names.add(key);",
      "  return counts.size + names.size;",
      "}",
      "",
    ].join("\n"),
  });

  const build = runNode([cliPath, "build", "--project", resolve(projectDirectory, "tsonic.json")]);
  assert.equal(build.status, 1);
  assert.match(build.stderr, /TS2583: Cannot find name 'Map'/);
  assert.match(build.stderr, /TS2583: Cannot find name 'Set'/);
  assert.doesNotMatch(build.stderr, /tsonic-csharp:/);
  assert.equal(existsSync(resolve(projectDirectory, "out/csharp/SmokeGeneratedMapSetWithoutJsSurface.csproj")), false);
});
