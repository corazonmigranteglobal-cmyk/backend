# CLAUDE.md — Corazón Migrante backend

## Answer codebase questions from the knowledge graph first (token savings)

This repo ships a pre-built **graphify** knowledge graph in [graphify-out/](graphify-out/).
`graph.json` is ~3.5 MB — reading it (or fanning out across many source files)
to answer a "how does X work / what calls Y / trace the flow of Z" question
burns a large amount of context. **Query the graph instead.**

Before reading source files to answer a conceptual/architecture/impact question,
run one of the wrappers (they cap the answer to a token budget and reuse the
cached interpreter in `graphify-out/.graphify_python`):

```powershell
# PowerShell (primary shell)
./scripts/graphify-query.ps1 "How does auth token refresh work?"
./scripts/graphify-query.ps1 -Mode explain "AuthModule"
./scripts/graphify-query.ps1 -Mode path "auth" "user"
./scripts/graphify-query.ps1 -Budget 1500 "Trace the appointment status flow"
```

```bash
# Bash
scripts/graphify-query.sh "How does auth token refresh work?"
scripts/graphify-query.sh --mode explain "AuthModule"
scripts/graphify-query.sh --budget 1500 "Trace the appointment status flow"
```

Equivalent raw calls (any interpreter that has `graphify` installed):

```bash
python -m graphify query "<question>" --budget 1200 --graph graphify-out/graph.json
python -m graphify explain "<NodeLabel>" --graph graphify-out/graph.json
python -m graphify path "<A>" "<B>" --graph graphify-out/graph.json
python -m graphify affected "<X>" --graph graphify-out/graph.json   # reverse impact
```

Workflow:
1. Query the graph for the relevant nodes/edges and their `source_location`s.
2. Open **only** the specific files/lines the graph points to — not the whole tree.
3. `graphify-out/GRAPH_REPORT.md` (44 KB) is a plain-language map of the
   communities; skim it for orientation, but prefer targeted queries over
   re-reading it wholesale.

Rebuild the graph after significant changes with `/graphify . --update`.
Do **not** read `graphify-out/graph.json` or `graphify-out/graph.html` directly —
they are machine artifacts, not context.
