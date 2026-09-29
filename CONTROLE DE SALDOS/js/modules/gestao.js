import { supabase } from "../supabase.js";

export class Gestao {
  constructor(sistema) {
    this.sistema = sistema;
  }

  async carregarConteudo() {
    const container = document.getElementById("gestaoContent");
    this.sistema.ui.mostrarSpinner("gestaoContent", "Carregando gestão de saldos...");
    const html = await this.gerarHTMLGestao();
    container.innerHTML = html;
    this._dadosGestaoCarregados = false;
    this._atasGestaoGlobal = [];
    this._itensGestaoGlobal = [];
    await this.carregarFiltros();
    this.configurarEventos();
    this.renderizarEstadoInicialGestao();
  }

  async gerarHTMLGestao() {
    return `
            <div class="gestao-container">
                <div class="gestao-header">
                    <div class="gestao-titulo"><i class="fas fa-clipboard-check"></i> Gestão de Saldos</div>
                    <div class="gestao-filtros">
                        <input id="buscaAtaGestao" class="gestao-select gestao-busca-global" type="search" placeholder="🔍 Buscar ata, fornecedor ou CNPJ..." autocomplete="off">
                        <select id="filtroStatusGestao" class="gestao-select">
                            <option value="todos">📦 Todos</option>
                            <option value="disponivel">✅ Com saldo</option>
                            <option value="critico">⚠️ Crítico</option>
                            <option value="esgotado">❌ Esgotados</option>
                        </select>
                    </div>
                </div>

                <div class="filtros-gestao">
                    <div class="filtro-row">
                        <div class="filtro-busca">
                            <i class="fas fa-search"></i>
                            <input type="text" id="buscaGestao" placeholder="Buscar por nº da ata ou descrição do item...">
                        </div>
                    </div>
                    <div class="filtro-grid-3col">
                        <select id="filtroGestaoFornecedor" class="filtro-select"><option value="todos">Todos os fornecedores</option></select>
                        <select id="filtroGestaoOrgao" class="filtro-select"><option value="todos">Todos os órgãos</option></select>
                        <select id="filtroGestaoStatusAta" class="filtro-select">
                            <option value="todos">Todas as atas</option>
                            <option value="ATIVA">Ativas</option>
                            <option value="PROXIMA">Próximas</option>
                            <option value="VENCIDA">Vencidas</option>
                        </select>
                    </div>
                    <div class="filtro-row">
                        <select id="filtroGestaoSaldo" class="filtro-select" style="width: 220px">
                            <option value="todos">Todos os itens</option>
                            <option value="disponivel">Com saldo disponível</option>
                            <option value="critico">Saldo crítico (<10%)</option>
                            <option value="zerado">Saldo zerado</option>
                        </select>
                    </div>
                    <div class="filtro-checkboxes">
                        <label><input type="checkbox" id="ocultarZerados"><span>Ocultar itens com saldo zerado</span></label>
                        <label><input type="checkbox" id="apenas30dias"><span>Apenas itens com consumo nos últimos 30 dias</span></label>
                    </div>
                    <div class="filtro-actions">
                        <button class="btn-aplicar" id="btnAplicarFiltrosGestao"><i class="fas fa-filter"></i> Aplicar Filtros</button>
                        <button class="btn-limpar" id="btnLimparFiltrosGestao"><i class="fas fa-eraser"></i> Limpar</button>
                        <button class="btn-exportar" id="btnExportarLista"><i class="fas fa-download"></i> Exportar Lista</button>
                    </div>
                </div>
                <section class="auditoria-saldos-card" aria-labelledby="tituloAuditoriaSaldos">
                    <div class="auditoria-saldos-header">
                        <div>
                            <h2 id="tituloAuditoriaSaldos"><i class="fas fa-file-import"></i> Auditoria por arquivo JSON</h2>
                            <p>Leia um JSON gerado a partir do relatório de contratações, revise as diferenças e confirme somente depois de conferir.</p>
                        </div>
                        <div class="auditoria-saldos-acoes">
                            <input type="file" id="inputAuditoriaSaldosJson" accept="application/json,.json" hidden />
                            <button class="btn-auditoria-secundario" id="btnBaixarModeloAuditoria" type="button"><i class="fas fa-download"></i> Baixar modelo</button>
                            <button class="btn-auditoria-principal" id="btnImportarAuditoriaJson" type="button"><i class="fas fa-upload"></i> Importar JSON</button>
                        </div>
                    </div>
                    <div id="auditoriaSaldosStatus" class="auditoria-saldos-status auditoria-saldos-status-neutro">Nenhum arquivo carregado.</div>
                    <div id="auditoriaSaldosResumo" class="auditoria-saldos-resumo" hidden></div>
                    <div id="auditoriaSaldosTabela" class="auditoria-saldos-tabela" hidden></div>
                    <div id="auditoriaSaldosAcoesConfirmacao" class="auditoria-saldos-confirmacao" hidden>
                        <span><i class="fas fa-shield-alt"></i> A base de dados só será alterada após sua confirmação.</span>
                        <div>
                            <button class="btn-auditoria-secundario" id="btnDescartarAuditoriaJson" type="button">Descartar</button>
                            <button class="btn-auditoria-principal" id="btnConfirmarAuditoriaJson" type="button"><i class="fas fa-check"></i> Confirmar alterações</button>
                        </div>
                    </div>
                </section>

                <div id="statusEditorContainer" class="status-editor" style="display: none">
                    <span><i class="fas fa-tag"></i> Status da Ata:</span>
                    <select id="statusAtaSelect" class="status-select">
                        <option value="ATIVA">🟢 ATIVA</option>
                        <option value="PROXIMA">🟡 PRÓXIMA</option>
                        <option value="VENCIDA">🔴 VENCIDA</option>
                    </select>
                    <button class="btn-status" id="btnAlterarStatus"><i class="fas fa-save"></i> Salvar Alteração</button>
                </div>

                <div id="gestaoStats" class="gestao-stats">
                    <div><span class="gestao-stat-label">Ata:</span> <span id="gestaoAtaNome">Nenhuma</span></div>
                    <div><span class="gestao-stat-label">Total itens:</span> <span id="gestaoTotalItens">0</span></div>
                    <div><span class="gestao-stat-label">Com saldo:</span> <span id="gestaoItensComSaldo">0</span></div>
                    <div><span class="gestao-stat-label">Críticos:</span> <span id="gestaoItensCriticos">0</span></div>
                </div>

                <div id="itensGestaoContainer" class="gestao-tabela-wrapper"></div>
            </div>
        `;
  }

