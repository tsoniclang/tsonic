import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildCompilationUnitAstFromAssembly,
  classDeclaration,
  printCompilationUnitAst,
  printStatement,
  printType,
} from "./index.js";

describe("Backend AST Printer", () => {
  it("prints deterministic sorted usings and module sections", () => {
    const unit = buildCompilationUnitAstFromAssembly({
      headerText: "// Header",
      usingNamespaces: ["Zeta.Tools", "Alpha.Tools"],
      namespaceName: "MyApp",
      namespaceMembers: [
        classDeclaration("Adapter", { modifiers: ["partial"] }),
        { kind: "blankLine" },
        classDeclaration("Spec", { modifiers: ["partial"] }),
        { kind: "blankLine" },
        classDeclaration("Exchange", { modifiers: ["partial"] }),
        { kind: "blankLine" },
        classDeclaration("User", { modifiers: ["public"] }),
      ],
      staticContainerMember: classDeclaration("App", {
        modifiers: ["public", "static"],
      }),
    });

    const code = printCompilationUnitAst(unit);

    expect(code).to.equal(`// Header
using Alpha.Tools;
using Zeta.Tools;

namespace MyApp
{
    partial class Adapter
    {
    }

    partial class Spec
    {
    }

    partial class Exchange
    {
    }

    public class User
    {
    }

    public static class App
    {
    }
}`);
  });

  it("preserves legacy trailing spacer after indented prelude sections", () => {
    const unit = buildCompilationUnitAstFromAssembly({
      headerText: "",
      usingNamespaces: [],
      namespaceName: "PreludeOnly",
      namespaceMembers: [
        classDeclaration("Adapter", { modifiers: ["partial"] }),
      ],
    });

    const code = printCompilationUnitAst(unit);

    expect(code).to.equal(`namespace PreludeOnly
{
    partial class Adapter
    {
    }
}`);
  });

  it("escapes C# keywords in qualified namespace and using names", () => {
    const unit = buildCompilationUnitAstFromAssembly({
      headerText: "",
      usingNamespaces: ["System.stackalloc", "global.using"],
      namespaceName: "TestCases.common.lang.stackalloc",
      namespaceMembers: [classDeclaration("X", { modifiers: ["public"] })],
    });

    const code = printCompilationUnitAst(unit);

    expect(code).to.equal(`using global.@using;
using System.@stackalloc;

namespace TestCases.common.lang.@stackalloc
{
    public class X
    {
    }
}`);
  });

  it("indents single-line embedded control-flow statements", () => {
    const code = printStatement(
      {
        kind: "ifStatement",
        condition: { kind: "identifierExpression", identifier: "ready" },
        thenStatement: {
          kind: "returnStatement",
          expression: { kind: "literalExpression", text: "1" },
        },
        elseStatement: {
          kind: "whileStatement",
          condition: { kind: "identifierExpression", identifier: "retry" },
          statement: { kind: "continueStatement" },
        },
      },
      0
    );

    expect(code).to.equal(`if (ready)
    return 1;
else
    while (retry)
        continue;`);
  });

  it("keeps else-if chains aligned without extra indentation", () => {
    const code = printStatement(
      {
        kind: "ifStatement",
        condition: { kind: "identifierExpression", identifier: "first" },
        thenStatement: { kind: "breakStatement" },
        elseStatement: {
          kind: "ifStatement",
          condition: { kind: "identifierExpression", identifier: "second" },
          thenStatement: { kind: "continueStatement" },
        },
      },
      1
    );

    expect(code).to.equal(`    if (first)
        break;
    else
    if (second)
        continue;`);
  });

  it("escapes C# keywords in qualified type identifiers", () => {
    const code = printType({
      kind: "identifierType",
      name: "global::TestCases.common.stackalloc.Type",
      typeArguments: [
        {
          kind: "identifierType",
          name: "System.Collections.Generic.@using",
        },
      ],
    });

    expect(code).to.equal(
      "global::TestCases.common.@stackalloc.Type<System.Collections.Generic.@using>"
    );
  });
});
