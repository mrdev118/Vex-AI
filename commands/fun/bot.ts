import { ICommand, IChatParams, IRunParams } from '../../types';

const responses = {
    greetings: [
        "Hello! I'm Vex AI, your intelligent assistant. How may I help you today?",
        "Greetings! Vex AI at your service. What can I do for you?",
        "Hi there! I'm Vex, ready to assist you. What do you need?",
        "Hello! Vex AI here. Feel free to ask me anything!"
    ],
    general: [
        "Yes, I'm here and ready to assist you. How can I help?",
        "Vex AI reporting for duty! What do you need?",
        "I'm listening. What can I help you with today?",
        "You called? Vex AI is here to assist you!"
    ],
    questions: [
        "That's an interesting question! While I'm here to help manage your group, you can use my commands to get more information. Type '.help' to see what I can do!",
        "I appreciate your curiosity! I'm Vex AI, designed to help manage your group effectively. Use '.help' to explore my capabilities.",
        "Great question! I'm here to provide useful commands and features. Try '.help' to see everything I can do for you.",
        "I'm Vex AI, your group management assistant. While I can't answer everything, I have many useful commands. Type '.help' to learn more!"
    ],
    thanks: [
        "You're very welcome! Happy to help anytime.",
        "My pleasure! That's what I'm here for.",
        "Glad I could assist! Feel free to reach out whenever you need.",
        "Anytime! Helping you is what I do best."
    ]
};

const getRandomResponse = (responseArray: string[]): string => {
    return responseArray[Math.floor(Math.random() * responseArray.length)];
};

const command: ICommand = {
    config: {
        name: "bot",
        hasPrefix: false,
        description: "Talk to Vex AI - intelligent bot interactions",
        category: "Entertainment",
        aliases: ["vex"]
    },

    run: async ({ send }: IRunParams) => {
        await send(getRandomResponse(responses.greetings));
    },

    handleChat: async ({ api, event, send }: IChatParams) => {
        const body = event.body.toLowerCase().trim();
        
        // More natural triggers for chat without prefix
        const vexTriggers = [
            /\bvex\b/i,
            /\bbot\b/i,
            /^(hi|hello|hey)\s+(vex|bot)/i,
            /^(vex|bot)\s+(help|assist|please)/i
        ];

        const shouldRespond = vexTriggers.some(trigger => trigger.test(body));

        if (shouldRespond && body.length < 100) { // Avoid triggering on long messages
            let response = "";

            if (body.match(/^(hi|hello|hey|greetings)\s*(bot|vex|ai)?/i)) {
                response = getRandomResponse(responses.greetings);
            } else if (body.match(/(thanks?|thank you|thx|ty)\s*(bot|vex|ai)?/i)) {
                response = getRandomResponse(responses.thanks);
            } else if (body.includes("?") || body.includes("help") || body.includes("assist")) {
                response = getRandomResponse(responses.questions);
            } else {
                response = getRandomResponse(responses.general);
            }

            if (response) {
                await send(response);
            }
        }
    }
};

export = command;
