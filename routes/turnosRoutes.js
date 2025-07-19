// routes/turnosRoutes.js
const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnosControllers');

// Mostrar el formulario para crear un turno
router.get('/crear', turnosController.mostrarFormularioCrear);

router.get('/obtenerHorarios/:id_profesional/:id_especialidad/:fecha_inicio', turnosController.obtenerHorarios);

// Crear un nuevo turno
router.post('/crear', turnosController.crearTurno);

// Nueva ruta para mostrar la agenda de un profesional y especialidad específica
router.get('/agenda/:id_profesional/:id_especialidad', turnosController.mostrarAgenda);


//Rutas para la trasnferencia de turnos 
router.get("/transfer-turno", turnosController.transferTurno);
router.post("/confirm-transfer", turnosController.confirmTransfer);

//Ruta para lista de espera 
router.post('/api/lista-espera', turnosController.agregarListaEspera);



// Ruta para ver la lista de espera (GET)
router.get('/lista-espera', turnosController.verListaEspera);


//probando para el modal
router.get('/api/agenda/:id_profesional/:id_especialidad', turnosController.obtenerAgendaJson);





module.exports = router;
