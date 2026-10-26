import express, { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { Banco, BancoError } from "./db";
import { generateFHIRBundle } from "./fhir";
import { normalizarCpf, validarEntrada } from "./validacao";
import { validarBundle } from "./validador";

const cors = require("cors");

export interface AppOptions {
  // Caminho do arquivo JSON usado como banco.
  dbPath: string;
  // Origens permitidas no CORS. Vazio ou "*" libera qualquer origem.
  corsOrigin?: string | string[];
  // Pasta com o frontend já compilado (frontend/build). Se existir, o servidor
  // também serve a interface, na mesma origem da API.
  staticDir?: string;
}

function origensCors(origem: AppOptions["corsOrigin"]) {
  const lista = (Array.isArray(origem) ? origem : (origem ?? "").split(","))
    .map((o) => o.trim())
    .filter((o) => o !== "");
  if (lista.length === 0 || lista.includes("*")) return cors();
  return cors({ origin: lista });
}

export function createApp(options: AppOptions) {
  const banco = new Banco(options.dbPath);
  const app = express();

  app.disable("x-powered-by");
  app.use(origensCors(options.corsOrigin));
  app.use(express.json({ limit: "1mb" }));

  // ================= FRONTEND =================

  // Registrado antes das rotas: com o frontend presente, "/" devolve o
  // index.html. Os arquivos em /static têm nome com hash, então podem ser
  // guardados em cache; o index.html nunca, para o deploy novo aparecer logo.
  if (options.staticDir && fs.existsSync(path.join(options.staticDir, "index.html"))) {
    app.use(
      express.static(options.staticDir, {
        setHeaders: (res, arquivo) => {
          if (path.basename(arquivo) === "index.html") {
            res.setHeader("Cache-Control", "no-cache");
          } else if (arquivo.split(path.sep).includes("static")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
  }

  // ================= ROTAS =================

  // Verificação de saúde (usada pelo Render).
  app.get("/health", (req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Sem frontend, a raiz só confirma que a API está no ar.
  app.get("/", (req: Request, res: Response) => {
    res.send("Servidor FHIR rodando 🚀");
  });

  // ➕ Criar bundle
  app.post("/bundle", (req: Request, res: Response) => {
    const entrada = validarEntrada(req.body);
    if (!entrada.ok) {
      return res
        .status(400)
        .json({ error: "Dados inválidos", detalhes: entrada.erros });
    }

    const bundle = generateFHIRBundle(entrada.data);
    banco.inserir(bundle);

    res.status(201).json(bundle);
  });

  // 🔍 Buscar por CPF (aceita com ou sem pontuação)
  app.get("/bundle/cpf/:cpf", (req: Request, res: Response) => {
    const cpf = normalizarCpf(String(req.params.cpf));
    if (cpf.length !== 11) {
      return res.status(400).json({ error: "O CPF deve ter 11 dígitos." });
    }

    const resultados = banco.listar().filter((b) => {
      const patient = b?.entry?.find(
        (e) => e.resource.resourceType === "Patient"
      )?.resource;
      if (patient?.resourceType !== "Patient") return false;
      return normalizarCpf(String(patient.identifier?.[0]?.value ?? "")) === cpf;
    });

    if (resultados.length === 0) {
      return res.status(404).json({ error: "Nenhum bundle encontrado" });
    }

    res.json(resultados);
  });

  // 🔎 Buscar por id do bundle
  app.get("/bundle/:id", (req: Request, res: Response) => {
    const bundle = banco.buscarPorId(String(req.params.id));
    if (!bundle) {
      return res.status(404).json({ error: "Bundle não encontrado" });
    }
    res.json(bundle);
  });

  // 📚 Listar todos
  app.get("/bundles", (req: Request, res: Response) => {
    res.json(banco.listar());
  });

  // 🗑️ Deletar
  app.delete("/bundle/:id", (req: Request, res: Response) => {
    if (!banco.remover(String(req.params.id))) {
      return res.status(404).json({ error: "Bundle não encontrado" });
    }
    res.json({ message: "Removido" });
  });

  // ✅ Validador didático: recebe um Bundle (possivelmente editado) e aponta
  // os problemas por nível (sintaxe, estrutura, perfil). Não grava nada.
  app.post("/validate", (req: Request, res: Response) => {
    if (req.body === undefined) {
      return res.status(400).json({
        valido: false,
        resumo: { sintaxe: false, estrutura: false, perfil: false },
        problemas: [
          {
            nivel: 1,
            severidade: "erro",
            caminho: "$",
            mensagem: "Corpo ausente. Envie o JSON com Content-Type: application/json."
          }
        ]
      });
    }
    res.json(validarBundle(req.body));
  });

  // ================= ERROS =================

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Rota não encontrada" });
  });

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(err);

    // JSON malformado: é o nível 1 (sintaxe) da apostila.
    if (err?.type === "entity.parse.failed") {
      if (req.path === "/validate") {
        return res.status(400).json({
          valido: false,
          resumo: { sintaxe: false, estrutura: false, perfil: false },
          problemas: [
            {
              nivel: 1,
              severidade: "erro",
              caminho: "$",
              mensagem: `JSON malformado: ${err.message}`
            }
          ]
        });
      }
      return res.status(400).json({ error: "JSON malformado", detalhe: err.message });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Corpo da requisição grande demais" });
    }
    if (err instanceof BancoError) {
      console.error(err.message);
      return res.status(500).json({ error: err.message });
    }

    console.error(err);
    res.status(500).json({ error: "Erro interno do servidor" });
  });

  return app;
}
