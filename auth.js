const readline = require('readline');
const fs = require('fs');
const { google } = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
const TOKEN_PATH = 'token.json';

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
            if (err) throw err;
            // Store the token to disk for later program executions
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(token), (err) => {
                if (err) throw err;
                console.log('Token stored to', TOKEN_PATH);
            });
            callback();
        });
    });
}

(function main() {
    try {
        // Load client secrets from a local file.
        const credentials = fs.readFileSync('credentials.json');

        // Authorize a client with credentials and save the tokens in a file
        const { client_secret, client_id, redirect_uris } = JSON.parse(credentials).installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        getAccessToken(oAuth2Client, () => {
            console.log('Authenticated and created token file successfully!');
            process.exit(0);
        });
    } catch (err) {
        console.log('Error:', err);
    }
})();
