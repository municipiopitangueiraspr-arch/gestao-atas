# Auditoria e reorganização do frontend — 2026-10-04

## Escopo

Auditoria dos oito módulos da Intranet Municipal de Pitangueiras:

- Visão Executiva;
- Gestão de Atas, Saldos e Pedidos;
- Gestão de Estoque;
- Gestão de Trabalho;
- Atos Oficiais;
- Biblioteca Municipal;
- Compras Públicas;
- Meu Perfil.

## Achados estruturais

1. O módulo de Atas carregava três temas concorrentes (`gestaoatas-theme.css`, `gestaoatas-premium.css` e `gestaoatas-drive.css`) além da folha funcional de 276 KB e das camadas compartilhadas. Esses temas utilizam alta especificidade e `!important`, podendo substituir a identidade oficial.
2. A tela de Consulta possuía os cinco cards informativos como botões sem ícones; as cores apareciam apenas em números/bordas.
3. O fallback de marca de Atas usava `fa-file-contract`, ícone legado do módulo. A marca institucional deve priorizar o brasão em caixa branca.
4. O repositório continha cópias/backups sem referências em rotas ou scripts ativos: `controle-de-saldos/index-copy.html`, `controle-de-saldos/nkp/` e `gestao-de-atos-oficiais/bkp-telas/`. Após a busca de referências e a aprovação dos auditores, esses arquivos foram removidos do build de produção; continuam recuperáveis pelo histórico Git.
5. O Core administrativo ainda possuía rotas absolutas (`/intranet.html`, `/core/...`) incompatíveis com publicação em subdiretório do GitHub Pages; esse bloco deve ser convertido para resolver rotas relativas pela raiz publicada.
6. A Visão Executiva possui CSS próprio com paleta verde; a camada canônica precisa permanecer como última camada para garantir o shell azul/amarelo.

## Decisões de consolidação

- Manter CSS funcional por módulo somente quando ele contém regras de componentes ou comportamento visual específico indispensável.
- Manter `shared/css/identidade-intranet.css` como última camada visual comum, com tokens, shell, marca, foco, estados e responsividade.
- Remover gradientes verdes e regras de marca dos temas legados por substituição em camada final, evitando perda de comportamento da aplicação.
- Adicionar ícones semânticos aos cards informativos da Consulta e aplicar preenchimento integral por prioridade.
- O pacote de produção não inclui backups sem referências. O arquivo ZIP único do Drive será substituído pela versão limpa; nenhuma exclusão permanente de dado será feita no Drive.

## Critérios de aceite

- Todos os entrypoints oficiais carregam a identidade canônica depois dos estilos específicos.
- Nenhuma tela oficial exibe gradiente verde no shell, marca ou ação primária.
- Cards informativos exibem ícone, número, rótulo e fundo semântico, permanecendo clicáveis e acessíveis.
- Brasão aparece sobre fundo branco; o ícone legado só permanece como fallback quando o brasão não puder ser carregado.
- Nenhum arquivo removido é referenciado por HTML, CSS, JavaScript, manifesto ou rota publicada.
- O pacote final passa no auditor de build, no auditor de acessibilidade e no teste de integridade do ZIP.
