import type { CompilerExtension, TstsNode } from "@tsonic/tsts";
import {
  getTstsCallExpressionDetails,
  getTstsDeclaredTypeNode,
  getTstsExpressionWithTypeArgumentsName,
  getTstsHeritageTypeNodes,
  getTstsTypeArguments,
  getTstsTypeReferenceDetails,
  isTstsClassDeclaration,
  isTstsInterfaceDeclaration,
  isTstsParameterDeclaration,
  isTstsPropertyDeclarationLike,
  visitTstsSubtree,
} from "@tsonic/tsts";
import type {
  FieldSemanticsFact,
  IntrinsicSemanticsFact,
  ParameterPassingFact,
  ParameterPassingMode,
  SourceTypeSemanticsFact,
} from "../source-frontend/source-facts.js";
import {
  collectImportedNamesByLocalName,
  coreLangModules,
  coreTypesModules,
} from "./core-imports.js";
import {
  fieldSemanticsFactKey,
  intrinsicSemanticsFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
} from "../source-frontend/source-facts.js";

const fieldFact: FieldSemanticsFact = { storage: "field" };
const extensionReceiverFact = { kind: "extension-receiver" } as const;
const interfaceHeritageFact = { kind: "interface-erasure" } as const;

const sourceTypeFact = (
  kind: SourceTypeSemanticsFact["kind"]
): SourceTypeSemanticsFact => ({ kind });

const passingFact = (mode: ParameterPassingMode): ParameterPassingFact => ({
  mode,
});

const typeWrapperPassingModes: ReadonlyMap<string, ParameterPassingMode> =
  new Map([
    ["out", "byref-writeonly-must-init"],
    ["ref", "byref-readwrite"],
    ["in", "byref-readonly"],
    ["inref", "byref-readonly"],
  ]);

const callMarkerPassingModes: ReadonlyMap<string, ParameterPassingMode> =
  new Map([
    ["out", "byref-writeonly-must-init"],
    ["ref", "byref-readwrite"],
    ["inref", "byref-readonly"],
  ]);

const intrinsicKindsBySourceName: ReadonlyMap<
  string,
  IntrinsicSemanticsFact["kind"]
> = new Map([
  ["asinterface", "asinterface"],
  ["defaultof", "defaultof"],
  ["istype", "istype"],
  ["nameof", "nameof"],
  ["sizeof", "sizeof"],
  ["stackalloc", "stackalloc"],
  ["trycast", "trycast"],
]);

const typeWrapperPassingFact = (
  node: TstsNode | undefined,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): ParameterPassingFact | undefined => {
  const typeReference = getTstsTypeReferenceDetails(node);
  if (!typeReference || typeReference.typeArguments.length !== 1) {
    return undefined;
  }

  const importedName = coreTypesBindingByLocalName.get(
    typeReference.name
  )?.importedName;
  if (!importedName) return undefined;
  const mode = typeWrapperPassingModes.get(importedName);
  return mode ? passingFact(mode) : undefined;
};

const isFieldWrapper = (
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const typeReference = getTstsTypeReferenceDetails(node);
  return (
    typeReference?.typeArguments.length === 1 &&
    coreLangBindingByLocalName.get(typeReference.name)?.importedName === "field"
  );
};

const isExtensionReceiverWrapper = (
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const typeReference = getTstsTypeReferenceDetails(node);
  return (
    typeReference?.typeArguments.length === 1 &&
    coreLangBindingByLocalName.get(typeReference.name)?.importedName ===
      "thisarg"
  );
};

const isInterfaceHeritageWrapper = (
  heritageType: TstsNode,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const heritageName = getTstsExpressionWithTypeArgumentsName(heritageType);
  return (
    heritageName !== undefined &&
    getTstsTypeArguments(heritageType).length === 1 &&
    coreLangBindingByLocalName.get(heritageName)?.importedName === "Interface"
  );
};

const isStructHeritageType = (
  heritageType: TstsNode,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const heritageName = getTstsExpressionWithTypeArgumentsName(heritageType);
  return (
    heritageName !== undefined &&
    coreTypesBindingByLocalName.get(heritageName)?.importedName === "struct"
  );
};

const structHeritageTypes = (
  node: TstsNode,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): readonly TstsNode[] =>
  getTstsHeritageTypeNodes(node).filter(
    (heritageType): heritageType is TstsNode =>
      heritageType
        ? isStructHeritageType(heritageType, coreTypesBindingByLocalName)
        : false
  );

