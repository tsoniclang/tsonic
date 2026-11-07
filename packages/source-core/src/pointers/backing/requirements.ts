import type { Node } from "@tsonic/tsts";
import type { HostSourceProgram, SourceNavigationCall } from "@tsonic/target-api/host";
import type { SourcePointerOperationRecord } from "@tsonic/target-api/source";
import { tsonicDescriptorAdmitsAbsence, tsonicDescriptorIsAbsent, tsonicValueType } from "../host-values.js";
import { createTsonicHostRecords, type TsonicReinterpretRecord } from "../../analysis/host-records.js";
import { createPointerContainerQueries } from "./containers.js";
import { pointerFlowCallableBoundary, pointerFlowOperand } from "./source-forms.js";

/** A physical backing origin: the Host pointer operation record of an allocation or address-of, or the Host record of a
 * reinterpretation (I1: descriptors and operand nodes only). */
export type TsonicPointerBackingOrigin =
  | (SourcePointerOperationRecord & { readonly operation: "allocate" | "address-of" })
  | TsonicReinterpretRecord;

export interface TsonicPointerBackingIssue {
  readonly node: Node;
  readonly reason: string;
}

export type TsonicPointerBackingResolution =
  | {
      readonly kind: "origins";
      readonly origins: readonly TsonicPointerBackingOrigin[];
      readonly includesUndefined: boolean;
      readonly visitedValues: number;
    }
  | {
      readonly kind: "unproven";
      readonly issues: readonly TsonicPointerBackingIssue[];
      readonly visitedValues: number;
    };

export interface TsonicPointerBackingQueries {
  resolve(expression: Node): TsonicPointerBackingResolution;
}

