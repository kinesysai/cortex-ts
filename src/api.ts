import axios, { AxiosRequestConfig, AxiosPromise } from 'axios';
import { createParser } from 'eventsource-parser';

export type Message = {
  role: "user" | "assistant" | "error"
  content: string
  retrievals: RetrievedDocument[] | null
  updatedAt?: Date
}
export type RetrievedDocument = {
  source_url: string
  document_id: string
  chunks: {
    text: string
  }[]
}

export class Ok<T> {
  constructor(public value: T) {}

  isOk(): this is Ok<T> {
    return true
  }

  isErr(): this is Err<never> {
    return false
  }
}

export class Err<E> {
  constructor(public error: E) {}

  isOk(): this is Ok<never> {
    return false
  }

  isErr(): this is Err<E> {
    return true
  }
}

export type CortexAPIErrorResponse = {
  message: string
  code: string
}

export type RunnerAppRunErrorEvent = {
  type: "error"
  content: {
    code: string
    message: string
  }
}

export type RunnerAppRunRunStatusEvent = {
  type: "run_status"
  content: {
    status: "running" | "succeeded" | "errored"
    run_id: string
  }
}

export type RunnerAppRunBlockStatusEvent = {
  type: "block_status"
  content: {
    block_type: string
    name: string
    status: "running" | "succeeded" | "errored"
    success_count: number
    error_count: number
  }
}

export type RunnerAppRunBlockExecutionEvent = {
  type: "block_execution"
  content: {
    block_type: string
    block_name: string
    execution: { value: any | null; error: string | null }[][]
  }
}

export type RunnerAppRunFinalEvent = {
  type: "final"
}

export type RunnerAppRunTokensEvent = {
  type: "tokens"
  content: {
    block_type: string
    block_name: string
    input_index: number
    map: {
      name: string
      iteration: number
    } | null
    tokens: {
      text: string
      tokens?: string[]
      logprobs?: number[]
    }
  }
}

export type CortexAPIResponse<T> = Result<T, CortexAPIErrorResponse>


export type Result<T, E> = Ok<T> | Err<E>


export type BlockRunConfig = {
    [key: string]: any
  }

export type BlockType =
  | "input"
  | "data"
  | "knowledge"
  | "code"
  | "model"
  | "chat"
  | "map"
  | "reduce"
  | "loop"
  | "until"
  | "search"
  | "curl"
  | "browser"

export type RunRunType = "deploy" | "local" | "execute" | "all"
type Status = "running" | "succeeded" | "errored"

export type RunConfig = {
  blocks: BlockRunConfig
}

export type RunStatus = {
  run: Status
  blocks: BlockStatus[]
}

export type BlockStatus = {
  block_type: BlockType
  name: string
  status: Status
  success_count: number
  error_count: number
}

export type TraceType = {
  value?: any
  error?: string
}

export type RunType = {
  run_id: string
  created: number
  run_type: RunRunType
  app_hash?: string | null
  specification_hash?: string | null
  config: RunConfig
  status: RunStatus
  traces: Array<[[BlockType, string], Array<Array<TraceType>>]>
  version?: number
  results?:
    | {
        value?: any | null
        error?: string | null
      }[][]
    | null
}

export type ConfigType = {
    [key: string]: any
  }

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
};

export interface createDocument {
  timestamp?: number;
  tags?: string[];
  text?: string | null;
  source_url?: string | null;
};

export type SharedVisibility = "private" | "public" | "unlisted" | "deleted"

export type HubProvider = "slack" | "notion" | "web" | "medium"

export type Knowledge = {
  name: string
  description?: string
  visibility: SharedVisibility
  config?: string
  runnerProjectId: string
  lastUpdatedAt?: string
  hub: { id: string; provider: HubProvider } | null
}

/**
 * function to make requests to cortex
 * @param config config for axios
 * @param endpoint endpoint to make request to
 * @param BASE_PATH base path for the request
 * @returns {Promise<AxiosResponse<any>>} response from the request
 */
const createRequestFunction = function (config: AxiosRequestConfig, endpoint: string) {
    const axiosRequestArgs = {...config, url: endpoint};
    return axios.request(axiosRequestArgs);
};

async function processStreamedRunResponse(res: Response): Promise<
  CortexAPIResponse<{
    eventStream: AsyncGenerator<
      | RunnerAppRunErrorEvent
      | RunnerAppRunRunStatusEvent
      | RunnerAppRunBlockStatusEvent
      | RunnerAppRunBlockExecutionEvent
      | RunnerAppRunTokensEvent
      | RunnerAppRunFinalEvent,
      void,
      unknown
    >
    runnerRunId: Promise<string>
  }>
