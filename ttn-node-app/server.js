let TTN_APP_ID = 'YOUR_APP_ID';
let TTN_ACCESS_KEY = 'YOUR_ACCESS_KEY';

const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server);
const hbs = require('hbs');
const ttn = require('ttn');

// Some options for express (node.js web app library)
hbs.registerPartials(__dirname + '/views/partials');
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
app.engine('html', hbs.__express);

TTN_APP_ID = process.env['TTN_APP_ID'] || TTN_APP_ID;
TTN_ACCESS_KEY = process.env['TTN_ACCESS_KEY'] || TTN_APP_ID;

// Store some state about all devices, you probably want to store this in a database
let devices = {};

// And handle requests
app.get('/', function (req, res, next) {
    let d = Object.keys(devices).map(k => {
        let o = {
            devId: k,
            last_seen: new Date(devices[k].last_seen).toLocaleString(),
            state: devices[k].state
        };
        return o;
    })
    // Render index view, with the devices based on mapToView function
    res.render('index', { devices: d });
});

// Connect to TTN
console.log('Connecting to the The Things Network data channel...');

ttn.data(TTN_APP_ID, TTN_ACCESS_KEY).then(client => {
    client.on('uplink', (devId, payload) => {
        console.log('retrieved uplink', devId, payload);

        let device = devices[devId] = devices[devId] || {};

        if (payload.port === 21) { // PIR sensor data
            device.state = payload.payload_raw[0]; // check first byte
            device.last_seen = Date.now();

            // send to all connected browsers, so they can update their state
            io.emit('movement-change', devId, device.state);
        }
    });

    console.log('Connected to The Things Network data channel');
    console.log('Retrieving devices...');
}).then(() => {
    return ttn.application(TTN_APP_ID, TTN_ACCESS_KEY);
}).then(app => {
    return app.devices();
}).then(ttn_devices => {
    console.log('Retrieved devices (' + ttn_devices.length + ')');

    for (let t of ttn_devices) {
        if (devices[t.devId]) continue;

        devices[t.devId] = {
            state: -1,
            last_seen: 0
        };
    }

    // Now we can start the web server
    server.listen(process.env.PORT || 5270, process.env.HOST || '0.0.0.0', function () {
        console.log('Web server listening on port %s!', process.env.PORT || 5270);
    });
}).catch(err => {
    console.error('Could not authenticate with TTN...', err);
});

