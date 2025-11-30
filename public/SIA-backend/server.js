// ملف السيرفر الرئيسي.
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
    res.send('SIA Back-End is running!');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
