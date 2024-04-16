const http = require('http');
const mysql = require("mysql2");
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
var Mailgen = require('mailgen');
var dotenv = require('dotenv');

dotenv.config();

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
        case '/mail/send':
            var from = '"Publicloop" <info@publicloop.com>';
            var to = "new.user@domain.com";
            var subject = "Confirm your account!";

            var mailGenerator = new Mailgen({
                theme: 'default',
                product: {
                    name: 'Publicloop',
                    link: 'https://publicloop.com/'
                }
            });

            var email = {
                body: {
                    name: 'Lukáš Čegan',
                    intro: 'Welcome to Publicloop! We\'re very excited to have you on board.',
                    action: {
                        instructions: 'To get started with Publicloop, please click here:',
                        button: {
                            color: '#22a0bc',
                            text: 'Confirm your account',
                            link: 'https://publicloop.com/confirm?s=jhfad65d4f35asd4f3as4d35f4asd3f'
                        }
                    },
                    outro: 'Need help, or have questions? Just reply to this email, we\'d love to help.'
                }
            };
            var emailBody = mailGenerator.generate(email);
            var emailText = mailGenerator.generatePlaintext(email);

            // Můžeme si vygenerovat náhled emailu a uložit na disk
            const preview_file = path.resolve(__dirname, '..', 'tmp_emails/preview.html');
            require('fs').writeFileSync( preview_file, emailBody, 'utf8');

            sendMail(from, to, subject, emailText, emailBody).then((messageId) => {
                var resData = {messageId: messageId};
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Set-Cookie', session_cookie);
                res.end(JSON.stringify(resData));
            }).catch(console.error)
            break;
        case '/journey/find':
            var body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                    res.statusCode = 200;
                    res.setHeader('Content-Type', 'application/json');

                    let reqData = JSON.parse(body);
                    let active = reqData.active;
                    let arrive = reqData.arrive;
                    let depart = reqData.depart;
                    let from = reqData.from;
                    let to = reqData.to;

                    from = from.split(','); //15 50
                    to = to.split(',');

                    var dist = getDistance([50.0210234, 15.7587522], [from [1], from[0]]);

                    var section_from = {
                        type: 1,
                        type_name: "walk",
                        from: {latitude: parseFloat(from[0]), longitude: parseFloat(from[1]), date: depart},
                        to: {latitude: 15.7587522, longitude: 50.0210234, date: depart},
                        distance: dist,
                        line: []
                    };

                    dist = getDistance([50.0470595, 15.8114271], [to [1], to[0]]);
                    var section_to = {
                        type: 1,
                        type_name: "walk",
                        from: {latitude: 15.8114271, longitude: 50.0470595, date: depart},
                        to: {latitude: parseFloat(to[0]), longitude: parseFloat(to[1]), date: depart},
                        distance: dist,
                        line: []
                    };

                    var connection = getConn();
                    connection.query(
                        'select l.line_name, ls.direction, ls.order, s.stop_name, s.latitude, s.longitude\n' +
                        'from `lines` l\n' +
                        'inner join line_stops ls on l.line_key = ls.line_key\n' +
                        'inner join stops s on ls.stop_key = s.stop_key\n' +
                        'where l.line_name = ? and ls.direction = ?\n' +
                        'order by ls.order',
                        ['5', '1'],
                        function (err, results) {
                            if (err) {
                                res.statusCode = 500;
                                res.setHeader('Content-Type', 'text/plain');
                                res.end('Internal Server Error');
                            } else {

                                var resData = {meta:[], sections:[]};
                                resData.sections.push(section_from);

                                var line_path = [];
                                results.forEach(function (item) {
                                    line_path.push(
                                        {
                                            line_name: item.line_name,
                                            direction: item.direction,
                                            order: item.order,
                                            stop_name: item.stop_name,
                                            latitude: item.latitude,
                                            longitude: item.longitude
                                        });
                                });

                                dist = getDistance([50.0210234, 15.7587522], [50.0470595, 15.8114271]);
                                resData.sections.push({
                                    type: 2,
                                    type_name: "bus",
                                    from: {latitude: 15.7587522, longitude: 50.0210234, date: depart},
                                    to: {latitude: 15.8114271, longitude: 50.0470595, date: depart},
                                    distance: dist,
                                    line: line_path
                                });

                                resData.sections.push(section_to);
                                res.statusCode = 200;
                                res.setHeader('Content-Type', 'application/json');
                                res.setHeader('Set-Cookie', session_cookie);
                                res.end(JSON.stringify(resData));
                            }
                        }
                    )
                }
            )
            break;
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

function getDistance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    var lon1 = coords1[0];
    var lat1 = coords1[1];

    var lon2 = coords2[0];
    var lat2 = coords2[1];

    var R = 6371; // km

    var x1 = lat2 - lat1;
    var dLat = toRad(x1);
    var x2 = lon2 - lon1;
    var dLon = toRad(x2)
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;

    return d;
}


var transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
    }
});

async function sendMail(from, to, subject, text, html) {
    return await transporter.sendMail({
        from: from,
        to: to,
        subject: subject,
        text: text,
        html: html
    });
}