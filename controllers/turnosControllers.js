// controllers/turnosController.js

const conn = require('../db');

// Mostrar formulario para crear un nuevo turno
exports.mostrarFormularioCrear = async (req, res) => {
    try {
        // Cargar pacientes, profesionales y especialidades
        const [pacientes] = await conn.query('SELECT * FROM pacientes');
        const [profesionales] = await conn.query('SELECT * FROM profesionales');
        const [especialidades] = await conn.query('SELECT id_especialidad, nombre FROM especialidades');

        // Parámetros necesarios para obtener horarios
        const id_profesional = req.query.id_profesional || profesionales[0].id_profesional;
        const id_especialidad = req.query.id_especialidad || especialidades[0].id_especialidad;
        const fecha = req.query.fecha || new Date().toISOString().split('T')[0]; // Fecha actual por defecto

        // Obtener todos los horarios
        const [horarios] = await conn.query('SELECT * FROM horarios');

        // Renderizar la vista del formulario de crear turno con todos los datos
        res.render('turnos/crear', {
            pacientes,
            profesionales,
            especialidades,
            horariosDisponibles: horarios,
            id_profesional,
            id_especialidad,
            fecha
        });
    } catch (error) {
        console.error('Error al mostrar formulario de creación de turno:', error);
        res.status(500).send('Error al cargar el formulario de creación de turno');
    }
};

// Obtener horarios disponibles
exports.obtenerHorarios = async (req, res) => {
    const id_profesional = req.params.id_profesional;  // ID del profesional
    const id_especialidad = req.params.id_especialidad; // ID de la especialidad

    const query = `
       SELECT h.*
FROM horarios h
JOIN agendas a ON h.id_agenda = a.id_agenda
WHERE a.id_profesional = ? -- Pedro Gutierrez
AND a.id_profesional_especialidad = ?  -- Aquí pones el id de la especialidad que deseas consultar, ej. Cardiología (1) o Pediatría (2)
AND h.estado = 'Libre'
ORDER BY h.fecha, h.hora_inicio;


    `;

    try {
        const [resultados] = await conn.query(query, [id_profesional, id_especialidad]);

        // Verificar si hay resultados
        if (resultados.length === 0) {
            return res.status(404).json({ message: 'No se encontraron horarios disponibles' });
        }

        res.json(resultados);
    } catch (error) {
        console.error('Error al obtener horarios disponibles:', error);
        res.status(500).json({ error: 'Error al obtener horarios disponibles' });
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

exports.mostrarAgenda = async (req, res) => {
    try {
        const { id_profesional, id_especialidad } = req.params;

        // Obtener los datos del profesional (nombre, apellido, email)
        const [profesionalData] = await conn.query(
            'SELECT p.nombre, p.apellido, p.email ' +
            'FROM profesionales p ' +
            'WHERE p.id_profesional = ?',
            [id_profesional]
        );

        // Obtener la matrícula del profesional asociada a la especialidad
        const [matriculaData] = await conn.query(
            'SELECT pe.matricula ' +
            'FROM profesionales_especialidades pe ' +
            'WHERE pe.id_profesional = ? AND pe.id_especialidad = ?',
            [id_profesional, id_especialidad]
        );

        // Obtener los datos de la especialidad
        const [especialidadData] = await conn.query(
            'SELECT * FROM especialidades WHERE id_especialidad = ?',
            [id_especialidad]
        );

        // Verificar que los datos no estén vacíos
        if (profesionalData.length === 0 || especialidadData.length === 0 || matriculaData.length === 0) {
            return res.status(404).json({ error: 'Profesional o especialidad no encontrados' });
        }

        // Obtener todos los turnos ocupados
        const [turnos] = await conn.query(
            `SELECT t.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
            FROM turnos t
            LEFT JOIN pacientes p ON t.id_paciente = p.id_paciente
            WHERE t.id_profesional = ? AND t.id_especialidad = ? 
            ORDER BY t.fecha, t.hora`,
            [id_profesional, id_especialidad]
        );

        // Obtener los horarios disponibles
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
  );`, [id_profesional, id_especialidad, id_profesional, id_especialidad]

        );

        // Integrar turnos ocupados y horarios disponibles
        const agenda = [];
        // Procesar los turnos ocupados
        turnos.forEach(turno => {
            const fechaHora = `${turno.fecha} ${turno.hora}`;
            agenda.push({
                id_turno: turno.id_turno, // ✅ Agregar ID del turno
                fechaHora,
                fecha: format(new Date(turno.fecha), 'eeee dd MMMM yyyy', { locale: es }),
                hora: turno.hora,
                paciente: `${turno.paciente_nombre} ${turno.paciente_apellido}`,
                motivo: turno.motivo_consulta,
                estado: turno.estado,
                tipo: 'ocupado' // Turno ocupado
            });
        });

        // Procesar los horarios disponibles
        horarios.forEach(horario => {
            const fechaHoraInicio = `${horario.fecha} ${horario.hora_inicio}`;
            const fechaHoraFin = `${horario.fecha} ${horario.hora_fin}`;

            agenda.push({
                id_turno: null, // ✅ No tiene ID de turno porque es un horario disponible
                fechaHora: fechaHoraInicio,
                fecha: format(new Date(horario.fecha), 'eeee dd MMMM yyyy', { locale: es }),
                hora: `${horario.hora_inicio} - ${horario.hora_fin}`,
                paciente: 'Disponible',
                motivo: 'N/A',
                estado: 'Disponible',
                tipo: 'disponible' // Horario disponible
            });
        });


        // Ordenar la agenda por fechaHora
        agenda.sort((a, b) => a.fechaHora.localeCompare(b.fechaHora)); // Ordenamos lexicográficamente

        // Ahora pasamos directamente los datos a la vista

        console.log({
            nombre: profesionalData[0].nombre,
            apellido: profesionalData[0].apellido,
            email: profesionalData[0].email,
            especialidad: especialidadData[0],
            matricula: matriculaData[0].matricula,
            agenda: agenda
        });
        res.render('turnos/agenda', {
            nombre: profesionalData[0].nombre,
            apellido: profesionalData[0].apellido,
            email: profesionalData[0].email,    // Pasa el correo directamente
            especialidad: especialidadData[0],  // Especialidad: contiene el nombre de la especialidad
            matricula: matriculaData[0].matricula,  // Matrícula: que estamos obteniendo
            agenda: agenda // La agenda combinada de turnos
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








































