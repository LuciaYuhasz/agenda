//adminRoutes.js
const express = require("express");
const authController = require('../controllers/pacientesControllers'); // Controlador de pacientes
const adminController = require('../controllers/adminControllers'); // Controlador de administrador
const { isAuthenticated } = require('../app'); // Middleware de autenticación (ajustar ruta si es necesario)
const router = express.Router();
const upload = require('../multerConfig'); // Configuración de multer


//                              P A C I E N T E S
// Rutas para autenticación de pacientes
// Ruta para renderizar el formulario de registro de pacientes
router.get('/register', authController.renderRegisterForm);

router.post(
    "/register",
    upload.single("foto_dni"), // Middleware de multer
    async (req, res, next) => {
        try {
            console.log("Ruta /register llamada con archivo:", req.file);

            // Verifica si el archivo llega correctamente
            const archivoSubido = req.file;
            if (!archivoSubido) {
                return res.status(400).send("Error: No se subió ningún archivo.");
            }

            // Log de confirmación
            console.log(`Archivo subido correctamente: ${archivoSubido.filename}`);

            // Pasa al controlador de autenticación
            next();
        } catch (error) {
            // Manejo de errores al subir archivo
            return res.status(500).send(`Error al subir el archivo: ${error.message}`);
        }
    },
    authController.register // Llama al controlador register después de verificar el archivo
);
router.get("/login", (req, res) => res.render("ingreso/pacientes/login")); // Vista de login
router.post("/login", (req, res) => authController.login(req, res, 2)); // 2 = Paciente




//router.post("/login", authController.login); // Acción de login

//router.get("/logout", authController.logout); // Logout
router.get('/sucursales/sucursales', (req, res) => {
    res.render('sucursales/sucursales');
});
//                             SECRETARIOS


// Mostrar el formulario de login para secretarios
router.get("/secretarios/login", (req, res) => res.render("ingreso/secretarios/login"));
router.post("/secretarios/login", (req, res) => authController.login(req, res, 3)); // 3 = Secretaria

// Procesar login de secretarios
// Ruta para renderizar el formulario de registro de secretarios
router.get('/secretarios/register', authController.renderSecretaryRegisterForm);

// Mostrar el formulario de registro para secretarios
router.get("/secretarios/register", (req, res) => res.render("ingreso/secretarios/register"));

// Procesar el formulario de registro para secretarios
router.post(
    "/secretarios/register",
    upload.single("foto_dni"),
    async (req, res, next) => {
        try {
            if (!req.file) {
                return res.status(400).send("Error: No se subió ningún archivo.");
            }
            console.log(`Archivo subido correctamente: ${req.file.filename}`);
            next();
        } catch (error) {
            return res.status(500).send(`Error al subir el archivo: ${error.message}`);
        }
    },
    authController.register
);


router.get('/sucursales/sucursalInterior', (req, res) => {
    res.render('sucursales/sucursalInterior');
});

router.get('/sucursales/sucursalCentro', (req, res) => {
    res.render('sucursales/sucursalCentro');
});




//                                       A D M I N I S T R A D O R 
// Rutas para autenticación de administradores
router.get("/administrador/register", (req, res) => res.render("ingreso/administrador/register")); // Vista de registro de administrador
router.post("/administrador/register", adminController.registerAdmin); // Acción de registro de administrador

router.get("/administrador/login", (req, res) => res.render("ingreso/administrador/login")); // Vista de login de administrador
router.post("/administrador/login", adminController.loginAdmin); // Acción de login de administrador

router.get('/administrador', (req, res) => { res.render('ingreso/administrador/administrador'); });


///guarda con esto , fijarme que no me genere problemas 
router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/'); // O redirigí al login que quieras
    });
});
///

// Rutas para agendas y horarios (administrador)


//rutas para formulario de generar una agenda nueva

router.get('/especialidades/:id_profesional', adminController.getEspecialidadesPorProfesional);
router.get('/especialidades-todas/:id_profesional', adminController.getEspecialidadesPorProfesionalSinFiltro);



router.get("/editAgenda", adminController.listarMedicosParaFormulario);

router.get('/buscar-agenda', adminController.buscarAgenda);
//para mostrar la ruta de creaer agenda desde medicos 
router.get('/ingreso/administrador/createAgenda', adminController.formCrearAgenda);


router.get("/create-schedule", adminController.showCreateSchedule);
router.post("/create-schedule", adminController.createScheduleBatch);

router.get('/create-agenda', adminController.formCrearAgenda);
router.post("/create-agenda", adminController.createAgenda);

router.post("/create-schedule-batch", adminController.createScheduleBatch);


////BLOQUEO DE HORARIOS 

// Ruta para mostrar la página de bloqueo de horarios
router.get("/block-schedule", (req, res) => {
    res.render("ingreso/administrador/block-schedule", { id_agenda: req.query.id_agenda });
});

// Ruta para guardar un nuevo bloqueo en la base de datos
router.post("/create-block", adminController.createBlock);
router.get("/administrador/agenda", adminController.getAgendasWithBlocks);




module.exports = router;





