/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const BASE_URL = 'https://auto.theronlindsay.dev';
//const fetch = require('node-fetch');
const axios = require('axios');

async function fetchAPI(endpoint) {
    try {
        const response = await axios.get(`${BASE_URL}${endpoint}`, { timeout: 5000 }); // 5 sec timeout
        return response.data; // Axios parses JSON automatically
    } catch (error) {
        console.error('API request failed:', error.message);
        throw new Error('API request failed');
    }
}

// Helper function to mark records as reviewed
async function markAsReviewed(table, ids) {
    if (!ids || ids.length === 0) return;
    
    try {
        await axios.patch(`${BASE_URL}/api/mark-reviewed`, { table, ids });
    } catch (error) {
        console.error(`Error marking ${table} as reviewed:`, error);
    }
}

function getTimeOfDayDescription(lightCondition) {
    switch (lightCondition) {
        case 'day':
            return 'daytime';
        case 'night':
            return 'nighttime';
        case 'dawn':
            return 'dawn, early morning';
        case 'dusk':
            return 'dusk, early evening';
        default:
            return 'unknown';
    }
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'Welcome, you can say Hello or Help. Which would you like to try?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelloWorldIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HelloWorldIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Hello World!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

const LightIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'LightIntent';
    },

    async handle(handlerInput) {
        try {
            const snapshots = await fetchAPI('/api/speed-snapshots?limit=1');

            if (!snapshots || snapshots.length === 0) {
                return handlerInput.responseBuilder
                    .speak("I don't have any sensor data to determine the time of day.")
                    .getResponse();
            }

            const latestSnapshot = snapshots[0];
            const timeOfDay = getTimeOfDayDescription(
                latestSnapshot.light_condition
            );
            
             await markAsReviewed('SpeedSnapshots', [latestSnapshot.snapshot_id]);

            const speakOutput = `Based on the light sensor, it appears to be ${timeOfDay}.`;

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();

        } catch (error) {
            console.error('Error in LightIntentHandler:', error);

            return handlerInput.responseBuilder
                .speak("Sorry, I couldn't determine the time of day. Please try again later.")
                .getResponse();
        }
    }
};

const AcceleratorIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AcceleratorIntent';
    },

    async handle(handlerInput) {
        try {
            const snapshots = await fetchAPI('/api/speed-snapshots?limit=1');

            if (!snapshots || snapshots.length === 0) {
                return handlerInput.responseBuilder
                    .speak("I don't have any recent data to determine if the car is in motion.")
                    .getResponse();
            }

            const latestSnapshot = snapshots[0];
            const speed = parseFloat(latestSnapshot.speed_mph) || 0;
            
             // Mark the accessed snapshot as reviewed
            await markAsReviewed('SpeedSnapshots', [latestSnapshot.snapshot_id]);

            // Consider car moving if speed > 1 mph (sensor noise buffer)
            const isMoving = speed > 1;

            let speakOutput;

            if (isMoving) {
                speakOutput = `Yes, the car is in motion at ${speed.toFixed(1)} miles per hour.`;
            } else {
                speakOutput = "No, the car appears to be stationary.";
            }

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();

        } catch (error) {
            console.error('Error in AcceleratorIntentHandler:', error);

            return handlerInput.responseBuilder
                .speak("Sorry, I couldn't determine if the car is in motion. Please try again later.")
                .getResponse();
        }
    }
};

const LidarIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'LidarIntent';
    },

    async handle(handlerInput) {
        try {
            const violations = await fetchAPI('/api/follow-distance');
            const count = violations ? violations.length : 0;

            let speakOutput;

            if (count === 0) {
                speakOutput = "Great news! There have been no unsafe follow distance instances recorded.";
            } else {
                const instanceWord = count === 1 ? 'instance' : 'instances';
                speakOutput = `There have been ${count} ${instanceWord} of unsafe follow distance recorded.`;
                
                // Mark all accessed violations as reviewed
                const violationIds = violations.map(v => v.violation_id);
                await markAsReviewed('FollowDistanceViolations', violationIds);
            }

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();

        } catch (error) {
            console.error('Error in LidarIntentHandler:', error);

            return handlerInput.responseBuilder
                .speak("Sorry, I couldn't retrieve the follow distance violations. Please try again later.")
                .getResponse();
        }
    }
};

const DeleteIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'DeleteIntent';
    },
    async handle(handlerInput) {
        try {
            await axios.delete(`${BASE_URL}/api/clear-data`);
            
            return handlerInput.responseBuilder
                .speak("All driving data has been cleared successfully. The harsh braking events, follow distance violations, and speed snapshots have been deleted.")
                .getResponse();
                
        } catch (error) {
            console.error('Error in ClearAllDataIntent:', error);
            return handlerInput.responseBuilder
                .speak("Sorry, I couldn't clear the data. Please try again later.")
                .getResponse();
        }
    }
};

const UsernameIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'UsernameIntent';
    },
    async handle(handlerInput) {
        const name = handlerInput.requestEnvelope.request.intent.slots.username.value;
        if (!name || typeof name !== 'string' || name.trim() === '') {
            return handlerInput.responseBuilder
                .speak("Please provide a valid name to set.")
                .reprompt("Please provide a valid name.")
                .getResponse();
        }
        try {
            await axios.put(`${BASE_URL}/api/username`, { username: name.trim() });
            
            return handlerInput.responseBuilder
                .speak(`Your name has been set to ${name.trim()}.`)
                .getResponse();

        } catch (error) {
            console.error('Error in SetUsernameIntent:', error);
            return handlerInput.responseBuilder
                .speak("Sorry, I couldn't set your name. Please try again later.")
                .getResponse();
        }
    }
};






const BrakingIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'BrakingIntent';
    },

    async handle(handlerInput) {
        try {
            const harshBrakingEvents = await fetchAPI('/api/harsh-braking');
            const count = harshBrakingEvents ? harshBrakingEvents.length : 0;

            let speakOutput;

            if (count === 0) {
                speakOutput = "Great news! There have been no abrupt stops recorded.";
            } else {
                const eventWord = count === 1 ? 'abrupt stop' : 'abrupt stops';
                speakOutput = `There have been ${count} ${eventWord} recorded.`;
            }

            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();

        } catch (error) {
            console.error('Error in BrakingIntentHandler:', error);

            return handlerInput.responseBuilder
                .speak("Sorry, I couldn't retrieve the abrupt stop count. Please try again later.")
                .getResponse();
        }
    }
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'You can say hello to me! How can I help?';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'Goodbye!';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'Sorry, I don\'t know about that. Please try again.';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        HelloWorldIntentHandler,
        LightIntentHandler, 
        AcceleratorIntentHandler, 
        LidarIntentHandler,
        DeleteIntentHandler,
        UsernameIntentHandler,
        BrakingIntentHandler, 
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();