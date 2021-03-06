/**
 * Copyright 2015 IBM Corp. All Rights Reserved.
 * Modifications by Andrew Nelson <andy@andyhub.com> follow this same licensing.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'); // app server
var bodyParser = require('body-parser'); // parser for post requests
var Conversation = require('watson-developer-cloud/conversation/v1'); // watson sdk
var request = require('request');
var app = express();

// Bootstrap application settings
app.use(express.static('./public')); // load UI from public folder
app.use(bodyParser.json());

// Create the service wrapper
var conversation = new Conversation({
  // If unspecified here, the CONVERSATION_USERNAME and CONVERSATION_PASSWORD env properties will be checked
  // After that, the SDK will fall back to the bluemix-provided VCAP_SERVICES environment property
  // username: '<username>',
  // password: '<password>',
  url: 'https://gateway.watsonplatform.net/conversation/api',
  version_date: '2016-10-21',
  version: 'v1'
});

// Endpoint to be call from the client side
app.post('/api/message', function(req, res) {
  var workspace = process.env.WORKSPACE_ID || '<workspace-id>';
  if (!workspace || workspace === '<workspace-id>') {
    return res.json({
      'output': {
        'text': 'The app has not been configured with a <b>WORKSPACE_ID</b> environment variable. Please refer to the ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple">README</a> documentation on how to set this variable. <br>' + 'Once a workspace has been defined the intents may be imported from ' + '<a href="https://github.com/watson-developer-cloud/conversation-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.'
      }
    });
  }
  var payload = {
    workspace_id: workspace,
    context: req.body.context || {},
    input: req.body.input || {}
  };

  // Send the input to the conversation service
  conversation.message(payload, function(err, data) {
    if (err) {
        console.log(err);
      return res.status(err.code || 500).json(err);
    }
    updateResponse(req.body.app_id, res, data)
  });
});


function getRequestOptions(app_id, resource_path){
    var host = process.env.WF_HOST_URL || 'https://workforce-server.herokuapp.com/v1'
    var options = {
          url: host + resource_path,
          headers: {
            'x-app-id': app_id
          }
    };
    return options;
}
/**
    App_id is the slack team ID
**/
function updateResponse(app_id, res, data) {
    var api = 'https://workforce-server.herokuapp.com/v1';
    var isNumCustomers = checkIntent(data, 'numCustomers');
    var isTopCustomers = checkIntent(data, 'topCustomers');
    var isOpportunities = checkIntent(data, 'opportunities');
    var isClosingOpportunities = checkIntent(data, 'closingOpportunities');
    
    if (isNumCustomers) {
        request(getRequestOptions(app_id, '/accounts/count'), function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);
                var numCustomers = json.count;
                data.output.text = 'You have ' + numCustomers + ' customers';
                return res.json(data);
            } else {
                data.output.text = 'Sorry, there was an error with that API call.';
                return res.json(data);
            }
        });
    } else if (isTopCustomers) {
        request(getRequestOptions(app_id, '/accounts/top'), function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);
                var topCustomers = "";
                for (var i=0; i<json.length; ++i) {
                    topCustomers += json[i].name;
                    if (i < json.length-2) {
                        topCustomers += ', ';
                    } else if (i === json.length-2){
                        topCustomers += ', and ';
                    }
                }
                data.output.text = 'Your top ' + json.length + ' customers are ' + topCustomers + '.';
                return res.json(data);
            } else {
                data.output.text = body;
                return res.json(data);
            }
        });
    } else if (isOpportunities) {
        request(getRequestOptions(app_id, '/opportunities'), function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);
                var opportunities = "";
                for (var i=0; i<json.length; ++i) {
                    opportunities += json[i].name + ' ($' + json[i].expected_revenue + ')';
                    if (i < json.length-2) {
                        opportunities += ', ';
                    } else if (i === json.length-2){
                        opportunities += ', and ';
                    }
                }
                data.output.text = 'Your top opportunities are ' + opportunities;
                return res.json(data);
            } else {
                data.output.text = 'Sorry, there was an error with that API call.';
                return res.json(data);
            }
        });
    } else if (isClosingOpportunities) {
        request(getRequestOptions(app_id, '/opportunities/chances'), function (error, response, body) {
            if (!error && response.statusCode == 200) {
                var json = JSON.parse(body);
                var opportunities = "";
                for (var i=0; i<5; ++i) {
                    opportunities += json[i].prediction;
                    if (i < 3) {
                        opportunities += ', ';
                    } else if (i === 3){
                        opportunities += ', and ';
                    }
                }
                data.output.text = 'Your opportunities with the top chances are ' + opportunities;
                return res.json(data);
            } else {
                data.output.text = 'Sorry, there was an error with that API call.';
                return res.json(data);
            }
        });
    } else {
        return res.json(data);
    }
}

function checkIntent(data, intent) {
    return data.intents && data.intents.length > 0 && data.intents[0].intent === intent;
};

module.exports = app;
