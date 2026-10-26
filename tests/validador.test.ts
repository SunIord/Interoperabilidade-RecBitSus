import test from "node:test";
import assert from "node:assert/strict";
import { generateFHIRBundle, BundleInput } from "../backend/fhir";
import { Problema, validarBundle } from "../backend/validador";
import { payloadValido } from "./helpers";

// Os testes de "quebrar o JSON" espelham os exercícios da atividade prática.

type Json = any;

function bundleBom(): Json {
  const b = generateFHIRBundle(payloadValido() as unknown as BundleInput);
  return JSON.parse(JSON.stringify(b));
}

function achar(problemas: Problema[], caminho: string, nivel?: number) {
  return problemas.filter(
    (p) => p.caminho === caminho && (nivel === undefined || p.nivel === nivel)
  );
}

test("o Bundle gerado pelo próprio simulador é válido nos três níveis", () => {
  const r = validarBundle(bundleBom());
  assert.deepEqual(r.problemas, []);
  assert.equal(r.valido, true);
  assert.deepEqual(r.resumo, { sintaxe: true, estrutura: true, perfil: true });
});

test("o exemplo da apostila (com Patient/<id>) também passa", () => {
  const b = bundleBom();
  const [patient, obs, cond] = b.entry;
  patient.resource.id = "paciente-001";
  obs.resource.subject.reference = "Patient/paciente-001";
  cond.resource.subject.reference = "Patient/paciente-001";
  assert.deepEqual(validarBundle(b).problemas, []);
});

// ---------- nível 1 / raiz ----------

test("corpo que não é objeto é erro de nível 1", () => {
  for (const corpo of [undefined, null, "texto", 7, [], [bundleBom()]]) {
    const r = validarBundle(corpo);
    assert.equal(r.valido, false);
    assert.equal(r.resumo.sintaxe, false);
    assert.equal(r.problemas[0].nivel, 1);
  }
});

test("resourceType ausente ou diferente de Bundle", () => {
  let r = validarBundle({});
  assert.equal(achar(r.problemas, "$.resourceType", 2).length, 1);
  r = validarBundle({ resourceType: "Patient" });
  assert.equal(r.valido, false);
  assert.match(r.problemas[0].mensagem, /Bundle/);
});

test("type ausente ou inválido", () => {
  const b = bundleBom();
  delete b.type;
  assert.equal(achar(validarBundle(b).problemas, "$.type", 2).length, 1);
  b.type = "colecao";
  assert.match(achar(validarBundle(b).problemas, "$.type")[0].mensagem, /collection/);
});

test("entry ausente, vazia ou que não é lista", () => {
  for (const entry of [undefined, [], "x", {}]) {
    const b = bundleBom();
    if (entry === undefined) delete b.entry;
    else b.entry = entry;
    assert.equal(achar(validarBundle(b).problemas, "$.entry", 2).length, 1);
  }
});

test("entrada que não é objeto ou sem resource", () => {
  const b = bundleBom();
  b.entry.push("lixo", { fullUrl: "urn:uuid:x" });
  const { problemas } = validarBundle(b);
  assert.equal(achar(problemas, "$.entry[3]", 2).length, 1);
  assert.equal(achar(problemas, "$.entry[4].resource", 2).length, 1);
});

// ---------- exercício: fullUrl e referências ----------

test("fullUrl ausente é apontado", () => {
  const b = bundleBom();
  delete b.entry[1].fullUrl;
  const r = validarBundle(b);
  assert.equal(r.valido, false);
  assert.equal(achar(r.problemas, "$.entry[1].fullUrl", 2).length, 1);
});

test("fullUrl repetido é apontado", () => {
  const b = bundleBom();
  b.entry[2].fullUrl = b.entry[1].fullUrl;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[2].fullUrl", 2).length, 1);
});

