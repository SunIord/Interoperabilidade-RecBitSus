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
  },
  {
    valor: "frequencia-cardiaca",
    rotulo: "Frequência cardíaca (LOINC 8867-4)",
    unidade: "bpm"
  },
  {
    valor: "saturacao-oxigenio",
    rotulo: "Saturação de oxigênio (LOINC 59408-5)",
    unidade: "%"
  },
  {
    valor: "glicemia",
    rotulo: "Glicemia (LOINC 2339-0)",
    unidade: "mg/dL"
  }
];

export const CONDICOES: Opcao[] = [
  { valor: "febre", rotulo: "Febre (CID-10 R50.9)" },
  { valor: "hipertensao", rotulo: "Hipertensão essencial (CID-10 I10)" },
  { valor: "diabetes-tipo-2", rotulo: "Diabetes tipo 2 (CID-10 E11.9)" },
  {
    valor: "infeccao-vias-aereas",
    rotulo: "Infecção das vias aéreas superiores (CID-10 J06.9)"
  }
];
