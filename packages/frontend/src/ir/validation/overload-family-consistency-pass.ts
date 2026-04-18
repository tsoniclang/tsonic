import { Diagnostic, createDiagnostic } from "../../types/diagnostic.js";
import {
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrMethodDeclaration,
  IrMethodSignature,
  IrModule,
  IrParameter,
  IrType,
  getIrMemberPublicName,
  stableIrTypeKey,
  substituteIrType,
} from "../types.js";

export type OverloadFamilyConsistencyResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

const VOID_TYPE: IrType = { kind: "voidType" };

type MethodLike = IrMethodDeclaration | IrMethodSignature;

const normalizeTypeName = (type: IrType | undefined): string | undefined => {
  if (!type || type.kind !== "referenceType") {
    return undefined;
  }

  const withoutTypeArgs = type.name.split("<")[0] ?? type.name;
  const simple = withoutTypeArgs.split(".").pop() ?? withoutTypeArgs;
  return simple.trim();
};

const buildOwnerTypeSubstitution = (
  typeParameters: readonly { readonly name: string }[] | undefined,
  heritageRef: IrType | undefined
): ReadonlyMap<string, IrType> | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  if (
    !heritageRef ||
    heritageRef.kind !== "referenceType" ||
    !heritageRef.typeArguments ||
    heritageRef.typeArguments.length !== typeParameters.length
  ) {
    return undefined;
  }

  const substitution = new Map<string, IrType>();
  for (let index = 0; index < typeParameters.length; index += 1) {
    const typeParameter = typeParameters[index];
    const typeArgument = heritageRef.typeArguments[index];
    if (!typeParameter || !typeArgument) {
      return undefined;
    }
    substitution.set(typeParameter.name, typeArgument);
  }

  return substitution;
};

const buildCanonicalMethodTypeSubstitution = (
  typeParameters: readonly { readonly name: string }[] | undefined
): ReadonlyMap<string, IrType> | undefined => {
  if (!typeParameters || typeParameters.length === 0) {
    return undefined;
  }

  const substitution = new Map<string, IrType>();
  for (let index = 0; index < typeParameters.length; index += 1) {
    const typeParameter = typeParameters[index];
    if (!typeParameter) continue;
    substitution.set(typeParameter.name, {
      kind: "typeParameterType",
      name: `__method_${index}`,
    });
  }

  return substitution;
};

const canonicalizeMethodType = (
  type: IrType | undefined,
  methodTypeParameters: readonly { readonly name: string }[] | undefined,
  ownerSubstitution?: ReadonlyMap<string, IrType>
): IrType | undefined => {
  if (!type) {
    return undefined;
  }

  let current = type;
  if (ownerSubstitution && ownerSubstitution.size > 0) {
    current = substituteIrType(current, ownerSubstitution);
  }

  const methodSubstitution =
    buildCanonicalMethodTypeSubstitution(methodTypeParameters);
  if (!methodSubstitution || methodSubstitution.size === 0) {
    return current;
  }

  return substituteIrType(current, methodSubstitution);
};

const typesEqual = (
  left: IrType | undefined,
  right: IrType | undefined
): boolean => {
  if (!left || !right) {
    return left === right;
  }
  return stableIrTypeKey(left) === stableIrTypeKey(right);
};

const parametersExactlyMatch = (
  left: IrParameter,
  right: IrParameter,
  leftMethodTypeParameters: readonly { readonly name: string }[] | undefined,
  rightMethodTypeParameters: readonly { readonly name: string }[] | undefined,
  leftOwnerSubstitution?: ReadonlyMap<string, IrType>,
  rightOwnerSubstitution?: ReadonlyMap<string, IrType>
): boolean =>
  left.isOptional === right.isOptional &&
  left.isRest === right.isRest &&
  left.passing === right.passing &&
  typesEqual(
    canonicalizeMethodType(
      left.type,
      leftMethodTypeParameters,
      leftOwnerSubstitution
    ),
    canonicalizeMethodType(
      right.type,
      rightMethodTypeParameters,
      rightOwnerSubstitution
    )
  );

const methodsSignatureMatchExactly = (
  left: MethodLike,
  right: MethodLike,
  leftOwnerSubstitution?: ReadonlyMap<string, IrType>,
  rightOwnerSubstitution?: ReadonlyMap<string, IrType>
): boolean => {
  if (
    (left.typeParameters?.length ?? 0) !== (right.typeParameters?.length ?? 0)
  ) {
    return false;
  }

  if (left.parameters.length !== right.parameters.length) {
    return false;
  }

  for (let index = 0; index < left.parameters.length; index += 1) {
    const leftParameter = left.parameters[index];
    const rightParameter = right.parameters[index];
    if (!leftParameter || !rightParameter) {
      return false;
    }

    if (
      !parametersExactlyMatch(
        leftParameter,
        rightParameter,
        left.typeParameters,
        right.typeParameters,
        leftOwnerSubstitution,
        rightOwnerSubstitution
      )
    ) {
      return false;
    }
  }

  return typesEqual(
    canonicalizeMethodType(
      left.returnType ?? VOID_TYPE,
      left.typeParameters,
      leftOwnerSubstitution
    ),
    canonicalizeMethodType(
      right.returnType ?? VOID_TYPE,
      right.typeParameters,
      rightOwnerSubstitution
    )
  );
};

