/**
 * Overload Collection Pass
 *
 * Detects compiler-only overload marker calls, binds real bodies to erased
 * overload stubs, removes marker statements and stub declarations, and
 * attaches overload-family metadata to the surviving emitted bodies.
 */

import {
  Diagnostic,
  SourceLocation,
  createDiagnostic,
} from "../../types/diagnostic.js";
import {
  IrArrowFunctionExpression,
  IrCallExpression,
  IrClassDeclaration,
  IrExpression,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrModule,
  IrParameter,
  IrStatement,
  IrType,
  irTypesEqual,
  substituteIrType,
} from "../types.js";
import { buildPublicOverloadFamilyMember } from "../converters/statements/declarations/overload-family-builders.js";

export type OverloadCollectionResult = {
  readonly ok: boolean;
  readonly modules: readonly IrModule[];
  readonly diagnostics: readonly Diagnostic[];
};

const OVERLOADS_IMPORT_SPECIFIER = "@tsonic/core/lang.js";
const VOID_TYPE: IrType = { kind: "voidType" };

type ParseResult<T> =
  | { readonly kind: "notMatch" }
  | { readonly kind: "ok"; readonly value: T }
  | { readonly kind: "error"; readonly diagnostic: Diagnostic };

type OverloadMarker =
  | {
      readonly kind: "function";
      readonly targetName: string;
      readonly familyName: string;
      readonly sourceSpan?: SourceLocation;
    }
  | {
      readonly kind: "method";
      readonly ownerName: string;
      readonly targetMemberName: string;
      readonly familyName: string;
      readonly sourceSpan?: SourceLocation;
    };

type FunctionEntry = {
  readonly index: number;
  readonly declaration: IrFunctionDeclaration;
};

type ClassMethodEntry = {
  readonly memberIndex: number;
  readonly declaration: IrMethodDeclaration;
};

type FunctionFamilyState = {
  readonly familyName: string;
  readonly publicSignatures: readonly FunctionEntry[];
  readonly implementationStub: FunctionEntry;
  readonly removedIndices: readonly number[];
  readonly matchedTargetsBySignature: Map<number, number>;
};

type MethodFamilyState = {
  readonly classIndex: number;
  readonly familyName: string;
  readonly publicSignatures: readonly ClassMethodEntry[];
  readonly implementationStub: ClassMethodEntry;
  readonly removedMemberIndices: readonly number[];
  readonly matchedTargetsBySignature: Map<number, number>;
};

type FunctionUpdate = {
  readonly overloadFamily: NonNullable<IrFunctionDeclaration["overloadFamily"]>;
  readonly isExported: boolean;
};

type MethodUpdate = {
  readonly overloadFamily: NonNullable<IrMethodDeclaration["overloadFamily"]>;
  readonly accessibility: IrMethodDeclaration["accessibility"];
  readonly isOverride?: boolean;
};

type CollectedOverloads = {
  readonly removedStatementIndices: ReadonlySet<number>;
  readonly classMemberRemovals: ReadonlyMap<number, ReadonlySet<number>>;
  readonly functionUpdates: ReadonlyMap<number, FunctionUpdate>;
  readonly classMethodUpdates: ReadonlyMap<
    number,
    ReadonlyMap<number, MethodUpdate>
  >;
};

const createLocation = (
  filePath: string,
  sourceSpan?: SourceLocation
): SourceLocation =>
  sourceSpan ?? { file: filePath, line: 1, column: 1, length: 1 };

const getOverloadsApiLocalNames = (module: IrModule): ReadonlySet<string> => {
  const names = new Set<string>();
  for (const imp of module.imports) {
    if (imp.source !== OVERLOADS_IMPORT_SPECIFIER) continue;
    for (const spec of imp.specifiers) {
      if (spec.kind !== "named") continue;
      if (spec.name !== "overloads") continue;
      names.add(spec.localName);
    }
  }
  return names;
};

const isOverloadsApiIdentifier = (
  expr: IrExpression,
  apiNames: ReadonlySet<string>
): expr is Extract<IrExpression, { kind: "identifier" }> =>
  expr.kind === "identifier" && apiNames.has(expr.name);

const unwrapTransparentSelectorExpression = (
  expr: IrExpression
): IrExpression => {
  let current = expr;
  while (true) {
    switch (current.kind) {
      case "typeAssertion":
      case "numericNarrowing":
      case "asinterface":
      case "trycast":
        current = current.expression;
        continue;
      default:
        return current;
    }
  }
};

const parseSelectorMemberName = (
  selector: IrExpression,
  module: IrModule,
  messagePrefix: string
): ParseResult<string> => {
  const expr = unwrapTransparentSelectorExpression(selector);
  if (expr.kind !== "arrowFunction") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `${messagePrefix} expected an arrow selector like x => x.member.`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  const arrow = expr as IrArrowFunctionExpression;
  if (arrow.body.kind === "blockStatement") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `${messagePrefix} selector must be a direct member access like x => x.member.`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  if (arrow.parameters.length !== 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `${messagePrefix} expected exactly 1 selector parameter.`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  const parameter = arrow.parameters[0];
  if (!parameter || parameter.pattern.kind !== "identifierPattern") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `${messagePrefix} selector parameter must be an identifier.`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  const body = unwrapTransparentSelectorExpression(arrow.body);
  if (body.kind !== "memberAccess") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `${messagePrefix} selector must be a direct member access like x => x.member.`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  if (
    body.object.kind !== "identifier" ||
    body.object.name !== parameter.pattern.name ||
    body.isComputed ||
    typeof body.property !== "string"
  ) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `${messagePrefix} selector must be a direct member access like x => x.member.`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }

  return { kind: "ok", value: body.property };
};

