"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { Alert, Badge, Button, Card, Field, Input, Toggle } from "@/components/ui";
import { CommandEditor } from "@/components/CommandEditor";
import { api } from "@/lib/client";
import { COMMAND_TYPE_META, type CommandType } from "@/lib/commandTypes";
import type { SerializedBot, SerializedCommand } from "@/server/bots";

type LogEntry = {
  id: string;
  level: string;
  message: string;
  commandName: string | null;
  userTag: string | null;
  createdAt: string;
};

type StorageEntry = {
  id: string;
  scope: string;
  scopeId: string;
  key: string;
  value: string;
  updatedAt: string;
};

type Tab = "commands" | "settings" | "storage" | "logs";

export default function BotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bot, setBot] = useState<SerializedBot | null>(null);
  const [commands, setCommands] = useState<SerializedCommand[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [entries, setEntries] = useState<StorageEntry[]>([]);
  const [tab, setTab] = useState<Tab>("commands");
  const [editing, setEditing] = useState<SerializedCommand | "new" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [botData, commandData] = await Promise.all([
        api<SerializedBot>(`/api/bots/${id}`),
        api<SerializedCommand[]>(`/api/bots/${id}/commands`),
      ]);
      setBot(botData);
      setCommands(commandData);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === "logs") api<LogEntry[]>(`/api/bots/${id}/logs`).then(setLogs).catch(() => {});
    if (tab === "storage") api<StorageEntry[]>(`/api/bots/${id}/storage`).then(setEntries).catch(() => {});
  }, [tab, id]);

  async function power(action: "start" | "stop" | "sync") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ synced?: number }>(`/api/bots/${id}/power`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (action === "sync") setNotice(`Se sincronizaron ${result.synced} comandos con Discord.`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCommand(commandId: string) {
    try {
      await api(`/api/commands/${commandId}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (!bot) {
    return <p className="text-sm text-slate-400">{error || "Cargando..."}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ← Volver
          </Link>
          <h1 className="text-2xl font-semibold">{bot.name}</h1>
          <p className="text-sm text-slate-400">
            {bot.status.running ? `En línea como ${bot.status.username ?? "…"}` : "Apagado"} · {commands.length}{" "}
            comandos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bot.status.running ? (
            <Button variant="danger" onClick={() => power("stop")} disabled={busy}>
              Apagar
            </Button>
          ) : (
            <Button variant="success" onClick={() => power("start")} disabled={busy}>
              Encender
            </Button>
          )}
          <Button variant="ghost" onClick={() => power("sync")} disabled={busy || !bot.status.running}>
            Sincronizar comandos
          </Button>
        </div>
      </div>

      {error ? <Alert message={error} /> : null}
      {notice ? <Alert message={notice} tone="success" /> : null}

      <div className="flex gap-2 border-b border-white/10 pb-2 text-sm">
        {(
          [
            ["commands", "Comandos"],
            ["settings", "Ajustes del bot"],
            ["storage", "Datos guardados"],
            ["logs", "Registro"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-3 py-1.5 ${tab === key ? "bg-indigo-500/20 text-indigo-200" : "text-slate-400 hover:text-slate-200"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "commands" ? (
        <div className="space-y-4">
          {editing ? (
            <CommandEditor
              botId={id}
              command={editing === "new" ? undefined : editing}
              onCancel={() => setEditing(null)}
              onSaved={async () => {
                setEditing(null);
                await load();
              }}
            />
          ) : (
            <Button onClick={() => setEditing("new")}>+ Nuevo comando</Button>
          )}

          {commands.length === 0 && !editing ? (
            <Card>
              <p className="text-sm text-slate-300">
                Este bot aún no tiene comandos. Crea el primero y luego pulsa <strong>Sincronizar comandos</strong>{" "}
                para que aparezca en Discord.
              </p>
            </Card>
          ) : null}

          <div className="grid gap-3">
            {commands.map((command) => {
              const meta = COMMAND_TYPE_META[command.type as CommandType];
              return (
                <Card key={command.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      /{command.name}{" "}
                      <span className="text-sm text-slate-400">
                        {meta.emoji} {meta.label}
                      </span>
                    </p>
                    <p className="text-sm text-slate-400">{command.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={command.enabled ? "green" : "slate"}>
                      {command.enabled ? "Activo" : "Desactivado"}
                    </Badge>
                    <Button variant="ghost" onClick={() => setEditing(command)}>
                      Editar
                    </Button>
                    <Button variant="danger" onClick={() => deleteCommand(command.id)}>
                      Borrar
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ) : null}

      {tab === "settings" ? <BotSettings bot={bot} onSaved={load} /> : null}

      {tab === "storage" ? (
        <Card className="space-y-3">
          {entries.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos guardados todavía.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-slate-400">
                <tr>
                  <th className="py-2">Clave</th>
                  <th>Ámbito</th>
                  <th>ID</th>
                  <th>Valor</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-white/5">
                    <td className="py-2 font-mono text-xs">{entry.key}</td>
                    <td>{entry.scope}</td>
                    <td className="font-mono text-xs text-slate-400">{entry.scopeId}</td>
                    <td className="max-w-md truncate">{entry.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}

      {tab === "logs" ? (
        <Card className="space-y-2">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay actividad registrada.</p>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="flex gap-3 border-b border-white/5 py-1.5 text-sm">
                <span className="font-mono text-xs text-slate-500">
                  {new Date(entry.createdAt).toLocaleString("es-ES")}
                </span>
                <span className={entry.level === "error" ? "text-red-300" : "text-slate-200"}>{entry.message}</span>
                {entry.userTag ? <span className="text-slate-500">· {entry.userTag}</span> : null}
              </div>
            ))
          )}
        </Card>
      ) : null}
    </div>
  );
}

function BotSettings({ bot, onSaved }: { bot: SerializedBot; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: bot.name,
    token: "",
    guildId: bot.guildId ?? "",
    logChannelId: bot.logChannelId ?? "",
    autoStart: bot.autoStart,
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save() {
    setError("");
    try {
      await api(`/api/bots/${bot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...form, token: form.token || undefined }),
      });
      setSaved(true);
      setForm({ ...form, token: "" });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function remove() {
    if (!confirm(`¿Eliminar el bot "${bot.name}" y todos sus comandos?`)) return;
    try {
      await api(`/api/bots/${bot.id}`, { method: "DELETE" });
      window.location.href = "/";
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card className="space-y-4">
      {error ? <Alert message={error} /> : null}
      {saved ? <Alert message="Ajustes guardados" tone="success" /> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Token" hint={`Actual: ${bot.tokenPreview}. Déjalo vacío para no cambiarlo.`}>
          <Input
            type="password"
            value={form.token}
            onChange={(e) => setForm({ ...form, token: e.target.value })}
            placeholder="Nuevo token"
          />
        </Field>
        <Field label="ID del servidor" hint="Registro instantáneo de comandos en ese servidor.">
          <Input value={form.guildId} onChange={(e) => setForm({ ...form, guildId: e.target.value })} />
        </Field>
        <Field label="Canal de registro (opcional)">
          <Input value={form.logChannelId} onChange={(e) => setForm({ ...form, logChannelId: e.target.value })} />
        </Field>
      </div>
      <Toggle
        checked={form.autoStart}
        onChange={(autoStart) => setForm({ ...form, autoStart })}
        label="Marcar como bot principal"
      />
      <div className="flex gap-2">
        <Button onClick={save}>Guardar ajustes</Button>
        <Button variant="danger" onClick={remove}>
          Eliminar bot
        </Button>
      </div>
    </Card>
  );
}
