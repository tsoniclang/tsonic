import { describe, it } from "mocha";
import { expect } from "chai";
import {
  buildCompilationUnitAstFromAssembly,
  classDeclaration,
  preludeSection,
  printCompilationUnitAst,
} from "./index.js";

describe("Backend AST Printer", () => {
  it("prints deterministic sorted usings and module sections", () => {
    const unit = buildCompilationUnitAstFromAssembly({
      headerText: "// Header",
      usingNamespaces: ["Zeta.Tools", "Alpha.Tools"],
      namespaceName: "MyApp",
      adaptersCode: "partial class Adapter\n{\n}",
      specializationsCode: "partial class Spec\n{\n}",
      exchangesCode: "partial class Exchange\n{\n}",
      namespaceDeclMembers: [
        preludeSection("    public class User\n    {\n    }", 0),
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
      adaptersCode: "partial class Adapter {}",
      specializationsCode: "",
      exchangesCode: "",
      namespaceDeclMembers: [],
    });

    const code = printCompilationUnitAst(unit);

    expect(code).to.equal(`namespace PreludeOnly
{
    partial class Adapter {}

}`);
  });
});
