import type { NodeUnion } from '@acref/schema';
import { provenance } from '@acref/extractor-core';

export interface FixtureExtractInput {
  target: number;
}

export interface FixtureExtractOutput {
  nodes: Record<string, NodeUnion>;
}

export function extractFixture(_input: FixtureExtractInput): FixtureExtractOutput {
  const prov = provenance({
    source: 'aosp-code',
    repo: 'https://example.invalid/fixture',
    ref: 'fixture-v0',
    path: 'fixture/ImageCapture.java',
    lineRange: [1, 10],
  });

  const classNode = {
    id: 'cameraX/androidx/camera/core/ImageCapture',
    kind: 'ApiClass' as const,
    family: 'cameraX' as const,
    displayName: 'ImageCapture',
    packageName: 'androidx.camera.core',
    className: 'ImageCapture',
    classKind: 'class' as const,
    methods: ['cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)'],
    provenance: [prov],
  };

  const methodNode = {
    id: 'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor)',
    kind: 'ApiMethod' as const,
    family: 'cameraX' as const,
    displayName: 'ImageCapture.takePicture(Executor)',
    shortId: 'cameraX/ImageCapture#takePicture~0',
    ownerClass: 'cameraX/androidx/camera/core/ImageCapture',
    methodName: 'takePicture',
    canonicalParams: ['java.util.concurrent.Executor'],
    returnType: 'void',
    signature: {
      '..': {
        parameters: [{ name: 'executor', type: 'java.util.concurrent.Executor' }],
        returnType: 'void',
        modifiers: ['public'],
      },
    },
    tracesToFramework: [
      'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
    ],
    tracesToHal: { '34..': ['hal/ICameraDeviceSession::processCaptureRequest_v3.7'] },
    requiresPermission: ['permission/android.permission.CAMERA'],
    tags: ['still-capture'],
    provenance: [prov],
  };

  const frameworkNode = {
    id: 'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
    kind: 'FrameworkSymbol' as const,
    displayName: 'CameraCaptureSession.capture',
    symbolKind: 'method' as const,
    fqName: 'android.hardware.camera2.CameraCaptureSession.capture',
    provenance: [prov],
  };

  const halNode = {
    id: 'hal/ICameraDeviceSession::processCaptureRequest_v3.7',
    kind: 'HalSymbol' as const,
    displayName: 'processCaptureRequest',
    symbolKind: 'method' as const,
    interface: 'ICameraDeviceSession',
    member: 'processCaptureRequest',
    halVersion: '3.7',
    provenance: [prov],
  };

  const permissionNode = {
    id: 'permission/android.permission.CAMERA',
    kind: 'Permission' as const,
    displayName: 'CAMERA',
    permName: 'android.permission.CAMERA',
    provenance: [prov],
  };

  return {
    nodes: {
      [classNode.id]: classNode,
      [methodNode.id]: methodNode,
      [frameworkNode.id]: frameworkNode,
      [halNode.id]: halNode,
      [permissionNode.id]: permissionNode,
    },
  };
}
