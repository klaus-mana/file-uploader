/*
    app.js handles the routing of the API, as well as performing the
    appropriate operation based on the user requests.
*/

const http = require('http');
const formidable = require('formidable');
const fs = require('fs');
const { fileURLToPath } = require('url');
const util = require('util');
const Controller = require('./controller');
const formData = require('./utils');

const logFile = fs.createWriteStream('./logs', {flags : 'a'});
const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
    // /api : GET
    if (req.url === '/api' && req.method === 'GET') {
        const users = await new Controller().getAllUsers();

        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify(users));
    }

    // /api/:id : GET
    else if (req.url.match(/\/api\/([a-zA-Z0-9]+)/) && req.method === 'GET') {
        try {
            const userId = req.url.split('/')[2];
            const files = await new Controller().getFiles(userId);

            res.writeHead(200, {'Content-Type':'application/json'});
            res.end(JSON.stringify(files));
        } catch(err) {
            res.writeHead(404, {'Content-Type': 'application/json'});

            res.end(JSON.stringify({ message: err})); 
        }
        
    }

    // /api/:id/:file : GET
    // TODO: Figure out Content-Disposition headers & initiating file download
    // TODO: Test file download capability
    // TODO: If direct file download too difficult/taxing, figure out a way to display a direct download link from S3 to user, and how to pull that information using AWS SDK
    else if (req.url.match(/\/api\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)\.?([a-zA-Z0-9]+)/) && req.method === 'GET') {
        try {
            let userId = req.url.split('/')[2];
            let fileName = req.url.split('/')[3];

            const file = await new Controller().downloadFile(userId, fileName);

            res.writeHead(200, {
            'Content-Type':'application/octet-stream', 'Content-Disposition':'attachment',
            'filename':fileName
            });

            res.end(file);
        } catch(err) {
            res.writeHead(404, {'Content-Type': 'application/json'});

            res.end(JSON.stringify({ message: err}));
        }
    }

    // /api : POST
    // Instructions: POST a raw JSON object of  the form:
    // {userId:'userId'}
    else if(req.url === '/api' && req.method === 'POST') {
        let rawData = await formData(req);
        let userId = rawData.userId;
        let user = await new Controller().createUser(userId);

        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({message: 'User created successfully'}));
    }
    
    
    // /api/:id : POST
    // Instructions: POST a multipart form containing a 'file' field for the
    // file.
    else if (req.url.match(/\/api\/([a-zA-Z0-9]+)/) && req.method === 'POST') {
        //Initialize Formidable for handling form data.
        let form = new formidable.IncomingForm();

        try {
            const upload = new Controller().uploadFile('klaus', form);
        } catch(err) {
            //log error on file
            console.log(err);
        }

        //Respond to user with a 200 OK code as well as indicating successful
        //  upload.
        form.parse(req, (err, fields, files) => {
            res.writeHead(200, {'Content-Type' : 'application/json'});
            res.write('Upload Successful:\n');
            res.end(util.inspect({fields: fields, files: files}));
        });
    }

    // /api/:id : DELETE
    else if (req.url.match(/\/api\/([a-zA-Z0-9]+)/) && req.method === 'DELETE') {
        try {
            let userId = req.url.split('/')[2];

            let success = await new Controller().deleteUser(userId);

            res.writeHead(200, {'Content-Type':'application/json'});
            res.end(JSON.stringify({message: success}));
        } catch(err) {
            res.writeHead(404, {'Content-Type': 'application/json'});

            res.end(JSON.stringify({ message: err}));
        }
    }

    // /api/:id/:file : DELETE
    else if (req.url.match(/\/api\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)\.?([a-zA-Z0-9]+)/) && req.method === 'DELETE') {
        try {
            let userId = req.url.split('/')[2];
            let fileName = req.url.split('/')[3];

            const success = new Controller().deleteFile(userId, fileName);

            res.writeHead(200, {'Content-Type':'application/json'});
            res.end(JSON.stringify({message: success}));
        } catch(err) {
            res.writeHead(404, {'Content-Type': 'application/json'});

            res.end(JSON.stringify({ message: err}));
        }
    }

    // Incorrect route
    else {
        res.writeHead(404, { 'Content-Type': 'application/json' });

        res.end(JSON.stringify({ message: '404 Not Found' }));
    }    
});

server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
