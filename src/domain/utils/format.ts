export const formatDateTime = (isoDate: string): string => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export const formatDate = (isoDate: string): string => {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short"
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};
