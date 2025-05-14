//adminRoutes.js
const express = require("express");
const authController = require('../controllers/pacientesControllers'); // Controlador de pacientes
const adminController = require('../controllers/adminControllers'); // Controlador de administrador
const { isAuthenticated } = require('../app'); // Middleware de autenticación (ajustar ruta si es necesario)
const router = express.Router();
const upload = require('../multerConfig'); // Configuración de multer


//                              P A C I E N T E S
// Rutas para autenticación de pacientes
router.get("/register", (req, res) => res.render("ingreso/pacientes/register")); // Vista de registro
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
router.post("/login", authController.login); // Acción de login

//router.get("/logout", authController.logout); // Logout
router.get('/sucursales/sucursales', (req, res) => {
    res.render('sucursales/sucursales');
});

//                                       A D M I N I S T R A D O R 
// Rutas para autenticación de administradores
router.get("/administrador/register", (req, res) => res.render("ingreso/administrador/register")); // Vista de registro de administrador
router.post("/administrador/register", adminController.registerAdmin); // Acción de registro de administrador

router.get("/administrador/login", (req, res) => res.render("ingreso/administrador/login")); // Vista de login de administrador
router.post("/administrador/login", adminController.loginAdmin); // Acción de login de administrador

router.get('/administrador', (req, res) => { res.render('ingreso/administrador/administrador'); });

// Rutas para agendas y horarios (administrador)

router.get("/create-agenda", adminController.listarMedicosParacrear); // Cargar médicos y renderizar vista
router.get('/especialidades/:id_profesional', adminController.getEspecialidadesPorProfesional);



//router.get('/editAgenda', (req, res) => { res.render('ingreso/administrador/editAgenda'); });
router.get("/editAgenda", adminController.listarMedicosParaFormulario);

router.get('/buscar-agenda', adminController.buscarAgenda);
router.get('/agenda', (req, res) => { res.render('ingreso/administrador/agenda'); });

//router.get("/editAgenda", adminController.listarMedicosParaFormulario); // Cargar médicos y renderizar vista
//router.get('/especialidades/:id_profesional', adminController.getEspecialidadesPorProfesional);


// Acción para crear una agenda
router.get("/create-agenda", (req, res) => {
    res.render("ingreso/administrador/createAgenda"); // Asegúrate de tener la vista creada
});

router.get('/create-agenda', adminController.listarMedicosParacrear);


router.get("/create-schedule", adminController.showCreateSchedule);
router.post("/create-schedule", adminController.createScheduleBatch);
router.get("/view-schedule", adminController.viewSchedule);


router.post("/create-agenda", adminController.createAgenda);

//router.post("/create-agenda", adminController.createAgenda);

// Mostrar formulario para crear horario

//router.post("/create-schedule", adminController.createSchedule);
router.post("/create-schedule-batch", adminController.createScheduleBatch);

// Mostrar formulario para crear horario con el ID de la agenda
//router.get("/create-schedule", adminController.showCreateSchedule);



//router.get("/visualizar-agendas", adminController.viewAgendas);







module.exports = router;





