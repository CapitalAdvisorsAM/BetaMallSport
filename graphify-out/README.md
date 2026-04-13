# Graphify — Knowledge Graph del proyecto

Este directorio contiene el grafo de conocimiento generado automáticamente sobre el codebase de BetaMallSport.

## Archivos generados

| Archivo | Descripción |
|---------|-------------|
| `graph.html` | Grafo interactivo navegable en el browser |
| `graph.json` | Grafo en formato GraphRAG-ready (nodos + edges + comunidades) |
| `GRAPH_REPORT.md` | Reporte en texto plano: god nodes, conexiones sorpresivas, métricas |
| `manifest.json` | Lista de todos los archivos procesados con sus hashes |
| `cost.json` | Historial de ejecuciones y tokens consumidos |
| `cache/` | Cache incremental — evita reprocesar archivos sin cambios |

## Cómo regenerarlo

### Requisito previo

Tener Claude Code instalado con el skill `graphify` disponible en `~/.claude/skills/graphify/`.

### Regeneración completa

Desde Claude Code, en la raíz del proyecto:

```
/graphify
```

Esto procesa todos los archivos del directorio actual y sobreescribe los outputs.

### Regeneración incremental (recomendado)

Solo re-extrae archivos nuevos o modificados desde la última ejecución:

```
/graphify . --update
```

Usar `--update` cuando hubo commits recientes o se agregaron archivos, ya que es significativamente más rápido.

### Cuándo regenerar

Regenerar el grafo cuando:

- Se agregaron nuevas features o módulos importantes
- Se modificaron archivos core (`lib/`, `types/`, `prisma/schema.prisma`)
- Pasaron más de algunos días desde la última generación y hay cambios acumulados
- El `GRAPH_REPORT.md` muestra una fecha anterior a los últimos commits relevantes

Para verificar la fecha del último run:

```bash
head -1 graphify-out/GRAPH_REPORT.md
```

## Cómo usarlo

El CLAUDE.md del proyecto instruye a Claude a consultar el grafo antes de leer archivos raw. Esto acelera la navegación del codebase y reduce el uso de contexto.

Claude consulta el grafo automáticamente al inicio de cada conversación si así está configurado en el CLAUDE.md.

Para explorar el grafo visualmente, abrir `graph.html` en cualquier browser.
