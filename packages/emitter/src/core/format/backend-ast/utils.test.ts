import { describe, it } from "mocha";
import { expect } from "chai";
import type { CSharpTypeAst } from "./types.js";
import { identifierType } from "./builders.js";
import {
  CSHARP_PREDEFINED_TYPE_KEYWORDS,
  clrTypeNameToTypeAst,
  extractCalleeNameFromAst,
  getIdentifierTypeLeafName,
  getIdentifierTypeName,
  globallyQualifyTypeAst,
  stableIdentifierSuffixFromTypeAst,
  stableTypeKeyFromAst,
  stripNullableTypeAst,
} from "./utils.js";

describe("backend-ast utils", () => {
  it("maps all supported predefined CLR keyword names to predefinedType AST nodes", () => {
    const expectedKeywords = [
      "bool",
      "byte",
      "sbyte",
      "short",
      "ushort",
      "int",
      "uint",
      "long",
      "ulong",
      "nint",
      "nuint",
      "float",
      "double",
      "decimal",
      "char",
      "string",
      "object",
      "void",
    ];

    expect(Array.from(CSHARP_PREDEFINED_TYPE_KEYWORDS).sort()).to.deep.equal(
      [...expectedKeywords].sort()
    );

    for (const keyword of expectedKeywords) {
      expect(clrTypeNameToTypeAst(keyword)).to.deep.equal({
        kind: "predefinedType",
        keyword,
      });
      expect(clrTypeNameToTypeAst(`global::${keyword}`)).to.deep.equal({
        kind: "predefinedType",
        keyword,
      });
    }
  });

  it("normalizes CLR generic arity/backing names into structured identifier AST nodes", () => {
    expect(
      clrTypeNameToTypeAst("System.Collections.Generic.List`1")
    ).to.deep.equal(identifierType("System.Collections.Generic.List"));

    expect(clrTypeNameToTypeAst("global::Outer+Inner`2")).to.deep.equal(
      identifierType("global::Outer.Inner")
    );

    expect(clrTypeNameToTypeAst("global::System.Int128")).to.deep.equal(
      identifierType("global::System.Int128")
    );

    expect(clrTypeNameToTypeAst("System.Half")).to.deep.equal(
      identifierType("System.Half")
    );
  });

  it("globally qualifies nested type ASTs structurally without text rendering", () => {
    const type: CSharpTypeAst = {
      kind: "nullableType",
      underlyingType: identifierType("System.Collections.Generic.List", [
        {
          kind: "arrayType",
          elementType: identifierType("MyNamespace.Widget"),
          rank: 1,
        },
      ]),
    };

    expect(
      JSON.parse(JSON.stringify(globallyQualifyTypeAst(type)))
    ).to.deep.equal({
      kind: "nullableType",
      underlyingType: identifierType(
        "global::System.Collections.Generic.List",
        [
          {
            kind: "arrayType",
            elementType: identifierType("global::MyNamespace.Widget"),
            rank: 1,
          },
        ]
      ),
    });
  });

  it("preserves predefined and var types when globally qualifying", () => {
    expect(
      globallyQualifyTypeAst({ kind: "predefinedType", keyword: "int" })
    ).to.deep.equal({ kind: "predefinedType", keyword: "int" });
    expect(globallyQualifyTypeAst({ kind: "varType" })).to.deep.equal({
      kind: "varType",
    });
  });

  it("strips nullable wrappers structurally", () => {
    const underlying: CSharpTypeAst = identifierType("global::System.DateTime");
    expect(
      stripNullableTypeAst({
        kind: "nullableType",
        underlyingType: underlying,
      })
    ).to.equal(underlying);
    expect(stripNullableTypeAst(underlying)).to.equal(underlying);
  });

  it("collapses nested nullable wrappers structurally", () => {
    const underlying: CSharpTypeAst = identifierType("global::System.String");
    expect(
      stripNullableTypeAst({
        kind: "nullableType",
        underlyingType: {
          kind: "nullableType",
          underlyingType: underlying,
        },
      })
    ).to.equal(underlying);

    expect(
      stableTypeKeyFromAst({
        kind: "nullableType",
        underlyingType: {
          kind: "nullableType",
          underlyingType: underlying,
        },
      })
    ).to.equal("nullable:qualifiedIdentifier:global::System.String");
  });

  it("extracts identifier type names structurally for simple, qualified, and nullable nodes", () => {
    expect(getIdentifierTypeName(identifierType("Widget"))).to.equal("Widget");
    expect(getIdentifierTypeLeafName(identifierType("Widget"))).to.equal(
      "Widget"
    );

    const qualified = identifierType("global::My.Namespace.Widget");
    expect(getIdentifierTypeName(qualified)).to.equal(
      "global::My.Namespace.Widget"
    );
    expect(getIdentifierTypeLeafName(qualified)).to.equal("Widget");

    const nullable: CSharpTypeAst = {
      kind: "nullableType",
      underlyingType: qualified,
    };
    expect(getIdentifierTypeName(nullable)).to.equal(
      "global::My.Namespace.Widget"
    );
    expect(getIdentifierTypeLeafName(nullable)).to.equal("Widget");
    expect(
      getIdentifierTypeName({ kind: "predefinedType", keyword: "int" })
    ).to.equal(undefined);
    expect(
      getIdentifierTypeLeafName({ kind: "predefinedType", keyword: "int" })
    ).to.equal(undefined);
  });

  it("extracts callee names structurally from type reference expressions", () => {
    expect(
      extractCalleeNameFromAst({
        kind: "typeReferenceExpression",
        type: { kind: "predefinedType", keyword: "int" },
      })
    ).to.equal("int");

    expect(
      extractCalleeNameFromAst({
        kind: "typeReferenceExpression",
        type: identifierType("global::System.Collections.Generic.List", [
          { kind: "predefinedType", keyword: "string" },
        ]),
      })
    ).to.equal("global::System.Collections.Generic.List");

    expect(
      extractCalleeNameFromAst({
        kind: "typeReferenceExpression",
        type: {
          kind: "nullableType",
          underlyingType: identifierType("global::System.DateTime"),
        },
      })
    ).to.equal("global::System.DateTime?");
  });

  it("unwraps cast-like expression wrappers when extracting callee names", () => {
    const base = {
      kind: "identifierExpression" as const,
      identifier: "handler",
    };

    expect(
      extractCalleeNameFromAst({
        kind: "castExpression",
        type: identifierType("global::System.Object"),
        expression: base,
      })
    ).to.equal("handler");

    expect(
      extractCalleeNameFromAst({
        kind: "asExpression",
        type: identifierType("global::System.Object"),
        expression: base,
      })
    ).to.equal("handler");

    expect(
      extractCalleeNameFromAst({
        kind: "awaitExpression",
        expression: base,
      })
    ).to.equal("handler");

    expect(
      extractCalleeNameFromAst({
        kind: "suppressNullableWarningExpression",
        expression: base,
      })
    ).to.equal("handler");
  });

  it("builds stable structural type keys for arrays, tuples, pointers, and generics", () => {
    expect(
      stableTypeKeyFromAst({
        kind: "arrayType",
        elementType: identifierType("global::System.String"),
        rank: 2,
      })
    ).to.equal("array:2:qualifiedIdentifier:global::System.String");

    expect(
      stableTypeKeyFromAst({
        kind: "tupleType",
        elements: [
          { type: { kind: "predefinedType", keyword: "int" }, name: "count" },
          { type: { kind: "predefinedType", keyword: "string" } },
        ],
      })
    ).to.equal("tuple:predefined:int:count|predefined:string");

    expect(
      stableTypeKeyFromAst({
        kind: "pointerType",
        elementType: { kind: "predefinedType", keyword: "byte" },
      })
    ).to.equal("pointer:predefined:byte");
  });

  it("builds stable identifier suffixes for nested generic shapes", () => {
    expect(
      stableIdentifierSuffixFromTypeAst(
        identifierType("global::System.Collections.Generic.Dictionary", [
          { kind: "predefinedType", keyword: "string" },
          identifierType("global::System.Collections.Generic.List", [
            { kind: "predefinedType", keyword: "int" },
          ]),
        ])
      )
    ).to.equal(
      "global__System_Collections_Generic_Dictionary__string__global__System_Collections_Generic_List__int"
    );
  });
});
