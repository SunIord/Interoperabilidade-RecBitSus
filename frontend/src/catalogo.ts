// Opções do formulário. Os valores (primeira coluna) são os aceitos pelo
// backend; devem acompanhar backend/catalogo.ts. O código do catálogo aparece
// no rótulo de propósito: o aluno vê de onde vem cada código do JSON.

export interface Opcao {
  valor: string;
  rotulo: string;
}

export const GENEROS: Opcao[] = [
  { valor: "female", rotulo: "Feminino (female)" },
  { valor: "male", rotulo: "Masculino (male)" },
  { valor: "other", rotulo: "Outro (other)" },
  { valor: "unknown", rotulo: "Desconhecido (unknown)" }
];

export const STATUS_OBSERVACAO: Opcao[] = [
  { valor: "registered", rotulo: "Registrado (registered)" },
  { valor: "preliminary", rotulo: "Preliminar (preliminary)" },
  { valor: "final", rotulo: "Finalizado (final)" },
  { valor: "amended", rotulo: "Corrigido (amended)" }
];

export const SITUACOES_CLINICAS: Opcao[] = [
  { valor: "active", rotulo: "Ativo (active)" },
  { valor: "inactive", rotulo: "Inativo (inactive)" },
  { valor: "remission", rotulo: "Em remissão (remission)" },
  { valor: "resolved", rotulo: "Resolvido (resolved)" }
];

export interface ObservacaoCatalogo extends Opcao {
  unidade: string;
}

export const OBSERVACOES: ObservacaoCatalogo[] = [
  {
    valor: "temperatura",
    rotulo: "Temperatura corporal (LOINC 8310-5)",
    unidade: "°C"
  }
];

export const CONDICOES: Opcao[] = [
  { valor: "febre", rotulo: "Febre (CID-10 R50.9)" }
];
