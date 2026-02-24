/**
 * CLR Entry Converter
 *
 * Heritage extraction from tsbindgen .d.ts files and conversion pipeline
 * from raw bindings.json types to NominalEntry structures.
 *
 * This module handles:
 * - Extracting heritage edges (extends/implements) from tsbindgen .d.ts AST
 * - Extracting member types and method signature optionals from .d.ts
 * - Parsing normalized signatures for properties, fields, and methods
 * - Converting RawBindingsType → NominalEntry
 */

import * as fs from "fs";
import * as ts from "typescript";
import type { IrType } from "../../../types/index.js";
import { tsbindgenClrTypeNameToTsTypeName } from "../../../../tsbindgen/names.js";
import type {
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
  RawBindingsMethod,
  RawBindingsType,
} from "./types.js";
import { makeTypeId, parseStableId } from "./types.js";
import {
  parseClrTypeString,
  splitTypeArguments,
  dtsTypeNodeToIrType,
  makeMethodSignatureKey,
  INSTANCE_SUFFIX,
  VIEWS_PREFIX,
  VIEWS_SUFFIX,
  stripTsBindgenInstanceSuffix,
  stripTsBindgenViewsWrapper,
  getRightmostPropertyAccessText,
} from "./clr-type-parser.js";

// ═══════════════════════════════════════════════════════════════════════════
// TSBINDGEN .D.TS HERITAGE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

export type TsBindgenDtsTypeInfo = {
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

export const extractHeritageFromTsBindgenDts = (
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

export const enrichAssemblyEntriesFromTsBindgenDts = (
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
export const parsePropertyType = (normalizedSig: string): IrType => {
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
export const parseFieldType = (normalizedSig: string): IrType => {
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
export const parseMethodSignature = (
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
export const convertRawType = (
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
