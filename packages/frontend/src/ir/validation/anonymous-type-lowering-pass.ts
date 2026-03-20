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
import type { TypeBinding as FrontendTypeBinding } from "../../program/binding-types.js";

import {
  computeShapeSignature,
  collectPubliclyReachableAnonymousTypes,
  stripUndefinedFromType,
} from "./anon-type-shape-analysis.js";

import {
  classMembersToInterfaceMembers,
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

export type AnonymousTypeLoweringOptions = {
  readonly bindings?: ReadonlyMap<string, FrontendTypeBinding>;
};

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
  const ctx: LoweringContext = {
    generatedDeclarations: shared.generatedDeclarations,
    shapeToName: shared.shapeToName,
    shapeToExistingReference: shared.shapeToExistingReference,
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

const collectAnonymousReferencesFromBindings = (
  bindings: ReadonlyMap<string, FrontendTypeBinding> | undefined,
  shapeToExistingReference: Map<string, IrReferenceType>
): void => {
  if (!bindings || bindings.size === 0) {
    return;
  }

  for (const binding of bindings.values()) {
    const simpleAlias = binding.alias.split(".").pop() ?? binding.alias;
    const simpleName = binding.name.split(".").pop() ?? binding.name;
    if (
      !simpleAlias.startsWith("__Anon_") &&
      !simpleName.startsWith("__Anon_")
    ) {
      continue;
    }
    if (binding.members.some((member) => member.kind === "method")) {
      continue;
    }

    const members = binding.members
      .filter(
        (
          member
        ): member is (typeof binding.members)[number] & { kind: "property" } =>
          member.kind === "property" && member.semanticType !== undefined
      )
      .map((member): IrInterfaceMember => {
        const semanticType = member.semanticType;
        if (!semanticType) {
          throw new Error(
            "Anonymous binding property matched without semanticType"
          );
        }

        const hasUndefinedBranch =
          semanticType.kind === "unionType" &&
          semanticType.types.some(
            (type) => type.kind === "primitiveType" && type.name === "undefined"
          );
        const isOptional =
          member.semanticOptional === true || hasUndefinedBranch;

        return {
          kind: "propertySignature",
          name: member.alias,
          type: isOptional
            ? stripUndefinedFromType(semanticType)
            : semanticType,
          isOptional,
          isReadonly: false,
        };
      });

    if (members.length === 0) {
      continue;
    }

    registerExistingAnonymousReference(
      {
        kind: "referenceType",
        name: simpleAlias.startsWith("__Anon_") ? simpleAlias : simpleName,
        resolvedClrType: binding.name,
        structuralMembers: members,
      },
      shapeToExistingReference
    );
  }
};

/**
 * Run anonymous type lowering pass on all modules
 */
export const runAnonymousTypeLoweringPass = (
  modules: readonly IrModule[],
  options?: AnonymousTypeLoweringOptions
): AnonymousTypeLoweringResult => {
  const existingTypeNames = new Set<string>();
  const shapeToExistingReference = new Map<string, IrReferenceType>();
  const existingReferenceTraversalSeen = new WeakSet<object>();
  for (const module of modules) {
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

  collectAnonymousReferencesFromBindings(
    options?.bindings,
    shapeToExistingReference
  );

  const shared = {
    generatedDeclarations: [] as IrClassDeclaration[],
    shapeToName: new Map<string, string>(),
    shapeToExistingReference,
    existingTypeNames,
    loweredTypeByIdentity: new WeakMap<object, IrType>(),
    loweredReferenceByStableKey: new Map<string, IrReferenceType>(),
  };

  const loweredModules = modules.map((m) => lowerModule(m, shared));

  // If any anonymous classes were generated, emit them once in a shared module
  // in the common root namespace so they are visible to all nested namespaces.
  if (shared.generatedDeclarations.length > 0) {
    const publicAnonymousTypes = collectPubliclyReachableAnonymousTypes(
      loweredModules,
      shared.generatedDeclarations
    );
    const commonNamespace =
      findCommonNamespacePrefix(modules.map((m) => m.namespace)) ||
      (modules[0]?.namespace ?? "");

    const anonModule: IrModule = {
      kind: "module",
      // Special synthetic module prefix: downstream CLI code uses this to skip
      // source-based augmentation steps (no corresponding .ts file exists).
      filePath: "__tsonic/__tsonic_anonymous_types.g.ts",
      namespace: commonNamespace,
      className: "__tsonic_anonymous_types",
      isStaticContainer: true,
      imports: [],
      body: shared.generatedDeclarations.map((declaration) => ({
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
