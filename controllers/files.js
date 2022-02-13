require('dotenv').config();
const onLoadController = require('./onLoad');
const puppeteer = require('puppeteer');
const AWS = require('aws-sdk');
const fs = require('fs');

AWS.config.update({
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    region: process.env.AWS_REGION,
});

const S3 = new AWS.S3();

const usersDB = onLoadController.initialize_SQL_DB;

exports.generate_Object_File = async (req, res) => {
    try {
        console.log(req);
        const chromeOptions = { headless: true, defaultViewport: null, args: [ 
            "--incognito", 
            "--no-sandbox", 
            "--single-process", 
            "--no-zygote", 
            '--disable-setuid-sandbox', 
            '--disable-accelerated-2d-canvas', 
            '--no-first-run', 
            '--single-process', 
            '--disable-gpu' 
        ]};
        console.log('12345');
        console.log(JSON.stringify(req.body));
        let link = req.body.link || 'https://www.google.com/', type = req.body.type || 'pdf'; let pdf, ss;
        let fileName = (new URL(link)).hostname.replace('www.','').split('.')[0] + '#' + (Math.floor(1000 + Math.random() * 9000)).toString(),
        scale = req.body.scale || 1, printBackground = req.body.printBackground || false, landscape = req.body.landscape || false, 
        pageRanges = req.body.pageRanges || '', format = req.body.format || 'A4', marginTop = req.body.marginTop || 0, 
        marginBottom = req.body.marginBottom || 0, marginLeft = req.body.marginLeft || 0, marginRight = req.body.marginRight || 0,
        quality = req.body.quality || 80, fullPage = req.body.fullPage || false, omitBackground = req.body.omitBackground || false, timeStamp = new Date();
        //user logged in
        if(req.user !== undefined) {
            let query = `SELECT leftReqs FROM users WHERE email = '${req.user.emails[0].value}'`;
            usersDB.query(
                query,
                async (error, result, fields) => {
                    console.log(result[0].leftReqs);
                    console.log(type);
                    if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                    else if(result[0].leftReqs > 0 || type !== 'pdf') {
                        let leftReqs = result[0].leftReqs;
                        const browser = await puppeteer.launch(chromeOptions);
                        const page = await browser.newPage();
                        await page.goto(link, { waitUntil: 'networkidle2' }, { waitUntil: 'domcontentloaded' });
                        if(type === 'screenshot') {
                            if(fullPage) { await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) }); }
                            try {
                                ss = await page.screenshot({ 
                                    path: fileName + '.jpg', 
                                    type: 'jpeg', 
                                    quality: quality, 
                                    fullPage: fullPage, 
                                    omitBackground: omitBackground
                                });
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            const params = {
                                Bucket: process.env.AWS_BUCKET_NAME + '/ss',
                                Key: fileName + '.jpg',
                                Body: ss,
                                ContentType: 'image/jpeg'
                            };
                            try{
                                await S3.putObject(params).promise();
                                fs.unlinkSync('./' + fileName + '.jpg');
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/ss/' + fileName.replace('#', '%23') + '.jpg';
                            usersDB.query(
                                "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                                [req.user.emails[0].value, type, fileName, link, object_link, timeStamp],
                                (error, result) => { 
                                    if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                                    usersDB.query(
                                        "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                        [fileName, type, quality, fullPage, omitBackground, 0, false, false, '', 'NA', 0, 0, 0, 0],
                                        (error, result) => { if(error) { console.error(error); }}
                                    )
                                    return res.json({ object_link: object_link });
                                }
                            );
                        } else if(type === 'pdf') { 
                            await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) });
                            try {
                                pdf = await page.pdf({ 
                                    path: fileName + '.pdf',
                                    displayHeaderFooter: false,
                                    footerTemplate: `
                                        <div style="background-color: black; color: white; font-size: 20px; margin-top: 70px; text-align: center; width: 100%;">
                                            Welcome By - PDFKit.co
                                        </div>
                                    `,
                                    scale: scale,
                                    printBackground: printBackground,
                                    landscape: landscape, 
                                    pageRanges: pageRanges, 
                                    format: format,
                                    margin: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight }
                                });
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            const params = {
                                Bucket: process.env.AWS_BUCKET_NAME + '/pdf',
                                Key: fileName + '.pdf',
                                Body: pdf,
                                ContentType: 'application/pdf'
                            };
                            try{
                                await S3.putObject(params).promise();
                                fs.unlinkSync('./' + fileName + '.pdf');
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/pdf/' + fileName.replace('#', '%23') + '.pdf';
                            usersDB.query(
                                "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                                [req.user.emails[0].value, type, fileName, link, object_link, timeStamp],
                                (error, result) => { 
                                    if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                                    else {
                                        leftReqs = leftReqs - 1;
                                        let query = `UPDATE users SET leftReqs = '${leftReqs}' WHERE email = '${req.user.emails[0].value}'`;
                                        usersDB.query(
                                            query,
                                            (error, result, fields) => {
                                                if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                                                usersDB.query(
                                                    "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                                    [fileName, type, 0, false, false, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight],
                                                    (error, result) => { if(error) { console.error(error); }}
                                                )
                                                return res.json({ 
                                                    object_link: object_link, 
                                                    leftReqs: leftReqs
                                                });
                                            }
                                        );
                                    }
                                }
                            );
                        }
                        await browser.close();
                    }
                    else return res.json({ error: 'You have expired all your requests for the month' });
                }
            );
        } else {
            const browser = await puppeteer.launch(chromeOptions);
            const page = await browser.newPage();
            await page.goto(link, { waitUntil: 'networkidle2' }, { waitUntil: 'domcontentloaded' });
            console.log(type);
            if(type === 'screenshot') {
                if(fullPage) { await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) }); }
                try {
                    ss = await page.screenshot({ 
                        path: fileName + '.jpg', 
                        type: 'jpeg', 
                        quality: quality, 
                        fullPage: fullPage, 
                        omitBackground: omitBackground
                    });
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME + '/ss',
                    Key: fileName + '.jpg',
                    Body: ss,
                    ContentType: 'image/jpeg'
                };
                try{
                    await S3.putObject(params).promise();
                    fs.unlinkSync('./' + fileName + '.jpg');
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/ss/' + fileName.replace('#', '%23') + '.jpg';
                usersDB.query(
                    "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                    [req.fingerprint.hash, type, fileName, link, object_link, timeStamp],
                    (error, result) => { 
                        if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                        usersDB.query(
                            "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [fileName, type, quality, fullPage, omitBackground, 0, false, false, '', 'NA', 0, 0, 0, 0],
                            (error, result) => { if(error) { console.error(error); }}
                        )
                        return res.json({ object_link: object_link, });
                    }
                );
            } else if(type === 'pdf') { 
                await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) });
                try {
                    pdf = await page.pdf({ 
                        path: fileName + '.pdf',
                        displayHeaderFooter: true,
                        footerTemplate: `
                            <div style="background-color: black; color: white; font-size: 20px; margin-top: 70px; text-align: center; width: 100%;">
                                193 By - PDFKit.co
                            </div>
                        `,
                        scale: scale,
                        printBackground: printBackground,
                        landscape: landscape, 
                        pageRanges: pageRanges, 
                        format: format,
                        margin: { top: marginTop, bottom: 80, left: marginLeft, right: marginRight }
                    });
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME + '/pdf',
                    Key: fileName + '.pdf',
                    Body: pdf,
                    ContentType: 'application/pdf'
                };
                try{
                    await S3.putObject(params).promise();
                    fs.unlinkSync('./' + fileName + '.pdf');
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/pdf/' + fileName.replace('#', '%23') + '.pdf';
                usersDB.query(
                    "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                    [req.fingerprint.hash, type, fileName, link, object_link, timeStamp],
                    (error, result) => { 
                        if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                        usersDB.query(
                            "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                           [fileName, type, 0, false, false, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight],
                            (error, result) => { if(error) { console.error(error); }}
                        )
                        return res.json({ object_link: object_link })
                    }
                );
            }
            await browser.close();
        }
    } catch (e) { res.status(500); }
}

