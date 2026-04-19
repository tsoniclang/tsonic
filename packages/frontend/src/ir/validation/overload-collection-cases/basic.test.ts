import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeFunctionDeclaration,
  makeFunctionMarkerCall,
  makeMethodDeclaration,
  makeMethodMarkerCall,
  makePrimitiveType,
  makeReferenceType,
  makeTypedParameter,
  makeUnknownType,
  runOverloadCollectionPass,
} from "./helpers.js";
import type {
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrMethodDeclaration,
} from "./helpers.js";

describe("Overload Collection Pass", () => {
  it("erases top-level overload stubs and retargets real bodies", () => {
    const module = createModule([
      makeFunctionDeclaration(
        "parse",
        [makeTypedParameter("text", makePrimitiveType("string"))],
        makePrimitiveType("string"),
        { isExported: true, isDeclarationOnly: true }
      ),
      makeFunctionDeclaration(
        "parse",
        [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
        makePrimitiveType("string"),
        { isExported: true, isDeclarationOnly: true }
      ),
      makeFunctionDeclaration(
        "parse",
        [makeTypedParameter("_value", makeUnknownType())],
        makeUnknownType(),
        { isExported: true }
      ),
      makeFunctionDeclaration(
        "parse_string",
        [makeTypedParameter("text", makePrimitiveType("string"))],
        makePrimitiveType("string"),
        { isExported: false }
      ),
      makeFunctionDeclaration(
        "parse_bytes",
        [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
        makePrimitiveType("string"),
        { isExported: false }
      ),
      makeFunctionMarkerCall("parse_string", "parse"),
      makeFunctionMarkerCall("parse_bytes", "parse"),
    ]);

    const result = runOverloadCollectionPass([module]);
    expect(result.ok).to.equal(true);

    const output = assertDefined(result.modules[0]);
    const functions = output.body.filter(
      (statement): statement is IrFunctionDeclaration =>
        statement.kind === "functionDeclaration"
    );

    expect(functions.map((statement) => statement.name)).to.deep.equal([
      "parse_string",
      "parse_bytes",
    ]);
    expect(functions.map((statement) => statement.isExported)).to.deep.equal([
      true,
      true,
    ]);
    expect(
      functions.map((statement) => statement.overloadFamily?.publicName)
    ).to.deep.equal(["parse", "parse"]);
    expect(
      functions.map(
        (statement) => statement.overloadFamily?.publicSignatureIndex
      )
    ).to.deep.equal([0, 1]);
  });

  it("erases class overload stubs and retargets real bodies", () => {
    const module = createModule([
      {
        kind: "classDeclaration",
        name: "Parser",
        implements: [],
        members: [
          makeMethodDeclaration(
            "Parse",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string"),
            { hasBody: false, accessibility: "public" }
          ),
          makeMethodDeclaration(
            "Parse",
            [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
            makePrimitiveType("string"),
            { hasBody: false, accessibility: "public" }
          ),
          makeMethodDeclaration(
            "Parse",
            [makeTypedParameter("_value", makeUnknownType())],
            makeUnknownType(),
            { accessibility: "public" }
          ),
          makeMethodDeclaration(
            "parse_string",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string"),
            { accessibility: "private" }
          ),
          makeMethodDeclaration(
            "parse_bytes",
            [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
            makePrimitiveType("string"),
            { accessibility: "private" }
          ),
        ],
        isExported: true,
        isStruct: false,
      } as unknown as IrClassDeclaration,
      makeMethodMarkerCall("Parser", "parse_string", "Parse"),
      makeMethodMarkerCall("Parser", "parse_bytes", "Parse"),
    ]);

    const result = runOverloadCollectionPass([module]);
    expect(result.ok).to.equal(true);

    const output = assertDefined(result.modules[0]);
    const parser = output.body[0] as IrClassDeclaration;
    const methods = parser.members.filter(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration"
    );

    expect(methods.map((member) => member.name)).to.deep.equal([
      "parse_string",
      "parse_bytes",
    ]);
    expect(methods.map((member) => member.accessibility)).to.deep.equal([
      "public",
      "public",
    ]);
    expect(
      methods.map((member) => member.overloadFamily?.publicName)
    ).to.deep.equal(["Parse", "Parse"]);
    expect(
      methods.map((member) => member.overloadFamily?.publicSignatureIndex)
    ).to.deep.equal([0, 1]);
  });

  it("erases static class overload stubs and retargets real bodies", () => {
    const module = createModule([
      {
        kind: "classDeclaration",
        name: "Parser",
        implements: [],
        members: [
          makeMethodDeclaration(
            "Parse",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string"),
            { hasBody: false, accessibility: "public", isStatic: true }
          ),
          makeMethodDeclaration(
            "Parse",
            [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
            makePrimitiveType("string"),
            { hasBody: false, accessibility: "public", isStatic: true }
          ),
          makeMethodDeclaration(
            "Parse",
            [makeTypedParameter("_value", makeUnknownType())],
            makeUnknownType(),
            { accessibility: "public", isStatic: true }
          ),
          makeMethodDeclaration(
            "parse_string",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string"),
            { accessibility: "private", isStatic: true }
          ),
          makeMethodDeclaration(
            "parse_bytes",
            [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
            makePrimitiveType("string"),
            { accessibility: "private", isStatic: true }
          ),
        ],
        isExported: true,
        isStruct: false,
      } as unknown as IrClassDeclaration,
      makeMethodMarkerCall("Parser", "parse_string", "Parse", true),
      makeMethodMarkerCall("Parser", "parse_bytes", "Parse", true),
    ]);

    const result = runOverloadCollectionPass([module]);
    expect(result.ok).to.equal(true);

    const output = assertDefined(result.modules[0]);
    const parser = output.body[0] as IrClassDeclaration;
    const methods = parser.members.filter(
      (member): member is IrMethodDeclaration =>
        member.kind === "methodDeclaration"
    );

    expect(methods.map((member) => member.name)).to.deep.equal([
      "parse_string",
      "parse_bytes",
    ]);
    expect(methods.map((member) => member.isStatic)).to.deep.equal([
      true,
      true,
    ]);
    expect(methods.map((member) => member.accessibility)).to.deep.equal([
      "public",
      "public",
    ]);
    expect(
      methods.map((member) => member.overloadFamily?.publicName)
    ).to.deep.equal(["Parse", "Parse"]);
    expect(
      methods.map((member) => member.overloadFamily?.publicSignatureIndex)
    ).to.deep.equal([0, 1]);
  });
});
