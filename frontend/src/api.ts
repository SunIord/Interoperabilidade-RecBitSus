import axios from "axios";
import {
  Bundle,
  BundleInput,
  ErroCampo,
  ResultadoValidacao
} from "./types";

// Endereço da API:
// - REACT_APP_API_URL, se definida (ex.: https://minha-api.exemplo.com);
// - em produção, vazio: o backend serve esta interface, então a API está na
//   mesma origem e basta usar caminhos relativos (/bundle, /validate...);
// - em desenvolvimento (npm start), o backend local em localhost:3001.
function enderecoDaApi(): string {
  const definida = process.env.REACT_APP_API_URL;
  if (definida !== undefined) return definida;
  return process.env.NODE_ENV === "production" ? "" : "http://localhost:3001";
}

export const API_URL = enderecoDaApi().replace(/\/+$/, "");

export type TipoErro = "validacao" | "naoEncontrado" | "offline" | "servidor";

export class ApiError extends Error {
  constructor(
    public tipo: TipoErro,
    mensagem: string,
    public detalhes: ErroCampo[] = []
  ) {
    super(mensagem);
  }
}

// Transforma o erro do axios em um ApiError com mensagem útil ao usuário.
export function traduzirErro(err: unknown): ApiError {
  if (err instanceof ApiError) return err;

  if (!axios.isAxiosError(err)) {
    return new ApiError("servidor", "Erro inesperado.");
  }

  // Sem resposta: o servidor não foi alcançado.
  if (!err.response) {
    return new ApiError(
      "offline",
      `Não foi possível conectar ao servidor${API_URL ? ` (${API_URL})` : ""}. Verifique se o backend está rodando.`
    );
  }

  const { status, data } = err.response;
  const mensagem: string =
    (data && typeof data.error === "string" && data.error) ||
    `Erro ${status} do servidor.`;

  if (status === 400 && data && Array.isArray(data.detalhes)) {
    return new ApiError("validacao", mensagem, data.detalhes as ErroCampo[]);
  }
  if (status === 404) return new ApiError("naoEncontrado", mensagem);
  return new ApiError("servidor", mensagem);
}

export async function criarBundle(payload: BundleInput): Promise<Bundle> {
  try {
    const res = await axios.post<Bundle>(`${API_URL}/bundle`, payload);
    return res.data;
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function buscarPorCpf(cpf: string): Promise<Bundle[]> {
  try {
    const res = await axios.get<Bundle[]>(
      `${API_URL}/bundle/cpf/${encodeURIComponent(cpf.trim())}`
    );
    return res.data;
  } catch (err) {
    throw traduzirErro(err);
  }
}

export async function validarBundle(
  bundle: unknown
): Promise<ResultadoValidacao> {
  try {
    const res = await axios.post<ResultadoValidacao>(
      `${API_URL}/validate`,
      bundle
    );
    return res.data;
  } catch (err) {
    // O backend responde 400 no mesmo formato quando o corpo é inutilizável.
    if (axios.isAxiosError(err) && err.response?.data?.problemas) {
      return err.response.data as ResultadoValidacao;
    }
    throw traduzirErro(err);
  }
}
