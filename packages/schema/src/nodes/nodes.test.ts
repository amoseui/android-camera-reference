import { describe, expect, it } from 'vitest';
import {
  ApiClassNode,
  ApiMethodNode,
  FrameworkSymbolNode,
  HalSymbolNode,
  PermissionNode,
  NodeUnion,
} from './index.js';

const baseProv = {
  source: 'aosp-code' as const,
  repo: 'https://android.googlesource.com/platform/frameworks/support',
  ref: 'androidx-camera-release',
  path: 'foo.java',
  lineRange: [1, 10] as [number, number],
  fetchedAt: '2026-05-29T00:17:00Z',
};

describe('nodes', () => {
  describe('unit: ApiClassNode', () => {
    it('accepts minimal valid', () => {
      const n = {
        id: 'cameraX/androidx/camera/core/ImageCapture',
        kind: 'ApiClass' as const,
        family: 'cameraX' as const,
        displayName: 'ImageCapture',
        packageName: 'androidx.camera.core',
        className: 'ImageCapture',
        classKind: 'class' as const,
        methods: [],
        provenance: [baseProv],
      };
      expect(ApiClassNode.parse(n)).toEqual(n);
    });

    it('rejects empty provenance', () => {
      expect(() => ApiClassNode.parse({ ...{}, provenance: [] })).toThrow();
    });
  });

  describe('unit: ApiMethodNode', () => {
    it('accepts minimal valid with versioned trace', () => {
      const n = {
        id: 'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)',
        kind: 'ApiMethod' as const,
        family: 'cameraX' as const,
        displayName: 'takePicture',
        ownerClass: 'cameraX/androidx/camera/core/ImageCapture',
        methodName: 'takePicture',
        canonicalParams: ['java.util.concurrent.Executor'],
        signature: {
          '..': {
            parameters: [{ name: 'executor', type: 'java.util.concurrent.Executor' }],
            returnType: 'void',
            modifiers: ['public'],
          },
        },
        tracesToHal: { '29..': ['hal/X::y_v3.4'] },
        provenance: [baseProv],
      };
      expect(ApiMethodNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: FrameworkSymbolNode', () => {
    it('accepts', () => {
      const n = {
        id: 'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
        kind: 'FrameworkSymbol' as const,
        displayName: 'CameraCaptureSession.capture',
        symbolKind: 'method' as const,
        fqName: 'android.hardware.camera2.CameraCaptureSession.capture',
        provenance: [baseProv],
      };
      expect(FrameworkSymbolNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: HalSymbolNode', () => {
    it('accepts _v3.4', () => {
      const n = {
        id: 'hal/ICameraDeviceSession::processCaptureRequest_v3.4',
        kind: 'HalSymbol' as const,
        displayName: 'processCaptureRequest',
        symbolKind: 'method' as const,
        interface: 'ICameraDeviceSession',
        member: 'processCaptureRequest',
        halVersion: '3.4',
        provenance: [baseProv],
      };
      expect(HalSymbolNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: PermissionNode', () => {
    it('accepts', () => {
      const n = {
        id: 'permission/android.permission.CAMERA',
        kind: 'Permission' as const,
        displayName: 'CAMERA',
        permName: 'android.permission.CAMERA',
        provenance: [baseProv],
      };
      expect(PermissionNode.parse(n)).toEqual(n);
    });
  });

  describe('unit: NodeUnion', () => {
    it('discriminates on kind', () => {
      const n = {
        id: 'permission/android.permission.CAMERA',
        kind: 'Permission' as const,
        displayName: 'CAMERA',
        permName: 'android.permission.CAMERA',
        provenance: [baseProv],
      };
      const parsed = NodeUnion.parse(n);
      expect(parsed.kind).toBe('Permission');
    });
  });
});
