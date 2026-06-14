import { describe, it } from "mocha";
import { expect } from "chai";
import type { LoweringTypeRefPlan } from "@tsonic/frontend";
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
});
