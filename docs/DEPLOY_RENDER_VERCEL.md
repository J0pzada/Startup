# MapaSeller — Deploy: Render (Backend) + Vercel (Frontend)

## Backend — Render

| Campo | Valor |
|---|---|
| Root Directory | `backend` |
| Runtime | Python |
| Build Command | `python -m pip install --upgrade pip setuptools wheel && pip install -r requirements.txt` |
| Start Command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| `PYTHON_VERSION` | `3.11.10` |

### Variáveis de ambiente no Render

```
APP_ENV=production
DATABASE_URL=postgresql+psycopg2://...   # Supabase connection string
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ALLOWED_ORIGINS=https://<seu-app>.vercel.app
FRONTEND_ORIGIN=https://<seu-app>.vercel.app
MERCADOLIVRE_ENABLED=true
MERCADOLIVRE_SITE_ID=MLB
MERCADOLIVRE_CLIENT_ID=...
MERCADOLIVRE_CLIENT_SECRET=...
MERCADOLIVRE_REDIRECT_URI=https://mapaseller-api.onrender.com/mercadolivre/auth/callback
MERCADOLIVRE_FALLBACK_TO_MOCK=false
```

### Rotas prontas após deploy

| Rota | Método | Função |
|---|---|---|
| `/` | GET | Health básico (sem secrets) |
| `/health` | GET | Health com info de banco |
| `/docs` | GET | Swagger UI |
| `/mercadolivre/auth/callback` | GET | OAuth callback |
| `/mercadolivre/notifications` | POST | Webhook de notificações |

---

## Frontend — Vercel

| Campo | Valor |
|---|---|
| Root Directory | `frontend` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

### Variáveis de ambiente no Vercel

```
VITE_API_URL=https://mapaseller-api.onrender.com
```

---

## Mercado Livre Developers — Configuração do App

1. Acesse [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)
2. Crie ou edite seu aplicativo
3. Configure:
   - **Redirect URI**: `https://mapaseller-api.onrender.com/mercadolivre/auth/callback`
   - **Notification URL**: `https://mapaseller-api.onrender.com/mercadolivre/notifications`
4. Copie `App ID` → `MERCADOLIVRE_CLIENT_ID` e `Secret key` → `MERCADOLIVRE_CLIENT_SECRET` no Render

## Verificação pós-deploy

```bash
# Backend ok
curl https://mapaseller-api.onrender.com/
curl https://mapaseller-api.onrender.com/health

# Webhook ML aceita POST vazio
curl -X POST https://mapaseller-api.onrender.com/mercadolivre/notifications \
  -H "Content-Type: application/json" -d '{}'
```