exports.generate_Object_File_API = async (req, res) => {
    //console.log(req);
   // console.log(req.body.link);
    console.log(req.body.accessToken);
    try {
        const chromeOptions = { headless: true, defaultViewport: null, args: [ 
            "--incognito", 
            "--no-sandbox", 
            "--single-process", 
            "--no-zygote", 
            '--disable-setuid-sandbox', 
            '--disable-accelerated-2d-canvas', 
            '--no-first-run', 
            '--single-process', 
            '--disable-gpu' 
        ]};
        let link = req.body.link || 'https://www.google.com/', type = req.body.type || 'pdf'; let pdf, ss;
        let fileName = (new URL(link)).hostname.replace('www.','').split('.')[0] + '#' + (Math.floor(1000 + Math.random() * 9000)).toString(),
        scale = req.body.scale || 1, printBackground = req.body.printBackground || false, landscape = req.body.landscape || false, 
        pageRanges = req.body.pageRanges || '', format = req.body.format || 'A4', marginTop = req.body.marginTop || 0, 
        marginBottom = req.body.marginBottom || 0, marginLeft = req.body.marginLeft || 0, marginRight = req.body.marginRight || 0,
        quality = req.body.quality || 80, fullPage = req.body.fullPage || false, omitBackground = req.body.omitBackground || false, timeStamp = new Date();
        let accessToken = req.body.accessToken || 'NA'
        if(accessToken !== 'NA') {
            let query = `SELECT email, leftReqs FROM users WHERE accessToken = '${accessToken}'`,
            leftReqs, email;
            usersDB.query(
                query,
                async (error, result, fields) => {
                    if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                    if(result[0] === undefined) { return res.json({ error: 'Error!' }); }
                    else if(result[0].leftReqs > 0 || type !== 'pdf') {
                        leftReqs = result[0].leftReqs;
                        email = result[0].email;
                        const browser = await puppeteer.launch(chromeOptions);
                        const page = await browser.newPage();
                        try {
                        await page.goto(link, { waitUntil: 'networkidle2' }, { waitUntil: 'domcontentloaded' });
                    } catch(e) { return res.json({ error: 'Please enter valid URL' }) }
                       // console.log(qwe);
                        if(type === 'screenshot') {
                            if(fullPage) { await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) }); }
                            try {
                                ss = await page.screenshot({ 
                                    path: fileName + '.jpg', 
                                    type: 'jpeg', 
                                    quality: quality, 
                                    fullPage: fullPage, 
                                    omitBackground: omitBackground
                                });
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            const params = {
                                Bucket: process.env.AWS_BUCKET_NAME + '/ss',
                                Key: fileName + '.jpg',
                                Body: ss,
                                ContentType: 'image/jpeg'
                            };
                            try{
                                await S3.putObject(params).promise();
                                fs.unlinkSync('./' + fileName + '.jpg');
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/ss/' + fileName.replace('#', '%23') + '.jpg';
                            usersDB.query(
                                "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                                [email, type, fileName, link, object_link, timeStamp],
                                (error, result) => { 
                                    if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                                    usersDB.query(
                                        "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                        [fileName, type, quality, fullPage, omitBackground, 0, false, false, '', 'NA', 0, 0, 0, 0],
                                        (error, result) => { if(error) { console.error(error); }}
                                    )
                                    return res.json({ object_link: object_link, });
                                }
                            );
                        } else if(type === 'pdf') { 
                          let a=  await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) });
                          console.log(a);
                            try {
                                pdf = await page.pdf({ 
                                    path: fileName + '.pdf',
                                    displayHeaderFooter: false,
                                    footerTemplate: `
                                        <div style="background-color: black; color: white; font-size: 20px; margin-top: 70px; text-align: center; width: 100%;">
                                            311Powered By - PDFKit.co
                                        </div>
                                    `,
                                    scale: scale,
                                    printBackground: printBackground,
                                    landscape: landscape, 
                                    pageRanges: pageRanges, 
                                    format: format,
                                    margin: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight }
                                });
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            const params = {
                                Bucket: process.env.AWS_BUCKET_NAME + '/pdf',
                                Key: fileName + '.pdf',
                                Body: pdf,
                                ContentType: 'application/pdf'
                            };
                            try{
                                await S3.putObject(params).promise();
                                fs.unlinkSync('./' + fileName + '.pdf');
                            } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                            let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/pdf/' + fileName.replace('#', '%23') + '.pdf';
                            usersDB.query(
                                "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                                [email, type, fileName, link, object_link, timeStamp],
                                (error, result) => { 
                                    if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                                    else {
                                        leftReqs = leftReqs - 1;
                                        let query = `UPDATE users SET leftReqs = '${leftReqs}' WHERE accessToken = '${accessToken}'`;
                                        usersDB.query(
                                            query,
                                            (error, result, fields) => {
                                                if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                                                usersDB.query(
                                                    "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                                    [fileName, type, 0, false, false, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight],
                                                    (error, result) => { if(error) { console.error(error); }}
                                                )
                                                return res.json({ 
                                                    object_link: object_link,
                                                    leftReqs: leftReqs
                                                });
                                            }
                                        );
                                    }
                                }
                            );
                        }
                        await browser.close();
                    }
                    else return res.json({ error: 'You have expired all your requests for the month' });
                }
            );
        } else {
            const browser = await puppeteer.launch(chromeOptions);
            const page = await browser.newPage();
            await page.goto(link, { waitUntil: 'networkidle2' }, { waitUntil: 'domcontentloaded' });
            if(type === 'screenshot') {
                if(fullPage) { await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) }); }
                try {
                    ss = await page.screenshot({ 
                        path: fileName + '.jpg', 
                        type: 'jpeg', 
                        quality: quality, 
                        fullPage: fullPage, 
                        omitBackground: omitBackground
                    });
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME + '/ss',
                    Key: fileName + '.jpg',
                    Body: ss,
                    ContentType: 'image/jpeg'
                };
                try{
                    await S3.putObject(params).promise();
                    fs.unlinkSync('./' + fileName + '.jpg');
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/ss/' + fileName.replace('#', '%23') + '.jpg';
                usersDB.query(
                    "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                    [req.fingerprint.hash, type, fileName, link, object_link, timeStamp],
                    (error, result) => { 
                        if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                        usersDB.query(
                            "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [fileName, type, quality, fullPage, omitBackground, 0, false, false, '', 'NA', 0, 0, 0, 0],
                            (error, result) => { if(error) { console.error(error); }}
                        )
                        return res.json({ object_link: object_link, });
                    }
                );
            } else if(type === 'pdf') { 
                await page.evaluate(() => { window.scrollTo(0,window.document.body.scrollHeight) });
                try {
                    pdf = await page.pdf({ 
                        path: fileName + '.pdf',
                        displayHeaderFooter: false,
                        footerTemplate: `
                            <div style="background-color: black; color: white; font-size: 20px; margin-top: 70px; text-align: center; width: 100%;">
                               412 Powered By - PDFKit.co
                            </div>
                        `,
                        scale: scale,
                        printBackground: printBackground,
                        landscape: landscape, 
                        pageRanges: pageRanges, 
                        format: format,
                        margin: { top: marginTop, bottom: 80, left: marginLeft, right: marginRight }
                    });
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                let object_link = 'https://pdf-ss-generator.s3.ap-south-1.amazonaws.com/pdf/' + fileName.replace('#', '%23') + '.pdf'
                const params = {
                    Bucket: process.env.AWS_BUCKET_NAME + '/pdf',
                    Key: fileName + '.pdf',
                    Body: pdf,
                    ContentType: 'application/pdf'
                };
                try{
                    await S3.putObject(params).promise();
                    fs.unlinkSync('./' + fileName + '.pdf');
                } catch(e) { return res.json({ error: 'Error occured while converting!' }) }
                usersDB.query(
                    "INSERT INTO history (user_id, object_type, object_id, query_link, object_link, timeStamp) VALUES (?, ?, ?, ?, ?, ?)",
                    [req.fingerprint.hash, type, fileName, link, object_link, timeStamp],
                    (error, result) => { 
                        if(error) { console.error(error); return res.json({ error: 'Error!' }); }
                        usersDB.query(
                            "INSERT INTO metadata (object_id, object_type, quality, fullPage, omitBackground, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            [fileName, type, 0, false, false, scale, printBackground, landscape, pageRanges, format, marginTop, marginBottom, marginLeft, marginRight],
                            (error, result) => { if(error) { console.error(error); }}
                        )
                        return res.json({ object_link: object_link })
                    }
                );
            }
            await browser.close();
        }
    } catch (e) { res.status(500); }
}