// app.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const app = express();
const bcrypt = require('bcrypt');
const session = require('express-session');

// Configuración de sesiones
app.use(session({
    secret: 'mi_secreto', // Cambiar por un valor seguro
    resave: false,
    saveUninitialized: true,
}));

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    }
    res.redirect("/login");
};

module.exports = { isAuthenticated };



// Importar las rutas de médicos
const medicosRoutes = require('./routes/medicosRoutes');
const pacientesRoutes = require('./routes/pacientesRoutes');
const turnosRoutes = require('./routes/turnosRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.set('view engine', 'pug');
app.set('views', 'views');
app.use(express.static('public'));
app.use('/node_modules', express.static(path.join(__dirname, 'node_modules')));
app.use('/static', express.static('node_modules'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.render('ingreso/index');
});

/*app.use((req, res, next) => {
    res.locals.usuario = req.session.usuario || null;
    next();
});*/
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});




// Usar las rutas de médicos
app.use('/', medicosRoutes);
app.use('/', pacientesRoutes);
app.use('/', turnosRoutes);
app.use('/', adminRoutes);



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
