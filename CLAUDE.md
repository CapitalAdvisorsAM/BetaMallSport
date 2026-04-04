# CLAUDE.md — BetaMallSport

> Masterclass reference for every session. Claude must follow these patterns exactly when reading or writing code in this repo.

## Project Overview

- **Stack**: Next.js 14 App Router · Prisma ORM · PostgreSQL · NextAuth · Zod · Tailwind CSS
- **Domain**: Spanish-language real estate management app (Chile)
- **Source root**: `src/` — always use the `@/` alias (e.g. `@/lib/prisma`)
- **Language**: Variable names, messages, and schema fields are in Spanish

---

## 1. File Organization

```
src/
├── app/
│   ├── (auth)/                   # Auth-protected page routes
│   ├── (dashboard)/              # Dashboard pages
│   └── api/                      # API route handlers (Next.js App Router)
│       └── <domain>/
│           ├── route.ts           # Collection: GET (list), POST (create)
│           └── [id]/route.ts     # Item: GET (single), PUT (update), DELETE
├── lib/
│   ├── <domain>/
│   │   └── schema.ts             # Zod schemas for that domain
│   ├── api-error.ts              # ApiError class + handleApiError()
│   ├── auth.ts                   # NextAuth config
│   ├── constants.ts              # All shared constants (PAGINATION_MAX, etc.)
│   ├── navigation.ts             # isNavItemActive()
│   ├── pagination.ts             # parsePaginationParams()
│   ├── permissions.ts            # requireSession(), requireWriteAccess(), canWrite()
│   ├── prisma.ts                 # Prisma client singleton
│   ├── project.ts                # getProjectContext()
│   ├── validators.ts             # isPeriodoValido()
│   └── utils.ts                  # formatDecimal, formatUf, formatDate, startOfDay, …
├── types/
│   ├── <domain>.ts               # API-layer TypeScript types per domain
│   └── index.ts                  # Re-exports all public types
└── components/                   # React UI components
```

---

## 2. Code Quality Principles

These apply to every file, every function, every PR.

### KISS — Keep It Simple
Write the simplest solution that works. Never add abstractions for hypothetical future requirements. If you can handle a case in 3 lines, do not extract it into a helper.

### YAGNI — You Aren't Gonna Need It
Add complexity only when a real requirement demands it. Do not add optional flags, config objects, or extension points speculatively.

### Early Returns Over Nesting
```typescript
// ❌ BAD — deep nesting is hard to follow
if (session) {
  if (item) {
    if (item.proyectoId === proyectoId) {
      // real logic buried here
    }
  }
}

// ✅ GOOD — guard clauses, flat logic
if (!session) return handleApiError(new Error("UNAUTHORIZED"));
if (!item) throw new ApiError(404, "No encontrado.");
if (item.proyectoId !== proyectoId) throw new ApiError(403, "Sin permisos.");
// real logic here
```

### Immutability — Never Mutate In Place
```typescript
// ❌ BAD
const updated = item;
updated.estado = "TERMINADO";

// ✅ GOOD
const updated = { ...item, estado: "TERMINADO" };
const updatedList = [...items, newItem];
```

### Parallel Async — Use Promise.all for Independent Queries
```typescript
// ❌ BAD — sequential when not needed
const proyecto = await prisma.proyecto.findFirst({ where: { id: proyectoId } });
const locales = await prisma.local.findMany({ where: { proyectoId } });

// ✅ GOOD — parallel
const [proyecto, locales] = await Promise.all([
  prisma.proyecto.findFirst({ where: { id: proyectoId } }),
  prisma.local.findMany({ where: { proyectoId } }),
]);
```

### Function Naming — Verb + Noun
```typescript
// ✅ GOOD
function fetchContrato(id: string) {}
function parseRentRollRow(row: unknown) {}
function buildTarifaPayload(tarifas: Tarifa[]) {}
function isContratoVigente(estado: EstadoContrato): boolean {}

// ❌ BAD — nouns only, unclear intent
function contrato(id: string) {}
function tarifa(items: Tarifa[]) {}
```

---

## 3. API Route Rules

Every route handler **must** follow this structure:

