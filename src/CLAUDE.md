# CLAUDE

## Convenciones del proyecto
- Patrón de auth: usar `requireSession()` y `requireWriteAccess()` de `src/lib/permissions.ts`.
- Manejo de errores: usar `ApiError` + `handleApiError()` de `src/lib/api-error.ts`.
- Estilos: clases Tailwind con tokens `brand-500/700`, `gold-400`, `rounded-md`, `shadow-sm`.
- Formato de respuesta API: `{ message: string }` en errores, objeto directo en éxito.
- Paginación: cursor-based con parámetros `limit` (máx. 200) + `cursor`.
