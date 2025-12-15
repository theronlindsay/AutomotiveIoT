//Includes the library for connecting to mySQL database
const mysql = require("mysql2/promise");


const pool = mysql.createPool({
    host: "student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com",
    user: "THERONLINDSAY",
    password: "P9cdDuUSBadzfZrLJ8RdQYPvGFrRBolPJeI",
    database: "THERONLINDSAY",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});


//This is the method to run a parameterized SQL query
//async means that the function will always return a promise
async function query(sql, params) {
    const [results] = await pool.execute(sql, params);
    return results;
}

//Allows the query function to be used in other files
module.exports = {
    query, //export the query function
}