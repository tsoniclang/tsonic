import type {
  AstReader,
  ExtensionConsumerQueries,
  ExtensionFactSubject,
  SourceFile,
  Symbol,
  TargetTypeRef,
  TypeCheckerQueries,
  TypeShapeQueries,
} from "@tsonic/tsts";
import type {
  TargetCallParameterCarrierResolution,
  TargetCarrierResolution,
  TargetFactQueries,
} from "@tsonic/target-api";
import { asNode } from "../analysis/guards.js";
import { isTypeSyntaxNode } from "../analysis/guards.js";
import {
  getAliasedSymbolIfAlias,
  getResolvedSymbolForReferenceNode,
  getSemanticTypeForNode,
  getSymbolAtReferenceNode,
  isTypeReferenceQuery,
} from "../analysis/symbols.js";
import {
  getRuntimeCarrier,
  getRuntimeCarrierForType,
  getRuntimeCarrierForSemanticType,
  getRuntimeCarrierFromDeclaredFactGraph,
  targetTypeRefContainsSourcePrimitive,
} from "./runtime-carriers.js";

export function createTargetFactQueries(
  ast: AstReader,
  checker: TypeCheckerQueries,
  types: TypeShapeQueries,
  facts: ExtensionConsumerQueries,
  sourceFiles: readonly SourceFile[],
): TargetFactQueries {
  return {
    resolveRuntimeCarrier(subject) {
      return carrierResolution(
        getRuntimeCarrier(facts, subject),
        "Runtime carrier resolved from an explicit provider/source-core fact.",
        "Runtime carrier fact is missing for the requested subject.",
        subject,
      );
    },
    resolveRuntimeCarrierForNode(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return missingCarrier("Runtime carrier resolution requires a TSTS node subject.", subject);
      }
      const semanticCarrier = getRuntimeCarrierForSemanticType(ast, checker, types, facts, node, options);
      if (isTypeSyntaxNode(ast, node)) {
        return carrierResolution(
          refineTargetNamedCarrier(getRuntimeCarrier(facts, node), semanticCarrier) ??
            getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles) ??
            semanticCarrier,
          "Runtime carrier resolved from explicit type syntax facts and TSTS-selected declaration graph evidence.",
          "Runtime carrier is missing for TSTS-selected type syntax; no provider/source-core fact proved every leaf carrier.",
          node,
        );
      }
      const declaredCarrier = getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, node, options, sourceFiles);
      const directCarrier = refineTargetNamedCarrier(getRuntimeCarrier(facts, node), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getSymbolAtReferenceNode(ast, checker, node, options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getAliasedSymbolIfAlias(ast, checker, getSymbolAtReferenceNode(ast, checker, node, options), options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getAliasedSymbolIfAlias(ast, checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options)), semanticCarrier);
      if (
        declaredCarrier !== undefined &&
        (directCarrier === undefined || targetTypeRefContainsSourcePrimitive(declaredCarrier))
      ) {
        return carrierResolution(
          declaredCarrier,
          "Runtime carrier resolved by walking the TSTS-selected declaration fact graph.",
          "Runtime carrier is missing from the TSTS-selected declaration fact graph.",
          node,
        );
      }
      return carrierResolution(
        directCarrier ??
          declaredCarrier ??
          semanticCarrier,
        "Runtime carrier resolved from explicit subject, symbol, alias, resolved symbol, declaration, or semantic type facts.",
        "Runtime carrier is missing; no explicit provider/source-core fact or complete TSTS-selected derivation was available.",
        node,
      );
    },
    getTargetBinding(subject) {
      return facts.getTargetBindingFact(subject);
    },
    getTargetBindingForReference(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return undefined;
      }
      const referenceBinding = facts.getTargetBindingFact(node) ??
        facts.getTargetBindingFact(getSymbolAtReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(ast, checker, getSymbolAtReferenceNode(ast, checker, node, options), options)) ??
        facts.getTargetBindingFact(getResolvedSymbolForReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(ast, checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options));
      const semanticType = getSemanticTypeForNode(ast, checker, node, options);
      const typeBinding = facts.getTargetBindingFact(semanticType) ??
        facts.getTargetBindingFact(semanticType?.symbol);
      if (isTypeReferenceQuery(ast, node)) {
        return referenceBinding ?? typeBinding;
      }
      return referenceBinding;
    },
    resolveCallReturnRuntimeCarrier(subject) {
      const node = asNode(subject);
      const selectedCall = facts.getSelectedTargetCall(node);
      const directCallCarrier = getRuntimeCarrier(facts, node);
      const selectedReturnCarrier = selectedCall?.member.returnType;
      const sourceReturnCarrier = getRuntimeCarrier(facts, selectedCall?.sourceReturnType);
      return carrierResolution(
        directCallCarrier ??
          selectedReturnCarrier ??
          sourceReturnCarrier,
        "Call return runtime carrier resolved from explicit call-site facts or the finalized TSTS selected-target signature provenance.",
        selectedCall === undefined
          ? "Call return runtime carrier requires a finalized TSTS selected-target signature fact."
          : "Call return runtime carrier is missing from the finalized selected-target signature and its source-return provenance.",
        node,
      );
    },
    resolveCallParameterRuntimeCarriers(subject) {
      const node = asNode(subject);
      const selectedCall = facts.getSelectedTargetCall(node);
      if (selectedCall === undefined) {
        return missingCallParameterCarriers("Call parameter carrier resolution requires a finalized TSTS selected-target signature fact.", node);
      }
      return {
        kind: "resolved-parameters",
        parameters: selectedCall.member.parameters.map((parameter) => carrierResolution(
          parameter.type,
          "Call parameter carrier resolved from the finalized selected-target member parameter fact.",
          "Selected-target member parameter fact is missing a target carrier.",
          parameter.type,
        )),
        evidence: [{ message: "Call parameter carriers resolved from finalized selected-target member parameter facts." }],
      } satisfies TargetCallParameterCarrierResolution;
    },
    resolveDeclarationReturnCarrier(subject, options) {
      const node = asNode(subject);
      if (node === undefined) {
        return missingCarrier("Declaration return carrier resolution requires a TSTS node subject.", subject);
      }
      const declarationType = checker.getTypeAtLocation(node, options);
      const declarationName = ast.name(node);
      const declarationNameType = declarationName === undefined
        ? undefined
        : checker.getTypeAtLocation(declarationName, options);
      const declarationSymbol = declarationName === undefined
        ? undefined
        : checker.getSymbolAtLocation(declarationName, options);
      const resolvedDeclarationSymbol = declarationName === undefined
        ? undefined
        : checker.getResolvedSymbol(declarationName, options);
      const declarationSymbolType = declarationName === undefined
        ? undefined
        : checker.getTypeOfSymbol(declarationSymbol, options);
      const resolvedDeclarationSymbolType = declarationName === undefined
        ? undefined
        : checker.getTypeOfSymbol(resolvedDeclarationSymbol, options);
      const signature = types.getCallSignatures(declarationType, options)[0] ??
        types.getCallSignatures(declarationNameType, options)[0] ??
        types.getCallSignatures(declarationSymbolType, options)[0] ??
        types.getCallSignatures(resolvedDeclarationSymbolType, options)[0];
      const returnType = signature === undefined
        ? undefined
        : types.getReturnTypeOfSignature(signature, options);
      return carrierResolution(
        getRuntimeCarrier(facts, returnType) ??
          getRuntimeCarrier(facts, returnType?.symbol) ??
          getRuntimeCarrierForType(ast, checker, types, facts, returnType, options),
        "Declaration return carrier resolved from TSTS-selected declaration signature return type facts.",
        signature === undefined
          ? "Declaration return carrier requires a TSTS-selected declaration signature."
          : "Declaration return carrier is missing for the TSTS-selected declaration return type.",
        node,
      );
    },
  };

}

