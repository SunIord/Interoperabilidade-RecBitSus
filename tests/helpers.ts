import fs from "fs";
import os from "os";
import path from "path";
import type { AddressInfo } from "net";
import type { Server } from "http";
import { createApp } from "../backend/app";

// Payload válido do POST /bundle. Datas fixas e passadas para os testes
// não dependerem do relógio.
export function payloadValido(
  alteracoes: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    cpf: "12345678910",
    given: ["Maria", "Aparecida"],
    family: "Silva",
    gender: "female",
    birthDate: "1985-03-21",
    observacao: "temperatura",
    status: "final",
    value: 38.5,
    effectiveDateTime: "2024-05-10T09:30",
    condicao: "febre",
    clinicalStatus: "active",
    recordedDate: "2024-05-10",
    ...alteracoes
  };
}

export function criarPastaTemporaria(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "recbitsus-"));
}

export interface ServidorDeTeste {
  url: string;
  dbPath: string;
  fechar: () => Promise<void>;
}

export async function iniciarServidor(
  corsOrigin?: string,
  staticDir?: string
): Promise<ServidorDeTeste> {
  const pasta = criarPastaTemporaria();
  const dbPath = path.join(pasta, "bundles.json");
  const app = createApp({ dbPath, corsOrigin, staticDir });

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    dbPath,
    fechar: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(pasta, { recursive: true, force: true });
    }
  };
}

export async function postJson(url: string, corpo: unknown) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo)
  });
}
