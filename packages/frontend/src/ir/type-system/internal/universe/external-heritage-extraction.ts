/**
 * native target Heritage Extraction
 *
 * Heritage extraction from tsbindgen .d.ts files:
 * - Extracting heritage edges (extends/implements) from tsbindgen .d.ts AST
 * - Extracting member types and method signature optionals from .d.ts
 * - Type parameter extraction from .d.ts declarations
 */

import * as fs from "fs";
import type { TstsNode } from "@tsonic/tsts";
import {
  getTstsDeclaredTypeNode,
  getTstsHeritageClauseDetails,
  getTstsIdentifierText,
  getTstsMemberNodes,
  getTstsNodeNameText,
  getTstsParameters,
  getTstsPropertyNameText,
  getTstsStatementNodes,
  getTstsTypeArguments,
  getTstsTypeParameterNodes,
  hasTstsStaticModifier,
  isTstsOptionalParameter,
  isTstsRestParameter,
  parseTstsSourceFile,
  TstsSyntax,
} from "@tsonic/tsts";
import type { IrType } from "../../../types/index.js";
import type { TypeId, NominalEntry, HeritageEdge } from "./types.js";
import {
  dtsTypeNodeToIrType,
  makeMethodOverloadKey,
  INSTANCE_SUFFIX,
  VIEWS_PREFIX,
  VIEWS_SUFFIX,
  stripTsBindgenInstanceSuffix,
  stripTsBindgenViewsWrapper,
  getRightmostPropertyAccessText,
} from "./external-type-parser.js";
import { compareHeritageEdges, heritageEdgeKey } from "./heritage-edge-key.js";

export type TsBindgenDtsTypeInfo = {
  readonly typeParametersByTsName: ReadonlyMap<string, readonly string[]>;
  readonly sourceCarrierNamesByTsName: ReadonlyMap<string, string>;
  readonly heritageByTsName: ReadonlyMap<string, readonly HeritageEdge[]>;
  readonly memberTypesByTsName: ReadonlyMap<
    string,
    ReadonlyMap<string, IrType>
  >;
  readonly methodSignatureSurfacesByTsName: ReadonlyMap<
    string,
    ReadonlyMap<string, TsBindgenDtsMethodSignatureSurface>
  >;
  readonly methodSignatureOptionalsByTsName: ReadonlyMap<
    string,
    ReadonlyMap<string, readonly boolean[]>
  >;
};

export type TsBindgenDtsMethodSignatureSurface = {
  readonly typeParameterNames: readonly string[];
  readonly parameters: readonly {
    readonly type: IrType;
    readonly isRest: boolean;
    readonly isOptional: boolean;
  }[];
  readonly returnType: IrType;
};

