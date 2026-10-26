// Catálogo mínimo de terminologias usadas pelo simulador.
// Para ampliar, basta acrescentar entradas aos objetos abaixo.

export const SYSTEMS = {
  cpf: "http://www.saude.gov.br/fhir/r4/NamingSystem/cpf",
  loinc: "http://loinc.org",
  ucum: "http://unitsofmeasure.org",
  cid10: "http://www.saude.gov.br/fhir/r4/CodeSystem/BRCID10",
  observationCategory:
    "http://terminology.hl7.org/CodeSystem/observation-category",
  conditionClinical: "http://terminology.hl7.org/CodeSystem/condition-clinical"
};

export interface Coding {
  system: string;
  code: string;
  display?: string;
}

export interface ObservacaoCatalogo {
  coding: Coding;
  text: string;
  category: Coding;
  unit: { unit: string; system: string; code: string };
  // Faixa plausível do valor, na unidade acima. Barra erros de digitação.
  faixa: { min: number; max: number };
}

export interface CondicaoCatalogo {
  coding: Coding;
  text: string;
}

export const OBSERVACOES: Record<string, ObservacaoCatalogo> = {
  temperatura: {
    coding: {
      system: SYSTEMS.loinc,
      code: "8310-5",
      display: "Body temperature"
    },
    text: "Temperatura corporal",
    category: {
      system: SYSTEMS.observationCategory,
      code: "vital-signs",
      display: "Vital Signs"
    },
    unit: { unit: "°C", system: SYSTEMS.ucum, code: "Cel" },
    faixa: { min: 25, max: 45 }
  }
};

export const CONDICOES: Record<string, CondicaoCatalogo> = {
  febre: {
    coding: {
      system: SYSTEMS.cid10,
      code: "R50.9",
      display: "Febre não especificada"
    },
    text: "Febre"
  }
};

// Busca só em chaves próprias, para "constructor" ou "__proto__" não passarem
// por chaves do catálogo.
function propria<T>(catalogo: Record<string, T>, chave: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(catalogo, chave)
    ? catalogo[chave]
    : undefined;
}

export const buscarObservacao = (chave: string) => propria(OBSERVACOES, chave);
export const buscarCondicao = (chave: string) => propria(CONDICOES, chave);

export const GENDERS = ["female", "male", "other", "unknown"] as const;
export type Gender = (typeof GENDERS)[number];

export const OBSERVATION_STATUS = [
  "registered",
  "preliminary",
  "final",
  "amended"
] as const;
export type ObservationStatus = (typeof OBSERVATION_STATUS)[number];

export const CLINICAL_STATUS = [
  "active",
  "inactive",
  "remission",
  "resolved"
] as const;
export type ClinicalStatus = (typeof CLINICAL_STATUS)[number];
