// controllers/adminControllers.js
const conn = require('../db'); // Conexión a la base de datos
const bcrypt = require('bcrypt');

//===========================================================//
//AUTENCTICACIOJN DE ADMINISTRADORES
//===========================================================//
exports.registerAdmin = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Encriptar la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insertar en la tabla usuarios como Administrador (id_rol = 1)
        const adminQuery = `
            INSERT INTO usuarios (email, password, id_rol, activo) 
            VALUES (?, ?, 1, 1)
        `;
        await conn.query(adminQuery, [email, hashedPassword]);

        console.log("Administrador registrado correctamente");
        res.redirect("/administrador/login"); // Redirige al formulario de login
    } catch (error) {
        console.error("Error al registrar al administrador:", error);
        res.status(500).send("Hubo un error al registrar al administrador.");
    }
};
exports.loginAdmin = async (req, res) => {
    const { email, password } = req.body;

    try {
        // Buscar usuario en la base de datos con el rol de Administrador
        const query = `
            SELECT * FROM usuarios 
            WHERE email = ? AND id_rol = 1 AND activo = 1
        `;
        const [rows] = await conn.query(query, [email]);

        if (rows.length === 0) {
            return res.status(401).send("Credenciales incorrectas o el usuario no es administrador.");
        }

        const admin = rows[0];

        // Verificar contraseña
        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return res.status(401).send("Credenciales incorrectas.");
        }

        console.log("Administrador autenticado correctamente");
        // Guardar la sesión del administrador o redirigir al panel de administrador
        req.session.adminId = admin.id_usuario; // Ejemplo: almacenar el ID en la sesión
        res.redirect("/administrador"); // Redirige al panel de administrador
    } catch (error) {
        console.error("Error al iniciar sesión como administrador:", error);
        res.status(500).send("Hubo un error al iniciar sesión.");
    }
};

