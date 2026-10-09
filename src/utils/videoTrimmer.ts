/**
 * Utility for in-browser client video trimming, frame capture, and FFmpeg command generation
 */

export interface TrimResult {
  trimmedBlobUrl: string;
  trimmedBlob: Blob;
  thumbnailUrl: string;
  originalDuration: number;
  trimmedDuration: number;
}

/**
 * Trims the first N seconds (e.g., 5 seconds) of a video in the browser
 * using HTML5 Canvas and MediaRecorder.
 */
export async function trimVideoInBrowser(
  videoSourceUrl: string,
  cutSeconds: number = 5.0,
  onProgress?: (progress: number) => void
): Promise<TrimResult> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoSourceUrl;
    video.muted = false;

    video.onloadedmetadata = async () => {
      const originalDuration = video.duration;
      const targetStartTime = Math.min(cutSeconds, Math.max(0, originalDuration - 0.5));
      const trimmedDuration = Math.max(0.1, originalDuration - targetStartTime);

      // Create offscreen canvas matching video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas 2D context not available'));
        return;
      }

      // Capture stream from canvas & audio from video
      const canvasStream = canvas.captureStream(30);
      let combinedStream = canvasStream;

      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const sourceNode = audioContext.createMediaElementSource(video);
        const destNode = audioContext.createMediaStreamDestination();
        sourceNode.connect(destNode);
        sourceNode.connect(audioContext.destination);

        const audioTrack = destNode.stream.getAudioTracks()[0];
        if (audioTrack) {
          combinedStream.addTrack(audioTrack);
        }
      } catch (err) {
        // Fallback to video-only if audio context fails in background
        console.warn('Audio capture failed, proceeding with video stream', err);
      }

      // Setup MediaRecorder
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      let thumbnailCaptured = '';

      recorder.onstop = () => {
        const finalBlob = new Blob(chunks, { type: mimeType });
        const trimmedBlobUrl = URL.createObjectURL(finalBlob);

        resolve({
          trimmedBlobUrl,
          trimmedBlob: finalBlob,
          thumbnailUrl: thumbnailCaptured || '',
          originalDuration,
          trimmedDuration,
        });
      };

      // Seek to targetStartTime (e.g. 5.0 seconds)
      video.currentTime = targetStartTime;

      video.onseeked = () => {
        // Capture thumbnail right after seek
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        thumbnailCaptured = canvas.toDataURL('image/jpeg', 0.85);

        recorder.start(100);
        video.play();

        const renderInterval = setInterval(() => {
          if (video.ended || video.currentTime >= originalDuration) {
            clearInterval(renderInterval);
            if (recorder.state === 'recording') {
              recorder.stop();
            }
            return;
          }

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const currentProgress = Math.min(
            100,
            Math.round(((video.currentTime - targetStartTime) / trimmedDuration) * 100)
          );
          if (onProgress) {
            onProgress(currentProgress);
          }
        }, 1000 / 30);

        video.onended = () => {
          clearInterval(renderInterval);
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        };
      };
    };

    video.onerror = () => {
      reject(new Error('Failed to load video element for trimming'));
    };
  });
}

/**
 * Capture a single thumbnail frame from a video URL at a specific timestamp
 */
export async function captureThumbnail(videoUrl: string, atSeconds: number = 5.2): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.muted = true;

    video.onloadedmetadata = () => {
      const seekTime = Math.min(atSeconds, Math.max(0, video.duration - 0.5));
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      } else {
        resolve('');
      }
    };

    video.onerror = () => {
      resolve('');
    };
  });
}

/**
 * Generates the precise FFmpeg CLI command for cutting the first 5 seconds
 */
export function getFfmpegCommands(cutSeconds: number = 5.0) {
  return {
    fastStreamCopy: `ffmpeg -ss ${cutSeconds.toFixed(1)} -i "input.mp4" -c copy -avoid_negative_ts make_zero "trimmed_output.mp4"`,
    highQualityReencode: `ffmpeg -ss ${cutSeconds.toFixed(1)} -i "input.mp4" -c:v libx264 -preset veryfast -crf 22 -c:a aac -b:a 192k "trimmed_output.mp4"`,
    generatePostCutThumbnail: `ffmpeg -ss ${(cutSeconds + 0.5).toFixed(1)} -i "input.mp4" -vframes 1 -q:v 2 "thumbnail.jpg"`,
  };
}
