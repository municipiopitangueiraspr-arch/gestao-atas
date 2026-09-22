// ============================================
// CONTROLE DE SALDOS/js/main.js
// Ponto de entrada do módulo de Gestão de Atas
// ============================================

import { supabase } from "./supabase.js";
import { Auth } from "./modules/auth.js";
import { UI } from "./modules/ui.js";
import { Consulta } from "./modules/consulta.js";
import { Gestao } from "./modules/gestao.js";
import { Cadastro } from "./modules/cadastro.js";
import { Pedidos } from "./modules/pedidos.js";
import { Aditivos } from "./modules/aditivos.js";
// ============================================================
// CORREÇÃO: Importar módulo Dashboard
// ============================================================
import { Dashboard } from "./modules/dashboard.js";
// ============================================================
// NOVO: Importar módulo Carrinho (view SPA)
// Substitui a antiga página standalone carrinho.html.
// O módulo é renderizado em #carrinhoContent e ativado via
// sistema.ativarTab("carrinho").
// ============================================================
import { Carrinho } from "./modules/carrinho.js";
// ============================================================
// Layout compartilhado da intranet (sidebar + topbar)
// ============================================================
import { initLayout } from "../../shared/js/layout.js";
// ============================================================
// REMOVIDAS: Importações de Orgaos e Usuarios
// Agora gerenciados pelo módulo Core (core/orgaos/ e core/usuarios/)
// ============================================================
// import { Orgaos } from "./modules/orgaos.js";
// import { Usuarios } from "./modules/usuarios.js";

class SistemaGestaoAtas {
  constructor() {
    this.usuarioAtual = null;
    this.ataSelecionada = null;
    this.ataParaAditivo = null;
    this.carrinho = [];
    this.pdfData = null;
    this.itensCadastroTemp = [];
    this.filtroTimer = null;
    this.orgaos = [];
    this.categorias = [];
    this.aditivosFiltrados = [];
    this.filtrosGestaoAtivos = {
      busca: "",
      fornecedor: "todos",
      orgao: "todos",
      statusAta: "todos",
      saldo: "todos",
      ocultarZerados: false,
      apenas30dias: false,
    };
    this.confirmacaoResolver = null;
    // Cache para evitar múltiplas requisições
    this._cache = {
      orgaos: null,
      categorias: null,
      fornecedores: null,
    };

    // Inicializar módulos
    this.auth = new Auth(this);
    this.ui = new UI(this);
    this.consulta = new Consulta(this);
    this.gestao = new Gestao(this);
    this.cadastro = new Cadastro(this);
    this.pedidos = new Pedidos(this);
    this.aditivos = new Aditivos(this);
    // ============================================================
    // CORREÇÃO: Instanciar módulo Dashboard
    // ============================================================
    this.dashboard = new Dashboard(this);
    // ============================================================
    // NOVO: Instanciar módulo Carrinho (view SPA)
    // ============================================================
    this.carrinhoModule = new Carrinho(this);
    // ============================================================
    // REMOVIDOS: Módulos Orgaos e Usuarios
    // Agora gerenciados pelo módulo Core
    // ============================================================
    // this.orgaosModule = new Orgaos(this);
    // this.usuariosModule = new Usuarios(this);

    this.init();
  }

