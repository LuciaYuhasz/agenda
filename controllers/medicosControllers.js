const conn = require('../db'); // Importa la conexión a la base de datos

// Mostrar formulario para crear un nuevo médico
exports.mostrarFormularioCrear = (req, res) => {
    res.render("medicos/crear");
};



// Insertar un nuevo médico en la base de datos
exports.crearMedico = async (req, res) => {
    const { nombre, apellido, dni, id_sucursal, email, especialidades, matricula } = req.body;

    const connection = await conn.getConnection(); // Obtén una conexión del pool
    try {
        // Iniciar la transacción
        await connection.beginTransaction();

        // Insertar el médico en la tabla profesionales
        const [result] = await connection.execute(
            'INSERT INTO profesionales (nombre, apellido, dni, id_sucursal, email) VALUES (?, ?, ?, ?, ?)',
            [nombre, apellido, dni, id_sucursal, email]
        );

        const idProfesional = result.insertId;

        // Manejar las especialidades
        if (Array.isArray(especialidades)) {
            for (let especialidad of especialidades) {
                await connection.execute(
                    'INSERT INTO profesionales_especialidades (id_profesional, id_especialidad, matricula) VALUES (?, ?, ?)',
                    [idProfesional, especialidad, matricula]
                );
            }
        } else {
            await connection.execute(
                'INSERT INTO profesionales_especialidades (id_profesional, id_especialidad, matricula) VALUES (?, ?, ?)',
                [idProfesional, especialidades, matricula]
            );
        }

        // Confirmar la transacción
        await connection.commit();
        res.redirect('/medicos');
        console.log('Médico y especialidades insertados correctamente');
    } catch (error) {
        await connection.rollback();
        console.error('Error al crear el médico:', error);
        res.status(500).send('Error al insertar el médico');
    } finally {
        connection.release(); // Libera la conexión
    }
};


// Listar todos los médicos
exports.listarMedicos = async (req, res) => {
    try {
        const [result] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
                   GROUP_CONCAT(e.nombre SEPARATOR ', ') AS especialidades,
                   GROUP_CONCAT(pe.matricula SEPARATOR ', ') AS matriculas
            FROM profesionales p
            LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            GROUP BY p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre
        `);
        res.render('medicos/listar', { medicos: result });
    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};

// Borrar un médico (borrado lógico)
exports.eliminarMedico = async (req, res) => {
    const idProfesional = req.params.id;

    try {
        await conn.execute(
            'UPDATE profesionales SET activo = FALSE WHERE id_profesional = ?',
            [idProfesional]
        );
        res.redirect('/medicos');
        console.log('Médico eliminado correctamente (borrado lógico)');
    } catch (error) {
        console.error('Error al eliminar el médico:', error);
        res.status(500).send('Error al eliminar el médico');
    }
};

// Mostrar formulario para modificar un médico
exports.mostrarFormularioModificar = async (req, res) => {
    const idProfesional = req.params.id;

    try {
        const [results] = await conn.execute(
            'SELECT * FROM profesionales WHERE id_profesional = ?',
            [idProfesional]
        );

        if (results.length === 0) {
            return res.status(404).send('Médico no encontrado');
        }
        res.render('medicos/modificar', { medico: results[0] });
    } catch (error) {
        console.error('Error al obtener el médico:', error);
        return res.status(500).send('Error al obtener el médico');
    }
};

// Modificar un médico en la base de datos
exports.modificarMedico = async (req, res) => {
    const idProfesional = req.params.id;
    const { nombre, apellido, dni, id_sucursal, email } = req.body;

    try {
        await conn.execute(
            'UPDATE profesionales SET nombre = ?, apellido = ?, dni = ?, id_sucursal = ?, email = ? WHERE id_profesional = ?',
            [nombre, apellido, dni, id_sucursal, email, idProfesional]
        );
        res.redirect('/medicos');
        console.log('Médico modificado correctamente');
    } catch (error) {
        console.error('Error al modificar el médico:', error);
        res.status(500).send('Error al modificar el médico');
    }
};

// Obtener profesionales por especialidad
exports.obtenerProfesionalesPorEspecialidad = async (req, res) => {
    const idEspecialidad = req.params.id_especialidad;

    try {
        const [resultados] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.activo
            FROM profesionales p
            JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            WHERE pe.id_especialidad = ? AND p.activo = 1
        `, [idEspecialidad]);

        res.json(resultados);
    } catch (error) {
        console.error('Error al consultar profesionales:', error);
        return res.status(500).send('Error al consultar profesionales');
    }
};


// Controlador para buscar especialidades
exports.buscarespecialidad = async (req, res) => {
    const query = req.query.query; // Captura la consulta del usuario

    try {
        // Ejecuta la consulta para buscar especialidades
        const [especialidades] = await conn.query(
            `SELECT id_especialidad, nombre FROM especialidades WHERE nombre LIKE ?`,
            [`%${query}%`]
        );

        // Verifica si se encontraron resultados
        if (especialidades.length > 0) {
            res.json(especialidades); // Envía los resultados como JSON
        } else {
            res.status(404).json({ message: 'No se encontraron especialidades.' });
        }
    } catch (error) {
        console.error('Error al buscar especialidades:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
};




// Obtener un profesional por ID y especialidad
exports.obtenerDatosProfesional = async (req, res) => {
    const idProfesional = req.params.id_profesional; // Obtener el ID del profesional desde los parámetros de la ruta
    const idEspecialidad = req.params.id_especialidad; // Obtener el ID de la especialidad desde los parámetros de la ruta
    console.log("ID Profesional:", idProfesional);
    console.log("ID Especialidad:", idEspecialidad);
    try {
        const [result] = await conn.execute(`
            SELECT 
                p.nombre AS nombre_profesional,
                p.apellido AS apellido_profesional,
                p.dni,
                p.email,
                pe.matricula,
                e.nombre AS especialidad
            FROM 
                profesionales AS p
            JOIN 
                profesionales_especialidades AS pe ON p.id_profesional = pe.id_profesional
            JOIN 
                especialidades AS e ON pe.id_especialidad = e.id_especialidad
            WHERE 
                p.id_profesional = ? AND e.id_especialidad = ?
        `, [idProfesional, idEspecialidad]); // Ejecuta la consulta con los parámetros

        // Verifica si se encontraron resultados
        // Verifica si se encontraron resultados
        if (result.length > 0) {
            // Configura encabezados de caché para evitar respuestas almacenadas
            res.set({
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Surrogate-Control': 'no-store'
            });
            res.json(result[0]); // Devuelve el primer resultado como JSON
        } else {
            res.status(404).json({ message: 'No se encontró el profesional para la especialidad indicada.' });
        }
    } catch (error) {
        console.error('Error al obtener el profesional:', error);
        return res.status(500).send('Error al obtener el profesional');
    }
};



