require('dotenv').config();
require('./controllers/auth.js');

const cors = require('cors');
const express = require('express');
const passport = require('passport');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');
const Fingerprint = require('@shwao/express-fingerprint');
const countryList = require('iso-3166-country-list');
const stripe = require("stripe")(process.env.STRIPE_PRIVATE_KEY);

const onLoadController = require('./controllers/onLoad');
const userController = require('./controllers/user');

const userRoute = require('./routes/Users');
const fileRoute = require('./routes/Files');
const { json } = require('body-parser');

const usersDB = onLoadController.initialize_SQL_DB;
usersDB.connect((error) => {
    if (error) return console.error(error.message); // Connect with the database
    console.log('Connected to the server!');
});

const app = express(); // Initialising Express App
const PORT = process.env.PORT || 3000; // Initialising PORT NO.

app.use(cors());
// app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// View Engine Setup 
app.set('views', './views');
app.set('view engine', 'ejs');

app.use(cookieSession({ name: 'user', keys: ['key1', 'key2'], maxAge: 100 * 1000 })); // Create Cookie
app.use(passport.initialize()); // Initializes Passport
app.use(passport.session()); // Passport Sessions

const isLoggedIn = onLoadController.check_Login;

app.use(Fingerprint([ Fingerprint.ip() ]));

app.get('/', function(req, res){ res.render('Home') });

app.get('/pay', function(req, res){ res.render('Pay', { key: process.env.STRIPE_PUBLIC_KEY })});

app.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] })); // Auth Routes
app.get('/google/callback', passport.authenticate('google', {
    failureRedirect: '/' 
}), userController.redirect_To_Home ); // Redirect Home

app.get('/set', isLoggedIn, userController.set_User_Data); // Sets User Info
app.use('/user', isLoggedIn, userRoute); // Get & Update User Details

app.use('/generate', fileRoute);

app.post('/sub', async (req, res) => {
    console.log(req);
    const customer = await stripe.customers.create({
        payment_method: req.body.payment_method,
        email: req.body.email, name: req.body.name,
        address: {
            city: req.body.city || '', country: req.body.country,
            line1: req.body.line1 || '', line2: req.body.line2 || '',
            postal_code: req.body.postal_code || '', state: req.body.state || '',
        },
        invoice_settings: { default_payment_method: req.body.payment_method },
    });
    const subscription = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: req.body.plan }],
        expand: ['latest_invoice.payment_intent']
    });
    const status = subscription['latest_invoice']['payment_intent']['status'] 
    const client_secret = subscription['latest_invoice']['payment_intent']['client_secret']
    res.json({client_secret: client_secret, status: status});
});
  
app.post('/webhooks', (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try { event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret); }
    catch (err) { return res.status(400).send(`Webhook Error: ${err.message}`); }
    switch (event.type) {
        case 'payment_intent.succeeded': {
            const email = event['data']['object']['receipt_email'] 
            console.log(`PaymentIntent was successful for ${email}!`)
            break;
        }
        default:
            return res.status(400).end();
    }
    res.json({received: true});
});

app.get('/out', userController.user_Logout); // Logout User

app.listen(PORT, () => { console.log(`Running on port => ${PORT}`) }); // Starting Express App