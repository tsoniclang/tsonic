export class Decoder {
    source;
    constructor(source) {
        this.source = source;
    }
    Decode(target) {
        const text = sourceToString(this.source);
        if (target !== undefined) {
            target.value = text;
        }
        return undefined;
    }
}
export function NewDecoder(source) {
    return new Decoder(source);
}
function sourceToString(source) {
    if (typeof source === "string") {
        return source;
    }
    if (source instanceof Uint8Array) {
        return new TextDecoder().decode(source);
    }
    return "";
}
//# sourceMappingURL=xml.js.map