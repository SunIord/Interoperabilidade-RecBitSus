import React, { useState } from "react";
import { ApiError, buscarPorCpf, criarBundle, traduzirErro, validarBundle } from "./api";
import {
  CONDICOES,
  GENEROS,
  OBSERVACOES,
  SITUACOES_CLINICAS,
  STATUS_OBSERVACAO,
  Opcao
} from "./catalogo";
import { Formulario, FORMULARIO_INICIAL, montarPayload } from "./formulario";
import { enviarAoSandbox, ErroSandbox, RecursoCriado, SANDBOX_URL } from "./sandbox";
import { Bundle, ResultadoValidacao } from "./types";

// ---------- componentes de apoio ----------

function Campo(props: {
  rotulo: string;
  erro?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="campo">
      <span>{props.rotulo}</span>
      {props.children}
      {props.erro && <small className="erro-campo">{props.erro}</small>}
    </label>
  );
}

function Selecao(props: {
  nome: keyof Formulario;
  valor: string;
  opcoes: Opcao[];
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <select name={props.nome} value={props.valor} onChange={props.onChange}>
      <option value="">Selecione...</option>
      {props.opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

const NOMES_NIVEL = {
  1: "Sintaxe (JSON bem formado)",
  2: "Estrutura (respeita o FHIR)",
  3: "Perfil (regras do perfil)"
} as const;

function Validacao({ r }: { r: ResultadoValidacao }) {
  const niveis: { chave: keyof ResultadoValidacao["resumo"]; nivel: 1 | 2 | 3 }[] = [
    { chave: "sintaxe", nivel: 1 },
    { chave: "estrutura", nivel: 2 },
    { chave: "perfil", nivel: 3 }
  ];

  return (
    <div className="validacao">
      <p>
        <strong>
          {r.valido ? "✅ JSON válido nos três níveis." : "❌ O JSON tem problemas."}
        </strong>
      </p>
      <ul>
        {niveis.map(({ chave, nivel }) => (
          <li key={chave}>
            {r.resumo[chave] ? "✓" : "✗"} {nivel}. {NOMES_NIVEL[nivel]}
          </li>
        ))}
      </ul>
      {r.problemas.length > 0 && (
        <ul className="lista-problemas">
          {r.problemas.map((p, i) => (
            <li key={i}>
              <strong>
                Nível {p.nivel} · {p.severidade}
              </strong>{" "}
              <code>{p.caminho}</code>
              <br />
              {p.mensagem}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Resultado do envio opcional ao servidor público de testes (HAPI).
type EnvioSandbox =
  | { tipo: "ok"; recursos: RecursoCriado[] }
  | { tipo: "erro"; mensagem: string; problemas: string[] };

const AVISO_SANDBOX =
  `Isto vai enviar o JSON ao servidor público de testes (${SANDBOX_URL}).\n` +
  "Qualquer pessoa poderá ver o que for enviado. Use apenas dados fictícios.\n\n" +
  "Continuar?";

function ResultadoEnvio({ envio }: { envio: EnvioSandbox }) {
  if (envio.tipo === "erro") {
    return (
      <div className="validacao" role="status">
        <p>
          <strong>❌ {envio.mensagem}</strong>
        </p>
        {envio.problemas.length > 0 && (
          <ul className="lista-problemas">
            {envio.problemas.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="validacao" role="status">
      <p>
        <strong>✅ Enviado ao servidor de testes. Recursos criados:</strong>
      </p>
      <ul className="resultados">
        {envio.recursos.map((r) => (
          <li key={`${r.tipo}/${r.id}`}>
            <a href={r.url} target="_blank" rel="noreferrer">
              {r.tipo}/{r.id}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- tela ----------

function App() {
  const [form, setForm] = useState<Formulario>(FORMULARIO_INICIAL);
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Editor do JSON: o texto pode ser alterado pelo aluno; o original guarda
  // o que o servidor devolveu, para restaurar.
  const [jsonTexto, setJsonTexto] = useState<string | null>(null);
  const [jsonOriginal, setJsonOriginal] = useState<string | null>(null);
  const [validacao, setValidacao] = useState<ResultadoValidacao | null>(null);
  const [envio, setEnvio] = useState<EnvioSandbox | null>(null);

  const [cpfBusca, setCpfBusca] = useState("");
  const [encontrados, setEncontrados] = useState<Bundle[] | null>(null);

  const unidade =
    OBSERVACOES.find((o) => o.valor === form.observacao)?.unidade ?? "";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((atual) => ({ ...atual, [name]: value }));
    // Limpa o erro do campo assim que a pessoa volta a editá-lo.
    setErrosCampo((atuais) => {
      if (!(name in atuais)) return atuais;
      const { [name]: _removido, ...resto } = atuais;
      return resto;
    });
  };

  const abrirNoEditor = (bundle: Bundle) => {
    const texto = JSON.stringify(bundle, null, 2);
    setJsonTexto(texto);
    setJsonOriginal(texto);
    setValidacao(null);
    setEnvio(null);
  };

  const mostrarErro = (err: unknown) => {
    const erro: ApiError = traduzirErro(err);
    setAviso(erro.message);
    return erro;
  };

  // ---------- gerar ----------

  const gerarBundle = async () => {
    setAviso(null);
    setErrosCampo({});
    setCarregando(true);
    try {
      const bundle = await criarBundle(montarPayload(form));
      abrirNoEditor(bundle);
    } catch (err) {
      const erro = mostrarErro(err);
      if (erro.tipo === "validacao") {
        const porCampo: Record<string, string> = {};
        for (const d of erro.detalhes) porCampo[d.campo] = d.mensagem;
        setErrosCampo(porCampo);
        setAviso("Corrija os campos destacados e tente novamente.");
      }
    } finally {
      setCarregando(false);
    }
  };

  // ---------- buscar ----------

  const buscar = async () => {
    setAviso(null);
    setEncontrados(null);
    setCarregando(true);
    try {
      setEncontrados(await buscarPorCpf(cpfBusca));
    } catch (err) {
      const erro = mostrarErro(err);
      if (erro.tipo === "naoEncontrado") {
        setAviso("Nenhum bundle encontrado para esse CPF.");
      }
    } finally {
      setCarregando(false);
    }
  };

  // ---------- validar o JSON editado ----------

  const validar = async () => {
    if (jsonTexto === null) return;
    setAviso(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonTexto);
    } catch (e) {
      // Nível 1: o JSON nem chega ao servidor.
      setValidacao({
        valido: false,
        resumo: { sintaxe: false, estrutura: false, perfil: false },
        problemas: [
          {
            nivel: 1,
            severidade: "erro",
            caminho: "$",
            mensagem: `JSON malformado: ${(e as Error).message}`
          }
        ]
      });
      return;
    }

    setCarregando(true);
    try {
      setValidacao(await validarBundle(parsed));
    } catch (err) {
      mostrarErro(err);
    } finally {
      setCarregando(false);
    }
  };

  // ---------- enviar ao servidor de testes (opcional) ----------

  const enviarSandbox = async () => {
    if (jsonTexto === null) return;
    setAviso(null);
    setEnvio(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonTexto);
    } catch (e) {
      setEnvio({
        tipo: "erro",
        mensagem: `JSON malformado: ${(e as Error).message}`,
        problemas: []
      });
      return;
    }

    // É um servidor público: confirma antes de publicar qualquer coisa.
    if (!window.confirm(AVISO_SANDBOX)) return;

    setCarregando(true);
    try {
      setEnvio({ tipo: "ok", recursos: await enviarAoSandbox(parsed) });
    } catch (err) {
      const erro =
        err instanceof ErroSandbox ? err : new ErroSandbox("Erro inesperado.");
      setEnvio({ tipo: "erro", mensagem: erro.message, problemas: erro.problemas });
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="container">
      <h1>Atividade prática - AULA 7</h1>

      {aviso && (
        <div className="banner-erro" role="alert">
          {aviso}
        </div>
      )}

      {/* PACIENTE */}
      <div className="card">
        <h2>Patient</h2>

        <div className="grid">
          <Campo rotulo="CPF" erro={errosCampo.cpf}>
            <input name="cpf" value={form.cpf} onChange={handleChange} placeholder="Somente números" />
          </Campo>
          <Campo rotulo="Nome(s) (given)" erro={errosCampo.given}>
            <input name="given" value={form.given} onChange={handleChange} placeholder="Ex.: Maria Aparecida" />
          </Campo>
          <Campo rotulo="Sobrenome (family)" erro={errosCampo.family}>
            <input name="family" value={form.family} onChange={handleChange} />
          </Campo>
          <Campo rotulo="Sexo (gender)" erro={errosCampo.gender}>
            <Selecao nome="gender" valor={form.gender} opcoes={GENEROS} onChange={handleChange} />
          </Campo>
          <Campo rotulo="Data de nascimento (birthDate)" erro={errosCampo.birthDate}>
            <input name="birthDate" type="date" value={form.birthDate} onChange={handleChange} />
          </Campo>
        </div>
      </div>

      {/* OBSERVAÇÃO */}
      <div className="card">
        <h2>Observation</h2>

        <div className="grid">
          <Campo rotulo="O que foi medido (code)" erro={errosCampo.observacao}>
            <Selecao nome="observacao" valor={form.observacao} opcoes={OBSERVACOES} onChange={handleChange} />
          </Campo>
          <Campo rotulo="Situação do registro (status)" erro={errosCampo.status}>
            <Selecao nome="status" valor={form.status} opcoes={STATUS_OBSERVACAO} onChange={handleChange} />
          </Campo>
          <Campo
            rotulo={unidade ? `Valor (${unidade})` : "Valor"}
            erro={errosCampo.value}
          >
            <input
              name="value"
              type="number"
              step="any"
              value={form.value}
              onChange={handleChange}
            />
          </Campo>
          <Campo rotulo="Data e hora da medida (effectiveDateTime)" erro={errosCampo.effectiveDateTime}>
            <input
              name="effectiveDateTime"
              type="datetime-local"
              value={form.effectiveDateTime}
              onChange={handleChange}
            />
          </Campo>
        </div>
      </div>

      {/* CONDIÇÃO */}
      <div className="card">
        <h2>Condition</h2>

        <div className="grid">
          <Campo rotulo="Problema ou diagnóstico (code)" erro={errosCampo.condicao}>
            <Selecao nome="condicao" valor={form.condicao} opcoes={CONDICOES} onChange={handleChange} />
          </Campo>
          <Campo rotulo="Situação clínica (clinicalStatus)" erro={errosCampo.clinicalStatus}>
            <Selecao
              nome="clinicalStatus"
              valor={form.clinicalStatus}
              opcoes={SITUACOES_CLINICAS}
              onChange={handleChange}
            />
          </Campo>
          <Campo rotulo="Data do registro (recordedDate)" erro={errosCampo.recordedDate}>
            <input name="recordedDate" type="date" value={form.recordedDate} onChange={handleChange} />
          </Campo>
        </div>
      </div>

      <button className="btn" onClick={gerarBundle} disabled={carregando}>
        Gerar Bundle
      </button>

      {/* BUSCA */}
      <div className="card">
        <h2>Buscar por CPF</h2>

        <div className="search">
          <input
            placeholder="Digite o CPF"
            value={cpfBusca}
            onChange={(e) => setCpfBusca(e.target.value)}
          />
          <button onClick={buscar} disabled={carregando}>
            Buscar
          </button>
        </div>

        {encontrados !== null && (
          <ul className="resultados">
            {encontrados.map((b) => (
              <li key={b.id}>
                <code>{b.id}</code>{" "}
                <button onClick={() => abrirNoEditor(b)}>Abrir no editor</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* JSON (editável) + VALIDAÇÃO */}
      {jsonTexto !== null && (
        <div className="card">
          <h2>Resultado (JSON)</h2>
          <p>
            Edite o JSON à vontade (apague um <code>system</code>, troque uma
            referência, remova um campo) e clique em <em>Validar JSON</em> para
            ver o que mudou.
          </p>

          <textarea
            className="json editor"
            aria-label="JSON do Bundle"
            value={jsonTexto}
            onChange={(e) => {
              setJsonTexto(e.target.value);
              setValidacao(null);
              setEnvio(null);
            }}
            rows={28}
            spellCheck={false}
          />

          <div className="search">
            <button onClick={validar} disabled={carregando}>
              Validar JSON
            </button>
            <button
              onClick={() => {
                setJsonTexto(jsonOriginal);
                setValidacao(null);
                setEnvio(null);
              }}
              disabled={jsonTexto === jsonOriginal}
            >
              Restaurar original
            </button>
            <button onClick={enviarSandbox} disabled={carregando}>
              Enviar ao servidor de testes (HAPI)
            </button>
          </div>
          <small>
            Opcional. Envia o JSON ao servidor público {SANDBOX_URL}: não use
            dados reais.
          </small>

          {validacao && <Validacao r={validacao} />}
          {envio && <ResultadoEnvio envio={envio} />}
        </div>
      )}
    </div>
  );
}

export default App;
