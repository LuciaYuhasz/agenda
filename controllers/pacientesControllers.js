// controllers/pacientesController.js

const pacientesModel = require('../models/paciente'); // Importa el modelo de pacientes
const conn = require('../db'); // Conexión a la base de datos
const bcrypt = require('bcrypt');

//===========================================================//
//  CRUD DE PACIENTES
//===========================================================//

// Mostrar formulario para registrar un nuevo paciente

exports.mostrarFormularioCreate = async (req, res) => {
    const [obrasSociales] = await conn.query("SELECT id_obra_social, nombre FROM obras_sociales ORDER BY nombre ASC");
    res.render("pacientes/create", { obrasSociales });
};
// Crear un nuevo paciente
// Crear un nuevo paciente
exports.crearPaciente = async (req, res) => {
    const { nombre, apellido, dni, id_obra_social, nuevo_obra_social, telefono, email } = req.body;

    let obraSocialId = id_obra_social; // Inicializamos con el ID de la obra social

    try {
        // Si el usuario eligió "Otra" y quiere agregar una nueva obra social
        if (id_obra_social === "nueva" && nuevo_obra_social) {
            // Convertir a minúsculas para evitar duplicaciones sin importar mayúsculas/minúsculas
            const nombreObraSocial = nuevo_obra_social.toLowerCase();

            // Verificar si ya existe en la base de datos
            const [existeObra] = await conn.query(
                "SELECT id_obra_social FROM obras_sociales WHERE LOWER(nombre) = ?",
                [nombreObraSocial]
            );

            if (existeObra.length > 0) {
                // Si la obra social ya existe, usamos su ID
                obraSocialId = existeObra[0].id_obra_social;
            } else {
                // Si no existe, creamos una nueva obra social y usamos su ID
                const [nuevaObra] = await conn.query(
                    "INSERT INTO obras_sociales (nombre) VALUES (?)",
                    [nombreObraSocial]
                );
                obraSocialId = nuevaObra.insertId; // Obtén el ID de la nueva obra social
            }
        }

        // Crear el paciente con la obra social asociada
        const [result] = await conn.query(
            "INSERT INTO pacientes (nombre, apellido, dni, id_obra_social, telefono, email) VALUES (?, ?, ?, ?, ?, ?)",
            [nombre, apellido, dni, obraSocialId, telefono, email]
        );

        const idPaciente = result.insertId; // Obtiene el ID del paciente recién creado

        // Devuelve JSON si la solicitud vino por fetch/AJAX, de lo contrario redirige
        if (req.headers.accept && req.headers.accept.includes("application/json")) {
            return res.json({ mensaje: "Paciente creado con éxito", id_paciente: idPaciente });
        } else {
            res.redirect("/pacientes");
        }

    } catch (error) {
        console.error("Error al insertar un nuevo paciente:", error);
        res.status(500).json({ error: "Error al insertar el paciente" });
    }
};

/*
exports.crearPaciente = async (req, res) => {
    const { nombre, apellido, dni, id_obra_social, nuevo_obra_social, telefono, email } = req.body;

    let obraSocialId = id_obra_social;

    try {
        // Si el usuario eligió "Otra" y quiere agregar una nueva obra social
        if (id_obra_social === "nueva" && nuevo_obra_social) {
            // Convertir a minúsculas para evitar duplicaciones sin importar mayúsculas/minúsculas
            const nombreObraSocial = nuevo_obra_social.toLowerCase();

            // Verificar si ya existe en la base de datos
            const [existeObra] = await conn.query(
                "SELECT id_obra_social FROM obras_sociales WHERE LOWER(nombre) = ?",
                [nombreObraSocial]
            );

            if (existeObra.length > 0) {
                obraSocialId = existeObra[0].id_obra_social; // Usa la obra social existente
            } else {
                const [nuevaObra] = await conn.query(
                    "INSERT INTO obras_sociales (nombre) VALUES (?)",
                    [nombreObraSocial]
                );
                obraSocialId = nuevaObra.insertId; // Obtén el ID de la nueva obra social
            }
        }

        // Crear el paciente con la obra social asociada
        const [result] = await conn.query(
            "INSERT INTO pacientes (nombre, apellido, dni, id_obra_social, telefono, email) VALUES (?, ?, ?, ?, ?, ?)",
            [nombre, apellido, dni, obraSocialId, telefono, email]
        );

        const idPaciente = result.insertId; // Obtiene el ID del paciente recién creado

        // Devuelve JSON si la solicitud vino por fetch/AJAX, de lo contrario redirige
        if (req.headers.accept && req.headers.accept.includes("application/json")) {
            return res.json({ mensaje: "Paciente creado con éxito", id_paciente: idPaciente });
        } else {
            res.redirect("/pacientes");
        }

    } catch (error) {
        console.error("Error al insertar un nuevo paciente:", error);
        res.status(500).json({ error: "Error al insertar el paciente" });
    }
};*/


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

// Mostrar formulario de registro con obras sociales

exports.renderRegisterForm = async (req, res) => {
    try {
        const [obrasSociales] = await conn.query("SELECT id_obra_social, nombre FROM obras_sociales");
        res.render("ingreso/pacientes/register", { obrasSociales });
    } catch (error) {
        console.error("Error al obtener obras sociales:", error);
        res.status(500).send("Error al cargar el formulario.");
    }
};

