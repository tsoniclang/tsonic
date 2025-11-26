using Tsonic.Runtime;
using Tsonic.JSRuntime;
using System.Collections.Generic;
using System.Linq;

namespace TestCases.realworld.businesslogic
{
    public class Product
    {
        public string id { get; set; }

        public string name { get; set; }

        public double price { get; set; }

        public double stock { get; set; }

        public string category { get; set; }
    }
    public class CartItem
    {
        public Product product { get; set; }

        public double quantity { get; set; }
    }
    public class Order
    {
        public string id { get; set; }

        public List<CartItem> items { get; set; }

        public double total { get; set; }

        public OrderStatus status { get; set; }

        public Date createdAt { get; set; }
    }
    public class ShoppingCart
    {
        private List<CartItem> items = new List<CartItem>();

        public bool addItem(Product product, double quantity)
            {
            if (quantity <= 0 || quantity > product.stock)
                {
                return false;
                }
            var existingItem = Tsonic.JSRuntime.Array.find(this.items, (item) => item.product.id == product.id);
            if (existingItem != null)
                {
                var newQuantity = existingItem.quantity + quantity;
                if (newQuantity > product.stock)
                    {
                    return false;
                    }
                existingItem.quantity = newQuantity;
                }
            else
                {
                Tsonic.JSRuntime.Array.push(this.items, new { product = product, quantity = quantity });
                }
            return true;
            }

        public bool removeItem(string productId)
            {
            var index = Tsonic.JSRuntime.Array.findIndex(this.items, (item) => item.product.id == productId);
            if (index != -1)
                {
                Tsonic.JSRuntime.Array.splice(this.items, index, 1);
                return true;
                }
            return false;
            }

        public bool updateQuantity(string productId, double quantity)
            {
            var item = Tsonic.JSRuntime.Array.find(this.items, (item) => item.product.id == productId);
            if (!item)
                {
                return false;
                }
            if (quantity <= 0)
                {
                return this.removeItem(productId);
                }
            if (quantity > item.product.stock)
                {
                return false;
                }
            item.quantity = quantity;
            return true;
            }

        public double getTotal()
            {
            return Tsonic.JSRuntime.Array.reduce(this.items, (sum, item) => sum + item.product.price * item.quantity, 0);
            }

        public double getItemCount()
            {
            return Tsonic.JSRuntime.Array.reduce(this.items, (sum, item) => sum + item.quantity, 0);
            }

        public List<CartItem> getItems()
            {
            return this.items.ToList();
            }

        public void clear()
            {
            this.items = new List<CartItem>();
            }
    }
    public class DiscountCalculator
    {
        public static double applyPercentageDiscount(double price, double percentage)
            {
            if (percentage < 0 || percentage > 100)
                {
                throw new Error("Invalid discount percentage");
                }
            return price * 1 - percentage / 100;
            }

        public static double applyFixedDiscount(double price, double discount)
            {
            var result = price - discount;
            return result < 0 ? 0 : result;
            }

        public static double calculateBulkDiscount(double quantity, double price)
            {
            if (quantity >= 100)
                {
                return this.applyPercentageDiscount(price, 20);
                }
            else
                if (quantity >= 50)
                    {
                    return this.applyPercentageDiscount(price, 15);
                    }
                else
                    if (quantity >= 10)
                        {
                        return this.applyPercentageDiscount(price, 10);
                        }
            return price;
            }
    }
    public class OrderProcessor
    {
        private double nextOrderId = 1;

        public Order createOrder(ShoppingCart cart)
            {
            var items = cart.getItems();
            if (Tsonic.Runtime.Array.length(items) == 0)
                {
                throw new Error("Cannot create order from empty cart");
                }
            Order order = new { id = $"ORD-{this.nextOrderId++}", items = items, total = cart.getTotal(), status = "pending", createdAt = new Date() };
            return order;
            }

        public void updateOrderStatus(Order order, OrderStatus newStatus)
            {
            Record<OrderStatus, List<OrderStatus>> validTransitions = new { pending = new List<string> { "processing", "cancelled" }, processing = new List<string> { "shipped", "cancelled" }, shipped = new List<string> { "delivered" }, delivered = new List<OrderStatus>(), cancelled = new List<OrderStatus>() };
            var allowed = validTransitions[order.status];
            if (!Tsonic.JSRuntime.Array.includes(allowed, newStatus))
                {
                throw new Error($"Cannot transition from {order.status} to {newStatus}");
                }
            order.status = newStatus;
            }

        public bool cancelOrder(Order order)
            {
            if (order.status == "delivered")
                {
                return false;
                }
            if (order.status == "cancelled")
                {
                return false;
                }
            order.status = "cancelled";
            return true;
            }
    }

            public static class businesslogic
            {
                // type OrderStatus = Union<string, string, string, string, string>

                public static List<Product> searchProducts(List<Product> products, string query)
                    {
                    var lowerQuery = Tsonic.JSRuntime.String.toLowerCase(query);
                    return Tsonic.JSRuntime.Array.filter(products, (p) => Tsonic.JSRuntime.String.includes(Tsonic.JSRuntime.String.toLowerCase(p.name), lowerQuery) ?? Tsonic.JSRuntime.String.includes(Tsonic.JSRuntime.String.toLowerCase(p.category), lowerQuery));
                    }

                public static List<Product> filterByCategory(List<Product> products, string category)
                    {
                    return Tsonic.JSRuntime.Array.filter(products, (p) => p.category == category);
                    }

                public static List<Product> filterByPriceRange(List<Product> products, double minPrice, double maxPrice)
                    {
                    return Tsonic.JSRuntime.Array.filter(products, (p) => p.price >= minPrice && p.price <= maxPrice);
                    }

                public static List<Product> sortByPrice(List<Product> products, bool ascending = true)
                    {
                    var sorted = products.ToList();
                    Tsonic.JSRuntime.Array.sort(sorted, (a, b) =>
                    {
                    return ascending ? a.price - b.price : b.price - a.price;
                    });
                    return sorted;
                    }
            }
}