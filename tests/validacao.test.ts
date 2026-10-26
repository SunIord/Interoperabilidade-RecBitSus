import test from "node:test";
import assert from "node:assert/strict";
import {
  dataHoraReal,
  dataReal,
  normalizarCpf,
  validarEntrada
} from "../backend/validacao";
import { payloadValido } from "./helpers";

function campos(corpo: unknown): string[] {
  const r = validarEntrada(corpo);
  return r.ok ? [] : r.erros.map((e) => e.campo);
}

function mensagem(corpo: unknown, campo: string): string {
  const r = validarEntrada(corpo);
  assert.ok(!r.ok, "deveria ser inválido");
  return r.erros.find((e) => e.campo === campo)?.mensagem ?? "";
}

test("payload válido é aceito e normalizado", () => {
  const r = validarEntrada(
    payloadValido({ cpf: "123.456.789-10", given: "  Maria ", family: " Silva  ", value: "38.5" })
  );
  assert.ok(r.ok);
  assert.equal(r.data.cpf, "12345678910");
  assert.deepEqual(r.data.given, ["Maria"]);
  assert.equal(r.data.family, "Silva");
  assert.equal(r.data.value, 38.5);
});

test("corpo ausente ou que não é objeto é rejeitado", () => {
  for (const corpo of [undefined, null, "texto", 42, [], [payloadValido()]]) {
    assert.deepEqual(campos(corpo), ["corpo"]);
  }
});

test("corpo vazio acusa todos os campos obrigatórios de uma vez", () => {
  assert.deepEqual(campos({}).sort(), [
    "birthDate",
    "clinicalStatus",
    "condicao",
    "cpf",
    "effectiveDateTime",
    "family",
    "gender",
    "given",
    "observacao",
    "recordedDate",
    "status",
    "value"
  ]);
});

for (const campo of Object.keys(payloadValido())) {
  test(`campo obrigatório ausente: ${campo}`, () => {
    const corpo = payloadValido();
    delete corpo[campo];
    assert.deepEqual(campos(corpo), [campo]);
  });
}

test("campos vazios ou só com espaços são rejeitados", () => {
  for (const campo of ["cpf", "family", "gender", "birthDate", "status"]) {
    assert.deepEqual(campos(payloadValido({ [campo]: "   " })), [campo], campo);
    assert.deepEqual(campos(payloadValido({ [campo]: "" })), [campo], campo);
    assert.deepEqual(campos(payloadValido({ [campo]: null })), [campo], campo);
  }
});

test("campos de texto com tipo errado são rejeitados", () => {
  assert.deepEqual(campos(payloadValido({ family: 123 })), ["family"]);
  assert.deepEqual(campos(payloadValido({ gender: ["female"] })), ["gender"]);
  assert.deepEqual(campos(payloadValido({ cpf: 12345678910 })), ["cpf"]);
});

// ---------- CPF ----------

test("CPF: aceita com e sem pontuação", () => {
  for (const cpf of ["12345678910", "123.456.789-10", " 123.456.789-10 "]) {
    assert.deepEqual(campos(payloadValido({ cpf })), [], cpf);
  }
});

test("CPF: rejeita tamanho errado e caracteres inválidos", () => {
  for (const cpf of ["123", "123456789101", "abcdefghijk", "1234567891a", "123 456"]) {
    assert.deepEqual(campos(payloadValido({ cpf })), ["cpf"], cpf);
  }
});

test("normalizarCpf remove tudo que não é dígito", () => {
  assert.equal(normalizarCpf("123.456.789-10"), "12345678910");
});

// ---------- nome ----------

test("given: aceita texto ou lista, rejeita vazio e tipos errados", () => {
  assert.deepEqual(campos(payloadValido({ given: "Maria" })), []);
  assert.deepEqual(campos(payloadValido({ given: ["Maria", "Ana"] })), []);
  assert.deepEqual(campos(payloadValido({ given: [] })), ["given"]);
  assert.deepEqual(campos(payloadValido({ given: [""] })), ["given"]);
  assert.deepEqual(campos(payloadValido({ given: ["Maria", " "] })), ["given"]);
  assert.deepEqual(campos(payloadValido({ given: [1, 2] })), ["given"]);
  assert.deepEqual(campos(payloadValido({ given: { a: 1 } })), ["given"]);
});

test("nomes têm limite de tamanho e de quantidade", () => {
  const longo = "a".repeat(101);
  assert.deepEqual(campos(payloadValido({ family: longo })), ["family"]);
  assert.deepEqual(campos(payloadValido({ given: [longo] })), ["given"]);
  assert.deepEqual(campos(payloadValido({ given: Array(11).fill("a") })), ["given"]);
});

// ---------- gender / status / clinicalStatus ----------

test("gender: só aceita o value set do FHIR", () => {
  for (const g of ["female", "male", "other", "unknown"]) {
    assert.deepEqual(campos(payloadValido({ gender: g })), [], g);
  }
  for (const g of ["Masculino", "F", "2", "FEMALE"]) {
    assert.deepEqual(campos(payloadValido({ gender: g })), ["gender"], g);
  }
});

test("status e clinicalStatus: só aceitam o value set do FHIR", () => {
  for (const s of ["registered", "preliminary", "final", "amended"]) {
    assert.deepEqual(campos(payloadValido({ status: s })), [], s);
  }
  assert.deepEqual(campos(payloadValido({ status: "pronto" })), ["status"]);
  for (const s of ["active", "inactive", "remission", "resolved"]) {
    assert.deepEqual(campos(payloadValido({ clinicalStatus: s })), [], s);
  }
  assert.deepEqual(campos(payloadValido({ clinicalStatus: "ativo" })), ["clinicalStatus"]);
});