test("subject apontando para recurso inexistente (questão da apostila)", () => {
  const b = bundleBom();
  b.entry[1].resource.subject.reference = "urn:uuid:00000000-0000-0000-0000-000000000000";
  const r = validarBundle(b);
  assert.equal(r.valido, false);
  assert.equal(r.resumo.estrutura, false);
  const [p] = achar(r.problemas, "$.entry[1].resource.subject.reference", 2);
  assert.match(p.mensagem, /não aponta para nenhum recurso/);
});

test("subject ausente ou sem reference", () => {
  const b = bundleBom();
  delete b.entry[1].resource.subject;
  b.entry[2].resource.subject = {};
  const { problemas } = validarBundle(b);
  assert.equal(achar(problemas, "$.entry[1].resource.subject", 2).length, 1);
  assert.equal(achar(problemas, "$.entry[2].resource.subject.reference", 2).length, 1);
});

test("subject apontando para um recurso que não é Patient", () => {
  const b = bundleBom();
  b.entry[2].resource.subject.reference = b.entry[1].fullUrl;
  const [p] = achar(validarBundle(b).problemas, "$.entry[2].resource.subject.reference", 2);
  assert.match(p.mensagem, /deve apontar para um Patient/);
});

// ---------- exercício: apagar o system de um coding ----------

test("coding sem system: erro de perfil (nível 3), não de estrutura", () => {
  const b = bundleBom();
  delete b.entry[2].resource.code.coding[0].system;
  const r = validarBundle(b);
  assert.equal(r.valido, false);
  assert.equal(r.resumo.estrutura, true);
  assert.equal(r.resumo.perfil, false);
  const [p] = achar(r.problemas, "$.entry[2].resource.code.coding[0].system", 3);
  assert.match(p.mensagem, /ambíguo/);
});

test("coding sem code", () => {
  const b = bundleBom();
  delete b.entry[1].resource.code.coding[0].code;
  assert.equal(
    achar(validarBundle(b).problemas, "$.entry[1].resource.code.coding[0].code", 3).length,
    1
  );
});

test("conceito só com texto livre falha no perfil, mas não na estrutura", () => {
  const b = bundleBom();
  b.entry[2].resource.code = { text: "Febre" };
  const r = validarBundle(b);
  assert.equal(r.resumo.estrutura, true);
  assert.equal(r.resumo.perfil, false);
});

test("conceito sem coding nem text é erro de estrutura", () => {
  const b = bundleBom();
  b.entry[2].resource.code = {};
  assert.equal(achar(validarBundle(b).problemas, "$.entry[2].resource.code", 2).length, 1);
});

test("code ausente na Observation e na Condition", () => {
  const b = bundleBom();
  delete b.entry[1].resource.code;
  delete b.entry[2].resource.code;
  const { problemas } = validarBundle(b);
  assert.equal(achar(problemas, "$.entry[1].resource.code", 2).length, 1);
  assert.equal(achar(problemas, "$.entry[2].resource.code", 2).length, 1);
});

test("coding que não é lista é erro de estrutura", () => {
  const b = bundleBom();
  b.entry[2].resource.code.coding = b.entry[2].resource.code.coding[0];
  assert.equal(achar(validarBundle(b).problemas, "$.entry[2].resource.code.coding", 2).length, 1);
});

// ---------- exercício: remover campo obrigatório ----------

test("Observation sem status", () => {
  const b = bundleBom();
  delete b.entry[1].resource.status;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[1].resource.status", 2).length, 1);
});

test("status inválido na Observation", () => {
  const b = bundleBom();
  b.entry[1].resource.status = "pronto";
  const [p] = achar(validarBundle(b).problemas, "$.entry[1].resource.status", 2);
  assert.match(p.mensagem, /final/);
});

test("gender fora do value set (ex.: 'Masculino')", () => {
  const b = bundleBom();
  b.entry[0].resource.gender = "Masculino";
  const [p] = achar(validarBundle(b).problemas, "$.entry[0].resource.gender", 2);
  assert.match(p.mensagem, /female, male, other, unknown/);
});

test("birthDate em formato brasileiro", () => {
  const b = bundleBom();
  b.entry[0].resource.birthDate = "21/03/1985";
  assert.equal(achar(validarBundle(b).problemas, "$.entry[0].resource.birthDate", 2).length, 1);
});

