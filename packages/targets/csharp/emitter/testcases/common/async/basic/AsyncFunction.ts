export async function fetchData(): Promise<string> {
  return await getData();
}

declare function getData(): Promise<string>;
