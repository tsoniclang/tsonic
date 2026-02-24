import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrModule } from "@tsonic/frontend";
import { createContext } from "../../../types.js";
import { defaultOptions } from "../options.js";
import { assembleOutput } from "./assembly.js";
import type { AssemblyParts } from "./assembly.js";

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

const assembleOutputLegacy = (
  module: IrModule,
  parts: AssemblyParts,
  usingsInput: readonly string[]
): string => {
  const usingLines =
    usingsInput.length > 0
      ? [...usingsInput]
          .sort()
          .map((namespace) => `using ${namespace};`)
          .concat("")
      : [];
  const preludeSections = [
    parts.adaptersCode,
    parts.specializationsCode,
    parts.exchangesCode,
  ]
    .filter((text) => text.length > 0)
    .flatMap((text) => [
      text
        .split("\n")
        .map((line) => (line ? "    " + line : line))
        .join("\n"),
      "",
    ]);
  const declarationLines = parts.namespaceDeclsCode ? [parts.namespaceDeclsCode] : [];
  const staticContainerLines = parts.staticContainerCode
    ? [
        ...(parts.namespaceDeclsCode ? [""] : []),
        parts.staticContainerCode,
      ]
    : [];

  return [
    ...(parts.header ? [parts.header] : []),
    ...usingLines,
    `namespace ${module.namespace}`,
    "{",
    ...preludeSections,
    ...declarationLines,
    ...staticContainerLines,
    "}",
  ].join("\n");
};

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
        adaptersCode: "partial class Adapter\n{\n}",
        specializationsCode: "",
        exchangesCode: "",
        namespaceDeclsCode: "    public class User\n    {\n    }",
        staticContainerCode: "    public static class app\n    {\n    }",
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

  it("matches legacy string assembler across section combinations", () => {
    const scenarios: readonly {
      readonly name: string;
      readonly moduleNamespace: string;
      readonly usings: readonly string[];
      readonly parts: AssemblyParts;
    }[] = [
      {
        name: "empty body no usings",
        moduleNamespace: "N0",
        usings: [],
        parts: {
          header: "",
          adaptersCode: "",
          specializationsCode: "",
          exchangesCode: "",
          namespaceDeclsCode: "",
          staticContainerCode: "",
        },
      },
      {
        name: "header and usings only",
        moduleNamespace: "N1",
        usings: ["B", "A"],
        parts: {
          header: "// H",
          adaptersCode: "",
          specializationsCode: "",
          exchangesCode: "",
          namespaceDeclsCode: "",
          staticContainerCode: "",
        },
      },
      {
        name: "all prelude sections plus declarations and static container",
        moduleNamespace: "N2",
        usings: ["System.Linq", "System"],
        parts: {
          header: "// H2",
          adaptersCode: "partial class A\n{\n}",
          specializationsCode: "partial class S\n{\n}",
          exchangesCode: "partial class E\n{\n}",
          namespaceDeclsCode: "    public class C\n    {\n    }",
          staticContainerCode: "    public static class M\n    {\n    }",
        },
      },
      {
        name: "static container without namespace declarations",
        moduleNamespace: "N3",
        usings: [],
        parts: {
          header: "",
          adaptersCode: "",
          specializationsCode: "",
          exchangesCode: "",
          namespaceDeclsCode: "",
          staticContainerCode: "    public static class Only\n    {\n    }",
        },
      },
      {
        name: "namespace declarations without static container",
        moduleNamespace: "N4",
        usings: [],
        parts: {
          header: "",
          adaptersCode: "",
          specializationsCode: "",
          exchangesCode: "",
          namespaceDeclsCode: "    public interface I\n    {\n    }",
          staticContainerCode: "",
        },
      },
      {
        name: "prelude sections preserve blank separators",
        moduleNamespace: "N5",
        usings: [],
        parts: {
          header: "",
          adaptersCode: "partial class A {}",
          specializationsCode: "partial class B {}",
          exchangesCode: "partial class C {}",
          namespaceDeclsCode: "",
          staticContainerCode: "",
        },
      },
    ];

    for (const scenario of scenarios) {
      const module = createModule(scenario.moduleNamespace);
      const context = createContext(defaultOptions);
      for (const namespace of scenario.usings) {
        context.usings.add(namespace);
      }

      const actual = assembleOutput(module, scenario.parts, context);
      const expected = assembleOutputLegacy(
        module,
        scenario.parts,
        scenario.usings
      );

      expect(actual, scenario.name).to.equal(expected);
    }
  });
});
