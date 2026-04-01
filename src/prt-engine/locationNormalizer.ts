export const normalizeLocationName = (rawLocationName: string): string => {
  const value = rawLocationName.trim();
  if (!value) {
    return value;
  }

  const galpaoComNumero = value.match(/^g\s*([0-9]+)\b(.*)$/i);
  if (galpaoComNumero) {
    const numero = galpaoComNumero[1];
    const sufixo = galpaoComNumero[2]?.trim();
    return sufixo ? `Galpão ${numero} ${sufixo}` : `Galpão ${numero}`;
  }

  const galpaoSemNumero = value.match(/^g\b(.*)$/i);
  if (galpaoSemNumero) {
    const sufixo = galpaoSemNumero[1]?.trim();
    return sufixo ? `Galpão ${sufixo}` : "Galpão";
  }

  return value;
};