  renderizarEstadoInicialGestao() {
    const container = document.getElementById("itensGestaoContainer");
    if (!container) return;
    container.innerHTML = `<div class="gestao-estado-inicial"><i class="fas fa-filter"></i><h3>Aguardando filtros</h3><p>Informe os filtros acima e clique em <strong>Aplicar Filtros</strong> para carregar os itens.</p></div>`;
    this.atualizarStatsGestaoGlobal([]);
  }
  async carregarSelects() {
    const { data: atas, error } = await supabase
      .from("atas")
      .select("id, numero_ata, processo_administrativo, numero_pregao, situacao, fornecedor:fornecedores(id, razao_social, cnpj), itens:itens_ata(*)")
      .order("numero_ata");
    if (error) {
      console.error("Erro ao carregar saldos:", error);
      this._atasGestaoGlobal = [];
      this._itensGestaoGlobal = [];
      this.sistema.ui.mostrarToast("erro", "Não foi possível carregar os saldos.");
      return;
    }
    this._atasGestaoGlobal = atas || [];
    this._itensGestaoGlobal = this._atasGestaoGlobal.flatMap((ata) => (ata.itens || []).map((item) => ({
      ...item,
      ata_id: ata.id,
      ata_numero: ata.numero_ata,
      ata_processo: ata.processo_administrativo,
      ata_pregao: ata.numero_pregao,
      ata_situacao: ata.situacao,
      fornecedor_razao_social: ata.fornecedor?.razao_social || "",
      fornecedor_cnpj: ata.fornecedor?.cnpj || "",
    })));
    this.sistema.ataSelecionada = null;
  }
  async carregarFiltros() {
    const sf = document.getElementById("filtroGestaoFornecedor");
    if (sf) {
      sf.innerHTML = '<option value="todos">Todos os fornecedores</option>';
      const { data: f } = await supabase
        .from("fornecedores")
        .select("razao_social")
        .order("razao_social");
      f?.forEach((f) => {
        const o = document.createElement("option");
        o.value = f.razao_social;
        o.textContent = f.razao_social;
        sf.appendChild(o);
      });
    }
    await this.sistema.ui.carregarSelectOrgaos("filtroGestaoOrgao");
  }

  configurarEventos() {









    document
      .getElementById("btnAplicarFiltrosGestao")
      .addEventListener("click", () => this.aplicarFiltrosGestao());
    document
      .getElementById("btnLimparFiltrosGestao")
      .addEventListener("click", () => this.limparFiltrosGestao());
    document
      .getElementById("btnExportarLista")
      .addEventListener("click", () => this.exportarListaGestao());
    document
      .getElementById("btnAlterarStatus")
      .addEventListener("click", () => this.alterarStatusAta());
    document
      .getElementById("btnImportarAuditoriaJson")
      .addEventListener("click", () => document.getElementById("inputAuditoriaSaldosJson")?.click());
    document
      .getElementById("inputAuditoriaSaldosJson")
      .addEventListener("change", (event) => this.importarAuditoriaJson(event.target.files?.[0]));
    document
      .getElementById("btnBaixarModeloAuditoria")
      .addEventListener("click", () => this.baixarModeloAuditoria());
    document
      .getElementById("btnConfirmarAuditoriaJson")
      .addEventListener("click", () => this.confirmarAuditoriaJson());
    document
      .getElementById("btnDescartarAuditoriaJson")
      .addEventListener("click", () => this.limparAuditoriaJson());
  }

