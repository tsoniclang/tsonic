import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import { discoverAndLoadClrBindings } from "./clr-bindings-discovery.js";
import { BindingRegistry } from "./bindings.js";
import { DotnetMetadataRegistry } from "../dotnet-metadata.js";
import { createClrBindingsResolver } from "../resolver/clr-bindings-resolver.js";
import { createBinding } from "../ir/binding/index.js";
import { createProgramContext } from "../ir/program-context.js";
import { extractImports } from "../ir/builder/imports.js";

describe("CLR bindings discovery (entrypoint re-exports)", () => {
  it("loads bindings.json for re-exported CLR namespaces and resolves flattened value exports", () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-reexport-")
    );

    const projectRoot = tmpRoot;
    fs.writeFileSync(
      path.join(projectRoot, "package.json"),
      JSON.stringify(
        { name: "test-project", private: true, type: "module" },
        null,
        2
      )
    );

    // Fake CLR bindings package under node_modules with a facade that re-exports another namespace.
    const pkgRoot = path.join(projectRoot, "node_modules", "@test", "pkg");
    fs.mkdirSync(pkgRoot, { recursive: true });
    fs.writeFileSync(
      path.join(pkgRoot, "package.json"),
      JSON.stringify(
        {
          name: "@test/pkg",
          version: "0.0.0",
          type: "module",
          exports: {
            "./*.js": {
              types: "./dist/tsonic/bindings/*.d.ts",
              default: "./dist/tsonic/bindings/*.js",
            },
          },
        },
        null,
        2
      )
    );

    const bindingsRoot = path.join(pkgRoot, "dist", "tsonic", "bindings");
    fs.mkdirSync(bindingsRoot, { recursive: true });

    // Root namespace facade: re-exports foo from Other namespace.
    fs.mkdirSync(path.join(bindingsRoot, "Root"), { recursive: true });
    fs.writeFileSync(
      path.join(bindingsRoot, "Root", "bindings.json"),
      JSON.stringify({ namespace: "Root", types: [] }, null, 2)
    );
    fs.writeFileSync(
      path.join(bindingsRoot, "Root.d.ts"),
      `export { foo } from "./Other.js";\n`
    );
    fs.writeFileSync(
      path.join(bindingsRoot, "Root.js"),
      `throw new Error("stub");\n`
    );

    // Other namespace facade: re-exports foo from its internal index.
    fs.mkdirSync(path.join(bindingsRoot, "Other", "internal"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(bindingsRoot, "Other", "bindings.json"),
      JSON.stringify(
        {
          namespace: "Other",
          types: [],
          exports: {
            foo: {
              kind: "method",
              clrName: "foo",
              declaringClrType: "Other.Container",
              declaringAssemblyName: "TestAssembly",
            },
          },
        },
        null,
        2
      )
    );
    fs.writeFileSync(
      path.join(bindingsRoot, "Other.d.ts"),
      `export { foo } from "./Other/internal/index.js";\n`
    );
    fs.writeFileSync(
      path.join(bindingsRoot, "Other.js"),
      `throw new Error("stub");\n`
    );
    fs.writeFileSync(
      path.join(bindingsRoot, "Other", "internal", "index.d.ts"),
      `export declare function foo(): void;\n`
    );
    fs.writeFileSync(
      path.join(bindingsRoot, "Other", "internal", "index.js"),
      `throw new Error("stub");\n`
    );

    // Project source imports from Root (only), but expects to call foo.
    const srcDir = path.join(projectRoot, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    const entryFile = path.join(srcDir, "main.ts");
    fs.writeFileSync(
      entryFile,
      `import { foo } from "@test/pkg/Root.js";\nexport function main(): void { foo(); }\n`
    );

    const program = ts.createProgram({
      rootNames: [entryFile],
      options: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        noLib: true,
        noEmit: true,
        skipLibCheck: true,
      },
    });
    const sourceFile = program.getSourceFile(entryFile);
    if (!sourceFile) throw new Error("failed to read entry source file");

    const checker = program.getTypeChecker();
    const bindings = new BindingRegistry();

    const tsonicProgram = {
      program,
      checker,
      options: {
        projectRoot,
        sourceRoot: projectRoot,
        rootNamespace: "TestApp",
        strict: true,
      },
      sourceFiles: [sourceFile],
      declarationSourceFiles: [],
      metadata: new DotnetMetadataRegistry(),
      bindings,
      clrResolver: createClrBindingsResolver(projectRoot),
      binding: createBinding(checker),
    };

    discoverAndLoadClrBindings(tsonicProgram);

    // Sanity: the re-exported namespace binding file must be loaded.
    expect(bindings.getTsbindgenExport("Other", "foo")).to.not.equal(undefined);

    const ctx = createProgramContext(tsonicProgram, {
      sourceRoot: projectRoot,
      rootNamespace: "TestApp",
    });

    const irImports = extractImports(sourceFile, ctx);
    expect(ctx.diagnostics.length).to.equal(0);

    const imp = irImports.find(
      (i) => i.kind === "import" && i.source === "@test/pkg/Root.js"
    );
    expect(imp, "expected import to be extracted").to.not.equal(undefined);
    if (!imp || imp.kind !== "import") return;

    const fooSpec = imp.specifiers.find(
      (s) => s.kind === "named" && s.name === "foo"
    );
    expect(fooSpec, "expected named import foo").to.not.equal(undefined);
    if (!fooSpec || fooSpec.kind !== "named") return;

    expect(fooSpec.resolvedClrValue?.declaringClrType).to.equal(
      "Other.Container"
    );
    expect(fooSpec.resolvedClrValue?.memberName).to.equal("foo");
  });

  it("loads CLR bindings referenced only from declaration files", () => {
    const tmpRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-clr-decl-import-")
    );

    try {
      const projectRoot = tmpRoot;
      fs.writeFileSync(
        path.join(projectRoot, "package.json"),
        JSON.stringify(
          { name: "test-project", private: true, type: "module" },
          null,
          2
        )
      );

      const efPkgRoot = path.join(projectRoot, "node_modules", "@test", "ef");
      fs.mkdirSync(efPkgRoot, { recursive: true });
      fs.writeFileSync(
        path.join(efPkgRoot, "package.json"),
        JSON.stringify(
          {
            name: "@test/ef",
            version: "0.0.0",
            type: "module",
            exports: {
              "./*.js": {
                types: "./dist/tsonic/bindings/*.d.ts",
                default: "./dist/tsonic/bindings/*.js",
              },
            },
          },
          null,
          2
        )
      );

      const efBindingsRoot = path.join(efPkgRoot, "dist", "tsonic", "bindings");
      fs.mkdirSync(path.join(efBindingsRoot, "Foo"), { recursive: true });
      fs.writeFileSync(
        path.join(efBindingsRoot, "Foo", "bindings.json"),
        JSON.stringify(
          {
            namespace: "Foo",
            types: [],
            exports: {
              mark: {
                kind: "method",
                clrName: "mark",
                declaringClrType: "Foo.Container",
                declaringAssemblyName: "TestAssembly",
              },
            },
          },
          null,
          2
        )
      );
      fs.writeFileSync(
        path.join(efBindingsRoot, "Foo.d.ts"),
        "export interface Marker { ok: true; }\nexport declare function mark(): void;\n"
      );
      fs.writeFileSync(
        path.join(efBindingsRoot, "Foo.js"),
        'throw new Error("stub");\n'
      );

      const pkgRoot = path.join(projectRoot, "node_modules", "@test", "pkg");
      fs.mkdirSync(pkgRoot, { recursive: true });
      fs.writeFileSync(
        path.join(pkgRoot, "package.json"),
        JSON.stringify(
          {
            name: "@test/pkg",
            version: "0.0.0",
            type: "module",
            exports: {
              "./*.js": {
                types: "./dist/tsonic/bindings/*.d.ts",
                default: "./dist/tsonic/bindings/*.js",
              },
            },
          },
          null,
          2
        )
      );

      const bindingsRoot = path.join(pkgRoot, "dist", "tsonic", "bindings");
      fs.mkdirSync(bindingsRoot, { recursive: true });
      fs.writeFileSync(
        path.join(bindingsRoot, "Root.d.ts"),
        [
          'import type { Marker } from "@test/ef/Foo.js";',
          "",
          "export interface NeedsMarker {",
          "  readonly value: Marker;",
          "}",
          "",
        ].join("\n")
      );
      fs.writeFileSync(
        path.join(bindingsRoot, "Root.js"),
        'throw new Error("stub");\n'
      );
      fs.mkdirSync(path.join(bindingsRoot, "Root"), { recursive: true });
      fs.writeFileSync(
        path.join(bindingsRoot, "Root", "bindings.json"),
        JSON.stringify({ namespace: "Root", types: [] }, null, 2)
      );

      const srcDir = path.join(projectRoot, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      const entryFile = path.join(srcDir, "main.ts");
      fs.writeFileSync(
        entryFile,
        'import type { NeedsMarker } from "@test/pkg/Root.js";\nexport type Check = NeedsMarker;\n'
      );

      const program = ts.createProgram({
        rootNames: [entryFile],
        options: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          strict: true,
          noLib: true,
          noEmit: true,
          skipLibCheck: true,
        },
      });
      const sourceFile = program.getSourceFile(entryFile);
      if (!sourceFile) throw new Error("failed to read entry source file");

      const checker = program.getTypeChecker();
      const bindings = new BindingRegistry();
      const declarationSourceFiles = program
        .getSourceFiles()
        .filter((sf) => sf.isDeclarationFile);

      const tsonicProgram = {
        program,
        checker,
        options: {
          projectRoot,
          sourceRoot: projectRoot,
          rootNamespace: "TestApp",
          strict: true,
        },
        sourceFiles: [sourceFile],
        declarationSourceFiles,
        metadata: new DotnetMetadataRegistry(),
        bindings,
        clrResolver: createClrBindingsResolver(projectRoot),
        binding: createBinding(checker),
      };

      discoverAndLoadClrBindings(tsonicProgram);

      expect(bindings.getTsbindgenExport("Foo", "mark")).to.not.equal(
        undefined
      );
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
