import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { CSharpLoweringModulePlan } from "../types.js";
import { emitModule } from "./module.js";

const dummySourceFile = {} as CSharpLoweringModulePlan["sourceFile"];
const dummySourceModule = {} as CSharpLoweringModulePlan["sourceModule"];
const dummySourceNode =
  {} as CSharpLoweringModulePlan["topLevelStatements"][number]["sourceNode"];

const structuralTarget: LoweringTypeRefPlan = {
  kind: "object",
  members: [
    {
      kind: "property",
      name: "value",
      optional: false,
      type: {
        kind: "intrinsic",
        name: "string",
      },
    },
  ],
};

const intType: LoweringTypeRefPlan = {
  kind: "source-primitive",
  fact: {
    sourceName: "int",
    kind: "int32",
    runtimeBase: "number",
    signed: true,
    width: 32,
  },
};

const declarationPlan = (
  overrides: Partial<LoweringDeclarationPlan>
): LoweringDeclarationPlan => ({
  kind: "declaration",
  sourceFile: dummySourceFile,
  sourceNode: dummySourceNode,
  sourceKind: 0,
  sourceKindName: "Declaration",
  sourceText: "",
  nameIsComputed: false,
  declarationKind: "unknown",
  heritageTypes: [],
  baseConstructorParameters: [],
  parameters: [],
  typeParameters: [],
  members: [],
  enumMembers: [],
  exported: true,
  async: false,
  static: false,
  override: false,
  accessibility: "public",
  accessibilityExplicit: false,
  ...overrides,
});

const expressionPlan = (
  overrides: Partial<LoweringExpressionPlan>
): LoweringExpressionPlan => ({
  kind: "expression",
  sourceFile: dummySourceFile,
  sourceNode: dummySourceNode,
  sourceKind: 0,
  sourceKindName: "Expression",
  sourceText: "",
  nameIsComputed: false,
  expressionKind: "identifier",
  arguments: [],
  typeArguments: [],
  elements: [],
  properties: [],
  templateParts: [],
  parameters: [],
  ...overrides,
});

const statementPlan = (
  overrides: Partial<LoweringStatementPlan>
): LoweringStatementPlan => ({
  kind: "statement",
  sourceFile: dummySourceFile,
  sourceNode: dummySourceNode,
  sourceKind: 0,
  sourceKindName: "Statement",
  sourceText: "",
  nameIsComputed: false,
  statementKind: "empty",
  cases: [],
  statements: [],
  declarations: [],
  ...overrides,
});

describe("C# module renderer", () => {
  it("collects structural helper types through named alias targets", () => {
    const module: CSharpLoweringModulePlan = {
      kind: "lowering-module",
      backendTargetId: "csharp",
      identity: {
        filePath: "/src/index.ts",
        className: "Index",
        namespace: "Example",
      },
      sourceFile: dummySourceFile,
      sourceModule: dummySourceModule,
      imports: [],
      exports: [],
      declarations: [],
      topLevelStatements: [
        {
          kind: "statement",
          sourceFile: dummySourceFile,
          sourceNode: dummySourceNode,
          sourceKind: 0,
          sourceKindName: "VariableStatement",
          sourceText: "const item: Alias",
          nameIsComputed: false,
          statementKind: "variable",
          cases: [],
          statements: [],
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "item",
              type: {
                kind: "named",
                name: "Alias",
                typeArguments: [],
                aliasTarget: structuralTarget,
              },
              bindingElements: [],
            },
          ],
        },
      ],
      types: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.match(/public sealed class __TsonicShape_[a-f0-9]+/u);
      expect(result.code).to.contain("public string value { get; set; }");
      expect(result.code).to.contain("public static Alias item;");
    }
  });

  it("renders struct and field semantics from lowering plan facts", () => {
    const module: CSharpLoweringModulePlan = {
      kind: "lowering-module",
      backendTargetId: "csharp",
      identity: {
        filePath: "/src/index.ts",
        className: "Index",
        namespace: "Example",
      },
      sourceFile: dummySourceFile,
      sourceModule: dummySourceModule,
      imports: [],
      exports: [],
      declarations: [
        declarationPlan({
          declarationKind: "interface",
          name: "Point",
          sourceTypeKind: "struct",
          members: [
            declarationPlan({
              declarationKind: "property",
              name: "x",
              returnType: intType,
              storageSemantics: "field",
            }),
            declarationPlan({
              declarationKind: "property",
              name: "y",
              returnType: intType,
            }),
          ],
        }),
      ],
      topLevelStatements: [],
      types: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain("public struct Point");
      expect(result.code).to.contain("public int x;");
      expect(result.code).to.contain("public int y { get; set; }");
      expect(result.code).not.to.contain(": struct");
    }
  });

  it("renders extension receiver parameters from lowering plan facts", () => {
    const module: CSharpLoweringModulePlan = {
      kind: "lowering-module",
      backendTargetId: "csharp",
      identity: {
        filePath: "/src/index.ts",
        className: "Index",
        namespace: "Example",
      },
      sourceFile: dummySourceFile,
      sourceModule: dummySourceModule,
      imports: [],
      exports: [],
      declarations: [
        declarationPlan({
          declarationKind: "function",
          name: "inc",
          returnType: intType,
          parameters: [
            {
              name: "value",
              type: intType,
              optional: false,
              rest: false,
              extensionReceiver: true,
            },
          ],
          body: statementPlan({
            statementKind: "return",
            expression: expressionPlan({
              expressionKind: "identifier",
              literalText: "value",
              type: intType,
            }),
          }),
        }),
      ],
      topLevelStatements: [],
      types: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain("public static int inc(this int value)");
    }
  });
});
