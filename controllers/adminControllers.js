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
        // Buscar usuario en la base de datos
        const query = `
            SELECT * FROM usuarios 
            WHERE email = ? AND id_rol = 1 AND activo = 1
        `;
        const [rows] = await conn.query(query, [email]);

        if (rows.length === 0) {
            return res.status(401).send("Credenciales incorrectas o el usuario no es administrador.");
        }

        const admin = rows[0];
        const isPasswordValid = await bcrypt.compare(password, admin.password);

        if (!isPasswordValid) {
            return res.status(401).send("Credenciales incorrectas.");
        }

        console.log("Administrador autenticado correctamente");

        // 🔄 Regenerar sesión
        req.session.regenerate((err) => {
            if (err) {
                console.error("Error regenerando la sesión:", err);
                return res.status(500).send("Error al preparar la sesión.");
            }

            // 🧼 Sesión limpia
            req.session.user = {
                id: admin.id_usuario,
                email: admin.email,
                id_rol: admin.id_rol
            };
            req.session.id_sucursal = null;

            res.redirect("/administrador");
        });

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

        for (let agenda of agendas) {
            // Obtener horarios normales
            const horariosQuery = `
              SELECT fecha, hora_inicio, hora_fin, estado 
              FROM horarios 
              WHERE id_agenda = ? 
              ORDER BY fecha, hora_inicio;
            `;
            const [horarios] = await conn.query(horariosQuery, [agenda.id_agenda]);

            // Obtener bloqueos de horarios
            const bloqueosQuery = `
              SELECT fecha_bloqueo AS fecha, hora_inicio, hora_fin, 'Bloqueado' AS estado, motivo
              FROM bloqueos_horarios 
              WHERE id_agenda = ?;
            `;
            const [bloqueos] = await conn.query(bloqueosQuery, [agenda.id_agenda]);

            // Combinar horarios y bloqueos en una única estructura ordenada
            const eventos = [...horarios, ...bloqueos].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

            // Agrupar por fecha
            agenda.eventos = eventos.reduce((acc, evento) => {
                const fecha = evento.fecha;
                if (!acc[fecha]) acc[fecha] = [];
                acc[fecha].push(evento);
                return acc;
            }, {});
        }

        console.log("Agendas con horarios y bloqueos combinados:", JSON.stringify(agendas, null, 2));
        res.render("ingreso/administrador/agenda", { agendas });

    } catch (error) {
        console.error("Error al buscar agendas:", error);
        res.status(500).send("Hubo un error al buscar agendas.");
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
// creacion de horarios y redireccion a agenda correspondiente 
// 🔁 Función reutilizable para detectar solapamientos
function isOverlapping(horaInicioTurno, horaFinTurno, horaInicioBloqueo, horaFinBloqueo) {
    return horaInicioBloqueo < horaFinTurno && horaFinBloqueo > horaInicioTurno;
}

// 🚀 Creación de horarios y redirección a agenda correspondiente
exports.createScheduleBatch = async (req, res) => {
    const {
        id_agenda,
        hora_inicio,
        hora_fin,
        duracion_turno,
        rango_fechas_inicio,
        rango_fechas_fin
    } = req.body;

    if (
        !id_agenda ||
        !hora_inicio ||
        !hora_fin ||
        !duracion_turno ||
        !rango_fechas_inicio ||
        !rango_fechas_fin
    ) {
        return res.status(400).send("Faltan datos para generar los horarios.");
    }

    try {
        const startDate = new Date(`${rango_fechas_inicio}T00:00:00`);
        const endDate = new Date(`${rango_fechas_fin}T00:00:00`);

        if (startDate > endDate) {
            return res.status(400).send("El rango de fechas no es válido.");
        }

        // 🔒 Obtener bloqueos que aplican a esta agenda en el rango de fechas
        const [bloqueos] = await conn.query(
            `SELECT fecha_bloqueo, hora_inicio, hora_fin 
             FROM bloqueos_horarios 
             WHERE id_agenda = ? AND fecha_bloqueo BETWEEN ? AND ?`,
            [id_agenda, rango_fechas_inicio, rango_fechas_fin]
        );

        const horarios = [];
        const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
        let totalIntentos = 0;
        let totalBloqueados = 0;
        let totalDuplicados = 0;

        for (let i = 0; i <= (endDate - startDate) / (1000 * 60 * 60 * 24); i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            d.setHours(0, 0, 0, 0);

            const fechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const currentDay = daysOfWeek[d.getDay()];

            let currentHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(hora_inicio.split(":")[0]), parseInt(hora_inicio.split(":")[1]));
            const endHour = new Date(d.getFullYear(), d.getMonth(), d.getDate(), parseInt(hora_fin.split(":")[0]), parseInt(hora_fin.split(":")[1]));

            while (currentHour < endHour) {
                const nextHour = new Date(currentHour.getTime() + duracion_turno * 60000);
                if (nextHour > endHour) break;

                const horaInicioStr = currentHour.toTimeString().split(" ")[0]; // HH:MM:SS
                const horaFinStr = nextHour.toTimeString().split(" ")[0];

                totalIntentos++;

                const estaBloqueado = bloqueos.some(b => {
                    const bloqueoFecha = b.fecha_bloqueo.toISOString().split("T")[0];
                    return bloqueoFecha === fechaStr &&
                        isOverlapping(horaInicioStr, horaFinStr, b.hora_inicio, b.hora_fin);
                });

                if (estaBloqueado) {
                    totalBloqueados++;
                    console.log(`⛔ Bloqueado: ${fechaStr} de ${horaInicioStr} a ${horaFinStr}`);
                } else {
                    // 🔍 Validar si ya existe ese horario
                    const [existe] = await conn.query(
                        `SELECT 1 FROM horarios 
                         WHERE id_agenda = ? AND fecha = ? AND hora_inicio = ? LIMIT 1`,
                        [id_agenda, fechaStr, horaInicioStr]
                    );

                    if (existe.length > 0) {
                        totalDuplicados++;
                        console.log(`🔁 Duplicado: ${fechaStr} de ${horaInicioStr} ya existe`);
                    } else {
                        console.log(`✅ Válido: ${fechaStr} de ${horaInicioStr} a ${horaFinStr}`);
                        horarios.push([
                            id_agenda,
                            currentDay,
                            fechaStr,
                            horaInicioStr,
                            horaFinStr,
                            duracion_turno,
                            1
                        ]);
                    }
                }

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
            console.log(`🟢 ${horarios.length} horarios creados exitosamente`);
        } else {
            console.log("⚠️ No se generaron horarios válidos (todos estaban bloqueados o duplicados)");
            return res.status(200).send("No se generaron horarios válidos. Todos estaban bloqueados o duplicados.");
        }

        console.log(`🧾 Resumen: ${totalIntentos} intentos — ${totalBloqueados} bloqueados — ${totalDuplicados} duplicados — ${horarios.length} insertados`);

        const [agendaData] = await conn.query(
            `SELECT id_profesional, id_profesional_especialidad FROM agendas WHERE id_agenda = ?`,
            [id_agenda]
        );

        if (agendaData.length === 0) {
            return res.status(404).send("Agenda no encontrada.");
        }

        const { id_profesional, id_profesional_especialidad: id_especialidad } = agendaData[0];

        res.redirect(`/buscar-agenda?id_profesional=${id_profesional}&id_especialidad=${id_especialidad}`);
    } catch (error) {
        console.error("🚨 Error al crear horarios masivos:", error);
        res.status(500).send("Hubo un error al crear los horarios masivamente.");
    }
};


/*exports.createScheduleBatch = async (req, res) => {
    const { id_agenda, hora_inicio, hora_fin, duracion_turno, rango_fechas_inicio, rango_fechas_fin } = req.body;

    if (!id_agenda || !hora_inicio || !hora_fin || !duracion_turno || !rango_fechas_inicio || !rango_fechas_fin) {
        return res.status(400).send("Faltan datos para generar los horarios.");
    }

    try {
        const startDate = new Date(`${rango_fechas_inicio}T00:00:00`);
        const endDate = new Date(`${rango_fechas_fin}T00:00:00`);

        if (startDate > endDate) {
            return res.status(400).send("El rango de fechas no es válido.");
        }

        // 🔒 Traer bloqueos dentro del rango de fechas para esta agenda
        const [bloqueos] = await conn.query(
            `SELECT fecha_bloqueo, hora_inicio, hora_fin 
             FROM bloqueos_horarios 
             WHERE id_agenda = ? AND fecha_bloqueo BETWEEN ? AND ?`,
            [id_agenda, rango_fechas_inicio, rango_fechas_fin]
        );

        const horarios = [];
        const daysOfWeek = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

        for (let i = 0; i <= (endDate - startDate) / (1000 * 60 * 60 * 24); i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            d.setHours(0, 0, 0, 0); // Asegura medianoche local

            const fechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const currentDay = daysOfWeek[d.getDay()];

            let currentHour = new Date(
                d.getFullYear(),
                d.getMonth(),
                d.getDate(),
                parseInt(hora_inicio.split(":")[0], 10),
                parseInt(hora_inicio.split(":")[1], 10)
            );

            const endHour = new Date(
                d.getFullYear(),
                d.getMonth(),
                d.getDate(),
                parseInt(hora_fin.split(":")[0], 10),
                parseInt(hora_fin.split(":")[1], 10)
            );

            while (currentHour < endHour) {
                const nextHour = new Date(currentHour.getTime() + duracion_turno * 60000);
                if (nextHour > endHour) break;

                const horaInicioStr = currentHour.toTimeString().split(" ")[0]; // HH:MM:SS
                const horaFinStr = nextHour.toTimeString().split(" ")[0];

                // 🔒 Verificar si este horario está completamente dentro de un bloqueo
                const bloqueoEnFecha = bloqueos.find(b =>
                    b.fecha_bloqueo.toISOString().split("T")[0] === fechaStr &&
                    horaInicioStr >= b.hora_inicio &&
                    horaFinStr <= b.hora_fin
                );

                if (!bloqueoEnFecha) {
                    horarios.push([
                        id_agenda,
                        currentDay,
                        fechaStr,
                        horaInicioStr,
                        horaFinStr,
                        duracion_turno,
                        1
                    ]);
                }

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

        const [agendaData] = await conn.query(
            `SELECT id_profesional, id_profesional_especialidad FROM agendas WHERE id_agenda = ?`,
            [id_agenda]
        );

        if (agendaData.length === 0) {
            return res.status(404).send("Agenda no encontrada.");
        }

        const { id_profesional, id_profesional_especialidad: id_especialidad } = agendaData[0];

        res.redirect(`/buscar-agenda?id_profesional=${id_profesional}&id_especialidad=${id_especialidad}`);

    } catch (error) {
        console.error("Error al crear horarios masivos:", error);
        res.status(500).send("Hubo un error al crear los horarios masivamente.");
    }
};
*/
//* Renderiza  desde la agenda articular ara agregar mas horarios.
exports.showCreateSchedule = async (req, res) => {
    const id_agenda = req.query.id_agenda;
    if (!id_agenda) {
        return res.status(400).send("Falta el ID de la agenda.");
    }

    // Renderiza la vista pasando el id_agenda
    res.render("ingreso/administrador/crearHorario", { id_agenda });
};


//FIJARME PARA QUE ES ESTE METODO
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

        console.log('Resultado de la consulta LISTAR MEDICOS PARA FORMULARIOS :', result);
        //res.render('ingreso/administrador/createAgenda', { profesionales: result });
        res.render('ingreso/administrador/editAgenda', { profesionales: result });

    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};
