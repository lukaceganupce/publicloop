const express = require('express');
const hostname = '127.0.0.1';
const port = 3000;

const app = express();
app.get('/', (req, res) => res.send('Hello from PublicLoop (index.js)'))
app.listen(3000, () => console.log(`PublicLoop running at http://${hostname}:${port}/`))