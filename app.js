app.post('/guardar', (req, res) => {
  const datos = req.body;
  console.log('Datos recibidos:', datos);

  // Aquí deberías guardar los datos en tu base de datos
  // Ejemplo ficticio:
  // db.insert(datos)

  res.status(200).send({ mensaje: 'Datos guardados correctamente' });
});