```typescript
import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api-error";
import { requireSession, requireWriteAccess } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// READ — authentication only
export async function GET(request: Request): Promise<NextResponse> {
  try {
    await requireSession();

    const { searchParams } = new URL(request.url);
    const proyectoId = searchParams.get("proyectoId");

    if (!proyectoId) {
      return NextResponse.json(
        { message: "proyectoId es obligatorio." },
        { status: 400 }
      );
    }

    // ... logic ...

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}

// CREATE — requires write role
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireWriteAccess();

    const result = mySchema.safeParse(await request.json());
    if (!result.success) {
      return NextResponse.json(
        { message: result.error.issues[0].message, issues: result.error.issues },
        { status: 400 }
      );
    }

    const created = await prisma.myModel.create({ data: result.data });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
```

### HTTP Status Codes

| Status | When |
|--------|------|
| 200 | Default success |
| 201 | POST create |
| 204 | DELETE (no body) |
| 400 | Missing param / validation failure |
| 401 | No session (thrown by requireSession) |
| 403 | Insufficient role (thrown by requireWriteAccess) |
| 404 | Resource not found |
| 409 | Unique constraint conflict (P2002) |
| 422 | Valid JSON but semantically wrong (e.g. date range inverted) |
| 500 | Unhandled error |

### Response Format

- **Errors**: always `{ message: string }` — optionally `{ message, issues }` for validation
- **Single resource**: direct object
- **List (paginated)**: `{ data: T[], nextCursor: string | null, hasMore: boolean }`
- Never wrap success responses in `{ success: true, data: ... }` — this repo uses direct objects

### API Endpoint Checklist

Before shipping any new endpoint, verify:

- [ ] `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"` are present
- [ ] `requireSession()` or `requireWriteAccess()` is the first call inside `try`
- [ ] All required query params are validated and return 400 if missing
- [ ] Input body is validated with `safeParse()` — not `parse()`
- [ ] Every `findMany` / `findFirst` includes `where: { proyectoId }`
- [ ] Multi-table writes use `prisma.$transaction()`
- [ ] P2002 conflict handled → 409 response
- [ ] `catch (error) { return handleApiError(error); }` closes every handler
- [ ] No `console.log` left in production paths
- [ ] Response does not expose stack traces or internal DB details

---

## 4. Auth & Authorization

```typescript
// src/lib/permissions.ts provides:
await requireSession();       // GET endpoints — throws "UNAUTHORIZED" if no session
await requireWriteAccess();   // POST/PUT/DELETE — throws "FORBIDDEN" if role is not ADMIN or OPERACIONES
canWrite(role: UserRole)      // boolean check

// Session shape (from NextAuth):
session.user.id    // string (UUID)
session.user.role  // UserRole ("ADMIN" | "OPERACIONES" | "VIEWER")
```

**Rules:**
- Pages: always use `requireSession()` — NEVER call `auth()` + `redirect()` manually
- Write operations: always `requireWriteAccess()` — never trust role from request body
- Write roles are ADMIN and OPERACIONES (defined in `src/lib/permissions.ts`)

---

## 5. Error Handling

```typescript
import { ApiError, handleApiError } from "@/lib/api-error";
import { Prisma } from "@prisma/client";

// Throw domain errors anywhere in the call stack — caught by handleApiError:
if (!item) throw new ApiError(404, "No encontrado.");
if (item.proyectoId !== proyectoId) throw new ApiError(403, "Sin permisos.");

// Catch Prisma unique constraint violations explicitly:
if (
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002"
) {
  return NextResponse.json(
    { message: "Ya existe un registro con ese código en este proyecto." },
    { status: 409 }
  );
}

// Every catch block ends with:
return handleApiError(error);
```

`handleApiError` handles: `ApiError` (uses its status), `"UNAUTHORIZED"` → 401, `"FORBIDDEN"` → 403, and anything else → logs + 500.

Never surface raw Prisma error messages or stack traces to the client.

---

## 6. Prisma Patterns

### Singleton
```typescript
import { prisma } from "@/lib/prisma";
// Never instantiate PrismaClient directly anywhere else
```

