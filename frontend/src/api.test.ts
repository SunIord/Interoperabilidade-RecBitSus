import { AxiosError, AxiosHeaders } from "axios";
import { ApiError, traduzirErro } from "./api";

// Monta um AxiosError como o axios o criaria para uma resposta HTTP.
function erroHttp(status: number, data: unknown) {
  return new AxiosError("falhou", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
    headers: {},
    config: { headers: new AxiosHeaders() }
  });
}

test("sem resposta do servidor: erro 'offline' com a URL tentada", () => {
  const e = traduzirErro(new AxiosError("Network Error", "ERR_NETWORK"));
  expect(e.tipo).toBe("offline");
  expect(e.message).toMatch(/Não foi possível conectar/);
  expect(e.message).toMatch(/localhost:3001/);
});

test("400 com detalhes: erro de validação com os campos", () => {
  const detalhes = [{ campo: "cpf", mensagem: "O CPF deve ter 11 dígitos." }];
  const e = traduzirErro(erroHttp(400, { error: "Dados inválidos", detalhes }));
  expect(e.tipo).toBe("validacao");
  expect(e.detalhes).toEqual(detalhes);
  expect(e.message).toBe("Dados inválidos");
});

test("400 sem detalhes: erro do servidor com a mensagem dele", () => {
  const e = traduzirErro(erroHttp(400, { error: "O CPF deve ter 11 dígitos." }));
  expect(e.tipo).toBe("servidor");
  expect(e.message).toBe("O CPF deve ter 11 dígitos.");
});

test("404: não encontrado", () => {
  const e = traduzirErro(erroHttp(404, { error: "Nenhum bundle encontrado" }));
  expect(e.tipo).toBe("naoEncontrado");
});

test("500 sem corpo útil: mensagem genérica com o status", () => {
  const e = traduzirErro(erroHttp(500, "<html>"));
  expect(e.tipo).toBe("servidor");
  expect(e.message).toMatch(/500/);
});

test("um ApiError passa direto, sem ser reembrulhado", () => {
  const original = new ApiError("validacao", "x");
  expect(traduzirErro(original)).toBe(original);
});

test("erro que não é do axios vira erro inesperado", () => {
  expect(traduzirErro(new Error("boom")).tipo).toBe("servidor");
});

// ---------- endereço da API ----------

// API_URL é calculado ao carregar o módulo, então cada caso o recarrega
// isolado, com o ambiente desejado.
function carregarApi(env: { NODE_ENV: string; REACT_APP_API_URL?: string }) {
  const antes = { ...process.env };
  process.env.NODE_ENV = env.NODE_ENV;
  if (env.REACT_APP_API_URL === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = env.REACT_APP_API_URL;
  try {
    let api: typeof import("./api");
    jest.isolateModules(() => {
      api = require("./api");
    });
    return api!;
  } finally {
    process.env = antes;
  }
}

test("desenvolvimento: usa o backend local", () => {
  expect(carregarApi({ NODE_ENV: "development" }).API_URL).toBe("http://localhost:3001");
});

test("produção sem variável: caminho relativo (mesma origem)", () => {
  expect(carregarApi({ NODE_ENV: "production" }).API_URL).toBe("");
});

test("REACT_APP_API_URL tem prioridade, sem barra no final", () => {
  const api = carregarApi({
    NODE_ENV: "production",
    REACT_APP_API_URL: "https://api.exemplo.com//"
  });
  expect(api.API_URL).toBe("https://api.exemplo.com");
});

test("sem endereço, a mensagem de servidor fora do ar não mostra parênteses vazios", () => {
  const api = carregarApi({ NODE_ENV: "production" });
  const e = api.traduzirErro(new AxiosError("Network Error", "ERR_NETWORK"));
  expect(e.tipo).toBe("offline");
  expect(e.message).not.toMatch(/\(\)/);
  expect(e.message).toMatch(/Não foi possível conectar ao servidor\./);
});
