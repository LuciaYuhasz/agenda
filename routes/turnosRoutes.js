// routes/turnosRoutes.js
const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnosControllers');

// Mostrar el formulario para crear un turno
router.get('/crear', turnosController.mostrarFormularioCrear);

//router.get('/horarios/:id_profesional/:id_especialidad/:offset', turnosController.obtenerHorarios);

router.get('/obtenerHorarios/:id_profesional/:id_especialidad', turnosController.obtenerHorarios);

// Crear un nuevo turno
router.post('/crear', turnosController.crearTurno);

// Nueva ruta para mostrar la agenda de un profesional y especialidad específica
router.get('/agenda/:id_profesional/:id_especialidad', turnosController.mostrarAgenda);

module.exports = router;
