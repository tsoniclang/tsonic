import type { createSourceStorageTransport } from "./transport.js";
import type { createSourceStorageDomainWitnesses } from "../graph/domain-witnesses.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import type { SourceStorageScope } from "../graph/scoped-model.js";
export declare function createSourceStorageDomainInputs(transport: ReturnType<typeof createSourceStorageTransport>, witnesses: ReturnType<typeof createSourceStorageDomainWitnesses>, budget: SourceStorageBudget): Readonly<{
    query: <Key, Value>(collect: (key: Key, retain: (cost: number) => boolean) => ReadonlySet<Value> | undefined) => (key: Key) => ReadonlySet<Value> | undefined;
    owners: (subject: SourceStorageSubject) => Iterable<SourceStorageSubject | undefined>;
    hasInputs: () => boolean;
    readPresence(subject: SourceStorageSubject): boolean;
    has(subject: SourceStorageSubject): boolean;
    read(subject: SourceStorageSubject, owner?: SourceStorageSubject): void;
    add(subject: SourceStorageSubject | undefined, kind: Parameters<typeof witnesses.add>[1], exposure: Parameters<typeof witnesses.add>[2], owner?: SourceStorageSubject, creationBindings?: SourceStorageScope): void;
    seal(): void;
}>;
//# sourceMappingURL=domain-inputs.d.ts.map