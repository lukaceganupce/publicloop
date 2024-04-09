const fetch = require('node-fetch');
const jsdom = require("jsdom");
const {JSDOM} = jsdom;
const mysql = require("mysql2/promise");
const {resolve} = require("path");

lines = [
    ['5', 'https://www.dpmp.cz/cestovani-mhd/jizdni-rady/5-23.html'],
    ['13', 'https://www.dpmp.cz/cestovani-mhd/jizdni-rady/13-32.html']
];

startScraping();

async function startScraping() {

    var connection = await getConn();
    let impbatch_key = false;
    try {
        const [results, fields] =  await connection.query(
            'INSERT INTO imp_batch VALUES (null, NOW(),null, null)',
            []
        );
        impbatch_key = results.insertId;
    } catch (err) {
        console.log(err);
    }

    //get bus lines and stops
    if (impbatch_key) {
        for (let i = 0; i < lines.length; i++) {
            let impline_key = false;
            try {
                const [results, fields] = await connection.query(
                    'INSERT INTO imp_lines VALUES (null, ?, ?, ?)',
                    [lines[i][0], lines[i][1], impbatch_key]
                );
                impline_key = results.insertId;
            } catch (err) {
                console.log(err);
            }

            if (impline_key) {
                let res = await fetch(lines[i][1]);
                let ret = await res.text();
                await getLinesStops(ret, impline_key);
                await sleep(5000);
            } else {
                console.log('Impline_key does not exist.');
            }
        }
    } else {
        console.log('Impbatch_key does not exist.');
    }

    //get stop departures
    try {
        const [results, fields] = await connection.query(
            'SELECT s.impstop_key, s.impstop_url FROM imp_stops s INNER JOIN imp_lines l ON l.impline_key = s.impline_key WHERE l.impbatch_key = ?',
            [impbatch_key]
        );

        for (const item of results) {
            let res = await fetch('https://www.dpmp.cz'+ item.impstop_url.substring(5));
            let html = await res.arrayBuffer();
            await getDepartures(html, item.impstop_key);
            await sleep(5000);
        }
    } catch (err) {
        console.log(err);
    }
    process.exit();
}

