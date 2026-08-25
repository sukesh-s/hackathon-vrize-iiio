use std::path::Path;
use std::process::Command;

/// Convert an audio file to a Whisper-ready 16 kHz mono PCM WAV using FFmpeg.
pub fn convert_with_ffmpeg(input_path: &str, output_path: &str) -> Result<(), String> {
    if !Path::new(input_path).is_file() {
        return Err(format!("Input audio file does not exist: {}", input_path));
    }

    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            input_path,
            "-vn",
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            "-af",
            "loudnorm=I=-16:TP=-1.5:LRA=11",
            output_path,
        ])
        .output()
        .map_err(|error| {
            format!(
                "Failed to start FFmpeg. Make sure ffmpeg is installed and available in PATH: {}",
                error
            )
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("FFmpeg failed with status {}", output.status)
        } else {
            format!("FFmpeg conversion failed: {}", stderr)
        });
    }

    if !Path::new(output_path).is_file() {
        return Err(format!(
            "FFmpeg completed but did not create the output file: {}",
            output_path
        ));
    }

    Ok(())
}
