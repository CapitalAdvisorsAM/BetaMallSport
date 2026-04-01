# CLAUDE

## Convenciones del proyecto
- Patrón de auth: usar `requireSession()` y `requireWriteAccess()` de `src/lib/permissions.ts`.
- Manejo de errores: usar `ApiError` + `handleApiError()` de `src/lib/api-error.ts`.
- Estilos: clases Tailwind con tokens `brand-500/700`, `gold-400`, `rounded-md`, `shadow-sm`.
- Formato de respuesta API: `{ message: string }` en errores, objeto directo en éxito.
- Paginación: cursor-based con parámetros `limit` (máx. 200) + `cursor`.

## Coding Standards

### Formatters
- Usar SIEMPRE las utilidades de `src/lib/utils.ts`: `formatDecimal`, `formatUf`, `formatDate`, `formatDateString`, `startOfDay`, `startOfUtcDay`.
- NO definir formatters locales en componentes o pages.

### Constantes
- Constantes compartidas van en `src/lib/constants.ts`.
- No definir `MS_PER_DAY`, `DAY_MS` ni thresholds inline.

### Auth
- Pages: usar `requireSession()` de `src/lib/permissions.ts`.
- API routes: usar `requireSession()` o `requireWriteAccess()` según necesidad.
- NUNCA usar `auth()` + `redirect` manual en pages.

### Navegación
- `isNavItemActive()` vive en `src/lib/navigation.ts`.
