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
  // provider: HubProvider;
  // score: number;
  chunks: {
    // channelName?: string;
    // timestamp: string;
    // title?: string;
    // lastEditedAt?: string;
    // chunks: {
    //   text: string;
    //   offset: number;
    text: string
  }[]
  // };
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
  // this is not from runner
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

const createRequestFunction = function (config: AxiosRequestConfig, endpoint: string , BASE_PATH: string) {
    const axiosRequestArgs = {...config, url: BASE_PATH + endpoint};
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
 *
 * @export
 * @class BaseAPI
 */
export class CortexAPI {
    protected apiKey: string;
    protected userId: string;
    protected basePath: string;

    constructor(apiKey?: string, userId?: string) {
        if (apiKey) {
            this.apiKey = apiKey;
        }
        if (userId) {
            this.userId = userId;
            this.basePath = 'https://trycortex.ai/api/sdk/p/'+ userId;
        }
    }

    public getDocument(knowledgeName:string, documentID:string): AxiosPromise<{document:Document}> {
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'GET',
          };
        const endpoint = '/knowledge/'+ knowledgeName + '/d/' + documentID;
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
    public uploadDocument(knowledgeName:string, documentID:string ,document: createDocument): AxiosPromise<{document:Document, knowledge: Knowledge}> {
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'POST',
            data: document,
          };
        const endpoint = '/knowledge/'+ knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    }

    /**
     * 
     * @param knowledgeName 
     * @param documentID 
     * @throws {Error}
     * @returns 
     */
    public deleteDocument(knowledgeName:string, documentID:string): AxiosPromise<{document:Document}> {
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'DELETE',
          };
        const endpoint = '/knowledge/'+ knowledgeName + '/d/' + documentID;
        return createRequestFunction(config, endpoint, this.basePath);
    }
    
    public runCallable(callableID: string, data: CallableParams): AxiosPromise<{run: RunType}> {
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

    public runCallableWithStream(callableID: string, data: CallableParams): AxiosPromise {
        const config = {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json'
            },
            method: 'POST',
            data: {...data, stream: true},
          };
        const endpoint = '/a/' + callableID + '/r';
        return createRequestFunction(config, endpoint, this.basePath);
    }

    

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

    public createChatConfig(projectID:string, knowledgeName: string) {
      const config = 
      {
        "OUTPUT_STREAM":{"use_stream":true},
        "RETRIEVALS":{"knowledge":[{"project_id":projectID,"data_source_id":knowledgeName}]}
      }
      return config;
    }
    
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
