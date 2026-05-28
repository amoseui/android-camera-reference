import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  composeApiMethodId,
  composeApiClassId,
  composeFrameworkId,
  composeHalId,
  composePermissionId,
  parseApiMethodId,
  canonicalizeParams,
  shortApiMethodId,
} from './id.js';

describe('id', () => {
  describe('unit: canonicalizeParams', () => {
    it('strips generics', () =>
      expect(canonicalizeParams(['List<Surface>'])).toEqual(['java.util.List']));

    it('preserves nested class', () =>
      expect(canonicalizeParams(['androidx.camera.core.ImageCapture$OnImageCapturedCallback'])).toEqual(
        ['androidx.camera.core.ImageCapture$OnImageCapturedCallback'],
      ));

    it('keeps multiple params', () =>
      expect(
        canonicalizeParams([
          'java.util.concurrent.Executor',
          'androidx.camera.core.ImageCapture$OnImageCapturedCallback',
        ]),
      ).toEqual([
        'java.util.concurrent.Executor',
        'androidx.camera.core.ImageCapture$OnImageCapturedCallback',
      ]));
  });

  describe('unit: composeApiClassId', () => {
    it('builds cameraX/.../ImageCapture', () =>
      expect(
        composeApiClassId({ family: 'cameraX', classPath: 'androidx/camera/core/ImageCapture' }),
      ).toBe('cameraX/androidx/camera/core/ImageCapture'));
  });

  describe('unit: composeApiMethodId', () => {
    it('builds full method id with canonical params', () =>
      expect(
        composeApiMethodId({
          family: 'cameraX',
          classPath: 'androidx/camera/core/ImageCapture',
          methodName: 'takePicture',
          canonicalParams: [
            'java.util.concurrent.Executor',
            'androidx.camera.core.ImageCapture$OnImageCapturedCallback',
          ],
        }),
      ).toBe(
        'cameraX/androidx/camera/core/ImageCapture/takePicture(java.util.concurrent.Executor,androidx.camera.core.ImageCapture$OnImageCapturedCallback)',
      ));
  });

  describe('unit: composeHalId', () => {
    it('uses _v notation', () =>
      expect(
        composeHalId({
          interfaceName: 'ICameraDeviceSession',
          memberName: 'processCaptureRequest',
          halVersion: '3.4',
        }),
      ).toBe('hal/ICameraDeviceSession::processCaptureRequest_v3.4'));
  });

  describe('unit: composePermissionId', () => {
    it('builds permission/...', () =>
      expect(composePermissionId({ permName: 'android.permission.CAMERA' })).toBe(
        'permission/android.permission.CAMERA',
      ));
  });

  describe('unit: composeFrameworkId', () => {
    it('builds framework/...#...', () =>
      expect(
        composeFrameworkId({
          classPath: 'android/hardware/camera2/CameraCaptureSession',
          methodName: 'capture',
          canonicalParams: ['android.hardware.camera2.CaptureRequest'],
        }),
      ).toBe(
        'framework/android/hardware/camera2/CameraCaptureSession#capture(android.hardware.camera2.CaptureRequest)',
      ));
  });

  describe('unit: parseApiMethodId', () => {
    it('round-trips simple', () => {
      const input = {
        family: 'cameraX' as const,
        classPath: 'androidx/camera/core/ImageCapture',
        methodName: 'takePicture',
        canonicalParams: ['java.util.concurrent.Executor'],
      };
      const id = composeApiMethodId(input);
      expect(parseApiMethodId(id)).toEqual(input);
    });
  });

  describe('unit: shortApiMethodId', () => {
    it('emits SimpleClass#method~0', () =>
      expect(
        shortApiMethodId(
          { family: 'cameraX', simpleClassName: 'ImageCapture', methodName: 'takePicture' },
          0,
        ),
      ).toBe('cameraX/ImageCapture#takePicture~0'));
  });

  describe('property: composeApiMethodId then parse round-trips', () => {
    it('any well-formed input survives round-trip', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('camera1', 'camera2', 'cameraX'),
          fc.stringMatching(/^[a-z]+(\/[A-Za-z][A-Za-z0-9]*)+$/),
          fc.stringMatching(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
          fc.array(fc.stringMatching(/^[a-z][a-z0-9.]*[A-Z][A-Za-z0-9$]*$/), { maxLength: 4 }),
          (family, classPath, methodName, canonicalParams) => {
            const input = { family: family as 'cameraX', classPath, methodName, canonicalParams };
            const id = composeApiMethodId(input);
            expect(parseApiMethodId(id)).toEqual(input);
          },
        ),
      );
    });
  });
});
