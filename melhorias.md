# Plano de melhorias

Arquivo de contexto para evoluir o projeto. Resume o estado atual, a meta e o
que foi feito e o que falta. Foco em **código, dados e documentação**; ajustes
visuais (estilo, layout, aparência) estão **fora de escopo**.

Última revisão: 2026-10-27 (catálogo ampliado, documentação revisada, tudo commitado exceto esta etapa).

Legenda: ✅ feito · ◐ parcial · ⬜ pendente.

---

## 0. Painel de progresso

| Bloco | Itens | Estado |
|---|---|---|
| P0 backend: gerador alinhado à apostila | 1 a 4 | ✅ feito |
| P1 backend: validação, validador, banco, config | 10 a 16 | ✅ feito |
| P0 frontend: formulário alinhado | 5 a 9 | ✅ feito |
| P1 frontend: comportamento | 17 a 20 | ✅ feito |
| Testes do backend | 29 (parte) | ✅ feito (163 testes) |
| Testes do frontend | 29 (parte) | ✅ feito (62 testes) |
| Documentação da API | n/a | ✅ feita ([docs/api.md](docs/api.md)) |
| Sandbox HAPI (botão) e Postman/curl | 21, 22 | ✅ feito ([docs/sandbox.md](docs/sandbox.md)) |
| P2 higiene e configuração | 23 a 28 | ✅ feito |
| README | 30 | ✅ feito (comandos, fluxo, estrutura do Bundle e arquitetura) |
| Vulnerabilidades do `npm audit` | 23, 26 | ✅ backend: 0. Frontend: 53 restantes, só nas ferramentas de build (ver item 26) |
| Deploy no Render preparado (config, build, testes) | 31 | ✅ pronto para publicar |
| Catálogo ampliado | 33 | ✅ 4 observações e 4 condições |
| Publicar no Render e pôr o link na apostila | 31 | ⬜ depende do push (aguardando acesso ao repositório) e de você criar o serviço |
| Conferir URLs de `system` | 32 | ⬜ pendente |

**Situação atual em uma frase:** tudo o que dependia só de código está feito
e testado (backend, frontend, validador, sandbox, deploy preparado, higiene do
repositório). Falta o que depende de você ou de fora: **push, criar o serviço no
Render, conferir as URLs de `system` e olhar a tela num navegador**.

**Atualizações mais recentes (2026-10-27):**

- **Catálogo ampliado (item 33):** observações `frequencia-cardiaca` (LOINC
  8867-4), `saturacao-oxigenio` (59408-5) e `glicemia` (2339-0, categoria
  `laboratory`); condições `hipertensao` (CID-10 I10), `diabetes-tipo-2`
  (E11.9) e `infeccao-vias-aereas` (J06.9). Novo
  [tests/catalogo.test.ts](tests/catalogo.test.ts): cada item gera um Bundle
  aprovado pelo `/validate` e o catálogo do frontend precisa espelhar o do
  backend (o teste falha se divergirem).
- **Documentação revisada** contra o código: [docs/api.md](docs/api.md)
  (catálogo, limitações) e README (arquitetura, fluxo, estrutura do Bundle,
  persistência, comandos para rodar tudo numa porta só).
- **Git:** todo o trabalho anterior está commitado em 7 commits na branch
  `feat/alinhamento-fhir` (só local; o push espera o convite ao repositório).
  Esta etapa (catálogo, docs, `melhorias.md`) está no disco, sem commit.
- **Verificado de novo:** build do frontend e do backend e o servidor servindo
  interface + API numa só porta (`/`, `/static`, `/health`, `POST /bundle`,
  busca por CPF). Obs.: os `node_modules` desta cópia estão sem permissão de
  execução; refaça o `npm install` se `npm run build` der "Permission denied".

**Atualizações de 2026-10-26:**

