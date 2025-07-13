// controllers/turnosController.js

const conn = require('../db');

// Mostrar formulario para crear un nuevo turno
exports.mostrarFormularioCrear = async (req, res) => {
    try {
        // Cargar obras sociales
        const [obrasSociales] = await conn.query(
            'SELECT id_obra_social, nombre FROM obras_sociales ORDER BY nombre ASC'
        );

        // Cargar pacientes, profesionales y especialidades
        const [pacientes] = await conn.query('SELECT * FROM pacientes');
        const [profesionales] = await conn.query('SELECT * FROM profesionales');
        const [especialidades] = await conn.query(
            'SELECT id_especialidad, nombre FROM especialidades'
        );

        const id_profesional =
            req.query.id_profesional || profesionales[0].id_profesional;
        const id_especialidad =
            req.query.id_especialidad || especialidades[0].id_especialidad;
        const fecha =
            req.query.fecha || new Date().toISOString().split('T')[0];

        const [horarios] = await conn.query('SELECT * FROM horarios');

        res.render('turnos/crear', {
            pacientes,
            profesionales,
            especialidades,
            horariosDisponibles: horarios,
            obrasSociales, // 👈 lo agregás acá
            id_profesional,
            id_especialidad,
            fecha
        });
    } catch (error) {
        console.error('Error al mostrar formulario de creación de turno:', error);
        res.status(500).send('Error al cargar el formulario de creación de turno');
    }
};

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
};


const { format } = require('date-fns');
const { es } = require('date-fns/locale');

// 🔧 Funciones auxiliares
function normalizarHora(hora) {
    if (!hora || typeof hora !== 'string') return '00:00:00';
    const partes = hora.split(':');
    return `${partes[0]?.padStart(2, '0') || '00'}:${partes[1]?.padStart(2, '0') || '00'}:${partes[2]?.padStart(2, '0') || '00'}`;
}

function construirTimestamp(fecha, hora) {
    const horaNormalizada = normalizarHora(hora);
    const dateTimeString = `${fecha}T${horaNormalizada}`;
    const timestamp = new Date(dateTimeString);
    return isNaN(timestamp) ? null : timestamp;
}

