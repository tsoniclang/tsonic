namespace TestCases.common.classes.genericinheritance
{
    public class Entity<TId>
    {
        public TId id;

        public Entity(TId id)
            {
            this.id = id;
            }
    }
    public class NamedEntity<TId> : Entity<TId>
    {
        public string name;

        public NamedEntity(TId id, string name) : base(id)
            {
            this.name = name;
            }
    }
    public class User : NamedEntity<int>
    {
        public string email;

        public User(int id, string name, string email) : base(id, name)
            {
            this.email = email;
            }
    }
}