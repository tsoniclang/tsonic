import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeMethodDeclaration,
  makeMethodMarkerCall,
  makeMethodSignature,
  makePrimitiveType,
  makeReferenceType,
  makeTypedParameter,
  makeUnknownType,
  runOverloadCollectionPass,
  runOverloadFamilyConsistencyPass,
} from "./helpers.js";
import type { IrClassDeclaration, IrInterfaceDeclaration } from "./helpers.js";

describe("Overload Family Consistency Pass", () => {
  it("accepts class real bodies that preserve interface overload public names", () => {
    const module = createModule([
      {
        kind: "interfaceDeclaration",
        name: "IParser",
        isExported: true,
        isStruct: false,
        typeParameters: [],
        extends: [],
        members: [
          makeMethodSignature(
            "Parse",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string")
          ),
          makeMethodSignature(
            "Parse",
            [makeTypedParameter("bytes", makeReferenceType("Uint8Array"))],
            makePrimitiveType("string")
          ),
        ],
      } as unknown as IrInterfaceDeclaration,
      {
        kind: "classDeclaration",
        name: "Parser",
        isExported: true,
        isStruct: false,
        typeParameters: [],
        implements: [{ kind: "referenceType", name: "IParser" }],
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
            "parse_text",
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
      } as unknown as IrClassDeclaration,
      makeMethodMarkerCall("Parser", "parse_text", "Parse"),
      makeMethodMarkerCall("Parser", "parse_bytes", "Parse"),
    ]);

    const collected = runOverloadCollectionPass([module]);
    expect(collected.ok).to.equal(true);

    const consistency = runOverloadFamilyConsistencyPass([
      assertDefined(collected.modules[0]),
    ]);
    expect(consistency.ok).to.equal(true);
  });

  it("rejects class surfaces that change the interface CLR overload family name", () => {
    const module = createModule([
      {
        kind: "interfaceDeclaration",
        name: "IParser",
        isExported: true,
        isStruct: false,
        typeParameters: [],
        extends: [],
        members: [
          makeMethodSignature(
            "Parse",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string")
          ),
        ],
      } as unknown as IrInterfaceDeclaration,
      {
        kind: "classDeclaration",
        name: "Parser",
        isExported: true,
        isStruct: false,
        typeParameters: [],
        implements: [{ kind: "referenceType", name: "IParser" }],
        members: [
          makeMethodDeclaration(
            "Decode",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string"),
            { hasBody: false, accessibility: "public" }
          ),
          makeMethodDeclaration(
            "Decode",
            [makeTypedParameter("_value", makeUnknownType())],
            makeUnknownType(),
            { accessibility: "public" }
          ),
          makeMethodDeclaration(
            "decode_text",
            [makeTypedParameter("text", makePrimitiveType("string"))],
            makePrimitiveType("string"),
            { accessibility: "private" }
          ),
        ],
      } as unknown as IrClassDeclaration,
      makeMethodMarkerCall("Parser", "decode_text", "Decode"),
    ]);

    const collected = runOverloadCollectionPass([module]);
    expect(collected.ok).to.equal(true);

    const consistency = runOverloadFamilyConsistencyPass([
      assertDefined(collected.modules[0]),
    ]);
    expect(consistency.ok).to.equal(false);
    expect(
      consistency.diagnostics.some(
        (diagnostic) => diagnostic.code === "TSN4005"
      )
    ).to.equal(true);
  });
});
