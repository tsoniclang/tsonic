import { pointerOperationFactKey, rawPointerOperationFactKey } from "@tsonic/tsts";
import type { Node, Type } from "@tsonic/tsts";
import type { SourceApplication, SourcePointerFacts, SourcePointerOperation, SourcePresence, SourceRawLocation,
  SourceResult, SourceStoragePlace, SourceTypeEvidence, SourceValueOperand } from "@tsonic/target-api/source";
import { tsonicNativePointerOperationFactKey } from "../pointers/facts.js";
import { tsonicPointerViewFactKey } from "../pointers/views/facts.js";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../pointers/raw-memory/facts.js";
import { selectTsonicRawLocationOperation } from "../pointers/raw-memory/selection.js";
import type { SourceCorePointerFactsInput } from "./pointer-facts.js";
import { createSourceMemoryLayoutQuery } from "./pointer-facts.js";

function resolved<Value>(value: Value): SourceResult<Value> { return Object.freeze({ kind: "resolved", value }); }
function present<Value>(value: Value): SourcePresence<Value> { return Object.freeze({ kind: "present", value }); }
const none = Object.freeze({ kind: "none" } as const);

export function createSourceCorePointerOperationQuery(input: SourceCorePointerFactsInput): SourcePointerFacts["pointerOperation"] {
  const { checked, applications, values, view, assertNode, originalComponent, observedComponent, unavailable } = input;
  const { ast, sourceFacts } = checked;
  const retained = new WeakMap<Node, SourceResult<SourcePresence<SourcePointerOperation>>>();
  const layout = createSourceMemoryLayoutQuery(input);
  const pointee = (application: SourceApplication, index: number, expected: Type | undefined): SourceResult<SourceTypeEvidence> => {
    const parameter = application.identity.signature.typeParameters[index];
    const bindings = application.identity.signatureBindings.filter(binding => binding.declaration === parameter);
    if (parameter === undefined || bindings.length !== 1)
      return unavailable(application.identity.invocation, "Pointer semantics require the exact selected Source application binding.");
    const value = bindings[0]!.value;
    view.assertEvidence(value);
    if (expected === undefined) return resolved(value);
    const original = originalComponent(value);
    const terminal = original.kind === "none" ? undefined : observedComponent(original.value);
    if (terminal === undefined) return unavailable(application.identity.invocation,
      "Pointer semantics require the observed original pointee component.");
    const file = ast.getSourceFile(application.identity.invocation);
    if (file === undefined) throw new Error("Pointer application requires its original checked file.");
    if (!checked.getSourceFileQueries(file).typeShape.isTypeIdenticalTo(terminal, expected))
      throw new Error("Pointer semantics disagree with the original selected Source application binding.");
    return resolved(value);
  };
  return occurrence => {
    assertNode(occurrence);
    const previous = retained.get(occurrence);
    if (previous !== undefined) return previous;
    const typed = sourceFacts.getFact(occurrence, pointerOperationFactKey);
    const raw = sourceFacts.getFact(occurrence, rawPointerOperationFactKey);
    const native = sourceFacts.getFact(occurrence, tsonicNativePointerOperationFactKey);
    const projected = sourceFacts.getFact(occurrence, tsonicPointerViewFactKey);
    const memory = sourceFacts.getFact(occurrence, tsonicRawMemoryOperationFactKey);
    const alive = sourceFacts.getFact(occurrence, tsonicKeepAliveFactKey);
    const count = Number(typed !== undefined) + Number(raw !== undefined) + Number(native !== undefined) +
      Number(projected !== undefined) + Number(memory !== undefined) + Number(alive !== undefined);
    if (count === 0) { const result = resolved(none); retained.set(occurrence, result); return result; }
    if (count !== 1) throw new Error("A Source operation cannot carry competing pointer meanings.");
    for (const fact of [typed, raw, projected, memory, alive]) if (fact !== undefined && fact.call !== occurrence)
      throw new Error("Pointer facts must retain the exact original operation occurrence.");
    let addressed: SourceStoragePlace | undefined;
    if (typed !== undefined) {
      for (const argument of [...typed.arguments, ...typed.typeArguments]) assertNode(argument);
      if (typed.pointee.kind === "unavailable" && typed.pointee.reason !== "not-applicable")
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
    const application = applications.application(occurrence);
    if (application.kind === "refused") return application;
    if (application.value.identity.invocation !== occurrence)
      throw new Error("Pointer semantics require the same original Source application.");
    const authored = new Set(application.value.sourceArguments.map(argument => argument.operand.occurrence));
    const operands = new Map<Node, SourceValueOperand>();
    let expressions: readonly Node[];
    if (typed !== undefined) {
      const count = typed.operation === "store" || typed.operation === "equal-pointer" ? 2
        : typed.operation === "bind-pointer" || typed.operation === "project-pointer" ? 3 : 1;
      if (typed.arguments.length !== count || application.value.sourceArguments.length !== count ||
        application.value.sourceArguments.some((argument, index) => argument.form !== "value" ||
          argument.occurrence !== typed.arguments[index] || argument.operand.occurrence !== typed.arguments[index]))
        return unavailable(occurrence, `${typed.exportName}(...) requires ${count} exact original value argument${count === 1 ? "" : "s"}.`);
      expressions = typed.arguments;
    } else if (raw !== undefined) expressions = raw.operation === "bind-raw-pointer" ? [raw.identityExpression]
      : raw.operation === "equal-raw-pointer" ? [raw.leftExpression, raw.rightExpression] : [raw.pointerExpression];
    else if (native !== undefined) expressions = native.operation === "load" ? [native.pointerExpression]
      : native.operation === "store" ? [native.pointerExpression, native.valueExpression] : [native.pointerExpression, native.offsetExpression];
    else if (projected !== undefined) expressions = [projected.pointerExpression, projected.readExpression, projected.writeExpression];
    else if (memory !== undefined) {
      switch (memory.operation) {
        case "to-raw": expressions = [memory.pointerExpression, memory.layoutExpression]; break;
        case "reinterpret": expressions = [memory.rawExpression, memory.layoutExpression]; break;
        case "byte-offset": expressions = [memory.rawExpression, memory.offsetExpression, memory.dataLayoutExpression]; break;
        case "raw-to-address-integer": expressions = [memory.rawExpression, memory.dataLayoutExpression]; break;
        case "address-integer-to-raw": expressions = [memory.addressExpression, memory.dataLayoutExpression]; break;
      }
    } else if (alive !== undefined) expressions = [alive.valueExpression];
    else throw new Error("A pointer operation requires one canonical factual producer.");
    for (const expression of expressions) {
      assertNode(expression);
      if (!authored.has(expression)) throw new Error("Pointer operands must retain exact authored Source argument occurrences.");
      const selected = addressed !== undefined && expression === typed?.arguments[0]
        ? resolved(addressed.value) : values.type(expression);
      if (selected.kind === "refused") return selected;
      operands.set(expression, Object.freeze({ occurrence: expression, value: selected.value }));
    }
    const operand = (expression: Node): SourceValueOperand => {
      const selected = operands.get(expression);
      if (selected === undefined) throw new Error("A pointer operand must be authenticated before publication.");
      return selected;
    };
    const base = { occurrence, result: application.value.result };
    let operation: SourcePointerOperation;
    if (typed !== undefined) {
      const selected = pointee(application.value, typed.operation === "project-pointer" ? 1 : 0,
        typed.pointee.kind === "available" ? typed.pointee.type : undefined);
      if (selected.kind === "refused") return selected;
      const common = { ...base, family: "typed-location" as const, pointee: selected.value };
      const argument = (index: number): SourceValueOperand => operand(typed.arguments[index]!);
      switch (typed.operation) {
        case "address-of": {
          if (addressed === undefined) throw new Error("An address operation requires its canonical validated Source place.");
          const declaration = addressed.kind === "binding" ? present(addressed.declaration)
            : addressed.kind === "member" && addressed.declarations.length === 1 ? present(addressed.declarations[0]!) : none;
          operation = Object.freeze({ ...common, operation: typed.operation, storage: argument(0),
            declaration, locationIdentity: addressed.storage }); break;
        }
        case "allocate":
          operation = Object.freeze({ ...common, operation: typed.operation, initial: argument(0), locationIdentity: occurrence }); break;
        case "load": case "hash-pointer":
          operation = Object.freeze({ ...common, operation: typed.operation, pointer: argument(0) }); break;
        case "store": operation = Object.freeze({ ...common, operation: typed.operation,
          pointer: argument(0), value: argument(1) }); break;
        case "equal-pointer": operation = Object.freeze({ ...common, operation: typed.operation,
          left: argument(0), right: argument(1) }); break;
        case "bind-pointer":
          operation = Object.freeze({ ...common, operation: typed.operation, identity: argument(0),
            read: argument(1), write: argument(2), locationIdentity: argument(0).occurrence }); break;
        case "project-pointer": {
          const source = pointee(application.value, 0, undefined);
          if (source.kind === "refused") return source;
          operation = Object.freeze({ ...common, operation: typed.operation, sourcePointee: source.value,
            pointer: argument(0), fromSource: argument(1), toSource: argument(2) }); break;
        }
      }
    } else if (raw !== undefined) {
      const common = { ...base, family: "raw-address" as const };
      operation = raw.operation === "bind-raw-pointer" ? Object.freeze({ ...common, operation: raw.operation, identity: operand(raw.identityExpression) })
        : raw.operation === "equal-raw-pointer" ? Object.freeze({ ...common, operation: raw.operation, left: operand(raw.leftExpression), right: operand(raw.rightExpression) })
        : Object.freeze({ ...common, operation: raw.operation, pointer: operand(raw.pointerExpression) });
    } else if (native !== undefined) {
      const selected = pointee(application.value, 0, native.pointeeType);
      if (selected.kind === "refused") return selected;
      const common = { ...base, family: "native-pointer" as const, pointee: selected.value, pointer: operand(native.pointerExpression) };
      operation = native.operation === "load" ? Object.freeze({ ...common, operation: native.operation })
        : native.operation === "store" ? Object.freeze({ ...common, operation: native.operation, value: operand(native.valueExpression) })
        : Object.freeze({ ...common, operation: native.operation, offset: operand(native.offsetExpression) });
    } else if (projected !== undefined) {
      const from = pointee(application.value, 0, projected.sourcePointeeType);
      if (from.kind === "refused") return from;
      const to = pointee(application.value, 1, projected.pointeeType);
      if (to.kind === "refused") return to;
      operation = Object.freeze({ ...base, family: "typed-location", operation: "view", sourcePointee: from.value,
        pointee: to.value, pointer: operand(projected.pointerExpression), read: operand(projected.readExpression),
        write: operand(projected.writeExpression), optional: projected.optional });
    } else if (memory !== undefined) {
      const common = { ...base, family: "raw-memory" as const };
      if (memory.operation === "to-raw" || memory.operation === "reinterpret") {
        const selected = pointee(application.value, 0, memory.pointeeType);
        if (selected.kind === "refused") return selected;
        const finalized = selectTsonicRawLocationOperation(ast, sourceFacts, occurrence);
        if (finalized === undefined) throw new Error("A raw location operation requires its canonical finalized selector.");
        let location: SourceRawLocation;
        if (finalized.kind === "rejected") location = Object.freeze({ kind: "rejected", reason: finalized.reason });
        else {
          const published = layout(finalized.layout, selected.value);
          if (published.kind === "refused") return published;
          location = Object.freeze({ kind: "resolved", layout: published.value });
        }
        operation = memory.operation === "to-raw" ? Object.freeze({ ...common, operation: memory.operation,
          pointer: operand(memory.pointerExpression), pointee: selected.value, layout: operand(memory.layoutExpression), location })
          : Object.freeze({ ...common, operation: memory.operation, raw: operand(memory.rawExpression),
            pointee: selected.value, layout: operand(memory.layoutExpression), location });
      } else if (memory.operation === "byte-offset") operation = Object.freeze({ ...common, operation: memory.operation,
        raw: operand(memory.rawExpression), offset: operand(memory.offsetExpression), dataLayout: memory.dataLayoutExpression,
        integer: Object.freeze({ runtimeBase: memory.offsetRuntimeBase, signedness: memory.offsetSignedness, width: memory.offsetWidth }) });
      else {
        const integer = memory.addressWidth === 32
          ? Object.freeze({ width: 32, runtimeBase: "number", signedness: "unsigned" } as const)
          : Object.freeze({ width: 64, runtimeBase: "bigint", signedness: "unsigned" } as const);
        operation = memory.operation === "raw-to-address-integer" ? Object.freeze({ ...common, operation: memory.operation,
          raw: operand(memory.rawExpression), integer, dataLayout: memory.dataLayoutExpression })
          : Object.freeze({ ...common, operation: memory.operation, address: operand(memory.addressExpression), integer, dataLayout: memory.dataLayoutExpression });
      }
    } else if (alive !== undefined) operation = Object.freeze({ ...base, family: "keep-alive", operation: "keep-alive", value: operand(alive.valueExpression) });
    else throw new Error("A pointer operation requires one canonical factual producer.");
    const result = resolved(present(operation));
    retained.set(occurrence, result);
    return result;
  };
}
