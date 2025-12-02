const isEmpty = (obj) => Object.keys(obj).length === 0;

function displayTable() {
    const queryParams = {};

    queryParams['limit'] = 100;
    
        queryParams['name'] = '';    
        queryParams['brand'] = '';    
        queryParams['release_year'] = '';  
        queryParams['sort'] = ''; 

    //Settings for FETCH API request
    let fetchSettings = {
        method: "GET",
    };
    
    //Send FETCH API request
    fetch("../phones/" + (!isEmpty(queryParams) ? '?' + new URLSearchParams(queryParams) : ''), fetchSettings)
        .then((response) => {
            return new Promise((resolve) =>
                response.json().then((json) =>
                    resolve({
                        status: response.status,
                        json,
                    }),
                ),
            );
        })
        //Logic to display errors on form
        .then(({ status, json }) => {
            if (status === 200) {
                let displayTable =
                    "<table>" +
                    "<thead>" +
                    "<tr>" +
                    '<th width="2%">ID</th>' +
                    '<th width="7%">Brand</th>' +
                    '<th width="7%">Name</th>' +
                    '<th width="7%">Model</th>' +
                    '<th width="25%">Colors</th>' +
                    '<th width="2%">Max Memory</th>' +
                    '<th width="2%">Max Storage</th>' +
                    '<th width="5%">Rear Camera</th>' +
                    '<th width="5%">Front Camera</th>' +
                    '<th width="12%">CPU</th>' +
                    '<th width="10%">GPU</th>' +
                    '<th width="7%">Battery Capacity</th>' +
                    '<th width="6%">Release Year</th>' +
                    '<th width="4%">Price</th>' +
                    '<th width="7%">Edit</th>' +
                    "</tr>" +
                    "</thead>" +
                    "<tbody>";
                if (typeof json.data !== "undefined") {
                    for (row of json.data) {
                        displayTable +=
                            "<tr>" +
                            "<td>" +
                            row.phone_id +
                            "</td>" +
                            "<td>" +
                            row.brand +
                            "</td>" +
                            "<td>" +
                            row.name +
                            "</td>" +
                            "<td>" +
                            row.model +
                            "</td>" +
                            "<td>" +
                            row.colors +
                            "</td>" +
                            "<td>" +
                            row.memory_gb +
                            "gb" +
                            "</td>" +
                            "<td>" +
                            row.storage_gb +
                            "gb" +
                            "</td>" +
                            "<td>" +
                            row.rear_camera_mp +
                            "MP" +
                            "</td>" +
                            "<td>" +
                            row.front_camera_mp +
                            "MP" +
                            "</td>" +
                            "<td>" +
                            row.cpu +
                            "</td>" +
                            "<td>" +
                            row.gpu +
                            "</td>" +
                            "<td>" +
                            row.battery +
                            "mAh" +
                            "</td>" +
                            "<td>" +
                            row.release_year +
                            "</td>" +
                            "<td>" +
                            "$" +
                            row.price +
                            "</td>" +
                            "<td>" +
                            '<a href ="./delete.html?id=' +
                            row.phone_id +
                            `">Delete</a>` +
                            ' <a style = "background-color: #383838" href ="./Form/form.html?id=' +
                            row.phone_id +
                            `">Edit</a>` +
                            "</td>" +
                            "</tr>";
                    }
                }
                displayTable += "</tbody></table>";
                document.getElementById("phones").innerHTML =
                    displayTable;
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
    return;
}