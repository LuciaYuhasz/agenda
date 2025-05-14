// controllers/pacientesController.js

const pacientesModel = require('../models/paciente'); // Importa el modelo de pacientes
const conn = require('../db'); // Conexión a la base de datos
const bcrypt = require('bcrypt');

//===========================================================//
//  CRUD DE PACIENTES
//===========================================================//

// Mostrar formulario para registrar un nuevo paciente
exports.mostrarFormularioCrear = (req, res) => {
    res.render("pacientes/crear");
};
// Crear un nuevo paciente
exports.crearPaciente = async (req, res) => {
    const { nombre, apellido, dni, obra_social, telefono, email } = req.body;

    try {
        const id = await pacientesModel.crearPaciente(nombre, apellido, dni, obra_social, telefono, email);

        // Devuelve JSON si la solicitud vino por fetch
        res.json({ mensaje: 'Paciente creado con éxito', id_paciente: id });
    } catch (error) {
        console.error('Error al insertar un nuevo paciente:', error);
        res.status(500).json({ error: 'Error al insertar el paciente' }); // <-- respuesta adecuada para AJAX
    }
};

// Listar todos los pacientes 
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
// Mostrar formulario para editar paciente
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
// Buscar pacientes por nombre, apellido o DNI
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

//===========================================================//
// REGISTRO Y LOGIN DE USUARIO PACIENTE 
//===========================================================//

// Registrar nuevo usuario con rol paciente
exports.register = async (req, res) => {
    const { email, password, id_rol, nombre, apellido, dni, obra_social, telefono } = req.body;
    const dniPhoto = req.file ? req.file.filename : null;

    try {
        console.log("Datos recibidos:", req.body);
        console.log("Archivo recibido:", req.file);

        if (!email || !password || !id_rol || !nombre || !apellido || !dni || !telefono || !dniPhoto) {
            console.log("Datos incompletos");
            return res.status(400).send("Todos los campos son obligatorios.");
        }

        const role = parseInt(id_rol, 10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const userQuery = `
            INSERT INTO usuarios (email, password, id_rol, activo) 
            VALUES (?, ?, ?, 1)
        `;
        const [userResult] = await conn.query(userQuery, [email, hashedPassword, role]);
        console.log("Usuario registrado con ID:", userResult.insertId);

        if (role === 2) {
            const patientQuery = `
                INSERT INTO pacientes (nombre, apellido, dni, obra_social, telefono, email, activo, id_usuario, foto_dni) 
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `;
            const [patientResult] = await conn.query(patientQuery, [
                nombre, apellido, dni, obra_social, telefono, email, userResult.insertId, dniPhoto
            ]);
            console.log("Paciente registrado correctamente:", patientResult);
        }

        res.redirect("/login");
    } catch (error) {
        console.error("Error al registrar usuario o paciente:", error);
        res.status(500).send("Error interno del servidor.");
    }
};
// Login de usuario
exports.login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const [rows] = await conn.query(
            "SELECT * FROM usuarios WHERE email = ? AND activo = 1",
            [email]
        );
        if (rows.length === 0) {
            return res.status(401).send("Usuario o contraseña incorrectos.");
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).send("Usuario o contraseña incorrectos.");
        }

        // Guardar usuario en sesión
        req.session.user = {
            id: user.id_usuario,
            email: user.email,
            id_rol: user.id_rol,
        };

        res.redirect("/sucursales/sucursales");
    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).send("Hubo un error al iniciar sesión.");
    }
};

//===========================================================//
// TURNO - PACIENTE SELECCIONA HORARIO
//===========================================================//

