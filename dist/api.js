"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortexAPI = exports.Err = exports.Ok = void 0;
const axios_1 = require("axios");
const eventsource_parser_1 = require("eventsource-parser");
class Ok {
    constructor(value) {
        this.value = value;
    }
    isOk() {
        return true;
    }
    isErr() {
        return false;
    }
}
exports.Ok = Ok;
class Err {
    constructor(error) {
        this.error = error;
    }
    isOk() {
        return false;
    }
    isErr() {
        return true;
    }
}
exports.Err = Err;
;
;
/**
 * function to make requests to cortex
 * @param config config for axios
 * @param endpoint endpoint to make request to
 * @param BASE_PATH base path for the request
 * @returns {Promise<AxiosResponse<any>>} response from the request
 */
const createRequestFunction = function (config, endpoint, BASE_PATH) {
    const axiosRequestArgs = { ...config, url: BASE_PATH + endpoint };
    return axios_1.default.request(axiosRequestArgs);
};
async function processStreamedRunResponse(res) {
    if (!res.ok || !res.body) {
        return new Err({
            type: "runner_api_error",
            code: "streamed_run_error",
            message: `Error running streamed app: status_code=${res.status}`,
        });
    }
    let hasRunId = false;
    let rejectRunIdPromise;
    let resolveRunIdPromise;
    const runnerRunIdPromise = new Promise((resolve, reject) => {
        rejectRunIdPromise = reject;
        resolveRunIdPromise = resolve;
    });
    let pendingEvents = [];
    const parser = (0, eventsource_parser_1.createParser)((event) => {
        var _a;
        if (event.type === "event") {
            if (event.data) {
                try {
                    const data = JSON.parse(event.data);
                    switch (data.type) {
                        case "error": {
                            pendingEvents.push({
                                type: "error",
                                content: {
                                    code: data.content.code,
                                    message: data.content.message,
                                },
                            });
                            break;
                        }
                        case "run_status": {
                            pendingEvents.push({
                                type: data.type,
                                content: data.content,
                            });
                            break;
                        }
                        case "block_status": {
                            pendingEvents.push({
                                type: data.type,
                                content: data.content,
                            });
                            break;
                        }
                        case "block_execution": {
                            pendingEvents.push({
                                type: data.type,
                                content: data.content,
                            });
                            break;
                        }
                        case "tokens": {
                            pendingEvents.push({
                                type: "tokens",
                                content: data.content,
                            });
                            break;
                        }
                        case "final": {
                            pendingEvents.push({
                                type: "final",
                            });
                        }
                    }
                    if (((_a = data.content) === null || _a === void 0 ? void 0 : _a.run_id) && !hasRunId) {
                        hasRunId = true;
                        resolveRunIdPromise(data.content.run_id);
                    }
                }
                catch (err) {
                }
            }
        }
    });
    const reader = res.body.getReader();
    const streamEvents = async function* () {
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }
                parser.feed(new TextDecoder().decode(value));
                for (const event of pendingEvents) {
                    yield event;
                }
                pendingEvents = [];
            }
            if (!hasRunId) {
                // once the stream is entirely consumed, if we haven't received a run id, reject the promise
                /* setImmediate(() => {
                  //logger.error("No run id received.")
                  rejectRunIdPromise(new Error("No run id received"))
                }) */
            }
        }
        catch (e) {
            yield {
                type: "error",
                content: {
                    code: "stream_error",
                    message: "Error streaming chunks",
                },
            };
            /* logger.error(
              {
                error: e,
              },
              "Error streaming chunks."
            ) */
        }
        finally {
            reader.releaseLock();
        }
    };
    return new Ok({
        eventStream: streamEvents(),
        runnerRunId: runnerRunIdPromise,
    });
}
/**
 * Collection of Cortex API endpoints
 * @export CortexAPI
 * @class CortexAPI
 */
