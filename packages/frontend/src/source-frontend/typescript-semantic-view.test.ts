import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import {
  createSourceSemanticFactStore,
  defineSourceSemanticFactKey,
} from "./semantic-view.js";
import { numericPrimitiveFactKey } from "./source-facts.js";
import { createTypeScriptSemanticView } from "./typescript-semantic-view.js";

const createTypeScriptProgram = (
  sourceText: string
): {
  readonly program: ts.Program;
  readonly sourceFile: ts.SourceFile;
  readonly cleanup: () => void;
} => {
  const projectRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "tsonic-semantic-view-")
  );
  const sourceFilePath = path.join(projectRoot, "index.ts");
  fs.writeFileSync(sourceFilePath, sourceText);
  const program = ts.createProgram([sourceFilePath], {
    strict: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
  });
  const sourceFile = program.getSourceFile(sourceFilePath);
  if (!sourceFile) {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    throw new Error(`TypeScript did not load ${sourceFilePath}`);
  }

  return {
    program,
    sourceFile,
    cleanup: () => fs.rmSync(projectRoot, { recursive: true, force: true }),
  };
};

const collectPropertyReceivers = (
  sourceFile: ts.SourceFile
): readonly ts.Identifier[] => {
  const receivers: ts.Identifier[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "value"
    ) {
      receivers.push(node.expression);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return receivers;
};

describe("TypeScript semantic view", () => {
  it("answers flow-sensitive expression types at the exact use site", () => {
    const fixture = createTypeScriptProgram(`
      export function render(value: string | number): string {
        if (typeof value === "string") {
          return value.toUpperCase();
        }
        return value.toFixed();
      }
    `);

    try {
      const checker = fixture.program.getTypeChecker();
      const semantics = createTypeScriptSemanticView(checker);
      const receivers = collectPropertyReceivers(fixture.sourceFile);

      expect(receivers).to.have.length(2);
      expect(
        checker.typeToString(semantics.getExpressionType(receivers[0]!))
      ).to.equal("string");
      expect(
        checker.typeToString(semantics.getExpressionType(receivers[1]!))
      ).to.equal("number");
    } finally {
      fixture.cleanup();
    }
  });

  it("keeps extension facts keyed to node identity, not identifier text", () => {
    const fixture = createTypeScriptProgram(`
      export function render(value: string | number): string {
        if (typeof value === "string") {
          return value.toUpperCase();
        }
        return value.toFixed();
      }
    `);

    try {
      const checker = fixture.program.getTypeChecker();
      const factStore = createSourceSemanticFactStore<ts.Node>();
      const semantics = createTypeScriptSemanticView(checker, factStore);
      const receivers = collectPropertyReceivers(fixture.sourceFile);
      const factKey = defineSourceSemanticFactKey<{ readonly branch: string }>(
        "test:branch"
      );

      factStore.set(receivers[0]!, factKey, { branch: "string" });

      expect(semantics.getFact(receivers[0]!, factKey)).to.deep.equal({
        branch: "string",
      });
      expect(semantics.getFact(receivers[1]!, factKey)).to.equal(undefined);
    } finally {
      fixture.cleanup();
    }
  });

  it("carries source-extension facts without changing TypeScript AST nodes", () => {
    const fixture = createTypeScriptProgram(`
      export function add(left: number, right: number): number {
        return left + right;
      }
    `);

    try {
      const checker = fixture.program.getTypeChecker();
      const factStore = createSourceSemanticFactStore<ts.Node>();
      const semantics = createTypeScriptSemanticView(checker, factStore);
      const parameters = fixture.sourceFile.statements
        .filter(ts.isFunctionDeclaration)
        .flatMap((statement) => [...statement.parameters]);
      const leftType = parameters[0]?.type;

      expect(leftType).to.not.equal(undefined);
      if (!leftType) return;

      factStore.set(leftType, numericPrimitiveFactKey, {
        sourceName: "int",
        kind: "int32",
        runtimeBase: "number",
        signed: true,
        width: 32,
      });

      expect(
        semantics.getFact(leftType, numericPrimitiveFactKey)
      ).to.deep.equal({
        sourceName: "int",
        kind: "int32",
        runtimeBase: "number",
        signed: true,
        width: 32,
      });
    } finally {
      fixture.cleanup();
    }
  });
});
