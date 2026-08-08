import { prisma } from "@/lib/prisma";
import { fail, ok } from "@/lib/api";
import { botCreateData, botInputSchema, listBots, serializeBot } from "@/server/bots";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await listBots());
  } catch (error) {
    return fail(error, 500);
  }
}

export async function POST(request: Request) {
  try {
    const input = botInputSchema.parse(await request.json());
    const bot = await prisma.bot.create({ data: botCreateData(input) });
    return ok(serializeBot(bot));
  } catch (error) {
    return fail(error);
  }
}
