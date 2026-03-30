/**
 * Transcribe audio using Groq's Whisper endpoint.
 * Supports OGG/Opus (WhatsApp default), MP4, and other common formats.
 */
export async function transcribeAudio(audioData: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.split('/')[1] ?? 'ogg'

  const formData = new FormData()
  formData.append('file', new Blob([audioData], { type: mimeType }), `audio.${ext}`)
  formData.append('model', 'whisper-large-v3')
  formData.append('response_format', 'text')
  // No language forced — Whisper auto-detects (handles German, Turkish, etc.)

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: formData,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText)
    throw new Error(`Groq transcription failed ${res.status}: ${body}`)
  }

  return (await res.text()).trim()
}
