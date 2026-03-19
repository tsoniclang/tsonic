/**
 * CLR Heritage Extraction
 *
 * Heritage extraction from tsbindgen .d.ts files:
 * - Extracting heritage edges (extends/implements) from tsbindgen .d.ts AST
 * - Extracting member types and method signature optionals from .d.ts
 * - Type parameter extraction from .d.ts declarations
 */

import * as fs from "fs";
import * as ts from "typescript";
import type { IrType } from "../../../types/index.js";
import { tryResolveDeterministicPropertyName } from "../../../syntax/property-names.js";
import type {
  TypeId,
  NominalEntry,
  HeritageEdge,
} from "./types.js";
import {
  dtsTypeNodeToIrType,
  makeMethodSignatureKey,
  INSTANCE_SUFFIX,
  VIEWS_PREFIX,
  VIEWS_SUFFIX,
  stripTsBindgenInstanceSuffix,
  stripTsBindgenViewsWrapper,
  getRightmostPropertyAccessText,
} from "./clr-type-parser.js";

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

  const getPropertyNameText = (name: ts.PropertyName): string | undefined =>
    tryResolveDeterministicPropertyName(name);

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
