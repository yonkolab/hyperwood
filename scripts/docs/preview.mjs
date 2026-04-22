import { networkInterfaces } from 'node:os';
import ScalarApiReference from '@scalar/fastify-api-reference';
import Fastify from 'fastify';
import { bundleOpenApi, validateOpenApi } from './openapi.mjs';

const host = process.env.DOCS_PREVIEW_HOST ?? '0.0.0.0';
const port = Number.parseInt(process.env.DOCS_PREVIEW_PORT ?? '8081', 10);

await validateOpenApi();
const bundledSpec = await bundleOpenApi();

const app = Fastify({ logger: false });

function getReachableUrls(portNumber) {
  const interfaces = networkInterfaces();
  const urls = new Set([`http://localhost:${portNumber}/reference/`]);

  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) {
        continue;
      }

      urls.add(`http://${address.address}:${portNumber}/reference/`);
    }
  }

  return Array.from(urls);
}

app.get('/openapi.json', async () => bundledSpec);

await app.register(ScalarApiReference, {
  routePrefix: '/reference',
  configuration: {
    title: 'Hyperwood API Reference',
    url: '/openapi.json',
  },
});

app.get('/', async (_request, reply) => {
  reply.redirect('/reference');
});

try {
  await app.listen({ host, port });
  console.log('Docs preview is running.');

  for (const url of getReachableUrls(port)) {
    console.log(`- ${url}`);
  }
} catch (error) {
  console.error('Failed to start Scalar docs preview.');
  console.error(error);
  process.exit(1);
}
