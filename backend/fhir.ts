import { randomUUID } from "crypto";
import {
  buscarCondicao,
  buscarObservacao,
  SYSTEMS,
  Gender,
  ObservationStatus,
  ClinicalStatus,
  Coding
} from "./catalogo";

// ================= ENTRADA =================

export interface BundleInput {
  // Patient
  cpf: string;
  given: string[] | string;
  family: string;
  gender: Gender;
  birthDate: string;

  // Observation
  observacao: string; // chave de OBSERVACOES
  status: ObservationStatus;
  value: number | string;
  effectiveDateTime: string;

  // Condition
  condicao: string; // chave de CONDICOES
  clinicalStatus: ClinicalStatus;
  recordedDate: string;
}

// ================= SAÍDA =================

interface CodeableConcept {
  coding: Coding[];
  text?: string;
}

interface Reference {
  reference: string;
}

export interface Patient {
  resourceType: "Patient";
  id: string;
  identifier: { system: string; value: string }[];
  name: { use: string; family: string; given: string[] }[];
  gender: Gender;
  birthDate: string;
}

export interface Observation {
  resourceType: "Observation";
  id: string;
  status: ObservationStatus;
  category: CodeableConcept[];
  code: CodeableConcept;
  subject: Reference;
  effectiveDateTime: string;
  valueQuantity: { value: number; unit: string; system: string; code: string };
}

export interface Condition {
  resourceType: "Condition";
  id: string;
  clinicalStatus: CodeableConcept;
  code: CodeableConcept;
  subject: Reference;
  recordedDate: string;
}

export interface BundleEntry {
  fullUrl: string;
  resource: Patient | Observation | Condition;
}

export interface Bundle {
  resourceType: "Bundle";
  id: string;
  type: "collection";
  entry: BundleEntry[];
}

// ================= GERAÇÃO =================

export class CatalogoError extends Error {}

// O input type="datetime-local" envia "AAAA-MM-DDTHH:mm" sem fuso.
// O FHIR pede o fuso, então completa com segundos e horário de Brasília.
export function normalizarDataHora(valor: string): string {
  if (/(Z|[+-]\d{2}:\d{2})$/.test(valor)) return valor;
  const comSegundos = /T\d{2}:\d{2}$/.test(valor) ? `${valor}:00` : valor;
  return `${comSegundos}-03:00`;
}

export function generateFHIRBundle(data: BundleInput): Bundle {
  const observacao = buscarObservacao(data.observacao);
  if (!observacao) {
    throw new CatalogoError(`Observação desconhecida: ${data.observacao}`);
  }
  const condicao = buscarCondicao(data.condicao);
  if (!condicao) {
    throw new CatalogoError(`Condição desconhecida: ${data.condicao}`);
  }

  const patientId = randomUUID();
  const observationId = randomUUID();
  const conditionId = randomUUID();

  // As referências apontam para o fullUrl da entrada, não para "Patient/<id>".
  const patientUrl = `urn:uuid:${patientId}`;

  const patient: Patient = {
    resourceType: "Patient",
    id: patientId,
    identifier: [{ system: SYSTEMS.cpf, value: data.cpf }],
    name: [
      {
        use: "official",
        family: data.family,
        given: Array.isArray(data.given) ? data.given : [data.given]
      }
    ],
    gender: data.gender,
    birthDate: data.birthDate
  };

  const obs: Observation = {
    resourceType: "Observation",
    id: observationId,
    status: data.status,
    category: [{ coding: [observacao.category] }],
    code: { coding: [observacao.coding], text: observacao.text },
    subject: { reference: patientUrl },
    effectiveDateTime: normalizarDataHora(data.effectiveDateTime),
    valueQuantity: {
      value: Number(data.value),
      unit: observacao.unit.unit,
      system: observacao.unit.system,
      code: observacao.unit.code
    }
  };

  const cond: Condition = {
    resourceType: "Condition",
    id: conditionId,
    clinicalStatus: {
      coding: [
        { system: SYSTEMS.conditionClinical, code: data.clinicalStatus }
      ]
    },
    code: { coding: [condicao.coding], text: condicao.text },
    subject: { reference: patientUrl },
    recordedDate: data.recordedDate
  };

  return {
    resourceType: "Bundle",
    id: randomUUID(),
    type: "collection",
    entry: [
      { fullUrl: patientUrl, resource: patient },
      { fullUrl: `urn:uuid:${observationId}`, resource: obs },
      { fullUrl: `urn:uuid:${conditionId}`, resource: cond }
    ]
  };
}
