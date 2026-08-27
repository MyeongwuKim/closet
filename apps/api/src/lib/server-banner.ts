import { networkInterfaces } from 'node:os'

export function createServerBanner(
  host: string,
  port: number,
  interfaces = networkInterfaces(),
) {
  const listensOnAllInterfaces = host === '0.0.0.0' || host === '::'
  const localHost = listensOnAllInterfaces ? 'localhost' : host
  const urlHost = localHost.includes(':') ? `[${localHost}]` : localHost
  const lines = ['closet API', '', `Local:   http://${urlHost}:${port}`]

  if (listensOnAllInterfaces) {
    const addresses = new Set(
      Object.values(interfaces).flatMap((entries) =>
        (entries ?? [])
          .filter(
            (entry) =>
              entry.family === 'IPv4' &&
              !entry.internal &&
              !entry.address.startsWith('169.254.'),
          )
          .map((entry) => entry.address),
      ),
    )

    for (const address of addresses) {
      lines.push(`Network: http://${address}:${port}`)
    }
    if (addresses.size === 0) {
      lines.push('Network: no LAN IPv4 address found')
    }
  }

  const width = Math.max(...lines.map((line) => line.length))
  const border = '─'.repeat(width + 2)
  return [
    '',
    `┌${border}┐`,
    ...lines.map((line) => `│ ${line.padEnd(width)} │`),
    `└${border}┘`,
    '',
  ].join('\n')
}
