var Slack = require('slack-node');
var webhookUri = "__uri___";
var apiToken = "xoxb-227973368807-u7m4nEbyDDZWHNZO3s6yady1";
var verificationToken = "x51w2DbNhw3M17KtqDXoe1li";
var slack = new Slack(apiToken);

var bodyParser = require('body-parser');

var urlencodedParser = bodyParser.urlencoded({extended: false});

var appRouter = function (app) {
    var request = require('request');

    var instanceURL = 'https://esolutionsgroupdemo2.service-now.com';
    var apiURI = '/api/x_esg_vendition_e/slack';
    var encoded = new Buffer('api:apit3st!').toString('base64');

    var messageStore = {};

    app.post('/timesheet', urlencodedParser, function (req, res) {
        console.log("Req: " + req.body.token);
        if (req.body.token === verificationToken) {
            var json = {
                "text": "You have summoned the Timesheet Wizard!",
                "attachments": [
                    {
                        "text": "Pick your engagement and time worked against it mortal!",
                        "fallback": "My magic is failing today...",
                        "callback_id": "engagement_list",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "actions": [
                            {
                                "name": "engagement_select",
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

    app.post('/start', urlencodedParser, function (req, res) {
        console.log("Req: " + JSON.stringify(req.body));
        if (req.body.token === verificationToken) {
            messageStore[req.body.trigger_id] = {
                "start": (new Date().getTime() / 1000),
                "end": '',
                "engagement": '',
                "user": req.body.user_id,
                "channel": req.body.channel_id,
                "time_worked": 0
            };
            var json = {
                "text": "You have summoned the Timesheet Wizard!",
                "attachments": [
                    {
                        "text": "Pick your engagement to track time against mortal!",
                        "fallback": "My magic is failing today...",
                        "callback_id": "start_work",
                        "color": "#3AA3E3",
                        "attachment_type": "default",
                        "actions": [
                            {
                                "name": "engagement_select",
                                "text": "Choose your engagement!",
                                "type": "select",
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

    app.post('/stop', urlencodedParser, function (req, res) {
        console.log("Req: " + req.body.token);
        if (req.body.token === verificationToken) {
            messageStore[req.body.message_ts].end = (new Date().getTime() / 1000);
            var time_worked = parseFloat((messageStore[req.body.message_ts].end - messageStore[req.body.message_ts].start) / 3600);
            messageStore[req.body.message_ts].time_worked = time_worked;
            var additional_time = [{
                //text: "By my calculations, you have worked " + time_worked + " hours against the current engagement.",
                fallback: "Cannot Display Buttons",
                title: "Is this correct?",
                callback_id: "submit_stopwatch",
                color: "#3AA3E3",
                attachment_type: "default",
                actions: [
                    {
                        name: "yes",
                        text: "Yes",
                        type: "button",
                        value: "yes"
                    },
                    {
                        name: "no",
                        text: "No",
                        type: "button",
                        value: "no"
                    }
                ]

            }];
            slack.api('chat.postEphemeral', {
                //text: body.result.text,
                channel:  messageStore[req.body.message_ts].channel,
                user:  messageStore[req.body.message_ts].user,
                attachments: JSON.stringify(additional_time)
            }, function (err, response) {
                console.log("Response: " + JSON.stringify(response));
                if (!err && response.ok === true) {
                    console.log("Body: " + response);
                    res.status(200).send("By my calculations, you have worked " + time_worked + " hours against the current engagement.");
                } else {
                    console.log("Failed");
                    res.status(400).send(err);
                }
            });
        } else {
            res.status(401).send("Token does not match expected");
        }
    });

    app.post('/action', urlencodedParser, function (req, res) {
        var json = JSON.stringify(eval("(" + req.body.payload + ")"));
        var actionJSON = JSON.parse(json);
        console.log("Action JSON: " + JSON.stringify(actionJSON));

        if (actionJSON.token === verificationToken) {

            var user_id = actionJSON.user.id;
            var action = actionJSON.actions[0].name;
            var callback_id = actionJSON.callback_id;

            if(callback_id === 'start_work') {
                for (var key in messageStore) {
                    if (messageStore.hasOwnProperty(key)) {
                        console.log("Message Store Key " + key + " and user " + messageStore[key].user);
                        if (key.user === user_id) {
                            console.log("Found Match in Message Store");
                            messageStore[actionJSON.message_ts] = messageStore[key];
                            messageStore[actionJSON.message_ts].engagement = actionJSON.actions[0].selected_options[0].value;
                            res.contentType('application/json');
                            res.status(200).send({ "text": "Fine, I will keep track of this engagement for you.  Type /stop when you are finished working."});
                            delete messageStore[key];
                        }
                    }
                }
            }

            if (callback_id === 'submit_stopwatch') {
                request({
                    baseUrl: instanceURL,
                    method: 'POST',
                    uri: apiURI + '/engagement_selected',
                    json: true,
                    body: {
                        "user": messageStore[actionJSON.message_ts].engagement.user,
                        "engagement": messageStore[actionJSON.message_ts].engagement,
                        "time_worked": messageStore[actionJSON.message_ts].time_worked
                    },
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

            if (callback_id === 'engagement_list') {
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
                        console.log("SUCCESS: " + body.result);
                        return res.status(200).send(body.result);
                    } else {
                        console.log("ERROR: " + err);
                        return res.status(418).send(err);
                    }
                });
            }
            if (callback_id === 'enter_time') {
                if (action === 'yes') {
                    console.log("Wants to enter time");
                    messageStore[actionJSON.message_ts] = {
                        "engagement": null,
                        "hours": null
                    };
                    var twjson = {
                        "text": "You have summoned the Timesheet Wizard!",
                        "attachments": [
                            {
                                "text": "Pick your engagement mortal!",
                                "fallback": "My magic is failing today...",
                                "callback_id": "engagement_selected",
                                "color": "#3AA3E3",
                                "attachment_type": "default",
                                "actions": [
                                    {
                                        "name": "engagement_select",
                                        "text": "Choose your engagement!",
                                        "type": "select",
                                        "data_source": "external"
                                    }
                                ]
                            }
                        ]
                    };
                    res.contentType('application/json');
                    res.status(200).send(twjson);
                }
                if (action === 'no') {
                    console.log("Does not want to enter time");
                    res.status(200).send({"text": "Then begone with you!"});
                }
            }
            if (callback_id === 'engagement_selected') {
                if ( messageStore[actionJSON.message_ts].hasOwnProperty('engagement')) {
                    messageStore[actionJSON.message_ts].engagement = actionJSON.actions[0].selected_options[0].value;
                    console.log("Engagement: " + messageStore[actionJSON.message_ts].engagement);
                } else {
                    console.log("Missing engagement property");
                }
                var es = {
                    "text": "",
                    "attachments": [
                        {
                            "text": "How many hours have you worked against this engagement?",
                            "fallback": "My magic is failing today...",
                            "callback_id": "hours_entered",
                            "color": "#3AA3E3",
                            "attachment_type": "default",
                            "actions": [
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
                                }
                            ]
                        }
                    ]
                };
                res.contentType('application/json');
                res.status(200).send(es);
            }
            if (callback_id === 'hours_entered') {
                if ( messageStore[actionJSON.message_ts].hasOwnProperty('hours')) {
                    messageStore[actionJSON.message_ts].hours = actionJSON.actions[0].selected_options[0].value;
                    console.log("Hours: " + messageStore[actionJSON.message_ts].hours);
                } else {
                    console.log("Missing hours property");
                }
                if (messageStore[actionJSON.message_ts].hours !== null && messageStore[actionJSON.message_ts].engagement !== null) {
                    request({
                        baseUrl: instanceURL,
                        method: 'POST',
                        uri: apiURI + '/engagement_selected',
                        json: true,
                        body: {
                            "user": user_id,
                            "engagement": messageStore[actionJSON.message_ts].engagement,
                            "time_worked": messageStore[actionJSON.message_ts].hours
                        },
                        headers: {
                            'Authorization': 'basic ' + encoded,
                            'accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }, function (err, response, body) {
                        if (!err && response.statusCode === 200) {
                            console.log("SUCCESS: " + JSON.stringify(body.result.text));
                            delete messageStore[actionJSON.message_ts];
                            var additional_time = [{
                                //text: body.result.text,
                                fallback: "Cannot Display Buttons",
                                title: "Would you like to enter time against an additional engagement?",
                                callback_id: "enter_time",
                                color: "#3AA3E3",
                                attachment_type: "default",
                                actions: [
                                    {
                                        name: "yes",
                                        text: "Yes",
                                        type: "button",
                                        value: "yes"
                                    },
                                    {
                                        name: "no",
                                        text: "No",
                                        type: "button",
                                        value: "no"
                                    }
                                ]

                            }];
                            slack.api('chat.postEphemeral', {
                                //text: body.result.text,
                                channel: 'C40P434P6',
                                user: user_id,
                                attachments: JSON.stringify(additional_time)
                            }, function(err, response){
                                console.log("Response: " + JSON.stringify(response));
                                if (!err && response.ok === true) {
                                    console.log("Body: " + response);
                                    res.status(200).send(body.result.text);
                                } else {
                                    console.log("Failed");
                                    res.status(400).send(err);
                                }
                            });
                        } else {
                            console.log("ERROR: " + err);
                            return res.status(418).send({ "text": "Could not create timesheet."});
                        }
                    });
                } else {
                    console.log("Message Store is missing one or more parameters needed to send to SNOW");
                }
            }
            else {
                console.log("Callback_id does not match any expected");
            }

        } else {
            console.log("Token from Slack did not match expected token");
        }
    });

    app.post('/options_load', function (req, res) {
        var json = JSON.stringify(eval("(" + req.body.payload + ")"));
        var actionJSON = JSON.parse(json);
        console.log("Action JSON: " + JSON.stringify(actionJSON));
        if (actionJSON.token === verificationToken) {
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

    app.post('/timesheet_check', function (req, res) {
        console.log("Request: " + JSON.stringify(req.body));
        //var json = JSON.stringify(eval("(" + req.body.payload + ")"));
        //var actionJSON = JSON.parse(json);
        //console.log("Action JSON: " + JSON.stringify(actionJSON));
        var attachments = [{
                fallback: "This attachment isn't supported.",
                title: "Your Daily Engagement Summary",
                color: "#9c4c0d",
                fields: [{
                    title: "Engagement",
                    value: req.body.engagements,
                    short: true
                }, {
                    title: "Hours Worked Today",
                    value: req.body.hours,
                    short: true
                }],
                mrkdwn_in: ["text", "fields"],
                text: ""
            },
            {
                fallback: "Cannot Display Buttons",
                title: "Would you like to create a timesheet for one of these engagements?",
                callback_id: "enter_time",
                color: "#3AA3E3",
                attachment_type: "default",
                actions: [
                    {
                        name: "yes",
                        text: "Yes",
                        type: "button",
                        value: "yes"
                    },
                    {
                        name: "no",
                        text: "No",
                        type: "button",
                        value: "no"
                    }
                ]
            }];
        slack.api('chat.postEphemeral', {
            text:'Engagement Summary',
            channel: 'C40P434P6',
            user: req.body.user,
            attachments: JSON.stringify(attachments)
        }, function(err, response){
            console.log("Response: " + JSON.stringify(response));
            if (!err && response.ok === true) {
                console.log("Body: " + response);
                res.status(200).send(response);
            } else {
                console.log("Failed");
                res.status(400).send(err);
            }
        });
    });
};

module.exports = appRouter;