import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'
import ffmpegPath from 'ffmpeg-static'

export function buildBenchmarkVideoArguments(frameCount, outputPath) {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new Error('frameCount must be a positive integer')
  }
  return [
    '-y', '-f', 'lavfi', '-i', 'color=c=black:s=16x16:r=30',
    '-frames:v', String(frameCount), '-c:v', 'libx264', '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p', outputPath,
  ]
}

function runFfmpeg(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: 'ignore', windowsHide: true })
    child.once('error', reject)
    child.once('exit', (code) => code === 0
      ? resolvePromise()
      : reject(new Error(`ffmpeg exited with ${code}`)))
  })
}

export async function createBenchmarkAssets(outputDirectory) {
  if (!outputDirectory) throw new Error('an explicit output directory is required')
  const directory = resolve(outputDirectory)
  await mkdir(directory, { recursive: true })
  const shortVideo = join(directory, 'canvas-raw-300.mp4')
  const longVideo = join(directory, 'canvas-raw-11248.mp4')
  await runFfmpeg(buildBenchmarkVideoArguments(300, shortVideo))
  await runFfmpeg(buildBenchmarkVideoArguments(11248, longVideo))
  return { shortVideo, longVideo }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, '$1'))) {
  await createBenchmarkAssets(process.argv[2])
}
