import type { FastifyRequest } from 'fastify';

type WorkflowLogFields = Record<string, unknown>;

export function getRequestLogContext(request: FastifyRequest) {
  return {
    requestId: request.id,
    method: request.method,
    route: request.routeOptions.url ?? request.url,
  };
}

export function logWorkflowEvent(
  request: FastifyRequest,
  event: string,
  fields: WorkflowLogFields = {},
) {
  request.log.info(
    {
      event,
      ...getRequestLogContext(request),
      ...fields,
    },
    event,
  );
}
