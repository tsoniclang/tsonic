const textDecoder = new TextDecoder();
export function Unmarshal(data, out) {
    try {
        assignDecoded(out, JSON.parse(textDecoder.decode(Uint8Array.from(data))));
        return undefined;
    }
    catch (error) {
        return error instanceof Error ? error : new Error(String(error));
    }
}
const assignDecoded = (out, value) => {
    if (out === undefined || out === null) {
        return;
    }
    if (Array.isArray(out) && Array.isArray(value)) {
        out.splice(0, out.length, ...value);
        return;
    }
    if (typeof out === "object" && typeof value === "object" && value !== null) {
        Object.assign(out, value);
    }
};
//# sourceMappingURL=json.js.map