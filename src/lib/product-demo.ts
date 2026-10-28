import type { Source } from "./types";

// Curated illustration. Model labels show the recorded selection, never authorship.
export const demoQuestion = "Help me understand Quantum Computing";
export const demoFollowUp = "How does superposition allow qubits to process multiple states at once?";
export const demoModels = ["GPT-OSS 120B", "Qwen 3.8 27B · Preview"] as const;
export const demoSources: Source[] = [
  { id: 1, title: "Understanding superposition", url: "https://quantum.microsoft.com/en-us/insights/education/concepts/superposition", snippet: "A qubit is a linear combination of basis states, with probability amplitudes." },
  { id: 2, title: "Measuring qubits", url: "https://quantum.cloud.ibm.com/docs/en/guides/measure-qubits", snippet: "Measurement in the computational basis returns a classical bit string." },
  { id: 3, title: "Superposition and interference", url: "https://quantum.cloud.ibm.com/learning/en/modules/quantum-mechanics/superposition-with-qiskit", snippet: "Quantum gates change amplitudes, which can reinforce or cancel through interference." },
];
export const demoParagraphs = [
  "Quantum computing uses **qubits** to represent information. A qubit can be in a superposition of the 0 and 1 basis states; measuring it in that basis gives a single outcome. [1][2]",
  "**Quantum gates** change the amplitudes that determine measurement probabilities. Algorithms combine gates so interference can reinforce some outcomes and cancel others. [3]",
  "Quantum computers do not speed up every task: useful results depend on the algorithm and problem. [3]",
];
export const demoFollowUpParagraphs = [
  "Superposition lets a quantum operation act on a **combination of basis states**. For two qubits, these are 00, 01, 10 and 11, each with a probability amplitude. [1][2]",
  "Those amplitudes can interfere. A quantum algorithm arranges operations to make some outcomes more likely and others less likely; it does not reveal four separate answers in one measurement. [3]",
  "Measuring two qubits returns **one bit string**, such as 01. Repeated runs help estimate the probabilities. The useful part is how the algorithm shapes those probabilities. [2][3]",
];
export const demoAnswer = demoParagraphs.join("\n\n");
export const demoFollowUpAnswer = demoFollowUpParagraphs.join("\n\n");

// Every scene, camera move, word and scroll stop follows this one clock (ms).
export const demoScenes = {
  establish: 0, zoomQuestion: 1500, typeQuestion: 2300, questionReady: 5700,
  submit: 7000, sources: 8600, answer: 10800, read: 25700,
  zoomFollowUp: 29000, modelMenu: 29700, selectModel: 31000,
  typeFollowUp: 31400, followUpReady: 36300, submitFollowUp: 37800,
  followUpSources: 39400, answerFollowUp: 41500, complete: 56400,
  fade: 63100, end: 64000,
} as const;
export const demoDuration = demoScenes.end;
export const demoCompletedAt = 58000;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export function demoEase(t: number, start: number, end: number) {
  const p = clamp((t - start) / (end - start));
  return p * p * (3 - 2 * p);
}
function type(text: string, t: number, start: number, end: number) {
  return text.slice(0, Math.floor(clamp((t - start) / (end - start)) * text.length));
}
function reveal(paragraphs: string[], t: number, start: number) {
  // Separate paragraph reveals leave still moments to read and move the pane.
  return paragraphs.map((text, i) => {
    const words = text.match(/\S+\s*/g)!;
    const count = Math.floor(clamp((t - start - i * 5200) / 3600) * words.length);
    return words.slice(0, count).join("").trim();
  }).filter(Boolean).join("\n\n");
}
export function demoFrame(elapsed: number) {
  const t = ((elapsed % demoDuration) + demoDuration) % demoDuration;
  const s = demoScenes;
  const submitted = t >= s.submit, followUpSubmitted = t >= s.submitFollowUp;
  const zoom = demoEase(t, s.zoomQuestion, s.typeQuestion) * (1 - demoEase(t, s.submit, s.submit + 1100))
    + demoEase(t, s.zoomFollowUp, s.modelMenu) * (1 - demoEase(t, s.submitFollowUp, s.submitFollowUp + 1100));
  return {
    time: t, zoom,
    phase: t < s.zoomQuestion ? "establish" : t < s.submit ? "question" : t < s.answer ? "research"
      : t < s.read ? "answer" : t < s.zoomFollowUp ? "read" : t < s.submitFollowUp ? "follow-up"
      : t < s.answerFollowUp ? "research-follow-up" : t < s.complete ? "answer-follow-up" : t < s.fade ? "complete" : "reset",
    submitted, followUpSubmitted,
    sourceCount: t < s.sources ? 0 : t < s.sources + 450 ? 1 : t < s.sources + 900 ? 2 : 3,
    followUpSourceCount: t < s.followUpSources ? 0 : t < s.followUpSources + 450 ? 1 : t < s.followUpSources + 900 ? 2 : 3,
    answer: reveal(demoParagraphs, t, s.answer),
    followUpAnswer: reveal(demoFollowUpParagraphs, t, s.answerFollowUp),
    draft: !submitted ? type(demoQuestion, t, s.typeQuestion, s.questionReady)
      : t >= s.typeFollowUp && !followUpSubmitted ? type(demoFollowUp, t, s.typeFollowUp, s.followUpReady) : "",
    model: demoModels[t >= s.selectModel ? 1 : 0],
    modelMenu: t >= s.modelMenu && t < s.selectModel,
    researching: (submitted && t < s.answer) || (followUpSubmitted && t < s.answerFollowUp),
    opacity: demoEase(t, 0, 500) * (1 - demoEase(t, s.fade, s.end)),
  };
}

// Scroll to meaningful paragraph stops, using actual responsive DOM positions.
// New words never start their own scrolling timer or trigger document scrolling.
export function demoScroll(t: number, stops: number[]) {
  const moves = [
    [demoScenes.answer + 3800, demoScenes.answer + 5000, 1],
    [demoScenes.answer + 9000, demoScenes.answer + 10200, 2],
    [demoScenes.answer + 14000, demoScenes.answer + 14800, 3],
    [demoScenes.submitFollowUp, demoScenes.submitFollowUp + 1100, 4],
    [demoScenes.answerFollowUp + 3800, demoScenes.answerFollowUp + 5000, 5],
    [demoScenes.answerFollowUp + 9000, demoScenes.answerFollowUp + 10200, 6],
    [demoScenes.answerFollowUp + 14000, demoScenes.answerFollowUp + 14800, 7],
  ];
  let position = 0;
  for (const [start, end, index] of moves) {
    position += ((stops[index!] ?? 0) - position) * demoEase(t, start!, end!);
  }
  return position;
}
