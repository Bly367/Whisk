/**
 * Mock for expo-mlkit-ocr in tests.
 * Allows tests to run without native OCR module.
 */

export type OCRBlock = {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  lines: OCRLine[];
};

export type OCRLine = {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  elements: OCRElement[];
};

export type OCRElement = {
  text: string;
  boundingBox: { x: number; y: number; width: number; height: number };
};

export type OCRResult = {
  text: string;
  blocks: OCRBlock[];
};

let mockIsSupported = true;
let mockRecognizeTextImpl: ((uri: string) => Promise<OCRResult>) | null = null;

export function isSupported(): boolean {
  return mockIsSupported;
}

export async function recognizeText(uri: string): Promise<OCRResult> {
  if (mockRecognizeTextImpl) {
    return mockRecognizeTextImpl(uri);
  }
  return {
    text: 'Mock OCR text',
    blocks: [],
  };
}

export function __setMockIsSupported(value: boolean): void {
  mockIsSupported = value;
}

export function __setMockRecognizeText(impl: (uri: string) => Promise<OCRResult>): void {
  mockRecognizeTextImpl = impl;
}

export function __resetMocks(): void {
  mockIsSupported = true;
  mockRecognizeTextImpl = null;
}
