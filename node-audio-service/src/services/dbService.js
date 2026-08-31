const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SELECT_COLUMNS = `
  id,
  input_signature AS "inputSignature",
  output_signature AS "outputSignature",
  original_filename AS "originalFilename",
  input_mime_type AS "inputMimeType",
  output_mime_type AS "outputMimeType",
  input_format AS "inputFormat",
  input_path AS "inputPath",
  output_path AS "outputPath",
  was_converted AS "wasConverted",
  created_at AS "createdAt"
`;

function validateSignature(signature, fieldName = "signature") {
  if (!/^[a-f0-9]{64}$/i.test(signature || "")) {
    throw new TypeError(`${fieldName} must be a 64-character SHA-256 hash`);
  }
}

function validateId(id) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (typeof id !== "string" || !uuidPattern.test(id)) {
    throw new TypeError("id must be a valid UUID");
  }
}

async function findById(id, client = pool) {
  validateId(id);

  const result = await client.query(
    `SELECT ${SELECT_COLUMNS}
       FROM processed_audio
      WHERE id = $1`,
    [id],
  );

  return result.rows[0] || null;
}

async function findBySignature(signature, client = pool) {
  validateSignature(signature);

  const result = await client.query(
    `SELECT ${SELECT_COLUMNS}
       FROM processed_audio
      WHERE input_signature = $1
         OR output_signature = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [signature],
  );

  return result.rows[0] || null;
}

async function findIfAiSummaryExists(processedAudioId, client = pool) {
  validateId(processedAudioId);

  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
         FROM audio_transcriptions
        WHERE processed_audio_id = $1
          AND ai_summary IS NOT NULL
          AND ai_summary <> 'null'::jsonb
     ) AS "exists"`,
    [processedAudioId],
  );

  return result.rows[0].exists;
}

