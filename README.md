# cortex-ts

## Installation

```bash
npm install cortex-ts
```

## Usage

The library needs to be configured with your account's secret key, which is available in (https://trycortex.ai/p/[piD]/s). We recommend setting it as an environment variable. Here's an example of initializing the library with the API key loaded from an environment variable and creating a completion:

```typescript
import { CortexAPI } from 'cortex-ts';
const {CORTEX_API_KEY, USER_ID} = process.env;

const cortex = new CortexAPI(CORTEX_API_KEY,USER_ID);

const knowledge = cortex.getKnowledge();

console.log(knowledge);

```