### N+1 Prevention — Use `include`, Never Loop Queries
```typescript
// ❌ BAD — 1 query per contract (N+1)
const contratos = await prisma.contrato.findMany({ where: { proyectoId } });
for (const c of contratos) {
  c.tarifas = await prisma.contratoTarifa.findMany({ where: { contratoId: c.id } });
}

// ✅ GOOD — single query with include
const contratos = await prisma.contrato.findMany({
  where: { proyectoId },
  include: {
    tarifas: { orderBy: { vigenciaDesde: "desc" } },
    arrendatario: true,
    locales: { include: { local: true } },
  },
});
```

### Financial Values — Always Prisma.Decimal
```typescript
import { Prisma } from "@prisma/client";

valor: new Prisma.Decimal(payload.valor),   // DB write
glam2: new Prisma.Decimal(payload.glam2),

// API response types: serialize decimal as string
// type MyRow = { valor: string }
// decimal.toString() when building response
```

### Dates
```typescript
fechaInicio: new Date(payload.fechaInicio),           // DB write
fechaTermino: payload.fechaTermino ? new Date(payload.fechaTermino) : null,

// API response — serialize to ISO date-only string:
const dateOnly = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;
```

### Transactions — Required for Multi-Table Writes
```typescript
const result = await prisma.$transaction(async (tx) => {
  const created = await tx.contrato.create({ data: { ... } });

  await tx.contratoLocal.createMany({
    data: localIds.map((localId) => ({ contratoId: created.id, localId })),
    skipDuplicates: true,
  });

  await tx.contratoTarifa.createMany({
    data: tarifasPayload.map((t) => ({
      contratoId: created.id,
      tipo: t.tipo as TipoTarifaContrato,
      valor: new Prisma.Decimal(t.valor),
      vigenciaDesde: new Date(t.vigenciaDesde),
    })),
  });

  return created;
});
```

### Cursor-Based Pagination
```typescript
import { parsePaginationParams } from "@/lib/pagination";

const { limit, cursor } = parsePaginationParams(searchParams);

const rows = await prisma.myModel.findMany({
  where: { proyectoId },
  take: limit + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: { id: "asc" },
});

const hasMore = rows.length > limit;
const data = hasMore ? rows.slice(0, limit) : rows;
const nextCursor = hasMore ? (data[data.length - 1]?.id ?? null) : null;

return NextResponse.json({ data, nextCursor, hasMore });
```

### Always Scope Queries to proyectoId
```typescript
// Every findMany / findFirst on tenant-scoped data MUST include:
where: { proyectoId }
```

### Prisma Schema Rules (when editing `prisma/schema.prisma`)
```prisma
model MyModel {
  id          String   @id @default(uuid()) @db.Uuid
  proyectoId  String   @db.Uuid
  // ...

  // Always index foreign keys
  @@index([proyectoId])

  // Add unique constraints for natural keys
  @@unique([proyectoId, codigo])
}

// Enum values: UPPER_SNAKE_CASE
enum EstadoMiModelo {
  ACTIVO
  INACTIVO
  PENDIENTE
}
```

**Index rules:**
- Always add `@@index([proyectoId])` on every tenant-scoped model
- For composite lookups like `WHERE proyectoId = x AND estado = y`, add `@@index([proyectoId, estado])`
- Equality columns before range columns in composite indexes

### Type-Safe Prisma Includes — `satisfies` + `GetPayload`

When a page or function needs a Prisma query result with includes, declare query args as a `const` with `satisfies`, then derive the payload type from it. Never write the type manually.

```typescript
import { Prisma } from "@prisma/client";

// Declare args with satisfies — TypeScript validates the shape
const contratoQueryArgs = {
  include: {
    tarifas: { orderBy: { vigenciaDesde: "desc" as const } },
    locales: { include: { local: true } },
    arrendatario: true,
  },
} satisfies Prisma.ContratoDefaultArgs;

// Derive the payload type — never write this manually, it will drift
type ContratoRow = Prisma.ContratoGetPayload<typeof contratoQueryArgs>;

// Use in the query
const rows = await prisma.contrato.findMany({
  where: { proyectoId },
  ...contratoQueryArgs,
});
// rows is typed as ContratoRow[]
```

---

## 7. Zod Validation

