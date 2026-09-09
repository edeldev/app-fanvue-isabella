# Ejecución permanente de workflows

La aplicación expone `GET /api/cron/workflows`. La ruta procesa las ejecuciones vencidas de todos los creadores y exige este encabezado:

```text
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` debe ser aleatorio y tener al menos 16 caracteres. Debe configurarse tanto en el alojamiento de la aplicación como en el programador externo.

## Opción recomendada sin pagar cron de Vercel

Después de desplegar la aplicación, Supabase Cron puede llamar la ruta cada minuto. Habilita `pg_cron`, `pg_net` y Vault desde Supabase. Guarda la URL y el secreto en Vault:

```sql
select vault.create_secret('https://TU-DOMINIO.com/api/cron/workflows', 'workflow_cron_url');
select vault.create_secret('TU_CRON_SECRET', 'workflow_cron_secret');
```

Programa la llamada:

```sql
select cron.schedule(
  'fanvue-workflows-every-minute',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'workflow_cron_url'),
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'workflow_cron_secret')
    )
  );
  $$
);
```

Para eliminarlo posteriormente:

```sql
select cron.unschedule('fanvue-workflows-every-minute');
```

## Vercel Pro

En Vercel Pro se puede añadir a `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/workflows", "schedule": "* * * * *" }]
}
```

Vercel enviará automáticamente `Authorization: Bearer ${CRON_SECRET}`. No uses esta frecuencia en Vercel Hobby porque ese plan solo admite una ejecución diaria.
