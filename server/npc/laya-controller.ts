import type { NpcController } from "./controller.ts";
import type { NpcAction, NpcObservation } from "../../src/npc/types.ts";
import { object, text } from "../../src/npc/validation.ts";
import { NpcProviderError } from "./provider-status.ts";

export const LAYA_MODEL = "convaiinnovations/laya-typed-decisions";

const lines: Record<NpcAction, string> = {
  rest: "I need to rest and protect my health this year.",
  work: "I will take workshop work. My household needs the wages.",
  study: "I will pay for supplies and spend this year learning.",
  train: "I will build my strength and endurance through training.",
  "prepare-fields": "I will keep our fields in grain so we have food.",
  "buy-food": "I will buy grain with our household money.",
  "offer-lesson":
    "I can teach you letters this year, if you wish to pay for a lesson.",
  "offer-grain": "I can sell you ten grain at the shop's current asking price.",
  "offer-gift": "I can offer six drachmas from my own purse, if you need them.",
};

interface Candidate {
  action: NpcAction;
  label: string;
  speech: string;
}
export function layaCandidates(
  observation: NpcObservation,
  message?: string,
): Candidate[] {
  if (message)
    return [
      {
        action: "rest",
        label: "Discuss food and household money",
        speech: `Food and money need care. My ${observation.resources.account} account holds ${observation.resources.cash} drachmas and ${observation.resources.grain} grain.`,
      },
      {
        action: "rest",
        label: "Discuss work and learning",
        speech: `My aim is to ${observation.actor.goal.charAt(0).toLowerCase() + observation.actor.goal.slice(1)} Work and learning both take time.`,
      },
      {
        action: "rest",
        label: "Discuss health and current conditions",
        speech: `My health is ${observation.actor.health}. We face a ${observation.conditions.flood} flood and ${observation.conditions.army} army conditions. I must look after myself too.`,
      },
    ];
  const choices = observation.actions.map((a) => ({
    action: a.id,
    label: `${a.label}: ${a.cost}`,
    speech: lines[a.id],
  }));
  if (choices.length === 1)
    choices.push({
      ...choices[0],
      label: "Rest quietly and conserve resources",
      speech: "I will keep a quiet year and conserve my strength.",
    });
  return choices;
}

/** Laya ranks supplied choices. Its selected, authored response is not free-form LLM text. */
export function layaNpcController(config: {
  endpoint: string;
  apiKey?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}): NpcController {
  let endpoint: URL;
  try {
    endpoint = new URL(config.endpoint);
  } catch {
    throw new NpcProviderError("configuration", "Invalid Laya endpoint.");
  }
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    (endpoint.protocol !== "https:" &&
      !(
        endpoint.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(endpoint.hostname)
      ))
  )
    throw new NpcProviderError(
      "configuration",
      "Laya requires HTTPS or a loopback HTTP endpoint.",
    );
  if (endpoint.protocol === "https:" && !config.apiKey)
    throw new NpcProviderError(
      "configuration",
      "A hosted Laya endpoint requires server authentication.",
    );
  let queue: Promise<unknown> = Promise.resolve();
  async function infer(
    observation: NpcObservation,
    signal: AbortSignal,
    message?: string,
  ) {
    if (signal.aborted)
      throw new NpcProviderError(
        "timeout",
        "Laya decision expired before inference.",
      );
    const candidates = layaCandidates(observation, message);
    if (candidates.length < 2)
      throw new NpcProviderError(
        "invalid-response",
        "No NPC choice is available.",
      );
    const criteria = Object.fromEntries(
      candidates.map((candidate, index) => [
        `choice_${index}`,
        candidate.label,
      ]),
    );
    const state = JSON.stringify({
      person: observation.actor,
      player: observation.player,
      conditions: observation.conditions,
      resources: observation.resources,
      memory: observation.memory.slice(-2),
      ...(message ? { playerMessage: message } : {}),
    });
    let response: Response;
    try {
      response = await (config.fetcher ?? fetch)(endpoint, {
        method: "POST",
        redirect: "manual",
        signal: AbortSignal.any([
          signal,
          AbortSignal.timeout(config.timeoutMs ?? 9000),
        ]),
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: LAYA_MODEL,
          state,
          questions: {
            npc: {
              type: "choice",
              instructions: message
                ? "Choose a truthful response to the player."
                : "Choose one action that serves my own goal and needs.",
              criteria,
            },
          },
        }),
      });
    } catch (error) {
      throw new NpcProviderError(
        signal.aborted ||
          (error instanceof DOMException &&
            ["AbortError", "TimeoutError"].includes(error.name))
          ? "timeout"
          : "network",
        "Laya could not complete this decision.",
      );
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new NpcProviderError(
        response.status === 401 || response.status === 403
          ? "authentication"
          : response.status === 429
            ? "rate-limit"
            : "unavailable",
        "Laya request failed.",
      );
    }
    try {
      if (Number(response.headers.get("content-length")) > 16000)
        throw new Error();
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      let raw = "";
      const decoder = new TextDecoder();
      let size = 0;
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 16000) {
            await reader.cancel();
            throw new Error();
          }
          raw += decoder.decode(part.value, { stream: true });
        }
        raw += decoder.decode();
      } finally {
        reader.releaseLock();
      }
      const body = object(JSON.parse(raw), ["model", "answers", "usage"]);
      if (body.model !== LAYA_MODEL) throw new Error();
      const answers = object(body.answers, ["npc"]),
        answer = object(answers.npc, [
          "type",
          "choice",
          "confidence",
          "probabilities",
        ]);
      if (
        answer.type !== "choice" ||
        typeof answer.confidence !== "number" ||
        !Number.isFinite(answer.confidence) ||
        answer.confidence < 0 ||
        answer.confidence > 1
      )
        throw new Error();
      const probabilities = object(answer.probabilities, Object.keys(criteria));
      const scores = Object.values(probabilities);
      if (
        scores.some(
          (p) => typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > 1,
        )
      )
        throw new Error();
      const total = (scores as number[]).reduce((a, b) => a + b, 0),
        choice = text(answer.choice, 100);
      if (
        Math.abs(total - 1) > 0.002 ||
        !Object.hasOwn(criteria, choice) ||
        Number(probabilities[choice]) <
          Math.max(...(scores as number[])) - 0.0001
      )
        throw new Error();
      const selected = candidates[Object.keys(criteria).indexOf(choice)];
      return { action: selected.action, speech: selected.speech };
    } catch (error) {
      throw new NpcProviderError(
        signal.aborted ||
          (error instanceof DOMException &&
            ["AbortError", "TimeoutError"].includes(error.name))
          ? "timeout"
          : "invalid-response",
        "Laya returned an invalid decision.",
      );
    }
  }
  return {
    kind: "laya",
    decide(observation, signal, message) {
      const pending = queue.then(() => infer(observation, signal, message));
      queue = pending.catch(() => undefined);
      return pending;
    },
  };
}
