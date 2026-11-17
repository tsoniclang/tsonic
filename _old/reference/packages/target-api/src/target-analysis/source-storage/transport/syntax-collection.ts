import type { SourceStorageProgram } from "../model/program.js";
import { sourceStorageValue } from "../model/program.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import type { createSourceStorageProfileEffects } from "../model/global-call-effects.js";
import { sourceCallableSignatures } from "../../../source-navigation/callable-parameters.js";
import { sourceStorageIsDataMember, sourceStorageMemberSubject, type SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageSubject } from "../../../source-model/storage.js";
import { Node_Expression, Node_Initializer, ObjectLiteralProperty_Value, sourceNodesEqual } from "../../../source-navigation/index.js";
import { sourceCallableRoles } from "../../../source-navigation/callable-boundaries.js";
import { sourceExpressionSelectsOperandValue } from "../../../source-navigation/expression-use.js";

import type { SourceStorageEdgeTypes } from "../model/relations.js";
import { sourceSuperConstructor } from "../../../source-navigation/class-initialization.js";
import { sourceStorageInvocationActual, sourceStorageInvocationArgumentAbsence } from "../graph/invocation-inputs.js";
import type { SourceStorageBudget, SourceStorageRows } from "../model/resource-budget.js";
import type { SourceStorageArgumentTransport, SourceStorageCallEffect, SourceStorageCallbackEntry, SourceStorageInvocationInputSlots } from "../../../source-model/storage.js";
import { snapshotSourceStorageCallEffect, snapshotSourceStorageCallbackEffects } from "../graph/call-effects.js";
import { sourceParameterIsProperty } from "../../../source-navigation/class-members.js";
import type { createSourceStorageStoredValues } from "../graph/stored-values.js";
import type { SourceStorageWrite } from "../model/stores.js";
import { sourceBindingWriteAtReference } from "../../../source-navigation/references-usage.js";
import { sourceStorageAccessDeclarations } from "../model/components.js";
import { sourceStoragePointerCallEffect } from "../model/pointer-effects.js";
import type { createSourceStorageProjectionFlow } from "../model/projections.js";
import type { createSourceStorageExecutionRegions } from "../graph/execution-regions.js";
import type { createSourceStorageMemberAccessors } from "../scoped/member-accessors.js";

/** The transport state and helpers the per-node collection pass records into; built by createSourceStorageTransport. */
export interface SourceStorageSyntaxCollectionContext {
  readonly source: SourceStorageProgram;
  readonly budget: SourceStorageBudget;
  readonly effects: ReturnType<typeof createSourceStorageProfileEffects>;
  readonly mutationOwners: Map<Node, SourceStorageSubject>;
  readonly invocations: Set<Node>;
  readonly pointerInvocations: Set<Node>;
  readonly invocationEffects: Map<Node, SourceStorageCallEffect>;
  readonly invocationTargets: Map<Node, SourceStorageSubject>;
  readonly invocationArguments: Map<Node, readonly Node[]>;
  readonly invocationDeclarations: Map<Node, Node>;
  readonly argumentTransports: Map<Node, readonly SourceStorageArgumentTransport[]>;
  readonly callbackEntries: Map<Node, readonly SourceStorageCallbackEntry[]>;
  readonly unresolvedInvocations: Map<Node, string>;
  readonly memberImplementations: Map<Node, Set<Node>>;
  readonly callableDeclarations: Node[];
  readonly callableDeclarationRows: SourceStorageRows;
  readonly subject: SourceStorageSubjectQuery;
  readonly step: () => boolean;
  retainCheckedContext(node: Node, sourceFile: SourceFile): boolean;
  enclosingCallable(node: Node): Node | undefined;
  valueWrapper(node: Node): boolean;
  subjectFor(node: Node | undefined): SourceStorageSubject | undefined;
  locationFor(node: Node | undefined): SourceStorageSubject | undefined;
  connect(origin: SourceStorageSubject | undefined, destination: SourceStorageSubject | undefined, types?: SourceStorageEdgeTypes): void;
  readonly projections: ReturnType<typeof createSourceStorageProjectionFlow>;
  readonly regions: ReturnType<typeof createSourceStorageExecutionRegions>;
  readonly memberAccessors: ReturnType<typeof createSourceStorageMemberAccessors>;
  readonly storedValues: ReturnType<typeof createSourceStorageStoredValues>;
  writeFor(node: Node): SourceStorageWrite | undefined;
  connectWrite(location: SourceStorageSubject | undefined, value: SourceStorageSubject | undefined): void;
  recordThrow(region: Node, origin: SourceStorageSubject): void;
  inputSlotsFor(invocation: Node): SourceStorageInvocationInputSlots | undefined;
}

