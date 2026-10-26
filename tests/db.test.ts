import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { Banco, BancoError } from "../backend/db";
import { generateFHIRBundle, BundleInput } from "../backend/fhir";
import { criarPastaTemporaria, payloadValido } from "./helpers";

function bundle() {
  return generateFHIRBundle(payloadValido() as unknown as BundleInput);
}

function novoBanco() {
  const pasta = criarPastaTemporaria();
  const arquivo = path.join(pasta, "sub", "bundles.json");
  return { pasta, arquivo, banco: new Banco(arquivo) };
}

test("cria o arquivo (e a pasta) vazio se não existir", () => {
  const { pasta, arquivo, banco } = novoBanco();
  assert.equal(fs.readFileSync(arquivo, "utf-8"), "[]");
  assert.deepEqual(banco.listar(), []);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("não apaga um arquivo existente ao iniciar", () => {
  const { pasta, arquivo, banco } = novoBanco();
  banco.inserir(bundle());
  const outro = new Banco(arquivo);
  assert.equal(outro.listar().length, 1);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("insere, lista e busca por id", () => {
  const { pasta, banco } = novoBanco();
  const a = bundle();
  const b = bundle();
  banco.inserir(a);
  banco.inserir(b);
  assert.deepEqual(banco.listar().map((x) => x.id), [a.id, b.id]);
  assert.equal(banco.buscarPorId(b.id)?.id, b.id);
  assert.equal(banco.buscarPorId("inexistente"), undefined);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("remove só o bundle pedido e informa se existia", () => {
  const { pasta, banco } = novoBanco();
  const a = bundle();
  const b = bundle();
  banco.inserir(a);
  banco.inserir(b);
  assert.equal(banco.remover(a.id), true);
  assert.deepEqual(banco.listar().map((x) => x.id), [b.id]);
  assert.equal(banco.remover(a.id), false);
  assert.equal(banco.listar().length, 1);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("os dados persistem entre instâncias", () => {
  const { pasta, arquivo, banco } = novoBanco();
  const a = bundle();
  banco.inserir(a);
  assert.equal(new Banco(arquivo).listar()[0].id, a.id);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("arquivo corrompido: falha de forma visível e NÃO sobrescreve", () => {
  const { pasta, arquivo, banco } = novoBanco();
  fs.writeFileSync(arquivo, "{ isto não é json");

  assert.throws(() => banco.listar(), BancoError);
  assert.throws(() => banco.inserir(bundle()), BancoError);
  assert.throws(() => banco.remover("x"), BancoError);

  assert.equal(fs.readFileSync(arquivo, "utf-8"), "{ isto não é json");
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("arquivo com JSON que não é lista é rejeitado sem sobrescrever", () => {
  const { pasta, arquivo, banco } = novoBanco();
  fs.writeFileSync(arquivo, '{"a":1}');
  assert.throws(() => banco.listar(), /formato inesperado/);
  assert.throws(() => banco.inserir(bundle()), BancoError);
  assert.equal(fs.readFileSync(arquivo, "utf-8"), '{"a":1}');
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("arquivo vazio é tratado como banco vazio", () => {
  const { pasta, arquivo, banco } = novoBanco();
  fs.writeFileSync(arquivo, "  \n");
  assert.deepEqual(banco.listar(), []);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("a gravação não deixa arquivo temporário para trás", () => {
  const { pasta, arquivo, banco } = novoBanco();
  banco.inserir(bundle());
  assert.deepEqual(fs.readdirSync(path.dirname(arquivo)), ["bundles.json"]);
  fs.rmSync(pasta, { recursive: true, force: true });
});

test("o arquivo gravado é JSON válido e legível", () => {
  const { pasta, arquivo, banco } = novoBanco();
  banco.inserir(bundle());
  const lido = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
  assert.equal(lido[0].resourceType, "Bundle");
  fs.rmSync(pasta, { recursive: true, force: true });
});
