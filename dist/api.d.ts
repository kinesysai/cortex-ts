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
    uploadDocument(): void;
    deleteDocument(): void;
}
