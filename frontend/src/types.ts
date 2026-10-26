// Tipos que espelham o contrato da API (ver docs/api.md).

// Corpo do POST /bundle.
export interface BundleInput {
  cpf: string;
  given: string[];
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

// Erro de um campo, devolvido pelo backend em 400.
export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export interface Bundle {
  resourceType: "Bundle";
  id: string;
  type: string;
  entry: unknown[];
}

// Resposta do POST /validate.
export type Nivel = 1 | 2 | 3;

export interface Problema {
  nivel: Nivel;
  severidade: "erro" | "aviso";
  caminho: string;
  mensagem: string;
}

export interface ResultadoValidacao {
  valido: boolean;
  resumo: { sintaxe: boolean; estrutura: boolean; perfil: boolean };
  problemas: Problema[];
}
