const ops = {
  add({ x }: { x: number }, y: number): number {
    return (arguments[0] as number) + y;
  },
};

void ops;
