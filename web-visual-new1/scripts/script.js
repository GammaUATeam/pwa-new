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
var lastCOMPortValue;
var dataBuffer = ""; // Буфер для об'єднання неповних пакетів

var maxAllowedZoom = 17;
var map = L.map(document.getElementById("osm-map"), { maxZoom: maxAllowedZoom });

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(map);

map.setView([49.834956, 24.014456], 14);


// Глобальні іконки маркерів
var globalMarkerIcon = L.icon({
    iconUrl: "img/marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

var globalAlertIcon = L.icon({
    iconUrl: "img/alert_marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

var globalBlueMarkerIcon = L.icon({
    iconUrl: "img/blue_marker.svg",
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
});

var globalBlueAlertIcon = L.icon({
    iconUrl: "img/blue_alert_marker.svg",
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

function connectDevice() {
    document.getElementById("portConnectScreen").addEventListener("click", async () => {
        document.getElementById("portConnectScreen").style = "top: 100%;";
        console.log("Port connected");

        getUserData(); // Тепер функція оголошена

        if (testMode) {
            console.log("Starting test mode...");
            startTestMode();
        } else {
            try {
                const port = await navigator.serial.requestPort();
                await port.open({ baudRate: 9600 });

                const reader = port.readable.getReader();
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log("Reader done, releasing lock.");
                        reader.releaseLock();
                        break;
                    }

                    const decoder = new TextDecoder();
                    dataBuffer += decoder.decode(value);

                    processBufferedData();
                }
            } catch (error) {
                console.error("Serial port error:", error);
                alert("Failed to connect to serial port. Check console for details.");
            }
        }
    });
}

// Змінюємо частоту оновлення координат (наприклад, кожні 5 секунд)
const updateInterval = 5000; // 5 секунд

// Функція для початку тестового режиму
function startTestMode() {
    // Імітуємо отримання даних з трекера
    setInterval(() => {
        // Генеруємо випадкові координати
        const lat = 49.83 + (Math.random() * 0.02);
        const lng = 24.01 + (Math.random() * 0.02);
        const sos = Math.random() < 0.2; // Імітуємо SOS з певною ймовірністю
        const id = "TEST" + Math.floor(Math.random() * 10);

        // Створюємо тестовий пакет даних
        const testData = `${sos ? 's' : 'o'}${id},${lat},${lng}`;
        console.log("Simulating data:", testData);
        dataBuffer += testData;
        processBufferedData();
    }, updateInterval); // Відправляємо дані кожні 5 секунд
}

function processBufferedData() {
    const packets = dataBuffer.split(/(?=s|o)/); // Розділяємо дані за SOS або ID
    dataBuffer = packets.pop(); // Останній неповний пакет залишаємо в буфері

    packets.forEach((packet) => {
        const parsedData = parseDataString(packet);
        if (parsedData) {
            const { id, x, y, SOS, currentTime } = parsedData;
            callSOS(SOS, currentTime, [x, y], id);
            drawNewPoint(x, y, currentTime, SOS, id);
        } else {
            console.log(`Ignored data: ${packet}`);
        }
    });
}

function parseDataString(str) {
    try {
        const [SOS_ID, x, y] = str.split(",");
        const SOS = SOS_ID[0];
        const id = SOS_ID.slice(1);

        if (checkCoordinatesFormat(x, y) && (SOS === "s" || SOS === "o")) {
            const currentTime = getCurrentTime();
            return { id, x: parseFloat(x), y: parseFloat(y), SOS: SOS === "s", currentTime };
        }
    } catch (error) {
        console.error("Error parsing data string:", error);
    }
    return null;
}

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

function callSOS(SOS, time, coords, id) {
    const alertElement = document.getElementById("alert");

    if (SOS) {
        console.log(`SOS from ${id} at ${time}`);
        alertElement.style.bottom = "15px"; // Показуємо повідомлення
        alertElement.innerHTML = `SOS from ${id}!`;

        if (!alertElement.hasClickListener) {
            alertElement.addEventListener("click", () => {
                map.flyTo(coords, maxAllowedZoom);
            });
            alertElement.hasClickListener = true;
        }
    } else {
        console.log(`SOS deactivated for ${id}`);
        alertElement.style.bottom = "-100%"; // Приховуємо повідомлення
    }
}

function drawNewPoint(x, y, currentTime, SOS, id) {
    console.log(`%c${currentTime} Device: ${id}, ${x}; ${y} - ${SOS ? "SOS" : "No SOS"}`, 'background: #900000; color: #fff');

    // Додаємо перевірку та округлення координат
    console.log("x:", x, typeof x, "y:", y, typeof y);

    const roundedX = parseFloat(x.toFixed(6));
    const roundedY = parseFloat(y.toFixed(6));

    var newMarker = L.latLng(roundedX, roundedY);

    const isSpecialId = id === "500001";
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

        map.removeLayer(lastMarkerObject[id]);
    }

    var newMarkerObject = L.marker(newMarker, { icon: currentMarkerIcon });

    if (isSpecialId) {
        newMarkerObject.on("mousedown", onMentorMarkerClick); // Початок створення зони
    }
    newMarkerObject.addTo(map);

    lastMarker[id] = newMarker;
    lastMarkerObject[id] = newMarkerObject;
    
    checkDevicePosition(id, roundedX, roundedY); // Передаємо округлені координати
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

// function checkDevicePosition(id, x, y) {
//     // Перевіряємо, чи задані геозони перед перевіркою позиції
//     if (userPoligonZones.length === 0) {
//         console.log("Геозони ще не задані.");
//         return; // Виходимо з функції, якщо геозони не задані
//     }

//     let insideAnyZone = false;

//     // Перевіряємо, чи точка знаходиться в одній із зон
//     userPoligonZones.forEach(zone => {
//         if (isInPolygon([x, y], zone)) {
//             insideAnyZone = true;
//         }
//     });

//     if (!insideAnyZone) {
//         alert(`${id} has left the zone!`);
//     }
// }
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
    if (mentorZone && id !== mentorId) {
        if (!isInMobileZone({ lat: x, lng: y })) {
            alert(`${id} has left the mobile zone!`);
        }
    }

    // Якщо не в жодній зоні та статичні зони існують, показуємо сповіщення
    if (!insideAnyZone && userPoligonZones.length > 0) {
        alert(`${id} has left the static polygon zone!`);
    }
}


// мобільні
var mentorZone = null;
var isDrawingZone = false;
var initialPoint = null;


function onMentorMarkerClick(e) {
    initialPoint = e.latlng; 
    isDrawingZone = true;

    mentorZone = L.circle(initialPoint, {
        radius: 0,
        color: "blue",
        fillColor: "rgba(0, 0, 255, 0.3)",
        fillOpacity: 0.5,
    }).addTo(map);

    console.log("Started drawing zone at:", initialPoint);
}


map.on("mousemove", function (e) {
    if (!isDrawingZone || !mentorZone) return;

    var currentPoint = e.latlng;
    var radius = map.distance(initialPoint, currentPoint);

    mentorZone.setRadius(radius);
    console.log("Current radius:", radius);
});


map.on("mouseup", function () {
    if (isDrawingZone) {
        isDrawingZone = false;
        console.log("Finished drawing zone with radius:", mentorZone.getRadius());
    }
});

function isInMobileZone(childCoords) {
    if (!mentorZone) return true;

    var distance = map.distance(mentorZone.getLatLng(), childCoords);
    return distance <= mentorZone.getRadius();
}

