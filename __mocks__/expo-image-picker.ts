/**
 * Mock for expo-image-picker in tests.
 */

export type ImagePickerAsset = {
  uri: string;
  width: number;
  height: number;
  type?: 'image' | 'video';
};

export type ImagePickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: ImagePickerAsset[] };

export type PermissionResponse = {
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  granted: boolean;
  expires: 'never' | number;
};

let mockCameraPermission: PermissionResponse = {
  status: 'granted',
  canAskAgain: true,
  granted: true,
  expires: 'never',
};

let mockMediaLibraryPermission: PermissionResponse = {
  status: 'granted',
  canAskAgain: true,
  granted: true,
  expires: 'never',
};

let mockLaunchCameraResult: ImagePickerResult = {
  canceled: false,
  assets: [{ uri: 'file:///mock-camera.jpg', width: 1000, height: 1000 }],
};

let mockLaunchImageLibraryResult: ImagePickerResult = {
  canceled: false,
  assets: [{ uri: 'file:///mock-library.jpg', width: 1000, height: 1000 }],
};

export async function requestCameraPermissionsAsync(): Promise<PermissionResponse> {
  return mockCameraPermission;
}

export async function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse> {
  return mockMediaLibraryPermission;
}

export async function launchCameraAsync(): Promise<ImagePickerResult> {
  return mockLaunchCameraResult;
}

export async function launchImageLibraryAsync(): Promise<ImagePickerResult> {
  return mockLaunchImageLibraryResult;
}

export function __setMockCameraPermission(permission: Partial<PermissionResponse>): void {
  mockCameraPermission = { ...mockCameraPermission, ...permission };
}

export function __setMockMediaLibraryPermission(permission: Partial<PermissionResponse>): void {
  mockMediaLibraryPermission = { ...mockMediaLibraryPermission, ...permission };
}

export function __setMockLaunchCameraResult(result: ImagePickerResult): void {
  mockLaunchCameraResult = result;
}

export function __setMockLaunchImageLibraryResult(result: ImagePickerResult): void {
  mockLaunchImageLibraryResult = result;
}

export function __resetMocks(): void {
  mockCameraPermission = {
    status: 'granted',
    canAskAgain: true,
    granted: true,
    expires: 'never',
  };
  mockMediaLibraryPermission = {
    status: 'granted',
    canAskAgain: true,
    granted: true,
    expires: 'never',
  };
  mockLaunchCameraResult = {
    canceled: false,
    assets: [{ uri: 'file:///mock-camera.jpg', width: 1000, height: 1000 }],
  };
  mockLaunchImageLibraryResult = {
    canceled: false,
    assets: [{ uri: 'file:///mock-library.jpg', width: 1000, height: 1000 }],
  };
}
