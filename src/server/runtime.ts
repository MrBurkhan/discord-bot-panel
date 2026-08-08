import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Interaction,
  type MessageActionRowComponentBuilder,
} from "discord.js";
import type { Bot, Command } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import {
  COMMAND_TYPE_META,
  parseConfig,
  optionSchema,
  type ButtonConfig,
  type CommandOption,
  type CommandType,
  type EmbedConfig,
} from "@/lib/commandTypes";

export type BotStatus = {
  botId: string;
  running: boolean;
  username?: string;
  startedAt?: string;
  error?: string;
};

type RunningBot = {
  client: Client;
  startedAt: Date;
  username?: string;
};

const globalForRuntime = globalThis as unknown as {
  discordBots?: Map<string, RunningBot>;
  discordBotErrors?: Map<string, string>;
};

const running = (globalForRuntime.discordBots ??= new Map<string, RunningBot>());
const errors = (globalForRuntime.discordBotErrors ??= new Map<string, string>());

const BUTTON_PREFIX = "dbp";

async function log(
  botId: string,
  message: string,
  extra: { level?: string; commandName?: string; userTag?: string; guildId?: string | null } = {},
) {
  try {
    await prisma.logEntry.create({
      data: {
        botId,
        message,
        level: extra.level ?? "info",
        commandName: extra.commandName,
        userTag: extra.userTag,
        guildId: extra.guildId ?? undefined,
      },
    });
  } catch {
    // el registro nunca debe romper la ejecución del bot
  }
}

function parseOptions(raw: string): CommandOption[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((o) => optionSchema.parse(o));
  } catch {
    return [];
  }
}

function applyVariables(
  template: string,
  ctx: { userTag: string; userId: string; guildName: string; channelName: string; values: Record<string, string> },
): string {
  return template
    .replaceAll("{user}", `<@${ctx.userId}>`)
    .replaceAll("{user.tag}", ctx.userTag)
    .replaceAll("{user.id}", ctx.userId)
    .replaceAll("{server}", ctx.guildName)
    .replaceAll("{channel}", ctx.channelName)
    .replace(/\{opt:([a-z0-9_-]+)\}/g, (_m, name: string) => ctx.values[name] ?? "")
    .replace(/\{([a-z0-9_-]+)\}/g, (match, name: string) => ctx.values[name] ?? match);
}

function buildEmbed(
  config: EmbedConfig,
  ctx: Parameters<typeof applyVariables>[1],
): EmbedBuilder | null {
  const embed = new EmbedBuilder();
  let hasContent = false;
  if (config.title) {
    embed.setTitle(applyVariables(config.title, ctx));
    hasContent = true;
  }
  if (config.description) {
    embed.setDescription(applyVariables(config.description, ctx));
    hasContent = true;
  }
  if (config.color) {
    const parsed = Number.parseInt(config.color.replace("#", ""), 16);
    if (!Number.isNaN(parsed)) embed.setColor(parsed);
  }
  if (config.imageUrl) embed.setImage(config.imageUrl);
  if (config.thumbnailUrl) embed.setThumbnail(config.thumbnailUrl);
  if (config.footer) embed.setFooter({ text: applyVariables(config.footer, ctx) });
  for (const field of config.fields ?? []) {
    embed.addFields({
      name: applyVariables(field.name, ctx),
      value: applyVariables(field.value, ctx),
      inline: field.inline,
    });
    hasContent = true;
  }
  return hasContent ? embed : null;
}

const BUTTON_STYLES: Record<ButtonConfig["style"], ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
  link: ButtonStyle.Link,
};

function buildButtonRow(commandId: string, buttons: ButtonConfig[]) {
  const row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
  buttons.forEach((button, index) => {
    const builder = new ButtonBuilder().setLabel(button.label).setStyle(BUTTON_STYLES[button.style]);
    if (button.emoji) builder.setEmoji(button.emoji);
    if (button.style === "link") {
      builder.setURL(button.url || "https://discord.com");
    } else {
      builder.setCustomId(`${BUTTON_PREFIX}:${commandId}:${index}`);
    }
    row.addComponents(builder);
  });
  return row;
}

