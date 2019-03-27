'use strict';
// This function is triggered each time a message is revieved in the IoTHub.
// The message payload is persisted in an Azure Storage Table
const Message = require('azure-iot-common').Message;
const iotHubConnectionString = process.env['iotHubConnectionString'];
const cloudClient = require('azure-iothub').Client.fromConnectionString(iotHubConnectionString);
const request = require('request');

function truncateByDot(text, limit){
    return text.length < limit ? text : text.substr(0, limit - 3) + '...';
}

function completeContextWithError(context, errorMessage){
    context.done(`ShakeShakeAzureFuncError: ${errorMessage}`);
}

module.exports = function (context, myEventHubMessage) {
    // The right way to retrieve the device id is to get it from Azure Function proerpy bag
    // But seems the property bag cannot be stably retrieved from Azure so we choose to hard code the device id here for stability.
    /*
    if (!context.bindingData || !context.bindingData.systemProperties || !context.bindingData.systemProperties['iothub-connection-device-id']) {
        context.log('no device id');
        context.done();
        return;
    }
    var deviceId = context.bindingData.systemProperties['iothub-connection-device-id'];
    */

    var deviceId = "AZ3166";
    if (deviceId && myEventHubMessage.topic) {
        cloudClient.open(function (err) {
            if (err) {
                completeContextWithError(context, `could not connect: ${err.message}`);
            } else {
                context.log('Client connected');
                let tweet = '';
                // TODO: 
                // Please replace this test Twitter bearer token with you own.
                // To apply for your own Twitter bearer token, go to https://dev.twitter.com/ and register a new Twitter app to get Consumer Key and Secret
                // Then generate the token using utility like this: https://gearside.com/nebula/utilities/twitter-bearer-token-generator/ 
                let options = {
                    url: 'https://api.twitter.com/1.1/search/tweets.json?count=3&q=%23' + myEventHubMessage.topic,
                    headers: {
                        'Authorization': 'Bearer ' + 'AAAAAAAAAAAAAAAAAAAAAGVU0AAAAAAAucpxA9aXc2TO6rNMnTcVit1P3YM%3DrQpyFeQ6LOwyvy7cqW5djhLPnFfjEK8H3hA1qfGDh93JRbI1le'
                    }
                };
                request(options, (error, response, body) => {
                    if (!error && response.statusCode == 200) {
                        let info = JSON.parse(body);
                        tweet = (info.statuses && info.statuses.length) ? `@${truncateByDot(info.statuses[0].user.name, 13)}:\n${info.statuses[0].text}` : "No new tweet.";
                        context.log(tweet);
                        const message = new Message(tweet);
                        cloudClient.send(deviceId, message, function (err, res) {
                            cloudClient.close();
                            if (err) {
                                completeContextWithError(context, `error in send C2D message: ${err}`);
                            } else {
                                context.log(`send status: ${res.constructor.name}`);
                                context.done();
                            }
                        });
                    }
                    else {
                        cloudClient.close();
                        completeContextWithError(context, `fail to call twitter API: ${error}`);
                    }
                });
            }
        });
    }
    else{
        let msgString;
        try{
            msgString = JSON.stringify(myEventHubMessage);
        }
        catch(err){
            msgString = `failed to stringify with error: ${err}`;
        }
        completeContextWithError(context, `topic must not be null or empty in message: ${msgString}`);
    }
};