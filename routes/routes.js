var Slack = require('slack-node');
webhookUri = "__uri___";
apiToken = "x51w2DbNhw3M17KtqDXoe1li";
slack = new Slack(apiToken);

var bodyParser = require('body-parser');

var urlencodedParser = bodyParser.urlencoded({extended: false})

var appRouter = function (app) {
    var request = require('request');

    var crypto;
    var algorithm = 'aes-256-ctr';
    var password = 'd6F3Efeq';
    try {
        crypto = require('crypto');
    } catch (err) {
        console.log('crypto support is disabled!');
    }

    var sessionStore = {};
    var sessionID = 0;

    var instanceURL = 'https://esolutionsgroupdemo2.service-now.com';
    var apiURI = '/api/x_esg_vendition_e/slack';
    var encoded = new Buffer('api:apit3st!').toString('base64');

    function encrypt(text, res, body) {
        var cipher = crypto.createCipher(algorithm, password);
        var crypted = cipher.update(text, 'utf8', 'hex');
        crypted += cipher.final('hex');

        function storeSession(key, text) {
            body = [sessionID, key];
            sessionStore[sessionID] = {"key": key, "text": text, "timeout": null};
            console.log("storeSession ID: " + sessionID);
            console.log("storeSession KEY: " + sessionStore[sessionID].key);
            console.log("storeSession TEXT: " + sessionStore[sessionID].text);
            sessionID += 1;
            return res.status(200).send(body);
        }

        storeSession(crypted, text);
    }

    function decrypt(text) {
        var decipher = crypto.createDecipher(algorithm, password);
        var dec = decipher.update(text, 'hex', 'utf8');
        dec += decipher.final('utf8');
        return dec;
    }

    function checkSession(id, key) {
        console.log("CHECKSESSION ID: " + id);
        console.log("CHECKSESSION KEY: " + sessionStore[id].text);
        console.log("DECRYPT: " + decrypt(key));
        if (decrypt(key) === sessionStore[id].text) {
            console.log("AUTH: Keys Matched");
            return true;
        } else {
            console.log("AUTH ERROR: Keys Did Not Match");
            return false;
        }
    }

    app.post('/timesheet', urlencodedParser, function (req, res) {
        request({
            baseUrl: instanceURL,
            method: 'POST',
            uri: apiURI + '/timesheet',
            json: true,
            body: req.body,
            headers: {
                'Authorization': 'basic ' + encoded,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                console.log("SUCCESS: " + body.result);
                return res.status(200).send(body.result);
            } else {
                console.log("ERROR: " + body);
                return res.status(418).send(body);
            }
        });
    });

    app.post('/action', urlencodedParser, function (req, res) {
        console.log('Request: ' + req);
        console.log("Request Payload: " + JSON.stringify(req.body.payload));
        //var actionJSON = req.body.payload.actions;
        var actionJSON = JSON.stringify(eval("(" + req.body.payload + ")"));
        console.log("Actions: " + actionJSON);

        var action = actionJSON.actions.name;
        var user_id = actionJSON.actions.user.id;
        var user_name = actionJSON.actions.user.name;
        var selected_value = actionJSON.actions.selected_options.value;
        var callback = actionJSON.actions.callback_id;

        console.log('Action: ' + action);
        console.log('User ID: ' + user_id);
        console.log('User Name: ' + user_name);
        console.log('Selected Value: ' + selected_value);
        console.log('Callback: ' + callback);

        request({
            baseUrl: instanceURL,
            method: 'POST',
            uri: apiURI + '/action',
            json: true,
            body: req.body,
            headers: {
                'Authorization': 'basic ' + encoded,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                console.log("SUCCESS: " + body);
                return res.status(200).send(body);
            } else {
                console.log("ERROR: " + body);
                return res.status(418).send(body);
            }
        });
    });

    app.post('/options_load', urlencodedParser, function (req, res) {
        request({
            baseUrl: instanceURL,
            method: 'POST',
            uri: apiURI + '/options_load',
            json: true,
            body: req.body,
            headers: {
                'Authorization': 'basic ' + encoded,
                'accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }, function (err, response, body) {
            if (!err && response.statusCode === 200) {
                console.log("SUCCESS: " + body);
                return res.status(200).send(body);
            } else {
                console.log("ERROR: " + body);
                return res.status(418).send(body);
            }
        });
    });
};

module.exports = appRouter;