```typescript
// src/lib/<domain>/schema.ts
import { z } from "zod";
import { Prisma } from "@prisma/client";

// Copy these three helpers into each new domain's schema.ts.
// Reference implementation: src/lib/contracts/schema.ts
// Do NOT cross-import them between domains.
export const dateStringSchema = z
  .string()
  .min(1)
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha invalida.");

export const decimalStringSchema = z
  .string()
  .min(1)
  .refine((v) => {
    try { new Prisma.Decimal(v); return true; } catch { return false; }
  }, "Numero decimal invalido.");

// Note: nullableDateStringSchema does NOT chain .min(1) — nullable allows empty
export const nullableDateStringSchema = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Fecha invalida.")
  .nullable();

export const mySchema = z.object({
  proyectoId:   z.string().min(1),
  nombre:       z.string().trim().min(1, "Nombre es obligatorio."),
  monto:        decimalStringSchema,
  fechaInicio:  dateStringSchema,
  fechaTermino: nullableDateStringSchema,
}).superRefine((data, ctx) => {
  // Cross-field validation
  if (data.fechaTermino && new Date(data.fechaInicio) > new Date(data.fechaTermino)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fechaInicio no puede ser mayor que fechaTermino.",
      path: ["fechaInicio"],
    });
  }
});

// Infer the payload type from the schema — do not write it manually:
type MyPayload = (typeof mySchema)["_type"];
```

**Rules:**
- Always `safeParse()` — never `parse()`
- Schemas live in `src/lib/<domain>/schema.ts`
- Copy `dateStringSchema`, `decimalStringSchema`, `nullableDateStringSchema` into each domain's schema — never cross-import between domains
- Cross-field validation goes in `.superRefine()` — not in the route handler
- Duplicate-key detection (tarifas, ggcc) also goes in `.superRefine()`

---

## 8. TypeScript Conventions

```typescript
// Types live in src/types/<domain>.ts
import type { EstadoContrato } from "@prisma/client";  // import Prisma enums as type

export type MyApiRow = {
  id:           string;
  proyectoId:   string;
  valor:        string;          // Decimals are ALWAYS string in API types
  fechaInicio:  string;          // Dates are ALWAYS ISO string in API types
  estado:       EstadoContrato;  // Prisma enums used directly
};

// Re-export from src/types/index.ts:
export type { MyApiRow } from "./my-domain";
```

**Rules:**
- Decimals in API types: `string`, never `number`
- Dates in API types: `string` (ISO), never `Date`
- Never use `any` — use `unknown` and narrow, or use the actual Prisma type
- Infer payload types from Zod: `type Payload = (typeof schema)["_type"]`
- All public types re-exported from `src/types/index.ts`
- Prefer `type` over `interface` for consistency

---

## 9. Naming Conventions

| Element | Convention | Examples |
|---------|-----------|---------|
| Files | kebab-case | `api-error.ts`, `rent-roll.ts` |
| API route dirs | kebab-case | `arrendatarios/`, `rent-roll/` |
| Functions | camelCase verb-noun | `requireSession()`, `fetchContrato()`, `buildTarifaPayload()` |
| Types / Interfaces | PascalCase | `ContractApiBaseRow`, `RentRollResumen` |
| Constants | UPPER_SNAKE_CASE | `PAGINATION_MAX`, `MS_PER_DAY` |
| Boolean variables/fields | `es`/`has`/`vigente` prefix | `esDiciembre`, `hasMore`, `vigente` |
| DB enum values | UPPER_SNAKE_CASE | `VIGENTE`, `TERMINADO_ANTICIPADO` |
| Route params | camelCase | `proyectoId`, `arrendatarioId` |

---

## 10. Shared Utilities — Always Use, Never Redefine

### Formatters — `src/lib/utils.ts`
```typescript
import { formatDecimal, formatUf, formatDate, formatDateString, startOfDay, startOfUtcDay } from "@/lib/utils";
```
Never define local date or decimal formatters in components or pages.

### Constants — `src/lib/constants.ts`
```typescript
import {
  PAGINATION_MAX,          // 200 — hard cap for any paginated endpoint
  PAGINATION_DEFAULT,      // 50  — default page size
  MS_PER_DAY,              // milliseconds in one day
  OCCUPANCY_HIGH_THRESHOLD, // 85 — % above which occupancy is "high"
  OCCUPANCY_LOW_THRESHOLD,  // 70 — % below which occupancy is "low"
  CONTRACT_EXPIRY_WINDOWS,  // [30, 60, 90] — day buckets for expiry alerts
  CONTRACT_EXPIRY_ROW_LIMIT, // 10 — max rows in expiry summary widget
  UF_STALENESS_DAYS,        // 5  — days before UF rate is considered stale
  MAX_PDF_BYTES,            // 10 MB — max contract PDF size
  PERIODO_REGEX,            // /^\d{4}-\d{2}$/ — validates YYYY-MM strings
  SLUG_MAX_ATTEMPTS,        // 50 — retry cap for slug generation
} from "@/lib/constants";
```
Never define magic numbers inline.

