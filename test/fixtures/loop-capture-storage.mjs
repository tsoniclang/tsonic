export const loopCaptureStorageSource = `
  export function copiedIterations(): boolean {
    let previous: (() => number) | undefined;
    for (let index = 0; index < 3; index++) {
      const read = () => index;
      if (previous !== undefined && (previous() !== index - 1 || previous === read)) return false;
      previous = read;
    }
    return previous !== undefined && previous() === 2;
  }
  export function liveIterations(): boolean {
    let previous: (() => number) | undefined;
    outer: for (let index = 0; index < 6; index++) {
      const read = () => index;
      if (previous !== undefined && (previous() !== index - 1 || previous === read)) return false;
      previous = read;
      try { continue outer; }
      finally { index += 1; }
    }
    return previous !== undefined && previous() === 5;
  }
  export function initializerCapture(): boolean {
    let previous: (() => number) | undefined;
    for (let index = 0, initial = () => index; index < 3; index++) {
      if (initial() !== 0) return false;
      previous = () => index;
    }
    return previous !== undefined && previous() === 2;
  }
  export function liveConditionCapture(): boolean {
    let selected = () => -1;
    for (let index = 0; (selected = () => index)() < 4; index++) {
      const before = selected;
      index += 1;
      if (before() !== index) return false;
    }
    return selected() === 4;
  }
  export function sharedVarCapture(): boolean {
    let previous: (() => number) | undefined;
    for (var index = 0; index < 3; index++) {
      const read = () => index;
      if (previous !== undefined && (previous() !== index || previous === read)) return false;
      previous = read;
    }
    return previous !== undefined && previous() === 3;
  }
  export function incrementorCapture(): boolean {
    let previous: (() => number) | undefined;
    let selected = () => -1;
    for (let index = 0; index < 3; (selected = () => index, index++)) {
      const read = () => index;
      if (previous !== undefined && (previous() !== index - 1 || read === previous)) return false;
      if (index !== 0 && selected() !== index) return false;
      previous = read;
    }
    return previous !== undefined && previous() === 2 && selected() === 3;
  }
  export function destructuredIterations(): boolean {
    let previous: (() => number) | undefined;
    for (let { index } = { index: 0 }; index < 6; index++) {
      const read = () => index;
      if (previous !== undefined && (previous() !== index - 1 || previous === read)) return false;
      previous = read;
      index += 1;
    }
    if (previous === undefined || previous() !== 5) return false;
    previous = undefined;
    for (let [index] = [0]; index < 6; index++) {
      const read = () => index;
      if (previous !== undefined && (previous() !== index - 1 || previous === read)) return false;
      previous = read;
      index += 1;
    }
    return previous !== undefined && previous() === 5;
  }
  export function namedSelfIterations(): boolean {
    type Callback = (count: number) => number;
    let previous: Callback | undefined;
    for (let index = 0; index < 6; index++) {
      const current: Callback = function recurse(count: number): number {
        const same = recurse;
        const identity = (): boolean => same === recurse;
        if (!identity()) return -1;
        return count === 0 ? index : recurse(count - 1);
      };
      if (previous !== undefined && (previous(2) !== index - 1 || previous === current)) return false;
      previous = current;
      index += 1;
    }
    return previous !== undefined && previous(2) === 5;
  }
  export function headerEvaluation(): boolean {
    let calls = 0;
    const objectSeed = () => { calls += 1; return { index: 0 }; };
    for (let { index } = objectSeed(); index < 2; index++) {
      if (calls !== 1) return false;
    }
    for (let index = 0, read = () => { const nested = 7; return nested; }; index < 2; index++) {
      if (read() !== 7) return false;
    }
    let index = 0;
    for (index = 1; index < 3; index++) {}
    return calls === 1 && index === 3;
  }
  export function run(): boolean {
    return copiedIterations() && liveIterations() && initializerCapture() &&
      liveConditionCapture() && sharedVarCapture() && incrementorCapture() &&
      destructuredIterations() && namedSelfIterations() && headerEvaluation();
  }
  export function main(): void {
    if (!run()) throw new Error("lexical loop activation");
  }
`;
