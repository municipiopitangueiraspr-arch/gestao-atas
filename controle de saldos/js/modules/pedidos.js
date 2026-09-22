import { supabase } from "../supabase.js";

export class Pedidos {
  constructor(sistema) {
    this.sistema = sistema;
    this.pedidosCache = [];
    this.totalPedidos = 0;
    this.limit = 15;
    this.offset = 0;
    this.filtrosAtivos = {
      numeroPedido: "",
      numeroAta: "",
      fornecedorId: null,
      dataCriacaoInicio: null,
      dataCriacaoFim: null,
      dataAprovacaoInicio: null,
      dataAprovacaoFim: null,
    };
    this.fornecedoresCache = [];
    this._carregandoMais = false;
  }

  // ============================================================
  // CARREGAR CONTEÚDO DA ABA DE PEDIDOS
  // ============================================================
  async carregarConteudo() {
    const container = document.getElementById("pedidosContent");
    this.sistema.ui.mostrarSpinner("pedidosContent", "Carregando pedidos...");
    const html = this.gerarHTMLPedidos();
    container.innerHTML = html;

    // Resetar estado
    this.offset = 0;
    this.pedidosCache = [];
    this.totalPedidos = 0;

    // Configurar eventos e autocomplete
    await this.configurarFiltros();
    await this.carregarPedidos();
  }

  // ============================================================
  // GERAR HTML DA ABA DE PEDIDOS
  // ============================================================
  gerarHTMLPedidos() {
    return `
      <div class="pedido-container">
        <!-- ============================================================ -->
        <!-- INDICADORES RÁPIDOS                                           -->
        <!-- ============================================================ -->
        <div class="pedidos-indicadores">
          <div class="indicador-card">
            <span class="indicador-numero" id="totalPedidos">0</span>
            <span class="indicador-label">Total</span>
          </div>
          <div class="indicador-card indicador-pendente">
            <span class="indicador-numero" id="pendentesPedidos">0</span>
            <span class="indicador-label">Pendentes</span>
          </div>
          <div class="indicador-card indicador-aprovado">
            <span class="indicador-numero" id="aprovadosPedidos">0</span>
            <span class="indicador-label">Aprovados</span>
          </div>
          <div class="indicador-card indicador-rejeitado">
            <span class="indicador-numero" id="rejeitadosPedidos">0</span>
            <span class="indicador-label">Rejeitados</span>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- FILTROS                                                       -->
        <!-- ============================================================ -->
        <div class="pedidos-filtros">
          <div class="pedidos-filtros-grid">
            <div class="filtro-grupo">
              <label class="filtro-label"><i class="fas fa-hashtag"></i> Nº Pedido</label>
              <input type="text" id="filtroNumeroPedido" class="filtro-input" placeholder="Ex: PED-2026-0001">
            </div>
            <div class="filtro-grupo">
              <label class="filtro-label"><i class="fas fa-file-contract"></i> Nº Ata</label>
              <input type="text" id="filtroNumeroAta" class="filtro-input" placeholder="Ex: 74/2026">
            </div>
          </div>

          <div class="pedidos-filtros-grid">
            <div class="filtro-grupo">
              <label class="filtro-label"><i class="fas fa-building"></i> Fornecedor</label>
              <div class="autocomplete-container" id="autocompleteFornecedorPedidos">
                <input type="text" id="fornecedorPedidoInput" class="filtro-input autocomplete-input" 
                       placeholder="Digite o nome ou CNPJ..." autocomplete="off">
                <input type="hidden" id="fornecedorPedidoId" value="">
                <div class="autocomplete-dropdown" id="autocompletePedidoDropdown"></div>
              </div>
            </div>
          </div>

          <div class="pedidos-filtros-grid">
            <div class="filtro-grupo">
              <label class="filtro-label"><i class="fas fa-calendar-plus"></i> Criado em</label>
              <div class="filtro-data-inputs">
                <input type="date" id="filtroDataCriacaoInicio" class="filtro-input filtro-data" placeholder="Início">
                <span class="filtro-data-separador">até</span>
                <input type="date" id="filtroDataCriacaoFim" class="filtro-input filtro-data" placeholder="Fim">
              </div>
            </div>
            <div class="filtro-grupo">
              <label class="filtro-label"><i class="fas fa-calendar-check"></i> Aprovado em</label>
              <div class="filtro-data-inputs">
                <input type="date" id="filtroDataAprovacaoInicio" class="filtro-input filtro-data" placeholder="Início">
                <span class="filtro-data-separador">até</span>
                <input type="date" id="filtroDataAprovacaoFim" class="filtro-input filtro-data" placeholder="Fim">
              </div>
            </div>
          </div>

          <div class="pedidos-filtros-actions">
            <button class="btn-aplicar" id="btnFiltrarPedidos">
              <i class="fas fa-filter"></i> Filtrar
            </button>
            <button class="btn-limpar" id="btnLimparFiltrosPedidos">
              <i class="fas fa-eraser"></i> Limpar
            </button>
            <button class="btn-exportar" id="btnExportarPedidos">
              <i class="fas fa-download"></i> Exportar
            </button>
          </div>
        </div>

        <!-- ============================================================ -->
        <!-- CONTADOR DE RESULTADOS                                        -->
        <!-- ============================================================ -->
        <div class="pedidos-contador">
          <span id="pedidosContador">Carregando pedidos...</span>
          <button class="btn-carregar-mais" id="btnCarregarMais" style="display: none;">
            <i class="fas fa-chevron-down"></i> Carregar mais 15
          </button>
        </div>

        <!-- ============================================================ -->
        <!-- LISTA DE PEDIDOS                                              -->
        <!-- ============================================================ -->
        <div id="pedidosLista" class="pedidos-lista-wrapper">
          <!-- Pedidos serão inseridos via JavaScript -->
        </div>
      </div>
    `;
  }

