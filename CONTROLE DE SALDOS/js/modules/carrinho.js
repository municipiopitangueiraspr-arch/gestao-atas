// ============================================
// CONTROLE DE SALDOS/js/modules/carrinho.js
// Módulo do Carrinho — versão SPA integrada ao
// layout compartilhado (shared/js/layout.js).
//
// Substitui js/modules/carrinho-page.js (que era
// uma página standalone). Aqui o carrinho é uma
// VIEW do sistema, renderizada dentro de
// <div id="carrinhoContent"> em gestaoatas.html.
//
// Regras mantidas da versão original:
//   · Pedido sempre nasce como AGUARDANDO_APROVACAO
//   · Um pedido por ATA (agrupamento por ataId)
//   · Carrinho persistido em localStorage via
//     sistema.salvarCarrinhoStorage()
// ============================================

import { supabase } from "../supabase.js";

export class Carrinho {
  constructor(sistema) {
    this.sistema = sistema;
  }

  // ============================================================
  // CARREGAR CONTEÚDO DA VIEW
  // Chamado por sistema.ativarTab("carrinho")
  // ============================================================
  async carregarConteudo() {
    const container = document.getElementById("carrinhoContent");
    if (!container) {
      console.warn(
        "[Carrinho] #carrinhoContent não encontrado em gestaoatas.html.",
      );
      return;
    }

    // Renderiza a estrutura base da view
    container.innerHTML = this.gerarHTML();

    // Relê o carrinho do localStorage (garante dados atualizados)
    this.sistema.carregarCarrinhoStorage();

    // Configura eventos dos botões da view
    this.configurarEventos();

    // Renderiza o estado atual (vazio ou itens)
    this.renderizar();
  }

