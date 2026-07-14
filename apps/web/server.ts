import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import * as fs from "fs";
import * as path from "path";
// We use relative import for local files in TypeScript transpiled code
import { initSocketServer } from "./src/server/socket/index";

const dev = process.env.NODE_ENV !== "production";
const hostname = dev ? "localhost" : "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url || "", true);
    const { pathname } = parsedUrl;

    // Direct static serving of uploads folder to bypass Next.js production dynamic asset serving limitation
    if (pathname && pathname.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", pathname);
      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.statusCode = 404;
          res.end("File not found");
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".gif": "image/gif",
          ".webp": "image/webp",
          ".svg": "image/svg+xml",
        };
        const contentType = mimeTypes[ext] || "application/octet-stream";

        res.writeHead(200, { "Content-Type": contentType });
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
      });
      return;
    }

    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Initialize socket connections
  initSocketServer(io);

  httpServer.listen(port, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
  });
});
