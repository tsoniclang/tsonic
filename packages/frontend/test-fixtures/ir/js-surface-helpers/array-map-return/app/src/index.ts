declare const entries: string[];

export const values = entries
  .map((entry) => entry)
  .filter((value) => value.length > 0);
