import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis, idempotencyKey, IDEMPOTENCY_TTL } from "@/lib/redis";

type ReservationRow = {
  id: string;
  status: string;
  expiresAt: Date;
  stockId: string;
  quantity: number;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const idempotencyHeader = request.headers.get("Idempotency-Key");
    if (idempotencyHeader) {
      const iKey = idempotencyKey(`confirm:${idempotencyHeader}`);
      const cached = await redis.get<{ statusCode: number; body: unknown }>(iKey);
      if (cached) {
        return NextResponse.json(cached.body, { status: cached.statusCode });
      }
    }

    const result = await prisma.$transaction(async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      const rows = await tx.$queryRaw`
        SELECT id, status, "expiresAt", "stockId", quantity
        FROM reservations
        WHERE id = ${id}
        FOR UPDATE
      ` as ReservationRow[];

      if (!rows.length) {
        return { error: "Reservation not found", statusCode: 404 };
      }

      const res = rows[0];

      if (res.status !== "PENDING") {
        return {
          error: `Reservation is already ${res.status.toLowerCase()}`,
          statusCode: 409,
        };
      }

      if (new Date(res.expiresAt) <= new Date()) {
        await tx.stock.update({
          where: { id: res.stockId },
          data: { reserved: { decrement: res.quantity } },
        });
        await tx.reservation.update({
          where: { id },
          data: { status: "RELEASED", releasedAt: new Date() },
        });
        return { error: "Reservation has expired", statusCode: 410 };
      }

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED", confirmedAt: new Date() },
        include: {
          stock: {
            include: { product: true, warehouse: true },
          },
        },
      });

      await tx.stock.update({
        where: { id: res.stockId },
        data: {
          total: { decrement: res.quantity },
          reserved: { decrement: res.quantity },
        },
      });

      return {
        data: {
          id: updated.id,
          status: updated.status,
          quantity: updated.quantity,
          confirmedAt: updated.confirmedAt,
          product: {
            id: updated.stock.product.id,
            name: updated.stock.product.name,
            sku: updated.stock.product.sku,
          },
          warehouse: {
            id: updated.stock.warehouse.id,
            name: updated.stock.warehouse.name,
          },
        },
        statusCode: 200,
      };
    });

    if ("error" in result) {
      if (idempotencyHeader) {
        await redis.set(
          idempotencyKey(`confirm:${idempotencyHeader}`),
          { statusCode: result.statusCode, body: { error: result.error } },
          { ex: IDEMPOTENCY_TTL }
        );
      }
      return NextResponse.json({ error: result.error }, { status: result.statusCode });
    }

    if (idempotencyHeader) {
      await redis.set(
        idempotencyKey(`confirm:${idempotencyHeader}`),
        { statusCode: 200, body: result.data },
        { ex: IDEMPOTENCY_TTL }
      );
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error(`POST /api/reservations/${id}/confirm error:`, error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}