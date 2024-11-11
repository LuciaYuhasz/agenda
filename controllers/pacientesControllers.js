// controllers/pacientesController.js

const pacientesModel = require('../models/paciente'); // Importa el modelo de pacientes
const conn = require('../db'); // Conexión a la base de datos

// Muestra el formulario para crear un nuevo paciente
exports.mostrarFormularioCrear = (req, res) => {
    res.render("pacientes/crear");
};

// Crea un nuevo paciente usando el modelo
exports.crearPaciente = async (req, res) => {
    const { nombre, apellido, dni, obra_social, telefono, email } = req.body;

    try {
        await pacientesModel.crearPaciente(nombre, apellido, dni, obra_social, telefono, email);
        res.redirect('/pacientes?mensaje=Paciente%20agregado%20correctamente');
    } catch (error) {
        console.error('Error al insertar un nuevo paciente:', error);
        res.status(500).send('Error al insertar el paciente');
    }
};

// Lista todos los pacientes usando el modelo
exports.listarPacientes = async (req, res) => {
    try {
        const pacientes = await pacientesModel.listarPacientes();
        const mensaje = req.query.mensaje;
        res.render('pacientes/listar', { pacientes, mensaje });
    } catch (error) {
        console.error('Error al consultar pacientes:', error);
        res.status(500).send('Error al consultar los pacientes');
    }
};

// Muestra el formulario para modificar un paciente
exports.mostrarFormularioModificar = async (req, res) => {
    const { id } = req.params;

    try {
        const paciente = await pacientesModel.obtenerPacientePorId(id);
        res.render('pacientes/modificar', { paciente });
    } catch (error) {
        console.error('Error al obtener los datos del paciente:', error);
        res.status(500).send('Error al obtener los datos del paciente');
    }
};

// Modificar los datos de un paciente
exports.modificarPaciente = async (req, res) => {
    const { id } = req.params;
    const { nombre, apellido, dni, obra_social, telefono, email } = req.body;

    try {
        await pacientesModel.modificarPaciente(id, nombre, apellido, dni, obra_social, telefono, email);
        res.redirect('/pacientes?mensaje=Paciente%20modificado%20correctamente');
    } catch (error) {
        console.error('Error al modificar los datos del paciente:', error);
        res.status(500).send('Error al modificar el paciente');
    }
};

// Cambiar el estado de un paciente a inactivo
exports.cambiarEstadoInactivo = async (req, res) => {
    const { id } = req.params;

    try {
        await pacientesModel.cambiarEstadoInactivo(id);
        res.redirect('/pacientes?mensaje=Paciente%20cambiado%20a%20inactivo%20correctamente');
    } catch (error) {
        console.error('Error al cambiar el estado del paciente:', error);
        res.status(500).send('Error al cambiar el estado del paciente');
    }
};

// Buscar pacientes
exports.buscarpaciente = async (req, res) => {
    const query = req.query.query;

    try {
        const [pacientes] = await conn.query(`
            SELECT id_paciente, nombre, apellido, dni, obra_social, telefono, email
FROM pacientes
WHERE (nombre LIKE ? OR apellido LIKE ? OR dni LIKE ?)
AND activo = 1;
           
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);

        // Asegúrate de que se devuelvan resultados
        res.json(pacientes || []);
    } catch (error) {
        console.error('Error al buscar pacientes:', error);
        res.status(500).json({ error: error.message }); // Proporcionar más información del error
    }
};