//FIJARME PARA QUE ES ESTE METODO
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

        console.log('Resultado de la consulta LISTARMEDICOSPARACREAE:', result);
        //res.render('ingreso/administrador/createAgenda', { profesionales: result });
        res.render('ingreso/administrador/createAgenda', { profesionales: result });

    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};
//este metodo es usado para la creacion de la agenda
/*exports.getEspecialidadesPorProfesional = async (req, res) => {
    const { id_profesional } = req.params;

    try {
        const [result] = await conn.execute(`
            SELECT e.id_especialidad, e.nombre AS nombre_especialidad
            FROM profesionales_especialidades pe
            JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE pe.id_profesional = ?
        `, [id_profesional]);
        console.log('Resultado de la consulta GETESPECILIDADESPORPROFESIONAL:', result);
        res.json(result); // Devuelve las especialidades en formato JSON
    } catch (error) {
        console.error("Error al consultar especialidades:", error);
        res.status(500).send("Error al consultar especialidades.");
    }
};


*/
exports.getEspecialidadesPorProfesional = async (req, res) => {
    const { id_profesional } = req.params;

    try {
        const [result] = await conn.execute(`
      SELECT e.id_especialidad, e.nombre AS nombre_especialidad
      FROM profesionales_especialidades pe
      JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
      LEFT JOIN agendas a 
        ON a.id_profesional = pe.id_profesional 
        AND a.id_profesional_especialidad = pe.id_especialidad
      WHERE pe.id_profesional = ?
        AND a.id_agenda IS NULL
    `, [id_profesional]);

        console.log("Especialidades disponibles:", result);
        res.json(result);
    } catch (error) {
        console.error("Error al consultar especialidades disponibles:", error);
        res.status(500).send("Error al consultar especialidades.");
    }
};
//y este metodo es para la busqueda de agendas 
exports.getEspecialidadesPorProfesionalSinFiltro = async (req, res) => {
    const { id_profesional } = req.params;

    try {
        const [result] = await conn.execute(`
      SELECT e.id_especialidad, e.nombre AS nombre_especialidad
      FROM profesionales_especialidades pe
      JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
      WHERE pe.id_profesional = ?
    `, [id_profesional]);

        res.json(result);
    } catch (error) {
        console.error("Error al consultar especialidades:", error);
        res.status(500).send("Error al consultar especialidades.");
    }
};


