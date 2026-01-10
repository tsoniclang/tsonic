namespace TestCases.common.types.genericinterfaceinheritance
{
    public class Identifiable<T>
    {
        public T Id;

        public Identifiable(T id)
            {
            this.Id = id;
            }
    }
    public class Named<T> : Identifiable<T>
    {
        public string Name;

        public Named(T id, string name) : base(id)
            {
            this.Name = name;
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