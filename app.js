//var http = require('http');
//var server = http.createServer(function(req, res) {
//    res.writeHead(200, {'Content-Type': 'text/plain'});
//    var message = 'It works!\n',
//        version = 'NodeJS ' + process.versions.node + '\n',
//        response = [message, version].join('\n');
//    res.end(response);
//});
//server.listen();

const http = require("http");
const next = require("next");

const port = Number.parseInt(process.env.PORT || "3000", 10);
const hostname = "127.0.0.1";

const nextApplication = next({
  dev: false,
  dir: __dirname,
  hostname,
  port,
});

const requestHandler = nextApplication.getRequestHandler();

nextApplication
  .prepare()
  .then(() => {
    const server = http.createServer((request, response) => {
      requestHandler(request, response);
    });

    server.listen(port, hostname, () => {
      console.log(`Next.js is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Unable to start Next.js:", error);
    process.exit(1);
  });

