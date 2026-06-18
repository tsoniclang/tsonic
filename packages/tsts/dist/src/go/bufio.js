import { EOF } from "./io.js";
export class Reader {
    source;
    buffer = [];
    constructor(source) {
        this.source = source;
    }
    Read(p) {
        let count = 0;
        while (count < p.length) {
            const [b, err] = this.ReadByte();
            if (err !== undefined) {
                return [count, count > 0 ? undefined : err];
            }
            p[count] = b;
            count++;
        }
        return [count, undefined];
    }
    ReadByte() {
        if (this.buffer.length > 0) {
            return [this.buffer.shift(), undefined];
        }
        const one = [0];
        const [n, err] = this.source.Read(one);
        if (n > 0) {
            return [one[0], undefined];
        }
        return [0, err ?? EOF];
    }
    ReadBytes(delim) {
        const out = [];
        for (;;) {
            const [b, err] = this.ReadByte();
            if (err !== undefined) {
                return [out, err];
            }
            out.push(b);
            if (b === delim) {
                return [out, undefined];
            }
        }
    }
}
export class Writer {
    target;
    buffer = [];
    constructor(target) {
        this.target = target;
    }
    Write(p) {
        this.buffer.push(...p);
        return [p.length, undefined];
    }
    WriteString(s) {
        const bytes = new globalThis.TextEncoder().encode(s);
        for (const b of bytes) {
            this.buffer.push(b);
        }
        return [bytes.length, undefined];
    }
    Flush() {
        if (this.buffer.length === 0) {
            return undefined;
        }
        const data = this.buffer.splice(0, this.buffer.length);
        const [, err] = this.target.Write(data);
        return err;
    }
}
export class Scanner {
    lines;
    index = -1;
    constructor(reader) {
        const bytes = [];
        for (;;) {
            const chunk = new globalThis.Array(4096).fill(0);
            const [n, err] = reader.Read(chunk);
            if (n > 0) {
                bytes.push(...chunk.slice(0, n));
            }
            if (err !== undefined || n === 0) {
                break;
            }
        }
        this.lines = new globalThis.TextDecoder("utf-8").decode(Uint8Array.from(bytes)).split(/\r?\n/);
    }
    Scan() {
        if (this.index + 1 >= this.lines.length) {
            return false;
        }
        this.index++;
        return true;
    }
    Text() {
        return this.index >= 0 && this.index < this.lines.length ? this.lines[this.index] : "";
    }
    Err() {
        return undefined;
    }
}
export function NewReader(reader) {
    return new Reader(reader);
}
export function NewScanner(reader) {
    return new Scanner(reader);
}
export function NewWriter(writer) {
    return new Writer(writer);
}
//# sourceMappingURL=bufio.js.map