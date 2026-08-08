import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T) {
  return NextResponse.json(data);
}

export function fail(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues.map((i) => `${i.path.join(".") || "campo"}: ${i.message}`).join(" · ") },
      { status },
    );
  }
  const message = error instanceof Error ? error.message : "Error inesperado";
  return NextResponse.json({ error: message }, { status });
}
