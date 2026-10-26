import test from "node:test";
import assert from "node:assert/strict";
import {
  generateFHIRBundle,
  normalizarDataHora,
  BundleInput,
  Observation,
  Condition,
  Patient
} from "../backend/fhir";
import { SYSTEMS } from "../backend/catalogo";
import { payloadValido } from "./helpers";

const entrada = () => payloadValido() as unknown as BundleInput;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("gera um Bundle collection com Patient, Observation e Condition", () => {
  const b = generateFHIRBundle(entrada());
  assert.equal(b.resourceType, "Bundle");
  assert.equal(b.type, "collection");
  assert.deepEqual(
    b.entry.map((e) => e.resource.resourceType),
    ["Patient", "Observation", "Condition"]
  );
});

test("cada entrada tem fullUrl urn:uuid igual ao id do recurso", () => {
  const b = generateFHIRBundle(entrada());
  for (const e of b.entry) {
    assert.match(e.fullUrl, /^urn:uuid:/);
    assert.equal(e.fullUrl, `urn:uuid:${e.resource.id}`);
    assert.match(e.resource.id, UUID);
  }
  assert.match(b.id, UUID);
});

test("todos os ids são distintos, mesmo em geração simultânea", () => {
  const ids = new Set<string>();
  for (let i = 0; i < 200; i++) {
    const b = generateFHIRBundle(entrada());
    ids.add(b.id);
    b.entry.forEach((e) => ids.add(e.resource.id));
  }
  assert.equal(ids.size, 200 * 4);
});

test("subject aponta para o fullUrl do Patient, não para Patient/<id>", () => {
  const b = generateFHIRBundle(entrada());
  const patientUrl = b.entry[0].fullUrl;
  const obs = b.entry[1].resource as Observation;
  const cond = b.entry[2].resource as Condition;
  assert.equal(obs.subject.reference, patientUrl);
  assert.equal(cond.subject.reference, patientUrl);
  assert.ok(!obs.subject.reference.startsWith("Patient/"));
});

test("Patient: CPF com system em URI, nome com family e given", () => {
  const p = generateFHIRBundle(entrada()).entry[0].resource as Patient;
  assert.deepEqual(p.identifier, [
    { system: SYSTEMS.cpf, value: "12345678910" }
  ]);
  assert.deepEqual(p.name, [
    { use: "official", family: "Silva", given: ["Maria", "Aparecida"] }
  ]);
  assert.equal(p.gender, "female");
  assert.equal(p.birthDate, "1985-03-21");
});

test("given em texto vira lista", () => {
  const p = generateFHIRBundle({ ...entrada(), given: "Maria" }).entry[0]
    .resource as Patient;
  assert.deepEqual(p.name[0].given, ["Maria"]);
});

test("Observation: coding LOINC, categoria e valueQuantity UCUM", () => {
  const o = generateFHIRBundle(entrada()).entry[1].resource as Observation;
  assert.equal(o.status, "final");
  assert.deepEqual(o.code.coding, [
    { system: SYSTEMS.loinc, code: "8310-5", display: "Body temperature" }
  ]);
  assert.equal(o.code.text, "Temperatura corporal");
  assert.equal(o.category[0].coding[0].code, "vital-signs");
  assert.deepEqual(o.valueQuantity, {
    value: 38.5,
    unit: "°C",
    system: SYSTEMS.ucum,
    code: "Cel"
  });
});

test("Observation: value em texto é convertido para número", () => {
  const o = generateFHIRBundle({ ...entrada(), value: "37.2" }).entry[1]
    .resource as Observation;
  assert.equal(o.valueQuantity.value, 37.2);
});

test("Condition: CID-10 com system e clinicalStatus codificado", () => {
  const c = generateFHIRBundle(entrada()).entry[2].resource as Condition;
  assert.deepEqual(c.code.coding, [
    { system: SYSTEMS.cid10, code: "R50.9", display: "Febre não especificada" }
  ]);
  assert.equal(c.clinicalStatus.coding[0].system, SYSTEMS.conditionClinical);
  assert.equal(c.clinicalStatus.coding[0].code, "active");
  assert.equal(c.recordedDate, "2024-05-10");
});

test("effectiveDateTime ganha segundos e fuso de Brasília", () => {
  const o = generateFHIRBundle(entrada()).entry[1].resource as Observation;
  assert.equal(o.effectiveDateTime, "2024-05-10T09:30:00-03:00");
});

test("normalizarDataHora preserva fuso já informado", () => {
  assert.equal(normalizarDataHora("2024-05-10T09:30:00-03:00"), "2024-05-10T09:30:00-03:00");
  assert.equal(normalizarDataHora("2024-05-10T09:30:00Z"), "2024-05-10T09:30:00Z");
  assert.equal(normalizarDataHora("2024-05-10T09:30:15"), "2024-05-10T09:30:15-03:00");
  assert.equal(normalizarDataHora("2024-05-10T09:30"), "2024-05-10T09:30:00-03:00");
});

test("não gera os campos extras removidos (telecom, address, contact, active)", () => {
  const p = generateFHIRBundle(entrada()).entry[0].resource as unknown as Record<string, unknown>;
  for (const campo of ["telecom", "address", "contact", "active"]) {
    assert.ok(!(campo in p), campo);
  }
});

test("chave de catálogo desconhecida lança CatalogoError", () => {
  assert.throws(
    () => generateFHIRBundle({ ...entrada(), observacao: "xyz" }),
    /Observação desconhecida/
  );
  assert.throws(
    () => generateFHIRBundle({ ...entrada(), condicao: "xyz" }),
    /Condição desconhecida/
  );
});