export function createTsonicPointerBackingQueries(
  source: HostSourceProgram,
  options: {
    readonly hasClosedCallers: (declaration: Node) => boolean;
    readonly maximumValues: number;
  },
): TsonicPointerBackingQueries {
  if (!Number.isSafeInteger(options.maximumValues) || options.maximumValues < 1) {
    throw new Error("Pointer backing requires a positive finite source-value budget.");
  }
  const { ast, navigation, facts } = source;
  const records = createTsonicHostRecords(source);
  const cached = new WeakMap<Node, TsonicPointerBackingResolution>();
  const containers = createPointerContainerQueries(source, options.maximumValues);

  return Object.freeze({ resolve });

  function resolve(expression: Node): TsonicPointerBackingResolution {
    const previous = cached.get(expression);
    if (previous !== undefined) return previous;
    const queue: Node[] = [expression];
    const seen = new Set(queue);
    const parents = new Map<Node, Set<Node>>();
    const terminals = new Set<Node>();
    const origins = new Map<Node, TsonicPointerBackingOrigin>();
    const issues: TsonicPointerBackingIssue[] = [];
    let includesUndefined = false;
    let exhausted = false;
    let inspectedStatements = 0;

    const reject = (node: Node, reason: string): void => {
      issues.push(Object.freeze({ node, reason }));
    };
    const edge = (parent: Node, value: Node | undefined): void => {
      if (value === undefined) {
        reject(parent, "The selected pointer value has no exact source origin.");
        return;
      }
      let dependents = parents.get(value);
      if (dependents === undefined) parents.set(value, dependents = new Set());
      dependents.add(parent);
      if (!seen.has(value)) {
        if (seen.size >= options.maximumValues) {
          exhausted = true;
          return;
        }
        seen.add(value);
        queue.push(value);
      }
    };
    const storageWrites = (node: Node): void => {
      const reference = navigation.sourceReferenceFor(ast.name(node));
      if (reference === undefined) {
        reject(node, "Pointer storage has no exact selected binding identity.");
        return;
      }
      for (const file of navigation.sourceFiles) {
        for (const write of navigation.bindingWritesWithin(reference.declaration, file)) {
          if (write.kind !== "assignment" || ast.operatorKindName(write.operation) !== "KindEqualsToken") {
            reject(write.operation, "Pointer backing cannot omit a non-assignment storage write.");
          } else {
            edge(node, ast.as.AsBinaryExpression(write.operation)?.Right);
          }
        }
      }
    };

    for (let cursor = 0; cursor < queue.length && !exhausted; cursor++) {
      const node = queue[cursor]!;
      const pointer = ast.is.IsCallExpression(node) ? facts.selections.pointerOperation(node) : undefined;
      if (pointer !== undefined && "kind" in pointer) {
        reject(node, pointer.message);
        continue;
      }
      if (pointer !== undefined) {
        if (pointer.call !== node) {
          reject(node, "Pointer evidence is attached to a different selected call.");
        } else if (pointer.operation === "allocate" || pointer.operation === "address-of") {
          origins.set(node, pointer as SourcePointerOperationRecord & { readonly operation: "allocate" | "address-of" });
          terminals.add(node);
        } else {
          reject(node, "A logical pointer operation does not establish physical backing.");
        }
        continue;
      }
      const raw = ast.is.IsCallExpression(node) ? records.reinterpret(node) : undefined;
      if (raw !== undefined) {
        if (raw.kind === "rejected") reject(node, raw.reason);
        else {
          origins.set(node, raw);
          terminals.add(node);
        }
        continue;
      }
      const transparent = pointerFlowOperand(ast, node);
      if (transparent !== undefined) {
        edge(node, transparent);
        continue;
      }
      if (ast.is.IsVoidExpression(node)) {
        if (ast.as.AsVoidExpression(node)?.Expression === undefined) {
          reject(node, "A void pointer value has no exact source operand.");
        } else {
          includesUndefined = true;
          terminals.add(node);
        }
        continue;
      }
      if (ast.is.IsElementAccessExpression(node) || ast.is.IsPropertyAccessExpression(node)) {
        const container = containers.resolve(node);
        if (container.kind === "unproven") reject(node, container.reason);
        else {
          for (const value of container.values) edge(node, value);
          if (container.includesUndefined) {
            includesUndefined = true;
            terminals.add(node);
          }
        }
        continue;
      }
      const valueType = tsonicValueType(source, node);
      if (valueType !== undefined && tsonicDescriptorIsAbsent(valueType)) {
        includesUndefined = true;
        terminals.add(node);
        continue;
      }
      if (ast.is.IsConditionalExpression(node)) {
        const conditional = ast.as.AsConditionalExpression(node);
        edge(node, conditional?.WhenTrue);
        edge(node, conditional?.WhenFalse);
        continue;
      }
      if (ast.is.IsIdentifier(node)) {
        edge(node, navigation.sourceReferenceFor(node)?.declaration);
        continue;
      }
      if (ast.is.IsVariableDeclaration(node)) {
        const initializer = ast.as.AsVariableDeclaration(node)?.Initializer;
        if (initializer !== undefined) edge(node, initializer);
        else reject(node, "Pointer storage has no proved initial value.");
        storageWrites(node);
        continue;
      }
      if (ast.is.IsParameterDeclaration(node)) {
        storageWrites(node);
        const initial = ast.as.AsParameterDeclaration(node)?.Initializer;
        if (initial !== undefined) edge(node, initial);
        const callable = ast.parent(node);
        if (callable === undefined || !options.hasClosedCallers(callable)) {
          reject(node, "The pointer parameter has an open caller boundary.");
          continue;
        }
        let incoming = 0;
        for (const use of navigation.declarationUses(callable)) {
          if (use.kind === "source-linkage" || use.kind === "type-only") continue;
          const callNode = callContainingTarget(use.reference);
          if (use.kind !== "direct-call" || callNode === undefined) {
            reject(use.reference, "A first-class callable use has no exact incoming pointer argument.");
            continue;
          }
          const call = navigation.call(callNode);
          const implementation = call === undefined ? undefined : selectedImplementation(call);
          const selectedParameter = call?.parameters.find(parameter => parameter.parameterDeclaration === node);
          if (call === undefined || implementation !== callable || selectedParameter === undefined ||
            call.arguments.some((_, index) => !call.bindings.some(binding => binding.sourceArgumentIndex === index))) {
            reject(callNode, "The incoming call does not select this exact implementation parameter.");
            continue;
          }
          const bindings = call.bindings.filter(binding => binding.sourceParameterIndex === selectedParameter.parameterIndex);
          if (bindings.length === 0) {
            if (!selectedParameter.acceptsOmission) {
              reject(callNode, "A required pointer argument has no selected binding.");
            } else if (initial === undefined) {
              includesUndefined = true;
              terminals.add(node);
            }
            incoming++;
          }
          for (const binding of bindings) {
            incoming++;
            if (binding.sourceForm !== "value" || binding.sourceParameterForm !== "parameter") {
              reject(callNode, "Pointer backing requires an exact non-spread parameter binding.");
            } else {
              edge(node, call.arguments[binding.sourceArgumentIndex]);
            }
          }
        }
        if (incoming === 0) reject(node, "The pointer parameter has no proved incoming value.");
        continue;
      }
      if (ast.is.IsCallExpression(node)) {
        const call = navigation.call(node);
        const implementation = call === undefined ? undefined : selectedImplementation(call);
        const body = implementation === undefined ? undefined : ast.body(implementation);
        if (implementation === undefined || body === undefined || !ast.is.IsFunctionDeclaration(implementation)) {
          reject(node, "The pointer result has no exact non-virtual source implementation.");
          continue;
        }
        // The Host result of the call admits absence (a null/undefined/void arm).
        const result = tsonicValueType(source, node);
        if (result !== undefined && tsonicDescriptorAdmitsAbsence(result)) {
          includesUndefined = true;
          terminals.add(node);
        }
        const pending: Node[] = [body];
        let returns = 0;
        while (pending.length > 0) {
          if (++inspectedStatements + seen.size > options.maximumValues) {
            exhausted = true;
            break;
          }
          const statement = pending.pop()!;
          if (ast.is.IsReturnStatement(statement)) {
            returns++;
            const returned = ast.as.AsReturnStatement(statement)?.Expression;
            if (returned === undefined) {
              includesUndefined = true;
              terminals.add(node);
            } else edge(node, returned);
          } else if (!pointerFlowCallableBoundary(ast, statement)) {
            ast.forEachChild(statement, child => { if (child !== undefined) pending.push(child); });
          }
        }
        if (returns === 0) reject(node, "The selected pointer implementation has no explicit returned origin.");
        continue;
      }
      reject(node, "The selected pointer value requires a storage-flow contract that is not proved.");
    }

    if (exhausted) reject(expression, "Pointer backing source-value budget exceeded; no partial proof is accepted.");
    const anchored = new Set(terminals);
    const settled = [...terminals];
    for (let cursor = 0; cursor < settled.length; cursor++) {
      for (const parent of parents.get(settled[cursor]!) ?? []) {
        if (!anchored.has(parent)) {
          anchored.add(parent);
          settled.push(parent);
        }
      }
    }
    if (issues.length === 0 && queue.some(node => !anchored.has(node))) {
      reject(expression, "A cyclic pointer flow has no established storage origin.");
    }
    const result: TsonicPointerBackingResolution = issues.length > 0
      ? Object.freeze({ kind: "unproven", issues: Object.freeze(issues), visitedValues: seen.size })
      : Object.freeze({ kind: "origins", origins: Object.freeze([...origins.values()]), includesUndefined, visitedValues: seen.size });
    cached.set(expression, result);
    return result;
  }

  function selectedImplementation(call: SourceNavigationCall): Node | undefined {
    const declaration = call.signature;
    if (declaration === undefined) return undefined;
    const result = navigation.callableImplementation(declaration);
    return result.kind === "resolved" ? result.implementation.declaration : undefined;
  }

  function callContainingTarget(reference: Node): Node | undefined {
    let target = reference;
    for (;;) {
      const parent = ast.parent(target);
      if (parent === undefined) return undefined;
      if (pointerFlowOperand(ast, parent) === target) target = parent;
      else return ast.is.IsCallExpression(parent) && ast.as.AsCallExpression(parent)?.Expression === target ? parent : undefined;
    }
  }
}
