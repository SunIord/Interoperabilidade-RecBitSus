# Documentação da API

API REST do simulador de interoperabilidade FHIR. Valida os dados do
formulário, gera Bundles FHIR R4 do tipo `collection` (Patient, Observation e
Condition), armazena-os em um arquivo JSON e oferece um validador didático de
Bundles.

- Código: [backend/](../backend/) (rotas em [app.ts](../backend/app.ts))
- Base URL local: `http://localhost:3001`
- Formato: JSON (`Content-Type: application/json`)
- Autenticação: nenhuma

## Como executar

```bash
cd backend
npm install
npm run build      # compila para backend/dist
npm start          # node dist/server.js
```

Em desenvolvimento, `npm run dev` roda direto o TypeScript (`ts-node`).

### Configuração (variáveis de ambiente)

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor |
| `DB_PATH` | `backend/bundles.json` | Arquivo usado como banco. O padrão é o mesmo rodando de `ts-node` ou de `dist/`. |
| `FRONTEND_DIR` | `frontend/build` | Pasta com a interface compilada. Se tiver um `index.html`, o servidor também serve a interface (ver abaixo). |
| `CORS_ORIGIN` | vazio (qualquer origem) | Origens permitidas, separadas por vírgula. Ex.: `http://localhost:3000,https://app.exemplo.com`. `*` libera todas. |

### Testes

```bash
cd backend
npm test
```

Os testes ficam em [tests/](../tests/) e usam o executor nativo do Node
(`node:test`), sem dependências extras. Cada execução usa um banco temporário e
não toca em `bundles.json`.

---

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Interface (se `frontend/build` existir) ou texto de confirmação da API |
| GET | `/health` | Verificação de saúde: `{"status":"ok"}` |
| POST | `/bundle` | Valida os dados, gera e salva um Bundle |
| GET | `/bundle/cpf/:cpf` | Busca Bundles pelo CPF do paciente |
| GET | `/bundle/:id` | Busca um Bundle pelo `id` |
| GET | `/bundles` | Lista todos os Bundles |
| DELETE | `/bundle/:id` | Remove um Bundle pelo `id` |
| POST | `/validate` | Valida um Bundle (por exemplo, editado pelo aluno) |

### `GET /` e `GET /health`

Quando existe `frontend/build/index.html`, o servidor **serve a interface**: `/`
devolve o `index.html` (sem cache) e os arquivos em `/static/*` saem com cache
longo e imutável (têm hash no nome). A interface e a API ficam na **mesma
origem**, então o frontend chama a API por caminho relativo.

Sem o frontend compilado, `/` responde `200` em texto puro:

```
Servidor FHIR rodando 🚀
```

`GET /health` sempre responde `200` com `{"status":"ok"}` e é o que o Render usa
como verificação de saúde. Passo a passo do deploy em [deploy.md](deploy.md).

### `POST /bundle`

Valida os dados do formulário, monta o Bundle, salva e devolve o Bundle criado
(`201 Created`).

**Corpo da requisição.** Todos os campos são obrigatórios.

| Campo | Tipo | Regras |
|---|---|---|
| `cpf` | string | 11 dígitos. Pontos, traço e espaços são aceitos e removidos. Salvo só com dígitos. |
| `given` | string ou string[] | Ao menos um nome, sem itens vazios, até 10 nomes de até 100 caracteres. Uma string vira lista de um item. |
| `family` | string | Até 100 caracteres |
| `gender` | string | `female`, `male`, `other` ou `unknown` |
| `birthDate` | string | `AAAA-MM-DD`, data real do calendário, não pode ser futura |
| `observacao` | string | Chave do catálogo de observações (ver abaixo) |
| `status` | string | `registered`, `preliminary`, `final` ou `amended` |
| `value` | number ou string | Número finito, dentro da faixa plausível da observação (temperatura: 25 a 45 °C) |
| `effectiveDateTime` | string | `AAAA-MM-DDTHH:mm` (segundos e fuso opcionais). Sem fuso, assume `-03:00`. Não pode ser futura nem anterior ao nascimento. |
| `condicao` | string | Chave do catálogo de condições (ver abaixo) |
| `clinicalStatus` | string | `active`, `inactive`, `remission` ou `resolved` |
| `recordedDate` | string | `AAAA-MM-DD`, data real, não pode ser futura nem anterior ao nascimento |

