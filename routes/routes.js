var Slack = require('slack-node');
var webhookUri = "__uri___";
var apiToken = "x51w2DbNhw3M17KtqDXoe1li";
var slack = new Slack(apiToken);

var bodyParser = require('body-parser');

var urlencodedParser = bodyParser.urlencoded({extended: false});

var appRouter = function (app) {
    var request = require('request');

    var instanceURL = 'https://esolutionsgroupdemo2.service-now.com';
    var apiURI = '/api/x_esg_vendition_e/slack';
    var encoded = new Buffer('api:apit3st!').toString('base64');

    app.post('/timesheet', urlencodedParser, function (req, res) {
        console.log("Req: " + req.body.token);
        if (req.body.token === apiToken) {
            var json = {
                "text": "You have summoned the Timesheet Wizard!",
                "attachments": [
                    {
                        "text": "Pick your engagement and time worked against it mortal!",
                        "fallback": "My magic is failing today...",
                        "callback_id": req.body.text,
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "actions": [
                            {
                                "name": "engagement_list",
                                "text": "Choose your engagement!",
                                "type": "select",
                                "confirm": {
                                    "title": "Timesheet Confirmation",
                                    "text": "Are you sure you want to submit a timesheet against this engagement for " + req.body.text + " hours?",
                                    "ok_text": "Yes",
                                    "dismiss_text": "No"
                                },
                                "data_source": "external"
                            }
                        ]
                    }
                ]
            };
            res.contentType('application/json');
            res.status(200).send(json);
        } else {
            res.status(401).send("Token does not match expected");
        }
    });

    app.post('/action', urlencodedParser, function (req, res) {
        var json = JSON.stringify(eval("(" + req.body.payload + ")"));
        var actionJSON = JSON.parse(json);
        console.log("Action JSON: " + JSON.stringify(actionJSON));

        if (actionJSON.token === apiToken) {
            var user_id = actionJSON.user.id;
            var action = actionJSON.actions[0].name;
            var callback_id = actionJSON.callback_id;
            if (action === 'engagement_list') {
                if (actionJSON.actions[0].type === "select") {
                    var engagement = actionJSON.actions[0].selected_options[0].value;
                    console.log('Action: ' + action);
                    console.log('User ID: ' + user_id);
                    console.log('Engagement: ' + engagement);
                    console.log('Callback ID: ' + callback_id);
                }
                request({
                    baseUrl: instanceURL,
                    method: 'POST',
                    uri: apiURI + '/engagement_selected',
                    json: true,
                    body: {
                        "engagement": engagement.toString(),
                        "user_id": user_id.toString(),
                        "time_worked": callback_id.toString()
                    },
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
                        console.log("ERROR: " + err);
                        return res.status(418).send(err);
                    }
                });
            }
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