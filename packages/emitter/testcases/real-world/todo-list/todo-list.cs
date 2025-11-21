
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
        private List<Todo> todos = new List<object>();

        private double nextId = 1.0;

        public Todo addTodo(string title)
            {
            Todo todo = new { id = this.nextId++, title = title, completed = false, createdAt = new Date() };
            Tsonic.Runtime.Array.push(this.todos, todo);
            return todo;
            }

        public bool completeTodo(double id)
            {
            var todo = Tsonic.Runtime.Array.find(this.todos, (t) => t.id == id);
            if (todo)
                {
                todo.completed = true;
                return true;
                }
            return false;
            }

        public List<Todo> getActiveTodos()
            {
            return Tsonic.Runtime.Array.filter(this.todos, (t) => !t.completed);
            }

        public List<Todo> getCompletedTodos()
            {
            return Tsonic.Runtime.Array.filter(this.todos, (t) => t.completed);
            }

        public List<Todo> getAllTodos()
            {
            return this.todos.ToList();
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