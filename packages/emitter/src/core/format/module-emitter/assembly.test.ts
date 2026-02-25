import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrModule } from "@tsonic/frontend";
import { createContext } from "../../../types.js";
import { defaultOptions } from "../options.js";
import { assembleOutput } from "./assembly.js";
import type { AssemblyParts } from "./assembly.js";
import {
  classPreludeMember,
  classDeclaration,
  preludeSection,
} from "../backend-ast/index.js";

const createModule = (namespace: string): IrModule => ({
  kind: "module",
  filePath: "/src/app.ts",
  namespace,
  className: "app",
  isStaticContainer: true,
  imports: [],
  body: [],
  exports: [],
});

describe("Module Assembly", () => {
  it("assembles output through backend AST printer with legacy layout", () => {
    const module = createModule("MyApp");

    const context = createContext(defaultOptions);
    context.usings.add("Zeta.Tools");
    context.usings.add("Alpha.Tools");

    const output = assembleOutput(
      module,
      {
        header: "// Header",
        namespaceMembers: [
          preludeSection("    partial class Adapter\n    {\n    }", 0),
          { kind: "blankLine" },
          preludeSection("    public class User\n    {\n    }", 0),
        ],
        staticContainerMember: classDeclaration("app", {
          modifiers: ["public", "static"],
        }),
      },
      context
    );

    expect(output).to.equal(`// Header
using Alpha.Tools;
using Zeta.Tools;

namespace MyApp
{
    partial class Adapter
    {
    }

    public class User
    {
    }

    public static class app
    {
    }
}`);
  });

  it("matches expected layout across section combinations", () => {
    const scenarios: readonly {
      readonly name: string;
      readonly moduleNamespace: string;
      readonly usings: readonly string[];
      readonly parts: AssemblyParts;
      readonly expected: string;
    }[] = [
      {
        name: "empty body no usings",
        moduleNamespace: "N0",
        usings: [],
        parts: {
          header: "",
          namespaceMembers: [],
        },
        expected: `namespace N0
{
}`,
      },
      {
        name: "header and usings only",
        moduleNamespace: "N1",
        usings: ["B", "A"],
        parts: {
          header: "// H",
          namespaceMembers: [],
        },
        expected: `// H
using A;
using B;

namespace N1
{
}`,
      },
      {
        name: "all prelude sections plus declarations and static container",
        moduleNamespace: "N2",
        usings: ["System.Linq", "System"],
        parts: {
          header: "// H2",
          namespaceMembers: [
            preludeSection("    partial class A\n    {\n    }", 0),
            { kind: "blankLine" },
            preludeSection("    partial class S\n    {\n    }", 0),
            { kind: "blankLine" },
            preludeSection("    partial class E\n    {\n    }", 0),
            { kind: "blankLine" },
            preludeSection("    public class C\n    {\n    }", 0),
          ],
          staticContainerMember: classDeclaration("M", {
            modifiers: ["public", "static"],
          }),
        },
        expected: `// H2
using System;
using System.Linq;

namespace N2
{
    partial class A
    {
    }

    partial class S
    {
    }

    partial class E
    {
    }

    public class C
    {
    }

    public static class M
    {
    }
}`,
      },
      {
        name: "static container without namespace declarations",
        moduleNamespace: "N3",
        usings: [],
        parts: {
          header: "",
          namespaceMembers: [],
          staticContainerMember: classDeclaration("Only", {
            modifiers: ["public", "static"],
          }),
        },
        expected: `namespace N3
{
    public static class Only
    {
    }
}`,
      },
      {
        name: "namespace declarations without static container",
        moduleNamespace: "N4",
        usings: [],
        parts: {
          header: "",
          namespaceMembers: [
            preludeSection("    public interface I\n    {\n    }", 0),
          ],
        },
        expected: `namespace N4
{
    public interface I
    {
    }
}`,
      },
      {
        name: "prelude sections preserve blank separators",
        moduleNamespace: "N5",
        usings: [],
        parts: {
          header: "",
          namespaceMembers: [
            preludeSection("    partial class A {}", 0),
            { kind: "blankLine" },
            preludeSection("    partial class B {}", 0),
            { kind: "blankLine" },
            preludeSection("    partial class C {}", 0),
          ],
        },
        expected: `namespace N5
{
    partial class A {}

    partial class B {}

    partial class C {}
}`,
      },
      {
        name: "class member raw body preserves current indentation",
        moduleNamespace: "N6",
        usings: [],
        parts: {
          header: "",
          namespaceMembers: [],
          staticContainerMember: classDeclaration("App", {
            modifiers: ["public", "static"],
            members: [
              classPreludeMember("        public static int x = 1;", 0),
              { kind: "blankLine" },
              classPreludeMember("        public static int y = 2;", 0),
            ],
          }),
        },
        expected: `namespace N6
{
    public static class App
    {
        public static int x = 1;

        public static int y = 2;
    }
}`,
      },
    ];

    for (const scenario of scenarios) {
      const module = createModule(scenario.moduleNamespace);
      const context = createContext(defaultOptions);
      for (const namespace of scenario.usings) {
        context.usings.add(namespace);
      }

      const actual = assembleOutput(module, scenario.parts, context);
      expect(actual, scenario.name).to.equal(scenario.expected);
    }
  });
});
