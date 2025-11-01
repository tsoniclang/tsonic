/**
 * Main C# Emitter - Orchestrates code generation from IR
 */

import { IrModule, IrImport, IrExport } from "@tsonic/frontend";
import {
  EmitterOptions,
  EmitterContext,
  createContext,
  formatUsings,
  indent,
  getIndent,
  withStatic,
  addUsing,
} from "./types.js";
import { emitStatement } from "./statement-emitter.js";
import { emitExpression } from "./expression-emitter.js";

/**
 * Default emitter options
 */
const defaultOptions: EmitterOptions = {
  rootNamespace: "MyApp",
  includeSourceMaps: false,
  indent: 4,
  maxLineLength: 120,
  includeTimestamp: true,
};

/**
 * Emit C# code from an IR module
 */
export const emitModule = (
  module: IrModule,
  options: Partial<EmitterOptions> = {}
): string => {
  const finalOptions: EmitterOptions = { ...defaultOptions, ...options };
  const context = createContext(finalOptions);

  // Generate file header
  const header = generateHeader(module, finalOptions);

  // Process imports to collect using statements
  const processedContext = processImports(module.imports, context, module);

  // Generate class or static container
  const [classCode, finalContext] = module.isStaticContainer
    ? generateStaticClass(module, processedContext)
    : generateRegularClass(module, processedContext);

  // Format using statements
  const usings = formatUsings(finalContext.usings);

  // Combine all parts
  const parts: string[] = [];

  if (header) {
    parts.push(header);
  }

  parts.push(usings);
  parts.push("");
  parts.push(`namespace ${module.namespace}`);
  parts.push("{");
  parts.push(classCode);
  parts.push("}");

  return parts.join("\n");
};

/**
 * Generate file header with source info
 */
const generateHeader = (module: IrModule, options: EmitterOptions): string => {
  const lines: string[] = [];

  lines.push(`// Generated from: ${module.filePath}`);

  if (options.includeTimestamp) {
    lines.push(`// Generated at: ${new Date().toISOString()}`);
  }

  lines.push("// WARNING: Do not modify this file manually");
  lines.push("");

  return lines.join("\n");
};

/**
 * Process imports and collect using statements
 */
const processImports = (
  imports: readonly IrImport[],
  context: EmitterContext,
  module: IrModule
): EmitterContext => {
  let currentContext = context;

  for (const imp of imports) {
    if (imp.isDotNet) {
      // .NET import - add to using statements
      if (imp.resolvedNamespace) {
        currentContext = addUsing(currentContext, imp.resolvedNamespace);
      }
    } else if (imp.isLocal) {
      // Local import - resolve to namespace
      const namespace = resolveLocalImport(
        imp,
        module.filePath,
        context.options.rootNamespace
      );
      if (namespace) {
        currentContext = addUsing(currentContext, namespace);
      }
    }
    // External packages not supported in MVP
  }

  return currentContext;
};

/**
 * Resolve local import to a namespace
 */
const resolveLocalImport = (
  imp: IrImport,
  currentFilePath: string,
  rootNamespace: string
): string | null => {
  // Get the directory of the current file
  // e.g., "/src/services/api.ts" -> "/src/services"
  const currentDir = currentFilePath.substring(
    0,
    currentFilePath.lastIndexOf("/")
  );

  // Resolve the import path relative to current directory
  // e.g., "./auth.ts" from "/src/services" -> "/src/services/auth.ts"
  // e.g., "../models/User.ts" from "/src/services" -> "/src/models/User.ts"
  let resolvedPath: string;
  if (imp.source.startsWith("./")) {
    resolvedPath = `${currentDir}/${imp.source.substring(2)}`;
  } else if (imp.source.startsWith("../")) {
    const parts = currentDir.split("/");
    let source = imp.source;
    while (source.startsWith("../")) {
      parts.pop(); // Go up one directory
      source = source.substring(3);
    }
    resolvedPath = `${parts.join("/")}/${source}`;
  } else {
    resolvedPath = `${currentDir}/${imp.source}`;
  }

  // Remove .ts extension and get directory path
  const withoutExtension = resolvedPath.replace(/\.ts$/, "");
  const dirPath = withoutExtension.substring(
    0,
    withoutExtension.lastIndexOf("/")
  );

  // Convert directory path to namespace
  // e.g., "/src/services" -> ["src", "services"]
  const parts = dirPath.split("/").filter((p) => p !== "");

  if (parts.length === 0) {
    return rootNamespace;
  }

  // Remove "src" if it's the first part (common convention)
  if (parts[0] === "src") {
    parts.shift();
  }

  if (parts.length === 0) {
    return rootNamespace;
  }

  return `${rootNamespace}.${parts.join(".")}`;
};

/**
 * Generate a static container class
 */
const generateStaticClass = (
  module: IrModule,
  context: EmitterContext
): [string, EmitterContext] => {
  const classContext = withStatic(indent(context), true);
  const bodyContext = indent(classContext);
  const ind = getIndent(classContext);

  const parts: string[] = [];
  parts.push(`${ind}public static class ${module.className}`);
  parts.push(`${ind}{`);

  // Process exports and body statements
  const bodyParts: string[] = [];
  let currentContext = bodyContext;

  // Emit all body statements
  for (const stmt of module.body) {
    const [code, newContext] = emitStatement(stmt, currentContext);
    bodyParts.push(code);
    currentContext = newContext;
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const exportCode = emitExport(exp, currentContext);
    if (exportCode[0]) {
      bodyParts.push(exportCode[0]);
      currentContext = exportCode[1];
    }
  }

  if (bodyParts.length > 0) {
    parts.push(bodyParts.join("\n\n"));
  }

  parts.push(`${ind}}`);
  return [parts.join("\n"), currentContext];
};

