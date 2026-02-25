import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrModule } from "@tsonic/frontend";
import { createContext } from "../../../types.js";
import { defaultOptions } from "../options.js";
import { assembleOutput } from "./assembly.js";
import type { AssemblyParts } from "./assembly.js";
import { methodDeclaration, classDeclaration } from "../backend-ast/index.js";

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
          classDeclaration("Adapter", { modifiers: ["partial"] }),
          { kind: "blankLine" },
          classDeclaration("User", { modifiers: ["public"] }),
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
            classDeclaration("A", { modifiers: ["partial"] }),
            { kind: "blankLine" },
            classDeclaration("S", { modifiers: ["partial"] }),
            { kind: "blankLine" },
            classDeclaration("E", { modifiers: ["partial"] }),
            { kind: "blankLine" },
            classDeclaration("C", { modifiers: ["public"] }),
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
            {
              kind: "interfaceDeclaration",
              indentLevel: 1,
              attributes: [],
              modifiers: ["public"],
              name: "I",
              members: [],
            },
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
            classDeclaration("A", { modifiers: ["partial"] }),
            { kind: "blankLine" },
            classDeclaration("B", { modifiers: ["partial"] }),
            { kind: "blankLine" },
            classDeclaration("C", { modifiers: ["partial"] }),
          ],
        },
        expected: `namespace N5
{
    partial class A
    {
    }

    partial class B
    {
    }

    partial class C
    {
    }
}`,
      },
      {
        name: "class member statements stay structured in AST",
        moduleNamespace: "N6",
        usings: [],
        parts: {
          header: "",
          namespaceMembers: [],
          staticContainerMember: classDeclaration("App", {
            modifiers: ["public", "static"],
            members: [
              methodDeclaration("Ping", { modifiers: ["public", "static"] }, [
                { kind: "returnStatement" },
              ]),
            ],
          }),
        },
        expected: `namespace N6
{
    public static class App
    {
        public static void Ping()
        {
            return;
        }
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
