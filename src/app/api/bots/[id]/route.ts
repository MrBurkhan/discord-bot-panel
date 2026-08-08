import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { botInputSchema, botUpdateData, serializeBot } from "@/server/bots";
import { stopBot } from "@/server/runtime";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const bot = await prisma.bot.findUniqueOrThrow({
      where: { id },
      include: { _count: { select: { commands: true } } },
    });
    return ok(serializeBot(bot));
  } catch (error) {
    return fail(error, 404);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = botInputSchema.parse(await request.json());
    const bot = await prisma.bot.update({ where: { id }, data: botUpdateData(input) });
    return ok(serializeBot(bot));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await stopBot(id);
    await prisma.bot.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
