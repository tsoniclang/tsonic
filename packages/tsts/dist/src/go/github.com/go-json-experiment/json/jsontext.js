const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
export function AllowDuplicateNames(allow) {
    return { name: "AllowDuplicateNames", value: allow };
}
export function AllowInvalidUTF8(allow) {
    return { name: "AllowInvalidUTF8", value: allow };
}
export class Kind {
    #value;
    constructor(value) {
        this.#value = value;
    }
    Kind() {
        return this.#value;
    }
    String() {
        return this.#value;
    }
}
export const BeginArray = new Kind("[");
export const BeginObject = new Kind("{");
export const EndArray = new Kind("]");
export const EndObject = new Kind("}");
export const Null = new Kind("n");
class JsonDecoder {
    #value;
    #consumed = false;
    constructor(input) {
        this.#value = parseInput(input);
    }
    PeekKind() {
        return kindOf(this.#value);
    }
    ReadToken() {
        if (this.#consumed) {
            return [new Kind(""), new Error("json decoder exhausted")];
        }
        this.#consumed = true;
        return [new Kind(kindOf(this.#value)), undefined];
    }
    ReadValue() {
        if (this.#consumed) {
            return [undefined, new Error("json decoder exhausted")];
        }
        this.#consumed = true;
        return [this.#value, undefined];
    }
}
class JsonEncoder {
    #chunks = [];
    #stack = [];
    WriteToken(kind) {
        try {
            const value = kind.Kind();
            switch (value) {
                case "{":
                    this.#writeValuePrefix();
                    this.#chunks.push("{");
                    this.#stack.push({ kind: "object", count: 0, expecting: "key" });
                    return undefined;
                case "[":
                    this.#writeValuePrefix();
                    this.#chunks.push("[");
                    this.#stack.push({ kind: "array", count: 0 });
                    return undefined;
                case "}":
                    return this.#closeContainer("object", "}");
                case "]":
                    return this.#closeContainer("array", "]");
                case "n":
                    this.#writeValuePrefix();
                    this.#chunks.push("null");
                    return undefined;
                default:
                    return new Error(`unsupported json token ${value}`);
            }
        }
        catch (error) {
            return toError(error);
        }
    }
    WriteValue(value) {
        try {
            const frame = this.#stack[this.#stack.length - 1];
            const objectFrame = asJsonObjectFrame(frame);
            if (objectFrame !== undefined) {
                if (objectFrame.expecting !== "key") {
                    this.#writeValuePrefix();
                    this.#chunks.push(JSON.stringify(normalizeForJson(value)));
                    return undefined;
                }
                if (objectFrame.count > 0) {
                    this.#chunks.push(",");
                }
                this.#chunks.push(JSON.stringify(String(value)));
                this.#chunks.push(":");
                objectFrame.expecting = "value";
                return undefined;
            }
            this.#writeValuePrefix();
            this.#chunks.push(JSON.stringify(normalizeForJson(value)));
            return undefined;
        }
        catch (error) {
            return toError(error);
        }
    }
    Bytes() {
        return Array.from(textEncoder.encode(this.#chunks.join("")));
    }
    #writeValuePrefix() {
        const frame = this.#stack[this.#stack.length - 1];
        if (frame === undefined) {
            if (this.#chunks.length > 0) {
                throw new Error("json encoder already has a top-level value");
            }
            return;
        }
        if (frame.kind === "array") {
            if (frame.count > 0) {
                this.#chunks.push(",");
            }
            frame.count = frame.count + 1;
            return;
        }
        const objectFrame = asJsonObjectFrame(frame);
        if (objectFrame === undefined) {
            throw new Error("json array value prefix reached object-only branch");
        }
        if (objectFrame.expecting !== "value") {
            throw new Error("json object value written before key");
        }
        objectFrame.count = objectFrame.count + 1;
        objectFrame.expecting = "key";
    }
    #closeContainer(expected, token) {
        const frame = this.#stack.pop();
        if (frame === undefined || frame.kind !== expected) {
            return new Error(`json encoder mismatched ${token} token`);
        }
        const objectFrame = asJsonObjectFrame(frame);
        if (objectFrame !== undefined) {
            if (objectFrame.expecting !== "key") {
                return new Error("json object closed before value");
            }
        }
        this.#chunks.push(token);
        return undefined;
    }
}
function asJsonObjectFrame(frame) {
    return frame !== undefined && frame.kind === "object" ? frame : undefined;
}
export function NewDecoder(reader) {
    return new JsonDecoder(reader);
}
export function NewEncoder() {
    return new JsonEncoder();
}
export function WithIndent(indent) {
    return { name: "WithIndent", value: indent };
}
export function WithIndentPrefix(prefix) {
    return { name: "WithIndentPrefix", value: prefix };
}
const parseInput = (input) => {
    if (typeof input === "string") {
        return JSON.parse(input);
    }
    if (Array.isArray(input) || input instanceof Uint8Array) {
        return JSON.parse(textDecoder.decode(Uint8Array.from(input)));
    }
    if (typeof input === "object" && input !== null && "Read" in input) {
        const bytes = [];
        const chunk = new Array(4096);
        for (;;) {
            const [count, err] = input.Read(chunk);
            if (count > 0) {
                bytes.push(...chunk.slice(0, count));
            }
            if (err !== undefined || count === 0) {
                break;
            }
        }
        return JSON.parse(textDecoder.decode(Uint8Array.from(bytes)));
    }
    return input;
};
const kindOf = (value) => {
    if (value === null) {
        return "n";
    }
    if (Array.isArray(value)) {
        return "[";
    }
    if (typeof value === "object") {
        return "{";
    }
    if (typeof value === "string") {
        return "\"";
    }
    if (typeof value === "boolean") {
        return value ? "t" : "f";
    }
    return "0";
};
const normalizeForJson = (value) => {
    if (value instanceof Map) {
        return Object.fromEntries(value);
    }
    if (value instanceof Uint8Array) {
        return Array.from(value);
    }
    return value;
};
const toError = (error) => {
    return error instanceof Error ? error : new Error(String(error));
};
export const writeTo = (writer, bytes) => {
    const [, err] = writer.Write(bytes);
    return err;
};
//# sourceMappingURL=jsontext.js.map