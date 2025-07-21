if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(registration => {
        console.log("SW Registered!");
        console.log(registration);
    }).catch(error => {
        console.log("SW Registration Failed!");
        console.log(error);
    })
}


if (window.matchMedia("(min-width: 300px)").matches) {
    connectDevice();
} else {
    let errorText = document.createElement("p");
    errorText.innerHTML = "Window size error - open page on wider device.";
    errorText.style = "text-align: center; color: black; margin: 0; padding: 0; width: 70%;";
    document.body.style = "width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center;";
    document.body.innerHTML = "";
    document.body.append(errorText);
}

var primeColor = "#aa0000";

var lastMarker = {};
var lastMarkerObject = {};
var dataBuffer = ""; // Буфер для об'єднання неповних пакетів

var maxAllowedZoom = 17;
var map = L.map(document.getElementById("osm-map"), { maxZoom: maxAllowedZoom });

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

map.setView([49.834956, 24.014456], 14);


// Глобальні іконки маркерів
var globalMarkerIcon = L.icon({
    iconUrl: "images/marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

var globalAlertIcon = L.icon({
    iconUrl: "images/alert_marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

var globalBlueMarkerIcon = L.icon({
    iconUrl: "images/blue_marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

var globalBlueAlertIcon = L.icon({
    iconUrl: "images/blue_alert_marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

// Отримуємо параметр test з URL
const urlParams = new URLSearchParams(window.location.search);
const testMode = urlParams.get('test') === 'true';

// Додано функцію getUserData
function getUserData() {
    // Ваша логіка тут
    console.log("User data loaded");
    // Наприклад:
    return {
        id: "500001",
        name: "Test User"
    };
}

const SERVICE_UUID = "a066b5b0-c522-4aa9-b148-8f24f37fcba6";
const CHARACTERISTIC_UUID = "d792d09f-1d6e-422b-991a-e2933e7d848b";
var bluetoothDeviceDetected
var gattCharacteristic
let bleDataBuffer = "";
let mentorId = null;

function connectDevice() {
    document.getElementById("portConnectScreen").addEventListener("click", async () => {
        Notification.requestPermission().then(perm => {
            if (perm === "granted") {
                console.log("Notifications are allowed!")
            } else {
                console.log("Permission is denied.")
            }
        });
        if (navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({
                        type: "delayed-notification",
                        message: "Минуло 2 секунди після запуску зчитування!",
                        delay: 2000
                    });
                } else {
                    console.log("No active service worker to send message to.");
                }
        document.getElementById("portConnectScreen").style = "top: 100%;";
        document.getElementById("showCacheAreaBtn").style.display = "block";
        document.getElementById('showCacheAreaBtn').addEventListener('click', showCachedRectangle);
    
        document.getElementById("read").style.display = "block";
        document.getElementById("read").addEventListener("click", function () {
            if (isWebBLEavailable()) {
                read();
            }
        });
        document.getElementById("start").style.display = "block";
        document.getElementById("start").addEventListener("click", function(event) {
            if (isWebBLEavailable()) { start() }
        });
        document.getElementById("stop").style.display = "block";
        document.getElementById("stop").addEventListener("click", function(event) {
            if (isWebBLEavailable()) { stop() }
        });
        
        getUserData();

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                position => {
                    const { latitude, longitude } = position.coords;
                    map.setView([latitude, longitude], maxAllowedZoom);
                },
                error => {
                    console.error("Geolocation in not available:", error);
                    alert("Cannot get geolocation");
                }
            );
        } else {
            alert("Browser does not support geolocation!");
        }

        showCacheInstructionAndEnableDrawing();

        document.getElementById("showTableBtn").style.display = "block";
        document.getElementById("addDeviceBtn").style.display = "block";
        document.getElementById("deleteDeviceBtn").style.display = "block";
        document.getElementById("clearDataBtn").style.display = "block";

        document.getElementById("showTableBtn").addEventListener("click", () => {
            const container = document.getElementById("deviceTableContainer");
            container.style.display = (container.style.display === "none") ? "block" : "none";
        });

        document.getElementById("addDeviceBtn").addEventListener("click", () => {
            addTableRow();
        });
        
        document.getElementById("deleteDeviceBtn").addEventListener("click", () => {
            const tableBody = document.getElementById("devicesTable").getElementsByTagName('tbody')[0];
            const rows = tableBody.getElementsByTagName('tr');

            if (rows.length > 1) {
                tableBody.deleteRow(rows.length - 1);
            } else {
                console.log("Неможливо видалити останній рядок.");
                }
            });

        document.getElementById("clearDataBtn").addEventListener("click", async ()=> {
            await db.devices.clear();
            await db.points.clear();
            await db.tiles.clear();

            const tableBody = document.getElementById("devicesTable").getElementsByTagName('tbody')[0];
            tableBody.innerHTML = "";

            Object.values(lastMarkerObject).forEach(m => map.removeLayer(m));
            Object.values(allPolylines).forEach(lines => {
                lines.forEach(line => map.removeLayer(line));
            });

            Object.keys(lastMarker).forEach(key => delete lastMarker[key]);
            Object.keys(lastMarkerObject).forEach(key => delete lastMarkerObject[key]);
            Object.keys(allPolylines).forEach(key => delete allPolylines[key]);
            

        });
        
        await restoreTableFromDB();
        await restorePointsFromDB();

        // if (testMode) {
        //     console.log("Starting test mode...");
        //     startTestMode();
        // } else {
        //     try {
        //         await connectBLEDevice();
        //     } catch (error) {
        //         console.error("BLE connection error:", error);
        //         alert("Не вдалося підключитися до BLE пристрою.");
        //     }
        // }
    });
}

function addTableRow(afterRow = null) {
    const table = document.getElementById("devicesTable").getElementsByTagName('tbody')[0];

    let newRow;
    if (afterRow) {
        newRow = table.insertRow(afterRow.rowIndex);
    } else {
        newRow = table.insertRow();
    }
        
    const cellId = newRow.insertCell(0);
    const cellName = newRow.insertCell(1);
    const cellAction = newRow.insertCell(2);
        
    const inputId = document.createElement("input");
    inputId.type = "text";
    inputId.placeholder = "Введіть ID пристрою";
        
    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.placeholder = "Введіть дані";

    inputId.addEventListener("change", () => {
        const id = inputId.value.trim();
        const name = inputName.value.trim();
        if (id) saveDeviceToDB(id, name);
    });

    inputName.addEventListener("change", () => {
        const id = inputId.value.trim();
        const name = inputName.value.trim();
        if (id) saveDeviceToDB(id, name);
    });
    
    const actionSelect = createActionSelect(newRow, inputId);

    cellId.appendChild(inputId);
    cellName.appendChild(inputName);
    cellAction.appendChild(actionSelect);
}

function createActionSelect(newRow, inputId) {
    const table = document.getElementById("devicesTable").getElementsByTagName('tbody')[0];

    const actionSelect = document.createElement("select");
    const optionDefault = document.createElement("option");
    optionDefault.value = "";
    optionDefault.textContent = "Виберіть дію";
    optionDefault.selected = true;
    optionDefault.disabled = true;

    const optionView = document.createElement("option");
    optionView.value = "view";
    optionView.textContent = "Переглянути дані";

    const optionAdd = document.createElement("option");
    optionAdd.value = "add";
    optionAdd.textContent = "Додати рядок";

    const optionDelete = document.createElement("option");
    optionDelete.value = "delete";
    optionDelete.textContent = "Видалити рядок";

    actionSelect.appendChild(optionDefault);
    actionSelect.appendChild(optionView);
    actionSelect.appendChild(optionAdd);
    actionSelect.appendChild(optionDelete);

    actionSelect.addEventListener("change", () => {
        const selectedAction = actionSelect.value;
        const deviceId = inputId.value.trim();

        switch (selectedAction) {
            case "view":
                if (deviceId && lastMarkerObject[deviceId]) {
                    lastMarkerObject[deviceId].openPopup();
                    map.panTo(lastMarker[deviceId]);
                } else {
                    console.log("Маркер не знайдено для ID: ", deviceId);
                }
                break;

            case "add":
                addTableRow(newRow);
                break;

            case "delete":
                table.deleteRow(newRow.rowIndex - 1);
                break;

        }
        actionSelect.value = "";
    });

    return actionSelect;
}

function isWebBLEavailable() {
    if (!navigator.bluetooth) {
        console.log("Web Bluetooth is not available")
        return false
    }
    console.log("Bluetooth is available")
    return true
    
}

function getDeviceInfo() {
    if (bluetoothDeviceDetected?.gatt?.connected) {
        bluetoothDeviceDetected.gatt.disconnect();
        console.log("Попередній пристрій відключено.");
    }
    bluetoothDeviceDetected = null;
    gattCharacteristic = null;
    
    
    let options = {
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID]
    }

    console.log("Request BLE device info...")
    return navigator.bluetooth.requestDevice(options).then(device => {
        console.log("Name: " + device.name)
        bluetoothDeviceDetected = device
    }).catch(error => {
        console.log("Request device error:" + error)
    })
}

function read() {
    return getDeviceInfo()
    .then(connectGATT)
    .then(_ => {
        console.log("Reading data...")
        return gattCharacteristic.readValue()
    })
    .catch(error => {
        console.log("Waiting to start reading: " + error)
    })
}

function connectGATT() {
    if (!bluetoothDeviceDetected.gatt) { // Додати перевірку
        return Promise.reject("GATT server not available");
    }
    if (bluetoothDeviceDetected.gatt.connect && gattCharacteristic) {
        return Promise.resolve()
    }

    return bluetoothDeviceDetected.gatt.connect()
    .then(server => {
        console.log("Getting GATT Service...")
        return server.getPrimaryService(SERVICE_UUID)
    })
    .then(service => {
        console.log("Getting GATT Characteristic...")
        return service.getCharacteristic(CHARACTERISTIC_UUID)
    })
    .then(characteristic => {
        gattCharacteristic = characteristic
        gattCharacteristic.addEventListener("characteristicvaluechanged", handleChangedValue)

        document.getElementById("start").disabled = false
        document.getElementById('stop').disabled = true
    }) 
}

function handleChangedValue(event) {
    let value = event.target.value;
    const decoder = new TextDecoder('utf-8');
    const chunk = decoder.decode(value);
    bleDataBuffer += chunk;
    processBLEBufferedData();
}

function start() {
    gattCharacteristic.startNotifications()
    .then(_ => {
        console.log("Start reading...")
        document.getElementById("start").disabled = true
        document.getElementById('stop').disabled = false
    })
    .catch(error => {
        console.log("[ERROR] Start: " + error)
    })
}

function stop() {
    gattCharacteristic.stopNotifications()
    .then(_ => {
        console.log("Stop reading...")
        document.getElementById("start").disabled = false
        document.getElementById('stop').disabled = true
    })
    .catch(error => {
        console.log("[ERROR] Stop: " + error)
    })
}


function processBLEBufferedData() {
    let start = bleDataBuffer.indexOf('{');
    let end = bleDataBuffer.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        const jsonString = bleDataBuffer.substring(start, end + 1);
        try {
            const data = JSON.parse(jsonString);
            processBLEJsonData(data);
        } catch (e) {
            console.error('BLE JSON parse error:', e);
        }
        bleDataBuffer = bleDataBuffer.slice(end + 1);
    }
}

function getAllowedDeviceIds() {
    const table = document.getElementById("devicesTable").getElementsByTagName("tbody")[0];
    const rows = table.getElementsByTagName("tr");

    const allowedIds = new Set();

    for (let row of rows) {
        const inputId = row.getElementsByTagName("input")[0]?.value.trim();
        if (inputId) {
            allowedIds.add(inputId);
        }
    }

    return allowedIds;
}

function processBLEJsonData(data) {
    if (
        data &&
        data.from &&
        data.packet &&
        data.packet.decoded &&
        data.packet.decoded.payload
     ) {
        const allowedIds = getAllowedDeviceIds();
        const id = data.from.toString();

        if (!allowedIds.has(id)) {
            console.warn("Пристрій не у списку дозволених:", id);
            return;
        }

        const payload = data.packet.decoded.payload;
        const x = payload.latitude_i / 1e7;
        const y = payload.longitude_i / 1e7;
        const battery = payload.battery_level;
        const SOS = (payload.position_flags & 0x02) > 0;
        const currentTime = getCurrentTime();
        
        if (id == "500001") {
            mentorId = id;
            console.log("Визначено ID наставника:", mentorId);
        }
        drawNewPoint(x, y, currentTime, SOS, id, battery);
    }
}


// // Змінюємо частоту оновлення координат (наприклад, кожні 5 секунд)
// const updateInterval = 5000; // 5 секунд

// // Функція для початку тестового режиму
// function startTestMode() {
//     // Імітуємо отримання даних з трекера
//     setInterval(() => {
//         // Генеруємо випадкові координати
//         const lat = 49.83 + (Math.random() * 0.02);
//         const lng = 24.01 + (Math.random() * 0.02);
//         const sos = Math.random() < 0.2; // Імітуємо SOS з певною ймовірністю
//         const id = "TEST" + Math.floor(Math.random() * 10);

//         // Створюємо тестовий пакет даних
//         const testData = `${sos ? 's' : 'o'}${id},${lat},${lng}`;
//         console.log("Simulating data:", testData);
//         dataBuffer += testData;
//         processBufferedData();
//     }, updateInterval); // Відправляємо дані кожні 5 секунд
// }

// function processBufferedData() {
//     const packets = dataBuffer.split(/(?=s|o)/); // Розділяємо дані за SOS або ID
//     dataBuffer = packets.pop(); // Останній неповний пакет залишаємо в буфері

//     packets.forEach((packet) => {
//         const parsedData = parseDataString(packet);
//         if (parsedData) {
//             const { id, x, y, SOS, currentTime } = parsedData;
//             // callSOS(SOS, currentTime, [x, y], id);
//             drawNewPoint(x, y, currentTime, SOS, id, battery);
//         } else {
//             console.log(`Ignored data: ${packet}`);
//         }
//     });
// }

// function parseDataString(str) {
//     try {
//         const [SOS_ID, x, y] = str.split(",");
//         const SOS = SOS_ID[0];
//         const id = SOS_ID.slice(1);

//         if (checkCoordinatesFormat(x, y) && (SOS === "s" || SOS === "o")) {
//             const currentTime = getCurrentTime();
//             return { id, x: parseFloat(x), y: parseFloat(y), SOS: SOS === "s", currentTime };
//         }
//     } catch (error) {
//         console.error("Error parsing data string:", error);
//     }
//     return null;
// }

function checkCoordinatesFormat(x, y) {
    return !isNaN(x) && !isNaN(y) && x.length > 0 && y.length > 0;
}

function getCurrentTime() {
    var currentDate = new Date();
    return (
        currentDate.getHours() +
        ":" +
        currentDate.getMinutes() +
        ":" +
        currentDate.getSeconds() +
        " " +
        currentDate.getDate() +
        "." +
        (currentDate.getMonth() + 1) +
        "." +
        currentDate.getFullYear()
    );
}

// function callSOS(SOS, time, coords, id) {
//     const alertElement = document.getElementById("alert");

//     if (SOS) {
//         console.log(`SOS from ${id} at ${time}`);
//         alertElement.style.bottom = "15px"; // Показуємо повідомлення
//         alertElement.innerHTML = `SOS from ${id}!`;

//         if (!alertElement.hasClickListener) {
//             alertElement.addEventListener("click", () => {
//                 map.flyTo(coords, maxAllowedZoom);
//             });
//             alertElement.hasClickListener = true;
//         }
//     } else {
//         console.log(`SOS deactivated for ${id}`);
//         alertElement.style.bottom = "-100%"; // Приховуємо повідомлення
//     }
// }

const allPolylines = {};

function drawNewPoint(x, y, currentTime, SOS, id, battery) {
    console.log(`%c${currentTime} Device: ${id}, ${x}; ${y} - ${SOS ? "SOS" : "No SOS"}`, 'background: #900000; color: #fff');

    // Додаємо перевірку та округлення координат
    console.log("x:", x, typeof x, "y:", y, typeof y);

    const roundedX = parseFloat(x.toFixed(6));
    const roundedY = parseFloat(y.toFixed(6));

    var newMarker = L.latLng(roundedX, roundedY);

    const isSpecialId = id === mentorId;
    const currentMarkerIcon = isSpecialId
        ? (SOS ? globalBlueAlertIcon : globalBlueMarkerIcon)
        : (SOS ? globalAlertIcon : globalMarkerIcon);

    const lineColor = isSpecialId ? "#0000aa" : primeColor;

   

    if (lastMarkerObject[id] && lastMarker[id]) {
        var markerLine = new L.Polyline([newMarker, lastMarker[id]], {
            color: lineColor,
            weight: 3,
            opacity: 0.8,
            smoothFactor: 1,
        });
        markerLine.addTo(map);
        map.removeLayer(markerLine);
        if (!allPolylines[id]) allPolylines[id] = [];
        allPolylines[id].push(markerLine);
        map.removeLayer(lastMarkerObject[id]);
    }

    var newMarkerObject = L.marker(newMarker, { icon: currentMarkerIcon });

    let fullName = "(не вказано)";
    const tableRows = document.getElementById("devicesTable").getElementsByTagName("tbody")[0].getElementsByTagName("tr");

    for (let row of tableRows) {
        const inputId = row.getElementsByTagName("input")[0].value.trim();
        if (inputId === id) {
            fullName = row.getElementsByTagName("input")[1].value.trim() || fullName;
            break;
        }
    }
    
    newMarkerObject.bindPopup(`<b>Friendly-name: </b>${id};<br>
        <b>Ім'я та прізвище: </b>${fullName};<br>
        <b>Координати: </b>${roundedX}, ${roundedY}; <br>
        <b>Заряд акумулятора: </b>${battery}%;<br>
        <b>Час: </b>${currentTime};<br>
        <button id="popupPathBtn-${id}">Переглянути шлях </button>` );
    
    
        newMarkerObject.on("popupopen", function() {
        const btn = document.getElementById(`popupPathBtn-${id}`);
        if (btn) {
            btn.addEventListener("click", function () {
                console.log(`popupPathBtn-${id}`);
        
                const isVisible = allPolylines[id] && allPolylines[id].length > 0 && map.hasLayer(allPolylines[id][0]);
                Object.entries(allPolylines).forEach(([deviceId, lines]) => {
                    if (Array.isArray(lines)) {
                        lines.forEach(line => {
                            if (map.hasLayer(line)) map.removeLayer(line);
                        });
                    }
                });

                if (!isVisible && allPolylines[id]) {
                allPolylines[id].forEach(line => map.addLayer(line));
                }
            });
        }
    });
    //     Object.entries(allPolylines).forEach(([deviceId, line]) => {
    //         if (hideOthers) {
    //             if (deviceId != id) map.removeLayer(line);
    //             else map.addLayer(line);
    //         } else {
    //             map.addLayer(line);
    //         }
    //     });
    // });

    // if (isSpecialId) {
    //     newMarkerObject.on("mousedown", onMentorMarkerClick); // Початок створення зони
    // }
    newMarkerObject.addTo(map);

    lastMarker[id] = newMarker;
    lastMarkerObject[id] = newMarkerObject;
    
    checkDevicePosition(id, roundedX, roundedY); // Передаємо округлені координати
    db.points.add({
        deviceId: id,
        x: roundedX,
        y: roundedY,
        time: currentTime,
        battery: battery,
        sos: SOS
    });
}

var drawnFeatures = new L.FeatureGroup();
map.addLayer(drawnFeatures);

var userPoligonZones = [];
var drawControl = new L.Control.Draw({
    draw: {
        polygon: true,
        rectangle: false,
        circle: false,
        marker: false,
        polyline: false
    },
    edit: {
        featureGroup: drawnFeatures,
        remove: false
    }
});
map.addControl(drawControl);

map.on("draw:created", function (e) {
    var layer = e.layer;
    drawnFeatures.addLayer(layer)
    var zonesCoords = layer.getLatLngs()[0].map(coord => [coord.lat, coord.lng]);
    userPoligonZones.push(zonesCoords);
});

function isInPolygon(point, polygon) {
    var x = point[0], y = point[1];
    var inside = false;
    for (var i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        var xi = polygon[i][0], yi = polygon[i][1];
        var xj = polygon[j][0], yj = polygon[j][1];

        var intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function checkDevicePosition(id, x, y) {
    let insideAnyZone = false;

    // Перевірка статичних полігональних геозон
    if (userPoligonZones.length > 0) {
        userPoligonZones.forEach(zone => {
            if (isInPolygon([x, y], zone)) {
                insideAnyZone = true;
            }
        });
    }

    // Перевірка мобільної геозони наставника (перевіряємо, чи зона створена)
    // if (id !== mentorId) {
        // if (!isInMobileZone({ lat: x, lng: y })) {
        //     alertElement.innerHTML = `${id} has left the mobile zone!`;
        //     alertElement.style.top = "15px";
        //     alertElement.style.left = "300px";
        // }
    

    // Якщо не в жодній зоні та статичні зони існують, показуємо сповіщення
    if (!insideAnyZone && userPoligonZones.length > 0) {
        const alertElement = document.getElementById("alert");
        alertElement.innerHTML = `${id} has left the static polygon zone!`;
        alertElement.style.top = "15px";
        alertElement.style.left = "300px";
        setTimeout(() => {
            alertElement.style.top = "-100%";
        }, 3000);
        
    }
}

let cachedRectangleLayer = null;
function showCacheInstructionAndEnableDrawing() {
    const alertElement = document.getElementById("alert");
    alertElement.style.left = "15px";
    alertElement.style.right = "";
    alertElement.style.top = "";
    alertElement.style.bottom = "15px";
    alertElement.innerHTML = "Закешуйте територію, намалювавши прямокутник";

    // Ініціалізуємо інструмент малювання тільки прямокутника
    const drawControlCasche = new L.Control.Draw({
        draw: {
            polyline: false,
            polygon: false,
            circle: false,
            marker: false,
            circlemarker: false,
            rectangle: {
                shapeOptions: {
                    color: 'blue'
                }
            }
        },
        edit: false
    });

    map.addControl(drawControlCasche);

    map.once(L.Draw.Event.CREATED, async function (event) {
        const drawnRectangle = event.layer;
        const bounds = drawnRectangle.getBounds();
        cacheBounds = bounds; // Зберігаємо для перегляду!
        map.removeLayer(drawnRectangle); // Прибираємо прямокутник після малювання
        map.removeControl(drawControlCasche); // Прибираємо панель малювання

        alertElement.style.top = "-100%";
        
        await cacheTiles(bounds); // Кешуємо тайли

        alertElement.innerHTML = "Територію закешовано!";
        alertElement.style.top = "15px";
        alertElement.style.left = "300px";

        setTimeout(() => {
            alertElement.style.top = "-100%";
        }, 3000);
    });
}

const db = new Dexie("TileCache");
    db.version(1).stores({
    tiles: "key, blob",
    devices: "id, name",
    points: "[deviceId+time], deviceId, x, y, time, sos, battery"
});

db.open().then(() => {
    console.log("IndexedDB підключена!");
}).catch((error) => {
    console.error("Помилка підключення до IndexedDB:", error);
});

let drawnRectangle = null;
let drawControlCasche = null;
let cacheBounds = null;

function initializeDrawingTools(map) {
    drawControlCasche = new L.Control.Draw({
        draw: {
            polyline: false,
            polygon: false,
            circle: false,
            marker: false,
            circlemarker: false,
            rectangle: {
                shapeOptions: {
                    color: 'blue'
                }
            }
        },
        edit: {
            featureGroup: new L.FeatureGroup()
        }
    });
    map.addControl(drawControlCasche);

    map.on(L.Draw.Event.CREATED, function (event) {
        if (drawnRectangle) {
            map.removeLayer(drawnRectangle);
        }
        drawnRectangle = event.layer;
        drawnRectangle.addTo(map);
        cacheBounds = drawnRectangle.getBounds();
        document.getElementById('cacheAreaBtn').disabled = false;
    });
}

function getTileUrls(bounds, zoomLevels, tileSize, tileLayerUrl) {
    const urls = [];
    zoomLevels.forEach(zoom => {
        const northWest = map.project(bounds.getNorthWest(), zoom).divideBy(tileSize).floor();
        const southEast = map.project(bounds.getSouthEast(), zoom).divideBy(tileSize).floor();

        for (let x = northWest.x; x <= southEast.x; x++) {
            for (let y = northWest.y; y <= southEast.y; y++) {
                const url = tileLayerUrl
                    .replace('{z}', zoom)
                    .replace('{x}', x)
                    .replace('{y}', y);
                const key = `${zoom}_${x}_${y}`;
                urls.push({ url, key });
            }
        }
    });
    return urls;
}

async function cacheTiles(bounds) {
    if (!db.isOpen()) {
        try {
            await db.open();
        } catch (err) {
            console.error("Не вдалося повторно відкрити DB:", err);
            return;
        }
    }
    const zoomLevels = [13, 14, 15, 16, 17, 18];
    const tileSize = 256;
    const tileLayerUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
     const urls = getTileUrls(bounds, zoomLevels, tileSize, tileLayerUrl);

    console.log(`Кешую ${urls.length} тайлів...`);

    for (const { url, key } of urls) {
        try {
            const response = await fetch(url.replace('{s}', 'a'));
            const blob = await response.blob();
            await db.tiles.put({ key, blob });
        } catch (error) {
            console.error(`Помилка завантаження тайла ${url}:`, error);
        }
    }

    console.log("Тайли успішно закешовано!");
}
function showCachedRectangle() {
    if (cachedRectangleLayer) {
        if (map.hasLayer(cachedRectangleLayer)) {
            map.removeLayer(cachedRectangleLayer); // Ховаємо
        } else {
            map.addLayer(cachedRectangleLayer);    // Показуємо
            map.fitBounds(cacheBounds);            // Зум до зони
        }
    } else if (cacheBounds) {
        cachedRectangleLayer = L.rectangle(cacheBounds, {
            color: 'blue',
            weight: 2,
            fillOpacity: 0.15
        }).addTo(map);
        map.fitBounds(cacheBounds);
    } else {
        alert('Закешована зона не визначена!');
    }
}

async function saveDeviceToDB(id, name) {
    try {
        await db.devices.put({id, name});
        console.log(`Saved: ${id} - ${name};`);
    } catch (error) {
        console.error("Error in saving device to DB: ", error);
    }
    
}

async function restoreTableFromDB() {
    const allDevices = await db.devices.toArray();
    allDevices.forEach(device => {
        addTableRowFromDB(device.id, device.name);
    });
}

function addTableRowFromDB(id = "", name = "") {
    const table = document.getElementById("devicesTable").getElementsByTagName('tbody')[0];
    const newRow = table.insertRow();

    const cellId = newRow.insertCell(0);
    const cellName = newRow.insertCell(1);
    const cellAction = newRow.insertCell(2);

    const inputId = document.createElement("input");
    inputId.type = "text";
    inputId.value = id;

    const inputName = document.createElement("input");
    inputName.type = "text";
    inputName.value = name;

    inputId.addEventListener("change", () => {
        const newId = inputId.value.trim();
        const newName = inputName.value.trim();
        if (newId) saveDeviceToDB(newId, newName);
    });

    inputName.addEventListener("change", () => {
        const newId = inputId.value.trim();
        const newName = inputName.value.trim();
        if (newId) saveDeviceToDB(newId, newName);
    });

    const actionSelect = createActionSelect(newRow, inputId);

    cellId.appendChild(inputId);
    cellName.appendChild(inputName);
    cellAction.appendChild(actionSelect); 
}

async function restorePointsFromDB() {
    const allPoints = await db.points.orderBy("deviceId").toArray();

    for (const point of allPoints) {
        drawNewPoint(
            point.x,
            point.y,
            point.time,
            point.sos,
            point.deviceId,
            point.battery
        );
    }
}

