import { FORMULARIO_INICIAL, montarPayload } from "./formulario";

const preenchido = {
  ...FORMULARIO_INICIAL,
  cpf: " 123.456.789-10 ",
  given: "  Maria   Aparecida ",
  family: " Silva ",
  gender: "female",
  birthDate: "1985-03-21",
  observacao: "temperatura",
  value: " 38.5 ",
  effectiveDateTime: "2024-05-10T09:30",
  condicao: "febre",
  recordedDate: "2024-05-10"
};

test("os nomes viram uma lista, sem itens vazios", () => {
  expect(montarPayload(preenchido).given).toEqual(["Maria", "Aparecida"]);
});

test("nome vazio vira lista vazia (o backend aponta o erro)", () => {
  expect(montarPayload({ ...preenchido, given: "   " }).given).toEqual([]);
});

test("textos são aparados e o valor continua sendo texto", () => {
  const p = montarPayload(preenchido);
  expect(p.cpf).toBe("123.456.789-10");
  expect(p.family).toBe("Silva");
  expect(p.value).toBe("38.5");
});

test("o payload tem exatamente os campos do contrato da API", () => {
  expect(Object.keys(montarPayload(preenchido)).sort()).toEqual([
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

test("status e situação clínica já começam com um valor válido", () => {
  expect(FORMULARIO_INICIAL.status).toBe("final");
  expect(FORMULARIO_INICIAL.clinicalStatus).toBe("active");
});