async function findIfTranscriptionExists(processedAudioId, client = pool) {
  validateId(processedAudioId);

  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1
         FROM audio_transcriptions
        WHERE processed_audio_id = $1
     ) AS "exists"`,
    [processedAudioId],
  );

  return result.rows[0].exists;
}

async function findTranscriptionByProcessedAudioId(
  processedAudioId,
  client = pool,
) {
  validateId(processedAudioId);

  const result = await client.query(
    `SELECT
       id,
       processed_audio_id AS "processedAudioId",
       transcript_json AS "transcriptJson",
       ai_summary AS "aiSummary",
       created_at AS "createdAt"
     FROM audio_transcriptions
     WHERE processed_audio_id = $1
     LIMIT 1`,
    [processedAudioId],
  );

  return result.rows[0] || null;
}

function serializeJson(value, fieldName) {
  if (value === undefined) {
    throw new TypeError(`${fieldName} is required`);
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new TypeError(`${fieldName} must be JSON-serializable`);
    }
    return serialized;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes(fieldName)) {
      throw error;
    }
    throw new TypeError(`${fieldName} must be JSON-serializable`);
  }
}

async function upsertAudioTranscription({
  processedAudioId,
  transcriptJson,
  aiSummary = null,
}) {
  validateId(processedAudioId);

  const serializedTranscript = serializeJson(transcriptJson, "transcriptJson");
  const serializedAiSummary =
    aiSummary === null ? null : serializeJson(aiSummary, "aiSummary");

  const result = await pool.query(
    `INSERT INTO audio_transcriptions (
       processed_audio_id,
       transcript_json,
       ai_summary
     )
     VALUES ($1, $2::jsonb, $3::jsonb)
     ON CONFLICT (processed_audio_id)
     DO UPDATE SET
       transcript_json = EXCLUDED.transcript_json,
       ai_summary = EXCLUDED.ai_summary
     RETURNING
       id,
       processed_audio_id AS "processedAudioId",
       transcript_json AS "transcriptJson",
       ai_summary AS "aiSummary",
       created_at AS "createdAt"`,
    [processedAudioId, serializedTranscript, serializedAiSummary],
  );

  return result.rows[0];
}

async function saveCallMetadata({ processedAudioId, participants, rawMetadata }) {
  validateId(processedAudioId);

  if (!Array.isArray(participants) || participants.length === 0) {
    throw new TypeError("participants must be a non-empty array");
  }

  const serializedMetadata = serializeJson(rawMetadata, "rawMetadata");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const participant of participants) {
      const { externalSpeakerId, name = null, role } = participant;

      if (!Number.isSafeInteger(externalSpeakerId)) {
        throw new TypeError("externalSpeakerId must be an integer");
      }

      if (!["agent", "caller"].includes(role)) {
        throw new TypeError("role must be agent or caller");
      }

      await client.query(
        `INSERT INTO users (
           external_speaker_id,
           name,
           role
         )
         VALUES ($1, $2, $3)
         ON CONFLICT (external_speaker_id, role)
         DO UPDATE SET
           name = COALESCE(EXCLUDED.name, users.name),
           updated_at = NOW()`,
        [externalSpeakerId, name, role],
      );
    }

    const participantSpeakerIds = [
      ...new Set(participants.map(({ externalSpeakerId }) => externalSpeakerId)),
    ];

    const result = await client.query(
      `INSERT INTO call_metadata (
         processed_audio_id,
         participant_speaker_ids,
         raw_metadata
       )
       VALUES ($1, $2::bigint[], $3::jsonb)
       ON CONFLICT (processed_audio_id)
       DO UPDATE SET
         participant_speaker_ids = EXCLUDED.participant_speaker_ids,
         raw_metadata = EXCLUDED.raw_metadata,
         updated_at = NOW()
       RETURNING
         id,
         processed_audio_id AS "processedAudioId",
         participant_speaker_ids AS "participantSpeakerIds",
         raw_metadata AS "rawMetadata",
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [processedAudioId, participantSpeakerIds, serializedMetadata],
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateAiSummary({ transcriptionId, aiSummary }) {
  validateId(transcriptionId);

  if (aiSummary === undefined) {
    throw new TypeError("aiSummary is required");
  }

  const serializedAiSummary =
    aiSummary === null ? null : serializeJson(aiSummary, "aiSummary");

  const result = await pool.query(
    `UPDATE audio_transcriptions
        SET ai_summary = $1::jsonb
      WHERE id = $2
      RETURNING
        id,
        processed_audio_id AS "processedAudioId",
        transcript_json AS "transcriptJson",
        ai_summary AS "aiSummary",
        created_at AS "createdAt"`,
    [serializedAiSummary, transcriptionId],
  );

  return result.rows[0] || null;
}

