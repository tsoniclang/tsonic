import { NewDecoder, NewEncoder, writeTo } from "./json/jsontext.js";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
export const JsonFieldNames = Symbol("tsts.jsonFieldNames");
export function Deterministic(value) {
    return { name: "Deterministic", value };
}
export function Marshal(value, ...opts) {
    try {
        return [Array.from(textEncoder.encode(stringify(value, opts))), undefined];
    }
    catch (error) {
        return [[], toError(error)];
    }
}
export function MarshalEncode(encoder, value, ...opts) {
    if (encoder === undefined) {
        return new Error("nil json encoder");
    }
    if (isMarshalerTo(value)) {
        return value.MarshalJSONTo(encoder);
    }
    return encoder.WriteValue(JSON.parse(stringify(value, opts)));
}
export function MarshalWrite(writer, value, ...opts) {
    const [bytes, err] = Marshal(value, ...opts);
    if (err !== undefined) {
        return err;
    }
    return writeTo(writer, bytes);
}
export function Unmarshal(data, out, ...opts) {
    void opts;
    try {
        assignDecoded(out, JSON.parse(textDecoder.decode(Uint8Array.from(data))));
        return undefined;
    }
    catch (error) {
        return toError(error);
    }
}
export function UnmarshalDecode(decoder, out, ...opts) {
    void opts;
    if (decoder === undefined) {
        return new Error("nil json decoder");
    }
    if (isUnmarshalerFrom(out)) {
        return out.UnmarshalJSONFrom(decoder);
    }
    const [value, err] = decoder.ReadValue();
    if (err !== undefined) {
        return err;
    }
    assignDecoded(out, value);
    return undefined;
}
export function UnmarshalRead(reader, out, ...opts) {
    return UnmarshalDecode(NewDecoder(reader), out, ...opts);
}
const stringify = (value, opts) => {
    const indent = opts.find((option) => option.name === "WithIndent")?.value;
    return JSON.stringify(value, (_key, current) => normalizeForJson(current), typeof indent === "string" ? indent : undefined);
};
const normalizeForJson = (value) => {
    if (value instanceof Map) {
        return Object.fromEntries(value);
    }
    if (value instanceof Uint8Array) {
        return Array.from(value);
    }
    const fieldNames = getJsonFieldNames(value);
    if (fieldNames !== undefined) {
        const normalized = {};
        for (const [key, current] of Object.entries(value)) {
            if (typeof current === "function") {
                continue;
            }
            const field = fieldNames[key];
            const name = typeof field === "string" ? field : field?.name ?? key;
            if (typeof field === "object" && field.omitZero === true && isZeroJsonValue(current)) {
                continue;
            }
            normalized[name] = current;
        }
        return normalized;
    }
    return value;
};
const assignDecoded = (out, value) => {
    if (out === undefined || out === null) {
        return;
    }
    if (Array.isArray(out) && Array.isArray(value)) {
        out.splice(0, out.length, ...value);
        return;
    }
    if (typeof out === "object" && typeof value === "object" && value !== null) {
        Object.assign(out, decodeFieldNames(out, value));
    }
};
const decodeFieldNames = (out, value) => {
    const fieldNames = getJsonFieldNames(out);
    if (fieldNames === undefined) {
        return value;
    }
    const reverse = new Map();
    for (const [key, field] of Object.entries(fieldNames)) {
        reverse.set(typeof field === "string" ? field : field.name, key);
    }
    const decoded = {};
    for (const [key, current] of Object.entries(value)) {
        decoded[reverse.get(key) ?? key] = current;
    }
    return decoded;
};
const getJsonFieldNames = (value) => {
    if (typeof value !== "object" || value === null) {
        return undefined;
    }
    return value[JsonFieldNames];
};
const isZeroJsonValue = (value) => {
    return value === undefined || value === null || value === false || value === 0 || value === "" || (Array.isArray(value) && value.length === 0);
};
const isMarshalerTo = (value) => {
    return typeof value === "object" && value !== null && "MarshalJSONTo" in value && typeof value.MarshalJSONTo === "function";
};
const isUnmarshalerFrom = (value) => {
    return typeof value === "object" && value !== null && "UnmarshalJSONFrom" in value && typeof value.UnmarshalJSONFrom === "function";
};
const toError = (error) => {
    return error instanceof Error ? error : new Error(String(error));
};
//# sourceMappingURL=json.js.map