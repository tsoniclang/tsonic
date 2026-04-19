/**
 * Anonymous Object Type Lowering Pass
 *
 * Transforms anonymous object types (IrObjectType) in type positions into
 * generated named types (IrReferenceType) with synthetic interface declarations.
 *
 * This pass runs BEFORE soundness validation to ensure the emitter never
 * receives IrObjectType nodes.
 *
 * Example transformation:
 * ```
 * const config: { value: number } = { value: 42 };
 * ```
 * becomes:
 * ```
 * interface __Anon_abc123 { value: number }
 * const config: __Anon_abc123 = { value: 42 };
 * ```
 *
 * Implementation is split across sub-modules:
 * - anon-type-shape-analysis.ts: serialization, hashing, reachability
 * - anon-type-declaration-synthesis.ts: named type generation, carrier reuse
 * - anon-type-lower-types.ts: type/param/pattern lowering + LoweringContext
 * - anon-type-ir-rewriting.ts: expression/statement/member lowering
 */

import type {
  IrModule,
  IrType,
  IrInterfaceMember,
  IrReferenceType,
  IrClassDeclaration,
} from "../types.js";
import {
  computeShapeSignature,
  collectPubliclyReachableAnonymousTypes,
} from "./anon-type-shape-analysis.js";

import {
  classMembersToInterfaceMembers,
  interfaceMembersToClassMembers,
  isReusableStructuralCarrierName,
} from "./anon-type-declaration-synthesis.js";

import type { LoweringContext } from "./anon-type-lower-types.js";

import { lowerExpression, lowerStatement } from "./anon-type-ir-rewriting.js";

/**
 * Result of anonymous type lowering pass
 */
export type AnonymousTypeLoweringResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
};

const SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH =
  "__tsonic/__tsonic_anonymous_types.g.ts";

/**
 * Lower a single module
 */
const lowerModule = (
  module: IrModule,
  shared: {
    readonly generatedDeclarations: IrClassDeclaration[];
    readonly shapeToName: Map<string, string>;
    readonly shapeToExistingReference: Map<string, IrReferenceType>;
    readonly existingTypeNames: ReadonlySet<string>;
    readonly loweredTypeByIdentity: WeakMap<object, IrType>;
    readonly loweredReferenceByStableKey: Map<string, IrReferenceType>;
  }
): IrModule => {
  const localDeclaredTypeReferences =
    collectLocalDeclaredTypeReferences(module);
  const ctx: LoweringContext = {
    generatedDeclarations: shared.generatedDeclarations,
    shapeToName: shared.shapeToName,
    shapeToExistingReference: shared.shapeToExistingReference,
    localDeclaredTypeReferences,
    moduleFilePath: module.filePath,
    existingTypeNames: shared.existingTypeNames,
    loweredTypeByIdentity: shared.loweredTypeByIdentity,
    loweredReferenceByStableKey: shared.loweredReferenceByStableKey,
  };

  // Lower all statements in the module body
  const loweredBody = module.body.map((stmt) => lowerStatement(stmt, ctx));

  // Lower exports
  const loweredExports = module.exports.map((exp) => {
    if (exp.kind === "default") {
      return {
        ...exp,
        expression: lowerExpression(exp.expression, ctx),
      };
    } else if (exp.kind === "declaration") {
      return {
        ...exp,
        declaration: lowerStatement(exp.declaration, ctx),
      };
    }
    return exp;
  });

  return {
    ...module,
    body: loweredBody,
    exports: loweredExports,
  };
};

const collectLocalDeclaredTypeReferences = (
  module: IrModule
): ReadonlyMap<string, IrReferenceType> => {
  const references = new Map<string, IrReferenceType>();

  for (const stmt of module.body) {
    switch (stmt.kind) {
      case "classDeclaration":
      case "interfaceDeclaration":
      case "enumDeclaration":
        references.set(stmt.name, {
          kind: "referenceType",
          name: stmt.name,
          resolvedClrType: `${module.namespace}.${stmt.name}`,
          typeArguments:
            "typeParameters" in stmt
              ? stmt.typeParameters?.map(
                  (parameter): IrType => ({
                    kind: "typeParameterType",
                    name: parameter.name,
                  })
                )
              : undefined,
        });
        break;
    }
  }

  return references;
};

const findCommonNamespacePrefix = (namespaces: readonly string[]): string => {
  if (namespaces.length === 0) return "";
  const split = namespaces.map((ns) => ns.split("."));
  const first = split[0] ?? [];
  const minLength = Math.min(...split.map((s) => s.length));

  let commonLength = 0;
  for (let i = 0; i < minLength; i++) {
    const seg = first[i];
    if (seg && split.every((s) => s[i] === seg)) {
      commonLength = i + 1;
    } else {
      break;
    }
  }

  return first.slice(0, commonLength).join(".");
};

