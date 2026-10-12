# Contrato HTTP: referencia

Prefijo global `/api`. Documentado con `@nestjs/swagger` en `/api/docs`; el cliente del frontend
se regenera con `npm run api:tipos`. Errores en el formato estándar de NestJS
(`statusCode`, `message`, `error`), con mensajes en español.

`:dominio` es uno de los slugs de [data-model.md](../data-model.md).

| Método | Ruta | Acceso | Descripción |
| --- | --- | --- | --- |
| GET | `/api/referencia` | lectura | Lista los diez dominios (`dominio`, `denominacion`, `ordinal`). |
| GET | `/api/referencia/:dominio` | lectura | Valores del dominio; solo activos salvo `?incluirInactivos=true`. Ordenados por `orden` o por denominación. |
| POST | `/api/referencia/:dominio` | escritura | Crea un valor. |
| PATCH | `/api/referencia/:dominio/:id` | escritura | Modifica `codigo`, `denominacion`, `orden`, `activo` (todos opcionales). |
| DELETE | `/api/referencia/:dominio/:id` | escritura | Borra un valor sin uso. |

**Acceso**: escritura exige el encabezado `x-admin-token` (provisorio, ver plan); se reemplaza por
el rol de administrador al implementar RF22.

## Cuerpos

- `ValorReferenciaDto` (respuesta): `id`, `codigo`, `denominacion`, `activo`, `orden?`, `enUso` (booleano, solo en el listado con `incluirInactivos`/administración).
- `CrearValorDto`: `codigo`, `denominacion`, `orden?` (obligatorio si el dominio es ordinal, prohibido si no).
- `ActualizarValorDto`: `codigo?`, `denominacion?`, `orden?`, `activo?`.
- Respuesta de PATCH: `ValorReferenciaDto` + `advertencia?` (texto, cuando se desactiva el último valor activo).

## Códigos de respuesta

| Código | Caso |
| --- | --- |
| 200/201/204 | Éxito (PATCH/GET 200, POST 201, DELETE 204) |
| 400 | Campos inválidos, orden faltante en ordinal u orden en no ordinal |
| 403 | Falta o es inválido el token de escritura |
| 404 | Dominio o valor inexistente |
| 409 | Código u orden duplicado; borrado o cambio de código de un valor en uso |