/** The per-node collection pass of source storage transport: subjects, edges, writes, invocations and their transports. */
export function createSourceStorageSyntaxCollection(context: SourceStorageSyntaxCollectionContext) {
  const { source, budget, effects, mutationOwners, invocations, pointerInvocations, invocationEffects, invocationTargets, invocationArguments,
    invocationDeclarations, argumentTransports, callbackEntries, unresolvedInvocations, memberImplementations,
    callableDeclarations, callableDeclarationRows,
    subject, step, retainCheckedContext, enclosingCallable, valueWrapper, subjectFor, locationFor, connect, projections,
    regions, memberAccessors, storedValues, writeFor, connectWrite, recordThrow } = context;
  const { ast } = source;
  const { navigation } = source.facts;
  const visit = (node: Node): void => {
    if (sourceCallableRoles(ast, node).body) {
      if (!callableDeclarationRows.add(1)) return;
      callableDeclarations.push(node);
    }
    if (ast.is.IsIdentifier(node) || ast.is.IsVariableDeclaration(node) || ast.is.IsParameterDeclaration(node) || ast.is.IsBindingElement(node) ||
      ast.is.IsPropertyDeclaration(node) || ast.is.IsFunctionDeclaration(node) || ast.is.IsArrowFunction(node) ||
      ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node) ||
      valueWrapper(node) || ast.kindName(node) === "KindThisKeyword") subjectFor(node);
    if ((ast.is.IsMethodDeclaration(node) || ast.is.IsGetAccessorDeclaration(node) ||
      ast.is.IsSetAccessorDeclaration(node)) && ast.body(node) !== undefined) {
      const contracts = navigation.memberContracts(node);
      if (contracts.kind === "resolved") {
        for (const contract of contracts.contracts) {
          if (!step()) return;
          const implementations = memberImplementations.get(contract) ?? new Set<Node>();
          implementations.add(node);
          memberImplementations.set(contract, implementations);
        }
      }
    }
    if (ast.is.IsVariableDeclaration(node)) {
      const initializer = Node_Initializer(ast, node);
      const parent = ast.parent(node);
      const original = parent !== undefined && ast.is.IsCatchClause(parent) ? subject(node, "input") : subjectFor(initializer);
      connect(original, subject(node));
      if (initializer !== undefined || parent !== undefined && ast.is.IsCatchClause(parent))
        storedValues.initialize(subject(node), initializer ?? node, original);
    }
    if (ast.is.IsIdentifier(node) || ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      const selected = sourceBindingWriteAtReference(ast, node);
      const declarationInitialization = selected?.kind === "initialization" &&
        (ast.is.IsVariableDeclaration(selected.operation) && ast.name(selected.operation) === node ||
          ast.is.IsParameterDeclaration(selected.operation));
      let parameterInitialization = false;
      if (selected?.kind === "initialization" && ast.is.IsBindingElement(selected.operation)) {
        let owner: Node | undefined = selected.operation;
        while (owner !== undefined && (ast.is.IsBindingElement(owner) || ast.is.IsArrayBindingPattern(owner) || ast.is.IsObjectBindingPattern(owner))) {
          if (!step()) return;
          owner = ast.parent(owner);
        }
        parameterInitialization = owner !== undefined && ast.is.IsParameterDeclaration(owner);
      }
      const write = declarationInitialization || parameterInitialization ? undefined : writeFor(node);
      if (write !== undefined) {
        const location = locationFor(node);
        storedValues.recordWrite(location, write);
        connectWrite(location, write.value);
      }
    }
    const parent = ast.parent(node);
    if (parent !== undefined && sourceExpressionSelectsOperandValue(ast, parent, node))
      connect(subjectFor(node), subject(parent));
    // A simple assignment expression evaluates to its right operand's value (as well as storing it).
    if (parent !== undefined && ast.is.IsBinaryExpression(parent) && ast.operatorKindName(parent) === "KindEqualsToken" &&
      sourceNodesEqual(ast, ast.as.AsBinaryExpression(parent)?.Right, node))
      connect(subjectFor(node), subject(parent));
    if (ast.is.IsArrayLiteralExpression(node)) projections.literal(node);
    const bindingPattern = ast.is.IsBindingElement(node) ? ast.parent(node) : undefined;
    if (ast.is.IsSpreadAssignment(node) || bindingPattern !== undefined && ast.is.IsObjectBindingPattern(bindingPattern)) memberAccessors.record(node);
    if (ast.is.IsPropertyDeclaration(node)) {
      connect(subjectFor(Node_Initializer(ast, node)), subject(node));
      storedValues.initialize(subject(node), Node_Initializer(ast, node) ?? node, subjectFor(Node_Initializer(ast, node)));
    }
    if (ast.is.IsParameterDeclaration(node)) {
      const input = subject(node, "input");
      connect(input, subject(node));
      connect(subjectFor(Node_Initializer(ast, node)), input);
      if (sourceParameterIsProperty(ast, node)) {
        const member = sourceStorageMemberSubject(node, ast, subject);
        connect(input, member);
        storedValues.initialize(member, node, input);
      }
    }
    if ((ast.is.IsPropertyAssignment(node) || ast.is.IsShorthandPropertyAssignment(node)) &&
      sourceBindingWriteAtReference(ast, node) === undefined) {
      const member = subject(node);
      connect(subjectFor(ObjectLiteralProperty_Value(ast, node)), member);
      storedValues.initialize(member, ObjectLiteralProperty_Value(ast, node) ?? node, subjectFor(ObjectLiteralProperty_Value(ast, node)));
      if (parent !== undefined && ast.is.IsObjectLiteralExpression(parent))
        connect(subject(node), subject(parent, "value", [{ kind: "member", declaration: node }]));
    }
    if (ast.is.IsMethodDeclaration(node) && parent !== undefined && ast.is.IsObjectLiteralExpression(parent)) {
      connect(subject(node), subject(parent, "value", [{ kind: "method-value", declaration: node }]));
    }
    if (ast.is.IsArrowFunction(node)) {
      const body = ast.as.AsArrowFunction(node)?.Body;
      if (body !== undefined && !ast.is.IsBlock(body)) connect(subjectFor(body), subject(node, "return"));
    }
    if (ast.is.IsPropertyAccessExpression(node) || ast.is.IsElementAccessExpression(node)) {
      const selected = sourceStorageValue(source.facts.objects.use(node));
      const declarations = sourceStorageAccessDeclarations(source, node, "read");
      for (const declaration of declarations ?? []) {
        if (!step()) break;
        if (!ast.is.IsGetAccessorDeclaration(declaration) &&
          (ast.is.IsPropertyAccessExpression(node) || sourceStorageIsDataMember(declaration, ast))) {
          if (selected.access === "write" || selected.readType === undefined) {
            budget.reject("Source storage member reads require their exact checked instantiated value type.");
            return;
          }
          connect(sourceStorageMemberSubject(declaration, ast, subject), subjectFor(node),
            { from: selected.readType, to: selected.readType });
        }
      }
      if ((declarations?.length ?? 0) !== 0 || selected.selectedDeclaration.kind === "present") memberAccessors.record(node);
      if (selected.access !== "read") {
        const owner = subjectFor(selected.receiver.occurrence);
        if (owner !== undefined) mutationOwners.set(node, owner);
      }
    }
    if (ast.is.IsReturnStatement(node)) {
      const expression = Node_Expression(ast, node);
      connect(expression === undefined ? subject(node) : subjectFor(expression), subject(enclosingCallable(node), "return"));
    }
    if (ast.is.IsThrowStatement(node)) {
      const origin = subjectFor(Node_Expression(ast, node));
      const caught = regions.catchDestination(node);
      if (caught !== undefined) connect(origin, subject(caught, "input"));
      else {
        const region = regions.enclosing(node);
        if (region !== undefined && origin !== undefined) recordThrow(region, origin);
      }
    }
    if (ast.is.IsCallExpression(node) || ast.is.IsNewExpression(node)) {
      const selected = sourceStorageValue(source.facts.applications.application(node));
      if (selected.argumentDisposition === "skip") return;
      invocations.add(node);
      regions.recordInvocation(node);
      const pointerFact = sourceStorageValue(source.facts.protocols.pointerOperation(node));
      const pointer = pointerFact.kind === "present" ? pointerFact.value : undefined;
      const pointerEffect = sourceStoragePointerCallEffect(pointer);
      if (pointerEffect !== undefined) {
        if (!budget.row()) return;
        pointerInvocations.add(node);
      }
      if (pointer?.operation === "store") {
        const value = subjectFor(pointer.value.occurrence);
        storedValues.recordWrite(subject(node), Object.freeze({ reference: node, operation: node, kind: "mutation", destination: "pointer",
          value, values: Object.freeze([Object.freeze({ source: undefined,
            subjects: Object.freeze(value === undefined ? [] : [value]), reason: value === undefined
              ? "A native pointer write requires its exact checked value producer." : undefined })]) }));
      }
      const contributed = pointerEffect ?? effects.call(selected);
      if (contributed !== undefined) {
        const effect = snapshotSourceStorageCallEffect(contributed, selected, budget);
        if (effect !== undefined) {
          if (effect.kind === "result-allocation" && effect.allocation !== node) {
            budget.reject("Source storage allocation requires its exact checked invocation owner.");
            return;
          }
          invocationEffects.set(node, effect);
          if (effect.kind === "result-alias") connect(subjectFor(effect.argument), subjectFor(node));
        }
      }
      const signature = selected.identity.signature.declaration;
      if (signature === undefined && selected.identity.signature.composition.kind === "none" && !ast.is.IsNewExpression(node))
        unresolvedInvocations.set(node, "Source storage argument transport requires its original checked selected signature.");
      if (signature !== undefined) invocationDeclarations.set(node, signature);
      const target = subjectFor(selected.callee.occurrence);
      if (target !== undefined) invocationTargets.set(node, target);
    }
  };
  const publishInvocationInputs = (node: Node): void => {
      const selected = sourceStorageValue(source.facts.applications.application(node));
      if (selected.argumentDisposition === "skip") return;
      const signature = selected.identity.signature.declaration;
      invocationArguments.set(node, Object.freeze([
        ...(selected.receiver.kind === "value" ? [selected.receiver.occurrence] : []),
        ...selected.sourceArguments.map(argument => sourceStorageValue(argument.operand).occurrence),
      ]));
      if (signature !== undefined || selected.identity.signature.composition.kind === "present" || ast.is.IsNewExpression(node)) {
        const target = subjectFor(selected.callee.occurrence);
        const base = sourceStorageValue(sourceSuperConstructor(node, source, step));
        if (base !== undefined) connect(subjectFor(base.callee), target);
        const arguments_: SourceStorageArgumentTransport[] = [];
        const input = context.inputSlotsFor(node);
        const selectedSlots = input?.selected.kind === "resolved" ? input.selected.slots : undefined;
        for (const binding of selected.arguments) {
          if (!step()) break;
          const formal = binding.parameter.declaration;
          if (binding.parameter.signature !== selected.identity.signature || formal === undefined ||
            !navigation.includes(formal) || !ast.is.IsParameterDeclaration(formal)) {
            unresolvedInvocations.set(node, "Source storage argument transport requires the original checked selected signature parameter identity.");
            continue;
          }
          const actual = sourceStorageInvocationActual(source, selected, binding, subject, subjectFor);
          const rest = binding.parameter.form === "parameter" ? undefined
            : selectedSlots?.filter(slot =>
              slot.parameter === formal && slot.sourceParameterIndex === binding.parameter.index &&
              (slot.effectiveIndex === binding.effectiveArgumentIndex || slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex));
          const projection = binding.parameter.form === "parameter" ? [] : rest?.length === 1 ? rest[0]!.projection : undefined;
          if (actual === undefined || projection === undefined) {
            unresolvedInvocations.set(node, "Source storage argument transport requires exact selected scalar formal and actual subjects.");
            continue;
          }
          const destination = subject(formal, "input", projection);
          if (destination === undefined || !budget.row()) break;
          const formalFile = ast.getSourceFile(formal);
          if (formalFile === undefined || !navigation.includes(formalFile)) {
            const checkedFile = ast.getSourceFile(node);
            if (checkedFile === undefined || !navigation.includes(checkedFile)) {
              unresolvedInvocations.set(node, "A selected formal requires its exact checked invocation source-file owner.");
              continue;
            }
            if (!retainCheckedContext(formal, checkedFile)) break;
          }
          arguments_.push(Object.freeze({ actual: actual.subject, formal: destination, selectedParameterDeclaration: formal,
            binding }));
          if (Node_Initializer(ast, formal) === undefined || sourceStorageInvocationArgumentAbsence(source, selected, binding) !== "absent")
            connect(actual.subject, destination, { from: actual.sourceType, to: actual.targetType });
        }
        argumentTransports.set(node, Object.freeze(arguments_));
        const supplied = pointerInvocations.has(node) ? [] : effects.callbacks(selected);
        const callbacks = supplied === undefined ? undefined : snapshotSourceStorageCallbackEffects(supplied, selected, budget);
        const nativeEntries: SourceStorageCallbackEntry[] = [];
        for (const argument of arguments_) {
          if (!step()) break;
          if (sourceStorageInvocationArgumentAbsence(source, selected, argument.binding) === "absent") continue;
          const known = callbacks?.find(callback => callback.parameterIndex === argument.binding.parameter.index);
          if (callbacks !== undefined && known === undefined) continue;
          const parameterCalls = sourceStorageValue(sourceCallableSignatures(source, argument.binding.destination.applied, source.work));
          const argumentCalls = sourceStorageValue(sourceCallableSignatures(source, argument.binding.source, source.work));
          const callable = [...parameterCalls, ...argumentCalls].some(original => original.signature.identity.kind === "call");
          if (known === undefined && !callable) continue;
          if (!budget.row()) break;
          nativeEntries.push(Object.freeze({ kind: "source-storage-callback-entry" as const, invocation: node,
            argument, timing: known?.timing ?? "unknown",
            ...(known?.rejection === undefined ? {} : { rejection: known.rejection }),
            ...(known?.inputs === undefined ? {} : { inputs: known.inputs }) }));
        }
        callbackEntries.set(node, Object.freeze(nativeEntries));
      } else {
        unresolvedInvocations.set(node, "An invocation has no exact checked selected signature transport.");
      }
  };
  return Object.freeze({ visit, publishInvocationInputs });
}
