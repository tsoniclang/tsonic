type Metadata = {
  title: string;
  count: number;
};

export function main(): void {
  const root = JSON.parse<Metadata>('{"title":"hello","count":2}');
  console.log(root.title.toUpperCase(), root.count.toString());
}