async function upsertProcessedAudio(data = {}) {
  const { id, inputSignature, outputSignature } = data;

  if (id !== undefined && id !== null) {
    validateId(id);
  }
  if (inputSignature !== undefined && inputSignature !== null) {
    validateSignature(inputSignature, "inputSignature");
  }
  if (outputSignature !== undefined && outputSignature !== null) {
    validateSignature(outputSignature, "outputSignature");
  }

  const fieldMap = {
    inputSignature: "input_signature",
    outputSignature: "output_signature",
    originalFilename: "original_filename",
    inputMimeType: "input_mime_type",
    outputMimeType: "output_mime_type",
    inputFormat: "input_format",
    inputPath: "input_path",
    outputPath: "output_path",
    wasConverted: "was_converted",
    createdAt: "created_at",
  };

  const suppliedFields = Object.entries(fieldMap).filter(([property]) =>
    Object.prototype.hasOwnProperty.call(data, property),
  );

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize writes for either signature so simultaneous duplicate uploads
    // handled by this service cannot create two rows.
    const signatures = [inputSignature, outputSignature]
      .filter((signature) => signature !== undefined && signature !== null)
      .filter((signature, index, all) => all.indexOf(signature) === index)
      .sort();
    for (const signature of signatures) {
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
        [signature],
      );
    }

    let existingId = null;

    if (id !== undefined && id !== null) {
      const existing = await client.query(
        "SELECT id FROM processed_audio WHERE id = $1",
        [id],
      );
      existingId = existing.rows[0]?.id || null;
    } else if (signatures.length > 0) {
      const existing = await client.query(
        `SELECT id
           FROM processed_audio
          WHERE input_signature::text = ANY($1::text[])
             OR output_signature::text = ANY($1::text[])
          ORDER BY created_at ASC NULLS LAST, id ASC
          LIMIT 1`,
        [signatures],
      );
      existingId = existing.rows[0]?.id || null;
    }

    let result;

    if (existingId) {
      if (suppliedFields.length === 0) {
        result = await client.query(
          `SELECT ${SELECT_COLUMNS} FROM processed_audio WHERE id = $1`,
          [existingId],
        );
      } else {
        const assignments = suppliedFields.map(
          ([, column], index) => `${column} = $${index + 1}`,
        );
        const values = suppliedFields.map(([property]) => data[property]);
        values.push(existingId);

        result = await client.query(
          `UPDATE processed_audio
              SET ${assignments.join(", ")}
            WHERE id = $${values.length}
            RETURNING ${SELECT_COLUMNS}`,
          values,
        );
      }
    } else {
      const insertFields = [...suppliedFields];
      if (id !== undefined && id !== null) {
        insertFields.unshift(["id", "id"]);
      }

      if (insertFields.length === 0) {
        result = await client.query(
          `INSERT INTO processed_audio DEFAULT VALUES
           RETURNING ${SELECT_COLUMNS}`,
        );
      } else {
        const columns = insertFields.map(([, column]) => column);
        const values = insertFields.map(([property]) =>
          property === "id" ? id : data[property],
        );
        const placeholders = values.map((_, index) => `$${index + 1}`);

        result = await client.query(
          `INSERT INTO processed_audio (${columns.join(", ")})
           VALUES (${placeholders.join(", ")})
           RETURNING ${SELECT_COLUMNS}`,
          values,
        );
      }
    }

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const DASHBOARD_CALL_SELECT = `
  pa.id,
  pa.original_filename AS "originalFilename",
  pa.output_path AS "outputPath",
  pa.created_at AS "createdAt",
  at.id AS "transcriptionId",
  at.transcript_json AS "transcriptJson",
  at.ai_summary AS "aiSummary",
  cm.raw_metadata AS "rawMetadata",
  cm.participant_speaker_ids AS "participantSpeakerIds",
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', users.id,
          'externalSpeakerId', users.external_speaker_id,
          'name', users.name,
          'role', users.role
        )
        ORDER BY users.role
      )
      FROM users
      WHERE users.external_speaker_id = ANY(cm.participant_speaker_ids)
    ),
    '[]'::jsonb
  ) AS participants
`;

