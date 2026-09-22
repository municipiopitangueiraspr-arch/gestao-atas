import { supabase } from "../supabase.js";

export class Gestao {
  constructor(sistema) {
    this.sistema = sistema;
  }

  async carregarConteudo() {
    const container = document.getElementById("gestaoContent");
    this.sistema.ui.mostrarSpinner("gestaoContent", "Carregando gestão...");
    const html = await this.gerarHTMLGestao();
    container.innerHTML = html;
    await this.carregarSelects();
    await this.carregarFiltros();
    this.configurarEventos();
  }

  async gerarHTMLGestao() {
    return `
            <div class="gestao-container">
                <div class="gestao-header">
                    <div class="gestao-titulo"><i class="fas fa-boxes"></i> Lançamento Rápido</div>
                    <div class="gestao-filtros">
                        <select id="selectAtaGestao" class="gestao-select"><option value="">🔍 Selecione uma ata...</option></select>
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

  async carregarSelects() {
    const select = document.getElementById("selectAtaGestao");
    if (!select) return;
    select.innerHTML = '<option value="">🔍 Selecione...</option>';
    const { data: atas } = await supabase
      .from("atas")
      .select("id, numero_ata, situacao, fornecedor:fornecedores(razao_social)")
      .order("numero_ata");
    atas?.forEach((a) => {
      const o = document.createElement("option");
      o.value = a.id;
      o.textContent = `${a.numero_ata} - ${a.fornecedor?.razao_social || ""}`;
      select.appendChild(o);
    });
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
      .getElementById("selectAtaGestao")
      .addEventListener("change", () => this.carregarItensGestao());
    document
      .getElementById("filtroStatusGestao")
      .addEventListener("change", () => this.filtrarItensGestao());
    document
      .getElementById("buscaGestao")
      .addEventListener("keyup", () => this.filtrarGestao());
    document
      .getElementById("filtroGestaoFornecedor")
      .addEventListener("change", () => this.filtrarGestao());
    document
      .getElementById("filtroGestaoOrgao")
      .addEventListener("change", () => this.filtrarGestao());
    document
      .getElementById("filtroGestaoStatusAta")
      .addEventListener("change", () => this.filtrarGestao());
    document
      .getElementById("filtroGestaoSaldo")
      .addEventListener("change", () => this.filtrarGestao());
    document
      .getElementById("ocultarZerados")
      .addEventListener("change", () => this.filtrarGestao());
    document
      .getElementById("apenas30dias")
      .addEventListener("change", () => this.filtrarGestao());
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
    if (!this.sistema.ataSelecionada) return;
    const filtro =
      document.getElementById("filtroStatusGestao")?.value || "todos";
    let itens = [...this.sistema.ataSelecionada.itens];
    if (filtro === "disponivel")
      itens = itens.filter((i) => i.saldo_quantidade > 0);
    else if (filtro === "critico")
      itens = itens.filter(
        (i) =>
          i.saldo_quantidade > 0 &&
          i.saldo_quantidade <= i.quantidade_contratada * 0.1,
      );
    else if (filtro === "esgotado")
      itens = itens.filter((i) => i.saldo_quantidade <= 0);
    this.renderizarItensGestao(itens);
  }

  filtrarGestao() {
    if (!this.sistema.ataSelecionada) return;
    this.sistema.filtrosGestaoAtivos.busca = document
      .getElementById("buscaGestao")
      .value.toLowerCase();
    this.sistema.filtrosGestaoAtivos.fornecedor = document.getElementById(
      "filtroGestaoFornecedor",
    ).value;
    this.sistema.filtrosGestaoAtivos.orgao =
      document.getElementById("filtroGestaoOrgao").value;
    this.sistema.filtrosGestaoAtivos.statusAta = document.getElementById(
      "filtroGestaoStatusAta",
    ).value;
    this.sistema.filtrosGestaoAtivos.saldo =
      document.getElementById("filtroGestaoSaldo").value;
    this.sistema.filtrosGestaoAtivos.ocultarZerados =
      document.getElementById("ocultarZerados").checked;
    this.sistema.filtrosGestaoAtivos.apenas30dias =
      document.getElementById("apenas30dias").checked;
    this.aplicarFiltrosGestao();
  }

  async aplicarFiltrosGestao() {
    if (!this.sistema.ataSelecionada) return;
    let itens = [...this.sistema.ataSelecionada.itens];
    if (this.sistema.filtrosGestaoAtivos.busca) {
      itens = itens.filter((i) =>
        i.descricao
          .toLowerCase()
          .includes(this.sistema.filtrosGestaoAtivos.busca),
      );
    }
    if (this.sistema.filtrosGestaoAtivos.saldo === "disponivel") {
      itens = itens.filter((i) => i.saldo_quantidade > 0);
    } else if (this.sistema.filtrosGestaoAtivos.saldo === "critico") {
      itens = itens.filter(
        (i) =>
          i.saldo_quantidade > 0 &&
          i.saldo_quantidade <= i.quantidade_contratada * 0.1,
      );
    } else if (this.sistema.filtrosGestaoAtivos.saldo === "zerado") {
      itens = itens.filter((i) => i.saldo_quantidade <= 0);
    }
    if (this.sistema.filtrosGestaoAtivos.ocultarZerados) {
      itens = itens.filter((i) => i.saldo_quantidade > 0);
    }
    this.renderizarItensGestao(itens);
  }

  limparFiltrosGestao() {
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
    if (!this.sistema.ataSelecionada) {
      this.sistema.ui.mostrarToast("erro", "Selecione uma ata primeiro");
      return;
    }
    const itens = this.sistema.ataSelecionada.itens;
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
      `itens_ata_${this.sistema.ataSelecionada.numero_ata}.csv`,
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
            <thead><tr><th>Item</th><th>Descrição</th><th>Contratado</th><th>Saldo</th><th>Valor Unit.</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>${itens
              .map((item) => {
                const saldo = item.saldo_quantidade || 0;
                const critico =
                  saldo > 0 && saldo <= item.quantidade_contratada * 0.1;
                return `<tr>
                    <td>${item.item_numero}</td>
                    <td>${item.descricao}</td>
                    <td class="numeric">${item.quantidade_contratada}</td>
                    <td class="numeric ${saldo <= 0 ? "saldo-zerado" : critico ? "saldo-baixo" : "saldo-alto"}">${saldo}</td>
                    <td class="numeric">${this.sistema.ui.formatarMoeda(item.valor_unitario)}</td>
                    <td><span class="status-badge" style="background:${saldo <= 0 ? "var(--error-100)" : critico ? "var(--warning-100)" : "var(--success-100)"};color:${saldo <= 0 ? "var(--error-800)" : critico ? "var(--warning-800)" : "var(--success-800)"};">${saldo <= 0 ? "Esgotado" : critico ? "Crítico" : "Normal"}</span></td>
                    <td>${saldo > 0 && podeConsumir ? `<button class="btn-lancar-rapido" onclick="sistema.gestao.abrirModalConsumo(${this.sistema.ataSelecionada.id},${item.id})"><i class="fas fa-pen"></i> Consumo</button>` : ""}</td>
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
    await this.sistema.ui.carregarSelectOrgaos("autarquiaConsumo");
    document.getElementById("modalConsumoConteudo").innerHTML = `<div>
            <div style="background:var(--neutral-50);padding:12px;border-radius:var(--border-radius-lg);margin-bottom:16px;">
                <p style="font-size:0.85rem;"><strong>Ata:</strong> ${this.sistema.ataSelecionada?.numero_ata}</p>
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
        orgao_id: orgaoId,
        usuario_id: this.sistema.usuarioAtual.id,
        quantidade: quantidade,
        valor_unitario: itemAtual.valor_unitario,
        valor_total: itemAtual.valor_unitario * quantidade,
        observacao: obs || null,
        created_at: new Date().toISOString(),
      });

      if (consumoError) throw consumoError;

      // 2. Atualizar o saldo do item
      const novoSaldo = (itemAtual.saldo_quantidade || 0) - quantidade;
      const { error: updateError } = await supabase
        .from("itens_ata")
        .update({
          saldo_quantidade: novoSaldo,
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

      if (novoSaldo < 0) {
        this.sistema.ui.mostrarToast("erro", "O saldo não pode ser negativo.");
        return;
      }

      const { error } = await supabase
        .from("itens_ata")
        .update({
          saldo_quantidade: novoSaldo,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;

      this.sistema.ui.mostrarToast(
        "sucesso",
        `Saldo ajustado para ${novoSaldo}!`,
      );

      // Recarregar dados
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