  _numero(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = String(value).trim().replace(/R\$\s?/gi, "").replace(/\./g, "").replace(/,/g, ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  _texto(value) {
    return String(value ?? "").trim();
  }

  _normalizarCnpj(value) {
    return this._texto(value).replace(/\D/g, "");
  }

  _normalizarJsonAuditoria(payload) {
    const rows = [];
    const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
    const meta = root.meta || root.metadata || root.cabecalho || root.cabeçalho || {};
    const aliases = (obj) => {
      const map = {};
      Object.entries(obj || {}).forEach(([key, value]) => {
        map[key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")] = value;
      });
      return map;
    };
    const pick = (obj, names) => {
      const map = aliases(obj);
      for (const name of names) {
        const value = map[name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "")];
        if (value !== undefined && value !== null && value !== "") return value;
      }
      return undefined;
    };
    const nomeFornecedor = (value) => value && typeof value === "object" ? pick(value, ["razao_social", "razao social", "nome", "fornecedor"]) : value;
    const adicionar = (item, contexto = {}) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return;
      const fornecedorItem = nomeFornecedor(pick(item, ["fornecedor", "razao_social", "razao social", "nome_fornecedor"])) || nomeFornecedor(contexto.fornecedor) || contexto.razao_social;
      const row = {
        processo_administrativo: pick(item, ["processo_administrativo", "processo", "processo administrativo"]) ?? pick(contexto, ["processo_administrativo", "processo"]) ?? pick(meta, ["processo_administrativo", "processo"]),
        licitacao: pick(item, ["licitacao", "numero_pregao", "pregao", "numero do pregao"]) ?? pick(contexto, ["licitacao", "numero_pregao", "pregao"]) ?? pick(meta, ["licitacao", "numero_pregao", "pregao"]),
        numero_ata: pick(item, ["numero_ata", "ata", "numero ata", "numero_da_ata", "contratacao", "numero_contratacao", "numero contrato"]) ?? pick(contexto, ["numero_ata", "ata", "contratacao", "numero_contratacao"]),
        fornecedor: fornecedorItem,
        cnpj: pick(item, ["cnpj", "documento_fornecedor"]) ?? pick(contexto, ["cnpj", "documento_fornecedor"]),
        item_numero: pick(item, ["item_numero", "numero_item", "item", "numero", "n", "codigo_item", "item_no", "item_number"]),
        descricao: pick(item, ["descricao", "descrição", "descricao_item", "produto", "material", "objeto"]),
        valor_unitario: this._numero(pick(item, ["valor_unitario", "vl_unitario", "preco_unitario", "preco", "valor"])),
        quantidade_original: this._numero(pick(item, ["quantidade_original", "qtd_original", "quantidade_contratada", "qtd_contratada", "original"])),
        quantidade_aditivo: this._numero(pick(item, ["quantidade_aditivo", "qtd_aditivo", "aditivo"])),
        quantidade_executada: this._numero(pick(item, ["quantidade_executada", "qtd_executada", "quantidade_consumida", "qtd_consumida", "executado", "consumido"])),
        quantidade_saldo: this._numero(pick(item, ["saldo_real", "saldoReal", "quantidade_saldo", "saldo_quantidade", "saldo_atual", "saldo_disponivel", "qtd_saldo", "saldo"])),
        valor_original: this._numero(pick(item, ["valor_original"])),
        valor_aditivos: this._numero(pick(item, ["valor_aditivos", "valor_aditivo"])),
        valor_executado: this._numero(pick(item, ["valor_executado", "valor_consumido"])),
        valor_saldo: this._numero(pick(item, ["valor_saldo", "saldo_valor", "valor_saldo_real"])),
      };
      if (row.item_numero !== undefined && row.item_numero !== null && row.item_numero !== "") rows.push(row);
    };
    const colecoes = new Set(["atas", "ata", "fornecedores", "fornecedor", "contratos", "contratacoes", "contratacao", "itens", "items", "produtos", "linhas", "dados", "data", "resultado", "resultados", "registros", "rows"]);
    const walk = (node, contexto = {}, depth = 0) => {
      if (depth > 8 || node === null || node === undefined) return;
      if (Array.isArray(node)) { node.forEach((entry) => walk(entry, contexto, depth + 1)); return; }
      if (typeof node !== "object") return;
      const contextoAtual = { ...contexto };
      ["numero_ata", "ata", "contratacao", "numero_contratacao", "processo_administrativo", "processo", "licitacao", "numero_pregao", "fornecedor", "razao_social", "cnpj"].forEach((key) => {
        const value = pick(node, [key]);
        if (value !== undefined) contextoAtual[key] = value;
      });
      const numeroItem = pick(node, ["item_numero", "numero_item", "item", "numero", "n", "codigo_item", "item_no", "item_number"]);
      const saldo = pick(node, ["saldo_real", "saldoReal", "quantidade_saldo", "saldo_quantidade", "saldo_atual", "saldo_disponivel", "qtd_saldo", "saldo"]);
      if (numeroItem !== undefined && (saldo !== undefined || pick(node, ["descricao", "descrição", "produto", "material", "objeto"]) !== undefined)) adicionar(node, contextoAtual);
      Object.entries(node).forEach(([key, value]) => {
        if (value && typeof value === "object" && (colecoes.has(key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) || depth < 3)) walk(value, contextoAtual, depth + 1);
      });
    };
    walk(payload, {});
    const unique = new Map();
    rows.forEach((row) => {
      const key = [row.numero_ata, row.fornecedor, row.cnpj, row.item_numero, row.descricao].map((v) => this._normalizarBusca(v)).join("|");
      if (!unique.has(key)) unique.set(key, row);
    });
    return { meta, rows: [...unique.values()] };
  }
  _formatarNumero(value) {
    return value === null || value === undefined || Number.isNaN(Number(value)) ? "—" : Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  }

  async importarAuditoriaJson(file) {
    if (!file) return;
    const status = document.getElementById("auditoriaSaldosStatus");
    try {
      status.textContent = `Lendo ${file.name}...`;
      status.className = "auditoria-saldos-status auditoria-saldos-status-neutro";
      const payload = JSON.parse(await file.text());
      const normalizado = this._normalizarJsonAuditoria(payload);
      if (!normalizado.rows.length) throw new Error("O JSON não contém itens reconhecíveis. Use o modelo disponibilizado na tela.");
      const { data: atas, error } = await supabase.from("atas").select("id, numero_ata, processo_administrativo, numero_pregao, fornecedor_id, fornecedor:fornecedores(id, razao_social, cnpj), itens:itens_ata(id, item_numero, descricao, quantidade_contratada, saldo_quantidade, saldo_valor, valor_unitario, valor_total)");
      if (error) throw error;
      const comparacoes = [];
      const normalizar = (v) => this._normalizarBusca(v);
      const identificarAtas = (row) => {
        const ref = normalizar(row.numero_ata || row.processo_administrativo || row.licitacao);
        const cnpj = this._normalizarCnpj(row.cnpj);
        const fornecedor = normalizar(row.fornecedor);
        let candidatos = atas || [];
        if (ref) candidatos = candidatos.filter((ata) => [ata.numero_ata, ata.processo_administrativo, ata.numero_pregao].some((v) => normalizar(v) === ref || (normalizar(v) && ref.includes(normalizar(v)))));
        if (cnpj) candidatos = candidatos.filter((ata) => this._normalizarCnpj(ata.fornecedor?.cnpj) === cnpj);
        else if (fornecedor) candidatos = candidatos.filter((ata) => normalizar(ata.fornecedor?.razao_social).includes(fornecedor) || fornecedor.includes(normalizar(ata.fornecedor?.razao_social)));
        return candidatos;
      };
      normalizado.rows.forEach((row) => {
        const candidatos = identificarAtas(row);
        const ref = normalizar(row.numero_ata || row.processo_administrativo || row.licitacao);
        const referencias = ref ? (atas || []).filter((ata) => [ata.numero_ata, ata.processo_administrativo, ata.numero_pregao].some((v) => normalizar(v) === ref || (normalizar(v) && ref.includes(normalizar(v))))) : [];
        const fornecedorDivergente = Boolean(ref && referencias.length && !candidatos.length);
        const ata = candidatos.length === 1 ? candidatos[0] : null;
        const itens = ata?.itens || [];
        const itemNumero = normalizar(row.item_numero);
        const itensNumero = itens.filter((i) => normalizar(i.item_numero) === itemNumero);
        let item = itensNumero.length === 1 ? itensNumero[0] : null;
        if (!item && row.descricao) {
          const descricao = normalizar(row.descricao);
          const porDescricao = itens.filter((i) => normalizar(i.descricao) === descricao);
          item = porDescricao.length === 1 ? porDescricao[0] : null;
        }
        const novoSaldo = row.quantidade_saldo;
        const novoValorSaldo = row.valor_saldo !== null ? row.valor_saldo : (novoSaldo !== null && row.valor_unitario !== null ? novoSaldo * row.valor_unitario : null);
        let situacao = "ATUALIZAR";
        let motivo = "Saldo real diferente do saldo atual";
        if (!ata) {
          situacao = fornecedorDivergente ? "DIVERGENCIA_FORNECEDOR" : (candidatos.length > 1 ? "AMBIGUO" : "NAO_ENCONTRADO");
          motivo = fornecedorDivergente ? "A ATA foi localizada, mas fornecedor ou CNPJ diverge do JSON" : (candidatos.length > 1 ? "Mais de uma ATA corresponde aos dados do JSON" : "ATA, processo, fornecedor ou CNPJ não localizado");
        } else if (itensNumero.length > 1) {
          situacao = "AMBIGUO"; motivo = "Número do item duplicado dentro da ATA";
        } else if (!item) {
          situacao = "NAO_ENCONTRADO"; motivo = "Item não localizado dentro da ATA";
        } else if (novoSaldo === null || novoSaldo < 0) {
          situacao = "INVALIDO"; motivo = "Saldo real ausente ou negativo";
        } else if (row.quantidade_original !== null && Number(row.quantidade_original) !== Number(item.quantidade_contratada)) {
          situacao = "DIVERGENCIA_CONTRATADA"; motivo = `Quantidade contratada diverge: JSON ${row.quantidade_original} x sistema ${item.quantidade_contratada}`;
        } else if (Number(item.saldo_quantidade) === novoSaldo && (novoValorSaldo === null || Number(item.saldo_valor) === novoValorSaldo)) {
          situacao = "SEM_ALTERACAO"; motivo = "Saldo real já confere com o sistema";
        }
        comparacoes.push({ ...row, ata, item, candidatos, novoSaldo, novoValorSaldo, situacao, motivo });
      });
      this._auditoriaSaldos = { fileName: file.name, meta: normalizado.meta, comparacoes, importadoEm: new Date().toISOString() };
      this.renderizarAuditoriaSaldos();
    } catch (error) {
      console.error("Erro ao importar auditoria:", error);
      status.textContent = error.message || "Não foi possível ler o JSON.";
      status.className = "auditoria-saldos-status auditoria-saldos-status-erro";
      this._auditoriaSaldos = null;
    }
  }
  renderizarAuditoriaSaldos() {
    const auditoria = this._auditoriaSaldos;
    const status = document.getElementById("auditoriaSaldosStatus");
    const resumo = document.getElementById("auditoriaSaldosResumo");
    const tabela = document.getElementById("auditoriaSaldosTabela");
    const acoes = document.getElementById("auditoriaSaldosAcoesConfirmacao");
    const aprovados = ["ATUALIZAR", "SEM_ALTERACAO"];
    const atualizaveis = auditoria.comparacoes.filter((r) => r.situacao === "ATUALIZAR");
    const problemas = auditoria.comparacoes.filter((r) => !aprovados.includes(r.situacao));
    const semAlteracao = auditoria.comparacoes.filter((r) => r.situacao === "SEM_ALTERACAO");
    status.textContent = `${auditoria.fileName}: ${auditoria.comparacoes.length} item(ns) analisado(s).`;
    status.className = `auditoria-saldos-status ${problemas.length ? "auditoria-saldos-status-erro" : "auditoria-saldos-status-sucesso"}`;
    resumo.hidden = false;
    resumo.innerHTML = `<div><strong>${auditoria.comparacoes.length}</strong><span>itens lidos</span></div><div><strong>${atualizaveis.length}</strong><span>serão atualizados</span></div><div><strong>${semAlteracao.length}</strong><span>já conferem</span></div><div><strong>${problemas.length}</strong><span>divergências</span></div>`;
    tabela.hidden = false;
    const badge = (s) => ({ ATUALIZAR: "Atualizar", SEM_ALTERACAO: "Confere", NAO_ENCONTRADO: "Não localizado", AMBIGUO: "Ambíguo", INVALIDO: "Inválido", DIVERGENCIA_CONTRATADA: "Qtd. divergente", DIVERGENCIA_FORNECEDOR: "Fornecedor divergente" }[s] || s);
    const pageSize = 20;
    const totalPaginas = Math.max(1, Math.ceil(auditoria.comparacoes.length / pageSize));
    auditoria.pagina = Math.min(Math.max(Number(auditoria.pagina || 1), 1), totalPaginas);
    const inicioPagina = (auditoria.pagina - 1) * pageSize;
    const itensPagina = auditoria.comparacoes.slice(inicioPagina, inicioPagina + pageSize);
    tabela.innerHTML = `<div class="auditoria-tabela-scroll"><table><thead><tr><th>Status</th><th>ATA / fornecedor</th><th>Item / descrição</th><th>Qtd. contratada</th><th>Saldo atual</th><th>Saldo real (JSON)</th><th>Diferença</th><th>Observação</th></tr></thead><tbody>${itensPagina.map((r) => { const contratado = r.item?.quantidade_contratada; const atual = r.item?.saldo_quantidade; const diff = r.novoSaldo !== null && atual !== undefined ? r.novoSaldo - Number(atual) : null; return `<tr class="auditoria-linha-${r.situacao.toLowerCase()}"><td><span class="auditoria-badge auditoria-badge-${r.situacao.toLowerCase()}">${badge(r.situacao)}</span></td><td><strong>${r.ata?.numero_ata || r.numero_ata || "—"}</strong><small>${r.ata?.fornecedor?.razao_social || r.fornecedor || "—"}<br>${r.ata?.fornecedor?.cnpj || r.cnpj || ""}</small></td><td><strong>${r.item_numero || "—"}</strong><span class="auditoria-descricao">${r.item?.descricao || r.descricao || "—"}</span></td><td class="numeric">${this._formatarNumero(contratado)}</td><td class="numeric">${this._formatarNumero(atual)}</td><td class="numeric saldo-real-json">${this._formatarNumero(r.novoSaldo)}</td><td class="numeric">${diff === null ? "—" : (diff > 0 ? "+" : "") + this._formatarNumero(diff)}</td><td>${r.motivo || "—"}</td></tr>`; }).join("")}</tbody></table></div><div class="auditoria-paginacao"><span>Itens ${inicioPagina + 1}–${Math.min(inicioPagina + itensPagina.length, auditoria.comparacoes.length)} de ${auditoria.comparacoes.length}</span><div><button type="button" ${auditoria.pagina <= 1 ? "disabled" : ""} onclick="sistema.gestao.mudarPaginaAuditoria(${auditoria.pagina - 1})"><i class="fas fa-chevron-left"></i></button><strong>Página ${auditoria.pagina} de ${totalPaginas}</strong><button type="button" ${auditoria.pagina >= totalPaginas ? "disabled" : ""} onclick="sistema.gestao.mudarPaginaAuditoria(${auditoria.pagina + 1})"><i class="fas fa-chevron-right"></i></button></div></div>`;
    acoes.hidden = false;
    const btn = document.getElementById("btnConfirmarAuditoriaJson");
    btn.disabled = atualizaveis.length === 0 || problemas.length > 0;
    btn.title = problemas.length ? "Corrija todas as divergências antes de confirmar" : `Confirmar ${atualizaveis.length} alteração(ões)`;
    if (problemas.length) status.textContent += ` ${problemas.length} divergência(s) impedem a confirmação em lote.`;
  }
  mudarPaginaAuditoria(pagina) {
    if (!this._auditoriaSaldos) return;
    this._auditoriaSaldos.pagina = Number(pagina) || 1;
    this.renderizarAuditoriaSaldos();
  }
  async confirmarAuditoriaJson() {
    const auditoria = this._auditoriaSaldos;
    if (!auditoria) return;
    const alteracoes = auditoria.comparacoes.filter((r) => r.situacao === "ATUALIZAR" && r.item?.id);
    if (!alteracoes.length) return this.sistema.ui.mostrarToast("aviso", "Não há alterações válidas para confirmar.");
    if (auditoria.comparacoes.some((r) => !["ATUALIZAR", "SEM_ALTERACAO"].includes(r.situacao))) return this.sistema.ui.mostrarToast("erro", "Resolva as pendências do JSON antes de confirmar.");
    const confirmado = await this.sistema.confirmar(`Confirmar ${alteracoes.length} alteração(ões) de saldo no banco? Esta ação será aplicada aos itens localizados no JSON.`);
    if (!confirmado) return;
    try {
      let aplicados = 0;
      for (const row of alteracoes) {
        const update = { saldo_quantidade: row.novoSaldo, updated_at: new Date().toISOString() };
        if (row.novoValorSaldo !== null) update.saldo_valor = row.novoValorSaldo;
        update.situacao = row.novoSaldo <= 0 ? "ESGOTADO" : "DISPONIVEL";
        const { error } = await supabase.from("itens_ata").update(update).eq("id", row.item.id);
        if (error) throw error;
        aplicados++;
      }
      this.sistema.ui.mostrarToast("sucesso", `${aplicados} saldo(s) atualizado(s) com sucesso.`);
      this.limparAuditoriaJson();
      if (this.sistema.ataSelecionada) await this.carregarItensGestao();
      await this.sistema.consulta?.carregarConteudo?.();
    } catch (error) {
      console.error("Erro ao confirmar auditoria:", error);
      this.sistema.ui.mostrarToast("erro", error.message || "Falha ao gravar as alterações.");
    }
  }

  limparAuditoriaJson() {
    this._auditoriaSaldos = null;
    const input = document.getElementById("inputAuditoriaSaldosJson");
    if (input) input.value = "";
    ["auditoriaSaldosResumo", "auditoriaSaldosTabela", "auditoriaSaldosAcoesConfirmacao"].forEach((id) => { const el = document.getElementById(id); if (el) { el.hidden = true; el.innerHTML = id === "auditoriaSaldosAcoesConfirmacao" ? el.innerHTML : ""; } });
    const status = document.getElementById("auditoriaSaldosStatus");
    if (status) { status.textContent = "Nenhum arquivo carregado."; status.className = "auditoria-saldos-status auditoria-saldos-status-neutro"; }
  }

  baixarModeloAuditoria() {
    const modelo = { meta: { processo_administrativo: "31/2026", licitacao: "18", data_relatorio: "2026-09-29" }, fornecedores: [{ fornecedor: "Razão Social", cnpj: "00.000.000/0001-00", numero_ata: "71/2026", contratacao: "1533", itens: [{ item_numero: "11", descricao: "Descrição do item", valor_unitario: 309.33, quantidade_original: 10, quantidade_aditivo: 0, quantidade_executada: 0, quantidade_saldo: 10, valor_original: 3093.3, valor_aditivos: 0, valor_executado: 0, valor_saldo: 3093.3 }] }] };
    const blob = new Blob([JSON.stringify(modelo, null, 2)], { type: "application/json;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "modelo-auditoria-saldos.json"; link.click(); URL.revokeObjectURL(link.href);
  }

  async carregarItensGestao() {
    const ataId = document.getElementById("selectAtaGestao").value;
    if (!ataId) {
      document.getElementById("itensGestaoContainer").innerHTML = "";
      this.atualizarStatsGestao(null);
      document.getElementById("statusEditorContainer").style.display = "none";
      return;
    }
    const { data: ata } = await supabase
      .from("atas")
      .select("*, itens:itens_ata(*)")
      .eq("id", ataId)
      .single();
    this.sistema.ataSelecionada = ata;
    document.getElementById("statusEditorContainer").style.display = "flex";
    document.getElementById("statusAtaSelect").value = ata.situacao || "ATIVA";
    this.atualizarStatsGestao(ata);
    this.filtrarItensGestao();
  }

  atualizarStatsGestao(ata) {
    if (!ata) {
      document.getElementById("gestaoAtaNome").innerText = "Nenhuma";
      document.getElementById("gestaoTotalItens").innerText = "0";
      document.getElementById("gestaoItensComSaldo").innerText = "0";
      document.getElementById("gestaoItensCriticos").innerText = "0";
      return;
    }
    document.getElementById("gestaoAtaNome").innerText = ata.numero_ata;
    document.getElementById("gestaoTotalItens").innerText = ata.itens.length;
    let comSaldo = 0,
      criticos = 0;
    ata.itens.forEach((i) => {
      if (i.saldo_quantidade > 0) comSaldo++;
      if (
        i.saldo_quantidade > 0 &&
        i.saldo_quantidade <= i.quantidade_contratada * 0.1
      )
        criticos++;
    });
    document.getElementById("gestaoItensComSaldo").innerText = comSaldo;
    document.getElementById("gestaoItensCriticos").innerText = criticos;
  }

  filtrarItensGestao() {
    this.filtrarGestao();
  }
  _normalizarBusca(value) {
    return String(value || "").toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  }
  atualizarStatsGestaoGlobal(itens) {
    document.getElementById("gestaoAtaNome").innerText = itens.length ? "Consulta global" : "Nenhuma";
    document.getElementById("gestaoTotalItens").innerText = itens.length;
    document.getElementById("gestaoItensComSaldo").innerText = itens.filter((i) => Number(i.saldo_quantidade || 0) > 0).length;
    document.getElementById("gestaoItensCriticos").innerText = itens.filter((i) => Number(i.saldo_quantidade || 0) > 0 && Number(i.saldo_quantidade) <= Number(i.quantidade_contratada || 0) * 0.1).length;
  }
  filtrarGestao() {
    if (!this._dadosGestaoCarregados) { this.renderizarEstadoInicialGestao(); return; }
    const buscaGlobal = this._normalizarBusca(document.getElementById("buscaAtaGestao")?.value);
    const buscaItem = this._normalizarBusca(document.getElementById("buscaGestao")?.value);
    const fornecedor = document.getElementById("filtroGestaoFornecedor")?.value || "todos";
    const statusAta = document.getElementById("filtroGestaoStatusAta")?.value || "todos";
    const saldoFiltro = document.getElementById("filtroGestaoSaldo")?.value || "todos";
    const ocultarZerados = document.getElementById("ocultarZerados")?.checked || false;
    let itens = [...(this._itensGestaoGlobal || [])];
    if (buscaGlobal) {
      itens = itens.filter((i) => [i.ata_numero, i.ata_processo, i.ata_pregao, i.fornecedor_razao_social, i.fornecedor_cnpj, i.item_numero, i.descricao].some((v) => this._normalizarBusca(v).includes(buscaGlobal)));
    }
    if (buscaItem) itens = itens.filter((i) => this._normalizarBusca(i.descricao).includes(buscaItem) || this._normalizarBusca(i.item_numero).includes(buscaItem));
    if (fornecedor !== "todos") itens = itens.filter((i) => i.fornecedor_razao_social === fornecedor);
    if (statusAta !== "todos") itens = itens.filter((i) => i.ata_situacao === statusAta);
    if (saldoFiltro === "disponivel") itens = itens.filter((i) => Number(i.saldo_quantidade || 0) > 0);
    if (saldoFiltro === "critico") itens = itens.filter((i) => Number(i.saldo_quantidade || 0) > 0 && Number(i.saldo_quantidade) <= Number(i.quantidade_contratada || 0) * 0.1);
    if (saldoFiltro === "zerado") itens = itens.filter((i) => Number(i.saldo_quantidade || 0) <= 0);
    if (ocultarZerados) itens = itens.filter((i) => Number(i.saldo_quantidade || 0) > 0);
    this.sistema.filtrosGestaoAtivos = { ...this.sistema.filtrosGestaoAtivos, busca: buscaItem, fornecedor, statusAta, saldo: saldoFiltro, ocultarZerados };
    document.getElementById("statusEditorContainer").style.display = "none";
    this.atualizarStatsGestaoGlobal(itens);
    this._itensGestaoExibidos = itens;
    this.renderizarItensGestao(itens);
  }
  async aplicarFiltrosGestao() {
    const botao = document.getElementById("btnAplicarFiltrosGestao");
    if (botao) { botao.disabled = true; botao.classList.add("carregando"); }
    try {
      await this.carregarSelects();
      this._dadosGestaoCarregados = true;
      this.filtrarGestao();
    } finally {
      if (botao) { botao.disabled = false; botao.classList.remove("carregando"); }
    }
  }
  limparFiltrosGestao() {
    document.getElementById("buscaAtaGestao").value = "";
    document.getElementById("buscaGestao").value = "";
    document.getElementById("filtroGestaoFornecedor").value = "todos";
    document.getElementById("filtroGestaoOrgao").value = "todos";
    document.getElementById("filtroGestaoStatusAta").value = "todos";
    document.getElementById("filtroGestaoSaldo").value = "todos";
    document.getElementById("ocultarZerados").checked = false;
    document.getElementById("apenas30dias").checked = false;
    this.sistema.filtrosGestaoAtivos = {
      busca: "",
      fornecedor: "todos",
      orgao: "todos",
      statusAta: "todos",
      saldo: "todos",
      ocultarZerados: false,
      apenas30dias: false,
    };
    this.filtrarGestao();
  }

  exportarListaGestao() {
    const itens = this._itensGestaoExibidos || this._itensGestaoGlobal || [];
    if (!itens.length) {
      this.sistema.ui.mostrarToast("erro", "Nenhum item encontrado para exportar");
      return;
    }
    const cabecalho = [
      "Item",
      "Descrição",
      "Qtd Contratada",
      "Saldo",
      "Valor Unitário",
      "Valor Total",
    ];
    const linhas = itens.map((i) => [
      i.item_numero,
      i.descricao,
      i.quantidade_contratada,
      i.saldo_quantidade,
      this.sistema.ui.formatarMoeda(i.valor_unitario),
      this.sistema.ui.formatarMoeda(i.valor_total),
    ]);
    const csv = [cabecalho.join(","), ...linhas.map((l) => l.join(","))].join(
      "\n",
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      "gestao-global-de-saldos.csv",
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.sistema.ui.mostrarToast("sucesso", "Lista exportada com sucesso!");
  }

  async alterarStatusAta() {
    if (!this.sistema.ataSelecionada) return;
    const novo = document.getElementById("statusAtaSelect").value;
    if (this.sistema.ataSelecionada.situacao === novo) {
      this.sistema.ui.mostrarToast("aviso", "O status já é " + novo);
      return;
    }
    const confirmado = await this.sistema.confirmar(
      `Deseja alterar o status da ata de ${this.sistema.ataSelecionada.situacao} para ${novo}?`,
    );
    if (!confirmado) return;
    try {
      const { error } = await supabase
        .from("atas")
        .update({ situacao: novo })
        .eq("id", this.sistema.ataSelecionada.id);
      if (error) throw error;
      this.sistema.ui.mostrarToast("sucesso", "Status atualizado!");
      this.sistema.ataSelecionada.situacao = novo;
      await this.sistema.consulta.carregarConteudo();
    } catch (error) {
      this.sistema.ui.mostrarToast("erro", error.message);
    }
  }

  renderizarItensGestao(itens) {
    const container = document.getElementById("itensGestaoContainer");
    if (!itens.length) {
      container.innerHTML =
        '<div style="text-align:center;padding:40px;"><i class="fas fa-box-open" style="font-size:3rem;color:var(--neutral-400);"></i><h3 style="margin-top:15px;color:var(--neutral-500);font-size:0.9rem;">Nenhum item encontrado</h3></div>';
      return;
    }
    const podeConsumir =
      this.sistema.usuarioAtual?.perfil === "ADMIN" ||
      this.sistema.usuarioAtual?.perfil === "ESTAGIARIO";
    container.innerHTML = `<table class="gestao-tabela">
            <thead><tr><th>ATA</th><th>Fornecedor / CNPJ</th><th>Item</th><th>Descrição</th><th>Qtd. contratada</th><th>Saldo atual</th><th>Saldo real</th><th>Valor Unit.</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>${itens
              .map((item) => {
                const saldo = item.saldo_quantidade || 0;
                const critico =
                  saldo > 0 && saldo <= item.quantidade_contratada * 0.1;
                return `<tr>
                    <td><strong>${item.ata_numero || "—"}</strong><small class="gestao-contexto">${item.ata_situacao || ""}</small></td>
                    <td><span>${item.fornecedor_razao_social || "—"}</span><small class="gestao-contexto">${item.fornecedor_cnpj || ""}</small></td>
                    <td>${item.item_numero}</td>
                    <td>${item.descricao}</td>
                    <td class="numeric">${item.quantidade_contratada}</td>
                    <td class="numeric ${saldo <= 0 ? "saldo-zerado" : critico ? "saldo-baixo" : "saldo-alto"}">${saldo}</td>
                    <td class="numeric saldo-real-cell">${this.sistema.usuarioAtual?.perfil === "ADMIN" ? `<div class="ajuste-saldo-inline ajuste-saldo-real"><input type="number" min="0" step="any" value="${saldo}" id="saldoReal_${item.id}" aria-label="Saldo real do item ${item.item_numero}"><button class="btn-ajustar-saldo" onclick="sistema.gestao.ajustarSaldo(${item.id}, document.getElementById('saldoReal_${item.id}').value)"><i class="fas fa-save"></i> Salvar</button></div>` : "—"}</td>
                    <td class="numeric">${this.sistema.ui.formatarMoeda(item.valor_unitario)}</td>
                    <td><span class="status-badge" style="background:${saldo <= 0 ? "var(--error-100)" : critico ? "var(--warning-100)" : "var(--success-100)"};color:${saldo <= 0 ? "var(--error-800)" : critico ? "var(--warning-800)" : "var(--success-800)"};">${saldo <= 0 ? "Esgotado" : critico ? "Crítico" : "Normal"}</span></td>
                    <td class="gestao-acoes-item">${podeConsumir ? `<button class="btn-lancar-rapido" onclick="sistema.gestao.abrirModalConsumo(${item.ata_id},${item.id})"><i class="fas fa-pen"></i> Consumo</button>` : ""}</td>
                </tr>`;
              })
              .join("")}
            </tbody>
        </table>`;
  }

  async abrirModalConsumo(ataId, itemId) {
    const { data: item } = await supabase
      .from("itens_ata")
      .select("*")
      .eq("id", itemId)
      .single();
    const saldo = item.saldo_quantidade || 0;
    const ataContexto = (this._atasGestaoGlobal || []).find((ata) => Number(ata.id) === Number(ataId));
    await this.sistema.ui.carregarSelectOrgaos("autarquiaConsumo");
    document.getElementById("modalConsumoConteudo").innerHTML = `<div>
            <div style="background:var(--neutral-50);padding:12px;border-radius:var(--border-radius-lg);margin-bottom:16px;">
                <p style="font-size:0.85rem;"><strong>Ata:</strong> ${ataContexto?.numero_ata || "—"}</p>
                <p style="font-size:0.85rem;"><strong>Item:</strong> ${item.descricao}</p>
                <p style="font-size:0.85rem;"><strong>Saldo:</strong> <span style="color:var(--success-600);font-weight:700;">${saldo}</span></p>
            </div>
            <div class="filtro-grupo" style="margin-bottom:12px;">
                <label style="font-size:0.75rem;">Órgão</label>
                <select id="autarquiaConsumo" class="filtro-select" style="padding:6px 10px;" required></select>
            </div>
            <div class="filtro-grupo" style="margin-bottom:12px;">
                <label style="font-size:0.75rem;">Quantidade</label>
                <input type="number" id="quantidadeConsumo" class="filtro-input" style="padding:6px 10px;" min="1" max="${saldo}" placeholder="Quantidade" required>
            </div>
            <div class="filtro-grupo" style="margin-bottom:16px;">
                <label style="font-size:0.75rem;">Observação</label>
                <input type="text" id="obsConsumo" class="filtro-input" style="padding:6px 10px;" placeholder="Opcional">
            </div>
            <div style="display:flex;gap:10px;justify-content:flex-end;">
                <button class="btn" style="background:var(--neutral-200);padding:6px 14px;border:none;border-radius:var(--border-radius-md);font-size:0.85rem;" onclick="sistema.fecharModalConsumo()">Cancelar</button>
                <button class="btn-consumo" style="padding:6px 14px;font-size:0.85rem;" onclick="sistema.gestao.registrarConsumo(${ataId}, ${itemId})"><i class="fas fa-save"></i> Registrar</button>
            </div>
        </div>`;
    document.getElementById("modalConsumo").classList.add("active");
  }

  // ============================================================
  // REGISTRAR CONSUMO - CORRIGIDO PARA USAR TABELA DIRETAMENTE
  // (Fallback caso a Stored Procedure não exista)
  // ============================================================
  async registrarConsumo(ataId, itemId) {
    const quantidade = parseInt(
      document.getElementById("quantidadeConsumo").value,
    );
    const orgaoId = parseInt(document.getElementById("autarquiaConsumo").value);
    const obs = document.getElementById("obsConsumo").value;

    if (!quantidade || quantidade <= 0) {
      this.sistema.ui.mostrarToast("erro", "Quantidade inválida!");
      return;
    }
    if (!orgaoId) {
      this.sistema.ui.mostrarToast("erro", "Selecione um órgão!");
      return;
    }

    try {
      // Buscar o item da ata para obter o saldo atual
      const { data: itemAtual, error: itemError } = await supabase
        .from("itens_ata")
        .select("saldo_quantidade, quantidade_contratada, valor_unitario")
        .eq("id", itemId)
        .single();

      if (itemError) throw itemError;
      if (!itemAtual) {
        this.sistema.ui.mostrarToast("erro", "Item não encontrado!");
        return;
      }

      if (quantidade > (itemAtual.saldo_quantidade || 0)) {
        this.sistema.ui.mostrarToast(
          "erro",
          `Saldo insuficiente! Disponível: ${itemAtual.saldo_quantidade}`,
        );
        return;
      }

      // 1. Registrar o consumo
      const { error: consumoError } = await supabase.from("consumos").insert({
        ata_id: ataId,
        item_ata_id: itemId,
        orgao_solicitante_id: orgaoId,
        usuario_id: this.sistema.usuarioAtual.id,
        quantidade: quantidade,
        valor_unitario: itemAtual.valor_unitario,
        valor_total: itemAtual.valor_unitario * quantidade,
        observacao: obs || null,
        data_consumo: new Date().toISOString().split("T")[0],
        created_at: new Date().toISOString(),
      });

      if (consumoError) throw consumoError;

      // 2. Atualizar o saldo do item
      const novoSaldo = (itemAtual.saldo_quantidade || 0) - quantidade;
      const { error: updateError } = await supabase
        .from("itens_ata")
        .update({
          saldo_quantidade: novoSaldo,
          situacao: novoSaldo <= 0 ? "ESGOTADO" : "DISPONIVEL",
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (updateError) throw updateError;

      this.sistema.ui.mostrarToast("sucesso", "Consumo registrado!");
      this.sistema.fecharModalConsumo();

      // Recarregar dados
      if (this.sistema.ataSelecionada?.id === ataId) {
        await this.sistema.consulta.abrirDetalhes(ataId);
      }
      await this.sistema.consulta.carregarConteudo();

      if (this.sistema.ataSelecionada?.id === ataId) {
        this.atualizarStatsGestao(this.sistema.ataSelecionada);
        this.filtrarItensGestao();
      }
    } catch (error) {
      console.error("Erro ao registrar consumo:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        error.message || "Erro ao registrar consumo.",
      );
    }
  }

  // ============================================================
  // MÉTODO PARA AJUSTAR SALDO MANUALMENTE (ADMIN)
  // ============================================================
  async ajustarSaldo(itemId, novoSaldo) {
    try {
      // Verificar se o usuário é ADMIN
      if (this.sistema.usuarioAtual?.perfil !== "ADMIN") {
        this.sistema.ui.mostrarToast(
          "erro",
          "Apenas administradores podem ajustar saldos.",
        );
        return;
      }

      novoSaldo = this._numero(novoSaldo);
      if (novoSaldo === null || novoSaldo < 0) {
        this.sistema.ui.mostrarToast("erro", "O saldo não pode ser negativo.");
        return;
      }

      const { error } = await supabase
        .from("itens_ata")
        .update({
          saldo_quantidade: novoSaldo,
          situacao: novoSaldo <= 0 ? "ESGOTADO" : "DISPONIVEL",
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;

      this.sistema.ui.mostrarToast(
        "sucesso",
        `Saldo ajustado para ${novoSaldo}!`,
      );

      // Recarregar dados da consulta global para refletir o novo saldo real.
      const itemGlobal = (this._itensGestaoGlobal || []).find((i) => Number(i.id) === Number(itemId));
      if (itemGlobal) { itemGlobal.saldo_quantidade = novoSaldo; itemGlobal.situacao = novoSaldo <= 0 ? "ESGOTADO" : "DISPONIVEL"; }
      this.filtrarGestao();
      if (this.sistema.ataSelecionada) {
        await this.sistema.consulta.abrirDetalhes(
          this.sistema.ataSelecionada.id,
        );
        this.atualizarStatsGestao(this.sistema.ataSelecionada);
        this.filtrarItensGestao();
      }
    } catch (error) {
      console.error("Erro ao ajustar saldo:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        error.message || "Erro ao ajustar saldo.",
      );
    }
  }

  // ============================================================
  // MÉTODO PARA RELATÓRIO DE DIVERGÊNCIA (ADMIN)
  // ============================================================
  async gerarRelatorioDivergencia() {
    try {
      if (this.sistema.usuarioAtual?.perfil !== "ADMIN") {
        this.sistema.ui.mostrarToast(
          "erro",
          "Apenas administradores podem gerar este relatório.",
        );
        return;
      }

      // Buscar todas as atas com itens
      const { data: atas, error: atasError } = await supabase
        .from("atas")
        .select(
          `
          id, 
          numero_ata, 
          itens:itens_ata(
            id, 
            descricao, 
            quantidade_contratada, 
            saldo_quantidade,
            valor_unitario,
            valor_total
          )
        `,
        )
        .not("situacao", "eq", "VENCIDA");

      if (atasError) throw atasError;

      // Buscar todos os consumos
      const { data: consumos, error: consumosError } = await supabase
        .from("consumos")
        .select("item_ata_id, quantidade, valor_total");

      if (consumosError) throw consumosError;

      // Calcular consumo por item
      const consumoPorItem = {};
      consumos?.forEach((c) => {
        if (!consumoPorItem[c.item_ata_id]) {
          consumoPorItem[c.item_ata_id] = { quantidade: 0, valor: 0 };
        }
        consumoPorItem[c.item_ata_id].quantidade += c.quantidade || 0;
        consumoPorItem[c.item_ata_id].valor += c.valor_total || 0;
      });

      // Gerar relatório
      let relatorio = [];
      atas?.forEach((ata) => {
        ata.itens?.forEach((item) => {
          const consumido = consumoPorItem[item.id] || {
            quantidade: 0,
            valor: 0,
          };
          const saldoEsperado =
            (item.quantidade_contratada || 0) - (consumido.quantidade || 0);
          const saldoReal = item.saldo_quantidade || 0;
          const divergencia = saldoReal - saldoEsperado;

          if (divergencia !== 0) {
            relatorio.push({
              ata: ata.numero_ata,
              item: item.descricao,
              contratado: item.quantidade_contratada,
              consumido: consumido.quantidade,
              saldoEsperado: saldoEsperado,
              saldoReal: saldoReal,
              divergencia: divergencia,
              valorUnitario: item.valor_unitario,
              valorConsumido: consumido.valor,
            });
          }
        });
      });

      if (relatorio.length === 0) {
        this.sistema.ui.mostrarToast(
          "sucesso",
          "✅ Nenhuma divergência encontrada!",
        );
        return;
      }

      // Exibir relatório
      let html = `
        <div style="padding: 20px;">
          <h3 style="margin-bottom: 16px;">📊 Relatório de Divergências de Saldo</h3>
          <p style="margin-bottom: 16px; color: var(--neutral-500);">
            Foram encontradas ${relatorio.length} divergência(s) entre o saldo esperado e o saldo real.
          </p>
          <div class="tabela-container">
            <table style="width: 100%; font-size: 0.8rem;">
              <thead>
                <tr style="background: var(--neutral-800); color: white;">
                  <th style="padding: 8px;">Ata</th>
                  <th style="padding: 8px;">Item</th>
                  <th style="padding: 8px; text-align: right;">Contratado</th>
                  <th style="padding: 8px; text-align: right;">Consumido</th>
                  <th style="padding: 8px; text-align: right;">Esperado</th>
                  <th style="padding: 8px; text-align: right;">Real</th>
                  <th style="padding: 8px; text-align: center;">Divergência</th>
                  <th style="padding: 8px; text-align: center;">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${relatorio
                  .map(
                    (r) => `
                  <tr>
                    <td>${r.ata}</td>
                    <td>${r.item}</td>
                    <td style="text-align: right;">${r.contratado}</td>
                    <td style="text-align: right;">${r.consumido}</td>
                    <td style="text-align: right;">${r.saldoEsperado}</td>
                    <td style="text-align: right;">${r.saldoReal}</td>
                    <td style="text-align: center;">
                      <span style="background: ${r.divergencia > 0 ? "var(--success-100)" : "var(--error-100)"}; 
                                   color: ${r.divergencia > 0 ? "var(--success-800)" : "var(--error-800)"}; 
                                   padding: 2px 10px; border-radius: 20px; font-weight: 600;">
                        ${r.divergencia > 0 ? "+" : ""}${r.divergencia}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <button class="btn btn-sm btn-primary" onclick="sistema.gestao.ajustarSaldoManual(${r.itemId}, ${r.saldoEsperado})" 
                              style="padding: 4px 8px; font-size: 0.7rem;">
                        <i class="fas fa-sync"></i> Corrigir
                      </button>
                    </td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div style="margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="btn btn-outline" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
            <button class="btn btn-primary" onclick="sistema.gestao.corrigirTodasDivergencias()">
              <i class="fas fa-magic"></i> Corrigir Todas
            </button>
          </div>
        </div>
      `;

      // Criar modal para exibir o relatório
      const modal = document.createElement("div");
      modal.className = "modal-overlay";
      modal.innerHTML = `
        <div class="modal-container" style="max-width: 950px; max-height: 90vh;">
          <div class="modal-header">
            <h2><i class="fas fa-file-invoice"></i> Relatório de Divergências</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
          </div>
          <div class="modal-body" style="overflow-y: auto;">
            ${html}
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      // Salvar relatório para uso no corrigirTodasDivergencias
      this._relatorioDivergencias = relatorio;
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        error.message || "Erro ao gerar relatório.",
      );
    }
  }

  // ============================================================
  // MÉTODO PARA CORRIGIR TODAS AS DIVERGÊNCIAS (ADMIN)
  // ============================================================
  async corrigirTodasDivergencias() {
    if (this.sistema.usuarioAtual?.perfil !== "ADMIN") {
      this.sistema.ui.mostrarToast(
        "erro",
        "Apenas administradores podem executar esta ação.",
      );
      return;
    }

    const relatorio = this._relatorioDivergencias || [];
    if (relatorio.length === 0) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Nenhuma divergência para corrigir.",
      );
      return;
    }

    const confirmado = await this.sistema.confirmar(
      `Deseja corrigir ${relatorio.length} divergência(s)?\n\nOs saldos serão ajustados para o valor esperado.`,
    );
    if (!confirmado) return;

    try {
      let corrigidos = 0;
      for (const item of relatorio) {
        // Buscar o item_id a partir do relatório
        const { data: itemData } = await supabase
          .from("itens_ata")
          .select("id")
          .eq("descricao", item.item)
          .eq(
            "ata_id",
            (
              await supabase
                .from("atas")
                .select("id")
                .eq("numero_ata", item.ata)
                .single()
            ).data?.id,
          )
          .maybeSingle();

        if (itemData) {
          await this.ajustarSaldo(itemData.id, item.saldoEsperado);
          corrigidos++;
        }
      }

      this.sistema.ui.mostrarToast(
        "sucesso",
        `${corrigidos} divergência(s) corrigidas!`,
      );

      // Fechar modal do relatório
      document.querySelector(".modal-overlay")?.remove();

      // Recarregar dados
      if (this.sistema.ataSelecionada) {
        await this.sistema.consulta.abrirDetalhes(
          this.sistema.ataSelecionada.id,
        );
        this.atualizarStatsGestao(this.sistema.ataSelecionada);
        this.filtrarItensGestao();
      }
      await this.sistema.consulta.carregarConteudo();
    } catch (error) {
      console.error("Erro ao corrigir divergências:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        error.message || "Erro ao corrigir divergências.",
      );
    }
  }

  // ============================================================
  // MÉTODO PARA AJUSTAR SALDO MANUAL (Wrapper)
  // ============================================================
  async ajustarSaldoManual(itemId, novoSaldo) {
    await this.ajustarSaldo(itemId, novoSaldo);
  }

  // ============================================================
  // MÉTODOS AUXILIARES PARA O DASHBOARD
  // ============================================================

  /**
   * Busca itens com saldo crítico para o Dashboard
   * @param {number} limite - Percentual limite para considerar crítico (default 10%)
   * @returns {Array} Lista de itens com saldo crítico
   */
  async getItensCriticos(limite = 10) {
    try {
      const percentualLimite = limite / 100;

      // Buscar itens de atas ativas
      const { data: atas, error: atasError } = await supabase
        .from("atas")
        .select("id")
        .in("situacao", ["ATIVA", "PROXIMA"]);

      if (atasError) throw atasError;

      if (!atas || atas.length === 0) {
        return [];
      }

      const atasIds = atas.map((a) => a.id);

      const { data: itens, error: itensError } = await supabase
        .from("itens_ata")
        .select(
          `
          id,
          descricao,
          item_numero,
          saldo_quantidade,
          quantidade_contratada,
          valor_unitario,
          valor_total,
          ata_id,
          atas!inner (
            numero_ata,
            fornecedor_id,
            fornecedores!inner (
              razao_social
            )
          )
        `,
        )
        .in("ata_id", atasIds)
        .gt("saldo_quantidade", 0);

      if (itensError) throw itensError;

      if (!itens) return [];

      // Filtrar itens com saldo crítico
      const itensCriticos = itens.filter((i) => {
        const saldo = i.saldo_quantidade || 0;
        const contratado = i.quantidade_contratada || 0;
        return contratado > 0 && saldo / contratado < percentualLimite;
      });

      return itensCriticos.map((i) => ({
        id: i.id,
        item_numero: i.item_numero,
        descricao: i.descricao,
        saldo: i.saldo_quantidade || 0,
        contratado: i.quantidade_contratada || 0,
        percentual: (
          ((i.saldo_quantidade || 0) / (i.quantidade_contratada || 1)) *
          100
        ).toFixed(1),
        valor_unitario: i.valor_unitario || 0,
        ata: i.atas?.numero_ata || "N/I",
        fornecedor: i.atas?.fornecedores?.razao_social || "N/I",
      }));
    } catch (error) {
      console.error("Erro ao buscar itens críticos:", error);
      return [];
    }
  }

  /**
   * Busca total de alertas para o Dashboard
   * @returns {Object} Dados de alertas (críticos, vencimentos, etc)
   */
  async getAlertasDashboard() {
    try {
      // 1. Itens com saldo crítico (< 10%)
      const itensCriticos = await this.getItensCriticos(10);

      // 2. Atas com vencimento nos próximos 15 dias
      const hoje = new Date();
      const quinzeDias = new Date();
      quinzeDias.setDate(quinzeDias.getDate() + 15);

      const { data: atasVencendo, error: vencError } = await supabase
        .from("atas")
        .select("id, numero_ata, data_fim_vigencia")
        .gte("data_fim_vigencia", hoje.toISOString().split("T")[0])
        .lte("data_fim_vigencia", quinzeDias.toISOString().split("T")[0])
        .in("situacao", ["ATIVA", "PROXIMA"]);

      if (vencError) throw vencError;

      // 3. Pedidos pendentes há mais de 7 dias
      const seteDias = new Date();
      seteDias.setDate(seteDias.getDate() - 7);

      const { data: pedidosAntigos, error: pedError } = await supabase
        .from("pedidos")
        .select("id, numero_pedido, created_at")
        .eq("status_aprovacao", "AGUARDANDO_APROVACAO")
        .lt("created_at", seteDias.toISOString());

      if (pedError) throw pedError;

      return {
        itensCriticos: itensCriticos.length,
        itensCriticosLista: itensCriticos.slice(0, 5),
        atasVencendo: atasVencendo?.length || 0,
        atasVencendoLista: (atasVencendo || []).slice(0, 5),
        pedidosAntigos: pedidosAntigos?.length || 0,
        totalAlertas:
          (itensCriticos.length || 0) +
          (atasVencendo?.length || 0) +
          (pedidosAntigos?.length || 0),
      };
    } catch (error) {
      console.error("Erro ao buscar alertas:", error);
      return {
        itensCriticos: 0,
        itensCriticosLista: [],
        atasVencendo: 0,
        atasVencendoLista: [],
        pedidosAntigos: 0,
        totalAlertas: 0,
      };
    }
  }
}