/**
 * Generate a regular (non-static) class
 */
const generateRegularClass = (
  module: IrModule,
  context: EmitterContext
): [string, EmitterContext] => {
  const classContext = indent(context);
  const bodyContext = indent(classContext);
  const ind = getIndent(classContext);

  const parts: string[] = [];

  // Check if there's a class declaration with the same name as the file
  const classDecl = module.body.find(
    (stmt) => stmt.kind === "classDeclaration" && stmt.name === module.className
  );

  if (classDecl) {
    // Emit the class declaration directly
    return emitStatement(classDecl, classContext);
  }

  // Otherwise, create a wrapper class
  parts.push(`${ind}public class ${module.className}`);
  parts.push(`${ind}{`);

  // If this is an entry point, separate declarations from executable statements
  if (context.options.isEntryPoint) {
    const declarations: any[] = [];
    const executables: any[] = [];

    for (const stmt of module.body) {
      if (isDeclaration(stmt)) {
        declarations.push(stmt);
      } else {
        executables.push(stmt);
      }
    }

    // Emit declarations at class level
    const declarationParts: string[] = [];
    let currentContext = bodyContext;

    for (const stmt of declarations) {
      const [code, newContext] = emitStatement(stmt, currentContext);
      declarationParts.push(code);
      currentContext = newContext;
    }

    if (declarationParts.length > 0) {
      parts.push(declarationParts.join("\n\n"));
      parts.push("");
    }

    // Emit Main method with executable statements
    if (executables.length > 0) {
      const mainMethodParts: string[] = [];
      const methodIndent = getIndent(bodyContext);
      const mainContext = withStatic(indent(bodyContext), true);

      mainMethodParts.push(
        `${methodIndent}public static void Main(string[] args)`
      );
      mainMethodParts.push(`${methodIndent}{`);

      for (const stmt of executables) {
        const [code, newContext] = emitStatement(stmt, mainContext);
        mainMethodParts.push(code);
        currentContext = newContext;
      }

      mainMethodParts.push(`${methodIndent}}`);
      parts.push(mainMethodParts.join("\n"));
    }

    parts.push(`${ind}}`);
    return [parts.join("\n"), currentContext];
  }

  // Non-entry point: emit all statements at class level (original behavior)
  const bodyParts: string[] = [];
  let currentContext = bodyContext;

  for (const stmt of module.body) {
    const [code, newContext] = emitStatement(stmt, currentContext);
    bodyParts.push(code);
    currentContext = newContext;
  }

  // Handle explicit exports
  for (const exp of module.exports) {
    const exportCode = emitExport(exp, currentContext);
    if (exportCode[0]) {
      bodyParts.push(exportCode[0]);
      currentContext = exportCode[1];
    }
  }

  if (bodyParts.length > 0) {
    parts.push(bodyParts.join("\n\n"));
  }

  parts.push(`${ind}}`);
  return [parts.join("\n"), currentContext];
};

/**
 * Check if a statement is a declaration (can be at class level)
 */
const isDeclaration = (stmt: any): boolean => {
  return (
    stmt.kind === "functionDeclaration" ||
    stmt.kind === "classDeclaration" ||
    stmt.kind === "interfaceDeclaration" ||
    stmt.kind === "enumDeclaration" ||
    stmt.kind === "typeAlias"
  );
};

/**
 * Emit an export declaration
 */
const emitExport = (
  exp: IrExport,
  context: EmitterContext
): [string | null, EmitterContext] => {
  switch (exp.kind) {
    case "named":
      // Named exports are handled by marking declarations as public
      return [null, context];

    case "default": {
      // Default exports need special handling
      // For MVP, we'll emit a comment
      const [exprFrag, newContext] = emitExpression(exp.expression, context);
      const ind = getIndent(context);
      return [`${ind}// Default export: ${exprFrag.text}`, newContext];
    }

    case "declaration":
      // Export declarations are already handled in the body
      return [null, context];

    default:
      return [null, context];
  }
};

/**
 * Emit a complete C# file from an IR module
 */
export const emitCSharpFile = (
  module: IrModule,
  options: Partial<EmitterOptions> = {}
): string => {
  return emitModule(module, options);
};

/**
 * Batch emit multiple IR modules
 */
export const emitCSharpFiles = (
  modules: readonly IrModule[],
  options: Partial<EmitterOptions> = {}
): Map<string, string> => {
  const results = new Map<string, string>();

  for (const module of modules) {
    const outputPath = module.filePath.replace(/\.ts$/, ".cs");
    // Mark this module as entry point if it matches the entry point path
    const isEntryPoint = !!(
      options.entryPointPath && module.filePath === options.entryPointPath
    );
    const moduleOptions = {
      ...options,
      isEntryPoint,
    };
    const code = emitModule(module, moduleOptions);
    results.set(outputPath, code);
  }

  return results;
};
