import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SelfieCapture, { SELFIE_MAX_BYTES, compressToJpeg, dataUrlBytes } from './SelfieCapture.jsx';

function jpegDataUrl(bytes) {
  // base64 length for `bytes` decoded bytes (no padding when bytes % 3 === 0)
  return `data:image/jpeg;base64,${'A'.repeat(Math.ceil(bytes / 3) * 4)}`;
}

function mockStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } };
}

function setMediaDevices(value) {
  Object.defineProperty(window.navigator, 'mediaDevices', { value, configurable: true, writable: true });
}

describe('SelfieCapture', () => {
  let drawImage;

  beforeEach(() => {
    drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(jpegDataUrl(30 * 1024));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    setMediaDevices(undefined);
  });

  it('opens the front camera, captures a compressed JPEG and hands it to onCapture', async () => {
    const { stream, track } = mockStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    setMediaDevices({ getUserMedia });
    const onCapture = vi.fn();

    render(<SelfieCapture onCapture={onCapture} onCancel={vi.fn()} />);

    const take = await screen.findByRole('button', { name: /take selfie/i });
    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({
      audio: false,
      video: expect.objectContaining({ facingMode: 'user' }),
    }));

    fireEvent.click(take);

    expect(drawImage).toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
    expect(screen.getByAltText(/your check-in selfie/i).getAttribute('src')).toMatch(/^data:image\/jpeg;base64,/);

    fireEvent.click(screen.getByRole('button', { name: /use photo/i }));
    expect(onCapture).toHaveBeenCalledTimes(1);
    expect(onCapture.mock.calls[0][0]).toMatch(/^data:image\/jpeg;base64,/);
    expect(dataUrlBytes(onCapture.mock.calls[0][0])).toBeLessThanOrEqual(SELFIE_MAX_BYTES);
  });

  it('lets the employee retake, restarting the camera', async () => {
    const getUserMedia = vi.fn().mockImplementation(() => Promise.resolve(mockStream().stream));
    setMediaDevices({ getUserMedia });

    render(<SelfieCapture onCapture={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /take selfie/i }));
    fireEvent.click(screen.getByRole('button', { name: /retake/i }));

    expect(await screen.findByRole('button', { name: /take selfie/i })).toBeTruthy();
    expect(getUserMedia.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByAltText(/your check-in selfie/i)).toBeNull();
  });

  it('falls back to a capture="user" file input when getUserMedia is unavailable', () => {
    setMediaDevices(undefined);

    render(<SelfieCapture onCapture={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: /take photo/i })).toBeTruthy();
    const input = screen.getByTestId('selfie-file-input');
    expect(input.getAttribute('capture')).toBe('user');
    expect(input.getAttribute('accept')).toBe('image/*');
  });

  it('falls back with a clear message when camera permission is denied', async () => {
    const denied = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    setMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(denied) });

    render(<SelfieCapture onCapture={vi.fn()} onCancel={vi.fn()} />);

    expect(await screen.findByText(/camera permission was denied/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /take photo/i })).toBeTruthy();
  });

  it('stops the camera when cancelled', async () => {
    const { stream, track } = mockStream();
    setMediaDevices({ getUserMedia: vi.fn().mockResolvedValue(stream) });
    const onCancel = vi.fn();

    render(<SelfieCapture onCapture={vi.fn()} onCancel={onCancel} />);
    await screen.findByRole('button', { name: /take selfie/i });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => expect(onCancel).toHaveBeenCalled());
    expect(track.stop).toHaveBeenCalled();
  });
});

describe('compressToJpeg', () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() });
  });

  it('scales to 640px and lowers quality until the JPEG fits 200 KB', () => {
    const sizes = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function toDataURL(type, quality) {
      sizes.push({ width: this.width, height: this.height, type, quality });
      return quality > 0.6 ? jpegDataUrl(400 * 1024) : jpegDataUrl(150 * 1024);
    });

    const result = compressToJpeg({}, 1280, 960);

    expect(sizes[0]).toMatchObject({ width: 640, height: 480, type: 'image/jpeg' });
    expect(sizes.length).toBeGreaterThan(1);
    expect(dataUrlBytes(result)).toBeLessThanOrEqual(SELFIE_MAX_BYTES);
  });
});
