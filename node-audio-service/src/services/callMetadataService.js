function parseCallMetadata(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value === "object") {
    return value;
  }

  if (typeof value !== "string") {
    throw new TypeError("metadata must be a JSON object or JSON string");
  }

  try {
    const parsed = JSON.parse(value);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("metadata must contain a JSON object");
    }

    return parsed;
  } catch (error) {
    if (error instanceof TypeError) {
      throw error;
    }

    throw new TypeError(`metadata must contain valid JSON: ${error.message}`);
  }
}

function requireSpeakerId(participant, role) {
  const speakerId = participant?.speaker_id;

  if (!Number.isSafeInteger(speakerId)) {
    throw new TypeError(`${role}.speaker_id must be an integer`);
  }

  return speakerId;
}

function extractParticipants(metadata) {
  if (!metadata?.agent || !metadata?.caller) {
    throw new TypeError("metadata must contain agent and caller objects");
  }

  return [
    {
      externalSpeakerId: requireSpeakerId(metadata.agent, "agent"),
      name: metadata.agent.metadata?.agent_name ?? null,
      role: "agent",
    },
    {
      externalSpeakerId: requireSpeakerId(metadata.caller, "caller"),
      name: metadata.caller.metadata?.["first and last name"] ?? null,
      role: "caller",
    },
  ];
}

function createSpeakerMap(metadata) {
  const [agent, caller] = extractParticipants(metadata);

  return {
    SPEAKER_00: {
      role: agent.role,
      name: agent.name,
      speakerId: agent.externalSpeakerId,
    },
    SPEAKER_01: {
      role: caller.role,
      name: caller.name,
      speakerId: caller.externalSpeakerId,
    },
  };
}

module.exports = {
  createSpeakerMap,
  extractParticipants,
  parseCallMetadata,
};
