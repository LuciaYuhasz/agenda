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
exports.crearPaciente = async (req, res) => {
    const { nombre, apellido, dni, id_obra_social, nuevo_obra_social, telefono, email } = req.body;

    let obraSocialId = id_obra_social;

    try {
        // 1. Si se agregó una nueva obra social
        if (id_obra_social === "nueva" && nuevo_obra_social) {
            const nombreObraSocial = nuevo_obra_social.toLowerCase();

            const [existeObra] = await conn.query(
                "SELECT id_obra_social FROM obras_sociales WHERE LOWER(nombre) = ?",
                [nombreObraSocial]
            );

            if (existeObra.length > 0) {
                obraSocialId = existeObra[0].id_obra_social;
            } else {
                const [nuevaObra] = await conn.query(
                    "INSERT INTO obras_sociales (nombre) VALUES (?)",
                    [nombreObraSocial]
                );
                obraSocialId = nuevaObra.insertId;
            }
        }

        // 2. Insertar el nuevo usuario asociado al paciente
        const defaultPassword = "123456";
        const hashedPassword = await bcrypt.hash(defaultPassword, 10);
        const idRolPaciente = 2;

        const [usuario] = await conn.query(
            "INSERT INTO usuarios (email, password, id_rol, activo) VALUES (?, ?, ?, 1)",
            [email, hashedPassword, idRolPaciente]
        );

        const idUsuario = usuario.insertId;

        // 3. Insertar el paciente con la obra social y el id_usuario vinculado
        const [paciente] = await conn.query(
            "INSERT INTO pacientes (nombre, apellido, dni, id_obra_social, telefono, email, activo, id_usuario) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            [nombre, apellido, dni, obraSocialId, telefono, email, idUsuario]
        );

        // 🔍 Detectar si la solicitud es AJAX (fetch) o HTML (formulario)
        const isAjax = req.xhr || req.headers.accept.includes('json');

        if (isAjax) {
            // Responder con JSON para solicitudes fetch/AJAX
            res.json({ id_paciente: paciente.insertId, message: "Paciente registrado correctamente" });
        } else {
            // Redirigir para formularios normales
            res.redirect("/pacientes");
        }

    } catch (error) {
        console.error("Error al crear el paciente y usuario:", error);
        res.status(500).send("Hubo un error al registrar el paciente.");
    }
};


