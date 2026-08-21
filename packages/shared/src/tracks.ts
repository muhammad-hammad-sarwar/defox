import { ContractValidationError, assertNonEmptyString } from "./contracts.js";

export const MAX_V1_TRACKS = 3;
export const TRACK_STATES = ["planned", "blocked", "ready", "running", "checkpointed", "integrated", "superseded", "failed", "cancelled"] as const;
export type TrackState = (typeof TRACK_STATES)[number];
export const TERMINAL_TRACK_STATES = ["integrated", "superseded", "failed", "cancelled"] as const;
export type TerminalTrackState = (typeof TERMINAL_TRACK_STATES)[number];

export const TRACK_TRANSITIONS: Readonly<Record<TrackState, readonly TrackState[]>> = {
  planned: ["blocked", "ready", "cancelled", "superseded"],
  blocked: ["ready", "cancelled", "superseded"],
  ready: ["running", "cancelled", "superseded"],
  running: ["checkpointed", "failed", "cancelled", "superseded"],
  checkpointed: ["integrated", "failed", "cancelled", "superseded"],
  integrated: [],
  superseded: [],
  failed: [],
  cancelled: [],
};

export interface TrackOwnership {
  /** Repository-relative directory or file roots. Globs, absolute paths, and .git are forbidden. */
  paths: string[];
}

export interface AgentTrack {
  id: string;
  title: string;
  dependsOn: string[];
  ownership: TrackOwnership;
  state: TrackState;
  attempt: number;
  generation: number;
  branchName: string;
  worktreePath: string;
}

export const INTEGRATION_OUTCOMES = ["applied", "noop", "conflict", "replan", "needs_human"] as const;
export type IntegrationOutcome = (typeof INTEGRATION_OUTCOMES)[number];

export interface IntegrationReport {
  outcome: IntegrationOutcome;
  integratedTrackIds: string[];
  rejectedTrackIds: string[];
  summary: string;
  artifactIds: string[];
}

export function isTerminalTrackState(state: TrackState): state is TerminalTrackState {
  return TERMINAL_TRACK_STATES.includes(state as TerminalTrackState);
}

export function canTransitionTrack(from: TrackState, to: TrackState): boolean {
  return TRACK_TRANSITIONS[from].includes(to);
}

export function assertTrackTransition(from: TrackState, to: TrackState): void {
  if (!canTransitionTrack(from, to))
    throw new ContractValidationError("ILLEGAL_STATE_TRANSITION", `Cannot transition track from ${from} to ${to}`);
}

export function transitionTrack(track: AgentTrack, to: TrackState): AgentTrack {
  assertTrackTransition(track.state, to);
  return { ...track, state: to };
}

export function normalizeRepositoryPath(path: string): string {
  assertNonEmptyString(path, "path");
  const normalized = path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.split("/").some((part) => part === "" || part === "." || part === "..") ||
    normalized === ".git" ||
    normalized.startsWith(".git/")
  ) {
    throw new ContractValidationError("TRACK_OWNERSHIP_VIOLATION", `Path is outside the repository ownership boundary: ${path}`);
  }
  return normalized;
}

function isNormalizedPathWithinOwnership(path: string, normalizedRoots: readonly string[]): boolean {
  return normalizedRoots.some((root) => path === root || path.startsWith(`${root}/`));
}

export function isPathWithinOwnership(path: string, ownership: TrackOwnership): boolean {
  return isNormalizedPathWithinOwnership(
    normalizeRepositoryPath(path),
    ownership.paths.map(normalizeRepositoryPath),
  );
}

export function assertTrackOwnsPath(track: Pick<AgentTrack, "id" | "ownership">, path: string): string {
  const normalizedPath = normalizeRepositoryPath(path);
  const normalizedRoots = track.ownership.paths.map(normalizeRepositoryPath);
  if (!isNormalizedPathWithinOwnership(normalizedPath, normalizedRoots))
    throw new ContractValidationError("TRACK_OWNERSHIP_VIOLATION", `Track ${track.id} does not own ${normalizedPath}`);
  return normalizedPath;
}

function pathsOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

export function assertValidTrackPlan(tracks: readonly AgentTrack[]): void {
  if (tracks.length < 1 || tracks.length > MAX_V1_TRACKS)
    throw new ContractValidationError("VALIDATION_ERROR", `A v1 plan must contain one to ${MAX_V1_TRACKS} tracks`);
  const byId = new Map<string, AgentTrack>();
  for (const track of tracks) {
    assertNonEmptyString(track.id, "track.id");
    if (byId.has(track.id)) throw new ContractValidationError("VALIDATION_ERROR", `Duplicate track id: ${track.id}`);
    if (track.ownership.paths.length === 0)
      throw new ContractValidationError("VALIDATION_ERROR", `Track ${track.id} must own at least one path`);
    const normalizedOwnership = track.ownership.paths.map(normalizeRepositoryPath);
    if (new Set(normalizedOwnership).size !== normalizedOwnership.length)
      throw new ContractValidationError("VALIDATION_ERROR", `Track ${track.id} has duplicate ownership paths`);
    byId.set(track.id, { ...track, ownership: { paths: normalizedOwnership } });
  }
  for (const track of tracks) {
    for (const dependency of track.dependsOn) {
      if (dependency === track.id || !byId.has(dependency))
        throw new ContractValidationError("VALIDATION_ERROR", `Track ${track.id} has an invalid dependency: ${dependency}`);
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new ContractValidationError("VALIDATION_ERROR", "Track dependencies must be acyclic");
    if (visited.has(id)) return;
    visiting.add(id);
    byId.get(id)?.dependsOn.forEach(visit);
    visiting.delete(id);
    visited.add(id);
  };
  tracks.forEach((track) => visit(track.id));

  for (let index = 0; index < tracks.length; index += 1) {
    const left = byId.get(tracks[index]!.id)!;
    for (const rightInput of tracks.slice(index + 1)) {
      const right = byId.get(rightInput.id)!;
      for (const leftPath of left.ownership.paths) {
        for (const rightPath of right.ownership.paths) {
          if (pathsOverlap(leftPath, rightPath))
            throw new ContractValidationError("TRACK_OWNERSHIP_VIOLATION", `Tracks ${left.id} and ${right.id} have overlapping ownership: ${leftPath} / ${rightPath}`);
        }
      }
    }
  }
}

export function areTrackDependenciesSatisfied(track: AgentTrack, tracks: readonly AgentTrack[]): boolean {
  const byId = new Map(tracks.map((candidate) => [candidate.id, candidate]));
  // A checkpoint is an immutable handoff commit. Dependents may begin from it
  // before the Integrator applies it to the canonical branch.
  return track.dependsOn.every((id) => {
    const state = byId.get(id)?.state;
    return state === "checkpointed" || state === "integrated";
  });
}