- **Sandbox HAPI (itens 21 e 22):** botão "Enviar ao servidor de testes (HAPI)"
  no editor do JSON, que converte o Bundle em `transaction` e mostra os
  recursos criados; guia de Postman/curl em [docs/sandbox.md](docs/sandbox.md).
  Detalhes e o que **não** foi verificado no item 21.
- **Higiene P2 (itens 23 a 28):** `backend/package.json` de 76 para 2
  dependências, `npm audit` do backend de 3 vulnerabilidades (1 crítica) para
  **0**; axios do frontend corrigido (alta); `App.css`/`styles.css` removidos;
  `bundles.json` fora do git; `.gitattributes` criado.
- **README (item 30):** só os comandos de `curl` foram atualizados, a pedido.
- **Git:** (desatualizado; ver 2026-10-27) as mudanças desta etapa foram
  depois commitadas na `feat/alinhamento-fhir`.

- **Deploy preparado (opção "um serviço só", decisão 5):** o Express agora
  serve também o `frontend/build` (mesma origem, sem CORS), há `GET /health` e
  um [render.yaml](render.yaml). O frontend, em produção, chama a API por
  caminho relativo (`REACT_APP_API_URL` só é preciso para apontar a outro
  servidor). Guia em [docs/deploy.md](docs/deploy.md). Verificado: `npm ci`
  a partir dos lockfiles; build e start com os **mesmos comandos do
  `render.yaml`** numa cópia limpa do projeto; interface, assets com cache
  correto e API respondendo na mesma porta. 148 testes do backend (13 novos) e
  30 do frontend (4 novos). **Não** foi testado no Render de verdade nem num
  navegador.

- Reportado "backend não roda": a causa era o comando `node server.ts` do README
  antigo. Verificado que `npm run dev` (ts-node) e `npm start` (`dist/server.js`)
  sobem e respondem `200`; o README foi corrigido. Se a porta 3001 já estiver
  em uso, o servidor falha com `EADDRINUSE` (use `PORT=3002 npm start`).
- `npm audit` apontou 3 vulnerabilidades no backend (item 23).

**O que NÃO foi verificado:** o frontend **não foi aberto em um navegador**. A
verificação foi por testes de componente (26), type-check, build de produção e
um script que usa o mesmo código de rede e de montagem do payload contra o
servidor real. Falta olhar a tela de verdade (ver seção 8).

### Como rodar

```bash
cd backend
npm install
npm test           # 163 testes (compila e roda com node:test)
npm run build && npm start     # API em http://localhost:3001

cd ../frontend
npm install
npm test -- --watchAll=false   # 62 testes
npm start                      # http://localhost:3000
```

Para apontar o frontend para outra API: `REACT_APP_API_URL=https://... npm start`.

---

## 1. Contexto

- Projeto: simulador educacional de interoperabilidade FHIR (RecBitSus, Grupo 7,
  Aula 7). Repo: <https://github.com/Daniel-Nas/Interoperabilidade-RecBitSus>
- Stack: backend Express 5 + TypeScript (JSON em arquivo como banco, porta 3001);
  frontend React 19 + CRA (`react-scripts` 5) + axios.
- A atividade prática da apostila usa este simulador: o aluno preenche um
  formulário, gera um Bundle, lê o JSON e o altera para ver como a estrutura
  reage.
- Deploy: **preparado para o Render** como um serviço único (API + interface),
  mas ainda não publicado. Ver [docs/deploy.md](docs/deploy.md).

### Arquivos que importam

- [docs/apostila.tex](docs/apostila.tex): a apostila (LaTeX), antes `main.tex`
  na raiz. **É a fonte de verdade** do que o simulador deve produzir. Já foi
  atualizada com o feedback recebido. Ainda não está commitada.
- `info.txt` (link do repo, link de deploy pendente e o feedback das duas
  revisões) não está mais no repo; o feedback foi resumido na seção 7.

> A especificação-alvo está resumida na seção 3 para que este arquivo seja
> suficiente como contexto.

### Mapa do backend

