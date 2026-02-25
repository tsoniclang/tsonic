// Generated from: Inheritance.ts
// Generated at: 2026-02-25T02:59:58.693Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.inheritance
{
    public class Animal
    {
        public string name { get; set; }

        public Animal(string name)
        {
            this.name = name;
        }

        public string makeSound()
        {
            return "Some sound";
        }
    }

    public class Dog : Animal
    {
        public string breed { get; set; }

        public Dog(string name, string breed) : base(name)
        {
            this.breed = breed;
        }

        public override string makeSound()
        {
            return "Woof!";
        }
    }
}