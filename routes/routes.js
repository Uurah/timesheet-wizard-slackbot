var Slack = require('slack-node');
var webhookUri = "__uri___";
var apiToken = "x51w2DbNhw3M17KtqDXoe1li";
var slack = new Slack(apiToken);

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
        console.log("Req: " + req.body.token);
        var json = {
            "text": "You have summoned the Timesheet Wizard!",
            "attachments": [
                {
                    "text": "Pick your engagement and time worked against it mortal!",
                    "fallback": "My magic is failing today...",
                    "callback_id": "engagement_selected",
                    "color": "#3AA3E3",
                    "attachment_type": "default",
                    "actions": [
                        {
                            "name": "engagement_list",
                            "text": "Choose your engagement!",
                            "type": "select",
                            "confirm": {
                                "title": "Are you sure?",
                                "text": "",
                                "ok_text": "Yes",
                                "dismiss_text": "No"
                            },
                            "data_source": "external",
                        },
                        {
                            "name": "hours",
                            "text": "Hours",
                            "type": "select",
                            "options": [
                                {
                                    "text": "1 Hour",
                                    "value": 1
                                },
                                {
                                    "text": "2 Hours",
                                    "value": 2
                                },
                                {
                                    "text": "3 Hours",
                                    "value": 3
                                },
                                {
                                    "text": "4 Hours",
                                    "value": 4
                                },
                                {
                                    "text": "5 Hours",
                                    "value": 5
                                },
                                {
                                    "text": "6 Hours",
                                    "value": 6
                                },
                                {
                                    "text": "7 Hours",
                                    "value": 7
                                },
                                {
                                    "text": "8 Hours",
                                    "value": 8
                                }
                            ]
                        },
                        {
                            "name": "minutes",
                            "text": "Minutes",
                            "type": "select",
                            "confirm": {
                                "title": "Are you sure?",
                                "text": "",
                                "ok_text": "Yes",
                                "dismiss_text": "No"
                            },
                            "options": [
                                {
                                    "text": "0 Minutes",
                                    "value": 0
                                },
                                {
                                    "text": "15 Minutes",
                                    "value": 15
                                },
                                {
                                    "text": "30 Minutes",
                                    "value": 30
                                },
                                {
                                    "text": "45 Minutes",
                                    "value": 45
                                }
                            ]
                        }
                    ]
                }
            ]
        };
        res.contentType('application/json');
        res.status(200).send(json);
    });

    app.post('/action', urlencodedParser, function (req, res) {
        var json = JSON.stringify(eval("(" + req.body.payload + ")"));
        var actionJSON = JSON.parse(json);
        console.log("Action JSON: " + JSON.stringify(actionJSON));

        if (actionJSON.token === apiToken) {
            if (actionJSON.actions[0].name === 'engagement_list') {
                var action = actionJSON.actions[0].name;
                if (actionJSON.actions[0].type === "select") {
                    var selected_value = actionJSON.actions[0].selected_options[0].value;
                }
                var user_id = actionJSON.user.id;
                var user_name = actionJSON.user.name;
                var callback = actionJSON.callback_id;

                console.log('Action: ' + action);
                console.log('User ID: ' + user_id);
                console.log('User Name: ' + user_name);
                console.log('Selected Value: ' + selected_value);
                console.log('Callback: ' + callback);
            }
            var snJSON = {
                'selected': selected_value,
                'user_id': user_id,
                'user_name': user_name
            };

            request({
                baseUrl: instanceURL,
                method: 'POST',
                uri: apiURI + '/' + callback,
                json: true,
                body: snJSON,
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
        } else {
            console.log("Token from Slack did not match expected token");
        }
    });

    app.post('/options_load', function (req, res) {
        var json = JSON.stringify(eval("(" + req.body.payload + ")"));
        var actionJSON = JSON.parse(json);
        console.log("Action JSON: " + JSON.stringify(actionJSON));
        if (actionJSON.token === apiToken) {
            request({
                baseUrl: instanceURL,
                method: 'POST',
                uri: apiURI + '/options_load',
                json: true,
                body: actionJSON,
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
                    console.log("ERROR: " + err);
                    return res.status(418).send(err);
                }
            });
        }
    });
};

module.exports = appRouter;

/*
Sample of the Actions JSON returned by selecting a choice from a message menu
{
    "actions":[
    {
        "name":"engagement_list",
        "type":"select",
        "selected_options":[
            {
                "value":"f41beda5dbbfb60008ae7c4daf9619f3"
            }
        ]
    }
],
    "callback_id":"timesheet_submit",
    "team":{
    "id":"T402MJHAA",
        "domain":"esolutionsone"
},
    "channel":{
    "id":"D41KQUBJQ",
        "name":"directmessage"
},
    "user":{
    "id":"U41FDUPJP",
        "name":"nic"
},
    "action_ts":"1502915994.115333",
    "message_ts":"1502915991.000302",
    "attachment_id":"1",
    "token":"x51w2DbNhw3M17KtqDXoe1li",
    "is_app_unfurl":false,
    "response_url":"https://hooks.slack.com/actions/T402MJHAA/226978574720/nYbJowZvfsCQ0o7aKWbXoBeC",
    "trigger_id":"227763801077.136089629350.768703a02964401338020ef1db2e6119"
}*/