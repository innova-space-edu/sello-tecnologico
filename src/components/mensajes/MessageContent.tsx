'use client'

type Props = {
  content: string
  isMe?: boolean
}

function isInternalAttachmentLink(text: string) {
  return text.startsWith('/api/mensajes/adjunto/')
}

function isHttpLink(text: string) {
  return text.startsWith('http://') || text.startsWith('https://')
}

export default function MessageContent({ content, isMe }: Props) {
  const lines = content.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, index) => {
        const trimmed = line.trim()

        const maybeLink = trimmed.includes(': ')
          ? trimmed.split(': ').at(-1)?.trim() ?? ''
          : trimmed

        if (isInternalAttachmentLink(maybeLink) || isHttpLink(maybeLink)) {
          const label = trimmed.includes(': ')
            ? trimmed.replace(maybeLink, '').replace(/:\s*$/, '')
            : 'Abrir archivo'

          return (
            <p key={`${line}-${index}`}>
              <a
                href={maybeLink}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline font-semibold ${isMe ? 'text-blue-100' : 'text-blue-600'}`}
              >
                {label || 'Abrir archivo'}
              </a>
            </p>
          )
        }

        if (!trimmed) return <br key={`br-${index}`} />
        return <p key={`${line}-${index}`}>{line}</p>
      })}
    </div>
  )
}
