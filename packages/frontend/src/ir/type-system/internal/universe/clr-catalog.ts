/**
 * CLR Type Catalog Loader
 *
 * Loads CLR type metadata from tsbindgen <Namespace>/bindings.json files
 * into a queryable catalog structure.
 *
 * INVARIANT INV-CLR: All assembly types loaded here become part of the
 * unified type catalog. No parallel lookup paths allowed.
 *
 * The loader:
 * 1. Scans node_modules/@tsonic/* packages for metadata files
 * 2. Parses bindings.json for type definitions, members, signatures
 * 4. Converts to NominalEntry structures with proper IrType members
 */

import * as fs from "fs";
import * as path from "path";
import * as ts from "typescript";
import type { IrType } from "../../../types/index.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import type {
  AssemblyTypeCatalog,
  TypeId,
  NominalEntry,
  NominalKind,
  MemberEntry,
  MemberKind,
  MethodSignatureEntry,
  ParameterEntry,
  ParameterMode,
  TypeParameterEntry,
  HeritageEdge,
  RawBindingsFile,
  RawBindingsType,
  RawBindingsMethod,
} from "./types.js";
import { makeTypeId, parseStableId } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// CLR TYPE STRING PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse a CLR type string from normalized signature into IrType.
 *
 * Examples:
 * - "System.String" → { kind: "primitiveType", name: "string" }
 * - "System.Int32" → { kind: "primitiveType", name: "int" }
 * - "System.Double" → { kind: "primitiveType", name: "number" }
 * - "System.Boolean" → { kind: "primitiveType", name: "boolean" }
 * - "System.Char" → { kind: "primitiveType", name: "char" }
 * - "System.Void" → { kind: "voidType" }
 * - "System.Object" → { kind: "referenceType", name: "object" }
 * - "T" → { kind: "typeParameterType", name: "T" }
 * - "System.Collections.Generic.List`1[[T]]" → array type or reference
 * - "T[]" → { kind: "arrayType", elementType: ... }
 */
