using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;

namespace TestCases.realworld.datastructures
{
    public class Stack<T>
    {
        private List<T> items = new List<T>();

        public void push(T item)
            {
            Tsonic.JSRuntime.Array.push(this.items, item);
            }

        public T? pop()
            {
            return Tsonic.JSRuntime.Array.pop(this.items);
            }

        public T? peek()
            {
            return Tsonic.Runtime.Array.get(this.items, Tsonic.Runtime.Array.length(this.items) - 1);
            }

        public bool isEmpty()
            {
            return Tsonic.Runtime.Array.length(this.items) == 0;
            }

        public double size()
            {
            return Tsonic.Runtime.Array.length(this.items);
            }

        public void clear()
            {
            this.items = new List<T>();
            }
    }
    public class Queue<T>
    {
        private List<T> items = new List<T>();

        public void enqueue(T item)
            {
            Tsonic.JSRuntime.Array.push(this.items, item);
            }

        public T? dequeue()
            {
            return Tsonic.JSRuntime.Array.shift(this.items);
            }

        public T? front()
            {
            return Tsonic.Runtime.Array.get(this.items, 0);
            }

        public bool isEmpty()
            {
            return Tsonic.Runtime.Array.length(this.items) == 0;
            }

        public double size()
            {
            return Tsonic.Runtime.Array.length(this.items);
            }

        public void clear()
            {
            this.items = new List<T>();
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
            if (this.head == null)
                {
                this.head = node;
                this.tail = node;
                }
            else
                {
                if (this.tail != null)
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

        public List<T> toArray()
            {
            List<T> result = new List<T>();
            var current = this.head;
            while (current != null)
                {
                Tsonic.JSRuntime.Array.push(result, current.value);
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
                    stack.push(1);
                    stack.push(2);
                    stack.push(3);
                    Tsonic.JSRuntime.console.log("Stack size:", stack.size());
                    Tsonic.JSRuntime.console.log("Stack pop:", stack.pop());
                    var queue = new Queue<string>();
                    queue.enqueue("first");
                    queue.enqueue("second");
                    queue.enqueue("third");
                    Tsonic.JSRuntime.console.log("Queue size:", queue.size());
                    Tsonic.JSRuntime.console.log("Queue dequeue:", queue.dequeue());
                    var list = new LinkedList<double>();
                    list.append(10);
                    list.append(20);
                    list.prepend(5);
                    Tsonic.JSRuntime.console.log("List as array:", list.toArray());
                    }
            }
}