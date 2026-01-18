// Generated from: InheritanceChain.ts
// Generated at: 2026-01-17T15:36:47.328Z
// WARNING: Do not modify this file manually

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