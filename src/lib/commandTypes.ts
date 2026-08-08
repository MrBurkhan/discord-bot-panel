import { z } from "zod";

export const COMMAND_TYPES = [
  "TEXT",
  "EMBED",
  "RANDOM",
  "BUTTONS",
  "STORAGE",
  "REGISTER",
  "DM",
  "CONFIG",
] as const;

export type CommandType = (typeof COMMAND_TYPES)[number];

export const COMMAND_TYPE_META: Record<
  CommandType,
  { label: string; emoji: string; description: string }
> = {
  TEXT: {
    label: "Respuesta de texto",
    emoji: "💬",
    description: "El bot responde con un mensaje simple. Admite variables como {user}.",
  },
  EMBED: {
    label: "Embed",
    emoji: "🖼️",
    description: "Respuesta con tarjeta enriquecida: título, color, campos e imágenes.",
  },
  RANDOM: {
    label: "Respuesta al azar",
    emoji: "🎲",
    description: "Elige una respuesta aleatoria de una lista (bola 8, frases, memes...).",
  },
  BUTTONS: {
    label: "Botones interactivos",
    emoji: "🔘",
    description: "Mensaje con botones que responden, envían un DM o abren un enlace.",
  },
  STORAGE: {
    label: "Almacenamiento",
    emoji: "🗄️",
    description: "Guarda, lee, suma o lista datos por usuario, servidor o globales.",
  },
  REGISTER: {
    label: "Registro",
    emoji: "📝",
    description: "Registra usuarios con los campos que definas y evita duplicados.",
  },
  DM: {
    label: "Respuesta al DM",
    emoji: "📩",
    description: "Envía la respuesta por mensaje directo al usuario que ejecuta el comando.",
  },
  CONFIG: {
    label: "Configuración",
    emoji: "⚙️",
    description: "Permite a los administradores cambiar ajustes del bot desde Discord.",
  },
};

export const optionSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9_-]+$/, "Solo minúsculas, números, guiones y guiones bajos"),
  description: z.string().min(1).max(100).default("Parámetro"),
  type: z.enum(["string", "integer", "user", "channel", "boolean"]).default("string"),
  required: z.boolean().default(false),
});

export type CommandOption = z.infer<typeof optionSchema>;

const embedSchema = z.object({
  title: z.string().max(256).optional().or(z.literal("")),
  description: z.string().max(4000).optional().or(z.literal("")),
  color: z.string().optional().or(z.literal("")),
  imageUrl: z.string().optional().or(z.literal("")),
  thumbnailUrl: z.string().optional().or(z.literal("")),
  footer: z.string().max(2048).optional().or(z.literal("")),
  fields: z
    .array(z.object({ name: z.string().min(1), value: z.string().min(1), inline: z.boolean().default(false) }))
    .default([]),
});

export type EmbedConfig = z.infer<typeof embedSchema>;

const buttonSchema = z.object({
  label: z.string().min(1).max(80),
  style: z.enum(["primary", "secondary", "success", "danger", "link"]).default("primary"),
  emoji: z.string().optional().or(z.literal("")),
  url: z.string().optional().or(z.literal("")),
  responseType: z.enum(["reply", "dm"]).default("reply"),
  response: z.string().default(""),
  ephemeral: z.boolean().default(true),
});

export type ButtonConfig = z.infer<typeof buttonSchema>;

