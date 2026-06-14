export type ExtensionFactKey<TSubject extends object, TValue> = {
    readonly id: string;
    readonly description?: string;
    readonly __subject?: (subject: TSubject) => TSubject;
    readonly __value?: (value: TValue) => TValue;
};
export type ExtensionFactKeyLike<TValue> = {
    readonly id: string;
    readonly description?: string;
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
export declare class ExtensionFacts {
    #private;
    set<TSubject extends object, TValue>(key: ExtensionFactKeyLike<TValue>, subject: TSubject, value: TValue): void;
    get<TSubject extends object, TValue>(key: ExtensionFactKeyLike<TValue>, subject: TSubject): TValue | undefined;
    has<TSubject extends object, TValue>(key: ExtensionFactKeyLike<TValue>, subject: TSubject): boolean;
    delete<TSubject extends object, TValue>(key: ExtensionFactKeyLike<TValue>, subject: TSubject): boolean;
    snapshotFor(subjects: readonly object[]): ExtensionFactSnapshot;
    get subjectCount(): number;
}
export declare const defineExtensionFactKey: <TSubject extends object, TValue>(id: string, description?: string) => ExtensionFactKey<TSubject, TValue>;
//# sourceMappingURL=facts.d.ts.map