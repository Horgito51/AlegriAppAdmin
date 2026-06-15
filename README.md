# AlegriApp - Panel administrativo de Emprendimiento

Aplicacion web administrativa hecha con HTML5, CSS3 y JavaScript modular puro. Esta lista para ejecutarse como sitio estatico en GitHub Pages.

## Modulos implementados por Jorge

- Profesores: listar, crear, editar, eliminar y buscar.
- Cursos: listar, crear, editar, eliminar y buscar.
- Materias: listar, crear, editar, eliminar y buscar.
- Asignaciones: asociar profesores con uno o varios cursos y una o varias materias, evitando duplicados.

## Modulos preparados para el equipo

- Representantes.
- Estudiantes.
- Periodos academicos y ajustes LOEI.
- Configuracion Telegram.
- Encuesta docente al llegar a 5 reportes enviados.

## Fuente de datos encontrada

El proyecto Android `AlegriAppProyecto` usa:

- Room como base local offline.
- Retrofit/OkHttp para consumir Supabase por PostgREST.
- `SUPABASE_URL` y `SUPABASE_KEY` desde `local.properties`.
- Tablas remotas como `cursos`, `materias`, `usuarios`, `docente_curso`, `periodos_academicos`, `configuracion_telegram`, `estudiantes` e `incidentes`.

Room no es accesible desde GitHub Pages, asi que el panel se conecta directamente a Supabase por PostgREST usando la publishable key del proyecto. La capa `js/api/client.js` mantiene el modo demo como respaldo, pero `js/config.js` queda configurado en modo `supabase`.

## Configuracion

El archivo activo es `js/config.js`. Usa la URL real de Supabase y una publishable key:

```js
dataMode: "supabase"
```

Las tablas usadas por el panel son las mismas del proyecto Kotlin:

- Profesores: `usuarios` con rol docente y cedula en `personal_autorizado`.
- Cursos: `cursos`, `niveles_academicos`, `periodos_academicos`.
- Materias: `materias`.
- Asignaciones: `docente_curso`.

## Probar localmente

Como el panel usa modulos ES de JavaScript, es recomendable servir la carpeta con un servidor local:

```powershell
python -m http.server 5500
```

Luego abrir `http://localhost:5500`.

## Publicar en GitHub Pages

1. Subir el contenido de la carpeta `panel` a un repositorio.
2. En GitHub, ir a Settings -> Pages.
3. Seleccionar la rama y carpeta raiz del sitio.
4. Verificar que `index.html`, `css/` y `js/` esten publicados.

## Notas de seguridad

- No copiar tokens privados ni llaves `service_role` de Supabase al frontend.
- GitHub Pages no puede conectarse directamente a Room porque Room vive dentro de Android.
- Si se usa Supabase real, revisar RLS antes de permitir INSERT, UPDATE o DELETE desde una app publica.
