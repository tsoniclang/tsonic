export type NodeByteSource = string | ArrayLike<number>;
export declare const toNodeBytes: (value: NodeByteSource) => Uint8Array<ArrayBuffer>;
export declare const concatNodeBytes: (values: readonly (NodeByteSource | undefined)[]) => Uint8Array<ArrayBuffer>;
export declare const byteArraysEqual: (left: Uint8Array, right: Uint8Array) => boolean;
//# sourceMappingURL=nodebytes.d.ts.map