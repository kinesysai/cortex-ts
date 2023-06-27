# cortex-ts

## Installation

```bash
npm install cortex-ts
```

## Usage

First initalize the CortexAPI class with your API key and user ID. You can find your API key and user ID in the Cortex dashboard.

```typescript
import { CortexAPI } from 'cortex-ts';
const {CORTEX_API_KEY, USER_ID} = process.env;

const cortex = new CortexAPI(CORTEX_API_KEY,USER_ID);

```

Then you can use the API methods to interact with the Cortex API.

```typescript

try {
    const res = await cortex.getDocument('tigers','testing.txt')
    const document = res.data.document
    console.log(document.text);
} catch (error) {
    if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
    } else {
        console.log(error.message);
    }
}

```

```typescript

const testing = {
  "source_url": "https://www.test.com/",
  "text": "test"
  }

try {
  let output = await cortex.uploadDocument('tigers','test1',testing);
  console.log(output.data.document);
} catch (error:any) {
  if (error.response) {
    console.log(error.response.status);
    console.log(error.response.data);
  } else {
    console.log(error.message);
  }
}

```

```typescript

try {
  let output = await cortex.deleteDocument('tigers','test1');
  console.log(output.data.document);
} catch (error:any) {
  if (error.response) {
    console.log(error.response.status);
    console.log(error.response.data);
  } else {
    console.log(error.message);
  }
}

```