const isInstalledDependencyModule = (filePath: string): boolean =>
  filePath.includes("/node_modules/") || filePath.startsWith("node_modules/");

const isAnonymousReferenceType = (
  value: unknown
): value is IrReferenceType & {
  readonly structuralMembers: readonly IrInterfaceMember[];
} => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Partial<IrReferenceType> & {
    readonly kind?: unknown;
    readonly name?: unknown;
    readonly structuralMembers?: unknown;
  };

  return (
    record.kind === "referenceType" &&
    typeof record.name === "string" &&
    record.name.startsWith("__Anon_") &&
    Array.isArray(record.structuralMembers) &&
    record.structuralMembers.length > 0
  );
};

const registerExistingAnonymousReference = (
  type: IrReferenceType & {
    readonly structuralMembers: readonly IrInterfaceMember[];
  },
  shapeToExistingReference: Map<string, IrReferenceType>
): void => {
  const signature = computeShapeSignature({
    kind: "objectType",
    members: type.structuralMembers,
  });

  const resolvedClrType =
    type.resolvedClrType ?? type.typeId?.clrName ?? undefined;
  const existing = shapeToExistingReference.get(signature);
  if (
    existing &&
    existing.resolvedClrType !== undefined &&
    resolvedClrType === undefined
  ) {
    return;
  }

  shapeToExistingReference.set(signature, {
    kind: "referenceType",
    name: type.name,
    typeArguments: type.typeArguments,
    resolvedClrType,
    structuralMembers: type.structuralMembers,
  });
};

const collectExistingAnonymousReferences = (
  value: unknown,
  shapeToExistingReference: Map<string, IrReferenceType>,
  seen: WeakSet<object>
): void => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (isAnonymousReferenceType(value)) {
    registerExistingAnonymousReference(value, shapeToExistingReference);
  }

  const asRecord = value as Partial<IrReferenceType> & {
    readonly kind?: unknown;
    readonly typeArguments?: unknown;
  };
  if (asRecord.kind === "referenceType") {
    const typeArguments = Array.isArray(asRecord.typeArguments)
      ? asRecord.typeArguments
      : undefined;
    if (typeArguments) {
      for (const argument of typeArguments) {
        collectExistingAnonymousReferences(
          argument,
          shapeToExistingReference,
          seen
        );
      }
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectExistingAnonymousReferences(entry, shapeToExistingReference, seen);
    }
    return;
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    collectExistingAnonymousReferences(entry, shapeToExistingReference, seen);
  }
};

const collectAnonymousReferenceDeclarations = (
  value: unknown,
  declarationsByName: Map<string, IrClassDeclaration>,
  seen: WeakSet<object>
): void => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  if (isAnonymousReferenceType(value) && value.resolvedClrType === undefined) {
    if (!declarationsByName.has(value.name)) {
      declarationsByName.set(value.name, {
        kind: "classDeclaration",
        name: value.name,
        typeParameters:
          value.typeArguments
            ?.filter(
              (
                argument
              ): argument is Extract<IrType, { kind: "typeParameterType" }> =>
                argument.kind === "typeParameterType"
            )
            .map((argument) => ({
              kind: "typeParameter" as const,
              name: argument.name,
            })) ?? undefined,
        superClass: undefined,
        implements: [],
        members: interfaceMembersToClassMembers(value.structuralMembers),
        isExported: true,
        isStruct: false,
      });
    }
  }

  const asRecord = value as Record<string, unknown>;
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectAnonymousReferenceDeclarations(entry, declarationsByName, seen);
    }
    return;
  }

  for (const entry of Object.values(asRecord)) {
    collectAnonymousReferenceDeclarations(entry, declarationsByName, seen);
  }
};

