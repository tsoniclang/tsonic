export const ContinueOnError = 0;
export class FlagSet {
    name;
    errorHandling;
    flags = new Map();
    constructor(name, errorHandling) {
        this.name = name;
        this.errorHandling = errorHandling;
    }
    String(name, value, _usage) {
        const target = { value };
        this.flags.set(name, { name, kind: "string", target });
        return target;
    }
    Bool(name, value, _usage) {
        const target = { value };
        this.flags.set(name, { name, kind: "bool", target });
        return target;
    }
    Parse(args) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (!arg.startsWith("-")) {
                continue;
            }
            const raw = arg.replace(/^-+/, "");
            const equals = raw.indexOf("=");
            const name = equals >= 0 ? raw.slice(0, equals) : raw;
            const flag = this.flags.get(name);
            if (flag === undefined) {
                return new globalThis.Error(`flag provided but not defined: -${name}`);
            }
            if (flag.kind === "bool") {
                const text = equals >= 0 ? raw.slice(equals + 1) : "true";
                flag.target.value = (text === "true" || text === "1");
            }
            else {
                let text = equals >= 0 ? raw.slice(equals + 1) : "";
                if (equals < 0) {
                    i++;
                    if (i >= args.length) {
                        return new globalThis.Error(`flag needs an argument: -${name}`);
                    }
                    text = args[i];
                }
                flag.target.value = text;
            }
        }
        return undefined;
    }
}
export const CommandLine = new FlagSet("", ContinueOnError);
export function NewFlagSet(name, errorHandling) {
    return new FlagSet(name, errorHandling);
}
export function String(name, value, usage) {
    return CommandLine.String(name, value, usage);
}
export function Bool(name, value, usage) {
    return CommandLine.Bool(name, value, usage);
}
export function Parse(args = globalThis.process?.argv?.slice(2) ?? []) {
    return CommandLine.Parse(args);
}
export function Usage() {
    // Go's package-level Usage is caller-replaceable. The port keeps the default a
    // no-op because callers in TS-Go only need the symbol to exist.
}
//# sourceMappingURL=flag.js.map