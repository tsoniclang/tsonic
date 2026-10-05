export const observableCallableCreationSource = `
  export function createStateless(): () => number { return () => 7; }
  export function createFunction(): () => number { return function () { return 7; }; }
  export function capturedCreations(): boolean {
    let value = 0;
    let previous: (() => number) | undefined;
    for (let index = 0; index < 3; index++) {
      value = index + 1;
      const current = () => value;
      const alias = current;
      if (alias !== current || previous !== undefined &&
        (previous === alias || previous() !== value)) return false;
      previous = current;
    }
    return previous !== undefined && previous() === 3;
  }
  export function capturedFunctionCreations(): boolean {
    let value = 0;
    let previous: (() => number) | undefined;
    for (let index = 0; index < 3; index++) {
      value = index + 1;
      const current = function () { return value; };
      const alias = current;
      if (alias !== current || previous !== undefined &&
        (previous === alias || previous() !== value)) return false;
      previous = current;
    }
    return previous !== undefined && previous() === 3;
  }
  export function run(): boolean {
    const first = createStateless();
    const second = createStateless();
    const functionFirst = createFunction();
    const functionSecond = createFunction();
    return first !== second && functionFirst !== functionSecond &&
      first() === 7 && second() === 7 && functionFirst() === 7 && functionSecond() === 7 &&
      capturedCreations() && capturedFunctionCreations();
  }
  export function main(): void {
    if (!run()) throw new Error("observable native callable creation");
  }
`;