### Pagination — `src/lib/pagination.ts`
```typescript
import { parsePaginationParams } from "@/lib/pagination";
const { limit, cursor } = parsePaginationParams(searchParams);
```

### Project Context — `src/lib/project.ts`
```typescript
import { getProjectContext } from "@/lib/project";

// Called in every dashboard page immediately after requireSession():
const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);
// projects: { id, nombre, slug }[] — all active projects ordered by nombre
// selectedProjectId: validated ID from searchParams, or first project's ID as fallback
```

### Validators — `src/lib/validators.ts`
```typescript
import { isPeriodoValido } from "@/lib/validators";

isPeriodoValido("2025-03")  // true  — validates YYYY-MM format via PERIODO_REGEX
isPeriodoValido("2025-3")   // false
```

### Navigation — `src/lib/navigation.ts`
```typescript
import { isNavItemActive } from "@/lib/navigation";
```

---

## 11. What NOT to Do

| Forbidden | Use instead |
|-----------|-------------|
| `import { PrismaClient } from "@prisma/client"` | `import { prisma } from "@/lib/prisma"` |
| `schema.parse(body)` | `schema.safeParse(body)` |
| `auth() + redirect()` in pages | `requireSession()` |
| Inline `new Date().toLocaleDateString()` | `formatDate()` from utils |
| Inline `Number(x).toFixed(2)` | `formatDecimal()` from utils |
| `prisma.findMany()` without `where: { proyectoId }` | Always scope to proyectoId |
| Loop queries per item (N+1) | Use Prisma `include` |
| `const x: any` | Use `unknown` or the actual Prisma type |
| `Promise.all` skipped for independent DB calls | Parallelize with `Promise.all` |
| Deep `if` nesting (3+ levels) | Guard clauses / early returns |
| Raw `new Prisma.Decimal()` in response types | Serialize to `string` in API types |
| `console.log()` in API routes | Let `handleApiError` log; use structured errors |
| Hardcoded `50` or `200` for pagination | `PAGINATION_DEFAULT`, `PAGINATION_MAX` |
| Hardcoded `[30, 60, 90]` for expiry windows | `CONTRACT_EXPIRY_WINDOWS` |
| Hardcoded `10` for expiry row limit | `CONTRACT_EXPIRY_ROW_LIMIT` |
| Hardcoded `5` for UF staleness days | `UF_STALENESS_DAYS` |
| Custom YYYY-MM regex inline | `PERIODO_REGEX` or `isPeriodoValido()` from `@/lib/validators` |
| Custom project resolution logic in pages | `getProjectContext()` from `@/lib/project` |
| `Math.random()` for IDs | Prisma `@default(uuid())` |
| Multi-table writes without transaction | `prisma.$transaction()` |
| Cross-importing `dateStringSchema` / `decimalStringSchema` from another domain | Copy the helpers into that domain's own `schema.ts` |
| Functions > ~40 lines | Split into focused helpers |
| `interface` where `type` suffices | Use `type` |
| Building ad-hoc `<table>` markup | Use `useDataTable` + `<DataTable>` |
| `toast()` without `sonner` import | `import { toast } from "sonner"` |
| `list[index]` as React key | `crypto.randomUUID()` stored in draft item `_key` |
| `response.json()` without checking `response.ok` | Check `ok`, then `readErrorMessage()` |
| `setState(value)` when new state depends on old | Use functional update `setState(prev => ...)` |
| Defining local `cn()` or class mergers | Import `cn` from `@/lib/utils` |
| Hardcoded colors like `text-blue-500` | Use design tokens: `brand-*`, `gold-*`, `slate-*` |
| `useEffect` to compute derived state | Use `useMemo` instead |

---

## 12. Frontend Patterns

### Component Structure

