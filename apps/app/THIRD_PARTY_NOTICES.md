# Offline speech components

Voicela bundles whisper.cpp v1.8.4 from https://github.com/ggml-org/whisper.cpp and the quantized Whisper small multilingual model distributed through https://huggingface.co/ggerganov/whisper.cpp, based on https://github.com/openai/whisper.

Both use the MIT license. Complete upstream license texts are included beside the runtime as LICENSE-whisper.cpp.txt and LICENSE-whisper-model.txt. The setup script pins SHA-256 hashes for the release archive and model and records hashes for copied executable/library files. Network access prepares build assets; speech inference runs locally.
