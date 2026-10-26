import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";
import * as api from "./api";
import * as sandbox from "./sandbox";
import { Bundle } from "./types";

// Só as chamadas de rede são trocadas; ApiError e traduzirErro são os reais.
jest.mock("./api", () => ({
  ...jest.requireActual("./api"),
  criarBundle: jest.fn(),
  buscarPorCpf: jest.fn(),
  validarBundle: jest.fn()
}));

// Só o envio de rede é trocado; ErroSandbox continua sendo o real.
jest.mock("./sandbox", () => ({
  ...jest.requireActual("./sandbox"),
  enviarAoSandbox: jest.fn()
}));

const enviarAoSandbox = sandbox.enviarAoSandbox as jest.Mock;
const criarBundle = api.criarBundle as jest.Mock;
const buscarPorCpf = api.buscarPorCpf as jest.Mock;
const validarBundle = api.validarBundle as jest.Mock;

const bundle: Bundle = {
  resourceType: "Bundle",
  id: "b-1",
  type: "collection",
  entry: []
};

beforeEach(() => jest.resetAllMocks());

function preencher(rotulo: RegExp | string, valor: string) {
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
}

function preencherTudo() {
  preencher(/^CPF/, "12345678910");
  preencher(/Nome\(s\)/, "Maria Aparecida");
  preencher(/Sobrenome/, "Silva");
  preencher(/Sexo/, "female");
  preencher(/Data de nascimento/, "1985-03-21");
  preencher(/O que foi medido/, "temperatura");
  preencher(/^Valor/, "38.5");
  preencher(/Data e hora da medida/, "2024-05-10T09:30");
  preencher(/Problema ou diagnóstico/, "febre");
  preencher(/Data do registro/, "2024-05-10");
}

const gerar = () => fireEvent.click(screen.getByText("Gerar Bundle"));

test("mostra os recursos Patient, Observation e Condition", () => {
  render(<App />);
  expect(screen.getByText("Patient")).toBeInTheDocument();
  expect(screen.getByText("Observation")).toBeInTheDocument();
  expect(screen.getByText("Condition")).toBeInTheDocument();
});

test("os campos com value set são seletores com as opções do FHIR", () => {
  render(<App />);
  const sexo = screen.getByLabelText(/Sexo/) as HTMLSelectElement;
  expect(Array.from(sexo.options).map((o) => o.value)).toEqual([
    "",
    "female",
    "male",
    "other",
    "unknown"
  ]);
});

test("a unidade aparece quando se escolhe a observação", () => {
  render(<App />);
  expect(screen.getByLabelText(/^Valor$/)).toBeInTheDocument();
  preencher(/O que foi medido/, "temperatura");
  expect(screen.getByLabelText(/Valor \(°C\)/)).toBeInTheDocument();
});

test("gerar envia o payload no formato da API e mostra o JSON", async () => {
  criarBundle.mockResolvedValue(bundle);
  render(<App />);
  preencherTudo();
  gerar();

  await waitFor(() => expect(screen.getByText("Resultado (JSON)")).toBeInTheDocument());

  expect(criarBundle).toHaveBeenCalledWith({
    cpf: "12345678910",
    given: ["Maria", "Aparecida"],
    family: "Silva",
    gender: "female",
    birthDate: "1985-03-21",
    observacao: "temperatura",
    status: "final",
    value: "38.5",
    effectiveDateTime: "2024-05-10T09:30",
    condicao: "febre",
    clinicalStatus: "active",
    recordedDate: "2024-05-10"
  });
  const editor = screen.getByLabelText("JSON do Bundle") as HTMLTextAreaElement;
  expect(JSON.parse(editor.value)).toEqual(bundle);
});

test("erros de validação do backend aparecem junto de cada campo", async () => {
  criarBundle.mockRejectedValue(
    new api.ApiError("validacao", "Dados inválidos", [
      { campo: "cpf", mensagem: "O CPF deve ter 11 dígitos." },
      { campo: "value", mensagem: "Fora da faixa plausível (25 a 45 °C)." }
    ])
  );
  render(<App />);
  gerar();

  expect(await screen.findByText("O CPF deve ter 11 dígitos.")).toBeInTheDocument();
  expect(screen.getByText(/Fora da faixa plausível/)).toBeInTheDocument();
  expect(screen.getByRole("alert")).toHaveTextContent(/Corrija os campos/);
  expect(screen.queryByText("Resultado (JSON)")).not.toBeInTheDocument();
});

