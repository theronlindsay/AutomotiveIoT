//Hide banner at start of script
const errorBanner = document.getElementById("invalid-form");
const successBanner = document.getElementById("valid-form");
errorBanner.hidden = true;
successBanner.hidden = true;
let editFlag = false;


//Search parameters for editing
const urlParams = new URLSearchParams(window.location.search);

//If there is an ID in the URL, set the editFlag to true
let id;
if (urlParams.has("id")) {
    editFlag = true;
    id = urlParams.get("id");

    //Setttings for FETCH API request
    let fetchSettings = {
        method: "GET",
    }

    //Send a fetch request to get the data for the phone
    fetch("../../phones/" + id, fetchSettings)
        .then((response) => {
            return new Promise((resolve) =>
                response.json().then((json) =>
                    resolve({
                        status: response.status,
                        json,
                    }),
                ),
            );
        }).then(({ status, json }) => {
            if (status === 200) {
                console.log(json.data);
                //Display the data in the form
                document.getElementById("brand").value = json.data[0].brand.toLowerCase();
                document.getElementById("name").value = json.data[0].name;
                document.getElementById("model").value = json.data[0].model;
                document.getElementById("colors").value = json.data[0].colors;
                document.getElementById("ram").value = json.data[0].memory_gb;
                document.getElementById("storage").value = json.data[0].storage_gb;
                document.getElementById("rearcam").value = json.data[0].rear_camera_mp;
                document.getElementById("frontcam").value = json.data[0].front_camera_mp;
                document.getElementById("cpu").value = json.data[0].cpu;
                document.getElementById("gpu").value = json.data[0].gpu;
                document.getElementById("battery").value = json.data[0].battery;
                document.getElementById("year").value = json.data[0].year;
                document.getElementById("price").value = json.data[0].price;
            }
        })
        .catch((error) => {
            console.error("Error:", error);
        });
}

//When submit button is clicked, send a fetch request
document.getElementById("submit")
  .addEventListener("click", (event) => {

    let brand = document.getElementById("brand").value;
    let name = document.getElementById("name").value;
    let model = document.getElementById("model").value;
    let colors = document.getElementById("colors").value;
    let ram = document.getElementById("ram").value;
    let storage = document.getElementById("storage").value;
    let rearcam = document.getElementById("rearcam").value;
    let frontcam = document.getElementById("frontcam").value;
    let cpu = document.getElementById("cpu").value;
    let gpu = document.getElementById("gpu").value;
    let battery = document.getElementById("battery").value;
    let year = document.getElementById("year").value;
    let price = document.getElementById("price").value;
    let brand_id;

    //Create a new FormData object
    const formData = new FormData();

        formData.append("operation", "add");
        switch(brand) {
            case "apple":
                brand_id = 1;
                break;
            case "samsung":
                brand_id = 2;
                break;
            case "motorola":
                brand_id = 3;
                break;
            case "oneplus":
                brand_id = 4;
                break;
            case "google":
                brand_id = 5;
                break;
            case "nokia":
                brand_id = 6;
                break;
            case "other":
                brand_id = 7;
                break;
        }
        formData.append("brand_id", brand_id);
        formData.append("name", name);
        formData.append("model", model);
        formData.append("colors", colors);
        formData.append("ram", ram);
        formData.append("storage", storage);
        formData.append("rearcam", rearcam);
        formData.append("frontcam", frontcam);
        formData.append("cpu", cpu);
        formData.append("gpu", gpu); 
        formData.append("battery", battery);
        formData.append("year", year);
        formData.append("price", price);
        console.log(formData);
        let fetchURL = "http://localhost/phones/";
        let fetchSettings;
        if (editFlag) {

            fetchURL += id; //Add the ID to the URL

            //Settings for FETCH API request
            fetchSettings = {
                method: "PUT",
                body: formData,
            };
        } else{
             //Settings for FETCH API request
            fetchSettings = {
                method: "POST",
                body: formData,
            };
        }

       
        //Send FETCH API request
        fetch(fetchURL, fetchSettings)
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

                //Error handling
                const errorMessages = document.getElementsByClassName("text-danger");
                //console.log(errorMessages);
                errorBanner.hidden = true;
                for (htmlElement of errorMessages) {
                    htmlElement.innerHTML = "&nbsp;";
                }
                if (status === 400) {
                    errorBanner.innerText = "Form has errors. Please correct them and resubmit.";
                    errorBanner.hidden = false;
                    for (error of json.errors) {
                        //console.log(error);
                        const errorId = error.path + "-error";
                        //console.log(errorId);
                        document.getElementById(errorId).innerHTML = error.msg;
                    }
                } else if (status === 500){
                    errorBanner.innerText = "Server error. Please try again later.";
                    errorBanner.hidden = false;
                } else {
                    successBanner.innerText = "Form submitted successfully.";
                    successBanner.hidden = false;
                    window.location.href = "../index.html";
                }
            })
            .catch((error) => {
                console.error("Error:", error);
            });
        return;
    }
);



document.getElementById('search').addEventListener('click', (event) => {
    window.location.href = "../index.html";
});
