const conn = require('../db'); // Conexión a la base de datos

// Función para insertar un nuevo paciente
exports.crearPaciente = async (nombre, apellido, dni, obra_social, telefono, email) => {
    const sql = "INSERT INTO pacientes (nombre, apellido, dni, obra_social, telefono, email) VALUES (?, ?, ?, ?, ?, ?)";
    const values = [nombre, apellido, dni, obra_social, telefono, email];

    const [result] = await conn.query(sql, values);
    return result;
};

// Función para listar todos los pacientes
exports.listarPacientes = async () => {
    const sql = 'SELECT * FROM pacientes';
    const [result] = await conn.query(sql);
    return result;
};

// Función para actualizar un paciente
exports.modificarPaciente = async (id, nombre, apellido, dni, obra_social, telefono, email) => {
    const sql = `UPDATE pacientes 
                 SET nombre = ?, apellido = ?, dni = ?, obra_social = ?, telefono = ?, email = ? 
                 WHERE id_paciente = ?`;
    const values = [nombre, apellido, dni, obra_social, telefono, email, id];

    const [result] = await conn.query(sql, values);
    return result;
};

// Función para cambiar el estado del paciente a inactivo
exports.cambiarEstadoInactivo = async (id) => {
    const sql = "UPDATE pacientes SET activo = IF(activo = 1, 0, 1) WHERE id_paciente = ?";
    const [result] = await conn.query(sql, [id]);
    return result;
};

// Obtener un paciente por ID
exports.obtenerPacientePorId = async (id) => {
    const query = 'SELECT * FROM pacientes WHERE id_paciente = ?';
    const [results] = await conn.query(query, [id]);
    return results.length > 0 ? results[0] : null; // Retorna el primer resultado o null si no se encuentra
};
