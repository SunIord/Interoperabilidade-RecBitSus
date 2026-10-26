import axios, { AxiosError, AxiosHeaders } from "axios";
import {
  enviarAoSandbox,
  ErroSandbox,
  lerLocalizacao,
  paraTransacao,
  SANDBOX_URL
} from "./sandbox";

const bundle = {
  resourceType: "Bundle",
  id: "abc",
  type: "collection",
  entry: [
    {
      fullUrl: "urn:uuid:11111111-1111-4111-8111-111111111111",
      resource: { resourceType: "Patient", id: "p1" }
    },
    {
      fullUrl: "urn:uuid:22222222-2222-4222-8222-222222222222",
      resource: {
        resourceType: "Observation",
        id: "o1",
        subject: { reference: "urn:uuid:11111111-1111-4111-8111-111111111111" }
      }
    }
  ]
};

afterEach(() => jest.restoreAllMocks());

// ---------- conversão para transaction ----------

test("vira uma transaction com um POST por recurso, na mesma ordem", () => {
  const t: any = paraTransacao(bundle);
  expect(t.resourceType).toBe("Bundle");
  expect(t.type).toBe("transaction");
  expect(t.entry.map((e: any) => e.request)).toEqual([
    { method: "POST", url: "Patient" },
    { method: "POST", url: "Observation" }
  ]);
});

test("mantém o fullUrl e as referências urn:uuid (é por eles que o servidor liga os recursos)", () => {
  const t: any = paraTransacao(bundle);
  expect(t.entry[0].fullUrl).toBe("urn:uuid:11111111-1111-4111-8111-111111111111");
  expect(t.entry[1].resource.subject.reference).toBe(
    "urn:uuid:11111111-1111-4111-8111-111111111111"
  );
});

test("não altera o Bundle original", () => {
  const copia = JSON.parse(JSON.stringify(bundle));
  paraTransacao(bundle);
  expect(bundle).toEqual(copia);
});

test("o id do Bundle não vai na transaction", () => {
  expect((paraTransacao(bundle) as any).id).toBeUndefined();
});

test("entrada sem fullUrl é aceita (o servidor é quem aponta o problema)", () => {
  const t: any = paraTransacao({
    resourceType: "Bundle",
    entry: [{ resource: { resourceType: "Patient" } }]
  });
  expect("fullUrl" in t.entry[0]).toBe(false);
});

test.each([
  ["nulo", null],
  ["texto", "x"],
  ["lista", []],
  ["outro recurso", { resourceType: "Patient" }],
  ["sem entry", { resourceType: "Bundle" }],
  ["entry vazia", { resourceType: "Bundle", entry: [] }],
  ["entry que não é lista", { resourceType: "Bundle", entry: {} }],
  ["entrada nula", { resourceType: "Bundle", entry: [null] }],
  ["entrada sem resource", { resourceType: "Bundle", entry: [{ fullUrl: "x" }] }],
  ["resource sem resourceType", { resourceType: "Bundle", entry: [{ resource: {} }] }]
])("rejeita Bundle inválido: %s", (_nome, entrada) => {
  expect(() => paraTransacao(entrada)).toThrow(ErroSandbox);
});

test("a mensagem de erro diz qual entrada está errada", () => {
  expect(() =>
    paraTransacao({ resourceType: "Bundle", entry: [bundle.entry[0], { resource: {} }] })
  ).toThrow(/entrada 1/);
});

// ---------- leitura da resposta ----------

test("lerLocalizacao extrai tipo, id e o endereço no servidor", () => {
  expect(lerLocalizacao("Patient/123/_history/1")).toEqual({
    tipo: "Patient",
    id: "123",
    url: `${SANDBOX_URL}/Patient/123`
  });
  expect(lerLocalizacao("Observation/9f-2.a")?.id).toBe("9f-2.a");
  expect(lerLocalizacao("https://hapi.fhir.org/baseR4/Condition/77/_history/2")?.tipo).toBe(
    "Condition"
  );
});

test("lerLocalizacao devolve nulo para valores inúteis", () => {
  for (const v of [undefined, null, 5, "", "lixo", "Patient"]) {
    expect(lerLocalizacao(v)).toBeNull();
  }
});

// ---------- envio ----------

const respostaHttp = (status: number, data: unknown) =>
  new AxiosError("falhou", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() }
  });

test("envia a transaction ao servidor com o tipo de conteúdo FHIR", async () => {
  const post = jest.spyOn(axios, "post").mockResolvedValue({ data: { entry: [] } });
  await enviarAoSandbox(bundle);

  expect(post).toHaveBeenCalledTimes(1);
  const [url, corpo, config] = post.mock.calls[0] as any[];
  expect(url).toBe(SANDBOX_URL);
  expect(corpo.type).toBe("transaction");
  expect(config.headers["Content-Type"]).toBe("application/fhir+json");
});

test("devolve os recursos criados, lidos da resposta da transaction", async () => {
  jest.spyOn(axios, "post").mockResolvedValue({
    data: {
      resourceType: "Bundle",
      type: "transaction-response",
      entry: [
        { response: { status: "201 Created", location: "Patient/501/_history/1" } },
        { response: { status: "201 Created", location: "Observation/502/_history/1" } }
      ]
    }
  });
  const criados = await enviarAoSandbox(bundle);
  expect(criados.map((c) => `${c.tipo}/${c.id}`)).toEqual(["Patient/501", "Observation/502"]);
  expect(criados[0].url).toBe(`${SANDBOX_URL}/Patient/501`);
});

test("resposta sem entradas legíveis devolve lista vazia", async () => {
  jest.spyOn(axios, "post").mockResolvedValue({ data: "ok" });
  expect(await enviarAoSandbox(bundle)).toEqual([]);
});

test("Bundle inválido nem chega à rede", async () => {
  const post = jest.spyOn(axios, "post");
  await expect(enviarAoSandbox({ resourceType: "Patient" })).rejects.toThrow(ErroSandbox);
  expect(post).not.toHaveBeenCalled();
});

test("recusa do servidor traz os textos do OperationOutcome", async () => {
  jest.spyOn(axios, "post").mockRejectedValue(
    respostaHttp(400, {
      resourceType: "OperationOutcome",
      issue: [
        { severity: "error", code: "invalid", diagnostics: "Referência inválida" },
        { severity: "error", code: "required", details: { text: "Falta o campo X" } },
        { severity: "error", code: "processing" }
      ]
    })
  );
  const erro = await enviarAoSandbox(bundle).catch((e) => e);
  expect(erro).toBeInstanceOf(ErroSandbox);
  expect(erro.message).toMatch(/recusou o envio \(erro 400\)/);
  expect(erro.problemas).toEqual(["Referência inválida", "Falta o campo X", "processing"]);
});

test("recusa sem OperationOutcome ainda gera erro claro, sem problemas", async () => {
  jest.spyOn(axios, "post").mockRejectedValue(respostaHttp(500, "<html>"));
  const erro = await enviarAoSandbox(bundle).catch((e) => e);
  expect(erro.message).toMatch(/erro 500/);
  expect(erro.problemas).toEqual([]);
});

test("servidor de testes fora do ar", async () => {
  jest.spyOn(axios, "post").mockRejectedValue(new AxiosError("Network Error", "ERR_NETWORK"));
  await expect(enviarAoSandbox(bundle)).rejects.toThrow(/Não foi possível conectar ao servidor de testes/);
});

test("erro que não é do axios vira erro inesperado", async () => {
  jest.spyOn(axios, "post").mockRejectedValue(new Error("boom"));
  await expect(enviarAoSandbox(bundle)).rejects.toThrow(/inesperado/);
});
