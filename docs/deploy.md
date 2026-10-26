# Deploy no Render

O projeto é publicado como **um único serviço web**: o Express serve a API e
também a interface (o `frontend/build`). Resultado: **uma URL só**, sem CORS e
sem `REACT_APP_API_URL`, porque o frontend chama a API por caminho relativo
(`/bundle`, `/validate`...).

Arquivo de configuração: [render.yaml](../render.yaml).

> Os detalhes do Render (nomes de botões, limites do plano gratuito) podem
> mudar. Confira no painel antes de depender de algum número.

## Como funciona

| Etapa | Comando (já no `render.yaml`) |
|---|---|
| Build | `npm --prefix frontend ci && npm --prefix frontend run build && npm --prefix backend ci --include=dev && npm --prefix backend run build` |
| Start | `npm --prefix backend start` (`node dist/server.js`) |
| Saúde | `GET /health` → `{"status":"ok"}` |

O servidor procura a interface em `frontend/build` (ao lado de `backend/`). Se
a pasta não existir, ele sobe só com a API e avisa no log.

## Passo a passo

1. **Envie o código ao GitHub** (commit e push). O Render publica a partir do
   repositório, então o `render.yaml`, o `backend/` e o `frontend/` precisam
   estar nele.
2. No Render: **New → Blueprint**, escolha o repositório e confirme. O Render
   lê o `render.yaml` e cria o serviço `recbitsus-fhir`.
   - Alternativa manual: **New → Web Service**, runtime Node, e informe os
     comandos de build e de start da tabela acima, e o *health check path*
     `/health`.
3. Aguarde o primeiro build. O endereço fica no formato
   `https://recbitsus-fhir.onrender.com` (o nome exato pode variar se já
   estiver em uso).
4. **Teste** (lista abaixo) e coloque a URL na apostila, no lugar de
   `[LINK DO DEPLOY NO VERCEL]` (em [docs/apostila.tex](apostila.tex); se o
   deploy não for mais no Vercel, ajuste o texto também).

### Variáveis de ambiente

| Variável | Valor no `render.yaml` | Por quê |
|---|---|---|
| `NODE_VERSION` | `22` | Fixa a versão do Node usada no build e na execução |
| `DB_PATH` | `/tmp/bundles.json` | O banco fica em área temporária e começa vazio |
| `PORT` | definida pelo Render | O servidor já lê `PORT` |

Opcionais: `FRONTEND_DIR` (outra pasta para a interface) e `CORS_ORIGIN` (só
necessária se outro site for chamar a API).

## Teste depois de publicar

1. Abra a URL: o formulário deve aparecer.
2. Preencha e clique em **Gerar Bundle**: o JSON deve aparecer no editor.
3. Apague um `system` do JSON e clique em **Validar JSON**: deve acusar um
   problema de **nível 3**.
4. Busque pelo CPF usado: o bundle deve ser encontrado.
5. `<URL>/health` deve responder `{"status":"ok"}`.

## Simular a produção na sua máquina

```bash
cd frontend && npm install && npm run build     # gera frontend/build
cd ../backend && npm install && npm run build && npm start
# abra http://localhost:3001  (interface e API na mesma porta)
```

Em desenvolvimento, continue usando `npm start` no frontend (porta 3000, que
chama a API em `localhost:3001`) e `npm run dev` no backend.

## O que esperar do plano gratuito

- **O serviço dorme quando fica parado** e a primeira visita demora (a página
  inteira, não só a API). **Abra o link alguns minutos antes da aula** para
  acordá-lo.
- **O banco zera a cada reinício** (disco efêmero). Para a atividade, isso é
  suficiente.
- **Todos os alunos compartilham o mesmo banco**: na busca por CPF, veem os
  bundles uns dos outros. Oriente a usar apenas CPFs fictícios.
- **Não há autenticação nem limite de requisições.** Não use dados reais.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| A URL mostra o texto "Servidor FHIR rodando 🚀" em vez da interface | O build do frontend não foi gerado ou não está em `frontend/build`. Veja o log: ele diz se a interface foi encontrada. |
| Build falha em `tsc` | O `backend ci` rodou sem as devDependencies. O `render.yaml` já usa `--include=dev`; se criou o serviço à mão, repita o comando exato. |
| "Não foi possível conectar ao servidor" na tela | O serviço está acordando, ou o `REACT_APP_API_URL` foi definido com um endereço errado no build. Em produção, deixe-o **sem definir**. |
| `EADDRINUSE` ao simular localmente | A porta 3001 já está em uso. Use `PORT=3002 npm start`. |
