import { getOpenApiSourcePath, validateOpenApi } from './openapi.mjs';

await validateOpenApi();

console.log(`OpenAPI document is valid: ${getOpenApiSourcePath()}`);
