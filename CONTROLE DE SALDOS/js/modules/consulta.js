import { supabase } from "../supabase.js";

export class Consulta {
  constructor(sistema) {
    this.sistema = sistema;
    this.fornecedoresCache = [];
    this.filtrosAtivos = {
      fornecedor: null,
      vencimento: "todos",
      valorMin: null,
      valorMax: null,
      saldo: [],
      ordenacao: "vencimento_asc",
    };
    // Cache para evitar múltiplas requisições
    this._atasCache = [];
    this._ultimaBusca = null;
  }

  // ============================================================
  // CARREGAR CONTEÚDO DA CONSULTA
  // ============================================================
  async carregarConteudo() {
    const container = document.getElementById("consultaContent");
    if (!container) return;

    this.sistema.ui.mostrarSpinner("consultaContent", "Carregando atas...");
    const html = await this.gerarHTMLConsultas();
    container.innerHTML = html;
    await this.carregarFiltros();
    this.configurarEventos();

    // ============================================================
    // NOVO · Aplica filtro vindo do dashboard (drill-down)
    // Se não houver filtro, apenas segue o fluxo normal
    // ============================================================
    this.aplicarFiltroExterno();

    await this.filtrarAtas();
  }

  // ============================================================
  // NOVO · APLICAR FILTRO EXTERNO (drill-down do dashboard)
  // ------------------------------------------------------------
  // O dashboard salva em sessionStorage um objeto:
  //   { status, categoria, fornecedor, tipo }
  // e navega para cá. Este método lê, aplica nos campos e limpa.
  // ============================================================
  aplicarFiltroExterno() {
    let bruto = null;
    try {
      bruto = sessionStorage.getItem("consulta_filtro_externo");
      if (!bruto) return;
      sessionStorage.removeItem("consulta_filtro_externo");
    } catch (e) {
      console.warn("Erro ao ler filtro externo:", e);
      return;
    }

    let filtro = null;
    try {
      filtro = JSON.parse(bruto);
    } catch (e) {
      console.warn("Filtro externo inválido:", bruto);
      return;
    }

    if (!filtro || typeof filtro !== "object") return;

    // ---------- Status ----------
    if (filtro.status) {
      const el = document.getElementById("filtroStatus");
      if (el) {
        // Só aplica se o valor existir no select
        const opcaoExiste = Array.from(el.options).some(
          (o) => o.value === filtro.status,
        );
        if (opcaoExiste) el.value = filtro.status;
      }
    }

    // ---------- Categoria (usa o campo de busca) ----------
    if (filtro.categoria) {
      const el = document.getElementById("buscaInput");
      if (el) el.value = filtro.categoria;
    }

    // ---------- Fornecedor (id) ----------
    if (filtro.fornecedor) {
      const hiddenId = document.getElementById("fornecedorId");
      const inputNome = document.getElementById("fornecedorInput");
      if (hiddenId) hiddenId.value = String(filtro.fornecedor);

      // Se já temos o cache de fornecedores, preenche o nome visível
      if (inputNome && this.fornecedoresCache?.length) {
        const f = this.fornecedoresCache.find(
          (x) => x.id === parseInt(filtro.fornecedor),
        );
        if (f) inputNome.value = f.razao_social;
      }
    }

    // ---------- Tipo especial: "críticos" (saldo baixo) ----------
    if (filtro.tipo === "criticos") {
      const cb = document.getElementById("saldoBaixo");
      if (cb) cb.checked = true;
    }

    // Feedback visual ao usuário
    const algumFiltroAplicado =
      filtro.status || filtro.categoria || filtro.fornecedor || filtro.tipo;

    if (algumFiltroAplicado) {
      setTimeout(() => {
        this.sistema.ui.mostrarToast(
          "info",
          "Filtro aplicado",
          "A consulta foi ajustada com base no dashboard.",
          3000,
        );
      }, 400);
    }
  }

