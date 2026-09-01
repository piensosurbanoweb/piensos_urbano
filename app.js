app.post('/guardar', (req, res) => {
  const datos = req.body;
  console.log('Datos recibidos:', datos);

  res.status(200).send({ mensaje: 'Datos guardados correctamente' });
});
