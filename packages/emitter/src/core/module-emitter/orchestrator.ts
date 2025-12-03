/**
 * Module emission orchestrator
 */

import { IrModule } from "@tsonic/frontend";
import { EmitterOptions, createContext } from "../../types.js";
import { generateStructuralAdapters } from "../../adapter-generator.js";
import {
  collectSpecializations,
  generateSpecializations,
} from "../../specialization-generator.js";
import { generateGeneratorExchanges } from "../../generator-exchange.js";
import { defaultOptions } from "../options.js";
import { collectTypeParameters } from "../type-params.js";
import { processImports } from "../imports.js";
import { buildLocalTypes } from "../local-types.js";
import { generateHeader } from "./header.js";
import { separateStatements } from "./separation.js";
import { emitNamespaceDeclarations } from "./namespace.js";
import {
  emitStaticContainer,
  hasMatchingClassName,
} from "./static-container.js";
import { assembleOutput, type AssemblyParts } from "./assembly.js";

/**
 * Emit C# code from an IR module
 */
export const emitModule = (
  module: IrModule,
  options: Partial<EmitterOptions> = {}
): string => {
  const finalOptions: EmitterOptions = { ...defaultOptions, ...options };
  const baseContext = createContext(finalOptions);

  // Build local type index for property type lookup
  const localTypes = buildLocalTypes(module);
  const context = { ...baseContext, localTypes };

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
  const { namespaceLevelDecls, staticContainerMembers, hasInheritance } =
    separateStatements(module);

  // Emit namespace-level declarations (classes, interfaces)
  const namespaceResult = emitNamespaceDeclarations(
    namespaceLevelDecls,
    exchangesContext,
    hasInheritance
  );

  // Emit static container class if there are any static members
  // Use __Module suffix when there's a name collision with namespace-level declarations
  let staticContainerCode = "";
  let finalContext = namespaceResult.context;

  if (staticContainerMembers.length > 0) {
    const hasCollision = hasMatchingClassName(
      namespaceLevelDecls,
      module.className
    );
    const containerResult = emitStaticContainer(
      module,
      staticContainerMembers,
      namespaceResult.context, // Use context from namespace declarations to preserve usings
      hasInheritance,
      hasCollision // Add __Module suffix only when there's a name collision
    );
    staticContainerCode = containerResult.code;
    finalContext = containerResult.context;
  }

  // Assemble final output
  const parts: AssemblyParts = {
    header,
    adaptersCode,
    specializationsCode,
    exchangesCode,
    namespaceDeclsCode: namespaceResult.code,
    staticContainerCode,
  };

  return assembleOutput(module, parts, finalContext);
};
