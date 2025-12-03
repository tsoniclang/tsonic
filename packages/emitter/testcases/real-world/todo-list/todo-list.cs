namespace TestCases.realworld.todolist
{
    public class Todo
    {
        public double id { get; set; }

        public string title { get; set; }

        public bool completed { get; set; }

        public Date createdAt { get; set; }
    }
    public class TodoList
    {
        private global::System.Collections.Generic.List<Todo> todos = new global::System.Collections.Generic.List<Todo>();

        private double nextId = 1.0;

        public Todo addTodo(string title)
            {
            Todo todo = new Todo { id = this.nextId++, title = title, completed = false, createdAt = new Date() };
            global::Tsonic.JSRuntime.Array.push(this.todos, todo);
            return todo;
            }

        public bool completeTodo(double id)
            {
            var todo = global::Tsonic.JSRuntime.Array.find(this.todos, (Todo t) => t.id == id);
            if (todo != null)
                {
                todo.completed = true;
                return true;
                }
            return false;
            }

        public global::System.Collections.Generic.List<Todo> getActiveTodos()
            {
            return global::Tsonic.JSRuntime.Array.filter(this.todos, (Todo t) => !t.completed);
            }

        public global::System.Collections.Generic.List<Todo> getCompletedTodos()
            {
            return global::Tsonic.JSRuntime.Array.filter(this.todos, (Todo t) => t.completed);
            }

        public global::System.Collections.Generic.List<Todo> getAllTodos()
            {
            return global::System.Linq.Enumerable.ToList(this.todos);
            }
    }

            public static class todolist
            {
                public static TodoList createSampleTodoList()
                    {
                    var list = new TodoList();
                    list.addTodo("Buy groceries");
                    list.addTodo("Write code");
                    list.addTodo("Exercise");
                    list.completeTodo(1.0);
                    return list;
                    }
            }
}