Every component uses typed `type` props (not `interface`), extends native HTML when wrapping primitives, and composes classNames with `cn()`:

```typescript
import { cn } from "@/lib/utils";

type MyComponentProps = {
  label: string;
  variant?: "default" | "outline";
  className?: string;
};

export function MyComponent({ label, variant = "default", className }: MyComponentProps) {
  return (
    <div className={cn("base-classes", variant === "outline" && "border", className)}>
      {label}
    </div>
  );
}
```

For components with multiple visual variants, use **CVA** (`class-variance-authority`) — see `src/components/ui/button.tsx` as the canonical example:

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const myVariants = cva("base-class", {
  variants: {
    variant: {
      default: "bg-brand-500 text-white hover:bg-brand-700",
      outline: "border border-slate-300 bg-white hover:bg-slate-50",
    },
    size: { default: "h-10 px-4", sm: "h-9 px-3" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

type Props = React.ComponentProps<"button"> & VariantProps<typeof myVariants>;
```

### Custom Hooks

Live in `src/hooks/`, always start with `use`, encapsulate a single concern:

```typescript
// src/hooks/useMyDomain.ts

// Pattern A — API operations hook (see useContractApi.ts)
export function useMyDomainApi() {
  async function saveItem(payload: MyPayload): Promise<MyRow> {
    const response = await fetch("/api/my-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response, "Error al guardar."));
    }

    return response.json() as Promise<MyRow>;
  }

  return { saveItem };
}

// Pattern B — state + table (see useDataTable.ts)
export function useDataTable<TData>(data: TData[], columns: ColumnDef<TData, unknown>[]) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data, columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters },
  });

  return { table };
}
```

### Reading API Errors from `fetch`

`readErrorMessage` is a private helper — define it locally in each hook or component that needs it. Two variants exist in this codebase; use whichever matches your context:

```typescript
// Variant A — async, for hooks that receive a raw Response (see useContractApi.ts):
async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return fallback;
  try {
    const data = (await response.json()) as { message?: string };
    return data.message ?? fallback;
  } catch {
    return fallback;
  }
}

// Variant B — sync, for components that already parsed the body:
function readErrorMessage(value: unknown, fallback: string): string {
  if (value !== null && typeof value === "object" && "message" in value && typeof (value as { message: unknown }).message === "string") {
    return (value as { message: string }).message;
  }
  return fallback;
}

// Usage — always throw an Error so catch blocks get error.message:
if (!response.ok) {
  throw new Error(await readErrorMessage(response, "Error inesperado."));
}
```

### Client-Side Error Handling — Toast

All user-facing errors and successes use **sonner**:

```typescript
import { toast } from "sonner";

async function handleSave() {
  try {
    await api.saveItem(payload);
    toast.success("Guardado correctamente.");
    router.refresh();        // revalidate server data
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Error inesperado.");
  }
}
```

### Optimistic State Updates

Update local state immediately, let the server catch up via `router.refresh()`:

```typescript
const [, startTransition] = useTransition();

async function handleDelete(id: string) {
  setDeletingId(id);
  try {
    await api.deleteItem(id);
    setList((prev) => prev.filter((item) => item.id !== id));   // optimistic remove
    toast.success("Eliminado correctamente.");
    startTransition(() => router.refresh());                      // sync server
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Error inesperado al eliminar.");
  } finally {
    setDeletingId(null);
  }
}
```

### State Patterns

```typescript
// Derived state — use useMemo, not useEffect + setState
const selectedItem = useMemo(
  () => list.find((item) => item.id === selectedId) ?? null,
  [list, selectedId]
);

// Functional updates — always use prev => pattern (avoids stale closures)
setList((prev) => [...prev, newItem]);
setList((prev) => prev.filter((item) => item.id !== id));
setFormData((prev) => ({ ...prev, nombre: value }));

// File inputs — use ref, not state
const fileInputRef = useRef<HTMLInputElement>(null);
```

### Tables

Always use the repo's `useDataTable` + `DataTable` component — do not build ad-hoc tables.

The `@tanstack/react-table` `ColumnMeta` interface is augmented inside `src/components/ui/DataTable.tsx` and applies globally — do NOT redeclare it elsewhere:

```typescript
// Already declared in DataTable.tsx — available everywhere, do not repeat:
declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "center" | "right";       // text alignment for header and cells
    filterType?: "string" | "enum" | "number"; // drives which filter UI is shown
    filterOptions?: string[];                  // enum values when filterType is "enum"
  }
}
```

```typescript
import { useDataTable } from "@/hooks/useDataTable";
import { DataTable } from "@/components/ui/DataTable";
import type { ColumnDef } from "@tanstack/react-table";