// Mostrar formulario para que el paciente saque turno
exports.mostrarFormularioCrear = async (req, res) => {
    try {
        const [especialidades] = await conn.query('SELECT id_especialidad, nombre FROM especialidades');
        res.render('ingreso/pacientes/sacarTurno', { especialidades });
    } catch (error) {
        console.error('Error al mostrar formulario de creación de turno:', error);
        res.status(500).send('Error al cargar el formulario de creación de turno');
    }
};
// Obtener profesionales por especialidad (Sucursal 1)
exports.obtenerProfesionales = async (req, res) => {
    const { id_especialidad } = req.params;
    try {
        const [profesionales] = await conn.query(
            `SELECT 
                p.id_profesional, 
                p.nombre 
            FROM 
                profesionales p
            JOIN 
                profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            WHERE 
                pe.id_especialidad = ? 
                AND p.activo = 1 
                AND p.id_sucursal = 1`,
            [id_especialidad]
        );

        res.json(profesionales);
    } catch (error) {
        console.error('Error al obtener profesionales:', error);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
};
// Obtener horarios disponibles en una semana
// Obtener horarios disponibles en una semana
exports.obtenerHorarios = async (req, res) => {
    const { idProfesional, idEspecialidad, fechaInicio } = req.params;

    // Calcular el rango de la semana
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaInicioDate);
    fechaFinDate.setDate(fechaInicioDate.getDate() + 6);

    try {
        const [resultados] = await conn.query(
            `SELECT h.id_horarios, h.fecha, h.hora_inicio, h.hora_fin, h.estado, h.disponible
         FROM horarios h
         INNER JOIN agendas a ON h.id_agenda = a.id_agenda
         WHERE a.id_profesional = ? 
           AND a.id_profesional_especialidad = ?
           AND h.estado = 'Libre'
           AND h.disponible = 1
           AND h.fecha BETWEEN ? AND ? 
         ORDER BY h.fecha, h.hora_inicio`,
            [idProfesional, idEspecialidad, fechaInicioDate, fechaFinDate]
        );

        // Agrupación por fecha en formato YYYY-MM-DD
        const horariosAgrupados = resultados.reduce((acc, horario) => {
            const fechaKey = new Date(horario.fecha).toISOString().split('T')[0];
            if (!acc[fechaKey]) {
                acc[fechaKey] = [];
            }
            acc[fechaKey].push(horario);
            return acc;
        }, {});

        res.status(200).json(horariosAgrupados);
    } catch (error) {
        console.error("Error al obtener horarios:", error);
        res.status(500).json({ message: "Error al obtener horarios disponibles" });
    }
};

