export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface ArchivedLife {
  id: string;
  age: number;
  year: number;
  birthYear: number;
  endingTitle: string;
  save: string;
}
