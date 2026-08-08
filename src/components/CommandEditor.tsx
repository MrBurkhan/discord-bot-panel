"use client";

import { useState } from "react";
import { Alert, Button, Card, Field, Input, Select, Textarea, Toggle } from "@/components/ui";
import {
  COMMAND_TYPES,
  COMMAND_TYPE_META,
  defaultConfig,
  defaultOptions,
  type CommandOption,
  type CommandType,
} from "@/lib/commandTypes";
import { api } from "@/lib/client";
import type { SerializedCommand } from "@/server/bots";

type Draft = {
  name: string;
  description: string;
  type: CommandType;
  enabled: boolean;
  ephemeral: boolean;
  options: CommandOption[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
};

function draftFrom(command?: SerializedCommand): Draft {
  if (!command) {
    return {
      name: "",
      description: "",
      type: "TEXT",
      enabled: true,
      ephemeral: false,
      options: [],
      config: defaultConfig("TEXT"),
    };
  }
  return {
    name: command.name,
    description: command.description,
    type: command.type as CommandType,
    enabled: command.enabled,
    ephemeral: command.ephemeral,
    options: command.options as CommandOption[],
    config: command.config,
  };
}

export function CommandEditor({
  botId,
  command,
  onSaved,
  onCancel,
}: {
  botId: string;
  command?: SerializedCommand;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(draftFrom(command));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const patch = (values: Partial<Draft>) => setDraft((d) => ({ ...d, ...values }));
  const patchConfig = (values: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, config: { ...d.config, ...values } }));

  function changeType(type: CommandType) {
    patch({ type, config: defaultConfig(type), options: defaultOptions(type) });
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const body = JSON.stringify(draft);
      if (command) await api(`/api/commands/${command.id}`, { method: "PATCH", body });
      else await api(`/api/bots/${botId}/commands`, { method: "POST", body });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">{command ? `Editar /${command.name}` : "Nuevo comando"}</h2>
        <Button variant="ghost" onClick={onCancel}>
          Cerrar
        </Button>
      </div>

      {error ? <Alert message={error} /> : null}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-200">1. Elige el tipo de comando</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {COMMAND_TYPES.map((type) => {
            const meta = COMMAND_TYPE_META[type];
            const active = draft.type === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => changeType(type)}
                className={`rounded-lg border p-3 text-left transition ${
                  active
                    ? "border-indigo-400 bg-indigo-500/15"
                    : "border-white/10 bg-slate-900/50 hover:border-white/25"
                }`}
              >
                <span className="text-sm font-medium">
                  {meta.emoji} {meta.label}
                </span>
                <p className="mt-1 text-xs text-slate-400">{meta.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="2. Nombre del comando" hint="Se usará como /nombre en Discord.">
          <Input
            value={draft.name}
            onChange={(e) => patch({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
            placeholder="saludo"
          />
        </Field>
        <Field label="Descripción">
          <Input
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="Saluda al usuario"
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <Toggle checked={draft.enabled} onChange={(enabled) => patch({ enabled })} label="Comando activo" />
        <Toggle
          checked={draft.ephemeral}
          onChange={(ephemeral) => patch({ ephemeral })}
          label="Respuesta solo visible para quien lo usa"
        />
      </div>

      <div className="space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
        <p className="text-sm font-medium text-slate-200">3. Configura la respuesta</p>
        <ConfigFields type={draft.type} config={draft.config} patchConfig={patchConfig} />
      </div>

      <OptionsEditor options={draft.options} onChange={(options) => patch({ options })} />

      <div className="flex gap-2">
        <Button onClick={save} disabled={saving || !draft.name || !draft.description}>
          {saving ? "Guardando..." : "Guardar comando"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      <p className="text-xs text-slate-500">
        Variables disponibles: <code>{"{user}"}</code>, <code>{"{user.tag}"}</code>, <code>{"{server}"}</code>,{" "}
        <code>{"{channel}"}</code> y <code>{"{opt:nombre}"}</code> para los parámetros.
      </p>
    </Card>
  );
}

function ConfigFields({
  type,
  config,
  patchConfig,
}: {
  type: CommandType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any;
  patchConfig: (values: Record<string, unknown>) => void;
}) {
  switch (type) {
    case "TEXT":
      return (
        <Field label="Mensaje de respuesta">
          <Textarea value={config.content ?? ""} onChange={(e) => patchConfig({ content: e.target.value })} />
        </Field>
      );
    case "EMBED":
      return (
        <div className="space-y-4">
          <Field label="Texto encima del embed (opcional)">
            <Input value={config.content ?? ""} onChange={(e) => patchConfig({ content: e.target.value })} />
          </Field>
          <EmbedFields embed={config.embed ?? {}} onChange={(embed) => patchConfig({ embed })} />
        </div>
      );
    case "RANDOM":
      return (
        <div className="space-y-4">
          <Field label="Texto de introducción (opcional)">
            <Input value={config.intro ?? ""} onChange={(e) => patchConfig({ intro: e.target.value })} />
          </Field>
          <StringList
            label="Respuestas posibles"
            values={config.responses ?? []}
            onChange={(responses) => patchConfig({ responses })}
            placeholder="Una respuesta"
          />
        </div>
      );
    case "BUTTONS":
      return (
        <div className="space-y-4">
          <Field label="Mensaje del comando">
            <Textarea value={config.content ?? ""} onChange={(e) => patchConfig({ content: e.target.value })} />
          </Field>
          <ButtonsEditor buttons={config.buttons ?? []} onChange={(buttons) => patchConfig({ buttons })} />
        </div>
      );
    case "STORAGE":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Clave" hint="Nombre del dato: puntos, nivel, notas...">
            <Input value={config.key ?? ""} onChange={(e) => patchConfig({ key: e.target.value })} />
          </Field>
          <Field label="Ámbito">
            <Select value={config.scope ?? "user"} onChange={(e) => patchConfig({ scope: e.target.value })}>
              <option value="user">Por usuario</option>
              <option value="guild">Por servidor</option>
              <option value="global">Global</option>
            </Select>
          </Field>
          <Field label="Acción">
            <Select value={config.mode ?? "set"} onChange={(e) => patchConfig({ mode: e.target.value })}>
              <option value="set">Guardar valor</option>
              <option value="get">Leer valor</option>
              <option value="increment">Sumar</option>
              <option value="append">Añadir a lista</option>
              <option value="list">Listar todos</option>
              <option value="delete">Borrar</option>
            </Select>
          </Field>
          <Field label="Parámetro con el valor" hint="Debe coincidir con un parámetro definido abajo.">
            <Input value={config.valueOption ?? ""} onChange={(e) => patchConfig({ valueOption: e.target.value })} />
          </Field>
          <Field label="Mensaje de éxito" hint="Usa {key} y {value}.">
            <Input
              value={config.successMessage ?? ""}
              onChange={(e) => patchConfig({ successMessage: e.target.value })}
            />
          </Field>
          <Field label="Mensaje cuando no hay datos">
            <Input value={config.emptyMessage ?? ""} onChange={(e) => patchConfig({ emptyMessage: e.target.value })} />
          </Field>
        </div>
      );
    case "REGISTER":
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre de la lista de registros">
              <Input value={config.listKey ?? ""} onChange={(e) => patchConfig({ listKey: e.target.value })} />
            </Field>
            <div className="flex items-end">
              <Toggle
                checked={config.allowUpdate ?? true}
                onChange={(allowUpdate) => patchConfig({ allowUpdate })}
                label="Permitir actualizar un registro existente"
              />
            </div>
          </div>
          <StringList
            label="Campos a registrar"
            values={config.fields ?? []}
            onChange={(fields) => patchConfig({ fields })}
            placeholder="nombre"
            hint="Crea un parámetro con el mismo nombre para pedir el dato en Discord."
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Mensaje de éxito">
              <Input
                value={config.successMessage ?? ""}
                onChange={(e) => patchConfig({ successMessage: e.target.value })}
              />
            </Field>
            <Field label="Mensaje si ya estaba registrado">
              <Input
                value={config.duplicateMessage ?? ""}
                onChange={(e) => patchConfig({ duplicateMessage: e.target.value })}
              />
            </Field>
          </div>
        </div>
      );
    case "DM":
      return (
        <div className="space-y-4">
          <Field label="Mensaje privado">
            <Textarea value={config.content ?? ""} onChange={(e) => patchConfig({ content: e.target.value })} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Confirmación en el canal">
              <Input
                value={config.confirmation ?? ""}
                onChange={(e) => patchConfig({ confirmation: e.target.value })}
              />
            </Field>
            <Field label="Mensaje si el DM falla">
              <Input value={config.failure ?? ""} onChange={(e) => patchConfig({ failure: e.target.value })} />
            </Field>
          </div>
        </div>
      );
    case "CONFIG":
      return (
        <div className="space-y-4">
          <Toggle
            checked={config.adminOnly ?? true}
            onChange={(adminOnly) => patchConfig({ adminOnly })}
            label="Solo administradores (permiso Gestionar servidor)"
          />
          <SettingsEditor settings={config.settings ?? []} onChange={(settings) => patchConfig({ settings })} />
          <Field label="Mensaje de éxito" hint="Usa {key} y {value}.">
            <Input
              value={config.successMessage ?? ""}
              onChange={(e) => patchConfig({ successMessage: e.target.value })}
            />
          </Field>
          <p className="text-xs text-slate-500">
            Este comando usa los parámetros <code>ajuste</code> y <code>valor</code>.
          </p>
        </div>
      );
  }
}

function EmbedFields({
  embed,
  onChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  embed: any;
  onChange: (embed: unknown) => void;
}) {
  const patch = (values: Record<string, unknown>) => onChange({ ...embed, ...values });
  const fields: { name: string; value: string; inline: boolean }[] = embed.fields ?? [];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Título">
          <Input value={embed.title ?? ""} onChange={(e) => patch({ title: e.target.value })} />
        </Field>
        <Field label="Color">
          <Input type="color" value={embed.color || "#5865F2"} onChange={(e) => patch({ color: e.target.value })} />
        </Field>
      </div>
      <Field label="Descripción">
        <Textarea value={embed.description ?? ""} onChange={(e) => patch({ description: e.target.value })} />
      </Field>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Imagen (URL)">
          <Input value={embed.imageUrl ?? ""} onChange={(e) => patch({ imageUrl: e.target.value })} />
        </Field>
        <Field label="Miniatura (URL)">
          <Input value={embed.thumbnailUrl ?? ""} onChange={(e) => patch({ thumbnailUrl: e.target.value })} />
        </Field>
        <Field label="Pie de página">
          <Input value={embed.footer ?? ""} onChange={(e) => patch({ footer: e.target.value })} />
        </Field>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-slate-200">Campos del embed</p>
        {fields.map((field, index) => (
          <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_auto_auto]">
            <Input
              value={field.name}
              placeholder="Nombre"
              onChange={(e) => {
                const next = [...fields];
                next[index] = { ...field, name: e.target.value };
                patch({ fields: next });
              }}
            />
            <Input
              value={field.value}
              placeholder="Valor"
              onChange={(e) => {
                const next = [...fields];
                next[index] = { ...field, value: e.target.value };
                patch({ fields: next });
              }}
            />
            <Toggle
              checked={field.inline}
              label="En línea"
              onChange={(inline) => {
                const next = [...fields];
                next[index] = { ...field, inline };
                patch({ fields: next });
              }}
            />
            <Button variant="danger" onClick={() => patch({ fields: fields.filter((_, i) => i !== index) })}>
              ✕
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => patch({ fields: [...fields, { name: "Campo", value: "Valor", inline: false }] })}
        >
          + Añadir campo
        </Button>
      </div>
    </div>
  );
}

function ButtonsEditor({
  buttons,
  onChange,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  buttons: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (buttons: any[]) => void;
}) {
  const update = (index: number, values: Record<string, unknown>) => {
    const next = [...buttons];
    next[index] = { ...next[index], ...values };
    onChange(next);
  };
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-200">Botones (máx. 5)</p>
      {buttons.map((button, index) => (
        <div key={index} className="space-y-3 rounded-lg border border-white/10 p-3">
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Texto">
              <Input value={button.label ?? ""} onChange={(e) => update(index, { label: e.target.value })} />
            </Field>
            <Field label="Estilo">
              <Select value={button.style ?? "primary"} onChange={(e) => update(index, { style: e.target.value })}>
                <option value="primary">Azul</option>
                <option value="secondary">Gris</option>
                <option value="success">Verde</option>
                <option value="danger">Rojo</option>
                <option value="link">Enlace</option>
              </Select>
            </Field>
            <Field label="Emoji (opcional)">
              <Input value={button.emoji ?? ""} onChange={(e) => update(index, { emoji: e.target.value })} />
            </Field>
            <Field label="Acción">
              <Select
                value={button.style === "link" ? "link" : (button.responseType ?? "reply")}
                disabled={button.style === "link"}
                onChange={(e) => update(index, { responseType: e.target.value })}
              >
                <option value="reply">Responder en el canal</option>
                <option value="dm">Enviar por DM</option>
                {button.style === "link" ? <option value="link">Abrir enlace</option> : null}
              </Select>
            </Field>
          </div>
          {button.style === "link" ? (
            <Field label="URL">
              <Input value={button.url ?? ""} onChange={(e) => update(index, { url: e.target.value })} />
            </Field>
          ) : (
            <>
              <Field label="Respuesta al pulsar">
                <Textarea value={button.response ?? ""} onChange={(e) => update(index, { response: e.target.value })} />
              </Field>
              <Toggle
                checked={button.ephemeral ?? true}
                onChange={(ephemeral) => update(index, { ephemeral })}
                label="Respuesta privada"
              />
            </>
          )}
          <Button variant="danger" onClick={() => onChange(buttons.filter((_, i) => i !== index))}>
            Eliminar botón
          </Button>
        </div>
      ))}
      {buttons.length < 5 ? (
        <Button
          variant="ghost"
          onClick={() =>
            onChange([
              ...buttons,
              {
                label: `Opción ${buttons.length + 1}`,
                style: "primary",
                emoji: "",
                url: "",
                responseType: "reply",
                response: "",
                ephemeral: true,
              },
            ])
          }
        >
          + Añadir botón
        </Button>
      ) : null}
    </div>
  );
}

function SettingsEditor({
  settings,
  onChange,
}: {
  settings: { key: string; label: string; description: string }[];
  onChange: (settings: { key: string; label: string; description: string }[]) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-200">Ajustes editables desde Discord</p>
      {settings.map((setting, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
          <Input
            value={setting.key}
            placeholder="clave"
            onChange={(e) => {
              const next = [...settings];
              next[index] = { ...setting, key: e.target.value };
              onChange(next);
            }}
          />
          <Input
            value={setting.label}
            placeholder="Nombre visible"
            onChange={(e) => {
              const next = [...settings];
              next[index] = { ...setting, label: e.target.value };
              onChange(next);
            }}
          />
          <Input
            value={setting.description}
            placeholder="Descripción"
            onChange={(e) => {
              const next = [...settings];
              next[index] = { ...setting, description: e.target.value };
              onChange(next);
            }}
          />
          <Button variant="danger" onClick={() => onChange(settings.filter((_, i) => i !== index))}>
            ✕
          </Button>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...settings, { key: "", label: "", description: "" }])}>
        + Añadir ajuste
      </Button>
    </div>
  );
}

function StringList({
  label,
  values,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-200">{label}</p>
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              const next = [...values];
              next[index] = e.target.value;
              onChange(next);
            }}
          />
          <Button variant="danger" onClick={() => onChange(values.filter((_, i) => i !== index))}>
            ✕
          </Button>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...values, ""])}>
        + Añadir
      </Button>
      {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: CommandOption[];
  onChange: (options: CommandOption[]) => void;
}) {
  const update = (index: number, values: Partial<CommandOption>) => {
    const next = [...options];
    next[index] = { ...next[index], ...values };
    onChange(next);
  };
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-slate-900/40 p-4">
      <p className="text-sm font-medium text-slate-200">4. Parámetros que pedirá el comando (opcional)</p>
      {options.map((option, index) => (
        <div key={index} className="grid gap-2 md:grid-cols-[1fr_2fr_1fr_auto_auto]">
          <Input
            value={option.name}
            placeholder="nombre"
            onChange={(e) => update(index, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
          />
          <Input
            value={option.description}
            placeholder="Descripción"
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <Select
            value={option.type}
            onChange={(e) => update(index, { type: e.target.value as CommandOption["type"] })}
          >
            <option value="string">Texto</option>
            <option value="integer">Número</option>
            <option value="user">Usuario</option>
            <option value="channel">Canal</option>
            <option value="boolean">Sí/No</option>
          </Select>
          <Toggle
            checked={option.required}
            label="Obligatorio"
            onChange={(required) => update(index, { required })}
          />
          <Button variant="danger" onClick={() => onChange(options.filter((_, i) => i !== index))}>
            ✕
          </Button>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          onChange([...options, { name: "", description: "Parámetro", type: "string", required: false }])
        }
      >
        + Añadir parámetro
      </Button>
    </div>
  );
}
