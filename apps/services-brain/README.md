# Services Brain

Motor comercial para vender, cotizar, cobrar y entregar servicios digitales desde el AEGIS cockpit.

## Modos de seguridad

- `PAPER`: propuestas, campañas, publicaciones y assets quedan registrados como drafts.
- `SERVICES_REQUIRE_APPROVAL=true`: protege generación con proveedor, outreach, publicación y checkout.
- `SERVICES_AUTOMATION_ENABLED=false`: prepara secuencias, pero no envía seguimientos automáticamente.
- `SERVICES_MAX_OUTREACH_PER_DAY`: límite diario de correo saliente.
- `SERVICES_API_TOKEN`: protege las rutas `/api` cuando se configura.

## Capacidades principales

- CRM con deduplicación, scoring, calificación, etapas y próxima acción.
- Paquetes Starter, Growth y Premium para cada servicio.
- Propuestas con alcance, supuestos, hitos, vencimiento y checkout Stripe protegido.
- Command Chamber con planificación previa y ejecución de workflows.
- Promotion Builder, Campaign Builder y MuAPI/Media asset factory.
- Cola de aprobaciones para email, assets, publicaciones y pagos.
- Analítica de funnel, atribución, unit economics, forecast y retención.
- Delivery con intake, hitos, salud de proyecto y oportunidades de cross-sell.

## Rutas útiles

```text
GET  /health
GET  /api/crm/dashboard
GET  /api/crm/pipeline
GET  /api/service-packages
POST /api/brain/plan
POST /api/brain/command
GET  /api/approvals?status=PENDING
GET  /api/analytics/funnel
GET  /api/analytics/attribution
GET  /api/analytics/unit-economics
GET  /api/analytics/forecast
GET  /api/analytics/retention
GET  /api/operations/queue
```

## Producción

Antes de activar automatizaciones reales hay que verificar los dominios de Resend, SPF/DKIM/DMARC, webhook de eventos, credenciales de publicación social, Stripe webhooks y una base de datos transaccional. El almacenamiento JSON actual es de desarrollo y debe migrarse a PostgreSQL/Supabase/Neon para múltiples operadores y backups.
