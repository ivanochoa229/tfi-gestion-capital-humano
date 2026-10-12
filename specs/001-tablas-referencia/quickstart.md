# Quickstart: validación de Tablas de referencia

## Prerrequisitos

- `.env` creado desde `.env.example` con `ADMIN_TOKEN=cambiame` agregado.
- `docker compose up --build` (las migraciones corren al arrancar). Cuando exista un cliente, dejar
  `curl` con `-H "x-admin-token: cambiame"` en las escrituras.

## Validación automática

```bash
cd backend && npm run lint && npm run format && npm test
cd ../frontend && npm run api:tipos && npm run lint && npm run format && npm run build
```

## Escenarios (mapean a las historias del spec)

1. **Valores iniciales (US1)**: `GET /api/referencia` devuelve 10 dominios; `GET /api/referencia/nivel-dominio` devuelve 4 valores ordenados; cada dominio tiene ≥1 valor activo. Reiniciar con un volumen limpio da los mismos datos (SC-005).
2. **Alta y edición (US2)**: `POST /api/referencia/tipo-riesgo` con `{codigo, denominacion}` → 201; repetir el código → 409; en `nivel-dominio` sin `orden` → 400; sin token → 403; `PATCH` de la denominación se refleja en el `GET`.
3. **Desactivar (US3)**: crear una tabla temporal con FK a `tipo_riesgo` y una fila (o usar la primera tabla consumidora cuando exista), `DELETE` del valor en uso → 409; `PATCH {activo:false}` → 200 y desaparece del `GET` por defecto, pero aparece con `?incluirInactivos=true`; `DELETE` de un valor sin uso → 204.
4. **Reordenar (US4)**: `PATCH {orden: 10}` en `nivel-criticidad` y verificar el orden; asignar un orden ya usado → 409.
5. **UI**: en `http://localhost:5173/admin` recorrer las pestañas, crear, editar, desactivar y borrar un valor; confirmar mensajes de error en español.
6. **Migraciones**: `npm run migration:show` lista las dos migraciones aplicadas; `migration:revert` dos veces deja la base sin las tablas.
