import type { ProgramIdentity } from "../model/contract.js";
import type { QuestionKeyPart, ResourceScope } from "./contract.js";
import { invariant } from "./failures.js";
import { Resources } from "./resources.js";

interface Trie {
  readonly children: Map<bigint, Trie>;
  identity: bigint | undefined;
}

interface Frame {
  readonly tuple: readonly unknown[];
  readonly children: bigint[];
  index: number;
}

function tuple(value: object): value is readonly unknown[] {
  return Array.isArray(value);
}

export class Keys {
  readonly #program: ProgramIdentity;
  readonly #resources: Resources;
  readonly #strings = new Map<string, bigint>();
  readonly #numbers = new Map<number, bigint>();
  readonly #integers = new Map<bigint, bigint>();
  readonly #booleans = new Map<boolean | null, bigint>();
  #objects = new WeakMap<object, bigint>();
  #tuples = new WeakMap<readonly unknown[], bigint>();
  readonly #trie: Trie = { children: new Map(), identity: undefined };
  #negativeZero: bigint | undefined;
  #next = 0n;

  constructor(program: ProgramIdentity, resources: Resources) {
    this.#program = program;
    this.#resources = resources;
  }

  encode(parts: readonly QuestionKeyPart[], scope: ResourceScope): bigint {
    const dimension = this.#resources.keyDimension(scope);
    const charge = (amount = 1n): void => scope.charge(dimension, amount);
    charge();
    if (!Array.isArray(parts) || !Object.isFrozen(parts)) invariant("INVALID_QUESTION_KEY", scope.owner.owner);
    const cached = this.#tuples.get(parts);
    if (cached !== undefined) return cached;
    charge();
    const active = new Set<readonly unknown[]>([parts]);
    const stack: Frame[] = [{ tuple: parts, children: [], index: 0 }];
    while (stack.length > 0) {
      const frame = stack.at(-1);
      if (frame === undefined) invariant("INVALID_QUESTION_KEY", scope.owner.owner);
      if (frame.index === frame.tuple.length) {
        const identity = this.#intern(frame.children, charge);
        charge();
        this.#tuples.set(frame.tuple, identity);
        active.delete(frame.tuple);
        stack.pop();
        const parent = stack.at(-1);
        if (parent === undefined) return identity;
        charge();
        parent.children.push(identity);
        continue;
      }
      charge();
      const descriptor = Object.getOwnPropertyDescriptor(frame.tuple, frame.index);
      frame.index += 1;
      if (descriptor === undefined || !("value" in descriptor)) invariant("INVALID_QUESTION_KEY", scope.owner.owner);
      const value: unknown = descriptor.value;
      if (value !== null && typeof value === "object" && tuple(value)) {
        if (!Object.isFrozen(value) || active.has(value)) invariant("INVALID_QUESTION_KEY", scope.owner.owner);
        const child = this.#tuples.get(value);
        if (child !== undefined) {
          charge();
          frame.children.push(child);
        } else {
          charge();
          active.add(value);
          stack.push({ tuple: value, children: [], index: 0 });
        }
      } else {
        const identity = this.#atom(value, scope, charge);
        charge();
        frame.children.push(identity);
      }
    }
    return invariant("INVALID_QUESTION_KEY", scope.owner.owner);
  }

  clear(): void {
    this.#strings.clear();
    this.#numbers.clear();
    this.#integers.clear();
    this.#booleans.clear();
    this.#trie.children.clear();
    this.#trie.identity = undefined;
    this.#objects = new WeakMap();
    this.#tuples = new WeakMap();
    this.#negativeZero = undefined;
  }

  #intern(children: readonly bigint[], charge: (amount?: bigint) => void): bigint {
    let node = this.#trie;
    for (const child of children) {
      charge();
      let next = node.children.get(child);
      if (next === undefined) {
        charge();
        next = { children: new Map(), identity: undefined };
        node.children.set(child, next);
      }
      node = next;
    }
    if (node.identity === undefined) {
      charge();
      node.identity = this.#identity();
    }
    return node.identity;
  }

  #atom(value: unknown, scope: ResourceScope, charge: (amount?: bigint) => void): bigint {
    if (typeof value === "string") {
      charge(BigInt(value.length) + 1n);
      return this.#scalar(this.#strings, value, charge);
    }
    if (typeof value === "number") {
      if (Object.is(value, -0)) {
        if (this.#negativeZero === undefined) {
          charge();
          this.#negativeZero = this.#identity();
        }
        return this.#negativeZero;
      }
      return this.#scalar(this.#numbers, value, charge);
    }
    if (typeof value === "bigint") return this.#scalar(this.#integers, value, charge);
    if (typeof value === "boolean" || value === null) return this.#scalar(this.#booleans, value, charge);
    if (typeof value !== "object" || !Object.isFrozen(value)) invariant("INVALID_QUESTION_KEY", scope.owner.owner);
    charge();
    const program = Object.getOwnPropertyDescriptor(value, "programIdentity");
    const owner = Object.getOwnPropertyDescriptor(value, "owner");
    if (program === undefined || !("value" in program) || program.value !== this.#program
      || owner === undefined || !("value" in owner) || typeof owner.value !== "string" || owner.value.length === 0) {
      invariant("INVALID_QUESTION_KEY", scope.owner.owner);
    }
    let identity = this.#objects.get(value);
    if (identity === undefined) {
      charge();
      identity = this.#identity();
      this.#objects.set(value, identity);
    }
    return identity;
  }

  #scalar<Value>(map: Map<Value, bigint>, value: Value, charge: (amount?: bigint) => void): bigint {
    let identity = map.get(value);
    if (identity === undefined) {
      charge();
      identity = this.#identity();
      map.set(value, identity);
    }
    return identity;
  }

  #identity(): bigint {
    this.#next += 1n;
    return this.#next;
  }
}
