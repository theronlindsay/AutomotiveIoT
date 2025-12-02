const connection = require("./connection"); //Import the connection from the connection.js file

async function selectAllRows(parameters = {}) {
    let sqlStatement = "SELECT p.id AS phone_id, b.id AS brand_id, p.*, b.* FROM Phones p INNER JOIN Brands b ON p.brand_id = b.id"; //Initial SELECT statement with INNER JOIN
    const queryParameters = [],
    whereStatements = [],
    orderByStatements = [];


    //Dynamically add ORDER BY expressions to SELECT statements if needed
    if (typeof parameters.query.sort !== 'undefined') {
        let sort = parameters.query.sort;
        if (sort === 'ASC') {
            orderByStatements.push('price ASC');
        } else if (sort === 'DESC') {
            orderByStatements.push('price DESC');
        }
    }

    //Brand ID
    if (typeof parameters.query.brand !== 'undefined' && parseInt(parameters.query.brand_id) !== 0) {
        let brand = parameters.query.brand;
        whereStatements.push('brand = ?');
        queryParameters.push(brand);
    }

    //Name
    if (typeof parameters.query.name !== 'undefined' && parseInt(parameters.query.name) !== 0) {
        let name = parameters.query.name;
        whereStatements.push('name = ?');
        queryParameters.push(name);
    }

    //Release year
    if (typeof parameters.query.release_year !== 'undefined' && parseInt(parameters.query.release_year) !== 0) {
        let year = parameters.query.release_year;
        whereStatements.push('release_year = ?');
        queryParameters.push(year);
    }

        
    //Dynamically add WHERE expressions to SELECT statements if needed
    if (whereStatements.length > 0) {
        sqlStatement += ' WHERE ' + whereStatements.join(' AND ');
    }

    //Dynamically add ORDER BY expressions to SELECT statements if needed
    if (orderByStatements.length > 0) {
        sqlStatement += ' ORDER BY ' + orderByStatements.join(', ');
    }

    //Dynamically add ORDER BY expressions to SELECT statements if needed
    if (typeof parameters.query.limit !== 'undefined' && parameters.query.limit > 0) {
        sqlStatement += ' LIMIT ' + parameters.query.limit;
    }

    return await connection.query(sqlStatement, queryParameters);
}

async function selectById(id) {
    const sqlStatement = `SELECT p.id AS phone_id, b.id AS brand_id, p.*, b.* FROM Phones p INNER JOIN Brands b ON p.brand_id = b.id WHERE p.id = ?`;
    console.log(id);
    const queryParameters = [id];
    return await connection.query(sqlStatement, queryParameters);
}

async function addRow(parameters = {}) {
    const sqlStatement = `INSERT INTO Phones (brand_id, name, release_year, price, model, colors, memory_gb, storage_gb, front_camera_mp, rear_camera_mp, cpu, gpu, battery) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const queryParameters = [parameters.brand_id, parameters.name, parameters.year, parameters.price, parameters.model, parameters.colors, parameters.ram, parameters.storage, parameters.frontcam, parameters.rearcam, parameters.cpu, parameters.gpu, parameters.battery];
    return await connection.query(sqlStatement, queryParameters);
}

async function updateRow(parameters = {}) {
    const sqlStatement = `UPDATE Phones SET brand_id = ?, name = ?, release_year = ?, price = ?, model = ?, colors = ?, memory_gb = ?, storage_gb = ?, front_camera_mp = ?, rear_camera_mp = ?, cpu = ?, gpu = ?, battery = ? WHERE id = ?`;
    const queryParameters = [parameters.body.brand_id, parameters.body.name, parameters.body.year, parameters.body.price, parameters.body.model, parameters.body.colors, parameters.body.ram, parameters.body.storage, parameters.body.frontcam, parameters.body.rearcam, parameters.body.cpu, parameters.body.gpu, parameters.body.battery, parameters.params.id];
    return await connection.query(sqlStatement, queryParameters);
}

async function deleteRow(id) {
    const sqlStatement = "DELETE FROM Phones WHERE id = ?";
    const queryParameters = [id];
    return await connection.query(sqlStatement, queryParameters);
}

module.exports = {
    selectAllRows,
    selectById,
    addRow,
    updateRow,
    deleteRow
}