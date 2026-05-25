import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, stockLockKey, idempotencyKey, RESERVATION_LOCK_TTL, IDEMPOTENCY_TTL } from "@/lib/redis";
import { CreateReservationSchema, RESERVATION_EXPIRY_MINUTES } from "@/lib/schemas";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input
    const parsed = CreateReservationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // --- Idempotency check ---
    const idempotencyHeader = request.headers.get("Idempotency-Key");
    if (idempotencyHeader) {
      const iKey = idempotencyKey(idempotencyHeader);
      const cached = await redis.get<{ statusCode: number; body: unknown }>(iKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.statusCode });
      }
    }

    // Find the stock record for this product + warehouse
    const stock = await prisma.stock.findUnique({
      where: { productId_warehouseId: { productId, warehouseId } },
    });

    if (!stock) {
      return NextResponse.json(
        { error: "Product not found in this warehouse" },
        { status: 404 }
      );
    }

    // --- Distributed lock to prevent race conditions ---
    const lockKey = stockLockKey(stock.id);
    // SET NX EX — acquire lock atomically
    const lockAcquired = await redis.set(lockKey, "1", {
      nx: true,
      ex: RESERVATION_LOCK_TTL,
    });

    if (!lockAcquired) {
      // Another request is currently reserving this stock; ask client to retry
      return NextResponse.json(
        { error: "Stock is being updated, please retry" },
        { status: 429 }
      );
    }

    try {
      // --- Atomic check-and-reserve using a Postgres transaction ---
      const reservation = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
        // Re-read stock inside transaction with a row-level lock
        const freshStock = await tx.$queryRaw<
          Array<{ id: string; total: number; reserved: number }>
        >`
          SELECT id, total, reserved
          FROM stocks
          WHERE id = ${stock.id}
          FOR UPDATE
        `;

        if (!freshStock.length) throw new Error("Stock not found");

        const { total, reserved } = freshStock[0];
        const available = total - reserved;

        if (available < quantity) {
          const err = new Error("Insufficient stock");
          (err as Error & { code: string }).code = "INSUFFICIENT_STOCK";
          throw err;
        }

        // Increment reserved count
        await tx.stock.update({
          where: { id: stock.id },
          data: { reserved: { increment: quantity } },
        });

        // Create the reservation
        const expiresAt = new Date(
          Date.now() + RESERVATION_EXPIRY_MINUTES * 60 * 1000
        );

        return tx.reservation.create({
          data: {
            stockId: stock.id,
            quantity,
            status: "PENDING",
            expiresAt,
          },
          include: {
            stock: {
              include: {
                product: true,
                warehouse: true,
              },
            },
          },
        });
      });

      const responseBody = {
        id: reservation.id,
        status: reservation.status,
        quantity: reservation.quantity,
        expiresAt: reservation.expiresAt,
        product: {
          id: reservation.stock.product.id,
          name: reservation.stock.product.name,
          sku: reservation.stock.product.sku,
          price: reservation.stock.product.price.toString(),
        },
        warehouse: {
          id: reservation.stock.warehouse.id,
          name: reservation.stock.warehouse.name,
          location: reservation.stock.warehouse.location,
        },
      };

      // Cache idempotency result
      if (idempotencyHeader) {
        await redis.set(
          idempotencyKey(idempotencyHeader),
          { statusCode: 201, body: responseBody },
          { ex: IDEMPOTENCY_TTL }
        );
      }

      return NextResponse.json(responseBody, { status: 201 });
    } catch (err) {
      const error = err as Error & { code?: string };
      if (error.code === "INSUFFICIENT_STOCK") {
        const responseBody = { error: "Not enough stock available" };

        if (idempotencyHeader) {
          await redis.set(
            idempotencyKey(idempotencyHeader),
            { statusCode: 409, body: responseBody },
            { ex: IDEMPOTENCY_TTL }
          );
        }

        return NextResponse.json(responseBody, { status: 409 });
      }
      throw err;
    } finally {
      // Always release the lock
      await redis.del(lockKey);
    }
  } catch (error) {
    console.error("POST /api/reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Reservation ID required" }, { status: 400 });
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        stock: {
          include: { product: true, warehouse: true },
        },
      },
    });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: reservation.id,
      status: reservation.status,
      quantity: reservation.quantity,
      expiresAt: reservation.expiresAt,
      confirmedAt: reservation.confirmedAt,
      releasedAt: reservation.releasedAt,
      product: {
        id: reservation.stock.product.id,
        name: reservation.stock.product.name,
        sku: reservation.stock.product.sku,
        price: reservation.stock.product.price.toString(),
        imageUrl: reservation.stock.product.imageUrl,
      },
      warehouse: {
        id: reservation.stock.warehouse.id,
        name: reservation.stock.warehouse.name,
        location: reservation.stock.warehouse.location,
      },
    });
  } catch (error) {
    console.error("GET /api/reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
