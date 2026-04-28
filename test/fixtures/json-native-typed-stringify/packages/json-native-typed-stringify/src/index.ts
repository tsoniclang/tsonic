type Payload = {
  ok: boolean;
  nested: {
    answer: number;
  };
  list: string[];
};

function writeJson(value: Payload): void {
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
