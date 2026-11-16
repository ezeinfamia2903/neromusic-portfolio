# NeroMusic

NeroMusic es un servicio privado de música multi-cliente para salas de IMVU, con reproducción independiente por sala, administración e IA conversacional opcional bilingüe. [![CI](https://github.com/YOUR_GITHUB_HANDLE/neromusic-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_GITHUB_HANDLE/neromusic-showcase/actions/workflows/ci.yml) · [Video de demostración](<COMPLETAR: URL del video>)

## Qué hace

- Recibe comandos del chat para buscar y reproducir pistas solicitadas.
- Mantiene colas y estado del reproductor independientes para cada sala configurada.
- Transmite audio a la radio de la sala mediante un servicio HTTP de audio.
- Ofrece un panel separado para administrar clientes y ajustes de salas.
- Proporciona conversación opcional en español e inglés, configurable por sala.

## Arquitectura de un vistazo

```mermaid
flowchart LR
    U[Participantes de la sala] --> L[Login con navegador headless]
    L --> R[Conexión en tiempo real]
    R --> C[Procesamiento de comandos]
    C --> Q[Cola por sala]
    Q --> A[Streaming de audio]
    A --> S[Radio de la sala]

    P[Panel de administración] --> D[(SQLite)]
    D --> M[Gestor del ciclo de vida]
    M --> R
    C -. opcional .-> I[Proveedores de IA]
    I -. respuesta .-> R
    D --> I
```

## Funcionalidades principales

- Gestión multi-sala y multi-cliente.
- Panel separado para agregar, activar, desactivar, reiniciar y eliminar clientes, ajustar períodos del servicio y elegir el idioma de la sala.
- Colas de música por sala, controles de reproducción y radio por streaming.
- Conversación opcional con IA en español e inglés, configuración por sala y hasta tres personalidades configurables.
- Una misma base de código Node.js para Windows y Linux, con resolución de rutas según las herramientas externas disponibles.
- Logs estructurados, verificación de salud del servicio de audio y métricas locales de streaming.

## Aspectos destacados de ingeniería

- Aplicación modular CommonJS con aproximadamente 34 archivos JavaScript de aplicación.
- Autenticación híbrida: un navegador headless obtiene una sesión válida; luego la aplicación opera mediante WebSocket y REST, con reconexión automática.
- Pipeline de audio: la entrada de `yt-dlp` se convierte a MP3 mediante `ffmpeg` y se sirve por HTTP.
- Una reconciliación periódica compara los clientes deseados en SQLite con las salas activas y gestiona altas, bajas, reintentos y vencimientos.
- La IA es opcional y se puede desactivar por separado; los comandos de música no dependen de proveedores de IA.
- Logs estructurados por evento y una verificación de salud permiten que el proceso principal detecte y reinicie un servicio de audio no saludable.

## En producción

- Entornos de ejecución: VPS Ubuntu y Windows, según el responsable del proyecto.
- Opciones de despliegue documentadas para Ubuntu: `systemd` con Caddy o Cloudflare Tunnel para publicar el acceso HTTPS al audio.
- Salas, clientes y usuarios simultáneos: [COMPLETAR: cantidades de producción verificadas].
- Fecha de inicio en producción: [COMPLETAR: fecha].
- Disponibilidad o uptime medido: [COMPLETAR: período y fuente de la medición].

## Qué contiene y qué no contiene este repositorio

NeroMusic es un producto comercial privado. Aquí no se publica el código de la aplicación, la configuración de despliegue, los datos operativos ni la información de clientes. Este showcase contiene documentación de arquitectura e ingeniería y módulos pequeños y genéricos, escritos desde cero, que demuestran algunos patrones de programación. La licencia MIT de `samples/` no se aplica al producto privado ni a su código fuente.

## Cómo lo desarrollé

Desarrollé NeroMusic con asistencia de IA bajo mi dirección. Concebí el producto, investigué opciones de implementación, definí y aprobé las decisiones de diseño, revisé y corregí la implementación, y me ocupé de las pruebas funcionales, el despliegue y la operación. El producto se validó mediante pruebas funcionales manuales en salas reales. Las pruebas automatizadas de este repositorio cubren únicamente los módulos de ejemplo independientes, no NeroMusic.

## Stack tecnológico

| Área                        | Tecnología                                                         |
| --------------------------- | ------------------------------------------------------------------ |
| Runtime                     | Node.js, CommonJS                                                  |
| Persistencia                | SQLite con `better-sqlite3`                                        |
| Comunicación en tiempo real | WebSocket; REST para operaciones complementarias                   |
| Preparación de sesión       | Puppeteer con navegador headless, utilizado para el login          |
| Audio                       | `yt-dlp`, `ffmpeg`, streaming HTTP                                 |
| IA                          | Cascada opcional de proveedores con configuración por sala         |
| Operación                   | Ubuntu, `systemd`, Caddy o Cloudflare Tunnel; soporte para Windows |
| Samples del showcase        | Módulos nativos de Node.js, `node:test` y `better-sqlite3`         |

## Contacto

- GitHub: [COMPLETAR: URL del perfil]
- LinkedIn: [COMPLETAR: URL del perfil]
- Email: [COMPLETAR: correo de contacto]
