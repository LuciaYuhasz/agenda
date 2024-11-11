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
        JOIN profesionales_especialidades pe ON a.id_profesional = pe.id_profesional
        WHERE pe.id_profesional = ?
        AND pe.id_especialidad = ?
        AND h.estado = 2;  -- Solo horarios disponibles
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
        // Insertar el nuevo turno
        const insertQuery = `
            INSERT INTO turnos (id_paciente, id_especialidad, id_profesional, fecha, hora, estado, motivo_consulta, sobreturno)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [insertResult] = await conn.query(insertQuery, [
            id_paciente,
            id_especialidad,
            id_profesional,
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
            WHERE pe.id_profesional = ? AND pe.id_especialidad = ? AND h.estado = 2`,
            [id_profesional, id_especialidad]
        );

        // Integrar turnos ocupados y horarios disponibles
        const agenda = [];

        // Procesar los turnos ocupados
        turnos.forEach(turno => {
            const fechaHora = `${turno.fecha} ${turno.hora}`; // Formato: YYYY-MM-DD HH:mm
            agenda.push({
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
            const fechaHoraInicio = `${horario.fecha} ${horario.hora_inicio}`; // Formato: YYYY-MM-DD HH:mm
            const fechaHoraFin = `${horario.fecha} ${horario.hora_fin}`; // Formato: YYYY-MM-DD HH:mm

            agenda.push({
                fechaHora: fechaHoraInicio, // Usamos solo la hora de inicio para el horario disponible
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






/*const { format, parseISO, isValid } = require('date-fns');
const { es } = require('date-fns/locale'); // Para español

exports.mostrarAgenda = async (req, res) => {
    try {
        const { id_profesional, id_especialidad } = req.params;

        // Obtener los datos del profesional y especialidad
        const [profesionalData] = await conn.query('SELECT * FROM profesionales WHERE id_profesional = ?', [id_profesional]);
        const [especialidadData] = await conn.query('SELECT * FROM especialidades WHERE id_especialidad = ?', [id_especialidad]);

        if (profesionalData.length === 0 || especialidadData.length === 0) {
            return res.status(404).json({ error: 'Profesional o especialidad no encontrados' });
        }

        // Obtener todos los turnos del profesional en esa especialidad
        const [turnos] = await conn.query(`
            SELECT t.*, p.nombre AS paciente_nombre, p.apellido AS paciente_apellido
            FROM turnos t
            LEFT JOIN pacientes p ON t.id_paciente = p.id_paciente
            WHERE t.id_profesional = ? AND t.id_especialidad = ?
            ORDER BY t.fecha, t.hora
        `, [id_profesional, id_especialidad]);

        // Formatear las fechas y horas de los turnos
        turnos.forEach(turno => {
            // Formateamos la fecha, que está en formato ISO 8601 (ej. "2023-12-04T03:00:00.000Z")
            if (turno.fecha) {
                try {
                    const fecha = new Date(turno.fecha); // Convertimos a un objeto Date
                    const fechaLocal = fecha.toLocaleDateString('es-AR', { // Formateamos la fecha a la zona horaria local
                        weekday: 'long', // Día de la semana completo (ej. lunes)
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    turno.fecha_formateada = fechaLocal;
                } catch (error) {
                    console.error('Error al formatear la fecha:', error);
                    turno.fecha_formateada = 'Fecha no válida';
                }
            }

            // Formateamos la hora, si está en formato "HH:mm:ss" (ej. "08:00:00")
            if (turno.hora) {
                try {
                    const fechaCompleta = new Date(turno.fecha); // Usamos la fecha original para obtener un objeto Date
                    const [horas, minutos] = turno.hora.split(':'); // Descomponemos la hora
                    fechaCompleta.setHours(horas, minutos, 0); // Establecemos la hora en el objeto Date

                    turno.hora_formateada = format(fechaCompleta, 'HH:mm'); // Formateamos la hora
                } catch (error) {
                    console.error('Error al formatear la hora:', error);
                    turno.hora_formateada = 'Hora no válida';
                }
            }
        });

        // Obtener los horarios disponibles
        const [horarios] = await conn.query(`
            SELECT h.*
            FROM horarios h
            JOIN agendas a ON h.id_agenda = a.id_agenda
            JOIN profesionales_especialidades pe ON a.id_profesional = pe.id_profesional
            WHERE pe.id_profesional = ? AND pe.id_especialidad = ? AND h.estado = 2
        `, [id_profesional, id_especialidad]);

        // Renderizar la vista con la agenda
        res.render('turnos/agenda', {
            profesional: profesionalData[0],
            especialidad: especialidadData[0],
            turnos,
            horariosDisponibles: horarios
        });

    } catch (error) {
        console.error('Error al mostrar la agenda del profesional:', error);
        res.status(500).send('Error al cargar la agenda del profesional');
    }
};*/



/*exports.crearTurno = async (req, res) => {
    console.log('Controlador crearTurno iniciado');
    const {
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


    // Validación de campos obligatorios
    if (!id_paciente || !id_especialidad || !id_profesional || !fecha || !horario || !estado) {
        console.log('Error: todos los campos son obligatorios');
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    // Validación de formato de fecha y hora
    const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
    const horaRegex = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

    // Usamos 'horario' en lugar de 'hora'
    if (!fechaRegex.test(fecha)) {
        console.log('Error: Formato de fecha incorrecto, debe ser YYYY-MM-DD');
        return res.status(400).json({ error: 'Formato de fecha incorrecto, debe ser YYYY-MM-DD' });
    }
    if (!horaRegex.test(horario)) { // Cambié 'hora' por 'horario'
        console.log('Error: Formato de hora incorrecto, debe ser HH:MM:SS');
        return res.status(400).json({ error: 'Formato de hora incorrecto, debe ser HH:MM:SS' });
    }


    try {
        // Insertar el nuevo turno
        const insertQuery = `
            INSERT INTO turnos (id_paciente, id_especialidad, id_profesional, fecha, hora, estado, motivo_consulta, sobreturno)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [insertResult] = await conn.query(insertQuery, [
            id_paciente,
            id_especialidad,
            id_profesional,
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

            // Verificar si el `UPDATE` realmente afectó alguna fila
            if (updateResult.affectedRows > 0) {
                console.log('Horario actualizado correctamente:', updateResult);
                res.status(201).json({ message: 'Turno creado y horario actualizado exitosamente' });
                //res.status(201).json({ success: true, message: 'Código creado exitosamente' });

            } else {
                console.log('No se encontró el id_horario para actualizar o no se aplicó ningún cambio');
                res.status(404).json({ error: 'No se encontró el horario para actualizar' });
            }
        } else {
            res.status(201).json({ message: 'Turno creado, pero no se proporcionó id_horario para actualizar' });
        }
    } catch (error) {
        console.error('Error al crear el turno:', error);
        res.status(500).json({ error: 'Error al crear el turno' });
    }
};*/








/*  sentencia SELECT
    a.sobreturnos_maximos - COALESCE(COUNT(t.id_turno), 0) AS sobreturnos_restantes
FROM
    agendas a
JOIN
    horarios h ON a.id_agenda = h.id_agenda
LEFT JOIN
    turnos t ON t.id_agenda = a.id_agenda AND t.sobreturno = 1 
              AND t.fecha = h.fecha -- Aseguramos que la fecha también coincida
WHERE
    h.id_agenda = 1    -- La agenda seleccionada
    AND h.id_horarios = 1   -- El horario seleccionado
    AND h.fecha = '2024-11-06' -- La fecha seleccionada
GROUP BY
    a.id_agenda;
*/





































