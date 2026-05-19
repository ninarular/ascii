import express from 'express';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/youtube-stream', async (req, res, next) => {
  const url = String(req.query.url || '');

  if (!isYouTubeUrl(url)) {
    res.status(400).json({ error: 'Invalid YouTube URL' });
    return;
  }

  const ytDlp = spawn('yt-dlp', [
    '--force-ipv4',
    '--no-playlist',
    '--quiet',
    '--no-warnings',
    '--extractor-args',
    'youtube:player_client=android',
    '--get-url',
    '--format',
    '232/231/230/229/269/18/best[height<=720]',
    url
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let errorOutput = '';
  let streamUrlOutput = '';
  let ffmpeg = null;

  req.on('close', () => {
    ytDlp.kill('SIGTERM');
    ffmpeg?.kill('SIGTERM');
  });

  ytDlp.stdout.on('data', (chunk) => {
    streamUrlOutput += chunk.toString();
  });

  ytDlp.stderr.on('data', (chunk) => {
    errorOutput += chunk.toString();
  });

  ytDlp.on('error', (err) => {
    if (!res.headersSent) next(err);
    else res.destroy(err);
  });

  ytDlp.on('close', (code) => {
    if (res.writableEnded) return;

    if (code !== 0) {
      next(new Error(errorOutput || `yt-dlp exited with code ${code}`));
      return;
    }

    const streamUrl = streamUrlOutput.trim().split('\n')[0];

    if (!streamUrl) {
      next(new Error('yt-dlp did not return a playable video stream URL'));
      return;
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Cache-Control', 'no-store');

    ffmpeg = spawn('ffmpeg', [
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
      if (!res.headersSent) next(err);
      else res.destroy(err);
    });

    ffmpeg.on('close', (ffmpegCode) => {
      if (ffmpegCode === 0 || res.writableEnded) return;

      const err = new Error(ffmpegErrorOutput || `ffmpeg exited with code ${ffmpegCode}`);
      if (!res.headersSent) next(err);
      else res.destroy(err);
    });
  });
});

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
