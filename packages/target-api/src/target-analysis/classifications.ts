import {
  targetUseSiteIdentity,
} from "./use-sites.js";
import type {
  TargetUseSiteRef,
} from "./use-sites.js";

export interface TargetClassificationKey<Value> {
  readonly id: string;
  readonly equals: (left: Value, right: Value) => boolean;
}

interface StoredTargetClassification {
  readonly key: TargetClassificationKey<unknown>;
  readonly value: unknown;
}

export type TargetClassificationWriteResult<Value> =
  | { readonly kind: "added" }
  | { readonly kind: "idempotent"; readonly value: Value }
  | {
      readonly kind: "conflict";
      readonly previous: Value;
      readonly candidate: Value;
    };

export interface TargetClassificationQueries {
  get<Value>(
    subject: object,
    key: TargetClassificationKey<Value>,
  ): Value | undefined;
  has<Value>(
    subject: object,
    key: TargetClassificationKey<Value>,
  ): boolean;
}

export interface TargetClassificationBuilder extends TargetClassificationQueries {
  set<Value>(
    subject: object,
    key: TargetClassificationKey<Value>,
    value: Value,
  ): TargetClassificationWriteResult<Value>;
  seal(): TargetClassificationQueries;
}

export interface TargetUseClassificationQueries {
  get<Value>(
    use: TargetUseSiteRef,
    key: TargetClassificationKey<Value>,
  ): Value | undefined;
  has<Value>(
    use: TargetUseSiteRef,
    key: TargetClassificationKey<Value>,
  ): boolean;
}

export interface TargetUseClassificationBuilder
  extends TargetUseClassificationQueries {
  set<Value>(
    use: TargetUseSiteRef,
    key: TargetClassificationKey<Value>,
    value: Value,
  ): TargetClassificationWriteResult<Value>;
  seal(): TargetUseClassificationQueries;
}

export function createTargetClassificationKey<Value>(
  id: string,
  equals: (left: Value, right: Value) => boolean = Object.is,
): TargetClassificationKey<Value> {
  if (id.length === 0) {
    throw new Error("A target classification key requires a non-empty identity.");
  }
  return Object.freeze({ id, equals });
}

export function createTargetClassificationBuilder(): TargetClassificationBuilder {
  const values = new WeakMap<object, Map<string, StoredTargetClassification>>();
  const keysById = new Map<string, TargetClassificationKey<unknown>>();
  let sealed = false;

  const get = <Value>(
    subject: object,
    key: TargetClassificationKey<Value>,
  ): Value | undefined => {
    const stored = values.get(subject)?.get(key.id);
    assertClassificationKeyIdentity(
      keysById.get(key.id) ?? stored?.key,
      key as TargetClassificationKey<unknown>,
    );
    return stored?.value as Value | undefined;
  };

  const queries: TargetClassificationQueries = Object.freeze({
    get,
    has<Value>(subject: object, key: TargetClassificationKey<Value>): boolean {
      const stored = values.get(subject)?.get(key.id);
      assertClassificationKeyIdentity(
        keysById.get(key.id) ?? stored?.key,
        key as TargetClassificationKey<unknown>,
      );
      return stored !== undefined;
    },
  });

  return Object.freeze({
    ...queries,
    set<Value>(
      subject: object,
      key: TargetClassificationKey<Value>,
      value: Value,
    ): TargetClassificationWriteResult<Value> {
      if (sealed) {
        throw new Error("Target classifications are sealed.");
      }
      let subjectValues = values.get(subject);
      if (subjectValues === undefined) {
        subjectValues = new Map<string, StoredTargetClassification>();
        values.set(subject, subjectValues);
      }
      const untypedKey = key as TargetClassificationKey<unknown>;
      registerClassificationKey(keysById, untypedKey);
      const stored = subjectValues.get(key.id);
      assertClassificationKeyIdentity(stored?.key, untypedKey);
      if (stored === undefined) {
        subjectValues.set(key.id, Object.freeze({
          key: untypedKey,
          value,
        }));
        return Object.freeze({ kind: "added" });
      }
      const previous = stored.value as Value;
      if (key.equals(previous, value)) {
        return Object.freeze({ kind: "idempotent", value: previous });
      }
      return Object.freeze({
        kind: "conflict",
        previous,
        candidate: value,
      });
    },
    seal(): TargetClassificationQueries {
      if (sealed) {
        throw new Error("Target classifications can be sealed exactly once.");
      }
      sealed = true;
      return queries;
    },
  });
}

