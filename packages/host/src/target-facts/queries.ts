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
  getDeclarationTypeNode,
} from "../analysis/project-source.js";
import {
  getAliasedSymbolIfAlias,
  getPrimaryDeclaration,
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
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getAliasedSymbolIfAlias(checker, getSymbolAtReferenceNode(ast, checker, node, options), options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getResolvedSymbolForReferenceNode(ast, checker, node, options)), semanticCarrier) ??
        refineTargetNamedCarrier(getRuntimeCarrier(facts, getAliasedSymbolIfAlias(checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options)), semanticCarrier);
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
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(checker, getSymbolAtReferenceNode(ast, checker, node, options), options)) ??
        facts.getTargetBindingFact(getResolvedSymbolForReferenceNode(ast, checker, node, options)) ??
        facts.getTargetBindingFact(getAliasedSymbolIfAlias(checker, getResolvedSymbolForReferenceNode(ast, checker, node, options), options));
      const semanticType = getSemanticTypeForNode(ast, checker, node, options);
      const typeBinding = facts.getTargetBindingFact(semanticType) ??
        facts.getTargetBindingFact(semanticType?.symbol);
      if (isTypeReferenceQuery(ast, node)) {
        return referenceBinding ?? typeBinding;
      }
      return referenceBinding;
    },
    resolveCallReturnRuntimeCarrier(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      const signatureDeclaration = signature === undefined ? undefined : checker.getSignatureDeclaration(signature);
      const signatureDeclarationSourceFile = ast.getSourceFile(signatureDeclaration) ?? options.sourceFile;
      const signatureReturnTypeNode = getDeclarationTypeNode(signatureDeclaration);
      const signatureReturnCarrier = signatureReturnTypeNode === undefined
        ? undefined
        : getRuntimeCarrierFromDeclaredFactGraph(
            ast,
            checker,
            types,
            facts,
            signatureReturnTypeNode,
            { sourceFile: signatureDeclarationSourceFile },
            sourceFiles,
          ) ??
          getRuntimeCarrierForSemanticType(
            ast,
            checker,
            types,
            facts,
            signatureReturnTypeNode,
            { sourceFile: signatureDeclarationSourceFile },
          );
      const returnType = signature === undefined
        ? undefined
        : checker.getReturnTypeOfSignature(signature, options);
      const directCallCarrier = getRuntimeCarrier(facts, node);
      const selectedReturnCarrier = facts.getSelectedTargetCall(node)?.member.returnType;
      return carrierResolution(
        directCallCarrier ??
          selectedReturnCarrier ??
          signatureReturnCarrier ??
          getRuntimeCarrierForType(ast, checker, types, facts, returnType, options),
        "Call return runtime carrier resolved from explicit call-site fact, finalized selected target signature, TSTS-selected declaration return graph, or TSTS-selected signature return type facts.",
        signature === undefined
          ? "Call return runtime carrier requires a TSTS-selected call signature."
          : "Call return runtime carrier is missing for the TSTS-selected signature return type.",
        node,
      );
    },
    resolveCallParameterRuntimeCarriers(subject, options) {
      const node = asNode(subject);
      const signature = node === undefined ? undefined : checker.getResolvedSignature(node, options);
      if (signature === undefined) {
        return missingCallParameterCarriers("Call parameter carrier resolution requires a TSTS-selected call signature.", node);
      }
      return {
        kind: "resolved-parameters",
        parameters: signature.parameters.map((parameter) => getRuntimeCarrierForParameter(parameter, options)),
        evidence: [{ message: "Call parameter carriers resolved from TSTS-selected signature parameter symbols." }],
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

  function getRuntimeCarrierForParameter(
    parameter: Symbol | undefined,
    options: { readonly sourceFile: SourceFile },
  ): TargetCarrierResolution {
    const direct = getRuntimeCarrier(facts, parameter);
    if (direct !== undefined) {
      return carrierResolution(
        direct,
        "Parameter runtime carrier resolved from explicit parameter symbol fact.",
        "Parameter runtime carrier fact is missing.",
        parameter,
      );
    }
    const declaration = getPrimaryDeclaration(checker, parameter);
    const declarationFile = ast.getSourceFile(declaration) ?? options.sourceFile;
    const declarationCarrier = declaration === undefined
      ? undefined
      : getRuntimeCarrierFromDeclaredFactGraph(ast, checker, types, facts, declaration, { sourceFile: declarationFile }, sourceFiles);
    if (declarationCarrier !== undefined) {
      return carrierResolution(
        declarationCarrier,
        "Parameter runtime carrier resolved from TSTS-selected parameter declaration fact graph.",
        "Parameter declaration runtime carrier is missing.",
        declaration,
      );
    }
    const type = checker.getTypeOfSymbol(parameter, options);
    return carrierResolution(
      getRuntimeCarrier(facts, type) ?? getRuntimeCarrier(facts, type?.symbol),
      "Parameter runtime carrier resolved from TSTS-selected parameter type facts.",
      "Parameter runtime carrier is missing for the TSTS-selected parameter type.",
      parameter,
    );
  }
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
