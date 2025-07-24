const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesControllers');
//const bcrypt = require('bcrypt');
// ----------------------------------------
// RUTAS DE PACIENTES DESDE PERSPECTICA DEL SECRETARIO

// Mostrar formulario para registrar un nuevo paciente
router.get('/pacientes/create', pacientesController.mostrarFormularioCreate);

// Procesar el registro de un nuevo paciente
router.post('/pacientes', pacientesController.crearPaciente);

// Listar todos los pacientes( activos e inactivos)
router.get('/pacientes', pacientesController.listarPacientes);

// Mostrar formulario para editar datos de un paciente existente
router.get('/pacientes/editar/:id', pacientesController.mostrarFormularioModificar);

// Guardar cambios al editar un paciente
router.post('/pacientes/editar/:id', pacientesController.modificarPaciente);

// Marcar paciente como inactivo (baja lógica)
router.post('/pacientes/eliminar/:id', pacientesController.cambiarEstadoInactivo);

// Buscar pacientes por nombre, apellido o DNI (para autocompletado)
router.get('/buscarpaciente', pacientesController.buscarpaciente);


// ----------------------------------------
// VISTAS ESTÁTICAS DE SUCURSALES
// ----------------------------------------

// Renderiza la vista para la sucursal del centro
router.get('/sucursalCentro', (req, res) => {
    res.render('sucursales/sucursalCentro');
});

// Renderiza la vista para la sucursal del interior
router.get('/sucursalInterior', (req, res) => {
    res.render('sucursales/sucursalInterior'); // Renderiza la vista `sucursalInterior.pug`
});


// ----------------------------------------
// TURNOS DESDE PERSPECTIVA DE PACIENTES

// Mostrar formulario para que un paciente saque turno
router.get('/ingreso/pacientes/sacarTurno', pacientesController.mostrarFormularioCrear);

// Obtener profesionales según especialidad (usado para autocompletar)
router.get('/api/profesionales/:id_especialidad', pacientesController.obtenerProfesionales);

// Obtener especialidades que atiende un profesional
router.get('/api/especialidades/:idProfesional', pacientesController.obtenerEspecialidadesPorProfesional);

// Obtener horarios disponibles de un profesional por especialidad y fecha
router.get('/obtenerHorarios/:idProfesional/:idEspecialidad/:fechaInicio', pacientesController.obtenerHorarios);

// (Opcional) Obtener todos los profesionales (sin filtro)
router.get('/api/profesionales', pacientesController.obtenerProfesionales);

// POST para la ruta /sacarTurno del paciente
router.post('/sacarTurno', pacientesController.reservarTurno);

//obtener datos  de confirmacion de turno para mostrarse en el alert 
router.get('/sacarTurno', (req, res) => {
    const mensajeJS = req.query.exito === '1' ? req.session.mensajeExito : null;

    res.render('ingreso/pacientes/sacarTurno', {
        mensajeJS,
        nombreProfesional: req.session.nombreProfesional,
        nombreEspecialidad: req.session.nombreEspecialidad,
        fechaTurno: req.session.fechaTurno,
        horarioTurno: req.session.horarioTurno,
    });
    req.session.mensajeExito = null;
    req.session.nombreProfesional = null;
    req.session.nombreEspecialidad = null;
    req.session.fechaTurno = null;
    req.session.horarioTurno = null;

});


module.exports = router;