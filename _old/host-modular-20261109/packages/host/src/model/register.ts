import type {
  AlgebraKey,
  AlgebraWork,
  DataResult,
  IntegerFormat,
  IntegerRange,
  KeyDomain,
  ModelAlgebra,
} from "./contract.js";

const invalidFormat: DataResult<never> = Object.freeze({
  kind: "invalid", code: "INVALID_INTEGER_FORMAT", message: "Expected signed or unsigned 8, 16, 32, 64 or 128 bits",
});
const invalidValue: DataResult<never> = Object.freeze({
  kind: "invalid", code: "INVALID_INTEGER_VALUE", message: "Expected an exact bigint value",
});
const invalidKey: DataResult<never> = Object.freeze({
  kind: "invalid", code: "INVALID_KEY_DOMAIN", message: "Expected a complete key or dense duplicate-free key domain",
});

function valid<Value>(value: Value): DataResult<Value> {
  return Object.freeze({ kind: "valid", value });
}

function validFormat(format: IntegerFormat): boolean {
  return typeof format === "object" && format !== null
    && (format.signedness === "signed" || format.signedness === "unsigned")
    && (format.bits === 8 || format.bits === 16 || format.bits === 32 || format.bits === 64 || format.bits === 128);
}

function integerBounds(format: IntegerFormat): DataResult<IntegerRange> {
  if (!validFormat(format)) return invalidFormat;
  const magnitude = 1n << BigInt(format.signedness === "signed" ? format.bits - 1 : format.bits);
  return valid(Object.freeze({ minimum: format.signedness === "signed" ? -magnitude : 0n, maximum: magnitude - 1n }));
}

function integerInFormat(value: bigint, format: IntegerFormat, work: AlgebraWork): DataResult<boolean> {
  if (!validFormat(format)) return invalidFormat;
  if (typeof value !== "bigint") return invalidValue;
  work.charge(1n + BigInt(format.bits));
  const truncated = format.signedness === "signed"
    ? BigInt.asIntN(format.bits, value) : BigInt.asUintN(format.bits, value);
  return valid(truncated === value);
}

function validKey<SymbolIdentity>(key: AlgebraKey<SymbolIdentity> | undefined,
  work: AlgebraWork): key is AlgebraKey<SymbolIdentity> {
  work.charge(1n);
  return typeof key === "object" && key !== null
    && (key.kind === "name" && typeof key.name === "string"
      || key.kind === "symbol" && Object.getOwnPropertyDescriptor(key, "identity") !== undefined);
}

function keyEqual<SymbolIdentity>(left: AlgebraKey<SymbolIdentity> | undefined,
  right: AlgebraKey<SymbolIdentity> | undefined, work: AlgebraWork): DataResult<boolean> {
  const leftValid = validKey(left, work);
  const rightValid = validKey(right, work);
  if (!leftValid || !rightValid) return invalidKey;
  work.charge(1n);
  if (left.kind === "name" && right.kind === "name") {
    work.charge(1n + BigInt(left.name.length) + BigInt(right.name.length));
    return valid(left.name === right.name);
  }
  if (left.kind === "symbol" && right.kind === "symbol") {
    work.charge(1n);
    return valid(left.identity === right.identity);
  }
  return valid(false);
}

function validateDomain<SymbolIdentity>(domain: KeyDomain<SymbolIdentity>,
  work: AlgebraWork): DataResult<KeyDomain<SymbolIdentity>> {
  work.charge(1n);
  if (typeof domain !== "object" || domain === null) return invalidKey;
  switch (domain.kind) {
    case "empty":
    case "names":
    case "symbols":
    case "all":
      return valid(domain);
    case "finite": {
      if (!Array.isArray(domain.keys)) return invalidKey;
      for (let index = 0; index < domain.keys.length; index += 1) {
        work.charge(1n);
        if (Object.getOwnPropertyDescriptor(domain.keys, index) === undefined || !validKey(domain.keys[index], work)) return invalidKey;
      }
      for (let index = 0; index < domain.keys.length; index += 1) {
        for (let previous = 0; previous < index; previous += 1) {
          work.charge(1n);
          const equal = keyEqual(domain.keys[index], domain.keys[previous], work);
          if (equal.kind === "invalid") return equal;
          if (equal.value) return invalidKey;
        }
      }
      return valid(domain);
    }
    default:
      return invalidKey;
  }
}

function includedInValidatedDomain<SymbolIdentity>(domain: KeyDomain<SymbolIdentity>,
  key: AlgebraKey<SymbolIdentity> | undefined, work: AlgebraWork): DataResult<boolean> {
  if (!validKey(key, work)) return invalidKey;
  work.charge(1n);
  switch (domain.kind) {
    case "empty": return valid(false);
    case "all": return valid(true);
    case "names": return valid(key.kind === "name");
    case "symbols": return valid(key.kind === "symbol");
    case "finite":
      for (let index = 0; index < domain.keys.length; index += 1) {
        work.charge(1n);
        const equal = keyEqual(domain.keys[index], key, work);
        if (equal.kind === "invalid") return equal;
        if (equal.value) return valid(true);
      }
      return valid(false);
  }
}

function keyIncluded<SymbolIdentity>(domain: KeyDomain<SymbolIdentity>,
  key: AlgebraKey<SymbolIdentity>, work: AlgebraWork): DataResult<boolean> {
  const checked = validateDomain(domain, work);
  if (checked.kind === "invalid") return checked;
  return includedInValidatedDomain(checked.value, key, work);
}

function keyDomainContains<SymbolIdentity>(container: KeyDomain<SymbolIdentity>,
  contained: KeyDomain<SymbolIdentity>, work: AlgebraWork): DataResult<boolean> {
  const outer = validateDomain(container, work);
  const inner = validateDomain(contained, work);
  if (outer.kind === "invalid") return outer;
  if (inner.kind === "invalid") return inner;
  work.charge(1n);
  if (inner.value.kind === "empty" || outer.value.kind === "all") return valid(true);
  switch (inner.value.kind) {
    case "all": return valid(false);
    case "names": return valid(outer.value.kind === "names");
    case "symbols": return valid(outer.value.kind === "symbols");
    case "finite":
      for (let index = 0; index < inner.value.keys.length; index += 1) {
        work.charge(1n);
        const included = includedInValidatedDomain(outer.value, inner.value.keys[index], work);
        if (included.kind === "invalid") return included;
        if (!included.value) return valid(false);
      }
      return valid(true);
  }
}

export const modelAlgebra: ModelAlgebra = Object.freeze({
  integerBounds,
  integerInFormat,
  keyEqual,
  keyIncluded,
  keyDomainContains,
});
