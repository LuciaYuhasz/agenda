
const mysql = require('mysql2/promise');

//const conn = mysql.createConnection({
const conn = mysql.createPool({
  host: 'localhost', // Cambia esto si es necesario
  user: 'root',      // Tu usuario de MySQL
  password: '',      // Tu contraseña de MySQL
  database: 'agendas' // Nombre de tu base de datos
});

console.log('Conectado a la base de datos MySQL');
module.exports = conn;


/*
const mysql = require('mysql2/promise');

// Crear una conexión con los datos de Clever Cloud
const conn = mysql.createPool({
    host: 'bt1yrqwcgxaixbapvhrm-mysql.services.clever-cloud.com', // Host de Clever Cloud
    user: 'ufsaj9zhcdsxfefb', // Usuario
    password: 'eXKKJw1auuVKvNbeThJI', // Contraseña (la que aparece en tu panel de Clever Cloud)
    database: 'bt1yrqwcgxaixbapvhrm', // Nombre de la base de datos
    port: 3306, // Puerto (el que se muestra en tu panel de Clever Cloud)
    waitForConnections: true, // Esta opción mejora la eficiencia de las conexiones
    connectionLimit: 10, // Número de conexiones concurrentes
    queueLimit: 0 // Sin límite de cola de conexiones
});


console.log('Conectado a la base de datos MySQL');
module.exports = conn;*/







//        netstat -ano | findstr :3000

//           taskkill /PID 204044 /F

