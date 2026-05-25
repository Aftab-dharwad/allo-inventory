import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: product.price.toString(),
      imageUrl: product.imageUrl,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stocks: product.stocks.map((stock: any) => ({
        id: stock.id,
        warehouseId: stock.warehouseId,
        warehouseName: stock.warehouse.name,
        warehouseLocation: stock.warehouse.location,
        total: stock.total,
        reserved: stock.reserved,
        available: stock.total - stock.reserved,
      })),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
