// routes/medicosRoutes.js
const express = require('express');
const router = express.Router();
const medicosController = require('../controllers/medicosControllers');

// Rutas para los médicos
router.get('/medicos/crear', medicosController.mostrarFormularioCrear);
router.post('/medicos', medicosController.crearMedico);
router.get('/medicos', medicosController.listarMedicos);

// Ruta para eliminar un médico (borrado lógico)
router.post('/medicos/eliminar/:id', medicosController.eliminarMedico);
// Ruta para activar un médico
router.post('/medicos/activar/:id', medicosController.activarMedico);


// Ruta para mostrar el formulario de modificar médico
router.get('/medicos/editar/:id', medicosController.mostrarFormularioModificar);

// Ruta para procesar la modificación del médico
router.post('/medicos/editar/:id', medicosController.modificarMedico);


// Ruta para obtener profesionales según la especialidad
//router.get('/profesionales/:id_especialidad', medicosController.obtenerProfesionalesPorEspecialidad);
router.get('/api/profesionales/:id_especialidad', medicosController.obtenerProfesionalesPorEspecialidad);

//ruta para obtener las especilidades 

router.get('/buscarespecialidad', medicosController.buscarespecialidad);

// Ruta para obtener datos de un profesional por ID y especialidad
router.get('/profesional/:id_profesional/especialidad/:id_especialidad', medicosController.obtenerDatosProfesional);



// Ruta para listar médicos activos e inactivos
router.get('/medicos', medicosController.listarMedicos);

// Ruta para buscar médicos por nombre, apellido o especialidad
router.get('/medicos/buscar', medicosController.buscarMedicos);

// Ruta para mostrar el formulario de agregar especialidad
router.get('/medicos/agregar-especialidad/:id', medicosController.mostrarFormularioAgregarEspecialidad);
// Ruta para eliminar una especialidad de un médico
router.post('/medicos/eliminar-especialidad/:id_profesional/:id_especialidad', medicosController.eliminarEspecialidad);

// Ruta para agregar la especialidad
router.post('/medicos/agregar-especialidad/:id', medicosController.agregarEspecialidad);







module.exports = router;
