"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CortexAPI = void 0;
var axios_1 = require("axios");
;
;
var createRequestFunction = function (config, endpoint, BASE_PATH) {
    var axiosRequestArgs = __assign(__assign({}, config), { url: BASE_PATH + endpoint });
    return axios_1.default.request(axiosRequestArgs);
};
/**
 *
 * @export
 * @class BaseAPI
 */
var CortexAPI = /** @class */ (function () {
    function CortexAPI(apiKey, userId) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
        if (userId) {
            this.userId = userId;
            this.basePath = 'https://trycortex.ai/api/sdk/p/' + userId;
        }
    }
    CortexAPI.prototype.getDocument = function (knowledgeName, documentID) {
        var config = {
            headers: {
                'Authorization': "Bearer ".concat(this.apiKey),
                'Content-Type': 'application/json'
            },
            method: 'GET',
        };
        var endpoint = '/knowledge/' + knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    };
    /**
     *
     * @param knowledgeName
     * @param documentID
     * @param document
     * @throws {Error}
     * @returns
     */
    CortexAPI.prototype.uploadDocument = function (knowledgeName, documentID, document) {
        var config = {
            headers: {
                'Authorization': "Bearer ".concat(this.apiKey),
                'Content-Type': 'application/json'
            },
            method: 'POST',
            data: document,
        };
        var endpoint = '/knowledge/' + knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    };
    /**
     *
     * @param knowledgeName
     * @param documentID
     * @throws {Error}
     * @returns
     */
    CortexAPI.prototype.deleteDocument = function (knowledgeName, documentID) {
        var config = {
            headers: {
                'Authorization': "Bearer ".concat(this.apiKey),
                'Content-Type': 'application/json'
            },
            method: 'DELETE',
        };
        var endpoint = '/knowledge/' + knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    };
    return CortexAPI;
}());
exports.CortexAPI = CortexAPI;
;