const collectReferencedAnonymousTypeNames = (
  value: unknown,
  referencedNames: Set<string>,
  seen: WeakSet<object>,
  includeInferredTypeMetadata = false
): void => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }
  seen.add(value);

  const asReference = value as Partial<IrReferenceType> & {
    readonly kind?: unknown;
    readonly name?: unknown;
  };
  if (
    asReference.kind === "referenceType" &&
    typeof asReference.name === "string" &&
    asReference.name.startsWith("__Anon_")
  ) {
    referencedNames.add(asReference.name);
  }

  const asModule = value as Partial<IrModule> & {
    readonly kind?: unknown;
  };
  if (asModule.kind === "module") {
    for (const entry of asModule.body ?? []) {
      collectReferencedAnonymousTypeNames(
        entry,
        referencedNames,
        seen,
        includeInferredTypeMetadata
      );
    }
    for (const entry of asModule.exports ?? []) {
      collectReferencedAnonymousTypeNames(
        entry,
        referencedNames,
        seen,
        includeInferredTypeMetadata
      );
    }
    return;
  }

  const asObjectExpression = value as {
    readonly kind?: unknown;
    readonly inferredType?: unknown;
  };
  if (asObjectExpression.kind === "object") {
    collectReferencedAnonymousTypeNames(
      asObjectExpression.inferredType,
      referencedNames,
      seen,
      includeInferredTypeMetadata
    );
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectReferencedAnonymousTypeNames(
        entry,
        referencedNames,
        seen,
        includeInferredTypeMetadata
      );
    }
    return;
  }

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (
      key === "inferredType" &&
      !includeInferredTypeMetadata &&
      !shouldTraverseInferredTypeMetadata(value, entry)
    ) {
      continue;
    }
    collectReferencedAnonymousTypeNames(
      entry,
      referencedNames,
      seen,
      includeInferredTypeMetadata
    );
  }
};

const shouldTraverseInferredTypeMetadata = (
  owner: unknown,
  inferredType: unknown
): boolean => {
  if (!containsAnonymousReferenceType(inferredType, new WeakSet<object>())) {
    return false;
  }

  if (!owner || typeof owner !== "object") {
    return true;
  }

  const record = owner as {
    readonly kind?: unknown;
    readonly importedFrom?: unknown;
    readonly resolvedClrType?: unknown;
    readonly resolvedAssembly?: unknown;
    readonly originalName?: unknown;
  };

  if (
    record.kind === "identifier" &&
    (record.importedFrom !== undefined ||
      record.resolvedClrType !== undefined ||
      record.resolvedAssembly !== undefined ||
      (typeof record.originalName === "string" &&
        record.originalName.startsWith('"') &&
        record.originalName.endsWith('"')))
  ) {
    return false;
  }

  return true;
};

const containsAnonymousReferenceType = (
  value: unknown,
  seen: WeakSet<object>
): boolean => {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (isAnonymousReferenceType(value)) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((entry) => containsAnonymousReferenceType(entry, seen));
  }

  return Object.values(value as Record<string, unknown>).some((entry) =>
    containsAnonymousReferenceType(entry, seen)
  );
};

const collectPriorSyntheticAnonymousDeclarations = (
  modules: readonly IrModule[]
): readonly IrClassDeclaration[] =>
  modules
    .filter((module) => module.filePath === SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH)
    .flatMap((module) =>
      module.body.filter(
        (statement): statement is IrClassDeclaration =>
          statement.kind === "classDeclaration" &&
          statement.name.startsWith("__Anon_")
      )
    );

/**
 * Run anonymous type lowering pass on all modules
 */
