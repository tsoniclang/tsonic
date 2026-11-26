import type {
  MirAggregate, MirCallArgument, MirCallee, MirCopyRefusal, MirCopyResult, MirOperand, MirPlaceBase, MirRvalue, MirStatement, MirTerminator,
  ProjectMirValues,
} from "./contract.js";

function copied<Value>(value: Value): { readonly kind: "copied"; readonly value: Value } {
  return { kind: "copied", value };
}

function then<Source, Value, Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  result: MirCopyResult<Source, Failure>, next: (value: Source) => MirCopyResult<Value, Failure>,
): MirCopyResult<Value, Failure> {
  return result.kind === "refused" ? result : next(result.value);
}

export const projectMirValues: ProjectMirValues = (ops, constantOf) => {
  const valueOperand = (value: MirOperand) => value.kind === "place" ? copied(value) : ops.record<MirOperand>(2, () =>
    copied({ kind: "constant", constant: constantOf(value.constant) }));
  const operand = (read: () => MirOperand) => ops.read(() => valueOperand(read()));
  const optionalOperand = (read: () => MirOperand | null) => ops.read<MirOperand | null>(() => {
    const value = read();
    return value === null ? copied(null) : valueOperand(value);
  });
  const placeBase = (read: () => MirPlaceBase) => ops.read<MirPlaceBase>(() => {
    const value = read();
    if (value.kind !== "place" && value.kind !== "checked") return copied(value);
    return ops.read<MirPlaceBase>(() => {
      const projection = value.projection;
      switch (projection.kind) {
        case "field": return ops.record(4, () => ops.record(2, () => then(ops.member(projection.member), member =>
          copied({ kind: value.kind, place: value.place, projection: { kind: "field", member }, tir: value.tir }))));
        case "index": return ops.record(4, () => ops.record(2, () => then(operand(() => projection.operand), index =>
          copied({ kind: value.kind, place: value.place, projection: { kind: "index", operand: index }, tir: value.tir }))));
        case "capture": case "deref": case "element": case "refined": return copied(value);
      }
    });
  });
  const aggregate = (read: () => MirAggregate) => ops.read<MirAggregate>(() => {
    const value = read();
    switch (value.kind) {
      case "array": case "tuple": case "fixed-array":
        return ops.record(2, () => then(ops.rows(value.elements, operand), elements => copied({ kind: value.kind, elements })));
      case "object": case "record": return ops.record(2, () => then(ops.rows(value.fields, readField => ops.record(2, () => {
        const field = readField();
        return then(ops.member(field.member), member => then(operand(() => field.value), value => copied({ member, value })));
      })), fields => copied({ kind: value.kind, fields })));
    }
  });
  const rvalue = (read: () => MirRvalue, at: string) => ops.read<MirRvalue>(() => {
    const value = read();
    switch (value.kind) {
      case "use": return ops.record(2, () => then(operand(() => value.operand), operand => copied({ kind: "use", operand })));
      case "unary": return ops.record(3, () => then(ops.operation(value.operation, at + ".operation"), operation =>
        then(operand(() => value.operand), operand => copied({ kind: "unary", operation, operand }))));
      case "binary": return ops.record(4, () => then(ops.operation(value.operation, at + ".operation"), operation =>
        then(operand(() => value.left), left => then(operand(() => value.right), right => copied({ kind: "binary", operation, left, right })))));
      case "convert": return ops.record(4, () => then(ops.operation(value.operation, at + ".operation"), operation =>
        then(operand(() => value.operand), operand => copied({ kind: "convert", operation, operand, to: ops.type(value.to) }))));
      case "aggregate": return ops.record(3, () => then(aggregate(() => value.aggregate), aggregate =>
        copied({ kind: "aggregate", type: ops.type(value.type), aggregate })));
      case "address-of": return ops.record(3, () =>
        copied({ kind: "address-of", place: value.place, type: ops.type(value.type) }));
      case "closure": return ops.record(3, () => then(ops.instance(value.instance), instance =>
        copied({ kind: "closure", instance, captures: value.captures })));
    }
  });
  const statement = (read: () => MirStatement, at: string) => ops.read<MirStatement>(() => {
    const value = read();
    if (value.kind !== "assign") return copied(value);
    return ops.record(6, () => then(rvalue(() => value.value, at + ".value"), source =>
      copied({ origin: value.origin, tir: value.tir, kind: "assign", place: value.place, value: source, step: value.step })));
  });
  const argument = (read: () => MirCallArgument) => ops.read<MirCallArgument>(() => {
    const value = read();
    return value.kind !== "value" ? copied(value) : ops.record(3, () =>
      then(operand(() => value.operand), operand => copied({ kind: "value", passing: value.passing, operand })));
  });
  const callee = (read: () => MirCallee) => ops.read<MirCallee>(() => {
    const value = read();
    switch (value.kind) {
      case "direct": return ops.record(2, () => then(ops.callee(value.resolution), resolution => copied({ kind: "direct", resolution })));
      case "indirect": return ops.record(3, () => then(ops.callee(value.resolution), resolution =>
        then(operand(() => value.operand), operand => copied({ kind: "indirect", resolution, operand }))));
      case "body": return ops.record(3, () => then(ops.instance(value.instance), instance =>
        copied({ kind: "body", instance, captures: value.captures })));
    }
  });
  const terminator = (read: () => MirTerminator, at: string) => ops.read<MirTerminator>(() => {
    const value = read();
    switch (value.kind) {
      case "goto": case "check": case "unreachable": return copied(value);
      case "cleanup-enter": case "cleanup-resume": case "cleanup-discard": case "unwind-propagate": return copied(value);
      case "switch": return ops.record(6, () => then(operand(() => value.operand), operand =>
        then(ops.orderedRows(value.targets, readTarget => ops.record(2, () => {
          const target = readTarget();
          return copied({ constant: constantOf(target.constant), target: target.target });
        }), (left, right) => copied(left.constant - right.constant)), targets =>
          copied({ origin: value.origin, tir: value.tir, kind: "switch", operand, targets, otherwise: value.otherwise, step: value.step }))));
      case "call": return ops.record(10, () => then(callee(() => value.callee), callee =>
        then(optionalOperand(() => value.receiver), receiver => then(ops.rows(value.arguments, argument), args => copied({
          origin: value.origin, tir: value.tir, kind: "call", callee, receiver, arguments: args,
          destination: value.destination, next: value.next, unwind: value.unwind, step: value.step,
        })))));
      case "invoke": return ops.record(8, () => then(ops.operation(value.operation, at + ".operation"), operation =>
        then(ops.rows(value.operands, operand), operands => copied({
          origin: value.origin, tir: value.tir, kind: "invoke", operation, operands,
          destination: value.destination, next: value.next, unwind: value.unwind, step: value.step,
        }))));
      case "await": return ops.record(8, () => then(operand(() => value.operand), operand => copied({
        origin: value.origin, tir: value.tir, kind: "await", operand, destination: value.destination,
        resume: value.resume, unwind: value.unwind, step: value.step,
      })));
      case "yield": return ops.record(9, () => then(optionalOperand(() => value.operand), operand => copied({
        origin: value.origin, tir: value.tir, kind: "yield", operand, destination: value.destination,
        resume: value.resume, return: value.return, unwind: value.unwind, step: value.step,
      })));
      case "delegate": return ops.record(9, () => then(operand(() => value.iterator), iterator => copied({
        origin: value.origin, tir: value.tir, kind: "delegate", iterator, destination: value.destination,
        resume: value.resume, return: value.return, unwind: value.unwind, step: value.step,
      })));
      case "throw": return ops.record(5, () => then(operand(() => value.operand), operand =>
        copied({ origin: value.origin, tir: value.tir, kind: "throw", operand, unwind: value.unwind })));
      case "return": return ops.record(4, () => then(optionalOperand(() => value.value), returned =>
        copied({ origin: value.origin, tir: value.tir, kind: "return", value: returned })));
    }
  });
  return { placeBase, statement, terminator };
};