// Listar todos los pacientes
exports.listarPacientes = async (req, res) => {
    try {
        const { busqueda } = req.query;
        let pacientes;

        if (busqueda) {
            const [resultado] = await conn.query(
                `SELECT p.*, o.nombre AS obra_social
         FROM pacientes p
         LEFT JOIN obras_sociales o ON p.id_obra_social = o.id_obra_social
         WHERE p.nombre LIKE ? OR p.apellido LIKE ? OR p.dni LIKE ?
         ORDER BY p.apellido ASC`,
                [`%${busqueda}%`, `%${busqueda}%`, `%${busqueda}%`]
            );
            pacientes = resultado;
        } else {
            const [resultado] = await conn.query(
                `SELECT p.*, o.nombre AS obra_social
         FROM pacientes p
         LEFT JOIN obras_sociales o ON p.id_obra_social = o.id_obra_social
         ORDER BY p.apellido ASC`
            );
            pacientes = resultado;
        }

        const agrupados = {};
        pacientes.forEach(paciente => {
            const letra = paciente.apellido.charAt(0).toUpperCase();
            if (!agrupados[letra]) agrupados[letra] = [];
            agrupados[letra].push(paciente);
        });

        res.render('pacientes/listar', {
            agrupados,
            busqueda,
            mensaje: req.query.mensaje || null
        });

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
/*
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
};*/
exports.buscarpaciente = async (req, res) => {
    const query = req.query.query;

    try {
        const [pacientes] = await conn.query(
            `
      SELECT 
        p.id_paciente,
        p.nombre,
        p.apellido,
        p.dni,
         o.id_obra_social,
        o.nombre AS obra_social,
        p.telefono,
        p.email
      FROM pacientes p
      LEFT JOIN obras_sociales o ON p.id_obra_social = o.id_obra_social
      WHERE (p.nombre LIKE ? OR p.apellido LIKE ? OR p.dni LIKE ?)
      AND p.activo = 1
      `,
            [`%${query}%`, `%${query}%`, `%${query}%`]
        );

        res.json(pacientes || []);
    } catch (error) {
        console.error('Error al buscar pacientes:', error);
        res.status(500).json({ error: error.message });
    }
};


//===========================================================//
// REGISTRO Y LOGIN DE USUARIO PACIENTE 
//===========================================================//


//// Renderiza el formulario de registro de secretarios con la lista de sucursales desde la base de datos.
exports.renderSecretaryRegisterForm = async (req, res) => {
    try {
        const [sucursales] = await conn.query("SELECT id_sucursal, nombre FROM sucursales ORDER BY nombre");
        res.render("ingreso/secretarios/register", { sucursales });
    } catch (error) {
        console.error("Error al obtener sucursales:", error);
        res.status(500).send("Error al cargar el formulario.");
    }
};

//// Renderiza el formulario de registro de pacientes con la lista formateada de obras sociales desde la base de datos.
exports.renderRegisterForm = async (req, res) => {
    try {
        // Consulta y formatea las obras sociales
        const [obrasSociales] = await conn.query(`
            SELECT id_obra_social, 
                   CASE 
                       WHEN nombre = 'Particular' THEN nombre 
                       ELSE CONCAT(UCASE(LEFT(nombre, 1)), LCASE(SUBSTRING(nombre, 2))) 
                   END AS nombre
            FROM obras_sociales
            ORDER BY CASE WHEN nombre = 'Particular' THEN 0 ELSE 1 END, nombre;
        `);

        res.render("ingreso/pacientes/register", { obrasSociales });

    } catch (error) {
        console.error("Error al obtener obras sociales:", error);
        res.status(500).send("Error al cargar el formulario.");
    }
};


// Registra un nuevo usuario (paciente o secretaria) en la base de datos según su rol, incluyendo su información personal y foto del DNI.
exports.register = async (req, res) => {
    const { email, password, id_rol, nombre, apellido, dni, telefono, obra_social, id_sucursal } = req.body;
    const dniPhoto = req.file ? req.file.filename : null;

    try {
        if (!email || !password || !id_rol || !nombre || !apellido || !dni || !telefono || !dniPhoto) {
            return res.status(400).send("Todos los campos son obligatorios.");
        }

        const role = parseInt(id_rol, 10);
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario base
        const userQuery = `
            INSERT INTO usuarios (email, password, id_rol, activo) 
            VALUES (?, ?, ?, 1)
        `;
        const [userResult] = await conn.query(userQuery, [email, hashedPassword, role]);
        const userId = userResult.insertId;
        // para rol de paciente
        if (role === 2) {
            const { obra_social: id_obra_social } = req.body;


            const patientQuery = `
    INSERT INTO pacientes (nombre, apellido, dni, id_obra_social, telefono, email, activo, id_usuario, foto_dni) 
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `;
            await conn.query(patientQuery, [nombre, apellido, dni, id_obra_social, telefono, email, userId, dniPhoto]);
        }
        //para secretaria
        else if (role === 3) {

            const secretaryQuery = `
                INSERT INTO secretarios (nombre, apellido, dni, telefono, email, activo, id_usuario, foto_dni, id_sucursal) 
                VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
            `;
            await conn.query(secretaryQuery, [nombre, apellido, dni, telefono, email, userId, dniPhoto, id_sucursal]);
        }
        //para paciente
        if (role === 2) {
            return res.redirect("/login"); // login de pacientes
        } else if (role === 3) {
            return res.redirect("/secretarios/login"); // login de secretarios
        }


    } catch (error) {
        console.error("Error al registrar:", error);
        res.status(500).send("Error interno del servidor.");
    }
};


//login o  Autentica al usuario, verifica sus credenciales y redirige según su rol (paciente o secretaria), guardando su sesión activa.
exports.login = async (req, res, expectedRole) => {
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

        if (user.id_rol !== expectedRole) {
            return res.status(403).send("No tiene permiso para acceder desde esta ruta.");
        }

        req.session.user = {
            id: user.id_usuario,
            email: user.email,
            id_rol: user.id_rol,
        }
        /*req.session.usuario = {
            id_usuario: user.id_usuario,
            email: user.email,
            id_rol: user.id_rol
        };*/


        // Redirección según el rol
        if (user.id_rol === 3) {
            // SECRETARIO
            const [secretarioData] = await conn.query(`
                SELECT s.id_sucursal, suc.nombre 
                FROM secretarios s 
                JOIN sucursales suc ON s.id_sucursal = suc.id_sucursal 
                WHERE s.id_usuario = ?
            `, [user.id_usuario]);

            if (secretarioData.length > 0) {
                const sucursalNombre = secretarioData[0].nombre.toLowerCase().replace(/\s/g, "");
                return res.redirect(`/sucursales/${sucursalNombre}`);
            } else {
                return res.status(403).send("No se encontró la sucursal asociada.");
            }
        } else if (user.id_rol === 2) {
            // PACIENTE
            return res.redirect("/sucursales/sucursales");
        } else {
            return res.status(403).send("Rol no permitido.");
        }

    } catch (error) {
        console.error("Error al iniciar sesión:", error);
        res.status(500).send("Hubo un error al iniciar sesión.");
    }
};


//===========================================================//
// TURNO - PACIENTE SELECCIONA HORARIO
//===========================================================//
/*exports.mostrarFormularioCrear = async (req, res) => {
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
                JOIN agendas a ON p.id_profesional = a.id_profesional
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
        console.log("💬 Mensaje desde sesión:", req.session.mensajeExito);

        /*res.render('ingreso/pacientes/sacarTurno', {
            especialidades,
            id_profesional,
            id_especialidad,
            id_sucursal,
            nombreEspecialidad,
            nombreProfesional,
            mensajeExito: req.session.mensajeExito // ⬅️ Acá lo incorporás
        });
        req.session.mensajeExito = null; // ⬅️ Y justo después, lo limpiás*/
        const mensaje = req.session.mensajeExito;
        req.session.mensajeExito = null; // primero lo guardás, después lo borrás

        res.render('ingreso/pacientes/sacarTurno', {
            especialidades,
            id_profesional,
            id_especialidad,
            id_sucursal,
            nombreEspecialidad,
            nombreProfesional,
            mensajeExito: mensaje
        });



    } catch (error) {
        console.error('Error al mostrar formulario de creación de turno:', error);
        res.status(500).send('Error al cargar el formulario de creación de turno');
    }
};




