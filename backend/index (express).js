const express = require('express');
const mysql = require("mysql2");
const hostname = '127.0.0.1';
const port = 3000;

const app = express();
app.use(express.json());
app.post('/user/signin', (req, res) => {

    let username = req.body.email;
    let password = req.body.password;
    var connection = getConn();
    connection.query(
        'SELECT *  FROM users WHERE email=? and password = ?',
        [username, password],
        function (err, results) {
            if (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain');
                res.send('Internal Server Error');
            } else {
                var exist = false;
                results.forEach(function (item) {
                    exist = true;
                });
                var resData = {login: exist}
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.send(JSON.stringify(resData));
            }
        }
    )
})
app.get("*", (req, res) => {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain');
    res.send("Not Found");
});
app.listen(3000, () => console.log(`PublicLoop running at http://${hostname}:${port}/`))

function getConn() {
    return mysql.createConnection({
        host: 'localhost',
        user: 'publicloop',
        password: 'publiclooppassword',
        database: 'publicloop',
    });
}