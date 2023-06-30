import { AxiosPromise } from 'axios';
export type Message = {
    role: "user" | "assistant" | "error";
    content: string;
    retrievals: RetrievedDocument[] | null;
    updatedAt?: Date;
};
export type RetrievedDocument = {
    source_url: string;
    document_id: string;
    chunks: {
        text: string;
    }[];
};
export declare class Ok<T> {
    value: T;
    constructor(value: T);
    isOk(): this is Ok<T>;
    isErr(): this is Err<never>;
}
export declare class Err<E> {
    error: E;
    constructor(error: E);
    isOk(): this is Ok<never>;
    isErr(): this is Err<E>;
}
export type CortexAPIErrorResponse = {
    message: string;
    code: string;
};
export type RunnerAppRunErrorEvent = {
    type: "error";
    content: {
        code: string;
        message: string;
    };
};
export type RunnerAppRunRunStatusEvent = {
    type: "run_status";
    content: {
        status: "running" | "succeeded" | "errored";
        run_id: string;
    };
};
export type RunnerAppRunBlockStatusEvent = {
    type: "block_status";
    content: {
        block_type: string;
        name: string;
        status: "running" | "succeeded" | "errored";
        success_count: number;
        error_count: number;
    };
};
export type RunnerAppRunBlockExecutionEvent = {
    type: "block_execution";
    content: {
        block_type: string;
        block_name: string;
        execution: {
            value: any | null;
            error: string | null;
        }[][];
    };
};
export type RunnerAppRunFinalEvent = {
    type: "final";
};
export type RunnerAppRunTokensEvent = {
    type: "tokens";
    content: {
        block_type: string;
        block_name: string;
        input_index: number;
        map: {
            name: string;
            iteration: number;
        } | null;
        tokens: {
            text: string;
            tokens?: string[];
            logprobs?: number[];
        };
    };
};
export type CortexAPIResponse<T> = Result<T, CortexAPIErrorResponse>;
export type Result<T, E> = Ok<T> | Err<E>;
export type BlockRunConfig = {
    [key: string]: any;
};
export type BlockType = "input" | "data" | "knowledge" | "code" | "model" | "chat" | "map" | "reduce" | "loop" | "until" | "search" | "curl" | "browser";
export type RunRunType = "deploy" | "local" | "execute" | "all";
type Status = "running" | "succeeded" | "errored";
export type RunConfig = {
    blocks: BlockRunConfig;
};
export type RunStatus = {
    run: Status;
    blocks: BlockStatus[];
};
export type BlockStatus = {
    block_type: BlockType;
    name: string;
    status: Status;
    success_count: number;
    error_count: number;
};
export type TraceType = {
    value?: any;
    error?: string;
};
export type RunType = {
    run_id: string;
    created: number;
    run_type: RunRunType;
    app_hash?: string | null;
    specification_hash?: string | null;
    config: RunConfig;
    status: RunStatus;
    traces: Array<[[BlockType, string], Array<Array<TraceType>>]>;
    version?: number;
    results?: {
        value?: any | null;
        error?: string | null;
    }[][] | null;
};
export type ConfigType = {
    [key: string]: any;
};
export interface CallableParams {
    version: number | string;
    config: ConfigType;
    inputs: Array<any>;
    blocking?: boolean;
    block_filter?: Array<any>;
}
export interface ChatParams {
    version: number | string;
    config: ConfigType;
    inputs: Array<any>;
}
export interface Document {
    data_source_id: string;
    created: number;
    document_id: string;
    timestamp: number;
    tags: string[];
    hash: string;
    text_size: number;
    chunk_count: number;
    chunks: {
        text: string;
        hash: string;
        offset: number;
        vector?: number[] | null;
        score?: number | null;
    }[];
    text?: string | null;
    source_url?: string | null;
}
export interface createDocument {
    timestamp?: number;
    tags?: string[];
    text?: string | null;
    source_url?: string | null;
}
export type SharedVisibility = "private" | "public" | "unlisted" | "deleted";
export type HubProvider = "slack" | "notion" | "web" | "medium";
export type Knowledge = {
    name: string;
    description?: string;
    visibility: SharedVisibility;
    config?: string;
    runnerProjectId: string;
    lastUpdatedAt?: string;
    hub: {
        id: string;
        provider: HubProvider;
    } | null;
};
/**
 * Collection of Cortex API endpoints
 * @export CortexAPI
 * @class CortexAPI
 */
