import {
  buscarCondicao,
  buscarObservacao,
  CLINICAL_STATUS,
  CONDICOES,
  GENDERS,
  OBSERVACOES,
  OBSERVATION_STATUS
} from "./catalogo";
import { BundleInput, normalizarDataHora } from "./fhir";

// Validação da entrada do POST /bundle (o que o formulário envia).
// Não confundir com validador.ts, que valida um Bundle FHIR já pronto.

export interface ErroCampo {
  campo: string;
  mensagem: string;
}

export type ResultadoEntrada =
  | { ok: true; data: BundleInput }
  | { ok: false; erros: ErroCampo[] };

const MAX_TEXTO = 100;
const MAX_NOMES = 10;
// Tolerância para relógios ligeiramente adiantados.
const TOLERANCIA_FUTURO_MS = 5 * 60 * 1000;

export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

// Aceita apenas datas reais do calendário (rejeita 2026-02-30).
export function dataReal(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    d.getUTCFullYear() === ano &&
    d.getUTCMonth() === mes - 1 &&
    d.getUTCDate() === dia
  );
}

export function dataHoraReal(valor: string): boolean {
  const m =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})?$/.exec(
      valor
    );
  if (!m) return false;
  if (!dataReal(m[1])) return false;
  const [h, min, s] = [Number(m[2]), Number(m[3]), Number(m[4] ?? 0)];
  if (h > 23 || min > 59 || s > 59) return false;
  if (m[5] && m[5] !== "Z") {
    const [oh, om] = m[5].slice(1).split(":").map(Number);
    if (oh > 23 || om > 59) return false;
  }
  return true;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validarEntrada(body: unknown): ResultadoEntrada {
  const erros: ErroCampo[] = [];
  const erro = (campo: string, mensagem: string) =>
    erros.push({ campo, mensagem });

  if (!ehObjeto(body)) {
    return {
      ok: false,
      erros: [
        {
          campo: "corpo",
          mensagem: "Envie um objeto JSON com Content-Type: application/json."
        }
      ]
    };
  }

  // Lê um campo de texto obrigatório; devolve o texto aparado ou undefined.
  const texto = (campo: string): string | undefined => {
    const v = body[campo];
    if (v === undefined || v === null || v === "") {
      erro(campo, "Campo obrigatório.");
      return undefined;
    }
    if (typeof v !== "string") {
      erro(campo, "Deve ser um texto.");
      return undefined;
    }
    const t = v.trim();
    if (t === "") {
      erro(campo, "Campo obrigatório.");
      return undefined;
    }
    return t;
  };

  const opcao = <T extends string>(
    campo: string,
    validos: readonly T[]
  ): T | undefined => {
    const v = texto(campo);
    if (v === undefined) return undefined;
    if (!(validos as readonly string[]).includes(v)) {
      erro(campo, `Valor inválido. Use: ${validos.join(", ")}.`);
      return undefined;
    }
    return v as T;
  };

  // ---------- Patient ----------

  let cpf: string | undefined;
  const cpfBruto = texto("cpf");
  if (cpfBruto !== undefined) {
    if (!/^[\d.\-\s]+$/.test(cpfBruto)) {
      erro("cpf", "Use apenas números (pontos e traço são aceitos).");
    } else if (normalizarCpf(cpfBruto).length !== 11) {
      erro("cpf", "O CPF deve ter 11 dígitos.");
    } else {
      cpf = normalizarCpf(cpfBruto);
    }
  }

  let given: string[] | undefined;
  const givenBruto = body.given;
  if (givenBruto === undefined || givenBruto === null || givenBruto === "") {
    erro("given", "Campo obrigatório.");
  } else {
    const lista = Array.isArray(givenBruto) ? givenBruto : [givenBruto];
    if (!lista.every((n) => typeof n === "string")) {
      erro("given", "Deve ser um texto ou uma lista de textos.");
    } else {
      const nomes = (lista as string[]).map((n) => n.trim());
      if (nomes.length === 0 || nomes.some((n) => n === "")) {
        erro("given", "Informe ao menos um nome, sem itens vazios.");
      } else if (nomes.length > MAX_NOMES) {
        erro("given", `No máximo ${MAX_NOMES} nomes.`);
      } else if (nomes.some((n) => n.length > MAX_TEXTO)) {
        erro("given", `Cada nome deve ter no máximo ${MAX_TEXTO} caracteres.`);
      } else {
        given = nomes;
      }
    }
  }

  const family = texto("family");
  if (family !== undefined && family.length > MAX_TEXTO) {
    erro("family", `Deve ter no máximo ${MAX_TEXTO} caracteres.`);
  }

  const gender = opcao("gender", GENDERS);

  let birthDate: string | undefined;
  const nascimento = texto("birthDate");
  if (nascimento !== undefined) {
    if (!dataReal(nascimento)) {
      erro("birthDate", "Data inválida. Use AAAA-MM-DD.");
    } else if (nascimento > hojeISO()) {
      erro("birthDate", "A data de nascimento não pode estar no futuro.");
    } else {
      birthDate = nascimento;
    }
  }

  // ---------- Observation ----------

  const chaveObs = texto("observacao");
  const catalogoObs = chaveObs !== undefined ? buscarObservacao(chaveObs) : undefined;
  if (chaveObs !== undefined && !catalogoObs) {
    erro(
      "observacao",
      `Observação desconhecida: ${chaveObs}. Use: ${Object.keys(OBSERVACOES).join(", ")}.`
    );
  }

  const status = opcao("status", OBSERVATION_STATUS);

  let value: number | undefined;
  const valorBruto = body.value;
  if (valorBruto === undefined || valorBruto === null || valorBruto === "") {
    erro("value", "Campo obrigatório.");
  } else if (
    (typeof valorBruto !== "number" && typeof valorBruto !== "string") ||
    (typeof valorBruto === "string" && valorBruto.trim() === "")
  ) {
    erro("value", "Deve ser um número.");
  } else {
    const n = Number(valorBruto);
    if (!Number.isFinite(n)) {
      erro("value", "Deve ser um número.");
    } else if (catalogoObs && (n < catalogoObs.faixa.min || n > catalogoObs.faixa.max)) {
      erro(
        "value",
        `Fora da faixa plausível (${catalogoObs.faixa.min} a ${catalogoObs.faixa.max} ${catalogoObs.unit.unit}).`
      );
    } else {
      value = n;
    }
  }

  let effectiveDateTime: string | undefined;
  const medida = texto("effectiveDateTime");
  if (medida !== undefined) {
    if (!dataHoraReal(medida)) {
      erro(
        "effectiveDateTime",
        "Data e hora inválidas. Use AAAA-MM-DDTHH:mm (fuso opcional)."
      );
    } else if (
      Date.parse(normalizarDataHora(medida)) > Date.now() + TOLERANCIA_FUTURO_MS
    ) {
      erro("effectiveDateTime", "A data da medida não pode estar no futuro.");
    } else if (birthDate && medida.slice(0, 10) < birthDate) {
      erro("effectiveDateTime", "A medida não pode ser anterior ao nascimento.");
    } else {
      effectiveDateTime = medida;
    }
  }

  // ---------- Condition ----------

  const chaveCond = texto("condicao");
  if (chaveCond !== undefined && !buscarCondicao(chaveCond)) {
    erro(
      "condicao",
      `Condição desconhecida: ${chaveCond}. Use: ${Object.keys(CONDICOES).join(", ")}.`
    );
  }

  const clinicalStatus = opcao("clinicalStatus", CLINICAL_STATUS);

  let recordedDate: string | undefined;
  const registro = texto("recordedDate");
  if (registro !== undefined) {
    if (!dataReal(registro)) {
      erro("recordedDate", "Data inválida. Use AAAA-MM-DD.");
    } else if (registro > hojeISO()) {
      erro("recordedDate", "A data do registro não pode estar no futuro.");
    } else if (birthDate && registro < birthDate) {
      erro("recordedDate", "O registro não pode ser anterior ao nascimento.");
    } else {
      recordedDate = registro;
    }
  }

  if (erros.length > 0) return { ok: false, erros };

  return {
    ok: true,
    data: {
      cpf: cpf!,
      given: given!,
      family: family!,
      gender: gender!,
      birthDate: birthDate!,
      observacao: chaveObs!,
      status: status!,
      value: value!,
      effectiveDateTime: effectiveDateTime!,
      condicao: chaveCond!,
      clinicalStatus: clinicalStatus!,
      recordedDate: recordedDate!
    }
  };
}