test("data de nascimento ou sexo ausentes falham no perfil", () => {
  const b = bundleBom();
  delete b.entry[0].resource.gender;
  delete b.entry[0].resource.birthDate;
  const { problemas } = validarBundle(b);
  assert.equal(achar(problemas, "$.entry[0].resource.gender", 3).length, 1);
  assert.equal(achar(problemas, "$.entry[0].resource.birthDate", 3).length, 1);
});

test("identifier e name que não são lista (erro clássico da apostila)", () => {
  const b = bundleBom();
  b.entry[0].resource.identifier = b.entry[0].resource.identifier[0];
  b.entry[0].resource.name = b.entry[0].resource.name[0];
  const { problemas } = validarBundle(b);
  assert.match(achar(problemas, "$.entry[0].resource.identifier", 2)[0].mensagem, /lista/);
  assert.match(achar(problemas, "$.entry[0].resource.name", 2)[0].mensagem, /lista/);
});

test("given que não é lista", () => {
  const b = bundleBom();
  b.entry[0].resource.name[0].given = "Maria";
  assert.equal(achar(validarBundle(b).problemas, "$.entry[0].resource.name[0].given", 2).length, 1);
});

test("CPF com system errado ou valor com tamanho errado falha no perfil", () => {
  const b = bundleBom();
  b.entry[0].resource.identifier[0].system = "CPF";
  assert.equal(achar(validarBundle(b).problemas, "$.entry[0].resource.identifier", 3).length, 1);

  const c = bundleBom();
  c.entry[0].resource.identifier[0].value = "123";
  assert.equal(achar(validarBundle(c).problemas, "$.entry[0].resource.identifier", 3).length, 1);
});

test("identifier sem value é erro de estrutura", () => {
  const b = bundleBom();
  delete b.entry[0].resource.identifier[0].value;
  assert.equal(
    achar(validarBundle(b).problemas, "$.entry[0].resource.identifier[0].value", 2).length,
    1
  );
});

test("nome sem family ou sem given falha no perfil", () => {
  const b = bundleBom();
  delete b.entry[0].resource.name[0].family;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[0].resource.name", 3).length, 1);
});

// ---------- exercício: alterar valor e data ----------

test("valueQuantity.value como texto (com aspas) é apontado", () => {
  const b = bundleBom();
  b.entry[1].resource.valueQuantity.value = "38.5";
  const [p] = achar(validarBundle(b).problemas, "$.entry[1].resource.valueQuantity.value", 2);
  assert.match(p.mensagem, /sem aspas/);
});

test("valueQuantity sem system/code UCUM falha no perfil", () => {
  const b = bundleBom();
  delete b.entry[1].resource.valueQuantity.system;
  delete b.entry[1].resource.valueQuantity.code;
  delete b.entry[1].resource.valueQuantity.unit;
  const { problemas } = validarBundle(b);
  assert.equal(achar(problemas, "$.entry[1].resource.valueQuantity.system", 3).length, 1);
  assert.equal(achar(problemas, "$.entry[1].resource.valueQuantity.code", 3).length, 1);
  assert.equal(achar(problemas, "$.entry[1].resource.valueQuantity.unit", 3).length, 1);
});

test("valueQuantity ausente falha no perfil", () => {
  const b = bundleBom();
  delete b.entry[1].resource.valueQuantity;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[1].resource.valueQuantity", 3).length, 1);
});

test("effectiveDateTime sem fuso falha no perfil; formato inválido, na estrutura", () => {
  const b = bundleBom();
  b.entry[1].resource.effectiveDateTime = "2024-05-10T09:30:00";
  const r = validarBundle(b);
  assert.equal(r.resumo.estrutura, true);
  assert.equal(achar(r.problemas, "$.entry[1].resource.effectiveDateTime", 3).length, 1);

  b.entry[1].resource.effectiveDateTime = "10/05/2024";
  assert.equal(achar(validarBundle(b).problemas, "$.entry[1].resource.effectiveDateTime", 2).length, 1);
});

