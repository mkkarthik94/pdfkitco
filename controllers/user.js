const onLoadController = require('./onLoad');
const shortid = require('shortid');

const usersDB = onLoadController.initialize_SQL_DB;

exports.set_User_Data = async (req, res) => { 
    let userflag = 0;
    usersDB.query(
        "SELECT * FROM users",
        (error, result, fields) => {
            if(error) console.log({ error: error.message });
            result.map((user) => {
                let email = user.email; let lastLogin = new Date();
                lastLogin = lastLogin.getDate() + "-" + (lastLogin.getMonth() + 1) + "-" + lastLogin.getFullYear();
                if(email.localeCompare(req.user.emails[0].value) === 0) { 
                    userflag = 1; 
                    let query = `UPDATE users SET lastLogin = '${lastLogin}' WHERE email = '${email}'`;
                    usersDB.query(
                        query,
                        (error, result) => { if(error) console.log({ error: error.message }) }
                    )
                    return false; 
                }
            });
            if (userflag === 0) {
                const plan = "FREE"; const leftReqs = 10;
                let planStart = new Date(); let planEnd = new Date(); let lastLogin = new Date(); planEnd.setDate(planStart.getDate() + 30);
                planStart = planStart.getDate() + "-" + (planStart.getMonth() + 1) + "-" + planStart.getFullYear();
                planEnd = planEnd.getDate() + "-" + (planEnd.getMonth() + 1) + "-" + planEnd.getFullYear();
                lastLogin = lastLogin.getDate() + "-" + (lastLogin.getMonth() + 1) + "-" + lastLogin.getFullYear();
                let accessToken = shortid.generate() + shortid.generate();
                console.log('request'+req.user);
                usersDB.query(
                    "INSERT INTO users (userName, email, logo, planName, leftReqs, planStart, planEnd, lastLogin, accessToken,customerID) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?)",
                    [req.user.displayName, req.user.emails[0].value, req.user.photos[0].value, plan, leftReqs, planStart, planEnd, lastLogin, accessToken,'123'],
                    (error, result) => { if(error) console.error({ error: error.message }) }
                )
            }
        }
    );
    res.redirect('/');
}

exports.get_User_Data = async (req, res) => {
    let email = req.user.emails[0].value;
    let query = `SELECT * FROM users WHERE email = '${email}'`;
    usersDB.query(
        query,
        (error, result, fields) => {
            return res.json({ result: result[0] });
        }
    );
}

exports.update_User_Plan = async (req, res) => { 
    let email = req.user.emails[0].value;
    let planStart = new Date(); let planEnd = new Date(); let lastLogin = new Date(); planEnd.setDate(planStart.getDate() + 30);
    planStart = planStart.getDate() + "-" + (planStart.getMonth() + 1) + "-" + planStart.getFullYear();
    planEnd = planEnd.getDate() + "-" + (planEnd.getMonth() + 1) + "-" + planEnd.getFullYear();
    let query = `UPDATE users SET planName = '${req.body.planName}', 
    leftReqs = '${parseInt(req.body.leftReqs)}', 
    planStart = '${planStart}', 
    planEnd = '${planEnd}' 
    WHERE email = '${email}'`;
    usersDB.query(
        query,
        (error, result, fields) => {
            return res.json({ result: 'Plan Updated!' });
        }
    );
}

exports.update_Access_Token = async (req, res) => { 
    let email = req.user.emails[0].value;
    let accessToken = shortid.generate() + shortid.generate();
    let query = `UPDATE users SET accessToken = '${accessToken}' WHERE email = '${email}'`;
    usersDB.query(
        query,
        (error, result, fields) => {
            if(error) return res.json({ error: 'Error!' })
            return res.json({ updated_Access_Token: accessToken });
        }
    );
}

exports.user_Logout = (req, res) => { req.session = null; req.logout(); res.redirect('/'); }

exports.redirect_To_Home = async (req, res) => { res.redirect('/set') }