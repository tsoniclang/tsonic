/**
 * Shared helpers for Declaration-Based Numeric Intent Recovery tests.
 */

import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import { compile, runNumericProofPass } from "../../../../index.js";
import { buildIr } from "../../../builder.js";
import { IrModule, IrExpression, IrMemberExpression } from "../../../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// From dist/ir/converters/expressions/numeric-recovery-cases/ go up to packages/frontend/, then up 2 more to monorepo root
const monorepoRoot = path.resolve(__dirname, "../../../../../../..");
const globalsPath = path.join(monorepoRoot, "node_modules/@tsonic/globals");
const corePath = path.join(monorepoRoot, "node_modules/@tsonic/core");
const jsPath = path.join(monorepoRoot, "node_modules/@tsonic/js");
const siblingDotnetPath = path.resolve(monorepoRoot, "../dotnet/versions/10");
const installedDotnetPath = path.join(monorepoRoot, "node_modules/@tsonic/dotnet");
const dotnetPath = fs.existsSync(siblingDotnetPath)
  ? siblingDotnetPath
  : installedDotnetPath;

const installPackageLink = (
  projectRoot: string,
  packageName: string,
  sourceRoot: string
): void => {
  if (!fs.existsSync(sourceRoot)) {
    return;
  }

  const packageRoot = path.join(projectRoot, "node_modules", ...packageName.split("/"));
  if (fs.existsSync(packageRoot)) {
    return;
  }

  fs.mkdirSync(path.dirname(packageRoot), { recursive: true });
  fs.symlinkSync(sourceRoot, packageRoot, "dir");
};

/**
 * Helper to compile TypeScript code with globals and extract IR
 */
export const compileWithTypeRoots = (
  code: string,
  typeRoots: readonly string[],
  surface?: string
): { modules: readonly IrModule[]; ok: boolean; error?: string } => {
  const tmpDir = `/tmp/numeric-recovery-test-${Date.now()}`;
  fs.mkdirSync(tmpDir, { recursive: true });
  installPackageLink(tmpDir, "@tsonic/core", corePath);
  installPackageLink(tmpDir, "@tsonic/globals", globalsPath);
  installPackageLink(tmpDir, "@tsonic/js", jsPath);
  installPackageLink(tmpDir, "@tsonic/dotnet", dotnetPath);

  const filePath = path.join(tmpDir, "test.ts");
  fs.writeFileSync(filePath, code);

  const compileResult = compile([filePath], {
    projectRoot: tmpDir,
    sourceRoot: tmpDir,
    rootNamespace: "Test",
    typeRoots,
    surface,
  });

  if (!compileResult.ok) {
    const errorMsg = compileResult.error.diagnostics
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    return { modules: [], ok: false, error: errorMsg };
  }

  const irResult = buildIr(compileResult.value.program, {
    sourceRoot: tmpDir,
    rootNamespace: "Test",
  });
  if (!irResult.ok) {
    const errorMsg = irResult.error
      .map((d) => `${d.code}: ${d.message}`)
      .join("\n");
    return { modules: [], ok: false, error: errorMsg };
  }

  return { modules: irResult.value, ok: true };
};

export const compileWithGlobals = (
  code: string
): { modules: readonly IrModule[]; ok: boolean; error?: string } =>
  compileWithTypeRoots(code, [globalsPath, corePath]);

export const compileWithJsSurface = (
  code: string
): { modules: readonly IrModule[]; ok: boolean; error?: string } =>
  compileWithTypeRoots(code, [jsPath, corePath], "@tsonic/js");

/**
 * Helper to find an expression in the IR by predicate
 */
export const findExpression = (
  modules: readonly IrModule[],
  predicate: (expr: IrExpression) => boolean
): IrExpression | undefined => {
  const visitExpression = (expr: IrExpression): IrExpression | undefined => {
    if (predicate(expr)) return expr;

    // Recursively check nested expressions
    if (expr.kind === "memberAccess") {
      const result = visitExpression(expr.object);
      if (result) return result;
      // Also check computed property if it's an expression
      if (typeof expr.property !== "string") {
        const propResult = visitExpression(expr.property);
        if (propResult) return propResult;
      }
    }
    if (expr.kind === "call") {
      const result = visitExpression(expr.callee);
      if (result) return result;
      for (const arg of expr.arguments) {
        if (arg.kind !== "spread") {
          const argResult = visitExpression(arg);
          if (argResult) return argResult;
        }
      }
    }
    if (expr.kind === "binary") {
      const leftResult = visitExpression(expr.left);
      if (leftResult) return leftResult;
      const rightResult = visitExpression(expr.right);
      if (rightResult) return rightResult;
    }
    if (expr.kind === "logical") {
      const leftResult = visitExpression(expr.left);
      if (leftResult) return leftResult;
      const rightResult = visitExpression(expr.right);
      if (rightResult) return rightResult;
    }

    return undefined;
  };

  for (const module of modules) {
    for (const stmt of module.body) {
      if (stmt.kind === "variableDeclaration") {
        for (const decl of stmt.declarations) {
          if (decl.initializer) {
            const result = visitExpression(decl.initializer);
            if (result) return result;
          }
        }
      }
      if (stmt.kind === "functionDeclaration" && stmt.body) {
        for (const bodyStmt of stmt.body.statements) {
          if (bodyStmt.kind === "returnStatement" && bodyStmt.expression) {
            const result = visitExpression(bodyStmt.expression);
            if (result) return result;
          }
          if (bodyStmt.kind === "variableDeclaration") {
            for (const decl of bodyStmt.declarations) {
              if (decl.initializer) {
                const result = visitExpression(decl.initializer);
                if (result) return result;
              }
            }
          }
        }
      }
    }
  }

  return undefined;
};

export const unwrapTransparentExpression = (
  expr: IrExpression
): IrExpression => {
  let current = expr;
  while (
    current.kind === "typeAssertion" ||
    current.kind === "asinterface" ||
    current.kind === "numericNarrowing"
  ) {
    current = current.expression;
  }
  return current;
};

export { runNumericProofPass };
export type { IrMemberExpression };
