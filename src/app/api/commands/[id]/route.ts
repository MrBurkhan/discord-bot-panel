import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { commandData, commandInputSchema, serializeCommand } from "@/server/bots";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    return ok(serializeCommand(await prisma.command.findUniqueOrThrow({ where: { id } })));
  } catch (error) {
    return fail(error, 404);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = commandInputSchema.parse(await request.json());
    const command = await prisma.command.update({ where: { id }, data: commandData(input) });
    return ok(serializeCommand(command));
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    await prisma.command.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error);
  }
}
