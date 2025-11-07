
using Tsonic.Runtime;

namespace TestCases.realworld
{
    public class Stack<T>
    {
        private Tsonic.Runtime.Array<T> items = new Tsonic.Runtime.Array<object>();

        public void push(T item)
            {
            this.items.push(item);
            }

        public T? pop()
            {
            return this.items.pop();
            }

        public T? peek()
            {
            return this.items[this.items.length - 1];
            }

        public bool isEmpty()
            {
            return this.items.length == 0.0;
            }

        public double size()
            {
            return this.items.length;
            }

        public void clear()
            {
            this.items = new Tsonic.Runtime.Array<object>();
            }
    }
    public class Queue<T>
    {
        private Tsonic.Runtime.Array<T> items = new Tsonic.Runtime.Array<object>();

        public void enqueue(T item)
            {
            this.items.push(item);
            }

        public T? dequeue()
            {
            return this.items.shift();
            }

        public T? front()
            {
            return this.items[0];
            }

        public bool isEmpty()
            {
            return this.items.length == 0.0;
            }

        public double size()
            {
            return this.items.length;
            }

        public void clear()
            {
            this.items = new Tsonic.Runtime.Array<object>();
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

        private double length = 0.0;

        public void append(T value)
            {
            var node = new LinkedListNode(value);
            if (this.head == null)
                {
                this.head = node;
                this.tail = node;
                }
            else
                {
                if (this.tail)
                    {
                    this.tail.next = node;
                    }
                this.tail = node;
                }
            this.length++;
            }

        public void prepend(T value)
            {
            var node = new LinkedListNode(value, this.head);
            this.head = node;
            if (this.tail == null)
                {
                this.tail = node;
                }
            this.length++;
            }

        public double size()
            {
            return this.length;
            }

        public Tsonic.Runtime.Array<T> toArray()
            {
            Tsonic.Runtime.Array<T> result = new Tsonic.Runtime.Array<T>();
            var current = this.head;
            while (current != null)
                {
                result.push(current.value);
                current = current.next;
                }
            return result;
            }
    }

    public static class datastructures
    {
        public static void testDataStructures()
            {
            var stack = new Stack<double>();
            stack.push(1.0);
            stack.push(2.0);
            stack.push(3.0);
            Tsonic.Runtime.console.log("Stack size:", stack.size());
            Tsonic.Runtime.console.log("Stack pop:", stack.pop());
            var queue = new Queue<string>();
            queue.enqueue("first");
            queue.enqueue("second");
            queue.enqueue("third");
            Tsonic.Runtime.console.log("Queue size:", queue.size());
            Tsonic.Runtime.console.log("Queue dequeue:", queue.dequeue());
            var list = new LinkedList<double>();
            list.append(10.0);
            list.append(20.0);
            list.prepend(5.0);
            Tsonic.Runtime.console.log("List as array:", list.toArray());
            }
    }
}