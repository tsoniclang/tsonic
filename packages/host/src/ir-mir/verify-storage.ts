import type { Violation } from "../diag/contract.js";
import type { LocalId, NodeId, PlaceId, SigId, TyId } from "../ids/contract.js";
import type { LiteralTypeValue, LiteralValue, TypeTerm } from "../ir-types/contract.js";
import type { MirBody, MirLocal, MirOperand, MirRule, MirRvalue, MirTerminator, MirVerificationContext, MirViolationSite } from "./contract.js";
import { controlGraph, densePosition, findSourceNode } from "./verify-control.js";
import type { ControlVertex, SourceNode } from "./verify-control.js";

export function rvalueOperands(value: MirRvalue): readonly MirOperand[] {
  switch (value.kind) {
    case "use": case "unary": case "convert": return [value.operand];
    case "binary": return [value.left, value.right];
    case "aggregate":
      switch (value.aggregate.kind) {
        case "array": case "tuple": case "fixed-array": return value.aggregate.elements;
        case "object": case "record": return value.aggregate.fields.map(field => field.value);
      }
    case "address-of": return [{ kind: "place", place: value.place }];
    case "closure": return value.captures.map(capture => ({ kind: "place", place: capture.place }));
  }
}

export function terminatorOperands(terminator: MirTerminator): readonly MirOperand[] {
  const operands: MirOperand[] = [];
  switch (terminator.kind) {
    case "goto": case "unreachable": return operands;
    case "return": if (terminator.value !== null) operands.push(terminator.value); return operands;
    case "switch": return [terminator.operand];
    case "call":
      if (terminator.callee.kind === "indirect") operands.push(terminator.callee.operand);
      if (terminator.receiver !== null) operands.push(terminator.receiver);
      if (terminator.callee.kind === "body") for (const capture of terminator.callee.captures) operands.push({ kind: "place", place: capture.place });
      for (const argument of terminator.arguments) {
        if (argument.kind === "value") operands.push(argument.operand);
        else if (argument.kind === "place") operands.push({ kind: "place", place: argument.place });
      }
      if (terminator.destination !== null) operands.push({ kind: "place", place: terminator.destination });
      break;
    case "invoke":
      for (const operand of terminator.operands) operands.push(operand);
      if (terminator.destination !== null) operands.push({ kind: "place", place: terminator.destination });
      break;
    case "check": operands.push({ kind: "place", place: terminator.place }); break;
    case "await": operands.push(terminator.operand, { kind: "place", place: terminator.destination }); break;
    case "yield":
      if (terminator.operand !== null) operands.push(terminator.operand);
      operands.push({ kind: "place", place: terminator.destination }, { kind: "place", place: terminator.return.destination });
      break;
    case "delegate":
      operands.push(terminator.iterator, { kind: "place", place: terminator.destination }, { kind: "place", place: terminator.return.destination });
      break;
    case "throw": operands.push(terminator.operand); break;
  }
  if (terminator.unwind.kind === "handler") operands.push({ kind: "place", place: terminator.unwind.exception });
  return operands;
}

interface IndexChain {
  readonly place: PlaceId;
  readonly parent: IndexChain | null;
}

export interface PlaceLocation {
  readonly root: MirLocal | null;
  readonly indices: IndexChain | null;
}

export function placeLocations(body: MirBody): ReadonlyMap<PlaceId, PlaceLocation> {
  const locations = new Map<PlaceId, PlaceLocation>();
  for (const [position, place] of body.places.entries()) {
    if (place === undefined || !Object.is(place.id, position)) continue;
    switch (place.base.kind) {
      case "static": locations.set(place.id, { root: null, indices: null }); break;
      case "local": {
        const local = densePosition(place.base.local, body.locals.length) ? body.locals[place.base.local] : undefined;
        if (local === undefined || !Object.is(local.id, place.base.local)) continue;
        locations.set(place.id, { root: local, indices: null });
        break;
      }
      case "place": case "checked": {
        if (!densePosition(place.base.place, position)) continue;
        const parent = locations.get(place.base.place);
        if (parent === undefined) continue;
        locations.set(place.id, { root: parent.root, indices: place.base.projection.kind === "index" && place.base.projection.operand.kind === "place"
          ? { place: place.base.projection.operand.place, parent: parent.indices } : parent.indices });
        break;
      }
    }
  }
  return locations;
}