| Arquivo | Papel |
|---|---|
| [backend/server.ts](backend/server.ts) | Ponto de entrada: lê `PORT`, `DB_PATH`, `CORS_ORIGIN` e sobe o servidor |
| [backend/app.ts](backend/app.ts) | `createApp()`: rotas, CORS e tratamento de erros (testável sem abrir porta) |
| [backend/fhir.ts](backend/fhir.ts) | Tipos e `generateFHIRBundle()` |
| [backend/catalogo.ts](backend/catalogo.ts) | Catálogo de terminologias, URLs de `system`, value sets |
| [backend/validacao.ts](backend/validacao.ts) | Valida a **entrada** do `POST /bundle` |
| [backend/validador.ts](backend/validador.ts) | Valida um **Bundle** pronto (`POST /validate`), em 3 níveis |
| [backend/db.ts](backend/db.ts) | Banco em arquivo JSON, com gravação atômica |
| [tests/](tests/) | Testes do backend (`node:test`) |
| [docs/api.md](docs/api.md) | Documentação da API |

### Mapa do frontend

| Arquivo | Papel |
|---|---|
| [frontend/src/App.tsx](frontend/src/App.tsx) | Tela: formulário (Patient, Observation, Condition), busca por CPF, editor do JSON e resultado da validação |
| [frontend/src/api.ts](frontend/src/api.ts) | Cliente da API (`criarBundle`, `buscarPorCpf`, `validarBundle`) e tradução de erros; em produção usa caminho relativo, em desenvolvimento `localhost:3001`; `REACT_APP_API_URL` tem prioridade |
| [frontend/src/formulario.ts](frontend/src/formulario.ts) | Estado inicial do formulário e `montarPayload()` |
| [frontend/src/sandbox.ts](frontend/src/sandbox.ts) | Envio opcional ao servidor público HAPI: `paraTransacao()` e `enviarAoSandbox()` |
| [frontend/src/catalogo.ts](frontend/src/catalogo.ts) | Opções dos seletores (cópia do catálogo do backend, ver nota abaixo) |
| [frontend/src/types.ts](frontend/src/types.ts) | Tipos do contrato da API |
| `frontend/src/*.test.ts(x)`, `setupTests.ts` | Testes (Jest + Testing Library) |

> O catálogo do frontend é uma **cópia** do backend. Se entrar uma nova
> observação ou condição, é preciso alterar `backend/catalogo.ts` **e**
> `frontend/src/catalogo.ts`. Alternativa para evitar a duplicação: um endpoint
> `GET /catalogo` no backend.

---

## 2. Decisão tomada

**A apostila é superior ao código em todas as divergências; o código deve ser
alinhado a ela, não o contrário.** A apostila não será alterada para refletir o
código atual.

---

## 3. Meta: o que o simulador deve gerar

Um Bundle FHIR R4 do tipo `collection` com **Patient, Observation e
Condition**, como nos exemplos da apostila.

### 3.1 Bundle

- `resourceType: "Bundle"`, `type: "collection"`.
- Cada `entry` tem `fullUrl` no formato `urn:uuid:<uuid>` e `resource`.
- As referências entre recursos (`subject.reference`) usam o `fullUrl` do
  Patient, **não** `Patient/<id>`.
- Regra a ensinar: `reference` deve coincidir com o `fullUrl` de alguma entrada.

### 3.2 Patient

- `identifier[]` com `system` (URI do CPF) e `value`.
- `name[]` com `use`, `family` e `given[]` (lista).
- `gender` restrito a `female | male | other | unknown`.
- `birthDate` em `AAAA-MM-DD`.

### 3.3 Observation

- `status` (ex.: `final`).
- `category[]` como CodeableConcept (ex.: `vital-signs`).
- `code` como CodeableConcept com `coding[]` (`system`, `code`, `display`) e
  `text`. Exemplo da apostila: LOINC `8310-5`, temperatura corporal.
