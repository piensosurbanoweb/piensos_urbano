// OBSOLETO — ya no se usa.
//
// El backend completo vive ahora en el server.js de la raíz del proyecto,
// que usa el soporte "zero-config" de Vercel para Express (Vercel detecta
// automáticamente el archivo que hace `require('express')` y exporta la
// app, sin necesidad de una carpeta /api ni de vercel.json).
//
// Se deja este archivo vacío (en vez de borrarlo) para no duplicar una
// segunda conexión a la base de datos como función serverless aparte.
// Puedes borrar este archivo y la carpeta api/ cuando quieras.
module.exports = (req, res) => {
  res.status(410).send('Obsoleto: usa las rutas normales, servidas ahora desde server.js en la raíz.');
};