> {
  if (!res.ok || !res.body) {
    return new Err({
      type: "runner_api_error",
      code: "streamed_run_error",
      message: `Error running streamed app: status_code=${res.status}`,
    })
  }

  let hasRunId = false
  let rejectRunIdPromise: (err: Error) => void
  let resolveRunIdPromise: (runId: string) => void
  const runnerRunIdPromise = new Promise<string>((resolve, reject) => {
    rejectRunIdPromise = reject
    resolveRunIdPromise = resolve
  })

  let pendingEvents: (
    | RunnerAppRunErrorEvent
    | RunnerAppRunRunStatusEvent
    | RunnerAppRunBlockStatusEvent
    | RunnerAppRunBlockExecutionEvent
    | RunnerAppRunTokensEvent
    | RunnerAppRunFinalEvent
  )[] = []

  const parser = createParser((event) => {
    if (event.type === "event") {
      if (event.data) {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case "error": {
              pendingEvents.push({
                type: "error",
                content: {
                  code: data.content.code,
                  message: data.content.message,
                },
              } as RunnerAppRunErrorEvent)
              break
            }
            case "run_status": {
              pendingEvents.push({
                type: data.type,
                content: data.content,
              })
              break
            }
            case "block_status": {
              pendingEvents.push({
                type: data.type,
                content: data.content,
              })
              break
            }
            case "block_execution": {
              pendingEvents.push({
                type: data.type,
                content: data.content,
              })
              break
            }
            case "tokens": {
              pendingEvents.push({
                type: "tokens",
                content: data.content,
              } as RunnerAppRunTokensEvent)
              break
            }
            case "final": {
              pendingEvents.push({
                type: "final",
              } as RunnerAppRunFinalEvent)
            }
          }
          if (data.content?.run_id && !hasRunId) {
            hasRunId = true
            resolveRunIdPromise(data.content.run_id)
          }
        } catch (err) {

        }
      }
    }
  })

  const reader = res.body.getReader()

  const streamEvents = async function* () {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }
        parser.feed(new TextDecoder().decode(value))
        for (const event of pendingEvents) {
          yield event
        }
        pendingEvents = []
      }
      if (!hasRunId) {
        // once the stream is entirely consumed, if we haven't received a run id, reject the promise
        /* setImmediate(() => {
          //logger.error("No run id received.")
          rejectRunIdPromise(new Error("No run id received"))
        }) */
      }
    } catch (e) {
      yield {
        type: "error",
        content: {
          code: "stream_error",
          message: "Error streaming chunks",
        },
      } as RunnerAppRunErrorEvent
      /* logger.error(
        {
          error: e,
        },
        "Error streaming chunks."
      ) */
    } finally {
      reader.releaseLock()
    }
  }

  return new Ok({
    eventStream: streamEvents(),
    runnerRunId: runnerRunIdPromise,
  })
}

/**
 * Collection of Cortex API endpoints
 * @export CortexAPI
 * @class CortexAPI
 */
export class CortexAPI {
    protected apiKey: string;
    protected userId: string | null;
    protected basePath = 'https://trycortex.ai/api/sdk/p';