function placeLocals(body: MirBody, locations: ReadonlyMap<PlaceId, PlaceLocation>): (place: PlaceId) => readonly MirLocal[] | null {
  const memo = new Map<PlaceId, readonly MirLocal[] | null>();
  return place => {
    if (!densePosition(place, body.places.length)) return null;
    const cached = memo.get(place);
    if (cached !== undefined) return cached;
    const locals = new Map<LocalId, MirLocal>();
    const visited = new Set<PlaceId>();
    const pending = [place];
    for (const selected of pending) {
      if (!densePosition(selected, body.places.length)) {
        memo.set(place, null);
        return null;
      }
      if (visited.has(selected)) continue;
      visited.add(selected);
      const location = locations.get(selected);
      if (location === undefined) {
        memo.set(place, null);
        return null;
      }
      if (location.root !== null) locals.set(location.root.id, location.root);
      let current: IndexChain | null = location.indices;
      while (current !== null) {
        pending.push(current.place);
        current = current.parent;
      }
    }
    const result = Array.from(locals.values()).sort((left, right) => left.id - right.id);
    memo.set(place, result);
    return result;
  };
}

interface Requirement {
  readonly vertex: ControlVertex;
  readonly local: MirLocal;
  readonly site: MirViolationSite;
}

export function verifyStorage(body: MirBody, places: ReadonlyMap<PlaceId, PlaceLocation>): readonly Violation<MirRule, MirViolationSite>[] {
  const graph = controlGraph(body);
  const locations = placeLocals(body, places);
  const requirements: Requirement[] = [];
  const changes = new Map<LocalId, Map<number, boolean>>();
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const violate = (local: LocalId, site: MirViolationSite): void => {
    violations.push({ rule: "storage-live-before-use", site, detail: [{ kind: "number", value: local }] });
  };
  for (const vertex of graph.vertices) {
    const state = new Map<LocalId, boolean>();
    const requireLive = (local: MirLocal, site: MirViolationSite): void => {
      if (!graph.reachable.has(vertex.id)) return;
      const current = state.get(local.id);
      if (current === false) violate(local.id, site);
      else if (current === undefined) requirements.push({ vertex, local, site });
    };
    const use = (operands: readonly MirOperand[], site: MirViolationSite): void => {
      const locals = new Map<LocalId, MirLocal>();
      for (const operand of operands) {
        if (operand.kind === "constant") continue;
        const selected = locations(operand.place);
        if (selected !== null) for (const local of selected) locals.set(local.id, local);
      }
      for (const local of locals.values()) requireLive(local, site);
    };
    for (const [position, statement] of vertex.block.statements.entries()) {
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: vertex.block.id, statement: position };
      if (statement.kind !== "assign") {
        const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
        if (local === undefined || !Object.is(local.id, statement.local)) continue;
        if (statement.kind === "storage-live") state.set(local.id, true);
        else { requireLive(local, site); state.set(local.id, false); }
      } else use([{ kind: "place", place: statement.place }, ...rvalueOperands(statement.value)], site);
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: vertex.block.id, statement: null };
    use(terminatorOperands(vertex.block.terminator), site);
    for (const [local, live] of state) {
      let entries = changes.get(local);
      if (entries === undefined) {
        entries = new Map();
        changes.set(local, entries);
      }
      entries.set(vertex.id, live);
    }
  }
  // An execution starts at block 0 or at the block of any entry.
  const starts = new Set<number>([0, ...body.entries.map(entry => entry.block)]);
  const memo = new Map<LocalId, Map<number, boolean>>();
  for (const requirement of requirements) {
    const local = requirement.local;
    let localMemo = memo.get(local.id);
    if (localMemo === undefined) {
      localMemo = new Map();
      memo.set(local.id, localMemo);
    }
    const saved = localMemo.get(requirement.vertex.id);
    if (saved !== undefined) {
      if (!saved) violate(local.id, requirement.site);
      continue;
    }
    const initialized = local.role.kind === "parameter" || local.role.kind === "receiver" || local.role.kind === "capture";
    const seen = new Set<number>();
    const pending = [requirement.vertex];
    let live = true;
    for (const current of pending) {
      if (seen.has(current.id)) continue;
      seen.add(current.id);
      if (starts.has(current.id) && !initialized) { live = false; break; }
      for (const predecessor of current.predecessors) {
        if (!graph.reachable.has(predecessor.id)) continue;
        const selected = changes.get(local.id)?.get(predecessor.id);
        if (selected === false) { live = false; break; }
        if (selected === undefined) pending.push(predecessor);
      }
      if (!live) break;
    }
    localMemo.set(requirement.vertex.id, live);
    if (!live) violate(local.id, requirement.site);
  }
  return violations;
}

