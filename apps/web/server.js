"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const next_1 = __importDefault(require("next"));
const socket_io_1 = require("socket.io");
// We use relative import for local files in TypeScript transpiled code
const index_1 = require("./src/server/socket/index");
const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = (0, next_1.default)({ dev, hostname, port });
const handle = app.getRequestHandler();
app.prepare().then(() => {
    const httpServer = (0, http_1.createServer)((req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url || "", true);
        handle(req, res, parsedUrl);
    });
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    // Initialize socket connections
    (0, index_1.initSocketServer)(io);
    httpServer.listen(port, () => {
        console.log(`> Server ready on http://${hostname}:${port}`);
    });
});
//# sourceMappingURL=server.js.map