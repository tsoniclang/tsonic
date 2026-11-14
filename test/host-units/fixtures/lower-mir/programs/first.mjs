// The programs of the first producer: parameters, binary operations placed by their decision, and return.
//   function add(a: number, b: number): number { return a + b; }           (checkpoint 3; `number` is float64, K-3291)
//   function add32(a: int32, b: int32): int32 { return a + b; }
// and variations of the same shape. Each typed body is written by hand against the TIR contract; the operation
// decision of `+` is a parameter of the program, because lowering reads it and selects nothing.
import { PURE, T, builders, declareType, invoking, native, signature, typedBody, typedOperation } from "../typed.mjs";

declareType("float64", { kind: "primitive", primitive: "float64" });
declareType("literalInt64", { kind: "primitive", primitive: "int64" });
declareType("literalBigint", { kind: "intrinsic", intrinsic: "bigint" });

const SIGNATURES = new Map();
/** One signature per program name (`signature` refuses a second declaration of a name); a name stands for one shape. */
const signatureOnce = (name, parameters, result, receiver = null) => {
  if (!SIGNATURES.has(name)) SIGNATURES.set(name, signature(name, parameters, result, receiver));
  return SIGNATURES.get(name);
};

export const EXECUTIONS = {
  pure: PURE,
  cannotFail: invoking("none", false),
  unwinds: invoking("unwind", false),
  endsProcess: invoking("abort", false),
  writes: invoking("unwind", true),
};

/** `+` over a carrier, with the execution its decision states. */
export const plus = (carrier, type, execution = PURE) => native("+", carrier, [type, type], type, execution);

/** function <name>(a: <type>, b: <type>): <type> { return a + b; } */
export function add(name, type, decision, { passing = ["by-value", "by-value"] } = {}) {
  const b = builders(name);
  const sig = signatureOnce(name, [["a", type, "required", null, passing[0]], ["b", type, "required", null, passing[1]]], type);
  return { decision: typedOperation(decision), ...typedBody(name, { signature: sig, completion: type,
    locals: [["a", "parameter", type], ["b", "parameter", type]],
    params: [[0, "required", type, null, passing[0]], [1, "required", type, null, passing[1]]],
    root: b.block({ $: "return", ...b.returns({ $: "a+b", ...b.arithmetic({ $: "a", ...b.id("a", 0, type) }, "PlusToken", { $: "b", ...b.id("b", 1, type) }, type, decision) }) }) }) };
}

/**
 * function <name>(a, b) { return <tree>; } where the tree is written with `leaf("a" | "b")`, `sum(label, left, right, decision)`
 * and `group(inner)`: any nesting of binary operations and parentheses over the two parameters.
 */
export function nested(name, type, build, { passing = ["by-value", "by-value"], statements = null } = {}) {
  const b = builders(name);
  const sig = signatureOnce(name, [["a", type, "required", null, passing[0]], ["b", type, "required", null, passing[1]]], type);
  let leaves = 0;
  const tools = {
    leaf: text => { leaves += 1; return { $: `${text}#${leaves}`, ...b.id(text, text === "a" ? 0 : 1, type) }; },
    sum: (label, left, right, decision) => ({ $: label, ...b.arithmetic(left, "PlusToken", right, type, decision) }),
    group: inner => b.paren(inner, type),
    returns: expression => b.returns(expression),
    b,
  };
  const tree = build(tools);
  return typedBody(name, { signature: sig, completion: type,
    locals: [["a", "parameter", type], ["b", "parameter", type]],
    params: [[0, "required", type, null, passing[0]], [1, "required", type, null, passing[1]]],
    root: statements === null ? b.block({ $: "return", ...b.returns(tree) }) : b.block(...statements(tools, tree)) });
}

/** A body with the given parameter rows and root, for the refused and the smallest bodies. `rows`: [name, role, type, passing]. */
export function shaped(name, rows, completion, makeRoot, { receiver = null, extra = {} } = {}) {
  const b = builders(name);
  const fixed = rows.filter(([, role]) => role !== "this");
  const sig = signatureOnce(name, fixed.map(([parameter, role, type, passing = "by-value"]) =>
    [parameter, type, role === "rest" ? "rest" : role, null, passing]), completion, receiver);
  return typedBody(name, { signature: sig, completion,
    locals: rows.map(([parameter, , type]) => [parameter, "parameter", type]),
    params: rows.map(([, role, type, passing = "by-value"], local) => [local, role, type, null, passing]),
    root: makeRoot(b), ...extra });
}

export { T };