  // ============================================
  // INICIALIZAÇÃO
  // ============================================
  // ============================================================
  // init() agora usa o layout compartilhado
  // (shared/js/layout.js) que monta sidebar + topbar e cuida
  // da autenticação. Substitui a antiga verificação de sessão
  // manual e o carregamento via auth.carregarUsuario().
  // ============================================================
  async init() {
    try {
      // ============================================================
      // Inicializa layout compartilhado (sidebar + topbar + auth)
      // ============================================================
      const usuario = await initLayout({
        supabase,

        // Marca exibida no topo da sidebar
        brand: {
          nome: "Gestão de Atas",
          subtitulo: "Compras e Licitações",
          icone: "fa-file-contract",
        },

        // Topbar (título da página)
        iconeTitulo: "fa-file-contract",
        titulo: "Painel Administrativo",
        subtitulo: "Gestão de atas, contratos e consumos",

        // Menu da sidebar — cada item ativa uma view.
        // A `rota` é um hash (#dashboard, #consulta, …)
        // que o main.js intercepta para chamar ativarTab().
        menu: [
          {
            section: "Principal",
            itens: [
              {
                id: "dashboard",
                rota: "#dashboard",
                icone: "fa-chart-pie",
                label: "Dashboard",
              },
              {
                id: "consulta",
                rota: "#consulta",
                icone: "fa-search",
                label: "Consulta",
              },
            ],
          },
          {
            section: "Gestão",
            itens: [
              {
                id: "gestao",
                rota: "#gestao",
                icone: "fa-boxes",
                label: "Gestão de Itens",
              },
              {
                id: "cadastro",
                rota: "#cadastro",
                icone: "fa-plus-circle",
                label: "Cadastrar Ata",
              },
              {
                id: "carrinho",
                rota: "#carrinho",
                icone: "fa-shopping-cart",
                label: "Meu Carrinho",
              },
              {
                id: "pedidos",
                rota: "#pedidos",
                icone: "fa-file-invoice",
                label: "Pedidos",
              },
              {
                id: "aditivos",
                rota: "#aditivos",
                icone: "fa-file-contract",
                label: "Aditivos",
              },
            ],
          },
        ],

        rotaVoltar: "../intranet.html",
        textoVoltar: "Voltar à intranet",

        // Chamado após o layout renderizar e o usuário carregar
        onUsuario: (u) => {
          this.usuarioAtual = u;
          this.aplicarPermissoesSidebar(u);
        },
      });

      if (!usuario) return; // layout.js já redirecionou

      // Carregar dados iniciais em cache
      await this.carregarDadosIniciais();

      this.carregarCarrinhoStorage();
      this.configurarEventosGlobais();

      // ============================================================
      // Ativar a view inicial com base na hash da URL
      // (ex: gestaoatas.html#pedidos abre direto em Pedidos)
      // Fallback: dashboard
      // ============================================================
      const hashView = (window.location.hash || "").replace("#", "").trim();
      const viewInicial =
        hashView && document.getElementById(`${hashView}Content`)
          ? hashView
          : "dashboard";

      setTimeout(() => this.ativarTab(viewInicial), 100);
    } catch (error) {
      console.error("Erro ao inicializar sistema:", error);
      window.location.href = "../index.html";
    }
  }

  // ============================================================
  // Aplica permissões na sidebar depois que o layout renderiza.
  // O layout.js só suporta adminOnly (perfil exato "ADMIN"),
  // então filtramos aqui os itens restritos a ADMIN OU ESTAGIARIO.
  //
  // Regras:
  //   · gestao / cadastro / aditivos → ADMIN ou ESTAGIARIO
  //   · carrinho                    → ADMIN, SECRETARIO ou SOLICITANTE
  //     (ESTAGIARIO não compra — é perfil de apoio à gestão)
  // ============================================================
  aplicarPermissoesSidebar(usuario) {
    const perfil = usuario?.perfil;
    const podeGestao = perfil === "ADMIN" || perfil === "ESTAGIARIO";
    const podeComprar =
      perfil === "ADMIN" || perfil === "SECRETARIO" || perfil === "SOLICITANTE";

    // Remove da sidebar os itens que exigem ADMIN ou ESTAGIARIO
    if (!podeGestao) {
      ["gestao", "cadastro", "aditivos"].forEach((id) => {
        const link = document.querySelector(
          `.sidebar-nav a[data-modulo="${id}"]`,
        );
        if (link) link.remove();
      });
    }

    // Remove o carrinho para quem não pode comprar
    if (!podeComprar) {
      const link = document.querySelector(
        `.sidebar-nav a[data-modulo="carrinho"]`,
      );
      if (link) link.remove();
    }
  }

  // ============================================
  // CARREGAR DADOS INICIAIS EM CACHE
  // ============================================
  async carregarDadosIniciais() {
    try {
      // Carregar órgãos
      await this.carregarOrgaos();
      // Carregar categorias
      await this.carregarCategorias();
      // Carregar fornecedores (para o autocomplete)
      await this.carregarFornecedores();
    } catch (error) {
      console.warn("Erro ao carregar dados iniciais:", error);
    }
  }

  // ============================================
  // CARREGAR FORNECEDORES (CACHE)
  // ============================================
  async carregarFornecedores() {
    if (this._cache.fornecedores) {
      return this._cache.fornecedores;
    }
    const { data: fornecedores } = await supabase
      .from("fornecedores")
      .select("id, razao_social, cnpj")
      .order("razao_social");
    this._cache.fornecedores = fornecedores || [];
    return this._cache.fornecedores;
  }