  // ============================================================
  // CONFIGURAR FILTROS
  // ============================================================
  async configurarFiltros() {
    // Carregar fornecedores para autocomplete
    await this.carregarFornecedores();

    // Configurar autocomplete de fornecedor
    this.configurarAutocompleteFornecedor();

    // Evento do botão Filtrar
    document
      .getElementById("btnFiltrarPedidos")
      ?.addEventListener("click", () => {
        this.aplicarFiltros();
      });

    // Evento do botão Limpar
    document
      .getElementById("btnLimparFiltrosPedidos")
      ?.addEventListener("click", () => {
        this.limparFiltros();
      });

    // Evento do botão Exportar
    document
      .getElementById("btnExportarPedidos")
      ?.addEventListener("click", () => {
        this.exportarPedidos();
      });

    // Evento do botão Carregar Mais
    document
      .getElementById("btnCarregarMais")
      ?.addEventListener("click", () => {
        this.carregarMaisPedidos();
      });

    // Evento de Enter nos campos de filtro
    document
      .querySelectorAll(
        "#filtroNumeroPedido, #filtroNumeroAta, #filtroDataCriacaoInicio, #filtroDataCriacaoFim, #filtroDataAprovacaoInicio, #filtroDataAprovacaoFim",
      )
      .forEach((input) => {
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            this.aplicarFiltros();
          }
        });
      });
  }

  // ============================================================
  // CARREGAR FORNECEDORES PARA AUTOCOMPLETE
  // ============================================================
  async carregarFornecedores() {
    try {
      const { data: fornecedores, error } = await supabase
        .from("fornecedores")
        .select("id, razao_social, cnpj")
        .order("razao_social");

      if (error) throw error;
      this.fornecedoresCache = fornecedores || [];
    } catch (error) {
      console.error("Erro ao carregar fornecedores:", error);
    }
  }

  // ============================================================
  // CONFIGURAR AUTOCOMPLETE DE FORNECEDOR
  // ============================================================
  configurarAutocompleteFornecedor() {
    const input = document.getElementById("fornecedorPedidoInput");
    const dropdown = document.getElementById("autocompletePedidoDropdown");
    const hiddenId = document.getElementById("fornecedorPedidoId");

    if (!input || !dropdown) return;

    let debounceTimer;

    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      const value = e.target.value.toLowerCase().trim();

      if (value.length === 0) {
        dropdown.classList.remove("open");
        hiddenId.value = "";
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
  // APLICAR FILTROS
  // ============================================================
  aplicarFiltros() {
    // Coletar valores dos filtros
    this.filtrosAtivos.numeroPedido =
      document.getElementById("filtroNumeroPedido")?.value?.trim() || "";
    this.filtrosAtivos.numeroAta =
      document.getElementById("filtroNumeroAta")?.value?.trim() || "";
    this.filtrosAtivos.fornecedorId =
      document.getElementById("fornecedorPedidoId")?.value || null;
    this.filtrosAtivos.dataCriacaoInicio =
      document.getElementById("filtroDataCriacaoInicio")?.value || null;
    this.filtrosAtivos.dataCriacaoFim =
      document.getElementById("filtroDataCriacaoFim")?.value || null;
    this.filtrosAtivos.dataAprovacaoInicio =
      document.getElementById("filtroDataAprovacaoInicio")?.value || null;
    this.filtrosAtivos.dataAprovacaoFim =
      document.getElementById("filtroDataAprovacaoFim")?.value || null;

    // Resetar offset e recarregar
    this.offset = 0;
    this.pedidosCache = [];
    this.carregarPedidos();
  }

  // ============================================================
  // LIMPAR FILTROS
  // ============================================================
  limparFiltros() {
    // Limpar campos
    document.getElementById("filtroNumeroPedido").value = "";
    document.getElementById("filtroNumeroAta").value = "";
    document.getElementById("fornecedorPedidoInput").value = "";
    document.getElementById("fornecedorPedidoId").value = "";
    document.getElementById("filtroDataCriacaoInicio").value = "";
    document.getElementById("filtroDataCriacaoFim").value = "";
    document.getElementById("filtroDataAprovacaoInicio").value = "";
    document.getElementById("filtroDataAprovacaoFim").value = "";

    // Fechar dropdown do autocomplete
    document
      .getElementById("autocompletePedidoDropdown")
      ?.classList.remove("open");

    // Resetar filtros ativos
    this.filtrosAtivos = {
      numeroPedido: "",
      numeroAta: "",
      fornecedorId: null,
      dataCriacaoInicio: null,
      dataCriacaoFim: null,
      dataAprovacaoInicio: null,
      dataAprovacaoFim: null,
    };

    // Resetar offset e recarregar
    this.offset = 0;
    this.pedidosCache = [];
    this.carregarPedidos();

    this.sistema.ui.mostrarToast("info", "Filtros limpos!");
  }

  // ============================================================
  // CARREGAR PEDIDOS
  // ============================================================
  async carregarPedidos() {
    const container = document.getElementById("pedidosLista");
    if (!this.sistema.usuarioAtual?.id) {
      container.innerHTML =
        '<div style="text-align:center;padding:40px;">Usuário não logado</div>';
      return;
    }

    try {
      // Construir query base
      let query = supabase.from("pedidos").select("*", { count: "exact" });

      // Filtrar por órgão do usuário (todos os perfis)
      if (this.sistema.usuarioAtual.orgao_id) {
        query = query.eq(
          "orgao_solicitante_id",
          this.sistema.usuarioAtual.orgao_id,
        );
      }

      // Aplicar filtros
      query = this.aplicarFiltrosQuery(query);

      // Ordenar por data de criação (mais recentes primeiro)
      query = query.order("created_at", { ascending: false });

      // Buscar total de pedidos (sem limite)
      const { count, error: countError } = await query;
      if (countError) throw countError;
      this.totalPedidos = count || 0;

      // Aplicar limite e offset
      query = query.range(this.offset, this.offset + this.limit - 1);

      const { data: pedidos, error } = await query;
      if (error) throw error;

      if (this.offset === 0) {
        this.pedidosCache = [];
      }

      if (pedidos && pedidos.length > 0) {
        this.pedidosCache = [...this.pedidosCache, ...pedidos];
      }

      // Atualizar indicadores
      await this.carregarIndicadores();

      // Renderizar pedidos
      await this.renderizarPedidos();

      // Atualizar contador
      this.atualizarContador();
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--error-600);">
        <i class="fas fa-exclamation-triangle" style="font-size:2rem;"></i>
        <h3 style="font-size:0.9rem;">Erro ao carregar pedidos</h3>
        <p style="font-size:0.8rem;">${error.message}</p>
      </div>`;
    }
  }

  // ============================================================
  // APLICAR FILTROS NA QUERY
  // ============================================================
  aplicarFiltrosQuery(query) {
    const f = this.filtrosAtivos;

    // Filtro por número do pedido
    if (f.numeroPedido) {
      query = query.ilike("numero_pedido", `%${f.numeroPedido}%`);
    }

    // Filtro por número da ata (precisa de join)
    if (f.numeroAta) {
      // Como não podemos fazer join diretamente com ilike no numero_ata,
      // vamos buscar os IDs das atas primeiro
      // Este filtro será aplicado após a consulta principal
      // Mas para performance, vamos adicionar como filtro pós-query
    }

    // Filtro por fornecedor
    if (f.fornecedorId) {
      query = query.eq("fornecedor_id", parseInt(f.fornecedorId));
    }

    // Filtro por data de criação
    if (f.dataCriacaoInicio) {
      query = query.gte("created_at", `${f.dataCriacaoInicio}T00:00:00`);
    }
    if (f.dataCriacaoFim) {
      query = query.lte("created_at", `${f.dataCriacaoFim}T23:59:59`);
    }

    // Filtro por data de aprovação
    if (f.dataAprovacaoInicio) {
      query = query.gte("data_aprovacao", f.dataAprovacaoInicio);
    }
    if (f.dataAprovacaoFim) {
      query = query.lte("data_aprovacao", f.dataAprovacaoFim);
    }

    return query;
  }

  // ============================================================
  // CARREGAR INDICADORES
  // ============================================================
  async carregarIndicadores() {
    try {
      let query = supabase.from("pedidos").select("*", { count: "exact" });

      if (this.sistema.usuarioAtual.orgao_id) {
        query = query.eq(
          "orgao_solicitante_id",
          this.sistema.usuarioAtual.orgao_id,
        );
      }

      // Total
      const { count: total, error: totalError } = await query;
      if (totalError) throw totalError;

      // Pendentes
      const { count: pendentes } = await query.eq(
        "status_aprovacao",
        "AGUARDANDO_APROVACAO",
      );

      // Aprovados
      const { count: aprovados } = await query.eq(
        "status_aprovacao",
        "APROVADO",
      );

      // Rejeitados
      const { count: rejeitados } = await query.eq(
        "status_aprovacao",
        "REJEITADO",
      );

      document.getElementById("totalPedidos").textContent = total || 0;
      document.getElementById("pendentesPedidos").textContent = pendentes || 0;
      document.getElementById("aprovadosPedidos").textContent = aprovados || 0;
      document.getElementById("rejeitadosPedidos").textContent =
        rejeitados || 0;
    } catch (error) {
      console.error("Erro ao carregar indicadores:", error);
    }
  }

  // ============================================================
  // RENDERIZAR PEDIDOS
  // ============================================================
  async renderizarPedidos() {
    const container = document.getElementById("pedidosLista");

    if (!this.pedidosCache || this.pedidosCache.length === 0) {
      container.innerHTML = `
        <div style="text-align:center;padding:60px 20px;background:white;border-radius:var(--border-radius-2xl);border:1px solid var(--neutral-200);">
          <i class="fas fa-file-invoice" style="font-size:3rem;color:var(--neutral-300);"></i>
          <h3 style="margin-top:15px;color:var(--neutral-600);font-size:1rem;">Nenhum pedido encontrado</h3>
          <p style="color:var(--neutral-400);font-size:0.85rem;">Nenhum pedido corresponde aos filtros aplicados.</p>
        </div>
      `;
      return;
    }

    // Buscar dados completos dos pedidos
    const pedidosCompletos = await Promise.all(
      this.pedidosCache.map(async (p) => {
        const [
          usuarioResult,
          ataResult,
          fornecedorResult,
          orgaoResult,
          itensResult,
        ] = await Promise.all([
          supabase
            .from("usuarios")
            .select("nome")
            .eq("id", p.usuario_id)
            .single(),
          supabase
            .from("atas")
            .select("numero_ata, processo_administrativo")
            .eq("id", p.ata_id)
            .single(),
          supabase
            .from("fornecedores")
            .select("razao_social,cnpj")
            .eq("id", p.fornecedor_id)
            .single(),
          supabase
            .from("orgaos")
            .select("nome,sigla")
            .eq("id", p.orgao_solicitante_id)
            .single(),
          supabase.from("itens_pedido").select("*").eq("pedido_id", p.id),
        ]);

        let aprovadorNome = null;
        if (p.aprovado_por) {
          const { data: aprovador } = await supabase
            .from("usuarios")
            .select("nome")
            .eq("id", p.aprovado_por)
            .single();
          aprovadorNome = aprovador?.nome;
        }

        const itensCompletos = [];
        if (itensResult.data && itensResult.data.length > 0) {
          for (const item of itensResult.data) {
            const { data: itemAta } = await supabase
              .from("itens_ata")
              .select("descricao, item_numero")
              .eq("id", item.item_ata_id)
              .single();
            itensCompletos.push({
              ...item,
              descricao: itemAta?.descricao || "Descrição não encontrada",
              item_numero: itemAta?.item_numero || item.item_ata_id,
            });
          }
        }
        return {
          ...p,
          usuario: usuarioResult.data || { nome: "N/I" },
          ata: ataResult.data || {
            numero_ata: "N/I",
            processo_administrativo: "",
          },
          fornecedor: fornecedorResult.data || {
            razao_social: "N/I",
            cnpj: "",
          },
          orgao_solicitante: orgaoResult.data || { nome: "N/I", sigla: "" },
          itens_pedido: itensCompletos,
          aprovador_nome: aprovadorNome,
        };
      }),
    );

    // Se for a primeira carga, criar o container
    if (this.offset === 0) {
      container.innerHTML = `
        <div class="pedidos-lista-container">
          <div class="pedidos-lista-header">
            <span>Pedido</span>
            <span>Ata</span>
            <span>Fornecedor</span>
            <span style="text-align:right;">Valor</span>
            <span style="text-align:center;">Status</span>
            <span style="text-align:center;">Data</span>
          </div>
          ${pedidosCompletos.map((p) => this.renderPedido(p)).join("")}
        </div>
      `;
    } else {
      // Adicionar mais pedidos à lista existente
      const listaContainer = container.querySelector(
        ".pedidos-lista-container",
      );
      if (listaContainer) {
        const novosPedidosHtml = pedidosCompletos
          .map((p) => this.renderPedido(p))
          .join("");
        // Inserir antes do último elemento (que é o rodapé ou vazio)
        const footer = listaContainer.querySelector(".pedidos-contador-footer");
        if (footer) {
          footer.insertAdjacentHTML("beforebegin", novosPedidosHtml);
        } else {
          listaContainer.insertAdjacentHTML("beforeend", novosPedidosHtml);
        }
      }
    }

    // Atualizar contador
    this.atualizarContador();
  }

  // ============================================================
  // RENDERIZAR PEDIDO INDIVIDUAL
  // ============================================================
  renderPedido(p) {
    const total =
      p.itens_pedido?.reduce((s, i) => s + (i.valor_total || 0), 0) || 0;
    const statusAprovacao = p.status_aprovacao || "AGUARDANDO_APROVACAO";
    const podeAprovar =
      (this.sistema.usuarioAtual.perfil === "ADMIN" ||
        (this.sistema.usuarioAtual.perfil === "SECRETARIO" &&
          this.sistema.usuarioAtual.orgao_id === p.orgao_solicitante_id)) &&
      statusAprovacao === "AGUARDANDO_APROVACAO";

    const statusClass =
      statusAprovacao === "APROVADO"
        ? "status-aprovado"
        : statusAprovacao === "REJEITADO"
          ? "status-rejeitado"
          : "status-aguardando";

    const statusLabel =
      statusAprovacao === "APROVADO"
        ? "Aprovado"
        : statusAprovacao === "REJEITADO"
          ? "Rejeitado"
          : "Aguardando Aprovação";

    // Gerar HTML dos itens para expansão
    const itensHtml =
      p.itens_pedido
        ?.map(
          (i) => `
      <tr>
        <td>${i.item_numero || i.item_ata_id}</td>
        <td>${i.descricao || "Descrição não disponível"}</td>
        <td class="numeric">${i.quantidade_solicitada || 0}</td>
        <td class="numeric">${this.sistema.ui.formatarMoeda(i.valor_unitario)}</td>
        <td class="numeric total-item">${this.sistema.ui.formatarMoeda(i.valor_total)}</td>
      </tr>
    `,
        )
        .join("") ||
      '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--neutral-400);">Nenhum item encontrado</td></tr>';

    return `
      <div class="pedidos-lista-item" data-pedido-id="${p.id}" onclick="sistema.pedidos.toggleExpandPedido(${p.id})">
        <div class="numero-pedido">
          <i class="fas fa-file-invoice"></i> ${p.numero_pedido || "N/I"}
        </div>
        <div class="ata-info">
          <strong>Ata ${p.ata?.numero_ata || "N/I"}</strong>
          <span style="font-size:0.7rem;color:var(--neutral-400);display:block;">${p.ata?.processo_administrativo || ""}</span>
        </div>
        <div class="fornecedor-info" title="${p.fornecedor?.razao_social || "N/I"}">
          ${p.fornecedor?.razao_social || "N/I"}
        </div>
        <div class="valor-info">
          ${this.sistema.ui.formatarMoeda(total)}
        </div>
        <div class="status-info">
          ${
            statusAprovacao === "REJEITADO"
              ? `<span class="status-badge ${statusClass} clickable" onclick="event.stopPropagation(); sistema.pedidos.abrirModalMotivoRejeicao(${p.id})" title="Clique para ver o motivo da rejeição">${statusLabel} <i class="fas fa-info-circle" style="font-size: 0.6rem; margin-left: 4px;"></i></span>`
              : `<span class="status-badge ${statusClass}">${statusLabel}</span>`
          }
        </div>
        <div class="data-info">
          <i class="far fa-calendar-alt"></i> ${this.sistema.ui.formatarData(p.data_solicitacao)}
        </div>

        <!-- Detalhes expansíveis -->
        <div class="pedidos-detalhes" id="detalhes-${p.id}">
          <div class="detalhes-header">
            <h4><i class="fas fa-boxes"></i> Itens do Pedido (${p.itens_pedido?.length || 0} itens)</h4>
            <div class="detalhes-actions">
              <button class="btn-visualizar-pedido" onclick="event.stopPropagation(); sistema.pedidos.visualizarPedidoCompleto(${p.id})">
                <i class="fas fa-eye"></i> Ver Detalhes
              </button>
              ${
                podeAprovar
                  ? `
                <button class="btn-aprovar" onclick="event.stopPropagation(); sistema.pedidos.aprovarPedido(${p.id})">
                  <i class="fas fa-check"></i> Aprovar
                </button>
                <button class="btn-rejeitar" onclick="event.stopPropagation(); sistema.pedidos.rejeitarPedido(${p.id})">
                  <i class="fas fa-times"></i> Rejeitar
                </button>
              `
                  : ""
              }
            </div>
          </div>
          <div class="tabela-container">
            <table class="tabela-itens-pedido">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Descrição</th>
                  <th style="text-align:right;">Qtd</th>
                  <th style="text-align:right;">Valor Unit.</th>
                  <th style="text-align:right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itensHtml}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align:right;">TOTAL DO PEDIDO</td>
                  <td style="text-align:right;color:var(--success-600);font-size:1rem;">
                    ${this.sistema.ui.formatarMoeda(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div style="margin-top:12px;font-size:0.75rem;color:var(--neutral-500);display:flex;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--neutral-200);padding-top:10px;">
            <span><i class="fas fa-user"></i> Solicitante: ${p.usuario?.nome || "N/I"}</span>
            <span><i class="fas fa-building"></i> Órgão: ${p.orgao_solicitante?.nome || "N/I"}</span>
            ${p.aprovado_por ? `<span><i class="fas fa-check-circle"></i> Aprovado por: ${p.aprovador_nome || "N/I"}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // ATUALIZAR CONTADOR
  // ============================================================
  atualizarContador() {
    const contadorEl = document.getElementById("pedidosContador");
    const carregarMaisEl = document.getElementById("btnCarregarMais");

    if (!contadorEl) return;

    const exibidos = this.pedidosCache.length;
    const total = this.totalPedidos;

    if (total === 0) {
      contadorEl.innerHTML = "Nenhum pedido encontrado";
      if (carregarMaisEl) carregarMaisEl.style.display = "none";
      return;
    }

    contadorEl.innerHTML = `Exibindo <strong>${exibidos}</strong> de <strong>${total}</strong> pedidos`;

    // Mostrar/esconder botão "Carregar mais"
    if (carregarMaisEl) {
      if (exibidos < total) {
        carregarMaisEl.style.display = "inline-flex";
        carregarMaisEl.disabled = false;
      } else {
        carregarMaisEl.style.display = "none";
      }
    }
  }

  // ============================================================
  // CARREGAR MAIS PEDIDOS
  // ============================================================
  async carregarMaisPedidos() {
    if (this._carregandoMais) return;
    if (this.pedidosCache.length >= this.totalPedidos) return;

    this._carregandoMais = true;
    const btn = document.getElementById("btnCarregarMais");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
    }

    this.offset += this.limit;
    await this.carregarPedidos();

    this._carregandoMais = false;
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-chevron-down"></i> Carregar mais 15';
    }
  }

  // ============================================================
  // EXPORTAR PEDIDOS
  // ============================================================
  async exportarPedidos() {
    try {
      // Buscar todos os pedidos com os filtros atuais (sem limite)
      let query = supabase
        .from("pedidos")
        .select(
          "*, atas:ata_id(numero_ata), fornecedores:fornecedor_id(razao_social, cnpj)",
        );

      if (this.sistema.usuarioAtual.orgao_id) {
        query = query.eq(
          "orgao_solicitante_id",
          this.sistema.usuarioAtual.orgao_id,
        );
      }

      query = this.aplicarFiltrosQuery(query);
      query = query.order("created_at", { ascending: false });

      const { data: pedidos, error } = await query;
      if (error) throw error;

      if (!pedidos || pedidos.length === 0) {
        this.sistema.ui.mostrarToast("aviso", "Nenhum pedido para exportar.");
        return;
      }

      // Preparar dados para CSV
      const cabecalho = [
        "Nº Pedido",
        "Ata",
        "Fornecedor",
        "CNPJ",
        "Valor Total",
        "Status",
        "Data Solicitação",
        "Data Aprovação",
        "Solicitante",
        "Órgão",
      ];

      const linhas = pedidos.map((p) => [
        p.numero_pedido || "",
        p.atas?.numero_ata || "",
        p.fornecedores?.razao_social || "",
        p.fornecedores?.cnpj || "",
        (p.valor_total || 0).toFixed(2).replace(".", ","),
        p.status_aprovacao || "PEDIDO_REALIZADO",
        p.data_solicitacao || "",
        p.data_aprovacao || "",
        p.usuario_id || "",
        p.orgao_solicitante_id || "",
      ]);

      const csvContent = [
        cabecalho.join(","),
        ...linhas.map((l) => l.join(",")),
      ].join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `pedidos_${new Date().toISOString().split("T")[0]}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.sistema.ui.mostrarToast(
        "sucesso",
        `${pedidos.length} pedidos exportados com sucesso!`,
      );
    } catch (error) {
      console.error("Erro ao exportar pedidos:", error);
      this.sistema.ui.mostrarToast("erro", "Erro ao exportar pedidos.");
    }
  }

  // ============================================================
  // TOGGLE EXPANSÃO DO PEDIDO
  // ============================================================
  toggleExpandPedido(pedidoId) {
    const detalhes = document.getElementById(`detalhes-${pedidoId}`);
    if (!detalhes) return;

    const item = detalhes.closest(".pedidos-lista-item");
    const isExpanded = detalhes.classList.contains("ativo");

    // Fechar todos os outros detalhes
    document.querySelectorAll(".pedidos-detalhes.ativo").forEach((el) => {
      if (el.id !== `detalhes-${pedidoId}`) {
        el.classList.remove("ativo");
        el.closest(".pedidos-lista-item")?.classList.remove("expandido");
      }
    });

    if (isExpanded) {
      detalhes.classList.remove("ativo");
      item?.classList.remove("expandido");
    } else {
      detalhes.classList.add("ativo");
      item?.classList.add("expandido");
      item?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  // ============================================================
  // REJEITAR PEDIDO - COM MODAL ESTILIZADO PROFISSIONAL
  // ============================================================
  async rejeitarPedido(pedidoId) {
    this.pedidoRejeicaoId = pedidoId;
    window._pedidoRejeicaoId = pedidoId;

    const textarea = document.getElementById("motivoRejeicao");
    if (textarea) {
      textarea.value = "";
      textarea.focus();
      textarea.removeEventListener("input", this._handleCharCount);
      textarea.addEventListener("input", this._handleCharCount);
    }

    const charCount = document.getElementById("charCount");
    if (charCount) {
      charCount.textContent = "0";
      charCount.className = "count";
    }

    const modal = document.getElementById("modalMotivoRejeicao");
    if (modal) {
      modal.classList.add("active");
    }
  }

  // ============================================================
  // HANDLER PARA CONTADOR DE CARACTERES
  // ============================================================
  _handleCharCount(e) {
    const textarea = e.target;
    const count = textarea.value.length;
    const charCount = document.getElementById("charCount");
    if (charCount) {
      charCount.textContent = count;
      charCount.className = "count";
      if (count > 450) {
        charCount.classList.add("danger");
      } else if (count > 400) {
        charCount.classList.add("warning");
      }
    }
  }

  // ============================================================
  // CONFIRMAR REJEIÇÃO
  // ============================================================
  async confirmarRejeicao() {
    const textarea = document.getElementById("motivoRejeicao");
    const justificativa = textarea?.value?.trim();

    if (!justificativa) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Campo obrigatório",
        "Informe o motivo da rejeição.",
      );
      textarea?.focus();
      return;
    }

    if (justificativa.length < 10) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Texto muito curto",
        "O motivo deve ter pelo menos 10 caracteres.",
      );
      textarea?.focus();
      return;
    }

    const btn = document.getElementById("btnConfirmarRejeicao");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    try {
      const { error } = await supabase
        .from("pedidos")
        .update({
          status_aprovacao: "REJEITADO",
          aprovado_por: this.sistema.usuarioAtual.id,
          data_aprovacao: new Date().toISOString().split("T")[0],
          observacao_aprovacao: justificativa,
        })
        .eq("id", this.pedidoRejeicaoId);

      if (error) throw error;

      this.fecharModalMotivoRejeicao();
      this.sistema.ui.mostrarToast(
        "sucesso",
        "Pedido rejeitado",
        "O pedido foi rejeitado com sucesso.",
      );
      await this.carregarPedidos();
    } catch (error) {
      this.sistema.ui.mostrarToast("erro", "Erro", error.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fas fa-exclamation-triangle"></i> Rejeitar Pedido';
      }
    }
  }

  // ============================================================
  // ABRIR MODAL VISUALIZAR MOTIVO DE REJEIÇÃO
  // ============================================================
  async abrirModalMotivoRejeicao(pedidoId) {
    try {
      const { data: pedido, error } = await supabase
        .from("pedidos")
        .select(
          "numero_pedido, observacao_aprovacao, aprovado_por, data_aprovacao",
        )
        .eq("id", pedidoId)
        .single();

      if (error) throw error;

      let nomeAprovador = "Desconhecido";
      let iniciaisAprovador = "?";
      if (pedido.aprovado_por) {
        const { data: aprovador } = await supabase
          .from("usuarios")
          .select("nome")
          .eq("id", pedido.aprovado_por)
          .single();
        nomeAprovador = aprovador?.nome || "Desconhecido";
        iniciaisAprovador = nomeAprovador
          .split(" ")
          .map((n) => n[0])
          .join("")
          .substring(0, 2)
          .toUpperCase();
      }

      const html = `
        <div class="motivo-card">
          <div class="card-header">
            <div class="pedido-info">
              <span class="pedido-numero">
                <i class="fas fa-file-invoice"></i>
                ${pedido.numero_pedido || "N/I"}
              </span>
            </div>
            <span class="pedido-status">
              <i class="fas fa-times-circle"></i> Rejeitado
            </span>
          </div>
          <div class="card-body">
            <div class="aprovador-info">
              <div class="aprovador-avatar">${iniciaisAprovador}</div>
              <div class="aprovador-detalhes">
                <div class="nome">
                  <i class="fas fa-user-check" style="color: var(--error-600); margin-right: 4px;"></i>
                  ${nomeAprovador}
                </div>
                <div class="data">
                  <i class="far fa-calendar-alt"></i>
                  Rejeitado em ${this.sistema.ui.formatarData(pedido.data_aprovacao)}
                </div>
              </div>
            </div>
            <div class="motivo-content">
              <div class="motivo-label">
                <i class="fas fa-comment"></i> Motivo da Rejeição
              </div>
              <div class="motivo-texto">
                ${pedido.observacao_aprovacao || "Motivo não informado."}
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById("modalVisualizarMotivoConteudo").innerHTML = html;
      document.getElementById("modalVisualizarMotivo").classList.add("active");
    } catch (error) {
      this.sistema.ui.mostrarToast(
        "erro",
        "Erro",
        "Não foi possível carregar o motivo da rejeição.",
      );
      console.error(error);
    }
  }

  // ============================================================
  // FECHAR MODAL MOTIVO DE REJEIÇÃO
  // ============================================================
  fecharModalMotivoRejeicao() {
    const modal = document.getElementById("modalMotivoRejeicao");
    if (modal) modal.classList.remove("active");

    const textarea = document.getElementById("motivoRejeicao");
    if (textarea) {
      textarea.value = "";
      textarea.removeEventListener("input", this._handleCharCount);
    }

    const charCount = document.getElementById("charCount");
    if (charCount) {
      charCount.textContent = "0";
      charCount.className = "count";
    }

    const btn = document.getElementById("btnConfirmarRejeicao");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Rejeitar Pedido';
    }
  }

  // ============================================================
  // FECHAR MODAL VISUALIZAR MOTIVO
  // ============================================================
  fecharModalVisualizarMotivo() {
    const modal = document.getElementById("modalVisualizarMotivo");
    if (modal) modal.classList.remove("active");
  }

  // ============================================================
  // APROVAR PEDIDO
  // ============================================================
  async aprovarPedido(pedidoId) {
    try {
      const { data: pedido, error: pedidoError } = await supabase
        .from("pedidos")
        .select("*, itens_pedido(*)")
        .eq("id", pedidoId)
        .single();

      if (pedidoError) throw pedidoError;
      if (!pedido) {
        this.sistema.ui.mostrarToast("erro", "Pedido não encontrado.");
        return;
      }

      if (pedido.status_aprovacao === "APROVADO") {
        this.sistema.ui.mostrarToast("aviso", "Pedido já foi aprovado.");
        return;
      }

      let saldoInsuficiente = false;
      const itensComSaldo = [];

      for (const item of pedido.itens_pedido) {
        const { data: itemAta, error: itemAtaError } = await supabase
          .from("itens_ata")
          .select("id, saldo_quantidade, descricao, quantidade_contratada")
          .eq("id", item.item_ata_id)
          .single();

        if (itemAtaError) throw itemAtaError;
        if (!itemAta) {
          this.sistema.ui.mostrarToast(
            "erro",
            `Item do pedido não encontrado na ata.`,
          );
          return;
        }

        const saldoAtual = itemAta.saldo_quantidade || 0;
        const quantidadeSolicitada = item.quantidade_solicitada || 0;

        if (quantidadeSolicitada > saldoAtual) {
          saldoInsuficiente = true;
          this.sistema.ui.mostrarToast(
            "erro",
            `Saldo insuficiente para "${itemAta.descricao}". Disponível: ${saldoAtual}, Solicitado: ${quantidadeSolicitada}`,
          );
          break;
        }

        itensComSaldo.push({
          itemPedidoId: item.id,
          itemAtaId: item.item_ata_id,
          quantidade: quantidadeSolicitada,
          valorUnitario: item.valor_unitario,
          valorTotal: item.valor_total,
          saldoAtual: saldoAtual,
          descricao: itemAta.descricao,
        });
      }

      if (saldoInsuficiente) return;

      const confirmado = await this.sistema.confirmar(
        `Aprovar pedido ${pedido.numero_pedido}?\n\nEsta ação irá descontar o saldo dos itens da ata.`,
      );
      if (!confirmado) return;

      for (const item of itensComSaldo) {
        const { error: consumoError } = await supabase.from("consumos").insert({
          ata_id: pedido.ata_id,
          item_ata_id: item.itemAtaId,
          orgao_solicitante_id: pedido.orgao_solicitante_id,
          usuario_id: this.sistema.usuarioAtual.id,
          quantidade: item.quantidade,
          valor_unitario: item.valorUnitario,
          valor_total: item.valorTotal,
          data_consumo: new Date().toISOString().split("T")[0],
          observacao: `Consumo automático via aprovação do pedido ${pedido.numero_pedido}`,
          created_at: new Date().toISOString(),
        });

        if (consumoError) {
          console.error("Erro ao registrar consumo:", consumoError);
          this.sistema.ui.mostrarToast(
            "erro",
            "Erro ao registrar consumo. Operação cancelada.",
          );
          return;
        }

        const novoSaldo = item.saldoAtual - item.quantidade;
        const { error: updateError } = await supabase
          .from("itens_ata")
          .update({
            saldo_quantidade: novoSaldo,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.itemAtaId);

        if (updateError) {
          console.error("Erro ao atualizar saldo:", updateError);
          this.sistema.ui.mostrarToast(
            "erro",
            "Erro ao atualizar saldo. Operação cancelada.",
          );
          return;
        }
      }

      const { error: updatePedidoError } = await supabase
        .from("pedidos")
        .update({
          status_aprovacao: "APROVADO",
          aprovado_por: this.sistema.usuarioAtual.id,
          data_aprovacao: new Date().toISOString().split("T")[0],
          status: "APROVADO",
        })
        .eq("id", pedidoId);

      if (updatePedidoError) throw updatePedidoError;

      this.sistema.ui.mostrarToast(
        "sucesso",
        "Pedido aprovado e saldo descontado com sucesso!",
      );
      await this.carregarPedidos();

      if (this.sistema.consulta) {
        await this.sistema.consulta.carregarConteudo();
      }
    } catch (error) {
      console.error("Erro ao aprovar pedido:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        error.message || "Erro ao aprovar pedido.",
      );
    }
  }

  // ============================================================
  // VISUALIZAR PEDIDO COMPLETO
  // ============================================================
  async visualizarPedidoCompleto(pedidoId) {
    try {
      const pedidoCompleto = await this.carregarPedidoCompleto(pedidoId);
      if (!pedidoCompleto) {
        this.sistema.ui.mostrarToast("erro", "Pedido não encontrado");
        return;
      }

      const total = pedidoCompleto.itens_pedido.reduce(
        (s, i) => s + (i.valor_total || 0),
        0,
      );
      const statusAprovacao =
        pedidoCompleto.status_aprovacao || "AGUARDANDO_APROVACAO";

      let html = `
        <div class="pedido-container">
          <div class="pedido-header">
            <div>
              <h2 class="pedido-titulo">PEDIDO Nº ${pedidoCompleto.numero_pedido}</h2>
              <p class="pedido-subtitulo" style="font-size:0.85rem;">${this.sistema.ui.formatarData(pedidoCompleto.data_solicitacao)}</p>
            </div>
            <span class="status-badge" style="background:${statusAprovacao === "APROVADO" ? "var(--success-100)" : statusAprovacao === "REJEITADO" ? "var(--error-100)" : "var(--warning-100)"};color:${statusAprovacao === "APROVADO" ? "var(--success-800)" : statusAprovacao === "REJEITADO" ? "var(--error-800)" : "var(--warning-800)"};">${statusAprovacao}</span>
          </div>
      `;

      if (pedidoCompleto.aprovado_por) {
        const { data: aprovador } = await supabase
          .from("usuarios")
          .select("nome")
          .eq("id", pedidoCompleto.aprovado_por)
          .single();
        html += `<div style="margin-bottom:16px;padding:8px;background:var(--neutral-50);border-radius:var(--border-radius-lg);font-size:0.85rem;"><strong>Aprovado/Rejeitado por:</strong> ${aprovador?.nome || "Desconhecido"} em ${this.sistema.ui.formatarData(pedidoCompleto.data_aprovacao)} ${pedidoCompleto.observacao_aprovacao ? `<br><strong>Observação:</strong> ${pedidoCompleto.observacao_aprovacao}` : ""}</div>`;
      }

      html += `
        <div style="margin-bottom:16px;">
          <h3 style="color:var(--primary-700);margin-bottom:8px;font-size:0.9rem;">DADOS DA ATA</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;background:var(--neutral-50);padding:12px;border-radius:var(--border-radius-lg);">
            <div>
              <strong style="font-size:0.8rem;">Ata nº:</strong> <span style="font-size:0.85rem;">${pedidoCompleto.ata?.numero_ata || "N/I"}</span><br>
              <strong style="font-size:0.8rem;">Processo:</strong> <span style="font-size:0.85rem;">${pedidoCompleto.ata?.processo_administrativo || "N/I"}</span><br>
              <strong style="font-size:0.8rem;">Objeto:</strong> <span style="font-size:0.85rem;">${pedidoCompleto.ata?.objeto || "N/I"}</span>
            </div>
            <div>
              <strong style="font-size:0.8rem;">Vigência:</strong> <span style="font-size:0.85rem;">${this.sistema.ui.formatarData(pedidoCompleto.ata?.data_inicio_vigencia)} até ${this.sistema.ui.formatarData(pedidoCompleto.ata?.data_fim_vigencia)}</span>
            </div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
          <div style="background:var(--neutral-50);padding:12px;border-radius:var(--border-radius-lg);">
            <h4 style="color:var(--primary-700);margin-bottom:6px;font-size:0.85rem;">FORNECEDOR</h4>
            <p style="font-size:0.8rem;"><strong>Razão Social:</strong> ${pedidoCompleto.fornecedor?.razao_social || "N/I"}</p>
            <p style="font-size:0.8rem;"><strong>CNPJ:</strong> ${pedidoCompleto.fornecedor?.cnpj || "N/I"}</p>
          </div>
          <div style="background:var(--neutral-50);padding:12px;border-radius:var(--border-radius-lg);">
            <h4 style="color:var(--primary-700);margin-bottom:6px;font-size:0.85rem;">SOLICITANTE</h4>
            <p style="font-size:0.8rem;"><strong>Órgão:</strong> ${pedidoCompleto.orgao_solicitante?.nome || "N/I"} (${pedidoCompleto.orgao_solicitante?.sigla || ""})</p>
            <p style="font-size:0.8rem;"><strong>CNPJ:</strong> ${pedidoCompleto.orgao_solicitante?.cnpj || "N/I"}</p>
            <p style="font-size:0.8rem;"><strong>Solicitante:</strong> ${pedidoCompleto.usuario?.nome || "N/I"}</p>
          </div>
        </div>
        <h4 style="margin-bottom:10px;font-size:0.9rem;">ITENS DO PEDIDO</h4>
        <div class="tabela-container">
          <table style="width:100%;border-collapse:collapse;font-size:0.75rem;">
            <thead>
              <tr style="background:var(--neutral-800);color:white;">
                <th style="padding:8px;text-align:left;">Item</th>
                <th style="padding:8px;text-align:left;">Descrição</th>
                <th style="padding:8px;text-align:right;">Qtd</th>
                <th style="padding:8px;text-align:right;">Valor Unit.</th>
                <th style="padding:8px;text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${pedidoCompleto.itens_pedido
                .map(
                  (i) => `
                <tr>
                  <td style="padding:6px 8px;border-bottom:1px solid var(--neutral-200);">${i.item_numero || i.item_ata_id}</td>
                  <td style="padding:6px 8px;border-bottom:1px solid var(--neutral-200);">${i.descricao || "Descrição não disponível"}</td>
                  <td style="padding:6px 8px;text-align:right;border-bottom:1px solid var(--neutral-200);">${i.quantidade_solicitada || 0}</td>
                  <td style="padding:6px 8px;text-align:right;border-bottom:1px solid var(--neutral-200);">${this.sistema.ui.formatarMoeda(i.valor_unitario)}</td>
                  <td style="padding:6px 8px;text-align:right;border-bottom:1px solid var(--neutral-200);">${this.sistema.ui.formatarMoeda(i.valor_total)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
            <tfoot>
              <tr style="background:var(--neutral-50);">
                <td colspan="4" style="padding:10px;text-align:right;font-weight:700;">TOTAL DO PEDIDO</td>
                <td style="padding:10px;text-align:right;font-weight:700;color:var(--success-600);">${this.sistema.ui.formatarMoeda(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div style="margin-top:20px;font-size:0.7rem;color:var(--neutral-500);font-style:italic;text-align:center;border-top:1px solid var(--neutral-200);padding-top:12px;">
          <p>Documento gerado eletronicamente em ${new Date().toLocaleString("pt-BR")}.</p>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px;">
          <button class="btn" style="background:var(--neutral-200);padding:6px 14px;border:none;border-radius:var(--border-radius-md);cursor:pointer;font-size:0.8rem;" onclick="sistema.fecharModalVisualizarPedido()">Fechar</button>
          <button class="btn-pdf" style="background:var(--primary-600);color:white;padding:6px 14px;border:none;border-radius:var(--border-radius-md);cursor:pointer;font-size:0.8rem;" onclick="sistema.pedidos.gerarPDFPedido(${pedidoCompleto.id})"><i class="fas fa-file-pdf"></i> PDF</button>
        </div>
      </div>
      `;

      document.getElementById("modalVisualizarPedidoConteudo").innerHTML = html;
      document.getElementById("modalVisualizarPedido").classList.add("active");
    } catch (error) {
      this.sistema.ui.mostrarToast("erro", error.message);
    }
  }

  // ============================================================
  // CARREGAR PEDIDO COMPLETO
  // ============================================================
  async carregarPedidoCompleto(pedidoId) {
    try {
      const { data: pedido, error: ePed } = await supabase
        .from("pedidos")
        .select("*")
        .eq("id", pedidoId)
        .single();
      if (ePed || !pedido) return null;

      const [
        usuarioResult,
        ataResult,
        fornecedorResult,
        orgaoResult,
        itensResult,
      ] = await Promise.all([
        supabase
          .from("usuarios")
          .select("nome")
          .eq("id", pedido.usuario_id)
          .single(),
        supabase
          .from("atas")
          .select(
            "numero_ata, processo_administrativo, objeto, data_inicio_vigencia, data_fim_vigencia",
          )
          .eq("id", pedido.ata_id)
          .single(),
        supabase
          .from("fornecedores")
          .select("razao_social,cnpj")
          .eq("id", pedido.fornecedor_id)
          .single(),
        supabase
          .from("orgaos")
          .select("nome,sigla,cnpj")
          .eq("id", pedido.orgao_solicitante_id)
          .single(),
        supabase.from("itens_pedido").select("*").eq("pedido_id", pedidoId),
      ]);

      const itensCompletos = [];
      if (itensResult.data && itensResult.data.length > 0) {
        for (const item of itensResult.data) {
          const { data: itemAta } = await supabase
            .from("itens_ata")
            .select("descricao, item_numero")
            .eq("id", item.item_ata_id)
            .single();
          itensCompletos.push({
            ...item,
            descricao: itemAta?.descricao || "Descrição não encontrada",
            item_numero: itemAta?.item_numero || item.item_ata_id,
          });
        }
      }

      return {
        ...pedido,
        usuario: usuarioResult.data || { nome: "N/I" },
        ata: ataResult.data || {},
        fornecedor: fornecedorResult.data || {},
        orgao_solicitante: orgaoResult.data || {},
        itens_pedido: itensCompletos,
      };
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  // ============================================================
  // GERAR PDF DO PEDIDO
  // ============================================================
  async gerarPDFPedido(pedidoId) {
    try {
      const pedido = await this.carregarPedidoCompleto(pedidoId);
      if (!pedido) {
        this.sistema.ui.mostrarToast("erro", "Pedido não encontrado!");
        return;
      }

      const total = pedido.itens_pedido.reduce(
        (s, i) => s + (i.valor_total || 0),
        0,
      );
      this.sistema.pdfData = [
        {
          numeroPedido: pedido.numero_pedido,
          data: new Date(pedido.data_solicitacao).toLocaleDateString("pt-BR"),
          pedido: {
            fornecedorRazao: pedido.fornecedor?.razao_social,
            fornecedorCnpj: pedido.fornecedor?.cnpj,
            orgaoNome: pedido.orgao_solicitante?.nome,
            orgaoCnpj: pedido.orgao_solicitante?.cnpj,
            ataNumero: pedido.ata?.numero_ata,
            ataProcesso: pedido.ata?.processo_administrativo,
            ataObjeto: pedido.ata?.objeto,
            ataVigenciaInicio: pedido.ata?.data_inicio_vigencia,
            ataVigenciaFim: pedido.ata?.data_fim_vigencia,
            itens: pedido.itens_pedido.map((i) => ({
              itemNumero: i.item_numero,
              itemDescricao: i.descricao,
              quantidade: i.quantidade_solicitada,
              valorUnitario: i.valor_unitario,
              valorTotal: i.valor_total,
            })),
          },
          solicitante: pedido.usuario?.nome,
          orgao: pedido.orgao_solicitante?.nome,
          totalPedido: total,
          statusAprovacao: pedido.status_aprovacao || "AGUARDANDO_APROVACAO",
        },
      ];

      this.sistema.pedidos.baixarPDF();
    } catch (error) {
      this.sistema.ui.mostrarToast("erro", error.message);
    }
  }

  // ============================================================
  // ADICIONAR AO CARRINHO
  // ============================================================
  async adicionarAoCarrinho(ataId, itemId) {
    const qtdInput = document.getElementById(`qtd-${ataId}-${itemId}`);
    if (!qtdInput) return;

    const quantidade = parseInt(qtdInput.value);
    if (!quantidade || quantidade <= 0) {
      this.sistema.ui.mostrarToast("erro", "Quantidade inválida!");
      return;
    }

    const ata = this.sistema.ataSelecionada;
    const item = ata.itens.find((i) => i.id === itemId);
    if (!item) return;

    if (quantidade > (item.saldo_quantidade || 0)) {
      this.sistema.ui.mostrarToast(
        "erro",
        `Saldo insuficiente (${item.saldo_quantidade})!`,
      );
      return;
    }

    const numeroPedido = `PED-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000 + 1000))}`;
    this.sistema.carrinho.push({
      id: `${ataId}-${itemId}-${Date.now()}`,
      ataId: ata.id,
      ataNumero: ata.numero_ata,
      fornecedorId: ata.fornecedor_id,
      fornecedorRazao: ata.fornecedor?.razao_social,
      fornecedorCnpj: ata.fornecedor?.cnpj,
      processo: ata.processo_administrativo,
      objeto: ata.objeto,
      itemId: item.id,
      itemNumero: item.item_numero,
      itemDescricao: item.descricao,
      quantidade,
      valorUnitario: item.valor_unitario,
      valorTotal: item.valor_unitario * quantidade,
      numeroPedido,
      data: new Date().toISOString().split("T")[0],
      solicitante: this.sistema.usuarioAtual?.nome,
      orgaoId: this.sistema.usuarioAtual?.orgao_id,
    });

    qtdInput.value = "";
    this.sistema.salvarCarrinhoStorage();
    this.sistema.ui.mostrarToast("sucesso", "Item adicionado ao carrinho!");
  }

  // ============================================================
  // REMOVER ITEM DO CARRINHO
  // ============================================================
  removerDoCarrinho(itemId) {
    this.sistema.carrinho = this.sistema.carrinho.filter(
      (i) => i.id !== itemId,
    );
    this.sistema.salvarCarrinhoStorage();
    if (document.getElementById("drawerCarrinho")?.classList.contains("open")) {
      this.sistema.renderizarDrawerCarrinho();
    }
  }

  // ============================================================
  // LIMPAR CARRINHO
  // ============================================================
  limparCarrinho() {
    this.sistema.confirmar("Limpar carrinho?").then((confirmado) => {
      if (confirmado) {
        this.sistema.carrinho = [];
        this.sistema.salvarCarrinhoStorage();
        this.sistema.fecharModalCarrinho();
        if (
          document.getElementById("drawerCarrinho")?.classList.contains("open")
        ) {
          this.sistema.fecharDrawerCarrinho();
        }
        this.sistema.ui.mostrarToast("sucesso", "Carrinho limpo!");
      }
    });
  }

  // ============================================================
  // ABRIR CARRINHO
  // ============================================================
  abrirCarrinho() {
    window.location.href = "carrinho.html";
  }

  // ============================================================
  // GERAR PEDIDOS A PARTIR DO CARRINHO
  // ============================================================
  async gerarPedidos() {
    if (this.sistema.carrinho.length === 0) return;
    const pedidosPorAta = {};
    this.sistema.carrinho.forEach((item) => {
      if (!pedidosPorAta[item.ataId]) {
        pedidosPorAta[item.ataId] = {
          ataNumero: item.ataNumero,
          fornecedorId: item.fornecedorId,
          fornecedorRazao: item.fornecedorRazao,
          fornecedorCnpj: item.fornecedorCnpj,
          processo: item.processo,
          objeto: item.objeto,
          itens: [],
        };
      }
      pedidosPorAta[item.ataId].itens.push(item);
    });
    let pedidosHtml = "";
    const dataAtual = new Date().toISOString().split("T")[0];
    const dataExibicao = new Date().toLocaleDateString("pt-BR");
    this.sistema.pdfData = [];
    for (const [ataId, pedido] of Object.entries(pedidosPorAta)) {
      const totalPedido = pedido.itens.reduce((s, i) => s + i.valorTotal, 0);
      const numeroPedido = `PED-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}-${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
      this.sistema.pdfData.push({
        numeroPedido,
        data: dataExibicao,
        pedido,
        solicitante: this.sistema.usuarioAtual?.nome,
        orgao: this.sistema.usuarioAtual?.orgao?.nome,
        totalPedido,
      });
      try {
        const { data: pedidoData, error: pedidoError } = await supabase
          .from("pedidos")
          .insert({
            numero_pedido: numeroPedido,
            numero_requisicao: null,
            usuario_id: this.sistema.usuarioAtual.id,
            ata_id: parseInt(ataId),
            orgao_solicitante_id: this.sistema.usuarioAtual.orgao_id,
            fornecedor_id: pedido.fornecedorId,
            data_solicitacao: dataAtual,
            data_autorizacao: null,
            status: "PEDIDO_REALIZADO",
            observacoes: "Pedido gerado automaticamente via sistema",
            justificativa: null,
            valor_total: totalPedido,
            status_aprovacao: "AGUARDANDO_APROVACAO",
            aprovado_por: null,
            data_aprovacao: null,
            observacao_aprovacao: null,
          })
          .select()
          .single();
        if (pedidoError) throw pedidoError;
        for (const item of pedido.itens) {
          const itemData = {
            pedido_id: pedidoData.id,
            item_ata_id: item.itemId,
            quantidade_solicitada: item.quantidade,
            valor_unitario: item.valorUnitario,
            valor_total: item.valorTotal,
          };
          const { error: itemError } = await supabase
            .from("itens_pedido")
            .insert(itemData);
          if (itemError) throw itemError;
        }
      } catch (e) {
        console.error(e);
        this.sistema.ui.mostrarToast(
          "erro",
          "Erro ao gerar pedido: " + e.message,
        );
        return;
      }
      pedidosHtml += `
        <div class="pedido-container">
          <div class="pedido-header">
            <div>
              <h2 class="pedido-titulo">PEDIDO Nº ${numeroPedido}</h2>
              <p class="pedido-subtitulo" style="font-size:0.85rem;">${dataExibicao} | Ata: ${pedido.ataNumero}</p>
            </div>
            <span class="status-badge" style="background:var(--success-100);color:var(--success-800);font-size:0.75rem;"><i class="fas fa-check-circle"></i> PEDIDO REALIZADO</span>
          </div>
          <div class="pedido-info-grid">
            <div>
              <p style="font-weight:700;font-size:0.8rem;">FORNECEDOR</p>
              <p style="font-size:0.85rem;">${pedido.fornecedorRazao || ""}</p>
              <p style="font-size:0.75rem;">CNPJ: ${pedido.fornecedorCnpj || ""}</p>
            </div>
            <div>
              <p style="font-weight:700;font-size:0.8rem;">SOLICITANTE</p>
              <p style="font-size:0.85rem;">${this.sistema.usuarioAtual?.nome || ""}</p>
              <p style="font-size:0.75rem;">${this.sistema.usuarioAtual?.orgao?.nome || ""}</p>
            </div>
          </div>
          <h4 style="margin-bottom:12px;font-size:0.9rem;">Itens do Pedido</h4>
          <div class="tabela-container">
            <table style="width:100%;font-size:0.8rem;">
              <thead>
                <tr style="background:var(--neutral-800);color:white;">
                  <th style="padding:8px;">Item</th>
                  <th>Descrição</th>
                  <th>Qtd</th>
                  <th>Valor Unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                ${pedido.itens
                  .map(
                    (i) => `
                  <tr>
                    <td style="padding:6px 8px;">${i.itemNumero}</td>
                    <td>${i.itemDescricao}</td>
                    <td class="numeric">${i.quantidade}</td>
                    <td class="numeric">${this.sistema.ui.formatarMoeda(i.valorUnitario)}</td>
                    <td class="numeric">${this.sistema.ui.formatarMoeda(i.valorTotal)}</td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align:right;font-weight:700;padding:10px;">TOTAL</td>
                  <td style="color:var(--success-600);font-weight:700;text-align:right;">${this.sistema.ui.formatarMoeda(totalPedido)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }
    pedidosHtml += `
      <div style="display:flex;gap:10px;justify-content:flex-end;">
        <button class="btn" style="background:var(--neutral-200);padding:8px 16px;border:none;border-radius:var(--border-radius-md);font-size:0.85rem;" onclick="sistema.fecharModalPedido()">Fechar</button>
        <button class="btn-pdf" style="padding:8px 16px;font-size:0.85rem;" onclick="sistema.pedidos.visualizarPDF()"><i class="fas fa-file-pdf"></i> PDF</button>
      </div>
    `;
    document.getElementById("modalPedidoConteudo").innerHTML = pedidosHtml;
    this.sistema.fecharModalCarrinho();
    if (document.getElementById("drawerCarrinho")?.classList.contains("open")) {
      this.sistema.fecharDrawerCarrinho();
    }
    document.getElementById("modalPedido").classList.add("active");
    this.sistema.carrinho = [];
    this.sistema.salvarCarrinhoStorage();
    this.sistema.ui.mostrarToast("sucesso", "Pedido(s) gerado(s) com sucesso!");
    await this.carregarPedidos();
  }

  // ============================================================
  // VISUALIZAR PDF - PRÉVIA EM HTML (LAYOUT NOVO)
  // ============================================================
  visualizarPDF() {
    if (!this.sistema.pdfData?.length) {
      this.sistema.ui.mostrarToast("aviso", "Nenhum pedido");
      return;
    }

    const pdfHtml = this.sistema.pdfData
      .map((item) => this._montarHTMLPedidoPDF(item))
      .join("");

    document.getElementById("pdfConteudo").innerHTML = pdfHtml;
    document.getElementById("pdfVisualizador").classList.add("active");
  }

  // ============================================================
  // MONTAR HTML DO PEDIDO PARA PRÉVIA (LAYOUT NOVO)
  // ============================================================
  _montarHTMLPedidoPDF(item) {
    const pedido = item.pedido;
    const total = pedido.itens.reduce((s, i) => s + i.valorTotal, 0);
    const status = item.statusAprovacao || "AGUARDANDO_APROVACAO";

    const statusMap = {
      APROVADO: { label: "ATIVO", classe: "ativo" },
      AGUARDANDO_APROVACAO: { label: "PENDENTE", classe: "pendente" },
      REJEITADO: { label: "REJEITADO", classe: "rejeitado" },
      PEDIDO_REALIZADO: { label: "ATIVO", classe: "ativo" },
    };
    const statusInfo = statusMap[status] || statusMap["PEDIDO_REALIZADO"];

    const vigenciaTexto =
      pedido.ataVigenciaInicio && pedido.ataVigenciaFim
        ? `${this.sistema.ui.formatarData(pedido.ataVigenciaInicio)} até ${this.sistema.ui.formatarData(pedido.ataVigenciaFim)}`
        : "N/I";

    return `
      <div class="pdf-pagina pdf-pedido-page">

        <!-- ============================================ -->
        <!-- CABEÇALHO DO PEDIDO                         -->
        <!-- ============================================ -->
        <div class="pdf-header-pedido">
          <div class="pdf-header-left">
            <div class="pdf-header-icon">
              <i class="fas fa-file-invoice"></i>
            </div>
            <div class="pdf-header-titles">
              <h1>PEDIDO DE COMPRA</h1>
              <p>Sistema de Gestão de Atas</p>
            </div>
          </div>
          <div class="pdf-header-right">
            <div class="pdf-badge-numero">
              Nº ${item.numeroPedido}
            </div>
            <div class="pdf-header-meta">
              <div class="pdf-meta-item">
                <i class="far fa-calendar-alt"></i>
                <div>
                  <span class="pdf-meta-label">Data de Emissão</span>
                  <span class="pdf-meta-value">${item.data}</span>
                </div>
              </div>
              <div class="pdf-badge-status pdf-badge-${statusInfo.classe}">
                <i class="fas fa-check-circle"></i> ${statusInfo.label}
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================ -->
        <!-- SEÇÃO: DADOS DA ATA                         -->
        <!-- ============================================ -->
        <div class="pdf-secao-ata">
          <div class="pdf-secao-titulo">
            <span class="pdf-secao-icon"><i class="fas fa-file-alt"></i></span>
            <h2>DADOS DA ATA</h2>
          </div>
          <div class="pdf-ata-grid">
            <div class="pdf-ata-item">
              <span class="pdf-ata-label">Ata nº:</span>
              <span class="pdf-ata-value">${pedido.ataNumero || "N/I"}</span>
            </div>
            <div class="pdf-ata-item">
              <span class="pdf-ata-label">Processo:</span>
              <span class="pdf-ata-value">${pedido.ataProcesso || "N/I"}</span>
            </div>
            <div class="pdf-ata-item pdf-ata-item-objeto">
              <span class="pdf-ata-label">Objeto:</span>
              <span class="pdf-ata-value">${pedido.ataObjeto || "N/I"}</span>
            </div>
          </div>
          <div class="pdf-vigencia">
            <i class="far fa-calendar-alt"></i>
            <span class="pdf-vigencia-label">Vigência:</span>
            <span class="pdf-vigencia-value">${vigenciaTexto}</span>
          </div>
        </div>

        <!-- ============================================ -->
        <!-- CARDS: FORNECEDOR + SOLICITANTE             -->
        <!-- ============================================ -->
        <div class="pdf-cards-duplos">
          <div class="pdf-card-info">
            <div class="pdf-card-header">
              <span class="pdf-card-icon"><i class="fas fa-building"></i></span>
              <h3>FORNECEDOR</h3>
            </div>
            <div class="pdf-card-body">
              <div class="pdf-card-linha">
                <span class="pdf-card-label">Razão Social:</span>
                <span class="pdf-card-value">${pedido.fornecedorRazao || "N/I"}</span>
              </div>
              <div class="pdf-card-linha">
                <span class="pdf-card-label">CNPJ:</span>
                <span class="pdf-card-value">${pedido.fornecedorCnpj || "N/I"}</span>
              </div>
            </div>
          </div>
          <div class="pdf-card-info">
            <div class="pdf-card-header">
              <span class="pdf-card-icon"><i class="fas fa-user"></i></span>
              <h3>SOLICITANTE</h3>
            </div>
            <div class="pdf-card-body">
              <div class="pdf-card-linha">
                <span class="pdf-card-label">Órgão:</span>
                <span class="pdf-card-value">${pedido.orgaoNome || "N/I"}</span>
              </div>
              <div class="pdf-card-linha">
                <span class="pdf-card-label">CNPJ:</span>
                <span class="pdf-card-value">${pedido.orgaoCnpj || "N/I"}</span>
              </div>
              <div class="pdf-card-linha">
                <span class="pdf-card-label">Solicitante:</span>
                <span class="pdf-card-value">${item.solicitante || "N/I"}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ============================================ -->
        <!-- TABELA DE ITENS                             -->
        <!-- ============================================ -->
        <table class="pdf-tabela-itens">
          <thead>
            <tr>
              <th style="width: 8%;">Item</th>
              <th style="width: 52%;">Descrição</th>
              <th style="width: 10%; text-align: center;">Qtd</th>
              <th style="width: 15%; text-align: right;">Valor Unit.</th>
              <th style="width: 15%; text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${pedido.itens
              .map(
                (i) => `
              <tr>
                <td style="text-align: center;">${i.itemNumero}</td>
                <td>${i.itemDescricao}</td>
                <td style="text-align: center;">${i.quantidade}</td>
                <td style="text-align: right;">${this.sistema.ui.formatarMoeda(i.valorUnitario).replace("R$", "").trim()}</td>
                <td style="text-align: right;">${this.sistema.ui.formatarMoeda(i.valorTotal).replace("R$", "").trim()}</td>
              </tr>
            `,
              )
              .join("")}
          </tbody>
        </table>

        <!-- ============================================ -->
        <!-- LINHA TOTAL DO PEDIDO                       -->
        <!-- ============================================ -->
        <div class="pdf-total-row">
          <span class="pdf-total-label">TOTAL DO PEDIDO</span>
          <span class="pdf-total-badge">
            R$ ${this.sistema.ui.formatarMoeda(total).replace("R$", "").trim()}
          </span>
        </div>

        <!-- ============================================ -->
        <!-- INFORMAÇÕES IMPORTANTES                     -->
        <!-- ============================================ -->
        <div class="pdf-info-importantes">
          <div class="pdf-info-icon">
            <i class="fas fa-info-circle"></i>
          </div>
          <div class="pdf-info-content">
            <h4>INFORMAÇÕES IMPORTANTES</h4>
            <ul>
              <li>Este documento foi gerado eletronicamente pelo Sistema de Gestão de Atas.</li>
              <li>É de responsabilidade do solicitante a conferência dos dados e saldos apresentados.</li>
              <li>Em caso de divergência, prevalecem os dados constantes no processo administrativo e na ata de registro de preços.</li>
            </ul>
          </div>
        </div>

        <!-- ============================================ -->
        <!-- RODAPÉ FINAL                                -->
        <!-- ============================================ -->
        <div class="pdf-rodape-final">
          <p>Sistema desenvolvido pelo Departamento de Informática - Versão 1.0</p>
        </div>

      </div>
    `;
  }

  // ============================================================
  // BAIXAR PDF - LAYOUT NOVO (ESPELHA A PRÉVIA HTML)
  // ============================================================
  baixarPDF() {
    if (!this.sistema.pdfData || this.sistema.pdfData.length === 0) {
      this.sistema.ui.mostrarToast("aviso", "Nenhum dado para gerar PDF");
      return;
    }

    // Validação defensiva: garante que a biblioteca jsPDF foi carregada
    if (typeof window.jspdf === "undefined" || !window.jspdf.jsPDF) {
      console.error("❌ Biblioteca jsPDF não carregada.");
      this.sistema.ui.mostrarToast(
        "erro",
        "Biblioteca PDF não carregada",
        "Recarregue a página (Ctrl+F5). Se persistir, contate o suporte.",
      );
      return;
    }

    if (typeof window.jspdf.jsPDF.API.autoTable === "undefined") {
      console.warn(
        "⚠️ jspdf-autotable não detectado. Gerando PDF sem tabela estilizada.",
      );
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const marginLeft = 15;
      const marginRight = 15;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // Cores institucionais (RGB)
      const COR_AZUL_ESCURO = [26, 58, 107]; // #1a3a6b
      const COR_AZUL_MEDIO = [37, 99, 235]; // #2563eb
      const COR_AZUL_CLARO_BG = [235, 244, 255]; // #ebf4ff
      const COR_AZUL_CLARO_BORDA = [191, 219, 254]; // #bfdbfe
      const COR_VERDE = [22, 163, 74]; // #16a34a
      const COR_VERDE_BG = [220, 252, 231]; // #dcfce7
      const COR_CINZA_TEXTO = [71, 85, 105]; // #475569
      const COR_CINZA_LABEL = [100, 116, 139]; // #64748b
      const COR_CINZA_BORDA = [226, 232, 240]; // #e2e8f0
      const COR_BRANCO = [255, 255, 255];

      this.sistema.pdfData.forEach((item, idx) => {
        if (idx > 0) {
          doc.addPage();
        }

        let y = 15;
        const pedido = item.pedido;
        const total = pedido.itens.reduce((s, i) => s + i.valorTotal, 0);
        const status = item.statusAprovacao || "AGUARDANDO_APROVACAO";

        const statusMap = {
          APROVADO: { label: "ATIVO", cor: COR_VERDE, bg: COR_VERDE_BG },
          PEDIDO_REALIZADO: {
            label: "ATIVO",
            cor: COR_VERDE,
            bg: COR_VERDE_BG,
          },
          AGUARDANDO_APROVACAO: {
            label: "PENDENTE",
            cor: [217, 119, 6],
            bg: [254, 243, 199],
          },
          REJEITADO: {
            label: "REJEITADO",
            cor: [220, 38, 38],
            bg: [254, 226, 226],
          },
        };
        const statusInfo = statusMap[status] || statusMap["PEDIDO_REALIZADO"];

        // =====================================================
        // CABEÇALHO
        // =====================================================

        // Ícone de documento (retângulo azul com "DOC")
        doc.setFillColor(...COR_AZUL_ESCURO);
        doc.roundedRect(marginLeft, y, 14, 18, 1.5, 1.5, "F");
        doc.setTextColor(...COR_BRANCO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("DOC", marginLeft + 7, y + 10, { align: "center" });

        // Título
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("PEDIDO DE COMPRA", marginLeft + 20, y + 8);

        // Subtítulo
        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("Sistema de Gestão de Atas", marginLeft + 20, y + 15);

        // Badge azul com número do pedido (direita)
        const badgeNumeroWidth = 70;
        const badgeNumeroX = pageWidth - marginRight - badgeNumeroWidth;
        doc.setFillColor(...COR_AZUL_ESCURO);
        doc.roundedRect(badgeNumeroX, y, badgeNumeroWidth, 9, 1.5, 1.5, "F");
        doc.setTextColor(...COR_BRANCO);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Nº ${item.numeroPedido}`, badgeNumeroX + 3, y + 6);

        // Data de emissão
        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Data de Emissão", badgeNumeroX, y + 15);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(item.data, badgeNumeroX, y + 21);

        // Badge de status (verde)
        const badgeStatusWidth = 22;
        const badgeStatusX = pageWidth - marginRight - badgeStatusWidth;
        doc.setFillColor(...statusInfo.bg);
        doc.roundedRect(
          badgeStatusX,
          y + 14,
          badgeStatusWidth,
          7,
          3.5,
          3.5,
          "F",
        );
        doc.setTextColor(...statusInfo.cor);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text(
          statusInfo.label,
          badgeStatusX + badgeStatusWidth / 2,
          y + 19,
          {
            align: "center",
          },
        );

        y += 26;

        // Linha separadora
        doc.setDrawColor(...COR_CINZA_BORDA);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, y, pageWidth - marginRight, y);
        y += 6;

        // =====================================================
        // SEÇÃO: DADOS DA ATA
        // =====================================================
        const secaoAtaY = y;
        const secaoAtaHeight = 40;

        // Fundo da seção (azul claro)
        doc.setFillColor(...COR_AZUL_CLARO_BG);
        doc.roundedRect(
          marginLeft,
          secaoAtaY,
          contentWidth,
          secaoAtaHeight,
          1.5,
          1.5,
          "F",
        );

        // Título da seção
        doc.setFillColor(...COR_AZUL_ESCURO);
        doc.roundedRect(marginLeft + 3, secaoAtaY + 3, 7, 7, 1, 1, "F");
        doc.setTextColor(...COR_BRANCO);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text("i", marginLeft + 6.5, secaoAtaY + 8, { align: "center" });

        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("DADOS DA ATA", marginLeft + 13, secaoAtaY + 8.5);

        // Grid 3 colunas
        const gridY = secaoAtaY + 15;
        const colWidth = contentWidth / 3;

        // Coluna 1: Ata nº
        doc.setTextColor(...COR_AZUL_MEDIO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Ata nº:", marginLeft + 5, gridY);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(pedido.ataNumero || "N/I", marginLeft + 5, gridY + 5);

        // Coluna 2: Processo
        doc.setTextColor(...COR_AZUL_MEDIO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Processo:", marginLeft + 5 + colWidth, gridY);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
          pedido.ataProcesso || "N/I",
          marginLeft + 5 + colWidth,
          gridY + 5,
        );

        // Coluna 3: Objeto
        doc.setTextColor(...COR_AZUL_MEDIO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Objeto:", marginLeft + 5 + colWidth * 2, gridY);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const objetoTexto = pedido.ataObjeto || "N/I";
        const objetoLinhas = doc.splitTextToSize(objetoTexto, colWidth - 8);
        doc.text(
          objetoLinhas.slice(0, 2),
          marginLeft + 5 + colWidth * 2,
          gridY + 5,
        );

        // Vigência
        const vigenciaY = gridY + 14;
        doc.setTextColor(...COR_AZUL_MEDIO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.text("Vigência:", marginLeft + 5, vigenciaY);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const vigIni = pedido.ataVigenciaInicio
          ? this.sistema.ui.formatarData(pedido.ataVigenciaInicio)
          : "N/I";
        const vigFim = pedido.ataVigenciaFim
          ? this.sistema.ui.formatarData(pedido.ataVigenciaFim)
          : "N/I";
        doc.text(`${vigIni} até ${vigFim}`, marginLeft + 22, vigenciaY);

        y = secaoAtaY + secaoAtaHeight + 5;

        // =====================================================
        // CARDS: FORNECEDOR + SOLICITANTE
        // =====================================================
        const cardHeight = 30;
        const cardWidth = (contentWidth - 5) / 2;

        // --- Card Fornecedor ---
        const card1X = marginLeft;
        doc.setFillColor(...COR_BRANCO);
        doc.setDrawColor(...COR_CINZA_BORDA);
        doc.setLineWidth(0.3);
        doc.roundedRect(card1X, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

        // Fundo do header
        doc.setFillColor(...COR_AZUL_CLARO_BG);
        doc.roundedRect(card1X, y, cardWidth, 8, 1.5, 1.5, "F");

        // Ícone
        doc.setFillColor(...COR_AZUL_ESCURO);
        doc.roundedRect(card1X + 3, y + 1.5, 5, 5, 0.8, 0.8, "F");
        doc.setTextColor(...COR_BRANCO);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text("F", card1X + 5.5, y + 5, { align: "center" });

        // Título
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("FORNECEDOR", card1X + 10, y + 5.5);

        // Corpo
        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Razão Social:", card1X + 3, y + 13);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        const razaoLinhas = doc.splitTextToSize(
          pedido.fornecedorRazao || "N/I",
          cardWidth - 6,
        );
        doc.text(razaoLinhas.slice(0, 2), card1X + 3, y + 17);

        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("CNPJ:", card1X + 3, y + 25);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(pedido.fornecedorCnpj || "N/I", card1X + 15, y + 25);

        // --- Card Solicitante ---
        const card2X = marginLeft + cardWidth + 5;
        doc.setFillColor(...COR_BRANCO);
        doc.setDrawColor(...COR_CINZA_BORDA);
        doc.setLineWidth(0.3);
        doc.roundedRect(card2X, y, cardWidth, cardHeight, 1.5, 1.5, "FD");

        // Fundo do header
        doc.setFillColor(...COR_AZUL_CLARO_BG);
        doc.roundedRect(card2X, y, cardWidth, 8, 1.5, 1.5, "F");

        // Ícone
        doc.setFillColor(...COR_AZUL_ESCURO);
        doc.roundedRect(card2X + 3, y + 1.5, 5, 5, 0.8, 0.8, "F");
        doc.setTextColor(...COR_BRANCO);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.text("S", card2X + 5.5, y + 5, { align: "center" });

        // Título
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("SOLICITANTE", card2X + 10, y + 5.5);

        // Corpo
        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Órgão:", card2X + 3, y + 13);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const orgaoLinhas = doc.splitTextToSize(
          pedido.orgaoNome || "N/I",
          cardWidth - 20,
        );
        doc.text(orgaoLinhas.slice(0, 1), card2X + 15, y + 13);

        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("CNPJ:", card2X + 3, y + 19);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(pedido.orgaoCnpj || "N/I", card2X + 15, y + 19);

        doc.setTextColor(...COR_CINZA_LABEL);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("Solicitante:", card2X + 3, y + 25);
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(item.solicitante || "N/I", card2X + 22, y + 25);

        y += cardHeight + 6;

        // =====================================================
        // TABELA DE ITENS
        // =====================================================
        const tableData = pedido.itens.map((i) => [
          i.itemNumero,
          i.itemDescricao,
          i.quantidade.toString(),
          this.sistema.ui
            .formatarMoeda(i.valorUnitario)
            .replace("R$", "")
            .trim(),
          this.sistema.ui.formatarMoeda(i.valorTotal).replace("R$", "").trim(),
        ]);

        doc.autoTable({
          startY: y,
          head: [["Item", "Descrição", "Qtd", "Valor Unit.", "Total"]],
          body: tableData,
          theme: "grid",
          headStyles: {
            fillColor: COR_AZUL_ESCURO,
            textColor: COR_BRANCO,
            fontSize: 9,
            fontStyle: "bold",
            halign: "left",
          },
          bodyStyles: {
            fontSize: 9,
            textColor: COR_AZUL_ESCURO,
            cellPadding: 3,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: contentWidth * 0.08, halign: "center" },
            1: { cellWidth: contentWidth * 0.52, halign: "left" },
            2: { cellWidth: contentWidth * 0.1, halign: "center" },
            3: { cellWidth: contentWidth * 0.15, halign: "right" },
            4: { cellWidth: contentWidth * 0.15, halign: "right" },
          },
          styles: {
            lineColor: COR_CINZA_BORDA,
            lineWidth: 0.2,
          },
          margin: { left: marginLeft, right: marginRight },
        });

        y = doc.lastAutoTable.finalY + 4;

        // =====================================================
        // LINHA TOTAL DO PEDIDO
        // =====================================================
        const totalRowHeight = 12;
        doc.setFillColor(...COR_AZUL_CLARO_BG);
        doc.roundedRect(
          marginLeft,
          y,
          contentWidth,
          totalRowHeight,
          1.5,
          1.5,
          "F",
        );

        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("TOTAL DO PEDIDO", pageWidth - marginRight - 55, y + 7.5, {
          align: "right",
        });

        // Badge azul escuro com valor
        const totalBadgeWidth = 42;
        const totalBadgeX = pageWidth - marginRight - totalBadgeWidth - 2;
        doc.setFillColor(...COR_AZUL_ESCURO);
        doc.roundedRect(
          totalBadgeX,
          y + 1,
          totalBadgeWidth,
          totalRowHeight - 2,
          1.5,
          1.5,
          "F",
        );
        doc.setTextColor(...COR_BRANCO);
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text(
          `R$ ${this.sistema.ui.formatarMoeda(total).replace("R$", "").trim()}`,
          totalBadgeX + totalBadgeWidth / 2,
          y + 8.5,
          { align: "center" },
        );

        y += totalRowHeight + 6;

        // =====================================================
        // INFORMAÇÕES IMPORTANTES
        // =====================================================
        const infoHeight = 30;
        doc.setFillColor(...COR_AZUL_CLARO_BG);
        doc.roundedRect(marginLeft, y, contentWidth, infoHeight, 1.5, 1.5, "F");

        // Ícone circular
        doc.setDrawColor(...COR_AZUL_ESCURO);
        doc.setLineWidth(0.5);
        doc.circle(marginLeft + 8, y + 15, 4, "S");
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("i", marginLeft + 8, y + 16.5, { align: "center" });

        // Título
        doc.setTextColor(...COR_AZUL_ESCURO);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("INFORMAÇÕES IMPORTANTES", marginLeft + 16, y + 7);

        // Itens
        doc.setTextColor(...COR_CINZA_TEXTO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const bullets = [
          "Este documento foi gerado eletronicamente pelo Sistema de Gestão de Atas.",
          "É de responsabilidade do solicitante a conferência dos dados e saldos apresentados.",
          "Em caso de divergência, prevalecem os dados constantes no processo administrativo e na ata de registro de preços.",
        ];
        let bulletY = y + 13;
        bullets.forEach((b) => {
          doc.circle(marginLeft + 17, bulletY - 1, 0.6, "F");
          const linhas = doc.splitTextToSize(b, contentWidth - 25);
          doc.text(linhas, marginLeft + 20, bulletY);
          bulletY += linhas.length * 3.5 + 1;
        });

        y += infoHeight + 6;

        // =====================================================
        // RODAPÉ FINAL
        // =====================================================
        doc.setDrawColor(...COR_CINZA_BORDA);
        doc.setLineWidth(0.3);
        doc.line(marginLeft, y, pageWidth - marginRight, y);

        doc.setTextColor(...COR_AZUL_MEDIO);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text(
          "Sistema desenvolvido pelo Departamento de Informática - Versão 1.0",
          pageWidth / 2,
          y + 5,
          { align: "center" },
        );
      });

      const dataAtual = new Date()
        .toLocaleDateString("pt-BR")
        .replace(/\//g, "-");
      doc.save(`pedido_${dataAtual}.pdf`);
      this.sistema.ui.mostrarToast("sucesso", "PDF gerado com sucesso!");
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        "Erro ao gerar PDF",
        error.message || "Erro desconhecido ao gerar PDF.",
      );
    }
  }

  // ============================================================
  // MÉTODOS AUXILIARES PARA O DASHBOARD
  // ============================================================
  async getPedidosPendentes(limit = 5) {
    try {
      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero_pedido, valor_total, data_solicitacao, usuario_id, ata_id",
        )
        .eq("status_aprovacao", "AGUARDANDO_APROVACAO")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!pedidos || pedidos.length === 0) return [];

      const userIds = pedidos.map((p) => p.usuario_id).filter(Boolean);
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id, nome")
        .in("id", userIds);
      const usuarioMap = {};
      usuarios?.forEach((u) => (usuarioMap[u.id] = u.nome));

      const ataIds = pedidos.map((p) => p.ata_id).filter(Boolean);
      const { data: atas } = await supabase
        .from("atas")
        .select("id, numero_ata")
        .in("id", ataIds);
      const ataMap = {};
      atas?.forEach((a) => (ataMap[a.id] = a.numero_ata));

      return pedidos.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido || "N/I",
        valor: p.valor_total || 0,
        data: p.data_solicitacao,
        usuario: usuarioMap[p.usuario_id] || "Usuário",
        ata: ataMap[p.ata_id] || "N/I",
      }));
    } catch (error) {
      console.error("Erro ao buscar pedidos pendentes:", error);
      return [];
    }
  }

  async getAtividadesRecentes(limit = 5) {
    try {
      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero_pedido, status_aprovacao, created_at, usuario_id, ata_id",
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!pedidos || pedidos.length === 0) return [];

      const userIds = pedidos.map((p) => p.usuario_id).filter(Boolean);
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id, nome")
        .in("id", userIds);
      const usuarioMap = {};
      usuarios?.forEach((u) => (usuarioMap[u.id] = u.nome));

      const ataIds = pedidos.map((p) => p.ata_id).filter(Boolean);
      const { data: atas } = await supabase
        .from("atas")
        .select("id, numero_ata")
        .in("id", ataIds);
      const ataMap = {};
      atas?.forEach((a) => (ataMap[a.id] = a.numero_ata));

      return pedidos.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido || "N/I",
        status: p.status_aprovacao || "PEDIDO_REALIZADO",
        data: p.created_at,
        usuario: usuarioMap[p.usuario_id] || "Usuário",
        ata: ataMap[p.ata_id] || "N/I",
      }));
    } catch (error) {
      console.error("Erro ao buscar atividades recentes:", error);
      return [];
    }
  }

  async getTimelineAtividades(limit = 15) {
    try {
      const atividades = [];

      const { data: pedidos, error: pedError } = await supabase
        .from("pedidos")
        .select(
          "id, numero_pedido, status_aprovacao, created_at, usuario_id, ata_id",
        )
        .order("created_at", { ascending: false })
        .limit(10);

      if (pedError) throw pedError;

      const userIds = pedidos?.map((p) => p.usuario_id).filter(Boolean) || [];
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id, nome")
        .in("id", userIds);
      const usuarioMap = {};
      usuarios?.forEach((u) => (usuarioMap[u.id] = u.nome));

      const pedidoAtaIds = pedidos?.map((p) => p.ata_id).filter(Boolean) || [];
      const { data: atasPedidos } = await supabase
        .from("atas")
        .select("id, numero_ata")
        .in("id", pedidoAtaIds);
      const ataMap = {};
      atasPedidos?.forEach((a) => (ataMap[a.id] = a.numero_ata));

      pedidos?.forEach((p) => {
        const data = new Date(p.created_at);
        const statusMap = {
          APROVADO: {
            icon: "success",
            iconClass: "fa-check-circle",
            label: "Aprovado",
          },
          REJEITADO: {
            icon: "danger",
            iconClass: "fa-times-circle",
            label: "Rejeitado",
          },
          AGUARDANDO_APROVACAO: {
            icon: "warning",
            iconClass: "fa-clock",
            label: "Aguardando",
          },
          PEDIDO_REALIZADO: {
            icon: "info",
            iconClass: "fa-file-invoice",
            label: "Realizado",
          },
        };
        const statusInfo =
          statusMap[p.status_aprovacao] || statusMap["PEDIDO_REALIZADO"];

        atividades.push({
          id: `pedido-${p.id}`,
          data: data,
          tipo: "pedido",
          titulo: `Pedido ${p.numero_pedido || "N/I"}`,
          descricao: `${statusInfo.label} · Ata ${ataMap[p.ata_id] || "N/I"}`,
          usuario: usuarioMap[p.usuario_id] || "Usuário",
          icon: statusInfo.icon,
          iconClass: statusInfo.iconClass,
          status: p.status_aprovacao,
        });
      });

      const { data: aditivos, error: aditError } = await supabase
        .from("aditivos_ata")
        .select("id, numero_aditivo, created_at, ata_original_id")
        .order("created_at", { ascending: false })
        .limit(5);

      if (aditError) throw aditError;

      const aditivoAtaIds =
        aditivos?.map((a) => a.ata_original_id).filter(Boolean) || [];
      const { data: atasAditivos } = await supabase
        .from("atas")
        .select("id, numero_ata")
        .in("id", aditivoAtaIds);
      const ataAditivoMap = {};
      atasAditivos?.forEach((a) => (ataAditivoMap[a.id] = a.numero_ata));

      aditivos?.forEach((a) => {
        const data = new Date(a.created_at);
        atividades.push({
          id: `aditivo-${a.id}`,
          data: data,
          tipo: "aditivo",
          titulo: `Aditivo ${a.numero_aditivo || "N/I"}`,
          descricao: `Ata ${ataAditivoMap[a.ata_original_id] || "N/I"}`,
          usuario: "Sistema",
          icon: "info",
          iconClass: "fa-file-contract",
          status: null,
        });
      });

      const { data: atas, error: atasError } = await supabase
        .from("atas")
        .select("id, numero_ata, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (atasError) throw atasError;

      atas?.forEach((a) => {
        const data = new Date(a.created_at);
        atividades.push({
          id: `ata-${a.id}`,
          data: data,
          tipo: "ata",
          titulo: `Ata ${a.numero_ata || "N/I"}`,
          descricao: "Cadastrada no sistema",
          usuario: "Sistema",
          icon: "info",
          iconClass: "fa-file-contract",
          status: null,
        });
      });

      atividades.sort((a, b) => b.data - a.data);
      return atividades.slice(0, limit);
    } catch (error) {
      console.error("Erro ao buscar timeline de atividades:", error);
      return [];
    }
  }
}

