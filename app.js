/*
Main logic of the file-uploader program, creating a server that allows users to
    upload files to a pre-specified AWS S3 bucket, by using a multipart-stream
    instead of saving the file on the server itself.
*/

//Required packages.
const http = require('http');
const AWS = require('aws-sdk');
const formidable = require('formidable');
const credentials = require('./credentials.json'); //AWS Login Credentials found on this file.
const fs = require('fs');
const { fileURLToPath } = require('url');
const { on } = require('events');
const util = require('util');

//Initialize the S3 Bucket.
const s3 = new AWS.S3({
    accessKeyId: credentials.AWS_KEY,
    secretAccessKey: credentials.AWS_SECRET
});

//Initialize the s3 stream tool allowing multipart streams to the S3 bucket.
const s3Stream = require('s3-upload-stream')(s3);

//AWS Bucket information
const bucket = credentials.BucketName;
AWS.config.region = credentials.Location;

//Open the log file.
const logFile = fs.createWriteStream('./logs', {flags : 'a'});

//Creating the http webserver containing the POST request for uploading a file
//  to the S3 Bucket.
http.createServer( (req, res) => {
    if (req.url == '/upload' && req.method.toLowerCase() == 'post') {
        //Initialize Formidable for handling form data.
        let form = new formidable.IncomingForm();

        //Log error in case form init fails.
        form.on('error', (err) => {
            let now = new Date().getUTCDate();
            console.log(err);
            logFile.write(`Error at ${now}: ${err}\n`);
        });

        //Log successful form processing.
        form.on('end', () => {
            let now = new Date().getUTCDate();
            console.log('Success');
            logFile.write(`Success at ${now}\n`);
        });

        //Log Abort operation on form processing.
        form.on('aborted', () => {
            let now = new Date().getUTCDate();
            console.log('Abort');
            logFile.write(`Abort at ${now}\n`);
        });

        //Handling each part of the multipart data stream as to not have
        //  to save the user info on the server but pass it to S3 directly.
        form.onPart = part => {
            console.log(part);

            //Begin uploading parts via s3Stream.
            let upload = s3Stream.upload({
                'Bucket' : bucket,
                'Key' : part.filename
            });

            //Log error in uploading a certain part.
            upload.on('error', (err) => {
                let now = new Date().getUTCDate();
                console.log(err);
                logFile.write(`Part error at ${now} : ${err}\n`);
            });

            //Log part upload on console.
            upload.on('part', (dt) => {
                console.log(dt);
            });

            //Log successful upload.
            upload.on('uploaded', (dt) => {
                let now = new Date().getUTCDate();
                console.log('Upload ended');
                console.log(dt);
                logFile.write(`Upload finished at ${now} : ${dt}\n`);
            });

            part.pipe(upload);
        };

        //Respond to user with a 200 OK code as well as indicating successful
        //  upload.
        form.parse(req, (err, fields, files) => {
            res.writeHead(200, {'Content-Type' : 'text/plain'});
            res.write('Upload Successful:\n');
            res.end(util.inspect({fields: fields, files: files}));
        });

        return;
    }

    //Building the form and frontend of the request.
    res.writeHead(200, {'Content-Type' : 'text/html'});

    res.end(
        `
        <form action="/upload" enctype="multipart/form-data" method="post">\n
        <input type="text" name="title"></br>\n
        <input type="file" name="upload" multiple="multiple"></br>\n
        <input type="submit" value="Upload">\n
        </form>
        `
    );
}).listen(8080);