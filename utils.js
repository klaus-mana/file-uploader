/*
    Handles basic API functionality, retreiving client data to use
    on the server.
*/

function getFormData(req) {
    return new Promise((resolve, reject) => {
        try {
            let body = '';

            req.on('data', (chunk) => {
                body += chunk.toString();
            });

            req.on('end', () => {
                resolve(body);
            });
        } catch(err) {
            reject(err);
        }
    });
}

module.exports = { getFormData }