export const extractHeritageFromTsBindgenDts = (
  dtsPath: string,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  entries: ReadonlyMap<string, NominalEntry>
): TsBindgenDtsTypeInfo => {
  const typeParametersByTsName = new Map<string, readonly string[]>();
  const sourceCarrierNamesByTsName = new Map<string, string>();
  const heritageByTsName = new Map<string, HeritageEdge[]>();
  const memberTypesByTsName = new Map<string, Map<string, IrType>>();
  const methodSignatureSurfacesByTsName = new Map<
    string,
    Map<string, TsBindgenDtsMethodSignatureSurface>
  >();
  const methodSignatureOptionalsByTsName = new Map<
    string,
    Map<string, readonly boolean[]>
  >();

  const content = fs.readFileSync(dtsPath, "utf-8");
  const sf = parseTstsSourceFile(content, { fileName: dtsPath });

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

  const recordMethodSignatureSurface = (
    sourceTsName: string,
    signatureKey: string,
    surface: TsBindgenDtsMethodSignatureSurface
  ): void => {
    const map =
      methodSignatureSurfacesByTsName.get(sourceTsName) ??
      new Map<string, TsBindgenDtsMethodSignatureSurface>();
    if (!map.has(signatureKey)) {
      map.set(signatureKey, surface);
      methodSignatureSurfacesByTsName.set(sourceTsName, map);
    }
  };

  const getPropertyNameText = (member: TstsNode): string | undefined =>
    getTstsPropertyNameText(member);

  const extractMethodSignatureOptionalsFromMembers = (
    baseTsName: string,
    members: readonly TstsNode[],
    typeTypeParams: readonly string[],
    staticOverride?: boolean
  ): void => {
    const typeScope = new Set<string>(typeTypeParams);

    for (const member of members) {
      if (
        !TstsSyntax.IsMethodSignatureDeclaration(member) &&
        !TstsSyntax.IsMethodDeclaration(member)
      ) {
        continue;
      }

      const methodName = getTstsPropertyNameText(member);
      if (!methodName) continue;

      const methodTypeParams = getTstsTypeParameterNodes(member).map(
        (p) => getTstsNodeNameText(p) ?? ""
      );
      const inScopeTypeParams = new Set<string>([
        ...Array.from(typeScope),
        ...methodTypeParams.filter((name) => name.length > 0),
      ]);

      const params: { type: IrType; isRest: boolean; isOptional: boolean }[] =
        [];
      for (const param of getTstsParameters(member)) {
        const paramType = getTstsDeclaredTypeNode(param);
        if (!paramType) {
          // Deterministic: without an explicit type, we can't match this overload to metadata.
          params.length = 0;
          break;
        }

        params.push({
          type: dtsTypeNodeToIrType(
            paramType,
            inScopeTypeParams,
            tsNameToTypeId
          ),
          isRest: isTstsRestParameter(param),
          isOptional: isTstsOptionalParameter(param),
        });
      }

      if (params.length === 0 && getTstsParameters(member).length > 0) {
        continue;
      }

      const memberType = getTstsDeclaredTypeNode(member);
      const returnType = memberType
        ? dtsTypeNodeToIrType(memberType, inScopeTypeParams, tsNameToTypeId)
        : ({ kind: "voidType" } as const);

      const isStatic =
        staticOverride ?? hasTstsStaticModifier(member);

      const signatureKey = makeMethodOverloadKey({
        isStatic,
        name: methodName,
        typeParamCount: methodTypeParams.length,
        parameters: params.map((p) => ({ type: p.type, isRest: p.isRest })),
      });

      recordMethodSignatureSurface(baseTsName, signatureKey, {
        typeParameterNames: methodTypeParams,
        parameters: params,
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
    members: readonly TstsNode[],
    inScopeTypeParams: ReadonlySet<string>
  ): void => {
    for (const member of members) {
      if (TstsSyntax.IsPropertySignatureDeclaration(member)) {
        const nameText = getPropertyNameText(member);
        const memberType = getTstsDeclaredTypeNode(member);
        if (!nameText || !memberType) continue;
        recordMemberType(
          baseTsName,
          nameText,
          dtsTypeNodeToIrType(memberType, inScopeTypeParams, tsNameToTypeId)
        );
        continue;
      }

      if (TstsSyntax.IsPropertyDeclaration(member)) {
        const nameText = getPropertyNameText(member);
        const memberType = getTstsDeclaredTypeNode(member);
        if (!nameText || !memberType) continue;
        recordMemberType(
          baseTsName,
          nameText,
          dtsTypeNodeToIrType(memberType, inScopeTypeParams, tsNameToTypeId)
        );
        continue;
      }

      if (TstsSyntax.IsGetAccessorDeclaration(member)) {
        const nameText = getPropertyNameText(member);
        const memberType = getTstsDeclaredTypeNode(member);
        if (!nameText || !memberType) continue;
        recordMemberType(
          baseTsName,
          nameText,
          dtsTypeNodeToIrType(memberType, inScopeTypeParams, tsNameToTypeId)
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
    clauses: readonly {
      readonly kind: "extends" | "implements";
      readonly types: readonly (TstsNode | undefined)[];
    }[],
    forceKind?: HeritageEdge["kind"]
  ) => {
    for (const clause of clauses) {
      for (const t of clause.types) {
        if (!t) continue;
        const expression = TstsSyntax.Node_Expression(t);
        const rawTarget = expression
          ? getRightmostPropertyAccessText(expression)
          : undefined;
        if (!rawTarget) continue;
        const targetTsName = stripTsBindgenInstanceSuffix(rawTarget);

        const targetTypeId = tsNameToTypeId.get(targetTsName);
        if (!targetTypeId) continue;
        const targetEntry = entries.get(targetTypeId.stableId);
        if (!targetEntry) continue;

        const typeArguments = getTstsTypeArguments(t)
          .filter((a): a is TstsNode => a !== undefined)
          .map((a) =>
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

  const addHeritageFromViewsInterface = (viewsDecl: TstsNode) => {
    const viewName = getTstsNodeNameText(viewsDecl);
    const baseTsName = viewName ? stripTsBindgenViewsWrapper(viewName) : undefined;
    if (!baseTsName) return;

    const sourceEntry = getEntry(baseTsName);
    if (!sourceEntry) return;

    const inScopeTypeParams = new Set<string>(
      getTstsTypeParameterNodes(viewsDecl)
        .map((p) => getTstsNodeNameText(p) ?? "")
        .filter((name) => name.length > 0)
    );

    for (const m of getTstsMemberNodes(viewsDecl)) {
      if (!m || !TstsSyntax.IsMethodSignatureDeclaration(m)) continue;
      const methodName = getTstsPropertyNameText(m);
      if (!methodName || !methodName.startsWith("As_")) continue;
      const methodType = getTstsDeclaredTypeNode(m);
      if (!methodType) continue;

      const returnType = dtsTypeNodeToIrType(
        methodType,
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

  for (const stmt of getTstsStatementNodes(sf)) {
    if (!stmt) continue;
    // export interface Foo$instance<T> ...
    if (TstsSyntax.IsInterfaceDeclaration(stmt)) {
      const nameText = getTstsNodeNameText(stmt);
      if (!nameText) continue;

      // Views wrapper: __Foo$views<T> { As_ProviderIterable_1(): ProviderIterable_1$instance<T> }
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
      if (!sourceCarrierNamesByTsName.has(baseTsName)) {
        sourceCarrierNamesByTsName.set(baseTsName, nameText);
      }

      const typeParams = getTstsTypeParameterNodes(stmt)
        .map((p) => getTstsNodeNameText(p) ?? "")
        .filter((name) => name.length > 0);
      if (!typeParametersByTsName.has(baseTsName)) {
        typeParametersByTsName.set(baseTsName, typeParams);
      }

      const inScopeTypeParams = new Set<string>(typeParams);
      addHeritageFromHeritageClauses(
        baseTsName,
        sourceEntry,
        inScopeTypeParams,
        getTstsHeritageClauseDetails(stmt)
      );

      extractMemberTypesFromInstanceDecl(
        baseTsName,
        getTstsMemberNodes(stmt).filter(
          (member): member is TstsNode => member !== undefined
        ),
        inScopeTypeParams
      );

      extractMethodSignatureOptionalsFromMembers(
        baseTsName,
        getTstsMemberNodes(stmt).filter(
          (member): member is TstsNode => member !== undefined
        ),
        typeParams
      );
      continue;
    }

    // export abstract class Foo$instance { ... } (static namespaces)
    if (TstsSyntax.IsClassDeclaration(stmt)) {
      const nameText = getTstsNodeNameText(stmt);
      if (!nameText) continue;
      if (!nameText.endsWith(INSTANCE_SUFFIX)) continue;

      const baseTsName = stripTsBindgenInstanceSuffix(nameText);
      const sourceEntry = getEntry(baseTsName);
      if (!sourceEntry) continue;
      if (!sourceCarrierNamesByTsName.has(baseTsName)) {
        sourceCarrierNamesByTsName.set(baseTsName, nameText);
      }

      const typeParams = getTstsTypeParameterNodes(stmt)
        .map((p) => getTstsNodeNameText(p) ?? "")
        .filter((name) => name.length > 0);
      if (!typeParametersByTsName.has(baseTsName)) {
        typeParametersByTsName.set(baseTsName, typeParams);
      }

      const inScopeTypeParams = new Set<string>(typeParams);

      for (const clause of getTstsHeritageClauseDetails(stmt)) {
        addHeritageFromHeritageClauses(
          baseTsName,
          sourceEntry,
          inScopeTypeParams,
          [clause],
          clause.kind
        );
      }

      extractMemberTypesFromInstanceDecl(
        baseTsName,
        getTstsMemberNodes(stmt).filter(
          (member): member is TstsNode => member !== undefined
        ),
        inScopeTypeParams
      );

      extractMethodSignatureOptionalsFromMembers(
        baseTsName,
        getTstsMemberNodes(stmt).filter(
          (member): member is TstsNode => member !== undefined
        ),
        typeParams
      );
    }

    // tsbindgen emits static members and constructors as top-level const containers:
    //   export const JsonValue: { create(...): JsonValue; new<T>(...): List_1<T>; ... }
    //
    // native target metadata lacks optional parameter flags, so we hydrate them from the d.ts
    // surface to support deterministic arity checks (and thus overload correction).
    if (TstsSyntax.IsVariableStatement(stmt)) {
      const declarationList = TstsSyntax.AsVariableStatement(stmt)
        ?.DeclarationList;
      const declarations =
        TstsSyntax.AsVariableDeclarationList(declarationList)?.Declarations
          ?.Nodes ?? [];
      for (const decl of declarations) {
        if (!decl) continue;
        const declarationName = getTstsIdentifierText(TstsSyntax.Node_Name(decl));
        const declarationType = getTstsDeclaredTypeNode(decl);
        if (
          !declarationName ||
          !declarationType ||
          !TstsSyntax.IsTypeLiteralNode(declarationType)
        ) {
          continue;
        }

        const baseTsName = stripTsBindgenInstanceSuffix(declarationName);
        extractMethodSignatureOptionalsFromMembers(
          baseTsName,
          getTstsMemberNodes(declarationType).filter(
            (member): member is TstsNode => member !== undefined
          ),
          [],
          true
        );
      }
    }
  }

  const dedupedHeritageByTsName = new Map<string, readonly HeritageEdge[]>();
  for (const [tsName, edges] of heritageByTsName) {
    const seen = new Set<string>();
    const unique: HeritageEdge[] = [];
    for (const e of edges) {
      const key = heritageEdgeKey(e);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(e);
    }
    unique.sort(compareHeritageEdges);
    dedupedHeritageByTsName.set(tsName, unique);
  }

  return {
    typeParametersByTsName,
    sourceCarrierNamesByTsName,
    heritageByTsName: dedupedHeritageByTsName,
    memberTypesByTsName,
    methodSignatureSurfacesByTsName,
    methodSignatureOptionalsByTsName,
  };
};
