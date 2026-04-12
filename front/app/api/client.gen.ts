// Placeholder for @hey-api/openapi-ts generated client.
// Run `pnpm run api:generate` to generate from backend OpenAPI schema.

type Interceptors = {
  request: { use: (fn: (request: Request) => Promise<Request>) => void };
  response: { use: (fn: (response: Response) => Promise<Response>) => void };
};

interface Client {
  setConfig: (config: { baseUrl?: string }) => void;
  getConfig: () => { baseUrl: string };
  interceptors: Interceptors;
}

function createInterceptorManager() {
  const fns: Array<(arg: any) => Promise<any>> = [];
  return {
    use: (fn: (arg: any) => Promise<any>) => {
      fns.push(fn);
    },
    _fns: fns,
  };
}

export const client: Client = {
  setConfig: () => {},
  getConfig: () => ({ baseUrl: "/api" }),
  interceptors: {
    request: createInterceptorManager(),
    response: createInterceptorManager(),
  },
};
