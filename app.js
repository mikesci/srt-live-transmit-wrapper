const express = require('express');
const cors = require("cors");
const SrtLiveTransmitWrapper = require("./SrtLiveTransmitWrapper");

const app = express();

// allow anonymous usage from anywhere
app.use(cors());

const config = {
    statsPort: 15098,
    srtIncomingPort: 15099,
    srtOutgoingPort: 15060,
    statsIntervalMs: 1000
}

// start the srt server process
let srt = new SrtLiveTransmitWrapper({
    statsIntervalMs: config.statsIntervalMs,
    incomingPort: config.srtIncomingPort,
    outgoingPort: config.srtOutgoingPort,
    onConnectionOpen: () => { console.log("SRT connection started."); },
    onConnectionClose: () => { console.log("SRT connection ended."); },
});
srt.start();

// endpoint to return the srt server's ingest address
app.get("/srtserver", (req, res) => {
    let host = req.headers.host.substr(0, req.headers.host.indexOf(':'));
    res.send(`srt://${host}:${config.srtIncomingPort}`);
});

// endpoint to return the latest stats object
app.get("/", (req, res) => {
    let stats = srt.getStats();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(stats));
});

app.listen(config.statsPort);

console.log(`Stats server port:  ${config.statsPort}`);
console.log(`SRT server port:    ${config.srtIncomingPort}`);
console.log(`UDP outgoing port:  ${config.srtOutgoingPort}`);