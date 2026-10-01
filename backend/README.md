# Backend

A small, untrusted backend: it indexes public chain data, pays fees through the relayer and runs the Butler, which cranks each round's due actions. Not built yet.

The frontend reads it through `frontend/apps/web/data/api.ts` once `NEXT_PUBLIC_KITTY_API` is set. See `docs/architecture.md` for the design.