function toSlashCommand(command: Command) {
  const builder = new SlashCommandBuilder()
    .setName(command.name)
    .setDescription(command.description.slice(0, 100) || COMMAND_TYPE_META[command.type as CommandType].label);

  for (const option of parseOptions(command.options)) {
    const add = (
      o: { setName: (n: string) => { setDescription: (d: string) => { setRequired: (r: boolean) => unknown } } },
    ) => o.setName(option.name).setDescription(option.description).setRequired(option.required);
    switch (option.type) {
      case "integer":
        builder.addIntegerOption((o) => add(o) as never);
        break;
      case "user":
        builder.addUserOption((o) => add(o) as never);
        break;
      case "channel":
        builder.addChannelOption((o) => add(o) as never);
        break;
      case "boolean":
        builder.addBooleanOption((o) => add(o) as never);
        break;
      default:
        builder.addStringOption((o) => add(o) as never);
    }
  }
  return builder.toJSON();
}

function contextFor(interaction: ChatInputCommandInteraction, options: CommandOption[]) {
  const values: Record<string, string> = {};
  for (const option of options) {
    const value = interaction.options.get(option.name)?.value;
    values[option.name] = value === undefined || value === null ? "" : String(value);
  }
  return {
    userTag: interaction.user.tag,
    userId: interaction.user.id,
    guildName: interaction.guild?.name ?? "DM",
    channelName: interaction.channel && "name" in interaction.channel ? String(interaction.channel.name) : "DM",
    values,
  };
}

function scopeId(scope: string, interaction: ChatInputCommandInteraction) {
  if (scope === "user") return interaction.user.id;
  if (scope === "guild") return interaction.guildId ?? "dm";
  return "global";
}

async function handleStorage(bot: Bot, command: Command, interaction: ChatInputCommandInteraction) {
  const config = parseConfig("STORAGE", JSON.parse(command.config));
  const ctx = contextFor(interaction, parseOptions(command.options));
  const key = applyVariables(config.key, ctx);
  const where = { botId: bot.id, scope: config.scope, scopeId: scopeId(config.scope, interaction), key };
  const existing = await prisma.storageEntry.findUnique({ where: { botId_scope_scopeId_key: where } });
  const input = ctx.values[config.valueOption] ?? "";

  let value = existing?.value ?? "";
  switch (config.mode) {
    case "set":
      value = input;
      await prisma.storageEntry.upsert({
        where: { botId_scope_scopeId_key: where },
        update: { value },
        create: { ...where, value },
      });
      break;
    case "increment": {
      const delta = input ? Number(input) : config.amount;
      value = String((Number(existing?.value ?? 0) || 0) + (Number.isNaN(delta) ? 0 : delta));
      await prisma.storageEntry.upsert({
        where: { botId_scope_scopeId_key: where },
        update: { value },
        create: { ...where, value },
      });
      break;
    }
    case "append": {
      const list: string[] = existing ? JSON.parse(existing.value || "[]") : [];
      list.push(input);
      value = JSON.stringify(list);
      await prisma.storageEntry.upsert({
        where: { botId_scope_scopeId_key: where },
        update: { value },
        create: { ...where, value },
      });
      break;
    }
    case "delete":
      if (existing) await prisma.storageEntry.delete({ where: { id: existing.id } });
      value = "";
      break;
    case "get":
      break;
    case "list": {
      const all = await prisma.storageEntry.findMany({
        where: { botId: bot.id, scope: config.scope, key },
        orderBy: { updatedAt: "desc" },
        take: 25,
      });
      value = all.length
        ? all.map((entry, i) => `**${i + 1}.** <@${entry.scopeId}> — ${entry.value}`).join("\n")
        : "";
      break;
    }
  }

  const template = value ? config.successMessage : config.emptyMessage;
  const message = applyVariables(template, { ...ctx, values: { ...ctx.values, key, value } });
  await interaction.reply({
    content: message,
    flags: command.ephemeral ? MessageFlags.Ephemeral : undefined,
  });
}