  // ============================================
  // CONFIGURAR EVENTOS GLOBAIS
  // ============================================
  // ============================================================
  // O botão logout da topbar agora é #btnSair, gerenciado pelo
  // layout.js. Removido o antigo listener do #btnLogout.
  // Adicionados:
  //   · clique nos itens da sidebar → ativam a view
  //   · listener de hashchange → ativa view pela URL
  //   · REMOVIDO o listener das antigas tabs horizontais
  // ============================================================
  configurarEventosGlobais() {
    // ============================================================
    // BOTÃO ABRIR DRAWER DO CARRINHO (FAB flutuante)
    // Agora o FAB abre a VIEW de carrinho (SPA), não mais a
    // antiga página standalone carrinho.html.
    // ============================================================
    document
      .getElementById("btnAbrirDrawerCarrinho")
      ?.addEventListener("click", () => {
        this.abrirDrawerCarrinho();
      });

    // Botão fechar drawer
    document
      .getElementById("btnFecharDrawer")
      ?.addEventListener("click", () => {
        this.fecharDrawerCarrinho();
      });

    // Fechar drawer ao clicar no overlay
    document.getElementById("drawerOverlay")?.addEventListener("click", () => {
      this.fecharDrawerCarrinho();
    });

    // Botão limpar carrinho no drawer
    document
      .getElementById("btnLimparDrawer")
      ?.addEventListener("click", () => {
        this.limparCarrinhoDrawer();
      });

    // Botão finalizar pedido no drawer
    document
      .getElementById("btnFinalizarDrawer")
      ?.addEventListener("click", () => {
        this.finalizarPedidoDrawer();
      });

    // Botão baixar PDF
    document.getElementById("btnBaixarPDF")?.addEventListener("click", () => {
      this.pedidos.baixarPDF();
    });

    // ============================================================
    // NAVEGAÇÃO · agora 100% pela sidebar
    // (o layout.js injeta `data-modulo` em cada <a>)
    // ============================================================
    document.querySelectorAll(".sidebar-nav a[data-modulo]").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const view = link.dataset.modulo;
        if (view) this.ativarTab(view);
      });
    });

    // ============================================================
    // hashchange (back/forward do navegador)
    // ============================================================
    window.addEventListener("hashchange", () => {
      const hashView = (window.location.hash || "").replace("#", "").trim();
      if (hashView && document.getElementById(`${hashView}Content`)) {
        this.ativarTab(hashView);
      }
    });

    // ============================================================
    // Fechar modais com ESC
    // ============================================================
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal.active").forEach((modal) => {
          modal.classList.remove("active");
        });
        // Fechar drawer também
        this.fecharDrawerCarrinho();
      }
    });

    // ============================================================
    // Confirmar e Cancelar nos modais de confirmação
    // ============================================================
    document.getElementById("confirmacaoSim")?.addEventListener("click", () => {
      this.resolverConfirmacao(true);
    });
    document.getElementById("confirmacaoNao")?.addEventListener("click", () => {
      this.resolverConfirmacao(false);
    });

    // ============================================================
    // Atalho de teclado para recarregar a VIEW atual (Ctrl+R / F5)
    // ============================================================
    document.addEventListener("keydown", (e) => {
      if ((e.ctrlKey && e.key === "r") || e.key === "F5") {
        e.preventDefault();
        const view = this.viewAtual();
        if (view) {
          this.recarregarTab(view);
          this.ui.mostrarToast("info", "Dados recarregados!");
        }
      }
    });
  }

  // ============================================================
  // HELPER · descobre qual view está ativa
  // (não existe mais "tab horizontal" para consultar, então:
  //  1) tenta pela hash da URL
  //  2) cai no primeiro conteúdo visível
  //  3) fallback final: dashboard
  // ============================================================
  viewAtual() {
    const hashView = (window.location.hash || "").replace("#", "").trim();
    if (hashView && document.getElementById(`${hashView}Content`)) {
      return hashView;
    }

    const visivel = [
      "dashboard",
      "consulta",
      "gestao",
      "cadastro",
      "carrinho",
      "pedidos",
      "aditivos",
    ].find((v) => {
      const el = document.getElementById(`${v}Content`);
      return el && el.style.display !== "none";
    });

    return visivel || "dashboard";
  }

  // ============================================
  // RECARREGAR VIEW ATUAL
  // ============================================
  recarregarTab(tabName) {
    switch (tabName) {
      case "dashboard":
        this.dashboard.carregarConteudo();
        break;
      case "consulta":
        this.consulta.carregarConteudo();
        break;
      case "gestao":
        this.gestao.carregarConteudo();
        break;
      case "cadastro":
        this.cadastro.carregarConteudo();
        break;
      case "carrinho":
        this.carrinhoModule.carregarConteudo();
        break;
      case "pedidos":
        this.pedidos.carregarConteudo();
        break;
      case "aditivos":
        this.aditivos.carregarConteudo();
        break;
      default:
        console.warn(`View "${tabName}" não reconhecida para recarregar.`);
    }
  }

  // ============================================
  // DRAWER DO CARRINHO
  // ============================================
  // ============================================================
  // NOVO COMPORTAMENTO: o FAB (btnAbrirDrawerCarrinho) agora
  // abre a VIEW de carrinho (#carrinhoContent) em vez de
  // redirecionar para a antiga página standalone carrinho.html.
  //
  // O drawer lateral (drawerCarrinho) permanece no HTML mas não
  // é mais acionado pelo FAB. Ele pode ser reaberto manualmente
  // por qualquer código que chame this.abrirDrawerLateral().
  // ============================================================
  abrirDrawerCarrinho() {
    // Vai direto para a view de carrinho integrada ao layout
    this.ativarTab("carrinho");
  }

  // ============================================================
  // ABRIR O DRAWER LATERAL (comportamento legado, mantido)
  // Use isto se quiser um preview rápido sem trocar de view.
  // ============================================================
  abrirDrawerLateral() {
    const drawer = document.getElementById("drawerCarrinho");
    const overlay = document.getElementById("drawerOverlay");
    if (!drawer || !overlay) return;

    this.renderizarDrawerCarrinho();
    drawer.classList.add("open");
    overlay.classList.add("open");
  }

  fecharDrawerCarrinho() {
    const drawer = document.getElementById("drawerCarrinho");
    const overlay = document.getElementById("drawerOverlay");

    // Se o drawer não está aberto, não faz nada (evita confirm
    // desnecessário ao apertar ESC sem intenção de fechar).
    if (!drawer?.classList.contains("open")) return;

    // Se houver itens no carrinho, perguntar se deseja fechar
    if (this.carrinho.length > 0) {
      this.confirmar(
        "Você tem itens no carrinho. Deseja realmente fechar? Eles permanecerão salvos.",
      ).then((confirmado) => {
        if (confirmado) {
          drawer?.classList.remove("open");
          overlay?.classList.remove("open");
        }
      });
    } else {
      drawer?.classList.remove("open");
      overlay?.classList.remove("open");
    }
  }

  // ============================================================
  // RENDERIZAR DRAWER DO CARRINHO
  // ============================================================
  renderizarDrawerCarrinho() {
    const container = document.getElementById("drawerItems");
    const empty = document.getElementById("drawerEmpty");
    const footer = document.getElementById("drawerFooter");
    const badge = document.getElementById("carrinhoBadgeHeader");

    console.log("🔍 Renderizando drawer. Itens no carrinho:", this.carrinho);
    console.log(
      "🔍 Carrinho completo:",
      JSON.stringify(this.carrinho, null, 2),
    );

    if (!container) return;

    // Atualizar badge
    if (badge) badge.textContent = this.carrinho.length;

    // Se carrinho vazio, mostrar estado vazio
    if (this.carrinho.length === 0) {
      if (empty) empty.style.display = "flex";
      if (container) container.style.display = "none";
      if (footer) footer.style.display = "none";
      return;
    }

    // Mostrar conteúdo
    if (empty) empty.style.display = "none";
    if (container) container.style.display = "block";
    if (footer) footer.style.display = "block";

    // Agrupar itens por ata
    const pedidosPorAta = {};
    this.carrinho.forEach((item) => {
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

    for (const [ataId, pedido] of Object.entries(pedidosPorAta)) {
      const totalAta = pedido.itens.reduce(
        (s, i) => s + (i.valorTotal || 0),
        0,
      );
      totalGeral += totalAta;

      html += `
        <div class="drawer-grupo-ata">
          <div class="drawer-grupo-header">
            <span class="drawer-grupo-titulo">📄 Ata ${pedido.ataNumero}</span>
            <span class="drawer-grupo-fornecedor">${pedido.fornecedorRazao || ""}</span>
          </div>
          ${pedido.itens
            .map(
              (i) => `
            <div class="drawer-item">
              <div class="drawer-item-info">
                <div class="drawer-item-descricao">${i.itemDescricao || "Item"}</div>
                <div class="drawer-item-meta">
                  <span>Qtd: ${i.quantidade || 0}</span>
                  <span>${this.ui.formatarMoeda(i.valorUnitario || 0)}</span>
                </div>
              </div>
              <div class="drawer-item-actions">
                <span class="drawer-item-total">${this.ui.formatarMoeda(i.valorTotal || 0)}</span>
                <button class="drawer-item-remove" onclick="sistema.removerItemDrawer('${i.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `;
    }

    container.innerHTML = html;
    document.getElementById("drawerTotal").textContent =
      this.ui.formatarMoeda(totalGeral);
  }

  // ============================================
  // REMOVER ITEM DO DRAWER
  // ============================================
  removerItemDrawer(itemId) {
    console.log("🗑️ Removendo item do carrinho:", itemId);
    this.carrinho = this.carrinho.filter((i) => i.id !== itemId);
    this.salvarCarrinhoStorage();
    this.renderizarDrawerCarrinho();
    this.atualizarCarrinhoUI();
  }

  // ============================================
  // LIMPAR CARRINHO DO DRAWER
  // ============================================
  limparCarrinhoDrawer() {
    this.confirmar("Limpar carrinho?").then((confirmado) => {
      if (confirmado) {
        this.carrinho = [];
        this.salvarCarrinhoStorage();
        this.renderizarDrawerCarrinho();
        this.atualizarCarrinhoUI();
        this.ui.mostrarToast("sucesso", "Carrinho limpo!");
      }
    });
  }

  // ============================================
  // FINALIZAR PEDIDO DO DRAWER
  // ------------------------------------------------------------
  // Como o FAB agora abre a view de carrinho (que tem seu próprio
  // botão Finalizar), o drawer lateral deixou de ser o ponto de
  // entrada padrão. Mesmo assim, mantemos o método funcional
  // delegando para o módulo Carrinho — assim, se algum código
  // chamar abrirDrawerLateral() + Finalizar, o comportamento
  // continua consistente com a view.
  // ============================================
  async finalizarPedidoDrawer() {
    if (this.carrinho.length === 0) {
      this.ui.mostrarToast(
        "aviso",
        "Carrinho vazio",
        "Adicione itens ao carrinho antes de finalizar.",
      );
      return;
    }
    // Fechar o drawer e delegar para o módulo Carrinho
    const drawer = document.getElementById("drawerCarrinho");
    const overlay = document.getElementById("drawerOverlay");
    drawer?.classList.remove("open");
    overlay?.classList.remove("open");
    await this.carrinhoModule.finalizarPedido();
  }

  // ============================================
  // ATIVAR VIEW (substitui a antiga "ativarTab")
  // ============================================
  // ============================================================
  // Não há mais tabs horizontais. Esta função agora apenas:
  //   · esconde todos os conteúdos
  //   · mostra o conteúdo alvo
  //   · marca .active na sidebar
  //   · atualiza a hash da URL
  //   · chama o carregador do módulo correspondente
  // ============================================================
  ativarTab(tab) {
    if (!this.verificarPermissaoTab(tab)) {
      // Feedback visual ao invés de falha silenciosa
      this.ui?.mostrarToast(
        "aviso",
        "Acesso restrito",
        "Você não tem permissão para acessar esta seção.",
      );
      return;
    }

    // ============================================================
    // Esconder todos os conteúdos
    // ============================================================
    const contents = [
      "dashboard",
      "consulta",
      "gestao",
      "cadastro",
      "carrinho",
      "pedidos",
      "aditivos",
    ];
    contents.forEach((c) => {
      const el = document.getElementById(`${c}Content`);
      if (el) el.style.display = "none";
    });

    // Mostrar o conteúdo selecionado
    const contentDiv = document.getElementById(`${tab}Content`);
    if (contentDiv) {
      contentDiv.style.display = "block";
    }

    // ============================================================
    // Sincronizar o item ativo na sidebar
    // ============================================================
    document.querySelectorAll(".sidebar-nav a[data-modulo]").forEach((link) => {
      link.classList.toggle("active", link.dataset.modulo === tab);
    });

    // ============================================================
    // Atualizar a hash da URL sem recarregar a página
    // ============================================================
    if (window.location.hash !== `#${tab}`) {
      history.replaceState(null, "", `#${tab}`);
    }

    // ============================================================
    // Carregar dados específicos da view
    // ============================================================
    switch (tab) {
      case "dashboard":
        this.dashboard.carregarConteudo();
        break;
      case "consulta":
        this.consulta.carregarConteudo();
        break;
      case "gestao":
        this.gestao.carregarConteudo();
        break;
      case "cadastro":
        this.cadastro.carregarConteudo();
        break;
      case "carrinho":
        this.carrinhoModule.carregarConteudo();
        break;
      case "pedidos":
        this.pedidos.carregarConteudo();
        break;
      case "aditivos":
        this.aditivos.carregarConteudo();
        break;
      default:
        console.warn(`View "${tab}" não reconhecida.`);
    }
  }

  // ============================================
  // VERIFICAR PERMISSÃO DA VIEW
  // ============================================
  verificarPermissaoTab(tab) {
    const perfil = this.usuarioAtual?.perfil;

    // Dashboard sempre visível para todos os perfis autenticados
    if (tab === "dashboard") return true;

    // Gestão de itens / cadastro / aditivos → ADMIN ou ESTAGIARIO
    if (tab === "aditivos" && !(perfil === "ADMIN" || perfil === "ESTAGIARIO"))
      return false;
    if (
      (tab === "gestao" || tab === "cadastro") &&
      !(perfil === "ADMIN" || perfil === "ESTAGIARIO")
    )
      return false;

    // Carrinho → quem pode comprar (ADMIN, SECRETARIO, SOLICITANTE)
    if (
      tab === "carrinho" &&
      !(
        perfil === "ADMIN" ||
        perfil === "SECRETARIO" ||
        perfil === "SOLICITANTE"
      )
    )
      return false;

    return true;
  }

  // ============================================
  // CARRINHO (STORAGE E UI)
  // ============================================
  carregarCarrinhoStorage() {
    const stored = localStorage.getItem("carrinhoAtas");
    if (stored) {
      try {
        this.carrinho = JSON.parse(stored);
        console.log("📦 Carrinho carregado do storage:", this.carrinho);
      } catch (e) {
        console.warn("Erro ao carregar carrinho:", e);
        this.carrinho = [];
      }
    } else {
      console.log("📦 Nenhum carrinho encontrado no storage");
      this.carrinho = [];
    }
    this.atualizarCarrinhoUI();
  }

  salvarCarrinhoStorage() {
    console.log("💾 Salvando carrinho no storage:", this.carrinho);
    localStorage.setItem("carrinhoAtas", JSON.stringify(this.carrinho));
    this.atualizarCarrinhoUI();
    // Atualizar drawer se estiver aberto
    if (document.getElementById("drawerCarrinho")?.classList.contains("open")) {
      this.renderizarDrawerCarrinho();
    }
    // Atualizar a view de carrinho se estiver visível
    const viewCarrinho = document.getElementById("carrinhoContent");
    if (viewCarrinho && viewCarrinho.style.display !== "none") {
      this.carrinhoModule.renderizar();
    }
  }

  atualizarCarrinhoUI() {
    const count = this.carrinho.length;
    const badgeHeader = document.getElementById("carrinhoBadgeHeader");
    if (badgeHeader) badgeHeader.textContent = count;

    // Atualizar drawer se estiver aberto
    if (document.getElementById("drawerCarrinho")?.classList.contains("open")) {
      this.renderizarDrawerCarrinho();
    }
  }

  // ============================================
  // CONFIRMAÇÃO
  // ============================================
  confirmar(mensagem) {
    return new Promise((resolve) => {
      this.confirmacaoResolver = resolve;
      const modal = document.getElementById("modalConfirmacao");
      const msgEl = document.getElementById("confirmacaoMensagem");
      if (modal && msgEl) {
        msgEl.textContent = mensagem;
        modal.classList.add("active");
      } else {
        // Fallback: confirm nativo
        resolve(confirm(mensagem));
      }
    });
  }

  resolverConfirmacao(resultado) {
    const modal = document.getElementById("modalConfirmacao");
    if (modal) modal.classList.remove("active");
    if (this.confirmacaoResolver) {
      this.confirmacaoResolver(resultado);
      this.confirmacaoResolver = null;
    }
  }

  // ============================================
  // FECHAR MODAIS
  // ============================================
  fecharModal() {
    document.getElementById("modalDetalhes")?.classList.remove("active");
  }

  fecharModalConsumo() {
    document.getElementById("modalConsumo")?.classList.remove("active");
  }

  fecharModalCarrinho() {
    document.getElementById("modalCarrinho")?.classList.remove("active");
  }

  fecharModalPedido() {
    document.getElementById("modalPedido")?.classList.remove("active");
  }

  fecharModalVisualizarPedido() {
    document
      .getElementById("modalVisualizarPedido")
      ?.classList.remove("active");
  }

  fecharModalAditivo() {
    document.getElementById("modalAditivo")?.classList.remove("active");
  }

  fecharPdfVisualizador() {
    document.getElementById("pdfVisualizador")?.classList.remove("active");
  }

  // ============================================
  // FECHAR MODAIS DE REJEIÇÃO
  // ============================================
  fecharModalMotivoRejeicao() {
    if (this.pedidos) {
      this.pedidos.fecharModalMotivoRejeicao();
    } else {
      // Fallback: fechar diretamente
      const modal = document.getElementById("modalMotivoRejeicao");
      if (modal) modal.classList.remove("active");
      const textarea = document.getElementById("motivoRejeicao");
      if (textarea) textarea.value = "";
      const btn = document.getElementById("btnConfirmarRejeicao");
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-times"></i> Rejeitar Pedido';
      }
    }
  }

  fecharModalVisualizarMotivo() {
    if (this.pedidos) {
      this.pedidos.fecharModalVisualizarMotivo();
    } else {
      const modal = document.getElementById("modalVisualizarMotivo");
      if (modal) modal.classList.remove("active");
    }
  }

  // ============================================
  // CARREGAR DADOS AUXILIARES
  // ============================================
  async carregarOrgaos() {
    if (this._cache.orgaos) {
      return this._cache.orgaos;
    }
    const { data: orgaos } = await supabase
      .from("orgaos")
      .select("*")
      .order("nome");
    this._cache.orgaos = orgaos || [];
    return this._cache.orgaos;
  }

  async carregarCategorias() {
    if (this._cache.categorias) {
      return this._cache.categorias;
    }
    const { data: categorias } = await supabase
      .from("categorias")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    this._cache.categorias = categorias || [];
    const datalist = document.getElementById("categoriasList");
    if (datalist) {
      datalist.innerHTML = this._cache.categorias
        .map((c) => `<option value="${c.nome}">`)
        .join("");
    }
    return this._cache.categorias;
  }

  async carregarFiltros() {
    // Implementado nos módulos específicos
  }

  async carregarSelectsGestao() {
    // Implementado no módulo Gestao
  }

  async carregarPedidos() {
    // Implementado no módulo Pedidos
  }

  async carregarAditivos() {
    // Implementado no módulo Aditivos
  }

  // ============================================
  // MÉTODOS PARA COMPATIBILIDADE (mantidos para evitar erros)
  // ============================================
  carregarTabelaOrgaos() {
    console.warn("⚠️ carregarTabelaOrgaos() está obsoleto. Use o módulo Core.");
    if (this.usuarioAtual?.perfil === "ADMIN") {
      this.ui.mostrarToast(
        "info",
        "Órgãos centralizados",
        "A gestão de órgãos agora está no Painel Administrativo (Core).",
      );
    }
    return Promise.resolve();
  }

  carregarTabelaUsuarios() {
    console.warn(
      "⚠️ carregarTabelaUsuarios() está obsoleto. Use o módulo Core.",
    );
    if (this.usuarioAtual?.perfil === "ADMIN") {
      this.ui.mostrarToast(
        "info",
        "Usuários centralizados",
        "A gestão de usuários agora está no Painel Administrativo (Core).",
      );
    }
    return Promise.resolve();
  }

  // ============================================================
  // MÉTODO PARA GERAR RELATÓRIO DE DIVERGÊNCIA (ACESSO RÁPIDO)
  // ============================================================
  async gerarRelatorioDivergencia() {
    if (this.gestao) {
      await this.gestao.gerarRelatorioDivergencia();
    } else {
      this.ui.mostrarToast("erro", "Módulo de gestão não disponível.");
    }
  }

  // ============================================
  // MÉTODO PARA AJUSTAR SALDO (ACESSO RÁPIDO)
  // ============================================
  async ajustarSaldo(itemId, novoSaldo) {
    if (this.gestao) {
      await this.gestao.ajustarSaldo(itemId, novoSaldo);
    } else {
      this.ui.mostrarToast("erro", "Módulo de gestão não disponível.");
    }
  }

  // ============================================
  // MÉTODO PARA LIMPAR CACHE (ÚTIL PARA RECARREGAR DADOS)
  // ============================================
  limparCache() {
    this._cache = {
      orgaos: null,
      categorias: null,
      fornecedores: null,
    };
    console.log("🧹 Cache limpo!");
  }

  // ============================================
  // MÉTODO PARA RECARREGAR TODOS OS DADOS
  // ============================================
  async recarregarTodosDados() {
    this.limparCache();
    await this.carregarDadosIniciais();
    const view = this.viewAtual();
    if (view) {
      this.recarregarTab(view);
    }
    this.ui.mostrarToast("sucesso", "Todos os dados foram recarregados!");
  }
}

