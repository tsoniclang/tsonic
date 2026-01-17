// Generated from: InterfaceInheritance.ts
// Generated at: 2026-01-17T15:37:36.318Z
// WARNING: Do not modify this file manually

namespace TestCases.common.types.genericinterfaceinheritance
{
    public class Identifiable<T>
    {
        public T id;

        public Identifiable(T id)
            {
            this.id = id;
            }
    }
    public class Named<T> : Identifiable<T>
    {
        public string name;

        public Named(T id, string name) : base(id)
            {
            this.name = name;
            }
    }
    public class Person : Named<int>
    {
        public Person(int id, string name) : base(id, name)
            {

            }
    }
    public class Item<T> : Named<T>
    {
        public Item(T id, string name) : base(id, name)
            {

            }
    }
}