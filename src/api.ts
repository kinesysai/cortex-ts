import axios, { AxiosResponse, AxiosRequestConfig } from 'axios';


/**
 *
 * @export
 * @class BaseAPI
 */
export class CortexAPI {
    protected apiKey: string;
    protected userId: string;

    constructor(apiKey?: string, userId?: string) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
        if (userId) {
            this.userId = userId;
        }
    }
    public getDocument() {
    
    }
    public uploadDocument() {
    
    }
    public deleteDocument() {
    
    }
};