const columns: ColumnDef<MyRow>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
    meta: { filterType: "string" },   // enables text search filter
  },
  {
    accessorKey: "estado",
    header: "Estado",
    meta: {
      filterType: "enum",
      filterOptions: ["ACTIVO", "INACTIVO"],
    },
  },
];

function MyTable({ data }: { data: MyRow[] }) {
  const { table } = useDataTable(data, columns);
  return <DataTable table={table} emptyMessage="Sin registros." />;
}
```

Column metadata drives filter behavior — do not add filter UI manually.

### Form Draft Pattern

Complex forms (contracts, tarifas, ggcc) use a **draft payload** intermediate type that differs from the API payload. Transformation happens at submit time:

```typescript
// Draft type — what the form holds (has _key for React list tracking)
type MyDraftItem = {
  _key: string;   // crypto.randomUUID() — never use index as key
  valor: string;
  vigenciaDesde: string;
};

// At submit — transform to API payload
function toApiPayload(draft: MyFormDraft): MyApiPayload {
  return {
    ...draft,
    items: draft.items.map(({ _key: _, ...item }) => item),  // strip _key
  };
}

// Generate keys for new list items:
const newItem: MyDraftItem = { _key: crypto.randomUUID(), valor: "", vigenciaDesde: "" };
```

### Conditional Rendering

```typescript
// ✅ GOOD — simple and readable
{isLoading && <Spinner />}
{error && <p className="text-rose-600">{error}</p>}
{data && <MyComponent data={data} />}

// ❌ BAD — ternary chains
{isLoading ? <Spinner /> : error ? <ErrorMsg /> : data ? <MyComponent /> : null}
```

---

## 13. Tailwind & UI Tokens

| Token | Usage |
|-------|-------|
| `brand-500` | Primary buttons, links, active indicators |
| `brand-700` | Hover state, table headers |
| `brand-50` | Hover background on rows |
| `gold-400` | Accent highlights |
| `slate-*` | All neutral text, borders, backgrounds |
| `emerald-100/700` | Success status badges |
| `rose-100/600/700` | Danger / delete actions |
| `amber-100/700` | Warning status badges |

**Rules:**
- Radius: `rounded-md` — never `rounded-lg` or `rounded-sm` for interactive elements
- Shadow: `shadow-sm` — never `shadow-md` or custom shadows
- Never define custom colors outside the tokens above
- Use `cn()` for all conditional className composition

---

## 14. Testing

Tests use **Vitest**. Run with `npm test`. 17 test files cover API route handlers, utility functions, and upload mappers.

### Mock setup — `vi.hoisted()` pattern

Every API route test uses this structure. `vi.hoisted()` is required so mock references are available before module imports are hoisted by Vitest:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { requireSessionMock, requireWriteAccessMock, prismaMock } = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requireWriteAccessMock: vi.fn(),
  prismaMock: {
    myModel: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/permissions", () => ({
  requireSession: requireSessionMock,
  requireWriteAccess: requireWriteAccessMock,
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Import route handlers after mocks — use dynamic import inside helpers:
async function callGet(request: Request) {
  const { GET } = await import("./route");
  return GET(request);
}
```

### AAA pattern — Arrange, Act, Assert

```typescript
it("returns 404 when contrato does not exist", async () => {
  // Arrange
  requireSessionMock.mockResolvedValue({ user: { id: "u1", role: "ADMIN" } });
  prismaMock.contrato.findFirst.mockResolvedValue(null);

  // Act
  const response = await callGet(new Request("http://localhost/api/contracts/nonexistent?proyectoId=p1"));

  // Assert
  expect(response.status).toBe(404);
  const body = await response.json();
  expect(body.message).toBeDefined();
});
```

Test names describe behaviour in a specific situation:
- `"returns 400 when proyectoId is missing"`
- `"returns 409 when numero de contrato already exists"`
- `"creates contrato with all tarifas in a single transaction"`

