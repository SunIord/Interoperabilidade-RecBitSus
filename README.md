# 🧠 Simulador de Interoperabilidade FHIR

Ferramenta educacional interativa para simulação de integração de dados clínicos utilizando conceitos do padrão **FHIR (Fast Healthcare Interoperability Resources)**.

---

## 🎯 Objetivo

Este projeto aplica **metodologia ativa de aprendizagem**, permitindo que o usuário:

- Insira dados clínicos manualmente
- Gere bundles de interoperabilidade
- Visualize a estrutura em JSON
- Entenda a relação entre recursos FHIR
- Simule consultas por paciente (CPF)

---

## 🏗️ Arquitetura

- `frontend/`: interface em React (formulário, busca por CPF, editor do JSON e
  validação)
- `backend/`: API em Express que valida os dados, gera o Bundle FHIR, grava em
  arquivo JSON e oferece um validador didático (`POST /validate`)
- Em produção, o backend também serve a interface compilada: tudo fica num só
  endereço

---

## ⚙️ Tecnologias

### Frontend
- React
- TypeScript
- CSS

### Backend
- Node.js
- Express
- TypeScript
- File System (JSON como banco)

---

## 🔄 Fluxo da Aplicação

1. Usuário preenche dados do paciente, da observação e da condição
2. Clica em **Gerar Bundle**
3. Frontend envia dados para o backend
4. Backend:
   - Valida os dados (erros aparecem ao lado de cada campo)
   - Cria um Bundle (Patient + Observation + Condition)
   - Salva em `bundles.json`
5. JSON é exibido num editor: dá para alterá-lo, clicar em **Validar JSON** e,
   opcionalmente, enviá-lo ao servidor público de testes HAPI FHIR

---

## 📦 Estrutura do Bundle

Bundle FHIR R4 do tipo `collection`. Cada recurso tem um `fullUrl`
(`urn:uuid:...`) e a Observation e a Condition apontam para o Patient por ele.

- **Patient**
  - CPF (identifier)
  - Nome (given e family)
  - Sexo (gender)
  - Data de nascimento

- **Observation**
  - Tipo (ex: temperatura, frequência cardíaca, saturação, glicemia), com código LOINC
  - Situação (status)
  - Valor e unidade (UCUM)
  - Data e hora da medida
  - Referência ao paciente

- **Condition**
  - Problema ou diagnóstico (ex: febre, hipertensão, diabetes), com código CID-10
  - Situação clínica (clinicalStatus)
  - Data do registro
  - Referência ao paciente

Catálogo completo em [docs/api.md](docs/api.md#catálogo).

---

## 🔍 Busca por CPF


GET /bundle/cpf/:cpf


Retorna todos os bundles associados ao paciente (o CPF pode ter pontuação).

---

## 🚀 Como rodar o projeto

```bash
cd frontend
npm install
npm run build

cd ../backend
npm install
npm run build
npm start
```

Abra http://localhost:3001 (interface e API no mesmo endereço).

### Desenvolvimento (duas portas)

Terminal 1, API em http://localhost:3001:

```bash
cd backend
npm install
npm run build
npm start
```

Terminal 2, interface em http://localhost:3000 (recarrega ao salvar):

```bash
cd frontend
npm install
npm start
```

### Produção (Render)

Em produção o Express serve a API **e** a interface (`frontend/build`) numa só
URL. Configuração em [render.yaml](render.yaml) e passo a passo em
[docs/deploy.md](docs/deploy.md). Documentação da API em
[docs/api.md](docs/api.md).

## 📁 Persistência

Os dados são armazenados em:

backend/bundles.json

O arquivo é criado na primeira execução e não vai para o git. No Render o banco
fica em `/tmp/bundles.json` e recomeça vazio a cada reinício.

## 🧪 Testes via CURL

Criar bundle:

```
curl -X POST http://localhost:3001/bundle \
-H "Content-Type: application/json" \
-d '{"cpf":"12345678910","given":"Maria","family":"Silva","gender":"female","birthDate":"1985-03-21","observacao":"temperatura","status":"final","value":38.5,"effectiveDateTime":"2024-05-10T09:30","condicao":"febre","clinicalStatus":"active","recordedDate":"2024-05-10"}'
```

Buscar por CPF:

```
curl http://localhost:3001/bundle/cpf/12345678910
```

## 🧠 Metodologia Ativa

O aprendizado ocorre quando o usuário:

Manipula os dados manualmente
Observa a transformação em JSON
Entende como sistemas de saúde integram informações

## 🏥 Aplicações Reais
Prontuários eletrônicos (EHR)
Sistemas hospitalares
Integração clínica/laboratorial
Plataformas de interoperabilidade

## 👨‍💻 Autor
Daniel Nascimento
Projeto - RecBitSus - Grupo 7 

## 📄 Licença

Projeto com fins educacionais.