  // ============================================================
  // HTML BASE DA VIEW
  // ============================================================
  gerarHTML() {
    return `
      <div class="carrinho-view">
        <!-- Breadcrumb -->
        <div class="breadcrumb-carrinho">
          <a href="#consulta" id="breadcrumbInicio">Início</a>
          <span class="separator">/</span>
          <span class="current">Meu Carrinho</span>
          <span
            style="
              margin-left: auto;
              font-size: 0.8rem;
              color: var(--neutral-400);
            "
          >
            <i class="fas fa-shopping-cart"></i>
            <span id="qtdItensCarrinho">0</span> itens
          </span>
        </div>

        <!-- Loading (oculto por padrão — load é instantâneo do storage) -->
        <div class="loading-container" id="carrinhoLoading" style="display: none">
          <div class="loading-spinner"></div>
          <p>Processando…</p>
        </div>

        <!-- Conteúdo -->
        <div id="carrinhoViewContent">
          <!-- Carrinho vazio -->
          <div class="carrinho-empty" id="carrinhoEmpty" style="display: none">
            <div class="empty-icon">
              <i class="fas fa-shopping-cart"></i>
            </div>
            <h2>Seu carrinho está vazio</h2>
            <p>
              Navegue pelas atas disponíveis e adicione os itens que você precisa.
            </p>
            <button class="btn-continuar-comprando" id="btnContinuarComprando">
              <i class="fas fa-store"></i> Continuar Comprando
            </button>
          </div>

          <!-- Itens do carrinho -->
          <div id="carrinhoItems" style="display: none">
            <div id="itensCarrinhoLista"></div>

            <div class="carrinho-resumo">
              <div class="carrinho-resumo-left">
                <div class="total-itens">
                  <strong id="totalItensCarrinho">0</strong> item(ns) no carrinho
                </div>
              </div>
              <div class="carrinho-total">
                <span class="total-label">Total:</span>
                <span class="carrinho-total-value" id="carrinhoTotal"
                  >R$ 0,00</span
                >
              </div>
              <div class="carrinho-actions">
                <button class="btn-limpar-carrinho" id="btnLimparCarrinho">
                  <i class="fas fa-trash-alt"></i> Limpar Carrinho
                </button>
                <button class="btn-finalizar-pedido" id="btnFinalizarPedido">
                  <i class="fas fa-check-circle"></i> Finalizar Pedido
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================
  // CONFIGURAÇÃO DE EVENTOS
  // ============================================================
  configurarEventos() {
    // Botão "Continuar Comprando" — navega para a view de consulta
    const btnContinuar = document.getElementById("btnContinuarComprando");
    if (btnContinuar) {
      btnContinuar.addEventListener("click", () => {
        this.sistema.ativarTab("consulta");
      });
    }

    // Link "Início" do breadcrumb — navega para a view de consulta
    const breadcrumbInicio = document.getElementById("breadcrumbInicio");
    if (breadcrumbInicio) {
      breadcrumbInicio.addEventListener("click", (e) => {
        e.preventDefault();
        this.sistema.ativarTab("consulta");
      });
    }

    // Botão "Limpar Carrinho"
    const btnLimpar = document.getElementById("btnLimparCarrinho");
    if (btnLimpar) {
      btnLimpar.addEventListener("click", () => this.limparCarrinho());
    }

    // Botão "Finalizar Pedido"
    const btnFinalizar = document.getElementById("btnFinalizarPedido");
    if (btnFinalizar) {
      btnFinalizar.addEventListener("click", () => this.finalizarPedido());
    }
  }

  // ============================================================
  // RENDERIZAÇÃO PRINCIPAL
  // ============================================================
  renderizar() {
    const carrinho = this.sistema.carrinho || [];

    // Atualiza contadores
    const qtdItens = document.getElementById("qtdItensCarrinho");
    if (qtdItens) qtdItens.textContent = carrinho.length;

    const totalItens = document.getElementById("totalItensCarrinho");
    if (totalItens) totalItens.textContent = carrinho.length;

    const empty = document.getElementById("carrinhoEmpty");
    const items = document.getElementById("carrinhoItems");

    // Estado vazio
    if (carrinho.length === 0) {
      if (empty) empty.style.display = "flex";
      if (items) items.style.display = "none";
      return;
    }

    // Estado com itens
    if (empty) empty.style.display = "none";
    if (items) items.style.display = "block";

    this.renderizarGrupos();
  }

  // ============================================================
  // RENDERIZA OS GRUPOS DE ITENS (UM BLOCO POR ATA)
  // ============================================================
  renderizarGrupos() {
    const lista = document.getElementById("itensCarrinhoLista");
    if (!lista) return;

    const carrinho = this.sistema.carrinho || [];

    // Agrupar itens por ata
    const pedidosPorAta = {};
    carrinho.forEach((item) => {
      if (!pedidosPorAta[item.ataId]) {
        pedidosPorAta[item.ataId] = {
          ataNumero: item.ataNumero || "N/I",
          fornecedorRazao: item.fornecedorRazao || "",
          itens: [],
        };
      }
      pedidosPorAta[item.ataId].itens.push(item);
    });

    let html = "";
    let totalGeral = 0;

    for (const [, pedido] of Object.entries(pedidosPorAta)) {
      const totalAta = pedido.itens.reduce(
        (s, i) => s + (i.valorTotal || 0),
        0,
      );
      totalGeral += totalAta;

      html += `
        <div class="carrinho-grupo-ata">
          <div class="carrinho-grupo-header">
            <span class="carrinho-grupo-titulo">
              <i class="fas fa-file-contract"></i> Ata ${pedido.ataNumero}
            </span>
            <span class="carrinho-grupo-fornecedor">
              <i class="fas fa-building"></i> ${pedido.fornecedorRazao || ""}
            </span>
          </div>
          <div class="tabela-container">
            <table class="tabela-carrinho">
              <thead>
                <tr>
                  <th style="width: 60px;">Item</th>
                  <th>Descrição</th>
                  <th style="width: 80px; text-align: right;">Qtd</th>
                  <th style="width: 120px; text-align: right;">Valor Unit.</th>
                  <th style="width: 130px; text-align: right;">Total</th>
                  <th style="width: 50px; text-align: center;">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${pedido.itens
                  .map(
                    (i) => `
                  <tr>
                    <td class="item-numero">${i.itemNumero || "-"}</td>
                    <td class="item-descricao">${i.itemDescricao || "Item"}</td>
                    <td class="numeric">${i.quantidade || 0}</td>
                    <td class="numeric">${this.sistema.ui.formatarMoeda(
                      i.valorUnitario || 0,
                    )}</td>
                    <td class="numeric item-total">${this.sistema.ui.formatarMoeda(
                      i.valorTotal || 0,
                    )}</td>
                    <td style="text-align: center;">
                      <button
                        class="item-remover"
                        data-item-id="${i.id}"
                        title="Remover item"
                      >
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  </tr>
                `,
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4" style="text-align: right; font-weight: 700;">
                    Subtotal da Ata:
                  </td>
                  <td class="numeric subtotal-valor">
                    ${this.sistema.ui.formatarMoeda(totalAta)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    }

    lista.innerHTML = html;

    // Atualiza total geral
    const totalEl = document.getElementById("carrinhoTotal");
    if (totalEl) {
      totalEl.textContent = this.sistema.ui.formatarMoeda(totalGeral);
    }

    // Conecta os botões de remover (delegação por data-attribute)
    lista.querySelectorAll(".item-remover").forEach((btn) => {
      btn.addEventListener("click", () => {
        const itemId = btn.dataset.itemId;
        if (itemId) this.removerItem(itemId);
      });
    });
  }

  // ============================================================
  // REMOVER ITEM
  // ============================================================
  removerItem(itemId) {
    this.sistema.carrinho = (this.sistema.carrinho || []).filter(
      (i) => i.id !== itemId,
    );
    this.sistema.salvarCarrinhoStorage();
    this.renderizar();
    this.sistema.ui.mostrarToast(
      "sucesso",
      "Item removido",
      "O item foi removido do carrinho.",
    );
  }

  // ============================================================
  // LIMPAR CARRINHO
  // ============================================================
  async limparCarrinho() {
    if ((this.sistema.carrinho || []).length === 0) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Carrinho vazio",
        "Não há itens para remover.",
      );
      return;
    }

    const confirmado = await this.sistema.confirmar(
      "Tem certeza que deseja limpar todo o carrinho?",
    );
    if (!confirmado) return;

    this.sistema.carrinho = [];
    this.sistema.salvarCarrinhoStorage();
    this.renderizar();
    this.sistema.ui.mostrarToast(
      "sucesso",
      "Carrinho limpo",
      "Todos os itens foram removidos.",
    );
  }

