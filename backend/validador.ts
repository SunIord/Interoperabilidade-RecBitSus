import {
  CLINICAL_STATUS,
  GENDERS,
  OBSERVATION_STATUS,
  SYSTEMS
} from "./catalogo";
import { dataHoraReal, dataReal } from "./validacao";

// Validador DIDÁTICO de Bundles FHIR, organizado nos três níveis da apostila:
//   1. sintaxe: o JSON está bem formado (verificado antes de chegar aqui);
//   2. estrutura: o recurso respeita a estrutura do FHIR;
//   3. perfil: o recurso cumpre as regras de um perfil.
//
// Atenção: é uma versão simplificada, só para a aula. As regras do nível 3 são
// inspiradas no BR-Core, mas NÃO o substituem. Não use para homologar envios
// reais à RNDS.

export type Nivel = 1 | 2 | 3;
export type Severidade = "erro" | "aviso";

export interface Problema {
  nivel: Nivel;
  severidade: Severidade;
  caminho: string;
  mensagem: string;
}

export interface ResultadoValidacao {
  valido: boolean;
  resumo: { sintaxe: boolean; estrutura: boolean; perfil: boolean };
  problemas: Problema[];
}

type Obj = Record<string, unknown>;

const TIPOS_BUNDLE = [
  "document",
  "message",
  "transaction",
  "transaction-response",
  "batch",
  "batch-response",
  "history",
  "searchset",
  "collection"
];

// Elementos permitidos em cada recurso (FHIR R4). Serve para apontar erros de
// digitação, como "genre" no lugar de "gender".
const BASE = [
  "resourceType",
  "id",
  "meta",
  "implicitRules",
  "language",
  "text",
  "contained",
  "extension",
  "modifierExtension"
];

const ELEMENTOS: Record<string, string[]> = {
  Patient: [
    ...BASE,
    "identifier",
    "active",
    "name",
    "telecom",
    "gender",
    "birthDate",
    "deceasedBoolean",
    "deceasedDateTime",
    "address",
    "maritalStatus",
    "multipleBirthBoolean",
    "multipleBirthInteger",
    "photo",
    "contact",
    "communication",
    "generalPractitioner",
    "managingOrganization",
    "link"
  ],
  Observation: [
    ...BASE,
    "identifier",
    "basedOn",
    "partOf",
    "status",
    "category",
    "code",
    "subject",
    "focus",
    "encounter",
    "effectiveDateTime",
    "effectivePeriod",
    "effectiveTiming",
    "effectiveInstant",
    "issued",
    "performer",
    "valueQuantity",
    "valueCodeableConcept",
    "valueString",
    "valueBoolean",
    "valueInteger",
    "valueRange",
    "valueRatio",
    "valueSampledData",
    "valueTime",
    "valueDateTime",
    "valuePeriod",
    "dataAbsentReason",
    "interpretation",
    "note",
    "bodySite",
    "method",
    "specimen",
    "device",
    "referenceRange",
    "hasMember",
    "derivedFrom",
    "component"
  ],
  Condition: [
    ...BASE,
    "identifier",
    "clinicalStatus",
    "verificationStatus",
    "category",
    "severity",
    "code",
    "bodySite",
    "subject",
    "encounter",
    "onsetDateTime",
    "onsetAge",
    "onsetPeriod",
    "onsetRange",
    "onsetString",
    "abatementDateTime",
    "abatementAge",
    "abatementPeriod",
    "abatementRange",
    "abatementString",
    "recordedDate",
    "recorder",
    "asserter",
    "stage",
    "evidence",
    "note"
  ]
};

