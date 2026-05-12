import dayjs from 'dayjs'

export function formatTs(iso: string) {
  const d = dayjs(iso)
  if (!d.isValid()) return iso
  return d.format('YYYY-MM-DD HH:mm')
}

