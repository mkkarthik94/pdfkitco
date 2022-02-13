require('dotenv').config();
const mysql = require('mysql2');

// Setup database connection parameter
exports.initialize_SQL_DB = mysql.createConnection({
    host: process.env.AWS_MYSQL_HOST,
    user: process.env.AWS_MYSQL_USER,
    password: process.env.AWS_MYSQL_PASSWORD,
    database: process.env.AWS_MYSQL_DATABASE,
});

// exports.initialize_SQL_DB = mysql.createConnection({
//     host: 'pdfkit-co.ccgjb7pqtyg4.ap-south-1.rds.amazonaws.com',
//     port: '3306',
//     user: 'admin',
//     password: 'abcd1234!',
//     database: 'usersDB',
// });

// Checks User Sessions
exports.check_Login = (req, res, next) => { 
    if(req.user) next(); else return res.json({ error: "User Not Logged In!" });
}