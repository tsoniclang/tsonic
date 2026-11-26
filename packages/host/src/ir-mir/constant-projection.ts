import type { InvariantFailure } from "../diag/contract.js";
import { throwInvariant } from "../diag/index.js";
import type { ConstId } from "../ids/contract.js";
import { admitIntegerKey, constId } from "../ids/index.js";
import type { ArtifactBindings, LiteralValue } from "../ir-types/contract.js";
import type {
  MirConstantKeyWork, MirConstantValue, MirCopyRefusal, MirCopyResult, ProjectMirConstantKey, ProjectMirConstantOrdinals,
} from "./contract.js";
import { constantKey } from "./verify.js";

const invariant = (message: string): InvariantFailure => ({ owner: "ir-mir", query: null, origin: null, message });

function valueOf<Value>(value: Value): { readonly kind: "copied"; readonly value: Value } {
  return { kind: "copied", value };
}

function paidField<Field, Value, Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  admit: MirConstantKeyWork<Stop, Failure>, read: () => Field, use: (field: Field) => MirCopyResult<Value, Failure>,
): MirCopyResult<Value, Failure> {
  return admit.work(1) ?? use(read());
}

function textField<Field extends string, Value, Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  admit: MirConstantKeyWork<Stop, Failure>, read: () => Field, use: (value: Field) => MirCopyResult<Value, Failure>,
): MirCopyResult<Value, Failure> {
  return paidField(admit, read, value => admit.work(value.length) ?? use(value));
}

function integerField<Value, Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  admit: MirConstantKeyWork<Stop, Failure>, read: () => bigint, use: (value: bigint) => MirCopyResult<Value, Failure>,
): MirCopyResult<Value, Failure> {
  return paidField(admit, read, value => admitIntegerKey(value, count => admit.work(count)) ?? use(value));
}

function ownedLiteral<Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  admit: MirConstantKeyWork<Stop, Failure>, literal: LiteralValue,
): MirCopyResult<MirConstantValue, Failure> {
  const header = admit.work(1);
  if (header !== null) return header;
  const retain = (build: () => LiteralValue): MirCopyResult<MirConstantValue, Failure> =>
    admit.record(0, () => admit.record(0, () => valueOf({ kind: "literal", value: build() })));
  switch (literal.kind) {
    case "absence": return retain(() => ({ kind: "absence" }));
    case "boolean": return paidField(admit, () => literal.value, value => retain(() => ({ kind: "boolean", value })));
    case "string": return textField(admit, () => literal.value, value => retain(() => ({ kind: "string", value })));
    case "unique-symbol": return textField(admit, () => literal.declaration, declaration => retain(() => ({ kind: "unique-symbol", declaration })));
    case "bigint": return textField(admit, () => literal.token, token =>
      integerField(admit, () => literal.value, value => retain(() => ({ kind: "bigint", token, value }))));
    case "number": return textField(admit, () => literal.token, token => paidField(admit, () => literal.value, value =>
      integerField(admit, () => value.numerator, numerator => integerField(admit, () => value.denominator, denominator =>
        paidField(admit, () => value.negativeZero, negativeZero => admit.record(0, () => {
          const rational = { numerator, denominator, negativeZero };
          return retain(() => ({ kind: "number", token, value: rational }));
        }))))));
  }
}

function ownedArtifact<Value, Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  admit: MirConstantKeyWork<Stop, Failure>, raw: ArtifactBindings, use: (value: ArtifactBindings) => MirCopyResult<Value, Failure>,
): MirCopyResult<Value, Failure> {
  const tag = admit.work(1);
  if (tag !== null) return tag;
  const retained = (value: ArtifactBindings) => admit.artifact(value) ?? use(value);
  if (raw.kind === "parametric") return admit.record(0, () => retained({ kind: "parametric" }));
  return paidField(admit, () => raw.bindings, vector => {
    const bindings = admit.bindings(vector);
    return bindings.kind === "refused" ? bindings
      : admit.record(0, () => retained({ kind: "instantiated", bindings: bindings.value }));
  });
}

function ownedConstant<Stop extends object, Failure extends MirCopyRefusal<Stop>>(
  admit: MirConstantKeyWork<Stop, Failure>, raw: MirConstantValue,
): MirCopyResult<MirConstantValue, Failure> {
  const kind = raw.kind;
  switch (kind) {
    case "literal": return paidField(admit, () => raw.value, literal => ownedLiteral(admit, literal));
    case "definition": case "metadata":
      return textField(admit, () => raw.definition, definition => paidField(admit, () => raw.bindings, bindings =>
        ownedArtifact(admit, bindings, owned => admit.record(0, () => valueOf({ kind, definition, bindings: owned })))));
    case "observation": return paidField(admit, () => raw.at, at => textField(admit, () => at.body, body =>
      paidField(admit, () => at.node, node => admit.record(0, () => admit.record(0, () =>
        valueOf({ kind: "observation", at: { body, node } }))))));
    case "constant":
      return paidField(admit, () => raw.reference, (reference): MirCopyResult<MirConstantValue, Failure> => {
        const contextWork = admit.work(1);
        if (contextWork !== null) return contextWork;
        const { context } = reference;
        if (context === "enum-member") return textField(admit, () => reference.member, member =>
          paidField(admit, () => reference.bindings, bindings => ownedArtifact(admit, bindings, projected =>
            admit.record(0, () => admit.record(0, () => valueOf({ kind: "constant", reference: { context: "enum-member", member, bindings: projected } }))))));
        return paidField(admit, () => reference.initializer, initializer =>
          textField(admit, () => initializer.body, body => paidField(admit, () => initializer.bindings, bindings =>
            ownedArtifact(admit, bindings, projected => admit.record(0, () => admit.record(0, () => admit.record(0, () =>
              valueOf({ kind: "constant", reference: { initializer: { body, bindings: projected }, context } }))))))));
      });
  }
}

export const projectMirConstantKey: ProjectMirConstantKey = (type, read, admit) => {
  const header = admit.work(1);
  if (header !== null) return header;
  const owned = ownedConstant(admit, read());
  if (owned.kind === "refused") return owned;
  return paidField(admit, type, type => admit.record(0, () =>
    valueOf({ type, value: owned.value, key: constantKey(type, owned.value) })));
};

export const projectMirConstantOrdinals: ProjectMirConstantOrdinals = (order, ops, missing) => {
  const ordered = order((left, right) => {
    const stop = ops.work(left.key.length) ?? ops.work(right.key.length);
    return stop === null ? { kind: "copied", value: left.key < right.key ? -1 : left.key > right.key ? 1 : 0 } : stop;
  });
  if (ordered.kind === "refused") return ordered;
  return ops.record(2, () => ops.record(0, () => {
    const ids = new Map<ConstId, ConstId>();
    const constants = ops.rows(ordered.value, (read, position) => ops.record(3, () => ops.record(0, () => {
      const current = read();
      const id = constId(position);
      if (ids.has(current.id)) return throwInvariant(invariant("A constant ordinal is published more than once."));
      ids.set(current.id, id);
      return { kind: "copied", value: { id, type: current.type, value: current.value } };
    })));
    if (constants.kind === "refused") return constants;
    return { kind: "copied", value: { constants: constants.value, constantOf: prior => {
      const selected = ids.get(prior);
      return selected === undefined ? throwInvariant(missing()) : selected;
    } } };
  }));
};
