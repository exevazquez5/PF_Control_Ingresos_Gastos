# GastAr App — Control de Ingresos y Gastos

Aplicación personal para registrar ingresos, gastos, tarjetas de crédito y presupuestos.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 6 + Tailwind CSS 3 + Recharts + axios (`frontend/`) |
| Backend | .NET 8 Web API + Entity Framework Core 9 + Npgsql (`backend/ExpensesTracker.api/`) |
| Base de datos | PostgreSQL 17 |
| CI | GitHub Actions (workflow `build`, obligatorio en PRs a `main`) |
| Hosting | Cloudflare Pages (frontend) · Render (backend/API) · Supabase (PostgreSQL de producción) |

## URLs de producción

- Frontend: https://gastarapp.pages.dev
- API: https://gastar-app.onrender.com — health: `/health` — Swagger: `/swagger`
- Repo: https://github.com/exevazquez5/PF_Control_Ingresos_Gastos

## Desarrollo local (DEV)

### Requisitos

- Docker Desktop
- Node.js 20+ y .NET 8 SDK (para builds/lint locales; el stack completo corre en Docker)

### Levantar todo

```powershell
.\dev.ps1
```

Levanta `db` (PostgreSQL 17 en **localhost:5433**), `backend` (:5000) y `nginx` (:80), espera el health check y configura el firewall para acceso LAN.

- **App:** http://localhost  (nginx sirve el build de `frontend/dist` y proxya `/api` al backend)
- **API:** http://localhost:5000/api — Swagger: http://localhost:5000/swagger
- **DB:** `localhost:5433` — usuario `postgres` / contraseña `gastar_dev` / base `postgres`

Usuario de prueba local: `smoketest` / `Dev12345!` (o registrate desde la UI).

Alternativas útiles:

```powershell
docker compose up -d        # levantar sin rebuild
docker compose logs -f backend
cd frontend; npm run dev    # Vite en :5173 (usa frontend/.env.local -> http://localhost:5000)
```

### Datos locales

No existe ambiente QA hosted: **DEV local = DEV + QA**, y la BD local es copia de producción:

```powershell
.\backup-prod.ps1    # pg_dump de PROD -> backups/prod-<ts>.dump (lee .env.prod, gitignored)
.\seed-dev.ps1       # restaura el ultimo dump en la BD local (DROP SCHEMA + restore)
```

### Migraciones (EF Core)

- Crear una nueva: `cd backend/ExpensesTracker.api; dotnet ef migrations add <Nombre>`
- Se aplican **solas al arrancar** el backend (`MigrateAsync` con reintentos).
- La baseline `20260507022428_AddParentCategoryHierarchy` coincide con el historial de PROD: **no renombrar IDs** ni editar migraciones ya aplicadas.
- `20261012024329_RemoveSalaryTables` elimina `salarydeductions` y `salaries` (verificadas vacías en PROD antes de eliminar la sección Sueldos).
- La tabla de historial es `__efmigrationshistory` (minúsculas; fijado en `Program.cs` con `MigrationsHistoryTable`).

## Ramas, CI y despliegue

- Todo desarrollo en `feature/*` → **PR a `main`**. `main` está protegida: el check `build` debe pasar, sin force-push ni borrado de rama.
- El check `build` además ejecuta los tests de integración del backend (`dotnet test`, proyecto `ExpensesTracker.api.Tests`, xUnit + SQLite in-memory). Patrón: 401 sin token y 404 cross-user.
- Merge a `main` ⇒ deploy automático: Cloudflare Pages (frontend) + Render (backend). Render aplica las migraciones al arrancar.
- Cloudflare Pages necesita la variable de entorno de build `VITE_API_BASE_URL=https://gastar-app.onrender.com/api` (dashboard de Pages).
- Verificación post-merge: `/health` + `GET /api/<endpoint nuevo>` (404 → 401 indica código nuevo desplegado).

## Detalle de Ingresos (`/ingresos`)

