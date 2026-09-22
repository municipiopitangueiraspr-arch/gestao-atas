// ============================================
// shared/js/services/usuarios.service.js
// Serviço compartilhado para gestão de usuários
// Integração com Supabase - Centralizado
// CORRIGIDO: Atualiza usuário existente em vez de apenas retornar
// ============================================

import { supabase } from "../supabase.js";

export const UsuariosService = {
  // ============================================
  // CRUD - USUÁRIOS
  // ============================================

  /**
   * Lista todos os usuários
   * @param {Object} options - Opções de filtro
   * @param {boolean} options.onlyActive - Apenas usuários ativos
   * @param {string} options.search - Termo de busca (nome ou email)
   * @param {number} options.orgaoId - Filtrar por órgão
   * @param {string} options.perfil - Filtrar por perfil
   * @returns {Promise<Array>} Lista de usuários
   */
  async listar(options = {}) {
    try {
      let query = supabase
        .from("usuarios")
        .select("*, orgao:orgaos(id, nome, sigla)")
        .order("nome");

      if (options.onlyActive) {
        query = query.eq("ativo", true);
      }

      if (options.search) {
        const termo = `%${options.search}%`;
        query = query.or(`nome.ilike.${termo},email.ilike.${termo}`);
      }

      if (options.orgaoId) {
        query = query.eq("orgao_id", options.orgaoId);
      }

      if (options.perfil) {
        query = query.eq("perfil", options.perfil);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      throw error;
    }
  },

  /**
   * Lista apenas usuários ativos
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de usuários ativos
   */
  async listarAtivos(options = {}) {
    try {
      return await this.listar({ ...options, onlyActive: true });
    } catch (error) {
      console.error("Erro ao listar usuários ativos:", error);
      throw error;
    }
  },

  /**
   * Obtém um usuário por ID
   * @param {number} id - ID do usuário
   * @returns {Promise<Object>} Dados do usuário
   */
  async obterPorId(id) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*, orgao:orgaos(id, nome, sigla)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao obter usuário ${id}:`, error);
      throw error;
    }
  },

  /**
   * Obtém um usuário por UUID (do Supabase Auth)
   * @param {string} uuid - UUID do usuário
   * @returns {Promise<Object>} Dados do usuário
   */
  async obterPorUuid(uuid) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*, orgao:orgaos(id, nome, sigla)")
        .eq("uuid", uuid)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao obter usuário por UUID ${uuid}:`, error);
      throw error;
    }
  },

  /**
   * Obtém um usuário por email
   * @param {string} email - Email do usuário
   * @returns {Promise<Object>} Dados do usuário
   */
  async obterPorEmail(email) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("*, orgao:orgaos(id, nome, sigla)")
        .eq("email", email)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao obter usuário por email ${email}:`, error);
      throw error;
    }
  },

  /**
   * Verifica se um usuário já existe na tabela por UUID
   * @param {string} uuid - UUID do usuário
   * @returns {Promise<boolean>} True se existe
   */
  async usuarioExiste(uuid) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .select("id")
        .eq("uuid", uuid)
        .maybeSingle();

      if (error && error.code !== "PGRST116") throw error;
      return !!data;
    } catch (error) {
      console.error("Erro ao verificar existência do usuário:", error);
      return false;
    }
  },

  /**
   * Cria um novo usuário (com autenticação no Supabase Auth)
   * @param {Object} dados - Dados do usuário
   * @param {string} dados.nome - Nome do usuário (obrigatório)
   * @param {string} dados.email - Email do usuário (obrigatório)
   * @param {string} dados.senha - Senha do usuário (obrigatório, mínimo 6 caracteres)
   * @param {string} dados.perfil - Perfil de acesso (ADMIN, SECRETARIO, SOLICITANTE, ESTAGIARIO)
   * @param {number} dados.orgao_id - ID do órgão
   * @param {boolean} dados.ativo - Status do usuário
   * @param {Object} dados.metadados - Metadados adicionais
   * @returns {Promise<Object>} Usuário criado
   */
  async criar(dados) {
    try {
      console.log(
        "🔍 [UsuariosService.criar] Dados recebidos:",
        JSON.stringify(dados, null, 2),
      );
      console.log("🔍 [UsuariosService.criar] Nome recebido:", dados.nome);
      console.log("🔍 [UsuariosService.criar] Email recebido:", dados.email);
      console.log("🔍 [UsuariosService.criar] Perfil recebido:", dados.perfil);
      console.log("🔍 [UsuariosService.criar] Orgão ID:", dados.orgao_id);

      // Validar dados obrigatórios
      if (!dados.nome) {
        console.error("❌ [UsuariosService.criar] Nome NÃO fornecido!");
        throw new Error("O nome do usuário é obrigatório.");
      }

      if (!dados.email) {
        console.error("❌ [UsuariosService.criar] Email NÃO fornecido!");
        throw new Error("O e-mail do usuário é obrigatório.");
      }

      if (!dados.senha || dados.senha.length < 6) {
        console.error(
          "❌ [UsuariosService.criar] Senha inválida:",
          dados.senha ? "Tamanho: " + dados.senha.length : "Não fornecida",
        );
        throw new Error("A senha deve ter no mínimo 6 caracteres.");
      }

      // Validar email único
      console.log("🔍 [UsuariosService.criar] Validando email único...");
      const emailExiste = await this.validarEmail(dados.email);
      if (!emailExiste) {
        console.error(
          "❌ [UsuariosService.criar] Email já existe:",
          dados.email,
        );
        throw new Error(`O e-mail "${dados.email}" já está em uso.`);
      }

      // 1. Criar usuário no Supabase Auth (já com a senha definida)
      console.log(
        "🔍 [UsuariosService.criar] Criando usuário no Supabase Auth...",
      );
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: dados.email,
        password: dados.senha,
        options: {
          data: {
            name: dados.nome,
            perfil: dados.perfil || "SOLICITANTE",
          },
        },
      });

      if (authError) {
        console.error("❌ [UsuariosService.criar] Erro no signUp:", authError);
        throw new Error(
          `Erro ao criar usuário no sistema de autenticação: ${authError.message}`,
        );
      }

      if (!authData.user) {
        console.error(
          "❌ [UsuariosService.criar] Usuário não retornado pelo Auth",
        );
        throw new Error(
          "Erro ao criar usuário no sistema de autenticação: usuário não retornado.",
        );
      }

      console.log(
        "✅ [UsuariosService.criar] Usuário criado no Auth. UUID:",
        authData.user.id,
      );
      console.log(
        "✅ [UsuariosService.criar] Dados do Auth:",
        JSON.stringify(authData.user, null, 2),
      );

      // 2. Verificar se o usuário já foi criado na tabela (evitar erro 409)
      const jaExiste = await this.usuarioExiste(authData.user.id);
      if (jaExiste) {
        console.warn(
          "⚠️ [UsuariosService.criar] Usuário já existe na tabela. UUID:",
          authData.user.id,
        );
        console.log(
          "🔄 [UsuariosService.criar] Atualizando usuário existente com novos dados...",
        );

        // ATUALIZAR o usuário existente em vez de apenas retornar
        const { data: usuarioAtualizado, error: updateError } = await supabase
          .from("usuarios")
          .update({
            nome: dados.nome.trim(),
            email: dados.email.trim(),
            perfil: dados.perfil || "SOLICITANTE",
            orgao_id: dados.orgao_id || null,
            ativo: dados.ativo !== undefined ? dados.ativo : true,
            updated_at: new Date().toISOString(),
          })
          .eq("uuid", authData.user.id)
          .select()
          .single();

        if (updateError) {
          console.error(
            "❌ [UsuariosService.criar] Erro ao atualizar usuário existente:",
            updateError,
          );
          throw new Error(
            `Erro ao atualizar usuário existente: ${updateError.message}`,
          );
        }

        console.log(
          "✅ [UsuariosService.criar] Usuário atualizado com sucesso!",
        );
        console.log(
          "✅ [UsuariosService.criar] Dados atualizados:",
          JSON.stringify(usuarioAtualizado, null, 2),
        );
        return usuarioAtualizado;
      }

      // 3. Inserir na tabela usuarios (se não existir)
      console.log(
        "🔍 [UsuariosService.criar] Inserindo novo usuário na tabela...",
      );

      const dadosParaInserir = {
        uuid: authData.user.id,
        nome: dados.nome.trim(),
        email: dados.email.trim(),
        perfil: dados.perfil || "SOLICITANTE",
        orgao_id: dados.orgao_id || null,
        ativo: dados.ativo !== undefined ? dados.ativo : true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log(
        "🔍 [UsuariosService.criar] Dados para inserir:",
        JSON.stringify(dadosParaInserir, null, 2),
      );

      const { data: usuario, error: insertError } = await supabase
        .from("usuarios")
        .insert([dadosParaInserir])
        .select()
        .single();

      if (insertError) {
        console.error(
          "❌ [UsuariosService.criar] Erro ao inserir usuário na tabela:",
          insertError,
        );

        if (insertError.code === "23505") {
          throw new Error(
            "Este usuário já está cadastrado no sistema. Tente fazer login.",
          );
        }

        throw new Error(
          `Erro ao salvar usuário no banco de dados: ${insertError.message}`,
        );
      }

      console.log("✅ [UsuariosService.criar] Usuário criado com sucesso!");
      console.log(
        "✅ [UsuariosService.criar] Dados do usuário criado:",
        JSON.stringify(usuario, null, 2),
      );

      // 4. Se tiver permissões específicas, salvar
      if (dados.permissoes && dados.permissoes.length > 0) {
        console.log(
          "🔍 [UsuariosService.criar] Salvando permissões do usuário...",
        );
        await this.atualizarPermissoes(usuario.id, dados.permissoes);
      }

      return usuario;
    } catch (error) {
      console.error("❌ [UsuariosService.criar] Erro geral:", error);
      throw error;
    }
  },

  /**
   * Atualiza um usuário existente
   * @param {number} id - ID do usuário
   * @param {Object} dados - Dados para atualizar
   * @param {string} dados.nome - Nome do usuário
   * @param {string} dados.email - Email do usuário
   * @param {string} dados.perfil - Perfil de acesso
   * @param {number} dados.orgao_id - ID do órgão
   * @param {boolean} dados.ativo - Status do usuário
   * @param {Object} dados.metadados - Metadados adicionais
   * @returns {Promise<Object>} Usuário atualizado
   */
  async atualizar(id, dados) {
    try {
      const usuarioExistente = await this.obterPorId(id);
      if (!usuarioExistente) {
        throw new Error("Usuário não encontrado.");
      }

      if (dados.email && dados.email !== usuarioExistente.email) {
        const emailExiste = await this.validarEmail(dados.email, id);
        if (!emailExiste) {
          throw new Error(`O e-mail "${dados.email}" já está em uso.`);
        }
      }

      const dadosParaAtualizar = {};

      if (dados.nome !== undefined) dadosParaAtualizar.nome = dados.nome.trim();
      if (dados.email !== undefined)
        dadosParaAtualizar.email = dados.email.trim();
      if (dados.perfil !== undefined) dadosParaAtualizar.perfil = dados.perfil;
      if (dados.orgao_id !== undefined)
        dadosParaAtualizar.orgao_id = dados.orgao_id || null;
      if (dados.ativo !== undefined) dadosParaAtualizar.ativo = dados.ativo;

      dadosParaAtualizar.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from("usuarios")
        .update(dadosParaAtualizar)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      if (dados.permissoes) {
        await this.atualizarPermissoes(id, dados.permissoes);
      }

      return data;
    } catch (error) {
      console.error(`Erro ao atualizar usuário ${id}:`, error);
      throw error;
    }
  },

  // ============================================================
  // REMOVIDO: método atualizarSenha()
  // Motivo: A API Admin do Supabase requer Service Role Key,
  // que não deve ser exposta no frontend.
  // ============================================================

  /**
   * Desativa um usuário
   * @param {number} id - ID do usuário
   * @returns {Promise<Object>} Usuário atualizado
   */
  async desativar(id) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .update({
          ativo: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao desativar usuário ${id}:`, error);
      throw error;
    }
  },

  /**
   * Ativa um usuário
   * @param {number} id - ID do usuário
   * @returns {Promise<Object>} Usuário atualizado
   */
  async ativar(id) {
    try {
      const { data, error } = await supabase
        .from("usuarios")
        .update({
          ativo: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error(`Erro ao ativar usuário ${id}:`, error);
      throw error;
    }
  },

  /**
   * Exclui um usuário (apenas se não tiver dependências)
   * @param {number} id - ID do usuário
   * @returns {Promise<boolean>} True se excluído
   */
  async excluir(id) {
    try {
      const usuario = await this.obterPorId(id);
      if (!usuario) {
        throw new Error("Usuário não encontrado.");
      }

      const dependencias = await this.verificarDependencias(id);
      if (dependencias.temPedidos) {
        throw new Error(
          "Não é possível excluir o usuário pois existem pedidos vinculados.",
        );
      }
      if (dependencias.temProcessos) {
        throw new Error(
          "Não é possível excluir o usuário pois existem processos vinculados.",
        );
      }
      if (dependencias.temAtos) {
        throw new Error(
          "Não é possível excluir o usuário pois existem atos vinculados.",
        );
      }

      await supabase.from("permissoes_usuarios").delete().eq("usuario_id", id);

      const { error } = await supabase.from("usuarios").delete().eq("id", id);
      if (error) throw error;

      return true;
    } catch (error) {
      console.error(`Erro ao excluir usuário ${id}:`, error);
      throw error;
    }
  },

  /**
   * Verifica dependências de um usuário
   * @param {number} id - ID do usuário
   * @returns {Promise<Object>} Objeto com dependências
   */
  async verificarDependencias(id) {
    try {
      const [pedidos, processos, atos] = await Promise.all([
        supabase
          .from("pedidos")
          .select("id", { count: "exact", head: true })
          .eq("usuario_id", id),
        supabase
          .from("processos_licitatorios")
          .select("id", { count: "exact", head: true })
          .eq("responsavel_id", id),
        supabase
          .from("atos_oficiais")
          .select("id", { count: "exact", head: true })
          .eq("usuario_cadastro_id", id),
      ]);

      return {
        temPedidos: (pedidos.count || 0) > 0,
        temProcessos: (processos.count || 0) > 0,
        temAtos: (atos.count || 0) > 0,
      };
    } catch (error) {
      console.error(`Erro ao verificar dependências do usuário ${id}:`, error);
      return { temPedidos: false, temProcessos: false, temAtos: false };
    }
  },

  // ============================================
  // PERMISSÕES POR MÓDULO
  // ============================================

  /**
   * Obtém as permissões de um usuário por módulo
   * @param {number} usuarioId - ID do usuário
   * @returns {Promise<Array>} Lista de permissões
   */
  async obterPermissoes(usuarioId) {
    try {
      const { data, error } = await supabase
        .from("permissoes_usuarios")
        .select("modulo, permissao")
        .eq("usuario_id", usuarioId);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(`Erro ao obter permissões do usuário ${usuarioId}:`, error);
      return [];
    }
  },

  /**
   * Obtém os módulos permitidos para um usuário
   * @param {number} usuarioId - ID do usuário
   * @returns {Promise<Array>} Lista de módulos permitidos
   */
  async obterModulosPermitidos(usuarioId) {
    try {
      const permissoes = await this.obterPermissoes(usuarioId);
      const modulos = permissoes
        .filter((p) => p.permissao === "permitido" || p.permissao === "admin")
        .map((p) => p.modulo);
      return [...new Set(modulos)];
    } catch (error) {
      console.error(
        `Erro ao obter módulos permitidos do usuário ${usuarioId}:`,
        error,
      );
      return [];
    }
  },

  /**
   * Verifica se um usuário tem permissão para um módulo
   * @param {number} usuarioId - ID do usuário
   * @param {string} modulo - Nome do módulo
   * @param {string} acao - Ação a verificar (criar, ler, atualizar, deletar)
   * @returns {Promise<boolean>} True se tem permissão
   */
  async temPermissao(usuarioId, modulo, acao = "ler") {
    try {
      const usuario = await this.obterPorId(usuarioId);
      if (usuario?.perfil === "ADMIN") return true;

      const permissoes = await this.obterPermissoes(usuarioId);
      const permissao = permissoes.find((p) => p.modulo === modulo);

      if (!permissao) return false;
      if (permissao.permissao === "admin") return true;
      if (permissao.permissao === "permitido") {
        const acoes = permissao.acoes || ["ler"];
        return acoes.includes(acao);
      }
      return false;
    } catch (error) {
      console.error(
        `Erro ao verificar permissão do usuário ${usuarioId}:`,
        error,
      );
      return false;
    }
  },

  /**
   * Atualiza as permissões de um usuário
   * @param {number} usuarioId - ID do usuário
   * @param {Array} permissoes - Lista de permissões [{modulo, permissao, acoes}]
   * @returns {Promise<boolean>} True se atualizado
   */
  async atualizarPermissoes(usuarioId, permissoes) {
    try {
      await supabase
        .from("permissoes_usuarios")
        .delete()
        .eq("usuario_id", usuarioId);

      if (permissoes && permissoes.length > 0) {
        const dadosParaInserir = permissoes.map((p) => ({
          usuario_id: usuarioId,
          modulo: p.modulo,
          permissao: p.permissao || "permitido",
          acoes: p.acoes || ["ler"],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error } = await supabase
          .from("permissoes_usuarios")
          .insert(dadosParaInserir);
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error(
        `Erro ao atualizar permissões do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  },

  // ============================================
  // VALIDAÇÕES
  // ============================================

  /**
   * Valida se um email é único
   * @param {string} email - Email a validar
   * @param {number} idIgnorar - ID do usuário a ignorar (para edição)
   * @returns {Promise<boolean>} True se o email estiver disponível
   */
  async validarEmail(email, idIgnorar = null) {
    try {
      if (!email) return true;

      let query = supabase
        .from("usuarios")
        .select("id")
        .eq("email", email.trim());

      if (idIgnorar) {
        query = query.neq("id", idIgnorar);
      }

      const { data, error } = await query.maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return !data;
    } catch (error) {
      console.error("Erro ao validar email:", error);
      return false;
    }
  },

  /**
   * Valida se um nome de usuário é único (opcional)
   * @param {string} nome - Nome a validar
   * @param {number} idIgnorar - ID do usuário a ignorar (para edição)
   * @returns {Promise<boolean>} True se o nome estiver disponível
   */
  async validarNome(nome, idIgnorar = null) {
    try {
      if (!nome) return true;

      let query = supabase
        .from("usuarios")
        .select("id")
        .eq("nome", nome.trim());

      if (idIgnorar) {
        query = query.neq("id", idIgnorar);
      }

      const { data, error } = await query.maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return !data;
    } catch (error) {
      console.error("Erro ao validar nome:", error);
      return false;
    }
  },

  // ============================================
  // LOG DE ACESSO
  // ============================================

  /**
   * Registra o login de um usuário
   * @param {number} usuarioId - ID do usuário
   * @returns {Promise<boolean>} True se registrado
   */
  async registrarLogin(usuarioId) {
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({
          ultimo_login: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", usuarioId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Erro ao registrar login do usuário ${usuarioId}:`, error);
      return false;
    }
  },

  /**
   * Registra o logout de um usuário
   * @param {number} usuarioId - ID do usuário
   * @returns {Promise<boolean>} True se registrado
   */
  async registrarLogout(usuarioId) {
    try {
      const { error } = await supabase
        .from("usuarios")
        .update({
          ultimo_logout: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", usuarioId);
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`Erro ao registrar logout do usuário ${usuarioId}:`, error);
      return false;
    }
  },

  /**
   * Obtém o histórico de acessos de um usuário
   * @param {number} usuarioId - ID do usuário
   * @param {number} limite - Número de registros
   * @returns {Promise<Array>} Lista de acessos
   */
  async obterHistoricoAcessos(usuarioId, limite = 50) {
    try {
      const { data, error } = await supabase
        .from("logs_acesso")
        .select("*")
        .eq("usuario_id", usuarioId)
        .order("created_at", { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(
        `Erro ao obter histórico de acessos do usuário ${usuarioId}:`,
        error,
      );
      return [];
    }
  },

  // ============================================
  // ESTATÍSTICAS
  // ============================================

  /**
   * Obtém estatísticas de usuários
   * @returns {Promise<Object>} Estatísticas
   */
  async obterEstatisticas() {
    try {
      const [total, ativos, inativos, porPerfil] = await Promise.all([
        supabase.from("usuarios").select("id", { count: "exact", head: true }),
        supabase
          .from("usuarios")
          .select("id", { count: "exact", head: true })
          .eq("ativo", true),
        supabase
          .from("usuarios")
          .select("id", { count: "exact", head: true })
          .eq("ativo", false),
        supabase
          .from("usuarios")
          .select("perfil", { count: "exact" })
          .groupBy("perfil"),
      ]);

      const perfis = {};
      if (porPerfil.data) {
        porPerfil.data.forEach((p) => {
          perfis[p.perfil] = p.count;
        });
      }

      return {
        total: total.count || 0,
        ativos: ativos.count || 0,
        inativos: inativos.count || 0,
        porPerfil: perfis,
      };
    } catch (error) {
      console.error("Erro ao obter estatísticas de usuários:", error);
      return { total: 0, ativos: 0, inativos: 0, porPerfil: {} };
    }
  },

  // ============================================
  // UTILITÁRIOS
  // ============================================

  /**
   * Formata um usuário para exibição
   * @param {Object} usuario - Dados do usuário
   * @returns {string} Nome formatado
   */
  formatarUsuario(usuario) {
    if (!usuario) return "";
    return usuario.nome || usuario.email || "Usuário";
  },

  /**
   * Obtém a lista de perfis disponíveis
   * @returns {Array} Lista de perfis
   */
  getPerfis() {
    return [
      { value: "ADMIN", label: "Administrador" },
      { value: "SECRETARIO", label: "Secretário" },
      { value: "SOLICITANTE", label: "Solicitante" },
      { value: "ESTAGIARIO", label: "Estagiário" },
    ];
  },

  /**
   * Obtém a lista de módulos disponíveis
   * @returns {Array} Lista de módulos
   */
  getModulos() {
    return [
      { value: "atas", label: "Gestão de Atas" },
      { value: "atos-oficiais", label: "Atos Oficiais" },
      { value: "processos", label: "Processos Licitatórios" },
      { value: "tarefas", label: "Gestão de Tarefas" },
      { value: "usuarios", label: "Gestão de Usuários" },
      { value: "orgaos", label: "Gestão de Órgãos" },
      { value: "permissoes", label: "Gestão de Permissões" },
      { value: "configuracoes", label: "Configurações" },
    ];
  },

  /**
   * Busca usuários por perfil
   * @param {string} perfil - Perfil a buscar
   * @returns {Promise<Array>} Lista de usuários
   */
  async listarPorPerfil(perfil) {
    try {
      return await this.listar({ perfil });
    } catch (error) {
      console.error(`Erro ao listar usuários por perfil ${perfil}:`, error);
      return [];
    }
  },

  /**
   * Busca usuários por órgão
   * @param {number} orgaoId - ID do órgão
   * @returns {Promise<Array>} Lista de usuários
   */
  async listarPorOrgao(orgaoId) {
    try {
      return await this.listar({ orgaoId });
    } catch (error) {
      console.error(`Erro ao listar usuários por órgão ${orgaoId}:`, error);
      return [];
    }
  },

  /**
   * Busca usuários por termo de busca
   * @param {string} termo - Termo de busca
   * @returns {Promise<Array>} Lista de usuários
   */
  async buscar(termo) {
    try {
      return await this.listar({ search: termo });
    } catch (error) {
      console.error(`Erro ao buscar usuários por "${termo}":`, error);
      return [];
    }
  },

  /**
   * Obtém o perfil de um usuário com todas as informações
   * @param {number} usuarioId - ID do usuário
   * @returns {Promise<Object>} Perfil completo do usuário
   */
  async obterPerfilCompleto(usuarioId) {
    try {
      const [usuario, permissoes, acessos] = await Promise.all([
        this.obterPorId(usuarioId),
        this.obterPermissoes(usuarioId),
        this.obterHistoricoAcessos(usuarioId, 10),
      ]);

      return {
        ...usuario,
        permissoes,
        ultimos_acessos: acessos,
      };
    } catch (error) {
      console.error(
        `Erro ao obter perfil completo do usuário ${usuarioId}:`,
        error,
      );
      throw error;
    }
  },

  // ============================================
  // REDEFINIR SENHA (FLUXO DE RECUPERAÇÃO)
  // ============================================

  /**
   * Envia um e-mail de redefinição de senha
   * @param {string} email - Email do usuário
   * @returns {Promise<boolean>} True se enviado
   */
  async enviarRedefinicaoSenha(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/redefinir-senha.html`,
      });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(
        `Erro ao enviar redefinição de senha para ${email}:`,
        error,
      );
      throw error;
    }
  },
};

export default UsuariosService;
