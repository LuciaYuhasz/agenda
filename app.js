// app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();

// Configurar CORS para permitir solicitudes desde tu dominio en producción
app.use(cors({
    origin: 'https://agend-4.onrender.com' // Aquí indicas tu dominio de producción
}));

// Importar las rutas de médicos
const medicosRoutes = require('./routes/medicosRoutes');
const pacientesRoutes = require('./routes/pacientesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');

app.set('view engine', 'pug');
app.set('views', 'views');
app.use(express.static('public'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use('/static', express.static('node_modules'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('sucursalCentro');
});

/*app.get('/', (req, res) => {
    res.render('La aplicación está funcionando');
});*/



// Usar las rutas de médicos
app.use('/', medicosRoutes);
app.use('/', pacientesRoutes);
app.use('/', turnosRoutes);






console.log(`Puerto asignado: ${process.env.PORT}`);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`App en puerto ${PORT}`);
});



/*const PORT = process.env.PORT || 3000;  // Si no encuentra PORT, usa el 3000 (para desarrollo local)
app.listen(PORT, () => {
    console.log(`App en puerto ${PORT}`);
});*/

/*


app.listen(3000, () => {
    console.log("App en puerto 3000");
});*/
