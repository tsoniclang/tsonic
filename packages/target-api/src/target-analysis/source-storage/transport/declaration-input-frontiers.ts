import type { Node } from "@tsonic/tsts";
import type { TargetSourceProgram } from "../../../source-semantics/index.js";
import { Node_Expression, Node_Initializer, sourceTransparentExpressionOperand } from "../../../source-navigation/index.js";
import { sourceBindingHasMutableExposure } from "../../../source-navigation/binding-mutation-exposure.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import { sourceExpressionCallArgument } from "../../../source-navigation/callable-arguments.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import { sourceStorageIsDataMember, sourceStorageMemberSubject } from "../model/subjects.js";
import type { createSourceStorageTransport } from "./transport.js";

export function sourceStorageHasOnlyExternalDeclarationInputs(source: TargetSourceProgram, budget: SourceStorageBudget,
  transport: ReturnType<typeof createSourceStorageTransport>, parameter: Node): boolean {
  const { ast, navigation, semantics } = source;
  const owner = ast.parent(parameter);
  if (owner === undefined || ast.body(owner) === undefined) return false;
  const parameters = sourceCallableValueParameters(ast, owner, semantics.forNode(owner), { kind: "declaration" });
  if (parameters === undefined || !parameters.includes(parameter)) return false;
  for (const formal of parameters) {
    if (!budget.step() || !ast.is.IsParameterDeclaration(formal) || !ast.is.IsIdentifier(ast.name(formal)) || Node_Initializer(ast, formal) !== undefined ||
      ast.as.AsParameterDeclaration(formal)?.DotDotDotToken !== undefined) return false;
    const summary = navigation.declarationUseSummary(formal);
    if (summary.bindingWritten || summary.memberWritten || summary.aliasedOrStored || summary.captured ||
      summary.escapeKinds.includes("yield") ||
      sourceBindingHasMutableExposure(source, summary, budget.step)) return false;
    const writes = transport.formalMemberWriteDemand(owner, formal);
    if (writes.kind !== "complete" || writes.members.length !== 0) return false;
    for (const use of summary.uses) {
      if (!budget.step()) return false;
      if (use.kind === "type-only") continue;
      if (use.role === "call-target" || use.role === "source-linkage") return false;
      let argument = use.reference;
      for (let parent = ast.parent(argument); parent !== undefined; parent = ast.parent(argument)) {
        if (!budget.step()) return false;
        if (sourceTransparentExpressionOperand(ast, parent) !== argument &&
          (!(ast.is.IsPropertyAccessExpression(parent) || ast.is.IsElementAccessExpression(parent)) ||
            Node_Expression(ast, parent) !== argument)) break;
        argument = parent;
      }
      const parent = ast.parent(argument);
      if (parent !== undefined && (ast.is.IsCallExpression(parent) || ast.is.IsNewExpression(parent)) &&
        Node_Expression(ast, parent) === argument) return false;
      const flow = navigation.expressionValueFlow(argument);
      if (flow.aliasDeclarations.length !== 0 || flow.memberWritten || flow.storedOutsideBinding ||
        flow.captured || flow.yielded || flow.receiverUsed || flow.hasUnclassifiedUse) return false;
      if (flow.passedAsArgument) {
        const selected = sourceExpressionCallArgument(argument, source);
        if (selected === undefined || !transport.hasOnlySourceImplementations(selected.call)) return false;
        const implementations = transport.invocationImplementations(selected.call);
        if (implementations.size !== 1 || !implementations.has(owner)) return false;
      }
      const context = semantics.forNode(use.reference);
      const type = context.types.expressionType(use.reference);
      if (type === undefined || context.types.isAny(type) || context.types.isUnknown(type) ||
        context.types.couldContainTypeVariables(type) || context.types.callSignatures(type).length !== 0 ||
        context.types.constructSignatures(type).length !== 0) return false;
      for (const property of context.types.propertyInfos(type)) {
        if (!budget.step()) return false;
        const declarations = new Set([property.symbol, ...property.rootSymbols].flatMap(symbol => context.declarations.symbolDeclarations(symbol)));
        if (declarations.size === 0) return false;
        for (const declaration of declarations) {
          if (!budget.step() || !sourceStorageIsDataMember(declaration, ast) || Node_Initializer(ast, declaration) !== undefined) return false;
          const member = sourceStorageMemberSubject(declaration, ast, transport.subject);
          if (member === undefined) return false;
          for (const store of transport.storesFor(member) ?? []) {
            if (!budget.step() || store.kind !== "initialization" || store.value?.kind !== "input" ||
              !ast.is.IsParameterDeclaration(store.value.node) || Node_Initializer(ast, store.value.node) !== undefined) return false;
          }
        }
      }
    }
  }
  return budget.failure() === undefined;
}