function ehObjeto(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

class Coletor {
  problemas: Problema[] = [];

  erro(nivel: Nivel, caminho: string, mensagem: string) {
    this.problemas.push({ nivel, severidade: "erro", caminho, mensagem });
  }

  aviso(nivel: Nivel, caminho: string, mensagem: string) {
    this.problemas.push({ nivel, severidade: "aviso", caminho, mensagem });
  }
}

export function validarBundle(entrada: unknown): ResultadoValidacao {
  const c = new Coletor();

  if (!ehObjeto(entrada)) {
    c.erro(1, "$", "O corpo deve ser um objeto JSON.");
    return resultado(c);
  }

  validarRaiz(entrada, c);
  return resultado(c);
}

function resultado(c: Coletor): ResultadoValidacao {
  const temErro = (nivel: Nivel) =>
    c.problemas.some((p) => p.nivel === nivel && p.severidade === "erro");
  return {
    valido: !c.problemas.some((p) => p.severidade === "erro"),
    resumo: {
      sintaxe: !temErro(1),
      estrutura: !temErro(2),
      perfil: !temErro(3)
    },
    problemas: c.problemas
  };
}

// ---------------------------------------------------------------------------
// Bundle
// ---------------------------------------------------------------------------

interface EntradaResolvida {
  caminho: string;
  fullUrl?: string;
  resource: Obj;
}

function validarRaiz(bundle: Obj, c: Coletor) {
  if (bundle.resourceType === undefined) {
    c.erro(2, "$.resourceType", 'Campo "resourceType" ausente.');
    return;
  }
  if (bundle.resourceType !== "Bundle") {
    c.erro(
      2,
      "$.resourceType",
      `Esperava "Bundle", recebeu ${JSON.stringify(bundle.resourceType)}.`
    );
    return;
  }

  if (typeof bundle.type !== "string") {
    c.erro(2, "$.type", 'Campo "type" obrigatório no Bundle.');
  } else if (!TIPOS_BUNDLE.includes(bundle.type)) {
    c.erro(
      2,
      "$.type",
      `Tipo de Bundle inválido: "${bundle.type}". Use: ${TIPOS_BUNDLE.join(", ")}.`
    );
  }

  if (!Array.isArray(bundle.entry) || bundle.entry.length === 0) {
    c.erro(2, "$.entry", 'O Bundle deve ter uma lista "entry" com recursos.');
    return;
  }

  const entradas: EntradaResolvida[] = [];
  const vistos = new Set<string>();

  bundle.entry.forEach((e, i) => {
    const caminho = `$.entry[${i}]`;
    if (!ehObjeto(e)) {
      c.erro(2, caminho, "Cada entry deve ser um objeto.");
      return;
    }
    if (!ehObjeto(e.resource)) {
      c.erro(2, `${caminho}.resource`, 'Falta o "resource" da entrada.');
      return;
    }

    let fullUrl: string | undefined;
    if (typeof e.fullUrl !== "string" || e.fullUrl === "") {
      c.erro(
        2,
        `${caminho}.fullUrl`,
        'Falta o "fullUrl": é o endereço do recurso dentro do pacote e é por ele que os outros recursos o referenciam.'
      );
    } else {
      fullUrl = e.fullUrl;
      if (vistos.has(fullUrl)) {
        c.erro(2, `${caminho}.fullUrl`, `fullUrl repetido: ${fullUrl}.`);
      }
      vistos.add(fullUrl);
    }

    entradas.push({ caminho, fullUrl, resource: e.resource });
  });

  for (const e of entradas) validarRecurso(e, entradas, c);

  // Nível 3: o pacote deve ter um Patient.
  if (!entradas.some((e) => e.resource.resourceType === "Patient")) {
    c.erro(3, "$.entry", "O perfil exige um recurso Patient no pacote.");
  }
}

// ---------------------------------------------------------------------------
// Recursos
// ---------------------------------------------------------------------------

function validarRecurso(e: EntradaResolvida, todas: EntradaResolvida[], c: Coletor) {
  const r = e.resource;
  const base = `${e.caminho}.resource`;
  const tipo = r.resourceType;

  if (typeof tipo !== "string") {
    c.erro(2, `${base}.resourceType`, 'Campo "resourceType" ausente.');
    return;
  }
  if (!(tipo in ELEMENTOS)) {
    c.aviso(
      2,
      `${base}.resourceType`,
      `O tipo "${tipo}" é válido no FHIR, mas este validador só conhece Patient, Observation e Condition.`
    );
    return;
  }

  for (const chave of Object.keys(r)) {
    if (!ELEMENTOS[tipo].includes(chave)) {
      c.erro(
        2,
        `${base}.${chave}`,
        `Elemento "${chave}" não existe em ${tipo}. Verifique a grafia.`
      );
    }
  }

  if (tipo === "Patient") validarPatient(r, base, c);
  if (tipo === "Observation") validarObservation(r, base, todas, c);
  if (tipo === "Condition") validarCondition(r, base, todas, c);
}

function validarPatient(r: Obj, base: string, c: Coletor) {
  if (r.gender !== undefined) {
    if (typeof r.gender !== "string" || !(GENDERS as readonly string[]).includes(r.gender)) {
      c.erro(
        2,
        `${base}.gender`,
        `Valor inválido ${JSON.stringify(r.gender)}. Use: ${GENDERS.join(", ")}.`
      );
    }
  } else {
    c.erro(3, `${base}.gender`, "O perfil exige o sexo (gender).");
  }

  if (r.birthDate !== undefined) {
    if (typeof r.birthDate !== "string" || !dataReal(r.birthDate)) {
      c.erro(2, `${base}.birthDate`, "Data inválida. Use AAAA-MM-DD.");
    }
  } else {
    c.erro(3, `${base}.birthDate`, "O perfil exige a data de nascimento.");
  }

  // identifier
  if (r.identifier !== undefined) {
    if (!Array.isArray(r.identifier)) {
      c.erro(2, `${base}.identifier`, "Deve ser uma lista, mesmo com um só item.");
    } else {
      r.identifier.forEach((id, i) => {
        const p = `${base}.identifier[${i}]`;
        if (!ehObjeto(id)) {
          c.erro(2, p, "Cada identifier deve ser um objeto.");
        } else if (typeof id.value !== "string" || id.value === "") {
          c.erro(2, `${p}.value`, 'Falta o "value" do identificador.');
        }
      });
    }
  }
  const cpfValido =
    Array.isArray(r.identifier) &&
    r.identifier.some(
      (id) =>
        ehObjeto(id) &&
        id.system === SYSTEMS.cpf &&
        typeof id.value === "string" &&
        /^\d{11}$/.test(id.value)
    );
  if (!cpfValido) {
    c.erro(
      3,
      `${base}.identifier`,
      `O perfil exige um identificador de CPF: system "${SYSTEMS.cpf}" e 11 dígitos em value.`
    );
  }

  // name
  if (r.name !== undefined) {
    if (!Array.isArray(r.name)) {
      c.erro(2, `${base}.name`, "Deve ser uma lista, mesmo com um só item.");
    } else {
      r.name.forEach((n, i) => {
        const p = `${base}.name[${i}]`;
        if (!ehObjeto(n)) {
          c.erro(2, p, "Cada name deve ser um objeto.");
          return;
        }
        if (n.given !== undefined && !Array.isArray(n.given)) {
          c.erro(2, `${p}.given`, 'O "given" deve ser uma lista de textos.');
        }
        if (n.family !== undefined && typeof n.family !== "string") {
          c.erro(2, `${p}.family`, 'O "family" deve ser um texto.');
        }
      });
    }
  }
  const nomeCompleto =
    Array.isArray(r.name) &&
    r.name.some(
      (n) =>
        ehObjeto(n) &&
        typeof n.family === "string" &&
        n.family !== "" &&
        Array.isArray(n.given) &&
        n.given.length > 0
    );
  if (!nomeCompleto) {
    c.erro(3, `${base}.name`, "O perfil exige um nome com family e given.");
  }
}

function validarObservation(r: Obj, base: string, todas: EntradaResolvida[], c: Coletor) {
  if (typeof r.status !== "string") {
    c.erro(2, `${base}.status`, 'Campo "status" obrigatório.');
  } else if (!(OBSERVATION_STATUS as readonly string[]).includes(r.status)) {
    c.erro(
      2,
      `${base}.status`,
      `Valor inválido "${r.status}". Use: ${OBSERVATION_STATUS.join(", ")}.`
    );
  }

  if (r.category === undefined) {
    c.erro(3, `${base}.category`, "O perfil exige a categoria da observação.");
  } else {
    validarListaConceitos(r.category, `${base}.category`, c);
  }

  validarConceito(r.code, `${base}.code`, true, c);
  validarSubject(r.subject, `${base}.subject`, todas, c);

  if (r.effectiveDateTime !== undefined) {
    if (typeof r.effectiveDateTime !== "string" || !dataHoraReal(r.effectiveDateTime)) {
      c.erro(
        2,
        `${base}.effectiveDateTime`,
        "Data e hora inválidas. Use AAAA-MM-DDTHH:mm:ss e fuso (ex.: -03:00)."
      );
    } else if (!/(Z|[+-]\d{2}:\d{2})$/.test(r.effectiveDateTime)) {
      c.erro(3, `${base}.effectiveDateTime`, "O perfil exige o fuso horário (ex.: -03:00).");
    }
  } else {
    c.erro(3, `${base}.effectiveDateTime`, "O perfil exige a data e hora da medida.");
  }

  const q = r.valueQuantity;
  if (q === undefined) {
    c.erro(3, `${base}.valueQuantity`, "O perfil exige o valor medido (valueQuantity).");
  } else if (!ehObjeto(q)) {
    c.erro(2, `${base}.valueQuantity`, "Deve ser um objeto com value e unit.");
  } else {
    if (typeof q.value !== "number" || !Number.isFinite(q.value)) {
      c.erro(2, `${base}.valueQuantity.value`, "O value deve ser um número, sem aspas.");
    }
    if (typeof q.unit !== "string") {
      c.erro(3, `${base}.valueQuantity.unit`, "O perfil exige a unidade (unit).");
    }
    if (q.system !== SYSTEMS.ucum) {
      c.erro(
        3,
        `${base}.valueQuantity.system`,
        `O perfil exige a unidade padronizada: system "${SYSTEMS.ucum}".`
      );
    }
    if (typeof q.code !== "string" || q.code === "") {
      c.erro(3, `${base}.valueQuantity.code`, "O perfil exige o código UCUM da unidade.");
    }
  }
}

function validarCondition(r: Obj, base: string, todas: EntradaResolvida[], c: Coletor) {
  if (r.clinicalStatus === undefined) {
    c.erro(3, `${base}.clinicalStatus`, "O perfil exige a situação clínica.");
  } else {
    validarConceito(r.clinicalStatus, `${base}.clinicalStatus`, false, c);
    if (ehObjeto(r.clinicalStatus) && Array.isArray(r.clinicalStatus.coding)) {
      for (const cod of r.clinicalStatus.coding) {
        if (
          ehObjeto(cod) &&
          typeof cod.code === "string" &&
          !(CLINICAL_STATUS as readonly string[]).includes(cod.code)
        ) {
          c.erro(
            2,
            `${base}.clinicalStatus`,
            `Código "${cod.code}" inválido. Use: ${CLINICAL_STATUS.join(", ")}.`
          );
        }
      }
    }
  }

  validarConceito(r.code, `${base}.code`, true, c);
  validarSubject(r.subject, `${base}.subject`, todas, c);

  if (r.recordedDate !== undefined) {
    if (typeof r.recordedDate !== "string" || !dataReal(r.recordedDate)) {
      c.erro(2, `${base}.recordedDate`, "Data inválida. Use AAAA-MM-DD.");
    }
  }
}

// ---------------------------------------------------------------------------
// Tipos de dado
// ---------------------------------------------------------------------------

function validarListaConceitos(v: unknown, caminho: string, c: Coletor) {
  if (!Array.isArray(v)) {
    c.erro(2, caminho, "Deve ser uma lista, mesmo com um só item.");
    return;
  }
  v.forEach((item, i) => validarConceito(item, `${caminho}[${i}]`, false, c));
}

// CodeableConcept. Estrutura (nível 2): objeto com coding e/ou text.
// Perfil (nível 3): todo coding precisa de system e code.
function validarConceito(v: unknown, caminho: string, obrigatorio: boolean, c: Coletor) {
  if (v === undefined) {
    if (obrigatorio) c.erro(2, caminho, "Campo obrigatório ausente.");
    return;
  }
  if (!ehObjeto(v)) {
    c.erro(2, caminho, "Deve ser um objeto (CodeableConcept) com coding e/ou text.");
    return;
  }
  if (v.coding === undefined && v.text === undefined) {
    c.erro(2, caminho, 'O conceito precisa de "coding" e/ou "text".');
    return;
  }
  if (v.coding === undefined) {
    c.erro(3, caminho, 'O perfil exige "coding": só texto livre não é um código padronizado.');
    return;
  }
  if (!Array.isArray(v.coding)) {
    c.erro(2, `${caminho}.coding`, "Deve ser uma lista, mesmo com um só código.");
    return;
  }
  if (v.coding.length === 0) {
    c.erro(3, `${caminho}.coding`, "A lista de códigos está vazia.");
  }
  v.coding.forEach((cod, i) => {
    const p = `${caminho}.coding[${i}]`;
    if (!ehObjeto(cod)) {
      c.erro(2, p, "Cada coding deve ser um objeto.");
      return;
    }
    if (typeof cod.code !== "string" || cod.code === "") {
      c.erro(3, `${p}.code`, 'Falta o "code".');
    }
    if (typeof cod.system !== "string" || cod.system === "") {
      c.erro(
        3,
        `${p}.system`,
        'Falta o "system": sem ele o código é ambíguo, pois o mesmo código pode ter significados diferentes em catálogos diferentes.'
      );
    }
  });
}

// Referência a outro recurso. Deve coincidir com o fullUrl de alguma entrada
// (ou com "Tipo/id" de um recurso do pacote) e apontar para um Patient.
function validarSubject(v: unknown, caminho: string, todas: EntradaResolvida[], c: Coletor) {
  if (v === undefined) {
    c.erro(2, caminho, 'Campo "subject" obrigatório: indica a quem pertence o registro.');
    return;
  }
  if (!ehObjeto(v) || typeof v.reference !== "string" || v.reference === "") {
    c.erro(2, `${caminho}.reference`, 'O subject precisa de "reference".');
    return;
  }

  const ref = v.reference;
  const alvo = todas.find(
    (e) =>
      e.fullUrl === ref ||
      (typeof e.resource.id === "string" &&
        ref === `${String(e.resource.resourceType)}/${e.resource.id}`)
  );
  if (!alvo) {
    c.erro(
      2,
      `${caminho}.reference`,
      `A referência "${ref}" não aponta para nenhum recurso do pacote. Ela deve coincidir com o fullUrl de alguma entrada.`
    );
  } else if (alvo.resource.resourceType !== "Patient") {
    c.erro(
      2,
      `${caminho}.reference`,
      `O subject deve apontar para um Patient, mas "${ref}" aponta para ${String(alvo.resource.resourceType)}.`
    );
  }
}
