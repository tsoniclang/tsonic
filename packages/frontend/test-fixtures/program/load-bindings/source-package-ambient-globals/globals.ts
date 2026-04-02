declare global {
  const Date: typeof import("./src/date-object.js").Date;
  function parseInt(value: string, radix?: number): number;
}

export {};