  // ============================================================
  // GERAR HTML DA CONSULTA - RESUMO COMPACTADO
  // ============================================================
  async gerarHTMLConsultas() {
    return `
      <div class="filtros-container">
        <!-- ============================================================ -->
        <!-- RESULTADOS RÁPIDOS - COMPACTADO                              -->
        <!-- ============================================================ -->
        <div class="resumo-rapido" id="resumoRapido">
          <div class="resumo-card">
            <span class="resumo-numero" id="totalAtas">0</span>
            <span class="resumo-label">Total</span>
          </div>
          <div class="resumo-card resumo-vencimento-30">
            <span class="resumo-numero" id="vencimento30">0</span>
            <span class="resumo-label">30 dias</span>
          </div>
          <div class="resumo-card resumo-vencimento-60">
            <span class="resumo-numero" id="vencimento60">0</span>
            <span class="resumo-label">60 dias</span>
          </div>
          <div class="resumo-card resumo-vencimento-90">
            <span class="resumo-numero" id="vencimento90">0</span>
            <span class="resumo-label">90 dias</span>
          </div>
          <div class="resumo-card resumo-alertas">
            <span class="resumo-numero" id="totalAlertas">0</span>
            <span class="resumo-label">Alertas</span>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- FILTROS                                                        -->
        <!-- ============================================================ -->
        <div class="filtros-grid">
          <div class="filtro-grupo">
            <label class="filtro-label"><i class="fas fa-search"></i> Buscar</label>
            <input type="text" id="buscaInput" class="filtro-input" placeholder="Buscar por descrição...">
          </div>
          <div class="filtro-grupo">
            <label class="filtro-label"><i class="fas fa-building"></i> Fornecedor</label>
            <div class="autocomplete-container" id="autocompleteContainer">
              <input type="text" id="fornecedorInput" class="filtro-input autocomplete-input" 
                     placeholder="Digite o nome ou CNPJ..." autocomplete="off">
              <input type="hidden" id="fornecedorId" value="">
              <div class="autocomplete-dropdown" id="autocompleteDropdown"></div>
            </div>
          </div>
          <div class="filtro-grupo">
            <label class="filtro-label"><i class="fas fa-university"></i> Órgão</label>
            <select id="filtroOrgao" class="filtro-select">
              <option value="todos">Todos</option>
            </select>
          </div>
          <div class="filtro-grupo">
            <label class="filtro-label"><i class="fas fa-tag"></i> Status</label>
            <select id="filtroStatus" class="filtro-select">
              <option value="todos">Todos</option>
              <option value="ATIVA">Ativa</option>
              <option value="PROXIMA">Próxima</option>
              <option value="VENCIDA">Vencida</option>
            </select>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- FILTROS AVANÇADOS - COMPACTADO                               -->
        <!-- ============================================================ -->
        <div class="filtros-avancados">
          <div class="filtros-avancados-row">
            <div class="filtro-grupo filtro-vencimento">
              <label class="filtro-label"><i class="fas fa-clock"></i> Vencimento</label>
              <select id="filtroVencimento" class="filtro-select">
                <option value="todos">Todos</option>
                <option value="30">Últimos 30 dias</option>
                <option value="60">Últimos 60 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="vencido">Já vencidos</option>
              </select>
            </div>
            <div class="filtro-grupo filtro-valor">
              <label class="filtro-label"><i class="fas fa-coins"></i> Valor</label>
              <div class="filtro-valor-inputs">
                <input type="number" id="valorMin" class="filtro-input" placeholder="R$ 0,00" min="0" step="0.01">
                <span class="filtro-valor-separador">até</span>
                <input type="number" id="valorMax" class="filtro-input" placeholder="R$ 1.000.000" min="0" step="0.01">
              </div>
            </div>
            <div class="filtro-grupo filtro-ordenacao">
              <label class="filtro-label"><i class="fas fa-sort"></i> Ordenar por</label>
              <select id="filtroOrdenacao" class="filtro-select">
                <option value="vencimento_asc">Vencimento (mais próximo)</option>
                <option value="vencimento_desc">Vencimento (mais distante)</option>
                <option value="valor_desc">Maior valor</option>
                <option value="valor_asc">Menor valor</option>
                <option value="nome_asc">Nome da ata</option>
              </select>
            </div>
          </div>
          <div class="filtros-avancados-row">
            <div class="filtro-grupo filtro-saldo">
              <label class="filtro-label"><i class="fas fa-wallet"></i> Saldo</label>
              <div class="filtro-saldo-checkboxes">
                <label class="checkbox-label">
                  <input type="checkbox" id="saldoDisponivel" value="disponivel">
                  <span>Com saldo</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="saldoBaixo" value="baixo">
                  <span>Saldo baixo (&lt; 10%)</span>
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" id="saldoZerado" value="zerado">
                  <span>Saldo zerado</span>
                </label>
              </div>
            </div>
            <div class="filtro-grupo filtro-actions">
              <button class="btn-aplicar" id="btnAplicarFiltros"><i class="fas fa-filter"></i> Aplicar</button>
              <button class="btn-limpar" id="btnLimparFiltros"><i class="fas fa-eraser"></i> Limpar</button>
              <button class="btn-exportar" id="btnExportarResultados"><i class="fas fa-download"></i> Exportar</button>
            </div>
          </div>
        </div>
      </div>
      <div id="atasLista" class="atas-grid"></div>
    `;
  }

  // ============================================================
  // CARREGAR FILTROS (Fornecedores + Órgãos)
  // ============================================================
  async carregarFiltros() {
    // Carregar fornecedores para autocomplete
    const { data: fornecedores } = await supabase
      .from("fornecedores")
      .select("id, razao_social, cnpj")
      .order("razao_social");
    this.fornecedoresCache = fornecedores || [];

    // Carregar órgãos
    await this.sistema.ui.carregarSelectOrgaos("filtroOrgao");

    // Configurar autocomplete
    this.configurarAutocomplete();

    // Configurar evento de limpeza do campo de fornecedor
    this.configurarLimpezaFornecedor();
  }

