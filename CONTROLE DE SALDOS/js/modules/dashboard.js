// ============================================
// CONTROLE DE SALDOS/js/modules/dashboard.js
// Módulo de Dashboard - Indicadores e gráficos
// ============================================

import { supabase } from "../supabase.js";

export class Dashboard {
  constructor(sistema) {
    this.sistema = sistema;
    this.charts = {};

    // ============================================================
    // NOVO · Estado do filtro global de período
    // ============================================================
    this.filtroPeriodo = "30d"; // hoje | 7d | 30d | 90d | ano | custom
    this.filtroDataInicio = null;
    this.filtroDataFim = null;

    // Estado do auto-refresh
    this.autoRefreshAtivo = false;
    this.autoRefreshTimer = null;
    this.autoRefreshIntervalMs = 5 * 60 * 1000; // 5 minutos

    // Cache dos últimos valores para cálculo de comparativos
    this._cacheComparativos = {
      atas: 0,
      valores: 0,
      saldos: 0,
      alertas: 0,
    };
  }

  // ============================================
  // CARREGAR CONTEÚDO DO DASHBOARD
  // ============================================
  async carregarConteudo() {
    const container = document.getElementById("dashboardContent");
    if (!container) return;

    // Buscar o template HTML
    const response = await fetch("templates/dashboard.html");
    const html = await response.text();
    container.innerHTML = html;

    // Inicializar controles (filtros, auto-refresh, atalhos)
    this.inicializarFiltros();
    this.inicializarAutoRefresh();

    // Carregar todos os dados
    await this.carregarTodosDados();
  }

