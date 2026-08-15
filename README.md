# AEGIS MASTER V10 FINAL

Monorepo materializado de la jerarquía AEGIS:

CEO Brain → Manager Brain → Finance / Commerce / SaaS / Media

## Qué contiene físicamente este ZIP

- `apps/finance-brain`: copia del AEGIS Command Center materializado previamente.
- `apps/saas-brain`: copia física de AEGIS SaaS Brain V3.
- `apps/commerce-brain`: servicio funcional de Commerce Brain con 10 agentes, opportunity bus y métricas.
- `apps/media-brain`: servicio funcional de Media Brain con 10 agentes, content queue y estados.
- `apps/manager-brain`: supervisor funcional de los 4 Brains operativos, health polling, propuestas e incidentes.
- `apps/ceo-brain`: capa CEO funcional que consume exclusivamente Manager, filtra reportes y prepara entregas.
- `apps/master-ui`: interfaz final de jerarquía CEO → Manager → 4 Brains.
- `packages/inter-brain-protocol`: schemas/versionado y utilidades comunes.
- `scripts`: integrity check, health check, dev launcher y rearm.
- `docker-compose.yml`, `.env.example`, `REARM.md`, `manifest.json`.

## Arranque rápido

1. Copia variables:

```bash
cp .env.example .env
```

2. Levanta con Docker:

```bash
docker compose up --build
```

3. Abre:

```text
Master UI:     http://localhost:8810
Finance UI:    http://localhost:8811
Commerce UI:   http://localhost:8812
SaaS UI:       http://localhost:8813
Media UI:      http://localhost:8814
CEO Brain:     http://localhost:8806
Manager Brain: http://localhost:8805
Commerce:      http://localhost:8802
Media:         http://localhost:8804
SaaS:          http://localhost:8790
Finance:       http://localhost:8787
```

## Modo sin credenciales

Todo el sistema puede arrancar en modo MOCK/read-only para comprobar la jerarquía, health checks, reportes y UI.
Las integraciones externas reales requieren sus respectivas credenciales.

## Integridad

```bash
node scripts/integrity-check.mjs
```

El script comprueba los ficheros críticos del Master.

## Seguridad

- Las claves viven en backend/.env.
- CEO no se conecta directamente a los Brains operativos: consulta Manager.
- Manager solo recomienda/coordina; las acciones sensibles deben pasar por políticas del Brain correspondiente.
- Los conectores externos quedan separados por adapters.
