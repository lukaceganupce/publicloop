const mysql = require("mysql2/promise");
const fetch = require("node-fetch");

const lines = [
    '5', '13'
];

const line_stops_position = [
    ['5', 'A',
        [
            ['Dukla,točna', 15.7587522, 50.0210234],
            ['Dukla,náměstí', 15.7586374, 50.0240244],
            ['Teplého', 15.7611141, 50.0268243],
            ['Domov mládeže', 15.7663822, 50.0270761],
            ['Jana Palacha', 15.7707138, 50.0285677],
            ['17.listopadu', 15.7703028, 50.0333627],
            ['Masarykovo náměstí', 15.7695389, 50.0379137],
            ['Náměstí Republiky', 15.7773819, 50.0374177],
            ['Krajský úřad', 15.7820969, 50.0381006],
            ['Sakařova', 15.7871599, 50.0389131],
            ['Holubova', 15.7905741, 50.0398668],
            ['Bezdíčkova', 15.7956009, 50.0412973],
            ['Židov', 15.7991791, 50.0412668],
            ['Dubina,garáže', 15.8032742, 50.0420717],
            ['Dubina,centrum', 15.8073502, 50.0448755],
            ['Dubina,sever', 15.8114271, 50.0470595]
        ]
    ],
    ['5', 'B',
        [
            ['Dubina,sever', 15.8117964, 50.0461022],
            ['Dubina,centrum', 15.8067303, 50.0446390],
            ['Dubina,garáže', 15.8031254, 50.0421709],
            ['Židov', 15.7997923, 50.0409654],
            ['Bezdíčkova', 15.7958479, 50.0414575],
            ['Holubova', 15.7913580, 50.0401910],
            ['Sakařova', 15.7863016, 50.0387529],
            ['Krajský úřad', 15.7809601, 50.0379861],
            ['Náměstí Republiky', 15.7770977, 50.0384935],
            ['Masarykovo náměstí', 15.7694921, 50.0373529],
            ['17.listopadu', 15.7700863, 50.0334772],
            ['Jana Palacha', 15.7705622, 50.0279955],
            ['Domov mládeže', 15.7666960, 50.0271867],
            ['Teplého', 15.7612953, 50.0269998],
            ['Lexova', 15.7584686, 50.0263513],
            ['Dukla,náměstí', 15.7585001, 50.0234102],
            ['Dukla,točna', 15.7585001, 50.0217627]
        ]
    ],
    ['13', 'A',
        [
            ['Ohrazenice,točna', 15.7506206, 50.0617704],
            ['Ohrazenice,Semtínská', 15.7541618, 50.0620530],
            ['Ohrazenice,škola', 15.7573872, 50.0617936],
            ['Globus', 15.7549706, 50.0590356],
            ['Trnová', 15.7570572, 50.0584672],
            ['Poděbradská', 15.7622318, 50.0547899],
            ['Polabiny,točna', 15.7595215, 50.0513223],
            ['Polabiny,Kosmonautů', 15.7600117, 50.0492700],
            ['Polabiny,hotel', 15.7630043, 50.0477518],
            ['Stavařov', 15.7666035, 50.0453943],
            ['Zimní stadion', 15.7676811, 50.0424493],
            ['Sukova', 15.7703161, 50.0390047],
            ['Náměstí Republiky', 15.7773819, 50.0374177],
            ['Krajský úřad', 15.7820969, 50.0381006],
            ['U Kostelíčka', 15.7862148, 50.0381540],
            ['Na Okrouhlíku', 15.7939396, 50.0354150],
            ['Na Drážce', 15.7986202, 50.0372575],
            ['Dubina,garáže', 15.8032742, 50.0420717],
            ['Dubina,centrum', 15.8073502, 50.0448755],
            ['Dubina,sever', 15.8112125, 50.0463361]
        ]
    ],
    ['13', 'B',
        [
            ['Dubina,sever', 15.8093181, 50.0455430],
            ['Dubina,centrum', 15.8067303, 50.0446390],
            ['Dubina,garáže', 15.8031254, 50.0421709],
            ['Na Drážce', 15.7984571, 50.0372003],
            ['Na Okrouhlíku', 15.7929726, 50.0360559],
            ['Krajský úřad', 15.7809601, 50.0379861],
            ['Náměstí Republiky', 15.7770977, 50.0384935],
            ['Zimní stadion', 15.7687788, 50.0401529],
            ['Stavařov', 15.7670937, 50.0450052],
            ['Polabiny,hotel', 15.7635155, 50.0479501],
            ['Polabiny,Kosmonautů', 15.7603168, 50.0489534],
            ['Polabiny,točna', 15.7605963, 50.0521348],
            ['Poděbradská', 15.7626057, 50.0546335],
            ['Trnová', 15.7583113, 50.0582956],
            ['Globus', 15.7548580, 50.0592111],
            ['Ohrazenice,škola', 15.7574835, 50.0620607],
            ['Ohrazenice,Semtínská', 15.7535925, 50.0620683],
            ['Ohrazenice,točna', 15.7506206, 50.0617704]
        ]
    ]
];

startSync();

async function startSync() {

    await loadLines();

    await loadStops();

    process.exit();
}

async function loadLines() {
    var connection = await getConn();
    for (let line of lines) {
        try {
            await connection.query(
                'INSERT INTO `lines` VALUES (null, ?)',
                [line]
            );
        } catch (err) {
            console.log(err);
        }
    }
}

async function loadStops() {
    var connection = await getConn();

    for (let line_stop of line_stops_position) {
        var line_name = line_stop[0];

        const [results_lines] = await connection.query(
            'SELECT line_key FROM `lines` WHERE line_name = ?',
            [line_name]
        );

        var line_key = null;
        for (const line of results_lines) {
            line_key = line.line_key;
        }

        var line_direction = line_stop[1];
        let direction = 1;
        if (line_direction == 'B') {
            direction = 2;
        }

        var index = 1;
        for (let stop of line_stop[2]) {
            try {
                const [results] = await connection.query(
                    'INSERT INTO stops VALUES (null, ?, ?, ?, ?)',
                    [stop[0], stop[1], stop[2], line_direction]
                );
                stop_key = results.insertId;

            } catch (err) {
                console.log(err);
            }
            try {
                await connection.query(
                    'INSERT INTO line_stops VALUES (null, ?, ?, ?, ?)',
                    [line_key, stop_key, direction, index]
                );
            } catch (err) {
                console.log(err);
            }
            index++;
        }
    }
}

function getConn() {
    return mysql.createConnection({
        host: 'localhost',
        user: 'publicloop',
        password: 'publiclooppassword',
        database: 'publicloop',
    });
}