Textos são aparados (espaços nas pontas removidos). Campos desconhecidos são
ignorados e não entram no Bundle. O CPF **não** tem o dígito verificador
conferido, para permitir CPFs fictícios nas atividades.

**Exemplo**

```bash
curl -X POST http://localhost:3001/bundle \
  -H "Content-Type: application/json" \
  -d '{
    "cpf": "12345678910",
    "given": ["Maria", "Aparecida"],
    "family": "Silva",
    "gender": "female",
    "birthDate": "1985-03-21",
    "observacao": "temperatura",
    "status": "final",
    "value": "38.5",
    "effectiveDateTime": "2024-05-10T09:30",
    "condicao": "febre",
    "clinicalStatus": "active",
    "recordedDate": "2024-05-10"
  }'
```

**Resposta `201`**: o Bundle criado (resumido).

```json
{
  "resourceType": "Bundle",
  "id": "d236ab8b-4341-496e-a7b5-92fd9813ae1a",
  "type": "collection",
  "entry": [
    {
      "fullUrl": "urn:uuid:434e5536-5419-4306-a3c7-53884b73ba38",
      "resource": {
        "resourceType": "Patient",
        "id": "434e5536-5419-4306-a3c7-53884b73ba38",
        "identifier": [
          {
            "system": "http://www.saude.gov.br/fhir/r4/NamingSystem/cpf",
            "value": "12345678910"
          }
        ],
        "name": [
          { "use": "official", "family": "Silva", "given": ["Maria", "Aparecida"] }
        ],
        "gender": "female",
        "birthDate": "1985-03-21"
      }
    },
    {
      "fullUrl": "urn:uuid:cfdc2c57-1e04-4252-95da-145e1e8edbf3",
      "resource": {
        "resourceType": "Observation",
        "id": "cfdc2c57-1e04-4252-95da-145e1e8edbf3",
        "status": "final",
        "category": [
          {
            "coding": [
              {
                "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                "code": "vital-signs",
                "display": "Vital Signs"
              }
            ]
          }
        ],
        "code": {
          "coding": [
            { "system": "http://loinc.org", "code": "8310-5", "display": "Body temperature" }
          ],
          "text": "Temperatura corporal"
        },
        "subject": { "reference": "urn:uuid:434e5536-5419-4306-a3c7-53884b73ba38" },
        "effectiveDateTime": "2024-05-10T09:30:00-03:00",
        "valueQuantity": {
          "value": 38.5,
          "unit": "°C",
          "system": "http://unitsofmeasure.org",
          "code": "Cel"
        }
      }
    },
    {
      "fullUrl": "urn:uuid:29078915-fa71-42ad-8db9-1311680cb993",
      "resource": {
        "resourceType": "Condition",
        "id": "29078915-fa71-42ad-8db9-1311680cb993",
        "clinicalStatus": {
          "coding": [
            {
              "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
              "code": "active"
            }
          ]
        },
        "code": {
          "coding": [
            {
              "system": "http://www.saude.gov.br/fhir/r4/CodeSystem/BRCID10",
              "code": "R50.9",
              "display": "Febre não especificada"
            }
          ],
          "text": "Febre"
        },
        "subject": { "reference": "urn:uuid:434e5536-5419-4306-a3c7-53884b73ba38" },
        "recordedDate": "2024-05-10"
      }
    }
  ]
}
```

**Erros**

| Status | Quando | Corpo |
|---|---|---|
| `400` | Algum campo inválido ou ausente. Todos os erros são devolvidos de uma vez. | `{ "error": "Dados inválidos", "detalhes": [{ "campo", "mensagem" }] }` |
| `400` | Sem corpo, ou corpo que não é um objeto JSON | idem, com `campo: "corpo"` |
| `400` | JSON malformado | `{ "error": "JSON malformado", "detalhe": "..." }` |
| `413` | Corpo maior que 1 MB | `{ "error": "Corpo da requisição grande demais" }` |

