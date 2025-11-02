/**
 * Main module emission logic
 */

import { IrModule, IrStatement } from "@tsonic/frontend";
import {
  EmitterOptions,
  createContext,
  formatUsings,
  indent,
  getIndent,
  withStatic,
} from "../types.js";
import { emitStatement } from "../statement-emitter.js";
import { generateStructuralAdapters } from "../adapter-generator.js";
import {
  collectSpecializations,
  generateSpecializations,
} from "../specialization-generator.js";
import { generateGeneratorExchanges } from "../generator-exchange.js";
import { generateFileHeader } from "../constants.js";
import { defaultOptions } from "./options.js";
import { collectTypeParameters } from "./type-params.js";
import { processImports } from "./imports.js";
import { emitExport } from "./exports.js";

/**
 * Generate file header with source info (uses shared constant)
 */
const generateHeader = (module: IrModule, options: EmitterOptions): string => {
  return generateFileHeader(module.filePath, {
    includeTimestamp: options.includeTimestamp,
  });
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
