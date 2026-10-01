# Kitty

Kitty turns the savings circle into a private, protected savings party on Solana.

## Layout

| Folder | What's in it |
| --- | --- |
| [`frontend/`](frontend) | Next.js app plus the UI kit and SDK (pnpm workspace, turborepo) |
| [`backend/`](backend) | Indexer, relayer fees and the Butler cranks (not built yet) |
| [`contracts/`](contracts) | The Solana program, Rust + Anchor (not built yet) |

## Frontend

```bash
cd frontend
pnpm install   # also fetches the licensed fonts
pnpm dev       # http://localhost:3100
pnpm check     # contrast, copy lint, typecheck, tests
```

Progress notes live in [`memory.md`](memory.md).
