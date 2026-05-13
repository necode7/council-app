const MAX_LENGTH = 10_000

export function sanitizeInput(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_LENGTH)
}
