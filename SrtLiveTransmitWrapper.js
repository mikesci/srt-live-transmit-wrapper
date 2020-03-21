const { spawn } = require("child_process");
const path = require("path");
const os = require("os");

const STARTING_STATS = {
    connected: false,
    totalPackets: 0,
    totalPacketsLost: 0,
    totalPacketsDropped: 0,
    totalPacketsRetransmitted: 0,
    totalBytes: 0,
    kbitrate: 0,
    started: null,
    lastUpdated: null
};

const LOG_PREFIX = "[srt-live-transmit.exe]";

class SrtLiveTransmitHelper {

    _opts;
    _runningStats = {...STARTING_STATS};
    _process;

    /**
     * @typedef {Object} SrtLiveTransmitOptions
     * @property {string} srtLiveTransmitPath - Path to the srt-live-transmit binary, defaults to win32 binary or "srt-live-transmit" based on platform
     * @property {number} statsIntervalMs - default = 1000
     * @property {number} incomingPort - default = 7050
     * @property {number} outgoingPort - default = 7051
     * @property {callback} onConnectionOpen - Called when an SRT connection is made
     * @property {callback} onConnectionClose - Called when an SRT connection ends
     * @property {callback} onStatsUpdate - Called when 
     */

    /**
    * @param {SrtLiveTransmitOptions} opts
    */
    constructor(opts) {
        this._opts = { ...opts };
    }

    /**
     * Starts the SRT child process and begins emitting events.
     */
    start() {

        let binaryPath = this._opts.srtLiveTransmitPath;
        if (!binaryPath) {
            if (os.platform() == "win32")
                binaryPath = path.join(__dirname, "win32", "srt-live-transmit.exe");
            else
                binaryPath = "srt-live-transmit";
        }

        let process = spawn(binaryPath, [
            // stats sample rate
            "-s", this._opts.statsIntervalMs, 
            // output stats in json format
            "-pf", "json",
            // server port/protocol
            `srt://:${this._opts.incomingPort}`,
            // outgoing port/protocol
            `udp://127.0.0.1:${this._opts.outgoingPort}`
        ]);

        process.stdout.on("data", (data) => {
            let textData = data.toString();
            try
            {
                let jsonData = JSON.parse(textData);
                this._runningStats.totalPackets += jsonData.recv.packets;
                this._runningStats.totalPacketsLost += jsonData.recv.packetsLost;
                this._runningStats.totalPacketsDropped += jsonData.recv.packetsDropped;
                this._runningStats.totalPacketsRetransmitted += jsonData.recv.packetsRetransmitted;
                this._runningStats.totalBytes += jsonData.recv.bytes;
                this._runningStats.kbitrate = parseInt(jsonData.recv.mbitRate * 1024);
                this._runningStats.lastUpdated = Date.now();

                if (this._opts.onStatsUpdate)
                    this._opts.onStatsUpdate(this._runningStats);
            }
            catch {
                console.log(`${LOG_PREFIX} (Unknown JSON) ${textData}`);
            }
        });

        process.stderr.on("data", (data) => {
            let textData = data.toString();
            if (textData.match(/Accepted SRT source connection/)) { this._onConnectionOpen(); return; }
            if (textData.match(/SRT source disconnected/)) { this._onConnectionClose(); return; }
            console.error(`${LOG_PREFIX} ${data}`);
        });

        process.on("close", (data) => {
            console.log(`${LOG_PREFIX} stopped`);
        });

        this._process = process;
    }

    /**
     * Returns the last stats collected from the current session.
     */
    getStats = () => {
        return this._runningStats;
    }

    /** @private */
    _onConnectionOpen = () => {
        this._runningStats.connected = true;
        this._runningStats.started = Date.now();
        if (this._opts.onConnectionOpen)
            this._opts.onConnectionOpen();
    }

    /** @private */
    _onConnectionClose = () => {
        // reset stats on closed
        this._runningStats = { ...STARTING_STATS };

        if (this._opts.onConnectionClose)
            this._opts.onConnectionClose();
    }

}

module.exports = SrtLiveTransmitHelper;