test("category ausente falha no perfil", () => {
  const b = bundleBom();
  delete b.entry[1].resource.category;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[1].resource.category", 3).length, 1);
});

test("Condition: clinicalStatus ausente (perfil) ou inválido (estrutura)", () => {
  const b = bundleBom();
  delete b.entry[2].resource.clinicalStatus;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[2].resource.clinicalStatus", 3).length, 1);

  const c = bundleBom();
  c.entry[2].resource.clinicalStatus.coding[0].code = "ativo";
  assert.equal(achar(validarBundle(c).problemas, "$.entry[2].resource.clinicalStatus", 2).length, 1);
});

test("Condition: recordedDate inválida", () => {
  const b = bundleBom();
  b.entry[2].resource.recordedDate = "2024-02-30";
  assert.equal(achar(validarBundle(b).problemas, "$.entry[2].resource.recordedDate", 2).length, 1);
});

// ---------- elementos desconhecidos ----------

test("elemento com erro de grafia é apontado", () => {
  const b = bundleBom();
  b.entry[0].resource.genre = "female";
  delete b.entry[0].resource.gender;
  const { problemas } = validarBundle(b);
  const [p] = achar(problemas, "$.entry[0].resource.genre", 2);
  assert.match(p.mensagem, /não existe em Patient/);
});

test("elementos válidos do FHIR que o simulador não gera são aceitos", () => {
  const b = bundleBom();
  b.entry[0].resource.telecom = [{ system: "phone", value: "81999999999" }];
  b.entry[0].resource.active = true;
  assert.deepEqual(validarBundle(b).problemas, []);
});

test("recurso de outro tipo gera aviso, não erro", () => {
  const b = bundleBom();
  b.entry.push({
    fullUrl: "urn:uuid:99999999-9999-4999-8999-999999999999",
    resource: { resourceType: "Encounter", status: "finished" }
  });
  const r = validarBundle(b);
  assert.equal(r.valido, true);
  assert.equal(r.problemas.length, 1);
  assert.equal(r.problemas[0].severidade, "aviso");
});

test("recurso sem resourceType", () => {
  const b = bundleBom();
  delete b.entry[1].resource.resourceType;
  assert.equal(achar(validarBundle(b).problemas, "$.entry[1].resource.resourceType", 2).length, 1);
});

test("Bundle sem Patient falha no perfil", () => {
  const b = bundleBom();
  b.entry = b.entry.slice(1);
  const r = validarBundle(b);
  assert.equal(achar(r.problemas, "$.entry", 3).length, 1);
});

test("valido só é verdadeiro quando não há nenhum erro", () => {
  const b = bundleBom();
  delete b.entry[1].resource.valueQuantity.system;
  const r = validarBundle(b);
  assert.equal(r.valido, false);
  assert.deepEqual(r.resumo, { sintaxe: true, estrutura: true, perfil: false });
});

test("é resistente a entradas estranhas (não lança)", () => {
  const estranhos: unknown[] = [
    { resourceType: "Bundle", type: "collection", entry: [null] },
    { resourceType: "Bundle", type: "collection", entry: [{ resource: null }] },
    { resourceType: "Bundle", type: "collection", entry: [{ fullUrl: 1, resource: { resourceType: 5 } }] },
    { resourceType: "Bundle", type: 3, entry: "x" },
    { resourceType: "Bundle", type: "collection", entry: [{ fullUrl: "a", resource: { resourceType: "Patient", identifier: [null, 1], name: [null, "x"] } }] },
    { resourceType: "Bundle", type: "collection", entry: [{ fullUrl: "a", resource: { resourceType: "Observation", code: { coding: [null, 1] }, valueQuantity: [], category: "x" } }] },
    { resourceType: "Bundle", type: "collection", entry: [{ fullUrl: "a", resource: { resourceType: "Condition", clinicalStatus: { coding: "x" }, subject: 1 } }] }
  ];
  for (const e of estranhos) {
    assert.doesNotThrow(() => validarBundle(e));
    assert.equal(validarBundle(e).valido, false);
  }
});