- `subject.reference` apontando para o `fullUrl` do Patient.
- `effectiveDateTime` **com fuso** (ex.: `2026-10-09T09:30:00-03:00`).
- `valueQuantity` com `value`, `unit`, `system` (UCUM) e `code` (ex.: `Cel`).

### 3.4 Condition

- `clinicalStatus` como CodeableConcept (system
  `condition-clinical`, ex.: `active`).
- `code` como CodeableConcept. Apostila: CID-10 `R50.9` (febre não
  especificada). O feedback também pede citar **CIAP-2** (problemas na atenção
  primária); a apostila já o menciona, mas o simulador oferece só CID-10
  por enquanto (agora com 4 condições, ver item 33).
- `subject.reference` apontando para o `fullUrl` do Patient.
- `recordedDate` em `AAAA-MM-DD`.

---

## 4. Divergências entre a apostila e o código

**Backend e frontend estão alinhados à apostila.** As divergências da primeira
análise foram todas resolvidas:

| Tema | Apostila | Backend | Frontend |
|---|---|---|---|
| Recursos | Patient, Observation, Condition | ✅ os três | ✅ seções dos três |
| `fullUrl` e referências | `urn:uuid:...`, `subject` aponta para o `fullUrl` | ✅ | ✅ exibe o JSON gerado |
| CPF `system` | URI | ✅ | n/a |
| Nome | `family` + `given[]` | ✅ | ✅ campos separados |
| `gender` | value set FHIR | ✅ validado | ✅ seletor |
| `code`/`category` | CodeableConcept com `coding` | ✅ via catálogo | ✅ seletor do catálogo |
| `valueQuantity` | `system` e `code` UCUM | ✅ | ✅ unidade vem do catálogo |
| `effectiveDateTime` | com fuso | ✅ completa `-03:00` | ✅ `datetime-local` |
| Campos extras (`active`, `telecom`, `address`, `contact`) | não aparecem | ✅ removidos | ✅ removidos do formulário |

Contrato do `POST /bundle` (detalhes em [docs/api.md](docs/api.md)): `cpf`,
`given`, `family`, `gender`, `birthDate`, `observacao`, `status`, `value`,
`effectiveDateTime`, `condicao`, `clinicalStatus`, `recordedDate`.

---

## 5. Itens

### P0. Alinhar o gerador à apostila (backend) ✅

1. ✅ Reescrever `generateFHIRBundle` para produzir o Bundle da seção 3,
   incluindo a Condition. (agora em [backend/fhir.ts](backend/fhir.ts))
2. ✅ UUIDs reais (`crypto.randomUUID()`) em `fullUrl` e `id`. Elimina a
   colisão de ids por `Date.now()`.
3. ✅ Catálogo mínimo e fixo em [backend/catalogo.ts](backend/catalogo.ts):
   temperatura (LOINC 8310-5, UCUM `Cel`) e febre (CID-10 R50.9). Busca só em
   chaves próprias (evita `constructor`/`__proto__` como chave).
4. ✅ Tipagem do corpo e do Bundle (sem `any` no fluxo principal).

### P0. Alinhar o formulário (frontend) ✅

5. ✅ Seletores para `gender`, `status`, observação, condição e
   `clinicalStatus`. Os rótulos mostram o código do FHIR/catálogo (ex.:
   "Feminino (female)", "Febre (CID-10 R50.9)"), para o aluno ver de onde vem
   cada valor do JSON.
6. ✅ Nome separado em `given` (um ou mais nomes separados por espaço, viram
   lista) e `family` (sobrenome).
7. ✅ Seção Condition com `condicao`, `clinicalStatus` e `recordedDate`.
8. ✅ O backend normaliza o fuso; o frontend envia o `datetime-local` como está.
9. ✅ Payload tipado (`BundleInput`) e sem os campos que deixaram de existir.

> A atividade da apostila exige que o JSON possa ser **editado e quebrado**
> pelo aluno. Isso é o item 20, também feito.

### P1. Backend: robustez ✅

