# REARM — Recuperación de AEGIS

## Reinicio completo

```bash
docker compose down
docker compose up --build -d
node scripts/healthcheck.mjs
```

## Si un Brain no responde

1. Comprueba `.env`.
2. Verifica el puerto del Brain.
3. Ejecuta `docker compose ps`.
4. Revisa logs: `docker compose logs <service>`.
5. Reinicia solo ese servicio: `docker compose restart <service>`.
6. Ejecuta `node scripts/healthcheck.mjs`.

## Si Manager marca un Brain offline

No conectes CEO directamente al Brain. Corrige la dependencia y deja que Manager vuelva a incorporar la telemetría.

## Si hay fallo de UI

```bash
docker compose restart master-ui
```

## Integridad

```bash
node scripts/integrity-check.mjs
```

Si falla, no considerar el Master apto para producción.
