import { describe, it } from "mocha";
import { expect } from "chai";
import type {
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
} from "@tsonic/frontend";
import type { CSharpLoweringModulePlan } from "../types.js";
import { emitJsonContextModule, emitModule } from "./module.js";

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

const stringType: LoweringTypeRefPlan = {
  kind: "intrinsic",
  name: "string",
};

const promiseType = (
  typeArguments: readonly LoweringTypeRefPlan[],
  sourceText = "Promise"
): LoweringTypeRefPlan => ({
  kind: "named",
  name: "Promise",
  sourceText,
  sourceQualifiedName: { namespace: "js._", name: "Promise" },
  typeArguments,
});

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
  attributes: [],
  constructorAttributes: [],
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

const attributeTypeExpression = (
  namespace: string,
  name: string
): LoweringExpressionPlan =>
  expressionPlan({
    expressionKind: "identifier",
    literalText: name,
    sourceQualifiedName: { namespace, name },
  });

const stringLiteralExpression = (value: string): LoweringExpressionPlan =>
  expressionPlan({
    expressionKind: "literal",
    literalKind: "string",
    literalText: value,
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
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.match(
        /public sealed class __TsonicShape_[a-f0-9]+/u
      );
      expect(result.code).to.contain("public string value");
      expect(result.code).to.contain(
        "get => this.__tsonic_get_value != null"
      );
      expect(result.code).to.contain("this.__tsonic_property_value = value;");
      expect(result.code).to.contain("public static Alias item = default!;");
    }
  });

  it("emits top-level variables as fields assigned in source-order top-level code", () => {
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
        statementPlan({
          statementKind: "variable",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "city",
              type: stringType,
              initializer: expressionPlan({
                expressionKind: "literal",
                literalKind: "string",
                literalText: "Paris",
                type: stringType,
              }),
              bindingElements: [],
            },
          ],
        }),
        statementPlan({
          statementKind: "variable",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "alias",
              type: stringType,
              initializer: expressionPlan({
                expressionKind: "identifier",
                name: "city",
                literalText: "city",
                type: stringType,
              }),
              bindingElements: [],
            },
          ],
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain("public static string city = default!;");
      expect(result.code).to.contain("public static string alias = default!;");
      expect(result.code).to.contain("public static void __TopLevel()");
      expect(result.code).to.contain('city = "Paris";');
      expect(result.code).to.contain("alias = city;");
      expect(result.code).not.to.contain(
        'public static string city = "Paris";'
      );
    }
  });

  it("does not collect structural helper types for nominal class object shapes", () => {
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
        statementPlan({
          statementKind: "variable",
          sourceText: "const app: Application",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "app",
              type: {
                kind: "named",
                name: "Application",
                declarationKind: "class",
                typeArguments: [],
                aliasTarget: {
                  kind: "object",
                  members: [
                    {
                      kind: "property",
                      name: "router",
                      optional: false,
                    },
                  ],
                },
              },
              bindingElements: [],
            },
          ],
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).not.to.match(
        /public sealed class __TsonicShape_[a-f0-9]+/u
      );
      expect(result.code).to.contain("public static Application app = default!;");
    }
  });

  it("does not collect structural helper types for incomplete object shapes", () => {
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
        statementPlan({
          statementKind: "variable",
          sourceText: "const tupleLike: TupleLike",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "tupleLike",
              type: {
                kind: "named",
                name: "TupleLike",
                typeArguments: [],
                aliasTarget: {
                  kind: "object",
                  members: [
                    {
                      kind: "property",
                      name: "0",
                      optional: false,
                    },
                    {
                      kind: "property",
                      name: "1",
                      optional: false,
                    },
                    {
                      kind: "property",
                      name: "length",
                      optional: false,
                    },
                  ],
                },
              },
              bindingElements: [],
            },
          ],
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).not.to.match(
        /public sealed class __TsonicShape_[a-f0-9]+/u
      );
      expect(result.code).to.contain("public static TupleLike tupleLike = default!;");
    }
  });

  it("does not collect structural helper types from compile-time-only aliases", () => {
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
          declarationKind: "type-alias",
          name: "ShapeAlias",
          typeAliasTarget: structuralTarget,
          compileTimeOnly: true,
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).not.to.match(
        /public sealed class __TsonicShape_[a-f0-9]+/u
      );
      expect(result.code).not.to.contain("ShapeAlias");
    }
  });

  it("renders declared function type aliases through their delegate type", () => {
    const callbackTarget: LoweringTypeRefPlan = {
      kind: "function",
      typeParameters: [],
      parameters: [
        {
          name: "value",
          sourceKindName: "Parameter",
          sourceText: "value: string",
          type: stringType,
          optional: false,
          rest: false,
        },
      ],
      returnType: { kind: "intrinsic", name: "void" },
    };
    const callbackAlias: LoweringTypeRefPlan = {
      kind: "named",
      name: "ParamHandler",
      typeArguments: [],
      declarationKind: "type-alias",
      sourceQualifiedName: { namespace: "Example", name: "ParamHandler" },
      aliasTarget: callbackTarget,
    };
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
          declarationKind: "type-alias",
          name: "ParamHandler",
          typeAliasTarget: callbackTarget,
        }),
        declarationPlan({
          declarationKind: "class",
          name: "Router",
          members: [
            declarationPlan({
              declarationKind: "method",
              name: "param",
              returnType: { kind: "named", name: "Router", typeArguments: [] },
              parameters: [
                {
                  name: "callback",
                  sourceKindName: "Parameter",
                  sourceText: "callback: ParamHandler",
                  optional: false,
                  rest: false,
                  type: callbackAlias,
                },
              ],
              body: statementPlan({ statementKind: "block", statements: [] }),
            }),
          ],
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain(
        "public delegate void ParamHandler(string value);"
      );
      expect(result.code).to.contain(
        "public virtual Router param(global::Example.ParamHandler callback)"
      );
      expect(result.code).not.to.contain("Tsonic.Generated.Structural");
    }
  });

  it("does not collect structural receiver types for source-runtime static calls", () => {
    const runtimeObjectType: LoweringTypeRefPlan = {
      kind: "object",
      members: [
        {
          kind: "method",
          name: "parse",
          optional: false,
          parameters: [
            {
              name: "text",
              sourceKindName: "Parameter",
              sourceText: "text",
              type: stringType,
              optional: false,
              rest: false,
            },
          ],
          returnType: {
            kind: "named",
            name: "T",
            typeArguments: [],
            declarationKind: "type-parameter",
          },
          typeParameters: ["T"],
        },
      ],
    };
    const mathReceiver = expressionPlan({
      expressionKind: "identifier",
      literalText: "Math",
      type: runtimeObjectType,
    });
    const roundAccess = expressionPlan({
      expressionKind: "property-access",
      literalText: "round",
      expression: mathReceiver,
      receiverTypePlan: runtimeObjectType,
      sourceOperation: {
        owner: "Math",
        member: "round",
        dispatch: "static-call",
      },
    });
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
        statementPlan({
          statementKind: "expression",
          expression: expressionPlan({
            expressionKind: "call",
            expression: roundAccess,
            arguments: [
              expressionPlan({
                expressionKind: "literal",
                literalKind: "number",
                literalText: "1.2",
                type: {
                  kind: "intrinsic",
                  name: "number",
                },
              }),
            ],
          }),
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).not.to.match(
        /public sealed class __TsonicShape_[a-f0-9]+/u
      );
      expect(result.code).to.contain("global::js.Math.round(1.2);");
    }
  });

  it("renders record type plans as dictionary storage without named Record checks", () => {
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
        statementPlan({
          statementKind: "variable",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "table",
              type: {
                kind: "record",
                keyType: stringType,
                valueType: intType,
              },
              bindingElements: [],
            },
          ],
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain(
        "public static global::System.Collections.Generic.Dictionary<string, int> table = default!;"
      );
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
              fieldSemantics: "field",
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
              sourceKindName: "Parameter",
              sourceText: "value",
              nameSourceText: "value",
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
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain("public static int inc(this int value)");
    }
  });

  it("reports malformed async return plans instead of inventing awaited types", () => {
    const missingAwaitedTypeModule: CSharpLoweringModulePlan = {
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
          name: "load",
          async: true,
          returnType: promiseType([]),
          body: statementPlan({ statementKind: "block", statements: [] }),
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const unionAwaitedTypeModule: CSharpLoweringModulePlan = {
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
          name: "maybeLoad",
          async: true,
          returnType: {
            kind: "union",
            sourceText: "Promise<int> | unknown",
            types: [
              promiseType([intType], "Promise<int>"),
              { kind: "intrinsic", name: "unknown" },
            ],
          },
          body: statementPlan({ statementKind: "block", statements: [] }),
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const missingAwaitedType = emitModule(missingAwaitedTypeModule);
    const unionAwaitedType = emitModule(unionAwaitedTypeModule);

    expect(missingAwaitedType.ok).to.equal(false);
    if (!missingAwaitedType.ok) {
      expect(
        missingAwaitedType.errors.map((error) => error.message)
      ).to.include(
        "C# lowering does not yet support async return awaited type 'TypeReference'."
      );
    }

    expect(unionAwaitedType.ok).to.equal(false);
    if (!unionAwaitedType.ok) {
      expect(unionAwaitedType.errors.map((error) => error.message)).to.include(
        "C# lowering does not yet support async union return type 'UnionType'."
      );
    }
  });

  it("reports missing function return types instead of inventing void", () => {
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
          name: "missingReturn",
          body: statementPlan({ statementKind: "block", statements: [] }),
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.message)).to.include(
        "C# lowering does not yet support function return type 'Declaration'."
      );
    }
  });

  it("reports named intersection alias targets instead of emitting broad object placeholders", () => {
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
        statementPlan({
          statementKind: "variable",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "branded",
              type: {
                kind: "named",
                name: "Branded",
                typeArguments: [],
                aliasTarget: {
                  kind: "intersection",
                  sourceText: "string & Brand",
                  types: [stringType, { kind: "object", members: [] }],
                },
              },
              bindingElements: [],
            },
          ],
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(false);
    if (!result.ok) {
      expect(result.errors.map((error) => error.message)).to.include(
        "C# lowering does not yet support intersection type alias target 'IntersectionType'."
      );
    }
  });

  it("renders opaque aliases without requiring structural alias targets", () => {
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
          name: "use",
          returnType: { kind: "intrinsic", name: "void" },
          parameters: [
            {
              name: "value",
              sourceKindName: "Parameter",
              sourceText: "value: JsValue",
              optional: false,
              rest: false,
              type: {
                kind: "named",
                name: "JsValue",
                typeArguments: [],
                declarationKind: "type-alias",
                runtimeVisibility: "opaque",
                sourceText: "JsValue",
              },
            },
          ],
          body: statementPlan({ statementKind: "block", statements: [] }),
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.include("public static void use(object? value)");
    }
  });

  it("renders external intersections through concrete targets and ignores helper views", () => {
    const taskInstance: LoweringTypeRefPlan = {
      kind: "named",
      name: "Task$instance",
      typeArguments: [],
      declarationKind: "interface",
      externalBinding: {
        bindingFile: "/bindings/System.Threading.Tasks/bindings.json",
        sourceName: "Task$instance",
      },
    };
    const taskViews: LoweringTypeRefPlan = {
      kind: "named",
      name: "__Task$views",
      typeArguments: [],
      declarationKind: "interface",
      externalBinding: {
        bindingFile: "/bindings/System.Threading.Tasks/bindings.json",
        sourceName: "__Task$views",
      },
    };
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
        statementPlan({
          statementKind: "variable",
          declarations: [
            {
              sourceNode: dummySourceNode,
              name: "task",
              type: {
                kind: "intersection",
                types: [
                  taskInstance,
                  taskViews,
                  {
                    kind: "object",
                    members: [
                      {
                        kind: "method",
                        name: "then",
                        optional: false,
                        parameters: [],
                        typeParameters: [],
                      },
                    ],
                  },
                ],
              },
              bindingElements: [],
            },
          ],
        }),
      ],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module, {
      externalBindingMetadata: {
        diagnostics: [],
        resolveOverrideAccessibility: () => undefined,
        resolveTargetName: (binding) =>
          binding.sourceName === "Task$instance"
            ? "System.Threading.Tasks.Task"
            : undefined,
      },
    });

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.include(
        "public static global::System.Threading.Tasks.Task task = default!;"
      );
    }
  });

  it("erases nullable annotations from JSON source-generator type tokens", () => {
    const result = emitJsonContextModule("Example.Json", [
      {
        kind: "named",
        name: "JsValue",
        typeArguments: [],
        declarationKind: "type-alias",
        runtimeVisibility: "opaque",
        sourceText: "JsValue",
      },
    ]);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.include(
        "[global::System.Text.Json.Serialization.JsonSerializable(typeof(object))]"
      );
      expect(result.code).not.to.include("typeof(object?)");
    }
  });

  it("renders attributes from lowering plan facts", () => {
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
          declarationKind: "class",
          name: "User",
          attributes: [
            {
              targetSpecifier: undefined,
              attributeType: attributeTypeExpression(
                "System",
                "SerializableAttribute"
              ),
              arguments: [],
            },
          ],
          constructorAttributes: [
            {
              targetSpecifier: undefined,
              attributeType: attributeTypeExpression(
                "System",
                "ObsoleteAttribute"
              ),
              arguments: [stringLiteralExpression("implicit")],
            },
          ],
          members: [
            declarationPlan({
              declarationKind: "property",
              name: "name",
              returnType: { kind: "intrinsic", name: "string" },
              attributes: [
                {
                  targetSpecifier: "field",
                  attributeType: attributeTypeExpression(
                    "System",
                    "NonSerializedAttribute"
                  ),
                  arguments: [],
                },
              ],
            }),
            declarationPlan({
              declarationKind: "method",
              name: "save",
              returnType: { kind: "intrinsic", name: "string" },
              attributes: [
                {
                  targetSpecifier: "return",
                  attributeType: attributeTypeExpression(
                    "System",
                    "ObsoleteAttribute"
                  ),
                  arguments: [stringLiteralExpression("method")],
                },
              ],
              body: statementPlan({
                statementKind: "return",
                expression: stringLiteralExpression("ok"),
              }),
            }),
          ],
        }),
      ],
      topLevelStatements: [],
      statements: [],
      expressions: [],
    };

    const result = emitModule(module);

    expect(result.ok).to.equal(true);
    if (result.ok) {
      expect(result.code).to.contain("[global::System.SerializableAttribute]");
      expect(result.code).to.contain(
        "[field: global::System.NonSerializedAttribute]"
      );
      expect(result.code).to.contain(
        '[return: global::System.ObsoleteAttribute("method")]'
      );
      expect(result.code).to.contain(
        '[global::System.ObsoleteAttribute("implicit")]'
      );
    }
  });
});
