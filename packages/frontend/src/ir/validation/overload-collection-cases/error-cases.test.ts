import {
  createModule,
  describe,
  expect,
  it,
  makeBadSelector,
  makeMethodDeclaration,
  makeMethodMarkerCallWithSelector,
  makePrimitiveType,
  makeTypedParameter,
  makeUnknownType,
  runOverloadCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration } from "./helpers.js";

describe("Overload Collection Pass", () => {
  it("rejects non-member selectors", () => {
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
        ],
        isExported: true,
        isStruct: false,
      } as unknown as IrClassDeclaration,
      makeMethodMarkerCallWithSelector(
        "Parser",
        makeBadSelector("parse_text"),
        "Parse"
      ),
    ]);

    const result = runOverloadCollectionPass([module]);
    expect(result.ok).to.equal(false);
    expect(
      result.diagnostics.some((diagnostic) => diagnostic.code === "TSN4005")
    ).to.equal(true);
  });
});
