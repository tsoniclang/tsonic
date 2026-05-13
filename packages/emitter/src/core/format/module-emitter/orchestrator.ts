/**
 * Module emission orchestrator
 */

import { IrModule, IrStatement } from "@tsonic/frontend";
import { EmitterOptions, createContext } from "../../../types.js";
import { generateStructuralAdapters } from "../../../adapter-generator.js";
import {
  collectSpecializations,
  generateSpecializations,
} from "../../../specialization-generator.js";
import { generateGeneratorExchanges } from "../../../generator-exchange.js";
import { defaultOptions } from "../options.js";
import { collectTypeParameters } from "../../semantic/type-params.js";
import { processImports } from "../../semantic/imports.js";
import {
  buildLocalTypes,
  collectPublicLocalTypes,
} from "../../semantic/local-types.js";
import { analyzeMutableStorage } from "../../semantic/mutable-storage.js";
import { generateHeader } from "./header.js";
import { separateStatements } from "./separation.js";
import { emitNamespaceDeclarations } from "./namespace.js";
import {
  emitStaticContainer,
  hasMatchingClassName,
  collectStaticContainerValueSymbols,
} from "./static-container.js";
import { assembleOutput, type AssemblyParts } from "./assembly.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { moduleBodyRequiresStaticContainerSuffix } from "../../semantic/module-type-collisions.js";

const isSuppressibleTypeDeclaration = (
  stmt: IrStatement
): stmt is
  | Extract<IrStatement, { kind: "classDeclaration" }>
  | Extract<IrStatement, { kind: "interfaceDeclaration" }>
  | Extract<IrStatement, { kind: "enumDeclaration" }>
  | Extract<IrStatement, { kind: "typeAliasDeclaration" }> =>
  stmt.kind === "classDeclaration" ||
  stmt.kind === "interfaceDeclaration" ||
  stmt.kind === "enumDeclaration" ||
  stmt.kind === "typeAliasDeclaration";

const typeSuppressionKey = (
  filePath: string,
  stmt: Extract<
    IrStatement,
    | { kind: "classDeclaration" }
    | { kind: "interfaceDeclaration" }
    | { kind: "enumDeclaration" }
    | { kind: "typeAliasDeclaration" }
  >
): string => `${filePath}::${stmt.kind}::${stmt.name}`;

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
  const publicLocalTypes = collectPublicLocalTypes(module, localTypes);
  const mutableStorage = analyzeMutableStorage(module, {
    ...baseContext,
    localTypes,
  });
  const context = {
    ...baseContext,
    localTypes,
    publicLocalTypes,
    mutableModuleBindings: mutableStorage.mutableModuleBindings,
    mutablePropertySlots: mutableStorage.mutablePropertySlots,
  };

  // Generate file header
  const header = generateHeader(module, finalOptions);

  // Process imports to collect using statements
  const processedContext = processImports(module.imports, context, module);

  // Collect type parameters and generate adapters
  const typeParams = collectTypeParameters(module);
  const [adapterDecls, adaptersContext] = generateStructuralAdapters(
    typeParams,
    processedContext
  );

  // Collect specializations and generate monomorphized versions
  const specializations = collectSpecializations(module);
  const [specializationDecls, specializationsContext] = generateSpecializations(
    specializations,
    adaptersContext
  );

  // Generate exchange objects for generators
  const [exchangeDecls, exchangesContext] = generateGeneratorExchanges(
    module,
    specializationsContext
  );

  // Separate namespace-level declarations from static container members
  const { namespaceLevelDecls, staticContainerMembers, hasInheritance } =
    separateStatements(module);
  const suppressedTypeDeclarations = context.options.suppressedTypeDeclarations;
  const filteredNamespaceLevelDecls = namespaceLevelDecls.filter((stmt) => {
    if (!isSuppressibleTypeDeclaration(stmt)) return true;
    if (
      stmt.kind === "typeAliasDeclaration" &&
      stmt.type.kind !== "objectType"
    ) {
      return true;
    }
    const key = typeSuppressionKey(module.filePath, stmt);
    return !suppressedTypeDeclarations?.has(key);
  });

  const hasCollision =
    staticContainerMembers.length > 0 &&
    (hasMatchingClassName(filteredNamespaceLevelDecls, module.className) ||
      moduleBodyRequiresStaticContainerSuffix(module.body, module.className));
  const escapedModuleClassName = escapeCSharpIdentifier(module.className);
  const moduleStaticClassName =
    staticContainerMembers.length > 0
      ? hasCollision
        ? `${escapedModuleClassName}__Module`
        : escapedModuleClassName
      : undefined;

  const valueSymbols =
    staticContainerMembers.length > 0
      ? collectStaticContainerValueSymbols(
          staticContainerMembers,
          exchangesContext
        )
      : undefined;

  const moduleContext = {
    ...exchangesContext,
    moduleNamespace: module.namespace,
    moduleStaticClassName,
    valueSymbols,
  };

  // Emit namespace-level declarations (classes, interfaces)
  const namespaceResult = emitNamespaceDeclarations(
    filteredNamespaceLevelDecls,
    moduleContext,
    hasInheritance
  );

  // Emit static container class if there are any static members
  // Use __Module suffix when there's a name collision with namespace-level declarations
  let staticContainerDecl = undefined;
  let finalContext = namespaceResult.context;

  if (staticContainerMembers.length > 0) {
    const containerResult = emitStaticContainer(
      module,
      staticContainerMembers,
      namespaceResult.context, // Use context from namespace declarations to preserve usings
      hasInheritance,
      hasCollision // Add __Module suffix only when there's a name collision
    );
    staticContainerDecl = containerResult.declaration;
    finalContext = containerResult.context;
  }

  // Assemble final output from AST declarations
  const parts: AssemblyParts = {
    leadingTrivia: header,
    adapterDecls,
    specializationDecls,
    exchangeDecls,
    namespaceDecls: namespaceResult.declarations,
    staticContainerDecl,
  };

  return assembleOutput(module, parts, finalContext);
};