// ============================================
// INICIAR APLICAÇÃO
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  window.sistema = new SistemaGestaoAtas();
});

// ============================================
// EXPOR FUNÇÕES GLOBAIS PARA USO INLINE
// ============================================
window.abrirDrawerCarrinho = () => {
  if (window.sistema) {
    window.sistema.abrirDrawerCarrinho();
  } else {
    console.error("❌ Sistema não inicializado");
  }
};

window.fecharDrawerCarrinho = () => {
  if (window.sistema) {
    window.sistema.fecharDrawerCarrinho();
  }
};

window.removerItemDrawer = (itemId) => {
  if (window.sistema) {
    window.sistema.removerItemDrawer(itemId);
  }
};

// ============================================
// EXPOR FUNÇÕES GLOBAIS PARA MODAIS DE REJEIÇÃO
// ============================================
window.fecharModalMotivoRejeicao = () => {
  if (window.sistema) {
    window.sistema.fecharModalMotivoRejeicao();
  } else {
    console.error("❌ Sistema não inicializado para fechar modal de rejeição");
    // Fallback: tentar fechar diretamente
    const modal = document.getElementById("modalMotivoRejeicao");
    if (modal) modal.classList.remove("active");
    const textarea = document.getElementById("motivoRejeicao");
    if (textarea) textarea.value = "";
    const btn = document.getElementById("btnConfirmarRejeicao");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-times"></i> Rejeitar Pedido';
    }
  }
};

