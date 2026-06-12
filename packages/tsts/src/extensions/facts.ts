export type ExtensionFactKey<TSubject extends object, TValue> = {
  readonly id: string;
  readonly description?: string;
  readonly __subject?: (subject: TSubject) => TSubject;
  readonly __value?: (value: TValue) => TValue;
};

export type ExtensionFactRecord = {
  readonly keyId: string;
  readonly value: unknown;
};

export type ExtensionFactSnapshot = {
  readonly subjectCount: number;
  readonly facts: readonly ExtensionFactRecord[];
};

export class ExtensionFacts {
  readonly #factsBySubject = new WeakMap<object, Map<string, unknown>>();
  #subjectCount = 0;

  set<TSubject extends object, TValue>(
    key: ExtensionFactKey<TSubject, TValue>,
    subject: TSubject,
    value: TValue,
  ): void {
    this.#getSubjectFacts(subject).set(key.id, value);
  }

  get<TSubject extends object, TValue>(
    key: ExtensionFactKey<TSubject, TValue>,
    subject: TSubject,
  ): TValue | undefined {
    return this.#factsBySubject.get(subject)?.get(key.id) as TValue | undefined;
  }

  has<TSubject extends object, TValue>(
    key: ExtensionFactKey<TSubject, TValue>,
    subject: TSubject,
  ): boolean {
    return this.#factsBySubject.get(subject)?.has(key.id) ?? false;
  }

  delete<TSubject extends object, TValue>(
    key: ExtensionFactKey<TSubject, TValue>,
    subject: TSubject,
  ): boolean {
    return this.#factsBySubject.get(subject)?.delete(key.id) ?? false;
  }

  snapshotFor(subjects: readonly object[]): ExtensionFactSnapshot {
    const records: ExtensionFactRecord[] = [];
    for (const subject of subjects) {
      const facts = this.#factsBySubject.get(subject);
      if (!facts) continue;
      for (const [keyId, value] of facts.entries()) {
        records.push({ keyId, value });
      }
    }

    return {
      subjectCount: subjects.length,
      facts: records,
    };
  }

  #getSubjectFacts(subject: object): Map<string, unknown> {
    const existing = this.#factsBySubject.get(subject);
    if (existing) {
      return existing;
    }

    const facts = new Map<string, unknown>();
    this.#factsBySubject.set(subject, facts);
    this.#subjectCount += 1;
    return facts;
  }

  get subjectCount(): number {
    return this.#subjectCount;
  }
}

export const defineExtensionFactKey = <TSubject extends object, TValue>(
  id: string,
  description?: string,
): ExtensionFactKey<TSubject, TValue> =>
  description === undefined
    ? { id }
    : {
        id,
        description,
      };
