// Define struct marker inline for testing
interface struct {
  readonly __brand: "struct";
}

export interface Point extends struct {
  x: number;
  y: number;
}
