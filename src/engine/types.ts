export type SpeciesId =
  | "cat"
  | "dog"
  | "turtle"
  | "elephant"
  | "bird"
  | "eagle"
  | "ghost"
  | "rabbit";

export type ClimbStyle = "fly" | "jump";

export type PetState =
  | "idle"
  | "walk"
  | "fly"
  | "jump"
  | "fall"
  | "sit"
  | "sleep"
  | "drag";

export interface Species {
  id: SpeciesId;
  nameTr: string;
  nameEn: string;
  emoji: string;
  climb: ClimbStyle;
  speed: number;
  hopWalk: boolean;
  floatIdle: boolean;
  mass: number;
  scale: number;
  sound: string;
  blurb: string;
}

export interface Platform {
  id: string;
  title: string;
  minX: number;
  maxX: number;
  topY: number;
  isFloor?: boolean;
}

export interface NativeWindow {
  id: number;
  app: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppConfig {
  species: SpeciesId;
  onboarded: boolean;
  volume: number;
  openAtLogin: boolean;
}

export interface OverlayFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DigiPetBridge {
  desktop: boolean;
  getConfig(): Promise<AppConfig>;
  completeOnboarding(species: SpeciesId): Promise<AppConfig>;
  setSpecies(species: SpeciesId): Promise<void>;
  setVolume(volume: number): Promise<void>;
  openPicker(): Promise<void>;
  readyOverlay(): Promise<AppConfig & { workArea: WorkArea; overlay?: OverlayFrame }>;
  updateHitRegions(regions: Rect[]): void;
  openChat(): Promise<void>;
  closeChat(): Promise<void>;
  petSay(text: string): void;
  onPetSay(cb: (text: string) => void): () => void;
  onDesktop(cb: (data: { windows: NativeWindow[]; workArea: WorkArea; overlay: OverlayFrame }) => void): () => void;
  onSpecies(cb: (species: SpeciesId) => void): () => void;
  onVolume(cb: (volume: number) => void): () => void;
}

declare global {
  interface Window {
    digipet?: DigiPetBridge;
  }
}

export {};