function carrierResolution(
  carrier: TargetTypeRef | undefined,
  message: string,
  missingReason: string,
  subject?: Symbol | ExtensionFactSubject,
): TargetCarrierResolution {
  return carrier === undefined
    ? missingCarrier(missingReason, subject)
    : {
        kind: "resolved",
        carrier,
        evidence: [{ message, ...(subject === undefined ? {} : { subject }) }],
      };
}

function missingCarrier(
  reason: string,
  subject?: Symbol | ExtensionFactSubject,
): TargetCarrierResolution {
  return {
    kind: "missing",
    reason,
    evidence: subject === undefined ? [] : [{ message: reason, subject }],
  };
}

function missingCallParameterCarriers(
  reason: string,
  subject?: Symbol | ExtensionFactSubject,
): TargetCallParameterCarrierResolution {
  return {
    kind: "missing",
    reason,
    evidence: subject === undefined ? [] : [{ message: reason, subject }],
  };
}

function refineTargetNamedCarrier(
  direct: TargetTypeRef | undefined,
  semantic: TargetTypeRef | undefined,
): TargetTypeRef | undefined {
  if (
    direct?.kind === "target-named" &&
    semantic?.kind === "target-named" &&
    direct.id === semantic.id &&
    (semantic.typeArguments?.length ?? 0) > 0
  ) {
    return semantic;
  }
  return direct;
}
