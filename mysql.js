const mysql = require('mysql');

const connection = mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'jang2887',
    database: 'baseball',
});

connection.connect();

module.exports = {
    connection,
};