//METODO PARA MOSTRAR FORMULARIO DE CREACION DE AGENDA NUEVA 
exports.formCrearAgenda = async (req, res) => {
    try {
        console.log("Entró a formCrearAgenda");
        const [profesionales] = await conn.query(`
        SELECT id_profesional, CONCAT(nombre, ' ', apellido) AS nombre_completo 
        FROM profesionales 
        WHERE activo = 1
      `);

        const [sucursales] = await conn.query(`
        SELECT id_sucursal, nombre 
        FROM sucursales
      `);
        console.log("Sucursales desde el controlador:", sucursales);
        //res.render('ingreso/administrador/create-agenda', {
        res.render('ingreso/administrador/createAgenda', {

            profesionales,
            sucursales
        });


    } catch (error) {
        console.error("Error al cargar formulario de agenda:", error);
        res.status(500).send("Error al cargar datos del formulario.");
    }
};

//Medodo para port de horarios bloquedos 

//funcion para cargar agenda con horartios bloqueados
exports.getAgendasWithBlocks = async (req, res) => {
    try {
        console.log("Ejecutando getAgendasWithBlocks...");
        const queryAgendas = `SELECT * FROM agendas`;
        const [agendas] = await conn.query(queryAgendas);

        const queryBloqueos = `SELECT * FROM bloqueos_horarios`;
        const [bloqueos] = await conn.query(queryBloqueos);

        // Organizar bloqueos dentro de cada agenda
        agendas.forEach(agenda => {
            agenda.bloqueos = bloqueos.filter(b => b.id_agenda === agenda.id_agenda);
        });
        console.log("Agendas cargadas:", agendas);
        console.log("Bloqueos cargados:", bloqueos);

        res.render("ingreso/administrador/agenda", { agendas });
        //res.render("agenda", { agendas });
    } catch (error) {
        console.error("Error al cargar agendas y bloqueos:", error);
        res.status(500).send("Hubo un error al cargar las agendas.");
    }
};


