# Panel de bots de Discord

Panel web para conectar varios bots de Discord y crear sus comandos desde un menú visual, sin escribir código.

## Qué puedes crear

| Tipo | Para qué sirve |
| --- | --- |
| 💬 Respuesta de texto | Mensaje simple con variables (`{user}`, `{server}`, `{opt:nombre}`) |
| 🖼️ Embed | Tarjeta con título, color, imagen, miniatura, pie y campos |
| 🎲 Respuesta al azar | Elige al azar entre una lista de respuestas |
| 🔘 Botones interactivos | Hasta 5 botones que responden, envían DM o abren un enlace |
| 🗄️ Almacenamiento | Guardar, leer, sumar, listar o borrar datos por usuario, servidor o globales |
| 📝 Registro | Registra usuarios con los campos que definas |
| 📩 Respuesta al DM | Envía la respuesta por mensaje directo con confirmación en el canal |
| ⚙️ Configuración | Ajustes editables desde Discord, opcionalmente solo para administradores |

Además: varios bots a la vez con comandos propios, encendido/apagado desde el panel, sincronización de comandos con Discord, visor de datos guardados y registro de actividad.

## Puesta en marcha

```bash
npm install
cp .env.example .env      # define DATABASE_URL y APP_SECRET
npx prisma migrate deploy
npm run dev               # http://localhost:3000
```

`APP_SECRET` cifra los tokens de los bots con AES-256-GCM antes de guardarlos en la base de datos. Si lo cambias, tendrás que volver a introducir los tokens.

## Cómo conectar un bot

1. Crea una aplicación en el [portal de desarrolladores de Discord](https://discord.com/developers/applications) y añade un bot.
2. Copia el token del bot e invítalo a tu servidor con los scopes `bot` y `applications.commands`.
3. En el panel pulsa **Conectar bot**, pega el token y (opcional) el ID del servidor.
4. Pulsa **Encender**: los comandos se sincronizan automáticamente. Si añades comandos después, usa **Sincronizar comandos**.

Con un ID de servidor los comandos aparecen al instante; sin él se registran de forma global y Discord puede tardar hasta una hora en propagarlos.

## Notas

- Los bots se ejecutan dentro del proceso de Next.js, así que el panel debe seguir abierto/desplegado para que estén en línea.
- El panel no tiene autenticación: pensado para uso local o detrás de un proxy protegido.