Exemplo de `400`:

```json
{
  "error": "Dados inválidos",
  "detalhes": [
    { "campo": "cpf", "mensagem": "O CPF deve ter 11 dígitos." },
    { "campo": "gender", "mensagem": "Valor inválido. Use: female, male, other, unknown." },
    { "campo": "value", "mensagem": "Fora da faixa plausível (25 a 45 °C)." }
  ]
}
```

Nada é gravado quando a validação falha.

### `GET /bundle/cpf/:cpf`

Devolve um **array** com todos os Bundles cujo Patient tem o CPF informado. O
CPF pode vir com ou sem pontuação (`123.456.789-10` e `12345678910` são o
mesmo).

```bash
curl http://localhost:3001/bundle/cpf/12345678910
```

| Status | Quando | Corpo |
|---|---|---|
| `200` | Há ao menos um Bundle | Array de Bundles |
| `400` | O CPF não tem 11 dígitos | `{ "error": "O CPF deve ter 11 dígitos." }` |
| `404` | Nenhum Bundle encontrado | `{ "error": "Nenhum bundle encontrado" }` |

> Formatos de resposta: `POST /bundle` e `GET /bundle/:id` devolvem um
> **objeto**; `GET /bundle/cpf/:cpf` e `GET /bundles` devolvem **arrays**.

### `GET /bundle/:id`

Devolve o Bundle (objeto) cujo `id` coincide, ou `404` com
`{ "error": "Bundle não encontrado" }`.

### `GET /bundles`

Devolve um array com todos os Bundles salvos (`200`). Array vazio se não houver
nenhum.

```bash
curl http://localhost:3001/bundles
```

### `DELETE /bundle/:id`

Remove o Bundle cujo `id` (o do Bundle, não o do Patient) coincide com o
informado.

```bash
curl -X DELETE http://localhost:3001/bundle/d236ab8b-4341-496e-a7b5-92fd9813ae1a
```

| Status | Quando | Corpo |
|---|---|---|
| `200` | Removido | `{ "message": "Removido" }` |
| `404` | O `id` não existe | `{ "error": "Bundle não encontrado" }` |

### `POST /validate`

Validador **didático**. Recebe um Bundle (por exemplo, um que o aluno editou à
mão), aponta o que está errado e **não grava nada**. Segue os três níveis de
correção da apostila:

| Nível | Pergunta | Exemplos do que aponta |
|---|---|---|
| 1. Sintaxe | O JSON está bem formado? | JSON malformado, corpo ausente, corpo que não é objeto |
| 2. Estrutura | Respeita a estrutura do FHIR? | `resourceType` ausente, `fullUrl` ausente ou repetido, `reference` sem destino, `gender` fora do value set, data em formato errado, `identifier`/`name` que não são lista, `value` entre aspas, elemento com erro de grafia |
| 3. Perfil | Cumpre as regras do perfil? | `coding` sem `system`, CPF sem o `system` correto, `valueQuantity` sem UCUM, `effectiveDateTime` sem fuso, `category`/`clinicalStatus` ausentes, Bundle sem Patient |

> As regras do nível 3 são **simplificadas** e inspiradas no BR-Core. Não
> substituem a validação oficial e não servem para homologar envios reais à
> RNDS.

```bash
curl -X POST http://localhost:3001/validate \
  -H "Content-Type: application/json" \
  -d @bundle-editado.json
```

**Resposta `200`** (mesmo quando o Bundle é inválido):

```json
{
  "valido": false,
  "resumo": { "sintaxe": true, "estrutura": true, "perfil": false },
  "problemas": [
    {
      "nivel": 3,
      "severidade": "erro",
      "caminho": "$.entry[2].resource.code.coding[0].system",
      "mensagem": "Falta o \"system\": sem ele o código é ambíguo, pois o mesmo código pode ter significados diferentes em catálogos diferentes."
    }
  ]
}
```

- `valido` é `true` apenas quando não há nenhum problema de severidade `erro`.
- `severidade` é `erro` ou `aviso`. Avisos (por exemplo, um recurso de tipo que
  o validador não conhece) não invalidam o Bundle.