---

## 15. Server Component Pattern

Pages in `src/app/(dashboard)/` are async Server Components — they fetch data directly via Prisma, serialize it, then pass it to Client Components. This is the **only** data-fetching pattern in this app. There is no React Query, SWR, or `getServerSideProps`.

### Canonical page structure

```typescript
// No "use client" — pages are Server Components
import { redirect } from "next/navigation";
import { requireSession, canWrite } from "@/lib/permissions";
import { getProjectContext } from "@/lib/project";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import MyClientComponent from "@/components/my-domain/MyClientComponent";

export default async function MyPage({
  searchParams,
}: {
  searchParams: { proyecto?: string };
}): Promise<JSX.Element> {
  // 1. Auth — always the first await
  const session = await requireSession();
  const canEdit = canWrite(session.user.role);

  // 2. Project context — always immediately after auth
  const { projects, selectedProjectId } = await getProjectContext(searchParams.proyecto);

  // 3. Guard — redirect to first project if none selected or URL is stale
  if (!selectedProjectId) {
    return <ProjectCreationPanel />;
  }
  if (searchParams.proyecto !== selectedProjectId) {
    redirect(`/my-route?proyecto=${selectedProjectId}`);
  }

  // 4. Declare typed query args (see Section 6 — satisfies pattern)
  const queryArgs = {
    include: { relatedModel: true },
  } satisfies Prisma.MyModelDefaultArgs;
  type MyRow = Prisma.MyModelGetPayload<typeof queryArgs>;

  // 5. Parallel Prisma queries
  const [rows, otherData] = await Promise.all([
    prisma.myModel.findMany({ where: { proyectoId: selectedProjectId }, ...queryArgs }),
    prisma.otherModel.findMany({ where: { proyectoId: selectedProjectId } }),
  ]);

  // 6. Serialize — convert Prisma.Decimal and Date before passing to Client Components
  //    These types are NOT serializable across the RSC boundary.
  const serialized = rows.map((row) => ({
    ...row,
    valor: row.valor.toString(),                    // Prisma.Decimal → string
    fecha: row.fecha.toISOString().slice(0, 10),    // Date → "YYYY-MM-DD"
    fechaNullable: row.fechaNullable?.toISOString().slice(0, 10) ?? null,
  }));

  // 7. Render — pass serialized data down
  return <MyClientComponent data={serialized} canEdit={canEdit} projects={projects} />;
}
```

**Rules:**
- No `"use client"` on page files — pages are always Server Components
- `requireSession()` is always the first `await` in the page function
- `getProjectContext()` is always called immediately after auth
- All `Prisma.Decimal` and `Date` values **must** be serialized to strings before becoming props — passing raw Prisma types across the RSC boundary causes a runtime error
- Use `Promise.all` for all independent queries — never sequential `await`
- Never fetch data inside Client Components — pass it from the page

---

## 16. Environment Variables

Copy `.env.example` to `.env` and fill in values. Never commit `.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon PostgreSQL connection string |
| `NEXTAUTH_URL` | Yes | Full app URL — `http://localhost:3000` in dev |
| `NEXTAUTH_SECRET` | Yes | Random secret — generate with `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Yes | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth client secret |
| `ALLOWED_EMAIL_DOMAIN` | Yes | Only users with this email domain can sign in (e.g. `capitaladvisors.cl`) |
| `GCP_PROJECT_ID` | Deploy only | Google Cloud project ID |
| `GCP_REGION` | Deploy only | Cloud Run region (e.g. `southamerica-west1`) |
| `CLOUD_SQL_INSTANCE` | Deploy only | Cloud SQL instance name |
| `GCS_BUCKET_NAME` | Deploy only | GCS bucket for PDF and file uploads |

### Neon dev branch strategy

Each developer works on a personal Neon branch to avoid conflicting migrations:
1. Go to `console.neon.tech` → your project → Branches → Create branch.
2. Name it after your git branch (e.g. `felipe`, `alfredo`).
3. Copy the connection string into `DATABASE_URL` in `.env`.

### Naming rules

- **Never** prefix server-only variables with `NEXT_PUBLIC_` — that exposes them in the browser bundle.
- `NEXT_PUBLIC_` is reserved for variables that must be readable client-side. This project currently has none.