  // ============================================================
  // CONFIGURAR AUTOCOMPLETE
  // ============================================================
  configurarAutocomplete() {
    const input = document.getElementById("fornecedorInput");
    const dropdown = document.getElementById("autocompleteDropdown");
    const hiddenId = document.getElementById("fornecedorId");

    if (!input || !dropdown) return;

    let debounceTimer;

    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const value = e.target.value.toLowerCase().trim();

      if (value.length === 0) {
        dropdown.classList.remove("open");
        hiddenId.value = "";
        // Disparar filtro ao limpar o campo
        this.debounceFiltrarAtas();
        return;
      }

      debounceTimer = setTimeout(() => {
        const resultados = this.fornecedoresCache
          .filter(
            (f) =>
              f.razao_social.toLowerCase().includes(value) ||
              (f.cnpj &&
                f.cnpj.replace(/\D/g, "").includes(value.replace(/\D/g, ""))),
          )
          .slice(0, 10);

        if (resultados.length === 0) {
          dropdown.innerHTML = `<div class="autocomplete-item disabled">Nenhum fornecedor encontrado</div>`;
        } else {
          dropdown.innerHTML = resultados
            .map(
              (f) => `
            <div class="autocomplete-item" data-id="${f.id}" data-razao="${f.razao_social}" data-cnpj="${f.cnpj || ""}">
              <span class="item-razao">${f.razao_social}</span>
              ${f.cnpj ? `<span class="item-cnpj">${this.formatarCnpj(f.cnpj)}</span>` : ""}
            </div>
          `,
            )
            .join("");

          dropdown
            .querySelectorAll(".autocomplete-item:not(.disabled)")
            .forEach((item) => {
              item.addEventListener("click", () => {
                input.value = item.dataset.razao;
                hiddenId.value = item.dataset.id;
                dropdown.classList.remove("open");
                this.filtrarAtas();
              });
            });
        }
        dropdown.classList.add("open");
      }, 300);
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".autocomplete-container")) {
        dropdown.classList.remove("open");
      }
    });

    // Fechar dropdown com ESC
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.classList.remove("open");
        input.blur();
      }
      // Enter para confirmar seleção
      if (e.key === "Enter" && dropdown.classList.contains("open")) {
        const firstItem = dropdown.querySelector(
          ".autocomplete-item:not(.disabled)",
        );
        if (firstItem) {
          firstItem.click();
        }
      }
    });

    // Navegação por teclado (setas)
    input.addEventListener("keydown", (e) => {
      if (!dropdown.classList.contains("open")) return;

      const items = dropdown.querySelectorAll(
        ".autocomplete-item:not(.disabled)",
      );
      if (items.length === 0) return;

      let currentIndex = -1;
      items.forEach((item, index) => {
        if (item.classList.contains("active")) {
          currentIndex = index;
          item.classList.remove("active");
        }
      });

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex].classList.add("active");
        items[nextIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length) % items.length;
        items[prevIndex].classList.add("active");
        items[prevIndex].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        const activeItem = dropdown.querySelector(".autocomplete-item.active");
        if (activeItem) {
          activeItem.click();
        }
      }
    });
  }

  // ============================================================
  // CONFIGURAR LIMPEZA DO CAMPO DE FORNECEDOR
  // ============================================================
  configurarLimpezaFornecedor() {
    const input = document.getElementById("fornecedorInput");
    const hiddenId = document.getElementById("fornecedorId");

    if (!input) return;

    // Ao perder o foco, se o campo estiver vazio, limpar o ID
    input.addEventListener("blur", () => {
      setTimeout(() => {
        if (input.value.trim() === "") {
          hiddenId.value = "";
        }
      }, 200);
    });
  }

  // ============================================================
  // FORMATAR CNPJ
  // ============================================================
  formatarCnpj(cnpj) {
    if (!cnpj) return "";
    const limpo = cnpj.replace(/\D/g, "");
    if (limpo.length !== 14) return cnpj;
    return limpo.replace(
      /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5",
    );
  }

  // ============================================================
  // CONFIGURAR EVENTOS
  // ============================================================
  configurarEventos() {
    // Eventos existentes
    const buscaInput = document.getElementById("buscaInput");
    if (buscaInput) {
      buscaInput.addEventListener("keyup", () => this.debounceFiltrarAtas());
    }

    const filtroOrgao = document.getElementById("filtroOrgao");
    if (filtroOrgao) {
      filtroOrgao.addEventListener("change", () => this.debounceFiltrarAtas());
    }

    const filtroStatus = document.getElementById("filtroStatus");
    if (filtroStatus) {
      filtroStatus.addEventListener("change", () => this.debounceFiltrarAtas());
    }

    // Novos eventos
    const filtroVencimento = document.getElementById("filtroVencimento");
    if (filtroVencimento) {
      filtroVencimento.addEventListener("change", () =>
        this.debounceFiltrarAtas(),
      );
    }

    const filtroOrdenacao = document.getElementById("filtroOrdenacao");
    if (filtroOrdenacao) {
      filtroOrdenacao.addEventListener("change", () =>
        this.debounceFiltrarAtas(),
      );
    }

    const valorMin = document.getElementById("valorMin");
    if (valorMin) {
      valorMin.addEventListener("input", () => this.debounceFiltrarAtas());
    }

    const valorMax = document.getElementById("valorMax");
    if (valorMax) {
      valorMax.addEventListener("input", () => this.debounceFiltrarAtas());
    }

    const btnAplicar = document.getElementById("btnAplicarFiltros");
    if (btnAplicar) {
      btnAplicar.addEventListener("click", () => this.filtrarAtas());
    }

    const btnLimpar = document.getElementById("btnLimparFiltros");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => this.limparFiltros());
    }

    const btnExportar = document.getElementById("btnExportarResultados");
    if (btnExportar) {
      btnExportar.addEventListener("click", () => this.exportarResultados());
    }

    // Filtros de saldo
    document
      .querySelectorAll('.filtro-saldo-checkboxes input[type="checkbox"]')
      .forEach((cb) => {
        cb.addEventListener("change", () => this.debounceFiltrarAtas());
      });
  }

  // ============================================================
  // DEBOUNCE PARA FILTRAR ATAS
  // ============================================================
  debounceFiltrarAtas() {
    clearTimeout(this.sistema.filtroTimer);
    this.sistema.filtroTimer = setTimeout(() => this.filtrarAtas(), 400);
  }

  // ============================================================
  // FILTRAR ATAS - PRINCIPAL
  // ============================================================
  async filtrarAtas() {
    const container = document.getElementById("atasLista");
    if (!container) return;

    container.innerHTML =
      '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Carregando atas...</div>';

    let query = supabase
      .from("atas")
      .select(
        "*, fornecedor:fornecedores(razao_social,cnpj), itens:itens_ata(*), categoria:categorias(id,nome)",
      );

    // Filtro de status
    const statusFiltro = document.getElementById("filtroStatus")?.value;
    if (statusFiltro && statusFiltro !== "todos") {
      query = query.eq("situacao", statusFiltro);
    } else {
      query = query.not("situacao", "eq", "VENCIDA");
    }

    const { data: atas } = await query.order("data_inicio_vigencia", {
      ascending: false,
    });

    let atasFiltradas = atas || [];
    this._atasCache = atasFiltradas;

    // ============================================================
    // FILTRO DE FORNECEDOR VIA AUTOCOMPLETE (ID)
    // ============================================================
    const fornecedorId = document.getElementById("fornecedorId")?.value;
    if (fornecedorId) {
      atasFiltradas = atasFiltradas.filter(
        (a) => a.fornecedor_id === parseInt(fornecedorId),
      );
    }

    // Filtro de órgão
    const orgaoFiltro = document.getElementById("filtroOrgao")?.value;
    if (orgaoFiltro && orgaoFiltro !== "todos") {
      // Filtrar atas pelo órgão do fornecedor ou pela relação com o órgão
      // Como não há relação direta, mantemos o filtro apenas visual
      // Para implementar corretamente, seria necessário uma relação entre ata e órgão
      // ou filtrar pelo órgão do fornecedor
      console.log("Filtro por órgão:", orgaoFiltro);
    }

    // Filtro de busca (por descrição dos itens, número, objeto, fornecedor, categoria)
    const busca = document.getElementById("buscaInput")?.value?.toLowerCase();
    if (busca) {
      atasFiltradas = atasFiltradas.filter(
        (a) =>
          a.itens?.some((i) => i.descricao?.toLowerCase().includes(busca)) ||
          a.itens?.some((i) => i.categoria?.toLowerCase().includes(busca)) ||
          a.numero_ata?.toLowerCase().includes(busca) ||
          a.objeto?.toLowerCase().includes(busca) ||
          a.fornecedor?.razao_social?.toLowerCase().includes(busca) ||
          a.categoria?.nome?.toLowerCase().includes(busca),
      );
    }

    // ============================================================
    // NOVOS FILTROS
    // ============================================================

    // 1. Filtro de vencimento
    const vencimentoFiltro = document.getElementById("filtroVencimento")?.value;
    const hoje = new Date();
    if (vencimentoFiltro && vencimentoFiltro !== "todos") {
      const dias = parseInt(vencimentoFiltro);
      if (isNaN(dias)) {
        // "vencido" - já vencidos
        atasFiltradas = atasFiltradas.filter((a) => {
          if (!a.data_fim_vigencia) return false;
          const fim = new Date(a.data_fim_vigencia);
          return fim < hoje;
        });
      } else {
        // Últimos X dias
        const limite = new Date();
        limite.setDate(limite.getDate() + dias);
        atasFiltradas = atasFiltradas.filter((a) => {
          if (!a.data_fim_vigencia) return false;
          const fim = new Date(a.data_fim_vigencia);
          return fim >= hoje && fim <= limite;
        });
      }
    }

    // 2. Filtro de valor
    const valorMin = parseFloat(document.getElementById("valorMin")?.value);
    const valorMax = parseFloat(document.getElementById("valorMax")?.value);
    if (!isNaN(valorMin) && valorMin > 0) {
      atasFiltradas = atasFiltradas.filter(
        (a) => (a.valor_global || 0) >= valorMin,
      );
    }
    if (!isNaN(valorMax) && valorMax > 0) {
      atasFiltradas = atasFiltradas.filter(
        (a) => (a.valor_global || 0) <= valorMax,
      );
    }

    // 3. Filtro de saldo
    const saldoFilters = {
      disponivel: document.getElementById("saldoDisponivel")?.checked || false,
      baixo: document.getElementById("saldoBaixo")?.checked || false,
      zerado: document.getElementById("saldoZerado")?.checked || false,
    };

    if (saldoFilters.disponivel || saldoFilters.baixo || saldoFilters.zerado) {
      atasFiltradas = atasFiltradas.filter((a) => {
        const itens = a.itens || [];
        const valorContratado = itens.reduce(
          (s, i) => s + (i.valor_total || 0),
          0,
        );
        const valorConsumido = itens.reduce((s, i) => {
          const consumido =
            (i.quantidade_contratada || 0) - (i.saldo_quantidade || 0);
          return s + consumido * (i.valor_unitario || 0);
        }, 0);
        const saldoTotal = valorContratado - valorConsumido;
        const percentual =
          valorContratado > 0 ? (saldoTotal / valorContratado) * 100 : 0;

        let match = false;
        if (saldoFilters.disponivel && saldoTotal > 0) match = true;
        if (saldoFilters.baixo && saldoTotal > 0 && percentual < 10)
          match = true;
        if (saldoFilters.zerado && saldoTotal <= 0) match = true;
        return match;
      });
    }

    // ============================================================
    // ORDENAÇÃO
    // ============================================================
    const ordenacao =
      document.getElementById("filtroOrdenacao")?.value || "vencimento_asc";
    atasFiltradas = this.ordenarAtas(atasFiltradas, ordenacao);

    if (!atasFiltradas.length) {
      container.innerHTML =
        '<div style="text-align:center;padding:30px;color:var(--neutral-500);">' +
        '<i class="fas fa-inbox" style="font-size:2rem;display:block;margin-bottom:12px;"></i>' +
        "Nenhuma ata encontrada com os filtros aplicados</div>";
      this.atualizarResumoRapido([]);
      return;
    }

    // Atualizar resumo rápido
    this.atualizarResumoRapido(atasFiltradas);

    // Renderizar cards
    container.innerHTML = atasFiltradas
      .map((a) => this.renderCardAta(a))
      .join("");
  }

  // ============================================================
  // ORDENAR ATAS
  // ============================================================
  ordenarAtas(atas, criterio) {
    const copia = [...atas];

    switch (criterio) {
      case "vencimento_asc":
        return copia.sort((a, b) => {
          const da = a.data_fim_vigencia
            ? new Date(a.data_fim_vigencia)
            : new Date(8640000000000000);
          const db = b.data_fim_vigencia
            ? new Date(b.data_fim_vigencia)
            : new Date(8640000000000000);
          return da - db;
        });
      case "vencimento_desc":
        return copia.sort((a, b) => {
          const da = a.data_fim_vigencia
            ? new Date(a.data_fim_vigencia)
            : new Date(0);
          const db = b.data_fim_vigencia
            ? new Date(b.data_fim_vigencia)
            : new Date(0);
          return db - da;
        });
      case "valor_desc":
        return copia.sort(
          (a, b) => (b.valor_global || 0) - (a.valor_global || 0),
        );
      case "valor_asc":
        return copia.sort(
          (a, b) => (a.valor_global || 0) - (b.valor_global || 0),
        );
      case "nome_asc":
        return copia.sort((a, b) =>
          (a.numero_ata || "").localeCompare(b.numero_ata || ""),
        );
      default:
        return copia;
    }
  }

  // ============================================================
  // ATUALIZAR RESUMO RÁPIDO
  // ============================================================
  atualizarResumoRapido(atas) {
    const hoje = new Date();
    const total = atas.length;

    let venc30 = 0,
      venc60 = 0,
      venc90 = 0;

    atas.forEach((a) => {
      if (!a.data_fim_vigencia) return;
      const dias = Math.ceil(
        (new Date(a.data_fim_vigencia) - hoje) / (1000 * 60 * 60 * 24),
      );
      if (dias >= 0 && dias <= 30) venc30++;
      else if (dias > 30 && dias <= 60) venc60++;
      else if (dias > 60 && dias <= 90) venc90++;
    });

    const alertas = venc30 + venc60;

    const totalEl = document.getElementById("totalAtas");
    if (totalEl) totalEl.textContent = total;

    const venc30El = document.getElementById("vencimento30");
    if (venc30El) venc30El.textContent = venc30;

    const venc60El = document.getElementById("vencimento60");
    if (venc60El) venc60El.textContent = venc60;

    const venc90El = document.getElementById("vencimento90");
    if (venc90El) venc90El.textContent = venc90;

    const alertasEl = document.getElementById("totalAlertas");
    if (alertasEl) alertasEl.textContent = alertas;
  }

  // ============================================================
  // RENDERIZAR CARD DA ATA
  // ============================================================
  renderCardAta(ata) {
    const statusClass =
      {
        ATIVA: "status-ativa",
        PROXIMA: "status-proxima",
        VENCIDA: "status-vencida",
      }[ata.situacao] || "status-ativa";
    const categoriaNome = ata.categoria?.nome || "Outros";

    // Calcular valor consumido para exibição
    const itens = ata.itens || [];
    const valorTotal = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
    const valorConsumido = itens.reduce((s, i) => {
      const consumido =
        (i.quantidade_contratada || 0) - (i.saldo_quantidade || 0);
      return s + consumido * (i.valor_unitario || 0);
    }, 0);
    const saldoAta = valorTotal - valorConsumido;

    // ============================================================
    // BADGE DE VENCIMENTO
    // ============================================================
    const hoje = new Date();
    let diasRestantes = null;
    let badgeVencimento = "";
    if (ata.data_fim_vigencia) {
      const fim = new Date(ata.data_fim_vigencia);
      diasRestantes = Math.ceil((fim - hoje) / (1000 * 60 * 60 * 24));

      if (diasRestantes < 0) {
        badgeVencimento = `<span class="badge-vencimento vermelho"><i class="fas fa-exclamation-circle"></i> Vencida há ${Math.abs(diasRestantes)} dias</span>`;
      } else if (diasRestantes <= 15) {
        badgeVencimento = `<span class="badge-vencimento vermelho"><i class="fas fa-exclamation-triangle"></i> Vence em ${diasRestantes} dias</span>`;
      } else if (diasRestantes <= 30) {
        badgeVencimento = `<span class="badge-vencimento laranja"><i class="fas fa-clock"></i> Vence em ${diasRestantes} dias</span>`;
      } else if (diasRestantes <= 60) {
        badgeVencimento = `<span class="badge-vencimento amarelo"><i class="fas fa-clock"></i> Vence em ${diasRestantes} dias</span>`;
      } else if (diasRestantes <= 90) {
        badgeVencimento = `<span class="badge-vencimento verde"><i class="fas fa-hourglass-half"></i> Vence em ${diasRestantes} dias</span>`;
      } else {
        badgeVencimento = `<span class="badge-vencimento verde-claro"><i class="fas fa-hourglass-start"></i> Vence em ${diasRestantes} dias</span>`;
      }
    }

    // Número do pregão
    const numeroPregao = ata.numero_pregao || ata.pregao_numero || "";
    const pregaoDisplay = numeroPregao ? `Pregão: ${numeroPregao}` : "";

    return `
      <div class="ata-card" onclick="sistema.consulta.abrirDetalhes(${ata.id})">
        <div class="ata-header">
          <div class="ata-status">
            <span class="status-badge ${statusClass}">${ata.situacao || "ATIVA"}</span>
            ${badgeVencimento}
            <span style="font-size:0.75rem; margin-left: auto;"><i class="fas fa-box"></i> ${itens.length}</span>
          </div>
          <div class="ata-numero">Ata nº ${ata.numero_ata || ""}</div>
          ${
            pregaoDisplay
              ? `<div style="font-size:0.8rem; color: var(--primary-600); font-weight: 500;">
                  <i class="fas fa-gavel"></i> ${pregaoDisplay}
                </div>`
              : ""
          }
          <div class="ata-fornecedor">
            <i class="fas fa-building"></i> ${ata.fornecedor?.razao_social || "N/I"}
            ${ata.fornecedor?.cnpj ? ` <span style="font-size:0.7rem;color:var(--neutral-400);">(${this.formatarCnpj(ata.fornecedor.cnpj)})</span>` : ""}
          </div>
          <div style="font-size:0.8rem"><i class="fas fa-tag"></i> ${categoriaNome}</div>
          <div style="font-size:0.8rem">
            <i class="fas fa-calendar"></i> ${this.sistema.ui.formatarData(ata.data_inicio_vigencia)} 
            ${ata.data_fim_vigencia ? `até ${this.sistema.ui.formatarData(ata.data_fim_vigencia)}` : ""}
          </div>
          <div style="font-size:0.75rem; color: var(--neutral-500); margin-top: 4px;">
            <span>Saldo: <strong>${this.sistema.ui.formatarMoeda(saldoAta)}</strong></span>
            <span style="margin-left: 12px;">Consumido: <strong>${this.sistema.ui.formatarMoeda(valorConsumido)}</strong></span>
          </div>
        </div>
        <div class="ata-footer">
          <span style="font-weight:600;font-size:0.9rem">${this.sistema.ui.formatarMoeda(ata.valor_global || 0)}</span>
          <button class="btn-visualizar" onclick="event.stopPropagation(); sistema.consulta.abrirDetalhes(${ata.id})">
            <i class="fas fa-eye"></i> Ver Itens
          </button>
        </div>
      </div>
    `;
  }

  // ============================================================
  // LIMPAR FILTROS
  // ============================================================
  limparFiltros() {
    const buscaInput = document.getElementById("buscaInput");
    if (buscaInput) buscaInput.value = "";

    const fornecedorInput = document.getElementById("fornecedorInput");
    if (fornecedorInput) fornecedorInput.value = "";

    const fornecedorId = document.getElementById("fornecedorId");
    if (fornecedorId) fornecedorId.value = "";

    const filtroOrgao = document.getElementById("filtroOrgao");
    if (filtroOrgao) filtroOrgao.value = "todos";

    const filtroStatus = document.getElementById("filtroStatus");
    if (filtroStatus) filtroStatus.value = "todos";

    const filtroVencimento = document.getElementById("filtroVencimento");
    if (filtroVencimento) filtroVencimento.value = "todos";

    const filtroOrdenacao = document.getElementById("filtroOrdenacao");
    if (filtroOrdenacao) filtroOrdenacao.value = "vencimento_asc";

    const valorMin = document.getElementById("valorMin");
    if (valorMin) valorMin.value = "";

    const valorMax = document.getElementById("valorMax");
    if (valorMax) valorMax.value = "";

    document
      .querySelectorAll('.filtro-saldo-checkboxes input[type="checkbox"]')
      .forEach((cb) => (cb.checked = false));

    const dropdown = document.getElementById("autocompleteDropdown");
    if (dropdown) dropdown.classList.remove("open");

    this.filtrarAtas();
  }

  // ============================================================
  // EXPORTAR RESULTADOS
  // ============================================================
  async exportarResultados() {
    const atas = await this.obterAtasFiltradas();

    if (!atas || atas.length === 0) {
      this.sistema.ui.mostrarToast("aviso", "Nenhuma ata para exportar.");
      return;
    }

    const cabecalho = [
      "Nº Ata",
      "Fornecedor",
      "CNPJ",
      "Processo",
      "Objeto",
      "Vigência Início",
      "Vigência Fim",
      "Valor Global",
      "Saldo",
      "Situação",
      "Categoria",
    ];

    const linhas = atas.map((a) => {
      const itens = a.itens || [];
      const valorTotal = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
      const valorConsumido = itens.reduce((s, i) => {
        const consumido =
          (i.quantidade_contratada || 0) - (i.saldo_quantidade || 0);
        return s + consumido * (i.valor_unitario || 0);
      }, 0);
      const saldoAta = valorTotal - valorConsumido;

      return [
        a.numero_ata || "",
        a.fornecedor?.razao_social || "",
        a.fornecedor?.cnpj || "",
        a.processo_administrativo || "",
        a.objeto || "",
        a.data_inicio_vigencia || "",
        a.data_fim_vigencia || "",
        valorTotal,
        saldoAta,
        a.situacao || "",
        a.categoria?.nome || "",
      ];
    });

    // Criar CSV com cabeçalho
    const csvContent = [
      cabecalho.join(","),
      ...linhas.map((l) => l.join(",")),
    ].join("\n");

    // Adicionar BOM para UTF-8
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `atas_${new Date().toISOString().split("T")[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.sistema.ui.mostrarToast("sucesso", "Lista exportada com sucesso!");
  }

  // ============================================================
  // OBTER ATAS FILTRADAS (PARA EXPORTAÇÃO)
  // ============================================================
  async obterAtasFiltradas() {
    // Usar cache se disponível e se os filtros não mudaram
    if (this._atasCache.length > 0 && this._ultimaBusca === Date.now()) {
      return this._atasCache;
    }

    // Re-executar a consulta sem as limitações de exibição para obter todos os dados
    let query = supabase
      .from("atas")
      .select(
        "*, fornecedor:fornecedores(razao_social,cnpj), itens:itens_ata(*), categoria:categorias(id,nome)",
      );

    const statusFiltro = document.getElementById("filtroStatus")?.value;
    if (statusFiltro && statusFiltro !== "todos") {
      query = query.eq("situacao", statusFiltro);
    } else {
      query = query.not("situacao", "eq", "VENCIDA");
    }

    const { data: atas } = await query.order("data_inicio_vigencia", {
      ascending: false,
    });

    this._atasCache = atas || [];
    this._ultimaBusca = Date.now();

    return this._atasCache;
  }

  // ============================================================
  // ABRIR DETALHES - REDIRECIONA PARA PÁGINA DE DETALHES
  // ============================================================
  async abrirDetalhes(ataId) {
    window.location.href = `detalhes-ata.html?id=${ataId}`;
  }

  // ============================================================
  // MÉTODO ANTIGO MANTIDO PARA COMPATIBILIDADE
  // ============================================================
  async abrirDetalhesModal(ataId) {
    console.warn(
      "⚠️ abrirDetalhesModal() está obsoleto. Redirecionando para página de detalhes.",
    );
    window.location.href = `detalhes-ata.html?id=${ataId}`;
  }

  // ============================================================
  // MÉTODOS AUXILIARES PARA O DASHBOARD (mantidos)
  // ============================================================

  async getIndicadoresDashboard() {
    try {
      const { data: atasAtivas, error: e1 } = await supabase
        .from("atas")
        .select("id, valor_global, situacao")
        .in("situacao", ["ATIVA", "PROXIMA"]);

      if (e1) throw e1;

      const totalAtas = atasAtivas?.length || 0;
      const valorTotal =
        atasAtivas?.reduce((s, a) => s + (a.valor_global || 0), 0) || 0;

      const { data: itens, error: e2 } = await supabase
        .from("itens_ata")
        .select("id, quantidade_contratada, valor_unitario, ata_id, descricao")
        .in("ata_id", atasAtivas?.map((a) => a.id) || []);

      if (e2) throw e2;

      const { data: consumos, error: e3 } = await supabase
        .from("consumos")
        .select("item_ata_id, quantidade, valor_total");

      if (e3) throw e3;

      const consumoPorItem = {};
      consumos?.forEach((c) => {
        if (!consumoPorItem[c.item_ata_id]) {
          consumoPorItem[c.item_ata_id] = { quantidade: 0, valor: 0 };
        }
        consumoPorItem[c.item_ata_id].quantidade += c.quantidade || 0;
        consumoPorItem[c.item_ata_id].valor += c.valor_total || 0;
      });

      let saldoTotal = 0;
      let itensComSaldo = 0;
      let itensCriticos = 0;
      let totalItens = 0;

      itens?.forEach((item) => {
        totalItens++;
        const consumido = consumoPorItem[item.id]?.valor || 0;
        const valorContratado =
          (item.quantidade_contratada || 0) * (item.valor_unitario || 0);
        const saldoItem = Math.max(0, valorContratado - consumido);
        saldoTotal += saldoItem;

        if (saldoItem > 0) itensComSaldo++;

        if (
          saldoItem > 0 &&
          valorContratado > 0 &&
          saldoItem / valorContratado < 0.1
        ) {
          itensCriticos++;
        }
      });

      const valorConsumido =
        consumos?.reduce((s, c) => s + (c.valor_total || 0), 0) || 0;

      return {
        totalAtas,
        valorTotal,
        saldoTotal,
        valorConsumido,
        itensCriticos,
        totalItens,
        itensComSaldo,
      };
    } catch (error) {
      console.error("Erro ao buscar indicadores para dashboard:", error);
      return null;
    }
  }

  async getConsumoPorCategoria() {
    try {
      const { data: consumos, error } = await supabase.from("consumos").select(`
          valor_total,
          ata_id,
          item_ata_id,
          itens_ata!inner (
            categoria,
            descricao
          )
        `);

      if (error) throw error;

      const categorias = {};
      consumos?.forEach((c) => {
        const categoria = c.itens_ata?.categoria || "Outros";
        if (!categorias[categoria]) {
          categorias[categoria] = 0;
        }
        categorias[categoria] += c.valor_total || 0;
      });

      return Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([categoria, valor]) => ({ categoria, valor }));
    } catch (error) {
      console.error("Erro ao buscar consumo por categoria:", error);
      return [];
    }
  }

  async getVencimentosProximos() {
    try {
      const hoje = new Date();
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() + 30);

      const { data: atas, error } = await supabase
        .from("atas")
        .select(
          `
          id,
          numero_ata,
          data_fim_vigencia,
          fornecedor_id,
          fornecedores!inner (razao_social),
          valor_global,
          situacao
        `,
        )
        .gte("data_fim_vigencia", hoje.toISOString().split("T")[0])
        .lte("data_fim_vigencia", trintaDias.toISOString().split("T")[0])
        .in("situacao", ["ATIVA", "PROXIMA"])
        .order("data_fim_vigencia", { ascending: true });

      if (error) throw error;

      return (
        atas?.map((a) => ({
          id: a.id,
          numero_ata: a.numero_ata,
          data_fim_vigencia: a.data_fim_vigencia,
          fornecedor: a.fornecedores?.razao_social || "N/I",
          dias_restantes: Math.ceil(
            (new Date(a.data_fim_vigencia) - hoje) / (1000 * 60 * 60 * 24),
          ),
        })) || []
      );
    } catch (error) {
      console.error("Erro ao buscar vencimentos próximos:", error);
      return [];
    }
  }

  async getTopFornecedores(limit = 5) {
    try {
      const { data: fornecedores, error } = await supabase
        .from("fornecedores")
        .select(
          `
          id,
          razao_social,
          cnpj,
          atas!inner (
            id,
            valor_global,
            situacao
          )
        `,
        )
        .in("atas.situacao", ["ATIVA", "PROXIMA"]);

      if (error) throw error;

      if (!fornecedores) return [];

      const ranking = fornecedores
        .map((f) => {
          const total =
            f.atas?.reduce((s, a) => s + (a.valor_global || 0), 0) || 0;
          return {
            id: f.id,
            razao_social: f.razao_social || "N/I",
            cnpj: f.cnpj || "",
            total,
            total_atas: f.atas?.length || 0,
          };
        })
        .filter((f) => f.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, limit);

      return ranking;
    } catch (error) {
      console.error("Erro ao buscar top fornecedores:", error);
      return [];
    }
  }

  async getEvolucaoConsumo(meses = 6) {
    try {
      const hoje = new Date();
      const dataInicio = new Date();
      dataInicio.setMonth(dataInicio.getMonth() - meses);

      const { data: consumos, error } = await supabase
        .from("consumos")
        .select("valor_total, data_consumo, created_at")
        .gte("data_consumo", dataInicio.toISOString().split("T")[0])
        .order("data_consumo", { ascending: true });

      if (error) throw error;

      const mesesMap = {};
      const mesesLabels = [];
      for (let i = meses - 1; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        mesesMap[key] = { total: 0, label: label };
        mesesLabels.push(key);
      }

      consumos?.forEach((c) => {
        const data = c.data_consumo || c.created_at;
        if (data) {
          const d = new Date(data);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (mesesMap[key]) {
            mesesMap[key].total += c.valor_total || 0;
          }
        }
      });

      return mesesLabels.map((key) => ({
        mes: key,
        label: mesesMap[key]?.label || key,
        valor: mesesMap[key]?.total || 0,
      }));
    } catch (error) {
      console.error("Erro ao buscar evolução de consumo:", error);
      return [];
    }
  }

  async getAtividadesRecentes(limit = 5) {
    try {
      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          `
          id,
          numero_pedido,
          status_aprovacao,
          created_at,
          usuarios!inner (nome),
          atas!inner (numero_ata)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(limit * 2);

      if (error) throw error;

      if (!pedidos) return [];

      return pedidos.slice(0, limit).map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido || "N/I",
        status: p.status_aprovacao || "PEDIDO_REALIZADO",
        data: p.created_at,
        usuario: p.usuarios?.nome || "Usuário",
        ata: p.atas?.numero_ata || "N/I",
      }));
    } catch (error) {
      console.error("Erro ao buscar atividades recentes:", error);
      return [];
    }
  }

  async getStatusDistribuicaoAtas() {
    try {
      const { data: atas, error } = await supabase
        .from("atas")
        .select("situacao");

      if (error) throw error;

      const statusCount = {
        ATIVA: 0,
        PROXIMA: 0,
        VENCIDA: 0,
        CANCELADA: 0,
        ENCERRADA: 0,
      };

      atas?.forEach((a) => {
        const status = a.situacao || "ATIVA";
        if (statusCount.hasOwnProperty(status)) {
          statusCount[status]++;
        } else {
          statusCount[status] = (statusCount[status] || 0) + 1;
        }
      });

      return Object.fromEntries(
        Object.entries(statusCount).filter(([_, value]) => value > 0),
      );
    } catch (error) {
      console.error("Erro ao buscar distribuição de status das atas:", error);
      return {};
    }
  }

  async getStatusDistribuicaoPedidos() {
    try {
      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("status_aprovacao");

      if (error) throw error;

      const statusCount = {
        APROVADO: 0,
        REJEITADO: 0,
        AGUARDANDO_APROVACAO: 0,
        PEDIDO_REALIZADO: 0,
      };

      pedidos?.forEach((p) => {
        const status = p.status_aprovacao || "PEDIDO_REALIZADO";
        if (statusCount.hasOwnProperty(status)) {
          statusCount[status]++;
        } else {
          statusCount[status] = (statusCount[status] || 0) + 1;
        }
      });

      return Object.fromEntries(
        Object.entries(statusCount).filter(([_, value]) => value > 0),
      );
    } catch (error) {
      console.error(
        "Erro ao buscar distribuição de status dos pedidos:",
        error,
      );
      return {};
    }
  }
}