async function listDashboardCalls({
  limit = 20,
  offset = 0,
  needsAttention = null,
  resolution = null,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new TypeError("limit must be an integer between 1 and 500");
  }

  if (!Number.isInteger(offset) || offset < 0) {
    throw new TypeError("offset must be a non-negative integer");
  }

  if (needsAttention !== null && typeof needsAttention !== "boolean") {
    throw new TypeError("needsAttention must be true, false, or null");
  }

  const allowedResolutions = [
    "resolved",
    "partially_resolved",
    "unresolved",
    "unclear",
  ];
  if (resolution !== null && !allowedResolutions.includes(resolution)) {
    throw new TypeError(
      `resolution must be one of: ${allowedResolutions.join(", ")}`,
    );
  }

  const conditions = [];
  const filterValues = [];

  if (needsAttention !== null) {
    filterValues.push(String(needsAttention));
    conditions.push(
      `LOWER(COALESCE(at.ai_summary #>> '{needsManagerAttention,needed}', 'false')) = $${filterValues.length}`,
    );
  }

  if (resolution === "unclear") {
    conditions.push(
      `LOWER(COALESCE(at.ai_summary #>> '{resolution,status}', 'unknown')) NOT IN ('resolved', 'partially_resolved', 'unresolved')`,
    );
  } else if (resolution !== null) {
    filterValues.push(resolution);
    conditions.push(
      `LOWER(COALESCE(at.ai_summary #>> '{resolution,status}', 'unknown')) = $${filterValues.length}`,
    );
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countResult = await pool.query(
    `SELECT COUNT(*)::integer AS total
       FROM processed_audio pa
       JOIN audio_transcriptions at ON at.processed_audio_id = pa.id
       LEFT JOIN call_metadata cm ON cm.processed_audio_id = pa.id
       ${whereClause}`,
    filterValues,
  );

  const limitParameter = filterValues.length + 1;
  const offsetParameter = filterValues.length + 2;

  const result = await pool.query(
    `SELECT ${DASHBOARD_CALL_SELECT}
       FROM processed_audio pa
       JOIN audio_transcriptions at ON at.processed_audio_id = pa.id
       LEFT JOIN call_metadata cm ON cm.processed_audio_id = pa.id
      ${whereClause}
      ORDER BY
        CASE
          WHEN at.ai_summary #>> '{needsManagerAttention,score}' ~ '^\\d+$'
          THEN (at.ai_summary #>> '{needsManagerAttention,score}')::integer
          ELSE 0
        END DESC,
        COALESCE(
          (cm.raw_metadata ->> 'start_time_ms')::bigint,
          (EXTRACT(EPOCH FROM pa.created_at) * 1000)::bigint
        ) DESC
      LIMIT $${limitParameter} OFFSET $${offsetParameter}`,
    [...filterValues, limit, offset],
  );

  return {
    total: countResult.rows[0].total,
    rows: result.rows,
  };
}

async function getDashboardSummary() {
  const result = await pool.query(
    `WITH analysed_calls AS (
       SELECT at.ai_summary
         FROM audio_transcriptions at
        WHERE at.ai_summary IS NOT NULL
          AND at.ai_summary <> 'null'::jsonb
     ), totals AS (
       SELECT
         COUNT(*)::integer AS "totalCalls",
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(ai_summary #>> '{needsManagerAttention,needed}', 'false')) = 'true'
         )::integer AS "needsAttention",
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(ai_summary #>> '{resolution,status}', '')) = 'unresolved'
         )::integer AS unresolved,
         COUNT(*) FILTER (
           WHERE LOWER(COALESCE(ai_summary #>> '{resolution,status}', '')) = 'resolved'
         )::integer AS resolved
       FROM analysed_calls
     )
     SELECT
       "totalCalls",
       "needsAttention",
       unresolved,
       resolved,
       CASE
         WHEN "totalCalls" = 0 THEN 0
         ELSE ROUND((resolved::numeric / "totalCalls") * 100, 1)
       END AS "resolutionRate"
     FROM totals`,
  );

  const summary = result.rows[0];
  return {
    totalCalls: summary.totalCalls,
    needsAttention: summary.needsAttention,
    unresolved: summary.unresolved,
    resolved: summary.resolved,
    resolutionRate: Number(summary.resolutionRate),
  };
}

async function findDashboardCallById(id) {
  validateId(id);

  const result = await pool.query(
    `SELECT ${DASHBOARD_CALL_SELECT}
       FROM processed_audio pa
       JOIN audio_transcriptions at ON at.processed_audio_id = pa.id
       LEFT JOIN call_metadata cm ON cm.processed_audio_id = pa.id
      WHERE pa.id = $1
      LIMIT 1`,
    [id],
  );

  return result.rows[0] || null;
}

async function closeDatabase() {
  await pool.end();
}

module.exports = {
  closeDatabase,
  findById,
  findDashboardCallById,
  findIfAiSummaryExists,
  findIfTranscriptionExists,
  findTranscriptionByProcessedAudioId,
  findBySignature,
  getDashboardSummary,
  listDashboardCalls,
  saveCallMetadata,
  updateAiSummary,
  upsertAudioTranscription,
  upsertProcessedAudio,
};