- Selector de mes global con botón "Hoy" → KPIs del mes seleccionado: **total**, **cantidad de ingresos** y **promedio mensual histórico** (total ÷ meses con ingresos).
- Distribución por categoría (torta + leyenda) del mes seleccionado.
- **Historial agrupado por mes** (expandible): del primer ingreso hasta el mes actual; los meses vacíos se muestran como "Sin ingresos" (no se listan meses anteriores al primer ingreso).
- Cada ingreso muestra su **fuente persistida** (`IncomeSource`); en filas legadas se deriva de la descripción (`utils/sourceKey.js`).
- Filtro por categoría y orden se aplican dentro de cada mes expandido; los totales de mes/KPIs nunca se filtran.
- Totales compartidos con el Dashboard vía `utils/transactionTotals.js` (`sumIncomes`/`sumExpenses`/`filterByMonth`): "Total Gastos" incluye cuotas en ambos lados.

## Fuentes de ingreso y reglas de descuento (Fase 3)

- **`IncomeSource`** (por usuario, única por nombre): el formulario de ingresos tiene un autocompletado ("Fuente"); al elegirla se snapshottea su **modo** (`neto` | `bruto`) en el ingreso (D1). Si se tipea un nombre nuevo, el backend lo resuelve por alias o crea la fuente al guardar.
- **Renombrar/fusionar como alias (D11)**: `PUT /api/IncomeSources/{id}` deja el nombre anterior como alias (el autocomplete lo encuentra igual); `POST /api/IncomeSources/merge` reasigna ingresos, reglas y aliases al sobreviviente y borra la fuente vieja.
- **`DiscountRule`** (por fuente): reglas fijas o en % (`exactly one`), con `isExpected` para los estados Pendiente/Incompleto del cierre de mes (D2). CRUD en `/api/DiscountRules`.
- **Modo bruto (D1/D4)**: en modo `bruto` el campo "Bruto del recibo" es obligatorio; en `neto` es opcional y solo se ofrece con categoría laboral. El monto guardado siempre es lo depositado; el bruto va en `grossAmount` (validado `bruto >= depositado`).
- **`GET /api/Incomes/overview`**: meses desde el primer ingreso hasta el actual (vacíos intermedios incluidos, D7) con `total`, `grossTotal`, desglose por fuente (fallback a categoría, D6) y por categoría. Alimentará el gráfico apilado y las proyecciones (Fase 4).
- **Categorías laborales**: `Category.isLabor` (join explícito, reemplaza la heurística de nombres); la migración marca Salario y Freelance.
- Tests: `IncomeSourceTests`, `DiscountRuleTests`, `IncomeSourceSnapshotTests`, `IncomeOverviewTests` (59 backend / 16 frontend con vitest).

## Estructura

```
├── frontend/                     # React SPA
│   └── src/
│       ├── features/             # páginas (Login, Incomes, Expenses, ...)
│       ├── dashboard/            # Dashboard, Header, modales, charts
│       ├── services/             # clientes API por dominio (axios)
│       └── components/           # formularios/listados reutilizables
├── backend/ExpensesTracker.api/
│   ├── Controllers/  Services/  Models/  DTOs/  Data/  Migrations/
├── backend/ExpensesTracker.api.Tests/   # tests de integración (xUnit, WebApplicationFactory, SQLite)
├── .github/workflows/ci.yml      # build backend (.NET) + tests (xUnit) + frontend (Vite + vitest)
├── docker-compose.yml            # servicios: db + backend + nginx
├── dev.ps1                       # stack DEV local completo
├── backup-prod.ps1               # respaldo de PROD (pg_dump)
├── seed-dev.ps1                  # restaura respaldo en la BD local
├── .env                          # entorno DEV (gitignored)
├── .env.prod                     # cadena de conexion PROD, solo para backups (gitignored)
└── .env.example                  # ejemplo committeado
```

## Seguridad

- **Nunca commitear** `.env`, `.env.prod`, dumps de BD ni credenciales: ya están en `.gitignore` (solo `.env.example` se commitea).
- La API usa JWT (`Jwt:Key` por variable de entorno) y CORS restringido a los orígenes de `FrontendUrl`.
- Los respaldos de PROD quedan en `backups/` (local, gitignored).
