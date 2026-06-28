import { EOF } from "../io.js";
import * as nodeZlib from "node:zlib";
export const BestCompression = 9;
class gzipReader {
    data;
    offset = 0;
    constructor(data) {
        this.data = data;
    }
    Read(p) {
        if (this.offset >= this.data.length) {
            return [0, EOF];
        }
        const count = Math.min(p.length, this.data.length - this.offset);
        for (let index = 0; index < count; index++) {
            p[index] = this.data[this.offset + index];
        }
        this.offset += count;
        return [count, undefined];
    }
    Close() {
        return undefined;
    }
}
class gzipWriter {
    writer;
    level;
    chunks = [];
    constructor(writer, level) {
        this.writer = writer;
        this.level = level;
    }
    Write(p) {
        this.chunks.push(...p);
        return [p.length, undefined];
    }
    Close() {
        try {
            const gzipped = nodeZlib.gzipSync(Buffer.from(this.chunks), { level: this.level });
            const [, err] = this.writer.Write(Array.from(gzipped));
            return err;
        }
        catch (error) {
            return normalizeError(error);
        }
    }
}
export function NewReader(source) {
    try {
        const bytes = sourceToBytes(source);
        return [new gzipReader(nodeZlib.gunzipSync(Buffer.from(bytes))), undefined];
    }
    catch (error) {
        return [undefined, normalizeError(error)];
    }
}
export function NewWriterLevel(writer, level) {
    if (level < -1 || level > 9) {
        return [undefined, new globalThis.Error("gzip: invalid compression level")];
    }
    return [new gzipWriter(writer, level), undefined];
}
function sourceToBytes(source) {
    if (typeof source === "string") {
        return new TextEncoder().encode(source);
    }
    if (source instanceof Uint8Array) {
        return source;
    }
    if (globalThis.Array.isArray(source)) {
        return Uint8Array.from(source);
    }
    const chunks = [];
    const buffer = new Array(8192);
    for (;;) {
        const [count, err] = source.Read(buffer);
        if (count > 0) {
            chunks.push(...buffer.slice(0, count));
        }
        if (err !== undefined) {
            break;
        }
        if (count === 0) {
            break;
        }
    }
    return Uint8Array.from(chunks);
}
function normalizeError(error) {
    return error instanceof globalThis.Error ? error : new globalThis.Error(String(error));
}
//# sourceMappingURL=gzip.js.map