function isUserSignin(session_id) {
    return new Promise((resolve) => {
        if (session_id != null) {
            fetch('http://localhost/backend/user/signin', {
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({})
            })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP error, status = ${response.status}`);
                    }
                    return response.text();
                })
                .then((text) => {
                    resolve(text);
                })
                .catch(error => {
                    //TODO handle error
                })
        } else {
            resolve(false);
        }
    });
}

function getCookie(name) {
    var dc = document.cookie;
    var prefix = name + "=";
    var begin = dc.indexOf("; " + prefix);
    if (begin == -1) {
        begin = dc.indexOf(prefix);
        if (begin != 0) return null;
    } else {
        begin += 2;
        var end = document.cookie.indexOf(";", begin);
        if (end == -1) {
            end = dc.length;
        }
    }
    return decodeURI(dc.substring(begin + prefix.length, end));
}