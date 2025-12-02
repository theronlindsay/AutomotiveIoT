//Includes the library for connecting to mySQL database
const mysql = require("mysql2/promise");

let connection = null;


//This is the method to run a parameterized SQL query
//async means that the function will always return a promise
async function query(sql, params) {
    if (null === connection){
        connection = await mysql.createConnection({
            host: "student-databases.cvode4s4cwrc.us-west-2.rds.amazonaws.com",
            user: "THERONLINDSAY",
            password: "P9cdDuUSBadzfZrLJ8RdQYPvGFrRBolPJeI",
            database: "THERONLINDSAY"
        });
    }
    console.log(mysql.format(sql, params)); // log the query to the console (for debugging)
    const [results, ] = await connection.execute(sql, params); // execute the query, await is used to wait for the promise to resolve
    return results;
}

//Allows the query function to be used in other files
module.exports = {
    query, //export the query function
}