10. ✅ Validação de entrada com `400` e lista de erros por campo (obrigatórios,
    value sets, CPF com 11 dígitos, datas reais, sem futuro, faixa do valor).
11. ✅ CPF normalizado na gravação e na busca (aceita pontuação).
12. ✅ Validador didático `POST /validate` nos 3 níveis da apostila (sintaxe,
    estrutura, perfil), com caminho exato de cada problema. Sustenta os
    exercícios (d), (e) e a questão sobre referência inexistente.
13. ✅ `DELETE /bundle/:id` responde `404` quando o id não existe.
14. ✅ Banco corrompido falha com `500` e **não sobrescreve** o arquivo;
    gravação atômica (arquivo temporário + rename).
15. ✅ `PORT`, `DB_PATH` e `CORS_ORIGIN` por variável de ambiente.
16. ✅ Decisão: manter `POST` devolvendo objeto e as buscas devolvendo array
    (documentado). Adicionados `201` no `POST` e `GET /bundle/:id`.

### P1. Frontend: comportamento ✅

17. ✅ URL da API via `REACT_APP_API_URL` (padrão `http://localhost:3001`).
18. ✅ Erros visíveis: os `detalhes` do backend aparecem ao lado de cada campo
    (e somem quando o campo é editado). "Servidor fora do ar", "CPF sem
    resultado" e erros do servidor têm mensagens distintas num aviso no topo.
19. ✅ `console.log` de depuração removidos.
20. ✅ O JSON gerado abre num **editor editável**. "Validar JSON" envia o
    texto a `POST /validate` e mostra o resumo dos 3 níveis (✓/✗) e a lista de
    problemas com nível, severidade, caminho e mensagem. JSON malformado é
    apontado como nível 1 no próprio navegador. "Restaurar original" desfaz as
    edições. Da busca por CPF dá para abrir um bundle no editor.

### P1. Integração com sandbox (feedback das revisões) ✅

21. ✅ Botão **Enviar ao servidor de testes (HAPI)** no editor do JSON
    ([sandbox.ts](frontend/src/sandbox.ts), 32 testes). Converte o Bundle
    `collection` em `transaction` (um `POST` por recurso, **mantendo o
    `fullUrl` e as referências `urn:uuid`**, que o servidor usa para ligar os
    recursos), pede **confirmação** antes de enviar (é um servidor público),
    envia o JSON **como está no editor** e mostra links dos recursos criados
    ou os motivos da recusa (`OperationOutcome`). O endereço pode ser trocado
    com `REACT_APP_FHIR_SANDBOX_URL`.
    **Verificado:** o servidor está no ar, declara FHIR 4.0.1 (R4) e libera
    CORS (consulta somente leitura); e a operação `$validate` do HAPI (que não
    grava) aceitou a transaction gerada pelo nosso backend com **0 erros** e 6
    avisos benignos (sem narrativa, sem `performer`, catálogos LOINC e BRCID10
    desconhecidos pelo servidor).
    **Não verificado:** o envio que **grava** de verdade (evitei publicar dados
    num servidor aberto durante os testes) e o clique no navegador.
22. ✅ Postman/curl documentados em [docs/sandbox.md](docs/sandbox.md):
    por que virar `transaction`, passo a passo no Postman, exemplo completo de
    transaction, `curl`, `$validate` e como ler o que foi gravado. Por pedido,
    o **README não foi ampliado** com isso.

### P2. Higiene e configuração ✅

23. ✅ `backend/package.json` enxugado de **76 para 2 dependências**
    (`express` e `cors`; as demais eram transitivas), scripts
    `build`/`start`/`dev`/`test`, `main` corrigido, lock regenerado (`npm ci`
    validado num diretório limpo). `npm audit fix` sem `--force`: **0
    vulnerabilidades** (antes 3, uma crítica): `body-parser` 2.4.0,
    `proxy-addr` 2.0.8, `qs` 6.16.1. 148 testes e build seguem passando.