- `caminho` usa a notação `$.entry[2].resource...`.
- Elementos válidos do FHIR que o simulador não gera (como `telecom`) são
  aceitos.

| Status | Quando |
|---|---|
| `200` | Validou (válido ou não) |
| `400` | JSON malformado ou corpo ausente. A resposta tem o mesmo formato, com um problema de nível 1. |

---

## Estrutura do Bundle gerado

- `type: "collection"`, com três entradas, nesta ordem: Patient, Observation,
  Condition.
- Cada entrada tem `fullUrl` no formato `urn:uuid:<uuid>`.
- Observation e Condition referenciam o paciente por `subject.reference`,
  usando o **`fullUrl` do Patient** (e não `Patient/<id>`).
- Todos os identificadores (`id` do Bundle e dos recursos) são UUIDs gerados
  pelo servidor.

## Catálogo

Definido em [backend/catalogo.ts](../backend/catalogo.ts). Os valores enviados
em `observacao` e `condicao` devem ser uma das chaves abaixo.

### Observações (`observacao`)

| Chave | Código | Sistema | Unidade (UCUM) | Categoria | Faixa aceita |
|---|---|---|---|---|---|
| `temperatura` | `8310-5` (Body temperature) | `http://loinc.org` | `°C` / `Cel` | `vital-signs` | 25 a 45 |

### Condições (`condicao`)

| Chave | Código | Sistema |
|---|---|---|
| `febre` | `R50.9` (Febre não especificada) | `http://www.saude.gov.br/fhir/r4/CodeSystem/BRCID10` |

### Sistemas de código usados

| Uso | URL |
|---|---|
| CPF | `http://www.saude.gov.br/fhir/r4/NamingSystem/cpf` |
| LOINC | `http://loinc.org` |
| UCUM | `http://unitsofmeasure.org` |
| CID-10 | `http://www.saude.gov.br/fhir/r4/CodeSystem/BRCID10` |
| Categoria da Observation | `http://terminology.hl7.org/CodeSystem/observation-category` |
| Situação clínica da Condition | `http://terminology.hl7.org/CodeSystem/condition-clinical` |

> As URLs de CPF e CID-10 seguem a apostila e ainda não foram conferidas na
> documentação oficial do BR-Core/RNDS.

Para acrescentar uma opção, basta adicionar uma entrada em `OBSERVACOES` ou
`CONDICOES`.

---

## Erros gerais

| Status | Quando | Corpo |
|---|---|---|
| `404` | Rota inexistente | `{ "error": "Rota não encontrada" }` |
| `500` | Banco ilegível (arquivo corrompido ou com formato inesperado) | `{ "error": "Banco ilegível ..." }` |
| `500` | Qualquer outro erro inesperado | `{ "error": "Erro interno do servidor" }` (sem stack trace) |

Quando o banco está corrompido, o servidor **não sobrescreve o arquivo**: ele
falha de forma visível para você corrigir ou restaurar.

## Persistência

- Banco em arquivo JSON (`DB_PATH`). Cada gravação escreve um arquivo
  temporário e o renomeia, para o banco nunca ficar pela metade.
- As operações são síncronas, então dentro de um processo cada
  leitura-modificação-escrita é atômica (o teste de 20 requisições simultâneas
  cobre isso). Não há proteção entre **vários processos** usando o mesmo
  arquivo.

## Limitações conhecidas

Planejadas em [melhorias.md](../melhorias.md).

- **O CPF não tem o dígito verificador conferido**, de propósito, para aceitar
  CPFs fictícios.
- **O catálogo é mínimo** (uma observação e uma condição).
- **Dados antigos.** Bundles gravados antes do formato atual (sem `fullUrl`,
  só Patient e Observation) continuam no arquivo. As buscas por CPF e por `id`
  os encontram, mas eles não seguem o formato descrito aqui e não passariam no
  `/validate`.
- **Sem autenticação nem limite de requisições.** Não exponha à internet sem
  uma camada na frente.
- **Banco em arquivo.** Em hospedagens de disco efêmero, os dados se perdem a
  cada reinício.
