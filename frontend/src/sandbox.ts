import axios from "axios";

// Envio opcional do Bundle a um servidor FHIR público de testes (HAPI, R4).
// É um servidor aberto: tudo o que for enviado fica visível a qualquer pessoa.
export const SANDBOX_URL = (
  process.env.REACT_APP_FHIR_SANDBOX_URL || "https://hapi.fhir.org/baseR4"
).replace(/\/+$/, "");

export class ErroSandbox extends Error {
  constructor(mensagem: string, public problemas: string[] = []) {
    super(mensagem);
  }
}

export interface RecursoCriado {
  tipo: string;
  id: string;
  // Endereço para consultar o recurso no servidor de testes.
  url: string;
}

type Obj = Record<string, unknown>;

const ehObjeto = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);

// Um Bundle "collection" não pode ser enviado como está a um servidor: o FHIR
// só processa a gravação em lote como "transaction", em que cada entrada diz
// o que fazer (request). Na transaction, o servidor atribui os ids e troca as
// referências "urn:uuid:..." pelos endereços novos, usando o fullUrl. Por isso
// o fullUrl é mantido.
export function paraTransacao(bundle: unknown): Obj {
  if (!ehObjeto(bundle) || bundle.resourceType !== "Bundle") {
    throw new ErroSandbox('O JSON precisa ser um Bundle (resourceType "Bundle").');
  }
  if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    throw new ErroSandbox('O Bundle precisa ter uma lista "entry" com recursos.');
  }

  const entry = bundle.entry.map((e, i) => {
    const recurso = ehObjeto(e) ? e.resource : undefined;
    if (
      !ehObjeto(recurso) ||
      typeof recurso.resourceType !== "string" ||
      recurso.resourceType === ""
    ) {
      throw new ErroSandbox(
        `A entrada ${i} não tem um "resource" com "resourceType".`
      );
    }
    const item: Obj = {
      resource: recurso,
      request: { method: "POST", url: recurso.resourceType }
    };
    if (typeof (e as Obj).fullUrl === "string") {
      item.fullUrl = (e as Obj).fullUrl;
    }
    return item;
  });

  return { resourceType: "Bundle", type: "transaction", entry };
}

// "Patient/123/_history/1" -> { tipo: "Patient", id: "123" }
export function lerLocalizacao(location: unknown): RecursoCriado | null {
  if (typeof location !== "string") return null;
  const m = /(?:^|\/)([A-Za-z]+)\/([A-Za-z0-9\-.]+)(?:\/_history\/[^/]+)?$/.exec(
    location
  );
  if (!m) return null;
  return { tipo: m[1], id: m[2], url: `${SANDBOX_URL}/${m[1]}/${m[2]}` };
}

// Textos de um OperationOutcome (a forma como o FHIR devolve erros).
function problemasDoServidor(data: unknown): string[] {
  if (!ehObjeto(data) || !Array.isArray(data.issue)) return [];
  return data.issue
    .filter(ehObjeto)
    .map((i) => {
      const detalhe = ehObjeto(i.details) ? i.details.text : undefined;
      return String(i.diagnostics ?? detalhe ?? i.code ?? "Erro sem descrição.");
    });
}

export async function enviarAoSandbox(bundle: unknown): Promise<RecursoCriado[]> {
  const transacao = paraTransacao(bundle);

  try {
    const res = await axios.post(SANDBOX_URL, transacao, {
      headers: { "Content-Type": "application/fhir+json" }
    });
    const entradas: unknown[] = Array.isArray(res.data?.entry) ? res.data.entry : [];
    return entradas
      .map((e) => (ehObjeto(e) && ehObjeto(e.response) ? lerLocalizacao(e.response.location) : null))
      .filter((r): r is RecursoCriado => r !== null);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (!err.response) {
        throw new ErroSandbox(
          `Não foi possível conectar ao servidor de testes (${SANDBOX_URL}).`
        );
      }
      throw new ErroSandbox(
        `O servidor de testes recusou o envio (erro ${err.response.status}).`,
        problemasDoServidor(err.response.data)
      );
    }
    throw new ErroSandbox("Erro inesperado ao enviar ao servidor de testes.");
  }
}
