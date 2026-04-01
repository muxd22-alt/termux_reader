import type { FastifyReply } from 'fastify'

/**
 * Start an SSE (Server-Sent Events) response stream.
 * Sets the required headers and returns a `send` helper for emitting events.
 */
export function startSSE(reply: FastifyReply): {
  send: (data: Record<string, unknown>) => void
  end: () => void
} {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  return {
    send(data: Record<string, unknown>) {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    },
    end() {
      reply.raw.end()
    },
  }
}
