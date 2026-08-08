"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, Field, Input, Toggle } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedBot } from "@/server/bots";

export default function DashboardPage() {
  const [bots, setBots] = useState<SerializedBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", token: "", guildId: "", autoStart: false });
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setBots(await api<SerializedBot[]>("/api/bots"));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10000);
    return () => clearInterval(timer);
  }, [load]);

  async function createBot() {
    setBusy("create");
    try {
      await api("/api/bots", { method: "POST", body: JSON.stringify(form) });
      setForm({ name: "", token: "", guildId: "", autoStart: false });
      setShowForm(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function power(botId: string, action: "start" | "stop") {
    setBusy(botId);
    try {
      await api(`/api/bots/${botId}/power`, { method: "POST", body: JSON.stringify({ action }) });
      setError("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Tus bots</h1>
          <p className="text-sm text-slate-400">
            Conecta varios bots y dale a cada uno sus propios comandos personalizados.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancelar" : "+ Conectar bot"}</Button>
      </div>

      {error ? <Alert message={error} /> : null}

      {showForm ? (
        <Card className="space-y-4">
          <h2 className="text-lg font-medium">Conectar un bot nuevo</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nombre">
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mi bot de comunidad"
              />
            </Field>
            <Field label="Token del bot" hint="Se guarda cifrado (AES-256-GCM) con tu APP_SECRET.">
              <Input
                type="password"
                value={form.token}
                onChange={(e) => setForm({ ...form, token: e.target.value })}
                placeholder="MTA5..."
              />
            </Field>
            <Field
              label="ID del servidor (opcional)"
              hint="Si lo indicas, los comandos se registran al instante solo en ese servidor."
            >
              <Input
                value={form.guildId}
                onChange={(e) => setForm({ ...form, guildId: e.target.value })}
                placeholder="123456789012345678"
              />
            </Field>
            <div className="flex items-end">
              <Toggle
                checked={form.autoStart}
                onChange={(autoStart) => setForm({ ...form, autoStart })}
                label="Marcar como bot principal"
              />
            </div>
          </div>
          <Button onClick={createBot} disabled={busy === "create" || !form.name || !form.token}>
            {busy === "create" ? "Guardando..." : "Guardar bot"}
          </Button>
        </Card>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-400">Cargando...</p>
      ) : bots.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-300">
            Todavía no hay bots. Crea una aplicación en el portal de Discord, copia el token del bot y pulsa
            <strong> Conectar bot</strong>.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bots.map((bot) => (
            <Card key={bot.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/bots/${bot.id}`} className="text-lg font-medium hover:text-indigo-300">
                    {bot.name}
                  </Link>
                  <p className="font-mono text-xs text-slate-500">{bot.tokenPreview}</p>
                </div>
                <Badge tone={bot.status.running ? "green" : "slate"}>
                  {bot.status.running ? `En línea${bot.status.username ? ` · ${bot.status.username}` : ""}` : "Apagado"}
                </Badge>
              </div>
              <p className="text-sm text-slate-400">{bot.commandCount ?? 0} comandos configurados</p>
              <div className="flex flex-wrap gap-2">
                {bot.status.running ? (
                  <Button variant="danger" onClick={() => power(bot.id, "stop")} disabled={busy === bot.id}>
                    Apagar
                  </Button>
                ) : (
                  <Button variant="success" onClick={() => power(bot.id, "start")} disabled={busy === bot.id}>
                    Encender
                  </Button>
                )}
                <Link href={`/bots/${bot.id}`}>
                  <Button variant="ghost">Administrar comandos</Button>
                </Link>
              </div>
              {bot.status.error ? <Alert message={bot.status.error} /> : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
