const app = require('./app');

app.handler(null, null, (_, message) => {
    console.log('FINAL CALLBACK:', message);
});