export const createTsonicSourceSemanticsExtension = (): CompilerExtension => ({
  id: "tsonic.source-semantics",
  runsAfter: ["tsonic.numeric-primitives"],
  afterParseSourceFile: (context): void => {
    const coreTypesBindingByLocalName = collectImportedNamesByLocalName(
      context.imports,
      coreTypesModules
    );
    const coreLangBindingByLocalName = collectImportedNamesByLocalName(
      context.imports,
      coreLangModules
    );

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;

      if (isTstsClassDeclaration(node)) {
        const structMarkers = structHeritageTypes(
          node,
          coreTypesBindingByLocalName
        );
        context.facts.set(
          sourceTypeSemanticsFactKey,
          node,
          sourceTypeFact(structMarkers.length > 0 ? "struct" : "class")
        );
        for (const marker of structMarkers) {
          context.facts.set(
            sourceTypeSemanticsFactKey,
            marker,
            sourceTypeFact("struct")
          );
        }
        for (const heritageType of getTstsHeritageTypeNodes(node)) {
          if (
            heritageType &&
            isInterfaceHeritageWrapper(heritageType, coreLangBindingByLocalName)
          ) {
            context.facts.set(
              heritageWrapperSemanticsFactKey,
              heritageType,
              interfaceHeritageFact
            );
          }
        }
        return;
      }

      if (isTstsInterfaceDeclaration(node)) {
        const structMarkers = structHeritageTypes(
          node,
          coreTypesBindingByLocalName
        );
        context.facts.set(
          sourceTypeSemanticsFactKey,
          node,
          sourceTypeFact(structMarkers.length > 0 ? "struct" : "interface")
        );
        for (const marker of structMarkers) {
          context.facts.set(
            sourceTypeSemanticsFactKey,
            marker,
            sourceTypeFact("struct")
          );
        }
        for (const heritageType of getTstsHeritageTypeNodes(node)) {
          if (
            heritageType &&
            isInterfaceHeritageWrapper(heritageType, coreLangBindingByLocalName)
          ) {
            context.facts.set(
              heritageWrapperSemanticsFactKey,
              heritageType,
              interfaceHeritageFact
            );
          }
        }
        return;
      }

      const declaredType = getTstsDeclaredTypeNode(node);
      const declarationPassingFact = typeWrapperPassingFact(
        declaredType,
        coreTypesBindingByLocalName
      );
      if (declarationPassingFact && isTstsParameterDeclaration(node)) {
        context.facts.set(
          parameterPassingFactKey,
          node,
          declarationPassingFact
        );
      }
      if (declarationPassingFact && declaredType) {
        context.facts.set(
          parameterPassingFactKey,
          declaredType,
          declarationPassingFact
        );
      }

      if (
        declaredType &&
        isTstsParameterDeclaration(node) &&
        isExtensionReceiverWrapper(declaredType, coreLangBindingByLocalName)
      ) {
        context.facts.set(
          extensionReceiverSemanticsFactKey,
          node,
          extensionReceiverFact
        );
        context.facts.set(
          extensionReceiverSemanticsFactKey,
          declaredType,
          extensionReceiverFact
        );
      }

      if (
        declaredType &&
        isTstsPropertyDeclarationLike(node) &&
        isFieldWrapper(declaredType, coreLangBindingByLocalName)
      ) {
        context.facts.set(fieldSemanticsFactKey, node, fieldFact);
        context.facts.set(fieldSemanticsFactKey, declaredType, fieldFact);
      }

      const typeReferencePassingFact = typeWrapperPassingFact(
        node,
        coreTypesBindingByLocalName
      );
      if (typeReferencePassingFact) {
        context.facts.set(
          parameterPassingFactKey,
          node,
          typeReferencePassingFact
        );
      }

      if (isFieldWrapper(node, coreLangBindingByLocalName)) {
        context.facts.set(fieldSemanticsFactKey, node, fieldFact);
      }

      if (isExtensionReceiverWrapper(node, coreLangBindingByLocalName)) {
        context.facts.set(
          extensionReceiverSemanticsFactKey,
          node,
          extensionReceiverFact
        );
      }

      const call = getTstsCallExpressionDetails(node);
      if (!call?.calleeName) return;
      const importedCallName = coreLangBindingByLocalName.get(
        call.calleeName
      )?.importedName;
      if (!importedCallName) return;

      const callPassingMode = callMarkerPassingModes.get(importedCallName);
      if (
        callPassingMode &&
        call.arguments.length === 1 &&
        call.typeArguments.length === 0
      ) {
        context.facts.set(
          parameterPassingFactKey,
          node,
          passingFact(callPassingMode)
        );
      }

      const intrinsicKind = intrinsicKindsBySourceName.get(importedCallName);
      if (intrinsicKind) {
        context.facts.set(intrinsicSemanticsFactKey, node, {
          kind: intrinsicKind,
        });
      }
    });
  },
});
