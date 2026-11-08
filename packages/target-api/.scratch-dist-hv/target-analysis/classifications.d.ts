import type { TargetUseSiteRef } from "./use-sites.js";
export interface TargetClassificationKey<Value> {
    readonly id: string;
    readonly equals: (left: Value, right: Value) => boolean;
}
export type TargetClassificationWriteResult<Value> = {
    readonly kind: "added";
} | {
    readonly kind: "idempotent";
    readonly value: Value;
} | {
    readonly kind: "conflict";
    readonly previous: Value;
    readonly candidate: Value;
};
export interface TargetClassificationQueries {
    get<Value>(subject: object, key: TargetClassificationKey<Value>): Value | undefined;
    has<Value>(subject: object, key: TargetClassificationKey<Value>): boolean;
}
export interface TargetClassificationBuilder extends TargetClassificationQueries {
    set<Value>(subject: object, key: TargetClassificationKey<Value>, value: Value): TargetClassificationWriteResult<Value>;
    seal(): TargetClassificationQueries;
}
export interface TargetUseClassificationQueries {
    get<Value>(use: TargetUseSiteRef, key: TargetClassificationKey<Value>): Value | undefined;
    has<Value>(use: TargetUseSiteRef, key: TargetClassificationKey<Value>): boolean;
}
export interface TargetUseClassificationBuilder extends TargetUseClassificationQueries {
    set<Value>(use: TargetUseSiteRef, key: TargetClassificationKey<Value>, value: Value): TargetClassificationWriteResult<Value>;
    seal(): TargetUseClassificationQueries;
}
export declare function createTargetClassificationKey<Value>(id: string, equals?: (left: Value, right: Value) => boolean): TargetClassificationKey<Value>;
export declare function createTargetClassificationBuilder(): TargetClassificationBuilder;
export declare function createTargetUseClassificationBuilder(): TargetUseClassificationBuilder;
//# sourceMappingURL=classifications.d.ts.map