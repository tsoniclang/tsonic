// Generated from: InheritanceChain.ts
// Generated at: 2026-02-25T02:59:54.655Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.genericinheritance
{
    public class Entity<TId>
    {
        public TId id { get; set; }

        public Entity(TId id)
        {
            this.id = id;
        }
    }

    public class NamedEntity<TId> : Entity<TId>
    {
        public string name { get; set; }

        public NamedEntity(TId id, string name) : base(id)
        {
            this.name = name;
        }
    }

    public class User : NamedEntity<int>
    {
        public string email { get; set; }

        public User(int id, string name, string email) : base(id, name)
        {
            this.email = email;
        }
    }
}