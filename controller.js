/*
    This file contains most of the S3 logic required to perform all
    of the operations for the API. Each one of the operations has
    its own function, and the path required to activate the function
    is mentioned in the header comment of each function. The header
    also makes it easy to relate the functions in controller.js
    to those in app.js . 
*/

const AWS = require('aws-sdk');
const credentials = require('./resources/credentials.json');
const fs = require('fs');
const { fileURLToPath } = require('url');
const { on } = require('events');
const { mainModule } = require('process');
const util = require('util');
const { resolve } = require('path');

//Initializing AWS S3 SDK
const s3 = new AWS.S3({
    accessKeyId: credentials.AWS_KEY,
    secretAccessKey: credentials.AWS_SECRET
});

//Initializing the S3-Upload-Stream module
const s3Stream = require('s3-upload-stream')(s3);

const bucket = credentials.BucketName;
AWS.config.region = credentials.Location;

const logFile = fs.createWriteStream('./resources/logs', {flags : 'a'});

class Controller {
    // /api/ : GET
    // Get a list of all users currently registered in the bucket
    async getAllUsers() {
        return new Promise((resolve, reject) => {
            let params = {
                Bucket: bucket,
                Delimiter: '/'
            };

            s3.listObjectsV2(params, (err, data) => {
                if (err) {
                    let now = new Date().getUTCDate();
                    logFile.write(`Error getting user list at ${now}: ${err}\n`);
                    reject(err);
                }

                let rawData = data.CommonPrefixes;
                let processed = [];
                for (let i = 0; i < rawData.length; i++) {
                    processed.push(rawData[i].Prefix.slice(0,-1));
                }
                resolve(processed);
            });
        });
    }

    // /api/:id : GET
    // Get a list of all the files associated to a user and their sizes
    async getFiles(userId) {
        return new Promise((resolve, reject) => {
            let params = {
                Bucket: bucket,
                Delimiter: '/',
                Prefix: userId + '/'
            };
    
            s3.listObjectsV2(params, (err, data) => {
                if (err) {
                    let now = new Date().getUTCDate();
                    logFile.write(`Error getting user files at ${now}: ${err}\n`);
                    reject(err);
                } else {
                    const rawData = data.Contents;
                    const processed = [];

                    for (let i = 0; i < rawData.length; i++) {
                        if (rawData[i].Size) {
                            const processedFile = {
                                'name': rawData[i].Key.substring(userId.length + 1),
                                'size': rawData[i].Size
                            }
    
                            processed.push(processedFile);
                        }
                    }
                    resolve(processed);
                }
            });
        })
    }

    // /api/ : POST
    // Create a new user in the bucket
    async createUser(userId) {
        return new Promise((resolve, reject) => {
            let params = {
                Bucket: bucket,
                Key: userId + '/',
                Body: ''
            };

            s3.upload(params, (err, data) => {
                if (err) {
                    let now = new Date().getUTCDate();
                    logFile.write(`Error creating user at ${now}: ${err}\n`);
                    reject(err);
                } 

                let now = new Date().getUTCDate();
                logFile.write(`New user created at ${now}: ${userId}\n`);

                resolve('User created successfully');
            });
        });
    }

    // /api/:id : DELETE
    // Delete a user from the bucket, alongside all the files associated to the
    // user.
    async deleteUser(userId) {
        return new Promise((resolve, reject) => {
            try {
                let params = {
                    Bucket: bucket,
                    Prefix: userId + '/'
                  };
                
                  s3.listObjects(params, (err, data) => {
                    if (err) {
                        let now = new Date().getUTCDate();
                        logFile.write(`Error deleting user at ${now}: ${err}\n`);

                        resolve(err);
                    }
                    if (data.Contents.length == 0) resolve('User not found');
                
                    params = {
                        Bucket: bucket,
                        Delete: { Objects: [] }
                    };
                    
                    data.Contents.forEach((content) => {
                      params.Delete.Objects.push( { Key: content.Key } );
                    });
                
                    s3.deleteObjects(params, (err, data) => {
                        if (err) return callback(err);
                        
                        let now = new Date().getUTCDate();
                        logFile.write(`User deleted at ${now}: ${userId}\n`);

                        resolve('User deleted successfully');
                    });
                  });

            } catch(err) {
                let now = new Date().getUTCDate();
                logFile.write(`Error deleting user at ${now}: ${err}\n`);

                reject(err);
            }
        });
    }

    // /api/:id : POST
    // Upload a file to the associated user 'account' in the bucket
    async uploadFile(userId, form) {
        return new Promise((resolve, reject) => {

            //Log error in case form init fails.
            form.on('error', (err) => {
                let now = new Date().getUTCDate();
                console.log(err);
                logFile.write(`Error uploading file at ${now}: ${err}\n`);
                reject({ message: err });
            });

            //Log successful form processing.
            form.on('end', () => {
                let now = new Date().getUTCDate();
                console.log('Success');
                logFile.write(`Successful file upload at ${now}\n`);
            });

            //Log Abort operation on form processing.
            form.on('aborted', () => {
                let now = new Date().getUTCDate();
                console.log('Abort');
                logFile.write(`Aborted file upload at ${now}\n`);
                reject('Operation Aborted');
            });

            form.onPart = part => {
                //Begin uploading parts via s3Stream.
                let upload = s3Stream.upload({
                    'Bucket' : bucket,
                    'Key' : userId + '/' + part.filename
                });
    
                //Log error in uploading a certain part.
                upload.on('error', (err) => {
                    let now = new Date().getUTCDate();
                    logFile.write(`Part file upload error at ${now} : ${err}\n`);
                    reject(err);
                });
    
                //Log successful upload.
                upload.on('uploaded', (dt) => {
                    let now = new Date().getUTCDate();
                    console.log('Upload ended');
                    logFile.write(`File upload finished at ${now} : ${dt}\n`);
                    resolve('Upload successful');
                });
    
                part.pipe(upload);
            };

        });
    }

    // /api/:id/:file : DELETE
    // Delete a file in the bucket
    async deleteFile(userId, fileName) {
        return new Promise((resolve, reject) => {
            let params = {
                Bucket: bucket,
                Key: userId + '/' + fileName
            };

            s3.deleteObject(params, (err, data) => {
                if (err) {
                    let now = new Date().getUTCDate();
                    logFile.write(`Error deleting file at ${now}: ${err}\n`);

                    reject(err);
                }

                let now = new Date().getUTCDate();
                logFile.write(`File deleted at ${now}: file:${fileName}, user:${userId}\n`);
                resolve('File deleted successfully');
            })
        });
    }

    // /api/:id/:file : GET
    // Download a file from the server
    // TODO: Run tests on file downloading
    async downloadFile(userId, fileName) {
        let params = {
            Bucket: bucket,
            Key: userId + '/' + fileName
        }

        s3.getObject(params, (err, data) => {
            if (err) {
                let now = new Date().getUTCDate();
                logFile.write(`Error downloading file at ${now}: ${err}\n`);

                reject(err);
            }

            let now = new Date().getUTCDate();
            logFile.write(`File downloaded at ${now}: file:${fileName}, user:${userId}\n`);
            resolve(data.Body);
        });
        
    }
}

module.exports = Controller;