class CortexAPI {
    constructor(apiKey, userId) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
        if (userId) {
            this.userId = userId;
            this.basePath = 'https://trycortex.ai/api/sdk/p/' + userId;
        }
    }
    /**
     * Retrieves the details of an existing document. You need only supply the unique knowledge name and document name.
     * @param knowledgeName name of knowledge
     * @param documentID name of document
     * @returns Promise of document object
     */
    getDocument(knowledgeName, documentID) {
        const config = {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            method: 'GET',
        };
        const endpoint = '/knowledge/' + knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    }
    /**
     * Upload a document to a knowledge
     *
     * @param knowledgeName name of knowledge
     * @param documentID name of document to be created
     * @param document document object to be uploaded
     * @returns Promise of document object and knowledge object
     */
    uploadDocument(knowledgeName, documentID, document) {
        const config = {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            data: document,
        };
        const endpoint = '/knowledge/' + knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    }
    /**
     * delete a document from a knowledge
     *
     * @param knowledgeName name of knowledge
     * @param documentID name of document to be deleted
     * @returns Promise of document object
     */
    deleteDocument(knowledgeName, documentID) {
        const config = {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            method: 'DELETE',
        };
        const endpoint = '/knowledge/' + knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    }
    /**
     * runCallable runs a callable with the given data
     *
     * @param callableID id of callable
     * @param data data to be passed to callable
     * @returns Promise of run object
     */
    runCallable(callableID, data) {
        const config = {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            data: data,
        };
        const endpoint = '/a/' + callableID + '/r';
        return createRequestFunction(config, endpoint, this.basePath);
    }
    /**
     * runCallableWithStream runs a callable with the given data and returns a stream of events
     *
     * @param callableID id of callable
     * @param data data to be passed to callable
     * @returns Promise of run object
     */
    runCallableWithStream(callableID, data) {
        const config = {
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json'
            },
            method: 'POST',
            data: { ...data, stream: true },
        };
        const endpoint = '/a/' + callableID + '/r';
        return createRequestFunction(config, endpoint, this.basePath);
    }
    /**
     * Specifically runs a chat copilot with a callable of the chat template
     *
     * called by runChatCopilot
     *
     * @param copilotID id of chat copilot
     * @param data data to be passed to chat copilot
     * @returns Promise of Response object
     */
    runChatCopilotStream(copilotID, data) {
        const endpoint = '/copilot/' + copilotID;
        const base = 'https://trycortex.ai/api/sdk';
        /* const res = createRequestFunction(config, endpoint, base); */
        const res = fetch(base + endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(data),
        });
        return res;
    }
    /**
     * runChatCopilot runs a chat copilot with the given data and returns a stream of events
     *
     * called by runChatCompletion
     *
     * @param copilotID id of chat copilot
     * @param data data to be passed to chat copilot
     * @returns Promise of an event stream and runner run id
     */
    async runChatCopilot(copilotID, data) {
        const res = await this.runChatCopilotStream(copilotID, data);
        return processStreamedRunResponse(res);
    }
    /**
     * Creates the input for the chat copilot
     *
     * @param messages array of messages
     * @param input new input to be added to messages
     * @returns Array of message objects
     */
    createChatInput(messages, input) {
        const mes = [...messages];
        const newInput = {
            role: "user",
            content: input,
            retrievals: [],
            updatedAt: new Date(),
        };
        mes.push(newInput);
        return [{ messages: mes },];
    }
    /**
     * Create the config for the chat copilot
     * @param projectID projectID of knowledge being used
     * @param knowledgeName name of knowledge being used
     * @returns config object
     */
    createChatConfig(projectID, knowledgeName) {
        const config = {
            "OUTPUT_STREAM": { "use_stream": true },
            "RETRIEVALS": { "knowledge": [{ "project_id": projectID, "data_source_id": knowledgeName }] }
        };
        return config;
    }
    /**
     * Creates the param for the chat copilot
     *
     * @param version the version of callable desired to run
     * @param messages array of previously send and recieved messages
     * @param input the chat to be processed
     * @param projectID projectID of knowledge being used
     * @param knowledgeName name of knowledge being used
     * @returns chat param object
     */
    createChatParam(version, messages, input, projectID, knowledgeName) {
        const config = this.createChatConfig(projectID, knowledgeName);
        const inputMessages = this.createChatInput(messages, input);
        const param = {
            version: version,
            config: config,
            inputs: inputMessages,
        };
        return param;
    }
    /**
     * Takes in an array of previous messages and a new chat to be sent to the callable and returns the response
     *
     * @param version the version of callable desired to run
     * @param messages array of previously send and recieved messages
     * @param input the chat to be processed
     * @param projectID projectID of knowledge being used
     * @param knowledgeName name of knowledge being used
     * @param copilotID id of chat copilot
     * @returns Promise of CortexAPIResponse with the response message and the array of messages with the response added
     */
    async runChatCompletion(version, messages, input, projectID, knowledgeName, copilotID) {
        const mes = [...messages];
        const newInput = {
            role: "user",
            content: input,
            retrievals: [],
            updatedAt: new Date(),
        };
        mes.push(newInput);
        const param = this.createChatParam(version, messages, input, projectID, knowledgeName);
        const res = await this.runChatCopilot(copilotID, param);
        if (res.isErr()) {
            return new Err({
                type: "api_error",
                code: "runChatCopilot",
                message: `Error running runChatCopilot: ${res.error.message}`,
            });
        }
        const response = {
            role: "assistant",
            content: "",
            retrievals: null,
            updatedAt: new Date(),
        };
        const { eventStream } = res.value;
        for await (const event of eventStream) {
            //console.log("EVENT", event)
            if (event.type === "tokens") {
                // console.log("EVENT", event);
                const content = response.content + event.content.tokens.text;
                response.content = content;
            }
            if (event.type === "error") {
                return new Err({
                    type: "eventStream_error",
                    code: "runChatCompletion",
                    message: `Error running event: ERROR event ${event}`,
                });
            }
            if (event.type === "run_status") {
                if (event.content.status === "errored") {
                    //console.log("RUN STATUS", event)
                    break;
                }
            }
            if (event.type === "block_execution") {
                const e = event.content.execution[0][0];
                if (event.content.block_name === 'RETRIEVALS') {
                    if (!e.error) {
                        response.retrievals = e.value;
                    }
                }
                if (event.content.block_name === "OUTPUT_STREAM") {
                    if (e.error) {
                        return new Err({
                            type: "eventStream_error",
                            code: "runChatCompletion",
                            message: `MODEL event with error: ERROR event ${event}`,
                        });
                    }
                }
                if (event.content.block_name === "OUTPUT") {
                    if (!e.error) {
                        mes.push(e.value);
                    }
                }
            }
        }
        return new Ok({ messages: mes, response: response });
    }
}
exports.CortexAPI = CortexAPI;
;
