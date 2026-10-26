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

1. Usuário preenche dados do paciente e exame
2. Clica em **Gerar Bundle**
3. Frontend envia dados para o backend
4. Backend:
   - Cria um Bundle (Patient + Observation)
   - Salva em `bundles.json`
5. JSON é exibido na tela

---

## 📦 Estrutura do Bundle

- **Patient**
  - CPF (identifier)
  - Nome
  - Contato
  - Data de nascimento

- **Observation**
  - Tipo (ex: glicose)
  - Valor
  - Unidade
  - Data
  - Referência ao paciente

---

## 🔍 Busca por CPF


GET /bundle/cpf/:cpf


Retorna todos os bundles associados ao paciente.

---

## 🚀 Como rodar o projeto

### Backend

```bash
cd backend
npm install
npm run build
npm start
```

### Frontend
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
