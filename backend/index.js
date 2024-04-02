const http = require('http');
const mysql = require("mysql2");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const hostname = '127.0.0.1';
const port = 3000;
const server = http.createServer((req, res) => {
    let uid = null;
    const cookies = parseCookies(req);
    if (typeof cookies.session_id != 'undefined') {
        uid = cookies.session_id;
    } else {
        uid = (crypto.randomUUID());
    }

    const file = path.resolve(__dirname, '..', 'tmp_session/',uid);
    let session_data = {session_id: uid,data: {}};
    try {
        session_data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        fs.writeFileSync(file, JSON.stringify(session_data), { flag: 'ax' });
    }

    var session_cookie = 'session_id=' + uid+'; path=/; Secure; Max-Age=9000; SameSite=None';

    switch (req.url) {
        case '/user/signout':
            if(typeof session_data.data.user_key != 'undefined') {
                try {
                    session_data.data = {};
                    fs.writeFileSync(file, JSON.stringify(session_data), {flag: ''});

                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({signout: true}));
                } catch (e) {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({signout: false}));
                }
            } else {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({signout: false}));
            }
            break;
        case '/user/signin':
            if(typeof session_data.data.user_key != 'undefined') {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Set-Cookie', session_cookie);
                res.end(JSON.stringify({signin: true}));
                break;
            }

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
                            var user_key = null;
                            results.forEach(function (item) {
                                exist = true;
                                user_key = item.user_key;
                            });
                            if (exist) {
                                session_data.data ['user_key'] = user_key;
                                fs.writeFileSync(file, JSON.stringify(session_data), {flag: ''});
                            }
                            var resData = {login: exist}
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.setHeader('Set-Cookie', session_cookie);
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
            res.setHeader('Set-Cookie', session_cookie);
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

function parseCookies (request) {
    const list = {};
    const cookieHeader = request.headers?.cookie;
    if (!cookieHeader) return list;

    cookieHeader.split(`;`).forEach(function(cookie) {
        let [ name, ...rest] = cookie.split(`=`);
        name = name?.trim();
        if (!name) return;
        const value = rest.join(`=`).trim();
        if (!value) return;
        list[name] = decodeURIComponent(value);
    });

    return list;
}