async function getLinesStops(html, impline_key) {

    var connection = await getConn();

    const dom = new JSDOM(html);
    const tbody = dom.window.document.querySelector(".line-change-preview table tbody");
    const trs = tbody.getElementsByTagName('tr');

    for (let tr of trs) {
        const h4 = tr.querySelector("td h4");
        if (h4 != null) {
            const tds = tr.querySelectorAll("td");
            for (let td of tds) {
                let h4 = td.querySelector("h4");
                let line_direction_text = h4.textContent;
                let line_direction = 0;
                switch (line_direction_text) {
                    case 'Směr A':
                        line_direction = 1;
                        break;
                    case 'Směr B':
                        line_direction = 2;
                        break;
                    default:
                        line_direction = 0;
                }
                let as = td.querySelectorAll("p a");

                var order = 0;
                for (let a of as) {
                    order++;
                    let stop_name = a.textContent;
                    let stop_schedule_url = a.getAttribute("href");

                    var impstop_key = false
                    try {
                        const [results, fields] = await connection.query(
                            'INSERT INTO imp_stops VALUES (null, ?, ?, ?, ?, ?)',
                            [stop_name, stop_schedule_url, line_direction, order, impline_key],
                        );
                        impstop_key = results.insertId;

                        if (!impstop_key) {
                            console.log('Impstop_key does not exist.');
                        }
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
        }
    }
}

async function getDepartures(html, impstop_key) {

    var connection = await getConn();

    const dom = new JSDOM(html);
    const tbody = dom.window.document.querySelector('div.times table tbody');
    const trs= tbody.getElementsByTagName('tr');

    var valid_from_weekends = null;
    var valid_to_weekends = null;

    for (let tr of trs) {
        const ths = tr.querySelectorAll("th");
        for (let th of ths) {

            switch (th.getAttribute("id")) {
                case 'tt-weekdays':
                case 'tt-mholidays':
                case 'tt-holidays':
                    var label = th.innerHTML.match(/Pracovní dny (.*)<br>.*/);
                    var diff = label[1].split('-');

                    var from = diff[0].trim().split('.');
                    var to = diff[1].trim().split('.');

                    var fm = '0'+parseInt(from[1]);
                    var fd = '0'+(parseInt(from[0])+1);

                    var tm = '0'+parseInt(to[1]);
                    var td = '0'+(parseInt(to[0])+1);

                    var date = new Date(Date.parse('2023-'+fm.substring(fm.length-2)+'-'+fd.substring(fd.length-2)+'T00:00:00Z'));
                    var valid_from = date.toISOString().slice(0, 19).replace('T', ' ');

                    var date = new Date(Date.parse('2024-'+tm.substring(tm.length-2)+'-'+td.substring(td.length-2)+'T00:00:00Z'));
                    var valid_to = date.toISOString().slice(0, 19).replace('T', ' ');

                    if (valid_from_weekends == null) {
                        valid_from_weekends = valid_from;
                    } else {
                        if (valid_from_weekends > valid_from) valid_from_weekends = valid_from;
                    }
                    if (valid_to_weekends == null) {
                        valid_to_weekends = valid_to;
                    } else {
                        if (valid_to_weekends < valid_to) valid_to_weekends = valid_to;
                    }
                    break;
            }

            switch (th.getAttribute("id")) {
                case 'tt-weekdays':
                    var valid_from_weekdays = valid_from;
                    var valid_to_weekdays = valid_to;
                case 'tt-mholidays':
                    var valid_from_mholidays = valid_from;
                    var valid_to_mholidays = valid_to;
                case 'tt-holidays':
                    var valid_from_holidays = valid_from;
                    var valid_to_holidays = valid_to;
                    break;
                case 'tt-holidays':

                    break;
            }
        }
        const tds = tr.querySelectorAll("td");

        var hour = null;

        for (let td of tds) {
                var headers = td.getAttribute("headers");
                var values = td.textContent;

                var minutes = null;
                var impdeparture_type = null;

               // console.log(values);

                if (headers.includes("tt-weekdays-hour")) {
                    hour = td.textContent;
                }
                if (headers.includes("tt-weekdays-minute")) {
                    minutes = td.innerHTML;
                    impdeparture_type = 'weekdays';
                    valid_from = valid_from_weekdays;
                    valid_to = valid_to_weekdays;
                }
                if (headers.includes("tt-mholidays-hour")) {
                    hour = td.textContent;
                }
                if (headers.includes("tt-mholidays-minute")) {
                    minutes = td.innerHTML;
                    impdeparture_type = 'mholidays';
                    valid_from = valid_from_mholidays;
                    valid_to = valid_to_mholidays;
                }

                if (headers.includes("tt-holidays-hour")) {
                    hour = td.textContent;
                }
                if (headers.includes("tt-holidays-minute")) {
                    minutes = td.innerHTML;
                    impdeparture_type = 'holidays';
                    valid_from = valid_from_holidays;
                    valid_to = valid_to_holidays;
                }
                if (headers.includes("tt-weekends-hour")) {
                    hour = td.textContent;
                }
                if (headers.includes("tt-weekends-minute")) {
                    minutes = td.innerHTML;
                    impdeparture_type = 'weekends';
                    valid_from = valid_from_weekends;
                    valid_to = valid_to_weekends;
                }

                let date = new Date();
                var departure = date.toISOString().slice(0, 19).replace('T', ' ');

                if (!(minutes == '&nbsp;' || minutes == null)) {

                    const minutes_dom = new JSDOM('<html><head></head><body><div>'+minutes+'</div></body></html>');
                    const minutes_div = minutes_dom.window.document.querySelector('div');
                    for(var node of minutes_div.childNodes) {
                        switch(node.nodeType) {
                            case 1:
                                //ELEMENT_NODE
                                var param_code = '';
                                var param_name = '';

                                switch('name', node.nodeName) {
                                    case 'ACRONYM':
                                        //console.log('el', node.innerHTML);
                                        param_code = node.innerHTML;
                                        param_name = node.getAttribute("title");
                                        break;
                                    case 'IMG':
                                        param_code = 'wheelchair';
                                        param_name = node.getAttribute("title");
                                        break;
                                };
                                //save to DB
                                try {
                                    const [results, fields] = await connection.query(
                                        'INSERT INTO imp_departure_params VALUES (null, ?, ?, ?)',
                                        [impdeparture_key, param_code, param_name]
                                    );
                                } catch (err) {
                                    console.log(err);
                                }
                                break;
                            case 3:
                                //TEXT_NODE
                                minutes = node.nodeValue.split(" ");
                                for (var minute of minutes) {
                                    departure = hour +':'+minute+':00';
                                    //save to db
                                    if (minute != '') {
                                        //var impdeparture_type = minute;
                                        try {
                                            const [results, fields] = await connection.query(
                                                'INSERT INTO imp_departures VALUES (null, ?, ?, ?, ?, ?)',
                                                [impstop_key, departure, valid_from, valid_to, impdeparture_type]
                                            );
                                            var impdeparture_key = results.insertId;
                                        } catch (err) {
                                            console.log(err);
                                        }
                                    }
                                }
                                break;
                        }
                    }
                }
        }
    }
}

async function sleep(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

async function getConn() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'publicloop',
        password: 'publiclooppassword',
        database: 'publicloop',
    });
    return connection;
}