/*exports.obtenerHorarios = async (req, res) => {
    const { idProfesional, idEspecialidad, fechaInicio } = req.params; // Obtener fechaInicio del frontend

    // Calculamos la fecha de fin dependiendo de la fechaInicio
    const fechaInicioDate = new Date(fechaInicio);
    const fechaFinDate = new Date(fechaInicioDate);
    fechaFinDate.setDate(fechaInicioDate.getDate() + 6); // Fin de la semana, 6 días después

    try {
        const [resultados] = await conn.query(
            `SELECT h.id_horarios, DATE_FORMAT(h.fecha, '%Y-%m-%d') AS fecha, h.fecha, h.hora_inicio, h.hora_fin, h.estado, h.disponible
             FROM horarios h
             INNER JOIN agendas a ON h.id_agenda = a.id_agenda
             WHERE a.id_profesional = ? 
               AND a.id_profesional_especialidad = ?
               AND h.estado = 'Libre'
               AND h.disponible = 1
               AND h.fecha BETWEEN ? AND ? 
             ORDER BY h.fecha, h.hora_inicio`,
            [idProfesional, idEspecialidad, fechaInicioDate, fechaFinDate]  // Pasamos las fechas calculadas
        );

        // Agrupación de horarios por fecha
        const horariosAgrupados = resultados.reduce((acc, horario) => {
            if (!acc[horario.fecha]) {
                acc[horario.fecha] = []; // Inicializa el arreglo si no existe la fecha
            }
            acc[horario.fecha].push(horario); // Agrega el horario al arreglo correspondiente
            return acc;
        }, {});

        // Respuesta JSON con los datos agrupados
        res.status(200).json(horariosAgrupados);
    } catch (error) {
        console.error("Error al obtener horarios:", error);
        res.status(500).json({ message: "Error al obtener horarios disponibles" });
    }
};*/
// Procesar la reserva del turno
exports.reservarTurno = async (req, res) => {
    console.log("Cuerpo recibido en el backend:", req.body);
    //const { id_horario, fecha, horario } = req.body;
    const {
        //id_paciente,
        id_especialidad,
        id_profesional,
        fecha,
        horario,
        id_horario,
        motivo_consulta,
    } = req.body;



    // 🧠 Capturar id_usuario desde sesión
    const id_usuario = req.session.user?.id;

    // 🧠 Buscar el id_paciente correspondiente en la base
    const [pacienteResult] = await conn.query(
        'SELECT id_paciente FROM pacientes WHERE id_usuario = ?',
        [id_usuario]
    );

    if (pacienteResult.length === 0) {
        return res.status(400).json({ error: 'No se encontró un paciente asociado a este usuario.' });
    }

    // ✅ Este es el ID correcto que necesita la tabla `turnos`
    const id_paciente = pacienteResult[0].id_paciente;
    //const id_paciente = req.session.user?.id; // Asegúrate que el paciente esté logueado
    console.log("Datos recibidos en /sacarTurno:");
    console.log("id_horario:", id_horario);
    console.log("fecha:", fecha);
    console.log("horario:", horario);
    console.log("id_paciente (de sesión):", id_paciente);
    console.log("Archivo subido:", req.file); // si estás usando multer para `documento`

    if (!id_paciente || !id_especialidad || !id_profesional || !fecha || !horario) {
        return res.status(400).json({ error: "Todos los campos son obligatorios", missingFields: { id_paciente, id_especialidad, id_profesional, fecha, horario } });
    }

    // Validación de campos obligatorios
    const missingFields = [];
    if (!id_paciente) missingFields.push('id_paciente');
    if (!id_especialidad) missingFields.push('id_especialidad');
    if (!id_profesional) missingFields.push('id_profesional');
    if (!fecha) missingFields.push('fecha');
    if (!horario) missingFields.push('horario');
    //if (!estado) missingFields.push('estado');

    if (missingFields.length > 0) {
        console.log('Error: faltan los siguientes campos:', missingFields);
        return res.status(400).json({ error: 'Todos los campos son obligatorios', missingFields });
    }

    // Validación de formato de fecha y hora
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    const horaRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

    if (!fechaRegex.test(fecha)) {
        console.log('Error: Formato de fecha incorrecto, debe ser YYYY-MM-DD');
        return res.status(400).json({ error: 'Formato de fecha incorrecto, debe ser YYYY-MM-DD' });
    }
    if (!horaRegex.test(horario)) {
        console.log('Error: Formato de hora incorrecto, debe ser HH:MM:SS');
        return res.status(400).json({ error: 'Formato de hora incorrecto, debe ser HH:MM:SS' });
    }
    try {
        const estado = 'confirmado';
        const sobreturno = 0; // <-- Valor fijo (no sobreturno)

        const agendaQuery = `
            SELECT id_agenda
            FROM agendas
            WHERE id_profesional = ? AND id_profesional_especialidad = ?
            LIMIT 1
        `;
        const [agendaResult] = await conn.query(agendaQuery, [id_profesional, id_especialidad]);

        if (agendaResult.length === 0) {
            console.log('No se encontró una agenda para este profesional y especialidad');
            return res.status(404).json({ error: 'No se encontró una agenda asociada a este profesional y especialidad' });
        }

        const id_agenda = agendaResult[0].id_agenda; // Obtener el id_agenda

        // 2. Insertar el nuevo turno, ahora con el id_agenda
        const insertQuery = `
            INSERT INTO turnos (id_paciente, id_especialidad, id_profesional, id_agenda, fecha, hora, estado, motivo_consulta, sobreturno)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [insertResult] = await conn.query(insertQuery, [
            id_paciente,
            id_especialidad,
            id_profesional,
            id_agenda, // Asocias el turno con la agenda
            fecha,
            horario,
            estado,
            motivo_consulta || null,
            sobreturno
        ]);

        console.log('Resultado de inserción del turno:', insertResult);

        // Verificar si `id_horario` existe antes de intentar el `UPDATE`
        if (id_horario) {
            const updateQuery = `
                UPDATE horarios
                SET estado = ?, disponible = 0
                WHERE id_horarios = ?
            `;
            const updateValues = [estado, id_horario];

            const [updateResult] = await conn.query(updateQuery, updateValues);

            if (updateResult.affectedRows > 0) {
                console.log('Horario actualizado correctamente:', updateResult);
            } else {
                console.log('No se encontró el id_horario para actualizar o no se aplicó ningún cambio');
            }
        }
        res.json({ success: true, mensaje: 'Turno reservado exitosamente' });
    } catch (error) {
        console.error("Error al reservar turno:", error);
        res.status(500).send("Error al reservar el turno");
    }
};

/*

exports.crearTurno = async (req, res) => {
    console.log('Controlador crearTurno iniciado');
    let {
        id_paciente,
        id_especialidad,
        id_profesional,
        fecha,
        horario,
        estado,
        motivo_consulta,
        sobreturno,
        id_horario
    } = req.body;

    console.log('Datos recibidos:', req.body);

    // Verifica que sobreturno esté presente y tenga el valor adecuado
    if (sobreturno === undefined) {
        sobreturno = 0; // Si no se marca el checkbox, asumimos que no es un sobreturno
    }

    // Validación de campos obligatorios
    const missingFields = [];
    if (!id_paciente) missingFields.push('id_paciente');
    if (!id_especialidad) missingFields.push('id_especialidad');
    if (!id_profesional) missingFields.push('id_profesional');
    if (!fecha) missingFields.push('fecha');
    if (!horario) missingFields.push('horario');
    if (!estado) missingFields.push('estado');

    if (missingFields.length > 0) {
        console.log('Error: faltan los siguientes campos:', missingFields);
        return res.status(400).json({ error: 'Todos los campos son obligatorios', missingFields });
    }

    // Validación de formato de fecha y hora
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    const horaRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

    if (!fechaRegex.test(fecha)) {
        console.log('Error: Formato de fecha incorrecto, debe ser YYYY-MM-DD');
        return res.status(400).json({ error: 'Formato de fecha incorrecto, debe ser YYYY-MM-DD' });
    }
    if (!horaRegex.test(horario)) {
        console.log('Error: Formato de hora incorrecto, debe ser HH:MM:SS');
        return res.status(400).json({ error: 'Formato de hora incorrecto, debe ser HH:MM:SS' });
    }

    try {
        // 1. Obtener el ID de la agenda
        const agendaQuery = `
            SELECT id_agenda
            FROM agendas
            WHERE id_profesional = ? AND id_profesional_especialidad = ?
            LIMIT 1
        `;
        const [agendaResult] = await conn.query(agendaQuery, [id_profesional, id_especialidad]);

        if (agendaResult.length === 0) {
            console.log('No se encontró una agenda para este profesional y especialidad');
            return res.status(404).json({ error: 'No se encontró una agenda asociada a este profesional y especialidad' });
        }

        const id_agenda = agendaResult[0].id_agenda; // Obtener el id_agenda

        // 2. Insertar el nuevo turno, ahora con el id_agenda
        const insertQuery = `
            INSERT INTO turnos (id_paciente, id_especialidad, id_profesional, id_agenda, fecha, hora, estado, motivo_consulta, sobreturno)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [insertResult] = await conn.query(insertQuery, [
            id_paciente,
            id_especialidad,
            id_profesional,
            id_agenda, // Asocias el turno con la agenda
            fecha,
            horario,
            estado,
            motivo_consulta,
            sobreturno ? 1 : 0
        ]);

        console.log('Resultado de inserción del turno:', insertResult);

        // Verificar si `id_horario` existe antes de intentar el `UPDATE`
        if (id_horario) {
            const updateQuery = `
                UPDATE horarios
                SET estado = ?, disponible = 0
                WHERE id_horarios = ?
            `;
            const updateValues = [estado, id_horario];

            const [updateResult] = await conn.query(updateQuery, updateValues);

            if (updateResult.affectedRows > 0) {
                console.log('Horario actualizado correctamente:', updateResult);
            } else {
                console.log('No se encontró el id_horario para actualizar o no se aplicó ningún cambio');
            }
        }

        console.log('Redirigiendo a la agenda con:', id_profesional, id_especialidad);
        res.redirect(`/agenda/${id_profesional}/${id_especialidad}`);

    } catch (error) {
        console.error('Error al crear el turno:', error);
        res.status(500).json({ error: 'Error al crear el turno' });
    }
};*/




















































//===========================================================//
// FILTROS DE BÚSQUEDA (TURNOS)
//===========================================================//

// Obtener todos los profesionales activos
exports.obtenerProfesionales = async (req, res) => {
    try {
        const [resultados] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.apellido, s.nombre AS sucursal_nombre
            FROM profesionales p
            LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
            WHERE p.activo = 1
        `);

        res.json(resultados); // Devuelve los profesionales como JSON
    } catch (error) {
        console.error('Error al obtener profesionales:', error);
        res.status(500).send('Error al obtener profesionales');
    }
};
// Obtener especialidades de un profesional específico
exports.obtenerEspecialidadesPorProfesional = async (req, res) => {
    const { idProfesional } = req.params; // Obtiene el id del profesional de los parámetros

    try {
        const [especialidades] = await conn.execute(`
            SELECT e.id_especialidad, e.nombre
            FROM especialidades e
            JOIN profesionales_especialidades pe ON e.id_especialidad = pe.id_especialidad
            WHERE pe.id_profesional = ?
        `, [idProfesional]);

        res.json(especialidades); // Devuelve las especialidades como JSON
    } catch (error) {
        console.error('Error al obtener especialidades:', error);
        res.status(500).send('Error al obtener especialidades');
    }
};