// ============================================================
// EXPORTAÇÃO DE MÉTODOS GLOBAIS PARA USO NO HTML
// ============================================================
if (typeof window !== "undefined") {
  window.fecharModalMotivoRejeicao = function () {
    const modal = document.getElementById("modalMotivoRejeicao");
    if (modal) modal.classList.remove("active");
    const textarea = document.getElementById("motivoRejeicao");
    if (textarea) textarea.value = "";
    const charCount = document.getElementById("charCount");
    if (charCount) {
      charCount.textContent = "0";
      charCount.className = "count";
    }
    const btn = document.getElementById("btnConfirmarRejeicao");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML =
        '<i class="fas fa-exclamation-triangle"></i> Rejeitar Pedido';
    }
  };

  window.fecharModalVisualizarMotivo = function () {
    const modal = document.getElementById("modalVisualizarMotivo");
    if (modal) modal.classList.remove("active");
  };

  window.confirmarRejeicao = async function () {
    const textarea = document.getElementById("motivoRejeicao");
    const justificativa = textarea?.value?.trim();

    if (!justificativa) {
      alert("Por favor, informe o motivo da rejeição.");
      textarea?.focus();
      return;
    }

    if (justificativa.length < 10) {
      alert("O motivo deve ter pelo menos 10 caracteres.");
      textarea?.focus();
      return;
    }

    const btn = document.getElementById("btnConfirmarRejeicao");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    try {
      const pedidoId = window._pedidoRejeicaoId;
      if (!pedidoId) {
        alert("Erro: Pedido não identificado.");
        return;
      }

      const sistema = window.sistema;
      if (!sistema || !sistema.usuarioAtual) {
        alert("Erro: Usuário não autenticado.");
        return;
      }

      const { error } = await supabase
        .from("pedidos")
        .update({
          status_aprovacao: "REJEITADO",
          aprovado_por: sistema.usuarioAtual.id,
          data_aprovacao: new Date().toISOString().split("T")[0],
          observacao_aprovacao: justificativa,
        })
        .eq("id", pedidoId);

      if (error) throw error;

      window.fecharModalMotivoRejeicao();

      if (sistema && sistema.pedidos) {
        await sistema.pedidos.carregarPedidos();
      }

      if (sistema && sistema.ui) {
        sistema.ui.mostrarToast(
          "sucesso",
          "Pedido rejeitado",
          "O pedido foi rejeitado com sucesso.",
        );
      } else {
        alert("Pedido rejeitado com sucesso!");
      }
    } catch (error) {
      alert("Erro ao rejeitar pedido: " + error.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML =
          '<i class="fas fa-exclamation-triangle"></i> Rejeitar Pedido';
      }
    }
  };
}
