mod ffmpeg_converter;
use ffmpeg_converter::convert_with_ffmpeg;
use std::env;
use std::path::Path;

fn default_output_path(input_path: &str) -> String {
    let input_file = Path::new(input_path);
    let parent = input_file.parent().unwrap_or(Path::new("."));
    let stem = input_file
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("output");

    parent
        .join(format!("{}_processed.wav", stem))
        .to_string_lossy()
        .to_string()
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        eprintln!("Usage: cargo run -- <input-audio-file> [output-wav-file]");
        std::process::exit(1);
    }

    let input_path = &args[1];
    let output_path = if args.len() >= 3 {
        args[2].clone()
    } else {
        default_output_path(input_path)
    };

    println!("Opening: {}", input_path);
    println!("Output WAV: {}", output_path);

    match convert_with_ffmpeg(input_path, &output_path) {
        Ok(()) => println!("OUTPUT_WAV={}", output_path),
        Err(error) => {
            eprintln!("FFmpeg conversion failed: {}", error);
            std::process::exit(1);
        }
    }
}