const collectInterfaces = (
  modules: readonly IrModule[]
): ReadonlyMap<string, IrInterfaceDeclaration> => {
  const interfaces = new Map<string, IrInterfaceDeclaration>();
  for (const module of modules) {
    for (const statement of module.body) {
      if (statement.kind === "interfaceDeclaration") {
        interfaces.set(statement.name, statement);
      }
    }
  }
  return interfaces;
};

const reportMissingOrMismatchedMethod = (
  filePath: string,
  diagnostics: Diagnostic[],
  ownerDescription: string,
  targetMember: MethodLike,
  compatibleMembers: readonly MethodLike[]
): void => {
  const targetPublicName = getIrMemberPublicName(targetMember);
  if (compatibleMembers.length === 0) {
    diagnostics.push(
      createDiagnostic(
        "TSN4005",
        "error",
        `Method '${ownerDescription}.${targetMember.name}' does not preserve required emitted CLR member '${targetPublicName}'.`,
        { file: filePath, line: 1, column: 1, length: 1 },
        `A matching signature exists only if the surviving member emits '${targetPublicName}' after overload collection.`
      )
    );
    return;
  }

  const actualNames = [
    ...new Set(compatibleMembers.map(getIrMemberPublicName)),
  ];
  diagnostics.push(
    createDiagnostic(
      "TSN4005",
      "error",
      `Overload family mismatch for '${ownerDescription}.${targetMember.name}'. Matching signatures must emit the same CLR member name '${targetPublicName}'.`,
      { file: filePath, line: 1, column: 1, length: 1 },
      `Found signature-compatible member(s) emitting ${actualNames.map((name) => `'${name}'`).join(", ")}.`
    )
  );
};

const reportAmbiguousMethodMatch = (
  filePath: string,
  diagnostics: Diagnostic[],
  ownerDescription: string,
  targetMember: MethodLike
): void => {
  diagnostics.push(
    createDiagnostic(
      "TSN4005",
      "error",
      `Method '${ownerDescription}.${targetMember.name}' matches multiple surviving members after overload collection.`,
      { file: filePath, line: 1, column: 1, length: 1 },
      `Keep the emitted CLR surface one-to-one per signature.`
    )
  );
};

const verifyClassInterfaceConsistency = (
  statement: IrClassDeclaration,
  module: IrModule,
  interfaces: ReadonlyMap<string, IrInterfaceDeclaration>,
  diagnostics: Diagnostic[]
): void => {
  const ownMethods = statement.members.filter(
    (member): member is IrMethodDeclaration =>
      member.kind === "methodDeclaration" && !member.isStatic
  );

  for (const implemented of statement.implements) {
    const interfaceName = normalizeTypeName(implemented);
    if (!interfaceName) continue;
    const iface = interfaces.get(interfaceName);
    if (!iface) continue;

    const interfaceSubstitution = buildOwnerTypeSubstitution(
      iface.typeParameters,
      implemented
    );

    for (const ifaceMember of iface.members) {
      if (ifaceMember.kind !== "methodSignature") continue;

      const compatibleMembers = ownMethods.filter((ownMember) =>
        methodsSignatureMatchExactly(
          ownMember,
          ifaceMember,
          undefined,
          interfaceSubstitution
        )
      );

      const matchingPublicNames = compatibleMembers.filter(
        (ownMember) =>
          getIrMemberPublicName(ownMember) ===
          getIrMemberPublicName(ifaceMember)
      );

      if (matchingPublicNames.length === 1) {
        continue;
      }
      if (matchingPublicNames.length > 1) {
        reportAmbiguousMethodMatch(
          module.filePath,
          diagnostics,
          statement.name,
          ifaceMember
        );
        continue;
      }

      reportMissingOrMismatchedMethod(
        module.filePath,
        diagnostics,
        statement.name,
        ifaceMember,
        compatibleMembers
      );
    }
  }
};

export const runOverloadFamilyConsistencyPass = (
  modules: readonly IrModule[]
): OverloadFamilyConsistencyResult => {
  const diagnostics: Diagnostic[] = [];
  const interfaces = collectInterfaces(modules);

  for (const module of modules) {
    for (const statement of module.body) {
      if (statement.kind !== "classDeclaration") {
        continue;
      }

      verifyClassInterfaceConsistency(
        statement,
        module,
        interfaces,
        diagnostics
      );
    }
  }

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    modules,
    diagnostics,
  };
};
