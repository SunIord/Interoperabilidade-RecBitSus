# Testando o Bundle em um servidor FHIR (sandbox)

O Bundle gerado pelo simulador pode ser enviado a um servidor FHIR público de
testes, para ver um servidor de verdade guardar e devolver os recursos. Aqui
usamos o **HAPI FHIR** (implementação de referência muito usada):

- Base da API (FHIR R4): <https://hapi.fhir.org/baseR4>
- Navegador de recursos: <https://hapi.fhir.org/>

> **É um servidor público e aberto.** Tudo o que você enviar pode ser visto por
> qualquer pessoa e pode ser apagado a qualquer momento. **Use apenas dados
> fictícios** (CPFs e nomes inventados).

## Por que o Bundle precisa virar `transaction`

O simulador gera um Bundle do tipo `collection`: um pacote de recursos que
**não manda o servidor fazer nada**. Para um servidor gravar os recursos de uma
vez, o pacote precisa ser uma `transaction`, em que cada entrada diz o que
fazer (`request`).

Mudam duas coisas, e só elas:

1. `"type": "collection"` vira `"type": "transaction"`.
2. Cada entrada ganha um `request`:
   `"request": { "method": "POST", "url": "Patient" }` (o `url` é o tipo do
   recurso da entrada).

O `fullUrl` e as referências `urn:uuid:...` **ficam como estão**. É assim que o
servidor liga a Observation e a Condition ao Patient: ele grava o paciente com
um id novo e troca as referências `urn:uuid` pelo endereço real. Esse é o
motivo prático de o `fullUrl` existir.

> Enviar cada recurso separadamente (por exemplo, só o Patient em
> `POST .../Patient`) também funciona, mas aí a referência `urn:uuid` da
> Observation não aponta para nada no servidor: seria preciso trocá-la à mão
> por `Patient/<id devolvido>`.

## Opção 1: pelo botão do simulador

Depois de gerar o Bundle, clique em **Enviar ao servidor de testes (HAPI)**. O
simulador converte para `transaction`, pede confirmação e mostra os links dos
recursos criados. Se o servidor recusar, mostra o motivo.

O JSON enviado é o do editor, então dá para alterá-lo antes (por exemplo, apagar
o `fullUrl` de uma entrada) e ver como o servidor reage.

O endereço do servidor pode ser trocado com a variável
`REACT_APP_FHIR_SANDBOX_URL` no build do frontend.

## Opção 2: pelo Postman, sem programar

1. Crie uma requisição **POST** para `https://hapi.fhir.org/baseR4`.
2. Em **Headers**, adicione `Content-Type: application/fhir+json`.
3. Em **Body → raw**, cole o JSON abaixo (ou o seu Bundle, com as duas
   mudanças descritas acima).
4. Envie. A resposta é um Bundle `transaction-response`; em cada entrada,
   `response.location` mostra onde o recurso foi gravado, por exemplo
   `Patient/12345/_history/1`.

### Exemplo de transaction

```json
{
  "resourceType": "Bundle",
  "type": "transaction",
  "entry": [
    {
      "fullUrl": "urn:uuid:11111111-1111-4111-8111-111111111111",
      "resource": {
        "resourceType": "Patient",
        "identifier": [
          {
            "system": "http://www.saude.gov.br/fhir/r4/NamingSystem/cpf",
            "value": "00000000000"
          }
        ],
        "name": [{ "use": "official", "family": "Ficticio", "given": ["Teste"] }],
        "gender": "female",
        "birthDate": "1985-03-21"
      },
      "request": { "method": "POST", "url": "Patient" }
    },
    {
      "fullUrl": "urn:uuid:22222222-2222-4222-8222-222222222222",
      "resource": {
        "resourceType": "Observation",
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
        "subject": { "reference": "urn:uuid:11111111-1111-4111-8111-111111111111" },
        "effectiveDateTime": "2024-05-10T09:30:00-03:00",
        "valueQuantity": {
          "value": 38.5,
          "unit": "°C",
          "system": "http://unitsofmeasure.org",
          "code": "Cel"
        }
      },
      "request": { "method": "POST", "url": "Observation" }
    },
    {
      "fullUrl": "urn:uuid:33333333-3333-4333-8333-333333333333",
      "resource": {
        "resourceType": "Condition",
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
        "subject": { "reference": "urn:uuid:11111111-1111-4111-8111-111111111111" },
        "recordedDate": "2024-05-10"
      },
      "request": { "method": "POST", "url": "Condition" }
    }
  ]
}
```

## Opção 3: pelo terminal (curl)

Salve a transaction em um arquivo (por exemplo, `transacao.json`) e envie:

```bash
curl -X POST https://hapi.fhir.org/baseR4 \
  -H "Content-Type: application/fhir+json" \
  --data-binary @transacao.json
```

### Só validar, sem gravar

O HAPI tem uma operação que **confere o recurso sem guardá-lo**:

```bash
curl -X POST "https://hapi.fhir.org/baseR4/Bundle/\$validate" \
  -H "Content-Type: application/fhir+json" \
  --data-binary @transacao.json
```

A resposta é um `OperationOutcome` com os problemas. Com o exemplo acima, o
servidor não aponta **nenhum erro**; aparecem apenas avisos de boas práticas
(recurso sem narrativa, observação sem `performer`) e o aviso de que ele não
conhece os catálogos LOINC e BRCID10 para conferir os códigos. Isso é esperado
e não significa que o JSON esteja errado.

## Lendo o que foi gravado

Troque `<id>` pelo número devolvido em `response.location`:

```bash
# o paciente
curl https://hapi.fhir.org/baseR4/Patient/<id>

# achar pacientes pelo CPF
curl "https://hapi.fhir.org/baseR4/Patient?identifier=http://www.saude.gov.br/fhir/r4/NamingSystem/cpf|00000000000"

# observações desse paciente
curl "https://hapi.fhir.org/baseR4/Observation?subject=Patient/<id>"
```

Como o servidor é compartilhado, a busca por CPF pode devolver recursos de
outras pessoas que usaram o mesmo valor. Prefira buscar pelo `id` que você
recebeu.

## Para experimentar

Sugestões de alterações para ver como o servidor reage. Elas não foram
testadas uma a uma: o resultado exato depende da versão do servidor.

- Remova o `request` de uma entrada e envie: o esperado é que o servidor
  recuse, pois toda entrada de uma `transaction` precisa dizer o que fazer.
- Troque o `fullUrl` de uma entrada sem trocar a referência que aponta para
  ele: o esperado é uma reclamação sobre a referência sem destino. Compare com
  o que o validador do simulador (`POST /validate`) diz sobre o mesmo erro.
- Troque `"gender": "female"` por `"Feminino"` e use o `$validate`: o esperado
  é que o servidor aponte o valor fora do conjunto permitido.