export interface StorageReference {
  readonly type: TyId;
  readonly site: MirViolationSite;
}

export interface SignatureReference {
  readonly signature: SigId;
  readonly site: MirViolationSite;
}

export interface ValueVerification {
  readonly violations: readonly Violation<MirRule, MirViolationSite>[];
  readonly types: readonly StorageReference[];
  readonly signatures: readonly SignatureReference[];
}

function literalMatches(value: LiteralValue, selected: LiteralTypeValue): boolean {
  switch (value.kind) {
    case "absence": return selected.kind === "absence";
    case "number": return selected.kind === "number" && value.value.numerator === selected.value.numerator
      && value.value.denominator === selected.value.denominator && value.value.negativeZero === selected.value.negativeZero;
    case "bigint": return selected.kind === "bigint" && value.value === selected.value;
    case "string": return selected.kind === "string" && value.value === selected.value;
    case "boolean": return selected.kind === "boolean" && value.value === selected.value;
    case "unique-symbol": return selected.kind === "unique-symbol" && value.declaration === selected.declaration;
  }
}

export function verifyValues(
  body: MirBody, context: MirVerificationContext, nodes: ReadonlyMap<NodeId, SourceNode>,
  places: ReadonlyMap<PlaceId, PlaceLocation>,
): ValueVerification {
  const violations: Violation<MirRule, MirViolationSite>[] = [];
  const types: StorageReference[] = [];
  const signatures: SignatureReference[] = [];
  const report = (rule: MirRule, site: MirViolationSite): void => { violations.push({ rule, site, detail: [] }); };
  const term = (type: TyId): TypeTerm | null => densePosition(type, context.types.terms.length) ? context.types.terms[type] ?? null : null;
  const placeType = (place: PlaceId, site: MirViolationSite): TyId | null => {
    const selected = densePosition(place, body.places.length) ? body.places[place] : undefined;
    if (selected === undefined || !Object.is(selected.id, place)) { report("operand-resolves", site); return null; }
    return selected.storage;
  };
  const operandType = (operand: MirOperand, site: MirViolationSite): TyId | null => {
    if (operand.kind === "place") return placeType(operand.place, site);
    const constant = densePosition(operand.constant, body.constants.length) ? body.constants[operand.constant] : undefined;
    if (constant === undefined || !Object.is(constant.id, operand.constant)) { report("operand-resolves", site); return null; }
    return constant.type;
  };
  const match = (actual: TyId | null, expected: TyId, rule: MirRule, site: MirViolationSite): void => {
    if (actual !== null && !Object.is(actual, expected)) report(rule, site);
  };
  const selectedType = (node: SourceNode | undefined): TyId | null => {
    if (node === undefined) return null;
    const payload = node.node.tsonic;
    return payload !== null && "convertedType" in payload ? payload.type : null;
  };
  const operationResult = (value: MirRvalue & { readonly kind: "unary" | "binary" | "convert" }, site: MirViolationSite): TyId => {
    const decision = value.operation.decision;
    const operands = rvalueOperands(value);
    for (const type of decision.operands) types.push({ type, site });
    if (decision.operands.length !== operands.length) report("operation-selected", site);
    for (const [position, operand] of operands.entries()) {
      const actual = operandType(operand, site);
      const expected = decision.operands[position];
      if (expected !== undefined) match(actual, expected, "operation-selected", site);
    }
    types.push({ type: decision.result, site });
    if (value.kind === "convert") {
      types.push({ type: value.to, site });
      match(decision.result, value.to, "operation-selected", site);
    }
    return decision.result;
  };
  const rvalueType = (value: MirRvalue, node: SourceNode | undefined, site: MirViolationSite): TyId | null => {
    switch (value.kind) {
      case "use": return operandType(value.operand, site);
      case "unary": case "binary": case "convert": return operationResult(value, site);
      case "aggregate": {
        const expected = selectedType(node);
        if (expected !== null) match(value.type, expected, "operation-selected", site);
        const selected = term(value.type);
        const aggregate = value.aggregate;
        const operands = rvalueOperands(value);
        switch (aggregate.kind) {
          case "array": case "tuple": case "fixed-array": {
            if (selected !== null && selected.kind !== aggregate.kind) report("assignment-type", site);
            if (selected !== null && selected.kind === "fixed-array" && BigInt(aggregate.elements.length) !== selected.extent.length) report("assignment-type", site);
            let requiredTypes: readonly TyId[] | null = null;
            if (selected !== null && selected.kind === "tuple") {
              const prefixTypes: TyId[] = [];
              let required = 0;
              let rest = false;
              let prefix = true;
              for (const element of selected.elements) {
                if (element.kind === "required") {
                  required += 1;
                  if (prefix) prefixTypes.push(element.type);
                } else {
                  prefix = false;
                  if (element.kind === "rest") rest = true;
                }
              }
              if (aggregate.elements.length < required || !rest && aggregate.elements.length > selected.elements.length)
                report("assignment-type", site);
              requiredTypes = prefixTypes;
            }
            for (const [position, operand] of operands.entries()) {
              const actual = operandType(operand, site);
              if (selected !== null && (selected.kind === "array" || selected.kind === "fixed-array")) match(actual, selected.element, "assignment-type", site);
              if (requiredTypes !== null) {
                const expected = requiredTypes[position];
                if (expected !== undefined) match(actual, expected, "assignment-type", site);
              }
            }
            break;
          }
          case "object": case "record":
            for (const field of aggregate.fields) {
              const actual = operandType(field.value, site);
              const member = field.member.decision;
              if (member.read !== null && member.write !== null && Object.is(member.read, member.write))
                match(actual, member.read, "assignment-type", site);
            }
            break;
        }
        types.push({ type: value.type, site });
        return value.type;
      }
      case "address-of": {
        placeType(value.place, site);
        types.push({ type: value.type, site });
        const expected = selectedType(node);
        if (expected !== null) match(value.type, expected, "operation-selected", site);
        return value.type;
      }
      case "closure":
        for (const capture of value.captures) {
          if (placeType(capture.place, site) === null) continue;
          const location = places.get(capture.place);
          if (location === undefined) continue;
          const source = location.root === null ? null : location.root.source;
          if (source === null || source.body !== capture.local.body || !Object.is(source.local, capture.local.local))
            report("capture-location-exact", site);
        }
        return selectedType(node);
    }
  };
  for (const local of body.locals) {
    if (local === undefined) continue;
    const site: MirViolationSite = { kind: "local", body: body.body, local: local.id };
    types.push({ type: local.storage, site });
    if (local.role.kind === "completion") {
      const selected = term(local.storage);
      if (selected !== null && !(selected.kind === "primitive" && selected.primitive === "int32")) report("completion-selector-total", site);
    }
  }
  for (const constant of body.constants) {
    if (constant === undefined) continue;
    const site: MirViolationSite = { kind: "constant", body: body.body, constant: constant.id };
    types.push({ type: constant.type, site });
    const selected = term(constant.type);
    if (constant.value.kind === "literal" && selected !== null && selected.kind === "literal"
      && !literalMatches(constant.value.value, selected.value)) report("constant-type", site);
  }
  for (const [position, place] of body.places.entries()) {
    if (place === undefined) continue;
    const site: MirViolationSite = { kind: "place", body: body.body, place: place.id };
    types.push({ type: place.storage, site });
    if (place.base.kind !== "place" && place.base.kind !== "checked" || !densePosition(place.base.place, position)) continue;
    const parent = body.places[place.base.place];
    if (parent === undefined || !Object.is(parent.id, place.base.place)) continue;
    const parentTerm = term(parent.storage);
    const projection = place.base.projection;
    let projected: TyId | null = null;
    switch (projection.kind) {
      case "field": break;
      case "element":
        if (parentTerm !== null) {
          if (parentTerm.kind === "tuple") {
            const element = densePosition(projection.index, parentTerm.elements.length) ? parentTerm.elements[projection.index] : undefined;
            if (element === undefined) report("projection-valid", site);
            else projected = element.type;
          } else if (parentTerm.kind === "array" || parentTerm.kind === "fixed-array") {
            if (!Number.isSafeInteger(projection.index) || Object.is(projection.index, -0) || projection.index < 0
              || parentTerm.kind === "fixed-array" && BigInt(projection.index) >= parentTerm.extent.length) report("projection-valid", site);
            projected = parentTerm.element;
          } else report("projection-valid", site);
        }
        break;
      case "index":
        operandType(projection.operand, site);
        if (projection.operand.kind === "constant") {
          const constant = densePosition(projection.operand.constant, body.constants.length) ? body.constants[projection.operand.constant] : undefined;
          if (constant !== undefined && Object.is(constant.id, projection.operand.constant) && constant.value.kind === "metadata")
            report("metadata-constant-not-materialised", site);
        }
        if (parentTerm !== null) {
          if (parentTerm.kind === "array" || parentTerm.kind === "fixed-array") projected = parentTerm.element;
          else if (parentTerm.kind !== "shape" && parentTerm.kind !== "declared" && parentTerm.kind !== "construction-reference") report("projection-valid", site);
        }
        break;
      case "capture":
        if (!densePosition(projection.index, context.source.captures.length)) report("capture-location-exact", site);
        break;
      case "deref": case "refined": break;
    }
    if (projected !== null) match(place.storage, projected, "projection-type", site);
  }
  for (const block of body.blocks) {
    if (block === undefined) continue;
    for (const [position, statement] of block.statements.entries()) {
      const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: position };
      if (statement.kind === "assign") {
        const source = statement.tir.body === context.source.body ? findSourceNode(nodes, statement.tir.node) : undefined;
        const actual = rvalueType(statement.value, source, site);
        const expected = placeType(statement.place, site);
        if (expected !== null) match(actual, expected, "assignment-type", site);
      } else {
        const local = densePosition(statement.local, body.locals.length) ? body.locals[statement.local] : undefined;
        if (local === undefined || !Object.is(local.id, statement.local)) report("operand-resolves", site);
      }
    }
    const site: MirViolationSite = { kind: "instruction", body: body.body, block: block.id, statement: null };
    const terminator = block.terminator;
    const sourceNode = terminator.tir.body === context.source.body ? findSourceNode(nodes, terminator.tir.node) : undefined;
    switch (terminator.kind) {
      case "goto": case "unreachable": break;
      case "switch":
        operandType(terminator.operand, site);
        for (const target of terminator.targets) operandType({ kind: "constant", constant: target.constant }, site);
        break;
      case "return":
        if (terminator.value !== null) match(operandType(terminator.value, site), body.result, "assignment-type", site);
        else {
          const result = term(body.result);
          if (result !== null && !(result.kind === "intrinsic" && (result.intrinsic === "void" || result.intrinsic === "absence"))) report("assignment-type", site);
        }
        break;
      case "check": placeType(terminator.place, site); break;
      case "call": {
        if (terminator.callee.kind === "body") {
          // The signature of an internal body is not a record of this context; operands and the destination resolve.
          for (const capture of terminator.callee.captures) placeType(capture.place, site);
          if (terminator.receiver !== null) operandType(terminator.receiver, site);
          if (terminator.arguments.length !== 0) report("call-arguments-total", site);
          if (terminator.destination !== null) placeType(terminator.destination, site);
          break;
        }
        const decision = terminator.callee.resolution.decision;
        signatures.push({ signature: decision.api.signature, site });
        signatures.push({ signature: decision.advertised.signature, site });
        signatures.push({ signature: decision.completion.signature, site });
        const signature = densePosition(decision.api.signature, context.types.signatures.length) ? context.types.signatures[decision.api.signature] : undefined;
        if (terminator.callee.kind === "indirect") {
          const actual = operandType(terminator.callee.operand, site);
          if (sourceNode !== undefined) {
            const node = sourceNode.node;
            if (node.kind === "CallExpression" || node.kind === "NewExpression") {
              const payload = node.expression.tsonic;
              if (payload !== null && "convertedType" in payload) match(actual, payload.convertedType, "operation-selected", site);
            }
            if (node.kind === "TaggedTemplateExpression") {
              const payload = node.tag.tsonic;
              if (payload !== null && "convertedType" in payload) match(actual, payload.convertedType, "operation-selected", site);
            }
          }
        }
        if (signature !== undefined) {
          if (signature.receiver === null) {
            if (terminator.receiver !== null) { operandType(terminator.receiver, site); report("call-receiver-exact", site); }
          } else if (terminator.receiver === null) report("call-receiver-exact", site);
          else match(operandType(terminator.receiver, site), signature.receiver, "call-receiver-exact", site);
          if (signature.parameters.length !== terminator.arguments.length) report("call-arguments-total", site);
          for (const [position, argument] of terminator.arguments.entries()) {
            const parameter = signature.parameters[position];
            if (argument.kind === "omitted") {
              // A call may omit only what the callee's signature lets be omitted.
              if (parameter === undefined || parameter.kind !== "optional" && parameter.kind !== "default") report("omission-admitted", site);
              continue;
            }
            const actual = argument.kind === "value" ? operandType(argument.operand, site) : placeType(argument.place, site);
            if (parameter !== undefined) {
              if (argument.passing !== parameter.passing || actual !== null && !Object.is(actual, parameter.type))
                violations.push({ rule: "argument-passing-exact", site, detail: [{ kind: "number", value: position }] });
            }
          }
        } else {
          if (terminator.receiver !== null) operandType(terminator.receiver, site);
          for (const argument of terminator.arguments) {
            if (argument.kind === "value") operandType(argument.operand, site);
            else if (argument.kind === "place") placeType(argument.place, site);
          }
        }
        types.push({ type: decision.result, site });
        if (terminator.destination !== null) match(placeType(terminator.destination, site), decision.result, "call-destination-type", site);
        break;
      }
      case "invoke":
        for (const type of terminator.operation.decision.operands) types.push({ type, site });
        if (terminator.operands.length !== terminator.operation.decision.operands.length) report("operation-selected", site);
        for (const [position, operand] of terminator.operands.entries()) {
          const actual = operandType(operand, site);
          const expected = terminator.operation.decision.operands[position];
          if (expected !== undefined) match(actual, expected, "operation-selected", site);
        }
        types.push({ type: terminator.operation.decision.result, site });
        if (terminator.destination !== null) match(placeType(terminator.destination, site), terminator.operation.decision.result, "call-destination-type", site);
        break;
      case "await": case "yield": case "delegate": {
        if (terminator.kind === "delegate") operandType(terminator.iterator, site);
        else if (terminator.operand !== null) operandType(terminator.operand, site);
        const result = selectedType(sourceNode);
        const actual = placeType(terminator.destination, site);
        if (result !== null) match(actual, result, "call-destination-type", site);
        if (terminator.kind !== "await") match(placeType(terminator.return.destination, site), context.source.completion, "call-destination-type", site);
        break;
      }
      case "throw": operandType(terminator.operand, site); break;
    }
    if (terminator.kind !== "goto" && terminator.kind !== "switch" && terminator.kind !== "return" && terminator.kind !== "unreachable"
      && terminator.unwind.kind === "handler") {
      const storage = placeType(terminator.unwind.exception, site);
      if (storage !== null) {
        const selected = term(storage);
        if (selected !== null && !(selected.kind === "intrinsic" && selected.intrinsic === "unknown")) report("exception-destination-type", site);
      }
    }
  }
  const bodySite: MirViolationSite = { kind: "body", body: body.body };
  match(body.result, context.source.completion, "assignment-type", bodySite);
  types.push({ type: body.result, site: bodySite });
  return { violations, types, signatures };
}
