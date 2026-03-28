function writeJson(value: unknown): void {
  console.log(JSON.stringify(value));
}

export function main(): void {
  writeJson({
    ok: true,
    nested: {
      answer: 42,
    },
    list: ["x", "y"],
  });
}
