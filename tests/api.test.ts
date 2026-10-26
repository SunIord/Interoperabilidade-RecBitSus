import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  iniciarServidor,
  payloadValido,
  postJson,
  ServidorDeTeste
} from "./helpers";

describe("API HTTP", () => {
  let srv: ServidorDeTeste;

  before(async () => {
    srv = await iniciarServidor();
  });
  after(async () => {
    await srv.fechar();
  });

  const criar = async (alteracoes: Record<string, unknown> = {}) => {
    const res = await postJson(`${srv.url}/bundle`, payloadValido(alteracoes));
    assert.equal(res.status, 201);
    return (await res.json()) as any;
  };

  test("GET / responde que o servidor está no ar", async () => {
    const res = await fetch(`${srv.url}/`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Servidor FHIR/);
  });

  test("GET /health responde ok em JSON", async () => {
    const res = await fetch(`${srv.url}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  test("não expõe o cabeçalho X-Powered-By", async () => {
    const res = await fetch(`${srv.url}/`);
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  // ---------- POST /bundle ----------

  test("POST /bundle devolve 201 e o Bundle completo", async () => {
    const res = await postJson(`${srv.url}/bundle`, payloadValido());
    assert.equal(res.status, 201);
    const b: any = await res.json();
    assert.equal(b.resourceType, "Bundle");
    assert.equal(b.entry.length, 3);
    assert.equal(b.entry[1].resource.subject.reference, b.entry[0].fullUrl);
  });

  test("POST /bundle persiste: o bundle aparece em GET /bundles e /bundle/:id", async () => {
    const b = await criar({ cpf: "11122233344" });
    const lista: any[] = await (await fetch(`${srv.url}/bundles`)).json();
    assert.ok(lista.some((x) => x.id === b.id));
    const um = await fetch(`${srv.url}/bundle/${b.id}`);
    assert.equal(um.status, 200);
    assert.equal(((await um.json()) as any).id, b.id);
  });

  test("POST /bundle com dados inválidos devolve 400 com os detalhes por campo", async () => {
    const res = await postJson(
      `${srv.url}/bundle`,
      payloadValido({ gender: "Masculino", value: "abc", cpf: "1" })
    );
    assert.equal(res.status, 400);
    const corpo: any = await res.json();
    assert.equal(corpo.error, "Dados inválidos");
    assert.deepEqual(
      corpo.detalhes.map((d: any) => d.campo).sort(),
      ["cpf", "gender", "value"]
    );
  });

  test("POST /bundle inválido não grava nada", async () => {
    const antes: any[] = await (await fetch(`${srv.url}/bundles`)).json();
    await postJson(`${srv.url}/bundle`, payloadValido({ gender: "x" }));
    const depois: any[] = await (await fetch(`${srv.url}/bundles`)).json();
    assert.equal(depois.length, antes.length);
  });

  test("POST /bundle com corpo vazio devolve 400, não 500", async () => {
    const res = await postJson(`${srv.url}/bundle`, {});
    assert.equal(res.status, 400);
  });

  test("POST /bundle sem corpo e sem Content-Type devolve 400, não 500", async () => {
    const res = await fetch(`${srv.url}/bundle`, { method: "POST" });
    assert.equal(res.status, 400);
    const corpo: any = await res.json();
    assert.equal(corpo.detalhes[0].campo, "corpo");
  });

  test("POST /bundle com JSON malformado devolve 400 em JSON", async () => {
    const res = await fetch(`${srv.url}/bundle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"cpf": '
    });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as any).error, "JSON malformado");
  });

  test("POST /bundle com lista no lugar de objeto devolve 400", async () => {
    const res = await postJson(`${srv.url}/bundle`, [payloadValido()]);
    assert.equal(res.status, 400);
  });

  test("POST /bundle com corpo grande demais devolve 413", async () => {
    const res = await postJson(`${srv.url}/bundle`, {
      ...payloadValido(),
      lixo: "x".repeat(1_100_000)
    });
    assert.equal(res.status, 413);
  });

  test("POST /bundle ignora campos desconhecidos", async () => {
    const b = await criar({ telefone: "81999999999", admin: true });
    assert.ok(!JSON.stringify(b).includes("81999999999"));
  });

  test("POST /bundle gera ids únicos em requisições simultâneas", async () => {
    const respostas = await Promise.all(
      Array.from({ length: 20 }, () => postJson(`${srv.url}/bundle`, payloadValido()))
    );
    const ids = new Set<string>();
    for (const r of respostas) {
      assert.equal(r.status, 201);
      ids.add(((await r.json()) as any).id);
    }
    assert.equal(ids.size, 20);
    // nenhuma gravação foi perdida
    const lista: any[] = await (await fetch(`${srv.url}/bundles`)).json();
    for (const id of ids) assert.ok(lista.some((x) => x.id === id));
  });

  // ---------- GET /bundle/cpf/:cpf ----------

  test("busca por CPF encontra com e sem pontuação", async () => {
    const b = await criar({ cpf: "987.654.321-00" });
    for (const cpf of ["98765432100", "987.654.321-00"]) {
      const res = await fetch(`${srv.url}/bundle/cpf/${encodeURIComponent(cpf)}`);
      assert.equal(res.status, 200);
      const lista: any[] = (await res.json()) as any[];
      assert.ok(lista.some((x) => x.id === b.id));
    }
  });

  test("busca por CPF devolve todos os bundles do paciente", async () => {
    await criar({ cpf: "55566677788" });
    await criar({ cpf: "555.666.777-88" });
    const lista: any[] = await (await fetch(`${srv.url}/bundle/cpf/55566677788`)).json();
    assert.equal(lista.length, 2);
  });

  test("busca por CPF inexistente devolve 404", async () => {
    const res = await fetch(`${srv.url}/bundle/cpf/00000000000`);
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as any).error, "Nenhum bundle encontrado");
  });

  test("busca por CPF malformado devolve 400", async () => {
    for (const cpf of ["123", "abc", "123456789012"]) {
      const res = await fetch(`${srv.url}/bundle/cpf/${cpf}`);
      assert.equal(res.status, 400, cpf);
    }
  });

  // ---------- GET /bundle/:id ----------

  test("GET /bundle/:id inexistente devolve 404", async () => {
    const res = await fetch(`${srv.url}/bundle/nao-existe`);
    assert.equal(res.status, 404);
  });

  // ---------- DELETE ----------

  test("DELETE remove o bundle e depois devolve 404", async () => {
    const b = await criar({ cpf: "22233344455" });

    const del = await fetch(`${srv.url}/bundle/${b.id}`, { method: "DELETE" });
    assert.equal(del.status, 200);
    assert.deepEqual(await del.json(), { message: "Removido" });

    assert.equal((await fetch(`${srv.url}/bundle/${b.id}`)).status, 404);
    const de_novo = await fetch(`${srv.url}/bundle/${b.id}`, { method: "DELETE" });
    assert.equal(de_novo.status, 404);
  });

  test("DELETE de id inexistente devolve 404", async () => {
    const res = await fetch(`${srv.url}/bundle/nao-existe`, { method: "DELETE" });
    assert.equal(res.status, 404);
  });

  test("DELETE só remove o bundle pedido", async () => {
    const a = await criar({ cpf: "33344455566" });
    const b = await criar({ cpf: "33344455566" });
    await fetch(`${srv.url}/bundle/${a.id}`, { method: "DELETE" });
    const lista: any[] = await (await fetch(`${srv.url}/bundle/cpf/33344455566`)).json();
    assert.deepEqual(lista.map((x) => x.id), [b.id]);
  });

  // ---------- POST /validate ----------

  test("POST /validate aceita o Bundle gerado", async () => {
    const b = await criar();
    const res = await postJson(`${srv.url}/validate`, b);
    assert.equal(res.status, 200);
    const r: any = await res.json();
    assert.equal(r.valido, true);
    assert.deepEqual(r.problemas, []);
  });

  test("POST /validate aponta o problema de um Bundle editado, com status 200", async () => {
    const b = await criar();
    delete b.entry[2].resource.code.coding[0].system;
    const res = await postJson(`${srv.url}/validate`, b);
    assert.equal(res.status, 200);
    const r: any = await res.json();
    assert.equal(r.valido, false);
    assert.deepEqual(r.resumo, { sintaxe: true, estrutura: true, perfil: false });
    assert.equal(r.problemas[0].caminho, "$.entry[2].resource.code.coding[0].system");
  });

  test("POST /validate com JSON malformado é erro de nível 1", async () => {
    const res = await fetch(`${srv.url}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"resourceType": "Bundle",'
    });
    assert.equal(res.status, 400);
    const r: any = await res.json();
    assert.equal(r.valido, false);
    assert.equal(r.resumo.sintaxe, false);
    assert.equal(r.problemas[0].nivel, 1);
  });

  test("POST /validate sem corpo devolve 400 de nível 1", async () => {
    const res = await fetch(`${srv.url}/validate`, { method: "POST" });
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as any).problemas[0].nivel, 1);
  });

  test("POST /validate não grava nada no banco", async () => {
    const antes: any[] = await (await fetch(`${srv.url}/bundles`)).json();
    await postJson(`${srv.url}/validate`, antes[0] ?? { resourceType: "Bundle" });
    const depois: any[] = await (await fetch(`${srv.url}/bundles`)).json();
    assert.equal(depois.length, antes.length);
  });

  // ---------- erros gerais ----------

  test("rota inexistente devolve 404 em JSON", async () => {
    const res = await fetch(`${srv.url}/nada`);
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as any).error, "Rota não encontrada");
  });

  test("banco corrompido: 500 com mensagem clara e arquivo preservado", async () => {
    const original = fs.readFileSync(srv.dbPath, "utf-8");
    fs.writeFileSync(srv.dbPath, "corrompido!");
    try {
      const lista = await fetch(`${srv.url}/bundles`);
      assert.equal(lista.status, 500);
      assert.match(((await lista.json()) as any).error, /ilegível/);

      const post = await postJson(`${srv.url}/bundle`, payloadValido());
      assert.equal(post.status, 500);
      assert.equal(fs.readFileSync(srv.dbPath, "utf-8"), "corrompido!");
    } finally {
      fs.writeFileSync(srv.dbPath, original);
    }
  });

  test("não vaza stack trace em erro interno", async () => {
    fs.writeFileSync(srv.dbPath, "corrompido!");
    try {
      const res = await fetch(`${srv.url}/bundles`);
      assert.ok(!(await res.text()).includes("    at "));
    } finally {
      fs.writeFileSync(srv.dbPath, "[]");
    }
  });
});

describe("CORS", () => {
  test("por padrão libera qualquer origem", async () => {
    const srv = await iniciarServidor();
    try {
      const res = await fetch(`${srv.url}/`, { headers: { Origin: "http://qualquer.com" } });
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
    } finally {
      await srv.fechar();
    }
  });

  test("com CORS_ORIGIN, só a origem listada é liberada", async () => {
    const srv = await iniciarServidor("http://localhost:3000, https://app.exemplo.com");
    try {
      const ok = await fetch(`${srv.url}/`, { headers: { Origin: "http://localhost:3000" } });
      assert.equal(ok.headers.get("access-control-allow-origin"), "http://localhost:3000");

      const nao = await fetch(`${srv.url}/`, { headers: { Origin: "http://malicioso.com" } });
      assert.equal(nao.headers.get("access-control-allow-origin"), null);
    } finally {
      await srv.fechar();
    }
  });

  test("CORS_ORIGIN='*' libera qualquer origem", async () => {
    const srv = await iniciarServidor("*");
    try {
      const res = await fetch(`${srv.url}/`, { headers: { Origin: "http://qualquer.com" } });
      assert.equal(res.headers.get("access-control-allow-origin"), "*");
    } finally {
      await srv.fechar();
    }
  });
});
