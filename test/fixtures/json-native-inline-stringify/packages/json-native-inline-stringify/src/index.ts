type Payload = {
  ok: boolean;
  value: number;
};

export function main(): void {
  const payload: Payload = { ok: true, value: 3 };
  const text = JSON.stringify(payload);
  console.log(text);
}
