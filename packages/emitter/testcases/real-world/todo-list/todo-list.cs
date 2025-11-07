
using Tsonic.Runtime;

namespace TestCases.realworld
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
        private Tsonic.Runtime.Array<Todo> todos = new Tsonic.Runtime.Array<object>();

        private double nextId = 1.0;

        public Todo addTodo(string title)
            {
            Todo todo = new { id = this.nextId++, title = title, completed = false, createdAt = new Date() };
            this.todos.push(todo);
            return todo;
            }

        public bool completeTodo(double id)
            {
            var todo = this.todos.find((t) => t.id == id);
            if (todo)
                {
                todo.completed = true;
                return true;
                }
            return false;
            }

        public Tsonic.Runtime.Array<Todo> getActiveTodos()
            {
            return this.todos.filter((t) => !t.completed);
            }

        public Tsonic.Runtime.Array<Todo> getCompletedTodos()
            {
            return this.todos.filter((t) => t.completed);
            }

        public Tsonic.Runtime.Array<Todo> getAllTodos()
            {
            return this.todos;
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