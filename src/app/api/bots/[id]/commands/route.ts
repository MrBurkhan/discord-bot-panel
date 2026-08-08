import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { commandData, commandInputSchema, serializeCommand } from "@/server/bots";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const commands = await prisma.command.findMany({
      where: { botId: id },
      orderBy: { createdAt: "asc" },
    });
    return ok(commands.map(serializeCommand));
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = commandInputSchema.parse(await request.json());
    const command = await prisma.command.create({ data: { botId: id, ...commandData(input) } });
    return ok(serializeCommand(command));
  } catch (error) {
    return fail(error);
  }
}