//===========================================================//
//AGENDAS CRUD BASICO
//===========================================================//
exports.buscarAgenda = async (req, res) => {
    const { id_profesional, id_especialidad } = req.query;

    try {
        // Consulta para obtener las agendas
        const agendaQuery = `
          SELECT 
            a.id_agenda, a.id_profesional, a.id_profesional_especialidad,
            p.nombre AS profesional_nombre, p.apellido AS profesional_apellido,
            e.nombre AS especialidad_nombre, s.nombre AS sucursal_nombre,
            a.sobreturnos_maximos
          FROM agendas a
          JOIN profesionales p ON a.id_profesional = p.id_profesional
          JOIN especialidades e ON a.id_profesional_especialidad = e.id_especialidad
          JOIN sucursales s ON a.id_sucursal = s.id_sucursal
          WHERE a.id_profesional = ? AND a.id_profesional_especialidad = ?;
        `;

        const params = [id_profesional, id_especialidad];
        const [agendas] = await conn.query(agendaQuery, params);

        // Agregar horarios a cada agenda
        for (let agenda of agendas) {
            const horariosQuery = `
              SELECT 
                fecha, hora_inicio, hora_fin, estado 
              FROM horarios 
              WHERE id_agenda = ? 
              ORDER BY fecha, hora_inicio;
            `;
            const [horarios] = await conn.query(horariosQuery, [agenda.id_agenda]);

            // Agrupar horarios por fecha
            agenda.horarios = horarios.reduce((acc, horario) => {
                const fecha = horario.fecha;
                if (!acc[fecha]) acc[fecha] = [];
                acc[fecha].push(horario);
                return acc;
            }, {});
        }

        res.render('ingreso/administrador/agenda', { agendas });

    } catch (error) {
        console.error('Error al buscar agendas:', error);
        res.status(500).send('Hubo un error al buscar agendas.');
    }
};
exports.createAgenda = async (req, res) => {
    console.log("Solicitud recibida en createAgenda", req.body);
    const {
        id_profesional,
        id_profesional_especialidad,
        id_sucursal,
        id_clasificacion_agenda,
        sobreturnos_maximos
    } = req.body;

    try {
        // Validar que el profesional exista y esté activo
        const checkProfessionalQuery =
            `SELECT * FROM profesionales WHERE id_profesional = ? AND activo = 1`;
        const [professionalRows] = await conn.query(checkProfessionalQuery, [id_profesional]);
        if (professionalRows.length === 0) {
            return res.status(404).send("El profesional no existe o no está activo.");
        }

        // Insertar la nueva agenda
        const insertAgendaQuery =
            `INSERT INTO agendas 
            (id_profesional, id_profesional_especialidad, id_sucursal, id_clasificacion_agenda, sobreturnos_maximos) 
            VALUES (?, ?, ?, ?, ?)`;
        const [result] = await conn.query(insertAgendaQuery, [
            id_profesional,
            id_profesional_especialidad,
            id_sucursal,
            id_clasificacion_agenda,
            sobreturnos_maximos
        ]);

        console.log("Agenda creada con éxito:", result.insertId);
        //res.status(200).redirect("/create-schedule");

        res.status(200).redirect(`/create-schedule?id_agenda=${result.insertId}`);


    } catch (error) {
        console.error("Error al crear agenda:", error);
        res.status(500).send("Hubo un error al crear la agenda.");
    }
};
// Función auxiliar para validar la existencia de un registro
const validarExistencia = async (query, params) => {
    const [rows] = await conn.query(query, params);
    return rows.length > 0;
};
exports.createScheduleBatch = async (req, res) => {
    const { id_agenda, hora_inicio, hora_fin, duracion_turno, rango_fechas_inicio, rango_fechas_fin } = req.body;

    if (!id_agenda || !hora_inicio || !hora_fin || !duracion_turno || !rango_fechas_inicio || !rango_fechas_fin) {
        return res.status(400).send("Faltan datos para generar los horarios.");
    }

    try {
        const startDate = new Date(rango_fechas_inicio);
        const endDate = new Date(rango_fechas_fin);

        if (startDate > endDate) {
            return res.status(400).send("El rango de fechas no es válido.");
        }

        const horarios = [];
        const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
            const currentDay = daysOfWeek[localDate.getDay()];
            let currentHour = new Date(`${localDate.toISOString().split("T")[0]}T${hora_inicio}`);
            const endHour = new Date(`${localDate.toISOString().split("T")[0]}T${hora_fin}`);

            while (currentHour < endHour) {
                const nextHour = new Date(currentHour.getTime() + duracion_turno * 60000);
                if (nextHour > endHour) break;

                horarios.push([
                    id_agenda,
                    currentDay,
                    localDate.toISOString().split("T")[0],
                    currentHour.toTimeString().split(" ")[0],
                    nextHour.toTimeString().split(" ")[0],
                    duracion_turno,
                    1 // Estado disponible
                ]);

                currentHour = nextHour;
            }
        }

        if (horarios.length > 0) {
            const insertQuery = `
                INSERT INTO horarios 
                (id_agenda, dia_semana, fecha, hora_inicio, hora_fin, duracion_turno, disponible) 
                VALUES ?
            `;
            await conn.query(insertQuery, [horarios]);
        }

        // Redirigir directamente a la vista de la agenda
        res.redirect(`/view-schedule?id_agenda=${id_agenda}`);
    } catch (error) {
        console.error("Error al crear horarios masivos:", error);
        res.status(500).send("Hubo un error al crear los horarios masivamente.");
    }
};
exports.viewSchedule = async (req, res) => {
    const { id_agenda } = req.query;

    if (!id_agenda) {
        return res.status(400).send("Falta el ID de la agenda.");
    }

    try {
        const queryAgendas = `
            SELECT 
                h.fecha, 
                h.hora_inicio, 
                h.hora_fin, 
                h.estado, 
                CONCAT(p.nombre, ' ', p.apellido) AS nombre_completo, 
                e.nombre AS nombre_especialidad
            FROM 
                horarios h
            INNER JOIN 
                agendas a ON h.id_agenda = a.id_agenda
            INNER JOIN 
                profesionales p ON a.id_profesional = p.id_profesional
            INNER JOIN 
                especialidades e ON a.id_profesional_especialidad = e.id_especialidad
            WHERE 
                h.id_agenda = ?
            ORDER BY 
                h.fecha, h.hora_inicio;
        `;
        const [rows] = await conn.query(queryAgendas, [id_agenda]);

        const agendas = rows.reduce((acc, horario) => {
            const { fecha } = horario;
            if (!acc[fecha]) acc[fecha] = [];
            acc[fecha].push(horario);
            return acc;
        }, {});

        res.render("ingreso/administrador/visualizar-agendas", { agendas });
    } catch (error) {
        console.error("Error al obtener las agendas:", error);
        res.status(500).send("Hubo un error al obtener las agendas.");
    }
};
exports.createSchedule = async (req, res) => {
    const id_agenda = req.query.id_agenda || req.body.id_agenda; // Tomar el id_agenda del query o del formulario
    const { dia_semana, fecha, hora_inicio, hora_fin, duracion_turno } = req.body;

    if (!id_agenda) {
        return res.status(400).send("Falta el ID de la agenda.");
    }

    try {
        // Validar que la agenda exista
        const checkAgendaQuery = `SELECT * FROM agendas WHERE id_agenda = ?`;
        const [agendaRows] = await conn.query(checkAgendaQuery, [id_agenda]);
        if (agendaRows.length === 0) {
            return res.status(404).send("La agenda no existe.");
        }

        // Insertar nuevo horario
        const insertScheduleQuery =
            `INSERT INTO horarios 
                (id_agenda, dia_semana, fecha, hora_inicio, hora_fin, duracion_turno, disponible) 
                VALUES (?, ?, ?, ?, ?, ?, 1)`;
        const [result] = await conn.query(insertScheduleQuery, [
            id_agenda,
            dia_semana,
            fecha,
            hora_inicio,
            hora_fin,
            duracion_turno
        ]);

        console.log("Horario creado con éxito:", result.insertId);
        res.status(201).send("Horario creado exitosamente.");
    } catch (error) {
        console.error("Error al crear horario:", error);
        res.status(500).send("Hubo un error al crear el horario.");
    }
};
exports.showCreateSchedule = async (req, res) => {
    const id_agenda = req.query.id_agenda;
    if (!id_agenda) {
        return res.status(400).send("Falta el ID de la agenda.");
    }

    // Renderiza la vista pasando el id_agenda
    res.render("ingreso/administrador/crearHorario", { id_agenda });
};
exports.listarMedicosParaFormulario = async (req, res) => {
    try {
        const [result] = await conn.execute(`
            SELECT 
                p.id_profesional, 
                CONCAT(p.nombre, ' ', p.apellido) AS nombre_completo, 
                GROUP_CONCAT(e.nombre SEPARATOR ', ') AS especialidades
            FROM profesionales p
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE p.activo = 1
            GROUP BY p.id_profesional, p.nombre, p.apellido
        `);

        console.log('Resultado de la consulta:', result);
        //res.render('ingreso/administrador/createAgenda', { profesionales: result });
        res.render('ingreso/administrador/editAgenda', { profesionales: result });

    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};
exports.listarMedicosParacrear = async (req, res) => {
    try {
        const [result] = await conn.execute(`
            SELECT 
                p.id_profesional, 
                CONCAT(p.nombre, ' ', p.apellido) AS nombre_completo, 
                GROUP_CONCAT(e.nombre SEPARATOR ', ') AS especialidades
            FROM profesionales p
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE p.activo = 1
            GROUP BY p.id_profesional, p.nombre, p.apellido
        `);

        console.log('Resultado de la consulta:', result);
        //res.render('ingreso/administrador/createAgenda', { profesionales: result });
        res.render('ingreso/administrador/createAgenda', { profesionales: result });

    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};
exports.getEspecialidadesPorProfesional = async (req, res) => {
    const { id_profesional } = req.params;

    try {
        const [result] = await conn.execute(`
            SELECT e.id_especialidad, e.nombre AS nombre_especialidad
            FROM profesionales_especialidades pe
            JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE pe.id_profesional = ?
        `, [id_profesional]);

        res.json(result); // Devuelve las especialidades en formato JSON
    } catch (error) {
        console.error("Error al consultar especialidades:", error);
        res.status(500).send("Error al consultar especialidades.");
    }
};
