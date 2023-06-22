import { AxiosPromise } from 'axios';
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
}