const parseClrTypeString = (clrType: string): IrType => {
  // Handle void
  if (clrType === "System.Void" || clrType === "void") {
    return { kind: "voidType" };
  }

  // Handle primitive mappings
  const primitiveMap: Record<string, IrType> = {
    "System.String": { kind: "primitiveType", name: "string" },
    string: { kind: "primitiveType", name: "string" },
    "System.Int32": { kind: "primitiveType", name: "int" },
    int: { kind: "primitiveType", name: "int" },
    // Distinct CLR numeric aliases from @tsonic/core
    "System.SByte": { kind: "referenceType", name: "sbyte" },
    sbyte: { kind: "referenceType", name: "sbyte" },
    "System.Byte": { kind: "referenceType", name: "byte" },
    byte: { kind: "referenceType", name: "byte" },
    "System.Int16": { kind: "referenceType", name: "short" },
    short: { kind: "referenceType", name: "short" },
    "System.UInt16": { kind: "referenceType", name: "ushort" },
    ushort: { kind: "referenceType", name: "ushort" },
    "System.UInt32": { kind: "referenceType", name: "uint" },
    uint: { kind: "referenceType", name: "uint" },
    "System.Int64": { kind: "referenceType", name: "long" },
    long: { kind: "referenceType", name: "long" },
    "System.UInt64": { kind: "referenceType", name: "ulong" },
    ulong: { kind: "referenceType", name: "ulong" },
    "System.IntPtr": { kind: "referenceType", name: "nint" },
    nint: { kind: "referenceType", name: "nint" },
    "System.UIntPtr": { kind: "referenceType", name: "nuint" },
    nuint: { kind: "referenceType", name: "nuint" },
    "System.Int128": { kind: "referenceType", name: "int128" },
    int128: { kind: "referenceType", name: "int128" },
    "System.UInt128": { kind: "referenceType", name: "uint128" },
    uint128: { kind: "referenceType", name: "uint128" },
    "System.Double": { kind: "primitiveType", name: "number" },
    double: { kind: "primitiveType", name: "number" },
    "System.Single": { kind: "referenceType", name: "float" },
    float: { kind: "referenceType", name: "float" },
    "System.Half": { kind: "referenceType", name: "half" },
    half: { kind: "referenceType", name: "half" },
    "System.Decimal": { kind: "referenceType", name: "decimal" },
    decimal: { kind: "referenceType", name: "decimal" },
    "System.Boolean": { kind: "primitiveType", name: "boolean" },
    bool: { kind: "primitiveType", name: "boolean" },
    "System.Char": { kind: "primitiveType", name: "char" },
    char: { kind: "primitiveType", name: "char" },
    // System.Object is the CLR "top" reference type. Treat it as C# `object`,
    // not TypeScript `any` (airplane-grade: no implicit "any" in IR).
    "System.Object": { kind: "referenceType", name: "object" },
    object: { kind: "referenceType", name: "object" },
  };

  const primitive = primitiveMap[clrType];
  if (primitive) return primitive;

  // Handle array types: T[] or System.Array`1[[T]]
  if (clrType.endsWith("[]")) {
    const elementType = clrType.slice(0, -2);
    return {
      kind: "arrayType",
      elementType: parseClrTypeString(elementType),
    };
  }

  // Handle pointer types (convert to ref semantics - just use the base type)
  if (clrType.endsWith("*")) {
    return parseClrTypeString(clrType.slice(0, -1));
  }

  // Handle nullable: Nullable<T> or T?
  if (clrType.startsWith("System.Nullable`1")) {
    // Extract inner type
    const innerMatch = clrType.match(/System\.Nullable`1\[\[([^\]]+)\]\]/);
    if (innerMatch && innerMatch[1]) {
      const innerType = parseClrTypeString(innerMatch[1]);
      return {
        kind: "unionType",
        types: [innerType, { kind: "primitiveType", name: "undefined" }],
      };
    }
  }

  // Handle type parameters (single uppercase letter or common patterns)
  if (/^T\d*$/.test(clrType) || /^T[A-Z][a-zA-Z]*$/.test(clrType)) {
    return { kind: "typeParameterType", name: clrType };
  }

  // Handle tsbindgen-style generic instantiations using underscore arity:
  //   KeyValuePair_2[[TKey,TValue]]
  // This format is used in bindings.json for inheritance type arguments.
  const underscoreInstantiationMatch = clrType.match(
    /^(.+?)_(\d+)\[\[(.+)\]\]$/
  );
  if (
    underscoreInstantiationMatch &&
    underscoreInstantiationMatch[1] &&
    underscoreInstantiationMatch[2] &&
    underscoreInstantiationMatch[3]
  ) {
    const baseName = underscoreInstantiationMatch[1];
    const arity = parseInt(underscoreInstantiationMatch[2], 10);
    const typeArgsStr = underscoreInstantiationMatch[3];

    // NOTE: CLR type strings inside normalized signatures often use assembly-qualified
    // type arguments (commas for AssemblyName/Version/Culture/PublicKeyToken).
    // Those commas are not type-argument separators. Only parse `[[...]]` payloads
    // that follow our deterministic tsbindgen encoding for bindings.json heritage
    // (no assembly identity segments).
    //
    // If we mis-parse assembly-qualified args, we break signatureKey matching which
    // hydrates optional/rest flags from tsbindgen .d.ts (airplane-grade determinism).
    const looksAssemblyQualified =
      /\bVersion=|\bCulture=|\bPublicKeyToken=/.test(typeArgsStr);

    const args = looksAssemblyQualified ? [] : splitTypeArguments(typeArgsStr);

    // Airplane-grade safety: only attach parsed typeArguments when we can prove
    // the arity matches. Otherwise, preserve only the generic *definition* arity
    // and keep the raw CLR string for later resolution.
    const typeArguments: IrType[] | undefined =
      !looksAssemblyQualified && args.length === arity
        ? args.map((arg) => parseClrTypeString(arg.trim()))
        : undefined;

    return {
      kind: "referenceType",
      name: `${baseName}_${arity}`,
      typeArguments,
      resolvedClrType: clrType,
    };
  }

  // Handle generic types: Name`N[[TypeArgs]]
  const genericMatch = clrType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
  if (genericMatch && genericMatch[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = parseInt(genericMatch[2], 10);
    const typeArgsStr = genericMatch[3]; // May be undefined

    // Extract type arguments if present
    const typeArguments: IrType[] = [];
    if (typeArgsStr) {
      // Parse comma-separated type args (this is simplified, may need proper parsing)
      const args = splitTypeArguments(typeArgsStr);
      for (const arg of args) {
        typeArguments.push(parseClrTypeString(arg.trim()));
      }
    } else {
      // Generate placeholder type parameters
      for (let i = 0; i < arity; i++) {
        typeArguments.push({
          kind: "typeParameterType",
          name: i === 0 ? "T" : `T${i + 1}`,
        });
      }
    }

    return {
      kind: "referenceType",
      name: baseName,
      typeArguments: typeArguments.length > 0 ? typeArguments : undefined,
      resolvedClrType: clrType,
    };
  }

  // Default: treat as reference type
  return {
    kind: "referenceType",
    name: clrType,
    resolvedClrType: clrType,
  };
};

/**
 * Split type arguments handling nested brackets.
 */
const splitTypeArguments = (str: string): string[] => {
  const result: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of str) {
    if (char === "[") {
      depth++;
      current += char;
    } else if (char === "]") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
};

// ═══════════════════════════════════════════════════════════════════════════
// TSBINDGEN .D.TS HERITAGE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

const INSTANCE_SUFFIX = "$instance";
const VIEWS_PREFIX = "__";
const VIEWS_SUFFIX = "$views";

const stripTsBindgenInstanceSuffix = (name: string): string => {
  return name.endsWith(INSTANCE_SUFFIX)
    ? name.slice(0, -INSTANCE_SUFFIX.length)
    : name;
};

const stripTsBindgenViewsWrapper = (name: string): string | undefined => {
  if (!name.startsWith(VIEWS_PREFIX)) return undefined;
  if (!name.endsWith(VIEWS_SUFFIX)) return undefined;
  return name.slice(VIEWS_PREFIX.length, -VIEWS_SUFFIX.length);
};

const getRightmostQualifiedNameText = (name: ts.EntityName): string => {
  if (ts.isIdentifier(name)) return name.text;
  return getRightmostQualifiedNameText(name.right);
};

const getRightmostPropertyAccessText = (
  expr: ts.Expression
): string | undefined => {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr)) return expr.name.text;
  if (ts.isCallExpression(expr))
    return getRightmostPropertyAccessText(expr.expression);
  if (ts.isParenthesizedExpression(expr))
    return getRightmostPropertyAccessText(expr.expression);
  return undefined;
};

const dtsTypeNodeToIrType = (
  node: ts.TypeNode,
  inScopeTypeParams: ReadonlySet<string>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>
): IrType => {
  // Parenthesized type
  if (ts.isParenthesizedTypeNode(node)) {
    return dtsTypeNodeToIrType(node.type, inScopeTypeParams, tsNameToTypeId);
  }

  // Type references (including type parameters)
  if (ts.isTypeReferenceNode(node)) {
    const rawName = getRightmostQualifiedNameText(node.typeName);
    const baseName = stripTsBindgenInstanceSuffix(rawName);

    // tsbindgen imports CLR numeric aliases from @tsonic/core as type references.
    // For IR purposes, `int` is a distinct primitive type (not referenceType).
    if (baseName === "int" && !node.typeArguments?.length) {
      return { kind: "primitiveType", name: "int" };
    }

    // Type parameter reference: `T` (no type args) where T is in scope
    if (inScopeTypeParams.has(baseName) && !node.typeArguments?.length) {
      return { kind: "typeParameterType", name: baseName };
    }

    const typeArguments = node.typeArguments?.map((a) =>
      dtsTypeNodeToIrType(a, inScopeTypeParams, tsNameToTypeId)
    );

    const resolvedName =
      typeArguments && typeArguments.length > 0
        ? (() => {
            const arityName = `${baseName}_${typeArguments.length}`;
            return tsNameToTypeId.has(arityName) ? arityName : baseName;
          })()
        : baseName;

    return {
      kind: "referenceType",
      name: resolvedName,
      typeArguments:
        typeArguments && typeArguments.length > 0 ? typeArguments : undefined,
    };
  }

  // Array types
  if (ts.isArrayTypeNode(node)) {
    return {
      kind: "arrayType",
      elementType: dtsTypeNodeToIrType(
        node.elementType,
        inScopeTypeParams,
        tsNameToTypeId
      ),
    };
  }

  // Union / intersection
  if (ts.isUnionTypeNode(node)) {
    return {
      kind: "unionType",
      types: node.types.map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }
  if (ts.isIntersectionTypeNode(node)) {
    return {
      kind: "intersectionType",
      types: node.types.map((t) =>
        dtsTypeNodeToIrType(t, inScopeTypeParams, tsNameToTypeId)
      ),
    };
  }

  // Literal types
  if (ts.isLiteralTypeNode(node)) {
    const lit = node.literal;
    if (ts.isStringLiteral(lit))
      return { kind: "literalType", value: lit.text };
    if (ts.isNumericLiteral(lit))
      return { kind: "literalType", value: Number(lit.text) };
    if (lit.kind === ts.SyntaxKind.TrueKeyword)
      return { kind: "literalType", value: true };
    if (lit.kind === ts.SyntaxKind.FalseKeyword)
      return { kind: "literalType", value: false };
  }

  // Keywords
  switch (node.kind) {
    case ts.SyntaxKind.StringKeyword:
      return { kind: "primitiveType", name: "string" };
    case ts.SyntaxKind.NumberKeyword:
      return { kind: "primitiveType", name: "number" };
    case ts.SyntaxKind.BooleanKeyword:
      return { kind: "primitiveType", name: "boolean" };
    case ts.SyntaxKind.VoidKeyword:
      return { kind: "voidType" };
    case ts.SyntaxKind.AnyKeyword:
      return { kind: "anyType" };
    case ts.SyntaxKind.UnknownKeyword:
      return { kind: "unknownType" };
    case ts.SyntaxKind.NeverKeyword:
      return { kind: "neverType" };
    case ts.SyntaxKind.NullKeyword:
      return { kind: "primitiveType", name: "null" };
    case ts.SyntaxKind.UndefinedKeyword:
      return { kind: "primitiveType", name: "undefined" };
    default:
      return { kind: "unknownType" };
  }
};

const irTypeToSignatureKey = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return `p:${type.name}`;
    case "literalType":
      return `lit:${JSON.stringify(type.value)}`;
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "unknownType":
      return "unknown";
    case "anyType":
      return "any";
    case "typeParameterType":
      // Canonicalize all type parameters to a stable placeholder so tsbindgen's
      // `TContext` matches metadata's `T0`/`T` deterministically.
      return "T";
    case "arrayType":
      return `${irTypeToSignatureKey(type.elementType)}[]`;
    case "tupleType":
      return `[${type.elementTypes
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .join(",")}]`;
    case "unionType": {
      const parts = type.types
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .sort();
      return `(${parts.join("|")})`;
    }
    case "intersectionType": {
      const parts = type.types
        .map((t) => (t ? irTypeToSignatureKey(t) : "unknown"))
        .sort();
      return `(${parts.join("&")})`;
    }
    case "dictionaryType":
      return `{[${irTypeToSignatureKey(type.keyType)}]:${irTypeToSignatureKey(type.valueType)}}`;
    case "functionType": {
      const params = type.parameters
        .map((p) => (p.type ? irTypeToSignatureKey(p.type) : "unknown"))
        .join(",");
      return `fn(${params})->${irTypeToSignatureKey(type.returnType)}`;
    }
    case "objectType":
      return "object";
    case "referenceType": {
      const raw = type.resolvedClrType ?? type.name;
      const withoutArgs = raw.includes("[[")
        ? (raw.split("[[")[0] ?? raw)
        : raw;
      const lastSep = Math.max(
        withoutArgs.lastIndexOf("."),
        withoutArgs.lastIndexOf("+")
      );
      let simple = lastSep >= 0 ? withoutArgs.slice(lastSep + 1) : withoutArgs;

      // Canonicalize CLR backtick arity: `Action`1` -> `Action_1`.
      const backtickMatch = simple.match(/`(\d+)$/);
      if (backtickMatch && backtickMatch[1]) {
        simple = `${simple.slice(0, -backtickMatch[0].length)}_${backtickMatch[1]}`;
      }

      const underscoreMatch = simple.match(/_(\d+)$/);
      const arity =
        underscoreMatch && underscoreMatch[1]
          ? Number(underscoreMatch[1])
          : undefined;
      const argCount = type.typeArguments?.length ?? arity ?? 0;

      // Signature matching is used only to hydrate optional/rest flags from tsbindgen .d.ts
      // into CLR metadata signatures. To keep matching robust across:
      // - CLR names vs TS names
      // - generic instantiation encodings (Action_1[[...]] vs Action_1<T>)
      // we intentionally ignore concrete type argument *identities* and retain only arity.
      if (argCount <= 0) return simple;
      return `${simple}<${Array.from({ length: argCount }, () => "*").join(",")}>`;
    }
    default:
      return "unknown";
  }
};

const makeMethodSignatureKey = (args: {
  readonly isStatic: boolean;
  readonly name: string;
  readonly typeParamCount: number;
  readonly parameters: readonly {
    readonly type: IrType;
    readonly isRest: boolean;
  }[];
  readonly returnType: IrType;
}): string => {
  const params = args.parameters
    .map((p) => `${p.isRest ? "..." : ""}${irTypeToSignatureKey(p.type)}`)
    .join(",");
  return `${args.isStatic ? "static" : "instance"}|${args.name}|${
    args.typeParamCount
  }|(${params})->${irTypeToSignatureKey(args.returnType)}`;
};

type TsBindgenDtsTypeInfo = {
  readonly typeParametersByTsName: ReadonlyMap<string, readonly string[]>;
  readonly heritageByTsName: ReadonlyMap<string, readonly HeritageEdge[]>;
  readonly memberTypesByTsName: ReadonlyMap<
    string,
    ReadonlyMap<string, IrType>
  >;
  readonly methodSignatureOptionalsByTsName: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly boolean[]>
  >;
};

const extractHeritageFromTsBindgenDts = (
  dtsPath: string,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  entries: ReadonlyMap<string, NominalEntry>
): TsBindgenDtsTypeInfo => {
  const typeParametersByTsName = new Map<string, readonly string[]>();
  const heritageByTsName = new Map<string, HeritageEdge[]>();
  const memberTypesByTsName = new Map<string, Map<string, IrType>>();
  const methodSignatureOptionalsByTsName = new Map<
    string,
    Map<string, readonly boolean[]>
  >();

  const content = fs.readFileSync(dtsPath, "utf-8");
  const sf = ts.createSourceFile(
    dtsPath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  const getEntry = (tsName: string): NominalEntry | undefined => {
    const id = tsNameToTypeId.get(tsName);
    return id ? entries.get(id.stableId) : undefined;
  };

  const addEdge = (sourceTsName: string, edge: HeritageEdge) => {
    const list = heritageByTsName.get(sourceTsName) ?? [];
    list.push(edge);
    heritageByTsName.set(sourceTsName, list);
  };

  const recordMemberType = (
    sourceTsName: string,
    memberName: string,
    type: IrType
  ) => {
    const map =
      memberTypesByTsName.get(sourceTsName) ?? new Map<string, IrType>();
    // Prefer first-seen type for determinism; later duplicates are ignored.
    if (!map.has(memberName)) {
      map.set(memberName, type);
      memberTypesByTsName.set(sourceTsName, map);
    }
  };

  const recordMethodSignatureOptionals = (
    sourceTsName: string,
    signatureKey: string,
    optionals: readonly boolean[]
  ): void => {
    const map =
      methodSignatureOptionalsByTsName.get(sourceTsName) ??
      new Map<string, readonly boolean[]>();
    // Prefer first-seen for determinism; later duplicates are ignored.
    if (!map.has(signatureKey)) {
      map.set(signatureKey, optionals);
      methodSignatureOptionalsByTsName.set(sourceTsName, map);
    }
  };

  const getPropertyNameText = (name: ts.PropertyName): string | undefined => {
    if (ts.isIdentifier(name)) return name.text;
    if (ts.isStringLiteral(name)) return name.text;
    if (ts.isNumericLiteral(name)) return name.text;
    return undefined;
  };

  const extractMethodSignatureOptionalsFromMembers = (
    baseTsName: string,
    members: readonly ts.Node[],
    typeTypeParams: readonly string[],
    staticOverride?: boolean
  ): void => {
    const typeScope = new Set<string>(typeTypeParams);

    for (const member of members) {
      if (!ts.isMethodSignature(member) && !ts.isMethodDeclaration(member))
        continue;

      const methodName =
        member.name && ts.isIdentifier(member.name)
          ? member.name.text
          : undefined;
      if (!methodName) continue;

      const methodTypeParams = (member.typeParameters ?? []).map(
        (p) => p.name.text
      );
      const inScopeTypeParams = new Set<string>([
        ...Array.from(typeScope),
        ...methodTypeParams,
      ]);

      const params: { type: IrType; isRest: boolean; isOptional: boolean }[] =
        [];
      for (const param of member.parameters) {
        if (!param.type) {
          // Deterministic: without an explicit type, we can't match this overload to metadata.
          params.length = 0;
          break;
        }

        params.push({
          type: dtsTypeNodeToIrType(
            param.type,
            inScopeTypeParams,
            tsNameToTypeId
          ),
          isRest: param.dotDotDotToken !== undefined,
          isOptional:
            param.questionToken !== undefined ||
            param.initializer !== undefined,
        });
      }

      if (params.length === 0 && member.parameters.length > 0) {
        continue;
      }

      const returnType = member.type
        ? dtsTypeNodeToIrType(member.type, inScopeTypeParams, tsNameToTypeId)
        : ({ kind: "voidType" } as const);

      const isStatic =
        staticOverride ??
        (ts.isMethodDeclaration(member) &&
          (member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.StaticKeyword
          ) ??
            false));

      const signatureKey = makeMethodSignatureKey({
        isStatic,
        name: methodName,
        typeParamCount: methodTypeParams.length,
        parameters: params.map((p) => ({ type: p.type, isRest: p.isRest })),
        returnType,
      });

      recordMethodSignatureOptionals(
        baseTsName,
        signatureKey,
        params.map((p) => p.isOptional)
      );
    }
  };

  const extractMemberTypesFromInstanceDecl = (
    baseTsName: string,
    members: readonly ts.Node[],
    inScopeTypeParams: ReadonlySet<string>
  ): void => {
    for (const member of members) {
      if (ts.isPropertySignature(member)) {
        const nameText = member.name
          ? getPropertyNameText(member.name)
          : undefined;
        if (!nameText || !member.type) continue;
        recordMemberType(
          baseTsName,
          nameText,
          dtsTypeNodeToIrType(member.type, inScopeTypeParams, tsNameToTypeId)
        );
        continue;
      }

      if (ts.isPropertyDeclaration(member)) {
        const nameText = member.name
          ? getPropertyNameText(member.name)
          : undefined;
        if (!nameText || !member.type) continue;
        recordMemberType(
          baseTsName,
          nameText,
          dtsTypeNodeToIrType(member.type, inScopeTypeParams, tsNameToTypeId)
        );
        continue;
      }

      if (ts.isGetAccessorDeclaration(member)) {
        const nameText = member.name
          ? getPropertyNameText(member.name)
          : undefined;
        if (!nameText || !member.type) continue;
        recordMemberType(
          baseTsName,
          nameText,
          dtsTypeNodeToIrType(member.type, inScopeTypeParams, tsNameToTypeId)
        );
        continue;
      }
    }
  };

  const computeEdgeKind = (
    source: NominalEntry,
    target: NominalEntry,
    preferred?: HeritageEdge["kind"]
  ): HeritageEdge["kind"] => {
    if (preferred) return preferred;
    if (source.kind === "interface") return "extends";
    return target.kind === "interface" ? "implements" : "extends";
  };

  const addHeritageFromHeritageClauses = (
    sourceTsName: string,
    sourceEntry: NominalEntry,
    inScopeTypeParams: ReadonlySet<string>,
    clauses: readonly ts.HeritageClause[] | undefined,
    forceKind?: HeritageEdge["kind"]
  ) => {
    if (!clauses) return;

    for (const clause of clauses) {
      for (const t of clause.types) {
        const rawTarget = getRightmostPropertyAccessText(t.expression);
        if (!rawTarget) continue;
        const targetTsName = stripTsBindgenInstanceSuffix(rawTarget);

        const targetTypeId = tsNameToTypeId.get(targetTsName);
        if (!targetTypeId) continue;
        const targetEntry = entries.get(targetTypeId.stableId);
        if (!targetEntry) continue;

        const typeArguments = (t.typeArguments ?? []).map((a) =>
          dtsTypeNodeToIrType(a, inScopeTypeParams, tsNameToTypeId)
        );

        addEdge(sourceTsName, {
          kind: computeEdgeKind(sourceEntry, targetEntry, forceKind),
          targetStableId: targetTypeId.stableId,
          typeArguments,
        });
      }
    }
  };

  const addHeritageFromViewsInterface = (
    viewsDecl: ts.InterfaceDeclaration
  ) => {
    const baseTsName = stripTsBindgenViewsWrapper(viewsDecl.name.text);
    if (!baseTsName) return;

    const sourceEntry = getEntry(baseTsName);
    if (!sourceEntry) return;

    const inScopeTypeParams = new Set<string>(
      (viewsDecl.typeParameters ?? []).map((p) => p.name.text)
    );

    for (const m of viewsDecl.members) {
      if (!ts.isMethodSignature(m)) continue;
      const methodName =
        m.name && ts.isIdentifier(m.name) ? m.name.text : undefined;
      if (!methodName || !methodName.startsWith("As_")) continue;
      if (!m.type) continue;

      const returnType = dtsTypeNodeToIrType(
        m.type,
        inScopeTypeParams,
        tsNameToTypeId
      );
      if (returnType.kind !== "referenceType") continue;

      const targetTsName = returnType.name;
      const targetTypeId = tsNameToTypeId.get(targetTsName);
      if (!targetTypeId) continue;
      const targetEntry = entries.get(targetTypeId.stableId);
      if (!targetEntry) continue;

      addEdge(baseTsName, {
        kind: computeEdgeKind(sourceEntry, targetEntry, "implements"),
        targetStableId: targetTypeId.stableId,
        typeArguments: returnType.typeArguments ?? [],
      });
    }
  };

  for (const stmt of sf.statements) {
    // export interface Foo$instance<T> ...
    if (ts.isInterfaceDeclaration(stmt) && stmt.name) {
      const nameText = stmt.name.text;

      // Views wrapper: __Foo$views<T> { As_IEnumerable_1(): IEnumerable_1$instance<T> }
      if (
        nameText.startsWith(VIEWS_PREFIX) &&
        nameText.endsWith(VIEWS_SUFFIX)
      ) {
        addHeritageFromViewsInterface(stmt);
        continue;
      }

      if (!nameText.endsWith(INSTANCE_SUFFIX)) continue;
      const baseTsName = stripTsBindgenInstanceSuffix(nameText);
      const sourceEntry = getEntry(baseTsName);
      if (!sourceEntry) continue;

      const typeParams = (stmt.typeParameters ?? []).map((p) => p.name.text);
      if (!typeParametersByTsName.has(baseTsName)) {
        typeParametersByTsName.set(baseTsName, typeParams);
      }

      const inScopeTypeParams = new Set<string>(typeParams);
      addHeritageFromHeritageClauses(
        baseTsName,
        sourceEntry,
        inScopeTypeParams,
        stmt.heritageClauses
      );

      extractMemberTypesFromInstanceDecl(
        baseTsName,
        stmt.members,
        inScopeTypeParams
      );

      extractMethodSignatureOptionalsFromMembers(
        baseTsName,
        stmt.members,
        typeParams
      );
      continue;
    }

    // export abstract class Foo$instance { ... } (static namespaces)
    if (ts.isClassDeclaration(stmt) && stmt.name) {
      const nameText = stmt.name.text;
      if (!nameText.endsWith(INSTANCE_SUFFIX)) continue;

      const baseTsName = stripTsBindgenInstanceSuffix(nameText);
      const sourceEntry = getEntry(baseTsName);
      if (!sourceEntry) continue;

      const typeParams = (stmt.typeParameters ?? []).map((p) => p.name.text);
      if (!typeParametersByTsName.has(baseTsName)) {
        typeParametersByTsName.set(baseTsName, typeParams);
      }

      const inScopeTypeParams = new Set<string>(typeParams);

      // In a class declaration, TS encodes extends/implements explicitly.
      if (stmt.heritageClauses) {
        for (const clause of stmt.heritageClauses) {
          if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
            addHeritageFromHeritageClauses(
              baseTsName,
              sourceEntry,
              inScopeTypeParams,
              [clause],
              "extends"
            );
          } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
            addHeritageFromHeritageClauses(
              baseTsName,
              sourceEntry,
              inScopeTypeParams,
              [clause],
              "implements"
            );
          }
        }
      }

      extractMemberTypesFromInstanceDecl(
        baseTsName,
        stmt.members,
        inScopeTypeParams
      );

      extractMethodSignatureOptionalsFromMembers(
        baseTsName,
        stmt.members,
        typeParams
      );
    }

    // tsbindgen emits static members and constructors as top-level const containers:
    //   export const JsonValue: { create(...): JsonValue; new<T>(...): List_1<T>; ... }
    //
    // CLR metadata lacks optional parameter flags, so we hydrate them from the d.ts
    // surface to support deterministic arity checks (and thus overload correction).
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        if (!decl.type || !ts.isTypeLiteralNode(decl.type)) continue;

        const baseTsName = stripTsBindgenInstanceSuffix(decl.name.text);
        extractMethodSignatureOptionalsFromMembers(
          baseTsName,
          decl.type.members,
          [],
          true
        );
      }
    }
  }

  // Dedup + stable sort per type (determinism)
  const dedupedHeritageByTsName = new Map<string, readonly HeritageEdge[]>();
  for (const [tsName, edges] of heritageByTsName) {
    const seen = new Set<string>();
    const unique: HeritageEdge[] = [];
    for (const e of edges) {
      const key = `${e.kind}|${e.targetStableId}|${JSON.stringify(e.typeArguments)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(e);
    }
    unique.sort((a, b) => {
      const rank = (k: HeritageEdge["kind"]) => (k === "extends" ? 0 : 1);
      const ra = rank(a.kind);
      const rb = rank(b.kind);
      if (ra !== rb) return ra - rb;
      const stable = a.targetStableId.localeCompare(b.targetStableId);
      if (stable !== 0) return stable;
      return JSON.stringify(a.typeArguments).localeCompare(
        JSON.stringify(b.typeArguments)
      );
    });
    dedupedHeritageByTsName.set(tsName, unique);
  }

  return {
    typeParametersByTsName,
    heritageByTsName: dedupedHeritageByTsName,
    memberTypesByTsName,
    methodSignatureOptionalsByTsName,
  };
};

const enrichAssemblyEntriesFromTsBindgenDts = (
  entries: Map<string, NominalEntry>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  dtsPaths: readonly string[]
): void => {
  const mergedMemberTypes = new Map<string, Map<string, IrType>>();
  const mergedMethodSignatureOptionals = new Map<
    string,
    Map<string, readonly boolean[]>
  >();

  for (const dtsPath of dtsPaths) {
    try {
      const info = extractHeritageFromTsBindgenDts(
        dtsPath,
        tsNameToTypeId,
        entries
      );

      for (const [tsName, memberTypes] of info.memberTypesByTsName) {
        const merged =
          mergedMemberTypes.get(tsName) ?? new Map<string, IrType>();
        for (const [memberName, type] of memberTypes) {
          if (!merged.has(memberName)) {
            merged.set(memberName, type);
          }
        }
        mergedMemberTypes.set(tsName, merged);
      }

      for (const [
        tsName,
        signatureOptionals,
      ] of info.methodSignatureOptionalsByTsName) {
        const merged =
          mergedMethodSignatureOptionals.get(tsName) ??
          new Map<string, readonly boolean[]>();
        for (const [sigKey, optionals] of signatureOptionals) {
          if (!merged.has(sigKey)) {
            merged.set(sigKey, optionals);
          }
        }
        mergedMethodSignatureOptionals.set(tsName, merged);
      }
    } catch (e) {
      console.warn(
        `Failed to parse tsbindgen d.ts for enrichment: ${dtsPath}`,
        e
      );
    }
  }

  // Apply merged info to entries
  for (const [tsName, typeId] of tsNameToTypeId) {
    const entry = entries.get(typeId.stableId);
    if (!entry) continue;

    const memberTypes = mergedMemberTypes.get(tsName);
    const signatureOptionals = mergedMethodSignatureOptionals.get(tsName);
    let updatedMembers: Map<string, MemberEntry> | undefined;
    if (memberTypes) {
      for (const [memberName, type] of memberTypes) {
        const member = entry.members.get(memberName);
        if (!member) continue;
        if (!updatedMembers) {
          updatedMembers = new Map(entry.members);
        }
        updatedMembers.set(memberName, { ...member, type });
      }
    }

    if (signatureOptionals) {
      const currentMembers = updatedMembers ?? entry.members;
      for (const [memberName, member] of currentMembers) {
        if (member.memberKind !== "method" || !member.signatures) continue;

        let memberChanged = false;
        const updatedSignatures = member.signatures.map((sig) => {
          const signatureKey = makeMethodSignatureKey({
            isStatic: sig.isStatic,
            name: memberName,
            typeParamCount: sig.typeParameters.length,
            parameters: sig.parameters.map((p) => ({
              type: p.type,
              isRest: p.isRest,
            })),
            returnType: sig.returnType,
          });

          const optionals = signatureOptionals.get(signatureKey);
          if (!optionals) return sig;
          if (optionals.length !== sig.parameters.length) return sig;

          const updatedParams = sig.parameters.map((p, idx) => {
            const isOptional = optionals[idx];
            return isOptional === undefined || isOptional === p.isOptional
              ? p
              : { ...p, isOptional };
          });

          if (updatedParams.every((p, idx) => p === sig.parameters[idx])) {
            return sig;
          }

          memberChanged = true;
          return { ...sig, parameters: updatedParams };
        });

        if (!memberChanged) continue;

        if (!updatedMembers) {
          updatedMembers = new Map(entry.members);
        }
        updatedMembers.set(memberName, {
          ...member,
          signatures: updatedSignatures,
        });
      }
    }

    if (!updatedMembers) continue;

    entries.set(typeId.stableId, { ...entry, members: updatedMembers });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZED SIGNATURE PARSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse type from normalized signature for properties.
 *
 * Format for regular properties: "Name|:ReturnType|static=bool|accessor=get"
 * Example: "Length|:System.Int32|static=false|accessor=get"
 *
 * Format for indexer properties: "Name|[IndexType]:ReturnType|static=bool|accessor=get"
 * Example: "Chars|[System.Int32]:System.Char|static=false|accessor=get"
 */
const parsePropertyType = (normalizedSig: string): IrType => {
  // Try indexer format first: Chars|[System.Int32]:System.Char|...
  const indexerMatch = normalizedSig.match(/\|\[[^\]]*\]:([^|]+)\|/);
  if (indexerMatch && indexerMatch[1]) {
    return parseClrTypeString(indexerMatch[1]);
  }

  // Try regular property format: Length|:System.Int32|...
  const colonMatch = normalizedSig.match(/\|:([^|]+)\|/);
  if (colonMatch && colonMatch[1]) {
    return parseClrTypeString(colonMatch[1]);
  }
  return { kind: "unknownType" };
};

/**
 * Parse type from normalized signature for fields.
 *
 * Format: "Name|Type|static=bool|const=bool"
 * Example: "Empty|System.String|static=true|const=false"
 */
const parseFieldType = (normalizedSig: string): IrType => {
  const parts = normalizedSig.split("|");
  if (parts.length >= 2 && parts[1]) {
    return parseClrTypeString(parts[1]);
  }
  return { kind: "unknownType" };
};

/**
 * Parse method signature from normalized signature.
 *
 * Format: "Name|(ParamTypes):ReturnType|static=bool"
 * Example: "Substring|(System.Int32,System.Int32):System.String|static=false"
 */
const parseMethodSignature = (
  normalizedSig: string,
  method: RawBindingsMethod
): MethodSignatureEntry => {
  // Parse return type
  const returnMatch = normalizedSig.match(/\):([^|]+)\|/);
  const returnType =
    returnMatch && returnMatch[1]
      ? parseClrTypeString(returnMatch[1])
      : { kind: "voidType" as const };

  // Parse parameter types
  const paramsMatch = normalizedSig.match(/\|\(([^)]*)\):/);
  const parameters: ParameterEntry[] = [];
  const modifierByIndex = new Map<number, ParameterMode>();
  for (const m of method.parameterModifiers ?? []) {
    if (m.modifier === "ref" || m.modifier === "out" || m.modifier === "in") {
      modifierByIndex.set(m.index, m.modifier);
    }
  }

  if (paramsMatch && paramsMatch[1]) {
    const paramTypes = splitTypeArguments(paramsMatch[1]);
    for (let i = 0; i < paramTypes.length; i++) {
      const rawParamType = paramTypes[i];
      if (!rawParamType) continue;
      let paramType = rawParamType.trim();
      let mode: ParameterMode = modifierByIndex.get(i) ?? "value";

      // Handle ref/out/in modifiers
      if (paramType.endsWith("&")) {
        // tsbindgen normalized signatures mark byref with '&'. Use the more
        // precise modifier metadata when available.
        mode = modifierByIndex.get(i) ?? "ref";
        paramType = paramType.slice(0, -1);
      }

      parameters.push({
        name: `p${i}`, // We don't have parameter names in normalized signature
        type: parseClrTypeString(paramType),
        mode,
        isOptional: false,
        isRest: false,
      });
    }
  }

  const typeParameters =
    method.arity > 0
      ? Array.from({ length: method.arity }, (_, i) => ({ name: `T${i}` }))
      : [];

  return {
    stableId: method.stableId,
    parameters,
    returnType,
    typeParameters,
    parameterCount: method.parameterCount,
    isStatic: method.isStatic,
    isExtensionMethod: method.isExtensionMethod,
    sourceInterface: method.sourceInterface,
    normalizedSignature: normalizedSig,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// RAW TYPE → NOMINAL ENTRY CONVERSION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert raw metadata type to NominalEntry.
 */
const convertRawType = (
  rawType: RawBindingsType,
  _namespace: string
): NominalEntry => {
  // Parse stableId
  const parsed = parseStableId(rawType.stableId);
  if (!parsed) {
    throw new Error(`Invalid stableId: ${rawType.stableId}`);
  }

  const typeId = makeTypeId(
    rawType.stableId,
    rawType.clrName,
    parsed.assemblyName,
    tsbindgenClrTypeNameToTsTypeName(rawType.clrName)
  );

  // Convert kind
  const kindMap: Record<string, NominalKind> = {
    Class: "class",
    Interface: "interface",
    Struct: "struct",
    Enum: "enum",
    Delegate: "delegate",
  };
  const kind = kindMap[rawType.kind] ?? "class";

  // Convert properties to members
  const members = new Map<string, MemberEntry>();

  for (const prop of rawType.properties) {
    const propTsName = prop.clrName;
    const memberEntry: MemberEntry = {
      tsName: propTsName,
      clrName: prop.clrName,
      memberKind: "property" as MemberKind,
      type: parsePropertyType(prop.normalizedSignature),
      isStatic: prop.isStatic,
      isReadonly: !prop.hasSetter,
      isAbstract: prop.isAbstract,
      isVirtual: prop.isVirtual,
      isOverride: prop.isOverride,
      isIndexer: prop.isIndexer,
      hasGetter: prop.hasGetter,
      hasSetter: prop.hasSetter,
      stableId: prop.stableId,
    };
    members.set(propTsName, memberEntry);
  }

  // Convert fields to members
  for (const field of rawType.fields) {
    const fieldTsName = field.clrName;
    const memberEntry: MemberEntry = {
      tsName: fieldTsName,
      clrName: field.clrName,
      memberKind: "field" as MemberKind,
      type: parseFieldType(field.normalizedSignature),
      isStatic: field.isStatic,
      isReadonly: field.isReadOnly || field.isLiteral,
      isAbstract: false,
      isVirtual: false,
      isOverride: false,
      isIndexer: false,
      hasGetter: true,
      hasSetter: !field.isReadOnly && !field.isLiteral,
      stableId: field.stableId,
    };
    members.set(fieldTsName, memberEntry);
  }

  // Convert methods to members (grouped by name for overloads)
  const methodsByName = new Map<string, RawBindingsMethod[]>();
  for (const method of rawType.methods) {
    const existing = methodsByName.get(method.clrName) ?? [];
    existing.push(method);
    methodsByName.set(method.clrName, existing);
  }

  for (const [methodName, overloads] of methodsByName) {
    const signatures = overloads.map((m) =>
      parseMethodSignature(m.normalizedSignature, m)
    );
    const first = overloads[0];
    if (!first) continue; // Should never happen since we only add non-empty arrays

    const memberEntry: MemberEntry = {
      tsName: methodName,
      clrName: first.clrName,
      memberKind: "method" as MemberKind,
      signatures,
      isStatic: first.isStatic,
      isReadonly: true, // methods are readonly
      isAbstract: first.isAbstract,
      isVirtual: first.isVirtual,
      isOverride: first.isOverride,
      isIndexer: false,
      hasGetter: false,
      hasSetter: false,
      stableId: first.stableId,
    };
    members.set(methodName, memberEntry);
  }

  const typeParameters: TypeParameterEntry[] =
    rawType.typeParameters && rawType.typeParameters.length === rawType.arity
      ? rawType.typeParameters.map((name) => ({ name }))
      : Array.from({ length: rawType.arity }, (_, i) => ({
          name: i === 0 ? "T" : `T${i + 1}`,
        }));

  const heritage: HeritageEdge[] = [];

  if (rawType.baseType) {
    heritage.push({
      kind: "extends",
      targetStableId: rawType.baseType.stableId,
      typeArguments: (rawType.baseType.typeArguments ?? []).map(
        parseClrTypeString
      ),
    });
  }

  for (const iface of rawType.interfaces ?? []) {
    heritage.push({
      kind: "implements",
      targetStableId: iface.stableId,
      typeArguments: (iface.typeArguments ?? []).map(parseClrTypeString),
    });
  }

  // Dedup + stable sort (airplane-grade determinism)
  const heritageSeen = new Set<string>();
  const heritageDeduped: HeritageEdge[] = [];
  for (const edge of heritage) {
    const key = `${edge.kind}|${edge.targetStableId}|${JSON.stringify(edge.typeArguments)}`;
    if (heritageSeen.has(key)) continue;
    heritageSeen.add(key);
    heritageDeduped.push(edge);
  }
  heritageDeduped.sort((a, b) => {
    const rank = (k: HeritageEdge["kind"]) => (k === "extends" ? 0 : 1);
    const ra = rank(a.kind);
    const rb = rank(b.kind);
    if (ra !== rb) return ra - rb;
    const stable = a.targetStableId.localeCompare(b.targetStableId);
    if (stable !== 0) return stable;
    return JSON.stringify(a.typeArguments).localeCompare(
      JSON.stringify(b.typeArguments)
    );
  });

  // Convert accessibility
  const accessibilityMap: Record<
    string,
    "public" | "internal" | "private" | "protected"
  > = {
    Public: "public",
    Internal: "internal",
    Private: "private",
    Protected: "protected",
  };
  const accessibility = accessibilityMap[rawType.accessibility] ?? "public";

  return {
    typeId,
    kind,
    typeParameters,
    heritage: heritageDeduped,
    members,
    origin: "assembly",
    accessibility,
    isAbstract: rawType.isAbstract,
    isSealed: rawType.isSealed,
    isStatic: rawType.isStatic,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// FILE DISCOVERY AND LOADING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find all @tsonic packages in node_modules.
 */
const findTsonicPackages = (nodeModulesPath: string): string[] => {
  const tsonicDir = path.join(nodeModulesPath, "@tsonic");
  if (!fs.existsSync(tsonicDir)) {
    return [];
  }

  const packages: string[] = [];
  for (const entry of fs.readdirSync(tsonicDir, { withFileTypes: true })) {
    const fullPath = path.join(tsonicDir, entry.name);

    if (entry.isDirectory()) {
      packages.push(fullPath);
      continue;
    }

    // In multi-repo workspaces, @tsonic packages are often symlinked into node_modules.
    // Dirent reports these as symbolic links, so we must stat the target to detect
    // directory packages.
    if (entry.isSymbolicLink()) {
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          packages.push(fullPath);
        }
      } catch {
        // Ignore broken links.
      }
    }
  }
  return packages;
};

/**
 * Find all bindings.json files in a package.
 */
const findBindingsFiles = (packagePath: string): string[] => {
  const bindingsFiles: string[] = [];

  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name === "bindings.json") {
        bindingsFiles.push(fullPath);
      }
    }
  };

  walk(packagePath);
  return bindingsFiles;
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LOADER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Load all assembly types from node_modules/@tsonic packages.
 *
 * @param nodeModulesPath - Path to node_modules directory
 * @returns AssemblyTypeCatalog with all loaded types
 */
export const loadClrCatalog = (
  nodeModulesPath: string,
  extraPackageRoots: readonly string[] = []
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();
  const dtsFiles = new Set<string>();

  // Find all @tsonic packages
  const packageRoots = new Set<string>(findTsonicPackages(nodeModulesPath));
  for (const extra of extraPackageRoots) {
    packageRoots.add(extra);
  }

  for (const packagePath of Array.from(packageRoots).sort()) {
    // Find all bindings.json files
    const bindingsFiles = findBindingsFiles(packagePath);

    for (const bindingsPath of bindingsFiles) {
      try {
        const internalDtsPath = path.join(
          path.dirname(bindingsPath),
          "internal",
          "index.d.ts"
        );
        if (fs.existsSync(internalDtsPath)) {
          dtsFiles.add(internalDtsPath);
        }

        const content = fs.readFileSync(bindingsPath, "utf-8");
        const bindings: RawBindingsFile = JSON.parse(content);

        for (const rawType of bindings.types) {
          const entry = convertRawType(rawType, bindings.namespace);

          // Add to entries map
          entries.set(entry.typeId.stableId, entry);

          // Add to name lookup maps
          tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
          clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

          // Add to namespace map
          const nsTypes = namespaceToTypeIds.get(bindings.namespace) ?? [];
          nsTypes.push(entry.typeId);
          namespaceToTypeIds.set(bindings.namespace, nsTypes);
        }
      } catch (e) {
        // Log but continue - don't fail on malformed files
        console.warn(`Failed to load metadata from ${bindingsPath}:`, e);
      }
    }
  }

  // Enrich CLR catalog with heritage edges and type parameter names by parsing
  // tsbindgen internal `index.d.ts` files. This is required for deterministic
  // generic inference through inheritance (e.g., List<T> → IEnumerable<T>).
  enrichAssemblyEntriesFromTsBindgenDts(
    entries,
    tsNameToTypeId,
    Array.from(dtsFiles).sort()
  );

  return {
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds,
  };
};

/**
 * Load CLR catalog from a specific package (for testing).
 */
export const loadSinglePackageBindings = (
  bindingsPath: string
): AssemblyTypeCatalog => {
  const entries = new Map<string, NominalEntry>();
  const tsNameToTypeId = new Map<string, TypeId>();
  const clrNameToTypeId = new Map<string, TypeId>();
  const namespaceToTypeIds = new Map<string, TypeId[]>();
  const dtsPath = path.join(
    path.dirname(bindingsPath),
    "internal",
    "index.d.ts"
  );

  const content = fs.readFileSync(bindingsPath, "utf-8");
  const bindings: RawBindingsFile = JSON.parse(content);

  for (const rawType of bindings.types) {
    const entry = convertRawType(rawType, bindings.namespace);

    entries.set(entry.typeId.stableId, entry);
    tsNameToTypeId.set(entry.typeId.tsName, entry.typeId);
    clrNameToTypeId.set(entry.typeId.clrName, entry.typeId);

    const nsTypes = namespaceToTypeIds.get(bindings.namespace) ?? [];
    nsTypes.push(entry.typeId);
    namespaceToTypeIds.set(bindings.namespace, nsTypes);
  }

  if (fs.existsSync(dtsPath)) {
    enrichAssemblyEntriesFromTsBindgenDts(entries, tsNameToTypeId, [dtsPath]);
  }

  return {
    entries,
    tsNameToTypeId,
    clrNameToTypeId,
    namespaceToTypeIds,
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// CATALOG QUERY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get a type entry by stableId.
 */
export const getTypeByStableId = (
  catalog: AssemblyTypeCatalog,
  stableId: string
): NominalEntry | undefined => {
  return catalog.entries.get(stableId);
};

/**
 * Get a type entry by TS name.
 */
export const getTypeByTsName = (
  catalog: AssemblyTypeCatalog,
  tsName: string
): NominalEntry | undefined => {
  const typeId = catalog.tsNameToTypeId.get(tsName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a type entry by CLR name.
 */
export const getTypeByClrName = (
  catalog: AssemblyTypeCatalog,
  clrName: string
): NominalEntry | undefined => {
  const typeId = catalog.clrNameToTypeId.get(clrName);
  return typeId ? catalog.entries.get(typeId.stableId) : undefined;
};

/**
 * Get a member from a type by TS name.
 */
export const getMemberByTsName = (
  catalog: AssemblyTypeCatalog,
  typeStableId: string,
  memberTsName: string
): MemberEntry | undefined => {
  const entry = catalog.entries.get(typeStableId);
  return entry?.members.get(memberTsName);
};
