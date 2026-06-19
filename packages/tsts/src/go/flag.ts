import type { bool, int } from "./scalars.js";
import type { GoError, GoSlice } from "./compat.js";

export const ContinueOnError = 0 as int;

export interface FlagValue<T> {
  value: T;
}

type FlagKind = "bool" | "string";

interface RegisteredFlag<T> {
  readonly name: string;
  readonly kind: FlagKind;
  readonly target: FlagValue<T>;
}

export class FlagSet {
  private readonly flags = new Map<string, RegisteredFlag<unknown>>();

  constructor(readonly name: string, readonly errorHandling: int) {}

  String(name: string, value: string, _usage: string): FlagValue<string> {
    const target: FlagValue<string> = { value };
    this.flags.set(name, { name, kind: "string", target });
    return target;
  }

  Bool(name: string, value: bool, _usage: string): FlagValue<bool> {
    const target: FlagValue<bool> = { value };
    this.flags.set(name, { name, kind: "bool", target });
    return target;
  }

  Parse(args: GoSlice<string>): GoError {
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]!;
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
        (flag.target as FlagValue<bool>).value = (text === "true" || text === "1") as bool;
      } else {
        let text = equals >= 0 ? raw.slice(equals + 1) : "";
        if (equals < 0) {
          i++;
          if (i >= args.length) {
            return new globalThis.Error(`flag needs an argument: -${name}`);
          }
          text = args[i]!;
        }
        (flag.target as FlagValue<string>).value = text;
      }
    }
    return undefined;
  }
}

export const CommandLine: FlagSet = new FlagSet("", ContinueOnError);

export function NewFlagSet(name: string, errorHandling: int): FlagSet {
  return new FlagSet(name, errorHandling);
}

export function String(name: string, value: string, usage: string): FlagValue<string> {
  return CommandLine.String(name, value, usage);
}

export function Bool(name: string, value: bool, usage: string): FlagValue<bool> {
  return CommandLine.Bool(name, value, usage);
}

export function Parse(args: GoSlice<string> = globalThis.process?.argv?.slice(2) ?? []): GoError {
  return CommandLine.Parse(args);
}

export function Usage(): void {
  // Go's package-level Usage is caller-replaceable. The port keeps the default a
  // no-op because callers in TS-Go only need the symbol to exist.
}
