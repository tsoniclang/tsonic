import { T } from "../testing.js";
export function Test(fn) {
    fn(new T());
}
export function Wait() {
    // The TSTS runtime is single-threaded; queued synchronous work has completed.
}
//# sourceMappingURL=synctest.js.map