async function handleRegister(bot: Bot, command: Command, interaction: ChatInputCommandInteraction) {
  const config = parseConfig("REGISTER", JSON.parse(command.config));
  const ctx = contextFor(interaction, parseOptions(command.options));
  const where = { botId: bot.id, scope: "user", scopeId: interaction.user.id, key: config.listKey };
  const existing = await prisma.storageEntry.findUnique({ where: { botId_scope_scopeId_key: where } });

  if (existing && !config.allowUpdate) {
    await interaction.reply({
      content: applyVariables(config.duplicateMessage, ctx),
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const record: Record<string, string> = { usuario: interaction.user.tag };
  for (const field of config.fields) record[field] = ctx.values[field] ?? "";
  const value = JSON.stringify(record);

  await prisma.storageEntry.upsert({
    where: { botId_scope_scopeId_key: where },
    update: { value },
    create: { ...where, value },
  });

  const summary = config.fields.map((field) => `**${field}:** ${record[field] || "—"}`).join("\n");
  await interaction.reply({
    content: `${applyVariables(config.successMessage, ctx)}\n${summary}`,
    flags: command.ephemeral ? MessageFlags.Ephemeral : undefined,
  });
}

async function handleConfig(bot: Bot, command: Command, interaction: ChatInputCommandInteraction) {
  const config = parseConfig("CONFIG", JSON.parse(command.config));
  const ctx = contextFor(interaction, parseOptions(command.options));

  if (config.adminOnly && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({
      content: "Necesitas el permiso **Gestionar servidor** para usar este comando.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const requestedKey = ctx.values["ajuste"] ?? "";
  const setting = config.settings.find((s) => s.key === requestedKey);
  if (!setting) {
    const available = config.settings.map((s) => `\`${s.key}\` — ${s.label}`).join("\n");
    await interaction.reply({
      content: `Ajustes disponibles:\n${available}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const value = ctx.values["valor"] ?? "";
  const where = {
    botId: bot.id,
    scope: "guild",
    scopeId: interaction.guildId ?? "dm",
    key: `config:${setting.key}`,
  };
  await prisma.storageEntry.upsert({
    where: { botId_scope_scopeId_key: where },
    update: { value },
    create: { ...where, value },
  });

  await interaction.reply({
    content: applyVariables(config.successMessage, {
      ...ctx,
      values: { ...ctx.values, key: setting.key, value },
    }),
    flags: MessageFlags.Ephemeral,
  });
}

async function handleChatInput(bot: Bot, interaction: ChatInputCommandInteraction) {
  const command = await prisma.command.findUnique({
    where: { botId_name: { botId: bot.id, name: interaction.commandName } },
  });
  if (!command || !command.enabled) return;

  const type = command.type as CommandType;
  const ctx = contextFor(interaction, parseOptions(command.options));
  const ephemeral = command.ephemeral ? MessageFlags.Ephemeral : undefined;

  switch (type) {
    case "TEXT": {
      const config = parseConfig("TEXT", JSON.parse(command.config));
      await interaction.reply({ content: applyVariables(config.content, ctx), flags: ephemeral });
      break;
    }
    case "EMBED": {
      const config = parseConfig("EMBED", JSON.parse(command.config));
      const embed = buildEmbed(config.embed, ctx);
      await interaction.reply({
        content: config.content ? applyVariables(config.content, ctx) : undefined,
        embeds: embed ? [embed] : [],
        flags: ephemeral,
      });
      break;
    }
    case "RANDOM": {
      const config = parseConfig("RANDOM", JSON.parse(command.config));
      const choice = config.responses[Math.floor(Math.random() * config.responses.length)];
      const intro = config.intro ? `${applyVariables(config.intro, ctx)}\n` : "";
      await interaction.reply({ content: `${intro}${applyVariables(choice, ctx)}`, flags: ephemeral });
      break;
    }
    case "BUTTONS": {
      const config = parseConfig("BUTTONS", JSON.parse(command.config));
      const embed = config.embed ? buildEmbed(config.embed, ctx) : null;
      await interaction.reply({
        content: config.content ? applyVariables(config.content, ctx) : undefined,
        embeds: embed ? [embed] : [],
        components: [buildButtonRow(command.id, config.buttons)],
        flags: ephemeral,
      });
      break;
    }
    case "DM": {
      const config = parseConfig("DM", JSON.parse(command.config));
      const embed = config.embed ? buildEmbed(config.embed, ctx) : null;
      try {
        await interaction.user.send({
          content: applyVariables(config.content, ctx),
          embeds: embed ? [embed] : [],
        });
        await interaction.reply({
          content: applyVariables(config.confirmation, ctx),
          flags: MessageFlags.Ephemeral,
        });
      } catch {
        await interaction.reply({
          content: applyVariables(config.failure, ctx),
          flags: MessageFlags.Ephemeral,
        });
      }
      break;
    }
    case "STORAGE":
      await handleStorage(bot, command, interaction);
      break;
    case "REGISTER":
      await handleRegister(bot, command, interaction);
      break;
    case "CONFIG":
      await handleConfig(bot, command, interaction);
      break;
  }

  await log(bot.id, `Comando /${command.name} ejecutado`, {
    commandName: command.name,
    userTag: interaction.user.tag,
    guildId: interaction.guildId,
  });
}

async function handleButton(bot: Bot, interaction: ButtonInteraction) {
  const [prefix, commandId, indexRaw] = interaction.customId.split(":");
  if (prefix !== BUTTON_PREFIX) return;

  const command = await prisma.command.findUnique({ where: { id: commandId } });
  if (!command || command.botId !== bot.id) return;

  const config = parseConfig("BUTTONS", JSON.parse(command.config));
  const button = config.buttons[Number(indexRaw)];
  if (!button) return;

  const ctx = {
    userTag: interaction.user.tag,
    userId: interaction.user.id,
    guildName: interaction.guild?.name ?? "DM",
    channelName: interaction.channel && "name" in interaction.channel ? String(interaction.channel.name) : "DM",
    values: {} as Record<string, string>,
  };
  const content = applyVariables(button.response || "✅", ctx);

  if (button.responseType === "dm") {
    try {
      await interaction.user.send({ content });
      await interaction.reply({ content: "Te envié un mensaje directo 📩", flags: MessageFlags.Ephemeral });
    } catch {
      await interaction.reply({
        content: "No pude enviarte un DM, revisa tu privacidad.",
        flags: MessageFlags.Ephemeral,
      });
    }
  } else {
    await interaction.reply({ content, flags: button.ephemeral ? MessageFlags.Ephemeral : undefined });
  }

  await log(bot.id, `Botón "${button.label}" pulsado en /${command.name}`, {
    commandName: command.name,
    userTag: interaction.user.tag,
    guildId: interaction.guildId,
  });
}

export async function syncCommands(botId: string): Promise<number> {
  const entry = running.get(botId);
  if (!entry) throw new Error("El bot no está en línea. Enciéndelo antes de sincronizar.");

  const bot = await prisma.bot.findUniqueOrThrow({ where: { id: botId }, include: { commands: true } });
  const payload = bot.commands.filter((c) => c.enabled).map(toSlashCommand);

  if (bot.guildId) {
    const guild = await entry.client.guilds.fetch(bot.guildId);
    await guild.commands.set(payload);
  } else {
    await entry.client.application?.commands.set(payload);
  }

  await log(botId, `Sincronizados ${payload.length} comandos con Discord`);
  return payload.length;
}

export async function startBot(botId: string): Promise<BotStatus> {
  if (running.has(botId)) return getStatus(botId);

  const bot = await prisma.bot.findUniqueOrThrow({ where: { id: botId } });
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
  });

  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      if (interaction.isChatInputCommand()) await handleChatInput(bot, interaction);
      else if (interaction.isButton()) await handleButton(bot, interaction);
    } catch (error) {
      await log(bot.id, `Error al procesar interacción: ${(error as Error).message}`, { level: "error" });
    }
  });

  try {
    await client.login(decryptToken(bot.token));
  } catch (error) {
    const message = (error as Error).message;
    errors.set(botId, message);
    await log(botId, `No se pudo conectar: ${message}`, { level: "error" });
    throw new Error(`No se pudo conectar el bot: ${message}`);
  }

  errors.delete(botId);
  running.set(botId, { client, startedAt: new Date(), username: client.user?.tag });
  if (client.application?.id && client.application.id !== bot.applicationId) {
    await prisma.bot.update({ where: { id: botId }, data: { applicationId: client.application.id } });
  }
  await log(botId, `Bot conectado como ${client.user?.tag ?? "desconocido"}`);
  await syncCommands(botId).catch(async (error: Error) => {
    await log(botId, `No se pudieron sincronizar los comandos: ${error.message}`, { level: "error" });
  });
  return getStatus(botId);
}

export async function stopBot(botId: string): Promise<BotStatus> {
  const entry = running.get(botId);
  if (entry) {
    await entry.client.destroy();
    running.delete(botId);
    await log(botId, "Bot desconectado");
  }
  return getStatus(botId);
}

export function getStatus(botId: string): BotStatus {
  const entry = running.get(botId);
  return {
    botId,
    running: Boolean(entry),
    username: entry?.username,
    startedAt: entry?.startedAt.toISOString(),
    error: errors.get(botId),
  };
}

export function getAllStatuses(botIds: string[]): Record<string, BotStatus> {
  return Object.fromEntries(botIds.map((id) => [id, getStatus(id)]));
}
