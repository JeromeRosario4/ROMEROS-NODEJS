const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const users = require('./routes/user');
const itemRoutes = require('./routes/item');
const categoryRoutes = require('./routes/category');
const orderRoutes = require('./routes/order');  
const chartRoutes = require('./routes/chart');
const reviewRoutes = require('./routes/review');


require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));       
app.use('/images', express.static('images')); 

app.use('/api/users', users);               
app.use('/api/item', itemRoutes);           
app.use('/api/category', categoryRoutes);
app.use('/api/orders', orderRoutes);  
app.use('/api/chart', chartRoutes); 
app.use('/api/reviews',reviewRoutes);


module.exports = app;