export function createTargetUseClassificationBuilder(): TargetUseClassificationBuilder {
  const values = new WeakMap<
    object,
    Map<string, Map<string, StoredTargetClassification>>
  >();
  const keysById = new Map<string, TargetClassificationKey<unknown>>();
  let sealed = false;

  const classificationsFor = (
    use: TargetUseSiteRef,
  ): Map<string, StoredTargetClassification> | undefined =>
    values.get(use.subject)?.get(targetUseSiteIdentity(use));
  const get = <Value>(
    use: TargetUseSiteRef,
    key: TargetClassificationKey<Value>,
  ): Value | undefined => {
    const stored = classificationsFor(use)?.get(key.id);
    assertClassificationKeyIdentity(
      keysById.get(key.id) ?? stored?.key,
      key as TargetClassificationKey<unknown>,
    );
    return stored?.value as Value | undefined;
  };
  const queries: TargetUseClassificationQueries = Object.freeze({
    get,
    has<Value>(
      use: TargetUseSiteRef,
      key: TargetClassificationKey<Value>,
    ): boolean {
      const stored = classificationsFor(use)?.get(key.id);
      assertClassificationKeyIdentity(
        keysById.get(key.id) ?? stored?.key,
        key as TargetClassificationKey<unknown>,
      );
      return stored !== undefined;
    },
  });

  return Object.freeze({
    ...queries,
    set<Value>(
      use: TargetUseSiteRef,
      key: TargetClassificationKey<Value>,
      value: Value,
    ): TargetClassificationWriteResult<Value> {
      if (sealed) {
        throw new Error("Target use classifications are sealed.");
      }
      let byIdentity = values.get(use.subject);
      if (byIdentity === undefined) {
        byIdentity = new Map();
        values.set(use.subject, byIdentity);
      }
      const identity = targetUseSiteIdentity(use);
      let classifications = byIdentity.get(identity);
      if (classifications === undefined) {
        classifications = new Map<string, StoredTargetClassification>();
        byIdentity.set(identity, classifications);
      }
      const untypedKey = key as TargetClassificationKey<unknown>;
      registerClassificationKey(keysById, untypedKey);
      const stored = classifications.get(key.id);
      assertClassificationKeyIdentity(stored?.key, untypedKey);
      if (stored === undefined) {
        classifications.set(key.id, Object.freeze({
          key: untypedKey,
          value,
        }));
        return Object.freeze({ kind: "added" });
      }
      const previous = stored.value as Value;
      if (key.equals(previous, value)) {
        return Object.freeze({ kind: "idempotent", value: previous });
      }
      return Object.freeze({ kind: "conflict", previous, candidate: value });
    },
    seal(): TargetUseClassificationQueries {
      if (sealed) {
        throw new Error("Target use classifications can be sealed exactly once.");
      }
      sealed = true;
      return queries;
    },
  });
}

function registerClassificationKey(
  keysById: Map<string, TargetClassificationKey<unknown>>,
  key: TargetClassificationKey<unknown>,
): void {
  const registered = keysById.get(key.id);
  assertClassificationKeyIdentity(registered, key);
  if (registered === undefined) {
    keysById.set(key.id, key);
  }
}

function assertClassificationKeyIdentity(
  registered: TargetClassificationKey<unknown> | undefined,
  candidate: TargetClassificationKey<unknown>,
): void {
  if (registered !== undefined && registered !== candidate) {
    throw new Error(
      `Target classification key identity '${candidate.id}' was registered by a different key object.`,
    );
  }
}
