import { Sprint } from "./fmt.js";
export function AllocsPerRun(runs, fn) {
    for (let index = 0; index < runs; index++) {
        fn();
    }
    return 0;
}
class testFailure extends globalThis.Error {
}
class testingBase {
    failed = false;
    Helper() { }
    Error(...args) {
        this.failed = true;
        console.error(args.map((arg) => Sprint(arg)).join(" "));
    }
    Errorf(format, ...args) {
        this.Error(format, ...args);
    }
    Fatal(...args) {
        this.Error(...args);
        throw new testFailure(args.map((arg) => Sprint(arg)).join(" "));
    }
    Fatalf(format, ...args) {
        this.Error(format, ...args);
        throw new testFailure(format);
    }
    Failed() {
        return this.failed;
    }
    Fail() {
        this.failed = true;
    }
    FailNow() {
        this.Fail();
        throw new testFailure("test failed");
    }
}
export class B extends testingBase {
}
export class M extends testingBase {
}
export class T extends testingBase {
    Run(name, fn) {
        const child = new T();
        try {
            fn(child);
            return !child.Failed();
        }
        catch {
            return false;
        }
    }
}
export class PB extends testingBase {
}
export function Testing() {
    return false;
}
//# sourceMappingURL=testing.js.map