namespace TestCases.common.classes.genericinheritance
{
    public class Entity<TId>
    {
        public TId Id;

        public Entity(TId id)
            {
            this.Id = id;
            }
    }
    public class NamedEntity<TId> : Entity<TId>
    {
        public string Name;

        public NamedEntity(TId id, string name) : base(id)
            {
            this.Name = name;
            }
    }
    public class User : NamedEntity<int>
    {
        public string Email;

        public User(int id, string name, string email) : base(id, name)
            {
            this.Email = email;
            }
    }
}