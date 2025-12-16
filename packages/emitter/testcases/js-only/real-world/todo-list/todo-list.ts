export interface Todo {
  id: number;
  title: string;
  completed: boolean;
  createdAt: string; // ISO timestamp - Date is not in globals
}

export class TodoList {
  private todos: Todo[] = [];
  private nextId: number = 1;

  addTodo(title: string): Todo {
    const todo: Todo = {
      id: this.nextId++,
      title: title,
      completed: false,
      createdAt: "2024-01-01T00:00:00.000Z", // ISO timestamp placeholder
    };
    this.todos.push(todo);
    return todo;
  }

  completeTodo(id: number): boolean {
    const todo = this.todos.find((t: Todo): boolean => t.id === id);
    if (todo) {
      todo.completed = true;
      return true;
    }
    return false;
  }

  getActiveTodos(): Todo[] {
    return this.todos.filter((t: Todo): boolean => !t.completed);
  }

  getCompletedTodos(): Todo[] {
    return this.todos.filter((t: Todo): boolean => t.completed);
  }

  getAllTodos(): Todo[] {
    return [...this.todos];
  }
}

export function createSampleTodoList(): TodoList {
  const list = new TodoList();
  list.addTodo("Buy groceries");
  list.addTodo("Write code");
  list.addTodo("Exercise");
  list.completeTodo(1);
  return list;
}
