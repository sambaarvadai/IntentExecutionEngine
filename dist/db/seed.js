"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedData = seedData;
const customers = [
    { name: 'Ravi', city: 'Chennai' },
    { name: 'Anu', city: 'Bangalore' },
    { name: 'Karthik', city: 'Chennai' },
    { name: 'Priya', city: 'Mumbai' },
    { name: 'Amit', city: 'Delhi' },
    { name: 'Sneha', city: 'Bangalore' },
    { name: 'Vijay', city: 'Chennai' },
    { name: 'Neha', city: 'Mumbai' },
    { name: 'Rahul', city: 'Delhi' },
    { name: 'Divya', city: 'Bangalore' }
];
const orders = [
    // Ravi's orders
    { customer_id: 1, item: 'Laptop', amount: 45000, created_at: '2024-01-15T10:30:00Z' },
    { customer_id: 1, item: 'Mouse', amount: 800, created_at: '2024-01-16T14:20:00Z' },
    { customer_id: 1, item: 'Keyboard', amount: 2500, created_at: '2024-02-01T09:15:00Z' },
    { customer_id: 1, item: 'Monitor', amount: 12000, created_at: '2024-02-10T16:45:00Z' },
    // Anu's orders
    { customer_id: 2, item: 'Phone', amount: 35000, created_at: '2024-01-20T11:00:00Z' },
    { customer_id: 2, item: 'Headphones', amount: 2000, created_at: '2024-01-25T13:30:00Z' },
    { customer_id: 2, item: 'Charger', amount: 500, created_at: '2024-02-05T10:00:00Z' },
    // Karthik's orders
    { customer_id: 3, item: 'Tablet', amount: 28000, created_at: '2024-01-18T15:20:00Z' },
    { customer_id: 3, item: 'Case', amount: 800, created_at: '2024-01-19T09:30:00Z' },
    { customer_id: 3, item: 'Stylus', amount: 1500, created_at: '2024-02-08T14:15:00Z' },
    { customer_id: 3, item: 'Screen Protector', amount: 300, created_at: '2024-02-12T11:45:00Z' },
    // Priya's orders
    { customer_id: 4, item: 'Camera', amount: 55000, created_at: '2024-01-22T10:45:00Z' },
    { customer_id: 4, item: 'Lens', amount: 18000, created_at: '2024-01-28T16:30:00Z' },
    { customer_id: 4, item: 'Tripod', amount: 3500, created_at: '2024-02-03T13:20:00Z' },
    // Amit's orders
    { customer_id: 5, item: 'Smartwatch', amount: 12000, created_at: '2024-01-25T12:00:00Z' },
    { customer_id: 5, item: 'Band', amount: 1500, created_at: '2024-01-26T09:15:00Z' },
    // Sneha's orders
    { customer_id: 6, item: 'Speakers', amount: 8000, created_at: '2024-01-30T14:30:00Z' },
    { customer_id: 6, item: 'Cables', amount: 400, created_at: '2024-02-02T10:45:00Z' },
    { customer_id: 6, item: 'Amplifier', amount: 15000, created_at: '2024-02-11T15:20:00Z' },
    // Vijay's orders
    { customer_id: 7, item: 'Gaming Console', amount: 35000, created_at: '2024-02-04T11:30:00Z' },
    { customer_id: 7, item: 'Controller', amount: 4000, created_at: '2024-02-06T16:00:00Z' },
    { customer_id: 7, item: 'Games', amount: 3000, created_at: '2024-02-09T13:45:00Z' },
    // Neha's orders
    { customer_id: 8, item: 'E-reader', amount: 8000, created_at: '2024-02-07T10:15:00Z' },
    { customer_id: 8, item: 'Cover', amount: 600, created_at: '2024-02-08T14:30:00Z' },
    // Rahul's orders
    { customer_id: 9, item: 'Drone', amount: 45000, created_at: '2024-02-10T12:20:00Z' },
    { customer_id: 9, item: 'Batteries', amount: 2000, created_at: '2024-02-13T09:40:00Z' },
    // Divya's orders
    { customer_id: 10, item: 'Fitness Tracker', amount: 3000, created_at: '2024-02-14T15:10:00Z' },
    { customer_id: 10, item: 'Strap', amount: 400, created_at: '2024-02-15T11:25:00Z' }
];
async function seedData(db) {
    // Insert customers
    for (const customer of customers) {
        await db.run('INSERT INTO customers (name, city) VALUES (?, ?)', customer.name, customer.city);
    }
    // Insert orders
    for (const order of orders) {
        await db.run('INSERT INTO orders (customer_id, item, amount, created_at) VALUES (?, ?, ?, ?)', order.customer_id, order.item, order.amount, order.created_at);
    }
    console.log(`Seeded ${customers.length} customers and ${orders.length} orders`);
}
//# sourceMappingURL=seed.js.map