  // ============================================================
  // MOSTRAR / ESCONDER LOADING
  // ============================================================
  mostrarLoading(show, mensagem) {
    const loading = document.getElementById("carrinhoLoading");
    const content = document.getElementById("carrinhoViewContent");

    if (loading) {
      loading.style.display = show ? "flex" : "none";
      if (mensagem) {
        const p = loading.querySelector("p");
        if (p) p.textContent = mensagem;
      }
    }
    if (content) {
      content.style.display = show ? "none" : "block";
    }
  }

  // ============================================================
  // FINALIZAR PEDIDO
  // ------------------------------------------------------------
  // Migrado de carrinho-page.js::finalizarPedido().
  // Mantém a regra de negócio: todo pedido nasce como
  // AGUARDANDO_APROVACAO, independente do perfil do usuário.
  // ============================================================
  async finalizarPedido() {
    const carrinho = this.sistema.carrinho || [];

    if (carrinho.length === 0) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Carrinho vazio",
        "Adicione itens ao carrinho antes de finalizar.",
      );
      return;
    }

    if (!this.sistema.usuarioAtual) {
      this.sistema.ui.mostrarToast(
        "erro",
        "Usuário não logado",
        "Faça login para finalizar o pedido.",
      );
      return;
    }

    const confirmado = await this.sistema.confirmar(
      `Deseja finalizar o pedido com ${carrinho.length} item(ns)?`,
    );
    if (!confirmado) return;

    // Desabilita botão para evitar duplo envio
    const btnFinalizar = document.getElementById("btnFinalizarPedido");
    if (btnFinalizar) {
      btnFinalizar.disabled = true;
      btnFinalizar.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Processando...';
    }

    try {
      this.mostrarLoading(true, "Gerando pedido(s)...");

      // Agrupar itens por ata
      const pedidosPorAta = {};
      carrinho.forEach((item) => {
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

      const dataAtual = new Date().toISOString().split("T")[0];

      // Para cada ata, criar um pedido com seus itens
      for (const [ataId, pedido] of Object.entries(pedidosPorAta)) {
        const totalPedido = pedido.itens.reduce((s, i) => s + i.valorTotal, 0);

        const numeroPedido = `PED-${new Date().getFullYear()}-${String(
          Date.now(),
        ).slice(-4)}-${String(Math.floor(Math.random() * 1000)).padStart(
          3,
          "0",
        )}`;

        // ============================================================
        // CORREÇÃO: Pedido sempre nasce como AGUARDANDO_APROVACAO,
        // independente do perfil do usuário.
        // ============================================================
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
            observacoes: "Pedido gerado via carrinho",
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

        // Inserir itens do pedido
        for (const item of pedido.itens) {
          const { error: itemError } = await supabase
            .from("itens_pedido")
            .insert({
              pedido_id: pedidoData.id,
              item_ata_id: item.itemId,
              quantidade_solicitada: item.quantidade,
              valor_unitario: item.valorUnitario,
              valor_total: item.valorTotal,
            });

          if (itemError) throw itemError;
        }
      }

      // Limpar carrinho
      this.sistema.carrinho = [];
      this.sistema.salvarCarrinhoStorage();
      this.renderizar();

      const qtdPedidos = Object.keys(pedidosPorAta).length;
      this.sistema.ui.mostrarToast(
        "sucesso",
        "Pedido realizado",
        `${qtdPedidos} pedido(s) gerado(s) com sucesso!`,
      );

      // Navega para a view de Pedidos após o toast aparecer
      setTimeout(() => {
        this.sistema.ativarTab("pedidos");
      }, 800);
    } catch (error) {
      console.error("[Carrinho] Erro ao finalizar pedido:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        "Erro",
        error.message || "Não foi possível finalizar o pedido.",
      );
    } finally {
      this.mostrarLoading(false);

      const btn = document.getElementById("btnFinalizarPedido");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check-circle"></i> Finalizar Pedido';
      }
    }
  }
}
