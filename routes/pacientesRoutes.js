const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientesControllers');

router.get('/pacientes/create', pacientesController.mostrarFormularioCrear);
router.post('/pacientes', pacientesController.crearPaciente);
router.get('/pacientes', pacientesController.listarPacientes);

// Ruta para mostrar el formulario de modificación de un paciente
router.get('/pacientes/editar/:id', pacientesController.mostrarFormularioModificar);

// Ruta para modificar los datos de un paciente
router.post('/pacientes/editar/:id', pacientesController.modificarPaciente);

// Ruta para cambiar el estado de un paciente a inactivo
router.post('/pacientes/eliminar/:id', pacientesController.cambiarEstadoInactivo);

router.get('/buscarpaciente', pacientesController.buscarpaciente);


module.exports = router;