function getDatesOfWeekdayInMonth(month, weekday) {
    const [year, mes] = month.split("-");
    const fechas = [];
    const date = new Date(year, mes - 1, 1);

    while (date.getMonth() + 1 === parseInt(mes)) {
        if (date.getDay() === (weekday === "saturday" ? 6 : 0)) {
            fechas.push(new Date(date));
        }
        date.setDate(date.getDate() + 1);
    }

    return fechas;
}




// 🔒 Función para aplicar bloqueos sobre horarios existentes
const actualizarHorariosBloqueados = async (id_agenda, fecha, inicio, fin) => {
    const queryUpdate = `
        UPDATE horarios
        SET disponible = 0, estado = 'No disponible'
        WHERE id_agenda = ? 
          AND fecha = ? 
          AND hora_inicio < ? 
          AND hora_fin > ?
          AND disponible = 1
          AND estado = 'Libre'
    `;
    const [result] = await conn.query(queryUpdate, [
        id_agenda,
        fecha,
        fin,   // hora_fin del bloqueo
        inicio // hora_inicio del bloqueo
    ]);
    return result.affectedRows;
};


// 📅 Crear bloqueo de horarios
exports.createBlock = async (req, res) => {
    const {
        id_agenda,
        fecha_bloqueo,
        hora_inicio,
        hora_fin,
        motivo,
        bloqueo_completo,
        repetir,
        mes,
        modo
    } = req.body;

    let fechas = [];
    let inicio = hora_inicio;
    let fin = hora_fin;

    // Normalizador de hora en formato HH:MM:SS
    const normalizarHora = (hora) => {
        return hora.length === 5 ? `${hora}:00` : hora;
    };
    inicio = normalizarHora(inicio);
    fin = normalizarHora(fin);

    try {
        if (modo === "puntual") {
            if (!fecha_bloqueo || !hora_inicio || !hora_fin) {
                return res.status(400).send("Faltan datos para bloqueo puntual.");
            }
            fechas = [fecha_bloqueo];
        } else if (modo === "recurrente") {
            if (!mes || !repetir) {
                return res.status(400).send("Faltan datos para bloqueo recurrente.");
            }
            fechas = getDatesOfWeekdayInMonth(mes, repetir).map(f =>
                f.toISOString().slice(0, 10)
            );
            if (bloqueo_completo) {
                inicio = "00:00:00";
                fin = "23:59:59";
            }
        }

        let bloqueosInsertados = 0;
        let horariosAfectados = 0;

        for (const fecha of fechas) {
            console.log(`🟥 Registrando bloqueo para ${fecha} de ${inicio} a ${fin}`);

            const queryBloqueo = `
                INSERT INTO bloqueos_horarios 
                (id_agenda, fecha_bloqueo, hora_inicio, hora_fin, motivo)
                VALUES (?, ?, ?, ?, ?)
            `;
            await conn.query(queryBloqueo, [id_agenda, fecha, inicio, fin, motivo]);
            bloqueosInsertados++;

            // 🔒 Aplicar bloqueo sobre horarios existentes
            const afectados = await actualizarHorariosBloqueados(id_agenda, fecha, inicio, fin);
            console.log(`🔧 Horarios afectados en ${fecha}: ${afectados}`);
            horariosAfectados += afectados;
        }

        const [agendaData] = await conn.query(
            `SELECT id_profesional, id_profesional_especialidad FROM agendas WHERE id_agenda = ?`,
            [id_agenda]
        );

        if (agendaData.length === 0) {
            return res.status(404).send("Agenda no encontrada.");
        }

        const { id_profesional, id_profesional_especialidad: id_especialidad } = agendaData[0];

        console.log(`✅ Total bloqueos registrados: ${bloqueosInsertados}`);
        console.log(`🔒 Total horarios modificados: ${horariosAfectados}`);

        res.redirect(`/buscar-agenda?id_profesional=${id_profesional}&id_especialidad=${id_especialidad}`);
    } catch (error) {
        console.error("🚨 Error al bloquear horario:", error);
        res.status(500).send("Hubo un error al bloquear el horario.");
    }
};
