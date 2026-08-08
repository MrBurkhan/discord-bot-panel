import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const entries = await prisma.storageEntry.findMany({
      where: { botId: id },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return ok(entries);
  } catch (error) {
    return fail(error, 500);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const entryId = new URL(request.url).searchParams.get("entryId");
    if (entryId) await prisma.storageEntry.delete({ where: { id: entryId } });
    else await prisma.storageEntry.deleteMany({ where: { botId: id } });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
