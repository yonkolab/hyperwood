import Fastify from "fastify";
import ScalarApiReference from "@scalar/fastify-api-reference";
import { bundleOpenApi, validateOpenApi } from "./openapi.mjs";

const host = process.env.DOCS_PREVIEW_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.DOCS_PREVIEW_PORT ?? "8081", 10);

await validateOpenApi();
const bundledSpec = await bundleOpenApi();

const app = Fastify({ logger: false });

app.get("/openapi.json", async () => bundledSpec);

await app.register(ScalarApiReference, {
  routePrefix: "/reference",
  configuration: {
    title: "Hyperwood API Reference",
    url: "/openapi.json",
  },
});

app.get("/", async (_request, reply) => {
  reply.redirect("/reference");
});

try {
  const address = await app.listen({ host, port });
  console.log(`Docs preview available at ${address}/reference`);
} catch (error) {
  console.error("Failed to start Scalar docs preview.");
  console.error(error);
  process.exit(1);
}