24. ✅ `backend/dist/` e `backend/.build-test/` no [.gitignore](.gitignore).
25. ✅ [types.ts](frontend/src/types.ts) reescrito com os tipos reais da API;
    `App.css` e `styles.css` (sem uso) removidos do repositório.
26. ✅ **Revisado; decisão: não migrar para Vite agora.**
    - `npm audit fix` sem `--force` no frontend: **axios 1.18 → 1.20** (era
      vulnerabilidade alta e é o único pacote de terceiros, além do React, que
      vai no código entregue ao navegador). Total de vulnerabilidades 74 → 53;
      críticas 2 → 0; altas 29 → 15.
    - As 53 restantes estão na cadeia de ferramentas de build do
      `react-scripts` (webpack-dev-server, svgo, postcss etc.), que não vai no
      código entregue. A única "correção" que o npm oferece é `--force`, que
      faria **downgrade do `react-scripts` para 0.0.0**; não foi aplicada.
    - `react-scripts` 5.0.1 declara `typescript ^3 || ^4`, então o TypeScript
      do frontend fica em 4.9.5. React 19 funciona: type-check, 62 testes e
      build de produção passam.
    - Migrar para Vite zeraria o audit, mas mexe no build (`render.yaml`
      passaria a usar `dist/`), nos testes (Vitest) e nas variáveis
      (`VITE_*`). Fica como opção futura, não como higiene.
27. ✅ `backend/bundles.json` saiu do git (`git rm --cached`) e entrou no
    `.gitignore`; em HEAD ele já era `[]`. A **cópia local foi preservada** (tem
    um Bundle de teste no formato antigo) e o servidor continua usando-a por
    padrão; pode esvaziá-la (`[]`) quando quiser.
28. ✅ `.gitattributes` com `* text=auto eol=lf`. O índice do git já estava
    todo em LF (o aviso vinha do `autocrlf` do Windows), então nada precisou ser
    renormalizado no repositório. Os 25 arquivos da pasta de trabalho que
    estavam em CRLF foram convertidos para LF (conteúdo idêntico ao commit) e
    foi criado `.vscode/settings.json` com `"files.eol": "\n"`, para o VS Code
    não voltar a criar arquivos em CRLF. Agora os 41 arquivos versionados estão
    em LF no repositório e na pasta, e o git não emite mais avisos de CRLF.

### P2. Testes

29. ✅ **Backend:** 163 testes em [tests/](tests/) (gerador, catálogo, validação de
    entrada, validador, banco, API HTTP e serviço do frontend, com banco
    temporário). **Frontend:** 62 testes em `frontend/src/` (montagem do
    payload, endereço e tradução de erros da API, conversão e envio ao
    sandbox, e a tela inteira com a rede simulada). Foi preciso criar o
    `setupTests.ts` e configurar o Jest para aceitar o axios (módulo ES) em
    `package.json`. Não há teste automatizado de ponta a ponta com navegador.

### Itens que surgiram durante o trabalho

30. ✅ **README:** a pedido, só os **comandos** foram atualizados: execução do
    backend (`npm run build` + `npm start`) e os exemplos de `curl` do contrato
    novo (o texto do README foi executado contra o servidor: o `POST` gerou o
    Bundle e a busca por CPF o devolveu). Em 2026-10-27, a pedido, o README
    foi alinhado ao código: comandos para rodar tudo numa porta só,
    arquitetura, fluxo, estrutura do Bundle (com a Condition) e persistência.
31. ◐ **Deploy.** **Feito:** [render.yaml](render.yaml), servir a interface pelo
    Express, `/health`, endereço relativo da API em produção, testes e
    [docs/deploy.md](docs/deploy.md). **Falta:** commit e push para o GitHub,
    criar o serviço no Render (New → Blueprint), testar a URL pública e trocar
    o placeholder `[LINK DO DEPLOY NO VERCEL]` na apostila (o texto também cita
    Vercel; ajustar para a URL do Render).
