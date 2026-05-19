# MapaSeller (MVP Base)

Base funcional do MVP interno para importar planilhas XLSX da FM Auto Peças, calcular score de oportunidade e simular análise por marketplace (sem integrações externas reais nesta etapa).

## Stack

- Backend: FastAPI + SQLAlchemy + SQLite + pandas/openpyxl
- Frontend: React + Vite + Tailwind CSS


## Experiência de UI

- Tema claro/escuro com persistência em `localStorage`
- Respeita `prefers-color-scheme` no primeiro acesso
- Respeita `prefers-reduced-motion` para animações
- Layout premium dark-first com cards densos, badges, gráficos e fluxo de importação em preview
- Design system documentado em `docs/design/MAPASELLER_PREMIUM_UI.md`

## Estrutura

```text
backend/
  main.py
  database.py
  models.py
  schemas.py
  importer.py
  scoring.py
  marketplace/
    base.py
    mercadolivre.py
    shopee.py
    amazon.py
    magalu.py
  sample_data/
    generate_sample_xlsx.py
  requirements.txt
frontend/
  src/
  package.json
  ...
```

## Instalação

### 1) Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2) Frontend

```bash
cd frontend
npm install
```

## Executar

### Backend (porta 8000)

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --reload-dir . --reload-exclude ".venv/*" --port 8000
# Se houver problema com --reload-exclude, use:
# uvicorn main:app --reload --reload-dir . --port 8000
```

### Frontend (porta 5173)

```bash
cd frontend
npm run dev
```

## Variáveis de ambiente

Use o arquivo `.env.example` como referência.

## Gerar planilha de exemplo

```bash
cd backend
source .venv/bin/activate
python sample_data/generate_sample_xlsx.py
```

Isso gera `backend/sample_data/produtos_exemplo.xlsx`.

## Limitações atuais

- Marketplaces em modo mock (sem APIs reais)
- Sem scraping
- Sem autenticação/usuários
- Sem histórico de importações e deduplicação avançada

## Próximos passos sugeridos

1. Migrar DB para Postgres/Supabase mantendo SQLAlchemy.
2. Criar controle de importações (lotes, versionamento e auditoria).
3. Incluir autenticação e permissões.
4. Integrar APIs reais de marketplaces.
5. Evoluir algoritmo de score com métricas históricas.

## Importação XLSX (fluxo recomendado)

1. Envie a planilha em `Importar XLSX` e use **Analisar planilha (preview)**.
2. Revise colunas detectadas e linhas de preview.
3. Clique em **Confirmar importação** para salvar no banco.

### Limpar base local para reimportar

- Endpoint: `DELETE /products`
- UI: botão **Limpar produtos importados** na tela `Importar XLSX`.

## Diagnóstico de planilha real (utilitário)

```bash
cd backend
source .venv/bin/activate
python tools/analyze_xlsx.py /caminho/para/sua_planilha.xlsx
```

O utilitário mostra abas, cabeçalho detectado, amostra útil de linhas, colunas mais preenchidas e mapeamento sugerido.
