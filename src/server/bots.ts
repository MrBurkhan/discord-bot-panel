import { z } from "zod";
import type { Bot, Command } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encryptToken, maskToken } from "@/lib/crypto";
import {
  COMMAND_TYPES,
  optionSchema,
  parseConfig,
  type CommandType,
} from "@/lib/commandTypes";
import { getStatus, type BotStatus } from "@/server/runtime";

export const botInputSchema = z.object({
  name: z.string().min(1, "Ponle un nombre al bot").max(80),
  token: z.string().min(20, "El token no parece válido").optional(),
  applicationId: z.string().optional().or(z.literal("")),
  guildId: z.string().optional().or(z.literal("")),
  autoStart: z.boolean().optional(),
  logChannelId: z.string().optional().or(z.literal("")),
});

export const commandInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, "El nombre solo admite minúsculas, números, - y _"),
  description: z.string().min(1).max(100),
  type: z.enum(COMMAND_TYPES),
  enabled: z.boolean().default(true),
  ephemeral: z.boolean().default(false),
  options: z.array(optionSchema).default([]),
  config: z.unknown(),
});

export type SerializedBot = Omit<Bot, "token"> & { tokenPreview: string; status: BotStatus; commandCount?: number };
export type SerializedCommand = Omit<Command, "options" | "config"> & {
  options: unknown;
  config: unknown;
};

export function serializeBot(bot: Bot & { _count?: { commands: number } }): SerializedBot {
  const { token, ...rest } = bot;
  return {
    ...rest,
    tokenPreview: maskToken(token),
    status: getStatus(bot.id),
    commandCount: bot._count?.commands,
  };
}

export function serializeCommand(command: Command): SerializedCommand {
  return {
    ...command,
    options: JSON.parse(command.options),
    config: JSON.parse(command.config),
  };
}

export function botCreateData(input: z.infer<typeof botInputSchema>) {
  if (!input.token) throw new Error("El token del bot es obligatorio");
  return {
    name: input.name,
    token: encryptToken(input.token.trim()),
    applicationId: input.applicationId || null,
    guildId: input.guildId || null,
    logChannelId: input.logChannelId || null,
    autoStart: input.autoStart ?? false,
  };
}

export function botUpdateData(input: z.infer<typeof botInputSchema>) {
  return {
    name: input.name,
    applicationId: input.applicationId || null,
    guildId: input.guildId || null,
    logChannelId: input.logChannelId || null,
    autoStart: input.autoStart ?? false,
    ...(input.token ? { token: encryptToken(input.token.trim()) } : {}),
  };
}

export function commandData(input: z.infer<typeof commandInputSchema>) {
  const config = parseConfig(input.type as CommandType, input.config);
  return {
    name: input.name,
    description: input.description,
    type: input.type,
    enabled: input.enabled,
    ephemeral: input.ephemeral,
    options: JSON.stringify(input.options),
    config: JSON.stringify(config),
  };
}

export async function listBots(): Promise<SerializedBot[]> {
  const bots = await prisma.bot.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { commands: true } } },
  });
  return bots.map(serializeBot);
}