export const configSchemas = {
  TEXT: z.object({ content: z.string().min(1, "Escribe el mensaje de respuesta") }),
  EMBED: z.object({ content: z.string().default(""), embed: embedSchema }),
  RANDOM: z.object({
    intro: z.string().default(""),
    responses: z.array(z.string().min(1)).min(1, "Agrega al menos una respuesta"),
  }),
  BUTTONS: z.object({
    content: z.string().default(""),
    embed: embedSchema.optional(),
    buttons: z.array(buttonSchema).min(1, "Agrega al menos un botón").max(5),
  }),
  STORAGE: z.object({
    key: z.string().min(1, "Indica la clave a usar"),
    scope: z.enum(["user", "guild", "global"]).default("user"),
    mode: z.enum(["set", "get", "increment", "append", "list", "delete"]).default("set"),
    valueOption: z.string().default("valor"),
    amount: z.number().default(1),
    successMessage: z.string().default("Listo, guardé **{value}** en `{key}`."),
    emptyMessage: z.string().default("Todavía no hay nada guardado en `{key}`."),
  }),
  REGISTER: z.object({
    listKey: z.string().default("registros"),
    fields: z.array(z.string().min(1)).min(1, "Agrega al menos un campo"),
    allowUpdate: z.boolean().default(true),
    successMessage: z.string().default("¡Registro completado, {user}!"),
    duplicateMessage: z.string().default("Ya estabas registrado, {user}."),
  }),
  DM: z.object({
    content: z.string().min(1, "Escribe el mensaje que se enviará por DM"),
    embed: embedSchema.optional(),
    confirmation: z.string().default("Te envié un mensaje directo 📩"),
    failure: z.string().default("No pude enviarte un DM, revisa tu privacidad."),
  }),
  CONFIG: z.object({
    settings: z
      .array(
        z.object({
          key: z.string().min(1),
          label: z.string().min(1),
          description: z.string().default(""),
        }),
      )
      .min(1, "Agrega al menos un ajuste"),
    adminOnly: z.boolean().default(true),
    successMessage: z.string().default("Ajuste **{key}** actualizado a `{value}`."),
  }),
} satisfies Record<CommandType, z.ZodTypeAny>;

export function parseConfig<T extends CommandType>(
  type: T,
  raw: unknown,
): z.infer<(typeof configSchemas)[T]> {
  return configSchemas[type].parse(raw) as z.infer<(typeof configSchemas)[T]>;
}

export function defaultConfig(type: CommandType): unknown {
  switch (type) {
    case "TEXT":
      return { content: "¡Hola {user}! 👋" };
    case "EMBED":
      return {
        content: "",
        embed: {
          title: "Título del embed",
          description: "Descripción del embed",
          color: "#5865F2",
          imageUrl: "",
          thumbnailUrl: "",
          footer: "",
          fields: [],
        },
      };
    case "RANDOM":
      return { intro: "", responses: ["Sí 👍", "No 👎", "Tal vez 🤔"] };
    case "BUTTONS":
      return {
        content: "Elige una opción:",
        buttons: [
          {
            label: "Opción 1",
            style: "primary",
            emoji: "",
            url: "",
            responseType: "reply",
            response: "Elegiste la opción 1",
            ephemeral: true,
          },
        ],
      };
    case "STORAGE":
      return {
        key: "puntos",
        scope: "user",
        mode: "set",
        valueOption: "valor",
        amount: 1,
        successMessage: "Listo, guardé **{value}** en `{key}`.",
        emptyMessage: "Todavía no hay nada guardado en `{key}`.",
      };
    case "REGISTER":
      return {
        listKey: "registros",
        fields: ["nombre", "edad"],
        allowUpdate: true,
        successMessage: "¡Registro completado, {user}!",
        duplicateMessage: "Ya estabas registrado, {user}.",
      };
    case "DM":
      return {
        content: "Hola {user}, este es tu mensaje privado.",
        confirmation: "Te envié un mensaje directo 📩",
        failure: "No pude enviarte un DM, revisa tu privacidad.",
      };
    case "CONFIG":
      return {
        settings: [
          { key: "canal_bienvenida", label: "Canal de bienvenida", description: "ID del canal" },
        ],
        adminOnly: true,
        successMessage: "Ajuste **{key}** actualizado a `{value}`.",
      };
  }
}

export function defaultOptions(type: CommandType): CommandOption[] {
  switch (type) {
    case "STORAGE":
      return [{ name: "valor", description: "Valor a guardar", type: "string", required: false }];
    case "REGISTER":
      return [
        { name: "nombre", description: "Tu nombre", type: "string", required: true },
        { name: "edad", description: "Tu edad", type: "integer", required: false },
      ];
    case "CONFIG":
      return [
        { name: "ajuste", description: "Ajuste a modificar", type: "string", required: true },
        { name: "valor", description: "Nuevo valor", type: "string", required: true },
      ];
    default:
      return [];
  }
}
