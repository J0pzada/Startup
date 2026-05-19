# MapaSeller Premium UI

## Conceito Visual

MapaSeller deve parecer uma plataforma internacional de analytics B2B para decisao comercial em marketplaces. A referencia principal e um app dark premium de fintech/investimentos: fundo profundo, sidebar compacta, topbar funcional, cards densos, bordas finas, tipografia precisa e graficos integrados ao fluxo operacional.

O produto nao deve parecer landing page nem dashboard generico de IA. A primeira tela e o software em uso: metricas, graficos, filas de acao, alertas e tabelas.

## Tokens De Cor

Dark principal:
- `bg-base`: `#070913`
- `bg-shell`: `#0b0e18`
- `bg-elevated`: `#111623`
- `panel`: `#141a2a`
- `card`: `#171d2e`
- `card-hover`: `#1b2337`
- `border-subtle`: `rgba(151, 164, 205, 0.16)`
- `border-active`: `rgba(158, 139, 255, 0.55)`
- `text-primary`: `#f5f7ff`
- `text-secondary`: `#b6c0d8`
- `text-muted`: `#78839f`
- `accent-violet`: `#9b8cff`
- `accent-blue`: `#5d7cff`
- `accent-cyan`: `#4bd8e7`
- `success`: `#35d399`
- `warning`: `#f5b84b`
- `danger`: `#ff6b7a`

Light secundario:
- `bg-base`: `#f6f7fb`
- `bg-shell`: `#eceff6`
- `panel`: `#ffffff`
- `card`: `#f8f9fc`
- `border-subtle`: `#dce1ec`
- `text-primary`: `#111827`
- `text-secondary`: `#4b5565`
- `text-muted`: `#667085`

Chart colors:
- `chart-1`: `#9b8cff`
- `chart-2`: `#5d7cff`
- `chart-3`: `#4bd8e7`
- `chart-4`: `#35d399`
- `chart-5`: `#f5b84b`
- `chart-6`: `#ff6b7a`

## Tipografia

- UI: `Manrope`, com fallback para `Inter`, `Segoe UI`, sans-serif.
- Titulos compactos: `Sora`, com fallback para `Manrope`.
- Dados numericos: `JetBrains Mono`, `SFMono-Regular`, monospace.
- Evitar texto hero grande. Dashboard usa titulos compactos e dados legiveis.
- Letter spacing deve ser neutro ou positivo em labels tecnicos.

## Bordas

- Cards e paineis: `8px`.
- Inputs e botoes: `8px`.
- Pills/status: `999px`.
- Bordas sempre finas: `1px`.
- Hover deve elevar por borda/tonalidade, nao por glow pesado.

## Sombras

- Dark mode usa quase nenhuma sombra; profundidade vem de camadas tonais e bordas.
- Light mode pode usar sombra muito curta e difusa.
- Evitar blur/glow decorativo.

## Spacing

- Base: escala de `4px`.
- Gap compacto: `8px`.
- Gap de painel: `12px`.
- Gap de secao: `16px`.
- Sidebar desktop: `240px`.
- Topbar: `64px`.
- Conteudo: grid denso responsivo.

## Layout

- Dark mode e principal.
- Sidebar fixa, compacta, com indicador ativo e footer operacional.
- Topbar com contexto, busca visual, status de sistema e toggle de tema.
- Dashboard em grade analitica: metricas, donut, barras, top oportunidades, alertas, saude operacional e tabela resumida.
- Evitar hero promocional. Usar blocos executivos compactos.

## Componentes

- `MetricPanel`: KPI compacto com valor, label e delta/status.
- `ChartCard`: painel para graficos com cabecalho tecnico.
- `DonutChart`: distribuicao por prioridade/status.
- `BarChart`: mix de oportunidades, estoque e revisao.
- `Sparkline`: perfil visual simples em detalhe do produto.
- `StatusPill`: badge com ponto LED.
- `DataPanel`: container denso para listas/tabelas.
- `ActionList`: fila de acoes recomendadas.
- `ProductRiskPanel`: riscos de SKU, estoque, margem e vendas.

## Graficos

- Donut para distribuicao por prioridade.
- Barras para mix operacional.
- Sparkline/area pequena para perfil do produto.
- Eixos e tooltips discretos, integrados ao tema.
- Graficos devem usar dados ja disponiveis no frontend.

## Microinteracoes

- GSAP apenas em entrada de paineis, counters e transicoes de pagina.
- Animar `opacity` e `translateY`.
- Limpar timelines no unmount.
- Respeitar `prefers-reduced-motion`.
- Nao animar tabela grande.

## Diretrizes De Implementacao

- Preservar rotas e API atual.
- Dark mode deve ser a experiencia default visual.
- Light mode deve ser coerente, mas secundario.
- Nao usar imagens externas, scraping ou integrações reais.
- Tabelas devem ser densas, legiveis e com hover sutil.
- Acoes devem parecer operacionais, nao marketing.
