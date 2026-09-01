// Punto de entrada SOLO para desarrollo local (`npm start` / `npm run dev`).
// En Vercel, el archivo que se ejecuta es api/index.js (función serverless);
// este archivo no se usa en producción.

const app = require('./api/index.js');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