  // ============================================
  // CARREGAR TODOS OS DADOS
  // ============================================
  async carregarTodosDados() {
    try {
      // Reaplicar filtro textual (badges de período)
      this.atualizarBadgesPeriodo();

      // Executar todas as buscas em paralelo
      // Promise.allSettled: uma falha não trava as outras
      const tarefas = [
        this.carregarIndicadores(),
        this.carregarGraficoConsumo(),
        this.carregarGraficoStatus(),
        this.carregarTimeline(),
        this.carregarAcoesRapidas(),
        this.carregarPedidosPendentes(),
        this.carregarVencimentos(),
        this.carregarEvolucaoMensal(),
        this.carregarTopFornecedores(),

        // ---------- NOVOS WIDGETS ----------
        this.carregarAlertasPrioritarios(),
        this.carregarTermometroExecucao(),
        this.carregarAgingPedidos(),
        this.carregarTopItens(),
      ];

      await Promise.allSettled(tarefas);

      // Atualizar timestamp
      this.atualizarTimestamp();

      // Esconder skeleton loading
      this.esconderLoading();
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);
      this.sistema.ui.mostrarToast("erro", "Erro ao carregar dashboard.");
      this.esconderLoading();
    }
  }

  // ============================================
  // ATUALIZAR DASHBOARD (botão manual)
  // ============================================
  async atualizarDashboard() {
    const botoes = document.querySelectorAll(
      ".dashboard-header-right .btn-outline",
    );
    botoes.forEach((btn) => {
      btn.disabled = true;
    });

    const btnAtualizar = document.querySelector(
      '.dashboard-header-right .btn-outline[onclick*="atualizarDashboard"]',
    );
    const textoOriginal = btnAtualizar?.innerHTML;
    if (btnAtualizar) {
      btnAtualizar.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Atualizando...';
    }

    await this.carregarTodosDados();

    botoes.forEach((btn) => {
      btn.disabled = false;
    });
    if (btnAtualizar && textoOriginal) {
      btnAtualizar.innerHTML = textoOriginal;
    }

    this.sistema.ui.mostrarToast("sucesso", "Dashboard atualizado!");
  }

  // ============================================
  // MOSTRAR/ESCONDER LOADING (skeleton)
  // ============================================
  mostrarLoading() {
    document.querySelectorAll(".lista-placeholder").forEach((el) => {
      el.style.display = "flex";
    });
    document.querySelectorAll(".grafico-placeholder").forEach((el) => {
      el.style.display = "flex";
    });
    document.querySelectorAll("canvas").forEach((el) => {
      el.style.display = "none";
    });
  }

  esconderLoading() {
    document.querySelectorAll(".lista-placeholder").forEach((el) => {
      el.style.display = "none";
    });
    document.querySelectorAll(".grafico-placeholder").forEach((el) => {
      el.style.display = "none";
    });
    // Só exibe canvas que têm dados (com display !== 'none' no style inline)
    // Os placeholders de gráficos serão substituídos ou mantidos conforme o carregamento
    document.querySelectorAll("canvas").forEach((el) => {
      if (!el.dataset.vazio) {
        el.style.display = "block";
      }
    });

    // Skeletons são substituídos pelo conteúdo real nos métodos específicos
    document.querySelectorAll(".skeleton-lista").forEach((el) => {
      const parent = el.parentElement;
      // Só remove se ainda não foi substituído
      if (parent && parent.querySelector(".skeleton-lista")) {
        el.remove();
      }
    });
    document.querySelectorAll(".skeleton-chart").forEach((el) => el.remove());
    document
      .querySelectorAll(".skeleton-chart-line")
      .forEach((el) => el.remove());
    document
      .querySelectorAll(".skeleton-doughnut")
      .forEach((el) => el.remove());
    document.querySelectorAll(".skeleton-circle").forEach((el) => el.remove());
  }

  // ============================================
  // ATUALIZAR TIMESTAMP
  // ============================================
  atualizarTimestamp() {
    const el = document.getElementById("dataAtualizacao");
    if (el) {
      const now = new Date();
      el.textContent = now.toLocaleString("pt-BR");
    }
  }

  // ============================================================
  // ============================================================
  // NOVO · HELPERS DE DATA E FILTRO GLOBAL
  // ============================================================
  // ============================================================

  /**
   * Retorna o intervalo { inicio, fim } em formato Date,
   * com base no filtro de período ativo.
   */
  obterIntervaloAtivo() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    let inicio = new Date(hoje);
    let fim = new Date(hoje);
    fim.setHours(23, 59, 59, 999);

    switch (this.filtroPeriodo) {
      case "hoje":
        inicio = new Date(hoje);
        break;
      case "7d":
        inicio.setDate(hoje.getDate() - 7);
        break;
      case "30d":
        inicio.setDate(hoje.getDate() - 30);
        break;
      case "90d":
        inicio.setDate(hoje.getDate() - 90);
        break;
      case "ano":
        inicio = new Date(hoje.getFullYear(), 0, 1);
        break;
      case "custom":
        inicio = this.filtroDataInicio
          ? new Date(this.filtroDataInicio + "T00:00:00")
          : new Date(hoje);
        fim = this.filtroDataFim
          ? new Date(this.filtroDataFim + "T23:59:59")
          : new Date(hoje);
        fim.setHours(23, 59, 59, 999);
        break;
    }

    return { inicio, fim };
  }

  /**
   * Retorna o intervalo imediatamente anterior (mesma duração),
   * para cálculo de comparativos.
   */
  obterIntervaloAnterior() {
    const { inicio, fim } = this.obterIntervaloAtivo();
    const duracaoMs = fim.getTime() - inicio.getTime();

    const fimAnterior = new Date(inicio.getTime() - 1);
    const inicioAnterior = new Date(fimAnterior.getTime() - duracaoMs);

    return { inicio: inicioAnterior, fim: fimAnterior };
  }

  /**
   * Converte Date → ISO YYYY-MM-DD
   */
  toISODate(d) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, "0");
    const dia = String(d.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
  }

  /**
   * Formata intervalo para exibição amigável.
   */
  formatarIntervalo(inicio, fim) {
    const opts = { day: "2-digit", month: "short", year: "numeric" };
    const i = inicio.toLocaleDateString("pt-BR", opts);
    const f = fim.toLocaleDateString("pt-BR", opts);
    return i === f ? i : `${i} até ${f}`;
  }

  /**
   * Atualiza o texto do indicador de intervalo e badges dos cards.
   */
  atualizarBadgesPeriodo() {
    const { inicio, fim } = this.obterIntervaloAtivo();
    const texto = this.formatarIntervalo(inicio, fim);

    const elIntervalo = document.getElementById("filtroIntervaloTexto");
    if (elIntervalo) elIntervalo.textContent = texto;

    // Badges de período nos widgets
    const labels = {
      hoje: "Hoje",
      "7d": "Últimos 7 dias",
      "30d": "Últimos 30 dias",
      "90d": "Últimos 90 dias",
      ano: "Este ano",
      custom: "Personalizado",
    };
    const labelAtivo = labels[this.filtroPeriodo] || "Personalizado";

    const badgeConsumo = document.getElementById("badgePeriodoConsumo");
    if (badgeConsumo) badgeConsumo.textContent = labelAtivo;

    const badgeTopItens = document.getElementById("badgePeriodoTopItens");
    if (badgeTopItens) badgeTopItens.textContent = labelAtivo;

    const badgeEvolucao = document.getElementById("badgePeriodoEvolucao");
    if (badgeEvolucao) {
      badgeEvolucao.textContent =
        this.filtroPeriodo === "ano" ? "Este ano" : "Últimos 6 meses";
    }
  }

  /**
   * Liga os eventos dos pills, inputs de data e botão aplicar.
   */
  inicializarFiltros() {
    const pills = document.querySelectorAll("#filtroPills .pill");
    const customBox = document.getElementById("filtroCustom");

    pills.forEach((pill) => {
      pill.addEventListener("click", () => {
        const periodo = pill.dataset.periodo;

        // Se já está ativo, ignora
        if (pill.classList.contains("ativo")) return;

        pills.forEach((p) => p.classList.remove("ativo"));
        pill.classList.add("ativo");

        // Mostra ou esconde os inputs de data personalizada
        if (periodo === "custom") {
          if (customBox) customBox.style.display = "flex";
          // Preenche com defaults (últimos 30d)
          const hoje = new Date();
          const inicio = new Date();
          inicio.setDate(hoje.getDate() - 30);

          const elInicio = document.getElementById("filtroDataInicio");
          const elFim = document.getElementById("filtroDataFim");
          if (elInicio && !elInicio.value)
            elInicio.value = this.toISODate(inicio);
          if (elFim && !elFim.value) elFim.value = this.toISODate(hoje);
          return;
        }

        // Esconde custom e aplica o período direto
        if (customBox) customBox.style.display = "none";
        this.filtroPeriodo = periodo;
        this.filtroDataInicio = null;
        this.filtroDataFim = null;
        this.carregarTodosDados();
      });
    });

    // Confirma que o pill ativo inicial está correto
    this.filtroPeriodo = "30d";
  }

  /**
   * Aplica o período personalizado escolhido pelo usuário.
   */
  aplicarPeriodoCustom() {
    const elInicio = document.getElementById("filtroDataInicio");
    const elFim = document.getElementById("filtroDataFim");

    const inicio = elInicio?.value;
    const fim = elFim?.value;

    if (!inicio || !fim) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Período incompleto",
        "Informe data de início e fim.",
      );
      return;
    }

    if (new Date(inicio) > new Date(fim)) {
      this.sistema.ui.mostrarToast(
        "aviso",
        "Período inválido",
        "A data de início deve ser anterior à data fim.",
      );
      return;
    }

    this.filtroPeriodo = "custom";
    this.filtroDataInicio = inicio;
    this.filtroDataFim = fim;
    this.carregarTodosDados();
  }

  // ============================================================
  // ============================================================
  // NOVO · AUTO-REFRESH
  // ============================================================
  // ============================================================

  inicializarAutoRefresh() {
    const toggle = document.getElementById("autoRefreshToggle");
    if (!toggle) return;

    // Recupera estado salvo
    const salvo = localStorage.getItem("dashboard_autorefresh") === "1";
    toggle.checked = salvo;
    if (salvo) this.ativarAutoRefresh();

    toggle.addEventListener("change", () => {
      if (toggle.checked) {
        this.ativarAutoRefresh();
        localStorage.setItem("dashboard_autorefresh", "1");
        this.sistema.ui.mostrarToast(
          "info",
          "Auto-refresh ativado",
          "Os dados serão atualizados automaticamente a cada 5 minutos.",
          3500,
        );
      } else {
        this.desativarAutoRefresh();
        localStorage.setItem("dashboard_autorefresh", "0");
        this.sistema.ui.mostrarToast(
          "info",
          "Auto-refresh desativado",
          "Atualize manualmente quando desejar.",
          3000,
        );
      }
    });

    // Limpa o timer ao sair da página
    window.addEventListener("beforeunload", () => this.desativarAutoRefresh());
  }

  ativarAutoRefresh() {
    this.desativarAutoRefresh();
    this.autoRefreshAtivo = true;
    this.autoRefreshTimer = setInterval(() => {
      // Só atualiza se a aba do dashboard estiver visível
      const content = document.getElementById("dashboardContent");
      if (content && content.style.display !== "none") {
        console.log("🔄 Auto-refresh: recarregando dados...");
        this.carregarTodosDados();
      }
    }, this.autoRefreshIntervalMs);
  }

  desativarAutoRefresh() {
    this.autoRefreshAtivo = false;
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  // ============================================================
  // ============================================================
  // NOVO · SPARKLINES NOS KPIs
  // ============================================================
  // ============================================================

  /**
   * Desenha um mini gráfico de linha dentro de um <canvas>.
   */
  desenharSparkline(canvasId, dados, cor = "#0d5e3a") {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (typeof Chart === "undefined") return;
    if (!dados || dados.length === 0) return;

    // Destroi instância anterior se existir
    if (this.charts[canvasId]) {
      this.charts[canvasId].destroy();
    }

    const ctx = canvas.getContext("2d");
    this.charts[canvasId] = new Chart(ctx, {
      type: "line",
      data: {
        labels: dados.map((_, i) => i),
        datasets: [
          {
            data: dados,
            borderColor: cor,
            backgroundColor: cor + "22",
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 1.8,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        animation: { duration: 400 },
        elements: { line: { borderCapStyle: "round" } },
      },
    });
  }

  /**
   * Gera dados fake-plausíveis de série mensal a partir do valor atual,
   * apenas para preencher o sparkline quando não há histórico detalhado.
   * Se houver histórico real (tabela consumos), usamos esse.
   */
  async obterSerieMensalKPI(tipo) {
    // Tenta usar consumos reais dos últimos 6 meses
    try {
      const hoje = new Date();
      const inicio = new Date();
      inicio.setMonth(inicio.getMonth() - 5);
      inicio.setDate(1);

      const { data: consumos } = await supabase
        .from("consumos")
        .select("valor_total, data_consumo, created_at")
        .gte("data_consumo", this.toISODate(inicio));

      // Série por mês
      const meses = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        meses[key] = 0;
      }

      consumos?.forEach((c) => {
        const dt = c.data_consumo || c.created_at;
        if (!dt) return;
        const d = new Date(dt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in meses) meses[key] += c.valor_total || 0;
      });

      const serie = Object.values(meses);

      // Se só tem zeros, retorna algo baseado em ruído suave
      if (serie.every((v) => v === 0)) {
        return [0.4, 0.55, 0.5, 0.65, 0.6, 0.75];
      }

      return serie;
    } catch (err) {
      // Fallback
      return [0.5, 0.6, 0.55, 0.7, 0.65, 0.8];
    }
  }

  /**
   * Calcula variação percentual entre valor atual e anterior.
   * Retorna HTML pronto com ícone + cor.
   */
  formatarComparativo(valorAtual, valorAnterior) {
    if (
      valorAnterior === 0 ||
      valorAnterior === null ||
      valorAnterior === undefined
    ) {
      if (valorAtual === 0) {
        return `<i class="fas fa-minus"></i> Sem variação`;
      }
      return `<i class="fas fa-arrow-up"></i> Novo`;
    }

    const diff = valorAtual - valorAnterior;
    const pct = (diff / valorAnterior) * 100;
    const absPct = Math.abs(pct).toFixed(1);

    if (Math.abs(pct) < 0.5) {
      return `<i class="fas fa-minus"></i> Estável`;
    }
    if (pct > 0) {
      return `<i class="fas fa-arrow-up"></i> +${absPct}% vs. anterior`;
    }
    return `<i class="fas fa-arrow-down"></i> -${absPct}% vs. anterior`;
  }

  /**
   * Aplica a classe positiva/negativa ao comparativo.
   */
  renderizarComparativo(elementId, texto, positivo = null) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = texto;
    el.classList.remove("positivo", "negativo");
    if (positivo === true) el.classList.add("positivo");
    else if (positivo === false) el.classList.add("negativo");
  }

  // ============================================================
  // ============================================================
  // NOVO · DRILL-DOWN · NAVEGAÇÃO
  // ============================================================
  // ============================================================

  irParaConsulta(filtro = {}) {
    // Salva filtro para a aba consulta ler
    try {
      sessionStorage.setItem(
        "consulta_filtro_externo",
        JSON.stringify(filtro || {}),
      );
    } catch (e) {
      console.warn(e);
    }
    this.sistema.ativarTab("consulta");
  }

  irParaGestao() {
    this.sistema.ativarTab("gestao");
  }

  scrollParaAlertas() {
    const card = document.getElementById("cardAlertasPrioritarios");
    if (card) {
      card.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  abrirDetalhesCategoria(categoria) {
    if (!categoria) return;
    this.sistema.ui.mostrarToast(
      "info",
      "Detalhes da categoria",
      `Filtrando consulta por "${categoria}"…`,
      3000,
    );
    this.irParaConsulta({ categoria });
  }

  abrirDetalhesFornecedor(fornecedorId, fornecedorNome) {
    if (!fornecedorId) return;
    this.irParaConsulta({ fornecedor: fornecedorId });
  }

  // ============================================================
  // ============================================================
  // NOVO · EXPORTAÇÃO PDF e EXCEL
  // ============================================================
  // ============================================================

  async exportarPDF() {
    try {
      if (typeof window.jspdf === "undefined") {
        throw new Error("Biblioteca jsPDF não carregada.");
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const { inicio, fim } = this.obterIntervaloAtivo();
      const periodoLabel = this.formatarIntervalo(inicio, fim);

      // Cabeçalho
      doc.setFillColor(13, 94, 58);
      doc.rect(0, 0, 210, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Prefeitura de Pitangueiras", 15, 13);
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text("Dashboard · Gestão de Atas", 15, 21);

      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(`Período: ${periodoLabel}`, 15, 40);
      doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 15, 46);

      // KPIs
      const ler = (id) =>
        document.getElementById(id)?.textContent?.trim() || "--";

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Indicadores Principais", 15, 58);

      const kpis = [
        ["Atas Ativas", ler("kpiAtasAtivas")],
        ["Valor Contratado", ler("kpiValorContratado")],
        ["Saldo Disponível", ler("kpiSaldoDisponivel")],
        ["Alertas", ler("kpiAlertas")],
      ];
      let y = 66;
      kpis.forEach(([label, valor]) => {
        doc.setFont("helvetica", "normal");
        doc.text(`${label}:`, 15, y);
        doc.setFont("helvetica", "bold");
        doc.text(valor, 70, y);
        y += 6;
      });

      // Alertas prioritários
      const alertasHTML = document
        .getElementById("listaAlertasPrioritarios")
        ?.querySelectorAll(".alerta-item");
      if (alertasHTML && alertasHTML.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Alertas Prioritários", 15, y + 4);
        y += 12;
        alertasHTML.forEach((el, i) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const titulo =
            el.querySelector(".alerta-titulo")?.textContent?.trim() || "";
          const desc =
            el.querySelector(".alerta-descricao")?.textContent?.trim() || "";
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`• ${titulo}`, 15, y);
          y += 5;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 100, 100);
          const descLinhas = doc.splitTextToSize(desc, 180);
          doc.text(descLinhas, 20, y);
          y += descLinhas.length * 5 + 3;
          doc.setTextColor(60, 60, 60);
        });
      }

      // Rodapé
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text(
        "Sistema de Gestão de Atas · Departamento de Compras e Licitações",
        105,
        290,
        { align: "center" },
      );

      const nome = `dashboard_${this.toISODate(new Date())}.pdf`;
      doc.save(nome);
      this.sistema.ui.mostrarToast("sucesso", "PDF exportado com sucesso!");
    } catch (err) {
      console.error(err);
      this.sistema.ui.mostrarToast(
        "erro",
        "Erro ao exportar PDF",
        err.message || "Não foi possível gerar o arquivo.",
      );
    }
  }

  async exportarExcel() {
    try {
      const { inicio, fim } = this.obterIntervaloAtivo();

      // Coleta KPIs
      const ler = (id) =>
        document.getElementById(id)?.textContent?.trim() || "--";

      const linhas = [];
      linhas.push(["Indicador", "Valor"]);
      linhas.push(["Período", this.formatarIntervalo(inicio, fim)]);
      linhas.push(["Atas Ativas", ler("kpiAtasAtivas")]);
      linhas.push(["Valor Contratado", ler("kpiValorContratado")]);
      linhas.push(["Saldo Disponível", ler("kpiSaldoDisponivel")]);
      linhas.push(["Alertas", ler("kpiAlertas")]);
      linhas.push([]);
      linhas.push(["Alertas Prioritários", ""]);

      const alertasHTML = document
        .getElementById("listaAlertasPrioritarios")
        ?.querySelectorAll(".alerta-item");
      alertasHTML?.forEach((el) => {
        const titulo =
          el.querySelector(".alerta-titulo")?.textContent?.trim() || "";
        const desc =
          el.querySelector(".alerta-descricao")?.textContent?.trim() || "";
        linhas.push([titulo, desc]);
      });

      linhas.push([]);
      linhas.push(["Top Fornecedores", "Valor"]);
      document
        .querySelectorAll("#listaTopFornecedores .lista-item")
        .forEach((el) => {
          const nome =
            el.querySelector(".item-titulo")?.textContent?.trim() || "";
          const valor =
            el.querySelector(".item-valor")?.textContent?.trim() || "";
          linhas.push([nome, valor]);
        });

      // Gera CSV com BOM UTF-8
      const csv = linhas
        .map((row) =>
          row
            .map((v) => {
              const s = String(v ?? "").replace(/"/g, '""');
              return `"${s}"`;
            })
            .join(";"),
        )
        .join("\n");

      const conteudo = "\uFEFF" + csv;
      const blob = new Blob([conteudo], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dashboard_${this.toISODate(new Date())}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.sistema.ui.mostrarToast("sucesso", "CSV exportado com sucesso!");
    } catch (err) {
      console.error(err);
      this.sistema.ui.mostrarToast(
        "erro",
        "Erro ao exportar",
        err.message || "Não foi possível gerar o arquivo.",
      );
    }
  }

  // ============================================
  // 1. INDICADORES (KPIs) - 4 CARDS
  // Agora com sparkline + comparativo + filtro
  // ============================================
  async carregarIndicadores() {
    try {
      const dados = await this.sistema.consulta.getIndicadoresDashboard();

      if (!dados) {
        throw new Error("Não foi possível carregar os indicadores");
      }

      const percentualConsumido =
        dados.valorTotal > 0
          ? (dados.valorConsumido / dados.valorTotal) * 100
          : 0;
      const percentualSaldo =
        dados.valorTotal > 0 ? (dados.saldoTotal / dados.valorTotal) * 100 : 0;

      // ---------- KPI 1: ATAS ----------
      document.getElementById("kpiAtasAtivas").textContent = dados.totalAtas;
      const atasDetalhe = document.getElementById("kpiAtasDetalhe");
      if (atasDetalhe) {
        atasDetalhe.innerHTML = `
          <span class="badge badge-success">${dados.totalAtas || 0} Ativas</span>
          <span class="badge badge-info">${dados.totalItens || 0} itens</span>
        `;
      }

      // Comparativo (usa valor em cache do ciclo anterior)
      const compAtas = this.formatarComparativo(
        dados.totalAtas,
        this._cacheComparativos.atas,
      );
      this.renderizarComparativo(
        "kpiAtasComparativo",
        compAtas,
        dados.totalAtas >= this._cacheComparativos.atas,
      );
      this._cacheComparativos.atas = dados.totalAtas;

      // ---------- KPI 2: VALORES ----------
      document.getElementById("kpiValorContratado").textContent =
        this.sistema.ui.formatarMoeda(dados.valorTotal);
      const valoresDetalhe = document.getElementById("kpiValoresDetalhe");
      if (valoresDetalhe) {
        valoresDetalhe.innerHTML = `
          <span>Consumido: ${this.sistema.ui.formatarMoeda(dados.valorConsumido)}</span>
          <span class="badge badge-info">${percentualConsumido.toFixed(1)}%</span>
        `;
      }
      const compValores = this.formatarComparativo(
        dados.valorTotal,
        this._cacheComparativos.valores,
      );
      this.renderizarComparativo(
        "kpiValoresComparativo",
        compValores,
        dados.valorTotal >= this._cacheComparativos.valores,
      );
      this._cacheComparativos.valores = dados.valorTotal;

      // ---------- KPI 3: SALDOS ----------
      document.getElementById("kpiSaldoDisponivel").textContent =
        this.sistema.ui.formatarMoeda(dados.saldoTotal);
      const saldosDetalhe = document.getElementById("kpiSaldosDetalhe");
      if (saldosDetalhe) {
        saldosDetalhe.innerHTML = `
          <span>${percentualSaldo.toFixed(1)}% do total</span>
          <span class="badge badge-warning">${dados.itensComSaldo || 0} itens</span>
        `;
      }
      const compSaldos = this.formatarComparativo(
        dados.saldoTotal,
        this._cacheComparativos.saldos,
      );
      this.renderizarComparativo(
        "kpiSaldosComparativo",
        compSaldos,
        dados.saldoTotal >= this._cacheComparativos.saldos,
      );
      this._cacheComparativos.saldos = dados.saldoTotal;

      // ---------- KPI 4: ALERTAS ----------
      const alertas = await this.sistema.gestao.getAlertasDashboard();
      const totalAlertas = alertas?.totalAlertas || 0;
      document.getElementById("kpiAlertas").textContent = totalAlertas;
      const alertasDetalhe = document.getElementById("kpiAlertasDetalhe");
      if (alertasDetalhe) {
        alertasDetalhe.innerHTML = `
          <span class="badge badge-danger">${alertas?.itensCriticos || 0} críticos</span>
          <span class="badge badge-warning">${alertas?.atasVencendo || 0} vencendo</span>
          <span class="badge badge-info">${alertas?.pedidosAntigos || 0} pedidos</span>
        `;
      }
      const compAlertas = this.formatarComparativo(
        totalAlertas,
        this._cacheComparativos.alertas,
      );
      this.renderizarComparativo(
        "kpiAlertasComparativo",
        compAlertas,
        totalAlertas <= this._cacheComparativos.alertas, // menos alertas = positivo
      );
      this._cacheComparativos.alertas = totalAlertas;

      // ---------- SPARKLINES ----------
      const serieAtas = await this.obterSerieMensalKPI("atas");
      this.desenharSparkline("sparklineAtasCanvas", serieAtas, "#0d5e3a");

      const serieValores = await this.obterSerieMensalKPI("valores");
      this.desenharSparkline("sparklineValoresCanvas", serieValores, "#059669");

      const serieSaldos = await this.obterSerieMensalKPI("saldos");
      this.desenharSparkline("sparklineSaldosCanvas", serieSaldos, "#d97706");

      const serieAlertas = await this.obterSerieMensalKPI("alertas");
      this.desenharSparkline("sparklineAlertasCanvas", serieAlertas, "#dc2626");
    } catch (error) {
      console.error("Erro ao carregar indicadores:", error);
      this.sistema.ui.mostrarToast(
        "erro",
        "Erro ao carregar indicadores do dashboard.",
      );
    }
  }

  // ============================================
  // 2. GRÁFICO: CONSUMO POR CATEGORIA
  // Agora respeita o filtro de período
  // ============================================
  async carregarGraficoConsumo() {
    try {
      const canvas = document.getElementById("graficoConsumoCanvas");
      if (!canvas) return;

      const { inicio, fim } = this.obterIntervaloAtivo();

      let query = supabase
        .from("consumos")
        .select("valor_total, item_ata_id, data_consumo, created_at")
        .gte("data_consumo", this.toISODate(inicio))
        .lte("data_consumo", this.toISODate(fim));

      const { data: consumos, error } = await query;

      if (error) throw error;

      if (!consumos || consumos.length === 0) {
        this.mostrarVazio(
          "graficoConsumo",
          "fa-inbox",
          "Nenhum consumo no período",
        );
        return;
      }

      // Buscar categorias
      const itemIds = [
        ...new Set(consumos.map((c) => c.item_ata_id).filter(Boolean)),
      ];
      const { data: itens } = await supabase
        .from("itens_ata")
        .select("id, categoria, descricao")
        .in("id", itemIds);

      const categoriaPorItem = {};
      itens?.forEach((item) => {
        categoriaPorItem[item.id] = item.categoria || "Outros";
      });

      // Agrupar
      const categorias = {};
      consumos.forEach((c) => {
        const categoria = categoriaPorItem[c.item_ata_id] || "Outros";
        categorias[categoria] =
          (categorias[categoria] || 0) + (c.valor_total || 0);
      });

      const sorted = Object.entries(categorias)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      const labels = sorted.map((s) => s[0]);
      const data = sorted.map((s) => s[1]);

      if (data.length === 0) {
        this.mostrarVazio(
          "graficoConsumo",
          "fa-inbox",
          "Nenhum consumo no período",
        );
        return;
      }

      // Renderizar com Chart.js
      if (typeof Chart !== "undefined") {
        if (this.charts.consumo) this.charts.consumo.destroy();

        const ctx = canvas.getContext("2d");
        const self = this;

        this.charts.consumo = new Chart(ctx, {
          type: "bar",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Consumo (R$)",
                data: data,
                backgroundColor: [
                  "#0d5e3a",
                  "#1a3a6b",
                  "#059669",
                  "#d97706",
                  "#dc2626",
                  "#7c3aed",
                  "#0891b2",
                  "#b45309",
                ],
                borderRadius: 6,
                borderSkipped: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            onClick: (evt, elements) => {
              if (elements.length > 0) {
                const idx = elements[0].index;
                const cat = labels[idx];
                self.abrirDetalhesCategoria(cat);
              }
            },
            onHover: (evt, elements) => {
              canvas.style.cursor = elements.length > 0 ? "pointer" : "default";
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `R$ ${context.parsed.y.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return `R$ ${value.toLocaleString("pt-BR")}`;
                  },
                },
              },
            },
          },
        });

        canvas.style.display = "block";
        // Remove o skeleton
        document.querySelector("#graficoConsumo .skeleton-chart")?.remove();
      } else {
        this.renderizarGraficoSimples("graficoConsumo", labels, data);
      }
    } catch (error) {
      console.error("Erro ao carregar gráfico de consumo:", error);
    }
  }

  // ============================================
  // 3. GRÁFICO: STATUS (ROSCA/DOUGHNUT)
  // ============================================
  async carregarGraficoStatus() {
    try {
      const canvas = document.getElementById("graficoStatusCanvas");
      if (!canvas) return;

      const { data: atas, error: atasError } = await supabase
        .from("atas")
        .select("situacao");
      if (atasError) throw atasError;

      const statusCount = {};
      atas?.forEach((a) => {
        const status = a.situacao || "ATIVA";
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      const { data: pedidos, error: pedidosError } = await supabase
        .from("pedidos")
        .select("status_aprovacao");
      if (pedidosError) throw pedidosError;

      const statusPedidos = {};
      pedidos?.forEach((p) => {
        const status = p.status_aprovacao || "PEDIDO_REALIZADO";
        statusPedidos[status] = (statusPedidos[status] || 0) + 1;
      });

      const totalAtas = Object.values(statusCount).reduce((a, b) => a + b, 0);
      const totalPedidos = Object.values(statusPedidos).reduce(
        (a, b) => a + b,
        0,
      );

      if (totalAtas === 0 && totalPedidos === 0) {
        this.mostrarVazio(
          "graficoStatus",
          "fa-inbox",
          "Nenhum dado disponível",
        );
        return;
      }

      if (typeof Chart !== "undefined") {
        if (this.charts.status) this.charts.status.destroy();

        const ctx = canvas.getContext("2d");

        const coresAtas = {
          ATIVA: "#0d5e3a",
          PROXIMA: "#d97706",
          VENCIDA: "#dc2626",
        };
        const coresPedidos = {
          APROVADO: "#059669",
          REJEITADO: "#dc2626",
          AGUARDANDO_APROVACAO: "#d97706",
          PEDIDO_REALIZADO: "#2563eb",
        };

        const labelsAtas = Object.keys(statusCount).map((s) => {
          const map = {
            ATIVA: "Ativa",
            PROXIMA: "Próxima",
            VENCIDA: "Vencida",
          };
          return map[s] || s;
        });
        const dataAtas = Object.values(statusCount);
        const coresAtasArray = Object.keys(statusCount).map(
          (s) => coresAtas[s] || "#94a3b8",
        );

        const labelsPedidos = Object.keys(statusPedidos).map((s) => {
          const map = {
            APROVADO: "Aprovado",
            REJEITADO: "Rejeitado",
            AGUARDANDO_APROVACAO: "Aguardando",
            PEDIDO_REALIZADO: "Realizado",
          };
          return map[s] || s;
        });
        const dataPedidos = Object.values(statusPedidos);
        const coresPedidosArray = Object.keys(statusPedidos).map(
          (s) => coresPedidos[s] || "#94a3b8",
        );

        this.charts.status = new Chart(ctx, {
          type: "doughnut",
          data: {
            datasets: [
              {
                label: "Status das Atas",
                data: dataAtas,
                backgroundColor: coresAtasArray,
                borderColor: "white",
                borderWidth: 2,
                circumference: 180,
                rotation: 270,
                borderRadius: 4,
              },
              {
                label: "Status dos Pedidos",
                data: dataPedidos,
                backgroundColor: coresPedidosArray,
                borderColor: "white",
                borderWidth: 2,
                circumference: 180,
                rotation: 90,
                borderRadius: 4,
              },
            ],
            labels: [...labelsAtas, ...labelsPedidos],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: "50%",
            plugins: {
              legend: {
                position: "bottom",
                labels: {
                  padding: 12,
                  usePointStyle: true,
                  pointStyle: "circle",
                  font: { size: 10, weight: "500" },
                },
              },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    const dataset = context.dataset;
                    const total = dataset.data.reduce((a, b) => a + b, 0);
                    const value = context.parsed;
                    const percentage =
                      total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                    return `${context.label}: ${value} (${percentage}%)`;
                  },
                },
              },
            },
          },
        });

        canvas.style.display = "block";
        document.querySelector("#graficoStatus .skeleton-doughnut")?.remove();
      }
    } catch (error) {
      console.error("Erro ao carregar gráfico de status:", error);
    }
  }

  // ============================================
  // 4. PEDIDOS PENDENTES
  // ============================================
  async carregarPedidosPendentes() {
    try {
      const container = document.getElementById("listaPedidosPendentes");
      if (!container) return;

      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero_pedido, valor_total, data_solicitacao, usuario_id, ata_id",
        )
        .eq("status_aprovacao", "AGUARDANDO_APROVACAO")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!pedidos || pedidos.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-check-circle",
          "Nenhum pedido pendente",
          "Todos os pedidos foram processados.",
          "var(--success-600)",
        );
        return;
      }

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

      container.innerHTML = pedidos
        .map(
          (p) => `
        <div class="lista-item clickable" onclick="sistema.ativarTab('pedidos')">
          <div class="item-info">
            <span class="item-titulo">${p.numero_pedido || "N/I"}</span>
            <span class="item-subtitulo">
              <i class="fas fa-file-contract"></i> Ata ${ataMap[p.ata_id] || "N/I"} ·
              ${usuarioMap[p.usuario_id] || "Usuário"}
            </span>
          </div>
          <div class="item-valor warning">${this.sistema.ui.formatarMoeda(p.valor_total || 0)}</div>
        </div>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Erro ao carregar pedidos pendentes:", error);
    }
  }

  // ============================================
  // 5. PRÓXIMOS VENCIMENTOS
  // ============================================
  async carregarVencimentos() {
    try {
      const container = document.getElementById("listaVencimentos");
      if (!container) return;

      const hoje = new Date();
      const trintaDias = new Date();
      trintaDias.setDate(trintaDias.getDate() + 30);

      const { data: atas, error } = await supabase
        .from("atas")
        .select(
          "id, numero_ata, data_fim_vigencia, fornecedor_id, valor_global, situacao",
        )
        .gte("data_fim_vigencia", hoje.toISOString().split("T")[0])
        .lte("data_fim_vigencia", trintaDias.toISOString().split("T")[0])
        .in("situacao", ["ATIVA", "PROXIMA"])
        .order("data_fim_vigencia", { ascending: true })
        .limit(5);

      if (error) throw error;

      if (!atas || atas.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-calendar-check",
          "Nenhum vencimento próximo",
          "Nenhuma ata vence nos próximos 30 dias.",
          "var(--success-600)",
        );
        return;
      }

      const fornecedorIds = atas.map((a) => a.fornecedor_id).filter(Boolean);
      const { data: fornecedores } = await supabase
        .from("fornecedores")
        .select("id, razao_social")
        .in("id", fornecedorIds);
      const fornecedorMap = {};
      fornecedores?.forEach((f) => (fornecedorMap[f.id] = f.razao_social));

      container.innerHTML = atas
        .map((a) => {
          const dias = Math.ceil(
            (new Date(a.data_fim_vigencia) - hoje) / (1000 * 60 * 60 * 24),
          );
          const statusClass = dias <= 7 ? "urgente" : "warning";

          return `
          <div class="lista-item clickable" onclick="sistema.consulta.abrirDetalhes(${a.id})">
            <div class="item-info">
              <span class="item-titulo">Ata ${a.numero_ata}</span>
              <span class="item-subtitulo">
                <i class="fas fa-building"></i> ${fornecedorMap[a.fornecedor_id] || "N/I"}
              </span>
            </div>
            <div class="item-valor ${statusClass}">
              ${dias} dia${dias !== 1 ? "s" : ""}
            </div>
          </div>
        `;
        })
        .join("");
    } catch (error) {
      console.error("Erro ao carregar vencimentos:", error);
    }
  }

  // ============================================
  // 6. ATIVIDADES RECENTES (legado — mantido para compatibilidade)
  // ============================================
  async carregarAtividadesRecentes() {
    try {
      const container = document.getElementById("listaAtividades");
      if (!container) return;

      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select(
          "id, numero_pedido, status_aprovacao, created_at, usuario_id, ata_id",
        )
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;

      if (!pedidos || pedidos.length === 0) {
        container.innerHTML = `
          <div class="lista-placeholder" style="display:flex; padding: 20px;">
            <i class="fas fa-inbox"></i>
            <p>Nenhuma atividade recente</p>
          </div>
        `;
        return;
      }

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

      const icons = {
        APROVADO: {
          icon: "fa-check-circle",
          class: "success",
          label: "Aprovado",
        },
        REJEITADO: {
          icon: "fa-times-circle",
          class: "rejeitado",
          label: "Rejeitado",
        },
        AGUARDANDO_APROVACAO: {
          icon: "fa-clock",
          class: "pendente",
          label: "Aguardando",
        },
        PEDIDO_REALIZADO: {
          icon: "fa-file-invoice",
          class: "pendente",
          label: "Realizado",
        },
      };

      container.innerHTML = pedidos
        .map((p) => {
          const info = icons[p.status_aprovacao] || icons["PEDIDO_REALIZADO"];
          return `
          <div class="lista-item clickable" onclick="sistema.ativarTab('pedidos')">
            <div class="item-info">
              <span class="item-titulo">
                <i class="fas ${info.icon}" style="color: var(--${info.class === "success" ? "success" : info.class === "rejeitado" ? "error" : "warning"}-600);"></i>
                Pedido ${p.numero_pedido || "N/I"}
              </span>
              <span class="item-subtitulo">
                ${usuarioMap[p.usuario_id] || "Usuário"} ·
                Ata ${ataMap[p.ata_id] || "N/I"}
              </span>
            </div>
            <div class="item-status ${info.class}">${info.label}</div>
          </div>
        `;
        })
        .join("");
    } catch (error) {
      console.error("Erro ao carregar atividades:", error);
    }
  }

  // ============================================
  // 7. EVOLUÇÃO MENSAL
  // ============================================
  async carregarEvolucaoMensal() {
    try {
      const canvas = document.getElementById("graficoEvolucaoCanvas");
      if (!canvas) return;

      const hoje = new Date();
      const seisMeses = new Date();
      seisMeses.setMonth(seisMeses.getMonth() - 6);

      const { data: consumos, error } = await supabase
        .from("consumos")
        .select("valor_total, data_consumo, created_at")
        .gte("data_consumo", seisMeses.toISOString().split("T")[0])
        .order("data_consumo", { ascending: true });

      if (error) throw error;

      const meses = {};
      const mesesLabels = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        meses[key] = { total: 0, label: label };
        mesesLabels.push(key);
      }

      consumos?.forEach((c) => {
        const data = c.data_consumo || c.created_at;
        if (data) {
          const d = new Date(data);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (meses[key]) {
            meses[key].total += c.valor_total || 0;
          }
        }
      });

      const labels = mesesLabels.map((k) => meses[k]?.label || k);
      const data = mesesLabels.map((k) => meses[k]?.total || 0);

      if (data.every((v) => v === 0)) {
        this.mostrarVazio(
          "graficoEvolucao",
          "fa-inbox",
          "Nenhum consumo nos últimos 6 meses",
        );
        return;
      }

      if (typeof Chart !== "undefined") {
        if (this.charts.evolucao) this.charts.evolucao.destroy();

        const ctx = canvas.getContext("2d");
        this.charts.evolucao = new Chart(ctx, {
          type: "line",
          data: {
            labels: labels,
            datasets: [
              {
                label: "Consumo Mensal (R$)",
                data: data,
                borderColor: "#0d5e3a",
                backgroundColor: "rgba(13, 94, 58, 0.1)",
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#0d5e3a",
                pointBorderColor: "white",
                pointBorderWidth: 2,
                pointRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: function (context) {
                    return `R$ ${context.parsed.y.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
                  },
                },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function (value) {
                    return `R$ ${value.toLocaleString("pt-BR")}`;
                  },
                },
              },
            },
          },
        });

        canvas.style.display = "block";
        document
          .querySelector("#graficoEvolucao .skeleton-chart-line")
          ?.remove();
      } else {
        this.renderizarGraficoSimples("graficoEvolucao", labels, data, true);
      }
    } catch (error) {
      console.error("Erro ao carregar evolução mensal:", error);
    }
  }

  // ============================================
  // 8. TOP FORNECEDORES
  // ============================================
  async carregarTopFornecedores() {
    try {
      const container = document.getElementById("listaTopFornecedores");
      if (!container) return;

      const { data: fornecedores, error } = await supabase
        .from("fornecedores")
        .select("id, razao_social, cnpj");

      if (error) throw error;

      if (!fornecedores || fornecedores.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-inbox",
          "Nenhum fornecedor encontrado",
          "Cadastre fornecedores para vê-los aqui.",
        );
        return;
      }

      const fornecedorIds = fornecedores.map((f) => f.id);
      const { data: atas } = await supabase
        .from("atas")
        .select("fornecedor_id, valor_global, situacao")
        .in("fornecedor_id", fornecedorIds)
        .in("situacao", ["ATIVA", "PROXIMA"]);

      const totalPorFornecedor = {};
      atas?.forEach((a) => {
        if (!totalPorFornecedor[a.fornecedor_id]) {
          totalPorFornecedor[a.fornecedor_id] = 0;
        }
        totalPorFornecedor[a.fornecedor_id] += a.valor_global || 0;
      });

      const ranking = fornecedores
        .map((f) => ({
          ...f,
          total: totalPorFornecedor[f.id] || 0,
          total_atas: atas?.filter((a) => a.fornecedor_id === f.id).length || 0,
        }))
        .filter((f) => f.total > 0)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      if (ranking.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-inbox",
          "Nenhum fornecedor com atas ativas",
          "Nada a exibir por aqui.",
        );
        return;
      }

      container.innerHTML = ranking
        .map(
          (f, index) => `
        <div class="lista-item clickable" onclick="sistema.dashboard.abrirDetalhesFornecedor(${f.id}, '${(f.razao_social || "").replace(/'/g, "\\'")}')">
          <div class="item-info">
            <span class="item-titulo">${index + 1}. ${f.razao_social || "N/I"}</span>
            <span class="item-subtitulo">
              <i class="fas fa-file-contract"></i> ${f.total_atas || 0} ata${f.total_atas !== 1 ? "s" : ""}
            </span>
          </div>
          <div class="item-valor success">${this.sistema.ui.formatarMoeda(f.total)}</div>
        </div>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Erro ao carregar top fornecedores:", error);
    }
  }

  // ============================================
  // 9. TIMELINE DE ATIVIDADES
  // ============================================
  async carregarTimeline() {
    try {
      const container = document.getElementById("listaTimeline");
      if (!container) return;

      const hoje = new Date();
      const ontem = new Date();
      ontem.setDate(ontem.getDate() - 1);

      const { data: pedidos, error: pedError } = await supabase
        .from("pedidos")
        .select(
          "id, numero_pedido, status_aprovacao, created_at, usuario_id, ata_id",
        )
        .order("created_at", { ascending: false })
        .limit(10);
      if (pedError) throw pedError;

      const { data: aditivos, error: aditError } = await supabase
        .from("aditivos_ata")
        .select("id, numero_aditivo, created_at, ata_original_id")
        .order("created_at", { ascending: false })
        .limit(5);
      if (aditError) throw aditError;

      const { data: atas, error: atasError } = await supabase
        .from("atas")
        .select("id, numero_ata, created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (atasError) throw atasError;

      const userIds = pedidos?.map((p) => p.usuario_id).filter(Boolean) || [];
      const { data: usuarios } = await supabase
        .from("usuarios")
        .select("id, nome")
        .in("id", userIds);
      const usuarioMap = {};
      usuarios?.forEach((u) => (usuarioMap[u.id] = u.nome));

      const allAtaIds = [
        ...(pedidos?.map((p) => p.ata_id).filter(Boolean) || []),
        ...(aditivos?.map((a) => a.ata_original_id).filter(Boolean) || []),
      ];
      const uniqueAtaIds = [...new Set(allAtaIds)];
      const { data: atasMapData } = await supabase
        .from("atas")
        .select("id, numero_ata")
        .in("id", uniqueAtaIds);
      const ataNumeroMap = {};
      atasMapData?.forEach((a) => (ataNumeroMap[a.id] = a.numero_ata));

      const atividades = [];

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
          descricao: `${statusInfo.label} · Ata ${ataNumeroMap[p.ata_id] || "N/I"}`,
          usuario: usuarioMap[p.usuario_id] || "Usuário",
          icon: statusInfo.icon,
          iconClass: statusInfo.iconClass,
        });
      });

      aditivos?.forEach((a) => {
        const data = new Date(a.created_at);
        atividades.push({
          id: `aditivo-${a.id}`,
          data: data,
          tipo: "aditivo",
          titulo: `Aditivo ${a.numero_aditivo || "N/I"}`,
          descricao: `Ata ${ataNumeroMap[a.ata_original_id] || "N/I"}`,
          usuario: "Sistema",
          icon: "info",
          iconClass: "fa-file-contract",
        });
      });

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
        });
      });

      atividades.sort((a, b) => b.data - a.data);
      const atividadesLimit = atividades.slice(0, 15);

      if (atividadesLimit.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-inbox",
          "Nenhuma atividade recente",
          "As ações aparecerão aqui conforme ocorrerem.",
        );
        return;
      }

      const grupos = {};
      const hojeStr = hoje.toDateString();
      const ontemStr = ontem.toDateString();

      atividadesLimit.forEach((a) => {
        const dataStr = a.data.toDateString();
        let label;
        if (dataStr === hojeStr) label = "Hoje";
        else if (dataStr === ontemStr) label = "Ontem";
        else
          label = a.data.toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "short",
          });
        if (!grupos[label]) grupos[label] = [];
        grupos[label].push(a);
      });

      const iconMap = {
        success: { bg: "var(--success-100)", color: "var(--success-600)" },
        warning: { bg: "var(--warning-100)", color: "var(--warning-600)" },
        danger: { bg: "var(--error-100)", color: "var(--error-600)" },
        info: { bg: "var(--primary-100)", color: "var(--primary-600)" },
      };

      let html = "";
      for (const [label, items] of Object.entries(grupos)) {
        html += `<div class="timeline-grupo">
          <div class="grupo-label">${label}</div>`;

        items.forEach((item) => {
          const estilo = iconMap[item.icon] || iconMap.info;
          const hora = item.data.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          });

          html += `
            <div class="timeline-item">
              <div class="timeline-icon" style="background: ${estilo.bg}; color: ${estilo.color};">
                <i class="fas ${item.iconClass}"></i>
              </div>
              <div class="timeline-content">
                <div class="timeline-titulo">${item.titulo}</div>
                <div class="timeline-descricao">
                  <span>${item.descricao}</span>
                  <span>·</span>
                  <span>${item.usuario}</span>
                </div>
              </div>
              <div class="timeline-hora">${hora}</div>
            </div>
          `;
        });

        html += `</div>`;
      }

      container.innerHTML = html;
    } catch (error) {
      console.error("Erro ao carregar timeline:", error);
    }
  }

  // ============================================
  // 10. AÇÕES RÁPIDAS
  // ============================================
  async carregarAcoesRapidas() {
    try {
      const container = document.getElementById("acoesRapidasContainer");
      if (!container) return;

      const perfil = this.sistema.usuarioAtual?.perfil;
      const podeCadastrar = perfil === "ADMIN" || perfil === "ESTAGIARIO";

      const acoes = [];

      if (podeCadastrar) {
        acoes.push({
          id: "nova-ata",
          icon: "fa-file-contract",
          label: "Nova Ata",
          onclick: `sistema.ativarTab('cadastro')`,
        });
      }

      acoes.push({
        id: "pedidos-pendentes",
        icon: "fa-file-invoice",
        label: "Pedidos Pendentes",
        onclick: `sistema.ativarTab('pedidos')`,
      });

      if (perfil === "ADMIN" || perfil === "ESTAGIARIO") {
        acoes.push({
          id: "alertas",
          icon: "fa-exclamation-triangle",
          label: "Alertas Críticos",
          onclick: `sistema.ativarTab('gestao')`,
        });
      }

      if (perfil === "ADMIN") {
        acoes.push({
          id: "relatorio",
          icon: "fa-chart-bar",
          label: "Relatório",
          onclick: `sistema.gerarRelatorioDivergencia()`,
        });
      }

      if (acoes.length === 0) {
        container.innerHTML = "";
        return;
      }

      container.innerHTML = acoes
        .map(
          (a) => `
        <button class="btn-acao-rapida" onclick="${a.onclick}">
          <i class="fas ${a.icon}"></i>
          <span class="btn-label">${a.label}</span>
        </button>
      `,
        )
        .join("");
    } catch (error) {
      console.error("Erro ao carregar ações rápidas:", error);
    }
  }

  // ============================================================
  // ============================================================
  // NOVO · WIDGET · ALERTAS PRIORITÁRIOS
  // ============================================================
  // ============================================================
  async carregarAlertasPrioritarios() {
    try {
      const container = document.getElementById("listaAlertasPrioritarios");
      const badge = document.getElementById("badgeAlertasPrioritarios");
      if (!container) return;

      // Fonte: getAlertasDashboard (já existente)
      const alertas = await this.sistema.gestao.getAlertasDashboard();

      const itens = [];

      if (alertas?.itensCriticos > 0) {
        itens.push({
          tipo: "critico",
          icon: "fa-exclamation-triangle",
          titulo: "Itens com saldo crítico",
          descricao: `${alertas.itensCriticos} item(ns) com saldo abaixo de 10% do contratado.`,
          contagem: alertas.itensCriticos,
          acao: () => this.irParaGestao(),
        });
      }

      if (alertas?.atasVencendo > 0) {
        itens.push({
          tipo: "aviso",
          icon: "fa-calendar-times",
          titulo: "Atas vencendo em 15 dias",
          descricao: `${alertas.atasVencendo} ata(s) vencem nos próximos 15 dias.`,
          contagem: alertas.atasVencendo,
          acao: () => this.irParaConsulta({ status: "PROXIMA" }),
        });
      }

      if (alertas?.pedidosAntigos > 0) {
        itens.push({
          tipo: "aviso",
          icon: "fa-hourglass-half",
          titulo: "Pedidos parados há +7 dias",
          descricao: `${alertas.pedidosAntigos} pedido(s) aguardando aprovação há mais de uma semana.`,
          contagem: alertas.pedidosAntigos,
          acao: () => this.sistema.ativarTab("pedidos"),
        });
      }

      if (itens.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-shield-check",
          "Tudo em ordem",
          "Nenhum alerta prioritário no momento.",
          "var(--success-600)",
        );
        if (badge) badge.textContent = "0";
        return;
      }

      if (badge) badge.textContent = String(itens.length);

      container.innerHTML = `<div class="alertas-lista">${itens
        .map(
          (i, idx) => `
          <div class="alerta-item alerta-${i.tipo}" data-alerta-idx="${idx}">
            <div class="alerta-icon"><i class="fas ${i.icon}"></i></div>
            <div class="alerta-content">
              <div class="alerta-titulo">${i.titulo}</div>
              <div class="alerta-descricao">${i.descricao}</div>
            </div>
            <div class="alerta-contagem">${i.contagem}</div>
          </div>
        `,
        )
        .join("")}</div>`;

      // Liga os cliques
      container.querySelectorAll(".alerta-item").forEach((el) => {
        el.addEventListener("click", () => {
          const idx = parseInt(el.dataset.alertaIdx);
          if (itens[idx]?.acao) itens[idx].acao();
        });
      });
    } catch (error) {
      console.error("Erro ao carregar alertas prioritários:", error);
    }
  }

  // ============================================================
  // ============================================================
  // NOVO · WIDGET · TERMÔMETRO DE EXECUÇÃO
  // ============================================================
  // ============================================================
  async carregarTermometroExecucao() {
    try {
      const container = document.getElementById("termometroExecucao");
      if (!container) return;

      // Soma valor global das atas ativas e consumos
      const { data: atas } = await supabase
        .from("atas")
        .select("id, valor_global")
        .in("situacao", ["ATIVA", "PROXIMA"]);

      const totalContratado = (atas || []).reduce(
        (s, a) => s + (a.valor_global || 0),
        0,
      );

      const { data: consumos } = await supabase
        .from("consumos")
        .select("valor_total");

      const totalConsumido = (consumos || []).reduce(
        (s, c) => s + (c.valor_total || 0),
        0,
      );

      const percentual =
        totalContratado > 0
          ? Math.min((totalConsumido / totalContratado) * 100, 100)
          : 0;
      const disponivel = totalContratado - totalConsumido;

      // SVG do termômetro circular
      const raio = 78;
      const circunferencia = 2 * Math.PI * raio;
      const offset = circunferencia * (1 - percentual / 100);

      container.innerHTML = `
        <div class="termometro-svg">
          <svg viewBox="0 0 180 180" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="gradienteTermometro" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#10b981" />
                <stop offset="100%" stop-color="#0d5e3a" />
              </linearGradient>
            </defs>
            <circle class="track" cx="90" cy="90" r="${raio}" />
            <circle
              class="progress"
              cx="90"
              cy="90"
              r="${raio}"
              stroke-dasharray="${circunferencia}"
              stroke-dashoffset="${offset}"
            />
          </svg>
          <div class="termometro-valor-central">
            <div class="percentual">${percentual.toFixed(0)}%</div>
            <div class="rotulo">Consumido</div>
          </div>
        </div>
        <div class="termometro-info">
          <div class="termometro-info-item">
            <div class="valor consumido">${this.sistema.ui.formatarMoeda(totalConsumido)}</div>
            <div class="label">Consumido</div>
          </div>
          <div class="termometro-info-item">
            <div class="valor disponivel">${this.sistema.ui.formatarMoeda(disponivel)}</div>
            <div class="label">Disponível</div>
          </div>
        </div>
      `;
    } catch (error) {
      console.error("Erro ao carregar termômetro:", error);
    }
  }

  // ============================================================
  // ============================================================
  // NOVO · WIDGET · AGING DE PEDIDOS
  // ============================================================
  // ============================================================
  async carregarAgingPedidos() {
    try {
      const container = document.getElementById("agingPedidos");
      if (!container) return;

      const { data: pedidos, error } = await supabase
        .from("pedidos")
        .select("id, created_at, status_aprovacao")
        .eq("status_aprovacao", "AGUARDANDO_APROVACAO");

      if (error) throw error;

      if (!pedidos || pedidos.length === 0) {
        container.innerHTML = `
          <div class="aging-vazio">
            <i class="fas fa-check-circle"></i>
            Nenhum pedido parado. Tudo em dia!
          </div>
        `;
        return;
      }

      const hoje = new Date();
      const faixas = { ok: 0, atencao: 0, alerta: 0, critico: 0 };

      pedidos.forEach((p) => {
        const dt = new Date(p.created_at);
        const dias = Math.floor((hoje - dt) / (1000 * 60 * 60 * 24));
        if (dias <= 7) faixas.ok++;
        else if (dias <= 15) faixas.atencao++;
        else if (dias <= 30) faixas.alerta++;
        else faixas.critico++;
      });

      const total = pedidos.length;
      const maxValor = Math.max(
        faixas.ok,
        faixas.atencao,
        faixas.alerta,
        faixas.critico,
        1,
      );

      const linhas = [
        { label: "0–7 dias", valor: faixas.ok, classe: "aging-ok" },
        { label: "8–15 dias", valor: faixas.atencao, classe: "aging-atencao" },
        { label: "16–30 dias", valor: faixas.alerta, classe: "aging-alerta" },
        { label: "+30 dias", valor: faixas.critico, classe: "aging-critico" },
      ];

      container.innerHTML = `<div class="aging-lista">${linhas
        .map(
          (l) => `
          <div class="aging-item">
            <div class="aging-label">${l.label}</div>
            <div class="aging-bar-wrap">
              <div class="aging-bar ${l.classe}" style="width: ${Math.max((l.valor / maxValor) * 100, 3)}%">
                ${l.valor > 0 ? l.valor : ""}
              </div>
            </div>
            <div class="aging-count">${l.valor}</div>
          </div>
        `,
        )
        .join("")}</div>`;
    } catch (error) {
      console.error("Erro ao carregar aging de pedidos:", error);
    }
  }

  // ============================================================
  // ============================================================
  // NOVO · WIDGET · TOP ITENS MAIS CONSUMIDOS
  // ============================================================
  // ============================================================
  async carregarTopItens() {
    try {
      const container = document.getElementById("listaTopItens");
      if (!container) return;

      const { inicio, fim } = this.obterIntervaloAtivo();

      let query = supabase
        .from("consumos")
        .select("item_ata_id, quantidade, valor_total")
        .gte("data_consumo", this.toISODate(inicio))
        .lte("data_consumo", this.toISODate(fim));

      const { data: consumos, error } = await query;

      if (error) throw error;

      if (!consumos || consumos.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-inbox",
          "Nenhum consumo no período",
          "Ajuste o filtro de período ou aguarde novas movimentações.",
        );
        return;
      }

      // Agrupa por item
      const porItem = {};
      consumos.forEach((c) => {
        if (!c.item_ata_id) return;
        if (!porItem[c.item_ata_id]) {
          porItem[c.item_ata_id] = { quantidade: 0, valor: 0 };
        }
        porItem[c.item_ata_id].quantidade += c.quantidade || 0;
        porItem[c.item_ata_id].valor += c.valor_total || 0;
      });

      const itemIds = Object.keys(porItem).map((id) => parseInt(id));

      const { data: itens } = await supabase
        .from("itens_ata")
        .select("id, descricao, item_numero, ata_id, unidade_medida")
        .in("id", itemIds);

      const itemMap = {};
      itens?.forEach((it) => (itemMap[it.id] = it));

      // Ordena por quantidade
      const ranking = Object.entries(porItem)
        .map(([id, info]) => ({
          id: parseInt(id),
          ...info,
          item: itemMap[parseInt(id)],
        }))
        .filter((r) => r.item)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

      if (ranking.length === 0) {
        this.mostrarVazioLista(
          container,
          "fa-inbox",
          "Nenhum item identificado",
          "Não foi possível mapear os itens consumidos.",
        );
        return;
      }

      container.innerHTML = `<div class="top-itens-lista">${ranking
        .map((r, idx) => {
          const medalha =
            idx === 0
              ? "🥇"
              : idx === 1
                ? "🥈"
                : idx === 2
                  ? "🥉"
                  : String(idx + 1);
          const itemNum = r.item?.item_numero ? `#${r.item.item_numero}` : "";
          const unidade = r.item?.unidade_medida || "un";

          return `
            <div class="top-item top-${idx + 1}">
              <div class="top-medalha">${medalha}</div>
              <div class="top-info">
                <div class="top-descricao">${r.item?.descricao || "Item"}</div>
                <div class="top-meta">
                  <span>${itemNum}</span>
                  <span><i class="fas fa-coins"></i> ${this.sistema.ui.formatarMoeda(r.valor)}</span>
                </div>
              </div>
              <div class="top-quantidade">
                ${r.quantidade}
                <small>${unidade}</small>
              </div>
            </div>
          `;
        })
        .join("")}</div>`;
    } catch (error) {
      console.error("Erro ao carregar top itens:", error);
    }
  }

  // ============================================================
  // ============================================================
  // HELPERS · EMPTY STATES
  // ============================================================
  // ============================================================

  /**
   * Substitui o conteúdo de um gráfico por um empty state rico.
   */
  mostrarVazio(containerId, icone = "fa-inbox", mensagem = "Sem dados") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Esconde canvas
    const canvas = container.querySelector("canvas");
    if (canvas) {
      canvas.style.display = "none";
      canvas.dataset.vazio = "1";
    }

    // Remove skeletons
    container.querySelector(".skeleton-chart")?.remove();
    container.querySelector(".skeleton-chart-line")?.remove();
    container.querySelector(".skeleton-doughnut")?.remove();
    container.querySelector(".skeleton-circle")?.remove();
    container.querySelector(".grafico-placeholder")?.remove();

    // Adiciona empty state (se já não existir)
    if (!container.querySelector(".empty-state")) {
      const el = document.createElement("div");
      el.className = "empty-state";
      el.innerHTML = `
        <i class="fas ${icone} empty-icon"></i>
        <div class="empty-titulo">${mensagem}</div>
        <div class="empty-descricao">Os dados aparecerão aqui quando houver movimentação.</div>
      `;
      container.appendChild(el);
    }
  }

  /**
   * Substitui o conteúdo de uma lista por um empty state rico.
   */
  mostrarVazioLista(
    container,
    icone = "fa-inbox",
    titulo = "Sem dados",
    descricao = "",
    corIcone = null,
  ) {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas ${icone} empty-icon" ${corIcone ? `style="color:${corIcone}"` : ""}></i>
        <div class="empty-titulo">${titulo}</div>
        <div class="empty-descricao">${descricao}</div>
      </div>
    `;
  }

  // ============================================
  // GRÁFICO SIMPLES (FALLBACK SEM CHART.JS)
  // ============================================
  renderizarGraficoSimples(containerId, labels, data, isLine = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const max = Math.max(...data, 1);
    const colors = [
      "#0d5e3a",
      "#1a3a6b",
      "#059669",
      "#d97706",
      "#dc2626",
      "#7c3aed",
      "#0891b2",
      "#b45309",
    ];

    let html = `<div class="grafico-simples" style="padding: 10px;">`;

    if (isLine) {
      const pontos = data
        .map((v, i) => {
          const altura = (v / max) * 100;
          return `<div class="grafico-ponto" style="height: ${Math.max(altura, 5)}px; background: ${colors[i % colors.length]};"></div>`;
        })
        .join("");

      html += `
        <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 120px; gap: 8px;">
          ${pontos}
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.6rem; color: var(--neutral-400);">
          ${labels.map((l) => `<span>${l}</span>`).join("")}
        </div>
      `;
    } else {
      html += `
        <div style="display: flex; flex-direction: column; gap: 8px;">
          ${data
            .map((v, i) => {
              const percent = (v / max) * 100;
              return `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.7rem; width: 80px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${labels[i]}</span>
                <div style="flex: 1; height: 20px; background: var(--neutral-200); border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${Math.max(percent, 2)}%; background: ${colors[i % colors.length]}; border-radius: 4px; transition: width 0.3s;"></div>
                </div>
                <span style="font-size: 0.7rem; font-weight: 600; min-width: 80px; text-align: right;">${this.sistema.ui.formatarMoeda(v)}</span>
              </div>
            `;
            })
            .join("")}
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;
  }
}
