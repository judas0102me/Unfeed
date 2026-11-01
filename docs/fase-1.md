# Fase 1 — De la prueba técnica a la app real

Objetivo: que un usuario pueda instalar Unfeed, iniciar sesión en TikTok y limpiar sus reposts, likes y favoritos de forma automática, con progreso visible y sin riesgo de agregar acciones por error. Sin pagos todavía (fase 2), pero con el contador del plan gratis listo.

## Decisiones

| Tema | Decisión |
|---|---|
| Navegación | Expo Router, rutas en `src/app/` |
| Idiomas | Español e inglés según el teléfono: `expo-localization` + `i18next` / `react-i18next`, inglés por defecto |
| Tema | Claro/oscuro automático: `useColorScheme()` + `userInterfaceStyle: "automatic"` |
| Plataformas de prueba | iOS (simulador) y Android (emulador `Medium_Phone`) |
| Almacenamiento local | `expo-sqlite/kv-store` para progreso, contador diario y preferencias |
| Selectores | Valores por defecto en la app + JSON remoto con caché y versión |

## Arquitectura

```
src/
  app/                      → pantallas (Expo Router)
    _layout.tsx
    index.tsx               → decide onboarding / inicio
    onboarding.tsx
    login.tsx               → WebView a pantalla completa + guía de inicio de sesión
    clean.tsx               → elegir categorías
    progress.tsx            → limpieza en curso (WebView visible + contador + pausa)
    summary.tsx
    settings.tsx
    debug.tsx               → panel de la fase 0, solo en desarrollo
  core/
    bridge.ts               → mensajes página ↔ app (ya existe)
    engine/                 → cola, ritmo, pausa/reanudar, detección de bloqueo
    limits/                 → contador diario (150 gratis)
    config/                 → selectores remotos con caché
  platforms/
    types.ts                → interfaz PlatformAdapter
    tiktok/                 → adaptador, selectores y scripts (ya existe)
  i18n/                     → es.json, en.json, configuración
  theme/                    → colores claro/oscuro, tipografía
  components/
```

### Interfaz de plataforma

Cada red social implementa lo mismo, para que en la v2 Instagram y Facebook sean una carpeta nueva:

- `loginUrl`, `detectSession()`
- `categories`: reposts, likes, favoritos
- `openCategory(cat)` (entra al perfil si hace falta), `listItems()`, `loadMore()`
- `removeItem(cat, index)` → `removed | inactive | not_found | blocked | failed`
- `detectBlock()`: captcha, límite de TikTok o sesión expirada

Los scripts se ejecutan con `ScriptRunner` (`src/core/runner.ts`): cada script lleva un id y su respuesta resuelve una promesa, así el adaptador expone métodos `async` normales.

### Motor de limpieza

- Recorre los elementos de la pestaña uno a uno; los que ya están inactivos se saltan (TikTok guarda la lista en caché).
- Ritmo: una acción cada 1,5–4 s con variación aleatoria y una pausa larga cada 20–30 acciones.
- Se detiene si detecta bloqueo, si se pierde la sesión o si se alcanza el límite diario.
- Pausa y reanudación; el progreso se guarda para continuar después.
- Mantiene la pantalla encendida (`expo-keep-awake`); iOS no permite seguir en segundo plano.
- Desplaza la pestaña para cargar más elementos cuando se acaban los visibles.

### Favoritos: TikTok no siempre guarda el cambio

En la prueba real (1 nov 2026) la web de TikTok quita el favorito con `POST /api/item/collect/?action=2` (poner es `action=1`; `action=0` da error 10201). TikTok responde `status_code: 0`, pero el video sigue en la lista de Favoritos y en el JSON de su página (`itemStruct.collected: true`), también cuando se pulsa el botón de la propia web. Con los Me gusta, ese mismo JSON sí cambia al instante.

Por eso, tras quitar un favorito, el adaptador lee `__UNIVERSAL_DATA_FOR_REHYDRATION__` de la página del video. Si sigue en `collected: true`, cuenta un fallo en vez de una eliminación y no gasta cupo. Falta confirmar en la app móvil de TikTok si los favoritos quitados se mantienen.

## Pantallas

1. **Onboarding**: cómo funciona, aviso de riesgo (límites o bloqueos de TikTok), "no guardamos tu contraseña", y qué hacer si entras a TikTok con Google.
2. **Inicio de sesión**: WebView a pantalla completa con TikTok; opciones QR, correo/contraseña o SMS.
3. **Limpiar**: tu cuenta, casillas por categoría, botón "Empezar".
4. **Progreso**: contador por categoría, barra, pausa/detener, el WebView visible en pequeño.
5. **Resumen**: cuánto se eliminó y cuánto queda del límite diario.
6. **Ajustes**: velocidad (normal / cuidadosa), idioma, cerrar sesión, privacidad.

## Pasos

1. Expo Router, tema e i18n; mover el panel de la fase 0 a `debug.tsx`.
2. Interfaz `PlatformAdapter` y adaptador de TikTok a partir de los scripts actuales.
3. Motor de limpieza con pruebas unitarias (jest-expo) usando un adaptador simulado.
4. Contador diario y configuración remota de selectores.
5. Pantallas.
6. Pruebas de punta a punta en iOS y Android con la cuenta de prueba.

## Fuera de alcance (fase 2)

Pagos con RevenueCat y paywall, Premium, iconos y fichas de las tiendas, política de privacidad, dominio.
