// S-7 Construction sequence and static order (spec/inputs/WALKTHROUGH-PROGRAMS.md).
//   class Base { constructor() { this.init(); } init(): void {} }
//   class Derived extends Base {
//     v: int32 = 1; seen: int32 = 0;
//     static count: int32 = 0; static { Derived.count = 5; }
//     init(): void { this.seen = this.v; }
//   }
//   export function s7(): int32 { const d = new Derived(); return d.seen * 10 + d.v + Derived.count; }
// `order` is the selected native fact for construction order (COMMON-DATA §8 MR-15), already written by
// Elaborate into the ConstructionPlan (MR-16): "fields-first" (derived field initializers before base
// construction) or "base-first". Derived has no authored constructor: its plan is class-owned.
import { N } from "../names.mjs";
import { EMPTY_BINDINGS, PARAMETRIC, T, bodyId, builders, callee, declareType, def, direct, native, selection, signature, typedBody, value, decided } from "../typed.mjs";

const member = (key, type) => ({ key: { kind: "text", value: key }, origins: [], readOrigins: [], writeOrigins: [], kind: "property",
  read: type, write: type, optional: false, readonly: false });
const DERIVED = declareType("derived", { kind: "shape", members: [member("v", T.int32), member("seen", T.int32)], indexes: [], calls: [], constructs: [] });
const V_INIT = bodyId("Derived.v", "initializer");
const SEEN_INIT = bodyId("Derived.seen", "initializer");
const COUNT_INIT = bodyId("Derived.count", "initializer");
const STATIC_BLOCK = bodyId("Derived", "static-block");
const SIG_BASE_CTOR = signature("Base.constructor", [], T.void, DERIVED);
const SIG_DERIVED_CTOR = signature("Derived.constructor", [], DERIVED);
const SIG_S7 = signature("s7", [], T.int32);
const SIG_INIT = signature("initializer:int32", [], T.int32);
const SIG_BLOCK = signature("static-block", [], T.void);
const MUL = native("*", "int32", [T.int32, T.int32], T.int32);
const ADD = native("+", "int32", [T.int32, T.int32], T.int32);

export function s7(order) {
  const field = (name, initializer) => ({ kind: N.stepField, field: def(`Derived.${name}`), initializer: { body: initializer, bindings: PARAMETRIC } });
  const base = { kind: N.stepBase, callee: callee("Base.constructor", SIG_BASE_CTOR, [], T.void), arguments: [] };
  const steps = order === "fields-first" ? [field("v", V_INIT), field("seen", SEEN_INIT), base] : [base, field("v", V_INIT), field("seen", SEEN_INIT)];

  const b = builders("s7");
  const dField = (name, label) => ({ $: label, ...b.property(b.id("d", 0, DERIVED), name, b.read(T.int32, selection(name, T.int32, T.int32, direct(N.reference)))) });
  const program = typedBody("s7", { signature: SIG_S7, completion: T.int32,
    locals: [["d", "binding", DERIVED]],
    root: b.block(
      b.declare([b.variable(b.declName("d", 0), 0, DERIVED, { $: "new Derived()", kind: "NewExpression", expression: b.global("Derived", "Derived", T.unknown),
        typeArguments: null, arguments: { $list: true, nodes: [] },
        tsonic: { ...value(DERIVED), application: decided({ callee: { ...callee("Derived.constructor", SIG_DERIVED_CTOR, [], DERIVED), activation: null },
          receiver: null, arguments: [] }), operation: null,
          [N.constructionPlan]: { owner: def("Derived"), identity: { definition: def("Derived"), bindings: EMPTY_BINDINGS }, [N.planSteps]: steps } } })]),
      b.returns(b.arithmetic(b.arithmetic(b.arithmetic(dField("seen", "d.seen"), "AsteriskToken", b.num("10", T.int32), T.int32, MUL),
        "PlusToken", dField("v", "d.v"), T.int32, ADD), "PlusToken",
        { $: "Derived.count", ...b.property(b.global("Derived", "Derived", T.unknown), "count",
          b.read(T.int32, selection("count", T.int32, T.int32, direct(N.inPlace)))) }, T.int32, ADD))) });
  const internal = [
    { instance: { body: V_INIT, bindings: PARAMETRIC }, captures: [], signature: SIG_INIT },
    { instance: { body: SEEN_INIT, bindings: PARAMETRIC }, captures: [], signature: SIG_INIT },
  ];

  // The module body: the class declaration at its position, with static members in member order
  // (section 5 part 1 rows 5 and 6). Only the two static members matter to lowering.
  const m = builders("module", "module");
  const moduleBody = typedBody("module", { role: "module", signature: SIG_BLOCK, completion: T.void,
    root: m.block({ $: "class Derived", kind: "ClassDeclaration", modifiers: null, name: m.propertyName("Derived"), typeParameters: null,
      heritageClauses: null, members: { $list: true, nodes: [
        { $: "static count", kind: "PropertyDeclaration", modifiers: null, name: m.propertyName("count"), postfixToken: null, type: null, initializer: null,
          tsonic: { definition: def("Derived.count"), storage: T.int32, initializer: COUNT_INIT, attributes: [] } },
        { $: "static block", kind: "ClassStaticBlockDeclaration", modifiers: null, body: m.block(),
          tsonic: { template: { body: STATIC_BLOCK, lexicalBindings: EMPTY_BINDINGS, dependence: "parametric" } } },
      ] },
      tsonic: { definition: def("Derived"), parameters: [], type: DERIVED, heritage: [], members: [def("Derived.count"), def("Derived.static-block")], attributes: [] } }) });
  const moduleInternal = [
    { instance: { body: COUNT_INIT, bindings: PARAMETRIC }, captures: [], signature: SIG_INIT },
    { instance: { body: STATIC_BLOCK, bindings: PARAMETRIC }, captures: [], signature: SIG_BLOCK },
  ];
  return { program, internal, moduleBody, moduleInternal, V_INIT, SEEN_INIT, COUNT_INIT, STATIC_BLOCK };
}
