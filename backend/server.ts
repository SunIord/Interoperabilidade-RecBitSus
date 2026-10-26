import fs from "fs";
import path from "path";
import { createApp } from "./app";

const PORT = Number(process.env.PORT) || 3001;

// Por padrão o banco fica em backend/bundles.json, rodando de ts-node ou da
// versão compilada (backend/dist). DB_PATH permite escolher outro arquivo.
const raiz = path.basename(__dirname) === "dist" ? path.dirname(__dirname) : __dirname;
const dbPath = process.env.DB_PATH ?? path.join(raiz, "bundles.json");

// Frontend compilado (frontend/build). FRONTEND_DIR permite escolher outra pasta.
const staticDir =
  process.env.FRONTEND_DIR ?? path.join(raiz, "..", "frontend", "build");

const app = createApp({
  dbPath,
  corsOrigin: process.env.CORS_ORIGIN,
  staticDir
});

app.listen(PORT, () => {
  console.log(`🚀 http://localhost:${PORT} (banco: ${dbPath})`);
  console.log(
    fs.existsSync(path.join(staticDir, "index.html"))
      ? `   interface servida de: ${staticDir}`
      : "   interface não encontrada (rode o build do frontend); só a API está ativa"
  );
});
