import { describe, it } from "mocha";
import { expect } from "chai";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as ts from "typescript";
import {
  collectClosedWorldDynamicImportSites,
  resolveDynamicImportNamespace,
} from "./dynamic-import.js";

describe("dynamic import resolver", () => {
  it("resolves deterministic closed-world namespace imports", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dynamic-import-success-")
    );

    try {
      const files = {
        "src/index.ts":
          'export async function load() { return import("./module.js"); }\n',
        "src/module.ts":
          "export const value = 42;\nexport function twice(x: number): number { return x * 2; }\n",
      };
      for (const [relativePath, content] of Object.entries(files)) {
        const fullPath = path.join(tempDir, relativePath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content);
      }

      const entryPath = path.join(tempDir, "src", "index.ts");
      const modulePath = path.join(tempDir, "src", "module.ts");
      const program = ts.createProgram(
        [entryPath, modulePath],
        {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.NodeNext,
          moduleResolution: ts.ModuleResolutionKind.NodeNext,
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        }
      );
      const entrySourceFile = program.getSourceFile(entryPath);
      if (!entrySourceFile) throw new Error("Missing entry source file.");
      const checker = program.getTypeChecker();
      const sourceFilesByPath = new Map<string, ts.SourceFile>([
        [entryPath.replace(/\\/g, "/"), entrySourceFile],
        [modulePath.replace(/\\/g, "/"), program.getSourceFile(modulePath)!],
      ]);
      const importCall = entrySourceFile.statements
        .flatMap((statement) =>
          ts.isFunctionDeclaration(statement) && statement.body
            ? statement.body.statements
            : []
        )
        .flatMap((statement) =>
          ts.isReturnStatement(statement) && statement.expression
            ? [statement.expression]
            : []
        )
        .find(ts.isCallExpression);

      expect(importCall).to.not.equal(undefined);
      if (!importCall) return;

      const resolution = resolveDynamicImportNamespace(
        importCall,
        entryPath.replace(/\\/g, "/"),
        {
          checker,
          compilerOptions: program.getCompilerOptions(),
          sourceFilesByPath,
        }
      );

      expect(resolution.ok).to.equal(true);
      if (!resolution.ok) return;

      expect(resolution.resolvedFilePath).to.equal(modulePath.replace(/\\/g, "/"));
      expect(resolution.entries.map((entry) => entry.exportName)).to.deep.equal([
        "twice",
        "value",
      ]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects runtime namespace exports that do not lower to named function/variable members", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dynamic-import-unsupported-")
    );

    try {
      const entryPath = path.join(tempDir, "src", "index.ts");
      const modulePath = path.join(tempDir, "src", "module.ts");
      fs.mkdirSync(path.dirname(entryPath), { recursive: true });
      fs.writeFileSync(
        entryPath,
        'export async function load() { const mod = await import("./module.js"); return mod.Box; }\n'
      );
      fs.writeFileSync(modulePath, "export class Box {}\n");

      const program = ts.createProgram([entryPath, modulePath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      });
      const entrySourceFile = program.getSourceFile(entryPath);
      if (!entrySourceFile) throw new Error("Missing entry source file.");
      const checker = program.getTypeChecker();
      const sites = collectClosedWorldDynamicImportSites(entrySourceFile);

      expect(sites).to.have.length(1);
      const resolution = resolveDynamicImportNamespace(
        sites[0]!.node,
        entryPath.replace(/\\/g, "/"),
        {
          checker,
          compilerOptions: program.getCompilerOptions(),
          sourceFilesByPath: new Map<string, ts.SourceFile>([
            [entryPath.replace(/\\/g, "/"), entrySourceFile],
            [modulePath.replace(/\\/g, "/"), program.getSourceFile(modulePath)!],
          ]),
        }
      );

      expect(resolution.ok).to.equal(false);
      if (resolution.ok) return;

      expect(resolution.reason).to.include("Unsupported export: 'Box'");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("allows closed-world dynamic imports of modules with no runtime exports", () => {
    const tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "tsonic-dynamic-import-empty-")
    );

    try {
      const entryPath = path.join(tempDir, "src", "index.ts");
      const modulePath = path.join(tempDir, "src", "module.ts");
      fs.mkdirSync(path.dirname(entryPath), { recursive: true });
      fs.writeFileSync(
        entryPath,
        'export async function load() { return import("./module.js"); }\n'
      );
      fs.writeFileSync(modulePath, "export type Value = { readonly ok: true };\n");

      const program = ts.createProgram([entryPath, modulePath], {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      });
      const entrySourceFile = program.getSourceFile(entryPath);
      if (!entrySourceFile) throw new Error("Missing entry source file.");
      const checker = program.getTypeChecker();
      const sites = collectClosedWorldDynamicImportSites(entrySourceFile);

      expect(sites).to.have.length(1);
      const resolution = resolveDynamicImportNamespace(
        sites[0]!.node,
        entryPath.replace(/\\/g, "/"),
        {
          checker,
          compilerOptions: program.getCompilerOptions(),
          sourceFilesByPath: new Map<string, ts.SourceFile>([
            [entryPath.replace(/\\/g, "/"), entrySourceFile],
            [modulePath.replace(/\\/g, "/"), program.getSourceFile(modulePath)!],
          ]),
        }
      );

      expect(resolution.ok).to.equal(true);
      if (!resolution.ok) return;

      expect(resolution.entries).to.deep.equal([]);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