// Asegúrate de exportar correctamente esta función


// Registrar nuevo usuario con rol paciente o secretario
exports.register = async (req, res) => {
    const { email, password, id_rol, nombre, apellido, dni, telefono } = req.body;
    const dniPhoto = req.file ? req.file.filename : null;

    try {
        if (!email || !password || !id_rol || !nombre || !apellido || !dni || !telefono || !dniPhoto) {
            return res.status(400).send("Todos los campos son obligatorios.");
        }

        const role = parseInt(id_rol, 10);
        const hashedPassword = await bcrypt.hash(password, 10);

        const userQuery = `
            INSERT INTO usuarios (email, password, id_rol, activo) 
            VALUES (?, ?, ?, 1)
        `;
        const [userResult] = await conn.query(userQuery, [email, hashedPassword, role]);

        const userId = userResult.insertId;

        if (role === 2) {
            // PACIENTE
            const patientQuery = `
                INSERT INTO pacientes (nombre, apellido, dni, obra_social, telefono, email, activo, id_usuario, foto_dni) 
                VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `;
            await conn.query(patientQuery, [nombre, apellido, dni, req.body.obra_social || '', telefono, email, userId, dniPhoto]);
        } else if (role === 3) {
            // SECRETARIA
            const secretaryQuery = `
                INSERT INTO secretarios (nombre, apellido, dni, telefono, email, activo, id_usuario, foto_dni) 
                VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            `;
            await conn.query(secretaryQuery, [nombre, apellido, dni, telefono, email, userId, dniPhoto]);
        }

        res.redirect("/login");
    } catch (error) {
        console.error("Error al registrar:", error);
        res.status(500).send("Error interno del servidor.");
    }
};

// Login de usuario o secretario
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

        // Redireccionar según el rol
        switch (user.id_rol) {

            case 2:
                return res.redirect("/sucursales/sucursales");
            case 3:
                return res.redirect("/sucursales/sucursales"); // Secretaria
            default:
                return res.redirect("/login");
        }

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).send("Hubo un error al iniciar sesión.");
    }
};

//===========================================================//
// TURNO - PACIENTE SELECCIONA HORARIO
//===========================================================//
/*
exports.mostrarFormularioCrear = async (req, res) => {
    try {
        const { id_profesional, id_especialidad } = req.query;

        // Cargar todas las especialidades para el autocompletado
        const [especialidades] = await conn.query('SELECT id_especialidad, nombre FROM especialidades');

        // Obtener el nombre de la especialidad seleccionada
        let nombreEspecialidad = '';
        if (id_especialidad) {
            const [resultado] = await conn.query('SELECT nombre FROM especialidades WHERE id_especialidad = ?', [id_especialidad]);
            if (resultado.length > 0) {
                nombreEspecialidad = resultado[0].nombre;
            }
        }

        // Obtener el nombre del profesional seleccionado
        let nombreProfesional = '';
        if (id_profesional) {
            const [profesional] = await conn.query('SELECT nombre FROM profesionales WHERE id_profesional = ?', [id_profesional]);
            if (profesional.length > 0) {
                nombreProfesional = profesional[0].nombre;
            }
        }

        res.render('ingreso/pacientes/sacarTurno', {
            especialidades,
            id_profesional,
            id_especialidad,
            nombreEspecialidad,
            nombreProfesional
        });
    } catch (error) {
        console.error('Error al mostrar formulario de creación de turno:', error);
        res.status(500).send('Error al cargar el formulario de creación de turno');
    }
};*/




exports.mostrarFormularioCrear = async (req, res) => {
    try {
        const { id_profesional, id_especialidad, id_sucursal } = req.query;

        // Cargar especialidades filtradas por sucursal (si hay sucursal)
        let especialidades = [];
        if (id_sucursal) {
            [especialidades] = await conn.query(`
                SELECT DISTINCT e.id_especialidad, e.nombre 
                FROM especialidades e
                JOIN profesionales_especialidades pe ON e.id_especialidad = pe.id_especialidad
                JOIN profesionales p ON pe.id_profesional = p.id_profesional
                JOIN agenda a ON p.id_profesional = a.id_profesional
                WHERE a.id_sucursal = ?
            `, [id_sucursal]);
        } else {
            // Si no se pasa una sucursal, mostrar todas
            [especialidades] = await conn.query(`
                SELECT id_especialidad, nombre FROM especialidades
            `);
        }

        // Obtener el nombre de la especialidad seleccionada (si hay)
        let nombreEspecialidad = '';
        if (id_especialidad) {
            const [resultado] = await conn.query('SELECT nombre FROM especialidades WHERE id_especialidad = ?', [id_especialidad]);
            if (resultado.length > 0) {
                nombreEspecialidad = resultado[0].nombre;
            }
        }

        // Obtener el nombre del profesional seleccionado (si hay)
        let nombreProfesional = '';
        if (id_profesional) {
            const [profesional] = await conn.query('SELECT nombre FROM profesionales WHERE id_profesional = ?', [id_profesional]);
            if (profesional.length > 0) {
                nombreProfesional = profesional[0].nombre;
            }
        }

        // Renderizar la vista con todos los datos necesarios
        res.render('ingreso/pacientes/sacarTurno', {
            especialidades,
            id_profesional,
            id_especialidad,
            id_sucursal,
            nombreEspecialidad,
            nombreProfesional
        });

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
