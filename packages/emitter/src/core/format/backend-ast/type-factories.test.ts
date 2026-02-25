import { describe, it } from "mocha";
import { expect } from "chai";
import { typeAstFromText } from "./type-factories.js";
import { printType } from "./printer.js";

describe("Backend AST Type Factories", () => {
  it("parses predefined and identifier types", () => {
    expect(typeAstFromText("int")).to.deep.equal({
      kind: "predefinedType",
      keyword: "int",
    });
    expect(typeAstFromText("UserName")).to.deep.equal({
      kind: "identifierType",
      name: "UserName",
    });
    expect(typeAstFromText("global::System.String")).to.deep.equal({
      kind: "identifierType",
      name: "global::System.String",
    });
  });

  it("parses generic, nullable, and array type forms", () => {
    const typeAst = typeAstFromText(
      "global::System.Collections.Generic.Dictionary<string, int?[]>?"
    );
    expect(printType(typeAst)).to.equal(
      "global::System.Collections.Generic.Dictionary<string, int?[]>?"
    );
  });

  it("parses nested generic arguments deterministically", () => {
    const typeAst = typeAstFromText(
      "global::System.Collections.Generic.Dictionary<string, global::System.Collections.Generic.List<int>>"
    );
    expect(printType(typeAst)).to.equal(
      "global::System.Collections.Generic.Dictionary<string, global::System.Collections.Generic.List<int>>"
    );
  });

  it("parses multidimensional arrays", () => {
    expect(printType(typeAstFromText("int[,]"))).to.equal("int[,]");
    expect(printType(typeAstFromText("long[][]"))).to.equal("long[][]");
  });

  it("falls back to raw for unsupported type text", () => {
    expect(typeAstFromText("int*")).to.deep.equal({
      kind: "rawType",
      text: "int*",
    });
    expect(typeAstFromText("Dictionary<string")).to.deep.equal({
      kind: "rawType",
      text: "Dictionary<string",
    });
  });
});