const parseFunctionFamilyTarget = (
  selector: IrExpression,
  module: IrModule
): ParseResult<string> => {
  if (selector.kind !== "identifier") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: function families must target a function identifier like .family(Parse).`,
        createLocation(module.filePath, selector.sourceSpan)
      ),
    };
  }
  return { kind: "ok", value: selector.name };
};

const parseRootCall = (
  expr: IrExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>
): ParseResult<
  | { readonly kind: "type"; readonly name: string }
  | { readonly kind: "function"; readonly name: string }
> => {
  if (expr.kind !== "call") return { kind: "notMatch" };
  const call = expr as IrCallExpression;
  if (!isOverloadsApiIdentifier(call.callee, apiNames)) {
    return { kind: "notMatch" };
  }

  if (call.typeArguments && call.typeArguments.length > 0) {
    if (call.arguments.length !== 0) {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid overload marker: O<T>() does not accept runtime arguments.`,
          createLocation(module.filePath, call.sourceSpan)
        ),
      };
    }
    if (call.typeArguments.length !== 1) {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid overload marker: O<T>() expects exactly 1 type argument.`,
          createLocation(module.filePath, call.sourceSpan)
        ),
      };
    }
    const targetType = call.typeArguments[0];
    if (!targetType || targetType.kind !== "referenceType") {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid overload marker: O<T>() expects a named class target.`,
          createLocation(module.filePath, call.sourceSpan)
        ),
      };
    }
    return {
      kind: "ok",
      value: {
        kind: "type",
        name: targetType.name,
      },
    };
  }

  if (call.arguments.length !== 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: O(fn) expects exactly 1 function argument, or use O<T>() for methods.`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const arg0 = call.arguments[0];
  if (!arg0 || arg0.kind === "spread") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: O(fn) does not accept spread arguments.`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  if (arg0.kind !== "identifier") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: O(fn) target must be a function identifier.`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  return {
    kind: "ok",
    value: {
      kind: "function",
      name: arg0.name,
    },
  };
};

const looksLikeOverloadsApiUsage = (
  expr: IrExpression,
  apiNames: ReadonlySet<string>
): boolean => {
  switch (expr.kind) {
    case "call":
      return (
        isOverloadsApiIdentifier(expr.callee, apiNames) ||
        looksLikeOverloadsApiUsage(expr.callee, apiNames) ||
        expr.arguments.some(
          (arg) =>
            arg.kind !== "spread" && looksLikeOverloadsApiUsage(arg, apiNames)
        )
      );
    case "memberAccess":
      return looksLikeOverloadsApiUsage(expr.object, apiNames);
    case "arrowFunction":
      return expr.body.kind === "blockStatement"
        ? expr.body.statements.some(
            (statement) =>
              statement.kind === "expressionStatement" &&
              looksLikeOverloadsApiUsage(statement.expression, apiNames)
          )
        : looksLikeOverloadsApiUsage(expr.body, apiNames);
    case "array":
      return expr.elements.some(
        (element) =>
          element !== undefined &&
          element.kind !== "spread" &&
          looksLikeOverloadsApiUsage(element, apiNames)
      );
    case "object":
      return expr.properties.some((property) => {
        if (property.kind === "spread") {
          return looksLikeOverloadsApiUsage(property.expression, apiNames);
        }
        return looksLikeOverloadsApiUsage(property.value, apiNames);
      });
    default:
      return false;
  }
};

const tryDetectOverloadMarker = (
  call: IrCallExpression,
  module: IrModule,
  apiNames: ReadonlySet<string>
): ParseResult<OverloadMarker> => {
  if (call.callee.kind !== "memberAccess") return { kind: "notMatch" };
  const familyMember = call.callee;
  if (
    familyMember.isComputed ||
    typeof familyMember.property !== "string" ||
    familyMember.property !== "family"
  ) {
    return { kind: "notMatch" };
  }

  if (call.arguments.length !== 1) {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: .family(...) expects exactly 1 argument.`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const familyArg = call.arguments[0];
  if (!familyArg || familyArg.kind === "spread") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: .family(...) does not accept spread arguments.`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const targetRoot = familyMember.object;
  if (targetRoot.kind !== "call") {
    return { kind: "notMatch" };
  }

  const methodCall = targetRoot;
  if (
    methodCall.callee.kind === "memberAccess" &&
    !methodCall.callee.isComputed &&
    methodCall.callee.property === "method"
  ) {
    if (methodCall.arguments.length !== 1) {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid overload marker: .method(selector) expects exactly 1 argument.`,
          createLocation(module.filePath, methodCall.sourceSpan)
        ),
      };
    }
    const selectorArg = methodCall.arguments[0];
    if (!selectorArg || selectorArg.kind === "spread") {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid overload marker: .method(selector) does not accept spread arguments.`,
          createLocation(module.filePath, methodCall.sourceSpan)
        ),
      };
    }

    const methodTarget = parseSelectorMemberName(
      selectorArg,
      module,
      "Invalid overload marker:"
    );
    if (methodTarget.kind !== "ok") return methodTarget;

    const familyTarget = parseSelectorMemberName(
      familyArg,
      module,
      "Invalid overload marker:"
    );
    if (familyTarget.kind !== "ok") return familyTarget;

    const root = parseRootCall(methodCall.callee.object, module, apiNames);
    if (root.kind !== "ok") return root;
    if (root.value.kind !== "type") {
      return {
        kind: "error",
        diagnostic: createDiagnostic(
          "TSN4005",
          "error",
          `Invalid overload marker: .method(...).family(...) requires a class target root O<T>().`,
          createLocation(module.filePath, methodCall.sourceSpan)
        ),
      };
    }

    return {
      kind: "ok",
      value: {
        kind: "method",
        ownerName: root.value.name,
        targetMemberName: methodTarget.value,
        familyName: familyTarget.value,
        sourceSpan: call.sourceSpan,
      },
    };
  }

  const root = parseRootCall(targetRoot, module, apiNames);
  if (root.kind !== "ok") return root;
  if (root.value.kind !== "function") {
    return {
      kind: "error",
      diagnostic: createDiagnostic(
        "TSN4005",
        "error",
        `Invalid overload marker: direct .family(...) is only supported for free functions via O(fn).family(Parse).`,
        createLocation(module.filePath, call.sourceSpan)
      ),
    };
  }

  const familyTarget = parseFunctionFamilyTarget(familyArg, module);
  if (familyTarget.kind !== "ok") return familyTarget;

  return {
    kind: "ok",
    value: {
      kind: "function",
      targetName: root.value.name,
      familyName: familyTarget.value,
      sourceSpan: call.sourceSpan,
    },
  };
};

const buildCanonicalTypeSubstitution = (
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

const canonicalizeCallableType = (
  type: IrType | undefined,
  typeParameters: readonly { readonly name: string }[] | undefined
): IrType | undefined => {
  const substitution = buildCanonicalTypeSubstitution(typeParameters);
  if (!type || !substitution || substitution.size === 0) {
    return type;
  }
  return substituteIrType(type, substitution);
};

const belongsToCurrentProject = (
  type: Extract<IrType, { kind: "referenceType" }>,
  projectAssemblyName: string
): boolean =>
  type.typeId?.assemblyName === projectAssemblyName ||
  (!type.typeId &&
    !!type.resolvedClrType &&
    type.resolvedClrType.startsWith(`${projectAssemblyName}.`)) ||
  (!type.typeId && !type.resolvedClrType);

const normalizeComparableInterfaceMember = (
  member: Extract<
    NonNullable<Extract<IrType, { kind: "objectType" }>["members"]>[number],
    { kind: "propertySignature" } | { kind: "methodSignature" }
  >,
  projectAssemblyName: string,
  activeTypes: ReadonlySet<IrType>
): typeof member => {
  if (member.kind === "propertySignature") {
    return {
      ...member,
      type: normalizeComparableType(
        member.type,
        projectAssemblyName,
        activeTypes
      ),
    };
  }

  return {
    ...member,
    parameters: member.parameters.map((parameter) => ({
      ...parameter,
      type: parameter.type
        ? normalizeComparableType(
            parameter.type,
            projectAssemblyName,
            activeTypes
          )
        : parameter.type,
    })),
    returnType: member.returnType
      ? normalizeComparableType(
          member.returnType,
          projectAssemblyName,
          activeTypes
        )
      : member.returnType,
  };
};

const normalizeComparableType = (
  type: IrType,
  projectAssemblyName: string,
  activeTypes: ReadonlySet<IrType> = new Set()
): IrType => {
  if (activeTypes.has(type)) {
    return type;
  }

  const nextActiveTypes = new Set(activeTypes);
  nextActiveTypes.add(type);

  switch (type.kind) {
    case "primitiveType":
    case "literalType":
    case "typeParameterType":
    case "anyType":
    case "unknownType":
    case "voidType":
    case "neverType":
      return type;

    case "arrayType":
      return {
        ...type,
        elementType: normalizeComparableType(
          type.elementType,
          projectAssemblyName,
          nextActiveTypes
        ),
        tuplePrefixElementTypes: type.tuplePrefixElementTypes?.map(
          (elementType) =>
            normalizeComparableType(
              elementType,
              projectAssemblyName,
              nextActiveTypes
            )
        ),
        tupleRestElementType: type.tupleRestElementType
          ? normalizeComparableType(
              type.tupleRestElementType,
              projectAssemblyName,
              nextActiveTypes
            )
          : type.tupleRestElementType,
      };

    case "tupleType":
      return {
        ...type,
        elementTypes: type.elementTypes.map((elementType) =>
          normalizeComparableType(
            elementType,
            projectAssemblyName,
            nextActiveTypes
          )
        ),
      };

    case "dictionaryType":
      return {
        ...type,
        keyType: normalizeComparableType(
          type.keyType,
          projectAssemblyName,
          nextActiveTypes
        ),
        valueType: normalizeComparableType(
          type.valueType,
          projectAssemblyName,
          nextActiveTypes
        ),
      };

    case "functionType":
      return {
        ...type,
        parameters: type.parameters.map((parameter) => ({
          ...parameter,
          type: parameter.type
            ? normalizeComparableType(
                parameter.type,
                projectAssemblyName,
                nextActiveTypes
              )
            : parameter.type,
        })),
        returnType: normalizeComparableType(
          type.returnType,
          projectAssemblyName,
          nextActiveTypes
        ),
      };

    case "objectType":
      return {
        kind: "objectType",
        members: type.members.map((member) =>
          normalizeComparableInterfaceMember(
            member,
            projectAssemblyName,
            nextActiveTypes
          )
        ),
      };

    case "referenceType": {
      const normalizedArguments = type.typeArguments?.map((typeArgument) =>
        normalizeComparableType(
          typeArgument,
          projectAssemblyName,
          nextActiveTypes
        )
      );
      const normalizedMembers = type.structuralMembers?.map((member) =>
        normalizeComparableInterfaceMember(
          member,
          projectAssemblyName,
          nextActiveTypes
        )
      );

      if (
        normalizedMembers &&
        normalizedMembers.length > 0 &&
        belongsToCurrentProject(type, projectAssemblyName)
      ) {
        return {
          kind: "objectType",
          members: normalizedMembers,
        };
      }

      return {
        ...type,
        typeArguments: normalizedArguments,
        structuralMembers: normalizedMembers,
        ...(normalizedMembers && normalizedMembers.length > 0
          ? { structuralOrigin: type.structuralOrigin ?? "namedReference" }
          : {}),
      };
    }

    case "unionType":
      return {
        ...type,
        types: type.types.map((member) =>
          normalizeComparableType(member, projectAssemblyName, nextActiveTypes)
        ),
      };

    case "intersectionType":
      return {
        ...type,
        types: type.types.map((member) =>
          normalizeComparableType(member, projectAssemblyName, nextActiveTypes)
        ),
      };
  }
};

type CallableLike = {
  readonly typeParameters?: readonly { readonly name: string }[];
  readonly parameters: readonly IrParameter[];
  readonly returnType?: IrType;
};

const parametersMatchExactly = (
  left: readonly IrParameter[],
  leftTypeParameters: CallableLike["typeParameters"],
  right: readonly IrParameter[],
  rightTypeParameters: CallableLike["typeParameters"],
  projectAssemblyName: string
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftParam = left[index];
    const rightParam = right[index];
    if (!leftParam || !rightParam) {
      return false;
    }

    if (
      leftParam.isOptional !== rightParam.isOptional ||
      leftParam.isRest !== rightParam.isRest ||
      leftParam.passing !== rightParam.passing
    ) {
      return false;
    }

    const leftType = canonicalizeCallableType(
      leftParam.type,
      leftTypeParameters
    );
    const rightType = canonicalizeCallableType(
      rightParam.type,
      rightTypeParameters
    );

    const normalizedLeftType = leftType
      ? normalizeComparableType(leftType, projectAssemblyName)
      : undefined;
    const normalizedRightType = rightType
      ? normalizeComparableType(rightType, projectAssemblyName)
      : undefined;

    if (!normalizedLeftType || !normalizedRightType) {
      if (normalizedLeftType !== normalizedRightType) {
        return false;
      }
      continue;
    }

    if (!irTypesEqual(normalizedLeftType, normalizedRightType)) {
      return false;
    }
  }

  return true;
};

const callableMatchesExactly = (
  left: CallableLike,
  right: CallableLike,
  projectAssemblyName: string
): boolean => {
  const leftTypeParameters = left.typeParameters;
  const rightTypeParameters = right.typeParameters;
  if (
    (leftTypeParameters?.length ?? 0) !== (rightTypeParameters?.length ?? 0)
  ) {
    return false;
  }

  if (
    !parametersMatchExactly(
      left.parameters,
      leftTypeParameters,
      right.parameters,
      rightTypeParameters,
      projectAssemblyName
    )
  ) {
    return false;
  }

  const leftReturn = canonicalizeCallableType(
    left.returnType ?? VOID_TYPE,
    leftTypeParameters
  );
  const rightReturn = canonicalizeCallableType(
    right.returnType ?? VOID_TYPE,
    rightTypeParameters
  );
  return irTypesEqual(
    normalizeComparableType(leftReturn ?? VOID_TYPE, projectAssemblyName),
    normalizeComparableType(rightReturn ?? VOID_TYPE, projectAssemblyName)
  );
};

const collectFunctionEntriesByName = (
  module: IrModule
): ReadonlyMap<string, readonly FunctionEntry[]> => {
  const entries = new Map<string, FunctionEntry[]>();
  module.body.forEach((statement, index) => {
    if (statement.kind !== "functionDeclaration") return;
    const bucket = entries.get(statement.name) ?? [];
    bucket.push({ index, declaration: statement });
    entries.set(statement.name, bucket);
  });
  return entries;
};

const collectClassEntriesByName = (
  module: IrModule
): ReadonlyMap<
  string,
  { readonly index: number; readonly declaration: IrClassDeclaration }
> => {
  const entries = new Map<
    string,
    { readonly index: number; readonly declaration: IrClassDeclaration }
  >();
  module.body.forEach((statement, index) => {
    if (statement.kind !== "classDeclaration") return;
    entries.set(statement.name, { index, declaration: statement });
  });
  return entries;
};

const getOrCreateFunctionFamilyState = (
  marker: Extract<OverloadMarker, { kind: "function" }>,
  module: IrModule,
  functionEntriesByName: ReadonlyMap<string, readonly FunctionEntry[]>,
  diagnostics: Diagnostic[]
): FunctionFamilyState | undefined => {
  const familyEntries = functionEntriesByName.get(marker.familyName);
  if (!familyEntries || familyEntries.length < 2) {
    diagnostics.push(
      createDiagnostic(
        "TSN2004",
        "error",
        `Overload stub '${marker.familyName}' must be declared with at least one overload signature plus one implementation body.`,
        createLocation(module.filePath, marker.sourceSpan)
      )
    );
    return undefined;
  }

  const publicSignatures = familyEntries.filter(
    (entry) => entry.declaration.isDeclarationOnly === true
  );
  const implementationEntries = familyEntries.filter(
    (entry) => entry.declaration.isDeclarationOnly !== true
  );

  if (publicSignatures.length === 0 || implementationEntries.length !== 1) {
    diagnostics.push(
      createDiagnostic(
        "TSN2004",
        "error",
        `Overload stub '${marker.familyName}' must contain one implementation signature and one or more declaration-only overload signatures.`,
        createLocation(module.filePath, marker.sourceSpan)
      )
    );
    return undefined;
  }

  const [implementationStub] = implementationEntries;
  if (!implementationStub) {
    return undefined;
  }
  return {
    familyName: marker.familyName,
    publicSignatures,
    implementationStub,
    removedIndices: familyEntries.map((entry) => entry.index),
    matchedTargetsBySignature: new Map<number, number>(),
  };
};

const getOrCreateMethodFamilyState = (
  marker: Extract<OverloadMarker, { kind: "method" }>,
  module: IrModule,
  classIndex: number,
  classDeclaration: IrClassDeclaration,
  expectedStatic: boolean,
  diagnostics: Diagnostic[]
): MethodFamilyState | undefined => {
  const familyEntries: ClassMethodEntry[] = [];
  for (
    let memberIndex = 0;
    memberIndex < classDeclaration.members.length;
    memberIndex += 1
  ) {
    const member = classDeclaration.members[memberIndex];
    if (!member || member.kind !== "methodDeclaration") continue;
    if (member.name !== marker.familyName) continue;
    if (member.isStatic !== expectedStatic) continue;
    familyEntries.push({ memberIndex, declaration: member });
  }

  if (familyEntries.length < 2) {
    diagnostics.push(
      createDiagnostic(
        "TSN2004",
        "error",
        `Overload stub '${classDeclaration.name}.${marker.familyName}' must be declared with at least one overload signature plus one implementation body.`,
        createLocation(module.filePath, marker.sourceSpan)
      )
    );
    return undefined;
  }

  const publicSignatures = familyEntries.filter(
    (entry) => entry.declaration.body === undefined
  );
  const implementationEntries = familyEntries.filter(
    (entry) => entry.declaration.body !== undefined
  );

  if (publicSignatures.length === 0 || implementationEntries.length !== 1) {
    diagnostics.push(
      createDiagnostic(
        "TSN2004",
        "error",
        `Overload stub '${classDeclaration.name}.${marker.familyName}' must contain one implementation signature and one or more declaration-only overload signatures.`,
        createLocation(module.filePath, marker.sourceSpan)
      )
    );
    return undefined;
  }

  const [implementationStub] = implementationEntries;
  if (!implementationStub) {
    return undefined;
  }
  return {
    classIndex,
    familyName: marker.familyName,
    publicSignatures,
    implementationStub,
    removedMemberIndices: familyEntries.map((entry) => entry.memberIndex),
    matchedTargetsBySignature: new Map<number, number>(),
  };
};

const findUniqueRealMethodTarget = (
  classDeclaration: IrClassDeclaration,
  targetMemberName: string
): ClassMethodEntry | "missing" | "ambiguous" => {
  const matches: ClassMethodEntry[] = [];
  for (
    let memberIndex = 0;
    memberIndex < classDeclaration.members.length;
    memberIndex += 1
  ) {
    const member = classDeclaration.members[memberIndex];
    if (!member || member.kind !== "methodDeclaration") continue;
    if (member.name !== targetMemberName) continue;
    matches.push({ memberIndex, declaration: member });
  }

  if (matches.length === 0) return "missing";
  if (matches.length > 1) return "ambiguous";
  const [match] = matches;
  return match ?? "missing";
};

const validateFunctionLegacyOverloads = (
  module: IrModule,
  consumedFamilyNames: ReadonlySet<string>,
  diagnostics: Diagnostic[]
): void => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const statement of module.body) {
    if (statement.kind !== "functionDeclaration") continue;
    if (seen.has(statement.name)) {
      duplicates.add(statement.name);
    } else {
      seen.add(statement.name);
    }
  }

  for (const name of duplicates) {
    if (consumedFamilyNames.has(name)) continue;
    diagnostics.push(
      createDiagnostic(
        "TSN2004",
        "error",
        `Legacy TypeScript overload syntax is not supported for top-level function '${name}'. Declare a stub overload surface under '${name}' and bind real bodies with O(fn).family(${name}).`,
        { file: module.filePath, line: 1, column: 1, length: 1 }
      )
    );
  }
};

const validateClassLegacyOverloads = (
  module: IrModule,
  consumedMethodFamilies: ReadonlyMap<number, ReadonlySet<string>>,
  diagnostics: Diagnostic[]
): void => {
  for (const statement of module.body) {
    if (statement.kind !== "classDeclaration") continue;

    let constructorCount = 0;
    const methodCounts = new Map<string, number>();
    const consumedNames =
      consumedMethodFamilies.get(
        module.body.findIndex((candidate) => candidate === statement)
      ) ?? new Set<string>();

    for (const member of statement.members) {
      if (member.kind === "constructorDeclaration") {
        constructorCount += 1;
        continue;
      }
      if (member.kind !== "methodDeclaration") continue;
      const key = `${member.isStatic ? "static" : "instance"}:${member.name}`;
      methodCounts.set(key, (methodCounts.get(key) ?? 0) + 1);
    }

    if (constructorCount > 1) {
      diagnostics.push(
        createDiagnostic(
          "TSN2004",
          "error",
          `Legacy TypeScript constructor overload syntax is not supported on '${statement.name}'. Redesign the constructor surface directly.`,
          { file: module.filePath, line: 1, column: 1, length: 1 }
        )
      );
    }

    for (const [key, count] of methodCounts) {
      if (count < 2) continue;
      const memberName = key.split(":")[1] ?? key;
      if (consumedNames.has(key)) continue;
      diagnostics.push(
        createDiagnostic(
          "TSN2004",
          "error",
          `Legacy TypeScript method overload syntax is not supported on '${statement.name}.${memberName}'. Declare a stub overload surface under '${memberName}' and bind real bodies with O<${statement.name}>().method(x => x.realBody).family(x => x.${memberName}).`,
          { file: module.filePath, line: 1, column: 1, length: 1 }
        )
      );
    }
  }
};

const collectModuleOverloads = (
  module: IrModule,
  diagnostics: Diagnostic[]
): CollectedOverloads | undefined => {
  const projectAssemblyName =
    module.namespace.split(".")[0] ?? module.namespace;
  const apiNames = getOverloadsApiLocalNames(module);

  const removedStatementIndices = new Set<number>();
  const markers: OverloadMarker[] = [];

  if (apiNames.size > 0) {
    module.body.forEach((statement, index) => {
      if (statement.kind !== "expressionStatement") return;
      const expr = statement.expression;
      if (expr.kind !== "call") return;

      const marker = tryDetectOverloadMarker(expr, module, apiNames);
      if (marker.kind === "ok") {
        markers.push(marker.value);
        removedStatementIndices.add(index);
        return;
      }
      if (marker.kind === "error") {
        diagnostics.push(marker.diagnostic);
        removedStatementIndices.add(index);
        return;
      }

      if (looksLikeOverloadsApiUsage(expr, apiNames)) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Invalid overload marker call. Expected O<T>().method(x => x.realBody).family(x => x.PublicName) or O(realFunction).family(PublicName).`,
            createLocation(module.filePath, expr.sourceSpan)
          )
        );
        removedStatementIndices.add(index);
      }
    });
  }

  const functionEntriesByName = collectFunctionEntriesByName(module);
  const classEntriesByName = collectClassEntriesByName(module);
  const functionFamilyStates = new Map<string, FunctionFamilyState>();
  const methodFamilyStates = new Map<string, MethodFamilyState>();
  const functionUpdates = new Map<number, FunctionUpdate>();
  const classMethodUpdates = new Map<number, Map<number, MethodUpdate>>();
  const classMemberRemovals = new Map<number, Set<number>>();
  const consumedFunctionFamilyNames = new Set<string>();
  const consumedMethodFamilies = new Map<number, Set<string>>();

  for (const marker of markers) {
    if (marker.kind === "function") {
      const targetEntries = functionEntriesByName.get(marker.targetName) ?? [];
      if (targetEntries.length !== 1) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            targetEntries.length === 0
              ? `Overload marker target function '${marker.targetName}' was not found.`
              : `Overload marker target function '${marker.targetName}' is ambiguous.`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      const [targetEntry] = targetEntries;
      if (!targetEntry) {
        continue;
      }
      if (targetEntry.declaration.isDeclarationOnly === true) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Overload marker target function '${marker.targetName}' must be a real body, not a declaration-only stub signature.`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      let familyState = functionFamilyStates.get(marker.familyName);
      if (!familyState) {
        familyState = getOrCreateFunctionFamilyState(
          marker,
          module,
          functionEntriesByName,
          diagnostics
        );
        if (!familyState) continue;
        functionFamilyStates.set(marker.familyName, familyState);
        consumedFunctionFamilyNames.add(marker.familyName);
        for (const removedIndex of familyState.removedIndices) {
          removedStatementIndices.add(removedIndex);
        }
      }
      const activeFamilyState = familyState;

      if (targetEntry.index === activeFamilyState.implementationStub.index) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Overload marker target '${marker.targetName}' cannot point at the stub implementation '${marker.familyName}'. Bind a separate real body function instead.`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      if (
        targetEntry.declaration.isAsync !==
          activeFamilyState.implementationStub.declaration.isAsync ||
        targetEntry.declaration.isGenerator !==
          activeFamilyState.implementationStub.declaration.isGenerator
      ) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Real body '${marker.targetName}' must match async/generator modifiers of stub '${marker.familyName}'.`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      const matchingSignatureIndices: number[] = [];
      for (
        let signatureIndex = 0;
        signatureIndex < activeFamilyState.publicSignatures.length;
        signatureIndex += 1
      ) {
        const publicSignature =
          activeFamilyState.publicSignatures[signatureIndex];
        if (
          publicSignature &&
          callableMatchesExactly(
            targetEntry.declaration,
            publicSignature.declaration,
            projectAssemblyName
          )
        ) {
          matchingSignatureIndices.push(signatureIndex);
        }
      }

      if (matchingSignatureIndices.length !== 1) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            matchingSignatureIndices.length === 0
              ? `Real body '${marker.targetName}' does not match any public overload signature on stub '${marker.familyName}'.`
              : `Real body '${marker.targetName}' matches multiple public overload signatures on stub '${marker.familyName}'. Make the signature unique.`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      const [signatureIndex] = matchingSignatureIndices;
      if (signatureIndex === undefined) {
        continue;
      }
      const existingTarget =
        activeFamilyState.matchedTargetsBySignature.get(signatureIndex);
      if (
        existingTarget !== undefined &&
        existingTarget !== targetEntry.index
      ) {
        diagnostics.push(
          createDiagnostic(
            "TSN4005",
            "error",
            `Public overload signature '${marker.familyName}' #${signatureIndex + 1} is already bound to another real body.`,
            createLocation(module.filePath, marker.sourceSpan)
          )
        );
        continue;
      }

      activeFamilyState.matchedTargetsBySignature.set(
        signatureIndex,
        targetEntry.index
      );
      functionUpdates.set(targetEntry.index, {
        overloadFamily: buildPublicOverloadFamilyMember({
          ownerKind: "function",
          publicName: marker.familyName,
          isStatic: false,
          signatureIndex,
          publicSignatureCount: activeFamilyState.publicSignatures.length,
        }),
        isExported:
          activeFamilyState.implementationStub.declaration.isExported ||
          activeFamilyState.publicSignatures.some(
            (entry) => entry.declaration.isExported
          ),
      });
      continue;
    }

    const classEntry = classEntriesByName.get(marker.ownerName);
    if (!classEntry) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          `Overload marker target class '${marker.ownerName}' was not found.`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    const methodTarget = findUniqueRealMethodTarget(
      classEntry.declaration,
      marker.targetMemberName
    );
    if (methodTarget === "missing" || methodTarget === "ambiguous") {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          methodTarget === "missing"
            ? `Overload marker target method '${marker.ownerName}.${marker.targetMemberName}' was not found.`
            : `Overload marker target method '${marker.ownerName}.${marker.targetMemberName}' is ambiguous.`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    const methodFamilyKey = `${classEntry.index}:${methodTarget.declaration.isStatic ? "static" : "instance"}:${marker.familyName}`;
    let familyState = methodFamilyStates.get(methodFamilyKey);
    if (!familyState) {
      familyState = getOrCreateMethodFamilyState(
        marker,
        module,
        classEntry.index,
        classEntry.declaration,
        methodTarget.declaration.isStatic,
        diagnostics
      );
      if (!familyState) continue;
      methodFamilyStates.set(methodFamilyKey, familyState);
      const removedMemberIndices =
        classMemberRemovals.get(classEntry.index) ?? new Set<number>();
      for (const removedIndex of familyState.removedMemberIndices) {
        removedMemberIndices.add(removedIndex);
      }
      classMemberRemovals.set(classEntry.index, removedMemberIndices);
      const consumedNames =
        consumedMethodFamilies.get(classEntry.index) ?? new Set<string>();
      consumedNames.add(
        `${methodTarget.declaration.isStatic ? "static" : "instance"}:${marker.familyName}`
      );
      consumedMethodFamilies.set(classEntry.index, consumedNames);
    }
    const activeFamilyState = familyState;

    if (
      methodTarget.memberIndex ===
      activeFamilyState.implementationStub.memberIndex
    ) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          `Overload marker target '${marker.ownerName}.${marker.targetMemberName}' cannot point at the stub implementation '${marker.familyName}'. Bind a separate real body method instead.`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    if (
      methodTarget.declaration.isStatic !==
        activeFamilyState.implementationStub.declaration.isStatic ||
      methodTarget.declaration.isAsync !==
        activeFamilyState.implementationStub.declaration.isAsync ||
      methodTarget.declaration.isGenerator !==
        activeFamilyState.implementationStub.declaration.isGenerator
    ) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          `Real body '${marker.ownerName}.${marker.targetMemberName}' must match static/async/generator modifiers of stub '${marker.ownerName}.${marker.familyName}'.`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    const matchingSignatureIndices: number[] = [];
    for (
      let signatureIndex = 0;
      signatureIndex < activeFamilyState.publicSignatures.length;
      signatureIndex += 1
    ) {
      const publicSignature =
        activeFamilyState.publicSignatures[signatureIndex];
      if (
        publicSignature &&
        callableMatchesExactly(
          methodTarget.declaration,
          publicSignature.declaration,
          projectAssemblyName
        )
      ) {
        matchingSignatureIndices.push(signatureIndex);
      }
    }

    if (matchingSignatureIndices.length !== 1) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          matchingSignatureIndices.length === 0
            ? `Real body '${marker.ownerName}.${marker.targetMemberName}' does not match any public overload signature on stub '${marker.ownerName}.${marker.familyName}'.`
            : `Real body '${marker.ownerName}.${marker.targetMemberName}' matches multiple public overload signatures on stub '${marker.ownerName}.${marker.familyName}'. Make the signature unique.`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    const [signatureIndex] = matchingSignatureIndices;
    if (signatureIndex === undefined) {
      continue;
    }
    const existingTarget =
      activeFamilyState.matchedTargetsBySignature.get(signatureIndex);
    if (
      existingTarget !== undefined &&
      existingTarget !== methodTarget.memberIndex
    ) {
      diagnostics.push(
        createDiagnostic(
          "TSN4005",
          "error",
          `Public overload signature '${marker.ownerName}.${marker.familyName}' #${signatureIndex + 1} is already bound to another real body.`,
          createLocation(module.filePath, marker.sourceSpan)
        )
      );
      continue;
    }

    activeFamilyState.matchedTargetsBySignature.set(
      signatureIndex,
      methodTarget.memberIndex
    );
    const updates =
      classMethodUpdates.get(classEntry.index) ??
      new Map<number, MethodUpdate>();
    updates.set(methodTarget.memberIndex, {
      overloadFamily: buildPublicOverloadFamilyMember({
        ownerKind: "method",
        publicName: marker.familyName,
        isStatic: methodTarget.declaration.isStatic,
        signatureIndex,
        publicSignatureCount: activeFamilyState.publicSignatures.length,
      }),
      accessibility:
        activeFamilyState.implementationStub.declaration.accessibility,
      isOverride:
        activeFamilyState.publicSignatures[signatureIndex]?.declaration
          .isOverride || undefined,
    });
    classMethodUpdates.set(classEntry.index, updates);
  }

  for (const [familyName, state] of functionFamilyStates) {
    if (
      state.matchedTargetsBySignature.size !== state.publicSignatures.length
    ) {
      diagnostics.push(
        createDiagnostic(
          "TSN2004",
          "error",
          `Overload stub '${familyName}' is incomplete. Every public overload signature must be bound to exactly one real body via O(fn).family(${familyName}).`,
          { file: module.filePath, line: 1, column: 1, length: 1 }
        )
      );
    }
  }

  for (const state of methodFamilyStates.values()) {
    if (
      state.matchedTargetsBySignature.size !== state.publicSignatures.length
    ) {
      diagnostics.push(
        createDiagnostic(
          "TSN2004",
          "error",
          `Overload stub '${state.familyName}' on class '${(module.body[state.classIndex] as IrClassDeclaration).name}' is incomplete. Every public overload signature must be bound to exactly one real body.`,
          { file: module.filePath, line: 1, column: 1, length: 1 }
        )
      );
    }
  }

  validateFunctionLegacyOverloads(
    module,
    consumedFunctionFamilyNames,
    diagnostics
  );
  validateClassLegacyOverloads(module, consumedMethodFamilies, diagnostics);

  if (
    removedStatementIndices.size === 0 &&
    classMemberRemovals.size === 0 &&
    functionUpdates.size === 0 &&
    classMethodUpdates.size === 0
  ) {
    return undefined;
  }

  return {
    removedStatementIndices,
    classMemberRemovals,
    functionUpdates,
    classMethodUpdates,
  };
};

