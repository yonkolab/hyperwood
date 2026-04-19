import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

const openApiSourcePath = resolve(process.cwd(), 'docs/openapi/openapi.yaml');

export function getOpenApiSourcePath() {
  return openApiSourcePath;
}

export async function validateOpenApi() {
  return SwaggerParser.validate(openApiSourcePath);
}

export async function bundleOpenApi() {
  return SwaggerParser.bundle(openApiSourcePath);
}

export async function writeBundledOpenApi(outputPath) {
  const bundledDocument = await bundleOpenApi();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify(bundledDocument, null, 2)}\n`,
    'utf8',
  );

  return bundledDocument;
}
