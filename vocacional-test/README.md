# Test de orientación vocacional

Primera versión digital del cuadernillo 02 y la hoja de respuestas 03. La aplicación permite completar y guardar los ítems 1–88 y las tres preguntas abiertas. El nombre es obligatorio; el código de participante es opcional y, si se omite, se genera un código interno. No calcula resultados, perfiles, fortalezas ni recomendaciones.

## Instalación y ejecución local

```bash
npm install
npm run dev
```

Para revisar tipos y construir producción:

```bash
npm run check
npm run build
npm test
```

## D1 y Cloudflare

1. Crea o identifica la base D1 del proyecto.
2. Reemplaza `database_id` en `wrangler.toml`.
3. Ejecuta la migración local con `npx wrangler d1 migrations apply orientacion-vocacional --local`.
4. Para producción: `npx wrangler d1 migrations apply orientacion-vocacional --remote`.
5. En un proyecto Pages, configura el secreto con `npx wrangler pages secret put ADMIN_EXPORT_TOKEN --project-name=<nombre-del-proyecto>`.

El binding esperado es `DB`. El endpoint público `/api/submit` no recibe credenciales: solo valida y escribe mediante el binding del Worker. El endpoint administrativo `/api/admin/export` exige `Authorization: Bearer <ADMIN_EXPORT_TOKEN>` y devuelve CSV; no debe publicarse sin configurar ese secreto.

## Despliegue

```bash
npm run build
npx wrangler pages deploy dist
```

También se puede conectar el repositorio a Cloudflare Pages usando el comando de build `npm run build`, el directorio `dist` y el binding D1 `DB`.

## Pruebas y alcance verificado

La suite `tests/validation.test.ts` cubre envío completo, incompletos, valores inválidos, letras fuera de rango y más de tres temas. La API responde 409 ante códigos/identificadores duplicados y el esquema D1 agrega restricciones `UNIQUE`.

La prueba de guardado D1 requiere ejecutar Wrangler con el binding local configurado; no se ejecuta contra la base remota del usuario desde este repositorio. El despliegue real en Cloudflare queda pendiente hasta conectar la cuenta, el `database_id` y el secreto.

## Limitaciones actuales

- No hay resultados, perfiles RIASEC, fortalezas, recomendaciones, ficha 05 ni conexión con Excel.
- No hay autenticación de estudiantes; el código de participante es opcional y el sistema genera uno interno si no se proporciona.
- La exportación está protegida por token Bearer, pero debe restringirse además por la política de acceso del proyecto antes de producción.
- La app no modifica los PDF ni el Excel originales.