exports.mostrarAgenda = async (req, res) => {
    try {
        const { id_profesional, id_especialidad } = req.params;

        // 👉 Obtener datos básicos
        const [profesionalData] = await conn.query(
            'SELECT p.nombre, p.apellido, p.email FROM profesionales p WHERE p.id_profesional = ?',
            [id_profesional]
        );

        const [matriculaData] = await conn.query(
            'SELECT pe.matricula FROM profesionales_especialidades pe WHERE pe.id_profesional = ? AND pe.id_especialidad = ?',
            [id_profesional, id_especialidad]
        );

        const [especialidadData] = await conn.query(
            'SELECT * FROM especialidades WHERE id_especialidad = ?',
            [id_especialidad]
        );

        if (profesionalData.length === 0 || especialidadData.length === 0 || matriculaData.length === 0) {
            return res.status(404).json({ error: 'Profesional o especialidad no encontrados' });
        }

        // 👉 Turnos ocupados
        const [turnos] = await conn.query(
            `SELECT t.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
       FROM turnos t
       LEFT JOIN pacientes p ON t.id_paciente = p.id_paciente
       WHERE t.id_profesional = ? AND t.id_especialidad = ?
       ORDER BY t.fecha, t.hora`,
            [id_profesional, id_especialidad]
        );

        // 👉 Horarios disponibles
        const [horarios] = await conn.query(
            `SELECT h.*
       FROM horarios h
       JOIN agendas a ON h.id_agenda = a.id_agenda
       JOIN profesionales_especialidades pe ON a.id_profesional = pe.id_profesional
       WHERE pe.id_profesional = ? 
         AND pe.id_especialidad = ? 
         AND h.estado = 2
         AND a.id_agenda IN (
            SELECT id_agenda 
            FROM agendas 
            WHERE id_profesional = ? AND id_profesional_especialidad = ?
         )`,
            [id_profesional, id_especialidad, id_profesional, id_especialidad]
        );
        // 👉 Horarios bloqueados
        const [bloqueos] = await conn.query(
            `SELECT bh.* 
   FROM bloqueos_horarios bh
   JOIN agendas a ON bh.id_agenda = a.id_agenda
   WHERE a.id_profesional = ? AND a.id_profesional_especialidad = ?`,
            [id_profesional, id_especialidad]
        );


        // 👉 Armar agenda combinada
        const agenda = [];

        // Turnos ocupados
        turnos.forEach(turno => {
            const horaNormalizada = normalizarHora(turno.hora);
            const fechaOriginal = new Date(turno.fecha); // ✅ Ya es Date, pero lo aseguramos
            const fechaISO = fechaOriginal.toISOString().split('T')[0]; // obtenemos '2025-07-07'
            const fechaHora = new Date(`${fechaISO}T${horaNormalizada}`); // correcta composición

            agenda.push({
                id_turno: turno.id_turno,
                fecha: '', // 👇 la vamos a rellenar luego
                hora: horaNormalizada,
                paciente: `${turno.paciente_nombre} ${turno.paciente_apellido}`,
                motivo: turno.motivo_consulta,
                estado: turno.estado,
                tipo: 'ocupado',
                timestamp: fechaHora
            });
        });

        horarios.forEach(horario => {
            const horaInicioNormalizada = normalizarHora(horario.hora_inicio);
            const horaFinNormalizada = normalizarHora(horario.hora_fin);
            const fechaOriginal = new Date(horario.fecha); // mismo caso
            const fechaISO = fechaOriginal.toISOString().split('T')[0];
            const fechaHoraInicio = new Date(`${fechaISO}T${horaInicioNormalizada}`);

            agenda.push({
                id_turno: null,
                fecha: '', // 👇 la vamos a rellenar luego
                hora: `${horaInicioNormalizada} - ${horaFinNormalizada}`,
                paciente: 'Disponible',
                motivo: 'N/A',
                estado: 'Disponible',
                tipo: 'disponible',
                timestamp: fechaHoraInicio
            });
        });
        bloqueos.forEach(bloqueo => {
            const horaInicioNormalizada = normalizarHora(bloqueo.hora_inicio);
            const horaFinNormalizada = normalizarHora(bloqueo.hora_fin);
            const fechaOriginal = new Date(bloqueo.fecha_bloqueo);
            const fechaISO = fechaOriginal.toISOString().split('T')[0];
            const fechaHoraInicio = new Date(`${fechaISO}T${horaInicioNormalizada}`);

            agenda.push({
                id_turno: null,
                fecha: '', // se rellenará luego
                hora: `${horaInicioNormalizada} - ${horaFinNormalizada}`,
                paciente: 'Bloqueado',
                motivo: bloqueo.motivo || 'Sin motivo',
                estado: 'Bloqueado',
                tipo: 'bloqueado',
                timestamp: fechaHoraInicio
            });
        });


        // Ordenar por timestamp real
        agenda.sort((a, b) => a.timestamp - b.timestamp);

        // Formatear fechas una vez ya ordenado
        agenda.forEach(item => {
            if (item.timestamp) {
                item.fecha = format(item.timestamp, 'eeee dd MMMM yyyy', { locale: es });
            } else {
                item.fecha = 'Fecha inválida';
            }
        });


        // 👉 Renderizar vista
        res.render('turnos/agenda', {
            nombre: profesionalData[0].nombre,
            apellido: profesionalData[0].apellido,
            email: profesionalData[0].email,
            especialidad: especialidadData[0],
            matricula: matriculaData[0].matricula,
            agenda
        });

    } catch (error) {
        console.error('Error al mostrar la agenda del profesional:', error);
        res.status(500).send('Error al cargar la agenda del profesional');
    }
};




//Funcion para transgerir turnos 

exports.transferTurno = async (req, res) => {
    try {
        const { id_turno } = req.query;

        // Obtener datos del turno actual
        const turnoQuery = `SELECT * FROM turnos WHERE id_turno = ?`;
        const [turnoActual] = await conn.query(turnoQuery, [id_turno]);

        // 🔹 Validar que el turno existe antes de usar sus propiedades
        if (!turnoActual || turnoActual.length === 0) {
            console.error(`Turno con ID ${id_turno} no encontrado.`);
            return res.status(404).send("El turno seleccionado no existe.");
        }

        // Buscar profesionales de la misma especialidad
        const profesionalesQuery = `
        SELECT p.* 
        FROM profesionales p
        JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
        WHERE pe.id_especialidad = ? AND p.id_profesional != ?;
      `;

        const [profesionalesDisponibles] = await conn.query(profesionalesQuery, [
            turnoActual[0].id_especialidad,
            turnoActual[0].id_profesional
        ]);



        // Buscar horarios disponibles del nuevo profesional
        const horariosQuery = `
  SELECT h.* 
  FROM horarios h
  JOIN agendas a ON h.id_agenda = a.id_agenda
  JOIN profesionales_especialidades pe ON a.id_profesional = pe.id_profesional
  WHERE pe.id_especialidad = ? 
  AND h.fecha = ? 
  AND h.estado = 'Libre'
  ORDER BY h.hora_inicio;
`;

        const [horariosDisponibles] = await conn.query(horariosQuery, [
            turnoActual[0].id_especialidad, // ✅ Asegurar que se está obteniendo correctamente
            turnoActual[0].fecha
        ]);
        res.render('turnos/transfer-turno', {

            //res.render("transfer-turno", {
            id_turno,
            profesionales_disponibles: profesionalesDisponibles,
            horarios_disponibles: horariosDisponibles
        });
    } catch (error) {
        console.error("Error al buscar turno para transferencia:", error);
        res.status(500).send("Hubo un error al transferir el turno.");
    }
};