window.fecharModalVisualizarMotivo = () => {
  if (window.sistema) {
    window.sistema.fecharModalVisualizarMotivo();
  } else {
    console.error(
      "❌ Sistema não inicializado para fechar modal de visualização",
    );
    const modal = document.getElementById("modalVisualizarMotivo");
    if (modal) modal.classList.remove("active");
  }
};

// ============================================
// EXPOR FUNÇÃO PARA RECARREGAR TODOS OS DADOS
// ============================================
window.recarregarSistema = () => {
  if (window.sistema) {
    window.sistema.recarregarTodosDados();
  } else {
    console.error("❌ Sistema não inicializado");
  }
};

// ============================================
// FUNÇÃO DE TESTE PARA ADICIONAR ITENS AO CARRINHO
// ============================================
window.adicionarItemTesteCarrinho = () => {
  if (!window.sistema) {
    console.error("❌ Sistema não inicializado");
    return;
  }

  const item = {
    id: `teste-${Date.now()}`,
    ataId: 1,
    ataNumero: "74/2026",
    fornecedorId: 1,
    fornecedorRazao: "Fornecedor Teste LTDA",
    fornecedorCnpj: "00.000.000/0001-00",
    processo: "123/2026",
    objeto: "Objeto de teste",
    itemId: 1,
    itemNumero: "001",
    itemDescricao: "Item de Teste",
    quantidade: 2,
    valorUnitario: 10.5,
    valorTotal: 21.0,
    numeroPedido: "PED-2026-0001",
    data: new Date().toISOString().split("T")[0],
    solicitante: "Usuário Teste",
    orgaoId: 1,
  };

  window.sistema.carrinho.push(item);
  window.sistema.salvarCarrinhoStorage();
  window.sistema.abrirDrawerCarrinho();
  console.log("✅ Item adicionado ao carrinho:", item);
};
