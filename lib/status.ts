/** Errores pasajeros de una tienda (vale la pena reintentar): demoras, cortes, 429 y 5xx */
export const isTransient = (error?: string) => !!error && /tardó|no se pudo conectar|respondió (429|5\d\d)/i.test(error);
