type Todo = { id: number; title: string };

export function main(id: number): number {
  const todos = new Array<Todo>();
  const todo = todos.find((t) => t.id === id);
  const index = todos.findIndex((t) => t.id === id);
  void todo;
  return index;
}
