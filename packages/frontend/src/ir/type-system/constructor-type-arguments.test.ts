import { expect } from "chai";
import { describe, it } from "mocha";
import {
  getTstsIdentifierText,
  TstsSyntax,
  visitTstsSubtree,
  type TstsNode,
} from "@tsonic/tsts";
import { createTestProgram } from "../builder-cases/_test-helpers.js";

describe("constructor type arguments", () => {
  it("preserves explicit function-type aliases on new expressions", () => {
    const { testProgram, ctx } = createTestProgram(`
      class Box<T> {
        constructor() {}
      }

      type Callback = () => void;
      const box = new Box<Callback>();
    `);

    let boxDeclaration: TstsNode | undefined;
    visitTstsSubtree(testProgram.sourceFiles[0], (node) => {
      if (!TstsSyntax.IsVariableDeclaration(node)) return;
      if (getTstsIdentifierText(TstsSyntax.Node_Name(node)) === "box") {
        boxDeclaration = node;
      }
    });

    expect(boxDeclaration).to.not.equal(undefined);
    if (!boxDeclaration) return;

    const boxName = TstsSyntax.Node_Name(boxDeclaration);
    expect(boxName).to.not.equal(undefined);
    if (!boxName) return;

    const declId = ctx.binding.resolveIdentifier(boxName);
    expect(declId).to.not.equal(undefined);
    if (!declId) return;

    const boxType = ctx.typeSystem.typeOfDecl(declId);
    expect(boxType.kind).to.equal("referenceType");
    if (boxType.kind !== "referenceType") return;

    expect(boxType.name).to.equal("Box");
    expect(boxType.typeArguments).to.deep.equal([
      {
        kind: "functionType",
        parameters: [],
        returnType: { kind: "voidType" },
      },
    ]);
  });
});
