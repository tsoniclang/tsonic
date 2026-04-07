import { describe, it } from "mocha";
import { expect } from "chai";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildIrModule } from "./builder.js";
import {
  runAnonymousTypeLoweringPass,
  runCallResolutionRefreshPass,
  runNumericProofPass,
} from "./validation/index.js";
import {
  createProgram,
  createProgramContext,
} from "./builder-cases/_test-helpers.js";
import { IrModule, IrVariableDeclaration } from "./types.js";

const currentFileDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentFileDir, "../../../..");
const jsonRoundtripProjectRoot = path.join(
  repoRoot,
  "test",
  "fixtures",
  "json-native-roundtrip",
  "packages",
  "json-native-roundtrip"
);
const jsonRoundtripSourceRoot = path.join(jsonRoundtripProjectRoot, "src");
const jsonRoundtripEntryPath = path.join(jsonRoundtripSourceRoot, "index.ts");

const buildJsonRoundtripModule = (): IrModule => {
  const programResult = createProgram([jsonRoundtripEntryPath], {
    projectRoot: jsonRoundtripProjectRoot,
    sourceRoot: jsonRoundtripSourceRoot,
    rootNamespace: "Test",
    surface: "@tsonic/js",
  });

  expect(programResult.ok).to.equal(true);
  if (!programResult.ok) {
      throw new Error(
      programResult.error.diagnostics
        .map((d: { message: string }) => d.message)
        .join("; ")
    );
  }

  const program = programResult.value;
  const sourceFile = program.sourceFiles.find(
    (candidate: { fileName: string }) =>
      path.resolve(candidate.fileName) === path.resolve(jsonRoundtripEntryPath)
  );
  if (!sourceFile) {
    throw new Error("Failed to load json-native-roundtrip source file.");
  }

  const options = {
    sourceRoot: jsonRoundtripSourceRoot,
    rootNamespace: "Test",
    surface: "@tsonic/js" as const,
  };
  const ctx = createProgramContext(program, options);
  const buildResult = buildIrModule(sourceFile, program, options, ctx);

  expect(buildResult.ok).to.equal(true);
  if (!buildResult.ok) {
    throw new Error(JSON.stringify(buildResult.error));
  }

  const anonymous = runAnonymousTypeLoweringPass([buildResult.value]);
  const refreshed = runCallResolutionRefreshPass(anonymous.modules, ctx);
  const numeric = runNumericProofPass(refreshed.modules);
  const module = numeric.modules.find((candidate) => candidate.filePath === "index.ts");
  if (!module) {
    throw new Error("Expected json-native-roundtrip IR module.");
  }
  return module;
};

describe("IR Builder", function () {
  this.timeout(60_000);

  describe("global JSON typing", () => {
    it("preserves concrete typed JSON.parse results instead of widening them back to JsValue", () => {
      const module = buildJsonRoundtripModule();
      const main = module.body.find(
        (statement): statement is Extract<
          IrModule["body"][number],
          { kind: "functionDeclaration" }
        > =>
          statement.kind === "functionDeclaration" && statement.name === "main"
      );

      expect(main).to.not.equal(undefined);
      if (!main) return;

      const parsedDeclaration = main.body.statements.find(
        (statement): statement is IrVariableDeclaration =>
          statement.kind === "variableDeclaration" &&
          statement.declarations.some(
            (declaration) =>
              declaration.name.kind === "identifierPattern" &&
              declaration.name.name === "parsed"
          )
      );

      expect(parsedDeclaration).to.not.equal(undefined);
      if (!parsedDeclaration) return;

      const parsed = parsedDeclaration.declarations.find(
        (declaration) =>
          declaration.name.kind === "identifierPattern" &&
          declaration.name.name === "parsed"
      );

      expect(parsed?.initializer?.kind).to.equal("call");
      expect(parsed?.initializer?.inferredType).to.deep.include({
        kind: "referenceType",
        name: "Payload",
      });
      expect(parsed?.initializer?.inferredType).to.not.deep.include({
        kind: "referenceType",
        name: "JsValue",
      });
    });
  });
});