// Obtener profesionales por especialidad (Sucursal 1)
// 🔧 CAMBIAR ESTA FUNCIÓN
exports.obtenerProfesionales = async (req, res) => {
    const { id_especialidad } = req.params;
    const { id_sucursal } = req.query; // 👈 tomarlo como query param opcional

    try {
        let query = `
      SELECT p.id_profesional, p.nombre
      FROM profesionales p
      JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
      WHERE pe.id_especialidad = ? AND p.activo = 1
    `;

        const params = [id_especialidad];

        // 👉 Si se pasa la sucursal, filtrar por ella también
        if (id_sucursal) {
            query += ' AND p.id_sucursal = ?';
            params.push(id_sucursal);
        }

        const [profesionales] = await conn.query(query, params);
        res.json(profesionales);
    } catch (error) {
        console.error('Error al obtener profesionales:', error);
        res.status(500).json({ error: 'Error al obtener profesionales' });
    }
};

/*exports.obtenerProfesionales = async (req, res) => {
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
};*/

// Obtener horarios disponibles en una semana
exports.obtenerHorarios = async (req, res) => {
    const { idProfesional, idEspecialidad, fechaInicio } = req.params;

    const fechaInicioDate = new Date(`${fechaInicio}T00:00:00`);
    const fechaFinDate = new Date(fechaInicioDate);
    fechaFinDate.setDate(fechaInicioDate.getDate() + 6);

    try {
        const [resultados] = await conn.query(
            `SELECT 
        h.id_horarios, 
        DATE_FORMAT(h.fecha, '%Y-%m-%d') AS fecha,  -- ← esta es la clave
        h.hora_inicio, 
        h.hora_fin, 
        h.estado, 
        h.disponible
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


        // Agrupación por fecha como string directamente sin toISOString
        const horariosAgrupados = resultados.reduce((acc, horario) => {
            const fechaKey = horario.fecha; // ya es un string correcto
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
        const estado = 'reservado';
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

        const [profesionalResult] = await conn.query(
            'SELECT nombre, apellido FROM profesionales WHERE id_profesional = ?',
            [id_profesional]
        );
        const nombreProfesional = profesionalResult.length > 0
            ? `${profesionalResult[0].nombre} ${profesionalResult[0].apellido}`
            : 'Profesional desconocido';

        const [especialidadResult] = await conn.query(
            'SELECT nombre FROM especialidades WHERE id_especialidad = ?',
            [id_especialidad]
        );
        const nombreEspecialidad = especialidadResult.length > 0
            ? especialidadResult[0].nombre
            : 'Especialidad desconocida';

        req.session.mensajeExito = '✅ ¡Turno reservado exitosamente!';
        req.session.nombreProfesional = nombreProfesional;
        req.session.nombreEspecialidad = nombreEspecialidad;
        req.session.fechaTurno = fecha;
        req.session.horarioTurno = horario;

        res.redirect('/sacarTurno?exito=1');






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
