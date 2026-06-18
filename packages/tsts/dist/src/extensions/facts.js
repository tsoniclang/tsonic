export class ExtensionFacts {
    #factsBySubject = new WeakMap();
    #subjectCount = 0;
    set(key, subject, value) {
        this.#getSubjectFacts(subject).set(key.id, value);
    }
    get(key, subject) {
        return this.#factsBySubject.get(subject)?.get(key.id);
    }
    has(key, subject) {
        return this.#factsBySubject.get(subject)?.has(key.id) ?? false;
    }
    delete(key, subject) {
        return this.#factsBySubject.get(subject)?.delete(key.id) ?? false;
    }
    snapshotFor(subjects) {
        const records = [];
        for (const subject of subjects) {
            const facts = this.#factsBySubject.get(subject);
            if (!facts)
                continue;
            for (const [keyId, value] of facts.entries()) {
                records.push({ keyId, value });
            }
        }
        return {
            subjectCount: subjects.length,
            facts: records,
        };
    }
    #getSubjectFacts(subject) {
        const existing = this.#factsBySubject.get(subject);
        if (existing) {
            return existing;
        }
        const facts = new Map();
        this.#factsBySubject.set(subject, facts);
        this.#subjectCount += 1;
        return facts;
    }
    get subjectCount() {
        return this.#subjectCount;
    }
}
export const defineExtensionFactKey = (id, description) => description === undefined
    ? { id }
    : {
        id,
        description,
    };
//# sourceMappingURL=facts.js.map