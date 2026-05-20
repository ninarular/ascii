import express from 'express';
import { spawn } from 'node:child_process';
import { readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import ffmpegPath from 'ffmpeg-static';
import ytDlp from 'yt-dlp-exec';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/youtube-stream', async (req, res) => {
  const url = String(req.query.url || '');

  if (!isYouTubeUrl(url)) {
    res.status(400).json({ error: 'Invalid YouTube URL' });
    return;
  }

  let streamUrl = '';
  let ffmpeg = null;

  req.on('close', () => {
    ffmpeg?.kill('SIGTERM');
  });

  try {
    const ytDlpResult = await ytDlp(url, {
      forceIpv4: true,
      noPlaylist: true,
      quiet: true,
      noWarnings: true,
      extractorArgs: 'youtube:player_client=android',
      getUrl: true,
      format: '232/231/230/229/269/18/best[height<=720]'
    });

    streamUrl = String(ytDlpResult).trim().split('\n')[0];
  } catch (err) {
    respondWithApiError(res, err);
    return;
  }

  if (!streamUrl) {
    respondWithApiError(res, new Error('yt-dlp did not return a playable video stream URL'));
    return;
  }

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Cache-Control', 'no-store');

  ffmpeg = spawn(ffmpegPath, [
    '-loglevel',
    'error',
    '-i',
    streamUrl,
    '-an',
    '-c:v',
    'copy',
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
    '-f',
    'mp4',
    '-'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let ffmpegErrorOutput = '';

  ffmpeg.stderr.on('data', (chunk) => {
    ffmpegErrorOutput += chunk.toString();
  });

  ffmpeg.stdout.pipe(res);

  ffmpeg.on('error', (err) => {
    if (!res.headersSent) respondWithApiError(res, err);
    else res.destroy(err);
  });

  ffmpeg.on('close', (ffmpegCode) => {
    if (ffmpegCode === 0 || res.writableEnded) return;

    const err = new Error(ffmpegErrorOutput || `ffmpeg exited with code ${ffmpegCode}`);
    if (!res.headersSent) respondWithApiError(res, err);
    else res.destroy(err);
  });
});

app.post('/api/export-mp4', express.raw({
  type: (req) => {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    return contentType.startsWith('video/') || contentType.includes('application/octet-stream');
  },
  limit: '250mb'
}), async (req, res) => {
  const inputBuffer = req.body;

  if (!Buffer.isBuffer(inputBuffer) || inputBuffer.length === 0) {
    res.status(400).json({ error: 'Missing recorded video payload.' });
    return;
  }

  try {
    const mp4Buffer = await transcodeWebmToMp4(inputBuffer);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', String(mp4Buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.send(mp4Buffer);
  } catch (err) {
    respondWithApiError(res, err);
  }
});

function transcodeWebmToMp4(inputBuffer) {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(tmpdir(), `ascii-render-${randomUUID()}.mp4`);
    const ffmpeg = spawn(ffmpegPath, [
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      outputPath
    ], {
      stdio: ['pipe', 'ignore', 'pipe']
    });

    let ffmpegErrorOutput = '';

    ffmpeg.stderr.on('data', (chunk) => {
      ffmpegErrorOutput += chunk.toString();
    });

    ffmpeg.on('error', reject);

    ffmpeg.on('close', async (code) => {
      if (code === 0) {
        try {
          const outputBuffer = await readFile(outputPath);
          await unlink(outputPath).catch(() => {});
          resolve(outputBuffer);
        } catch (err) {
          reject(err);
        }

        return;
      }

      await unlink(outputPath).catch(() => {});
      reject(new Error(ffmpegErrorOutput || `ffmpeg exited with code ${code}`));
    });

    ffmpeg.stdin.end(inputBuffer);
  });
}

function respondWithApiError(res, err) {
  const { status, message } = normalizeApiError(err);
  console.error(message);

  if (res.headersSent) return;
  res.status(status).json({ error: message });
}

function normalizeApiError(err) {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('No video formats found')) {
    return { status: 502, message: 'YouTube did not expose a playable stream for this video.' };
  }

  if (message.includes('Video unavailable')) {
    return { status: 404, message: 'This YouTube video is unavailable.' };
  }

  if (message.includes('Private video')) {
    return { status: 403, message: 'This YouTube video is private and cannot be streamed.' };
  }

  return { status: 500, message };
}

function isYouTubeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, '');
    return host === 'youtu.be' || host.endsWith('youtube.com');
  } catch {
    return false;
  }
}

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa'
  });

  app.use(vite.middlewares);
}

const port = Number(process.env.PORT || 5173);
app.listen(port, () => {
  console.log(`Ascii Visualizer running at http://127.0.0.1:${port}/`);
});