test("o erro de um campo some quando a pessoa volta a editá-lo", async () => {
  criarBundle.mockRejectedValue(
    new api.ApiError("validacao", "Dados inválidos", [
      { campo: "cpf", mensagem: "O CPF deve ter 11 dígitos." }
    ])
  );
  render(<App />);
  gerar();
  await screen.findByText("O CPF deve ter 11 dígitos.");

  preencher(/^CPF/, "123");
  expect(screen.queryByText("O CPF deve ter 11 dígitos.")).not.toBeInTheDocument();
});

test("servidor fora do ar mostra uma mensagem clara", async () => {
  criarBundle.mockRejectedValue(
    new api.ApiError("offline", "Não foi possível conectar ao servidor (http://x).")
  );
  render(<App />);
  gerar();
  expect(await screen.findByRole("alert")).toHaveTextContent(/Não foi possível conectar/);
});

test("busca sem resultado avisa que não encontrou", async () => {
  buscarPorCpf.mockRejectedValue(new api.ApiError("naoEncontrado", "Nenhum bundle encontrado"));
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText("Digite o CPF"), { target: { value: "12345678910" } });
  fireEvent.click(screen.getByText("Buscar"));
  expect(await screen.findByRole("alert")).toHaveTextContent(/Nenhum bundle encontrado para esse CPF/);
});

test("busca com resultado permite abrir o bundle no editor", async () => {
  buscarPorCpf.mockResolvedValue([bundle]);
  render(<App />);
  fireEvent.change(screen.getByPlaceholderText("Digite o CPF"), { target: { value: "12345678910" } });
  fireEvent.click(screen.getByText("Buscar"));

  fireEvent.click(await screen.findByText("Abrir no editor"));
  expect(screen.getByText("Resultado (JSON)")).toBeInTheDocument();
});

async function comEditorAberto() {
  criarBundle.mockResolvedValue(bundle);
  render(<App />);
  gerar();
  await screen.findByText("Resultado (JSON)");
  return screen.getByLabelText("JSON do Bundle") as HTMLTextAreaElement;
}

test("JSON malformado é apontado como nível 1 sem chamar o servidor", async () => {
  const editor = await comEditorAberto();
  fireEvent.change(editor, { target: { value: '{ "resourceType": ' } });
  fireEvent.click(screen.getByRole("button", { name: "Validar JSON" }));

  expect(await screen.findByText(/JSON malformado/)).toBeInTheDocument();
  expect(screen.getByText(/O JSON tem problemas/)).toBeInTheDocument();
  expect(validarBundle).not.toHaveBeenCalled();
});

test("validar envia o JSON editado e mostra os problemas por nível", async () => {
  validarBundle.mockResolvedValue({
    valido: false,
    resumo: { sintaxe: true, estrutura: true, perfil: false },
    problemas: [
      {
        nivel: 3,
        severidade: "erro",
        caminho: "$.entry[2].resource.code.coding[0].system",
        mensagem: "Falta o system."
      }
    ]
  });
  const editor = await comEditorAberto();
  fireEvent.change(editor, { target: { value: JSON.stringify({ ...bundle, id: "editado" }) } });
  fireEvent.click(screen.getByRole("button", { name: "Validar JSON" }));

  expect(await screen.findByText("Falta o system.")).toBeInTheDocument();
  expect(validarBundle).toHaveBeenCalledWith({ ...bundle, id: "editado" });
  expect(screen.getByText("$.entry[2].resource.code.coding[0].system")).toBeInTheDocument();
  expect(screen.getByText(/✗ 3\. Perfil/)).toBeInTheDocument();
  expect(screen.getByText(/✓ 1\. Sintaxe/)).toBeInTheDocument();
});

test("JSON válido mostra a confirmação nos três níveis", async () => {
  validarBundle.mockResolvedValue({
    valido: true,
    resumo: { sintaxe: true, estrutura: true, perfil: true },
    problemas: []
  });
  await comEditorAberto();
  fireEvent.click(screen.getByRole("button", { name: "Validar JSON" }));
  expect(await screen.findByText(/JSON válido nos três níveis/)).toBeInTheDocument();
});

