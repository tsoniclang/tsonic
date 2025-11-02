/**
 * Main C# Emitter - Orchestrates code generation from IR
 */

import {
  IrModule,
  IrImport,
  IrExport,
  IrTypeParameter,
  IrStatement,
} from "@tsonic/frontend";
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
import { generateStructuralAdapters } from "./adapter-generator.js";
import {
  collectSpecializations,
  generateSpecializations,
} from "./specialization-generator.js";
import { generateGeneratorExchanges } from "./generator-exchange.js";
import { generateFileHeader } from "./constants.js";

/**
 * Collect all type parameters from declarations in a module
 */
const collectTypeParameters = (
  module: IrModule
): readonly IrTypeParameter[] => {
  const typeParams: IrTypeParameter[] = [];

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
    } else if (stmt.kind === "classDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
      // Also collect from class members
      for (const member of stmt.members) {
        if (member.kind === "methodDeclaration" && member.typeParameters) {
          typeParams.push(...member.typeParameters);
        }
      }
    } else if (stmt.kind === "interfaceDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
    } else if (stmt.kind === "typeAliasDeclaration" && stmt.typeParameters) {
      typeParams.push(...stmt.typeParameters);
    }
  }

  return typeParams;
};

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

  // Collect type parameters and generate adapters
  const typeParams = collectTypeParameters(module);
  const [adaptersCode, adaptersContext] = generateStructuralAdapters(
    typeParams,
    processedContext
  );

  // Collect specializations and generate monomorphized versions
  const specializations = collectSpecializations(module);
  const [specializationsCode, specializationsContext] = generateSpecializations(
    specializations,
    adaptersContext
  );

  // Generate exchange objects for generators
  const [exchangesCode, exchangesContext] = generateGeneratorExchanges(
    module,
    specializationsContext
  );

  // Separate namespace-level declarations from static container members
  const namespaceLevelDecls: IrStatement[] = [];
  const staticContainerMembers: IrStatement[] = [];

  // Detect if module has any inheritance (for virtual/override keywords)
  const hasInheritance = module.body.some(
    (stmt) => stmt.kind === "classDeclaration" && stmt.superClass
  );

  for (const stmt of module.body) {
    if (
      stmt.kind === "classDeclaration" ||
      stmt.kind === "interfaceDeclaration"
    ) {
      namespaceLevelDecls.push(stmt);
    } else {
      staticContainerMembers.push(stmt);
    }
  }

  // Emit namespace-level declarations (classes, interfaces)
  const namespaceParts: string[] = [];
  const namespaceContext = { ...indent(exchangesContext), hasInheritance };
  let currentContext = namespaceContext;

  for (const decl of namespaceLevelDecls) {
    // Use the same base context for each declaration to maintain consistent indentation
    const [code, newContext] = emitStatement(decl, namespaceContext);
    namespaceParts.push(code);
    // Track context for using statements, but don't let indentation accumulate
    // Preserve the hasInheritance flag
    currentContext = { ...newContext, hasInheritance };
  }

  // Emit static container class unless there's a namespace-level class with same name
  const hasMatchingClassName = namespaceLevelDecls.some(
    (decl) =>
      (decl.kind === "classDeclaration" ||
        decl.kind === "interfaceDeclaration") &&
      decl.name === module.className
  );
  let staticContainerCode = "";
  if (!hasMatchingClassName) {
    const classContext = withStatic(indent(exchangesContext), true);
    const bodyContext = indent(classContext);
    const ind = getIndent(classContext);

    const containerParts: string[] = [];
    containerParts.push(`${ind}public static class ${module.className}`);
    containerParts.push(`${ind}{`);

    const bodyParts: string[] = [];
    let bodyCurrentContext = bodyContext;

    for (const stmt of staticContainerMembers) {
      const [code, newContext] = emitStatement(stmt, bodyCurrentContext);
      bodyParts.push(code);
      bodyCurrentContext = newContext;
    }

    // Handle explicit exports
    for (const exp of module.exports) {
      const exportCode = emitExport(exp, bodyCurrentContext);
      if (exportCode[0]) {
        bodyParts.push(exportCode[0]);
        bodyCurrentContext = exportCode[1];
      }
    }

    if (bodyParts.length > 0) {
      containerParts.push(bodyParts.join("\n\n"));
    }

    containerParts.push(`${ind}}`);
    staticContainerCode = containerParts.join("\n");
    currentContext = { ...bodyCurrentContext, hasInheritance };
  }

  // Format using statements
  const usings = formatUsings(currentContext.usings);

  // Combine all parts
  const parts: string[] = [];

  if (header) {
    parts.push(header);
  }

  parts.push(usings);
  parts.push("");
  parts.push(`namespace ${module.namespace}`);
  parts.push("{");

  // Emit adapters before class code
  if (adaptersCode) {
    const indentedAdapters = adaptersCode
      .split("\n")
      .map((line) => (line ? "    " + line : line))
      .join("\n");
    parts.push(indentedAdapters);
    parts.push("");
  }

  // Emit specializations after adapters
  if (specializationsCode) {
    const indentedSpecializations = specializationsCode
      .split("\n")
      .map((line) => (line ? "    " + line : line))
      .join("\n");
    parts.push(indentedSpecializations);
    parts.push("");
  }

  // Emit generator exchange objects after specializations
  if (exchangesCode) {
    const indentedExchanges = exchangesCode
      .split("\n")
      .map((line) => (line ? "    " + line : line))
      .join("\n");
    parts.push(indentedExchanges);
    parts.push("");
  }

  // Emit namespace-level declarations first
  if (namespaceParts.length > 0) {
    parts.push(namespaceParts.join("\n"));
  }

  // Then emit static container if needed
  if (staticContainerCode) {
    if (namespaceParts.length > 0) {
      parts.push("");
    }
    parts.push(staticContainerCode);
  }

  parts.push("}");

  return parts.join("\n");
};

/**
 * Generate file header with source info (uses shared constant)
 */
const generateHeader = (module: IrModule, options: EmitterOptions): string => {
  return generateFileHeader(module.filePath, {
    includeTimestamp: options.includeTimestamp,
  });
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
