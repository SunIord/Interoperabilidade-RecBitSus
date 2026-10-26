import { BundleInput } from "./types";

// Estado do formulário: tudo texto, como vem dos inputs.
export interface Formulario {
  cpf: string;
  given: string; // um ou mais nomes, separados por espaço
  family: string;
  gender: string;
  birthDate: string;
  observacao: string;
  status: string;
  value: string;
  effectiveDateTime: string;
  condicao: string;
  clinicalStatus: string;
  recordedDate: string;
}

export const FORMULARIO_INICIAL: Formulario = {
  cpf: "",
  given: "",
  family: "",
  gender: "",
  birthDate: "",
  observacao: "",
  status: "final",
  value: "",
  effectiveDateTime: "",
  condicao: "",
  clinicalStatus: "active",
  recordedDate: ""
};

// Converte o formulário no corpo do POST /bundle. A validação de verdade é do
// backend; aqui só se ajusta o formato (nomes viram lista).
export function montarPayload(f: Formulario): BundleInput {
  return {
    cpf: f.cpf.trim(),
    given: f.given.split(/\s+/).filter((n) => n !== ""),
    family: f.family.trim(),
    gender: f.gender,
    birthDate: f.birthDate,
    observacao: f.observacao,
    status: f.status,
    value: f.value.trim(),
    effectiveDateTime: f.effectiveDateTime,
    condicao: f.condicao,
    clinicalStatus: f.clinicalStatus,
    recordedDate: f.recordedDate
  };
}
