const http = require('http');
const mysql = require("mysql2");
const hostname = '127.0.0.1';
const port = 3000;
const server = http.createServer((req, res) => {
    console.log(req.url);
    switch (req.url) {
        case '/user/signin':
            var body = '';  //get request body
            req.on('data', chunk => {
                body += chunk.toString(); // convert Buffer to string
            });
            req.on('end', () => {
                let reqData = JSON.parse(body);
                let username = reqData.email;
                let password = reqData.password;
                var connection = getConn();
                connection.query(
                    'SELECT *  FROM users WHERE email=? and password = ?',
                    [username, password],
                    function (err, results) {
                        if (err) {
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'text/plain');
                            res.end('Internal Server Error');
                        } else {
                            var exist = false;
                            results.forEach(function (item) {
                                exist = true;
                            });
                            var resData = {login: exist}
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify(resData));
                        }
                    }
                );
            });
            break;
        case '/':
        default:
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain');
            res.end('Not Found');
            break;
    }
});
server.listen(port, hostname, () => {
    console.log(`PublicLoop running at http://${hostname}:${port}/`);
});

function getConn() {
    return mysql.createConnection({
        host: 'localhost',
        user: 'publicloop',
        password: 'publiclooppassword',
        database: 'publicloop',
    });
}