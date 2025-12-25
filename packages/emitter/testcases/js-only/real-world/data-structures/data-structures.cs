namespace TestCases.jsonly.realworld.datastructures
{
    public class Stack<T>
    {
        private global::System.Collections.Generic.List<T> items = new global::System.Collections.Generic.List<T>();

        public void push(T item)
            {
            global::Tsonic.JSRuntime.Array.push(this.items, item);
            }

        public T? pop()
            {
            return global::Tsonic.JSRuntime.Array.pop(this.items);
            }

        public T? peek()
            {
            return global::Tsonic.JSRuntime.Array.get(this.items, global::Tsonic.JSRuntime.Array.length(this.items) - 1);
            }

        public bool isEmpty()
            {
            return global::Tsonic.JSRuntime.Array.length(this.items) == 0;
            }

        public double size()
            {
            return global::Tsonic.JSRuntime.Array.length(this.items);
            }

        public void clear()
            {
            this.items = new global::System.Collections.Generic.List<T>();
            }
    }
    public class Queue<T>
    {
        private global::System.Collections.Generic.List<T> items = new global::System.Collections.Generic.List<T>();

        public void enqueue(T item)
            {
            global::Tsonic.JSRuntime.Array.push(this.items, item);
            }

        public T? dequeue()
            {
            return global::Tsonic.JSRuntime.Array.shift(this.items);
            }

        public T? front()
            {
            return global::Tsonic.JSRuntime.Array.get(this.items, 0);
            }

        public bool isEmpty()
            {
            return global::Tsonic.JSRuntime.Array.length(this.items) == 0;
            }

        public double size()
            {
            return global::Tsonic.JSRuntime.Array.length(this.items);
            }

        public void clear()
            {
            this.items = new global::System.Collections.Generic.List<T>();
            }
    }
    public class LinkedListNode<T>
    {
        public T value;

        public LinkedListNode<T>? next;

        public LinkedListNode(T value, LinkedListNode<T>? next = null)
            {
            this.value = value;
            this.next = next;
            }
    }
    public class LinkedList<T>
    {
        private LinkedListNode<T>? head = null;

        private LinkedListNode<T>? tail = null;

        private double length = 0;

        public void append(T value)
            {
            var node = new LinkedListNode(value);
            if (this.head is null)
                {
                this.head = node;
                this.tail = node;
                }
            else
                {
                if (this.tail != null)
                    {
                    this.tail.Next = node;
                    }
                this.tail = node;
                }
            this.length++;
            }

        public void prepend(T value)
            {
            var node = new LinkedListNode(value, this.head);
            this.head = node;
            if (this.tail is null)
                {
                this.tail = node;
                }
            this.length++;
            }

        public double size()
            {
            return this.length;
            }

        public global::System.Collections.Generic.List<T> toArray()
            {
            global::System.Collections.Generic.List<T> result = new global::System.Collections.Generic.List<T>();
            var current = this.head;
            while (current is not null)
                {
                global::Tsonic.JSRuntime.Array.push(result, current.Value);
                current = current.Next;
                }
            return result;
            }
    }

            public static class datastructures
            {
                public static void testDataStructures()
                    {
                    var stack = new Stack<double>();
                    stack.Push(1);
                    stack.Push(2);
                    stack.Push(3);
                    global::Tsonic.JSRuntime.console.log("Stack size:", stack.size());
                    global::Tsonic.JSRuntime.console.log("Stack pop:", stack.Pop());
                    var queue = new Queue<string>();
                    queue.Enqueue("first");
                    queue.Enqueue("second");
                    queue.Enqueue("third");
                    global::Tsonic.JSRuntime.console.log("Queue size:", queue.size());
                    global::Tsonic.JSRuntime.console.log("Queue dequeue:", queue.Dequeue());
                    var list = new LinkedList<double>();
                    list.append(10);
                    list.append(20);
                    list.prepend(5);
                    global::Tsonic.JSRuntime.console.log("List as array:", list.toArray());
                    }
            }
}