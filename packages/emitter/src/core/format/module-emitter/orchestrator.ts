/**
 * Module emission orchestrator
 */

import { IrModule, IrStatement, IrType } from "@tsonic/frontend";
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
import { buildLocalTypes } from "../../semantic/local-types.js";
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

const walkTypeRefs = (
  type: IrType | undefined,
  onReference: (name: string) => void
): void => {
  if (!type) return;

  switch (type.kind) {
    case "referenceType":
      onReference(type.name);
      if (type.typeArguments) {
        for (const arg of type.typeArguments) walkTypeRefs(arg, onReference);
      }
      if (type.structuralMembers) {
        for (const member of type.structuralMembers) {
          if (member.kind === "propertySignature") {
            walkTypeRefs(member.type, onReference);
            continue;
          }
          for (const param of member.parameters) {
            walkTypeRefs(param.type, onReference);
          }
          walkTypeRefs(member.returnType, onReference);
        }
      }
      return;
    case "typeParameterType":
    case "primitiveType":
    case "literalType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return;
    case "arrayType":
      walkTypeRefs(type.elementType, onReference);
      return;
    case "tupleType":
      for (const element of type.elementTypes)
        walkTypeRefs(element, onReference);
      return;
    case "functionType":
      for (const param of type.parameters)
        walkTypeRefs(param.type, onReference);
      walkTypeRefs(type.returnType, onReference);
      return;
    case "objectType":
      for (const member of type.members) {
        if (member.kind === "propertySignature") {
          walkTypeRefs(member.type, onReference);
          continue;
        }
        for (const param of member.parameters) {
          walkTypeRefs(param.type, onReference);
        }
        walkTypeRefs(member.returnType, onReference);
      }
      return;
    case "dictionaryType":
      walkTypeRefs(type.keyType, onReference);
      walkTypeRefs(type.valueType, onReference);
      return;
    case "unionType":
    case "intersectionType":
      for (const nested of type.types) walkTypeRefs(nested, onReference);
      return;
  }
};

const collectPublicLocalTypes = (
  module: IrModule,
  localTypes: ReadonlyMap<string, unknown>
): ReadonlySet<string> => {
  const result = new Set<string>();
  const addType = (type: IrType | undefined): void => {
    walkTypeRefs(type, (name) => {
      if (localTypes.has(name)) result.add(name);
    });
  };

  for (const stmt of module.body) {
    if (stmt.kind === "functionDeclaration") {
      if (!stmt.isExported) continue;
      for (const param of stmt.parameters) addType(param.type);
      addType(stmt.returnType);
      continue;
    }

    if (stmt.kind === "variableDeclaration") {
      if (!stmt.isExported) continue;
      for (const decl of stmt.declarations) {
        addType(decl.type);
        const init = decl.initializer;
        if (
          init?.kind === "arrowFunction" ||
          init?.kind === "functionExpression"
        ) {
          for (const param of init.parameters) addType(param.type);
          addType(init.returnType);
        }
      }
      continue;
    }

    if (stmt.kind === "classDeclaration") {
      if (!stmt.isExported) continue;
      addType(stmt.superClass);
      for (const impl of stmt.implements) addType(impl);
      for (const member of stmt.members) {
        if (member.kind === "propertyDeclaration") {
          if (member.accessibility === "private") continue;
          addType(member.type);
          continue;
        }
        if (member.kind === "methodDeclaration") {
          if (member.accessibility === "private") continue;
          addType(member.returnType);
          for (const param of member.parameters) addType(param.type);
          continue;
        }
        // Constructors: promote unless private (private constructors are not part of public API)
        if (member.accessibility === "private") continue;
        for (const param of member.parameters) addType(param.type);
      }
      continue;
    }

    if (stmt.kind === "interfaceDeclaration") {
      if (!stmt.isExported) continue;
      for (const ext of stmt.extends) addType(ext);
      for (const member of stmt.members) {
        if (member.kind === "propertySignature") {
          addType(member.type);
          continue;
        }
        for (const param of member.parameters) addType(param.type);
        addType(member.returnType);
      }
      continue;
    }

    if (stmt.kind === "typeAliasDeclaration") {
      if (!stmt.isExported) continue;
      addType(stmt.type);
    }
  }

  return result;
};

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
  const context = {
    ...baseContext,
    localTypes,
    publicLocalTypes,
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
    hasMatchingClassName(filteredNamespaceLevelDecls, module.className);
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
    header,
    adapterDecls,
    specializationDecls,
    exchangeDecls,
    namespaceDecls: namespaceResult.declarations,
    staticContainerDecl,
  };

  return assembleOutput(module, parts, finalContext);
};
