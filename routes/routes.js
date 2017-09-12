var appRouter = function (app) {

    //Require Libraries
    var Slack = require('slack-node');
    var request = require('request');
    var bodyParser = require('body-parser');

    //Set App name based on environment
    var app_name;
    if (process.env.ENVIRONMENT === 'development') {
        app_name = 'quiet-hollows-84294';
    }
    else if (process.env.ENVIRONMENT === 'production') {
        app_name = '';
    }

    //Request to Heroku for ENV VARS
    request({
        baseUrl: 'https://api.heroku.com',
        method: 'GET',
        uri: '/apps/' + app_name + '/config-vars',
        json: true,
        headers: {
            'Authorization': 'basic ' + process.env.KEY,
            'Accept': 'application/vnd.heroku+json; version=3',
            'Content-Type': 'application/json'
        }
    }, function (err, response, body) {
        if (!err && response.statusCode === 200) {
            console.log("ENV VARS: " + JSON.stringify(body));

            //Env Vars
            var apiToken = process.env.API_TOKEN;
            var verificationToken = process.env.VERIFICATION_TOKEN;
            var instanceURL = process.env.INSTANCE_URL;
            var apiURI = process.env.API_URI;
            var encoded = new Buffer(process.env.USER + ":" + process.env.SECRET).toString('base64');

            var slack = new Slack(apiToken);
            var urlencodedParser = bodyParser.urlencoded({extended: false});
            var messageStore = {};


            /*
            *
            ***API Function Calls***
            *
            */

            app.post('/weekly_summary', urlencodedParser, function (req, res) {
                console.log("My Week Req: " + JSON.stringify(req.body));
                if (req.body.token === verificationToken) {
                    request({
                        baseUrl: instanceURL,
                        method: 'POST',
                        uri: apiURI + '/weekly_summary',
                        json: true,
                        body: {
                            "channel_id": req.body.channel_id,
                            "user_id": req.body.user_id.toString()
                        },
                        headers: {
                            'Authorization': 'basic ' + encoded,
                            'accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }, function (err, response, body) {
                        if (!err && response.statusCode === 200) {
                            console.log("SUCCESS: " + body.result);
                            var attachments = [{
                                fallback: "This attachment isn't supported.",
                                title: "Your Engagement Summary For the Week",
                                color: "#9c4c0d",
                                fields: [{
                                    title: "Engagement",
                                    value: req.body.engagements,
                                    short: true
                                }, {
                                    title: "Hours Worked This Week",
                                    value: req.body.hours,
                                    short: true
                                }],
                                mrkdwn_in: ["text", "fields"]
                            }];
                            slack.api('chat.postEphemeral', {
                                text: 'Weekly Engagement Summary',
                                channel: req.body.result.channel_id,
                                user: req.body.result.user,
                                attachments: JSON.stringify(attachments)
                            }, function (err, response, body) {
                                console.log("Response: " + JSON.stringify(response));
                                if (!err && response.ok === true) {
                                    console.log("SUCCESS: " + response);
                                    //return res.status(200).send(response);
                                } else {
                                    console.log("ERROR: " + body.result);
                                    //return res.status(418).send(body.result);
                                }
                            });
                        } else {
                            console.log("ERROR: " + JSON.stringify(body.result));
                            return res.status(418).send(body.result);
                        }
                    });
                } else {
                    return res.status(401).send( { "text": "Token does not match expected"} );
                }
            });

            app.post('/timesheet', urlencodedParser, function (req, res) {
                console.log("Timesheet Req: " + JSON.stringify(req.body));
                if (req.body.token === verificationToken) {
                    messageStore[req.body.user_id] = {
                        "text": req.body.text
                    };
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
                    return res.status(200).send(json);
                } else {
                    return res.status(401).send( { "text": "Token does not match expected"} );
                }
            });

            app.post('/start', urlencodedParser, function (req, res) {
                console.log("START Req: " + JSON.stringify(req.body));
                if (req.body.token === verificationToken) {
                    messageStore[req.body.user_id] = {
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
                    return res.status(200).send(json);
                } else {
                    return res.status(401).send( { "text": "Token does not match expected"} );
                }
            });

            app.post('/stop', urlencodedParser, function (req, res) {
                console.log("STOP Req: " + JSON.stringify(req.body));
                if (req.body.token === verificationToken) {
                    messageStore[req.body.user_id].end = (new Date().getTime() / 1000);
                    messageStore[req.body.user_id].time_worked = parseFloat((messageStore[req.body.user_id].end - messageStore[req.body.user_id].start) / 3600).toFixed(2);
                    var stopwatch_time = [{
                        text: "By my calculations, you have worked " + messageStore[req.body.user_id].time_worked + " hours against the current engagement.",
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
                        channel: messageStore[req.body.user_id].channel,
                        user: messageStore[req.body.user_id].user,
                        attachments: JSON.stringify(stopwatch_time)
                    }, function (err, response, body) {
                        console.log("Response: " + JSON.stringify(response));
                        if (!err && response.ok === true) {
                            console.log("Body: " + response);
                            return res.status(200).send("I have stopped tracking time against this engagement.");
                        } else {
                            console.log("ERROR: " + JSON.stringify(body));
                            return res.status(418).send(body);
                        }
                    });
                } else {
                    return res.status(401).send( { "text": "Token does not match expected"} );
                }
            });

            app.post('/action', urlencodedParser, function (req, res) {
                var json = JSON.stringify(eval("(" + req.body.payload + ")"));
                var actionJSON = JSON.parse(json);
                console.log("Action JSON: " + JSON.stringify(actionJSON));
                if (actionJSON.token === verificationToken) {

                    var user_id = actionJSON.user.id.toString();
                    var action = actionJSON.actions[0].name.toString();
                    var callback_id = actionJSON.callback_id.toString();

                    console.log("Callback ID: " + callback_id);

                    if (callback_id === 'start_work') {
                        messageStore[user_id].engagement = actionJSON.actions[0].selected_options[0].value;
                        res.contentType('application/json');
                        return res.status(200).send({"text": "Fine, I will keep track of this engagement for you.  Type /stop when you are finished working."});
                    }

                    else if (callback_id === 'submit_stopwatch') {
                        if (action === 'yes') {
                            request({
                                baseUrl: instanceURL,
                                method: 'POST',
                                uri: apiURI + '/engagement_selected',
                                json: true,
                                body: {
                                    "user": user_id.toString(),
                                    "engagement": messageStore[user_id].engagement.toString(),
                                    "time_worked": messageStore[user_id].time_worked.toString()
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
                                    console.log("ERROR: " + JSON.stringify(body.result));
                                    return res.status(418).send(body.result);
                                }
                            });
                        }
                        if (action === 'no') {
                            console.log("Time not correct");
                            return res.status(200).send({"text": "Sorry!  I'm a forgetful wizard sometimes.  You'll have to create a timesheet the old fashioned way this time!"});
                        }
                    }

                    else if (callback_id === 'engagement_list') {
                        if (!isNaN(parseFloat(messageStore[user_id].text))) {
                            var engagement = actionJSON.actions[0].selected_options[0].value;
                            request({
                                baseUrl: instanceURL,
                                method: 'POST',
                                uri: apiURI + '/engagement_selected',
                                json: true,
                                body: {
                                    "engagement": engagement.toString(),
                                    "user": user_id.toString(),
                                    "time_worked": messageStore[user_id].text
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
                                    console.log("ERROR: " + body.result);
                                    return res.status(418).send(body.result);
                                }
                            });
                        } else {
                            console.log("ERROR: text is NaN");
                            return res.status(200).send({"text": "ERROR!  Foolish mortal!  You must enter a proper number of hours!"});
                        }
                    }
                    else if (callback_id === 'enter_time') {
                        if (action === 'yes') {
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
                            return res.status(200).send(twjson);
                        }
                        if (action === 'no') {
                            console.log("Does not want to enter time");
                            return res.status(200).send({"text": "Then begone with you!"});
                        }
                    }
                    else if (callback_id === 'engagement_selected') {
                        if (messageStore[actionJSON.message_ts].hasOwnProperty('engagement')) {
                            messageStore[actionJSON.message_ts].engagement = actionJSON.actions[0].selected_options[0].value;
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
                        return res.status(200).send(es);
                    }
                    else if (callback_id === 'hours_entered') {
                        if (messageStore[actionJSON.message_ts].hasOwnProperty('hours')) {
                            messageStore[actionJSON.message_ts].hours = actionJSON.actions[0].selected_options[0].value;
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
                                        channel: 'C40P434P6',
                                        user: user_id,
                                        attachments: JSON.stringify(additional_time)
                                    }, function (err, response, body) {
                                        console.log("Response: " + JSON.stringify(response));
                                        if (!err && response.ok === true) {
                                            console.log("Body: " + response);
                                            return res.status(200).send(body.result.text);
                                        } else {
                                            console.log("Error: " + body);
                                            return res.status(400).send(body);
                                        }
                                    });
                                } else {
                                    console.log("ERROR: " + body.result);
                                    return res.status(418).send(body.result);
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
                            console.log("ERROR: " + body.result);
                            return res.status(418).send(body.result);
                        }
                    });
                }
            });

            app.post('/timesheet_check', function (req, res) {
                console.log("Timesheet Check Request: " + JSON.stringify(req.body));
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
                    text: 'Engagement Summary',
                    channel: 'C40P434P6',
                    user: req.body.user,
                    attachments: JSON.stringify(attachments)
                }, function (err, response, body) {
                    console.log("Response: " + JSON.stringify(response));
                    if (!err && response.ok === true) {
                        console.log("Body: " + response);
                        return res.status(200).send(response);
                    } else {
                        console.log("ERROR: " + body.result);
                        return res.status(418).send(body.result);
                    }
                });
            });
        } else {
            console.log("ERROR: " + JSON.stringify(body));
        }
    });
};

module.exports = appRouter;