exports.confirmTransfer = async (req, res) => {
    try {
        const { id_turno, nuevo_profesional } = req.body;

        // 🔹 Obtener datos del turno original
        const turnoQuery = `
            SELECT id_profesional, id_agenda, fecha, hora 
            FROM turnos 
            WHERE id_turno = ?;
        `;
        const [turnoActual] = await conn.query(turnoQuery, [id_turno]);

        if (!turnoActual.length) {
            console.error("Turno no encontrado.");
            return res.status(404).send("El turno seleccionado no existe.");
        }

        const { id_profesional: profesionalActual, id_agenda: agendaActual, fecha, hora } = turnoActual[0];

        // 🔹 Liberar el horario del profesional original
        const liberarHorarioQuery = `
            UPDATE horarios 
            SET estado = 'Libre', disponible = 1 
            WHERE fecha = ? AND hora_inicio = ? AND id_agenda = ?;
        `;
        await conn.query(liberarHorarioQuery, [fecha, hora, agendaActual]);

        // 🔹 Obtener la nueva agenda del profesional al que se transfiere el turno
        const nuevaAgendaQuery = `
            SELECT id_agenda FROM agendas 
            WHERE id_profesional = ? 
            LIMIT 1;
        `;
        const [nuevaAgenda] = await conn.query(nuevaAgendaQuery, [nuevo_profesional]);

        if (!nuevaAgenda.length) {
            console.error("La nueva agenda del profesional no existe.");
            return res.status(404).send("El nuevo profesional no tiene una agenda configurada.");
        }

        const nuevaAgendaId = nuevaAgenda[0].id_agenda;

        // 🔹 Verificar disponibilidad del nuevo profesional en el mismo horario
        const verificarDisponibilidadQuery = `
            SELECT id_horarios FROM horarios 
            WHERE fecha = ? AND hora_inicio = ? AND id_agenda = ? AND estado = 'Libre' 
            LIMIT 1;
        `;
        const [nuevoHorario] = await conn.query(verificarDisponibilidadQuery, [fecha, hora, nuevaAgendaId]);

        let fechaTurno = fecha;
        let horaTurno = hora;

        if (!nuevoHorario.length) {
            // 🔹 Buscar un horario cercano si el mismo horario no está disponible
            const buscarHorarioCercanoQuery = `
                SELECT id_horarios, fecha, hora_inicio FROM horarios 
                WHERE fecha = ? AND id_agenda = ? AND estado = 'Libre' 
                ORDER BY hora_inicio ASC LIMIT 1;
            `;
            const [horarioCercano] = await conn.query(buscarHorarioCercanoQuery, [fecha, nuevaAgendaId]);

            if (!horarioCercano.length) {
                console.error("No hay horarios disponibles para la transferencia.");
                return res.status(400).send("No hay horarios disponibles para el nuevo profesional.");
            }

            fechaTurno = horarioCercano[0].fecha;
            horaTurno = horarioCercano[0].hora_inicio;
        }

        // 🔹 Transferir el turno al nuevo profesional y agenda
        const actualizarTurnoQuery = `
            UPDATE turnos 
            SET id_profesional = ?, id_agenda = ?, fecha = ?, hora = ?, estado = 'Confirmado' 
            WHERE id_turno = ?;
        `;
        await conn.query(actualizarTurnoQuery, [nuevo_profesional, nuevaAgendaId, fechaTurno, horaTurno, id_turno]);

        // 🔹 Reservar el nuevo horario en la agenda del profesional receptor
        const reservarHorarioQuery = `
            UPDATE horarios 
            SET estado = 'Reservada', disponible = 0 
            WHERE fecha = ? AND hora_inicio = ? AND id_agenda = ?;
        `;
        await conn.query(reservarHorarioQuery, [fechaTurno, horaTurno, nuevaAgendaId]);

        console.log(`Turno ${id_turno} transferido de ${profesionalActual} a ${nuevo_profesional}.`);
        res.redirect("/agenda");

    } catch (error) {
        console.error("Error al confirmar transferencia:", error);
        res.status(500).send("Hubo un error al transferir el turno.");
    }
};


