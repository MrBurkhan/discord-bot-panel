import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { startBot, stopBot, syncCommands } from "@/server/runtime";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["start", "stop", "sync"]) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { action } = bodySchema.parse(await request.json());
    if (action === "start") return ok(await startBot(id));
    if (action === "stop") return ok(await stopBot(id));
    return ok({ synced: await syncCommands(id) });
  } catch (error) {
    return fail(error);
  }
}