test("restaurar original desfaz as edições", async () => {
  const editor = await comEditorAberto();
  const original = editor.value;
  const restaurar = screen.getByText("Restaurar original");
  expect(restaurar).toBeDisabled();

  fireEvent.change(editor, { target: { value: "{}" } });
  expect(restaurar).toBeEnabled();
  fireEvent.click(restaurar);
  expect(editor.value).toBe(original);
});

test("editar o JSON limpa o resultado da validação anterior", async () => {
  validarBundle.mockResolvedValue({
    valido: true,
    resumo: { sintaxe: true, estrutura: true, perfil: true },
    problemas: []
  });
  const editor = await comEditorAberto();
  fireEvent.click(screen.getByRole("button", { name: "Validar JSON" }));
  await screen.findByText(/JSON válido nos três níveis/);

  fireEvent.change(editor, { target: { value: "{}" } });
  expect(screen.queryByText(/JSON válido nos três níveis/)).not.toBeInTheDocument();
});

// ---------- servidor de testes (HAPI) ----------

const enviar = () =>
  fireEvent.click(screen.getByRole("button", { name: /Enviar ao servidor de testes/ }));

test("enviar ao servidor de testes pede confirmação e mostra os recursos criados", async () => {
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  enviarAoSandbox.mockResolvedValue([
    { tipo: "Patient", id: "501", url: "https://hapi.fhir.org/baseR4/Patient/501" },
    { tipo: "Observation", id: "502", url: "https://hapi.fhir.org/baseR4/Observation/502" }
  ]);
  await comEditorAberto();
  enviar();

  expect(await screen.findByText(/Enviado ao servidor de testes/)).toBeInTheDocument();
  expect(confirmar).toHaveBeenCalledWith(expect.stringMatching(/dados fictícios/));
  expect(enviarAoSandbox).toHaveBeenCalledWith(bundle);
  const link = screen.getByRole("link", { name: "Patient/501" });
  expect(link).toHaveAttribute("href", "https://hapi.fhir.org/baseR4/Patient/501");
  expect(screen.getByRole("link", { name: "Observation/502" })).toBeInTheDocument();
  confirmar.mockRestore();
});

test("se a pessoa cancela a confirmação, nada é enviado", async () => {
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(false);
  await comEditorAberto();
  enviar();

  expect(confirmar).toHaveBeenCalled();
  expect(enviarAoSandbox).not.toHaveBeenCalled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  confirmar.mockRestore();
});

test("o envio usa o JSON editado, não o original", async () => {
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  enviarAoSandbox.mockResolvedValue([]);
  const editor = await comEditorAberto();
  fireEvent.change(editor, { target: { value: JSON.stringify({ ...bundle, id: "editado" }) } });
  enviar();

  await waitFor(() => expect(enviarAoSandbox).toHaveBeenCalled());
  expect(enviarAoSandbox).toHaveBeenCalledWith({ ...bundle, id: "editado" });
  confirmar.mockRestore();
});

test("recusa do servidor mostra o motivo", async () => {
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  enviarAoSandbox.mockRejectedValue(
    new sandbox.ErroSandbox("O servidor de testes recusou o envio (erro 400).", [
      "Referência inválida"
    ])
  );
  await comEditorAberto();
  enviar();

  expect(await screen.findByText(/recusou o envio \(erro 400\)/)).toBeInTheDocument();
  expect(screen.getByText("Referência inválida")).toBeInTheDocument();
  confirmar.mockRestore();
});

test("JSON malformado não chega a pedir confirmação nem a enviar", async () => {
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  const editor = await comEditorAberto();
  fireEvent.change(editor, { target: { value: "{ quebrado" } });
  enviar();

  expect(await screen.findByText(/JSON malformado/)).toBeInTheDocument();
  expect(confirmar).not.toHaveBeenCalled();
  expect(enviarAoSandbox).not.toHaveBeenCalled();
  confirmar.mockRestore();
});

test("editar o JSON apaga o resultado do envio anterior", async () => {
  const confirmar = jest.spyOn(window, "confirm").mockReturnValue(true);
  enviarAoSandbox.mockResolvedValue([]);
  const editor = await comEditorAberto();
  enviar();
  await screen.findByText(/Enviado ao servidor de testes/);

  fireEvent.change(editor, { target: { value: "{}" } });
  expect(screen.queryByText(/Enviado ao servidor de testes/)).not.toBeInTheDocument();
  confirmar.mockRestore();
});
