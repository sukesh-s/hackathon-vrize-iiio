BEGIN;

CREATE TABLE IF NOT EXISTS processed_audio (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    input_signature CHAR(64),
    output_signature CHAR(64),
    original_filename TEXT,
    input_mime_type TEXT,
    output_mime_type TEXT,
    input_format TEXT,
    input_path TEXT,
    output_path TEXT,
    was_converted BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS processed_audio_input_signature_idx
    ON processed_audio (input_signature);

CREATE INDEX IF NOT EXISTS processed_audio_output_signature_idx
    ON processed_audio (output_signature);

CREATE TABLE IF NOT EXISTS audio_transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_audio_id UUID NOT NULL UNIQUE
        REFERENCES processed_audio(id)
        ON DELETE CASCADE,
    transcript_json JSONB NOT NULL,
    ai_summary JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audio_transcriptions_json_idx
    ON audio_transcriptions USING GIN (transcript_json);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_speaker_id BIGINT NOT NULL,
    name TEXT,
    role TEXT NOT NULL
        CHECK (role IN ('agent', 'caller')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (external_speaker_id, role)
);

CREATE INDEX IF NOT EXISTS users_external_speaker_id_idx
    ON users (external_speaker_id);

CREATE TABLE IF NOT EXISTS call_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    processed_audio_id UUID NOT NULL UNIQUE
        REFERENCES processed_audio(id)
        ON DELETE CASCADE,
    participant_speaker_ids BIGINT[] NOT NULL
        DEFAULT ARRAY[]::BIGINT[],
    raw_metadata JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS call_metadata_participant_ids_idx
    ON call_metadata USING GIN (participant_speaker_ids);

COMMIT;