test("mensagem de value set lista os valores aceitos", () => {
  assert.match(mensagem(payloadValido({ gender: "Masculino" }), "gender"), /female, male, other, unknown/);
});

// ---------- datas ----------

test("dataReal rejeita datas inexistentes", () => {
  assert.ok(dataReal("2024-02-29"));
  assert.ok(!dataReal("2023-02-29"));
  assert.ok(!dataReal("2024-13-01"));
  assert.ok(!dataReal("2024-04-31"));
  assert.ok(!dataReal("03/04/2026"));
  assert.ok(!dataReal("2024-1-1"));
  assert.ok(!dataReal(""));
});

test("dataHoraReal valida formato, hora e fuso", () => {
  assert.ok(dataHoraReal("2024-05-10T09:30"));
  assert.ok(dataHoraReal("2024-05-10T09:30:15"));
  assert.ok(dataHoraReal("2024-05-10T09:30:00-03:00"));
  assert.ok(dataHoraReal("2024-05-10T09:30:00Z"));
  assert.ok(dataHoraReal("2024-05-10T09:30:00.123Z"));
  assert.ok(!dataHoraReal("2024-05-10"));
  assert.ok(!dataHoraReal("2024-05-10T25:00"));
  assert.ok(!dataHoraReal("2024-05-10T09:61"));
  assert.ok(!dataHoraReal("2024-02-30T09:30"));
  assert.ok(!dataHoraReal("2024-05-10T09:30:00-25:00"));
  assert.ok(!dataHoraReal("ontem"));
});

test("birthDate: rejeita formato inválido, data inexistente e futuro", () => {
  assert.deepEqual(campos(payloadValido({ birthDate: "21/03/1985" })), ["birthDate"]);
  assert.deepEqual(campos(payloadValido({ birthDate: "1985-02-30" })), ["birthDate"]);
  assert.match(mensagem(payloadValido({ birthDate: "2999-01-01" }), "birthDate"), /futuro/);
});

test("effectiveDateTime: rejeita inválido, futuro e anterior ao nascimento", () => {
  assert.deepEqual(campos(payloadValido({ effectiveDateTime: "2024-05-10" })), ["effectiveDateTime"]);
  assert.match(
    mensagem(payloadValido({ effectiveDateTime: "2999-01-01T10:00" }), "effectiveDateTime"),
    /futuro/
  );
  assert.match(
    mensagem(payloadValido({ effectiveDateTime: "1980-01-01T10:00" }), "effectiveDateTime"),
    /anterior ao nascimento/
  );
});

test("effectiveDateTime aceita fuso explícito", () => {
  assert.deepEqual(campos(payloadValido({ effectiveDateTime: "2024-05-10T09:30:00-03:00" })), []);
});

test("recordedDate: rejeita inválida, futura e anterior ao nascimento", () => {
  assert.deepEqual(campos(payloadValido({ recordedDate: "10/05/2024" })), ["recordedDate"]);
  assert.match(mensagem(payloadValido({ recordedDate: "2999-01-01" }), "recordedDate"), /futuro/);
  assert.match(
    mensagem(payloadValido({ recordedDate: "1980-01-01" }), "recordedDate"),
    /anterior ao nascimento/
  );
});

// ---------- valor ----------

test("value: aceita número e texto numérico", () => {
  assert.deepEqual(campos(payloadValido({ value: 37 })), []);
  assert.deepEqual(campos(payloadValido({ value: "37,5".replace(",", ".") })), []);
});

test("value: rejeita não numérico, vazio e tipos errados", () => {
  for (const v of ["abc", "", "  ", null, true, [], {}, "NaN", "Infinity"]) {
    assert.deepEqual(campos(payloadValido({ value: v })), ["value"], JSON.stringify(v));
  }
  assert.deepEqual(campos(payloadValido({ value: NaN })), ["value"]);
});

test("value: respeita a faixa plausível da temperatura (25 a 45 °C)", () => {
  assert.deepEqual(campos(payloadValido({ value: 25 })), []);
  assert.deepEqual(campos(payloadValido({ value: 45 })), []);
  assert.deepEqual(campos(payloadValido({ value: 24.9 })), ["value"]);
  assert.deepEqual(campos(payloadValido({ value: 45.1 })), ["value"]);
  assert.deepEqual(campos(payloadValido({ value: 385 })), ["value"]);
  assert.match(mensagem(payloadValido({ value: 385 }), "value"), /faixa plausível/);
});

// ---------- catálogo ----------

test("observacao e condicao: só aceitam chaves do catálogo", () => {
  assert.deepEqual(campos(payloadValido({ observacao: "glicose" })), ["observacao"]);
  assert.deepEqual(campos(payloadValido({ condicao: "gripe" })), ["condicao"]);
  assert.match(mensagem(payloadValido({ observacao: "glicose" }), "observacao"), /temperatura/);
});

test("não herda propriedades do protótipo como chave de catálogo", () => {
  for (const chave of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    assert.deepEqual(campos(payloadValido({ observacao: chave })), ["observacao"], chave);
    assert.deepEqual(campos(payloadValido({ condicao: chave })), ["condicao"], chave);
  }
});

// ---------- vários erros ----------

test("reporta todos os erros juntos, não só o primeiro", () => {
  const r = validarEntrada(
    payloadValido({ cpf: "1", gender: "x", value: "abc", birthDate: "nada" })
  );
  assert.ok(!r.ok);
  assert.deepEqual(r.erros.map((e) => e.campo).sort(), ["birthDate", "cpf", "gender", "value"]);
});

test("campos desconhecidos são ignorados e não aparecem no resultado", () => {
  const r = validarEntrada(payloadValido({ extra: "x", telefone: "81" }));
  assert.ok(r.ok);
  assert.ok(!("extra" in r.data));
});
