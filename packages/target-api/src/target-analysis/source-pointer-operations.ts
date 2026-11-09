import type { Node } from "@tsonic/tsts";
import type { SourceApplication, SourcePresence, SourceResult, SourceTypeEvidence, SourceValueOperand } from "../public/source/contracts.js";
import type { SourcePointerFacts, SourcePointerOperation } from "../source-model/pointers.js";
import type { SourceStoragePlace } from "../source-model/protocols.js";
import type { SourcePointerProductionInput } from "./source-pointer-input.js";

function resolved<Value>(value: Value): SourceResult<Value> { return Object.freeze({ kind: "resolved", value }); }
function present<Value>(value: Value): SourcePresence<Value> { return Object.freeze({ kind: "present", value }); }
const none = Object.freeze({ kind: "none" } as const);

export function createSourcePointerOperationQuery(input: SourcePointerProductionInput): SourcePointerFacts["pointerOperation"] {
  const { core, applications, values, view, assertNode, originalComponent, unavailable } = input;
  const retained = new WeakMap<Node, ReturnType<SourcePointerFacts["pointerOperation"]>>();
  const pointee = (application: SourceApplication, index: number, observed: boolean): SourceResult<SourceTypeEvidence> => {
    const parameter = application.identity.signature.typeParameters[index];
    const bindings = application.identity.signatureBindings.filter(binding => binding.declaration === parameter);
    if (parameter === undefined || bindings.length !== 1)
      return unavailable(application.identity.invocation, "Pointer semantics require the exact selected Source application binding.");
    const value = bindings[0]!.value;
    view.assertEvidence(value);
    if (!observed) return resolved(value);
    const original = originalComponent(value);
    if (original.kind === "none") return unavailable(application.identity.invocation,
      "Pointer semantics require the observed original pointee component.");
    const matched = core.pointeeMatches(application.identity.invocation, index, original.value);
    if (matched === "unavailable") return unavailable(application.identity.invocation,
      "Pointer semantics require the observed original pointee component.");
    if (matched === "mismatch") throw new Error("Pointer semantics disagree with the original selected Source application binding.");
    return resolved(value);
  };
  return occurrence => {
    assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const original = core.operation(occurrence);
    if (original.kind === "none") { const result = resolved(none); retained.set(occurrence, result); return result; }
    const application = applications.application(occurrence);
    if (application.kind === "refused") return application;
    if (application.value.identity.invocation !== occurrence)
      throw new Error("Pointer semantics require the same original Source application.");
    if (application.value.argumentDisposition === "skip") {
      const result = resolved(none);
      retained.set(occurrence, result);
      return result;
    }
    const selected = original.value;
    const typed = selected.family === "typed-location" && selected.operation !== "view" ? selected : undefined;
    let addressed: SourceStoragePlace | undefined;
    if (typed !== undefined) {
      [...typed.arguments, ...typed.typeArguments].forEach(assertNode);
      if (typed.pointee !== "available" && typed.pointee !== "not-applicable")
        return unavailable(occurrence, `${typed.exportName}(...) requires its exact selected pointer type argument${typed.operation === "project-pointer" ? "s" : ""}.`);
      if (typed.operation === "address-of") {
        const argument = typed.arguments[0];
        if (argument === undefined) return unavailable(occurrence, `${typed.exportName}(...) requires an original storage operand.`);
        const place = input.storage(argument);
        if (place.kind === "refused") return place;
        if (place.value.kind === "none" || !place.value.value.writable)
          return unavailable(argument, `${typed.exportName}(...) requires writable storage.`);
        addressed = place.value.value;
      }
    }
    const authoredOperands: SourceValueOperand[] = [];
    for (const argument of application.value.sourceArguments) {
      if (argument.operand.kind === "refused") return argument.operand;
      authoredOperands.push(argument.operand.value);
    }
    const authored = new Set(authoredOperands.map(argument => argument.occurrence));
    const operands = new Map<Node, SourceValueOperand>();
    let expressions: readonly Node[];
    if (typed !== undefined) {
      const count = typed.operation === "store" || typed.operation === "equal-pointer" ? 2
        : typed.operation === "bind-pointer" || typed.operation === "project-pointer" ? 3 : 1;
      if (typed.arguments.length !== count || application.value.sourceArguments.length !== count ||
        application.value.sourceArguments.some((argument, index) => argument.form !== "value" ||
          argument.occurrence !== typed.arguments[index] || authoredOperands[index]!.occurrence !== typed.arguments[index]))
        return unavailable(occurrence, `${typed.exportName}(...) requires ${count} exact original value argument${count === 1 ? "" : "s"}.`);
      expressions = typed.arguments;
    } else if (selected.family === "raw-address") expressions = selected.operation === "bind-raw-pointer" ? [selected.identity]
      : selected.operation === "equal-raw-pointer" ? [selected.left, selected.right] : [selected.pointer];
    else if (selected.family === "native-pointer") expressions = selected.operation === "load" ? [selected.pointer]
      : selected.operation === "store" ? [selected.pointer, selected.value] : [selected.pointer, selected.offset];
    else if (selected.family === "typed-location" && selected.operation === "view") expressions = [selected.pointer, selected.read, selected.write];
    else if (selected.family === "raw-memory") {
      switch (selected.operation) {
        case "to-raw": expressions = [selected.pointer, selected.layout]; break;
        case "reinterpret": expressions = [selected.raw, selected.layout]; break;
        case "byte-offset": expressions = [selected.raw, selected.offset, selected.dataLayout]; break;
        case "raw-to-address-integer": expressions = [selected.raw, selected.dataLayout]; break;
        case "address-integer-to-raw": expressions = [selected.address, selected.dataLayout]; break;
      }
    } else if (selected.family === "keep-alive") expressions = [selected.value];
    else throw new Error("A pointer operation requires one canonical factual producer.");
    for (const expression of expressions) {
      assertNode(expression);
      if (!authored.has(expression)) throw new Error("Pointer operands must retain exact authored Source argument occurrences.");
      const value = addressed !== undefined && expression === typed?.arguments[0] ? resolved(addressed.value) : values.type(expression);
      if (value.kind === "refused") return value;
      operands.set(expression, Object.freeze({ occurrence: expression, value: value.value }));
    }
    const operand = (expression: Node): SourceValueOperand => {
      const value = operands.get(expression);
      if (value === undefined) throw new Error("A pointer operand must be authenticated before publication.");
      return value;
    };
    const base = { occurrence, result: application.value.result };
    let operation: SourcePointerOperation;
    if (typed !== undefined) {
      const value = pointee(application.value, typed.operation === "project-pointer" ? 1 : 0, typed.pointee === "available");
      if (value.kind === "refused") return value;
      const common = { ...base, family: "typed-location" as const, pointee: value.value };
      const argument = (index: number): SourceValueOperand => operand(typed.arguments[index]!);
      switch (typed.operation) {
        case "address-of": {
          if (addressed === undefined) throw new Error("An address operation requires its canonical validated Source place.");
          const declaration = addressed.kind === "binding" ? present(addressed.declaration)
            : addressed.kind === "member" && addressed.declarations.length === 1 ? present(addressed.declarations[0]!) : none;
          operation = Object.freeze({ ...common, operation: typed.operation, storage: argument(0), declaration, locationIdentity: addressed.storage }); break;
        }
        case "allocate": operation = Object.freeze({ ...common, operation: typed.operation, initial: argument(0), locationIdentity: occurrence }); break;
        case "load": case "hash-pointer": operation = Object.freeze({ ...common, operation: typed.operation, pointer: argument(0) }); break;
        case "store": operation = Object.freeze({ ...common, operation: typed.operation, pointer: argument(0), value: argument(1) }); break;
        case "equal-pointer": operation = Object.freeze({ ...common, operation: typed.operation, left: argument(0), right: argument(1) }); break;
        case "bind-pointer": operation = Object.freeze({ ...common, operation: typed.operation, identity: argument(0), read: argument(1),
          write: argument(2), locationIdentity: argument(0).occurrence }); break;
        case "project-pointer": {
          const source = pointee(application.value, 0, false);
          if (source.kind === "refused") return source;
          operation = Object.freeze({ ...common, operation: typed.operation, sourcePointee: source.value,
            pointer: argument(0), fromSource: argument(1), toSource: argument(2) }); break;
        }
      }
    } else if (selected.family === "raw-address") {
      const common = { ...base, family: "raw-address" as const };
      operation = selected.operation === "bind-raw-pointer" ? Object.freeze({ ...common, operation: selected.operation, identity: operand(selected.identity) })
        : selected.operation === "equal-raw-pointer" ? Object.freeze({ ...common, operation: selected.operation, left: operand(selected.left), right: operand(selected.right) })
        : Object.freeze({ ...common, operation: selected.operation, pointer: operand(selected.pointer) });
    } else if (selected.family === "native-pointer") {
      const value = pointee(application.value, 0, true);
      if (value.kind === "refused") return value;
      const common = { ...base, family: "native-pointer" as const, pointee: value.value, pointer: operand(selected.pointer) };
      operation = selected.operation === "load" ? Object.freeze({ ...common, operation: selected.operation })
        : selected.operation === "store" ? Object.freeze({ ...common, operation: selected.operation, value: operand(selected.value) })
        : Object.freeze({ ...common, operation: selected.operation, offset: operand(selected.offset) });
    } else if (selected.family === "typed-location" && selected.operation === "view") {
      const from = pointee(application.value, 0, true);
      if (from.kind === "refused") return from;
      const to = pointee(application.value, 1, true);
      if (to.kind === "refused") return to;
      operation = Object.freeze({ ...base, family: "typed-location", operation: "view", sourcePointee: from.value,
        pointee: to.value, pointer: operand(selected.pointer), read: operand(selected.read), write: operand(selected.write), optional: selected.optional });
    } else if (selected.family === "raw-memory") {
      const common = { ...base, family: "raw-memory" as const };
      if (selected.operation === "to-raw" || selected.operation === "reinterpret") {
        const value = pointee(application.value, 0, false);
        if (value.kind === "refused") return value;
        operation = selected.operation === "to-raw" ? Object.freeze({ ...common, operation: selected.operation,
          pointer: operand(selected.pointer), pointee: value.value, layout: operand(selected.layout) })
          : Object.freeze({ ...common, operation: selected.operation, raw: operand(selected.raw),
            pointee: value.value, layout: operand(selected.layout) });
      } else if (selected.operation === "byte-offset") operation = Object.freeze({ ...common, operation: selected.operation,
        raw: operand(selected.raw), offset: operand(selected.offset), integer: selected.integer, dataLayout: selected.dataLayout });
      else operation = selected.operation === "raw-to-address-integer" ? Object.freeze({ ...common, operation: selected.operation,
        raw: operand(selected.raw), integer: selected.integer, dataLayout: selected.dataLayout })
        : Object.freeze({ ...common, operation: selected.operation, address: operand(selected.address), integer: selected.integer, dataLayout: selected.dataLayout });
    } else if (selected.family === "keep-alive") operation = Object.freeze({ ...base, family: "keep-alive", operation: "keep-alive", value: operand(selected.value) });
    else throw new Error("A pointer operation requires one canonical factual producer.");
    const result = resolved(present(operation));
    retained.set(occurrence, result);
    return result;
  };
}
