console.log(`
AEGIS REARM
1. cp .env.example .env
2. docker compose down
3. docker compose up --build -d
4. node scripts/healthcheck.mjs
5. node scripts/integrity-check.mjs
See REARM.md for recovery procedures.
`);
