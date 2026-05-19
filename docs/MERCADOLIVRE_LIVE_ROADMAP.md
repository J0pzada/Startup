# Mercado Livre Live Roadmap

## Estado atual

A Inteligência Mercado Livre do MapaSeller já existe como módulo operacional em modo seguro. Ela roda por clique manual, aceita análise por produto interno e por link do Mercado Livre, grava snapshots locais, exibe gráficos, mostra produtos similares, lista top anúncios e calcula rentabilidade estimada.

O modo padrão continua sendo `mock`, controlado por `MERCADOLIVRE_ENABLED=false`. Isso permite validar UX, parsing, cache, respostas e cálculo de margem sem depender de credenciais ou chamadas externas.

## O que hoje é mock

- Resultados de busca de anúncios quando `MERCADOLIVRE_ENABLED=false`.
- Títulos, vendedores, reputação, condição, frete, estoque e vendas dos anúncios simulados.
- Produtos similares e concorrentes diretos derivados dos anúncios simulados.
- Dinâmica de preço exibida como tendência sintética baseada no preço médio atual.
- Receita e vendas estimadas quando não há dados live confiáveis.

Mesmo em mock, a análise preserva a origem: `Produto interno` ou `Link Mercado Livre`, a query usada, modo, URL, item_id/WID, product/catalog id e dados da calculadora.

## Dados já presentes na resposta atual

- `analysis_context`: origem, modo, produto analisado, query, URL, ID interno, item_id e product_id.
- `market_summary`: total de resultados, preços mínimo/médio/mediano/máximo, sellers, frete grátis, Full, novo/usado, categorias e modo.
- `price_intelligence`: preço interno, custo, margem, diferença contra média ML, preços sugeridos e alerta de preço.
- `sales_intelligence`: vendas estimadas, receita estimada, ticket médio, atratividade e nível de concorrência.
- `competitor_intelligence`: top anúncios, top vendedores, menor/maior preço, melhores preço/frete, similares diretos e produtos parecidos.
- `listing_quality`: termos recorrentes, palavras-chave, marcas detectadas, variações e sugestões de título/busca.
- `recommendation`: ação sugerida, justificativa, riscos e próximos passos.
- `profit_calculation`: receita, custos, comissão, impostos, frete, lucro líquido, margem líquida, lucro por unidade e preços mínimos para margens-alvo.
- `charts`: distribuição, faixas de preço, tendência de preço e vendas por vendedor.

## Endpoints internos existentes

- `GET /marketplaces/mercadolivre/status`
- `POST /products/{product_id}/marketplaces/mercadolivre/analyze`
- `POST /marketplaces/mercadolivre/analyze-url`
- `GET /products/{product_id}/marketplaces`
- `GET /marketplaces/mercadolivre/snapshots/{snapshot_id}`
- `POST /calculator/profit`

## Variáveis de ambiente necessárias

```env
MERCADOLIVRE_ENABLED=false
MERCADOLIVRE_SITE_ID=MLB
MERCADOLIVRE_ACCESS_TOKEN=
MERCADOLIVRE_MAX_RESULTS=50
MERCADOLIVRE_TIMEOUT_SECONDS=10
MERCADOLIVRE_CACHE_TTL_HOURS=24
```

Regras permanentes: não expor token no frontend, não logar token, manter integração desligada por padrão e limitar resultados por chamada.

## Plano para ativar live com segurança

1. Confirmar credencial oficial e escopo de uso permitido pela API do Mercado Livre.
2. Manter `MERCADOLIVRE_ENABLED=false` em desenvolvimento padrão e ativar live apenas em ambiente controlado.
3. Implementar chamadas live em pequenos passos dentro de `backend/marketplace/mercadolivre.py`.
4. Começar por busca oficial em `/sites/{site_id}/search`, usando query já limpa e `limit <= MERCADOLIVRE_MAX_RESULTS`.
5. Normalizar todos os itens em `normalize_ml_item()` antes de qualquer cálculo.
6. Buscar detalhe de item apenas quando a análise vier de URL com `item_id`, com timeout e fallback mock.
7. Buscar product/catalog apenas quando houver `product_id` explícito.
8. Enriquecer reputação de vendedor somente depois de validar rate limit e cache.
9. Manter fallback amigável para mock se houver timeout, HTTP 429, erro de rede ou payload incompleto.
10. Exibir na UI se a análise é `Dados reais Mercado Livre` ou `Análise simulada`.

## Plano de cache e snapshots

- Reusar `marketplace_snapshots` e `marketplace_snapshot_items`.
- Antes de chamada live por produto, consultar último snapshot e respeitar `MERCADOLIVRE_CACHE_TTL_HOURS`.
- Para análise por URL, consultar snapshot por `source_url`.
- Salvar snapshot apenas quando a análise for válida.
- Não apagar histórico automaticamente.
- Guardar resposta resumida em `raw_summary_json` e os anúncios normalizados em `marketplace_snapshot_items`.
- Em fase posterior, adicionar limpeza opcional por idade ou botão administrativo, nunca automática sem regra clara.

## Riscos

- Rate limit: chamadas repetidas podem gerar HTTP 429; cache e limites por clique são obrigatórios.
- Token: vazamento em log, resposta HTTP ou frontend precisa ser evitado.
- Dados incompletos: alguns campos de venda, estoque, reputação ou seller podem não vir em todos os endpoints.
- Matching ruim: query de produto interno pode misturar compatibilidades ou variações parecidas.
- Custos: chamadas live em lote podem aumentar consumo e lentidão.
- Termos de uso: manter apenas API/fonte pública segura, sem scraping HTML e sem automação agressiva.
- Estimativas: vendas, receita e margem devem continuar rotuladas como estimadas quando não forem dados oficiais.

## Ordem exata para próxima sessão

1. Rodar `git status --short` e confirmar que `AGENTS.md` não será alterado.
2. Revisar `MercadoLivreAdapter.search_market()` e `_product_from_url()`.
3. Adicionar testes simples para `parse_mercadolivre_url()` e `normalize_ml_item()` se houver estrutura de testes.
4. Validar `MERCADOLIVRE_ENABLED=true` sem token em ambiente local e confirmar modo/status esperado.
5. Implementar live search mínimo em `/sites/{site_id}/search` com tratamento de 401, 403, 429, timeout e payload vazio.
6. Garantir que fallback mock preserve `analysis_context.mode_label`.
7. Implementar cache-hit antes de live para produto interno e URL.
8. Testar uma análise por link com item_id e outra por produto interno.
9. Atualizar UI apenas se algum campo live novo precisar de label.
10. Rodar py_compile, `npm run build` e teste manual pelo navegador.

## Critérios de aceite da integração live

- `GET /marketplaces/mercadolivre/status` não revela token e mostra modo/configuração corretamente.
- Com `MERCADOLIVRE_ENABLED=false`, tudo continua funcionando em mock.
- Com live habilitado, análise por produto interno usa busca oficial e salva snapshot.
- Com live habilitado, análise por link usa URL como origem principal e tenta detalhe de item/catalog quando existir.
- HTTP 429, timeout e erro de rede não quebram a aplicação.
- Nenhuma análise roda automaticamente em massa.
- UI diferencia dados reais, mock, internos e manuais.
- Backend compila e frontend build passa.
- Importação XLSX e merge Vendidos + Estoque permanecem intactos.
