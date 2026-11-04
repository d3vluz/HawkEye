// Guarda só os dígitos: a máscara é do frontend e a busca compara números.
export function toPhoneDigits(value: unknown) {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  return digits === '' ? null : digits;
}
