import type { Node } from "@tsonic/tsts";
import type { SourceTypeFlowVariable } from "./types.js";

interface VariablePath<Value extends object> {
  readonly members: Map<string, VariablePath<Value>>;
  readonly tuples: Map<number, VariablePath<Value>>;
  readonly binders: WeakMap<Node, VariablePath<Value>>;
  element?: VariablePath<Value>;
  optionalValue?: VariablePath<Value>;
  value?: Value;
}

export function createSourceTypeFlowVariableIndex<Value extends object>(
  create: (variable: SourceTypeFlowVariable) => Value,
): (variable: SourceTypeFlowVariable) => Value {
  const roots = new WeakMap<Node, VariablePath<Value>>();
  function path(): VariablePath<Value> {
    return { members: new Map(), tuples: new Map(), binders: new WeakMap() };
  }
  return variable => {
    let selected = roots.get(variable.node);
    if (selected === undefined) { selected = path(); roots.set(variable.node, selected); }
    for (const part of variable.path) {
      if (part.kind === "element") {
        selected.element ??= path();
        selected = selected.element;
      } else if (part.kind === "optional-value") {
        selected.optionalValue ??= path();
        selected = selected.optionalValue;
      } else if (part.kind === "member") {
        let child = selected.members.get(part.name);
        if (child === undefined) { child = path(); selected.members.set(part.name, child); }
        selected = child;
      } else if (part.kind === "tuple") {
        if (!Number.isSafeInteger(part.index) || part.index < 0)
          throw new Error("A Source tuple path requires a nonnegative safe integer position.");
        let child = selected.tuples.get(part.index);
        if (child === undefined) { child = path(); selected.tuples.set(part.index, child); }
        selected = child;
      } else {
        let child = selected.binders.get(part.declaration);
        if (child === undefined) { child = path(); selected.binders.set(part.declaration, child); }
        selected = child;
      }
    }
    selected.value ??= create(variable);
    return selected.value;
  };
}
