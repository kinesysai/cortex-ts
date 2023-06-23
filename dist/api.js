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
 *
 * @export
 * @class BaseAPI
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
     *
     * @param knowledgeName
     * @param documentID
     * @param document
     * @throws {Error}
     * @returns
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
     *
     * @param knowledgeName
     * @param documentID
     * @throws {Error}
     * @returns
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
    async runChatCopilot(copilotID, data) {
        const res = await this.runChatCopilotStream(copilotID, data);
        return processStreamedRunResponse(res);
    }
}
exports.CortexAPI = CortexAPI;
;
