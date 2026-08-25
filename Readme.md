## Audio Refinement Plan

This project prepares raw audio files into a clean and consistent format for downstream processing (such as transcription, analytics, or AI models).

## Why Rust

We chose Rust for the audio-processing pipeline because it provides:

- High performance for CPU-heavy audio operations.
- Memory safety without a garbage collector.
- Strong ecosystem support for decoding, resampling, and loudness handling.
- Reliable behavior in production services.

## Libraries Used and Purpose

- `symphonia` (core + codec/format support)
  - Used to decode compressed audio formats (for example, MP3) into raw PCM samples.
- `rubato`
  - Used to resample audio to a fixed sample rate (16,000 Hz).
- `ebur128`
  - Used to normalize loudness so output volume is more consistent.
- WAV writer utilities
  - Used to export the final processed audio as WAV.

## Processing Flow

1. Decode input audio
   - Input files (such as MP3) are decoded into PCM frames using `symphonia`.

2. Convert stereo to mono (if required)
   - If the source has multiple channels, channels are merged to a single mono channel.

3. Resample to 16 kHz
   - Audio is resampled to 16,000 Hz using `rubato`.
   - This ensures consistent input for later stages.

4. Normalize loudness
   - Loudness normalization is applied using `ebur128`.
   - This reduces level variation between different recordings.

5. Export to WAV
   - The processed signal is written as a WAV file for stable downstream consumption.

## Final Output

Each input audio file is transformed into a normalized, mono, 16 kHz WAV file.

## Whisper Docker + Timestamped Transcription

You can run a local Whisper HTTP server using the provided Dockerfile and call it from Rust.

### 1) Build and run the Whisper server image

```bash
docker build -t whisper-server-local .
docker run --rm -p 8080:8080 whisper-server-local
```

The server will be available at `http://127.0.0.1:8080`.

### 2) Convert audio to WAV (mono, 16 kHz)

```bash
cd audio-processor-rust
cargo run -- ../node-audio-service/tmp/uploads/input.mp3 ../node-audio-service/tmp/outputs/input-processed.wav
```

### 3) Transcribe WAV to text with timestamps using Rust

```bash
cd audio-processor-rust
cargo run -- transcribe ../node-audio-service/tmp/outputs/input-processed.wav
```

Optional: pass a custom Whisper server URL as the last argument.

```bash
cargo run -- transcribe ./sample.wav http://127.0.0.1:8080
```

You can also set `WHISPER_SERVER_URL` and `WHISPER_TIMEOUT_MS` environment variables.
