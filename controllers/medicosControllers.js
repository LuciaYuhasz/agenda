const conn = require('../db'); // Importa la conexión a la base de datos

//===========================================================//
// FORMULARIOS 
//===========================================================//
// Mostrar formulario para registrar un médico con datos dinámicos
exports.mostrarFormularioCrear = async (req, res) => {
    try {
        // Obtener especialidades y sucursales desde la base de datos
        const [especialidades] = await conn.query('SELECT id_especialidad, nombre FROM especialidades');
        const [sucursales] = await conn.query('SELECT id_sucursal, nombre FROM sucursales');

        // Renderizar la vista y pasar los datos
        res.render("medicos/crear", { especialidades, sucursales });
    } catch (error) {
        console.error("Error al obtener datos:", error);
        res.status(500).send("Error al cargar el formulario");
    }
};
// Mostrar formulario para modificar un médico
exports.mostrarFormularioModificar = async (req, res) => {
    const idProfesional = req.params.id;

    try {
        // Obtener datos del médico
        const [results] = await conn.execute(
            'SELECT profesionales.*, sucursales.nombre AS sucursal_nombre FROM profesionales JOIN sucursales ON profesionales.id_sucursal = sucursales.id_sucursal WHERE id_profesional = ?',
            [idProfesional]
        );

        if (results.length === 0) {
            return res.status(404).send('Médico no encontrado');
        }

        // Obtener todas las sucursales para el select
        const [sucursales] = await conn.query('SELECT id_sucursal, nombre FROM sucursales');

        res.render('medicos/modificar', { medico: results[0], sucursales });
    } catch (error) {
        console.error('Error al obtener el médico:', error);
        return res.status(500).send('Error al obtener el médico');
    }
};

// Mostrar el formulario para agregar especialidad a un médico
exports.mostrarFormularioAgregarEspecialidad = async (req, res) => {
    const idProfesional = req.params.id;  // Obtienes el ID del profesional desde la URL

    console.log("ID Profesional recibido:", idProfesional);  // Verificar si el ID llega bien

    try {
        // Obtener el profesional con ese ID
        const [medico] = await conn.execute(
            'SELECT * FROM profesionales WHERE id_profesional = ?',
            [idProfesional]
        );

        // Aquí 'medico' es un array, y 'medico[0]' te da el objeto real del profesional
        if (!medico || medico.length === 0) {
            return res.status(404).send('Médico no encontrado');
        }

        const profesional = medico[0];  // Extraemos el primer objeto del array

        // Obtener las especialidades actuales del médico
        const [especialidades] = await conn.execute(
            `SELECT e.id_especialidad, e.nombre
             FROM especialidades e
             JOIN profesionales_especialidades pe ON e.id_especialidad = pe.id_especialidad
             WHERE pe.id_profesional = ?`,
            [idProfesional]
        );

        // Obtener todas las especialidades disponibles
        const [todasEspecialidades] = await conn.execute(
            'SELECT * FROM especialidades'
        );

        // Asegúrate de que las especialidades y todasEspecialidades se están obteniendo correctamente
        console.log("Especialidades del médico:", especialidades);
        console.log("Todas las especialidades:", todasEspecialidades);

        // Renderizar la vista y pasar el objeto 'profesional' a la vista
        res.render('medicos/especialidad', {
            profesional,
            especialidades,
            todasEspecialidades
        });
    } catch (error) {
        console.error('Error al obtener datos del médico:', error);
        res.status(500).send('Error al obtener los datos del médico');
    }
};

