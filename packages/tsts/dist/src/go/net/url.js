export class URL {
    value;
    constructor(value) {
        this.value = value;
    }
    String() {
        return this.value.toString();
    }
    Path() {
        return this.value.pathname;
    }
    RawQuery() {
        return this.value.search.length > 0 ? this.value.search.slice(1) : "";
    }
}
export function Parse(rawURL) {
    try {
        return [new URL(new globalThis.URL(rawURL)), undefined];
    }
    catch (absoluteError) {
        try {
            return [new URL(new globalThis.URL(rawURL, "file:///")), undefined];
        }
        catch {
            return [undefined, absoluteError instanceof globalThis.Error ? absoluteError : new globalThis.Error(String(absoluteError))];
        }
    }
}
export function PathEscape(s) {
    return encodeURIComponent(s).replace(/[!'()*]/g, (ch) => "%" + ch.charCodeAt(0).toString(16).toUpperCase());
}
export function QueryEscape(s) {
    return encodeURIComponent(s).replace(/%20/g, "+");
}
export function QueryUnescape(s) {
    try {
        return [decodeURIComponent(s.replace(/\+/g, " ")), undefined];
    }
    catch (error) {
        return ["", error instanceof globalThis.Error ? error : new globalThis.Error(String(error))];
    }
}
//# sourceMappingURL=url.js.map