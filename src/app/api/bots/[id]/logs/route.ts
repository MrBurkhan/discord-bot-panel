import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const logs = await prisma.logEntry.findMany({
      where: { botId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(logs);
  } catch (error) {
    return fail(error, 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.logEntry.deleteMany({ where: { botId: id } });
    return ok({ cleared: true });
  } catch (error) {
    return fail(error);
  }
}