// Obtener horarios disponibles
exports.obtenerHorarios = async (req, res) => {
    const id_profesional = req.params.id_profesional;
    const id_especialidad = req.params.id_especialidad;
    const fechaInicio = req.params.fecha_inicio;

    try {
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + 6); // sumar 6 días
        const fechaFinISO = fechaFin.toISOString().split('T')[0];

        const [resultado] = await conn.query(`
            SELECT id_profesional, id_especialidad
            FROM profesionales_especialidades
            WHERE id_profesional = ? AND id_especialidad = ?
        `, [id_profesional, id_especialidad]);

        if (resultado.length === 0) {
            return res.status(404).json({ message: 'Relación profesional-especialidad no encontrada' });
        }

        const [horarios] = await conn.query(`
    SELECT 
        h.id_horarios,
        DATE_FORMAT(h.fecha, '%Y-%m-%d') AS fecha,  -- ← esto evita la conversión UTC
        h.hora_inicio,
        h.hora_fin,
        h.estado,
        h.disponible
    FROM horarios h
    JOIN agendas a ON h.id_agenda = a.id_agenda
    WHERE a.id_profesional = ?
      AND a.id_profesional_especialidad = (
          SELECT id_profesional_especialidad
          FROM agendas
          WHERE id_profesional = ?
          LIMIT 1
      )
      AND h.estado = 'Libre'
      AND h.fecha BETWEEN ? AND ?
    ORDER BY h.fecha, h.hora_inicio
`, [id_profesional, id_profesional, fechaInicio, fechaFinISO]);


        res.json(horarios);
    } catch (error) {
        console.error('Error al obtener horarios disponibles:', error);
        res.status(500).json({ error: 'Error al obtener horarios disponibles' });
    }
};


exports.agregarListaEspera = async (req, res) => {
    const { id_paciente, id_profesional, id_especialidad } = req.body;

    try {
        // 1. Validar existencia de la relación profesional - especialidad
        const [relacion] = await conn.query(
            `SELECT id_profesional, id_especialidad
       FROM profesionales_especialidades
       WHERE id_profesional = ? AND id_especialidad = ?`,
            [id_profesional, id_especialidad]
        );
        if (relacion.length === 0) {
            return res.status(400).json({ error: 'Relación profesional-especialidad no encontrada' });
        }

        // 2. Obtener id_profesional_especialidad e id_agenda de la tabla agendas
        const [agendaRows] = await conn.query(
            `SELECT id_profesional_especialidad, id_agenda
       FROM agendas
       WHERE id_profesional = ?
       LIMIT 1`,
            [id_profesional]
        );
        if (agendaRows.length === 0) {
            return res.status(400).json({ error: 'No se encontró una agenda para el profesional' });
        }

        const { id_profesional_especialidad, id_agenda } = agendaRows[0];

        // 3. Insertar registro en lista_espera con todos los datos necesarios
        await conn.query(
            `INSERT INTO lista_espera (
         id_paciente,
         id_profesional_especialidad,
         id_profesional,
         id_agenda
       ) VALUES (?, ?, ?, ?)`,
            [id_paciente, id_profesional_especialidad, id_profesional, id_agenda]
        );

        res.json({ mensaje: 'Paciente agregado a la lista de espera' });

    } catch (err) {
        console.error('Error al insertar en lista de espera:', err);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};

exports.verListaEspera = async (req, res) => {
    try {
        const [result] = await conn.query(`
      SELECT 
        le.id_lista_espera,
        p.nombre AS nombre_paciente,
        p.apellido AS apellido_paciente,
        p.dni,
        pr.nombre AS nombre_profesional,
        pr.apellido AS apellido_profesional,
        e.nombre AS especialidad,
        a.id_agenda
      FROM lista_espera le
      JOIN pacientes p ON le.id_paciente = p.id_paciente
      JOIN profesionales pr ON le.id_profesional = pr.id_profesional
      JOIN agendas a ON le.id_agenda = a.id_agenda
      JOIN profesionales_especialidades pe ON pe.id_profesional = pr.id_profesional
      JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
      ORDER BY a.id_agenda, pr.apellido, e.nombre
    `);

        // Agrupamos los resultados por id_agenda
        const agrupado = result.reduce((acc, item) => {
            let grupo = acc.find(g => g.id_agenda === item.id_agenda);
            if (!grupo) {
                grupo = {
                    id_agenda: item.id_agenda,
                    items: []
                };
                acc.push(grupo);
            }
            grupo.items.push(item);
            return acc;
        }, []);

        res.render('turnos/lista_espera', { listaAgrupadaPorAgenda: agrupado });

    } catch (err) {
        console.error('Error al obtener lista de espera:', err);
        res.status(500).send('Error del servidor');
    }
};




