export declare class CortexAPI {
    protected apiKey: string;
    protected userId: string | null;
    protected basePath: string;
    constructor(apiKey?: string, userId?: string);
    getIDFromKey(): Promise<string>;
    /**
     * Retrieves the details of an existing document. You need only supply the unique knowledge name and document name.
     * @param knowledgeName name of knowledge
     * @param documentID name of document
     * @returns Promise of document object
     */
    getDocument(knowledgeName: string, documentID: string): AxiosPromise<{
        document: Document;
    }>;
    /**
     * Upload a document to a knowledge
     *
     * @param knowledgeName name of knowledge
     * @param documentID name of document to be created
     * @param document document object to be uploaded
     * @returns Promise of document object and knowledge object
     */
    uploadDocument(knowledgeName: string, documentID: string, document: createDocument): AxiosPromise<{
        document: Document;
        knowledge: Knowledge;
    }>;
    /**
     * delete a document from a knowledge
     *
     * @param knowledgeName name of knowledge
     * @param documentID name of document to be deleted
     * @returns Promise of document object
     */
    deleteDocument(knowledgeName: string, documentID: string): AxiosPromise<{
        document: Document;
    }>;
    /**
     * runCallable runs a callable with the given data
     *
     * @param callableID id of callable
     * @param data data to be passed to callable
     * @returns Promise of run object
     */
    runCallable(callableID: string, data: CallableParams): AxiosPromise<{
        run: RunType;
    }>;
    /**
     * runCallableWithStream runs a callable with the given data and returns a stream of events
     *
     * @param callableID id of callable
     * @param data data to be passed to callable
     * @returns Promise of run object
     */
    runCallableWithStream(callableID: string, data: CallableParams): AxiosPromise;
    /**
     * Specifically runs a chat copilot with a callable of the chat template
     *
     * called by runChatCopilot
     *
     * @param copilotID id of chat copilot
     * @param data data to be passed to chat copilot
     * @returns Promise of Response object
     */
    runChatCopilotStream(copilotID: string, data: ChatParams): Promise<Response>;
    /**
     * runChatCopilot runs a chat copilot with the given data and returns a stream of events
     *
     * called by runChatCompletion
     *
     * @param copilotID id of chat copilot
     * @param data data to be passed to chat copilot
     * @returns Promise of an event stream and runner run id
     */
    runChatCopilot(copilotID: string, data: ChatParams): Promise<CortexAPIResponse<{
        eventStream: AsyncGenerator<RunnerAppRunErrorEvent | RunnerAppRunRunStatusEvent | RunnerAppRunBlockStatusEvent | RunnerAppRunBlockExecutionEvent | RunnerAppRunTokensEvent | RunnerAppRunFinalEvent, void, unknown>;
        runnerRunId: Promise<string>;
    }>>;
    /**
     * Creates the input for the chat copilot
     *
     * @param messages array of messages
     * @param input new input to be added to messages
     * @returns Array of message objects
     */
    createChatInput(messages: Message[], input: string): Array<any>;
    /**
     * Create the config for the chat copilot
     * @param projectID projectID of knowledge being used
     * @param knowledgeName name of knowledge being used
     * @returns config object
     */
    createChatConfig(projectID: string, knowledgeName: string): {
        OUTPUT_STREAM: {
            use_stream: boolean;
        };
        RETRIEVALS: {
            knowledge: {
                project_id: string;
                data_source_id: string;
            }[];
        };
    };
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
    createChatParam(version: string, messages: Message[], input: string, projectID: string, knowledgeName: string): ChatParams;
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
    runChatCompletion(version: string, messages: Message[], input: string, projectID: string, knowledgeName: string, copilotID: string): Promise<CortexAPIResponse<{
        messages: Message[];
        response: Message;
    }>>;
}
export {};
