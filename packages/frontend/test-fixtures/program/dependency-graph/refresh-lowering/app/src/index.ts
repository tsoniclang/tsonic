const buildListenerAttempts = (): {
  prefixes: string[];
  address: string;
  family: string;
}[] => {
  return [
    {
      prefixes: ["http://127.0.0.1:8080/"],
      address: "127.0.0.1",
      family: "IPv4",
    },
  ];
};

export function readAddress(): string {
  const attempts = buildListenerAttempts();
  for (const attempt of attempts) {
    return attempt.address;
  }
  return "";
}
