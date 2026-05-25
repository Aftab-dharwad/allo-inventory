import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
  });

  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi North", location: "New Delhi, Delhi" },
  });

  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore Tech Park", location: "Bangalore, Karnataka" },
  });

  console.log("✅ Warehouses created");

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Wireless Noise-Cancelling Headphones",
        description: "Premium over-ear headphones with 40hr battery life and active noise cancellation.",
        sku: "WNC-HP-001",
        price: 12999,
        imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Mechanical Keyboard – TKL",
        description: "Tenkeyless mechanical keyboard with Cherry MX Red switches, RGB backlight.",
        sku: "MKB-TKL-002",
        price: 7499,
        imageUrl: "https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "4K Portable Monitor",
        description: "15.6 inch USB-C portable display with HDR support, 60Hz refresh rate.",
        sku: "MON-4K-003",
        price: 19999,
        imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Smart Fitness Tracker",
        description: "24/7 heart rate, SpO2, sleep tracking. 14-day battery. IP68 waterproof.",
        sku: "FIT-TRK-004",
        price: 4999,
        imageUrl: "https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=400",
      },
    }),
    prisma.product.create({
      data: {
        name: "Ergonomic Office Chair",
        description: "Lumbar support, adjustable armrests, mesh back. Ideal for long work sessions.",
        sku: "CHR-ERG-005",
        price: 24999,
        imageUrl: "https://images.unsplash.com/photo-1592078615290-033ee584e267?w=400",
      },
    }),
  ]);

  console.log("✅ Products created");

  // Create stock entries (some with intentionally low stock to demo race conditions)
  await Promise.all([
    // Headphones
    prisma.stock.create({ data: { productId: products[0].id, warehouseId: mumbai.id, total: 15, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[0].id, warehouseId: delhi.id, total: 8, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[0].id, warehouseId: bangalore.id, total: 3, reserved: 0 } }),

    // Keyboard
    prisma.stock.create({ data: { productId: products[1].id, warehouseId: mumbai.id, total: 20, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[1].id, warehouseId: bangalore.id, total: 1, reserved: 0 } }), // Low stock!

    // Monitor
    prisma.stock.create({ data: { productId: products[2].id, warehouseId: delhi.id, total: 5, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[2].id, warehouseId: bangalore.id, total: 2, reserved: 0 } }),

    // Fitness Tracker
    prisma.stock.create({ data: { productId: products[3].id, warehouseId: mumbai.id, total: 30, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[3].id, warehouseId: delhi.id, total: 12, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[3].id, warehouseId: bangalore.id, total: 1, reserved: 0 } }), // Low stock!

    // Chair
    prisma.stock.create({ data: { productId: products[4].id, warehouseId: mumbai.id, total: 4, reserved: 0 } }),
    prisma.stock.create({ data: { productId: products[4].id, warehouseId: delhi.id, total: 2, reserved: 0 } }),
  ]);

  console.log("✅ Stock levels created");
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