//===========================================================//
// CRUD BÁSICO DE MÉDICOS 
//===========================================================//
// Crear nuevo médico con sus especialidades
exports.crearMedico = async (req, res) => {
    const { nombre, apellido, dni, id_sucursal, email, especialidades, matricula } = req.body;

    const connection = await conn.getConnection(); // Obtén una conexión del pool
    try {
        // Iniciar la transacción
        await connection.beginTransaction();

        // 🔍 Validar que el DNI no exista
        const [existe] = await connection.execute(
            'SELECT id_profesional FROM profesionales WHERE dni = ?',
            [dni]
        );

        if (existe.length > 0) {
            await connection.rollback();
            return res.status(400).send('Ya existe un médico con ese DNI.');
        }

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

/*exports.crearMedico = async (req, res) => {
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
};*/
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
// Activar médico (restaurar)
exports.activarMedico = async (req, res) => {
    const idProfesional = req.params.id;

    try {
        // Actualizar el estado del médico a activo (1)
        await conn.execute(
            'UPDATE profesionales SET activo = TRUE WHERE id_profesional = ?',
            [idProfesional]
        );
        res.redirect('/medicos');
        console.log('Médico activado correctamente');
    } catch (error) {
        console.error('Error al activar el médico:', error);
        res.status(500).send('Error al activar el médico');
    }
};
// Modificardatos de un medico
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

// Listar todos los médicos.. este no se si esta usandose por eso lo comento 
/*exports.listarMedicos = async (req, res) => {
    try {
        console.log("Filtro aplicado con id_sucursal:", req.session.id_sucursal);


        const [result] = await conn.execute(`
  SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
         GROUP_CONCAT(e.nombre SEPARATOR ', ') AS especialidades,
         GROUP_CONCAT(pe.matricula SEPARATOR ', ') AS matriculas
  FROM profesionales p
  LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
  LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
  LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
  WHERE p.id_sucursal = ?
  GROUP BY p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre
`, [req.session.id_sucursal]);



        res.render('medicos/listar', {
            medicos: result,
            usuario: req.session.usuario || {}
        });


    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};*/

//===========================================================//
//  GESTION DE ESPECIALIDADES 
//===========================================================//
// Agregar una nueva especialidad a un médico
exports.agregarEspecialidad = async (req, res) => {
    const idProfesional = req.params.id;  // ID del profesional desde la URL
    const { especialidadId, matricula } = req.body;  // Datos del formulario

    try {
        // Insertar la nueva especialidad en la relación profesionales_especialidades
        await conn.execute(
            'INSERT INTO profesionales_especialidades (id_profesional, id_especialidad, matricula) VALUES (?, ?, ?)',
            [idProfesional, especialidadId, matricula]
        );

        // Redirigir a la página de especialidades del médico
        //res.redirect(`/medicos/especialidad/${idProfesional}`);
        res.redirect('/medicos');
    } catch (error) {
        console.error('Error al agregar especialidad:', error);
        res.status(500).send('Error al agregar especialidad');
    }
};

// Deshabilitar una especialidad de un médico
exports.eliminarEspecialidad = async (req, res) => {
    const idProfesional = req.params.id_profesional;  // Obtener el id del profesional desde la URL
    const idEspecialidad = req.params.id_especialidad;  // Obtener el id de la especialidad desde la URL

    console.log(`idProfesional: ${idProfesional}, idEspecialidad: ${idEspecialidad}`);  // Verifica los valores recibidos

    try {
        // Verifica que ambos parámetros no sean undefined
        if (!idProfesional || !idEspecialidad) {
            return res.status(400).send('Faltan parámetros necesarios.');
        }

        // Eliminar la especialidad del médico
        await conn.execute(
            'DELETE FROM profesionales_especialidades WHERE id_profesional = ? AND id_especialidad = ?',
            [idProfesional, idEspecialidad]
        );

        // Redirigir a la página de especialidades del médico
        //res.redirect(`/medicos/especialidad/${idProfesional}`);
        res.redirect('/medicos');
    } catch (error) {
        console.error('Error al eliminar especialidad:', error);
        res.status(500).send('Error al eliminar especialidad ya que hay horarios agendados');
    }
};

//===========================================================//
//  LISTADO Y BUSQUEDA
//===========================================================//
// Obtener profesionales por especialidad para el turno desde la secreatraria pero no funciona para paciente por especilidad 
/*exports.obtenerProfesionalesPorEspecialidad = async (req, res) => {
    const idEspecialidad = req.params.id_especialidad;
    const idSucursal = req.session.id_sucursal;

    try {
        const [resultados] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.activo
            FROM profesionales p
            JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            WHERE pe.id_especialidad = ? AND p.id_sucursal = ? AND p.activo = 1
        `, [idEspecialidad, idSucursal]);

        res.json(resultados);
    } catch (error) {
        console.error('Error al consultar profesionales:', error);
        return res.status(500).send('Error al consultar profesionales');
    }
};*/
// funciona para paciente especiliad pero no para secre ( el filtro)
/*exports.obtenerProfesionalesPorEspecialidad = async (req, res) => {
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
};*/
exports.obtenerProfesionalesPorEspecialidad = async (req, res) => {
    const idEspecialidad = req.params.id_especialidad;
    const idSucursal = req.session.id_sucursal;

    try {
        let query = `
            SELECT p.id_profesional, p.nombre, p.activo
            FROM profesionales p
            JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            WHERE pe.id_especialidad = ? AND p.activo = 1
        `;
        let params = [idEspecialidad];

        // Si hay sucursal (por ejemplo, desde la secretaria), agregamos ese filtro
        if (idSucursal) {
            query += ` AND p.id_sucursal = ?`;
            params.push(idSucursal);
        }

        const [resultados] = await conn.execute(query, params);
        res.json(resultados);
    } catch (error) {
        console.error('Error al consultar profesionales:', error);
        return res.status(500).send('Error al consultar profesionales');
    }
};


// Buscar especialidades por texto (autocompletar)
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
// Obtener profesional con su especialidad específica
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
// Listar médicos activos e inactivos
exports.listarMedicos = async (req, res) => {
    try {
        const idSucursal = req.session.id_sucursal;
        const esAdmin = req.session.user?.id_rol === 1;

        console.log("Filtro aplicado con id_sucursal:", idSucursal);

        // ========================
        // 🔍 Médicos Activos
        // ========================
        let condicionesActivos = ['p.activo = 1'];
        let paramsActivos = [];

        if (!esAdmin && idSucursal !== undefined && idSucursal !== null) {
            condicionesActivos.push('p.id_sucursal = ?');
            paramsActivos.push(idSucursal);
        }

        const whereActivos = 'WHERE ' + condicionesActivos.join(' AND ');

        // ========================
        // 🔍 Médicos Inactivos
        // ========================
        let condicionesInactivos = ['p.activo = 0'];
        let paramsInactivos = [];

        if (!esAdmin && idSucursal !== undefined && idSucursal !== null) {
            condicionesInactivos.push('p.id_sucursal = ?');
            paramsInactivos.push(idSucursal);
        }

        const whereInactivos = 'WHERE ' + condicionesInactivos.join(' AND ');

        // ========================
        // 🗃️ Consulta Médicos Activos
        // ========================
        const [medicosActivos] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
                   GROUP_CONCAT(CONCAT(
                       '{ "id_especialidad": "', e.id_especialidad,
                       '", "nombre": "', e.nombre,
                       '", "matricula": "', pe.matricula, '" }')
                   ) AS especialidades
            FROM profesionales p
            LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            ${whereActivos}
            GROUP BY p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre
        `, paramsActivos);

        // ========================
        // 🗃️ Consulta Médicos Inactivos
        // ========================
        const [medicosInactivos] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
                   GROUP_CONCAT(CONCAT(
                       '{ "id_especialidad": "', e.id_especialidad,
                       '", "nombre": "', e.nombre, '" }')
                   ) AS especialidades,
                   GROUP_CONCAT(pe.matricula SEPARATOR ', ') AS matriculas
            FROM profesionales p
            LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            ${whereInactivos}
            GROUP BY p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre
        `, paramsInactivos);

        // ========================
        // 🔁 Parseo de especialidades
        // ========================
        [medicosActivos, medicosInactivos].forEach(lista => {
            lista.forEach(medico => {
                try {
                    medico.especialidades = medico.especialidades
                        ? JSON.parse(`[${medico.especialidades}]`)
                        : [];
                } catch (error) {
                    medico.especialidades = [];
                }
            });
        });

        res.render('medicos/listar', {
            medicosActivos,
            medicosInactivos
        });

    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};


/*exports.listarMedicos = async (req, res) => {
    try {
        // Consultar médicos activos
        const [medicosActivos] = await conn.execute(`
           SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
       GROUP_CONCAT(CONCAT('{ "id_especialidad": "', e.id_especialidad, '", "nombre": "', e.nombre, '", "matricula": "', pe.matricula, '" }')) AS especialidades
FROM profesionales p
LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
WHERE p.activo = 1
GROUP BY p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre
LIMIT 0, 25;

        `);
        medicosActivos.forEach(medico => {
            try {
                if (medico.especialidades) {
                    medico.especialidades = JSON.parse(`[${medico.especialidades}]`); // Convierte el string en array JSON
                } else {
                    medico.especialidades = []; // Si está vacío, asigna un array vacío
                }
            } catch (error) {
                console.error("Error al convertir especialidades:", error);
                medico.especialidades = []; // En caso de error, asigna un array vacío
            }
        });


        console.log("Médicos con especialidades procesadas:", JSON.stringify(medicosActivos, null, 2));

        // Consultar médicos inactivos
        const [medicosInactivos] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
                   GROUP_CONCAT(CONCAT('{ "id_especialidad": "', e.id_especialidad, '", "nombre": "', e.nombre, '" }')) AS especialidades,
                   GROUP_CONCAT(pe.matricula SEPARATOR ', ') AS matriculas
            FROM profesionales p
            LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE p.activo = 0
            GROUP BY p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre
        `);

        // **Transformar `especialidades` de texto a JSON válido**
        medicosInactivos.forEach(medico => {
            try {
                medico.especialidades = JSON.parse(`[${medico.especialidades}]` || '[]'); // Convierte a array
            } catch (error) {
                medico.especialidades = []; // Si hay error, asignar array vacío
            }
        });

        // Renderizar la vista con médicos activos e inactivos
        res.render('medicos/listar', {
            medicosActivos: medicosActivos,
            medicosInactivos: medicosInactivos
        });

    } catch (error) {
        console.error('Error al consultar los médicos:', error);
        res.status(500).send('Error al consultar los médicos');
    }
};
*/
// Buscar médicos por nombre, apellido o especialidad
exports.buscarMedicos = async (req, res) => {
    const query = req.query.query;
    const idSucursal = req.session.id_sucursal;
    const esAdmin = req.session.user?.id_rol === 1;

    try {
        console.log("Consulta ingresada por el usuario:", query);

        let filtros = `(p.nombre LIKE ? OR p.apellido LIKE ? OR e.nombre LIKE ?)`;
        let params = [`%${query}%`, `%${query}%`, `%${query}%`];

        if (!esAdmin && idSucursal !== undefined && idSucursal !== null) {
            filtros += ` AND p.id_sucursal = ?`;
            params.push(idSucursal);
        }

        const [filas] = await conn.execute(`
            SELECT p.id_profesional, p.nombre, p.apellido, p.dni, p.activo, p.email, s.nombre AS sucursal_nombre,
                   e.id_especialidad, e.nombre AS especialidad_nombre, pe.matricula
            FROM profesionales p
            LEFT JOIN sucursales s ON p.id_sucursal = s.id_sucursal
            LEFT JOIN profesionales_especialidades pe ON p.id_profesional = pe.id_profesional
            LEFT JOIN especialidades e ON pe.id_especialidad = e.id_especialidad
            WHERE ${filtros}
        `, params);

        // Agrupar resultados por profesional
        const resultados = [];

        for (const fila of filas) {
            let medico = resultados.find(m => m.id_profesional === fila.id_profesional);

            if (!medico) {
                medico = {
                    id_profesional: fila.id_profesional,
                    nombre: fila.nombre,
                    apellido: fila.apellido,
                    dni: fila.dni,
                    email: fila.email,
                    activo: fila.activo,
                    sucursal_nombre: fila.sucursal_nombre,
                    especialidades: [],
                    matriculas: []
                };
                resultados.push(medico);
            }

            if (fila.id_especialidad) {
                medico.especialidades.push({
                    id_especialidad: fila.id_especialidad,
                    nombre: fila.especialidad_nombre,
                    matricula: fila.matricula
                });

                if (!medico.matriculas.includes(fila.matricula)) {
                    medico.matriculas.push(fila.matricula);
                }
            }
        }

        console.log("Resultados filtrados por sucursal:", JSON.stringify(resultados, null, 2));

        if (resultados.length === 0) {
            return res.json({ error: "Profesional o especialidad no encontrados" });
        }

        res.render('medicos/listar', {
            medicosActivos: resultados.filter(m => m.activo == 1),
            medicosInactivos: resultados.filter(m => m.activo == 0)
        });

    } catch (error) {
        console.error('Error al buscar médicos:', error);
        res.status(500).send('Error al buscar médicos');
    }
};


