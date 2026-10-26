import fs from "fs";
import path from "path";
import { Bundle } from "./fhir";

// Erro de leitura do banco (arquivo corrompido ou com formato inesperado).
export class BancoError extends Error {}

// Banco em arquivo JSON. As operações são síncronas, então dentro de um único
// processo cada leitura-modificação-escrita é atômica. A gravação usa arquivo
// temporário + rename para nunca deixar o banco pela metade.
export class Banco {
  constructor(private readonly filePath: string) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, "[]");
    }
  }

  listar(): Bundle[] {
    const texto = fs.readFileSync(this.filePath, "utf-8");
    if (texto.trim() === "") return [];

    let dados: unknown;
    try {
      dados = JSON.parse(texto);
    } catch {
      throw new BancoError(
        `Banco ilegível (JSON inválido): ${this.filePath}. Nada foi sobrescrito.`
      );
    }
    if (!Array.isArray(dados)) {
      throw new BancoError(
        `Banco com formato inesperado (esperava uma lista): ${this.filePath}.`
      );
    }
    return dados as Bundle[];
  }

  buscarPorId(id: string): Bundle | undefined {
    return this.listar().find((b) => b.id === id);
  }

  inserir(bundle: Bundle): void {
    const banco = this.listar();
    banco.push(bundle);
    this.salvar(banco);
  }

  // Devolve false se o id não existir.
  remover(id: string): boolean {
    const banco = this.listar();
    const restantes = banco.filter((b) => b.id !== id);
    if (restantes.length === banco.length) return false;
    this.salvar(restantes);
    return true;
  }

  private salvar(data: Bundle[]): void {
    const temporario = `${this.filePath}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(data, null, 2));
    fs.renameSync(temporario, this.filePath);
  }
}