export const runAnonymousTypeLoweringPass = (
  modules: readonly IrModule[]
): AnonymousTypeLoweringResult => {
  const priorSyntheticAnonymousDeclarations =
    collectPriorSyntheticAnonymousDeclarations(modules);
  const inputModules = modules.filter(
    (module) => module.filePath !== SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH
  );
  const existingTypeNames = new Set<string>();
  const shapeToExistingReference = new Map<string, IrReferenceType>();
  const existingReferenceTraversalSeen = new WeakSet<object>();
  for (const module of inputModules) {
    for (const stmt of module.body) {
      switch (stmt.kind) {
        case "classDeclaration":
          if (isReusableStructuralCarrierName(stmt.name)) {
            const members = classMembersToInterfaceMembers(stmt.members);
            if (members.length > 0) {
              registerExistingAnonymousReference(
                {
                  kind: "referenceType",
                  name: stmt.name,
                  typeArguments:
                    stmt.typeParameters?.map(
                      (parameter): IrType => ({
                        kind: "typeParameterType",
                        name: parameter.name,
                      })
                    ) ?? undefined,
                  resolvedClrType: `${module.namespace}.${stmt.name}`,
                  structuralMembers: members,
                },
                shapeToExistingReference
              );
            }
          }
          existingTypeNames.add(stmt.name);
          break;
        case "interfaceDeclaration":
          if (isReusableStructuralCarrierName(stmt.name)) {
            registerExistingAnonymousReference(
              {
                kind: "referenceType",
                name: stmt.name,
                typeArguments:
                  stmt.typeParameters?.map(
                    (parameter): IrType => ({
                      kind: "typeParameterType",
                      name: parameter.name,
                    })
                  ) ?? undefined,
                resolvedClrType: `${module.namespace}.${stmt.name}`,
                structuralMembers: stmt.members,
              },
              shapeToExistingReference
            );
          }
          existingTypeNames.add(stmt.name);
          break;
        case "enumDeclaration":
        case "typeAliasDeclaration":
          existingTypeNames.add(stmt.name);
          break;
      }
    }

    collectExistingAnonymousReferences(
      module,
      shapeToExistingReference,
      existingReferenceTraversalSeen
    );
  }

  const shared = {
    generatedDeclarations: [] as IrClassDeclaration[],
    shapeToName: new Map<string, string>(),
    shapeToExistingReference,
    existingTypeNames,
    loweredTypeByIdentity: new WeakMap<object, IrType>(),
    loweredReferenceByStableKey: new Map<string, IrReferenceType>(),
  };

  const loweredModules = inputModules.map((m) => lowerModule(m, shared));
  const recoveredAnonymousDeclarations = new Map<string, IrClassDeclaration>();
  const recoveredDeclarationTraversalSeen = new WeakSet<object>();
  for (const module of loweredModules) {
    collectAnonymousReferenceDeclarations(
      module,
      recoveredAnonymousDeclarations,
      recoveredDeclarationTraversalSeen
    );
  }
  for (const declaration of priorSyntheticAnonymousDeclarations) {
    recoveredAnonymousDeclarations.set(declaration.name, declaration);
  }
  for (const declaration of shared.generatedDeclarations) {
    recoveredAnonymousDeclarations.set(declaration.name, declaration);
  }
  const allAnonymousDeclarations = Array.from(
    recoveredAnonymousDeclarations.values()
  );
  const referencedAnonymousNames = new Set<string>();
  const referencedNameTraversalSeen = new WeakSet<object>();
  for (const module of loweredModules) {
    collectReferencedAnonymousTypeNames(
      module,
      referencedAnonymousNames,
      referencedNameTraversalSeen,
      false
    );
  }
  const anonymousDeclarationByName = new Map(
    allAnonymousDeclarations.map((declaration) => [
      declaration.name,
      declaration,
    ])
  );
  const declarationQueue = Array.from(referencedAnonymousNames);
  while (declarationQueue.length > 0) {
    const name = declarationQueue.shift();
    if (!name) {
      continue;
    }
    const declaration = anonymousDeclarationByName.get(name);
    if (!declaration) {
      continue;
    }
    const nestedNames = new Set<string>();
    collectReferencedAnonymousTypeNames(
      declaration,
      nestedNames,
      new WeakSet<object>(),
      true
    );
    for (const nestedName of nestedNames) {
      if (referencedAnonymousNames.has(nestedName)) {
        continue;
      }
      referencedAnonymousNames.add(nestedName);
      declarationQueue.push(nestedName);
    }
  }
  const emittedAnonymousDeclarations = allAnonymousDeclarations.filter(
    (declaration) => referencedAnonymousNames.has(declaration.name)
  );

  // If any anonymous classes were generated, emit them once in a shared module
  // in the common root namespace so they are visible to all nested namespaces.
  if (emittedAnonymousDeclarations.length > 0) {
    const publicAnonymousTypes = collectPubliclyReachableAnonymousTypes(
      loweredModules,
      emittedAnonymousDeclarations
    );
    const authoredModules = inputModules.filter(
      (module) => !isInstalledDependencyModule(module.filePath)
    );
    const namespaceSeedModules =
      authoredModules.length > 0 ? authoredModules : inputModules;
    const commonNamespace = findCommonNamespacePrefix(
      namespaceSeedModules.map((module) => module.namespace)
    );

    const anonModule: IrModule = {
      kind: "module",
      // Special synthetic module prefix: downstream CLI code uses this to skip
      // source-based augmentation steps (no corresponding .ts file exists).
      filePath: SYNTHETIC_ANONYMOUS_TYPES_FILE_PATH,
      namespace: commonNamespace,
      className: "__tsonic_anonymous_types",
      isStaticContainer: true,
      imports: [],
      body: emittedAnonymousDeclarations.map((declaration) => ({
        ...declaration,
        isExported: publicAnonymousTypes.has(declaration.name),
      })),
      exports: [],
    };

    return {
      ok: true,
      modules: [anonModule, ...loweredModules],
    };
  }

  return {
    ok: true,
    modules: loweredModules,
  };
};
