import test, { after, before, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  criarPastaTemporaria,
  iniciarServidor,
  payloadValido,
  postJson,
  ServidorDeTeste
} from "./helpers";

// Simula o frontend compilado (frontend/build) numa pasta temporária.
function criarFrontendFalso(): string {
  const pasta = criarPastaTemporaria();
  fs.mkdirSync(path.join(pasta, "static", "js"), { recursive: true });
  fs.writeFileSync(path.join(pasta, "index.html"), "<!doctype html><title>Simulador FHIR</title>");
  fs.writeFileSync(path.join(pasta, "static", "js", "main.abc123.js"), "console.log('ok')");
  fs.writeFileSync(path.join(pasta, "favicon.ico"), "ico");
  fs.writeFileSync(path.join(pasta, "..", `${path.basename(pasta)}-segredo.txt`), "segredo");
  return pasta;
}

describe("servindo o frontend junto da API", () => {
  let srv: ServidorDeTeste;
  let pasta: string;

  before(async () => {
    pasta = criarFrontendFalso();
    srv = await iniciarServidor(undefined, pasta);
  });
  after(async () => {
    await srv.fechar();
    fs.rmSync(pasta, { recursive: true, force: true });
    fs.rmSync(`${pasta}-segredo.txt`, { force: true });
  });

  test("a raiz devolve o index.html, não o texto da API", async () => {
    const res = await fetch(`${srv.url}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await res.text(), /Simulador FHIR/);
  });

  test("o index.html nunca fica em cache (deploy novo aparece logo)", async () => {
    const res = await fetch(`${srv.url}/`);
    assert.equal(res.headers.get("cache-control"), "no-cache");
  });

  test("arquivos de /static têm cache longo e imutável", async () => {
    const res = await fetch(`${srv.url}/static/js/main.abc123.js`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /javascript/);
    assert.match(res.headers.get("cache-control") ?? "", /max-age=31536000.*immutable/);
  });

  test("arquivos fora de /static são servidos sem cache imutável", async () => {
    const res = await fetch(`${srv.url}/favicon.ico`);
    assert.equal(res.status, 200);
    assert.ok(!(res.headers.get("cache-control") ?? "").includes("immutable"));
  });

  test("a API continua funcionando na mesma origem", async () => {
    const criado = await postJson(`${srv.url}/bundle`, payloadValido());
    assert.equal(criado.status, 201);
    const b: any = await criado.json();
    assert.equal((await fetch(`${srv.url}/bundle/${b.id}`)).status, 200);
    assert.equal((await fetch(`${srv.url}/bundles`)).status, 200);
    const v = await postJson(`${srv.url}/validate`, b);
    assert.equal(((await v.json()) as any).valido, true);
  });

  test("/health continua respondendo", async () => {
    assert.deepEqual(await (await fetch(`${srv.url}/health`)).json(), { status: "ok" });
  });

  test("rota inexistente continua devolvendo 404 em JSON", async () => {
    const res = await fetch(`${srv.url}/nao-existe`);
    assert.equal(res.status, 404);
    assert.equal(((await res.json()) as any).error, "Rota não encontrada");
  });

  test("não entrega arquivos de fora da pasta (path traversal)", async () => {
    const nome = `${path.basename(pasta)}-segredo.txt`;
    for (const caminho of [`/../${nome}`, `/%2e%2e/${nome}`, `/..%2f${nome}`, `/static/../../${nome}`]) {
      const res = await fetch(`${srv.url}${caminho}`);
      assert.ok(!(await res.text()).includes("segredo"), caminho);
    }
  });

  test("POST em um caminho do frontend não é tratado como arquivo", async () => {
    const res = await postJson(`${srv.url}/index.html`, {});
    assert.equal(res.status, 404);
  });
});

describe("sem frontend compilado", () => {
  test("a raiz volta a ser o texto da API", async () => {
    const srv = await iniciarServidor();
    try {
      assert.match(await (await fetch(`${srv.url}/`)).text(), /Servidor FHIR/);
    } finally {
      await srv.fechar();
    }
  });

  test("pasta informada mas sem index.html: ignora e não quebra", async () => {
    const vazia = criarPastaTemporaria();
    const srv = await iniciarServidor(undefined, vazia);
    try {
      assert.match(await (await fetch(`${srv.url}/`)).text(), /Servidor FHIR/);
      assert.equal((await fetch(`${srv.url}/bundles`)).status, 200);
    } finally {
      await srv.fechar();
      fs.rmSync(vazia, { recursive: true, force: true });
    }
  });

  test("pasta que nem existe: ignora e não quebra", async () => {
    const srv = await iniciarServidor(undefined, "/caminho/que/nao/existe");
    try {
      assert.equal((await fetch(`${srv.url}/health`)).status, 200);
    } finally {
      await srv.fechar();
    }
  });
});
