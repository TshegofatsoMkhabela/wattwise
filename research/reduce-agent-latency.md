# Research: How do we minimize end-to-end (and perceived) latency of the WattWise Copilot Studio orchestrator replies over Direct Line?

## Decision this informs
What concrete changes to make — across three layers (Copilot Studio agent config, Direct Line transport, chat UX) — to fix the ~18–20s wait we measured for a substantive orchestrator reply, and in what order.

## Current system (local grounding)
- **Transport:** Direct Line 3.0. The chat hook (`useCopilotAgent`) opens the `streamUrl` **WebSocket at component mount** ([directline.ts:205,214](../src/lib/directline.ts#L205)) — the connection is already **pre-warmed**, so setup is *not* the bottleneck. Triggers use a second, lazily-created conversation ([directline.ts:109-133](../src/lib/directline.ts#L109-L133)).
- **Measured:** greeting ≈ 1–2s; a real question ("buy electricity units") ≈ **18–20s** before any text, then a generic *"couldn't find specific information"* answer.
- **Rendering:** `onmessage` only renders **complete** `type:"message"` activities and **ignores `typing` activities** ([directline.ts:222-252](../src/lib/directline.ts#L222)). So **time-to-first-token ≈ total latency** — the user stares at bouncing dots for ~18s.
- **Agent:** generative-orchestration orchestrator fanning out to sub-agents; the "no specific information" phrasing implies generative answers over knowledge sources (retrieval in the hot path).

## How it's solved

### Studies
- **TTFT is the metric users feel; target <0.5–1s for chat; stream end-to-end.** Perceived responsiveness gates on *time-to-first-token*, not total time. [TTFT overview](https://www.emergentmind.com/topics/time-to-first-token-ttft), [serving-eval survey (abstract-only)](https://arxiv.org/pdf/2507.09019), [Boundev](https://www.boundev.ai/blog/llm-inference-latency-time-to-first-token)
- **Counter-intuitive:** a controlled human–LLM study (TTFT held at 2 / 9 / 20s, throughput constant) found **moderate delay (9s) rated *more* thoughtful and useful than 2s** (the "effort heuristic" — users read slowness as deliberation); 20s was **not** better than 9s. So "as fast as possible" is wrong for *perceived answer quality* — the real enemy is **unacknowledged dead air and delays past ~10s**. *(arXiv preprint, full-text HTML read.)* [study](https://arxiv.org/html/2604.06183)

### Companies
- **Microsoft (Copilot Studio) — official latency guidance:** send a **brief "let me look that up" holding message** at the start of a slow topic; **minimize synchronous off-agent calls** (they block the turn); prefer **HTTP Request nodes over Power Automate flows** for simple lookups (flows carry heavy overhead); set **timeouts on external global variables**. [optimize-minimize-latency](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/optimize-minimize-latency)
- **Microsoft — generative orchestration:** choosing topics/tools via the model adds a **model round-trip (~1–3s/turn)** vs classic topic routing — flexibility bought with latency. [generative-orchestration](https://learn.microsoft.com/en-us/microsoft-copilot-studio/guidance/generative-orchestration)
- **Practitioner (officeconsumer):** split one giant knowledge source into focused sources + metadata filters + semantic indexing → retrieval **~8s → <2s**. *(blog, summary-only)* [why-so-slow](https://officeconsumer.com/why-is-my-copilot-agent-so-slow-w-examples-faqs/)
- **Hard transport constraint:** **Copilot Studio agents do *not* stream tokens over Direct Line** — Web Chat renders only after the whole message is generated; token streaming is a custom-Bot-Framework feature, not available for Copilot Studio-built agents. [BotFramework-WebChat #5628 (open)](https://github.com/microsoft/BotFramework-WebChat/issues/5628)

## Where they agree / diverge
The LLM-serving literature says *stream token-by-token, sub-second TTFT*. **We can't** — Copilot Studio over Direct Line has no token streaming (issue #5628). So the academic "stream end-to-end" lever is off the table at the transport layer, and we land on the **Microsoft/practitioner side**: cut real backend generation time **and** manufacture an early "first token." The human-perception study refines the goal: we are **not** chasing 0.5s — a reply that *starts* in ~1–2s and lands the full answer by ~8–10s is the sweet spot; sub-2s can even read as less thoughtful, and our current ~18–20s of silence is squarely in "slow/broken" territory.

## Recommendation (the seed)
Attack **perceived** latency first (cheap, largest felt win), then **actual** generation time — since true token streaming is unavailable:

1. **Manufacture an early first token (biggest perceived win).** Have the orchestrator emit an immediate interim activity ("Checking your usage…") as MS recommends, **and** render Direct Line `typing` activities in the client (we currently drop them). This moves felt TTFT from ~18s to ~1–2s without touching total time.
2. **Cut real generation time to land under ~10s:** move knowledge retrieval and any Power Automate/sub-agent lookups off the synchronous hot path — focused knowledge sources + metadata filters (the ~8s→2s lever), HTTP Request nodes instead of flows, and trim orchestration hops where classic topic routing suffices.
3. **Leave transport alone.** The WebSocket is already pre-warmed; keep the secret path (a token endpoint would *add* a round-trip). Optionally set a regional `VITE_DIRECTLINE_DOMAIN` to shave network RTT.

**Tradeoff we accept:** we optimize for *perceived* speed + a moderate (~8–10s) real latency rather than chasing sub-second, because the platform can't stream and the perception study says moderate + acknowledged beats fast + silent.

## Open questions
- Does *this* orchestrator's latency come mostly from knowledge retrieval, sub-agent hops, or Power Automate calls? Needs the Power Automate dashboard / topic-level timing to target step 2 precisely.
- Can the orchestrator be authored to emit an interim message *before* it starts the slow generative step, or does generative orchestration preclude a deterministic pre-message?
- Is the generic "no specific information" answer a latency artifact (retrieval timeout) or a genuine knowledge-coverage gap?