    constructor(apiKey?: string, userId?: string) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
        if (userId) {
            this.userId = userId;
        }
        else {
          this.userId = null;
        }
    }
    public async getIDFromKey() : Promise<string> {
      const config = {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        method: 'GET',
      };
      const endpoint = 'https://trycortex.ai/api/sdk/q/p'
      const res = await createRequestFunction(config, endpoint);
      return res.data.pID;
    }

    /**
     * Retrieves the details of an existing document. You need only supply the unique knowledge name and document name.
     * @param knowledgeName name of knowledge
     * @param documentID name of document
     * @returns Promise of document object
     */
    public async getDocument(knowledgeName:string, documentID:string): AxiosPromise<{document:Document}> {
        if (!this.userId) {
          this.userId = await this.getIDFromKey();
        }
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'GET',
          };
        const endpoint = '/' + this.userId + '/knowledge/'+ knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, this.basePath + endpoint);
    }

    /**
     * Upload a document to a knowledge
     * 
     * @param knowledgeName name of knowledge
     * @param documentID name of document to be created
     * @param document document object to be uploaded
     * @returns Promise of document object and knowledge object
     */
    public async uploadDocument(knowledgeName:string, documentID:string ,document: createDocument): AxiosPromise<{document:Document, knowledge: Knowledge}> {
      if (!this.userId) {
        this.userId = await this.getIDFromKey();
      }
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'POST',
            data: document,
          };
        const endpoint = '/' + this.userId +  '/knowledge/'+ knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, this.basePath + endpoint);
    }

    /**
     * delete a document from a knowledge
     * 
     * @param knowledgeName name of knowledge
     * @param documentID name of document to be deleted
     * @returns Promise of document object
     */
    public async deleteDocument(knowledgeName:string, documentID:string): AxiosPromise<{document:Document}> {
      if (!this.userId) {
        this.userId = await this.getIDFromKey();
      }
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'DELETE',
          };
        const endpoint = '/' + this.userId + '/knowledge/'+ knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, this.basePath + endpoint);
    }
    
    /**
     * runCallable runs a callable with the given data
     * 
     * @param callableID id of callable
     * @param data data to be passed to callable
     * @returns Promise of run object
     */
    public async runCallable(callableID: string, data: CallableParams): AxiosPromise<{run: RunType}> {
      if (!this.userId) {
        this.userId = await this.getIDFromKey();
      }
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'POST',
            data: data,
          };
        const endpoint = '/' + this.userId + '/a/' + callableID + '/r';
        return createRequestFunction(config, this.basePath + endpoint);
    }

    /**
     * runCallableWithStream runs a callable with the given data and returns a stream of events
     * 
     * @param callableID id of callable
     * @param data data to be passed to callable
     * @returns Promise of run object
     */
    public async runCallableWithStream(callableID: string, data: CallableParams): AxiosPromise {
      if (!this.userId) {
        this.userId = await this.getIDFromKey();
      }
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'POST',
            data: {...data, stream: true},
          };
        const endpoint = '/' + this.userId + '/a/' + callableID + '/r';
        return createRequestFunction(config, this.basePath + endpoint);
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
    public runChatCopilotStream(copilotID: string, data: ChatParams): Promise<Response>
    {
      const endpoint = '/copilot/' + copilotID;
      const base = 'https://trycortex.ai/api/sdk'
      /* const res = createRequestFunction(config, endpoint, base); */
      const res = fetch(base+endpoint, {
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
    public async runChatCopilot(copilotID: string, data: ChatParams): Promise<
    CortexAPIResponse<{
      eventStream: AsyncGenerator<
        | RunnerAppRunErrorEvent
        | RunnerAppRunRunStatusEvent
        | RunnerAppRunBlockStatusEvent
        | RunnerAppRunBlockExecutionEvent
        | RunnerAppRunTokensEvent
        | RunnerAppRunFinalEvent,
        void,
        unknown
      >
      runnerRunId: Promise<string>
    }>>
    {
      const res: Response = await this.runChatCopilotStream(copilotID, data);
      return processStreamedRunResponse(res);
    }

    /**
     * Creates the input for the chat copilot
     * 
     * @param messages array of messages
     * @param input new input to be added to messages
     * @returns Array of message objects
     */
    public createChatInput(messages: Message[], input: string): Array<any> {
      const mes = [... messages];
      const newInput: Message = {
        role: "user",
        content: input,
        retrievals: [],
        updatedAt: new Date(),
      }
      mes.push(newInput);
      return [{ messages: mes },]
    }

    /**
     * Create the config for the chat copilot
     * @param projectID projectID of knowledge being used
     * @param knowledgeName name of knowledge being used
     * @returns config object
     */
    public createChatConfig(projectID:string, knowledgeName: string) {
      const config = 
      {
        "OUTPUT_STREAM":{"use_stream":true},
        "RETRIEVALS":{"knowledge":[{"project_id":projectID,"data_source_id":knowledgeName}]}
      }
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
    public createChatParam(version: string, messages: Message[], input: string, projectID:string, knowledgeName: string): ChatParams {
      const config = this.createChatConfig(projectID, knowledgeName);
      const inputMessages = this.createChatInput(messages, input);
      const param = {
        version: version,
        config: config,
        inputs: inputMessages,
      }
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
    public async runChatCompletion(version: string, messages: Message[], input: string, projectID:string, knowledgeName: string, copilotID: string): Promise<CortexAPIResponse<{messages:Message[],response:Message}>> {
      const mes = [... messages];
      const newInput: Message = {
        role: "user",
        content: input,
        retrievals: [],
        updatedAt: new Date(),
      }
      mes.push(newInput);
      const param = this.createChatParam(version, messages, input, projectID, knowledgeName);
      const res = await this.runChatCopilot(copilotID, param);
      if (res.isErr()) {
        return new Err({
          type: "api_error",
          code: "runChatCopilot",
          message: `Error running runChatCopilot: ${res.error.message}`,
        })
      }
      const response: Message = {
        role: "assistant",
        content: "",
        retrievals: null,
        updatedAt: new Date(),
      }

      const { eventStream } = res.value
      for await (const event of eventStream) {
        //console.log("EVENT", event)
        if (event.type === "tokens") {
          // console.log("EVENT", event);
          const content = response.content + event.content.tokens.text
          response.content = content
        }
        if (event.type === "error") {
          return new Err({
            type: "eventStream_error",
            code: "runChatCompletion",
            message: `Error running event: ERROR event ${event}`,
          })
        }
        if (event.type === "run_status") {
          if (event.content.status === "errored") {
            //console.log("RUN STATUS", event)
            break
          }
        }

        if (event.type === "block_execution") {
          const e = event.content.execution[0][0]
          if (event.content.block_name === 'RETRIEVALS') {
            if (!e.error) {
              response.retrievals = e.value
            }
          }
          if (event.content.block_name === "OUTPUT_STREAM") {
            if (e.error) {
              return new Err({
                type: "eventStream_error",
                code: "runChatCompletion",
                message: `MODEL event with error: ERROR event ${event}`,
              })
            }
          }
          if (event.content.block_name === "OUTPUT") {
            if (!e.error) {
              mes.push(e.value)
            }
          }
        }
      }

      return new Ok({messages: mes, response: response});
    }
};
