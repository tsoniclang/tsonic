import { functionPointerFactKey, pointerFactKey, pointerOperationFactKey, providerVirtualDeclarationFactKey,
  rawPointerFactKey, rawPointerOperationFactKey, sourceMarkerFactKey } from "@tsonic/tsts";
import type { CheckedSourceProgram, ExtensionFactKey, ExtensionFactSubject, Node, Type } from "@tsonic/tsts";
import type { SourceInputComponent, SourceInputCoreQueries,
  SourceInputOriginalSubjects, SourceInputPointerOperation, SourceInputPointerType } from "@tsonic/target-api/host";
import type { TargetSourceSafetyProvider } from "@tsonic/target-api/provider";
import { tsonicCoreProviderVersion, tsonicCoreTypesModule, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { tsonicNativePointerOperationFactKey } from "./native-pointer-facts.js";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "./raw-memory-facts.js";
import { selectTsonicRawLocationOperation } from "../pointers/raw-memory/selection.js";
import { tsonicPointerViewFactKey } from "./pointer-view-facts.js";
import { createSourceCoreMarkerInput, sourceCoreMarkerFacts } from "./marker-facts.js";
import { createSourceCoreSafetyInput } from "./safety-input.js";
import { createSourceCoreAttributeInput } from "./attribute-input.js";
import { createSourceCoreMemoryInput, type SourceCoreOriginalCallInput } from "./memory-input.js";

export interface SourceCoreInputOptions extends SourceCoreOriginalCallInput {
  readonly checked: CheckedSourceProgram;
  readonly assertNode: (node: Node) => void;
  readonly observedComponent: (component: SourceInputComponent) => Type | undefined;
  readonly syntax: (node: Node) => SourceInputComponent;
  readonly safetyProviders: readonly TargetSourceSafetyProvider[];
}

export function createSourceCoreInput(input: SourceCoreInputOptions): SourceInputCoreQueries {
  const { checked, assertNode, observedComponent, syntax } = input;
  const { ast, sourceFacts } = checked;
  const markerInput = createSourceCoreMarkerInput({ sourceFacts, assertNode });
  const safetyInput = createSourceCoreSafetyInput(input);
  const attributeInput = createSourceCoreAttributeInput(input);
  const { memory, layoutIdentity } = createSourceCoreMemoryInput(input);
  const operations = new WeakMap<Node, ReturnType<SourceInputCoreQueries["operation"]>>();
  const none = Object.freeze({ kind: "none" } as const);
  const unavailable = Object.freeze({ kind: "unavailable" } as const);
  const subjects = (original: SourceInputOriginalSubjects): {
    readonly values: readonly ExtensionFactSubject[]; readonly complete: boolean;
  } => {
    const selected = new Set<ExtensionFactSubject>();
    if (original.origins.kind === "complete") for (const node of original.origins.nodes) {
      assertNode(node);
      selected.add(node);
    }
    let observed = false;
    if (original.component.kind === "present") {
      const component = original.component.value;
      const terminal = observedComponent(component);
      assertNode(component.root);
      if (component.path.length === 0) {
        selected.add(component.root);
        const annotation = ast.typeAnnotation(component.root);
        if (annotation !== undefined) { assertNode(annotation); selected.add(annotation); }
      }
      if (terminal !== undefined) {
        observed = true;
        const file = ast.getSourceFile(component.root);
        if (file === undefined) throw new Error("Original Core components require their checked source file.");
        const { checker } = checked.getSourceFileQueries(file);
        selected.add(terminal);
        for (const symbol of [checker.getTypeAliasSymbol(terminal), checker.getTypeSymbol(terminal)]) {
          if (symbol === undefined) continue;
          selected.add(symbol);
          for (const declaration of checker.getSymbolDeclarations(symbol)) if (declaration !== undefined) {
            assertNode(declaration);
            selected.add(declaration);
            const annotation = ast.typeAnnotation(declaration);
            if (annotation !== undefined) { assertNode(annotation); selected.add(annotation); }
          }
        }
      }
    }
    return Object.freeze({ values: Object.freeze([...selected]), complete: observed ||
      original.origins.kind === "complete" && original.origins.nodes.length === 0 });
  };
  const fact = <Value>(selected: readonly ExtensionFactSubject[], key: ExtensionFactKey<Value>): Value | undefined => {
    let result: Value | undefined;
    for (const subject of selected) {
      const actual = sourceFacts.getFact(subject, key);
      if (actual === undefined) continue;
      if (result !== undefined && !key.equals(result, actual))
        throw new Error("Original Core subjects contain contradictory canonical facts.");
      result = actual;
    }
    return result;
  };
  const pointerType: SourceInputCoreQueries["pointerType"] = original => {
    const selected = subjects(original);
    const pointer = fact(selected.values, pointerFactKey);
    const raw = fact(selected.values, rawPointerFactKey);
    const marker = fact(selected.values, sourceMarkerFactKey);
    const callable = fact(selected.values, functionPointerFactKey);
    let nativeDeclaration: Node | undefined;
    for (const subject of selected.values) {
      const provider = sourceFacts.getFact(subject, providerVirtualDeclarationFactKey);
      if (provider?.providerId !== tsonicCoreVirtualModulesProviderId || provider.providerVersion !== tsonicCoreProviderVersion ||
        provider.moduleSpecifier !== tsonicCoreTypesModule || provider.exportName !== "NativePointer") continue;
      const declaration = original.origins.kind === "complete" ? original.origins.nodes.find(node => node === subject) : undefined;
      if (declaration === undefined) continue;
      assertNode(declaration);
      if (nativeDeclaration !== undefined && nativeDeclaration !== declaration)
        throw new Error("A native pointer requires one exact original provider declaration.");
      nativeDeclaration = declaration;
    }
    const categories = Number(pointer !== undefined) + Number(raw !== undefined || marker?.marker === "raw-pointer") +
      Number(callable !== undefined) + Number(nativeDeclaration !== undefined);
    if (categories > 1) throw new Error("Original Core facts cannot carry competing pointer representations.");
    if (pointer !== undefined) {
      assertNode(pointer.pointee);
      return Object.freeze({ kind: "typed-location", pointee: syntax(pointer.pointee), mutability: pointer.mutability });
    }
    if (nativeDeclaration !== undefined) return Object.freeze({ kind: "native-pointer", declaration: nativeDeclaration });
    if (raw !== undefined || marker?.marker === "raw-pointer") return Object.freeze({ kind: "raw-address" });
    if (callable !== undefined) {
      if (original.component.kind === "none") return unavailable;
      callable.parameters.forEach(assertNode);
      assertNode(callable.result);
      return Object.freeze({ kind: "function-pointer", declaration: original.component.value.root,
        parameters: Object.freeze(callable.parameters.map(syntax)), result: syntax(callable.result), abi: Object.freeze([...callable.abi]) });
    }
    const result: SourceInputPointerType = selected.complete ? none : unavailable;
    return result;
  };
  const operation: SourceInputCoreQueries["operation"] = occurrence => {
    assertNode(occurrence);
    const previous = operations.get(occurrence);
    if (previous !== undefined) return previous;
    const typed = sourceFacts.getFact(occurrence, pointerOperationFactKey);
    const raw = sourceFacts.getFact(occurrence, rawPointerOperationFactKey);
    const native = sourceFacts.getFact(occurrence, tsonicNativePointerOperationFactKey);
    const projected = sourceFacts.getFact(occurrence, tsonicPointerViewFactKey);
    const memory = sourceFacts.getFact(occurrence, tsonicRawMemoryOperationFactKey);
    const alive = sourceFacts.getFact(occurrence, tsonicKeepAliveFactKey);
    const count = Number(typed !== undefined) + Number(raw !== undefined) + Number(native !== undefined) +
      Number(projected !== undefined) + Number(memory !== undefined) + Number(alive !== undefined);
    if (count === 0) { operations.set(occurrence, none); return none; }
    if (count !== 1) throw new Error("An original operation cannot carry competing Core meanings.");
    for (const current of [typed, raw, projected, memory, alive]) if (current !== undefined && current.call !== occurrence)
      throw new Error("Core facts must retain the exact original operation occurrence.");
    let selected: SourceInputPointerOperation;
    if (typed !== undefined) {
      [...typed.arguments, ...typed.typeArguments].forEach(assertNode);
      selected = Object.freeze({ family: "typed-location", operation: typed.operation, exportName: typed.exportName,
        arguments: Object.freeze([...typed.arguments]), typeArguments: Object.freeze([...typed.typeArguments]),
        selection: typed.selection.kind === "unavailable" ? "unvisited" : typed.selection.value.kind,
        pointee: typed.pointee.kind === "available" ? "available" : typed.pointee.reason });
    } else if (raw !== undefined) selected = raw.operation === "bind-raw-pointer"
      ? Object.freeze({ family: "raw-address", operation: raw.operation, identity: raw.identityExpression })
      : raw.operation === "equal-raw-pointer" ? Object.freeze({ family: "raw-address", operation: raw.operation,
        left: raw.leftExpression, right: raw.rightExpression })
        : Object.freeze({ family: "raw-address", operation: raw.operation, pointer: raw.pointerExpression });
    else if (native !== undefined) selected = native.operation === "load"
      ? Object.freeze({ family: "native-pointer", operation: native.operation, pointer: native.pointerExpression })
      : native.operation === "store" ? Object.freeze({ family: "native-pointer", operation: native.operation,
        pointer: native.pointerExpression, value: native.valueExpression })
        : Object.freeze({ family: "native-pointer", operation: native.operation, pointer: native.pointerExpression, offset: native.offsetExpression });
    else if (projected !== undefined) selected = Object.freeze({ family: "typed-location", operation: "view",
      pointer: projected.pointerExpression, read: projected.readExpression, write: projected.writeExpression, optional: projected.optional });
    else if (memory !== undefined) {
      if (memory.operation === "to-raw" || memory.operation === "reinterpret") {
        const finalized = selectTsonicRawLocationOperation(ast, sourceFacts, occurrence);
        if (finalized === undefined) throw new Error("Raw location facts require their canonical finalized selector.");
        const location = finalized.kind === "rejected" ? Object.freeze({ kind: "rejected" as const, reason: finalized.reason })
          : Object.freeze({ kind: "resolved" as const, layout: layoutIdentity(finalized.layout) });
        selected = memory.operation === "to-raw" ? Object.freeze({ family: "raw-memory", operation: memory.operation,
          pointer: memory.pointerExpression, layout: memory.layoutExpression, location })
          : Object.freeze({ family: "raw-memory", operation: memory.operation, raw: memory.rawExpression, layout: memory.layoutExpression, location });
      } else if (memory.operation === "byte-offset") selected = Object.freeze({ family: "raw-memory", operation: memory.operation,
        raw: memory.rawExpression, offset: memory.offsetExpression, dataLayout: memory.dataLayoutExpression,
        integer: Object.freeze({ runtimeBase: memory.offsetRuntimeBase, signedness: memory.offsetSignedness, width: memory.offsetWidth }) });
      else {
        const integer = memory.addressWidth === 32
          ? Object.freeze({ width: 32, runtimeBase: "number", signedness: "unsigned" } as const)
          : Object.freeze({ width: 64, runtimeBase: "bigint", signedness: "unsigned" } as const);
        selected = memory.operation === "raw-to-address-integer"
          ? Object.freeze({ family: "raw-memory", operation: memory.operation, raw: memory.rawExpression, integer, dataLayout: memory.dataLayoutExpression })
          : Object.freeze({ family: "raw-memory", operation: memory.operation, address: memory.addressExpression, integer, dataLayout: memory.dataLayoutExpression });
      }
    } else if (alive !== undefined) selected = Object.freeze({ family: "keep-alive", operation: "keep-alive", value: alive.valueExpression });
    else throw new Error("A Core operation requires one original factual producer.");
    const result = Object.freeze({ kind: "present" as const, value: selected });
    operations.set(occurrence, result);
    return result;
  };
  const pointeeMatches: SourceInputCoreQueries["pointeeMatches"] = (occurrence, index, component) => {
    assertNode(occurrence);
    const terminal = observedComponent(component);
    const original = operation(occurrence);
    if (terminal === undefined || original.kind === "none") return "unavailable";
    let expected: Type | undefined;
    const typed = sourceFacts.getFact(occurrence, pointerOperationFactKey);
    const native = sourceFacts.getFact(occurrence, tsonicNativePointerOperationFactKey);
    const projected = sourceFacts.getFact(occurrence, tsonicPointerViewFactKey);
    const memory = sourceFacts.getFact(occurrence, tsonicRawMemoryOperationFactKey);
    if (typed !== undefined && index === (typed.operation === "project-pointer" ? 1 : 0) && typed.pointee.kind === "available") expected = typed.pointee.type;
    else if (native !== undefined && index === 0) expected = native.pointeeType;
    else if (projected !== undefined) expected = index === 0 ? projected.sourcePointeeType : index === 1 ? projected.pointeeType : undefined;
    else if (memory !== undefined && (memory.operation === "to-raw" || memory.operation === "reinterpret") && index === 0) expected = memory.pointeeType;
    if (expected === undefined) return "unavailable";
    const file = ast.getSourceFile(occurrence);
    if (file === undefined) throw new Error("Core operations require their original checked source file.");
    return checked.getSourceFileQueries(file).typeShape.isTypeIdenticalTo(terminal, expected) ? "matched" : "mismatch";
  };
  return Object.freeze({ ...markerInput, ...safetyInput, ...attributeInput, memory, pointerType, operation, pointeeMatches, typeMarkers(original: SourceInputOriginalSubjects) {
    const selected = subjects(original);
    return selected.complete ? Object.freeze({ kind: "available" as const,
      value: sourceCoreMarkerFacts({ sourceFacts, assertNode }, selected.values) }) : unavailable;
  } });
}
