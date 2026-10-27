import test from "node:test";
import assert from "node:assert/strict";
import { CONDICOES, OBSERVACOES } from "../backend/catalogo";
import { BundleInput, generateFHIRBundle, Observation } from "../backend/fhir";
import { validarEntrada } from "../backend/validacao";
import { validarBundle } from "../backend/validador";
import * as frontend from "../frontend/src/catalogo";
import { payloadValido } from "./helpers";

// ---------- cada item do catálogo gera um Bundle válido ----------

for (const [chave, obs] of Object.entries(OBSERVACOES)) {
  test(`observação "${chave}": gera Bundle que passa no /validate`, () => {
    const entrada = validarEntrada(
      payloadValido({ observacao: chave, value: obs.faixa.min })
    );
    assert.ok(entrada.ok, JSON.stringify(entrada));

    const b = generateFHIRBundle(entrada.data);
    const o = b.entry[1].resource as Observation;
    assert.deepEqual(o.code.coding, [obs.coding]);
    assert.equal(o.valueQuantity.code, obs.unit.code);
    assert.deepEqual(validarBundle(b).problemas, []);
  });

  test(`observação "${chave}": recusa valor fora da faixa`, () => {
    const r = validarEntrada(
      payloadValido({ observacao: chave, value: obs.faixa.max + 1 })
    );
    assert.ok(!r.ok);
    assert.deepEqual(r.erros.map((e) => e.campo), ["value"]);
  });
}

for (const [chave, cond] of Object.entries(CONDICOES)) {
  test(`condição "${chave}": gera Bundle que passa no /validate`, () => {
    const b = generateFHIRBundle({
      ...(payloadValido() as unknown as BundleInput),
      condicao: chave
    });
    const c = b.entry[2].resource as { code: { coding: unknown[] } };
    assert.deepEqual(c.code.coding, [cond.coding]);
    assert.deepEqual(validarBundle(b).problemas, []);
  });
}

// ---------- o catálogo do frontend é uma cópia: precisa acompanhar ----------

test("frontend oferece exatamente as observações do backend, com a mesma unidade", () => {
  assert.deepEqual(
    frontend.OBSERVACOES.map((o) => [o.valor, o.unidade]),
    Object.entries(OBSERVACOES).map(([chave, o]) => [chave, o.unit.unit])
  );
});

test("frontend oferece exatamente as condições do backend", () => {
  assert.deepEqual(
    frontend.CONDICOES.map((c) => c.valor),
    Object.keys(CONDICOES)
  );
});

test("rótulos do frontend mostram o código do catálogo", () => {
  for (const o of frontend.OBSERVACOES) {
    assert.ok(o.rotulo.includes(OBSERVACOES[o.valor].coding.code), o.valor);
  }
  for (const c of frontend.CONDICOES) {
    assert.ok(c.rotulo.includes(CONDICOES[c.valor].coding.code), c.valor);
  }
});
