export interface ExtensionFactKey<T> {
    readonly extensionId: string;
    readonly name: string;
    readonly id: string;
    readonly equals: (left: T, right: T) => boolean;
    readonly snapshot: (value: T) => T;
}
export interface ExtensionFactKeyOptions<T> {
    readonly extensionId: string;
    readonly name: string;
    readonly snapshot: (value: T) => T;
    readonly equals?: (left: T, right: T) => boolean;
}
export declare function defineExtensionFactKey<T>(options: ExtensionFactKeyOptions<T>): ExtensionFactKey<T>;
export declare function formatExtensionFactKeyForDisplay<T>(key: ExtensionFactKey<T>): string;
export declare function getExtensionFactKeyIdentity<T>(key: ExtensionFactKey<T>): object;
//# sourceMappingURL=fact-key.d.ts.map