const rebuildModule = (
  module: IrModule,
  collected: CollectedOverloads
): IrModule => {
  const body: IrStatement[] = [];
  const statementMap = new Map<IrStatement, IrStatement>();

  module.body.forEach((statement, index) => {
    if (collected.removedStatementIndices.has(index)) {
      return;
    }

    if (statement.kind === "functionDeclaration") {
      const update = collected.functionUpdates.get(index);
      const nextStatement = update
        ? {
            ...statement,
            overloadFamily: update.overloadFamily,
            isExported: update.isExported,
          }
        : statement;
      body.push(nextStatement);
      statementMap.set(statement, nextStatement);
      return;
    }

    if (statement.kind === "classDeclaration") {
      const memberRemovals = collected.classMemberRemovals.get(index);
      const memberUpdates = collected.classMethodUpdates.get(index);
      if (
        (!memberRemovals || memberRemovals.size === 0) &&
        (!memberUpdates || memberUpdates.size === 0)
      ) {
        body.push(statement);
        statementMap.set(statement, statement);
        return;
      }

      const members = statement.members
        .filter((_, memberIndex) => !memberRemovals?.has(memberIndex))
        .map((member) => {
          if (member.kind !== "methodDeclaration" || !memberUpdates) {
            return member;
          }

          const originalMemberIndex = statement.members.findIndex(
            (candidate) => candidate === member
          );
          const update = memberUpdates.get(originalMemberIndex);
          if (!update) {
            return member;
          }

          return {
            ...member,
            overloadFamily: update.overloadFamily,
            accessibility: update.accessibility,
            isOverride: update.isOverride ?? member.isOverride,
            isShadow: update.isOverride ? undefined : member.isShadow,
          };
        });

      const nextStatement = {
        ...statement,
        members,
      };
      body.push(nextStatement);
      statementMap.set(statement, nextStatement);
      return;
    }

    body.push(statement);
    statementMap.set(statement, statement);
  });

  const exports = module.exports
    .map((exp) => {
      if (exp.kind !== "declaration") return exp;
      const mapped = statementMap.get(exp.declaration);
      if (!mapped) return undefined;
      return {
        ...exp,
        declaration: mapped,
      };
    })
    .filter((exp): exp is NonNullable<typeof exp> => exp !== undefined);

  const exportedDeclarations = new Set(
    exports
      .filter((exp) => exp.kind === "declaration")
      .map((exp) => exp.declaration)
  );

  for (const statement of body) {
    if (!("isExported" in statement) || statement.isExported !== true) {
      continue;
    }
    if (exportedDeclarations.has(statement)) {
      continue;
    }
    exports.push({
      kind: "declaration",
      declaration: statement,
    });
    exportedDeclarations.add(statement);
  }

  return {
    ...module,
    body,
    exports,
  };
};

export const runOverloadCollectionPass = (
  modules: readonly IrModule[]
): OverloadCollectionResult => {
  const diagnostics: Diagnostic[] = [];
  const processedModules: IrModule[] = [];

  for (const module of modules) {
    const collected = collectModuleOverloads(module, diagnostics);
    processedModules.push(
      collected ? rebuildModule(module, collected) : module
    );
  }

  return {
    ok: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
    modules: processedModules,
    diagnostics,
  };
};
