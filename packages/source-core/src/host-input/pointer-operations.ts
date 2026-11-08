import { pointerOperationFactKey, rawPointerOperationFactKey } from "@tsonic/tsts";
import type { Node, Type } from "@tsonic/tsts";
import type { SourceApplication, SourcePointerFacts, SourcePointerOperation, SourcePresence, SourceRawLocation,
  SourceResult, SourceTypeEvidence, SourceValueOperand } from "@tsonic/target-api/source";
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
  const pointee = (application: SourceApplication, index: number, expected: Type): SourceResult<SourceTypeEvidence> => {
    const parameter = application.identity.signature.typeParameters[index];
    const bindings = application.identity.signatureBindings.filter(binding => binding.declaration === parameter);
    if (parameter === undefined || bindings.length !== 1)
      return unavailable(application.identity.invocation, "Pointer semantics require the exact selected Source application binding.");
    const value = bindings[0]!.value;
    view.assertEvidence(value);
    const terminal = observedComponent(originalComponent(value));
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
    const application = applications.application(occurrence);
    if (application.kind === "refused") return application;
    if (application.value.identity.invocation !== occurrence)
      throw new Error("Pointer semantics require the same original Source application.");
    const authored = new Set(application.value.sourceArguments.map(argument => argument.operand.occurrence));
    const operands = new Map<Node, SourceValueOperand>();
    let expressions: readonly Node[];
    if (typed !== undefined) {
      switch (typed.operation) {
        case "address-of": expressions = [typed.storageExpression]; break;
        case "allocate": expressions = [typed.initialExpression]; break;
        case "load": case "hash-pointer": expressions = [typed.pointerExpression]; break;
        case "store": expressions = [typed.pointerExpression, typed.valueExpression]; break;
        case "equal-pointer": expressions = [typed.leftExpression, typed.rightExpression]; break;
        case "bind-pointer": expressions = [typed.identityExpression, typed.readExpression, typed.writeExpression]; break;
        case "project-pointer": expressions = [typed.pointerExpression, typed.fromSourceExpression, typed.toSourceExpression]; break;
      }
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
      const selected = values.type(expression);
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
      const selected = pointee(application.value, typed.operation === "project-pointer" ? 1 : 0, typed.pointeeType);
      if (selected.kind === "refused") return selected;
      const common = { ...base, family: "typed-location" as const, pointee: selected.value };
      switch (typed.operation) {
        case "address-of":
          assertNode(typed.locationIdentity);
          if (typed.storageDeclaration !== undefined) assertNode(typed.storageDeclaration);
          operation = Object.freeze({ ...common, operation: typed.operation, storage: operand(typed.storageExpression),
            declaration: typed.storageDeclaration === undefined ? none : present(typed.storageDeclaration), locationIdentity: typed.locationIdentity }); break;
        case "allocate": assertNode(typed.locationIdentity);
          operation = Object.freeze({ ...common, operation: typed.operation, initial: operand(typed.initialExpression), locationIdentity: typed.locationIdentity }); break;
        case "load": case "hash-pointer":
          operation = Object.freeze({ ...common, operation: typed.operation, pointer: operand(typed.pointerExpression) }); break;
        case "store": operation = Object.freeze({ ...common, operation: typed.operation,
          pointer: operand(typed.pointerExpression), value: operand(typed.valueExpression) }); break;
        case "equal-pointer": operation = Object.freeze({ ...common, operation: typed.operation,
          left: operand(typed.leftExpression), right: operand(typed.rightExpression) }); break;
        case "bind-pointer": assertNode(typed.locationIdentity);
          operation = Object.freeze({ ...common, operation: typed.operation, identity: operand(typed.identityExpression),
            read: operand(typed.readExpression), write: operand(typed.writeExpression), locationIdentity: typed.locationIdentity }); break;
        case "project-pointer": {
          const source = pointee(application.value, 0, typed.sourcePointeeType);
          if (source.kind === "refused") return source;
          operation = Object.freeze({ ...common, operation: typed.operation, sourcePointee: source.value,
            pointer: operand(typed.pointerExpression), fromSource: operand(typed.fromSourceExpression), toSource: operand(typed.toSourceExpression) }); break;
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