32. ⬜ **Conferir as URLs de `system`** (CPF e BRCID10) na documentação oficial
    do BR-Core/RNDS. Hoje seguem a apostila e não foram verificadas. Se
    mudarem, ajustar [catalogo.ts](backend/catalogo.ts), o `validador.ts` (que
    usa a mesma constante), os testes e a apostila.
33. ✅ **Catálogo ampliado** de 1 para 4 observações e de 1 para 4 condições
    (ver atualizações de 2026-10-27 e [docs/api.md](docs/api.md#catálogo)).
    Os códigos LOINC e CID-10 vêm do conhecimento geral dos catálogos;
    vale conferir os `display` no site do LOINC e na tabela CID-10 do DATASUS
    junto com o item 32.

---

## 6. Decisões

| # | Decisão | Estado |
|---|---|---|
| 1 | **Catálogo**: 4 observações (temperatura, FC, SpO2, glicemia) e 4 condições CID-10 (febre, hipertensão, diabetes tipo 2, IVAS) | ✅ ampliado (item 33); ⬜ CIAP-2 ainda não entra. O catálogo existe em dois lugares (backend e frontend), com teste que acusa divergência |
| 2 | **Extras** (`active`, `telecom`, `address`, `contact`, `timestamp`) | Removidos, para igualar à apostila. Mantido o `id` do Bundle (o `DELETE` precisa dele) |
| 3 | **URLs de `system`** do CPF e do BRCID10 | Adotadas as da apostila; ⬜ não verificadas (item 32) |
| 4 | **Banco**: arquivo JSON vs. disco efêmero no deploy | ✅ decidido: manter o arquivo JSON (já existia; **não mexer**). No Render usa `DB_PATH=/tmp/bundles.json`: zera a cada reinício, o que basta para a atividade |
| 5 | **Hospedagem** | ✅ decidido: **Render, um serviço só** (o Express serve a API e a interface). Substitui a ideia de Vercel + backend separado |
| 6 | **Validador**: regras próprias e simples vs. validador FHIR real | ✅ decidido: regras próprias, didáticas (não substituem o BR-Core) |
| 7 | **CPF**: conferir dígito verificador? | ✅ decidido: **não**, para aceitar CPFs fictícios como o `00000000000` da apostila |

---

## 7. Feedback das revisões já atendido na apostila

Atendido em [docs/apostila.tex](docs/apostila.tex) (para não retrabalhar):

- link real do repositório;
- ponteiro para o guia da RNDS e para as páginas HL7 (UML) dos recursos;
- sandbox HAPI e uso do Postman;
- CID-10 (diagnóstico) e CIAP-2 (problemas);
- `\end{document}` duplicado removido.

Pendente na apostila: link do deploy (placeholder), confirmação das URLs
(`rnds-guia.saude.gov.br`, `hapi.fhir.org/baseR4`, `system` de CPF/CID) e
**um ajuste de texto no bloco do sandbox**: ele manda dar `POST` em cada
recurso (`.../Patient`), mas com o Bundle do simulador o caminho que preserva
as referências é a `transaction` (explicado em [docs/sandbox.md](docs/sandbox.md)
e feito pelo botão do simulador).

---

## 8. Ordem sugerida para o que falta

1. **Commitar** a etapa de 2026-10-27 (catálogo e documentação). O resto já
   está commitado na `feat/alinhamento-fhir`.
2. **Abrir o app em um navegador** e percorrer a atividade da apostila (gerar,
   quebrar o JSON, validar, enviar ao sandbox), já que a tela nunca foi vista
   em um navegador real.
3. **Push da branch, criação do serviço no Render** (passo a passo em
   [docs/deploy.md](docs/deploy.md)) e **teste da URL pública**.
4. **Link do deploy na apostila**, mais o ajuste do bloco do sandbox (seção 7).
5. **Aquecer o serviço antes da aula** (o plano gratuito dorme quando fica
   parado).
6. **Item 32:** conferir as URLs de `system` (CPF e BRCID10) antes de
   distribuir a apostila.
