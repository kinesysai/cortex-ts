import { AxiosPromise } from 'axios';
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
    version: number | 'latest';
    config: ConfigType;
    inputs: Array<any>;
    blocking?: boolean;
    block_filter?: Array<any>;
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
 *
 * @export
 * @class BaseAPI
 */
export declare class CortexAPI {
    protected apiKey: string;
    protected userId: string;
    protected basePath: string;
    constructor(apiKey?: string, userId?: string);
    getDocument(knowledgeName: string, documentID: string): AxiosPromise<{
        document: Document;
    }>;
    /**
     *
     * @param knowledgeName
     * @param documentID
     * @param document
     * @throws {Error}
     * @returns
     */
    uploadDocument(knowledgeName: string, documentID: string, document: createDocument): AxiosPromise<{
        document: Document;
        knowledge: Knowledge;
    }>;
    /**
     *
     * @param knowledgeName
     * @param documentID
     * @throws {Error}
     * @returns
     */
    deleteDocument(knowledgeName: string, documentID: string): AxiosPromise<{
        document: Document;
    }>;
    runCallable(callableID: string, data: CallableParams): AxiosPromise<{
        run: RunType;
    }>;
    runCallableWithStream(callableID: string, data: CallableParams): AxiosPromise;
}
export {};
